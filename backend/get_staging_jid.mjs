import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const convs = await p.conversation.findMany({ where: { platform: 'whatsapp' }, take: 5, orderBy: { updatedAt: 'desc' }, select: { id: true, accountId: true, jid: true } });
console.log('convs:', JSON.stringify(convs));
const msgs = await p.wAMessage.findMany({ where: { sessionId: 'user_1' }, take: 2, select: { sessionId: true, from: true, to: true } });
console.log('msgs u1:', JSON.stringify(msgs));
const msgs2 = await p.wAMessage.findMany({ where: { sessionId: 'user_2' }, take: 2, select: { sessionId: true, from: true, to: true } });
console.log('msgs u2:', JSON.stringify(msgs2));
await p.$disconnect();
