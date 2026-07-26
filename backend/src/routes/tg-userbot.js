/**
 * TG User Bot API Routes
 * 登录流程: POST /login (传手机号) → 等TG验证码 → POST /login/code (传验证码)
 */
import { Router } from 'express';
import {
  initUserBot,
  autoConnectUserBot,
  getContacts,
  getDialogs,
  getHistory,
  sendMessage,
  addContactByPhone,
  getUserInfo,
  logout,
  getState,
  getMe,
  isConnected,
} from '../services/tg-userbot-connector.js';

const router = Router();

// TG API credentials (Telegram Desktop开源客户端)
const API_ID = 33683021;
const API_HASH = 'c0fba584709b3b8ec13c0a5e18b94f75';

// 登录状态管理
let loginState = {
  pending: false,
  resolvePhone: null,
  resolveCode: null,
  resolvePassword: null,
  loginPromise: null,
  loginError: null,
};

// --- Login flow ---
router.post('/login', async (req, res) => {
  const { phoneNumber } = req.body;
  if (!phoneNumber) return res.status(400).json({ error: '需要phoneNumber' });
  if (isConnected()) return res.json({ status: 'already_connected', user: getMe() });

  // Reset login state
  loginState = { pending: true, resolvePhone: null, resolveCode: null, resolvePassword: null, loginPromise: null, loginError: null };

  // Simple promise for code - phone number provided directly
  const codePromise = new Promise((resolve) => { loginState.resolveCode = resolve; });
  const passwordPromise = new Promise((resolve) => { loginState.resolvePassword = resolve; });

  console.log('[TG-UB] Starting login with phone:', phoneNumber);

  // Start login in background with phone number directly
  loginState.loginPromise = initUserBot({
    apiId: API_ID,
    apiHash: API_HASH,
    phoneNumber: phoneNumber,
    codeCallback: {
      onPhoneNumber: async () => phoneNumber,
      onCode: async () => {
        console.log('[TG-UB] Waiting for verification code...');
        return await codePromise;
      },
      onPassword: async () => {
        console.log('[TG-UB] Waiting for 2FA password...');
        return await passwordPromise;
      },
    },
    onEvent: {
      onMessage: (msg) => console.log('[TG-UB] Incoming:', msg),
      onReady: (me) => console.log('[TG-UB] Ready:', me.username || me.id),
      onError: (err) => {
        console.error('[TG-UB] Event error:', err.message);
        loginState.loginError = err.message;
      },
    },
  }).catch(e => {
    console.error('[TG-UB] Login failed:', e.message);
    loginState.loginError = e.message;
  });

  res.json({ status: 'waiting_code', message: '验证码已发送到你的TG，请提供验证码' });
});

// Submit verification code
router.post('/login/code', async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: '需要验证码' });
  if (!loginState.resolveCode) return res.status(400).json({ error: '没有等待中的登录流程' });

  try {
    loginState.resolveCode(code);
    loginState.loginState = 'code_submitted';
    // Wait for login to complete (with timeout)
    const result = await Promise.race([
      loginState.loginPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('登录超时')), 30000)),
    ]);
    loginState.pending = false;
    res.json({ status: 'success', user: { id: result.id.toString(), username: result.username, phone: result.phone } });
  } catch (e) {
    loginState.pending = false;
    res.status(500).json({ error: '登录失败: ' + e.message });
  }
});

// Submit 2FA password (if account has two-step verification)
router.post('/login/password', async (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: '需要密码' });
  if (!loginState.resolvePassword) return res.status(400).json({ error: '没有等待中的2FA流程' });

  try {
    loginState.resolvePassword(password);
    const result = await Promise.race([
      loginState.loginPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('登录超时')), 30000)),
    ]);
    loginState.pending = false;
    res.json({ status: 'success', user: { id: result.id.toString(), username: result.username, phone: result.phone } });
  } catch (e) {
    loginState.pending = false;
    res.status(500).json({ error: '登录失败: ' + e.message });
  }
});

// --- State ---
router.get('/state', (req, res) => {
  res.json({
    connected: isConnected(),
    state: getState(),
    user: getMe() ? { id: getMe().id.toString(), username: getMe().username, phone: getMe().phone } : null,
  });
});

// --- Contacts ---
router.get('/contacts', async (req, res) => {
  try {
    if (!isConnected()) return res.status(400).json({ error: '未连接' });
    const contacts = await getContacts();
    res.json({ contacts });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/dialogs', async (req, res) => {
  try {
    if (!isConnected()) return res.status(400).json({ error: '未连接' });
    const limit = parseInt(req.query.limit) || 100;
    const dialogs = await getDialogs(limit);
    res.json({ dialogs });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- History ---
router.get('/history', async (req, res) => {
  try {
    if (!isConnected()) return res.status(400).json({ error: '未连接' });
    const { peerId, limit = 50 } = req.query;
    if (!peerId) return res.status(400).json({ error: '需要peerId' });
    const messages = await getHistory(peerId, parseInt(limit));
    res.json({ messages });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- Send message ---
router.post('/send', async (req, res) => {
  try {
    if (!isConnected()) return res.status(400).json({ error: '未连接' });
    const { peerId, text } = req.body;
    if (!peerId || !text) return res.status(400).json({ error: '需要peerId和text' });
    const result = await sendMessage(peerId, text);
    res.json({ sent: true, ...result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- Add contact ---
router.post('/add-contact', async (req, res) => {
  try {
    if (!isConnected()) return res.status(400).json({ error: '未连接' });
    const { phone, firstName, lastName } = req.body;
    if (!phone || !firstName) return res.status(400).json({ error: '需要phone和firstName' });
    const contact = await addContactByPhone(phone, firstName, lastName || '');
    res.json({ contact });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- User info ---
router.get('/user/:peerId', async (req, res) => {
  try {
    if (!isConnected()) return res.status(400).json({ error: '未连接' });
    const info = await getUserInfo(req.params.peerId);
    if (!info) return res.status(404).json({ error: '用户不存在' });
    res.json(info);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- Logout ---
router.post('/logout', async (req, res) => {
  try {
    await logout();
    res.json({ status: 'logged_out' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
