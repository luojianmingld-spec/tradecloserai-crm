import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authMiddleware as auth } from '../middleware/auth.js';
import assistantService from '../services/assistant.service.js';
import { getProviders } from '../services/ai-client.js';

const router = Router();

// File upload config - store in temp
const uploadDir = path.join(process.cwd(), 'uploads', 'assistant');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `asst_${Date.now()}_${Math.random().toString(36).slice(2,8)}${ext}`);
    }
  }),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB max
});



// GET /api/assistant/providers - 获取可用模型列表
router.get('/providers', auth, async (req, res) => {
  try {
    const providers = await getProviders();
    const list = (providers || []).map(p => ({
      id: p.id,
      name: p.name || p.id,
      model: p.model || '',
      isDefault: !!p.isDefault,
      active: p.active !== false
    })).filter(p => p.active !== false);
    res.json(list);
  } catch (err) {
    console.error('[Assistant] providers error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/assistant/chat - 发送对话消息（支持 JSON 或 multipart/form-data）
router.post('/chat', auth, upload.array('files', 5), async (req, res) => {
  try {
    const message = req.body.message?.trim();
    if (!message && (!req.files || req.files.length === 0)) {
      return res.status(400).json({ error: '消息不能为空' });
    }
    
    const userId = req.userId || 1;
    const providerId = req.body.providerId || null;
    const dataset = req.body.dataset || '';
    let skills = [];
    try { skills = JSON.parse(req.body.skills || '[]'); } catch(e) {}

    // Collect file info
    const attachments = (req.files || []).map(f => ({
      name: f.originalname,
      path: f.path,
      type: f.mimetype,
      size: f.size
    }));

    const result = await assistantService.processMessage(userId, message || '', providerId, {
      dataset, skills, attachments
    });
    res.json(result);
  } catch (err) {
    console.error('[Assistant] chat error:', err);
    res.status(500).json({ error: err.message || '处理失败' });
  }
});

// GET /api/assistant/conversations - 查询对话历史
router.get('/conversations', auth, async (req, res) => {
  try {
    const userId = req.userId || 1;
    const limit = parseInt(req.query.limit) || 50;
    const conversations = await assistantService.getConversations(userId, limit);
    res.json(conversations);
  } catch (err) {
    console.error('[Assistant] conversations error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/assistant/tasks - 查询任务列表
router.get('/tasks', auth, async (req, res) => {
  try {
    const userId = req.userId || 1;
    const status = req.query.status;
    const tasks = await assistantService.getTasks(userId, status);
    res.json(tasks);
  } catch (err) {
    console.error('[Assistant] tasks error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/assistant/tasks/:id/confirm - 确认执行任务
router.post('/tasks/:id/confirm', auth, async (req, res) => {
  try {
    const userId = req.userId || 1;
    const taskId = parseInt(req.params.id);
    const modifications = req.body.modifications; // 可选的修改（如修改消息内容）
    
    const result = await assistantService.confirmTask(userId, taskId, modifications);
    res.json(result);
  } catch (err) {
    console.error('[Assistant] confirm task error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/assistant/tasks/:id/cancel - 取消任务
router.post('/tasks/:id/cancel', auth, async (req, res) => {
  try {
    const userId = req.userId || 1;
    const taskId = parseInt(req.params.id);
    
    const result = await assistantService.cancelTask(userId, taskId);
    res.json(result);
  } catch (err) {
    console.error('[Assistant] cancel task error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
