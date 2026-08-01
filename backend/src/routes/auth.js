import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { generateToken, authMiddleware } from '../middleware/auth.js';
import { recordLoginSuccess, recordLoginFailure, getLockoutInfo, loginRateMiddleware } from '../middleware/login-logger.js';

const router = Router();
const prisma = new PrismaClient();

// 管理员权限校验中间件
function requireAdmin(req, res, next) {
  if (req.userRole !== 'admin') return res.status(403).json({ error: '需要管理员权限' });
  next();
}

router.post('/login', loginRateMiddleware, async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: '用户名和密码必填' });
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      const ip = req.ip || req.connection.remoteAddress;
      const ua = req.headers['user-agent'] || '';
      recordLoginFailure(username || 'unknown', ip, ua, 'user_not_found');
      return res.status(401).json({ error: '用户名或密码错误', lockout: getLockoutInfo(ip) });
    }
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      const ip = req.ip || req.connection.remoteAddress;
      const ua = req.headers['user-agent'] || '';
      recordLoginFailure(username, ip, ua, 'wrong_password');
      return res.status(401).json({ error: '用户名或密码错误', lockout: getLockoutInfo(ip) });
    }
    const token = generateToken(user.id, user.role);
    const ip = req.ip || req.connection.remoteAddress;
    const ua = req.headers['user-agent'] || '';
    recordLoginSuccess(user.id, ip, ua);
    res.json({ token, user: { id: user.id, username: user.username, name: user.name, role: user.role } });
  } catch (err) {
    console.error('[Auth] Login error:', err);
    res.status(500).json({ error: '登录失败', detail: err.message });
  }
});

// 注册/创建用户（仅admin）
router.post('/register', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { username, password, name, role } = req.body;
    if (!username || !password) return res.status(400).json({ error: '用户名和密码必填' });
    if (password.length < 4) return res.status(400).json({ error: '密码至少4位' });
    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) return res.status(409).json({ error: '用户名已存在' });
    const hash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { username, password: hash, name: name || username, role: ['admin','manager','sales'].includes(role) ? role : 'sales' },
    });
    res.status(201).json({ id: user.id, username: user.username, name: user.name, role: user.role });
  } catch (err) {
    console.error('[Auth] Register error:', err);
    res.status(500).json({ error: '创建失败', detail: err.message });
  }
});

// 获取当前用户信息
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) return res.status(401).json({ error: '用户不存在' });
    res.json({ id: user.id, username: user.username, name: user.name, role: user.role });
  } catch { res.status(401).json({ error: 'Invalid token' }); }
});

// 获取所有用户（仅admin）
router.get('/users', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, username: true, name: true, role: true, createdAt: true },
      orderBy: { id: 'asc' },
    });
    res.json(users);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 更新用户（仅admin：改姓名/角色/密码）
router.put('/users/:id', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, role, password } = req.body;
    const data = {};
    if (name !== undefined) data.name = name;
    if (role !== undefined) data.role = ['admin','manager','sales'].includes(role) ? role : 'sales';
    if (password) {
      if (password.length < 4) return res.status(400).json({ error: '密码至少4位' });
      data.password = await bcrypt.hash(password, 10);
    }
    const user = await prisma.user.update({ where: { id }, data, select: { id: true, username: true, name: true, role: true } });
    res.json(user);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 删除用户（仅admin，不能删自己）
router.delete('/users/:id', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (id === req.userId) return res.status(400).json({ error: '不能删除自己' });
    await prisma.user.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
