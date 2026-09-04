import express from "express";
import { PrismaClient } from "@prisma/client";
import { getTelegramConnector, normalizeIncomingUpdate } from "../services/telegram-connector.js";
import crypto from "crypto";
import { decrypt, isEncrypted } from "../utils/encryption.js";
function decToken(t) { return t && isEncrypted(t) ? decrypt(t) : t; }
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename_tg = fileURLToPath(import.meta.url);
const __dirname_tg = path.dirname(__filename_tg);
const TG_MEDIA_DIR = path.resolve(__dirname_tg, "../../uploads/tg-media");

const router = express.Router();
const prisma = new PrismaClient();

// 入站消息：不经过auth中间件（TG服务器直推），用secret_token校验
// 路径：/api/telegram/webhook/:secretToken
router.post("/webhook/:secret", async (req, res) => {
  try {
    const secret = req.params.secret;
    // 找一个匹配secret的TG账号
    const account = await prisma.whatsAppAccount.findFirst({
      where: {
        platform: "telegram",
        status: "connected",
        telegramBotToken: { not: null },
      },
    });
    if (!account) {
      return res.status(404).json({ error: "no active telegram account" });
    }
    // 简单校验：从token派生一个secret，匹配才放行
    // webhook secret 存在 sessionDir 里（格式 tgwh_<sha256hex24>_<accountId>）
    const expectedPrefix = "tgwh_";
    if (!account.sessionDir || !account.sessionDir.startsWith(expectedPrefix)) {
      return res.status(401).json({ error: "invalid webhook config" });
    }
    const expectedSecret = account.sessionDir.slice(expectedPrefix.length).split("_")[0];
    if (secret !== expectedSecret) {
      return res.status(401).json({ error: "bad secret" });
    }

    const connector = getTelegramConnector(decToken(account.telegramBotToken));
    const update = req.body;
    const msg = normalizeIncomingUpdate(update);

    if (msg && msg.chatType === "private") {
      await handleIncomingPrivate(prisma, account, connector, msg, req.app.get("io"));
    }
    // 群/频道暂MVP不处理
    res.status(200).json({ ok: true });
  } catch (e) {
    console.error("[TG webhook] error:", e.message);
    res.status(200).json({ ok: false, error: e.message }); // 必须回200不然TG会重推
  }
});


/** Get file download URL from TG Bot API */
async function getTgFileUrl(token, fileId) {
  try {
    const resp = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`);
    const data = await resp.json();
    if (data.ok && data.result?.file_path) {
      return `https://api.telegram.org/file/bot${token}/${data.result.file_path}`;
    }
  } catch(e) { /* ignore */ }
  return null;
}

/** Fetch TG user profile photo URL via Bot API (best/largest) */
async function fetchTgAvatarUrl(connector, userId) {
  try {
    const photos = await connector.getUserProfilePhotos(userId, 1);
    if (photos && photos.total_count > 0 && photos.photos && photos.photos[0]) {
      const sizes = photos.photos[0];
      const bestFile = sizes[sizes.length - 1]; // largest
      if (bestFile && bestFile.file_id) {
        const fileInfo = await connector.getFile(bestFile.file_id);
        return fileInfo.downloadUrl || null;
      }
    }
  } catch(e) { /* ignore - user may have privacy settings */ }
  return null;
}

