/**
 * companyCategories.js — 公司资料分类管理（租户自建分类 CRUD）
 * 每个租户(accountId)拥有自己的分类；默认预置3个通用样本分类，可增删改。
 */
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();

function getAccountId(req) {
  const b = req.body || {};
  return parseInt(req.accountId) || parseInt(req.query.accountId) || parseInt(b.accountId) || 1;
}

// 3个通用默认分类（租户样本，可改可删）
export const DEFAULT_CATEGORIES = [
  { name: '\u516c\u53f8\u4ecb\u7ecd', icon: '\ud83c\udfe2', refValue: 'company', sortOrder: 0 },
  { name: '\u4ea7\u54c1\u76ee\u5f55', icon: '\ud83d\udce6', refValue: 'product', sortOrder: 1 },
  { name: '\u4ed8\u6b3e\u65b9\u5f0f', icon: '\ud83d\udcb3', refValue: 'payment', sortOrder: 2 },
];

// 确保租户有默认分类（无分类时初始化）
export async function ensureDefaultCategories(accountId) {
  const count = await prisma.companyCategory.count({ where: { accountId } });
  if (count > 0) return false;
  for (const c of DEFAULT_CATEGORIES) {
    await prisma.companyCategory.create({
      data: { accountId, name: c.name, icon: c.icon, refValue: c.refValue, sortOrder: c.sortOrder, isDefault: true }
    });
  }
  console.log('[companyCategories] Seeded ' + DEFAULT_CATEGORIES.length + ' default categories for account ' + accountId);
  return true;
}
setTimeout(() => { ensureDefaultCategories(1).catch(e => console.error('[companyCategories] seed error', e.message)); }, 1000);

// GET 分类列表
router.get('/', authMiddleware, async (req, res) => {
  try {
    const accountId = getAccountId(req);
    await ensureDefaultCategories(accountId);
    const list = await prisma.companyCategory.findMany({
      where: { accountId },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });
    res.json({ success: true, data: list });
  } catch (e) {
    console.error('[companyCategories] GET error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST 新增分类
router.post('/', authMiddleware, async (req, res) => {
  try {
    const accountId = getAccountId(req);
    const { name, icon } = req.body || {};
    if (!name || !String(name).trim()) {
      return res.status(400).json({ success: false, error: '\u5206\u7c7b\u540d\u79f0\u4e0d\u80fd\u4e3a\u7a7a' });
    }
    const refValue = 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const c = await prisma.companyCategory.create({
      data: { accountId, name: String(name).trim(), icon: icon || '\ud83d\udcc1', refValue, sortOrder: 0, isDefault: false }
    });
    res.json({ success: true, data: c });
  } catch (e) {
    console.error('[companyCategories] POST error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// PUT 改名/图标/排序
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, icon, sortOrder } = req.body || {};
    const existing = await prisma.companyCategory.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, error: '\u5206\u7c7b\u4e0d\u5b58\u5728' });
    const data = {};
    if (name !== undefined && String(name).trim()) data.name = String(name).trim();
    if (icon !== undefined) data.icon = icon;
    if (sortOrder !== undefined) data.sortOrder = parseInt(sortOrder) || 0;
    const c = await prisma.companyCategory.update({ where: { id }, data });
    res.json({ success: true, data: c });
  } catch (e) {
    console.error('[companyCategories] PUT error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// DELETE 删除分类（分类下有资料需 force 确认）
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = await prisma.companyCategory.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, error: '\u5206\u7c7b\u4e0d\u5b58\u5728' });
    const materialCount = await prisma.companyMaterial.count({ where: { accountId: existing.accountId, category: existing.refValue } });
    if (materialCount > 0 && req.query.force !== '1') {
      return res.status(409).json({ success: false, error: '\u8be5\u5206\u7c7b\u4e0b\u6709 ' + materialCount + ' \u6761\u8d44\u6599\uff0c\u8bf7\u5148\u5220\u9664\u6216\u79fb\u52a8\u8fd9\u4e9b\u8d44\u6599', count: materialCount });
    }
    if (req.query.force === '1') {
      await prisma.companyMaterial.deleteMany({ where: { accountId: existing.accountId, category: existing.refValue } });
    }
    await prisma.companyCategory.delete({ where: { id } });
    res.json({ success: true });
  } catch (e) {
    console.error('[companyCategories] DELETE error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
