import { PrismaClient } from "/opt/whatsapp-crm/backend/node_modules/@prisma/client/index.js";

const prisma = new PrismaClient();
const EVO_API = "http://127.0.0.1:8081";
const APIKEY = "B7E2A9D4C6F1E8A3B5D7F9C2E4A6B8D1";
const INSTANCE = "jeremy-main";
const OWNER_JID = "8613016242602@s.whatsapp.net";

// 动态导入lid-mapping
const { resolveToPhoneJid, recordLidMapping } = await import("/opt/whatsapp-crm/backend/src/services/lid-mapping.js");

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

function extractBody(msg) {
  if (!msg) return { body: null, type: "unknown" };
  if (msg.conversation) return { body: msg.conversation, type: "text" };
  if (msg.conversationMessage) { const c = msg.conversationMessage; return { body: c.text || c.conversation || "", type: "text" }; }
  if (msg.extendedTextMessage) return { body: msg.extendedTextMessage.text || "", type: "text" };
  if (msg.imageMessage) return { body: "[图片]", type: "image" };
  if (msg.videoMessage) return { body: "[视频]", type: "video" };
  if (msg.audioMessage) return { body: "[语音]", type: "audio" };
  if (msg.documentMessage) { const d = msg.documentMessage; return { body: `[文件] ${d.title || d.fileName || ""}`, type: "document", fileName: d.fileName || d.title || null }; }
  if (msg.stickerMessage) return { body: "[贴纸]", type: "sticker" };
  if (msg.locationMessage) return { body: "[位置]", type: "location" };
  if (msg.contactsArrayMessage) return { body: "[联系人卡片]", type: "contacts" };
  if (msg.reactionMessage) return { body: null, type: "reaction" };
  if (msg.protocolMessage) return { body: null, type: "protocol" };
  const t = Object.keys(msg)[0];
  return { body: `[${t || "unknown"}]`, type: t || "unknown" };
}

