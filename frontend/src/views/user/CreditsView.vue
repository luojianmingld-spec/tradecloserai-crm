<template>
  <div class="credits-page">
    <div class="cp-header">
      <div>
        <h2 class="cp-title">积分充值</h2>
        <p class="cp-sub">AI 调用每次消耗 150 积分 · 1 元 = 1000 积分 · 50 元起充</p>
      </div>
      <router-link to="/credits/transactions" class="cp-link">积分明细 →</router-link>
    </div>

    <!-- 余额卡片 -->
    <div class="cp-balance-card">
      <div class="cp-balance-label">当前积分余额</div>
      <div class="cp-balance-value">{{ balance.toLocaleString() }}</div>
      <div class="cp-balance-tip">约可调用 AI 功能 {{ Math.floor(balance / aiCost) }} 次</div>
    </div>

    <!-- 充值档位 -->
    <div class="cp-panel">
      <div class="cp-panel-title">选择充值金额</div>
      <div class="cp-presets">
        <div
          v-for="p in presets"
          :key="p"
          class="cp-preset"
          :class="{ active: selectedPreset === p }"
          @click="selectPreset(p)"
        >
          <div class="cp-preset-amount">¥{{ p }}</div>
          <div class="cp-preset-credits">{{ p * creditPerYuan }} 积分</div>
        </div>
        <div class="cp-preset custom" :class="{ active: customMode }" @click="selectCustom">
          <div class="cp-preset-amount">自定义</div>
          <div class="cp-preset-credits">金额自填</div>
        </div>
      </div>

      <div v-if="customMode" class="cp-custom-row">
        <span class="cp-custom-prefix">¥</span>
        <el-input
          v-model.number="customAmount"
          placeholder="请输入充值金额"
          type="number"
          min="50"
          :step="50"
          class="cp-custom-input"
          @keyup.enter="createOrder"
        />
        <span class="cp-custom-tip">最低 50 元</span>
      </div>

      <div class="cp-order-row">
        <div class="cp-order-amount">
          应付 <b>¥{{ currentAmount }}</b>（到账 {{ currentCredits }} 积分）
        </div>
        <el-button type="primary" size="large" :loading="creating" :disabled="!currentAmount" @click="createOrder">
          立即充值
        </el-button>
      </div>
    </div>

    <!-- 支付二维码 -->
    <div v-if="payment.show" class="cp-panel cp-pay-panel">
      <div class="cp-panel-title">扫码支付</div>
      <div class="cp-pay-body">
        <div class="cp-qr-wrap">
          <img v-if="payment.codeUrl" :src="payment.qrDataUrl" class="cp-qr-img" alt="支付二维码" />
          <div v-else class="cp-qr-loading">二维码生成中…</div>
          <div class="cp-qr-order">订单号：{{ payment.orderNo }}</div>
        </div>
        <div class="cp-pay-tip">
          <p>请使用 <b>微信/支付宝</b> 扫码完成支付</p>
          <p class="cp-pay-sub">支付完成后会自动到账，请勿关闭本页面</p>
          <el-button size="small" text @click="refreshOrder">刷新支付状态</el-button>
        </div>
      </div>
    </div>

    <!-- 人工充值引导（通道未启用） -->
    <div v-if="payment.manual" class="cp-panel cp-manual-panel">
      <div class="cp-panel-title">⚠️ 在线支付通道开通中</div>
      <p>当前在线支付通道正在开通，暂不支持扫码自助充值。</p>
      <p>如需充值，请 <b>微信/支付宝转账</b> 后联系客服人工到账：</p>
      <ul class="cp-manual-list">
        <li>转账时备注你的<b>用户名</b>，便于核对到账</li>
        <li>到账后按 1 元 = 1000 积分 自动充入</li>
        <li>订单号：{{ payment.orderNo }}</li>
      </ul>
      <el-button type="primary" plain @click="copyManualInfo">复制充值信息</el-button>
    </div>

    <!-- 充值成功 -->
    <div v-if="payment.paid" class="cp-panel cp-success-panel">
      <div class="cp-success-icon">✅</div>
      <div class="cp-success-title">充值成功！</div>
      <div class="cp-success-amount">{{ payment.credits.toLocaleString() }} 积分已到账</div>
      <el-button type="primary" @click="payment.paid = false; refreshBalance()">继续充值</el-button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import QRCode from 'qrcode';
import { ElMessage } from 'element-plus';
import api from '../../utils/api.js';

const balance = ref(0);
const aiCost = ref(150);
const creditPerYuan = ref(1000);
const minRecharge = ref(50);
const presets = [50, 100, 200, 500, 1000];

const selectedPreset = ref(50);
const customMode = ref(false);
const customAmount = ref(null);
const creating = ref(false);

const payment = ref({ show: false, manual: false, paid: false, codeUrl: '', qrDataUrl: '', orderNo: '', credits: 0 });
let pollTimer = null;

const currentAmount = computed(() => {
  if (customMode.value) return customAmount.value || 0;
  return selectedPreset.value;
});
const currentCredits = computed(() => Math.round((currentAmount.value || 0) * creditPerYuan.value));

function selectPreset(p) {
  selectedPreset.value = p;
  customMode.value = false;
  payment.value.show = false;
  payment.value.manual = false;
}
function selectCustom() {
  customMode.value = true;
  selectedPreset.value = null;
  payment.value.show = false;
  payment.value.manual = false;
}

async function refreshBalance() {
  try {
    const { data } = await api.get('/payments/balance');
    balance.value = data.data.balance;
    aiCost.value = data.data.aiCostPerCall || 150;
    creditPerYuan.value = data.data.creditPerYuan || 1000;
    minRecharge.value = data.data.minRechargeYuan || 100;
  } catch (e) {
    // 静默
  }
}

