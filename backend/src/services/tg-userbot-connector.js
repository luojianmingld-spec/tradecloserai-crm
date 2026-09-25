/**
 * Telegram User Bot Connector (基于 GramJS)
 * 功能：个人TG号登录，同步联系人和历史消息，实时收发，主动发起对话
 * 会话持久化在 backend/data/tg-userbot/ 目录
 */
import { TelegramClient, Api } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { NewMessage } from 'telegram/events/index.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '../../data/tg-userbot');
const SESSION_FILE = path.join(DATA_DIR, 'session.txt');
const STATE_FILE = path.join(DATA_DIR, 'state.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

let client = null;
let connectionState = 'disconnected';
let eventHandlers = {};
let me = null; // 当前登录用户信息

/** 读取保存的session string */
function loadSession() {
  try {
    if (fs.existsSync(SESSION_FILE)) return fs.readFileSync(SESSION_FILE, 'utf8').trim();
  } catch {}
  return '';
}

function saveSession(sessionStr) {
  fs.writeFileSync(SESSION_FILE, sessionStr, 'utf8');
}

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {}
  return {};
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
}

/**
 * 初始化并连接TG User Bot
 * @param {object} opts { apiId, apiHash, phoneNumber?, onEvent?, codeCallback? }
 *   - codeCallback: 异步函数()=>string，用于获取验证码（如果需要交互登录）
 */
export async function initUserBot(opts) {
  const { apiId, apiHash, phoneNumber, codeCallback } = opts;
  if (!apiId || !apiHash) throw new Error('TG User Bot 需要 apiId 和 apiHash');

  const sessionStr = loadSession();
  const stringSession = new StringSession(sessionStr);

  client = new TelegramClient(stringSession, Number(apiId), String(apiHash), {
    connectionRetries: 5,
    useWSS: false,
    timeout: 30000,
  });

  // 注册事件回调
  if (opts.onEvent) {
    eventHandlers = opts.onEvent;
  }

  connectionState = 'connecting';
  console.log('[TG-UB] Connecting to Telegram...');

  await client.start({
    phoneNumber: phoneNumber || (async () => {
      if (codeCallback && codeCallback.onPhoneNumber) {
        console.log('[TG-UB] phoneNumber callback called');
        return await codeCallback.onPhoneNumber();
      }
      throw new Error('需要手机号，但未提供');
    }),
    phoneCode: async () => {
      console.log('[TG-UB] phoneCode callback called, waiting for code...');
      if (codeCallback && codeCallback.onCode) {
        return await codeCallback.onCode();
      }
      throw new Error('需要验证码，但未提供');
    },
    password: async () => {
      console.log('[TG-UB] password callback called');
      if (codeCallback && codeCallback.onPassword) {
        return await codeCallback.onPassword();
      }
      return '';
    },
    onError: (err) => {
      console.error('[TG-UB] auth error:', err.message);
      connectionState = 'error';
      if (eventHandlers.onError) eventHandlers.onError(err);
    },
  });

  // 保存session
  saveSession(client.session.save());
  console.log('[TG-UB] Logged in successfully, session saved');

  me = await client.getMe();
  console.log(`[TG-UB] Logged in as: ${me.username || me.phone || me.id.toString()}`);
  connectionState = 'connected';

  // 注册消息更新监听
  registerUpdateHandler();

  if (eventHandlers.onReady) eventHandlers.onReady(me);
  return me;
}

