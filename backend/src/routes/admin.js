/**
 * Super Admin API Routes
 * 多租户SaaS超级管理员后台API
 */
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { encrypt, decrypt, isEncrypted } from '../utils/encryption.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();

function requireAdmin(req, res, next) {
  if (!req.userRole || req.userRole.toLowerCase() !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

router.use(authMiddleware, requireAdmin);

function maskApiKey(key) {
  if (!key) return null;
  if (key.length <= 8) return '****';
  return key.substring(0, 4) + '****' + key.substring(key.length - 4);
}

function encryptApiKey(key) {
  if (!key) return null;
  return encrypt(key);
}

function decryptApiKey(encKey) {
  if (!encKey) return null;
  return decrypt(encKey);
}

// GET /api/admin/tenants - 租户列表
router.get('/tenants', async (req, res) => {
  try {
    const { page = 1, pageSize = 20, status, keyword } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(pageSize);
    const take = parseInt(pageSize);

    const where = {};
    if (status) where.status = status;
    if (keyword) {
      where.OR = [
        { name: { contains: keyword } },
        { code: { contains: keyword } },
      ];
    }

    const [tenants, total] = await Promise.all([
      prisma.tenant.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
      prisma.tenant.count({ where }),
    ]);

    const tenantsWithStats = await Promise.all(
      tenants.map(async (tenant) => {
        const userCount = await prisma.user.count({ where: { tenantId: tenant.id } }).catch(() => 0);
        return { ...tenant, userCount };
      })
    );

    res.json({
      data: tenantsWithStats,
      total,
      page: parseInt(page),
      pageSize: parseInt(pageSize),
    });
  } catch (err) {
    console.error('[Admin] Get tenants error:', err);
    res.status(500).json({ error: 'Failed to get tenants' });
  }
});

// GET /api/admin/tenants/:id - 单个租户详情
router.get('/tenants/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const tenant = await prisma.tenant.findUnique({ where: { id } });
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    res.json({ data: tenant });
  } catch (err) {
    console.error('[Admin] Get tenant error:', err);
    res.status(500).json({ error: 'Failed to get tenant' });
  }
});

// POST /api/admin/tenants - 创建租户
router.post('/tenants', async (req, res) => {
  try {
    const { name, code, status = 'active', plan = 'free', balance = 0, adminUserId, config } = req.body;
    if (!name || !code) return res.status(400).json({ error: 'Name and code are required' });

    const existing = await prisma.tenant.findUnique({ where: { code } });
    if (existing) return res.status(400).json({ error: 'Tenant code already exists' });

    const tenant = await prisma.tenant.create({
      data: {
        name, code, status, plan, balance,
        adminUserId: adminUserId || 0,
        config: config ? JSON.stringify(config) : null,
      },
    });

    res.status(201).json({ data: tenant, message: 'Tenant created successfully' });
  } catch (err) {
    console.error('[Admin] Create tenant error:', err);
    res.status(500).json({ error: 'Failed to create tenant' });
  }
});

// PUT /api/admin/tenants/:id - 编辑租户
router.put('/tenants/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, code, status, plan, balance, adminUserId, config } = req.body;

    const existing = await prisma.tenant.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Tenant not found' });

    if (code && code !== existing.code) {
      const codeExists = await prisma.tenant.findUnique({ where: { code } });
      if (codeExists) return res.status(400).json({ error: 'Tenant code already exists' });
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (code !== undefined) updateData.code = code;
    if (status !== undefined) updateData.status = status;
    if (plan !== undefined) updateData.plan = plan;
    if (balance !== undefined) updateData.balance = balance;
    if (adminUserId !== undefined) updateData.adminUserId = adminUserId;
    if (config !== undefined) updateData.config = config ? JSON.stringify(config) : null;

    const tenant = await prisma.tenant.update({ where: { id }, data: updateData });
    res.json({ data: tenant, message: 'Tenant updated successfully' });
  } catch (err) {
    console.error('[Admin] Update tenant error:', err);
    res.status(500).json({ error: 'Failed to update tenant' });
  }
});

// DELETE /api/admin/tenants/:id - 删除租户
router.delete('/tenants/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = await prisma.tenant.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Tenant not found' });

    await prisma.tenant.delete({ where: { id } });
    res.json({ message: 'Tenant deleted successfully' });
  } catch (err) {
    console.error('[Admin] Delete tenant error:', err);
    res.status(500).json({ error: 'Failed to delete tenant' });
  }
});

