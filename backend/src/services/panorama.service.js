/**
 * 客户全景聚合服务（客户-Agent 双向指派需求）
 * 聚合：① Customer 档案 ② WA/TG/邮件 三渠道沟通历史 ③ 共享上下文结论 ④ 背调报告
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** 历史注入条数默认值（可配置） */
export const PANORAMA_HISTORY_LIMIT = 30;

/**
 * 自动建立客户↔渠道关联（幂等）
 * 规则：
 *  - WA/TG: Customer.jid 精确匹配 WAMessage.from/to / Message.jid → contactKey=jid, channel=wa|tg
 *  - email: Customer.email 精确匹配 EmailMessage.from/to → contactKey=email, channel=email
 * 仅在无手动关联时写入 auto 关联
 */
export async function ensureCustomerChannelLinks(userId, customer) {
  if (!customer) return [];
  const created = [];
  const cid = customer.id;

  // WA/TG 关联
  if (customer.jid) {
    const existingWa = await prisma.customerChannelLink.findUnique({
      where: { userId_customerId_channel_contactKey: { userId, customerId: cid, channel: 'wa', contactKey: customer.jid } }
    });
    if (!existingWa) {
      const link = await prisma.customerChannelLink.upsert({
        where: { userId_customerId_channel_contactKey: { userId, customerId: cid, channel: 'wa', contactKey: customer.jid } },
        update: {},
        create: { userId, customerId: cid, channel: 'wa', contactKey: customer.jid, matchType: 'auto' }
      });
      created.push(link);
    }
  }

  // email 关联
  if (customer.email) {
    const existingEm = await prisma.customerChannelLink.findUnique({
      where: { userId_customerId_channel_contactKey: { userId, customerId: cid, channel: 'email', contactKey: customer.email } }
    });
    if (!existingEm) {
      const link = await prisma.customerChannelLink.upsert({
        where: { userId_customerId_channel_contactKey: { userId, customerId: cid, channel: 'email', contactKey: customer.email } },
        update: {},
        create: { userId, customerId: cid, channel: 'email', contactKey: customer.email, matchType: 'auto' }
      });
      created.push(link);
    }
  }

  return created;
}

/**
 * 构建客户全景
 * @param {number} userId
 * @param {number} customerId
 * @param {object} opts { historyLimit, includeRaw }
 * @returns 全景对象
 */
