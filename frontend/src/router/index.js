import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "../stores/auth.js";

import DashboardView from "../views/DashboardView.vue";
import PipelineView from "../views/PipelineView.vue";
import CustomersListView from "../views/CustomersListView.vue";
import ChatView from "../views/ChatView.vue";
import AssistantView from "../views/AssistantView.vue";
import ProductKnowledgeView from "../views/ProductKnowledgeView.vue";

const routes = [
  {
    path: "/login",
    name: "Login",
    component: () => import("../views/LoginView.vue"),
    meta: { requiresAuth: false },
  },
  // ===== Admin routes =====
  {
    path: "/admin/login",
    name: "AdminLogin",
    component: () => import("../views/admin/AdminLogin.vue"),
    meta: { requiresAuth: false },
  },
  {
    path: "/admin",
    component: () => import("../views/admin/AdminLayout.vue"),
    meta: { requiresAuth: true, requiresAdmin: true },
    children: [
      { path: "", redirect: "/admin/dashboard" },
      { path: "dashboard", name: "AdminDashboard", component: () => import("../views/admin/AdminDashboard.vue"), meta: { requiresAuth: true, requiresAdmin: true } },
      { path: "users", name: "AdminUsers", component: () => import("../views/admin/AdminUsers.vue"), meta: { requiresAuth: true, requiresAdmin: true } },
      { path: "users/:id", name: "AdminUserDetail", component: () => import("../views/admin/AdminUserDetail.vue"), meta: { requiresAuth: true, requiresAdmin: true } },
      { path: "admins", name: "AdminAdmins", component: () => import("../views/admin/AdminAdmins.vue"), meta: { requiresAuth: true, requiresAdmin: true } },
      { path: "roles", name: "AdminRoles", component: () => import("../views/admin/AdminRoles.vue"), meta: { requiresAuth: true, requiresAdmin: true } },
      { path: "tenants", name: "AdminTenants", component: () => import("../views/admin/AdminTenants.vue"), meta: { requiresAuth: true, requiresAdmin: true } },
      { path: "subscriptions", name: "AdminSubscriptions", component: () => import("../views/admin/AdminSubscriptions.vue"), meta: { requiresAuth: true, requiresAdmin: true } },
      { path: "credits", name: "AdminCredits", component: () => import("../views/admin/AdminCredits.vue"), meta: { requiresAuth: true, requiresAdmin: true } },
      { path: "coupons", name: "AdminCoupons", component: () => import("../views/admin/AdminCoupons.vue"), meta: { requiresAuth: true, requiresAdmin: true } },
      { path: "agents", name: "AdminAgents", component: () => import("../views/admin/AdminAgents.vue"), meta: { requiresAuth: true, requiresAdmin: true } },
      { path: "context-conflicts", name: "AdminContextConflicts", component: () => import("../views/admin/AdminContextConflicts.vue"), meta: { requiresAuth: true, requiresAdmin: true } },
      { path: "audit-logs", name: "AdminAuditLogs", component: () => import("../views/admin/AdminAuditLogs.vue"), meta: { requiresAuth: true, requiresAdmin: true } },
      { path: "system", name: "AdminSystem", component: () => import("../views/admin/AdminSystem.vue"), meta: { requiresAuth: true, requiresAdmin: true } },
      { path: "announcements", name: "AdminAnnouncements", component: () => import("../views/admin/AdminAnnouncements.vue"), meta: { requiresAuth: true, requiresAdmin: true } },
      { path: "payment", name: "AdminPayment", component: () => import("../views/admin/AdminPayment.vue"), meta: { requiresAuth: true, requiresAdmin: true } },
      { path: "invite-codes", name: "AdminInviteCodes", component: () => import("../views/admin/AdminInviteCodes.vue"), meta: { requiresAuth: true, requiresAdmin: true } },
      { path: "ai-models", name: "AdminAIModels", component: () => import("../views/AdminAIModels.vue"), meta: { requiresAuth: true, requiresAdmin: true } },
    ],
  },
  // ===== Main app routes =====
  {
    path: "/documents/:id/print",
    name: "DocumentPrint",
    component: () => import("../views/DocumentPrintView.vue"),
    meta: { requiresAuth: true, fullscreen: true },
  },
  {
    path: "/settings",
    name: "Settings",
    component: () => import("../views/SettingsView.vue"),
    meta: { requiresAuth: true, fullscreen: true },
  },
  {
    path: "/",
    component: () => import("../views/LayoutView.vue"),
    meta: { requiresAuth: true },
    children: [
      { path: "", redirect: "/assistant" },
      { path: "dashboard", name: "Dashboard", component: DashboardView },
      { path: "assistant", name: "Assistant", component: AssistantView },
      { path: "chat", name: "Chat", component: ChatView },
      { path: "emails", name: "Emails", redirect: "/", component: () => import("../views/EmailView.vue") },
      { path: "customers", name: "Customers", component: CustomersListView },
      { path: "customers/:id", name: "CustomerDetail", component: () => import("../views/CustomerDetailView.vue") },
      { path: "customers/:id/documents/new", name: "DocumentNew", component: () => import("../views/DocumentEditorView.vue") },
      { path: "customers/:id/documents/:docId/edit", name: "DocumentEdit", component: () => import("../views/DocumentEditorView.vue") },
      { path: "customers/:id/background-report", name: "BackgroundReport", component: () => import("../views/BackgroundReportView.vue"), meta: { requiresAuth: true } },
      { path: "pipeline", name: "Pipeline", component: PipelineView },
      { path: "speech-library", name: "SpeechLibrary", component: () => import("../views/SpeechLibraryView.vue") },
      { path: "effect-tracking", name: "EffectTracking", component: () => import("../views/EffectTrackingView.vue") },
      { path: "automation", name: "Automation", component: () => import("../views/AutomationView.vue") },
      { path: "workbench", name: "Workbench", component: () => import("../views/WorkbenchView.vue") },
      { path: "skill-store", name: "SkillStore", component: () => import("../views/SkillStoreView.vue") },
      { path: "product-knowledge", name: "ProductKnowledge", component: ProductKnowledgeView },
      { path: 'trade-shows', name: 'TradeShows', component: () => import('../views/TradeShowsView.vue') },
      { path: "sales-champion", name: "SalesChampion", component: () => import("../views/SalesChampionAgentView.vue") },
      { path: "work-group", name: "WorkGroup", component: () => import("../views/WorkGroupView.vue") },
      { path: "background-report", name: "BackgroundReportAgent", component: () => import("../views/BackgroundAgentView.vue") },
      { path: "customs-agent", name: "CustomsAgent", component: () => import("../views/CustomsAgentView.vue") },
      { path: "doc-agent", name: "DocAgent", component: () => import("../views/FactoryAgentView.vue") },
      { path: "freight-agent", name: "FreightAgent", component: () => import("../views/FreightAgentView.vue") },
      { path: "legal-agent", name: "LegalAgent", component: () => import("../views/LegalAgentView.vue") },
      { path: "my-stats", name: "MyStats", component: () => import("../views/MyPerformanceView.vue") },
      { path: "credits", name: "Credits", component: () => import("../views/user/CreditsView.vue") },
      { path: "credits/transactions", name: "CreditsTransactions", component: () => import("../views/user/CreditsTransactionsView.vue") },
    ],
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to, from, next) => {
  const authStore = useAuthStore();
  const isAdmin = !!to.path.match(/^\/admin/);
  const isAdminLogin = to.path === '/admin/login';

  // Admin login page: no auth needed
  if (isAdminLogin) {
    if (authStore.isAuthenticated) {
      // Already logged in, check if admin
      const role = authStore.user?.role;
      const roleCode = typeof role === 'string' ? role.toLowerCase() : (role?.code || role?.name || '').toLowerCase();
      const isAdminRole = ['admin', 'super_admin', 'operations_admin', 'sales_admin', 'support_admin'].includes(roleCode);
      if (isAdminRole) {
        next('/admin/dashboard');
        return;
      }
    }
    next();
    return;
  }

  // Admin routes: require admin auth
  if (isAdmin && to.meta.requiresAdmin) {
    if (!authStore.isAuthenticated) {
      next('/admin/login');
      return;
    }
    const role = authStore.user?.role;
    const roleCode = typeof role === 'string' ? role.toLowerCase() : (role?.code || role?.name || '').toLowerCase();
    const hasAdminRole = ['admin', 'super_admin', 'operations_admin', 'sales_admin', 'support_admin'].includes(roleCode);
    if (!hasAdminRole) {
      next('/admin/login');
      return;
    }
    next();
    return;
  }

  // Regular routes: require auth
  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    next('/login');
    return;
  }

  // If logged in and going to /login, redirect to main app
  if (to.path === '/login' && authStore.isAuthenticated) {
    next((window.innerWidth <= 900 || /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '')) ? '/dashboard' : '/chat');
    return;
  }

  next();
});

export default router;
