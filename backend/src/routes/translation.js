/**
 * Translation API Routes
 *
 * POST /api/translation/translate          — 翻译文本
 * POST /api/translation/translate-outgoing — 翻译发送消息
 * POST /api/translation/detect-language    — 检测语言
 * GET  /api/translation/engines            — 返回可用翻译引擎列表
 * GET  /api/translation/settings           — 获取翻译设置（含默认值）
 * PUT  /api/translation/settings           — 保存翻译设置
 * POST /api/translation/settings           — 兼容别名
 */
import { Router } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { authMiddleware as auth } from "../middleware/auth.js";
import { translateText, translateOutgoing, detectLanguage } from "../services/ai.service.js";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const router = Router();

// ─── Settings persistence (JSON file, single-tenant) ───
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, "../../data");
const SETTINGS_FILE = path.join(DATA_DIR, "translation-settings.json");

// Defaults for NEW users / reset state.  Existing persisted settings keep their values.
export const DEFAULT_TRANSLATION_SETTINGS = {
  receiveEnabled: true,
  receiveEngine: "deepl",
  receiveSourceLang: "auto",
  receiveTargetLang: "zh",
  sendEnabled: true,
  sendEngine: "deepl",
  sendSourceLang: "auto",
  sendTargetLang: "en",
  groupAutoTranslate: false,
  blockChinese: true,
  translateConfirm: false,
  translationColor: "#8696a0",
  translationSize: "14px",
};

export const TRANSLATION_ENGINES = [
  { value: "deepl", label: "DeepL(推荐)" },
  { value: "deepseek", label: "DeepSeek" },
  { value: "doubao", label: "豆包AI" },
  { value: "openai", label: "GPT-4o-mini" },
];

function ensureDataDir() {
  try { if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (_) {}
}

export function readTranslationSettings() {
  ensureDataDir();
  try {
    if (!fs.existsSync(SETTINGS_FILE)) {
      fs.writeFileSync(SETTINGS_FILE, JSON.stringify(DEFAULT_TRANSLATION_SETTINGS, null, 2), "utf8");
      return { ...DEFAULT_TRANSLATION_SETTINGS };
    }
    const raw = fs.readFileSync(SETTINGS_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_TRANSLATION_SETTINGS, ...parsed };
  } catch (e) {
    console.warn("[Translation Settings] read error, using defaults:", e.message);
    return { ...DEFAULT_TRANSLATION_SETTINGS };
  }
}

export function writeTranslationSettings(settings) {
  ensureDataDir();
  const merged = { ...DEFAULT_TRANSLATION_SETTINGS, ...settings };
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(merged, null, 2), "utf8");
  return merged;
}


// ─── Per-customer translation settings ───
// Merge order: customer-specific > global defaults.
// If customer has no translationSettings JSON, returns global settings.
// Returns a complete settings object with all fields populated.
export async function getTranslationSettings(jid, userId) {
  const globalSettings = readTranslationSettings();
  if (!jid) return globalSettings;
  try {
    const where = { userId: userId || 1 };
    // Try matching by jid first, then by phone
    if (jid.includes("@")) {
      where.jid = jid;
    } else {
      where.phone = jid;
    }
    let customer = await prisma.customer.findFirst({ where });
    // fallback: try by phone number extracted from jid
    if (!customer && jid.includes("@")) {
      const phone = jid.split("@")[0];
      customer = await prisma.customer.findFirst({ where: { userId: userId || 1, phone } });
    }
    if (!customer?.translationSettings) return globalSettings;
    let perCustomer = {};
    try { perCustomer = JSON.parse(customer.translationSettings); } catch (_) { perCustomer = {}; }
    // Field name mapping: UI uses simple names (translationEnabled, targetLanguage)
    // map to internal names
    const merged = { ...globalSettings };
    // Receive settings
    if (perCustomer.receiveEnabled !== undefined) merged.receiveEnabled = perCustomer.receiveEnabled;
    if (perCustomer.translationEnabled !== undefined) merged.receiveEnabled = perCustomer.translationEnabled;
    if (perCustomer.receiveEngine) merged.receiveEngine = perCustomer.receiveEngine;
    if (perCustomer.translationEngine) merged.receiveEngine = perCustomer.translationEngine;
    if (perCustomer.receiveSourceLang) merged.receiveSourceLang = perCustomer.receiveSourceLang;
    if (perCustomer.receiveTargetLang) merged.receiveTargetLang = perCustomer.receiveTargetLang;
    if (perCustomer.targetLanguage) merged.receiveTargetLang = perCustomer.targetLanguage;
    // Send settings (per-customer engine overrides global)
    if (perCustomer.sendEnabled !== undefined) merged.sendEnabled = perCustomer.sendEnabled;
    if (perCustomer.sendEngine) merged.sendEngine = perCustomer.sendEngine;
    // If customer set receiveEngine, also use it for send if sendEngine not explicitly set
    if (!perCustomer.sendEngine && perCustomer.receiveEngine) merged.sendEngine = perCustomer.receiveEngine;
    if (!perCustomer.sendEngine && perCustomer.translationEngine) merged.sendEngine = perCustomer.translationEngine;
    if (perCustomer.sendSourceLang) merged.sendSourceLang = perCustomer.sendSourceLang;
    if (perCustomer.sendTargetLang) {
      merged.sendTargetLang = perCustomer.sendTargetLang;
    } else if (perCustomer.sendTargetLanguage) {
      merged.sendTargetLang = perCustomer.sendTargetLanguage;
    }
    // UI fields
    if (perCustomer.groupAutoTranslate !== undefined) merged.groupAutoTranslate = perCustomer.groupAutoTranslate;
    if (perCustomer.blockChinese !== undefined) merged.blockChinese = perCustomer.blockChinese;
    if (perCustomer.translateConfirm !== undefined) merged.translateConfirm = perCustomer.translateConfirm;
    if (perCustomer.translationColor) merged.translationColor = perCustomer.translationColor;
    if (perCustomer.translationSize) merged.translationSize = perCustomer.translationSize;
    // Preserve UI-readable fields too
    merged.translationEnabled = merged.receiveEnabled;
    merged.translationEngine = merged.receiveEngine;
    merged.targetLanguage = merged.receiveTargetLang;
    return merged;
  } catch (e) {
    console.warn("[Translation] per-customer read error, using global:", e.message);
    return globalSettings;
  }
}

