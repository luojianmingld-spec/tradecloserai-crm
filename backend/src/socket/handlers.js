import { getBaileysProvider } from '../services/whatsapp-provider.js';

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

    // ─── WhatsApp Events ───

    socket.on('whatsapp:request_qr', async () => {
      try {
        const provider = getBaileysProvider();
        const connections = await prisma.wAConnection.findMany({
          where: { userId },
        });

        let connection = connections[0];
        if (!connection) {
          connection = await prisma.wAConnection.create({
            data: {
              userId,
              sessionId: `user_${userId}`,
              status: 'disconnected',
            },
          });
        }

        if (connection.status === 'connected') {
          socket.emit('whatsapp:status', {
            sessionId: connection.sessionId,
            status: 'connected',
            phone: connection.phone,
          });
          return;
        }

        const result = await provider.connect(connection.sessionId, userId);
        if (result.qr) {
          socket.emit('whatsapp:qr', {
            sessionId: connection.sessionId,
            qr: result.qr,
          });
        }
      } catch (err) {
        console.error('[Socket] whatsapp:request_qr error:', err.message);
        socket.emit('whatsapp:error', {
          message: '获取二维码失败: ' + err.message,
          code: 'QR_ERROR',
        });
      }
    });

    socket.on('whatsapp:send_message', async (data) => {
      try {
        const { to, message, autoTranslate } = data;
        if (!to || !message) {
          socket.emit('whatsapp:error', {
            message: '缺少收件人或消息内容',
            code: 'MISSING_PARAMS',
          });
          return;
        }

        const connection = await prisma.wAConnection.findFirst({
          where: { userId, status: 'connected' },
        });

        if (!connection) {
          socket.emit('whatsapp:error', {
            message: 'WhatsApp 未连接，请先扫码登录',
            code: 'NOT_CONNECTED',
          });
          return;
        }

        const provider = getBaileysProvider();

        // Auto translate outgoing message
        let finalMessage = message;
        let translation = null;
        if (autoTranslate) {
          try {
            const { translateText } = await import('../services/ai.service.js');
            const result = await translateText(userId, message, 'zh', 'en');
            if (result.translated) {
              finalMessage = result.translated;
              translation = {
                original: message,
                translated: result.translated,
                sourceLang: 'zh',
                targetLang: 'en',
              };
            }
          } catch (e) {
            console.error('[Socket] Auto-translate outgoing error:', e.message);
          }
        }

        const msgResult = await provider.sendMessage(
          connection.sessionId,
          to,
          finalMessage
        );

        // Save outgoing message to DB
        const savedMsg = await prisma.wAMessage.create({
          data: {
            sessionId: connection.sessionId,
            from: connection.phone || 'me',
            to,
            body: message,
            type: 'text',
            direction: 'outgoing',
            timestamp: new Date(),
          },
        });

        // Auto-create/update customer
        await autoCreateCustomer(prisma, userId, to);

        socket.emit('whatsapp:message_sent', {
          id: savedMsg.id,
          to,
          body: message,
          translatedBody: finalMessage !== message ? finalMessage : undefined,
          translation,
          timestamp: savedMsg.timestamp,
        });

        // Also notify all user's sockets
        io.to(`user_${userId}`).emit('whatsapp:message', {
          id: savedMsg.id,
          from: connection.phone || 'me',
          to,
          body: message,
          translatedBody: finalMessage !== message ? finalMessage : undefined,
          translation,
          direction: 'outgoing',
          timestamp: savedMsg.timestamp,
        });
      } catch (err) {
        console.error('[Socket] whatsapp:send_message error:', err.message);
        socket.emit('whatsapp:error', {
          message: '发送消息失败: ' + err.message,
          code: 'SEND_ERROR',
        });
      }
    });

    socket.on('whatsapp:disconnect', async () => {
      try {
        const connection = await prisma.wAConnection.findFirst({
          where: { userId },
        });
        if (connection) {
          const provider = getBaileysProvider();
          await provider.disconnect(connection.sessionId);
          await prisma.wAConnection.update({
            where: { id: connection.id },
            data: { status: 'disconnected', lastConnectedAt: new Date() },
          });
          socket.emit('whatsapp:status', {
            sessionId: connection.sessionId,
            status: 'disconnected',
          });
        }
      } catch (err) {
        console.error('[Socket] whatsapp:disconnect error:', err.message);
      }
    });

    socket.on('whatsapp:get_conversations', async () => {
      try {
        const connection = await prisma.wAConnection.findFirst({
          where: { userId },
        });
        if (!connection) {
          socket.emit('whatsapp:conversations', []);
          return;
        }

        // Get unique contacts from messages
        const contacts = await prisma.wAMessage.findMany({
          where: { sessionId: connection.sessionId },
          select: { from: true, to: true, direction: true },
          distinct: ['from', 'to'],
          orderBy: { timestamp: 'desc' },
        });

        // Build conversation list with last message
        const jids = new Set();
        contacts.forEach((c) => {
          if (c.direction === 'incoming') jids.add(c.from);
          else jids.add(c.to);
        });

        const conversations = [];
        for (const jid of jids) {
          const lastMsg = await prisma.wAMessage.findFirst({
            where: {
              sessionId: connection.sessionId,
              OR: [{ from: jid }, { to: jid }],
            },
            orderBy: { timestamp: 'desc' },
          });

          const unreadCount = await prisma.wAMessage.count({
            where: {
              sessionId: connection.sessionId,
              from: jid,
              direction: 'incoming',
              read: false,
            },
          });

          conversations.push({
            jid,
            lastMessage: lastMsg?.body || '',
            lastMessageTime: lastMsg?.timestamp,
            unreadCount,
          });
        }

        socket.emit('whatsapp:conversations', conversations);
      } catch (err) {
        console.error('[Socket] whatsapp:get_conversations error:', err.message);
        socket.emit('whatsapp:conversations', []);
      }
    });

    socket.on('whatsapp:get_messages', async (data) => {
      try {
        const { jid, limit = 50, before } = data;
        const connection = await prisma.wAConnection.findFirst({
          where: { userId },
        });
        if (!connection) {
          socket.emit('whatsapp:messages', { jid, messages: [] });
          return;
        }

        const where = {
          sessionId: connection.sessionId,
          OR: [{ from: jid }, { to: jid }],
        };

        if (before) {
          where.timestamp = { lt: new Date(before) };
        }

        const messages = await prisma.wAMessage.findMany({
          where,
          orderBy: { timestamp: 'desc' },
          take: limit,
        });

        // Mark as read
        await prisma.wAMessage.updateMany({
          where: {
            sessionId: connection.sessionId,
            from: jid,
            direction: 'incoming',
            read: false,
          },
          data: { read: true },
        });

        socket.emit('whatsapp:messages', {
          jid,
          messages: messages.reverse(),
        });
      } catch (err) {
        console.error('[Socket] whatsapp:get_messages error:', err.message);
        socket.emit('whatsapp:messages', { jid: data?.jid, messages: [] });
      }
    });

    socket.on('whatsapp:get_status', async () => {
      try {
        const connection = await prisma.wAConnection.findFirst({
          where: { userId },
        });
        if (connection) {
          const provider = getBaileysProvider();
          const status = provider.getStatus(connection.sessionId);
          socket.emit('whatsapp:status', {
            sessionId: connection.sessionId,
            status: status.status || connection.status,
            phone: connection.phone,
          });
        } else {
          socket.emit('whatsapp:status', { status: 'disconnected' });
        }
      } catch (err) {
        console.error('[Socket] whatsapp:get_status error:', err.message);
      }
    });

    socket.on('whatsapp:mark_read', async (data) => {
      try {
        const { jid } = data;
        const connection = await prisma.wAConnection.findFirst({
          where: { userId },
        });
        if (connection) {
          await prisma.wAMessage.updateMany({
            where: {
              sessionId: connection.sessionId,
              from: jid,
              direction: 'incoming',
              read: false,
            },
            data: { read: true },
          });
        }
      } catch (err) {
        console.error('[Socket] whatsapp:mark_read error:', err.message);
      }
    });

    socket.on('disconnect', () => {
      console.log(`[Socket] User ${userId} disconnected (socket: ${socket.id})`);
    });
  });
}

// ─── Helper: Auto-create Customer ───

async function autoCreateCustomer(prisma, userId, phone) {
  if (!phone) return;

  // Normalize phone number
  const normalizedPhone = phone.replace('@s.whatsapp.net', '').replace('@c.us', '');

  try {
    const existing = await prisma.customer.findFirst({
      where: { userId, phone: normalizedPhone },
    });

    if (!existing) {
      await prisma.customer.create({
        data: {
          userId,
          phone: normalizedPhone,
          name: normalizedPhone, // Default name = phone, user can update later
          source: 'whatsapp',
          status: 'potential',
        },
      });
      console.log(`[AutoCreate] Customer created for phone: ${normalizedPhone}`);
    } else {
      // Update lastContactAt
      await prisma.customer.update({
        where: { id: existing.id },
        data: { lastContactAt: new Date() },
      });
    }
  } catch (err) {
    console.error('[AutoCreate] Customer auto-create error:', err.message);
  }
}
