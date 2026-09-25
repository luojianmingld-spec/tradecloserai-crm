import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router/index.js';
import './styles/global.css';
import { checkForUpdate } from './utils/app-updater.js';

// ===== 自动缓存清理（2026-08-29）：构建版本变化时清理旧缓存，无需手动操作 =====
(function versionCheckAndClean() {
  const VERSION_KEY = 'crm_build_version';
  // 白名单：登录态与主题等关键项必须保留
  const WHITELIST = ['crm_token', 'token', 'crm_user', 'crm-theme', VERSION_KEY];
  const currentBuild = typeof __APP_BUILD__ !== 'undefined' ? __APP_BUILD__ : 'dev';
  try {
    const prev = localStorage.getItem(VERSION_KEY);
    if (prev !== currentBuild) {
      // 清理非白名单 localStorage 项
      const toRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && !WHITELIST.includes(k)) toRemove.push(k);
      }
      toRemove.forEach((k) => localStorage.removeItem(k));
      // 清理 Cache Storage
      if ('caches' in window) {
        caches.keys()
          .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
          .catch(() => {});
      }
      localStorage.setItem(VERSION_KEY, currentBuild);
    }
  } catch (e) { /* 忽略异常，不影响启动 */ }
})();

// ===== APP(Android Capacitor) 后端地址注入：裸 fetch 统一走这里，网页端为空字符串 =====
window.__API_BASE__ = (window.Capacitor && window.Capacitor.getPlatform && window.Capacitor.getPlatform() !== 'web')
  ? 'http://45.76.223.251:3002'
  : '';

const savedTheme = localStorage.getItem('crm-theme') || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.mount('#app');

// In-app update check (Capacitor Android only, 3s after mount)
setTimeout(() => { checkForUpdate(); }, 3000);
