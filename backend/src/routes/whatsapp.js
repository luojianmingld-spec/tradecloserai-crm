/**
 * WhatsApp API 路由
 * POST /api/whatsapp/qr       — 生成二维码
 * POST /api/whatsapp/send     — 发送消息
 * GET  /api/whatsapp/status   — 获取连接状态
 * POST /api/whatsapp/disconnect — 断开连接
 * GET  /api/whatsapp/connections — 获取所有连接
 * GET  /api/whatsapp/messages   — 获取聊天消息
 * GET  /api/whatsapp/conversations — 获取会话列表
 */

import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import whatsappProvider from '../services/whatsapp-provider.js';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// 所有路由需要认证
router.use(authMiddleware);

/** POST /api/whatsapp/qr — 生成二维码，开始连接 */
router.post('/qr', async (req, res) => {
  try {
    const userId = req.userId;
    const sessionId = `user_${userId}`;

    const result = await whatsappProvider.connect(sessionId, userId);
    if (result.status === 'unavailable') {
      return res.status(503).json({ error: result.message, status: 'unavailable' });
    }
    res.json({ ...result, sessionId });
  } catch (err) {
    console.error('[WA QR Error]', err.message);
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/whatsapp/send — 发送消息 */
router.post('/send', async (req, res) => {
  try {
    const { to, message, sessionId: customSessionId } = req.body;
    if (!to || !message) {
      return res.status(400).json({ error: 'to and message are required' });
    }

    const sessionId = customSessionId || `user_${req.userId}`;
    const result = await whatsappProvider.sendMessage(sessionId, to, message);
    res.json(result);
  } catch (err) {
    console.error('[WA Send Error]', err.message);
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/whatsapp/status — 获取连接状态 */
router.get('/status', async (req, res) => {
  try {
    const sessionId = req.query.sessionId || `user_${req.userId}`;
    const status = whatsappProvider.getStatus(sessionId);

    // 从数据库补充信息
    const conn = await prisma.wAConnection.findUnique({ where: { sessionId } });

    res.json({
      ...status,
      sessionId,
      lastConnectedAt: conn?.lastConnectedAt,
    });
  } catch (err) {
    console.error('[WA Status Error]', err.message);
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/whatsapp/disconnect — 断开连接 */
router.post('/disconnect', async (req, res) => {
  try {
    const sessionId = req.body.sessionId || `user_${req.userId}`;
    await whatsappProvider.disconnect(sessionId);
    res.json({ success: true });
  } catch (err) {
    console.error('[WA Disconnect Error]', err.message);
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/whatsapp/connections — 获取所有连接 */
router.get('/connections', async (req, res) => {
  try {
    const connections = whatsappProvider.getActiveConnections();
    // 补充数据库信息
    const dbConns = await prisma.wAConnection.findMany();
    const merged = connections.map(c => {
      const db = dbConns.find(d => d.sessionId === c.sessionId);
      return { ...c, lastConnectedAt: db?.lastConnectedAt };
    });
    res.json(merged);
  } catch (err) {
    console.error('[WA Connections Error]', err.message);
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/whatsapp/messages — 获取与某个联系人的聊天消息 */
router.get('/messages', async (req, res) => {
  try {
    const { jid, limit = 50, before } = req.query;
    if (!jid) {
      return res.status(400).json({ error: 'jid is required' });
    }

    const sessionId = `user_${req.userId}`;
    const where = {
      sessionId,
      OR: [
        { from: jid },
        { to: jid },
      ],
    };

    if (before) {
      where.timestamp = { lt: new Date(before) };
    }

    const messages = await prisma.wAMessage.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: parseInt(limit),
    });

    res.json(messages.reverse());
  } catch (err) {
    console.error('[WA Messages Error]', err.message);
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/whatsapp/conversations — 获取会话列表 */
router.get('/conversations', async (req, res) => {
  try {
    const sessionId = `user_${req.userId}`;

    // 获取每个联系人的最新消息
    const messages = await prisma.wAMessage.findMany({
      where: { sessionId },
      orderBy: { timestamp: 'desc' },
      distinct: ['from', 'to'],
      take: 100,
    });

    // 按联系人聚合
    const contactMap = new Map();
    for (const msg of messages) {
      const contactJid = msg.direction === 'inbound' ? msg.from : msg.to;
      if (!contactJid || contactJid === 'me') continue;

      if (!contactMap.has(contactJid) || msg.timestamp > contactMap.get(contactJid).timestamp) {
        contactMap.set(contactJid, msg);
      }
    }

    // 组装会话列表
    const conversations = [];
    for (const [jid, lastMsg] of contactMap) {
      const phone = jid.split('@')[0];
      const customer = await prisma.customer.findFirst({ where: { phone } });
      conversations.push({
        jid,
        phone,
        name: customer?.name || phone,
        lastMessage: lastMsg.body,
        lastMessageTime: lastMsg.timestamp,
        direction: lastMsg.direction,
        unreadCount: 0, // TODO: 实现未读计数
      });
    }

    // 按时间排序
    conversations.sort((a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime));

    res.json(conversations);
  } catch (err) {
    console.error('[WA Conversations Error]', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
