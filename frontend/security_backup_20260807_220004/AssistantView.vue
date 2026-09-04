<template>
  <div class="assistant-view">


    <!-- 对话区域 -->
    <div class="chat-area" ref="chatArea">
      <div v-if="messages.length === 0" class="welcome">
        <div class="welcome-icon">🤖</div>
        <h3>外贸Agent</h3>
        <p class="welcome-intro">我是你的24小时外贸销售，随叫随到。</p>
        <ul class="welcome-highlights">
          <li>💬 谈客户、跟进提醒</li>
          <li>📊 分析市场、找采购商</li>
          <li>✍️ 写开发信、翻译、优化话术</li>
          <li>💰 报价、做单证、查汇率运费</li>
        </ul>
        <div class="quick-groups">
          <div class="quick-group">
            <div class="quick-group-title">🚀 快速上手</div>
            <div class="quick-actions">
              <button @click="sendQuick('查一下所有客户')">查一下所有客户</button>
              <button @click="sendQuick('给最新客户发个打招呼消息')">给最新客户打个招呼</button>
              <button @click="sendQuick('帮我总结今天待办')">总结今天待办</button>
            </div>
          </div>
          <div class="quick-group">
            <div class="quick-group-title">🔍 客户洞察</div>
            <div class="quick-actions">
              <button @click="sendQuick('分析一下客户画像')">分析客户画像</button>
              <button @click="sendQuick('查看客户时区和当地节假日')">查时区和节假日</button>
            </div>
          </div>
          <div class="quick-group">
            <div class="quick-group-title">✍️ 沟通写作</div>
            <div class="quick-actions">
              <button @click="sendQuick('帮我写一封英文开发信')">写英文开发信</button>
              <button @click="sendQuick('翻译这段话成西班牙语')">翻译成西班牙语</button>
              <button @click="sendQuick('帮我优化这段回复话术')">优化回复话术</button>
            </div>
          </div>
          <div class="quick-group">
            <div class="quick-group-title">💰 报价单证</div>
            <div class="quick-actions">
              <button @click="sendQuick('帮我做一份报价单')">做一份报价单</button>
              <button @click="sendQuick('生成PI形式发票')">生成PI形式发票</button>
              <button @click="sendQuick('查一下今天美元汇率')">查今天美元汇率</button>
            </div>
          </div>
          <div class="quick-group">
            <div class="quick-group-title">🚢 物流供应链</div>
            <div class="quick-actions">
              <button @click="sendQuick('查一下到洛杉矶的海运费')">查到洛杉矶海运费</button>
              <button @click="sendQuick('帮我做一份装箱单')">做一份装箱单</button>
              <button @click="sendQuick('查下HS编码')">查HS编码</button>
            </div>
          </div>
          <div class="quick-group">
            <div class="quick-group-title">🎯 营销策略</div>
            <div class="quick-actions">
              <button @click="sendQuick('分析一下美国玻璃市场')">分析美国玻璃市场</button>
              <button @click="sendQuick('帮我找玻璃制品采购商')">找玻璃制品采购商</button>
              <button @click="sendQuick('做一下客户分层分析')">客户分层分析</button>
            </div>
          </div>
        </div>
        <p class="welcome-hint">试试上面的快捷操作，或直接告诉我你需要什么 👇</p>
      </div>
      
      <div v-for="(msg, idx) in messages" :key="idx" class="message" :class="msg.role">
        <div class="message-avatar"><img v-if="msg.role === 'assistant'" src="/avatar_assistant.jpg" alt="AI" class="avatar-img" /><span v-else>👤</span></div>
        <div class="message-content">
          <div class="message-text" v-html="formatMessage(msg.content)"></div>
          <div v-if="msg.attachments && msg.attachments.length" class="message-attachments">
            <a v-for="(file, i) in msg.attachments" :key="i" :href="file.url" target="_blank" rel="noopener" class="msg-file-card">
              <div class="msg-file-icon">📄</div>
              <div class="msg-file-info">
                <div class="msg-file-name">{{ file.name }}</div>
              </div>
              <div class="msg-file-thumb">
                <svg viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              </div>
            </a>
          </div>
          
          <!-- 任务确认卡片 -->
          <div v-if="msg.tasks && msg.tasks.length > 0" class="task-card">
            <div v-for="task in msg.tasks" :key="task.id" class="task-item">
              <div class="task-info">
                <span class="task-label">{{ task.label || task.type }}</span>
                <span class="task-status" :class="task.status">{{ statusText(task.status) }}</span>
              </div>
              <div class="task-params" v-if="task.status === 'pending'">
                <pre>{{ JSON.stringify(task.params, null, 2) }}</pre>
              </div>
              <div class="task-actions" v-if="task.status === 'pending'">
                <button class="btn-confirm" @click="confirmTask(task)">✅ 确认执行</button>
                <button class="btn-cancel" @click="cancelTask(task)">❌ 取消</button>
              </div>
            </div>
          </div>
          
          <div class="message-time">{{ formatTime(msg.createdAt) }}</div>
        </div>
      </div>
      
      <div v-if="loading" class="message assistant">
        <div class="message-avatar"><img src="/avatar_assistant.jpg" alt="AI" class="avatar-img" /></div>
        <div class="message-content">
          <div class="typing-indicator">
            <span></span><span></span><span></span>
          </div>
        </div>
      </div>
    </div>

    <!-- 输入区域 (Coze风格) -->
    <div class="input-area">
      <!-- 附件预览 -->
      <div v-if="attachments.length > 0" class="attachments-preview">
        <div v-for="(file, idx) in attachments" :key="idx" class="attach-item">
          <span>{{ file.type?.startsWith('image') ? '🖼️' : '📄' }}</span>
          <span class="attach-name">{{ file.name }}</span>
          <button class="attach-remove" @click="removeAttachment(idx)">×</button>
        </div>
      </div>

      <!-- 执行状态提示条 -->
      <div v-if="loading" class="status-bar">
        <span class="status-dot"></span>
        <span class="status-text">{{ loadingStatus }}</span>
      </div>

      <!-- 主输入条（Coze风格卡片） -->
      <div class="input-card">
        <!-- 文本输入区 -->
        <textarea
          v-if="!isVoiceMode"
          v-model="inputMessage"
          @keydown.enter.exact.prevent="sendMessage"
          placeholder="发送消息开始任务"
          rows="1"
          ref="inputRef"
        ></textarea>
        <div v-else class="voice-bar">
          <button class="voice-main-btn" @click="isRecording ? stopVoice() : startVoice()">
            <svg v-if="isRecording" viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
            <svg v-else class="voice-mic-icon" viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5zm6 6c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>
            <span v-if="isRecording" class="voice-wave">
              <span></span><span></span><span></span><span></span>
            </span>
            <span v-else class="voice-label">按下说话</span>
          </button>
          <button class="voice-kb-btn" @click="toggleVoiceMode" title="切换键盘">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
          </button>
          <div v-if="voiceError" class="voice-error">{{ voiceError }}</div>
        </div>
        <!-- 下半：工具栏 -->
        <div class="toolbar-row">
          <div class="toolbar-left">
            <button class="tb-btn" @click="showAttachRow = !showAttachRow" title="添加">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>

          </div>
          <div class="toolbar-right">
            <button v-if="false" class="tb-btn mic-btn" @click="toggleVoiceMode" title="语音输入">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5zm6 6c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>
            </button>
            <button v-if="!isVoiceMode" class="model-btn" @click.stop="showModelSheet = !showModelSheet" title="模型">
              <span class="model-label">{{ currentModelName }}</span>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" style="opacity:0.5"><path d="M7 10l5 5 5-5z"/></svg>
            </button>
            <button v-if="!isVoiceMode" class="send-btn" @click="sendMessage" :disabled="loading || (!inputMessage.trim() && attachments.length === 0)">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
            </button>

          </div>
        </div>
      </div>

      <!-- 附件工具行（点击+展开） -->
      <div v-if="showAttachRow" class="attach-row">
        <button class="attach-btn" @click="triggerFileUpload">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>
          <span>图片</span>
        </button>
        <button class="attach-btn" @click="triggerFileUpload">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6z"/></svg>
          <span>文件</span>
        </button>
        <button class="attach-btn" @click="showSkillPage = true; showAttachRow = false">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 2l-5.5 9h11zm0 3.84L13.93 9h-3.87L12 5.84zM17.5 13c-2.49 0-4.5 2.01-4.5 4.5s2.01 4.5 4.5 4.5 4.5-2.01 4.5-4.5-2.01-4.5-4.5-4.5zm0 7c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5zM3 21.5h8v-8H3v8zm2-6h4v4H5v-4z"/></svg>
          <span>技能</span>
        </button>
      </div>

      <!-- 隐藏文件输入 -->
      <input type="file" ref="fileInput" multiple accept="image/*,.pdf,.doc,.docx,.txt,.csv,.xlsx" style="display:none" @change="handleFileSelect" />



      <!-- 模型切换浮动下拉（扣子风格） -->
      <transition name="fade-down">
        <div v-if="showModelSheet" class="model-dropdown-overlay" @click.self="showModelSheet = false">
          <div class="model-dropdown">
            <div class="model-dropdown-header">选择模型</div>
            <div class="model-dropdown-list">
              <!-- Auto智能选择 -->
              <div class="model-option" :class="{ active: showAutoModel }" @click="showAutoModel = true; showModelSheet = false">
                <span class="model-option-icon"></span>
                <div class="model-option-info">
                  <span class="model-option-name">Auto 智能选择</span>
                  <span class="model-option-desc">自动匹配性价比最高的模型</span>
                </div>
                <span v-if="showAutoModel" class="model-option-check">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12l5 5L20 7"/></svg>
                </span>
              </div>
              <div class="model-section-divider">
                <span>指定模型</span>
              </div>
              <div v-for="p in providers" :key="p.id" class="model-option" :class="{ active: !showAutoModel && selectedProviderId === p.id }" @click="showAutoModel = false; selectedProviderId = p.id; showModelSheet = false">
                <span class="model-option-icon">{{ p.icon || getProviderIcon(p.name) }}</span>
                <div class="model-option-info">
                  <span class="model-option-name">{{ p.name }}</span>
                  <span v-if="p.tag" class="model-option-tag" :class="p.tagType || 'default'">{{ p.tag }}</span>
                </div>
                <span v-if="!showAutoModel && selectedProviderId === p.id" class="model-option-check">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12l5 5L20 7"/></svg>
                </span>
              </div>
            </div>
          </div>
        </div>
      </transition>

      <!-- 全屏技能页面 -->
      <transition name="fade">
        <div v-if="showSkillPage" class="fullpage-overlay" @click.self="showSkillPage = false">
          <div class="fullpage-panel">
            <div class="fullpage-header">
              <button class="fullpage-back" @click="showSkillPage = false">
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
              </button>
              <span class="fullpage-title">技能</span>
            </div>
            <div class="fullpage-body">
              <div v-for="skill in availableSkills" :key="skill.key" class="skill-card">
                <div class="skill-card-icon">{{ skill.icon }}</div>
                <div class="skill-card-body">
                  <div class="skill-card-name">{{ skill.label }}</div>
                  <div class="skill-card-desc">{{ skill.desc || skill.label }}</div>
                </div>
                <div class="skill-toggle" role="switch" :class="{ on: activeSkills.includes(skill.key) }" @click="toggleSkill(skill.key)">
                  <span class="skill-toggle-dot"></span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </transition>
    </div>

    <!-- Agent详情页（侧滑面板） -->
    <transition name="slide-right">
      <div v-if="showProfile" class="profile-overlay" @click.self="showProfile = false">
        <div class="profile-panel">
          <div class="profile-close" @click="showProfile = false">✕</div>

          <!-- 头像+基本信息 -->
          <div class="profile-header">
            <div class="profile-avatar-wrap">
              <span class="profile-avatar"><img src="/avatar_assistant.jpg" alt="AI" class="avatar-img" /></span>
              <span class="profile-avatar-badge">✏️</span>
            </div>
            <div class="profile-name">外贸Agent</div>
            <div class="profile-status">
              <span class="status-dot online"></span>
              <span>在线</span>
            </div>
          </div>

          <!-- 名称 -->
          <div class="profile-section">
            <div class="profile-field-label">名称</div>
            <div class="profile-field-value">销售智能体负责人</div>
          </div>

          <!-- 介绍 -->
          <div class="profile-section">
            <div class="profile-field-label">介绍</div>
            <div class="profile-field-value profile-desc">
              你的全能外贸助理，既能操作CRM（查客户、发消息、更新状态），也能自由聊天、翻译、分析数据、写文案。
            </div>
          </div>

          <!-- 能力与资源 -->
          <div class="profile-section">
            <div class="profile-section-title">能力与资源</div>

            <!-- 技能 -->
            <div class="profile-item">
              <div class="profile-item-icon">🧩</div>
              <div class="profile-item-body">
                <div class="profile-item-title">技能</div>
                <div class="profile-item-list">
                  <span class="profile-chip" v-for="s in availableSkills" :key="s.key">{{ s.icon }} {{ s.label }}</span>
                </div>
              </div>
            </div>

            <!-- 渠道 -->
            <div class="profile-item">
              <div class="profile-item-icon">📡</div>
              <div class="profile-item-body">
                <div class="profile-item-title">渠道</div>
                <div class="profile-item-list">
                  <span class="profile-chip">💬 WhatsApp</span>
                  <span class="profile-chip">📧 Email</span>
                </div>
              </div>
            </div>

            <!-- 模型设置 -->
            <div class="profile-item">
              <div class="profile-item-icon">🧠</div>
              <div class="profile-item-body">
                <div class="profile-item-title">模型设置</div>
                <div class="profile-item-list">
                  <span class="profile-chip" v-for="p in providers" :key="p.id">
                    {{ p.name }}{{ p.isDefault ? ' ✓' : '' }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- 创建者 -->
          <div class="profile-footer">
            由 Jeremy 创建
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, onMounted, onActivated, nextTick, watch } from 'vue';
import api from '../utils/api.js';

