<template>
  <div class="wg-root">
    <!-- 顶部栏 -->
    <header class="wg-header">
      <button class="wg-back" @click="goBack" title="返回">‹</button>
      <div class="wg-header-title">
        <span class="wg-title-icon">👥</span>
        <div>
          <div class="wg-title">工作群组</div>
          <div class="wg-subtitle">{{ members.length }} 位成员 · {{ agents.length }} 个 Agent</div>
        </div>
      </div>
      <button class="wg-members-toggle" @click="showMembers = !showMembers">{{ showMembers ? '收起成员' : '成员' }}</button>
    </header>

    <div class="wg-body">
      <!-- 消息区 -->
      <div class="wg-chat" ref="chatRef">
        <div v-if="messages.length === 0" class="wg-empty">
          <div class="wg-empty-icon">👥</div>
          <div class="wg-empty-t1">工作群组已建立</div>
          <div class="wg-empty-sub">@ 任意 Agent，即可发起协作沟通</div>
        </div>
        <div v-for="m in messages" :key="m.id" class="wg-msg-row" :class="{ mine: m.senderType === 'user' }">
          <div v-if="m.senderType === 'agent'" class="wg-avatar" :style="{ background: agentColor(m.senderKey) }">{{ agentIcon(m.senderKey) }}</div>
          <div class="wg-msg-body">
            <div v-if="m.senderType === 'agent'" class="wg-msg-name">{{ m.senderName }}</div>
            <div class="wg-msg-bubble" :class="{ mine: m.senderType === 'user' }">
              <span v-if="m.targetKey && m.senderType === 'user'" class="wg-at-inline">@{{ agentName(m.targetKey) }}&nbsp;</span>{{ m.content }}
            </div>
            <div class="wg-msg-time">{{ fmtTime(m.createdAt) }}</div>
          </div>
        </div>
      </div>

      <!-- 成员面板 -->
      <aside class="wg-side" :class="{ open: showMembers }">
        <div class="wg-side-section">
          <div class="wg-side-head">
            <span>成员管理</span>
            <span class="wg-side-count">共 {{ members.length }} 人 ›</span>
          </div>
          <div class="wg-member-item" v-for="m in members" :key="'u' + m.key" @click="openDetail(m, 'user')">
            <span class="wg-member-avatar">{{ m.icon }}</span>
            <div class="wg-member-info">
              <div class="wg-member-name">{{ m.name }}</div>
              <div class="wg-member-role">{{ m.role }}</div>
            </div>
          </div>
        </div>
        <div class="wg-side-section">
          <div class="wg-side-head">
            <span>Agent管理</span>
            <span class="wg-side-count">共 {{ agents.length }} 个 ›</span>
          </div>
          <div class="wg-member-item" v-for="a in agents" :key="'a' + a.key" @click="openDetail(a, 'agent')">
            <span class="wg-member-avatar" :style="{ background: agentColor(a.key) }">{{ a.icon }}</span>
            <div class="wg-member-info">
              <div class="wg-member-name">{{ a.name }}</div>
              <div class="wg-member-role">{{ a.role }}</div>
            </div>
          </div>
        </div>
      </aside>
    </div>

    <!-- 输入区 -->
    <div class="wg-inputbar">
      <div v-if="currentTarget" class="wg-target-tag">
        @{{ agentName(currentTarget) }}
        <span class="wg-target-x" @click="currentTarget = null">✕</span>
      </div>
      <div class="wg-input-row">
        <button class="wg-at-btn" :class="{ active: atMenuOpen }" @click="toggleAtMenu" title="@ Agent">@</button>
        <input
          v-model="draft"
          class="wg-input"
          :placeholder="currentTarget ? '回复 @' + agentName(currentTarget) + ' ...' : '发消息，@ 任意 Agent 协作...'"
          @keyup.enter="send"
        />
        <button class="wg-send-btn" :disabled="!draft.trim() || sending" @click="send">{{ sending ? '…' : '发送' }}</button>
      </div>
      <transition name="wg-pop">
        <div v-if="atMenuOpen" class="wg-at-menu">
          <div class="wg-at-menu-title">选择要 @ 的 Agent</div>
          <div class="wg-at-item" v-for="a in agents" :key="a.key" @click="pickTarget(a.key)">
            <span class="wg-at-icon" :style="{ background: agentColor(a.key) }">{{ a.icon }}</span>
            <span class="wg-at-name">{{ a.name }}</span>
            <span class="wg-at-role">{{ a.role }}</span>
          </div>
        </div>
      </transition>
    </div>

    <!-- 详情弹窗 -->
    <div v-if="detail" class="wg-modal-mask" @click.self="detail = null">
      <div class="wg-modal">
        <button class="wg-modal-close" @click="detail = null">✕</button>
        <div class="wg-modal-avatar" :style="detail.type === 'agent' ? { background: agentColor(detail.key) } : {}">{{ detail.icon }}</div>
        <div class="wg-modal-name">{{ detail.name }}</div>
        <div class="wg-modal-role">{{ detail.role }}</div>
        <div class="wg-modal-desc">{{ detail.desc || '暂无简介' }}</div>
        <div class="wg-modal-actions">
          <button v-if="detail.type === 'agent'" class="wg-modal-btn" @click="goChat(detail.key)">去单聊</button>
          <button class="wg-modal-btn ghost" @click="detail = null">关闭</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import api from '../utils/api.js';