/** 使用已有session自动重连（服务器启动时调用） */
export async function autoConnectUserBot(opts) {
  const { apiId, apiHash, onEvent } = opts;
  if (!apiId || !apiHash) return null;
  const sessionStr = loadSession();
  if (!sessionStr) {
    console.log('[TG-UB] No saved session, skipping auto-connect');
    return null;
  }
  try {
    const stringSession = new StringSession(sessionStr);
    client = new TelegramClient(stringSession, Number(apiId), String(apiHash), {
      connectionRetries: 3,
    });
    eventHandlers = onEvent || {};
    connectionState = 'connecting';
    await client.connect();
    me = await client.getMe();
    connectionState = 'connected';
    console.log(`[TG-UB] Auto-connected as: ${me.username || me.phone || me.id.toString()}`);
    registerUpdateHandler();
    // 显式请求更新状态，触发消息推送
    try {
      const state = await client.invoke(new Api.updates.GetState());
      console.log('[TG-UB] GetState success, pts=' + state?.pts + ' qts=' + state?.qts);
    } catch (e) {
      console.warn('[TG-UB] GetState failed:', e.message);
    }

    // 启动轮询兜底：每30秒主动拉取最新私聊消息
    startPolling();

    if (eventHandlers.onReady) eventHandlers.onReady(me);
    return me;
  } catch (e) {
    console.error('[TG-UB] Auto-connect failed:', e.message);
    connectionState = 'error';
    // 清除坏session
    try { fs.unlinkSync(SESSION_FILE); } catch {}
    return null;
  }
}


// ── 轮询兜底机制 ──
let pollingTimer = null;
let handlerRegistered = false;
let lastKnownMsgIds = new Set(); // 已处理的消息ID

function startPolling() {
  if (pollingTimer) return;
  console.log('[TG-UB] Starting message polling (every 120s)...');
  // 先初始化已知消息ID集合
  initKnownMessages().then(() => {
    pollingTimer = setInterval(() => pollNewMessages(), 120000);
  }).catch(e => {
    console.warn('[TG-UB] initKnownMessages failed:', e.message);
    pollingTimer = setInterval(() => pollNewMessages(), 120000);
  });
}

export function stopPolling() {
  if (pollingTimer) { clearInterval(pollingTimer); pollingTimer = null; }
}

let pollStartTime = 0; // 只处理此时间戳之后的消息

/** 提取会话归属 peerId（私聊=对方user，群=群chat，频道=channel；支持负数/超大id转字符串） */
function tgPeerIdOf(peerId) {
  if (!peerId) return null;
  const cn = peerId.className;
  let v = cn === 'PeerUser' ? peerId.userId
        : cn === 'PeerChat' ? peerId.chatId
        : cn === 'PeerChannel' ? peerId.channelId
        : null;
  // Telegram 群组/频道完整 id 需带 -100 前缀；与轮询 d.id（已带 -100）对齐，避免同一会话两种 jid 重复建档
  if (cn === 'PeerChannel' && v != null && !String(v).startsWith('-100')) {
    v = '-100' + String(v);
  }
  return v == null ? null : String(v);
}

async function initKnownMessages() {
  if (!client) return;
  pollStartTime = Math.floor(Date.now() / 1000) - 30; // 30秒缓冲
  try {
    const dialogs = await client.getDialogs({ limit: 8 });
    for (const d of dialogs) {
      // 群组/频道/私聊全部放行
      const peerId = d.id?.toString?.();
      if (!peerId) continue;
      // 获取每个对话最近20条消息，确保覆盖
      const msgs = await client.getMessages(peerId, { limit: 20 });
      for (const m of msgs) {
        lastKnownMsgIds.add(m.id);
      }
    }
    console.log('[TG-UB] Initialized ' + lastKnownMsgIds.size + ' known msg IDs, pollStartTime=' + pollStartTime);
  } catch (e) {
    console.warn('[TG-UB] initKnownMessages error:', e.message);
  }
}

