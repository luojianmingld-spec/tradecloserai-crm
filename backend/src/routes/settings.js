/**
 * Settings API Routes
 */
import { Router } from 'express';
import { authMiddleware as auth } from '../middleware/auth.js';
import { getAISettings, updateSettings, updateSetting, getAvailableModels } from '../services/ai.service.js';
import { getProviders, getActiveProvider, testConnection } from '../services/ai-client.js';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();
const USER_ID = 1;

// Helper: mask API key
function maskApiKey(key) {
  if (!key || key.length <= 8) return '****';
  return key.substring(0, 4) + '****' + key.substring(key.length - 4);
}

// Helper: read/write providers from settings
async function readProviders() {
  const setting = await prisma.setting.findUnique({
    where: { userId_key: { userId: USER_ID, key: 'ai_providers' } },
  });
  if (!setting || !setting.value) return [];
  try { return JSON.parse(setting.value); } catch { return []; }
}

async function writeProviders(providers) {
  await prisma.setting.upsert({
    where: { userId_key: { userId: USER_ID, key: 'ai_providers' } },
    create: { userId: USER_ID, key: 'ai_providers', value: JSON.stringify(providers) },
    update: { value: JSON.stringify(providers) },
  });
}

async function readActiveId() {
  const setting = await prisma.setting.findUnique({
    where: { userId_key: { userId: USER_ID, key: 'ai_active_id' } },
  });
  return setting?.value || null;
}

async function writeActiveId(id) {
  await prisma.setting.upsert({
    where: { userId_key: { userId: USER_ID, key: 'ai_active_id' } },
    create: { userId: USER_ID, key: 'ai_active_id', value: id },
    update: { value: id },
  });
}

// ─── Existing endpoints ───

// GET /api/settings
router.get('/', auth, async (req, res) => {
  try {
    const settings = await getAISettings(req.userId);
    res.json(settings);
  } catch (err) {
    console.error('[Settings GET Error]', err);
    res.status(500).json({ error: '获取设置失败' });
  }
});

// PUT /api/settings
router.put('/', auth, async (req, res) => {
  try {
    await updateSettings(req.userId, req.body);
    const settings = await getAISettings(req.userId);
    res.json(settings);
  } catch (err) {
    console.error('[Settings PUT Error]', err);
    res.status(500).json({ error: '更新设置失败' });
  }
});

// GET /api/settings/ai
router.get('/ai', auth, async (req, res) => {
  try {
    const userId = req.userId;
    const settings = await getAISettings(userId);
    const models = getAvailableModels();
    const providers = await readProviders();
    const activeId = await readActiveId();
    const activeProvider = providers.find(p => p.id === activeId) || providers.find(p => p.isDefault) || providers[0] || null;
    res.json({ settings, models, providers: providers.map(p => ({ ...p, apiKey: maskApiKey(p.apiKey) })), activeId });
  } catch (err) {
    console.error('[AI Settings GET Error]', err);
    res.status(500).json({ error: '获取 AI 设置失败' });
  }
});

// PUT /api/settings/ai
router.put('/ai', auth, async (req, res) => {
  try {
    const allowedKeys = ['aiModel', 'translationEnabled', 'translationEngine', 'translationTargetLang', 'translationAutoSend'];
    const updates = {};
    for (const key of allowedKeys) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    const userId = req.userId;
    await updateSettings(userId, updates);
    const settings = await getAISettings(userId);
    const models = getAvailableModels();
    res.json({ settings, models });
  } catch (err) {
    console.error('[AI Settings PUT Error]', err);
    res.status(500).json({ error: '更新 AI 设置失败' });
  }
});

// ─── AI Provider CRUD endpoints ───

// GET /api/settings/ai-providers
router.get('/ai-providers', auth, async (req, res) => {
  try {
    const providers = await readProviders();
    const activeId = await readActiveId();
    const masked = providers.map(p => ({ ...p, apiKey: maskApiKey(p.apiKey) }));
    res.json({ providers: masked, activeId });
  } catch (err) {
    console.error('[AI Providers GET Error]', err);
    res.status(500).json({ error: '获取AI模型列表失败' });
  }
});

// POST /api/settings/ai-providers
router.post('/ai-providers', auth, async (req, res) => {
  try {
    const { name, provider, apiKey, baseUrl, model } = req.body;
    if (!name || !apiKey || !model) {
      return res.status(400).json({ error: '名称、API Key和模型不能为空' });
    }
    const providers = await readProviders();
    const id = 'p' + Date.now();
    const isFirst = providers.length === 0;
    const newProvider = {
      id,
      name: name.trim(),
      provider: provider || 'custom',
      apiKey: apiKey.trim(),
      baseUrl: (baseUrl || '').trim(),
      model: model.trim(),
      isDefault: isFirst,
    };
    providers.push(newProvider);
    await writeProviders(providers);
    if (isFirst) {
      await writeActiveId(id);
    }
    res.json({ provider: { ...newProvider, apiKey: maskApiKey(newProvider.apiKey) }, providers: providers.map(p => ({ ...p, apiKey: maskApiKey(p.apiKey) })) });
  } catch (err) {
    console.error('[AI Providers POST Error]', err);
    res.status(500).json({ error: '添加AI模型失败' });
  }
});

