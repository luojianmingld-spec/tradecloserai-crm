<template>
  <div class="cust-list-page">
    <!-- 顶部栏 -->
    <div class="cust-header">
      <h2 class="page-title">👥 客户管理</h2>
      <div class="spacer"></div>
      <button class="hdr-btn assign-btn" @click="openAssignDialog">
        <span style="margin-right:4px">🤖</span><span class="btn-text">指派 Agent{{ selectedIds.size ? ' (' + selectedIds.size + ')' : '' }}</span>
      </button>
      <button class="hdr-btn add-btn" @click="showAddDialog = true">
        <span style="margin-right:4px">➕</span><span class="btn-text">添加客户</span>
      </button>
    </div>

    <!-- KPI 统计条 -->
    <div class="kpi-bar">
      <div class="kpi-item" @click="switchTab('all')" :class="{active: activeTab==='all' && !filters.level && !filters.status}">
        <span class="kpi-num">{{ stats.total || total || 0 }}</span>
        <span class="kpi-label">全部</span>
      </div>
      <div class="kpi-item" @click="filterByLevel('A')" :class="{active: filters.level==='A'}">
        <span class="kpi-num level-a-num">{{ aCount }}</span>
        <span class="kpi-label">A 核心</span>
      </div>
      <div class="kpi-item" @click="filterByLevel('B')" :class="{active: filters.level==='B'}">
        <span class="kpi-num level-b-num">{{ bCount }}</span>
        <span class="kpi-label">B 意向</span>
      </div>
      <div class="kpi-item" @click="filterByLevel('C')" :class="{active: filters.level==='C'}">
        <span class="kpi-num level-c-num">{{ cCount }}</span>
        <span class="kpi-label">C 待培育</span>
      </div>
      <div class="kpi-item" @click="filterByLevel('D')" :class="{active: filters.level==='D'}">
        <span class="kpi-num level-d-num">{{ dCount }}</span>
        <span class="kpi-label">D 冷冻</span>
      </div>
      <div class="kpi-item" @click="filterByStatus('potential')" :class="{active: filters.status==='potential'}">
        <span class="kpi-num kpi-num-pending">{{ stats.pending || 0 }}</span>
        <span class="kpi-label">待跟进</span>
      </div>
    </div>

    <!-- 搜索栏 -->
    <div class="search-bar">
      <div class="search-input-wrap">
        <span class="search-icon">🔍</span>
        <input class="search-input" v-model="searchInput" placeholder="搜索姓名、公司、邮箱、WhatsApp、国家"
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

    <!-- 列表区：PC端表格 / 移动端卡片 -->
    <div class="list-area">
      <div v-if="loading" class="empty-state"><div class="loading">加载中...</div></div>
      <template v-else>
        <!-- 空状态 -->
        <div v-if="!items.length" class="empty-state">
          <div style="font-size:48px;opacity:0.3">👥</div>
          <div class="empty-desc">还没有客户</div>
          <button class="primary-btn" @click="showAddDialog = true" style="margin-top:12px">➕ 添加第一个客户</button>
        </div>

        <!-- PC端：表格 + 移动端：卡片（通过CSS切换显示） -->
        <div v-else>
          <div class="table-wrap desktop-only">
            <table class="cust-table">
            <thead>
              <tr>
                <th class="col-check"><input type="checkbox" v-model="selectAll" @change="toggleSelectAll" /></th>
                <th class="col-name">姓名</th>
                <th class="col-company">公司名</th>
                <th class="col-contact">邮箱/WhatsApp</th>
                <th class="col-country">国家/地区</th>
                <th class="col-product">采购产品</th>
                <th class="col-level">客户等级</th>
                <th class="col-time">创建时间</th>
                <th class="col-time">最后沟通</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="c in items" :key="c.id" @click="goDetail(c)" :class="{ selected: selectedIds.has(c.id) }">
                <td class="col-check" @click.stop>
                  <input type="checkbox" :value="c.id" v-model="selectedIdsArr" />
                </td>
                <td class="col-name">
                  <div class="name-cell">
                    <div class="tbl-avatar" :style="!avatarOk(c) && !(c.jid && c.jid.includes('@g.us')) ? {background: (c.jid && c.jid.includes('@telegram')) ? '#2AABEE' : avatarColor(displayName(c))} : {}">
                      <img v-if="!(c.jid && c.jid.includes('@g.us')) && waAvatarUrl(c) && avatarOk(c) && !(c.jid && c.jid.includes('@telegram'))" class="tbl-avatar-img" :src="waAvatarUrl(c)" @error="onAvatarError(c)" alt="" />
                      <template v-else-if="c.jid && c.jid.includes('@g.us')"><span class="avatar-txt" style="font-size:18px;font-weight:700">群</span></template>
                      <template v-else-if="c.jid && c.jid.includes('@telegram')"><span class="avatar-txt" style="font-size:16px">✈️</span></template>
                      <template v-else-if="isPhoneNumber(displayName(c))">📱</template>
                      <template v-else><span class="avatar-txt">{{ (displayName(c) || '?')[0].toUpperCase() }}</span></template>
                    </div>
                    <a class="name-link" @click.prevent="goDetail(c)">{{ displayName(c) }}</a>
                    <span v-if="sourceBadge(c)" class="source-badge" :style="{background:sourceBadge(c).bg,color:sourceBadge(c).fg}">{{ sourceBadge(c).icon }} {{ sourceBadge(c).label }}</span>
                  </div>
                </td>
                <td class="col-company">{{ c.companyName || c.company || '—' }}</td>
                <td class="col-contact">
                  <div class="contact-cell">
                    <div v-if="c.email" class="contact-line email-line">✉️ {{ c.email }}</div>
                    <div v-if="c.phone || c.jid" class="contact-line wa-line">💬 {{ formatPhone(c.phone || c.jid) }}</div>
                    <div v-if="!c.email && !c.phone && !c.jid" class="muted">—</div>
                  </div>
                </td>
                <td class="col-country">
                  <span v-if="c.country" class="country-cell">
                    <span class="flag">{{ countryFlag(c) }}</span>
                    <span>{{ displayCountry(c) }}</span>
                  </span>
                  <span v-else class="muted">—</span>
                </td>
                <td class="col-product">
                  <span v-if="c.requirementProducts" class="product-tag">{{ c.requirementProducts }}</span>
                  <span v-else class="muted">—</span>
                </td>
                <td class="col-level">
                  <span class="lv-badge" :class="'lv-'+(c.customerLevel||'c').toLowerCase()">{{ levelLabel(c.customerLevel||'C') }}</span>
                </td>
                <td class="col-time muted">{{ c.createdAt ? fmtDate(c.createdAt) : '—' }}</td>
                <td class="col-time">
                  <span :class="{ 'recent': isRecent(c.lastContactAt) }">{{ c.lastContactAt ? fmtDate(c.lastContactAt) : '—' }}</span>
                </td>
              </tr>
            </tbody>
          </table>
          <!-- 分页（桌面） -->
          <div v-if="total > pageSize" class="pager pager-desktop">
            <button class="page-btn" :disabled="page<=1" @click="onPageChange(page-1)">‹</button>
            <span class="page-info">{{ page }} / {{ Math.ceil(total/pageSize) }}</span>
            <button class="page-btn" :disabled="page>=Math.ceil(total/pageSize)" @click="onPageChange(page+1)">›</button>
            <span class="pager-total">共{{ total }}条</span>
          </div>
          </div>

          <!-- 移动端：卡片（仅移动端显示） -->
          <div class="card-list mobile-only">
          <div v-for="c in items" :key="c.id" class="cust-card" @click="goDetail(c)">
            <div class="card-top">
              <div class="avatar" :style="!avatarOk(c) && !(c.jid && c.jid.includes('@g.us')) ? {background: (c.jid && c.jid.includes('@telegram')) ? '#2AABEE' : avatarColor(displayName(c))} : {}">
                <img v-if="!(c.jid && c.jid.includes('@g.us')) && waAvatarUrl(c) && avatarOk(c) && !(c.jid && c.jid.includes('@telegram'))" class="card-avatar-img" :src="waAvatarUrl(c)" @error="onAvatarError(c)" alt="" />
                <template v-else-if="c.jid && c.jid.includes('@g.us')"><span class="avatar-txt" style="font-size:20px;font-weight:700">群</span></template>
                <template v-else-if="c.jid && c.jid.includes('@telegram')"><span class="avatar-txt" style="font-size:20px">✈️</span></template>
                <template v-else-if="isPhoneNumber(displayName(c))">📱</template>
                <template v-else><span class="avatar-txt">{{ (displayName(c) || '?')[0].toUpperCase() }}</span></template>
              </div>
              <div class="card-meta">
                <div class="card-name-row">
                  <span class="card-name">{{ displayName(c) }}</span>
                  <span v-if="sourceBadge(c)" class="source-badge" :style="{background:sourceBadge(c).bg,color:sourceBadge(c).fg}">{{ sourceBadge(c).icon }} {{ sourceBadge(c).label }}</span>
                  <span class="level-tag" :class="'level-'+(c.customerLevel||'c').toLowerCase()">{{ levelLabel(c.customerLevel||'C') }}</span>
                </div>
                <div class="card-sub">
                  <span v-if="c.companyName" class="card-company">🏢 {{ c.companyName }}</span>
                  <span class="card-country">{{ countryFlag(c) }} {{ displayCountry(c) }}</span>
                </div>
              </div>
              <span class="status-tag" :class="'status-'+(c.status||'new')">{{ statusLabel(c.status) }}</span>
            </div>
            <div v-if="c.requirementProducts" class="card-msg">
              <span style="margin-right:4px">🎯</span>
              <span class="msg-text">{{ c.requirementProducts }}</span>
            </div>
            <div class="card-bottom">
              <div class="card-left-info">
                <span v-if="c.jid || c.phone" class="card-phone">💬 {{ formatPhone(c.phone || c.jid) }}</span>
                <span v-if="c.email" class="card-email">✉️ {{ c.email }}</span>
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
          </div>
          <!-- 分页（移动端） -->
          <div v-if="total > pageSize" class="pager pager-mobile">
            <button class="page-btn" :disabled="page<=1" @click="onPageChange(page-1)">‹</button>
            <span class="page-info">{{ page }} / {{ Math.ceil(total/pageSize) }}</span>
            <button class="page-btn" :disabled="page>=Math.ceil(total/pageSize)" @click="onPageChange(page+1)">›</button>
            <span class="pager-total">共{{ total }}条</span>
          </div>
          </div>
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
        <div class="form-row-2">
          <el-form-item label="邮箱">
            <el-input v-model="addForm.email" placeholder="email@example.com" />
          </el-form-item>
          <el-form-item label="电话/WhatsApp">
            <el-input v-model="addForm.phone" placeholder="+86..." />
          </el-form-item>
        </div>
        <el-form-item label="意向产品">
          <el-input v-model="addForm.requirementProducts" placeholder="采购产品/需求" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="addForm.notes" type="textarea" :rows="2" placeholder="备注信息" />
        </el-form-item>
      </el-form>
      <template #footer>
        <button class="dlg-btn cancel" @click="showAddDialog=false">取消</button>
        <button class="dlg-btn primary" :disabled="adding" @click="doAdd">{{ adding?'添加中...':'添加客户' }}</button>
      </template>
    </el-dialog>

    <!-- 指派 Agent Dialog（V1.0 F1 批量指派） -->
    <el-dialog v-model="showAssignDialog" :title="`🤖 指派 Agent（${selectedIds.size} 个客户）`" width="92%" class="cust-dialog assign-dialog" :append-to-body="true" :close-on-click-modal="false">
      <div class="assign-tip">选择要指派的 Agent 后，对方可在 Agent 对话页选择这些客户进行跟进。</div>
      <div class="assign-agents">
        <div v-for="ag in ASSIGN_AGENTS" :key="ag.type" class="assign-agent-card" :class="{ active: assignAgentType === ag.type }" @click="assignAgentType = ag.type">
          <span class="aa-icon">{{ ag.icon }}</span>
          <div class="aa-info">
            <div class="aa-name">{{ ag.name }}</div>
            <div class="aa-desc">{{ ag.desc }}</div>
          </div>
          <span class="aa-check" v-if="assignAgentType === ag.type">✓</span>
        </div>
      </div>
      <div class="assign-instruction">
        <textarea v-model="assignInstruction" class="assign-input" rows="3" placeholder="给 Agent 的跟进指令（选填），如：重点跟进 A 级客户，本周内发首封开发信"></textarea>
      </div>
      <template #footer>
        <button class="dlg-btn cancel" @click="showAssignDialog=false">取消</button>
        <button class="dlg-btn primary" :disabled="assigning" @click="doAssign">{{ assigning?'指派中...':'确认指派' }}</button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import api from '../utils/api.js';

