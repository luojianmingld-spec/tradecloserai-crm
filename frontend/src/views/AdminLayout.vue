<template>
  <div class="admin-layout">
    <!-- 左侧菜单 -->
    <aside class="admin-sidebar" :class="{ collapsed: sidebarCollapsed }">
      <div class="sidebar-header">
        <span class="logo-icon">⚙️</span>
        <span v-show="!sidebarCollapsed" class="logo-text">TradeCloser Admin</span>
        <el-icon class="collapse-btn" @click="sidebarCollapsed = !sidebarCollapsed">
          <Fold v-if="!sidebarCollapsed" /><Expand v-else />
        </el-icon>
      </div>
      <el-scrollbar class="sidebar-scroll">
        <el-menu
          :default-active="activeMenu"
          :collapse="sidebarCollapsed"
          :collapse-transition="false"
          background-color="#001529"
          text-color="#ffffffa6"
          active-text-color="#fff"
          @select="handleMenuSelect"
        >
          <el-sub-menu index="data-overview">
            <template #title>
              <el-icon><DataBoard /></el-icon>
              <span>数据总览</span>
            </template>
            <el-menu-item index="dashboard">仪表盘</el-menu-item>
          </el-sub-menu>

          <el-sub-menu index="permission">
            <template #title>
              <el-icon><Lock /></el-icon>
              <span>权限管理</span>
            </template>
            <el-menu-item index="permission">管理员与角色</el-menu-item>
            <el-menu-item index="audit-log">审计日志</el-menu-item>
          </el-sub-menu>

          <el-sub-menu index="user-mgmt">
            <template #title>
              <el-icon><User /></el-icon>
              <span>用户管理</span>
            </template>
            <el-menu-item index="users">用户列表</el-menu-item>
          </el-sub-menu>

          <el-sub-menu index="subscription-finance">
            <template #title>
              <el-icon><Wallet /></el-icon>
              <span>订阅财务</span>
            </template>
            <el-menu-item index="subscription">套餐与订阅</el-menu-item>
            <el-menu-item index="finance">收入与积分</el-menu-item>
            <el-menu-item index="coupons">优惠券</el-menu-item>
          </el-sub-menu>

          <el-sub-menu index="agent-mgmt">
            <template #title>
              <el-icon><Cpu /></el-icon>
              <span>Agent管理</span>
            </template>
            <el-menu-item index="agents">Agent监控</el-menu-item>
            <el-menu-item index="agent-config">Agent配置</el-menu-item>
          </el-sub-menu>

          <el-sub-menu index="system-ops">
            <template #title>
              <el-icon><Setting /></el-icon>
              <span>系统配置</span>
            </template>
            <el-menu-item index="system-config">基础配置</el-menu-item>
          </el-sub-menu>

          <el-sub-menu index="ops-tools">
            <template #title>
              <el-icon><Tools /></el-icon>
              <span>运营工具</span>
            </template>
            <el-menu-item index="announcements">公告管理</el-menu-item>
            <el-menu-item index="invite-codes">邀请码</el-menu-item>
          </el-sub-menu>
        </el-menu>
      </el-scrollbar>
    </aside>

    <!-- 右侧 -->
    <div class="admin-main">
      <header class="admin-header">
        <div class="header-left">
          <el-breadcrumb separator="/">
            <el-breadcrumb-item :to="{ path: '/admin/dashboard' }">后台</el-breadcrumb-item>
            <el-breadcrumb-item>{{ currentGroup }}</el-breadcrumb-item>
            <el-breadcrumb-item>{{ currentPage }}</el-breadcrumb-item>
          </el-breadcrumb>
        </div>
        <div class="header-right">
          <el-popover placement="bottom" :width="320" trigger="click">
            <template #reference>
              <el-badge :value="notifications.length" :max="99" class="notify-badge">
                <el-icon :size="20"><Bell /></el-icon>
              </el-badge>
            </template>
            <div class="notify-panel">
              <h4 style="margin:0 0 12px;font-size:14px;">通知</h4>
              <div v-if="notifications.length === 0" style="text-align:center;color:#909399;padding:20px 0;">暂无通知</div>
              <div v-for="(n, i) in notifications" :key="i" class="notify-item">
                <div class="notify-title">{{ n.title }}</div>
                <div class="notify-time">{{ n.time }}</div>
              </div>
            </div>
          </el-popover>
          <el-dropdown trigger="click" @command="handleCommand">
            <span class="admin-user">
              <el-avatar :size="32" style="background:#409EFF">{{ adminInitial }}</el-avatar>
              <span class="admin-name">{{ adminName }}</span>
              <el-icon><ArrowDown /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="home">返回主站</el-dropdown-item>
                <el-dropdown-item divided command="logout">退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </header>

      <main class="admin-content">
        <router-view />
      </main>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth.js";
import { ElMessageBox } from "element-plus";

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const sidebarCollapsed = ref(false);

const adminName = computed(() => authStore.user?.name || authStore.user?.username || "管理员");
const adminInitial = computed(() => (adminName.value || "A").charAt(0).toUpperCase());

