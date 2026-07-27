import express from "express";
import { PrismaClient } from "@prisma/client";
import { authMiddleware } from "../middleware/auth.js";

const router = express.Router();
const prisma = new PrismaClient();

// 获取所有追踪话题
router.get("/", authMiddleware, async (req, res) => {
  try {
    const subs = await prisma.topicSubscription.findMany({
      where: { userId: req.userId },
      include: {
        briefings: {
          take: 1,
          orderBy: { createdAt: "desc" }
        }
      },
      orderBy: { updatedAt: "desc" }
    });
    res.json(subs.map(s => ({
      id: s.id,
      topic: s.topic,
      description: s.description,
      keywords: s.keywords ? JSON.parse(s.keywords) : [],
      focusAreas: s.focusAreas ? JSON.parse(s.focusAreas) : [],
      frequency: s.frequency,
      active: s.active,
      lastRunAt: s.lastRunAt,
      createdAt: s.createdAt,
      latestBriefing: s.briefings[0] ? {
        summary: s.briefings[0].summary,
        createdAt: s.briefings[0].createdAt
      } : null
    })));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 创建/更新追踪话题
router.post("/subscribe", authMiddleware, async (req, res) => {
  try {
    const { topic, description, keywords, focusAreas, frequency } = req.body;
    if (!topic) return res.status(400).json({ error: "topic is required" });
    
    const sub = await prisma.topicSubscription.upsert({
      where: { userId_topic: { userId: req.userId, topic } },
      update: {
        description: description || undefined,
        keywords: keywords ? JSON.stringify(keywords) : undefined,
        focusAreas: focusAreas ? JSON.stringify(focusAreas) : undefined,
        frequency: frequency || "daily",
        active: true
      },
      create: {
        userId: req.userId,
        topic,
        description: description || "",
        keywords: JSON.stringify(keywords || []),
        focusAreas: JSON.stringify(focusAreas || []),
        frequency: frequency || "daily"
      }
    });
    res.json({ success: true, id: sub.id, topic: sub.topic });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 删除追踪
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    await prisma.topicSubscription.delete({
      where: { id: parseInt(req.params.id), userId: req.userId }
    });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 保存简报结果
router.post("/:id/briefing", authMiddleware, async (req, res) => {
  try {
    const sub = await prisma.topicSubscription.findFirst({
      where: { id: parseInt(req.params.id), userId: req.userId }
    });
    if (!sub) return res.status(404).json({ error: "not found" });
    
    const { content, summary } = req.body;
    const briefing = await prisma.topicBriefing.create({
      data: {
        subscriptionId: sub.id,
        content: typeof content === "string" ? content : JSON.stringify(content),
        summary: summary || ""
      }
    });
    
    await prisma.topicSubscription.update({
      where: { id: sub.id },
      data: { lastRunAt: new Date() }
    });
    
    res.json({ success: true, briefingId: briefing.id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 获取某话题的简报历史
router.get("/:id/briefings", authMiddleware, async (req, res) => {
  try {
    const sub = await prisma.topicSubscription.findFirst({
      where: { id: parseInt(req.params.id), userId: req.userId }
    });
    if (!sub) return res.status(404).json({ error: "not found" });
    
    const briefings = await prisma.topicBriefing.findMany({
      where: { subscriptionId: sub.id },
      orderBy: { createdAt: "desc" },
      take: 10
    });
    res.json(briefings);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
