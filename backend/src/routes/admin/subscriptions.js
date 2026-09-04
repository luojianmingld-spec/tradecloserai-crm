/**
 * Subscriptions Routes
 * 订阅管理+套餐CRUD
 */
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// ========== 套餐管理 ==========

// GET /api/admin/subscriptions/plans
router.get('/plans', async (req, res) => {
  try {
    const plans = await prisma.subscriptionPlan.findMany({
      orderBy: { sortOrder: 'asc' },
    });
    const plansWithCount = await Promise.all(
      plans.map(async (plan) => {
        const subCount = await prisma.userSubscription.count({ where: { planId: plan.id, status: 'active' } });
        return { ...plan, activeSubscribers: subCount };
      })
    );
    res.json({ data: plansWithCount });
  } catch (err) {
    console.error('[Subscriptions] Plans list error:', err);
    res.status(500).json({ error: '获取套餐列表失败' });
  }
});

// POST /api/admin/subscriptions/plans
router.post('/plans', async (req, res) => {
  try {
    const { name, code, monthlyPrice, yearlyPrice, trialDays, creditsPerMonth, maxAccounts, maxCustomers, agentAccess, benefits, status, sortOrder, reason } = req.body;
    if (!name || !code) return res.status(400).json({ error: '套餐名称和代码不能为空' });

    const existing = await prisma.subscriptionPlan.findUnique({ where: { code } });
    if (existing) return res.status(400).json({ error: '套餐代码已存在' });

    const plan = await prisma.subscriptionPlan.create({
      data: {
        name, code,
        monthlyPrice: monthlyPrice || 0,
        yearlyPrice: yearlyPrice || 0,
        trialDays: trialDays || 0,
        creditsPerMonth: creditsPerMonth || 0,
        maxAccounts: maxAccounts || 0,
        maxCustomers: maxCustomers || 0,
        agentAccess: JSON.stringify(agentAccess || []),
        benefits: JSON.stringify(benefits || []),
        status: status || 'active',
        sortOrder: sortOrder || 0,
      }
    });

    await prisma.auditLog.create({
      data: {
        adminId: req.admin?.id || 0,
        action: 'create_plan',
        targetType: 'subscription',
        targetId: String(plan.id),
        afterValue: JSON.stringify({ name, code }),
        reason: reason || '创建套餐',
        riskLevel: 'low',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      }
    });

    res.status(201).json({ data: plan, message: '套餐创建成功' });
  } catch (err) {
    console.error('[Subscriptions] Plan create error:', err);
    res.status(500).json({ error: '创建套餐失败' });
  }
});

// PUT /api/admin/subscriptions/plans/:id
router.put('/plans/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = await prisma.subscriptionPlan.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: '套餐不存在' });

    const { name, monthlyPrice, yearlyPrice, trialDays, creditsPerMonth, maxAccounts, maxCustomers, agentAccess, benefits, status, sortOrder, reason } = req.body;
    const beforeValue = { name: existing.name, monthlyPrice: existing.monthlyPrice, status: existing.status };

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (monthlyPrice !== undefined) updateData.monthlyPrice = monthlyPrice;
    if (yearlyPrice !== undefined) updateData.yearlyPrice = yearlyPrice;
    if (trialDays !== undefined) updateData.trialDays = trialDays;
    if (creditsPerMonth !== undefined) updateData.creditsPerMonth = creditsPerMonth;
    if (maxAccounts !== undefined) updateData.maxAccounts = maxAccounts;
    if (maxCustomers !== undefined) updateData.maxCustomers = maxCustomers;
    if (agentAccess !== undefined) updateData.agentAccess = JSON.stringify(agentAccess);
    if (benefits !== undefined) updateData.benefits = JSON.stringify(benefits);
    if (status !== undefined) updateData.status = status;
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder;

    const plan = await prisma.subscriptionPlan.update({ where: { id }, data: updateData });

    await prisma.auditLog.create({
      data: {
        adminId: req.admin?.id || 0,
        action: 'update_plan',
        targetType: 'subscription',
        targetId: String(id),
        beforeValue: JSON.stringify(beforeValue),
        afterValue: JSON.stringify(updateData),
        reason: reason || '更新套餐',
        riskLevel: 'low',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      }
    });

    res.json({ data: plan, message: '套餐更新成功' });
  } catch (err) {
    console.error('[Subscriptions] Plan update error:', err);
    res.status(500).json({ error: '更新套餐失败' });
  }
});