const messages = ref([]);
const inputMessage = ref('');
const loading = ref(false);
const loadingStatus = ref('');
const providers = ref([]);
const selectedProviderId = ref('');
const defaultProviderId = ref('');
const attachments = ref([]);
const inputFocused = ref(false);
const showAttachRow = ref(false);
const showEmojiPicker = ref(false);
const showModelSheet = ref(false);
const isVoiceMode = ref(false);
const isRecording = ref(false);
const voiceError = ref('');
let recognition = null;
const showSkillPage = ref(false);
const showAutoModel = ref(true); // 'Auto' = smart routing
const currentModelName = computed(() => {
  if (showAutoModel.value) return 'Auto';
  const p = providers.value.find(p => p.id === selectedProviderId.value);
  return p ? p.name.split(' ')[0] : '模型';
});

function getProviderIcon(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('deepseek')) return '🤖';
  if (n.includes('gpt') || n.includes('openai')) return '🟢';
  if (n.includes('glm')) return '🔵';
  if (n.includes('kimi') || n.includes('moonshot')) return '🌙';
  if (n.includes('doubao') || n.includes('volcengine')) return '🟠';
  if (n.includes('qwen') || n.includes('tongyi')) return '🔷';
  if (n.includes('claude')) return '🟤';
  return '🤖';
}
const selectedDataset = ref('');
const activeSkills = ref([]);
const fileInput = ref(null);
const showProfile = ref(false)
// Listen for profile open event from LayoutView nav bar
if (typeof window !== 'undefined') {
  window.addEventListener('open-assistant-profile', () => {
    showProfile.value = true
  })
}
;