const router = useRouter();

// ── state ──
const items = ref([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(50);
const loading = ref(false);
const stats = ref({});
const searchInput = ref('');
let searchTimer = null;
const activeTab = ref('all');
const filters = ref({ level: null, status: null });
const showAddDialog = ref(false);
const adding = ref(false);
const selectedIds = ref(new Set());

const addForm = ref({
  companyName: '', contactName: '', title: '', country: '',
  email: '', phone: '', website: '', source: 'manual',
  customerLevel: 'C', notes: '', requirementProducts: ''
});

// ── derived ──
const aCount = computed(() => stats.value?.aLevel ?? stats.value?.levelA ?? items.value.filter(c=>c.customerLevel==='A').length);
const bCount = computed(() => stats.value?.bLevel ?? stats.value?.levelB ?? items.value.filter(c=>c.customerLevel==='B').length);
const cCount = computed(() => stats.value?.cLevel ?? stats.value?.levelC ?? items.value.filter(c=>c.customerLevel==='C').length);
const dCount = computed(() => stats.value?.dLevel ?? items.value.filter(c=>c.customerLevel==='D').length);
const selectedIdsArr = computed({
  get: () => Array.from(selectedIds.value),
  set: (arr) => { selectedIds.value = new Set(arr); }
});
const selectAll = computed({
  get: () => items.value.length>0 && items.value.every(c=>selectedIds.value.has(c.id)),
  set: (v) => {
    if (v) items.value.forEach(c => selectedIds.value.add(c.id));
    else selectedIds.value.clear();
  }
});

function toggleSelectAll() { selectAll.value = !selectAll.value; }

// ── display helpers ──
function displayName(c) {
  return c.contactName || c.name || c.companyName || c.company || (c.phone ? formatPhone(c.phone) : '未命名客户');
}
function isPhoneNumber(s) {
  if (!s) return false;
  return /^[\d+\-\s()]+$/.test(s) && s.replace(/\D/g,'').length >= 7;
}
// ── 头像真实图 ──
const avatarFailedMap = ref({});
function waAvatarUrl(c) {
  const jid = c.jid || (c.phone ? c.phone.replace(/\D/g,'') + '@s.whatsapp.net' : '');
  if (!jid) return '';
  if (jid.includes('@g.us')) return '';
  return '/api/wa/avatar?jid=' + encodeURIComponent(jid);
}
function avatarOk(c) {
  const jid = c.jid || (c.phone ? c.phone.replace(/\D/g,'') + '@s.whatsapp.net' : '');
  if (!jid) return false;
  return !avatarFailedMap.value[jid];
}
function onAvatarError(c) {
  const jid = c.jid || (c.phone ? c.phone.replace(/\D/g,'') + '@s.whatsapp.net' : '');
  if (jid) avatarFailedMap.value[jid] = true;
}

function avatarColor(name) {
  const colors = ['var(--mgmt-whatsapp)','#4FC3F7','#f59e0b','#a78bfa','#f87171','#10b981','#6366f1','#ec4899','#14b8a6','#f97316'];
  let h = 0;
  for (let i=0;i<(name||'').length;i++) h = (h*31 + name.charCodeAt(i)) & 0xffffffff;
  return colors[Math.abs(h) % colors.length];
}
function formatPhone(p) {
  if (!p) return '';
  let s = String(p).replace(/@.*/,'').replace(/[^0-9+\-]/g,'');
  if (s.length > 14) s = s.slice(0,6) + '****' + s.slice(-4);
  return s;
}

// 国旗映射（常见国家 code → emoji）
const FLAG_MAP = {
  'CN':'🇨🇳','US':'🇺🇸','UK':'🇬🇧','GB':'🇬🇧','AE':'🇦🇪','SA':'🇸🇦','IN':'🇮🇳','PK':'🇵🇰',
  'BD':'🇧🇩','ID':'🇮🇩','MY':'🇲🇾','SG':'🇸🇬','TH':'🇹🇭','VN':'🇻🇳','PH':'🇵🇭','JP':'🇯🇵',
  'KR':'🇰🇷','TR':'🇹🇷','RU':'🇷🇺','DE':'🇩🇪','FR':'🇫🇷','IT':'🇮🇹','ES':'🇪🇸','NL':'🇳🇱',
  'BR':'🇧🇷','MX':'🇲🇽','CA':'🇨🇦','AU':'🇦🇺','NZ':'🇳🇿','ZA':'🇿🇦','EG':'🇪🇬','NG':'🇳🇬',
  'KE':'🇰🇪','GH':'🇬🇭','IL':'🇮🇱','IQ':'🇮🇶','IR':'🇮🇷','JO':'🇯🇴','KW':'🇰🇼','QA':'🇶🇦',
  'BH':'🇧🇭','OM':'🇴🇲','LB':'🇱🇧','SY':'🇸🇾','YE':'🇾🇪','DZ':'🇩🇿','MA':'🇲🇦','TN':'🇹🇳',
  'LY':'🇱🇾','SD':'🇸🇩','ET':'🇪🇹','TZ':'🇹🇿','UG':'🇺🇬','CM':'🇨🇲','CI':'🇨🇮','SN':'🇸🇳',
  'ML':'🇲🇱','BF':'🇧🇫','NE':'🇳🇪','TD':'🇹🇩','AO':'🇦🇴','MZ':'🇲🇿','ZW':'🇿🇼','ZM':'🇿🇲',
  'PL':'🇵🇱','CZ':'🇨🇿','SK':'🇸🇰','HU':'🇭🇺','RO':'🇷🇴','BG':'🇧🇬','GR':'🇬🇷','PT':'🇵🇹',
  'SE':'🇸🇪','NO':'🇳🇴','DK':'🇩🇰','FI':'🇫🇮','CH':'🇨🇭','AT':'🇦🇹','BE':'🇧🇪','IE':'🇮🇪',
  'UA':'🇺🇦','BY':'🇧🇾','KZ':'🇰🇿','UZ':'🇺🇿','GE':'🇬🇪','AM':'🇦🇲','AZ':'🇦🇿','MN':'🇲🇳',
  'CL':'🇨🇱','CO':'🇨🇴','PE':'🇵🇪','AR':'🇦🇷','VE':'🇻🇪','EC':'🇪🇨','BO':'🇧🇴','PY':'🇵🇾',
  'UY':'🇺🇾','PA':'🇵🇦','CR':'🇨🇷','GT':'🇬🇹','HN':'🇭🇳','SV':'🇸🇻','DO':'🇩🇴','CU':'🇨🇺',
  'JM':'🇯🇲','TT':'🇹🇹','LK':'🇱🇰','MM':'🇲🇲','KH':'🇰🇭','LA':'🇱🇦','NP':'🇳🇵','AF':'🇦🇫',
  'TW':'🇨🇳','HK':'🇭🇰','MO':'🇲🇴'
};
// 国家名 → code（粗粒度）
const COUNTRY_NAME_TO_CODE = {
  'china':'CN','中国':'CN','中国大陆':'CN','prc':'CN',
  'united states':'US','usa':'US','us':'US','america':'US','美国':'US',
  'united kingdom':'GB','uk':'GB','britain':'GB','england':'GB','英国':'GB',
  'uae':'AE','united arab emirates':'AE','emirates':'AE','阿联酋':'AE','迪拜':'AE','dubai':'AE','abu dhabi':'AE',
  'saudi arabia':'SA','saudi':'SA','沙特':'SA','沙特阿拉伯':'SA',
  'india':'IN','印度':'IN',
  'pakistan':'PK','巴基斯坦':'PK',
  'bangladesh':'BD','孟加拉':'BD',
  'indonesia':'ID','印尼':'ID','印度尼西亚':'ID',
  'malaysia':'MY','马来西亚':'MY',
  'singapore':'SG','新加坡':'SG',
  'thailand':'TH','泰国':'TH',
  'vietnam':'VN','viet nam':'VN','越南':'VN',
  'philippines':'PH','菲律宾':'PH',
  'japan':'JP','日本':'JP',
  'korea':'KR','south korea':'KR','korea, republic of':'KR','韩国':'KR','south korea (republic of korea)':'KR',
  'turkey':'TR','türkiye':'TR','turkiye':'TR','土耳其':'TR',
  'russia':'RU','russian federation':'RU','俄罗斯':'RU',
  'germany':'DE','deutschland':'DE','德国':'DE',
  'france':'FR','法国':'FR',
  'italy':'IT','italia':'IT','意大利':'IT',
  'spain':'ES','espana':'ES','西班牙':'ES',
  'netherlands':'NL','holland':'NL','荷兰':'NL',
  'brazil':'BR','brasil':'BR','巴西':'BR',
  'mexico':'MX','墨西哥':'MX',
  'canada':'CA','加拿大':'CA',
  'australia':'AU','澳洲':'AU','澳大利亚':'AU',
  'new zealand':'NZ','新西兰':'NZ',
  'south africa':'ZA','南非':'ZA',
  'egypt':'EG','埃及':'EG',
  'nigeria':'NG','尼日利亚':'NG',
  'kenya':'KE','肯尼亚':'KE',
  'syria':'SY','叙利亚':'SY','syrian arab republic':'SY',
  'jordan':'JO','约旦':'JO',
  'iraq':'IQ','伊拉克':'IQ',
  'iran':'IR','iran (islamic republic of)':'IR','伊朗':'IR',
  'qatar':'QA','卡塔尔':'QA',
  'kuwait':'KW','科威特':'KW',
  'bahrain':'BH','巴林':'BH',
  'oman':'OM','阿曼':'OM',
  'lebanon':'LB','黎巴嫩':'LB',
  'israel':'IL','以色列':'IL',
  'turkey':'TR'
};
function countryFlag(c) {
  if (!c || !c.country) return '🌍';
  const raw = String(c.country).trim();
  // 直接 code (2-3字母大写)
  if (/^[A-Z]{2,3}$/.test(raw) && FLAG_MAP[raw]) return FLAG_MAP[raw];
  // 名称匹配
  const key = raw.toLowerCase().trim();
  if (COUNTRY_NAME_TO_CODE[key]) return FLAG_MAP[COUNTRY_NAME_TO_CODE[key]];
  // 模糊匹配
  for (const k of Object.keys(COUNTRY_NAME_TO_CODE)) {
    if (key.includes(k) || k.includes(key)) return FLAG_MAP[COUNTRY_NAME_TO_CODE[k]];
  }
  return '🌍';
}
function displayCountry(c) {
  if (!c.country) return '未知';
  return String(c.country);
}
function levelLabel(lv) {
  const m = { A: 'A 核心', B: 'B 意向', C: 'C 待培育', D: 'D 冷冻' };
  return m[lv] || (lv || 'C') + ' 核心';
}
function sourceLabel(s) {
  const m = { whatsapp:'WhatsApp', manual:'手动', web:'独立站', exhibition:'展会', referral:'推荐', other:'其他' };
  return m[s] || s || '未知';
}
function statusLabel(s) {
  const m = { potential:'潜在', active:'活跃', following:'跟进中', dormant:'沉睡', new:'新客户' };
  return m[s] || s || '新客户';
}
function isUnfilled(c) {
  return !c.companyName && !c.contactName && !c.email && !c.country;
}
// 时间格式化
function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt)) return '—';
  const y = dt.getFullYear();
  const m = String(dt.getMonth()+1).padStart(2,'0');
  const day = String(dt.getDate()).padStart(2,'0');
  const h = String(dt.getHours()).padStart(2,'0');
  const mi = String(dt.getMinutes()).padStart(2,'0');
  const now = new Date();
  if (y === now.getFullYear()) return `${m}-${day} ${h}:${mi}`;
  return `${y}-${m}-${day} ${h}:${mi}`;
}
function isRecent(d) {
  if (!d) return false;
  return (Date.now() - new Date(d).getTime()) < 7*86400*1000;
}

