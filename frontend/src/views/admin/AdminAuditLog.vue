<template>
  <div class="admin-audit-log">
    <h2>审计日志</h2>
    <el-card shadow="never" class="filter-card">
      <el-form :inline="true" :model="filters" class="filter-form">
        <el-form-item label="操作类型">
          <el-select v-model="filters.action" placeholder="全部" clearable style="width:160px">
            <el-option label="登录" value="login" />
            <el-option label="用户管理" value="user_mgmt" />
            <el-option label="配置变更" value="config_change" />
            <el-option label="财务操作" value="finance" />
            <el-option label="数据导出" value="export" />
          </el-select>
        </el-form-item>
        <el-form-item label="操作人">
          <el-input v-model="filters.operator" placeholder="用户名" clearable style="width:140px" />
        </el-form-item>
        <el-form-item label="时间范围">
          <el-date-picker v-model="filters.dateRange" type="daterange" range-separator="至" start-placeholder="开始" end-placeholder="结束" style="width:260px" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-table :data="filteredLogs" stripe border style="width:100%; margin-top:16px" row-key="id">
      <el-table-column type="expand">
        <template #default="{ row }">
          <div class="expand-detail">
            <p><strong>请求路径:</strong> {{ row.path }}</p>
            <p><strong>请求方法:</strong> {{ row.method }}</p>
            <p><strong>请求参数:</strong> <code>{{ JSON.stringify(row.params, null, 2) }}</code></p>
            <p><strong>User-Agent:</strong> {{ row.userAgent }}</p>
            <p><strong>IP地址:</strong> {{ row.ip }}</p>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="id" label="ID" width="60" />
      <el-table-column prop="action" label="操作类型" width="120">
        <template #default="{ row }">
          <el-tag :type="actionTagType(row.action)" size="small">{{ actionLabel(row.action) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="operator" label="操作人" width="120" />
      <el-table-column prop="target" label="操作对象" width="180" />
      <el-table-column prop="description" label="描述" />
      <el-table-column prop="result" label="结果" width="80">
        <template #default="{ row }">
          <el-tag :type="row.result === 'success' ? 'success' : 'danger'" size="small">
            {{ row.result === 'success' ? '成功' : '失败' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="createdAt" label="时间" width="180" />
    </el-table>

    <div class="pagination-wrap">
      <el-pagination background layout="total, sizes, prev, pager, next, jumper" :total="total" :page-size="pageSize" :current-page="currentPage" @current-change="p => currentPage = p" @size-change="s => { pageSize = s; currentPage = 1 }" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const filters = ref({ action: '', operator: '', dateRange: null })
const currentPage = ref(1)
const pageSize = ref(20)
const total = ref(56)

const mockLogs = Array.from({ length: 56 }, (_, i) => ({
  id: i + 1,
  action: ['login','user_mgmt','config_change','finance','export'][i % 5],
  operator: ['admin','editor01','ops01'][i % 3],
  target: ['用户#1234','系统配置','套餐Plan-A','优惠券NEW20','审计日志'][i % 5],
  description: ['管理员登录系统','修改用户订阅','修改系统配置项','充值用户积分','导出用户数据'][i % 5],
  result: i % 12 === 0 ? 'fail' : 'success',
  path: ['/api/admin/auth/login','/api/admin/users/1234/subscription','/api/admin/system-config','/api/admin/users/1234/credits','/api/admin/users/export'][i % 5],
  method: ['POST','PUT','PUT','POST','GET'][i % 5],
  params: { example: 'value_' + i },
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
  ip: '192.168.1.' + (100 + i % 50),
  createdAt: new Date(Date.now() - i * 3600000).toLocaleString(),
}))

const filteredLogs = computed(() => {
  let list = [...mockLogs]
  if (filters.value.action) list = list.filter(l => l.action === filters.value.action)
  if (filters.value.operator) list = list.filter(l => l.operator.includes(filters.value.operator))
  total.value = list.length
  const start = (currentPage.value - 1) * pageSize.value
  return list.slice(start, start + pageSize.value)
})

function actionLabel(a) { return { login:'登录', user_mgmt:'用户管理', config_change:'配置变更', finance:'财务操作', export:'数据导出' }[a] || a }
function actionTagType(a) { return { login:'', user_mgmt:'success', config_change:'warning', finance:'danger', export:'info' }[a] || '' }
function handleSearch() { currentPage.value = 1 }
function resetFilters() { filters.value = { action: '', operator: '', dateRange: null } }
</script>

<style scoped>
.admin-audit-log h2 { margin: 0 0 16px; font-size: 20px; }
.filter-card { border-radius: 12px; border: 1px solid #f0f0f0; }
.filter-form { display: flex; flex-wrap: wrap; gap: 0; }
.expand-detail { padding: 16px 24px; }
.expand-detail p { margin: 6px 0; font-size: 13px; color: #606266; }
.expand-detail code { background: #f5f7fa; padding: 2px 6px; border-radius: 4px; font-size: 12px; }
.pagination-wrap { margin-top: 16px; display: flex; justify-content: flex-end; }
</style>
