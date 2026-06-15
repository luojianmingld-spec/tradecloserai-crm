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
              <!-- Outgoing: show sent text, translation shows original -->
              <template v-if="msg.fromMe && msg.translation">
                <span class="msg-text">{{ msg.content }}</span>
                <div class="msg-translation">
                  <span class="translation-label">原文：</span>
                  <span>{{ msg.translation }}</span>
                </div>
              </template>
              <!-- Incoming with translation -->
              <template v-else-if="!msg.fromMe && msg.translation">
                <span class="msg-text">{{ msg.content }}</span>
                <div class="msg-translation">
                  <span class="translation-label">翻译：</span>
                  <span>{{ msg.translation }}</span>
                  <span v-if="msg.sourceLang" class="translation-lang">{{ getLangName(msg.sourceLang) }}</span>
                </div>
              </template>
              <!-- No translation available - show translate button for incoming -->
              <template v-else-if="!msg.fromMe && chatStore.translationSettings.translationEnabled && msg.messageType === 'text'">
                <span class="msg-text">{{ msg.content }}</span>
                <div v-if="translatingMsgs[msg.id]" class="msg-translation translating">
                  <span class="translation-label">翻译中...</span>
                </div>
                <div v-else class="msg-translate-btn" @click="handleTranslateMsg(msg)">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" style="margin-right:4px">
                    <path d="M12.87 15.07l-2.54-2.51.03-.03A17.52 17.52 0 0014.07 6H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"/>
                  </svg>
                  翻译
                </div>
              </template>
              <!-- Fallback: just text -->
              <template v-else>
                <span class="msg-text">{{ msg.content }}</span>
              </template>
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
          :placeholder="inputPlaceholder"
          resize="none"
          @keydown.enter.exact.prevent="handleSend"
        />
      </div>
      <div class="input-actions">
        <el-tooltip :content="autoTranslate ? '自动翻译已开启' : '自动翻译已关闭'" placement="top">
          <el-button
            :type="autoTranslate ? 'primary' : 'default'"
            circle
            size="small"
            @click="autoTranslate = !autoTranslate"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
              <path d="M12.87 15.07l-2.54-2.51.03-.03A17.52 17.52 0 0014.07 6H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"/>
            </svg>
          </el-button>
        </el-tooltip>
        <el-button
          type="primary"
          :icon="Promotion"
          circle
          :disabled="!inputText.trim()"
          @click="handleSend"
        />
      </div>
    </div>

    <!-- Translation Preview -->
    <div v-if="translationPreview" class="translation-preview">
      <div class="preview-header">
        <span>翻译预览</span>
        <el-button text size="small" @click="translationPreview = null">
          <el-icon><Close /></el-icon>
        </el-button>
      </div>
      <div class="preview-content">{{ translationPreview }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, reactive } from 'vue';
import { Search, Promotion, ChatDotRound, Close } from '@element-plus/icons-vue';
import { useChatStore } from '../../stores/chat.js';

const Paperclip = ChatDotRound;

const props = defineProps({
  accountId: { type: Number, required: true },
  jid: { type: String, required: true },
  contact: { type: Object, default: null },
  messages: { type: Array, default: () => [] },
});

const emit = defineEmits(['send']);
const chatStore = useChatStore();

const inputText = ref('');
const messagesContainer = ref(null);
const inputRef = ref(null);
const autoTranslate = computed({
  get: () => chatStore.autoTranslateOutgoing,
  set: (val) => { chatStore.autoTranslateOutgoing = val; },
});
const translationPreview = ref(null);
const translatingMsgs = reactive({});

const inputPlaceholder = computed(() => {
  if (autoTranslate.value && chatStore.translationSettings.translationEnabled) {
    return '输入中文，自动翻译后发送...';
  }
  return '输入消息...';
});

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
    translationPreview.value = null;
  }
);

function scrollToBottom() {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
  }
}

async function handleSend() {
  const text = inputText.value.trim();
  if (!text) return;
  emit('send', text);
  inputText.value = '';
  translationPreview.value = null;
}

async function handleTranslateMsg(msg) {
  if (translatingMsgs[msg.id]) return;
  translatingMsgs[msg.id] = true;
  try {
    const result = await chatStore.translateMessage(msg.content, msg.sourceLang || 'auto');
    if (result?.translated) {
      msg.translation = result.translated;
      msg.sourceLang = result.sourceLang || msg.sourceLang;
    }
  } catch (err) {
    console.error('Translation failed:', err);
  } finally {
    translatingMsgs[msg.id] = false;
  }
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

const languageNames = {
  en: '英语', zh: '中文', ja: '日语', ko: '韩语', es: '西班牙语',
  fr: '法语', de: '德语', pt: '葡萄牙语', ru: '俄语', ar: '阿拉伯语',
  hi: '印地语', it: '意大利语', th: '泰语', vi: '越南语', id: '印尼语',
  ms: '马来语', tr: '土耳其语', nl: '荷兰语', pl: '波兰语',
};

function getLangName(code) {
  if (!code) return '';
  return languageNames[code] || code;
}
</script>

<style scoped>
.chat-window {
  display: flex;
  flex-direction: column;
  height: 100%;
  position: relative;
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

/* Translation styles */
.msg-translation {
  margin-top: 4px;
  padding-top: 4px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.4;
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px;
}

.msg-translation.translating {
  color: var(--text-muted);
  font-style: italic;
}

.translation-label {
  color: var(--accent-color);
  font-size: 11px;
  flex-shrink: 0;
}

.translation-lang {
  background: rgba(0, 168, 132, 0.15);
  color: var(--accent-color);
  font-size: 10px;
  padding: 1px 4px;
  border-radius: 3px;
  flex-shrink: 0;
}

.msg-translate-btn {
  display: inline-flex;
  align-items: center;
  margin-top: 4px;
  padding: 2px 8px;
  background: rgba(0, 168, 132, 0.1);
  color: var(--accent-color);
  border-radius: 4px;
  font-size: 11px;
  cursor: pointer;
  transition: background 0.15s;
}

.msg-translate-btn:hover {
  background: rgba(0, 168, 132, 0.2);
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

.input-actions {
  display: flex;
  gap: 4px;
  padding-bottom: 6px;
  align-items: flex-end;
}

/* Translation preview */
.translation-preview {
  position: absolute;
  bottom: 70px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--panel-header-bg);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 8px 12px;
  max-width: 400px;
  width: 90%;
  z-index: 10;
  animation: fadeIn 0.15s ease-out;
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
  font-size: 11px;
  color: var(--text-muted);
}

.preview-content {
  font-size: 13px;
  color: var(--text-primary);
  line-height: 1.4;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
</style>
