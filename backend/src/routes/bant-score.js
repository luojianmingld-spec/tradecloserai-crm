/**
 * BANT Score API — LLM-driven customer value scoring
 * Budget / Authority / Need / Timeline four-dimension evaluation
 */
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chatComplete, getAISettings } from '../services/ai.service.js';
import { getProviderById } from '../services/ai-client.js';

const router = Router();
const prisma = new PrismaClient();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_PATH = path.join(__dirname, '../../config/bant-config.json');

// ── Default Config ──────────────────────────────────────────────
const DEFAULT_CONFIG = {
  weights: { budget: 0.25, authority: 0.25, need: 0.25, timeline: 0.25 },
  thresholds: { high: 7, low: 4 },
  recentMessages: 30,
};

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_CONFIG, ...parsed, weights: { ...DEFAULT_CONFIG.weights, ...(parsed.weights || {}) }, thresholds: { ...DEFAULT_CONFIG.thresholds, ...(parsed.thresholds || {}) } };
    }
  } catch (e) {
    console.warn('[BANT] config load error:', e.message);
  }
  return { ...DEFAULT_CONFIG };
}

function saveConfig(cfg) {
  try {
    const dir = path.dirname(CONFIG_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf-8');
  } catch (e) {
    console.error('[BANT] config save error:', e.message);
  }
}

// ── Helpers ─────────────────────────────────────────────────────
function decodeJid(raw) {
  if (!raw) return null;
  let jid = decodeURIComponent(raw);
  if (!jid.includes('@')) jid += '@s.whatsapp.net';
  return jid;
}

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

async function findCustomerByJid(userId, jid) {
  const variants = normalizeJid(jid);
  if (!variants.length) return null;
  return prisma.customer.findFirst({
    where: { userId, jid: { in: variants } },
  });
}

async function findContactByJid(jid) {
  const variants = normalizeJid(jid);
  if (!variants.length) return null;
  return prisma.contact.findFirst({
    where: {
      jid: { in: variants },
    },
    orderBy: { id: 'desc' },
  });
}

/** Resolve AI provider for BANT scoring */
async function resolveBANTProvider() {
  const gptProvider = await getProviderById('p1786604068598');
  return {
    provider: gptProvider || null,
    modelId: gptProvider ? gptProvider.model : 'gpt-4o-mini'
  };
}

/** Safe JSON parse from LLM output */
function safeParseLLMJson(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch) {
    try { return JSON.parse(fenceMatch[1].trim()); } catch {}
  }
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try { return JSON.parse(jsonMatch[0]); } catch {}
  }
  return null;
}

// ── Core: autoBantScore ─────────────────────────────────────────
/**
 * Auto BANT scoring - called after background check completes or manually
 * @param {string} jid - customer JID
 * @param {object} io - Socket.io instance
 * @returns {object} scoring result
 */