async function handleIncomingPrivate(prisma, account, connector, msg, io) {
  const tgPeerId = String(msg.chatId);
  // JID 规范：纯数字id + @telegram
  const jid = `${tgPeerId}@telegram`;
  const phone = null; // TG没有手机号公开

  // 检查是否在已删除名单中，防止webhook重建已删除的联系人
  try {
    const deleted = await prisma.$queryRawUnsafe(
      `SELECT 1 FROM "DeletedContact" WHERE "accountId" = ? AND ("jid" = ? OR "jid" LIKE ?)`,
      account.id, jid, tgPeerId + '@%'
    );
    if (deleted.length > 0) {
      console.log('[TG-Webhook] Skipping deleted contact:', jid, 'accountId:', account.id);
      return null;
    }
  } catch(_e) { /* table may not exist */ }

  // upsert contact
  let contact = await prisma.contact.findUnique({
    where: { accountId_platform_jid: { accountId: account.id, platform: "telegram", jid } },
  });
  const displayName = [msg.firstName, msg.lastName].filter(Boolean).join(" ").trim()
    || msg.username
    || `tg_${tgPeerId}`;
  if (!contact) {
    const avatarUrl = await fetchTgAvatarUrl(connector, msg.fromId || msg.chatId);
    contact = await prisma.contact.create({
      data: {
        accountId: account.id,
        platform: "telegram",
        jid,
        name: displayName,
        phone,
        pushName: msg.username || null,
        avatarUrl,
      },
    });
  } else {
    // 更新名字/用户名/头像
    const updData = {};
    if ((contact.name || "").trim() !== displayName) updData.name = displayName;
    if (contact.pushName !== (msg.username || null)) updData.pushName = msg.username || contact.pushName;
    const avatarUrl = await fetchTgAvatarUrl(connector, msg.fromId || msg.chatId);
    if (avatarUrl) updData.avatarUrl = avatarUrl;
    if (Object.keys(updData).length > 0) {
      contact = await prisma.contact.update({
        where: { id: contact.id },
        data: updData,
      });
    }
  }

  // 确保TG对应的WAConnection存在（WAMessage外键需要）
  const tgSessionId = `tg_${account.telegramBotUsername || account.id}`;
  await prisma.wAConnection.upsert({
    where: { sessionId: tgSessionId },
    update: { status: 'connected', lastConnectedAt: new Date() },
    create: {
      userId: account.userId,
      sessionId: tgSessionId,
      phone: account.phone || String(msg.chatId),
      status: 'connected',
      lastConnectedAt: new Date(),
    },
  }).catch(() => {});

  // 获取/创建 conversation
  let conv = await prisma.conversation.findUnique({
    where: { accountId_platform_jid: { accountId: account.id, platform: "telegram", jid } },
  });
  if (!conv) {
    conv = await prisma.conversation.create({
      data: {
        accountId: account.id,
        platform: "telegram",
        contactId: contact.id,
        jid,
        lastMessage: msg.text.slice(0, 200),
        lastMessageAt: msg.timestamp,
        unreadCount: 1,
      },
    });
  } else {
    conv = await prisma.conversation.update({
      where: { id: conv.id },
      data: {
        lastMessage: msg.text.slice(0, 200),
        lastMessageAt: msg.timestamp,
        unreadCount: { increment: 1 },
      },
    });
  }

  // Resolve media: download TG file to local storage (avoid expired/leaked bot-token URLs)
  let mediaUrl = null;
  if (msg.media && msg.media.fileId) {
    try {
      const _tk = decToken(account.telegramBotToken);
      const fileResp = await fetch(`https://api.telegram.org/bot${_tk}/getFile?file_id=${msg.media.fileId}`);
      const fileData = await fileResp.json();
      if (fileData.ok && fileData.result?.file_path) {
        const tgUrl = `https://api.telegram.org/file/bot${_tk}/${fileData.result.file_path}`;
        // Download to local tg-media dir
        if (!fs.existsSync(TG_MEDIA_DIR)) fs.mkdirSync(TG_MEDIA_DIR, { recursive: true });
        const ext = path.extname(fileData.result.file_path) || '.jpg';
        const localName = crypto.randomBytes(16).toString('hex') + ext;
        const localPath = path.join(TG_MEDIA_DIR, localName);
        const dlResp = await fetch(tgUrl);
        if (dlResp.ok) {
          const buf = Buffer.from(await dlResp.arrayBuffer());
          fs.writeFileSync(localPath, buf);
          mediaUrl = `/uploads/tg-media/${localName}`;
          console.log(`[TG] Media downloaded to local: ${mediaUrl}`);
        } else {
          mediaUrl = tgUrl;
          console.warn(`[TG] Download failed (${dlResp.status}), fallback to direct URL`);
        }
      } else {
        console.warn(`[TG] Failed to get file URL for fileId: ${msg.media.fileId}`, fileData);
      }
    } catch(e) { 
      console.error(`[TG] Error fetching file URL:`, e.message);
    }
  }

  // 写 Message（复用通用Message表，platform字段区分）
  const saved = await prisma.message.create({
    data: {
      accountId: account.id,
      platform: "telegram",
      contactId: contact.id,
      jid,
      fromMe: false,
      content: msg.text,
      messageType: msg.type,
      timestamp: msg.timestamp,
      mediaUrl: mediaUrl,
    },
  });

  // 同时写 WAMessage 兼容现有会话列表/消息列表查询
  const waMsgId = `tg_${account.id}_${msg.messageId}_in`;
  const savedWa = await prisma.wAMessage.upsert({
    where: { waMessageId: waMsgId },
    update: { body: msg.text || `[${msg.type}]`, timestamp: msg.timestamp, read: false, mediaUrl: mediaUrl },
    create: {
      sessionId: tgSessionId,
      from: jid,
      to: 'me',
      body: msg.text || (msg.media ? `[${msg.media.kind || msg.type}]` : `[${msg.type}]`),
      type: msg.type === 'text' ? 'text' : msg.type,
      direction: 'inbound',
      timestamp: msg.timestamp,
      read: false,
      waMessageId: waMsgId,
      sourceLang: null,
      translation: null,
      mediaUrl: mediaUrl,
    },
  });

  // 异步翻译（复用现有翻译服务）
  try {
    const { getTranslationSettings } = await import("./translation.js");
    const { detectLanguage, translateText } = await import("../services/ai.service.js");
    translateInboundAsync(saved, jid, io, savedWa.id);
  } catch (e) {
    console.warn("[TG] translation import failed:", e.message);
  }

  // 自动建/更新客户档案（类似WA的upsertCustomer）
  try {
    const phone = jid.split('@')[0];
    let cust = await prisma.customer.findFirst({ where: { userId: account.userId, jid } });
    if (!cust) {
      cust = await prisma.customer.findFirst({ where: { userId: account.userId, phone } });
    }
    const now = new Date();
    const cname = (contact.name && contact.name.trim()) ? contact.name.trim() : phone;
    if (!cust) {
      await prisma.customer.create({
        data: { userId: account.userId, phone, jid, name: cname, source: "telegram", status: "potential", lastContactAt: now },
      });
    } else {
      const upd = { lastContactAt: now };
      if (contact.name && contact.name.trim() && (!cust.name || cust.name === cust.phone)) upd.name = contact.name.trim();
      if (!cust.jid) upd.jid = jid;

      await prisma.customer.update({ where: { id: cust.id }, data: upd });
    }
  } catch (e) {
    console.warn('[TG] upsertCustomer error:', e.message);
  }

  // socket 通知前端
  if (io) {
    io.emit("telegram:message", {
      accountId: account.id,
      contactId: contact.id,
      conversationId: conv.id,
      jid,
      message: {
        id: saved.id,
        fromMe: false,
        content: msg.text,
        messageType: msg.type,
        timestamp: msg.timestamp,
      mediaUrl: mediaUrl,
        platform: "telegram",
      },
      contact,
      conversation: conv,
    });
    // 兼容WA事件
    io.emit("whatsapp:message", {
      accountId: account.id,
      jid,
      message: { id: savedWa.id, body: msg.text, fromMe: false, timestamp: msg.timestamp, platform: "telegram", waMessageId: savedWa.waMessageId },
      mediaUrl: mediaUrl,
      contact,
      platform: "telegram",
    });
    io.emit("conversation:update", { accountId: account.id, conversation: conv });
  }
}

