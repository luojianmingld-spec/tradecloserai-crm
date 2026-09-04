#!/usr/bin/env node
// ============================================================================
// SQLite → PostgreSQL 多租户数据迁移脚本 (v2 - 修复版)
// 修复内容：
//   1. DateTime 整数→ISO 字符串转换
//   2. @map 字段使用数据库列名（snake_case），不再错误映射为 Prisma 字段名
//   3. 严格按外键依赖顺序迁移
// 用法：node migrate-data.js [--sqlite PATH] [--pg-url URL]
// ============================================================================

import Database from 'better-sqlite3';
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── 配置 ────────────────────────────────────────────────────────────────────
const SQLITE_PATH = process.argv.find(a => a === '--sqlite')
  ? process.argv[process.argv.indexOf('--sqlite') + 1]
  : process.env.SQLITE_PATH
  || '/opt/whatsapp-crm-staging/backend/prisma/crm-staging.db';

const PG_URL = process.argv.find(a => a === '--pg-url')
  ? process.argv[process.argv.indexOf('--pg-url') + 1]
  : process.env.DATABASE_URL
  || 'postgresql://crm_app:Crm2026pg!@localhost:5432/crm_staging';

const DEFAULT_TENANT_ID = 1;
const BATCH_SIZE = 500;

// ─── 需要添加 tenantId 的表 ─────────────────────────────────────────────────
const TENANT_TABLES = new Set([
  'User', 'WhatsAppAccount', 'Contact', 'Customer', 'Message', 'Conversation',
  'WAConnection', 'WAMessage', 'Setting', 'EmailAccount',
  'AutomationRule', 'AutomationCustomer', 'AutomationQueueItem',
  'Document', 'DocumentItem', 'CustomerFollowUp',
  'MessageSample', 'CompanyMaterial',
  'AssistantConversation', 'AssistantTask',
  'TopicSubscription', 'TopicBriefing',
  'ProductKnowledgeBase', 'ProductQuestion',
  'CustomerBackgroundCheck', 'CustomerBantScore',
  'CustomerAttitude', 'ActionSuggestion', 'SpeechEffectiveness',
]);

// ─── DateTime 列清单（按模型列出所有 DateTime 字段对应的数据库列名） ───────
// 注意：@map 字段使用实际 DB 列名（snake_case），非 @map 字段使用 Prisma 字段名
const DATETIME_COLUMNS = {
  User:               ['createdAt'],
  WhatsAppAccount:    ['createdAt', 'lastActiveAt'],
  Contact:            ['createdAt', 'updatedAt'],
  Setting:            ['createdAt', 'updatedAt'],
  TranslationCache:   ['createdAt'],
  Message:            ['timestamp', 'createdAt'],
  Conversation:       ['lastMessageAt', 'createdAt', 'updatedAt'],
  WAConnection:       ['lastConnectedAt', 'createdAt', 'updatedAt'],
  WAMessage:          ['timestamp', 'deliveredAt', 'readAt', 'createdAt'],
  // Customer 的 @map 字段用 DB 列名
  Customer:           [
    'firstContactAt', 'businessProfileSyncedAt', 'aiExtractedAt',
    'lastContactAt', 'requirement_updated_at',   // @map("requirement_updated_at")
    'bgUpdatedAt', 'dealStageAt',
  ],
  EmailAccount:       ['lastSyncAt', 'createdAt', 'updatedAt'],
  EmailMessage:       ['createdAt'],
  AutomationRule:     ['lastRunAt', 'nextRunAt', 'createdAt', 'updatedAt'],
  AutomationCustomer: ['lastSentAt', 'createdAt', 'updatedAt'],
  AutomationQueueItem:['sentAt', 'scheduledFor', 'createdAt', 'updatedAt'],
  Document:           ['issueDate', 'validUntil', 'createdAt', 'updatedAt'],
  // DocumentItem: 无 DateTime 字段
  CustomerFollowUp:   ['createdAt'],
  MessageSample:      ['createdAt'],
  CompanyMaterial:    ['createdAt', 'updatedAt'],
  AssistantConversation: ['createdAt'],
  AssistantTask:      ['confirmedAt', 'executedAt', 'createdAt'],
  TopicSubscription:  ['lastRunAt', 'createdAt', 'updatedAt'],
  TopicBriefing:      ['createdAt'],
  ProductKnowledgeBase: ['createdAt', 'updatedAt'],
  ProductQuestion:    ['createdAt', 'updatedAt'],
  CustomerBackgroundCheck: ['createdAt', 'updatedAt'],
  CustomerBantScore:  ['evaluatedAt', 'createdAt', 'updatedAt'],
  CustomerAttitude:   ['lastAnalyzedAt', 'createdAt', 'updatedAt'],
  ActionSuggestion:   ['executedAt', 'createdAt', 'updatedAt'],
  SpeechEffectiveness:['sentAt', 'evaluatedAt', 'createdAt'],
};