export async function buildCustomerPanorama(userId, customerId, opts = {}) {
  const historyLimit = opts.historyLimit || PANORAMA_HISTORY_LIMIT;
  const customer = await prisma.customer.findUnique({ where: { id: parseInt(customerId, 10) } });
  if (!customer) return { error: true, message: '客户不存在' };

  // 自动建立渠道关联（幂等，失败不影响主流程）
  try { await ensureCustomerChannelLinks(userId, customer); } catch (e) { console.error('[Panorama] ensure links:', e.message); }

  // 1) 客户档案
  const profile = {
    id: customer.id,
    name: customer.name || '',
    company: customer.company || customer.companyName || '',
    contactName: customer.contactName || '',
    title: customer.title || '',
    country: customer.country || '',
    city: customer.city || '',
    industry: customer.industry || '',
    website: customer.website || '',
    phone: customer.phone || '',
    email: customer.email || '',
    jid: customer.jid || '',
    customerLevel: customer.customerLevel || 'C',
    dealStage: customer.dealStage || 'new',
    dealValue: customer.dealValue || 0,
    intentLevel: customer.intentLevel,
    status: customer.status || '',
    source: customer.source || '',
    tags: (() => { try { return JSON.parse(customer.tags || '[]'); } catch { return []; } })(),
    notes: customer.notes || '',
    requirementSummary: customer.requirementSummary || '',
    requirementProducts: customer.requirementProducts || '',
    requirementBudget: customer.requirementBudget || '',
    requirementQuantity: customer.requirementQuantity || '',
    requirementDelivery: customer.requirementDelivery || '',
    lastContactAt: customer.lastContactAt || null,
    createdAt: customer.createdAt || null
  };

  // 2) 三渠道沟通历史（按时间倒序合并）
  const waHistory = [];
  const emailHistory = [];
  const tgHistory = [];

  // WA 历史（通过 channel link wa + Customer.jid 兜底）
  const waKeys = new Set();
  const waLinks = await prisma.customerChannelLink.findMany({ where: { userId, customerId: customer.id, channel: 'wa' } });
  waLinks.forEach(l => waKeys.add(l.contactKey));
  if (customer.jid) waKeys.add(customer.jid);
  if (waKeys.size) {
    const waMsgs = await prisma.wAMessage.findMany({
      where: { OR: [...waKeys].map(k => ({ OR: [{ from: k }, { to: k }] })) },
      orderBy: { timestamp: 'desc' },
      take: historyLimit
    });
    for (const m of waMsgs) {
      const isOut = m.direction === 'outbound' || m.direction === 'outgoing';
      waHistory.push({
        ts: m.timestamp,
        direction: isOut ? 'out' : 'in',
        who: isOut ? '我方(业务员)' : '客户',
        content: m.translation || m.body || '',
        raw: m.body || ''
      });
    }
  }

  // TG 历史（通过 channel link tg + Message 表 platform=telegram）
  const tgKeys = new Set();
  const tgLinks = await prisma.customerChannelLink.findMany({ where: { userId, customerId: customer.id, channel: 'tg' } });
  tgLinks.forEach(l => tgKeys.add(l.contactKey));
  if (tgKeys.size) {
    const tgMsgs = await prisma.message.findMany({
      where: { OR: [...tgKeys].map(k => ({ jid: k })), platform: 'telegram' },
      orderBy: { timestamp: 'desc' },
      take: historyLimit
    });
    for (const m of tgMsgs) {
      tgHistory.push({
        ts: m.timestamp,
        direction: m.fromMe ? 'out' : 'in',
        who: m.fromMe ? '我方(业务员)' : '客户',
        content: m.translation || m.content || '',
        raw: m.content || ''
      });
    }
  }

  // 邮件历史（通过 channel link email + Customer.email 兜底）
  const emailKeys = new Set();
  const emailLinks = await prisma.customerChannelLink.findMany({ where: { userId, customerId: customer.id, channel: 'email' } });
  emailLinks.forEach(l => emailKeys.add(l.contactKey));
  if (customer.email) emailKeys.add(customer.email);
  if (emailKeys.size) {
    const emailMsgs = await prisma.emailMessage.findMany({
      where: { OR: [...emailKeys].flatMap(k => [{ from: k }, { to: k }]) },
      orderBy: { createdAt: 'desc' },
      take: historyLimit
    });
    for (const m of emailMsgs) {
      const isOut = m.direction === 'outbound' || m.direction === 'sent';
      emailHistory.push({
        ts: m.createdAt,
        direction: isOut ? 'out' : 'in',
        who: isOut ? '我方(业务员)' : '客户',
        subject: m.subject || '',
        content: m.bodyPlain || m.body || '',
        raw: m.body || ''
      });
    }
  }

  // 合并三渠道（按时间倒序）
  const allHistory = [
    ...waHistory.map(h => ({ ...h, channel: 'whatsapp' })),
    ...tgHistory.map(h => ({ ...h, channel: 'telegram' })),
    ...emailHistory.map(h => ({ ...h, channel: 'email' }))
  ].sort((a, b) => (a.ts && b.ts ? new Date(b.ts) - new Date(a.ts) : 0));

  // 3) 共享上下文结论（entityType=customer，entityId 匹配客户ID/客户名/别名）
  const contextWhere = {
    entityType: 'customer',
    OR: [
      { entityId: String(customer.id) },
      { entityId: customer.name || '__none__' },
      ...(customer.company ? [{ entityId: customer.company }] : []),
      ...(customer.email ? [{ entityId: customer.email }] : [])
    ]
  };
  const ctxEntries = await prisma.contextEntry.findMany({
    where: contextWhere,
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    take: 50
  });
  const contextOrder = { LOCKED: 0, ACTIVE: 1, CONFLICT: 2, SUPERSEDED: 3 };
  ctxEntries.sort((a, b) => (contextOrder[a.status] ?? 9) - (contextOrder[b.status] ?? 9));
  const sharedContext = ctxEntries.map(e => ({
    key: e.key, value: e.value, confidence: e.confidence, status: e.status,
    sourceAgent: e.sourceAgent, updatedAt: e.updatedAt
  }));

  // 4) 背调报告（contactId = customer.id）
  const bg = await prisma.customerBackgroundCheck.findFirst({
    where: { contactId: customer.id },
    orderBy: { updatedAt: 'desc' }
  });

  const panorama = {
    customer: profile,
    history: {
      total: allHistory.length,
      items: allHistory.slice(0, historyLimit)
    },
    sharedContext,
    backgroundCheck: bg ? {
      companyName: bg.companyName, website: bg.website, country: bg.country,
      industry: bg.industry, companySize: bg.companySize, riskLevel: bg.riskLevel,
      details: bg.details, notes: bg.notes, updatedAt: bg.updatedAt
    } : null
  };

  if (opts.includeRaw) panorama.raw = { waHistory, tgHistory, emailHistory, waLinks, emailLinks };

  return panorama;
}

