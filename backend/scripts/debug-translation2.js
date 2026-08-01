import { PrismaClient } from '@prisma/client';
import { detectLanguage, translateText } from '../src/services/ai.service.js';

const prisma = new PrismaClient();

async function main() {
  // Get non-Chinese messages without translation
  const testMessages = await prisma.wAMessage.findMany({
    where: {
      direction: 'inbound',
      body: { not: '' },
      type: 'text',
      translation: null,
      id: { in: [6124, 6089, 6065, 6064, 6063] }
    },
    orderBy: { id: 'desc' },
  });

  console.log(`Testing ${testMessages.length} non-Chinese messages\n`);

  for (const msg of testMessages) {
    console.log(`Message #${msg.id}: "${msg.body}"`);
    
    try {
      const sourceLang = await detectLanguage(msg.body, 'doubao');
      console.log(`  Detected language: ${sourceLang}`);
      
      if (!sourceLang || sourceLang === 'unknown' || sourceLang === 'zh' || sourceLang.startsWith('zh-')) {
        console.log(`  -> Would be skipped`);
      } else {
        console.log(`  -> Would translate to Chinese`);
        const result = await translateText(msg.body, sourceLang, 'zh', 'doubao', 1);
        console.log(`  Translation: ${result.translated}`);
      }
    } catch (err) {
      console.error(`  Error: ${err.message}`);
    }
    console.log('');
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
