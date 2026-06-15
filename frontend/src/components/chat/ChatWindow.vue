<template>
  <div class="chat-window">
    <!-- Chat Header -->
    <div class="chat-header">
      <div class="header-info">
        <div class="header-avatar">
          <span class="avatar-text">
            {{ getInitial(contact?.name || jid) }}
          </span>
        </div>
        <div class="header-details">
          <h3>{{ contact?.name || jid.split('@')[0] }}</h3>
          <span class="header-phone">{{ contact?.phone || '' }}</span>
        </div>
      </div>
      <div class="header-actions">
        <el-tooltip content="搜索消息" placement="bottom">
          <el-button :icon="Search" text circle />
        </el-tooltip>
      </div>
    </div>

    <!-- Messages Area -->
    <div ref="messagesContainer" class="messages-area" @scroll="onScroll">
      <div class="messages-inner">
        <div
          v-for="msg in messages"
          :key="msg.id"
          class="message-row"
          :class="{ 'from-me': msg.fromMe }"
        >
          <div class="message-bubble" :class="{ outgoing: msg.fromMe, incoming: !msg.fromMe }">
            <div class="message-content">
              <span class="msg-text">{{ msg.content }}</span>
            </div>
            <div class="message-meta">
              <span class="msg-time">{{ formatMessageTime(msg.timestamp) }}</span>
              <span v-if="msg.fromMe" class="msg-status">
                <svg viewBox="0 0 16 11" width="16" height="11" fill="currentColor">
                  <path d="M11.071.653a.457.457 0 0 0-.304-.102.493.493 0 0 0-.381.178l-6.19 7.636-2.011-2.095a.463.463 0 0 0-.336-.153.457.457 0 0 0-.336.153l-.312.318a.518.518 0 0 0-.14.353c0 .14.05.265.14.353l2.684 2.796a.46.46 0 0 0 .336.153.477.477 0 0 0 .382-.178l6.844-8.44a.526.526 0 0 0 .012-.648l-.318-.318a.458.458 0 0 0-.38-.153zm-3.603 8.44L7.87 9.45l3.39-4.175-.304-.318L7.566 9.13l-.609-.636-.304.318.914.95a.46.46 0 0 0 .336.153.477.477 0 0 0 .381-.178l.571-.685.318.318-.722.876a.458.458 0 0 1-.304.102.493.493 0 0 1-.381-.178l-.318-.318z"/>
                </svg>
              </span>
            </div>
          </div>
        </div>

        <div v-if="messages.length === 0" class="no-messages">
          <p>暂无消息记录</p>
        </div>
      </div>
    </div>

    <!-- Input Area -->
    <div class="input-area">
      <div class="input-toolbar">
        <el-tooltip content="表情" placement="top">
          <el-button :icon="ChatDotRound" text circle size="small" />
        </el-tooltip>
        <el-tooltip content="附件" placement="top">
          <el-button :icon="Paperclip" text circle size="small" />
        </el-tooltip>
      </div>
      <div class="input-wrapper">
        <el-input
          ref="inputRef"
          v-model="inputText"
          type="textarea"
          :autosize="{ minRows: 1, maxRows: 5 }"
          placeholder="输入消息..."
          resize="none"
          @keydown.enter.exact.prevent="handleSend"
        />
      </div>
      <el-button
        type="primary"
        :icon="Promotion"
        circle
        :disabled="!inputText.trim()"
        @click="handleSend"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue';
import { Search, Promotion, ChatDotRound } from '@element-plus/icons-vue';
// Note: Paperclip icon - using a workaround since element-plus may not have it
const Paperclip = ChatDotRound; // Placeholder

const props = defineProps({
  accountId: { type: Number, required: true },
  jid: { type: String, required: true },
  contact: { type: Object, default: null },
  messages: { type: Array, default: () => [] },
});

const emit = defineEmits(['send']);

const inputText = ref('');
const messagesContainer = ref(null);
const inputRef = ref(null);

// Auto-scroll to bottom on new messages
watch(
  () => props.messages.length,
  async () => {
    await nextTick();
    scrollToBottom();
  }
);

// Auto-scroll when conversation changes
watch(
  () => props.jid,
  async () => {
    await nextTick();
    scrollToBottom();
  }
);

function scrollToBottom() {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
  }
}

function handleSend() {
  const text = inputText.value.trim();
  if (!text) return;
  emit('send', text);
  inputText.value = '';
}

function onScroll() {
  // Could implement load-more on scroll up
}

function getInitial(name) {
  if (!name) return '?';
  return name.charAt(0).toUpperCase();
}

function formatMessageTime(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}
</script>

<style scoped>
.chat-window {
  display: flex;
  flex-direction: column;
  height: 100%;
}

/* Header */
.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  background: var(--chat-header-bg);
  border-bottom: 1px solid var(--border-color);
  min-height: 60px;
}

.header-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, #00a884, #06cf9c);
  display: flex;
  align-items: center;
  justify-content: center;
}

.header-avatar .avatar-text {
  color: white;
  font-weight: 600;
  font-size: 16px;
}

.header-details h3 {
  color: var(--text-primary);
  font-size: 15px;
  font-weight: 500;
  margin-bottom: 2px;
}

.header-phone {
  color: var(--text-muted);
  font-size: 12px;
}

.header-actions :deep(.el-button) {
  color: var(--text-secondary);
}

/* Messages */
.messages-area {
  flex: 1;
  overflow-y: auto;
  padding: 20px 60px;
  background: var(--chat-bg);
  background-image: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.02'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
}

.messages-inner {
  max-width: 900px;
  margin: 0 auto;
}

.message-row {
  display: flex;
  margin-bottom: 4px;
  animation: fadeIn 0.15s ease-out;
}

.message-row.from-me {
  justify-content: flex-end;
}

.message-bubble {
  max-width: 65%;
  padding: 8px 12px 4px;
  border-radius: 8px;
  position: relative;
  word-wrap: break-word;
}

.message-bubble.incoming {
  background: var(--msg-incoming);
  border-top-left-radius: 0;
}

.message-bubble.outgoing {
  background: var(--msg-outgoing);
  border-top-right-radius: 0;
}

.msg-text {
  color: var(--text-primary);
  font-size: 14px;
  line-height: 1.4;
  white-space: pre-wrap;
}

.message-meta {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  margin-top: 2px;
}

.msg-time {
  color: var(--text-muted);
  font-size: 11px;
}

.msg-status {
  color: #53bdeb;
  font-size: 14px;
  display: flex;
  align-items: center;
}

.no-messages {
  text-align: center;
  color: var(--text-muted);
  padding: 60px 0;
  font-size: 14px;
}

/* Input */
.input-area {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  padding: 8px 16px;
  background: var(--chat-header-bg);
  border-top: 1px solid var(--border-color);
}

.input-toolbar {
  display: flex;
  gap: 2px;
  padding-bottom: 6px;
}

.input-toolbar :deep(.el-button) {
  color: var(--text-secondary);
}

.input-wrapper {
  flex: 1;
}

:deep(.el-textarea__inner) {
  background: var(--input-bg);
  border: none;
  color: var(--text-primary);
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 14px;
  min-height: 40px;
}

:deep(.el-textarea__inner::placeholder) {
  color: var(--text-muted);
}

:deep(.el-textarea__inner:focus) {
  box-shadow: none;
}
</style>
