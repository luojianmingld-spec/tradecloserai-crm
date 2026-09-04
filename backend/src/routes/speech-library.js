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
  const gptProvider = await getProviderById('p1786604068598');
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

    // Detect conversation language from recent messages
    const recentMsgs = await prisma.message.findMany({
      where: { contactId: contact.id },
      orderBy: { timestamp: 'desc' },
      take: 10,
    });
    const recentTexts = recentMsgs.map(m => m.content || '').filter(Boolean).join(' ');
    let convLang = 'en'; // Default to English
    if (recentTexts) {
      try {
        const { detectLanguage } = await import('../services/ai.service.js');
        convLang = await detectLanguage(recentTexts.slice(0, 500), 'deepl');
        if (!convLang || convLang === 'unknown') convLang = 'en';
      } catch (e) {
        console.warn('[SpeechLibrary] Language detection failed, defaulting to en');
      }
    }
    console.log(`[SpeechLibrary] Detected conversation language: ${convLang}`);

    // Prioritize samples matching conversation language
    const langMatchedSamples = allSamples.filter(s => 
      s.salesReplyLang === convLang || s.customerMsgLang === convLang
    );
    const otherSamples = allSamples.filter(s => 
      s.salesReplyLang !== convLang && s.customerMsgLang !== convLang
    );
    // Use language-matched samples first, then others
    const prioritizedSamples = [...langMatchedSamples, ...otherSamples];
    console.log(`[SpeechLibrary] ${langMatchedSamples.length} samples match ${convLang}, ${otherSamples.length} others`);

    // Use LLM for semantic matching
    const { modelId, provider } = await resolveProvider();

    const systemPrompt = `You are an expert at matching sales conversation samples. Given a customer's current message and context, find the most relevant historical sales replies from a library.

You must respond with valid JSON only, no markdown, no explanation.`;

    const samplesText = prioritizedSamples.map((s, i) => {
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
        matchedIndices = result.matchedIndices.filter(i => i >= 0 && i < prioritizedSamples.length).slice(0, 5);
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

    const matchedSamples = matchedIndices.map(i => prioritizedSamples[i]).filter(Boolean);

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
    const { accountId = 1, scene, productLine, favorited, search, lang, page = 1, pageSize = 50 } = req.query;
    const where = { accountId: parseInt(accountId) };

    if (lang) where.salesReplyLang = lang;
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

    let [samples, total] = await Promise.all([
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
    // 【Bug修复 2026-08-23】当前账号无语术样本时回退到账号1（主账号沉淀样本），保证话术库可用
    if (total === 0 && (parseInt(accountId) || 1) !== 1) {
      const fbWhere = { ...where, accountId: 1 };
      [samples, total] = await Promise.all([
        prisma.messageSample.findMany({
          where: fbWhere,
          orderBy: [
            { favorited: 'desc' },
            { qualityScore: 'desc' },
            { createdAt: 'desc' },
          ],
          skip: (parseInt(page) - 1) * parseInt(pageSize),
          take: parseInt(pageSize),
        }),
        prisma.messageSample.count({ where: fbWhere }),
      ]);
    }

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
    const { platform, jid, email, query, scene, industry, productLine, limit, accountId } = req.body;
    const result = await smartMatchAll({ platform, jid, email, query, scene, industry, productLine, limit, accountId });
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

// ── 多源统一匹配（话术库核心大脑：MessageSample + 社区经验 + 问答知识库）──

/**
 * 多通道上下文获取：解析当前会话最新客户消息
 * whatsapp: jid -> contact -> Message 表，空则 fallback WAMessage
 * telegram: jid -> contact(platform=telegram) -> Message 表
 * email:    email -> EmailMessage 最新 inbound 邮件
 */
async function resolveContext({ platform, jid, email }) {
  const ctx = { query: '', contact: null, hasContext: false };
  try {
    if (platform === 'whatsapp' && jid) {
      const variants = normalizeJid(jid);
      const contact = await prisma.contact.findFirst({
        where: { platform: 'whatsapp', jid: { in: variants } },
        orderBy: { id: 'desc' },
      });
      if (contact) {
        ctx.contact = contact;
        const latest = await prisma.message.findFirst({
          where: { contactId: contact.id, fromMe: false },
          orderBy: { timestamp: 'desc' },
        });
        if (latest?.content) {
          ctx.query = latest.content;
        } else {
          // fallback: WA 消息实际存 WAMessage 表
          const wa = await prisma.wAMessage.findFirst({
            where: { direction: 'inbound', from: { in: variants } },
            orderBy: { timestamp: 'desc' },
          });
          if (wa?.body) ctx.query = wa.body;
        }
      }
    } else if (platform === 'telegram' && jid) {
      const contact = await prisma.contact.findFirst({
        where: { platform: 'telegram', jid },
        orderBy: { id: 'desc' },
      });
      if (contact) {
        ctx.contact = contact;
        const latest = await prisma.message.findFirst({
          where: { platform: 'telegram', contactId: contact.id, fromMe: false },
          orderBy: { timestamp: 'desc' },
        });
        if (latest?.content) ctx.query = latest.content;
      }
    } else if (platform === 'email') {
      const latestEmail = await prisma.emailMessage.findFirst({
        where: { direction: 'inbound', ...(email ? { OR: [{ from: email }, { to: email }] } : {}) },
        orderBy: { createdAt: 'desc' },
      });
      if (latestEmail) {
        ctx.query = ((latestEmail.subject || '') + ' ' + (latestEmail.body || '')).slice(0, 500);
      }
    }
    ctx.hasContext = !!ctx.query;
    return ctx;
  } catch (e) {
    console.warn('[SpeechLibrary] resolveContext error:', e.message);
    return ctx;
  }
}

/**
 * 话术库关键词+场景匹配（MessageSample）
 */
async function matchMessageSamples(searchQuery, { scene, industry, productLine }, limit = 5, accountId = null) {
  try {
    // 【Bug修复 2026-08-23】按当前账号匹配话术库，空则回退账号1，不再硬编码 accountId=1
    const accId = parseInt(accountId) || 1;
    let all = await prisma.messageSample.findMany({
      where: { accountId: accId },
      orderBy: [{ favorited: 'desc' }, { qualityScore: 'desc' }, { createdAt: 'desc' }],
      take: 200,
    });
    if (!all.length && accId !== 1) {
      all = await prisma.messageSample.findMany({
        where: { accountId: 1 },
        orderBy: [{ favorited: 'desc' }, { qualityScore: 'desc' }, { createdAt: 'desc' }],
        take: 200,
      });
    }
    if (all.length === 0) return [];
    const kw = (searchQuery || '').toLowerCase();
    const kwWords = kw.split(/\s+/).filter((w) => w.length > 1);
    const scored = all.map((s) => {
      let score = 0;
      if (scene && s.scene && s.scene.toLowerCase().includes(String(scene).toLowerCase())) score += 8;
      if (industry && s.industry && s.industry.toLowerCase().includes(String(industry).toLowerCase())) score += 6;
      if (productLine && s.productLine && s.productLine.toLowerCase().includes(String(productLine).toLowerCase())) score += 6;
      const hay = [s.customerMsg, s.salesReply, s.scene, s.industry, s.productLine, s.application, s.customerMsgTranslated, s.salesReplyTranslated].join(' ').toLowerCase();
      for (const w of kwWords) {
        if (hay.includes(w)) score += 3;
      }
      if (s.favorited) score += 5;
      if (s.qualityScore) score += s.qualityScore * 0.5;
      return { s, score };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored
      .filter((x) => x.score > 0)
      .slice(0, limit)
      .map((x) => ({
        source: 'message_sample',
        sourceLabel: '话术库',
        id: x.s.id,
        customerMsg: x.s.customerMsg,
        salesReply: x.s.salesReply,
        scene: x.s.scene,
        industry: x.s.industry,
        productLine: x.s.productLine,
        application: x.s.application,
        favorited: x.s.favorited,
        qualityScore: x.s.qualityScore,
      }));
  } catch (e) {
    console.warn('[SpeechLibrary] matchMessageSamples error:', e.message);
    return [];
  }
}

/**
 * 知识源召回：社区经验 + 问答知识库（按场景/行业/产品/关键词过滤）
 */
/**
 * 关键词分词：英文按单词拆分，中文按 2-gram 切分，用于知识源召回
 */
function splitKeywords(text) {
  const t = String(text || '').toLowerCase();
  const words = new Set();
  (t.match(/[a-z0-9]+(?:[-'][a-z0-9]+)*/g) || []).forEach((w) => {
    if (w.length > 1) words.add(w);
  });
  (t.match(/[\u4e00-\u9fa5]+/g) || []).forEach((seg) => {
    if (seg.length > 1) words.add(seg);
    for (let i = 0; i + 1 < seg.length; i++) {
      const g = seg.slice(i, i + 2);
      if (g.length === 2) words.add(g);
    }
  });
  return [...words];
}

async function recallKnowledgeSources({ scene, industry, productLine, keyword, limit = 5 }) {
  const results = [];
  try {
    const common = { accountId: 1, status: 'published', isActive: true };
    const kwWords = keyword && String(keyword).trim() ? splitKeywords(keyword) : [];
    const hasCondition = scene || industry || productLine || kwWords.length > 0;

    // 社区经验
    const communities = await prisma.communityExperience
      .findMany({ where: common, orderBy: [{ createdAt: 'desc' }], take: 500 })
      .catch((e) => {
        console.warn('[SpeechLibrary] community recall failed:', e.message);
        return [];
      });
    let commScored = communities.map((c) => {
      let score = 0;
      if (scene && c.scene && String(c.scene).toLowerCase().includes(String(scene).toLowerCase())) score += 8;
      if (industry && c.industry && String(c.industry).toLowerCase().includes(String(industry).toLowerCase())) score += 6;
      if (productLine && c.productLine && String(c.productLine).toLowerCase().includes(String(productLine).toLowerCase())) score += 6;
      const hay = [c.title, c.content, c.tags, c.scene, c.industry, c.productLine].join(' ').toLowerCase();
      for (const w of kwWords) if (hay.includes(w)) score += 3;
      return { c, score };
    });
    if (!hasCondition) {
      commScored = communities.slice(0, limit).map((c) => ({ c, score: 1 }));
    } else {
      commScored = commScored.filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, limit);
    }
    for (const { c } of commScored) {
      results.push({
        source: 'community',
        sourceLabel: '社区经验',
        id: c.id,
        title: c.title,
        content: c.content,
        scene: c.scene,
        industry: c.industry,
        productLine: c.productLine,
        tags: c.tags,
      });
    }

    // 问答知识库
    const qas = await prisma.qAKnowledge
      .findMany({ where: common, orderBy: [{ createdAt: 'desc' }], take: 500 })
      .catch((e) => {
        console.warn('[SpeechLibrary] qa recall failed:', e.message);
        return [];
      });
    let qaScored = qas.map((q) => {
      let score = 0;
      if (scene && q.scene && String(q.scene).toLowerCase().includes(String(scene).toLowerCase())) score += 8;
      if (industry && q.industry && String(q.industry).toLowerCase().includes(String(industry).toLowerCase())) score += 6;
      if (productLine && q.productLine && String(q.productLine).toLowerCase().includes(String(productLine).toLowerCase())) score += 6;
      const hay = [q.question, q.answer, q.tags, q.scene, q.industry, q.productLine].join(' ').toLowerCase();
      for (const w of kwWords) if (hay.includes(w)) score += 3;
      return { q, score };
    });
    if (!hasCondition) {
      qaScored = qas.slice(0, limit).map((q) => ({ q, score: 1 }));
    } else {
      qaScored = qaScored.filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, limit);
    }
    for (const { q } of qaScored) {
      results.push({
        source: 'qa',
        sourceLabel: '问答知识库',
        id: q.id,
        question: q.question,
        questionEn: q.questionEn,
        answer: q.answer,
        answerEn: q.answerEn,
        scene: q.scene,
        industry: q.industry,
        productLine: q.productLine,
        tags: q.tags,
      });
    }
    return results;
  } catch (e) {
    console.warn('[SpeechLibrary] recallKnowledgeSources error:', e.message);
    return results;
  }
}


/**
 * 统一多源匹配入口（Phase A）：按当前沟通通道上下文召回话术库 + 社区经验 + 问答知识库
 * @param {object} opts { platform, jid, email, query, scene, industry, productLine, limit }
 */
export async function smartMatchAll({ platform = 'whatsapp', jid, email, query, scene, industry, productLine, limit = 10, accountId } = {}) {
  try {
    const ctx = await resolveContext({ platform, jid, email });
    const searchQuery = query && query.trim() ? query.trim() : ctx.query;

    const [librarySamples, knowledgeSamples] = await Promise.all([
      matchMessageSamples(searchQuery, { scene, industry, productLine }, Math.min(limit, 10), accountId),
      recallKnowledgeSources({ scene, industry, productLine, keyword: searchQuery, limit: Math.min(limit, 10) }),
    ]);

    const communityCount = knowledgeSamples.filter((s) => s.source === 'community').length;
    const qaCount = knowledgeSamples.filter((s) => s.source === 'qa').length;

    return {
      success: true,
      query: searchQuery || '',
      context: {
        platform,
        jid: jid || null,
        email: email || null,
        hasContext: !!searchQuery,
      },
      samples: [...librarySamples, ...knowledgeSamples],
      total: librarySamples.length + knowledgeSamples.length,
      sources: { messageSample: librarySamples.length, community: communityCount, qa: qaCount },
    };
  } catch (err) {
    console.error('[SpeechLibrary] smartMatchAll error:', err.message);
    return { error: err.message };
  }
}

export default router;
