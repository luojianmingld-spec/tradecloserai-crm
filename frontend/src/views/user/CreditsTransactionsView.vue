<template>
  <div class="tx-page">
    <div class="tx-inner">
      <div class="tx-header">
        <div>
          <h2 class="tx-title">积分明细</h2>
          <p class="tx-sub">当前余额 <b>{{ balance.toLocaleString() }}</b> 积分</p>
        </div>
        <router-link to="/credits" class="tx-link">去充值 →</router-link>
      </div>

      <div class="tx-panel">
        <el-table :data="list" v-loading="loading" stripe empty-text="暂无积分记录">
          <!-- 模型名称 -->
          <el-table-column label="模型名称" min-width="140" align="center">
            <template #default="{ row }">
              <span class="tx-model-name">{{ row.model || '-' }}</span>
            </template>
          </el-table-column>
          <!-- 用途 -->
          <el-table-column label="用途" min-width="120" align="center">
            <template #default="{ row }">{{ purposeText(row) }}</template>
          </el-table-column>
          <!-- 类型 -->
          <el-table-column label="类型" width="90" align="center">
            <template #default="{ row }">
              <span :class="['tx-type', row.amount >= 0 ? 'in' : 'out']">{{ typeLabel(row.type) }}</span>
            </template>
          </el-table-column>
          <!-- 时间 -->
          <el-table-column label="时间" width="160" align="center">
            <template #default="{ row }">{{ fmtTime(row.createdAt) }}</template>
          </el-table-column>
          <!-- 积分消耗 -->
          <el-table-column label="积分消耗" width="130" align="center">
            <template #default="{ row }">
              <span :class="row.amount >= 0 ? 'tx-amount-in' : 'tx-amount-out'">
                {{ row.amount >= 0 ? '+' : '' }}{{ row.amount.toLocaleString() }}
              </span>
            </template>
          </el-table-column>
          <!-- 操作 -->
          <el-table-column label="操作" width="110" align="center">
            <template #default="{ row }">
              <el-button v-if="row.type === 'recharge' && row.orderId" type="primary" link size="small"
                @click="viewOrder(row)">查看订单</el-button>
              <el-button v-else-if="row.type === 'recharge'" type="primary" link size="small"
                @click="goRecharge">去充值</el-button>
              <span v-else class="tx-op-none">-</span>
            </template>
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
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import api from '../../utils/api.js';

const router = useRouter();
const list = ref([]);
const balance = ref(0);
const total = ref(0);
const page = ref(1);
const pageSize = 20;
const loading = ref(false);

function typeLabel(t) {
  return { recharge: '充值', consume: '消耗', gift: '赠送', compensate: '补偿', freeze: '冻结', unfreeze: '解冻', deduct: '扣减' }[t] || t;
}
function fmtTime(s) {
  if (!s) return '-';
  const d = new Date(s);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
// 用途：从 reason 推断具体调用场景（话术生成/AI翻译等）
function purposeText(row) {
  const r = row.reason || '';
  if (r.includes('翻译')) return 'AI 翻译';
  if (r.includes('话术')) return '话术生成';
  if (r.includes('背调')) return '客户背调';
  if (r.includes('文档')) return '文档生成';
  if (r.includes('学习')) return '话术学习';
  if (r.includes('充值')) return '充值';
  if (r.includes('赠送') || r.includes('补偿')) return typeLabel(row.type);
  if (r && r !== 'AI 调用消耗' && r !== 'AI 调用消耗（按模型分级）') return r;
  return 'AI 调用';
}
function viewOrder(row) {
  ElMessage.info(`订单号：${row.orderId || '未知'}`);
}
function goRecharge() {
  router.push('/credits');
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
.tx-page { display: flex; justify-content: center; width: 100%; padding: 24px 16px 48px; box-sizing: border-box; }
.tx-inner { width: 100%; max-width: 960px; }
.tx-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.tx-title { font-size: 22px; font-weight: 700; margin: 0; }
.tx-sub { color: var(--text-secondary); font-size: 13px; margin: 4px 0 0; }
.tx-link { color: #409eff; font-size: 14px; text-decoration: none; }
.tx-panel { background: var(--el-bg-color, #fff); border: 1px solid var(--el-border-color-lighter, #ebeef5); border-radius: 12px; padding: 16px; }
.tx-model-name { font-size: 14px; font-weight: 600; color: var(--text-primary); }
.tx-type { font-size: 13px; padding: 2px 10px; border-radius: 4px; }
.tx-type.in { background: #f0f9eb; color: #67c23a; }
.tx-type.out { background: #fef0f0; color: #f56c6c; }
.tx-amount-in { color: #67c23a; font-weight: 600; }
.tx-amount-out { color: #f56c6c; font-weight: 600; }
.tx-op-none { color: var(--text-secondary); }
.tx-pager { margin-top: 16px; display: flex; justify-content: flex-end; }
</style>