export async function autoBantScore(jid, io = null) {
  try {
    if (!jid) return { skipped: true, reason: 'no jid' };
    const userId = 1;
    const cust = await findCustomerByJid(userId, jid);
    if (!cust) return { skipped: true, reason: 'customer not found' };

    const contact = await findContactByJid(jid);
    if (!contact) return { skipped: true, reason: 'contact not found' };

    // Load config
    const config = loadConfig();

    // 1. Fetch recent messages
    const messages = await prisma.message.findMany({
      where: { contactId: contact.id },
      orderBy: { timestamp: 'desc' },
      take: config.recentMessages || 30,
    });

    if (!messages || messages.length === 0) {
      return { skipped: true, reason: 'no messages to evaluate' };
    }

    // 2. Fetch background check result
    let bgInfo = '';
    try {
      const bgCheck = await prisma.customerBackgroundCheck.findUnique({
        where: { contactId: contact.id },
      });
      if (bgCheck) {
        bgInfo = [
          bgCheck.companyName ? `公司名称: ${bgCheck.companyName}` : '',
          bgCheck.country ? `国家: ${bgCheck.country}` : '',
          bgCheck.industry ? `行业: ${bgCheck.industry}` : '',
          bgCheck.companySize ? `规模: ${bgCheck.companySize}` : '',
          bgCheck.riskLevel ? `风险等级: ${bgCheck.riskLevel}` : '',
          bgCheck.notes ? `摘要: ${bgCheck.notes}` : '',
        ].filter(Boolean).join('\n');
      }
    } catch (e) {
      console.warn('[BANT] bg check fetch error:', e.message);
    }

    // 3. Build conversation transcript
    const sortedMsgs = messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    const transcript = sortedMsgs.map(m => {
      const direction = m.fromMe ? '业务员' : '客户';
      const time = new Date(m.timestamp).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
      return `[${time}] ${direction}: ${m.content || ''}`;
    }).join('\n');

    // 4. Build customer info
    const customerInfo = [
      cust.companyName ? `公司名: ${cust.companyName}` : '',
      cust.contactName ? `联系人: ${cust.contactName}` : '',
      cust.title ? `职位: ${cust.title}` : '',
      cust.country ? `国家: ${cust.country}` : '',
      cust.email ? `邮箱: ${cust.email}` : '',
      cust.phone ? `电话: ${cust.phone}` : '',
    ].filter(Boolean).join('\n');

    // 5. Call LLM for BANT scoring
    const { modelId, provider } = await resolveBANTProvider();

    const systemPrompt = `You are an expert B2B sales analyst specializing in BANT (Budget, Authority, Need, Timeline) qualification scoring. You analyze customer conversations and background information to score customers on four dimensions.

Scoring criteria:
- Budget (0-10): Does the customer have clear budget? 0=no mention, 5=vague interest, 10=confirmed budget matches product
- Authority (0-10): Is the contact a decision maker? 0=unknown role, 5=influencer, 10=final decision maker
- Need (0-10): Does customer need match our product? 0=no relevance, 5=general interest, 10=perfect fit with specific requirements
- Timeline (0-10): How urgent is the purchase? 0=no timeline, 5=someday, 10=immediate/imminent

You MUST respond with valid JSON only, no markdown.`;

    const userPrompt = `Please analyze the following customer interaction and provide BANT scores.

## Customer Info
${customerInfo || 'No structured info available'}

## Background Check Results
${bgInfo || 'No background check available'}

## Recent Conversation (${sortedMsgs.length} messages)
${transcript}

## Scoring Instructions
Analyze the conversation content and background information. For each dimension, provide:
1. A score from 0 to 10
2. A brief evidence/reasoning (1-2 sentences)

Respond with this exact JSON structure:
{
  "budgetScore": <0-10>,
  "budgetReason": "<evidence>",
  "authorityScore": <0-10>,
  "authorityReason": "<evidence>",
  "needScore": <0-10>,
  "needReason": "<evidence>",
  "timelineScore": <0-10>,
  "timelineReason": "<evidence>",
  "overallSummary": "<1-2 sentence overall assessment>"
}`;

    let aiResult = null;
    try {
      const raw = await chatComplete(modelId, systemPrompt, userPrompt, {
        temperature: 0.3,
        maxTokens: 1000,
        provider,
        timeout: 60000,
      });
      aiResult = safeParseLLMJson(raw);
    } catch (e) {
      console.error('[BANT] LLM call error:', e.message);
      return { skipped: true, reason: 'LLM call failed: ' + e.message };
    }

    if (!aiResult) {
      return { skipped: true, reason: 'LLM returned unparseable result' };
    }

    // 6. Calculate scores
    const budgetScore = Math.min(10, Math.max(0, parseFloat(aiResult.budgetScore) || 0));
    const authorityScore = Math.min(10, Math.max(0, parseFloat(aiResult.authorityScore) || 0));
    const needScore = Math.min(10, Math.max(0, parseFloat(aiResult.needScore) || 0));
    const timelineScore = Math.min(10, Math.max(0, parseFloat(aiResult.timelineScore) || 0));

    // Weighted total
    const w = config.weights;
    const totalScore = parseFloat((
      budgetScore * w.budget +
      authorityScore * w.authority +
      needScore * w.need +
      timelineScore * w.timeline
    ).toFixed(1));

    // Level determination
    const highThreshold = config.thresholds.high || 7;
    const lowThreshold = config.thresholds.low || 4;
    let level = 'MEDIUM';
    if (totalScore >= highThreshold) level = 'HIGH';
    else if (totalScore < lowThreshold) level = 'LOW';

    // 7. Build evaluation details
    const evaluationDetails = JSON.stringify({
      budget: { score: budgetScore, reason: aiResult.budgetReason || '' },
      authority: { score: authorityScore, reason: aiResult.authorityReason || '' },
      need: { score: needScore, reason: aiResult.needReason || '' },
      timeline: { score: timelineScore, reason: aiResult.timelineReason || '' },
      summary: aiResult.overallSummary || '',
      evaluatedAt: new Date().toISOString(),
      messageCount: sortedMsgs.length,
    });

    // 8. Upsert to CustomerBantScore
    const existing = await prisma.customerBantScore.findFirst({
      where: { contactId: contact.id },
    });
    if (existing) {
      await prisma.customerBantScore.update({
        where: { id: existing.id },
        data: {
          budgetScore,
          authorityScore,
          needScore,
          timelineScore,
          totalScore,
          level,
          evaluationDetails,
          evaluatedAt: new Date(),
        },
      });
    } else {
      await prisma.customerBantScore.create({
        data: {
          contactId: contact.id,
          budgetScore,
          authorityScore,
          needScore,
          timelineScore,
          totalScore,
          level,
          evaluationDetails,
        },
      });
    }

    // 9. WebSocket broadcast
    if (io) {
      io.emit('customer:bantscore:done', { jid, level, totalScore });
    }

    console.log(`[BANT] scored jid=${jid} level=${level} total=${totalScore}`);
    return { skipped: false, jid, level, totalScore, budgetScore, authorityScore, needScore, timelineScore };
  } catch (err) {
    console.error('[BANT] autoBantScore error:', err.message);
    return { skipped: true, reason: err.message };
  }
}

