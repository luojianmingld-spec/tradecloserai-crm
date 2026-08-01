/**
 * Phase 6: 客户态度分析 — Customer Attitude Analysis
 * Analyzes customer sentiment, intent, urgency and focus points from conversation history.
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

// ── Core: analyzeAttitude ────────────────────────────────────────
/**
 * Analyze customer attitude from conversation history.
 * @param {string} jid - Customer JID
 * @returns {object} Attitude analysis result
 */
export async function analyzeAttitude(jid) {
  try {
    if (!jid) return { error: 'jid required' };

    const variants = normalizeJid(jid);
    const customer = await prisma.customer.findFirst({ where: { userId: 1, jid: { in: variants } } });
    if (!customer) return { error: 'customer not found' };

    const contacts = await prisma.contact.findMany({
      where: { jid: { in: variants } },
    });
    if (!contacts || contacts.length === 0) return { error: 'contact not found' };

    // Use the primary contact (first one) for attitude storage
    const contact = contacts[0];

    // Get recent messages from ALL matching contacts (handle duplicate contacts across platforms)
    const contactIds = contacts.map(c => c.id);
    const messages = await prisma.message.findMany({
      where: { contactId: { in: contactIds } },
      orderBy: { timestamp: 'desc' },
      take: 30,
    });

    // Also check WAMessage table for WhatsApp messages (stored separately from Telegram Message table)
    let waMessages = [];
    if (messages.length === 0 && variants.length > 0) {
      const waMsgs = await prisma.wAMessage.findMany({
        where: {
          OR: [
            { from: { in: variants } },
            { to: { in: variants } },
          ],
        },
        orderBy: { timestamp: 'desc' },
        take: 30,
      });
      waMessages = waMsgs;
      console.log('[Attitude] WAMessage fallback found:', waMessages.length, 'messages for variants:', variants);
    }

    // Normalize message format for transcript
    let sortedMsgs;
    if (messages.length > 0) {
      sortedMsgs = messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    } else if (waMessages.length > 0) {
      sortedMsgs = waMessages.sort((a, b) => new Date(a.timestamp || a.timestamp) - new Date(b.timestamp || b.timestamp));
    } else {
      console.log('[Attitude] No messages for contactId:', contact.id, 'variants:', variants);
      return { error: 'No conversation history to analyze' };
    }

    const transcript = sortedMsgs.map(m => {
      // Handle both Message (fromMe/content) and WAMessage (direction/body) formats
      if ('fromMe' in m && m.fromMe !== undefined) {
        const direction = m.fromMe ? 'Sales' : 'Customer';
        return `[${direction}]: ${m.content || ''}`;
      } else {
        // WAMessage format
        const direction = (m.direction === 'outbound' || m.direction === 'outgoing') ? 'Sales' : 'Customer';
        return `[${direction}]: ${m.body || ''}`;
      }
    }).join('\n');

    // Get previous attitude for trend comparison
    const prevAttitude = await prisma.customerAttitude.findFirst({
      where: { contactId: { in: contactIds } },
      orderBy: { createdAt: 'desc' },
    });

    // Get BANT for enriched context
    const bant = await prisma.customerBantScore.findFirst({
      where: { contactId: { in: contactIds } },
      orderBy: { evaluatedAt: 'desc' },
    });

    // Get background check
    const bg = await prisma.customerBackgroundCheck.findFirst({
      where: { contactId: { in: contactIds } },
    });

    // LLM attitude analysis
    const { modelId, provider } = await resolveProvider();

    const systemPrompt = `You are an expert B2B sales psychologist specializing in international trade communications. You analyze customer conversations to determine their attitude, intent, and emotional state.

You must respond with valid JSON only, no markdown, no explanation.`;

    const contextParts = [];
    if (bg) contextParts.push(`Company: ${bg.companyName || ''} (${bg.country || ''}, ${bg.industry || ''})`);
    if (bant) contextParts.push(`BANT: Budget=${bant.budgetScore}/10, Authority=${bant.authorityScore}/10, Need=${bant.needScore}/10, Timeline=${bant.timelineScore}/10, Level=${bant.level}`);
    if (prevAttitude) contextParts.push(`Previous analysis: intent=${prevAttitude.intentLevel}, sentiment=${prevAttitude.sentiment}, urgency=${prevAttitude.urgency}`);

    const userPrompt = `Analyze the following conversation between a sales representative and a potential B2B customer.

## Customer Context
${contextParts.join('\n') || 'No prior context available'}

## Conversation Transcript (oldest to newest)
${transcript}

## Instructions
Analyze the customer's attitude based on their messages. Consider:
1. **Intent Level**: How interested is the customer in purchasing?
   - HIGH: Actively asking about specs, pricing, quantities, delivery
   - MEDIUM: Showing interest but not yet specific, asking general questions
   - LOW: Vague interest, no specific questions, generic responses

2. **Sentiment**: What is the customer's emotional tone?
   - POSITIVE: Enthusiastic, appreciative, uses positive language
   - NEUTRAL: Professional, matter-of-fact, no strong emotional signals
   - NEGATIVE: Frustrated, impatient, complaining, using negative language

3. **Urgency**: How urgent is the customer's need?
   - URGENT: Asking for immediate quotes, mentioning deadlines, using "ASAP"/"urgent"/"immediately"
   - NORMAL: Standard business timeline, no pressure signals
   - PATIENT: Long-term inquiry, comparing options, no rush

4. **Focus Points**: What does the customer care most about? (pick top 1-3)
   Common focuses: price, quality, delivery_time, MOQ, customization, certification, samples, technical_specs, payment_terms, reliability

5. **Trend**: Compared to previous attitude, is the customer getting more or less interested?
   - IMPROVING: More engaged, asking more specific questions
   - STABLE: Similar level of engagement
   - DECLINING: Less responsive, shorter messages, losing interest

Respond with this exact JSON:
{
  "intentLevel": "HIGH|MEDIUM|LOW",
  "sentiment": "POSITIVE|NEUTRAL|NEGATIVE",
  "urgency": "URGENT|NORMAL|PATIENT",
  "focusPoints": ["focus1", "focus2"],
  "trend": "IMPROVING|STABLE|DECLINING",
  "confidenceScore": 0.85,
  "reasoning": "Brief explanation of the analysis"
}`;

    let analysisResult = null;
    try {
      const raw = await chatComplete(modelId, systemPrompt, userPrompt, {
        temperature: 0.3,
        maxTokens: 800,
        provider,
        timeout: 60000,
      });
      analysisResult = safeParseLLMJson(raw);
    } catch (e) {
      console.error('[Attitude] LLM analysis error:', e.message);
    }

    if (!analysisResult) {
      // Fallback heuristic
      const customerMsgs = sortedMsgs.filter(m => !m.fromMe);
      const totalLen = customerMsgs.reduce((sum, m) => sum + (m.content?.length || 0), 0);
      const avgLen = customerMsgs.length > 0 ? totalLen / customerMsgs.length : 0;
      analysisResult = {
        intentLevel: avgLen > 100 ? 'HIGH' : avgLen > 30 ? 'MEDIUM' : 'LOW',
        sentiment: 'NEUTRAL',
        urgency: 'NORMAL',
        focusPoints: [],
        trend: 'STABLE',
        confidenceScore: 0.5,
        reasoning: 'LLM analysis failed, using heuristic fallback',
      };
    }

    // Save to database (upsert pattern: create new record)
    const saved = await prisma.customerAttitude.upsert({
      where: { contactId: contact.id },
      update: {
        intentLevel: analysisResult.intentLevel || 'MEDIUM',
        sentiment: analysisResult.sentiment || 'NEUTRAL',
        urgency: analysisResult.urgency || 'NORMAL',
        focusPoints: JSON.stringify(analysisResult.focusPoints || []),
        trend: analysisResult.trend || (prevAttitude ? 'STABLE' : null),
        confidenceScore: analysisResult.confidenceScore || 0.5,
        analyzedMessages: sortedMsgs.length,
        reasoning: analysisResult.reasoning || null,
        lastAnalyzedAt: new Date(),
      },
      create: {
        contactId: contact.id,
        intentLevel: analysisResult.intentLevel || 'MEDIUM',
        sentiment: analysisResult.sentiment || 'NEUTRAL',
        urgency: analysisResult.urgency || 'NORMAL',
        focusPoints: JSON.stringify(analysisResult.focusPoints || []),
        trend: analysisResult.trend || null,
        confidenceScore: analysisResult.confidenceScore || 0.5,
        analyzedMessages: sortedMsgs.length,
        reasoning: analysisResult.reasoning || null,
        lastAnalyzedAt: new Date(),
      },
    });

    return {
      success: true,
      contactId: contact.id,
      intentLevel: saved.intentLevel,
      sentiment: saved.sentiment,
      urgency: saved.urgency,
      focusPoints: JSON.parse(saved.focusPoints || '[]'),
      trend: saved.trend,
      confidenceScore: saved.confidenceScore,
      analyzedMessages: saved.analyzedMessages,
      reasoning: saved.reasoning,
      lastAnalyzedAt: saved.lastAnalyzedAt,
    };
  } catch (err) {
    console.error('[Attitude] analyzeAttitude error:', err.message);
    return { error: err.message };
  }
}

