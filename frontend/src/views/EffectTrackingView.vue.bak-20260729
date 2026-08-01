<template>
  <div class="effect-page">
    <!-- 顶部总体统计卡片 -->
    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-icon">📨</div>
        <div class="stat-num">{{ stats.totalTracked || 0 }}</div>
        <div class="stat-label">总消息数</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">⏱️</div>
        <div class="stat-num">{{ formatTime(stats.avgResponseTime) }}</div>
        <div class="stat-label">平均响应时间</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">💬</div>
        <div class="stat-num">{{ formatPercent(stats.avgReplyRate) }}</div>
        <div class="stat-label">平均回复率</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">⭐</div>
        <div class="stat-num">{{ formatScore(stats.avgEffectivenessScore) }}</div>
        <div class="stat-label">效果评分</div>
      </div>
    </div>

    <!-- 客户维度查询 -->
    <div class="customer-section">
      <div class="section-title">🔍 客户效果查询</div>
      <div class="query-row">
        <input
          class="query-input"
          v-model="customerJid"
          placeholder="输入客户电话或JID（如 8613800138000 或 8613800138000@c.us）"
          @keyup.enter="loadCustomerEffect"
        />
        <el-button type="primary" @click="loadCustomerEffect" :loading="customerLoading">查询</el-button>
      </div>

      <!-- 客户详情卡片 -->
      <div v-if="customerData" class="customer-card">
        <div class="cc-header">
          <span class="cc-jid">{{ customerData.contactJid }}</span>
        </div>
        <div class="cc-stats">
          <div class="cc-stat-item">
            <div class="cc-num">{{ customerData.totalMessages || 0 }}</div>
            <div class="cc-label">总消息</div>
          </div>
          <div class="cc-stat-item">
            <div class="cc-num">{{ customerData.messagesWithReply || 0 }}</div>
            <div class="cc-label">已回复</div>
          </div>
          <div class="cc-stat-item">
            <div class="cc-num highlight-green">{{ formatPercent(customerData.replyRate) }}</div>
            <div class="cc-label">回复率</div>
          </div>
          <div class="cc-stat-item">
            <div class="cc-num">{{ formatTime(customerData.avgResponseTimeMs) }}</div>
            <div class="cc-label">平均响应</div>
          </div>
          <div class="cc-stat-item">
            <div class="cc-num highlight-orange">{{ formatScore(customerData.avgEffectivenessScore) }}</div>
            <div class="cc-label">效果评分</div>
          </div>
        </div>
        <div class="cc-actions">
          <el-button type="primary" link @click="goToCustomer(customerData.contactJid)">
            查看客户详情 →
          </el-button>
        </div>
      </div>
      <div v-else-if="customerQueried && !customerLoading" class="empty-state">
        <svg viewBox="0 0 24 24" width="48" height="48" fill="currentColor" style="color:var(--mgmt-text-muted)">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
        </svg>
        <p>未找到该客户的效果数据</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import api from '../utils/api.js';

const router = useRouter();

// 总体统计
const stats = ref({});
const statsLoading = ref(false);

// 客户维度查询
const customerJid = ref('');
const customerData = ref(null);
const customerLoading = ref(false);
const customerQueried = ref(false);

// 加载总体统计
async function loadOverallStats() {
  statsLoading.value = true;
  try {
    const { data } = await api.get('/effectiveness/overall');
    stats.value = data;
  } catch (e) {
    console.error('加载总体统计失败', e);
    ElMessage.error('加载统计数据失败');
  } finally {
    statsLoading.value = false;
  }
}

// 加载客户效果
async function loadCustomerEffect() {
  if (!customerJid.value.trim()) {
    ElMessage.warning('请输入客户JID');
    return;
  }
  customerLoading.value = true;
  customerQueried.value = true;
  customerData.value = null;
  try {
    const { data } = await api.get(`/effectiveness/customer/${encodeURIComponent(customerJid.value.trim())}`);
    customerData.value = data;
  } catch (e) {
    console.error('加载客户效果失败', e);
    if (e.response?.status === 404) {
      customerData.value = null;
    } else {
      ElMessage.error('查询失败');
    }
  } finally {
    customerLoading.value = false;
  }
}

