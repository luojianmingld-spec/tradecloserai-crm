import { collectSamples } from './src/learning/sample-collector.js';
import { sessionsForAccount, findDuplicateSample } from './src/learning/learning.service.js';
import { analyzeSamples } from './src/learning/learning-engine.js';
import { LEARNING_CONFIG as CFG } from './src/learning/config.js';
const sess = await sessionsForAccount(1);
const { samples } = await collectSamples({ accountId: 1, sessionIds: sess, cursor: new Date('2026-07-20T00:00:00'), limit: 5 });
console.log('samples:', samples.length);
for (const s of samples) {
  const dup = await findDuplicateSample({ accountId: s.accountId, customerMsg: s.customerMsg, salesReply: s.salesReply, sourceMsgIds: s.sourceMsgIds });
  console.log('SAMPLE jid=', s.contactJid, 'customerLen=', (s.customerMsg||'').length, 'replyLen=', (s.salesReply||'').length, 'dup=', dup?.id || null, 'aiModified=', s.aiModified);
}
const results = await analyzeSamples(samples, { concurrency: 2 });
for (const r of results) {
  const a = r.analysis || {};
  console.log('ANALYZED score=', a.qualityScore, 'scene=', a.scene, 'reason=', a.qualityReason, 'replyLen=', (a.salesReply||'').length);
}
process.exit(0);
