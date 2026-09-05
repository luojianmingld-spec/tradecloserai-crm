import sharp from 'sharp';
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

// 确保实例配置 webhook（指向当前后端，用于配对/连接状态推送，防止"配对成功但前端无反应"）
const MAX_WA_ACCOUNTS_PER_USER = 2;

async function ensureWebhook(instanceName) {
  try {
    const port = process.env.DEPLOY_RUN_PORT || 3000;
    await fetch(`${EVO_API_URL}/webhook/set/${instanceName}`, {
      method: 'POST',
      headers: { apikey: EVO_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        webhook: {
          url: `http://host.docker.internal:${port}/api/evolution/webhook`,
          enabled: true,
          events: ['MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'MESSAGES_DELETE', 'CONNECTION_UPDATE', 'SEND_MESSAGE'],
          webhookByEvents: true,
        },
      }),
    });
  } catch (e) {
    console.warn('[WA Webhook] ensureWebhook failed for ' + instanceName + ':', e.message);
  }
}


// List WhatsApp accounts for current user (enhanced with Evolution state & proxy info)
router.get('/', async (req, res) => {
  try {
    const accounts = await prisma.whatsAppAccount.findMany({
      where: {
        OR: [
          { userId: req.userId },
          { platform: 'telegram' }, // TG userbot 全局单用户连接，对所有登录用户可见
        ],
      },
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
        avatarUrl: acct.avatarUrl || null,
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
      where: { id, platform: "telegram" },
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
      where: { id, platform: "telegram" },
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

// GET /api/accounts/telegram/:id/proxy —— 读取 TG 账号代理配置
router.get("/telegram/:id/proxy", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const account = await prisma.whatsAppAccount.findFirst({
      where: { id, platform: "telegram" },
    });
    if (!account) return res.status(404).json({ error: "Not found" });
    res.json({
      proxy: {
        enabled: !!(account.telegramProxyHost),
        protocol: account.telegramProxyProtocol || "socks5",
        host: account.telegramProxyHost || "",
        port: account.telegramProxyPort || "",
        username: account.telegramProxyUser || "",
        password: account.telegramProxyPass || "",
      },
    });
  } catch (err) {
    console.error("[TG GetProxy] error:", err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/accounts/telegram/:id/proxy —— 保存 TG 账号代理配置
router.post("/telegram/:id/proxy", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const account = await prisma.whatsAppAccount.findFirst({
      where: { id, platform: "telegram" },
    });
    if (!account) return res.status(404).json({ error: "Not found" });
    const { enabled, host, port, protocol, username, password } = req.body || {};
    const data = {};
    if (enabled === false || !host) {
      data.telegramProxyProtocol = null;
      data.telegramProxyHost = null;
      data.telegramProxyPort = null;
      data.telegramProxyUser = null;
      data.telegramProxyPass = null;
    } else {
      data.telegramProxyProtocol = (protocol || "socks5").toLowerCase();
      data.telegramProxyHost = String(host).trim();
      data.telegramProxyPort = String(port || "");
      data.telegramProxyUser = username ? String(username) : null;
      data.telegramProxyPass = password ? String(password) : null;
    }
    await prisma.whatsAppAccount.update({ where: { id: account.id }, data });
    res.json({ success: true });
  } catch (err) {
    console.error("[TG SetProxy] error:", err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/accounts/telegram/:id/launch —— 启动：webhook 自检/重挂
router.post("/telegram/:id/launch", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const account = await prisma.whatsAppAccount.findFirst({
      where: { id, platform: "telegram" },
    });
    if (!account) return res.status(404).json({ error: "Not found" });
    if (!account.telegramBotToken) return res.status(400).json({ error: "Bot token missing" });
    const connector = getTelegramConnector(getDecryptedBotToken(account.telegramBotToken));
    let info = null;
    try { info = await connector.getWebhookInfo(); } catch (e) { /* ignore */ }
    const baseUrl = process.env.PUBLIC_BASE_URL || "https://ai.jzjglass.com";
    const webhookUrl = `${baseUrl}/api/telegram/webhook/${account.sessionDir}`;
    if (!info || info.url !== webhookUrl || info.last_error_message) {
      await connector.setWebhook(webhookUrl, account.sessionDir, false);
      info = await connector.getWebhookInfo();
    }
    await prisma.whatsAppAccount.update({
      where: { id: account.id },
      data: { status: "connected", lastActiveAt: new Date() },
    });
    res.json({ ok: true, status: "connected", webhookInfo: info });
  } catch (err) {
    console.error("[TG Launch] error:", err);
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
    let account = await prisma.whatsAppAccount.findFirst({
      where: { id: parseInt(req.params.id), userId: req.userId, platform: 'whatsapp' },
    });
    if (!account) return res.status(404).json({ error: 'Account not found' });
    if (!account.instanceName) {
      // 空壳账号兜底：自动创建 Evolution 实例并绑定，确保 QR 可加载
      const instName = 'user_' + req.userId;
      try {
        const instRes = await fetch(`${EVO_API_URL}/instance/fetchInstances`, { headers: { apikey: EVO_API_KEY } });
        const instList = await instRes.json();
        if (!instList.find(i => i.name === instName)) {
          await fetch(`${EVO_API_URL}/instance/create`, {
            method: 'POST',
            headers: { apikey: EVO_API_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({ instanceName: instName, integration: 'WHATSAPP-BAILEYS' }),
          });
          await ensureWebhook(instName);
        }
      } catch (e) {
        console.error('[WA QR] auto-create instance error:', e.message);
      }
      account = await prisma.whatsAppAccount.update({
        where: { id: account.id },
        data: { instanceName: instName, status: 'connecting' },
      });
      console.log('[WA QR] Auto-bound instance ' + instName + ' to account ' + account.id);
    }

    const r = await fetch(`${EVO_API_URL}/instance/connect/${account.instanceName}`, {
      headers: { apikey: EVO_API_KEY },
    });
    const data = await r.json();
    // Post-process QR: convert blue pixels to black for standard look
    let processedBase64 = data.base64 || null;
    if (processedBase64) {
      try {
        const b64Data = processedBase64.includes(',') ? processedBase64.split(',')[1] : processedBase64;
        const buf = Buffer.from(b64Data, 'base64');
        const { data: pixels, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
        // Iterate pixels: if pixel has significant color (not white bg), make it black
        for (let i = 0; i < pixels.length; i += 4) {
          const r = pixels[i], g = pixels[i+1], b = pixels[i+2];
          // If not white/near-white background, set to black
          if (r < 240 || g < 240 || b < 240) {
            pixels[i] = 0;     // R
            pixels[i+1] = 0;   // G
            pixels[i+2] = 0;   // B
            // Keep alpha as is
          }
        }
        const outBuf = await sharp(pixels, { raw: { width: info.width, height: info.height, channels: info.channels } }).png().toBuffer();
        processedBase64 = 'data:image/png;base64,' + outBuf.toString('base64');
      } catch (e) {
        console.error('[WA QR] Image processing failed, using original:', e.message);
      }
    }
    res.json({
      base64: processedBase64,
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
    let instance = instances.find(i => i.name === instanceName);

    if (!instance) {
      // Create new instance in Evolution
      const createRes = await fetch(`${EVO_API_URL}/instance/create`, {
        method: 'POST',
        headers: { apikey: EVO_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ instanceName, integration: 'WHATSAPP-BAILEYS' }),
      });
      await ensureWebhook(instanceName);
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
      // 风控：无指纹隔离，每租户最多 2 个 WhatsApp 账号（防止账号关联封号）
      const existingCount = await prisma.whatsAppAccount.count({
        where: { userId: req.userId, platform: 'whatsapp' },
      });
      if (existingCount >= MAX_WA_ACCOUNTS_PER_USER) {
        return res.status(400).json({ error: 'wa_limit', message: `每台设备最多可绑定 ${MAX_WA_ACCOUNTS_PER_USER} 个 WhatsApp 账号，已达上限。为保障账号安全，请解绑一个账号后再添加。` });
      }
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

// 获取配对码 (电话号码登录)
// 冲突规则：同一 WhatsApp 号码只能同时被一个账号绑定。若该号码已被其他账号（connected/connecting）占用，
// 返回冲突信息，由前端弹窗让用户确认「是否下线之前账号的 WhatsApp」，确认后再强制下线原账号并生成配对码。
async function findPhoneConflict(phone, excludeAccountId) {
  if (!phone) return null;
  return prisma.whatsAppAccount.findFirst({
    where: {
      id: { not: excludeAccountId },
      phone,
      platform: 'whatsapp',
      status: { in: ['connected', 'connecting'] },
    },
    include: { user: { select: { id: true, name: true, username: true, tenantId: true } } },
  });
}

async function generatePairingCode(account, phone) {
  const instanceName = account.instanceName;
  const instancesRes = await fetch(`${EVO_API_URL}/instance/fetchInstances`, {
    headers: { apikey: EVO_API_KEY },
  });
  const instances = await instancesRes.json();
  let inst = instances.find((i) => i.name === instanceName);

  if (!inst) {
    const createRes = await fetch(`${EVO_API_URL}/instance/create`, {
      method: 'POST',
      headers: { apikey: EVO_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instanceName,
        integration: 'WHATSAPP-BAILEYS',
        qrcode: true,
        number: phone,
      }),
    });
    await ensureWebhook(instanceName);
    const createData = await createRes.json();
    return { pairingCode: createData?.qrcode?.pairingCode || null };
  }

  if (inst.connectionStatus === 'close') {
    await fetch(`${EVO_API_URL}/instance/connect/${instanceName}?number=${phone}`, {
      headers: { apikey: EVO_API_KEY },
    });
    await new Promise((r) => setTimeout(r, 2000));
  }

  const pairingRes = await fetch(`${EVO_API_URL}/instance/pairingCode/${instanceName}?number=${phone}`, {
    headers: { apikey: EVO_API_KEY },
  });
  if (!pairingRes.ok) {
    const errText = await pairingRes.text();
    console.error('[WA Pairing Code] Evolution error:', errText);
    const err = new Error('Failed to get pairing code from Evolution API');
    err.status = 502;
    throw err;
  }
  const data = await pairingRes.json();
  return { pairingCode: data.pairingCode || null };
}

// POST /wa/:id/pairing-code — 获取配对码，先做同号冲突检测
router.post('/wa/:id/pairing-code', async (req, res) => {
  try {
    const account = await prisma.whatsAppAccount.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!account || !account.instanceName) return res.status(404).json({ error: 'Account not found' });

    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: 'phone number is required' });

    const conflict = await findPhoneConflict(phone, account.id);
    if (conflict) {
      const ownerName = conflict.user?.name || conflict.user?.username || ('#' + conflict.userId);
      return res.json({
        conflict: true,
        phone,
        oldAccount: {
          id: conflict.id,
          name: conflict.name || conflict.pushName || conflict.instanceName,
          instanceName: conflict.instanceName,
          owner: ownerName,
          tenantId: conflict.user?.tenantId ?? null,
        },
        message: '该号码已被账号「' + ownerName + '」绑定，是否下线之前账号的 WhatsApp？',
      });
    }

    const data = await generatePairingCode(account, phone);
    res.json({ pairingCode: data.pairingCode || null, error: null });
  } catch (err) {
    console.error('[WA Pairing Code] error:', err);
    res.status(err.status || 500).json({ error: 'Failed to get pairing code: ' + err.message });
  }
});

// POST /wa/:id/pairing-code/force — 用户确认下线原账号后，强制断开原账号并生成配对码
router.post('/wa/:id/pairing-code/force', async (req, res) => {
  try {
    const account = await prisma.whatsAppAccount.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!account || !account.instanceName) return res.status(404).json({ error: 'Account not found' });

    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: 'phone number is required' });

    const conflict = await findPhoneConflict(phone, account.id);
    let kickedOld = null;
    if (conflict) {
      // 1. Evolution 强制登出原账号实例
      try {
        await fetch(`${EVO_API_URL}/instance/logout/${conflict.instanceName}`, {
          method: 'DELETE',
          headers: { apikey: EVO_API_KEY },
        });
      } catch (e) { console.warn('[WA ForceLogout] evolution logout error:', e.message); }

      // 2. DB 标记原账号为 disconnected
      await prisma.whatsAppAccount.update({ where: { id: conflict.id }, data: { status: 'disconnected' } });

      // 3. 通知原账号所属用户（前端 whatsapp:status 处理下线状态）
      try {
        const io = req.app.get('io');
        if (io) {
          io.emit('whatsapp:status', {
            status: 'disconnected',
            instance: conflict.instanceName,
            sessionId: 'user_' + conflict.userId,
            kicked: true,
            phone,
          });
        }
      } catch (e) { console.warn('[WA ForceLogout] notify error:', e.message); }

      kickedOld = conflict.id;
      console.log(`[WA Conflict] account #${account.id}(${account.instanceName}) force-logout account #${conflict.id}(${conflict.instanceName}) phone=${phone}`);
    }

    const data = await generatePairingCode(account, phone);
    res.json({ pairingCode: data.pairingCode || null, kickedOld, error: null });
  } catch (err) {
    console.error('[WA Pairing Code force] error:', err);
    res.status(500).json({ error: 'Failed to get pairing code: ' + err.message });
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

    // DIRECT mode (enabled=false): skip Evolution API, just return success
    if (enabled === false) {
      console.log('[WA SetProxy] DIRECT mode, skipping Evolution API proxy set');
      return res.json({ success: true, proxy: { enabled: false } });
    }

    // Validate required fields for proxy mode
    if (!host || !port) {
      return res.status(400).json({ error: 'Host and port are required for proxy mode' });
    }

    const body = {
      enabled: true,
      host,
      port: String(port),
      protocol: protocol || 'socks5',
    };
    if (username) body.username = username;
    if (password) body.password = password;

    console.log('[WA SetProxy] sending to Evolution API:', JSON.stringify(body));
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

    const { host, port, protocol, username, password } = req.body;
    if (!host || !port) return res.status(400).json({ error: 'Host and port are required' });

    const proto = (protocol || 'socks5').toLowerCase();
    const portNum = parseInt(port);
    let proxyUrl;
    if (username && password) {
      proxyUrl = `${proto}://${username}:${password}@${host}:${portNum}`;
    } else {
      proxyUrl = `${proto}://${host}:${portNum}`;
    }

    const netMod = await import('net');
    const netConnect = netMod.createConnection || netMod.default.createConnection;

    // Step 1: TCP connect to proxy server
    const tcpStart = Date.now();
    const tcpOk = await new Promise(resolve => {
      const socket = netConnect({ host, port: portNum, timeout: 10000 }, () => {
        socket.destroy();
        resolve(true);
      });
      socket.on('error', () => resolve(false));
      socket.on('timeout', () => { socket.destroy(); resolve(false); });
    });
    const networkLatency = Date.now() - tcpStart;

    if (!tcpOk) {
      return res.json({ success: false, error: '无法连接到代理服务器', networkLatency });
    }

    // Step 2: Get external IP and geo through proxy
    let externalIp = null;
    let country = null;
    try {
      let agent;
      if (proto.startsWith('socks')) {
        const { SocksProxyAgent } = await import('socks-proxy-agent');
        agent = new SocksProxyAgent(proxyUrl);
      } else {
        const { HttpsProxyAgent } = await import('https-proxy-agent');
        agent = new HttpsProxyAgent(proxyUrl);
      }
      const ipResponse = await fetch('https://ipinfo.io/json', {
        dispatcher: agent,
        signal: AbortSignal.timeout(10000),
      });
      const ipData = await ipResponse.json();
      externalIp = ipData.ip;
      country = ipData.country || null;
    } catch(e) {
      console.error('[WA TestProxy] Geo lookup failed:', e.message);
    }

    // Step 3: Platform latency - reach WhatsApp through proxy
    let platformLatency = null;
    try {
      let waAgent;
      if (proto.startsWith('socks')) {
        const { SocksProxyAgent } = await import('socks-proxy-agent');
        waAgent = new SocksProxyAgent(proxyUrl);
      } else {
        const { HttpsProxyAgent } = await import('https-proxy-agent');
        waAgent = new HttpsProxyAgent(proxyUrl);
      }
      const platStart = Date.now();
      await fetch('https://web.whatsapp.com', {
        dispatcher: waAgent,
        signal: AbortSignal.timeout(10000),
      });
      platformLatency = Date.now() - platStart;
    } catch(e) {
      platformLatency = null;
    }

    res.json({
      success: true,
      connected: true,
      host,
      externalIp: externalIp || host,
      country: country || null,
      networkLatency,
      platformLatency,
    });
  } catch (err) {
    console.error('[WA TestProxy] error:', err);
    res.status(500).json({ error: 'Proxy test failed: ' + err.message });
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

// GET /api/accounts/email —— 列出邮箱账号
router.get('/email', async (req, res) => {
  try {
    const accounts = await prisma.emailAccount.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json(accounts);
  } catch (err) {
    console.error('[Email List] error:', err);
    res.status(500).json({ error: 'Failed to list email accounts' });
  }
});

// DELETE /api/accounts/email/:id —— 删除邮箱账号
router.delete('/email/:id', async (req, res) => {
  try {
    const accountId = parseInt(req.params.id);
    await prisma.emailAccount.delete({ where: { id: accountId } });
    res.json({ success: true, message: 'Email account deleted' });
  } catch (err) {
    console.error('[Email Delete] error:', err);
    res.status(500).json({ error: 'Failed to delete email account' });
  }
});
