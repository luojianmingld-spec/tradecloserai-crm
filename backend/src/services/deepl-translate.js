// DeepL Translate Service — 通过 DeepL API 翻译
// Free 版 host: api-free.deepl.com（每月 50 万字符免费额度）
// Key 通过环境变量 DEEPL_API_KEY 注入（systemd Environment）
const DEEPL_HOST = process.env.DEEPL_HOST || 'https://api-free.deepl.com';

const LANG_MAP = {
  zh: 'ZH', en: 'EN', ja: 'JA', ko: 'KO', de: 'DE', fr: 'FR',
  es: 'ES', pt: 'PT', ru: 'RU', it: 'IT', nl: 'NL', tr: 'TR',
  th: 'TH', vi: 'VI', id: 'ID', ar: 'AR', hi: 'HI', pl: 'PL',
  uk: 'UK', cs: 'CS', sv: 'SV', el: 'EL', fi: 'FI', da: 'DA',
};

export function toDeepLLang(code) {
  if (!code || code === 'auto') return null;
  const c = String(code).split('-')[0].toLowerCase();
  return LANG_MAP[c] || null;
}

/** 判断某个目标语言是否 DeepL 原生支持（不支持的语种走 LLM 翻译） */
export function isDeepLSupported(code) {
  if (!code || code === 'auto') return true; // auto 交给 DeepL 自动检测
  const c = String(code).split('-')[0].toLowerCase();
  return !!LANG_MAP[c];
}

/**
 * 调用 DeepL API 翻译
 * @param {string} text 待翻译文本
 * @param {string} sourceLang ISO 639-1 或 'auto'
 * @param {string} targetLang ISO 639-1
 * @returns {Promise<{translated:string, detectedSourceLang:string|null}>}
 */
export async function deeplTranslate(text, sourceLang, targetLang) {
  const key = process.env.DEEPL_API_KEY;
  if (!key) throw new Error('DEEPL_API_KEY not configured');
  const tgt = toDeepLLang(targetLang);
  if (!tgt) throw new Error('DeepL unsupported target: ' + targetLang);
  const src = toDeepLLang(sourceLang);
  const body = new URLSearchParams();
  body.append('text', text);
  body.append('target_lang', tgt);
  if (src) body.append('source_lang', src);
  const resp = await fetch(DEEPL_HOST + '/v2/translate', {
    method: 'POST',
    headers: {
      'Authorization': 'DeepL-Auth-Key ' + key,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });
  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    throw new Error('DeepL HTTP ' + resp.status + ': ' + errText.slice(0, 160));
  }
  const data = await resp.json();
  const t = data && data.translations && data.translations[0];
  if (!t || !t.text) throw new Error('DeepL empty response');
  return {
    translated: t.text,
    detectedSourceLang: t.detected_source_language ? String(t.detected_source_language).toLowerCase() : null,
  };
}
