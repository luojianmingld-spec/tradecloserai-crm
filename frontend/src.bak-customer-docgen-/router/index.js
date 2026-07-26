import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "../stores/auth.js";

const routes = [
  {
    path: "/login",
    name: "Login",
    component: () => import("../views/LoginView.vue"),
    meta: { requiresAuth: false },
  },
  {
    path: "/",
    component: () => import("../views/LayoutView.vue"),
    meta: { requiresAuth: true },
    children: [
      {
        path: "",
        redirect: "/chat",
      },
      {
        path: "dashboard",
        name: "Dashboard",
        component: () => import("../views/DashboardView.vue"),
      },
      {
        path: "chat",
        name: "Chat",
        component: () => import("../views/ChatView.vue"),
      },
      {
        path: "emails",
        name: "Emails",
        component: () => import("../views/EmailView.vue"),
      },
      {
        path: "customers",
        name: "Customers",
        component: () => import("../views/CustomersView.vue"),
      },
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
    next("/chat");
  } else {
    next();
  }
});

export default router;
