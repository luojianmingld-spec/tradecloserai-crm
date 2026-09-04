<template>
  <div class="admin-dashboard">
    <h2>仪表盘</h2>
    <div v-if="loading" class="loading">加载中...</div>
    <div v-else>
      <div class="stats-grid">
        <div class="stat-card" v-for="s in statCards" :key="s.label">
          <div class="stat-value">{{ s.value }}</div>
          <div class="stat-label">{{ s.label }}</div>
          <div v-if="s.sub" class="stat-sub">{{ s.sub }}</div>
        </div>
      </div>
      <div class="chart-row">
        <div class="chart-card">
          <h3>用户增长趋势</h3>
          <div ref="userChartRef" style="height:300px"></div>
        </div>
        <div class="chart-card">
          <h3>Agent 调用趋势</h3>
          <div ref="agentChartRef" style="height:300px"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue';
import api from '../../utils/api.js';

const loading = ref(true);
const stats = ref({});
const trend = ref({});
const userChartRef = ref(null);
const agentChartRef = ref(null);

const statCards = computed(() => [
  { label: '总用户', value: stats.value.totalUsers ?? '-' },
  { label: '今日新增', value: stats.value.todayNewUsers ?? '-', sub: '日活 ' + (stats.value.dau ?? '-') },
  { label: '付费用户', value: stats.value.paidUsers ?? '-' },
  { label: 'MRR', value: '¥' + (stats.value.mrr ?? 0).toLocaleString() },
  { label: '总收入', value: '¥' + (stats.value.totalRevenue ?? 0).toLocaleString() },
  { label: '今日收入', value: '¥' + (stats.value.todayRevenue ?? 0).toLocaleString() },
  { label: 'ARPU', value: '¥' + (stats.value.arpu ?? 0).toFixed(2) },
  { label: '积分余额', value: stats.value.creditPool?.toLocaleString() ?? '-', sub: '总充值 ' + (stats.value.creditOverview?.totalIssued ?? 0) },
  { label: 'Agent调用', value: stats.value.agentTotalCalls ?? '-' },
  { label: '待处理告警', value: stats.value.pendingAlerts ?? '-' },
]);

async function fetchData() {
  try {
    const [statsRes, trendRes] = await Promise.all([
      api.get('/admin/dashboard/stats'),
      api.get('/admin/dashboard/trend?days=30'),
    ]);
    stats.value = statsRes.data?.data || statsRes.data || {};
    trend.value = trendRes.data?.data || trendRes.data || {};
    await nextTick();
    renderCharts();
  } catch (e) {
    console.warn('Dashboard fetch error:', e);
  } finally {
    loading.value = false;
  }
}

function renderCharts() {
  if (!window.echarts) return;
  const userTrend = trend.value.userTrend || [];
  const agentTrend = trend.value.agentTrend || [];
  const dates = userTrend.map(d => d.date?.slice(5) || '');

  if (userChartRef.value) {
    const chart = window.echarts.init(userChartRef.value);
    chart.setOption({
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'category', data: dates },
      yAxis: { type: 'value' },
      series: [
        { name: '总用户', type: 'line', data: userTrend.map(d => d.totalUsers || 0), smooth: true },
        { name: '新增', type: 'bar', data: userTrend.map(d => d.newUsers || 0) },
      ],
    });
  }
  if (agentChartRef.value) {
    const chart = window.echarts.init(agentChartRef.value);
    chart.setOption({
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'category', data: agentTrend.map(d => d.date?.slice(5) || '') },
      yAxis: { type: 'value' },
      series: [{ name: '调用次数', type: 'bar', data: agentTrend.map(d => d.calls || 0) }],
    });
  }
}

onMounted(() => {
  // Load ECharts from CDN if not loaded
  if (!window.echarts) {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js';
    s.onload = fetchData;
    document.head.appendChild(s);
  } else {
    fetchData();
  }
});
</script>

<style scoped>
.admin-dashboard h2 { margin: 0 0 20px; color: #303133; }
.stats-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 16px; margin-bottom: 24px; }
.stat-card { background: #fff; border-radius: 12px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
.stat-value { font-size: 24px; font-weight: 700; color: #303133; }
.stat-label { font-size: 13px; color: #909399; margin-top: 4px; }
.stat-sub { font-size: 11px; color: #b0b0b0; margin-top: 4px; }
.chart-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.chart-card { background: #fff; border-radius: 12px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
.chart-card h3 { margin: 0 0 12px; font-size: 15px; color: #303133; }
.loading { text-align: center; padding: 40px; color: #909399; }
</style>
