/**
 * Documents API Routes (Quotation / PI MVP)
 */
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { numberToWords } from '../utils/numberToWords.js';
import { generateStructuredPDF, generateQuotePDF } from '../services/pdf-generator.js';

const router = Router();
const prisma = new PrismaClient();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../data');
const SELLER_INFO_PATH = path.join(DATA_DIR, 'seller-info.json');

const DEFAULT_SELLER = {
  companyName: 'Shenzhen Jinzhijing Special Glass Co., Ltd.',
  address: 'Shenzhen, Guangdong, China',
  contact: '',
  phone: '',
  email: 'info@jzjglass.com',
  bankName: '',
  bankAccount: '',
  swiftCode: '',
};

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadSellerInfo() {
  ensureDataDir();
  try {
    if (fs.existsSync(SELLER_INFO_PATH)) {
      const raw = JSON.parse(fs.readFileSync(SELLER_INFO_PATH, 'utf8'));
      return { ...DEFAULT_SELLER, ...raw };
    }
  } catch {}
  return { ...DEFAULT_SELLER };
}

function pad3(n) { return String(n).padStart(3, '0'); }

/**
 * Generate next document number: TYPE-YYYYMMDD-001 (counter for today)
 */
async function nextDocNumber(type) {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  const prefix = `${type}-${y}${m}${d}-`;

  const startOfDay = new Date(y, today.getMonth(), today.getDate());
  const endOfDay = new Date(y, today.getMonth(), today.getDate() + 1);
  const todayDocs = await prisma.document.findMany({
    where: {
      type,
      issueDate: { gte: startOfDay, lt: endOfDay },
    },
    select: { docNumber: true },
  });
  let maxSeq = 0;
  for (const d0 of todayDocs) {
    const m0 = d0.docNumber.match(new RegExp('^' + prefix.replace(/-/g, '\\-') + '(\\d+)$'));
    if (m0) maxSeq = Math.max(maxSeq, parseInt(m0[1]));
  }
  // Also scan any docNumber starting with prefix (in case issueDate differs)
  const allWithPrefix = await prisma.document.findMany({
    where: { docNumber: { startsWith: prefix } },
    select: { docNumber: true },
  });
  for (const d0 of allWithPrefix) {
    const m0 = d0.docNumber.match(new RegExp('^' + prefix.replace(/-/g, '\\-') + '(\\d+)$'));
    if (m0) maxSeq = Math.max(maxSeq, parseInt(m0[1]));
  }
  return prefix + pad3(maxSeq + 1);
}

// GET next number
router.get('/next-number', async (req, res) => {
  try {
    const type = (req.query.type || 'PI').toUpperCase();
    if (!['PI', 'QUOTATION'].includes(type)) {
      return res.status(400).json({ error: 'type must be PI or QUOTATION' });
    }
    const docNumber = await nextDocNumber(type);
    res.json({ docNumber });
  } catch (err) {
    console.error('[Documents] next-number error:', err);
    res.status(500).json({ error: 'Failed to generate doc number' });
  }
});

// Helper: serialize document with items
async function serializeDoc(doc) {
  if (!doc) return null;
  const items = doc.items || await prisma.documentItem.findMany({
    where: { documentId: doc.id },
    orderBy: { sortOrder: 'asc' },
  });
  return {
    ...doc,
    sellerInfo: typeof doc.sellerInfo === 'string' ? JSON.parse(doc.sellerInfo) : doc.sellerInfo,
    buyerInfo: typeof doc.buyerInfo === 'string' ? JSON.parse(doc.buyerInfo) : doc.buyerInfo,
    items,
  };
}

function computeTotals(items) {
  let total = 0;
  const normalized = (items || []).map((it, idx) => {
    const qty = Number(it.quantity) || 0;
    const price = Number(it.unitPrice) || 0;
    const amount = Math.round(qty * price * 100) / 100;
    total += amount;
    return {
      sortOrder: idx,
      productName: it.productName || '',
      model: it.model || '',
      spec: it.spec || '',
      quantity: qty,
      unit: it.unit || 'pcs',
      unitPrice: price,
      amount,
      remark: it.remark || '',
    };
  });
  total = Math.round(total * 100) / 100;
  return { items: normalized, total };
}

