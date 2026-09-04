/**
 * 全球展会 API — TradeShow
 * 展示全球近期展会信息，支持 行业/国家/地区/月份/关键词 筛选与分页
 * 默认仅返回 startDate >= 今天 且 status=published 的展会，按 startDate 升序
 */
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// 可写入的字段清单（用于 create/update 时过滤多余字段）
const WRITABLE = [
  'name', 'nameZh', 'industry', 'region', 'country', 'city',
  'startDate', 'endDate', 'venue', 'organizer', 'website',
  'scale', 'notes', 'source', 'sourceUrl', 'status', 'isActive',
];

function pickFields(body) {
  const data = {};
  for (const k of WRITABLE) {
    if (body[k] !== undefined) data[k] = body[k];
  }
  // 摘要/说明字段兼容：note / summary 统一落到 notes
  if ((data.notes === undefined || data.notes === null || data.notes === '') && body.note !== undefined) {
    data.notes = body.note;
  }
  if ((data.notes === undefined || data.notes === null || data.notes === '') && body.summary !== undefined) {
    data.notes = body.summary;
  }
  // 日期字符串转 Date，非法值置 null
  for (const k of ['startDate', 'endDate']) {
    if (data[k] !== undefined && data[k] !== null && data[k] !== '') {
      const d = new Date(data[k]);
      if (!isNaN(d.getTime())) data[k] = d;
      else data[k] = null;
    } else if (data[k] === '') {
      data[k] = null;
    }
  }
  return data;
}

// ── 列表/检索（支持多维度过滤 + 分页）──────────────────────
router.get('/', async (req, res) => {
  try {
    const accountId = parseInt(req.query.accountId) || 1;
    const { industry, country, region, month, keyword, status, sort, page = 1, pageSize = 20 } = req.query;
    const includePast = req.query.includePast === 'true' || req.query.includePast === '1';

    const conditions = [];
    conditions.push({ accountId });
    // 默认只返回 status=published；显式传 status 则按传入值过滤
    if (status) conditions.push({ status });
    else conditions.push({ status: 'published' });

    if (industry) conditions.push({ industry });
    if (country) conditions.push({ country });
    if (region) conditions.push({ region });

    // 默认只返回未开始的展会（startDate >= 今天）
    if (!includePast) {
      conditions.push({ startDate: { gte: new Date() } });
    }

    // 月份过滤 month=YYYY-MM：展会与当月有重叠（开始/结束落在当月，或横跨当月）
    if (month) {
      const parts = String(month).split('-');
      const y = parseInt(parts[0]);
      const m = parseInt(parts[1]);
      if (y && m >= 1 && m <= 12) {
        const start = new Date(y, m - 1, 1);
        const end = new Date(y, m, 1);
        conditions.push({
          OR: [
            { startDate: { gte: start, lt: end } },
            { endDate: { gte: start, lt: end } },
            { startDate: { lte: start }, endDate: { gte: start } },
          ],
        });
      }
    }

    // 关键词：name/nameZh/venue/city 模糊搜索
    if (keyword) {
      const kw = { contains: String(keyword), mode: 'insensitive' };
      conditions.push({
        OR: [
          { name: kw },
          { nameZh: kw },
          { venue: kw },
          { city: kw },
        ],
      });
    }

    const where = { AND: conditions };
    const take = Math.min(parseInt(pageSize) || 20, 100);
    const skip = ((parseInt(page) || 1) - 1) * take;

    let orderBy = [{ startDate: 'asc' }];
    if (sort === 'date-desc') orderBy = [{ startDate: 'desc' }];
    else if (sort === 'name') orderBy = [{ name: 'asc' }];

    const [items, total] = await Promise.all([
      prisma.tradeShow.findMany({ where, orderBy, skip, take }),
      prisma.tradeShow.count({ where }),
    ]);

    res.json({ success: true, data: items, total, page: parseInt(page) || 1, pageSize: take });
  } catch (error) {
    console.error('[TradeShows] GET / error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── 详情 ───────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const item = await prisma.tradeShow.findUnique({ where: { id } });
    if (!item) return res.status(404).json({ success: false, error: '展会不存在' });
    res.json({ success: true, data: item });
  } catch (error) {
    console.error('[TradeShows] GET /:id error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── 创建 ───────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const body = req.body || {};
    const data = pickFields(body);
    if (!data.name) return res.status(400).json({ success: false, error: '展会名称不能为空' });
    data.accountId = parseInt(body.accountId) || 1;
    if (data.status === undefined) data.status = 'published';
    if (data.isActive === undefined) data.isActive = true;

    const item = await prisma.tradeShow.create({ data });
    res.json({ success: true, data: item });
  } catch (error) {
    console.error('[TradeShows] POST / error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── 更新 ───────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const data = pickFields(req.body || {});
    const item = await prisma.tradeShow.update({ where: { id }, data });
    res.json({ success: true, data: item });
  } catch (error) {
    console.error('[TradeShows] PUT /:id error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── 删除（真删）───────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await prisma.tradeShow.delete({ where: { id } });
    res.json({ success: true, message: '已删除' });
  } catch (error) {
    console.error('[TradeShows] DELETE /:id error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── 批量导入 ───────────────────────────────────────────────
router.post('/import', async (req, res) => {
  try {
    const { items = [], accountId = 1 } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: '没有要导入的数据' });
    }

    const created = [];
    const skipped = [];
    for (const it of items) {
      if (!it || !it.name) { skipped.push({ item: it, reason: '缺少 name' }); continue; }
      const data = pickFields(it);
      if (!data.name) { skipped.push({ item: it, reason: '缺少 name' }); continue; }
      data.accountId = parseInt(it.accountId) || parseInt(accountId) || 1;
      if (data.status === undefined) data.status = 'published';
      if (data.isActive === undefined) data.isActive = true;
      try {
        const item = await prisma.tradeShow.create({ data });
        created.push(item);
      } catch (e) {
        skipped.push({ item: it, reason: e.message });
      }
    }

    res.json({ success: true, data: created, count: created.length, skipped });
  } catch (error) {
    console.error('[TradeShows] POST /import error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
