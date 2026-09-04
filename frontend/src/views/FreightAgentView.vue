<template>
  <div class="freight-agent-page">
    <div class="page-header">
      <div class="header-left">
        <h1>🚢 货代对接</h1>
        <span class="subtitle">管理货代合作伙伴、询价订舱与物流跟踪</span>
      </div>
      <div class="header-actions">
        <button class="btn btn-secondary" @click="showWecomConfig = true" v-if="!wecomConfigured">
          ⚙️ 配置企微
        </button>
        <button class="btn btn-secondary" @click="syncContacts" v-if="wecomConfigured" :disabled="syncing">
          🔄 {{ syncing ? '同步中...' : '同步企微联系人' }}
        </button>
        <button class="btn btn-primary" @click="openAddModal()">+ 添加货代</button>
      </div>
    </div>

    <!-- Stats -->
    <div class="stats-row" v-if="stats">
      <div class="stat-card">
        <div class="stat-value">{{ stats.freightCount }}</div>
        <div class="stat-label">合作货代</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.activeShipments }}</div>
        <div class="stat-label">进行中运输单</div>
      </div>
      <div class="stat-card highlight">
        <div class="stat-value">{{ partners.length }}</div>
        <div class="stat-label">总货代数</div>
      </div>
    </div>

    <!-- Search & Filter -->
    <div class="filter-bar">
      <input v-model="searchQuery" placeholder="搜索货代名称、航线..." class="search-input" @input="fetchPartners" />
      <select v-model="statusFilter" @change="fetchPartners" class="filter-select">
        <option value="">全部状态</option>
        <option value="active">合作中</option>
        <option value="inactive">已停用</option>
        <option value="blacklisted">黑名单</option>
      </select>
    </div>

    <!-- Partner Grid -->
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
          <div class="info-row" v-if="partner.routes">
            <span class="label">优势航线</span>
            <span class="route-tags">{{ partner.routes }}</span>
          </div>
          <div class="info-row" v-if="partner.serviceTypes">
            <span class="label">服务类型</span>
            <div class="service-tags">
              <span v-for="s in parseServiceTypes(partner.serviceTypes)" :key="s" class="service-tag">{{ s }}</span>
            </div>
          </div>
          <div class="card-footer">
            <span class="tag">📦 {{ partner._count?.shipments || 0 }} 运输单</span>
            <span class="tag">💬 {{ partner._count?.messages || 0 }} 消息</span>
            <span class="last-contact" v-if="partner.lastContactAt">最近: {{ formatDate(partner.lastContactAt) }}</span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="partners.length === 0 && !loading" class="empty-state">
      <div class="empty-icon">🚢</div>
      <h3>还没有货代合作伙伴</h3>
      <p>点击「添加货代」手动添加，或配置企业微信后自动同步外部联系人</p>
    </div>

    <!-- Add/Edit Modal -->
    <div v-if="showAddModal" class="modal-overlay" @click.self="showAddModal = false">
      <div class="modal-content">
        <h2>{{ editingPartner ? '编辑货代' : '添加货代' }}</h2>
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
              <label>优势航线</label>
              <input v-model="form.routes" placeholder="如: SHANGHAI-LAX/LGB, NINGBO-SEA" />
            </div>
            <div class="form-group full-width">
              <label>服务类型（逗号分隔）</label>
              <input v-model="form.serviceTypes" placeholder="如: FCL,LCL,AIR,EXPRESS" />
            </div>
            <div class="form-group">
              <label>船司/渠道偏好</label>
              <input v-model="form.carrierPref" placeholder="如: MSK, MSC, COSCO" />
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
          <h2>🚢 {{ selectedPartner.companyName }}</h2>
          <div class="detail-actions">
            <button class="btn btn-sm btn-secondary" @click="editPartner(selectedPartner)">编辑</button>
            <button class="btn btn-sm btn-danger" @click="deletePartner(selectedPartner.id)">删除</button>
            <button class="btn btn-sm btn-close" @click="selectedPartner = null">✕</button>
          </div>
        </div>

        <div class="detail-body">
          <div class="detail-section">
            <h3>📋 基本信息</h3>
            <div class="info-grid">
              <div v-if="selectedPartner.contactName"><strong>联系人:</strong> {{ selectedPartner.contactName }}</div>
              <div v-if="selectedPartner.phone"><strong>电话:</strong> {{ selectedPartner.phone }}</div>
              <div v-if="selectedPartner.email"><strong>邮箱:</strong> {{ selectedPartner.email }}</div>
              <div v-if="selectedPartner.address"><strong>地址:</strong> {{ selectedPartner.address }}</div>
              <div v-if="selectedPartner.routes"><strong>航线:</strong> {{ selectedPartner.routes }}</div>
              <div v-if="selectedPartner.carrierPref"><strong>船司:</strong> {{ selectedPartner.carrierPref }}</div>
            </div>
          </div>

          <!-- Shipments -->
          <div class="detail-section">
            <h3>📦 运输记录 <button class="btn btn-sm btn-primary" @click="showShipmentModal = true">+ 新增运输单</button></h3>
            <div class="shipment-timeline">
              <div v-for="ship in selectedPartner.shipments" :key="ship.id" class="shipment-item">
                <div class="shipment-top">
                  <span class="ship-type" :class="ship.type">{{ ship.type }}</span>
                  <span class="ship-no">{{ ship.shipmentNo || '无运单号' }}</span>
                  <span class="ship-status" :class="ship.status">{{ shipmentStatusText(ship.status) }}</span>
                </div>
                <div class="shipment-route">
                  <span class="origin">{{ ship.origin || '?' }}</span>
                  <span class="route-arrow">→</span>
                  <span class="dest">{{ ship.destination || '?' }}</span>
                </div>
                <div class="shipment-meta" v-if="ship.cargoDesc || ship.containers">
                  {{ [ship.cargoDesc, ship.containers, ship.weight ? ship.weight + 'kg' : '', ship.volume ? ship.volume + 'CBM' : ''].filter(Boolean).join(' | ') }}
                </div>
                <div class="shipment-dates" v-if="ship.etd || ship.eta">
                  <span v-if="ship.etd">开: {{ formatDate(ship.etd) }}</span>
                  <span v-if="ship.eta">到: {{ formatDate(ship.eta) }}</span>
                </div>
              </div>
              <div v-if="!selectedPartner.shipments?.length" class="empty-hint">暂无运输记录</div>
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

    <!-- Shipment Modal -->
    <div v-if="showShipmentModal" class="modal-overlay" @click.self="showShipmentModal = false">
      <div class="modal-content">
        <h2>新增运输单</h2>
        <form @submit.prevent="createShipment">
          <div class="form-grid">
            <div class="form-group"><label>运单号</label><input v-model="shipForm.shipmentNo" /></div>
            <div class="form-group">
              <label>运输方式</label>
              <select v-model="shipForm.type">
                <option value="FCL">整柜 FCL</option>
                <option value="LCL">拼箱 LCL</option>
                <option value="AIR">空运 AIR</option>
                <option value="EXPRESS">快递 EXPRESS</option>
              </select>
            </div>
            <div class="form-group"><label>起运港/地</label><input v-model="shipForm.origin" placeholder="如: SHANGHAI" /></div>
            <div class="form-group"><label>目的港/地</label><input v-model="shipForm.destination" placeholder="如: LOS ANGELES" /></div>
            <div class="form-group full-width"><label>货物描述</label><input v-model="shipForm.cargoDesc" /></div>
            <div class="form-group"><label>重量(kg)</label><input v-model="shipForm.weight" /></div>
            <div class="form-group"><label>体积(CBM)</label><input v-model="shipForm.volume" /></div>
            <div class="form-group"><label>柜型柜量</label><input v-model="shipForm.containers" placeholder="如: 1x40HQ" /></div>
            <div class="form-group"><label>运费</label><input v-model="shipForm.freightCost" type="number" step="0.01" /></div>
            <div class="form-group"><label>预计开船/起飞</label><input v-model="shipForm.etd" type="date" /></div>
            <div class="form-group"><label>预计到港/到达</label><input v-model="shipForm.eta" type="date" /></div>
            <div class="form-group full-width"><label>备注</label><textarea v-model="shipForm.notes" rows="2"></textarea></div>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn btn-secondary" @click="showShipmentModal = false">取消</button>
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
          <div class="quick-actions">
            <button type="button" class="quick-btn" @click="setQuickMessage('quote')">询价模板</button>
            <button type="button" class="quick-btn" @click="setQuickMessage('track')">物流跟踪</button>
            <button type="button" class="quick-btn" @click="setQuickMessage('booking')">订舱模板</button>
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
import { ref, onMounted } from 'vue';

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
const showShipmentModal = ref(false);
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
const shipForm = ref({});

