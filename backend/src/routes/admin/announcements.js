/**
 * Announcements Routes
 * 公告管理
 */
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// GET /api/admin/announcements
router.get('/', async (req, res) => {
  try {
    const { page = 1, pageSize = 20, status, keyword } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(pageSize);
    const take = parseInt(pageSize);
    const where = {};
    if (status) where.status = status;
    if (keyword) {
      where.OR = [
        { title: { contains: keyword } },
        { content: { contains: keyword } },
      ];
    }
    const [announcements, total] = await Promise.all([
      prisma.announcement.findMany({
        where, skip, take,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.announcement.count({ where }),
    ]);
    res.json({ data: announcements, total, page: parseInt(page), pageSize: parseInt(pageSize) });
  } catch (err) {
    console.error('[Announcements] List error:', err);
    res.status(500).json({ error: '获取公告列表失败' });
  }
});

// POST /api/admin/announcements
router.post('/', async (req, res) => {
  try {
    const { title, content, targetScope, targetValue, scheduledAt, status, reason } = req.body;
    if (!title || !content) return res.status(400).json({ error: '标题和内容不能为空' });

    const announcement = await prisma.announcement.create({
      data: {
        title, content,
        targetScope: targetScope || 'all',
        targetValue: targetValue ? JSON.stringify(targetValue) : null,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        status: status || 'draft',
        createdBy: req.admin?.id || 0,
      }
    });

    await prisma.auditLog.create({
      data: {
        adminId: req.admin?.id || 0,
        action: 'create_announcement',
        targetType: 'announcement',
        targetId: String(announcement.id),
        afterValue: JSON.stringify({ title, status: announcement.status }),
        reason: reason || '创建公告',
        riskLevel: 'low',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      }
    });

    res.status(201).json({ data: announcement, message: '公告创建成功' });
  } catch (err) {
    console.error('[Announcements] Create error:', err);
    res.status(500).json({ error: '创建公告失败' });
  }
});

// GET /api/admin/announcements/:id
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const announcement = await prisma.announcement.findUnique({ where: { id } });
    if (!announcement) return res.status(404).json({ error: '公告不存在' });
    res.json({ data: announcement });
  } catch (err) {
    console.error('[Announcements] Get error:', err);
    res.status(500).json({ error: '获取公告详情失败' });
  }
});

// PUT /api/admin/announcements/:id
router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = await prisma.announcement.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: '公告不存在' });

    const { title, content, targetScope, targetValue, scheduledAt, status, reason } = req.body;
    const beforeValue = { title: existing.title, status: existing.status };
    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (content !== undefined) updateData.content = content;
    if (targetScope !== undefined) updateData.targetScope = targetScope;
    if (targetValue !== undefined) updateData.targetValue = targetValue ? JSON.stringify(targetValue) : null;
    if (scheduledAt !== undefined) updateData.scheduledAt = scheduledAt ? new Date(scheduledAt) : null;
    if (status !== undefined) updateData.status = status;

    const announcement = await prisma.announcement.update({ where: { id }, data: updateData });

    await prisma.auditLog.create({
      data: {
        adminId: req.admin?.id || 0,
        action: 'update_announcement',
        targetType: 'announcement',
        targetId: String(id),
        beforeValue: JSON.stringify(beforeValue),
        afterValue: JSON.stringify(updateData),
        reason: reason || '更新公告',
        riskLevel: 'low',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      }
    });

    res.json({ data: announcement, message: '公告更新成功' });
  } catch (err) {
    console.error('[Announcements] Update error:', err);
    res.status(500).json({ error: '更新公告失败' });
  }
});

// DELETE /api/admin/announcements/:id
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = await prisma.announcement.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: '公告不存在' });

    await prisma.auditLog.create({
      data: {
        adminId: req.admin?.id || 0,
        action: 'delete_announcement',
        targetType: 'announcement',
        targetId: String(id),
        beforeValue: JSON.stringify({ title: existing.title }),
        reason: req.body.reason || '删除公告',
        riskLevel: 'low',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      }
    });

    await prisma.announcement.delete({ where: { id } });
    res.json({ message: '公告已删除' });
  } catch (err) {
    console.error('[Announcements] Delete error:', err);
    res.status(500).json({ error: '删除公告失败' });
  }
});

// POST /api/admin/announcements/:id/publish - 发布公告
router.post('/:id/publish', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = await prisma.announcement.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: '公告不存在' });

    if (existing.status === 'published') {
      return res.status(400).json({ error: '公告已发布' });
    }

    const announcement = await prisma.announcement.update({
      where: { id },
      data: { status: 'published', publishedAt: new Date() }
    });

    await prisma.auditLog.create({
      data: {
        adminId: req.admin?.id || 0,
        action: 'publish_announcement',
        targetType: 'announcement',
        targetId: String(id),
        afterValue: JSON.stringify({ status: 'published' }),
        reason: '发布公告',
        riskLevel: 'low',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      }
    });

    res.json({ data: announcement, message: '公告已发布' });
  } catch (err) {
    console.error('[Announcements] Publish error:', err);
    res.status(500).json({ error: '发布公告失败' });
  }
});

export default router;