async function pollNewMessages() {
  if (!client || connectionState !== 'connected') return;
  try {
    const dialogs = await client.getDialogs({ limit: 8 });
    for (let di = 0; di < dialogs.length; di++) {
      const d = dialogs[di];
      // 群组/频道/私聊全部放行
      const peerId = d.id?.toString?.();
      if (!peerId) continue;
      if (di > 0) await new Promise(r => setTimeout(r, 2000));
      const msgs = await client.getMessages(peerId, { limit: 20 });
      for (const m of msgs) {
        if (lastKnownMsgIds.has(m.id)) continue;
        // 只处理最近2分钟内的消息，避免捡到老消息
        if (m.date && m.date < pollStartTime) { lastKnownMsgIds.add(m.id); continue; }
        if (m.out) {
          // 处理从外部(如ChatKnow)发出的消息，同步到CRM
          lastKnownMsgIds.add(m.id);
          const text = m.message || (m.media ? '[media]' : '');
          const outgoing = {
            chatId: peerId,
            messageId: m.id,
            text: text,
            timestamp: m.date ? (m.date * 1000) : Date.now(),
            mediaType: m.media ? m.media.className : null,
            fromMe: true,
            raw: m,
          };
          console.log('[TG-UB] Poll found OUTGOING message to', peerId, 'text:', text?.substring(0, 50));
          if (eventHandlers.onMessage) eventHandlers.onMessage(outgoing);
          continue;
        }
        lastKnownMsgIds.add(m.id);
        const text = m.message || (m.media ? '[media]' : '');
        const incoming = {
          chatId: peerId,
          messageId: m.id,
          text: text,
          timestamp: m.date ? (m.date * 1000) : Date.now(),
          mediaType: m.media ? m.media.className : null,
          fromMe: false,
          raw: m,
        };
        console.log('[TG-UB] Poll found message from', peerId, 'text:', text?.substring(0, 50));
        if (eventHandlers.onMessage) eventHandlers.onMessage(incoming);
      }
    }
  } catch (e) {
    console.warn('[TG-UB] Poll error:', e.message);
  }
}

/** 监听新消息 */
function registerUpdateHandler() {
  if (!client) return;
  if (handlerRegistered) { console.log('[TG-UB] Handler already registered, skip'); return; }
  handlerRegistered = true;
  console.log('[TG-UB] Registering update handler...');

  // 方法1: 用 NewMessage 事件类注册（最可靠）
  client.addEventHandler(async (event) => {
    try {
      const msg = event.message;
      if (!msg) return;
      // 跳过自己发的
      if (msg.out) return;

      // 会话归属 peer：私聊=对方，群=群(PeerChat/PeerChannel)
      const peerId = tgPeerIdOf(msg.peerId) || msg.senderId?.toString();
      if (!peerId) return;
      const text = msg.message || '';
      const msgId = msg.id;
      const timestamp = msg.date ? (msg.date * 1000) : Date.now();
      const mediaType = msg.media ? msg.media.className : null;

      const incoming = {
        chatId: peerId,
        messageId: msgId,
        text: text || (mediaType ? `[${mediaType}]` : ''),

        timestamp,
        mediaType,
        fromMe: false,
        raw: msg,
      };

      console.log('[TG-UB] NewMessage from', peerId, 'text:', text?.substring(0, 50));
      if (eventHandlers.onMessage) eventHandlers.onMessage(incoming);
    } catch (e) {
      console.error('[TG-UB] NewMessage handler error:', e.message);
    }
  }, new NewMessage({}));

  // 方法2: 同时也注册 raw handler 兜底（处理 UpdateShortMessage 等）
  let rawCount = 0;
  const SKIP_LOG_TYPES = new Set(['UpdateConnectionState']);
  client.addEventHandler(async (update) => {
    rawCount++;
    const ctorName = update?.constructor?.name || update?.className || 'unknown';
    if (!SKIP_LOG_TYPES.has(ctorName) && rawCount <= 100) {
      console.log('[TG-UB] Raw update #' + rawCount + ': ' + ctorName);
    }
    try {
      await handleIncomingUpdate(update);
    } catch (e) {
      // ignore raw handler errors
    }
  });

  console.log('[TG-UB] Update handlers registered. Client connected:', client.connected);
}

