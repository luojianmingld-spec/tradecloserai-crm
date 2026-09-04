/**
 * Coupons Routes
 * 优惠券CRUD
 */
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// GET /api/admin/coupons
router.get('/', async (req, res) => {
  try {
    const { page = 1, pageSize = 20, isActive, type, keyword } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(pageSize);
    const take = parseInt(pageSize);
    const where = {};
    if (isActive !== undefined) where.isActive = isActive === 'true';
    if (type) where.type = type;
    if (keyword) {
      where.OR = [
        { code: { contains: keyword } },
      ];
    }
    const [coupons, total] = await Promise.all([
      prisma.coupon.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
      prisma.coupon.count({ where }),
    ]);
    res.json({ data: coupons, total, page: parseInt(page), pageSize: parseInt(pageSize) });
  } catch (err) {
    console.error('[Coupons] List error:', err);
    res.status(500).json({ error: '获取优惠券列表失败' });
  }
});

// POST /api/admin/coupons
router.post('/', async (req, res) => {
  try {
    const { code, type, value, scope, scopePlans, maxUses, newUserOnly, expiresAt, reason } = req.body;
    if (!code || !type || value === undefined) {
      return res.status(400).json({ error: 'code/type/value不能为空' });
    }
    const existing = await prisma.coupon.findUnique({ where: { code } });
    if (existing) return res.status(400).json({ error: '优惠码已存在' });

    const coupon = await prisma.coupon.create({
      data: {
        code: code.toUpperCase(),
        type, value,
        scope: scope || 'all',
        scopePlans: scopePlans ? JSON.stringify(scopePlans) : null,
        maxUses: maxUses || 0,
        newUserOnly: newUserOnly || false,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      }
    });

    await prisma.auditLog.create({
      data: {
        adminId: req.admin?.id || 0,
        action: 'create_coupon',
        targetType: 'coupon',
        targetId: String(coupon.id),
        afterValue: JSON.stringify({ code, type, value }),
        reason: reason || '创建优惠券',
        riskLevel: 'low',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      }
    });

    res.status(201).json({ data: coupon, message: '优惠券创建成功' });
  } catch (err) {
    console.error('[Coupons] Create error:', err);
    res.status(500).json({ error: '创建优惠券失败' });
  }
});

// PUT /api/admin/coupons/:id
router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = await prisma.coupon.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: '优惠券不存在' });

    const { type, value, scope, scopePlans, maxUses, newUserOnly, expiresAt, isActive, reason } = req.body;
    const beforeValue = { isActive: existing.isActive, maxUses: existing.maxUses };
    const updateData = {};
    if (type !== undefined) updateData.type = type;
    if (value !== undefined) updateData.value = value;
    if (scope !== undefined) updateData.scope = scope;
    if (scopePlans !== undefined) updateData.scopePlans = scopePlans ? JSON.stringify(scopePlans) : null;
    if (maxUses !== undefined) updateData.maxUses = maxUses;
    if (newUserOnly !== undefined) updateData.newUserOnly = newUserOnly;
    if (expiresAt !== undefined) updateData.expiresAt = expiresAt ? new Date(expiresAt) : null;
    if (isActive !== undefined) updateData.isActive = isActive;

    const coupon = await prisma.coupon.update({ where: { id }, data: updateData });

    await prisma.auditLog.create({
      data: {
        adminId: req.admin?.id || 0,
        action: 'update_coupon',
        targetType: 'coupon',
        targetId: String(id),
        beforeValue: JSON.stringify(beforeValue),
        afterValue: JSON.stringify(updateData),
        reason: reason || '更新优惠券',
        riskLevel: 'low',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      }
    });

    res.json({ data: coupon, message: '优惠券更新成功' });
  } catch (err) {
    console.error('[Coupons] Update error:', err);
    res.status(500).json({ error: '更新优惠券失败' });
  }
});

// DELETE /api/admin/coupons/:id
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = await prisma.coupon.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: '优惠券不存在' });

    await prisma.auditLog.create({
      data: {
        adminId: req.admin?.id || 0,
        action: 'delete_coupon',
        targetType: 'coupon',
        targetId: String(id),
        beforeValue: JSON.stringify({ code: existing.code }),
        reason: req.body.reason || '删除优惠券',
        riskLevel: 'low',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      }
    });

    await prisma.coupon.delete({ where: { id } });
    res.json({ message: '优惠券已删除' });
  } catch (err) {
    console.error('[Coupons] Delete error:', err);
    res.status(500).json({ error: '删除优惠券失败' });
  }
});

export default router;
