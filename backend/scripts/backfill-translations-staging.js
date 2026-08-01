import { PrismaClient } from '@prisma/client';
import { detectLanguage, translateText } from '../src/services/ai.service.js';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:./crm-staging.db',
    },
  },
});

async function main() {
  // First check how many need translation
  const countResult = await prisma.wAMessage.count({
    where: {
      direction: 'inbound',
      body: { not: '' },
      type: 'text',
      translation: null,
    },
  });

  console.log(`Found ${countResult} inbound messages without translation\n`);

  // Process in batches
  const batchSize = 50;
  let totalTranslated = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  let offset = 0;

  while (true) {
    const messages = await prisma.wAMessage.findMany({
      where: {
        direction: 'inbound',
        body: { not: '' },
        type: 'text',
        translation: null,
      },
      orderBy: { id: 'desc' },
      take: batchSize,
      skip: offset,
    });

    if (messages.length === 0) break;

    console.log(`Processing batch starting at offset ${offset} (${messages.length} messages)...`);

    for (const msg of messages) {
      try {
        const body = msg.body.trim();
        if (!body) { totalSkipped++; continue; }

        const sourceLang = await detectLanguage(body, 'doubao');
        if (!sourceLang || sourceLang === 'unknown' || sourceLang === 'zh' || sourceLang.startsWith('zh-')) {
          totalSkipped++;
          continue;
        }

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

        totalTranslated++;
        if (totalTranslated % 10 === 0) {
          console.log(`Progress: translated=${totalTranslated}, skipped=${totalSkipped}`);
        }

        await new Promise(r => setTimeout(r, 300));
      } catch (err) {
        totalErrors++;
        console.error(`Error #${msg.id}: ${err.message}`);
      }
    }

    offset += batchSize;
  }

  console.log(`\n=== COMPLETE ===`);
  console.log(`Translated: ${totalTranslated}`);
  console.log(`Skipped: ${totalSkipped}`);
  console.log(`Errors: ${totalErrors}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
