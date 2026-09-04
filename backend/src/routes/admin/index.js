/**
 * Admin Routes Index
 * 统一导出所有超管后台路由
 */
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import authRoutes from './auth.js';
import adminUsersRoutes from './admin-users.js';
import rolesRoutes from './roles.js';
import auditLogsRoutes from './audit-logs.js';
import dashboardRoutes from './dashboard.js';
import usersRoutes from './users.js';
import subscriptionsRoutes from './subscriptions.js';
import creditsRoutes from './credits.js';
import paymentConfigRoutes from './payment_config.js';
import couponsRoutes from './coupons.js';
import agentsRoutes from './agents.js';
import systemConfigRoutes from './system-config.js';
import announcementsRoutes from './announcements.js';
import inviteCodesRoutes from './invite-codes.js';
import tenantsRoutes from './tenants.js';
import fraudRoutes from './fraud.js';

const router = Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET;

/**
 * adminAuth 中间件
 * 验证AdminUser + token + 权限
 * 用于除登录外的所有admin路由
 */
async function adminAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: '未登录，请先登录' });
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (e) {
      return res.status(401).json({ error: 'token已过期，请重新登录' });
    }

    if (!decoded.adminId) {
      return res.status(401).json({ error: '无效token，请重新登录' });
    }

    // 查找管理员
    const admin = await prisma.adminUser.findUnique({
      where: { id: decoded.adminId },
      include: { role: true }
    });

    if (!admin || admin.status !== 'active') {
      return res.status(401).json({ error: '管理员账号不存在或已被禁用' });
    }

    // 检查session是否还有效
    const session = await prisma.adminSession.findUnique({ where: { token } });
    if (!session || session.expiresAt < new Date() || session.logoutAt) {
      return res.status(401).json({ error: '会话已过期，请重新登录' });
    }

    // 将admin信息挂到req上
    req.admin = {
      id: admin.id,
      username: admin.username,
      name: admin.name,
      email: admin.email,
      roleId: admin.roleId,
      role: admin.role,
      permissions: admin.role?.permissions ? JSON.parse(admin.role.permissions) : [],
    };

    next();
  } catch (err) {
    console.error('[adminAuth] Error:', err);
    res.status(500).json({ error: '认证服务异常' });
  }
}

/**
 * requirePermission 权限检查中间件工厂
 * @param {string} permission - 权限点，格式: module:action 如 'users:view'
 */
function requirePermission(...requiredPermissions) {
  return (req, res, next) => {
    // super_admin拥有所有权限
    if (req.admin?.role?.code === 'super_admin') {
      return next();
    }

    const permissions = req.admin?.permissions || [];
    // 如果角色permissions是'*'，表示全部权限
    if (permissions.includes('*')) {
      return next();
    }

    const hasPermission = requiredPermissions.some(p => permissions.includes(p));
    if (!hasPermission) {
      return res.status(403).json({
        error: '权限不足',
        required: requiredPermissions,
        current: permissions,
      });
    }
    next();
  };
}

// 挂载路由
// /api/admin/auth/* - 登录相关，不需要adminAuth（但me/logout需要）
router.use('/auth', authRoutes);

// 以下路由都需要adminAuth
router.use('/dashboard', adminAuth, dashboardRoutes);
router.use('/admin-users', adminAuth, adminUsersRoutes);
router.use('/roles', adminAuth, rolesRoutes);
router.use('/audit-logs', adminAuth, auditLogsRoutes);
router.use('/users', adminAuth, usersRoutes);
router.use('/subscriptions', adminAuth, subscriptionsRoutes);
router.use('/credits', adminAuth, creditsRoutes);
router.use('/payment-config', adminAuth, paymentConfigRoutes);
router.use('/coupons', adminAuth, couponsRoutes);
router.use('/agents', adminAuth, agentsRoutes);
router.use('/system-config', adminAuth, systemConfigRoutes);
router.use('/announcements', adminAuth, announcementsRoutes);
router.use('/invite-codes', adminAuth, inviteCodesRoutes);
router.use('/tenants', adminAuth, tenantsRoutes);
router.use('/fraud', adminAuth, fraudRoutes);

// 导出adminAuth和requirePermission供其他模块使用
export { adminAuth, requirePermission };
export default router;
