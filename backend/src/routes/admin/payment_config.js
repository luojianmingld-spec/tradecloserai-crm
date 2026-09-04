/**
 * Payment Configuration Routes
 * 支付通道管理 + 火币钱包 + 混合支付规则
 */
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// 辅助：读取系统配置
async function getConfig(key, defaultValue = null) {
  const row = await prisma.systemConfig.findUnique({ where: { key } });
  if (!row) return defaultValue;
  try { return JSON.parse(row.value); } catch { return row.value; }
}

// 辅助：写入系统配置
async function setConfig(key, value) {
  const val = typeof value === 'string' ? value : JSON.stringify(value);
  await prisma.systemConfig.upsert({
    where: { key },
    create: { key, value: val },
    update: { value: val }
  });
}

// ========== 支付通道管理 ==========

// GET /api/admin/payment-config/channels - 获取所有支付通道
router.get('/channels', async (req, res) => {
  try {
    const channels = await getConfig('payment_channels', [
      { id: 'alipay', name: '支付宝', enabled: false, appId: '', appSecret: '', notifyUrl: '', feeRate: 0.6 },
      { id: 'wechat', name: '微信支付(官方直连)', enabled: false, mchId: '', apiKey: '', serialNo: '', privateKey: '', apiv3Key: '', notifyUrl: '', feeRate: 0.6 },
      { id: 'yungouos', name: 'YunGouOS聚合支付', enabled: false, mchId: '', payKey: '', notifyUrl: '', feeRate: 0.6 },
      { id: 'usdt', name: 'USDT(TRC20)', enabled: false, walletAddress: '', feeRate: 0 },
      { id: 'huobi', name: '火币支付', enabled: false, merchantId: '', apiKey: '', feeRate: 1.0 }
    ]);
    res.json({ data: channels });
  } catch (err) {
    console.error('[PaymentConfig] Get channels error:', err);
    res.status(500).json({ error: '获取支付通道失败' });
  }
});

// PUT /api/admin/payment-config/channels - 更新支付通道配置
router.put('/channels', async (req, res) => {
  try {
    const { channels } = req.body;
    if (!Array.isArray(channels)) return res.status(400).json({ error: '参数格式错误' });
    await setConfig('payment_channels', channels);

    await prisma.auditLog.create({
      data: {
        adminId: req.admin?.id || 0,
        action: 'update_payment_channels',
        targetType: 'system',
        targetId: 'payment_channels',
        afterValue: JSON.stringify(channels.map(c => ({ id: c.id, enabled: c.enabled }))),
        reason: '更新支付通道配置',
        riskLevel: 'high',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      }
    });

    res.json({ message: '支付通道配置已保存' });
  } catch (err) {
    console.error('[PaymentConfig] Update channels error:', err);
    res.status(500).json({ error: '保存支付通道失败' });
  }
});

// ========== 火币钱包管理 ==========

// GET /api/admin/payment-config/huobi-wallet - 获取火币钱包配置
router.get('/huobi-wallet', async (req, res) => {
  try {
    const wallet = await getConfig('huobi_wallet', {
      enabled: false,
      walletAddress: '',
      network: 'TRC20',
      merchantId: '',
      apiKey: '',
      secretKey: '',
      callbackUrl: '',
      autoConvert: true,
      minAmount: 10,
      note: '火币支付通过OKX(原Huobi)网关，支持USDT/TRC20收款'
    });
    res.json({ data: wallet });
  } catch (err) {
    console.error('[PaymentConfig] Get huobi wallet error:', err);
    res.status(500).json({ error: '获取火币钱包配置失败' });
  }
});

// PUT /api/admin/payment-config/huobi-wallet - 更新火币钱包配置
router.put('/huobi-wallet', async (req, res) => {
  try {
    const wallet = req.body;
    await setConfig('huobi_wallet', wallet);

    await prisma.auditLog.create({
      data: {
        adminId: req.admin?.id || 0,
        action: 'update_huobi_wallet',
        targetType: 'system',
        targetId: 'huobi_wallet',
        afterValue: JSON.stringify({ enabled: wallet.enabled, network: wallet.network }),
        reason: '更新火币钱包配置',
        riskLevel: 'high',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      }
    });

    res.json({ message: '火币钱包配置已保存' });
  } catch (err) {
    console.error('[PaymentConfig] Update huobi wallet error:', err);
    res.status(500).json({ error: '保存火币钱包配置失败' });
  }
});

// ========== 混合支付规则 ==========

// GET /api/admin/payment-config/rules - 获取混合支付/满减规则
router.get('/rules', async (req, res) => {
  try {
    const rules = await getConfig('payment_rules', {
      enabled: false,
      mixEnabled: false,
      discounts: [
        { minAmount: 100, discount: 5, label: '满100减5' },
        { minAmount: 300, discount: 20, label: '满300减20' },
        { minAmount: 500, discount: 50, label: '满500减50' },
        { minAmount: 1000, discount: 120, label: '满1000减120' }
      ],
      maxDiscount: 200,
      stackable: false,
      note: '混合支付允许用户同时使用多种支付方式组合付款；满减规则按订单金额自动抵扣'
    });
    res.json({ data: rules });
  } catch (err) {
    console.error('[PaymentConfig] Get rules error:', err);
    res.status(500).json({ error: '获取支付规则失败' });
  }
});

// PUT /api/admin/payment-config/rules - 更新混合支付/满减规则
router.put('/rules', async (req, res) => {
  try {
    const rules = req.body;
    if (!rules.discounts || !Array.isArray(rules.discounts)) {
      return res.status(400).json({ error: '折扣规则格式错误' });
    }
    await setConfig('payment_rules', rules);

    await prisma.auditLog.create({
      data: {
        adminId: req.admin?.id || 0,
        action: 'update_payment_rules',
        targetType: 'system',
        targetId: 'payment_rules',
        afterValue: JSON.stringify({ enabled: rules.enabled, mixEnabled: rules.mixEnabled, discountCount: rules.discounts.length }),
        reason: '更新支付规则',
        riskLevel: 'medium',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      }
    });

    res.json({ message: '支付规则已保存' });
  } catch (err) {
    console.error('[PaymentConfig] Update rules error:', err);
    res.status(500).json({ error: '保存支付规则失败' });
  }
});

export default router;
