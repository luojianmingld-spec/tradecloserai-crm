import {
  autoTranslateMessage,
  translateOutgoing,
  getTranslationSettings,
} from '../services/translation.js';

// ─── WhatsApp 模块：动态加载 + 降级 ───
// Baileys 可能在部署环境中安装失败（GitHub 依赖超时）
// 此时 WhatsApp 功能不可用，但其他功能（翻译、AI、客户管理）仍能正常工作

let whatsappModule = null;
let whatsappLoadAttempted = false;

async function loadWhatsApp() {
  if (whatsappModule) return whatsappModule;
  if (whatsappLoadAttempted) return null;
  whatsappLoadAttempted = true;
  try {
    whatsappModule = await import('../services/whatsapp.js');
    console.log('[Socket] WhatsApp module loaded successfully');
    return whatsappModule;
  } catch (err) {
    console.warn('[Socket] WhatsApp module unavailable:', err.message);
    console.warn('[Socket] WhatsApp features will be disabled. Core CRM features still work.');
    return null;
  }
}

// 在启动时尝试加载，但不阻塞
loadWhatsApp();

function whatsappUnavailable(socket) {
  socket.emit('whatsapp:error', {
    message: 'WhatsApp 功能暂不可用，请检查 Baileys 库是否正确安装',
    code: 'WHATSAPP_UNAVAILABLE',
  });
}

