import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// List contacts for an account
router.get('/', async (req, res) => {
  try {
    const { accountId, search, tag } = req.query;
    const where = {};

    if (accountId) {
      where.accountId = parseInt(accountId);
      // Verify account belongs to user
      const account = await prisma.whatsAppAccount.findFirst({
        where: { id: where.accountId, userId: req.userId },
      });
      if (!account) return res.status(403).json({ error: 'Account not owned by user' });
    } else {
      // Get all contacts from user's accounts
      const accounts = await prisma.whatsAppAccount.findMany({
        where: { userId: req.userId },
        select: { id: true },
      });
      where.accountId = { in: accounts.map(a => a.id) };
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { phone: { contains: search } },
        { jid: { contains: search } },
        { pushName: { contains: search } },
      ];
    }

    if (tag) {
      where.tags = { contains: tag };
    }

    const contacts = await prisma.contact.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: { conversation: true },
    });
    res.json(contacts);
  } catch (err) {
    console.error('[Contacts] List error:', err);
    res.status(500).json({ error: 'Failed to list contacts' });
  }
});

// Get single contact
router.get('/:id', async (req, res) => {
  try {
    const contact = await prisma.contact.findFirst({
      where: { id: parseInt(req.params.id) },
      include: {
        account: { select: { userId: true } },
        conversation: true,
        messages: { orderBy: { timestamp: 'desc' }, take: 20 },
      },
    });
    if (!contact || contact.account.userId !== req.userId) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    res.json(contact);
  } catch (err) {
    console.error('[Contacts] Get error:', err);
    res.status(500).json({ error: 'Failed to get contact' });
  }
});

// Update contact
router.put('/:id', async (req, res) => {
  try {
    const contact = await prisma.contact.findFirst({
      where: { id: parseInt(req.params.id) },
      include: { account: { select: { userId: true } } },
    });
    if (!contact || contact.account.userId !== req.userId) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    const { name, tags, notes, country, language } = req.body;
    const updated = await prisma.contact.update({
      where: { id: contact.id },
      data: {
        ...(name !== undefined && { name }),
        ...(tags !== undefined && { tags }),
        ...(notes !== undefined && { notes }),
        ...(country !== undefined && { country }),
        ...(language !== undefined && { language }),
      },
    });
    res.json(updated);
  } catch (err) {
    console.error('[Contacts] Update error:', err);
    res.status(500).json({ error: 'Failed to update contact' });
  }
});

export default router;
