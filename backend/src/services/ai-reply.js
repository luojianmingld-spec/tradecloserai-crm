import { LLMClient, Config } from 'coze-coding-dev-sdk';
import { PrismaClient } from '@prisma/client';
import { getTranslationSettings } from './translation.js';

const prisma = new PrismaClient();

// Model mapping (shared with translation)
const ENGINE_MODELS = {
  doubao: 'doubao-seed-2-0-lite-260215',
  deepseek: 'deepseek-v3-2-251201',
};

// Style prompt snippets
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
- 适当使用感叹号和积极表情增强亲和力
- 表达自然流畅，避免过于生硬
- 让客户感到被重视和关心`,

  concise: `你是一位高效的外贸销售，擅长用简洁明了的风格与海外客户沟通。
要求：
- 回复简短有力，直击要点
- 不说废话，信息密度高
- 用最少的文字传达最关键的信息
- 适合快节奏的商务沟通`,
};

/**
 * Generate AI reply options based on conversation context
 */
export async function generateReply({ userId, conversationId, accountId, jid, style = 'formal' }) {
  // 1. Get recent messages for context (last 20)
  const messages = await getRecentMessages(accountId, jid, 20);

  if (messages.length === 0) {
    return { replies: [], error: '暂无消息记录，无法生成回复' };
  }

  // 2. Get contact info for context
  const contact = await getContactInfo(accountId, jid);

  // 3. Get translation settings for engine selection
  const settings = await getTranslationSettings(userId);
  const engine = settings.translationEngine || 'doubao';
  const model = ENGINE_MODELS[engine] || ENGINE_MODELS.doubao;

  // 4. Build conversation context
  const contextStr = buildConversationContext(messages, contact);

  // 5. Build system prompt
  const stylePrompt = STYLE_PROMPTS[style] || STYLE_PROMPTS.formal;
  const customerLang = detectCustomerLanguage(messages);

  const systemPrompt = `${stylePrompt}

当前客户信息：
${contact ? `- 客户名称：${contact.name || '未知'}
- 国家/地区：${contact.country || '未知'}
- 客户语言：${contact.language || customerLang || '未知'}
- 标签：${contact.tags || '无'}
- 备注：${contact.notes || '无'}` : '- 暂无客户信息'}

请根据以下对话上下文，生成3个不同角度的回复选项。

要求：
1. 每个回复必须是一个完整的、可以直接发送的消息
2. 回复要针对客户最新消息的内容，有针对性地回应
3. 3个回复要各有侧重（如：直接回应、延伸话题、促成行动）
4. 回复语言应与客户使用的语言一致（${customerLang || '英语'}）
5. 回复要自然流畅，不要生硬或模板化
6. 不要在回复前加序号或"回复一"等标记

请严格按以下JSON格式返回，不要返回其他内容：
{"replies": ["回复1", "回复2", "回复3"]}`;

  // 6. Call LLM
  try {
    const config = new Config();
    const client = new LLMClient(config);

    const response = await client.invoke(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `对话上下文：\n${contextStr}\n\n请生成3个回复选项。` },
      ],
      { model, temperature: 0.8 }
    );

    // 7. Parse response
    const content = response.content.trim();
    const replies = parseReplies(content);

    return { replies, engine, style };
  } catch (err) {
    console.error('[AI Reply] Generation error:', err);
    return { replies: [], error: 'AI回复生成失败，请检查API配置' };
  }
}

/**
 * Get recent messages for conversation context
 */
async function getRecentMessages(accountId, jid, limit = 20) {
  const messages = await prisma.message.findMany({
    where: { accountId, jid },
    orderBy: { timestamp: 'desc' },
    take: limit,
  });

  // Return in chronological order
  return messages.reverse();
}

/**
 * Get contact info for context enrichment
 */
async function getContactInfo(accountId, jid) {
  return prisma.contact.findFirst({
    where: { accountId, jid },
  });
}

/**
 * Build conversation context string from messages
 */
function buildConversationContext(messages, contact) {
  const lines = messages.map((msg) => {
    const sender = msg.fromMe ? '我方' : (contact?.name || '客户');
    const time = new Date(msg.timestamp).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
    // Use original content, show translation if available for context
    let text = msg.content || '';
    if (!msg.fromMe && msg.translation) {
      text = `${msg.content}（翻译：${msg.translation}）`;
    }
    return `[${time}] ${sender}: ${text}`;
  });

  return lines.join('\n');
}

/**
 * Detect the language the customer is using based on messages
 */
function detectCustomerLanguage(messages) {
  // Look at the last few non-self messages
  const customerMsgs = messages.filter(m => !m.fromMe).slice(-5);
  if (customerMsgs.length === 0) return 'en';

  // Check sourceLang from messages
  const langs = customerMsgs
    .map(m => m.sourceLang)
    .filter(Boolean);

  if (langs.length > 0) {
    // Return the most common language
    const counts = {};
    langs.forEach(l => { counts[l] = (counts[l] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  }

  // Quick detect from content
  const text = customerMsgs.map(m => m.content).join(' ');
  if (/[\u4e00-\u9fff]/.test(text)) return 'zh';
  if (/[\u3040-\u309f\u30a0-\u30ff]/.test(text)) return 'ja';
  if (/[\uac00-\ud7af]/.test(text)) return 'ko';
  if (/[\u0600-\u06ff]/.test(text)) return 'ar';
  if (/[\u0400-\u04ff]/.test(text)) return 'ru';
  if (/\b(der|die|das|und|ist|ich)\b/i.test(text)) return 'de';
  if (/\b(el|la|los|las|de|en|que)\b/i.test(text)) return 'es';
  if (/\b(le|la|les|de|des|du|est)\b/i.test(text)) return 'fr';

  return 'en';
}

/**
 * Parse LLM response into reply array
 */
function parseReplies(content) {
  // Try JSON parse first
  try {
    // Extract JSON from response (may be wrapped in markdown code block)
    let jsonStr = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    const parsed = JSON.parse(jsonStr);
    if (Array.isArray(parsed.replies)) {
      return parsed.replies.filter(r => typeof r === 'string' && r.trim());
    }
    if (Array.isArray(parsed)) {
      return parsed.filter(r => typeof r === 'string' && r.trim());
    }
  } catch (e) {
    // Not valid JSON, try other formats
  }

  // Try to split by numbered lines
  const lines = content.split('\n').filter(l => l.trim());
  const replies = [];
  for (const line of lines) {
    // Remove leading numbers like "1.", "1)", "回复1：", etc.
    const cleaned = line
      .replace(/^\d+[\.\)、]\s*/, '')
      .replace(/^回复\d+[：:]\s*/, '')
      .replace(/^["""']|["""']$/g, '')
      .trim();
    if (cleaned && cleaned.length > 5) {
      replies.push(cleaned);
    }
  }

  return replies.slice(0, 3);
}
