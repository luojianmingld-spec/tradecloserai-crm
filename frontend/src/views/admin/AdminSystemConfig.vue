<template>
  <div class="admin-system-config">
    <h2>系统配置</h2>

    <el-row :gutter="16">
      <el-col :xs="24" :md="14">
        <el-card shadow="never" class="section-card">
          <template #header><span>基础配置</span></template>
          <el-form :model="config" label-width="140px" class="config-form" v-loading="loading">
            <el-divider content-position="left">站点信息</el-divider>
            <el-form-item label="站点名称"><el-input v-model="config.siteName" /></el-form-item>
            <el-form-item label="站点URL"><el-input v-model="config.siteUrl" /></el-form-item>
            <el-form-item label="管理员邮箱"><el-input v-model="config.adminEmail" /></el-form-item>

            <el-divider content-position="left">积分设置</el-divider>
            <el-form-item label="注册赠送积分"><el-input-number v-model="config.registerCredits" :min="0" :step="100" /></el-form-item>
            <el-form-item label="每日签到积分"><el-input-number v-model="config.dailyCredits" :min="0" :step="1" /></el-form-item>
            <el-form-item label="Agent调用单次消耗"><el-input-number v-model="config.agentCostPerCall" :min="0" :step="1" /></el-form-item>

            <el-divider content-position="left">LLM配置</el-divider>
            <el-form-item label="默认模型">
              <el-select v-model="config.defaultModel" style="width:100%">
                <el-option label="GPT-4o" value="gpt-4o" />
                <el-option label="GPT-4o-mini" value="gpt-4o-mini" />
                <el-option label="Claude 3.5 Sonnet" value="claude-3.5-sonnet" />
                <el-option label="DeepSeek V3" value="deepseek-v3" />
              </el-select>
            </el-form-item>
            <el-form-item label="最大Token"><el-input-number v-model="config.maxTokens" :min="1000" :max="128000" :step="1000" /></el-form-item>
            <el-form-item label="请求超时(秒)"><el-input-number v-model="config.requestTimeout" :min="5" :max="120" /></el-form-item>

            <el-divider content-position="left">安全设置</el-divider>
            <el-form-item label="登录失败锁定次数"><el-input-number v-model="config.maxLoginAttempts" :min="3" :max="20" /></el-form-item>
            <el-form-item label="JWT过期时间(小时)"><el-input-number v-model="config.jwtExpireHours" :min="1" :max="720" /></el-form-item>

            <el-form-item>
              <el-button type="primary" @click="saveConfig" :loading="saving">保存配置</el-button>
              <el-button @click="resetConfig">重置</el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-col>

      <el-col :xs="24" :md="10">
        <el-card shadow="never" class="section-card">
          <template #header><span>功能开关</span></template>
          <div class="toggle-list">
            <div class="toggle-item" v-for="item in toggles" :key="item.key">
              <div class="toggle-info">
                <span class="toggle-name">{{ item.name }}</span>
                <span class="toggle-desc">{{ item.desc }}</span>
              </div>
              <el-switch v-model="item.enabled" @change="toggleChange(item)" />
            </div>
          </div>
        </el-card>

        <el-card shadow="never" class="section-card" style="margin-top:16px">
          <template #header><span>系统信息</span></template>
          <el-descriptions :column="1" border size="small">
            <el-descriptions-item label="系统版本">v2.1.0</el-descriptions-item>
            <el-descriptions-item label="Node.js">v20.11.0</el-descriptions-item>
            <el-descriptions-item label="数据库">PostgreSQL 16</el-descriptions-item>
            <el-descriptions-item label="缓存">Redis 7.2</el-descriptions-item>
            <el-descriptions-item label="运行时间">15天 8小时 32分</el-descriptions-item>
            <el-descriptions-item label="最后部署">2025-01-14 22:00</el-descriptions-item>
          </el-descriptions>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import api from '../../utils/api.js'

const saving = ref(false)
const loading = ref(false)

const defaultConfig = {
  siteName: 'TradeCloser CRM', siteUrl: 'https://crm.example.com', adminEmail: 'admin@example.com',
  registerCredits: 500, dailyCredits: 10, agentCostPerCall: 5,
  defaultModel: 'gpt-4o', maxTokens: 8000, requestTimeout: 30,
  maxLoginAttempts: 5, jwtExpireHours: 24,
}

const config = reactive({ ...defaultConfig })

const mockToggles = [
  { key: 'register', name: '开放注册', desc: '允许新用户自行注册', enabled: true },
  { key: 'invite_only', name: '邀请码模式', desc: '注册需要邀请码', enabled: false },
  { key: 'auto_review', name: '自动审核', desc: '新用户自动审核通过', enabled: true },
  { key: 'maintenance', name: '维护模式', desc: '开启后前台不可访问', enabled: false },
  { key: 'email_notify', name: '邮件通知', desc: '系统事件发送邮件通知', enabled: true },
  { key: 'api_rate_limit', name: 'API限流', desc: '启用API请求频率限制', enabled: true },
  { key: 'debug_mode', name: '调试模式', desc: '输出详细日志', enabled: false },
  { key: 'backup_daily', name: '每日备份', desc: '自动每日备份数据库', enabled: true },
]
const toggles = reactive([...mockToggles])

async function fetchConfig() {
  loading.value = true
  try {
    const res = await api.get('/admin/system-config')
    const configs = res.data.data?.configs || res.data.configs || []
    if (configs.length) {
      configs.forEach(c => {
        if (c.key in config) {
          if (c.type === 'number') config[c.key] = Number(c.value)
          else config[c.key] = c.value
        }
        // Map toggle configs
        const toggle = toggles.find(t => t.key === c.key)
        if (toggle) toggle.enabled = c.value === 'true' || c.value === true
      })
    }
  } catch(e) {
    console.warn('System config fetch failed, using defaults')
  } finally {
    loading.value = false
  }
}

async function saveConfig() {
  saving.value = true
  try {
    const configs = Object.entries(config).map(([key, value]) => ({ key, value: String(value) }))
    // Also save toggles
    toggles.forEach(t => {
      if (!configs.find(c => c.key === t.key)) {
        configs.push({ key: t.key, value: String(t.enabled) })
      }
    })
    await api.put('/admin/system-config', { configs })
    ElMessage.success('配置已保存')
  } catch(e) {
    ElMessage.error('保存失败')
  } finally {
    saving.value = false
  }
}

function resetConfig() {
  Object.assign(config, defaultConfig)
  ElMessage.info('已重置为默认配置')
}

function toggleChange(item) {
  ElMessage.success(`${item.name} 已${item.enabled ? '开启' : '关闭'}`)
}

onMounted(() => fetchConfig())
</script>

<style scoped>
.admin-system-config h2 { margin: 0 0 16px; font-size: 20px; }
.section-card { border-radius: 12px; border: 1px solid #f0f0f0; }
.section-card:hover { border-color: #409eff; box-shadow: 0 2px 12px rgba(64,158,255,.1); }
.config-form { max-width: 520px; }
.toggle-list { }
.toggle-item { display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #f5f5f5; }
.toggle-item:last-child { border-bottom: none; }
.toggle-info { display: flex; flex-direction: column; }
.toggle-name { font-size: 14px; font-weight: 500; color: #303133; }
.toggle-desc { font-size: 12px; color: #606266; margin-top: 2px; }
</style>
