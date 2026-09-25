<template>
  <div class="agent-chat-page" :class="{ dark: isDark }">

    <!-- ========== 中间聊天区域 ========== -->
    <main class="chat-main">

<!-- 消息列表 -->
      <div class="messages-area" ref="messagesArea">
        <!-- 欢迎页 -->
        <div v-if="messages.length === 0" class="welcome-screen">
          <div class="welcome-icon">{{ currentAgentInfo.icon }}</div>
          <h2>{{ currentAgentInfo.name }}</h2>
          <p class="welcome-desc">{{ currentAgentInfo.welcome }}</p>
          <div class="quick-actions">
            <div v-for="(group, gi) in currentAgentInfo.quickActions" :key="gi" class="quick-group">
              <div class="quick-group-title">{{ group.title }}</div>
              <div class="quick-buttons">
                <button v-for="(btn, bi) in group.buttons" :key="bi" class="quick-btn" @click="sendQuick(btn)">
                  {{ btn }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- 消息 -->
        <div v-for="(msg, idx) in messages" :key="idx" class="message-row" :class="msg.role">
          <div class="msg-avatar">
            <span v-if="msg.role === 'assistant'" class="avatar-icon">{{ currentAgentInfo.icon }}</span>
            <span v-else class="avatar-icon user-avatar">👤</span>
          </div>
          <div class="msg-body">
            <div class="msg-name">{{ msg.role === 'assistant' ? currentAgentInfo.name : 'Jeremy' }}</div>
            <div class="msg-bubble" :class="msg.role">
              <div class="msg-text" v-html="formatMessage(msg.content)"></div>
              <div v-if="msg.attachments && msg.attachments.length" class="msg-files">
                <div v-for="(f, fi) in msg.attachments" :key="fi" class="msg-file-item">
                  <span>{{ f.type?.startsWith('image') ? '️' : '📄' }}</span>
                  <span>{{ f.name }}</span>
                </div>
              </div>
            </div>
            <div class="msg-time">{{ formatTime(msg.createdAt) }}</div>
          </div>
        </div>

        <!-- 加载中 -->
        <div v-if="loading" class="message-row assistant">
          <div class="msg-avatar"><span class="avatar-icon">{{ currentAgentInfo.icon }}</span></div>
          <div class="msg-body">
            <div class="msg-name">{{ currentAgentInfo.name }}</div>
            <div class="msg-bubble assistant">
              <div class="typing"><span></span><span></span><span></span></div>
            </div>
            <div class="msg-time" v-if="loadingStatus">{{ loadingStatus }}</div>
          </div>
        </div>
      </div>

      <!-- 输入框（扣子风格） -->
      <div class="input-area">
        <!-- 附件预览 -->
        <div v-if="attachments.length > 0" class="attach-preview">
          <div v-for="(f, i) in attachments" :key="i" class="attach-chip">
            <span>{{ f.type?.startsWith('image') ? '🖼️' : '📄' }}</span>
            <span class="chip-name">{{ f.name }}</span>
            <button class="chip-close" @click="attachments.splice(i, 1)">×</button>
          </div>
        </div>

        <!-- 输入行 -->
        <div class="input-row">
          <button class="input-tool-btn" @click="triggerFileUpload" title="添加附件">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
          <textarea
            ref="inputRef"
            v-model="inputMessage"
            @keydown.enter.exact.prevent="sendMessage"
            placeholder="想到什么就随时发，不用等我闲下来"
            rows="1"
            class="chat-input"
          ></textarea>
          <button class="model-select-btn" @click="openModelPicker">
            <span>{{ currentModelName }}</span>
            <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M7 10l5 5 5-5z"/></svg>
          </button>
          <button class="send-btn" @click="sendMessage" :disabled="loading || (!inputMessage.trim() && attachments.length === 0)">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
          </button>
        </div>

        <!-- 附件选项 -->
        <div v-if="showAttachRow" class="attach-options">
          <button class="attach-opt-btn" @click="triggerFileUpload('image')">🖼️ 图片</button>
          <button class="attach-opt-btn" @click="triggerFileUpload('video')">🎬 视频</button>
          <button class="attach-opt-btn" @click="triggerFileUpload('file')">📄 文件</button>
        </div>

        <input type="file" ref="fileInput" multiple accept="image/*,video/*,.pdf,.doc,.docx,.txt,.csv,.xlsx" style="display:none" @change="handleFileSelect" />
      </div>

      <!-- 模型选择弹窗（扣子式二级菜单） -->
      <div v-if="showModelPicker" class="agm-overlay" @click.self="closeModelPicker">
        <div class="agm-panel">
          <div class="agm-header">
            <div>
              <div class="agm-title">选择 AI 模型</div>
              <div class="agm-sub">自动推荐或手动指定本次使用的模型</div>
            </div>
            <button type="button" class="agm-close" @click="closeModelPicker">✕</button>
          </div>
          <div class="agm-body">
            <!-- 左：一级模型列表 -->
            <div class="agm-list">
              <div class="agm-item" :class="{ active: pickerPreview === 'auto' }" @mouseenter="pickerPreview = 'auto'" @click="pickerPreview = 'auto'">
                <div class="agm-item-main">
                  <span class="agm-item-name">⚡ 自动（系统推荐）</span>
                  <span class="agm-item-tag">推荐</span>
                </div>
                <span class="agm-item-credit">系统智能选择</span>
              </div>
              <div v-for="m in pickerModels" :key="m.key" class="agm-item" :class="{ active: pickerPreview === m.key }" @mouseenter="pickerPreview = m.key" @click="pickerPreview = m.key">
                <div class="agm-item-main">
                  <span class="agm-item-name">{{ m.name }}</span>
                  <span v-if="m.isDefault" class="agm-item-tag agm-item-tag-default">默认</span>
                </div>
                <span class="agm-item-credit">{{ m.creditCost || 150 }} 积分</span>
              </div>
            </div>
            <!-- 右：二级模型详情 -->
            <div class="agm-detail">
              <template v-if="pickerDetail">
                <div class="agm-detail-name">{{ pickerDetail.name }}</div>
                <div class="agm-detail-role">{{ pickerDetail.desc || '该模型可用于本功能，选择后立即生效。' }}</div>
                <div class="agm-detail-sec">
                  <div class="agm-detail-sec-label">优势特点</div>
                  <div class="agm-detail-sec-body">{{ pickerDetail.features || '—' }}</div>
                </div>
                <div class="agm-detail-sec">
                  <div class="agm-detail-sec-label">外贸场景优势</div>
                  <div class="agm-detail-sec-body">{{ pickerDetail.trade || '—' }}</div>
                </div>
                <div class="agm-detail-sec">
                  <div class="agm-detail-sec-label">可用功能</div>
                  <div class="agm-detail-tags">
                    <span v-for="(t, ti) in (pickerDetail.tags || [])" :key="ti" class="agm-detail-tag">{{ t }}</span>
                  </div>
                </div>
                <div class="agm-detail-meta">
                  <span v-if="pickerDetail.providerType" class="agm-meta-chip">{{ pickerDetail.providerType }}</span>
                  <span v-if="pickerDetail.isDefault" class="agm-meta-chip">系统默认</span>
                </div>
                <button type="button" class="agm-use-btn" @click="applyPickerModel">使用此模型</button>
              </template>
              <div v-else class="agm-detail-empty">← 将鼠标悬停或点击左侧模型查看介绍</div>
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- ========== 右侧栏（扣子风格：窄图标栏 + 弹出面板） ========== -->
    <aside class="right-icon-bar">
      <button
        v-for="fn in rightFunctions"
        :key="fn.key"
        class="right-icon-btn"
        :class="{ active: activePanel === fn.key }"
        @click="togglePanel(fn.key)"
        :title="fn.label"
      >
        <span class="icon-emoji">{{ fn.icon }}</span>
      </button>
      <div class="right-spacer"></div>
      <button class="right-icon-btn" @click="showMoreMenu = !showMoreMenu" title="更多">
        <span class="icon-emoji">⋯</span>
      </button>
    </aside>

    <!-- 弹出功能面板（类似翻译设置面板，右侧滑出） -->
    <transition name="slide-panel">
      <aside v-if="activePanel" class="right-panel-overlay" @click.self="activePanel = null">
        <div class="right-panel">
          <div class="panel-header">
            <span class="panel-icon">{{ currentFunction.icon }}</span>
            <span class="panel-title">{{ currentFunction.label }}</span>
            <button class="panel-close" @click="activePanel = null">✕</button>
          </div>
          <div class="panel-body">
            <!-- 客户选择面板（V1.0：全入口客户选择） -->
            <template v-if="activePanel === 'customers'">
              <!-- 当前会话上下文 -->
              <div class="cust-ctx">
                <div class="cust-ctx-label">当前会话</div>
                <div class="cust-ctx-value">
                  <template v-if="selectedCustomer">
                    <span class="ctx-icon">👤</span>
                    <span class="ctx-name">{{ selectedCustomer.name || selectedCustomer.company || ('客户#' + selectedCustomer.id) }}</span>
                  </template>
                  <template v-else>
                    <span class="ctx-icon">🗂️</span>
                    <span class="ctx-name">通用对话</span>
                  </template>
                </div>
              </div>

              <!-- 搜索框 -->
              <div class="cust-search">
                <input v-model="customerSearch" class="cust-search-input" placeholder="搜索客户名称 / 公司..." />
                <span class="cust-search-clear" v-if="customerSearch" @click="customerSearch = ''">✕</span>
              </div>

              <!-- 会话侧栏分组 -->
              <div class="cust-sessions">
                <div class="cust-session-group">会话</div>
                <div class="cust-session-item" :class="{ active: !selectedCustomer }" @click="selectGeneral()">
                  <span class="cs-icon">🗂️</span>
                  <span class="cs-name">通用对话</span>
                  <span class="cs-count">{{ generalSessionCount }}</span>
                </div>
                <div v-for="s in customerSessions" :key="s.sessionId || s.customerId" class="cust-session-item" :class="{ active: selectedCustomer && selectedCustomer.id === s.customerId }" @click="selectSession(s)">
                  <span class="cs-icon">👤</span>
                  <span class="cs-name">{{ s.title || ('客户#' + s.customerId) }}</span>
                  <span class="cs-count">{{ s.msgCount }}</span>
                </div>
              </div>

              <!-- 客户列表 -->
              <div class="cust-group-title">全部客户</div>
              <div class="cust-list">
                <div v-for="c in filteredCustomers" :key="c.id" class="cust-item" :class="{ active: selectedCustomer && selectedCustomer.id === c.id }" @click="selectCustomer(c)">
                  <span class="ci-avatar">{{ (c.name || c.company || '客').slice(0, 1) }}</span>
                  <div class="ci-info">
                    <div class="ci-name">{{ c.name || c.company || ('客户#' + c.id) }}</div>
                    <div class="ci-sub">{{ c.company || (c.customerLevel ? '等级 ' + c.customerLevel : '') }}</div>
                  </div>
                  <span class="ci-level" v-if="c.customerLevel">{{ c.customerLevel }}</span>
                </div>
                <div v-if="!filteredCustomers.length" class="cust-empty">暂无客户</div>
              </div>
            </template>
            <!-- 技能面板 -->
            <template v-if="activePanel === 'skills'">
              <div v-for="skill in currentAgentInfo.skills" :key="skill.name" class="panel-skill-item">
                <span class="skill-icon">{{ skill.icon }}</span>
                <span class="skill-label">{{ skill.name }}</span>
                <span class="skill-status active">已启用</span>
              </div>
            </template>
            <!-- 知识库面板 -->
            <template v-if="activePanel === 'knowledge'">
              <div class="panel-kb-desc">{{ currentAgentInfo.knowledge }}</div>
              <button class="panel-action-btn">📁 上传知识库文件</button>
            </template>
            <!-- 记忆面板 -->
            <template v-if="activePanel === 'memory'">
              <div class="memory-item">
                <span class="status-dot online"></span>
                <span>对话记忆</span>
                <span class="memory-status-text">已开启</span>
              </div>
              <div class="memory-item">
                <span class="status-dot online"></span>
                <span>上下文记忆</span>
                <span class="memory-status-text">已开启</span>
              </div>
              <div class="memory-item">
                <span class="status-dot online"></span>
                <span>偏好学习</span>
                <span class="memory-status-text">已开启</span>
              </div>
              <div class="memory-stats">
                当前对话 {{ messages.length }} 条
              </div>
            </template>
            <!-- 文件面板 -->
            <template v-if="activePanel === 'files'">
              <button class="panel-action-btn"> 上传文件</button>
              <div class="file-list-empty">暂无文件，上传文件后Agent可以引用</div>
            </template>
          </div>
        </div>
      </aside>
    </transition>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, onMounted, onUnmounted, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useRoute } from 'vue-router'

