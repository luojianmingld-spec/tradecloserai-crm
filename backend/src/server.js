/**
 * CRM Backend Server - Evolution API 集成版
 * 替代裸Baileys直连，通过Evolution HTTP REST API对接WhatsApp
 */
import dns from 'dns';
// Vultr日本节点IPv6路由TG不通，强制fetch走IPv4
dns.setDefaultResultOrder('ipv4first');
import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';
import { setupSocketHandlers } from './socket/handlers.js';
import { getEvolutionConnector } from './services/evolution-connector.js';
import authRoutes from './routes/auth.js';
import accountRoutes from './routes/accounts.js';
import contactRoutes from './routes/contacts.js';
import messageRoutes from './routes/messages.js';
import settingsRoutes from './routes/settings.js';
import translationRoutes from './routes/translation.js';
import aiRoutes from './routes/ai.js';
import customerRoutes from './routes/customers.js';
import emailRoutes from './routes/emails.js';
import bgCheckRoutes from './routes/background-check.js';
import bantScoreRoutes from './routes/bant-score.js';
import automationRoutes from './routes/automation.js';
import dashboardRoutes from './routes/dashboard.js';
import dashboardAnalyticsRoutes from './routes/dashboard-analytics.js';
import evolutionWebhookRoutes, { maybeSyncContactsOnDemand, startContactSyncScheduler } from './routes/evolution-webhook.js';
import evolutionAdminRoutes from './routes/evolution-admin.js';
import documentRoutes from './routes/documents.js';
import waAvatarRoutes from './routes/wa-avatar.js';
import telegramWebhookRoutes from './routes/telegram-webhook.js';
import { getTelegramConnector } from './services/telegram-connector.js';
import tgUserbotRoutes from './routes/tg-userbot.js';
import { autoConnectUserBot } from './services/tg-userbot-connector.js';
import companyMaterialsRouter from './routes/companyMaterials.js';
import companyCategoriesRouter from './routes/companyCategories.js';
import assistantRoutes from './routes/assistant.js';
import agentGroupRoutes from './routes/agent-group.js';
import trackingRoutes from './routes/tracking.js';
import contextRoutes from './routes/context.js';
import agentTaskRoutes from './routes/agent-tasks.js';
import customerChannelRoutes from './routes/customer-channels.js';
import customerPanoramaRoutes from './routes/customer-panorama.js';
import productKnowledgeRoutes from './routes/product-knowledge.js';
import conversationManagerRoutes from './routes/conversation-manager.js';
import attitudeAnalysisRoutes from './routes/attitude-analysis.js';
import actionSuggestionsRoutes from './routes/action-suggestions.js';
import speechLibraryRoutes from './routes/speech-library.js';
import communityExperienceRoutes from './routes/community-experience.js';
import tradeShowsRoutes from './routes/trade-shows.js';
import qaKnowledgeRoutes from './routes/qa-knowledge.js';
import effectTrackingRoutes from './routes/effect-tracking.js';
import learningRoutes from './routes/learning.js';
import paymentNotifyRoutes from './routes/payment-notify.js';
import userCreditRoutes from './routes/user/credits.js';
import cultureSettingsRoutes from './routes/culture-settings.js';
import chatImportRoutes from './routes/chat-import.js';
import docArchiveRoutes from './routes/doc-archive.js';
import partnerRoutes from './routes/partners.js';
import wecomRoutes from './routes/wecom.js';
import wechatOfficialRoutes from './routes/wechat-official.js';
import wechatNotifyRoutes from './routes/wechat-notify.js';import tradeAgentRoutes from './routes/trade-agent.js';import adminRoutes from './routes/admin/index.js';import openaiBridgeRoutes from './routes/openai-bridge.js';
import { getPendingFollowups } from './services/followup.service.js';
import { readTranslationSettings, getTranslationSettings } from "./routes/translation.js";
import { detectLanguage as _detectLangForSend, translateText as _translateTextForSend } from "./services/ai.service.js";
import { authMiddleware } from './middleware/auth.js';
import { resolveToPhoneJid } from './services/lid-mapping.js';
import { decrypt as dec, isEncrypted as isEnc } from './utils/encryption.js';
import logger from './utils/logger.js';
function decToken(t) { return t && isEnc(t) ? dec(t) : t; }
import { recordSample } from "./services/speech-collector.js";
import helmet from 'helmet';
import rateLimit from 'express-rate-limit'; // Phase1 AI话术库采集

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();
const app = express();
const httpServer = createServer(app);

async function ensureDatabase() {
  try {
    await prisma.user.count();
    console.log('[DB] Database connected, tables exist');
  } catch (err) {
    console.error('[DB] Database check failed, running prisma db push...');
    try {
      const { execSync } = await import('child_process');
      execSync('npx prisma db push --accept-data-loss', { stdio: 'inherit', cwd: process.cwd() });
      console.log('[DB] prisma db push completed');
    } catch (pushErr) {
      console.error('[DB] prisma db push failed:', pushErr.message);
    }
  }
}

const PORT = process.env.PORT || 3001;
const isProduction = process.env.NODE_ENV === 'production';
const LISTEN_PORT = isProduction ? (parseInt(process.env.DEPLOY_RUN_PORT, 10) || 5000) : PORT;
const DEFAULT_SESSION_ID = "user_1";

// ─── Multi-account sessionId resolver ───
async function resolveSessionIdForAccount(accountId) {
  try {
    const acc = await prisma.whatsAppAccount.findUnique({ where: { id: accountId } });
    if (!acc) {
      return accountId === 1 ? "user_1" : `user_${accountId}`;
    }
    if (acc.phone) {
      const conn = await prisma.wAConnection.findFirst({ where: { userId: acc.userId || 1, phone: acc.phone, sessionId: { startsWith: 'user_' } } });
      if (conn) return conn.sessionId;
    }
  } catch (e) {}
  // 【P0安全修复】不允许 fallback 到全局 user_1（防跨租户串写/串读）；返回该账号自身 session
  if (accountId === 1) return "user_1";
  return `user_${accountId}`;
}

// 返回某账号 phone 关联的所有 WAConnection session（同一号码可能有多个 session）
async function resolveSessionIdSetForAccount(accountId) {
  try {
    const acc = await prisma.whatsAppAccount.findUnique({ where: { id: accountId } });
    if (!acc) return [];
    const uid = acc.userId || 1;
    // 该账号独立连接的 sessionId（精确归属）
    let owned = [];
    if (acc.phone) {
      // 【修复 2026-08-26】wAConnection.userId 可能与该账号 userId 不一致(user_8.userId=1 而账号8.userId=2)，
      // 按 userId+phone 匹配会漏 → 改为按 phone 唯一匹配(phone 是账号唯一标识,不串号)
      const conns = await prisma.wAConnection.findMany({
        where: { phone: acc.phone, sessionId: { startsWith: 'user_' } },
        select: { sessionId: true },
      });
      owned = conns.map(c => c.sessionId);
    }
    // 显式兜底 user_{accountId}(webhook instanceToSessionId 落库约定: 实例→account.id→user_{id})
    const _selfSid = `user_${accountId}`;
    if (!owned.includes(_selfSid) && acc.phone) owned.push(_selfSid);
    // 【P0修复 20260815】合并该 userId 名下全部 user_ 会话 sessionId：
    // 历史消息可能散落在其他 sessionId（如 7/29 批量导入存到 user_2，而会话标在 accountId=1/4），
    // 单账号只映射自身 sessionId 会漏查（accountId=4→user_4 不存在→消息区空白）。
    // wAConnection 已按 userId 过滤，多租户下不会串号；同一联系人跨号消息合并展示更完整。
    const allConns = await prisma.wAConnection.findMany({
      where: { userId: uid, sessionId: { startsWith: 'user_' } },
      select: { sessionId: true },
    });
    const merged = Array.from(new Set([...owned, ...allConns.map(c => c.sessionId)]));
    if (merged.length) return merged;
  } catch (e) {}
  // 【Bug修复 2026-08-23】fallback 与 webhook instanceToSessionId 对齐（evolution-webhook.js）：
  // jeremy-eric → user_2；其余实例（含 wa_whatsapp2 账号87 等）→ user_1。
  // 原 fallback 返回 user_{accountId}，而 userId=45 在 wAConnection 无记录时落到 user_87，
  // 实际消息存于 user_1，导致 /messages 查不到 → 聊天框空白。
  try {
    const _acc = await prisma.whatsAppAccount.findUnique({ where: { id: accountId }, select: { instanceName: true } });
    if (_acc && _acc.instanceName === 'jeremy-eric') return ['user_2'];
    // 【修复 2026-08-26】fallback 与 webhook instanceToSessionId 对齐: user_{accountId}
    return [`user_${accountId}`];
  } catch { return [`user_${accountId}`]; }
}

// 确保 WAConnection 存在（WAMessage.sessionId 有外键约束），不存在则自动创建
async function ensureSessionInDb(userId, sessionId, phone = null) {
  try {
    if (!sessionId) return;
    const exist = await prisma.wAConnection.findUnique({ where: { sessionId } });
    if (!exist) {
      await prisma.wAConnection.create({
        data: { userId: userId || 1, sessionId, phone, status: 'connected' },
      });
      console.log(`[WASession] auto-created WAConnection session=${sessionId} userId=${userId || 1}`);
    }
  } catch (e) {
    console.warn('[WASession] ensureSessionInDb warn:', e.message);
  }
}


// ─── 会话操作辅助函数 ───
async function _ensureConversation(accountId, jid, platform = "whatsapp") {
  try {
    if (!jid || !jid.includes("@")) return null;
    const _ph = jid.split("@")[0];
    // telegram的jid是纯数字+@telegram，不需要/^[0-9]+$/校验
    if (platform === "whatsapp" && (!_ph || _ph === "0" || _ph.length < 5 || !/^[0-9]+$/.test(_ph))) return null;
    // 检查是否在已删除名单中，防止webhook重建已删除的联系人
    const _phoneForCheck = jid.split("@")[0];
    try {
      const deleted = await prisma.$queryRawUnsafe(
        `SELECT 1 FROM "DeletedContact" WHERE "accountId" = ? AND ("jid" = ? OR "jid" LIKE ? OR "jid" LIKE ?)`,
        accountId, jid, _phoneForCheck + '@%', _phoneForCheck + '@lid'
      );
      if (deleted.length > 0) {
        console.log('[_ensureConversation] Skipping deleted contact:', jid, 'accountId:', accountId);
        return null;
      }
    } catch(_e) { /* table may not exist yet */ }
    const cwhere = { accountId_platform_jid: { accountId, platform, jid } };
    let contact = await prisma.contact.findUnique({ where: cwhere });
    if (!contact) {
      const phone = jid.split("@")[0];
      try {
        contact = await prisma.contact.create({ data: { accountId, platform, jid, phone: platform === "whatsapp" ? phone : null } });
      } catch (e) {
        contact = await prisma.contact.findUnique({ where: cwhere });
      }
    }
    const vwhere = { accountId_platform_jid: { accountId, platform, jid } };
    let conv = await prisma.conversation.findUnique({ where: vwhere });
    if (!conv && contact) {
      try {
        conv = await prisma.conversation.create({
          data: { accountId, platform, contactId: contact.id, jid, pinned: false, starred: false, blocked: false },
        });
      } catch (e) {
        conv = await prisma.conversation.findUnique({ where: vwhere });
      }
    }
    return conv;
  } catch (e) {
    console.warn("[_ensureConversation] error:", e.message);
    return null;
  }
}

async function _toggleConvField(jid, field) {
  const accountId = 1;
  let conv = await prisma.conversation.findUnique({ where: { accountId_platform_jid: { accountId, platform: "whatsapp", jid } } });
  if (!conv) conv = await _ensureConversation(accountId, jid, "whatsapp");
  if (!conv) throw new Error("conversation not found");
  return prisma.conversation.update({
    where: { id: conv.id },
    data: { [field]: !conv[field], updatedAt: new Date() },
  });
}

const DEFAULT_INSTANCE = process.env.EVOLUTION_INSTANCE || "jeremy-eric";

process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught Exception:', err.message);
  logger.error('Server', '[FATAL] Uncaught Exception:', err.message);
  console.error(err.stack);
  if (err.code === 'EADDRINUSE') {
    console.error(`[FATAL] Port ${LISTEN_PORT} is already in use. Exiting.`);
    process.exit(1);
  }
});

process.on('unhandledRejection', (reason) => {
  console.error('[ERROR] Unhandled Promise Rejection:', reason);
  logger.error('Server', '[ERROR] Unhandled Promise Rejection:', reason);
});

app.use(cors({
  origin: isProduction ? false : ['http://localhost:5173', 'http://localhost:5000', 'http://localhost:3000'],
  credentials: true,
}));

// ── Security: Helmet (HTTP security headers) ──
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

// ── Trust proxy (Nginx reverse proxy) ──
app.set('trust proxy', 'loopback, linklocal, uniquelocal');

// ── Security: Rate Limiting ──
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '请求过于频繁，请稍后再试' },
  skip: (req) => {
    // 跳过健康检查和 WebSocket 升级请求
    if (req.path === '/api/health' || req.path === '/health') return true;
    if (req.headers?.upgrade?.toLowerCase() === 'websocket') return true;
    return false;
  },
});
app.use(apiLimiter);

const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '登录尝试过于频繁，请1分钟后重试' },
});

// ── Custom multipart parser for /api/whatsapp/send-media (no multer dependency) ──
// Uses Node v22's built-in Request/FormData via undici.
async function parseMultipartMedia(req) {
  const contentType = req.headers['content-type'] || '';
  if (!contentType.includes('multipart/form-data')) return { fields: {}, file: null };
  // Rebuild a Request from the incoming req so undici's form parser works
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const buf = Buffer.concat(chunks);
  // Use Node's built-in undici Request/FormData parser through a fake Request
    // Simpler reliable approach: use undici's form parser if available; otherwise use busboy-free manual parse.
  // Use @remix-run/web-file? No. Let's use the 'formdata-node'? Not installed.
  // Final approach: manually parse multipart body using boundary.
  return parseMultipartBody(buf, contentType);
}

function parseMultipartBody(buf, contentType) {
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!boundaryMatch) return { fields: {}, file: null };
  const boundary = '--' + (boundaryMatch[1] || boundaryMatch[2]);
  const fields = {};
  let file = null;
  const raw = buf;
  const bBuf = Buffer.from(boundary);
  let idx = raw.indexOf(bBuf);
  while (idx !== -1) {
    const nextIdx = raw.indexOf(bBuf, idx + bBuf.length);
    const partEnd = nextIdx === -1 ? raw.length : nextIdx - 2; // strip \r\n
    const partStart = idx + bBuf.length + 2; // skip \r\n after boundary
    if (partStart >= partEnd) { idx = nextIdx; continue; }
    const part = raw.slice(partStart, partEnd);
    // Split headers from body at the first double \r\n
    const headerEnd = part.indexOf('\r\n\r\n');
    if (headerEnd === -1) { idx = nextIdx; continue; }
    const headerStr = part.slice(0, headerEnd).toString('utf8');
    const body = part.slice(headerEnd + 4);
    const dispMatch = headerStr.match(/content-disposition:\s*form-data;\s*([^\r\n]+)/i);
    if (!dispMatch) { idx = nextIdx; continue; }
    const disp = dispMatch[1];
    const nameMatch = disp.match(/name="([^"]+)"/i);
    const fnMatch = disp.match(/filename="([^"]*)"/i);
    const name = nameMatch ? nameMatch[1] : '';
    const ctypeMatch = headerStr.match(/content-type:\s*([^\r\n;]+)/i);
    const ctype = ctypeMatch ? ctypeMatch[1].trim() : 'application/octet-stream';
    if (!name) { idx = nextIdx; continue; }
    if (fnMatch && name === 'file') {
      file = { fieldName: name, fileName: fnMatch[1], mimeType: ctype, buffer: body };
    } else {
      fields[name] = body.toString('utf8').replace(/\r\n$/, '');
    }
    idx = nextIdx;
  }
  return { fields, file };
}

app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));


// ─── API Routes ───
app.use('/api/auth', loginLimiter, authRoutes);
app.use('/api/accounts', authMiddleware, accountRoutes);
app.use('/api/contacts', authMiddleware, contactRoutes);
app.use('/api/messages', authMiddleware, messageRoutes);
app.use('/api/settings', authMiddleware, settingsRoutes);
app.use('/api/culture-settings', authMiddleware, cultureSettingsRoutes);
app.use('/api/partners', authMiddleware, partnerRoutes);
app.use('/api/wecom', authMiddleware, wecomRoutes);

// 微信公众号回调（不需要认证，微信服务器调用）
app.use('/api/wechat', wechatOfficialRoutes);

// 微信通知推送（需要认证）
app.use('/api/wechat', authMiddleware, wechatNotifyRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/translation', authMiddleware, translationRoutes);
// AI API 调用专用限流（50次/分钟/IP）
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'AI调用过于频繁，请1分钟后重试' },
  validate: { keyGeneratorIpFallback: false }
});

app.use('/api/ai', authMiddleware, aiLimiter, aiRoutes);
app.use('/api/trade-agent', authMiddleware, tradeAgentRoutes);
// OpenClaw 微信通道桥接（CRM Agent 包装为 OpenAI 兼容模型，独立 OPENAI_BRIDGE_KEY 鉴权）
app.use('/api/openai', openaiBridgeRoutes);
app.use('/api/agent-group', authMiddleware, agentGroupRoutes);
app.use('/api/agent/tasks', authMiddleware, agentTaskRoutes);
app.use('/api/customer/channels', authMiddleware, customerChannelRoutes);
app.use('/api/customer', authMiddleware, customerPanoramaRoutes);
app.use('/api/customers', authMiddleware, customerRoutes);
app.use('/api/emails', authMiddleware, emailRoutes);
app.use('/api/background-check', authMiddleware, bgCheckRoutes);
app.use('/api/customers', authMiddleware, bantScoreRoutes);
app.use("/api/dashboard", authMiddleware, dashboardRoutes);
app.use("/api/dashboard", dashboardAnalyticsRoutes);
app.use("/api/automation", authMiddleware, automationRoutes);
app.use("/api/assistant", authMiddleware, assistantRoutes);
app.use("/api/tracking", authMiddleware, trackingRoutes);
app.use("/api/context", authMiddleware, contextRoutes);
app.use("/api/product-knowledge", authMiddleware, productKnowledgeRoutes);
app.use("/api/customers", authMiddleware, conversationManagerRoutes);

// Phase 6-9: AI Sales Enhancement Routes
app.use('/api/attitude', authMiddleware, attitudeAnalysisRoutes);
app.use('/api/suggestions', authMiddleware, actionSuggestionsRoutes);
app.use('/api/speech-library', authMiddleware, speechLibraryRoutes);
app.use('/api/community-experience', authMiddleware, communityExperienceRoutes);
app.use('/api/trade-shows', authMiddleware, tradeShowsRoutes);
app.use('/api/qa-knowledge', authMiddleware, qaKnowledgeRoutes);
app.use('/api/effectiveness', authMiddleware, effectTrackingRoutes);
app.use('/api/learning', authMiddleware, learningRoutes);
app.use("/api/documents", authMiddleware, documentRoutes);
app.use("/api/company-materials", companyMaterialsRouter);
app.use("/api/company-categories", companyCategoriesRouter);
app.use('/api/chat-import', authMiddleware, chatImportRoutes);
// ===== 充值模块（2026-08-19）=====
app.use('/api/payment/notify', paymentNotifyRoutes); // 支付回调（无鉴权）
app.use('/api/payments', authMiddleware, userCreditRoutes); // 用户端充值&积分
app.use('/api/doc-archive', authMiddleware, docArchiveRoutes); // 单证存档（2026-08-31）

app.use('/', waAvatarRoutes);
app.use("/api/settings/seller-info", authMiddleware, documentRoutes);
app.get('/api/followups/pending', authMiddleware, async (req, res) => { try { const data = await getPendingFollowups({ userId: req.userId, sessionId: 'user_1' }); res.json(data); } catch (e) { console.error('[followup] error:', e); res.status(500).json({ error: e.message }); } });

// ─── Evolution Webhook（公开，Evolution通过127.0.0.1访问，不带auth） ───
// 兼容 Evolution webhookByEvents=true 时带子路径的回调（/messages-upsert 等）：统一重写到根路径
app.use("/api/evolution/webhook", (req, _res, next) => {
  if (req.path !== "/" && req.method === "POST") {
    req.url = "/";
  }
  next();
});
app.use("/api/evolution/webhook", evolutionWebhookRoutes);
app.use("/api/evolution/admin", evolutionAdminRoutes);

// WhatsApp 重连页面
app.get('/reconnect', (req, res) => {
  res.sendFile('/opt/whatsapp-crm/backend/src/uploads/qr-reconnect.html');
});
// Telegram webhook (no auth - TG servers push directly)
app.use("/api/telegram", telegramWebhookRoutes);
app.use("/api/tg-userbot", tgUserbotRoutes);

