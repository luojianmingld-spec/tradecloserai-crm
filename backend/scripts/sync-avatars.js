import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const EVO_API_URL = process.env.EVOLUTION_API_URL || 'http://127.0.0.1:8081';
const EVO_API_KEY = process.env.EVOLUTION_API_KEY || 'B7E2A9D4C6F1E8A3B5D7F9C2E4A6B8D1';
const INSTANCES = ['jeremy-main', 'jeremy-eric'];

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchProfilePicUrl(number, instance) {
  try {
    const r = await fetch(`${EVO_API_URL}/chat/fetchProfilePictureUrl/${encodeURIComponent(instance)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: EVO_API_KEY },
      body: JSON.stringify({ number }),
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) return null;
    const d = await r.json();
    return d?.profilePictureUrl || d?.pictureUrl || d?.picture || d?.url || null;
  } catch { return null; }
}

async function main() {
  const contacts = await prisma.contact.findMany({
    where: { platform: 'whatsapp', OR: [{ avatarUrl: null }, { avatarUrl: '' }] },
    select: { id: true, jid: true },
  });

  console.log(`Found ${contacts.length} contacts without avatar`);

  let updated = 0, noPic = 0;

  for (const c of contacts) {
    const number = c.jid.split('@')[0];
    let picUrl = null;

    for (const inst of INSTANCES) {
      picUrl = await fetchProfilePicUrl(number, inst);
      if (picUrl) break;
      await sleep(200);
    }

    if (picUrl) {
      await prisma.contact.update({ where: { id: c.id }, data: { avatarUrl: picUrl } });
      updated++;
      console.log(`[${updated}/${contacts.length}] OK ${number}: ${picUrl.substring(0, 60)}`);
    } else {
      noPic++;
      console.log(`[${updated + noPic}/${contacts.length}] -- ${number}: no pic`);
    }

    await sleep(300);
  }

  console.log(`\nDone: ${updated} updated, ${noPic} no pic`);
}

main().catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
