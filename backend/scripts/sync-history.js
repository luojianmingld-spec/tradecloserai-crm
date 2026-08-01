/**
 * sync-history.js — 从 Evolution API 拉取两个实例的所有历史消息，同步到 CRM 生产数据库
 * 用法: node scripts/sync-history.js [--dry-run] [--instance jeremy-main|jeremy-eric|all]
 */
import { PrismaClient } from "@prisma/client";

const USE_STAGING = process.argv.includes('--staging');
const prisma = new PrismaClient({
  datasources: USE_STAGING
    ? { db: { url: 'file:/opt/whatsapp-crm/backend/prisma/crm-staging.db' } }
    : undefined,
});
if (USE_STAGING) console.log('[INFO] 写入 STAGING 数据库');

// ============ 配置 ============
const EVO_BASE = "http://127.0.0.1:8081";
const EVO_APIKEY = "B7E2A9D4C6F1E8A3B5D7F9C2E4A6B8D1";
const PAGE_SIZE = 100; // 每页拉取条数

const INSTANCES = {
  "jeremy-main": {
    instanceId: "6660ac20-3b72-42e6-b187-d36223fb931d",
    ownerJid: "8613016242602@s.whatsapp.net",
    sessionId: "user_1",
  },
  "jeremy-eric": {
    instanceId: "33140250-e3c1-4e57-862d-853e703eb552",
    ownerJid: "8618038118960@s.whatsapp.net",
    sessionId: "user_2",
  },
};

// ============ 参数解析 ============
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const instArg = args.indexOf("--instance");
const TARGET_INSTANCE = instArg !== -1 ? args[instArg + 1] : "all";

if (DRY_RUN) console.log("[INFO] DRY-RUN 模式，不写入数据库\n");

// ============ 工具函数 ============
function jidToPhone(jid) {
  return (jid || "").split("@")[0];
}
function isGroup(jid) {
  return (jid || "").includes("@g.us");
}

function resolveRealJid(msg, fallbackJid) {
  const key = msg?.key || {};
  const alt = key.remoteJidAlt;
  const rawJid = key.remoteJid || fallbackJid;
  if (alt && alt.includes("@s.whatsapp.net")) return alt;
  return fallbackJid;
}

function evoTsToDate(ts) {
  if (!ts) return new Date();
  const n = typeof ts === "object" ? ts.low : Number(ts);
  return new Date(n > 1e12 ? n : n * 1000);
}

function _findMediaContainer(m) {
  const kindMap = {
    imageMessage: "image",
    documentMessage: "document",
    videoMessage: "video",
    audioMessage: "audio",
    stickerMessage: "sticker",
  };
  for (const k of Object.keys(kindMap)) {
    if (m[k] && typeof m[k] === "object") return { container: m[k], kind: kindMap[k] };
  }
  for (const topKey of Object.keys(m)) {
    const top = m[topKey];
    if (!top || typeof top !== "object") continue;
    for (const k of Object.keys(kindMap)) {
      if (top[k] && typeof top[k] === "object") {
        return { container: { ...top[k], caption: top[k].caption || top.caption || null }, kind: kindMap[k] };
      }
    }
  }
  return null;
}

function _toB64(v) {
  if (v == null) return null;
  if (typeof v === "string") return v;
  return null; // 简化处理，历史同步不需要解密
}

function _extractMediaMeta(container) {
  if (!container || typeof container !== "object") return null;
  const flRaw = container.fileLength;
  let fileLength = null;
  if (typeof flRaw === "number") fileLength = flRaw;
  else if (flRaw && typeof flRaw === "object") {
    const low = typeof flRaw.low === "number" ? flRaw.low : 0;
    const high = typeof flRaw.high === "number" ? flRaw.high : 0;
    fileLength = (high * 0x100000000) + low;
    if (fileLength < 0) fileLength = low;
  }
  return {
    mediaKey: _toB64(container.mediaKey),
    directPath: typeof container.directPath === "string" ? container.directPath : null,
    mediaEncUrl: typeof container.url === "string" ? container.url : null,
    fileEncSha256: _toB64(container.fileEncSha256),
    fileSha256: _toB64(container.fileSha256),
    fileLength: Number.isFinite(fileLength) ? fileLength : null,
    mimeType: typeof container.mimetype === "string" ? container.mimetype : null,
    fileName: typeof container.fileName === "string" ? container.fileName : null,
  };
}

