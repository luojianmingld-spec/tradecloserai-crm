<template>
  <div class="perf-page">
    <!-- Header -->
    <div class="perf-header">
      <h2 class="perf_title">我的业绩</h2>
      <div class="period_toggle">
        <button :class="{ active: period === 'week' }" @click="switchPeriod('week')">本周</button>
        <button :class="{ active: period === 'month' }" @click="switchPeriod('month')">本月</button>
      </div>
    </div>

    <!-- KPI Cards -->
    <div class="kpi_grid" v-if="!loading">
      <div class="kpi_card">
        <div class="kpi_icon">💬</div>
        <div class="kpi_val">{{ summary.totalMessages }}</div>
        <div class="kpi_lbl">总消息数</div>
        <div class="kpi_sub">收{{ summary.inboundMessages }} / 发{{ summary.outboundMessages }}</div>
      </div>
      <div class="kpi_card">
        <div class="kpi_icon">👥</div>
        <div class="kpi_val">{{ summary.newCustomers }}</div>
        <div class="kpi_lbl">新增客户</div>
        <div class="kpi_sub">总客户 {{ summary.totalCustomers }}</div>
      </div>
      <div class="kpi_card">
        <div class="kpi_icon">⏱️</div>
        <div class="kpi_val">{{ summary.avgResponseMinutes != null ? summary.avgResponseMinutes + '分钟' : '--' }}</div>
        <div class="kpi_lbl">平均响应</div>
        <div class="kpi_sub">{{ summary.avgResponseMinutes != null && summary.avgResponseMinutes <= 30 ? '响应及时' : '可加快响应' }}</div>
      </div>
      <div class="kpi_card accent">
        <div class="kpi_icon">🎯</div>
        <div class="kpi_val">{{ summary.conversionRate }}%</div>
        <div class="kpi_lbl">转化率</div>
        <div class="kpi_sub">成交 {{ summary.closedCustomers }} 单</div>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="loading_box">
      <div class="spinner"></div>
      <span>加载业绩数据…</span>
    </div>

    <!-- Trend Chart -->
    <div class="chart_panel" v-if="!loading">
      <div class="chart_title">📈 消息趋势</div>
      <div ref="chartRef" class="chart_box"></div>
    </div>

    <!-- Extra Stats -->
    <div class="extra_grid" v-if="!loading">
      <div class="extra_card">
        <div class="extra_title">📞 跟进统计</div>
        <div class="extra_row">
          <span>跟进次数</span>
          <strong>{{ summary.followupCount }}</strong>
        </div>
        <div class="extra_row">
          <span>日均跟进</span>
          <strong>{{ dailyFollowup }}</strong>
        </div>
      </div>
      <div class="extra_card">
        <div class="extra_title">📊 收发比</div>
        <div class="extra_row">
          <span>客户来信</span>
          <strong>{{ summary.inboundMessages }}</strong>
        </div>
        <div class="extra_row">
          <span>我的回复</span>
          <strong>{{ summary.outboundMessages }}</strong>
        </div>
        <div class="extra_row">
          <span>收发比</span>
          <strong>{{ replyRatio }}</strong>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import * as echarts from 'echarts/core';
import { LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([LineChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);

const period = ref('month');
const loading = ref(true);
const chartRef = ref(null);
let chart = null;

const data = ref({
  summary: { totalMessages: 0, inboundMessages: 0, outboundMessages: 0, newCustomers: 0, totalCustomers: 0, closedCustomers: 0, followupCount: 0, avgResponseMinutes: null, conversionRate: 0 },
  trend: [],
});

const summary = computed(() => data.value.summary);
const dailyFollowup = computed(() => {
  const days = period.value === 'week' ? 7 : 30;
  return (data.value.summary.followupCount / days).toFixed(1);
});
const replyRatio = computed(() => {
  const inb = data.value.summary.inboundMessages;
  const out = data.value.summary.outboundMessages;
  if (inb === 0) return '--';
  return (out / inb).toFixed(2);
});

async function loadData() {
  loading.value = true;
  try {
    const res = await fetch('/api/dashboard/my-stats?period=' + period.value, {
      headers: { Authorization: 'Bearer ' + localStorage.getItem('crm_token') },
    });
    if (res.ok) {
      data.value = await res.json();
      await nextTick();
      renderChart();
    }
  } catch (e) {
    console.error('Load stats error:', e);
  }
  loading.value = false;
}

function switchPeriod(p) {
  period.value = p;
  loadData();
}

function renderChart() {
  if (!chartRef.value) return;
  if (chart) chart.dispose();
  chart = echarts.init(chartRef.value);
  const trend = data.value.trend || [];
  chart.setOption({
    tooltip: { trigger: 'axis' },
    grid: { left: 40, right: 20, top: 20, bottom: 30 },
    xAxis: { type: 'category', data: trend.map(t => t.date), axisLabel: { fontSize: 10 } },
    yAxis: { type: 'value', axisLabel: { fontSize: 10 } },
    series: [{
      data: trend.map(t => t.messages),
      type: 'line',
      smooth: true,
      areaStyle: { color: 'rgba(16,185,129,0.15)' },
      lineStyle: { color: '#10b981', width: 2 },
      itemStyle: { color: '#10b981' },
    }],
  });
}

onMounted(() => {
  loadData();
  window.addEventListener('resize', () => chart && chart.resize());
});
onUnmounted(() => {
  if (chart) chart.dispose();
  window.removeEventListener('resize', () => chart && chart.resize());
});
</script>

<style scoped>
.perf-page {
  padding: 20px;
  background: var(--mgmt-bg, #0a0a0a);
  min-height: 100vh;
  color: var(--text-primary, #f0f0f0);
}
.perf_header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}
.perf_title {
  font-size: 20px;
  font-weight: 700;
  margin: 0;
}
.period_toggle {
  display: flex;
  gap: 4px;
  background: var(--mgmt-card-bg, #1a1a2e);
  border-radius: 8px;
  padding: 3px;
}
.period_toggle button {
  background: none;
  border: none;
  color: var(--text-secondary, #888);
  padding: 6px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.15s;
}
.period_toggle button.active {
  background: var(--accent, #10b981);
  color: #fff;
}
.kpi_grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 20px;
}
.kpi_card {
  background: var(--mgmt-card-bg, #1a1a2e);
  border: 1px solid var(--mgmt-divider, #2a2a3e);
  border-radius: 12px;
  padding: 18px 16px;
  text-align: center;
}
.kpi_card.accent {
  border-color: var(--accent, #10b981);
}
.kpi_icon { font-size: 24px; margin-bottom: 6px; }
.kpi_val {
  font-size: 26px;
  font-weight: 700;
  color: var(--text-primary, #f0f0f0);
  margin-bottom: 4px;
}
.kpi_lbl {
  font-size: 13px;
  color: var(--text-secondary, #888);
  margin-bottom: 2px;
}
.kpi_sub {
  font-size: 11px;
  color: var(--text-secondary, #666);
}
.chart_panel {
  background: var(--mgmt-card-bg, #1a1a2e);
  border: 1px solid var(--mgmt-divider, #2a2a3e);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 20px;
}
.chart_title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 12px;
}
.chart_box {
  height: 200px;
  width: 100%;
}
.extra_grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 80px;
}
.extra_card {
  background: var(--mgmt-card-bg, #1a1a2e);
  border: 1px solid var(--mgmt-divider, #2a2a3e);
  border-radius: 12px;
  padding: 16px;
}
.extra_title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 12px;
}
.extra_row {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid var(--mgmt-divider, #2a2a3e);
  font-size: 13px;
}
.extra_row:last-child { border-bottom: none; }
.extra_row span { color: var(--text-secondary, #888); }
.extra_row strong { color: var(--text-primary, #f0f0f0); }
.loading_box {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px;
  color: var(--text-secondary, #888);
  gap: 12px;
}
.spinner {
  width: 24px;
  height: 24px;
  border: 3px solid var(--mgmt-divider, #2a2a3e);
  border-top-color: var(--accent, #10b981);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
@media (max-width: 768px) {
  .perf-page { padding: 12px; padding-bottom: calc(80px + env(safe-area-inset-bottom, 0px)); }
  .kpi_grid { grid-template-columns: repeat(2, 1fr); }
  .extra_grid { grid-template-columns: 1fr; }
  .perf_title { font-size: 18px; }
  .kpi_val { font-size: 22px; }
}
</style>
