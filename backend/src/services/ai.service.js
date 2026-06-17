/**
 * AI Service — 统一封装豆包/DeepSeek LLM 调用
 * 
 * 所有 AI 功能（翻译、话术生成、需求总结）共用此 service，
 * 通过 coze-coding-dev-sdk 的 LLMClient 调用模型。
 * 
 * 模型选择通过 settings 表配置，key:
 *   - aiModel: 模型 ID（默认 doubao-seed-2-0-pro-260215）
 *   - translationEngine: 翻译引擎 (doubao/deepseek)
 *   - translationTargetLang: 翻译目标语言
 *   - translationEnabled: 是否开启自动翻译
 */
import { LLMClient, Config } from 'coze-coding-dev-sdk';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ─── Model registry ───
const MODEL_MAP = {
  'doubao-pro': 'doubao-seed-2-0-pro-260215',
  'doubao-lite': 'doubao-seed-2-0-lite-260215',
  'doubao-mini': 'doubao-seed-2-0-mini-260215',
  'deepseek': 'deepseek-v3-2-251201',
  'kimi': 'kimi-k2-5-260127',
};

const DEFAULT_MODEL_KEY = 'doubao-pro';

// ─── Default settings ───
const DEFAULT_SETTINGS = {
  aiModel: DEFAULT_MODEL_KEY,
  translationEnabled: 'true',
  translationEngine: 'doubao',
  translationTargetLang: 'auto',
  translationAutoSend: 'false',
};

// ─── In-memory translation cache ───
const memoryCache = new Map();

// ─── Helper: get settings ───
export async function getAISettings(userId) {
  const settings = await prisma.setting.findMany({ where: { userId } });
  const map = {};
  for (const s of settings) map[s.key] = s.value;
  return { ...DEFAULT_SETTINGS, ...map };
}

// ─── Helper: update setting ───
export async function updateSetting(userId, key, value) {
  return prisma.setting.upsert({
    where: { userId_key: { userId, key } },
    create: { userId, key, value: String(value) },
    update: { value: String(value) },
  });
}

// ─── Helper: batch update ───
export async function updateSettings(userId, obj) {
  const ops = Object.entries(obj).map(([key, value]) =>
    prisma.setting.upsert({
      where: { userId_key: { userId, key } },
      create: { userId, key, value: String(value) },
      update: { value: String(value) },
    })
  );
  await Promise.all(ops);
}

// ─── Helper: resolve model ID from settings ───
function resolveModelId(settings, engineOverride) {
  if (engineOverride && MODEL_MAP[engineOverride]) return MODEL_MAP[engineOverride];
  const modelKey = settings.aiModel || DEFAULT_MODEL_KEY;
  if (MODEL_MAP[modelKey]) return MODEL_MAP[modelKey];
  // If the key itself looks like a model ID (contains hyphens/digits), return as-is
  return modelKey;
}

// ─── Helper: create LLM client ───
function createLLM() {
  const config = new Config();
  return new LLMClient(config);
}

// ─── Core: generic chat completion ───
async function chatComplete(modelId, systemPrompt, userPrompt, options = {}) {
  const client = createLLM();
  const messages = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: userPrompt });

  const resp = await client.invoke(messages, {
    model: modelId,
    temperature: options.temperature ?? 0.7,
  });

  return resp.content || '';
}

// ═══════════════════════════════════════════
// 1. TRANSLATION
// ═══════════════════════════════════════════

const LANGUAGE_NAMES = {
  en: '英语', zh: '中文', ja: '日语', ko: '韩语', es: '西班牙语',
  fr: '法语', de: '德语', pt: '葡萄牙语', ru: '俄语', ar: '阿拉伯语',
  hi: '印地语', it: '意大利语', th: '泰语', vi: '越南语', id: '印尼语',
};

/**
 * Detect language of text
 */
export async function detectLanguage(text, engine = 'doubao') {
  // Fast character-pattern detection first
  const hasCJK = /[\u4e00-\u9fff]/.test(text);
  const hasArabic = /[\u0600-\u06ff]/.test(text);
  const hasCyrillic = /[\u0400-\u04ff]/.test(text);
  const hasJapanese = /[\u3040-\u309f\u30a0-\u30ff]/.test(text);
  const hasKorean = /[\uac00-\ud7af]/.test(text);

  if (hasJapanese) return 'ja';
  if (hasKorean) return 'ko';
  if (hasCJK) return 'zh';
  if (hasArabic) return 'ar';
  if (hasCyrillic) return 'ru';

  // For ambiguous text, use LLM
  try {
    const modelId = resolveModelId({ aiModel: engine === 'deepseek' ? 'deepseek' : DEFAULT_MODEL_KEY });
    const result = await chatComplete(modelId, 
      'You are a language detector. Reply with ONLY the ISO 639-1 language code (2 letters). No explanation.',
      text,
      { temperature: 0.1, maxTokens: 10 }
    );
    const code = result.trim().toLowerCase().substring(0, 2);
    if (/^[a-z]{2}$/.test(code)) return code;
  } catch (e) {
    console.error('[AI Service] Language detection fallback:', e.message);
  }
  return 'en';
}

