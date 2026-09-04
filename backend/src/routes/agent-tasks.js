/**
 * Agent 指派任务 API（客户-Agent 双向指派需求）
 *  - POST /api/agent/tasks   批量创建指派任务（body: { agentType, customerIds[], instruction?, source? }）
 *  - GET  /api/agent/tasks   查询指派任务列表（?agentType=&status=）
 *  - POST /api/agent/tasks/:id/complete  标记完结
 */
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

const MAX_BATCH = 100; // 批量指派上限（V1.0 默认 100）

// POST /api/agent/tasks — 批量创建指派任务
router.post('/', async (req, res) => {
  try {
    const userId = req.userId || 1;
    const { agentType, customerIds, instruction, source } = req.body || {};
    if (!agentType) return res.status(400).json({ error: 'agentType 必填' });
    if (!Array.isArray(customerIds) || customerIds.length === 0) {
      return res.status(400).json({ error: 'customerIds 至少一个' });
    }
    if (customerIds.length > MAX_BATCH) {
      return res.status(400).json({ error: `批量指派一次最多 ${MAX_BATCH} 个客户` });
    }
    const src = source || 'customer_list';

    // 校验 agentType 合法（6 个 Agent）
    const validAgentTypes = ['sales-champion', 'background-report', 'customs-agent', 'doc-agent', 'freight-agent', 'legal-agent'];
    if (!validAgentTypes.includes(agentType)) {
      return res.status(400).json({ error: '未知的 Agent 类型: ' + agentType });
    }

    const results = [];
    let okCount = 0;
    let failCount = 0;

    for (const customerId of customerIds) {
      try {
        const cid = parseInt(customerId, 10);
        if (!cid || isNaN(cid)) throw new Error('无效客户ID: ' + customerId);
        const customer = await prisma.customer.findUnique({ where: { id: cid } });
        if (!customer) throw new Error('客户不存在: ' + customerId);

        // 已存在同 Agent 同客户任务 → 复用并返回已存在
        const existing = await prisma.agentTask.findUnique({
          where: { userId_agentType_customerId: { userId, agentType, customerId: cid } }
        });
        if (existing) {
          // 已存在同 Agent 同客户任务
          // V1.1：本次带新指令则更新指令（重复指派指令丢失修复）
          // V1.2：已终止/阻塞任务被重新指派 → 自动重新激活为 CREATED
          let updated = existing;
          const newInstr = instruction && String(instruction).trim();
          const needReactivate = ['COMPLETED', 'BLOCKED'].includes(existing.status);
          const needUpdateInstr = newInstr && newInstr !== (existing.instruction || '');
          if (needReactivate || needUpdateInstr) {
            const data = {};
            if (needReactivate) data.status = 'CREATED';
            if (needUpdateInstr) data.instruction = newInstr;
            updated = await prisma.agentTask.update({
              where: { id: existing.id },
              data
            });
          }
          results.push({
            customerId: cid,
            status: needReactivate ? 'reactivated' : (needUpdateInstr ? 'updated' : 'exists'),
            taskId: existing.id,
            task: updated
          });
          okCount++;
          continue;
        }

        const task = await prisma.agentTask.create({
          data: {
            userId, agentType, customerId: cid,
            instruction: instruction || null,
            status: 'CREATED',
            source: src,
            assignedBy: 'human'
          }
        });
        results.push({ customerId: cid, status: 'created', taskId: task.id, task });
        okCount++;
      } catch (e) {
        failCount++;
        results.push({ customerId, status: 'failed', error: e.message });
      }
    }

    res.json({ success: true, ok: okCount, fail: failCount, results });
  } catch (err) {
    console.error('[AgentTasks] create error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/agent/tasks — 查询指派任务列表
router.get('/', async (req, res) => {
  try {
    const userId = req.userId || 1;
    const { agentType, status } = req.query;
    const where = { userId };
    if (agentType) where.agentType = agentType;
    if (status) where.status = status;

    const tasks = await prisma.agentTask.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 500
    });

    // 附带客户摘要
    const customerIds = [...new Set(tasks.map(t => t.customerId))];
    const customers = customerIds.length
      ? await prisma.customer.findMany({ where: { id: { in: customerIds } }, select: { id: true, name: true, company: true, customerLevel: true, dealStage: true } })
      : [];
    const custMap = {};
    customers.forEach(c => { custMap[c.id] = c; });

    const list = tasks.map(t => ({
      id: t.id, agentType: t.agentType, customerId: t.customerId,
      instruction: t.instruction, status: t.status, source: t.source,
      assignedBy: t.assignedBy, openedAt: t.openedAt, createdAt: t.createdAt,
      customer: custMap[t.customerId] || null
    }));

    res.json({ tasks: list, count: list.length });
  } catch (err) {
    console.error('[AgentTasks] list error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/agent/tasks/:id/complete — 标记完结（V1.0 手动完结）
router.post('/:id/complete', async (req, res) => {
  try {
    const userId = req.userId || 1;
    const id = parseInt(req.params.id, 10);
    const task = await prisma.agentTask.findFirst({ where: { id, userId } });
    if (!task) return res.status(404).json({ error: '指派任务不存在' });
    const updated = await prisma.agentTask.update({
      where: { id }, data: { status: 'COMPLETED' }
    });
    res.json({ success: true, task: updated });
  } catch (err) {
    console.error('[AgentTasks] complete error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
