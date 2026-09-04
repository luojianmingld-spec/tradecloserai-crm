<template>
  <div class="factory-agent-page">
    <div class="page-header">
      <div class="header-left">
        <h1>🏭 工厂对接</h1>
        <span class="subtitle">管理供应商、追踪订单进度</span>
      </div>
      <div class="header-actions">
        <button class="btn btn-secondary" @click="showWecomConfig = true" v-if="!wecomConfigured">
          ⚙️ 配置企微
        </button>
        <button class="btn btn-secondary" @click="syncContacts" v-if="wecomConfigured" :disabled="syncing">
          🔄 {{ syncing ? '同步中...' : '同步企微联系人' }}
        </button>
        <button class="btn btn-primary" @click="showAddModal = true">+ 添加工厂</button>
      </div>
    </div>

    <!-- Stats -->
    <div class="stats-row" v-if="stats">
      <div class="stat-card">
        <div class="stat-value">{{ stats.factoryCount }}</div>
        <div class="stat-label">合作工厂</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.activeOrders }}</div>
        <div class="stat-label">进行中订单</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ partners.length }}</div>
        <div class="stat-label">总供应商数</div>
      </div>
    </div>

    <!-- Search & Filter -->
    <div class="filter-bar">
      <input v-model="searchQuery" placeholder="搜索工厂名称、产品..." class="search-input" @input="fetchPartners" />
      <select v-model="statusFilter" @change="fetchPartners" class="filter-select">
        <option value="">全部状态</option>
        <option value="active">合作中</option>
        <option value="inactive">已停用</option>
        <option value="blacklisted">黑名单</option>
      </select>
    </div>

    <!-- Partner List -->
    <div class="partner-grid">
      <div v-for="partner in partners" :key="partner.id" class="partner-card" @click="openDetail(partner)">
        <div class="card-header">
          <div class="company-name">{{ partner.companyName }}</div>
          <span class="status-badge" :class="partner.status">{{ statusText(partner.status) }}</span>
        </div>
        <div class="card-body">
          <div class="info-row" v-if="partner.contactName">
            <span class="label">联系人</span>
            <span>{{ partner.contactName }}</span>
          </div>
          <div class="info-row" v-if="partner.mainProducts">
            <span class="label">主营产品</span>
            <span>{{ partner.mainProducts }}</span>
          </div>
          <div class="info-row" v-if="partner.moq">
            <span class="label">最小起订</span>
            <span>{{ partner.moq }}</span>
          </div>
          <div class="info-row" v-if="partner.qualityLevel">
            <span class="label">质量等级</span>
            <span class="quality-badge" :class="'grade-' + partner.qualityLevel.toLowerCase()">{{ partner.qualityLevel }}</span>
          </div>
          <div class="card-footer">
            <span class="tag">📦 {{ partner._count?.orders || 0 }} 订单</span>
            <span class="tag">💬 {{ partner._count?.messages || 0 }} 消息</span>
            <span class="last-contact" v-if="partner.lastContactAt">最近联系: {{ formatDate(partner.lastContactAt) }}</span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="partners.length === 0 && !loading" class="empty-state">
      <div class="empty-icon">🏭</div>
      <h3>还没有工厂供应商</h3>
      <p>点击「添加工厂」手动添加，或配置企业微信后自动同步联系人</p>
    </div>

    <!-- Add/Edit Modal -->
    <div v-if="showAddModal" class="modal-overlay" @click.self="showAddModal = false">
      <div class="modal-content">
        <h2>{{ editingPartner ? '编辑工厂' : '添加工厂' }}</h2>
        <form @submit.prevent="savePartner">
          <div class="form-grid">
            <div class="form-group">
              <label>公司名称 *</label>
              <input v-model="form.companyName" required />
            </div>
            <div class="form-group">
              <label>联系人</label>
              <input v-model="form.contactName" />
            </div>
            <div class="form-group">
              <label>电话</label>
              <input v-model="form.phone" />
            </div>
            <div class="form-group">
              <label>邮箱</label>
              <input v-model="form.email" type="email" />
            </div>
            <div class="form-group full-width">
              <label>主营产品</label>
              <input v-model="form.mainProducts" placeholder="如：玻璃制品、包装材料..." />
            </div>
            <div class="form-group">
              <label>最小起订量</label>
              <input v-model="form.moq" placeholder="如：500件" />
            </div>
            <div class="form-group">
              <label>价格区间</label>
              <input v-model="form.priceRange" placeholder="如：$5-20/件" />
            </div>
            <div class="form-group">
              <label>质量等级</label>
              <select v-model="form.qualityLevel">
                <option value="">未评级</option>
                <option value="A">A - 优秀</option>
                <option value="B">B - 良好</option>
                <option value="C">C - 一般</option>
              </select>
            </div>
            <div class="form-group">
              <label>地址</label>
              <input v-model="form.address" />
            </div>
            <div class="form-group full-width">
              <label>备注</label>
              <textarea v-model="form.notes" rows="3"></textarea>
            </div>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn btn-secondary" @click="showAddModal = false">取消</button>
            <button type="submit" class="btn btn-primary">保存</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Detail Panel -->
    <div v-if="selectedPartner" class="modal-overlay" @click.self="selectedPartner = null">
      <div class="detail-panel">
        <div class="detail-header">
          <h2>{{ selectedPartner.companyName }}</h2>
          <div class="detail-actions">
            <button class="btn btn-sm btn-secondary" @click="editPartner(selectedPartner)">编辑</button>
            <button class="btn btn-sm btn-danger" @click="deletePartner(selectedPartner.id)">删除</button>
            <button class="btn btn-sm btn-close" @click="selectedPartner = null">✕</button>
          </div>
        </div>

        <div class="detail-body">
          <!-- Contact Info -->
          <div class="detail-section">
            <h3>📋 基本信息</h3>
            <div class="info-grid">
              <div v-if="selectedPartner.contactName"><strong>联系人:</strong> {{ selectedPartner.contactName }}</div>
              <div v-if="selectedPartner.phone"><strong>电话:</strong> {{ selectedPartner.phone }}</div>
              <div v-if="selectedPartner.email"><strong>邮箱:</strong> {{ selectedPartner.email }}</div>
              <div v-if="selectedPartner.address"><strong>地址:</strong> {{ selectedPartner.address }}</div>
              <div v-if="selectedPartner.mainProducts"><strong>主营:</strong> {{ selectedPartner.mainProducts }}</div>
              <div v-if="selectedPartner.moq"><strong>起订量:</strong> {{ selectedPartner.moq }}</div>
              <div v-if="selectedPartner.priceRange"><strong>价格:</strong> {{ selectedPartner.priceRange }}</div>
            </div>
          </div>

          <!-- Orders -->
          <div class="detail-section">
            <h3>📦 订单记录 <button class="btn btn-sm btn-primary" @click="showOrderModal = true">+ 新增订单</button></h3>
            <div class="order-list">
              <div v-for="order in selectedPartner.orders" :key="order.id" class="order-item">
                <div class="order-top">
                  <span class="order-no">{{ order.orderNo || '无单号' }}</span>
                  <span class="order-status" :class="order.status">{{ orderStatusText(order.status) }}</span>
                </div>
                <div class="order-info">
                  {{ order.productName }} | {{ order.quantity }} {{ order.currency }}{{ order.totalPrice?.toFixed(2) }}
                </div>
                <div class="order-date">{{ formatDate(order.orderDate) }}</div>
              </div>
              <div v-if="!selectedPartner.orders?.length" class="empty-hint">暂无订单记录</div>
            </div>
          </div>

          <!-- Messages -->
          <div class="detail-section">
            <h3>💬 消息记录 <button class="btn btn-sm btn-secondary" @click="showMessageModal = true">+ 发送消息</button></h3>
            <div class="message-list">
              <div v-for="msg in selectedPartner.messages" :key="msg.id" class="message-item" :class="msg.direction">
                <div class="msg-content">{{ msg.content }}</div>
                <div class="msg-meta">
                  <span class="msg-time">{{ formatDate(msg.createdAt) }}</span>
                  <span class="msg-channel">{{ msg.channel }}{{ msg.aiGenerated ? ' 🤖' : '' }}</span>
                </div>
              </div>
              <div v-if="!selectedPartner.messages?.length" class="empty-hint">暂无消息</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Order Modal -->
    <div v-if="showOrderModal" class="modal-overlay" @click.self="showOrderModal = false">
      <div class="modal-content modal-sm">
        <h2>新增订单</h2>
        <form @submit.prevent="createOrder">
          <div class="form-group"><label>订单号</label><input v-model="orderForm.orderNo" /></div>
          <div class="form-group"><label>产品名称 *</label><input v-model="orderForm.productName" required /></div>
          <div class="form-group"><label>数量</label><input v-model="orderForm.quantity" /></div>
          <div class="form-group"><label>单价 (USD)</label><input v-model="orderForm.unitPrice" type="number" step="0.01" /></div>
          <div class="form-group"><label>预计完成日期</label><input v-model="orderForm.estimatedCompletion" type="date" /></div>
          <div class="form-group"><label>备注</label><textarea v-model="orderForm.notes" rows="2"></textarea></div>
          <div class="modal-actions">
            <button type="button" class="btn btn-secondary" @click="showOrderModal = false">取消</button>
            <button type="submit" class="btn btn-primary">创建</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Message Modal -->
    <div v-if="showMessageModal" class="modal-overlay" @click.self="showMessageModal = false">
      <div class="modal-content modal-sm">
        <h2>发送消息</h2>
        <form @submit.prevent="sendMessage">
          <div class="form-group">
            <label>消息内容</label>
            <textarea v-model="messageContent" rows="4" required></textarea>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn btn-secondary" @click="showMessageModal = false">取消</button>
            <button type="button" class="btn btn-ai" @click="generateMessage" :disabled="generating">🤖 AI生成</button>
            <button type="submit" class="btn btn-primary">发送</button>
          </div>
        </form>
      </div>
    </div>

    <!-- WeCom Config Modal -->
    <div v-if="showWecomConfig" class="modal-overlay" @click.self="showWecomConfig = false">
      <div class="modal-content">
        <h2>⚙️ 企业微信配置</h2>
        <p class="config-hint">
          请在企业微信管理后台获取以下信息：<br>
          CorpID: 我的企业 → 企业信息 → 企业ID<br>
          CorpSecret: 应用管理 → 自建应用 → Secret<br>
          <a href="https://work.weixin.qq.com" target="_blank">打开企业微信管理后台 →</a>
          <br><br>
          <button type="button" class="btn btn-link" @click="showWecomGuide = true" style="color:#4a9eff;font-size:14px;padding:0;text-decoration:underline;">
            📖 查看详细配置说明
          </button>
        </p>
        <form @submit.prevent="saveWecomConfig">
          <div class="form-group"><label>CorpID (企业ID) *</label><input v-model="wecomForm.corpId" required /></div>
          <div class="form-group"><label>CorpSecret (外部联系人Secret) *</label><input v-model="wecomForm.corpSecret" required :placeholder="wecomConfig?.corpSecret || '输入新的Secret'" /></div>
          <div class="form-group"><label>AgentID (应用ID，可选)</label><input v-model="wecomForm.agentId" /></div>
          <div class="modal-actions">
            <button type="button" class="btn btn-secondary" @click="showWecomConfig = false">取消</button>
            <button type="button" class="btn btn-secondary" @click="testWecomConnection" :disabled="testing">测试连接</button>
            <button type="submit" class="btn btn-primary">保存配置</button>
          </div>
        </form>
        <div v-if="testResult" class="test-result" :class="testResult.success ? 'success' : 'error'">{{ testResult.message }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';

const api = {
  get: (url) => fetch(url).then(r => r.json()),
  post: (url, body) => fetch(url, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) }).then(r => r.json()),
  put: (url, body) => fetch(url, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) }).then(r => r.json()),
  delete: (url) => fetch(url, { method: 'DELETE' }).then(r => r.json()),
};

