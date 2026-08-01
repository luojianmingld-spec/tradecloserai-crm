
import { PrismaClient } from '@prisma/client';
import { getTelegramConnector } from './src/services/telegram-connector.js';

const prisma = new PrismaClient();

async function fetchAvatar(connector, userId) {
  try {
    const photos = await connector.getUserProfilePhotos(userId, 1);
    if (photos && photos.total_count > 0 && photos.photos && photos.photos[0]) {
      const sizes = photos.photos[0];
      const bestFile = sizes[sizes.length - 1];
      if (bestFile && bestFile.file_id) {
        const fileInfo = await connector.getFile(bestFile.file_id);
        return fileInfo.downloadUrl || null;
      }
    }
  } catch(e) {
    // ignore - privacy settings or rate limit
  }
  return null;
}

async function main() {
  // Find TG accounts with tokens
  const accounts = await prisma.whatsAppAccount.findMany({
    where: { platform: 'telegram', telegramBotToken: { not: null }, status: 'connected' },
  });
  console.log(`Found ${accounts.length} connected TG accounts with tokens`);

  let totalUpdated = 0;
  let totalSkipped = 0;
  let totalFailed = 0;

  for (const account of accounts) {
    const connector = getTelegramConnector(account.telegramBotToken);
    console.log(`\n--- Account: ${account.telegramBotUsername || account.id} ---`);

    // Find contacts without avatarUrl
    const contacts = await prisma.contact.findMany({
      where: {
        accountId: account.id,
        platform: 'telegram',
        OR: [
          { avatarUrl: null },
          { avatarUrl: '' },
        ],
      },
      select: { id: true, jid: true, name: true },
    });

    console.log(`Contacts without avatar: ${contacts.length}`);

    for (const contact of contacts) {
      const userId = parseInt(contact.jid.replace('@telegram', ''));
      if (isNaN(userId)) {
        totalSkipped++;
        continue;
      }

      const avatarUrl = await fetchAvatar(connector, userId);
      if (avatarUrl) {
        await prisma.contact.update({
          where: { id: contact.id },
          data: { avatarUrl },
        });
        totalUpdated++;
        console.log(`  ✅ ${contact.name} (${contact.jid}) -> ${avatarUrl.substring(0, 60)}...`);
      } else {
        totalFailed++;
        console.log(`  ❌ ${contact.name} (${contact.jid}) -> no avatar`);
      }

      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 200));
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Updated: ${totalUpdated}`);
  console.log(`Failed (no avatar/privacy): ${totalFailed}`);
  console.log(`Skipped: ${totalSkipped}`);

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
