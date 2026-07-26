import { PrismaClient } from "/opt/whatsapp-crm/backend/node_modules/@prisma/client/index.js";
import { execSync } from "child_process";

const prisma = new PrismaClient();
const OWNER_JID = "8613016242602@s.whatsapp.net";
const { resolveToPhoneJid, recordLidMapping } = await import("/opt/whatsapp-crm/backend/src/services/lid-mapping.js");

// 通过docker exec从Evolution PG导出所有消息
console.log("从Evolution PostgreSQL导出消息...");
const psqlCmd = `docker exec -i evolution_postgres psql -U evolution -d evolution_db -t -A -c "SELECT row_to_json(m) FROM (SELECT key, \\"pushName\\", \\"messageType\\", message, \\"messageTimestamp\\" FROM evolution_api.\\"Message\\" WHERE key->>'remoteJid' NOT LIKE '%g.us%' AND key->>'remoteJid' != 'status@broadcast' AND key->>'remoteJid' != '0@s.whatsapp.net' ORDER BY \\"messageTimestamp\\" ASC) m;"`;

let raw;
try {
  raw = execSync(psqlCmd, { maxBuffer: 50 * 1024 * 1024, encoding: "utf-8" });
} catch(e) {
  console.error("psql error:", e.message?.slice(0,500));
  process.exit(1);
}

const lines = raw.split("\n").filter(l => l.trim().startsWith("{"));
console.log(`导出 ${lines.length} 条消息`);

const evoMsgs = lines.map(l => JSON.parse(l));

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
    let cust = await prisma.customer.findFirst({ where: { OR: [{ phone }] } });
    const name = pushName && pushName.trim() ? pushName.trim() : phone;
    if (!cust) {
      await prisma.customer.create({ data: { userId: 1, phone, name, source: "whatsapp", status: "potential", lastContactAt: new Date() } });
    } else {
      if (pushName && pushName.trim() && cust.name === phone) {
        await prisma.customer.update({ where: { id: cust.id }, data: { name: pushName.trim(), lastContactAt: new Date() } });
      }
    }
  } catch(e) {}
}

// 查DB已有waMessageId
const existing = await prisma.wAMessage.findMany({ select: { waMessageId: true } });
const existingSet = new Set(existing.map(x => x.waMessageId));
console.log(`DB已有 ${existingSet.size} 条消息`);

let stats = { inserted: 0, inserted_inbound: 0, inserted_outbound: 0, skipped_body: 0, skipped_test: 0 };

for (const m of evoMsgs) {
  const key = m.key || {};
  let remoteJid = key.remoteJid;
  const waMessageId = key.id;
  if (!remoteJid || !waMessageId) continue;
  if (isGroup(remoteJid)) continue;
  if (remoteJid === OWNER_JID) continue;

  // @lid解析
  if (remoteJid.endsWith("@lid")) {
    const alt = key.remoteJidAlt || m.participant || null;
    if (alt && alt.endsWith("@s.whatsapp.net")) {
      recordLidMapping(alt, remoteJid);
      remoteJid = alt;
    } else {
      const pnJid = resolveToPhoneJid(remoteJid);
      if (pnJid && pnJid.endsWith("@s.whatsapp.net")) remoteJid = pnJid;
      // 保留@lid
    }
  }

  const fromMe = !!key.fromMe;
  const msg = m.message || {};
  const extracted = extractBody(msg);
  if (!extracted.body) { stats.skipped_body++; continue; }
  if (extracted.type === "unknown") { stats.skipped_body++; continue; }
  if (isTestMsg(extracted.body)) { stats.skipped_test++; continue; }
  if (existingSet.has(waMessageId)) continue;

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
      await upsertCustomer(jidToPhone(remoteJid), pushName, remoteJid);
    } else {
      stats.inserted_outbound++;
    }
  } catch(e) {
    console.log("INSERT ERR:", waMessageId.slice(0,20), e.message?.slice(0,80));
  }
}

console.log("\n=== 同步统计 ===");
console.log(JSON.stringify(stats, null, 2));

// 更新已读状态
console.log("\n=== 更新已读状态 ===");
const allDm = await prisma.wAMessage.findMany({
  where: { direction: "inbound" },
  select: { id: true, from: true, timestamp: true, read: true },
  orderBy: { timestamp: "asc" },
});
const allOut = await prisma.wAMessage.findMany({
  where: { direction: "outbound" },
  select: { to: true, timestamp: true },
});
const lastOut = {};
for (const m of allOut) {
  if (!lastOut[m.to] || m.timestamp > lastOut[m.to]) lastOut[m.to] = m.timestamp;
}
const idsToMark = [];
for (const m of allDm) {
  if (m.read) continue;
  if (lastOut[m.from] && lastOut[m.from] >= m.timestamp) idsToMark.push(m.id);
}
if (idsToMark.length) {
  await prisma.wAMessage.updateMany({ where: { id: { in: idsToMark } }, data: { read: true } });
}
console.log(`标记 ${idsToMark.length} 条入站为已读`);

const totalMsgs = await prisma.wAMessage.count();
const unreadInbound = await prisma.wAMessage.count({ where: { direction: "inbound", read: false } });
console.log(`DB总消息数: ${totalMsgs}, 未读入站: ${unreadInbound}`);

if (unreadInbound > 0) {
  const unread = await prisma.wAMessage.findMany({
    where: { direction: "inbound", read: false },
    select: { from: true, body: true, timestamp: true },
    orderBy: { timestamp: "desc" },
  });
  console.log("\n真正需要回复的会话:");
  const byJid = {};
  for (const m of unread) {
    if (!byJid[m.from] || m.timestamp > byJid[m.from].timestamp) byJid[m.from] = m;
  }
  for (const [jid, m] of Object.entries(byJid)) {
    console.log(`  ${jid.slice(0,35)} ${m.timestamp.toISOString().slice(5,16)} ${m.body?.slice(0,40)}`);
  }
}

await prisma.$disconnect();
