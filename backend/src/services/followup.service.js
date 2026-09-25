/**
 * Follow-up Service — 跟进提醒系统（v2 简化版）
 * 
 * 两类：
 *  - pending（待回复）：最后一条消息是客户发来的 inbound，我们还没回
 *  - followup（待跟进）：最后一条消息是我们发的 outbound，超过 72 小时客户没回
 * 
 * 不做时间窗口限制（不按"今日""48小时"等硬阈值），只看最终状态。
 * JID 统一归一化到手机号 JID，避免 @lid/@s.whatsapp.net 分裂。
 */
import { PrismaClient } from '@prisma/client';
import { resolveToPhoneJid } from './lid-mapping.js';

const prisma = new PrismaClient();

const DEFAULT_SESSION_ID = 'user_1';

// 待跟进阈值：72 小时（3 天）
const FOLLOWUP_HOURS = 72;

// 测试消息前缀 / 关键字（与 chat.js 的 isTestMsg 保持一致）
const TEST_PREFIXES = [
  "[SMOKE TEST]", "[LID-TEST]", "[LIDTRUE]", "[API TEST", "[DBG", "[TRACE",
  "[RC13", "[PHASE1-TEST]", "[TEST2]", "[TEST]", "[test]",
  "Hello, this is a smoke test", "this is a smoke test message",
  "session-test", "sess-test", "err-test", "test-to-self", "debug ping",
  "payload capture test", "raw webhook debug", "[自测]",
];
const TEST_ONLY_RE = /^(test|test1|hi test|Test message confirmed\.|debug log test)$/i;

// 非文本系统类消息（reaction、poll、protocol 等），不计入统计
const SYSTEM_TYPES = new Set([
  'reactionMessage', 'reaction', 'protocolMessage', 'pollCreationMessage',
  'pollUpdateMessage', 'pinInChatMessage', 'keepInChatMessage',
  'paymentMessage', 'productMessage', 'groupInviteMessage',
  'stickerMessage', 'callLogMesssage',   // 注意 typo 保持原枚举
]);

function isTestMsg(body) {
  if (!body || typeof body !== "string") return false;
  const trimmed = body.trim();
  if (TEST_PREFIXES.some(p => trimmed.includes(p))) return true;
  if (TEST_ONLY_RE.test(trimmed)) return true;
  return false;
}

function isSystemNonText(type, body) {
  // 按类型过滤
  if (type && SYSTEM_TYPES.has(type)) return true;
  // 兜底：body 以 [xxxMessage] 形式标注的（reactionMessage 等）
  if (body && typeof body === 'string') {
    if (/^\[(reactionMessage|protocolMessage|pollCreationMessage|pinInChatMessage|keepInChatMessage|paymentMessage|productMessage|groupInviteMessage|callLogMesssage|stickerMessage)\]/.test(body.trim())) return true;
  }
  return false;
}

/**
 * 从一条 WAMessage 抽取归一化客户 JID；非客户消息返回 null
 */
function extractCustomerJid(msg, selfJid) {
  const { direction, from, to } = msg;
  let jid = null;
  if (direction === 'inbound') jid = from;
  else if (direction === 'outbound') jid = to;
  if (!jid) return null;
  if (jid.includes('@g.us')) return null;
  if (jid.includes('@broadcast')) return null;
  if (jid === 'status@broadcast') return null;
  if (selfJid && jid === selfJid) return null;
  if (!jid.includes('@s.whatsapp.net') && !jid.includes('@lid') && !jid.includes('@telegram')) return null;
  // ★ 归一化：@lid → @s.whatsapp.net
  jid = resolveToPhoneJid(jid);
  return jid;
}

function truncate(s, max = 60) {
  if (!s) return '';
  const str = String(s);
  return str.length > max ? str.slice(0, max) + '…' : str;
}

/**
 * 主入口：计算 pending + followup 两类
 */
