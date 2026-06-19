<template>
  <div class="customers-page">
    <!-- Header -->
    <header class="page-header">
      <div class="header-left">
        <router-link to="/" class="back-link" title="返回聊天">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        </router-link>
        <h1>客户管理</h1>
      </div>
      <div class="header-actions">
        <div class="search-box">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8696a0" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <input v-model="searchQuery" placeholder="搜索客户..." @input="debouncedSearch" />
        </div>
        <select v-model="filterStatus" @change="loadCustomers" class="filter-select">
          <option value="">全部状态</option>
          <option value="potential">潜在客户</option>
          <option value="active">活跃客户</option>
          <option value="vip">VIP客户</option>
          <option value="inactive">不活跃</option>
          <option value="lost">已流失</option>
        </select>
        <button class="btn-primary" @click="showAddDialog = true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
          新增客户
        </button>
      </div>
    </header>

    <!-- Stats Cards -->
    <div class="stats-row">
      <div class="stat-card">
        <span class="stat-value">{{ stats.total }}</span>
        <span class="stat-label">总客户</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">{{ stats.active }}</span>
        <span class="stat-label">活跃</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">{{ stats.vip }}</span>
        <span class="stat-label">VIP</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">{{ stats.potential }}</span>
        <span class="stat-label">潜在</span>
      </div>
    </div>

    <!-- Customer Table (Desktop) -->
    <div class="table-container">
      <table class="customer-table">
        <thead>
          <tr>
            <th>客户名称</th>
            <th>电话</th>
            <th>公司</th>
            <th>国家</th>
            <th>标签</th>
            <th>意向度</th>
            <th>状态</th>
            <th>最后联系</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading">
            <td colspan="9" class="empty-cell">加载中...</td>
          </tr>
          <tr v-else-if="customers.length === 0">
            <td colspan="9" class="empty-cell">暂无客户数据</td>
          </tr>
          <tr v-for="c in customers" :key="c.id" @click="selectCustomer(c)" class="customer-row">
            <td class="name-cell">
              <div class="avatar-sm">{{ (c.name || '?')[0] }}</div>
              {{ c.name }}
            </td>
            <td>{{ c.phone || '-' }}</td>
            <td>{{ c.company || '-' }}</td>
            <td>{{ c.country || '-' }}</td>
            <td>
              <div class="tags-cell">
                <span v-for="tag in parseTags(c.tags)" :key="tag" class="tag-badge">{{ tag }}</span>
                <span v-if="parseTags(c.tags).length === 0" class="text-muted">-</span>
              </div>
            </td>
            <td>
              <div class="intent-bar">
                <div class="intent-fill" :style="{ width: (c.intentLevel || 5) * 10 + '%' }" :class="intentClass(c.intentLevel)"></div>
                <span class="intent-num">{{ c.intentLevel || 5 }}</span>
              </div>
            </td>
            <td>
              <span class="status-badge" :class="'status-' + c.status">{{ statusLabel(c.status) }}</span>
            </td>
            <td class="text-muted">{{ formatDate(c.lastContactAt) }}</td>
            <td class="actions-cell">
              <button class="btn-icon" @click.stop="editCustomer(c)" title="编辑">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button class="btn-icon btn-danger" @click.stop="deleteCustomer(c)" title="删除">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Customer Cards (Mobile) -->
    <div class="cards-container">
      <div v-if="loading" class="empty-cell">加载中...</div>
      <div v-else-if="customers.length === 0" class="empty-cell">暂无客户数据</div>
      <div v-for="c in customers" :key="c.id" class="customer-card" @click="selectCustomer(c)">
        <div class="card-top">
          <div class="card-avatar">{{ (c.name || '?')[0] }}</div>
          <div class="card-info">
            <div class="card-name">{{ c.name }}</div>
            <div class="card-phone">{{ c.phone || '-' }}</div>
          </div>
          <span class="status-badge" :class="'status-' + c.status">{{ statusLabel(c.status) }}</span>
        </div>
        <div class="card-meta">
          <span v-if="c.company" class="meta-item">{{ c.company }}</span>
          <span v-if="c.country" class="meta-item">{{ c.country }}</span>
        </div>
        <div class="card-bottom">
          <div class="intent-bar">
            <div class="intent-fill" :style="{ width: (c.intentLevel || 5) * 10 + '%' }" :class="intentClass(c.intentLevel)"></div>
            <span class="intent-num">{{ c.intentLevel || 5 }}</span>
          </div>
          <div class="card-actions">
            <button class="btn-icon" @click.stop="editCustomer(c)" title="编辑">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="btn-icon btn-danger" @click.stop="deleteCustomer(c)" title="删除">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Add/Edit Dialog -->
    <div v-if="showAddDialog || showEditDialog" class="dialog-overlay" @click.self="closeDialog">
      <div class="dialog-box">
        <div class="dialog-header">
          <h3>{{ showEditDialog ? '编辑客户' : '新增客户' }}</h3>
          <button class="btn-icon" @click="closeDialog">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div class="dialog-body">
          <div class="form-row">
            <div class="form-group">
              <label>名称 *</label>
              <input v-model="form.name" placeholder="客户名称" />
            </div>
            <div class="form-group">
              <label>电话</label>
              <input v-model="form.phone" placeholder="WhatsApp 号码" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>邮箱</label>
              <input v-model="form.email" placeholder="邮箱地址" />
            </div>
            <div class="form-group">
              <label>公司</label>
              <input v-model="form.company" placeholder="公司名称" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>国家</label>
              <input v-model="form.country" placeholder="国家/地区" />
            </div>
            <div class="form-group">
              <label>来源</label>
              <select v-model="form.source">
                <option value="whatsapp">WhatsApp</option>
                <option value="email">邮件</option>
                <option value="website">网站</option>
                <option value="referral">推荐</option>
                <option value="exhibition">展会</option>
                <option value="manual">手动录入</option>
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>状态</label>
              <select v-model="form.status">
                <option value="potential">潜在客户</option>
                <option value="active">活跃客户</option>
                <option value="vip">VIP客户</option>
                <option value="inactive">不活跃</option>
                <option value="lost">已流失</option>
              </select>
            </div>
            <div class="form-group">
              <label>意向度 (1-10)</label>
              <input v-model.number="form.intentLevel" type="number" min="1" max="10" />
            </div>
          </div>
          <div class="form-group">
            <label>标签 (逗号分隔)</label>
            <input v-model="form.tagsInput" placeholder="例如: 电子元件,大客户,东南亚" />
          </div>
          <div class="form-group">
            <label>备注</label>
            <textarea v-model="form.notes" rows="3" placeholder="客户备注信息"></textarea>
          </div>
        </div>
        <div class="dialog-footer">
          <button class="btn-secondary" @click="closeDialog">取消</button>
          <button class="btn-primary" @click="saveCustomer">{{ showEditDialog ? '保存' : '创建' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import api from '../utils/api.js';

const customers = ref([]);
const loading = ref(false);
const searchQuery = ref('');
const filterStatus = ref('');
const showAddDialog = ref(false);
const showEditDialog = ref(false);
const editingId = ref(null);

let searchTimer = null;

const form = reactive({
  name: '',
  phone: '',
  email: '',
  company: '',
  country: '',
  source: 'manual',
  status: 'potential',
  intentLevel: 5,
  tagsInput: '',
  notes: '',
});

const stats = computed(() => {
  const all = customers.value;
  return {
    total: all.length,
    active: all.filter(c => c.status === 'active').length,
    vip: all.filter(c => c.status === 'vip').length,
    potential: all.filter(c => c.status === 'potential').length,
  };
});

function parseTags(tags) {
  if (!tags) return [];
  try {
    const arr = JSON.parse(tags);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return tags.split(',').map(t => t.trim()).filter(Boolean);
  }
}

function statusLabel(status) {
  const map = { potential: '潜在', active: '活跃', vip: 'VIP', inactive: '不活跃', lost: '已流失' };
  return map[status] || status;
}

function intentClass(level) {
  if (level >= 8) return 'intent-high';
  if (level >= 5) return 'intent-medium';
  return 'intent-low';
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
}

function debouncedSearch() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => loadCustomers(), 300);
}

