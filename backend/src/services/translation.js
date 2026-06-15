import { LLMClient, Config } from 'coze-coding-dev-sdk';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// In-memory cache for fast lookup (backed by DB)
const memoryCache = new Map();

// Model mapping for translation engines
const ENGINE_MODELS = {
  doubao: 'doubao-seed-2-0-lite-260215',
  deepseek: 'deepseek-v3-2-251201',
};

// Default translation settings
const DEFAULT_SETTINGS = {
  translationEnabled: 'true',
  translationEngine: 'doubao',
  translationTargetLang: 'auto',
  translationAutoSend: 'false',
};

/**
 * Get translation settings for a user
 */
export async function getTranslationSettings(userId) {
  const settings = await prisma.setting.findMany({
    where: { userId },
  });
  const map = {};
  for (const s of settings) {
    map[s.key] = s.value;
  }
  return { ...DEFAULT_SETTINGS, ...map };
}

/**
 * Update a translation setting
 */
export async function updateSetting(userId, key, value) {
  return prisma.setting.upsert({
    where: { userId_key: { userId, key } },
    create: { userId, key, value },
    update: { value },
  });
}

/**
 * Batch update translation settings
 */
export async function updateSettings(userId, settings) {
  const ops = Object.entries(settings).map(([key, value]) =>
    prisma.setting.upsert({
      where: { userId_key: { userId, key } },
      create: { userId, key, value: String(value) },
      update: { value: String(value) },
    })
  );
  return Promise.all(ops);
}

/**
 * Detect language of text using LLM
 */
export async function detectLanguage(text, engine = 'doubao') {
  if (!text || text.trim().length === 0) return 'unknown';

  // Simple heuristic for common languages
  const detected = quickDetect(text);
  if (detected !== 'unknown') return detected;

  // Use LLM for uncertain cases
  try {
    const config = new Config();
    const client = new LLMClient(config);
    const model = ENGINE_MODELS[engine] || ENGINE_MODELS.doubao;

    const response = await client.invoke(
      [
        {
          role: 'system',
          content:
            'You are a language detection tool. Return ONLY the ISO 639-1 language code (2 letters) for the given text. Examples: en, zh, es, de, fr, ja, ko, ar, pt, ru, it, nl, tr, th, vi, id. Return only the code, nothing else.',
        },
        { role: 'user', content: text.substring(0, 200) },
      ],
      { model, temperature: 0.1 }
    );

    const lang = response.content.trim().toLowerCase();
    // Validate it's a 2-letter code
    if (/^[a-z]{2}$/.test(lang)) return lang;
    return 'unknown';
  } catch (err) {
    console.error('[Translation] Language detection error:', err);
    return 'unknown';
  }
}

/**
 * Quick language detection using character patterns
 */
function quickDetect(text) {
  // Chinese
  if (/[\u4e00-\u9fff]/.test(text)) return 'zh';
  // Japanese (hiragana/katakana)
  if (/[\u3040-\u309f\u30a0-\u30ff]/.test(text)) return 'ja';
  // Korean
  if (/[\uac00-\ud7af]/.test(text)) return 'ko';
  // Arabic
  if (/[\u0600-\u06ff]/.test(text)) return 'ar';
  // Thai
  if (/[\u0e00-\u0e7f]/.test(text)) return 'th';
  // Devanagari
  if (/[\u0900-\u097f]/.test(text)) return 'hi';
  // Cyrillic
  if (/[\u0400-\u04ff]/.test(text)) return 'ru';
  // Latin-based (English, Spanish, French, etc.)
  if (/[a-zA-Z]/.test(text)) {
    // Try to distinguish common Latin-based languages
    const lower = text.toLowerCase();
    // German
    if (/\b(der|die|das|und|ist|ich|nicht|ein|mit|auf|für)\b/.test(lower)) return 'de';
    // Spanish
    if (/\b(el|la|los|las|de|en|que|por|con|una|para)\b/.test(lower)) return 'es';
    // French
    if (/\b(le|la|les|de|des|du|un|une|est|dans|pour)\b/.test(lower)) return 'fr';
    // Portuguese
    if (/\b(o|a|os|as|de|em|que|um|uma|para|com)\b/.test(lower)) return 'pt';
    // Italian
    if (/\b(il|la|lo|le|gli|di|da|in|che|un|per)\b/.test(lower)) return 'it';
    // Default to English
    return 'en';
  }
  return 'unknown';
}

/**
 * Translate text using LLM
 */
