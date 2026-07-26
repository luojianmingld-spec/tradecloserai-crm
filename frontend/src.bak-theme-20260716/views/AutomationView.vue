<template>
  <div class="automation-view">
    <!-- Header -->
    <div class="page-header">
      <div class="header-title">
        <h1>营销自动化</h1>
        <p>AI自动生成问候、行业动态、案例推荐，销售确认后发送</p>
      </div>
      <div class="header-right">
        <div class="stat-badges">
          <span v-if="stats.pending > 0" class="stat-badge badge-amber">
            <svg viewBox="0 0 20 20" fill="currentColor" class="badge-icon"><path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z"/></svg>
            {{ stats.pending }} 待发送
          </span>
          <span class="stat-badge badge-green">
            <svg viewBox="0 0 20 20" fill="currentColor" class="badge-icon"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>
            {{ stats.sent }} 已发送
          </span>
        </div>
        <button class="icon-btn" @click="refreshAll" title="刷新">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
        </button>
      </div>
    </div>

    <!-- Tabs -->
    <div class="tabs-bar">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        @click="activeTab = tab.id"
        :class="['tab-btn', activeTab === tab.id ? 'tab-active' : '']"
      >
        {{ tab.name }}
        <span v-if="tab.id === 'queue' && stats.pending" class="tab-badge">{{ stats.pending }}</span>
      </button>
    </div>

    <!-- Content -->
    <div class="page-body">
      <!-- Tab 1: 规则配置 -->
      <div v-if="activeTab === 'rules'" class="content-wrap">
        <div v-for="rule in rules" :key="rule.id" class="card rule-card">
          <div class="rule-row">
            <div class="rule-icon" :style="{background: ruleIconBg(rule.type)}">
              {{ ruleIcon(rule.type) }}
            </div>
            <div class="rule-info">
              <div class="rule-head">
                <h3>{{ ruleName(rule.type) }}</h3>
                <div class="rule-actions">
                  <button v-if="rule.enabled" @click="triggerRule(rule)" class="link-btn">立即生成</button>
                  <label class="switch">
                    <input type="checkbox" :checked="rule.enabled" @change="toggleRule(rule)">
                    <span class="switch-slider"></span>
                  </label>
                </div>
              </div>
              <p class="rule-desc">{{ ruleDesc(rule.type) }}</p>
              <div class="rule-meta" v-if="rule.enabled">
                <span class="meta-item"><span class="meta-label">语言：</span>{{ rule.languageMode === 'auto' ? '自动（按客户国家）' : rule.defaultLang }}</span>
                <span class="meta-item"><span class="meta-label">上次运行：</span>{{ rule.lastRunAt ? formatTime(rule.lastRunAt) : '从未运行' }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="tip-card">
          <svg viewBox="0 0 20 20" fill="currentColor" class="tip-icon"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/></svg>
          <div>
            <p class="tip-title">使用说明</p>
            <ul>
              <li>开启开关后，系统会在设定时间自动为勾选客户生成消息</li>
              <li>周末问候：按客户国家习惯（中东周四、其他周五）生成当地语言问候</li>
              <li>生成内容先进「待发送」队列，需销售确认后才实际发送</li>
              <li>发送频率：周末问候/行业动态每周1次，案例每月1次</li>
            </ul>
          </div>
        </div>
      </div>

      <!-- Tab 2: 客户选择 -->
      <div v-if="activeTab === 'customers'" class="content-wrap">
        <div class="toolbar">
          <input
            v-model="customerSearch"
            type="text"
            placeholder="搜索客户姓名/电话/公司..."
            class="input search-input"
          >
          <select v-model="filterType" class="input filter-select">
            <option value="all">全部类型</option>
            <option value="weekend_greeting">周末问候</option>
            <option value="industry_news">行业动态</option>
            <option value="case_study">案例发送</option>
          </select>
          <button @click="selectAllVisible" class="link-btn">全选当前</button>
        </div>

        <div v-if="selectedCustomers.size > 0" class="bulk-bar">
          <span class="bulk-label">已选 {{ selectedCustomers.size }} 个客户</span>
          <div class="bulk-types">
            <label><input type="checkbox" :checked="bulkTypes.includes('weekend_greeting')" @change="toggleBulkType('weekend_greeting')"> 周末问候</label>
            <label><input type="checkbox" :checked="bulkTypes.includes('industry_news')" @change="toggleBulkType('industry_news')"> 行业动态</label>
            <label><input type="checkbox" :checked="bulkTypes.includes('case_study')" @change="toggleBulkType('case_study')"> 案例发送</label>
          </div>
          <button @click="applyBulk" class="primary-btn btn-small">应用</button>
        </div>

        <div class="card table-wrap">
          <div v-if="loadingCustomers" class="state-tip">加载中...</div>
          <table v-else class="data-table">
            <thead>
              <tr>
                <th class="col-check"><input type="checkbox" @change="toggleAllVisible" :checked="allVisibleSelected"></th>
                <th>客户</th>
                <th>国家</th>
                <th class="col-center">周末问候</th>
                <th class="col-center">行业动态</th>
                <th class="col-center">案例发送</th>
                <th>语言</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="c in filteredCustomers" :key="c.id">
                <td class="col-check"><input type="checkbox" :checked="selectedCustomers.has(c.id)" @change="toggleCustomer(c.id)"></td>
                <td>
                  <div class="cust-name">{{ c.name }}</div>
                  <div class="cust-sub">{{ c.company }} · {{ c.phone }}</div>
                </td>
                <td><span class="txt-mute">{{ c.country || '—' }}</span></td>
                <td class="col-center"><button @click="toggleCustomerType(c, 'weekend_greeting')" :class="['chk-btn', isTypeEnabled(c, 'weekend_greeting') ? 'chk-green' : '']"><svg v-if="isTypeEnabled(c, 'weekend_greeting')" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg></button></td>
                <td class="col-center"><button @click="toggleCustomerType(c, 'industry_news')" :class="['chk-btn', isTypeEnabled(c, 'industry_news') ? 'chk-blue' : '']"><svg v-if="isTypeEnabled(c, 'industry_news')" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg></button></td>
                <td class="col-center"><button @click="toggleCustomerType(c, 'case_study')" :class="['chk-btn', isTypeEnabled(c, 'case_study') ? 'chk-purple' : '']"><svg v-if="isTypeEnabled(c, 'case_study')" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg></button></td>
                <td><span class="lang-tag">{{ langName(c) }}</span></td>
              </tr>
              <tr v-if="filteredCustomers.length === 0">
                <td colspan="7" class="state-tip">暂无客户</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Tab 3: 待发送队列 -->
      <div v-if="activeTab === 'queue'" class="content-wrap">
        <div class="sub-tabs">
          <button
            v-for="s in queueStatuses"
            :key="s.id"
            @click="queueStatus = s.id; loadQueue()"
            :class="['sub-tab-btn', queueStatus === s.id ? 'sub-tab-active' : '']"
          >{{ s.name }} <span class="sub-count">{{ queueCount(s.id) }}</span></button>
        </div>

        <div v-if="loadingQueue" class="state-tip">加载中...</div>
        <div v-else-if="filteredQueue.length === 0" class="card empty-card">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="empty-icon"><path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
          <p>暂无{{ queueStatusName() }}消息</p>
          <p v-if="queueStatus === 'pending'" class="empty-sub">开启自动化规则后，AI生成的消息会出现在这里</p>
        </div>

        <template v-else>
          <div v-if="queueStatus === 'pending' && selectedQueue.size > 0" class="bulk-bar">
            <span class="bulk-label">已选 {{ selectedQueue.size }} 条</span>
            <button @click="batchSend" class="primary-btn btn-green btn-small">批量发送</button>
            <button @click="batchSkip" class="secondary-btn btn-small">批量跳过</button>
            <button @click="selectedQueue.clear()" class="link-btn">取消</button>
          </div>

          <div class="queue-list">
            <div v-for="item in filteredQueue" :key="item.id" class="card queue-card">
              <div class="q-head">
                <input v-if="queueStatus === 'pending'" type="checkbox" :checked="selectedQueue.has(item.id)" @change="toggleQueueItem(item.id)" class="q-check">
                <span :class="['type-badge', 'badge-'+typeColor(item.type)]">{{ typeName(item.type) }}</span>
                <span class="q-name">{{ item.customer?.name }}</span>
                <span class="q-sub txt-mute">{{ item.customer?.company }} · {{ item.language }}</span>
                <span :class="['status-badge', 'badge-'+statusColor(item.status), 'ml-auto']">{{ statusName(item.status) }}</span>
              </div>

              <template v-if="queueStatus === 'pending' || item.status === 'edited'">
                <textarea
                  v-if="editingId === item.id"
                  v-model="editContent"
                  class="textarea"
                  rows="4"
                ></textarea>
                <div v-else class="msg-box">{{ item.editedContent || item.content }}</div>

                <div v-if="item.errorMsg" class="err-box">错误: {{ item.errorMsg }}</div>

                <div class="q-actions">
                  <template v-if="editingId === item.id">
                    <button @click="saveEdit(item)" class="primary-btn btn-small">保存</button>
                    <button @click="editingId = null" class="secondary-btn btn-small">取消</button>
                  </template>
                  <template v-else>
                    <button @click="sendItem(item)" class="primary-btn btn-green btn-small">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="btn-ico"><path d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>
                      发送
                    </button>
                    <button @click="startEdit(item)" class="secondary-btn btn-small">编辑</button>
                    <button @click="skipItem(item)" class="ghost-btn btn-small">跳过</button>
                  </template>
                </div>
              </template>

              <template v-else>
                <div class="msg-box">{{ item.editedContent || item.content }}</div>
                <div class="meta-line">
                  <span v-if="item.sentAt">发送: {{ formatTime(item.sentAt) }}</span>
                  <span v-if="item.waMessageId" class="txt-mute">MsgID: {{ item.waMessageId.substring(0, 16) }}...</span>
                  <span v-if="item.errorMsg" class="err-text">{{ item.errorMsg }}</span>
                </div>
              </template>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import apiClient from '../utils/api.js';

const tabs = [
  { id: 'rules', name: '自动化规则' },
  { id: 'customers', name: '客户选择' },
  { id: 'queue', name: '待发送队列' },
];

const activeTab = ref('rules');
const rules = ref([]);
const customers = ref([]);
const queue = ref([]);
const stats = ref({ pending: 0, sent: 0, skipped: 0, failed: 0, enabledRules: 0, autoCustomerCount: 0 });

const loadingCustomers = ref(false);
const loadingQueue = ref(false);
const customerSearch = ref('');
const filterType = ref('all');
const selectedCustomers = ref(new Set());
const bulkTypes = ref([]);

const queueStatuses = [
  { id: 'pending', name: '待发送' },
  { id: 'sent', name: '已发送' },
  { id: 'skipped', name: '已跳过' },
  { id: 'failed', name: '发送失败' },
];
const queueStatus = ref('pending');
const selectedQueue = ref(new Set());
const editingId = ref(null);
const editContent = ref('');

const allVisibleSelected = computed(() => {
  const list = filteredCustomers.value;
  return list.length > 0 && list.every(c => selectedCustomers.value.has(c.id));
});

async function api(path, options = {}) {
  const method = (options.method || 'GET').toLowerCase();
  const config = { method, url: path };
  if (options.body) config.data = JSON.parse(options.body);
  const res = await apiClient(config);
  return res.data;
}

async function loadRules() { rules.value = await api('/automation/rules'); }
async function loadStats() { stats.value = await api('/automation/stats'); }
async function loadCustomers() {
  loadingCustomers.value = true;
  try { customers.value = await api('/automation/customers'); }
  finally { loadingCustomers.value = false; }
}
async function loadQueue() {
  loadingQueue.value = true;
  try { queue.value = await api(`/automation/queue?status=${queueStatus.value}`); }
  finally { loadingQueue.value = false; }
}

async function initRules() { await api('/automation/rules/init', { method: 'POST' }); await loadRules(); }

async function toggleRule(rule) {
  await api(`/automation/rules/${rule.id}`, { method: 'PUT', body: JSON.stringify({ enabled: !rule.enabled }) });
  await loadRules(); await loadStats();
}

async function triggerRule(rule) {
  if (!confirm(`确定立即为所有勾选"${ruleName(rule.type)}"的客户生成内容吗？`)) return;
  try {
    const r = await api(`/automation/rules/${rule.id}/trigger`, { method: 'POST' });
    alert(`已生成 ${r.generated} 条消息，请到"待发送队列"查看`);
    activeTab.value = 'queue'; await loadQueue(); await loadStats();
  } catch (e) { alert('生成失败: ' + (e.message || e)); }
}

const filteredCustomers = computed(() => {
  let list = customers.value;
  if (customerSearch.value) {
    const q = customerSearch.value.toLowerCase();
    list = list.filter(c => (c.name || '').toLowerCase().includes(q) || (c.phone || '').includes(q) || (c.company || '').toLowerCase().includes(q));
  }
  if (filterType.value !== 'all') list = list.filter(c => isTypeEnabled(c, filterType.value));
  return list;
});

function isTypeEnabled(c, type) { return c.automation?.enabled && (c.automation.types || []).includes(type); }
function langName(c) { return c.automation?.customLang || '自动'; }

function toggleCustomer(id) {
  if (selectedCustomers.value.has(id)) selectedCustomers.value.delete(id);
  else selectedCustomers.value.add(id);
  selectedCustomers.value = new Set(selectedCustomers.value);
}
function toggleAllVisible(e) {
  if (e.target.checked) filteredCustomers.value.forEach(c => selectedCustomers.value.add(c.id));
  else filteredCustomers.value.forEach(c => selectedCustomers.value.delete(c.id));
  selectedCustomers.value = new Set(selectedCustomers.value);
}
function selectAllVisible() {
  filteredCustomers.value.forEach(c => selectedCustomers.value.add(c.id));
  selectedCustomers.value = new Set(selectedCustomers.value);
}
function toggleBulkType(type) {
  if (bulkTypes.value.includes(type)) bulkTypes.value = bulkTypes.value.filter(t => t !== type);
  else bulkTypes.value.push(type);
}
async function applyBulk() {
  const ids = Array.from(selectedCustomers.value);
  if (ids.length === 0) return;
  await api('/automation/customers/bulk', { method: 'POST', body: JSON.stringify({ customerIds: ids, types: bulkTypes.value, enabled: bulkTypes.value.length > 0 }) });
  selectedCustomers.value.clear(); bulkTypes.value = [];
  await loadCustomers(); await loadStats();
}
async function toggleCustomerType(c, type) {
  const current = new Set(c.automation?.types || []);
  const enabled = c.automation?.enabled;
  if (enabled && current.has(type)) current.delete(type); else current.add(type);
  const types = Array.from(current);
  await api(`/automation/customers/${c.id}`, { method: 'PUT', body: JSON.stringify({ enabled: types.length > 0, types }) });
  await loadCustomers(); await loadStats();
}

const filteredQueue = computed(() => queue.value);
function queueCount(s) {
  if (s === 'pending') return stats.value.pending;
  if (s === 'sent') return stats.value.sent;
  if (s === 'skipped') return stats.value.skipped;
  if (s === 'failed') return stats.value.failed;
  return 0;
}
function queueStatusName() { return queueStatuses.find(s => s.id === queueStatus.value)?.name || ''; }
function toggleQueueItem(id) {
  if (selectedQueue.value.has(id)) selectedQueue.value.delete(id); else selectedQueue.value.add(id);
  selectedQueue.value = new Set(selectedQueue.value);
}
function startEdit(item) { editingId.value = item.id; editContent.value = item.editedContent || item.content; }
async function saveEdit(item) {
  await api(`/automation/queue/${item.id}`, { method: 'PUT', body: JSON.stringify({ content: editContent.value }) });
  editingId.value = null; await loadQueue();
}
async function sendItem(item) {
  try { await api(`/automation/queue/${item.id}/send`, { method: 'POST' }); await loadQueue(); await loadStats(); }
  catch (e) { alert('发送失败: ' + (e.message || e)); await loadQueue(); }
}
async function skipItem(item) { await api(`/automation/queue/${item.id}/skip`, { method: 'POST' }); await loadQueue(); await loadStats(); }
async function batchSend() {
  if (!confirm(`确定发送 ${selectedQueue.value.size} 条消息？`)) return;
  await api('/automation/queue/bulk-send', { method: 'POST', body: JSON.stringify({ ids: Array.from(selectedQueue.value) }) });
  selectedQueue.value.clear(); await loadQueue(); await loadStats();
}
async function batchSkip() {
  await api('/automation/queue/bulk-skip', { method: 'POST', body: JSON.stringify({ ids: Array.from(selectedQueue.value) }) });
  selectedQueue.value.clear(); await loadQueue(); await loadStats();
}
function refreshAll() { loadRules(); loadStats(); loadCustomers(); loadQueue(); }

function ruleName(type) { return { weekend_greeting: '周末问候', industry_news: '行业动态', case_study: '案例发送' }[type] || type; }
function ruleDesc(type) {
  return {
    weekend_greeting: '按客户国家周末习俗，生成当地语言问候语',
    industry_news: '每周推送行业动态和洞察，保持客户互动',
    case_study: '每月推送一个应用案例，展示产品实力',
  }[type] || '';
}
function ruleIcon(type) { return { weekend_greeting: '🎉', industry_news: '📰', case_study: '🏭' }[type] || '📋'; }
function ruleIconBg(type) {
  return { weekend_greeting: '#fef3c7', industry_news: '#dbeafe', case_study: '#f3e8ff' }[type] || '#f3f4f6';
}
function typeName(type) { return ruleName(type); }
function typeColor(type) { return { weekend_greeting: 'amber', industry_news: 'blue', case_study: 'purple' }[type] || 'gray'; }
function statusName(s) { return { pending: '待发送', sent: '已发送', edited: '已编辑', skipped: '已跳过', failed: '发送失败' }[s] || s; }
function statusColor(s) { return { pending: 'amber', sent: 'green', edited: 'blue', skipped: 'gray', failed: 'red' }[s] || 'gray'; }
function formatTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

onMounted(async () => { await initRules(); await loadStats(); await loadCustomers(); await loadQueue(); });
</script>

<style scoped>
.automation-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #f5f7fa;
  color: #1f2937;
  font-size: 14px;
  overflow: hidden;
  min-width: 0;
}

