/**
 * Audit Logs Routes
 * 审计日志查询（分页+筛选）
 */
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// GET /api/admin/audit-logs
router.get('/', async (req, res) => {
  try {
    const {
      page = 1, pageSize = 20,
      action, targetType, targetId,
      riskLevel, adminId,
      startDate, endDate, keyword
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(pageSize);
    const take = Math.min(parseInt(pageSize), 100);
    const where = {};

    if (action) where.action = action;
    if (targetType) where.targetType = targetType;
    if (targetId) where.targetId = targetId;
    if (riskLevel) where.riskLevel = riskLevel;
    if (adminId) where.adminId = parseInt(adminId);
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }
    if (keyword) {
      where.OR = [
        { action: { contains: keyword } },
        { targetType: { contains: keyword } },
        { targetId: { contains: keyword } },
        { reason: { contains: keyword } },
      ];
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where, skip, take,
        orderBy: { createdAt: 'desc' },
        include: {
          admin: {
            select: { id: true, username: true, name: true, email: true }
          }
        }
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({
      data: logs,
      total,
      page: parseInt(page),
      pageSize: parseInt(pageSize),
    });
  } catch (err) {
    console.error('[AuditLogs] List error:', err);
    res.status(500).json({ error: '获取审计日志失败' });
  }
});

// GET /api/admin/audit-logs/actions - 获取所有操作类型
router.get('/actions', async (req, res) => {
  try {
    const actions = await prisma.auditLog.findMany({
      select: { action: true },
      distinct: ['action'],
    });
    res.json({ data: actions.map(a => a.action) });
  } catch (err) {
    console.error('[AuditLogs] Actions error:', err);
    res.status(500).json({ error: '获取操作类型失败' });
  }
});

// GET /api/admin/audit-logs/stats - 审计日志统计（按天/按操作类型）
router.get('/stats', async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const since = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000);

    const recentLogs = await prisma.auditLog.findMany({
      where: { createdAt: { gte: since } },
      select: { action: true, riskLevel: true, createdAt: true },
    });

    // 按天分组
    const byDate = {};
    const byAction = {};
    const byRisk = { low: 0, medium: 0, high: 0, critical: 0 };

    for (const log of recentLogs) {
      const dateKey = log.createdAt.toISOString().split('T')[0];
      byDate[dateKey] = (byDate[dateKey] || 0) + 1;
      byAction[log.action] = (byAction[log.action] || 0) + 1;
      if (byRisk[log.riskLevel] !== undefined) byRisk[log.riskLevel]++;
    }

    res.json({
      data: {
        totalInPeriod: recentLogs.length,
        byDate,
        byAction,
        byRisk,
      }
    });
  } catch (err) {
    console.error('[AuditLogs] Stats error:', err);
    res.status(500).json({ error: '获取审计统计失败' });
  }
});

export default router;