// ─── Evolution WhatsApp 公开接口（状态/QR）必须在authMiddleware之前 ───
const evoConnector = getEvolutionConnector();

// 批量验号：POST /api/whatsapp/check-number
app.post("/api/whatsapp/check-number", authMiddleware, async (req, res) => {
  try {
    const { numbers } = req.body || {};
    if (!Array.isArray(numbers) || !numbers.length) {
      return res.status(400).json({ error: "numbers (array) is required" });
    }
    const EVO_URL = process.env.EVOLUTION_API_URL || "http://127.0.0.1:8081";
    const EVO_KEY = process.env.EVOLUTION_API_KEY || "B7E2A9D4C6F1E8A3B5D7F9C2E4A6B8D1";
    const INSTANCE = process.env.EVOLUTION_INSTANCE || "jeremy-eric";
    // 智能补国家码：11位以1开头的中国手机号自动补86；其他不补
    const cleaned = [];
    const fallbackMap = {}; // 原始请求索引 -> 带86的二次请求号
    numbers.forEach(n => {
      let raw = String(n).replace(/[\s+\-()]/g, "");
      if (!raw) return;
      cleaned.push(raw);
      // 11位以1开头的中国手机号，第一次先原样发，失败时再补86重试
      if (/^1\d{10}$/.test(raw)) {
        fallbackMap[cleaned.length - 1] = "86" + raw;
      }
    });
    let r = await fetch(`${EVO_URL}/chat/whatsappnumbers/${INSTANCE}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": EVO_KEY },
      body: JSON.stringify({ numbers: cleaned }),
    });
    let data = await r.json();
    let result = Array.isArray(data) ? data : (data?.response || data?.data || []);
    // 对第一次未注册的11位中国号，补86再查一次
    const retryIdxs = [];
    const retryNums = [];
    result.forEach((item, idx) => {
      if (!item.exists && fallbackMap[idx] !== undefined) {
        retryIdxs.push(idx);
        retryNums.push(fallbackMap[idx]);
      }
    });
    if (retryNums.length) {
      const r2 = await fetch(`${EVO_URL}/chat/whatsappnumbers/${INSTANCE}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": EVO_KEY },
        body: JSON.stringify({ numbers: retryNums }),
      });
      const d2 = await r2.json();
      const arr2 = Array.isArray(d2) ? d2 : (d2?.response || d2?.data || []);
      retryIdxs.forEach((origIdx, i) => {
        if (arr2[i]) {
          result[origIdx] = arr2[i];
          result[origIdx]._autoCountryCode = true;
        }
      });
    }
    res.json(result);
  } catch (err) {
    console.error("[WA check-number Error]", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/whatsapp/status", async (req, res) => {
  try {
    const state = await evoConnector.getConnectionState();
    const isConnected = state === "open";
    const info = isConnected ? await evoConnector.getInstanceInfo().catch(() => null) : null;
    const ownerJid = info?.ownerJid || "";
    const phone = ownerJid.split("@")[0] || "8613016242602";
    // 确保DB有记录
    try {
      let conn = await prisma.wAConnection.findUnique({ where: { sessionId: DEFAULT_SESSION_ID } });
      if (!conn) {
        await prisma.wAConnection.create({ data: { userId: 1, sessionId: DEFAULT_SESSION_ID, phone, status: isConnected ? "connected" : "disconnected" } });
      } else if (isConnected && conn.status !== "connected") {
        await prisma.wAConnection.update({ where: { id: conn.id }, data: { status: "connected", phone, lastConnectedAt: new Date() } });
      }
    } catch (e) {}
    // 读取降频冷却状态
    let cooldownUntil = null;
    try {
      const cdFile = '/opt/whatsapp-crm/backend/.wa-cooldown';
      if (fs.existsSync(cdFile)) {
        const cdContent = fs.readFileSync(cdFile, 'utf8');
        const m = cdContent.match(/COOLDOWN_UNTIL=([^\s]+)/);
        if (m) {
          const t = new Date(m[1]).getTime();
          if (t > Date.now()) cooldownUntil = m[1];
        }
      }
    } catch(e) {}
    res.json({
      status: isConnected ? "connected" : "disconnected",
      connected: isConnected,
      state,
      instance: evoConnector.instance,
      phone,
      ownerJid,
      pushName: info?.profileName || info?.pushName || null,
      profilePicUrl: info?.profilePicUrl || null,
      sessionId: DEFAULT_SESSION_ID,
      mode: "evolution-api",
      cooldownUntil,
    });
  } catch (e) {
    res.json({ status: "disconnected", connected: false, state: "error", error: e.message });
  }
});