// PUT /api/settings/ai-providers/:id
router.put('/ai-providers/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, provider, apiKey, baseUrl, model } = req.body;
    const providers = await readProviders();
    const idx = providers.findIndex(p => p.id === id);
    if (idx === -1) return res.status(404).json({ error: '模型不存在' });

    if (name !== undefined) providers[idx].name = name.trim();
    if (provider !== undefined) providers[idx].provider = provider;
    if (apiKey !== undefined && apiKey.trim()) providers[idx].apiKey = apiKey.trim();
    if (baseUrl !== undefined) providers[idx].baseUrl = baseUrl.trim();
    if (model !== undefined) providers[idx].model = model.trim();

    await writeProviders(providers);
    res.json({ provider: { ...providers[idx], apiKey: maskApiKey(providers[idx].apiKey) }, providers: providers.map(p => ({ ...p, apiKey: maskApiKey(p.apiKey) })) });
  } catch (err) {
    console.error('[AI Providers PUT Error]', err);
    res.status(500).json({ error: '更新AI模型失败' });
  }
});

// DELETE /api/settings/ai-providers/:id
router.delete('/ai-providers/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    let providers = await readProviders();
    const idx = providers.findIndex(p => p.id === id);
    if (idx === -1) return res.status(404).json({ error: '模型不存在' });

    providers.splice(idx, 1);
    await writeProviders(providers);

    // If deleted the active one, set to first or null
    const activeId = await readActiveId();
    if (activeId === id) {
      const newActive = providers.length > 0 ? providers[0].id : null;
      if (newActive) {
        await writeActiveId(newActive);
        providers.find(p => p.id === newActive).isDefault = true;
      } else {
        await writeActiveId('');
      }
      await writeProviders(providers);
    }

    res.json({ success: true, providers: providers.map(p => ({ ...p, apiKey: maskApiKey(p.apiKey) })) });
  } catch (err) {
    console.error('[AI Providers DELETE Error]', err);
    res.status(500).json({ error: '删除AI模型失败' });
  }
});

// POST /api/settings/ai-providers/:id/activate
router.post('/ai-providers/:id/activate', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const providers = await readProviders();
    const idx = providers.findIndex(p => p.id === id);
    if (idx === -1) return res.status(404).json({ error: '模型不存在' });

    // Update isDefault flags
    providers.forEach(p => { p.isDefault = (p.id === id); });
    await writeProviders(providers);
    await writeActiveId(id);

    res.json({ success: true, activeId: id, providers: providers.map(p => ({ ...p, apiKey: maskApiKey(p.apiKey) })) });
  } catch (err) {
    console.error('[AI Providers Activate Error]', err);
    res.status(500).json({ error: '激活AI模型失败' });
  }
});

// POST /api/settings/ai-providers/test
router.post('/ai-providers/test', auth, async (req, res) => {
  try {
    const { apiKey, baseUrl, model, providerId } = req.body;
    let providerConfig;

    if (providerId) {
      // Test existing provider
      const providers = await readProviders();
      const found = providers.find(p => p.id === providerId);
      if (!found) return res.status(404).json({ error: '模型不存在' });
      providerConfig = found;
    } else {
      // Test with provided config
      if (!apiKey || !model) {
        return res.status(400).json({ error: 'API Key和模型不能为空' });
      }
      providerConfig = {
        apiKey: apiKey.trim(),
        baseUrl: (baseUrl || '').trim(),
        model: model.trim(),
      };
    }

    const result = await testConnection(providerConfig);
    res.json(result);
  } catch (err) {
    console.error('[AI Providers Test Error]', err);
    res.status(500).json({ success: false, message: '测试失败: ' + err.message });
  }
});

router.get("/ai-models", auth, async (req, res) => {
  try {
    const providers = await readProviders();
    const activeId = await readActiveId();
    const masked = providers.map(p => ({ ...p, apiKey: maskApiKey(p.apiKey) }));
    res.json({ providers: masked, activeId });
  } catch (err) {
    res.status(500).json({ error: "获取AI模型列表失败" });
  }
});

// ─── Unattended Mode Settings ───

router.get("/unattended", auth, async (req, res) => {
  try {
    const { default: unattendedService } = await import('../services/unattended.service.js');
    const config = await unattendedService.getConfig();
    res.json(config);
  } catch (err) {
    console.error("[Unattended GET Error]", err);
    res.status(500).json({ error: "获取无人值守设置失败" });
  }
});

router.put("/unattended", auth, async (req, res) => {
  try {
    const { default: unattendedService } = await import('../services/unattended.service.js');
    const current = await unattendedService.getConfig();
    const merged = { ...current, ...req.body };
    const saved = await unattendedService.saveConfig(merged);
    res.json(saved);
  } catch (err) {
    console.error("[Unattended PUT Error]", err);
    res.status(500).json({ error: "保存无人值守设置失败" });
  }
});

export default router;

// ─── Auto Reply Settings ───

async function readAutoReplySettings() {
  const setting = await prisma.setting.findUnique({
    where: { userId_key: { userId: USER_ID, key: "auto_reply" } },
  });
  if (!setting || !setting.value) return null;
  try { return JSON.parse(setting.value); } catch { return null; }
}

async function writeAutoReplySettings(settings) {
  await prisma.setting.upsert({
    where: { userId_key: { userId: USER_ID, key: "auto_reply" } },
    create: { userId: USER_ID, key: "auto_reply", value: JSON.stringify(settings) },
    update: { value: JSON.stringify(settings) },
  });
}

router.post("/auto-reply", auth, async (req, res) => {
  try {
    await writeAutoReplySettings(req.body);
    res.json({ success: true });
  } catch (err) {
    console.error("[Auto Reply Settings Error]", err);
    res.status(500).json({ error: "保存自动回复设置失败" });
  }
});

router.get("/auto-reply", auth, async (req, res) => {
  try {
    const settings = await readAutoReplySettings();
    res.json(settings || {});
  } catch (err) {
    console.error("[Auto Reply GET Error]", err);
    res.status(500).json({ error: "获取自动回复设置失败" });
  }
});