export async function saveCustomerTranslationSettings(jid, userId, patch) {
  if (!jid) throw new Error("jid required");
  // 拦截无效 jid（前端可能把 undefined 当字符串传入，产生 undefined@s.whatsapp.net 脏数据）
  if (/^(undefined|null|NaN)$/i.test(String(jid).split("@")[0] || "")) throw new Error("无效的客户标识");
  const where = { userId: userId || 1 };
  if (jid.includes("@")) {
    where.jid = jid;
  } else {
    where.phone = jid;
  }
  let customer = await prisma.customer.findFirst({ where });
  if (!customer && jid.includes("@")) {
    const phone = jid.split("@")[0];
    customer = await prisma.customer.findFirst({ where: { userId: userId || 1, phone } });
  }
  if (!customer) {
    // auto-create customer stub
    const phone = jid.includes("@") ? jid.split("@")[0] : jid;
    customer = await prisma.customer.create({
      data: { userId: userId || 1, jid: jid.includes("@") ? jid : null, phone, name: phone, source: "whatsapp", status: "potential" },
    });
  }
  // Handle reset: clear per-customer settings (fall back to global)
  if (patch && (patch._reset === true || patch._reset === "true")) {
    await prisma.customer.update({
      where: { id: customer.id },
      data: { translationSettings: null },
    });
    return { _reset: true };
  }
  // Merge with existing per-customer JSON
  let existing = {};
  try { existing = customer.translationSettings ? JSON.parse(customer.translationSettings) : {}; } catch (_) { existing = {}; }
  // Normalize field names: accept both UI names and internal names
  const updated = { ...existing };
  for (const [k, v] of Object.entries(patch || {})) {
    if (v === undefined || v === null) { delete updated[k]; continue; }
    if (k.startsWith("_")) continue; // skip internal flags
    updated[k] = v;
    // Also map UI names to internal
    if (k === "translationEnabled") { updated.receiveEnabled = v; }
    if (k === "translationEngine") { updated.receiveEngine = v; }
    if (k === "targetLanguage") { updated.receiveTargetLang = v; }
    if (k === "receiveTargetLang") { updated.targetLanguage = v; }
    if (k === "sendTargetLang") { updated.sendTargetLanguage = v; }
    if (k === "sendTargetLanguage") { updated.sendTargetLang = v; }
  }
  await prisma.customer.update({
    where: { id: customer.id },
    data: { translationSettings: JSON.stringify(updated) },
  });
  return { ...updated };
}

// ─── Engines list ───
router.get("/engines", auth, (_req, res) => {
  try {
    res.json({ engines: TRANSLATION_ENGINES });
  } catch (err) {
    console.error("[Translation Engines Error]", err);
    res.status(500).json({ error: "获取引擎列表失败" });
  }
});

// ─── 全球语言目录（200+，前端下拉/搜索用）───
router.get("/languages", auth, async (_req, res) => {
  try {
    const { LANGUAGES } = await import("../data/languages.js");
    res.json({ languages: LANGUAGES });
  } catch (err) {
    console.error("[Translation Languages Error]", err);
    res.status(500).json({ error: "获取语言列表失败" });
  }
});

// ─── Translate text ───
router.post("/translate", auth, async (req, res) => {
  try {
    const { text, from, to, engine } = req.body;
    if (!text) return res.status(400).json({ error: "text is required" });
    const sourceLang = from || "auto";
    const targetLang = to || "zh";
    const result = await translateText(text, sourceLang, targetLang, engine, req.userId);
    res.json(result);
  } catch (err) {
    console.error("[Translation Error]", err);
    res.status(500).json({ error: "翻译失败: " + err.message });
  }
});

