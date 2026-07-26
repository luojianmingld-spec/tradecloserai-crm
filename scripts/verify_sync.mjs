import { PrismaClient } from "/opt/whatsapp-crm/backend/node_modules/@prisma/client/index.js";
const p = new PrismaClient();

// 检查各会话状态
const allMsgs = await p.wAMessage.findMany({
  select: { from: true, to: true, direction: true, timestamp: true, read: true, body: true },
  orderBy: { timestamp: "asc" },
});
const convos = {};
for (const m of allMsgs) {
  const jid = m.direction === "inbound" ? m.from : m.to;
  if (!convos[jid]) convos[jid] = { inbound: 0, outbound: 0, lastInbound: null, lastOutbound: null, unreadInbound: 0, lastInBody: "" };
  if (m.direction === "inbound") {
    convos[jid].inbound++;
    convos[jid].lastInbound = m.timestamp;
    convos[jid].lastInBody = m.body?.slice(0,40);
    if (!m.read) convos[jid].unreadInbound++;
  } else {
    convos[jid].outbound++;
    convos[jid].lastOutbound = m.timestamp;
  }
}
console.log("各会话最新状态:");
for (const [jid, s] of Object.entries(convos)) {
  if (jid.includes("13016242602")) continue; // 自己
  const reallyUnread = s.lastInbound && (!s.lastOutbound || s.lastInbound > s.lastOutbound);
  const lastIn = s.lastInbound?.toISOString().slice(5,16) || "-";
  const lastOut = s.lastOutbound?.toISOString().slice(5,16) || "-";
  const mark = reallyUnread ? " ⚠️需回复" : "";
  console.log(`  ${jid.slice(0,35)} 入${s.inbound} 出${s.outbound} 未读入站=${s.unreadInbound} lastIn=${lastIn} lastOut=${lastOut}${mark}`);
  if (reallyUnread) console.log(`       最新消息: ${s.lastInBody}`);
}
await p.$disconnect();
