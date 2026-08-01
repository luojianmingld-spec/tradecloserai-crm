import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const contacts = await prisma.contact.findMany({
  where: { jid: { contains: "817038423105" } }
});
console.log("contacts:", contacts.length);
if (contacts.length > 0) {
  const contact = contacts[0];
  console.log("contact id:", contact.id, "jid:", contact.jid);
  
  const allMsgs = await prisma.message.count({ where: { contactId: contact.id } });
  const sentMsgs = await prisma.message.count({ where: { contactId: contact.id, fromMe: true } });
  console.log("all messages:", allMsgs, "sent (fromMe=true):", sentMsgs);
  
  // Check if there are any messages at all for this contact
  const sampleMsgs = await prisma.message.findMany({
    where: { contactId: contact.id },
    orderBy: { timestamp: "desc" },
    take: 3,
  });
  sampleMsgs.forEach(m => console.log("  msg id:", m.id, "fromMe:", m.fromMe, "content:", (m.content||"").substring(0,50)));
  
  // Check effectiveness
  const eff = await prisma.speechEffectiveness.count({ where: { contactId: contact.id } });
  console.log("effectiveness records:", eff);
  
  // Check what contactIds have effectiveness records
  const effContacts = await prisma.speechEffectiveness.findMany({
    select: { contactId: true },
    distinct: ["contactId"],
    take: 5,
  });
  console.log("\nContacts with effectiveness data:", effContacts.length);
  effContacts.forEach(c => console.log("  contactId:", c.contactId));
}
await prisma.$disconnect();
