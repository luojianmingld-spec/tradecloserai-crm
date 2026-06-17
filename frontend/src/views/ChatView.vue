<template>
  <div class="chat-layout">
    <!-- Left Panel: Account Selector + Conversation List -->
    <div class="left-panel">
      <div class="panel-header">
        <div class="account-selector">
          <el-select
            v-model="chatStore.activeAccountId"
            placeholder="选择账号"
            @change="onAccountChange"
            style="width: 100%"
          >
            <el-option
              v-for="acc in chatStore.accounts"
              :key="acc.id"
              :label="acc.name || acc.phone || 'WhatsApp'"
              :value="acc.id"
            >
              <div class="account-option">
                <span class="account-status-dot" :class="acc.status"></span>
                <span>{{ acc.name || acc.phone || 'WhatsApp' }}</span>
              </div>
            </el-option>
          </el-select>
          <el-button
            :icon="Plus"
            circle
            size="small"
            @click="showAddAccount = true"
          />
        </div>
        <div class="search-bar">
          <el-input
            v-model="searchQuery"
            placeholder="搜索联系人..."
            :prefix-icon="Search"
            clearable
            size="small"
          />
          <el-button
            :icon="Setting"
            circle
            size="small"
            class="settings-trigger"
            @click="$router.push('/settings')"
          />
        </div>
      </div>

      <div class="conversation-list">
        <div
          v-for="conv in filteredConversations"
          :key="conv.jid"
          class="conversation-item"
          :class="{ active: chatStore.activeJid === conv.jid }"
          @click="selectConversation(conv)"
        >
          <div class="conv-avatar">
            <span class="avatar-text">
              {{ getInitial(conv.contact?.name || conv.jid) }}
            </span>
          </div>
          <div class="conv-info">
            <div class="conv-top">
              <span class="conv-name">{{ conv.contact?.name || conv.jid.split('@')[0] }}</span>
              <span class="conv-time">{{ formatTime(conv.lastMessageAt) }}</span>
            </div>
            <div class="conv-bottom">
              <span class="conv-last-msg">{{ conv.lastMessage || '' }}</span>
              <span v-if="conv.unreadCount > 0" class="conv-unread">
                {{ conv.unreadCount > 99 ? '99+' : conv.unreadCount }}
              </span>
            </div>
          </div>
        </div>

        <div v-if="chatStore.accounts.length === 0" class="empty-state">
          <el-empty description="暂无WhatsApp账号" :image-size="80">
            <el-button type="primary" @click="showAddAccount = true">
              添加账号
            </el-button>
          </el-empty>
        </div>

        <div
          v-else-if="chatStore.sortedConversations.length === 0"
          class="empty-state"
        >
          <el-empty description="暂无会话" :image-size="80" />
        </div>
      </div>
    </div>

    <!-- Center Panel: Chat Window -->
    <div class="center-panel">
      <template v-if="chatStore.activeJid">
        <ChatWindow
          :account-id="chatStore.activeAccountId"
          :jid="chatStore.activeJid"
          :contact="chatStore.activeConversation?.contact"
          :messages="chatStore.currentMessages"
          @send="onSendMessage"
        />
      </template>
      <template v-else>
        <div class="no-chat-selected">
          <div class="no-chat-content">
            <svg viewBox="0 0 303 172" width="300" fill="none">
              <path
                d="M229.565 160.229c32.647-16.166 54.391-50.471 54.391-89.691C283.956 31.588 252.368 0 213.418 0c-28.867 0-53.862 17.39-64.754 42.261C137.772 17.39 112.777 0 83.91 0 44.96 0 13.372 31.588 13.372 70.538c0 39.22 21.744 73.525 54.39 89.691H229.565z"
                fill="#00a884"
                opacity="0.08"
              />
            </svg>
            <h2>WhatsApp CRM</h2>
            <p>选择一个会话开始聊天，或添加WhatsApp账号</p>
          </div>
        </div>
      </template>
    </div>

    <!-- Right Panel: Customer Info -->
    <div class="right-panel">
      <CustomerPanel
        v-if="chatStore.activeJid"
        :contact="chatStore.activeConversation?.contact"
        :account-id="chatStore.activeAccountId"
        :jid="chatStore.activeJid"
        @ai-reply="handleAIReply"
        @summarize="handleAISummarize"
      />
      <div v-else class="no-customer">
        <p>选择会话查看客户信息</p>
      </div>
    </div>

    <!-- Add Account Dialog -->
    <el-dialog
      v-model="showAddAccount"
      title="添加WhatsApp账号"
      width="420px"
      :close-on-click-modal="false"
      class="dark-dialog"
    >
      <div class="add-account-form">
        <el-input
          v-model="newAccountName"
          placeholder="账号名称（例如：公司主号）"
          style="margin-bottom: 16px"
        />
        <div v-if="chatStore.qrCode" class="qr-section">
          <p class="qr-hint">请使用WhatsApp扫描以下二维码登录</p>
          <img :src="chatStore.qrCode.qr" alt="QR Code" class="qr-image" />
          <p class="qr-status">
            <el-icon class="is-loading"><Loading /></el-icon>
            等待扫码...
          </p>
        </div>
      </div>
      <template #footer>
        <el-button @click="showAddAccount = false">取消</el-button>
        <el-button type="primary" @click="handleAddAccount">
          创建并获取二维码
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { Plus, Search, Loading, Setting } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { useChatStore } from '../stores/chat.js';
import { initSocket } from '../utils/socket.js';
import ChatWindow from '../components/chat/ChatWindow.vue';
import CustomerPanel from '../components/chat/CustomerPanel.vue';

