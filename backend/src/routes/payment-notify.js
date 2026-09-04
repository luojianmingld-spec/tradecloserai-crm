/**
 * payment-notify.js - 支付回调（无鉴权挂载，供支付通道异步通知）
 *
 * 挂载：/api/payment/notify（在 express.json / express.urlencoded 之后、鉴权之前）
 *
 * 通道：
 *   POST /api/payment/notify/yungouos  YunGouOS 回调：验签 → 幂等到账 → 返回文本 'SUCCESS'
 *   POST /api/payment/notify/wechat    微信官方回调（预留，对公办好后实现 APIv3 解密）
 */
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { settlePaymentOrder } from '../services/credits.js';
import { yungouosVerifyNotify, getChannelConfig } from '../services/payment.js';

const router = Router();
const prisma = new PrismaClient();

// ========== YunGouOS 回调 ==========
// 回调 POST application/x-www-form-urlencoded（express.urlencoded 已解析到 req.body）
router.post('/yungouos', async (req, res) => {
  try {
    const body = req.body || {};
    const config = await getChannelConfig('yungouos');
    if (!config || !config.enabled) {
      console.warn('[PayNotify] yungouos channel disabled, ignore notify:', JSON.stringify(body).slice(0, 300));
      return res.status(200).send('SUCCESS'); // 通道未启用：幂等返回成功，避免通道重试轰炸
    }

    // 验签
    if (!yungouosVerifyNotify(body, config)) {
      console.warn('[PayNotify] yungouos sign verify FAILED:', JSON.stringify(body).slice(0, 300));
      return res.status(400).send('FAIL');
    }

    const outTradeNo = body.out_trade_no;
    if (!outTradeNo) return res.status(400).send('FAIL');

    const order = await prisma.paymentOrder.findUnique({ where: { orderNo: outTradeNo } });
    if (!order) {
      console.warn('[PayNotify] order not found:', outTradeNo);
      return res.status(200).send('SUCCESS'); // 订单不存在：返回成功避免重试，人工核查
    }

    // 金额一致性校验（YunGouOS total_fee 单位：元）
    const bodyFen = Math.round(Number(body.total_fee) * 100);
    const orderFen = Math.round(order.amount * 100);
    if (!Number.isFinite(bodyFen) || bodyFen !== orderFen) {
      console.warn(`[PayNotify] amount mismatch order=${orderFen} body=${bodyFen} orderNo=${outTradeNo}`);
      return res.status(400).send('FAIL');
    }

    // 幂等到账
    await settlePaymentOrder(order.id, {
      transaction_id: body.pay_no || null,
      amount: { total: bodyFen },
    });

    return res.status(200).send('SUCCESS');
  } catch (err) {
    console.error('[PayNotify] yungouos handler error:', err);
    return res.status(500).send('FAIL');
  }
});

// ========== 微信官方回调（预留） ==========
router.post('/wechat', async (req, res) => {
  // TODO: 对公办好后实现 APIv3 AES-256-GCM 回调解密 → 验签 → settlePaymentOrder
  res.status(501).json({ message: 'not implemented' });
});

export default router;
