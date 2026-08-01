<template>
  <div class="customers-page">
    <!-- Header -->
    <header class="page-header">
      <div class="header-left">
        <router-link to="/" class="back-link" title="返回沟通">
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
        <button class="btn-secondary" @click="showAutoDialog = true" title="自动化接待">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 4v6l4 2"/></svg>
          自动接待
        </button>
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
            <button v-if="c.phone" class="btn-icon btn-whatsapp" @click.stop="sendWhatsApp(c)" title="发送WhatsApp">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            </button>
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

    <!-- Quick WhatsApp Send Dialog -->
    <div v-if="showWhatsAppDialog" class="dialog-overlay" @click.self="showWhatsAppDialog = false">
      <div class="dialog-box" style="width: 480px;">
        <div class="dialog-header">
          <h3>发送WhatsApp消息</h3>
          <button class="btn-icon" @click="showWhatsAppDialog = false">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div class="dialog-body">
          <div class="form-group">
            <label>收件人</label>
            <div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:#202c33;border-radius:6px;border:1px solid #2a3942;">
              <div class="avatar-sm" style="width:28px;height:28px;font-size:11px;">{{ (waTarget.name || '?')[0] }}</div>
              <div>
                <div style="font-size:13px;color:#e9edef;">{{ waTarget.name }}</div>
                <div style="font-size:11px;color:#8696a0;">{{ waTarget.phone }}</div>
              </div>
            </div>
          </div>
          <div class="form-group">
            <label>消息内容</label>
            <textarea v-model="waMessage" rows="4" placeholder="输入消息内容..." style="width:100%;background:#202c33;border:1px solid #2a3942;border-radius:6px;padding:10px 12px;color:#e9edef;font-size:13px;outline:none;resize:vertical;box-sizing:border-box;"></textarea>
          </div>
          <div v-if="waTemplates.length > 0" class="form-group">
            <label>快捷模板</label>
            <div style="display:flex;flex-wrap:wrap;gap:6px;">
              <button v-for="(t, i) in waTemplates" :key="i" class="template-btn" @click="waMessage = t.text">{{ t.label }}</button>
            </div>
          </div>
        </div>
        <div class="dialog-footer">
          <button class="btn-secondary" @click="showWhatsAppDialog = false">取消</button>
          <button class="btn-primary" @click="doSendWhatsApp" :disabled="!waMessage.trim() || waSending">
            <span v-if="waSending">发送中...</span>
            <span v-else>发送</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Automation Settings Dialog -->
    <div v-if="showAutoDialog" class="dialog-overlay" @click.self="showAutoDialog = false">
      <div class="dialog-box" style="width: 560px;">
        <div class="dialog-header">
          <h3>自动化接待设置</h3>
          <button class="btn-icon" @click="showAutoDialog = false">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div class="dialog-body">
          <div class="form-group">
            <label style="display:flex;align-items:center;gap:8px;text-transform:none;font-size:13px;color:#e9edef;">
              <input type="checkbox" v-model="autoConfig.enabled" style="width:auto;" />
              启用自动回复
            </label>
          </div>
          <div class="form-group">
            <label>欢迎消息</label>
            <textarea v-model="autoConfig.welcomeMessage" rows="3" placeholder="新客户首次发消息时自动回复..." style="width:100%;background:#202c33;border:1px solid #2a3942;border-radius:6px;padding:10px 12px;color:#e9edef;font-size:13px;outline:none;resize:vertical;box-sizing:border-box;"></textarea>
          </div>
          <div class="form-group">
            <label>离线回复</label>
            <textarea v-model="autoConfig.offlineMessage" rows="3" placeholder="非工作时间自动回复..." style="width:100%;background:#202c33;border:1px solid #2a3942;border-radius:6px;padding:10px 12px;color:#e9edef;font-size:13px;outline:none;resize:vertical;box-sizing:border-box;"></textarea>
          </div>
          <div class="form-group">
            <label>工作时段</label>
            <div style="display:flex;gap:8px;align-items:center;">
              <input v-model="autoConfig.workStart" type="time" style="flex:1;background:#202c33;border:1px solid #2a3942;border-radius:6px;padding:8px 12px;color:#e9edef;font-size:13px;outline:none;" />
              <span style="color:#8696a0;">至</span>
              <input v-model="autoConfig.workEnd" type="time" style="flex:1;background:#202c33;border:1px solid #2a3942;border-radius:6px;padding:8px 12px;color:#e9edef;font-size:13px;outline:none;" />
            </div>
          </div>
        </div>
        <div class="dialog-footer">
          <button class="btn-secondary" @click="showAutoDialog = false">取消</button>
          <button class="btn-primary" @click="saveAutomation">保存设置</button>
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
    customers.value = data.items || data;
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

