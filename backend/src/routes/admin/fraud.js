/**
 * 防薅羊毛管理接口（超管后台）
 * GET  /api/admin/fraud/report   — 只检测不惩罚，返回跨租户共享身份簇
 * POST /api/admin/fraud/penalize — 执行惩罚：清零违规用户赠送积分（充值保留）
 */
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { detectCrossTenantSharing, runFraudPenalty, startFraudScheduler } from '../../services/fraud-check.js';

const router = Router();
const prisma = new PrismaClient();

// 检测（只查不罚）
router.get('/report', async (req, res) => {
  try {
    const clusters = await detectCrossTenantSharing();
    const detail = [];
    for (const c of clusters) {
      const userIds = String(c.userIds || '').split(',').filter(Boolean).map(Number);
      const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, username: true, name: true, tenantId: true, createdAt: true },
      });
      detail.push({ ...c, users });
    }
    res.json({ count: detail.length, clusters: detail });
  } catch (e) {
    console.error('[Fraud Report] error:', e);
    res.status(500).json({ error: e.message });
  }
});

// 执行惩罚（清零赠送积分，充值保留）
router.post('/penalize', async (req, res) => {
  try {
    const result = await runFraudPenalty();
    res.json(result);
  } catch (e) {
    console.error('[Fraud Penalize] error:', e);
    res.status(500).json({ error: e.message });
  }
});

// 确保每日自动扫描启动（幂等）
startFraudScheduler();

export default router;
