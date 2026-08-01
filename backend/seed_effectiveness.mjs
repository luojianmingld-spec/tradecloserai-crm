import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// Seed effectiveness data for all contacts
async function seed() {
  const contacts = await prisma.contact.findMany({});
  console.log("Total contacts:", contacts.length);

  let seeded = 0;
  for (const contact of contacts) {
    const sentMsgs = await prisma.message.findMany({
      where: { contactId: contact.id, fromMe: true },
      orderBy: { timestamp: "asc" },
    });

    for (const sentMsg of sentMsgs) {
      // Check if already tracked
      const existing = await prisma.speechEffectiveness.findFirst({
        where: { sentMessageId: sentMsg.id },
      });
      if (existing) continue;

      // Find customer reply after this message
      const customerReply = await prisma.message.findFirst({
        where: {
          contactId: contact.id,
          fromMe: false,
          timestamp: { gt: sentMsg.timestamp },
        },
        orderBy: { timestamp: "asc" },
      });

      const now = new Date();
      const sentTime = new Date(sentMsg.timestamp);
      const hoursSinceSent = (now - sentTime) / (1000 * 60 * 60);

      let responseTimeHours = null;
      let responded = false;
      let effectivenessScore = 0;

      if (customerReply) {
        responded = true;
        const replyTime = new Date(customerReply.timestamp);
        responseTimeHours = Math.round((replyTime - sentTime) / (1000 * 60 * 60) * 10) / 10;

        if (responseTimeHours < 1) effectivenessScore = 90;
        else if (responseTimeHours < 4) effectivenessScore = 80;
        else if (responseTimeHours < 12) effectivenessScore = 70;
        else if (responseTimeHours < 24) effectivenessScore = 60;
        else if (responseTimeHours < 48) effectivenessScore = 40;
        else effectivenessScore = 20;

        if (customerReply.content && customerReply.content.length > 100) {
          effectivenessScore = Math.min(100, effectivenessScore + 10);
        }
      } else {
        if (hoursSinceSent < 2) effectivenessScore = null;
        else if (hoursSinceSent < 24) effectivenessScore = 30;
        else if (hoursSinceSent < 48) effectivenessScore = 15;
        else effectivenessScore = 0;
      }

      await prisma.speechEffectiveness.create({
        data: {
          sentMessageId: sentMsg.id,
          contactId: contact.id,
          sentContent: sentMsg.content || "",
          sentAt: sentMsg.timestamp,
          customerReplied: responded,
          responseTimeHours: responseTimeHours,
          responseLength: customerReply?.content?.length || 0,
          effectivenessScore: effectivenessScore,
          evaluatedAt: new Date(),
        },
      });
      seeded++;
    }
  }

  console.log(`Seeded ${seeded} effectiveness records`);
  await prisma.$disconnect();
}

seed().catch(e => { console.error(e); process.exit(1); });
