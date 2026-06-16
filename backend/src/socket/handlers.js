import {
  autoTranslateMessage,
  translateOutgoing,
  getTranslationSettings,
} from '../services/translation.js';

// ─── WhatsApp 功能暂时禁用 ───
// Baileys 依赖在部署环境中安装不稳定，暂时注释
// 待部署稳定后重新接入

function whatsappUnavailable(socket) {
  socket.emit('whatsapp:error', {
    message: 'WhatsApp 功能暂未启用，请联系管理员',
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

    socket.join(`user_${userId}`);
    console.log(`[Socket] User ${userId} connected (socket: ${socket.id})`);

    // ---- WhatsApp Account Events (temporarily disabled) ----

    socket.on('whatsapp:request_qr', async () => whatsappUnavailable(socket));
    socket.on('whatsapp:send_message', async () => whatsappUnavailable(socket));
    socket.on('whatsapp:disconnect', async () => whatsappUnavailable(socket));
    socket.on('whatsapp:get_conversations', async () => whatsappUnavailable(socket));
    socket.on('whatsapp:get_messages', async () => whatsappUnavailable(socket));
    socket.on('whatsapp:mark_read', async () => {});
    socket.on('whatsapp:get_status', async () => whatsappUnavailable(socket));

    // ---- Translation Events ----

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

    socket.on('translation:get_settings', async () => {
      try {
        const settings = await getTranslationSettings(userId);
        socket.emit('translation:settings', settings);
      } catch (err) {
        console.error('[Socket] Get translation settings error:', err);
      }
    });

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

    socket.on('disconnect', () => {
      console.log(`[Socket] User ${userId} disconnected (socket: ${socket.id})`);
    });
  });
}