async function loadCustomers() {
  loading.value = true;
  try {
    const params = new URLSearchParams();
    if (searchQuery.value) params.set('search', searchQuery.value);
    if (filterStatus.value) params.set('status', filterStatus.value);
    const { data } = await api.get(`/customers?${params.toString()}`);
    customers.value = data;
  } catch (err) {
    console.error('Failed to load customers:', err);
  } finally {
    loading.value = false;
  }
}

function resetForm() {
  form.name = '';
  form.phone = '';
  form.email = '';
  form.company = '';
  form.country = '';
  form.source = 'manual';
  form.status = 'potential';
  form.intentLevel = 5;
  form.tagsInput = '';
  form.notes = '';
}

function closeDialog() {
  showAddDialog.value = false;
  showEditDialog.value = false;
  editingId.value = null;
  resetForm();
}

function editCustomer(c) {
  editingId.value = c.id;
  form.name = c.name || '';
  form.phone = c.phone || '';
  form.email = c.email || '';
  form.company = c.company || '';
  form.country = c.country || '';
  form.source = c.source || 'manual';
  form.status = c.status || 'potential';
  form.intentLevel = c.intentLevel || 5;
  form.tagsInput = parseTags(c.tags).join(', ');
  form.notes = c.notes || '';
  showEditDialog.value = true;
}

