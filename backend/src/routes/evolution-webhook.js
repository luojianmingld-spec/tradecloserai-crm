import express from "express";
import { PrismaClient } from "@prisma/client";
import { getEvolutionConnector } from "../services/evolution-connector.js";
import { recordLidMapping, resolveToPhoneJid } from "../services/lid-mapping.js";
import { detectLanguage, translateText, transcribeAudio } from "../services/ai.service.js";
import { getTranslationSettings } from "./translation.js";
import { autoFillCustomer, autoBackgroundCheck } from "./customers.js";
import { inferCountry } from "../utils/phone-country.js";
import autoReceptionService from "../services/auto-reception.service.js";
import { notifyBoss, buildInquiryNotify } from "../services/wechat-boss-notify.service.js";

const router = express.Router();
const prisma = new PrismaClient();

const DEFAULT_SESSION_ID = "user_1";

// instanceName → sessionId 内存缓存，避免每条消息重复查库
const SESSION_ID_CACHE = new Map();

/**
 * Map Evolution API instanceName to CRM sessionId（治本：动态解析）
 * - jeremy-eric（历史数据）→ user_2（特例保留，兼容既有消息）
 * - 其余实例按 WhatsAppAccount.id 解析为 user_{accountId}（与 WAConnection 落库规则一致）
 * - 查不到账号时兜底 user_1
 */
async function instanceToSessionId(instanceName) {
  if (instanceName === "jeremy-eric") return "user_2";
  if (SESSION_ID_CACHE.has(instanceName)) return SESSION_ID_CACHE.get(instanceName);
  try {
    const acc = await prisma.whatsAppAccount.findFirst({
      where: { platform: "whatsapp", instanceName },
      select: { id: true },
    });
    if (acc) {
      const sid = "user_" + acc.id;
      SESSION_ID_CACHE.set(instanceName, sid);
      return sid;
    }
  } catch (e) {
    console.warn("[Webhook] instanceToSessionId resolve error:", e.message);
  }
  return "user_1"; // default fallback
}


function jidToPhone(jid) {
  return (jid || "").split("@")[0];
}
function isGroup(jid) {
  return (jid || "").includes("@g.us");
}

/**
 * 根据 instanceName 查找对应的 WhatsAppAccount 记录
 * @returns {Promise<{accountId: number, account: object}|null>}
 */
async function resolveAccountByInstance(instanceName) {
  try {
    const account = await prisma.whatsAppAccount.findFirst({
      where: { platform: "whatsapp", instanceName },
    });
    if (account) return { accountId: account.id, account };
    return null;
  } catch (e) {
    console.warn("[Webhook] resolveAccountByInstance error:", e.message);
    return null;
  }
}


/**
 * 异步翻译入站消息（不阻塞推送）
 * - 接收翻译开启 且 文本类型 且 长度 1-2000
 * - 检测语言，若非中文则翻译为中文
 * - 更新 DB 的 translation / sourceLang
 * - socket 广播 whatsapp:translation 事件
 */
async function translateInboundAsync(saved, convJid, io) {
  try {
    if (!saved || !saved.id) return;
    // 只处理入站（对方发来的），不要重复处理出站译文
    if (saved.direction === "outbound") return;

    let body = (saved.body || "").trim();

    // ── 语音消息：先转录再翻译 ──
    if ((saved.type === "audio" || saved.type === "MessageMediaAudio") && saved.mediaUrl) {
      try {
        console.log(`[Translation] Voice message #${saved.id}, transcribing...`);
        const fs = await import('fs');
        const pathMod = await import('path');
        const https = await import('https');
        const http = await import('http');
        const { URL: URLCls } = await import('url');
        const { execSync } = await import('child_process');

        const tmpDir = '/tmp/crm-audio';
        if (!fs.default.existsSync(tmpDir)) fs.default.mkdirSync(tmpDir, { recursive: true });
        const tmpFile = pathMod.default.join(tmpDir, `voice_${saved.id}.ogg`);
        const wavFile = pathMod.default.join(tmpDir, `voice_${saved.id}.wav`);

        // Download audio
        await new Promise((resolve, reject) => {
          const urlObj = new URLCls(saved.mediaUrl);
          const lib = urlObj.protocol === 'https:' ? https.default : http.default;
          const ws = fs.default.createWriteStream(tmpFile);
          lib.get(saved.mediaUrl, (res) => {
            if (res.statusCode !== 200) { reject(new Error('HTTP ' + res.statusCode)); res.resume(); return; }
            res.pipe(ws);
            ws.on('finish', () => { ws.close(); resolve(); });
          }).on('error', (e) => { try { fs.default.unlinkSync(tmpFile); } catch{} reject(e); });
        });

        // Convert to WAV for Whisper
        try {
          execSync(`ffmpeg -y -i "${tmpFile}" -ar 16000 -ac 1 -f wav "${wavFile}" 2>/dev/null`, { timeout: 15000 });
        } catch (e) {
          console.warn('[Translation] ffmpeg failed, using raw file');
        }

        const audioFile = fs.default.existsSync(wavFile) ? wavFile : tmpFile;
        const transcribed = await transcribeAudio(audioFile);

        if (transcribed && transcribed.length > 0) {
          body = transcribed;
          // Update DB with transcription
          await prisma.wAMessage.update({
            where: { id: saved.id },
            data: { body: transcribed },
          });
          if (io) {
            io.emit("whatsapp:transcription", {
              id: saved.id, waMessageId: saved.waMessageId, jid: convJid,
              transcription: transcribed,
            });
          }
          console.log(`[Translation] Voice #${saved.id} transcribed: "${transcribed.slice(0, 50)}"`);
        }

        // Cleanup
        try { fs.default.unlinkSync(tmpFile); } catch {}
        try { fs.default.unlinkSync(wavFile); } catch {}
      } catch (transErr) {
        console.warn(`[Translation] Voice #${saved.id} transcription failed:`, transErr.message);
        if (!body || body === "[语音]" || body.startsWith("[") && body.endsWith("]")) return;
      }
    }

    // Skip non-text and placeholder messages
    if (saved.type !== "text" && saved.type !== "audio" && saved.type !== "MessageMediaAudio") return;
    if (body.length < 1 || body.length > 2000) return;
    if (body.startsWith("[") && body.endsWith("]")) return;

    const settings = await getTranslationSettings(convJid, 1);
    if (!settings.receiveEnabled) return;

    const engine = settings.receiveEngine || "deepl";
    let sourceLang = settings.receiveSourceLang || "auto";
    const targetLang = settings.receiveTargetLang || "zh";

    if (sourceLang === "auto") {
      sourceLang = await detectLanguage(body, engine);
    }
    if (!sourceLang || sourceLang === "unknown") return;
    // 源语言即中文则无需翻译
    if (sourceLang === "zh" || sourceLang.startsWith("zh-")) return;

    const result = await translateText(body, sourceLang, targetLang, engine, 1);
    const translated = (result && (result.translated || result.text)) || "";
    if (!translated) return;

    // 统一用对象结构：original=原文外文, translated=中文译文
    const transObj = JSON.stringify({ original: body, translated, sourceLang, targetLang });
    await prisma.wAMessage.update({
      where: { id: saved.id },
      data: { translation: transObj, sourceLang },
    });

    if (io) {
      io.emit("whatsapp:translation", {
        id: saved.id,
        waMessageId: saved.waMessageId,
        jid: convJid,
        translation: { original: body, translated, sourceLang, targetLang },
        sourceLang,
      });
      // 兼容旧事件名
      io.emit("whatsapp:message_translated", {
        id: saved.id,
        waMessageId: saved.waMessageId,
        jid: convJid,
        translation: { original: body, translated, sourceLang, targetLang },
        sourceLang,
      });
    }
    console.log(`[Translation] inbound #${saved.id} ${sourceLang}->zh: "${body.slice(0,30)}" => "${translated.slice(0,30)}"`);
  } catch (e) {
    // 静默失败，不影响消息收发
    console.warn("[Translation] inbound async error:", e.message);
  }
}