onMounted(async () => {
  await fetchPartners();
  await fetchStats();
  await loadWecomConfig();
});

async function fetchPartners() {
  loading.value = true;
  try {
    const params = new URLSearchParams({ type: 'freight' });
    if (searchQuery.value) params.set('search', searchQuery.value);
    if (statusFilter.value) params.set('status', statusFilter.value);
    partners.value = await api.get(`/partners?${params}`);
  } catch(e) { console.error(e); }
  loading.value = false;
}

async function fetchStats() {
  try { stats.value = await api.get('/partners/stats/overview'); } catch(e) {}
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
  } catch(e) { testResult.value = { success: false, message: e.message }; }
  testing.value = false;
}

async function syncContacts() {
  syncing.value = true;
  try {
    const result = await api.post('/wecom/sync-contacts');
    if (result.success) {
      await fetchPartners();
      alert(result.message);
    } else { alert('同步失败: ' + result.error); }
  } catch(e) { alert('同步失败: ' + e.message); }
  syncing.value = false;
}

function openAddModal() {
  editingPartner.value = null;
  form.value = {};
  showAddModal.value = true;
}

function editPartner(partner) {
  editingPartner.value = partner;
  form.value = { ...partner };
  showAddModal.value = true;
}

async function savePartner() {
  try {
    if (editingPartner.value) {
      await api.put(`/partners/${editingPartner.value.id}`, { ...form.value, type: 'freight' });
    } else {
      await api.post('/partners', { ...form.value, type: 'freight' });
    }
    showAddModal.value = false;
    editingPartner.value = null;
    form.value = {};
    await fetchPartners();
    await fetchStats();
  } catch(e) { alert('保存失败'); }
}

