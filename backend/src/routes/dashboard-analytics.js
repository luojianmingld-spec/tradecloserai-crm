import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();
const prisma = new PrismaClient();

// Feature 1: Customer Overview
router.get("/overview", authMiddleware, async (req, res) => {
  try {
    const userId = req.userId || 1;
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const levelGroups = await prisma.customer.groupBy({
      by: ["customerLevel"],
      where: { userId },
      _count: { id: true },
    });
    const levelMap = {};
    for (const g of levelGroups) levelMap[g.customerLevel] = g._count.id;

    const statusGroups = await prisma.customer.groupBy({
      by: ["status"],
      where: { userId },
      _count: { id: true },
    });
    const statusMap = {};
    for (const g of statusGroups) statusMap[g.status] = g._count.id;

    const intentGroups = await prisma.customer.groupBy({
      by: ["intentLevel"],
      where: { userId },
      _count: { id: true },
    });
    const intentMap = {};
    for (const g of intentGroups) intentMap[g.intentLevel] = g._count.id;

    const [todayNew, todayFollowup, totalCustomers] = await Promise.all([
      prisma.customer.count({ where: { userId, firstContactAt: { gte: todayStart } } }),
      prisma.customer.count({ where: { userId, lastContactAt: { gte: todayStart } } }),
      prisma.customer.count({ where: { userId } }),
    ]);

    const funnel = [
      { stage: "new", label: "\u65b0\u7ebf\u7d22", count: levelMap["D"] || 0, color: "#94a3b8" },
      { stage: "interested", label: "\u6709\u610f\u5411", count: levelMap["C"] || 0, color: "#3b82f6" },
      { stage: "negotiating", label: "\u6d3d\u8c08\u4e2d", count: levelMap["B"] || 0, color: "#f59e0b" },
      { stage: "closing", label: "\u5373\u5c06\u6210\u4ea4", count: levelMap["A"] || 0, color: "#10b981" },
      { stage: "closed", label: "\u5df2\u6210\u4ea4", count: statusMap["closed"] || statusMap["won"] || 0, color: "#22c55e" },
    ];

    const closedCount = funnel[funnel.length - 1].count;
    const conversionRate = totalCustomers > 0 ? Math.round((closedCount / totalCustomers) * 100) : 0;

    res.json({
      total: totalCustomers,
      todayNew,
      todayFollowup,
      levelDistribution: levelMap,
      statusDistribution: statusMap,
      intentDistribution: intentMap,
      funnel,
      conversionRate,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[Dashboard Overview Error]", err);
    res.status(500).json({ error: "\u83b7\u53d6\u5ba2\u6237\u76d8\u70b9\u6570\u636e\u5931\u8d25: " + err.message });
  }
});

// Feature 2: Lead Qualification
router.post("/qualify-leads", authMiddleware, async (req, res) => {
  try {
    const userId = req.userId || 1;

    const customers = await prisma.customer.findMany({
      where: { userId },
      select: { id: true, name: true, phone: true, email: true, company: true, industry: true, source: true, customerLevel: true, intentLevel: true, requirementSummary: true, requirementBudget: true, requirementProducts: true },
    });

    const bantScores = await prisma.customerBantScore.findMany({
      where: { contactId: { in: customers.map((c) => c.id) } },
      select: { contactId: true, totalScore: true, level: true },
    });
    const bantMap = {};
    for (const b of bantScores) bantMap[b.contactId] = b;

    const qualified = [];
    for (const c of customers) {
      let quality = c.customerLevel || "C";
      let qualityLabel = "\u4e00\u822c";
      let score = c.intentLevel || 3;

      if (bantMap[c.id]) {
        score = bantMap[c.id].totalScore;
        if (score >= 80) { quality = "A"; qualityLabel = "\u4f18\u8d28"; }
        else if (score >= 60) { quality = "B"; qualityLabel = "\u826f\u597d"; }
        else if (score >= 40) { quality = "C"; qualityLabel = "\u4e00\u822c"; }
        else { quality = "D"; qualityLabel = "\u5f85\u786e\u8ba4"; }
      } else {
        if (c.intentLevel <= 2) { quality = "A"; qualityLabel = "\u4f18\u8d28"; }
        else if (c.intentLevel <= 3) { quality = "B"; qualityLabel = "\u826f\u597d"; }
        else if (c.intentLevel <= 4) { quality = "C"; qualityLabel = "\u4e00\u822c"; }
        else { quality = "D"; qualityLabel = "\u5f85\u786e\u8ba4"; }
      }

      qualified.push({
        id: c.id,
        name: c.name || c.phone || "\u672a\u77e5",
        company: c.company,
        quality,
        qualityLabel,
        score,
        source: c.source,
        phone: c.phone,
      });
    }

    qualified.sort((a, b) => a.score - b.score);

    const stats = { A: 0, B: 0, C: 0, D: 0 };
    for (const q of qualified) stats[q.quality] = (stats[q.quality] || 0) + 1;

    res.json({
      total: qualified.length,
      stats,
      leads: qualified,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[Qualify Leads Error]", err);
    res.status(500).json({ error: "\u7ebf\u7d22\u8d28\u68c0\u5931\u8d25: " + err.message });
  }
});

// Feature 3: Personal Performance
router.get("/my-stats", authMiddleware, async (req, res) => {
  try {
    const userId = req.userId || 1;
    const sessionId = "user_" + userId;
    const period = req.query.period || "month";
    const now = new Date();

    let periodStart;
    if (period === "week") {
      periodStart = new Date(now.getTime() - 7 * 86400000);
    } else {
      periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const [totalMessages, inboundMsgs, outboundMsgs, totalCustomers, periodCustomers] = await Promise.all([
      prisma.wAMessage.count({ where: { sessionId, timestamp: { gte: periodStart } } }),
      prisma.wAMessage.count({ where: { sessionId, direction: "inbound", timestamp: { gte: periodStart } } }),
      prisma.wAMessage.count({ where: { sessionId, direction: "outbound", timestamp: { gte: periodStart } } }),
      prisma.customer.count({ where: { userId } }),
      prisma.customer.count({ where: { userId, firstContactAt: { gte: periodStart } } }),
    ]);

    const closedCustomers = await prisma.customer.count({
      where: { userId, status: { in: ["closed", "won"] }, updatedAt: { gte: periodStart } },
    });

    const followupCustomers = await prisma.customerFollowUp.count({
      where: { customer: { userId }, createdAt: { gte: periodStart } },
    });

    const recentInbound = await prisma.wAMessage.findMany({
      where: { sessionId, direction: "inbound", timestamp: { gte: periodStart } },
      orderBy: { timestamp: "asc" },
      select: { from: true, timestamp: true },
      take: 200,
    });

    const recentOutbound = await prisma.wAMessage.findMany({
      where: { sessionId, direction: "outbound", timestamp: { gte: periodStart } },
      orderBy: { timestamp: "asc" },
      select: { to: true, timestamp: true },
      take: 500,
    });

    const outByJid = new Map();
    for (const m of recentOutbound) {
      if (!m.to) continue;
      if (!outByJid.has(m.to)) outByJid.set(m.to, []);
      outByJid.get(m.to).push(m.timestamp instanceof Date ? m.timestamp.getTime() : new Date(m.timestamp).getTime());
    }

    const diffs = [];
    for (const m of recentInbound) {
      if (!m.from) continue;
      const outs = outByJid.get(m.from);
      if (!outs || !outs.length) continue;
      const t = m.timestamp instanceof Date ? m.timestamp.getTime() : new Date(m.timestamp).getTime();
      for (const ot of outs) {
        const diff = (ot - t) / 60000;
        if (diff >= 0 && diff < 1440) { diffs.push(diff); break; }
      }
    }

    const avgResponseMin = diffs.length > 0 ? Math.round(diffs.reduce((a, b) => a + b, 0) / diffs.length) : null;
    const conversionRate = totalCustomers > 0 ? Math.round((closedCustomers / totalCustomers) * 100) : 0;

    const days = period === "week" ? 7 : 30;
    const trend = [];
    for (let i = days - 1; i >= 0; i--) {
      const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const dayEnd = new Date(dayStart.getTime() + 86400000);
      const msgCount = await prisma.wAMessage.count({
        where: { sessionId, timestamp: { gte: dayStart, lt: dayEnd } },
      });
      trend.push({
        date: (dayStart.getMonth() + 1) + "/" + dayStart.getDate(),
        messages: msgCount,
      });
    }

    res.json({
      period,
      summary: {
        totalMessages,
        inboundMessages: inboundMsgs,
        outboundMessages: outboundMsgs,
        newCustomers: periodCustomers,
        totalCustomers,
        closedCustomers,
        followupCount: followupCustomers,
        avgResponseMinutes: avgResponseMin,
        conversionRate,
      },
      trend,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[My Stats Error]", err);
    res.status(500).json({ error: "\u83b7\u53d6\u4e1a\u7ee9\u6570\u636e\u5931\u8d25: " + err.message });
  }
});

export default router;
