/**
 * Users Management Routes
 * 用户管理（列表/详情/操作）
 */
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// GET /api/admin/users
router.get('/', async (req, res) => {
  try {
    const {
      page = 1, pageSize = 20,
      keyword, role, status,
      sortBy = 'createdAt', sortOrder = 'desc'
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(pageSize);
    const take = Math.min(parseInt(pageSize), 100);
    const where = {};

    if (role) where.role = role;
    if (keyword) {
      where.OR = [
        { username: { contains: keyword } },
        { name: { contains: keyword } },
        { email: { contains: keyword } },
      ];
    }

    const allowedSortBy = ['createdAt', 'username', 'name', 'role'];
    const orderField = allowedSortBy.includes(sortBy) ? sortBy : 'createdAt';
    const orderDir = sortOrder === 'asc' ? 'asc' : 'desc';

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where, skip, take,
        orderBy: { [orderField]: orderDir },
        select: {
          id: true, phone: true, username: true, name: true, role: true,
          createdAt: true,
          // 关联数据
          accounts: { select: { id: true, platform: true, status: true, lastActiveAt: true } },
        }
      }),
      prisma.user.count({ where }),
    ]);

    // 附加统计信息
    const usersWithStats = await Promise.all(
      users.map(async (u) => {
        const messageCount = await prisma.message.count({
          where: { account: { userId: u.id } }
        }).catch(() => 0);
        const contactCount = await prisma.contact.count({
          where: { account: { userId: u.id } }
        }).catch(() => 0);
        return {
          ...u,
          accountCount: u.accounts?.length || 0,
          messageCount,
          contactCount,
          lastActiveAt: u.accounts?.[0]?.lastActiveAt || null,
        };
      })
    );

    res.json({
      data: usersWithStats,
      total,
      page: parseInt(page),
      pageSize: parseInt(pageSize),
    });
  } catch (err) {
    console.error('[AdminUsers] List error:', err);
    res.status(500).json({ error: '获取用户列表失败' });
  }
});

// GET /api/admin/users/:id
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true, phone: true, username: true, name: true, role: true, createdAt: true,
        accounts: {
          select: { id: true, platform: true, phone: true, name: true, status: true, lastActiveAt: true }
        },
      }
    });
    if (!user) return res.status(404).json({ error: '用户不存在' });

    const messageCount = await prisma.message.count({
      where: { account: { userId: id } }
    }).catch(() => 0);
    const contactCount = await prisma.contact.count({
      where: { account: { userId: id } }
    }).catch(() => 0);

    // 订阅信息
    const subscription = await prisma.userSubscription.findFirst({
      where: { userId: id },
      orderBy: { createdAt: 'desc' },
      include: { plan: true },
    });

    res.json({
      data: {
        ...user,
        messageCount,
        contactCount,
        subscription,
      }
    });
  } catch (err) {
    console.error('[AdminUsers] Get error:', err);
    res.status(500).json({ error: '获取用户详情失败' });
  }
});

// PUT /api/admin/users/:id
router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { role, name, reason, phone } = req.body;

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: '用户不存在' });

    const beforeValue = { role: existing.role, name: existing.name, phone: existing.phone };
    const updateData = {};
    if (role !== undefined) updateData.role = role;
    if (name !== undefined) updateData.name = name;
    if (phone !== undefined) {
      if (phone && !/^1[3-9]\d{9}$/.test(phone)) return res.status(400).json({ error: '手机号格式不正确' });
      updateData.phone = phone || null;
    }

    const user = await prisma.user.update({
      where: { id }, data: updateData,
      select: { id: true, phone: true, username: true, name: true, role: true, createdAt: true }
    });

    await prisma.auditLog.create({
      data: {
        adminId: req.admin?.id || 0,
        action: 'update_user',
        targetType: 'user',
        targetId: String(id),
        beforeValue: JSON.stringify(beforeValue),
        afterValue: JSON.stringify(updateData),
        reason: reason || '更新用户信息',
        riskLevel: 'low',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      }
    });

    res.json({ data: user, message: '用户更新成功' });
  } catch (err) {
    console.error('[AdminUsers] Update error:', err);
    res.status(500).json({ error: '更新用户失败' });
  }
});

// POST /api/admin/users/:id/reset-password
router.post('/:id/reset-password', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: '用户不存在' });

    const newPassword = req.body.password || Math.random().toString(36).slice(-10);
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id },
      data: { password: hashedPassword }
    });

    await prisma.auditLog.create({
      data: {
        adminId: req.admin?.id || 0,
        action: 'reset_user_password',
        targetType: 'user',
        targetId: String(id),
        reason: req.body.reason || '重置用户密码',
        riskLevel: 'high',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      }
    });

    res.json({ message: '用户密码已重置' });
  } catch (err) {
    console.error('[AdminUsers] Reset password error:', err);
    res.status(500).json({ error: '重置密码失败' });
  }
});

// POST /api/admin/users/:id/ban
router.post('/:id/ban', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: '用户不存在' });

    await prisma.user.update({
      where: { id },
      data: { role: 'banned' }
    });

    await prisma.auditLog.create({
      data: {
        adminId: req.admin?.id || 0,
        action: 'ban_user',
        targetType: 'user',
        targetId: String(id),
        beforeValue: JSON.stringify({ role: existing.role }),
        afterValue: JSON.stringify({ role: 'banned' }),
        reason: req.body.reason || '封禁用户',
        riskLevel: 'high',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      }
    });

    res.json({ message: '用户已封禁' });
  } catch (err) {
    console.error('[AdminUsers] Ban error:', err);
    res.status(500).json({ error: '封禁用户失败' });
  }
});

// POST /api/admin/users/:id/unban
router.post('/:id/unban', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: '用户不存在' });

    await prisma.user.update({
      where: { id },
      data: { role: 'user' }
    });

    await prisma.auditLog.create({
      data: {
        adminId: req.admin?.id || 0,
        action: 'unban_user',
        targetType: 'user',
        targetId: String(id),
        beforeValue: JSON.stringify({ role: existing.role }),
        afterValue: JSON.stringify({ role: 'user' }),
        reason: req.body.reason || '解封用户',
        riskLevel: 'medium',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      }
    });

    res.json({ message: '用户已解封' });
  } catch (err) {
    console.error('[AdminUsers] Unban error:', err);
    res.status(500).json({ error: '解封用户失败' });
  }
});

export default router;