// 跳转客户详情
function goToCustomer(jid) {
  if (jid) {
    router.push(`/customers/${encodeURIComponent(jid)}`);
  }
}

// 格式化方法
function formatTime(ms) {
  if (ms == null || isNaN(ms)) return '--';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}min`;
}

function formatPercent(v) {
  if (v == null || isNaN(v)) return '--';
  return `${(v * 100).toFixed(1)}%`;
}

function formatScore(v) {
  if (v == null || isNaN(v)) return '--';
  return Number(v).toFixed(2);
}

onMounted(() => {
  loadOverallStats();
});
</script>

<style scoped>
.effect-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--mgmt-bg);
  color: var(--mgmt-text);
  overflow-y: auto;
  padding: 16px;
  box-sizing: border-box;
}

/* 总体统计卡片 */
.stats-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 20px;
  flex-shrink: 0;
}
.stat-card {
  background: var(--mgmt-card-bg);
  border: 1px solid var(--mgmt-divider);
  border-radius: 12px;
  padding: 16px 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  transition: border-color .15s;
}
.stat-card:hover { border-color: var(--accent); }
.stat-icon { font-size: 24px; margin-bottom: 8px; }
.stat-num {
  font-size: 22px;
  font-weight: 700;
  color: var(--mgmt-text);
  line-height: 1.2;
  margin-bottom: 4px;
}
.stat-label {
  font-size: 12px;
  color: var(--mgmt-text-muted);
}

/* 客户查询区 */
.customer-section {
  background: var(--mgmt-card-bg);
  border: 1px solid var(--mgmt-divider);
  border-radius: 12px;
  padding: 16px;
}
.section-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 12px;
  color: var(--mgmt-text);
}
.query-row {
  display: flex;
  gap: 10px;
  margin-bottom: 16px;
}
.query-input {
  flex: 1;
  background: var(--mgmt-bg);
  border: 1px solid var(--mgmt-input-border);
  border-radius: 6px;
  padding: 9px 12px;
  color: var(--mgmt-text);
  font-size: 14px;
  outline: none;
  transition: border-color .2s;
}
.query-input:focus { border-color: var(--accent); }
.query-input::placeholder { color: var(--mgmt-text-muted); }

/* 客户详情卡片 */
.customer-card {
  background: var(--mgmt-bg);
  border: 1px solid var(--mgmt-divider);
  border-radius: 8px;
  padding: 16px;
}
.cc-header { margin-bottom: 12px; }
.cc-jid {
  font-size: 14px;
  font-weight: 600;
  color: var(--mgmt-text);
  word-break: break-all;
}
.cc-stats {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
  margin-bottom: 12px;
}
.cc-stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}
.cc-num {
  font-size: 18px;
  font-weight: 700;
  color: var(--mgmt-text);
  line-height: 1.2;
  margin-bottom: 4px;
}
.cc-label { font-size: 12px; color: var(--mgmt-text-muted); }
.highlight-green { color: var(--mgmt-tag-green); }
.highlight-orange { color: var(--mgmt-tag-orange); }
.cc-actions {
  padding-top: 12px;
  border-top: 1px solid var(--mgmt-divider);
  text-align: right;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 16px;
  color: var(--mgmt-text-muted);
}
.empty-state p { margin-top: 12px; font-size: 14px; }

/* Element Plus 对话框样式适配 */
:deep(.el-button--primary) {
  background: var(--accent);
  border-color: var(--accent);
}
:deep(.el-button--primary:hover) {
  background: var(--accent-hover);
  border-color: var(--accent-hover);
}

/* 响应式 */
@media (max-width: 768px) {
  .effect-page { padding: 8px; }
  .stats-row { grid-template-columns: repeat(2, 1fr); gap: 8px; }
  .stat-card { padding: 12px 8px; }
  .stat-num { font-size: 18px; }
  .cc-stats { grid-template-columns: repeat(3, 1fr); }
  .query-row { flex-direction: column; }
  .customer-section { padding: 12px; }
}
</style>
