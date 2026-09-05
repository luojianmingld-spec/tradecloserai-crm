/**
 * 话术库自主学习进化 V1.1 - 租户风格注入器
 * AI 生成话术时按租户(=销售)个人沟通风格 + 历史高质话术参考定制。
 * 只读本租户私有池（accountId 隔离），不泄露跨租户数据。
 */
import { prisma } from './learning.service.js';

export async function getTenantStyleBlock(accountId, queryText = '') {
  if (!accountId) return '';
  const parts = [];

  // 1) 租户沟通风格画像
  try {
    const profile = await prisma.tenantStyleProfile.findUnique({ where: { accountId } });
    if (profile && profile.status === 'active' && profile.styleSummary) {
      const lines = ['## 你的沟通风格（基于你的实战回复总结，生成时请贴合）'];
      lines.push(`- 总体: ${profile.styleSummary}`);
      if (profile.tone) lines.push(`- 语气: ${profile.tone}`);
      if (profile.lengthPref) lines.push(`- 长度偏好: ${profile.lengthPref}`);
      if (profile.emojiPref) lines.push(`- 表情使用: ${profile.emojiPref}`);
      if (profile.greetingPref) lines.push(`- 开场习惯: ${profile.greetingPref}`);
      if (profile.closingPref) lines.push(`- 结尾习惯: ${profile.closingPref}`);
      if (profile.sentenceStyle) lines.push(`- 句式特征: ${profile.sentenceStyle}`);
      if (profile.tabooPhrases) lines.push(`- 避免: ${profile.tabooPhrases}`);
      lines.push('请让 3 个回复都符合你本人的沟通风格，而不是千篇一律的AI腔。');
      parts.push(lines.join('\n'));
    }
  } catch (e) {
    console.warn('[StyleInject] profile read failed:', e.message);
  }

  // 2) 本租户历史高质话术参考（私有池，质量分≥60，权重优先）
  try {
    const samples = await prisma.messageSample.findMany({
      where: { accountId, qualityScore: { gte: 60 } },
      orderBy: [{ weight: 'desc' }, { createdAt: 'desc' }],
      take: 3,
      select: { customerMsg: true, salesReply: true, scene: true, weight: true },
    });
    if (samples.length) {
      const refs = samples.map((s, i) =>
        `【参考${i + 1}】(${s.scene || '其他'}${s.weight && s.weight > 1 ? '·成交加权' : ''}) 客户说: ${String(s.customerMsg).slice(0, 120)} | 你的回复: ${String(s.salesReply).slice(0, 220)}`
      ).join('\n');
      parts.push(`## 你的历史高质回复参考（你曾这样回复效果不错，可参考语气/结构/切入点）\n${refs}\n不要照抄，要针对当前客户和最新消息具体调整。`);
    }
  } catch (e) {
    console.warn('[StyleInject] samples read failed:', e.message);
  }

  return parts.length ? '\n\n' + parts.join('\n\n') : '';
}

export default { getTenantStyleBlock };
