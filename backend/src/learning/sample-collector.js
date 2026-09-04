/**
 * 话术库自主学习进化 V1 - 样本采集器
 * 增量抽取「客户消息 → 销售回复」配对样本：
 *  - 客户 inbound 消息 → 其后 1~N 条 outbound 回复配对为一条样本
 *  - 优先 Message 表（有 accountId+contactId）
 *  - WAMessage 表经 sessionId → WAConnection → accountId 推导租户
 *  - aiSuggestion 且 salesReply ≠ aiSuggestion → aiModified=true（最高价值信号）
 */
import { LEARNING_CONFIG as CFG } from './config.js';
import {
  prisma, log, short, hasCollectibleText,
  deriveAccountIdForSession,
} from './learning.service.js';

/**
 * 收集某租户的原始配对样本
 * @param {object} opts { accountId, sessionIds, cursor (Date|null), limit }
 * @returns {Promise<Array>} samples
 */
export async function collectSamples({ accountId, sessionIds, cursor = null, limit = CFG.maxSamplesPerRun }) {
  const samples = [];
  const sourceStart = cursor || new Date(0);

  // ── 1) 优先 Message 表（统一消息，含 accountId） ──────────────────
  try {
    const msgs = await prisma.message.findMany({
      where: {
        accountId,
        content: { not: '' },
        timestamp: { gte: sourceStart },
      },
      orderBy: { timestamp: 'asc' },
      take: Math.min(limit * 10, CFG.maxMessagesPerRun),
    });
    const byContact = groupMessagesByContact(msgs, { keyByAccount: true });
    for (const [accountKey, list] of byContact) {
      for (const pair of buildPairs(list, { accountId, sourceType: 'message' })) {
        if (samples.length >= limit) break;
        samples.push(pair);
      }
    }
    log('Collector', `Message 表: ${msgs.length} 条消息 → ${samples.length} 条样本`);
  } catch (e) {
    log('WARN', 'Message 表采集失败（可能为空表）:', e.message);
  }

  // ── 2) WAMessage 表（sessionId 推导租户） ─────────────────────────
  if (!sessionIds || !sessionIds.length) {
    return { samples, cursor: null, processed: 0 };
  }
  let processed = 0;
  let cursorVal = sourceStart;
  try {
    const waMsgs = await prisma.wAMessage.findMany({
      where: {
        sessionId: { in: sessionIds },
        timestamp: { gte: sourceStart },
      },
      orderBy: { timestamp: 'asc' },
      take: Math.min(limit * 10, CFG.maxMessagesPerRun),
    });
    // 按 session 分组建会话序列
    const bySession = new Map();
    for (const m of waMsgs) {
      if (!bySession.has(m.sessionId)) bySession.set(m.sessionId, []);
      bySession.get(m.sessionId).push(m);
    }
    for (const [sessionId, list] of bySession) {
      const sessAccountId = accountId || (await deriveAccountIdForSession(sessionId));
      if (sessAccountId == null) {
        log('WARN', `session ${sessionId} 无法推导租户，跳过`);
        continue;
      }
      for (const pair of buildPairs(list, { accountId: sessAccountId, sourceType: 'wamessage' })) {
        processed++;
        if (pair.ts && pair.ts > cursorVal) cursorVal = pair.ts;
        if (samples.length >= limit) return { samples, cursor: cursorVal, processed };
        samples.push(pair);
      }
    }
    log('Collector', `WAMessage 表: ${waMsgs.length} 条消息(${bySession.size}会话) → 新增样本 ${processed} 条`);
  } catch (e) {
    log('WARN', 'WAMessage 采集失败:', e.message);
  }

  return { samples, cursor: cursorVal, processed };
}

