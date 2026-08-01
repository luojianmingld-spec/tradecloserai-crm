import { Router } from 'express';
import { encrypt, decrypt, isEncrypted } from '../utils/encryption.js';

function getDecryptedBotToken(token) { return token && isEncrypted(token) ? decrypt(token) : token; }
import { PrismaClient } from '@prisma/client';
import crypto from "crypto";
import { getTelegramConnector, clearTelegramConnector } from "../services/telegram-connector.js";

const router = Router();
const prisma = new PrismaClient();

const EVO_API_URL = process.env.EVOLUTION_API_URL || "http://127.0.0.1:8081";
const EVO_API_KEY = process.env.EVOLUTION_API_KEY || "B7E2A9D4C6F1E8A3B5D7F9C2E4A6B8D1";

// List WhatsApp accounts for current user (enhanced with Evolution state & proxy info)
router.get('/', async (req, res) => {
  try {
    const accounts = await prisma.whatsAppAccount.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { contacts: true, conversations: true } },
      },
    });

    // Fetch all Evolution instances in one call
    let evoInstances = {};
    try {
      const instRes = await fetch(`${EVO_API_URL}/instance/fetchInstances`, {
        headers: { apikey: EVO_API_KEY },
      });
      const instList = await instRes.json();
      for (const inst of instList) {
        evoInstances[inst.name] = inst;
      }
    } catch (e) {
      console.warn('[Accounts] fetchInstances error:', e.message);
    }

    // Enrich each WA account with live connection state, proxy IP, profile pic
    const enriched = await Promise.all(accounts.map(async (acct) => {
      const base = {
        id: acct.id,
        name: acct.name,
        platform: acct.platform,
        instanceName: acct.instanceName,
        phone: acct.phone,
        pushName: acct.pushName,
        status: acct.status,
        telegramBotToken: acct.telegramBotToken ? true : undefined,
        telegramBotUsername: acct.telegramBotUsername,
        createdAt: acct.createdAt,
        _count: acct._count,
      };

      if (acct.platform === 'whatsapp' && acct.instanceName) {
        const inst = evoInstances[acct.instanceName];
        if (inst) {
          base.connectionStatus = inst.connectionStatus || 'close';
          base.ownerJid = inst.ownerJid || null;
          base.profilePicUrl = inst.profilePicUrl || null;
          base.profileName = inst.profileName || null;
          // Live status overrides DB status
          base.status = inst.connectionStatus === 'open' ? 'connected' : 'disconnected';
        } else {
          base.connectionStatus = 'no_instance';
        }
        // Fetch proxy info
        try {
          const proxyRes = await fetch(`${EVO_API_URL}/proxy/find/${acct.instanceName}`, {
            headers: { apikey: EVO_API_KEY },
          });
          const proxyData = await proxyRes.json();
          base.proxyIp = proxyData?.host || null;
          base.proxyPort = proxyData?.port || null;
        } catch (e) {
          base.proxyIp = null;
        }
      }

      return base;
    }));

    res.json(enriched);
  } catch (err) {
    console.error('[Accounts] List error:', err);
    res.status(500).json({ error: 'Failed to list accounts' });
  }
});

