import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// Get messages for a conversation/contact
router.get('/', async (req, res) => {
  try {
    const { accountId, contactId, jid, limit = 50, before } = req.query;

    // Verify account belongs to user
    if (accountId) {
      const account = await prisma.whatsAppAccount.findFirst({
        where: { id: parseInt(accountId), userId: req.userId },
      });
      if (!account) return res.status(403).json({ error: 'Access denied' });
    }

    const where = {};
    if (jid) {
      where.OR = [
        { from: jid },
        { to: jid },
      ];
    }
    if (before) where.id = { lt: parseInt(before) };

    const messages = await prisma.wAMessage.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: parseInt(limit),
    });

    // Convert WAMessage format to frontend expected format
    const converted = messages.reverse().map(msg => ({
      id: msg.id,
      jid: msg.direction === 'outbound' || msg.direction === 'outgoing' ? msg.to : msg.from,
      from: msg.from,
      to: msg.to,
      content: msg.body,
      body: msg.body,
      fromMe: msg.direction === 'outbound' || msg.direction === 'outgoing',
      direction: msg.direction,
      messageType: msg.type || 'text',
      timestamp: msg.timestamp,
      translation: msg.translation || null,
      sourceLang: msg.sourceLang || null,
      waMessageId: msg.waMessageId,
      deliveredAt: msg.deliveredAt || null,
      readAt: msg.readAt || null,
      ackError: msg.ackError || null,
      read: !!msg.read,
    }));

    res.json(converted);
  } catch (err) {
    console.error('[Messages] List error:', err);
    res.status(500).json({ error: 'Failed to list messages' });
  }
});

export default router;
