import { Router } from 'express';
import { chatComplete, getAISettings } from '../services/ai.service.js';

const router = Router();

const agentPrompts = {
  'sales-champion': '你是外贸销冠Agent，擅长AI话术、客户分层、报价优化。用专业、简洁的中文回复。',
  'background-report': '你是客户背调Agent，擅长公司背调、风险评估、竞品分析。用专业、简洁的中文回复。',
  'customs-agent': '你是外贸单证Agent，擅长报关单证、HS编码、信用证审核。用专业、简洁的中文回复。',
  'doc-agent': '你是工厂对接Agent，擅长工厂评估、排产跟进、验货标准。用专业、简洁的中文回复。',
  'freight-agent': '你是货代对接Agent，擅长海运方案、空运方案、报关报检。用专业、简洁的中文回复。',
  'legal-agent': '你是外贸法务Agent，擅长合同审查、纠纷处理、合规检查。用专业、简洁的中文回复。',
};

router.post('/chat', async (req, res) => {
  try {
    const { agentKey, message, model } = req.body;
    if (!agentKey || !message) {
      return res.status(400).json({ error: 'agentKey and message are required' });
    }
    const systemPrompt = agentPrompts[agentKey] || '你是外贸智能助手。';
    let modelId = model;
    // Auto/未指定时不强制指定模型，交给 ai-client 自动解析 active provider 的模型
    if (!modelId || modelId === 'Auto') modelId = null;
    const raw = await chatComplete(modelId, systemPrompt, message, { temperature: 0.7 });
    res.json({ reply: raw });
  } catch (e) {
    console.error('[TradeAgent Chat Error]', e.message);
    res.status(500).json({ error: e.message });
  }
});

export default router;