/**
 * Translate text
 */
export async function translateText(text, sourceLang, targetLang, engine, userId) {
  const settings = await getAISettings(userId);
  const effectiveEngine = engine || settings.translationEngine || 'doubao';
  const effectiveTarget = targetLang === 'auto' ? 'zh' : (targetLang || 'zh');

  // Check cache
  const cacheKey = `${text}|${sourceLang}|${effectiveTarget}|${effectiveEngine}`;
  if (memoryCache.has(cacheKey)) {
    return { translated: memoryCache.get(cacheKey), sourceLang, targetLang: effectiveTarget, cached: true };
  }

  // Check DB cache
  const dbCache = await prisma.translationCache.findUnique({
    where: { sourceText_sourceLang_targetLang_engine: { sourceText: text, sourceLang, targetLang: effectiveTarget, engine: effectiveEngine } },
  });
  if (dbCache) {
    memoryCache.set(cacheKey, dbCache.translated);
    return { translated: dbCache.translated, sourceLang, targetLang: effectiveTarget, cached: true };
  }

  // Call LLM
  const modelId = resolveModelId(settings, effectiveEngine === 'deepseek' ? 'deepseek' : undefined);
  const srcName = LANGUAGE_NAMES[sourceLang] || sourceLang;
  const tgtName = LANGUAGE_NAMES[effectiveTarget] || effectiveTarget;

  const systemPrompt = `你是一个专业翻译引擎。将用户输入的文本从${srcName}翻译为${tgtName}。
规则：
1. 只输出翻译结果，不输出任何解释
2. 保持原文的语气和格式
3. 专业术语翻译准确
4. 如果源语言和目标语言相同，原样返回`;

  const translated = await chatComplete(modelId, systemPrompt, text, { temperature: 0.3, maxTokens: 1024 });
  const trimmed = translated.trim();

  // Save to cache
  memoryCache.set(cacheKey, trimmed);
  try {
    await prisma.translationCache.upsert({
      where: { sourceText_sourceLang_targetLang_engine: { sourceText: text, sourceLang, targetLang: effectiveTarget, engine: effectiveEngine } },
      create: { sourceText: text, sourceLang, targetLang: effectiveTarget, engine: effectiveEngine, translated: trimmed },
      update: { translated: trimmed },
    });
  } catch (e) {
    console.error('[AI Service] Cache save error:', e.message);
  }

  return { translated: trimmed, sourceLang, targetLang: effectiveTarget, cached: false };
}

/**
 * Translate outgoing message (Chinese → contact's language)
 */
export async function translateOutgoing(text, contactLang, userId) {
  const targetLang = contactLang || 'en';
  return translateText(text, 'zh', targetLang, 'doubao', userId);
}

// ═══════════════════════════════════════════
// 2. AI REPLY GENERATION
// ═══════════════════════════════════════════

const STYLE_PROMPTS = {
  formal: `你是一位专业的外贸销售，擅长用正式商务风格与海外客户沟通。
要求：
- 使用正式、礼貌的商务用语
- 表达专业、严谨，体现公司实力
- 适当使用敬语和商务术语
- 回复结构清晰，逻辑性强`,

  friendly: `你是一位亲切的外贸销售，擅长用友好热情的风格与海外客户沟通。
要求：
- 语气热情友好，像朋友一样交流
- 适当使用感叹号增强亲和力
- 表达自然流畅，避免过于生硬
- 让客户感到被重视和关心`,

  concise: `你是一位高效的外贸销售，擅长用简洁明了的风格与海外客户沟通。
要求：
- 回复简短有力，直击要点
- 不说废话，信息密度高
- 用最少的文字传达最关键的信息
- 适合快节奏的商务沟通`,
};

async function getRecentMessages(accountId, jid, limit = 20) {
  return prisma.message.findMany({
    where: { accountId, remoteJid: jid },
    orderBy: { timestamp: 'desc' },
    take: limit,
  });
}

async function getContactInfo(accountId, jid) {
  return prisma.contact.findUnique({
    where: { accountId_jid: { accountId, jid } },
  });
}

function buildConversationContext(messages, contact) {
  const contactInfo = contact ? `客户: ${contact.name || '未知'}, 国家: ${contact.country || '未知'}, 语言: ${contact.language || '未知'}` : '';
  const msgLines = messages.reverse().map(m => {
    const role = m.fromMe ? '我方' : '客户';
    const time = new Date(m.timestamp).toLocaleString('zh-CN');
    return `[${time}] ${role}: ${m.content}`;
  });
  return contactInfo + '\n\n' + msgLines.join('\n');
}

