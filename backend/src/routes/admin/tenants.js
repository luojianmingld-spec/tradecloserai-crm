/**
 * Tenants Management Routes
 * 租户管理API
 */
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// GET /api/admin/tenants - 租户列表
router.get('/', async (req, res) => {
  try {
    const { page = 1, pageSize = 20, status, keyword } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(pageSize);
    const take = parseInt(pageSize);

    const where = {};
    if (status) where.status = status;
    if (keyword) {
      where.OR = [
        { name: { contains: keyword } },
        { code: { contains: keyword } },
      ];
    }

    const [tenants, total] = await Promise.all([
      prisma.tenant.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
      prisma.tenant.count({ where }),
    ]);

    const tenantsWithStats = await Promise.all(
      tenants.map(async (tenant) => {
        const userCount = await prisma.user.count({ where: { tenantId: tenant.id } }).catch(() => 0);
        return { ...tenant, userCount };
      })
    );

    res.json({
      data: tenantsWithStats,
      total,
      page: parseInt(page),
      pageSize: parseInt(pageSize),
    });
  } catch (err) {
    console.error('[Admin] Get tenants error:', err);
    res.status(500).json({ error: 'Failed to get tenants' });
  }
});

// GET /api/admin/tenants/:id - 单个租户详情
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const tenant = await prisma.tenant.findUnique({ where: { id } });
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    res.json({ data: tenant });
  } catch (err) {
    console.error('[Admin] Get tenant error:', err);
    res.status(500).json({ error: 'Failed to get tenant' });
  }
});

// POST /api/admin/tenants - 创建租户
router.post('/', async (req, res) => {
  try {
    const { name, code, status = 'active', plan = 'free', balance = 0, adminUserId = 0, config } = req.body;
    if (!name || !code) return res.status(400).json({ error: 'Name and code are required' });

    const existing = await prisma.tenant.findUnique({ where: { code } });
    if (existing) return res.status(400).json({ error: 'Tenant code already exists' });

    const tenant = await prisma.tenant.create({
      data: { name, code, status, plan, balance, adminUserId, config: config ? JSON.stringify(config) : null }
    });

    res.json({ data: tenant });
  } catch (err) {
    console.error('[Admin] Create tenant error:', err);
    res.status(500).json({ error: 'Failed to create tenant' });
  }
});

// PUT /api/admin/tenants/:id - 更新租户
router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, status, plan, balance, config } = req.body;
    
    const tenant = await prisma.tenant.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(status && { status }),
        ...(plan && { plan }),
        ...(balance !== undefined && { balance }),
        ...(config && { config: JSON.stringify(config) })
      }
    });

    res.json({ data: tenant });
  } catch (err) {
    console.error('[Admin] Update tenant error:', err);
    res.status(500).json({ error: 'Failed to update tenant' });
  }
});

// DELETE /api/admin/tenants/:id - 删除租户
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    // 检查是否有关联用户
    const userCount = await prisma.user.count({ where: { tenantId: id } });
    if (userCount > 0) {
      return res.status(400).json({ error: 'Cannot delete tenant with active users' });
    }
    
    await prisma.tenant.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    console.error('[Admin] Delete tenant error:', err);
    res.status(500).json({ error: 'Failed to delete tenant' });
  }
});

export default router;
