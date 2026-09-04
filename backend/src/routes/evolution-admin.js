import express from 'express';
const router = express.Router();

const EVO_API = process.env.EVOLUTION_API_URL || 'http://127.0.0.1:8081';
const EVO_KEY = process.env.EVOLUTION_API_KEY;

// 检查连接状态
router.get('/connection-state', async (req, res) => {
  try {
    const instance = req.query.instance || 'jeremy-main';
    const resp = await fetch(`${EVO_API}/instance/connectionState/${instance}`, {
      headers: { 'apikey': EVO_KEY }
    });
    const data = await resp.json();
    // Evolution API 返回格式: {instance: {instanceName, state}}
    const state = data.instance?.state || data.state || 'unknown';
    res.json({ instance, state });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 重新连接 - 获取QR码
router.post('/reconnect', async (req, res) => {
  try {
    const instance = req.body.instance || 'jeremy-main';
    const resp = await fetch(`${EVO_API}/instance/connect/${instance}`, {
      headers: { 'apikey': EVO_KEY }
    });
    const data = await resp.json();
    res.json({
      instance,
      qrBase64: data.base64 || null,
      count: data.count || 0
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 断开连接
router.post('/disconnect', async (req, res) => {
  try {
    const instance = req.body.instance || 'jeremy-main';
    const resp = await fetch(`${EVO_API}/instance/logout/${instance}`, {
      method: 'DELETE',
      headers: { 'apikey': EVO_KEY }
    });
    const data = await resp.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 获取所有实例状态
router.get('/instances', async (req, res) => {
  try {
    const resp = await fetch(`${EVO_API}/instance/fetchInstances`, {
      headers: { 'apikey': EVO_KEY }
    });
    const data = await resp.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
