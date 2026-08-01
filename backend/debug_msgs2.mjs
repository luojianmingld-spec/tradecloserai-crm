import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const contacts = await prisma.contact.findMany({
  where: { jid: { contains: "817038423105" } }
});
console.log("contacts:", contacts.length, "id:", contacts[0]?.id, "jid:", contacts[0]?.jid);

const contact = contacts[0];

// Messages by contactId
const msgsByContact = await prisma.message.count({ where: { contactId: contact.id } });
console.log("messages by contactId:", msgsByContact);

// Messages by jid field
const msgsByJid = await prisma.message.count({ where: { jid: { contains: "817038423105" } } });
console.log("messages by jid contains:", msgsByJid);

// All distinct jids for this contact
const sampleMsgs = await prisma.message.findMany({
  where: { jid: { contains: "817038423105" } },
  select: { id: true, contactId: true, jid: true, fromMe: true },
  take: 5,
});
console.log("\nSample messages by jid:");
sampleMsgs.forEach(m => console.log("  id:", m.id, "contactId:", m.contactId, "jid:", m.jid, "fromMe:", m.fromMe));

// Check what contactIds reference this jid
const distinctCids = [...new Set(sampleMsgs.map(m => m.contactId))];
if (distinctCids.length > 0) {
  const cts = await prisma.contact.findMany({ where: { id: { in: distinctCids } } });
  cts.forEach(c => console.log("  contact id:", c.id, "jid:", c.jid));
}

await prisma.$disconnect();
