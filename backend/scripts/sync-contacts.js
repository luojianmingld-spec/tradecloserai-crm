#!/usr/bin/env node
/**
 * sync-contacts.js — 从Evolution API拉取所有WA聊天+联系人，自动创建缺失的Customer/Contact/Conversation
 * 用法: node scripts/sync-contacts.js
 */
import { PrismaClient } from "@prisma/client";
import { resolveToPhoneJid, recordLidMapping } from "../src/services/lid-mapping.js";

const prisma = new PrismaClient();
const EVO_API = "http://127.0.0.1:8081";
const EVO_KEY = "B7E2A9D4C6F1E8A3B5D7F9C2E4A6B8D1";
const EVO_INST = "jeremy-main";
const ACCOUNT_ID = 1;
const USER_ID = 1;
const PLATFORM = "whatsapp";
const OWNER_JID = "8613016242602@s.whatsapp.net";

async function evoPost(path, body = {}) {
  const r = await fetch(EVO_API + path, {
    method: "POST",
    headers: { apikey: EVO_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) { const t = await r.text().catch(()=>""); throw new Error("EVO " + r.status + ": " + t.slice(0,300)); }
  return r.json();
}

function normalizeJid(jid) {
  if (!jid) return null;
  if (jid.includes("@lid")) return jid.split(":")[0] + "@lid";
  return jid;
}

function guessCountry(phone) {
  if (phone.startsWith("86")) return "CN";
  if (phone.startsWith("963")) return "SY";
  if (phone.startsWith("91")) return "IN";
  if (phone.startsWith("81")) return "JP";
  if (phone.startsWith("1")) return "US";
  if (phone.startsWith("44")) return "GB";
  if (phone.startsWith("49")) return "DE";
  if (phone.startsWith("33")) return "FR";
  if (phone.startsWith("39")) return "IT";
  if (phone.startsWith("34")) return "ES";
  if (phone.startsWith("7")) return "RU";
  if (phone.startsWith("82")) return "KR";
  if (phone.startsWith("84")) return "VN";
  if (phone.startsWith("66")) return "TH";
  if (phone.startsWith("60")) return "MY";
  if (phone.startsWith("62")) return "ID";
  if (phone.startsWith("63")) return "PH";
  if (phone.startsWith("90")) return "TR";
  if (phone.startsWith("92")) return "PK";
  if (phone.startsWith("880")) return "BD";
  if (phone.startsWith("234")) return "NG";
  if (phone.startsWith("27")) return "ZA";
  if (phone.startsWith("20")) return "EG";
  if (phone.startsWith("254")) return "KE";
  if (phone.startsWith("255")) return "TZ";
  if (phone.startsWith("256")) return "UG";
  if (phone.startsWith("251")) return "ET";
  if (phone.startsWith("212")) return "MA";
  if (phone.startsWith("213")) return "DZ";
  if (phone.startsWith("216")) return "TN";
  if (phone.startsWith("218")) return "LY";
  if (phone.startsWith("221")) return "SN";
  if (phone.startsWith("225")) return "CI";
  if (phone.startsWith("228")) return "TG";
  if (phone.startsWith("233")) return "GH";
  if (phone.startsWith("237")) return "CM";
  if (phone.startsWith("966")) return "SA";
  if (phone.startsWith("971")) return "AE";
  if (phone.startsWith("972")) return "IL";
  if (phone.startsWith("962")) return "JO";
  if (phone.startsWith("961")) return "LB";
  if (phone.startsWith("964")) return "IQ";
  if (phone.startsWith("965")) return "KW";
  if (phone.startsWith("968")) return "OM";
  if (phone.startsWith("974")) return "QA";
  if (phone.startsWith("973")) return "BH";
  if (phone.startsWith("98")) return "IR";
  if (phone.startsWith("52")) return "MX";
  if (phone.startsWith("55")) return "BR";
  if (phone.startsWith("54")) return "AR";
  if (phone.startsWith("56")) return "CL";
  if (phone.startsWith("57")) return "CO";
  if (phone.startsWith("51")) return "PE";
  if (phone.startsWith("593")) return "EC";
  if (phone.startsWith("58")) return "VE";
  if (phone.startsWith("61")) return "AU";
  if (phone.startsWith("64")) return "NZ";
  if (phone.startsWith("509")) return "HT";
  if (phone.startsWith("41")) return "CH";
  if (phone.startsWith("46")) return "SE";
  if (phone.startsWith("47")) return "NO";
  if (phone.startsWith("45")) return "DK";
  if (phone.startsWith("31")) return "NL";
  if (phone.startsWith("32")) return "BE";
  if (phone.startsWith("43")) return "AT";
  if (phone.startsWith("48")) return "PL";
  if (phone.startsWith("420")) return "CZ";
  if (phone.startsWith("36")) return "HU";
  if (phone.startsWith("40")) return "RO";
  if (phone.startsWith("351")) return "PT";
  if (phone.startsWith("30")) return "GR";
  return null;
}

function defaultName(phone, pushName) {
  if (pushName && pushName.trim()) return pushName.trim();
  const c = guessCountry(phone);
  const tail = phone.slice(-4);
  if (c === "CN") return `国内客户${tail}`;
  if (c === "SY") return `叙利亚客户${tail}`;
  if (c === "IN") return `印度客户${tail}`;
  if (c === "JP") return `日本客户${tail}`;
  if (c === "US") return `美国客户${tail}`;
  if (c) return `${c}客户${tail}`;
  return `客户${tail}`;
}

async function main() {
  console.log("=== Sync Evolution contacts/chats to CRM ===\n");

  // 1. 拉contacts
  const contactsRaw = await evoPost(`/chat/findContacts/${EVO_INST}`, {});
  const contacts = Array.isArray(contactsRaw) ? contactsRaw : (contactsRaw.response || contactsRaw.data || []);
  console.log(`[1/3] Fetched ${contacts.length} contacts from Evolution`);

  // 2. 拉chats（含lastMessage）
  const chatsRaw = await evoPost(`/chat/findChats/${EVO_INST}`, { where:{}, page:1, offset:5000, sort:"-conversationTimestamp" });
  const chats = Array.isArray(chatsRaw) ? chatsRaw : (chatsRaw.response || chatsRaw.data || []);
  console.log(`[2/3] Fetched ${chats.length} chats from Evolution`);

  // 3. 建立chatMap（key: normalizedJid）
  const chatMap = new Map();
  for (const c of chats) {
    const jid = normalizeJid(c.remoteJid || c.id);
    if (jid) chatMap.set(jid, c);
  }

  // 4. 先收集新的LID映射：contacts同时有phoneJid和lidJid版本时配对
  // 通过pushName+已知contacts里的双版本
  const phoneEntries = contacts.filter(c => (c.remoteJid||"").includes("@s.whatsapp.net"));
  const lidEntries = contacts.filter(c => (c.remoteJid||"").includes("@lid"));
  let newMappings = 0;
  for (const lidC of lidEntries) {
    const lidJid = normalizeJid(lidC.remoteJid);
    // 已经有映射了？
    if (resolveToPhoneJid(lidJid) !== lidJid) continue;
    // 通过pushName匹配
    if (lidC.pushName) {
      const match = phoneEntries.find(p => p.pushName === lidC.pushName);
      if (match) {
        recordLidMapping(match.remoteJid, lidJid);
        newMappings++;
        console.log(`  [LID Map] ${match.remoteJid} <-> ${lidJid} (matched by pushName=${lidC.pushName})`);
      }
    }
  }
  console.log(`[3/3] Learned ${newMappings} new LID mappings\n`);

  // 5. 同步每个联系人
  let addedCustomers=0, addedContacts=0, addedConversations=0, updated=0, skipped=0, self=0;

  for (const c of contacts) {
    const rawJid = c.remoteJid;
    if (!rawJid) continue;
    if (rawJid.includes("@g.us") || rawJid.includes("@broadcast")) continue;
    if (rawJid === "0@s.whatsapp.net") { continue; }

    const jid = normalizeJid(rawJid);
    const resolvedJid = resolveToPhoneJid(jid);

    // LID无映射
    if (resolvedJid.includes("@lid")) {
      console.log(`  [SKIP] ${jid} pushName="${c.pushName||''}" — no phone JID mapping`);
      skipped++;
      continue;
    }
    // 排除自己
    if (resolvedJid === OWNER_JID) { self++; continue; }

    const pushName = (c.pushName || "").trim();
    const profilePicUrl = c.profilePicUrl || null;
    const phone = resolvedJid.split("@")[0];

    // Contact
    let contact = await prisma.contact.findUnique({
      where: { accountId_platform_jid: { accountId: ACCOUNT_ID, platform: PLATFORM, jid: resolvedJid } }
    });
    if (!contact) {
      try {
        contact = await prisma.contact.create({
          data: { accountId: ACCOUNT_ID, platform: PLATFORM, jid: resolvedJid, phone, pushName, avatarUrl: profilePicUrl }
        });
        addedContacts++;
      } catch(e) {
        contact = await prisma.contact.findUnique({
          where: { accountId_platform_jid: { accountId: ACCOUNT_ID, platform: PLATFORM, jid: resolvedJid } }
        });
      }
    } else {
      const upd = {};
      if (profilePicUrl) upd.avatarUrl = profilePicUrl;
      if (pushName) upd.pushName = pushName;
      if (Object.keys(upd).length) {
        contact = await prisma.contact.update({ where: { id: contact.id }, data: upd });
      }
    }

    // Chat meta
    const chat = chatMap.get(jid) || chatMap.get(resolvedJid);
    let lastMsgContent = null, lastMsgTime = null;
    if (chat) {
      const lm = chat.lastMessage;
      if (lm) {
        const msgObj = lm.message || {};
        if (msgObj.conversation) lastMsgContent = msgObj.conversation;
        else if (msgObj.extendedTextMessage) lastMsgContent = msgObj.extendedTextMessage.text;
        else if (msgObj.reactionMessage) lastMsgContent = "[表情回应]";
        else lastMsgContent = `[${Object.keys(msgObj)[0] || "消息"}]`;
        if (lm.messageTimestamp) lastMsgTime = new Date(lm.messageTimestamp * 1000);
        else if (chat.updatedAt) lastMsgTime = new Date(chat.updatedAt);
      }
    }

    // Conversation
    let conv = await prisma.conversation.findUnique({
      where: { accountId_platform_jid: { accountId: ACCOUNT_ID, platform: PLATFORM, jid: resolvedJid } }
    });
    if (!conv && contact) {
      try {
        await prisma.conversation.create({
          data: {
            accountId: ACCOUNT_ID, platform: PLATFORM, contactId: contact.id, jid: resolvedJid,
            lastMessage: lastMsgContent, lastMessageAt: lastMsgTime,
            unreadCount: chat?.unreadCount || 0,
            pinned: false, starred: false, blocked: false
          }
        });
        addedConversations++;
      } catch(e) {
        console.warn(`    Conv create error for ${resolvedJid}: ${e.message}`);
      }
    } else if (conv) {
      const upd = {};
      if (lastMsgTime) {
        if (!conv.lastMessageAt || new Date(lastMsgTime) > new Date(conv.lastMessageAt)) {
          upd.lastMessage = lastMsgContent;
          upd.lastMessageAt = lastMsgTime;
        }
      }
      if (lastMsgContent && !conv.lastMessage) upd.lastMessage = lastMsgContent;
      if (Object.keys(upd).length) {
        await prisma.conversation.update({ where: { id: conv.id }, data: upd });
      }
    }

    // Customer
    let customer = await prisma.customer.findUnique({
      where: { userId_jid: { userId: USER_ID, jid: resolvedJid } }
    });
    if (!customer) {
      const name = defaultName(phone, pushName);
      customer = await prisma.customer.create({
        data: {
          userId: USER_ID, jid: resolvedJid, name, phone,
          source: "whatsapp",
          country: guessCountry(phone),
          firstContactAt: lastMsgTime || new Date(),
          lastContactAt: lastMsgTime || new Date(),
        }
      });
      addedCustomers++;
      console.log(`  [NEW] ${name} | ${resolvedJid} | ${lastMsgContent?.slice(0,30)||"(no lastMsg)"}`);
    } else {
      const upd = {};
      if (lastMsgTime) {
        if (!customer.lastContactAt || new Date(lastMsgTime) > new Date(customer.lastContactAt)) {
          upd.lastContactAt = lastMsgTime;
        }
      }
      if (!customer.country) upd.country = guessCountry(phone);
      if (Object.keys(upd).length) {
        await prisma.customer.update({ where: { id: customer.id }, data: upd });
        updated++;
      }
    }
  }

  console.log("\n=== Sync Complete ===");
  console.log(`New Customers: ${addedCustomers}`);
  console.log(`New Contacts: ${addedContacts}`);
  console.log(`New Conversations: ${addedConversations}`);
  console.log(`Updated records: ${updated}`);
  console.log(`Skipped (LID w/o mapping): ${skipped}`);
  console.log(`Skipped (self): ${self}`);

  const finalCustomers = await prisma.customer.findMany({
    where: { userId: USER_ID, jid: { contains: "@s.whatsapp.net" } },
    orderBy: { lastContactAt: "desc" }
  });
  console.log(`\nTotal WA Customers in DB: ${finalCustomers.length}`);
  for (const cu of finalCustomers) {
    const t = cu.lastContactAt ? new Date(cu.lastContactAt).toISOString().slice(5,16).replace("T"," ") : "?";
    console.log(`  ${cu.id}. ${cu.name.padEnd(20)} | ${cu.jid.padEnd(30)} | ${t}`);
  }
}

main().catch(e => { console.error("Sync FAILED:", e); process.exit(1); }).finally(() => prisma.$disconnect());
