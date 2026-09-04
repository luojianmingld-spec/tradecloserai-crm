/**
 * payment.js - 支付多通道适配器
 *
 * 通道策略（决策 v1.3 + Jeremy 拍板 2026-08-19）：
 *   - 内测期：YunGouOS 聚合支付（个人/小微可签、无需对公、费率 0.6%、资金由微信/支付宝官方直结无二清）
 *   - 对公账户办好后：切换微信官方直连（APIv3），代码已留骨架
 *
 * 通道配置存于 systemConfig 'payment_channels'（admin/payment_config.js 管理，GET/PUT /api/admin/payment-config/channels）
 *   - yungouos 通道字段：mchId / payKey / notifyUrl / feeRate / enabled
 *   - wechat 通道字段：mchId / apiKey / notifyUrl / feeRate / enabled（官方直连需扩展 serialNo/privateKey/apiv3Key）
 *
 * 铁律：禁装新 npm 依赖 → 用 node:crypto + 全局 fetch 自行实现 MD5 签名与 HTTP 请求，不装 SDK
 */
import crypto from 'node:crypto';
import { prisma } from './credits.js';

const YUNGOUOS_API = 'https://api.pay.yungouos.com';
const WECHAT_API = 'https://api.mch.weixin.qq.com';

// ================= 通道配置读取 =================

export async function getChannelConfig(channelId) {
  const row = await prisma.systemConfig.findUnique({ where: { key: 'payment_channels' } });
  let channels = [];
  if (row) {
    try { channels = JSON.parse(row.value); } catch { channels = []; }
  }
  const ch = channels.find((c) => c.id === channelId);
  return ch && ch.enabled ? ch : null;
}

/** 获取当前生效通道：内测期 yungouos 优先，未启用则看 wechat 官方 */
export async function getActiveChannel() {
  const yg = await getChannelConfig('yungouos');
  if (yg) return { id: 'yungouos', config: yg };
  const wx = await getChannelConfig('wechat');
  if (wx) return { id: 'wechat', config: wx };
  return null;
}

// ================= YunGouOS（MD5 签名，无需证书） =================

function md5(str) {
  return crypto.createHash('md5').update(str, 'utf8').digest('hex').toUpperCase();
}

/**
 * YunGouOS 签名：指定参数按 key ASCII 升序拼接 key=value&...&key=支付密钥 → MD5 大写
 * @param {object} params 全部参数
 * @param {string} payKey 支付密钥
 * @param {string[]} signKeys 参与签名的字段（必传参数），默认全部
 */
export function yungouosSign(params, payKey, signKeys = null) {
  const keys = (signKeys || Object.keys(params)).sort();
  const str = keys.map((k) => `${k}=${params[k] ?? ''}`).join('&') + `&key=${payKey}`;
  return md5(str);
}

/**
 * YunGouOS nativePay 下单
 * @param {object} args { outTradeNo, totalFee(元,string), body, notifyUrl, attach, config }
 * @returns {Promise<{channel:'yungouos', codeUrl, orderNo, raw}>}
 */
export async function yungouosNativePay({ outTradeNo, totalFee, body, notifyUrl, attach, config }) {
  const params = {
    out_trade_no: outTradeNo,
    total_fee: totalFee,           // 单位：元
    mch_id: config.mchId,
    body,
  };
  params.type = 'native';
  if (attach) params.attach = attach;
  if (notifyUrl) params.notify_url = notifyUrl;

  // 官方文档：签名仅必传参数参与（out_trade_no,total_fee,mch_id,body）
  const paySign = yungouosSign(params, config.payKey, ['out_trade_no', 'total_fee', 'mch_id', 'body']);
  params.paySign = paySign;

  const form = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => form.append(k, String(v)));

  const resp = await fetch(`${YUNGOUOS_API}/api/pay/nativePay`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });
  const data = await resp.json();
  if (data.code !== 0) {
    throw new Error(`YunGouOS 下单失败(${data.code}): ${data.msg || data.message || JSON.stringify(data)}`);
  }
  return {
    channel: 'yungouos',
    codeUrl: data.data?.codeUrl || data.data?.code_url,
    orderNo: data.data?.orderNo || outTradeNo,
    raw: data,
  };
}

/**
 * YunGouOS 主动查单
 * @returns {Promise<object>} data 为查询结果对象
 */
export async function yungouosQuery({ outTradeNo, config }) {
  const params = { mch_id: config.mchId, out_trade_no: outTradeNo };
  const sign = yungouosSign(params, config.payKey, ['mch_id', 'out_trade_no']);
  const query = new URLSearchParams({ ...params, sign });
  const resp = await fetch(`${YUNGOUOS_API}/api/pay/queryPayOrderInfo?${query.toString()}`, {
    method: 'GET',
  });
  const data = await resp.json();
  if (data.code !== 0) {
    throw new Error(`YunGouOS 查单失败(${data.code}): ${data.msg || data.message}`);
  }
  return data;
}

/**
 * YunGouOS 回调验签：全部非 sign 字段 ASCII 排序拼接 &key=密钥 → MD5 大写，与 sign 比对
 */
export function yungouosVerifyNotify(body, config) {
  if (!body || typeof body !== 'object') return false;
  const sign = body.sign;
  if (!sign) return false;
  const rest = {};
  Object.keys(body).forEach((k) => { if (k !== 'sign') rest[k] = body[k]; });
  const signStr = yungouosSign(rest, config.payKey);
  return signStr === String(sign).toUpperCase();
}

// ================= 微信官方直连 APIv3（预留，对公办好后切换） =================

/**
 * 微信 Native 下单（APIv3）
 * 需配置：mchid / serialNo / privateKey / apiv3Key
 * TODO: 对公账户办好后实现完整 RSA-SHA256 签名 + AES-256-GCM 回调解密
 */
export async function wechatNativePay({ outTradeNo, totalFeeFen, body, notifyUrl, config }) {
  // 占位：通道未启用时不会走到这里；启用前需补齐实现
  throw new Error('微信官方直连通道暂未启用，请使用聚合支付或联系管理员');
}

// ================= 统一入口 =================

/**
 * 创建支付（按当前生效通道分发）
 * @param {object} args { order: PaymentOrder, notifyBaseUrl: 回调域名前缀 }
 * @returns {Promise<{channel, codeUrl, manual, orderNo}>} manual=true 表示无可用通道，走人工充值引导
 */
export async function createPayment({ order, notifyBaseUrl }) {
  const active = await getActiveChannel();
  if (!active) {
    return { channel: 'manual', codeUrl: null, manual: true, orderNo: order.orderNo };
  }
  const { id, config } = active;
  if (id === 'yungouos') {
    const notifyUrl = config.notifyUrl || `${notifyBaseUrl}/api/payment/notify/yungouos`;
    const result = await yungouosNativePay({
      outTradeNo: order.orderNo,
      totalFee: order.amount.toFixed(2),
      body: `话术库积分充值 ${order.amount}元`,
      notifyUrl,
      attach: String(order.userId),
      config,
    });
    return { ...result, manual: false };
  }
  if (id === 'wechat') {
    const notifyUrl = config.notifyUrl || `${notifyBaseUrl}/api/payment/notify/wechat`;
    const result = await wechatNativePay({
      outTradeNo: order.orderNo,
      totalFeeFen: Math.round(order.amount * 100),
      body: `话术库积分充值 ${order.amount}元`,
      notifyUrl,
      config,
    });
    return { ...result, manual: false };
  }
  return { channel: 'manual', codeUrl: null, manual: true, orderNo: order.orderNo };
}

export { md5, YUNGOUOS_API, WECHAT_API };
