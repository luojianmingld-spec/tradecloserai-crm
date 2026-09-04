import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { generateToken, authMiddleware } from '../middleware/auth.js';
import { recordLoginSuccess, recordLoginFailure, getLockoutInfo, loginRateMiddleware } from '../middleware/login-logger.js';

const router = Router();
const prisma = new PrismaClient();

// 管理员权限校验中间件
function requireAdmin(req, res, next) {
  if (!req.userRole || req.userRole.toLowerCase() !== 'admin') return res.status(403).json({ error: '需要管理员权限' });
  next();
}

router.post('/login', loginRateMiddleware, async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: '用户名和密码必填' });
    const user = await prisma.user.findFirst({ where: { username } });
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
    if (user.role === 'banned') {
      const ip = req.ip || req.connection.remoteAddress;
      const ua = req.headers['user-agent'] || '';
      recordLoginFailure(username, ip, ua, 'banned');
      return res.status(403).json({ error: '账号已被停用，请联系管理员' });
    }
    const token = generateToken(user.id, user.role);
    const ip = req.ip || req.connection.remoteAddress;
    const ua = req.headers['user-agent'] || '';
    recordLoginSuccess(user.id, ip, ua);
    res.json({ token, user: { id: user.id, username: user.username, name: user.name, role: user.role } });
  } catch (err) {
    console.error('[Auth] Login error:', err);
    res.status(500).json({ error: '登录失败', detail: '请重试' });
  }
});

// 注册/创建用户（仅admin）
router.post('/register', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { username, password, name, role } = req.body;
    if (!username || !password) return res.status(400).json({ error: '用户名和密码必填' });
    const pwdRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!pwdRegex.test(password)) return res.status(400).json({ error: '密码至少8位，须含大小写字母和数字' });
    const existing = await prisma.user.findFirst({ where: { username } });
    if (existing) return res.status(409).json({ error: '用户名已存在' });
    const hash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { username, password: hash, name: name || username, role: ['admin','manager','sales'].includes(role) ? role : 'sales' },
    });
    // 建号审计（验收 P1：可追溯）
    try {
      let adminId = 0;
      try {
        const t = (req.headers.authorization || '').split(' ')[1];
        if (t) adminId = jwt.verify(t, process.env.JWT_SECRET).adminId || 0;
      } catch (e) { adminId = 0; }
      if (!adminId) {
        const superAdmin = await prisma.adminUser.findFirst({ where: { username: 'admin' } });
        adminId = superAdmin?.id || 0;
      }
      if (adminId) {
        await prisma.auditLog.create({
          data: {
            adminId,
            action: 'create_user',
            targetType: 'user',
            targetId: String(user.id),
            afterValue: JSON.stringify({ username: user.username, name: user.name, role: user.role }),
            reason: '管理员建号',
            riskLevel: 'medium',
            ip: req.ip,
            userAgent: req.headers['user-agent'],
          }
        });
      }
    } catch (auditErr) {
      console.error('[Auth] Register audit error:', auditErr.message);
    }
    res.status(201).json({ id: user.id, username: user.username, name: user.name, role: user.role });
  } catch (err) {
    console.error('[Auth] Register error:', err);
    res.status(500).json({ error: '创建失败', detail: '请重试' });
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
      select: { id: true, username: true, name: true, role: true, phone: true, createdAt: true },
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
    if (phone !== undefined) {
      if (phone && !/^1[3-9]\d{9}$/.test(phone)) return res.status(400).json({ error: '手机号格式不正确' });
      data.phone = phone || null;
    }
    if (role !== undefined) data.role = ['admin','manager','sales'].includes(role) ? role : 'sales';
    if (password) {
      const pwdRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!pwdRegex.test(password)) return res.status(400).json({ error: '密码至少8位，须含大小写字母和数字' });
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



// ===== 手机号验证码登录（社区+产品账号打通 2026-08-19） =====
// 短信验证码统一由社区阿里云短信发放/校验，产品委托社区内部接口
const COMMUNITY_API_BASE = process.env.COMMUNITY_API_BASE || 'https://bbs.tradecloserai.com';
const COMMUNITY_INTERNAL_KEY = process.env.COMMUNITY_INTERNAL_KEY || '';

async function callCommunityInternal(endpoint, payload) {
  if (!COMMUNITY_INTERNAL_KEY) return { ok: false, error: 'community_key_missing' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${COMMUNITY_API_BASE}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Internal-Key': COMMUNITY_INTERNAL_KEY },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    return { ok: false, error: err.name === 'AbortError' ? 'timeout' : err.message };
  } finally {
    clearTimeout(timer);
  }
}

// 发送手机号登录验证码（委托社区发码）
router.post('/phone/send-code', async (req, res) => {
  try {
    const { phone } = req.body || {};
    if (!phone || !/^1[3-9]\d{9}$/.test(phone)) return res.status(400).json({ error: '手机号格式不正确' });
    const r = await callCommunityInternal('/api/internal/send-code', { phone, scene: 'login' });
    if (!r.ok) return res.status(502).json({ error: '验证码发送失败，请稍后再试' });
    res.json({ sent: true });
  } catch (err) {
    console.error('[Auth] phone send-code error:', err.message);
    res.status(500).json({ error: '发送失败，请重试' });
  }
});

// 手机号验证码登录（邀请制：仅已开通账号可登录，关闭自助注册）
router.post('/phone-login', async (req, res) => {
  try {
    const { phone, code } = req.body || {};
    if (!phone || !/^1[3-9]\d{9}$/.test(phone)) return res.status(400).json({ error: '手机号格式不正确' });
    if (!code) return res.status(400).json({ error: '验证码必填' });
    const r = await callCommunityInternal('/api/internal/verify-code', { phone, code, scene: 'login' });
    if (!r.ok) return res.status(502).json({ error: '验证服务暂不可用，请稍后再试' });
    if (!r.data?.valid) return res.status(401).json({ error: '验证码错误或已过期' });
    const cu = r.data.user || {};
    // 邀请制：仅已开通账号可登录，关闭手机号自助注册（无号即建）
    let user = await prisma.user.findFirst({ where: { phone } });
    if (!user) {
      return res.status(403).json({ error: '该手机号尚未开通账号，请联系管理员开通后再登录' });
    }
    if (cu && Object.keys(cu).length) {
      try {
        user = await prisma.user.update({ where: { id: user.id }, data: { communityProfile: cu } });
      } catch (e) { /* 忽略 profile 同步失败 */ }
    }
    if (user.role === 'banned') {
      return res.status(403).json({ error: '账号已被停用，请联系管理员' });
    }
    const token = generateToken(user.id, user.role);
    const ip = req.ip || req.connection.remoteAddress;
    const ua = req.headers['user-agent'] || '';
    recordLoginSuccess(user.id, ip, ua);
    res.json({
      token,
      user: { id: user.id, username: user.username, name: user.name, role: user.role, phone: user.phone },
      isNewUser: false,
    });
  } catch (err) {
    console.error('[Auth] phone-login error:', err);
    res.status(500).json({ error: '登录失败，请重试' });
  }
});

export default router;
