<template>
  <div class="admin-page">
    <div class="page-header">
      <h2>支付管理</h2>
    </div>

    <el-tabs v-model="activeTab" type="border-card">
      <!-- 支付通道配置 -->
      <el-tab-pane label="支付通道" name="channels">
        <el-alert title="配置各支付通道的密钥与开关状态。密钥信息将加密存储。" type="info" :closable="false" style="margin-bottom:16px" />
        <div v-for="ch in channels" :key="ch.id" class="channel-card">
          <div class="channel-header">
            <div class="channel-name">
              <el-tag :type="ch.enabled ? 'success' : 'info'" size="small">{{ ch.enabled ? '已启用' : '未启用' }}</el-tag>
              <strong>{{ ch.name }}</strong>
              <span class="channel-id">({{ ch.id }})</span>
            </div>
            <el-switch v-model="ch.enabled" active-text="启用" inactive-text="关闭" />
          </div>
          <el-form label-width="110px" size="small" class="channel-form">
            <template v-if="ch.id === 'alipay'">
              <el-form-item label="AppID"><el-input v-model="ch.appId" placeholder="支付宝AppID" /></el-form-item>
              <el-form-item label="AppSecret"><el-input v-model="ch.appSecret" placeholder="应用私钥" type="password" show-password /></el-form-item>
              <el-form-item label="回调地址"><el-input v-model="ch.notifyUrl" placeholder="异步通知URL" /></el-form-item>
              <el-form-item label="费率(%)"><el-input-number v-model="ch.feeRate" :min="0" :max="100" :step="0.1" /></el-form-item>
            </template>
            <template v-else-if="ch.id === 'wechat'">
              <el-form-item label="商户号"><el-input v-model="ch.mchId" placeholder="微信商户号" /></el-form-item>
              <el-form-item label="API密钥"><el-input v-model="ch.apiKey" placeholder="APIv3密钥" type="password" show-password /></el-form-item>
              <el-form-item label="回调地址"><el-input v-model="ch.notifyUrl" placeholder="异步通知URL" /></el-form-item>
              <el-form-item label="费率(%)"><el-input-number v-model="ch.feeRate" :min="0" :max="100" :step="0.1" /></el-form-item>
            </template>
            <template v-else-if="ch.id === 'usdt'">
              <el-form-item label="收款钱包地址"><el-input v-model="ch.walletAddress" placeholder="TRC20钱包地址" /></el-form-item>
              <el-form-item label="费率(%)"><el-input-number v-model="ch.feeRate" :min="0" :max="100" :step="0.1" /></el-form-item>
            </template>
            <template v-else-if="ch.id === 'huobi'">
              <el-form-item label="商户ID"><el-input v-model="ch.merchantId" placeholder="火币支付商户ID" /></el-form-item>
              <el-form-item label="API Key"><el-input v-model="ch.apiKey" placeholder="API Key" type="password" show-password /></el-form-item>
              <el-form-item label="费率(%)"><el-input-number v-model="ch.feeRate" :min="0" :max="100" :step="0.1" /></el-form-item>
            </template>
          </el-form>
        </div>
        <div class="save-bar">
          <el-button type="primary" :loading="saving" @click="saveChannels" size="large">保存支付通道配置</el-button>
        </div>
      </el-tab-pane>

      <!-- 火币钱包管理 -->
      <el-tab-pane label="火币钱包" name="huobi">
        <el-alert title="火币支付通过OKX(原Huobi)网关实现，支持USDT/TRC20收款。" type="info" :closable="false" style="margin-bottom:16px" />
        <el-form :model="huobiWallet" label-width="130px" style="max-width:600px">
          <el-form-item label="启用状态">
            <el-switch v-model="huobiWallet.enabled" active-text="启用" inactive-text="关闭" />
          </el-form-item>
          <el-form-item label="收款钱包地址">
            <el-input v-model="huobiWallet.walletAddress" placeholder="TRC20 钱包地址" />
          </el-form-item>
          <el-form-item label="网络类型">
            <el-select v-model="huobiWallet.network" style="width:100%">
              <el-option label="TRC20 (Tron)" value="TRC20" />
              <el-option label="ERC20 (Ethereum)" value="ERC20" />
            </el-select>
          </el-form-item>
          <el-form-item label="商户ID">
            <el-input v-model="huobiWallet.merchantId" placeholder="OKX商户ID" />
          </el-form-item>
          <el-form-item label="API Key">
            <el-input v-model="huobiWallet.apiKey" placeholder="API Key" type="password" show-password />
          </el-form-item>
          <el-form-item label="Secret Key">
            <el-input v-model="huobiWallet.secretKey" placeholder="Secret Key" type="password" show-password />
          </el-form-item>
          <el-form-item label="回调URL">
            <el-input v-model="huobiWallet.callbackUrl" placeholder="支付回调通知地址" />
          </el-form-item>
          <el-form-item label="自动转换">
            <el-switch v-model="huobiWallet.autoConvert" active-text="收到USDT自动转为法币" inactive-text="保留USDT" />
          </el-form-item>
          <el-form-item label="最低金额(USDT)">
            <el-input-number v-model="huobiWallet.minAmount" :min="1" :max="100000" />
          </el-form-item>
        </el-form>
        <div class="save-bar">
          <el-button type="primary" :loading="saving" @click="saveHuobi">保存火币钱包配置</el-button>
        </div>
      </el-tab-pane>

      <!-- 混合支付 & 满减规则 -->
      <el-tab-pane label="混合支付/满减" name="rules">
        <el-alert title="混合支付允许用户使用多种支付方式组合付款；满减规则按订单金额自动抵扣。" type="info" :closable="false" style="margin-bottom:16px" />
        <el-form :model="paymentRules" label-width="130px" style="max-width:700px">
          <el-form-item label="混合支付">
            <el-switch v-model="paymentRules.mixEnabled" active-text="启用" inactive-text="关闭" />
            <span class="form-help">允许用户在一次订单中组合使用多种支付方式</span>
          </el-form-item>

          <el-divider>满减规则</el-divider>

          <el-form-item label="满减活动">
            <el-switch v-model="paymentRules.enabled" active-text="启用" inactive-text="关闭" />
          </el-form-item>

          <el-form-item label="折扣规则">
            <div v-for="(rule, idx) in paymentRules.discounts" :key="idx" class="discount-row">
              <el-input-number v-model="rule.minAmount" :min="0" placeholder="满" controls-position="right" style="width:130px" />
              <span class="discount-sep">满</span>
              <el-input-number v-model="rule.discount" :min="0" placeholder="减" controls-position="right" style="width:130px" />
              <span class="discount-sep">减</span>
              <el-input v-model="rule.label" placeholder="规则描述" style="width:160px" />
              <el-button type="danger" :icon="Delete" circle size="small" @click="removeDiscount(idx)" />
            </div>
            <el-button type="primary" plain @click="addDiscount" size="small">+ 添加规则</el-button>
          </el-form-item>

          <el-form-item label="最大优惠(元)">
            <el-input-number v-model="paymentRules.maxDiscount" :min="0" :max="100000" />
          </el-form-item>
          <el-form-item label="可叠加">
            <el-switch v-model="paymentRules.stackable" active-text="可叠加" inactive-text="取最优" />
          </el-form-item>
        </el-form>
        <div class="save-bar">
          <el-button type="primary" :loading="saving" @click="saveRules">保存支付规则</el-button>
        </div>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { Delete } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import api from '../../utils/api.js';

