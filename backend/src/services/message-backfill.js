/**
 * Message Backfill Service
 * 每120秒从Evolution拉最近10分钟消息，比对waMessageId补漏。
 * 兜底：防止webhook事件缓冲拥堵/重启漏推导致消息丢失。
 */
import { PrismaClient } from "@prisma/client";
import { resolveToPhoneJid, recordLidMapping } from "./lid-mapping.js";

const prisma = new PrismaClient();

const EVO_API_URL = process.env.EVOLUTION_API_URL || "http://127.0.0.1:8081";
const EVO_API_KEY = process.env.EVOLUTION_API_KEY || "B7E2A9D4C6F1E8A3B5D7F9C2E4A6B8D1";
const INSTANCE = process.env.EVOLUTION_INSTANCE || "jeremy-main";
const OWNER_JID = "8613016242602@s.whatsapp.net";
const LOOKBACK_SEC = 180;       // 补拉最近3分钟
const INTERVAL_MS = 60_000;     // 每60秒跑一次
const INITIAL_DELAY_MS = 30_000;

function isGroup(jid) { return jid && jid.includes("@g.us"); }
function jidToPhone(jid) { return (jid || "").split("@")[0].replace(/^\d+:/, ""); }

function evoTsToDate(ts) {
  if (!ts) return new Date();
  const n = typeof ts === "object" ? ts.low : Number(ts);
  return new Date(n > 1e12 ? n : n * 1000);
}
function evoTsToUnixSec(ts) {
  if (!ts) return Math.floor(Date.now()/1000);
  const n = typeof ts === "object" ? ts.low : Number(ts);
  return n > 1e12 ? Math.floor(n/1000) : n;
}

function extractBody(m) {
  if (!m) return { body: null, type: "unknown" };
  if (m.conversation) return { body: m.conversation, type: "text" };
  if (m.conversationMessage) { const c = m.conversationMessage; return { body: c.text || c.conversation || "", type: "text" }; }
  if (m.extendedTextMessage) return { body: m.extendedTextMessage.text || "", type: "text" };
  if (m.imageMessage) return { body: "[图片]", type: "image" };
  if (m.videoMessage) return { body: "[视频]", type: "video" };
  if (m.audioMessage) return { body: "[语音]", type: "audio" };
  if (m.documentMessage) { const d = m.documentMessage; return { body: `[文件] ${d.title || d.fileName || ""}`, type: "document", fileName: d.fileName || d.title || null }; }
  if (m.stickerMessage) return { body: "[贴纸]", type: "sticker" };
  if (m.locationMessage) return { body: "[位置]", type: "location" };
  if (m.contactsArrayMessage) return { body: "[联系人卡片]", type: "contacts" };
  if (m.reactionMessage) return { body: null, type: "reaction" };
  if (m.protocolMessage) return { body: null, type: "protocol" };
  const t = Object.keys(m)[0];
  return { body: `[${t || "unknown"}]`, type: t || "unknown" };
}

// 从Evolution拉最近消息（直接拉最近100条，本地过滤）
async function fetchRecentMessages() {
  const url = `${EVO_API_URL}/chat/findMessages/${INSTANCE}?page=1`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: EVO_API_KEY },
    body: JSON.stringify({ limit: 100, orderBy: { messageTimestamp: "desc" } }),
  });
  if (!resp.ok) { console.warn("[Backfill] fetch HTTP", resp.status); return []; }
  const data = await resp.json().catch(() => null);
  return data?.messages?.records || [];
}

async function upsertCustomer(phone, pushName) {
  if (!phone || phone.length < 5) return;
  try {
    let cust = await prisma.customer.findFirst({ where: { phone } });
    const name = pushName && pushName.trim() ? pushName.trim() : phone;
    if (!cust) {
      await prisma.customer.create({ data: { userId: 1, phone, name, source: "whatsapp", status: "potential", lastContactAt: new Date() } });
    } else if (pushName && pushName.trim() && cust.name === phone) {
      await prisma.customer.update({ where: { id: cust.id }, data: { name: pushName.trim(), lastContactAt: new Date() } });
    }
  } catch(e) { /* ignore */ }
}

let running = false;