const route = useRoute()
const isDark = ref(true)
const messages = ref([])
const inputMessage = ref('')
const loading = ref(false)
const loadingStatus = ref('')
const attachments = ref([])
const providers = ref([])
const selectedProviderId = ref('')
const useAutoModel = ref(true)
const showModelPicker = ref(false)
// 扣子式二级菜单：模型列表富详情 + 选中预览 + providerId 映射
const pickerModels = ref([])
const pickerPreview = ref('auto')
const pickerProviderMap = ref({})

// 模型简介描述（类似扣子风格）
const modelDescriptions = {
  "商汤SenseNova": "轻量级模型，日常对话高效",
  "火山方舟Doubao": "通用大模型，综合能力均衡",
  "DeepSeek V4 Pro": "旗舰模型，复杂任务首选",
  "Doubao Seed Evolving": "进化模型，持续学习优化",
  "Doubao Seed 2.1 Turbo": "高速响应，轻量任务优选",
  "DeepSeek V4 Flash": "极速响应，轻量对话首选",
  "GPT-4o (API2D)": "OpenAI旗舰，多模态全能王"
}
const modelIcons = {
  "商汤SenseNova": "🧠",
  "火山方舟Doubao": "🔥",
  "DeepSeek V4 Pro": "⚡",
  "Doubao Seed Evolving": "🧬",
  "Doubao Seed 2.1 Turbo": "🚀",
  "DeepSeek V4 Flash": "💨",
  "GPT-4o (API2D)": "🌐"
}