async function handleIncomingUpdate(update) {
  const ctorName = update?.constructor?.name || '';
  // 新消息
  if (ctorName === 'UpdateNewMessage' || ctorName === 'UpdateNewChannelMessage' || update.className === 'UpdateNewMessage' || update.className === 'UpdateNewChannelMessage') {
    const msg = update.message;
    if (!msg || !msg.peerId) return;
    // 跳过自己发的
    if (msg.out) return;

    const peerId = tgPeerIdOf(msg.peerId);
    if (!peerId) return;
    const text = msg.message || '';
    const msgId = msg.id;
    const timestamp = msg.date ? (msg.date * 1000) : Date.now(); // TG返回秒级时间戳
    const mediaType = msg.media ? msg.media.className : null;

    // 获取发送者信息
    let sender = null;
    try {
      const users = await client.getMessages(peerId, { ids: [msgId] });
      sender = msg.fromId ? { id: msg.fromId.userId.toString() } : { id: peerId };
    } catch {}

    const incoming = {
      chatId: peerId,
      messageId: msgId,
      text: text || (mediaType ? `[${mediaType}]` : ''),
      timestamp,
      mediaType,
      fromMe: false,
      raw: msg,
    };

    if (eventHandlers.onMessage) eventHandlers.onMessage(incoming);
    return;
  }

  // UpdateShortMessage - 新私聊消息（短格式）
  if (ctorName === 'UpdateShortMessage' || update.className === 'UpdateShortMessage') {
    // 跳过自己发的
    if (update.out) return;

    const peerId = update.userId?.toString();
    if (!peerId) return;
    const text = update.message || '';
    const msgId = update.id;
    const timestamp = update.date ? (update.date * 1000) : Date.now();

    const incoming = {
      chatId: peerId,
      messageId: msgId,
      text: text || '',
      timestamp,
      mediaType: null,
      fromMe: false,
      raw: update,
    };

    console.log('[TG-UB] UpdateShortMessage from', peerId, 'text:', text?.substring(0, 50));
    if (eventHandlers.onMessage) eventHandlers.onMessage(incoming);
    return;
  }

  // UpdateShortChatMessage - 群组短消息
  if (ctorName === 'UpdateShortChatMessage' || update.className === 'UpdateShortChatMessage') {
    if (update.out) return;
    const peerId = update.chatId?.toString?.();
    if (!peerId) return;
    const text = update.message || '';
    const msgId = update.id;
    const timestamp = update.date ? (update.date * 1000) : Date.now();
    const incoming = {
      chatId: peerId,
      messageId: msgId,
      text: text || '',
      timestamp,
      mediaType: null,
      fromMe: false,
      raw: update,
    };
    console.log('[TG-UB] UpdateShortChatMessage from', peerId, 'text:', text?.substring(0, 50));
    if (eventHandlers.onMessage) eventHandlers.onMessage(incoming);
    return;
  }
}

