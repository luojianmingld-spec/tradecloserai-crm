const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const wa = await p.wAConnection.findMany({ select: { sessionId: true, phone: true, userId: true } });
  console.log('wAConnection:', JSON.stringify(wa));
  const conv = await p.conversation.groupBy({ by: ['accountId'], _count: true });
  console.log('Conversation by accountId:', JSON.stringify(conv));
  const acc = await p.whatsAppAccount.findMany({ select: { id: true, instanceName: true, phone: true, status: true, platform: true } });
  console.log('WhatsAppAccount:', JSON.stringify(acc));
  await p.$disconnect();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
