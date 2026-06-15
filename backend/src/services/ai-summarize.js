import { LLMClient, Config } from 'coze-coding-dev-sdk';
import { PrismaClient } from '@prisma/client';
import { getTranslationSettings } from './translation.js';

const prisma = new PrismaClient();

// Model mapping (shared with translation & ai-reply)
const ENGINE_MODELS = {
  doubao: 'doubao-seed-2-0-lite-260215',
  deepseek: 'deepseek-v3-2-251201',
};

// Default empty summary structure
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
 * Generate customer need summary based on conversation history
 */
export async function summarizeNeed({ userId, accountId, jid }) {
  // 1. Get recent messages (last 30)
  const messages = await getRecentMessages(accountId, jid, 30);

  if (messages.length === 0) {
    return { summary: EMPTY_SUMMARY, error: '暂无消息记录，无法生成需求总结' };
  }

  // 2. Get contact info
  const contact = await getContactInfo(accountId, jid);

  // 3. Get translation settings for engine selection
  const settings = await getTranslationSettings(userId);
  const engine = settings.translationEngine || 'doubao';
  const model = ENGINE_MODELS[engine] || ENGINE_MODELS.doubao;

  // 4. Build conversation context
  const contextStr = buildConversationContext(messages, contact);

  // 5. Build system prompt
  const systemPrompt = `你是一位资深的外贸业务分析师，擅长从客户沟通记录中提炼关键需求信息。

当前客户信息：
${contact ? `- 客户名称：${contact.name || '未知'}
- 国家/地区：${contact.country || '未知'}
- 客户语言：${contact.language || '未知'}
- 标签：${contact.tags || '无'}
- 备注：${contact.notes || '无'}` : '- 暂无客户信息'}

请根据以下对话记录，对客户需求进行全面分析总结。

要求：
1. 从对话中提取客观信息，不要编造
2. 如果某个维度信息不足，写"暂无明确信息"
3. 意向度评分基于：需求明确度、采购紧迫性、价格讨论深度、合作意愿
4. 下一步行动建议要具体可执行
5. 所有内容用中文输出

请严格按以下JSON格式返回，不要返回其他内容：
{
  "products": "客户意向的产品/服务（具体品类和型号，如有提及）",
  "quantity": "需求数量/规模（具体数字或范围，如有提及）",
  "priceSensitivity": "价格预算/敏感度（高/中/低，及具体预算范围，如有提及）",
  "deliveryRequirements": "交付时间要求（具体时间节点，如有提及）",
  "keyConcerns": "核心关注点/痛点（客户最关心的问题列表）",
  "customerStyle": "客户性格/沟通风格（如：直接高效、谨慎细致、价格导向等）",
  "nextActions": "下一步行动建议（2-3条具体可执行的建议）",
  "intentionScore": 7
}

注意：intentionScore 是1-10的整数，1=无意向，10=极高意向`;

  // 6. Call LLM
  try {
    const config = new Config();
    const client = new LLMClient(config);

    const response = await client.invoke(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `对话记录：\n${contextStr}\n\n请分析客户需求并生成结构化总结。` },
      ],
      { model, temperature: 0.3 }
    );

    // 7. Parse response
    const content = response.content.trim();
    const summary = parseSummary(content);

    return { summary, engine };
  } catch (err) {
    console.error('[AI Summarize] Generation error:', err);
    return { summary: EMPTY_SUMMARY, error: '需求总结生成失败，请检查API配置' };
  }
}

/**
 * Get recent messages for conversation context
 */
async function getRecentMessages(accountId, jid, limit = 30) {
  const messages = await prisma.message.findMany({
    where: { accountId, jid },
    orderBy: { timestamp: 'desc' },
    take: limit,
  });
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
    let text = msg.content || '';
    if (!msg.fromMe && msg.translation) {
      text = `${msg.content}（翻译：${msg.translation}）`;
    }
    return `[${time}] ${sender}: ${text}`;
  });

  return lines.join('\n');
}

/**
 * Parse LLM response into structured summary
 */
function parseSummary(content) {
  try {
    // Extract JSON from response (may be wrapped in markdown code block)
    let jsonStr = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    const parsed = JSON.parse(jsonStr);

    // Validate and normalize
    return {
      products: String(parsed.products || ''),
      quantity: String(parsed.quantity || ''),
      priceSensitivity: String(parsed.priceSensitivity || ''),
      deliveryRequirements: String(parsed.deliveryRequirements || ''),
      keyConcerns: String(parsed.keyConcerns || ''),
      customerStyle: String(parsed.customerStyle || ''),
      nextActions: String(parsed.nextActions || ''),
      intentionScore: normalizeScore(parsed.intentionScore),
    };
  } catch (e) {
    console.error('[AI Summarize] Failed to parse summary JSON:', e);
    // Try to extract partial info
    return {
      ...EMPTY_SUMMARY,
      keyConcerns: content.substring(0, 200),
    };
  }
}

/**
 * Normalize intention score to 1-10 integer
 */
function normalizeScore(score) {
  const num = Number(score);
  if (Number.isNaN(num)) return 5;
  return Math.max(1, Math.min(10, Math.round(num)));
}