/**
 * Get the latest attitude analysis for a customer.
 */
export async function getAttitude(jid) {
  try {
    if (!jid) return { error: 'jid required' };
    const variants = normalizeJid(jid);
    const contacts = await prisma.contact.findMany({
      where: { jid: { in: variants } },
    });
    if (!contacts || contacts.length === 0) return { error: 'contact not found' };
    const contactIds = contacts.map(c => c.id);

    const attitude = await prisma.customerAttitude.findFirst({
      where: { contactId: { in: contactIds } },
      orderBy: { createdAt: 'desc' },
    });

    if (!attitude) return { error: 'No attitude analysis found', hasAnalysis: false };

    return {
      success: true,
      hasAnalysis: true,
      intentLevel: attitude.intentLevel,
      sentiment: attitude.sentiment,
      urgency: attitude.urgency,
      focusPoints: JSON.parse(attitude.focusPoints || '[]'),
      trend: attitude.trend,
      confidenceScore: attitude.confidenceScore,
      analyzedMessages: attitude.analyzedMessages,
      reasoning: attitude.reasoning,
      lastAnalyzedAt: attitude.lastAnalyzedAt,
      createdAt: attitude.createdAt,
      updatedAt: attitude.updatedAt,
    };
  } catch (err) {
    console.error('[Attitude] getAttitude error:', err.message);
    return { error: err.message };
  }
}

