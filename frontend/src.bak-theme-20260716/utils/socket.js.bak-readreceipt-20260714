import { io } from 'socket.io-client';
import { useAuthStore } from '../stores/auth.js';
import { useChatStore } from '../stores/chat.js';

let socket = null;

export function initSocket() {
  const authStore = useAuthStore();
  const chatStore = useChatStore();

  if (socket?.connected) return socket;

  socket = io({
    auth: {
      userId: authStore.user?.id,
      token: authStore.token,
    },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 2000,
  });

  socket.on('connect', () => {
    console.log('[Socket] Connected');
  });

  socket.on('disconnect', (reason) => {
    console.log('[Socket] Disconnected:', reason);
  });

  // WhatsApp events
  socket.on('whatsapp:qr', (data) => {
    chatStore.handleQRCode(data);
  });

  socket.on('whatsapp:status', (data) => {
    chatStore.handleStatus(data);
  });

  socket.on('whatsapp:message', (data) => {
    chatStore.handleNewMessage(data);
  });

  socket.on('whatsapp:message_sent', (data) => {
    chatStore.handleMessageSent(data);
  });

  socket.on('whatsapp:translation', (data) => {
    chatStore.handleTranslation(data);
  });

    socket.on('whatsapp:message_translated', (data) => {
    chatStore.handleMessageTranslated(data);
  });

  socket.on('whatsapp:conversations', (data) => {
    chatStore.handleConversations(data);
  });

  socket.on('whatsapp:messages', (data) => {
    chatStore.handleMessages(data);
  });

  socket.on('whatsapp:error', (data) => {
    console.error('[WhatsApp Error]', data.message);
    // Update store state
    chatStore.handleWAError(data);
    // Import ElMessage dynamically to avoid circular deps
    import('element-plus').then(({ ElMessage }) => {
      ElMessage.error(data.message || 'WhatsApp 错误');
    });
  });

  socket.on('whatsapp:chats_loaded', (data) => {
    chatStore.fetchConversations();
  });

  socket.on('whatsapp:presence', (data) => {
    // Handle typing indicators etc.
  });

  return socket;
}

export function useSocket() {
  if (!socket) {
    return initSocket();
  }
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export default { initSocket, useSocket, disconnectSocket };
