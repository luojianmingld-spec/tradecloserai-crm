<template>
  <div class="tx-page">
    <div class="tx-header">
      <div>
        <h2 class="tx-title">积分明细</h2>
        <p class="tx-sub">当前余额 <b>{{ balance.toLocaleString() }}</b> 积分</p>
      </div>
      <router-link to="/credits" class="tx-link">去充值 →</router-link>
    </div>

    <div class="tx-panel">
      <el-table :data="list" v-loading="loading" stripe empty-text="暂无积分记录">
        <el-table-column label="类型" width="110">
          <template #default="{ row }">
            <span :class="['tx-type', row.amount >= 0 ? 'in' : 'out']">{{ typeLabel(row.type) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="变动" width="140" align="right">
          <template #default="{ row }">
            <span :class="row.amount >= 0 ? 'tx-amount-in' : 'tx-amount-out'">
              {{ row.amount >= 0 ? '+' : '' }}{{ row.amount.toLocaleString() }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="balanceAfter" label="余额" width="120" align="right">
          <template #default="{ row }">{{ row.balanceAfter.toLocaleString() }}</template>
        </el-table-column>
        <el-table-column prop="reason" label="说明" min-width="160" show-overflow-tooltip />
        <el-table-column label="时间" width="170">
          <template #default="{ row }">{{ fmtTime(row.createdAt) }}</template>
        </el-table-column>
      </el-table>

      <div class="tx-pager">
        <el-pagination
          layout="prev, pager, next, total"
          :total="total"
          :page-size="pageSize"
          :current-page="page"
          @current-change="loadPage"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import api from '../../utils/api.js';

const list = ref([]);
const balance = ref(0);
const total = ref(0);
const page = ref(1);
const pageSize = 20;
const loading = ref(false);

function typeLabel(t) {
  return { recharge: '充值', consume: '消耗', gift: '赠送', compensate: '补偿', freeze: '冻结', unfreeze: '解冻' }[t] || t;
}
function fmtTime(s) {
  if (!s) return '-';
  const d = new Date(s);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

async function loadPage(p) {
  page.value = p || 1;
  loading.value = true;
  try {
    const [txRes, balRes] = await Promise.all([
      api.get('/payments/transactions', { params: { page: page.value, pageSize } }),
      api.get('/payments/balance'),
    ]);
    list.value = txRes.data.data.list;
    total.value = txRes.data.data.total;
    balance.value = balRes.data.data.balance;
  } catch (e) {
    // 静默
  } finally {
    loading.value = false;
  }
}

onMounted(() => loadPage(1));
</script>

<style scoped>
.tx-page { max-width: 860px; margin: 0 auto; padding: 24px 16px 48px; }
.tx-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.tx-title { font-size: 22px; font-weight: 700; margin: 0; }
.tx-sub { color: #8a94a6; font-size: 13px; margin: 4px 0 0; }
.tx-link { color: #409eff; font-size: 14px; text-decoration: none; }
.tx-panel { background: var(--el-bg-color, #fff); border: 1px solid var(--el-border-color-lighter, #ebeef5); border-radius: 12px; padding: 16px; }
.tx-type { font-size: 13px; padding: 2px 8px; border-radius: 4px; }
.tx-type.in { background: #f0f9eb; color: #67c23a; }
.tx-type.out { background: #fef0f0; color: #f56c6c; }
.tx-amount-in { color: #67c23a; font-weight: 600; }
.tx-amount-out { color: #f56c6c; font-weight: 600; }
.tx-pager { margin-top: 16px; display: flex; justify-content: flex-end; }
</style>
