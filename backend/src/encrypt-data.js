
import { encrypt, isEncrypted } from './utils/encryption.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  let encrypted = 0;

  // 1. 加密 Setting 中的 ai_providers (含 API Key)
  const settings = await prisma.setting.findMany({
    where: { key: 'ai_providers' }
  });
  for (const s of settings) {
    if (s.value && !isEncrypted(s.value)) {
      // 检查是否包含 apiKey 字段
      if (s.value.includes('apiKey') || s.value.includes('api_key')) {
        const encValue = encrypt(s.value);
        await prisma.setting.update({
          where: { id: s.id },
          data: { value: encValue }
        });
        encrypted++;
        console.log(`[OK] Setting id=${s.id} ai_providers encrypted`);
      }
    }
  }

  // 2. 加密 EmailAccount.password
  const emails = await prisma.emailAccount.findMany();
  for (const e of emails) {
    if (e.password && !isEncrypted(e.password)) {
      const encPwd = encrypt(e.password);
      await prisma.emailAccount.update({
        where: { id: e.id },
        data: { password: encPwd }
      });
      encrypted++;
      console.log(`[OK] EmailAccount id=${e.id} password encrypted`);
    }
  }

  // 3. 加密 WhatsAppAccount.telegramBotToken
  const waAccounts = await prisma.whatsAppAccount.findMany({
    where: { telegramBotToken: { not: null } }
  });
  for (const wa of waAccounts) {
    if (wa.telegramBotToken && !isEncrypted(wa.telegramBotToken)) {
      const encToken = encrypt(wa.telegramBotToken);
      await prisma.whatsAppAccount.update({
        where: { id: wa.id },
        data: { telegramBotToken: encToken }
      });
      encrypted++;
      console.log(`[OK] WhatsAppAccount id=${wa.id} telegramBotToken encrypted`);
    }
  }

  console.log(`\n=== Done: ${encrypted} records encrypted ===`);
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
