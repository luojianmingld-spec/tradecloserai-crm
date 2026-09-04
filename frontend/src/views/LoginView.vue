<template>
  <div class="login-page">
    <!-- ========== 左侧品牌区 ========== -->
    <div class="brand-panel">
      <div class="brand-inner">
        <div class="brand-top">
          <img src="/tc-logo.png" alt="TradeCloser AI" class="brand-logo" />
          <div class="brand-title">
            <div class="brand-name">TradeCloser AI</div>
            <div class="brand-slogan">外贸客户沟通平台</div>
          </div>
        </div>

        <div class="brand-hero">
          <div class="hero-glow"></div>
          <svg viewBox="0 0 24 24" class="hero-infinity" aria-hidden="true">
            <defs>
              <linearGradient id="tcHeroGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#3b82f6" />
                <stop offset="45%" stop-color="#a855f7" />
                <stop offset="100%" stop-color="#f59e0b" />
              </linearGradient>
            </defs>
            <path d="M18.6 6.62c-1.44 0-2.8.56-3.77 1.53L12 10.66 9.17 8.15C8.2 7.18 6.84 6.62 5.4 6.62 2.42 6.62 0 9.04 0 12s2.42 5.38 5.4 5.38c1.44 0 2.8-.56 3.77-1.53L12 13.34l2.83 2.51c.97.97 2.33 1.53 3.77 1.53 2.98 0 5.4-2.42 5.4-5.38s-2.42-5.38-5.4-5.38z" fill="url(#tcHeroGrad)" />
          </svg>

          <!-- 漂浮元素 -->
          <div class="float-item fi-bubble">
            <svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M12 3C6.5 3 2 6.58 2 11c0 2.02.94 3.86 2.48 5.23L3 21l5.05-1.9c1.22.45 2.55.69 3.95.69 5.5 0 10-3.58 10-8s-4.5-8-10-8z"/></svg>
          </div>
          <div class="float-item fi-globe">
            <svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm6.93 6h-2.95a15.65 15.65 0 0 0-1.38-3.56A8.03 8.03 0 0 1 18.93 8zM12 4c.83 1.2 1.51 2.56 1.95 4H10.05c.44-1.44 1.12-2.8 1.95-4zM4.26 14a8.1 8.1 0 0 1 0-4h3.38a16.9 16.9 0 0 0 0 4H4.26zm.81 2h2.95c.32 1.28.8 2.49 1.38 3.56A8.03 8.03 0 0 1 5.07 16zm2.95-8H5.07a8.03 8.03 0 0 1 4.33-3.56A15.65 15.65 0 0 0 8.02 8zM12 20c-.83-1.2-1.51-2.56-1.95-4h3.9c-.44 1.44-1.12 2.8-1.95 4zm2.6-6H9.4a14.9 14.9 0 0 1 0-4h5.2a14.9 14.9 0 0 1 0 4zm.33 5.56c.58-1.07 1.06-2.28 1.38-3.56h2.95a8.03 8.03 0 0 1-4.33 3.56zM16.36 14a16.9 16.9 0 0 0 0-4h3.38a8.1 8.1 0 0 1 0 4h-3.38z"/></svg>
          </div>
          <div class="float-item fi-node">
            <svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M6 2a4 4 0 0 0-4 4 4 4 0 0 0 2.5 3.71V14.3A4 4 0 0 0 2 18a4 4 0 0 0 8 0 4 4 0 0 0-2.5-3.7v-.13A11 11 0 0 1 13 16h.58A4 4 0 0 0 20 12a4 4 0 0 0-6.4-3.13A11 11 0 0 1 7.5 5.7A4 4 0 0 0 6 2z"/></svg>
          </div>
        </div>

        <div class="brand-features">
          <div class="feature">
            <span class="f-dot" style="--fc:#3b82f6"></span>
            <span>6 大外贸专属 Agent 协同作战</span>
          </div>
          <div class="feature">
            <span class="f-dot" style="--fc:#a855f7"></span>
            <span>WhatsApp 全球客户智能沟通</span>
          </div>
          <div class="feature">
            <span class="f-dot" style="--fc:#f59e0b"></span>
            <span>共享上下文 · 多端实时同步</span>
          </div>
        </div>

        <div class="brand-foot">© 2026 TradeCloser AI · 让外贸沟通更简单</div>
      </div>
    </div>

    <!-- ========== 右侧登录区 ========== -->
    <div class="login-panel">
      <div class="login-card">
        <div class="login-header">
          <img src="/tc-logo.png" alt="TradeCloser AI" class="login-logo" />
          <h1>欢迎回来</h1>
          <p class="subtitle">登录你的 TradeCloser AI 账号</p>
        </div>

        <el-form ref="formRef" :model="form" :rules="rules" @submit.prevent="handleLogin">
          <el-form-item prop="username">
            <el-input
              v-model="form.username"
              placeholder="用户名"
              size="large"
              :prefix-icon="User"
            />
          </el-form-item>

          <el-form-item prop="password">
            <el-input
              v-model="form.password"
              type="password"
              placeholder="密码"
              size="large"
              :prefix-icon="Lock"
              show-password
              @keyup.enter="handleLogin"
            />
          </el-form-item>

          <el-form-item>
            <el-button
              type="primary"
              size="large"
              :loading="loading"
              class="login-btn"
              @click="handleLogin"
            >
              登录
            </el-button>
          </el-form-item>
        </el-form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { User, Lock } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { useAuthStore } from '../stores/auth.js';
