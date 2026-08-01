import { PrismaClient } from '@prisma/client';
import { detectLanguage, translateText } from '../src/services/ai.service.js';

const prisma = new PrismaClient();

async function main() {
  // Get a few messages to test
  const testMessages = await prisma.wAMessage.findMany({
    where: {
      direction: 'inbound',
      body: { not: '' },
      type: 'text',
      translation: null,
    },
    orderBy: { id: 'desc' },
    take: 5,
  });

  console.log(`Testing ${testMessages.length} messages\n`);

  for (const msg of testMessages) {
    console.log(`Message #${msg.id}: "${msg.body}"`);
    
    try {
      const sourceLang = await detectLanguage(msg.body, 'doubao');
      console.log(`  Detected language: ${sourceLang}`);
      
      if (!sourceLang || sourceLang === 'unknown' || sourceLang === 'zh' || sourceLang.startsWith('zh-')) {
        console.log(`  -> Skipping (no translation needed)`);
      } else {
        console.log(`  -> Would translate to Chinese`);
      }
    } catch (err) {
      console.error(`  Error: ${err.message}`);
    }
    console.log('');
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
