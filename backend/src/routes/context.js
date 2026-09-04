/**
 * 共享上下文 API（6 Agent 共享上下文 Step1）
 *  - POST /api/context       写入/合并上下文（三态合并）
 *  - GET  /api/context       查询上下文（entityType/entityId/key/status）
 *  - GET  /api/context/conflicts  待裁决冲突列表
 *  - POST /api/context/conflicts/:id/resolve  人工裁决
 *  - POST /api/context/agents/:agentType  初始化 AgentProfile（可选）
 */
import { Router } from 'express';
import {
  contextSet,
  contextGet,
  listConflicts,
  resolveConflict,
  upsertAgentProfile
} from '../services/context.service.js';

const router = Router();

// POST /api/context — 写入（三态合并）
router.post('/', async (req, res) => {
  try {
    const result = await contextSet(req.body || {});
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (e) {
    console.error('[Context] set error:', e);
    res.status(500).json({ error: true, message: e.message });
  }
});

// GET /api/context — 查询
router.get('/', async (req, res) => {
  try {
    const result = await contextGet(req.query || {});
    res.json(result);
  } catch (e) {
    console.error('[Context] get error:', e);
    res.status(500).json({ error: true, message: e.message });
  }
});

// GET /api/context/conflicts — 待裁决列表
router.get('/conflicts', async (req, res) => {
  try {
    const result = await listConflicts();
    res.json({ conflicts: result });
  } catch (e) {
    console.error('[Context] conflicts error:', e);
    res.status(500).json({ error: true, message: e.message });
  }
});

// POST /api/context/conflicts/:id/resolve — 裁决
router.post('/conflicts/:id/resolve', async (req, res) => {
  try {
    const { resolution, resolvedBy } = req.body || {};
    const result = await resolveConflict(req.params.id, resolution, resolvedBy || 'human');
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (e) {
    console.error('[Context] resolve error:', e);
    res.status(500).json({ error: true, message: e.message });
  }
});

// POST /api/context/agents/:agentType — 初始化 AgentProfile
router.post('/agents/:agentType', async (req, res) => {
  try {
    const { profileJson, playbookJson } = req.body || {};
    const result = await upsertAgentProfile(req.params.agentType, profileJson, playbookJson);
    res.json({ success: true, agent: result });
  } catch (e) {
    console.error('[Context] agent profile error:', e);
    res.status(500).json({ error: true, message: e.message });
  }
});

export default router;