// Create a new WhatsApp account (placeholder for connection)
router.post('/', async (req, res) => {
  try {
    const { name } = req.body;
    const sessionDir = `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const account = await prisma.whatsAppAccount.create({
      data: {
        userId: req.userId,
        name: name || 'WhatsApp Account',
        sessionDir,
        status: 'disconnected',
      },
    });
    res.status(201).json(account);
  } catch (err) {
    console.error('[Accounts] Create error:', err);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

// Get account by ID

// ===== Telegram Bot 管理 (放在 /:id 前面避免冲突) =====
// ===== Telegram Bot 管理 =====

// POST /api/accounts/telegram/connect { token, name? }
// 绑定Telegram Bot Token，调用getMe验证，自动设置webhook
router.post("/telegram/connect", async (req, res) => {
  try {
    const { token, name } = req.body || {};
    if (!token || !/^\d+:[A-Za-z0-9_-]{20,}$/.test(token)) {
      return res.status(400).json({ error: "Invalid Telegram Bot Token" });
    }
    // 检查是否已存在
    const existing = await prisma.whatsAppAccount.findFirst({
      where: { userId: req.userId, platform: "telegram", telegramBotToken: token },
    });
    if (existing) {
      return res.status(409).json({ error: "This bot is already connected", account: existing });
    }
    const connector = getTelegramConnector(token);
    let me;
    try {
      me = await connector.getMe();
    } catch (e) {
      return res.status(400).json({ error: "Invalid token or Telegram unreachable: " + e.message });
    }
    const botUsername = me.username;
    const secretBytes = crypto.randomBytes(12).toString("hex");
    const sessionDir = `tgwh_${secretBytes}`;
    const account = await prisma.whatsAppAccount.create({
      data: {
        userId: req.userId,
        platform: "telegram",
        name: name || `TG @${botUsername}`,
        phone: me.id ? String(me.id) : null,
        pushName: `@${botUsername}`,
        status: "connected",
        sessionDir,
        telegramBotToken: encrypt(token),
        telegramBotUsername: botUsername,
        telegramBotInfo: JSON.stringify(me),
        lastActiveAt: new Date(),
      },
    });
    // 设置webhook
    const baseUrl = process.env.PUBLIC_BASE_URL || "https://ai.jzjglass.com";
    const webhookUrl = `${baseUrl}/api/telegram/webhook/${secretBytes}`;
    try {
      await connector.setWebhook(webhookUrl, secretBytes);
      console.log(`[TG] Webhook set for @${botUsername}: ${webhookUrl}`);
    } catch (e) {
      console.warn("[TG] setWebhook failed:", e.message);
    }
    res.status(201).json({ account, bot: me, webhookUrl });
  } catch (err) {
    console.error("[TG] connect error:", err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/accounts/telegram/disconnect/:id
router.post("/telegram/disconnect/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const account = await prisma.whatsAppAccount.findFirst({
      where: { id, userId: req.userId, platform: "telegram" },
    });
    if (!account) return res.status(404).json({ error: "Not found" });
    if (account.telegramBotToken) {
      try {
        const c = getTelegramConnector(getDecryptedBotToken(account.telegramBotToken));
        await c.deleteWebhook();
        clearTelegramConnector(account.telegramBotToken);
      } catch (e) {
        console.warn("[TG] deleteWebhook failed:", e.message);
      }
    }
    await prisma.whatsAppAccount.update({
      where: { id: account.id },
      data: { status: "disconnected" },
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/accounts/telegram/:id —— 完整删除（删webhook+账号+关联数据）
router.delete("/telegram/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const account = await prisma.whatsAppAccount.findFirst({
      where: { id, userId: req.userId, platform: "telegram" },
    });
    if (!account) return res.status(404).json({ error: "Not found" });
    if (account.telegramBotToken) {
      try {
        const c = getTelegramConnector(getDecryptedBotToken(account.telegramBotToken));
        await c.deleteWebhook();
        clearTelegramConnector(account.telegramBotToken);
      } catch {}
    }
    await prisma.whatsAppAccount.delete({ where: { id: account.id } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

router.get('/:id', async (req, res) => {
  try {
    const account = await prisma.whatsAppAccount.findFirst({
      where: { id: parseInt(req.params.id), userId: req.userId },
      include: {
        _count: { select: { contacts: true, conversations: true } },
      },
    });
    if (!account) return res.status(404).json({ error: 'Account not found' });
    res.json(account);
  } catch (err) {
    console.error('[Accounts] Get error:', err);
    res.status(500).json({ error: 'Failed to get account' });
  }
});

// Delete account
router.delete('/:id', async (req, res) => {
  try {
    const account = await prisma.whatsAppAccount.findFirst({
      where: { id: parseInt(req.params.id), userId: req.userId },
    });
    if (!account) return res.status(404).json({ error: 'Account not found' });

    await prisma.whatsAppAccount.delete({ where: { id: account.id } });
    res.json({ success: true });
  } catch (err) {
    console.error('[Accounts] Delete error:', err);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

// ===== WhatsApp QR 连接管理 =====
import EvolutionConnector from '../services/evolution-connector.js';

// 获取所有 WA 账号状态（含连接状态）
router.get('/wa/status', async (req, res) => {
  try {
    const accounts = await prisma.whatsAppAccount.findMany({
      where: { userId: req.userId, platform: 'whatsapp' },
    });
    const results = await Promise.all(accounts.map(async (acct) => {
      if (!acct.instanceName) return { ...acct, connectionState: 'no_instance' };
      try {
        const r = await fetch(`${EVO_API_URL}/instance/connectionState/${acct.instanceName}`, {
          headers: { apikey: EVO_API_KEY },
        });
        const data = await r.json();
        const state = data?.instance?.state || 'close';
        return { ...acct, connectionState: state };
      } catch {
        return { ...acct, connectionState: 'error' };
      }
    }));
    res.json(results);
  } catch (err) {
    console.error('[WA Status] error:', err);
    res.status(500).json({ error: 'Failed to get WA status' });
  }
});

// 获取指定 WA 账号的 QR 码
router.get('/wa/:id/qr', async (req, res) => {
  try {
    const account = await prisma.whatsAppAccount.findFirst({
      where: { id: parseInt(req.params.id), userId: req.userId, platform: 'whatsapp' },
    });
    if (!account) return res.status(404).json({ error: 'Account not found' });
    if (!account.instanceName) return res.status(400).json({ error: 'No instance configured' });

    const r = await fetch(`${EVO_API_URL}/instance/connect/${account.instanceName}`, {
      headers: { apikey: EVO_API_KEY },
    });
    const data = await r.json();
    res.json({
      base64: data.base64 || null,
      pairingCode: data.pairingCode || null,
      state: data?.state || 'unknown',
    });
  } catch (err) {
    console.error('[WA QR] error:', err);
    res.status(500).json({ error: 'Failed to get QR code' });
  }
});

// 创建新的 WA 实例并返回 QR 码
router.post('/wa/connect', async (req, res) => {
  try {
    const { instanceName, name, phone } = req.body;
    if (!instanceName) return res.status(400).json({ error: 'instanceName is required' });

    // Check if instance already exists in Evolution
    const instancesRes = await fetch(`${EVO_API_URL}/instance/fetchInstances`, {
      headers: { apikey: EVO_API_KEY },
    });
    const instances = await instancesRes.json();
    let instance = instances.find(i => i.instanceName === instanceName);

    if (!instance) {
      // Create new instance in Evolution
      const createRes = await fetch(`${EVO_API_URL}/instance/create`, {
        method: 'POST',
        headers: { apikey: EVO_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ instanceName }),
      });
      instance = await createRes.json();
    }

    // Upsert in CRM DB
    let account = await prisma.whatsAppAccount.findFirst({
      where: { userId: req.userId, instanceName },
    });
    if (account) {
      account = await prisma.whatsAppAccount.update({
        where: { id: account.id },
        data: { status: 'connecting', name: name || account.name, phone: phone || account.phone },
      });
    } else {
      account = await prisma.whatsAppAccount.create({
        data: {
          userId: req.userId,
          platform: 'whatsapp',
          name: name || instanceName,
          phone: phone || null,
          instanceName,
          status: 'connecting',
        },
      });
    }

    // Get QR code
    const qrRes = await fetch(`${EVO_API_URL}/instance/connect/${instanceName}`, {
      headers: { apikey: EVO_API_KEY },
    });
    const qrData = await qrRes.json();

    res.json({
      account,
      base64: qrData.base64 || null,
      pairingCode: qrData.pairingCode || null,
    });
  } catch (err) {
    console.error('[WA Connect] error:', err);
    res.status(500).json({ error: 'Failed to connect: ' + err.message });
  }
});

// 断开 WA 连接
router.post('/wa/:id/disconnect', async (req, res) => {
  try {
    const account = await prisma.whatsAppAccount.findFirst({
      where: { id: parseInt(req.params.id), userId: req.userId, platform: 'whatsapp' },
    });
    if (!account || !account.instanceName) return res.status(404).json({ error: 'Account not found' });

    await fetch(`${EVO_API_URL}/instance/logout/${account.instanceName}`, {
      method: 'DELETE',
      headers: { apikey: EVO_API_KEY },
    });
    await prisma.whatsAppAccount.update({
      where: { id: account.id },
      data: { status: 'disconnected' },
    });
    res.json({ success: true });
  } catch (err) {
    console.error('[WA Disconnect] error:', err);
    res.status(500).json({ error: 'Failed to disconnect' });
  }
});

// ===== 代理配置 =====
router.get('/wa/:id/proxy', async (req, res) => {
  try {
    const account = await prisma.whatsAppAccount.findFirst({
      where: { id: parseInt(req.params.id), userId: req.userId, platform: 'whatsapp' },
    });
    if (!account || !account.instanceName) return res.status(404).json({ error: 'Account not found' });
    const r = await fetch(`${EVO_API_URL}/proxy/find/${account.instanceName}`, {
      headers: { apikey: EVO_API_KEY },
    });
    if (!r.ok) {
      if (r.status === 404) return res.json({ proxy: null });
      throw new Error('Evolution API error');
    }
    const data = await r.json();
    res.json({ proxy: data });
  } catch (err) {
    console.error('[WA GetProxy] error:', err);
    res.status(500).json({ error: 'Failed to get proxy' });
  }
});

router.post('/wa/:id/proxy', async (req, res) => {
  try {
    const account = await prisma.whatsAppAccount.findFirst({
      where: { id: parseInt(req.params.id), userId: req.userId, platform: 'whatsapp' },
    });
    if (!account || !account.instanceName) return res.status(404).json({ error: 'Account not found' });

    const { enabled, host, port, protocol, username, password } = req.body;
    const body = {
      enabled: enabled !== false,
      host,
      port: String(port),
      protocol: protocol || 'socks5',
    };
    if (username) body.username = username;
    if (password) body.password = password;

    const r = await fetch(`${EVO_API_URL}/proxy/set/${account.instanceName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: EVO_API_KEY },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const errText = await r.text();
      console.error('[WA SetProxy] evolution error:', errText);
      return res.status(r.status).json({ error: 'Failed to set proxy', detail: errText });
    }
    const data = await r.json();
    res.json({ success: true, proxy: data });
  } catch (err) {
    console.error('[WA SetProxy] error:', err);
    res.status(500).json({ error: 'Failed to set proxy' });
  }
});

