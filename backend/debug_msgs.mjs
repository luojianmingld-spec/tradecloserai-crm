import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// Check messages for contact ID 2
const msgs2 = await prisma.message.findMany({
  where: { contactId: 2 },
  take: 3,
});
console.log("Messages with contactId=2:", msgs2.length);

// Search by JID pattern in message remoteJid field
const msgsByJid = await prisma.message.findMany({
  where: { remoteJid: { contains: "817038423105" } },
  take: 3,
  select: { id: true, contactId: true, remoteJid: true, fromMe: true, content: true },
});
console.log("\nMessages with remoteJid containing 817038423105:", msgsByJid.length);
msgsByJid.forEach(m => console.log("  id:", m.id, "contactId:", m.contactId, "remoteJid:", m.remoteJid, "fromMe:", m.fromMe, "content:", (m.content||"").substring(0,50)));

// Check what contactIds these messages belong to
if (msgsByJid.length > 0) {
  const cids = [...new Set(msgsByJid.map(m => m.contactId))];
  console.log("\nDistinct contactIds:", cids);
  const cts = await prisma.contact.findMany({ where: { id: { in: cids } } });
  cts.forEach(c => console.log("  id:", c.id, "jid:", c.jid, "name:", c.name));
}

// Check total message count
const totalMsgs = await prisma.message.count();
console.log("\nTotal messages in DB:", totalMsgs);

await prisma.$disconnect();
