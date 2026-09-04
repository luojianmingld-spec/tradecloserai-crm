<template>
  <div class="admin-finance">
    <h2>收入与积分</h2>

    <!-- 收入统计卡片 -->
    <el-row :gutter="16" class="stat-row">
      <el-col :xs="12" :md="6" v-for="card in statCards" :key="card.key">
        <div class="stat-card">
          <div class="stat-icon" :style="{ background: card.color }"><el-icon :size="20"><component :is="card.icon" /></el-icon></div>
          <div class="stat-info">
            <span class="stat-label">{{ card.label }}</span>
            <span class="stat-value">{{ card.value }}</span>
            <span class="stat-sub">{{ card.sub }}</span>
          </div>
        </div>
      </el-col>
    </el-row>

    <!-- 收入趋势图 -->
    <el-card shadow="never" class="section-card" style="margin-top:16px">
      <template #header>
        <div class="card-header">
          <span>收入趋势</span>
          <el-radio-group v-model="trendPeriod" size="small" @change="updateTrend">
            <el-radio-button value="week">近7天</el-radio-button>
            <el-radio-button value="month">近30天</el-radio-button>
            <el-radio-button value="year">近12月</el-radio-button>
          </el-radio-group>
        </div>
      </template>
      <div ref="trendRef" class="chart-box"></div>
    </el-card>

    <!-- 积分总览 + 交易流水 -->
    <el-row :gutter="16" style="margin-top:16px">
      <el-col :xs="24" :md="8">
        <el-card shadow="never" class="section-card">
          <template #header><span>积分总览</span></template>
          <div class="credit-overview">
            <div class="credit-item">
              <span class="credit-label">总发放</span>
              <span class="credit-value" style="color:#67c23a">{{ creditOverview.totalIssued.toLocaleString() }}</span>
            </div>
            <div class="credit-item">
              <span class="credit-label">总消耗</span>
              <span class="credit-value" style="color:#f56c6c">{{ creditOverview.totalConsumed.toLocaleString() }}</span>
            </div>
            <div class="credit-item">
              <span class="credit-label">当前余额池</span>
              <span class="credit-value" style="color:#409eff">{{ creditOverview.balance.toLocaleString() }}</span>
            </div>
            <div class="credit-item">
              <span class="credit-label">今日消耗</span>
              <span class="credit-value">{{ creditOverview.todayConsumed.toLocaleString() }}</span>
            </div>
          </div>
          <div ref="creditPieRef" class="chart-box-small"></div>
        </el-card>
      </el-col>
      <el-col :xs="24" :md="16">
        <el-card shadow="never" class="section-card">
          <template #header><span>交易流水</span></template>
          <el-table :data="transactions" stripe border size="small" v-loading="txLoading">
            <el-table-column prop="id" label="ID" width="60" />
            <el-table-column prop="user" label="用户" width="100" />
            <el-table-column prop="type" label="类型" width="100">
              <template #default="{ row }">
                <el-tag :type="txTypeTag(row.type)" size="small">{{ row.type }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="amount" label="金额/积分" width="120">
              <template #default="{ row }">
                <span :style="{ color: row.amount > 0 ? '#67c23a' : '#f56c6c' }">{{ row.amount > 0 ? '+' : '' }}{{ row.amount.toLocaleString() }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="balance" label="余额" width="100" />
            <el-table-column prop="description" label="说明" />
            <el-table-column prop="time" label="时间" width="170" />
          </el-table>
          <el-pagination small background layout="total, prev, pager, next" :total="txTotal" :page-size="10" v-model:current-page="txPage" @current-change="fetchTransactions" style="margin-top:12px; justify-content:flex-end" />
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { Wallet, Coin, TrendCharts, Money } from '@element-plus/icons-vue'
import * as echarts from 'echarts'
import api from '../../utils/api.js'

const trendPeriod = ref('month')
const trendRef = ref(null)
const creditPieRef = ref(null)
const txLoading = ref(false)
const txPage = ref(1)
const txTotal = ref(0)
let trendChart = null, creditPieChart = null

const statCards = ref([
  { key: 'today_rev', label: '今日收入', value: '\u00a50', sub: '', color: '#67c23a', icon: 'Money' },
  { key: 'month_rev', label: '本月收入', value: '\u00a50', sub: '', color: '#409eff', icon: 'Wallet' },
  { key: 'total_rev', label: '累计收入', value: '\u00a50', sub: '', color: '#e6a23c', icon: 'TrendCharts' },
  { key: 'credit_pool', label: '积分池', value: '0', sub: '', color: '#909399', icon: 'Coin' },
])

const creditOverview = ref({ totalIssued: 0, totalConsumed: 0, balance: 0, todayConsumed: 0 })

const mockTx = Array.from({ length: 10 }, (_, i) => ({
  id: i + 1, user: `用户${i+1}`, type: ['充值','消耗','赠送','退款','购买'][i%5],
  amount: [1000, -50, 200, -99, 500][i%5], balance: Math.round(Math.random()*10000),
  description: ['管理员充值','Agent调用','活动赠送','退订退款','购买积分包'][i%5],
  time: new Date(Date.now() - i*3600000).toLocaleString(),
}))
const transactions = ref([...mockTx])

function txTypeTag(t) { return { '充值':'success', '消耗':'danger', '赠送':'warning', '退款':'info', '购买':'' }[t] || '' }

function initTrend(revenueTrend, creditTrend) {
  if (!trendRef.value) return
  if (trendChart) { trendChart.dispose() }
  trendChart = echarts.init(trendRef.value)
  const dates = (revenueTrend || []).map(d => new Date(d.date).toLocaleDateString('zh-CN'))
  const revData = (revenueTrend || []).map(d => d.revenue || 0)
  const creditMap = {}
  ;(creditTrend || []).forEach(d => { creditMap[d.date] = d.recharged || 0 })
  const creditData = (revenueTrend || []).map(d => creditMap[d.date] || 0)
  const totalData = revData.map((v, i) => v + (creditData[i] || 0))
  trendChart.setOption({
    tooltip: { trigger: 'axis' },
    legend: { data: ['订阅收入','积分购买','总收入'] },
    grid: { left: 60, right: 20, top: 40, bottom: 30 },
    xAxis: { type: 'category', data: dates.length ? dates : ['暂无数据'], axisLabel: { rotate: 30, fontSize: 10 } },
    yAxis: { type: 'value', axisLabel: { formatter: '\u00a5{value}' } },
    series: [
      { name: '订阅收入', type: 'line', smooth: true, data: revData, areaStyle: { opacity: 0.1 } },
      { name: '积分购买', type: 'line', smooth: true, data: creditData, areaStyle: { opacity: 0.1 } },
      { name: '总收入', type: 'bar', data: totalData, itemStyle: { opacity: 0.3, borderRadius: [3,3,0,0] } },
    ]
  })
}

function initCreditPie() {
  if (!creditPieRef.value) return
  if (creditPieChart) { creditPieChart.dispose() }
  creditPieChart = echarts.init(creditPieRef.value)
  const co = creditOverview.value
  creditPieChart.setOption({
    tooltip: { trigger: 'item' },
    series: [{ type: 'pie', radius: ['35%','65%'], label: { formatter: '{b}\n{d}%' },
      data: [
        { value: co.totalConsumed || 0, name: '已消耗', itemStyle: { color: '#f56c6c' } },
        { value: co.balance || 0, name: '剩余', itemStyle: { color: '#409eff' } },
      ]
    }]
  })
}

async function updateTrend() {
  const daysMap = { week: 7, month: 30, year: 365 }
  const days = daysMap[trendPeriod.value] || 30
  try {
    const res = await api.get(`/admin/dashboard/trend?days=${days}`)
    const trend = res.data.data || res.data || {}
    initTrend(trend.revenueTrend || [], trend.creditTrend || [])
  } catch(e) {
    console.warn('Trend fetch failed')
    initTrend([], [])
  }
}

async function fetchStats() {
  try {
    const res = await api.get('/admin/dashboard/stats')
    const s = res.data.data || res.data || {}
    statCards.value = [
      { key: 'today_rev', label: '今日收入', value: '\u00a5' + (s.todayRevenue || 0).toLocaleString(), sub: '', color: '#67c23a', icon: 'Money' },
      { key: 'month_rev', label: '本月收入', value: '\u00a5' + (s.mrr || 0).toLocaleString(), sub: '', color: '#409eff', icon: 'Wallet' },
      { key: 'total_rev', label: '累计收入', value: '\u00a5' + (s.totalRevenue || 0).toLocaleString(), sub: '', color: '#e6a23c', icon: 'TrendCharts' },
      { key: 'credit_pool', label: '积分池', value: (s.creditPool || 0).toLocaleString(), sub: '今日消耗 ' + (s.todayCreditsConsumed || 0).toLocaleString(), color: '#909399', icon: 'Coin' },
    ]
    if (s.creditOverview) {
      creditOverview.value = s.creditOverview
    }
  } catch(e) {
    console.warn('Stats fetch failed')
  }
}

async function fetchCreditOverview() {
  try {
    const res = await api.get('/admin/credits/overview')
    const d = res.data.data || res.data || {}
    creditOverview.value = {
      totalIssued: d.totalRecharge || d.totalIssued || 0,
      totalConsumed: d.totalConsume || d.totalConsumed || 0,
      balance: d.balance || 0,
      todayConsumed: d.todayConsumed || 0,
    }
  } catch(e) {
    console.warn('Credit overview fetch failed')
  }
}

async function fetchTransactions() {
  txLoading.value = true
  try {
    const res = await api.get(`/admin/credits/transactions?page=${txPage.value}`)
    const data = res.data.data || res.data
    if (Array.isArray(data) && data.length) {
      transactions.value = data.map(t => ({
        id: t.id, user: t.userName || t.user || '', type: t.type || '',
        amount: t.amount || 0, balance: t.balance || 0,
        description: t.description || '', time: t.createdAt ? new Date(t.createdAt).toLocaleString('zh-CN') : (t.time || ''),
      }))
      txTotal.value = res.data.total || data.length
    }
  } catch(e) {
    console.warn('Transactions fetch failed')
  } finally {
    txLoading.value = false
  }
}

onMounted(async () => {
  await Promise.all([fetchStats(), fetchCreditOverview(), fetchTransactions()])
  await nextTick()
  // Init trend chart
  try {
    const res = await api.get('/admin/dashboard/trend?days=30')
    const trend = res.data.data || res.data || {}
    initTrend(trend.revenueTrend || [], trend.creditTrend || [])
  } catch(e) {
    initTrend([], [])
  }
  initCreditPie()
  window.addEventListener('resize', handleResize)
})
function handleResize() { trendChart?.resize(); creditPieChart?.resize() }
onBeforeUnmount(() => { window.removeEventListener('resize', handleResize); trendChart?.dispose(); creditPieChart?.dispose() })
</script>

<style scoped>
.admin-finance h2 { margin: 0 0 16px; font-size: 20px; }
.stat-row { margin-bottom: 0; }
.stat-card { background: #fff; border-radius: 12px; padding: 16px; display: flex; align-items: center; gap: 12px; border: 1px solid #f0f0f0; transition: all .2s; }
.stat-card:hover { border-color: #409eff; box-shadow: 0 2px 12px rgba(64,158,255,.1); }
.stat-icon { width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: #fff; flex-shrink: 0; }
.stat-info { display: flex; flex-direction: column; }
.stat-label { font-size: 12px; color: #909399; }
.stat-value { font-size: 20px; font-weight: 700; color: #303133; }
.stat-sub { font-size: 11px; color: #67c23a; }
.section-card { border-radius: 12px; border: 1px solid #f0f0f0; }
.section-card:hover { border-color: #409eff; box-shadow: 0 2px 12px rgba(64,158,255,.1); }
.card-header { display: flex; justify-content: space-between; align-items: center; }
.chart-box { height: 300px; }
.chart-box-small { height: 200px; }
.credit-overview { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
.credit-item { display: flex; flex-direction: column; }
.credit-label { font-size: 12px; color: #909399; }
.credit-value { font-size: 18px; font-weight: 700; }
</style>
