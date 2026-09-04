import { collectSamples } from './src/learning/sample-collector.js';
import { sessionsForAccount } from './src/learning/learning.service.js';
import { analyzeSamples } from './src/learning/learning-engine.js';
import { importSamples } from './src/learning/auto-import.js';
import { LEARNING_CONFIG as CFG } from './src/learning/config.js';
const sess = await sessionsForAccount(1);
const { samples } = await collectSamples({ accountId: 1, sessionIds: sess, cursor: new Date('2026-08-15T00:00:00'), limit: 20 });
console.log('samples after 08-15:', samples.length);
for (const s of samples) console.log('  jid=', s.contactJid, 'cust=', (s.customerMsg||'').slice(0,40), '=>', (s.salesReply||'').slice(0,40));
const results = await analyzeSamples(samples, { concurrency: 2 });
for (const r of results) {
  const a = r.analysis || {};
  console.log('ANALYZED score=', a.qualityScore, 'scene=', a.scene, 'replyLen=', (a.salesReply||'').length, 'reason=', (a.qualityReason||'').slice(0,30));
}
const { imported, skipped } = await importSamples(results);
console.log('IMPORT: imported=', imported, 'skipped=', skipped);
process.exit(0);
