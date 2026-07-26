/**
 * Automation API Routes
 */
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import automationService from '../services/automation.service.js';
import { detectCountryFromPhone } from '../services/country-language.js';

const router = Router();
const prisma = new PrismaClient();

// ========== 规则配置 ==========

// 获取所有规则
router.get('/rules', async (req, res) => {
  try {
    const rules = await prisma.automationRule.findMany({
      where: { userId: req.userId },
      orderBy: { type: 'asc' },
    });
    res.json(rules);
  } catch (err) {
    console.error('[Automation] Get rules error:', err);
    res.status(500).json({ error: 'Failed to get rules' });
  }
});

// 初始化默认规则（如果不存在）
router.post('/rules/init', async (req, res) => {
  try {
    const defaults = [
      {
        type: 'weekend_greeting',
        enabled: false,
        schedule: JSON.stringify({ day: 'friday', hour: 14, minute: 0, timezone: 'UTC' }),
        languageMode: 'auto',
        aiPrompt: null,
      },
      {
        type: 'industry_news',
        enabled: false,
        schedule: JSON.stringify({ day: 'monday', hour: 2, minute: 0, timezone: 'UTC' }),
        languageMode: 'auto',
        aiPrompt: null,
      },
      {
        type: 'case_study',
        enabled: false,
        schedule: JSON.stringify({ day: 1, hour: 3, minute: 0, timezone: 'UTC' }),
        languageMode: 'auto',
        aiPrompt: null,
      },
    ];

    const results = [];
    for (const d of defaults) {
      const r = await prisma.automationRule.upsert({
        where: { userId_type: { userId: req.userId, type: d.type } },
        create: { userId: req.userId, ...d },
        update: {},
      });
      results.push(r);
    }
    res.json(results);
  } catch (err) {
    console.error('[Automation] Init rules error:', err);
    res.status(500).json({ error: 'Failed to init rules' });
  }
});

// 更新规则
router.put('/rules/:id', async (req, res) => {
  try {
    const { enabled, schedule, languageMode, defaultLang, aiPrompt } = req.body;
    const rule = await prisma.automationRule.findUnique({
      where: { id: parseInt(req.params.id) },
    });
    if (!rule || rule.userId !== req.userId) {
      return res.status(404).json({ error: 'Rule not found' });
    }
    const updated = await prisma.automationRule.update({
      where: { id: parseInt(req.params.id) },
      data: {
        ...(enabled !== undefined && { enabled }),
        ...(schedule !== undefined && { schedule: typeof schedule === 'string' ? schedule : JSON.stringify(schedule) }),
        ...(languageMode !== undefined && { languageMode }),
        ...(defaultLang !== undefined && { defaultLang }),
        ...(aiPrompt !== undefined && { aiPrompt }),
      },
    });
    res.json(updated);
  } catch (err) {
    console.error('[Automation] Update rule error:', err);
    res.status(500).json({ error: 'Failed to update rule' });
  }
});

