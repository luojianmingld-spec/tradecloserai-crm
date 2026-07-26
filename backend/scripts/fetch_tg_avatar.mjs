import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '../data/tg-userbot');
const sessionStr = fs.readFileSync(path.join(DATA_DIR, 'session.txt'), 'utf-8').trim();

const client = new TelegramClient(
  new StringSession(sessionStr),
  33683021,
  'c0fba584709b3b8ec13c0a5e18b94f75',
  { connectionRetries: 3, useWSS: false, timeout: 30000 }
);

await client.connect();
const me = await client.getMe();
console.log('User:', me.username, me.id);

const outPath = path.join(__dirname, '../public/tg_avatar.jpg');
try {
  const result = await client.downloadProfilePhoto(me, { outputFile: outPath });
  if (result) {
    console.log('Avatar saved to', outPath);
    const stat = fs.statSync(outPath);
    console.log('File size:', stat.size, 'bytes');
  } else {
    console.log('No profile photo found');
  }
} catch(e) {
  console.error('Failed:', e.message);
}

await client.disconnect();
