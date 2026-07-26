import { PrismaClient } from "/opt/whatsapp-crm/backend/node_modules/@prisma/client/index.js";
const p = new PrismaClient();

// 查陈元龙和Eric的最近消息
for (const jid of ["135640150737098@lid", "182927472218210@lid"]) {
  console.log(`\n========== ${jid} ==========`);
  const msgs = await p.wAMessage.findMany({
    where: { OR: [{ from: jid }, { to: jid }] },
    orderBy: { timestamp: "asc" },
    select: { timestamp: true, direction: true, body: true, read: true, waMsgTimestamp: true },
  });
  for (const m of msgs.slice(-15)) {
    const t = m.timestamp.toISOString().slice(5, 16);
    const who = m.direction === "outbound" ? "ME  " : "THEM";
    const rd = m.direction === "inbound" ? (m.read ? "✓已读" : "✗未读") : "";
    console.log(`  ${t} ${who} ${rd} ${m.body?.slice(0,50)}`);
  }
}
await p.$disconnect();
