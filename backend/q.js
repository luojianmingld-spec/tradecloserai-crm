const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  try {
    const r = await p.wAMessage.findMany({
      where: {
        OR: [
          { to: { contains: '817038423105' } },
          { from: { contains: '817038423105' } },
        ],
      },
      orderBy: { id: 'desc' },
      take: 8,
      select: { id: true, waMessageId: true, type: true, fileName: true, body: true, direction: true, timestamp: true, mediaUrl: true },
    });
    console.log('=== 817038423105 最近8条消息 ===');
    console.log(JSON.stringify(r, null, 2));
    
    // 看今天所有 outbound document
    const today = new Date('2026-07-16T00:00:00+08:00');
    const docs = await p.wAMessage.findMany({
      where: { direction: 'outbound', type: 'document', timestamp: { gte: today } },
      orderBy: { id: 'desc' },
      take: 5,
      select: { id: true, waMessageId: true, fileName: true, to: true, from: true, body: true, timestamp: true },
    });
    console.log('\n=== 今日出站document ===');
    console.log(JSON.stringify(docs, null, 2));
  } catch (e) {
    console.error(e.message);
  } finally {
    await p.$disconnect();
  }
})();
