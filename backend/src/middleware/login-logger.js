
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 登录尝试记录 (内存缓存，避免每次查DB)
const loginAttempts = new Map(); // key: ip, value: { count, lockedUntil }

const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

/**
 * 检查 IP 是否被锁定
 */
export function isLockedOut(ip) {
  const record = loginAttempts.get(ip);
  if (!record) return false;
  if (record.lockedUntil && Date.now() < record.lockedUntil) return true;
  // 锁定期已过，清除
  if (record.lockedUntil && Date.now() >= record.lockedUntil) {
    loginAttempts.delete(ip);
  }
  return false;
}

/**
 * 记录成功登录
 */
export async function recordLoginSuccess(userId, ip, userAgent) {
  loginAttempts.delete(ip); // 成功后清除该IP的失败记录
  try {
    // 写日志到DB (异步，不阻塞响应)
    prisma.$executeRaw`
      INSERT INTO LoginLog (userId, ip, userAgent, success, createdAt)
      VALUES (${userId}, ${ip}, ${userAgent}, ${true}, ${new Date()})
    `.catch(() => {});
  } catch (e) { /* ignore */ }
}

/**
 * 记录失败登录
 */
export async function recordLoginFailure(username, ip, userAgent, reason) {
  const record = loginAttempts.get(ip) || { count: 0, lockedUntil: null };
  record.count += 1;
  if (record.count >= MAX_ATTEMPTS) {
    record.lockedUntil = Date.now() + LOCKOUT_MINUTES * 60 * 1000;
  }
  loginAttempts.set(ip, record);

  try {
    prisma.$executeRaw`
      INSERT INTO LoginLog (userId, ip, userAgent, success, failReason, createdAt)
      VALUES (0, ${ip}, ${userAgent}, ${false}, ${reason || 'invalid_credentials'}, ${new Date()})
    `.catch(() => {});
  } catch (e) { /* ignore */ }
}

/**
 * 获取锁定状态信息
 */
export function getLockoutInfo(ip) {
  const record = loginAttempts.get(ip);
  if (!record || !record.lockedUntil || Date.now() >= record.lockedUntil) return null;
  const remainingSeconds = Math.ceil((record.lockedUntil - Date.now()) / 1000);
  return { locked: true, remainingSeconds };
}

/**
 * 登录日志中间件 - 加在 login 路由前面
 */
export function loginRateMiddleware(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress;
  if (isLockedOut(ip)) {
    const info = getLockoutInfo(ip);
    return res.status(429).json({
      error: `登录尝试过于频繁，账号已锁定。请${info.remainingSeconds}秒后重试`,
      locked: true,
      remainingSeconds: info.remainingSeconds
    });
  }
  next();
}

export default { isLockedOut, recordLoginSuccess, recordLoginFailure, getLockoutInfo, loginRateMiddleware };