async function translateInboundAsync(saved, jid, io, waDbId) {
  try {
    const { getTranslationSettings } = await import("../routes/translation.js");
    const { detectLanguage, translateText } = await import("../services/ai.service.js");
    const body = (saved.content || "").trim();
    if (saved.messageType !== "text" || body.length < 1 || body.length > 2000) return;
    if (body.startsWith("[") && body.endsWith("]")) return;
    const settings = await getTranslationSettings(jid, saved.accountId || 1);
    if (!settings.receiveEnabled) return;
    const engine = settings.receiveEngine || "deepl";
    let sourceLang = settings.receiveSourceLang || "auto";
    const targetLang = settings.receiveTargetLang || "zh";
    if (sourceLang === "auto") sourceLang = await detectLanguage(body, engine);
    if (!sourceLang || sourceLang === "unknown") return;
    if (sourceLang === "zh" || sourceLang.startsWith("zh-")) return;
    const result = await translateText(body, sourceLang, targetLang, engine, saved.accountId || 1);
    const translated = (result && (result.translated || result.text)) || "";
    if (!translated) return;
    // 统一用对象结构（与WA一致）：original=原文外文, translated=中文译文
    const transObj = JSON.stringify({ original: body, translated, sourceLang, targetLang });
    await prisma.message.update({ where: { id: saved.id }, data: { translation: transObj, sourceLang } });
    if (waDbId) {
      await prisma.wAMessage.update({ where: { id: waDbId }, data: { translation: transObj, sourceLang } }).catch(() => {});
    }
    console.log(`[Translation][TG] inbound #${saved.id} ${sourceLang}->${targetLang}: "${body.slice(0,50)}" => "${translated.slice(0,50)}"`);
    if (io) {
      const translationPayload = { original: body, translated, sourceLang, targetLang };
      // 同时发两个事件兼容前端不同监听
      io.emit("telegram:translation", { id: saved.id, waId: waDbId, jid, translation: translationPayload, sourceLang });
      io.emit("whatsapp:translation", { id: waDbId || saved.id, jid, translation: translationPayload, sourceLang, platform: "telegram" });
    }
  } catch (e) {
    console.warn("[TG] translate async error:", e.message);
  }
}

export default router;