function selectCustomer(c) {
  editCustomer(c);
}

async function saveCustomer() {
  if (!form.name.trim()) {
    alert('请输入客户名称');
    return;
  }

  const payload = {
    name: form.name.trim(),
    phone: form.phone || null,
    email: form.email || null,
    company: form.company || null,
    country: form.country || null,
    source: form.source,
    status: form.status,
    intentLevel: form.intentLevel,
    tags: JSON.stringify(form.tagsInput.split(',').map(t => t.trim()).filter(Boolean)),
    notes: form.notes || null,
  };

  try {
    if (showEditDialog.value && editingId.value) {
      await api.put(`/customers/${editingId.value}`, payload);
    } else {
      await api.post('/customers', payload);
    }
    closeDialog();
    await loadCustomers();
  } catch (err) {
    console.error('Failed to save customer:', err);
    alert('保存失败: ' + (err.response?.data?.error || err.message));
  }
}

async function deleteCustomer(c) {
  if (!confirm(`确定删除客户 "${c.name}"?`)) return;
  try {
    await api.delete(`/customers/${c.id}`);
    await loadCustomers();
  } catch (err) {
    console.error('Failed to delete customer:', err);
    alert('删除失败');
  }
}

onMounted(() => {
  loadCustomers();
});
</script>

