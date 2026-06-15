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
    if (accountId) where.accountId = parseInt(accountId);
    if (contactId) where.contactId = parseInt(contactId);
    if (jid) where.jid = jid;
    if (before) where.id = { lt: parseInt(before) };

    const messages = await prisma.message.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: parseInt(limit),
    });

    res.json(messages.reverse());
  } catch (err) {
    console.error('[Messages] List error:', err);
    res.status(500).json({ error: 'Failed to list messages' });
  }
});

// Get conversations list for an account
router.get('/conversations', async (req, res) => {
  try {
    const { accountId } = req.query;
    if (!accountId) return res.status(400).json({ error: 'accountId required' });

    const account = await prisma.whatsAppAccount.findFirst({
      where: { id: parseInt(accountId), userId: req.userId },
    });
    if (!account) return res.status(403).json({ error: 'Access denied' });

    const conversations = await prisma.conversation.findMany({
      where: { accountId: parseInt(accountId) },
      orderBy: [{ pinned: 'desc' }, { lastMessageAt: 'desc' }],
      include: { contact: true },
    });

    res.json(conversations);
  } catch (err) {
    console.error('[Messages] Conversations error:', err);
    res.status(500).json({ error: 'Failed to get conversations' });
  }
});

export default router;