const partners = ref([]);
const loading = ref(false);
const syncing = ref(false);
const searchQuery = ref('');
const statusFilter = ref('');
const stats = ref(null);
const selectedPartner = ref(null);
const showAddModal = ref(false);
const showOrderModal = ref(false);
const showMessageModal = ref(false);
const showWecomConfig = ref(false);
const showWecomGuide = ref(false);
const editingPartner = ref(null);
const wecomConfig = ref(null);
const wecomConfigured = ref(false);
const testing = ref(false);
const testResult = ref(null);
const generating = ref(false);
const messageContent = ref('');

const form = ref({});
const orderForm = ref({});

onMounted(async () => {
  await fetchPartners();
  await fetchStats();
  await loadWecomConfig();
});

async function fetchPartners() {
  loading.value = true;
  try {
    const params = new URLSearchParams({ type: 'factory' });
    if (searchQuery.value) params.set('search', searchQuery.value);
    if (statusFilter.value) params.set('status', statusFilter.value);
    partners.value = await api.get(`/partners?${params}`);
  } catch(e) { console.error(e); }
  loading.value = false;
}

async function fetchStats() {
  try {
    stats.value = await api.get('/partners/stats/overview');
  } catch(e) {}
}

async function loadWecomConfig() {
  try {
    const config = await api.get('/wecom/config');
    wecomConfig.value = config;
    wecomConfigured.value = config.configured;
  } catch(e) {}
}