const availableSkills = [
  // 营销获客
  { key: 'smart_acquisition', label: '智能获客', icon: '🎯', desc: '全球采购商数据库挖掘高意向线索' },
  { key: 'market_analysis', label: '市场分析', icon: '📊', desc: '目标市场规模、竞争格局分析' },
  // 沟通触达
  { key: 'email_automation', label: '邮件自动化', icon: '📧', desc: 'AI撰写多语种开发信，自动跟进' },
  { key: 'multi_channel', label: '多渠道沟通', icon: '💬', desc: 'WA/TG/邮箱统一收件箱' },
  { key: 'sales_script', label: '销售话术库', icon: '🎭', desc: '场景话术模板，AI推荐策略' },
  { key: 'translate', label: '多语种翻译', icon: '🌐', desc: '英/西/法/阿/俄/葡专业翻译' },
  { key: 'ai_copilot', label: 'AI实时话术Copilot', icon: '🤖', desc: '三种风格回复建议，一键发送' },
  { key: 'inquiry_classify', label: '询盘智能分类', icon: '🏷️', desc: '7类询盘自动识别+针对性回复' },
  // 单证合规
  { key: 'doc_generator', label: '单证生成', icon: '📋', desc: '报价单/发票/合同/报关单' },
  { key: 'quotation', label: '外贸报价单', icon: '💰', desc: '多币种+Incoterms报价' },
  { key: 'pi_ci', label: 'PI/CI', icon: '📄', desc: '形式发票和商业发票生成' },
  { key: 'contract', label: '销售合同', icon: '📝', desc: '外贸合同自动生成' },
  { key: 'customs_decl', label: '报关单', icon: '🏛️', desc: 'HS编码智能匹配' },
  { key: 'packing_list', label: '装箱单', icon: '📦', desc: '多箱多品规格装箱单' },
  // 客户管理
  { key: 'customer_followup', label: '客户跟进', icon: '⏰', desc: '智能跟进提醒与记录管理' },
  { key: 'customer_tier', label: '客户分层', icon: '⭐', desc: 'RFM模型分析，差异化策略' },
  { key: 'world_clock', label: '世界时钟与文化', icon: '🌍', desc: '当地时间/节假日/文化禁忌' },
  { key: 'customer_profile', label: '客户画像', icon: '👤', desc: '360°画像报告' },
  // 物流运输
  { key: 'freight_query', label: '海运费查询', icon: '🚢', desc: '实时报价与航线推荐' },
  { key: 'exchange_rate', label: '汇率计算', icon: '💱', desc: '实时汇率与利润测算' },
  // 供应链
  { key: 'production_track', label: '生产进度跟进', icon: '🏭', desc: '实时跟踪与异常预警' },
  { key: 'fulfillment', label: '履约跟踪', icon: '📦', desc: '物流状态与进度监控' },
];

