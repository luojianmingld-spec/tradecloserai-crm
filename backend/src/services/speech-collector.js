/**
 * Speech Collector (Phase 1)
 * -------------------------
 * 自动配对「客户说 X → 销售回 Y」样本，为 AI 话术库采集训练数据。
 *
 * 仅做采集：
 * - 出站消息发送成功后调用 recordSample(outboundMsg)
 * - 查找该客户最新一条入站文本消息作为 customerMsg
 * - 带上最近上下文 (3入3出) 作为 contextBefore
 * - 从 translation JSON 提取原文/译文/语言字段
 * - 去重（同一个 waMessageId 不重复采集）
 * - fire-and-forget，不阻塞主流程，错误只打 log
 */

import { PrismaClient } from '@prisma/client';

// lazy init prisma to avoid startup overhead on import
let _prisma = null;
function prisma() {
  if (!_prisma) _prisma = new PrismaClient();
  return _prisma;
}

// In-memory deduplication: already-collected outbound waMessageId set
const collectedIds = new Set();

// Bracket placeholders like [图片], [视频], [文件], [audio]
const BRACKET_RE = /^\s*\[[^\]]+\]\s*$/;
// Common file extensions — bare filenames (e.g. "xxx.pdf", "image.png") are media, not text
const FILENAME_RE = /\.[A-Za-z0-9]{1,8}$/;
// Types considered pure media (need a caption to be collectible)
const MEDIA_TYPES = new Set(['image', 'video', 'audio', 'document', 'sticker']);

/**
 * Check whether a message is a real text/caption worth collecting.
 * - text type with non-empty, non-placeholder body → true
 * - media type → only true if body looks like a real caption (not [图片]/[视频] and not a bare filename)
 */
function hasCollectibleText(msg) {
  if (!msg) return false;
  const body = String(msg.body || '').trim();
  if (!body) return false;
  if (BRACKET_RE.test(body)) return false;
  const type = String(msg.type || 'text').toLowerCase();
  if (type === 'text') return true;
  // For media types, require a real caption: must not look like a bare filename
  if (MEDIA_TYPES.has(type)) {
    // Bare filename with extension (e.g. "Stretch Film Price List (EWX).pdf") → not a caption
    if (FILENAME_RE.test(body) && body.length < 200) {
      // Additional check: if it contains spaces/sentence punctuation it might be a caption ending with a filename
      // Be conservative: only treat as caption if it contains sentence punctuation or Chinese chars
      const hasSentence = /[。！？.!?？,，:：;；]/.test(body) || /[\u4e00-\u9fff]/.test(body);
      if (!hasSentence) return false;
    }
    return body.length >= 2; // captions typically >=2 chars
  }
  return true;
}

/**
 * Parse translation JSON safely.
 * Convention:
 *  - inbound:  body = raw foreign; translation = {original=foreign, translated=zh, sourceLang, targetLang=zh}
 *  - outbound (zh→en translated): body = en (sent); translation = {original=zh typed, translated=en, sourceLang=zh, targetLang=en}
 *  - outbound (English/no translate): translation = null
 */
function parseTranslation(transField) {
  if (!transField) return null;
  try {
    const obj = typeof transField === 'string' ? JSON.parse(transField) : transField;
    if (!obj || typeof obj !== 'object') return null;
    return {
      original: typeof obj.original === 'string' ? obj.original : null,
      translated: typeof obj.translated === 'string' ? obj.translated : null,
      sourceLang: typeof obj.sourceLang === 'string' ? obj.sourceLang : null,
      targetLang: typeof obj.targetLang === 'string' ? obj.targetLang : null,
    };
  } catch {
    return null;
  }
}

function contactJidOf(msg) {
  if (!msg) return null;
  if (msg.direction === 'outbound') return msg.to || null;
  return msg.from || null;
}

/**
 * Fire-and-forget entry. Call after outbound message saved successfully.
 * @param {object} outboundMsg - full WAMessage row just saved
 * @param {object} [opts]
 * @param {number} [opts.accountId=1]
 */
export function recordSample(outboundMsg, opts = {}) {
  _doRecord(outboundMsg, opts).catch((err) => {
    console.warn('[SpeechCollector] recordSample error:', err?.message || err);
  });
}

