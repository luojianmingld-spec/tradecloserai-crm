/**
 * 批量同步TG联系人头像（独立运行）
 * 自动连接 userbot，下载头像到本地，更新 Contact.avatarUrl
 * 用法: NODE_ENV=staging node scripts/sync-tg-avatars.js
 */
import { PrismaClient } from "@prisma/client";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbFile = process.env.NODE_ENV === "production"
  ? "/opt/whatsapp-crm/backend/prisma/crm.db"
  : "/opt/whatsapp-crm/backend/prisma/crm-staging.db";

const prisma = new PrismaClient({
  datasources: { db: { url: "file:" + dbFile } }
});

// 从 DB 读取 userbot 配置
const tgAccount = await prisma.whatsAppAccount.findFirst({
  where: { platform: "telegram", telegramBotToken: null },
});
if (!tgAccount) { console.error("No TG userbot account found"); process.exit(1); }

// 读取 GramJS 配置
const stateFile = path.join(__dirname, "../data/tg-userbot/state.json");
const state = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, "utf8")) : {};
const apiId = state.apiId || process.env.TG_API_ID;
const apiHash = state.apiHash || process.env.TG_API_HASH;

if (!apiId || !apiHash) {
  console.error("Missing apiId/apiHash. Check data/tg-userbot/state.json or env vars.");
  process.exit(1);
}

console.log("[Avatar Sync] Connecting userbot...");
const ubModule = await import("../src/services/tg-userbot-connector.js");
const me = await ubModule.autoConnectUserBot({
  apiId, apiHash,
  onEvent: { onReady: (m) => console.log("[Avatar Sync] Userbot ready as:", m.username || m.id) },
});

if (!me) {
  console.error("[Avatar Sync] Failed to connect userbot");
  process.exit(1);
}

// 等连接稳定
await new Promise(r => setTimeout(r, 2000));

if (!ubModule.isConnected()) {
  console.error("[Avatar Sync] Userbot not connected after autoConnect");
  process.exit(1);
}

console.log("[Avatar Sync] Userbot connected as", me.username || me.id);

// 创建头像目录
const avatarDir = path.join(__dirname, "../uploads/tg-avatars");
if (!fs.existsSync(avatarDir)) fs.mkdirSync(avatarDir, { recursive: true });

// 找所有没有头像的TG联系人
const contacts = await prisma.contact.findMany({
  where: { platform: "telegram", avatarUrl: null },
});
console.log(`[Avatar Sync] Found ${contacts.length} contacts without avatar.`);

let updated = 0, skipped = 0, failed = 0;

for (let i = 0; i < contacts.length; i++) {
  const c = contacts[i];
  const peerId = c.jid.replace("@telegram", "");
  try {
    const avatarUrl = await ubModule.downloadProfilePhoto(peerId);
    if (avatarUrl) {
      await prisma.contact.update({ where: { id: c.id }, data: { avatarUrl } });
      updated++;
      console.log(`  [${i+1}/${contacts.length}] OK ${c.name} -> ${avatarUrl}`);
    } else {
      skipped++;
      console.log(`  [${i+1}/${contacts.length}] SKIP ${c.name} (no photo)`);
    }
  } catch (e) {
    failed++;
    console.log(`  [${i+1}/${contacts.length}] FAIL ${c.name}: ${e.message}`);
  }
  if (i < contacts.length - 1) await new Promise(r => setTimeout(r, 300));
}

console.log(`\n[Avatar Sync] Done! updated=${updated}, skipped=${skipped}, failed=${failed}`);
await prisma.$disconnect();
