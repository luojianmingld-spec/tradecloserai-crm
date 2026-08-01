/**
 * Phase 9: Effect Tracking (WA-adapted)
 * Uses WAMessage table (from/to/body/direction) instead of Message
 */
import { Router } from "express";
import { PrismaClient } from "@prisma/client";

const router = Router();
const prisma = new PrismaClient();

function normalizeJid(jid) {
  if (!jid || !jid.includes("@")) return [];
  const phone = jid.split("@")[0];
  const variants = [jid];
  if (jid.endsWith("@s.whatsapp.net")) {
    variants.push(phone + "@c.us");
    variants.push(phone + "@lid");
  } else if (jid.endsWith("@c.us")) {
    variants.push(phone + "@s.whatsapp.net");
    variants.push(phone + "@lid");
  } else if (jid.endsWith("@lid")) {
    variants.push(phone + "@s.whatsapp.net");
    variants.push(phone + "@c.us");
  }
  return variants;
}

function decodeJid(raw) {
  if (!raw) return null;
  let jid = decodeURIComponent(raw);
  if (!jid.includes("@")) jid += "@s.whatsapp.net";
  return jid;
}

export async function trackEffectiveness(contactJid, waMessageId, sentAt) {
  try {
    if (!contactJid) return { error: "contactJid required" };
    const variants = normalizeJid(contactJid);
    const contacts = await prisma.contact.findMany({ where: { jid: { in: variants } } });
    if (!contacts || contacts.length === 0) return { error: "contact not found" };
    const contactJids = contacts.map(c => c.jid);

    const sentMsg = await prisma.wAMessage.findFirst({
      where: { id: waMessageId || undefined, direction: "outbound", to: { in: contactJids } },
      orderBy: { timestamp: "desc" },
    });
    if (!sentMsg) return { error: "sent message not found" };

    const customerReply = await prisma.wAMessage.findFirst({
      where: { direction: "inbound", from: { in: contactJids }, timestamp: { gt: sentMsg.timestamp } },
      orderBy: { timestamp: "asc" },
    });

    const now = new Date();
    const sentTime = new Date(sentMsg.timestamp);
    const hoursSinceSent = (now - sentTime) / (1000 * 60 * 60);
    let responseTimeHours = null, responded = false, effectivenessScore = 0;

    if (customerReply) {
      responded = true;
      const replyTime = new Date(customerReply.timestamp);
      responseTimeHours = Math.round(((replyTime - sentTime) / (1000 * 60 * 60)) * 10) / 10;
      if (responseTimeHours < 1) effectivenessScore = 90;
      else if (responseTimeHours < 4) effectivenessScore = 80;
      else if (responseTimeHours < 12) effectivenessScore = 70;
      else if (responseTimeHours < 24) effectivenessScore = 60;
      else if (responseTimeHours < 48) effectivenessScore = 40;
      else effectivenessScore = 20;
      if (customerReply.body && customerReply.body.length > 100) effectivenessScore = Math.min(100, effectivenessScore + 10);
    } else {
      if (hoursSinceSent < 2) effectivenessScore = null;
      else if (hoursSinceSent < 24) effectivenessScore = 30;
      else if (hoursSinceSent < 48) effectivenessScore = 15;
      else effectivenessScore = 0;
    }

    const relatedSample = await prisma.messageSample.findFirst({
      where: { contactJid, salesReply: { contains: (sentMsg.body || "").substring(0, 50) } },
      orderBy: { createdAt: "desc" },
    });

    const record = await prisma.speechEffectiveness.upsert({
      where: { sentMessageId: sentMsg.id },
      update: { customerReplied: responded, responseTimeHours, responseLength: customerReply?.body?.length || 0, effectivenessScore, evaluatedAt: new Date() },
      create: { sentMessageId: sentMsg.id, contactId: contacts[0].id, sampleId: relatedSample?.id || null, sentContent: sentMsg.body || "", sentAt: sentMsg.timestamp, customerReplied: responded, responseTimeHours, responseLength: customerReply?.body?.length || 0, effectivenessScore, evaluatedAt: new Date() },
    });

    if (relatedSample && effectivenessScore !== null) {
      const existingScore = relatedSample.qualityScore || 50;
      const newScore = Math.round((existingScore * 0.7 + effectivenessScore * 0.3) * 10) / 10;
      await prisma.messageSample.update({ where: { id: relatedSample.id }, data: { qualityScore: newScore } });
    }

    return { success: true, sentMessageId: sentMsg.id, responded, responseTimeHours, responseLength: customerReply?.body?.length || 0, effectivenessScore, hoursSinceSent: Math.round(hoursSinceSent * 10) / 10 };
  } catch (err) {
    console.error("[EffectTracking] track error:", err.message);
    return { error: err.message };
  }
}

