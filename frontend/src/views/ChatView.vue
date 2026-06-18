<template>
  <div class="chat-layout" :class="{ 'mobile-show-chat': showMobileChat }">
    <!-- Left Panel: Connection Status + Conversation List -->
    <div class="left-panel">
      <div class="panel-header">
        <!-- Connection Status Bar -->
        <div class="connection-bar">
          <div class="connection-info">
            <span class="status-dot" :class="chatStore.connectionStatus"></span>
            <span class="connection-text">
              <template v-if="chatStore.isConnected">
                {{ chatStore.connectedPhone || '已连接' }}
              </template>
              <template v-else-if="chatStore.connectionStatus === 'connecting'">
                连接中...
              </template>
              <template v-else-if="chatStore.connectionStatus === 'waiting_qr'">
                等待扫码
              </template>
              <template v-else-if="chatStore.connectionStatus === 'reconnecting'">
                重连中...
              </template>
              <template v-else-if="chatStore.connectionStatus === 'error'">
                连接失败
              </template>
              <template v-else-if="chatStore.connectionStatus === 'unavailable'">
                不可用
              </template>
              <template v-else>
                未连接
              </template>
            </span>
          </div>
          <div class="connection-actions">
            <el-tooltip v-if="!chatStore.isConnected" content="扫码连接" placement="bottom">
              <el-button
                type="primary"
                circle
                size="small"
                @click="showQRDialog = true"
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                  <path d="M3 11h8V3H3v8zm2-6h4v4H5V5zm8-2v8h8V3h-8zm6 6h-4V5h4v4zM3 21h8v-8H3v8zm2-6h4v4H5v-4zm13-2h-2v4h-4v2h4v4h2v-4h4v-2h-4v-4z"/>
                </svg>
              </el-button>
            </el-tooltip>
            <el-tooltip v-else content="断开连接" placement="bottom">
              <el-button
                circle
                size="small"
                @click="handleDisconnect"
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM4 12c0-4.42 3.58-8 8-8 1.85 0 3.55.63 4.9 1.69L5.69 16.9A7.902 7.902 0 014 12zm8 8c-1.85 0-3.55-.63-4.9-1.69L18.31 7.1A7.902 7.902 0 0120 12c0 4.42-3.58 8-8 8z"/>
                </svg>
              </el-button>
            </el-tooltip>
            <el-tooltip content="客户管理" placement="bottom">
              <el-button
                circle
                size="small"
                class="settings-trigger"
                @click="$router.push('/customers')"
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                  <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
                </svg>
              </el-button>
            </el-tooltip>
            <el-tooltip content="设置" placement="bottom">
              <el-button
                circle
                size="small"
                class="settings-trigger"
                @click="$router.push('/settings')"
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                  <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.49.49 0 00-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 00-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58a.49.49 0 00-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
                </svg>
              </el-button>
            </el-tooltip>
          </div>
        </div>

        <!-- Search Bar -->
        <div class="search-bar">
          <el-input
            v-model="searchQuery"
            placeholder="搜索联系人..."
            clearable
            size="small"
          >
            <template #prefix>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" style="color: var(--text-muted)">
                <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
              </svg>
            </template>
          </el-input>
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
              {{ getInitial(conv.name || conv.phone || conv.jid) }}
            </span>
          </div>
          <div class="conv-info">
            <div class="conv-top">
              <span class="conv-name">{{ conv.name || conv.phone || conv.jid.split('@')[0] }}</span>
              <span class="conv-time">{{ formatTime(conv.lastMessageTime) }}</span>
            </div>
            <div class="conv-bottom">
              <span class="conv-last-msg">{{ conv.lastMessage || '' }}</span>
              <span v-if="conv.unreadCount > 0" class="conv-unread">
                {{ conv.unreadCount > 99 ? '99+' : conv.unreadCount }}
              </span>
            </div>
          </div>
        </div>

        <div v-if="!chatStore.isConnected" class="empty-state">
          <el-empty description="请先连接WhatsApp账号" :image-size="80">
            <el-button type="primary" @click="showQRDialog = true">
              扫码连接
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
          :jid="chatStore.activeJid"
          :contact="chatStore.activeConversation"
          :messages="chatStore.currentMessages"
          :connected="chatStore.isConnected"
          @send="onSendMessage"
        />
        <button class="mobile-back-btn" @click="showMobileChat = false">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        </button>
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
            <p v-if="!chatStore.isConnected">请先扫码连接WhatsApp账号</p>
            <p v-else>选择一个会话开始聊天</p>
          </div>
        </div>
      </template>
    </div>

    <!-- Right Panel: Customer Info -->
    <div class="right-panel">
      <CustomerPanel
        v-if="chatStore.activeJid"
        :contact="chatStore.activeConversation"
        :jid="chatStore.activeJid"
        @ai-reply="handleAIReply"
        @summarize="handleAISummarize"
      />
      <div v-else class="no-customer">
        <p>选择会话查看客户信息</p>
      </div>
    </div>

    <!-- QR Code Dialog -->
    <el-dialog
      v-model="showQRDialog"
      title="连接WhatsApp"
      :width="qrDialogWidth"
      :close-on-click-modal="false"
      class="dark-dialog"
      @open="handleQROpen"
      @close="handleQRClose"
    >
      <div class="qr-dialog-content">
        <div v-if="chatStore.connectionStatus === 'connecting'" class="qr-loading">
          <el-icon class="is-loading" :size="32"><Loading /></el-icon>
          <p>正在生成二维码...</p>
        </div>
        <div v-else-if="chatStore.qrCode" class="qr-section">
          <p class="qr-hint">请使用WhatsApp扫描以下二维码登录</p>
          <img :src="chatStore.qrCode.qr" alt="QR Code" class="qr-image" />
          <p class="qr-status">
            <el-icon class="is-loading"><Loading /></el-icon>
            等待扫码...
          </p>
        </div>
        <div v-else-if="chatStore.isConnected" class="qr-connected">
          <svg viewBox="0 0 24 24" width="48" height="48" fill="#00a884">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
          </svg>
          <p class="connected-text">WhatsApp已连接</p>
          <p class="connected-phone">{{ chatStore.connectedPhone }}</p>
        </div>
        <div v-else-if="chatStore.connectionStatus === 'error' || chatStore.waError" class="qr-error">
          <svg viewBox="0 0 24 24" width="48" height="48" fill="#ea4335">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
          </svg>
          <p class="error-text">{{ chatStore.waError || '连接失败' }}</p>
          <el-button type="primary" @click="chatStore.requestQR()">重试</el-button>
        </div>
        <div v-else class="qr-error">
          <p>获取二维码失败，请重试</p>
          <el-button type="primary" @click="chatStore.requestQR()">重试</el-button>
        </div>
      </div>
      <template #footer>
        <el-button @click="showQRDialog = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { Loading } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useChatStore } from '../stores/chat.js';