app.get("/api/whatsapp/qr", async (req, res) => {
  try {
    const qr = await evoConnector.getQRCode();
    res.json({ qr, connected: false });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/whatsapp/qr — 前端ChatView请求QR码
app.post("/api/whatsapp/qr", async (req, res) => {
  try {
    const state = await evoConnector.getConnectionState();
    if (state === "open") {
      const info = await evoConnector.getInstanceInfo().catch(() => null);
      return res.json({
        status: "connected",
        phone: info?.ownerJid?.split("@")?.[0] || null,
        pushName: info?.profileName || null,
        ownerJid: info?.ownerJid || null,
        sessionId: evoConnector.instance,
      });
    }
    const qr = await evoConnector.getQRCode();
    res.json({
      qr: qr || null,
      status: qr ? "waiting_qr" : "connecting",
      sessionId: evoConnector.instance,
    });
  } catch (e) {
    console.error("[POST /api/whatsapp/qr] error:", e.message);
    res.status(500).json({ error: e.message });
  }
});


// POST /api/whatsapp/pairing-code — 通过手机号获取8位配对码（前端手机号登录页使用）
app.post("/api/whatsapp/pairing-code", authMiddleware, async (req, res) => {
  try {
    const { phone } = req.body || {};
    if (!phone) return res.status(400).json({ error: "phone number is required" });
    const account = await prisma.whatsAppAccount.findFirst({
      where: { userId: req.userId, platform: "whatsapp", instanceName: { not: null } },
      orderBy: { createdAt: "desc" },
    });
    if (!account || !account.instanceName) {
      return res.status(404).json({ error: "No WhatsApp account available, please create one first" });
    }
    const instanceName = account.instanceName;
    // 1. 确保实例存在
    const instances = await evoFetch("/instance/fetchInstances");
    let inst = (instances || []).find(i => i.name === instanceName);
    if (!inst) {
      await evoFetch("/instance/create", {
        method: "POST",
        body: JSON.stringify({ instanceName, integration: "WHATSAPP-BAILEYS", qrcode: true, number: phone }),
      });
      await new Promise(r => setTimeout(r, 1500));
    }
    // 2. 实例非 close 状态先重置（配对码需在未连接状态生成）
    const instances2 = await evoFetch("/instance/fetchInstances");
    inst = (instances2 || []).find(i => i.name === instanceName);
    if (inst && inst.connectionStatus !== "close") {
      await evoFetch("/instance/logout/" + encodeURIComponent(instanceName), { method: "DELETE", skipError: true });
      // 等待实例真正进入 close 状态（logout 异步，直接 connect 可能拿不到配对码）
      for (let w = 0; w < 6; w++) {
        await new Promise(r => setTimeout(r, 1000));
        const st = await evoFetch("/instance/fetchInstances").catch(() => []);
        const cur = (st || []).find(i => i.name === instanceName);
        if (!cur || cur.connectionStatus === "close") break;
      }
    }
    // 3. connect 带 number 触发配对码生成（实例状态竞态偶发 pairingCode=null，最多重试3次）
    let data = null, code = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      data = await evoFetch("/instance/connect/" + encodeURIComponent(instanceName) + "?number=" + encodeURIComponent(phone), { skipError: true });
      code = data?.pairingCode || null;
      if (code) break;
      await new Promise(r => setTimeout(r, 1500));
    }
    if (!code) return res.status(502).json({ error: "Failed to get pairing code from Evolution API" });
    res.json({ code, phone });
  } catch (err) {
    console.error("[POST /api/whatsapp/pairing-code] error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── WA 实例管理接口（登录/登出/状态） ───
const EVO_API = process.env.EVOLUTION_API_URL || "http://127.0.0.1:8081";
const EVO_KEY = process.env.EVOLUTION_API_KEY || "B7E2A9D4C6F1E8A3B5D7F9C2E4A6B8D1";
const EVO_INST = process.env.EVOLUTION_INSTANCE || "jeremy-eric";

async function evoFetch(path, opts = {}) {
  const headers = { apikey: EVO_KEY, "Content-Type": "application/json", ...(opts.headers||{}) };
  const r = await fetch(EVO_API + path, { ...opts, headers });
  if (!r.ok && !opts.skipError) {
    const txt = await r.text().catch(()=>"");
    throw new Error("EVO " + r.status + ": " + txt.slice(0,300));
  }
  return r.json().catch(()=>({}));
}

// GET /api/whatsapp/admin/status — 获取当前实例详情+连接状态
app.get("/api/whatsapp/admin/status", authMiddleware, async (req, res) => {
  try {
    const conn = await evoFetch("/instance/connectionState/" + EVO_INST, {skipError:true}).catch(()=>({instance:{state:"error"}}));
    const state = conn?.instance?.state || "unknown";
    let info = null;
    try {
      const insts = await evoFetch("/instance/fetchInstances");
      if (Array.isArray(insts)) info = insts.find(i=>i.name===EVO_INST) || null;
    } catch(e){}
    res.json({
      state,
      connected: state === "open",
      instanceName: EVO_INST,
      ownerJid: info?.ownerJid || null,
      profileName: info?.profileName || info?.pushName || null,
      profilePicUrl: info?.profilePicUrl || null,
      instanceId: info?.id || null,
    });
  } catch(e) {
    res.status(500).json({error: e.message});
  }
});

// POST /api/whatsapp/admin/qr — 获取QR码(不传phone)或配对码(传phone)
// body: { phone?: "8613016242602" }
// 如果实例不存在会自动创建(mobile模式如果传了phone)
app.post("/api/whatsapp/admin/qr", authMiddleware, async (req, res) => {
  try {
    const { phone } = req.body || {};
    // 先检查实例是否存在
    let state = "unknown";
    try {
      const c = await evoFetch("/instance/connectionState/" + EVO_INST, {skipError:true});
      state = c?.instance?.state || "unknown";
    } catch(e) { state = "missing"; }

    // 如果实例不存在(404等)，尝试创建
    if (state === "missing" || state === "unknown" || state === "close") {
      // 先尝试connect
      try {
        const connectRes = await fetch(EVO_API + "/instance/connect/" + EVO_INST, {
          headers: { apikey: EVO_KEY }
        });
        if (connectRes.ok) {
          const d = await connectRes.json();
          if (d?.base64 || d?.pairingCode) {
            return res.json({
              qr: d.base64 || null,
              pairingCode: d.pairingCode || null,
              state: (await evoFetch("/instance/connectionState/"+EVO_INST,{skipError:true}))?.instance?.state || "connecting"
            });
          }
        }
      } catch(e){}
    }

    // 调connect获取新QR
    const r = await fetch(EVO_API + "/instance/connect/" + EVO_INST + (phone ? ("?phone=" + encodeURIComponent(phone)) : ""), {
      headers: { apikey: EVO_KEY }
    });
    if (!r.ok) {
      // connect失败可能需要重建实例
      return res.status(400).json({error: "Failed to get QR, instance may need reset. Try /api/whatsapp/admin/reset"});
    }
    const d = await r.json();
    const newState = (await evoFetch("/instance/connectionState/"+EVO_INST,{skipError:true}))?.instance?.state || "connecting";
    res.json({
      qr: d.base64 || d.code || null,
      pairingCode: d.pairingCode || null,
      count: d.count || null,
      state: newState,
    });
  } catch(e) {
    res.status(500).json({error: e.message});
  }
});

// POST /api/whatsapp/admin/reset — 删除旧实例并重建（mobile:true=配对码模式）
// body: { pairingCode?: true } — true则用配对码模式
app.post("/api/whatsapp/admin/reset", authMiddleware, async (req, res) => {
  try {
    const { pairingCode, phone } = req.body || {};
    // 删除旧实例(忽略错误)
    await fetch(EVO_API + "/instance/delete/" + EVO_INST, {
      method: "DELETE",
      headers: { apikey: EVO_KEY }
    }).catch(()=>{});
    // 等待
    await new Promise(r => setTimeout(r, 1500));
    // 创建新实例
    const createBody = {
      instanceName: EVO_INST,
      qrcode: !pairingCode,
      integration: "WHATSAPP-BAILEYS",
      ...(pairingCode ? { mobile: true } : {})
    };
    const cr = await fetch(EVO_API + "/instance/create", {
      method: "POST",
      headers: { apikey: EVO_KEY, "Content-Type": "application/json" },
      body: JSON.stringify(createBody),
    });
    if (!cr.ok) {
      const errTxt = await cr.text().catch(()=>"");
      return res.status(500).json({error: "Create instance failed: " + errTxt.slice(0,300)});
    }
    const cd = await cr.json().catch(()=>({}));

    // 设置默认参数(groupsIgnore等)
    try {
      await fetch(EVO_API + "/settings/set/" + EVO_INST, {
        method: "POST",
        headers: { apikey: EVO_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          rejectCall: false, msgCall: "", groupsIgnore: true, alwaysOnline: false,
          readMessages: false, readStatus: false, syncFullHistory: false, wavoipToken: ""
        })
      });
    } catch(e){}

    // 设置webhook — 多实例支持（仅 ENABLE_WEBHOOK_RESET=true 时执行）
    if (process.env.ENABLE_WEBHOOK_RESET === 'true') {
    const webhookPort = process.env.DEPLOY_RUN_PORT || 3000;
    const webhookUrl = `http://host.docker.internal:${webhookPort}/api/evolution/webhook`;
    const waInstances = ["jeremy-main", "jeremy-eric"];
    for (const inst of waInstances) {
      try {
        await fetch(EVO_API + "/webhook/set/" + inst, {
          method: "POST",
          headers: { apikey: EVO_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({
            webhook: {
              enabled: true,
              url: webhookUrl,
              byEvents: true,
              events: ["MESSAGES_UPSERT","MESSAGES_UPDATE","MESSAGES_DELETE","CONNECTION_UPDATE","SEND_MESSAGE"]
            }
          })
        });
        console.log(`[Server] webhook set for ${inst} -> ${webhookUrl}`);
      } catch(e){ console.warn(`[Server] webhook set ${inst} failed:`, e.message); }
    }
    } else {
      console.log('[Server] WA webhook set disabled (ENABLE_WEBHOOK_RESET != true)');
    }

    // 如果是QR模式，获取QR
    let qr = null, pairCode = null;
    if (!pairingCode) {
      try {
        const qrRes = await fetch(EVO_API + "/instance/connect/" + EVO_INST, {headers:{apikey:EVO_KEY}});
        if (qrRes.ok) {
          const qd = await qrRes.json();
          qr = qd.base64 || qd.code || null;
          pairCode = qd.pairingCode || null;
        }
      } catch(e){}
    } else {
      // 配对码模式：connect会返回pairingCode
      try {
        const qrRes = await fetch(EVO_API + "/instance/connect/" + EVO_INST + (phone ? ("?phone="+encodeURIComponent(phone)) : ""), {headers:{apikey:EVO_KEY}});
        if (qrRes.ok) {
          const qd = await qrRes.json();
          qr = qd.base64 || qd.code || null;
          pairCode = qd.pairingCode || null;
        }
      } catch(e){}
    }

    // 重启CRM让它感知新instance
    const { execSync } = await import('child_process');
    try { execSync("systemctl restart whatsapp-crm", {timeout: 5000}); } catch(e){}

    res.json({
      success: true,
      qr, pairingCode: pairCode,
      instance: cd,
      message: pairingCode ? "实例已重建(配对码模式)，请输入上方8位配对码" : "实例已重建(QR模式)，请扫下方二维码"
    });
  } catch(e) {
    res.status(500).json({error: e.message, stack: e.stack?.slice(0,200)});
  }
});

// POST /api/whatsapp/admin/logout — 登出当前实例
app.post("/api/whatsapp/admin/logout", authMiddleware, async (req, res) => {
  try {
    await fetch(EVO_API + "/instance/logout/" + EVO_INST, {
      method: "DELETE", headers: {apikey: EVO_KEY}
    }).catch(()=>{});
    res.json({success: true, message: "已登出，需要重新扫码"});
  } catch(e) {
    res.status(500).json({error: e.message});
  }
});


// ─── WhatsApp 核心业务接口（需auth，走Evolution） ───

// 发消息：POST /api/whatsapp/send  （前端用的接口）
// ── 出站自动翻译 ──
app.post("/api/whatsapp/send", authMiddleware, async (req, res) => {


  try {
    const body = req.body || {};
    const to = body.to;
    const originalText = (body.message || body.text || body.body || "").toString();
    if (!to || !originalText) return res.status(400).json({ error: "to and message/text required" });

    let toJid = to;
    if (!toJid.includes("@")) toJid = `${toJid.replace(/\D/g, "")}@s.whatsapp.net`;
    const toPhone = toJid.split("@")[0];

    // ─── Multi-instance: resolve correct Evolution connector based on accountId or conversation ───
    // 【P0安全修复】禁止默认使用全局第一个实例(jeremy-eric)，必须按当前登录用户(userId)隔离
    let sendConnector = null;
    let sendAccountId = body.accountId || null;
    const _sendUid = req.userId || 1;
    if (sendAccountId) {
      // 校验该账号归属当前用户，防止跨租户发送
      try {
        const waAccount = await prisma.whatsAppAccount.findFirst({
          where: { id: parseInt(sendAccountId), platform: 'whatsapp', userId: _sendUid, instanceName: { not: null } },
          select: { instanceName: true, id: true },
        });
        if (waAccount && waAccount.instanceName) {
          sendConnector = getEvolutionConnector(waAccount.instanceName);
          console.log(`[WA Send] Using instance ${waAccount.instanceName} for accountId=${sendAccountId} userId=${_sendUid}`);
        } else {
          return res.status(403).json({ error: "账号不存在或无权使用该账号发送消息" });
        }
      } catch (e) {
        console.warn('[WA Send] resolve account failed:', e.message);
        return res.status(500).json({ error: "账号解析失败" });
      }
    } else {
      // 未传accountId：先尝试从会话归属解析（需校验归属当前用户）
      try {
        const existingConv = await prisma.conversation.findFirst({
          where: { platform: 'whatsapp', jid: toJid },
          select: { accountId: true },
        });
        if (existingConv) {
          const _acc = await prisma.whatsAppAccount.findFirst({
            where: { id: existingConv.accountId, userId: _sendUid, platform: 'whatsapp', instanceName: { not: null } },
            select: { instanceName: true, id: true },
          });
          if (_acc && _acc.instanceName) {
            sendAccountId = _acc.id;
            sendConnector = getEvolutionConnector(_acc.instanceName);
          }
        }
      } catch (_) {}
      // 仍未解析到 → 使用当前用户自己的默认WhatsApp账号（connected优先）
      if (!sendConnector) {
        try {
          let myAcc = await prisma.whatsAppAccount.findFirst({
            where: { userId: _sendUid, platform: 'whatsapp', instanceName: { not: null }, status: 'connected' },
            select: { id: true, instanceName: true },
          });
          if (!myAcc) {
            myAcc = await prisma.whatsAppAccount.findFirst({
              where: { userId: _sendUid, platform: 'whatsapp', instanceName: { not: null } },
              orderBy: { updatedAt: 'desc' },
              select: { id: true, instanceName: true },
            });
          }
          if (myAcc && myAcc.instanceName) {
            sendAccountId = myAcc.id;
            sendConnector = getEvolutionConnector(myAcc.instanceName);
            console.log(`[WA Send] Using default instance ${myAcc.instanceName} for userId=${_sendUid}`);
          }
        } catch (e) {
          console.warn('[WA Send] resolve default account failed:', e.message);
        }
      }
      if (!sendConnector) {
        return res.status(400).json({ error: "请先连接WhatsApp账号再发送消息" });
      }
    }

    // ─── Telegram 账号分发（jid带@telegram后缀时） ───
    if (toJid.endsWith("@telegram")) {
      try {
        const tgChatId = toJid.split("@")[0];
        // 优先找 UserBot 账号（无 telegramBotToken），其次找 Bot 账号
        let tgAccount = await prisma.whatsAppAccount.findFirst({
          where: { platform: "telegram", telegramBotToken: null, status: "connected" },
          orderBy: { createdAt: "desc" },
        });
        const isUserBot = !!tgAccount;
        if (!tgAccount) {
          tgAccount = await prisma.whatsAppAccount.findFirst({
            where: { platform: "telegram", telegramBotToken: { not: null }, status: "connected" },
            orderBy: { createdAt: "desc" },
          });
        }
        if (!tgAccount) {
          return res.status(400).json({ error: "未连接Telegram，请先在账号栏连接" });
        }
        // ── TG 出站翻译（同 WA 逻辑） ──
        const tSettings = await getTranslationSettings(toJid, req.userId);
        let textMsg = originalText;
        let translationObj = null;
        const hasChinese = /[\u4e00-\u9fff]/.test(originalText);
        if (tSettings.blockChinese && !tSettings.sendEnabled && hasChinese) {
          return res.status(400).json({ error: "请先开启发送翻译或输入英文消息", code: "BLOCK_CHINESE" });
        }
        const tgtLang = tSettings.sendTargetLang || "en";
        if (tSettings.sendEnabled && tgtLang && tgtLang !== "auto") {
          try {
            const engine = tSettings.sendEngine || "deepl";
            let srcLang = "auto";
            try {
              const det = await _detectLangForSend(originalText, engine);
              if (det && det !== "unknown") srcLang = det;
            } catch (_) { srcLang = "auto"; }
            // 检测是否已是目标语言
            const hasJa = /[\u3040-\u309f\u30a0-\u30ff]/.test(originalText);
            const hasKo = /[\uac00-\ud7af]/.test(originalText);
            const hasZh = /[\u4e00-\u9fff]/.test(originalText);
            const hasAr = /[\u0600-\u06ff]/.test(originalText);
            const hasRu = /[\u0400-\u04ff]/.test(originalText);
            let alreadyInTarget = false;
            if (tgtLang === "ja") alreadyInTarget = hasJa;
            else if (tgtLang === "ko") alreadyInTarget = hasKo;
            else if (tgtLang === "zh") alreadyInTarget = hasZh && !hasJa && !hasKo;
            else if (tgtLang === "ar") alreadyInTarget = hasAr;
            else if (tgtLang === "ru") alreadyInTarget = hasRu;
            else if (["en","es","fr","de","pt","it","nl","tr","id","vi"].includes(tgtLang)) {
              if (hasZh || hasAr || hasRu || hasJa || hasKo) alreadyInTarget = false;
              else { const latin = (originalText.slice(0,500).match(/[A-Za-zÀ-ÿ]/g) || []).length; const total = originalText.replace(/\s+/g,"").length; alreadyInTarget = total > 0 && latin / total > 0.5; }
            }
            if (!alreadyInTarget && srcLang !== tgtLang) {
              const r = await _translateTextForSend(originalText, srcLang, tgtLang, engine, req.userId || 1);
              const translated = (r && (r.translated || r.text)) || "";
              if (translated && translated !== originalText) {
                textMsg = translated;
                // 虚线：先翻译成中文
                try {
                  const zhR = await _translateTextForSend(originalText, srcLang, "zh", engine, req.userId || 1);
                  const zhText = (zhR && (zhR.translated || zhR.text)) || "";
                  if (zhText && zhText !== textMsg) {
                    translationObj = { original: zhText, translated: textMsg, sourceLang: srcLang || "auto", targetLang: tgtLang };
                  } else {
                    translationObj = { original: originalText, translated: textMsg, sourceLang: srcLang || "auto", targetLang: tgtLang };
                  }
                } catch (_) {
                  // Only create translationObj if displayed text differs from original
                  if (textMsg !== originalText) {
                    translationObj = { original: originalText, translated: textMsg, sourceLang: srcLang || "auto", targetLang: tgtLang };
                  }
                }
              }
            } else if (tgtLang !== "zh") {
              try {
                const zhR = await _translateTextForSend(originalText, srcLang === "auto" ? tgtLang : srcLang, "zh", engine, req.userId || 1);
                const zhText = (zhR && (zhR.translated || zhR.text)) || "";
                if (zhText && zhText !== originalText) {
                  translationObj = { original: zhText, translated: originalText, sourceLang: srcLang === "auto" ? tgtLang : srcLang, targetLang: tgtLang };
                }
              } catch (te) { console.warn("[TG Send] zh fallback translate failed:", te.message); }
            }
          } catch (te) { console.warn("[TG Send] outgoing translate failed:", te.message); }
        }
        // ── Safety: if translation was supposed to happen but textMsg still has Chinese, block send ──
        if (tSettings.sendEnabled && tgtLang && tgtLang !== "zh" && /[\u4e00-\u9fff]/.test(textMsg)) {
          console.warn("[TG Send] translation failed - textMsg still contains Chinese, blocking send");
          return res.status(400).json({ error: "翻译失败，无法发送中文消息到Telegram。请检查翻译服务或手动输入英文。", code: "TRANSLATE_FAILED" });
        }
        let sent;
        if (isUserBot) {
          // 使用 GramJS UserBot 发送
          const ubConnector = await import('./services/tg-userbot-connector.js');
          sent = await ubConnector.sendMessage(tgChatId, textMsg);
        } else {
          // 使用 Bot API 发送
          const connector = getTelegramConnector(decToken(tgAccount.telegramBotToken));
          sent = await connector.sendMessage(tgChatId, textMsg);
        }
        // 写入/复用 contact + conversation
        let contact = await prisma.contact.findUnique({ where: { accountId_platform_jid: { accountId: tgAccount.id, platform: "telegram", jid: toJid } } });
        if (!contact) {
          contact = await prisma.contact.create({ data: { accountId: tgAccount.id, platform: "telegram", jid: toJid, name: tgChatId } });
        }
        let conv = await prisma.conversation.findUnique({ where: { accountId_platform_jid: { accountId: tgAccount.id, platform: "telegram", jid: toJid } } });
        if (!conv) {
          conv = await prisma.conversation.create({ data: { accountId: tgAccount.id, platform: "telegram", contactId: contact.id, jid: toJid } });
        }
        const tgSessionId = `tg_${tgAccount.telegramBotUsername || tgAccount.id}`;
        // 确保 WAConnection 存在（TG 发送落库外键）
        try {
          await prisma.wAConnection.upsert({
            where: { sessionId: tgSessionId },
            update: { status: 'connected', lastConnectedAt: new Date() },
            create: { userId: tgAccount.userId, sessionId: tgSessionId, status: 'connected', lastConnectedAt: new Date() },
          });
        } catch (wacErr2) { console.warn('[TG-Send] WAConnection upsert error:', wacErr2.message); }
        const tgSentMsgId = sent.message_id || sent.id;
        const tgWaMsgId = `tg_${tgAccount.id}_${tgSentMsgId}_out`;
        let savedWa = await prisma.wAMessage.findFirst({ where: { sessionId: tgSessionId, waMessageId: tgWaMsgId } });
        if (!savedWa) {
          savedWa = await prisma.wAMessage.create({
            data: {
              sessionId: tgSessionId,
              from: "me",
              to: toJid,
              body: textMsg,
              type: "text",
              direction: "outbound",
              timestamp: new Date(),
              read: true,
              translation: translationObj ? JSON.stringify(translationObj) : null,
              sourceLang: translationObj ? (translationObj.sourceLang || "auto") : null,
              waMessageId: tgWaMsgId,
            },
          });
        }
        await prisma.message.create({
          data: {
            accountId: tgAccount.id, platform: "telegram", contactId: contact.id, jid: toJid,
            fromMe: true, content: textMsg, messageType: "text",
            timestamp: savedWa.timestamp,
          },
        });
        await prisma.conversation.update({
          where: { id: conv.id },
          data: { lastMessage: textMsg.slice(0, 200), lastMessageAt: new Date(), unreadCount: 0 },
        });
        const io = req.app.get("io");
        if (io) {
          io.emit("telegram:message", {
            accountId: tgAccount.id, contactId: contact.id, jid: toJid,
            message: { id: savedWa.id, fromMe: true, content: textMsg, body: textMsg, messageType: "text", timestamp: savedWa.timestamp, translation: translationObj, platform: "telegram", waMessageId: savedWa.waMessageId, jid: toJid },
          });
          io.emit("whatsapp:message_sent", {
            jid: toJid,
            id: savedWa.id, body: textMsg, fromMe: true, timestamp: savedWa.timestamp, platform: "telegram", jid: toJid, translation: translationObj, waMessageId: savedWa.waMessageId, direction: "outbound",
          });
          io.emit("conversation:update", { accountId: tgAccount.id, conversation: { id: conv.id, jid: toJid, platform: "telegram", lastMessage: textMsg.slice(0,200), lastMessageAt: new Date() } });
        }
        return res.json({ ok: true, messageId: String(tgSentMsgId), platform: "telegram", waMessageId: savedWa.waMessageId, savedId: savedWa.id, translation: translationObj || null });
      } catch (err) {
        console.error("[TG send] error:", err);
        return res.status(500).json({ error: "Telegram send failed: " + err.message });
      }
    }


    // 读取翻译设置（优先按客户独立设置，无则回退全局）
    const tSettings = await getTranslationSettings(toJid, req.userId);
    let sendText = originalText;
    let translation = null;
    let sourceLang = null;

    // 检测是否包含中文
    const hasChinese = /[\u4e00-\u9fff]/.test(originalText);

    // 禁发中文检查
    if (tSettings.blockChinese && !tSettings.sendEnabled && hasChinese) {
      return res.status(400).json({ error: "请先开启发送翻译或输入英文消息", code: "BLOCK_CHINESE" });
    }

    // 出站翻译：sendEnabled 开启时，无论原文什么语言都要处理
    // - 正文翻译成 tgtLang 发出
    // - 虚线译文永远是中文（original 字段存中文）
    const tgtLang = tSettings.sendTargetLang || "en";
    if (tSettings.sendEnabled && tgtLang && tgtLang !== "auto") {
      try {
        const engine = tSettings.sendEngine || "deepl";
        // 检测源语言
        let srcLang = "auto";
        try {
          const det = await _detectLangForSend(originalText, engine);
          if (det && det !== "unknown") srcLang = det;
        } catch (_) { srcLang = "auto"; }

        // 严格判定是否已在目标语
        function _isInLang(text, lang) {
          if (!text) return false;
          const s = text.slice(0, 500);
          const hasJa = /[\u3040-\u309f\u30a0-\u30ff]/.test(s);
          const hasKo = /[\uac00-\ud7af]/.test(s);
          const hasZh = /[\u4e00-\u9fff]/.test(s);
          const hasAr = /[\u0600-\u06ff]/.test(s);
          const hasRu = /[\u0400-\u04ff]/.test(s);
          if (lang === "ja") return hasJa;
          if (lang === "ko") return hasKo;
          if (lang === "zh") return hasZh && !hasJa && !hasKo;
          if (lang === "ar") return hasAr;
          if (lang === "ru") return hasRu;
          if (["en","es","fr","de","pt","it","nl","tr","id","vi"].includes(lang)) {
            if (hasZh || hasAr || hasRu || hasJa || hasKo) return false;
            const latin = (s.match(/[A-Za-zÀ-ÿ]/g) || []).length;
            const total = s.replace(/\s+/g, "").length;
            return total > 0 && latin / total > 0.5;
          }
          return false;
        }

        const alreadyInTarget = _isInLang(originalText, tgtLang);
        if (!alreadyInTarget && srcLang !== tgtLang) {
          // 需要翻译：原文 -> tgtLang（发出）；原文 -> zh（虚线）
          const r = await _translateTextForSend(originalText, srcLang, tgtLang, engine, req.userId || 1);
          const translated = (r && (r.translated || r.text)) || "";
          if (translated && translated !== originalText) {
            sendText = translated;
            // 虚线永远是中文
            if (srcLang === "zh" || (srcLang === "auto" && hasChinese)) {
              translation = { original: originalText, translated: sendText, sourceLang: "zh", targetLang: tgtLang };
            } else {
              // 原文不是中文，回译中文作为虚线
              try {
                const zhR = await _translateTextForSend(originalText, srcLang, "zh", engine, req.userId || 1);
                const zhText = (zhR && (zhR.translated || zhR.text)) || originalText;
                translation = { original: zhText, translated: sendText, sourceLang: srcLang || "auto", targetLang: tgtLang };
              } catch (_) {
                translation = { original: originalText, translated: sendText, sourceLang: srcLang || "auto", targetLang: tgtLang };
              }
            }
            sourceLang = srcLang;
          }
        } else {
          // 已经是目标语：正文不变，但目标语非中文时补中文虚线
          if (tgtLang !== "zh") {
            try {
              const zhR = await _translateTextForSend(originalText, srcLang === "auto" ? tgtLang : srcLang, "zh", engine, req.userId || 1);
              const zhText = (zhR && (zhR.translated || zhR.text)) || "";
              if (zhText && zhText !== originalText) {
                translation = { original: zhText, translated: originalText, sourceLang: srcLang === "auto" ? tgtLang : srcLang, targetLang: tgtLang };
              }
            } catch (_) {}
          }
        }
      } catch (te) {
        console.warn("[WA Send] outgoing translate failed:", te.message);
      }
    }
    // 翻译结果对象：translation对象存在就使用（同语发送补中文虚线时也有translation）
    const translationObj = translation ? translation : null;

    // ── Safety: if translation was supposed to happen but sendText still has Chinese, block send ──
    if (tSettings.sendEnabled && tgtLang && tgtLang !== "zh" && /[\u4e00-\u9fff]/.test(sendText)) {
      console.warn("[WA Send] translation failed - sendText still contains Chinese, blocking send");
      return res.status(400).json({ error: "翻译失败，无法发送中文消息。请检查翻译服务或手动输入英文。", code: "TRANSLATE_FAILED" });
    }
    // 1. 通过Evolution发消息（用译文或原文）
    const quoted = body.quoted || null;
    const result = await sendConnector.sendTextMessage(toJid, sendText, { quoted });

    // 2. 我自己的JID + resolve sessionId for outbound
    // 【P0安全修复】outSessionId 按当前账号解析，禁止硬编码到 user_2/user_1
    const outSessionId = sendAccountId ? await resolveSessionIdForAccount(sendAccountId) : DEFAULT_SESSION_ID;
    // 【P1修复】确保 session 在 WAConnection 存在（外键约束），否则落库失败
    await ensureSessionInDb(_sendUid, outSessionId, null);
    const info = await sendConnector.getInstanceInfo().catch(() => null);
    const ownerJid = info?.ownerJid || (sendConnector.instance === "jeremy-eric" ? "8618038118960@s.whatsapp.net" : "8613016242602@s.whatsapp.net");

    // 3. 落库：body 保存原文，translation 保存译文
    let saved = null;
    try {
      const waMessageId = result?.key?.id || result?.messageId || null;
      if (waMessageId) {
        const exists = await prisma.wAMessage.findFirst({ where: { sessionId: outSessionId, waMessageId } });
        if (exists) saved = exists;
      }
      if (!saved) {
        saved = await prisma.wAMessage.create({
          data: {
            sessionId: outSessionId,
            from: ownerJid,
            to: toJid,
            body: sendText,  // 气泡显示实际发出的文本（译文）
            type: "text",
            direction: "outbound",
            timestamp: new Date(),
            waMessageId: waMessageId,
            // translation对象：original=中文原文（虚线显示给用户），translated=发出的外文（气泡）
            translation: translationObj ? JSON.stringify(translationObj) : null,
            sourceLang: null,
          },
        });
      } else if (translationObj) {
        try {
          await prisma.wAMessage.update({ where: { id: saved.id }, data: { translation: JSON.stringify(translationObj), sourceLang: null } });
        } catch (_) {}
      }
    } catch (e) {
      console.warn("[WA Send] save outgoing failed:", e.message);
    }

    // ── Phase1 AI话术库采集：发送成功 + 落库成功后 fire-and-forget ──
    if (saved && result && result.success !== false) {
      try { recordSample(saved); } catch (ce) { console.warn("[WA Send] recordSample sync error:", ce.message); }
    }

    // 4. 维护客户（按jid优先，phone兜底，补全缺失jid）
    try {
      const userId = req.userId || 1;
      let cust = await prisma.customer.findFirst({ where: { userId, jid: toJid } });
      if (!cust) cust = await prisma.customer.findFirst({ where: { userId, phone: toPhone } });
      const now = new Date();
      if (!cust) {
        await prisma.customer.create({
          data: { userId, phone: toPhone, jid: toJid, name: toPhone, source: "whatsapp", status: "potential", lastContactAt: now },
        });
      } else {
        const upd = { lastContactAt: now };
        if (!cust.jid) upd.jid = toJid;
        await prisma.customer.update({ where: { id: cust.id }, data: upd });
      }
    } catch (e) {}

    // 5. Socket广播（webhook也会发MESSAGES_UPSERT，但先发一次乐观更新）
    try {
      const io = req.app.get("io");
      if (io) {
        io.emit("whatsapp:message_sent", {
          id: saved?.id || ("tmp-" + Date.now()),
          waMessageId: result?.key?.id || null,
          jid: toJid,
          from: ownerJid,
          to: toJid,
          body: sendText,
          content: sendText,
          translation: translationObj,
          sourceLang: sourceLang || null,
          direction: "outbound",
          fromMe: true,
          messageType: "text",
          timestamp: saved?.timestamp ? new Date(saved.timestamp).getTime() : Date.now(),
          contact: { name: toPhone, phone: toPhone },
          instance: sendConnector.instance,
          accountId: sendAccountId,
          sessionId: outSessionId,
        });
      }
    } catch (e) {}

    res.json({ success: result.success, key: result.key, savedId: saved?.id, messageId: result?.key?.id, translation: translationObj || null });
  } catch (err) {
    console.error("[WA Send Error]", err.message);
    res.status(500).json({ error: err.message });
  }
});




// 表情回应：POST /api/whatsapp/reaction { jid, waMessageId, fromMe, emoji }
app.post("/api/whatsapp/reaction", authMiddleware, async (req, res) => {
  try {
    const { jid, waMessageId, fromMe, emoji } = req.body || {};
    if (!jid || !waMessageId || !emoji) {
      return res.status(400).json({ error: "jid, waMessageId, emoji required" });
    }
    let toJid = jid;
    if (!toJid.includes("@")) toJid = `${toJid.replace(/\D/g, "")}@s.whatsapp.net`;
    // key: the message being reacted to. fromMe=true means the reacted message is ours.
    const msgKey = {
      remoteJid: toJid,
      fromMe: fromMe === true || fromMe === "true",
      id: waMessageId,
    };
    const result = await evoConnector.sendReaction(toJid, msgKey, emoji);

    // Save reaction to DB so followup service sees outbound and clears "待回复"
    try {
      const info = await evoConnector.getInstanceInfo().catch(() => null);
      const ownerJid = info?.ownerJid || '8613016242602@s.whatsapp.net';
      const sessionId = evoConnector.instance === 'jeremy-eric' ? 'user_2' : 'user_1';
      const waMsgId = result?.key?.id || ('reaction_' + Date.now());
      await prisma.wAMessage.create({
        data: {
          sessionId, from: ownerJid, to: toJid,
          body: emoji, type: 'reaction', direction: 'outbound',
          timestamp: new Date().toISOString(),
          waMessageId: waMsgId,
        },
      });
    } catch (dbErr) {
      console.warn('[WA Reaction] DB save error:', dbErr.message);
    }

    // Broadcast via socket so UI updates
    try {
      const io = req.app.get("io");
      if (io && result?.key) {
        io.emit("whatsapp:reaction", {
          jid: toJid,
          targetKey: msgKey,
          reactionKey: result.key,
          emoji,
          fromMe: true,
          timestamp: Date.now(),
        });
      }
    } catch (_) {}
    res.json({ success: result?.success !== false, key: result?.key || null });
  } catch (err) {
    console.error("[WA Reaction] error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// 媒体代理下载：GET /api/wa/media?url=<url> 或 ?id=<dbMessageId>
// - 出站消息：mediaUrl 是可直接访问的 URL，走直连 fetch（原有逻辑）
// - 入站加密媒体：DB 保存 mediaKey/directPath/key/timestamp，调用 Evolution API
//   /chat/getBase64FromMediaMessage/<instance> 解密为明文 Buffer 返回
app.get("/api/wa/media", async (req, res) => {
  try {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
    const EVO_API = process.env.EVOLUTION_API_URL || "http://127.0.0.1:8081";
    const EVO_KEY = process.env.EVOLUTION_API_KEY || "B7E2A9D4C6F1E8A3B5D7F9C2E4A6B8D1";
    const EVO_INST = process.env.EVOLUTION_INSTANCE || "jeremy-eric";

    let msgRecord = null;
    let mediaUrl = req.query.url;
    // 1) 优先用 ?id= 查询 DB
    if (req.query.id) {
      const id = parseInt(req.query.id, 10);
      if (Number.isFinite(id)) {
        msgRecord = await prisma.wAMessage.findUnique({ where: { id } }).catch(() => null);
      }
    }
    // 2) 否则按 mediaUrl 精确匹配（兼容前端只传 url 的请求）
    if (!msgRecord && mediaUrl && /^https?:\/\//.test(mediaUrl)) {
      msgRecord = await prisma.wAMessage.findFirst({ where: { mediaUrl } }).catch(() => null);
    }

    const wantInline = req.query.inline === "1" || req.query.inline === "true";
    const wantDl = req.query.dl === "1" || req.query.download === "1";
    const sendBuffer = (buf, ct, fileName) => {
      res.setHeader("Content-Type", ct);
      res.setHeader("Content-Length", buf.length);
      res.setHeader("Cache-Control", "public, max-age=86400");
      const isPdf = ct === "application/pdf" || /\.pdf($|\?)/i.test(fileName || "");
      const encName = fileName ? ('filename="' + encodeURIComponent(fileName) + '"; filename*=UTF-8\'\'' + encodeURIComponent(fileName)) : '';
      if (wantDl) {
        res.setHeader("Content-Disposition", encName ? ('attachment; ' + encName) : 'attachment');
      } else if (wantInline || isPdf) {
        res.setHeader("Content-Disposition", encName ? ('inline; ' + encName) : 'inline');
      } else if (fileName) {
        res.setHeader("Content-Disposition", 'attachment; ' + encName);
      }
      res.send(buf);
    };

    // Helper: 通过 Evolution findMessages 补齐历史入站消息的媒体字段（懒加载）
    async function evoFetchMediaMessage(waMessageId) {
      // Evolution findMessages where.key.id 是模糊搜索，需要本地精确匹配
      const url = EVO_API + "/chat/findMessages/" + EVO_INST;
      const pageSize = 50;
      let offset = 0;
      for (let page = 0; page < 20; page++) {
        const r = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: EVO_KEY },
          body: JSON.stringify({ where: { "key.id": waMessageId }, page: page + 1, offset, count: pageSize }),
        });
        if (!r.ok) return null;
        const j = await r.json().catch(() => null);
        const records = (j && j.messages && j.messages.records) || [];
        for (const rec of records) {
          if (rec && rec.key && rec.key.id === waMessageId && rec.message) {
            // 确认是媒体类型
            const mk = Object.keys(rec.message);
            if (mk.some(k => ["imageMessage", "videoMessage", "audioMessage", "documentMessage", "stickerMessage"].includes(k))) {
              return rec;
            }
          }
        }
        const total = (j && j.messages && j.messages.total) || 0;
        offset += records.length;
        if (records.length < pageSize || offset >= total) break;
      }
      return null;
    }

    if (msgRecord && (msgRecord.mediaKey || msgRecord.waMessageId)) {
      // ── 入站加密媒体：调用 Evolution 解密 ──
      let keyObj, innerMsg, tsSec, evoOriginalMsg = null;
      if (msgRecord.mediaKey && msgRecord.waKeyJson) {
        try { keyObj = JSON.parse(msgRecord.waKeyJson); } catch { keyObj = null; }
      } else if (msgRecord.waMessageId) {
        // 历史消息/未存key的消息：从 Evolution 拉取原始消息再解密
        evoOriginalMsg = await evoFetchMediaMessage(msgRecord.waMessageId);
        if (evoOriginalMsg) {
          keyObj = evoOriginalMsg.key || null;
          tsSec = evoOriginalMsg.messageTimestamp || Math.floor(Date.now()/1000);
        }
      }
      if (!keyObj) return res.status(404).send("media key unavailable");

      if (evoOriginalMsg && evoOriginalMsg.message) {
        // 直接用 Evolution 返回的完整 message 结构
        innerMsg = evoOriginalMsg.message;
        if (!tsSec) tsSec = evoOriginalMsg.messageTimestamp || Math.floor(Date.now()/1000);
      } else {
        const mediaFieldByType = {
          image: "imageMessage",
          video: "videoMessage",
          audio: "audioMessage",
          document: "documentMessage",
        };
        const field = mediaFieldByType[msgRecord.type] || "documentMessage";
        innerMsg = {};
        innerMsg[field] = {
          url: msgRecord.mediaUrl || undefined,
          directPath: msgRecord.mediaDirectPath || undefined,
          mediaKey: msgRecord.mediaKey,
          mimetype: msgRecord.mimeType || (msgRecord.type === "image" ? "image/jpeg" : "application/octet-stream"),
          fileName: msgRecord.fileName || undefined,
          fileLength: msgRecord.fileLength || undefined,
          fileSha256: msgRecord.mediaSha256 || undefined,
          fileEncSha256: msgRecord.mediaEncSha256 || undefined,
        };
        if (!tsSec) {
          tsSec = msgRecord.waMsgTimestamp ||
            (msgRecord.timestamp ? Math.floor(new Date(msgRecord.timestamp).getTime() / 1000) : Math.floor(Date.now() / 1000));
        }
      }
      const evoBody = {
        message: {
          key: keyObj,
          message: innerMsg,
          messageTimestamp: tsSec,
        },
        convertToMp4: false,
      };
      const url = EVO_API + "/chat/getBase64FromMediaMessage/" + EVO_INST;
      const evoResp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: EVO_KEY },
        body: JSON.stringify(evoBody),
      });
      if (!evoResp.ok) {
        const errText = await evoResp.text().catch(() => "");
        console.error("[WA Media Proxy] Evolution decrypt failed:", evoResp.status, errText.slice(0, 300));
        return res.status(502).send("media decrypt failed");
      }
      const evoJson = await evoResp.json();
      if (!evoJson || !evoJson.base64) {
        return res.status(502).send("no base64 from evolution");
      }
      const buf = Buffer.from(evoJson.base64, "base64");
      const ct = evoJson.mimetype || msgRecord.mimeType || "application/octet-stream";
      const fileName = msgRecord.fileName || evoJson.fileName || ("media." + (msgRecord.type || "bin"));
      console.log("[WA Media Proxy] decrypted via Evolution id=" + msgRecord.id + " type=" + msgRecord.type + " size=" + buf.length + " ct=" + ct);
      return sendBuffer(buf, ct, fileName);
    }

    // ── Fallback A：本地文件（出站媒体存到 uploads/outbound/） ──
    if (mediaUrl && mediaUrl.startsWith("/uploads/")) {
      try {
        const fsMod = await import("fs");
        const pathMod = await import("path");
        const localPath = pathMod.join(__dirname, mediaUrl);
        // safety: prevent path traversal
        const normBase = pathMod.resolve(pathMod.join(__dirname, "uploads"));
        const normTarget = pathMod.resolve(localPath);
        if (!normTarget.startsWith(normBase)) return res.status(403).send("forbidden");
        if (!fsMod.existsSync(localPath)) return res.status(404).send("local media not found");
        const buf = fsMod.readFileSync(localPath);
        // determine mime from ext
        const ext = pathMod.extname(localPath).toLowerCase();
        const extMime = { ".jpg":"image/jpeg",".jpeg":"image/jpeg",".png":"image/png",".gif":"image/gif",".webp":"image/webp",".mp4":"video/mp4",".pdf":"application/pdf",".webm":"video/webm",".mp3":"audio/mpeg",".ogg":"audio/ogg" };
        const ct = extMime[ext] || (msgRecord && msgRecord.mimeType) || "application/octet-stream";
        return sendBuffer(buf, ct, msgRecord ? msgRecord.fileName : null);
      } catch (le) {
        console.error("[WA Media Proxy] local file read error:", le.message);
        return res.status(500).send("local media read error");
      }
    }

    // ── Fallback B：直接 fetch（出站消息 / 历史明文 URL） ──
    if (!mediaUrl || !/^https?:\/\//.test(mediaUrl)) return res.status(400).send("invalid url");
    const r = await fetch(mediaUrl, { headers: { "User-Agent": "WhatsApp/2.24", Accept: "*/*" } });
    if (!r.ok) return res.status(r.status).send("fetch failed");
    const ct = r.headers.get("content-type") || "application/octet-stream";
    const buf = Buffer.from(await r.arrayBuffer());
    sendBuffer(buf, ct, msgRecord ? msgRecord.fileName : null);
  } catch (e) {
    console.error("[WA Media Proxy] error:", e.message);
    res.status(500).send("proxy error");
  }
});


// 发送媒体：POST /api/whatsapp/send-media (multipart/form-data: jid, file, mediatype, caption?)
app.post("/api/whatsapp/send-media", authMiddleware, async (req, res) => {
  try {
    const { fields, file } = await parseMultipartMedia(req);
    const jid = fields.jid || fields.to;
    const mediatype = fields.mediatype || (file && file.mimeType && file.mimeType.startsWith('video/') ? 'video' : (file && file.mimeType && file.mimeType.startsWith('image/') ? 'image' : 'document'));
    const caption = fields.caption || '';
    const reqAccountId = fields.accountId ? parseInt(fields.accountId) : null;
    if (!jid) return res.status(400).json({ error: 'jid is required' });
    if (!file || !file.buffer || file.buffer.length === 0) return res.status(400).json({ error: 'file is required' });
    // WhatsApp官方大小限制：图片/视频/音频≤16MB，文档≤100MB
    let sizeLimit = 100 * 1024 * 1024;
    let typeLabel = '文件';
    const mt = (file.mimeType || '').toLowerCase();
    if (mt.startsWith('image/')) { sizeLimit = 16 * 1024 * 1024; typeLabel = '图片'; }
    else if (mt.startsWith('video/')) { sizeLimit = 16 * 1024 * 1024; typeLabel = '视频'; }
    else if (mt.startsWith('audio/')) { sizeLimit = 16 * 1024 * 1024; typeLabel = '音频'; }
    if (file.buffer.length > sizeLimit) {
      return res.status(413).json({ error: typeLabel + '超过 ' + Math.round(sizeLimit/1024/1024) + 'MB，WhatsApp无法发送，请压缩后重试' });
    }

    let toJid = jid;
    if (!toJid.includes('@')) toJid = toJid.replace(/\D/g, '') + '@s.whatsapp.net';
    const toPhone = toJid.split('@')[0];

    // ── Telegram media sending branch ──
    if (toJid.endsWith('@telegram')) {
      const tgChatId = toJid.split('@')[0];
      let tgAccount = await prisma.whatsAppAccount.findFirst({
        where: { platform: 'telegram', status: 'connected' },
        orderBy: { createdAt: 'desc' },
      });
      if (!tgAccount) return res.status(400).json({ error: '未连接Telegram账号' });

      const isUserBot = !tgAccount.telegramBotToken;
      let tgSizeLimit = isUserBot ? 20 * 1024 * 1024 : 50 * 1024 * 1024;
      if (mt.startsWith('image/') && !isUserBot) tgSizeLimit = 10 * 1024 * 1024;
      if (file.buffer.length > tgSizeLimit) {
        return res.status(413).json({ error: typeLabel + '超过' + Math.round(tgSizeLimit/1024/1024) + 'MB，Telegram无法发送' });
      }

      let sent;
      try {
        if (isUserBot) {
          const ubConnector = await import('./services/tg-userbot-connector.js');
          sent = await ubConnector.sendFile(tgChatId, file.buffer, file.fileName || 'file', { caption: caption || undefined, mimeType: file.mimeType || undefined });
        } else {
          const connector = getTelegramConnector(decToken(tgAccount.telegramBotToken));
          const fileObj = { buffer: file.buffer, filename: file.fileName || 'file', contentType: file.mimeType || 'application/octet-stream' };
          if (mt.startsWith('image/')) {
            sent = await connector.sendPhoto(tgChatId, fileObj, { caption: caption || undefined });
          } else if (mt.startsWith('video/')) {
            sent = await connector.sendVideo(tgChatId, fileObj, { caption: caption || undefined });
          } else {
            sent = await connector.sendDocument(tgChatId, fileObj, { caption: caption || undefined });
          }
        }
      } catch (sendErr) {
        console.error('[TG SendMedia] send failed:', sendErr.message);
        return res.status(500).json({ error: 'Telegram媒体发送失败: ' + sendErr.message });
      }

      const tgSessionId = 'tg_' + (tgAccount.telegramBotUsername || tgAccount.id);
      // 确保 WAConnection 存在（TG 媒体发送落库外键）
      try {
        await prisma.wAConnection.upsert({
          where: { sessionId: tgSessionId },
          update: { status: 'connected', lastConnectedAt: new Date() },
          create: { userId: tgAccount.userId, sessionId: tgSessionId, status: 'connected', lastConnectedAt: new Date() },
        });
      } catch (wacErr3) { console.warn('[TG-Send] WAConnection upsert error:', wacErr3.message); }
      const tgMsgId = sent?.message_id || sent?.result?.message_id || ('tg_media_' + Date.now());
      const tgWaMsgId = 'tg_' + tgAccount.id + '_' + tgMsgId + '_out';
      let saved = await prisma.wAMessage.findFirst({ where: { sessionId: tgSessionId, waMessageId: tgWaMsgId } });
      if (!saved) {
        let outboundMediaUrl = null;
        try {
          const crypto = await import('crypto');
          const fsMod = await import('fs');
          const pathMod = await import('path');
          const extMatch = (file.fileName || '').match(/\.([a-zA-Z0-9]{1,5})$/);
          const ext = extMatch ? extMatch[1].toLowerCase() : (mt.startsWith('image/') ? 'jpg' : mt.startsWith('video/') ? 'mp4' : 'bin');
          const hashName = crypto.randomBytes(16).toString('hex') + '.' + ext;
          const outDir = pathMod.join(__dirname, 'uploads/outbound');
          if (!fsMod.existsSync(outDir)) fsMod.mkdirSync(outDir, { recursive: true });
          let saveBuffer = file.buffer;
          // Compress image before saving (sharp)
          if (mt.startsWith('image/')) {
            try {
              const sharp = (await import('sharp')).default;
              saveBuffer = await sharp(file.buffer).resize(1280, 1280, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 75, progressive: true }).toBuffer();
              console.log('[TG ImageCompress] original:' + file.buffer.length + 'B -> compressed:' + saveBuffer.length + 'B');
            } catch (compErr) { console.warn('[TG ImageCompress] failed, using original:', compErr.message); }
          }
          fsMod.writeFileSync(pathMod.join(outDir, hashName), saveBuffer);
          outboundMediaUrl = '/uploads/outbound/' + hashName;
        } catch (fsErr) { console.warn('[TG SendMedia] persist failed:', fsErr.message); }

        saved = await prisma.wAMessage.create({
          data: {
            sessionId: tgSessionId, from: 'me', to: toJid,
            body: caption || file.fileName || (mediatype === 'image' ? '[图片]' : mediatype === 'video' ? '[视频]' : '[文件]'),
            type: mediatype, direction: 'outbound', timestamp: new Date(),
            waMessageId: tgWaMsgId, mediaUrl: outboundMediaUrl,
            fileName: file.fileName || null, mimeType: file.mimeType || null,
            fileLength: file.buffer.length,
          },
        });
      }

      try {
        let contact = await prisma.contact.findUnique({ where: { accountId_platform_jid: { accountId: tgAccount.id, platform: 'telegram', jid: toJid } } });
        if (!contact) contact = await prisma.contact.create({ data: { accountId: tgAccount.id, platform: 'telegram', jid: toJid, name: tgChatId } });
        let conv = await prisma.conversation.findUnique({ where: { accountId_platform_jid: { accountId: tgAccount.id, platform: 'telegram', jid: toJid } } });
        if (conv) await prisma.conversation.update({ where: { id: conv.id }, data: { lastMessage: (caption || file.fileName || '[媒体]').slice(0, 200), lastMessageAt: new Date(), unreadCount: 0 } });
      } catch (_) {}

      try {
        const io = req.app.get('io');
        if (io) {
          io.emit('whatsapp:message_sent', {
            id: saved.id, body: caption || file.fileName || '', fromMe: true,
            text: ['image','video','document'].includes(mediatype) ? '[media]' : (caption || ''),
            timestamp: saved.timestamp, platform: 'telegram', jid: toJid,
            direction: 'outbound', messageType: mediatype, type: mediatype,
            fileName: file.fileName || null, mimeType: file.mimeType || null,
            mediaUrl: saved.mediaUrl,
            previewDataUrl: mediatype === 'image' ? ('data:' + (file.mimeType || 'image/png') + ';base64,' + file.buffer.toString('base64')) : null,
          });
        }
      } catch (_) {}

      return res.json({ success: true, savedId: saved.id, messageId: tgMsgId, platform: 'telegram' });
    }

    // Multi-WA: resolve correct connector based on accountId or conversation
    // 【P0安全修复】禁止默认全局实例，必须按当前用户(userId)隔离
    let mediaConnector = null;
    let mediaAccountId = reqAccountId || null;
    const _mUid2 = req.userId || 1;
    if (mediaAccountId) {
      const waAcc = await prisma.whatsAppAccount.findFirst({ where: { id: mediaAccountId, platform: 'whatsapp', userId: _mUid2, instanceName: { not: null } } });
      if (waAcc?.instanceName) {
        mediaConnector = getEvolutionConnector(waAcc.instanceName);
        mediaAccountId = waAcc.id;
      } else {
        return res.status(403).json({ error: '账号不存在或无权使用该账号发送消息' });
      }
    } else {
      const existingConv = await prisma.conversation.findFirst({ where: { jid: toJid, platform: 'whatsapp' }, select: { accountId: true } });
      if (existingConv) {
        const waAcc = await prisma.whatsAppAccount.findFirst({ where: { id: existingConv.accountId, platform: 'whatsapp', userId: _mUid2, instanceName: { not: null } } });
        if (waAcc?.instanceName) {
          mediaAccountId = waAcc.id;
          mediaConnector = getEvolutionConnector(waAcc.instanceName);
        }
      }
      if (!mediaConnector) {
        let myAcc = await prisma.whatsAppAccount.findFirst({ where: { userId: _mUid2, platform: 'whatsapp', instanceName: { not: null }, status: 'connected' }, select: { id: true, instanceName: true } });
        if (!myAcc) myAcc = await prisma.whatsAppAccount.findFirst({ where: { userId: _mUid2, platform: 'whatsapp', instanceName: { not: null } }, orderBy: { updatedAt: 'desc' }, select: { id: true, instanceName: true } });
        if (myAcc?.instanceName) {
          mediaAccountId = myAcc.id;
          mediaConnector = getEvolutionConnector(myAcc.instanceName);
        }
      }
      if (!mediaConnector) return res.status(400).json({ error: '请先连接WhatsApp账号再发送消息' });
    }

    const result = await mediaConnector.sendMediaMessage(toJid, {
      mediaBuffer: file.buffer,
      fileName: file.fileName || 'file',
      mimeType: file.mimeType || 'application/octet-stream',
      mediatype,
      caption,
    });

    if (!result.success) {
      return res.status(500).json({ error: result.error || 'send failed', data: result.data });
    }

    // 【P0安全修复】outMediaSessionId 按当前账号解析，禁止硬编码
    const outMediaSessionId = mediaAccountId ? await resolveSessionIdForAccount(mediaAccountId) : DEFAULT_SESSION_ID;
    // 【P1修复】确保 session 在 WAConnection 存在（外键约束）
    await ensureSessionInDb(req.userId || 1, outMediaSessionId, null);
    const info = await mediaConnector.getInstanceInfo().catch(() => null);
    const ownerJid = info?.ownerJid || (mediaConnector.instance === 'jeremy-eric' ? '8618038118960@s.whatsapp.net' : '8613016242602@s.whatsapp.net');

    let saved = null;
    let outboundMediaUrl = null;
    try {
      const waMessageId = result?.key?.id || result?.messageId || null;
      const dup = waMessageId ? await prisma.wAMessage.findFirst({ where: { sessionId: outMediaSessionId, waMessageId } }) : null;
      if (dup) {
        saved = dup;
        // If dup exists from a prior send (e.g., retry), still populate outboundMediaUrl if it was persisted
        if (dup.mediaUrl && dup.mediaUrl.startsWith("/uploads/outbound/")) {
          outboundMediaUrl = dup.mediaUrl;
        }
      } else {
        // Persist outbound media buffer to local uploads for refresh/reload
        outboundMediaUrl = null;
        try {
          const crypto = await import("crypto");
          const fsMod = await import("fs");
          const pathMod = await import("path");
          const extMatch = (file.fileName || "").match(/\.([a-zA-Z0-9]{1,5})$/);
          const ext = extMatch ? extMatch[1].toLowerCase() : (mt.startsWith("image/") ? "jpg" : mt.startsWith("video/") ? "mp4" : "bin");
          const hashName = crypto.randomBytes(16).toString("hex") + "." + ext;
          const outDir = pathMod.join(__dirname, "uploads/outbound");
          if (!fsMod.existsSync(outDir)) fsMod.mkdirSync(outDir, { recursive: true });
          const outPath = pathMod.join(outDir, hashName);
          let waSaveBuffer = file.buffer;
          if (mt.startsWith('image/')) {
            try {
              const sharp = (await import('sharp')).default;
              waSaveBuffer = await sharp(file.buffer).resize(1280, 1280, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 75, progressive: true }).toBuffer();
              console.log('[WA ImageCompress] original:' + file.buffer.length + 'B -> compressed:' + waSaveBuffer.length + 'B');
            } catch (compErr) { console.warn('[WA ImageCompress] failed:', compErr.message); }
          }
          fsMod.writeFileSync(outPath, waSaveBuffer);
          outboundMediaUrl = "/uploads/outbound/" + hashName;
        } catch (fsErr) {
          console.warn("[WA SendMedia] failed to persist outbound media:", fsErr.message);
          outboundMediaUrl = null;
        }
        saved = await prisma.wAMessage.create({
          data: {
            sessionId: outMediaSessionId,
            from: ownerJid,
            to: toJid,
            body: caption || file.fileName || (mediatype === 'image' ? '[图片]' : mediatype === 'video' ? '[视频]' : '[文件]'),
            type: mediatype,
            direction: 'outbound',
            timestamp: new Date(),
            waMessageId,
            mediaUrl: outboundMediaUrl,
            fileName: file.fileName || null,
            mimeType: file.mimeType || null,
            fileLength: file.buffer.length,
          },
        });
      }
    } catch (e) {
      console.warn('[WA SendMedia] save outgoing failed:', e.message);
    }

    // ── Phase1 AI话术库采集：媒体发送成功且有caption时采集 ──
    if (saved && caption && caption.trim()) {
      try { recordSample(saved); } catch (ce) { console.warn('[WA SendMedia] recordSample sync error:', ce.message); }
    }

    // maintain customer（按jid优先，phone兜底，补全缺失jid）
    try {
      const userId = req.userId || 1;
      let cust = await prisma.customer.findFirst({ where: { userId, jid: toJid } });
      if (!cust) cust = await prisma.customer.findFirst({ where: { userId, phone: toPhone } });
      const now = new Date();
      if (!cust) {
        await prisma.customer.create({ data: { userId, phone: toPhone, jid: toJid, name: toPhone, source: 'whatsapp', status: 'potential', lastContactAt: now } });
      } else {
        const upd = { lastContactAt: now };
        if (!cust.jid) upd.jid = toJid;
        await prisma.customer.update({ where: { id: cust.id }, data: upd });
      }
    } catch (e) {}

    const outPayload = {
      id: saved?.id || ('tmp-' + Date.now()),
      waMessageId: result?.key?.id || null,
      jid: toJid,
      from: ownerJid,
      to: toJid,
      body: caption || file.fileName || (mediatype === 'image' ? '[图片]' : mediatype === 'video' ? '[视频]' : '[文件]'),
      content: caption || file.fileName || '',
      direction: 'outbound',
      fromMe: true,
      messageType: mediatype,
      type: mediatype,
      fileName: file.fileName || null,
      mimeType: file.mimeType || null,
      fileSize: file.buffer.length,
      timestamp: saved?.timestamp ? new Date(saved.timestamp).getTime() : Date.now(),
      contact: { name: toPhone, phone: toPhone },
      instance: mediaConnector.instance,
      accountId: mediaAccountId,
      sessionId: outMediaSessionId,
      // Include a base64 data URL preview for immediate optimistic rendering
      mediaUrl: outboundMediaUrl,
      // Include a base64 data URL preview for immediate optimistic rendering
      previewDataUrl: mediatype === 'image' ? ('data:' + (file.mimeType || 'image/png') + ';base64,' + file.buffer.toString('base64')) : null,
    };

    try {
      const io = req.app.get('io');
      if (io) io.emit('whatsapp:message_sent', outPayload);
    } catch (e) {}

    res.json({ success: true, key: result.key, savedId: saved?.id, messageId: result?.key?.id, outPayload });
  } catch (err) {
    console.error('[WA SendMedia Error]', err.message, err.stack);
    res.status(500).json({ error: err.message });
  }
});

// alias
app.post("/api/wa/send-media", (req, res) => { req.url = "/api/whatsapp/send-media"; app(req, res); });

// ── AI Document PDF generation & sending ──────────────────────────────
app.post("/api/ai/doc-pdf", authMiddleware, async (req, res) => {
  try {
    const { docType, content, lang } = req.body || {};
    if (!content) return res.status(400).json({ error: "content is required" });
    const { generateDocPdfBuffer, generateDocFileName } = await import("./services/ai.service.js");
    const pdfBuf = await generateDocPdfBuffer({ docType: docType || "quotation", content, lang });
    const fileName = generateDocFileName(docType);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(fileName)}"`);
    res.setHeader("Content-Length", pdfBuf.length);
    res.send(pdfBuf);
  } catch (err) {
    console.error("[doc-pdf] error:", err.message, err.stack);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/ai/send-doc-pdf", authMiddleware, async (req, res) => {
  try {
    const { jid, docType, content, lang, caption } = req.body || {};
    if (!jid) return res.status(400).json({ error: "jid is required" });
    if (!content) return res.status(400).json({ error: "content is required" });

    const { generateDocPdfBuffer, generateDocFileName } = await import("./services/ai.service.js");
    const pdfBuf = await generateDocPdfBuffer({ docType: docType || "quotation", content, lang });
    const fileName = generateDocFileName(docType);

    let toJid = jid;
    if (!toJid.includes("@")) toJid = toJid.replace(/\D/g, "") + "@s.whatsapp.net";
    if (pdfBuf.length > 100 * 1024 * 1024) {
      return res.status(413).json({ error: "PDF超过100MB，无法发送" });
    }

    const result = await evoConnector.sendMediaMessage(toJid, {
      mediaBuffer: pdfBuf,
      fileName,
      mimeType: "application/pdf",
      mediatype: "document",
      caption: caption || "",
    });
    if (!result.success) {
      return res.status(500).json({ error: result.error || "send failed", data: result.data });
    }
    // Persist outbound doc message to history
    try {
      const info = await evoConnector.getInstanceInfo().catch(() => null);
      const ownerJid = info?.ownerJid || "8613016242602@s.whatsapp.net";
      const waMessageId = result?.key?.id || result?.messageId || null;
      const docLabelMap = { quotation:"报价单", pi:"形式发票", ci:"商业发票", packing:"装箱单", contract:"销售合同", customs:"报关单" };
      const bodyLabel = (docLabelMap[docType] || "单证") + "(PDF)";
      const docSessionId = evoConnector.instance === 'jeremy-eric' ? 'user_2' : 'user_1';
      const saved = await prisma.wAMessage.create({
        data: {
          sessionId: docSessionId,
          from: ownerJid,
          to: toJid,
          body: bodyLabel,
          type: "document",
          direction: "outbound",
          timestamp: new Date(),
          waMessageId: waMessageId || ("pdf_" + Date.now()),
          fileName, mimeType: "application/pdf", fileLength: pdfBuf.length,
        },
      }).catch(e => { console.warn("[doc-pdf] persist fail:", e.message); return null; });
      try {
        const io = req.app.get("io");
        if (io) io.emit("whatsapp:message_sent", {
          key: result.key, savedId: saved?.id, messageId: waMessageId,
          outPayload: {
            from: ownerJid, to: toJid, body: bodyLabel, type: "document", direction: "outbound",
            timestamp: Date.now(), instance: evoConnector.instance, sessionId: docSessionId,
            previewDataUrl: null,
          }
        });
      } catch (e) {}
    } catch (e) { console.warn("[doc-pdf] history persist error:", e.message); }

    res.json({ success: true, waMessageId: result?.key?.id || null, fileName, size: pdfBuf.length });
  } catch (err) {
    console.error("[send-doc-pdf] error:", err.message, err.stack);
    res.status(500).json({ error: err.message });
  }
});

// ── 重新翻译消息 POST /api/whatsapp/retranslate ──

// ── 批量重新翻译缺少翻译的消息 POST /api/whatsapp/retranslate-batch ──
app.post('/api/whatsapp/retranslate-batch', authMiddleware, async (req, res) => {
  try {
    const { jid, messageIds = [] } = req.body || {};
    if (!jid) return res.status(400).json({ error: 'jid is required' });
    
    const sessionId = `user_${req.userId}`;
    let targetJid = jid;
    if (!targetJid.includes('@')) {
      targetJid = targetJid.endsWith('@telegram') ? targetJid : `${targetJid.replace(/\D/g, '')}@s.whatsapp.net`;
    }
    
    // Find messages without translations
    const whereClause = {
      OR: [
        { from: targetJid, sessionId: { startsWith: 'user_' } },
        { to: targetJid, sessionId: { startsWith: 'user_' } }
      ],
      type: 'text',
      translation: null
    };
    
    if (messageIds.length > 0) {
      whereClause.id = { in: messageIds.map(Number) };
    }
    
    const msgs = await prisma.wAMessage.findMany({
      where: whereClause,
      orderBy: { id: 'desc' },
      take: 20  // Limit to avoid overload
    });
    
    if (msgs.length === 0) {
      return res.json({ success: true, translated: 0, message: 'No messages need translation' });
    }
    
    const { translateText, detectLanguage } = await import('./services/ai.service.js');
    const ts = await getTranslationSettings(targetJid, req.userId);
    const engine = ts.receiveEngine || 'deepl';
    const targetLang = ts.receiveTargetLang || 'zh';
    const io = app.get('io');
    
    let translated = 0;
    for (const msg of msgs) {
      try {
        const body = (msg.body || '').trim();
        if (!body || (body.startsWith('[') && body.endsWith(']'))) continue;
        
        let sourceLang = ts.receiveSourceLang || 'auto';
        if (sourceLang === 'auto') {
          sourceLang = await detectLanguage(body, engine);
        }
        if (!sourceLang || sourceLang === 'unknown' || sourceLang === 'zh' || sourceLang.startsWith('zh-')) continue;
        
        const result = await translateText(body, sourceLang, targetLang, engine, req.userId);
        const translatedText = (result && (result.translated || result.text)) || '';
        if (!translatedText) continue;
        
        const translationObj = { original: body, translated: translatedText, sourceLang, targetLang };
        const transJson = JSON.stringify(translationObj);
        
        await prisma.wAMessage.update({
          where: { id: msg.id },
          data: { translation: transJson, sourceLang }
        });
        
        // Emit socket event
        if (io) {
          const payload = {
            id: msg.id,
            waMessageId: msg.waMessageId,
            jid: msg.direction === 'outbound' ? msg.to : msg.from,
            translation: translationObj,
            sourceLang,
            platform: msg.sessionId?.includes('tg') || targetJid.endsWith('@telegram') ? 'telegram' : 'whatsapp'
          };
          io.to(sessionId).emit('whatsapp:translation', payload);
          io.to(sessionId).emit('telegram:translation', payload);
        }
        
        translated++;
        // Small delay to avoid rate limiting
        await new Promise(r => setTimeout(r, 200));
      } catch (e) {
        console.warn(`[BatchRetranslate] Failed for msg #${msg.id}:`, e.message);
      }
    }
    
    console.log(`[BatchRetranslate] Processed ${msgs.length} messages, translated ${translated} for ${targetJid}`);
    return res.json({ success: true, translated, total: msgs.length });
  } catch (err) {
    console.error('[BatchRetranslate Error]', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/whatsapp/retranslate', authMiddleware, async (req, res) => {
  try {
    const { messageId } = req.body || {};
    if (messageId == null) return res.status(400).json({ error: 'messageId is required' });
    const sessionId = `user_${req.userId}`;
    const msg = await prisma.wAMessage.findFirst({
      where: { id: Number(messageId) },
    });
    if (!msg) return res.status(404).json({ error: 'message not found' });
    if (msg.type !== 'text') return res.status(400).json({ error: 'only text messages can be re-translated' });

    const body = (msg.body || '').trim();
    if (!body || (body.startsWith('[') && body.endsWith(']'))) {
      return res.status(400).json({ error: 'message body not translatable' });
    }

    // Use per-customer settings: determine conversation jid from msg direction
    const convJidForTrans = msg.direction === 'outbound' ? msg.to : msg.from;
    const ts = await getTranslationSettings(convJidForTrans, req.userId);

    let targetLang, sourceLang, engine;
    if (msg.direction === 'inbound') {
      engine = ts.receiveEngine || "deepl";;
      sourceLang = ts.receiveSourceLang || 'auto';
      targetLang = ts.receiveTargetLang || 'zh';
    } else {
      engine = ts.sendEngine || ts.receiveEngine || 'deepl';
      sourceLang = ts.sendSourceLang || 'auto';
      targetLang = 'zh';
      // outbound with existing Chinese original in translation.original: emit cached
      if (msg.translation) {
        try {
          const prev = JSON.parse(msg.translation);
          if (prev && prev.original && /[\u4e00-\u9fff]/.test(prev.original) && prev.translated) {
            const io = app.get('io');
            const convJid = msg.to;
            if (io) {
              const payload = { id: msg.id, waMessageId: msg.waMessageId, jid: convJid,
                translation: prev, sourceLang: prev.sourceLang || sourceLang };
              io.to(sessionId).emit('whatsapp:translation', payload);
              io.to(sessionId).emit('whatsapp:message_translated', payload);
            }
            return res.json({ success: true, translation: prev, cached: true });
          }
        } catch (_) { /* ignore */ }
      }
    }

    if (sourceLang === 'auto') {
      try { sourceLang = await _detectLangForSend(body, engine); } catch (_) { sourceLang = 'auto'; }
    }

    let translationObj;
    const alreadyChinese = /[\u4e00-\u9fff]/.test(body);
    if (!sourceLang || sourceLang === 'unknown') {
      return res.status(500).json({ error: 'failed to detect language' });
    }
    if (sourceLang === targetLang || (targetLang === 'zh' && alreadyChinese)) {
      translationObj = { original: body, translated: body, sourceLang, targetLang };
    } else {
      const result = await _translateTextForSend(body, sourceLang, targetLang, engine, req.userId);
      const translated = (result && (result.translated || result.text)) || '';
      if (!translated) return res.status(500).json({ error: 'translation returned empty' });
      translationObj = { original: body, translated, sourceLang, targetLang };
    }

    const transJson = JSON.stringify(translationObj);
    await prisma.wAMessage.update({
      where: { id: msg.id },
      data: { translation: transJson, sourceLang },
    });

    const convJid = msg.direction === 'inbound' ? msg.from : msg.to;
    const io = app.get('io');
    if (io) {
      const payload = { id: msg.id, waMessageId: msg.waMessageId, jid: convJid,
        translation: translationObj, sourceLang };
      io.to(sessionId).emit('whatsapp:translation', payload);
      io.to(sessionId).emit('whatsapp:message_translated', payload);
    }
    console.log(`[Retranslate] #${msg.id} ${msg.direction} ${sourceLang}->${targetLang}`);
    return res.json({ success: true, translation: translationObj || null });
  } catch (err) {
    console.error('[WA Retranslate Error]', err);
    res.status(500).json({ error: err.message });
  }
});
// 兼容别名：POST /api/whatsapp/send-evo
app.post("/api/whatsapp/send-evo", authMiddleware, async (req, res) => {
  req.url = "/api/whatsapp/send";
  app(req, res);
});


// ── jid-agnostic contact lookup helper ──
function _ctLookup(ctMap, jid) {
  let ct = ctMap.get(jid);
  // @lid 空记录（无名字无头像）时也继续尝试 @s.whatsapp.net 替代格式
  if ((!ct || (!ct.name && !ct.pushName && !ct.avatarUrl)) && jid) {
    if (jid.endsWith('@lid')) ct = ctMap.get(jid.replace(/@lid$/, '@s.whatsapp.net'));
    else if (jid.endsWith('@s.whatsapp.net')) ct = ctMap.get(jid.replace(/@s\.whatsapp\.net$/, '@lid'));
    if (!ct) {
      const _p = jid.split('@')[0];
      for (const [k, v] of ctMap) { if (k.startsWith(_p)) { ct = v; break; } }
    }
  }
  return ct;
}

// 聊天列表：GET /api/whatsapp/conversations
// 策略：Evolution fetchChats + 本地DB合并，支持 filter=pinned/starred/unread、置顶排序、blocked过滤
app.get("/api/whatsapp/conversations", authMiddleware, async (req, res) => {
  try {
    const search = (req.query.search || "").toString().trim();
    const filter = (req.query.filter || "all").toString();
    const showBlocked = req.query.showBlocked === "1";
    const platform = (req.query.platform || "").toString(); // "" = all platforms
    // ── Multi-WA: resolve accountId from query ──
    const accountIdParam = req.query.accountId;  // number string or 'all'
    const showAllAccounts = !accountIdParam || accountIdParam === 'all';

    // ── Telegram 渠道分支 ──
    if (platform === "telegram") {
      const tgAccounts = await prisma.whatsAppAccount.findMany({
        where: { platform: "telegram", status: "connected" },
      });
      if (!tgAccounts.length) return res.json([]);
      const tgAccountIds = tgAccounts.map(a => a.id);
      // 直接从 Conversation 表获取所有 TG 会话
      const convRecs = await prisma.conversation.findMany({
        where: { accountId: { in: tgAccountIds }, platform: "telegram" },
        orderBy: { lastMessageAt: "desc" },
      });
      // 批量获取联系人信息
      const jids = convRecs.map(c => c.jid);
      const ctRecs = jids.length ? await prisma.contact.findMany({
        where: { accountId: { in: tgAccountIds }, platform: "telegram", jid: { in: jids } },
      }) : [];
      const ctMap = new Map(ctRecs.map(c => [c.jid, c]));
      // 获取 UserBot 自身 ID 用于过滤自聊天
      let selfJid = null;
      try {
        const ubModule = await import('./services/tg-userbot-connector.js');
        const selfInfo = ubModule.getMe();
        if (selfInfo && selfInfo.id) {
          selfJid = selfInfo.id.toString() + '@telegram';
        }
      } catch {}
      const out = [];
      for (const cv of convRecs) {
        if (cv.blocked && !showBlocked) continue;
        if (selfJid && cv.jid === selfJid) continue; // 跳过自聊天
        const chatId = cv.jid.replace("@telegram", "");
        const ct = _ctLookup(ctMap, cv.jid);
        // 尝试从 Message 表获取最新消息（比 Conversation.lastMessage 更准确）
        let lastMsg = cv.lastMessage || "";
        let lastMsgTime = cv.lastMessageAt;
        let direction = "inbound";
        try {
          const latestMsg = await prisma.message.findFirst({
            where: { accountId: cv.accountId, platform: "telegram", jid: cv.jid },
            orderBy: { id: "desc" },
          });
          if (latestMsg && (!lastMsgTime || new Date(latestMsg.timestamp) > new Date(lastMsgTime))) {
            lastMsg = latestMsg.content || "";
            lastMsgTime = latestMsg.timestamp;
            direction = latestMsg.fromMe ? "outbound" : "inbound";
          }
        } catch {}
        out.push({
          jid: cv.jid, platform: "telegram", phone: chatId,
          name: ct?.displayName || ct?.name || chatId,
          avatar: ct?.avatarUrl || null,
          avatarUrl: ct?.avatarUrl || null,
          lastMessage: lastMsg,
          lastMessageTime: lastMsgTime,
          direction,
          unreadCount: cv.unreadCount || 0,
          pinned: !!cv.pinned, starred: !!cv.starred, blocked: !!cv.blocked,
        });
      }
      out.sort((a, b) => new Date(b.lastMessageTime || 0) - new Date(a.lastMessageTime || 0));
      return res.json(out);
    }
    // ── WhatsApp 分支（原逻辑不变） ──

    // 解析@lid临时ID为真实JID
    const resolveJid = (raw, lastMsg) => {
      if (!raw) return raw;
      if (!raw.endsWith("@lid")) return raw;
      const alt = lastMsg?.key?.remoteJidAlt;
      if (alt && alt.includes("@s.whatsapp.net")) return alt;
      return raw;
    };

    // ── Multi-WA: build list of accounts to process ──
    let waAccountsList = [];
    if (showAllAccounts) {
      waAccountsList = await prisma.whatsAppAccount.findMany({
        where: { userId: req.userId || 1, platform: "whatsapp", instanceName: { not: null } },
      });
    } else {
      const acc = await prisma.whatsAppAccount.findFirst({
        where: { id: parseInt(accountIdParam), platform: "whatsapp", userId: req.userId || 1 },
      });
      if (acc) waAccountsList = [acc];
    }
    if (!waAccountsList.length) return res.json([]);

    // Build a merged contactMap across all WA accounts
    const contactMap = new Map();  // key: jid, value: { jid, lastMsg, unread, accountId, accountName }

    for (const waAcc of waAccountsList) {
      const accId = waAcc.id;
      const accName = waAcc.instanceName || waAcc.name || `WA-${accId}`;
      const instanceName = waAcc.instanceName;
      if (!instanceName) continue;

      // Get the correct Evolution connector for this instance
      let accConnector;
      try { accConnector = getEvolutionConnector(instanceName); } catch(e) { continue; }

      // 按需同步联系人（节流，不阻塞响应）：首次拉列表时若该实例联系人缺名字/头像，
      // 用 findContacts 回写 Contact.pushName/avatarUrl，保证会话列表显示真实名字头像
      try { maybeSyncContactsOnDemand(instanceName).catch(() => {}); } catch(_e) {}

      // Get ownerJid for this instance
      let ownerJid = (waAcc.phone || "") + "@s.whatsapp.net";
      try {
        const info = await accConnector.getInstanceInfo();
        if (info?.ownerJid) ownerJid = info.ownerJid;
      } catch(e) {}

      // Resolve sessionId set for this WA account（同一号码可能有多个session）
      const accSessionSet = await resolveSessionIdSetForAccount(accId);
      const accSessionId = accSessionSet.length === 1 ? accSessionSet[0] : { in: accSessionSet };

      // Get jids belonging to this account from conversations table
      const accConvJids = new Set(
        (await prisma.conversation.findMany({
          where: { accountId: accId, platform: "whatsapp" },
          select: { jid: true },
        })).map(c => c.jid)
      );

      // 1. From local DB: get messages for this account's conversations
      const accJidList = [...accConvJids];
      // Build set of OTHER WA account phone numbers (to filter cross-instance synced messages)
      const otherWaPhones = new Set();
      if (!showAllAccounts || waAccountsList.length > 1) {
        const allWaPhones = await prisma.whatsAppAccount.findMany({
          where: { userId: req.userId || 1, platform: "whatsapp", phone: { not: null } },
          select: { phone: true },
        });
        const myPhone = waAcc.phone || "";
        for (const p of allWaPhones) {
          if (p.phone && p.phone !== myPhone) otherWaPhones.add(p.phone);
        }
      }
      if (accJidList.length > 0) {
        const dbMsgs = await prisma.wAMessage.findMany({
          where: {
            sessionId: accSessionId,
            OR: [
              { from: { in: accJidList } },
              { to: { in: accJidList } },
            ],
          },
          orderBy: { id: "desc" },
          take: 500,
        });
        for (const msg of dbMsgs) {
          // Skip messages addressed to a DIFFERENT WA account's phone (cross-instance sync)
          const msgToPhone = (msg.to || "").split("@")[0];
          if (msgToPhone && otherWaPhones.has(msgToPhone)) continue;
          const msgFromPhone = (msg.from || "").split("@")[0];
          if (msgFromPhone && otherWaPhones.has(msgFromPhone) && msg.direction === "inbound") continue;
          let contactJid = null;
          if (msg.direction === "inbound") contactJid = msg.from;
          else if (msg.to && msg.to !== "me") contactJid = msg.to;
          if (!contactJid || contactJid === "me" || !contactJid.includes("@")) continue;
          if (contactJid.includes("@broadcast")) continue;
          if (contactJid === ownerJid) continue;
          // @lid JIDs are valid contacts - use them directly
          if (!contactJid.endsWith("@lid")) {
            const _wmph = contactJid.split("@")[0];
            if (!_wmph || _wmph === "0" || _wmph.length < 5 || !/^[0-9]+$/.test(_wmph)) continue;
          }
          if (!contactMap.has(contactJid)) {
            contactMap.set(contactJid, {
              jid: contactJid, lastMsg: msg,
              unread: msg.direction === "inbound" && !msg.read ? 1 : 0,
              accountId: accId, accountName: accName,
            });
          } else {
            const entry = contactMap.get(contactJid);
            if (new Date(msg.timestamp) > new Date(entry.lastMsg.timestamp)) {
              entry.lastMsg = msg;
              entry.accountId = accId;
              entry.accountName = accName;
            }
            if (msg.direction === "inbound" && !msg.read) entry.unread += 1;
          }
        }
      }

      // 2. From Evolution: fetch chats for this instance
      try {
        const evoChats = await accConnector.fetchChats();
        for (const chat of evoChats) {
          let jid = chat.remoteJid;
          if (!jid || jid.includes("@g.us") || jid.includes("@broadcast")) continue;
          const lastEv = chat.lastMessage;
          jid = resolveJid(jid, lastEv);
          // 兜底解析 @lid -> @s.whatsapp.net（lid-mapping 有映射时），保证能匹配 Contact/Customer 表
          if (jid.endsWith("@lid")) {
            const _rj = resolveToPhoneJid(jid);
            if (_rj && _rj !== jid) jid = _rj;
          }
          if (jid === ownerJid) continue;
          // @lid JIDs are valid contacts - use them directly
          if (!jid.endsWith("@lid")) {
            const _eph = jid.split("@")[0];
            if (!_eph || _eph === "0" || _eph.length < 5 || !/^[0-9]+$/.test(_eph)) continue;
          }
          const evoTs = lastEv?.messageTimestamp
            ? new Date(lastEv.messageTimestamp > 1e12 ? lastEv.messageTimestamp : lastEv.messageTimestamp * 1000)
            : new Date(chat.updatedAt || Date.now());
          const body = lastEv?.message?.conversation || lastEv?.message?.extendedTextMessage?.text || "[新会话]";
          const direction = lastEv?.key?.fromMe ? "outbound" : "inbound";
          // Skip chats whose remoteJid phone matches another WA account (cross-instance)
          const evoPhone = jid.split("@")[0];
          if (evoPhone && otherWaPhones.has(evoPhone)) continue;
          if (!contactMap.has(jid)) {
            contactMap.set(jid, { jid, lastMsg: { body, timestamp: evoTs, direction }, unread: chat.unreadCount || 0, _evoOnly: true, accountId: accId, accountName: accName });
          } else {
            const entry = contactMap.get(jid);
            if (evoTs > new Date(entry.lastMsg.timestamp)) {
              entry.lastMsg = { body, timestamp: evoTs, direction };
              entry.accountId = accId;
              entry.accountName = accName;
            }
          }
        }
      } catch (e) {
        console.warn(`[WA conversations] fetchChats failed for ${instanceName}:`, e.message);
      }
    }

    // 3. 查联系人名
    const phones = [...contactMap.keys()].map(j => j.split("@")[0]);
    // 补充 @lid 解析后的手机号（Customer.phone 存的是手机号，@lid 数字匹配不到）
    for (const _j of contactMap.keys()) {
      if (_j.endsWith("@lid")) {
        const _rp = resolveToPhoneJid(_j).split("@")[0];
        if (_rp && !phones.includes(_rp)) phones.push(_rp);
      }
    }
    const customers = phones.length
      ? await prisma.customer.findMany({
          where: { userId: req.userId || 1, phone: { in: phones } },
          select: { id: true, phone: true, name: true },
        })
      : [];
    const custMap = new Map(customers.map(c => [c.phone, c]));

    // 3b. 批量查Contact表（拿头像、pushName）- 按accountId分组查询
    const jids = [...contactMap.keys()];
    let ctRecords = [];
    try {
      // Group jids by accountId for efficient querying
      const jidAccMap = new Map();
      for (const jid of jids) {
        const accId = contactMap.get(jid).accountId || 1;
        if (!jidAccMap.has(accId)) jidAccMap.set(accId, []);
        jidAccMap.get(accId).push(jid);
      }
      for (const [accId, accJids] of jidAccMap) {
        // 扩充查询 jids：同时查 @lid 与其解析后的 @s.whatsapp.net 版本，避免命中空 @lid 记录
        const qj = new Set(accJids);
        for (const _j of accJids) {
          if (_j.endsWith('@lid')) { const _rj = resolveToPhoneJid(_j); if (_rj !== _j) qj.add(_rj); }
        }
        const recs = await prisma.contact.findMany({ where: { accountId: accId, platform: 'whatsapp', jid: { in: [...qj] } } });
        ctRecords.push(...recs);
      }
    } catch (_) {}
    const ctMap = new Map(ctRecords.map(c => [c.jid, c]));

    // 3c. 批量查Conversation标记 + 确保每条都有记录 - 按accountId分组
    let convRecords = [];
    try {
      const jidAccMap2 = new Map();
      for (const jid of jids) {
        const accId = contactMap.get(jid).accountId || 1;
        if (!jidAccMap2.has(accId)) jidAccMap2.set(accId, []);
        jidAccMap2.get(accId).push(jid);
      }
      for (const [accId, accJids] of jidAccMap2) {
        const recs = await prisma.conversation.findMany({ where: { accountId: accId, jid: { in: accJids } } });
        convRecords.push(...recs);
      }
    } catch (_) {}
    const convMap = new Map(convRecords.map(c => [c.jid, c]));
    for (const jid of jids) {
      if (!convMap.has(jid)) {
        const accId = contactMap.get(jid).accountId || 1;
        const c = await _ensureConversation(accId, jid);
        if (c) convMap.set(jid, c);
      }
    }

    // 4. 组装返回
    const conversations = [];
    for (const [jid, entry] of contactMap) {
      const phone = jid.split("@")[0];
      // 过滤无效jid（兜底）
      if (!phone || phone === "0" || phone.length < 5 || !/^[0-9]+$/.test(phone)) continue;
      // 用解析后手机号优先查 Customer（@lid -> @s.whatsapp.net 手机号）
      const rPhone = jid.endsWith("@lid") ? resolveToPhoneJid(jid).split("@")[0] : phone;
      const cust = custMap.get(rPhone) || custMap.get(phone);
      const ct = _ctLookup(ctMap, jid);
      const _isRealName = (n) => n && !(n.replace(/[+\s\-()]/g, "").length >= 7 && /^\d+$/.test(n.replace(/[+\s\-()]/g, "")));
      const name = _isRealName(cust?.name) ? cust.name : (_isRealName(ct?.name) ? ct.name : (_isRealName(ct?.pushName) ? ct.pushName : phone));
      const conv = convMap.get(jid) || { pinned: false, starred: false, blocked: false };

      if (conv.blocked && !showBlocked) continue;
      if (filter === "unread" && entry.unread === 0) continue;
      if (filter === "starred" && !conv.starred) continue;

      if (search && !name.includes(search) && !phone.includes(search) && !(entry.lastMsg.body || "").includes(search)) continue;
      conversations.push({
        jid, phone, name, platform: "whatsapp",
        avatar: ct?.avatarUrl || null,
        lastMessage: entry.lastMsg.body || "",
        lastMessageTime: entry.lastMsg.timestamp,
        direction: entry.lastMsg.direction,
        unreadCount: entry.unread,
        pinned: !!conv.pinned,
        starred: !!conv.starred,
        blocked: !!conv.blocked,
        accountId: entry.accountId || null,
        accountName: entry.accountName || null,
      });
    }
    // ── Merge TG conversations when platform is "" (all) ──
    if (platform === "") {
      try {
        const tgAccounts = await prisma.whatsAppAccount.findMany({
          where: { platform: "telegram", status: "connected" },
        });
        if (tgAccounts.length) {
          const tgAccountIds = tgAccounts.map(a => a.id);
          const tgConvRecs = await prisma.conversation.findMany({
            where: { accountId: { in: tgAccountIds }, platform: "telegram" },
            orderBy: { lastMessageAt: "desc" },
          });
          const tgJids = tgConvRecs.map(c => c.jid);
          const tgCtRecs = tgJids.length ? await prisma.contact.findMany({
            where: { accountId: { in: tgAccountIds }, platform: "telegram", jid: { in: tgJids } },
          }) : [];
          const tgCtMap = new Map(tgCtRecs.map(c => [c.jid, c]));
          // Get customer names for TG contacts
          const tgCustomers = await prisma.customer.findMany({
            where: { userId: req.userId || 1, jid: { in: tgJids } },
            select: { jid: true, name: true },
          });
          const tgCustMap = new Map(tgCustomers.map(c => [c.jid, c]));
          for (const conv of tgConvRecs) {
            const phone = conv.jid.split("@")[0];
            if (!phone || !/^\d+$/.test(phone)) continue;
            const cust = tgCustMap.get(conv.jid);
            const ct = _ctLookup(tgCtMap, conv.jid);
            const isRealName = (n) => n && !(n.replace(/[+\s\-()]/g, "").length >= 7 && /^\d+$/.test(n.replace(/[+\s\-()]/g, "")));
            const name = isRealName(cust?.name) ? cust.name : (ct?.pushName && isRealName(ct.pushName) ? ct.pushName : phone);
            if (conv.blocked && !showBlocked) continue;
            if (filter === "unread" && conv.unreadCount === 0) continue;
            if (filter === "starred" && !conv.starred) continue;
            if (search && !name.includes(search) && !phone.includes(search)) continue;
            conversations.push({
              jid: conv.jid, phone, name, platform: "telegram",
              avatar: ct?.avatarUrl || null,
              lastMessage: conv.lastMessage || "",
              lastMessageTime: conv.lastMessageAt,
              direction: "inbound",
              unreadCount: conv.unreadCount || 0,
              pinned: !!conv.pinned,
              starred: !!conv.starred,
              blocked: !!conv.blocked,
              accountId: conv.accountId,
              accountName: tgAccounts.find(a => a.id === conv.accountId)?.name || null,
            });
          }
        }
      } catch (tgErr) {
        console.warn("[WA Conversations] TG merge error:", tgErr.message);
      }
    }

    // ─ 按 avatar 去重（跨Evolution实例同人，名字可能不同）──
    {
      const avatarSeen = new Map();
      const noAvatar = [];
      const avKey = (av) => (av || '').substring(0, 150);
      const nameQuality = (n) => {
        if (!n || n.length < 2) return 0;
        const digits = n.replace(/[^0-9]/g, '');
        if (digits.length > 10 && digits.length >= n.replace(/\s/g,'').length * 0.7) return 1;
        return 2;
      };
      for (const c of conversations) {
        if (!c.name || c.name.length < 2) { noAvatar.push(c); continue; }
        const key = avKey(c.avatar);
        if (!key) { noAvatar.push(c); continue; }
        if (avatarSeen.has(key)) {
          const prev = avatarSeen.get(key);
          const pq = nameQuality(prev.name);
          const cq = nameQuality(c.name);
          if (cq > pq || (cq === pq && new Date(c.lastMessageTime) > new Date(prev.lastMessageTime))) {
            avatarSeen.set(key, c);
          }
        } else {
          avatarSeen.set(key, c);
        }
      }
      const kept = new Set(avatarSeen.values());
      const result = [...noAvatar];
      for (const c of conversations) {
        if (kept.has(c) && !noAvatar.includes(c) && !result.includes(c)) result.push(c);
      }
      conversations.length = 0;
      conversations.push(...result);
    }
    conversations.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return new Date(b.lastMessageTime) - new Date(a.lastMessageTime);
    });
    res.json(conversations);
  } catch (err) {
    console.error("[WA Conversations Error]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── 会话操作接口：置顶/特别关注/封锁/删除 ───
app.post("/api/whatsapp/conversations/:jid/pin", authMiddleware, async (req, res) => {
  try {
    const jid = decodeURIComponent(req.params.jid);
    const updated = await _toggleConvField(jid, "pinned");
    res.json({ success: true, jid, pinned: updated.pinned });
  } catch (err) {
    console.error("[WA Pin Error]", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/whatsapp/conversations/:jid/star", authMiddleware, async (req, res) => {
  try {
    const jid = decodeURIComponent(req.params.jid);
    const updated = await _toggleConvField(jid, "starred");
    res.json({ success: true, jid, starred: updated.starred });
  } catch (err) {
    console.error("[WA Star Error]", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/whatsapp/conversations/:jid/block", authMiddleware, async (req, res) => {
  try {
    const jid = decodeURIComponent(req.params.jid);
    const accountId = 1;
    let conv = await prisma.conversation.findUnique({ where: { accountId_platform_jid: { accountId, platform: "whatsapp", jid } } });
    if (!conv) conv = await _ensureConversation(accountId, jid, "whatsapp");
    if (!conv) return res.status(404).json({ error: "conversation not found" });
    const newBlocked = !conv.blocked;
    const updated = await prisma.conversation.update({
      where: { id: conv.id },
      data: { blocked: newBlocked, unreadCount: newBlocked ? 0 : conv.unreadCount, updatedAt: new Date() },
    });
    res.json({ success: true, jid, blocked: updated.blocked });
  } catch (err) {
    console.error("[WA Block Error]", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/whatsapp/conversations/:jid", authMiddleware, async (req, res) => {
  try {
    const jid = decodeURIComponent(req.params.jid);
    const force = req.query.force === 'true';
    const rawPhone = jid.split('@')[0].replace(/[^0-9]/g, '');
    const resolvedJid = jid.includes('@lid') ? resolveToPhoneJid(jid) : jid;
    const phone = resolvedJid.split('@')[0];

    // 删该会话所有消息（所有平台）
    const result = await prisma.wAMessage.deleteMany({
      where: {
        OR: [
          { from: resolvedJid, direction: 'inbound' },
          { to: resolvedJid, direction: 'outbound' },
          { from: { startsWith: phone + '@' }, direction: 'inbound' },
          { to: { startsWith: phone + '@' }, direction: 'outbound' },
        ],
      },
    });

    // 动态查找该jid对应的所有accountId（支持多账号+TG）
    const platform = jid.includes('@telegram') ? 'telegram' : 'whatsapp';
    const matchingConvs = await prisma.conversation.findMany({
      where: { jid, platform },
      select: { accountId: true, id: true },
    });
    const accountIds = [...new Set(matchingConvs.map(c => c.accountId))];
    if (!accountIds.length) {
      // 兜底：尝试用phone前缀匹配
      const fallbackConvs = await prisma.conversation.findMany({
        where: { jid: { contains: phone + '@' } },
        select: { accountId: true, id: true },
      });
      accountIds.push(...[...new Set(fallbackConvs.map(c => c.accountId))]);
    }
    if (!accountIds.length) accountIds.push(1); // 最终兜底

    if (force) {
      // force模式：彻底删除联系人+客户+会话+消息
      const phonePatterns = [...new Set([rawPhone, phone].filter(p => p && p.length >= 5))];
      console.log('[Delete Conv] force=true, jid=' + jid + ', rawPhone=' + rawPhone + ', resolvedPhone=' + phone + ', accountIds=' + JSON.stringify(accountIds));
      
      // 对每个accountId都记录已删除的jid，防止webhook重建
      for (const accId of accountIds) {
        for (const p of phonePatterns) {
          await prisma.$executeRawUnsafe(
            `INSERT OR IGNORE INTO "DeletedContact" ("accountId", "jid") VALUES (?, ?)`,
            accId, p + '@s.whatsapp.net'
          ).catch(()=>{});
          await prisma.$executeRawUnsafe(
            `INSERT OR IGNORE INTO "DeletedContact" ("accountId", "jid") VALUES (?, ?)`,
            accId, p + '@'
          ).catch(()=>{});
        }
        await prisma.$executeRawUnsafe(
          `INSERT OR IGNORE INTO "DeletedContact" ("accountId", "jid") VALUES (?, ?)`,
          accId, jid
        ).catch(()=>{});
        if (resolvedJid !== jid) {
          await prisma.$executeRawUnsafe(
            `INSERT OR IGNORE INTO "DeletedContact" ("accountId", "jid") VALUES (?, ?)`,
            accId, resolvedJid
          ).catch(()=>{});
        }

        // 删除该account下的Conversation
        await prisma.conversation.deleteMany({ 
          where: { accountId: accId, OR: phonePatterns.map(p => ({ jid: { contains: p + '@' } })) } 
        }).catch(()=>{});
        
        // 删除该account下的Contact
        await prisma.contact.deleteMany({ 
          where: { accountId: accId, OR: phonePatterns.map(p => ({ jid: { contains: p + '@' } })) } 
        }).catch(()=>{});
      }
      
      // 删除Customer（全局，不按account）
      await prisma.customer.deleteMany({ 
        where: { OR: [{ phone: rawPhone }, { phone: phone }, { jid: { contains: phone + '@' } }] } 
      }).catch(()=>{});
      
      // 清理关联数据
      const deletedCustomers = await prisma.customer.findMany({ 
        where: { OR: [{ phone: rawPhone }, { phone: phone }] }, 
        select: { id: true } 
      }).catch(()=>[]);
      
      if (deletedCustomers.length > 0) {
        const cids = deletedCustomers.map(c => c.id);
        await prisma.customerFollowUp.deleteMany({ where: { customerId: { in: cids } } }).catch(()=>{});
        await prisma.customerAttitude.deleteMany({ where: { customerId: { in: cids } } }).catch(()=>{});
        await prisma.customerBantScore.deleteMany({ where: { customerId: { in: cids } } }).catch(()=>{});
        await prisma.customerBackgroundCheck.deleteMany({ where: { customerId: { in: cids } } }).catch(()=>{});
        await prisma.document.deleteMany({ where: { customerId: { in: cids } } }).catch(()=>{});
        await prisma.automationCustomer.deleteMany({ where: { customerId: { in: cids } } }).catch(()=>{});
        await prisma.customer.deleteMany({ where: { id: { in: cids } } }).catch(()=>{});
      }
      
      res.json({ success: true, jid, deletedCount: result.count, force: true, accountIds });
    } else {
      // 普通模式：只清unread和最后消息
      try {
        const conv = await prisma.conversation.findUnique({ 
          where: { accountId_platform_jid: { accountId: accountIds[0], platform, jid } } 
        });
        if (conv) {
          await prisma.conversation.update({
            where: { id: conv.id },
            data: { unreadCount: 0, lastMessage: null, lastMessageAt: null, updatedAt: new Date() },
          });
        }
      } catch (_) {}
      res.json({ success: true, jid, deletedCount: result.count });
    }
  } catch (err) {
    console.error("[WA Delete Conv Error]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// 消息历史：GET /api/whatsapp/messages?jid=xxx
app.get("/api/whatsapp/messages", authMiddleware, async (req, res) => {
  try {
    const { jid, limit = 50, before } = req.query;
    if (!jid) return res.status(400).json({ error: "jid is required" });

    let targetJid = jid;
    if (!targetJid.includes("@")) targetJid = `${targetJid.replace(/\D/g, "")}@s.whatsapp.net`;

    // 【P1修复】@lid → 解析为手机号JID（DB 统一存手机号JID，@lid 用于 Evolution 查询）
    let targetPhoneJid = null;
    if (targetJid.endsWith('@lid')) {
      const _resolved = resolveToPhoneJid(targetJid);
      if (_resolved && _resolved !== targetJid && !_resolved.endsWith('@lid')) targetPhoneJid = _resolved;
    }

    // ── Telegram 消息分支 ──
    if (targetJid.endsWith("@telegram")) {
      const tgAccounts = await prisma.whatsAppAccount.findMany({
        where: { platform: "telegram", status: "connected" },
      });
      if (!tgAccounts.length) return res.json([]);
      const sessions = tgAccounts.map(a => `tg_${a.telegramBotUsername || a.id}`);
      const tgWhere = { sessionId: { in: sessions }, OR: [{ from: targetJid }, { to: targetJid }] };
      if (before) { tgWhere.id = { lt: parseInt(before) }; }
      const dbMsgs = await prisma.wAMessage.findMany({
        where: tgWhere, orderBy: { id: "desc" }, take: parseInt(limit),
      });
      // Fire-and-forget: mark as read in background, don't block response
      (async () => {
        try {
          const _mr = await prisma.wAMessage.updateMany({
            where: { sessionId: { in: sessions }, from: targetJid, direction: "inbound", read: false },
            data: { read: true },
          });
          if (_mr.count > 0) {
            await prisma.conversation.updateMany({ where: { jid: targetJid, platform: 'telegram' }, data: { unreadCount: { decrement: _mr.count } } }).catch(()=>{});
            await prisma.conversation.updateMany({ where: { jid: targetJid, platform: 'telegram', unreadCount: { lt: 0 } }, data: { unreadCount: 0 } }).catch(()=>{});
          }
        } catch (_) {}
      })();
      let messages = dbMsgs.map(m => ({
        id: m.id, waMessageId: m.waMessageId, from: m.from, to: m.to,
        body: (m.type === "image" || m.type === "video" || m.type === "document") ? "[media]" : (m.body || m.content || ""), type: m.type || "text", messageType: m.type || "text",
        direction: m.direction, fromMe: m.direction === "outbound",
        timestamp: m.timestamp,
        translation: (() => {
          if (!m.translation) return null;
          try {
            const p = typeof m.translation === 'string' ? JSON.parse(m.translation) : m.translation;
            const isOutgoing = m.direction === 'outbound';
            return p;
          } catch { return typeof m.translation === 'string' ? m.translation : null; }
        })(),
        sourceLang: m.sourceLang, mediaUrl: m.mediaUrl || null,
        mimeType: m.mimeType || null, fileName: m.fileName || null, fileSize: m.fileLength || m.fileSize || null,
        previewDataUrl: null,
        read: m.read === true || !!m.readAt, readAt: m.readAt || null, deliveredAt: m.deliveredAt || null,
        ackError: m.ackError || null,
        platform: "telegram",
      }));

      // Always backfill TG history in background (pull up to 100 messages + download media)
      if (targetJid.endsWith("@telegram")) {
        (async () => {
          try {
            const peerId = targetJid.replace("@telegram", "");
            const ubModule = await import('./services/tg-userbot-connector.js');
            if (!ubModule.isConnected()) return;
            const history = await ubModule.getHistory(peerId, 100);
            if (!history || history.length === 0) return;
            const ubAccount = tgAccounts.find(a => !a.telegramBotToken) || tgAccounts[0];
            const ubSessionId = `tg_${ubAccount.telegramBotUsername || ubAccount.id}`;
            let contact = await prisma.contact.findFirst({ where: { accountId: ubAccount.id, platform: "telegram", jid: targetJid } });
            if (!contact) {
              try {
                const userInfo = await ubModule.getUserInfo(peerId);
                contact = await prisma.contact.create({ data: { accountId: ubAccount.id, platform: "telegram", jid: targetJid, name: userInfo?.displayName || peerId } });
              } catch { contact = await prisma.contact.create({ data: { accountId: ubAccount.id, platform: "telegram", jid: targetJid, name: peerId } }); }
            }
            let conv = await prisma.conversation.findFirst({ where: { accountId: ubAccount.id, platform: "telegram", jid: targetJid } });
            if (!conv) {
              conv = await prisma.conversation.create({ data: { accountId: ubAccount.id, platform: "telegram", contactId: contact.id, jid: targetJid } });
            }
            const existingWaIds = new Set(dbMsgs.map(m => m.waMessageId).filter(Boolean));
            let newCount = 0;
            for (const hm of history) {
              const waMsgId = `tg_${ubAccount.id}_${hm.id}_${hm.fromMe ? 'out' : 'in'}`;
              if (existingWaIds.has(waMsgId)) continue;
              const fromJid = hm.fromMe ? (ubModule.getMe()?.id?.toString() + '@telegram' || 'me@telegram') : targetJid;
              const toJid = hm.fromMe ? targetJid : (ubModule.getMe()?.id?.toString() + '@telegram' || 'me@telegram');
              // Download media if available
              let mediaUrl = null;
              if (hm.raw && hm.raw.media) {
                try {
                  const fs2 = await import('fs');
                  const path2 = await import('path');
                  const { fileURLToPath: fu2 } = await import('url');
                  const __d = path2.dirname(fu2(import.meta.url));
                  const uploadDir = path2.join(__d, 'uploads', 'tg-media');
                  if (!fs2.existsSync(uploadDir)) fs2.mkdirSync(uploadDir, { recursive: true });
                  const ubClient = ubModule.getClient();
                  if (ubClient) {
                    const buf = await ubClient.downloadMedia(hm.raw, { progressCallback: () => {} });
                    if (buf) {
                      const crypto2 = await import('crypto');
                      const hash = crypto2.createHash('md5').update(`tg_${hm.id}_${Date.now()}`).digest('hex');
                      const ext = (hm.mediaType || '').includes('Photo') ? 'jpg' : (hm.mediaType || '').includes('Video') ? 'mp4' : (hm.mediaType || '').includes('Document') ? 'pdf' : 'jpg';
                      const fname = `${hash}.${ext}`;
                      fs2.writeFileSync(path2.join(uploadDir, fname), Buffer.isBuffer(buf) ? buf : Buffer.from(buf));
                      mediaUrl = `/uploads/tg-media/${fname}`;
                    }
                  }
                } catch (dlErr) {
                  console.warn(`[TG Backfill] media download error msgId=${hm.id}:`, dlErr.message);
                }
              }
              try {
                await prisma.wAMessage.create({ data: { sessionId: ubSessionId, from: fromJid, to: toJid, body: (hm.text || '').slice(0, 500), type: normalizeTgMediaType(hm.mediaType, mediaUrl) || 'text', direction: hm.fromMe ? 'outbound' : 'inbound', timestamp: new Date(hm.timestamp).toISOString(), read: hm.fromMe, waMessageId: waMsgId, mediaUrl: mediaUrl } });
                await prisma.message.create({ data: { accountId: ubAccount.id, platform: 'telegram', contactId: contact.id, jid: targetJid, fromMe: hm.fromMe, content: (hm.text || '').slice(0, 500), messageType: normalizeTgMediaType(hm.mediaType, mediaUrl) || 'text', timestamp: new Date(hm.timestamp).toISOString().replace("T"," ").substring(0,19), mediaUrl: mediaUrl } });
                newCount++;
              } catch {}
              existingWaIds.add(waMsgId);
            }
            if (history.length > 0) {
              const latest = history[history.length - 1];
              await prisma.conversation.update({ where: { id: conv.id }, data: { lastMessage: (latest.text || '').slice(0, 200), lastMessageAt: new Date(latest.timestamp).toISOString() } });
            }
            console.log(`[TG] Backfilled ${newCount} new messages (total history: ${history.length}) for ${targetJid}`);
            if (io) {
              io.to('user_1').emit('tg-backfill-done', { jid: targetJid });
            }
          } catch (e) {
            console.warn('[TG] History fallback error (async):', e.message);
          }
        })();
      }

      return res.json(messages);
    }

    // 1. 先从DB查 - resolve sessionId based on accountId param
    // 【P0安全修复】accountId 必须归属当前用户；Evolution 补拉必须用当前用户自己的实例
    const accountIdParam = req.query.accountId;
    const _mUid = req.userId || 1;
    const myWaAccounts = await prisma.whatsAppAccount.findMany({
      where: { userId: _mUid, platform: 'whatsapp', instanceName: { not: null } },
      select: { id: true, instanceName: true },
    });
    let querySessionId;
    let evoPull = null; // { connector, sessionId }
    if (accountIdParam && accountIdParam !== 'all') {
      const accId = parseInt(accountIdParam);
      const owned = myWaAccounts.find(a => a.id === accId);
      if (!owned) return res.status(403).json({ error: '无权访问该账号的消息' });
      const sessSet = await resolveSessionIdSetForAccount(accId);
      querySessionId = sessSet.length === 1 ? sessSet[0] : { in: sessSet };
      evoPull = { connector: getEvolutionConnector(owned.instanceName), sessionId: sessSet.length ? sessSet[0] : `user_${accId}` };
    } else {
      // Query all WA sessions of current user
      // 【Bug修复 2026-08-23】不再依赖 wAConnection 表（userId=45 无记录时返回空导致空白）；
      // 改为按当前用户账号逐一 resolveSessionIdSetForAccount 合并（与 webhook 入库端对齐）
      let _sessSet = [];
      for (const _wa of myWaAccounts) {
        const _ss = await resolveSessionIdSetForAccount(_wa.id);
        _sessSet.push(..._ss);
      }
      _sessSet = Array.from(new Set(_sessSet.filter(Boolean)));
      querySessionId = _sessSet.length ? { in: _sessSet } : 'user_1';
      if (myWaAccounts.length > 0) {
        const _sess = await resolveSessionIdForAccount(myWaAccounts[0].id);
        evoPull = { connector: getEvolutionConnector(myWaAccounts[0].instanceName), sessionId: _sess };
      }
    }
    const _jidOr = [{ from: targetJid }, { to: targetJid }];
    if (targetPhoneJid) { _jidOr.push({ from: targetPhoneJid }, { to: targetPhoneJid }); }
    const where = { sessionId: querySessionId, OR: _jidOr };
    if (before) where.id = { lt: parseInt(before) };
    const dbMsgs = await prisma.wAMessage.findMany({
      where, orderBy: { id: "desc" }, take: parseInt(limit),
    });

    // 2. 总是从Evolution补拉新消息
    let messages = [...dbMsgs];
    {
      try {
        if (!evoPull) throw new Error('no owned instance for evolution pull');
        const evoMsgs = await evoPull.connector.fetchMessages(targetPhoneJid || targetJid, parseInt(limit));
        // 落库那些DB中没有的
        const existingWaIds = new Set(dbMsgs.map(m => m.waMessageId).filter(Boolean));
        const info = await evoPull.connector.getInstanceInfo().catch(() => null);
        const ownerJid = info?.ownerJid || "8613016242602@s.whatsapp.net";
        const bulkInsert = [];
        for (const m of evoMsgs) {
          const key = m.key || {};
          if (key.id && existingWaIds.has(key.id)) continue;
          let remoteJid = key.remoteJid || targetJid;
          // 解析@lid -> 真实JID
          if (key.remoteJidAlt && key.remoteJidAlt.includes('@s.whatsapp.net')) {
            remoteJid = key.remoteJidAlt;
          }
          if (remoteJid.endsWith('@lid')) {
            // 【P1修复】尝试把 @lid 解析为手机号JID；解析不了才跳过
            const _rp = resolveToPhoneJid(remoteJid);
            if (!_rp || _rp.endsWith('@lid') || _rp === remoteJid) continue;
            remoteJid = _rp;
          }
          const fromMe = !!key.fromMe;
          let body = "";
          let type = "text";
          const mm = m.message || {};
          if (mm.conversation) body = mm.conversation;
          else if (mm.extendedTextMessage) { body = mm.extendedTextMessage.text || ""; }
          else if (mm.imageMessage) { body = mm.imageMessage.caption || "[图片]"; type = "image"; }
          else if (mm.audioMessage) { body = "[语音]"; type = "audio"; }
          else if (mm.videoMessage) { body = mm.videoMessage.caption || "[视频]"; type = "video"; }
          else if (mm.documentMessage) { body = mm.documentMessage.fileName || "[文件]"; type = "document"; }
          else { body = `[${m.messageType || "unknown"}]`; type = m.messageType || "unknown"; }
          const ts = m.messageTimestamp ? new Date(m.messageTimestamp > 1e12 ? m.messageTimestamp : m.messageTimestamp * 1000) : new Date();
          bulkInsert.push({
            sessionId: evoPull ? evoPull.sessionId : (typeof querySessionId === 'string' ? querySessionId : DEFAULT_SESSION_ID),
            from: fromMe ? ownerJid : remoteJid,
            to: fromMe ? remoteJid : ownerJid,
            body,
            type,
            direction: fromMe ? "outbound" : "inbound",
            timestamp: ts,
            waMessageId: key.id || null,
          });
        }
        if (bulkInsert.length) {
          const insertedIds = [];
          for (const m of bulkInsert) { try { const created = await prisma.wAMessage.create({ data: m }); insertedIds.push(created.id); } catch(e){ /* dup, skip */ } }

          // ── 同步消息后自动触发翻译 ──
          if (insertedIds.length > 0) {
            (async () => {
              try {
                const { translateText, detectLanguage } = await import('./services/ai.service.js');
                const { getTranslationSettings } = await import('./routes/translation.js');
                const settings = await getTranslationSettings(targetJid, 1);
                if (!settings || settings.receiveEnabled === false) return;
                const engine = settings.receiveEngine || 'deepl';
                const targetLang = settings.receiveTargetLang || 'zh';
                for (const msgId of insertedIds) {
                  try {
                    const msg = await prisma.wAMessage.findUnique({ where: { id: msgId } });
                    if (!msg || msg.direction !== 'inbound' || msg.type !== 'text' || msg.translation) continue;
                    const b = (msg.body || '').trim();
                    if (b.length < 1 || b.length > 2000 || (b.startsWith('[') && b.endsWith(']'))) continue;
                    let srcLang = settings.receiveSourceLang || 'auto';
                    if (srcLang === 'auto') srcLang = await detectLanguage(b, engine);
                    if (!srcLang || srcLang === 'unknown' || srcLang === 'zh' || srcLang.startsWith('zh-')) continue;
                    const result = await translateText(b, srcLang, targetLang, engine, 1);
                    const tr = (result && (result.translated || result.text)) || '';
                    if (!tr) continue;
                    await prisma.wAMessage.update({ where: { id: msgId }, data: { translation: JSON.stringify({ original: b, translated: tr, sourceLang: srcLang, targetLang }), sourceLang: srcLang } });
                    console.log(`[SyncTranslation] #${msgId} ${srcLang}->zh: "${b.slice(0,30)}" => "${tr.slice(0,30)}"`);
                    await new Promise(r => setTimeout(r, 200));
                  } catch (te) { console.warn(`[SyncTranslation] #${msgId}:`, te.message); }
                }
              } catch (te) { console.warn('[SyncTranslation] batch error:', te.message); }
            })();
          }

          // 重新查DB（【P1修复】OR 需含 targetPhoneJid，否则 @lid 查询被覆盖为空）
          const refreshed = await prisma.wAMessage.findMany({
            where: { sessionId: querySessionId, OR: _jidOr },
            orderBy: { id: "desc" }, take: parseInt(limit),
          });
          messages = refreshed;
        }
      } catch (e) {
        console.warn("[WA messages] fetch from evolution failed:", e.message);
      }
    }

    // 标记已读
    try {
      await prisma.wAMessage.updateMany({
        where: { sessionId: querySessionId, from: targetJid, direction: "inbound", read: false },
        data: { read: true },
      });
    } catch (e) {}

    const mapped = messages.map(m => ({
      id: m.id, waMessageId: m.waMessageId, from: m.from, to: m.to,
      body: m.body || "", type: m.type || "text", messageType: m.type || "text",
      direction: m.direction, fromMe: m.direction === "outbound",
      timestamp: m.timestamp,
      translation: (() => {
        if (!m.translation) return null;
        try {
          const p = typeof m.translation === 'string' ? JSON.parse(m.translation) : m.translation;
          const isOutgoing = m.direction === "outbound";
          return p;
        } catch { return typeof m.translation === 'string' ? m.translation : null; }
      })(),
      sourceLang: m.sourceLang, mediaUrl: m.mediaUrl || null,
      mimeType: m.mimeType || null, fileName: m.fileName || null, fileSize: m.fileLength || m.fileSize || null,
      previewDataUrl: null,
      read: m.read === true || !!m.readAt, readAt: m.readAt || null, deliveredAt: m.deliveredAt || null,
      ackError: m.ackError || null,
      platform: "whatsapp",
    }));
    res.json(mapped.reverse());
  } catch (err) {
    console.error("[WA Messages Error]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// 获取活跃连接列表
app.get("/api/whatsapp/connections", authMiddleware, async (req, res) => {
  try {
    const state = await evoConnector.getConnectionState();
    const info = await evoConnector.getInstanceInfo().catch(() => null);
    res.json([{
      sessionId: DEFAULT_SESSION_ID,
      status: state === "open" ? "connected" : "disconnected",
      phone: (info?.ownerJid || "").split("@")[0] || null,
      instance: evoConnector.instance,
      mode: "evolution-api",
    }]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 断开连接
app.post("/api/whatsapp/disconnect", authMiddleware, async (req, res) => {
  try {
    await evoConnector._delete(`/instance/logout/${evoConnector.instance}`).catch(() => {});
    await prisma.wAConnection.updateMany({ where: { sessionId: DEFAULT_SESSION_ID }, data: { status: "disconnected" } });
    const io = app.get("io");
    if (io) io.emit("whatsapp:status", { status: "disconnected", reason: "manual logout", sessionId: DEFAULT_SESSION_ID });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 兼容别名
app.get('/api/conversations', authMiddleware, (req, res) => {
  req.url = '/api/whatsapp/conversations' + (req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '');
  app(req, res);
});
app.post('/api/messages/send', authMiddleware, (req, res) => {
  req.url = '/api/whatsapp/send';
  app(req, res);
});

// Health check
app.get('/api/health', (req, res) => {
  logger.debug('Server', 'health check');
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── 文档下载（所有环境） ───
app.use("/uploads/documents", express.static(path.join(__dirname, '../uploads/documents')));

// ─── 前端静态资源（生产环境） ───
if (isProduction) {
  const cwdFrontendPath = path.join(process.cwd(), '../frontend/dist');
  const fallbackFrontendPath = path.join(__dirname, '../../frontend/dist');
  const frontendPath = fs.existsSync(cwdFrontendPath) ? cwdFrontendPath : fallbackFrontendPath;
  const hasDist = fs.existsSync(path.join(frontendPath, 'index.html'));
  console.log(`[Production] Serving frontend from: ${frontendPath} (dist exists: ${hasDist})`);

  if (hasDist) {
    // Company material uploads (served before SPA fallback)
    app.use("/uploads/company", express.static(path.join(__dirname, "../uploads/company")));
    app.use("/uploads/outbound", express.static(path.join(__dirname, "uploads/outbound")));
    app.use("/uploads/tg-media", express.static(path.join(__dirname, "uploads/tg-media")));
    app.use("/uploads/tg-avatars", express.static(path.join(__dirname, "../uploads/tg-avatars")));
    app.use(express.static(frontendPath));
    app.get('{*path}', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) return next();
      res.sendFile(path.join(frontendPath, 'index.html'));
    });
  } else {
    console.warn('[Production] WARNING: frontend dist not found, serving API-only mode');
    app.get('/', (req, res) => {
      res.json({ status: 'ok', mode: 'api-only', message: 'Frontend not built' });
    });
  }
}

// ─── Socket.io ───
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: isProduction ? false : ['http://localhost:5173', 'http://localhost:5000', 'http://localhost:3000'],
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingInterval: 25000,
  pingTimeout: 60000,
});

app.set('io', io);
app.set('prisma', prisma);

// 简化的Socket handler（直接使用Evolution connector状态，旧BaileysProvider handler保留文件但不引入其依赖）
setupSocketHandlers(io, prisma);

// 客户端(重)连时立即跑一次backfill补漏，断线期间的消息不用等3分钟周期
// 节流：30秒内只跑一次，避免重连风暴时反复backfill
let _lastBackfill = 0;
io.on('connection', () => {
  const now = Date.now();
  if (now - _lastBackfill < 30000) return;
  _lastBackfill = now;
  import('./services/message-backfill.js').then(m => {
    if (m.runOnce) m.runOnce(io).catch(e => console.warn('[Backfill] on-connect error:', e.message));
  }).catch(() => {});
});



// Normalize TG GramJS mediaType to standard types
function normalizeTgMediaType(t, mediaUrl) {
  if (!t) return 'text';
  const lower = t.toLowerCase();
  if (lower.includes('photo')) return 'image';
  if (lower.includes('video')) return 'video';
  if (lower.includes('document') || lower.includes('file')) {
    // Telegram sends images as documents - check file extension/mimeType
    if (mediaUrl) {
      const ext = (mediaUrl.split('.').pop() || '').toLowerCase();
      if (['jpg','jpeg','png','gif','webp','bmp','heic'].includes(ext)) return 'image';
      if (['mp4','mov','avi','mkv','webm'].includes(ext)) return 'video';
    }
    return 'document';
  }
  if (lower.includes('audio') || lower.includes('voice')) return 'audio';
  if (lower.includes('contact')) return 'contact';
  if (lower.includes('geo') || lower.includes('location')) return 'location';
  return t;
}

// ─── Start ───
httpServer.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[FATAL] Port ${LISTEN_PORT} is already in use. Exiting.`);
    process.exit(1);
  }
  console.error('[FATAL] Server error:', err);
});

async function seedDefaultUser() {
  try {
    try { await prisma.$queryRaw`SELECT name FROM sqlite_master WHERE type='table' LIMIT 1`; }
    catch {
      console.log('[Seed] Database not ready, running db push...');
      const { execSync } = await import('child_process');
      execSync('npx prisma db push --accept-data-loss', { stdio: 'inherit', cwd: process.cwd() });
    }
    const bcrypt = (await import('bcryptjs')).default || (await import('bcryptjs'));
    const hashFunc = bcrypt.hash || bcrypt.default?.hash;
    if (!hashFunc) throw new Error('bcrypt.hash not available');
    const existing = await prisma.user.findUnique({ where: { username: 'admin' } });
    if (!existing) {
      const hash = await hashFunc('admin123', 10);
      await prisma.user.create({ data: { username: 'admin', password: hash, name: 'Admin', role: 'admin' } });
      console.log('[Seed] Default user created: admin / admin123');
    }
  } catch (err) {
    console.error('[Seed] Error creating default user:', err.message);
  }
}

async function startServer() {
  await ensureDatabase();
  await seedDefaultUser();

  const sessionsDir = path.join(process.cwd(), 'sessions');
  try {
    if (!fs.existsSync(sessionsDir)) fs.mkdirSync(sessionsDir, { recursive: true });
    console.log(`[Server] Sessions dir: ${sessionsDir}`);
  } catch (err) {
    console.warn(`[Server] Could not create sessions dir: ${err.message}`);
  }

  // 启动联系人周期同步（保持 Contact.pushName/avatarUrl 新鲜）
  try { startContactSyncScheduler(); } catch(e) { console.warn('[Server] startContactSyncScheduler error:', e.message); }

  httpServer.listen(LISTEN_PORT, '0.0.0.0', () => {
    console.log(`[${isProduction ? 'Production' : 'Dev'}] Server running on port ${LISTEN_PORT}`);
    console.log(`[Server] Build version: evolution-api-v1 | Mode: Evolution REST API`);
    logger.info('Server', 'listening on port ' + LISTEN_PORT + ', env=' + (isProduction ? 'production' : 'dev'));
    // TG User Bot 消息去重集合（防止GramJS同一消息触发多次onMessage）
    const _tgProcessedMsgs = new Set();
    // TG User Bot 自动重连（如果有已保存的session）
    autoConnectUserBot({
      apiId: 33683021,
      apiHash: 'c0fba584709b3b8ec13c0a5e18b94f75',
      onEvent: {
        onMessage: async (msg) => {
          console.log('[TG-UB] Incoming message:', msg.chatId, msg.text?.substring(0, 50));
          // 去重：同一chatId+messageId只处理一次
          const _dedupKey = msg.chatId + '_' + msg.messageId + '_' + (msg.fromMe ? 'out' : 'in');
          if (_tgProcessedMsgs.has(_dedupKey)) {
            console.log('[TG-UB] Skip duplicate onMessage:', _dedupKey);
            return;
          }
          _tgProcessedMsgs.add(_dedupKey);
          // 限制Set大小，防止内存泄漏
          if (_tgProcessedMsgs.size > 5000) {
            const _arr = [..._tgProcessedMsgs];
            _tgProcessedMsgs.clear();
            _arr.slice(-2000).forEach(k => _tgProcessedMsgs.add(k));
          }
          try {
            // 优先使用 UserBot 账号（incoming messages come from userbot context）
            let tgAccount = await prisma.whatsAppAccount.findFirst({
              where: { platform: 'telegram', telegramBotToken: null, status: 'connected' },
              orderBy: { createdAt: 'desc' },
            });
            if (!tgAccount) {
              tgAccount = await prisma.whatsAppAccount.findFirst({
                where: { platform: 'telegram', status: 'connected' },
                orderBy: { createdAt: 'desc' },
              });
            }
            if (!tgAccount) return;
            const tgSessionId = `tg_${tgAccount.telegramBotUsername || tgAccount.id}`;
            // 确保 WAConnection 存在（WAMessage.sessionId 外键依赖；否则 TG 实时消息 P2003 落库失败）
            try {
              await prisma.wAConnection.upsert({
                where: { sessionId: tgSessionId },
                update: { status: 'connected', lastConnectedAt: new Date() },
                create: { userId: tgAccount.userId, sessionId: tgSessionId, status: 'connected', lastConnectedAt: new Date() },
              });
            } catch (wacErr) { console.warn('[TG-UB] WAConnection upsert error:', wacErr.message); }
            const jid = `${msg.chatId}@telegram`;
            // Find or create contact
            let contact = await prisma.contact.findFirst({
              where: { accountId: tgAccount.id, platform: 'telegram', jid },
            });
            if (!contact) {
              try {
                const ubMod = await import('./services/tg-userbot-connector.js');
                const userInfo = await ubMod.getUserInfo(msg.chatId);
                let avatarUrl = null;
                try { avatarUrl = await ubMod.downloadProfilePhoto(msg.chatId); } catch {}
                contact = await prisma.contact.create({
                  data: {
                    accountId: tgAccount.id,
                    platform: 'telegram',
                    jid,
                    name: userInfo?.displayName || userInfo?.username || msg.chatId,
                    phone: userInfo?.phone || null,
                    avatarUrl,
                  },
                });
              } catch {
                contact = await prisma.contact.create({
                  data: { accountId: tgAccount.id, platform: 'telegram', jid, name: msg.chatId },
                });
              }
            } else {
              // 更新已有联系人的头像
              try {
                const ubMod2 = await import('./services/tg-userbot-connector.js');
                const newAvatar = await ubMod2.downloadProfilePhoto(msg.chatId);
                if (newAvatar && newAvatar !== contact.avatarUrl) {
                  await prisma.contact.update({ where: { id: contact.id }, data: { avatarUrl: newAvatar } });
                  contact.avatarUrl = newAvatar;
                }
              } catch {}
            }
            // Find or create conversation
            let conv = await prisma.conversation.findFirst({
              where: { accountId: tgAccount.id, platform: 'telegram', jid },
            });
            if (!conv) {
              conv = await prisma.conversation.create({
                data: {
                  accountId: tgAccount.id,
                  platform: 'telegram',
                  contactId: contact.id,
                  jid,
                },
              });
            }
            // Save to WAMessage table (for frontend message list)
            const isOut = !!msg.fromMe;
            // 解析媒体URL（图片/文档/视频）
            let mediaUrl = null;
            if (msg.mediaType) { console.log('[TG-UB Media DEBUG] type=' + msg.mediaType + ' isOut=' + isOut + ' hasRaw=' + !!msg.raw + ' client=' + (typeof ubClient !== 'undefined' ? 'defined' : 'undef')); }
            if (msg.mediaType && msg.raw) {
              try {
                const fs2 = await import('fs');
                const path2 = await import('path');
                const { fileURLToPath: fu2 } = await import('url');
                const __d = path2.dirname(fu2(import.meta.url));
                const uploadDir = path2.join(__d, 'uploads', 'tg-media');
                if (!fs2.existsSync(uploadDir)) fs2.mkdirSync(uploadDir, { recursive: true });
                // 通过GramJS client下载媒体
                const ubMod = await import('./services/tg-userbot-connector.js');
                const ubClient = ubMod.getClient ? ubMod.getClient() : null;
                if (ubClient && ubClient.connected) {
                  console.log('[TG-UB Media] Downloading msgId=' + msg.messageId + ' type=' + msg.mediaType + ' rawType=' + (msg.raw ? msg.raw.className : 'null'));
                  try {
                    const buf = await ubClient.downloadMedia(msg.raw, { progressCallback: () => {} });
                    console.log('[TG-UB Media] Download result: buf=' + (buf ? Buffer.isBuffer(buf) ? 'buffer:'+buf.length : typeof buf : 'null'));
                    if (buf) {
                      const crypto2 = await import('crypto');
                      const hash = crypto2.createHash('md5').update(`tg_${msg.messageId}_${Date.now()}`).digest('hex');
                      const ext = msg.mediaType.includes('photo') ? 'jpg' : msg.mediaType.includes('video') ? 'mp4' : msg.mediaType.includes('document') ? 'pdf' : 'jpg';
                      const fname = `${hash}.${ext}`;
                      const fpath = path2.join(uploadDir, fname);
                      fs2.writeFileSync(fpath, Buffer.isBuffer(buf) ? buf : Buffer.from(buf));
                      mediaUrl = `/uploads/tg-media/${fname}`;
                      console.log('[TG-UB] Media downloaded:', fname);
                    }
                  } catch(downloadErr) {
                    console.warn('[TG-UB Media] downloadMedia threw:', downloadErr.message);
                  }
                } else {
                  console.warn('[TG-UB Media] Client not connected, skip download');
                }
              } catch (dlErr) {
                console.warn('[TG-UB] media download error:', dlErr.message);
              }
            }
            const _waMsgId = `tg_${tgAccount.id}_${msg.messageId}_${isOut ? 'out' : 'in'}`;
            const _existingWa = await prisma.wAMessage.findUnique({ where: { waMessageId: _waMsgId } }).catch(()=>null);
            let waMsg;
            if (_existingWa) {
              waMsg = _existingWa;
            } else {
              try {
                waMsg = await prisma.wAMessage.create({
                  data: {
                    sessionId: tgSessionId,
                    from: isOut ? 'me' : jid,
                    to: isOut ? jid : 'me',
                    body: msg.text || (msg.mediaType ? '[' + normalizeTgMediaType(msg.mediaType, mediaUrl) + ']' : ''),
                    type: normalizeTgMediaType(msg.mediaType, mediaUrl) || 'text',
                    direction: isOut ? 'outbound' : 'inbound',
                    timestamp: new Date(msg.timestamp).toISOString(),
                    waMessageId: _waMsgId,
                    mediaUrl: mediaUrl,
                  },
                });
              } catch (ce) {
                console.log('[TG-UB] wAMessage create error:', ce.code, ce.message?.substring(0,100));
                const found = await prisma.wAMessage.findFirst({ where: { waMessageId: _waMsgId } }).catch(()=>null);
                if (found) {
                  console.log('[TG-UB] wAMessage found existing:', _waMsgId, 'id=', found.id);
                  waMsg = found;
                } else {
                  console.warn('[TG-UB] wAMessage not found after create error, skip msg:', _waMsgId);
                  return;
                }
              }
            }
            // Save to Message table (CRM data model)
            const _ts = new Date(msg.timestamp).toISOString();
            const _existingMsg = await prisma.message.findFirst({
              where: { platform: 'telegram', jid, content: msg.text || '', timestamp: _ts }
            }).catch(()=>null);
            let savedMsg;
            if (_existingMsg) {
              savedMsg = _existingMsg;
            } else {
              savedMsg = await prisma.message.create({
                data: {
                  accountId: tgAccount.id,
                  platform: 'telegram',
                  contactId: contact.id,
                  jid,
                  fromMe: isOut,
                  content: msg.text || (msg.mediaType ? '[' + normalizeTgMediaType(msg.mediaType, mediaUrl) + ']' : ''),
                  messageType: normalizeTgMediaType(msg.mediaType, mediaUrl) || 'text',
                  timestamp: _ts,
                  mediaUrl: mediaUrl,
                },
              });
            }
            const savedMsgId = savedMsg.id;
            // Update conversation
            await prisma.conversation.update({
              where: { id: conv.id },
              data: {
                lastMessage: (msg.text || (msg.mediaType ? `[${msg.mediaType}]` : '')).slice(0, 200),
                lastMessageAt: new Date(msg.timestamp).toISOString(),
                unreadCount: isOut || msg.skipUnread ? 0 : { increment: 1 },
              },
            });
            // Emit socket events for real-time frontend update
            if (io) {
              io.emit('telegram:message', {
                accountId: tgAccount.id,
                contactId: contact.id,
                jid,
                message: {
                  id: savedMsgId,
                  savedMsgId: savedMsgId,
                  waMessageId: waMsg.waMessageId,
                  fromMe: isOut,
                  content: msg.text || (msg.mediaType ? '[' + normalizeTgMediaType(msg.mediaType, mediaUrl) + ']' : ''),
                  body: msg.text || (msg.mediaType ? '[' + normalizeTgMediaType(msg.mediaType, mediaUrl) + ']' : ''),
                  messageType: normalizeTgMediaType(msg.mediaType, mediaUrl) || 'text',
                  timestamp: new Date(msg.timestamp).toISOString(),
                  platform: 'telegram',
                  waMessageId: waMsg.waMessageId,
                  jid,
                  mediaUrl: mediaUrl,
                },
              });
              io.emit('conversation:update', {
                accountId: tgAccount.id,
                conversation: {
                  id: conv.id,
                  jid,
                  platform: 'telegram',
                  lastMessage: (msg.text || '').slice(0, 200),
                  lastMessageAt: new Date(msg.timestamp),
                },
              });
            }
            // 异步翻译入站消息（与webhook处理器一致）
            try {
              const { getTranslationSettings } = await import('./routes/translation.js');
              const { detectLanguage, translateText } = await import('./services/ai.service.js');
              const body = (msg.text || '').trim();
              if (body && body.length >= 1 && body.length <= 2000 && !(body.startsWith('[') && body.endsWith(']'))) {
                const settings = await getTranslationSettings(jid, tgAccount.userId || 1);
                if (settings && settings.receiveEnabled) {
                  const engine = settings.receiveEngine || 'deepl';
                  let srcLang = settings.receiveSourceLang || 'auto';
                  const tgtLang = settings.receiveTargetLang || 'zh';
                  if (srcLang === 'auto') { try { srcLang = await detectLanguage(body, engine); } catch(_){} }
                  const alreadyZh = /[\u4e00-\u9fff]/.test(body);
                  if (srcLang && srcLang !== 'unknown' && srcLang !== 'zh' && !(tgtLang === 'zh' && alreadyZh)) {
                    const result = await translateText(body, srcLang, tgtLang, engine, tgAccount.userId || 1);
                    const translated = (result && (result.translated || result.text)) || '';
                    if (translated) {
                      const transObj = JSON.stringify({ original: body, translated, sourceLang: srcLang, targetLang: tgtLang });
                      await prisma.message.update({ where: { id: savedMsgId }, data: { translation: transObj, sourceLang: srcLang } }).catch(()=>{});
                      await prisma.wAMessage.update({ where: { id: waMsg.id }, data: { translation: transObj, sourceLang: srcLang } }).catch(()=>{});
                      console.log('[TG-UB Translate] ' + srcLang + '->' + tgtLang + ': "' + body.substring(0,50) + '" => "' + translated.substring(0,50) + '"');
                      if (io) {
                        console.log('[TG-UB] Emitting translation events, io.connected:', io.engine ? io.engine.clientsCount : 'unknown');
                        io.emit('telegram:translation', { id: savedMsgId, waId: waMsg.id, jid, translation: { original: body, translated, sourceLang: srcLang, targetLang: tgtLang }, sourceLang: srcLang });
                        io.emit('whatsapp:translation', { id: waMsg.id, jid, translation: { original: body, translated, sourceLang: srcLang, targetLang: tgtLang }, sourceLang: srcLang, platform: 'telegram' });
                      }
                    }
                  }
                }
              }
            } catch (te) {
              console.warn('[TG-UB] translate error:', te.message);
            }
          } catch (e) {
            console.error('[TG-UB] onMessage save error:', e.stack || e.message || JSON.stringify(e));
          }
        },
        onReady: (me) => {
          console.log('[TG-UB] Auto-connected:', me.username || me.id);
        },
      },
    }).catch(e => console.warn('[TG-UB] Auto-connect failed:', e.message));
    // 初始化Evolution Connector
    evoConnector.init().catch(err => console.warn('[Evolution] init error:', err.message));

    // 启动时重置所有WA实例的webhook（确保指向当前端口）— 仅 ENABLE_WEBHOOK_RESET=true 时执行（beta/staging 不设该变量，避免抢占生产实例 webhook）
    if (process.env.ENABLE_WEBHOOK_RESET === 'true') {
    (async () => {
      const webhookPort = process.env.DEPLOY_RUN_PORT || LISTEN_PORT;
      const webhookUrl = `http://host.docker.internal:${webhookPort}/api/evolution/webhook`;
      for (const inst of ["jeremy-main", "jeremy-eric"]) {
        try {
          await fetch(EVO_API + "/webhook/set/" + inst, {
            method: "POST",
            headers: { apikey: EVO_KEY, "Content-Type": "application/json" },
            body: JSON.stringify({
              webhook: {
                enabled: true,
                url: webhookUrl,
                byEvents: true,
                events: ["MESSAGES_UPSERT","MESSAGES_UPDATE","MESSAGES_DELETE","CONNECTION_UPDATE","SEND_MESSAGE"]
              }
            })
          });
          console.log(`[Startup] webhook set for ${inst} -> port ${webhookPort}`);
        } catch(e) { console.warn(`[Startup] webhook ${inst}:`, e.message); }
      }
    })();
    } else {
      console.log('[Startup] Webhook reset disabled (ENABLE_WEBHOOK_RESET != true), skip WA instance webhook reset');
    }

    // TG webhook自恢复：重启后自动给已连接的TG bot重设webhook（防止进程crash/重启后webhook失效）
    import('./services/telegram-connector.js').then(async ({ getTelegramConnector }) => {
      const crypto = await import('node:crypto');
      const tgAccs = await prisma.whatsAppAccount.findMany({
        where: { platform: 'telegram', status: 'connected', telegramBotToken: { not: null } }
      });
      for (const acc of tgAccs) {
        try {
          const conn = getTelegramConnector(decToken(acc.telegramBotToken));
          const expectedPrefix = 'tgwh_';
          let secret = '';
          if (acc.sessionDir && acc.sessionDir.startsWith(expectedPrefix)) {
            secret = acc.sessionDir.slice(expectedPrefix.length).split('_')[0];
          }
          if (!secret) {
            secret = crypto.randomBytes(12).toString('hex');
            await prisma.whatsAppAccount.update({
              where: { id: acc.id },
              data: { sessionDir: `tgwh_${secret}` }
            });
          }
          const baseUrl = process.env.PUBLIC_BASE_URL || 'https://ai.jzjglass.com';
          const webhookUrl = `${baseUrl}/api/telegram/webhook/${secret}`;
          // 先getWebhookInfo检查，若已正确则跳过，避免每次重启drop_pending_updates丢消息
          let needReset = true;
          try {
            const info = await conn.getWebhookInfo();
            if (info && info.url === webhookUrl && !info.last_error_message && info.pending_update_count < 50) {
              needReset = false;
            }
          } catch(e) {}
          if (needReset) {
            await conn.setWebhook(webhookUrl, secret, false);
            console.log(`[TG] Webhook auto-reset for @${acc.telegramBotUsername}: ${webhookUrl}`);
          } else {
            console.log(`[TG] Webhook already OK for @${acc.telegramBotUsername}, skip reset`);
          }
        } catch (e) {
          console.warn(`[TG] webhook auto-reset failed for ${acc.telegramBotUsername}:`, e.message);
        }
      }
    }).catch(e => console.warn('[TG] webhook auto-restore skipped:', e.message));
    // 消息兜底补拉：防止webhook漏推导致消息丢失
    import("./services/message-backfill.js").then(m => { if (m.startBackfill) m.startBackfill(io); }).catch(e => console.warn("[Backfill] load error:", e.message));
    // 启动自动化调度器（如果存在）
    import("./services/automation-scheduler.js").then(m => {
      if (m.startScheduler) m.startScheduler();
    }).catch(() => {});
    // 启动日程提醒调度器（如果存在）
    import("./services/reminder-scheduler.js").then(m => {
      if (m.startReminderScheduler) m.startReminderScheduler(io);
    }).catch(e => console.warn("[Reminder Scheduler] load error:", e.message));
  });
}

startServer().catch(err => {
  console.error('[FATAL] Failed to start server:', err);
  logger.error('Server', '[FATAL] Failed to start server:', err.message);
  process.exit(1);
});

async function gracefulShutdown(signal) {
  console.log(`\n[${signal}] Shutting down gracefully...`);
  io.close();
  httpServer.close();
  await prisma.$disconnect();
  process.exit(0);
}
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