export async function getPendingFollowups(opts = {}) {
  const userId = opts.userId || 1;
  const sessionId = opts.sessionId || DEFAULT_SESSION_ID;
  const sessionIds = Array.isArray(sessionId) ? sessionId : [sessionId];
  const sessionFilter = sessionIds.length === 1 ? sessionIds[0] : { in: sessionIds };

  const now = new Date();
  // 回溯 14 天足够覆盖 72h 待跟进 + 缓冲
  const since = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  // 取最近 14 天所有消息，按时间倒序
  const messages = await prisma.wAMessage.findMany({
    where: {
      sessionId: sessionFilter,
      timestamp: { gte: since },
    },
    orderBy: { timestamp: 'desc' },
  });

  // 确定自身 JID（多 sessionId 时仅单连接场景；TG 无 selfJid）
  let selfJid = null;
  try {
    if (sessionIds.length === 1) {
      const conn = await prisma.wAConnection.findUnique({ where: { sessionId: sessionIds[0] } });
      if (conn?.phone) selfJid = conn.phone + '@s.whatsapp.net';
    }
  } catch (e) { /* ignore */ }

  // 按 JID 归并，每个客户只保留**最后一条有效消息**
  const lastByJid = new Map();
  for (const msg of messages) {
    const jid = extractCustomerJid(msg, selfJid);
    if (!jid) continue;
    // 过滤测试消息 + 系统非文本消息
    if (isTestMsg(msg.body)) continue;
    if (isSystemNonText(msg.type, msg.body)) continue;
    // 空 body（纯媒体无caption）也跳过（作为最后一条无意义）
    if (!msg.body || typeof msg.body !== 'string' || msg.body.trim() === '') continue;
    if (!lastByJid.has(jid)) lastByJid.set(jid, msg);
  }

  // 批量查客户档案
  const jids = Array.from(lastByJid.keys());
  const customerMap = new Map();
  if (jids.length > 0) {
    try {
      // 同时用 jid 和 phone 匹配
      const phones = jids.map(j => j.split('@')[0]);
      const customers = await prisma.customer.findMany({
        where: {
          userId,
          OR: [
            { jid: { in: jids } },
            { phone: { in: phones } },
          ],
        },
        select: { jid: true, phone: true, name: true, contactName: true, companyName: true },
      });
      for (const c of customers) {
        if (c.jid) customerMap.set(c.jid, c);
        if (c.phone) {
          const guessJid = c.phone + '@s.whatsapp.net';
          if (!customerMap.has(guessJid)) customerMap.set(guessJid, c);
        }
      }
    } catch (e) { /* ignore */ }
  }

  function resolveName(jid) {
    const c = customerMap.get(jid);
    if (c) return c.name || c.contactName || c.companyName || jid.split('@')[0];
    return jid.split('@')[0];
  }
  function resolvePhone(jid) {
    const c = customerMap.get(jid);
    if (c?.phone) return c.phone;
    return jid.split('@')[0];
  }

  const pending = [];   // 待回复：最后一条 inbound
  const followup = [];  // 待跟进：最后一条 outbound 且超过 72h

  for (const [jid, msg] of lastByJid.entries()) {
    const ts = msg.timestamp instanceof Date ? msg.timestamp : new Date(msg.timestamp);
    if (isNaN(ts.getTime())) continue;
    const hoursSinceLast = (now.getTime() - ts.getTime()) / 3600000;

    const base = {
      jid,
      name: resolveName(jid),
      phone: resolvePhone(jid),
      lastMessage: truncate(msg.body || ''),
      lastMessageAt: ts.toISOString(),
      lastMessageTime: ts.toISOString(),
      hoursSinceLastMsg: Math.round(hoursSinceLast * 10) / 10,
      lastDirection: msg.direction,
    };

    if (msg.direction === 'inbound') {
      // 客户最后一条是 inbound：无论多久都算"待回复"
      pending.push(base);
    } else if (msg.direction === 'outbound' && hoursSinceLast >= FOLLOWUP_HOURS) {
      // 我方最后一条是 outbound，且已超 72h 客户没回：待跟进
      followup.push(base);
    }
  }

  const byTimeAsc = (a, b) => new Date(a.lastMessageAt).getTime() - new Date(b.lastMessageAt).getTime();
  pending.sort(byTimeAsc);
  followup.sort(byTimeAsc);

  return {
    pending,        // 待回复
    followup,       // 待跟进
    urgent: pending, // 兼容前端字段
    // reactivate 移除
    total: pending.length + followup.length,
    pendingTotal: pending.length + followup.length,
    generatedAt: now.toISOString(),
  };
}

