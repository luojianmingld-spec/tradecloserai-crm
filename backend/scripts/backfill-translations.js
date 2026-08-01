import { PrismaClient } from '@prisma/client';
import { detectLanguage, translateText } from '../src/services/ai.service.js';

const prisma = new PrismaClient();

async function main() {
  // Process all remaining inbound messages without translation
  const batchSize = 100;
  let totalTranslated = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  let batch = 1;

  while (true) {
    const noTranslationInbound = await prisma.wAMessage.findMany({
      where: {
        direction: 'inbound',
        body: { not: '' },
        type: 'text',
        translation: null,
      },
      orderBy: { id: 'desc' },
      take: batchSize,
    });

    if (noTranslationInbound.length === 0) {
      console.log('No more messages to translate!');
      break;
    }

    console.log(`\n=== Batch ${batch}: Processing ${noTranslationInbound.length} messages ===`);

    let translated = 0;
    let skipped = 0;
    let errors = 0;

    for (const msg of noTranslationInbound) {
      try {
        const body = msg.body.trim();
        if (!body) { skipped++; continue; }

        // Detect language
        const sourceLang = await detectLanguage(body, 'doubao');
        if (!sourceLang || sourceLang === 'unknown' || sourceLang === 'zh' || sourceLang.startsWith('zh-')) {
          skipped++;
          continue;
        }

        // Translate to Chinese
        const result = await translateText(body, sourceLang, 'zh', 'doubao', 1);
        const transObj = JSON.stringify({
          original: body,
          translated: result.translated,
          sourceLang,
          targetLang: 'zh'
        });

        await prisma.wAMessage.update({
          where: { id: msg.id },
          data: { translation: transObj, sourceLang }
        });

        translated++;
        if (translated % 10 === 0) {
          console.log(`Progress: ${translated}/${noTranslationInbound.length}`);
        }

        // Shorter delay: 300ms
        await new Promise(r => setTimeout(r, 300));
      } catch (err) {
        errors++;
        console.error(`Error on #${msg.id}: ${err.message}`);
      }
    }

    totalTranslated += translated;
    totalSkipped += skipped;
    totalErrors += errors;
    batch++;

    console.log(`Batch ${batch-1} done: translated=${translated}, skipped=${skipped}, errors=${errors}`);
  }

  console.log(`\n=== FINAL SUMMARY ===`);
  console.log(`Total translated: ${totalTranslated}`);
  console.log(`Total skipped: ${totalSkipped}`);
  console.log(`Total errors: ${totalErrors}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
