/**
 * fraud-check.js - 防薅羊毛检测与惩罚
 *
 * 规则（Jeremy 2026-08-23 拍板）：不同租户账号共享同一 WhatsApp / 邮箱 / TG 身份 → 属于违规
 * 惩罚：赠送积分清零（充值积分保留）。
 *
 * 余额语义沿用 credits.js：CreditTransaction.balanceAfter 为最新余额。
 * 惩罚通过新增 type='penalty' 的流水实现（不影响 recharge/consume/gift 等既有类型）。
 */
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getCreditBalance } from './credits.js';

const prisma = new PrismaClient();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_FILE = path.join(__dirname, '../../fraud-violations.log');

// 检测跨租户共享身份：WhatsApp 号码 / 邮箱 / Telegram Bot Token
export async function detectCrossTenantSharing() {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT 'whatsapp' AS signal, a.phone AS value,
           string_agg(DISTINCT u.id::text, ',') AS "userIds",
           string_agg(DISTINCT u."tenantId"::text, ',') AS "tenantIds",
           count(DISTINCT u."tenantId")::int AS "tenantCount"
    FROM "WhatsAppAccount" a
    JOIN "User" u ON u.id = a."userId"
    WHERE a.platform = 'whatsapp' AND a.phone IS NOT NULL AND a.phone <> ''
      AND a.status IN ('connected','connecting')
    GROUP BY a.phone
    HAVING count(DISTINCT u."tenantId") > 1

    UNION ALL

    SELECT 'email' AS signal, e.email AS value,
           string_agg(DISTINCT u.id::text, ',') AS "userIds",
           string_agg(DISTINCT u."tenantId"::text, ',') AS "tenantIds",
           count(DISTINCT u."tenantId")::int AS "tenantCount"
    FROM "EmailAccount" e
    JOIN "User" u ON u.id = e."userId"
    WHERE e.email IS NOT NULL AND e.email <> ''
    GROUP BY e.email
    HAVING count(DISTINCT u."tenantId") > 1

    UNION ALL

    SELECT 'telegram' AS signal, a."telegramBotToken" AS value,
           string_agg(DISTINCT u.id::text, ',') AS "userIds",
           string_agg(DISTINCT u."tenantId"::text, ',') AS "tenantIds",
           count(DISTINCT u."tenantId")::int AS "tenantCount"
    FROM "WhatsAppAccount" a
    JOIN "User" u ON u.id = a."userId"
    WHERE a.platform = 'telegram' AND a."telegramBotToken" IS NOT NULL AND a."telegramBotToken" <> ''
    GROUP BY a."telegramBotToken"
    HAVING count(DISTINCT u."tenantId") > 1
  `);
  return rows || [];
}

// 清零指定用户的赠送积分（充值积分保留）
// 余额语义：balanceAfter = max(当前余额 - 赠送积分总额, 0)
export async function clearGiftCredits(userId, reason) {
  const giftAgg = await prisma.creditTransaction.aggregate({
    where: { userId, type: 'gift' },
    _sum: { amount: true },
  });
  const giftTotal = Math.round((giftAgg._sum.amount || 0) * 100) / 100;
  const balance = await getCreditBalance(userId);
  const base = { userId, giftTotal, balanceBefore: balance };
  if (giftTotal <= 0) return { ...base, cleared: 0, balanceAfter: balance };

  const balanceAfter = Math.max(Math.round((balance - giftTotal) * 100) / 100, 0);
  const cleared = Math.round((balance - balanceAfter) * 100) / 100;
  if (cleared <= 0) return { ...base, cleared: 0, balanceAfter };

  await prisma.creditTransaction.create({
    data: {
      userId,
      type: 'penalty',
      amount: -cleared,
      balanceAfter,
      reason: `防薅羊毛违规：${reason}（赠送积分清零，充值积分保留）`,
    },
  });
  return { ...base, cleared, balanceAfter };
}

function appendLog(entry) {
  try {
    fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + '\n');
  } catch (e) {
    console.warn('[Fraud] log append error:', e.message);
  }
}

// 执行一轮完整惩罚：检测 → 清零违规用户赠送积分 → 落盘日志
export async function runFraudPenalty() {
  const clusters = await detectCrossTenantSharing();
  const results = [];
  for (const c of clusters) {
    const userIds = String(c.userIds || '').split(',').filter(Boolean).map(Number);
    for (const uid of userIds) {
      const r = await clearGiftCredits(uid, `${c.signal}「${c.value}」跨租户共享（租户 ${c.tenantIds}）`);
      results.push({ signal: c.signal, value: c.value, ...r });
    }
  }
  const summary = { scannedAt: new Date().toISOString(), clusters: clusters.length, results };
  appendLog({ type: 'fraud_penalty_run', ...summary });
  console.log(`[Fraud] scan done: clusters=${clusters.length}, penalized=${results.length}`);
  return summary;
}

// 每日自动扫描（幂等启动）
let fraudTimer = null;
export function startFraudScheduler() {
  if (fraudTimer) return;
  const DAILY = 24 * 60 * 60 * 1000;
  // 启动后 5 分钟先跑一次（避开开发/重启的即时干扰），之后每 24 小时一次
  setTimeout(() => {
    runFraudPenalty().catch((e) => console.error('[Fraud] initial scan error:', e.message));
  }, 5 * 60 * 1000);
  fraudTimer = setInterval(() => {
    runFraudPenalty().catch((e) => console.error('[Fraud] daily scan error:', e.message));
  }, DAILY);
  console.log('[Fraud Scheduler] Started, auto-scan daily');
}
