import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// Check all distinct jid patterns
const jidPatterns = await prisma.$queryRaw`SELECT DISTINCT SUBSTRING_INDEX(jid, "@", -1) as domain, COUNT(*) as cnt FROM messages GROUP BY domain ORDER BY cnt DESC`;
console.log("Message domains:", JSON.stringify(jidPatterns, null, 2));

// Total WA messages
const waCount = await prisma.$queryRaw`SELECT COUNT(*) as cnt FROM messages WHERE jid LIKE "%@s.whatsapp.net"`;
console.log("WA message count:", waCount);

// Check contactId for the target contact
const contact = await prisma.contact.findFirst({ where: { jid: { contains: "817038423105" } } });
console.log("\nTarget contact:", contact?.id, contact?.jid);

// Check messages by this contactId
const msgsByCid = await prisma.$queryRaw`SELECT COUNT(*) as cnt FROM messages WHERE contactId = ${contact?.id}`;
console.log("Messages for this contactId:", msgsByCid);

// Check recent messages for this contact
const recentMsgs = await prisma.$queryRaw`SELECT id, contactId, jid, fromMe, content, timestamp FROM messages WHERE contactId = ${contact?.id} ORDER BY timestamp DESC LIMIT 5`;
console.log("Recent messages:", JSON.stringify(recentMsgs, null, 2));

await prisma.$disconnect();
