import { PrismaClient } from "@prisma/client";

const EVO_API_URL = "http://127.0.0.1:8081";
const EVO_API_KEY = process.env.EVOLUTION_API_KEY;
const prisma = new PrismaClient();

async function sync() {
  // 1. Fetch contacts from Evolution API
  const resp = await fetch(`${EVO_API_URL}/chat/findContacts/jeremy-eric`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: EVO_API_KEY },
    body: JSON.stringify({}),
  });
  const contacts = await resp.json();
  console.log(`Fetched ${contacts.length} contacts from Evolution API`);

  // 2. Filter: only individual contacts (not groups)
  const individuals = contacts.filter(c => !c.isGroup && c.remoteJid && c.remoteJid.endsWith("@s.whatsapp.net"));
  console.log(`Individual contacts: ${individuals.length}`);

  let updated = 0;
  let created = 0;
  let customerUpdated = 0;
  let customerCreated = 0;

  for (const c of individuals) {
    const jid = c.remoteJid;
    const phone = jid.split("@")[0];
    const name = (c.pushName || "").trim();
    if (!name || name.length < 2) continue;

    // Update Contact table (accountId=4 for Eric)
    try {
      const contact = await prisma.contact.updateMany({
        where: { accountId: 4, platform: "whatsapp", jid },
        data: { name },
      });
      if (contact.count > 0) updated++;
    } catch (e) { /* not found is ok */ }

    // Upsert Customer table
    try {
      let cust = await prisma.customer.findFirst({ where: { jid } });
      if (!cust) cust = await prisma.customer.findFirst({ where: { phone } });
      if (!cust) {
        await prisma.customer.create({
          data: { userId: 1, phone, jid, name, source: "whatsapp", status: "potential", lastContactAt: new Date() },
        });
        customerCreated++;
      } else if ((!cust.name || cust.name === cust.phone) && name) {
        await prisma.customer.update({ where: { id: cust.id }, data: { name, lastContactAt: new Date() } });
        customerUpdated++;
      }
    } catch (e) { /* ignore */ }
  }

  console.log(`Done! Contact updated: ${updated}, Customer created: ${customerCreated}, Customer updated: ${customerUpdated}`);
}

sync().catch(console.error).finally(() => prisma.$disconnect());
