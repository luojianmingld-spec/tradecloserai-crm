#!/usr/bin/env node
/**
 * Backfill translations for existing untranslated inbound messages
 */
import { PrismaClient } from "@prisma/client";
import { detectLanguage, translateText } from "../src/services/ai.service.js";
import { getTranslationSettings } from "../src/routes/translation.js";

const prisma = new PrismaClient();

async function main() {
  console.log("[BackfillTranslation] Starting...");
  const untranslated = await prisma.wAMessage.findMany({
    where: { direction: "inbound", type: "text", translation: null, body: { not: { startsWith: "[" } } },
    orderBy: { id: "desc" },
    take: 200,
  });
  console.log(`[BackfillTranslation] Found ${untranslated.length} untranslated messages`);

  const settings = await getTranslationSettings("default", 1);
  const engine = settings?.receiveEngine || "google";
  const targetLang = settings?.receiveTargetLang || "zh";

  let success = 0, skipped = 0, failed = 0;

  for (const msg of untranslated) {
    const body = (msg.body || "").trim();
    if (body.length < 1 || body.length > 2000) { skipped++; continue; }
    try {
      let sourceLang = await detectLanguage(body, engine);
      if (!sourceLang || sourceLang === "unknown" || sourceLang === "zh" || sourceLang.startsWith("zh-")) { skipped++; continue; }
      const result = await translateText(body, sourceLang, targetLang, engine, 1);
      const translated = (result && (result.translated || result.text)) || "";
      if (!translated) { skipped++; continue; }
      await prisma.wAMessage.update({
        where: { id: msg.id },
        data: { translation: JSON.stringify({ original: body, translated, sourceLang, targetLang }), sourceLang },
      });
      success++;
      console.log(`  [${success}] #${msg.id} ${sourceLang}->zh: "${body.slice(0,40)}" => "${translated.slice(0,40)}"`);
      await new Promise(r => setTimeout(r, 300));
    } catch (e) {
      failed++;
      console.warn(`  [FAIL] #${msg.id}: ${e.message}`);
      await new Promise(r => setTimeout(r, 1500));
    }
  }
  console.log(`[BackfillTranslation] Done: ${success} ok, ${skipped} skip, ${failed} fail`);
  await prisma.$disconnect();
}

main().catch(e => { console.error("[BackfillTranslation] Fatal:", e); process.exit(1); });
