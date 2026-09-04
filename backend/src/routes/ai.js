/**
 * AI API Routes — 统一 AI 功能接口
 * 
 * POST /api/ai/translate    — AI 翻译
 * POST /api/ai/reply        — AI 话术生成
 * POST /api/ai/closing-reply — AI 成交模式回复
 * POST /api/ai/summarize    — AI 需求总结
 * POST /api/ai/extract-info — 提取客户信息
 * POST /api/ai/generate-document — 生成单证
 * GET  /api/ai/models       — 获取可用模型列表
 */
import { Router } from 'express';
import { authMiddleware as auth } from '../middleware/auth.js';
import { chargeCredits } from '../middleware/credit-charge.js';
import {
  translateText,
  translateOutgoing,
  detectLanguage,
  generateReply,
  summarizeNeed,
  extractCustomerInfo,
  getAvailableModels,
  generateDocument,
  analyzeConversation,
  chatWithContext,
} from '../services/ai.service.js';
import { chatComplete as rawChatComplete, getActiveProvider } from '../services/ai-client.js';
import { generateClosingReply } from '../services/closing-reply.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Helpers for building conversation context (single-account model: accountId == userId, sessionId = user_${userId})
async function getRecentMessagesForChat(accountId, jid, limit = 20) {
  const sessionId = `user_${accountId}`;
  try {
    return await prisma.wAMessage.findMany({
      where: {
        sessionId,
        OR: [{ from: jid }, { to: jid }],
      },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
  } catch (e) {
    console.warn('[AI route] getRecentMessagesForChat error:', e.message);
    return [];
  }
}
async function getContactForChat(accountId, jid) {
  try {
    const phone = (jid || '').split('@')[0];
    const customer = await prisma.customer.findFirst({
      where: { userId: accountId, phone },
    });
    if (customer) {
      return { name: customer.name, country: customer.country || '', language: '', phone };
    }
  } catch (e) {
    console.warn('[AI route] getContactForChat error:', e.message);
  }
  return null;
}
function buildContextForChat(messages, contact) {
  const contactInfo = contact ? `客户: ${contact.name || contact.phone || '未知'}, 国家: ${contact.country || '未知'}, 语言: ${contact.language || '未知'}` : '';
  const lines = messages.slice().reverse().map(m => {
    const isFromMe = m.fromMe === true || m.direction === 'outbound' || m.direction === 'outgoing';
    const role = isFromMe ? '我方' : '客户';
    const content = m.body || m.content || '';
    const t = new Date(m.timestamp).toLocaleString('zh-CN');
    return `[${t}] ${role}: ${content}`;
  });
  return (contactInfo ? contactInfo + '\n\n' : '') + lines.join('\n');
}

const router = Router();

// ─── 【终止按钮】客户端断开时中断上游 LLM 调用 ───
// 前端 AbortController abort → 连接提前关闭 → 本 signal 中止 → OpenAI SDK 中断请求，避免浪费 tokens
// 注意：Node18+ 正常响应完成后也会触发 req close，故必须检查 res.writableEnded
function bindAbortOnClientClose(req, res) {
  const ac = new AbortController();
  // Node 18+/22：req 的 close 在请求接收阶段即可能触发，不可靠；
  // res 的 close 在底层连接关闭时触发（正常完成时 writableEnded=true，提前断开时为 false）
  res.on('close', () => {
    if (!res.writableEnded && !ac.signal.aborted) {
      console.log('[AI route] client connection closed early, aborting upstream LLM call');
      ac.abort();
    }
  });
  return ac.signal;
}

router.post('/translate', auth, chargeCredits(), async (req, res) => {
  try {
    const { text, sourceLang, targetLang, engine } = req.body;
    if (!text) return res.status(400).json({ error: 'text is required' });

    const src = sourceLang || 'auto';
    const tgt = targetLang || 'zh';
    const eng = engine || 'deepl';

    let detectedLang = src;
    if (src === 'auto') {
      detectedLang = await detectLanguage(text, eng);
    }

    const result = await translateText(text, detectedLang, tgt, eng, req.userId);
    res.json(result);
  } catch (err) {
    console.error('[AI Translate Error]', err);
    res.status(500).json({ error: '翻译失败: ' + err.message });
  }
});

// ─── POST /api/ai/reply — AI 话术生成 (Phase 5: +length, +includeContext) ───
router.post('/reply', auth, chargeCredits(), async (req, res) => {
  const signal = bindAbortOnClientClose(req, res); // 【终止按钮】
  try {
    const { accountId, jid, style, model, messages, length, includeContext, extraPrompt } = req.body;
    const acctId = accountId ? parseInt(accountId) : req.userId;
    // Support either direct messages array or jid to fetch from DB
    if (!messages?.length && !jid) {
      return res.status(400).json({ error: 'Provide jid or messages array' });
    }

    const result = await generateReply({
      userId: req.userId,
      accountId: acctId,
      jid: jid || null,
      style: style || 'formal',
      model: model || 'doubao-lite',
      messages,
      length: length || 'medium',
      includeContext: !!includeContext,
      extraPrompt: typeof extraPrompt === 'string' ? extraPrompt.trim() : undefined,
      signal, // 【终止按钮】
    });
    if (signal.aborted) return; // 【终止按钮】客户端已终止，不写响应（避免2xx触发扣分）
    res.json(result);
  } catch (err) {
    if (signal.aborted) { console.log('[AI Reply] aborted by client'); return; } // 【终止按钮】
    console.error('[AI Reply Error]', err);
    res.status(500).json({ error: '话术生成失败: ' + err.message });
  }
});

// ─── POST /api/ai/reply/all-lengths — Phase 5: 一次生成短/中/长三种长度 ───
router.post('/reply/all-lengths', auth, async (req, res) => {
  try {
    const { accountId, jid, style, model, messages, includeContext } = req.body;
    const acctId = accountId ? parseInt(accountId) : req.userId;
    if (!messages?.length && !jid) {
      return res.status(400).json({ error: 'Provide jid or messages array' });
    }

    const lengths = ['short', 'medium', 'long'];
    const results = {};
    for (const len of lengths) {
      try {
        const r = await generateReply({
          userId: req.userId,
          accountId: acctId,
          jid: jid || null,
          style: style || 'formal',
          model: model || 'doubao-lite',
          messages,
          length: len,
          includeContext: !!includeContext,
        });
        results[len] = { replies: r.replies || [], context: r.context || null, length: len };
      } catch (e) {
        results[len] = { replies: [], error: e.message, length: len };
      }
    }
    res.json(results);
  } catch (err) {
    console.error('[AI Reply All-Lengths Error]', err);
    res.status(500).json({ error: '生成失败: ' + err.message });
  }
});


// ─── POST /api/ai/closing-reply — AI 成交模式回复（感知 Pipeline 阶段） ───
router.post('/closing-reply', auth, chargeCredits(), async (req, res) => {
  try {
    const { accountId, jid } = req.body;
    if (!jid) {
      return res.status(400).json({ error: 'jid is required' });
    }
    const acctId = accountId ? parseInt(accountId) : req.userId;
    const result = await generateClosingReply({
      userId: req.userId,
      accountId: acctId,
      jid,
    });
    res.json(result);
  } catch (err) {
    console.error('[AI Closing Reply Error]', err);
    res.status(500).json({ error: '成交回复生成失败: ' + err.message });
  }
});

// ─── POST /api/ai/analyze — AI 深度分析（翻译+意图分析+3版回复，元宝风格） ───
router.post('/analyze', auth, async (req, res) => {
  const signal = bindAbortOnClientClose(req, res); // 【终止按钮】
  try {
    const { accountId, jid, model, messages, targetLang, feedback } = req.body;
    const acctId = accountId ? parseInt(accountId) : req.userId;
    console.log('[AI Analyze req]', JSON.stringify({ jid: jid || null, directMsgs: Array.isArray(messages) ? messages.length : 0, t: new Date().toISOString() }));
    if (!messages?.length && !jid) {
      return res.status(400).json({ success: false, error: 'Provide jid or messages array' });
    }

    const result = await analyzeConversation({
      userId: req.userId,
      accountId: acctId,
      jid: jid || null,
      model: model || null,
      messages,
      targetLang: targetLang || 'auto',
      feedback: typeof feedback === 'string' ? feedback.trim() : undefined,
      signal, // 【终止按钮】
    });

    if (signal.aborted) return; // 【终止按钮】客户端已终止，不写响应
    if (result && result.success === false) {
      return res.status(200).json(result); // 业务友好错误，不抛500
    }
    res.json(result);
  } catch (err) {
    if (signal.aborted) { console.log('[AI Analyze] aborted by client'); return; } // 【终止按钮】
    console.error('[AI Analyze Error]', err);
    res.status(500).json({ success: false, error: 'AI分析失败: ' + err.message });
  }
});

// ─── POST /api/ai/summarize — AI 需求总结 ───
router.post('/summarize', auth, chargeCredits(), async (req, res) => {
  try {
    const { accountId, jid, messages } = req.body;
    const acctId = accountId ? parseInt(accountId) : req.userId;
    if (!messages?.length && !jid) {
      return res.status(400).json({ error: 'Provide jid or messages array' });
    }

    const result = await summarizeNeed({
      userId: req.userId,
      accountId: acctId,
      jid: jid || null,
      messages,
    });
    res.json(result);
  } catch (err) {
    console.error('[AI Summarize Error]', err);
    res.status(500).json({ error: '需求总结失败: ' + err.message });
  }
});

// ─── Legacy endpoints (backward compatible) ───
router.post('/generate-reply', auth, async (req, res) => {
  try {
    const { accountId, jid, style } = req.body;
    if (!accountId || !jid) return res.status(400).json({ error: 'accountId and jid are required' });

    const result = await generateReply({
      userId: req.userId,
      accountId: parseInt(accountId),
      jid,
      style: style || 'formal',
    });
    res.json(result);
  } catch (err) {
    console.error('[AI Generate Reply Error]', err);
    res.status(500).json({ error: '话术生成失败: ' + err.message });
  }
});

router.post('/summarize-need', auth, async (req, res) => {
  try {
    const { accountId, jid } = req.body;
    if (!accountId || !jid) return res.status(400).json({ error: 'accountId and jid are required' });

    const result = await summarizeNeed({
      userId: req.userId,
      accountId: parseInt(accountId),
      jid,
    });
    res.json(result);
  } catch (err) {
    console.error('[AI Summarize Need Error]', err);
    res.status(500).json({ error: '需求总结失败: ' + err.message });
  }
});


// ─── POST /api/ai/extract-info — 提取客户信息 ───
router.post("/extract-info", auth, chargeCredits(), async (req, res) => {
  try {
    const { accountId, jid, messages } = req.body;
    const acctId = accountId ? parseInt(accountId) : req.userId;
    if (!messages?.length && !jid) {
      return res.status(400).json({ error: "Provide jid or messages array" });
    }

    const result = await extractCustomerInfo({
      userId: req.userId,
      accountId: acctId,
      jid: jid || null,
      messages,
    });
    res.json(result);
  } catch (err) {
    console.error("[AI Extract Info Error]", err);
    res.status(500).json({ error: "提取客户信息失败: " + err.message });
  }
});

// ─── POST /api/ai/generate-document — 生成单证 ───
router.post("/generate-document", auth, chargeCredits(), async (req, res) => {
  try {
    const { accountId, jid, messages, docType, customerInfo } = req.body;
    const acctId = accountId ? parseInt(accountId) : req.userId;
    if (!messages?.length && !jid) {
      return res.status(200).json({ success: false, error: "Provide jid or messages array" });
    }

    // Sanitize messages for chat-mode: only keep role + content
    let cleanMessages = null;
    if (Array.isArray(messages) && messages.length > 0) {
      const looksLikeChat = messages.every(m => m && (m.role === 'user' || m.role === 'assistant'));
      if (looksLikeChat) {
        cleanMessages = messages
          .filter(m => m && typeof m.content === 'string' && m.content.trim())
          .map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content).trim() }));
      } else {
        // treat raw WhatsApp messages array as-is (single-shot path; service will use jid anyway)
        cleanMessages = messages;
      }
    }

    const result = await generateDocument({
      userId: req.userId,
      accountId: acctId,
      jid: jid || null,
      messages: cleanMessages,
      docType: docType || "quotation",
      customerInfo: customerInfo || null,
    });
    if (result && result.success === false) {
      return res.status(200).json(result);
    }
    res.json({ success: true, content: result.content, docType: result.docType });
  } catch (err) {
    console.error("[AI Generate Document Error]", err);
    res.status(200).json({ success: false, error: "单证生成失败: " + err.message });
  }
});


