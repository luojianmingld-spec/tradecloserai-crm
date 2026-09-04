<template>
  <div class="admin-login-container">
    <div class="admin-login-card">
      <div class="admin-login-header">
        <h1>TradeCloser AI</h1>
        <p>超级管理员后台</p>
      </div>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="0" size="large">
        <el-form-item prop="username">
          <el-input v-model="form.username" placeholder="管理员账号" prefix-icon="User" />
        </el-form-item>
        <el-form-item prop="password">
          <el-input v-model="form.password" type="password" placeholder="密码" prefix-icon="Lock" show-password @keyup.enter="handleLogin" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="loading" style="width:100%" @click="handleLogin">登 录</el-button>
        </el-form-item>
      </el-form>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../../stores/auth.js';
import { ElMessage } from 'element-plus';
import api from '../../utils/api.js';

const router = useRouter();
const authStore = useAuthStore();
const formRef = ref(null);
const loading = ref(false);
const form = reactive({ username: '', password: '' });
const rules = {
  username: [{ required: true, message: '请输入账号', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
};

async function handleLogin() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;
  loading.value = true;
  try {
    const res = await api.post('/admin/auth/login', form);
    // 后端 res.json({ data: { token, admin } })
    // axios response.data = { data: { token, admin } }
    // 所以要取 res.data.data 才能拿到 token 和 admin
    const inner = res.data?.data || res.data;
    const token = inner.token;
    const adminUser = inner.admin || inner.user;

    authStore.token = token;
    authStore.user = adminUser;
    localStorage.setItem('crm_token', token);
    localStorage.setItem('crm_user', JSON.stringify(adminUser));

    ElMessage.success('登录成功');
    router.push('/admin/dashboard');
  } catch (e) {
    ElMessage.error(e.response?.data?.error || '登录失败，请检查账号密码');
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.admin-login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
}
.admin-login-card {
  width: 400px;
  padding: 40px;
  background: rgba(255,255,255,0.95);
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
}
.admin-login-header { text-align: center; margin-bottom: 32px; }
.admin-login-header h1 { font-size: 24px; color: #1a1a2e; margin: 0 0 8px; }
.admin-login-header p { color: #666; font-size: 14px; margin: 0; }
</style>
