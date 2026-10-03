/**
 * Outbound Draft Service（Agent 外发安全门 —— 草稿存储 / 幂等发送 / 审计）
 * ============================================================================
 * TC-SEC-002：LLM 自主调用的 send_message / send_email 默认不再直发，
 * 统一流程为「AI 生成草稿 -> 用户查看 -> 用户确认 -> 服务端复校 -> 系统发送」。
 *
 * 设计要点（安全优先 / fail-secure）：
 * - 不改数据库结构：草稿与审计落「<cwd>/data/outbound/」下的 JSON / JSONL 文件。
 * - 草稿必须绑定 userId / tenantId / customerId / channel / target。
 * - 发送采用「乐观状态校验 + 进程内互斥锁 + 落盘已存在 sent 记录」三重幂等，
 *   防止重复点击/并发确认造成重复外发。
 * - 审计只记录正文 SHA256、长度与动作，不记录正文本身（避免不必要敏感内容）。
 * - 任何配置读取异常都按「安全草稿模式」处理，绝不回退为无门槛直发。
 *
 * 发送执行器由调用方通过 registerSenders 注入，服务本身不直接耦合通道，
 * 便于后续替换为 Prisma 存储与新增通道。
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// ---------------------------------------------------------------------------
// 存储路径
// ---------------------------------------------------------------------------
function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
  return p;
}

function baseDir() {
  const candidates = [
    path.join(process.cwd(), 'data', 'outbound'),
    path.join(process.cwd(), 'backend', 'src', 'data', 'outbound'),
  ];
  for (const p of candidates) {
    try {
      ensureDir(p);
      fs.accessSync(p, fs.constants.W_OK);
      return p;
    } catch {
      /* try next */
    }
  }
  const fallback = path.join(process.cwd(), 'data', 'outbound');
  ensureDir(fallback);
  return fallback;
}

function draftsFile() {
  return path.join(baseDir(), 'outbound-drafts.json');
}
function auditFile() {
  return path.join(baseDir(), 'outbound-audit.jsonl');
}

// ---------------------------------------------------------------------------
// 常量
// ---------------------------------------------------------------------------
export const OUTBOUND_CHANNELS = Object.freeze({
  WHATSAPP: 'whatsapp',
  EMAIL: 'email',
});

export const DRAFT_STATUSES = Object.freeze({
  PENDING: 'pending',
  SENT: 'sent',
  SENDING: 'sending',
  FAILED: 'failed',
  REJECTED: 'rejected',
  EXPIRED: 'expired',
});

export const OUTBOUND_DRAFT_TTL_MS = 24 * 60 * 60 * 1000; // 草稿 24h 有效
const MAX_SEND_ATTEMPTS = 3;

// ---------------------------------------------------------------------------
// 进程内互斥锁（按 draftId 串行化确认/发送，消除并发双发窗口）
// ---------------------------------------------------------------------------
// key -> { locked:boolean, waiters:Array<()=>void> }
const locks = new Map();

/**
 * 获取按 id 串行化的异步互斥锁。
 * 返回一个 release()，务必在 finally 中调用。
 */
function acquireLock(id) {
  return new Promise((resolve) => {
    let state = locks.get(id);
    if (!state) {
      state = { locked: true, waiters: [] };
      locks.set(id, state);
      resolve(makeRelease(id));
      return;
    }
    state.waiters.push(() => resolve(makeRelease(id)));
  });
}

function makeRelease(id) {
  let released = false;
  return function release() {
    if (released) return;
    released = true;
    const state = locks.get(id);
    if (!state) return;
    const next = state.waiters.shift();
    if (next) {
      next(); // 把锁交给下一位等待者
    } else {
      state.locked = false;
      locks.delete(id);
    }
  };
}

// ---------------------------------------------------------------------------
// JSON 草稿表读写（单节点，原子写：写临时文件 + rename）
// ---------------------------------------------------------------------------
function loadDrafts() {
  try {
    const raw = fs.readFileSync(draftsFile(), 'utf-8');
    const obj = JSON.parse(raw);
    return obj && typeof obj === 'object' ? obj : {};
  } catch {
    return {};
  }
}

let writeSeq = 0;
function saveDrafts(store) {
  const target = draftsFile();
  const tmp = `${target}.tmp-${process.pid}-${++writeSeq}`;
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2), 'utf-8');
  fs.renameSync(tmp, target);
}

