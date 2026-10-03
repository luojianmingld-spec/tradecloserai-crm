/**
 * Outbound Confirm Routes（Agent 外发安全门 —— 确认 / 拒发 / 查询）
 * ============================================================================
 * TC-SEC-002。安全控制在后端独立完成，不依赖前端弹窗：
 * - 所有路由挂 authMiddleware，身份/租户来自当前 JWT（req.userId）。
 * - 确认时由 outbound-draft 服务重新校验归属与权限，并做幂等发送。
 * - 支持 dryRun（确认走 mock，不触达真实客户），用于 staging 验收。
 */
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import {
  listDrafts,
  getDraft,
  rejectDraft,
  confirmAndSendDraft,
  writeAudit,
} from '../services/outbound-draft.service.js';

const router = Router();
const prisma = new PrismaClient();

function requestMeta(req) {
  return { ip: req.ip, userAgent: req.headers['user-agent'] || null };
}

function sanitize(d) {
  if (!d) return null;
  const { content, ...meta } = d;
  // 列表/详情里 content 仅返回给「草稿归属者本人」，用于展示；审计仍不含正文。
  return { ...meta, content };
}

// GET /api/outbound/drafts?status=pending
router.get('/drafts', async (req, res) => {
  try {
    const userId = req.userId;
    const status = typeof req.query.status === 'string' ? req.query.status : null;
    const drafts = listDrafts({ userId, status }).map(sanitize);
    res.json({ success: true, data: drafts });
  } catch (e) {
    console.error('[Outbound] list drafts error:', e.message);
    res.status(500).json({ success: false, error: 'LIST_FAILED' });
  }
});

// GET /api/outbound/drafts/:id
router.get('/drafts/:id', async (req, res) => {
  try {
    const d = getDraft(req.params.id);
    if (!d) return res.status(404).json({ success: false, error: 'NOT_FOUND' });
    if (d.userId !== req.userId && d.tenantId !== req.userId) {
      writeAudit({ action: 'draft_read_denied', result: 'forbidden', draftId: d.id, userId: req.userId, ip: req.ip });
      return res.status(403).json({ success: false, error: 'FORBIDDEN' });
    }
    res.json({ success: true, data: sanitize(d) });
  } catch (e) {
    console.error('[Outbound] get draft error:', e.message);
    res.status(500).json({ success: false, error: 'GET_FAILED' });
  }
});

// POST /api/outbound/drafts/:id/confirm
// body: { dryRun?: boolean }
router.post('/drafts/:id/confirm', async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ success: false, error: 'UNAUTHENTICATED' });

    // 归属/权限/幂等全部在服务内复校
    const result = await confirmAndSendDraft(
      req.params.id,
      { userId, userRole: req.userRole, tenantId: userId },
      { dryRun: req.body?.dryRun === true },
      requestMeta(req),
    );

    if (result.ok) {
      return res.json({ success: true, data: result });
    }
    const statusMap = {
      UNAUTHENTICATED: 401,
      FORBIDDEN: 403,
      NOT_FOUND: 404,
      EXPIRED: 410,
      REJECTED: 409,
      SEND_FAILED: 502,
      NO_SENDER: 503,
      TOO_MANY_ATTEMPTS: 429,
    };
    const code = statusMap[result.code] || 400;
    return res.status(code).json({ success: false, error: result.code, ...result });
  } catch (e) {
    console.error('[Outbound] confirm error:', e.message);
    res.status(500).json({ success: false, error: 'CONFIRM_FAILED' });
  }
});

// POST /api/outbound/drafts/:id/reject
router.post('/drafts/:id/reject', async (req, res) => {
  try {
    const result = await rejectDraft(
      req.params.id,
      { userId: req.userId, tenantId: req.userId },
      requestMeta(req),
    );
    if (result.ok) return res.json({ success: true, data: result });
    if (result.code === 'NOT_FOUND') return res.status(404).json({ success: false, error: 'NOT_FOUND' });
    if (result.code === 'FORBIDDEN') return res.status(403).json({ success: false, error: 'FORBIDDEN' });
    if (result.code === 'ALREADY_SENT') return res.status(409).json({ success: false, error: 'ALREADY_SENT' });
    return res.status(400).json({ success: false, error: result.code });
  } catch (e) {
    console.error('[Outbound] reject error:', e.message);
    res.status(500).json({ success: false, error: 'REJECT_FAILED' });
  }
});

export default router;
export { prisma };
