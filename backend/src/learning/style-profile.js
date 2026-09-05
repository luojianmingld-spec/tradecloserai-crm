/**
 * 话术库自主学习进化 V1.1 - 租户沟通风格画像
 * 租户=销售。从该租户实战高质样本（含 AI 修改差异）提炼沟通风格画像，
 * AI 生成话术时按销售个人风格定制（Phase 8 注入）。
 */
import { LEARNING_CONFIG as CFG } from './config.js';
import { prisma, log, llmChatComplete, parseLLMJson } from './learning.service.js';

const STYLE_SYSTEM_PROMPT = `你是外贸销售沟通风格分析师。给定一位销售的真实沟通样本（客户消息 + 销售回复，可能含"AI建议 vs 销售手动修改"差异），提炼该销售的沟通风格画像。

只输出 JSON，不要其他文字：
{
  "styleSummary": "用一句话总结该销售的沟通风格（中文，30字内）",
  "tone": "formal | business-casual | friendly | enthusiastic | direct 选最贴切的一个",
  "lengthPref": "short | medium | long 选一个",
  "emojiPref": "rarely | occasionally | frequently 选一个",
  "greetingPref": "开场/称呼习惯（如：习惯用Hi+客户名、习惯先问候再进入正题、无固定开场）",
  "closingPref": "结尾习惯（如：习惯用Best regards、习惯催促下一步行动、无固定结尾）",
  "sentenceStyle": "句式特征（如：短句多、善用反问、爱列要点、详细解释型）",
  "tabooPhrases": "该销售明显避免的用语或风格（如：不用感叹号、避免过于正式、不写长段落）"
}`;

export async function updateTenantStyleProfile(accountId, { maxSamples = 60 } = {}) {
  const samples = await prisma.messageSample.findMany({
    where: { accountId, qualityScore: { gte: 55 } },
    orderBy: { createdAt: 'desc' },
    take: maxSamples,
    select: { customerMsg: true, salesReply: true, aiSuggestion: true, aiModified: true, usedAi: true, scene: true, createdAt: true },
  });
  if (!samples.length) return { updated: false, reason: 'no-samples', accountId };

  const sampleText = samples.map((s, i) => {
    const modified = s.aiModified ? ' [销售手动修改了AI建议]' : '';
    const ai = s.aiSuggestion ? `\nAI建议原文: ${String(s.aiSuggestion).slice(0, 300)}` : '';
    return `样本${i + 1} (${s.scene || '其他'}${modified}):\n客户说: ${String(s.customerMsg).slice(0, 250)}\n销售回: ${String(s.salesReply).slice(0, 300)}${ai}`;
  }).join('\n\n');

  let analysis = {};
  try {
    const raw = await llmChatComplete(
      [
        { role: 'system', content: STYLE_SYSTEM_PROMPT },
        { role: 'user', content: `请分析以下该销售的实战回复样本，提炼其沟通风格画像。\n\n${sampleText}` },
      ],
      { temperature: 0.3, max_tokens: 1500, timeout: CFG.llmTimeoutMs }
    );
    analysis = parseLLMJson(raw) || {};
    if (!analysis.styleSummary) throw new Error('LLM 返回缺少 styleSummary');
  } catch (e) {
    log('StyleProfile', `LLM 分析失败: ${e.message}，降级为规则摘要`);
    analysis = {
      styleSummary: `基于 ${samples.length} 条实战样本的沟通风格（LLM 分析暂不可用）`,
      tone: null, lengthPref: null, emojiPref: null,
      greetingPref: null, closingPref: null, sentenceStyle: null, tabooPhrases: null,
    };
  }

  const oldest = samples[samples.length - 1].createdAt;
  const newest = samples[0].createdAt;
  const record = await prisma.tenantStyleProfile.upsert({
    where: { accountId },
    update: {
      styleSummary: analysis.styleSummary || null,
      tone: analysis.tone || null,
      lengthPref: analysis.lengthPref || null,
      emojiPref: analysis.emojiPref || null,
      greetingPref: analysis.greetingPref || null,
      closingPref: analysis.closingPref || null,
      sentenceStyle: analysis.sentenceStyle || null,
      tabooPhrases: analysis.tabooPhrases || null,
      sampleCount: samples.length,
      sampleWindow: `${oldest ? oldest.toISOString() : ''} ~ ${newest ? newest.toISOString() : ''}`,
      status: 'active',
      updatedAt: new Date(),
    },
    create: {
      accountId,
      styleSummary: analysis.styleSummary || null,
      tone: analysis.tone || null,
      lengthPref: analysis.lengthPref || null,
      emojiPref: analysis.emojiPref || null,
      greetingPref: analysis.greetingPref || null,
      closingPref: analysis.closingPref || null,
      sentenceStyle: analysis.sentenceStyle || null,
      tabooPhrases: analysis.tabooPhrases || null,
      sampleCount: samples.length,
      sampleWindow: `${oldest ? oldest.toISOString() : ''} ~ ${newest ? newest.toISOString() : ''}`,
      status: 'active',
    },
  });
  log('StyleProfile', `accountId=${accountId} samples=${samples.length} tone=${analysis.tone || '-'} status=active`);
  return { updated: true, id: record.id, accountId, samples: samples.length, analysis };
}

const isMain = process.argv[1] && /style-profile\.js$/.test(process.argv[1]);
if (isMain) {
  const accountId = parseInt((process.argv[2] || '').split('=')[1], 10) || CFG.defaultAccountId;
  updateTenantStyleProfile(accountId)
    .then((r) => { console.log('[StyleProfile Result]', JSON.stringify(r, null, 2)); process.exit(0); })
    .catch((e) => { console.error('[StyleProfile Failed]', e.message); process.exit(1); });
}

export default { updateTenantStyleProfile };
