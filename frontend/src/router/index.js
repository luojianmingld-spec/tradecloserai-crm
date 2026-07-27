import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "../stores/auth.js";

// 主要tab页面同步导入，消除切换延迟
import DashboardView from "../views/DashboardView.vue";
import PipelineView from "../views/PipelineView.vue";
import CustomersListView from "../views/CustomersListView.vue";
import ChatView from "../views/ChatView.vue";
import AssistantView from "../views/AssistantView.vue";

const routes = [
  {
    path: "/login",
    name: "Login",
    component: () => import("../views/LoginView.vue"),
    meta: { requiresAuth: false },
  },
  {
    path: "/documents/:id/print",
    name: "DocumentPrint",
    component: () => import("../views/DocumentPrintView.vue"),
    meta: { requiresAuth: true, fullscreen: true },
  },
  {
    path: "/",
    component: () => import("../views/LayoutView.vue"),
    meta: { requiresAuth: true },
    children: [
      { path: "", redirect: '/assistant' },
      { path: "dashboard", name: "Dashboard", component: DashboardView },
      { path: "assistant", name: "Assistant", component: AssistantView },
      { path: "chat", name: "Chat", component: ChatView },
      {
        path: "emails",
        name: "Emails",
        redirect: "/",
        component: () => import("../views/EmailView.vue"),
      },
      { path: "customers", name: "Customers", component: CustomersListView },
      {
        path: "customers/:id",
        name: "CustomerDetail",
        component: () => import("../views/CustomerDetailView.vue"),
      },
      {
        path: "customers/:id/documents/new",
        name: "DocumentNew",
        component: () => import("../views/DocumentEditorView.vue"),
      },
      {
        path: "customers/:id/documents/:docId/edit",
        name: "DocumentEdit",
        component: () => import("../views/DocumentEditorView.vue"),
      },
      { path: "pipeline", name: "Pipeline", component: PipelineView },
      {
        path: "automation",
        name: "Automation",
        component: () => import("../views/AutomationView.vue"),
      },
      {
        path: "skill-store",
        name: "SkillStore",
        component: () => import("../views/SkillStoreView.vue"),
      },
      {
        path: "settings",
        name: "Settings",
        component: () => import("../views/SettingsView.vue"),
      },
    ],
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to, from, next) => {
  const authStore = useAuthStore();
  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    next("/login");
  } else if (to.path === "/login" && authStore.isAuthenticated) {
    next(window.innerWidth <= 768 ? '/dashboard' : '/chat');
  } else {
    next();
  }
});

export default router;
