<template>
  <div class="chat-window">
    <!-- Chat Header -->
    <div class="chat-header">
      <div class="header-info">
        <div class="header-avatar">
          <span class="avatar-text">
            {{ getInitial(contact?.name || contact?.phone || jid) }}
          </span>
        </div>
        <div class="header-details">
          <h3>{{ contact?.name || contact?.phone || jid.split('@')[0] }}</h3>
          <span class="header-phone">{{ contact?.phone || jid.split('@')[0] }}</span>
        </div>
      </div>
      <div class="header-actions">
        <el-tooltip content="搜索消息" placement="bottom">
          <el-button text circle>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
            </svg>
          </el-button>
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
              <!-- Outgoing: show translation first, then original -->
              <template v-if="msg.fromMe && msg.translation">
                <span class="msg-text">{{ msg.translation }}</span>
                <div class="msg-translation">
                  <span class="translation-label">原文：</span>
                  <span>{{ msg.content }}</span>
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
          <el-button text circle size="small">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"/>
            </svg>
          </el-button>
        </el-tooltip>
        <el-tooltip content="附件" placement="top">
          <el-button text circle size="small">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z"/>
            </svg>
          </el-button>
        </el-tooltip>
        <el-tooltip content="翻译设置" placement="top">
          <el-button text circle size="small" @click="toggleTranslationPanel">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
              <path d="M12.87 15.07l-2.54-2.51.03-.03A17.52 17.52 0 0014.07 6H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"/>
            </svg>
          </el-button>
        </el-tooltip>
        <el-tooltip content="AI话术" placement="top">
          <el-button text circle size="small" @click="toggleReplyPanel">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
              <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
            </svg>
          </el-button>
        </el-tooltip>
        <el-tooltip content="需求总结" placement="top">
          <el-button text circle size="small" @click="handleAISummarize" :loading="aiSummarizingLocal">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
              <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"/>
            </svg>
          </el-button>
        </el-tooltip>
      </div>

      <!-- Translation Settings Panel (Inline) -->
      <div v-if="showTranslationPanel" class="inline-panel">
        <div class="panel-header">
          <div class="panel-title">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <path d="M12.87 15.07l-2.54-2.51.03-.03A17.52 17.52 0 0014.07 6H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"/>
            </svg>
            <span>翻译设置</span>
          </div>
          <button class="panel-close" @click="showTranslationPanel = false">×</button>
        </div>
        <div class="panel-body">
          <div class="translation-section">
            <div class="section-label">发送翻译</div>
            <div class="language-row">
              <span class="source-lang">中文</span>
              <span class="arrow">→</span>
              <el-select v-model="chatStore.translationSettings.targetLanguage" size="default" style="flex: 1">
                <el-option label="English (英语)" value="en" />
                <el-option label="日本語 (日语)" value="ja" />
                <el-option label="한국어 (韩语)" value="ko" />
                <el-option label="Français (法语)" value="fr" />
                <el-option label="Deutsch (德语)" value="de" />
                <el-option label="Español (西班牙语)" value="es" />
                <el-option label="Português (葡萄牙语)" value="pt" />
                <el-option label="Русский (俄语)" value="ru" />
                <el-option label="العربية (阿拉伯语)" value="ar" />
                <el-option label="Italiano (意大利语)" value="it" />
              </el-select>
            </div>
          </div>
          <div class="translation-section">
            <div class="section-label">接收翻译</div>
            <div class="language-row">
              <span class="source-lang">English</span>
              <span class="arrow">→</span>
              <span class="source-lang active">中文</span>
            </div>
          </div>
          <div class="panel-row">
            <span>自动翻译</span>
            <el-switch v-model="autoTranslate" size="small" />
          </div>
        </div>
      </div>

      <!-- AI Reply Style Panel (Inline) -->
      <div v-if="showReplyPanel" class="inline-panel">
        <div class="panel-header">
          <div class="panel-title">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
            </svg>
            <span>AI话术</span>
          </div>
          <button class="panel-close" @click="showReplyPanel = false">×</button>
        </div>
        <div class="panel-body">
          <div class="style-selector">
            <button class="style-btn" :class="{ active: replyStyle === 'formal' }" @click="replyStyle = 'formal'">正式</button>
            <button class="style-btn" :class="{ active: replyStyle === 'casual' }" @click="replyStyle = 'casual'">非正式</button>
            <button class="style-btn" :class="{ active: replyStyle === 'polite' }" @click="replyStyle = 'polite'">礼貌</button>
          </div>
          <el-button type="primary" size="small" @click="executeAIReply" :loading="aiGeneratingLocal" style="width: 100%; margin-top: 12px;">生成话术</el-button>
        </div>
      </div>

      <div class="input-container">
        <button class="attach-btn" @click="showAttachMenu = !showAttachMenu">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 5v14M5 12h14"/>
          </svg>
        </button>
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
        <button v-if="inputText.trim()" class="send-btn" @click="handleSend">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- Translation Preview -->
    <div v-if="translationPreview" class="translation-preview">
      <div class="preview-header">
        <span>翻译预览</span>
        <el-button text size="small" @click="translationPreview = null">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </el-button>
      </div>
      <div class="preview-content">{{ translationPreview }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, reactive } from 'vue';