function sourceBadge(c) {
  const s = (c.source || '').toLowerCase();
  if (s === 'telegram' || (c.jid && c.jid.includes('@telegram'))) return { icon: '✈️', label: 'TG', bg: '#2AABEE', fg: '#fff' };
  if (s === 'whatsapp' || (c.jid && c.jid.includes('@s.whatsapp.net')) || (c.jid && c.jid.includes('@c.us'))) return { icon: '💬', label: 'WA', bg: '#25D366', fg: '#fff' };
  if (s === 'instagram') return { icon: '📸', label: 'IG', bg: '#E1306C', fg: '#fff' };
  if (s === 'email') return { icon: '✉️', label: 'Email', bg: '#EA4335', fg: '#fff' };
  if (s === 'manual') return { icon: '👤', label: '手动', bg: '#6366f1', fg: '#fff' };
  if (s === '展会' || s === 'exhibition') return { icon: '🎪', label: '展会', bg: '#f59e0b', fg: '#fff' };
  if (s && s !== 'other') return { icon: '❓', label: s.slice(0,4), bg: '#6b7280', fg: '#fff' };
  return null;
}

function relTime(d) {
  if (!d) return '';
  const dt = new Date(d);
  const diff = Math.floor((Date.now()-dt.getTime())/1000);
  if (diff < 60) return '刚刚';
  if (diff < 3600) return Math.floor(diff/60)+'分钟前';
  if (diff < 86400) return Math.floor(diff/3600)+'小时前';
  const days = Math.floor(diff/86400);
  if (days === 0) return '今天';
  if (days === 1) return '昨天';
  if (days < 7) return days+'天前';
  if (days < 30) return Math.floor(days/7)+'周前';
  return dt.toISOString().slice(5,10);
}