async function saveWecomConfig() {
  try {
    await api.put('/wecom/config', wecomForm.value);
    await loadWecomConfig();
    showWecomConfig.value = false;
  } catch(e) { alert('保存失败: ' + e.message); }
}

async function testWecomConnection() {
  testing.value = true;
  testResult.value = null;
  try {
    const result = await api.get('/wecom/test');
    testResult.value = result;
  } catch(e) {
    testResult.value = { success: false, message: e.message };
  }
  testing.value = false;
}

async function syncContacts() {
  syncing.value = true;
  try {
    const result = await api.post('/wecom/sync-contacts');
    if (result.success) {
      await fetchPartners();
      await fetchStats();
      alert(result.message);
    } else {
      alert('同步失败: ' + result.error);
    }
  } catch(e) { alert('同步失败: ' + e.message); }
  syncing.value = false;
}

function openDetail(partner) { selectedPartner.value = partner; }

function editPartner(partner) {
  editingPartner.value = partner;
  form.value = { ...partner };
  showAddModal.value = true;
}

async function savePartner() {
  try {
    if (editingPartner.value) {
      await api.put(`/partners/${editingPartner.value.id}`, { ...form.value, type: 'factory' });
    } else {
      await api.post('/partners', { ...form.value, type: 'factory' });
    }
    showAddModal.value = false;
    editingPartner.value = null;
    form.value = {};
    await fetchPartners();
    await fetchStats();
  } catch(e) { alert('保存失败'); }
}

