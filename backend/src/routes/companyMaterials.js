/**
 * companyMaterials.js — Company sales materials (text + files) CRUD + upload.
 * New file, no modifications to existing routes.
 */
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import { importFromUrl } from '../services/product-import.service.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { authMiddleware } from '../middleware/auth.js';
import { ensureDefaultCategories } from './companyCategories.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();
const prisma = new PrismaClient();

function getAccountId(req) {
  const b = req.body || {};
  return parseInt(req.accountId) || parseInt(req.query.accountId) || parseInt(b.accountId) || 1;
}

// Upload dir: /opt/whatsapp-crm/backend/uploads/company/YYYY-MM
const UPLOAD_BASE = path.resolve(__dirname, '../../uploads/company');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}
ensureDir(UPLOAD_BASE);

// ─── Multer config ───
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const ym = new Date().toISOString().slice(0, 7); // YYYY-MM
    const sub = path.join(UPLOAD_BASE, ym);
    ensureDir(sub);
    cb(null, sub);
  },
  filename: (req, file, cb) => {
    // multipart 中文文件名按 UTF-8 发送但 multer 按 latin1 解码，需还原
    const origName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    file.originalname = origName;
    const rand = Math.random().toString(36).slice(2, 8);
    const ts = Date.now();
    const safeName = origName.replace(/[^\w.\-\u4e00-\u9fa5]/g, '_');
    cb(null, `${ts}-${rand}-${safeName}`);
  }
});

const ALLOWED_MIME = [
  'application/pdf',
  'image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'image/bmp',
  'video/mp4', 'video/quicktime', 'video/webm',
];

function fileFilter(req, file, cb) {
  if (ALLOWED_MIME.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Unsupported file type: ' + file.mimetype));
  }
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max (video); per-type check in handler
});

const BASE_URL = process.env.BASE_URL || '';

function serialize(m) {
  if (!m) return null;
  const out = { ...m };
  if (m.filePath) {
    out.fileUrl = BASE_URL + '/uploads/company/' + m.filePath;
  }
  return out;
}

// ─── Seed default materials on first call ───
const SAMPLE_MATERIALS = [
  {
    category: 'company', title: '公司介绍（样例）', lang: 'zh', type: 'text',
    content: `公司名称：
成立时间：
主营业务：
核心优势：
主要认证：
产能/规模：

（请替换为贵司真实介绍）`
  },
  {
    category: 'product', title: '产品目录（样例）', lang: 'zh', type: 'text',
    content: `产品名称：
型号/规格：
材质/工艺：
价格区间：
最小起订量（MOQ）：
交期：

（请替换为贵司真实产品信息）`
  },
  {
    category: 'payment', title: '付款方式（样例）', lang: 'zh', type: 'text',
    content: `付款条款：
• 30% T/T 定金（订单确认后支付）
• 70% 发货前付清（验货合格后）
• 支持即期信用证（大额订单）

（请替换为贵司真实付款政策）`
  },
];

async function ensureAccountSeed(accountId) {
  try {
    await ensureDefaultCategories(accountId);
    const cnt = await prisma.companyMaterial.count({ where: { accountId } });
    if (cnt > 0) return;
    for (const m of SAMPLE_MATERIALS) {
      await prisma.companyMaterial.create({
        data: { accountId, ...m, isDefault: true, sortOrder: 0 }
      });
    }
    console.log('[companyMaterials] Seeded', SAMPLE_MATERIALS.length, 'sample materials for account', accountId);
  } catch (e) {
    console.error('[companyMaterials] seed error:', e.message);
  }
}
// Seed async (don't block startup)
setTimeout(() => { ensureAccountSeed(1); }, 1000);

// ─── Routes ───

