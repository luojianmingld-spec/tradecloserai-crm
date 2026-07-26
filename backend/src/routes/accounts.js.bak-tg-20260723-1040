import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// List WhatsApp accounts for current user
router.get('/', async (req, res) => {
  try {
    const accounts = await prisma.whatsAppAccount.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { contacts: true, conversations: true } },
      },
    });
    res.json(accounts);
  } catch (err) {
    console.error('[Accounts] List error:', err);
    res.status(500).json({ error: 'Failed to list accounts' });
  }
});

// Create a new WhatsApp account (placeholder for connection)
router.post('/', async (req, res) => {
  try {
    const { name } = req.body;
    const sessionDir = `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const account = await prisma.whatsAppAccount.create({
      data: {
        userId: req.userId,
        name: name || 'WhatsApp Account',
        sessionDir,
        status: 'disconnected',
      },
    });
    res.status(201).json(account);
  } catch (err) {
    console.error('[Accounts] Create error:', err);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

// Get account by ID
router.get('/:id', async (req, res) => {
  try {
    const account = await prisma.whatsAppAccount.findFirst({
      where: { id: parseInt(req.params.id), userId: req.userId },
      include: {
        _count: { select: { contacts: true, conversations: true } },
      },
    });
    if (!account) return res.status(404).json({ error: 'Account not found' });
    res.json(account);
  } catch (err) {
    console.error('[Accounts] Get error:', err);
    res.status(500).json({ error: 'Failed to get account' });
  }
});

// Delete account
router.delete('/:id', async (req, res) => {
  try {
    const account = await prisma.whatsAppAccount.findFirst({
      where: { id: parseInt(req.params.id), userId: req.userId },
    });
    if (!account) return res.status(404).json({ error: 'Account not found' });

    await prisma.whatsAppAccount.delete({ where: { id: account.id } });
    res.json({ success: true });
  } catch (err) {
    console.error('[Accounts] Delete error:', err);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

export default router;
