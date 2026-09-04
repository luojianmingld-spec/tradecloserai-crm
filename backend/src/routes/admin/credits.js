/**
 * Credits Routes
 * 积分系统（充值/扣减/总览/流水）
 */
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// 辅助函数：获取用户当前积分余额（最近一条transaction的balanceAfter）
async function getUserCreditBalance(userId) {
  const latest = await prisma.creditTransaction.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: { balanceAfter: true },
  });
  return latest?.balanceAfter || 0;
}

// GET /api/admin/credits/overview - 积分总览
router.get('/overview', async (req, res) => {
  try {
    const [totalRecharge, totalConsume, totalGift, totalCompensate, transactionCount] = await Promise.all([
      prisma.creditTransaction.aggregate({
        where: { type: 'recharge' },
        _sum: { amount: true },
      }),
      prisma.creditTransaction.aggregate({
        where: { type: 'consume' },
        _sum: { amount: true },
      }),
      prisma.creditTransaction.aggregate({
        where: { type: 'gift' },
        _sum: { amount: true },
      }),
      prisma.creditTransaction.aggregate({
        where: { type: 'compensate' },
        _sum: { amount: true },
      }),
      prisma.creditTransaction.count(),
    ]);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [todayConsume, todayRecharge] = await Promise.all([
      prisma.creditTransaction.aggregate({
        where: { type: 'consume', createdAt: { gte: today } },
        _sum: { amount: true },
      }),
      prisma.creditTransaction.aggregate({
        where: { type: 'recharge', createdAt: { gte: today } },
        _sum: { amount: true },
      }),
    ]);

    res.json({
      data: {
        totalRecharged: Math.abs(totalRecharge._sum.amount || 0),
        totalConsumed: Math.abs(totalConsume._sum.amount || 0),
        totalGifted: Math.abs(totalGift._sum.amount || 0),
        totalCompensated: Math.abs(totalCompensate._sum.amount || 0),
        netPool: Math.abs(totalRecharge._sum.amount || 0) +
                 Math.abs(totalGift._sum.amount || 0) +
                 Math.abs(totalCompensate._sum.amount || 0) +
                 (totalConsume._sum.amount || 0), // consume为负
        totalTransactions: transactionCount,
        todayRecharged: Math.abs(todayRecharge._sum.amount || 0),
        todayConsumed: Math.abs(todayConsume._sum.amount || 0),
      }
    });
  } catch (err) {
    console.error('[Credits] Overview error:', err);
    res.status(500).json({ error: '获取积分总览失败' });
  }
});