// ─── 需要解析为 JSON 对象的列 ────────────────────────────────────────────────
// 键使用 SQLite 实际列名（与 PG 列名一致）
const JSON_COLUMNS = {
  Document: ['sellerInfo', 'buyerInfo'],
};

// ─── Boolean 列（SQLite 存为 0/1，需转为 true/false） ────────────────────────
const BOOLEAN_COLUMNS = {
  Message:              ['fromMe'],
  Conversation:         ['pinned', 'starred', 'blocked'],
  WAMessage:            ['read'],
  EmailMessage:         ['read'],
  AutomationRule:       ['enabled'],
  MessageSample:        ['usedAi', 'aiModified', 'favorited'],
  CompanyMaterial:      ['isDefault'],
  TopicSubscription:    ['active'],
  ProductKnowledgeBase: ['isActive'],
  ProductQuestion:      ['isActive'],
  SpeechEffectiveness:  ['customerReplied'],
};

// ─── 迁移顺序（严格按外键依赖） ──────────────────────────────────────────────
// 规则：被依赖的表先迁移，依赖方后迁移
const MIGRATION_ORDER = [
  'User',                   // 无 FK 依赖（Tenant 已在 PG 中创建）
  'WhatsAppAccount',        // → User
  'Contact',                // → WhatsAppAccount
  'WAConnection',           // → User
  'WAMessage',              // → WAConnection
  'Setting',                // → User
  'Conversation',           // → WhatsAppAccount + Contact
  'Message',                // → WhatsAppAccount + Contact
  'Customer',               // → User
  'EmailAccount',           // → User
  'EmailMessage',           // → EmailAccount
  'Document',               // → User + Customer
  'DocumentItem',           // → Document
  'CustomerFollowUp',       // → Customer
  'AutomationRule',         // → User
  'AutomationCustomer',     // → User + Customer
  'AutomationQueueItem',    // → User + AutomationRule + Customer
  'MessageSample',          // 仅 accountId 默认值，无严格 FK
  'CompanyMaterial',        // 仅 accountId 默认值，无严格 FK
  'AssistantConversation',  // → userId（无显式 FK，但有索引）
  'AssistantTask',          // → userId + conversationId
  'TopicSubscription',      // → User
  'TopicBriefing',          // → TopicSubscription
  'ProductKnowledgeBase',   // 仅 accountId 默认值
  'ProductQuestion',        // → ProductKnowledgeBase
  'CustomerBackgroundCheck',// → Contact
  'CustomerBantScore',      // → Contact
  'CustomerAttitude',       // → Contact
  'ActionSuggestion',       // → Contact
  'SpeechEffectiveness',    // → Contact
  'TranslationCache',       // 无 FK
];

// ─── 工具函数 ────────────────────────────────────────────────────────────────

/**
 * 将毫秒整数或秒级整数转为 ISO 日期字符串
 * SQLite 中 Prisma 的 DateTime 可能存为毫秒整数（如 1785832242601）
 * 也可能是秒级整数（如 1785832242），需兼容处理
 */
function toISODate(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    // 如果值 > 1e12 则为毫秒，否则为秒
    const ms = value > 1e12 ? value : value * 1000;
    return new Date(ms).toISOString();
  }
  if (typeof value === 'string') {
    // 已经是 ISO 格式或可解析字符串
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d.toISOString();
    return value; // 无法解析则保留原值
  }
  return value;
}

/** 将 SQLite 行转换为 PostgreSQL 行 */
function transformRow(row, tableName) {
  const dtCols = DATETIME_COLUMNS[tableName] || [];
  const jsonCols = JSON_COLUMNS[tableName] || [];
  const boolCols = BOOLEAN_COLUMNS[tableName] || [];
  const needsTenant = TENANT_TABLES.has(tableName);

  const transformed = {};

  for (const [col, value] of Object.entries(row)) {
    // 跳过内部列（如 _rowid_）
    if (col.startsWith('_')) continue;

    // 关键修复：不再做 Prisma 字段名→列名的映射
    // SQLite 中 SELECT * 返回的列名就是实际 DB 列名
    // PostgreSQL 中也使用相同的 DB 列名（@map 在两侧一致）
    const pgCol = col;

    // DateTime 转换：整数值→ISO 字符串
    if (dtCols.includes(pgCol) && value !== null && value !== undefined) {
      transformed[pgCol] = toISODate(value);
    }
    // Boolean 转换
    else if (boolCols.includes(pgCol)) {
      transformed[pgCol] = value === 1 || value === true;
    }
    // JSON 解析
    else if (jsonCols.includes(pgCol) && value !== null && value !== undefined) {
      try {
        transformed[pgCol] = typeof value === 'string' ? JSON.parse(value) : value;
      } catch {
        transformed[pgCol] = value; // 保留原值
      }
    }
    else {
      transformed[pgCol] = value;
    }
  }

  // 添加 tenantId
  if (needsTenant) {
    transformed.tenantId = DEFAULT_TENANT_ID;
  }

  return transformed;
}