function isGroup(jid) { return jid && jid.includes("@g.us"); }
function jidToPhone(jid) { return (jid || "").split("@")[0].replace(/^\d+:/, ""); }
function isTestMsg(body) {
  if (!body) return false;
  return body.startsWith("[SMOKE TEST]") || body.startsWith("[LID-TEST]") || body === "[TEST]" || body.startsWith("[TEST]");
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

// 拉取所有页消息
async function fetchAllMessages() {
  let all = [];
  for (let page = 1; page <= 20; page++) {
    const resp = await fetch(`${EVO_API}/chat/findMessages/${INSTANCE}?page=${page}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: APIKEY },
      body: JSON.stringify({ limit: 100, orderBy: { messageTimestamp: "asc" } }),
    });
    if (!resp.ok) { console.log("page", page, "HTTP", resp.status); break; }
    const data = await resp.json();
    const rec = data?.messages?.records || [];
    all = all.concat(rec);
    console.log(`page ${page}: ${rec.length} msgs, total=${all.length}, totalPages=${data?.messages?.pages||'?'}`);
    if (page >= (data?.messages?.pages || 1)) break;
  }
  return all;
}

async function main() {
  console.log("=== 全量历史消息同步开始 ===");
  const allMsgs = await fetchAllMessages();
  console.log(`共拉取 ${allMsgs.length} 条消息`);

  // 过滤有效消息
  let stats = { total: 0, skipped_group: 0, skipped_test: 0, skipped_nobody: 0, skipped_system: 0, already_exists: 0, inserted: 0, inserted_inbound: 0, inserted_outbound: 0 };
  const wamidSet = new Set();

  for (const m of allMsgs) {
    stats.total++;
    const key = m.key || {};
    let remoteJid = key.remoteJid;
    const waMessageId = key.id;
    if (!remoteJid || !waMessageId) { stats.skipped_nobody++; continue; }
    if (isGroup(remoteJid)) { stats.skipped_group++; continue; }
    if (remoteJid === "status@broadcast") { stats.skipped_system++; continue; }
    if (remoteJid === "0@s.whatsapp.net") { stats.skipped_system++; continue; }

    // @lid解析
    if (remoteJid.endsWith("@lid")) {
      const alt = key.remoteJidAlt || m.remoteJidAlt || m.participant || null;
      if (alt && alt.endsWith("@s.whatsapp.net")) {
        recordLidMapping(alt, remoteJid);
        remoteJid = alt;
      } else {
        const pnJid = resolveToPhoneJid(remoteJid);
        if (pnJid && pnJid.endsWith("@s.whatsapp.net")) remoteJid = pnJid;
        if (remoteJid.endsWith("@lid")) continue; // 无法解析
      }
    }

    if (remoteJid === OWNER_JID) continue;

    const fromMe = !!key.fromMe;
    const msg = m.message || {};
    const extracted = extractBody(msg);
    if (!extracted.body) continue;
    if (extracted.type === "unknown") continue;
    if (isTestMsg(extracted.body)) { stats.skipped_test++; continue; }

    // 已存在？
    const existing = await prisma.wAMessage.findUnique({ where: { waMessageId }, select: { id: true } });
    if (existing) { stats.already_exists++; wamidSet.add(waMessageId); continue; }

    const direction = fromMe ? "outbound" : "inbound";
    const from = fromMe ? OWNER_JID : remoteJid;
    const to = fromMe ? remoteJid : OWNER_JID;
    const pushName = m.pushName || "";
    const ts = evoTsToDate(m.messageTimestamp);
    const waMsgTs = evoTsToUnixSec(m.messageTimestamp);

    try {
      await prisma.wAMessage.create({
        data: {
          sessionId: "user_1", from, to,
          body: extracted.body, type: extracted.type, direction,
          timestamp: ts, waMessageId,
          fileName: extracted.fileName || null,
          waMsgTimestamp: waMsgTs,
          read: fromMe ? true : false,  // 自己发的标记已读
        },
      });
      stats.inserted++;
      wamidSet.add(waMessageId);
      if (direction === "inbound") {
        stats.inserted_inbound++;
        const phone = jidToPhone(remoteJid);
        await upsertCustomer(phone, pushName);
      } else {
        stats.inserted_outbound++;
      }
    } catch(e) {
      console.log("  INSERT ERR:", e.message?.slice(0,100));
    }
  }

  console.log("\n=== 同步统计 ===");
  console.log(JSON.stringify(stats, null, 2));

  // 后处理：对每个会话，出站消息在入站消息之后，应把之前的入站标记为已读
  console.log("\n=== 更新已读状态 ===");
  const convos = await prisma.wAMessage.groupBy({
    by: ["sessionId"],
    where: { from: { not: OWNER_JID } },
  });
  // 按会话处理：找出所有"客户最后发消息后，我们已回复"的会话，把对应入站消息标记已读
  const allSessions = await prisma.wAMessage.findMany({
    select: { id: true, from: true, to: true, direction: true, timestamp: true, read: true },
    orderBy: { timestamp: "asc" },
  });
  // 以remoteJid为key，找最后一条出站消息时间，所有早于它的入站标为已读
  const jidMap = {};
  for (const m of allSessions) {
    const jid = m.direction === "inbound" ? m.from : m.to;
    if (!jidMap[jid]) jidMap[jid] = { lastOutbound: 0, unreadInbound: [] };
    if (m.direction === "outbound") {
      if (m.timestamp > new Date(jidMap[jid].lastOutbound)) jidMap[jid].lastOutbound = m.timestamp.getTime();
    } else {
      if (!m.read) jidMap[jid].unreadInbound.push(m.id);
    }
  }
  let readFixed = 0;
  for (const [jid, info] of Object.entries(jidMap)) {
    if (info.lastOutbound > 0 && info.unreadInbound.length > 0) {
      // 把早于最后出站消息的入站消息标记为已读
      const idsToMark = info.unreadInbound;
      await prisma.wAMessage.updateMany({
        where: { id: { in: idsToMark }, timestamp: { lte: new Date(info.lastOutbound) } },
        data: { read: true },
      });
      readFixed += idsToMark.length;
    }
  }
  console.log(`标记 ${readFixed} 条入站消息为已读（已被我们回复过）`);

  // 再次检查待回复
  const unreadInbound = await prisma.wAMessage.count({ where: { direction: "inbound", read: false } });
  console.log(`\n当前未读入站消息数: ${unreadInbound}`);
}

main().catch(console.error).finally(() => process.exit(0));