/**
 * 异步翻译出站消息（外部发送同步回来的）
 * - 仅处理方向为 outbound 且没有 translation 的文本消息
 * - 检测语言，若非中文则翻译为中文
 */
async function translateOutboundAsync(saved, convJid, io) {
  try {
    if (!saved || !saved.id) return;
    if (saved.direction !== "outbound") return;
    // 已有译文则跳过
    if (saved.translation) return;
    // 只处理文本消息
    if (!['text', 'extendedTextMessage'].includes(saved.type) && !saved.body) return;
    
    let body = (saved.body || "").trim();
    if (!body || body.length < 2 || body.length > 2000) return;
    
    // 已经是中文则不翻译
    const chineseRatio = (body.match(/[\u4e00-\u9fff]/g) || []).length / body.length;
    if (chineseRatio > 0.5) return;
    
    const settings = await getTranslationSettings(convJid, 1);
    if (!settings || !settings.sendEnabled) return;
    
    const targetLang = "zh";
    const engine = settings.sendEngine || settings.receiveEngine || "deepl";
    
    let sourceLang = saved.sourceLang || null;
    if (!sourceLang) {
      try {
        sourceLang = await detectLanguage(body);
      } catch(_) {}
    }
    if (!sourceLang || sourceLang === "zh" || sourceLang === targetLang) return;
    
    const result = await translateText(body, sourceLang, targetLang, engine, 1);
    const translated = (result && (result.translated || result.text)) || "";
    if (!translated) return;
    
    const transObj = JSON.stringify({ original: body, translated, sourceLang, targetLang });
    await prisma.wAMessage.update({
      where: { id: saved.id },
      data: { translation: transObj, sourceLang },
    });
    
    if (io) {
      io.emit("whatsapp:translation", {
        id: saved.id,
        jid: convJid,
        translation: { original: body, translated, sourceLang, targetLang },
      });
      io.emit("whatsapp:message_translated", {
        id: saved.id,
        jid: convJid,
        translation: { original: body, translated, sourceLang, targetLang },
      });
    }
    
    console.log(`[Translation] outbound #${saved.id} ${sourceLang}->zh: "${body.slice(0,30)}" => "${translated.slice(0,30)}"`);
  } catch (e) {
    console.warn("[Translation] outbound async error:", e.message);
  }
}

/**
 * 把 @lid 临时ID解析成真实JID（WhatsApp对部分号段先用匿名lid投递）
 * Evolution在 key.remoteJidAlt 里给出真实的 @s.whatsapp.net JID
 * 治本（2026-08-26）：alt 缺失且映射未命中时，用 pushName 在同账号真实号码 Contact 中
 * 兜底匹配，命中则补写映射并复用，防止同一联系人被拆成两个客户。
 */
async function resolveRealJid(msg, fallbackJid, accountId) {
  const key = msg?.key || {};
  const alt = key.remoteJidAlt;
  const rawJid = key.remoteJid || fallbackJid;
  const pushName = msg?.pushName || "";
  if (rawJid && rawJid.includes("@lid") && alt && alt.includes("@s.whatsapp.net")) {
    const baseLid = rawJid.split(":")[0] + "@lid";
    recordLidMapping(alt, baseLid);
  }
  if (alt && alt.includes("@s.whatsapp.net")) return alt;
  if (rawJid && rawJid.includes("@lid")) {
    const resolved = resolveToPhoneJid(rawJid);
    if (resolved && resolved.includes("@s.whatsapp.net")) return resolved;
    // 兜底：同账号已有同名真实号码 Contact → 复用并补写映射
    const baseLid = rawJid.split(":")[0] + "@lid";
    if (pushName && pushName.trim() && accountId) {
      try {
        const match = await prisma.contact.findFirst({
          where: {
            accountId,
            platform: "whatsapp",
            pushName: String(pushName).trim(),
            jid: { contains: "@s.whatsapp.net" },
          },
          orderBy: { updatedAt: "desc" },
        });
        if (match && match.jid) {
          console.log(`[LIDMap] fallback matched ${baseLid} -> ${match.jid} by pushName="${pushName}"`);
          recordLidMapping(match.jid, baseLid);
          return match.jid;
        }
      } catch (e) {
        console.warn("[Webhook] resolveRealJid fallback error:", e.message);
      }
    }
  }
  return fallbackJid;
}

