/**
 * TG User Bot API Routes
 * 登录流程: POST /login (传手机号) → 等TG验证码 → POST /login/code (传验证码)
 */
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
import {
  initUserBot,
  autoConnectUserBot,
  getContacts,
  getDialogs,
  getHistory,
  sendMessage,
  addContactByPhone,
  getUserInfo,
  downloadProfilePhoto,
  logout,
  getState,
  getMe,
  isConnected,
  getQRCode,
  pollQRLogin,
  submitQRPassword,
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

// --- Sync TG contacts to CRM database ---
router.post('/sync-contacts', async (req, res) => {
  try {
    if (!isConnected()) return res.status(400).json({ error: '未连接' });
    
    const contacts = await getContacts();
    console.log(`[TG-UB] Syncing ${contacts.length} contacts to CRM...`);
    
    // Find or create TG User Bot account
    const me = getMe();
    let account = await prisma.whatsAppAccount.findFirst({
      where: { platform: 'telegram', sessionDir: 'tg_userbot_' + me.id.toString() }
    });
    
    if (!account) {
      account = await prisma.whatsAppAccount.create({
        data: {
          userId: 1, // default admin user
          platform: 'telegram',
          phone: me.phone || '',
          name: me.username || 'TG UserBot',
          pushName: [me.firstName, me.lastName].filter(Boolean).join(' '),
          status: 'connected',
          sessionDir: 'tg_userbot_' + me.id.toString(),
          telegramBotInfo: JSON.stringify({ type: 'userbot', userId: me.id.toString(), username: me.username }),
        }
      });
      console.log(`[TG-UB] Created account ${account.id} for ${me.username}`);
    } else {
      // Update status
      await prisma.whatsAppAccount.update({
        where: { id: account.id },
        data: { status: 'connected', lastActiveAt: new Date() }
      });
    }
    
    let synced = 0, updated = 0;
    
    for (const c of contacts) {
      if (c.bot) continue; // Skip bots
      
      const contactJid = c.id + '@telegram';
      const existing = await prisma.contact.findFirst({
        where: { accountId: account.id, platform: 'telegram', jid: contactJid }
      });
      
      const contactData = {
        accountId: account.id,
        platform: 'telegram',
        jid: contactJid,
        name: c.displayName || c.username || null,
        phone: c.phone || null,
        pushName: c.firstName || null,
      };
      
      if (existing) {
        await prisma.contact.update({
          where: { id: existing.id },
          data: { ...contactData, updatedAt: new Date() }
        });
        updated++;
      } else {
        await prisma.contact.create({ data: contactData });
        synced++;
      }
    }
    
    console.log(`[TG-UB] Sync complete: ${synced} new, ${updated} updated`);
    res.json({ synced, updated, total: contacts.length, accountId: account.id });
  } catch (e) {
    console.error('[TG-UB] Sync error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// --- Sync dialogs (conversations) ---
router.post('/sync-dialogs', async (req, res) => {
  try {
    if (!isConnected()) return res.status(400).json({ error: '未连接' });
    
    const limit = parseInt(req.body?.limit) || 200;
    const dialogs = await getDialogs(limit);
    
    const me = getMe();
    const account = await prisma.whatsAppAccount.findFirst({
      where: { platform: 'telegram', sessionDir: 'tg_userbot_' + me.id.toString() }
    });
    if (!account) return res.status(400).json({ error: 'TG账号未初始化，请先同步联系人' });
    
    let synced = 0, updated = 0;
    
    for (const d of dialogs) {
      const dialogJid = d.id + '@telegram';
      let contact = await prisma.contact.findFirst({
        where: { accountId: account.id, platform: 'telegram', jid: dialogJid }
      });
      // Auto-create contact for dialog partners not in contact list
      if (!contact) {
        try {
          contact = await prisma.contact.create({
            data: {
              accountId: account.id,
              platform: 'telegram',
              jid: dialogJid,
              name: d.name || d.username || d.id,
              phone: d.phone || null,
              pushName: d.name || null,
            }
          });
          console.log('[TG-UB] Auto-created contact for dialog:', d.name || d.id, dialogJid);
        } catch (e) {
          console.warn('[TG-UB] Failed to create contact for ' + dialogJid + ':', e.message);
          continue;
        }
      }
      
      const convData = {
        accountId: account.id,
        platform: 'telegram',
        contactId: contact.id,
        jid: dialogJid,
        lastMessage: d.lastMessage || null,
        lastMessageAt: d.lastMessageDate ? new Date(d.lastMessageDate) : null,
        unreadCount: d.unreadCount || 0,
        pinned: d.pinned || false,
      };
      
      const existing = await prisma.conversation.findFirst({
        where: { accountId: account.id, platform: 'telegram', jid: dialogJid }
      });
      
      if (existing) {
        await prisma.conversation.update({ where: { id: existing.id }, data: convData });
        updated++;
      } else {
        await prisma.conversation.create({ data: convData });
        synced++;
      }
    }
    
    res.json({ synced, updated, total: dialogs.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


// --- Sync avatars ---
router.post('/sync-avatars', async (req, res) => {
  try {
    if (!isConnected()) return res.status(400).json({ error: '未连接' });
    const contacts = await prisma.contact.findMany({ where: { platform: 'telegram', avatarUrl: null } });
    const pathMod = await import('path');
    const fsMod = await import('fs');
    const { fileURLToPath } = await import('url');
    const __fn = fileURLToPath(import.meta.url);
    const __dn = pathMod.dirname(__fn);
    const avatarDir = pathMod.join(__dn, '../../uploads/tg-avatars');
    if (!fsMod.existsSync(avatarDir)) fsMod.mkdirSync(avatarDir, { recursive: true });
    let updated=0, skipped=0, failed=0; const results=[];
    for (const c of contacts) {
      const peerId = c.jid.replace('@telegram', '');
      try {
        const avatarUrl = await downloadProfilePhoto(peerId);
        if (avatarUrl) { await prisma.contact.update({ where:{id:c.id}, data:{avatarUrl} }); updated++; results.push({id:c.id,name:c.name,status:'ok'}); }
        else { skipped++; results.push({id:c.id,name:c.name,status:'no-photo'}); }
      } catch(e) { failed++; results.push({id:c.id,name:c.name,status:'error',error:e.message}); }
      if (contacts.indexOf(c)<contacts.length-1) await new Promise(r=>setTimeout(r,300));
    }
    res.json({updated,skipped,failed,total:contacts.length});
  } catch(e) { res.status(500).json({error:e.message}); }
});

// --- 刷新当前 UserBot 账号信息（显示名 + 头像） ---
router.post("/sync-me", async (req, res) => {
  try {
    if (!isConnected()) return res.status(400).json({ error: "未连接" });
    const me = getMe();
    if (!me) return res.status(400).json({ error: "无账号信息" });
    const displayName = [me.firstName, me.lastName].filter(Boolean).join(" ").trim() || me.username || ("TG-" + me.id);
    let account = await prisma.whatsAppAccount.findFirst({
      where: { platform: "telegram", sessionDir: "tg_userbot_" + me.id }
    });
    if (!account) return res.status(400).json({ error: "账号未初始化" });
    const avatarUrl = await downloadProfilePhoto(me.id);
    await prisma.whatsAppAccount.update({
      where: { id: account.id },
      data: { name: displayName, pushName: displayName, ...(avatarUrl ? { avatarUrl } : {}) }
    });
    res.json({ ok: true, name: displayName, avatarUrl: avatarUrl || null });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- QR 登录 2FA 密码 ---
router.post("/qr/password", async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: "需要密码" });
    const result = await submitQRPassword(password);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;

// --- QR Code Login ---

router.get("/qr", async (req, res) => {
  try {
    if (isConnected()) return res.json({ status: "already_connected", user: getMe() });
    const qrData = await getQRCode({ apiId: API_ID, apiHash: API_HASH });
    res.json(qrData);
  } catch (e) {
    console.error("[TG-UB] QR generation error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

router.post("/qr/poll", async (req, res) => {
  try {
    const { qrToken } = req.body;
    if (!qrToken) return res.status(400).json({ error: "需要qrToken" });
    const result = await pollQRLogin(qrToken);
    
    // 如果连接成功，同步创建账号记录
    if (result.status === "connected" && result.user) {
      const me = result.user;
      const displayName = [me.firstName, me.lastName].filter(Boolean).join(" ").trim() || me.username || ("TG-" + me.id);
      const accountData = {
        userId: 1,
        platform: "telegram",
        phone: me.phone || "",
        name: displayName,
        pushName: displayName,
        status: "connected",
        sessionDir: "tg_userbot_" + me.id,
        telegramBotInfo: JSON.stringify({ type: "userbot", userId: me.id, username: me.username, firstName: me.firstName || "", lastName: me.lastName || "" }),
      };
      let account = await prisma.whatsAppAccount.findFirst({
        where: { platform: "telegram", sessionDir: "tg_userbot_" + me.id }
      });
      if (!account) {
        account = await prisma.whatsAppAccount.create({ data: accountData });
      } else {
        await prisma.whatsAppAccount.update({
          where: { id: account.id },
          data: { name: displayName, pushName: displayName, status: "connected", lastActiveAt: new Date() }
        });
      }
      // 下载真实头像（失败不阻断登录）
      try {
        const avatarUrl = await downloadProfilePhoto(me.id);
        if (avatarUrl) {
          await prisma.whatsAppAccount.update({ where: { id: account.id }, data: { avatarUrl } });
        }
      } catch (e) { console.warn("[TG-UB] avatar download error:", e.message); }
      result.accountId = account.id;
    }
    
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
