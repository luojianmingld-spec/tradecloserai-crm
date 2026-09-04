import { LEARNING_CONFIG as CFG } from './src/learning/config.js';
import { llmChatComplete } from './src/learning/learning.service.js';
const prompt = `你是外贸销售话术质量评估专家。请对下面一组「客户消息 → 销售回复」做专业评估。

客户消息：
"""Your price is higher than our current supplier. Can you give a better price, say USD 1.55/kg?"""

销售回复：
"""We appreciate your business. While USD 1.55/kg is below our cost range, I can offer a tiered discount: USD 1.72/kg for 1000+ rolls, plus free samples. Let me prepare a best-price offer for your monthly volume."""

请输出如下JSON（不要输出其他内容，qualityScore为0-100整数，scene仅从[询盘、报价、砍价、催单、售后、技术答疑、其他]中选）：
{
  "scene": "场景",
  "industry": "行业",
  "productLine": "产品线",
  "qualityScore": 0-100整数,
  "qualityReason": "理由",
  "keyPhrase": "核心话术"
}`;
let ok = 0, empty = 0, err = 0;
for (let i = 0; i < 8; i++) {
  const t0 = Date.now();
  try {
    const raw = await llmChatComplete([{ role: 'user', content: prompt }], { temperature: 0.2, max_tokens: CFG.llmMaxTokens, timeout: CFG.llmTimeoutMs }, 5);
    const dt = ((Date.now() - t0) / 1000).toFixed(1);
    if (raw && raw.trim()) { ok++; console.log(`#${i} OK len=${raw.length} dt=${dt}s head=${JSON.stringify(String(raw).slice(0,30))}`); }
    else { empty++; console.log(`#${i} EMPTY dt=${dt}s`); }
  } catch (e) { err++; console.log(`#${i} ERR: ${String(e.message).slice(0,100)}`); }
}
console.log(`=== 汇总: ok=${ok} empty=${empty} err=${err} / 8`);
process.exit(0);