import { useChatStore } from '../../stores/chat.js';

const props = defineProps({
  jid: { type: String, required: true },
  contact: { type: Object, default: null },
  messages: { type: Array, default: () => [] },
  connected: { type: Boolean, default: false },
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
  if (!props.connected) return 'WhatsApp未连接...';
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

// Watch for AI reply insertions
watch(
  () => chatStore.insertText,
  (text) => {
    if (text) {
      inputText.value = text;
      chatStore.clearInsertText();
      nextTick(() => {
        inputRef.value?.focus();
      });
    }
  }
);

function scrollToBottom() {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
  }
}

async function handleSend() {
  const text = inputText.value.trim();
  if (!text || !props.connected) return;
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

// AI feature handlers
const aiTranslating = ref(false);
const aiGeneratingLocal = ref(false);
const aiSummarizingLocal = ref(false);
const showTranslationPanel = ref(false);
const showAttachMenu = ref(false);
const showReplyPanel = ref(false);
const replyStyle = ref('formal');

function toggleTranslationPanel() {
  showReplyPanel.value = false;
  showTranslationPanel.value = !showTranslationPanel.value;
}

function toggleReplyPanel() {
  showTranslationPanel.value = false;
  showReplyPanel.value = !showReplyPanel.value;
}

function executeAIReply() {
  showReplyPanel.value = false;
  handleAIReply();
}

async function handleAITranslate() {
  const text = inputText.value.trim();
  if (!text) return;
  aiTranslating.value = true;
  try {
    const result = await chatStore.translateMessage(text, 'auto');
    if (result?.translated) {
      inputText.value = result.translated;
    }
  } catch (err) {
    console.error('AI translate failed:', err);
  } finally {
    aiTranslating.value = false;
  }
}

async function handleAIReply() {
  if (!props.jid) return;
  aiGeneratingLocal.value = true;
  try {
    await chatStore.generateAIReply(null, props.jid, 'formal');
  } catch (err) {
    console.error('AI reply failed:', err);
  } finally {
    aiGeneratingLocal.value = false;
  }
}

async function handleAISummarize() {
  if (!props.jid) return;
  aiSummarizingLocal.value = true;
  try {
    await chatStore.generateNeedSummary(null, props.jid);
  } catch (err) {
    console.error('AI summarize failed:', err);
  } finally {
    aiSummarizingLocal.value = false;
  }
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
  animation: fadeIn 0.2s ease;
}

.message-row.from-me {
  justify-content: flex-end;
}

.message-bubble {
  max-width: 65%;
  padding: 8px 12px;
  border-radius: 8px;
  position: relative;
}

.message-bubble.incoming {
  background: var(--msg-incoming);
  border-top-left-radius: 0;
}

.message-bubble.outgoing {
  background: var(--msg-outgoing);
  border-top-right-radius: 0;
}

.message-content {
  color: var(--text-primary);
  font-size: 14px;
  line-height: 1.4;
  word-break: break-word;
}

.msg-text {
  white-space: pre-wrap;
}

.msg-translation {
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.4;
}

.translation-label {
  color: var(--accent);
  font-size: 11px;
  margin-right: 4px;
}

.translation-lang {
  display: inline-block;
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 8px;
  background: rgba(0, 168, 132, 0.15);
  color: var(--accent);
  margin-left: 6px;
}

.msg-translate-btn {
  display: inline-flex;
  align-items: center;
  margin-top: 6px;
  padding: 3px 8px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.06);
  color: var(--accent);
  font-size: 12px;
  cursor: pointer;
  transition: background 0.15s;
}

.msg-translate-btn:hover {
  background: rgba(255, 255, 255, 0.12);
}

.translating {
  color: var(--text-muted);
}

.message-meta {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  margin-top: 2px;
}

.msg-time {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.45);
}

.msg-status {
  color: rgba(255, 255, 255, 0.45);
}

.no-messages {
  text-align: center;
  padding: 40px 0;
  color: var(--text-muted);
  font-size: 14px;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Input Area */
.input-area {
  background: var(--chat-header-bg);
  border-top: 1px solid var(--border-color);
  padding: 8px 16px;
  position: relative;
  flex-shrink: 0;
}

.input-container {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  padding: 4px 0;
}

.attach-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.2s;
}

.attach-btn:hover {
  background: var(--bg-hover);
  color: var(--text-secondary);
}

