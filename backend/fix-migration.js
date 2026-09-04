import Database from 'better-sqlite3';
import pg from 'pg';

const sqlite = new Database('/opt/whatsapp-crm-staging/backend/prisma/crm-staging.db', { readonly: true });
const pool = new pg.Pool({ connectionString: 'postgresql://crm_app:Crm2026pg!@localhost:5432/crm_staging' });

function toISO(val) {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'string' && val.startsWith('2')) return val; // already ISO
  if (typeof val === 'number' || (typeof val === 'string' && /^\d{10,13}$/.test(val))) {
    const n = Number(val);
    return new Date(n > 1e12 ? n : n * 1000).toISOString();
  }
  return val;
}

const DT_COLS = ['updatedAt','createdAt','firstContactAt','businessProfileSyncedAt','aiExtractedAt','lastContactAt','bgUpdatedAt','dealStageAt','requirement_updated_at'];

async function main() {
  // ── 1. Fix Customer: re-insert 16 failed rows with proper datetime conversion ──
  console.log('=== Fix Customer ===');
  const customerRows = sqlite.prepare("SELECT * FROM Customer").all();
  const pgClient = await pool.connect();
  
  let custFixed = 0;
  for (const row of customerRows) {
    // Check if already in PG
    const exists = await pgClient.query('SELECT id FROM "Customer" WHERE id = $1', [row.id]);
    if (exists.rows.length > 0) continue;
    
    // Convert datetime fields
    const converted = {...row, tenantId: 1};
    for (const col of DT_COLS) {
      if (col in converted) {
        converted[col] = toISO(converted[col]);
      }
    }
    
    // Build INSERT
    const cols = Object.keys(converted);
    const vals = Object.values(converted);
    const placeholders = cols.map((_, i) => `$${i+1}`).join(',');
    const colNames = cols.map(c => `"${c}"`).join(',');
    
    try {
      await pgClient.query(
        `INSERT INTO "Customer" (${colNames}) VALUES (${placeholders})`,
        vals
      );
      custFixed++;
    } catch(e) {
      console.log(`  ❌ Customer id=${row.id}: ${e.message.substring(0,100)}`);
    }
  }
  console.log(`  ✅ Fixed ${custFixed} Customer rows`);

  // ── 2. Fix Message: insert missing rows ──
  console.log('\n=== Fix Message ===');
  const sqliteIds = new Set(sqlite.prepare("SELECT id FROM Message").all().map(r => r.id));
  const pgRows = await pgClient.query('SELECT id FROM "Message"');
  const pgIds = new Set(pgRows.rows.map(r => r.id));
  
  const missingIds = [...sqliteIds].filter(id => !pgIds.has(id));
  console.log(`  Missing Message IDs: ${missingIds.length}`);
  
  let msgFixed = 0;
  for (const id of missingIds) {
    const row = sqlite.prepare("SELECT * FROM Message WHERE id = ?").get(id);
    const converted = {...row, tenantId: 1};
    // Convert datetime
    for (const col of ['createdAt','updatedAt','sentAt']) {
      if (col in converted) converted[col] = toISO(converted[col]);
    }
    
    const cols = Object.keys(converted);
    const vals = Object.values(converted);
    const placeholders = cols.map((_, i) => `$${i+1}`).join(',');
    const colNames = cols.map(c => `"${c}"`).join(',');
    
    try {
      await pgClient.query(
        `INSERT INTO "Message" (${colNames}) VALUES (${placeholders})`,
        vals
      );
      msgFixed++;
    } catch(e) {
      console.log(`  ❌ Message id=${id}: ${e.message.substring(0,120)}`);
    }
  }
  console.log(`  ✅ Fixed ${msgFixed} Message rows`);

  // ── 3. Fix CustomerFollowUp: insert missing row ──
  console.log('\n=== Fix CustomerFollowUp ===');
  const cfRows = sqlite.prepare("SELECT * FROM CustomerFollowUp").all();
  let cfFixed = 0;
  for (const row of cfRows) {
    const exists = await pgClient.query('SELECT id FROM "CustomerFollowUp" WHERE id = $1', [row.id]);
    if (exists.rows.length > 0) continue;
    
    const converted = {...row, tenantId: 1};
    for (const col of ['createdAt','updatedAt']) {
      if (col in converted) converted[col] = toISO(converted[col]);
    }
    
    const cols = Object.keys(converted);
    const vals = Object.values(converted);
    const placeholders = cols.map((_, i) => `$${i+1}`).join(',');
    const colNames = cols.map(c => `"${c}"`).join(',');
    
    try {
      await pgClient.query(
        `INSERT INTO "CustomerFollowUp" (${colNames}) VALUES (${placeholders})`,
        vals
      );
      cfFixed++;
    } catch(e) {
      console.log(`  ❌ CustomerFollowUp id=${row.id}: ${e.message.substring(0,120)}`);
    }
  }
  console.log(`  ✅ Fixed ${cfFixed} CustomerFollowUp rows`);

  // ── 4. Final verification ──
  console.log('\n=== Final Verification ===');
  const tables = ['User','WhatsAppAccount','Contact','WAConnection','WAMessage','Setting',
    'Conversation','Message','Customer','EmailAccount','EmailMessage','CustomerFollowUp',
    'AutomationRule','MessageSample','CompanyMaterial','AssistantConversation',
    'TopicSubscription','ProductKnowledgeBase','ProductQuestion','CustomerBackgroundCheck',
    'CustomerBantScore','CustomerAttitude','ActionSuggestion','SpeechEffectiveness','TranslationCache'];
  
  let allMatch = true;
  for (const table of tables) {
    const sqliteCount = sqlite.prepare(`SELECT count(*) as c FROM "${table}"`).get().c;
    const pgCount = (await pgClient.query(`SELECT count(*) FROM "${table}"`)).rows[0].count;
    const match = sqliteCount == pgCount ? '✅' : '❌';
    if (sqliteCount != pgCount) allMatch = false;
    console.log(`  ${match} ${table}: SQLite=${sqliteCount} PG=${pgCount}`);
  }
  
  pgClient.release();
  await pool.end();
  sqlite.close();
  console.log(allMatch ? '\n🎉 所有表数据完全一致！' : '\n⚠️ 仍有差异，需进一步检查');
}

main().catch(console.error);
