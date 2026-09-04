<template>
  <div class="admin-layout" :class="{ 'dark-mode': isDark }">
    <aside class="admin-sidebar">
      <div class="sidebar-header">
        <h2>TradeCloser AI</h2>
        <span class="sidebar-subtitle">管理后台</span>
      </div>
      <nav class="sidebar-nav">
        <router-link v-for="item in menuItems" :key="item.path" :to="item.path" class="nav-item" active-class="active">
          <span class="nav-icon">{{ item.icon }}</span>
          <span class="nav-text">{{ item.label }}</span>
        </router-link>
      </nav>
      <div class="sidebar-footer">
        <button class="theme-toggle" @click="isDark = !isDark">{{ isDark ? '☀️' : '🌙' }}</button>
        <span class="admin-name">{{ authStore.user?.name || '管理员' }}</span>
        <button class="logout-btn" @click="handleLogout">退出</button>
      </div>
    </aside>
    <main class="admin-main">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../../stores/auth.js';

const router = useRouter();
const authStore = useAuthStore();
const isDark = ref(localStorage.getItem('admin_theme') === 'dark');

const menuItems = [
  { path: '/admin/dashboard', label: '仪表盘', icon: '📊' },
  { path: '/admin/users', label: '用户管理', icon: '👥' },
  { path: '/admin/admins', label: '管理员', icon: '🔑' },
  { path: '/admin/roles', label: '角色权限', icon: '🛡️' },
  { path: '/admin/tenants', label: '租户管理', icon: '🏢' },
  { path: '/admin/subscriptions', label: '订阅套餐', icon: '💳' },
  { path: '/admin/credits', label: '积分管理', icon: '🪙' },
  { path: '/admin/coupons', label: '优惠券', icon: '🎫' },
  { path: '/admin/agents', label: 'Agent统计', icon: '🤖' },
  { path: '/admin/context-conflicts', label: '上下文冲突', icon: '⚖️' },
  { path: '/admin/audit-logs', label: '审计日志', icon: '📋' },
  { path: '/admin/system', label: '系统配置', icon: '⚙️' },
  { path: '/admin/announcements', label: '公告管理', icon: '📢' },
  { path: '/admin/invite-codes', label: '邀请码', icon: '🔗' },
  { path: '/admin/payment', label: '支付管理', icon: '💳' },
  { path: '/admin/ai-models', label: 'AI模型管理', icon: '🤖' },
];

watch(isDark, (v) => {
  localStorage.setItem('admin_theme', v ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', v ? 'dark' : 'light');
});

onMounted(() => {
  document.documentElement.setAttribute('data-theme', isDark.value ? 'dark' : 'light');
  // Verify admin auth on mount
  authStore.fetchMe().catch(() => {});
});

function handleLogout() {
  authStore.logout();
  router.push('/admin/login');
}
</script>

<style scoped>
.admin-layout {
  display: flex;
  min-height: 100vh;
  background: #f5f7fa;
}
.admin-layout.dark-mode {
  background: #1a1a2e;
}
.admin-sidebar {
  width: 240px;
  background: #fff;
  border-right: 1px solid #e4e7ed;
  display: flex;
  flex-direction: column;
  position: fixed;
  top: 0; left: 0; bottom: 0;
  z-index: 100;
}
.dark-mode .admin-sidebar {
  background: #16213e;
  border-right-color: #2a2a4a;
}
.sidebar-header {
  padding: 24px 20px 16px;
  border-bottom: 1px solid #e4e7ed;
}
.dark-mode .sidebar-header { border-bottom-color: #2a2a4a; }
.sidebar-header h2 { margin: 0; font-size: 18px; color: #303133; }
.dark-mode .sidebar-header h2 { color: #e0e0e0; }
.sidebar-subtitle { font-size: 12px; color: #909399; }
.sidebar-nav {
  flex: 1;
  overflow-y: auto;
  padding: 12px 0;
}
.nav-item {
  display: flex;
  align-items: center;
  padding: 10px 20px;
  color: #606266;
  text-decoration: none;
  font-size: 14px;
  transition: all 0.2s;
}
.nav-item:hover { background: #f0f2f5; color: #409eff; }
.nav-item.active { background: #ecf5ff; color: #409eff; font-weight: 600; }
.dark-mode .nav-item { color: #b0b0b0; }
.dark-mode .nav-item:hover { background: #1e2a4a; color: #60a0ff; }
.dark-mode .nav-item.active { background: #1a2744; color: #60a0ff; }
.nav-icon { margin-right: 10px; font-size: 16px; }
.sidebar-footer {
  padding: 16px 20px;
  border-top: 1px solid #e4e7ed;
  display: flex;
  align-items: center;
  gap: 8px;
}
.dark-mode .sidebar-footer { border-top-color: #2a2a4a; }
.admin-name { flex: 1; font-size: 13px; color: #606266; }
.dark-mode .admin-name { color: #b0b0b0; }
.theme-toggle, .logout-btn {
  background: none; border: 1px solid #dcdfe6; border-radius: 6px;
  padding: 4px 10px; cursor: pointer; font-size: 12px;
}
.dark-mode .theme-toggle, .dark-mode .logout-btn { border-color: #3a3a5a; color: #b0b0b0; }
.admin-main {
  flex: 1;
  margin-left: 240px;
  padding: 24px;
}
</style>
