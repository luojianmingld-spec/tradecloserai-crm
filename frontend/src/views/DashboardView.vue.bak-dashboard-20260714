<template>
  <div class="dashboard-page">
    <h1 class="dashboard-title">外贸合伙人CRM</h1>
    <p class="dashboard-subtitle">WhatsApp 客户关系管理系统</p>

    <div class="stat-grid">
      <div class="dash-card">
        <div class="dash-card-icon">💬</div>
        <div class="dash-card-value">{{ stats.conversations }}</div>
        <div class="dash-card-label">会话数</div>
      </div>
      <div class="dash-card">
        <div class="dash-card-icon">👥</div>
        <div class="dash-card-value">{{ stats.customers }}</div>
        <div class="dash-card-label">客户数</div>
      </div>
      <div class="dash-card">
        <div class="dash-card-icon">📌</div>
        <div class="dash-card-value">{{ stats.active }}</div>
        <div class="dash-card-label">活跃客户</div>
      </div>
      <div class="dash-card">
        <div class="dash-card-icon">⭐</div>
        <div class="dash-card-value">{{ stats.vip }}</div>
        <div class="dash-card-label">VIP客户</div>
      </div>
    </div>

    <div class="quick-actions">
      <h3 class="section-title">快捷操作</h3>
      <div class="action-grid">
        <div class="action-item" @click="$router.push('/')">
          <span class="action-icon">💬</span>
          <span class="action-text">WhatsApp聊天</span>
        </div>
        <div class="action-item" @click="$router.push('/customers')">
          <span class="action-icon">📋</span>
          <span class="action-text">客户管理</span>
        </div>
        <div class="action-item" @click="$router.push('/settings')">
          <span class="action-icon">⚙️</span>
          <span class="action-text">系统设置</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '../utils/api.js'

const stats = ref({
  conversations: 0,
  customers: 0,
  active: 0,
  vip: 0,
})

onMounted(async () => {
  try {
    const res = await api.get('/api/customers?limit=1')
    stats.value.customers = res.data.total ?? res.data.data?.length ?? 0
    stats.value.active = res.data.stats?.active ?? 0
    stats.value.vip = res.data.stats?.vip ?? 0
  } catch {
    // ignore
  }
  try {
    const res = await api.get('/api/whatsapp/conversations')
    stats.value.conversations = res.data?.length ?? 0
  } catch {
    // ignore
  }
})
</script>

<style scoped>
.dashboard-page {
  padding: 24px;
  max-width: 800px;
  margin: 0 auto;
}
.dashboard-title {
  font-size: 24px;
  font-weight: 700;
  color: #e9edef;
  margin: 0 0 4px 0;
}
.dashboard-subtitle {
  font-size: 14px;
  color: #8696a0;
  margin: 0 0 28px 0;
}
.stat-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 32px;
}
.dash-card {
  background: #111b21;
  border: 1px solid #2a3942;
  border-radius: 10px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
.dash-card-icon {
  font-size: 20px;
}
.dash-card-value {
  font-size: 28px;
  font-weight: 700;
  color: #00a884;
}
.dash-card-label {
  font-size: 12px;
  color: #8696a0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.section-title {
  font-size: 14px;
  font-weight: 600;
  color: #8696a0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 0 0 12px 0;
}
.action-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}
.action-item {
  background: #111b21;
  border: 1px solid #2a3942;
  border-radius: 10px;
  padding: 20px 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  transition: background 0.15s;
}
.action-item:hover {
  background: #202c33;
}
.action-icon {
  font-size: 24px;
}
.action-text {
  font-size: 13px;
  color: #e9edef;
}

@media (max-width: 768px) {
  .dashboard-page {
    padding: 16px;
  }
  .stat-grid {
    grid-template-columns: repeat(2, 1fr) !important;
  }
  .action-grid {
    grid-template-columns: 1fr !important;
  }
  .action-item {
    flex-direction: row !important;
    justify-content: flex-start;
    padding: 14px 16px;
  }
  .action-icon {
    font-size: 20px;
  }
}
</style>