// WhatsApp quick send state
const showWhatsAppDialog = ref(false);
const waTarget = reactive({ name: '', phone: '' });
const waMessage = ref('');
const waSending = ref(false);
const waTemplates = [
  { label: '产品报价', text: 'Hi! Thank you for your interest in our products. Please find our quotation attached. Let us know if you have any questions.' },
  { label: '发货通知', text: 'Hi! Your order has been shipped. Tracking number will be provided shortly. Thank you for your patience.' },
  { label: '售后跟进', text: 'Hi! We wanted to follow up on your recent order. Is everything satisfactory? Please let us know if there is anything we can help with.' },
  { label: '节日问候', text: 'Greetings! Wishing you and your team a wonderful holiday season. We look forward to continuing our partnership in the new year.' },
];

// Automation state
const showAutoDialog = ref(false);
const autoConfig = reactive({
  enabled: false,
  welcomeMessage: '',
  offlineMessage: '',
  workStart: '09:00',
  workEnd: '18:00',
});

function sendWhatsApp(c) {
  waTarget.name = c.name || '';
  waTarget.phone = c.phone || '';
  waMessage.value = '';
  showWhatsAppDialog.value = true;
}

async function doSendWhatsApp() {
  if (!waMessage.value.trim() || !waTarget.phone) return;
  waSending.value = true;
  try {
    await api.post('/whatsapp/send', {
      to: waTarget.phone,
      message: waMessage.value.trim(),
    });
    showWhatsAppDialog.value = false;
    alert('消息已发送');
  } catch (err) {
    console.error('Failed to send WhatsApp:', err);
    alert('发送失败: ' + (err.response?.data?.error || err.message));
  } finally {
    waSending.value = false;
  }
}

async function loadAutomation() {
  try {
    const { data } = await api.get('/settings');
    const autoSetting = data.find(s => s.key === 'automation');
    if (autoSetting) {
      const val = typeof autoSetting.value === 'string' ? JSON.parse(autoSetting.value) : autoSetting.value;
      Object.assign(autoConfig, val);
    }
  } catch (err) {
    console.error('Failed to load automation settings:', err);
  }
}

async function saveAutomation() {
  try {
    await api.put('/settings', {
      key: 'automation',
      value: JSON.stringify({
        enabled: autoConfig.enabled,
        welcomeMessage: autoConfig.welcomeMessage,
        offlineMessage: autoConfig.offlineMessage,
        workStart: autoConfig.workStart,
        workEnd: autoConfig.workEnd,
      }),
    });
    showAutoDialog.value = false;
    alert('自动接待设置已保存');
  } catch (err) {
    console.error('Failed to save automation:', err);
    alert('保存失败: ' + (err.response?.data?.error || err.message));
  }
}

onMounted(() => {
  loadCustomers();
  loadAutomation();
});
</script>

<style scoped>
.customers-page {
  min-height: 100%;
  background: var(--panel-bg);
  color: var(--text-primary);
  padding: 24px;
  width: 100%;
  box-sizing: border-box;
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
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  transition: color 0.15s;
}
.back-link:hover { color: var(--accent); }

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
  background: var(--panel-header-bg);
  border-radius: 8px;
  padding: 6px 12px;
  border: 1px solid var(--sidebar-active);
}
.search-box input {
  background: none;
  border: none;
  color: var(--text-primary);
  outline: none;
  font-size: 13px;
  width: 180px;
}
.search-box input::placeholder { color: var(--text-muted); }

.filter-select {
  background: var(--panel-header-bg);
  color: var(--text-primary);
  border: 1px solid var(--sidebar-active);
  border-radius: 8px;
  padding: 7px 12px;
  font-size: 13px;
  outline: none;
  cursor: pointer;
}

