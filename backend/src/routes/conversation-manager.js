/**
 * Conversation Manager — Phase 4: Multi-round dialogue management
 * Determines conversation strategy (ASK_FOR_INFO vs PROVIDE_QUOTE)
 * based on information completeness from product knowledge base questions.
 */
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { chatComplete } from '../services/ai.service.js';
import { getProviderById } from '../services/ai-client.js';

const router = Router();
const prisma = new PrismaClient();

// ── Constants ──────────────────────────────────────────────────────
const MAX_FOLLOWUP_ROUNDS = 3;
const COMPLETENESS_THRESHOLD = 0.8;
const RECENT_MESSAGES_LIMIT = 50;

// ── Helpers ────────────────────────────────────────────────────────
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

async function findCustomerByJid(jid) {
  const variants = normalizeJid(jid);
  if (!variants.length) return null;
  return prisma.customer.findFirst({
    where: { userId: 1, jid: { in: variants } },
  });
}

async function findContactByJid(jid) {
  const variants = normalizeJid(jid);
  if (!variants.length) return null;
  return prisma.contact.findFirst({
    where: { jid: { in: variants } },
    orderBy: { id: 'desc' },
  });
}

/** Resolve AI provider for LLM calls */
async function resolveProvider() {
  const gptProvider = await getProviderById('p1784629520517');
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

// ── In-memory store for follow-up round tracking ───────────────────
// In production, this should be persisted to DB. For now, use a Map.
const conversationState = new Map();

function getConversationState(jid) {
  if (!conversationState.has(jid)) {
    conversationState.set(jid, {
      askedRounds: 0,
      lastAskedQuestions: [],
      lastUpdated: new Date(),
    });
  }
  return conversationState.get(jid);
}

function incrementFollowUpRounds(jid) {
  const state = getConversationState(jid);
  state.askedRounds += 1;
  state.lastUpdated = new Date();
  return state.askedRounds;
}

function resetConversationState(jid) {
  conversationState.set(jid, {
    askedRounds: 0,
    lastAskedQuestions: [],
    lastUpdated: new Date(),
  });
}

// ── Core: getConversationStatus ────────────────────────────────────
/**
 * Get the current conversation status for a customer.
 * @param {string} jid - Customer JID
 * @returns {object} Conversation status object
 */
export async function getConversationStatus(jid) {
  try {
    if (!jid) return { error: 'jid required' };

    const cust = await findCustomerByJid(jid);
    if (!cust) return { error: 'customer not found' };

    const contact = await findContactByJid(jid);
    if (!contact) return { error: 'contact not found' };

    // 1. Get the product associated with this customer (first active product for now)
    const product = await prisma.productKnowledgeBase.findFirst({
      where: { accountId: 1, isActive: true },
      include: {
        questions: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!product) {
      return {
        error: 'No active product found',
        productId: null,
        productName: null,
        completeness: 0,
        requiredQuestions: [],
        followUpQuestions: [],
        askedRounds: 0,
        maxRounds: MAX_FOLLOWUP_ROUNDS,
        strategy: 'ASK_FOR_INFO',
        stage: '首次询盘',
      };
    }

    // 2. Get recent messages
    const messages = await prisma.message.findMany({
      where: { contactId: contact.id },
      orderBy: { timestamp: 'desc' },
      take: RECENT_MESSAGES_LIMIT,
    });

    const sortedMsgs = messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    const transcript = sortedMsgs.map(m => {
      const direction = m.fromMe ? 'Sales' : 'Customer';
      return `[${direction}]: ${m.content || ''}`;
    }).join('\n');

    // 3. Separate required (priority=1) and follow-up (priority=2) questions
    const requiredQuestions = product.questions.filter(q => q.priority === 1);
    const followUpQuestions = product.questions.filter(q => q.priority === 2);

    // 4. Use LLM to determine which required questions have been answered
    const { modelId, provider } = await resolveProvider();

    let answeredQuestions = [];
    try {
      const systemPrompt = `You are an expert at analyzing sales conversations. Your task is to determine which questions from a product knowledge base have already been answered in the conversation between a salesperson and a customer.

You must respond with valid JSON only, no markdown, no explanation.`;

      const questionsList = requiredQuestions.map(q => ({
        id: q.id,
        questionCn: q.questionCn,
        questionEn: q.questionEn,
      }));

      const userPrompt = `Analyze the following conversation and determine which questions have been answered.

## Product: ${product.productNameCn} (${product.productNameEn})

## Questions to check (required, priority=1):
${JSON.stringify(questionsList, null, 2)}

## Conversation transcript:
${transcript || '(No conversation yet)'}

## Instructions:
For each question, determine if the customer has already provided an answer in the conversation. Consider both explicit and implicit answers. A question is "answered" if the customer mentioned the relevant information, even if not in a direct Q&A format.

Respond with this exact JSON structure:
{
  "answeredQuestions": [
    {"id": <question_id>, "answer": "<brief summary of the answer found in conversation>"}
  ]
}`;

      const raw = await chatComplete(modelId, systemPrompt, userPrompt, {
        temperature: 0.2,
        maxTokens: 1500,
        provider,
        timeout: 60000,
      });

      const result = safeParseLLMJson(raw);
      if (result && Array.isArray(result.answeredQuestions)) {
        answeredQuestions = result.answeredQuestions;
      }
    } catch (e) {
      console.error('[ConvMgr] LLM question matching error:', e.message);
    }

    // 5. Build the required questions list with answered status
    const answeredIds = new Set(answeredQuestions.map(a => a.id));
    const requiredQuestionsWithStatus = requiredQuestions.map(q => ({
      id: q.id,
      questionCn: q.questionCn,
      questionEn: q.questionEn,
      questionType: q.questionType,
      optionsJson: q.optionsJson,
      answered: answeredIds.has(q.id),
      answer: answeredQuestions.find(a => a.id === q.id)?.answer || null,
    }));

    const followUpQuestionsWithStatus = followUpQuestions.map(q => ({
      id: q.id,
      questionCn: q.questionCn,
      questionEn: q.questionEn,
      questionType: q.questionType,
      optionsJson: q.optionsJson,
      answered: answeredIds.has(q.id),
      answer: answeredQuestions.find(a => a.id === q.id)?.answer || null,
    }));

    // 6. Calculate completeness
    const totalRequired = requiredQuestions.length;
    const answeredCount = requiredQuestions.filter(q => answeredIds.has(q.id)).length;
    const completeness = totalRequired > 0 ? parseFloat((answeredCount / totalRequired).toFixed(2)) : 0;

    // 7. Determine strategy
    const state = getConversationState(jid);
    let strategy;
    if (completeness >= COMPLETENESS_THRESHOLD) {
      strategy = 'PROVIDE_QUOTE';
    } else if (state.askedRounds >= MAX_FOLLOWUP_ROUNDS) {
      strategy = 'PROVIDE_QUOTE'; // Follow-up limit reached, give quote anyway
    } else {
      strategy = 'ASK_FOR_INFO';
    }

    // 8. Determine customer stage using LLM (lightweight)
    let stage = '首次询盘';
    try {
      const recentTranscript = sortedMsgs.slice(-20).map(m => {
        const direction = m.fromMe ? 'Sales' : 'Customer';
        return `[${direction}]: ${m.content || ''}`;
      }).join('\n');

      const stageSystemPrompt = `You are a sales conversation analyst. Determine the current stage of the customer in the sales process.

You must respond with valid JSON only.`;

      const stageUserPrompt = `Based on the conversation and context below, determine the customer's current stage.

## Recent conversation:
${recentTranscript || '(No conversation yet)'}

## Context:
- Information completeness: ${Math.round(completeness * 100)}%
- Strategy: ${strategy}

## Possible stages:
- "首次询盘" (First inquiry) - Customer just reached out, basic interest
- "需求明确" (Needs clarified) - Customer's specific requirements are clear
- "报价阶段" (Quotation stage) - Ready for or discussing pricing
- "谈判阶段" (Negotiation stage) - Discussing terms, conditions, negotiations
- "已成交" (Closed/Won) - Deal completed

Respond with:
{"stage": "<one of the 5 stages above>", "reason": "<brief reason>"}
`;

      const stageRaw = await chatComplete(modelId, stageSystemPrompt, stageUserPrompt, {
        temperature: 0.2,
        maxTokens: 300,
        provider,
        timeout: 30000,
      });

      const stageResult = safeParseLLMJson(stageRaw);
      if (stageResult && stageResult.stage) {
        stage = stageResult.stage;
      }
    } catch (e) {
      console.error('[ConvMgr] LLM stage detection error:', e.message);
    }

    // 9. Get background check and BANT score
    let backgroundCheck = null;
    let bantScore = null;

    try {
      const bgCheck = await prisma.customerBackgroundCheck.findFirst({
        where: { contactId: contact.id },
      });
      if (bgCheck) {
        backgroundCheck = {
          companyName: bgCheck.companyName,
          website: bgCheck.website,
          country: bgCheck.country,
          industry: bgCheck.industry,
          companySize: bgCheck.companySize,
          riskLevel: bgCheck.riskLevel,
          notes: bgCheck.notes,
        };
      }
    } catch {}

    try {
      const bant = await prisma.customerBantScore.findFirst({
        where: { contactId: contact.id },
        orderBy: { evaluatedAt: 'desc' },
      });
      if (bant) {
        bantScore = {
          budgetScore: bant.budgetScore,
          authorityScore: bant.authorityScore,
          needScore: bant.needScore,
          timelineScore: bant.timelineScore,
          totalScore: bant.totalScore,
          level: bant.level,
        };
      }
    } catch {}

    // 10. Trigger async background check / BANT if missing (non-blocking)
    if (!backgroundCheck || !bantScore) {
      // Fire and forget - don't await
      if (!backgroundCheck) {
        import('./customers.js').then(mod => {
          mod.autoBackgroundCheck(jid, 1).catch(() => {});
        }).catch(() => {});
      }
      if (!bantScore) {
        import('./bant-score.js').then(mod => {
          mod.autoBantScore(jid).catch(() => {});
        }).catch(() => {});
      }
    }

    return {
      productId: product.id,
      productName: `${product.productNameCn} (${product.productNameEn})`,
      productNameCn: product.productNameCn,
      productNameEn: product.productNameEn,
      completeness,
      requiredQuestions: requiredQuestionsWithStatus,
      followUpQuestions: followUpQuestionsWithStatus,
      askedRounds: state.askedRounds,
      maxRounds: MAX_FOLLOWUP_ROUNDS,
      strategy,
      stage,
      backgroundCheck,
      bantScore,
    };
  } catch (err) {
    console.error('[ConvMgr] getConversationStatus error:', err.message);
    return { error: err.message };
  }
}

// ── Core: generateScript ───────────────────────────────────────────
/**
 * Generate a conversation script based on current conversation status.
 * @param {string} jid - Customer JID
 * @param {string} type - 'ask' | 'quote' | auto (based on completeness)
 * @returns {object} Generated script
 */
export async function generateScript(jid, type = null) {
  try {
    if (!jid) return { error: 'jid required' };

    // Get conversation status
    const status = await getConversationStatus(jid);
    if (status.error) return { error: status.error };

    // Determine script type
    let scriptType = type || (status.strategy === 'PROVIDE_QUOTE' ? 'quote' : 'ask');

    const { modelId, provider } = await resolveProvider();

    const cust = await findCustomerByJid(jid);
    const contact = await findContactByJid(jid);

    // Build context for LLM
    const answeredQs = status.requiredQuestions.filter(q => q.answered);
    const unansweredQs = status.requiredQuestions.filter(q => !q.answered);

    let script_en = '';
    let script_cn = '';
    let questionsToAsk = [];
    let reason = '';

    if (scriptType === 'ask') {
      // Generate inquiry script
      const questionsToAskList = unansweredQs.slice(0, 3); // Max 3 questions per round
      questionsToAsk = questionsToAskList.map(q => ({
        id: q.id,
        questionCn: q.questionCn,
        questionEn: q.questionEn,
      }));

      const systemPrompt = `You are an expert B2B sales copywriter for a glass packaging / industrial materials company. You write natural, professional, and friendly sales messages in both English and Chinese.

Your task: Generate a conversational message that naturally asks the customer for the missing information. Do NOT make it sound like a questionnaire - weave the questions naturally into the conversation.

Rules:
- Be conversational and warm, not robotic
- Ask at most 3 questions per message
- If background check info is available, reference it naturally (e.g. "I see your company is in the ... industry")
- Show genuine interest in helping the customer
- English version should sound native, not translated
- Chinese version should be the natural Chinese meaning (for internal reference)

You must respond with valid JSON only.`;

      const userPrompt = `Generate a sales inquiry message for the following situation:

## Product: ${status.productName}
## Customer: ${cust?.contactName || 'Unknown'} from ${cust?.companyName || 'Unknown company'} (${cust?.country || 'Unknown country'})

## Background Check:
${status.backgroundCheck ? JSON.stringify(status.backgroundCheck) : 'Not available'}

## Already answered questions:
${answeredQs.map(q => `- ${q.questionEn}: ${q.answer || 'Yes'}`).join('\n') || 'None yet'}

## Questions still need to ask (pick up to 3, most important first):
${questionsToAskList.map(q => `- ${q.questionEn} (${q.questionCn})`).join('\n')}

## Information completeness: ${Math.round(status.completeness * 100)}%
## Follow-up rounds so far: ${status.askedRounds}/${status.maxRounds}

Respond with:
{
  "script_en": "<The English message to send to the customer - natural, conversational>",
  "script_cn": "<Chinese translation/meaning for internal reference>",
  "reason": "<Brief explanation of why these questions are being asked>"
}`;

      try {
        const raw = await chatComplete(modelId, systemPrompt, userPrompt, {
          temperature: 0.7,
          maxTokens: 1000,
          provider,
          timeout: 60000,
        });

        const result = safeParseLLMJson(raw);
        if (result) {
          script_en = result.script_en || '';
          script_cn = result.script_cn || '';
          reason = result.reason || '';
        }
      } catch (e) {
        console.error('[ConvMgr] LLM ask script error:', e.message);
        // Fallback
        script_en = `Could you please provide more details about ${questionsToAskList.map(q => q.questionEn.toLowerCase()).join(', ')}? This will help me prepare an accurate quotation for you.`;
        script_cn = `请问您能否提供更多关于${questionsToAskList.map(q => q.questionCn).join('、')}的信息？这将帮助我为您准备准确的报价。`;
        reason = `LLM call failed, using fallback script`;
      }

      // Increment follow-up rounds
      incrementFollowUpRounds(jid);

    } else {
      // Generate quote script
      const systemPrompt = `You are an expert B2B sales copywriter for a glass packaging / industrial materials company. You write professional quotation messages in both English and Chinese.

Your task: Generate a professional quotation message based on all the collected information about the customer's needs.

Rules:
- Be professional but friendly
- Include relevant product details (price, MOQ, delivery time, payment terms)
- Reference the customer's specific requirements
- Include a clear call to action
- English version should sound native and professional
- Chinese version is for internal reference

You must respond with valid JSON only.`;

      const bantInfo = status.bantScore ? `
## BANT Score:
- Budget: ${status.bantScore.budgetScore}/10
- Authority: ${status.bantScore.authorityScore}/10
- Need: ${status.bantScore.needScore}/10
- Timeline: ${status.bantScore.timelineScore}/10
- Overall: ${status.bantScore.totalScore}/10 (${status.bantScore.level})
` : '';

      const userPrompt = `Generate a sales quotation message for the following situation:

## Product: ${status.productName}
## Customer: ${cust?.contactName || 'Unknown'} from ${cust?.companyName || 'Unknown company'} (${cust?.country || 'Unknown country'})

## Background Check:
${status.backgroundCheck ? JSON.stringify(status.backgroundCheck) : 'Not available'}

${bantInfo}

## Collected requirements:
${answeredQs.map(q => `- ${q.questionEn}: ${q.answer || 'Confirmed'}`).join('\n') || 'Limited information collected'}

## Information completeness: ${Math.round(status.completeness * 100)}%

Respond with:
{
  "script_en": "<The English quotation message to send to the customer>",
  "script_cn": "<Chinese translation for internal reference>",
  "reason": "<Brief explanation of the quotation approach>"
}`;

      try {
        const raw = await chatComplete(modelId, systemPrompt, userPrompt, {
          temperature: 0.5,
          maxTokens: 1500,
          provider,
          timeout: 60000,
        });

        const result = safeParseLLMJson(raw);
        if (result) {
          script_en = result.script_en || '';
          script_cn = result.script_cn || '';
          reason = result.reason || '';
        }
      } catch (e) {
        console.error('[ConvMgr] LLM quote script error:', e.message);
        // Fallback
        script_en = `Thank you for providing the details. Based on your requirements, here is our quotation: [Please configure product pricing in the knowledge base for accurate quotes]. Please let me know if you have any questions.`;
        script_cn = `感谢您提供的详细信息。根据您的要求，以下是我们的报价：[请在知识库中配置产品价格以获取准确报价]。如有任何问题，请随时联系我。`;
        reason = `LLM call failed, using fallback script`;
      }
    }

    return {
      strategy: scriptType === 'ask' ? 'ASK_FOR_INFO' : 'PROVIDE_QUOTE',
      script_en,
      script_cn,
      questionsToAsk,
      reason,
      completeness: status.completeness,
      askedRounds: getConversationState(jid).askedRounds,
    };
  } catch (err) {
    console.error('[ConvMgr] generateScript error:', err.message);
    return { error: err.message };
  }
}

// ── API Routes ─────────────────────────────────────────────────────

/**
 * GET /api/customers/by-jid/:jid/conversation-status
 * Get current conversation status for a customer
 */
router.get('/by-jid/:jid/conversation-status', async (req, res) => {
  try {
    const jid = decodeJid(req.params.jid);
    if (!jid) return res.status(400).json({ error: 'jid required' });

    const result = await getConversationStatus(jid);
    if (result.error) {
      return res.status(404).json({ error: result.error });
    }

    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[ConvMgr] GET conversation-status error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/customers/by-jid/:jid/generate-script
 * Generate a conversation script based on current status
 * Body: { type?: 'ask' | 'quote' }
 */
router.post('/by-jid/:jid/generate-script', async (req, res) => {
  try {
    const jid = decodeJid(req.params.jid);
    if (!jid) return res.status(400).json({ error: 'jid required' });

    const type = req.body?.type || null; // 'ask' | 'quote' | null (auto)
    const result = await generateScript(jid, type);

    if (result.error) {
      return res.status(404).json({ error: result.error });
    }

    // Emit WebSocket event
    const io = req.app.get('io');
    if (io) {
      io.emit('conversation:script:generated', {
        jid,
        strategy: result.strategy,
        completeness: result.completeness,
      });
    }

    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[ConvMgr] POST generate-script error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/customers/by-jid/:jid/conversation-status/reset
 * Reset follow-up round counter (manually restart conversation)
 */
router.post('/by-jid/:jid/conversation-status/reset', async (req, res) => {
  try {
    const jid = decodeJid(req.params.jid);
    if (!jid) return res.status(400).json({ error: 'jid required' });

    resetConversationState(jid);

    res.json({ success: true, message: 'Conversation state reset', askedRounds: 0 });
  } catch (err) {
    console.error('[ConvMgr] POST reset error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
