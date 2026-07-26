/**
 * Google Translate free adapter
 * Uses the public translate.googleapis.com/translate_a/single endpoint (no API key needed)
 * Uses native https module with keepAlive Agent to avoid TLS handshake per request.
 */

import https from 'https';
import { URL } from 'url';

const ENDPOINT_HOST = 'translate.googleapis.com';
const ENDPOINT_PATH = '/translate_a/single';
const DEFAULT_TIMEOUT_MS = 8000;

// 复用TCP/TLS连接，避免每次翻译都重新握手（首字从~1.5s降到~100ms）
const KEEPALIVE_AGENT = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 30000,
  maxSockets: 8,
  scheduling: 'lifo',
});

function httpsGetJson(urlStr, timeoutMs = DEFAULT_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const req = https.get({
      host: url.hostname,
      path: url.pathname + url.search,
      agent: KEEPALIVE_AGENT,
      timeout: timeoutMs,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; WhatsApp-CRM/1.0)',
        'Accept': 'application/json',
        'Connection': 'keep-alive',
      },
    }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`Google Translate HTTP ${res.statusCode}`));
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
        } catch (e) {
          reject(new Error(`Google Translate parse error: ${e.message}`));
        }
      });
    });
    req.on('timeout', () => { req.destroy(new Error('Google Translate request timed out')); });
    req.on('error', reject);
  });
}

/**
 * Translate text via Google Translate public endpoint.
 */
export async function googleTranslate(text, from, to) {
  if (!text || typeof text !== 'string') {
    throw new Error('text is required');
  }
  const sl = from === 'auto' || !from ? 'auto' : from;
  const tl = to || 'en';

  const url = `https://${ENDPOINT_HOST}${ENDPOINT_PATH}?client=gtx&sl=${encodeURIComponent(sl)}&tl=${encodeURIComponent(tl)}&dt=t&q=${encodeURIComponent(text)}`;

  let data;
  try {
    data = await httpsGetJson(url, DEFAULT_TIMEOUT_MS);
  } catch (e) {
    throw new Error(`Google Translate network error: ${e.message}`);
  }

  if (!Array.isArray(data) || !Array.isArray(data[0])) {
    throw new Error('Google Translate returned unexpected response shape');
  }

  let translated = '';
  for (const seg of data[0]) {
    if (seg && typeof seg[0] === 'string') {
      translated += seg[0];
    }
  }

  if (!translated) {
    throw new Error('Google Translate returned empty translation');
  }

  let detectedSourceLang = sl === 'auto' && typeof data[2] === 'string' ? data[2] : undefined;

  const CJK_RE = /[\u4e00-\u9fff\u3400-\u4dbf]/;
  if ((tl === 'zh' || tl === 'zh-CN' || tl === 'zh-TW') && !CJK_RE.test(translated) && sl === 'auto') {
    try {
      const rurl = `https://${ENDPOINT_HOST}${ENDPOINT_PATH}?client=gtx&sl=en&tl=${encodeURIComponent(tl)}&dt=t&q=${encodeURIComponent(text)}`;
      const rd = await httpsGetJson(rurl, DEFAULT_TIMEOUT_MS);
      if (Array.isArray(rd) && Array.isArray(rd[0])) {
        let rt = "";
        for (const s of rd[0]) if (s && typeof s[0] === 'string') rt += s[0];
        if (rt && CJK_RE.test(rt)) {
          console.log("[GoogleTranslate] lang-misdetect fallback: retried with sl=en ->", rt.slice(0,40));
          translated = rt;
          detectedSourceLang = 'en';
        }
      }
    } catch(_) {}
  }

  if ((tl === 'zh' || tl === 'zh-CN') &&
      (detectedSourceLang === 'en' || sl === 'en') &&
      !/\?/.test(text.trim()) &&
      /[？?]$/.test(translated.trim()) &&
      !text.trim().match(/^(what|why|how|when|where|who|do you|does|is |are |can |could|would|will|have you|has|did|is it|are you|am i)/i)) {
    console.log(`[GoogleTranslate] statement->question suspect: "${text.slice(0,50)}" -> "${translated.slice(0,40)}"`);
  }

  return { translated, detectedSourceLang };
}

export async function googleDetect(text) {
  const { detectedSourceLang } = await googleTranslate(text, 'auto', 'en');
  if (!detectedSourceLang) {
    throw new Error('Google Translate did not return detected language');
  }
  return detectedSourceLang;
}
