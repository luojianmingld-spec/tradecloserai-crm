import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const contacts = await prisma.contact.findMany({
  where: { jid: { contains: "817038423105" } }
});
console.log("contacts:", contacts.length);
if (contacts.length > 0) {
  const cids = contacts.map(c => c.id);
  const eff = await prisma.speechEffectiveness.findMany({
    where: { contactId: { in: cids } },
    orderBy: { sentAt: "desc" },
    take: 5,
  });
  console.log("effectiveness records:", eff.length);
  eff.forEach(r => console.log("  replied:", r.customerReplied, "score:", r.effectivenessScore, "respTime:", r.responseTimeHours, "h"));
  
  const total = await prisma.speechEffectiveness.count({ where: { contactId: { in: cids } } });
  const replied = await prisma.speechEffectiveness.count({ where: { contactId: { in: cids }, customerReplied: true } });
  console.log(`\nTotal: ${total}, Replied: ${replied}, Rate: ${Math.round(replied/total*100)}%`);
}
await prisma.$disconnect();
