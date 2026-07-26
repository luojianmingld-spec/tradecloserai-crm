import { PrismaClient } from "/opt/whatsapp-crm/backend/node_modules/@prisma/client/index.js";

const prisma = new PrismaClient();
const EVO_API = "http://127.0.0.1:8081";
const APIKEY = "B7E2A9D4C6F1E8A3B5D7F9C2E4A6B8D1";
const INSTANCE = "jeremy-main";
const OWNER_JID = "8613016242602@s.whatsapp.net";

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

async function upsertCustomer(phone, pushName, remoteJid) {
  if (!phone || phone.length < 5) return;
  try {
    let cust = await prisma.customer.findFirst({ where: { OR: [{ phone }, { whatsappJid: remoteJid }] } });
    const name = pushName && pushName.trim() ? pushName.trim() : phone;
    if (!cust) {
      await prisma.customer.create({ data: { userId: 1, phone, name, source: "whatsapp", status: "potential", lastContactAt: new Date() } });
    } else {
      if (pushName && pushName.trim() && (cust.name === phone || !cust.name)) {
        await prisma.customer.update({ where: { id: cust.id }, data: { name: pushName.trim(), lastContactAt: new Date() } });
      }
    }
  } catch(e) { /* ignore */ }
}

// 拉取所有页消息 - 尝试不同orderBy
async function fetchAllMessages() {
  let all = [];
  for (let page = 1; page <= 20; page++) {
    const resp = await fetch(`${EVO_API}/chat/findMessages/${INSTANCE}?page=${page}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: APIKEY },
      body: JSON.stringify({ limit: 100 }),  // 不指定orderBy让它用默认
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
  console.log("=== 全量历史消息同步v2开始 ===");
  // 先看DB里已有的waMessageId集合
  const existing = await prisma.wAMessage.findMany({ select: { waMessageId: true } });
  const existingSet = new Set(existing.map(x => x.waMessageId));
  console.log(`DB已有 ${existingSet.size} 条消息`);

  const allMsgs = await fetchAllMessages();
  console.log(`Evolution拉取 ${allMsgs.length} 条消息`);

  let stats = { total: 0, skipped_group: 0, skipped_test: 0, skipped_body: 0, skipped_owner:0, skipped_broadcast:0, already_exists: 0, inserted: 0, inserted_inbound: 0, inserted_outbound: 0, skipped_lid: 0 };

  for (const m of allMsgs) {
    stats.total++;
    const key = m.key || {};
    let remoteJid = key.remoteJid;
    const waMessageId = key.id;
    if (!remoteJid || !waMessageId) { stats.skipped_nobody = (stats.skipped_nobody||0)+1; continue; }
    if (isGroup(remoteJid)) { stats.skipped_group++; continue; }
    if (remoteJid === "status@broadcast") { stats.skipped_broadcast++; continue; }
    if (remoteJid === "0@s.whatsapp.net") { stats.skipped_broadcast++; continue; }

    // @lid 尝试解析但不强制跳过
    if (remoteJid.endsWith("@lid")) {
      const alt = key.remoteJidAlt || m.remoteJidAlt || m.participant || null;
      if (alt && alt.endsWith("@s.whatsapp.net")) {
        recordLidMapping(alt, remoteJid);
        remoteJid = alt;
      } else {
        const pnJid = resolveToPhoneJid(remoteJid);
        if (pnJid && pnJid.endsWith("@s.whatsapp.net")) remoteJid = pnJid;
        // 仍然保持原始@lid，不跳过
      }
    }

    if (remoteJid === OWNER_JID) { stats.skipped_owner++; continue; }

    const fromMe = !!key.fromMe;
    const msg = m.message || {};
    const extracted = extractBody(msg);
    if (!extracted.body) { stats.skipped_body++; continue; }
    if (extracted.type === "unknown") { stats.skipped_body++; continue; }
    if (isTestMsg(extracted.body)) { stats.skipped_test++; continue; }

    if (existingSet.has(waMessageId)) { stats.already_exists++; continue; }

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
          read: fromMe ? true : false,
        },
      });
      stats.inserted++;
      existingSet.add(waMessageId);
      if (direction === "inbound") {
        stats.inserted_inbound++;
        const phone = remoteJid.endsWith("@lid") ? jidToPhone(remoteJid) : jidToPhone(remoteJid);
        await upsertCustomer(phone, pushName, remoteJid);
      } else {
        stats.inserted_outbound++;
      }
    } catch(e) {
      console.log("  INSERT ERR:", waMessageId.slice(0,20), e.message?.slice(0,100));
    }
  }

  console.log("\n=== 同步统计 ===");
  console.log(JSON.stringify(stats, null, 2));

  // 后处理：标记已回复的入站为已读
  console.log("\n=== 更新已读状态 ===");
  const allDm = await prisma.wAMessage.findMany({
    where: { NOT: { from: OWNER_JID }, direction: "inbound" },
    select: { id: true, from: true, to: true, timestamp: true, read: true, direction: true },
    orderBy: { timestamp: "asc" },
  });
  // 同时也查所有出站
  const allOut = await prisma.wAMessage.findMany({
    where: { direction: "outbound" },
    select: { to: true, timestamp: true },
    orderBy: { timestamp: "asc" },
  });
  // 按remoteJid找最后出站时间
  const lastOut = {};
  for (const m of allOut) {
    const jid = m.to;
    if (!lastOut[jid] || m.timestamp > lastOut[jid]) lastOut[jid] = m.timestamp;
  }
  let readFixed = 0;
  const idsToMark = [];
  for (const m of allDm) {
    const jid = m.from;
    if (m.read) continue;
    if (lastOut[jid] && lastOut[jid] >= m.timestamp) {
      idsToMark.push(m.id);
    }
  }
  if (idsToMark.length) {
    await prisma.wAMessage.updateMany({
      where: { id: { in: idsToMark } },
      data: { read: true },
    });
    readFixed = idsToMark.length;
  }
  console.log(`标记 ${readFixed} 条入站消息为已读`);

  const unreadInbound = await prisma.wAMessage.count({ where: { direction: "inbound", read: false } });
  console.log(`\n当前未读入站消息数: ${unreadInbound}`);
  // 列出具体未回复会话
  if (unreadInbound > 0) {
    const unread = await prisma.wAMessage.findMany({
      where: { direction: "inbound", read: false },
      select: { from: true, body: true, timestamp: true },
      orderBy: { timestamp: "desc" },
    });
    console.log("未回复消息:");
    for (const m of unread.slice(0,10)) {
      console.log(`  ${m.from.slice(0,35)} ${m.timestamp.toISOString().slice(5,16)} ${m.body?.slice(0,40)}`);
    }
  }
}

main().catch(console.error).finally(() => process.exit(0));
