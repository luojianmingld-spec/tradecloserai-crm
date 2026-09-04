/**
 * 话术库自主学习进化 V1 - 自动入库
 * 质量分≥阈值 → 写入 MessageSample 租户私有池（accountId 隔离）
 *  - reviewStatus='待审'(pending)，sourceType/sourceMsgIds 记录来源
 *  - publicPool V1 恒 false；weight 依据 aiModified/成交信号加权
 *  - 入库前查重，避免重复
 */
import { LEARNING_CONFIG as CFG } from './config.js';
import { prisma, log, findDuplicateSample, dedupeKey } from './learning.service.js';

const importedKeys = new Set();

/**
 * 单条自动入库
 * @param {object} sample 原始样本
 * @param {object} analysis 学习引擎分析结果（含 scene/qualityScore/脱敏文本）
 * @returns {Promise<object|null>} 入库记录或 null
 */
export async function importSample(sample, analysis) {
  if (!analysis || analysis.qualityScore < CFG.qualityThreshold) {
    return { imported: false, reason: `qualityScore ${analysis?.qualityScore} < ${CFG.qualityThreshold}` };
  }
  if (importedKeys.has(dedupeKey(sample))) {
    return { imported: false, reason: 'process-dedupe' };
  }
  // 落库前查重
  const dup = await findDuplicateSample({
    accountId: sample.accountId,
    customerMsg: analysis.customerMsg || sample.customerMsg,
    salesReply: analysis.salesReply || sample.salesReply,
    sourceMsgIds: sample.sourceMsgIds,
  });
  if (dup) {
    importedKeys.add(dedupeKey(sample));
    return { imported: false, reason: `dup#${dup.id}` };
  }

  const created = await prisma.messageSample.create({
    data: {
      accountId: sample.accountId,
      contactJid: sample.contactJid || 'learning-auto',
      customerMsg: analysis.customerMsg || sample.customerMsg,
      salesReply: analysis.salesReply || sample.salesReply,
      customerMsgLang: sample.customerMsgLang || null,
      salesReplyLang: null,
      usedAi: !!sample.usedAi,
      aiSuggestion: null,
      aiModified: !!sample.aiModified,
      contextBefore: sample.contextBefore || null,
      industry: analysis.industry || null,
      productLine: analysis.productLine || null,
      scene: analysis.scene || '其他',
      favorited: false,
      qualityScore: analysis.qualityScore,
      sourceType: sample.sourceType || 'wamessage',
      sourceMsgIds: sample.sourceMsgIds ? JSON.stringify(sample.sourceMsgIds) : null,
      publicPool: false, // V1 不进公共池
      reviewStatus: 'pending', // 待审
      weight: sample.weightBase != null ? sample.weightBase : CFG.weightBase,
    },
    select: { id: true, qualityScore: true, scene: true, reviewStatus: true, weight: true },
  });
  importedKeys.add(dedupeKey(sample));
  log('Import', `#${created.id} scene=${created.scene} score=${created.qualityScore} weight=${created.weight} (${created.reviewStatus})`);
  return { imported: true, id: created.id, record: created };
}

/**
 * 批量自动入库
 */
export async function importSamples(results) {
  let imported = 0;
  let skipped = 0;
  for (const { sample, analysis } of results) {
    const r = await importSample(sample, analysis);
    if (r.imported) imported++;
    else skipped++;
  }
  return { imported, skipped };
}

export default { importSample, importSamples };