function extractBody(msg) {
  const m = msg.message || {};
  const t = msg.messageType;
  if (m.conversation) return { body: m.conversation, type: "text" };
  if (m.extendedTextMessage) return { body: m.extendedTextMessage.text || "", type: "text" };

  const media = _findMediaContainer(m);
  if (media) {
    const meta = _extractMediaMeta(media.container);
    const mediaUrl = meta?.mediaEncUrl || media.container.url || media.container.directPath || null;
    if (media.kind === "image") {
      return {
        body: media.container.caption || "[图片]", type: "image", mediaUrl,
        mimeType: meta?.mimeType || "image/jpeg", fileName: meta?.fileName || null,
        mediaKey: meta?.mediaKey || null, directPath: meta?.directPath || null,
        fileEncSha256: meta?.fileEncSha256 || null, fileSha256: meta?.fileSha256 || null,
        fileLength: meta?.fileLength || null,
      };
    }
    if (media.kind === "video") {
      return {
        body: media.container.caption || "[视频]", type: "video", mediaUrl,
        mimeType: meta?.mimeType || null, fileName: meta?.fileName || null,
        mediaKey: meta?.mediaKey || null, directPath: meta?.directPath || null,
        fileEncSha256: meta?.fileEncSha256 || null, fileSha256: meta?.fileSha256 || null,
        fileLength: meta?.fileLength || null,
      };
    }
    if (media.kind === "audio") {
      return {
        body: "[语音]", type: "audio", mediaUrl,
        mimeType: meta?.mimeType || null,
        mediaKey: meta?.mediaKey || null, directPath: meta?.directPath || null,
        fileEncSha256: meta?.fileEncSha256 || null, fileSha256: meta?.fileSha256 || null,
        fileLength: meta?.fileLength || null,
      };
    }
    if (media.kind === "document") {
      return {
        body: media.container.caption || meta?.fileName || "[文件]", type: "document",
        fileName: meta?.fileName || "file", mediaUrl,
        mimeType: meta?.mimeType || "application/octet-stream",
        mediaKey: meta?.mediaKey || null, directPath: meta?.directPath || null,
        fileEncSha256: meta?.fileEncSha256 || null, fileSha256: meta?.fileSha256 || null,
        fileLength: meta?.fileLength || null,
      };
    }
    if (media.kind === "sticker") return { body: "[贴纸]", type: "sticker" };
  }
  if (m.reactionMessage) return { body: m.reactionMessage.text || "👍", type: "reaction" };
  if (m.stickerMessage?.isAnimated) return { body: "[动态贴纸]", type: "sticker" };
  if (m.lottieStickerMessage) return { body: "[动态贴纸]", type: "sticker" };
  if (m.locationMessage) return { body: `[位置] ${m.locationMessage.degreesLatitude || ""},${m.locationMessage.degreesLongitude || ""}`, type: "location" };
  if (m.contactsArrayMessage) return { body: "[联系人卡片]", type: "contacts" };
  return { body: `[${t || "unknown"}]`, type: t || "unknown" };
}

