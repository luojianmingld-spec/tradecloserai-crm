/**
 * Agent 工作群组路由
 * - 复刻扣子项目组体验：群消息流 + 成员/Agent 面板
 * - @ Agent → 复用 assistant.service.processMessage（保留完整工具能力）响应，群上下文共享
 * - 版本: v1.0 (2026-08-19)
 */
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware as auth } from '../middleware/auth.js';
import assistantService from '../services/assistant.service.js';

const router = Router();
const prisma = new PrismaClient();

const DEFAULT_GROUP = 'work-group';

// 6 个 Agent 成员定义（成员面板 + @ 选择器 + 详情）
const AGENT_MEMBERS = [
  { key: 'sales-champion', name: '外贸销冠', icon: '🏆', role: '销售', desc: '15年外贸销售冠军经验：客户心理分析、话术优化、报价策略、成交技巧、ABC客户分层、销售漏斗推进。' },
  { key: 'background-report', name: '客户背调', icon: '🔍', role: '背调', desc: '专业商业情报分析师：公司背景调查、付款/信用风险评估、竞争对手分析、市场情报、海关数据解读。' },
  { key: 'customs-agent', name: '外贸单证', icon: '📋', role: '单证', desc: '单证与贸易合规专家：报关单证、HS编码归类、贸易术语、单证审核、信用证条款、外汇政策。' },
  { key: 'doc-agent', name: '工厂对接', icon: '🏭', role: '工厂', desc: '供应链与工厂管理专家：工厂验厂、排产跟进、品质管控、成本核算、供应商评估与替换策略。' },
  { key: 'freight-agent', name: '货代对接', icon: '🚢', role: '物流', desc: '国际物流专家：海运/空运报价、船期查询、报关报检、货运险、目的港清关、物流成本优化。' },
  { key: 'legal-agent', name: '外贸法务', icon: '⚖️', role: '法务', desc: '国际贸易法律顾问：合同审查、CISG/INCOTERMS、纠纷处理、知识产权、合规风险、付款保障。' },
];
const AGENT_NAME_MAP = Object.fromEntries(AGENT_MEMBERS.map(a => [a.key, a.name]));
const AGENT_ICON_MAP = Object.fromEntries(AGENT_MEMBERS.map(a => [a.key, a.icon]));

// GET /api/agent-group/members - 群成员（真人 + 6 Agent）
router.get('/members', auth, async (req, res) => {
  try {
    const userId = req.userId || 1;
    let user = null;
    try {
      user = await prisma.user.findUnique({ where: { id: Number(userId) } });
    } catch (e) { /* user table may not exist */ }
    const members = [{
      type: 'user',
      key: String(userId),
      name: user?.name || '我',
      role: '成员',
      desc: user?.email ? `邮箱：${user.email}` : '',
      icon: '👤',
      online: true,
    }];
    res.json({ members, agents: AGENT_MEMBERS });
  } catch (err) {
    console.error('[AgentGroup] members error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/agent-group/messages?afterId=&limit= - 群消息（增量）
router.get('/messages', auth, async (req, res) => {
  try {
    const groupKey = req.query.groupKey || DEFAULT_GROUP;
    const afterId = parseInt(req.query.afterId) || 0;
    const limit = Math.min(parseInt(req.query.limit) || 100, 300);
    const messages = await prisma.agentGroupMessage.findMany({
      where: { groupKey, ...(afterId ? { id: { gt: afterId } } : {}) },
      orderBy: { id: 'asc' },
      take: limit,
    });
    res.json({ messages });
  } catch (err) {
    console.error('[AgentGroup] messages error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/agent-group/send - 发消息（可 @ Agent 触发响应）
router.post('/send', auth, async (req, res) => {
  try {
    const userId = req.userId || 1;
    const groupKey = req.body.groupKey || DEFAULT_GROUP;
    const content = (req.body.content || '').trim();
    const targetKey = req.body.targetKey || null;
    if (!content) return res.status(400).json({ error: '消息不能为空' });

    // 1. 存用户消息
    const userMsg = await prisma.agentGroupMessage.create({
      data: {
        groupKey,
        senderType: 'user',
        senderKey: String(userId),
        senderName: '我',
        content,
        targetKey: targetKey && AGENT_NAME_MAP[targetKey] ? targetKey : null,
      },
    });
    const io = req.app.get('io');
    broadcast(io, userId, 'agent-group:new', { message: userMsg });

    // 2. 若 @ 了 Agent → 异步触发其回复
    let triggered = null;
    if (targetKey && AGENT_NAME_MAP[targetKey]) {
      triggered = targetKey;
      const ioRef = io;
      setImmediate(async () => {
        try {
          await triggerAgentReply(userId, groupKey, targetKey, userMsg.id, content, ioRef);
        } catch (e) {
          console.error('[AgentGroup] trigger reply error:', e.message);
        }
      });
    }
    res.json({ message: userMsg, triggered });
  } catch (err) {
    console.error('[AgentGroup] send error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 触发被 @ Agent 回复：群上下文拼接 + assistant 完整能力
async function triggerAgentReply(userId, groupKey, agentKey, replyToId, content, io) {
  const recent = await prisma.agentGroupMessage.findMany({
    where: { groupKey },
    orderBy: { id: 'desc' },
    take: 20,
  });
  const ctxLines = recent.reverse().map(m =>
    `${AGENT_ICON_MAP[m.senderKey] || '👤'} ${m.senderName}: ${m.content}`
  ).join('\n');

  const agentMsg = `【工作群组最新讨论（共享上下文，请参考）】\n${ctxLines}\n\n【@${AGENT_NAME_MAP[agentKey]} 的新消息】\n${content}\n\n请以你的专业角色，基于群组上下文回应这条消息。回复将同步到工作群组。`;

  const result = await assistantService.processMessage(userId, agentMsg, null, {
    agentType: agentKey,
    sessionId: `group:${groupKey}`,
  });
  const reply = result?.reply?.trim() || '抱歉，我暂时无法回复，请稍后再试。';
  const agentReply = await prisma.agentGroupMessage.create({
    data: {
      groupKey,
      senderType: 'agent',
      senderKey: agentKey,
      senderName: AGENT_NAME_MAP[agentKey],
      content: reply,
      replyToId,
    },
  });
  broadcast(io, userId, 'agent-group:new', { message: agentReply });
}

function broadcast(io, userId, event, payload) {
  try {
    if (!io) return;
    io.to(`user_${userId}`).emit(event, payload);
  } catch (e) {
    console.error('[AgentGroup] broadcast error:', e.message);
  }
}

export default router;