// ── API Routes ──────────────────────────────────────────────────

/**
 * POST /api/customers/by-jid/:jid/bant-score — Manual trigger re-evaluation
 */
router.post('/by-jid/:jid/bant-score', async (req, res) => {
  try {
    const jid = decodeJid(req.params.jid);
    if (!jid) return res.status(400).json({ error: 'jid required' });

    // Get io instance from app locals
    const io = req.app.get('io');
    const result = await autoBantScore(jid, io);

    if (result.skipped) {
      return res.status(200).json({ success: false, ...result });
    }

    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[BANT] POST score error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/customers/by-jid/:jid/bant-score — Get latest BANT score
 */
router.get('/by-jid/:jid/bant-score', async (req, res) => {
  try {
    const jid = decodeJid(req.params.jid);
    if (!jid) return res.status(400).json({ error: 'jid required' });

    const userId = req.userId;
    const contact = await findContactByJid(jid);
    if (!contact) return res.status(404).json({ error: 'contact not found' });

    const score = await prisma.customerBantScore.findFirst({
      where: { contactId: contact.id },
      orderBy: { evaluatedAt: 'desc' },
    });

    if (!score) {
      return res.json({ exists: false, message: 'No BANT score yet' });
    }

    // Parse evaluationDetails
    let details = null;
    try {
      details = score.evaluationDetails ? JSON.parse(score.evaluationDetails) : null;
    } catch {}

    res.json({
      exists: true,
      contactId: score.contactId,
      budgetScore: score.budgetScore,
      authorityScore: score.authorityScore,
      needScore: score.needScore,
      timelineScore: score.timelineScore,
      totalScore: score.totalScore,
      level: score.level,
      evaluationDetails: details,
      evaluatedAt: score.evaluatedAt,
    });
  } catch (err) {
    console.error('[BANT] GET score error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/customers/by-jid/:jid/bant-score/config — Update BANT config
 */
router.post('/by-jid/:jid/bant-score/config', async (req, res) => {
  try {
    const { weights, thresholds } = req.body;
    const config = loadConfig();

    if (weights) {
      config.weights = { ...config.weights, ...weights };
      // Normalize weights to sum to 1
      const sum = Object.values(config.weights).reduce((a, b) => a + b, 0);
      if (sum > 0) {
        for (const key of Object.keys(config.weights)) {
          config.weights[key] = parseFloat((config.weights[key] / sum).toFixed(4));
        }
      }
    }

    if (thresholds) {
      config.thresholds = { ...config.thresholds, ...thresholds };
      // Validate thresholds
      if (config.thresholds.high <= config.thresholds.low) {
        return res.status(400).json({ error: 'high threshold must be greater than low threshold' });
      }
    }

    saveConfig(config);
    res.json({ success: true, config });
  } catch (err) {
    console.error('[BANT] POST config error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/customers/by-jid/:jid/bant-score/config — Get BANT config
 */
router.get('/by-jid/:jid/bant-score/config', async (req, res) => {
  try {
    const config = loadConfig();
    res.json(config);
  } catch (err) {
    console.error('[BANT] GET config error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
