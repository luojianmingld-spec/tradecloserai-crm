import { Router } from 'express';
import { generateReply } from '../services/ai-reply.js';
import { summarizeNeed } from '../services/ai-summarize.js';

const router = Router();

/**
 * POST /api/ai/generate-reply
 * Generate AI reply options for a conversation
 */
router.post('/generate-reply', async (req, res) => {
  try {
    const { conversationId, accountId, jid, style } = req.body;
    const userId = req.userId;

    if (!accountId || !jid) {
      return res.status(400).json({ error: 'accountId 和 jid 为必填参数' });
    }

    const validStyles = ['formal', 'friendly', 'concise'];
    const replyStyle = validStyles.includes(style) ? style : 'formal';

    const result = await generateReply({
      userId,
      conversationId,
      accountId,
      jid,
      style: replyStyle,
    });

    if (result.error) {
      return res.status(400).json({ error: result.error });
    }

    res.json({
      replies: result.replies,
      engine: result.engine,
      style: result.style,
    });
  } catch (err) {
    console.error('[AI Routes] Generate reply error:', err);
    res.status(500).json({ error: '生成回复失败' });
  }
});

/**
 * POST /api/ai/summarize-need
 * Generate customer need summary based on conversation history
 */
router.post('/summarize-need', async (req, res) => {
  try {
    const { accountId, jid } = req.body;
    const userId = req.userId;

    if (!accountId || !jid) {
      return res.status(400).json({ error: 'accountId 和 jid 为必填参数' });
    }

    const result = await summarizeNeed({
      userId,
      accountId,
      jid,
    });

    if (result.error) {
      return res.status(400).json({ error: result.error });
    }

    res.json({
      summary: result.summary,
      engine: result.engine,
    });
  } catch (err) {
    console.error('[AI Routes] Summarize need error:', err);
    res.status(500).json({ error: '生成需求总结失败' });
  }
});

export default router;