export function setupSocketHandlers(io, prisma) {
  io.on('connection', (socket) => {
    const userId = socket.handshake.auth?.userId;
    const token = socket.handshake.auth?.token;

    if (!userId) {
      console.warn('[Socket] Connection without userId');
      return;
    }

    // Join user's room
    socket.join(`user_${userId}`);
    console.log(`[Socket] User ${userId} connected (socket: ${socket.id})`);

    // ---- WhatsApp Account Events ----

    // Request QR code for an account
    socket.on('whatsapp:request_qr', async (data) => {
      try {
        const wa = await loadWhatsApp();
        if (!wa) { whatsappUnavailable(socket); return; }

        const { accountId } = data;
        const account = await prisma.whatsAppAccount.findFirst({
          where: { id: accountId, userId },
        });
        if (!account) {
          socket.emit('whatsapp:error', { message: 'Account not found' });
          return;
        }

        await wa.getOrCreateConnection(accountId, userId, io);
      } catch (err) {
        console.error('[Socket] QR request error:', err);
        socket.emit('whatsapp:error', { message: 'Failed to generate QR code' });
      }
    });

    // Send message (with optional auto-translation)
    socket.on('whatsapp:send_message', async (data) => {
      try {
        const wa = await loadWhatsApp();
        if (!wa) { whatsappUnavailable(socket); return; }

        const { accountId, jid, text, autoTranslate } = data;
        if (!accountId || !jid || !text) {
          socket.emit('whatsapp:error', { message: 'Missing required fields' });
          return;
        }

        const account = await prisma.whatsAppAccount.findFirst({
          where: { id: accountId, userId },
        });
        if (!account) {
          socket.emit('whatsapp:error', { message: 'Account not found' });
          return;
        }

        // Determine final text to send
        let finalText = text;
        let translation = null;

        if (autoTranslate) {
          const contact = await prisma.contact.findUnique({
            where: { accountId_jid: { accountId, jid } },
          });
          const contactLang = contact?.language || null;

          const result = await translateOutgoing(text, contactLang, userId);
          if (result.translated && result.translated !== text) {
            finalText = result.translated;
            translation = {
              original: text,
              translated: result.translated,
              sourceLang: result.sourceLang,
              targetLang: result.targetLang,
            };
          }
        }

        const savedMessage = await wa.sendMessage(accountId, userId, jid, finalText, io);

        if (translation) {
          await prisma.message.update({
            where: { id: savedMessage.id },
            data: {
              translation: text,
              sourceLang: translation.sourceLang,
            },
          });
          savedMessage.translation = text;
          savedMessage.sourceLang = translation.sourceLang;
        }

        socket.emit('whatsapp:message_sent', {
          message: savedMessage,
          translation,
        });
      } catch (err) {
        console.error('[Socket] Send message error:', err);
        socket.emit('whatsapp:error', { message: 'Failed to send message' });
      }
    });

    // Disconnect WhatsApp account
    socket.on('whatsapp:disconnect', async (data) => {
      try {
        const wa = await loadWhatsApp();
        if (!wa) { whatsappUnavailable(socket); return; }

        const { accountId } = data;
        await wa.disconnectAccount(accountId, userId);
        socket.emit('whatsapp:status', { accountId, status: 'disconnected' });
      } catch (err) {
        console.error('[Socket] Disconnect error:', err);
        socket.emit('whatsapp:error', { message: 'Failed to disconnect' });
      }
    });

    // Get conversations for an account
    socket.on('whatsapp:get_conversations', async (data) => {
      try {
        const { accountId } = data;

        const account = await prisma.whatsAppAccount.findFirst({
          where: { id: accountId, userId },
        });
        if (!account) {
          socket.emit('whatsapp:error', { message: 'Account not found' });
          return;
        }

        const conversations = await prisma.conversation.findMany({
          where: { accountId },
          orderBy: [{ pinned: 'desc' }, { lastMessageAt: 'desc' }],
          include: { contact: true },
        });

        socket.emit('whatsapp:conversations', { accountId, conversations });
      } catch (err) {
        console.error('[Socket] Get conversations error:', err);
        socket.emit('whatsapp:error', { message: 'Failed to get conversations' });
      }
    });

    // Get messages for a conversation
    socket.on('whatsapp:get_messages', async (data) => {
      try {
        const { accountId, jid, limit = 50 } = data;

        const account = await prisma.whatsAppAccount.findFirst({
          where: { id: accountId, userId },
        });
        if (!account) {
          socket.emit('whatsapp:error', { message: 'Account not found' });
          return;
        }

        const messages = await prisma.message.findMany({
          where: { accountId, jid },
          orderBy: { timestamp: 'asc' },
          take: limit,
        });

        socket.emit('whatsapp:messages', { accountId, jid, messages });
      } catch (err) {
        console.error('[Socket] Get messages error:', err);
        socket.emit('whatsapp:error', { message: 'Failed to get messages' });
      }
    });

    // Mark conversation as read
    socket.on('whatsapp:mark_read', async (data) => {
      try {
        const wa = await loadWhatsApp();
        const { accountId, jid } = data;

        const account = await prisma.whatsAppAccount.findFirst({
          where: { id: accountId, userId },
        });
        if (!account) return;

        await prisma.conversation.update({
          where: { accountId_jid: { accountId, jid } },
          data: { unreadCount: 0 },
        });

        if (wa) {
          const conn = wa.getUserConnections(userId).find(c => c.accountId === accountId);
          if (conn) {
            const connection = wa.getConnection(accountId);
            if (connection?.sock) {
              await connection.sock.readMessages([{ remoteJid: jid, id: '' }]);
            }
          }
        }
      } catch (err) {
        console.error('[Socket] Mark read error:', err);
      }
    });

    // Get account connection status
    socket.on('whatsapp:get_status', async (data) => {
      try {
        const { accountId } = data;
        const account = await prisma.whatsAppAccount.findFirst({
          where: { id: accountId, userId },
        });
        if (!account) {
          socket.emit('whatsapp:error', { message: 'Account not found' });
          return;
        }

        socket.emit('whatsapp:status', {
          accountId,
          status: account.status,
          phone: account.phone,
          name: account.pushName || account.name,
        });
      } catch (err) {
        console.error('[Socket] Get status error:', err);
      }
    });

    // ---- Translation Events ----

    // Translate a message on demand
    socket.on('translation:translate', async (data) => {
      try {
        const { text, sourceLang, targetLang, engine } = data;

        const { translateText, detectLanguage } = await import('../services/translation.js');
        const settings = await getTranslationSettings(userId);
        const effectiveEngine = engine || settings.translationEngine || 'doubao';

        let effectiveSource = sourceLang || 'auto';
        if (effectiveSource === 'auto') {
          effectiveSource = await detectLanguage(text, effectiveEngine);
        }

        const result = await translateText(
          text,
          effectiveSource,
          targetLang || 'zh',
          effectiveEngine,
          userId
        );

        socket.emit('translation:result', result);
      } catch (err) {
        console.error('[Socket] Translation error:', err);
        socket.emit('whatsapp:error', { message: 'Translation failed' });
      }
    });

    // Get translation settings
    socket.on('translation:get_settings', async () => {
      try {
        const settings = await getTranslationSettings(userId);
        socket.emit('translation:settings', settings);
      } catch (err) {
        console.error('[Socket] Get translation settings error:', err);
      }
    });

    // Update translation settings
    socket.on('translation:update_settings', async (data) => {
      try {
        const { updateSettings } = await import('../services/translation.js');
        await updateSettings(userId, data);
        const settings = await getTranslationSettings(userId);
        socket.emit('translation:settings', settings);
      } catch (err) {
        console.error('[Socket] Update translation settings error:', err);
      }
    });

    // Disconnect
    socket.on('disconnect', () => {
      console.log(`[Socket] User ${userId} disconnected (socket: ${socket.id})`);
    });
  });
}