function pruneExpired(store) {
  const now = Date.now();
  let changed = false;
  for (const key of Object.keys(store)) {
    const d = store[key];
    if (d.status === DRAFT_STATUSES.PENDING && now - (d.createdAt || 0) > OUTBOUND_DRAFT_TTL_MS) {
      d.status = DRAFT_STATUSES.EXPIRED;
      changed = true;
    }
  }
  return changed;
}

// ---------------------------------------------------------------------------
// 审计（append-only JSONL）
// 不记录正文：仅存动作、结果、正文 SHA256、长度，以及身份/通道等元数据。
// ---------------------------------------------------------------------------
function hashContent(text) {
  return crypto.createHash('sha256').update(String(text ?? '')).digest('hex');
}

export function writeAudit(event) {
  const row = {
    ts: new Date().toISOString(),
    ...event,
  };
  try {
    fs.appendFileSync(auditFile(), JSON.stringify(row) + '\n', 'utf-8');
  } catch (e) {
    // 审计失败不能阻断主流程，但要醒目告警
    console.error('[OutboundAudit] write failed:', e.message);
  }
  return row;
}

// ---------------------------------------------------------------------------
// 配置（安全门开关）—— fail-secure
// 仅当显式 agent_outbound_direct='true' 才可能直发；但为满足本任务
// 「Agent 路径默认安全」的要求，对外暴露 isAgentDirectAllowed 默认 false，
// 且任何异常都返回 false。
// ---------------------------------------------------------------------------
function readSettingStore() {
  // 轻量读取 .env / 内存配置；不引入 Prisma，避免测试环境依赖
  return {
    agentOutboundGate: process.env.AGENT_OUTBOUND_GATE, // 'on'/'off'
    agentOutboundDirect: process.env.AGENT_OUTBOUND_DIRECT, // 'true' 才允许直发
    outboundDryRun: process.env.OUTBOUND_DRYRUN, // '1' 走 mock，不真实外发
  };
}

/**
 * Agent 安全门是否启用。默认启用（安全）。
 * 显式 AGENT_OUTBOUND_GATE='off' 才关闭；关闭后本服务仍只走草稿，
 * 关闭门仅影响是否额外拦截（不产生直发通道），保持 fail-secure。
 */
export function isOutboundGateEnabled() {
  try {
    const c = readSettingStore();
    return String(c.agentOutboundGate || 'on').toLowerCase() !== 'off';
  } catch {
    return true;
  }
}

/**
 * 是否允许 Agent 工具直发。默认 false（fail-secure）。
 * 即便配置为 true，调用方也应谨慎；本任务默认流程一律草稿。
 */
export function isAgentDirectAllowed() {
  try {
    const c = readSettingStore();
    return String(c.agentOutboundDirect || 'false').toLowerCase() === 'true';
  } catch {
    return false;
  }
}

