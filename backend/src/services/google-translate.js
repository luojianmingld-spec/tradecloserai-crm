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

// ── 拼写纠错预处理（修复常见 typo 后再翻译）──
const TYPO_CONTEXT_MAP = {
  // [typo, 需要此上下文才纠正, 正确词]
  'tanks':  { ctx: ['for'], correct: 'thanks' },
  'wanna':  { ctx: null, correct: 'want to' },
  'gonna':  { ctx: null, correct: 'going to' },
  'dunno':  { ctx: null, correct: "don't know" },
  'gotta':  { ctx: null, correct: 'got to' },
  'kinda':  { ctx: null, correct: 'kind of' },
  'sorta':  { ctx: null, correct: 'sort of' },
  'lemme':  { ctx: null, correct: 'let me' },
  'gimme':  { ctx: null, correct: 'give me' },
  'cos':    { ctx: ['i', 'we', 'it', 'he', 'she', 'that', 'the', 'is', 'was'], correct: 'because' },
  'coz':    { ctx: ['i', 'we', 'it', 'he', 'she', 'that', 'the', 'is', 'was'], correct: 'because' },
  'cuz':    { ctx: ['i', 'we', 'it', 'he', 'she', 'that', 'the', 'is', 'was'], correct: 'because' },
  'nite':   { ctx: null, correct: 'night' },
  'pls':    { ctx: null, correct: 'please' },
  'plz':    { ctx: null, correct: 'please' },
  'thx':    { ctx: null, correct: 'thanks' },
  'ty':     { ctx: ['so', 'very', 'thank'], correct: 'thank you' },
  'u':      { ctx: null, correct: 'you' },
  'ur':     { ctx: null, correct: 'your' },
  'r':      { ctx: ['u', 'you', 'we', 'they'], correct: 'are' },
  'cant':   { ctx: null, correct: "can't" },
  'dont':   { ctx: null, correct: "don't" },
  'wont':   { ctx: null, correct: "won't" },
  'didnt':  { ctx: null, correct: "didn't" },
  'doesnt': { ctx: null, correct: "doesn't" },
  'wasnt':  { ctx: null, correct: "wasn't" },
  'isnt':   { ctx: null, correct: "isn't" },
  'wouldnt':{ ctx: null, correct: "wouldn't" },
  'shouldnt':{ ctx: null, correct: "shouldn't" },
  'couldnt':{ ctx: null, correct: "couldn't" },
  'ive':    { ctx: null, correct: "I've" },
  'youve':  { ctx: null, correct: "you've" },
  'theyve': { ctx: null, correct: "they've" },
  'im':     { ctx: null, correct: "I'm" },
  'youre':  { ctx: null, correct: "you're" },
  'theyre': { ctx: null, correct: "they're" },
  'weve':   { ctx: null, correct: "we've" },
};

// 纯拼写错误（无需上下文）
const SIMPLE_TYPOS = {
  'teh': 'the', 'recieve': 'receive', 'occured': 'occurred',
  'seperate': 'separate', 'definately': 'definitely', 'accomodate': 'accommodate',
  'acheive': 'achieve', 'beleive': 'believe', 'comming': 'coming',
  'happend': 'happened', 'untill': 'until', 'wich': 'which',
  'wierd': 'weird', 'truely': 'truly', 'realyl': 'really',
  'realy': 'really', 'alot': 'a lot', 'beacuse': 'because',
  'becuase': 'because', 'becaus': 'because', 'becouse': 'because',
  'tommorow': 'tomorrow', 'tommorrow': 'tomorrow', 'tomorow': 'tomorrow',
  'yestarday': 'yesterday', 'yeserday': 'yesterday',
  'todya': 'today', 'todya': 'today',
  'hapen': 'happen', 'happend': 'happened',
  'noice': 'nice', 'defintely': 'definitely',
};

export function spellCorrect(text) {
  if (!text || typeof text !== 'string') return text;
  // 跳过非拉丁文本（中文、阿拉伯文等）
  if (!/[a-zA-Z]/.test(text)) return text;
  
  const words = text.split(/(\s+)/);
  const corrected = words.map((token, i) => {
    // 跳过空白
    if (/^\s+$/.test(token)) return token;
    
    const lower = token.toLowerCase();
    const clean = lower.replace(/[^a-z']/g, '');
    
    // 1. "tanks" 特殊处理：区分 "thanks" vs 真正的水箱
    if (clean === 'tanks') {
      let prevWord = '';
      for (let j = i - 1; j >= 0; j--) {
        const w = words[j].toLowerCase().replace(/[^a-z]/g, '');
        if (w) { prevWord = w; break; }
      }
      const LITERAL_MODIFIERS = ['fuel','water','gas','oil','propane','storage','septic','fish','pressure','hydraulic','chemical','heat','cooling','air','liquid','waste','sewage','holding','fresh','black','grey','glass','stainless','steel','plastic','metal','concrete','cement','underground','overground','above'];
      if (LITERAL_MODIFIERS.includes(prevWord)) return token;
      let nextWord = '';
      for (let j = i + 1; j < words.length; j++) {
        const w = words[j].toLowerCase().replace(/[^a-z]/g, '');
        if (w) { nextWord = w; break; }
      }
      if (nextWord === 'for' || nextWord === 'you' || prevWord === 'you' || prevWord === 'thank') {
        return token.replace(/tanks/i, 'thanks');
      }
      return token;
    }

    // 2. 上下文敏感纠正
    if (TYPO_CONTEXT_MAP[clean]) {
      const entry = TYPO_CONTEXT_MAP[clean];
      if (entry.ctx === null) {
        return token.replace(new RegExp(clean, 'i'), entry.correct);
      }
      let prevWord = '', nextWord = '';
      for (let j = i - 1; j >= 0; j--) {
        const w = words[j].toLowerCase().replace(/[^a-z]/g, '');
        if (w) { prevWord = w; break; }
      }
      for (let j = i + 1; j < words.length; j++) {
        const w = words[j].toLowerCase().replace(/[^a-z]/g, '');
        if (w) { nextWord = w; break; }
      }
      const contextWords = [prevWord, nextWord];
      const hasContext = entry.ctx.some(ctx => contextWords.some(cw => cw === ctx));
      if (hasContext) {
        return token.replace(new RegExp(clean, 'i'), entry.correct);
      }
    }
    
    // 2. 简单拼写纠正
    if (SIMPLE_TYPOS[clean]) {
      return token.replace(new RegExp(clean, 'i'), SIMPLE_TYPOS[clean]);
    }
    
    return token;
  });
  
  return corrected.join('');
}

export async function googleTranslate(text, from, to) {
  if (!text || typeof text !== 'string') {
    throw new Error('text is required');
  }
  // 英文文本先做拼写纠错
  const isEnglish = /^[\x00-\x7F]+$/.test(text.trim());
  const correctedText = isEnglish ? spellCorrect(text) : text;
  if (isEnglish && correctedText !== text) {
    console.log('[GoogleTranslate] spell-corrected:', text.slice(0,30), '->', correctedText.slice(0,30));
  }
  const sl = from === 'auto' || !from ? 'auto' : from;
  const tl = to || 'en';

  const url = `https://${ENDPOINT_HOST}${ENDPOINT_PATH}?client=gtx&sl=${encodeURIComponent(sl)}&tl=${encodeURIComponent(tl)}&dt=t&q=${encodeURIComponent(correctedText || text)}`;

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
      const rurl = `https://${ENDPOINT_HOST}${ENDPOINT_PATH}?client=gtx&sl=en&tl=${encodeURIComponent(tl)}&dt=t&q=${encodeURIComponent(correctedText || text)}`;
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
