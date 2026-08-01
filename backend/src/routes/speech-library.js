/**
 * Phase 8: 话术库 + 智能匹配 — Speech Library & Smart Matching
 * Manages saved speech samples and provides intelligent matching based on context.
 */
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { chatComplete } from '../services/ai.service.js';
import { getProviderById } from '../services/ai-client.js';

const router = Router();
const prisma = new PrismaClient();

// ── Helpers ──────────────────────────────────────────────────────
function normalizeJid(jid) {
  if (!jid || !jid.includes('@')) return [];
  const phone = jid.split('@')[0];
  const variants = [jid];
  if (jid.endsWith('@s.whatsapp.net')) {
    variants.push(phone + '@c.us');
    variants.push(phone + '@lid');
  } else if (jid.endsWith('@c.us')) {
    variants.push(phone + '@s.whatsapp.net');
    variants.push(phone + '@lid');
  } else if (jid.endsWith('@lid')) {
    variants.push(phone + '@s.whatsapp.net');
    variants.push(phone + '@c.us');
  }
  return variants;
}

function decodeJid(raw) {
  if (!raw) return null;
  let jid = decodeURIComponent(raw);
  if (!jid.includes('@')) jid += '@s.whatsapp.net';
  return jid;
}

function safeParseLLMJson(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch) { try { return JSON.parse(fenceMatch[1].trim()); } catch {} }
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (jsonMatch) { try { return JSON.parse(jsonMatch[0]); } catch {} }
  return null;
}

async function resolveProvider() {
  const gptProvider = await getProviderById('p1784629520517');
  return {
    provider: gptProvider || null,
    modelId: gptProvider ? gptProvider.model : 'gpt-4o-mini'
  };
}

// ── Smart Matching ───────────────────────────────────────────────

/**
 * Find the most relevant speech samples for a given customer situation.
 * Uses a combination of keyword matching and LLM semantic matching.
 * @param {string} jid - Customer JID
 * @param {string} [query] - Optional search query; if not provided, uses latest customer message
 */
