/**
 * WhatsApp Automation Service
 */

import { PrismaClient } from '@prisma/client';
import { detectCountryFromPhone, languageNames, countryNames, isWeekendGreetingDay, countryToLanguage } from './country-language.js';
import { getBaileysProvider } from './whatsapp-provider.js';
import { chatComplete } from './ai-client.js';

const prisma = new PrismaClient();

const PROMPTS = {
  weekend_greeting: (ctx) => `You are a B2B glass industry salesperson from Jinzhijing Glass (金至晶玻璃), a leading Chinese manufacturer of specialty glass (AR anti-reflective glass, AG anti-glare glass, cover glass for touch screens, industrial glass).

Write a warm, professional weekend greeting message for a client in ${ctx.countryName}.

Requirements:
- Language: ${ctx.languageName}
- Tone: friendly but professional, not overly casual
- Length: 1-3 short sentences (WhatsApp-friendly, 30-80 words)
- Content: Wish them a nice weekend, optionally a light positive note about business collaboration
- Do NOT use emojis
- Do NOT make it look like a bulk message
- Sign off naturally, no website links, no email

Return ONLY the message text in ${ctx.languageName}, no explanations or quotes.`,

  industry_news: (ctx) => `You are a B2B glass industry expert for Jinzhijing Glass (金至晶玻璃), a Chinese specialty glass manufacturer (AR glass, AG glass, touch screen cover glass, display glass, industrial glass).

Compose a brief industry insight message for a client in ${ctx.countryName}.

Requirements:
- Language: ${ctx.languageName}
- Tone: professional, informative, authoritative
- Length: 2-3 sentences (50-120 words)
- Content: mention ONE recent, realistic industry trend in display technology, smart glass, automotive display, AR/VR glass, or industrial HMI. Relate it to quality glass supply.
- Do NOT use emojis
- Do NOT include links
- End with an open question to encourage conversation
- Sound like a knowledgeable industry contact, not a marketing bot

Return ONLY the message text in ${ctx.languageName}, no explanations.`,

  case_study: (ctx) => `You are a B2B salesperson at Jinzhijing Glass (金至晶玻璃), Chinese manufacturer of specialty glass (AR/AG glass, cover glass, industrial display glass).

Compose a short application story message for a prospect in ${ctx.countryName}.

Requirements:
- Language: ${ctx.languageName}
- Tone: professional, confident, results-oriented
- Length: 2-4 sentences (60-130 words)
- Content: describe ONE realistic B2B application (smart factory HMI, outdoor digital signage, medical devices, automotive displays, outdoor kiosks, POS terminals). Mention the problem, glass type used, and outcome.
- Do NOT use emojis
- Do NOT include links
- End with a soft CTA like "Happy to share specs if interested"
- Industries served: industrial HMI, outdoor displays, medical, automotive, consumer electronics

Return ONLY the message text in ${ctx.languageName}, no explanations.`,
};

async function generateForCustomer(rule, customer) {
  const detection = detectCountryFromPhone(customer.phone);
  const country = customer.country || detection.country;
  let language;
  if (rule.languageMode === 'manual' && rule.defaultLang) {
    language = rule.defaultLang;
  } else {
    const autoCust = await prisma.automationCustomer.findUnique({
      where: { userId_customerId: { userId: rule.userId, customerId: customer.id } },
    });
    language = autoCust?.customLang || countryToLanguage[country] || detection.language || 'en';
  }

  const ctx = {
    countryName: countryNames[country] || country,
    languageName: languageNames[language] || 'English',
  };

  const prompt = PROMPTS[rule.type](ctx);
  let content = '';
  try {
    content = (await chatComplete([
      { role: 'system', content: prompt },
      { role: 'user', content: 'Write the message now.' }
    ], { temperature: 0.7, maxTokens: 500 })).trim();
  } catch (e) {
    console.error('[Automation] AI generation failed:', e.message);
    content = `[AI generation failed: ${e.message}]`;
  }

  const item = await prisma.automationQueueItem.create({
    data: {
      userId: rule.userId,
      ruleId: rule.id,
      customerId: customer.id,
      type: rule.type,
      language,
      content,
      status: 'pending',
      scheduledFor: new Date(),
    },
  });
  return item;
}

