/**
 * 微信公众号回调和绑定路由
 * - GET /api/wechat/verify - 微信服务器验证
 * - POST /api/wechat/callback - 接收微信事件（关注/取消关注等）
 * - GET /api/wechat/qrcode - 获取绑定二维码
 * - GET /api/wechat/bind-status - 查询绑定状态
 */

import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import {
  verifySignature,
  generateQRCode,
  sendTextMessage,
} from '../services/wechat-official.service.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();

// 微信服务器验证Token（需与公众号后台配置一致）
const WECHAT_TOKEN = process.env.WECHAT_TOKEN || 'tradecloser_wechat_token_2026';

/**
 * GET /api/wechat/verify
 * 微信服务器验证（公众号后台配置服务器URL时调用）
 */
router.get('/verify', (req, res) => {
  const { signature, timestamp, nonce, echostr } = req.query;

  if (!signature || !timestamp || !nonce || !echostr) {
    return res.status(400).send('参数不完整');
  }

  if (verifySignature(signature, timestamp, nonce, WECHAT_TOKEN)) {
    console.log('[WeChat] 服务器验证成功');
    res.send(echostr);
  } else {
    console.log('[WeChat] 服务器验证失败');
    res.status(403).send('验证失败');
  }
});

/**
 * POST /api/wechat/callback
 * 接收微信推送的事件和消息
 */
router.post('/callback', async (req, res) => {
  try {
    const xmlData = req.body;
    console.log('[WeChat] 收到回调:', xmlData);

    // 解析XML
    const parseXML = (xml) => {
      const result = {};
      const matches = xml.match(/<(\w+)><!CDATA\[(.*?)\]\]><\/\1>/g) || [];
      matches.forEach((match) => {
        const keyMatch = match.match(/<(\w+)>/);
        const valMatch = match.match(/\[(.*?)\]/);
        if (keyMatch && valMatch) {
          result[keyMatch[1]] = valMatch[1];
        }
      });
      return result;
    };

    const data = parseXML(xmlData);
    const { ToUserName, FromUserName, MsgType, Event, EventKey } = data;

    console.log('[WeChat] 事件类型:', Event, 'EventKey:', EventKey);

    // 处理关注事件
    if (MsgType === 'event' && Event === 'subscribe') {
      const sceneStr = EventKey ? EventKey.replace('qrscene_', '') : null;

      if (sceneStr) {
        const userId = parseInt(sceneStr);
        if (!isNaN(userId)) {
          await prisma.setting.upsert({
            where: {
              userId_key: {
                userId: userId,
                key: 'wechat_openid',
              },
            },
            create: {
              userId: userId,
              key: 'wechat_openid',
              value: FromUserName,
            },
            update: {
              value: FromUserName,
            },
          });

          console.log(`[WeChat] 用户 ${userId} 绑定OpenID: ${FromUserName}`);

          await sendTextMessage(
            FromUserName,
            '欢迎绑定TradeCloser AI！\n\n您已成功绑定微信，后续重要通知将通过微信推送给您。'
          );
        }
      } else {
        await sendTextMessage(
          FromUserName,
          '欢迎关注华创国际！\n\n如果您已注册TradeCloser AI账号，请在系统内点击"绑定微信"完成关联。'
        );
      }
    }

    // 处理取消关注事件
    if (MsgType === 'event' && Event === 'unsubscribe') {
      console.log(`[WeChat] 用户取消关注: ${FromUserName}`);
    }

    res.send('success');
  } catch (err) {
    console.error('[WeChat] 处理回调失败:', err.message);
    res.send('success');
  }
});

/**
 * GET /api/wechat/qrcode
 * 获取用户绑定二维码
 */
router.get('/qrcode', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: '未登录' });
    }

    const qrcode = await generateQRCode(userId.toString());

    res.json({
      success: true,
      qrcode: qrcode,
      message: '请用微信扫码关注公众号完成绑定',
    });
  } catch (err) {
    console.error('[WeChat] 生成二维码失败:', err.message);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

/**
 * GET /api/wechat/bind-status
 * 查询当前用户的微信绑定状态
 */
router.get('/bind-status', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: '未登录' });
    }

    const setting = await prisma.setting.findUnique({
      where: {
        userId_key: {
          userId: userId,
          key: 'wechat_openid',
        },
      },
    });

    res.json({
      success: true,
      bound: !!setting,
      openid: setting?.value || null,
    });
  } catch (err) {
    console.error('[WeChat] 查询绑定状态失败:', err.message);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

/**
 * POST /api/wechat/unbind
 * 解绑微信
 */
router.post('/unbind', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: '未登录' });
    }

    await prisma.setting.delete({
      where: {
        userId_key: {
          userId: userId,
          key: 'wechat_openid',
        },
      },
    }).catch(() => {});

    res.json({
      success: true,
      message: '已解绑微信',
    });
  } catch (err) {
    console.error('[WeChat] 解绑失败:', err.message);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

export default router;