/** 获取所有联系人 */
export async function getContacts() {
  if (!client || connectionState !== 'connected') throw new Error('TG User Bot not connected');
  const result = await client.invoke(new Api.contacts.GetContacts({ hash: BigInt(0) }));
  const users = result.users || [];
  return users.map(u => ({
    id: u.id.toString(),
    firstName: u.firstName || '',
    lastName: u.lastName || '',
    username: u.username || '',
    phone: u.phone || '',
    mutualContact: u.mutualContact || false,
    bot: u.bot || false,
    verified: u.verified || false,
    displayName: [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.username || `tg_${u.id}`,
  }));
}

/** 获取所有对话（chats列表，含最近消息时间） */
export async function getDialogs(limit = 100) {
  if (!client || connectionState !== 'connected') throw new Error('TG User Bot not connected');
  const dialogs = [];
  for await (const dialog of client.iterDialogs({ limit })) {
    const type = dialog.isUser ? 'private' : (dialog.isGroup ? 'group' : (dialog.isChannel ? 'channel' : 'other'));
    const entity = dialog.entity || dialog.participant;
    dialogs.push({
      id: dialog.id?.toString?.() || (entity ? entity.id.toString() : ''),
      type,
      isGroup: !!dialog.isGroup,
      isChannel: !!dialog.isChannel,
      name: dialog.name || [entity?.firstName, entity?.lastName].filter(Boolean).join(' ').trim() || entity?.username || '',
      username: entity?.username || '',
      phone: entity?.phone || '',
      lastMessage: dialog.message?.message || (dialog.message?.media ? `[${dialog.message?.media?.className}]` : ''),
      lastMessageDate: dialog.message?.date ? (dialog.message.date * 1000) : null,
      unreadCount: dialog.unreadCount || 0,
      pinned: dialog.pinned || false,
    });
  }
  return dialogs;
}

/** 获取某个聊天的历史消息 */
export async function getHistory(peerId, limit = 50, offsetId = 0) {
  if (!client || connectionState !== 'connected') throw new Error('TG User Bot not connected');
  const messages = [];
  for await (const msg of client.iterMessages(peerId, { limit, offsetId })) {
    // 提取回复引用信息
    let replyToMsgId = null;
    let replyToBody = null;
    try {
      if (msg.replyTo) {
        replyToMsgId = msg.replyTo.replyToMsgId || null;
        // quoteText 在某些 GramJS 版本中不可用
        if (msg.replyTo.quoteText) {
          replyToBody = msg.replyTo.quoteText;
        }
      }
    } catch(e) { /* ignore */ }
    messages.push({
      id: msg.id,
      text: msg.message || (msg.media ? `[${msg.media.className}]` : ''),
      fromMe: msg.out || false,
      timestamp: msg.date ? (msg.date * 1000) : Date.now(),
      mediaType: msg.media ? msg.media.className : null,
      replyToMsgId,
      replyToBody,
      raw: msg,
    });
  }
  return messages.reverse(); // 旧到新
}

/** 发送文本消息 */
export async function sendMessage(peerId, text, options = {}) {
  if (!client || connectionState !== 'connected') throw new Error('TG User Bot not connected');
  // GramJS requires numeric peer ID (string numbers are rejected)
  const numericPeer = typeof peerId === 'string' ? Number(peerId) : peerId;
  const sent = await client.sendMessage(numericPeer, {
    message: text,
    ...options,
  });
  return {
    id: sent.id,
    text: sent.message || text,
    fromMe: true,
    timestamp: sent.date ? (sent.date * 1000) : Date.now(),
    replyToMsgId: options?.replyToMsgId || null,
  };
}

/** 通过手机号添加联系人 */
export async function addContactByPhone(phone, firstName, lastName = '') {
  if (!client || connectionState !== 'connected') throw new Error('TG User Bot not connected');
  // 先查找
  try {
    const result = await client.invoke(new Api.contacts.ImportContacts({
      contacts: [new Api.InputPhoneContact({
        clientId: BigInt(Date.now()),
        phone: String(phone),
        firstName: firstName || '',
        lastName: lastName || '',
      })],
    }));
    const users = result.users || [];
    if (users.length > 0) {
      return {
        id: users[0].id.toString(),
        firstName: users[0].firstName || '',
        lastName: users[0].lastName || '',
        username: users[0].username || '',
        phone: users[0].phone || phone,
      };
    }
    return null;
  } catch (e) {
    console.error('[TG-UB] addContact error:', e.message);
    throw e;
  }
}

/** 通过用户名/ID获取用户信息 */
export async function getUserInfo(peerId) {
  if (!client || connectionState !== 'connected') throw new Error('TG User Bot not connected');
  try {
    const entity = await client.getEntity(peerId);
    return {
      id: entity.id.toString(),
      firstName: entity.firstName || '',
      lastName: entity.lastName || '',
      username: entity.username || '',
      phone: entity.phone || '',
      displayName: [entity.firstName, entity.lastName].filter(Boolean).join(' ').trim() || entity.username || entity.title || '',
    };
  } catch (e) {
    return null;
  }
}

/** 下载用户头像到本地 */
export async function downloadProfilePhoto(peerId) {
  if (!client || connectionState !== 'connected') return null;
  try {
    const entity = await client.getEntity(Number(peerId));
    if (!entity || !entity.photo) return null;
    const buf = await client.downloadProfilePhoto(entity);
    if (!buf || buf.length === 0) return null;
    const uploadDir = path.join(__dirname, '../../uploads/tg-avatars');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    const fname = 'avatar_' + peerId + '_' + Date.now() + '.jpg';
    const fpath = path.join(uploadDir, fname);
    fs.writeFileSync(fpath, Buffer.isBuffer(buf) ? buf : Buffer.from(buf));
    return '/uploads/tg-avatars/' + fname;
  } catch (e) { console.warn('[TG-UB] downloadProfilePhoto error:', peerId, e.message); return null; }
}
/** 登出并清除session */
export async function logout() {
  stopPolling();
  if (client) {
    try { await client.invoke(new Api.auth.LogOut()); } catch {}
    client = null;
  }
  try { fs.unlinkSync(SESSION_FILE); } catch {}
  connectionState = 'disconnected';
  handlerRegistered = false;
  me = null;
  cleanupQRLogin();
}



/** QR码登录状态（真实实现） */
let qrLoginState = {
  token: null,
  expiresAt: 0,
  client: null,
  loginPromise: null,
  status: 'idle',        // idle | waiting_scan | password_needed | connected | expired | error
  user: null,
  error: null,
  resolvePassword: null,
};

function qrTokenToBase64url(token) {
  // token 是 Uint8Array，转 base64url（无 padding）
  return Buffer.from(token).toString('base64url');
}

function cleanupQRLogin() {
  // 若当前 client 已提升为全局登录 client，不能断开（否则会杀死已成功登录的连接）
  if (qrLoginState.client && qrLoginState.client !== client &&
      (qrLoginState.status === 'waiting_scan' || qrLoginState.status === 'password_needed')) {
    try { qrLoginState.client.disconnect(); } catch {}
  }
  qrLoginState = {
    token: null, expiresAt: 0, client: null, loginPromise: null,
    status: 'idle', user: null, error: null, resolvePassword: null,
  };
}

/**
 * 生成真实 TG 登录二维码 token
 * @param {object} creds { apiId, apiHash }
 */
export async function getQRCode(creds = {}) {
  const { apiId, apiHash } = creds;
  if (!apiId || !apiHash) throw new Error('需要 apiId 和 apiHash');
  if (isConnected()) return { status: 'already_connected', user: getMe() };

  // 复用未过期的进行中流程（前端刷新/轮询场景）；并发请求不得重建流程
  if (qrLoginState.client &&
      ['waiting_scan', 'password_needed'].includes(qrLoginState.status)) {
    if (qrLoginState.token) {
      return { status: 'pending', token: qrLoginState.token, expires: qrLoginState.expiresAt };
    }
    // token 尚未生成，等待最多 10s
    const dl = Date.now() + 10000;
    while (!qrLoginState.token && Date.now() < dl) await new Promise(r => setTimeout(r, 200));
    if (qrLoginState.token) {
      return { status: 'pending', token: qrLoginState.token, expires: qrLoginState.expiresAt };
    }
  }

  // 清理旧流程
  cleanupQRLogin();

  const stringSession = new StringSession('');
  const qrClient = new TelegramClient(stringSession, Number(apiId), String(apiHash), {
    connectionRetries: 3,
  });

  qrLoginState = {
    token: null, expiresAt: 0, client: qrClient, loginPromise: null,
    status: 'waiting_scan', user: null, error: null, resolvePassword: null,
  };

  // 先连接，再用 signInUserWithQrCode 走真实 QR 登录流程
  await qrClient.connect();
  const loginPromise = qrClient.signInUserWithQrCode({ apiId: Number(apiId), apiHash: String(apiHash) }, {
    qrCode: async (qr) => {
      // qr.token: Buffer, qr.expires: 秒
      qrLoginState.token = qrTokenToBase64url(qr.token);
      qrLoginState.expiresAt = Date.now() + 60000; // 固定60s窗口，覆盖扫码+手机确认耗时
      console.log('[TG-UB] QR token ready, expires in', qr.expires, 's');
    },
    password: async () => {
      qrLoginState.status = 'password_needed';
      console.log('[TG-UB] QR 2FA password needed');
      return await new Promise((resolve) => { qrLoginState.resolvePassword = resolve; });
    },
    onError: async (err) => {
      console.error('[TG-UB] QR login onError:', err.message);
      if (qrLoginState.status !== 'connected') {
        qrLoginState.status = 'error';
        qrLoginState.error = err.message;
      }
      return false; // 不终止，让流程继续（避免 token 过期即失败）
    },
  }).then(async (user) => {
    // 登录成功：保存 session，提升为全局 client
    const sessionStr = qrClient.session.save();
    saveSession(sessionStr);
    client = qrClient;
    me = user;
    connectionState = 'connected';
    registerUpdateHandler();
    startPolling();
    qrLoginState.status = 'connected';
    qrLoginState.user = user;
    console.log('[TG-UB] QR login success:', (user.username || user.phone || user.id.toString()));
    return user;
  }).catch((e) => {
    if (e && e.errorMessage === 'SESSION_PASSWORD_NEEDED') return; // 由 password 回调接管
    console.error('[TG-UB] QR login failed:', e && e.message);
    if (qrLoginState.status !== 'connected') {
      qrLoginState.status = 'error';
      qrLoginState.error = (e && e.message) || String(e);
    }
  });

  qrLoginState.loginPromise = loginPromise;

  // 等待 token 生成（最多 10 秒）
  const deadline = Date.now() + 10000;
  while (!qrLoginState.token && Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 200));
  }
  if (!qrLoginState.token) {
    qrLoginState.status = 'error';
    qrLoginState.error = 'QR token generation timeout';
    return { status: 'error', error: qrLoginState.error };
  }
  return { status: 'pending', token: qrLoginState.token, expires: qrLoginState.expiresAt };
}

