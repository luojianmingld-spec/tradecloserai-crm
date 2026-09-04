import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const { translateText, detectLanguage } = await import("./src/services/ai.service.js");

const targets = await prisma.wAMessage.findMany({
  where: { sessionId: { startsWith: "tg_" }, type: "text", translation: null },
  orderBy: { id: "asc" },
  take: 60,
});
console.log("[FixTG] candidates:", targets.length);
let ok = 0, skip = 0, fail = 0;
for (const m of targets) {
  try {
    const body = (m.body || "").trim();
    if (!body || (body.startsWith("[") && body.endsWith("]"))) { skip++; continue; }
    let srcLang = "auto";
    try { srcLang = await detectLanguage(body, "deepl"); } catch (_) {}
    if (!srcLang || srcLang === "unknown" || srcLang === "zh" || srcLang.startsWith("zh-")) { skip++; continue; }
    const result = await translateText(body, srcLang, "zh", "deepl", 1);
    const tr = (result && (result.translated || result.text)) || "";
    if (!tr) { skip++; continue; }
    const isOut = m.direction === "outbound" || m.direction === "outgoing";
    // 与 server.js 发送路径一致：出站 original=中文/translated=英文；入站 original=外文/translated=中文
    const obj = isOut
      ? { original: tr, translated: body, sourceLang: srcLang, targetLang: "zh" }
      : { original: body, translated: tr, sourceLang: srcLang, targetLang: "zh" };
    await prisma.wAMessage.update({ where: { id: m.id }, data: { translation: JSON.stringify(obj), sourceLang: srcLang } });
    console.log(`[FixTG] #${m.id} ${m.direction} ${srcLang}->zh: "${body.slice(0,40)}" => "${tr.slice(0,40)}"`);
    ok++;
    await new Promise(r => setTimeout(r, 250));
  } catch (e) { console.warn(`[FixTG] #${m.id} error:`, e.message); fail++; }
}
console.log(`[FixTG] done ok=${ok} skip=${skip} fail=${fail}`);
await prisma.$disconnect();