export async function translateText(text, sourceLang, targetLang, engine = 'doubao', userId = null) {
  if (!text || text.trim().length === 0) return { translated: '', sourceLang: sourceLang || 'unknown', targetLang };

  // Normalize
  sourceLang = sourceLang || 'auto';
  targetLang = targetLang || 'zh';

  // If source and target are the same, no translation needed
  if (sourceLang !== 'auto' && sourceLang === targetLang) {
    return { translated: text, sourceLang, targetLang };
  }

  // Check cache
  const cacheKey = `${text}|${sourceLang}|${targetLang}|${engine}`;
  if (memoryCache.has(cacheKey)) {
    const cached = memoryCache.get(cacheKey);
    return { translated: cached, sourceLang, targetLang, cached: true };
  }

  // Check DB cache
  try {
    const dbCached = await prisma.translationCache.findUnique({
      where: {
        sourceText_sourceLang_targetLang_engine: {
          sourceText: text,
          sourceLang,
          targetLang,
          engine,
        },
      },
    });
    if (dbCached) {
      memoryCache.set(cacheKey, dbCached.translated);
      return { translated: dbCached.translated, sourceLang, targetLang, cached: true };
    }
  } catch (err) {
    // Cache lookup failed, continue with translation
  }

  // Use LLM for translation
  try {
    const config = new Config();
    const client = new LLMClient(config);
    const model = ENGINE_MODELS[engine] || ENGINE_MODELS.doubao;

    const langNames = {
      zh: 'Chinese', en: 'English', es: 'Spanish', de: 'German',
      fr: 'French', ja: 'Japanese', ko: 'Korean', ar: 'Arabic',
      pt: 'Portuguese', ru: 'Russian', it: 'Italian', nl: 'Dutch',
      tr: 'Turkish', th: 'Thai', vi: 'Vietnamese', id: 'Indonesian',
      hi: 'Hindi',
    };

    const targetName = langNames[targetLang] || targetLang;
    const sourceInstruction = sourceLang === 'auto'
      ? 'Detect the source language automatically'
      : `The source language is ${langNames[sourceLang] || sourceLang}`;

    const systemPrompt = `You are a professional translator for international trade. Translate the given text to ${targetName}. ${sourceInstruction}. 

Rules:
1. Return ONLY the translated text, nothing else
2. Preserve the original tone and meaning
3. For business/trade terms, use standard industry terminology
4. Keep formatting (line breaks, etc.) intact
5. If the text is already in the target language, return it as-is`;

    const response = await client.invoke(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text },
      ],
      { model, temperature: 0.3 }
    );

    const translated = response.content.trim();

    // Save to cache
    memoryCache.set(cacheKey, translated);
    try {
      await prisma.translationCache.upsert({
        where: {
          sourceText_sourceLang_targetLang_engine: {
            sourceText: text,
            sourceLang,
            targetLang,
            engine,
          },
        },
        create: {
          sourceText: text,
          sourceLang,
          targetLang,
          engine,
          translated,
        },
        update: { translated },
      });
    } catch (cacheErr) {
      // Cache write failed, non-critical
      console.error('[Translation] Cache write error:', cacheErr.message);
    }

    return { translated, sourceLang, targetLang, cached: false };
  } catch (err) {
    console.error('[Translation] Translation error:', err);
    return { translated: '', sourceLang, targetLang, error: err.message };
  }
}

/**
 * Auto-translate an incoming message
 */
export async function autoTranslateMessage(message, userId) {
  try {
    const settings = await getTranslationSettings(userId);

    if (settings.translationEnabled !== 'true') {
      return null;
    }

    if (!message.content || message.messageType !== 'text') {
      return null;
    }

    const engine = settings.translationEngine || 'doubao';
    const targetLang = settings.translationTargetLang || 'zh';

    // Detect source language
    let sourceLang = await detectLanguage(message.content, engine);

    // Determine target language
    let effectiveTarget = targetLang;
    if (effectiveTarget === 'auto') {
      effectiveTarget = 'zh'; // Default target for received messages
    }

    // Skip if already in target language
    if (sourceLang === effectiveTarget) {
      return null;
    }

    // Translate
    const result = await translateText(
      message.content,
      sourceLang,
      effectiveTarget,
      engine,
      userId
    );

    if (result.translated && result.translated !== message.content) {
      // Update message in DB
      await prisma.message.update({
        where: { id: message.id },
        data: {
          translation: result.translated,
          sourceLang: sourceLang,
        },
      });

      return {
        translation: result.translated,
        sourceLang,
        targetLang: effectiveTarget,
      };
    }

    return null;
  } catch (err) {
    console.error('[Translation] Auto-translate error:', err);
    return null;
  }
}

/**
 * Translate outgoing message text
 */
export async function translateOutgoing(text, contactLang, userId) {
  try {
    const settings = await getTranslationSettings(userId);

    if (!text || settings.translationEnabled !== 'true') {
      return { translated: text, sourceLang: 'zh', targetLang: contactLang };
    }

    const engine = settings.translationEngine || 'doubao';

    // Detect source language of the text being sent
    const sourceLang = await detectLanguage(text, engine);

    // If target language is auto, use contact's language or English
    let targetLang = contactLang || 'en';

    // Skip if same language
    if (sourceLang === targetLang) {
      return { translated: text, sourceLang, targetLang };
    }

    const result = await translateText(text, sourceLang, targetLang, engine, userId);
    return result;
  } catch (err) {
    console.error('[Translation] Outgoing translate error:', err);
    return { translated: text, error: err.message };
  }
}
