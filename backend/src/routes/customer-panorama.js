/**
 * 客户全景 API（客户-Agent 双向指派需求）
 *  - GET /api/customer/:id/panorama   客户全景聚合查询（档案+三渠道历史+共享结论+背调）
 *  - GET /api/customer/:id/panorama/prompt  生成 AI 注入提示词文本（首轮 full / 后续 light）
 */
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { buildCustomerPanorama, formatPanoramaPrompt, ensureCustomerChannelLinks } from '../services/panorama.service.js';

const router = Router();
const prisma = new PrismaClient();

// GET /api/customer/:id/panorama — 客户全景
router.get('/:id/panorama', async (req, res) => {
  try {
    const userId = req.userId || 1;
    const id = parseInt(req.params.id, 10);
    const historyLimit = Math.min(parseInt(req.query.historyLimit) || 30, 100);
    const panorama = await buildCustomerPanorama(userId, id, { historyLimit });
    if (panorama.error) return res.status(404).json(panorama);
    res.json(panorama);
  } catch (err) {
    console.error('[Panorama] get error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/customer/:id/panorama/prompt — 生成 AI 提示词文本
router.get('/:id/panorama/prompt', async (req, res) => {
  try {
    const userId = req.userId || 1;
    const id = parseInt(req.params.id, 10);
    const light = req.query.light === '1' || req.query.light === 'true';
    const historyLimit = Math.min(parseInt(req.query.historyLimit) || 30, 100);
    const panorama = await buildCustomerPanorama(userId, id, { historyLimit });
    if (panorama.error) return res.status(404).json(panorama);
    const text = formatPanoramaPrompt(panorama, { light });
    res.json({ text, light, panorama });
  } catch (err) {
    console.error('[Panorama] prompt error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/customer/:id/panorama/links — 强制刷新渠道关联（幂等）
router.post('/:id/panorama/links', async (req, res) => {
  try {
    const userId = req.userId || 1;
    const id = parseInt(req.params.id, 10);
    const customer = await prisma.customer.findUnique({ where: { id } });
    if (!customer) return res.status(404).json({ error: '客户不存在' });
    const created = await ensureCustomerChannelLinks(userId, customer);
    res.json({ success: true, created: created.length });
  } catch (err) {
    console.error('[Panorama] links error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
