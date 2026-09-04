/**
 * 微信通知推送路由
 * 用于发送测试消息和业务通知
 */

import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { sendTemplateMessage, sendTextMessage } from '../services/wechat-official.service.js';

const router = Router();
const prisma = new PrismaClient();

/**
 * GET /api/wechat/test-notify
 * 发送测试通知（需要登录）
 */
router.get('/test-notify', async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: '未登录' });
    }

    // 查找用户绑定的OpenID
    const metadata = await prisma.userMetadata.findUnique({
      where: {
        userId_key: {
          userId: userId,
          key: 'wechat_openid',
        },
      },
    });

    if (!metadata) {
      return res.json({
        success: false,
        message: '您尚未绑定微信，请先绑定',
      });
    }

    // 发送测试客服消息
    await sendTextMessage(
      metadata.value,
      '【TradeCloser AI测试通知】\n\n如果您收到这条消息，说明微信推送功能已正常工作！\n\n后续重要通知将通过微信推送给您。'
    );

    res.json({
      success: true,
      message: '测试消息已发送，请检查微信',
    });
  } catch (err) {
    console.error('[WeChat] 发送测试消息失败:', err.message);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

/**
 * POST /api/wechat/send-decision-notify
 * 发送决策提醒通知（AI无法决策时提醒销售）
 * 参数：{ userId, message: string }
 */
router.post('/send-decision-notify', async (req, res) => {
  try {
    const { userId, message } = req.body;

    if (!userId || !message) {
      return res.status(400).json({
        success: false,
        message: '缺少必要参数',
      });
    }

    // 查找用户绑定的OpenID
    const metadata = await prisma.userMetadata.findUnique({
      where: {
        userId_key: {
          userId: userId,
          key: 'wechat_openid',
        },
      },
    });

    if (!metadata) {
      return res.json({
        success: false,
        message: '用户未绑定微信',
      });
    }

    // 发送客服消息
    await sendTextMessage(
      metadata.value,
      `【决策提醒】\n\n${message}\n\n请及时登录TradeCloser AI处理。`
    );

    res.json({
      success: true,
      message: '通知已发送',
    });
  } catch (err) {
    console.error('[WeChat] 发送决策提醒失败:', err.message);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

export default router;