<style scoped>
.customers-page {
  min-height: 100vh;
  background: #0b141a;
  color: #e9edef;
  padding: 24px;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
  flex-wrap: wrap;
  gap: 12px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-left h1 {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
}

.back-link {
  color: #8696a0;
  display: flex;
  align-items: center;
  transition: color 0.15s;
}
.back-link:hover { color: #00a884; }

.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.search-box {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #202c33;
  border-radius: 8px;
  padding: 6px 12px;
  border: 1px solid #2a3942;
}
.search-box input {
  background: none;
  border: none;
  color: #e9edef;
  outline: none;
  font-size: 13px;
  width: 180px;
}
.search-box input::placeholder { color: #667781; }

.filter-select {
  background: #202c33;
  color: #e9edef;
  border: 1px solid #2a3942;
  border-radius: 8px;
  padding: 7px 12px;
  font-size: 13px;
  outline: none;
  cursor: pointer;
}

.btn-primary {
  background: #00a884;
  color: #111b21;
  border: none;
  border-radius: 8px;
  padding: 7px 16px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: background 0.15s;
}
.btn-primary:hover { background: #06cf9c; }

.btn-secondary {
  background: #202c33;
  color: #e9edef;
  border: 1px solid #2a3942;
  border-radius: 8px;
  padding: 7px 16px;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.15s;
}
.btn-secondary:hover { background: #2a3942; }

.btn-icon {
  background: none;
  border: none;
  color: #8696a0;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  transition: color 0.15s, background 0.15s;
}
.btn-icon:hover { color: #e9edef; background: #2a3942; }
.btn-icon.btn-danger:hover { color: #ea4335; }

.stats-row {
  display: flex;
  gap: 16px;
  margin-bottom: 24px;
}

.stat-card {
  background: #111b21;
  border: 1px solid #2a3942;
  border-radius: 10px;
  padding: 16px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 100px;
}
.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: #00a884;
}
.stat-label {
  font-size: 12px;
  color: #8696a0;
  margin-top: 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.table-container {
  background: #111b21;
  border: 1px solid #2a3942;
  border-radius: 12px;
  overflow: hidden;
}

.customer-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.customer-table th {
  text-align: left;
  padding: 12px 16px;
  background: #202c33;
  color: #8696a0;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 600;
  border-bottom: 1px solid #2a3942;
}
.customer-table td {
  padding: 10px 16px;
  border-bottom: 1px solid rgba(255,255,255,0.04);
  vertical-align: middle;
}

.customer-row {
  cursor: pointer;
  transition: background 0.15s;
}
.customer-row:hover { background: #202c33; }

.empty-cell {
  text-align: center;
  color: #667781;
  padding: 40px 16px !important;
}

.name-cell {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 500;
}

.avatar-sm {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #00a884;
  color: #111b21;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  flex-shrink: 0;
}

.tags-cell {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.tag-badge {
  background: rgba(0,168,132,0.15);
  color: #00a884;
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 10px;
}

.intent-bar {
  display: flex;
  align-items: center;
  gap: 8px;
}
.intent-bar > .intent-fill {
  height: 4px;
  border-radius: 2px;
  width: 60px;
  background: #2a3942;
  position: relative;
}
.intent-fill {
  height: 100%;
  border-radius: 2px;
}
.intent-high { background: #00a884; }
.intent-medium { background: #f5a623; }
.intent-low { background: #ea4335; }
.intent-num {
  font-size: 11px;
  color: #8696a0;
}

.status-badge {
  font-size: 11px;
  padding: 2px 10px;
  border-radius: 10px;
  font-weight: 500;
}
.status-potential { background: rgba(245,166,35,0.15); color: #f5a623; }
.status-active { background: rgba(0,168,132,0.15); color: #00a884; }
.status-vip { background: rgba(168,130,255,0.15); color: #a882ff; }
.status-inactive { background: rgba(134,150,160,0.15); color: #8696a0; }
.status-lost { background: rgba(234,67,53,0.15); color: #ea4335; }

.text-muted { color: #667781; }

.actions-cell {
  display: flex;
  gap: 4px;
}

/* Dialog */
.dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}
.dialog-box {
  background: #111b21;
  border: 1px solid #2a3942;
  border-radius: 12px;
  width: 560px;
  max-width: 95vw;
  max-height: 90vh;
  overflow-y: auto;
}
.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #2a3942;
}
.dialog-header h3 {
  margin: 0;
  font-size: 16px;
}
.dialog-body {
  padding: 20px;
}
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 20px;
  border-top: 1px solid #2a3942;
}

.form-row {
  display: flex;
  gap: 16px;
  margin-bottom: 0;
}
.form-row .form-group {
  flex: 1;
}

.form-group {
  margin-bottom: 14px;
}
.form-group label {
  display: block;
  font-size: 12px;
  color: #8696a0;
  margin-bottom: 6px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}
.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  background: #202c33;
  border: 1px solid #2a3942;
  border-radius: 6px;
  padding: 8px 12px;
  color: #e9edef;
  font-size: 13px;
  outline: none;
  transition: border-color 0.15s;
  box-sizing: border-box;
}
.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  border-color: #00a884;
}
.form-group textarea {
  resize: vertical;
}

/* ========== Mobile Card Layout ========== */
.cards-container {
  display: none;
}

.customer-card {
  background: #111b21;
  border: 1px solid #2a3942;
  border-radius: 10px;
  padding: 12px;
  margin-bottom: 10px;
  cursor: pointer;
  transition: background 0.15s;
}
.customer-card:active {
  background: #202c33;
}
.card-top {
  display: flex;
  align-items: center;
  gap: 10px;
}
.card-avatar {
  width: 40px;
  height: 40px;
  min-width: 40px;
  border-radius: 50%;
  background: #005c4b;
  color: #e9edef;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 600;
}
.card-info {
  flex: 1;
  min-width: 0;
}
.card-name {
  font-size: 15px;
  font-weight: 500;
  color: #e9edef;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.card-phone {
  font-size: 12px;
  color: #8696a0;
  margin-top: 2px;
}
.card-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
  padding-left: 50px;
}
.meta-item {
  font-size: 12px;
  color: #8696a0;
  background: rgba(255,255,255,0.04);
  padding: 2px 8px;
  border-radius: 10px;
}
.card-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-left: 50px;
  margin-top: 8px;
}
.card-actions {
  display: flex;
  gap: 6px;
}
.card-actions .btn-icon {
  width: 36px;
  height: 36px;
}

/* ========== Mobile Responsive ========== */
@media (max-width: 768px) {
  .customers-page {
    padding: 0 12px 20px;
  }

  /* Header */
  .page-header {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
    padding: 12px 0;
  }
  .header-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .header-left h1 {
    font-size: 18px;
  }
  .header-actions {
    flex-wrap: wrap;
    gap: 8px;
  }
  .search-box {
    flex: 1;
    min-width: 0;
  }
  .search-box input {
    font-size: 16px;
    padding: 8px 10px 8px 32px;
  }
  .filter-select {
    font-size: 14px;
    min-width: 0;
    flex: 1;
  }
  .btn-primary {
    font-size: 14px;
    padding: 8px 14px;
    min-height: 40px;
  }

  /* Stats - flex-wrap 2 per row */
  .stats-row {
    display: flex !important;
    flex-wrap: wrap !important;
    grid-template-columns: none !important;
    gap: 8px !important;
  }
  .stat-card {
    width: calc(50% - 4px) !important;
    min-width: 0 !important;
    padding: 10px 12px !important;
  }
  .stat-value {
    font-size: 20px !important;
  }
  .stat-label {
    font-size: 11px !important;
  }

  /* Hide table, show cards */
  .table-container {
    display: none !important;
  }
  .cards-container {
    display: block !important;
  }

  /* Dialog */
  .dialog-box {
    width: 100%;
    max-width: 100%;
    border-radius: 0;
    min-height: 100vh;
  }
  .dialog-body {
    padding: 16px 12px;
  }
  .form-row {
    flex-direction: column;
    gap: 0;
  }
  .form-group input,
  .form-group select,
  .form-group textarea {
    font-size: 16px;
    padding: 10px 12px;
  }
  .dialog-footer {
    padding: 12px;
  }
  .dialog-footer .btn-primary,
  .dialog-footer .btn-secondary {
    min-height: 44px;
    font-size: 15px;
  }
}

/* Very small screens */
@media (max-width: 380px) {
  .stats-row {
    grid-template-columns: 1fr 1fr;
  }
  .header-actions {
    flex-direction: column;
  }
  .search-box {
    width: 100%;
  }
}
</style>