function _findMediaContainer(m) {
  // Evolution v2 sometimes nests media in *WithCaptionMessage containers.
  // Return { container: <media field object>, kind: 'image'|'document'|'video'|'audio', wrapperKey: topKey }
  const kindMap = {
    imageMessage: 'image',
    documentMessage: 'document',
    videoMessage: 'video',
    audioMessage: 'audio',
    stickerMessage: 'sticker',
  };
  // direct
  for (const k of Object.keys(kindMap)) {
    if (m[k] && typeof m[k] === 'object') return { container: m[k], kind: kindMap[k], wrapperKey: null };
  }
  // nested under *WithCaptionMessage (e.g. imageWithCaptionMessage.imageMessage)
  for (const topKey of Object.keys(m)) {
    const top = m[topKey];
    if (!top || typeof top !== 'object') continue;
    for (const k of Object.keys(kindMap)) {
      if (top[k] && typeof top[k] === 'object') {
        return { container: { ...top[k], caption: top[k].caption || top.caption || null }, kind: kindMap[k], wrapperKey: topKey };
      }
    }
  }
  return null;
}

// bytes/base64 归一化：webhook 有时给 Buffer/Object({0:byte,...})，有时给 base64 字符串
function _toB64(v) {
  if (v == null) return null;
  if (typeof v === 'string') return v; // already base64
  if (Buffer.isBuffer(v)) return v.toString('base64');
  if (v instanceof Uint8Array || ArrayBuffer.isView(v)) return Buffer.from(v.buffer, v.byteOffset, v.byteLength).toString('base64');
  if (typeof v === 'object') {
    // {0:byte,1:byte,...}
    const arr = Object.keys(v).filter(k => /^\d+$/.test(k)).map(k => v[k]).filter(n => Number.isInteger(n) && n>=0 && n<=255);
    if (arr.length > 0) return Buffer.from(arr).toString('base64');
  }
  return null;
}

// 从 media container 提取解密所需字段，统一成 { mediaKey, directPath, mediaUrl(enc), fileEncSha256, fileSha256, fileLength, mimeType, fileName }
function _extractMediaMeta(container) {
  if (!container || typeof container !== 'object') return null;
  const flRaw = container.fileLength;
  let fileLength = null;
  if (typeof flRaw === 'number') fileLength = flRaw;
  else if (flRaw && typeof flRaw === 'object') {
    // Baileys/Evolution style: {low, high, unsigned}
    const low = typeof flRaw.low === 'number' ? flRaw.low : 0;
    const high = typeof flRaw.high === 'number' ? flRaw.high : 0;
    fileLength = (high * 0x100000000) + low;
    if (fileLength < 0) fileLength = low; // fall back to low for signed high
  }
  return {
    mediaKey: _toB64(container.mediaKey),
    directPath: typeof container.directPath === 'string' ? container.directPath : null,
    mediaEncUrl: typeof container.url === 'string' ? container.url : null,
    fileEncSha256: _toB64(container.fileEncSha256),
    fileSha256: _toB64(container.fileSha256),
    fileLength: Number.isFinite(fileLength) ? fileLength : null,
    mimeType: typeof container.mimetype === 'string' ? container.mimetype : null,
    fileName: typeof container.fileName === 'string' ? container.fileName : null,
  };
}
function extractBody(msg) {
  const m = msg.message || {};
  const t = msg.messageType;
  // DEBUG: log raw message structure when image/media detected
  if (t && (t.toLowerCase().includes('image') || t.toLowerCase().includes('video') || t.toLowerCase().includes('media'))) {
    console.log('[DEBUG-IMG] ====== RAW MESSAGE DUMP ======');
    console.log('[DEBUG-IMG] msg keys:', Object.keys(msg).join(','));
    console.log('[DEBUG-IMG] msg.message keys:', Object.keys(m).join(','));
    console.log('[DEBUG-IMG] messageType:', t);
    // Print first level of m values types
    for (const k of Object.keys(m)) {
      const v = m[k];
      if (v && typeof v === 'object') {
        console.log('[DEBUG-IMG] m.' + k + ' keys:', Object.keys(v).join(','));
      } else {
        console.log('[DEBUG-IMG] m.' + k + ':', typeof v, String(v).substring(0,50));
      }
    }
  }

  // text
  if (m.conversation) return { body: m.conversation, type: "text" };
  if (m.extendedTextMessage) return { body: m.extendedTextMessage.text || "", type: "text" };

  // unified media container lookup (handles caption-nested forms)
  const media = _findMediaContainer(m);
  if (media) {
    // DEBUG: print exact media container for image
    if (media.kind === 'image') {
      const c = media.container;
      const keys = Object.keys(c);
      console.log('[DEBUG-IMG] container keys:', JSON.stringify(keys));
      console.log('[DEBUG-IMG] url:', typeof c.url, JSON.stringify(c.url ? String(c.url).substring(0,80) : null));
      console.log('[DEBUG-IMG] directPath:', typeof c.directPath, JSON.stringify(c.directPath ? String(c.directPath).substring(0,80) : null));
      console.log('[DEBUG-IMG] mediaKey:', typeof c.mediaKey, c.mediaKey ? (typeof c.mediaKey === 'string' ? c.mediaKey.substring(0,20) : 'object/' + typeof c.mediaKey) : 'NULL');
      console.log('[DEBUG-IMG] mimetype:', c.mimetype);
      console.log('[DEBUG-IMG] fileLength:', typeof c.fileLength, JSON.stringify(c.fileLength));
    }
    const meta = _extractMediaMeta(media.container);
    // 默认 mediaUrl: 出站消息使用 container.url（已下载过或可明文访问）；入站加密消息仍存url，
    // 但因为同时保存 mediaKey/directPath，媒体代理会走 Evolution 解密接口
    const mediaUrl = meta && meta.mediaEncUrl ? meta.mediaEncUrl : (media.container.url || media.container.directPath || null);
    if (media.kind === 'image') {
      return {
        body: media.container.caption || "[图片]", type: "image", mediaUrl,
        mimeType: meta?.mimeType || "image/jpeg", fileName: meta?.fileName || null,
        mediaKey: meta?.mediaKey || null, directPath: meta?.directPath || null,
        fileEncSha256: meta?.fileEncSha256 || null, fileSha256: meta?.fileSha256 || null,
        fileLength: meta?.fileLength || null,
      };
    }
    if (media.kind === 'video') {
      return {
        body: media.container.caption || "[视频]", type: "video", mediaUrl,
        mimeType: meta?.mimeType || null, fileName: meta?.fileName || null,
        mediaKey: meta?.mediaKey || null, directPath: meta?.directPath || null,
        fileEncSha256: meta?.fileEncSha256 || null, fileSha256: meta?.fileSha256 || null,
        fileLength: meta?.fileLength || null,
      };
    }
    if (media.kind === 'audio') {
      return {
        body: "[语音]", type: "audio", mediaUrl,
        mimeType: meta?.mimeType || null,
        mediaKey: meta?.mediaKey || null, directPath: meta?.directPath || null,
        fileEncSha256: meta?.fileEncSha256 || null, fileSha256: meta?.fileSha256 || null,
        fileLength: meta?.fileLength || null,
      };
    }
    if (media.kind === 'document') {
      return {
        body: media.container.caption || meta?.fileName || "[文件]", type: "document",
        fileName: meta?.fileName || "file", mediaUrl,
        mimeType: meta?.mimeType || "application/octet-stream",
        mediaKey: meta?.mediaKey || null, directPath: meta?.directPath || null,
        fileEncSha256: meta?.fileEncSha256 || null, fileSha256: meta?.fileSha256 || null,
        fileLength: meta?.fileLength || null,
      };
    }
    if (media.kind === 'sticker') return { body: "[贴纸]", type: "sticker" };
  }
  // reaction (回应表情)
  if (m.reactionMessage) {
    const rText = m.reactionMessage.text || '';
    // reaction.key 指向被回应的消息，我们只需存 emoji 本身
    return { body: rText || "👍", type: "reaction" };
  }
  // lottie sticker (animated sticker, 含 lottieStickerMessage)
  if (m.stickerMessage && m.stickerMessage.isAnimated) return { body: "[动态贴纸]", type: "sticker" };
  if (m.lottieStickerMessage) return { body: "[动态贴纸]", type: "sticker" };
  if (m.locationMessage) return { body: `[位置] ${m.locationMessage.degreesLatitude || ""},${m.locationMessage.degreesLongitude || ""}`, type: "location" };
  if (m.contactsArrayMessage) return { body: "[联系人卡片]", type: "contacts" };
  // albumMessage / associatedChildMessage: multi-image send, treat as image placeholder
  if (t === "albumMessage" || t === "associatedChildMessage") {
    return { body: "[图片]", type: "image" };
  }
  return { body: `[${t || "unknown"}]`, type: t || "unknown" };
}

