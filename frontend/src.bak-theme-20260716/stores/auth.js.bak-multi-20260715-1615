import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import api from '../utils/api.js';

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem('crm_token') || '');
  const user = ref(JSON.parse(localStorage.getItem('crm_user') || 'null'));

  const isAuthenticated = computed(() => !!token.value);

  async function login(username, password) {
    const { data } = await api.post('/auth/login', { username, password });
    token.value = data.token;
    user.value = data.user;
    localStorage.setItem('crm_token', data.token);
    localStorage.setItem('crm_user', JSON.stringify(data.user));
    return data;
  }

  async function register(username, password, name) {
    const { data } = await api.post('/auth/register', { username, password, name });
    token.value = data.token;
    user.value = data.user;
    localStorage.setItem('crm_token', data.token);
    localStorage.setItem('crm_user', JSON.stringify(data.user));
    return data;
  }

  function logout() {
    token.value = '';
    user.value = null;
    localStorage.removeItem('crm_token');
    localStorage.removeItem('crm_user');
  }

  function checkAuth() {
    const savedToken = localStorage.getItem('crm_token');
    const savedUser = localStorage.getItem('crm_user');
    if (savedToken) {
      token.value = savedToken;
      user.value = JSON.parse(savedUser || 'null');
    }
  }

  return { token, user, isAuthenticated, login, register, logout, checkAuth };
});