/**
 * Generate AI reply options
 */
export async function generateReply({ userId, accountId, jid, style = 'formal', messages: directMessages }) {
  // Support direct messages array OR fetch from DB
  let messages = directMessages || [];
  if (messages.length === 0 && accountId && jid) {
    messages = await getRecentMessages(accountId, jid, 20);
  }
  if (messages.length === 0) {
    return { replies: [], error: '暂无消息记录，无法生成回复' };
  }

  const contact = (accountId && jid) ? await getContactInfo(accountId, jid) : null;
  const settings = await getAISettings(userId);
  const modelId = resolveModelId(settings);
  const contextStr = buildConversationContext(messages, contact);
  const stylePrompt = STYLE_PROMPTS[style] || STYLE_PROMPTS.formal;

  const systemPrompt = `${stylePrompt}

根据以下对话历史，生成3个不同的回复选项。每个回复用数字编号(1/2/3)开头，每个回复之间用"---"分隔。
回复应直接可发送，不需要额外解释。
用客户的语言回复（如果客户用英文，用英文回复；如果用中文，用中文回复）。`;

  const result = await chatComplete(modelId, systemPrompt, contextStr, { temperature: 0.8, maxTokens: 1024 });

  // Parse replies
  const replies = result
    .split(/---|\n[123][.、)）]\s*/)
    .map(s => s.trim())
    .filter(s => s.length > 5);

  return { replies, engine: settings.aiModel, style };
}

// ═══════════════════════════════════════════
// 3. NEED SUMMARIZATION
// ═══════════════════════════════════════════

const EMPTY_SUMMARY = {
  products: '',
  quantity: '',
  priceSensitivity: '',
  deliveryRequirements: '',
  keyConcerns: '',
  customerStyle: '',
  nextActions: '',
  intentionScore: 0,
};

/**
 * Generate customer need summary
 */
export async function summarizeNeed({ userId, accountId, jid, messages: directMessages }) {
  // Support direct messages array OR fetch from DB
  let messages = directMessages || [];
  if (messages.length === 0 && accountId && jid) {
    messages = await getRecentMessages(accountId, jid, 30);
  }
  if (messages.length === 0) {
    return { summary: EMPTY_SUMMARY, error: '暂无消息记录，无法生成需求总结' };
  }

  const contact = (accountId && jid) ? await getContactInfo(accountId, jid) : null;
  const settings = await getAISettings(userId);
  const modelId = resolveModelId(settings);
  const contextStr = buildConversationContext(messages, contact);

  const systemPrompt = `你是一位资深的外贸业务分析师，擅长从客户沟通记录中提炼关键需求信息。

当前客户信息：
${contact ? `姓名: ${contact.name || '未知'}, 国家: ${contact.country || '未知'}, 语言: ${contact.language || '未知'}` : '未知'}

请分析以下对话记录，提取8个维度的客户需求信息，严格按以下JSON格式返回（不要返回其他内容）：

{
  "products": "意向产品（客户提到的产品名称、型号、规格）",
  "quantity": "需求规模（数量、频次、持续性）",
  "priceSensitivity": "价格敏感度（高/中/低，以及对价格的表态）",
  "deliveryRequirements": "交付要求（交货时间、物流方式、包装要求）",
  "keyConcerns": "核心关注点（质量、认证、售后、付款方式等）",
  "customerStyle": "客户风格（决策快慢、沟通偏好、专业程度）",
  "nextActions": "下一步行动建议（具体可执行的跟进步骤）",
  "intentionScore": 5
}

intentionScore 为意向度评分，1-10分（1=极低, 10=极高）。
仅返回JSON，不要包含任何其他文字。`;

  const result = await chatComplete(modelId, systemPrompt, contextStr, { temperature: 0.3, maxTokens: 1024 });

  // Parse JSON from result
  try {
    // Try to extract JSON from the response
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        summary: {
          products: parsed.products || '',
          quantity: parsed.quantity || '',
          priceSensitivity: parsed.priceSensitivity || '',
          deliveryRequirements: parsed.deliveryRequirements || '',
          keyConcerns: parsed.keyConcerns || '',
          customerStyle: parsed.customerStyle || '',
          nextActions: parsed.nextActions || '',
          intentionScore: parseInt(parsed.intentionScore) || 0,
        },
        engine: settings.aiModel,
      };
    }
  } catch (e) {
    console.error('[AI Service] JSON parse error:', e.message);
  }

  return { summary: EMPTY_SUMMARY, engine: settings.aiModel, rawResult: result };
}

// ─── Export model list for settings UI ───
export function getAvailableModels() {
  return Object.entries(MODEL_MAP).map(([key, id]) => ({
    key,
    id,
    name: key.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
  }));
}
