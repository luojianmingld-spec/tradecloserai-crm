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
    socket.emit('whatsapp:send_message', { accountId, jid, text });
  }

  function setActiveConversation(jid) {
    activeJid.value = jid;
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
    const { message } = data;
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
    }

    // Update conversation
    const conv = conversations.value.find(c => c.jid === message.jid);
    if (conv) {
      conv.lastMessage = message.content?.substring(0, 100);
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
    handleQRCode,
    handleStatus,
    handleNewMessage,
    handleMessageSent,
    handleConversations,
    handleMessages,
  };
});