import { useSocket } from '../utils/socket.js';

const router = useRouter();
const GROUP_KEY = 'work-group';

const messages = ref([]);
const members = ref([]);
const agents = ref([]);
const draft = ref('');
const sending = ref(false);
const atMenuOpen = ref(false);
const currentTarget = ref(null);
const showMembers = ref(true);
const detail = ref(null);
const chatRef = ref(null);

const AGENT_COLORS = {
  'sales-champion': '#e6b23c',
  'background-report': '#4f8ff7',
  'customs-agent': '#2fbfa0',
  'doc-agent': '#a06bd9',
  'freight-agent': '#e07b39',
  'legal-agent': '#e05a6d',
};

function agentColor(key) { return AGENT_COLORS[key] || '#4f8ff7'; }
function agentIcon(key) { return agents.value.find(a => a.key === key)?.icon || '🤖'; }
function agentName(key) { return agents.value.find(a => a.key === key)?.name || key; }

function fmtTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const p = n => String(n).padStart(2, '0');
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

async function loadMembers() {
  try {
    const { data } = await api.get('/agent-group/members');
    members.value = data.members || [];
    agents.value = data.agents || [];
  } catch (e) {
    console.warn('[WG] load members failed', e);
  }
}

async function loadMessages() {
  try {
    const { data } = await api.get(`/agent-group/messages?limit=200`);
    messages.value = data.messages || [];
    scrollBottom();
  } catch (e) {
    console.warn('[WG] load messages failed', e);
  }
}

function scrollBottom() {
  nextTick(() => {
    const el = chatRef.value;
    if (el) el.scrollTop = el.scrollHeight;
  });
}

async function send() {
  const content = draft.value.trim();
  if (!content || sending.value) return;
  sending.value = true;
  atMenuOpen.value = false;
  try {
    await api.post('/agent-group/send', {
      content,
      targetKey: currentTarget.value || null,
      groupKey: GROUP_KEY,
    });
    draft.value = '';
    currentTarget.value = null;
  } catch (e) {
    console.warn('[WG] send failed', e);
  } finally {
    sending.value = false;
  }
}

function toggleAtMenu() { atMenuOpen.value = !atMenuOpen.value; }
function pickTarget(key) { currentTarget.value = key; atMenuOpen.value = false; }
function openDetail(item, type) { detail.value = { ...item, type }; }

function goChat(key) {
  const routeMap = {
    'sales-champion': '/sales-champion',
    'background-report': '/background-report',
    'customs-agent': '/customs-agent',
    'doc-agent': '/doc-agent',
    'freight-agent': '/freight-agent',
    'legal-agent': '/legal-agent',
  };
  const path = routeMap[key];
  if (path) router.push(path);
}

function goBack() { router.push('/assistant'); }

let socket = null;
function setupSocket() {
  try {
    socket = useSocket();
    socket.on('agent-group:new', onGroupNew);
  } catch (e) {
    console.warn('[WG] socket init failed', e);
  }
}

function onGroupNew(data) {
  if (!data?.message) return;
  const last = messages.value[messages.value.length - 1];
  if (last && last.id >= data.message.id) return;
  messages.value.push(data.message);
  scrollBottom();
}

onMounted(() => {
  loadMembers();
  loadMessages();
  setupSocket();
});

