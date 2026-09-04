/**
 * 话术库自主学习进化 V1 - 公共服务
 * 负责: prisma 单例、租户/账号解析、去重、脱敏、LLM JSON 解析、日志
 */
import { PrismaClient } from '@prisma/client';
import { chatComplete } from '../services/ai-client.js';
import { LEARNING_CONFIG as CFG } from './config.js';

export const prisma = new PrismaClient();

export function nowIso() {
  return new Date().toISOString();
}

export function log(tag, ...args) {
  console.log(`[Learning:${tag}]`, ...args);
}

// ── LLM 调用（学习专用，带空返回重试） ────────────────────────────
/**
 * chatComplete 包装：模型偶发返回空 content（DeepSeek V4 系列 reasoning 可能吃满输出预算）
 * → 空返回/异常时自动重试，最多 retries 次，避免解析失败导致整批不入库。
 */
export async function llmChatComplete(messages, options = {}, retries = 4) {
  let lastErr = null;
  for (let i = 0; i < retries; i++) {
    try {
      const raw = await chatComplete(messages, options);
      if (raw && String(raw).trim()) return raw;
      lastErr = new Error(`LLM 返回空内容(第${i + 1}次)`);
      log('LLM', `空返回，重试 ${i + 1}/${retries}`);
    } catch (e) {
      lastErr = e;
      log('LLM', `调用失败(${i + 1}/${retries}): ${String(e.message).slice(0, 120)}`);
    }
    if (i < retries - 1) await new Promise((r) => setTimeout(r, 800 * (i + 1)));
  }
  throw lastErr;
}

// ── LLM JSON 解析 ────────────────────────────────────────────────
export function parseLLMJson(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fence) {
    try { return JSON.parse(fence[1].trim()); } catch {}
  }
  const brace = raw.match(/\{[\s\S]*\}/);
  if (brace) {
    try { return JSON.parse(brace[0]); } catch {}
  }
  const bracket = raw.match(/\[[\s\S]*\]/);
  if (bracket) {
    try { return JSON.parse(bracket[0]); } catch {}
  }
  return null;
}

// ── 文本过滤：判断是否有可学习的文本 ───────────────────────────────
const BRACKET_RE = /^\s*\[[^\]]+\]\s*$/;
const FILENAME_RE = /\.[A-Za-z0-9]{1,8}$/;
const MEDIA_TYPES = new Set(['image', 'video', 'audio', 'document', 'sticker']);

export function hasCollectibleText(body, type = 'text') {
  const b = String(body || '').trim();
  if (!b) return false;
  if (BRACKET_RE.test(b)) return false;
  const t = String(type || 'text').toLowerCase();
  if (t === 'text') return true;
  if (MEDIA_TYPES.has(t)) {
    if (FILENAME_RE.test(b) && b.length < 200) {
      const hasSentence = /[。！？.!?？,，:：;；]/.test(b) || /[\u4e00-\u9fff]/.test(b);
      if (!hasSentence) return false;
    }
    return b.length >= 2;
  }
  return true;
}

export function short(text, n = 50) {
  const s = String(text || '');
  return s.length > n ? s.slice(0, n) + '…' : s;
}

// ── 租户/账号解析 ────────────────────────────────────────────────
/**
 * WAMessage 无 accountId：sessionId → WAConnection.userId → WhatsAppAccount
 * 主用户(userId=1) 归属历史命名空间 accountId=1；其余用户归属其 WhatsAppAccount.id
 */
export async function deriveAccountIdForSession(sessionId) {
  if (!sessionId) return null;
  try {
    const conn = await prisma.wAConnection.findUnique({ where: { sessionId } });
    if (!conn) return null;
    return await accountIdFromUserId(conn.userId);
  } catch (e) {
    log('WARN', 'deriveAccountIdForSession err:', e.message);
    return null;
  }
}

/** userId → accountId（主用户→1；其余→其 WhatsAppAccount.id） */
export async function accountIdFromUserId(userId) {
  if (userId === CFG.primaryUserId) return CFG.defaultAccountId;
  const wa = await prisma.whatsAppAccount.findFirst({ where: { userId }, select: { id: true } });
  return wa ? wa.id : null;
}

/** accountId → 该租户涉及的 sessionId 列表 */
export async function sessionsForAccount(accountId) {
  const target = accountId || CFG.defaultAccountId;
  let userIds = [];
  if (target === CFG.defaultAccountId) {
    userIds = [CFG.primaryUserId];
  } else {
    const wa = await prisma.whatsAppAccount.findUnique({ where: { id: target } });
    if (wa) userIds = [wa.userId];
  }
  if (!userIds.length) return [];
  const conns = await prisma.wAConnection.findMany({
    where: { userId: { in: userIds } },
    select: { sessionId: true },
  });
  return conns.map((c) => c.sessionId);
}