.send-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background: var(--accent);
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.2s;
}

.send-btn:hover {
  background: var(--accent-hover);
}

.input-toolbar {
  display: flex;
  gap: 2px;
  margin-bottom: 6px;
}

.input-toolbar :deep(.el-button) {
  color: var(--text-muted);
}

.input-toolbar :deep(.el-button:hover) {
  color: var(--text-secondary);
}

.input-wrapper {
  flex: 1;
  min-width: 0;
}

.input-wrapper :deep(.el-textarea__inner) {
  background: var(--input-bg);
  border: none;
  color: var(--text-primary);
  font-size: 14px;
  padding: 8px 12px;
  border-radius: 20px;
  min-height: 36px !important;
}

.input-wrapper :deep(.el-textarea__inner::placeholder) {
  color: var(--text-muted);
}

.input-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 6px;
}

.input-actions :deep(.el-button--small) {
  width: 32px;
  height: 32px;
}

.input-actions :deep(.el-button--default) {
  background: rgba(255, 255, 255, 0.06);
  border: none;
  color: var(--text-muted);
}

.input-actions :deep(.el-button--primary) {
  background: var(--accent);
  border-color: var(--accent);
}

.input-actions :deep(.el-button--primary:hover) {
  background: var(--accent-hover);
}

/* Translation Preview */
.translation-preview {
  position: absolute;
  bottom: 100px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--msg-outgoing);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 8px 12px;
  max-width: 400px;
  width: 90%;
  z-index: 10;
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
  font-size: 12px;
  color: var(--accent);
}

.preview-content {
  color: var(--text-primary);
  font-size: 13px;
}

/* ========== Mobile Responsive ========== */
@media (max-width: 768px) {
  .chat-window {
    height: 100vh;
    max-height: 100vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .messages-container {
    flex: 1;
    overflow-y: auto;
    min-height: 0;
  }

  .input-area {
    flex-shrink: 0;
    max-height: 50vh;
    overflow-y: auto;
  }

  .chat-header {
    padding: 8px 12px 8px 48px;
  }
  .chat-header .contact-name {
    font-size: 14px;
  }
  .chat-header .contact-phone {
    font-size: 11px;
  }

  .messages-container {
    padding: 8px;
  }

  .message-wrapper {
    max-width: 85%;
  }

  .message-bubble {
    font-size: 14px;
    padding: 6px 10px;
    border-radius: 8px;
  }

  .message-translation {
    font-size: 12px;
  }

  .input-area {
    padding: 6px 8px;
    padding-bottom: calc(6px + env(safe-area-inset-bottom, 0px) + 50px);
    position: relative;
  }

  .input-actions :deep(.el-button--small) {
    width: 36px;
    height: 36px;
  }

  .message-input :deep(.el-textarea__inner) {
    font-size: 16px;
    min-height: 36px;
  }

  .translation-preview {
    bottom: 70px;
    max-width: 90%;
  }
}

/* AI Panel Styles (Inline) */
.inline-panel {
  background: #2d2d2d;
  border-radius: 12px;
  overflow: hidden;
  margin: 8px 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.2);
  animation: slideDown 0.2s ease;
}

@keyframes slideDown {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}

.inline-panel .panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #3d3d3d;
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  color: #fff;
}

.panel-title svg {
  color: #409eff;
}

.panel-close {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: none;
  background: #3d3d3d;
  color: #999;
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.panel-close:hover {
  background: #4d4d4d;
  color: #fff;
}

.panel-body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  background: #2d2d2d;
}

.translation-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-label {
  font-size: 14px;
  font-weight: 600;
  color: #ccc;
}

.language-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.source-lang {
  padding: 10px 14px;
  background: #3d3d3d;
  border-radius: 8px;
  font-size: 14px;
  color: #ccc;
  white-space: nowrap;
}

.source-lang.active {
  background: #409eff;
  color: #fff;
}

.arrow {
  font-size: 16px;
  color: #666;
}

.language-selector {
  display: flex;
  align-items: center;
  gap: 12px;
}

.translation-desc {
  font-size: 12px;
  color: #888;
  margin-top: 4px;
}

.style-selector {
  display: flex;
  gap: 8px;
}

.style-btn {
  flex: 1;
  padding: 10px 16px;
  border: 1px solid #4d4d4d;
  border-radius: 8px;
  background: #3d3d3d;
  color: #ccc;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.style-btn.active {
  background: #409eff;
  color: white;
  border-color: #409eff;
}

.style-btn:hover:not(.active) {
  background: #4d4d4d;
  color: #fff;
}

.source-lang.active {
  background: #409eff;
  color: white;
}

.panel-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #3d3d3d;
  border-radius: 8px;
}

.panel-row span {
  font-size: 14px;
  color: #ccc;
}
</style>