onBeforeUnmount(() => {
  if (socket) socket.off('agent-group:new', onGroupNew);
});
</script>

<style scoped>
.wg-root {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--chat-bg);
  color: var(--text-primary);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}
/* ===== Header ===== */
.wg-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 16px;
  height: 60px;
  flex-shrink: 0;
  border-bottom: 1px solid var(--border-color);
  background: var(--panel-header-bg);
}
.wg-back {
  background: transparent;
  border: none;
  color: var(--text-secondary);
  font-size: 26px;
  cursor: pointer;
  padding: 0 6px;
  line-height: 1;
}
.wg-back:hover { color: #fff; }
.wg-header-title { display: flex; align-items: center; gap: 10px; flex: 1; }
.wg-title-icon { font-size: 22px; }
.wg-title { font-size: 16px; font-weight: 600; }
.wg-subtitle { font-size: 12px; color: var(--text-secondary); margin-top: 2px; }
.wg-members-toggle {
  background: var(--input-bg);
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
  font-size: 12px;
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
}
.wg-members-toggle:hover { color: #fff; }
/* ===== Body ===== */
.wg-body { flex: 1; display: flex; overflow: hidden; }
/* ===== Chat ===== */
.wg-chat { flex: 1; overflow-y: auto; padding: 20px 24px; scroll-behavior: smooth; }
.wg-empty { text-align: center; margin-top: 80px; color: var(--text-muted); }
.wg-empty-icon { font-size: 48px; margin-bottom: 12px; }
.wg-empty-t1 { font-size: 16px; color: var(--text-secondary); margin-bottom: 6px; }
.wg-empty-sub { font-size: 13px; }
.wg-msg-row { display: flex; gap: 10px; margin-bottom: 18px; }
.wg-msg-row.mine { justify-content: flex-end; }
.wg-avatar {
  width: 36px; height: 36px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 18px; flex-shrink: 0;
}
.wg-msg-body { max-width: 70%; }
.wg-msg-row.mine .wg-msg-body { display: flex; flex-direction: column; align-items: flex-end; }
.wg-msg-name { font-size: 12px; color: var(--text-secondary); margin-bottom: 4px; padding-left: 4px; }
.wg-msg-bubble {
  background: var(--msg-incoming);
  border: 1px solid var(--border-color);
  padding: 10px 14px;
  border-radius: 12px 12px 12px 4px;
  font-size: 14px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}
.wg-msg-bubble.mine {
  background: #0e5f8a;
  border-color: #1372a3;
  border-radius: 12px 12px 4px 12px;
}
.wg-at-inline { color: #ffd479; font-weight: 600; }
.wg-msg-time { font-size: 11px; color: var(--text-muted); margin-top: 4px; padding: 0 4px; }
/* ===== Side panel ===== */
.wg-side {
  width: 280px;
  flex-shrink: 0;
  border-left: 1px solid var(--border-color);
  background: var(--panel-header-bg);
  overflow-y: auto;
  padding: 16px 12px;
}
.wg-side-section { margin-bottom: 24px; }
.wg-side-head {
  display: flex; justify-content: space-between; align-items: center;
  font-size: 13px; font-weight: 600; color: var(--text-secondary);
  padding: 0 6px 10px;
}
.wg-side-count { font-size: 12px; color: var(--text-muted); font-weight: 400; }
.wg-member-item {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 6px; border-radius: 8px; cursor: pointer;
}
.wg-member-item:hover { background: var(--sidebar-hover); }
.wg-member-avatar {
  width: 34px; height: 34px; border-radius: 50%;
  background: var(--input-bg);
  display: flex; align-items: center; justify-content: center;
  font-size: 16px; flex-shrink: 0;
}
.wg-member-info { min-width: 0; }
.wg-member-name { font-size: 14px; font-weight: 500; }
.wg-member-role { font-size: 12px; color: var(--text-muted); margin-top: 2px; }
/* ===== Input bar ===== */
.wg-inputbar {
  flex-shrink: 0;
  padding: 12px 16px 16px;
  border-top: 1px solid var(--border-color);
  background: var(--chat-bg);
  position: relative;
}
.wg-target-tag {
  display: inline-flex; align-items: center; gap: 6px;
  background: var(--input-bg); border: 1px solid #1372a3;
  color: #ffd479; font-size: 13px; font-weight: 500;
  padding: 4px 10px; border-radius: 16px; margin-bottom: 8px;
}
.wg-target-x { cursor: pointer; color: var(--text-secondary); font-size: 13px; padding: 0 2px; }
.wg-target-x:hover { color: #fff; }
.wg-input-row { display: flex; align-items: center; gap: 8px; }
.wg-at-btn {
  width: 40px; height: 40px; border-radius: 50%;
  background: var(--input-bg); border: 1px solid var(--border-color); color: #ffd479;
  font-size: 18px; font-weight: 700; cursor: pointer; flex-shrink: 0;
}
.wg-at-btn.active { background: var(--sidebar-hover); border-color: #ffd479; }
.wg-input {
  flex: 1; height: 40px;
  background: var(--input-bg); border: 1px solid var(--border-color); border-radius: 8px;
  color: var(--text-primary); font-size: 14px; padding: 0 14px; outline: none;
}
.wg-input:focus { border-color: #1372a3; }
.wg-input::placeholder { color: var(--text-muted); }
.wg-send-btn {
  height: 40px; padding: 0 22px;
  background: #1372a3; border: none; border-radius: 8px;
  color: #fff; font-size: 14px; font-weight: 600; cursor: pointer; flex-shrink: 0;
}
.wg-send-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.wg-at-menu {
  position: absolute; bottom: 86px; left: 16px;
  width: 320px; max-height: 340px; overflow-y: auto;
  background: var(--panel-bg); border: 1px solid var(--border-color); border-radius: 10px;
  box-shadow: 0 8px 28px rgba(0,0,0,0.55); padding: 8px; z-index: 50;
}
.wg-at-menu-title { font-size: 12px; color: var(--text-secondary); padding: 6px 8px 8px; }
.wg-at-item {
  display: flex; align-items: center; gap: 10px;
  padding: 8px; border-radius: 8px; cursor: pointer;
}
.wg-at-item:hover { background: var(--sidebar-hover); }
.wg-at-icon {
  width: 30px; height: 30px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center; font-size: 15px;
}
.wg-at-name { font-size: 14px; font-weight: 500; }
.wg-at-role { font-size: 12px; color: var(--text-muted); margin-left: auto; }
/* ===== Modal ===== */
.wg-modal-mask {
  position: fixed; inset: 0; background: rgba(0,0,0,0.6);
  display: flex; align-items: center; justify-content: center; z-index: 100;
}
.wg-modal {
  width: 320px; background: var(--panel-bg); border: 1px solid var(--border-color);
  border-radius: 14px; padding: 24px; text-align: center; position: relative;
}
.wg-modal-close {
  position: absolute; top: 12px; right: 14px;
  background: transparent; border: none; color: var(--text-secondary); font-size: 16px; cursor: pointer;
}
.wg-modal-avatar {
  width: 64px; height: 64px; border-radius: 50%; margin: 0 auto 12px;
  background: var(--input-bg); display: flex; align-items: center; justify-content: center; font-size: 30px;
}
.wg-modal-name { font-size: 18px; font-weight: 600; }
.wg-modal-role { font-size: 13px; color: var(--text-secondary); margin: 6px 0 14px; }
.wg-modal-desc { font-size: 13px; line-height: 1.7; color: var(--text-secondary); text-align: left; background: var(--chat-bg); border-radius: 8px; padding: 12px; }
.wg-modal-actions { display: flex; gap: 10px; margin-top: 18px; }
.wg-modal-btn {
  flex: 1; height: 38px;
  background: #1372a3; border: none; border-radius: 8px; color: #fff; font-size: 14px; cursor: pointer;
}
.wg-modal-btn.ghost { background: var(--input-bg); border: 1px solid var(--border-color); color: var(--text-secondary); }
/* ===== Transition ===== */
.wg-pop-enter-active, .wg-pop-leave-active { transition: opacity 0.15s, transform 0.15s; }
.wg-pop-enter-from, .wg-pop-leave-to { opacity: 0; transform: translateY(6px); }
/* ===== Mobile ===== */
@media (max-width: 768px) {
  .wg-side { position: fixed; right: 0; top: 60px; bottom: 0; transform: translateX(100%); transition: transform 0.2s; z-index: 40; }
  .wg-side.open { transform: translateX(0); }
  .wg-msg-body { max-width: 82%; }
}
</style>
