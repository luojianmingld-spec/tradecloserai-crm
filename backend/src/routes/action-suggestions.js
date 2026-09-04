/**
 * Phase 7: 行动建议 — Action Suggestions
 * Generates actionable suggestions based on customer attitude, BANT, and conversation stage.
 */
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { chatComplete } from '../services/ai.service.js';
import { getProviderById } from '../services/ai-client.js';
import { getAttitude } from './attitude-analysis.js';

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

// ── Core: generateActionSuggestions ──────────────────────────────
/**
 * Generate action suggestions based on customer data.
 * @param {string} jid - Customer JID
 * @returns {object} Action suggestions
 */
export async function generateActionSuggestions(jid) {
  try {
    if (!jid) return { error: 'jid required' };

    const variants = normalizeJid(jid);
    const customer = await prisma.customer.findFirst({ where: { userId: 1, jid: { in: variants } } });
    if (!customer) return { error: 'customer not found' };

    const contacts = await prisma.contact.findMany({
      where: { jid: { in: variants } },
    });
    if (!contacts || contacts.length === 0) return { error: 'contact not found' };
    const contact = contacts[0];
    const contactIds = contacts.map(c => c.id);

    // Get attitude analysis
    const attitudeData = await getAttitude(jid);
    if (attitudeData.error && !attitudeData.hasAnalysis) {
      return { error: 'No attitude analysis available. Please run attitude analysis first.' };
    }

    // Get BANT score
    const bant = await prisma.customerBantScore.findFirst({
      where: { contactId: { in: contactIds } },
      orderBy: { evaluatedAt: 'desc' },
    });

    // Get background check
    const bg = await prisma.customerBackgroundCheck.findFirst({
      where: { contactId: { in: contactIds } },
    });

    // Get recent messages from all matching contacts
    const messages = await prisma.message.findMany({
      where: { contactId: { in: contactIds } },
      orderBy: { timestamp: 'desc' },
      take: 20,
    });
    const sortedMsgs = messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    const transcript = sortedMsgs.map(m => {
      const dir = m.fromMe ? 'Sales' : 'Customer';
      return `[${dir}]: ${m.content || ''}`;
    }).join('\n');

    // Get existing suggestions
    const existingSuggestions = await prisma.actionSuggestion.findMany({
      where: { contactId: { in: contactIds }, status: { not: 'DISMISSED' } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    // LLM generation
    const { modelId, provider } = await resolveProvider();

    const systemPrompt = `You are an expert B2B sales advisor for international trade. You provide actionable, specific suggestions to sales representatives on what to do next with a customer.

Your suggestions should be:
1. Specific and actionable (not generic advice)
2. Prioritized by importance and urgency
3. Include concrete next steps
4. Reference specific conversation details

You must respond with valid JSON only, no markdown, no explanation.`;

    const att = attitudeData.hasAnalysis ? attitudeData : { intentLevel: 'MEDIUM', sentiment: 'NEUTRAL', urgency: 'NORMAL', focusPoints: [], trend: 'STABLE' };

    const userPrompt = `Based on the following customer information, generate 3-5 specific action suggestions for the sales representative.

## Customer Info
- Name: ${customer.contactName || customer.name || 'Unknown'}
- Company: ${customer.companyName || bg?.companyName || 'Unknown'}
- Country: ${customer.country || bg?.country || 'Unknown'}
- Industry: ${customer.industry || bg?.industry || 'Unknown'}
- Customer Level: ${customer.customerLevel || 'C'}
- Deal Stage: ${customer.dealStage || 'new'}

## Attitude Analysis
- Intent: ${att.intentLevel}
- Sentiment: ${att.sentiment}
- Urgency: ${att.urgency}
- Focus Points: ${(att.focusPoints || []).join(', ')}
- Trend: ${att.trend || 'STABLE'}
- Reasoning: ${att.reasoning || 'N/A'}

## BANT Score
${bant ? `Budget: ${bant.budgetScore}/10, Authority: ${bant.authorityScore}/10, Need: ${bant.needScore}/10, Timeline: ${bant.timelineScore}/10, Total: ${bant.totalScore}/10 (${bant.level})` : 'Not available'}

## Recent Conversation
${transcript || 'No recent messages'}

## Existing Active Suggestions
${existingSuggestions.length > 0 ? existingSuggestions.map(s => `- ${s.actionType}: ${s.suggestion}`).join('\n') : 'None'}

## Instructions
Generate 3-5 specific, prioritized action suggestions. Each should have:
1. **actionType**: One of:
   - FOLLOW_UP_NOW: Urgent follow-up needed
   - SEND_QUOTE: Ready to send quotation
   - GATHER_INFO: Need more information
   - SEND_MATERIAL: Send product/company materials
   - SCHEDULE_MEETING: Arrange a meeting/call
   - NURTURE: Long-term nurture, maintain contact
   - ESCALATE: Escalate to manager
   - CLOSE_DEAL: Push for closing
2. **priority**: HIGH / NORMAL / LOW
3. **suggestion**: Specific actionable text (in Chinese, for the sales rep)
4. **reason**: Why this action is recommended
5. **templateMessage**: Optional ready-to-send message template (in customer's language based on context)

Respond with this exact JSON:
{
  "suggestions": [
    {
      "actionType": "FOLLOW_UP_NOW",
      "priority": "HIGH",
      "suggestion": "具体建议内容（中文）",
      "reason": "原因说明",
      "templateMessage": "Optional template message to send"
    }
  ]
}`;

    let suggestions = [];
    try {
      const raw = await chatComplete(modelId, systemPrompt, userPrompt, {
        temperature: 0.5,
        maxTokens: 2000,
        provider,
        timeout: 60000,
      });
      const result = safeParseLLMJson(raw);
      if (result && Array.isArray(result.suggestions)) {
        suggestions = result.suggestions;
      }
    } catch (e) {
      console.error('[ActionSuggestions] LLM error:', e.message);
    }

    // If LLM fails, generate rule-based fallback
    if (suggestions.length === 0) {
      suggestions = generateFallbackSuggestions(att, bant, customer);
    }

    // Save suggestions to database
    const savedSuggestions = [];
    for (const s of suggestions) {
      const saved = await prisma.actionSuggestion.create({
        data: {
          contactId: contact.id,
          actionType: s.actionType || 'FOLLOW_UP_NOW',
          priority: s.priority || 'NORMAL',
          suggestion: s.suggestion || '',
          reason: s.reason || '',
          templateMessage: s.templateMessage || null,
          status: 'PENDING',
        },
      });
      savedSuggestions.push(saved);
    }

    return {
      success: true,
      contactId: contact.id,
      suggestions: savedSuggestions,
      generatedAt: new Date(),
    };
  } catch (err) {
    console.error('[ActionSuggestions] generate error:', err.message);
    return { error: err.message };
  }
}

/**
 * Rule-based fallback when LLM is unavailable.
 */
function generateFallbackSuggestions(attitude, bant, customer) {
  const suggestions = [];

  // Based on intent level
  if (attitude.intentLevel === 'HIGH' && attitude.urgency === 'URGENT') {
    suggestions.push({
      actionType: 'FOLLOW_UP_NOW',
      priority: 'HIGH',
      suggestion: '客户意向高且紧急，建议立即回复并准备报价',
      reason: '客户表现出强烈的购买意向和紧迫感，及时响应可提高成交率',
      templateMessage: '',
    });
  }

  if (attitude.intentLevel === 'HIGH' && !bant) {
    suggestions.push({
      actionType: 'GATHER_INFO',
      priority: 'NORMAL',
      suggestion: '客户意向较高但缺少BANT评分，建议通过对话了解预算和决策流程',
      reason: '高意向客户需要进一步了解需求细节以提供精准方案',
    });
  }

  if (attitude.sentiment === 'NEGATIVE') {
    suggestions.push({
      actionType: 'FOLLOW_UP_NOW',
      priority: 'HIGH',
      suggestion: '客户情绪负面，建议主动关心并解决问题',
      reason: '负面情绪需要及时疏导，避免客户流失',
    });
  }

  if (attitude.trend === 'DECLINING') {
    suggestions.push({
      actionType: 'NURTURE',
      priority: 'NORMAL',
      suggestion: '客户兴趣在下降，建议加强跟进频率，分享有价值的行业信息',
      reason: '趋势下滑需要及时干预，通过持续价值输出来重新吸引关注',
    });
  }

  // Always suggest materials if not enough
  if (suggestions.length < 3) {
    suggestions.push({
      actionType: 'SEND_MATERIAL',
      priority: 'NORMAL',
      suggestion: '发送产品资料和成功案例，增强客户信心',
      reason: '持续分享专业内容有助于建立信任和推进销售进程',
    });
  }

  if (suggestions.length < 3) {
    suggestions.push({
      actionType: 'SCHEDULE_MEETING',
      priority: 'NORMAL',
      suggestion: '建议安排一次视频会议，深入了解客户需求',
      reason: '面对面沟通能更高效地建立关系和解决疑虑',
    });
  }

  return suggestions.slice(0, 5);
}

// ── Core: getActiveSuggestions ───────────────────────────────────
export async function getActiveSuggestions(jid) {
  try {
    if (!jid) return { error: 'jid required' };
    const variants = normalizeJid(jid);
    const contact = await prisma.contact.findFirst({
      where: { jid: { in: variants } },
      orderBy: { id: 'desc' },
    });
    if (!contact) return { error: 'contact not found' };

    const suggestions = await prisma.actionSuggestion.findMany({
      where: { contactId: contact.id, status: 'PENDING' },
      orderBy: [
        { priority: 'asc' }, // HIGH first
        { createdAt: 'desc' },
      ],
      take: 10,
    });

    return { success: true, suggestions };
  } catch (err) {
    console.error('[ActionSuggestions] get error:', err.message);
    return { error: err.message };
  }
}

// ── API Routes ───────────────────────────────────────────────────

/**
 * GET /api/suggestions/by-jid/:jid - Get active suggestions for a customer
 */
router.get('/by-jid/:jid', async (req, res) => {
  try {
    const jid = decodeJid(req.params.jid);
    if (!jid) return res.status(400).json({ error: 'jid required' });
    const result = await getActiveSuggestions(jid);
    if (result.error) return res.status(404).json({ error: result.error });
    res.json(result);
  } catch (err) {
    console.error('[ActionSuggestions] GET error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/suggestions/by-jid/:jid/generate - Generate new suggestions
 */
router.post('/by-jid/:jid/generate', async (req, res) => {
  try {
    const jid = decodeJid(req.params.jid);
    if (!jid) return res.status(400).json({ error: 'jid required' });

    // Clear old pending suggestions before generating new ones
    const variants = normalizeJid(jid);
    const contact = await prisma.contact.findFirst({
      where: { jid: { in: variants } },
      orderBy: { id: 'desc' },
    });
    if (contact) {
      await prisma.actionSuggestion.updateMany({
        where: { contactId: contact.id, status: 'PENDING' },
        data: { status: 'EXPIRED' },
      });
    }

    const result = await generateActionSuggestions(jid);
    if (result.error) return res.status(400).json({ error: result.error });
    res.json(result);
  } catch (err) {
    console.error('[ActionSuggestions] POST generate error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/suggestions/:id/dismiss - Dismiss a suggestion
 */
router.post('/:id/dismiss', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await prisma.actionSuggestion.update({
      where: { id },
      data: { status: 'DISMISSED' },
    });
    res.json({ success: true });
  } catch (err) {
    console.error('[ActionSuggestions] dismiss error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/suggestions/:id/execute - Mark suggestion as executed
 */
router.post('/:id/execute', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await prisma.actionSuggestion.update({
      where: { id },
      data: { status: 'EXECUTED', executedAt: new Date() },
    });
    res.json({ success: true });
  } catch (err) {
    console.error('[ActionSuggestions] execute error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
