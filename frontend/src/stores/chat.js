import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import api from '../utils/api.js';
import { useSocket } from '../utils/socket.js';

export const useChatStore = defineStore('chat', () => {
  // WhatsApp Accounts
  const accounts = ref([]);
  const activeAccountId = ref(null);

  // Conversations
  const conversations = ref([]);
  const activeJid = ref(null);

  // Messages
  const messages = ref({});
  const loadingMessages = ref(false);

  // QR Code
  const qrCode = ref(null);
  const connectionStatus = ref({});

  // Translation
  const translationSettings = ref({
    translationEnabled: true,
    translationEngine: 'doubao',
    targetLanguage: 'zh',
    doubaoApiKey: '',
    deepseekApiKey: '',
  });
  const autoTranslateOutgoing = ref(true);

  // AI Reply
  const aiReplies = ref([]);
  const aiGenerating = ref(false);
  const insertText = ref('');

  // AI Summarize
  const needSummary = ref(null);
  const summarizeLoading = ref(false);

  // Computed
  const activeAccount = computed(() =>
    accounts.value.find(a => a.id === activeAccountId.value)
  );

  const activeConversation = computed(() =>
    conversations.value.find(c => c.jid === activeJid.value)
  );

  const currentMessages = computed(() => {
    if (!activeJid.value) return [];
    return messages.value[activeJid.value] || [];
  });

  const sortedConversations = computed(() => {
    return [...conversations.value].sort((a, b) => {
      if (a.pinned !== b.pinned) return b.pinned ? 1 : -1;
      const tA = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
      const tB = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
      return tB - tA;
    });
  });

  // Actions
  async function fetchAccounts() {
    try {
      const { data } = await api.get('/accounts');
      accounts.value = data;
      if (!activeAccountId.value && data.length > 0) {
        activeAccountId.value = data[0].id;
      }
    } catch (err) {
      console.error('Failed to fetch accounts:', err);
    }
  }

  async function createAccount(name) {
    const { data } = await api.post('/accounts', { name });
    accounts.value.unshift(data);
    activeAccountId.value = data.id;
    return data;
  }

  async function deleteAccount(id) {
    await api.delete(`/accounts/${id}`);
    accounts.value = accounts.value.filter(a => a.id !== id);
    if (activeAccountId.value === id) {
      activeAccountId.value = accounts.value[0]?.id || null;
    }
  }

  async function fetchConversations(accountId) {
    if (!accountId) return;
    try {
      const { data } = await api.get('/messages/conversations', {
        params: { accountId },
      });
      conversations.value = data;
    } catch (err) {
      console.error('Failed to fetch conversations:', err);
    }
  }

  async function fetchMessages(accountId, jid, limit = 50) {
    if (!accountId || !jid) return;
    loadingMessages.value = true;
    try {
      const { data } = await api.get('/messages', {
        params: { accountId, jid, limit },
      });
      messages.value[jid] = data;
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    } finally {
      loadingMessages.value = false;
    }
  }

  function requestQRCode(accountId) {
    const socket = useSocket();
    socket.emit('whatsapp:request_qr', { accountId });
  }

  function sendMessage(accountId, jid, text) {
    const socket = useSocket();
    socket.emit('whatsapp:send_message', {
      accountId,
      jid,
      text,
      autoTranslate: autoTranslateOutgoing.value && translationSettings.value.translationEnabled,
    });
  }

  function setActiveConversation(jid) {
    activeJid.value = jid;
    // Clear AI state when switching conversation
    aiReplies.value = [];
    needSummary.value = null;
    if (jid) {
      // Mark as read
      const socket = useSocket();
      socket.emit('whatsapp:mark_read', {
        accountId: activeAccountId.value,
        jid,
      });
      // Clear unread count locally
      const conv = conversations.value.find(c => c.jid === jid);
      if (conv) conv.unreadCount = 0;
    }
  }

  // Translation actions
  async function fetchTranslationSettings() {
    try {
      const { data } = await api.get('/settings');
      // data is a flat object like { translationEnabled: 'true', translationEngine: 'doubao', ... }
      translationSettings.value = {
        translationEnabled: data.translationEnabled !== 'false',
        translationEngine: data.translationEngine || 'doubao',
        targetLanguage: data.targetLanguage || data.translationTargetLang || 'zh',
        doubaoApiKey: data.doubaoApiKey || '',
        deepseekApiKey: data.deepseekApiKey || '',
      };
    } catch (err) {
      console.error('Failed to fetch translation settings:', err);
    }
  }

  async function updateTranslationSettings(settings) {
    try {
      const entries = Object.entries(settings).map(([key, value]) => ({
        key,
        value: String(value),
      }));
      await api.put('/settings', { settings: entries });
      translationSettings.value = { ...translationSettings.value, ...settings };
    } catch (err) {
      console.error('Failed to update translation settings:', err);
    }
  }

  async function translateMessage(text, sourceLang, targetLang) {
    try {
      const { data } = await api.post('/translation/translate', {
        text,
        sourceLang: sourceLang || 'auto',
        targetLang: targetLang || 'zh',
      });
      return data;
    } catch (err) {
      console.error('Failed to translate message:', err);
      return null;
    }
  }

  // AI Reply actions
  async function generateAIReply(accountId, jid, style = 'formal') {
    if (!accountId || !jid) return;
    aiGenerating.value = true;
    aiReplies.value = [];
    try {
      const { data } = await api.post('/ai/generate-reply', {
        accountId,
        jid,
        style,
      });
      if (data.replies) {
        aiReplies.value = data.replies.map((text, index) => ({
          id: index,
          text,
          feedback: null, // 'good' or 'bad'
        }));
      } else if (data.error) {
        console.error('AI reply error:', data.error);
      }
    } catch (err) {
      console.error('Failed to generate AI reply:', err);
    } finally {
      aiGenerating.value = false;
    }
  }

  function insertToInput(text) {
    insertText.value = text;
  }

  function clearInsertText() {
    insertText.value = '';
  }

  // AI Summarize actions
  async function generateNeedSummary(accountId, jid) {
    if (!accountId || !jid) return;
    summarizeLoading.value = true;
    needSummary.value = null;
    try {
      const { data } = await api.post('/ai/summarize-need', {
        accountId,
        jid,
      });
      if (data.summary) {
        needSummary.value = data.summary;
      } else if (data.error) {
        console.error('AI summarize error:', data.error);
      }
    } catch (err) {
      console.error('Failed to generate need summary:', err);
    } finally {
      summarizeLoading.value = false;
    }
  }

  function clearNeedSummary() {
    needSummary.value = null;
  }

  // Socket event handlers
  function handleQRCode(data) {
    qrCode.value = data;
  }

  function handleStatus(data) {
    connectionStatus.value[data.accountId] = data.status;
    const account = accounts.value.find(a => a.id === data.accountId);
    if (account) {
      account.status = data.status;
      if (data.info) {
        account.phone = data.info.phone;
        account.pushName = data.info.name;
      }
    }
  }

  function handleNewMessage(data) {
    const { message, contact } = data;
    if (!message) return;

    // Add to messages
    if (!messages.value[message.jid]) {
      messages.value[message.jid] = [];
    }
    messages.value[message.jid].push(message);

    // Update conversation
    const conv = conversations.value.find(c => c.jid === message.jid);
    if (conv) {
      conv.lastMessage = message.content?.substring(0, 100) || `[${message.messageType}]`;
      conv.lastMessageAt = message.timestamp;
      if (!message.fromMe) {
        conv.unreadCount = (conv.unreadCount || 0) + 1;
      }
    } else {
      // New conversation
      conversations.value.unshift({
        accountId: message.accountId,
        contactId: message.contactId,
        jid: message.jid,
        contact,
        lastMessage: message.content?.substring(0, 100) || `[${message.messageType}]`,
        lastMessageAt: message.timestamp,
        unreadCount: message.fromMe ? 0 : 1,
      });
    }
  }

  function handleMessageSent(data) {
    const { message, translation } = data;
    if (!message) return;

    if (!messages.value[message.jid]) {
      messages.value[message.jid] = [];
    }
    // Avoid duplicates
    const exists = messages.value[message.jid].find(
      m => m.id === message.id
    );
    if (!exists) {
      messages.value[message.jid].push(message);
    } else if (translation) {
      // Update existing message with translation data
      exists.translation = message.translation;
      exists.sourceLang = message.sourceLang;
    }

    // Update conversation
    const conv = conversations.value.find(c => c.jid === message.jid);
    if (conv) {
      conv.lastMessage = (translation?.original || message.content)?.substring(0, 100);
      conv.lastMessageAt = message.timestamp;
    }
  }

  function handleConversations(data) {
    conversations.value = data.conversations;
  }

  function handleMessages(data) {
    messages.value[data.jid] = data.messages;
  }

  return {
    accounts,
    activeAccountId,
    conversations,
    activeJid,
    messages,
    loadingMessages,
    qrCode,
    connectionStatus,
    translationSettings,
    autoTranslateOutgoing,
    aiReplies,
    aiGenerating,
    insertText,
    needSummary,
    summarizeLoading,
    activeAccount,
    activeConversation,
    currentMessages,
    sortedConversations,
    fetchAccounts,
    createAccount,
    deleteAccount,
    fetchConversations,
    fetchMessages,
    requestQRCode,
    sendMessage,
    setActiveConversation,
    fetchTranslationSettings,
    updateTranslationSettings,
    translateMessage,
    generateAIReply,
    insertToInput,
    clearInsertText,
    generateNeedSummary,
    clearNeedSummary,
    handleQRCode,
    handleStatus,
    handleNewMessage,
    handleMessageSent,
    handleConversations,
    handleMessages,
  };
});