// DELETE /api/admin/subscriptions/plans/:id
router.delete('/plans/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = await prisma.subscriptionPlan.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: '套餐不存在' });

    const activeCount = await prisma.userSubscription.count({ where: { planId: id, status: 'active' } });
    if (activeCount > 0) {
      return res.status(400).json({ error: `该套餐还有${activeCount}个活跃订阅，请先迁移或下架` });
    }

    await prisma.subscriptionPlan.update({
      where: { id },
      data: { status: 'discontinued' }
    });

    await prisma.auditLog.create({
      data: {
        adminId: req.admin?.id || 0,
        action: 'delete_plan',
        targetType: 'subscription',
        targetId: String(id),
        beforeValue: JSON.stringify({ name: existing.name, code: existing.code }),
        reason: req.body.reason || '下架套餐',
        riskLevel: 'medium',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      }
    });

    res.json({ message: '套餐已下架' });
  } catch (err) {
    console.error('[Subscriptions] Plan delete error:', err);
    res.status(500).json({ error: '下架套餐失败' });
  }
});

// ========== 订阅管理 ==========

// GET /api/admin/subscriptions
router.get('/', async (req, res) => {
  try {
    const { page = 1, pageSize = 20, status, planId, userId, keyword } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(pageSize);
    const take = parseInt(pageSize);
    const where = {};
    if (status) where.status = status;
    if (planId) where.planId = parseInt(planId);
    if (userId) where.userId = parseInt(userId);

    const [subs, total] = await Promise.all([
      prisma.userSubscription.findMany({
        where, skip, take,
        orderBy: { createdAt: 'desc' },
        include: { plan: true },
      }),
      prisma.userSubscription.count({ where }),
    ]);

    res.json({ data: subs, total, page: parseInt(page), pageSize: parseInt(pageSize) });
  } catch (err) {
    console.error('[Subscriptions] List error:', err);
    res.status(500).json({ error: '获取订阅列表失败' });
  }
});

// POST /api/admin/subscriptions - 管理员创建/调整订阅
router.post('/', async (req, res) => {
  try {
    const { userId, planId, status, startDate, endDate, autoRenew, paymentMethod, pricePaid, reason } = req.body;
    if (!userId || !planId) return res.status(400).json({ error: 'userId和planId不能为空' });

    const plan = await prisma.subscriptionPlan.findUnique({ where: { id: parseInt(planId) } });
    if (!plan) return res.status(400).json({ error: '套餐不存在' });

    const sub = await prisma.userSubscription.create({
      data: {
        userId: parseInt(userId),
        planId: parseInt(planId),
        status: status || 'active',
        startDate: startDate ? new Date(startDate) : new Date(),
        endDate: endDate ? new Date(endDate) : null,
        autoRenew: autoRenew || false,
        paymentMethod: paymentMethod || null,
        pricePaid: pricePaid || null,
      },
      include: { plan: true },
    });

    await prisma.auditLog.create({
      data: {
        adminId: req.admin?.id || 0,
        action: 'create_subscription',
        targetType: 'subscription',
        targetId: String(sub.id),
        afterValue: JSON.stringify({ userId, planId, status, pricePaid }),
        reason: reason || '管理员创建订阅',
        riskLevel: 'medium',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      }
    });

    res.status(201).json({ data: sub, message: '订阅创建成功' });
  } catch (err) {
    console.error('[Subscriptions] Create error:', err);
    res.status(500).json({ error: '创建订阅失败' });
  }
});

// PUT /api/admin/subscriptions/:id
router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = await prisma.userSubscription.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: '订阅不存在' });

    const { status, endDate, autoRenew, reason } = req.body;
    const beforeValue = { status: existing.status, endDate: existing.endDate };

    const updateData = {};
    if (status !== undefined) updateData.status = status;
    if (endDate !== undefined) updateData.endDate = endDate ? new Date(endDate) : null;
    if (autoRenew !== undefined) updateData.autoRenew = autoRenew;

    const sub = await prisma.userSubscription.update({ where: { id }, data: updateData, include: { plan: true } });

    await prisma.auditLog.create({
      data: {
        adminId: req.admin?.id || 0,
        action: 'update_subscription',
        targetType: 'subscription',
        targetId: String(id),
        beforeValue: JSON.stringify(beforeValue),
        afterValue: JSON.stringify(updateData),
        reason: reason || '更新订阅',
        riskLevel: 'medium',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      }
    });

    res.json({ data: sub, message: '订阅更新成功' });
  } catch (err) {
    console.error('[Subscriptions] Update error:', err);
    res.status(500).json({ error: '更新订阅失败' });
  }
});

export default router;