async function deletePartner(id) {
  if (!confirm('确定删除此货代？')) return;
  await api.delete(`/partners/${id}`);
  selectedPartner.value = null;
  await fetchPartners();
  await fetchStats();
}

function openDetail(partner) { selectedPartner.value = partner; }

async function createShipment() {
  if (!selectedPartner.value) return;
  await api.post(`/partners/${selectedPartner.value.id}/shipments`, shipForm.value);
  showShipmentModal.value = false;
  shipForm.value = {};
  const updated = await api.get(`/partners/${selectedPartner.value.id}`);
  selectedPartner.value = updated;
  await fetchStats();
}

async function sendMessage() {
  if (!selectedPartner.value || !messageContent.value) return;
  await api.post('/wecom/send-message', {
    partnerId: selectedPartner.value.id,
    content: messageContent.value,
  });
  showMessageModal.value = false;
  messageContent.value = '';
  const updated = await api.get(`/partners/${selectedPartner.value.id}`);
  selectedPartner.value = updated;
}

function setQuickMessage(type) {
  const name = selectedPartner.value?.companyName || '';
  const templates = {
    quote: `您好，请问以下货物从深圳到洛杉矶的运费是多少？\n货物：玻璃制品\n重量：约500kg\n体积：2CBM\n运输方式：海运拼箱\n请告知报价及预计船期，谢谢！`,
    track: `您好，请问之前委托的货物运输到哪了？麻烦提供一下最新的物流状态和预计到港时间，谢谢！`,
    booking: `您好，我需要订一个40HQ整柜，从上海到汉堡。\n货物：玻璃制品\n重量：约20吨\n预计装柜日期：下周\n请确认舱位及价格，谢谢！`,
  };
  messageContent.value = templates[type] || '';
}

async function generateMessage() {
  generating.value = true;
  try {
    const resp = await api.post('/ai/chat', {
      messages: [{ role: 'user', content: `帮我给货代"${selectedPartner.value?.companyName}"写一条询价消息，货物是玻璃制品，从深圳到美国西海岸，大约2CBM。语气专业简洁。` }],
    });
    messageContent.value = resp.choices?.[0]?.message?.content || resp.content || '生成失败';
  } catch(e) {
    messageContent.value = 'AI生成失败，请手动编写';
  }
  generating.value = false;
}

function parseServiceTypes(s) {
  if (!s) return [];
  try { return JSON.parse(s); } catch { return s.split(',').map(x => x.trim()).filter(Boolean); }
}

function statusText(s) { return { active: '合作中', inactive: '已停用', blacklisted: '黑名单' }[s] || s; }

function shipmentStatusText(s) {
  return { inquiring:'询价中', quoting:'已报价', booked:'已订舱', departed:'已出发', transit:'运输中', arrived:'已到达', delivered:'已送达' }[s] || s;
}

function formatDate(d) { return d ? new Date(d).toLocaleDateString('zh-CN') : '-'; }
</script>

<style scoped>
.freight-agent-page { padding: 24px; max-width: 1200px; width: 100%; margin: 0 auto; box-sizing: border-box; }
.page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; flex-wrap: wrap; gap: 12px; }
.header-left h1 { font-size: 24px; margin: 0; }
.subtitle { color: var(--text-secondary); font-size: 14px; }
.header-actions { display: flex; gap: 8px; flex-wrap: wrap; }