export async function smartMatchSamples(jid, query = null) {
  try {
    if (!jid) return { error: 'jid required' };

    const variants = normalizeJid(jid);
    const contact = await prisma.contact.findFirst({
      where: { jid: { in: variants } },
      orderBy: { id: 'desc' },
    });
    if (!contact) return { error: 'contact not found' };

    // Determine search query
    let searchQuery = query;
    if (!searchQuery) {
      const latestMsg = await prisma.message.findFirst({
        where: { contactId: contact.id, fromMe: false },
        orderBy: { timestamp: 'desc' },
      });
      searchQuery = latestMsg?.content || '';
    }

    if (!searchQuery.trim()) {
      return { error: 'No context to match against', samples: [] };
    }

    // Get attitude for context enrichment
    const attitude = await prisma.customerAttitude.findFirst({
      where: { contactId: contact.id },
    });
    const focusPoints = attitude ? JSON.parse(attitude.focusPoints || '[]') : [];

    // Get BANT for context
    const bant = await prisma.customerBantScore.findFirst({
      where: { contactId: contact.id },
      orderBy: { evaluatedAt: 'desc' },
    });

    // Get all active samples (favorited first, then by quality score)
    const allSamples = await prisma.messageSample.findMany({
      where: { accountId: 1 },
      orderBy: [
        { favorited: 'desc' },
        { qualityScore: 'desc' },
        { createdAt: 'desc' },
      ],
      take: 100, // Get top 100 for matching
    });

    if (allSamples.length === 0) {
      return { samples: [], query: searchQuery };
    }

    // Use LLM for semantic matching
    const { modelId, provider } = await resolveProvider();

    const systemPrompt = `You are an expert at matching sales conversation samples. Given a customer's current message and context, find the most relevant historical sales replies from a library.

You must respond with valid JSON only, no markdown, no explanation.`;

    const samplesText = allSamples.map((s, i) => {
      const meta = [];
      if (s.industry) meta.push(`行业:${s.industry}`);
      if (s.productLine) meta.push(`产品:${s.productLine}`);
      if (s.application) meta.push(`应用:${s.application}`);
      if (s.scene) meta.push(`场景:${s.scene}`);
      const metaStr = meta.length > 0 ? ` [${meta.join(', ')}]` : '';
      return `[${i}] 客户消息: "${s.customerMsg}"${metaStr} → 销售回复: "${s.salesReply}"`;
    }).join('\n');

    const userPrompt = `Customer's current message: "${searchQuery}"

Customer context:
- Focus points: ${focusPoints.join(', ') || 'unknown'}
- BANT level: ${bant?.level || 'unknown'} (${bant?.totalScore || '?'}/10)

## Speech Library (top 100 samples)
${samplesText}

## Task
Select the top 5 most relevant samples for this customer's situation. Consider:
1. Relevance of the customer's previous question to the current message
2. Industry/product/application match
3. Scene/scenario match
4. Quality and favorited status

Respond with this exact JSON:
{
  "matchedIndices": [2, 15, 7, 33, 1],
  "reasoning": "Brief explanation of matching logic"
}`;

    let matchedIndices = [];
    try {
      const raw = await chatComplete(modelId, systemPrompt, userPrompt, {
        temperature: 0.2,
        maxTokens: 500,
        provider,
        timeout: 30000,
      });
      const result = safeParseLLMJson(raw);
      if (result && Array.isArray(result.matchedIndices)) {
        matchedIndices = result.matchedIndices.filter(i => i >= 0 && i < allSamples.length).slice(0, 5);
      }
    } catch (e) {
      console.error('[SpeechLibrary] LLM matching error:', e.message);
    }

    // Fallback: keyword matching
    if (matchedIndices.length === 0) {
      const queryLower = searchQuery.toLowerCase();
      const scored = allSamples.map((s, idx) => {
        let score = 0;
        if (s.customerMsg) {
          const words = queryLower.split(/\s+/);
          for (const w of words) {
            if (w.length > 2 && s.customerMsg.toLowerCase().includes(w)) score += 2;
          }
        }
        if (s.favorited) score += 5;
        if (s.qualityScore) score += s.qualityScore;
        if (focusPoints.length > 0 && s.scene) {
          for (const fp of focusPoints) {
            if (s.scene.toLowerCase().includes(fp.toLowerCase())) score += 3;
          }
        }
        return { idx, score };
      });
      scored.sort((a, b) => b.score - a.score);
      matchedIndices = scored.filter(s => s.score > 0).slice(0, 5).map(s => s.idx);
    }

    const matchedSamples = matchedIndices.map(i => allSamples[i]).filter(Boolean);

    return {
      success: true,
      query: searchQuery,
      samples: matchedSamples,
      totalInLibrary: allSamples.length,
    };
  } catch (err) {
    console.error('[SpeechLibrary] smartMatch error:', err.message);
    return { error: err.message };
  }
}

/**
 * Auto-save a speech sample when a sales rep sends a message.
 */
export async function autoSaveSample(accountId, contactJid, customerMsg, salesReply, options = {}) {
  try {
    const sample = await prisma.messageSample.create({
      data: {
        accountId: accountId || 1,
        contactJid: contactJid,
        customerMsg: customerMsg || '',
        customerMsgLang: options.customerLang || null,
        customerMsgTranslated: options.customerMsgTranslated || null,
        salesReply: salesReply || '',
        salesReplyLang: options.salesLang || null,
        salesReplyTranslated: options.salesReplyTranslated || null,
        usedAi: options.usedAi || false,
        aiSuggestion: options.aiSuggestion || null,
        aiModified: options.aiModified || false,
        scene: options.scene || null,
        productLine: options.productLine || null,
      },
    });
    return sample;
  } catch (err) {
    console.error('[SpeechLibrary] autoSave error:', err.message);
    return null;
  }
}

// ── API Routes ───────────────────────────────────────────────────

