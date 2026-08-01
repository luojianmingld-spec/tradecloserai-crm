const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
(async () => {
  const count = await prisma.speechEffectiveness.count();
  console.log("speechEffectiveness total:", count);
  
  const contacts = await prisma.contact.findMany({
    where: { jid: { in: ["817038423105@c.us", "817038423105"] } }
  });
  console.log("contacts found:", contacts.length);
  if (contacts.length > 0) {
    const cids = contacts.map(c => c.id);
    const msgs = await prisma.message.count({ where: { contactId: { in: cids } } });
    console.log("messages for this contact:", msgs);
    const eff = await prisma.speechEffectiveness.count({ where: { contactId: { in: cids } } });
    console.log("effectiveness records for this contact:", eff);
    const sentMsgs = await prisma.message.count({ where: { contactId: { in: cids }, fromMe: true } });
    console.log("sent messages:", sentMsgs);
  }
  await prisma.$disconnect();
})().catch(e => console.error(e.message));