.stats-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 24px; }
.stat-card { background: var(--mgmt-card-bg); border: 1px solid var(--mgmt-divider); border-radius: 12px; padding: 16px; text-align: center; }
.stat-card.highlight { border-color: var(--accent); }
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
.route-tags { font-size: 12px; color: var(--accent); }
.service-tags { display: flex; gap: 4px; flex-wrap: wrap; }
.service-tag { font-size: 11px; padding: 1px 6px; border-radius: 4px; background: rgba(0,120,255,0.1); color: #0078ff; }

.card-footer { display: flex; gap: 8px; align-items: center; margin-top: 12px; flex-wrap: wrap; }
.tag { font-size: 12px; color: var(--text-secondary); background: var(--mgmt-divider); padding: 2px 8px; border-radius: 10px; }
.last-contact { font-size: 11px; color: var(--text-secondary); margin-left: auto; }

.empty-state { text-align: center; padding: 60px 20px; }
.empty-icon { font-size: 48px; margin-bottom: 16px; }
.empty-state h3 { margin: 0 0 8px; }
.empty-state p { color: var(--text-secondary); font-size: 14px; }

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

.btn { padding: 8px 16px; border-radius: 8px; border: none; cursor: pointer; font-size: 14px; font-weight: 500; transition: all 0.2s; }
.btn-primary { background: var(--accent); color: #fff; }
.btn-primary:hover { opacity: 0.9; }
.btn-secondary { background: var(--mgmt-divider); color: var(--text-primary); }
.btn-danger { background: rgba(245,63,63,0.15); color: #f53f3f; }
.btn-ai { background: rgba(102,60,255,0.15); color: #663cff; }
.btn-sm { padding: 4px 10px; font-size: 12px; }
.btn-close { background: none; font-size: 18px; color: var(--text-secondary); }

.detail-panel { background: var(--mgmt-card-bg); border-radius: 16px; padding: 24px; width: 100%; max-width: 680px; max-height: 85vh; overflow-y: auto; }
.detail-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.detail-header h2 { margin: 0; font-size: 20px; }
.detail-actions { display: flex; gap: 8px; }
.detail-section { margin-bottom: 24px; }
.detail-section h3 { font-size: 16px; margin: 0 0 12px; display: flex; align-items: center; gap: 8px; }
.info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 14px; }

.shipment-timeline { display: flex; flex-direction: column; gap: 10px; }
.shipment-item { padding: 12px; background: var(--bg-primary); border-radius: 10px; border: 1px solid var(--mgmt-divider); }
.shipment-top { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.ship-type { font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 6px; background: rgba(0,120,255,0.1); color: #0078ff; }
.ship-type.AIR { background: rgba(255,125,0,0.1); color: #ff7d00; }
.ship-type.EXPRESS { background: rgba(102,60,255,0.1); color: #663cff; }
.ship-no { font-weight: 600; font-size: 13px; flex: 1; }
.ship-status { font-size: 11px; padding: 2px 8px; border-radius: 6px; }
.ship-status.inquiring { background: rgba(134,144,156,0.15); color: #86909c; }
.ship-status.booked { background: rgba(0,120,255,0.15); color: #0078ff; }
.ship-status.transit { background: rgba(255,125,0,0.15); color: #ff7d00; }
.ship-status.arrived, .ship-status.delivered { background: rgba(0,180,42,0.15); color: #00b42a; }

.shipment-route { font-size: 15px; font-weight: 600; margin-bottom: 4px; }
.route-arrow { color: var(--accent); margin: 0 6px; }
.shipment-meta { font-size: 13px; color: var(--text-secondary); }
.shipment-dates { font-size: 12px; color: var(--text-secondary); margin-top: 6px; display: flex; gap: 12px; }

.message-list { display: flex; flex-direction: column; gap: 8px; }
.message-item { padding: 10px 12px; border-radius: 8px; max-width: 85%; }
.message-item.inbound { background: var(--bg-primary); align-self: flex-start; }
.message-item.outbound { background: rgba(0,120,255,0.08); align-self: flex-end; }
.msg-content { font-size: 14px; line-height: 1.5; }
.msg-meta { display: flex; gap: 8px; font-size: 11px; color: var(--text-secondary); margin-top: 4px; }
.empty-hint { text-align: center; color: var(--text-secondary); padding: 16px; font-size: 13px; }

.quick-actions { display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap; }
.quick-btn { font-size: 12px; padding: 4px 10px; border-radius: 6px; border: 1px solid var(--mgmt-divider); background: var(--bg-primary); color: var(--text-secondary); cursor: pointer; }
.quick-btn:hover { border-color: var(--accent); color: var(--accent); }

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
/* ===== 亮色主题适配 ===== */
[data-theme='light'] .page-container,
[data-theme='light'] .report-page,
[data-theme='light'] .legal-page,
[data-theme='light'] .customs-page,
[data-theme='light'] .freight-page {
  background: var(--mgmt-bg, #f5f7fa);
  color: var(--mgmt-text, #303133);
}
[data-theme='light'] .page-container *,
[data-theme='light'] .report-page *,
[data-theme='light'] .legal-page *,
[data-theme='light'] .customs-page *,
[data-theme='light'] .freight-page * {
  --text-color: var(--mgmt-text, #303133);
}
</style>