/**
 * GET /api/speech-library - List all speech samples
 * Query params: accountId, scene, productLine, favorited, search, page, pageSize
 */
router.get('/', async (req, res) => {
  try {
    const { accountId = 1, scene, productLine, favorited, search, page = 1, pageSize = 20 } = req.query;
    const where = { accountId: parseInt(accountId) };

    if (scene) where.scene = scene;
    if (productLine) where.productLine = productLine;
    if (favorited === 'true') where.favorited = true;
    if (search) {
      where.OR = [
        { customerMsg: { contains: search } },
        { salesReply: { contains: search } },
        { customerMsgTranslated: { contains: search } },
        { salesReplyTranslated: { contains: search } },
      ];
    }

    const [samples, total] = await Promise.all([
      prisma.messageSample.findMany({
        where,
        orderBy: [
          { favorited: 'desc' },
          { qualityScore: 'desc' },
          { createdAt: 'desc' },
        ],
        skip: (parseInt(page) - 1) * parseInt(pageSize),
        take: parseInt(pageSize),
      }),
      prisma.messageSample.count({ where }),
    ]);

    res.json({
      success: true,
      samples,
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total,
        totalPages: Math.ceil(total / parseInt(pageSize)),
      },
    });
  } catch (err) {
    console.error('[SpeechLibrary] GET list error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/speech-library - Create a new speech sample
 */
router.post('/', async (req, res) => {
  try {
    const {
      accountId = 1, contactJid, customerMsg, customerMsgTranslated, customerMsgLang,
      salesReply, salesReplyTranslated, salesReplyLang,
      usedAi = false, aiSuggestion, aiModified = false,
      scene, productLine, application, industry,
    } = req.body;

    if (!customerMsg || !salesReply) {
      return res.status(400).json({ error: 'customerMsg and salesReply are required' });
    }

    const sample = await prisma.messageSample.create({
      data: {
        accountId,
        contactJid: contactJid || '',
        customerMsg,
        customerMsgTranslated,
        customerMsgLang,
        salesReply,
        salesReplyTranslated,
        salesReplyLang,
        usedAi,
        aiSuggestion,
        aiModified,
        scene,
        productLine,
        application,
        industry,
      },
    });

    res.json({ success: true, sample });
  } catch (err) {
    console.error('[SpeechLibrary] POST create error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/speech-library/:id - Update a speech sample
 */
router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updateData = {};
    const allowedFields = [
      'customerMsg', 'customerMsgTranslated', 'customerMsgLang',
      'salesReply', 'salesReplyTranslated', 'salesReplyLang',
      'usedAi', 'aiSuggestion', 'aiModified',
      'scene', 'productLine', 'application', 'industry',
      'favorited', 'qualityScore',
    ];
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) updateData[field] = req.body[field];
    }

    const sample = await prisma.messageSample.update({
      where: { id },
      data: updateData,
    });
    res.json({ success: true, sample });
  } catch (err) {
    console.error('[SpeechLibrary] PUT error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/speech-library/:id - Delete a speech sample
 */
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await prisma.messageSample.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    console.error('[SpeechLibrary] DELETE error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/speech-library/match - Smart match for a customer
 */
router.post('/match', async (req, res) => {
  try {
    const { jid, query } = req.body;
    if (!jid) return res.status(400).json({ error: 'jid required' });
    const result = await smartMatchSamples(jid, query);
    if (result.error) return res.status(400).json({ error: result.error });
    res.json(result);
  } catch (err) {
    console.error('[SpeechLibrary] POST match error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/speech-library/auto-save - Auto-save a sales reply as a sample
 */
router.post('/auto-save', async (req, res) => {
  try {
    const result = await autoSaveSample(
      req.body.accountId,
      req.body.contactJid,
      req.body.customerMsg,
      req.body.salesReply,
      req.body,
    );
    if (!result) return res.status(500).json({ error: 'Failed to save sample' });
    res.json({ success: true, sample: result });
  } catch (err) {
    console.error('[SpeechLibrary] POST auto-save error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
