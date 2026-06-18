/**
 * Customer API Routes
 * CRUD for the Customer model (independent of WhatsApp accounts)
 */

import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// List customers
router.get('/', async (req, res) => {
  try {
    const { search, tag, status, sort, order } = req.query;
    const where = {};

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { phone: { contains: search } },
        { email: { contains: search } },
        { company: { contains: search } },
        { country: { contains: search } },
      ];
    }

    if (tag) {
      where.tags = { contains: tag };
    }

    if (status) {
      where.status = status;
    }

    const customers = await prisma.customer.findMany({
      where: { userId: req.userId, ...where },
      orderBy: sort ? { [sort]: order === 'asc' ? 'asc' : 'desc' } : { updatedAt: 'desc' },
    });
    res.json(customers);
  } catch (err) {
    console.error('[Customers] List error:', err);
    res.status(500).json({ error: 'Failed to list customers' });
  }
});

// Get single customer
router.get('/:id', async (req, res) => {
  try {
    const customer = await prisma.customer.findUnique({
      where: { id: parseInt(req.params.id) },
    });
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    res.json(customer);
  } catch (err) {
    console.error('[Customers] Get error:', err);
    res.status(500).json({ error: 'Failed to get customer' });
  }
});

// Create customer
router.post('/', async (req, res) => {
  try {
    const { name, phone, email, company, country, tags, notes, source, status, intentLevel } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const customer = await prisma.customer.create({
      data: {
        userId: req.userId,
        name,
        phone: phone || null,
        email: email || null,
        company: company || null,
        country: country || null,
        tags: tags || '[]',
        notes: notes || null,
        source: source || 'manual',
        status: status || 'potential',
        intentLevel: intentLevel || 5,
        assignedTo: req.userId,
      },
    });
    res.status(201).json(customer);
  } catch (err) {
    console.error('[Customers] Create error:', err);
    res.status(500).json({ error: 'Failed to create customer' });
  }
});

// Update customer
router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = await prisma.customer.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const data = {};
    const allowedFields = ['name', 'phone', 'email', 'company', 'country', 'tags', 'notes', 'source', 'status', 'intentLevel'];
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        data[field] = req.body[field];
      }
    }

    const customer = await prisma.customer.update({
      where: { id },
      data,
    });
    res.json(customer);
  } catch (err) {
    console.error('[Customers] Update error:', err);
    res.status(500).json({ error: 'Failed to update customer' });
  }
});

// Delete customer
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = await prisma.customer.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    await prisma.customer.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    console.error('[Customers] Delete error:', err);
    res.status(500).json({ error: 'Failed to delete customer' });
  }
});

// Get customer by phone (for WhatsApp integration)
router.get('/by-phone/:phone', async (req, res) => {
  try {
    const customer = await prisma.customer.findFirst({
      where: { phone: req.params.phone },
    });
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    res.json(customer);
  } catch (err) {
    console.error('[Customers] By-phone error:', err);
    res.status(500).json({ error: 'Failed to find customer' });
  }
});

export default router;
