#!/usr/bin/env node
/**
 * Batch translate TG messages: find untranslated messages and add Chinese translations
 * Run on server: cd /opt/whatsapp-crm/backend && node scripts/translate-tg-messages.js
 */
import { PrismaClient } from '@prisma/client';
import { translateText } from '../src/services/ai.service.js';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting TG message batch translation...');
  
  // Find all TG messages without translation
  const untranslated = await prisma.wAMessage.findMany({
    where: {
      sessionId: { startsWith: 'tg_' },
      translation: null,
      body: { not: '' },
    },
    orderBy: { timestamp: 'desc' },
    take: 200, // Process most recent 200 messages
  });
  
  console.log(`Found ${untranslated.length} untranslated messages`);
  
  let translated = 0;
  let errors = 0;
  
  for (const msg of untranslated) {
    if (!msg.body || msg.body.length < 2) continue;
    
    try {
      const result = await translateText(msg.body, 'auto', 'zh', 'google', 1);
      const translatedText = result?.translated || result?.text || '';
      
      if (translatedText && translatedText !== msg.body) {
        const translationObj = {
          original: msg.body,
          translated: translatedText,
          sourceLang: result?.sourceLang || 'auto',
          targetLang: 'zh',
        };
        
        await prisma.wAMessage.update({
          where: { id: msg.id },
          data: {
            translation: JSON.stringify(translationObj),
            sourceLang: result?.sourceLang || 'auto',
          },
        });
        translated++;
        
        // Rate limiting - avoid hitting translation API too fast
        if (translated % 10 === 0) {
          console.log(`  Progress: ${translated}/${untranslated.length} translated...`);
          await new Promise(r => setTimeout(r, 500));
        }
      }
    } catch (e) {
      errors++;
      if (errors <= 3) console.error(`  Error translating msg ${msg.id}: ${e.message}`);
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  
  console.log(`\nTranslation complete! Translated: ${translated}, Errors: ${errors}`);
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
}).finally(() => prisma.$disconnect());
