import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// Check total messages
const totalMsgs = await prisma.message.count();
console.log("Total messages:", totalMsgs);

// Sample some messages to understand the data model
const sampleMsgs = await prisma.message.findMany({
  take: 5,
  orderBy: { timestamp: "desc" },
});
sampleMsgs.forEach(m => console.log("  id:", m.id, "contactId:", m.contactId, "jid:", m.jid, "fromMe:", m.fromMe, "ts:", m.timestamp));

// Check contacts that HAVE messages
const contactsWithMsgs = await prisma.message.groupBy({
  by: ["contactId"],
  _count: { _all: true },
  orderBy: { _count: { _all: "desc" } },
  take: 5,
});
console.log("\nContacts with most messages:");
for (const c of contactsWithMsgs) {
  const contact = await prisma.contact.findUnique({ where: { id: c.contactId } });
  console.log("  contactId:", c.contactId, "jid:", contact?.jid, "msgCount:", c._count._all);
}

await prisma.$disconnect();