router.post("/translate-outgoing", auth, async (req, res) => {
  try {
    const { text, targetLang, engine, sendSourceLang } = req.body;
    if (!text) return res.status(400).json({ error: "text is required" });
    const result = await translateOutgoing(text, targetLang, req.userId, { engine, sendSourceLang });
    if (!result) {
      return res.json({ translated: null, fallback: true, message: "翻译失败，将发送原文" });
    }
    res.json(result);
  } catch (err) {
    console.error("[Translation Outgoing Error]", err);
    res.status(500).json({ error: "翻译失败: " + err.message });
  }
});

router.post("/detect-language", auth, async (req, res) => {
  try {
    const { text, engine } = req.body;
    if (!text) return res.status(400).json({ error: "text is required" });
    const language = await detectLanguage(text, engine);
    res.json({ language });
  } catch (err) {
    console.error("[Detect Language Error]", err);
    res.status(500).json({ error: "语言检测失败: " + err.message });
  }
});

// ─── Settings endpoints ───
router.get("/settings", auth, async (req, res) => {
  try {
    const settings = readTranslationSettings();
    res.json(settings);
  } catch (err) {
    console.error("[Translation Settings GET Error]", err);
    res.status(500).json({ error: "获取翻译设置失败" });
  }
});

router.put("/settings", auth, async (req, res) => {
  try {
    const saved = writeTranslationSettings(req.body || {});
    res.json({ success: true, settings: saved });
  } catch (err) {
    console.error("[Translation Settings PUT Error]", err);
    res.status(500).json({ error: "保存翻译设置失败" });
  }
});

router.post("/settings", auth, async (req, res) => {
  try {
    const saved = writeTranslationSettings(req.body || {});
    res.json({ success: true, settings: saved });
  } catch (err) {
    console.error("[Translation Settings POST Error]", err);
    res.status(500).json({ error: "保存翻译设置失败" });
  }
});


// ─── Per-customer settings endpoints ───
// GET /api/translation/settings/customer/:jid — get merged (global + per-customer) settings
router.get("/settings/customer/:jid", auth, async (req, res) => {
  try {
    const jid = decodeURIComponent(req.params.jid);
    const settings = await getTranslationSettings(jid, req.userId);
    res.json({
      success: true,
      settings: {
        translationEnabled: settings.receiveEnabled,
        translationEngine: settings.receiveEngine,
        targetLanguage: settings.receiveTargetLang,
        receiveEnabled: settings.receiveEnabled,
        receiveEngine: settings.receiveEngine,
        receiveSourceLang: settings.receiveSourceLang,
        receiveTargetLang: settings.receiveTargetLang,
        sendEnabled: settings.sendEnabled,
        sendEngine: settings.sendEngine,
        sendSourceLang: settings.sendSourceLang,
        sendTargetLang: settings.sendTargetLang,
        groupAutoTranslate: settings.groupAutoTranslate,
        blockChinese: settings.blockChinese,
        translateConfirm: settings.translateConfirm,
        translationColor: settings.translationColor,
        translationSize: settings.translationSize,
      },
    });
  } catch (err) {
    console.error("[Translation Customer GET Error]", err);
    res.status(500).json({ error: "获取客户翻译设置失败" });
  }
});

// PUT /api/translation/settings/customer/:jid — save per-customer settings
router.put("/settings/customer/:jid", auth, async (req, res) => {
  try {
    const jid = decodeURIComponent(req.params.jid);
    const saved = await saveCustomerTranslationSettings(jid, req.userId, req.body || {});
    const merged = await getTranslationSettings(jid, req.userId);
    res.json({
      success: true,
      perCustomer: saved,
      settings: {
        translationEnabled: merged.receiveEnabled,
        translationEngine: merged.receiveEngine,
        targetLanguage: merged.receiveTargetLang,
        receiveEnabled: merged.receiveEnabled,
        receiveEngine: merged.receiveEngine,
        receiveSourceLang: merged.receiveSourceLang,
        receiveTargetLang: merged.receiveTargetLang,
        sendEnabled: merged.sendEnabled,
        sendEngine: merged.sendEngine,
        sendSourceLang: merged.sendSourceLang,
        receiveSourceLang: merged.receiveSourceLang,
        sendSourceLang: merged.sendSourceLang,
        sendTargetLang: merged.sendTargetLang,
        sendTargetLanguage: merged.sendTargetLang,
        groupAutoTranslate: merged.groupAutoTranslate,
        blockChinese: merged.blockChinese,
        translateConfirm: merged.translateConfirm,
        translationColor: merged.translationColor,
        translationSize: merged.translationSize,
      },
    });
  } catch (err) {
    console.error("[Translation Customer PUT Error]", err);
    res.status(500).json({ error: "保存客户翻译设置失败: " + err.message });
  }
});

export default router;
