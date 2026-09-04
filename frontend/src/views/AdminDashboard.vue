<template>
  <div class="admin-dashboard">
    <h2 class="page-title">数据看板</h2>

    <!-- 统计卡片行 -->
    <el-row :gutter="20" class="stat-row">
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card card-blue">
          <div class="stat-icon">🏢</div>
          <el-statistic title="租户总数" :value="stats.totalTenants || 0" loading="loading" />
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card card-green">
          <div class="stat-icon">👥</div>
          <el-statistic title="活跃用户数" :value="stats.activeUsers || 0" loading="loading" />
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card card-orange">
          <div class="stat-icon">💬</div>
          <el-statistic title="今日消息数" :value="stats.todayMessages || 0" loading="loading" />
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card card-purple">
          <div class="stat-icon">🤖</div>
          <el-statistic title="Agent对话数" :value="stats.agentConversations || 0" loading="loading" />
        </el-card>
      </el-col>
    </el-row>

    <!-- 详细信息区 -->
    <el-row :gutter="20" style="margin-top: 20px;">
      <el-col :span="12">
        <el-card shadow="hover">
          <template #header>
            <span style="font-weight: 600;">租户概览</span>
          </template>
          <el-table :data="topTenants" v-loading="loading" style="width: 100%">
            <el-table-column prop="name" label="租户名称" />
            <el-table-column prop="plan" label="套餐" width="100" />
            <el-table-column prop="userCount" label="用户数" width="100" />
            <el-table-column prop="status" label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="row.status === 'active' ? 'success' : 'info'" size="small">
                  {{ row.status === 'active' ? '正常' : '停用' }}
                </el-tag>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card shadow="hover">
          <template #header>
            <span style="font-weight: 600;">系统状态</span>
          </template>
          <div class="system-stats" v-loading="loading">
            <div class="stat-item">
              <span class="stat-label">系统运行时间</span>
              <span class="stat-value text-blue">{{ stats.uptime || 'N/A' }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">今日新增租户</span>
              <span class="stat-value text-green">{{ stats.newTenantsToday || 0 }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">今日新增用户</span>
              <span class="stat-value text-orange">{{ stats.newUsersToday || 0 }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">API调用次数</span>
              <span class="stat-value text-purple">{{ stats.apiCallsToday || 0 }}</span>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { ElMessage } from "element-plus";
import api from "../utils/api.js";

const loading = ref(false);
const stats = ref({});
const topTenants = ref([]);

async function fetchStats() {
  loading.value = true;
  try {
    const { data } = await api.get("/admin/stats");
    stats.value = data.stats || data || {};
    topTenants.value = data.topTenants || [];
  } catch (e) {
    // API 可能尚未实现，使用模拟数据避免页面空白
    console.warn("获取统计数据失败，使用模拟数据:", e.message);
    stats.value = {
      totalTenants: 0,
      activeUsers: 0,
      todayMessages: 0,
      agentConversations: 0,
      uptime: "N/A",
      newTenantsToday: 0,
      newUsersToday: 0,
      apiCallsToday: 0,
    };
    topTenants.value = [];
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  fetchStats();
});
</script>

<style scoped>
.admin-dashboard {
  padding: 0;
}

.page-title {
  font-size: 22px;
  font-weight: 600;
  color: #303133;
  margin: 0 0 20px 0;
}

.stat-row {
  margin-bottom: 10px;
}

.stat-card {
  text-align: center;
  border-radius: 8px;
  position: relative;
  overflow: hidden;
}

.stat-card::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
}

.card-blue::before { background: #409EFF; }
.card-green::before { background: #67C23A; }
.card-orange::before { background: #E6A23C; }
.card-purple::before { background: #909399; }

.stat-icon {
  font-size: 36px;
  margin-bottom: 10px;
}

.system-stats {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 12px;
  border-bottom: 1px solid #ebeef5;
}

.stat-item:last-child {
  border-bottom: none;
}

.stat-label {
  font-size: 14px;
  color: #606266;
}

.stat-value {
  font-size: 18px;
  font-weight: 600;
}

.text-blue { color: #409EFF; }
.text-green { color: #67C23A; }
.text-orange { color: #E6A23C; }
.text-purple { color: #909399; }
</style>
