/**
 * user/credits.js - 用户端充值 & 积分 API
 *
 * 挂载：/api/payments（authMiddleware 之后）
 *
 * 接口：
 *   GET  /api/payments/balance              当前积分余额
 *   POST /api/payments/orders               创建充值订单（档位/自定义，返回支付码）
 *   GET  /api/payments/orders               我的订单列表
 *   GET  /api/payments/orders/:orderNo      查单（本地状态 + 主动查通道补偿到账）
 *   GET  /api/payments/transactions         积分流水（分页）
 *
 * 商业模式（决策 v1.3）：1元=1000积分；档位 100/200/500/1000 + 自定义；100元起充；充值暂不送积分
 */
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import {
  getCreditBalance,
  CREDIT_PER_YUAN,
  MIN_RECHARGE_YUAN,
  RECHARGE_PRESETS,
  settlePaymentOrder,
} from '../../services/credits.js';
import { createPayment, getActiveChannel, yungouosQuery, getChannelConfig } from '../../services/payment.js';

const router = Router();
const prisma = new PrismaClient();

// 生成订单号：R + 时间戳 + 6位随机
function genOrderNo() {
  const ts = new Date();
  const pad = (n, l = 2) => String(n).padStart(l, '0');
  const stamp = `${ts.getFullYear()}${pad(ts.getMonth() + 1)}${pad(ts.getDate())}${pad(ts.getHours())}${pad(ts.getMinutes())}${pad(ts.getSeconds())}`;
  const rand = Math.floor(100000 + Math.random() * 900000);
  return `R${stamp}${rand}`;
}

// 回调域名前缀（用于拼接 notify_url）；.env 可配 PAY_BASE_URL，默认用请求 Host
function notifyBaseUrl(req) {
  if (process.env.PAY_BASE_URL) return process.env.PAY_BASE_URL.replace(/\/$/, '');
  return `${req.protocol}://${req.get('host')}`;
}

// ========== GET /balance ==========
router.get('/balance', async (req, res) => {
  try {
    const balance = await getCreditBalance(req.userId);
    res.json({ data: { balance, creditPerYuan: CREDIT_PER_YUAN, minRechargeYuan: MIN_RECHARGE_YUAN, aiCostPerCall: 150 } });
  } catch (err) {
    console.error('[Credits] balance error:', err);
    res.status(500).json({ error: '获取余额失败' });
  }
});

// ========== POST /orders 创建充值订单 ==========
router.post('/orders', async (req, res) => {
  try {
    const { amount, preset } = req.body || {};
    let yuan = 0;

    if (preset) {
      if (!RECHARGE_PRESETS.includes(Number(preset))) {
        return res.status(400).json({ error: '无效的充值档位' });
      }
      yuan = Number(preset);
    } else {
      yuan = Number(amount);
    }

    // 金额校验
    if (!Number.isFinite(yuan) || yuan < MIN_RECHARGE_YUAN) {
      return res.status(400).json({ error: `充值金额需不低于 ${MIN_RECHARGE_YUAN} 元` });
    }
    if (yuan > 50000) {
      return res.status(400).json({ error: '单笔充值金额过大，请联系客服' });
    }
    // 只允许两位小数
    yuan = Math.round(yuan * 100) / 100;

    const credits = Math.round(yuan * CREDIT_PER_YUAN);
    const orderNo = genOrderNo();

    // 先落库订单（保证 orderNo 唯一、可追踪）
    const order = await prisma.paymentOrder.create({
      data: {
        orderNo,
        userId: req.userId,
        channel: 'pending',   // 创建后按下单结果更新
        amount: yuan,
        credits,
        status: 'pending',
      },
    });

    // 调通道下单（内测期 YunGouOS；未配置通道 → 人工充值引导）
    let payment;
    try {
      payment = await createPayment({ order, notifyBaseUrl: notifyBaseUrl(req) });
    } catch (err) {
      // 下单失败：订单标记 failed，返回可读错误
      await prisma.paymentOrder.update({ where: { id: order.id }, data: { status: 'failed', prepayData: JSON.stringify({ error: err.message }) } });
      console.error('[Credits] createPayment error:', err);
      return res.status(502).json({ error: `支付下单失败：${err.message}` });
    }

    if (payment.manual) {
      // 通道未启用 → 人工充值引导
      await prisma.paymentOrder.update({ where: { id: order.id }, data: { channel: 'manual' } });
      return res.json({
        data: {
          orderNo,
          amount: yuan,
          credits,
          status: 'pending',
          channel: 'manual',
          manualRecharge: true,
          message: '在线支付通道正在开通中，请联系客服人工充值（微信/支付宝转账后到账）',
        },
      });
    }

    // 通道下单成功
    await prisma.paymentOrder.update({
      where: { id: order.id },
      data: { channel: payment.channel, prepayData: JSON.stringify(payment.raw || {}) },
    });

    res.json({
      data: {
        orderNo,
        amount: yuan,
        credits,
        status: 'pending',
        channel: payment.channel,
        codeUrl: payment.codeUrl,
      },
    });
  } catch (err) {
    console.error('[Credits] create order error:', err);
    res.status(500).json({ error: '创建订单失败' });
  }
});