// ── API Routes ───────────────────────────────────────────────────

/**
 * GET /api/attitude/by-jid/:jid - Get customer attitude analysis
 */
router.get('/by-jid/:jid', async (req, res) => {
  try {
    const jid = decodeJid(req.params.jid);
    if (!jid) return res.status(400).json({ error: 'jid required' });
    const result = await getAttitude(jid);
    if (result.error) return res.status(404).json({ error: result.error });
    res.json(result);
  } catch (err) {
    console.error('[Attitude] GET error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/attitude/by-jid/:jid/analyze - Trigger attitude analysis
 */
router.post('/by-jid/:jid/analyze', async (req, res) => {
  try {
    const jid = decodeJid(req.params.jid);
    if (!jid) return res.status(400).json({ error: 'jid required' });
    const result = await analyzeAttitude(jid);
    if (result.error) return res.status(400).json({ error: result.error });
    res.json(result);
  } catch (err) {
    console.error('[Attitude] POST analyze error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/attitude/by-jid/:jid/trend - Get attitude trend (history)
 */
router.get('/by-jid/:jid/trend', async (req, res) => {
  try {
    const jid = decodeJid(req.params.jid);
    if (!jid) return res.status(400).json({ error: 'jid required' });
    const variants = normalizeJid(jid);
    const contact = await prisma.contact.findFirst({
      where: { jid: { in: variants } },
      orderBy: { id: 'desc' },
    });
    if (!contact) return res.status(404).json({ error: 'contact not found' });

    // Since we use upsert (single record), return the current state
    const attitude = await prisma.customerAttitude.findFirst({
      where: { contactId: contact.id },
    });

    if (!attitude) return res.json({ success: true, trend: [], current: null });

    res.json({
      success: true,
      current: {
        intentLevel: attitude.intentLevel,
        sentiment: attitude.sentiment,
        urgency: attitude.urgency,
        focusPoints: JSON.parse(attitude.focusPoints || '[]'),
        trend: attitude.trend,
        confidenceScore: attitude.confidenceScore,
      },
      trend: [
        { date: attitude.createdAt, intentLevel: attitude.intentLevel, sentiment: attitude.sentiment, trend: attitude.trend },
        { date: attitude.updatedAt, intentLevel: attitude.intentLevel, sentiment: attitude.sentiment, trend: attitude.trend },
      ],
    });
  } catch (err) {
    console.error('[Attitude] GET trend error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
