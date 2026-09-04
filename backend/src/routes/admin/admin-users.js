/**
 * Admin Users Routes
 * 管理员用户CRUD（创建需发邮件邀请，实际存invitation状态）
 */
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// GET /api/admin/admin-users
router.get('/', async (req, res) => {
  try {
    const { page = 1, pageSize = 20, status, keyword } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(pageSize);
    const take = parseInt(pageSize);
    const where = {};
    if (status) where.status = status;
    if (keyword) {
      where.OR = [
        { username: { contains: keyword } },
        { email: { contains: keyword } },
        { name: { contains: keyword } },
      ];
    }
    const [admins, total] = await Promise.all([
      prisma.adminUser.findMany({
        where, skip, take,
        orderBy: { createdAt: 'desc' },
        include: { role: true },
      }),
      prisma.adminUser.count({ where }),
    ]);

    // Remove password from response
    const safeAdmins = admins.map(({ password, ...rest }) => rest);

    res.json({ data: safeAdmins, total, page: parseInt(page), pageSize: parseInt(pageSize) });
  } catch (err) {
    console.error('[AdminUsers] List error:', err);
    res.status(500).json({ error: '获取管理员列表失败' });
  }
});

// POST /api/admin/admin-users
router.post('/', async (req, res) => {
  try {
    const { username, email, name, roleId, password, reason } = req.body;
    if (!username || !email || !roleId) {
      return res.status(400).json({ error: '用户名、邮箱、角色ID不能为空' });
    }

    const existing = await prisma.adminUser.findFirst({
      where: { OR: [{ username }, { email }] }
    });
    if (existing) {
      return res.status(400).json({ error: '用户名或邮箱已存在' });
    }

    const role = await prisma.adminRole.findUnique({ where: { id: parseInt(roleId) } });
    if (!role) return res.status(400).json({ error: '角色不存在' });

    const rawPassword = password || Math.random().toString(36).slice(-10);
    const hashedPassword = await bcrypt.hash(rawPassword, 10);

    const admin = await prisma.adminUser.create({
      data: {
        username, email, name: name || null,
        password: hashedPassword,
        roleId: parseInt(roleId),
        status: 'active',
        createdBy: req.admin?.id || null,
      },
      include: { role: true },
    });

    await prisma.auditLog.create({
      data: {
        adminId: req.admin?.id || admin.id,
        action: 'create_admin',
        targetType: 'admin_user',
        targetId: String(admin.id),
        afterValue: JSON.stringify({ username, email, name, roleId, roleName: role.name }),
        reason: reason || '创建管理员',
        riskLevel: 'medium',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      }
    });

    console.log('[AdminUsers] Created admin:', username);

    const { password: _, ...safeAdmin } = admin;
    res.status(201).json({ data: safeAdmin, message: '管理员创建成功' });
  } catch (err) {
    console.error('[AdminUsers] Create error:', err);
    res.status(500).json({ error: '创建管理员失败' });
  }
});

// GET /api/admin/admin-users/:id
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const admin = await prisma.adminUser.findUnique({
      where: { id }, include: { role: true }
    });
    if (!admin) return res.status(404).json({ error: '管理员不存在' });
    const { password, ...safeAdmin } = admin;
    res.json({ data: safeAdmin });
  } catch (err) {
    console.error('[AdminUsers] Get error:', err);
    res.status(500).json({ error: '获取管理员详情失败' });
  }
});

// PUT /api/admin/admin-users/:id
router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { email, name, roleId, status, password, reason } = req.body;

    const existing = await prisma.adminUser.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: '管理员不存在' });

    if (email && email !== existing.email) {
      const emailExists = await prisma.adminUser.findUnique({ where: { email } });
      if (emailExists) return res.status(400).json({ error: '邮箱已被使用' });
    }

    const beforeValue = { email: existing.email, name: existing.name, roleId: existing.roleId, status: existing.status };

    const updateData = {};
    if (email !== undefined) updateData.email = email;
    if (name !== undefined) updateData.name = name;
    if (roleId !== undefined) {
      const role = await prisma.adminRole.findUnique({ where: { id: parseInt(roleId) } });
      if (!role) return res.status(400).json({ error: '角色不存在' });
      updateData.roleId = parseInt(roleId);
    }
    if (status !== undefined) updateData.status = status;
    if (password !== undefined) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    const admin = await prisma.adminUser.update({ where: { id }, data: updateData, include: { role: true } });

    await prisma.auditLog.create({
      data: {
        adminId: req.admin?.id || id,
        action: 'update_admin',
        targetType: 'admin_user',
        targetId: String(id),
        beforeValue: JSON.stringify(beforeValue),
        afterValue: JSON.stringify(updateData),
        reason: reason || '更新管理员',
        riskLevel: 'medium',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      }
    });

    const { password: _, ...safeAdmin } = admin;
    res.json({ data: safeAdmin, message: '管理员更新成功' });
  } catch (err) {
    console.error('[AdminUsers] Update error:', err);
    res.status(500).json({ error: '更新管理员失败' });
  }
});

// DELETE /api/admin/admin-users/:id
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = await prisma.adminUser.findUnique({ where: { id }, include: { role: true } });
    if (!existing) return res.status(404).json({ error: '管理员不存在' });

    if (req.admin?.id === id) {
      return res.status(400).json({ error: '不能删除自己' });
    }

    if (existing.role?.code === 'super_admin') {
      const superAdminCount = await prisma.adminUser.count({ where: { roleId: existing.roleId } });
      if (superAdminCount <= 1) {
        return res.status(400).json({ error: '不能删除最后一个超级管理员' });
      }
    }

    await prisma.auditLog.create({
      data: {
        adminId: req.admin?.id || id,
        action: 'delete_admin',
        targetType: 'admin_user',
        targetId: String(id),
        beforeValue: JSON.stringify({ username: existing.username, email: existing.email, roleId: existing.roleId }),
        reason: req.body.reason || '删除管理员',
        riskLevel: 'high',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      }
    });

    await prisma.adminUser.delete({ where: { id } });
    res.json({ message: '管理员已删除' });
  } catch (err) {
    console.error('[AdminUsers] Delete error:', err);
    res.status(500).json({ error: '删除管理员失败' });
  }
});

// POST /api/admin/admin-users/:id/reset-password
router.post('/:id/reset-password', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = await prisma.adminUser.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: '管理员不存在' });

    const newPassword = req.body.password || Math.random().toString(36).slice(-10);
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.adminUser.update({ where: { id }, data: { password: hashedPassword } });

    await prisma.auditLog.create({
      data: {
        adminId: req.admin?.id || id,
        action: 'reset_admin_password',
        targetType: 'admin_user',
        targetId: String(id),
        reason: req.body.reason || '重置管理员密码',
        riskLevel: 'high',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      }
    });

    res.json({ message: '密码已重置' });
  } catch (err) {
    console.error('[AdminUsers] Reset password error:', err);
    res.status(500).json({ error: '重置密码失败' });
  }
});

export default router;
