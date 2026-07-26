/**
 * companyMaterials.js — Company sales materials (text + files) CRUD + upload.
 * New file, no modifications to existing routes.
 */
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { authMiddleware } from '../middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();
const prisma = new PrismaClient();

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
const DEFAULT_MATERIALS = [
  {
    category: 'company', title: 'Company Profile (Brief)', lang: 'en', type: 'text',
    content: `JZJ Glass (金至晶特种玻璃) — Professional Glass Manufacturer Since 2013

Headquartered in Shenzhen with a second production base in Changzhou, China, JZJ Glass is a leading manufacturer of high-performance architectural and industrial glass products.

Our core products:
• Tempered Glass (flat / curved / heat-soaked)
• Laminated Glass (PVB / SGP / acoustic)
• Insulated Glass Units (double / triple glazed, warm-edge)
• Low-E Coated Glass, Fire-rated Glass, Bullet-resistant Glass
• Custom-cut glass for facades, partitions, shower enclosures, balustrades & furniture

Why choose us:
✓ 10+ years of manufacturing & export experience
✓ Certified to CE, CCC, ISO 9001, SGCC, AS/NZS 2208
✓ Dual production bases — combined monthly capacity over 80,000 m²
✓ Strict QC — in-house tempering furnace, autoclave & heat-soak test
✓ Export to 60+ countries across Europe, North America, Middle East, Southeast Asia & Oceania
✓ OEM/ODM welcome; custom sizes, thicknesses, edgework & logos available

We welcome inquiries and factory visits. Contact us for a free quote today.`
  },
  {
    category: 'company', title: '公司介绍（中文简版）', lang: 'zh', type: 'text',
    content: `金至晶特种玻璃（JZJ Glass）—— 始于2013年的专业玻璃制造商

总部位于深圳，在常州设有第二生产基地，是国内高性能建筑及工业玻璃领域的领先制造商。

主营产品：
• 钢化玻璃（平钢化/弯钢化/热浸处理）
• 夹胶玻璃（PVB/SGP/隔音）
• 中空玻璃（双玻/三玻/暖边条）
• Low-E镀膜玻璃、防火玻璃、防弹玻璃
• 幕墙/隔断/淋浴房/护栏/家具等定制玻璃

我们的优势：
✓ 10年以上生产与出口经验
✓ CE、CCC、ISO 9001、SGCC、澳标等多项认证
✓ 双基地生产，月产能超8万平方米
✓ 自有钢化炉、高压釜、热浸测试，严格品控
✓ 产品出口欧洲、北美、中东、东南亚、大洋洲等60+国家
✓ 支持OEM/ODM，可定制尺寸、厚度、磨边、丝印Logo

欢迎咨询报价，欢迎来厂参观。`
  },
  {
    category: 'payment', title: 'Payment Terms (Standard)', lang: 'en', type: 'text',
    content: `Standard Payment Terms:
• 30% T/T deposit upon order confirmation
• 70% balance before shipment (after inspection & copy of B/L)
• L/C at sight (for orders over USD 30,000)
• Western Union / MoneyGram for small sample orders (under USD 500)
• Trade Assurance via Alibaba is also supported

Please confirm the payment method when placing the order. All bank details will be provided on the Proforma Invoice signed & stamped by our company.`
  },
  {
    category: 'payment', title: '付款方式（标准）', lang: 'zh', type: 'text',
    content: `标准付款方式：
• 30% T/T 电汇定金（订单确认后支付）
• 70% 尾款发货前付清（验货合格、提供提单副本后）
• 即期信用证（订单金额超过3万美金可接受）
• 西联汇款 / MoneyGram（样品小单，500美金以下）
• 支持阿里巴巴信保订单

付款方式请在下单时确认，具体银行账户信息以我司盖章PI为准。`
  },
  {
    category: 'logistics', title: 'Shipping & Delivery', lang: 'en', type: 'text',
    content: `Shipping & Delivery Options:

• Sea Freight (FOB Shenzhen / Shanghai / CFR / CIF to your port) — most economical for full containers; lead time 15–35 days depending on destination.
• Air Freight — for urgent small orders; airport-to-airport, 3–7 days.
• Express Courier (DHL / FedEx / UPS) — for samples and documents; door-to-door, 3–5 days.
• LCL (Less than Container Load) — for small batch orders; consolidated container.
• Land transport available for Central Asia / Russia.

Trade Terms: EXW, FOB, CFR, CIF, DAP, DDP (per request).
Standard lead time: 10–20 days after deposit for standard sizes; 20–30 days for custom/large projects.
Packing: seaworthy plywood crates with foam interlayers and protective corner guards; fumigation-free packaging available.`
  },
  {
    category: 'warranty', title: 'Quality Warranty', lang: 'en', type: 'text',
    content: `Quality Warranty Policy:

• Insulated Glass Units (IGU): 5-year warranty against seal failure & internal fogging.
• Tempered Glass / Laminated Glass: 10-year warranty against spontaneous breakage under normal use (excluding NiS inclusion risk — heat-soak tested available).
• Coated / Low-E Glass: 10-year warranty against coating degradation.
• Any defective product confirmed by our QC report (or third-party inspection) will be replaced free of charge in the next shipment, or refunded.

Warranty does not cover: breakage from improper installation, physical impact, extreme thermal stress outside design parameters, or misuse.
We provide after-sales technical support within 24 hours on working days.`
  },
  {
    category: 'other', title: 'Welcome Message', lang: 'en', type: 'text',
    content: `Hi there! 👋

Thank you for contacting JZJ Glass. This is [Your Name] from the sales team. How can I help you today?

Feel free to let me know your requirements — glass type, thickness, size, quantity, and destination port — and I'll get back to you with a quote promptly. 😊`
  },
];

async function seedIfEmpty() {
  try {
    const count = await prisma.companyMaterial.count();
    if (count > 0) return;
    for (const m of DEFAULT_MATERIALS) {
      await prisma.companyMaterial.create({
        data: { ...m, isDefault: true, sortOrder: 0 }
      });
    }
    console.log('[companyMaterials] Seeded', DEFAULT_MATERIALS.length, 'default materials');
  } catch (e) {
    console.error('[companyMaterials] seed error:', e.message);
  }
}
// Seed async (don't block startup)
setTimeout(seedIfEmpty, 1000);

// ─── Routes ───

// GET list
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { category } = req.query;
    const where = {};
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
          type, category, title,
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
export { seedIfEmpty };
