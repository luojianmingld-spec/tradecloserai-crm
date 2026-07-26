/**
 * Telegram User Bot Connector (基于 GramJS)
 * 功能：个人TG号登录，同步联系人和历史消息，实时收发，主动发起对话
 * 会话持久化在 backend/data/tg-userbot/ 目录
 */
import { TelegramClient, Api } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
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
  const { apiId, apiHash, codeCallback } = opts;
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
    eventHandlers = opts.onEvent; // { onMessage, onReady, onError }
  }

  connectionState = 'connecting';
  console.log('[TG-UB] Connecting to Telegram...');

  await client.start({
    phoneNumber: async () => {
      if (codeCallback && codeCallback.onPhoneNumber) {
        return await codeCallback.onPhoneNumber();
      }
      throw new Error('需要手机号，但未提供codeCallback.onPhoneNumber');
    },
    phoneCode: async () => {
      if (codeCallback && codeCallback.onCode) {
        return await codeCallback.onCode();
      }
      throw new Error('需要验证码，但未提供codeCallback.onCode');
    },
    password: async () => {
      if (codeCallback && codeCallback.onPassword) {
        return await codeCallback.onPassword();
      }
      // 如果没有2FA密码，返回空
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

/** 监听新消息 */
function registerUpdateHandler() {
  if (!client) return;
  client.addEventHandler(async (update) => {
    try {
      await handleIncomingUpdate(update);
    } catch (e) {
      console.error('[TG-UB] update handler error:', e.message);
    }
  });
}

async function handleIncomingUpdate(update) {
  // 新消息
  if (update.className === 'UpdateNewMessage' || update.className === 'UpdateNewChannelMessage') {
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
  const sent = await client.sendMessage(peerId, {
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
  if (client) {
    try { await client.invoke(new Api.auth.LogOut()); } catch {}
    client = null;
  }
  try { fs.unlinkSync(SESSION_FILE); } catch {}
  connectionState = 'disconnected';
  me = null;
}

export function getClient() { return client; }
export function getState() { return connectionState; }
export function getMe() { return me; }
export function isConnected() { return connectionState === 'connected'; }
