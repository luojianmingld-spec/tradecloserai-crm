/**
 * auto-reception-customer.js
 * 指定客户的自动接待开关 REST API。
 * 对接 auto-reception.service.js 已导出的客户级接管函数：
 *   getCustomerTakeover / enableCustomerTakeover / disableCustomerTakeover
 * 鉴权在 server.js 挂载时通过 authMiddleware 完成（req.userId 已注入）。
 * 客户标识使用前端当前会话的 jid（chatStore.activeJid），与胶囊指令口径一致。
 */
import { Router } from 'express';
import AutoReceptionService from '../services/auto-reception.service.js';

const { getCustomerTakeover, enableCustomerTakeover, disableCustomerTakeover } = AutoReceptionService;

const router = Router();

// GET /api/auto-reception/customer/:jid/status
// 查询指定客户自动接待状态；未设置返回 { enabled:false }
router.get('/customer/:jid/status', async (req, res) => {
  try {
    const userId = req.userId;
    const jid = decodeURIComponent(req.params.jid);
    const conf = getCustomerTakeover(userId, jid);
    if (!conf) return res.json({ enabled: false, set: false });
    return res.json({ ...conf, set: true });
  } catch (e) {
    console.error('[auto-reception-customer] status error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/auto-reception/customer/:jid
// body: { on: true|false, mode?: 'always'|'offhours', timeoutMinutes?: number, startHour?, endHour?, timezone? }
router.post('/customer/:jid', async (req, res) => {
  try {
    const userId = req.userId;
    const jid = decodeURIComponent(req.params.jid);
    const { on, mode, timeoutMinutes, startHour, endHour, timezone, confirmMode } = req.body || {};
    if (on) {
      const conf = await enableCustomerTakeover(userId, jid, {
        timeoutMinutes: timeoutMinutes != null ? timeoutMinutes : 3,
        mode: mode || 'always',
        confirmMode: confirmMode || 'smart',
        startHour,
        endHour,
        timezone,
      });
      return res.json({ ok: true, enabled: true, ...conf });
    }
    await disableCustomerTakeover(userId, jid);
    return res.json({ ok: true, enabled: false });
  } catch (e) {
    console.error('[auto-reception-customer] toggle error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

export default router;