/**
 * 客户↔渠道关联 API（客户-Agent 双向指派需求）
 *  - POST /api/customer/channels   手动建立客户↔渠道关联（body: { customerId, channel, contactKey, matchType? }）
 *  - GET  /api/customer/:id/channels   查询某客户的渠道关联列表
 *  - DELETE /api/customer/channels/:id   解绑（V1.0 提供，用于修正错误关联）
 */
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

const VALID_CHANNELS = ['wa', 'tg', 'email'];

// POST /api/customer/channels — 手动关联
router.post('/', async (req, res) => {
  try {
    const userId = req.userId || 1;
    const { customerId, channel, contactKey, matchType } = req.body || {};
    if (!customerId || !channel || !contactKey) {
      return res.status(400).json({ error: 'customerId/channel/contactKey 均必填' });
    }
    if (!VALID_CHANNELS.includes(channel)) {
      return res.status(400).json({ error: 'channel 仅支持 wa/tg/email' });
    }
    const cid = parseInt(customerId, 10);
    const customer = await prisma.customer.findUnique({ where: { id: cid } });
    if (!customer) return res.status(404).json({ error: '客户不存在' });

    const link = await prisma.customerChannelLink.upsert({
      where: { userId_customerId_channel_contactKey: { userId, customerId: cid, channel, contactKey } },
      update: { matchType: matchType || 'manual' },
      create: { userId, customerId: cid, channel, contactKey, matchType: matchType || 'manual' }
    });
    res.json({ success: true, link });
  } catch (err) {
    console.error('[CustomerChannels] create error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/customer/:id/channels — 查询某客户关联列表
router.get('/:customerId/channels', async (req, res) => {
  try {
    const userId = req.userId || 1;
    const cid = parseInt(req.params.customerId, 10);
    const links = await prisma.customerChannelLink.findMany({
      where: { userId, customerId: cid },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ links, count: links.length });
  } catch (err) {
    console.error('[CustomerChannels] list error:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/customer/channels/:id — 解绑
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.userId || 1;
    const id = parseInt(req.params.id, 10);
    const link = await prisma.customerChannelLink.findFirst({ where: { id, userId } });
    if (!link) return res.status(404).json({ error: '关联不存在' });
    await prisma.customerChannelLink.delete({ where: { id } });
    res.json({ success: true, message: '已解绑' });
  } catch (err) {
    console.error('[CustomerChannels] delete error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