async function runBackfill(io) {
  if (running) return;
  running = true;
  let backfilled = 0;
  try {
    const records = await fetchRecentMessages();
    if (!records.length) { running = false; return; }

    const cutoffSec = Math.floor(Date.now()/1000) - LOOKBACK_SEC;

    // 先解析所有remoteJid（含@lid→@s.whatsapp.net映射）
    const resolved = [];
    for (const m of records) {
      const key = m.key || {};
      let remoteJid = key.remoteJid;
      if (!remoteJid) continue;
      const msgTs = evoTsToUnixSec(m.messageTimestamp);
      if (msgTs < cutoffSec) continue; // 太旧跳过

      // @lid 解析
      if (remoteJid.endsWith("@lid")) {
        const alt = key.remoteJidAlt || m.remoteJidAlt || m.participant || null;
        if (alt && alt.endsWith("@s.whatsapp.net")) {
          recordLidMapping(alt, remoteJid);
          remoteJid = alt;
        } else {
          // 用lid-mapping查
          const pnJid = resolveToPhoneJid(remoteJid);
          if (pnJid && pnJid.endsWith("@s.whatsapp.net")) remoteJid = pnJid;
          // 还是@lid则跳过（无法识别真实号码）
          if (remoteJid.endsWith("@lid")) continue;
        }
      }

      if (isGroup(remoteJid)) continue;
      if (remoteJid === "status@broadcast") continue;
      if (key.fromMe) continue; // 出站消息不补拉（自己发的不会丢）
      if (remoteJid === OWNER_JID) continue;

      resolved.push({ m, key, remoteJid });
    }

    if (!resolved.length) { running = false; return; }

    // 批量查已存在waMessageId
    const wamids = resolved.map(r => r.key.id).filter(Boolean);
    if (!wamids.length) { running = false; return; }
    const existing = await prisma.wAMessage.findMany({
      where: { waMessageId: { in: wamids } },
      select: { waMessageId: true },
    });
    const existingSet = new Set(existing.map(x => x.waMessageId));

    for (const { m, key, remoteJid } of resolved) {
      try {
        const waMessageId = key.id;
        if (!waMessageId || existingSet.has(waMessageId)) continue;

        const fromMe = !!key.fromMe;
        const msg = m.message || {};
        const extracted = extractBody(msg);
        if (!extracted.body) continue;
        // 非文本媒体类也补（[图片][语音]等）
        if (extracted.type === "unknown") continue;

        const direction = fromMe ? "outbound" : "inbound";
        const from = fromMe ? OWNER_JID : remoteJid;
        const to = fromMe ? remoteJid : OWNER_JID;
        const pushName = m.pushName || "";
        const ts = evoTsToDate(m.messageTimestamp);
        const waMsgTs = evoTsToUnixSec(m.messageTimestamp);

        const saved = await prisma.wAMessage.upsert({
          where: { waMessageId },
          update: {}, // 已存在则不动
          create: {
            sessionId: "user_1", from, to,
            body: extracted.body, type: extracted.type, direction,
            timestamp: ts, waMessageId,
            fileName: extracted.fileName || null,
            waMsgTimestamp: waMsgTs,
          },
        });
        existingSet.add(waMessageId);
        backfilled++;

        if (direction === "inbound") {
          const phone = jidToPhone(remoteJid);
          await upsertCustomer(phone, pushName);
          if (io) {
            io.emit("whatsapp:message", {
              id: saved.id, waMessageId, from: saved.from, to: saved.to,
              body: saved.body, type: saved.type, direction: "inbound",
              fromMe: false, jid: remoteJid, timestamp: saved.timestamp, backfilled: true,
            });
          }
          // 触发翻译
          try {
            const { getTranslationSettings } = await import("../routes/translation.js");
            const ts2 = await getTranslationSettings(remoteJid, 1);
            if (ts2?.receiveEnabled) {
              const aiSvc = await import("./ai.service.js");
              let engine = ts2.receiveEngine || "google";
              let src = ts2.receiveSourceLang || "auto";
              const tgt = ts2.receiveTargetLang || "zh";
              if (src === "auto" && aiSvc.detectLanguage) src = await aiSvc.detectLanguage(extracted.body, engine);
              if (src && src !== "zh" && !src.startsWith("zh-") && aiSvc.translateText) {
                const tr = await aiSvc.translateText(extracted.body, src, tgt, engine, 1);
                if (tr?.translated) {
                  const transObj = JSON.stringify({ original: extracted.body, translated: tr.translated, sourceLang: src, targetLang: tgt });
                  await prisma.wAMessage.update({ where: { id: saved.id }, data: { translation: transObj, sourceLang: src } });
                  if (io) io.emit("whatsapp:translation", {
                    id: saved.id, waMessageId, jid: remoteJid,
                    translation: { original: extracted.body, translated: tr.translated, sourceLang: src, targetLang: tgt },
                    sourceLang: src,
                  });
                  console.log(`[Backfill] translated #${saved.id} ${src}->${tgt}: "${tr.translated.slice(0,30)}"`);
                }
              }
            }
          } catch (te) { /* translate errors non-fatal */ }
        }
      } catch (e) {
        if (e?.code !== "P2002") console.warn("[Backfill] msg error:", e.message?.slice?.(0,80) || e);
      }
    }

    if (backfilled > 0) console.log(`[Backfill] complete, recovered ${backfilled} missing msg(s)`);
  } catch (e) {
    console.warn("[Backfill] run error:", e.message?.slice?.(0,120) || e);
  } finally {
    running = false;
  }
}

// 供外部(如socket连接时)单次手动触发
export async function runOnce(io) {
  return runBackfill(io);
}

export function startBackfill(io) {
  console.log(`[Backfill] start in ${INITIAL_DELAY_MS/1000}s, every ${INTERVAL_MS/1000}s (lookback ${LOOKBACK_SEC}s)`);
  setTimeout(() => {
    runBackfill(io).catch(e => console.warn("[Backfill] initial:", e.message));
    setInterval(() => runBackfill(io).catch(e => console.warn("[Backfill] tick:", e.message)), INTERVAL_MS);
  }, INITIAL_DELAY_MS);
}
