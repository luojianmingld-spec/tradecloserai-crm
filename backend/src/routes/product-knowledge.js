import express from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const router = express.Router();

// 获取产品列表
router.get('/products', async (req, res) => {
  try {
    const accountId = parseInt(req.query.accountId) || 1;
    const products = await prisma.productKnowledgeBase.findMany({
      where: { accountId, isActive: true },
      include: { questions: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data: products });
  } catch (error) {
    console.error('获取产品列表失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取单个产品详情
router.get('/products/:id', async (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    const product = await prisma.productKnowledgeBase.findUnique({
      where: { id: productId },
      include: { questions: { orderBy: { sortOrder: 'asc' } } }
    });
    if (!product) {
      return res.status(404).json({ success: false, error: '产品不存在' });
    }
    res.json({ success: true, data: product });
  } catch (error) {
    console.error('获取产品详情失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 创建产品
router.post('/products', async (req, res) => {
  try {
    const {
      accountId = 1,
      productNameCn,
      productNameEn,
      productDesc,
      productImageUrl,
      pricingUnit,
      basePrice,
      moq,
      deliveryDays,
      paymentTerms,
      questions = []
    } = req.body;

    if (!productNameCn || !productNameEn) {
      return res.status(400).json({ success: false, error: '产品名称不能为空' });
    }

    const product = await prisma.productKnowledgeBase.create({
      data: {
        accountId,
        productNameCn,
        productNameEn,
        productDesc,
        productImageUrl,
        pricingUnit,
        basePrice: basePrice ? parseFloat(basePrice) : null,
        moq: moq || null,
        deliveryDays: deliveryDays || null,
        paymentTerms,
        questions: {
          create: questions.map((q, index) => ({
            questionCn: q.questionCn,
            questionEn: q.questionEn,
            questionType: q.questionType || 'text',
            optionsJson: q.optionsJson ? JSON.stringify(q.optionsJson) : null,
            priority: q.priority || 1,
            sortOrder: q.sortOrder ?? index
          }))
        }
      },
      include: { questions: true }
    });

    res.json({ success: true, data: product });
  } catch (error) {
    console.error('创建产品失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 更新产品
router.put('/products/:id', async (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    console.log('[PUT /products/:id] productId:', productId, 'req.params.id:', req.params.id, 'body keys:', Object.keys(req.body));
    if (isNaN(productId) || productId <= 0) {
      return res.status(400).json({ success: false, error: '无效的产品ID: ' + req.params.id });
    }
    const {
      productNameCn,
      productNameEn,
      productDesc,
      productImageUrl,
      pricingUnit,
      basePrice,
      moq,
      deliveryDays,
      paymentTerms,
      isActive,
      questions = []
    } = req.body;

    // 先删除旧的问题
    await prisma.productQuestion.deleteMany({
      where: { productId }
    });

    // 更新产品信息并重新创建问题
    const product = await prisma.productKnowledgeBase.update({
      where: { id: productId },
      data: {
        productNameCn,
        productNameEn,
        productDesc,
        productImageUrl,
        pricingUnit,
        basePrice: basePrice ? parseFloat(basePrice) : null,
        moq: moq || null,
        deliveryDays: deliveryDays || null,
        paymentTerms,
        isActive,
        questions: {
          create: questions.map((q, index) => ({
            questionCn: q.questionCn,
            questionEn: q.questionEn,
            questionType: q.questionType || 'text',
            optionsJson: Array.isArray(q.optionsJson) ? JSON.stringify(q.optionsJson) : (q.optionsJson || null),
            priority: q.priority || 1,
            sortOrder: q.sortOrder ?? index
          }))
        }
      },
      include: { questions: true }
    });

    res.json({ success: true, data: product });
  } catch (error) {
    console.error('更新产品失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 删除产品（软删除）
router.delete('/products/:id', async (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    
    await prisma.productKnowledgeBase.update({
      where: { id: productId },
      data: { isActive: false }
    });

    res.json({ success: true, message: '产品已删除' });
  } catch (error) {
    console.error('删除产品失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取客户背调信息
router.get('/background-check/:contactId', async (req, res) => {
  try {
    const contactId = parseInt(req.params.contactId);
    const check = await prisma.customerBackgroundCheck.findUnique({
      where: { contactId }
    });
    res.json({ success: true, data: check });
  } catch (error) {
    console.error('获取背调信息失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取客户BANT评分
router.get('/bant-score/:contactId', async (req, res) => {
  try {
    const contactId = parseInt(req.params.contactId);
    const score = await prisma.customerBantScore.findFirst({
      where: { contactId },
      orderBy: { evaluatedAt: 'desc' }
    });
    res.json({ success: true, data: score });
  } catch (error) {
    console.error('获取BANT评分失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});


// ── 智能导入：从URL抓取产品 ──
router.post('/import/url', async (req, res) => {
  try {
    const { url, note } = req.body;
    if (!url) {
      return res.status(400).json({ success: false, error: '请输入网址' });
    }
    
    // Validate URL
    try {
      new URL(url);
    } catch {
      return res.status(400).json({ success: false, error: '网址格式不正确' });
    }
    
    console.log('[ProductImport] URL import request:', url, 'note:', note?.slice(0, 50));
    
    const { importFromUrl } = await import('../services/product-import.service.js');
    const result = await importFromUrl(url, note);
    
    res.json({ success: true, data: result.products, meta: result.meta });
  } catch (error) {
    console.error('[ProductImport] URL import error:', error);
    res.status(500).json({ success: false, error: error.message || '导入失败' });
  }
});

// ── 智能导入：从文件上传 ──
router.post('/import/file', async (req, res) => {
  try {
    // Collect raw body and parse multipart manually
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const buf = Buffer.concat(chunks);
    
    const contentType = req.headers['content-type'] || '';
    const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
    if (!boundaryMatch) throw new Error('无法解析上传文件');
    const boundary = '--' + (boundaryMatch[1] || boundaryMatch[2]);
    const bBuf = Buffer.from(boundary);
    
    let fileData = null;
    let note = req.query.note || '';
    let idx = buf.indexOf(bBuf);
    while (idx !== -1) {
      const nextIdx = buf.indexOf(bBuf, idx + bBuf.length);
      const partEnd = nextIdx === -1 ? buf.length : nextIdx - 2;
      const partStart = idx + bBuf.length + 2;
      if (partStart >= partEnd) { idx = nextIdx; continue; }
      const part = buf.slice(partStart, partEnd);
      const headerEnd = part.indexOf('\r\n\r\n');
      if (headerEnd === -1) { idx = nextIdx; continue; }
      const headerStr = part.slice(0, headerEnd).toString('utf8');
      const body = part.slice(headerEnd + 4);
      const fnMatch = headerStr.match(/filename="([^"]*)"/i);
      const nameMatch = headerStr.match(/name="([^"]*)"/i);
      if (fnMatch) {
        const ctypeMatch = headerStr.match(/content-type:\s*([^\r\n;]+)/i);
        fileData = { fileName: fnMatch[1], mimeType: ctypeMatch ? ctypeMatch[1].trim() : 'application/octet-stream', buffer: body };
      } else if (nameMatch && nameMatch[1] === 'note') {
        note = body.toString('utf8').replace(/\r\n$/, '').trim();
      }
      idx = nextIdx;
    }
    
    if (!fileData) throw new Error('未找到上传文件');
    
    console.log('[ProductImport] File import:', fileData.fileName, fileData.mimeType, 'size:', fileData.buffer.length, 'note:', note.slice(0, 50));
    
    const { importFromFile } = await import('../services/product-import.service.js');
    const result = await importFromFile(fileData.buffer, fileData.mimeType, fileData.fileName, note);
    
    res.json({ success: true, data: result.products, meta: result.meta });
  } catch (error) {
    console.error('[ProductImport] File import error:', error);
    res.status(500).json({ success: false, error: error.message || '导入失败' });
  }
});

// ── 批量导入产品（从AI提取结果入库） ──
router.post('/import/batch-create', async (req, res) => {
  try {
    const { accountId = 1, products = [] } = req.body;
    
    if (!products.length) {
      return res.status(400).json({ success: false, error: '没有要导入的产品' });
    }
    
    const created = [];
    for (const p of products) {
      if (!p.productNameEn) continue;
      
      const product = await prisma.productKnowledgeBase.create({
        data: {
          accountId,
          productNameCn: p.productNameCn || '',
          productNameEn: p.productNameEn,
          productDesc: p.productDesc || '',
          productImageUrl: p.productImageUrl || null,
          pricingUnit: p.pricingUnit || null,
          basePrice: p.basePrice ? parseFloat(p.basePrice) : null,
          moq: p.moq || null,
          deliveryDays: p.deliveryDays || null,
          paymentTerms: p.paymentTerms || null,
          isActive: true,
          questions: {
            create: (p.questions || []).map((q, index) => ({
              questionCn: q.questionCn || '',
              questionEn: q.questionEn || '',
              questionType: q.questionType || 'text',
              optionsJson: q.optionsJson ? (Array.isArray(q.optionsJson) ? JSON.stringify(q.optionsJson) : q.optionsJson) : null,
              priority: q.priority || 1,
              sortOrder: index,
            }))
          }
        },
        include: { questions: true }
      });
      created.push(product);
    }
    
    res.json({ success: true, data: created, count: created.length });
  } catch (error) {
    console.error('[ProductImport] Batch create error:', error);
    res.status(500).json({ success: false, error: error.message || '批量导入失败' });
  }
});

export default router;