// 手动触发规则（立即为客户生成内容）
router.post('/rules/:id/trigger', async (req, res) => {
  try {
    const result = await automationService.triggerRuleNow(parseInt(req.params.id), req.userId);
    res.json(result);
  } catch (err) {
    console.error('[Automation] Trigger error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ========== 客户自动化配置 ==========

// 获取客户自动化配置（哪些客户开了）
router.get('/customers', async (req, res) => {
  try {
    const autoCustomers = await prisma.automationCustomer.findMany({
      where: { userId: req.userId },
      include: { customer: true },
    });

    // 获取所有客户并标注
    const allCustomers = await prisma.customer.findMany({
      where: { userId: req.userId },
      orderBy: { updatedAt: 'desc' },
    });

    // 给没有国家的客户预检测
    const result = allCustomers.map(c => {
      const ac = autoCustomers.find(a => a.customerId === c.id);
      let country = c.country;
      if (!country && c.phone) {
        country = detectCountryFromPhone(c.phone).country;
      }
      return {
        ...c,
        country,
        automation: ac ? {
          enabled: true,
          types: safeJsonParse(ac.types, []),
          customLang: ac.customLang,
        } : { enabled: false, types: [], customLang: null },
      };
    });

    res.json(result);
  } catch (err) {
    console.error('[Automation] Get customers error:', err);
    res.status(500).json({ error: 'Failed to get customers' });
  }
});

// 更新单个客户的自动化配置
router.put('/customers/:customerId', async (req, res) => {
  try {
    const customerId = parseInt(req.params.customerId);
    const { enabled, types, customLang } = req.body;

    if (!enabled) {
      await prisma.automationCustomer.deleteMany({
        where: { userId: req.userId, customerId },
      });
      return res.json({ success: true, enabled: false });
    }

    const ac = await prisma.automationCustomer.upsert({
      where: { userId_customerId: { userId: req.userId, customerId } },
      create: {
        userId: req.userId,
        customerId,
        types: JSON.stringify(types || []),
        customLang: customLang || null,
      },
      update: {
        types: JSON.stringify(types || []),
        customLang: customLang || null,
      },
    });
    res.json(ac);
  } catch (err) {
    console.error('[Automation] Update customer error:', err);
    res.status(500).json({ error: 'Failed to update customer' });
  }
});

// 批量设置客户
router.post('/customers/bulk', async (req, res) => {
  try {
    const { customerIds, types, enabled } = req.body;
    if (!Array.isArray(customerIds)) {
      return res.status(400).json({ error: 'customerIds must be array' });
    }
    for (const cid of customerIds) {
      if (enabled) {
        await prisma.automationCustomer.upsert({
          where: { userId_customerId: { userId: req.userId, customerId: cid } },
          create: { userId: req.userId, customerId: cid, types: JSON.stringify(types || []) },
          update: { types: JSON.stringify(types || []) },
        });
      } else {
        await prisma.automationCustomer.deleteMany({
          where: { userId: req.userId, customerId: cid },
        });
      }
    }
    res.json({ success: true, updated: customerIds.length });
  } catch (err) {
    console.error('[Automation] Bulk update error:', err);
    res.status(500).json({ error: 'Failed to bulk update' });
  }
});

// ========== 待确认队列 ==========

// 获取队列
router.get('/queue', async (req, res) => {
  try {
    const { status, type } = req.query;
    const where = { userId: req.userId };
    if (status) where.status = status;
    if (type) where.type = type;

    const items = await prisma.automationQueueItem.findMany({
      where,
      include: {
        customer: true,
        rule: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    res.json(items);
  } catch (err) {
    console.error('[Automation] Get queue error:', err);
    res.status(500).json({ error: 'Failed to get queue' });
  }
});

// 获取统计
router.get('/stats', async (req, res) => {
  try {
    const [pending, sent, skipped, failed] = await Promise.all([
      prisma.automationQueueItem.count({ where: { userId: req.userId, status: 'pending' } }),
      prisma.automationQueueItem.count({ where: { userId: req.userId, status: 'sent' } }),
      prisma.automationQueueItem.count({ where: { userId: req.userId, status: 'skipped' } }),
      prisma.automationQueueItem.count({ where: { userId: req.userId, status: 'failed' } }),
    ]);
    const enabledRules = await prisma.automationRule.count({ where: { userId: req.userId, enabled: true } });
    const autoCustomerCount = await prisma.automationCustomer.count({ where: { userId: req.userId } });
    res.json({ pending, sent, skipped, failed, enabledRules, autoCustomerCount });
  } catch (err) {
    console.error('[Automation] Stats error:', err);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// 编辑队列项
router.put('/queue/:id', async (req, res) => {
  try {
    const { content } = req.body;
    await automationService.editItem(parseInt(req.params.id), req.userId, content);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 确认发送
router.post('/queue/:id/send', async (req, res) => {
  try {
    const result = await automationService.approveAndSend(parseInt(req.params.id), req.userId);
    res.json(result);
  } catch (err) {
    console.error('[Automation] Send error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 跳过
router.post('/queue/:id/skip', async (req, res) => {
  try {
    await automationService.skipItem(parseInt(req.params.id), req.userId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 批量发送
router.post('/queue/bulk-send', async (req, res) => {
  try {
    const { ids } = req.body;
    const results = [];
    for (const id of ids) {
      try {
        const r = await automationService.approveAndSend(id, req.userId);
        results.push({ id, success: true, ...r });
        await new Promise(r => setTimeout(r, 1500)); // 避免被WA限流
      } catch (e) {
        results.push({ id, success: false, error: e.message });
      }
    }
    res.json({ results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 批量跳过
router.post('/queue/bulk-skip', async (req, res) => {
  try {
    const { ids } = req.body;
    for (const id of ids) {
      await automationService.skipItem(id, req.userId);
    }
    res.json({ success: true, count: ids.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function safeJsonParse(str, def) {
  try { return JSON.parse(str); } catch { return def; }
}

export default router;