/** 按联系人对消息分组 */
function groupMessagesByContact(msgs, { keyByAccount }) {
  const map = new Map();
  for (const m of msgs) {
    const key = `${m.accountId}:${m.contactId}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(m);
  }
  return map;
}

/**
 * 从单个会话/联系人时间序列构建「客户消息→销售回复」配对
 * @param {Array} list 已按时间升序的消息
 */
export function buildPairs(list, { accountId, sourceType }) {
  const pairs = [];
  // 识别本会话中"销售方"自己的 jid：outbound.from 中最常见的（或 inbound.to 最常见的）
  const outFrom = new Map();
  const inTo = new Map();
  for (const m of list) {
    if (m.direction === 'outbound' && m.from) outFrom.set(m.from, (outFrom.get(m.from) || 0) + 1);
    if (m.direction === 'inbound' && m.to) inTo.set(m.to, (inTo.get(m.to) || 0) + 1);
  }
  let selfJid = null;
  let max = 0;
  for (const [jid, c] of outFrom) {
    if (c > max) { max = c; selfJid = jid; }
  }
  if (!selfJid) {
    max = 0;
    for (const [jid, c] of inTo) {
      if (c > max) { max = c; selfJid = jid; }
    }
  }

  // 遍历每条客户 inbound 文本消息
  for (let i = 0; i < list.length; i++) {
    const m = list[i];
    if (m.direction !== 'inbound') continue;
    if (!hasCollectibleText(sourceType === 'message' ? m.content : m.body, sourceType === 'message' ? 'text' : m.type)) continue;
    const customerMsg = sourceType === 'message' ? String(m.content || '').trim() : String(m.body || '').trim();
    if (customerMsg.length < 2) continue;

    // 取其后 1~N 条 outbound 回复（时间窗口内）
    const replies = [];
    const replyIds = [];
    const customerId = sourceType === 'message' ? m.id : m.id;
    for (let j = i + 1; j < list.length && replies.length < CFG.maxReplyMessages; j++) {
      const r = list[j];
      if (r.direction !== 'outbound') continue;
      const windowMs = CFG.replyWindowMs;
      if (new Date(r.timestamp) - new Date(m.timestamp) > windowMs) break;
      const replyText = sourceType === 'message' ? String(r.content || '').trim() : String(r.body || '').trim();
      if (!hasCollectibleText(replyText, sourceType === 'message' ? 'text' : r.type)) continue;
      const isAiModified = !!(r.aiSuggestion && replyText !== r.aiSuggestion);
      replies.push({
        text: replyText,
        msgId: r.id,
        timestamp: r.timestamp,
        usedAi: !!r.usedAi,
        aiSuggestion: r.aiSuggestion || null,
        aiModified: isAiModified,
      });
      replyIds.push(r.id);
    }
    if (!replies.length) continue;

    // contextBefore: 该客户消息之前的最近 3 入 3 出
    const ctxBefore = [];
    let inCount = 0;
    let outCount = 0;
    for (let k = i - 1; k >= 0 && (inCount < 3 || outCount < 3); k--) {
      const c = list[k];
      const text = sourceType === 'message' ? String(c.content || '') : String(c.body || '');
      if (!hasCollectibleText(text, sourceType === 'message' ? 'text' : c.type)) continue;
      if (c.direction === 'inbound' && inCount < 3) { ctxBefore.unshift({ dir: 'customer', text: short(text, 300), ts: c.timestamp }); inCount++; }
      else if (c.direction === 'outbound' && outCount < 3) { ctxBefore.unshift({ dir: 'sales', text: short(text, 300), ts: c.timestamp }); outCount++; }
    }

    const contactJid = sourceType === 'message' ? (m.jid || '') : selfJid ? (m.from === selfJid ? m.to : m.from) : (m.from || '');
    const salesReply = replies.map((r) => r.text).join(' || ');
    pairs.push({
      accountId,
      sourceType,
      sessionId: sourceType === 'message' ? null : list[0].sessionId,
      contactJid,
      customerMsg,
      customerMsgLang: sourceType === 'message' ? (m.sourceLang || null) : (m.sourceLang || null),
      salesReply,
      salesReplies: replies,
      contextBefore: JSON.stringify(ctxBefore),
      sourceMsgIds: [customerId, ...replyIds].map(String),
      aiModified: replies.some((r) => r.aiModified),
      usedAi: replies.some((r) => r.usedAi),
      ts: new Date(m.timestamp),
      weightBase: CFG.weightBase + (replies.some((r) => r.aiModified) ? CFG.weightAiModifiedBonus : 0),
    });
  }
  return pairs;
}

export default { collectSamples, buildPairs };