const chatStore = useChatStore();

const searchQuery = ref('');
const showAddAccount = ref(false);
const newAccountName = ref('');

const filteredConversations = computed(() => {
  const convs = chatStore.sortedConversations;
  if (!searchQuery.value) return convs;
  const q = searchQuery.value.toLowerCase();
  return convs.filter(
    c =>
      c.contact?.name?.toLowerCase().includes(q) ||
      c.jid?.toLowerCase().includes(q) ||
      c.lastMessage?.toLowerCase().includes(q)
  );
});

onMounted(async () => {
  await chatStore.fetchAccounts();
  initSocket();

  // Auto-request QR for disconnected accounts
  chatStore.accounts.forEach(acc => {
    if (acc.status === 'disconnected' || acc.status === 'connecting') {
      chatStore.requestQRCode(acc.id);
    }
    // Fetch conversations for connected accounts
    if (acc.status === 'connected') {
      chatStore.fetchConversations(acc.id);
    }
  });
});

watch(
  () => chatStore.activeAccountId,
  (newId) => {
    if (newId) {
      chatStore.fetchConversations(newId);
      chatStore.activeJid = null;
    }
  }
);

function onAccountChange(accountId) {
  chatStore.activeAccountId = accountId;
  const account = chatStore.accounts.find(a => a.id === accountId);
  if (account?.status === 'disconnected') {
    chatStore.requestQRCode(accountId);
  }
}

async function handleAddAccount() {
  if (!newAccountName.value.trim()) {
    newAccountName.value = `账号 ${chatStore.accounts.length + 1}`;
  }
  try {
    const account = await chatStore.createAccount(newAccountName.value.trim());
    showAddAccount.value = false;
    newAccountName.value = '';
    // Request QR code
    chatStore.requestQRCode(account.id);
    ElMessage.success('账号已创建，请扫描二维码登录');
  } catch (err) {
    ElMessage.error('创建账号失败');
  }
}

function selectConversation(conv) {
  chatStore.setActiveConversation(conv.jid);
  chatStore.fetchMessages(chatStore.activeAccountId, conv.jid);
}

function onSendMessage(text) {
  if (!chatStore.activeAccountId || !chatStore.activeJid) return;
  chatStore.sendMessage(chatStore.activeAccountId, chatStore.activeJid, text);
}

async function handleAIReply() {
  if (!chatStore.activeAccountId || !chatStore.activeJid) return;
  try {
    await chatStore.generateAIReply(chatStore.activeAccountId, chatStore.activeJid, 'formal');
  } catch (err) {
    console.error('AI reply failed:', err);
  }
}

async function handleAISummarize() {
  if (!chatStore.activeAccountId || !chatStore.activeJid) return;
  try {
    await chatStore.summarizeNeed(chatStore.activeAccountId, chatStore.activeJid);
  } catch (err) {
    console.error('AI summarize failed:', err);
  }
}

function getInitial(name) {
  if (!name) return '?';
  return name.charAt(0).toUpperCase();
}

function formatTime(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now - date;

  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;

  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isToday) {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth();

  if (isYesterday) return '昨天';

  return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
}
</script>

<style scoped>
.chat-layout {
  display: flex;
  height: 100vh;
  width: 100%;
  overflow: hidden;
}

/* Left Panel */
.left-panel {
  width: 360px;
  min-width: 360px;
  background: var(--sidebar-bg);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
}