/**
 * 生成注入 AI 提示词的全景文本（控制 token，首轮全量/后续轻量）
 */
export function formatPanoramaPrompt(panorama, { light = false } = {}) {
  if (!panorama || panorama.error) return '';
  const c = panorama.customer;
  const lines = [];
  lines.push('【当前客户档案】');
  lines.push(`- 客户：${c.name || c.contactName || '未知'}${c.company ? '（' + c.company + '）' : ''}`);
  if (c.country) lines.push(`- 国家/地区：${c.country}`);
  if (c.industry) lines.push(`- 行业：${c.industry}`);
  if (c.phone) lines.push(`- 电话：${c.phone}`);
  if (c.email) lines.push(`- 邮箱：${c.email}`);
  lines.push(`- 客户等级：${c.customerLevel}｜阶段：${c.dealStage}${c.dealValue ? '｜预计金额：' + c.dealValue : ''}`);
  if (c.requirementSummary) lines.push(`- 需求摘要：${c.requirementSummary}`);
  if (c.requirementProducts) lines.push(`- 需求产品：${c.requirementProducts}`);
  if (c.requirementBudget) lines.push(`- 预算：${c.requirementBudget}`);
  if (c.notes) lines.push(`- 备注：${c.notes}`);

  // 背调
  if (panorama.backgroundCheck) {
    const b = panorama.backgroundCheck;
    lines.push('【客户背调】');
    lines.push(`- 公司：${b.companyName || '未知'}${b.country ? '（' + b.country + '）' : ''}｜风险：${b.riskLevel || '未知'}`);
    if (b.industry) lines.push(`- 行业：${b.industry}${b.companySize ? '｜规模：' + b.companySize : ''}`);
    if (b.details) lines.push(`- 背调详情：${b.details}`);
    if (b.notes) lines.push(`- 背调备注：${b.notes}`);
  }

  // 共享结论
  if (panorama.sharedContext && panorama.sharedContext.length) {
    lines.push('【团队共享结论】');
    for (const e of panorama.sharedContext.slice(0, light ? 5 : 15)) {
      const tag = e.status === 'LOCKED' ? '🔒' : (e.status === 'CONFLICT' ? '⚠️' : '');
      lines.push(`- ${e.key}：${e.value}${tag}${e.sourceAgent ? '（' + e.sourceAgent + '）' : ''}`);
    }
    if (panorama.sharedContext.length > 15) lines.push(`- ……（共 ${panorama.sharedContext.length} 条共享结论）`);
  }

  // 沟通历史
  const items = (panorama.history && panorama.history.items) || [];
  if (items.length) {
    lines.push('【近期沟通记录（' + items.length + ' 条，按时间倒序）】');
    for (const h of items.slice(0, light ? 5 : 15)) {
      const ts = h.ts ? new Date(h.ts).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
      const chTag = h.channel === 'email' ? '📧' : (h.channel === 'telegram' ? '✈️' : '💬');
      const content = (h.content || '').substring(0, 150);
      lines.push(`- [${chTag}${ts}] ${h.who}：${content}`);
    }
    if (items.length > 15) lines.push(`- ……（共 ${panorama.history.total} 条沟通记录，可按需追问更早历史）`);
  }

  return lines.join('\n');
}