// ─── POST /api/ai/chat — AI多轮对话（自动拼接WhatsApp会话上下文） ───
// body: { jid, accountId?, model?, messages: [{role:"user"|"assistant", content}] }
router.post('/chat', auth, chargeCredits(), async (req, res) => {
  const signal = bindAbortOnClientClose(req, res); // 【终止按钮】
  try {
    const { jid, accountId, model, messages, targetLang } = req.body;
    const acctId = accountId ? parseInt(accountId) : req.userId;

    // messages 必须是非空数组（至少有一条用户消息）
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ success: false, error: 'messages array is required' });
    }
    // jid 可选：有则拼接WhatsApp上下文；无则纯AI对话
    const result = await chatWithContext({
      userId: req.userId,
      accountId: acctId,
      jid: jid || null,
      model: model || null,
      history: messages,
      targetLang: targetLang || 'auto',
      signal, // 【终止按钮】
    });

    if (signal.aborted) return; // 【终止按钮】客户端已终止，不写响应（避免2xx触发扣分）
    if (result && result.success === false) {
      return res.status(200).json(result);
    }
    res.json(result);
  } catch (err) {
    if (signal.aborted) { console.log('[AI Chat] aborted by client'); return; } // 【终止按钮】
    console.error('[AI Chat Error]', err);
    res.status(500).json({ success: false, error: 'AI对话失败: ' + err.message });
  }
});

// ─── GET /api/ai/models — 获取可用模型列表 ───
router.get('/models', auth, async (req, res) => {
  try {
    const models = await getAvailableModels();
    res.json({ models });
  } catch (err) {
    console.error('[AI Models] error:', err);
    res.status(500).json({ error: '获取模型列表失败', models: [] });
  }
});
export default router;
