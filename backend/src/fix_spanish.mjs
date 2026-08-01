/**
 * Fix Spanish translations - uses sqlite3 CLI + Google Translate API
 */
import https from 'https';
import { URL } from 'url';
import { execSync } from 'child_process';

const BACKEND = '/opt/whatsapp-crm/backend';
const KEEPALIVE_AGENT = new https.Agent({ keepAlive: true, keepAliveMsecs: 30000, maxSockets: 4 });

function httpsGetJson(urlStr, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const req = https.get({
      host: url.hostname, path: url.pathname + url.search,
      agent: KEEPALIVE_AGENT, timeout: timeoutMs,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WhatsApp-CRM/1.0)', 'Accept': 'application/json', 'Connection': 'keep-alive' },
    }, (res) => {
      if (res.statusCode !== 200) { res.resume(); return reject(new Error(`HTTP ${res.statusCode}`)); }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
        catch (e) { reject(new Error(`Parse error: ${e.message}`)); }
      });
    });
    req.on('timeout', () => { req.destroy(new Error('timeout')); });
    req.on('error', reject);
  });
}

async function googleTranslate(text, from, to) {
  const params = new URLSearchParams({ client: 'gtx', sl: from, tl: to, dt: 't', q: text });
  const url = `https://translate.googleapis.com/translate_a/single?${params}`;
  const result = await httpsGetJson(url);
  let translated = '';
  if (result && Array.isArray(result)) {
    for (const sentence of (result[0] || [])) {
      if (sentence && sentence[0]) translated += sentence[0];
    }
  }
  return translated;
}

function sqliteQuery(dbPath, sql) {
  try {
    const raw = execSync(`sqlite3 -json "${dbPath}" "${sql.replace(/"/g, '\\"')}"`, { encoding: 'utf8', maxBuffer: 10*1024*1024 }).trim();
    return raw ? JSON.parse(raw) : [];
  } catch(e) { return []; }
}

function sqliteExec(dbPath, sql) {
  execSync(`sqlite3 "${dbPath}" "${sql.replace(/"/g, '\\"')}"`, { encoding: 'utf8' });
}

async function fixDB(name, dbPath) {
  console.log(`\n=== ${name} ===`);
  
  const rows = sqliteQuery(dbPath, `SELECT id, body, translation FROM wAMessage WHERE sourceLang='en' AND (body LIKE '%á%' OR body LIKE '%é%' OR body LIKE '%í%' OR body LIKE '%ó%' OR body LIKE '%ú%' OR body LIKE '%ñ%' OR body LIKE '%¿%' OR body LIKE '%¡%' OR body LIKE '%Á%' OR body LIKE '%É%' OR body LIKE '%Í%' OR body LIKE '%Ó%' OR body LIKE '%Ú%' OR body LIKE '%Ñ%')`);
  console.log(`Found ${rows.length} misidentified Spanish wAMessages`);
  
  let fixed = 0;
  for (const row of rows) {
    const { id, body } = row;
    if (!body) continue;
    try {
      const translated = await googleTranslate(body, 'es', 'zh');
      if (translated) {
        const transObj = JSON.stringify({ original: body, translated, sourceLang: 'es', targetLang: 'zh' });
        const sql = `UPDATE wAMessage SET translation='${transObj.replace(/'/g, "''")}', sourceLang='es' WHERE id=${id};`;
        execSync(`cat > /tmp/fix_wa_${id}.sql << 'EOSQL'\n${sql}\nEOSQL\nsqlite3 "${dbPath}" < /tmp/fix_wa_${id}.sql`, { encoding: 'utf8' });
        fixed++;
        console.log(`  ✓ id=${id}: "${body.slice(0,40)}..." → "${translated.slice(0,40)}..."`);
      }
    } catch(e) {
      console.log(`  ✗ id=${id}: ${e.message}`);
    }
    await new Promise(r => setTimeout(r, 300));
  }

  // Also fix Message table
  const msgRows = sqliteQuery(dbPath, `SELECT id, content, translation FROM Message WHERE sourceLang='en' AND (content LIKE '%á%' OR content LIKE '%é%' OR content LIKE '%í%' OR content LIKE '%ó%' OR content LIKE '%ú%' OR content LIKE '%ñ%' OR content LIKE '%¿%' OR content LIKE '%¡%')`);
  console.log(`Found ${msgRows.length} misidentified Spanish Messages`);
  for (const row of msgRows) {
    const { id, content } = row;
    if (!content) continue;
    try {
      const translated = await googleTranslate(content, 'es', 'zh');
      if (translated) {
        const transObj = JSON.stringify({ original: content, translated, sourceLang: 'es', targetLang: 'zh' });
        const sql = `UPDATE Message SET translation='${transObj.replace(/'/g, "''")}', sourceLang='es' WHERE id=${id};`;
        execSync(`cat > /tmp/fix_msg_${id}.sql << 'EOSQL'\n${sql}\nEOSQL\nsqlite3 "${dbPath}" < /tmp/fix_msg_${id}.sql`, { encoding: 'utf8' });
        fixed++;
        console.log(`  ✓ Msg id=${id}: "${content.slice(0,40)}..." → "${translated.slice(0,40)}..."`);
      }
    } catch(e) {
      console.log(`  ✗ Msg id=${id}: ${e.message}`);
    }
    await new Promise(r => setTimeout(r, 300));
  }

  // Clear bad cache
  try {
    sqliteExec(dbPath, "DELETE FROM TranslationCache WHERE sourceLang='en' AND (sourceText LIKE '%á%' OR sourceText LIKE '%é%' OR sourceText LIKE '%í%' OR sourceText LIKE '%ó%' OR sourceText LIKE '%ú%' OR sourceText LIKE '%ñ%' OR sourceText LIKE '%¿%' OR sourceText LIKE '%¡%')");
    console.log('Cleared bad cache entries');
  } catch(e) {}

  console.log(`Total fixed: ${fixed}`);
}

for (const [name, dbPath] of [['staging', `${BACKEND}/prisma/crm-staging.db`], ['production', `${BACKEND}/prisma/crm.db`]]) {
  try { await fixDB(name, dbPath); } catch(e) { console.error(`${name} ERROR:`, e.message); }
}

console.log('\nAll done!');
process.exit(0);
