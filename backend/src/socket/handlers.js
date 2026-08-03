/**
 * Socket.io 事件处理器 - Evolution API 版
 * 不再依赖裸BaileysProvider，改用Evolution REST API + 本地DB
 */
import { getEvolutionConnector } from '../services/evolution-connector.js';

const DEFAULT_SESSION_ID = "user_1";

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

    // 连接时推送当前状态
    (async () => {
      try {
        const evo = getEvolutionConnector();
        const state = await evo.getConnectionState();
        const info = await evo.getInstanceInfo().catch(() => null);
        const phone = (info?.ownerJid || "").split("@")[0] || null;
        socket.emit('whatsapp:status', {
          sessionId: DEFAULT_SESSION_ID,
          status: state === "open" ? "connected" : "disconnected",
          phone,
          instance: evo.instance,
          mode: "evolution-api",
        });
      } catch (e) {
        socket.emit('whatsapp:status', { sessionId: DEFAULT_SESSION_ID, status: "disconnected" });
      }
    })();

    // 请求QR码
    socket.on('whatsapp:request_qr', async () => {
      try {
        const evo = getEvolutionConnector();
        const state = await evo.getConnectionState();
        if (state === "open") {
          const info = await evo.getInstanceInfo().catch(() => null);
          const phone = (info?.ownerJid || "").split("@")[0];
          socket.emit('whatsapp:status', { sessionId: DEFAULT_SESSION_ID, status: 'connected', phone });
          return;
        }
        const qr = await evo.getQRCode();
        if (qr) {
          socket.emit('whatsapp:qr', { sessionId: DEFAULT_SESSION_ID, qr });
        } else {
          socket.emit('whatsapp:error', { message: '获取二维码失败，请稍后重试', code: 'QR_ERROR' });
        }
      } catch (err) {
        console.error('[Socket] whatsapp:request_qr error:', err.message);
        socket.emit('whatsapp:error', { message: '获取二维码失败: ' + err.message, code: 'QR_ERROR' });
      }
    });

    // 发消息（socket方式，前端主要走HTTP，这里做兼容）
    socket.on('whatsapp:send_message', async (data) => {
      try {
        const { to, message } = data || {};
        if (!to || !message) {
          socket.emit('whatsapp:error', { message: '缺少收件人或消息内容', code: 'MISSING_PARAMS' });
          return;
        }
        const evo = getEvolutionConnector();
        const state = await evo.getConnectionState();
        if (state !== "open") {
          socket.emit('whatsapp:error', { message: 'WhatsApp 未连接，请先扫码登录', code: 'NOT_CONNECTED' });
          return;
        }

        let toJid = to;
        if (!toJid.includes("@")) toJid = `${toJid.replace(/\D/g, "")}@s.whatsapp.net`;

        const result = await evo.sendTextMessage(toJid, message);
        const info = await evo.getInstanceInfo().catch(() => null);
        const ownerJid = info?.ownerJid || "me";

        // 落库
        let savedMsg = null;
        try {
          savedMsg = await prisma.wAMessage.create({
            data: {
              sessionId: DEFAULT_SESSION_ID,
              from: ownerJid,
              to: toJid,
              body: message,
              type: 'text',
              direction: 'outbound',
              timestamp: new Date(),
              waMessageId: result?.key?.id || null,
            },
          });
        } catch (e) {
          console.warn('[Socket] save send_message failed:', e.message);
        }

        // 维护客户
        try {
          const phone = toJid.split("@")[0];
          let cust = await prisma.customer.findFirst({ where: { userId: Number(userId), phone } });
          if (!cust) {
            await prisma.customer.create({
              data: { userId: Number(userId), phone, name: phone, source: 'whatsapp', status: 'potential', lastContactAt: new Date() },
            });
          } else {
            await prisma.customer.update({ where: { id: cust.id }, data: { lastContactAt: new Date() } });
          }
        } catch (e) {}

        io.to(`user_${userId}`).emit('whatsapp:message_sent', {
          id: savedMsg?.id || ('tmp-' + Date.now()),
          waMessageId: result?.key?.id || null,
          to: toJid,
          from: ownerJid,
          body: message,
          content: message,
          direction: 'outbound',
          fromMe: true,
          messageType: 'text',
          timestamp: savedMsg?.timestamp ? new Date(savedMsg.timestamp).getTime() : Date.now(),
          sessionId: DEFAULT_SESSION_ID,
          contact: { name: toJid.split("@")[0], phone: toJid.split("@")[0] },
        });
      } catch (err) {
        console.error('[Socket] whatsapp:send_message error:', err.message);
        socket.emit('whatsapp:error', { message: '发送消息失败: ' + err.message, code: 'SEND_ERROR' });
      }
    });

    // 断开连接
    socket.on('whatsapp:disconnect', async () => {
      try {
        const evo = getEvolutionConnector();
        await evo._delete(`/instance/logout/${evo.instance}`).catch(() => {});
        await prisma.wAConnection.updateMany({
          where: { sessionId: DEFAULT_SESSION_ID },
          data: { status: 'disconnected', lastConnectedAt: new Date() },
        });
        io.emit('whatsapp:status', { sessionId: DEFAULT_SESSION_ID, status: 'disconnected' });
      } catch (err) { console.error('[Socket] whatsapp:disconnect error:', err.message); }
    });

    // 获取会话列表（从本地DB，与REST一致）
    socket.on('whatsapp:get_conversations', async () => {
      try {
        const messages = await prisma.wAMessage.findMany({
          where: { sessionId: DEFAULT_SESSION_ID },
          orderBy: { timestamp: 'desc' },
          take: 500,
        });
        const map = new Map();
        for (const m of messages) {
          const jid = m.direction === 'inbound' ? m.from : m.to;
          if (!jid || jid === 'me' || !jid.includes('@') || jid.includes('broadcast')) continue;
          if (!map.has(jid)) {
            map.set(jid, { jid, lastMsg: m, unread: m.direction === 'inbound' && !m.read ? 1 : 0 });
          } else {
            const e = map.get(jid);
            if (new Date(m.timestamp) > new Date(e.lastMsg.timestamp)) e.lastMsg = m;
            if (m.direction === 'inbound' && !m.read) e.unread += 1;
          }
        }
        const phones = [...map.keys()].map(j => j.split("@")[0]);
        const customers = phones.length
          ? await prisma.customer.findMany({ where: { userId: Number(userId), phone: { in: phones } }, select: { phone: true, name: true } })
          : [];
        const custMap = new Map(customers.map(c => [c.phone, c]));
        const conversations = [];
        for (const [jid, e] of map) {
          const phone = jid.split("@")[0];
          const c = custMap.get(phone);
          conversations.push({
            jid, phone, name: c?.name || phone,
            lastMessage: e.lastMsg.body,
            lastMessageTime: e.lastMsg.timestamp,
            direction: e.lastMsg.direction,
            unreadCount: e.unread,
          });
        }
        conversations.sort((a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime));
        socket.emit('whatsapp:conversations', conversations);
      } catch (err) {
        console.error('[Socket] whatsapp:get_conversations error:', err.message);
        socket.emit('whatsapp:conversations', []);
      }
    });

    // 获取消息历史
    socket.on('whatsapp:get_messages', async (data) => {
      try {
        const { jid, limit = 50, before } = data || {};
        if (!jid) { socket.emit('whatsapp:messages', { jid, messages: [] }); return; }
        let targetJid = jid.includes("@") ? jid : `${jid.replace(/\D/g, "")}@s.whatsapp.net`;
        const where = { sessionId: DEFAULT_SESSION_ID, OR: [{ from: targetJid }, { to: targetJid }] };
        if (before) where.timestamp = { lt: new Date(before) };
        const messages = await prisma.wAMessage.findMany({ where, orderBy: { timestamp: 'desc' }, take: parseInt(limit) });
        await prisma.wAMessage.updateMany({
          where: { sessionId: DEFAULT_SESSION_ID, from: targetJid, direction: 'inbound', read: false },
          data: { read: true },
        });
        socket.emit('whatsapp:messages', { jid, messages: messages.reverse() });
      } catch (err) {
        console.error('[Socket] whatsapp:get_messages error:', err.message);
        socket.emit('whatsapp:messages', { jid: data?.jid, messages: [] });
      }
    });

    socket.on('whatsapp:get_status', async () => {
      try {
        const evo = getEvolutionConnector();
        const state = await evo.getConnectionState();
        const info = await evo.getInstanceInfo().catch(() => null);
        const phone = (info?.ownerJid || "").split("@")[0] || null;
        socket.emit('whatsapp:status', {
          sessionId: DEFAULT_SESSION_ID,
          status: state === "open" ? "connected" : "disconnected",
          phone,
        });
      } catch (err) {
        socket.emit('whatsapp:status', { sessionId: DEFAULT_SESSION_ID, status: 'disconnected' });
      }
    });

    socket.on('whatsapp:mark_read', async (data) => {
      try {
        const { jid } = data || {};
        if (!jid) return;
        // Support both WA (@s.whatsapp.net) and TG (@telegram) conversations
        const targetJid = jid.includes("@") ? jid : `${jid.replace(/\D/g, "")}@s.whatsapp.net`;
        const isTelegram = targetJid.endsWith('@telegram');
        if (isTelegram) {
          // TG: update both WAMessage and Conversation unreadCount
          await prisma.wAMessage.updateMany({
            where: { from: targetJid, direction: 'inbound', read: false },
            data: { read: true },
          });
          await prisma.conversation.updateMany({
            where: { jid: targetJid },
            data: { unreadCount: 0 },
          });
        } else {
          // WA: original logic
          await prisma.wAMessage.updateMany({
            where: { sessionId: DEFAULT_SESSION_ID, from: targetJid, direction: 'inbound', read: false },
            data: { read: true },
          });
        }
      } catch (err) {}
    });

    socket.on('disconnect', (reason) => {
      console.log(`[Socket] User ${userId} disconnected (socket: ${socket.id}, reason: ${reason})`);
    });
  });
}