// GET /api/admin/stats - 系统统计
router.get('/stats', async (req, res) => {
  try {
    const [userCount, tenantCount, messageCount, contactCount, conversationCount, activeTenants] =
      await Promise.all([
        prisma.user.count(),
        prisma.tenant.count(),
        prisma.message.count(),
        prisma.contact.count(),
        prisma.conversation.count(),
        prisma.tenant.count({ where: { status: 'active' } }),
      ]);

    res.json({
      data: {
        users: userCount,
        tenants: tenantCount,
        activeTenants,
        messages: messageCount,
        contacts: contactCount,
        conversations: conversationCount,
      },
    });
  } catch (err) {
    console.error('[Admin] Get stats error:', err);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// GET /api/admin/ai-models - AI模型配置列表
router.get('/ai-models', async (req, res) => {
  try {
    const { tenantId = 0, provider, enabledOnly } = req.query;
    const where = { tenantId: parseInt(tenantId) || 0 };
    if (provider) where.provider = provider;
    if (enabledOnly === 'true') where.isEnabled = true;

    const models = await prisma.aIModelConfig.findMany({
      where,
      orderBy: [{ provider: 'asc' }, { modelName: 'asc' }],
    });

    const maskedModels = models.map((m) => {
      const rawKey = m.apiKey ? (isEncrypted(m.apiKey) ? decryptApiKey(m.apiKey) : m.apiKey) : null;
      return { ...m, apiKey: undefined, apiKeyMasked: maskApiKey(rawKey) };
    });

    res.json({ data: maskedModels });
  } catch (err) {
    console.error('[Admin] Get AI models error:', err);
    res.status(500).json({ error: 'Failed to get AI models' });
  }
});

// POST /api/admin/ai-models - 添加AI模型配置
router.post('/ai-models', async (req, res) => {
  try {
    const { tenantId = 0, provider, modelName, displayName, apiKey, baseUrl, isEnabled = true, config } = req.body;
    if (!provider || !modelName) return res.status(400).json({ error: 'Provider and modelName are required' });

    const model = await prisma.aIModelConfig.create({
      data: {
        tenantId: parseInt(tenantId) || 0,
        provider, modelName,
        displayName: displayName || modelName,
        apiKey: apiKey ? encryptApiKey(apiKey) : null,
        baseUrl: baseUrl || null,
        isEnabled,
        config: config ? JSON.stringify(config) : null,
      },
    });

    res.status(201).json({
      data: { ...model, apiKey: undefined, apiKeyMasked: maskApiKey(apiKey) },
      message: 'AI model config created successfully',
    });
  } catch (err) {
    console.error('[Admin] Create AI model error:', err);
    res.status(500).json({ error: 'Failed to create AI model config' });
  }
});

// PUT /api/admin/ai-models/:id - 更新AI模型配置
router.put('/ai-models/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { provider, modelName, displayName, apiKey, baseUrl, isEnabled, config } = req.body;

    const existing = await prisma.aIModelConfig.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'AI model config not found' });

    const updateData = {};
    if (provider !== undefined) updateData.provider = provider;
    if (modelName !== undefined) updateData.modelName = modelName;
    if (displayName !== undefined) updateData.displayName = displayName;
    if (apiKey !== undefined) updateData.apiKey = apiKey ? encryptApiKey(apiKey) : null;
    if (baseUrl !== undefined) updateData.baseUrl = baseUrl;
    if (isEnabled !== undefined) updateData.isEnabled = isEnabled;
    if (config !== undefined) updateData.config = config ? JSON.stringify(config) : null;

    const model = await prisma.aIModelConfig.update({ where: { id }, data: updateData });
    const finalKey = model.apiKey ? (isEncrypted(model.apiKey) ? decryptApiKey(model.apiKey) : model.apiKey) : null;

    res.json({
      data: { ...model, apiKey: undefined, apiKeyMasked: maskApiKey(finalKey) },
      message: 'AI model config updated successfully',
    });
  } catch (err) {
    console.error('[Admin] Update AI model error:', err);
    res.status(500).json({ error: 'Failed to update AI model config' });
  }
});

// DELETE /api/admin/ai-models/:id - 删除AI模型配置
router.delete('/ai-models/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = await prisma.aIModelConfig.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'AI model config not found' });

    await prisma.aIModelConfig.delete({ where: { id } });
    res.json({ message: 'AI model config deleted successfully' });
  } catch (err) {
    console.error('[Admin] Delete AI model error:', err);
    res.status(500).json({ error: 'Failed to delete AI model config' });
  }
});

export default router;