/**
 * 首响提醒（保留，5分钟未回即提醒，用于工作台提示条）
 */
export async function getFirstResponseAlerts(opts = {}) {
  const userId = opts.userId || 1;
  const sessionId = opts.sessionId || DEFAULT_SESSION_ID;
  const thresholdMs = opts.thresholdMs || 5 * 60 * 1000;

  const now = new Date();
  const since = new Date(now.getTime() - 60 * 60 * 1000);

  const messages = await prisma.wAMessage.findMany({
    where: {
      sessionId,
      timestamp: { gte: since },
    },
    orderBy: { timestamp: 'desc' },
  });

  let selfJid = null;
  try {
    const conn = await prisma.wAConnection.findUnique({ where: { sessionId } });
    if (conn?.phone) selfJid = conn.phone + '@s.whatsapp.net';
  } catch (e) { /* ignore */ }

  const lastByJid = new Map();
  const lastInboundByJid = new Map();
  const hasOutboundAfterInbound = new Set();

  for (const msg of messages) {
    const jid = extractCustomerJid(msg, selfJid);
    if (!jid) continue;
    if (isTestMsg(msg.body)) continue;
    if (isSystemNonText(msg.type, msg.body)) continue;
    if (!msg.body || typeof msg.body !== 'string' || msg.body.trim() === '') continue;

    const ts = msg.timestamp instanceof Date ? msg.timestamp : new Date(msg.timestamp);
    if (isNaN(ts.getTime())) continue;

    if (!lastByJid.has(jid)) lastByJid.set(jid, msg);

    if (msg.direction === 'inbound') {
      if (!lastInboundByJid.has(jid)) lastInboundByJid.set(jid, msg);
    } else if (msg.direction === 'outbound') {
      const lastIn = lastInboundByJid.get(jid);
      if (lastIn) {
        const inTs = lastIn.timestamp instanceof Date ? lastIn.timestamp : new Date(lastIn.timestamp);
        if (ts >= inTs) hasOutboundAfterInbound.add(jid);
      }
    }
  }

  const jids = Array.from(lastInboundByJid.keys());
  const customerMap = new Map();
  if (jids.length > 0) {
    try {
      const customers = await prisma.customer.findMany({
        where: { userId, OR: [{ jid: { in: jids } }, { phone: { in: jids.map(j => j.split('@')[0]) } }] },
        select: { jid: true, phone: true, name: true, contactName: true, companyName: true },
      });
      for (const c of customers) {
        if (c.jid) customerMap.set(c.jid, c);
        if (c.phone) customerMap.set(c.phone + '@s.whatsapp.net', c);
      }
    } catch (e) { /* ignore */ }
  }

  function resolveName(jid) {
    const c = customerMap.get(jid);
    if (c) return c.name || c.contactName || c.companyName || jid.split('@')[0];
    return jid.split('@')[0];
  }

  const alerts = [];
  for (const [jid, inboundMsg] of lastInboundByJid.entries()) {
    const lastMsg = lastByJid.get(jid);
    if (!lastMsg || lastMsg.direction !== 'inbound') continue;
    if (hasOutboundAfterInbound.has(jid)) continue;

    const ts = inboundMsg.timestamp instanceof Date ? inboundMsg.timestamp : new Date(inboundMsg.timestamp);
    if (isNaN(ts.getTime())) continue;
    const waitedMs = now.getTime() - ts.getTime();
    if (waitedMs < thresholdMs) continue;

    alerts.push({
      jid,
      name: resolveName(jid),
      lastMessage: truncate(inboundMsg.body || ''),
      lastMessageTime: ts.toISOString(),
      minutesWaited: Math.floor(waitedMs / 60000),
    });
  }

  alerts.sort((a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime());
  return alerts;
}

export default { getPendingFollowups, getFirstResponseAlerts };
