/**
 * routes/followup.js — 智能跟进 API
 * POST /strategy  生成跟进策略
 * POST /speech    生成跟进话术
 * GET  /history   历史跟进记录
 * GET  /scenarios 场景库
 * 复用 ai.js 的 resolveAcctId 模式：从 Customer 反查账号归属
 */
import { Router } from 'express';
import { authMiddleware as auth } from '../middleware/auth.js';
import { chargeCredits } from '../middleware/credit-charge.js';
import { PrismaClient } from '@prisma/client';
import {
  generateFollowupStrategy,
  generateFollowupSpeech,
  getFollowupHistory,
  getScenarioLibrary,
} from '../services/followup-intel.service.js';

const router = Router();
const prisma = new PrismaClient();

/**
 * 解析所属账号：优先 req.body.accountId；否则按 jid 反查 Customer.userId
 */
async function resolveAcctId(accountId, userId, jid) {
  if (accountId) return accountId;
  if (jid) {
    try {
      // 优先按 jid 反查 Conversation.accountId（WhatsAppAccount.id）
      const conv = await prisma.conversation.findFirst({ where: { jid, platform: 'whatsapp' } });
      if (conv && conv.accountId) return conv.accountId;
    } catch (e) {}
    try {
      const phone = String(jid).split('@')[0];
      const c = await prisma.customer.findFirst({ where: { OR: [{ phone }, { jid }] } });
      if (c && c.userId) return c.userId;
    } catch (e) {}
  }
  return userId;
}


// 生成跟进策略
router.post('/strategy', auth, chargeCredits(), async (req, res) => {
  try {
    const { jid, accountId, scenario, modelKey } = req.body || {};
    const acctId = await resolveAcctId(accountId, req.userId, jid);
    const out = await generateFollowupStrategy({ userId: req.userId, accountId: acctId, jid, scenario, modelKey });
    if (out.error) return res.status(400).json({ error: out.error });
    res.json(out);
  } catch (e) {
    console.error('[followup-intel] /strategy:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// 生成跟进话术
router.post('/speech', auth, chargeCredits(), async (req, res) => {
  try {
    const { jid, accountId, strategy, scenario, lang, modelKey } = req.body || {};
    const acctId = await resolveAcctId(accountId, req.userId, jid);
    const out = await generateFollowupSpeech({ userId: req.userId, accountId: acctId, jid, strategyStr: strategy, scenario, lang, modelKey });
    res.json(out);
  } catch (e) {
    console.error('[followup-intel] /speech:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// 历史记录
router.get('/history', auth, async (req, res) => {
  try {
    const { jid, customerId, limit } = req.query;
    const list = await getFollowupHistory({ userId: req.userId, jid, customerId: customerId ? Number(customerId) : undefined, limit: limit ? Number(limit) : 20 });
    res.json({ list });
  } catch (e) {
    console.error('[followup-intel] /history:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// 场景库
router.get('/scenarios', auth, async (req, res) => {
  res.json({ scenarios: getScenarioLibrary() });
});

export default router;