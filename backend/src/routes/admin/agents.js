/**
 * Agent Statistics Routes
 * Agent统计（调用量/成功率/趋势/错误）
 */
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// GET /api/admin/agents/overview - Agent总览
router.get('/overview', async (req, res) => {
  try {
    const [totalCalls, successCalls, failedCalls, timeoutCalls, avgResponseTime] = await Promise.all([
      prisma.agentUsageLog.count(),
      prisma.agentUsageLog.count({ where: { outputStatus: 'success' } }),
      prisma.agentUsageLog.count({ where: { outputStatus: 'failed' } }),
      prisma.agentUsageLog.count({ where: { outputStatus: 'timeout' } }),
      prisma.agentUsageLog.aggregate({ _avg: { responseTime: true } }),
    ]);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayCalls = await prisma.agentUsageLog.count({ where: { createdAt: { gte: today } } });
    const todayFailed = await prisma.agentUsageLog.count({
      where: { outputStatus: 'failed', createdAt: { gte: today } }
    });

    // 按agentType分组
    const byType = await prisma.$queryRawUnsafe(
      `SELECT "agentType", COUNT(*)::int as count,
              COUNT(CASE WHEN "outputStatus"='success' THEN 1 END)::int as success,
              COUNT(CASE WHEN "outputStatus"='failed' THEN 1 END)::int as failed,
              ROUND(AVG("responseTime")::numeric, 2) as avgResponseTime
       FROM "AgentUsageLog"
       GROUP BY "agentType"
       ORDER BY count DESC`
    );

    res.json({
      data: {
        totalCalls,
        successCalls,
        failedCalls,
        timeoutCalls,
        successRate: totalCalls > 0 ? ((successCalls / totalCalls) * 100).toFixed(2) + '%' : '0%',
        avgResponseTime: avgResponseTime._avg.responseTime ? Math.round(avgResponseTime._avg.responseTime) : null,
        todayCalls,
        todayFailed,
        byType,
      }
    });
  } catch (err) {
    console.error('[Agents] Overview error:', err);
    res.status(500).json({ error: '获取Agent统计失败' });
  }
});

// GET /api/admin/agents/trend - Agent调用趋势
router.get('/trend', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const agentType = req.query.agentType;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    let whereClause = `"createdAt" >= $1`;
    let params = [since];
    if (agentType) {
      whereClause += ` AND "agentType" = $2`;
      params.push(agentType);
    }

    const trend = await prisma.$queryRawUnsafe(
      `SELECT DATE("createdAt") as date,
              COUNT(*)::int as total,
              COUNT(CASE WHEN "outputStatus"='success' THEN 1 END)::int as success,
              COUNT(CASE WHEN "outputStatus"='failed' THEN 1 END)::int as failed,
              COUNT(CASE WHEN "outputStatus"='timeout' THEN 1 END)::int as timeout,
              ROUND(AVG("responseTime")::numeric, 2) as avgResponseTime
       FROM "AgentUsageLog"
       WHERE ${whereClause}
       GROUP BY DATE("createdAt")
       ORDER BY date`,
      ...params
    );

    res.json({ data: trend });
  } catch (err) {
    console.error('[Agents] Trend error:', err);
    res.status(500).json({ error: '获取Agent趋势失败' });
  }
});

// GET /api/admin/agents/errors - 错误日志
router.get('/errors', async (req, res) => {
  try {
    const { page = 1, pageSize = 20, agentType, days = 7 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(pageSize);
    const take = parseInt(pageSize);
    const since = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000);

    const where = {
      outputStatus: { in: ['failed', 'timeout'] },
      createdAt: { gte: since }
    };
    if (agentType) where.agentType = agentType;

    const [errors, total] = await Promise.all([
      prisma.agentUsageLog.findMany({
        where, skip, take,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.agentUsageLog.count({ where }),
    ]);

    res.json({ data: errors, total, page: parseInt(page), pageSize: parseInt(pageSize) });
  } catch (err) {
    console.error('[Agents] Errors error:', err);
    res.status(500).json({ error: '获取错误日志失败' });
  }
});

// GET /api/admin/agents/types - 获取所有agent类型
router.get('/types', async (req, res) => {
  try {
    const types = await prisma.agentUsageLog.findMany({
      select: { agentType: true },
      distinct: ['agentType'],
    });
    res.json({ data: types.map(t => t.agentType) });
  } catch (err) {
    console.error('[Agents] Types error:', err);
    res.status(500).json({ error: '获取Agent类型失败' });
  }
});

export default router;
