import axios from 'axios';
import { useAuthStore } from '../stores/auth.js';

const api = axios.create({
  baseURL: '/api',
  timeout: 60000,
});

api.interceptors.request.use((config) => {
  const authStore = useAuthStore();
  if (authStore.token) {
    config.headers.Authorization = `Bearer ${authStore.token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const authStore = useAuthStore();
      const isAdminPage = window.location.pathname.startsWith('/admin');
      const isAuthEndpoint = error.config?.url?.match(/\/(admin\/auth|auth)\//);

      if (isAdminPage) {
        // Only logout/redirect on admin auth endpoints, not on random API 401s
        if (isAuthEndpoint) {
          authStore.logout();
          window.location.href = '/admin/login';
        }
      } else {
        authStore.logout();
        window.location.href = '/login';
      }
    }
    // 402: 积分余额不足（AI 调用），统一引导充值
    if (error.response?.status === 402 && error.response?.data?.code === 'INSUFFICIENT_CREDITS') {
      if (!window.location.pathname.startsWith('/credits')) {
        const balance = error.response.data.balance;
        import('element-plus').then(({ ElMessageBox }) => {
          ElMessageBox.confirm(
            `积分余额不足（当前 ${balance} 分），是否前往充值？`,
            '积分不足',
            { confirmButtonText: '去充值', cancelButtonText: '取消', type: 'warning' }
          ).then(() => { window.location.href = '/credits'; }).catch(() => {});
        });
      }
    }
    return Promise.reject(error);
  }
);

export default api;
