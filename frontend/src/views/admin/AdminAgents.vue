<template>
  <div class="admin-page">
    <div class="page-header">
      <h2>Agent管理</h2>
      <el-button type="primary" @click="refreshData" :loading="loading">刷新数据</el-button>
    </div>

    <!-- 统计卡片 -->
    <div class="stat-cards">
      <div class="stat-card">
        <div class="stat-value">{{ overview.totalCalls || 0 }}</div>
        <div class="stat-label">总调用次数</div>
      </div>
      <div class="stat-card success">
        <div class="stat-value">{{ overview.successRate || '0%' }}</div>
        <div class="stat-label">成功率</div>
      </div>
      <div class="stat-card warning">
        <div class="stat-value">{{ overview.failedCalls || 0 }}</div>
        <div class="stat-label">失败次数</div>
      </div>
      <div class="stat-card info">
        <div class="stat-value">{{ overview.avgResponseTime ? overview.avgResponseTime + 'ms' : '-' }}</div>
        <div class="stat-label">平均响应时间</div>
      </div>
      <div class="stat-card primary">
        <div class="stat-value">{{ overview.todayCalls || 0 }}</div>
        <div class="stat-label">今日调用</div>
      </div>
      <div class="stat-card danger">
        <div class="stat-value">{{ overview.todayFailed || 0 }}</div>
        <div class="stat-label">今日失败</div>
      </div>
    </div>

    <!-- Agent分类统计 -->
    <div class="section-card">
      <h3>Agent类型分布</h3>
      <el-table :data="overview.byType || []" stripe style="width:100%">
        <el-table-column prop="agentType" label="Agent类型" width="200" />
        <el-table-column prop="count" label="总调用" width="120" />
        <el-table-column prop="success" label="成功" width="120">
          <template #default="{ row }">
            <span style="color:#67c23a">{{ row.success }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="failed" label="失败" width="120">
          <template #default="{ row }">
            <span :style="{ color: row.failed > 0 ? '#f56c6c' : '#909399' }">{{ row.failed }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="avgResponseTime" label="平均耗时" width="150" />
        <el-table-column label="成功率" width="150">
          <template #default="{ row }">
            <el-progress :percentage="row.count > 0 ? Math.round(row.success / row.count * 100) : 0" :status="row.count > 0 && row.success / row.count >= 0.9 ? 'success' : row.count > 0 && row.success / row.count >= 0.7 ? '' : 'exception'" />
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 错误日志 -->
    <div class="section-card">
      <div class="section-header">
        <h3>最近错误日志</h3>
        <el-select v-model="errorFilter" placeholder="筛选Agent类型" clearable style="width:200px" @change="loadErrors">
          <el-option v-for="t in agentTypes" :key="t" :label="t" :value="t" />
        </el-select>
      </div>
      <el-table :data="errors" stripe style="width:100%" max-height="400">
        <el-table-column prop="agentType" label="Agent类型" width="150" />
        <el-table-column prop="outputStatus" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.outputStatus === 'failed' ? 'danger' : 'warning'" size="small">{{ row.outputStatus }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="responseTime" label="耗时" width="100" />
        <el-table-column prop="errorMessage" label="错误信息" show-overflow-tooltip />
        <el-table-column label="时间" width="180">
          <template #default="{ row }">{{ new Date(row.createdAt).toLocaleString('zh-CN') }}</template>
        </el-table-column>
      </el-table>
      <div class="pagination-wrap" v-if="errorTotal > 10">
        <el-pagination layout="prev, pager, next" :total="errorTotal" :page-size="10" v-model:current-page="errorPage" @current-change="loadErrors" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import api from '../../utils/api.js';

const loading = ref(false);
const overview = ref({});
const errors = ref([]);
const errorTotal = ref(0);
const errorPage = ref(1);
const errorFilter = ref('');
const agentTypes = ref([]);

async function loadOverview() {
  try {
    const res = await api.get('/admin/agents/overview');
    const d = res.data?.data || res.data || {};
    overview.value = d;
    if (d.byType && Array.isArray(d.byType)) {
      agentTypes.value = d.byType.map(t => t.agentType).filter(Boolean);
    }
  } catch (e) {
    console.warn('loadOverview error:', e);
  }
}

async function loadErrors() {
  try {
    const params = { page: errorPage.value, pageSize: 10, days: 30 };
    if (errorFilter.value) params.agentType = errorFilter.value;
    const res = await api.get('/admin/agents/errors', { params });
    const d = res.data?.data || res.data || [];
    errors.value = Array.isArray(d) ? d : [];
    errorTotal.value = res.data?.total || d.total || 0;
  } catch (e) {
    console.warn('loadErrors error:', e);
  }
}

async function refreshData() {
  loading.value = true;
  await Promise.all([loadOverview(), loadErrors()]);
  loading.value = false;
}

onMounted(refreshData);
</script>

<style scoped>
.admin-page { padding: 20px; }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.page-header h2 { margin: 0; font-size: 20px; }
.stat-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 16px; margin-bottom: 24px; }
.stat-card { background: var(--bg-card, #fff); border-radius: 12px; padding: 20px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.08); border-left: 4px solid #409eff; }
.stat-card.success { border-left-color: #67c23a; }
.stat-card.warning { border-left-color: #e6a23c; }
.stat-card.info { border-left-color: #909399; }
.stat-card.primary { border-left-color: #409eff; }
.stat-card.danger { border-left-color: #f56c6c; }
.stat-value { font-size: 28px; font-weight: 700; color: #303133; margin-bottom: 6px; }
.stat-label { font-size: 13px; color: #909399; }
.section-card { background: var(--bg-card, #fff); border-radius: 12px; padding: 20px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
.section-card h3 { margin: 0 0 16px; font-size: 16px; }
.section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.section-header h3 { margin: 0; }
.pagination-wrap { display: flex; justify-content: flex-end; margin-top: 12px; }
</style>
