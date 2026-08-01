/**
 * Fix @lid JIDs in WAMessage table:
 * 1. Scan all Evolution API messages to build LID -> phone JID mapping
 * 2. Update WAMessage from/to fields to use phone JIDs
 * 3. Also update lid-mapping.json
 */
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LID_MAP_FILE = path.join(__dirname, '../../data/lid-mapping.json');
const prisma = new PrismaClient();

const EVO_BASE = 'http://127.0.0.1:8081';
const EVO_APIKEY = 'B7E2A9D4C6F1E8A3B5D7F9C2E4A6B8D1';
const INSTANCE = 'jeremy-eric';
const SESSION_ID = 'user_2';

async function fetchAllMessagesForMapping() {
  const lidToPhone = new Map();
  let page = 1;
  let totalPages = 1;
  
  while (page <= totalPages) {
    const res = await fetch(`${EVO_BASE}/chat/findMessages/${INSTANCE}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: EVO_APIKEY },
      body: JSON.stringify({ pageSize: 100, page }),
    });
    if (!res.ok) break;
    const data = await res.json();
    const msgs = data.messages;
    if (!msgs) break;
    totalPages = msgs.pages || 1;
    
    for (const msg of (msgs.records || [])) {
      const key = msg.key || {};
      const remoteJid = key.remoteJid || '';
      const remoteJidAlt = key.remoteJidAlt || '';
      
      if (remoteJid.includes('@lid') && remoteJidAlt.includes('@s.whatsapp.net')) {
        const lidBase = remoteJid.split(':')[0] + '@lid';
        lidToPhone.set(lidBase, remoteJidAlt);
      }
    }
    
    if (page % 20 === 0) {
      console.log(`  Scanning page ${page}/${totalPages}, found ${lidToPhone.size} LID mappings...`);
    }
    page++;
  }
  
  return lidToPhone;
}

async function main() {
  console.log('=== Step 1: Scanning Evolution API for LID->phone mappings ===');
  const lidToPhone = await fetchAllMessagesForMapping();
  console.log(`Found ${lidToPhone.size} unique LID->phone mappings`);
  
  // Also load existing lid-mapping.json for any extra mappings
  try {
    const existing = JSON.parse(fs.readFileSync(LID_MAP_FILE, 'utf8'));
    for (const [k, v] of Object.entries(existing)) {
      if (k.includes('@lid') && v.includes('@s.whatsapp.net') && !lidToPhone.has(k)) {
        const lidBase = k.split(':')[0] + '@lid';
        lidToPhone.set(lidBase, v);
      }
    }
  } catch (e) {}
  
  console.log(`Total mappings available: ${lidToPhone.size}`);
  
  // Print the mapping
  for (const [lid, phone] of lidToPhone) {
    console.log(`  ${lid} -> ${phone}`);
  }
  
  // Step 2: Find all messages with @lid in from/to
  console.log('\n=== Step 2: Fixing messages with @lid JIDs ===');
  
  const lidMessages = await prisma.wAMessage.findMany({
    where: {
      sessionId: SESSION_ID,
      OR: [
        { from: { endsWith: '@lid' } },
        { to: { endsWith: '@lid' } },
      ],
    },
  });
  
  console.log(`Found ${lidMessages.length} messages with @lid JIDs`);
  
  let fixedCount = 0;
  let unmappedCount = 0;
  const unmappedLids = new Set();
  
  for (const msg of lidMessages) {
    const updates = {};
    
    if (msg.from.endsWith('@lid')) {
      const lidBase = msg.from.split(':')[0] + '@lid';
      const phoneJid = lidToPhone.get(lidBase);
      if (phoneJid) {
        updates.from = phoneJid;
      } else {
        unmappedLids.add(lidBase);
        unmappedCount++;
      }
    }
    
    if (msg.to.endsWith('@lid')) {
      const lidBase = msg.to.split(':')[0] + '@lid';
      const phoneJid = lidToPhone.get(lidBase);
      if (phoneJid) {
        updates.to = phoneJid;
      } else {
        unmappedLids.add(lidBase);
        unmappedCount++;
      }
    }
    
    if (Object.keys(updates).length > 0) {
      await prisma.wAMessage.update({
        where: { id: msg.id },
        data: updates,
      });
      fixedCount++;
    }
  }
  
  console.log(`\nFixed: ${fixedCount} messages`);
  console.log(`Unmapped: ${unmappedCount} message-field(s)`);
  console.log(`Unmapped LIDs: ${[...unmappedLids].join(', ')}`);
  
  // Step 3: Update lid-mapping.json
  console.log('\n=== Step 3: Updating lid-mapping.json ===');
  let existingMap = {};
  try {
    existingMap = JSON.parse(fs.readFileSync(LID_MAP_FILE, 'utf8'));
  } catch (e) {}
  
  for (const [lid, phone] of lidToPhone) {
    existingMap[lid] = phone;
    existingMap[phone] = lid;
  }
  
  fs.writeFileSync(LID_MAP_FILE, JSON.stringify(existingMap, null, 2));
  console.log(`lid-mapping.json updated with ${lidToPhone.size} new mappings`);
  
  await prisma.$disconnect();
  console.log('\nDone!');
}

main().catch(e => { console.error(e); process.exit(1); });