/** 轮询 QR 登录状态 */
export async function pollQRLogin(qrToken) {
  // 全局已连接：直接返回 connected（不管 token 是否匹配），避免前端一直卡在刷新循环
  if (isConnected()) return { status: 'connected', user: getMe() };
  if (!qrLoginState.token || qrLoginState.token !== qrToken) {
    return { status: 'invalid' };
  }
  if (qrLoginState.status === 'connected') {
    return { status: 'connected', user: qrLoginState.user };
  }
  if (qrLoginState.status === 'password_needed') {
    return { status: 'password_needed' };
  }
  if (qrLoginState.status === 'error') {
    return { status: 'error', error: qrLoginState.error };
  }
  if (Date.now() > qrLoginState.expiresAt + 10000) {
    qrLoginState.status = 'expired';
    return { status: 'expired' };
  }
  return { status: 'pending', token: qrLoginState.token, expires: qrLoginState.expiresAt };
}

/** 提交 QR 登录 2FA 密码 */
export async function submitQRPassword(password) {
  if (qrLoginState.status !== 'password_needed' || !qrLoginState.resolvePassword) {
    throw new Error('没有等待中的 QR 2FA 流程');
  }
  const resolve = qrLoginState.resolvePassword;
  qrLoginState.resolvePassword = null;
  resolve(password);
  return { status: 'submitted' };
}


/** 发送文件/图片/视频（通过 GramJS sendFile） */
export async function sendFile(peerId, buffer, fileName = 'file', options = {}) {
  if (!client || connectionState !== 'connected') throw new Error('TG User Bot not connected');
  const numericPeer = typeof peerId === 'string' ? Number(peerId) : peerId;
  const caption = options.caption || '';
  const mt = (options.mimeType || '').toLowerCase();
  let forceDocument = false;
  if (mt.startsWith('image/')) forceDocument = false;
  else if (mt.startsWith('video/')) forceDocument = false;
  else forceDocument = true;
  const result = await client.sendFile(numericPeer, {
    file: buffer,
    caption: caption,
    forceDocument: forceDocument,
    fileName: fileName,
  });
  return {
    id: result.id,
    caption: caption,
    fromMe: true,
    timestamp: result.date ? (result.date * 1000) : Date.now(),
  };
}


export function getClient() { return client; }
export function getState() { return connectionState; }
export function getMe() { return me; }
export function isConnected() { return connectionState === 'connected'; }
