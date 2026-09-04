<template>
  <div class="admin-subscription">
    <h2>套餐与订阅</h2>

    <!-- 套餐管理 -->
    <el-card shadow="never" class="section-card">
      <template #header>
        <div class="card-header">
          <span>套餐管理</span>
          <el-button type="primary" size="small" @click="openPlanDialog(null)">
            <el-icon><Plus /></el-icon> 新增套餐
          </el-button>
        </div>
      </template>
      <el-table :data="plans" stripe border size="small" v-loading="plansLoading">
        <el-table-column prop="id" label="ID" width="60" />
        <el-table-column prop="name" label="套餐名称" width="120" />
        <el-table-column prop="price" label="月价" width="100">
          <template #default="{ row }"><span style="font-weight:700; color:#e6a23c">\u00a5{{ row.price }}</span></template>
        </el-table-column>
        <el-table-column prop="yearPrice" label="年价" width="100">
          <template #default="{ row }">\u00a5{{ row.yearPrice }}</template>
        </el-table-column>
        <el-table-column prop="credits" label="月积分" width="100" />
        <el-table-column prop="trialDays" label="试用天数" width="90" />
        <el-table-column prop="agents" label="可用Agent" />
        <el-table-column prop="status" label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.status === 'active' ? 'success' : 'info'" size="small">{{ row.status === 'active' ? '上架' : '下架' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="openPlanDialog(row)">编辑</el-button>
            <el-button link :type="row.status === 'active' ? 'danger' : 'success'" size="small" @click="togglePlanStatus(row)">{{ row.status === 'active' ? '下架' : '上架' }}</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 订阅列表 + 分布饼图 -->
    <el-row :gutter="16" style="margin-top:16px">
      <el-col :xs="24" :md="16">
        <el-card shadow="never" class="section-card">
          <template #header><span>订阅列表</span></template>
          <el-table :data="subscriptions" stripe border size="small" v-loading="subsLoading">
            <el-table-column prop="id" label="ID" width="60" />
            <el-table-column prop="userName" label="用户" width="120" />
            <el-table-column prop="plan" label="套餐" width="100">
              <template #default="{ row }"><el-tag size="small" :type="planTag(row.plan)">{{ row.plan }}</el-tag></template>
            </el-table-column>
            <el-table-column prop="price" label="金额" width="100" />
            <el-table-column prop="period" label="周期" width="80" />
            <el-table-column prop="startDate" label="开始日期" width="120" />
            <el-table-column prop="expireDate" label="到期日期" width="120" />
            <el-table-column prop="status" label="状态" width="80">
              <template #default="{ row }">
                <el-tag :type="row.status==='active'?'success':row.status==='expired'?'info':'danger'" size="small">
                  {{ { active:'有效', expired:'过期', cancelled:'取消' }[row.status] }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="autoRenew" label="自动续费" width="80">
              <template #default="{ row }"><el-tag :type="row.autoRenew?'success':'info'" size="small">{{ row.autoRenew?'是':'否' }}</el-tag></template>
            </el-table-column>
          </el-table>
          <el-pagination small background layout="total, prev, pager, next" :total="subTotal" :page-size="10" v-model:current-page="subPage" @current-change="fetchSubscriptions" style="margin-top:12px; justify-content:flex-end" />
        </el-card>
      </el-col>
      <el-col :xs="24" :md="8">
        <el-card shadow="never" class="section-card">
          <template #header><span>套餐分布</span></template>
          <div ref="pieRef" class="chart-box"></div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 新增/编辑套餐对话框 -->
    <el-dialog v-model="planDialogVisible" :title="editingPlan ? '编辑套餐' : '新增套餐'" width="540px">
      <el-form :model="planForm" label-width="100px">
        <el-form-item label="套餐名称" required>
          <el-input v-model="planForm.name" placeholder="套餐名称" />
        </el-form-item>
        <el-form-item label="月价" required>
          <el-input-number v-model="planForm.price" :min="0" :step="10" style="width:100%" />
        </el-form-item>
        <el-form-item label="年价" required>
          <el-input-number v-model="planForm.yearPrice" :min="0" :step="100" style="width:100%" />
        </el-form-item>
        <el-form-item label="月积分" required>
          <el-input-number v-model="planForm.credits" :min="0" :step="100" style="width:100%" />
        </el-form-item>
        <el-form-item label="试用天数">
          <el-input-number v-model="planForm.trialDays" :min="0" :step="1" style="width:100%" />
        </el-form-item>
        <el-form-item label="可用Agent">
          <el-select v-model="planForm.agentsList" multiple placeholder="选择可用Agent" style="width:100%">
            <el-option label="Sales Agent" value="Sales Agent" />
            <el-option label="Doc Agent" value="Doc Agent" />
            <el-option label="Freight Agent" value="Freight Agent" />
            <el-option label="Customs Agent" value="Customs Agent" />
            <el-option label="Legal Agent" value="Legal Agent" />
            <el-option label="Background Agent" value="Background Agent" />
          </el-select>
        </el-form-item>
        <el-form-item label="权益项">
          <el-input v-model="planForm.benefits" type="textarea" :rows="3" placeholder="每行一个权益项" />
        </el-form-item>
        <el-form-item label="状态">
          <el-switch v-model="planForm.active" active-text="上架" inactive-text="下架" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="planDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitPlan" :loading="planSaving">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { Plus } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import * as echarts from 'echarts'
import api from '../../utils/api.js'

const planDialogVisible = ref(false)
const plansLoading = ref(false)
const subsLoading = ref(false)
const planSaving = ref(false)
const editingPlan = ref(null)
const pieRef = ref(null)
const subPage = ref(1)
const subTotal = ref(0)
let pieChart = null

const mockPlans = [
  { id: 1, name: '免费版', price: 0, yearPrice: 0, credits: 100, agents: 'Sales Agent', status: 'active', trialDays: 0 },
  { id: 2, name: '基础版', price: 49, yearPrice: 490, credits: 1000, agents: 'Sales + Doc', status: 'active', trialDays: 7 },
  { id: 3, name: '专业版', price: 99, yearPrice: 990, credits: 5000, agents: '全部Agent', status: 'active', trialDays: 14 },
  { id: 4, name: '企业版', price: 299, yearPrice: 2990, credits: 20000, agents: '全部 + 自定义', status: 'active', trialDays: 30 },
]

const plans = ref([...mockPlans])

const mockSubs = Array.from({ length: 10 }, (_, i) => ({
  id: i + 1, userName: `用户${i+1}`, plan: ['免费版','基础版','专业版','企业版'][i%4],
  price: ['\u00a50','\u00a549','\u00a599','\u00a5299'][i%4], period: i%2===0?'月付':'年付',
  startDate: '2025-01-01', expireDate: i%2===0?'2025-02-01':'2026-01-01',
  status: ['active','active','active','expired','active','active','cancelled','active','active','expired'][i],
  autoRenew: i%3!==0,
}))
const subscriptions = ref([...mockSubs])

const planForm = ref({
  name: '', price: 0, yearPrice: 0, credits: 0, trialDays: 0,
  agentsList: [], benefits: '', active: true,
})

function planTag(p) { return { '免费版':'info', '基础版':'', '专业版':'warning', '企业版':'danger' }[p] || '' }

function openPlanDialog(plan) {
  if (plan) {
    editingPlan.value = plan
    planForm.value = {
      name: plan.name, price: plan.price, yearPrice: plan.yearPrice, credits: plan.credits,
      trialDays: plan.trialDays || 0, agentsList: [], benefits: plan.benefits || '', active: plan.status === 'active'
    }
  } else {
    editingPlan.value = null
    planForm.value = { name: '', price: 0, yearPrice: 0, credits: 0, trialDays: 0, agentsList: [], benefits: '', active: true }
  }
  planDialogVisible.value = true
}

async function submitPlan() {
  if (!planForm.value.name) { ElMessage.warning('请输入套餐名称'); return }
  planSaving.value = true
  try {
    const payload = {
      name: planForm.value.name,
      price: planForm.value.price,
      yearPrice: planForm.value.yearPrice,
      credits: planForm.value.credits,
      trialDays: planForm.value.trialDays,
      agents: planForm.value.agentsList.join(', '),
      benefits: planForm.value.benefits,
      status: planForm.value.active ? 'active' : 'inactive',
    }
    if (editingPlan.value) {
      await api.put(`/admin/subscriptions/${editingPlan.value.id}`, payload)
    } else {
      await api.post('/admin/subscriptions', payload)
    }
    ElMessage.success(editingPlan.value ? '套餐已更新' : '套餐已创建')
    planDialogVisible.value = false
    fetchPlans()
  } catch(e) {
    console.warn('Plan save failed:', e)
    ElMessage.warning('保存失败，请稍后重试')
  } finally {
    planSaving.value = false
  }
}

async function togglePlanStatus(plan) {
  try {
    const newStatus = plan.status === 'active' ? 'inactive' : 'active'
    await api.put(`/admin/subscriptions/${plan.id}`, { ...plan, status: newStatus })
    ElMessage.success(newStatus === 'active' ? '已上架' : '已下架')
    fetchPlans()
  } catch(e) {
    console.warn('Toggle failed:', e)
    plan.status = plan.status === 'active' ? 'active' : 'inactive'
  }
}

async function fetchPlans() {
  plansLoading.value = true
  try {
    const res = await api.get('/admin/subscriptions')
    const data = res.data.data || res.data
    if (Array.isArray(data) && data.length) plans.value = data
  } catch(e) {
    console.warn('Fetch plans failed, using mock')
  } finally {
    plansLoading.value = false
  }
}

async function fetchSubscriptions() {
  subsLoading.value = true
  try {
    const res = await api.get(`/admin/users?page=${subPage.value}&pageSize=10`)
    const data = res.data.data || res.data
    if (Array.isArray(data)) {
      subscriptions.value = data.map(u => ({
        id: u.id, userName: u.name || u.username || u.email, plan: u.planLabel || u.plan || '免费版',
        price: '\u00a5' + (u.price || 0), period: u.period || '月付',
        startDate: u.startDate || u.createdAt || '', expireDate: u.expireDate || '',
        status: u.status || 'active', autoRenew: u.autoRenew || false,
      }))
      subTotal.value = res.data.total || data.length
    }
  } catch(e) {
    console.warn('Fetch subscriptions failed')
  } finally {
    subsLoading.value = false
  }
}

function initPie() {
  if (!pieRef.value) return
  pieChart = echarts.init(pieRef.value)
  const planCounts = {}
  plans.value.forEach(p => { planCounts[p.name] = 0 })
  subscriptions.value.forEach(s => { planCounts[s.plan] = (planCounts[s.plan] || 0) + 1 })
  const colors = ['#909399', '#409eff', '#e6a23c', '#f56c6c']
  pieChart.setOption({
    tooltip: { trigger: 'item' },
    legend: { bottom: 0 },
    series: [{ type: 'pie', radius: ['40%','70%'], center: ['50%','45%'], label: { formatter: '{b}\n{d}%' },
      data: Object.entries(planCounts).map(([name, value], i) => ({ value, name, itemStyle: { color: colors[i % colors.length] } }))
    }]
  })
}

onMounted(async () => {
  await fetchPlans()
  await fetchSubscriptions()
  await nextTick()
  initPie()
  window.addEventListener('resize', () => pieChart?.resize())
})
onBeforeUnmount(() => { window.removeEventListener('resize', () => pieChart?.resize()); pieChart?.dispose() })
</script>

<style scoped>
.admin-subscription h2 { margin: 0 0 16px; font-size: 20px; }
.section-card { border-radius: 12px; border: 1px solid #f0f0f0; }
.section-card:hover { border-color: #409eff; box-shadow: 0 2px 12px rgba(64,158,255,.1); }
.card-header { display: flex; justify-content: space-between; align-items: center; }
.chart-box { height: 280px; }
</style>
