#!/usr/bin/env node
import { PrismaClient } from "@prisma/client";
import { detectLanguage, translateText } from "../src/services/ai.service.js";
import { getTranslationSettings } from "../src/routes/translation.js";

const prisma = new PrismaClient();
const BATCH = 50;
const DELAY = 250;

async function main() {
  console.log("[Backfill2] Starting full backfill...");
  const settings = await getTranslationSettings("default", 1);
  const engine = settings?.receiveEngine || "google";
  const targetLang = settings?.receiveTargetLang || "zh";

  let offset = 0, success = 0, skipped = 0, failed = 0, batch = 0;

  while (true) {
    const msgs = await prisma.wAMessage.findMany({
      where: { direction: "inbound", type: "text", translation: null, body: { not: { startsWith: "[" } } },
      orderBy: { id: "desc" },
      skip: offset, take: BATCH,
    });
    if (msgs.length === 0) break;
    batch++;
    console.log(`[Backfill2] Batch ${batch}, offset=${offset}, got ${msgs.length} msgs`);

    for (const msg of msgs) {
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
      } catch (e) {
        failed++;
        console.warn(`[Backfill2] FAIL #${msg.id}: ${e.message}`);
        await new Promise(r => setTimeout(r, 2000));
      }
      await new Promise(r => setTimeout(r, DELAY));
    }
    // Don't advance offset - since we update records, next query will skip them
    if (batch % 10 === 0) console.log(`[Backfill2] Progress: ${success} ok, ${skipped} skip, ${failed} fail`);
  }
  console.log(`[Backfill2] DONE: ${success} ok, ${skipped} skip, ${failed} fail`);
  await prisma.$disconnect();
}

main().catch(e => { console.error("[Backfill2] Fatal:", e); process.exit(1); });