// GET list
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { category } = req.query;
    const where = { accountId: getAccountId(req) };
    if (category && category !== 'all') where.category = category;
    const list = await prisma.companyMaterial.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
    res.json({ success: true, data: list.map(serialize) });
  } catch (e) {
    console.error('[companyMaterials] GET error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET single
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const m = await prisma.companyMaterial.findUnique({ where: { id } });
    if (!m) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: serialize(m) });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST text
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { category, title, content, lang, sortOrder } = req.body || {};
    if (!category || !title || !content) {
      return res.status(400).json({ success: false, error: 'category, title, content are required' });
    }
    const m = await prisma.companyMaterial.create({
      data: {
        type: 'text',
        accountId: getAccountId(req),
        category, title, content,
        lang: lang || 'en',
        sortOrder: parseInt(sortOrder) || 0,
        isDefault: false,
      }
    });
    res.json({ success: true, data: serialize(m) });
  } catch (e) {
    console.error('[companyMaterials] POST error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /import/url — 网址智能提取产品（复用产品知识库的 AI 提取能力）
router.post('/import/url', authMiddleware, async (req, res) => {
  try {
    const { url, note } = req.body || {};
    if (!url) return res.status(400).json({ success: false, error: 'url is required' });
    let parsedUrl;
    try { parsedUrl = new URL(url); } catch { return res.status(400).json({ success: false, error: '无效的网址' }); }
    if (!/^https?:$/.test(parsedUrl.protocol)) return res.status(400).json({ success: false, error: '仅支持 http/https 网址' });

    const result = await importFromUrl(url, note || '');
    const products = result.products || [];
    return res.json({ success: true, data: products, meta: result.meta || null });
  } catch (e) {
    console.error('[companyMaterials] URL import error:', e.message);
    return res.status(500).json({ success: false, error: e.message || '提取失败，请重试' });
  }
});

// POST upload file
router.post('/upload', authMiddleware, (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
    try {
      if (!req.file) return res.status(400).json({ success: false, error: 'file is required' });

      // Per-type size check
      const mt = req.file.mimetype;
      const size = req.file.size;
      if (mt.startsWith('video/') && size > 50 * 1024 * 1024) {
        fs.unlinkSync(req.file.path);
        return res.status(413).json({ success: false, error: 'Video exceeds 50MB' });
      }
      if ((mt.startsWith('image/') || mt === 'application/pdf') && size > 20 * 1024 * 1024) {
        fs.unlinkSync(req.file.path);
        return res.status(413).json({ success: false, error: 'Image/PDF exceeds 20MB' });
      }

      const type = mt.startsWith('image/') ? 'image' : mt.startsWith('video/') ? 'video' : 'pdf';
      const ym = new Date().toISOString().slice(0, 7);
      const relPath = ym + '/' + req.file.filename;
      const { category = 'other', title = req.file.originalname, lang = 'en', sortOrder = 0 } = req.body;

      const m = await prisma.companyMaterial.create({
        data: {
          type, accountId: getAccountId(req), category, title,
          content: req.body.content || '',
          lang,
          fileName: req.file.originalname,
          filePath: relPath,
          fileSize: size,
          mimeType: mt,
          sortOrder: parseInt(sortOrder) || 0,
          isDefault: false,
        }
      });
      res.json({ success: true, data: serialize(m) });
    } catch (e) {
      console.error('[companyMaterials] upload error:', e);
      if (req.file) fs.unlinkSync(req.file.path).catch(()=>{});
      res.status(500).json({ success: false, error: e.message });
    }
  });
});

// PUT update
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = await prisma.companyMaterial.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, error: 'Not found' });

    const { category, title, content, lang, sortOrder } = req.body || {};
    const data = {};
    if (category !== undefined) data.category = category;
    if (title !== undefined) data.title = title;
    if (content !== undefined) data.content = content;
    if (lang !== undefined) data.lang = lang;
    if (sortOrder !== undefined) data.sortOrder = parseInt(sortOrder) || 0;

    const m = await prisma.companyMaterial.update({ where: { id }, data });
    res.json({ success: true, data: serialize(m) });
  } catch (e) {
    console.error('[companyMaterials] PUT error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// DELETE
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = await prisma.companyMaterial.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, error: 'Not found' });
    // Delete file from disk if exists
    if (existing.filePath) {
      const fp = path.join(UPLOAD_BASE, existing.filePath);
      fs.promises.unlink(fp).catch(() => {});
    }
    await prisma.companyMaterial.delete({ where: { id } });
    res.json({ success: true, data: { id } });
  } catch (e) {
    console.error('[companyMaterials] DELETE error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
export { ensureAccountSeed };
