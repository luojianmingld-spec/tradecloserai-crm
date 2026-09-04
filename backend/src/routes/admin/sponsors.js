/**
 * Sponsors Routes
 * 梦想赞助商管理（候选池/评分/授牌/淘汰/排行）
 */
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// GET /api/admin/sponsors - 赞助商列表
router.get('/', async (req, res) => {
  try {
    const { page = 1, pageSize = 20, status, level, sortBy = 'score', sortOrder = 'desc' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(pageSize);
    const take = parseInt(pageSize);
    const where = {};
    if (status) where.status = status;
    if (level !== undefined) where.level = parseInt(level);
    const allowedSortBy = ['score', 'createdAt', 'updatedAt'];
    const orderField = allowedSortBy.includes(sortBy) ? sortBy : 'score';
    const orderDir = sortOrder === 'asc' ? 'asc' : 'desc';

    const [sponsors, total] = await Promise.all([
      prisma.dreamSponsor.findMany({
        where, skip, take,
        orderBy: { [orderField]: orderDir },
        include: { contributions: true },
      }),
      prisma.dreamSponsor.count({ where }),
    ]);

    res.json({ data: sponsors, total, page: parseInt(page), pageSize: parseInt(pageSize) });
  } catch (err) {
    console.error('[Sponsors] List error:', err);
    res.status(500).json({ error: '获取赞助商列表失败' });
  }
});

// GET /api/admin/sponsors/ranking - 排行榜
router.get('/ranking', async (req, res) => {
  try {
    const { limit = 20, level } = req.query;
    const where = { status: { in: ['active', 'approved'] } };
    if (level !== undefined) where.level = parseInt(level);

    const ranking = await prisma.dreamSponsor.findMany({
      where,
      take: parseInt(limit),
      orderBy: { score: 'desc' },
      include: { contributions: { take: 5, orderBy: { createdAt: 'desc' } } },
    });

    res.json({ data: ranking });
  } catch (err) {
    console.error('[Sponsors] Ranking error:', err);
    res.status(500).json({ error: '获取排行榜失败' });
  }
});

// GET /api/admin/sponsors/:id
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const sponsor = await prisma.dreamSponsor.findUnique({
      where: { id },
      include: { contributions: { orderBy: { createdAt: 'desc' } } },
    });
    if (!sponsor) return res.status(404).json({ error: '赞助商不存在' });
    res.json({ data: sponsor });
  } catch (err) {
    console.error('[Sponsors] Get error:', err);
    res.status(500).json({ error: '获取赞助商详情失败' });
  }
});

// POST /api/admin/sponsors - 添加候选赞助商
router.post('/', async (req, res) => {
  try {
    const { userId, reason } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId不能为空' });

    const existing = await prisma.dreamSponsor.findUnique({ where: { userId: parseInt(userId) } });
    if (existing) return res.status(400).json({ error: '该用户已是赞助商/候选' });

    const sponsor = await prisma.dreamSponsor.create({
      data: { userId: parseInt(userId), status: 'candidate' }
    });

    await prisma.auditLog.create({
      data: {
        adminId: req.admin?.id || 0,
        action: 'add_sponsor_candidate',
        targetType: 'sponsor',
        targetId: String(sponsor.id),
        afterValue: JSON.stringify({ userId }),
        reason: reason || '添加候选赞助商',
        riskLevel: 'low',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      }
    });

    res.status(201).json({ data: sponsor, message: '候选赞助商已添加' });
  } catch (err) {
    console.error('[Sponsors] Create error:', err);
    res.status(500).json({ error: '添加候选赞助商失败' });
  }
});

