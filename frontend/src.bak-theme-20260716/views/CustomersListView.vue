<template>
  <div class="cust-list-page">
    <!-- 顶部栏 -->
    <div class="cust-header">
      <h2 class="page-title">👥 客户管理</h2>
      <div class="spacer"></div>
      <button class="hdr-btn add-btn" @click="showAddDialog = true">
        <span style="margin-right:4px">➕</span><span class="btn-text">添加</span>
      </button>
    </div>

    <!-- KPI 统计条 -->
    <div class="kpi-bar">
      <div class="kpi-item" @click="switchTab('all')" :class="{active: activeTab==='all'}">
        <span class="kpi-num">{{ stats.total || 0 }}</span>
        <span class="kpi-label">全部</span>
      </div>
      <div class="kpi-item" @click="filterByLevel('A')" :class="{active: filters.level==='A'}">
        <span class="kpi-num" style="color:#00d9a8">{{ aCount }}</span>
        <span class="kpi-label">⭐A</span>
      </div>
      <div class="kpi-item" @click="filterByLevel('B')" :class="{active: filters.level==='B'}">
        <span class="kpi-num" style="color:#4FC3F7">{{ bCount }}</span>
        <span class="kpi-label">B</span>
      </div>
      <div class="kpi-item" @click="filterByLevel('C')" :class="{active: filters.level==='C'}">
        <span class="kpi-num" style="color:#8696a0">{{ cCount }}</span>
        <span class="kpi-label">C</span>
      </div>
      <div class="kpi-item" @click="filterByStatus('potential')" :class="{active: filters.status==='potential'}">
        <span class="kpi-num" style="color:#f87171">{{ stats.pending || 0 }}</span>
        <span class="kpi-label">待跟进</span>
      </div>
    </div>

    <!-- 搜索栏 -->
    <div class="search-bar">
      <div class="search-input-wrap">
        <span class="search-icon">🔍</span>
        <input class="search-input" v-model="searchInput" placeholder="搜索公司/联系人/电话/邮箱"
               @keyup.enter="onSearch" @input="onSearchInput" />
        <button v-if="searchInput" class="search-clear" @click="clearSearch">✕</button>
      </div>
    </div>

    <!-- 快捷筛选胶囊 -->
    <div class="chip-bar">
      <button class="chip" :class="{active: activeTab==='all' && !filters.level && !filters.status}" @click="switchTab('all')">全部</button>
      <button class="chip" :class="{active: filters.status==='active'}" @click="filterByStatus('active')">🔥 活跃</button>
      <button class="chip" :class="{active: filters.status==='following'}" @click="filterByStatus('following')">📞 跟进中</button>
      <button class="chip" :class="{active: activeTab==='recent'}" @click="switchTab('recent')">🕐 最近</button>
      <button class="chip" :class="{active: filters.status==='dormant'}" @click="filterByStatus('dormant')">💤 沉睡</button>
    </div>

    <!-- 客户卡片列表 -->
    <div class="list-area">
      <div v-if="loading" class="empty-state"><div class="loading">加载中...</div></div>
      <template v-else>
        <div v-if="!items.length" class="empty-state">
          <div style="font-size:48px;opacity:0.3">👥</div>
          <div class="empty-desc">还没有客户</div>
          <button class="primary-btn" @click="showAddDialog = true" style="margin-top:12px">➕ 添加第一个客户</button>
        </div>
        <div v-else class="card-list">
          <div v-for="c in items" :key="c.id" class="cust-card" @click="goDetail(c)">
            <div class="card-top">
              <div class="avatar" :style="{background: avatarColor(displayName(c))}">
                <template v-if="isPhoneNumber(displayName(c))">📱</template>
                <template v-else>{{ (displayName(c) || '?')[0].toUpperCase() }}</template>
              </div>
              <div class="card-meta">
                <div class="card-name-row">
                  <span class="card-name">{{ displayName(c) }}</span>
                  <span class="level-tag" :class="'level-'+(c.customerLevel||'c').toLowerCase()">{{ (c.customerLevel||'C') }}级</span>
                </div>
                <div class="card-sub">
                  <span v-if="c.contactName" class="card-contact">{{ c.contactName }}</span>
                  <span class="card-country">{{ countryFlag(c) }} {{ displayCountry(c) }}</span>
                  <span v-if="c.industry" class="card-industry">🏭 {{ c.industry }}</span>
                  <span class="card-source">{{ sourceLabel(c.source || 'whatsapp') }}</span>
                  <span v-if="isUnfilled(c)" class="badge-unfilled">🆕待补充</span>
                </div>
              </div>
              <span class="status-tag" :class="'status-'+(c.status||'new')">{{ statusLabel(c.status) }}</span>
            </div>
            <div v-if="c._lastMessage" class="card-msg">
              <span v-if="c._lastMessageDir==='outbound'" class="msg-dir out">↗</span>
              <span v-else class="msg-dir in">↙</span>
              <span class="msg-text">{{ c._lastMessage }}</span>
            </div>
            <div v-else-if="c.requirementProducts" class="card-msg">
              <span style="margin-right:4px">🎯</span>
              <span class="msg-text">{{ c.requirementProducts }}</span>
            </div>
            <div class="card-bottom">
              <div class="card-left-info">
                <span v-if="c.jid || c.phone" class="card-phone">💬 {{ formatPhone(c.phone || c.jid) }}</span>
                <span class="card-time" v-if="c._lastMessageAt || c.lastContactAt">{{ relTime(c._lastMessageAt || c.lastContactAt) }}</span>
              </div>
              <div class="card-actions" @click.stop>
                <button v-if="c.jid" class="card-action-btn chat-btn" @click="jumpToChat(c)" title="去沟通">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
                  <span>沟通</span>
                </button>
                <button class="card-action-btn" @click="goDetail(c)" title="详情">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
                </button>
              </div>
            </div>
            <div v-if="c._docCount>0 || c._followUpCount>0" class="card-badges">
              <span v-if="c._docCount>0" class="badge-doc">📄 {{ c._docCount }}</span>
              <span v-if="c._followUpCount>0" class="badge-follow">📝 {{ c._followUpCount }}</span>
            </div>
          </div>
        </div>
        <!-- 分页 -->
        <div v-if="total > pageSize" class="pager">
          <button class="page-btn" :disabled="page<=1" @click="onPageChange(page-1)">‹</button>
          <span class="page-info">{{ page }} / {{ Math.ceil(total/pageSize) }}</span>
          <button class="page-btn" :disabled="page>=Math.ceil(total/pageSize)" @click="onPageChange(page+1)">›</button>
          <span class="pager-total">共{{ total }}条</span>
        </div>
      </template>
    </div>

    <!-- Add Customer Dialog -->
    <el-dialog v-model="showAddDialog" title="添加新客户" width="92%" class="cust-dialog" :append-to-body="true" :close-on-click-modal="false">
      <el-form :model="addForm" label-width="80px" label-position="top">
        <el-form-item label="公司名称*">
          <el-input v-model="addForm.companyName" placeholder="客户公司名（必填）" />
        </el-form-item>
        <div class="form-row-2">
          <el-form-item label="联系人">
            <el-input v-model="addForm.contactName" placeholder="姓名" />
          </el-form-item>
          <el-form-item label="职位">
            <el-input v-model="addForm.title" placeholder="职位" />
          </el-form-item>
        </div>
        <div class="form-row-2">
          <el-form-item label="国家">
            <el-input v-model="addForm.country" placeholder="如 UAE / USA" />
          </el-form-item>
          <el-form-item label="等级">
            <el-select v-model="addForm.customerLevel" style="width:100%">
              <el-option label="A级 重点客户" value="A" />
              <el-option label="B级 普通客户" value="B" />
              <el-option label="C级 潜在客户" value="C" />
            </el-select>
          </el-form-item>
        </div>
        <el-form-item label="邮箱">
          <el-input v-model="addForm.email" placeholder="name@company.com" />
        </el-form-item>
        <el-form-item label="电话/WhatsApp">
          <el-input v-model="addForm.phone" placeholder="如 97150xxxxxxx" />
        </el-form-item>
        <el-form-item label="来源">
          <el-select v-model="addForm.source" style="width:100%">
            <el-option label="WhatsApp" value="whatsapp" />
            <el-option label="展会" value="展会" />
            <el-option label="独立站询盘" value="独立站询盘" />
            <el-option label="主动开发" value="主动开发" />
            <el-option label="客户介绍" value="老客户推荐" />
            <el-option label="手动添加" value="manual" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="addForm.notes" type="textarea" :rows="2" placeholder="备注" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddDialog=false">取消</el-button>
        <el-button type="primary" :loading="adding" @click="doAdd">添加</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import api from '../utils/api.js';

