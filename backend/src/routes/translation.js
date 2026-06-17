/**
 * Translation API Routes
 * 
 * POST /api/translation/translate          — 翻译文本
 * POST /api/translation/translate-outgoing — 翻译发送消息
 * POST /api/translation/detect-language    — 检测语言
 */
import { Router } from 'express';
import { authMiddleware as auth } from '../middleware/auth.js';
import { translateText, translateOutgoing, detectLanguage } from '../services/ai.service.js';

const router = Router();

router.post('/translate', auth, async (req, res) => {
  try {
    const { text, from, to, engine } = req.body;
    if (!text) return res.status(400).json({ error: 'text is required' });

    const sourceLang = from || 'auto';
    const targetLang = to || 'zh';

    let detectedLang = sourceLang;
    if (sourceLang === 'auto') {
      detectedLang = await detectLanguage(text, engine);
    }

    const result = await translateText(text, detectedLang, targetLang, engine, req.userId);
    res.json(result);
  } catch (err) {
    console.error('[Translation Error]', err);
    res.status(500).json({ error: '翻译失败: ' + err.message });
  }
});

router.post('/translate-outgoing', auth, async (req, res) => {
  try {
    const { text, targetLang } = req.body;
    if (!text) return res.status(400).json({ error: 'text is required' });

    const result = await translateOutgoing(text, targetLang, req.userId);
    res.json(result);
  } catch (err) {
    console.error('[Translation Outgoing Error]', err);
    res.status(500).json({ error: '翻译失败: ' + err.message });
  }
});

router.post('/detect-language', auth, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'text is required' });

    const language = await detectLanguage(text);
    res.json({ language });
  } catch (err) {
    console.error('[Detect Language Error]', err);
    res.status(500).json({ error: '语言检测失败: ' + err.message });
  }
});

export default router;