const showAttachRow = ref(false)
const expandedAgents = ref(true)
const activePanel = ref(null)
const showMoreMenu = ref(false)
const messagesArea = ref(null)
const inputRef = ref(null)
const fileInput = ref(null)

const agents = [
  { type: 'sales-champion', icon: '', name: '外贸销冠', subtitle: '智能跟单 · AI话术 · 成交转化' },
  { type: 'background-report', icon: '🔍', name: '客户背调', subtitle: '背景调查 · 风险评估 · 竞品分析' },
  { type: 'customs-agent', icon: '📋', name: '外贸单证', subtitle: '报关单证 · HS编码 · 合规审查' },
  { type: 'doc-agent', icon: '🏭', name: '工厂对接', subtitle: '验厂评估 · 生产跟进 · 品质管控' },
  { type: 'freight-agent', icon: '', name: '货代对接', subtitle: '海运空运 · 报关报检 · 物流优化' },
  { type: 'legal-agent', icon: '⚖️', name: '外贸法务', subtitle: '合同审查 · 纠纷处理 · 合规风险' },
]

const projects = [
  { id: 1, icon: '', name: 'TradeCloser AI项目', time: '15小时' },
  { id: 2, icon: '🔧', name: 'TradeCloser AI技术对接', time: '1天' },
  { id: 3, icon: '🌐', name: 'TradeCloser外贸社区', time: '3天' },
  { id: 4, icon: '🏪', name: '独立站', time: '6天' },
  { id: 5, icon: '🔹', name: '金阳光玻璃官网', time: '1周' },
  { id: 6, icon: '', name: '金至晶客户管理系统', time: '4周' },
  { id: 7, icon: '🔹', name: '外贸通CRM系统', time: '7周' },
  { id: 8, icon: '🔹', name: 'GlobeSync', time: '8周' },
]

// 右侧功能图标
const rightFunctions = [
  { key: 'customers', icon: '👤', label: '客户' },
  { key: 'skills', icon: '⚡', label: '技能' },
  { key: 'knowledge', icon: '📚', label: '知识库' },
  { key: 'memory', icon: '🧠', label: '记忆' },
  { key: 'files', icon: '📁', label: '文件' },
]

// ===== 客户会话状态（客户-Agent 双向指派 V1.0） =====
const customerList = ref([])
const customerSearch = ref('')
const selectedCustomer = ref(null)
const sessionList = ref([])
const activeSessionId = ref(null)

const currentAgent = ref('sales-champion')

const currentAgentInfo = computed(() => {
  const base = agents.find(a => a.type === currentAgent.value) || agents[0]
  return { ...base, ...getAgentConfig(currentAgent.value) }
})

const currentFunction = computed(() => rightFunctions.find(f => f.key === activePanel.value) || rightFunctions[0])
const currentModelName = computed(() => {
  if (useAutoModel.value) return 'Auto'
  const p = providers.value.find(x => x.id === selectedProviderId.value)
  return p?.name || 'Auto'
})

// ===== 扣子式二级模型菜单 =====
const pickerDetail = computed(() => {
  if (pickerPreview.value === 'auto') {
    return { name: '自动（系统推荐）', desc: '不手动指定，由系统自动选择当前默认模型（DeepSeek V4 Flash）。', features: '无需关注模型差异，系统自动选择当前最适合的默认模型。', trade: '适合大多数日常外贸场景：翻译、话术、分析、背调均可，省心省力。', tags: ['自动', '推荐', '通用'], creditCost: 0, providerType: '系统', isDefault: true }
  }
  return pickerModels.value.find(m => m.key === pickerPreview.value) || null
})
function openModelPicker() {
  if (useAutoModel.value) pickerPreview.value = 'auto'
  else pickerPreview.value = selectedProviderId.value || 'auto'
  showModelPicker.value = true
}
function closeModelPicker() { showModelPicker.value = false }
function applyPickerModel() {
  if (pickerPreview.value === 'auto') {
    useAutoModel.value = true; selectedProviderId.value = ''
  } else {
    useAutoModel.value = false
    selectedProviderId.value = pickerProviderMap.value[pickerPreview.value] || pickerPreview.value
  }
  showModelPicker.value = false
}
async function loadPickerModels() {
  try {
    const token = localStorage.getItem('token')
    const res = await fetch(window.__API_BASE__ + '/api/ai/models', { headers: { Authorization: `Bearer ${token}` } })
    const data = await res.json()
    const list = Array.isArray(data?.models) ? data.models : []
    pickerModels.value = list
    const map = {}
    for (const m of list) map[m.key] = m.key
    pickerProviderMap.value = map
  } catch (e) { console.warn('loadPickerModels failed:', e.message) }
}

