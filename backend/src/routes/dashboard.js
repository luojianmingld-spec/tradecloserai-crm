import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth.js';
import { getPendingFollowups } from '../services/followup.service.js';
import { resolveToPhoneJid } from '../services/lid-mapping.js';

const router = Router();
const prisma = new PrismaClient();

/**
 * Extract customer jid from a message (same logic as followup.service.js helper).
 */
function extractCustomerJid(msg, selfJid) {
  const { direction, from, to } = msg;
  let jid = null;
  if (direction === 'inbound') jid = from;
  else if (direction === 'outbound') jid = to;
  if (!jid) return null;
  if (jid.includes('@g.us')) return null;
  if (jid.includes('@broadcast')) return null;
  if (jid === 'status@broadcast') return null;
  if (selfJid && jid === selfJid) return null;
  if (!jid.includes('@s.whatsapp.net') && !jid.includes('@lid')) return null;
  // JID归一化：@lid → @s.whatsapp.net，避免同一客户分裂
  jid = resolveToPhoneJid(jid);
  return jid;
}

function truncate(s, max = 60) {
  if (!s) return '';
  const str = String(s);
  return str.length > max ? str.slice(0, max) + '…' : str;
}

router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId || 1;
    const sessionId = `user_${userId}`;

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // ─── Base counts ─────────────────────────────────────────────────────────
    const [totalCustomers, totalMessages, unreadMessages, todayMessages, weekMessages] = await Promise.all([
      prisma.customer.count({ where: { userId } }),
      prisma.wAMessage.count({ where: { sessionId } }),
      prisma.wAMessage.count({ where: { sessionId, direction: 'inbound', read: false } }),
      prisma.wAMessage.count({ where: { sessionId, timestamp: { gte: todayStart } } }),
      prisma.wAMessage.count({ where: { sessionId, timestamp: { gte: weekAgo } } }),
    ]);

    // ─── Active conversations (distinct customer jid count) ──────────────────
    const recentMsgs = await prisma.wAMessage.findMany({
      where: { sessionId },
      orderBy: { timestamp: 'desc' },
      take: 2000,
      select: { direction: true, from: true, to: true },
    });

    let selfJid = null;
    try {
      const conn = await prisma.wAConnection.findUnique({ where: { sessionId } });
      if (conn?.phone) selfJid = conn.phone + '@s.whatsapp.net';
    } catch (_) { /* ignore */ }

    const jidSet = new Set();
    for (const m of recentMsgs) {
      const jid = extractCustomerJid(m, selfJid);
      if (jid) jidSet.add(jid);
    }
    const totalConversations = jidSet.size;

    // ─── Average response time (minutes) ─────────────────────────────────────
    let avgResponseMinutes = null;
    try {
      const [inbound, outbound] = await Promise.all([
        prisma.wAMessage.findMany({
          where: { sessionId, direction: 'inbound', timestamp: { gte: weekAgo } },
          orderBy: { timestamp: 'asc' },
          select: { from: true, timestamp: true },
          take: 500,
        }),
        prisma.wAMessage.findMany({
          where: { sessionId, direction: 'outbound', timestamp: { gte: weekAgo } },
          orderBy: { timestamp: 'asc' },
          select: { to: true, timestamp: true },
          take: 2000,
        }),
      ]);

      const outByJid = new Map();
      for (const m of outbound) {
        let jid = m.to;
        if (jid && (jid.includes('@s.whatsapp.net') || jid.includes('@lid'))) jid = resolveToPhoneJid(jid);
        if (!jid) continue;
        const t = m.timestamp instanceof Date ? m.timestamp.getTime() : new Date(m.timestamp).getTime();
        if (!outByJid.has(jid)) outByJid.set(jid, []);
        outByJid.get(jid).push(t);
      }

      const diffs = [];
      for (const m of inbound) {
        let jid = m.from;
        if (jid && (jid.includes('@s.whatsapp.net') || jid.includes('@lid'))) jid = resolveToPhoneJid(jid);
        const outs = outByJid.get(jid);
        if (!outs || !outs.length) continue;
        const t = m.timestamp instanceof Date ? m.timestamp.getTime() : new Date(m.timestamp).getTime();
        let lo = 0, hi = outs.length;
        while (lo < hi) {
          const mid = (lo + hi) >> 1;
          if (outs[mid] > t) hi = mid; else lo = mid + 1;
        }
        if (lo < outs.length) {
          const diff = (outs[lo] - t) / 60000;
          if (diff >= 0 && diff < 60 * 24) diffs.push(diff);
        }
      }
      if (diffs.length >= 1) {
        avgResponseMinutes = Math.round(diffs.reduce((a, b) => a + b, 0) / diffs.length);
      }
    } catch (e) {
      console.error('[Dashboard] avg response calc error:', e.message);
    }

    // ─── Recent customers (8) ────────────────────────────────────────────────
    let followups = { urgent: [], followup: [], reactivate: [], total: 0 };
    try {
      followups = await getPendingFollowups({ userId, sessionId });
    } catch (e) {
      console.error('[Dashboard] getPendingFollowups error:', e.message);
    }

    const recentCustomers = [];
    const seenJids = new Set();

    const pushOne = (item, level) => {
      if (!item || !item.jid) return;
      if (seenJids.has(item.jid)) return;
      seenJids.add(item.jid);
      recentCustomers.push({
        jid: item.jid,
        name: item.name || item.jid.split('@')[0],
        lastMessage: truncate(item.lastMessage || ''),
        lastMessageTime: item.lastMessageAt || item.lastMessageTime,
        direction: item.lastDirection || item.direction || null,
        followupLevel: level,
      });
    };

    for (const it of (followups.pending || followups.urgent || [])) pushOne(it, 'pending');
    for (const it of followups.followup) pushOne(it, 'followup');

    if (recentCustomers.length < 8) {
      try {
        const latestMsgs = await prisma.wAMessage.findMany({
          where: { sessionId },
          orderBy: { timestamp: 'desc' },
          take: 100,
          select: { from: true, to: true, body: true, timestamp: true, direction: true },
        });

        const phones = [];
        for (const m of latestMsgs) {
          const jid = extractCustomerJid(m, selfJid);
          if (jid && !seenJids.has(jid)) phones.push(jid.split('@')[0]);
        }
        const uniquePhones = [...new Set(phones)];
        const custMap = new Map();
        if (uniquePhones.length) {
          const customers = await prisma.customer.findMany({
            where: { userId, phone: { in: uniquePhones } },
            select: { phone: true, name: true },
          });
          for (const c of customers) custMap.set(c.phone, c);
        }

        const lastByJid = new Map();
        for (const m of latestMsgs) {
          const jid = extractCustomerJid(m, selfJid);
          if (!jid) continue;
          if (seenJids.has(jid)) continue;
          if (!lastByJid.has(jid)) lastByJid.set(jid, m);
        }

        for (const [jid, m] of lastByJid.entries()) {
          if (recentCustomers.length >= 8) break;
          const phone = jid.split('@')[0];
          const name = custMap.get(phone)?.name || phone;
          recentCustomers.push({
            jid,
            name,
            lastMessage: truncate(m.body || ''),
            lastMessageTime: m.timestamp instanceof Date ? m.timestamp.toISOString() : new Date(m.timestamp).toISOString(),
            direction: m.direction,
            followupLevel: null,
          });
        }
      } catch (e) {
        console.error('[Dashboard] recent active fill error:', e.message);
      }
    }

    res.json({
      totalCustomers,
      totalConversations,
      totalMessages,
      unreadMessages,
      todayMessages,
      weekMessages,
      avgResponseMinutes,
      recentCustomers,
      pending: followups.pending,
      followup: followups.followup,
      urgent: followups.pending,
      reactivate: [],
      pendingTotal: followups.pendingTotal,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[Dashboard Stats Error]', err);
    res.status(500).json({ error: '获取统计数据失败: ' + err.message });
  }
});

export default router;
