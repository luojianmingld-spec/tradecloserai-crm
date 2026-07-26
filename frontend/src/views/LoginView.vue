<template>
  <div class="login-container">
    <div class="login-card">
      <div class="login-header">
        <div class="logo">
          <svg viewBox="0 0 24 24" fill="none" width="48" height="48">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" fill="#00a884"/>
            <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18a7.96 7.96 0 01-4.11-1.14L4 20l1.14-3.89A7.96 7.96 0 014 12c0-4.411 3.589-8 8-8s8 3.589 8 8-3.589 8-8 8z" fill="#00a884"/>
          </svg>
        </div>
        <h1>TradeAgent</h1>
        <p class="subtitle">外贸客户沟通平台</p>
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
.login-container {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--chat-bg) 0%, var(--panel-bg) 50%, var(--chat-bg) 100%);
}

.login-card {
  width: 400px;
  padding: 48px 40px;
  background: var(--panel-bg);
  border-radius: 16px;
  border: 1px solid var(--border-color);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
}

.login-header {
  text-align: center;
  margin-bottom: 36px;
}

.logo {
  margin-bottom: 16px;
}

h1 {
  font-size: 24px;
  color: var(--text-primary);
  margin-bottom: 8px;
  letter-spacing: 1px;
}

.subtitle {
  color: var(--text-secondary);
  font-size: 14px;
}

:deep(.el-input__wrapper) {
  background-color: var(--input-bg);
  border: 1px solid var(--border-color);
  box-shadow: none;
}

:deep(.el-input__wrapper:hover),
:deep(.el-input__wrapper.is-focus) {
  border-color: var(--accent);
}

:deep(.el-input__inner) {
  color: var(--text-primary);
}

:deep(.el-input__inner::placeholder) {
  color: var(--text-muted);
}

:deep(.el-input__prefix .el-icon) {
  color: var(--text-secondary);
}

.login-btn {
  width: 100%;
  background: var(--accent);
  border-color: var(--accent);
  font-size: 16px;
  height: 44px;
}

.login-btn:hover {
  background: var(--accent-hover);
  border-color: var(--accent-hover);
}

.switch-mode {
  text-align: center;
  margin-top: 4px;
}

.switch-mode span {
  color: var(--accent);
  cursor: pointer;
  font-size: 13px;
}

.switch-mode span:hover {
  text-decoration: underline;
}

.demo-hint {
  text-align: center;
  color: var(--text-muted);
  font-size: 12px;
  margin-top: 8px;
}

.demo-hint p {
  margin-top: 4px;
}

:deep(.el-divider__text) {
  background: var(--panel-bg);
  color: var(--text-muted);
}

:deep(.el-divider) {
  border-color: var(--border-color);
}

@media (max-width: 480px) {
  .login-card {
    width: calc(100vw - 32px);
    padding: 32px 20px;
    border-radius: 12px;
  }

  h1 {
    font-size: 20px;
  }

  .login-btn {
    height: 48px;
    font-size: 16px;
  }

  .switch-mode span {
    padding: 8px 0;
    display: inline-block;
    min-height: 44px;
    line-height: 44px;
  }
}
</style>