const activeTab = ref('channels');
const saving = ref(false);
const channels = ref([]);
const huobiWallet = reactive({
  enabled: false, walletAddress: '', network: 'TRC20', merchantId: '',
  apiKey: '', secretKey: '', callbackUrl: '', autoConvert: true, minAmount: 10
});
const paymentRules = reactive({
  enabled: false, mixEnabled: false, maxDiscount: 200, stackable: false,
  discounts: [
    { minAmount: 100, discount: 5, label: '满100减5' },
    { minAmount: 300, discount: 20, label: '满300减20' },
    { minAmount: 500, discount: 50, label: '满500减50' },
    { minAmount: 1000, discount: 120, label: '满1000减120' }
  ]
});

async function loadChannels() {
  try {
    const res = await api.get('/admin/payment-config/channels');
    const d = res.data?.data || res.data || [];
    channels.value = Array.isArray(d) ? d : [];
  } catch (e) { console.warn('loadChannels error:', e); }
}

async function loadHuobi() {
  try {
    const res = await api.get('/admin/payment-config/huobi-wallet');
    const d = res.data?.data || res.data || {};
    Object.assign(huobiWallet, d);
  } catch (e) { console.warn('loadHuobi error:', e); }
}

async function loadRules() {
  try {
    const res = await api.get('/admin/payment-config/rules');
    const d = res.data?.data || res.data || {};
    Object.assign(paymentRules, d);
  } catch (e) { console.warn('loadRules error:', e); }
}

async function saveChannels() {
  saving.value = true;
  try {
    await api.put('/admin/payment-config/channels', { channels: channels.value });
    ElMessage.success('支付通道配置已保存');
  } catch (e) { ElMessage.error('保存失败'); }
  finally { saving.value = false; }
}

async function saveHuobi() {
  saving.value = true;
  try {
    await api.put('/admin/payment-config/huobi-wallet', { ...huobiWallet });
    ElMessage.success('火币钱包配置已保存');
  } catch (e) { ElMessage.error('保存失败'); }
  finally { saving.value = false; }
}

async function saveRules() {
  saving.value = true;
  try {
    await api.put('/admin/payment-config/rules', { ...paymentRules });
    ElMessage.success('支付规则已保存');
  } catch (e) { ElMessage.error('保存失败'); }
  finally { saving.value = false; }
}

function addDiscount() {
  paymentRules.discounts.push({ minAmount: 0, discount: 0, label: '' });
}

function removeDiscount(idx) {
  paymentRules.discounts.splice(idx, 1);
}

onMounted(() => { loadChannels(); loadHuobi(); loadRules(); });
</script>

<style scoped>
.admin-page { padding: 20px; }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.page-header h2 { margin: 0; font-size: 20px; }
.channel-card { background: var(--bg-card, #fff); border: 1px solid #e4e7ed; border-radius: 12px; padding: 16px 20px; margin-bottom: 16px; }
.channel-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.channel-name { display: flex; align-items: center; gap: 8px; font-size: 15px; }
.channel-id { color: #909399; font-size: 13px; }
.channel-form { margin-top: 8px; }
.save-bar { display: flex; justify-content: center; margin-top: 24px; padding-top: 16px; border-top: 1px solid #e4e7ed; }
.discount-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.discount-sep { color: #909399; font-size: 14px; }
.form-help { color: #909399; font-size: 12px; margin-left: 8px; }
</style>
