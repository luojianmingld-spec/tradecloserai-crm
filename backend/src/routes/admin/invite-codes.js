/**
 * Invite Codes Routes
 * 邀请码/预约码管理
 */
import { Router } from 'express';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

function generateCode() {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

// GET /api/admin/invite-codes
router.get('/', async (req, res) => {
  try {
    const { page = 1, pageSize = 20, type, status, keyword, batchId } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(pageSize);
    const take = parseInt(pageSize);
    const where = {};
    if (type) where.type = type;
    if (status) where.status = status;
    if (batchId) where.batchId = batchId;
    if (keyword) {
      where.OR = [
        { code: { contains: keyword } },
        { batchId: { contains: keyword } },
      ];
    }
    const [codes, total] = await Promise.all([
      prisma.inviteCode.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
      prisma.inviteCode.count({ where }),
    ]);
    res.json({ data: codes, total, page: parseInt(page), pageSize: parseInt(pageSize) });
  } catch (err) {
    console.error('[InviteCodes] List error:', err);
    res.status(500).json({ error: '获取邀请码列表失败' });
  }
});

// POST /api/admin/invite-codes - 创建单个邀请码
router.post('/', async (req, res) => {
  try {
    const { code, type, maxUses, expiresAt, batchId, reason } = req.body;
    if (!type) return res.status(400).json({ error: 'type不能为空' });

    const finalCode = (code || generateCode()).toUpperCase();
    const existing = await prisma.inviteCode.findUnique({ where: { code: finalCode } });
    if (existing) return res.status(400).json({ error: '邀请码已存在' });

    const inviteCode = await prisma.inviteCode.create({
      data: {
        code: finalCode,
        type,
        maxUses: maxUses || 1,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        batchId: batchId || null,
      }
    });

    await prisma.auditLog.create({
      data: {
        adminId: req.admin?.id || 0,
        action: 'create_invite_code',
        targetType: 'invite_code',
        targetId: String(inviteCode.id),
        afterValue: JSON.stringify({ code: finalCode, type }),
        reason: reason || '创建邀请码',
        riskLevel: 'low',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      }
    });

    res.status(201).json({ data: inviteCode, message: '邀请码创建成功' });
  } catch (err) {
    console.error('[InviteCodes] Create error:', err);
    res.status(500).json({ error: '创建邀请码失败' });
  }
});

// POST /api/admin/invite-codes/batch - 批量生成邀请码
router.post('/batch', async (req, res) => {
  try {
    const { count = 10, type, prefix, maxUses, expiresAt, reason } = req.body;
    if (!type) return res.status(400).json({ error: 'type不能为空' });
    const num = Math.min(parseInt(count) || 10, 100);
    const batchId = 'BATCH-' + Date.now();

    const codes = [];
    for (let i = 0; i < num; i++) {
      let code;
      do {
        code = ((prefix || '') + crypto.randomBytes(4).toString('hex')).toUpperCase();
      } while (await prisma.inviteCode.findUnique({ where: { code } }));

      const created = await prisma.inviteCode.create({
        data: {
          code, type, maxUses: maxUses || 1,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
          batchId,
        }
      });
      codes.push(created);
    }

    await prisma.auditLog.create({
      data: {
        adminId: req.admin?.id || 0,
        action: 'batch_create_invite_codes',
        targetType: 'invite_code',
        targetId: batchId,
        afterValue: JSON.stringify({ batchId, count: num, type }),
        reason: reason || ('批量生成' + num + '个邀请码'),
        riskLevel: 'low',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      }
    });

    res.status(201).json({
      data: { batchId, count: num, codes },
      message: '成功生成' + num + '个邀请码'
    });
  } catch (err) {
    console.error('[InviteCodes] Batch create error:', err);
    res.status(500).json({ error: '批量生成邀请码失败' });
  }
});

// PUT /api/admin/invite-codes/:id
router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = await prisma.inviteCode.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: '邀请码不存在' });

    const { type, maxUses, expiresAt, status, reason } = req.body;
    const beforeValue = { status: existing.status, maxUses: existing.maxUses };
    const updateData = {};
    if (type !== undefined) updateData.type = type;
    if (maxUses !== undefined) updateData.maxUses = maxUses;
    if (expiresAt !== undefined) updateData.expiresAt = expiresAt ? new Date(expiresAt) : null;
    if (status !== undefined) updateData.status = status;

    const code = await prisma.inviteCode.update({ where: { id }, data: updateData });

    await prisma.auditLog.create({
      data: {
        adminId: req.admin?.id || 0,
        action: 'update_invite_code',
        targetType: 'invite_code',
        targetId: String(id),
        beforeValue: JSON.stringify(beforeValue),
        afterValue: JSON.stringify(updateData),
        reason: reason || '更新邀请码',
        riskLevel: 'low',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      }
    });

    res.json({ data: code, message: '邀请码更新成功' });
  } catch (err) {
    console.error('[InviteCodes] Update error:', err);
    res.status(500).json({ error: '更新邀请码失败' });
  }
});

// DELETE /api/admin/invite-codes/:id
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = await prisma.inviteCode.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: '邀请码不存在' });

    await prisma.auditLog.create({
      data: {
        adminId: req.admin?.id || 0,
        action: 'delete_invite_code',
        targetType: 'invite_code',
        targetId: String(id),
        beforeValue: JSON.stringify({ code: existing.code }),
        reason: req.body.reason || '删除邀请码',
        riskLevel: 'low',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      }
    });

    await prisma.inviteCode.delete({ where: { id } });
    res.json({ message: '邀请码已删除' });
  } catch (err) {
    console.error('[InviteCodes] Delete error:', err);
    res.status(500).json({ error: '删除邀请码失败' });
  }
});

export default router;