function evoTsToDate(ts) {
  if (!ts) return new Date().toISOString();
  const n = typeof ts === "object" ? ts.low : Number(ts);
  return new Date(n > 1e12 ? n : n * 1000).toISOString();
}

async function ensureWAConnection(sessionId, phone) {
  let conn = await prisma.wAConnection.findUnique({ where: { sessionId } });
  if (!conn) {
    conn = await prisma.wAConnection.create({ data: { sessionId, userId: 1, phone: phone || null, status: "connected" } });
  } else if (conn.status !== "connected") {
    await prisma.wAConnection.update({ where: { id: conn.id }, data: { status: "connected" } });
  }
  return conn;
}

/** 登录成功后主动同步 Evolution 联系人到 Contact/Customer 表，并回写账号自身昵称/头像
 *  @returns {Promise<number>} 本次处理到的联系人数量（0 表示未拉到通讯录，可用于重试判断）
 */
async function syncContactsFromEvolution(instanceName, ownerJid) {
  try {
    const account = await prisma.whatsAppAccount.findFirst({
      where: { instanceName, platform: "whatsapp" },
      select: { id: true, userId: true },
    });
    if (!account) return 0;
    const connector = getEvolutionConnector(instanceName);
    const contacts = await connector.fetchContacts();
    if (!Array.isArray(contacts) || !contacts.length) return 0;

    // 批量拉取已有联系人，按 jid 建索引，避免逐条 findUnique
    const existingContacts = await prisma.contact.findMany({
      where: { accountId: account.id, platform: "whatsapp" },
      select: { id: true, jid: true, pushName: true, avatarUrl: true, phone: true },
    });
    const existingMap = new Map(existingContacts.map((c) => [c.jid, c]));

    let synced = 0;
    const ops = [];
    for (const c of contacts) {
      const jid = (c.remoteJid || c.jid || "").trim();
      if (!jid || !jid.includes("@")) continue;
      if (jid.startsWith("0@") || jid === "status@broadcast" || jid.includes("@g.us") || /^(undefined|null|NaN)@/i.test(jid)) continue;
      const pushName = (c.pushName || c.name || "").trim();
      const avatarUrl = c.profilePicUrl || c.profilePic || null;
      const phone = jid.split("@")[0];
      const existing = existingMap.get(jid);
      if (existing) {
        const upd = {};
        if (pushName && pushName !== existing.pushName) upd.pushName = pushName;
        if (avatarUrl && avatarUrl !== existing.avatarUrl) upd.avatarUrl = avatarUrl;
        if (phone && !existing.phone) upd.phone = phone;
        if (Object.keys(upd).length) {
          ops.push(prisma.contact.update({ where: { id: existing.id }, data: upd }));
        }
      } else {
        ops.push(prisma.contact.create({
          data: { accountId: account.id, platform: "whatsapp", jid, phone, pushName: pushName || null, name: pushName || null, avatarUrl: avatarUrl || null },
        }));
      }
      synced++;
    }
    // 事务批量写入，显著加快（98 联系人从 ~30s 降到 <2s）
    if (ops.length) {
      await prisma.$transaction(ops).catch(() => { /* 单批失败不阻断整体 */ });
    }
    // 回写账号自身昵称/头像（联系人中 ownerJid 对应条目）
    if (ownerJid) {
      const self = contacts.find((c) => (c.remoteJid || "").trim() === ownerJid);
      if (self && (self.pushName || self.profilePicUrl)) {
        await prisma.whatsAppAccount.updateMany({
          where: { instanceName, platform: "whatsapp" },
          data: { pushName: self.pushName ? String(self.pushName).trim() : undefined, avatarUrl: self.profilePicUrl || undefined },
        });
      }
    }
    console.log(`[WA Sync] ${instanceName} synced ${synced} contacts`);
    return synced;
  } catch (e) {
    console.warn("[WA Sync] syncContactsFromEvolution error:", e.message);
    return 0;
  }
}