/** 构建批量 INSERT 并执行 */
async function batchInsert(pool, tableName, rows) {
  if (rows.length === 0) return 0;

  const columns = Object.keys(rows[0]);
  const colList = columns.map(c => `"${c}"`).join(', ');

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const values = [];
    const placeholders = [];

    let paramIdx = 1;
    for (const row of batch) {
      const rowPlaceholders = [];
      for (const col of columns) {
        values.push(row[col]);
        rowPlaceholders.push(`$${paramIdx++}`);
      }
      placeholders.push(`(${rowPlaceholders.join(', ')})`);
    }

    const sql = `INSERT INTO "${tableName}" (${colList}) VALUES ${placeholders.join(', ')}`;
    await pool.query(sql, values);
  }

  return rows.length;
}

/** 重置 PostgreSQL 自增序列 */
async function resetSequences(pool, tableName, rows) {
  if (rows.length === 0) return;
  // 只对有 id 列且为整数自增的表重置序列
  if (!rows[0].hasOwnProperty('id')) return;
  if (typeof rows[0].id !== 'number') return; // cuid() 跳过

  const maxId = Math.max(...rows.map(r => r.id));
  if (!isFinite(maxId)) return;

  try {
    await pool.query(
      `SELECT setval('"${tableName}_id_seq"', $1, true)`,
      [maxId]
    );
  } catch (err) {
    console.warn(`  ⚠ 序列重置跳过 (${tableName}): ${err.message}`);
  }
}

// ─── 主迁移逻辑 ──────────────────────────────────────────────────────────────

