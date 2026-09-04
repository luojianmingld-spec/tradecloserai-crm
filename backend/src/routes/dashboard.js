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


/**
 * 客户盘点 - 漏斗视图
 * GET /api/dashboard/funnel
 */
router.get('/funnel', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId || 1;
    
    // 定义销售漏斗阶段
    const stages = [
      { key: 'potential', label: '新线索', color: '#3b82f6' },
      { key: 'contacted', label: '已联系', color: '#8b5cf6' },
      { key: 'qualified', label: '已确认需求', color: '#f59e0b' },
      { key: 'quoted', label: '已报价', color: '#10b981' },
      { key: 'won', label: '已成交', color: '#22c55e' },
      { key: 'lost', label: '已流失', color: '#ef4444' }
    ];
    
    // 查询各阶段客户数
    const stageCounts = await prisma.customer.groupBy({
      by: ['status'],
      where: { userId },
      _count: { id: true }
    });
    
    // 构建漏斗数据
    const stageMap = new Map(stageCounts.map(s => [s.status, s._count.id]));
    let total = 0;
    const funnel = stages.map(stage => {
      const count = stageMap.get(stage.key) || 0;
      total += count;
      return { ...stage, count };
    });
    
    // 计算转化率（相对上一阶段）
    let prevCount = 0;
    funnel.forEach((stage, i) => {
      if (i === 0) {
        stage.conversionRate = 100;
        stage.percentage = 100;
      } else {
        stage.conversionRate = prevCount > 0 ? Math.round((stage.count / prevCount) * 100) : 0;
        stage.percentage = total > 0 ? Math.round((stage.count / total) * 100) : 0;
      }
      prevCount = stage.count;
    });
    
    // 今日数据
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    
    const [todayNew, todayQualified, todayWon] = await Promise.all([
      prisma.customer.count({
        where: {
          userId,
          createdAt: { gte: todayStart, lte: todayEnd }
        }
      }),
      prisma.customer.count({
        where: {
          userId,
          status: 'qualified',
          updatedAt: { gte: todayStart, lte: todayEnd }
        }
      }),
      prisma.customer.count({
        where: {
          userId,
          status: 'won',
          updatedAt: { gte: todayStart, lte: todayEnd }
        }
      })
    ]);
    
    res.json({
      funnel,
      total,
      today: {
        new: todayNew,
        qualified: todayQualified,
        won: todayWon
      },
      generatedAt: new Date().toISOString()
    });
  } catch (err) {
    console.error('[Dashboard Funnel Error]', err);
    res.status(500).json({ error: '获取漏斗数据失败: ' + err.message });
  }
});

/**
 * 客户盘点 - 概览统计
 * GET /api/dashboard/overview
 */
router.get('/overview', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId || 1;
    
    const [totalCustomers, totalConversations, activeCustomers, wonCustomers] = await Promise.all([
      prisma.customer.count({ where: { userId } }),
      prisma.wAMessage.count({ 
        where: { sessionId: `user_${userId}` } 
      }),
      prisma.customer.count({ 
        where: { 
          userId, 
          status: { in: ['potential', 'contacted', 'qualified', 'quoted'] }
        } 
      }),
      prisma.customer.count({ 
        where: { userId, status: 'won' } 
      })
    ]);
    
    const conversionRate = totalCustomers > 0 
      ? Math.round((wonCustomers / totalCustomers) * 100) 
      : 0;
    
    res.json({
      total: totalCustomers,
      active: activeCustomers,
      won: wonCustomers,
      conversations: totalConversations,
      conversionRate,
      generatedAt: new Date().toISOString()
    });
  } catch (err) {
    console.error('[Dashboard Overview Error]', err);
    res.status(500).json({ error: '获取概览数据失败: ' + err.message });
  }
});

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