async function createOrder() {
  if (!currentAmount.value || currentAmount.value < minRecharge.value) {
    ElMessage.warning(`充值金额需不低于 ${minRecharge.value} 元`);
    return;
  }
  creating.value = true;
  try {
    const payload = customMode.value ? { amount: currentAmount.value } : { preset: currentAmount.value };
    const { data } = await api.post('/payments/orders', payload);
    const d = data.data;
    payment.value.orderNo = d.orderNo;
    payment.value.credits = d.credits;
    payment.value.manual = !!d.manualRecharge;
    payment.value.paid = false;

    if (d.codeUrl) {
      payment.value.show = true;
      payment.value.codeUrl = d.codeUrl;
      payment.value.qrDataUrl = await QRCode.toDataURL(d.codeUrl, { margin: 1, width: 220, color: { dark: '#000000', light: '#ffffff' } });
      startPolling();
    } else if (d.manualRecharge) {
      payment.value.show = false;
      payment.value.manual = true;
    }
  } catch (e) {
    ElMessage.error(e.response?.data?.error || '下单失败，请重试');
  } finally {
    creating.value = false;
  }
}

async function refreshOrder() {
  if (!payment.value.orderNo) return;
  try {
    const { data } = await api.get(`/payments/orders/${payment.value.orderNo}`);
    const d = data.data;
    if (d.status === 'paid') {
      stopPolling();
      payment.value.show = false;
      payment.value.manual = false;
      payment.value.paid = true;
      refreshBalance();
    }
  } catch (e) { /* ignore */ }
}

function startPolling() {
  stopPolling();
  pollTimer = setInterval(refreshOrder, 3000);
}
function stopPolling() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
}

function copyManualInfo() {
  const text = `订单号：${payment.value.orderNo}\n金额：¥${currentAmount.value}\n积分：${currentCredits.value}\n请备注用户名后转账，联系客服人工到账`;
  navigator.clipboard?.writeText(text).then(() => ElMessage.success('已复制充值信息')).catch(() => ElMessage.info(text));
}

onMounted(refreshBalance);
onBeforeUnmount(stopPolling);
</script>

<style scoped>
.credits-page { max-width: 720px; margin: 0 auto; padding: 24px 16px 48px; }
.cp-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.cp-title { font-size: 22px; font-weight: 700; margin: 0; }
.cp-sub { color: #8a94a6; font-size: 13px; margin: 4px 0 0; }
.cp-link { color: #409eff; font-size: 14px; text-decoration: none; }

.cp-balance-card { background: linear-gradient(135deg, #1f6feb, #0a4bbd); color: #fff; border-radius: 14px; padding: 22px 24px; margin-bottom: 20px; }
.cp-balance-label { font-size: 14px; opacity: .85; }
.cp-balance-value { font-size: 38px; font-weight: 800; margin: 6px 0 2px; }
.cp-balance-tip { font-size: 13px; opacity: .8; }

.cp-panel { background: var(--el-bg-color, #fff); border: 1px solid var(--el-border-color-lighter, #ebeef5); border-radius: 12px; padding: 20px; margin-bottom: 16px; }
.cp-panel-title { font-size: 16px; font-weight: 600; margin-bottom: 16px; }

.cp-presets { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.cp-preset { border: 1.5px solid var(--el-border-color, #dcdfe6); border-radius: 10px; padding: 14px 10px; text-align: center; cursor: pointer; transition: all .15s; }
.cp-preset:hover { border-color: #409eff; }
.cp-preset.active { border-color: #409eff; background: #ecf5ff; }
.cp-preset-amount { font-size: 18px; font-weight: 700; }
.cp-preset-credits { font-size: 12px; color: #8a94a6; margin-top: 4px; }

.cp-custom-row { display: flex; align-items: center; gap: 8px; margin-top: 14px; }
.cp-custom-prefix { font-size: 18px; font-weight: 600; }
.cp-custom-input { width: 200px; }
.cp-custom-tip { color: #8a94a6; font-size: 13px; }

.cp-order-row { display: flex; justify-content: space-between; align-items: center; margin-top: 20px; padding-top: 16px; border-top: 1px dashed var(--el-border-color-lighter, #ebeef5); }
.cp-order-amount { font-size: 15px; }
.cp-order-amount b { font-size: 22px; color: #f56c6c; }

.cp-pay-body { display: flex; gap: 24px; align-items: center; }
.cp-qr-wrap { text-align: center; }
.cp-qr-img { width: 220px; height: 220px; border: 1px solid #eee; border-radius: 8px; }
.cp-qr-loading { width: 220px; height: 220px; display: flex; align-items: center; justify-content: center; color: #8a94a6; border: 1px solid #eee; border-radius: 8px; }
.cp-qr-order { font-size: 12px; color: #8a94a6; margin-top: 8px; }
.cp-pay-tip { font-size: 15px; }
.cp-pay-sub { color: #8a94a6; font-size: 13px; }

.cp-manual-panel p { margin: 6px 0; font-size: 14px; }
.cp-manual-list { margin: 8px 0 14px; padding-left: 20px; }
.cp-manual-list li { margin: 4px 0; font-size: 14px; }

.cp-success-panel { text-align: center; padding: 32px 20px; }
.cp-success-icon { font-size: 40px; }
.cp-success-title { font-size: 20px; font-weight: 700; margin: 10px 0 4px; }
.cp-success-amount { color: #67c23a; font-size: 16px; margin-bottom: 16px; }

@media (max-width: 600px) {
  .cp-presets { grid-template-columns: repeat(2, 1fr); }
  .cp-pay-body { flex-direction: column; }
}
</style>