/* ===== Header ===== */
.page-header {
  background: #fff;
  border-bottom: 1px solid #e5e7eb;
  padding: 16px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-shrink: 0;
}
.header-title h1 { font-size: 18px; font-weight: 600; margin: 0; color: #111827; }
.header-title p { font-size: 13px; color: #6b7280; margin: 4px 0 0; }
.header-right { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
.stat-badges { display: flex; gap: 8px; }
.stat-badge {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 4px 10px; border-radius: 999px;
  font-size: 12px; font-weight: 500; white-space: nowrap;
}
.badge-amber { background: #fef3c7; color: #b45309; }
.badge-green { background: #d1fae5; color: #047857; }
.badge-blue { background: #dbeafe; color: #1d4ed8; }
.badge-purple { background: #f3e8ff; color: #7e22ce; }
.badge-red { background: #fee2e2; color: #b91c1c; }
.badge-gray { background: #f3f4f6; color: #4b5563; }
.badge-icon { width: 14px; height: 14px; flex-shrink: 0; }
.icon-btn {
  width: 36px; height: 36px; border-radius: 8px; border: none;
  background: transparent; color: #6b7280; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: background .15s;
}
.icon-btn:hover { background: #f3f4f6; color: #111827; }
.icon-btn svg { width: 18px; height: 18px; }

/* ===== Tabs ===== */
.tabs-bar {
  background: #fff; border-bottom: 1px solid #e5e7eb;
  padding: 0 24px; display: flex; gap: 4px;
  overflow-x: auto; flex-shrink: 0;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}
.tabs-bar::-webkit-scrollbar { display: none; }
.tab-btn {
  padding: 12px 16px; font-size: 14px; font-weight: 500;
  border: none; background: transparent; color: #6b7280;
  cursor: pointer; border-bottom: 2px solid transparent;
  white-space: nowrap; display: inline-flex; align-items: center;
  transition: color .15s, border-color .15s;
}
.tab-btn:hover { color: #374151; }
.tab-active { color: #2563eb; border-bottom-color: #2563eb; }
.tab-badge {
  margin-left: 6px; padding: 1px 7px; font-size: 11px;
  background: #ef4444; color: #fff; border-radius: 999px;
  min-width: 18px; text-align: center; line-height: 1.4;
}

/* ===== Body ===== */
.page-body {
  flex: 1; overflow-y: auto; padding: 20px 24px;
  -webkit-overflow-scrolling: touch; min-width: 0;
}
.content-wrap { max-width: 1100px; margin: 0 auto; }

/* ===== Card ===== */
.card {
  background: #fff; border: 1px solid #e5e7eb;
  border-radius: 12px; padding: 18px; margin-bottom: 12px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.03);
}

/* ===== Rules ===== */
.rule-card { padding: 16px 20px; }
.rule-row { display: flex; gap: 14px; align-items: flex-start; }
.rule-icon {
  width: 46px; height: 46px; border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  font-size: 22px; flex-shrink: 0;
}
.rule-info { flex: 1; min-width: 0; }
.rule-head {
  display: flex; align-items: center; justify-content: space-between;
  gap: 10px; flex-wrap: wrap;
}
.rule-head h3 { margin: 0; font-size: 15px; font-weight: 600; color: #111827; }
.rule-actions { display: flex; align-items: center; gap: 8px; }
.rule-desc { margin: 4px 0 0; font-size: 13px; color: #6b7280; }
.rule-meta {
  margin-top: 10px; padding-top: 10px; border-top: 1px dashed #e5e7eb;
  display: flex; gap: 20px; flex-wrap: wrap; font-size: 13px; color: #374151;
}
.meta-label { color: #9ca3af; }

/* Switch */
.switch { position: relative; display: inline-block; width: 42px; height: 24px; flex-shrink: 0; }
.switch input { opacity: 0; width: 0; height: 0; }
.switch-slider {
  position: absolute; inset: 0; background: #d1d5db;
  border-radius: 24px; cursor: pointer; transition: .2s;
}
.switch-slider::before {
  content: ''; position: absolute; width: 18px; height: 18px;
  left: 3px; top: 3px; background: #fff; border-radius: 50%;
  transition: .2s; box-shadow: 0 1px 3px rgba(0,0,0,0.2);
}
.switch input:checked + .switch-slider { background: #3b82f6; }
.switch input:checked + .switch-slider::before { transform: translateX(18px); }

.link-btn {
  padding: 6px 10px; font-size: 13px; color: #2563eb;
  background: transparent; border: none; border-radius: 6px;
  cursor: pointer; white-space: nowrap;
}
.link-btn:hover { background: #eff6ff; }

/* Tip */
.tip-card {
  background: #eff6ff; border: 1px solid #bfdbfe;
  border-radius: 12px; padding: 14px 16px; margin-top: 4px;
  display: flex; gap: 10px; font-size: 13px; color: #1e40af;
}
.tip-icon { width: 20px; height: 20px; flex-shrink: 0; color: #3b82f6; margin-top: 1px; }
.tip-title { font-weight: 600; margin: 0 0 4px; }
.tip-card ul { margin: 0; padding-left: 18px; }
.tip-card li { margin: 2px 0; line-height: 1.6; }

/* ===== Toolbar ===== */
.toolbar {
  display: flex; gap: 8px; margin-bottom: 12px; align-items: center;
  flex-wrap: wrap;
}
.input {
  padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 8px;
  font-size: 14px; outline: none; background: #fff; color: #1f2937;
  transition: border-color .15s, box-shadow .15s;
}
.input:focus { border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }
.search-input { flex: 1; min-width: 160px; }
.filter-select { cursor: pointer; }

.bulk-bar {
  background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px;
  padding: 10px 14px; margin-bottom: 12px;
  display: flex; align-items: center; gap: 14px;
  font-size: 13px; color: #1e40af; flex-wrap: wrap;
}
.bulk-label { font-weight: 500; white-space: nowrap; }
.bulk-types { display: flex; gap: 12px; flex-wrap: wrap; }
.bulk-types label { display: flex; align-items: center; gap: 4px; cursor: pointer; white-space: nowrap; }

.primary-btn, .secondary-btn, .ghost-btn {
  padding: 7px 14px; border-radius: 7px; font-size: 13px;
  cursor: pointer; font-weight: 500; display: inline-flex;
  align-items: center; gap: 4px; border: 1px solid transparent;
  transition: all .15s; white-space: nowrap;
}
.primary-btn { background: #3b82f6; color: #fff; }
.primary-btn:hover { background: #2563eb; }
.primary-btn.btn-green { background: #10b981; }
.primary-btn.btn-green:hover { background: #059669; }
.secondary-btn { background: #fff; color: #374151; border-color: #d1d5db; }
.secondary-btn:hover { background: #f9fafb; }
.ghost-btn { background: transparent; color: #6b7280; }
.ghost-btn:hover { background: #f3f4f6; }
.btn-small { padding: 6px 12px; font-size: 12px; }
.btn-ico { width: 13px; height: 13px; }
.ml-auto { margin-left: auto; }

/* ===== Table (shared desktop & mobile via horizontal scroll) ===== */
.table-wrap { padding: 0; overflow: hidden; }
.data-table { width: 100%; border-collapse: collapse; min-width: 640px; }
.data-table thead { background: #f9fafb; }
.data-table th {
  padding: 10px 14px; text-align: left; font-size: 12px;
  font-weight: 600; color: #6b7280; text-transform: uppercase;
  letter-spacing: 0.03em; border-bottom: 1px solid #e5e7eb;
  white-space: nowrap;
}
.data-table td {
  padding: 12px 14px; border-bottom: 1px solid #f3f4f6;
  font-size: 14px; vertical-align: middle;
}
.data-table tbody tr:hover { background: #fafbfc; }
.data-table tbody tr:last-child td { border-bottom: none; }
.col-check { width: 42px; text-align: center; }
.col-center { text-align: center; }
.cust-name { font-weight: 500; color: #111827; white-space: nowrap; }
.cust-sub { font-size: 12px; color: #6b7280; margin-top: 2px; white-space: nowrap; }
.txt-mute { color: #6b7280; font-size: 13px; }
.lang-tag { font-size: 12px; color: #6b7280; background: #f3f4f6; padding: 2px 8px; border-radius: 4px; }
.chk-btn {
  width: 22px; height: 22px; border-radius: 5px;
  border: 2px solid #d1d5db; background: #fff; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
  padding: 0; transition: all .15s;
}
.chk-btn svg { width: 14px; height: 14px; color: #fff; }
.chk-green { background: #10b981 !important; border-color: #10b981 !important; }
.chk-blue { background: #3b82f6 !important; border-color: #3b82f6 !important; }
.chk-purple { background: #a855f7 !important; border-color: #a855f7 !important; }
.state-tip { text-align: center; padding: 40px 20px; color: #9ca3af; font-size: 14px; }

/* Wrapper enabling horizontal scroll on small screens */
.table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }

/* ===== Queue ===== */
.sub-tabs { display: flex; gap: 6px; margin-bottom: 12px; flex-wrap: wrap; }
.sub-tab-btn {
  padding: 7px 12px; border-radius: 8px; border: 1px solid #e5e7eb;
  background: #fff; color: #4b5563; font-size: 13px; cursor: pointer;
  transition: all .15s;
}
.sub-tab-btn:hover { background: #f9fafb; }
.sub-tab-active { background: #1f2937 !important; color: #fff !important; border-color: #1f2937 !important; }
.sub-count { font-size: 11px; opacity: 0.7; margin-left: 3px; }

.empty-card { text-align: center; padding: 50px 20px; color: #9ca3af; }
.empty-icon { width: 56px; height: 56px; margin: 0 auto 12px; color: #e5e7eb; }
.empty-card p { margin: 4px 0; font-size: 14px; }
.empty-sub { font-size: 13px !important; color: #9ca3af; }

.queue-list { display: flex; flex-direction: column; gap: 10px; }
.queue-card { padding: 14px 16px; }
.q-head {
  display: flex; align-items: center; gap: 8px;
  margin-bottom: 10px; font-size: 13px; flex-wrap: wrap;
}
.q-check { width: 16px; height: 16px; flex-shrink: 0; }
.type-badge, .status-badge {
  padding: 2px 8px; border-radius: 999px; font-size: 11px;
  font-weight: 500; white-space: nowrap;
}
.q-name { font-weight: 600; color: #111827; white-space: nowrap; }
.q-sub { font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px; }
.msg-box {
  background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px;
  padding: 10px 12px; font-size: 14px; color: #374151;
  white-space: pre-wrap; line-height: 1.6; word-break: break-word;
}
.textarea {
  width: 100%; padding: 10px 12px; border: 1px solid #d1d5db;
  border-radius: 8px; font-size: 14px; resize: vertical;
  font-family: inherit; outline: none; line-height: 1.6;
  box-sizing: border-box;
}
.textarea:focus { border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }
.err-box {
  margin-top: 8px; padding: 6px 10px; background: #fef2f2;
  color: #b91c1c; font-size: 12px; border-radius: 6px;
}
.q-actions { margin-top: 10px; display: flex; gap: 8px; flex-wrap: wrap; }
.meta-line {
  margin-top: 8px; display: flex; gap: 12px;
  font-size: 12px; color: #9ca3af; flex-wrap: wrap;
}
.err-text { color: #ef4444; }

/* ===== Responsive: tablet & mobile ===== */
@media (max-width: 900px) {
  .page-header { padding: 12px 16px; }
  .tabs-bar { padding: 0 16px; }
  .page-body { padding: 14px 16px; }
}

@media (max-width: 640px) {
  .page-header { padding: 10px 12px; flex-wrap: wrap; }
  .header-title h1 { font-size: 16px; }
  .header-title p { font-size: 12px; margin-top: 2px; }
  .header-right { width: 100%; justify-content: space-between; }
  .stat-badges { gap: 6px; }
  .stat-badge { padding: 3px 8px; font-size: 11px; }
  .icon-btn { width: 32px; height: 32px; }

  .tabs-bar { padding: 0 12px; }
  .tab-btn { padding: 10px 12px; font-size: 13px; }

  .page-body { padding: 10px 12px; }
  .card { padding: 12px; border-radius: 10px; margin-bottom: 10px; }

  .rule-card { padding: 12px 14px; }
  .rule-row { gap: 10px; }
  .rule-icon { width: 40px; height: 40px; font-size: 20px; border-radius: 8px; }
  .rule-head h3 { font-size: 14px; }
  .rule-desc { font-size: 12px; }
  .rule-meta { gap: 8px; font-size: 12px; flex-direction: column; padding-top: 8px; margin-top: 8px; }

  .tip-card { font-size: 12px; padding: 12px; }

  .toolbar { gap: 6px; }
  .bulk-bar { gap: 8px; font-size: 12px; padding: 8px 10px; }
  .bulk-bar .primary-btn { margin-left: auto; }
  .bulk-types { width: 100%; gap: 10px; }

  .data-table th { padding: 8px 10px; font-size: 11px; }
  .data-table td { padding: 10px; font-size: 13px; }
  .chk-btn { width: 20px; height: 20px; }
  .chk-btn svg { width: 12px; height: 12px; }

  .sub-tabs { gap: 4px; margin-bottom: 10px; }
  .sub-tab-btn { padding: 6px 10px; font-size: 12px; }
  .queue-card { padding: 12px; }
  .q-sub { max-width: 120px; }
  .msg-box { font-size: 13px; padding: 10px; }
  .q-actions { gap: 6px; }
  .q-actions button { flex: 1; min-width: 64px; justify-content: center; padding: 8px 10px; }
}

@media (max-width: 380px) {
  .page-header { padding: 8px 10px; }
  .header-title h1 { font-size: 15px; }
  .page-body { padding: 8px 10px; }
}
</style>