import { initSocket } from '../utils/socket.js';

const router = useRouter();
const authStore = useAuthStore();

const formRef = ref(null);
const loading = ref(false);
const form = reactive({
  username: '',
  password: '',
});

const rules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
};

async function handleLogin() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;

  loading.value = true;
  try {
    await authStore.login(form.username, form.password);
    ElMessage.success('登录成功');
    initSocket();
    router.push('/');
  } catch (err) {
    ElMessage.error(err.response?.data?.error || '操作失败');
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.login-page {
  height: 100vh;
  width: 100%;
  display: flex;
  overflow: hidden;
  color: #e8ecf5;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
  /* 统一底色：深蓝紫渐变（左右两侧共用一个背景） */
  background:
    radial-gradient(1100px 700px at 12% 8%, rgba(59, 130, 246, 0.16), transparent 62%),
    radial-gradient(900px 650px at 85% 92%, rgba(168, 85, 247, 0.13), transparent 62%),
    radial-gradient(700px 500px at 92% 15%, rgba(245, 158, 11, 0.09), transparent 60%),
    linear-gradient(160deg, #0a0f22 0%, #0d1530 45%, #131b3d 100%);
}

/* ================= 左侧品牌区 ================= */
.brand-panel {
  flex: 1.25;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: transparent;
}

.brand-panel::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.025) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.025) 1px, transparent 1px);
  background-size: 56px 56px;
  mask-image: radial-gradient(ellipse at 40% 40%, rgba(0, 0, 0, 0.7), transparent 75%);
  -webkit-mask-image: radial-gradient(ellipse at 40% 40%, rgba(0, 0, 0, 0.7), transparent 75%);
  pointer-events: none;
}

.brand-inner {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 560px;
  padding: 56px 64px;
  display: flex;
  flex-direction: column;
  height: 100%;
  box-sizing: border-box;
}

.brand-top {
  display: flex;
  align-items: center;
  gap: 16px;
}

.brand-logo {
  width: 54px;
  height: 54px;
  border-radius: 14px;
  object-fit: cover;
  box-shadow: 0 8px 30px rgba(124, 58, 237, 0.35);
}

.brand-name {
  font-size: 24px;
  font-weight: 700;
  letter-spacing: 0.5px;
  background: linear-gradient(90deg, #dbeafe, #ede9fe 55%, #fef3c7);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.brand-slogan {
  font-size: 13px;
  color: rgba(226, 232, 240, 0.55);
  margin-top: 2px;
  letter-spacing: 1px;
}

.brand-hero {
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 260px;
}

.hero-glow {
  position: absolute;
  width: 300px;
  height: 300px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(139, 92, 246, 0.22) 0%, rgba(59, 130, 246, 0.08) 45%, transparent 70%);
  filter: blur(10px);
}