async function computeCustomerStats(contactJid) {
  if (!contactJid) return { error: "contactJid required" };
  const variants = normalizeJid(contactJid);
  const contacts = await prisma.contact.findMany({ where: { jid: { in: variants } } });
  if (!contacts || contacts.length === 0) return { error: "contact not found" };
  const contactJids = contacts.map(c => c.jid);

  const sentMsgs = await prisma.wAMessage.findMany({
    where: { direction: "outbound", to: { in: contactJids } },
    orderBy: { timestamp: "desc" },
  });

  const totalSent = sentMsgs.length;
  const inboundCount = await prisma.wAMessage.count({ where: { direction: "inbound", from: { in: contactJids } } });

  if (totalSent === 0) {
    return {
      success: true, totalMessages: inboundCount, totalSent: 0, messagesWithReply: 0,
      replyRate: 0, avgResponseTimeMs: null, avgEffectivenessScore: null, avgAttitudeScore: null,
      stats: null, recentRecords: [],
    };
  }

  let messagesWithReply = 0, totalResponseTimeMs = 0, responseTimeCount = 0, totalScore = 0, scoreCount = 0;

  for (const sent of sentMsgs) {
    const reply = await prisma.wAMessage.findFirst({
      where: { direction: "inbound", from: { in: contactJids }, timestamp: { gt: sent.timestamp } },
      orderBy: { timestamp: "asc" },
    });
    if (reply) {
      messagesWithReply++;
      const rtMs = new Date(reply.timestamp) - new Date(sent.timestamp);
      if (rtMs > 0) { totalResponseTimeMs += rtMs; responseTimeCount++; }
      const rtHours = rtMs / (1000 * 60 * 60);
      let score = 0;
      if (rtHours < 1) score = 90;
      else if (rtHours < 4) score = 80;
      else if (rtHours < 12) score = 70;
      else if (rtHours < 24) score = 60;
      else if (rtHours < 48) score = 40;
      else score = 20;
      if (reply.body && reply.body.length > 100) score = Math.min(100, score + 10);
      totalScore += score;
      scoreCount++;
    }
  }

  const replyRate = totalSent > 0 ? messagesWithReply / totalSent : 0;
  const avgResponseTimeMs = responseTimeCount > 0 ? totalResponseTimeMs / responseTimeCount : null;
  const avgEffectivenessScore = scoreCount > 0 ? totalScore / scoreCount : null;

  return {
    success: true, totalMessages: totalSent + inboundCount, totalSent, messagesWithReply,
    replyRate, avgResponseTimeMs, avgEffectivenessScore, avgAttitudeScore: null,
    stats: {
      responseRate: Math.round(replyRate * 100),
      avgEffectivenessScore: avgEffectivenessScore ? Math.round(avgEffectivenessScore * 10) / 10 : null,
      avgResponseTimeHours: avgResponseTimeMs ? Math.round((avgResponseTimeMs / (1000 * 60 * 60)) * 10) / 10 : null,
    },
    recentRecords: sentMsgs.slice(0, 10).map(r => ({
      sentAt: r.timestamp, sentContent: (r.body || "").substring(0, 80), customerReplied: false, effectivenessScore: null,
    })),
  };
}

router.post("/track", async (req, res) => {
  try {
    const { contactJid, sentMessageId, sentAt } = req.body;
    if (!contactJid) return res.status(400).json({ error: "contactJid required" });
    const result = await trackEffectiveness(contactJid, sentMessageId, sentAt);
    if (result.error) return res.status(400).json({ error: result.error });
    res.json(result);
  } catch (err) {
    console.error("[EffectTracking] POST track error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get("/customer/:jid", async (req, res) => {
  try {
    const jid = decodeJid(req.params.jid);
    if (!jid) return res.status(400).json({ error: "jid required" });
    const result = await computeCustomerStats(jid);
    if (result.error) return res.status(404).json({ error: result.error });
    res.json(result);
  } catch (err) {
    console.error("[EffectTracking] GET customer error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get("/overall", async (req, res) => {
  try {
    const totalSent = await prisma.wAMessage.count({ where: { direction: "outbound" } });
    const totalInbound = await prisma.wAMessage.count({ where: { direction: "inbound" } });
    res.json({ success: true, totalMessages: totalSent + totalInbound, totalSent, stats: null });
  } catch (err) {
    console.error("[EffectTracking] GET overall error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post("/batch-evaluate", async (req, res) => {
  try {
    const contacts = await prisma.contact.findMany({});
    const evaluatedIds = (await prisma.speechEffectiveness.findMany({ select: { sentMessageId: true } })).map(r => r.sentMessageId);
    const results = [];
    for (const contact of contacts) {
      const variants = normalizeJid(contact.jid);
      const sentMsgs = await prisma.wAMessage.findMany({
        where: { direction: "outbound", to: { in: variants }, id: { notIn: evaluatedIds } },
        orderBy: { timestamp: "desc" }, take: 20,
      });
      for (const msg of sentMsgs) {
        const result = await trackEffectiveness(contact.jid, msg.id, msg.timestamp);
        if (!result.error) results.push(result);
      }
    }
    res.json({ success: true, evaluated: results.length, results });
  } catch (err) {
    console.error("[EffectTracking] batch evaluate error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