function getAgentConfig(type) {
  const cfgs = {
    'sales-champion': {
      welcome: '我是你的外贸销冠AI，15年实战经验。帮你分析客户、优化话术、制定报价策略、推进成交。',
      skills: [{ icon: '💬', name: 'AI话术生成' }, { icon: '📊', name: '客户分层' }, { icon: '🎯', name: '漏斗诊断' }, { icon: '💰', name: '报价优化' }, { icon: '📈', name: '成交追踪' }],
      knowledge: '外贸话术库 · 成交案例库 · 报价模板',
      quickActions: [
        { title: '🚀 快速上手', buttons: ['查一下所有客户', '给最新客户打个招呼', '总结今天待办'] },
        { title: ' 话术优化', buttons: ['优化这段回复话术', '客户说太贵了怎么回', '写一封英文开发信'] },
        { title: '💰 报价成交', buttons: ['做一份报价单', '分析客户成交概率', '制定跟进策略'] },
      ]
    },
    'background-report': {
      welcome: '我是客户背调专家，帮你做公司背景调查、风险评估、竞品分析。',
      skills: [{ icon: '🔍', name: '公司背调' }, { icon: '️', name: '风险评估' }, { icon: '📊', name: '竞品分析' }, { icon: '🌍', name: '市场情报' }, { icon: '🚢', name: '海关数据' }],
      knowledge: '企业信用数据库 · 海关数据 · 行业报告',
      quickActions: [
        { title: '🔍 背景调查', buttons: ['帮我调查这个公司', '查客户信用评级', '分析行业采购特点'] },
        { title: '⚠️ 风险评估', buttons: ['评估付款风险', '查有没有法律纠纷', '分析竞争对手'] },
      ]
    },
    'customs-agent': {
      welcome: '我是外贸单证专家，报关、HS编码、贸易术语、信用证审核都在行。',
      skills: [{ icon: '📋', name: '报关单证' }, { icon: '🔢', name: 'HS编码' }, { icon: '', name: '信用证审核' }, { icon: '💱', name: '外汇政策' }, { icon: '✅', name: '合规检查' }],
      knowledge: 'HS编码库 · 贸易法规 · 报关模板',
      quickActions: [
        { title: '📋 单证制作', buttons: ['做一份装箱单', '生成报关单', '做一份商业发票'] },
        { title: '🔢 查询', buttons: ['查HS编码', '查今天美元汇率', 'FOB和CIF区别'] },
      ]
    },
    'doc-agent': {
      welcome: '我是工厂对接专家，帮你验厂评估、生产跟进、品质管控。',
      skills: [{ icon: '🏭', name: '工厂评估' }, { icon: '📅', name: '排产跟进' }, { icon: '🔍', name: '验货标准' }, { icon: '💰', name: '成本核算' }, { icon: '📊', name: '供应商管理' }],
      knowledge: '工厂数据库 · 品质标准库 · 成本模板',
      quickActions: [
        { title: '🏭 工厂管理', buttons: ['做一份验厂清单', '评估工厂产能', '制定QC标准'] },
        { title: '💰 成本优化', buttons: ['拆解BOM成本', '对比供应商报价', '优化包装降本'] },
      ]
    },
    'freight-agent': {
      welcome: '我是国际物流专家，海运空运报价、报关报检、物流方案优化都在行。',
      skills: [{ icon: '', name: '海运方案' }, { icon: '✈️', name: '空运方案' }, { icon: '📦', name: '报关报检' }, { icon: '🛡️', name: '货运保险' }, { icon: '💰', name: '成本优化' }],
      knowledge: '航线数据库 · 港口信息 · 运费参考',
      quickActions: [
        { title: '🚢 物流查询', buttons: ['查到洛杉矶海运费', '查到汉堡船期', '空运到迪拜要多久'] },
        { title: '📦 报关', buttons: ['做一份装箱单', '出口退税怎么算', '查HS编码'] },
      ]
    },
    'legal-agent': {
      welcome: '我是外贸法务顾问，合同审查、纠纷处理、合规风控都可以帮你。',
      skills: [{ icon: '📄', name: '合同审查' }, { icon: '️', name: '纠纷处理' }, { icon: '🛡️', name: '知识产权' }, { icon: '📋', name: '合规检查' }, { icon: '💳', name: '付款保障' }],
      knowledge: '国际贸易法 · CISG公约 · INCOTERMS 2020 · 合同模板',
      quickActions: [
        { title: '📄 合同', buttons: ['审查这份合同', '起草外贸合同', '信用证条款审核'] },
        { title: '⚖️ 纠纷', buttons: ['客户不付款怎么办', '质量索赔流程', '追收欠款方法'] },
      ]
    },
  }
  return cfgs[type] || cfgs['sales-champion']
}

onMounted(async () => {
  const pathMap = { '/sales-champion': 'sales-champion', '/background-report': 'background-report', '/customs-agent': 'customs-agent', '/doc-agent': 'doc-agent', '/freight-agent': 'freight-agent', '/legal-agent': 'legal-agent' }
  if (pathMap[route.path]) currentAgent.value = pathMap[route.path]
  window.addEventListener('reminder:fired', handleReminderFired)
  await Promise.all([loadProviders(), loadPickerModels(), loadCustomers(), loadSessions(), loadHistory()])
  inputRef.value?.focus()
})

function handleReminderFired(e) {
  const d = e?.detail || {}
  if (d.title) {
    ElMessage({ type: 'warning', message: '⏰ 日程提醒：' + d.title + (d.content ? '：' + d.content : ''), duration: 8000 })
  }
  loadHistory()
}