// ========== GET /orders 订单列表 ==========
router.get('/orders', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.min(20, Math.max(1, parseInt(req.query.pageSize) || 10));
    const [list, total] = await Promise.all([
      prisma.paymentOrder.findMany({
        where: { userId: req.userId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: { orderNo: true, channel: true, amount: true, credits: true, status: true, paidAt: true, createdAt: true },
      }),
      prisma.paymentOrder.count({ where: { userId: req.userId } }),
    ]);
    res.json({ data: { list, total, page, pageSize } });
  } catch (err) {
    console.error('[Credits] order list error:', err);
    res.status(500).json({ error: '获取订单列表失败' });
  }
});

// ========== GET /orders/:orderNo 查单（含主动查通道补偿） ==========
router.get('/orders/:orderNo', async (req, res) => {
  try {
    const { orderNo } = req.params;
    const order = await prisma.paymentOrder.findFirst({
      where: { orderNo, userId: req.userId },
    });
    if (!order) return res.status(404).json({ error: '订单不存在' });

    // 本地已支付直接返回
    if (order.status === 'paid') {
      return res.json({ data: { orderNo, channel: order.channel, amount: order.amount, credits: order.credits, status: 'paid', paidAt: order.paidAt } });
    }

    // 本地 pending 且通道为聚合/官方 → 主动查通道，命中已支付则幂等到账
    if (order.status === 'pending' && (order.channel === 'yungouos' || order.channel === 'wechat')) {
      const active = await getActiveChannel();
      if (active && active.id === order.channel) {
        try {
          if (order.channel === 'yungouos') {
            const q = await yungouosQuery({ outTradeNo: order.orderNo, config: active.config });
            const d = q.data || {};
            // YunGouOS 查单返回：tradeState/status；已支付则结算
            const paid = d.tradeState === 'SUCCESS' || d.tradeState === 'PAY_SUCCESS' || d.status === 1 || d.paySuccess === true || d.pay_status === 'success';
            if (paid) {
              await settlePaymentOrder(order.id, {
                transaction_id: d.payNo || d.transactionId || null,
                amount: { total: Math.round(order.amount * 100) },
              });
              await prisma.paymentOrder.update({ where: { id: order.id }, data: { status: 'paid', paidAt: new Date() } });
              return res.json({ data: { orderNo, channel: order.channel, amount: order.amount, credits: order.credits, status: 'paid' } });
            }
          }
        } catch (err) {
          console.error('[Credits] active query error:', err);
        }
      }
    }

    res.json({ data: { orderNo, channel: order.channel, amount: order.amount, credits: order.credits, status: order.status } });
  } catch (err) {
    console.error('[Credits] query order error:', err);
    res.status(500).json({ error: '查询订单失败' });
  }
});

// ========== GET /transactions 积分流水 ==========
router.get('/transactions', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize) || 20));
    const [list, total] = await Promise.all([
      prisma.creditTransaction.findMany({
        where: { userId: req.userId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: { id: true, type: true, amount: true, balanceAfter: true, reason: true, orderId: true, model: true, createdAt: true },
      }),
      prisma.creditTransaction.count({ where: { userId: req.userId } }),
    ]);
    res.json({ data: { list, total, page, pageSize } });
  } catch (err) {
    console.error('[Credits] transactions error:', err);
    res.status(500).json({ error: '获取积分流水失败' });
  }
});

export default router;