router.post('/wa/:id/proxy/test', async (req, res) => {
  try {
    const account = await prisma.whatsAppAccount.findFirst({
      where: { id: parseInt(req.params.id), userId: req.userId, platform: 'whatsapp' },
    });
    if (!account || !account.instanceName) return res.status(404).json({ error: 'Account not found' });

    // First get current proxy
    const proxyRes = await fetch(`${EVO_API_URL}/proxy/find/${account.instanceName}`, {
      headers: { apikey: EVO_API_KEY },
    });
    if (!proxyRes.ok) return res.status(400).json({ error: 'No proxy configured' });
    const proxyData = await proxyRes.json();

    // Test connectivity by checking instance status after proxy
    const instRes = await fetch(`${EVO_API_URL}/instance/fetchInstances`, {
      headers: { apikey: EVO_API_KEY },
    });
    if (!instRes.ok) return res.status(500).json({ error: 'Cannot check instance' });
    const instances = await instRes.json();
    const inst = instances.find(i => i.name === account.instanceName);

    res.json({
      success: true,
      proxy: proxyData,
      instanceStatus: inst ? inst.connectionStatus : 'unknown',
      message: inst ? `Instance status: ${inst.connectionStatus}` : 'Instance not found'
    });
  } catch (err) {
    console.error('[WA TestProxy] error:', err);
    res.status(500).json({ error: 'Proxy test failed' });
  }
});

router.delete('/wa/:id/proxy', async (req, res) => {
  try {
    const account = await prisma.whatsAppAccount.findFirst({
      where: { id: parseInt(req.params.id), userId: req.userId, platform: 'whatsapp' },
    });
    if (!account || !account.instanceName) return res.status(404).json({ error: 'Account not found' });

    // Set proxy disabled
    const r = await fetch(`${EVO_API_URL}/proxy/set/${account.instanceName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: EVO_API_KEY },
      body: JSON.stringify({ enabled: false, host: '', port: '0', protocol: 'socks5' }),
    });
    res.json({ success: true });
  } catch (err) {
    console.error('[WA DeleteProxy] error:', err);
    res.status(500).json({ error: 'Failed to delete proxy' });
  }
});
