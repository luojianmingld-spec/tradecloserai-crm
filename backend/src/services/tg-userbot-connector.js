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

async function initKnownMessages() {
  if (!client) return;
  pollStartTime = Math.floor(Date.now() / 1000) - 300; // 2分钟缓冲
  try {
    const dialogs = await client.getDialogs({ limit: 8 });
    for (const d of dialogs) {
      if (!d.isUser) continue;
      const peerId = d.id?.toString?.();
      if (!peerId) continue;
      // 获取每个对话最近20条消息，确保覆盖
      const msgs = await client.getMessages(peerId, { limit: 3 });
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
      if (!d.isUser) continue;
      const peerId = d.id?.toString?.();
      if (!peerId) continue;
      if (di > 0) await new Promise(r => setTimeout(r, 2000));
      const msgs = await client.getMessages(peerId, { limit: 3 });
      for (const m of msgs) {
        if (lastKnownMsgIds.has(m.id)) continue;
        // 只处理最近2分钟内的消息，避免捡到老消息
        if (m.date && m.date < pollStartTime) { lastKnownMsgIds.add(m.id); continue; }
        if (m.out) { lastKnownMsgIds.add(m.id); continue; } // 跳过自己发的
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
      // 只处理私聊消息
      if (msg.peerId && msg.peerId.className !== 'PeerUser') return;
      // 跳过自己发的
      if (msg.out) return;

      const peerId = msg.peerId?.userId?.toString() || msg.senderId?.toString();
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
  client.addEventHandler(async (update) => {
    rawCount++;
    if (rawCount <= 50) {
      const ctorName = update?.constructor?.name || update?.className || 'unknown';
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
    // 只处理私聊消息
    if (msg.peerId.className !== 'PeerUser') return;
    // 跳过自己发的
    if (msg.out) return;

    const peerId = msg.peerId.userId.toString();
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
    // 群组消息暂不处理（CRM只做私聊）
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
    if (!dialog.isUser) continue; // 只取私聊
    const entity = dialog.entity || dialog.participant;
    dialogs.push({
      id: dialog.id?.toString?.() || (entity ? entity.id.toString() : ''),
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
    messages.push({
      id: msg.id,
      text: msg.message || (msg.media ? `[${msg.media.className}]` : ''),
      fromMe: msg.out || false,
      timestamp: msg.date ? (msg.date * 1000) : Date.now(),
      mediaType: msg.media ? msg.media.className : null,
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
      displayName: [entity.firstName, entity.lastName].filter(Boolean).join(' ').trim() || entity.username || '',
    };
  } catch (e) {
    return null;
  }
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
}

export function getClient() { return client; }
export function getState() { return connectionState; }
export function getMe() { return me; }
export function isConnected() { return connectionState === 'connected'; }
