/**
 * Admin Auth Routes
 * 管理员登录/登出/me
 */
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_TOKEN_EXPIRY = '4h';

// POST /api/admin/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' });
    }

    const admin = await prisma.adminUser.findUnique({
      where: { username },
      include: { role: true }
    });

    if (!admin) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    if (admin.status !== 'active') {
      return res.status(403).json({ error: '账号已被禁用，请联系超级管理员' });
    }

    const valid = await bcrypt.compare(password, admin.password);
    if (!valid) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    const token = jwt.sign(
      { adminId: admin.id, role: 'admin', roleId: admin.roleId, permissions: admin.role.permissions },
      JWT_SECRET,
      { expiresIn: ADMIN_TOKEN_EXPIRY }
    );

    // 创建session记录
    const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000);
    await prisma.adminSession.create({
      data: {
        adminId: admin.id,
        token,
        expiresAt,
        ip: req.ip,
        userAgent: req.headers['user-agent'] || null,
      }
    });

    // 更新最后登录时间
    await prisma.adminUser.update({
      where: { id: admin.id },
      data: {
        lastLoginAt: new Date(),
        lastLoginIp: req.ip,
      }
    });

    res.json({
      data: {
        token,
        expiresAt,
        admin: {
          id: admin.id,
          username: admin.username,
          email: admin.email,
          name: admin.name,
          avatar: admin.avatar,
          role: admin.role,
        }
      }
    });
  } catch (err) {
    console.error('[AdminAuth] Login error:', err);
    res.status(500).json({ error: '登录失败' });
  }
});

// POST /api/admin/auth/logout
router.post('/logout', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      await prisma.adminSession.updateMany({
        where: { token },
        data: { logoutAt: new Date() }
      });
    }
    res.json({ message: '已登出' });
  } catch (err) {
    console.error('[AdminAuth] Logout error:', err);
    res.status(500).json({ error: '登出失败' });
  }
});

// GET /api/admin/auth/me
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: '未登录' });
    }
    const token = authHeader.split(' ')[1];
    
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (e) {
      return res.status(401).json({ error: 'token已过期，请重新登录' });
    }

    if (!decoded.adminId) {
      return res.status(401).json({ error: '无效token' });
    }

    const admin = await prisma.adminUser.findUnique({
      where: { id: decoded.adminId },
      include: { role: true }
    });

    if (!admin || admin.status !== 'active') {
      return res.status(401).json({ error: '账号不存在或已被禁用' });
    }

    // 检查session是否有效
    const session = await prisma.adminSession.findUnique({ where: { token } });
    if (!session || session.expiresAt < new Date()) {
      return res.status(401).json({ error: 'session已过期，请重新登录' });
    }

    res.json({
      data: {
        id: admin.id,
        username: admin.username,
        email: admin.email,
        name: admin.name,
        avatar: admin.avatar,
        role: admin.role,
        lastLoginAt: admin.lastLoginAt,
        lastLoginIp: admin.lastLoginIp,
        mfaEnabled: admin.mfaEnabled,
      }
    });
  } catch (err) {
    console.error('[AdminAuth] Me error:', err);
    res.status(500).json({ error: '获取用户信息失败' });
  }
});

// GET /api/admin/auth/sessions - 当前管理员的所有活跃session
router.get('/sessions', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1];
    let decoded;
    try { decoded = jwt.verify(token, JWT_SECRET); } catch(e) {
      return res.status(401).json({ error: '未登录' });
    }
    if (!decoded.adminId) return res.status(401).json({ error: '无效token' });

    const sessions = await prisma.adminSession.findMany({
      where: { adminId: decoded.adminId, logoutAt: null, expiresAt: { gt: new Date() } },
      orderBy: { loginAt: 'desc' }
    });

    res.json({ data: sessions });
  } catch (err) {
    console.error('[AdminAuth] Sessions error:', err);
    res.status(500).json({ error: '获取会话列表失败' });
  }
});

export default router;
