/**
 * Admin Roles Routes
 * 角色CRUD（内置角色不可删除）
 */
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// GET /api/admin/roles
router.get('/', async (req, res) => {
  try {
    const { keyword } = req.query;
    const where = {};
    if (keyword) {
      where.OR = [
        { name: { contains: keyword } },
        { code: { contains: keyword } },
      ];
    }
    const roles = await prisma.adminRole.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    });
    // 附带每个角色的管理员数量
    const rolesWithCount = await Promise.all(
      roles.map(async (role) => {
        const adminCount = await prisma.adminUser.count({ where: { roleId: role.id } });
        return { ...role, adminCount };
      })
    );
    res.json({ data: rolesWithCount });
  } catch (err) {
    console.error('[Roles] List error:', err);
    res.status(500).json({ error: '获取角色列表失败' });
  }
});

// POST /api/admin/roles
router.post('/', async (req, res) => {
  try {
    const { name, code, description, permissions, reason } = req.body;
    if (!name || !code) {
      return res.status(400).json({ error: '角色名称和代码不能为空' });
    }

    const existing = await prisma.adminRole.findFirst({
      where: { OR: [{ name }, { code }] }
    });
    if (existing) {
      return res.status(400).json({ error: '角色名称或代码已存在' });
    }

    const role = await prisma.adminRole.create({
      data: {
        name, code,
        description: description || null,
        permissions: JSON.stringify(permissions || []),
      }
    });

    await prisma.auditLog.create({
      data: {
        adminId: req.admin?.id || 0,
        action: 'create_role',
        targetType: 'role',
        targetId: String(role.id),
        afterValue: JSON.stringify({ name, code, permissions }),
        reason: reason || '创建角色',
        riskLevel: 'low',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      }
    });

    res.status(201).json({ data: role, message: '角色创建成功' });
  } catch (err) {
    console.error('[Roles] Create error:', err);
    res.status(500).json({ error: '创建角色失败' });
  }
});

// GET /api/admin/roles/:id
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const role = await prisma.adminRole.findUnique({ where: { id } });
    if (!role) return res.status(404).json({ error: '角色不存在' });
    const adminCount = await prisma.adminUser.count({ where: { roleId: id } });
    res.json({ data: { ...role, adminCount } });
  } catch (err) {
    console.error('[Roles] Get error:', err);
    res.status(500).json({ error: '获取角色详情失败' });
  }
});

// PUT /api/admin/roles/:id
router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, description, permissions, reason } = req.body;

    const existing = await prisma.adminRole.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: '角色不存在' });

    // 内置角色不允许改code
    const beforeValue = { name: existing.name, description: existing.description, permissions: existing.permissions };

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (permissions !== undefined) updateData.permissions = JSON.stringify(permissions);

    const role = await prisma.adminRole.update({ where: { id }, data: updateData });

    await prisma.auditLog.create({
      data: {
        adminId: req.admin?.id || 0,
        action: 'update_role',
        targetType: 'role',
        targetId: String(id),
        beforeValue: JSON.stringify(beforeValue),
        afterValue: JSON.stringify(updateData),
        reason: reason || '更新角色',
        riskLevel: 'low',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      }
    });

    res.json({ data: role, message: '角色更新成功' });
  } catch (err) {
    console.error('[Roles] Update error:', err);
    res.status(500).json({ error: '更新角色失败' });
  }
});

// DELETE /api/admin/roles/:id
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = await prisma.adminRole.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: '角色不存在' });

    if (existing.isBuiltin) {
      return res.status(400).json({ error: '内置角色不可删除' });
    }

    // 检查是否有关联管理员
    const adminCount = await prisma.adminUser.count({ where: { roleId: id } });
    if (adminCount > 0) {
      return res.status(400).json({ error: `该角色下还有${adminCount}个管理员，请先转移` });
    }

    await prisma.auditLog.create({
      data: {
        adminId: req.admin?.id || 0,
        action: 'delete_role',
        targetType: 'role',
        targetId: String(id),
        beforeValue: JSON.stringify({ name: existing.name, code: existing.code }),
        reason: req.body.reason || '删除角色',
        riskLevel: 'medium',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      }
    });

    await prisma.adminRole.delete({ where: { id } });
    res.json({ message: '角色已删除' });
  } catch (err) {
    console.error('[Roles] Delete error:', err);
    res.status(500).json({ error: '删除角色失败' });
  }
});

// GET /api/admin/roles/all/permissions - 获取所有可用权限点
router.get('/all/permissions', async (req, res) => {
  const allPermissions = [
    { module: 'dashboard', label: '仪表盘', actions: ['view'] },
    { module: 'admin_users', label: '管理员管理', actions: ['view', 'create', 'update', 'delete'] },
    { module: 'roles', label: '角色管理', actions: ['view', 'create', 'update', 'delete'] },
    { module: 'audit_logs', label: '审计日志', actions: ['view'] },
    { module: 'users', label: '用户管理', actions: ['view', 'update', 'ban', 'reset_password'] },
    { module: 'subscriptions', label: '订阅管理', actions: ['view', 'create', 'update', 'delete'] },
    { module: 'credits', label: '积分管理', actions: ['view', 'recharge', 'deduct', 'gift'] },
    { module: 'coupons', label: '优惠券管理', actions: ['view', 'create', 'update', 'delete'] },
    { module: 'sponsors', label: '梦想赞助商', actions: ['view', 'review', 'eliminate', 'update'] },
    { module: 'agents', label: 'Agent统计', actions: ['view'] },
    { module: 'system_config', label: '系统配置', actions: ['view', 'update'] },
    { module: 'announcements', label: '公告管理', actions: ['view', 'create', 'update', 'delete', 'publish'] },
    { module: 'invite_codes', label: '邀请码管理', actions: ['view', 'create', 'update', 'delete'] },
  ];
  res.json({ data: allPermissions });
});

export default router;
