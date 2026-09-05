import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { runCreditContext } from './credit-context.js';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) { console.error('[FATAL] JWT_SECRET environment variable is required'); process.exit(1); };

const prisma = new PrismaClient();

export async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    console.warn('[Auth] Token verification failed'); return res.status(401).json({ error: 'Authentication required' });
  }
  req.userId = decoded.userId;
  req.userRole = decoded.role;

  // admin token（无 userId）不校验 User 表状态，交给下游 admin 鉴权
  if (decoded.userId === undefined || decoded.userId === null) {
    return runCreditContext(req.userId, req.body?.model, () => next());
  }

  // 停用/删除后旧 token 立即失效：查库校验最新状态
  try {
    const user = await prisma.user.findUnique({ where: { id: decoded.userId }, select: { role: true } });
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (user.role === 'banned') {
      return res.status(403).json({ error: '账号已被停用，请联系管理员' });
    }
  } catch (dbErr) {
    console.error('[Auth] DB check failed:', dbErr.message);
    return res.status(503).json({ error: 'Service temporarily unavailable' });
  }
  return runCreditContext(req.userId, req.body?.model, () => next());
}

export function generateToken(userId, role) {
  return jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: '7d' });
}

export { JWT_SECRET };

