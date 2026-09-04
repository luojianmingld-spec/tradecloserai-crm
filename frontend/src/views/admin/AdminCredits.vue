<template>
  <div class="admin-page">
    <div class="page-header">
      <h2>积分管理</h2>
      <div class="header-actions">
        <el-button type="success" @click="showRechargeDialog">充值积分</el-button>
        <el-button type="warning" @click="showDeductDialog">扣减积分</el-button>
      </div>
    </div>

    <!-- 积分概览 -->
    <div class="stat-cards">
      <div class="stat-card primary">
        <div class="stat-value">{{ overview.totalRecharged || 0 }}</div>
        <div class="stat-label">总充值积分</div>
      </div>
      <div class="stat-card success">
        <div class="stat-value">{{ overview.totalConsumed || 0 }}</div>
        <div class="stat-label">已消耗积分</div>
      </div>
      <div class="stat-card info">
        <div class="stat-value">{{ overview.netPool || 0 }}</div>
        <div class="stat-label">净余额</div>
      </div>
      <div class="stat-card warning">
        <div class="stat-value">{{ overview.todayConsumed || 0 }}</div>
        <div class="stat-label">今日消耗</div>
      </div>
    </div>

    <!-- 积分流水 -->
    <div class="section-card">
      <div class="section-header">
        <h3>积分流水</h3>
        <div class="filter-bar">
          <el-select v-model="txFilter.type" placeholder="类型" clearable style="width:120px" @change="loadTransactions">
            <el-option label="充值" value="recharge" />
            <el-option label="消耗" value="consume" />
            <el-option label="赠送" value="gift" />
          </el-select>
          <el-input v-model="txFilter.userId" placeholder="用户ID" clearable style="width:120px" @keyup.enter="loadTransactions" />
        </div>
      </div>
      <el-table :data="transactions" stripe style="width:100%" v-loading="txLoading">
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column prop="userId" label="用户ID" width="90" />
        <el-table-column prop="type" label="类型" width="90">
          <template #default="{ row }">
            <el-tag :type="txTypeTag(row.type)" size="small">{{ txTypeLabel(row.type) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="amount" label="数量" width="100">
          <template #default="{ row }">
            <span :style="{ color: row.amount > 0 ? '#67c23a' : '#f56c6c', fontWeight: 600 }">
              {{ row.amount > 0 ? '+' : '' }}{{ row.amount }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="balanceAfter" label="变更后余额" width="110" />
        <el-table-column prop="reason" label="原因" show-overflow-tooltip />
        <el-table-column label="时间" width="180">
          <template #default="{ row }">{{ new Date(row.createdAt).toLocaleString('zh-CN') }}</template>
        </el-table-column>
      </el-table>
      <div class="pagination-wrap" v-if="txTotal > txPageSize">
        <el-pagination layout="total, prev, pager, next" :total="txTotal" :page-size="txPageSize" v-model:current-page="txPage" @current-change="loadTransactions" />
      </div>
    </div>

    <!-- 充值对话框 -->
    <el-dialog v-model="rechargeDialog.visible" title="充值积分" width="440px">
      <el-form :model="rechargeDialog.form" label-width="80px">
        <el-form-item label="用户ID" required>
          <el-input-number v-model="rechargeDialog.form.userId" :min="1" style="width:100%" />
        </el-form-item>
        <el-form-item label="积分数量" required>
          <el-input-number v-model="rechargeDialog.form.amount" :min="1" :max="100000" style="width:100%" />
        </el-form-item>
        <el-form-item label="原因" required>
          <el-input v-model="rechargeDialog.form.reason" placeholder="充值原因" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="rechargeDialog.visible = false">取消</el-button>
        <el-button type="success" :loading="rechargeDialog.loading" @click="doRecharge">确认充值</el-button>
      </template>
    </el-dialog>

    <!-- 扣减对话框 -->
    <el-dialog v-model="deductDialog.visible" title="扣减积分" width="440px">
      <el-form :model="deductDialog.form" label-width="80px">
        <el-form-item label="用户ID" required>
          <el-input-number v-model="deductDialog.form.userId" :min="1" style="width:100%" />
        </el-form-item>
        <el-form-item label="扣减数量" required>
          <el-input-number v-model="deductDialog.form.amount" :min="1" :max="100000" style="width:100%" />
        </el-form-item>
        <el-form-item label="原因" required>
          <el-input v-model="deductDialog.form.reason" placeholder="扣减原因（必填）" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="deductDialog.visible = false">取消</el-button>
        <el-button type="warning" :loading="deductDialog.loading" @click="doDeduct">确认扣减</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import api from '../../utils/api.js';

const overview = ref({});
const transactions = ref([]);
const txTotal = ref(0);
const txPage = ref(1);
const txPageSize = 20;
const txLoading = ref(false);
const txFilter = reactive({ type: '', userId: '' });

const rechargeDialog = reactive({ visible: false, loading: false, form: { userId: 1, amount: 100, reason: '' } });
const deductDialog = reactive({ visible: false, loading: false, form: { userId: 1, amount: 1, reason: '' } });

function txTypeLabel(t) { return { recharge: '充值', consume: '消耗', gift: '赠送' }[t] || t; }
function txTypeTag(t) { return { recharge: 'success', consume: 'danger', gift: 'warning' }[t] || 'info'; }

async function loadOverview() {
  try {
    const res = await api.get('/admin/credits/overview');
    const d = res.data?.data || res.data || {};
    overview.value = d;
  } catch (e) { console.warn('loadOverview error:', e); }
}

async function loadTransactions() {
  txLoading.value = true;
  try {
    const params = { page: txPage.value, pageSize: txPageSize };
    if (txFilter.type) params.type = txFilter.type;
    if (txFilter.userId) params.userId = txFilter.userId;
    const res = await api.get('/admin/credits/transactions', { params });
    const d = res.data;
    transactions.value = d?.data || d || [];
    txTotal.value = d?.total || 0;
  } catch (e) { console.warn('loadTx error:', e); }
  finally { txLoading.value = false; }
}

function showRechargeDialog() { rechargeDialog.form = { userId: 1, amount: 100, reason: '' }; rechargeDialog.visible = true; }
function showDeductDialog() { deductDialog.form = { userId: 1, amount: 1, reason: '' }; deductDialog.visible = true; }

async function doRecharge() {
  if (!rechargeDialog.form.reason) { ElMessage.warning('请填写原因'); return; }
  rechargeDialog.loading = true;
  try {
    await api.post('/admin/credits/recharge', rechargeDialog.form);
    ElMessage.success('充值成功');
    rechargeDialog.visible = false;
    loadOverview(); loadTransactions();
  } catch (e) { ElMessage.error(e.response?.data?.error || '充值失败'); }
  finally { rechargeDialog.loading = false; }
}

async function doDeduct() {
  if (!deductDialog.form.reason) { ElMessage.warning('请填写扣减原因'); return; }
  deductDialog.loading = true;
  try {
    await api.post('/admin/credits/deduct', deductDialog.form);
    ElMessage.success('扣减成功');
    deductDialog.visible = false;
    loadOverview(); loadTransactions();
  } catch (e) { ElMessage.error(e.response?.data?.error || '扣减失败'); }
  finally { deductDialog.loading = false; }
}

onMounted(() => { loadOverview(); loadTransactions(); });
</script>

<style scoped>
.admin-page { padding: 20px; }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 12px; }
.page-header h2 { margin: 0; font-size: 20px; }
.stat-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 16px; margin-bottom: 24px; }
.stat-card { background: var(--bg-card, #fff); border-radius: 12px; padding: 20px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.08); border-left: 4px solid #409eff; }
.stat-card.success { border-left-color: #67c23a; }
.stat-card.warning { border-left-color: #e6a23c; }
.stat-card.info { border-left-color: #909399; }
.stat-card.primary { border-left-color: #409eff; }
.stat-value { font-size: 28px; font-weight: 700; color: #303133; margin-bottom: 6px; }
.stat-label { font-size: 13px; color: #909399; }
.section-card { background: var(--bg-card, #fff); border-radius: 12px; padding: 20px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
.section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.section-header h3 { margin: 0; font-size: 16px; }
.filter-bar { display: flex; gap: 8px; }
.pagination-wrap { display: flex; justify-content: flex-end; margin-top: 16px; }
</style>
