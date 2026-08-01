/**
 * Unattended Mode Service (无人值守自动回复)
 * 夜间自动回复客户消息，AI智能生成回复内容
 */
import { PrismaClient } from '@prisma/client';
import { chatComplete } from './ai-client.js';
import { translateText, detectLanguage } from './ai.service.js';
import { getEvolutionConnector } from './evolution-connector.js';

const prisma = new PrismaClient();
const USER_ID = 1;
const DEFAULT_SESSION_ID = 'jeremy-main';

// 默认配置
const DEFAULT_CONFIG = {
  enabled: false,
  startHour: 22,
  endHour: 8,
  timezone: 'Asia/Shanghai',
  strategy: 'smart'  // smart | simple | custom
};

/**
 * 读取无人值守配置
 */
async function getConfig() {
  const setting = await prisma.setting.findUnique({
    where: { userId_key: { userId: USER_ID, key: 'unattended_config' } },
  });
  if (!setting || !setting.value) return { ...DEFAULT_CONFIG };
  try {
    const parsed = JSON.parse(setting.value);
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

/**
 * 保存无人值守配置
 */
async function saveConfig(config) {
  const merged = { ...DEFAULT_CONFIG, ...config };
  await prisma.setting.upsert({
    where: { userId_key: { userId: USER_ID, key: 'unattended_config' } },
    create: { userId: USER_ID, key: 'unattended_config', value: JSON.stringify(merged) },
    update: { value: JSON.stringify(merged) },
  });
  return merged;
}

/**
 * 判断当前是否在无人值守时段
 */
function isUnattendedTime(now, config) {
  if (!config.enabled) return false;

  const tz = config.timezone || 'Asia/Shanghai';
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: 'numeric',
    hour12: false,
  });
  const currentHour = parseInt(formatter.format(now), 10);

  const start = config.startHour;
  const end = config.endHour;

  // 跨午夜（如 22:00 - 08:00）
  if (start > end) {
    return currentHour >= start || currentHour < end;
  }
  // 同一天
  return currentHour >= start && currentHour < end;
}

/**
 * AI生成智能回复
 */
async function generateAutoReply(customerName, customerMessage, customer) {
  const config = await getConfig();

  if (config.strategy === 'simple') {
    return '感谢您的留言！我们目前不在工作时间，会在上班时间尽快回复您。祝您有美好的一天！';
  }

  if (config.strategy === 'custom' && config.customTemplate) {
    return config.customTemplate;
  }

  // smart模式：AI智能生成
  const customerInfo = customer ? `
Customer context:
- Name: ${customerName || 'Unknown'}
- Country: ${customer.country || 'Unknown'}
- Company: ${customer.company || 'Unknown'}
- Industry: ${customer.industry || 'Unknown'}
` : '';

  const prompt = `You are a B2B sales assistant responding on behalf of a salesperson during off-hours.

The customer sent this message:
"${customerMessage}"

${customerInfo}

Requirements:
- Acknowledge their message warmly
- Let them know you're currently offline but will respond during business hours
- Keep it professional, friendly, and brief (2-3 sentences max)
- If they asked a specific question, indicate you'll provide details during business hours
- Do NOT make up product details, prices, or commitments
- Language: ALWAYS reply in Chinese (简体中文). Do NOT use English or any other language.

Return ONLY the reply message in Chinese, no explanations.`;

  try {
    const reply = await chatComplete([
      { role: 'system', content: prompt },
      { role: 'user', content: 'Generate the auto-reply now.' }
    ], { temperature: 0.5, maxTokens: 200 });
    return reply.trim();
  } catch (e) {
    console.error('[Unattended] AI generation failed:', e.message);
    return '感谢您的留言！我会在上班时间回复您。';
  }
}

/**
 * 处理无人值守自动回复
 * 在收到入站消息时调用
 */
async function handleUnattendedReply({ remoteJid, body, pushName, customer }) {
  const config = await getConfig();

  if (!isUnattendedTime(new Date(), config)) {
    return null;
  }

  console.log(`[Unattended] Auto-replying to ${remoteJid} (message: "${body?.slice(0, 30)}...")`);

  const zhReply = await generateAutoReply(pushName, body, customer);

  // 检测客户语言并翻译成目标语言
  let sendText = zhReply;
  let translationObj = null;
  try {
    const srcLang = await detectLanguage(body || '', 'google');
    const tgtLang = srcLang && srcLang !== 'zh' && srcLang !== 'unknown' ? srcLang : null;
    if (tgtLang) {
      const tr = await translateText(zhReply, 'zh', tgtLang, 'google', USER_ID);
      if (tr && tr.translated) {
        sendText = tr.translated;
        translationObj = JSON.stringify({
          original: zhReply,
          translated: sendText,
          sourceLang: 'zh',
          targetLang: tgtLang,
        });
        console.log(`[Unattended] zh->${tgtLang}: "${zhReply.slice(0,30)}" => "${sendText.slice(0,30)}"`);
      }
    }
  } catch (te) {
    console.warn('[Unattended] Translation failed, sending Chinese reply:', te.message);
  }

  try {
    const evoConnector = getEvolutionConnector();

    // sendTextMessage内部会自动处理LID映射
    const result = await evoConnector.sendTextMessage(remoteJid, sendText);

    // 记录自动回复到数据库
    const ownerJid = '8613016242602@s.whatsapp.net';
    const waMessageId = result?.messageId || result?.key?.id || null;

    if (waMessageId) {
      await prisma.wAMessage.create({
        data: {
          sessionId: DEFAULT_SESSION_ID,
          from: ownerJid,
          to: remoteJid,
          body: sendText,
          type: 'text',
          direction: 'outbound',
          timestamp: new Date(),
          waMessageId,
          translation: translationObj,
          sourceLang: translationObj ? 'zh' : null,
        },
      });
    }

    console.log(`[Unattended] ✅ Sent auto-reply to ${remoteJid}, msgId=${waMessageId}`);
    return { sent: true, reply: sendText, messageId: waMessageId };

  } catch (e) {
    console.error('[Unattended] ❌ Failed to send auto-reply:', e.message);
    return { sent: false, reply, error: e.message };
  }
}

export default {
  getConfig,
  saveConfig,
  isUnattendedTime,
  handleUnattendedReply,
  generateAutoReply,
};
