/**
 * 话术库自主学习进化 V1 - 学习引擎
 * LLM 场景分类（询盘/报价/砍价/催单/售后/技术答疑…）+ 质量评分 0-100 + 话术提炼 + 脱敏
 */
import { LEARNING_CONFIG as CFG } from './config.js';
import { prisma, parseLLMJson, log, llmDesensitize, regexDesensitize, llmChatComplete } from './learning.service.js';

const SCENES = ['询盘', '报价', '砍价', '催单', '售后', '技术答疑', '其他'];

/**
 * 对单个配对样本做分类 + 评分 + 提炼
 * @param {object} sample 采集器输出的原始样本
 * @returns {Promise<object|null>} 分析结果
 */
export async function analyzeSample(sample, chargeUserId = null) {
  const customerMsg = String(sample.customerMsg || '').slice(0, 2000);
  const salesReply = String(sample.salesReply || '').slice(0, 2000);
  if (!customerMsg || !salesReply) return null;

  const context = sample.contextBefore && sample.contextBefore !== '[]'
    ? `\n前文上下文(JSON): ${sample.contextBefore.slice(0, 1200)}`
    : '';

  const prompt = `你是外贸销售话术质量评估专家。请对下面一组「客户消息 → 销售回复」做专业评估。

客户消息：
"""${customerMsg}"""

销售回复：
"""${salesReply}"""
${context}

请输出如下JSON（不要输出其他内容，qualityScore为0-100整数，scene仅从[${SCENES.join('、')}]中选，如不属于任何场景用"其他"）：
{
  "scene": "场景",
  "industry": "所属行业(如 包装材料/机械/电子，不确定填null)",
  "productLine": "产品线(如 拉伸膜/挤出生产线，不确定填null)",
  "qualityScore": 0-100整数,
  "qualityReason": "评分理由(30字内)",
  "keyPhrase": "这条回复中可复用的核心话术要点(50字内，若无则null)"
}`;

  try {
    const raw = await llmChatComplete(
      [{ role: 'user', content: prompt }],
      { temperature: 0.2, max_tokens: CFG.llmMaxTokens, timeout: CFG.llmTimeoutMs, chargeUserId }
    );
    const obj = parseLLMJson(raw) || {};
    if (!obj || typeof obj.qualityScore !== 'number') {
      log('Engine', `解析失败 raw=${JSON.stringify(String(raw).slice(0, 300))}`);
    }
    const score = clampScore(Number(obj.qualityScore));
    const scene = SCENES.includes(obj.scene) ? obj.scene : (obj.scene ? String(obj.scene).slice(0, 20) : '其他');
    const result = {
      scene,
      industry: obj.industry && obj.industry !== 'null' ? String(obj.industry).slice(0, 50) : null,
      productLine: obj.productLine && obj.productLine !== 'null' ? String(obj.productLine).slice(0, 80) : null,
      qualityScore: score,
      qualityReason: String(obj.qualityReason || '').slice(0, 120),
      keyPhrase: obj.keyPhrase && obj.keyPhrase !== 'null' ? String(obj.keyPhrase).slice(0, 200) : null,
    };
    // 脱敏：正则 + LLM 复核
    const des = await llmDesensitize(sample.customerMsg, sample.salesReply, chargeUserId);
    result.customerMsg = des.customerMsg;
    result.salesReply = des.salesReply;
    return result;
  } catch (e) {
    log('Engine', 'analyzeSample LLM error:', e.message);
    // 降级：正则脱敏 + 保守评分，避免整批失败
    return {
      scene: '其他',
      industry: null,
      productLine: null,
      qualityScore: 0,
      qualityReason: 'LLM调用失败，已跳过',
      keyPhrase: null,
      customerMsg: regexDesensitize(sample.customerMsg),
      salesReply: regexDesensitize(sample.salesReply),
    };
  }
}

function clampScore(n) {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/**
 * 批量分析（受控并发，控制 token 成本）
 */
export async function analyzeSamples(samples, { concurrency = CFG.llmConcurrency, chargeUserId = null } = {}) {
  const results = [];
  let idx = 0;
  const worker = async () => {
    while (idx < samples.length) {
      const cur = idx++;
      try {
        const r = await analyzeSample(samples[cur], chargeUserId);
        results[cur] = { sample: samples[cur], analysis: r };
      } catch (e) {
        log('Engine', 'analyzeSamples worker error:', e.message);
        results[cur] = { sample: samples[cur], analysis: null };
      }
    }
  };
  const workers = [];
  for (let i = 0; i < concurrency; i++) workers.push(worker());
  await Promise.all(workers);
  return results.filter(Boolean);
}

export default { analyzeSample, analyzeSamples, SCENES };
