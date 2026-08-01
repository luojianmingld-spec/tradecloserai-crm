import { PrismaClient } from '@prisma/client';
import { detectLanguage, translateText } from '../src/services/ai.service.js';

const prisma = new PrismaClient();

async function main() {
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
      console.log(`  Detected: ${sourceLang}`);
      
      if (!sourceLang || sourceLang === 'unknown' || sourceLang === 'zh' || sourceLang.startsWith('zh-')) {
        console.log(`  SKIP: Chinese or unknown\n`);
        continue;
      }

      console.log(`  Translating...`);
      const result = await translateText(msg.body, sourceLang, 'zh', 'doubao', 1);
      console.log(`  Result: ${result.translated}\n`);
    } catch (err) {
      console.error(`  Error: ${err.message}\n`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