async function executeRule(rule, options = {}) {
  console.log(`[Automation] Executing rule: ${rule.type} for user ${rule.userId}`);
  const assignments = await prisma.automationCustomer.findMany({
    where: { userId: rule.userId },
    include: { customer: true },
  });

  const targets = assignments.filter(a => {
    try {
      const types = JSON.parse(a.types || '[]');
      return types.includes(rule.type);
    } catch { return false; }
  }).map(a => a.customer).filter(Boolean);

  // 清理孤儿assignment（customer被删）
  const orphanAssignments = assignments.filter(a => !a.customer);
  if (orphanAssignments.length) {
    const orphanIds = orphanAssignments.map(a => a.id);
    try {
      await prisma.automationCustomer.deleteMany({ where: { id: { in: orphanIds } } });
      console.log(`[Automation] Cleaned up ${orphanIds.length} orphan assignments for rule ${rule.id}`);
    } catch (e) {
      console.warn('[Automation] Failed to clean orphan assignments:', e.message);
    }
  }

  // 清理孤儿queue item（customer被删）
  try {
    const orphanQueues = await prisma.automationQueueItem.findMany({
      where: { userId: rule.userId },
      include: { customer: true },
    });
    const orphanQueueIds = orphanQueues.filter(q => !q.customer).map(q => q.id);
    if (orphanQueueIds.length) {
      await prisma.automationQueueItem.deleteMany({ where: { id: { in: orphanQueueIds } } });
      console.log(`[Automation] Cleaned up ${orphanQueueIds.length} orphan queue items`);
    }
  } catch (e) {
    console.warn('[Automation] Failed to clean orphan queue items:', e.message);
  }

  const now = new Date();
  let customers = targets;
  if (rule.type === 'weekend_greeting' && !options.force) {
    customers = targets.filter(c => {
      const country = c.country || detectCountryFromPhone(c.phone).country;
      return isWeekendGreetingDay(country, now);
    });
  }

  if (customers.length === 0) {
    await prisma.automationRule.update({
      where: { id: rule.id },
      data: { lastRunAt: now },
    });
    return { generated: 0 };
  }

  let generated = 0;
  for (const customer of customers) {
    try {
      const existing = await prisma.automationQueueItem.findFirst({
        where: {
          userId: rule.userId,
          customerId: customer.id,
          type: rule.type,
          createdAt: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) },
        },
      });
      if (existing) continue;
      await generateForCustomer(rule, customer);
      generated++;
      await new Promise(r => setTimeout(r, 2000));
    } catch (e) {
      console.error(`[Automation] Failed for customer ${customer.id}:`, e.message);
    }
  }

  await prisma.automationRule.update({
    where: { id: rule.id },
    data: { lastRunAt: now },
  });

  console.log(`[Automation] Rule ${rule.type} done: ${generated} messages`);
  return { generated };
}

async function checkAndRunScheduledRules() {
  const now = new Date();
  const rules = await prisma.automationRule.findMany({ where: { enabled: true } });
  for (const rule of rules) {
    try {
      const interval = getRuleInterval(rule.type);
      if (shouldExecuteRule(rule, interval, now)) {
        await executeRule(rule);
      }
    } catch (e) {
      console.error(`[Automation] Rule ${rule.id} error:`, e.message);
    }
  }
}

function getRuleInterval(type) {
  switch (type) {
    case 'weekend_greeting': return 7 * 24 * 60 * 60 * 1000;
    case 'industry_news': return 7 * 24 * 60 * 60 * 1000;
    case 'case_study': return 30 * 24 * 60 * 60 * 1000;
    default: return 7 * 24 * 60 * 60 * 1000;
  }
}

function shouldExecuteRule(rule, interval, now) {
  if (!rule.lastRunAt) return true;
  const since = now.getTime() - new Date(rule.lastRunAt).getTime();
  if (since < interval) return false;
  if (rule.type === 'weekend_greeting') {
    const day = now.getUTCDay();
    return day === 4 || day === 5;
  }
  if (rule.type === 'industry_news') {
    return now.getUTCDay() === 1;
  }
  if (rule.type === 'case_study') {
    return now.getUTCDate() === 1;
  }
  return true;
}

async function approveAndSend(itemId, userId) {
  const item = await prisma.automationQueueItem.findUnique({
    where: { id: itemId },
    include: { customer: true },
  });
  if (!item || item.userId !== userId) throw new Error('Item not found');
  if (item.status !== 'pending' && item.status !== 'edited') {
    throw new Error(`Cannot send item in status: ${item.status}`);
  }

  const content = item.editedContent || item.content;
  const provider = getBaileysProvider();
  const connections = provider.getActiveConnections();
  if (connections.length === 0) throw new Error('WhatsApp not connected');
  const sessionId = connections[0].sessionId;

  let to = item.customer.phone;
  if (!to) throw new Error('Customer has no phone number');
  to = to.replace(/\D/g, '');
  if (!to.includes('@')) to = `${to}@s.whatsapp.net`;

  try {
    const result = await provider.sendMessage(sessionId, to, content);
    await prisma.automationQueueItem.update({
      where: { id: itemId },
      data: { status: 'sent', sentAt: new Date(), waMessageId: result.messageId },
    });
    await prisma.customer.update({
      where: { id: item.customerId },
      data: { lastContactAt: new Date() },
    });
    await prisma.automationCustomer.updateMany({
      where: { userId, customerId: item.customerId },
      data: { lastSentAt: new Date() },
    });
    return { success: true, messageId: result.messageId };
  } catch (e) {
    await prisma.automationQueueItem.update({
      where: { id: itemId },
      data: { status: 'failed', errorMsg: e.message },
    });
    throw e;
  }
}

async function skipItem(itemId, userId) {
  return prisma.automationQueueItem.update({
    where: { id: itemId },
    data: { status: 'skipped' },
  });
}

async function editItem(itemId, userId, newContent) {
  return prisma.automationQueueItem.update({
    where: { id: itemId },
    data: { editedContent: newContent, status: 'edited' },
  });
}

async function triggerRuleNow(ruleId, userId) {
  const rule = await prisma.automationRule.findUnique({ where: { id: ruleId } });
  if (!rule || rule.userId !== userId) throw new Error('Rule not found');
  return executeRule(rule, { force: true });
}

export default {
  checkAndRunScheduledRules,
  executeRule,
  approveAndSend,
  skipItem,
  editItem,
  triggerRuleNow,
};
export { detectCountryFromPhone };
