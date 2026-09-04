/**
 * 微信统计查询服务 —— 「老板总裁助理」V1
 * 
 * 职责：识别微信里的统计类问题（本周/本月业绩、客户情况、询盘跟进等），
 * 直接查 CRM 真实数据并组织成简洁中文汇报文本，回推微信。
 * 不命中统计意图时返回 null，由 openai-bridge 走原有 LLM 链路。
 * 
 * 数据口径：固定 userId=1（当前单租户老板），WAMessage 会话 user_1。
 * 多租户改造时通过 req 上下文/环境变量扩展。
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 统计触发词：明确统计动作
const STATS_VERBS = ['业绩', '统计', '汇总', '总结', '复盘', '月报', '周报', '数据报告', '分析报告', '数据汇报'];
// 业务数据名词（需配合时间词或单独触发）
const STATS_NOUNS = ['询盘', '跟进', '成交', '客户情况', '客户数', '消息', '聊天'];
const STATS_NOUN_DIRECT = ['客户情况', '询盘情况', '跟进情况', '成交情况', '消息情况'];
// 时间词
const TIME_WORDS = [
  { re: /今天|今日/, period: 'day' },
  { re: /本周|这周/, period: 'week' },
  { re: /本月|这个月/, period: 'month' },
  { re: /最近/, period: 'week' },
];

const USER_ID = Number(process.env.WECHAT_STATS_USER_ID || 1);

function detectPeriod(text) {
  for (const t of TIME_WORDS) {
    if (t.re.test(text)) return t.period;
  }
  return 'month'; // 默认本月
}

/**
 * 判断是否为统计类意图
 * @returns {null | {period: string}}
 */
export function detectStatsIntent(text) {
  if (!text || !text.trim()) return null;
  const t = text.trim();

  // 1) 明确统计动作词
  if (STATS_VERBS.some((w) => t.includes(w))) {
    return { period: detectPeriod(t) };
  }

  // 2) 业务名词 + 时间词（如「本月询盘」「本周跟进」）
  if (STATS_NOUNS.some((w) => t.includes(w)) && TIME_WORDS.some((tw) => tw.re.test(t))) {
    return { period: detectPeriod(t) };
  }

  // 3) 直接问情况（如「客户情况怎么样」「询盘情况」）
  if (STATS_NOUN_DIRECT.some((w) => t.includes(w))) {
    return { period: detectPeriod(t) };
  }

  return null;
}

function periodStart(period) {
  const now = new Date();
  if (period === 'day') {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  if (period === 'week') {
    return new Date(now.getTime() - 7 * 86400000);
  }
  // month
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

/**
 * 查询真实统计并组织汇报文本
 * @returns {Promise<string|null>} 汇报文本，异常返回 null（降级走 LLM）
 */
export async function buildStatsReply(text) {
  try {
    const intent = detectStatsIntent(text);
    if (!intent) return null;

    const period = intent.period;
    const start = periodStart(period);
    const sessionId = 'user_' + USER_ID;
    const periodLabel = period === 'day' ? '今日' : period === 'week' ? '本周' : '本月';

    const [msgStats, totalCustomers, newCustomers, closedCustomers, followups, levelGroups] = await Promise.all([
      prisma.wAMessage.groupBy({
        by: ['direction'],
        where: { sessionId, timestamp: { gte: start } },
        _count: { id: true },
      }),
      prisma.customer.count({ where: { userId: USER_ID, isBusiness: true } }),
      prisma.customer.count({ where: { userId: USER_ID, isBusiness: true, firstContactAt: { gte: start } } }),
      prisma.customer.count({ where: { userId: USER_ID, isBusiness: true, status: { in: ['closed', 'won'] } } }),
      prisma.customerFollowUp.count({
        where: { customer: { userId: USER_ID }, createdAt: { gte: start } },
      }),
      prisma.customer.groupBy({
        by: ['customerLevel'],
        where: { userId: USER_ID, isBusiness: true },
        _count: { id: true },
      }),
    ]);

    let inbound = 0;
    let outbound = 0;
    for (const s of msgStats) {
      if (s.direction === 'inbound') inbound = s._count.id;
      if (s.direction === 'outbound') outbound = s._count.id;
    }

    const levelMap = {};
    for (const g of levelGroups) levelMap[g.customerLevel] = g._count.id;
    const levelLine = Object.keys(levelMap).length
      ? '分层：' + Object.entries(levelMap).map(([k, v]) => `${k}级${v}家`).join(' / ')
      : '分层：暂无';

    const lines = [
      `【${periodLabel}业绩统计】`,
      `📊 客户：共 ${totalCustomers} 家，${periodLabel}新增 ${newCustomers} 家`,
      `👥 ${levelLine}`,
      `💬 消息：收 ${inbound} 条 / 发 ${outbound} 条`,
      `📌 跟进：${followups} 次`,
      `🏆 成交：${closedCustomers} 家`,
      `—— TradeCloser AI 总裁助理`,
    ];
    return lines.join('\n');
  } catch (err) {
    console.error('[WechatStats] 查询失败:', err.message);
    return null;
  }
}

export default { detectStatsIntent, buildStatsReply };