const datasets = [
  { key: 'customers', label: '客户数据', icon: '👥' },
  { key: 'orders', label: '订单数据', icon: '📦' },
  { key: 'products', label: '产品资料', icon: '📄' },
];
const chatArea = ref(null);
const inputRef = ref(null);

// 加载对话历史
async function loadHistory() {
  try {
    const res = await api.get('/assistant/conversations');
    messages.value = res.data || [];
  } catch (e) {
    console.warn('load history failed:', e.message);
  }
}

// 发送消息
async function sendMessage() {
  const msg = inputMessage.value.trim();
  if ((!msg && attachments.value.length === 0) || loading.value) return;
  
  inputMessage.value = '';
  loading.value = true;
  const sendStartTime = Date.now();
  loadingStatus.value = '外贸Agent正在思考...';
  
  // 收集附件信息（在清空前）
  const msgAttachments = attachments.value.map(file => ({
    name: file.name,
    type: file.type,
    url: URL.createObjectURL(file)
  }));

  // 添加用户消息到列表
  messages.value.push({
    role: 'user',
    content: msg,
    attachments: msgAttachments.length ? msgAttachments : undefined,
    createdAt: new Date().toISOString()
  });
  
  scrollToBottom();

  // 保存附件引用（清空前）
  const filesToUpload = [...attachments.value];
  // 清空附件
  attachments.value = [];
  
  try {
    // 上传附件
    const formData = new FormData();
    formData.append('message', msg || '附件');
    if (!showAutoModel.value && selectedProviderId.value) formData.append('providerId', selectedProviderId.value);
    if (selectedDataset.value) formData.append('dataset', selectedDataset.value);
    if (activeSkills.value.length) formData.append('skills', JSON.stringify(activeSkills.value));
    for (const file of filesToUpload) {
      formData.append('files', file);
    }
    loadingStatus.value = '正在执行任务...';
    const res = await api.post('/assistant/chat', formData);
    const data = res.data;
    
    // 收集附件信息
    const replyAttachments = [];
    if (data.attachments && data.attachments.length) {
      replyAttachments.push(...data.attachments);
    }
    // 从回复文本中提取文件URL（兜底）
    const replyText = data.reply || '好的';
    const urlMatch = replyText.match(/(https?:\/\/[^\s]+\.(?:pdf|docx|xlsx|pptx|zip))/i);
    if (urlMatch && replyAttachments.length === 0) {
      const fname = urlMatch[1].split('/').pop();
      replyAttachments.push({ name: decodeURIComponent(fname), url: urlMatch[1], type: 'application/pdf' });
    }
    
    // 添加助理回复
    messages.value.push({
      role: 'assistant',
      content: data.reply || '好的',
      tasks: data.tasks || [],
      attachments: replyAttachments.length ? replyAttachments : undefined,
      createdAt: new Date().toISOString()
    });
  } catch (e) {
    messages.value.push({
      role: 'assistant',
      content: `❌ 出错了：${e.response?.data?.error || e.message}`,
      createdAt: new Date().toISOString()
    });
  } finally {
    // 确保状态提示至少显示1.5秒
    const minDisplay = 1500;
    const elapsed = Date.now() - sendStartTime;
    const remaining = minDisplay - elapsed;
    if (remaining > 0) {
      await new Promise(r => setTimeout(r, remaining));
    }
    loading.value = false;
    scrollToBottom();
  }
}


// 文件上传
function triggerFileUpload() {
  fileInput.value?.click();
}

function handleFileSelect(e) {
  const files = Array.from(e.target.files || []);
  for (const file of files) {
    if (attachments.value.length >= 5) break;
    attachments.value.push(file);
  }
  e.target.value = '';
}

function removeAttachment(idx) {
  attachments.value.splice(idx, 1);
}

const toggleSkill = (key) => {
  const idx = activeSkills.value.indexOf(key);
  if (idx >= 0) activeSkills.value.splice(idx, 1);
  else activeSkills.value.push(key);
}



// 快捷指令
function sendQuick(msg) {
  inputMessage.value = msg;
  sendMessage();
}