// PUT /api/admin/sponsors/:id - 更新评分/等级
router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = await prisma.dreamSponsor.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: '赞助商不存在' });

    const { score, scoreDetail, level, status, reviewNote, reason } = req.body;
    const beforeValue = { score: existing.score, level: existing.level, status: existing.status };
    const updateData = {};
    if (score !== undefined) updateData.score = score;
    if (scoreDetail !== undefined) updateData.scoreDetail = JSON.stringify(scoreDetail);
    if (level !== undefined) updateData.level = level;
    if (status !== undefined) updateData.status = status;
    if (reviewNote !== undefined) updateData.reviewNote = reviewNote;
    updateData.reviewerId = req.admin?.id || null;

    const sponsor = await prisma.dreamSponsor.update({ where: { id }, data: updateData });

    await prisma.auditLog.create({
      data: {
        adminId: req.admin?.id || 0,
        action: 'update_sponsor',
        targetType: 'sponsor',
        targetId: String(id),
        beforeValue: JSON.stringify(beforeValue),
        afterValue: JSON.stringify(updateData),
        reason: reason || '更新赞助商',
        riskLevel: 'low',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      }
    });

    res.json({ data: sponsor, message: '赞助商更新成功' });
  } catch (err) {
    console.error('[Sponsors] Update error:', err);
    res.status(500).json({ error: '更新赞助商失败' });
  }
});

// POST /api/admin/sponsors/:id/approve - 授牌/批准
router.post('/:id/approve', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = await prisma.dreamSponsor.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: '赞助商不存在' });

    const { level, expireAt, reason } = req.body;
    const sponsor = await prisma.dreamSponsor.update({
      where: { id },
      data: {
        status: 'active',
        level: level ?? existing.level,
        sponsorSince: new Date(),
        expireAt: expireAt ? new Date(expireAt) : null,
        reviewerId: req.admin?.id || null,
        reviewNote: reason || '授牌批准',
      }
    });

    await prisma.auditLog.create({
      data: {
        adminId: req.admin?.id || 0,
        action: 'approve_sponsor',
        targetType: 'sponsor',
        targetId: String(id),
        afterValue: JSON.stringify({ status: 'active', level: sponsor.level }),
        reason: reason || '授牌批准',
        riskLevel: 'medium',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      }
    });

    res.json({ data: sponsor, message: '赞助商授牌成功' });
  } catch (err) {
    console.error('[Sponsors] Approve error:', err);
    res.status(500).json({ error: '授牌失败' });
  }
});

// POST /api/admin/sponsors/:id/eliminate - 淘汰
router.post('/:id/eliminate', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = await prisma.dreamSponsor.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: '赞助商不存在' });

    const { reason } = req.body;
    const sponsor = await prisma.dreamSponsor.update({
      where: { id },
      data: { status: 'eliminated', reviewNote: reason || '淘汰' }
    });

    await prisma.auditLog.create({
      data: {
        adminId: req.admin?.id || 0,
        action: 'eliminate_sponsor',
        targetType: 'sponsor',
        targetId: String(id),
        beforeValue: JSON.stringify({ status: existing.status }),
        afterValue: JSON.stringify({ status: 'eliminated' }),
        reason: reason || '淘汰赞助商',
        riskLevel: 'high',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      }
    });

    res.json({ data: sponsor, message: '赞助商已淘汰' });
  } catch (err) {
    console.error('[Sponsors] Eliminate error:', err);
    res.status(500).json({ error: '淘汰失败' });
  }
});

// POST /api/admin/sponsors/:id/contribution - 添加贡献记录
router.post('/:id/contribution', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = await prisma.dreamSponsor.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: '赞助商不存在' });

    const { type, value, points, description } = req.body;
    if (!type) return res.status(400).json({ error: '贡献类型不能为空' });

    const contribution = await prisma.sponsorContribution.create({
      data: {
        sponsorId: id,
        type,
        value: value || 0,
        points: points || 0,
        description: description || null,
      }
    });

    // 自动更新总分
    const totalPoints = await prisma.sponsorContribution.aggregate({
      where: { sponsorId: id },
      _sum: { points: true },
    });
    await prisma.dreamSponsor.update({
      where: { id },
      data: { score: totalPoints._sum.points || 0 }
    });

    res.status(201).json({ data: contribution, message: '贡献记录已添加' });
  } catch (err) {
    console.error('[Sponsors] Contribution error:', err);
    res.status(500).json({ error: '添加贡献记录失败' });
  }
});

export default router;