import { initSocket } from '../utils/socket.js';
import ChatWindow from '../components/chat/ChatWindow.vue';
import CustomerPanel from '../components/chat/CustomerPanel.vue';

const chatStore = useChatStore();

const searchQuery = ref('');
const showQRDialog = ref(false);
const showMobileChat = ref(false);

const qrDialogWidth = computed(() => {
  if (typeof window !== 'undefined' && window.innerWidth < 480) return '90%';
  return '420px';
});

const filteredConversations = computed(() => {
  const convs = chatStore.sortedConversations;
  if (!searchQuery.value) return convs;
  const q = searchQuery.value.toLowerCase();
  return convs.filter(
    c =>
      c.name?.toLowerCase().includes(q) ||
      c.phone?.toLowerCase().includes(q) ||
      c.jid?.toLowerCase().includes(q) ||
      c.lastMessage?.toLowerCase().includes(q)
  );
});

onMounted(async () => {
  initSocket();

  // Check current connection status
  const status = await chatStore.fetchConnectionStatus();

  // If connected, fetch conversations
  if (chatStore.isConnected) {
    await chatStore.fetchConversations();
  }

  // Fetch translation settings
  await chatStore.fetchTranslationSettings();
});

// Watch for connection status changes
watch(
  () => chatStore.connectionStatus,
  (newStatus) => {
    if (newStatus === 'connected') {
      showQRDialog.value = false;
      chatStore.fetchConversations();
    }
  }
);

function handleQROpen() {
  if (!chatStore.isConnected) {
    chatStore.requestQR();
  }
}

function handleQRClose() {
  // Don't disconnect - keep the connection attempt alive
}