// 确认任务
async function confirmTask(task) {
  try {
    const res = await api.post(`/assistant/tasks/${task.id}/confirm`);
    // 更新任务状态
    task.status = 'executed';
    // 添加执行结果
    messages.value.push({
      role: 'assistant',
      content: res.data.reply || '✅ 任务已执行',
      createdAt: new Date().toISOString()
    });
    scrollToBottom();
  } catch (e) {
    alert('执行失败：' + (e.response?.data?.error || e.message));
  }
}

// 取消任务
async function cancelTask(task) {
  try {
    await api.post(`/assistant/tasks/${task.id}/cancel`);
    task.status = 'cancelled';
  } catch (e) {
    alert('取消失败：' + (e.response?.data?.error || e.message));
  }
}

// 清空对话
async function clearChat() {
  if (!confirm('确定清空所有对话记录？')) return;
  messages.value = [];
  // TODO: API to clear conversations
}

// 格式化消息内容
function formatMessage(content) {
  if (!content) return '';
  let s = content;
  // 清除Markdown符号
  s = s.replace(/\*\*(.+?)\*\*/g, '$1');
  s = s.replace(/\*(.+?)\*/g, '$1');
  s = s.replace(/__(.+?)__/g, '$1');
  s = s.replace(/_(.+?)_/g, '$1');
  s = s.replace(/^### (.+)$/gm, '$1');
  s = s.replace(/^## (.+)$/gm, '$1');
  s = s.replace(/^# (.+)$/gm, '$1');
  s = s.replace(/^---+$/gm, '');
  s = s.replace(/^\* (.+)$/gm, '$1');
  s = s.replace(/^- (.+)$/gm, '$1');
  s = s.replace(/^\d+\. (.+)$/gm, '$1');
  s = s.replace(/`([^`]+)`/g, '$1');
  s = s.replace(/\n{3,}/g, '\n\n');
  s = s.trim();
  // 移除下载地址行（已渲染为卡片）
  s = s.replace(/📄\s*下载地址：https?:\/\/[^\s]+/g, '');
  s = s.replace(/https?:\/\/[^\s]+\.(?:pdf|docx|xlsx|pptx|zip)/gi, '');
  return s
    .replace(/\n/g, '<br>')
    .replace(/✅/g, '<span style="color:#34a853">✅</span>')
    .replace(/❌/g, '<span style="color:#ea4335">❌</span>')
    .replace(/⏳/g, '<span style="color:#fbbc04">⏳</span>');
}

// 状态文本
function statusText(status) {
  const map = {
    pending: '待确认',
    confirmed: '已确认',
    executed: '已执行',
    cancelled: '已取消',
    failed: '失败'
  };
  return map[status] || status;
}

// 格式化时间
function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

// 滚动到底部
function scrollToBottom() {
  nextTick(() => {
    if (chatArea.value) {
      chatArea.value.scrollTop = chatArea.value.scrollHeight;
    }
  });
}

// 语音输入功能
function toggleVoiceMode() {
  isVoiceMode.value = !isVoiceMode.value;
  if (isVoiceMode.value) {
    inputFocused.value = false;
    initRecognition();
  } else {
    if (isRecording.value) stopVoice();
  }
}

function initRecognition() {
  if (recognition) return;
  // HTTPS检查
  if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
    voiceError.value = '语音识别需要HTTPS';
    return;
  }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    voiceError.value = '浏览器不支持语音识别';
    return;
  }
  voiceError.value = '';
  recognition = new SR();
  recognition.lang = 'zh-CN';
  recognition.continuous = true;
  recognition.interimResults = true;
  let finalTranscript = '';
  recognition.onresult = (event) => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      if (event.results[i].isFinal) {
        finalTranscript += event.results[i][0].transcript;
      } else {
        interim += event.results[i][0].transcript;
      }
    }
    if (finalTranscript) {
      inputMessage.value += finalTranscript;
      finalTranscript = '';
    }
  };
  recognition.onend = () => {
    if (isRecording.value) {
      try { recognition.start(); } catch(e) {}
    }
  };
  recognition.onerror = (e) => {
    console.warn('语音识别错误:', e.error);
    if (e.error === 'not-allowed') {
      voiceError.value = '请允许麦克风权限';
      isRecording.value = false;
    } else if (e.error === 'network') {
      voiceError.value = '网络连接失败';
      isRecording.value = false;
    } else if (e.error === 'no-speech') {
      // 自动重试，不显示错误
    } else {
      voiceError.value = '语音识别异常: ' + e.error;
      isRecording.value = false;
    }
  };
}

function startVoice() {
  if (!recognition) initRecognition();
  if (!recognition) return;
  try {
    recognition.start();
    isRecording.value = true;
  } catch(e) {}
}

function stopVoice() {
  isRecording.value = false;
  if (recognition) {
    recognition.stop();
  }
}

onMounted(() => {
  loadHistory();
  loadProviders();
  inputRef.value?.focus();
});

onActivated(async () => {
  await loadHistory();
  nextTick(() => scrollToBottom());
});

watch(messages, () => {
  nextTick(() => scrollToBottom());
}, { deep: true });

async function loadProviders() {
  try {
    const res = await api.get('/assistant/providers');
    providers.value = res.data || [];
    const def = providers.value.find(p => p.isDefault);
    selectedProviderId.value = def ? def.id : (providers.value[0]?.id || '');
    defaultProviderId.value = selectedProviderId.value;
  } catch (e) {
    console.warn('load providers failed:', e.message);
  }
}
</script>

<style scoped>
.assistant-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--input-bg);
}

.assistant-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border, #e5e7eb);
  background: var(--msg-incoming);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-icon {
  font-size: 24px;
}

.header-left h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.clear-btn {
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  opacity: 0.6;
}

.clear-btn:hover {
  opacity: 1;
  background: var(--msg-incoming);
}

.chat-area {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  background: var(--chat-bg);
}

.welcome {
  text-align: center;
  padding: 32px 16px 20px;
  color: var(--text-secondary);
}

.avatar-img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
  display: block;
}
.welcome-icon {
  width: 64px;
  height: 64px;
  margin: 0 auto 12px;
  overflow: hidden;
}

.welcome h3 {
  margin: 0 0 6px;
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
}

.welcome-intro {
  margin: 0 0 12px;
  font-size: 15px;
  color: var(--text-secondary);
}

.welcome-highlights {
  list-style: none;
  padding: 0;
  margin: 0 0 20px;
  text-align: left;
  max-width: 280px;
  margin-left: auto;
  margin-right: auto;
}

.welcome-highlights li {
  padding: 4px 0;
  font-size: 14px;
  color: var(--text-secondary);
}

.quick-groups {
  display: flex;
  flex-direction: column;
  gap: 16px;
  text-align: left;
  max-width: 360px;
  margin: 0 auto;
}

.quick-group-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.quick-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.quick-actions button {
  padding: 6px 12px;
  border: 1px solid var(--border-color);
  border-radius: 20px;
  background: var(--input-bg);
  cursor: pointer;
  font-size: 13px;
  color: var(--text-secondary);
  transition: all 0.2s;
}

.quick-actions button:hover {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--msg-outgoing);
}

.welcome-hint {
  margin: 20px 0 0;
  font-size: 13px;
  color: var(--text-tertiary, #999);
}

.message {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.message.user {
  flex-direction: row-reverse;
}

.message-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  flex-shrink: 0;
  background: var(--msg-incoming);
}

.message-content {
  max-width: 70%;
  min-width: 60px;
}

.message-text {
  padding: 10px 14px;
  border-radius: 12px;
  font-size: 14px;
  line-height: 1.4;
  word-break: break-word;
}

.message.user .message-text {
  background: var(--msg-outgoing);
  color: var(--text-primary);
  border-top-right-radius: 4px;
}

.message.assistant .message-text {
  background: var(--msg-incoming);
  color: var(--text-primary);
  border-top-left-radius: 4px;
}

.message-time {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 4px;
  padding: 0 4px;
}

.message.user .message-time {
  text-align: right;
}

/* 任务确认卡片 */
.task-card {
  margin-top: 8px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  overflow: hidden;
  background: var(--msg-incoming);
}

.task-item {
  padding: 10px 12px;
}

.task-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.task-label {
  font-weight: 600;
  font-size: 13px;
}

.task-status {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
}

.task-status.pending {
  background: #fef3c7;
  color: #92400e;
}

.task-status.executed {
  background: #d1fae5;
  color: #065f46;
}

.task-status.cancelled {
  background: #fee2e2;
  color: #991b1b;
}

.task-params {
  margin: 6px 0;
  padding: 8px;
  background: var(--input-bg);
  border-radius: 4px;
  font-size: 12px;
  overflow-x: auto;
}

.task-params pre {
  margin: 0;
  white-space: pre-wrap;
}

.task-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.btn-confirm, .btn-cancel {
  padding: 6px 12px;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  font-weight: 500;
}

.btn-confirm {
  background: var(--accent, #3b82f6);
  color: #fff;
}

.btn-cancel {
  background: var(--bg-tertiary, #e5e7eb);
  color: var(--text-primary);
}

/* ===== Coze风格输入区域 ===== */
.input-area {
  position: relative;
  padding: 8px 12px 12px;
  border-top: 1px solid var(--border-color);
  background: var(--panel-bg);
}

/* 主输入条：Coze风格卡片 */
.input-card {
  background: var(--input-bg);
  border-radius: 16px;
  padding: 0;
  display: flex;
  flex-direction: column;
}
.input-card textarea {
  width: 100%;
  border: none;
  outline: none;
  background: transparent;
  color: var(--text-primary);
  font-size: 15px;
  padding: 10px 14px 4px;
  resize: none;
  height: 40px;
  max-height: 80px;
  line-height: 1.3;
  font-family: inherit;
  box-sizing: border-box;
}
.input-card textarea::placeholder {
  color: var(--text-secondary);
  opacity: 0.6;
}





/* 发送按钮 */
.send-btn {
  width: 38px !important;
  height: 38px !important;
  min-width: 38px !important;
  padding: 0 !important;
  background: var(--accent, #00a884) !important;
  color: #fff !important;
  border: none !important;
  border-radius: 50% !important;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.2s;
}
.send-btn:disabled { opacity: 0.35; cursor: not-allowed; }
.send-btn:hover:not(:disabled) { background: #00c49a !important; }

/* 附件工具行 */
.attach-row {
  display: flex;
  gap: 8px;
  padding: 10px 4px 4px;
}
.attach-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 8px 14px;
  border: none;
  border-radius: 16px;
  background: var(--sidebar-active);
  color: var(--text-primary);
  font-size: 13px;
  cursor: pointer;
  transition: background 0.15s;
}
.attach-btn:hover { background: #3b4a54; }
.attach-btn svg { color: var(--text-secondary); }

/* 工具栏行 */
.toolbar-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 8px 8px;
  gap: 4px;
}
.toolbar-left, .toolbar-right {
  display: flex;
  align-items: center;
  gap: 2px;
}
.toolbar-right {
  gap: 4px;
}
.tb-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  flex-shrink: 0;
  padding: 0;
  transition: background 0.15s, color 0.15s;
}
.tb-btn:hover { background: var(--sidebar-active); color: var(--text-primary); }
.model-btn {
  width: auto;
  border-radius: 20px;
  padding: 5px 12px 5px 10px;
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.1);
  gap: 4px;
  transition: all 0.2s;
}
.model-btn:hover { background: rgba(255,255,255,0.14); border-color: rgba(255,255,255,0.2); }
.model-btn { margin-right: 8px; }
.model-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
}

/* 语音模式 - Coze风格 */
.voice-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  min-height: 52px;
}
.voice-main-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 44px;
  border: none;
  border-radius: 22px;
  background: var(--sidebar-active, #2a3441);
  color: var(--text-primary, #e9edef);
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  user-select: none;
  -webkit-user-select: none;
}
.voice-main-btn:active {
  background: var(--accent, #00a884);
  color: #fff;
}
.voice-mic-icon { flex-shrink: 0; }
.voice-label { letter-spacing: 1px; }
.voice-kb-btn {
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--text-secondary, #8696a0);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: color 0.2s;
}
.voice-kb-btn:hover { color: var(--text-primary); }
.voice-error {
  font-size: 12px;
  color: #e53935;
  white-space: nowrap;
}

/* 语音波形动画 */
.voice-wave {
  display: flex;
  align-items: center;
  gap: 3px;
  height: 20px;
}
.voice-wave span {
  display: block;
  width: 3px;
  height: 10px;
  background: #fff;
  border-radius: 2px;
  animation: wave 0.8s ease-in-out infinite;
}
.voice-wave span:nth-child(2) { animation-delay: 0.15s; }
.voice-wave span:nth-child(3) { animation-delay: 0.3s; }
.voice-wave span:nth-child(4) { animation-delay: 0.45s; }
@keyframes wave {
  0%, 100% { height: 5px; opacity: 0.6; }
  50% { height: 18px; opacity: 1; }
}

/* 模型切换浮动下拉（扣子风格） */
.model-dropdown-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  z-index: 200;
}
.model-dropdown {
  position: fixed;
  bottom: 72px;
  right: 24px;
  width: 340px;
  max-height: 420px;
  background: #1e1e2e;
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05);
  overflow: hidden;
  backdrop-filter: blur(20px);
}
.model-dropdown-header {
  padding: 14px 16px 10px;
  font-size: 14px;
  font-weight: 600;
  color: rgba(255,255,255,0.5);
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.model-dropdown-list {
  max-height: 360px;
  overflow-y: auto;
  padding: 6px 0;
}
.model-dropdown-list::-webkit-scrollbar { width: 4px; }
.model-dropdown-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 2px; }

.model-option {
  display: flex;
  align-items: center;
  padding: 10px 16px;
  cursor: pointer;
  transition: background 0.15s;
  gap: 10px;
}
.model-option:hover { background: rgba(255,255,255,0.08); }
.model-option.active { background: rgba(255,255,255,0.06); }
.model-option-icon {
  font-size: 20px;
  flex-shrink: 0;
  width: 28px;
  text-align: center;
}
.model-option-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.model-option-name {
  font-size: 14px;
  color: rgba(255,255,255,0.9);
  font-weight: 500;
}
.model-option-desc {
  font-size: 11px;
  color: rgba(255,255,255,0.35);
}
.model-option-tag {
  display: inline-block;
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 4px;
  margin-left: 6px;
  font-weight: 500;
  vertical-align: middle;
}
.model-option-tag.recommended { background: rgba(0,168,132,0.2); color: #00a884; }
.model-option-tag.fast { background: rgba(79,195,247,0.2); color: #4FC3F7; }
.model-option-tag.default { background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.5); }
.model-option-check {
  flex-shrink: 0;
  color: #00a884;
  display: flex;
  align-items: center;
}
.model-section-divider {
  padding: 8px 16px 4px;
  font-size: 11px;
  color: rgba(255,255,255,0.3);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.model-section-divider span {
  display: inline-block;
  padding: 2px 8px;
  background: rgba(255,255,255,0.04);
  border-radius: 4px;
}

/* fade-down transition */
.fade-down-enter-active, .fade-down-leave-active { transition: opacity 0.2s, transform 0.2s; }
.fade-down-enter-from { opacity: 0; transform: translateY(8px); }
.fade-down-leave-to { opacity: 0; transform: translateY(8px); }

/* 全屏技能页 */
.fullpage-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: var(--panel-bg);
  z-index: 300;
}
.fullpage-panel {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}
.fullpage-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}
.fullpage-back {
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0 !important;
}
.fullpage-back:hover { background: var(--sidebar-active); }
.fullpage-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
}
.fullpage-body {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px;
}
.skill-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 12px;
  border-radius: 12px;
  margin-bottom: 8px;
  background: var(--input-bg);
  transition: background 0.15s;
}
.skill-card:hover { background: var(--sidebar-active); }
.skill-card-icon {
  font-size: 28px;
  flex-shrink: 0;
}
.skill-card-body {
  flex: 1;
  min-width: 0;
}
.skill-card-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}
.skill-card-desc {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.skill-toggle {
  width: 44px;
  height: 24px;
  border-radius: 12px;
  background: #343a40;
  cursor: pointer;
  position: relative;
  flex-shrink: 0;
  padding: 0;
  margin: 0;
  overflow: hidden;
  outline: none;
  box-shadow: inset 0 1px 3px rgba(0,0,0,0.2);
  transition: background 0.25s;
  display: inline-flex;
  align-items: center;
}
.skill-toggle.on {
  background: #34c759;
}
.skill-toggle-dot {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0,0,0,0.25);
  transition: transform 0.25s cubic-bezier(0.4,0,0.2,1);
}
.skill-toggle.on .skill-toggle-dot {
  transform: translateX(20px);
}

/* 附件预览 */
.message-attachments {
  margin-top: 6px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.msg-attach-item {
  border-radius: 8px;
  overflow: hidden;
}
.msg-image {
  max-width: 180px;
  max-height: 140px;
  border-radius: 8px;
  cursor: pointer;
  display: block;
}
.attachments-preview {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  padding: 0 0 6px 4px;
}
.attach-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  background: var(--sidebar-active);
  border-radius: 8px;
  font-size: 12px;
  color: var(--text-secondary);
}
.attach-remove {
  background: none !important;
  border: none !important;
  color: var(--text-secondary) !important;
  cursor: pointer;
  font-size: 14px;
  padding: 0 2px !important;
  width: auto !important;
  min-width: 0 !important;
  height: auto !important;
}

/* 过渡动画 */
.slide-up-enter-active { animation: slideUp 0.25s ease-out; }
.slide-up-leave-active { animation: slideUp 0.2s ease-in reverse; }
@keyframes slideUp {
  from { transform: translateY(100%); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
.fade-enter-active { animation: fadeIn 0.2s; }
.fade-leave-active { animation: fadeIn 0.2s reverse; }
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* 打字指示器 */
.typing-indicator {
  display: flex;
  gap: 4px;
  padding: 8px 0;
}

.typing-indicator span {
  width: 8px;
  height: 8px;
  background: var(--text-secondary, #999);
  border-radius: 50%;
  animation: typing 1.4s infinite ease-in-out;
}

.typing-indicator span:nth-child(1) { animation-delay: 0s; }
.typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
.typing-indicator span:nth-child(3) { animation-delay: 0.4s; }

@keyframes typing {
  0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
  30% { transform: translateY(-4px); opacity: 1; }
}

/* 手机端适配 */
@media (max-width: 768px) {
  .message-content {
    max-width: 85%;
  }
  .quick-groups {
    gap: 12px;
  }
  .quick-actions button {
    font-size: 13px;
    padding: 6px 10px;
  }
}


/* Agent Profile Panel */
.profile-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.5);
  z-index: 1000;
  display: flex;
  justify-content: flex-end;
}
.profile-panel {
  width: 100%;
  max-width: 380px;
  height: 100%;
  background: var(--panel-bg);
  overflow-y: auto;
  box-shadow: -4px 0 20px rgba(0,0,0,0.3);
  animation: slideIn 0.25s ease-out;
}
@keyframes slideIn {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}
.slide-right-enter-active { animation: slideIn 0.25s ease-out; }
.slide-right-leave-active { animation: slideIn 0.25s ease-out reverse; }
.profile-close {
  position: sticky;
  top: 0;
  text-align: right;
  padding: 12px 16px 0;
  font-size: 20px;
  color: var(--text-secondary);
  cursor: pointer;
  z-index: 1;
}
.profile-close:hover { color: var(--text-primary); }
.profile-header {
  text-align: center;
  padding: 16px 20px 24px;
}
.profile-avatar-wrap {
  position: relative;
  display: inline-block;
}
.profile-avatar {
  font-size: 56px;
  line-height: 1;
}
.profile-avatar-badge {
  position: absolute;
  bottom: 0; right: -4px;
  font-size: 16px;
  background: var(--accent, #00a884);
  width: 22px; height: 22px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
}
.profile-name {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
  margin-top: 10px;
}
.profile-status {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  margin-top: 6px;
  font-size: 12px;
  color: var(--text-secondary);
}
.status-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  background: #666;
}
.status-dot.online { background: #25d366; }
.profile-section {
  padding: 12px 20px;
  border-top: 1px solid var(--border-color);
}
.profile-section-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 12px;
}
.profile-field-label {
  font-size: 11px;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
}
.profile-field-value {
  font-size: 14px;
  color: var(--text-primary);
}
.profile-desc {
  line-height: 1.4;
  margin-top: 4px;
  font-size: 13px;
}
.profile-item {
  display: flex;
  gap: 12px;
  padding: 10px 0;
}
.profile-item + .profile-item {
  border-top: 1px solid var(--border-color);
}
.profile-item-icon {
  font-size: 20px;
  flex-shrink: 0;
  width: 28px;
  text-align: center;
}
.profile-item-body { flex: 1; min-width: 0; }
.profile-item-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 6px;
}
.profile-item-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.profile-chip {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 12px;
  background: var(--sidebar-active);
  font-size: 11px;
  color: var(--text-secondary);
  white-space: nowrap;
}
.profile-footer {
  padding: 16px 20px;
  border-top: 1px solid var(--border-color);
  font-size: 12px;
  color: var(--text-secondary);
  text-align: center;
}

/* 执行状态提示条 */
.status-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: transparent;
}
.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--text-secondary, #6b7280);
  animation: statusPulse 1.5s ease-in-out infinite;
}
@keyframes statusPulse {
  0%, 100% { opacity: 0.3; transform: scale(0.8); }
  50% { opacity: 1; transform: scale(1); }
}
.status-text {
  font-size: 13px;
  color: var(--text-secondary, #6b7280);
  letter-spacing: 0.5px;
}
.msg-file-card {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--msg-incoming, #202c33);
  border: 1px solid var(--border-color, #2a3942);
  border-radius: 10px;
  padding: 8px 12px;
  margin-top: 6px;
  max-width: 260px;
  cursor: pointer;
  text-decoration: none;
  transition: box-shadow 0.2s;
}
.msg-file-card:hover {
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
}
.msg-file-icon {
  font-size: 22px;
  flex-shrink: 0;
  width: 28px;
  text-align: center;
}
.msg-file-info {
  flex: 1;
  min-width: 0;
}
.msg-file-name {
  font-size: 13px;
  color: var(--text-primary, #e9edef);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 500;
}
.msg-file-thumb {
  flex-shrink: 0;
  width: 38px;
  height: 38px;
  border-radius: 6px;
  background: var(--panel-header-bg, #2a3942);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.msg-file-thumb svg {
  width: 20px;
  height: 20px;
  stroke: var(--text-secondary, #8696a0);
}
</style>
