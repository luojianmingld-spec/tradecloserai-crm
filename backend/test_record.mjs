import { recordSample } from './src/services/speech-collector.js';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const msg = await prisma.wAMessage.findUnique({ where: { id: 3664 } });
console.log('calling recordSample with id=3664 body=', msg.body.slice(0,40));
recordSample(msg);
setTimeout(async () => {
  const samples = await prisma.messageSample.findMany({ orderBy: { id: 'desc' }, take: 3 });
  for (const s of samples) {
    console.log('sample id=', s.id, 'salesReplyLang=', JSON.stringify(s.salesReplyLang), 'salesReplyTranslated=', s.salesReplyTranslated ? s.salesReplyTranslated.slice(0,40) : null);
  }
  await prisma.$disconnect();
  process.exit(0);
}, 3000);
