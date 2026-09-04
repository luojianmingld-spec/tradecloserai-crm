/**
 * Dashboard Routes
 * Dashboard 8张指标卡片数据
 */
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { Prisma } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// GET /api/admin/dashboard/stats
router.get('/stats', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);

    const dau = await prisma.user.count({
      where: { accounts: { some: { lastActiveAt: { gte: today, lte: todayEnd } } } }
    }).catch(() => 0);

    const totalUsers = await prisma.user.count();

    const paidUsers = await prisma.userSubscription.count({ where: { status: 'active' } });

    const activeSubs = await prisma.userSubscription.findMany({
      where: { status: 'active' }, select: { pricePaid: true },
    });
    const mrr = activeSubs.reduce((sum, s) => sum + (s.pricePaid || 0), 0);

    const todayCreditsConsumed = await prisma.creditTransaction.aggregate({
      where: { type: 'consume', createdAt: { gte: today, lte: todayEnd } },
      _sum: { amount: true },
    });
    const creditsConsumed = Math.abs(todayCreditsConsumed._sum.amount || 0);

    const [totalRecharge, totalConsume, totalGift] = await Promise.all([
      prisma.creditTransaction.aggregate({ where: { type: 'recharge' }, _sum: { amount: true } }),
      prisma.creditTransaction.aggregate({ where: { type: 'consume' }, _sum: { amount: true } }),
      prisma.creditTransaction.aggregate({ where: { type: 'gift' }, _sum: { amount: true } }),
    ]);
    const creditPool =
      Math.abs(totalRecharge._sum.amount || 0) +
      Math.abs(totalGift._sum.amount || 0) +
      (totalConsume._sum.amount || 0);

    const agentTotalCalls = await prisma.agentUsageLog.count();
    const pendingAlerts = await prisma.agentUsageLog.count({
      where: { outputStatus: 'failed', createdAt: { gte: today } }
    });

    // ── 新增字段 ──
    const todayNewUsers = await prisma.user.count({
      where: { createdAt: { gte: today, lte: todayEnd } }
    });

    const allSubs = await prisma.userSubscription.findMany({ select: { pricePaid: true } });
    const totalRevenue = allSubs.reduce((sum, s) => sum + (s.pricePaid || 0), 0);

    const arpu = paidUsers > 0 ? Math.round(mrr / paidUsers) : 0;

    const todaySubs = await prisma.userSubscription.findMany({
      where: { createdAt: { gte: today, lte: todayEnd }, status: 'active' },
      select: { pricePaid: true }
    });
    const todayRevenue = todaySubs.reduce((sum, s) => sum + (s.pricePaid || 0), 0);

    const creditOverview = {
      totalIssued: Math.abs(totalRecharge._sum.amount || 0) + Math.abs(totalGift._sum.amount || 0),
      totalConsumed: Math.abs(totalConsume._sum.amount || 0),
      balance: creditPool,
      todayConsumed: creditsConsumed
    };

    res.json({
      data: { dau, totalUsers, paidUsers, mrr, todayCreditsConsumed: creditsConsumed, creditPool, agentTotalCalls, pendingAlerts, todayNewUsers, totalRevenue, arpu, todayRevenue, creditOverview }
    });
  } catch (err) {
    console.error('[Dashboard] Stats error:', err);
    res.status(500).json({ error: '获取仪表盘数据失败' });
  }
});

// GET /api/admin/dashboard/trend
router.get('/trend', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const userTrend = await prisma.$queryRawUnsafe(
      'SELECT DATE("createdAt") as date, COUNT(*)::int as count FROM "User" WHERE "createdAt" >= CAST($1 AS TIMESTAMP) GROUP BY DATE("createdAt") ORDER BY date',
      since.toISOString()
    );

    const agentTrend = await prisma.$queryRawUnsafe(
      'SELECT DATE("createdAt") as date, COUNT(*)::int as count FROM "AgentUsageLog" WHERE "createdAt" >= CAST($1 AS TIMESTAMP) GROUP BY DATE("createdAt") ORDER BY date',
      since.toISOString()
    );

    const creditTrend = await prisma.$queryRawUnsafe(
      "SELECT DATE(\"createdAt\") as date, COALESCE(SUM(CASE WHEN \"type\"='consume' THEN ABS(\"amount\") ELSE 0 END), 0)::float as consumed, COALESCE(SUM(CASE WHEN \"type\"='recharge' THEN ABS(\"amount\") ELSE 0 END), 0)::float as recharged FROM \"CreditTransaction\" WHERE \"createdAt\" >= CAST($1 AS TIMESTAMP) GROUP BY DATE(\"createdAt\") ORDER BY date",
      since.toISOString()
    );

    const revenueTrend = await prisma.$queryRawUnsafe(
      `SELECT DATE("createdAt") as date, COALESCE(SUM("pricePaid"), 0)::float as revenue FROM "UserSubscription" WHERE "createdAt" >= CAST($1 AS TIMESTAMP) GROUP BY DATE("createdAt") ORDER BY date`,
      since.toISOString()
    );

    res.json({ data: { userTrend, agentTrend, creditTrend, revenueTrend } });
  } catch (err) {
    console.error('[Dashboard] Trend error:', err);
    res.status(500).json({ error: '获取趋势数据失败' });
  }
});

export default router;
