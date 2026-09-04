import { PrismaClient } from '@prisma/client';
import { inferCountry } from './src/utils/phone-country.js';
const prisma = new PrismaClient();
const rows = await prisma.customer.findMany({ where: { OR: [{ country: null }, { country: '' }] }, select: { id: true, phone: true, jid: true } });
let updated = 0, skipped = 0;
for (const r of rows) {
  if (r.jid && r.jid.includes('@lid')) { skipped++; continue; }
  const c = inferCountry(r.phone);
  if (c) { await prisma.customer.update({ where: { id: r.id }, data: { country: c } }); updated++; }
  else skipped++;
}
console.log('backfill done', JSON.stringify({ updated, skipped }));
await prisma.$disconnect();
