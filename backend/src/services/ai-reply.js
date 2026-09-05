import { PrismaClient } from '@prisma/client';
import { chatComplete } from './ai-client.js';
import { getTranslationSettings } from './translation.js';

const prisma = new PrismaClient();

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

function normalizeJid(jid) {
  if (!jid) return jid;
  if (!jid.includes('@')) return jid.replace(/\D/g, '') + '@s.whatsapp.net';
  return jid;
}

export async function generateReply({ userId, conversationId, accountId, jid, style = 'formal', messages: inputMessages }) {
  let messages;
  if (inputMessages && Array.isArray(inputMessages) && inputMessages.length > 0) {
    messages = inputMessages.map(m => ({
      fromMe: !!m.fromMe,
      content: m.content || m.body || '',
      translation: m.translation || null,
      sourceLang: m.sourceLang || null,
      timestamp: m.timestamp || new Date(),
    }));
  } else {
    const effectiveUserId = accountId || userId;
    const targetJid = normalizeJid(jid);
    if (!targetJid) return { replies: [], error: '缺少会话ID' };
    const sessionId = 'user_' + effectiveUserId;
    messages = await getRecentMessages(sessionId, targetJid, 20);
  }

  if (!messages || messages.length === 0) return { replies: [], error: '暂无消息记录，无法生成回复' };

  const customerLang = detectCustomerLanguage(messages);
  const stylePrompt = STYLE_PROMPTS[style] || STYLE_PROMPTS.formal;
  const contextStr = buildConversationContext(messages);

  const systemPrompt = `${stylePrompt}

你是一位外贸销售助理，根据对话上下文生成3个可直接发送的回复建议。

要求：
1. 每个回复必须是完整的、可以直接发送的消息
2. 回复要针对客户最新消息的内容，有针对性地回应
3. 3个回复各有侧重（如：直接回应、延伸话题、促成行动）
4. foreign 字段必须使用客户的语言（${customerLang || '英语'}），不能用中文
5. zh 字段是 foreign 对应的中文翻译，用于销售预览
6. 回复要自然流畅，不要生硬或模板化
7. 每个回复长度控制在1-3句话

请严格按以下JSON格式返回（纯JSON，不要加markdown代码块，不要加其他内容）：
{"replies": [{"foreign":"客户语言回复1","zh":"中文翻译1"},{"foreign":"客户语言回复2","zh":"中文翻译2"},{"foreign":"客户语言回复3","zh":"中文翻译3"}]}`;

  try {
    const response = await chatComplete(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `最近对话上下文（对方=客户，我方=销售）：\n${contextStr}\n\n请生成3个回复建议，严格按JSON格式返回。` },
      ],
      { temperature: 0.8, creditUserId: effectiveUserId } // 【积分铁律 2026-09-05】按 effectiveUserId 扣
    );
    const content = (response || '').trim();
    const replies = parseReplies(content);
    return { replies, style };
  } catch (err) {
    console.error('[AI Reply] Generation error:', err);
    return { replies: [], error: 'AI回复生成失败，请检查AI模型配置：' + err.message };
  }
}

async function getRecentMessages(sessionId, jid, limit = 20) {
  const phone = jid.split('@')[0];
  const bareJid = phone + '@s.whatsapp.net';
  const lidJid = phone + '@lid';
  try {
    const msgs = await prisma.wAMessage.findMany({
      where: {
        sessionId,
        OR: [
          { from: jid, direction: 'inbound' },
          { to: jid, direction: 'outbound' },
          { from: bareJid, direction: 'inbound' },
          { to: bareJid, direction: 'outbound' },
          { from: lidJid, direction: 'inbound' },
          { to: lidJid, direction: 'outbound' },
        ],
      },
      orderBy: { timestamp: 'desc' },
      take: limit,
      select: {
        body: true,
        translation: true,
        sourceLang: true,
        direction: true,
        timestamp: true,
      },
    });
    return msgs.reverse().map(m => ({
      fromMe: m.direction === 'outbound',
      content: m.body || '',
      translation: m.translation || null,
      sourceLang: m.sourceLang || null,
      timestamp: m.timestamp,
    }));
  } catch (e) {
    console.error('[AI Reply] DB query error:', e.message);
    return [];
  }
}

function buildConversationContext(messages) {
  const lines = messages.map((msg) => {
    const sender = msg.fromMe ? '我方' : '客户';
    const time = new Date(msg.timestamp).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    let text = msg.content || '';
    if (!msg.fromMe && msg.translation) {
      let trans = msg.translation;
      if (typeof trans === 'string') {
        try { trans = JSON.parse(trans); } catch(_) {}
      }
      if (typeof trans === 'object' && trans.translated && trans.translated !== text) {
        text = `${text}（翻译：${trans.translated}）`;
      } else if (typeof trans === 'string' && trans && trans !== text) {
        text = `${text}（翻译：${trans}）`;
      }
    }
    return `[${time}] ${sender}: ${text}`;
  });
  return lines.join('\n');
}

function detectCustomerLanguage(messages) {
  const customerMsgs = messages.filter(m => !m.fromMe).slice(-5);
  if (customerMsgs.length === 0) return 'en';
  const langs = customerMsgs.map(m => m.sourceLang).filter(Boolean);
  if (langs.length > 0) {
    const counts = {};
    langs.forEach(l => { counts[l] = (counts[l] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  }
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

function parseReplies(content) {
  if (!content) return [];
  try {
    let jsonStr = content;
    const fenceMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) jsonStr = fenceMatch[1].trim();
    const parsed = JSON.parse(jsonStr);
    const arr = Array.isArray(parsed) ? parsed : parsed.replies;
    if (Array.isArray(arr)) {
      return arr.map(r => {
        if (r && typeof r === 'object') {
          return { foreign: String(r.foreign || '').trim(), zh: String(r.zh || '').trim() };
        }
        const t = String(r || '').trim();
        return t ? { foreign: t, zh: '' } : null;
      }).filter(Boolean).slice(0, 3);
    }
  } catch (e) {}

  const lines = content.split('\n').filter(l => l.trim());
  const replies = [];
  for (const line of lines) {
    const cleaned = line.replace(/^\d+[\.、)）]\s*/, '').replace(/^回复\d+[：:]\s*/, '').replace(/^[-*•]\s*/, '').trim();
    if (cleaned && cleaned.length > 5) replies.push({ foreign: cleaned, zh: '' });
  }
  return replies.slice(0, 3);
}
