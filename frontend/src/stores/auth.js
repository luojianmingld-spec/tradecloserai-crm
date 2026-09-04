import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import api from '../utils/api.js';

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem('crm_token') || '');
  const user = ref(JSON.parse(localStorage.getItem('crm_user') || 'null'));

  const isAuthenticated = computed(() => !!token.value && token.value !== 'undefined');

  async function login(username, password) {
    const { data } = await api.post('/auth/login', { username, password });
    token.value = data.token;
    user.value = data.user;
    localStorage.setItem('crm_token', data.token);
    localStorage.setItem('token', data.token);
    localStorage.setItem('crm_user', JSON.stringify(data.user));
    return data;
  }

  // 手机号验证码登录（社区+产品账号打通 2026-08-19）
  async function sendPhoneCode(phone) {
    const { data } = await api.post('/auth/phone/send-code', { phone });
    return data;
  }

  async function phoneLogin(phone, code) {
    const { data } = await api.post('/auth/phone-login', { phone, code });
    token.value = data.token;
    user.value = data.user;
    localStorage.setItem('crm_token', data.token);
    localStorage.setItem('token', data.token);
    localStorage.setItem('crm_user', JSON.stringify(data.user));
    return data;
  }

  function logout() {
    token.value = '';
    user.value = null;
    localStorage.removeItem('crm_token');
    localStorage.removeItem('token');
    localStorage.removeItem('crm_user');
  }

  function checkAuth() {
    const savedToken = localStorage.getItem('crm_token');
    const savedUser = localStorage.getItem('crm_user');
    if (savedToken && savedToken !== 'undefined') {
      token.value = savedToken;
      localStorage.setItem('token', savedToken);
      user.value = JSON.parse(savedUser || 'null');
    }
  }

  async function fetchMe() {
    try {
      const isAdminPage = window.location.pathname.startsWith('/admin');
      const endpoint = isAdminPage ? '/admin/auth/me' : '/auth/me';
      const res = await api.get(endpoint);
      // /admin/auth/me returns { data: { admin info } }
      // /auth/me returns { user info } directly
      const userData = isAdminPage ? (res.data?.data || res.data) : res.data;
      user.value = userData;
      localStorage.setItem('crm_user', JSON.stringify(userData));
      return userData;
    } catch (e) {
      // Only logout on non-admin pages; admin pages handle their own auth
      if (!window.location.pathname.startsWith('/admin')) {
        logout();
      }
      throw e;
    }
  }

  return { token, user, isAuthenticated, login, sendPhoneCode, phoneLogin, logout, checkAuth, fetchMe };
});
