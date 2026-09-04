// 一次性补译 user_87 中缺翻译的文本消息（导入历史 + 真实消息）
// 复用后端 ai.service translateText（DeepL 优先，失败回落 LLM）+ getTranslationSettings（按客户/全局设置）
import { PrismaClient } from "@prisma/client";
import { translateText, detectLanguage } from "../src/services/ai.service.js";
import { getTranslationSettings } from "../src/routes/translation.js";

const prisma = new PrismaClient();
const USER_ID = 45;
const SESSION = "user_87";

async function main() {
  const msgs = await prisma.wAMessage.findMany({
    where: { sessionId: SESSION, translation: null, type: "text" },
    orderBy: { id: "asc" },
  });
  console.log(`[BackfillTranslate] ${msgs.length} untranslated text msgs in ${SESSION}`);

  let ok = 0, skip = 0, err = 0;
  for (const msg of msgs) {
    const body = (msg.body || "").trim();
    if (!body || (body.startsWith("[") && body.endsWith("]"))) { skip++; continue; }
    if (/[\u4e00-\u9fff]/.test(body)) { skip++; continue; } // already Chinese

    try {
      const convJid = msg.direction === "outbound" ? msg.to : msg.from;
      const ts = await getTranslationSettings(convJid, USER_ID);
      let engine, sourceLang, targetLang;
      if (msg.direction === "inbound") {
        engine = ts.receiveEngine || "deepl";
        sourceLang = ts.receiveSourceLang || "auto";
        targetLang = ts.receiveTargetLang || "zh";
      } else {
        engine = ts.sendEngine || ts.receiveEngine || "deepl";
        sourceLang = ts.sendSourceLang || "auto";
        targetLang = ts.sendTargetLang || "en";
      }
      if (sourceLang === "auto" || !sourceLang) {
        try { sourceLang = await detectLanguage(body, engine); } catch (_) { sourceLang = "auto"; }
      }
      if (!sourceLang || sourceLang === "unknown" || sourceLang === "zh" || String(sourceLang).startsWith("zh-")) { skip++; continue; }
      const src = String(sourceLang);
      const tgt = String(targetLang);
      if (src === tgt || src.startsWith(tgt) || tgt.startsWith(src)) { skip++; continue; }

      const result = await translateText(body, sourceLang, targetLang, engine, USER_ID);
      const translatedText = (result && (result.translated || result.text)) || "";
      if (!translatedText || translatedText === body) { skip++; continue; }

      await prisma.wAMessage.update({
        where: { id: msg.id },
        data: {
          translation: JSON.stringify({ original: body, translated: translatedText, sourceLang, targetLang }),
          sourceLang,
        },
      });
      ok++;
      if (ok <= 30) console.log(`[OK] #${msg.id} ${msg.direction}: ${body.slice(0, 50)} -> ${translatedText.slice(0, 50)}`);
      await new Promise((r) => setTimeout(r, 200));
    } catch (e) {
      err++;
      console.warn(`[ERR] #${msg.id}: ${e.message}`);
    }
  }
  console.log(`\n[BackfillTranslate] Done ok=${ok} skip=${skip} err=${err}`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
