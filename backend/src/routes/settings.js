/**
 * Settings API Routes
 * 
 * GET  /api/settings         — 获取所有设置
 * PUT  /api/settings         — 批量更新设置
 * GET  /api/settings/ai      — 获取 AI 设置（含可用模型列表）
 * PUT  /api/settings/ai      — 更新 AI 设置
 */
import { Router } from 'express';
import { authMiddleware as auth } from '../middleware/auth.js';
import { getAISettings, updateSettings, updateSetting, getAvailableModels } from '../services/ai.service.js';

const router = Router();

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

// GET /api/settings/ai — 获取 AI 设置 + 可用模型
router.get('/ai', auth, async (req, res) => {
  try {
    const userId = req.userId;
    const settings = await getAISettings(userId);
    const models = getAvailableModels();
    res.json({ settings, models });
  } catch (err) {
    console.error('[AI Settings GET Error]', err);
    res.status(500).json({ error: '获取 AI 设置失败' });
  }
});

// PUT /api/settings/ai — 更新 AI 设置
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

export default router;
