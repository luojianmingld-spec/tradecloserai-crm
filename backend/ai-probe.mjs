// 复现: 检查 active provider + 连续调用观察空返回
import { chatComplete, getActiveProvider } from './src/services/ai-client.js';
const prov = await getActiveProvider();
console.log('=== active provider:', prov?.name, '|', prov?.model, '|', prov?.id);
// 短 prompt
for (let i = 0; i < 5; i++) {
  try {
    const raw = await chatComplete([{ role: 'user', content: '只回复两个字：好的' }], { temperature: 0.2, max_tokens: 100, timeout: 30000 });
    console.log(`SHORT#${i} len=${raw.length} head=${JSON.stringify(String(raw).slice(0,40))}`);
  } catch (e) { console.log(`SHORT#${i} ERR: ${String(e.message).slice(0,120)}`); }
}
// 长 JSON prompt（模拟 analyzeSample）
const prompt = `你是外贸销售话术质量评估专家。请对下面一组「客户消息 → 销售回复」做专业评估。

客户消息：
"""Your price is higher than our current supplier. Can you give a better price, say USD 1.55/kg?"""

销售回复：
"""We appreciate your business. While USD 1.55/kg is below our cost range, I can offer a tiered discount: USD 1.72/kg for 1000+ rolls, plus free samples."""

请输出如下JSON（不要输出其他内容，qualityScore为0-100整数，scene仅从[询盘、报价、砍价、催单、售后、技术答疑、其他]中选）：
{
  "scene": "场景",
  "industry": "行业",
  "productLine": "产品线",
  "qualityScore": 0-100整数,
  "qualityReason": "理由",
  "keyPhrase": "核心话术"
}`;
for (let i = 0; i < 5; i++) {
  try {
    const raw = await chatComplete([{ role: 'user', content: prompt }], { temperature: 0.2, max_tokens: 1600, timeout: 60000 });
    console.log(`LONG#${i} len=${raw.length} head=${JSON.stringify(String(raw).slice(0,60))}`);
  } catch (e) { console.log(`LONG#${i} ERR: ${String(e.message).slice(0,120)}`); }
}
process.exit(0);
