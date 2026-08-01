import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// Search for contacts with 817038423105 in any format
const contacts = await prisma.contact.findMany({
  where: { jid: { contains: "817038423105" } }
});
console.log("contacts with 817038423105:", contacts.length);
contacts.forEach(c => console.log("  jid:", c.jid, "name:", c.name));

// Also try broader search
const all = await prisma.contact.findMany({ take: 5 });
console.log("\nSample contacts:");
all.forEach(c => console.log("  jid:", c.jid, "name:", c.name));

await prisma.$disconnect();