onUnmounted(() => {
  window.removeEventListener('reminder:fired', handleReminderFired)
})

// Watch route changes to switch agents
watch(() => route.path, async (newPath) => {
  console.log('[AgentChat] route.path changed to:', newPath, 'currentAgent:', currentAgent.value)
  const pathMap = { '/sales-champion': 'sales-champion', '/background-report': 'background-report', '/customs-agent': 'customs-agent', '/doc-agent': 'doc-agent', '/freight-agent': 'freight-agent', '/legal-agent': 'legal-agent' }
  if (pathMap[newPath] && pathMap[newPath] !== currentAgent.value) {
    console.log('[AgentChat] switching to:', pathMap[newPath])
    currentAgent.value = pathMap[newPath]
    selectedCustomer.value = null
    activeSessionId.value = null
    customerSearch.value = ''
    await Promise.all([loadSessions(), loadHistory()])
    inputRef.value?.focus()
  }
})

async function switchAgent(type) {
  currentAgent.value = type
  messages.value = []
  attachments.value = []
  inputMessage.value = ''
  activePanel.value = null
  selectedCustomer.value = null
  activeSessionId.value = null
  customerSearch.value = ''
  await Promise.all([loadSessions(), loadHistory()])
  inputRef.value?.focus()
}

async function loadHistory() {
  try {
    const token = localStorage.getItem('token')
    let url = `/api/assistant/conversations?agentType=${currentAgent.value}&limit=100`
    if (activeSessionId.value) url += `&sessionId=${encodeURIComponent(activeSessionId.value)}`
    else url += '&scope=general'
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    if (res.ok) messages.value = await res.json()
  } catch (e) { console.error(e) }
}

async function loadProviders() {
  try {
    const token = localStorage.getItem('token')
    const res = await fetch(window.__API_BASE__ + '/api/assistant/providers', { headers: { Authorization: `Bearer ${token}` } })
    if (res.ok) providers.value = await res.json()
  } catch (e) { console.error(e) }
}

async function sendMessage() {
  const text = inputMessage.value.trim()
  if (!text && attachments.value.length === 0) return
  if (loading.value) return
  messages.value.push({ role: 'user', content: text || '（发送了附件）', attachments: attachments.value.map(f => ({ name: f.name, type: f.type })), createdAt: new Date().toISOString() })
  inputMessage.value = ''
  const sentAttachments = [...attachments.value]
  attachments.value = []
  loading.value = true
  loadingStatus.value = '思考中...'
  scrollToBottom()
  try {
    const token = localStorage.getItem('token')
    const formData = new FormData()
    formData.append('message', text)
    formData.append('agentType', currentAgent.value)
    if (selectedCustomer.value) formData.append('customerId', selectedCustomer.value.id)
    if (!useAutoModel.value && selectedProviderId.value) formData.append('providerId', selectedProviderId.value)
    for (const f of sentAttachments) { if (f.file) formData.append('files', f.file) }
    loadingStatus.value = '处理中...'
    const res = await fetch(window.__API_BASE__ + '/api/assistant/chat', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const result = await res.json()
    messages.value.push({ role: 'assistant', content: result.reply || result.content || '抱歉，处理出错', tasks: result.tasks || [], attachments: result.attachments || [], createdAt: new Date().toISOString() })
  } catch (e) {
    messages.value.push({ role: 'assistant', content: '⚠️ 请求失败: ' + e.message, createdAt: new Date().toISOString() })
  } finally { loading.value = false; loadingStatus.value = ''; scrollToBottom() }
}

function sendQuick(text) { inputMessage.value = text; sendMessage() }
function triggerFileUpload() { showAttachRow.value = !showAttachRow.value; fileInput.value?.click() }
function handleFileSelect(e) {
  const files = Array.from(e.target.files || [])
  for (const f of files) attachments.value.push({ name: f.name, type: f.type, size: f.size, file: f })
  e.target.value = ''
  showAttachRow.value = false
}
function togglePanel(key) { activePanel.value = activePanel.value === key ? null : key }

// ===== 客户会话相关（V1.0） =====
const filteredCustomers = computed(() => {
  const kw = customerSearch.value.trim().toLowerCase()
  if (!kw) return customerList.value
  return customerList.value.filter(c =>
    (c.name || '').toLowerCase().includes(kw) ||
    (c.company || '').toLowerCase().includes(kw) ||
    (c.phone || '').includes(kw) ||
    String(c.id).includes(kw)
  )
})
const customerSessions = computed(() => sessionList.value.filter(s => s.customerId))
const generalSessionCount = computed(() => {
  const g = sessionList.value.filter(s => !s.customerId)
  return g.reduce((sum, s) => sum + (s.msgCount || 0), 0) || 0
})
async function loadCustomers() {
  try {
    const token = localStorage.getItem('token')
    const res = await fetch(window.__API_BASE__ + '/api/customers?pageSize=200', { headers: { Authorization: `Bearer ${token}` } })
    if (res.ok) {
      const j = await res.json()
      customerList.value = Array.isArray(j) ? j : (j.items || j.data || [])
    }
  } catch (e) { console.error(e) }
}
async function loadSessions() {
  try {
    const token = localStorage.getItem('token')
    const res = await fetch(window.__API_BASE__ + `/api/assistant/sessions?agentType=${currentAgent.value}`, { headers: { Authorization: `Bearer ${token}` } })
    if (res.ok) {
      const j = await res.json()
      sessionList.value = (j && j.sessions) || []
    }
  } catch (e) { console.error(e) }
}
function selectCustomer(c) {
  selectedCustomer.value = c
  activeSessionId.value = `${currentAgent.value}:cust:${c.id}`
  activePanel.value = null
  loadHistory()
  inputRef.value?.focus()
}
function selectSession(s) {
  if (s.customerId) {
    selectedCustomer.value = s.customer || { id: s.customerId, name: s.title || ('客户#' + s.customerId) }
    activeSessionId.value = s.sessionId || `${currentAgent.value}:cust:${s.customerId}`
  } else {
    selectedCustomer.value = null
    activeSessionId.value = null
  }
  activePanel.value = null
  loadHistory()
  inputRef.value?.focus()
}
function selectGeneral() {
  selectedCustomer.value = null
  activeSessionId.value = null
  activePanel.value = null
  loadHistory()
  inputRef.value?.focus()
}

function formatMessage(text) {
  if (!text) return ''
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/`(.*?)`/g, '<code>$1</code>').replace(/\n/g, '<br>')
}
function formatTime(ts) { if (!ts) return ''; const d = new Date(ts); return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) }
function scrollToBottom() { nextTick(() => { if (messagesArea.value) messagesArea.value.scrollTop = messagesArea.value.scrollHeight }) }
</script>