async function deletePartner(id) {
  if (!confirm('确定删除此工厂？')) return;
  await api.delete(`/partners/${id}`);
  selectedPartner.value = null;
  await fetchPartners();
  await fetchStats();
}

async function createOrder() {
  if (!selectedPartner.value) return;
  await api.post(`/partners/${selectedPartner.value.id}/orders`, orderForm.value);
  showOrderModal.value = false;
  orderForm.value = {};
  // Refresh detail
  const updated = await api.get(`/partners/${selectedPartner.value.id}`);
  selectedPartner.value = updated;
  await fetchStats();
}

async function sendMessage() {
  if (!selectedPartner.value || !messageContent.value) return;
  await api.post(`/wecom/send-message`, {
    partnerId: selectedPartner.value.id,
    content: messageContent.value,
  });
  showMessageModal.value = false;
  messageContent.value = '';
  const updated = await api.get(`/partners/${selectedPartner.value.id}`);
  selectedPartner.value = updated;
}

async function generateMessage() {
  generating.value = true;
  try {
    const resp = await api.post('/ai/chat', {
      messages: [{ role: 'user', content: `请帮我生成一条催货消息，发给工厂"${selectedPartner.value?.companyName}"，联系人"${selectedPartner.value?.contactName}"，催问产品"${selectedPartner.value?.mainProducts}"的生产进度。语气礼貌但坚定，要求给出预计完成时间。` }],
    });
    messageContent.value = resp.choices?.[0]?.message?.content || resp.content || '生成失败，请手动编写';
  } catch(e) {
    messageContent.value = 'AI生成失败，请手动编写消息';
  }
  generating.value = false;
}

function statusText(s) {
  return { active: '合作中', inactive: '已停用', blacklisted: '黑名单' }[s] || s;
}
function orderStatusText(s) {
  return { pending:'待确认', confirmed:'已确认', producing:'生产中', qc:'质检中', shipped:'已发货', completed:'已完成', cancelled:'已取消' }[s] || s;
}
function formatDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('zh-CN');
}
</script>

<style scoped>
.factory-agent-page { padding: 24px; max-width: 1200px; width: 100%; margin: 0 auto; box-sizing: border-box; }
.page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; flex-wrap: wrap; gap: 12px; }
.header-left h1 { font-size: 24px; margin: 0; }
.subtitle { color: var(--text-secondary); font-size: 14px; }
.header-actions { display: flex; gap: 8px; flex-wrap: wrap; }

