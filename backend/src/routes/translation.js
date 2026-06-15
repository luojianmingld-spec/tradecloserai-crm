import { Router } from 'express';
import {
  translateText,
  translateOutgoing,
  detectLanguage,
  getTranslationSettings,
} from '../services/translation.js';

const router = Router();

// Translate text
router.post('/translate', async (req, res) => {
  try {
    const { text, sourceLang, targetLang, engine } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    // Get user settings for defaults
    const settings = await getTranslationSettings(req.userId);
    const effectiveEngine = engine || settings.translationEngine || 'doubao';
    const effectiveTarget = targetLang || settings.translationTargetLang || 'zh';

    // Auto-detect source language if not provided
    let effectiveSource = sourceLang || 'auto';
    if (effectiveSource === 'auto') {
      effectiveSource = await detectLanguage(text, effectiveEngine);
    }

    const result = await translateText(
      text,
      effectiveSource,
      effectiveTarget,
      effectiveEngine,
      req.userId
    );

    res.json(result);
  } catch (err) {
    console.error('[Translation] API error:', err);
    res.status(500).json({ error: 'Translation failed' });
  }
});

// Translate outgoing message
router.post('/translate-outgoing', async (req, res) => {
  try {
    const { text, contactLang } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const result = await translateOutgoing(text, contactLang, req.userId);
    res.json(result);
  } catch (err) {
    console.error('[Translation] Outgoing error:', err);
    res.status(500).json({ error: 'Translation failed' });
  }
});

// Detect language
router.post('/detect-language', async (req, res) => {
  try {
    const { text, engine } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const settings = await getTranslationSettings(req.userId);
    const effectiveEngine = engine || settings.translationEngine || 'doubao';

    const lang = await detectLanguage(text, effectiveEngine);
    res.json({ language: lang });
  } catch (err) {
    console.error('[Translation] Detect error:', err);
    res.status(500).json({ error: 'Language detection failed' });
  }
});

export default router;
