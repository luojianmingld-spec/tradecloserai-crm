/**
 * 话术库自主学习进化 V1 - API
 *  GET /api/learning/jobs            学习任务状态列表（按 accountId 隔离）
 *  GET /api/learning/jobs/:id        学习任务详情
 *  GET /api/learning/winsummaries    成交总结列表（按 accountId/行业筛选）
 *  GET /api/learning/winsummaries/:id 成交总结详情
 *  POST /api/learning/run            手动触发一轮学习（后台子进程，管理员）
 *  POST /api/learning/run-winsummary 手动触发一轮成交总结（后台子进程，管理员）
 */
import { Router } from 'express';
import { execFile } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';
import { resolveAccountIdsForUser } from '../learning/learning.service.js';

const router = Router();
const prisma = new PrismaClient();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

function requireAdmin(req, res, next) {
  if (req.userRole !== 'admin' && req.userRole !== 'ADMIN') return res.status(403).json({ error: '需要管理员权限' });
  next();
}

/** 解析请求可访问的 accountId 列表（跨租户隔离：越权返回空） */
async function allowedAccountIds(req) {
  return resolveAccountIdsForUser(req.userId);
}

/** 校验请求中的 accountId 是否在可访问范围内 */
async function assertAccountAllowed(req, accountId) {
  const allowed = await allowedAccountIds(req);
  if (accountId != null && !allowed.includes(Number(accountId))) return false;
  return true;
}

// ── 学习任务状态 ──────────────────────────────────────────────────
router.get('/jobs', async (req, res) => {
  try {
    const allowed = await allowedAccountIds(req);
    const where = { accountId: { in: allowed } };
    if (req.query.accountId) {
      const acc = parseInt(req.query.accountId, 10);
      if (!allowed.includes(acc)) return res.json({ success: true, data: [], total: 0, note: 'accountId 越权已过滤' });
      where.accountId = acc;
    }
    if (req.query.status) where.status = req.query.status;
    if (req.query.type) where.type = req.query.type;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize, 10) || 20));
    const [total, rows] = await Promise.all([
      prisma.learningJob.count({ where }),
      prisma.learningJob.findMany({
        where,
        orderBy: { created: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    res.json({ success: true, data: rows, total, page, pageSize });
  } catch (e) {
    console.error('[Learning] GET /jobs error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

router.get('/jobs/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const job = await prisma.learningJob.findUnique({ where: { id } });
    if (!job) return res.status(404).json({ error: 'not found' });
    const allowed = await allowedAccountIds(req);
    if (!allowed.includes(job.accountId)) return res.status(403).json({ error: '无权访问该租户任务' });
    res.json({ success: true, data: job });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── 成交总结 ──────────────────────────────────────────────────────
router.get('/winsummaries', async (req, res) => {
  try {
    const allowed = await allowedAccountIds(req);
    const where = { accountId: { in: allowed } };
    if (req.query.accountId) {
      const acc = parseInt(req.query.accountId, 10);
      if (!allowed.includes(acc)) return res.json({ success: true, data: [], total: 0, note: 'accountId 越权已过滤' });
      where.accountId = acc;
    }
    if (req.query.industry) where.industry = { contains: String(req.query.industry), mode: 'insensitive' };
    if (req.query.productLine) where.productLine = { contains: String(req.query.productLine), mode: 'insensitive' };
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize, 10) || 20));
    const [total, rows] = await Promise.all([
      prisma.winSummary.count({ where }),
      prisma.winSummary.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    res.json({ success: true, data: rows, total, page, pageSize });
  } catch (e) {
    console.error('[Learning] GET /winsummaries error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

router.get('/winsummaries/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const ws = await prisma.winSummary.findUnique({ where: { id } });
    if (!ws) return res.status(404).json({ error: 'not found' });
    const allowed = await allowedAccountIds(req);
    if (!allowed.includes(ws.accountId)) return res.status(403).json({ error: '无权访问该租户成交总结' });
    res.json({ success: true, data: ws });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── 手动触发（后台子进程，管理员） ────────────────────────────────
router.post('/run', requireAdmin, (req, res) => {
  const accountId = parseInt(req.body.accountId, 10) || 1;
  const limit = parseInt(req.body.limit, 10) || 120;
  const force = !!req.body.force;
  const script = path.join(__dirname, '../learning/run-learning.js');
  const args = [`--accountId=${accountId}`, `--limit=${limit}`];
  if (force) args.push('--force');
  execFile('node', args, { cwd: path.join(__dirname, '../../') }, (err, stdout, stderr) => {
    if (err) console.error('[Learning] run error:', err.message);
    console.log('[Learning] run stdout:', stdout);
    if (stderr) console.warn('[Learning] run stderr:', stderr);
  });
  res.json({ success: true, message: '学习任务已触发（后台执行）', script, args });
});

router.post('/run-winsummary', requireAdmin, (req, res) => {
  const accountId = parseInt(req.body.accountId, 10) || 1;
  const limit = parseInt(req.body.limit, 10) || 20;
  const script = path.join(__dirname, '../learning/run-winsummary.js');
  const args = [`--accountId=${accountId}`, `--limit=${limit}`];
  execFile('node', args, { cwd: path.join(__dirname, '../../') }, (err, stdout, stderr) => {
    if (err) console.error('[Learning] winsummary run error:', err.message);
    console.log('[Learning] winsummary stdout:', stdout);
    if (stderr) console.warn('[Learning] winsummary stderr:', stderr);
  });
  res.json({ success: true, message: '成交总结任务已触发（后台执行）', script, args });
});

export default router;