<style scoped>
.agent-chat-page {
  display: flex;
  height: 100%;
  background: var(--mgmt-bg, #0e1621);
  color: #e9edef;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  overflow: hidden;
}

/* ========== 中间聊天区 ========== */
.chat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  position: relative;
}
.chat-topbar {
  padding: 12px 20px;
  font-size: 14px;
  font-weight: 500;
  border-bottom: 1px solid #1e2a35;
  background: var(--mgmt-card-bg, #111b27);
}
.topbar-name { color: #e9edef; }
.topbar-status { color: #00a884; font-size: 12px; }

.messages-area {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  scroll-behavior: smooth;
}

/* 欢迎页 */
.welcome-screen {
  max-width: 640px;
  margin: 40px auto 0;
  text-align: center;
}
.welcome-icon { font-size: 48px; margin-bottom: 12px; }
.welcome-screen h2 { font-size: 22px; margin: 0 0 8px; color: #e9edef; }
.welcome-desc { color: #6b7c8d; font-size: 14px; line-height: 1.6; margin: 0 0 28px; }
.quick-actions { text-align: left; }
.quick-group { margin-bottom: 16px; }
.quick-group-title { font-size: 13px; color: #6b7c8d; margin-bottom: 8px; font-weight: 500; }
.quick-buttons { display: flex; flex-wrap: wrap; gap: 8px; }
.quick-btn {
  padding: 8px 14px;
  border-radius: 20px;
  border: 1px solid #2a3a4a;
  background: var(--mgmt-card-alt, #152030);
  color: #e9edef;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}
.quick-btn:hover { border-color: #00a884; background: var(--mgmt-input-bg, #1a2d3d); }

/* 消息 */
.message-row { display: flex; gap: 12px; margin-bottom: 18px; }
.message-row.user { flex-direction: row-reverse; }
.msg-avatar { flex-shrink: 0; }
.avatar-icon {
  width: 32px; height: 32px;
  border-radius: 50%;
  background: var(--mgmt-card-border, #1e2a35);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
}
.user-avatar { background: #00a884; }
.msg-body { min-width: 0; }
.msg-name { font-size: 12px; color: #6b7c8d; margin-bottom: 4px; }
.message-row.user .msg-name { text-align: right; }
.msg-bubble {
  padding: 10px 14px;
  border-radius: 12px;
  font-size: 14px;
  line-height: 1.6;
  word-break: break-word;
  max-width: 600px;
}
.msg-bubble.assistant { background: var(--mgmt-card-border, #1e2a35); }
.msg-bubble.user { background: #005c4b; }
.msg-text :deep(strong) { font-weight: 600; }
.msg-text :deep(code) { background: rgba(255,255,255,0.1); padding: 1px 4px; border-radius: 3px; font-size: 13px; }
.msg-files { margin-top: 8px; display: flex; flex-wrap: wrap; gap: 6px; }
.msg-file-item { display: flex; align-items: center; gap: 4px; padding: 4px 8px; background: rgba(255,255,255,0.05); border-radius: 6px; font-size: 12px; }
.msg-time { font-size: 11px; color: #4a5c6d; margin-top: 4px; }
.message-row.user .msg-time { text-align: right; }

/* typing */
.typing { display: flex; gap: 4px; padding: 4px 0; }
.typing span { width: 6px; height: 6px; border-radius: 50%; background: #6b7c8d; animation: typing 1.4s infinite; }
.typing span:nth-child(2) { animation-delay: 0.2s; }
.typing span:nth-child(3) { animation-delay: 0.4s; }
@keyframes typing { 0%, 60%, 100% { transform: translateY(0); opacity: 0.4; } 30% { transform: translateY(-4px); opacity: 1; } }

/* 输入区 */
.input-area { padding: 10px 40px 14px; background: var(--mgmt-card-bg, #111b27); margin: 0 20px; border-radius: 12px 12px 0 0; }
.attach-preview { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
.attach-chip { display: flex; align-items: center; gap: 4px; padding: 4px 10px; background: var(--mgmt-card-border, #1e2a35); border-radius: 16px; font-size: 12px; }
.chip-name { max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.chip-close { background: none; border: none; color: #8696a0; cursor: pointer; font-size: 14px; padding: 0 2px; }
.chip-close:hover { color: #ff6b6b; }

.input-row {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  background: var(--mgmt-card-border, #1e2a35);
  border-radius: 12px;
  padding: 8px 12px;
}
.input-tool-btn {
  width: 32px; height: 32px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: #6b7c8d;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.15s;
}
.input-tool-btn:hover { background: #2a3a4a; color: #e9edef; }

.chat-input {
  flex: 1;
  border: none;
  background: transparent;
  color: #e9edef;
  font-size: 14px;
  resize: none;
  outline: none;
  max-height: 100px;
  line-height: 1.5;
  padding: 6px 0;
  min-height: 24px;
}
.chat-input::placeholder { color: #4a5c6d; }

.model-select-btn {
  display: flex;
  align-items: center;
  gap: 3px;
  background: none;
  border: none;
  color: #8696a0;
  font-size: 12px;
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 6px;
  flex-shrink: 0;
  transition: all 0.15s;
}
.model-select-btn:hover { background: #2a3a4a; color: #e9edef; }

.send-btn {
  width: 32px; height: 32px;
  border-radius: 8px;
  border: none;
  background: #00a884;
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.15s;
}
.send-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.send-btn:not(:disabled):hover { background: #00c49a; }

.attach-options { display: flex; gap: 8px; margin-top: 8px; }
.attach-opt-btn { padding: 6px 12px; border-radius: 8px; border: 1px solid #2a3a4a; background: var(--mgmt-card-alt, #152030); color: #e9edef; font-size: 12px; cursor: pointer; }
.attach-opt-btn:hover { border-color: #00a884; }

/* 模型弹窗 */
.model-dropdown {
  position: absolute;
  bottom: 56px;
  right: 8px;
  background: #2a2a2a;
  border: 1px solid #3a3a3a;
  border-radius: 12px;
  padding: 8px 0;
  width: 260px;
  max-height: 380px;
  overflow-y: auto;
  z-index: 200;
  box-shadow: 0 8px 32px rgba(0,0,0,0.5);
}
.md-tabs { display: flex; gap: 4px; padding: 4px 12px 10px; }
.md-tab { font-size: 13px; color: #888; padding: 6px 14px; border-radius: 20px; cursor: pointer; transition: all 0.2s; }
.md-tab.active { background: #444; color: #fff; }
.md-tab:hover:not(.active) { color: #bbb; }
.md-section-title { font-size: 12px; color: #666; padding: 4px 16px 8px; font-weight: 500; }
.model-option { display: flex; align-items: center; gap: 10px; padding: 8px 16px; cursor: pointer; transition: background 0.15s; }
.model-option:hover { background: #3a3a3a; }
.model-option.active { background: #2d3a2d; }
.model-option.add-custom { color: #888; }
.mo-icon { font-size: 16px; width: 20px; text-align: center; }
.mo-text { flex: 1; min-width: 0; }
.mo-name { font-size: 13px; font-weight: 500; color: #e0e0e0; }
.mo-desc { font-size: 11px; color: #777; }
.mo-badge { display: inline-block; font-size: 10px; color: #c8a040; background: #3a3020; padding: 1px 6px; border-radius: 8px; margin-left: 6px; }
.model-divider { height: 1px; background: #3a3a3a; margin: 4px 0; }
.mo-check { color: #00a884; font-weight: 600; margin-left: auto; font-size: 14px; }

/* ===== 扣子式二级模型菜单 ===== */
.agm-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.45);
  display: flex; align-items: center; justify-content: center;
  z-index: 300; animation: agmFade 0.18s ease;
}
@keyframes agmFade { from { opacity: 0 } to { opacity: 1 } }
.agm-panel {
  width: 860px; max-width: 94vw; max-height: 82vh;
  background: var(--mgmt-card, #0f1a24); border: 1px solid var(--mgmt-border, #22334a);
  border-radius: 16px; overflow: hidden; display: flex; flex-direction: column;
  box-shadow: 0 20px 60px rgba(0,0,0,0.5); animation: agmPop 0.2s ease;
}
@keyframes agmPop { from { transform: scale(0.96); opacity: 0 } to { transform: scale(1); opacity: 1 } }
.agm-header { display: flex; align-items: flex-start; justify-content: space-between; padding: 20px 24px 14px; border-bottom: 1px solid var(--mgmt-border, #22334a); }
.agm-title { font-size: 18px; font-weight: 600; color: var(--text-primary, #e9edef); }
.agm-sub { font-size: 12px; color: var(--text-secondary, #8696a0); margin-top: 4px; }
.agm-close { background: none; border: none; color: #8696a0; font-size: 18px; cursor: pointer; padding: 4px 8px; border-radius: 8px; }
.agm-close:hover { background: rgba(255,255,255,0.08); color: #e9edef; }
.agm-body { display: flex; min-height: 320px; }
.agm-list { width: 280px; flex-shrink: 0; border-right: 1px solid var(--mgmt-border, #22334a); overflow-y: auto; padding: 8px; }
.agm-item { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; border-radius: 10px; cursor: pointer; transition: background 0.15s; }
.agm-item:hover { background: rgba(255,255,255,0.05); }
.agm-item.active { background: #0a3d2e; }
.agm-item-main { display: flex; align-items: center; gap: 8px; min-width: 0; }
.agm-item-name { font-size: 14px; font-weight: 500; color: var(--text-primary, #e9edef); white-space: nowrap; }
.agm-item-tag { font-size: 10px; color: #ffb84d; background: rgba(255,184,77,0.15); padding: 1px 7px; border-radius: 10px; flex-shrink: 0; }
.agm-item-tag-default { color: #00a884; background: rgba(0,168,132,0.15); }
.agm-item-credit { font-size: 11px; color: var(--text-secondary, #8696a0); flex-shrink: 0; }
.agm-detail { flex: 1; padding: 24px; overflow-y: auto; }
.agm-detail-name { font-size: 20px; font-weight: 600; color: var(--text-primary, #e9edef); }
.agm-detail-role { font-size: 13px; color: var(--text-secondary, #8696a0); margin: 8px 0 18px; line-height: 1.6; }
.agm-detail-sec { margin-bottom: 16px; }
.agm-detail-sec-label { font-size: 12px; font-weight: 600; color: var(--text-secondary, #8696a0); margin-bottom: 6px; }
.agm-detail-sec-body { font-size: 13px; color: var(--text-primary, #e9edef); background: rgba(0,168,132,0.08); border-radius: 10px; padding: 12px 14px; line-height: 1.7; }
.agm-detail-tags { display: flex; flex-wrap: wrap; gap: 8px; }
.agm-detail-tag { font-size: 12px; color: var(--text-secondary, #8696a0); background: rgba(255,255,255,0.07); padding: 5px 12px; border-radius: 14px; }
.agm-detail-meta { display: flex; gap: 8px; margin-top: 8px; }
.agm-meta-chip { font-size: 11px; color: #8696a0; background: rgba(255,255,255,0.06); padding: 3px 10px; border-radius: 12px; }
.agm-use-btn { width: 100%; margin-top: 20px; padding: 12px; border: none; border-radius: 12px; background: #00a884; color: #fff; font-size: 15px; font-weight: 600; cursor: pointer; transition: background 0.15s; }
.agm-use-btn:hover { background: #00c49a; }
.agm-detail-empty { display: flex; align-items: center; justify-content: center; height: 100%; color: var(--text-secondary, #8696a0); font-size: 13px; }

/* ========== 右侧图标栏 ========== */
.right-icon-bar {
  width: 44px;
  background: #0a1018;
  border-left: 1px solid #1e2a35;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 0;
  flex-shrink: 0;
}
.right-icon-btn {
  width: 36px; height: 36px;
  border-radius: 8px;
  border: none;
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
  margin-bottom: 2px;
}
.right-icon-btn:hover { background: var(--mgmt-card-alt, #152030); }
.right-icon-btn.active { background: #1a3d35; }
.icon-emoji { font-size: 16px; }
.right-spacer { flex: 1; }

/* ========== 弹出功能面板（右侧滑出） ========== */
.right-panel-overlay {
  position: fixed;
  top: 0;
  right: 44px;
  bottom: 0;
  z-index: 100;
  display: flex;
  justify-content: flex-end;
}
.right-panel {
  width: 320px;
  background: var(--mgmt-card-bg, #111b27);
  border-left: 1px solid #1e2a35;
  height: 100%;
  overflow-y: auto;
  box-shadow: -4px 0 20px rgba(0,0,0,0.3);
}
.panel-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px;
  border-bottom: 1px solid #1e2a35;
}
.panel-icon { font-size: 20px; }
.panel-title { font-size: 14px; font-weight: 600; flex: 1; }
.panel-close {
  width: 28px; height: 28px;
  border-radius: 6px;
  border: none;
  background: var(--mgmt-card-border, #1e2a35);
  color: #8696a0;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
}
.panel-close:hover { background: #2a3a4a; color: #e9edef; }
.panel-body { padding: 16px; }
.panel-skill-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 0;
  border-bottom: 1px solid #1e2a35;
}
.skill-icon { font-size: 16px; }
.skill-label { font-size: 13px; flex: 1; }
.skill-status { font-size: 11px; padding: 2px 8px; border-radius: 10px; }
.skill-status.active { background: #1a3d35; color: #00a884; }
.panel-kb-desc { font-size: 13px; color: #8696a0; line-height: 1.6; margin-bottom: 16px; }
.panel-action-btn {
  width: 100%;
  padding: 10px;
  border-radius: 8px;
  border: 1px dashed #2a3a4a;
  background: transparent;
  color: #8696a0;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}
.panel-action-btn:hover { border-color: #00a884; color: #00a884; }
.memory-item { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px solid #1e2a35; font-size: 13px; }
.memory-status-text { margin-left: auto; color: #00a884; font-size: 12px; }
.memory-stats { margin-top: 12px; font-size: 12px; color: #6b7c8d; }
.file-list-empty { text-align: center; padding: 40px 0; color: #4a5c6d; font-size: 13px; }
.status-dot { width: 6px; height: 6px; border-radius: 50%; background: #6b7c8d; }
.status-dot.online { background: #00a884; }

/* transitions */
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.slide-panel-enter-active, .slide-panel-leave-active { transition: all 0.25s ease; }
.slide-panel-enter-from, .slide-panel-leave-to { opacity: 0; transform: translateX(20px); }

/* scrollbar */
::-webkit-scrollbar { width: 5px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #2a3a4a; border-radius: 3px; }

/* mobile */
@media (max-width: 768px) {
  .item-name, .group-title, .item-time, .item-arrow, .sidebar-footer .user-name { display: none; }
  .group-item { justify-content: center; padding: 10px 8px; }
  .right-icon-bar { width: 36px; }
  .right-panel { width: 280px; }
  .right-panel-overlay { right: 36px; }
}
/* ===== 亮色主题适配 ===== */
[data-theme='light'] .agent-chat-page {
  background: var(--mgmt-bg, #f5f7fa);
}
[data-theme='light'] .agent-chat-page * {
  --text-color: var(--mgmt-text, #303133);
}
[data-theme='light'] .quick-btn {
  background: var(--mgmt-card-bg, #fff);
  border-color: var(--mgmt-card-border, #ebeef5);
  color: var(--mgmt-text, #303133);
}
[data-theme='light'] .quick-btn:hover {
  border-color: #00a884;
  background: #f0f9f4;
}
.cust-ctx { padding: 10px 12px; background: rgba(255,255,255,.04); border-radius: 10px; margin-bottom: 10px; }
.cust-ctx-label { font-size: 11px; color: #8696a0; margin-bottom: 4px; }
.cust-ctx-value { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #e9edef; font-weight: 500; }
.ctx-icon { font-size: 15px; }
.ctx-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cust-search { position: relative; margin-bottom: 10px; }
.cust-search-input { width: 100%; padding: 8px 28px 8px 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,.1); background: rgba(255,255,255,.06); color: #e9edef; font-size: 12px; outline: none; box-sizing: border-box; }
.cust-search-input::placeholder { color: #8696a0; }
.cust-search-clear { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); color: #8696a0; cursor: pointer; font-size: 12px; }
.cust-sessions { margin-bottom: 4px; }
.cust-session-group, .cust-group-title { font-size: 11px; color: #8696a0; padding: 6px 4px; }
.cust-session-item { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 8px; cursor: pointer; transition: background .15s; }
.cust-session-item:hover { background: rgba(255,255,255,.06); }
.cust-session-item.active { background: rgba(37,211,102,.12); }
.cs-icon { font-size: 14px; }
.cs-name { flex: 1; font-size: 13px; color: #e9edef; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cs-count { font-size: 11px; color: #8696a0; background: rgba(255,255,255,.08); padding: 1px 7px; border-radius: 10px; }
.cust-list { max-height: 320px; overflow-y: auto; }
.cust-item { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 8px; cursor: pointer; transition: background .15s; }
.cust-item:hover { background: rgba(255,255,255,.06); }
.cust-item.active { background: rgba(37,211,102,.12); }
.ci-avatar { width: 32px; height: 32px; border-radius: 50%; background: rgba(37,211,102,.15); color: #25d366; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 600; flex-shrink: 0; }
.ci-info { flex: 1; min-width: 0; }
.ci-name { font-size: 13px; color: #e9edef; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ci-sub { font-size: 11px; color: #8696a0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ci-level { font-size: 11px; color: #f5c34d; background: rgba(245,195,77,.12); padding: 1px 6px; border-radius: 8px; flex-shrink: 0; }
.cust-empty { padding: 20px; text-align: center; color: #8696a0; font-size: 12px; }
</style>
