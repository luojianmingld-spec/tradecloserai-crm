import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// Check WhatsApp messages specifically
const waMsgs = await prisma.message.findMany({
  where: { jid: { contains: "@s.whatsapp.net" } },
  select: { id: true, contactId: true, jid: true, fromMe: true },
  take: 5,
});
console.log("WhatsApp messages sample:", waMsgs.length);
waMsgs.forEach(m => console.log("  id:", m.id, "contactId:", m.contactId, "jid:", m.jid, "fromMe:", m.fromMe));

// Group by contactId for WA messages
const waContacts = await prisma.message.groupBy({
  by: ["contactId"],
  where: { jid: { contains: "@s.whatsapp.net" } },
  _count: { id: true },
  orderBy: { _count: { id: "desc" } },
  take: 10,
});
console.log("\nWA contacts by message count:");
for (const c of waContacts) {
  const contact = await prisma.contact.findUnique({ where: { id: c.contactId } });
  console.log("  contactId:", c.contactId, "jid:", contact?.jid, "msgs:", c._count.id);
}

// Check for 817038423105 messages by jid (not contact)
const targetMsgs = await prisma.message.findMany({
  where: { jid: "817038423105@s.whatsapp.net" },
  take: 5,
  select: { id: true, contactId: true, jid: true, fromMe: true },
});
console.log("\nMessages with jid=817038423105@s.whatsapp.net:", targetMsgs.length);
targetMsgs.forEach(m => console.log("  id:", m.id, "contactId:", m.contactId));

await prisma.$disconnect();