// GET /api/admin/credits/transactions - 积分流水
router.get('/transactions', async (req, res) => {
  try {
    const { page = 1, pageSize = 20, userId, type, startDate, endDate } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(pageSize);
    const take = Math.min(parseInt(pageSize), 100);
    const where = {};

    if (userId) where.userId = parseInt(userId);
    if (type) where.type = type;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [transactions, total] = await Promise.all([
      prisma.creditTransaction.findMany({
        where, skip, take,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.creditTransaction.count({ where }),
    ]);

    res.json({ data: transactions, total, page: parseInt(page), pageSize: parseInt(pageSize) });
  } catch (err) {
    console.error('[Credits] Transactions error:', err);
    res.status(500).json({ error: '获取积分流水失败' });
  }
});

// POST /api/admin/credits/recharge - 积分充值
router.post('/recharge', async (req, res) => {
  try {
    const { userId, amount, paymentMethod, reason } = req.body;
    if (!userId || !amount || amount <= 0) {
      return res.status(400).json({ error: 'userId和amount(>0)不能为空' });
    }

    const currentBalance = await getUserCreditBalance(userId);
    const newBalance = currentBalance + amount;

    const tx = await prisma.creditTransaction.create({
      data: {
        userId: parseInt(userId),
        type: 'recharge',
        amount,
        balanceAfter: newBalance,
        reason: reason || '管理员充值',
        operatorId: req.admin?.id || null,
        paymentMethod: paymentMethod || null,
      }
    });

    await prisma.auditLog.create({
      data: {
        adminId: req.admin?.id || 0,
        action: 'recharge_credits',
        targetType: 'credit',
        targetId: String(userId),
        beforeValue: JSON.stringify({ balance: currentBalance }),
        afterValue: JSON.stringify({ balance: newBalance, amount }),
        reason: reason || '管理员充值积分',
        riskLevel: 'medium',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      }
    });

    res.status(201).json({ data: tx, message: `充值${amount}积分成功` });
  } catch (err) {
    console.error('[Credits] Recharge error:', err);
    res.status(500).json({ error: '充值积分失败' });
  }
});

// POST /api/admin/credits/deduct - 积分扣减
router.post('/deduct', async (req, res) => {
  try {
    const { userId, amount, reason } = req.body;
    if (!userId || !amount || amount <= 0) {
      return res.status(400).json({ error: 'userId和amount(>0)不能为空' });
    }
    if (!reason) {
      return res.status(400).json({ error: '扣减积分必须提供原因' });
    }

    const currentBalance = await getUserCreditBalance(userId);
    if (currentBalance < amount) {
      return res.status(400).json({ error: `用户余额不足，当前${currentBalance}，需扣减${amount}` });
    }

    const newBalance = currentBalance - amount;

    const tx = await prisma.creditTransaction.create({
      data: {
        userId: parseInt(userId),
        type: 'consume',
        amount: -amount, // 扣减记为负
        balanceAfter: newBalance,
        reason,
        operatorId: req.admin?.id || null,
      }
    });

    await prisma.auditLog.create({
      data: {
        adminId: req.admin?.id || 0,
        action: 'deduct_credits',
        targetType: 'credit',
        targetId: String(userId),
        beforeValue: JSON.stringify({ balance: currentBalance }),
        afterValue: JSON.stringify({ balance: newBalance, amount }),
        reason,
        riskLevel: 'high',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      }
    });

    res.json({ data: tx, message: `扣减${amount}积分成功` });
  } catch (err) {
    console.error('[Credits] Deduct error:', err);
    res.status(500).json({ error: '扣减积分失败' });
  }
});

// POST /api/admin/credits/gift - 赠送积分
router.post('/gift', async (req, res) => {
  try {
    const { userId, amount, reason } = req.body;
    if (!userId || !amount || amount <= 0) {
      return res.status(400).json({ error: 'userId和amount(>0)不能为空' });
    }

    const currentBalance = await getUserCreditBalance(userId);
    const newBalance = currentBalance + amount;

    const tx = await prisma.creditTransaction.create({
      data: {
        userId: parseInt(userId),
        type: 'gift',
        amount,
        balanceAfter: newBalance,
        reason: reason || '管理员赠送',
        operatorId: req.admin?.id || null,
      }
    });

    await prisma.auditLog.create({
      data: {
        adminId: req.admin?.id || 0,
        action: 'gift_credits',
        targetType: 'credit',
        targetId: String(userId),
        beforeValue: JSON.stringify({ balance: currentBalance }),
        afterValue: JSON.stringify({ balance: newBalance, amount }),
        reason: reason || '赠送积分',
        riskLevel: 'low',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      }
    });

    res.status(201).json({ data: tx, message: `赠送${amount}积分成功` });
  } catch (err) {
    console.error('[Credits] Gift error:', err);
    res.status(500).json({ error: '赠送积分失败' });
  }
});

// GET /api/admin/credits/user/:userId - 获取某用户积分详情
router.get('/user/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const balance = await getUserCreditBalance(userId);
    const transactions = await prisma.creditTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.json({ data: { userId, balance, transactions } });
  } catch (err) {
    console.error('[Credits] User credits error:', err);
    res.status(500).json({ error: '获取用户积分详情失败' });
  }
});

export default router;
