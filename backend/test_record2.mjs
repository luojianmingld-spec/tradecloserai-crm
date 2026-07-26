import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const msg = await prisma.wAMessage.findUnique({ where: { id: 3664 } });
console.log('msg.translation type:', typeof msg.translation);
console.log('msg.translation:', msg.translation);
function parseTranslation(transField) {
  if (!transField) { console.log('transField is falsy'); return null; }
  try {
    const obj = typeof transField === 'string' ? JSON.parse(transField) : transField;
    console.log('parsed obj:', obj);
    if (!obj || typeof obj !== 'object') return null;
    return {
      original: typeof obj.original === 'string' ? obj.original : null,
      translated: typeof obj.translated === 'string' ? obj.translated : null,
      sourceLang: typeof obj.sourceLang === 'string' ? obj.sourceLang : null,
      targetLang: typeof obj.targetLang === 'string' ? obj.targetLang : null,
    };
  } catch (e) { console.log('parse error:', e.message); return null; }
}
const t = parseTranslation(msg.translation);
console.log('parseTranslation result:', t);
await prisma.$disconnect();
