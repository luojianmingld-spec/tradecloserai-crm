// Replicate the exact code path using the recordSample from the running service
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const outbound = await prisma.wAMessage.findUnique({ where: { id: 3666 } });
console.log('saved object keys:', Object.keys(outbound));
console.log('body:', outbound.body);
console.log('translation:', outbound.translation);
console.log('sourceLang:', outbound.sourceLang);
console.log('to:', outbound.to);
console.log('direction:', outbound.direction);
console.log('timestamp:', outbound.timestamp);

// Import the collector
const { recordSample } = await import('./src/services/speech-collector.js');
// Clear in-memory dedupe by deleting collectedIds — can't access; use a new waMessageId simulation
// Instead, let's just directly patch log by running _doRecord-equivalent
function parseTranslation(transField) {
  if (!transField) return null;
  try {
    const obj = typeof transField === 'string' ? JSON.parse(transField) : transField;
    if (!obj || typeof obj !== 'object') return null;
    return {
      original: typeof obj.original === 'string' ? obj.original : null,
      translated: typeof obj.translated === 'string' ? obj.translated : null,
      sourceLang: typeof obj.sourceLang === 'string' ? obj.sourceLang : null,
      targetLang: typeof obj.targetLang === 'string' ? obj.targetLang : null,
    };
  } catch { return null; }
}
const ot = parseTranslation(outbound.translation);
console.log('parsed outboundTrans:', ot);
let salesReply = String(outbound.body || '').trim();
let srt = null;
let srl = outbound.sourceLang || null;
if (ot) {
  console.log('cond: translated=', !!ot.translated, 'original=', !!ot.original, 'neq=', ot.translated !== ot.original);
  if (ot.translated && ot.original && ot.translated !== ot.original) {
    console.log('BRANCH A: translated');
    salesReply = ot.translated;
    srt = ot.original;
    srl = ot.targetLang || ot.sourceLang || null;
  } else {
    console.log('BRANCH B: no translate');
    srt = null;
    srl = ot.sourceLang || null;
  }
}
console.log('result: srt=', srt, 'srl=', srl);
await prisma.$disconnect();
