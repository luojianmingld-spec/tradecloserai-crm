import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// Get messages for a conversation/contact
router.get('/', async (req, res) => {
  try {
    const { accountId, contactId, jid, limit = 50, before } = req.query;
    const uid = req.userId || 1;

    // 【P0安全修复】校验 account 归属当前用户
    let verifiedAccountId = null;
    if (accountId) {
      const account = await prisma.whatsAppAccount.findFirst({
        where: { id: parseInt(accountId), userId: uid },
      });
      if (!account) return res.status(403).json({ error: 'Access denied' });
      verifiedAccountId = account.id;
    }

    // 【P0安全修复】解析目标 jid（支持 customerId 按 userId 过滤，防越权探测）
    let targetJid = jid || null;
    if (req.query.customerId) {
      const cust = await prisma.customer.findFirst({
        where: { id: parseInt(req.query.customerId), userId: uid },
      });
      if (!cust) return res.json([]);
      targetJid = cust.jid || (cust.phone ? `${String(cust.phone).replace(/\D/g, '')}@s.whatsapp.net` : null);
      if (!targetJid) return res.json([]);
    }

    // 【P0安全修复】解析当前用户可访问的 sessionId 集合（用于 WAMessage 隔离）
    const ownConns = await prisma.wAConnection.findMany({
      where: { userId: uid, sessionId: { startsWith: 'user_' } },
      select: { sessionId: true },
    });
    const ownSessionIds = ownConns.map(c => c.sessionId);

    const where = {};
    if (targetJid) {
      // 校验该 jid 归属当前用户的某个会话/账号，否则拒绝（防跨租户读消息）
      const ownAccs = await prisma.whatsAppAccount.findMany({
        where: { userId: uid, platform: 'whatsapp' },
        select: { id: true },
      });
      const ownAccIds = ownAccs.map(a => a.id);
      const conv = await prisma.conversation.findFirst({
        where: { jid: targetJid, accountId: { in: ownAccIds } },
        select: { accountId: true },
      });
      if (!conv) {
        // 找不到归属会话 → 拒绝（防止用任意 jid 探测他人消息）
        return res.status(403).json({ error: 'Access denied' });
      }
      // 会话归属校验通过后，用该账号 phone 关联的所有 sessionId 过滤（同一号码可能多个session）
      let sessIds = [];
      try {
        const acc = await prisma.whatsAppAccount.findUnique({ where: { id: conv.accountId } });
        if (acc && acc.phone) {
          const conns = await prisma.wAConnection.findMany({
            where: { userId: uid, phone: acc.phone, sessionId: { startsWith: 'user_' } },
            select: { sessionId: true },
          });
          sessIds = conns.map(c => c.sessionId);
        }
      } catch (_) {}
      if (sessIds.length === 1) where.sessionId = sessIds[0];
      else if (sessIds.length > 1) where.sessionId = { in: sessIds };
      else if (ownSessionIds.length) where.sessionId = { in: ownSessionIds };
      else return res.json([]);
      where.OR = [{ from: targetJid }, { to: targetJid }];
    } else if (verifiedAccountId) {
      // 只传 accountId：用该账号 phone 关联的所有 session 过滤
      let sessIds = [];
      try {
        const acc = await prisma.whatsAppAccount.findUnique({ where: { id: verifiedAccountId } });
        if (acc && acc.phone) {
          const conns = await prisma.wAConnection.findMany({
            where: { userId: uid, phone: acc.phone, sessionId: { startsWith: 'user_' } },
            select: { sessionId: true },
          });
          sessIds = conns.map(c => c.sessionId);
        }
      } catch (_) {}
      if (sessIds.length === 1) where.sessionId = sessIds[0];
      else if (sessIds.length > 1) where.sessionId = { in: sessIds };
      else if (ownSessionIds.length) where.sessionId = { in: ownSessionIds };
      else return res.json([]);
    } else {
      // 无 jid / 无 accountId / 无 customerId → 拒绝全量拉取（防越权）
      return res.status(400).json({ error: 'jid or customerId or accountId required' });
    }

    if (before) where.id = { lt: parseInt(before) };

    const messages = await prisma.wAMessage.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: parseInt(limit),
    });

    // Convert WAMessage format to frontend expected format
    const converted = messages.reverse().map(msg => ({
      id: msg.id,
      jid: msg.direction === 'outbound' || msg.direction === 'outgoing' ? msg.to : msg.from,
      from: msg.from,
      to: msg.to,
      content: msg.body,
      body: msg.body,
      fromMe: msg.direction === 'outbound' || msg.direction === 'outgoing',
      direction: msg.direction,
      messageType: msg.type || 'text',
      timestamp: msg.timestamp,
      translation: (() => {
        if (!msg.translation) return null;
        try {
          const parsed = JSON.parse(msg.translation);
          const isOutgoing = msg.direction === 'outbound' || msg.direction === 'outgoing';
          return isOutgoing ? (parsed.original || parsed.translated) : (parsed.translated || parsed.original);
        } catch {
          return msg.translation;
        }
      })(),
      sourceLang: msg.sourceLang || null,
      waMessageId: msg.waMessageId,
      mediaUrl: msg.mediaUrl,
      deliveredAt: msg.deliveredAt || null,
      readAt: msg.readAt || null,
      ackError: msg.ackError || null,
      read: !!msg.read,
    }));

    res.json(converted);
  } catch (err) {
    console.error('[Messages] List error:', err);
    res.status(500).json({ error: 'Failed to list messages' });
  }
});

export default router;
