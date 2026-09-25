/**
 * credits.js - 积分核心服务（用户端/充值回调/AI 扣分共用）
 *
 * 余额定义：最近一条 CreditTransaction.balanceAfter
 * 流水类型：recharge(充值+)/consume(消耗-)/gift(赠送+)/compensate(补偿+)/freeze/unfreeze
 *
 * 商业模式参数（决策 v1.3 已拍板）：
 *   - 1 元 = 1000 积分
 *   - 每次 AI 调用 = 150 积分
 *   - 充值档位 50/100/200/500/1000 元 + 自定义，50 元起
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const DEFAULT_AI_COST = 150;   // 默认 AI 调用消耗积分（兜底）

/**
 * 按模型分级积分扣费表（定价公式：API成本 × 1.9，即90%利润margin）
 * key = providerId, value = 每次调用扣除积分数
 * 数据来源：各厂商官网 2026-08 定价，按典型调用(输入~2000+输出~500 tokens)估算
 */
export const MODEL_COST_MAP = {
  'p1786588190918': 10,   // SenseNova 6.8 Flash-Lite（公测免费，预估正式价）
  'p1786601770927': 20,   // DeepSeek V4 Flash（高峰: 输入¥3/M, 输出¥9/M）
  'p1786601765650': 25,   // Doubao Seed 2.1 Turbo（输入¥3/M, 输出¥15/M）
  'p1786588228470': 25,   // Doubao Seed 2.0 Pro（≤32K: 输入¥3.2/M, 输出¥16/M）
  'p1786601765227': 50,   // Doubao Seed Evolving（输入¥6/M, 输出¥30/M）
  'p1786601714577': 60,   // DeepSeek V4 Pro（高峰: 输入¥9/M, 输出¥27/M）
  'p1786604068598': 135,  // GPT-5.6 Terra（/M input, 2/M output ≈ ¥0.072/次）
};

// 根据 providerId 获取该模型每次调用的积分消耗，未配置则返回默认值
export function getModelCost(modelKey) {
  if (modelKey && MODEL_COST_MAP[modelKey] !== undefined) {
    return MODEL_COST_MAP[modelKey];
  }
  return DEFAULT_AI_COST;
}
export const CREDIT_PER_YUAN = 1000;  // 1元 = 1000积分
export const MIN_RECHARGE_YUAN = 50; // 50元起充
export const RECHARGE_PRESETS = [50, 100, 200, 500, 1000];

// 读取用户当前积分余额
export async function getCreditBalance(userId) {
  const latest = await prisma.creditTransaction.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: { balanceAfter: true },
  });
  return latest?.balanceAfter || 0;
}

// 事务内读取余额
async function getBalanceInTx(tx, userId) {
  const latest = await tx.creditTransaction.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: { balanceAfter: true },
  });
  return latest?.balanceAfter || 0;
}

// 预检余额是否足够（不扣分），不足抛 err.code='INSUFFICIENT_CREDITS'
export async function assertEnoughCredits(userId, amount = DEFAULT_AI_COST) {
  const balance = await getCreditBalance(userId);
  if (balance < amount) {
    const err = new Error(`积分余额不足：当前 ${balance}，需要 ${amount}`);
    err.code = 'INSUFFICIENT_CREDITS';
    err.balance = balance;
    err.required = amount;
    throw err;
  }
  return balance;
}

// 扣减积分（原子事务），成功返回 transaction
export async function deductCredits(userId, amount = DEFAULT_AI_COST, reason = 'AI 调用消耗', extra = {}) {
  return prisma.$transaction(async (tx) => {
    const balance = await getBalanceInTx(tx, userId);
    if (balance < amount) {
      const err = new Error(`积分余额不足：当前 ${balance}，需要 ${amount}`);
      err.code = 'INSUFFICIENT_CREDITS';
      err.balance = balance;
      err.required = amount;
      throw err;
    }
    return tx.creditTransaction.create({
      data: {
        userId,
        type: 'consume',
        amount: -amount,
        balanceAfter: balance - amount,
        reason,
        paymentMethod: extra.paymentMethod || null,
        orderId: extra.orderId || null,
        model: extra.model || null,
      },
    });
  });
}

// 增加积分（充值/赠送/补偿）
export async function addCredits(userId, amount, type = 'gift', reason = '', extra = {}) {
  return prisma.$transaction(async (tx) => {
    const balance = await getBalanceInTx(tx, userId);
    return tx.creditTransaction.create({
      data: {
        userId,
        type,
        amount,
        balanceAfter: balance + amount,
        reason,
        paymentMethod: extra.paymentMethod || null,
        orderId: extra.orderId || null,
        model: extra.model || null,
      },
    });
  });
}

/**
 * 结算已支付订单（充值到账，幂等）
 * @param {number} orderId PaymentOrder.id
 * @param {object} wxResult 微信支付结果（含 out_trade_no / transaction_id / amount.total / trade_state）
 */
export async function settlePaymentOrder(orderId, wxResult) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.paymentOrder.findUnique({ where: { id: orderId } });
    if (!order) throw new Error('订单不存在');
    if (order.status === 'paid') return order; // 幂等：已到账直接返回

    // 金额一致性校验（微信返回金额单位：分）
    const orderFen = Math.round((order.amount || 0) * 100);
    const wxFen = wxResult?.amount?.total;
    if (wxFen !== undefined && wxFen !== null && orderFen !== wxFen) {
      throw new Error(`支付金额不一致：订单 ${orderFen} 分，微信 ${wxFen} 分`);
    }

    await tx.paymentOrder.update({
      where: { id: order.id },
      data: {
        status: 'paid',
        transactionId: wxResult?.transaction_id || null,
        notifyRaw: JSON.stringify(wxResult),
        paidAt: new Date(),
      },
    });

    const balance = await getBalanceInTx(tx, order.userId);
    return tx.creditTransaction.create({
      data: {
        userId: order.userId,
        type: 'recharge',
        amount: order.credits,
        balanceAfter: balance + order.credits,
        reason: `微信支付充值 ${order.amount} 元`,
        paymentMethod: 'wechat',
        orderId: order.orderNo,
      },
    });
  });
}

export { prisma };