/**
 * 登录成功后带重试的联系人同步。
 * Evolution 刚连接时通讯录可能尚未就绪（findContacts 返回空），直接同步会永久漏掉。
 * 这里在连接 open 后轮询重试，直到拉到通讯录并回写成功。
 */
async function syncContactsFromEvolutionWithRetry(instanceName, ownerJid, maxAttempts = 6, delayMs = 4000) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const n = await syncContactsFromEvolution(instanceName, ownerJid);
      if (n > 0) return n;
    } catch (e) {
      console.warn(`[WA Sync] retry ${attempt}/${maxAttempts} ${instanceName} error:`, e.message);
    }
    if (attempt < maxAttempts) {
      console.log(`[WA Sync] ${instanceName} contacts not ready (attempt ${attempt}/${maxAttempts}), retry in ${delayMs / 1000}s`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  return 0;
}

// 每个实例最近一次按需同步的时间（节流）
const LAST_ONDEMAND_SYNC = new Map();
const ONDEMAND_SYNC_COOLDOWN = 60 * 1000; // 60s 冷却

/**
 * 按需触发联系人同步（节流）：当实例的联系人仍缺 pushName/avatarUrl 时才真正去拉取，
 * 避免列表接口每次请求都打 Evolution。由会话列表接口/入站消息触发。
 */
async function maybeSyncContactsOnDemand(instanceName, ownerJid) {
  if (!instanceName) return;
  const now = Date.now();
  if (LAST_ONDEMAND_SYNC.has(instanceName) && now - LAST_ONDEMAND_SYNC.get(instanceName) < ONDEMAND_SYNC_COOLDOWN) return;
  LAST_ONDEMAND_SYNC.set(instanceName, now);
  try {
    const account = await prisma.whatsAppAccount.findFirst({
      where: { instanceName, platform: "whatsapp" },
      select: { id: true },
    });
    if (!account) return;
    // 若该实例已无缺名字/头像的联系人，说明已同步过，跳过
    const missingCount = await prisma.contact.count({
      where: { accountId: account.id, platform: "whatsapp", OR: [{ pushName: null }, { pushName: "" }, { avatarUrl: null }, { avatarUrl: "" }] },
    });
    if (!missingCount) return;
    await syncContactsFromEvolution(instanceName, ownerJid);
  } catch (e) {
    console.warn("[WA Sync] maybeSyncContactsOnDemand error:", e.message);
  }
}

// 周期同步定时器句柄
let _contactSyncTimer = null;
const CONTACT_SYNC_INTERVAL = 5 * 60 * 1000; // 每 5 分钟

/** 周期同步所有已连接 WhatsApp 实例的联系人（保持 pushName/avatarUrl 新鲜） */
async function periodicContactSync() {
  try {
    const accounts = await prisma.whatsAppAccount.findMany({
      where: { platform: "whatsapp", status: "connected", instanceName: { not: null } },
      select: { instanceName: true },
    });
    for (const acc of accounts) {
      syncContactsFromEvolution(acc.instanceName, null).catch((e) => console.warn("[WA Sync] periodic sync error:", e.message));
    }
  } catch (e) {
    console.warn("[WA Sync] periodicContactSync error:", e.message);
  }
}

/** 启动周期联系人同步（在 server 启动时调用一次） */
export function startContactSyncScheduler() {
  if (_contactSyncTimer) return;
  _contactSyncTimer = setInterval(periodicContactSync, CONTACT_SYNC_INTERVAL);
  _contactSyncTimer.unref?.();
  console.log("[WA Sync] contact sync scheduler started (interval 5min)");
}

/** 供 server 端会话列表接口按需触发（节流） */
export { maybeSyncContactsOnDemand, syncContactsFromEvolution, syncContactsFromEvolutionWithRetry };

/** 入站消息时同步 pushName 到 Contact 表（修复会话列表名字缺失） */
async function syncContactPushName(accountId, jid, pushName) {
  if (!jid || !accountId || !pushName || !String(pushName).trim()) return;
  try {
    const platform = jid.includes("@telegram") ? "telegram" : "whatsapp";
    const cwhere = { accountId_platform_jid: { accountId, platform, jid } };
    const contact = await prisma.contact.findUnique({ where: cwhere });
    if (contact) {
      if (!contact.pushName || contact.pushName !== String(pushName).trim()) {
        await prisma.contact.update({ where: { id: contact.id }, data: { pushName: String(pushName).trim() } });
      }
    } else {
      const phone = jid.split("@")[0];
      await prisma.contact.create({
        data: { accountId, platform, jid, phone: platform === "whatsapp" ? phone : null, pushName: String(pushName).trim() },
      }).catch(() => {});
    }
  } catch (e) {
    console.warn("[Webhook] syncContactPushName error:", e.message);
  }
}

async function upsertCustomer(phone, pushName, jid, userId) {
  if (!phone || phone.length < 5) return null;
  // 过滤无效 jid（'undefined'/'null' 等字符串，防止脏数据）
  if (jid && /^(undefined|null|NaN)$/i.test(String(jid).split('@')[0] || '')) jid = null;
  const ownerUserId = Number(userId) || 1;
  let created = false;
  try {
    // 先按jid精确查（有jid传过来时）
    let cust = null;
    if (jid) {
      cust = await prisma.customer.findFirst({ where: { userId: ownerUserId, jid } });
    }
    // 再按phone查
    if (!cust) {
      cust = await prisma.customer.findFirst({ where: { userId: ownerUserId, phone } });
    }
    const name = pushName && pushName.trim() ? pushName.trim() : phone;
    const now = new Date();
    if (!cust) {
      cust = await prisma.customer.create({
        data: { userId: ownerUserId, phone, jid: jid || null, name, source: "whatsapp", status: "potential", lastContactAt: now, country: inferCountry(phone) },
      });
      created = true;
    } else {
      const updateData = { lastContactAt: now };
      if (pushName && pushName.trim() && (cust.name === cust.phone || !cust.name)) {
        updateData.name = pushName.trim();
      }
      // 补全缺失的jid / phone
      if (jid && !cust.jid) updateData.jid = jid;
      if (phone && !cust.phone) updateData.phone = phone;
      if (!cust.country) updateData.country = inferCountry(phone);
      await prisma.customer.update({ where: { id: cust.id }, data: updateData });
    }
    return { cust, isNew: created };
  } catch (e) {
    console.warn("[Webhook] upsertCustomer error:", e.message);
    return null;
  }
}

async function processOneMessage(instanceName, msg, fromMe, rawRemoteJid, ownerJid, io) {
  if (!rawRemoteJid) return null;
  // 动态解析 accountId
  const accountInfo = await resolveAccountByInstance(instanceName);
  const accountId = accountInfo ? accountInfo.accountId : 1;
  if (isGroup(rawRemoteJid)) return null;
  if (rawRemoteJid === "status@broadcast") return null;
  if (fromMe && rawRemoteJid === ownerJid) return null;

  const remoteJid = await resolveRealJid(msg, rawRemoteJid, accountId);
  if (!remoteJid || remoteJid === ownerJid) return null;
  // Skip cross-instance messages: if fromMe and remoteJid phone matches another WA account, skip
  // Also skip if !fromMe and the "to" (ownerJid) phone matches a different WA account than this instance
  const ownerPhone = jidToPhone(ownerJid);
  if (ownerPhone && ownerPhone.length >= 5) {
    try {
      const myAcc = await prisma.whatsAppAccount.findFirst({
        where: { platform: "whatsapp", id: accountId },
        select: { id: true, phone: true },
      });
      if (myAcc && myAcc.phone && myAcc.phone !== ownerPhone) {
        // This message is actually for a different account, skip
        return null;
      }
    } catch(_e) {}
  }
  // 过滤无效jid（如 0@s.whatsapp.net 系统/协议消息），必须在 resolveRealJid 之后
  const _phone = remoteJid.split('@')[0];
  if (!_phone || _phone === '0' || _phone.length < 5 || !/^\d+$/.test(_phone)) {
    return null;
  }

  // 封锁检查：inbound时如果该联系人被blocked，直接丢弃（不入库、不推送）
  if (!fromMe) {
    try {
      const _conv = await prisma.conversation.findUnique({
        where: { accountId_platform_jid: { accountId, platform: "whatsapp", jid: remoteJid } },
        select: { blocked: true },
      });
      if (_conv && _conv.blocked) {
        console.log("[Webhook] blocked inbound from:", remoteJid);
        return null;
      }
    } catch(_e) { /* ignore */ }
  }

  const extracted = extractBody(msg);
  const { body, type, mediaUrl, fileName, mimeType, mediaKey, directPath, fileEncSha256, fileSha256, fileLength } = extracted;
  if (!body || body === "[unknown]") return null;
  const pushName = msg.pushName || "";
  const timestamp = evoTsToDate(msg.messageTimestamp);
  const waMessageId = (msg.key || {}).id || null;
  if (!waMessageId) return null;
  const waKeyObj = msg.key || null;
  // 只保留解密需要的key字段，避免存太多无用信息
  const waKeyJson = waKeyObj ? JSON.stringify({
    id: waKeyObj.id || null,
    fromMe: !!waKeyObj.fromMe,
    remoteJid: waKeyObj.remoteJid || null,
    participant: waKeyObj.participant || null,
  }) : null;
  let waMsgTimestamp = null;
  if (typeof msg.messageTimestamp === 'number') waMsgTimestamp = msg.messageTimestamp;
  else if (msg.messageTimestamp && typeof msg.messageTimestamp === 'object' && typeof msg.messageTimestamp.low === 'number') {
    waMsgTimestamp = msg.messageTimestamp.low;
  }

  const mePhone = jidToPhone(ownerJid);
  const from = fromMe ? ownerJid : remoteJid;
  const to = fromMe ? remoteJid : ownerJid;
  const direction = fromMe ? "outbound" : "inbound";
  const convJid = remoteJid;

  await ensureWAConnection(await instanceToSessionId(instanceName), mePhone);

  let saved, duplicate = false;
  try {
    // 用create+catch唯一冲突来避免并发竞态导致重复
    try {
      saved = await prisma.wAMessage.create({
        data: {
          sessionId: await instanceToSessionId(instanceName), from, to, body: body || "", type: type || "text", direction,
          timestamp, waMessageId,
          mediaUrl: mediaUrl || null, fileName: fileName || null, mimeType: mimeType || null,
          mediaKey: mediaKey || null,
          mediaDirectPath: directPath || null,
          mediaEncSha256: fileEncSha256 || null,
          mediaSha256: fileSha256 || null,
          fileLength: Number.isFinite(fileLength) ? fileLength : null,
          waKeyJson: waKeyJson || null,
          waMsgTimestamp: waMsgTimestamp || null,
        },
      });
    } catch (createErr) {
      // 唯一冲突（P2002）= 已被其他并发webhook创建，查询复用
      const exists = await prisma.wAMessage.findFirst({ where: { waMessageId } });
      if (exists) {
        saved = exists; duplicate = true;
        // 出站媒体消息：REST端先存了一条 mediaUrl=null 的乐观记录，webhook 回环带回真实URL/解密参数，需要补填
        if (fromMe && ['image','video','audio','document'].includes(type) && !exists.mediaUrl && mediaUrl) {
          try {
            const updData = { mediaUrl };
            if (fileName && !exists.fileName) updData.fileName = fileName;
            if (mimeType && !exists.mimeType) updData.mimeType = mimeType;
            if (directPath && !exists.mediaDirectPath) updData.mediaDirectPath = directPath;
            if (mediaKey && !exists.mediaKey) updData.mediaKey = mediaKey;
            if (fileEncSha256 && !exists.mediaEncSha256) updData.mediaEncSha256 = fileEncSha256;
            if (fileSha256 && !exists.mediaSha256) updData.mediaSha256 = fileSha256;
            if (Number.isFinite(fileLength) && !exists.fileLength) updData.fileLength = fileLength;
            saved = await prisma.wAMessage.update({ where: { id: exists.id }, data: updData });
            console.log(`[Webhook] outbound media fields backfilled id=${exists.id} type=${type}`);
            // 推送更新给前端，让视频/图片从placeholder变成真实媒体
            if (io) {
              io.emit("whatsapp:message_update", {
                id: exists.id, waMessageId: exists.waMessageId, jid: convJid,
                mediaUrl: saved.mediaUrl || mediaUrl,
                fileName: saved.fileName || fileName,
                mimeType: saved.mimeType || mimeType,
              });
            }
          } catch (updErr) {
            console.warn("[Webhook] backfill mediaUrl failed:", updErr.message);
          }
        }
      }
      else { console.warn("[Webhook] saveMessage error:", createErr.message); return null; }
    }
  } catch (e) {
    console.warn("[Webhook] saveMessage outer error:", e.message);
    return null;
  }

  // 双向沟通：入站或出站消息都触发自动建档（客户管理），排除群聊/广播/状态
  if (remoteJid && !remoteJid.includes("@g.us") && !remoteJid.startsWith("status@") && !remoteJid.startsWith("broadcast") && !/^0@/.test(remoteJid)) {
    const phone = jidToPhone(remoteJid);
    const ownerInfo = await resolveAccountByInstance(instanceName);
    const upsertRes = await upsertCustomer(phone, pushName, remoteJid, ownerInfo?.account?.userId);
    // 【新询盘通知】首次建档的新客户 + 入站消息 → 推送给老板微信（异步不阻塞）
    if (upsertRes && upsertRes.isNew && direction === 'inbound' && !duplicate) {
      notifyBoss(buildInquiryNotify({
        name: upsertRes.cust?.name || pushName || phone,
        phone,
        body,
        ts: timestamp,
      })).catch((e) => console.warn('[BossNotify] 新询盘通知异常:', e.message));
    }
    if (ownerInfo) {
      syncContactPushName(ownerInfo.accountId, remoteJid, pushName);
      // 入站消息触发按需同步（节流）：补全该实例其它联系人 pushName/avatarUrl
      maybeSyncContactsOnDemand(instanceName, ownerJid).catch(() => {});
    }
  }

  if (direction === "inbound") {
    // 解析归属 User.id（注意：不能用 WhatsAppAccount.id 当 userId，Customer.userId 存的是 User.id）
    const _ownerInfo = await resolveAccountByInstance(instanceName);
    const _ownerUid = _ownerInfo?.account?.userId || 1;
    // AI 自动补全客户空字段（异步fire-and-forget，不阻塞响应，24h冷却）
    autoFillCustomer(remoteJid, _ownerUid).catch(err => console.warn('[autoFill] async error:', err.message));
    // 自动背调（异步，不阻塞；7天冷却；需要公司名或联系人名）
    autoBackgroundCheck(remoteJid, _ownerUid, io).catch(err => console.warn('[autoBgCheck] async error:', err.message));
  }

  const lidNote = rawRemoteJid !== remoteJid ? ` [@lid->${remoteJid}]` : "";
  if (direction === "inbound") {
    const k = msg?.key || {};
  }
  console.log(`[Evolution Webhook] ${direction} jid=${convJid} me=${fromMe} type=${type} dup=${duplicate}${lidNote} text="${body.slice(0,50)}"`);

  // 入站消息实时推送；出站REST端已乐观推送，webhook回环跳过避免前端重复
  if (io && !duplicate && direction === "inbound") {
    const payload = {
      id: saved.id,
      waMessageId: saved.waMessageId,
      from: saved.from,
      to: saved.to,
      body: saved.body,
      content: saved.body,
      type: saved.type,
      messageType: saved.type,
      direction: saved.direction,
      fromMe: false,
      jid: convJid,
      timestamp: saved.timestamp,
      mediaUrl: saved.mediaUrl || null,
      fileName: saved.fileName || null,
      mimeType: saved.mimeType || mimeType || null,
      contact: { name: pushName || jidToPhone(remoteJid), phone: jidToPhone(remoteJid) },
    };
    io.emit("whatsapp:message", payload);

    // 入站消息异步翻译（不阻塞）
    translateInboundAsync(saved, convJid, io);

    // 自动接待（异步，不阻塞）：超时未人工回复 → 外贸销冠 Agent 接管
    if (!fromMe && direction === 'inbound') {
      (async () => {
        try {
          const aInfo = await resolveAccountByInstance(instanceName);
          const aUserId = aInfo?.account?.userId || null;
          const sid = await instanceToSessionId(instanceName);
          const aStep = (step, detail) => {
            if (!io) return;
            io.emit('whatsapp:auto-step', {
              sessionId: sid, jid: remoteJid, step, detail, ts: Date.now(),
            });
          };
          await autoReceptionService.handleInbound({
            remoteJid,
            body: body || '',
            pushName: pushName || '',
            sessionId: sid,
            userId: aUserId,
            ownerJid,
            emitStep: aStep,
          });
        } catch (e) {
          console.warn('[AutoReception] async error:', e.message);
        }
      })();
    }
  }

  // 出站消息异步回译（不阻塞）——REST端发送回环，补中文译文展示
  if (!duplicate && direction === "outbound") {
    translateOutboundAsync(saved, convJid, io);
  }

  return { saved, direction, jid: convJid };
}

router.post("/", async (req, res) => {
  try {
    const event = req.body;
    let eventType = event.event || event.type || "unknown";
    eventType = eventType.toLowerCase().replace(/_/g, ".");
    const instanceName = event.instance || event.instance_name || "jeremy-main";
    const data = event.data || {};

    const io = req.app.get("io");
    const connector = getEvolutionConnector(instanceName);

    if (eventType === "connection.update") {
      let state = "";
      if (typeof data.state === "string") state = data.state;
      else if (data.state) state = data.state.state || data.state || "";
      console.log(`[Evolution Webhook] connection state: ${state}`);
      if (state === "open") {
        connector.connected = true;
        const info = await connector.getInstanceInfo().catch(() => null);
        const ownerJid = info?.ownerJid || event.sender || "";
        const ownerPhone = jidToPhone(ownerJid);
        await ensureWAConnection(DEFAULT_SESSION_ID, ownerPhone);
        // 更新 WhatsAppAccount 状态
        try {
          await prisma.whatsAppAccount.updateMany({
            where: { instanceName, platform: "whatsapp" },
            data: { status: "connected", phone: ownerPhone || undefined, pushName: info?.profileName || undefined, avatarUrl: info?.profilePicUrl || undefined },
          });
        } catch(e) { console.warn("[Webhook] update account status error:", e.message); }
        if (io) io.emit("whatsapp:status", { status: "connected", phone: ownerPhone, instance: instanceName, sessionId: await instanceToSessionId(instanceName) });
        // 主动同步联系人（带重试，不阻塞 webhook 响应）
        // Evolution 刚连接时通讯录可能未就绪，重试直到拉到数据并回写 pushName/avatarUrl
        syncContactsFromEvolutionWithRetry(instanceName, ownerJid).catch((e) => console.warn("[Webhook] sync contacts error:", e.message));
      } else if (state === "close" || state === "disconnected") {
        connector.connected = false;
        // 更新 WhatsAppAccount 状态
        try {
          await prisma.whatsAppAccount.updateMany({
            where: { instanceName, platform: "whatsapp" },
            data: { status: "disconnected" },
          });
        } catch(e) { console.warn("[Webhook] update account status error:", e.message); }
        if (io) io.emit("whatsapp:status", { status: "disconnected", instance: instanceName, sessionId: await instanceToSessionId(instanceName) });
      }
      return res.status(200).json({ received: true, event: eventType });
    }

    let ownerJid = event.sender || "";
    if (!ownerJid) {
      try { ownerJid = (await connector.getOwnerJid()) || ""; } catch(e){}
    }

    let processed = 0;

    if (eventType === "messages.upsert") {
      let messages;
      if (Array.isArray(data.messages)) {
        messages = data.messages;
      } else if (data.key && (data.message || data.messageType)) {
        messages = [data];
      } else {
        messages = [data];
      }
      for (const m of messages) {
        if (!m || typeof m !== "object") continue;
        const key = m.key || {};
        const remoteJid = key.remoteJid || "";
        const fromMe = !!key.fromMe;
        if (!remoteJid) continue;
        await processOneMessage(instanceName, m, fromMe, remoteJid, ownerJid, io);
        processed++;
      }
    }
    else if (eventType === "send.message") {
      const m = data;
      const key = m.key || {};
      const remoteJid = key.remoteJid || m.remoteJid || m.chatId || "";
      if (remoteJid) {
        await processOneMessage(instanceName, m, true, remoteJid, ownerJid, io);
        processed++;
      }
    }
    else if (eventType === "messages.update") {
      const status = data.status || "";
      const keyId = data.keyId || "";
      if (keyId && (status === "SERVER_ACK" || status === "DELIVERY_ACK" || status === "READ" || status === "ERROR")) {
        try {
          if (status === "DELIVERY_ACK") {
            await prisma.wAMessage.updateMany({ where: { waMessageId: keyId }, data: { deliveredAt: new Date() } });
            if (io) io.emit("whatsapp:receipt", { waMessageId: keyId, status: "delivered", timestamp: Date.now() });
          } else if (status === "READ") {
            await prisma.wAMessage.updateMany({ where: { waMessageId: keyId }, data: { read: true, readAt: new Date() } });
            if (io) io.emit("whatsapp:receipt", { waMessageId: keyId, status: "read", timestamp: Date.now() });
          } else if (status === "ERROR") {
            await prisma.wAMessage.updateMany({ where: { waMessageId: keyId }, data: { ackError: "error" } });
            if (io) io.emit("whatsapp:receipt", { waMessageId: keyId, status: "error", timestamp: Date.now() });
          }
          // SERVER_ACK: nothing to persist; the message already left the outbox once API returned success.
        } catch(e){ console.warn("[Evolution Webhook] receipt update error:", e.message); }
        console.log(`[Evolution Webhook] msg ${keyId.slice(0,10)} status=${status}`);
      }
    }

    return res.status(200).json({ received: true, event: eventType, processed });
  } catch (e) {
    console.error("[Webhook] error:", e.message, e.stack);
    return res.status(500).json({ error: e.message });
  }
});

export default router;