async function _doRecord(outboundMsg, opts) {
  if (!outboundMsg || !outboundMsg.waMessageId) return;
  const waMessageId = outboundMsg.waMessageId;
  if (collectedIds.has(waMessageId)) return;

  if (!hasCollectibleText(outboundMsg)) return;

  const contactJid = contactJidOf(outboundMsg);
  if (!contactJid) return;

  const sessionId = outboundMsg.sessionId || 'user_1';
  const accountId = opts.accountId || outboundMsg.accountId || 1;
  const outboundCreatedAt = outboundMsg.timestamp
    ? new Date(outboundMsg.timestamp)
    : outboundMsg.createdAt
    ? new Date(outboundMsg.createdAt)
    : new Date();

  // 1. Find latest inbound message from this contact BEFORE this outbound
  const inboundCandidates = await prisma().wAMessage.findMany({
    where: {
      sessionId,
      from: contactJid,
      direction: 'inbound',
      timestamp: { lt: outboundCreatedAt },
    },
    orderBy: { timestamp: 'desc' },
    take: 50,
  });

  let customerInbound = null;
  for (const m of inboundCandidates) {
    if (hasCollectibleText(m)) { customerInbound = m; break; }
  }
  if (!customerInbound) return;

  // 2. Build contextBefore: up to 3 inbound + 3 outbound prior to this reply
  const recentMsgs = await prisma().wAMessage.findMany({
    where: {
      sessionId,
      OR: [
        { from: contactJid, direction: 'inbound' },
        { to: contactJid, direction: 'outbound' },
      ],
      timestamp: { lt: outboundCreatedAt },
      NOT: { id: customerInbound.id },
    },
    orderBy: { timestamp: 'desc' },
    take: 50,
  });

  const inboundCtx = [];
  const outboundCtx = [];
  for (const m of recentMsgs) {
    if (!hasCollectibleText(m)) continue;
    if (m.direction === 'inbound' && inboundCtx.length < 3) inboundCtx.push(m);
    else if (m.direction === 'outbound' && outboundCtx.length < 3) outboundCtx.push(m);
    if (inboundCtx.length >= 3 && outboundCtx.length >= 3) break;
  }

  // Merge chronological, append the paired inbound last as immediate predecessor
  const contextMsgs = [...inboundCtx, ...outboundCtx];
  contextMsgs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  contextMsgs.push(customerInbound);

  const contextBefore = JSON.stringify(
    contextMsgs.map((m) => ({
      dir: m.direction === 'outbound' ? 'sales' : 'customer',
      text: String(m.body || '').slice(0, 500),
      ts: m.timestamp ? new Date(m.timestamp).toISOString() : null,
      type: m.type || 'text',
    }))
  );

  // 3. Translation fields
  const inboundTrans = parseTranslation(customerInbound.translation);
  const outboundTrans = parseTranslation(outboundMsg.translation);

  let customerMsg = String(customerInbound.body || '').trim();
  let customerMsgTranslated = null;
  let customerMsgLang = customerInbound.sourceLang || null;
  if (inboundTrans) {
    if (inboundTrans.original) customerMsg = inboundTrans.original;
    if (inboundTrans.translated) customerMsgTranslated = inboundTrans.translated;
    if (inboundTrans.sourceLang) customerMsgLang = inboundTrans.sourceLang;
  }

  // salesReply = what was actually sent to customer (body).
  // When zh→en translated: body=en (customer-facing), translation.original=zh (typed), targetLang=en
  // We want: salesReply = body (customer-facing, en); salesReplyTranslated = original (zh typed, for back-office).
  let salesReply = String(outboundMsg.body || '').trim();
  let salesReplyTranslated = null;
  let salesReplyLang = outboundMsg.sourceLang || null;
  if (outboundTrans) {
    // The language of what customer sees:
    // - If translation produced a different text (zh→en), then body=translated=en → lang=targetLang
    // - If body equals original (no real translation), lang=sourceLang
    if (outboundTrans.translated && outboundTrans.original && outboundTrans.translated !== outboundTrans.original) {
      // Body equals translated (sent text); translated version for review is the original (zh)
      salesReply = outboundTrans.translated;
      salesReplyTranslated = outboundTrans.original;
      salesReplyLang = outboundTrans.targetLang || outboundTrans.sourceLang || null;
    } else {
      // No real translation happened — body is already original
      salesReplyTranslated = null;
      salesReplyLang = outboundTrans.sourceLang || null;
    }
  }

  // 4. DB dedupe (covers process restart)
  const dup = await prisma().messageSample.findFirst({
    where: {
      accountId,
      contactJid,
      salesReply,
      customerMsg,
      createdAt: { gte: new Date(Date.now() - 5 * 60_000) },
    },
    select: { id: true },
  }).catch(() => null);
  if (dup) {
    collectedIds.add(waMessageId);
    return;
  }

  // 5. Persist
  const created = await prisma().messageSample.create({
    data: {
      accountId,
      contactJid,
      customerMsg,
      customerMsgTranslated,
      customerMsgLang,
      salesReply,
      salesReplyTranslated,
      salesReplyLang,
      usedAi: false,
      aiSuggestion: null,
      aiModified: false,
      contextBefore,
      industry: null,
      productLine: null,
      application: null,
      scene: null,
      favorited: false,
      qualityScore: null,
    },
    select: { id: true },
  });

  collectedIds.add(waMessageId);
  console.log(
    `[SpeechCollector] sample #${created.id} jid=${contactJid} cust="${customerMsg.slice(0, 40)}" → sales="${salesReply.slice(0, 40)}"`
  );
}

export default { recordSample };