/**
 * 当前登录用户可访问的 accountId 集合（跨租户隔离：私有池查询强制 accountId 过滤）
 * 主用户(userId=1) → [1]（历史命名空间）；普通用户 → 其名下 WhatsAppAccount.id
 */
export async function resolveAccountIdsForUser(userId) {
  const ids = new Set();
  if (Number(userId) === CFG.primaryUserId) {
    ids.add(CFG.defaultAccountId);
  }
  const was = await prisma.whatsAppAccount.findMany({
    where: { userId: Number(userId) },
    select: { id: true },
  });
  was.forEach((w) => ids.add(w.id));
  return [...ids];
}

// ── 脱敏（正则层） ────────────────────────────────────────────────
const DESENSITIZE_PATTERNS = [
  // 邮箱
  [/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[EMAIL]'],
  // 手机号/国际电话
  [/\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}\b/g, '[PHONE]'],
  // URL
  [/\b(?:https?:\/\/|www\.)[^\s]+/gi, '[URL]'],
  // WhatsApp JID / @ 后缀
  [/@\w+\.\w+/g, ''],
];

/** 正则层脱敏：手机号/邮箱/URL/JID */
export function regexDesensitize(text) {
  let out = String(text || '');
  for (const [re, repl] of DESENSITIZE_PATTERNS) {
    out = out.replace(re, repl);
  }
  return out;
}

/**
 * LLM 复核脱敏：进一步移除姓名/公司名/专有上下文（PII）
 * @returns {Promise<{customerMsg:string, salesReply:string}>}
 */
export async function llmDesensitize(customerMsg, salesReply) {
  const prompt = `你是数据脱敏助手。请移除以下外贸对话中的隐私信息：人名、公司全名、邮箱、手机号、具体地址、银行账号、发票号、网站URL、WhatsApp号码等PII。可保留产品名、行业、通用术语。不要改变原意与语气，只做删除/替换为[PII]。不要添加解释。

客户消息：
"""${customerMsg}"""

销售回复：
"""${salesReply}"""

请严格按如下JSON返回（不要输出其他内容）：
{"customerMsg":"脱敏后的客户消息","salesReply":"脱敏后的销售回复"}`;
  try {
    const raw = await llmChatComplete(
      [{ role: 'user', content: prompt }],
      { temperature: 0.1, max_tokens: CFG.llmMaxTokens, timeout: CFG.llmTimeoutMs }
    );
    const obj = parseLLMJson(raw);
    if (obj && typeof obj.customerMsg === 'string' && typeof obj.salesReply === 'string') {
      return { customerMsg: obj.customerMsg, salesReply: obj.salesReply };
    }
  } catch (e) {
    log('WARN', 'llmDesensitize failed, fallback to regex:', e.message);
  }
  return { customerMsg: regexDesensitize(customerMsg), salesReply: regexDesensitize(salesReply) };
}

// ── 去重 ─────────────────────────────────────────────────────────
/**
 * 查重：同租户下已存在相同(客户消息,销售回复)或 sourceMsgIds 有重叠的样本
 * @param {object} sample { accountId, customerMsg, salesReply, sourceMsgIds }
 */
export async function findDuplicateSample(sample) {
  const where = { accountId: sample.accountId };
  const ors = [];
  if (sample.customerMsg && sample.salesReply) {
    ors.push({ customerMsg: sample.customerMsg, salesReply: sample.salesReply });
  }
  if (sample.sourceMsgIds && sample.sourceMsgIds.length) {
    // sourceMsgIds 是 JSON 字符串，无法直接 in 查询，改用模糊匹配首尾 id
    for (const id of sample.sourceMsgIds.slice(0, 3)) {
      ors.push({ sourceMsgIds: { contains: String(id) } });
    }
  }
  if (!ors.length) return null;
  const found = await prisma.messageSample.findFirst({
    where: { ...where, OR: ors },
    select: { id: true },
  });
  return found;
}

/** 组合去重键（进程内快速去重） */
export function dedupeKey(sample) {
  return [sample.accountId, sample.contactJid, sample.customerMsg, sample.salesReply].join('|');
}

export default {
  prisma,
  parseLLMJson,
  hasCollectibleText,
  deriveAccountIdForSession,
  accountIdFromUserId,
  sessionsForAccount,
  resolveAccountIdsForUser,
  regexDesensitize,
  llmDesensitize,
  findDuplicateSample,
  dedupeKey,
  log,
  short,
};