/** dry-run：确认时走注入的 mock 发送器，不触达真实通道。默认关。 */
export function isDryRun() {
  try {
    const c = readSettingStore();
    return String(c.outboundDryRun || '0') === '1';
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// 发送器注册（由路由/服务层注入真实或 mock 实现）
// ---------------------------------------------------------------------------
let senders = {
  // [channel]: { send: async (draft) => { ok:boolean, messageId?:string, error?:string } }
};

export function registerSenders(map) {
  senders = { ...senders, ...map };
}

// ---------------------------------------------------------------------------
// 草稿生命周期
// ---------------------------------------------------------------------------

/**
 * 创建一条外发草稿。
 * @param {object} input
 * @param {number} input.userId      - 创建/归属用户（服务端 JWT）
 * @param {number} [input.tenantId]  - 租户（默认等同 userId）
 * @param {number|null} [input.customerId]
 * @param {string} input.channel     - whatsapp | email
 * @param {string} input.target      - 目标 jid / 邮箱
 * @param {string} input.content     - WA 正文；email 时为正文
 * @param {object} [input.extra]     - email: {to,subject,body,html,emailAccountId}
 * @param {string} [input.agentType]
 * @param {string} [input.sessionId]
 * @param {object} [requestMeta]     - { ip, userAgent }
 */
export async function createDraft(input, requestMeta = {}) {
  if (!input || typeof input !== 'object') throw new Error('INVALID_INPUT');
  const userId = Number(input.userId);
  if (!Number.isInteger(userId) || userId <= 0) throw new Error('INVALID_USER');
  const channel = String(input.channel || '').toLowerCase();
  if (!Object.values(OUTBOUND_CHANNELS).includes(channel)) throw new Error('INVALID_CHANNEL');
  const target = String(input.target || '').trim();
  const content = String(input.content ?? '');
  if (!target) throw new Error('INVALID_TARGET');
  if (!content) throw new Error('EMPTY_CONTENT');

  const id = crypto.randomBytes(12).toString('hex');
  const now = Date.now();
  const draft = {
    id,
    userId,
    tenantId: Number(input.tenantId) || userId,
    customerId: input.customerId == null ? null : Number(input.customerId),
    channel,
    target,
    // WA 确认发送时使用的 Evolution 实例名（仅存服务端，LLM 无法改写）
    senderInstance: input.senderInstance || null,
    // 正文仅在「服务端草稿」内短期保存（24h TTL、文件受保护），供确认时发送；
    // 审计日志（writeAudit）只存 hash/长度，绝不写入正文。
    content,
    contentHash: hashContent(content),
    contentLength: content.length,
    // email 专属元数据（确认发送所需）
    emailAccountId: input.extra?.emailAccountId || null,
    subject: input.extra?.subject || null,
    agentType: input.agentType || 'general',
    sessionId: input.sessionId || null,
    status: DRAFT_STATUSES.PENDING,
    attempts: 0,
    messageId: null,
    createdAt: now,
    expiresAt: now + OUTBOUND_DRAFT_TTL_MS,
    createdIp: requestMeta.ip || null,
  };

  const store = loadDrafts();
  pruneExpired(store);
  store[id] = draft;
  saveDrafts(store);

  // 返回给调用方的对象带正文（仅在内存响应里用，不落审计）
  writeAudit({
    action: 'draft_created',
    result: 'ok',
    draftId: id,
    userId,
    tenantId: draft.tenantId,
    channel,
    contentHash: draft.contentHash,
    contentLength: draft.contentLength,
    ip: requestMeta.ip || null,
  });

  return { ...draft, content };
}

export function getDraft(id) {
  const store = loadDrafts();
  const d = store[id];
  if (!d) return null;
  if (d.status === DRAFT_STATUSES.PENDING && Date.now() > (d.expiresAt || 0)) {
    d.status = DRAFT_STATUSES.EXPIRED;
  }
  return d;
}

/**
 * 列出某用户（可含租户）的草稿。
 */
export function listDrafts({ userId, tenantId, status } = {}) {
  const store = loadDrafts();
  pruneExpired(store);
  saveDrafts(store);
  const uid = Number(userId);
  const tid = tenantId == null ? null : Number(tenantId);
  return Object.values(store)
    .filter((d) => {
      if (uid && d.userId !== uid && d.tenantId !== uid) return false;
      if (tid && d.tenantId !== tid) return false;
      if (status && d.status !== status) return false;
      return true;
    })
    .sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * 用户拒发。
 */
export async function rejectDraft(id, { userId, tenantId }, requestMeta = {}) {
  const release = await acquireLock(id);
  try {
    const store = loadDrafts();
    const d = store[id];
    if (!d) return { ok: false, code: 'NOT_FOUND' };
    if (d.userId !== Number(userId) && d.tenantId !== Number(tenantId)) {
      writeAudit({ action: 'draft_reject_denied', result: 'forbidden', draftId: id, userId: Number(userId), channel: d.channel, ip: requestMeta.ip || null });
      return { ok: false, code: 'FORBIDDEN' };
    }
    if (d.status === DRAFT_STATUSES.REJECTED) return { ok: true, status: d.status };
    if (d.status === DRAFT_STATUSES.SENT) return { ok: false, code: 'ALREADY_SENT' };
    d.status = DRAFT_STATUSES.REJECTED;
    store[id] = d;
    saveDrafts(store);
    writeAudit({ action: 'draft_rejected', result: 'ok', draftId: id, userId: Number(userId), channel: d.channel, contentHash: d.contentHash, ip: requestMeta.ip || null });
    return { ok: true, status: d.status };
  } finally {
    release();
  }
}

/**
 * 确认并发送（核心）。
 * 服务端在此重新校验：身份 / 租户归属 / 草稿状态 / 通道权限。
 * 三重幂等防止重复外发：
 *   1) 进入即按 draftId 加进程锁（并发确认串行化）；
 *   2) 重新落盘读取状态，status==='sent' 直接返回原 messageId（不再发送）；
 *   3) 仅在发送成功后落 'sent'，失败落 'failed' 并允许重试。
 *
 * @param {string} id
 * @param {object} identity - { userId, userRole, tenantId }（来自当前请求的 JWT）
 * @param {object} [opts]   - { dryRun }
 * @param {object} [requestMeta]
 */
export async function confirmAndSendDraft(id, identity, opts = {}, requestMeta = {}) {
  const userId = Number(identity?.userId);
  if (!Number.isInteger(userId) || userId <= 0) {
    return { ok: false, code: 'UNAUTHENTICATED' };
  }

  const release = await acquireLock(id);
  try {
    const store = loadDrafts();
    const d = store[id];
    if (!d) {
      writeAudit({ action: 'draft_confirm_denied', result: 'not_found', draftId: id, userId, ip: requestMeta.ip || null });
      return { ok: false, code: 'NOT_FOUND' };
    }

    // 1) 租户/身份归属（服务端复校，不信任前端）
    if (d.userId !== userId && d.tenantId !== userId) {
      writeAudit({
        action: 'draft_confirm_denied', result: 'forbidden', draftId: id, userId,
        ownerUserId: d.userId, channel: d.channel, ip: requestMeta.ip || null,
      });
      return { ok: false, code: 'FORBIDDEN' };
    }

    // 2) 状态校验 + 幂等
    if (d.status === DRAFT_STATUSES.SENT) {
      // 重复确认：绝不重发，直接回原 messageId
      writeAudit({ action: 'draft_confirm_duplicate', result: 'noop', draftId: id, userId, channel: d.channel, ip: requestMeta.ip || null });
      return { ok: true, status: DRAFT_STATUSES.SENT, messageId: d.messageId, duplicate: true };
    }
    if (d.status === DRAFT_STATUSES.REJECTED) return { ok: false, code: 'REJECTED' };
    if (d.status === DRAFT_STATUSES.EXPIRED || Date.now() > (d.expiresAt || 0)) {
      d.status = DRAFT_STATUSES.EXPIRED;
      store[id] = d;
      saveDrafts(store);
      return { ok: false, code: 'EXPIRED' };
    }
    if ((d.attempts || 0) >= MAX_SEND_ATTEMPTS && d.status === DRAFT_STATUSES.FAILED) {
      return { ok: false, code: 'TOO_MANY_ATTEMPTS' };
    }

    // 3) 通道发送器（dry-run 优先，测试不触达真实客户）
    const dryRun = opts.dryRun === true || isDryRun();
    const senderKey = dryRun ? '__dryrun__' : d.channel;
    const senderEntry = senders[senderKey];
    const sender = typeof senderEntry?.send === 'function' ? senderEntry.send.bind(senderEntry) : null;

    if (!sender) {
      // 没有可用发送器：安全失败，不标记成功
      d.status = DRAFT_STATUSES.FAILED;
      d.lastError = 'NO_SENDER';
      d.attempts = (d.attempts || 0) + 1;
      store[id] = d;
      saveDrafts(store);
      writeAudit({ action: 'draft_send_failed', result: 'no_sender', draftId: id, userId, channel: d.channel, attempt: d.attempts, ip: requestMeta.ip || null });
      return { ok: false, code: 'NO_SENDER' };
    }

    // 标记 sending（中间态；进程崩溃后下次确认可从 sending 恢复重试）
    d.status = DRAFT_STATUSES.SENDING;
    d.attempts = (d.attempts || 0) + 1;
    store[id] = d;
    saveDrafts(store);

    let result;
    try {
      result = await sender(d);
    } catch (e) {
      result = { ok: false, error: e?.message || 'SENDER_THREW' };
    }

    if (result && result.ok) {
      d.status = DRAFT_STATUSES.SENT;
      d.messageId = result.messageId || null;
      d.sentAt = Date.now();
      d.lastError = null;
      store[id] = d;
      saveDrafts(store);
      writeAudit({
        action: 'draft_sent', result: 'ok', draftId: id, userId, channel: d.channel,
        dryRun, attempt: d.attempts, messageId: d.messageId, contentHash: d.contentHash,
        ip: requestMeta.ip || null,
      });
      return { ok: true, status: DRAFT_STATUSES.SENT, messageId: d.messageId, dryRun };
    }

    // 发送失败：明确标记 failed，绝不误标成功
    d.status = DRAFT_STATUSES.FAILED;
    d.lastError = String(result?.error || 'SEND_FAILED').slice(0, 200);
    store[id] = d;
    saveDrafts(store);
    writeAudit({
      action: 'draft_send_failed', result: 'failed', draftId: id, userId, channel: d.channel,
      dryRun, attempt: d.attempts, error: d.lastError, contentHash: d.contentHash, ip: requestMeta.ip || null,
    });
    return { ok: false, code: 'SEND_FAILED', error: d.lastError, attempts: d.attempts };
  } finally {
    release();
  }
}

export const _internals = { hashContent, baseDir, loadDrafts, saveDrafts };
