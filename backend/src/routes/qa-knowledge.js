/**
 * 问答知识库 API — QAKnowledge
 * 供话术库/各沟通渠道按场景召回外贸问答知识
 * 检索维度：scene(场景) / industry(行业) / productLine(产品) / category(分类) / keyword(关键词)
 */
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// ── 检索/列表（支持多维度过滤）──────────────────────────────
router.get('/', async (req, res) => {
  try {
    const accountId = parseInt(req.query.accountId) || 1;
    const { scene, industry, productLine, category, keyword, status, isActive, page = 1, limit = 20 } = req.query;

    const where = { accountId };
    if (scene) where.scene = scene;
    if (industry) where.industry = industry;
    if (productLine) where.productLine = productLine;
    if (category) where.category = category;
    if (status) where.status = status;
    if (isActive !== undefined) where.isActive = isActive === 'true' || isActive === true || isActive === 1;
    if (keyword) {
      where.OR = [
        { question: { contains: keyword, mode: 'insensitive' } },
        { answer: { contains: keyword, mode: 'insensitive' } },
        { questionEn: { contains: keyword, mode: 'insensitive' } },
        { answerEn: { contains: keyword, mode: 'insensitive' } },
        { tags: { contains: keyword, mode: 'insensitive' } },
        { industry: { contains: keyword, mode: 'insensitive' } },
        { productLine: { contains: keyword, mode: 'insensitive' } },
      ];
    }

    const take = Math.min(parseInt(limit) || 20, 100);
    const skip = ((parseInt(page) || 1) - 1) * take;

    const [items, total] = await Promise.all([
      prisma.qAKnowledge.findMany({
        where,
        orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
        skip,
        take,
      }),
      prisma.qAKnowledge.count({ where }),
    ]);

    res.json({ success: true, data: items, total, page: parseInt(page) || 1, limit: take });
  } catch (error) {
    console.error('[QAKnowledge] GET / error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── 详情 ───────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const item = await prisma.qAKnowledge.findUnique({ where: { id } });
    if (!item) return res.status(404).json({ success: false, error: '记录不存在' });
    res.json({ success: true, data: item });
  } catch (error) {
    console.error('[QAKnowledge] GET /:id error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── 创建 ───────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { accountId = 1, question, questionEn, answer, answerEn, category, scene, industry, productLine, tags, source, status, isActive } = req.body;
    if (!question || !answer) return res.status(400).json({ success: false, error: '问题和答案不能为空' });

    const item = await prisma.qAKnowledge.create({
      data: {
        accountId,
        question,
        questionEn: questionEn || null,
        answer,
        answerEn: answerEn || null,
        category: category || 'general',
        scene: scene || null,
        industry: industry || null,
        productLine: productLine || null,
        tags: Array.isArray(tags) ? tags.join(',') : (tags || null),
        source: source || null,
        status: status || 'published',
        isActive: isActive !== undefined ? isActive : true,
      },
    });
    res.json({ success: true, data: item });
  } catch (error) {
    console.error('[QAKnowledge] POST / error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── 更新 ───────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { question, questionEn, answer, answerEn, category, scene, industry, productLine, tags, source, status, isActive } = req.body;
    const data = {};
    if (question !== undefined) data.question = question;
    if (questionEn !== undefined) data.questionEn = questionEn;
    if (answer !== undefined) data.answer = answer;
    if (answerEn !== undefined) data.answerEn = answerEn;
    if (category !== undefined) data.category = category;
    if (scene !== undefined) data.scene = scene;
    if (industry !== undefined) data.industry = industry;
    if (productLine !== undefined) data.productLine = productLine;
    if (tags !== undefined) data.tags = Array.isArray(tags) ? tags.join(',') : tags;
    if (source !== undefined) data.source = source;
    if (status !== undefined) data.status = status;
    if (isActive !== undefined) data.isActive = isActive;

    const item = await prisma.qAKnowledge.update({ where: { id }, data });
    res.json({ success: true, data: item });
  } catch (error) {
    console.error('[QAKnowledge] PUT /:id error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── 删除 ───────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await prisma.qAKnowledge.delete({ where: { id } });
    res.json({ success: true, message: '已删除' });
  } catch (error) {
    console.error('[QAKnowledge] DELETE /:id error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── 批量导入 ───────────────────────────────────────────────
router.post('/import', async (req, res) => {
  try {
    const { accountId = 1, items = [], mode = 'insert' } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: '没有要导入的数据' });
    }

    const created = [];
    const skipped = [];
    for (const it of items) {
      if (!it.question || !it.answer) { skipped.push({ item: it, reason: '缺少question或answer' }); continue; }

      if (mode === 'upsert' && it.id) {
        const exists = await prisma.qAKnowledge.findUnique({ where: { id: parseInt(it.id) } });
        if (exists) {
          const updated = await prisma.qAKnowledge.update({
            where: { id: exists.id },
            data: {
              question: it.question, answer: it.answer,
              questionEn: it.questionEn !== undefined ? it.questionEn : exists.questionEn,
              answerEn: it.answerEn !== undefined ? it.answerEn : exists.answerEn,
              category: it.category || exists.category,
              scene: it.scene !== undefined ? it.scene : exists.scene,
              industry: it.industry !== undefined ? it.industry : exists.industry,
              productLine: it.productLine !== undefined ? it.productLine : exists.productLine,
              tags: it.tags ? (Array.isArray(it.tags) ? it.tags.join(',') : it.tags) : exists.tags,
              source: it.source !== undefined ? it.source : exists.source,
              status: it.status || exists.status,
              isActive: it.isActive !== undefined ? it.isActive : exists.isActive,
            },
          });
          created.push(updated);
          continue;
        }
      }

      const item = await prisma.qAKnowledge.create({
        data: {
          accountId,
          question: it.question,
          questionEn: it.questionEn || null,
          answer: it.answer,
          answerEn: it.answerEn || null,
          category: it.category || 'general',
          scene: it.scene || null,
          industry: it.industry || null,
          productLine: it.productLine || null,
          tags: it.tags ? (Array.isArray(it.tags) ? it.tags.join(',') : it.tags) : null,
          source: it.source || null,
          status: it.status || 'published',
          isActive: it.isActive !== undefined ? it.isActive : true,
        },
      });
      created.push(item);
    }

    res.json({ success: true, data: created, count: created.length, skipped });
  } catch (error) {
    console.error('[QAKnowledge] POST /import error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