.hero-infinity {
  width: 210px;
  height: 210px;
  position: relative;
  z-index: 1;
  filter: drop-shadow(0 0 26px rgba(139, 92, 246, 0.45));
  animation: heroPulse 4.5s ease-in-out infinite;
}

@keyframes heroPulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.045); opacity: 0.92; }
}

.float-item {
  position: absolute;
  width: 46px;
  height: 46px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  box-shadow: 0 12px 34px rgba(0, 0, 0, 0.35);
}

.fi-bubble {
  top: 16%;
  left: 8%;
  color: #60a5fa;
  animation: floatY 5s ease-in-out infinite;
}

.fi-globe {
  top: 8%;
  right: 10%;
  color: #c084fc;
  animation: floatY 5.6s ease-in-out 0.6s infinite;
}

.fi-node {
  bottom: 16%;
  right: 4%;
  color: #fbbf24;
  animation: floatY 6.2s ease-in-out 1.1s infinite;
}

@keyframes floatY {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-14px); }
}

.brand-features {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding-bottom: 24px;
}

.feature {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 14px;
  color: rgba(226, 232, 240, 0.78);
}

.f-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--fc);
  box-shadow: 0 0 10px var(--fc);
  flex-shrink: 0;
}

.brand-foot {
  font-size: 12px;
  color: rgba(148, 163, 184, 0.5);
  letter-spacing: 0.5px;
}

/* ================= 右侧登录区 ================= */
.login-panel {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
  background: transparent;
  box-sizing: border-box;
}

.login-card {
  width: 100%;
  max-width: 420px;
  padding: 42px 42px 34px;
  background: linear-gradient(180deg, rgba(20, 28, 52, 0.85), rgba(13, 19, 38, 0.9));
  border: 1px solid rgba(148, 163, 184, 0.16);
  border-radius: 20px;
  box-shadow: 0 30px 80px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.06);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  box-sizing: border-box;
}

.login-header {
  text-align: center;
  margin-bottom: 26px;
}

.login-logo {
  width: 68px;
  height: 68px;
  border-radius: 18px;
  object-fit: cover;
  margin-bottom: 18px;
  box-shadow: 0 12px 38px rgba(124, 58, 237, 0.4);
}

h1 {
  font-size: 26px;
  font-weight: 700;
  margin: 0 0 8px;
  letter-spacing: 0.5px;
  background: linear-gradient(90deg, #e2e8f0, #f3e8ff);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.subtitle {
  color: rgba(148, 163, 184, 0.8);
  font-size: 14px;
  margin: 0;
}

:deep(.el-input__wrapper) {
  background-color: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 10px;
  box-shadow: none;
  padding: 4px 14px;
}

:deep(.el-input__wrapper:hover) {
  border-color: rgba(168, 85, 247, 0.5);
}

:deep(.el-input__wrapper.is-focus) {
  border-color: #a855f7;
  background-color: rgba(168, 85, 247, 0.06);
}

:deep(.el-input__inner) {
  color: #e8ecf5;
  height: 40px;
}

:deep(.el-input__inner::placeholder) {
  color: rgba(148, 163, 184, 0.55);
}

:deep(.el-input__prefix .el-icon) {
  color: rgba(148, 163, 184, 0.7);
}

.login-btn {
  width: 100%;
  font-size: 16px;
  height: 46px;
  border: none;
  border-radius: 10px;
  background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 55%, #a855f7 100%);
  box-shadow: 0 10px 30px rgba(124, 58, 237, 0.35);
  letter-spacing: 2px;
  transition: all .25s ease;
}

.login-btn:hover {
  background: linear-gradient(135deg, #2563eb 0%, #7c3aed 55%, #9333ea 100%);
  box-shadow: 0 12px 36px rgba(124, 58, 237, 0.5);
  transform: translateY(-1px);
}

.login-btn.is-loading {
  background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 55%, #a855f7 100%);
  opacity: 0.85;
}

/* ================= 响应式 ================= */
@media (max-width: 960px) {
  .brand-panel {
    display: none;
  }
  .login-panel {
    flex: 1;
    padding: 24px;
  }
  .login-card {
    padding: 34px 28px 28px;
  }
}
</style>