async function migrate() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║   SQLite → PostgreSQL 多租户数据迁移 v2                ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log();
  console.log(`SQLite: ${SQLITE_PATH}`);
  console.log(`PG URL: ${PG_URL.replace(/:([^@]+)@/, ':****@')}`);
  console.log(`默认租户 ID: ${DEFAULT_TENANT_ID}`);
  console.log();

  // ── 1. 连接 SQLite（只读模式，不设 WAL pragma） ────────────────────────
  console.log('📖 打开 SQLite 数据库 (readonly)...');
  const sqlite = new Database(SQLITE_PATH, { readonly: true });
  // 不设 WAL pragma，避免对只读数据库造成问题

  // ── 2. 连接 PostgreSQL ──────────────────────────────────────────────────
  console.log('🐘 连接 PostgreSQL...');
  const pool = new pg.Pool({ connectionString: PG_URL });

  try {
    await pool.query('SELECT 1');
    console.log('✅ PostgreSQL 连接成功');
  } catch (err) {
    console.error('❌ PostgreSQL 连接失败:', err.message);
    process.exit(1);
  }

  // ── 3. 创建默认租户 ─────────────────────────────────────────────────────
  console.log();
  console.log('🏢 创建默认租户...');
  try {
    await pool.query(`
      INSERT INTO "Tenant" (id, name, plan, status, "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
    `, [DEFAULT_TENANT_ID, '默认租户', 'pro', 'active']);
    console.log(`✅ 租户已创建 (id=${DEFAULT_TENANT_ID}, name="默认租户")`);
  } catch (err) {
    console.error('❌ 创建租户失败:', err.message);
    process.exit(1);
  }

  // ── 4. 清空目标表（幂等，支持重跑） ─────────────────────────────────────
  console.log();
  console.log('🧹 清空目标表...');
  // 按逆序 TRUNCATE 以避免外键冲突
  const reverseOrder = [...MIGRATION_ORDER].reverse();
  for (const table of reverseOrder) {
    try {
      await pool.query(`TRUNCATE TABLE "${table}" CASCADE`);
    } catch {
      // 表可能不存在，忽略
    }
  }
  // 重新插入租户（TRUNCATE CASCADE 可能清空 Tenant）
  try {
    await pool.query(`
      INSERT INTO "Tenant" (id, name, plan, status, "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
    `, [DEFAULT_TENANT_ID, '默认租户', 'pro', 'active']);
  } catch {
    // 忽略
  }
  console.log('✅ 目标表已清空');

  // ── 5. 逐表迁移 ─────────────────────────────────────────────────────────
  console.log();
  console.log('📦 开始数据迁移...');
  console.log('─'.repeat(60));

  const stats = {};

  for (const tableName of MIGRATION_ORDER) {
    // 读取 SQLite 表
    let rows;
    try {
      rows = sqlite.prepare(`SELECT * FROM "${tableName}"`).all();
    } catch {
      // 表在 SQLite 中不存在，跳过
      stats[tableName] = { source: 0, migrated: 0, status: 'SKIP' };
      console.log(`  ⏭  ${tableName}: 源表不存在，跳过`);
      continue;
    }

    if (rows.length === 0) {
      stats[tableName] = { source: 0, migrated: 0, status: 'EMPTY' };
      console.log(`  📭 ${tableName}: 0 行`);
      continue;
    }

    // 转换数据
    const transformedRows = rows.map(row => transformRow(row, tableName));

    // 插入 PostgreSQL
    try {
      const count = await batchInsert(pool, tableName, transformedRows);
      await resetSequences(pool, tableName, transformedRows);
      stats[tableName] = { source: rows.length, migrated: count, status: 'OK' };
      console.log(`  ✅ ${tableName}: ${count} 行迁移完成`);
    } catch (err) {
      // 如果批量插入失败，尝试逐行插入以定位问题行
      console.warn(`  ⚠ ${tableName}: 批量插入失败 (${err.message}), 尝试逐行插入...`);
      let successCount = 0;
      let failCount = 0;
      for (const row of transformedRows) {
        try {
          const columns = Object.keys(row);
          const colList = columns.map(c => `"${c}"`).join(', ');
          const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
          const values = columns.map(c => row[c]);
          await pool.query(
            `INSERT INTO "${tableName}" (${colList}) VALUES (${placeholders})`,
            values
          );
          successCount++;
        } catch (rowErr) {
          failCount++;
          if (failCount <= 3) {
            console.warn(`    行插入失败: ${rowErr.message}`);
            console.warn(`    数据: ${JSON.stringify(row).substring(0, 200)}`);
          }
        }
      }
      if (failCount > 3) {
        console.warn(`    ... 还有 ${failCount - 3} 行失败`);
      }
      stats[tableName] = {
        source: rows.length,
        migrated: successCount,
        failed: failCount,
        status: failCount > 0 ? 'PARTIAL' : 'OK',
      };
      console.log(`  ${failCount > 0 ? '⚠️' : '✅'} ${tableName}: ${successCount} 成功, ${failCount} 失败`);
    }
  }

  // ── 6. 重置 Tenant 序列 ─────────────────────────────────────────────────
  try {
    await pool.query(`SELECT setval('"Tenant_id_seq"', $1, true)`, [DEFAULT_TENANT_ID]);
  } catch {
    // 忽略
  }

  // ── 7. 打印统计 ──────────────────────────────────────────────────────────
  console.log();
  console.log('═'.repeat(60));
  console.log('📊 迁移统计');
  console.log('═'.repeat(60));

  let totalSource = 0;
  let totalMigrated = 0;
  let totalFailed = 0;

  for (const [table, s] of Object.entries(stats)) {
    const statusIcon = s.status === 'OK' ? '✅' : s.status === 'PARTIAL' ? '⚠️' : s.status === 'EMPTY' ? '📭' : '⏭';
    const failed = s.failed ? ` (${s.failed} 失败)` : '';
    console.log(`  ${statusIcon} ${table.padEnd(28)} 源: ${String(s.source).padStart(6)}  →  目标: ${String(s.migrated).padStart(6)}${failed}`);
    totalSource += s.source;
    totalMigrated += s.migrated;
    totalFailed += (s.failed || 0);
  }

  console.log('─'.repeat(60));
  console.log(`  合计: 源 ${totalSource} 行 → 目标 ${totalMigrated} 行${totalFailed > 0 ? ` (${totalFailed} 失败)` : ''}`);
  console.log();

  // ── 8. 数据验证 ──────────────────────────────────────────────────────────
  console.log('🔍 数据验证...');
  let verifyOk = true;
  for (const [table, s] of Object.entries(stats)) {
    if (s.status === 'SKIP' || s.status === 'EMPTY') continue;
    try {
      const result = await pool.query(`SELECT COUNT(*) as cnt FROM "${table}"`);
      const pgCount = parseInt(result.rows[0].cnt);
      if (pgCount !== s.migrated) {
        console.warn(`  ❌ ${table}: 预期 ${s.migrated} 行, 实际 ${pgCount} 行`);
        verifyOk = false;
      }
    } catch {
      // 忽略
    }
  }
  if (verifyOk) {
    console.log('✅ 数据验证通过');
  }

  // ── 完成 ──────────────────────────────────────────────────────────────────
  console.log();
  if (totalFailed === 0) {
    console.log('🎉 迁移完成！所有数据已成功迁移到 PostgreSQL。');
  } else {
    console.log(`⚠️ 迁移完成，但有 ${totalFailed} 行数据失败，请检查日志。`);
  }

  // 清理
  sqlite.close();
  await pool.end();
}

// ─── 入口 ─────────────────────────────────────────────────────────────────────
migrate().catch(err => {
  console.error('💥 迁移失败:', err);
  process.exit(1);
});
