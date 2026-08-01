import { PrismaClient } from "@prisma/client";

const EVO_API_URL = "http://127.0.0.1:8081";
const EVO_API_KEY = "B7E2A9D4C6F1E8A3B5D7F9C2E4A6B8D1";
const prisma = new PrismaClient();

async function sync() {
  const resp = await fetch(`${EVO_API_URL}/chat/findContacts/jeremy-main`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: EVO_API_KEY },
    body: JSON.stringify({}),
  });
  const contacts = await resp.json();
  console.log(`Main: fetched ${contacts.length} contacts`);

  const individuals = contacts.filter(c => !c.isGroup && c.remoteJid && c.remoteJid.endsWith("@s.whatsapp.net"));
  console.log(`Main: individual contacts: ${individuals.length}`);

  let updated = 0;
  for (const c of individuals) {
    const jid = c.remoteJid;
    const name = (c.pushName || "").trim();
    if (!name || name.length < 2) continue;

    const r = await prisma.contact.updateMany({
      where: { accountId: 1, platform: "whatsapp", jid },
      data: { name },
    });
    if (r.count > 0) updated++;

    // Also upsert Customer
    const phone = jid.split("@")[0];
    let cust = await prisma.customer.findFirst({ where: { jid } });
    if (!cust) cust = await prisma.customer.findFirst({ where: { phone } });
    if (!cust) {
      await prisma.customer.create({ data: { userId: 1, phone, jid, name, source: "whatsapp", status: "potential", lastContactAt: new Date() } });
    } else if ((!cust.name || cust.name === cust.phone) && name) {
      await prisma.customer.update({ where: { id: cust.id }, data: { name } });
    }
  }
  console.log(`Main: Contact updated: ${updated}`);
}

sync().catch(console.error).finally(() => prisma.$disconnect());
