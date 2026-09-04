const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  await prisma.whatsAppAccount.update({
    where: { id: 43 },
    data: { instanceName: 'jeremy-eric', waPhone: '+8618038118960', status: 'disconnected' }
  });
  const exists44 = await prisma.whatsAppAccount.findUnique({ where: { id: 44 } });
  if (exists44) await prisma.whatsAppAccount.delete({ where: { id: 44 } });
  const user = await prisma.user.findFirst({ where: { id: 1 } });
  console.log('user:', user ? user.username : 'NOT FOUND');
  const accs = await prisma.whatsAppAccount.findMany();
  accs.forEach(a => console.log('acc:', a.id, a.instanceName, a.status, a.userId));
  await prisma.$disconnect();
}
main().catch(e => { console.error(e.message); prisma.$disconnect(); });
