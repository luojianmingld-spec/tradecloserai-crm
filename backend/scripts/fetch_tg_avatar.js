const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const fs = require('fs');
const path = require('path');

async function main() {
  const apiId = 33683021;
  const apiHash = 'c0fba584709b3b8ec13c0a5e18b94f75';
  const sessionStr = fs.readFileSync(path.join(__dirname, '..', '.tg_session'), 'utf-8').trim();
  
  const client = new TelegramClient(
    new StringSession(sessionStr),
    apiId,
    apiHash,
    { connectionRetries: 3 }
  );
  
  await client.connect();
  const me = await client.getMe();
  console.log('User:', me.username, me.id);
  
  // Try to download profile photo
  try {
    const result = await client.downloadProfilePhoto(me, {
      outputFile: '/opt/whatsapp-crm/backend/public/tg_avatar.jpg'
    });
    if (result) {
      console.log('Avatar downloaded to /opt/whatsapp-crm/backend/public/tg_avatar.jpg');
    } else {
      console.log('No profile photo found');
    }
  } catch(e) {
    console.error('Failed to download avatar:', e.message);
  }
  
  await client.disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