// ============ Evolution API 调用 ============
async function fetchMessagesPage(instanceName, page) {
  const url = `${EVO_BASE}/chat/findMessages/${instanceName}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": EVO_APIKEY,
    },
    body: JSON.stringify({ pageSize: PAGE_SIZE, page }),
  });
  if (!res.ok) {
    throw new Error(`Evolution API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

// ============ Customer upsert ============
async function upsertCustomer(phone, pushName, jid) {
  if (!phone || phone.length < 5) return null;
  try {
    const userId = 1;
    let cust = null;
    if (jid) {
      cust = await prisma.customer.findFirst({ where: { userId, jid } });
    }
    if (!cust) {
      cust = await prisma.customer.findFirst({ where: { userId, phone } });
    }
    const name = pushName && pushName.trim() ? pushName.trim() : phone;
    const now = new Date();
    if (!cust) {
      cust = await prisma.customer.create({
        data: { userId, phone, jid: jid || null, name, source: "whatsapp", status: "potential", lastContactAt: now },
      });
    } else {
      const updateData = { lastContactAt: now };
      if (pushName && pushName.trim() && (cust.name === cust.phone || !cust.name)) {
        updateData.name = pushName.trim();
      }
      if (jid && !cust.jid) updateData.jid = jid;
      if (phone && !cust.phone) updateData.phone = phone;
      await prisma.customer.update({ where: { id: cust.id }, data: updateData });
    }
    return cust;
  } catch (e) {
    console.warn("[sync] upsertCustomer error:", e.message);
    return null;
  }
}

// ============ WAConnection ensure ============
async function ensureWAConnection(sessionId, phone) {
  let conn = await prisma.wAConnection.findUnique({ where: { sessionId } });
  if (!conn) {
    conn = await prisma.wAConnection.create({
      data: { sessionId, userId: 1, phone: phone || null, status: "connected" },
    });
  }
  return conn;
}

// ============ 批量去重查询 ============
async function getExistingWaMessageIds(sessionId, waMessageIds) {
  if (waMessageIds.length === 0) return new Set();
  // 分批查询避免SQL过长
  const BATCH = 500;
  const result = new Set();
  for (let i = 0; i < waMessageIds.length; i += BATCH) {
    const chunk = waMessageIds.slice(i, i + BATCH);
    const rows = await prisma.wAMessage.findMany({
      where: { waMessageId: { in: chunk } },
      select: { waMessageId: true },
    });
    for (const r of rows) result.add(r.waMessageId);
  }
  return result;
}

// ============ 单条消息处理 ============
function processMessageRecord(msg, instanceName, ownerJid) {
  const key = msg.key || {};
  const rawRemoteJid = key.remoteJid || "";
  const fromMe = !!key.fromMe;

  // 过滤规则
  if (!rawRemoteJid) return { skip: true, reason: "no-remoteJid" };
  if (isGroup(rawRemoteJid)) return { skip: true, reason: "group" };
  if (rawRemoteJid === "status@broadcast") return { skip: true, reason: "broadcast" };
  if (fromMe && rawRemoteJid === ownerJid) return { skip: true, reason: "self-msg" };

  const remoteJid = resolveRealJid(msg, rawRemoteJid);
  if (!remoteJid || remoteJid === ownerJid) return { skip: true, reason: "invalid-resolved-jid" };

  const phone = remoteJid.split("@")[0];
  if (!phone || phone === "0" || phone.length < 5 || !/^\d+$/.test(phone)) {
    return { skip: true, reason: "invalid-phone" };
  }

  const extracted = extractBody(msg);
  const { body, type, mediaUrl, fileName, mimeType, mediaKey, directPath, fileEncSha256, fileSha256, fileLength } = extracted;
  if (!body || body === "[unknown]") return { skip: true, reason: "empty-body" };

  const waMessageId = key.id || null;
  if (!waMessageId) return { skip: true, reason: "no-waMessageId" };

  const timestamp = evoTsToDate(msg.messageTimestamp);
  const direction = fromMe ? "outbound" : "inbound";
  const from = fromMe ? ownerJid : remoteJid;
  const to = fromMe ? remoteJid : ownerJid;
  const pushName = msg.pushName || "";

  let waMsgTimestamp = null;
  if (typeof msg.messageTimestamp === "number") waMsgTimestamp = msg.messageTimestamp;
  else if (msg.messageTimestamp && typeof msg.messageTimestamp === "object" && typeof msg.messageTimestamp.low === "number") {
    waMsgTimestamp = msg.messageTimestamp.low;
  }

  const waKeyJson = JSON.stringify({
    id: key.id || null,
    fromMe: !!key.fromMe,
    remoteJid: key.remoteJid || null,
    participant: key.participant || null,
  });

  return {
    skip: false,
    data: {
      sessionId: INSTANCES[instanceName].sessionId,
      from, to, body: body || "", type: type || "text", direction,
      timestamp, waMessageId,
      mediaUrl: mediaUrl || null, fileName: fileName || null, mimeType: mimeType || null,
      mediaKey: mediaKey || null, mediaDirectPath: directPath || null,
      mediaEncSha256: fileEncSha256 || null, mediaSha256: fileSha256 || null,
      fileLength: Number.isFinite(fileLength) ? fileLength : null,
      waKeyJson: waKeyJson || null,
      waMsgTimestamp: waMsgTimestamp || null,
    },
    direction,
    remoteJid,
    pushName,
  };
}

// ============ 主流程 ============
async function syncInstance(instanceName) {
  const cfg = INSTANCES[instanceName];
  if (!cfg) {
    console.error(`[ERROR] 未知实例: ${instanceName}`);
    return null;
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`开始同步实例: ${instanceName}`);
  console.log(`ownerJid: ${cfg.ownerJid}, sessionId: ${cfg.sessionId}`);
  console.log(`${"=".repeat(60)}`);

  // 确保WAConnection存在
  await ensureWAConnection(cfg.sessionId, jidToPhone(cfg.ownerJid));

  const stats = { total: 0, synced: 0, skipped: 0, duplicates: 0, errors: 0, skipReasons: {} };
  let page = 1;
  let totalPages = 1;

  // 先获取第一页了解总量
  const firstPageData = await fetchMessagesPage(instanceName, 1);
  const firstPage = firstPageData.messages;
  if (!firstPage) {
    console.error(`[ERROR] 实例 ${instanceName} 返回数据格式异常`);
    return null;
  }
  totalPages = firstPage.pages || 1;
  stats.total = firstPage.total || 0;
  console.log(`总消息数: ${stats.total}, 总页数: ${totalPages}`);

  // 处理第一页
  await processPage(firstPage.records, instanceName, cfg.ownerJid, stats);

  // 处理剩余页
  for (page = 2; page <= totalPages; page++) {
    try {
      const pageData = await fetchMessagesPage(instanceName, page);
      const messages = pageData.messages;
      if (!messages?.records) break;
      await processPage(messages.records, instanceName, cfg.ownerJid, stats);
      // 进度输出
      if (page % 10 === 0 || page === totalPages) {
        console.log(`  进度: ${page}/${totalPages} 页, 已同步 ${stats.synced}, 跳过 ${stats.skipped}, 重复 ${stats.duplicates}, 错误 ${stats.errors}`);
      }
    } catch (e) {
      console.error(`[ERROR] 第 ${page} 页获取失败: ${e.message}`);
      stats.errors += PAGE_SIZE; // 粗估
      // 重试一次
      try {
        await new Promise(r => setTimeout(r, 2000));
        const retryData = await fetchMessagesPage(instanceName, page);
        const messages = retryData.messages;
        if (messages?.records) {
          await processPage(messages.records, instanceName, cfg.ownerJid, stats);
        }
      } catch (e2) {
        console.error(`[ERROR] 第 ${page} 页重试仍失败: ${e2.message}`);
      }
    }
  }

  console.log(`\n--- ${instanceName} 同步完成 ---`);
  console.log(`总消息: ${stats.total}`);
  console.log(`新同步: ${stats.synced}`);
  console.log(`已存在(重复): ${stats.duplicates}`);
  console.log(`过滤跳过: ${stats.skipped}`);
  console.log(`错误: ${stats.errors}`);
  if (Object.keys(stats.skipReasons).length > 0) {
    console.log(`跳过原因分布:`, stats.skipReasons);
  }

  return stats;
}

async function processPage(records, instanceName, ownerJid, stats) {
  if (!records || !records.length) return;

  const processed = [];
  for (const msg of records) {
    const result = processMessageRecord(msg, instanceName, ownerJid);
    if (result.skip) {
      stats.skipped++;
      const reason = result.reason || "unknown";
      stats.skipReasons[reason] = (stats.skipReasons[reason] || 0) + 1;
      continue;
    }
    processed.push(result);
  }

  if (processed.length === 0) return;

  // 批量去重查询
  const waMessageIds = processed.map(p => p.data.waMessageId).filter(Boolean);
  const existingIds = await getExistingWaMessageIds(INSTANCES[instanceName].sessionId, waMessageIds);

  // 逐条入库（需要处理customer upsert）
  for (const item of processed) {
    const { data, direction, remoteJid, pushName } = item;

    if (existingIds.has(data.waMessageId)) {
      stats.duplicates++;
      continue;
    }

    if (DRY_RUN) {
      stats.synced++;
      continue;
    }

    try {
      await prisma.wAMessage.create({ data });
      stats.synced++;

      // inbound 消息 upsert customer
      if (direction === "inbound") {
        const phone = jidToPhone(remoteJid);
        await upsertCustomer(phone, pushName, remoteJid);
      }
    } catch (e) {
      if (e.code === "P2002") {
        // 唯一约束冲突，说明并发创建
        stats.duplicates++;
      } else {
        stats.errors++;
        console.error(`[ERROR] 消息入库失败 waMessageId=${data.waMessageId}: ${e.message}`);
      }
    }
  }
}

async function main() {
  console.log("========================================");
  console.log("Evolution API 历史消息同步工具");
  console.log(`启动时间: ${new Date().toISOString()}`);
  if (DRY_RUN) console.log("*** DRY-RUN 模式 ***");
  console.log("========================================");

  const instancesToSync = TARGET_INSTANCE === "all"
    ? Object.keys(INSTANCES)
    : [TARGET_INSTANCE];

  const allStats = {};

  for (const inst of instancesToSync) {
    const stats = await syncInstance(inst);
    if (stats) allStats[inst] = stats;
  }

  console.log("\n\n" + "=".repeat(60));
  console.log("全部同步结果汇总");
  console.log("=".repeat(60));

  let totalSynced = 0, totalDuplicates = 0, totalSkipped = 0, totalErrors = 0;
  for (const [inst, s] of Object.entries(allStats)) {
    console.log(`\n${inst}:`);
    console.log(`  API总消息: ${s.total}`);
    console.log(`  新同步: ${s.synced}`);
    console.log(`  已存在: ${s.duplicates}`);
    console.log(`  过滤跳过: ${s.skipped}`);
    console.log(`  错误: ${s.errors}`);
    totalSynced += s.synced;
    totalDuplicates += s.duplicates;
    totalSkipped += s.skipped;
    totalErrors += s.errors;
  }

  console.log(`\n--- 汇总 ---`);
  console.log(`新同步: ${totalSynced}`);
  console.log(`已存在: ${totalDuplicates}`);
  console.log(`过滤跳过: ${totalSkipped}`);
  console.log(`错误: ${totalErrors}`);

  await prisma.$disconnect();
  console.log(`\n完成时间: ${new Date().toISOString()}`);
}

main().catch(async (e) => {
  console.error("[FATAL]", e);
  await prisma.$disconnect();
  process.exit(1);
});
