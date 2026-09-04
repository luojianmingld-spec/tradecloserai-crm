import { smartMatchAll } from './src/routes/speech-library.js';
// 用交期/催单相关的查询，看能否命中刚入库的 #455
const queries = ['confirm delivery before Sep 10 production', '订单交期 交货时间 催单 加急'];
for (const q of queries) {
  const res = await smartMatchAll({ platform: 'whatsapp', jid: '4917012345678@s.whatsapp.net', query: q, limit: 8 });
  console.log(`=== query: ${q}`);
  const samples = (res && (res.samples || res.messageSamples || res.data)) || [];
  for (const s of (Array.isArray(samples) ? samples : [])) {
    console.log('  #', s.id, '|', s.scene, '| score=', s.qualityScore, '|', String(s.salesReply || '').slice(0, 50));
  }
  if (!samples.length) console.log('  (无命中) raw keys:', res ? Object.keys(res) : null);
}
process.exit(0);