const router = useRouter();
const loading = ref(false);
const items = ref([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const stats = ref({});
const searchInput = ref('');
let searchTimer = null;
const activeTab = ref('all');
const filters = reactive({ level: null, status: null });
const showAddDialog = ref(false);
const adding = ref(false);
const addForm = reactive({ companyName:'', contactName:'', title:'', country:'', email:'', phone:'', website:'', source:'manual', customerLevel:'C', notes:'' });

const aCount = computed(() => stats.value.aLevel || items.value.filter(c=>c.customerLevel==='A').length);
const bCount = computed(() => stats.value.bLevel || items.value.filter(c=>c.customerLevel==='B').length);
const cCount = computed(() => stats.value.cLevel || items.value.filter(c=>c.customerLevel==='C' || !c.customerLevel).length);

function isPhoneNumber(s) {
  return !!s && /^[0-9+\-\s@.swhatsappne]+$/.test(String(s).replace(/@s\.whatsapp\.net$/,'')) && /\d{6,}/.test(String(s));
}
function isUnfilled(c) {
  return !c.companyName && !c.contactName && !c.country && !c.industry;
}
function extractPhone(raw) {
  if (!raw) return '';
  const s = String(raw).replace(/@s\.whatsapp\.net$/, '').replace(/\D/g, '');
  return s;
}
// 手机号国家码前缀映射（按长度从长到短匹配）
const PHONE_CC = [
  ['971','UAE','🇦🇪'],['966','Saudi','🇸🇦'],['968','Oman','🇴🇲'],['974','Qatar','🇶🇦'],['973','Bahrain','🇧🇭'],
  ['965','Kuwait','🇰🇼'],['962','Jordan','🇯🇴'],['961','Lebanon','🇱🇧'],['964','Iraq','🇮🇶'],['963','Syria','🇸🇾'],
  ['967','Yemen','🇾🇪'],['20','Egypt','🇪🇬'],['212','Morocco','🇲🇦'],['213','Algeria','🇩🇿'],['216','Tunisia','🇹🇳'],
  ['218','Libya','🇱🇾'],['234','Nigeria','🇳🇬'],['27','South Africa','🇿🇦'],['254','Kenya','🇰🇪'],['255','Tanzania','🇹🇿'],
  ['256','Uganda','🇺🇬'],['251','Ethiopia','🇪🇹'],['233','Ghana','🇬🇭'],['237','Cameroon','🇨🇲'],['225','Ivory Coast','🇨🇮'],
  ['44','UK','🇬🇧'],['49','Germany','🇩🇪'],['33','France','🇫🇷'],['39','Italy','🇮🇹'],['34','Spain','🇪🇸'],
  ['31','Netherlands','🇳🇱'],['32','Belgium','🇧🇪'],['41','Switzerland','🇨🇭'],['46','Sweden','🇸🇪'],['47','Norway','🇳🇴'],
  ['45','Denmark','🇩🇰'],['48','Poland','🇵🇱'],['43','Austria','🇦🇹'],['30','Greece','🇬🇷'],['351','Portugal','🇵🇹'],
  ['353','Ireland','🇮🇪'],['358','Finland','🇫🇮'],
  ['7','Russia','🇷🇺'],['90','Turkey','🇹🇷'],['972','Israel','🇮🇱'],['98','Iran','🇮🇷'],
  ['91','India','🇮🇳'],['92','Pakistan','🇵🇰'],['880','Bangladesh','🇧🇩'],['94','Sri Lanka','🇱🇰'],
  ['95','Myanmar','🇲🇲'],['66','Thailand','🇹🇭'],['84','Vietnam','🇻🇳'],['60','Malaysia','🇲🇾'],['62','Indonesia','🇮🇩'],
  ['63','Philippines','🇵🇭'],['65','Singapore','🇸🇬'],
  ['86','China','🇨🇳'],['81','Japan','🇯🇵'],['82','Korea','🇰🇷'],['852','Hong Kong','🇭🇰'],['886','Taiwan','🇹🇼'],
  ['55','Brazil','🇧🇷'],['54','Argentina','🇦🇷'],['52','Mexico','🇲🇽'],['56','Chile','🇨🇱'],['57','Colombia','🇨🇴'],
  ['51','Peru','🇵🇪'],['61','Australia','🇦🇺'],['64','New Zealand','🇳🇿'],
];
function phoneToCountry(phone) {
  const digits = extractPhone(phone);
  if (!digits) return null;
  let d = digits;
  if (d.startsWith('00')) d = d.slice(2);
  for (const [cc, name, flag] of PHONE_CC) {
    if (d.startsWith(cc) && d.length > cc.length) return { name, flag, cc: '+'+cc };
  }
  if (d.startsWith('1') && d.length === 11) return { name:'USA/Canada', flag:'🇺🇸', cc:'+1' };
  return null;
}
function displayCountry(c) {
  if (c.country) return c.country;
  const pc = phoneToCountry(c.jid || c.phone);
  return pc ? pc.name : '未知';
}
function avatarColor(name) {
if (!name) return '#00a884';
  const palette = ['#00a884','#4FC3F7','#AB47BC','#FF7043','#66BB6A','#FFA726','#EC407A','#26A69A','#EF5350','#5C6BC0'];
  let hash = 0;
  for (let i=0;i<name.length;i++) hash = name.charCodeAt(i) + ((hash<<5) - hash);
  return palette[Math.abs(hash) % palette.length];
}

function displayName(c) {
  return c.companyName || c.contactName || c.name || '(未命名)';
}
function formatPhone(p) {
  if (!p) return '';
  let s = String(p).replace(/@s\.whatsapp\.net$/, '');
  const pc = phoneToCountry(s);
  const digits = extractPhone(s);
  if (pc && digits) {
    const rest = digits.slice(pc.cc.length);
    return pc.cc + ' ' + rest;
  }
  return s;
}
function statusLabel(s) {
  return ({active:'活跃',following:'跟进中',dormant:'沉睡',potential:'待跟进',new:'新客'})[s] || '新客';
}
function sourceLabel(s) {
  return ({whatsapp:'💬WA', manual:'✏️手动', '展会':'🎪展会', '独立站询盘':'🌐询盘', '主动开发':'🔍主动开发', '老客户推荐':'🤝推荐'})[s] || s || '💬WA';
}
function countryFlag(c) {
  const country = typeof c === 'string' ? c : (c.country || '');
  if (country) {
    const map = {UAE:'🇦🇪','阿联酋':'🇦🇪','China':'🇨🇳','中国':'🇨🇳','USA':'🇺🇸','US':'🇺🇸','美国':'🇺🇸','UK':'🇬🇧','Britain':'🇬🇧','英国':'🇬🇧','India':'🇮🇳','印度':'🇮🇳','Saudi':'🇸🇦','沙特':'🇸🇦','Germany':'🇩🇪','德国':'🇩🇪','France':'🇫🇷','法国':'🇫🇷','Turkey':'🇹🇷','土耳其':'🇹🇷','Egypt':'🇪🇬','埃及':'🇪🇬','Brazil':'🇧🇷','巴西':'🇧🇷','Russia':'🇷🇺','俄罗斯':'🇷🇺','Japan':'🇯🇵','日本':'🇯🇵','Korea':'🇰🇷','韩国':'🇰🇷','Italy':'🇮🇹','意大利':'🇮🇹','Spain':'🇪🇸','西班牙':'🇪🇸','Mexico':'🇲🇽','墨西哥':'🇲🇽','Canada':'🇨🇦','加拿大':'🇨🇦','Australia':'🇦🇺','澳大利亚':'🇦🇺','Pakistan':'🇵🇰','巴基斯坦':'🇵🇰','Vietnam':'🇻🇳','越南':'🇻🇳','Thailand':'🇹🇭','泰国':'🇹🇭','Indonesia':'🇮🇩','印尼':'🇮🇩','Malaysia':'🇲🇾','马来西亚':'🇲🇾','Philippines':'🇵🇭','菲律宾':'🇵🇭','Iran':'🇮🇷','伊朗':'🇮🇷','Dubai':'🇦🇪','Nigeria':'🇳🇬','尼日利亚':'🇳🇬','South Africa':'🇿🇦','南非':'🇿🇦','Kenya':'🇰🇪','肯尼亚':'🇰🇪','Bangladesh':'🇧🇩','孟加拉':'🇧🇩','Iraq':'🇮🇶','伊拉克':'🇮🇶','Israel':'🇮🇱','以色列':'🇮🇱','Oman':'🇴🇲','阿曼':'🇴🇲','Qatar':'🇶🇦','卡塔尔':'🇶🇦','Kuwait':'🇰🇼','科威特':'🇰🇼','Hong Kong':'🇭🇰','香港':'🇭🇰','Singapore':'🇸🇬','新加坡':'🇸🇬'};
    for (const k in map) if (country.toLowerCase().includes(k.toLowerCase())) return map[k];
  }
  if (typeof c === 'object') {
    const pc = phoneToCountry(c.jid || c.phone);
    if (pc) return pc.flag;
  }
  return '🌍';
}

function relTime(iso) {
  if (!iso) return '';
  const d = new Date(iso); const now = new Date();
  const diff = (now - d) / 1000;
  if (isNaN(diff)) return '';
  if (diff < 60) return '刚刚';
  if (diff < 3600) return Math.floor(diff/60)+'分钟前';
  if (diff < 86400) return Math.floor(diff/3600)+'小时前';
  const days = Math.floor(diff/86400);
  if (days === 0) return '今天';
  if (days === 1) return '昨天';
  if (days < 7) return days+'天前';
  if (days < 30) return Math.floor(days/7)+'周前';
  return d.toISOString().slice(5,10);
}

async function reload(p) {
  if (p) page.value = p;
  loading.value = true;
  try {
    const params = { page: page.value, pageSize: pageSize.value };
    if (searchInput.value && searchInput.value.trim()) params.search = searchInput.value.trim();
    if (activeTab.value === 'A' || activeTab.value === 'B' || activeTab.value === 'C') params.level = activeTab.value;
    else if (activeTab.value === 'potential' || activeTab.value === 'active' || activeTab.value === 'following') params.status = activeTab.value;
    if (activeTab.value === 'recent') params.recent = '1';
    if (filters.level) params.level = filters.level;
    if (filters.status) params.status = filters.status;
    const qs = new URLSearchParams(params).toString();
    const { data } = await api.get('/customers?' + qs);
    items.value = data.items || [];
    total.value = data.total || 0;
    stats.value = data.stats || {};
  } catch (e) {
    console.error(e);
    ElMessage.error('加载客户列表失败');
  } finally {
    loading.value = false;
  }
}
function onPageChange(p) { reload(p); }
function switchTab(key) {
  activeTab.value = key;
  filters.level = null; filters.status = null;
  reload(1);
}
function filterByLevel(lv) {
  if (filters.level === lv) { filters.level = null; }
  else { filters.level = lv; filters.status = null; activeTab.value = 'all'; }
  reload(1);
}
function filterByStatus(st) {
  if (filters.status === st) { filters.status = null; }
  else { filters.status = st; filters.level = null; activeTab.value = 'all'; }
  reload(1);
}
function onSearch() { reload(1); }
function onSearchInput() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => reload(1), 400);
}
function clearSearch() { searchInput.value = ''; reload(1); }

