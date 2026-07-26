const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async()=>{
  const rows = await prisma.customer.findMany({
    where: { OR: [{ jid: { contains: '8613016242602' } }, { phone: { contains: '8613016242602' } }] },
    select: { id: true, jid: true, phone: true, name: true, companyName: true, contactName: true }
  });
  console.log('found:', JSON.stringify(rows, null, 2));
  for (const r of rows) {
    console.log('deleting id=' + r.id + ' jid=' + r.jid);
    if (r.jid) {
      try { await prisma.wAMessage.deleteMany({ where: { OR: [{ from: r.jid }, { to: r.jid }] } }); } catch(e){}
    }
    try { await prisma.customer.delete({ where: { id: r.id } }); } catch(e){ console.log('del err:', e.message); }
  }
  console.log('done');
  await prisma.$disconnect();
})();