router.get('/seller-info', (req, res) => {
  res.json(loadSellerInfo());
});

router.put('/seller-info', (req, res) => {
  try {
    ensureDataDir();
    const curr = loadSellerInfo();
    const updated = { ...curr, ...(req.body || {}) };
    fs.writeFileSync(SELLER_INFO_PATH, JSON.stringify(updated, null, 2), 'utf8');
    res.json(updated);
  } catch (err) {
    console.error('[Documents] save seller info error:', err);
    res.status(500).json({ error: 'Failed to save seller info' });
  }
});

// Create document
router.post('/', async (req, res) => {
  try {
    const userId = req.userId || 1;
    const body = req.body || {};
    const type = (body.type || 'PI').toUpperCase();
    if (!['PI', 'QUOTATION'].includes(type)) {
      return res.status(400).json({ error: 'type must be PI or QUOTATION' });
    }

    const { items: rawItems, total } = computeTotals(body.items || []);
    if (total <= 0) {
      return res.status(400).json({ error: '请至少添加一个产品' });
    }

    const currency = body.currency || 'USD';
    const docNumber = body.docNumber || await nextDocNumber(type);
    const issueDate = body.issueDate ? new Date(body.issueDate) : new Date();
    let validUntil = null;
    if (body.validUntil) validUntil = new Date(body.validUntil);
    else if (type === 'QUOTATION') {
      const d = new Date(issueDate); d.setDate(d.getDate() + 30); validUntil = d;
    }

    // buyerInfo: if empty build from customer
    let buyerInfo = body.buyerInfo || {};
    if (!buyerInfo.companyName && body.customerId) {
      const cust = await prisma.customer.findUnique({ where: { id: parseInt(body.customerId) } });
      if (cust) {
        buyerInfo = {
          companyName: cust.companyName || cust.company || cust.name || '',
          address: cust.address || '',
          contactName: cust.contactName || cust.name || '',
          phone: cust.phone || (cust.jid ? cust.jid.split('@')[0] : ''),
          email: cust.email || '',
          country: cust.country || '',
        };
      }
    }

    const sellerInfo = body.sellerInfo || loadSellerInfo();

    const title = body.title || (type === 'PI' ? 'Proforma Invoice' : 'Quotation');

    const created = await prisma.document.create({
      data: {
        userId,
        customerId: body.customerId ? parseInt(body.customerId) : null,
        customerJid: body.customerJid || null,
        type,
        docNumber,
        title,
        issueDate,
        validUntil,
        currency,
        totalAmount: total,
        amountInWords: numberToWords(total, currency),
        status: body.status || 'DRAFT',
        sellerInfo,
        buyerInfo,
        tradeTerm: body.tradeTerm || 'FOB',
        paymentTerm: body.paymentTerm || 'T/T 30% deposit, 70% before shipment',
        portOfLoading: body.portOfLoading || 'Shenzhen, China',
        portOfDest: body.portOfDest || '',
        shipDate: body.shipDate || '',
        remarks: body.remarks || (type === 'PI'
          ? 'Please confirm this PI and arrange the deposit. Bank charges outside China are for buyer\'s account.'
          : 'This quotation is valid for 30 days from the date of issue.'),
        items: {
          create: rawItems,
        },
      },
      include: { items: true },
    });

    res.status(201).json(await serializeDoc(created));
  } catch (err) {
    console.error('[Documents] Create error:', err);
    res.status(500).json({ error: 'Failed to create document: ' + err.message });
  }
});