// ── data ──
async function reload(p) {
  if (p) page.value = p;
  loading.value = true;
  try {
    const params = { page: page.value, pageSize: pageSize.value };
    if (searchInput.value && searchInput.value.trim()) params.search = searchInput.value.trim();
    if (activeTab.value === 'A' || activeTab.value === 'B' || activeTab.value === 'C' || activeTab.value === 'D') params.level = activeTab.value;
    else if (activeTab.value === 'potential' || activeTab.value === 'active' || activeTab.value === 'following') params.status = activeTab.value;
    if (activeTab.value === 'recent') params.recent = '1';
    if (filters.value.level) params.level = filters.value.level;
    if (filters.value.status) params.status = filters.value.status;
    params.isBusiness = 'true'; // L2: 客户管理列表只显示已确认的业务客户（计数同步）
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
  filters.value.level = null; filters.value.status = null;
  reload(1);
}
function filterByLevel(lv) {
  if (filters.value.level === lv) { filters.value.level = null; }
  else { filters.value.level = lv; filters.value.status = null; activeTab.value = 'all'; }
  reload(1);
}
function filterByStatus(st) {
  if (filters.value.status === st) { filters.value.status = null; }
  else { filters.value.status = st; filters.value.level = null; activeTab.value = 'all'; }
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
  router.push({ path: '/chat', query: { jid: c.jid } });
}
async function doAdd() {
  if (!addForm.value.companyName?.trim()) { ElMessage.warning('请填写公司名称'); return; }
  adding.value = true;
  try {
    await api.post('/customers', addForm.value);
    ElMessage.success('添加成功');
    showAddDialog.value = false;
    Object.assign(addForm.value, { companyName:'', contactName:'', title:'', country:'', email:'', phone:'', website:'', source:'manual', customerLevel:'C', notes:'', requirementProducts:'' });
    reload();
  } catch (e) {
    ElMessage.error(e?.response?.data?.error || '添加失败');
  } finally { adding.value = false; }
}

// ── Agent 指派（V1.0 F1 批量指派） ──
const ASSIGN_AGENTS = [
  { type: 'sales-champion', icon: '🚀', name: '外贸销冠', desc: '智能跟单 · 话术 · 成交' },
  { type: 'background-report', icon: '🔍', name: '客户背调', desc: '背景调查 · 风险评估' },
  { type: 'customs-agent', icon: '📋', name: '外贸单证', desc: '报关单证 · HS编码' },
  { type: 'doc-agent', icon: '🏭', name: '工厂对接', desc: '验厂评估 · 生产跟进' },
  { type: 'freight-agent', icon: '🚢', name: '货代对接', desc: '海运空运 · 报关报检' },
  { type: 'legal-agent', icon: '⚖️', name: '外贸法务', desc: '合同审查 · 纠纷处理' },
];
const showAssignDialog = ref(false);
const assignAgentType = ref('sales-champion');
const assignInstruction = ref('');
const assigning = ref(false);

function openAssignDialog() {
  if (selectedIds.value.size === 0) { ElMessage.warning('请先勾选要指派的客户'); return; }
  assignAgentType.value = 'sales-champion';
  assignInstruction.value = '';
  showAssignDialog.value = true;
}
async function doAssign() {
  const ids = Array.from(selectedIds.value);
  if (!ids.length) return;
  assigning.value = true;
  try {
    const { data } = await api.post('/agent/tasks', {
      agentType: assignAgentType.value,
      customerIds: ids,
      instruction: assignInstruction.value.trim() || null,
      source: 'customer_list'
    });
    const created = (data.results || []).filter(r => r.status === 'created').length;
    const exists = (data.results || []).filter(r => r.status === 'exists').length;
    const failed = (data.results || []).filter(r => r.status === 'failed').length;
    ElMessage.success(`指派完成：新建 ${created} 个${exists ? '，已存在 ' + exists + ' 个' : ''}${failed ? '，失败 ' + failed + ' 个' : ''}`);
    showAssignDialog.value = false;
    selectedIds.value.clear();
  } catch (e) {
    ElMessage.error(e?.response?.data?.error || '指派失败');
  } finally { assigning.value = false; }
}

onMounted(() => reload(1));
</script>

<style scoped>
.cust-list-page { flex:1; display:flex; flex-direction:column; background:var(--mgmt-bg); color:var(--mgmt-text); min-width:0; min-height:0; height:0; box-sizing:border-box; }

.cust-header { display:flex; align-items:center; padding:16px 20px; background:var(--mgmt-card-bg); border-bottom:1px solid var(--mgmt-divider); gap:12px; flex-shrink:0; }
.page-title { margin:0; font-size:18px; font-weight:600; }
.spacer { flex:1; }
.hdr-btn { background:var(--mgmt-whatsapp); border:none; color:#fff; padding:8px 14px; border-radius:6px; cursor:pointer; font-size:14px; display:flex; align-items:center; font-weight:500; transition:background .2s; }
.hdr-btn:active { opacity:0.85; }

.kpi-bar { display:flex; gap:10px; padding:12px 20px; overflow-x:auto; background:var(--mgmt-card-bg); border-bottom:1px solid var(--mgmt-divider); flex-shrink:0; -webkit-overflow-scrolling:touch; }
.kpi-bar::-webkit-scrollbar { display:none; }
.kpi-item { flex-shrink:0; background:var(--mgmt-card-bg); padding:10px 16px; border-radius:12px; display:flex; flex-direction:column; align-items:center; min-width:68px; cursor:pointer; border:1px solid var(--mgmt-divider); transition:all .15s; }
.kpi-item.active { border-color:var(--mgmt-whatsapp); background:var(--mgmt-tag-green-bg); }
.kpi-num { font-size:20px; font-weight:700; color:var(--mgmt-text); line-height:1.2; }
.level-a-num { color:#00d9a8 !important; }
.level-b-num { color:var(--mgmt-tag-orange) !important; }
.level-c-num { color:var(--mgmt-text-muted) !important; }
.level-d-num { color:var(--mgmt-tag-red) !important; }
.kpi-label { color:var(--mgmt-text-muted); font-size:12px; margin-top:2px; }

.search-bar { padding:10px 20px; background:var(--mgmt-card-bg); flex-shrink:0; }
.search-input-wrap { display:flex; align-items:center; background:var(--mgmt-bg); border-radius:6px; padding:0 12px; border:1px solid var(--mgmt-input-border); transition:border-color .2s; }
.search-icon { font-size:14px; margin-right:8px; opacity:0.6; }
.search-input { flex:1; background:transparent; border:none; color:var(--mgmt-text); padding:9px 0; font-size:14px; outline:none; }
.search-input::placeholder { color:var(--mgmt-text-placeholder); }
.search-clear { background:transparent; border:none; color:var(--mgmt-text-muted); font-size:14px; cursor:pointer; padding:4px 8px; }

.chip-bar { display:flex; gap:8px; padding:0 20px 14px; overflow-x:auto; background:var(--mgmt-card-bg); flex-shrink:0; -webkit-overflow-scrolling:touch; border-bottom:1px solid var(--mgmt-divider); }
.chip-bar::-webkit-scrollbar { display:none; }
.chip { flex-shrink:0; background:var(--mgmt-card-bg); border:1.5px solid var(--mgmt-divider); color:var(--mgmt-text-secondary); padding:8px 14px; border-radius:20px; font-size:13px; cursor:pointer; transition:all .2s; white-space:nowrap; }
.chip.active { background:var(--mgmt-whatsapp); color:#fff; border-color:var(--mgmt-whatsapp); }

.list-area { flex:1; min-height:0; height:0; overflow-y:auto; -webkit-overflow-scrolling:touch; padding:16px; background:var(--mgmt-bg); }
.empty-state { display:flex; flex-direction:column; align-items:center; justify-content:center; padding:60px 20px; color:var(--mgmt-text-muted); }
.empty-desc { margin-top:12px; text-align:center; font-size:14px; }
.loading { text-align:center; padding:60px; color:var(--mgmt-text-muted); }
.primary-btn { background:var(--mgmt-whatsapp); color:#fff; border:none; padding:10px 20px; border-radius:6px; font-size:14px; cursor:pointer; transition:background .2s; }

/* ===== PC端：表格 ===== */
.table-wrap { padding:0; }
.cust-table { width:100%; border-collapse:collapse; background:var(--mgmt-card-bg); border-radius:12px; overflow:hidden; font-size:14px; box-shadow:var(--mgmt-shadow); }
.cust-table thead th {
  background:var(--mgmt-bg); color:var(--mgmt-text-muted); font-weight:600; font-size:12px;
  letter-spacing:0.03em; padding:12px 14px; text-align:left; border-bottom:1px solid var(--mgmt-divider);
  white-space:nowrap; position:sticky; top:0; z-index:1;
}
.cust-table tbody td { padding:14px; border-bottom:1px solid var(--mgmt-divider); vertical-align:middle; color:var(--mgmt-text); }
.cust-table tbody tr:last-child td { border-bottom:none; }
.cust-table tbody tr { cursor:pointer; transition:background .12s; }
.cust-table tbody tr:hover { background:var(--mgmt-bg); }
.cust-table tbody tr.selected { background:rgba(0,168,132,0.06); }

.col-check { width:40px; text-align:center; }
.col-check input { width:16px; height:16px; cursor:pointer; accent-color:var(--mgmt-whatsapp); }
.col-name { min-width:180px; font-weight:500; }
.name-cell { display:flex; align-items:center; gap:10px; }
.tbl-avatar { width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center; color:#fff; font-weight:600; font-size:14px; flex-shrink:0; line-height:1; }
.tbl-avatar-img { width:100%; height:100%; border-radius:50%; object-fit:cover; }
.card-avatar-img { width:100%; height:100%; border-radius:50%; object-fit:cover; }
.avatar-txt { line-height:1; }

.name-link { color:var(--mgmt-tag-blue); cursor:pointer; text-decoration:none; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.name-link:hover { text-decoration:underline; }
.col-company { min-width:150px; color:var(--mgmt-text); font-weight:500; }
.col-contact { min-width:180px; }
.contact-cell { display:flex; flex-direction:column; gap:2px; }
.contact-line { font-size:13px; color:var(--mgmt-text-muted); }
.email-line { color:var(--mgmt-tag-blue); }
.col-country { min-width:120px; color:var(--mgmt-text); }
.country-cell { display:inline-flex; align-items:center; gap:6px; }
.flag { font-size:18px; line-height:1; }
.col-product { min-width:150px; max-width:220px; }
.product-tag {
  display:inline-block; background:var(--mgmt-tag-blue-bg); color:var(--mgmt-tag-blue); padding:3px 10px; border-radius:4px;
  font-size:12px; font-weight:500; max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
}
.col-level { width:90px; text-align:center; }
.lv-badge {
  display:inline-block; padding:3px 10px; border-radius:4px; font-size:12px; font-weight:600;
  white-space:nowrap; line-height:1.4;
}
.lv-badge.lv-a { background:#ef4444; color:#fff; }
.lv-badge.lv-b { background:#f59e0b; color:#fff; }
.lv-badge.lv-c { background:#6b7280; color:#fff; }
.lv-badge.lv-d { background:#374151; color:#fff; }
.col-time { width:130px; white-space:nowrap; font-size:13px; color:var(--mgmt-text-placeholder); }
.col-time .recent { color:#00d9a8; font-weight:500; }
.muted { color:var(--mgmt-text-placeholder); }

/* ===== 移动端：卡片 ===== */
.card-list { display:flex; flex-direction:column; gap:16px; padding:16px 16px 0; }
.card-list .cust-card + .cust-card { margin-top:16px; }
.cust-card { background:var(--mgmt-card-bg); border-radius:12px; padding:18px 16px; cursor:pointer; position:relative; transition:all .15s; border:1px solid var(--mgmt-divider); }
.cust-card:hover { border-color:#3b82f6; box-shadow:0 2px 12px rgba(59,130,246,0.15); }
.cust-card:active { box-shadow:0 2px 8px rgba(0,0,0,0.08); }
.card-top { display:flex; align-items:flex-start; gap:10px; }
.avatar { width:42px; height:42px; border-radius:50%; display:flex; align-items:center; justify-content:center; color:#fff; font-weight:600; font-size:16px; flex-shrink:0; }
.card-meta { flex:1; min-width:0; }
.card-name-row { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
.card-name { font-size:15px; font-weight:600; color:var(--mgmt-text); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:100%; }
.card-sub { display:flex; align-items:center; gap:8px; margin-top:4px; font-size:12px; color:var(--mgmt-text-muted); flex-wrap:wrap; }
.card-company { color:var(--mgmt-text-secondary); }
.card-country { display:inline-flex; align-items:center; gap:2px; }
.level-tag { padding:2px 8px; border-radius:4px; font-size:11px; font-weight:600; flex-shrink:0; }
.level-tag.level-a { background:#ef4444; color:#fff; }
.level-tag.level-b { background:#f59e0b; color:#fff; }
.level-tag.level-c { background:#6b7280; color:#fff; }
.level-tag.level-d { background:#374151; color:#fff; }

.status-tag { flex-shrink:0; padding:3px 8px; border-radius:8px; font-size:11px; font-weight:500; }
.status-tag.status-active { background:var(--mgmt-tag-green-bg); color:var(--mgmt-tag-green); border-radius:4px; }
.status-tag.status-following { background:var(--mgmt-tag-orange-bg); color:var(--mgmt-tag-orange); border-radius:4px; }
.status-tag.status-dormant { background:var(--mgmt-tag-gray-bg); color:var(--mgmt-text-muted); border-radius:4px; }
.status-tag.status-potential { background:var(--mgmt-tag-red-bg); color:var(--mgmt-tag-red); border-radius:4px; }
.status-tag.status-new { background:var(--mgmt-tag-purple-bg); color:var(--mgmt-tag-purple); border-radius:4px; }

.card-msg { margin-top:10px; padding:8px 12px; background:var(--mgmt-bg); border-radius:4px; border-left:3px solid var(--mgmt-input-border); font-size:13px; color:var(--mgmt-text-secondary); display:flex; align-items:center; gap:6px; max-width:100%; }
.msg-text { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1; min-width:0; }
.card-bottom { display:flex; align-items:center; justify-content:space-between; margin-top:10px; padding-top:10px; border-top:1px solid var(--mgmt-divider); }
.card-left-info { display:flex; align-items:center; gap:10px; font-size:12px; color:var(--mgmt-text-muted); min-width:0; flex:1; flex-wrap:wrap; }
.card-phone, .card-email { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:140px; }
.card-email { color:var(--mgmt-tag-blue); }
.card-time { flex-shrink:0; }
.card-actions { display:flex; gap:6px; flex-shrink:0; }
.card-action-btn { background:var(--mgmt-bg); border:1px solid var(--mgmt-divider); color:var(--mgmt-text-secondary); padding:5px 12px; border-radius:4px; font-size:12px; cursor:pointer; display:flex; align-items:center; gap:4px; transition:all .15s; }
.card-action-btn.chat-btn { color:#fff; background:var(--mgmt-whatsapp); border-color:var(--mgmt-whatsapp); }
.card-action-btn:active { opacity:0.7; }

/* ===== 分页 ===== */
.pager { display:flex; align-items:center; justify-content:center; gap:12px; padding:14px 16px 4px; background:var(--mgmt-card-bg); border-radius:12px; margin:10px 0 0; box-shadow:var(--mgmt-shadow); }
.pager-desktop { padding:16px 0; border-top:1px solid var(--mgmt-divider); margin-top:16px; background:var(--mgmt-card-bg); }
.page-btn { background:var(--mgmt-card-bg); border:1px solid var(--mgmt-input-border); color:var(--mgmt-text-secondary); width:36px; height:36px; border-radius:4px; font-size:18px; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all .15s; }
.page-btn:disabled { opacity:0.4; cursor:not-allowed; }
.page-btn:active:not(:disabled) { background:var(--mgmt-bg); }
.page-info { color:var(--mgmt-text); font-size:14px; min-width:60px; text-align:center; }
.pager-total { color:var(--mgmt-text-placeholder); font-size:12px; }

/* ===== 对话框 ===== */
.form-row-2 { display:flex; gap:10px; }
.form-row-2 .el-form-item { flex:1; }
.dlg-btn { padding:8px 18px; border-radius:8px; border:none; font-size:14px; cursor:pointer; font-weight:500; }
.dlg-btn.cancel { background:var(--mgmt-card-bg); color:var(--mgmt-text-secondary); border:1px solid var(--mgmt-input-border); margin-right:8px; border-radius:4px; padding:8px 16px; cursor:pointer; }
.dlg-btn.primary { background:var(--mgmt-whatsapp); color:#fff; border:none; border-radius:4px; padding:8px 16px; cursor:pointer; }
.dlg-btn:disabled { opacity:0.6; cursor:not-allowed; }

.cust-dialog :deep(.el-dialog) { background:var(--mgmt-card-bg); color:var(--mgmt-text); border-radius:6px; margin:10vh auto !important; box-shadow:0 4px 20px rgba(0,0,0,0.12); }
.cust-dialog :deep(.el-dialog__title) { color:var(--mgmt-text); font-size:16px; font-weight:600; }
.cust-dialog :deep(.el-form-item__label) { color:var(--mgmt-text-secondary); font-size:14px; font-weight:500; }
.cust-dialog :deep(.el-input__wrapper) { background:var(--mgmt-card-bg) !important; box-shadow:0 0 0 1px var(--mgmt-input-border) inset !important; border-radius:4px !important; padding:0 12px !important; min-height:36px !important; }
.cust-dialog :deep(.el-input__inner) { color:var(--mgmt-text) !important; font-size:14px !important; height:36px !important; line-height:36px !important; }
.cust-dialog :deep(.el-textarea__inner) { background:var(--mgmt-card-bg) !important; color:var(--mgmt-text) !important; border-radius:4px !important; border:1px solid var(--mgmt-input-border) !important; padding:8px 12px !important; font-size:14px !important; }
.cust-dialog :deep(.el-select) { width:100%; }
.cust-dialog :deep(.el-select__wrapper) { background:var(--mgmt-card-bg) !important; box-shadow:0 0 0 1px var(--mgmt-input-border) inset !important; border-radius:4px !important; min-height:36px !important; }
.cust-dialog :deep(.el-select__placeholder), .cust-dialog :deep(.el-select__selected-item) { color:var(--mgmt-text) !important; }

/* ===== 响应式：桌面/移动端切换 ===== */
.desktop-only { display:none; }
.mobile-only { display:block; }

@media (min-width: 769px) {
  .desktop-only { display:block; }
  .mobile-only { display:none !important; }
  .cust-header { padding:16px 24px; }
  .kpi-bar { padding:12px 24px; gap:12px; }
  .search-bar { padding:10px 24px; }
  .search-input-wrap { max-width:480px; }
  .chip-bar { padding:8px 24px 12px; }
}
@media (max-width: 768px) {
  .cust-header { display:none !important; }
  .list-area { padding:0; }
}

.source-badge { display:inline-flex; align-items:center; gap:2px; font-size:10px; font-weight:600; padding:2px 6px; border-radius:4px; margin-left:4px; white-space:nowrap; }
.kpi-num.level-a-num { color:#ef4444; }
.kpi-num.level-b-num { color:#f59e0b; }
.kpi-num.level-c-num { color:#6b7280; }
.kpi-num.level-d-num { color:#374151; }
.kpi-num.kpi-num-pending { color:#6366f1; }
.assign-btn { background: var(--mgmt-whatsapp); border:none; color:#fff; padding:8px 14px; border-radius:6px; cursor:pointer; font-size:14px; display:flex; align-items:center; font-weight:500; margin-right:8px; }
.assign-tip { font-size:12px; color: var(--mgmt-text-secondary); margin-bottom:10px; }
.assign-agents { display:grid; grid-template-columns:repeat(2, 1fr); gap:8px; margin-bottom:12px; }
.assign-agent-card { display:flex; align-items:center; gap:10px; padding:10px 12px; border-radius:10px; border:1.5px solid var(--mgmt-input-border, rgba(0,0,0,.12)); cursor:pointer; transition:all .15s; background:var(--mgmt-card-bg, #fff); }
.assign-agent-card:hover { border-color: var(--mgmt-whatsapp); }
.assign-agent-card.active { border-color: var(--mgmt-whatsapp); background: rgba(37,211,102,.08); }
.aa-icon { font-size:20px; }
.aa-info { flex:1; min-width:0; }
.aa-name { font-size:14px; font-weight:600; }
.aa-desc { font-size:11px; color: var(--mgmt-text-secondary); }
.aa-check { color: var(--mgmt-whatsapp); font-weight:700; font-size:16px; }
.assign-instruction { }
.assign-input { width:100%; box-sizing:border-box; padding:8px 10px; border-radius:8px; border:1px solid var(--mgmt-input-border, rgba(0,0,0,.12)); font-size:13px; resize:vertical; background:var(--mgmt-card-bg,#fff); color:inherit; }
</style>