async function handleDisconnect() {
  try {
    await ElMessageBox.confirm(
      '确定断开WhatsApp连接？断开后需要重新扫码登录。',
      '断开连接',
      { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
    );
    await chatStore.disconnectWhatsApp();
    ElMessage.success('已断开连接');
  } catch {
    // User cancelled
  }
}

function selectConversation(conv) {
  chatStore.setActiveConversation(conv.jid);
  showMobileChat.value = true;
}

function onSendMessage(text) {
  if (!chatStore.activeJid || !chatStore.isConnected) return;
  chatStore.sendMessage(chatStore.activeJid, text);
}

async function handleAIReply() {
  if (!chatStore.activeJid) return;
  try {
    await chatStore.generateAIReply(null, chatStore.activeJid, 'formal');
  } catch (err) {
    console.error('AI reply failed:', err);
  }
}

async function handleAISummarize() {
  if (!chatStore.activeJid) return;
  try {
    await chatStore.generateNeedSummary(null, chatStore.activeJid);
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

.connection-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.connection-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--text-muted);
  flex-shrink: 0;
}

.status-dot.connected {
  background: var(--accent);
}

.status-dot.connecting,
.status-dot.waiting_qr {
  background: #f59e0b;
  animation: pulse 1.5s infinite;
}

.status-dot.reconnecting {
  background: #f59e0b;
  animation: pulse 1.5s infinite;
}

.status-dot.error,
.status-dot.unavailable {
  background: var(--danger, #ea4335);
}

.error-text {
  color: #ea4335;
  font-size: 13px;
  margin: 12px 0;
  text-align: center;
  line-height: 1.5;
}

.status-dot.disconnected {
  background: var(--danger);
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.connection-text {
  color: var(--text-secondary);
  font-size: 13px;
}

.connection-actions {
  display: flex;
  gap: 4px;
}

.connection-actions :deep(.el-button) {
  background: rgba(255,255,255,0.06) !important;
  border: none !important;
  color: var(--text-secondary, #8696a0) !important;
}

.connection-actions :deep(.el-button:hover) {
  color: var(--accent, #00a884) !important;
  background: rgba(0,168,132,0.1) !important;
}

.connection-actions :deep(.el-button--primary) {
  background: var(--accent) !important;
  color: white !important;
}

.connection-actions :deep(.el-button--primary:hover) {
  background: var(--accent-hover) !important;
}

.settings-trigger {
  flex-shrink: 0;
}

.search-bar {
  width: 100%;
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

.qr-dialog-content {
  min-height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.qr-loading {
  text-align: center;
  color: var(--text-secondary);
}

.qr-loading p {
  margin-top: 16px;
  font-size: 14px;
}

.qr-section {
  text-align: center;
  width: 100%;
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

.qr-connected {
  text-align: center;
}

.connected-text {
  color: var(--accent);
  font-size: 16px;
  font-weight: 500;
  margin-top: 12px;
}

.connected-phone {
  color: var(--text-secondary);
  font-size: 14px;
  margin-top: 4px;
}

.qr-error {
  text-align: center;
  color: var(--text-secondary);
}

.qr-error p {
  margin-bottom: 12px;
}

:deep(.el-button--primary) {
  background: var(--accent);
  border-color: var(--accent);
}

:deep(.el-button--primary:hover) {
  background: var(--accent-hover);
  border-color: var(--accent-hover);
}

/* ========== Mobile Back Button ========== */
.mobile-back-btn {
  display: none;
}

/* ========== Mobile Responsive ========== */
@media (max-width: 768px) {
  .chat-layout {
    display: block;
    position: relative;
    overflow: hidden;
  }

  .left-panel,
  .center-panel,
  .right-panel {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100%;
    max-width: 100%;
    border-right: none;
  }

  /* Default: show conversation list, hide chat + customer panel */
  .center-panel,
  .right-panel {
    display: none;
  }

  /* When a conversation is selected, show chat, hide list */
  .chat-layout.mobile-show-chat .left-panel {
    display: none;
  }
  .chat-layout.mobile-show-chat .center-panel {
    display: flex;
  }
  .chat-layout.mobile-show-chat .right-panel {
    display: none;
  }

  /* Mobile back button */
  .mobile-back-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    position: absolute;
    top: 10px;
    left: 10px;
    z-index: 100;
    width: 36px;
    height: 36px;
    border: none;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.4);
    color: var(--text-primary);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  .mobile-back-btn:active {
    background: rgba(0, 0, 0, 0.6);
  }

  /* Panel header adjustments */
  .panel-header {
    padding: 0 12px;
  }
  .connection-bar {
    padding: 8px 0;
    gap: 8px;
  }
  .connection-info {
    font-size: 13px;
  }
  .header-actions .el-button {
    padding: 6px 8px;
  }
  .header-actions .el-button .el-icon {
    font-size: 16px;
  }

  /* Search bar */
  .search-bar {
    padding: 0 12px 8px;
  }

  /* Conversation list */
  .conversation-list {
    height: calc(100% - 110px);
  }
  .conversation-item {
    padding: 10px 12px;
  }
  .conv-avatar {
    width: 40px;
    height: 40px;
    min-width: 40px;
  }
  .conv-name {
    font-size: 14px;
  }
  .conv-last-msg {
    font-size: 12px;
  }

  /* QR dialog */
  .qr-image {
    width: 200px !important;
    height: 200px !important;
  }
  .qr-hint {
    font-size: 13px;
  }
}
</style>
