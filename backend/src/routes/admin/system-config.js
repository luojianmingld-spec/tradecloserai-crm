/**
 * System Config Routes
 * 系统配置CRUD
 */
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// GET /api/admin/system-config
router.get('/', async (req, res) => {
  try {
    const { type, keyword } = req.query;
    const where = {};
    if (type) where.type = type;
    if (keyword) {
      where.OR = [
        { key: { contains: keyword } },
        { description: { contains: keyword } },
      ];
    }
    const configs = await prisma.systemConfig.findMany({
      where,
      orderBy: { key: 'asc' },
    });
    res.json({ data: configs });
  } catch (err) {
    console.error('[SystemConfig] List error:', err);
    res.status(500).json({ error: '获取系统配置失败' });
  }
});

// GET /api/admin/system-config/:key - 获取单个配置
router.get('/:key', async (req, res) => {
  try {
    const config = await prisma.systemConfig.findUnique({ where: { key: req.params.key } });
    if (!config) return res.status(404).json({ error: '配置不存在' });
    res.json({ data: config });
  } catch (err) {
    console.error('[SystemConfig] Get error:', err);
    res.status(500).json({ error: '获取配置失败' });
  }
});

// PUT /api/admin/system-config/:key - 更新/创建配置
router.put('/:key', async (req, res) => {
  try {
    const key = req.params.key;
    const { value, type, description, reason } = req.body;
    if (value === undefined) return res.status(400).json({ error: 'value不能为空' });

    const existing = await prisma.systemConfig.findUnique({ where: { key } });
    const beforeValue = existing ? existing.value : null;

    let config;
    if (existing) {
      const updateData = { value: String(value), updatedBy: req.admin?.id || null };
      if (type !== undefined) updateData.type = type;
      if (description !== undefined) updateData.description = description;
      config = await prisma.systemConfig.update({ where: { key }, data: updateData });
    } else {
      config = await prisma.systemConfig.create({
        data: {
          key,
          value: String(value),
          type: type || 'string',
          description: description || null,
          updatedBy: req.admin?.id || null,
        }
      });
    }

    await prisma.auditLog.create({
      data: {
        adminId: req.admin?.id || 0,
        action: existing ? 'update_config' : 'create_config',
        targetType: 'system_config',
        targetId: key,
        beforeValue: beforeValue ? JSON.stringify({ value: beforeValue }) : null,
        afterValue: JSON.stringify({ value: String(value) }),
        reason: reason || (existing ? '更新' : '创建') + '配置 ' + key,
        riskLevel: 'medium',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      }
    });

    res.json({ data: config, message: existing ? '配置已更新' : '配置已创建' });
  } catch (err) {
    console.error('[SystemConfig] Upsert error:', err);
    res.status(500).json({ error: '更新配置失败' });
  }
});

// DELETE /api/admin/system-config/:key
router.delete('/:key', async (req, res) => {
  try {
    const key = req.params.key;
    const existing = await prisma.systemConfig.findUnique({ where: { key } });
    if (!existing) return res.status(404).json({ error: '配置不存在' });

    await prisma.auditLog.create({
      data: {
        adminId: req.admin?.id || 0,
        action: 'delete_config',
        targetType: 'system_config',
        targetId: key,
        beforeValue: JSON.stringify({ value: existing.value }),
        reason: req.body.reason || '删除配置 ' + key,
        riskLevel: 'high',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      }
    });

    await prisma.systemConfig.delete({ where: { key } });
    res.json({ message: '配置已删除' });
  } catch (err) {
    console.error('[SystemConfig] Delete error:', err);
    res.status(500).json({ error: '删除配置失败' });
  }
});

export default router;