.btn-primary {
  background: var(--accent);
  color: var(--accent-text);
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
.btn-primary:hover { background: var(--accent-hover); }

.btn-secondary {
  background: var(--panel-header-bg);
  color: var(--text-primary);
  border: 1px solid var(--sidebar-active);
  border-radius: 8px;
  padding: 7px 16px;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.15s;
}
.btn-secondary:hover { background: var(--sidebar-active); }

.btn-icon {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  transition: color 0.15s, background 0.15s;
}
.btn-icon:hover { color: var(--text-primary); background: var(--sidebar-active); }
.btn-icon.btn-danger:hover { color: var(--danger); }

.stats-row {
  display: flex;
  gap: 16px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}

.stat-card {
  background: var(--panel-bg);
  border: 1px solid var(--sidebar-active);
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
  color: var(--accent);
}
.stat-label {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.table-container {
  background: var(--panel-bg);
  border: 1px solid var(--sidebar-active);
  border-radius: 12px;
  overflow: hidden;
  display: block;
  overflow-x: auto;
}

.customer-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.customer-table th:nth-child(1) { width: 200px; }
.customer-table th:nth-child(2) { width: 140px; }
.customer-table th:nth-child(3) { width: 160px; }
.customer-table th:nth-child(4) { width: 100px; }
.customer-table th:nth-child(6) { width: 120px; }
.customer-table th:nth-child(7) { width: 90px; }
.customer-table th:nth-child(8) { width: 130px; }
.customer-table th:nth-child(9) { width: 90px; }
.customer-table th {
  text-align: left;
  padding: 12px 16px;
  background: var(--panel-header-bg);
  color: var(--text-secondary);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 600;
  border-bottom: 1px solid var(--sidebar-active);
}
.customer-table td {
  padding: 10px 16px;
  border-bottom: 1px solid var(--row-divider, rgba(255,255,255,0.08));
  vertical-align: middle;
}
.customer-table tbody tr:last-child td { border-bottom:none; }

.customer-row {
  cursor: pointer;
  transition: background 0.15s;
}
.customer-row:hover { background: var(--panel-header-bg); }

.empty-cell {
  text-align: center;
  color: var(--text-muted);
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
  background: var(--accent);
  color: var(--accent-text);
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
  color: var(--accent);
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
  background: var(--sidebar-active);
  position: relative;
}
.intent-fill {
  height: 100%;
  border-radius: 2px;
}
.intent-high { background: var(--accent); }
.intent-medium { background: #f5a623; }
.intent-low { background: var(--danger); }
.intent-num {
  font-size: 11px;
  color: var(--text-secondary);
}

.status-badge {
  font-size: 11px;
  padding: 2px 10px;
  border-radius: 10px;
  font-weight: 500;
}
.status-potential { background: rgba(245,166,35,0.15); color: #f5a623; }
.status-active { background: rgba(0,168,132,0.15); color: var(--accent); }
.status-vip { background: rgba(168,130,255,0.15); color: #a882ff; }
.status-inactive { background: rgba(134,150,160,0.15); color: var(--text-secondary); }
.status-lost { background: rgba(234,67,53,0.15); color: var(--danger); }

.text-muted { color: var(--text-muted); }

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
  background: var(--panel-bg);
  border: 1px solid var(--sidebar-active);
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
  border-bottom: 1px solid var(--sidebar-active);
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
  border-top: 1px solid var(--sidebar-active);
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
  color: var(--text-secondary);
  margin-bottom: 6px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}
.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  background: var(--panel-header-bg);
  border: 1px solid var(--sidebar-active);
  border-radius: 6px;
  padding: 8px 12px;
  color: var(--text-primary);
  font-size: 13px;
  outline: none;
  transition: border-color 0.15s;
  box-sizing: border-box;
}
.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  border-color: var(--accent);
}
.form-group textarea {
  resize: vertical;
}

/* ========== Mobile Card Layout ========== */
.cards-container {
  display: none;
}

.customer-card {
  background: var(--panel-header-bg);
  border: 1px solid var(--sidebar-active);
  border-radius: 10px;
  padding: 12px;
  margin-bottom: 10px;
  cursor: pointer;
  transition: background 0.15s;
}
.customer-card:active {
  background: var(--panel-header-bg);
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
  background: var(--msg-outgoing);
  color: var(--text-primary);
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
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.card-phone {
  font-size: 12px;
  color: var(--text-secondary);
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
  color: var(--text-secondary);
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
@media (max-width: 640px) {
  .customers-page {
    padding: 0 12px calc(72px + env(safe-area-inset-bottom, 0px));
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
    min-height: 100%;
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
/* WhatsApp button */
.btn-whatsapp {
  color: #25D366 !important;
}
.btn-whatsapp:hover {
  background: rgba(37, 211, 102, 0.15) !important;
  color: #25D366 !important;
}

/* Template buttons */
.template-btn {
  background: rgba(0, 168, 132, 0.1);
  color: var(--accent);
  border: 1px solid rgba(0, 168, 132, 0.3);
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.15s;
}
.template-btn:hover {
  background: rgba(0, 168, 132, 0.2);
}

</style>
