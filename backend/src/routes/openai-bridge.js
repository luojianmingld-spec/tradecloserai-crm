/**
 * OpenAI 兼容桥接端点 —— 把「CRM Agent」包装成 OpenAI chat/completions 模型
 *
 * 目的：让 OpenClaw 微信通道把消息转发给 CRM Agent，而不是 OpenClaw 自己的模型。
 * 这样微信=哑管道，CRM=唯一大脑（客户档案/知识库/单证/积分全在 CRM）。
 *
 * 请求（OpenAI 格式）：
 *   POST /api/openai/v1/chat/completions
 *   { "model": "sales-champion", "messages": [{role,content},...] }
 *
 * 响应（OpenAI 格式）：{ choices:[{message:{role:"assistant",content}}] }
 *
 * 鉴权：header Authorization: Bearer <OPENAI_BRIDGE_KEY>（配置在 .env）
 */
import { Router } from 'express';
import { chatComplete } from '../services/ai.service.js';
import { buildStatsReply } from '../services/wechat-stats.service.js';

const router = Router();

// 与 trade-agent.js 的 agentPrompts 保持一致（微信分流到对应专业 Agent）
const agentPrompts = {
  'sales-champion': '你是外贸销冠Agent，擅长AI话术、客户分层、报价优化。用专业、简洁的中文回复。',
  'background-report': '你是客户背调Agent，擅长公司背调、风险评估、竞品分析。用专业、简洁的中文回复。',
  'customs-agent': '你是外贸单证Agent，擅长报关单证、HS编码、信用证审核。用专业、简洁的中文回复。',
  'doc-agent': '你是工厂对接Agent，擅长工厂评估、排产跟进、验货标准。用专业、简洁的中文回复。',
  'freight-agent': '你是货代对接Agent，擅长海运方案、空运方案、报关报检。用专业、简洁的中文回复。',
  'legal-agent': '你是外贸法务Agent，擅长合同审查、纠纷处理、合规检查。用专业、简洁的中文回复。',
  'crm-agent': '你是外贸智能助手，基于CRM客户档案与知识库，用专业、简洁的中文回复。',
};

function normalizeAgentKey(model) {
  if (!model) return 'crm-agent';
  // 兼容 "provider/model" 或 "model" 两种写法
  const key = String(model).split('/').pop();
  return agentPrompts[key] ? key : 'crm-agent';
}

function extractUserText(messages) {
  if (!Array.isArray(messages)) return '';
  // 取最后一条 user 消息作为输入（忽略 OpenClaw 注入的 system prompt）
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m && m.role === 'user' && typeof m.content === 'string' && m.content.trim()) {
      return m.content;
    }
  }
  return '';
}

function sendSseChunk(res, payload) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

router.post('/v1/chat/completions', async (req, res) => {
  try {
    const bridgeKey = process.env.OPENAI_BRIDGE_KEY;
    const authHeader = req.headers.authorization || '';
    const provided = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (bridgeKey && provided !== bridgeKey) {
      return res.status(401).json({ error: { message: 'Invalid API key', type: 'auth_error' } });
    }

    const { model, messages, stream } = req.body || {};
    const agentKey = normalizeAgentKey(model);
    const systemPrompt = agentPrompts[agentKey];
    const userText = extractUserText(messages);
    if (!userText) {
      return res.status(400).json({ error: { message: 'No user message provided', type: 'bad_request' } });
    }

    // 调用 CRM 的模型能力（deepseek/doubao 等平台模型池）
    // 【老板总裁助理 V1】统计类问题 → 查真实数据回推，不走 LLM
    const statsReply = await buildStatsReply(userText);
    if (statsReply) {
      const base = {
        id: `chatcmpl-${Date.now()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: agentKey,
      };
      if (stream) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        const chunk0 = { ...base, choices: [{ index: 0, delta: { role: 'assistant', content: '' }, finish_reason: null }] };
        sendSseChunk(res, chunk0);
        const chunk1 = { ...base, choices: [{ index: 0, delta: { content: statsReply }, finish_reason: null }] };
        sendSseChunk(res, chunk1);
        const done = { ...base, choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] };
        sendSseChunk(res, done);
        res.write('data: [DONE]\n\n');
        return res.end();
      }
      return res.json({
        ...base,
        choices: [{ index: 0, message: { role: 'assistant', content: statsReply }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      });
    }

    const raw = await chatComplete(null, systemPrompt, userText, { temperature: 0.7 });

    const base = {
      id: `chatcmpl-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: agentKey,
    };

    if (stream) {
      // SSE 流式（OpenAI 兼容）
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      const chunk0 = { ...base, choices: [{ index: 0, delta: { role: 'assistant', content: '' }, finish_reason: null }] };
      sendSseChunk(res, chunk0);
      if (raw) {
        const chunk1 = { ...base, choices: [{ index: 0, delta: { content: raw }, finish_reason: null }] };
        sendSseChunk(res, chunk1);
      }
      const done = { ...base, choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] };
      sendSseChunk(res, done);
      res.write('data: [DONE]\n\n');
      return res.end();
    }

    return res.json({
      ...base,
      choices: [{ index: 0, message: { role: 'assistant', content: raw }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    });
  } catch (e) {
    console.error('[OpenAIBridge Error]', e.message);
    return res.status(500).json({ error: { message: e.message, type: 'server_error' } });
  }
});

// 健康检查
router.get('/v1/models', (req, res) => {
  return res.json({ object: 'list', data: Object.keys(agentPrompts).map((id) => ({ id, object: 'model' })) });
});

export default router;
