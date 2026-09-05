/**
 * credit-charge.js - 路由层 AI 扣分中间件
 *
 * 方案（决策 v1.3）：不改 ai-client.js / ai.service.js 核心链路（项目铁律），
 * 在 ai.js 用户路由上挂载本中间件，实现"预检余额 → 调用成功 → 扣 150 积分"。
 *
 * 用法：
 *   import { chargeCredits } from '../middleware/credit-charge.js';
 *   router.post('/translate', auth, chargeCredits(), async (req, res) => { ... });
 *
 * 行为：
 *   1. 预检：余额不足 → 402 + code=INSUFFICIENT_CREDITS（前端可跳断点充值引导）
 *   2. 包装 res.json：仅当响应 2xx 成功时先扣分再返回，保证前端拿到的余额实时准确
 */
import { assertEnoughCredits, deductCredits, DEFAULT_AI_COST, getModelCost, MODEL_COST_MAP } from '../services/credits.js';
import { getCreditContext } from './credit-context.js';

export function chargeCredits(amount = null) {
  return async (req, res, next) => {
    // 动态确定本次调用的积分消耗：
    // 1. 优先从 req.body.model (providerId) 查 MODEL_COST_MAP
    // 2. 如果传入了固定 amount 则用固定值
    // 3. 兜底 DEFAULT_AI_COST
    const modelKey = req.body?.model || null;
    const cost = amount ?? getModelCost(modelKey);

    // 1. 预检余额
    try {
      await assertEnoughCredits(req.userId, cost);
    } catch (e) {
      if (e.code === 'INSUFFICIENT_CREDITS') {
        return res.status(402).json({
          error: '积分余额不足，请先充值',
          code: 'INSUFFICIENT_CREDITS',
          balance: e.balance,
          required: e.required,
          credits: { balance: e.balance, cost },
        });
      }
      console.error('[chargeCredits] balance check error:', e);
      return res.status(500).json({ error: '积分校验失败，请稍后重试' });
    }

    // 2. 包装 res.json：成功响应先扣分，再返回
    const originalJson = res.json.bind(res);
    res.json = async (body) => {
      const statusOk = res.statusCode >= 200 && res.statusCode < 300;
      if (statusOk && !res.headersSent) {
        try {
          const reason = modelKey ? `AI 调用消耗（按模型分级）` : 'AI 调用消耗';
          await deductCredits(req.userId, cost, reason, { model: modelKey || '' });
          // 标记本次请求已手动扣分，避免 ai-client 底层重复扣
          const ctx = getCreditContext();
          if (ctx) ctx.manualCharged = true;
        } catch (err) {
          console.error(`[chargeCredits] deduct error userId=${req.userId}:`, err);
        }
      }
      return originalJson(body);
    };

    next();
  };
}

export { DEFAULT_AI_COST, getModelCost, MODEL_COST_MAP };
