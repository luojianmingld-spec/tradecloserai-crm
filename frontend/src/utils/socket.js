import { io } from 'socket.io-client';
import { useAuthStore } from '../stores/auth.js';
import { useChatStore } from '../stores/chat.js';

let socket = null;

export function initSocket() {
  const authStore = useAuthStore();
  const chatStore = useChatStore();

  if (socket?.connected) return socket;

  // Detect Capacitor environment and use absolute URL
  const isNativeApp = window.Capacitor && window.Capacitor.getPlatform && window.Capacitor.getPlatform() !== 'web';
  const socketUrl = isNativeApp ? 'http://45.76.223.251:3002' : undefined;
  
  socket = io(socketUrl, {
    auth: {
      userId: authStore.user?.id,
      token: authStore.token,
    },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
  });

  socket.on('connect', () => {
    console.log('[Socket] Connected');
    // fetchConversations 由 handleStatus('connected') 触发，这里不再重复调用
    // On reconnect, trigger batch retranslation for current conversation
    if (socket.recovered) {
      setTimeout(() => {
        const jid = chatStore.activeJid;
        if (jid) {
          console.log('[Socket] Reconnected, triggering batch retranslation for', jid);
          chatStore.retranslateBatchMissing(jid);
        }
      }, 2000);
    }
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

  socket.on('whatsapp:reaction', (data) => {
    chatStore.handleReaction?.(data);
  });
  socket.on('whatsapp:message_sent', (data) => {
    chatStore.handleMessageSent(data);
  });

  // Telegram events → 通过window事件转发给LayoutView（避免污染chatStore）
  socket.on('telegram:message', (data) => {
    window.dispatchEvent(new CustomEvent('tg:message', { detail: data }));
  });
  socket.on('telegram:translation', (data) => {
    window.dispatchEvent(new CustomEvent('tg:translation', { detail: data }));
  });
  socket.on('conversation:update', (data) => {
    if (data?.conversation?.platform === 'telegram') {
      window.dispatchEvent(new CustomEvent('tg:conv-update', { detail: data }));
    }
  });

  socket.on('whatsapp:message_update', (data) => {
    chatStore.handleMessageUpdate?.(data);
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

  socket.on('whatsapp:receipt', (data) => {
    chatStore.handleReceipt(data);
  });

  // Background check completed event
  socket.on('customer:bgcheck:done', (data) => {
    window.dispatchEvent(new CustomEvent('customer:bgcheck:done', { detail: data }));
  });
  socket.on('whatsapp:bg-ask', (data) => {
    window.dispatchEvent(new CustomEvent('whatsapp:bg-ask', { detail: data }));
  });

  // BANT score completed event
  socket.on('customer:bantscore:done', (data) => {
    window.dispatchEvent(new CustomEvent('customer:bantscore:done', { detail: data }));
  });
  // 日程提醒触发事件
  socket.on('reminder:fired', (data) => {
    window.dispatchEvent(new CustomEvent('reminder:fired', { detail: data }));
    import('element-plus').then(({ ElMessage }) => {
      ElMessage({ type: 'warning', message: '⏰ 日程提醒：' + (data.title || '') + (data.content ? '：' + data.content : ''), duration: 8000 });
    });
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
