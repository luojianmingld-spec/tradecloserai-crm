/**
 * AI API Routes — 统一 AI 功能接口
 * 
 * POST /api/ai/translate    — AI 翻译
 * POST /api/ai/reply        — AI 话术生成
 * POST /api/ai/summarize    — AI 需求总结
 * GET  /api/ai/models       — 获取可用模型列表
 */
import { Router } from 'express';
import { authMiddleware as auth } from '../middleware/auth.js';
import {
  translateText,
  translateOutgoing,
  detectLanguage,
  generateReply,
  summarizeNeed,
  getAvailableModels,
} from '../services/ai.service.js';

const router = Router();

// ─── GET /api/ai/models — 获取可用模型列表 ───
router.get('/models', auth, (req, res) => {
  res.json({ models: getAvailableModels() });
});

// ─── POST /api/ai/translate — AI 翻译 ───
router.post('/translate', auth, async (req, res) => {
  try {
    const { text, sourceLang, targetLang, engine } = req.body;
    if (!text) return res.status(400).json({ error: 'text is required' });

    const src = sourceLang || 'auto';
    const tgt = targetLang || 'zh';
    const eng = engine || 'doubao';

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

// ─── POST /api/ai/reply — AI 话术生成 ───
router.post('/reply', auth, async (req, res) => {
  try {
    const { accountId, jid, style, messages } = req.body;
    // Support either direct messages array or accountId+jid to fetch from DB
    if (!messages?.length && (!accountId || !jid)) {
      return res.status(400).json({ error: 'Provide either messages array or accountId+jid' });
    }

    const result = await generateReply({
      userId: req.userId,
      accountId: accountId ? parseInt(accountId) : null,
      jid: jid || null,
      style: style || 'formal',
      messages,
      style: style || 'formal',
    });
    res.json(result);
  } catch (err) {
    console.error('[AI Reply Error]', err);
    res.status(500).json({ error: '话术生成失败: ' + err.message });
  }
});

// ─── POST /api/ai/summarize — AI 需求总结 ───
router.post('/summarize', auth, async (req, res) => {
  try {
    const { accountId, jid, messages } = req.body;
    if (!messages?.length && (!accountId || !jid)) {
      return res.status(400).json({ error: 'Provide either messages array or accountId+jid' });
    }

    const result = await summarizeNeed({
      userId: req.userId,
      accountId: accountId ? parseInt(accountId) : null,
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

export default router;