.panel-header {
  padding: 12px 16px;
  background: var(--sidebar-header-bg);
  border-bottom: 1px solid var(--border-color);
}

.account-selector {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 10px;
}

.account-option {
  display: flex;
  align-items: center;
  gap: 8px;
}

.account-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--text-muted);
}

.account-status-dot.connected {
  background: var(--accent);
}

.account-status-dot.connecting {
  background: #f59e0b;
  animation: pulse 1.5s infinite;
}

.account-status-dot.reconnecting {
  background: #f59e0b;
  animation: pulse 1.5s infinite;
}

.account-status-dot.disconnected {
  background: var(--danger);
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

:deep(.el-select) {
  --el-select-border-color-hover: var(--accent);
}

:deep(.el-select .el-input__wrapper) {
  background: var(--input-bg);
  border-color: var(--border-color);
}

:deep(.el-select .el-input__inner) {
  color: var(--text-primary);
}

.search-bar {
  width: 100%;
  display: flex;
  gap: 8px;
  align-items: center;
}

.settings-trigger {
  flex-shrink: 0;
  background: rgba(255,255,255,0.06) !important;
  border: none !important;
  color: var(--text-secondary, #8696a0) !important;
}

.settings-trigger:hover {
  color: var(--color-primary, #00a884) !important;
  background: rgba(0,168,132,0.1) !important;
}

:deep(.el-input__wrapper) {
  background: var(--search-bg);
  border-color: transparent;
}

:deep(.el-input__inner) {
  color: var(--text-primary);
  font-size: 13px;
}

:deep(.el-input__inner::placeholder) {
  color: var(--text-muted);
}

/* Conversation List */
.conversation-list {
  flex: 1;
  overflow-y: auto;
}

.conversation-item {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  cursor: pointer;
  transition: background-color 0.15s;
  border-bottom: 1px solid rgba(255, 255, 255, 0.03);
}

.conversation-item:hover {
  background: var(--sidebar-hover);
}

.conversation-item.active {
  background: var(--sidebar-active);
}

.conv-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: linear-gradient(135deg, #00a884, #06cf9c);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 14px;
  flex-shrink: 0;
}

.avatar-text {
  color: white;
  font-weight: 600;
  font-size: 18px;
}

.conv-info {
  flex: 1;
  min-width: 0;
}

.conv-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.conv-name {
  color: var(--text-primary);
  font-size: 15px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.conv-time {
  color: var(--text-muted);
  font-size: 11px;
  flex-shrink: 0;
  margin-left: 8px;
}

.conv-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.conv-last-msg {
  color: var(--text-secondary);
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.conv-unread {
  background: var(--unread-bg);
  color: #111b21;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 10px;
  margin-left: 8px;
  flex-shrink: 0;
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 300px;
}

:deep(.el-empty__description p) {
  color: var(--text-secondary);
}

/* Center Panel */
.center-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--chat-bg);
  min-width: 0;
}

.no-chat-selected {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--chat-bg);
}

.no-chat-content {
  text-align: center;
  color: var(--text-muted);
}

.no-chat-content h2 {
  color: var(--text-secondary);
  margin: 20px 0 8px;
  font-size: 28px;
  font-weight: 300;
}

.no-chat-content p {
  font-size: 14px;
}

/* Right Panel */
.right-panel {
  width: 320px;
  min-width: 320px;
  background: var(--panel-bg);
  border-left: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
}

.no-customer {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  font-size: 13px;
}

/* Dialog styles */
:deep(.dark-dialog .el-dialog) {
  background: var(--sidebar-bg);
  border: 1px solid var(--border-color);
}

:deep(.el-dialog) {
  background: #1a2731;
  border: 1px solid var(--border-color);
}

:deep(.el-dialog__title) {
  color: var(--text-primary);
}

:deep(.el-dialog__body) {
  color: var(--text-secondary);
}

.qr-section {
  text-align: center;
  margin-top: 16px;
}

.qr-hint {
  color: var(--text-secondary);
  font-size: 13px;
  margin-bottom: 16px;
}

.qr-image {
  width: 256px;
  height: 256px;
  border-radius: 12px;
  border: 2px solid var(--border-color);
}

.qr-status {
  margin-top: 12px;
  color: #f59e0b;
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

:deep(.el-button--primary) {
  background: var(--accent);
  border-color: var(--accent);
}

:deep(.el-button--primary:hover) {
  background: var(--accent-hover);
  border-color: var(--accent-hover);
}
</style>