function goDetail(c) { router.push(`/customers/${c.id}`); }
function jumpToChat(c) {
  if (!c.jid) { ElMessage.warning('该客户无WhatsApp号码'); return; }
  router.push('/chat');
  sessionStorage.setItem('wa-open-jid', c.jid);
}
async function doAdd() {
  if (!addForm.companyName.trim()) { ElMessage.warning('请填写公司名称'); return; }
  adding.value = true;
  try {
    await api.post('/customers', addForm);
    ElMessage.success('添加成功');
    showAddDialog.value = false;
    Object.assign(addForm, { companyName:'', contactName:'', title:'', country:'', email:'', phone:'', website:'', source:'manual', customerLevel:'C', notes:'' });
    reload();
  } catch (e) {
    ElMessage.error(e?.response?.data?.error || '添加失败');
  } finally { adding.value = false; }
}

onMounted(() => reload(1));
</script>

<style scoped>
.cust-list-page { flex:1; display:flex; flex-direction:column; background:#111b21; color:#e9edef; height:100%; min-width:0; overflow:hidden; }

.cust-header { display:flex; align-items:center; padding:12px 16px; background:#202c33; border-bottom:1px solid #222d34; gap:12px; flex-shrink:0; }
.page-title { margin:0; font-size:18px; font-weight:600; }
.spacer { flex:1; }
.hdr-btn { background:#00a884; border:none; color:#fff; padding:8px 14px; border-radius:8px; cursor:pointer; font-size:14px; display:flex; align-items:center; font-weight:500; }
.hdr-btn:active { background:#06cf9c; }
.add-btn { background:#00a884; }

.kpi-bar { display:flex; gap:8px; padding:10px 12px; overflow-x:auto; background:#111b21; border-bottom:1px solid #1a242b; flex-shrink:0; -webkit-overflow-scrolling:touch; }
.kpi-bar::-webkit-scrollbar { display:none; }
.kpi-item { flex-shrink:0; background:#202c33; padding:8px 12px; border-radius:10px; display:flex; flex-direction:column; align-items:center; min-width:60px; cursor:pointer; border:1px solid transparent; }
.kpi-item.active { border-color:#00a884; background:#1a3028; }
.kpi-num { font-size:18px; font-weight:700; color:#e9edef; line-height:1.2; }
.kpi-label { color:#8696a0; font-size:11px; margin-top:2px; }

.search-bar { padding:8px 12px; background:#111b21; flex-shrink:0; }
.search-input-wrap { display:flex; align-items:center; background:#202c33; border-radius:10px; padding:0 12px; }
.search-icon { font-size:14px; margin-right:8px; opacity:0.6; }
.search-input { flex:1; background:transparent; border:none; color:#e9edef; padding:10px 0; font-size:14px; outline:none; }
.search-input::placeholder { color:#54656f; }
.search-clear { background:transparent; border:none; color:#8696a0; font-size:14px; cursor:pointer; padding:4px 8px; }

.chip-bar { display:flex; gap:6px; padding:4px 12px 10px; overflow-x:auto; background:#111b21; flex-shrink:0; -webkit-overflow-scrolling:touch; }
.chip-bar::-webkit-scrollbar { display:none; }
.chip { flex-shrink:0; background:#202c33; border:none; color:#8696a0; padding:6px 14px; border-radius:16px; font-size:13px; cursor:pointer; }
.chip.active { background:#00a884; color:#fff; }

.list-area { flex:1; min-height:0; overflow-y:auto; -webkit-overflow-scrolling:touch; padding:0 8px 16px; }
.empty-state { display:flex; flex-direction:column; align-items:center; justify-content:center; padding:60px 20px; color:#8696a0; }
.empty-desc { margin-top:12px; text-align:center; font-size:14px; }
.loading { text-align:center; padding:60px; color:#8696a0; }
.primary-btn { background:#00a884; color:#fff; border:none; padding:10px 20px; border-radius:8px; font-size:14px; cursor:pointer; }

.card-list { display:flex; flex-direction:column; gap:8px; padding-top:4px; }
.cust-card { background:#202c33; border-radius:12px; padding:12px; cursor:pointer; position:relative; transition:background .1s; }
.cust-card:active { background:#2a3942; }

.card-top { display:flex; align-items:flex-start; gap:10px; }
.avatar { width:42px; height:42px; border-radius:50%; display:flex; align-items:center; justify-content:center; color:#fff; font-weight:600; font-size:16px; flex-shrink:0; }
.card-meta { flex:1; min-width:0; }
.card-name-row { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
.card-name { font-size:15px; font-weight:600; color:#e9edef; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:100%; }
.card-sub { display:flex; align-items:center; gap:8px; margin-top:3px; font-size:12px; color:#8696a0; flex-wrap:wrap; }
.card-contact { color:#d1d7db; }
.card-country { display:inline-flex; align-items:center; gap:2px; }
.card-source { background:#1a242b; padding:1px 6px; border-radius:6px; font-size:11px; }
.card-industry { background:rgba(124,58,237,0.18); color:#a78bfa; padding:1px 6px; border-radius:6px; font-size:11px; }
.badge-unfilled { background:rgba(248,113,113,0.18); color:#f87171; padding:1px 6px; border-radius:6px; font-size:11px; }

.level-tag { padding:2px 7px; border-radius:8px; font-size:10px; font-weight:600; flex-shrink:0; }
.level-tag.level-a { background:rgba(0,168,132,0.2); color:#00d9a8; }
.level-tag.level-b { background:rgba(79,195,247,0.2); color:#4FC3F7; }
.level-tag.level-c { background:rgba(134,150,160,0.2); color:#8696a0; }
.level-tag.level-d { background:rgba(134,150,160,0.15); color:#54656f; }

.status-tag { flex-shrink:0; padding:3px 8px; border-radius:8px; font-size:11px; font-weight:500; }
.status-tag.status-active { background:rgba(0,168,132,0.15); color:#00a884; }
.status-tag.status-following { background:rgba(245,158,11,0.15); color:#f59e0b; }
.status-tag.status-dormant { background:rgba(134,150,160,0.15); color:#8696a0; }
.status-tag.status-potential { background:rgba(248,113,113,0.18); color:#f87171; }
.status-tag.status-new { background:rgba(124,58,237,0.18); color:#a78bfa; }

.card-msg { margin-top:8px; padding:6px 10px; background:#111b21; border-radius:8px; font-size:13px; color:#8696a0; display:flex; align-items:center; gap:4px; max-width:100%; }
.msg-dir { font-size:12px; flex-shrink:0; }
.msg-dir.out { color:#00a884; }
.msg-dir.in { color:#8696a0; }
.msg-text { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1; min-width:0; }

.card-bottom { display:flex; align-items:center; justify-content:space-between; margin-top:8px; }
.card-left-info { display:flex; align-items:center; gap:10px; font-size:12px; color:#54656f; min-width:0; flex:1; }
.card-phone { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.card-time { flex-shrink:0; }
.card-actions { display:flex; gap:6px; flex-shrink:0; }
.card-action-btn { background:#2a3942; border:none; color:#8696a0; padding:6px 10px; border-radius:8px; font-size:12px; cursor:pointer; display:flex; align-items:center; gap:4px; }
.card-action-btn.chat-btn { color:#00a884; background:rgba(0,168,132,0.15); }
.card-action-btn:active { background:#3b4a54; }

.card-badges { display:flex; gap:6px; margin-top:6px; }
.badge-doc { font-size:11px; color:#8696a0; background:#1a242b; padding:2px 7px; border-radius:6px; }
.badge-follow { font-size:11px; color:#00a884; background:rgba(0,168,132,0.12); padding:2px 7px; border-radius:6px; }

.pager { display:flex; align-items:center; justify-content:center; gap:12px; padding:14px 0 4px; }
.page-btn { background:#202c33; border:none; color:#e9edef; width:36px; height:36px; border-radius:50%; font-size:18px; cursor:pointer; display:flex; align-items:center; justify-content:center; }
.page-btn:disabled { opacity:0.4; }
.page-btn:active:not(:disabled) { background:#2a3942; }
.page-info { color:#e9edef; font-size:14px; min-width:60px; text-align:center; }
.pager-total { color:#54656f; font-size:12px; }

.form-row-2 { display:flex; gap:10px; }
.form-row-2 .el-form-item { flex:1; }
.cust-dialog :deep(.el-dialog) { background:#202c33; color:#e9edef; border-radius:14px; margin:10vh auto !important; }
.cust-dialog :deep(.el-dialog__title) { color:#e9edef; font-size:16px; }
.cust-dialog :deep(.el-form-item__label) { color:#8696a0; font-size:13px; }
.cust-dialog :deep(.el-input__wrapper) { background:#2a3942; box-shadow:none; border-radius:8px; }
.cust-dialog :deep(.el-input__inner) { color:#e9edef; font-size:14px; }
.cust-dialog :deep(.el-textarea__inner) { background:#2a3942; color:#e9edef; border-radius:8px; }
.cust-dialog :deep(.el-select) { width:100%; }
.cust-dialog :deep(.el-select__wrapper) { background:#2a3942 !important; box-shadow:none !important; border-radius:8px; }
.cust-dialog :deep(.el-select__placeholder), .cust-dialog :deep(.el-select__selected-item) { color:#e9edef !important; }

@media (min-width: 769px) {
  .list-area { padding:16px 24px 24px; width:100%; box-sizing:border-box; }
  .card-list { display:grid; grid-template-columns:repeat(auto-fill,minmax(340px,1fr)); gap:12px; padding:0; }
  .cust-card { padding:14px 16px; }
  .search-bar { padding:10px 24px; }
  .search-input-wrap { max-width:100%; }
  .kpi-bar { padding:12px 24px; gap:12px; }
  .chip-bar { padding:8px 24px 12px; }
  .cust-header { padding:14px 24px; }
}
</style>