.stats-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 24px; }
.stat-card { background: var(--mgmt-card-bg); border: 1px solid var(--mgmt-divider); border-radius: 12px; padding: 16px; text-align: center; }
.stat-value { font-size: 28px; font-weight: 700; color: var(--accent); }
.stat-label { font-size: 13px; color: var(--text-secondary); margin-top: 4px; }

.filter-bar { display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
.search-input { flex: 1; min-width: 200px; padding: 8px 12px; border: 1px solid var(--mgmt-divider); border-radius: 8px; background: var(--bg-primary); color: var(--text-primary); }
.filter-select { padding: 8px 12px; border: 1px solid var(--mgmt-divider); border-radius: 8px; background: var(--bg-primary); color: var(--text-primary); }
.filter-select option,
.form-group select option {
  background: var(--mgmt-card-bg, #1e252b);
  color: var(--mgmt-text, #e9edef);
}


.partner-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; }
.partner-card { background: var(--mgmt-card-bg); border: 1px solid var(--mgmt-divider); border-radius: 12px; padding: 16px; cursor: pointer; transition: all 0.2s; }
.partner-card:hover { border-color: var(--accent); box-shadow: 0 2px 12px rgba(0,120,255,0.1); }
.card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.company-name { font-weight: 600; font-size: 16px; }
.status-badge { font-size: 11px; padding: 2px 8px; border-radius: 10px; font-weight: 500; }
.status-badge.active { background: rgba(0,180,42,0.15); color: #00b42a; }
.status-badge.inactive { background: rgba(134,144,156,0.15); color: #86909c; }
.status-badge.blacklisted { background: rgba(245,63,63,0.15); color: #f53f3f; }

.info-row { display: flex; gap: 8px; margin-bottom: 6px; font-size: 13px; }
.info-row .label { color: var(--text-secondary); min-width: 60px; }
.quality-badge { padding: 1px 6px; border-radius: 4px; font-weight: 600; font-size: 12px; }
.grade-a { background: rgba(0,180,42,0.15); color: #00b42a; }
.grade-b { background: rgba(0,120,255,0.15); color: #0078ff; }
.grade-c { background: rgba(255,125,0,0.15); color: #ff7d00; }

.card-footer { display: flex; gap: 8px; align-items: center; margin-top: 12px; flex-wrap: wrap; }
.tag { font-size: 12px; color: var(--text-secondary); background: var(--mgmt-divider); padding: 2px 8px; border-radius: 10px; }
.last-contact { font-size: 11px; color: var(--text-secondary); margin-left: auto; }

.empty-state { text-align: center; padding: 60px 20px; }
.empty-icon { font-size: 48px; margin-bottom: 16px; }
.empty-state h3 { margin: 0 0 8px; }
.empty-state p { color: var(--text-secondary); font-size: 14px; }

/* Modal */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 20px; }
.modal-content { background: var(--mgmt-card-bg); border-radius: 16px; padding: 24px; width: 100%; max-width: 520px; max-height: 85vh; overflow-y: auto; }
.modal-content h2 { margin: 0 0 16px; font-size: 18px; }
.modal-sm { max-width: 420px; }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.form-group { display: flex; flex-direction: column; gap: 4px; }
.form-group.full-width { grid-column: 1 / -1; }
.form-group label { font-size: 13px; font-weight: 500; color: var(--text-secondary); }
.form-group input, .form-group textarea, .form-group select { padding: 8px 12px; border: 1px solid var(--mgmt-divider); border-radius: 8px; background: var(--bg-primary); color: var(--text-primary); font-size: 14px; }
.modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 20px; }

/* Buttons */
.btn { padding: 8px 16px; border-radius: 8px; border: none; cursor: pointer; font-size: 14px; font-weight: 500; transition: all 0.2s; }
.btn-primary { background: var(--accent); color: #fff; }
.btn-primary:hover { opacity: 0.9; }
.btn-secondary { background: var(--mgmt-divider); color: var(--text-primary); }
.btn-secondary:hover { background: var(--mgmt-divider); opacity: 0.8; }
.btn-danger { background: rgba(245,63,63,0.15); color: #f53f3f; }
.btn-ai { background: rgba(102,60,255,0.15); color: #663cff; }
.btn-sm { padding: 4px 10px; font-size: 12px; }
.btn-close { background: none; font-size: 18px; color: var(--text-secondary); }

/* Detail Panel */
.detail-panel { background: var(--mgmt-card-bg); border-radius: 16px; padding: 24px; width: 100%; max-width: 680px; max-height: 85vh; overflow-y: auto; }
.detail-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.detail-header h2 { margin: 0; font-size: 20px; }
.detail-actions { display: flex; gap: 8px; }
.detail-section { margin-bottom: 24px; }
.detail-section h3 { font-size: 16px; margin: 0 0 12px; display: flex; align-items: center; gap: 8px; }
.info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 14px; }

.order-list, .message-list { display: flex; flex-direction: column; gap: 8px; }
.order-item { padding: 10px 12px; background: var(--bg-primary); border-radius: 8px; border: 1px solid var(--mgmt-divider); }
.order-top { display: flex; justify-content: space-between; margin-bottom: 4px; }
.order-no { font-weight: 600; font-size: 13px; }
.order-status { font-size: 11px; padding: 2px 6px; border-radius: 6px; }
.order-status.pending { background: rgba(255,125,0,0.15); color: #ff7d00; }
.order-status.confirmed { background: rgba(0,120,255,0.15); color: #0078ff; }
.order-status.producing { background: rgba(0,180,42,0.15); color: #00b42a; }
.order-status.shipped { background: rgba(0,120,255,0.15); color: #0078ff; }
.order-status.completed { background: rgba(0,180,42,0.2); color: #00b42a; }
.order-info { font-size: 13px; color: var(--text-secondary); }
.order-date { font-size: 12px; color: var(--text-secondary); margin-top: 4px; }

.message-item { padding: 10px 12px; border-radius: 8px; max-width: 85%; }
.message-item.inbound { background: var(--bg-primary); align-self: flex-start; }
.message-item.outbound { background: rgba(0,120,255,0.08); align-self: flex-end; }
.msg-content { font-size: 14px; line-height: 1.5; }
.msg-meta { display: flex; gap: 8px; font-size: 11px; color: var(--text-secondary); margin-top: 4px; }

.empty-hint { text-align: center; color: var(--text-secondary); padding: 16px; font-size: 13px; }

.config-hint { font-size: 13px; color: var(--text-secondary); line-height: 1.6; margin-bottom: 16px; background: rgba(0,120,255,0.05); padding: 12px; border-radius: 8px; }
.config-hint a { color: var(--accent); }
/* Guide Modal */
.modal-guide { max-width: 680px; max-height: 80vh; overflow-y: auto; }
.guide-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 1px solid var(--border-color); }
.guide-header h2 { margin: 0; font-size: 18px; }
.guide-body { font-size: 14px; line-height: 1.7; color: var(--text-primary); }
.guide-step { margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px dashed var(--border-color); }
.guide-step:last-child { border-bottom: none; }
.guide-step h3 { font-size: 15px; margin-bottom: 8px; color: var(--accent); }
.guide-step p { margin: 4px 0; }
.guide-step ul { margin: 8px 0; padding-left: 20px; }
.guide-step li { margin: 4px 0; }
.guide-note { font-size: 13px; color: var(--text-secondary); background: rgba(255,193,7,0.1); padding: 8px 12px; border-radius: 6px; border-left: 3px solid #ffc107; }
.guide-faq { margin-top: 24px; padding-top: 16px; border-top: 2px solid var(--border-color); }
.guide-faq h3 { font-size: 16px; margin-bottom: 12px; }
.faq-item { margin-bottom: 14px; padding: 10px 12px; background: rgba(0,120,255,0.03); border-radius: 8px; }
.faq-item strong { display: block; margin-bottom: 4px; }
.faq-item p { margin: 0; font-size: 13px; color: var(--text-secondary); }
.btn-link { background: none; border: none; cursor: pointer; }

.test-result { margin-top: 12px; padding: 8px 12px; border-radius: 8px; font-size: 13px; }
.test-result.success { background: rgba(0,180,42,0.1); color: #00b42a; }
.test-result.error { background: rgba(245,63,63,0.1); color: #f53f3f; }

@media (max-width: 768px) {
  .partner-grid { grid-template-columns: 1fr; }
  .form-grid { grid-template-columns: 1fr; }
  .form-group.full-width { grid-column: auto; }
  .info-grid { grid-template-columns: 1fr; }
}
</style>