// Get document
router.get('/:id', async (req, res) => {
  try {
    const doc = await prisma.document.findUnique({
      where: { id: req.params.id },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    res.json(await serializeDoc(doc));
  } catch (err) {
    console.error('[Documents] Get error:', err);
    res.status(500).json({ error: 'Failed to get document' });
  }
});

// Update document
router.put('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const existing = await prisma.document.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Document not found' });

    const body = req.body || {};
    const { items: rawItems, total } = computeTotals(body.items || []);
    if (total <= 0) {
      return res.status(400).json({ error: '请至少添加一个产品' });
    }
    const currency = body.currency || existing.currency;

    const data = {
      title: body.title !== undefined ? body.title : existing.title,
      issueDate: body.issueDate ? new Date(body.issueDate) : existing.issueDate,
      validUntil: body.validUntil ? new Date(body.validUntil) : (body.validUntil === null ? null : existing.validUntil),
      currency,
      totalAmount: total,
      amountInWords: numberToWords(total, currency),
      status: body.status || existing.status,
      sellerInfo: body.sellerInfo || existing.sellerInfo,
      buyerInfo: body.buyerInfo || existing.buyerInfo,
      tradeTerm: body.tradeTerm !== undefined ? body.tradeTerm : existing.tradeTerm,
      paymentTerm: body.paymentTerm !== undefined ? body.paymentTerm : existing.paymentTerm,
      portOfLoading: body.portOfLoading !== undefined ? body.portOfLoading : existing.portOfLoading,
      portOfDest: body.portOfDest !== undefined ? body.portOfDest : existing.portOfDest,
      shipDate: body.shipDate !== undefined ? body.shipDate : existing.shipDate,
      remarks: body.remarks !== undefined ? body.remarks : existing.remarks,
    };
    if (body.customerJid !== undefined) data.customerJid = body.customerJid;

    // Replace items: delete all, re-create
    await prisma.documentItem.deleteMany({ where: { documentId: id } });
    for (const it of rawItems) {
      await prisma.documentItem.create({
        data: { documentId: id, ...it },
      });
    }

    const updated = await prisma.document.update({
      where: { id },
      data,
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });
    res.json(await serializeDoc(updated));
  } catch (err) {
    console.error('[Documents] Update error:', err);
    res.status(500).json({ error: 'Failed to update document: ' + err.message });
  }
});

// Delete document
router.delete('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const existing = await prisma.document.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Document not found' });
    await prisma.documentItem.deleteMany({ where: { documentId: id } });
    await prisma.document.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    console.error('[Documents] Delete error:', err);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

// Duplicate
router.post('/:id/duplicate', async (req, res) => {
  try {
    const id = req.params.id;
    const src = await prisma.document.findUnique({
      where: { id },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!src) return res.status(404).json({ error: 'Document not found' });

    const newNumber = await nextDocNumber(src.type);
    const dup = await prisma.document.create({
      data: {
        userId: src.userId,
        customerId: src.customerId,
        customerJid: src.customerJid,
        type: src.type,
        docNumber: newNumber,
        title: src.title + ' (Copy)',
        issueDate: new Date(),
        validUntil: src.validUntil,
        currency: src.currency,
        totalAmount: src.totalAmount,
        amountInWords: src.amountInWords,
        status: 'DRAFT',
        sellerInfo: src.sellerInfo,
        buyerInfo: src.buyerInfo,
        tradeTerm: src.tradeTerm,
        paymentTerm: src.paymentTerm,
        portOfLoading: src.portOfLoading,
        portOfDest: src.portOfDest,
        shipDate: src.shipDate,
        remarks: src.remarks,
        items: {
          create: src.items.map(it => ({
            sortOrder: it.sortOrder,
            productName: it.productName,
            model: it.model,
            spec: it.spec,
            quantity: it.quantity,
            unit: it.unit,
            unitPrice: it.unitPrice,
            amount: it.amount,
            remark: it.remark,
          })),
        },
      },
      include: { items: true },
    });
    res.json(await serializeDoc(dup));
  } catch (err) {
    console.error('[Documents] Duplicate error:', err);
    res.status(500).json({ error: 'Failed to duplicate document' });
  }
});

// GET seller info (endpoint /api/settings/seller-info is also served here via direct read)
// PUT seller info


// Export document as PDF
router.get('/:id/pdf', async (req, res) => {
  try {
    const doc = await prisma.document.findUnique({
      where: { id: req.params.id },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    
    const result = await generateQuotePDF(doc);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[Documents] PDF export error:', err);
    res.status(500).json({ error: 'PDF generation failed: ' + err.message });
  }
});

// Generate PDF from AI assistant structured content
router.post('/generate-pdf', async (req, res) => {
  try {
    const { title, subtitle, sections, options } = req.body;
    const result = await generateStructuredPDF({ title, subtitle, sections, options });
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[Documents] Generate PDF error:', err);
    res.status(500).json({ error: 'PDF generation failed: ' + err.message });
  }
});

export default router;