const notifications = ref([
  { title: '新用户注册异常增长', time: '10分钟前' },
  { title: 'Legal Agent 错误率超过阈值', time: '25分钟前' },
  { title: '系统备份已完成', time: '1小时前' },
])

const menuMeta = {
  dashboard: { group: "数据总览", page: "仪表盘" },
  permission: { group: "权限管理", page: "管理员与角色" },
  "audit-log": { group: "权限管理", page: "审计日志" },
  users: { group: "用户管理", page: "用户列表" },
  "user-detail": { group: "用户管理", page: "用户详情" },
  subscription: { group: "订阅财务", page: "套餐与订阅" },
  finance: { group: "订阅财务", page: "收入与积分" },
  coupons: { group: "订阅财务", page: "优惠券" },
  agents: { group: "Agent管理", page: "Agent监控" },
  "agent-config": { group: "Agent管理", page: "Agent配置" },
  "system-config": { group: "系统配置", page: "基础配置" },
  announcements: { group: "运营工具", page: "公告管理" },
  "invite-codes": { group: "运营工具", page: "邀请码" },
};

const activeMenu = computed(() => {
  const seg = route.path.replace("/admin/", "").split("/")[0] || "dashboard";
  return seg;
});

const currentGroup = computed(() => menuMeta[activeMenu.value]?.group || "后台");
const currentPage = computed(() => menuMeta[activeMenu.value]?.page || "");

function handleMenuSelect(index) {
  // agent-config points to agents page for now
  if (index === 'agent-config') {
    router.push('/admin/agents');
  } else {
    router.push(`/admin/${index}`);
  }
}

function handleCommand(cmd) {
  if (cmd === "home") router.push("/");
  else if (cmd === "logout") {
    ElMessageBox.confirm("确定要退出登录吗？", "提示", {
      confirmButtonText: "确定",
      cancelButtonText: "取消",
      type: "warning",
    }).then(() => {
      authStore.logout();
      router.push("/login");
    }).catch(() => {});
  }
}
</script>

<style scoped>
.admin-layout {
  min-height: 100vh;
  display: flex;
  background: #f0f2f5;
}

.admin-sidebar {
  width: 240px;
  background: #001529;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  transition: width 0.28s;
  overflow: hidden;
}
.admin-sidebar.collapsed {
  width: 64px;
}

.sidebar-header {
  height: 56px;
  display: flex;
  align-items: center;
  padding: 0 16px;
  gap: 10px;
  border-bottom: 1px solid #ffffff1a;
  flex-shrink: 0;
}
.logo-icon { font-size: 22px; }
.logo-text {
  font-size: 15px;
  font-weight: 700;
  color: #fff;
  white-space: nowrap;
}
.collapse-btn {
  margin-left: auto;
  color: #ffffffa6;
  cursor: pointer;
  font-size: 18px;
}
.collapse-btn:hover { color: #fff; }

.sidebar-scroll {
  flex: 1;
  overflow: hidden;
}

.admin-sidebar :deep(.el-menu) {
  border-right: none;
}
.admin-sidebar :deep(.el-sub-menu__title),
.admin-sidebar :deep(.el-menu-item) {
  height: 48px;
  line-height: 48px;
  font-size: 13px;
}
.admin-sidebar :deep(.el-menu-item.is-active) {
  background-color: #1890ff !important;
  color: #fff !important;
  border-radius: 0;
}
.admin-sidebar :deep(.el-sub-menu .el-menu) {
  background: #000c17 !important;
}
.admin-sidebar :deep(.el-sub-menu .el-menu .el-menu-item) {
  padding-left: 52px !important;
  font-size: 12px;
  height: 42px;
  line-height: 42px;
}

/* collapsed icon centering */
.admin-sidebar.collapsed :deep(.el-sub-menu__title),
.admin-sidebar.collapsed :deep(.el-menu-item) {
  padding: 0 !important;
  text-align: center;
}
.admin-sidebar.collapsed :deep(.el-sub-menu__title .el-icon),
.admin-sidebar.collapsed :deep(.el-menu-item .el-icon) {
  margin-right: 0;
}
.admin-sidebar.collapsed .sidebar-header {
  justify-content: center;
  padding: 0;
}
.admin-sidebar.collapsed .collapse-btn { display: none; }

.admin-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.admin-header {
  height: 56px;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.08);
  flex-shrink: 0;
  z-index: 10;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 20px;
}
.notify-badge { cursor: pointer; }

.admin-user {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  color: #333;
}
.admin-name { font-size: 14px; font-weight: 500; }

.admin-content {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
}

/* Notification popover */
.notify-panel { max-height: 300px; overflow-y: auto; }
.notify-item { padding: 8px 0; border-bottom: 1px solid #f0f0f0; }
.notify-item:last-child { border-bottom: none; }
.notify-title { font-size: 13px; color: #303133; }
.notify-time { font-size: 11px; color: #909399; margin-top: 4px; }
</style>
