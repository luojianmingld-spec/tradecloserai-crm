import { PrismaClient } from "@prisma/client";
import { detectLanguage, translateText } from "../src/services/ai.service.js";

const prisma = new PrismaClient({
  datasources: { db: { url: "file:/opt/whatsapp-crm/backend/prisma/crm.db" } }
});

async function main() {
  const todayStart = new Date("2026-07-28T16:00:00Z");
  const msgs = await prisma.wAMessage.findMany({
    where: {
      sessionId: "user_1",
      direction: "inbound",
      translation: null,
      body: { not: "" },
      type: "text",
      timestamp: { gt: todayStart }
    }
  });
  
  console.log("Found " + msgs.length + " messages to translate");
  
  for (const msg of msgs) {
    const body = msg.body.trim();
    if (!body) continue;
    if (/^[\p{Emoji}\s]+$/u.test(body)) {
      console.log("Skipping emoji: " + body);
      continue;
    }
    
    try {
      const sourceLang = await detectLanguage(body, "google");
      console.log("[" + msg.id + "] \"" + body + "\" -> " + sourceLang);
      
      if (!sourceLang || sourceLang === "unknown" || sourceLang === "zh" || sourceLang.startsWith("zh-")) continue;
      
      const result = await translateText(body, sourceLang, "zh", "google", 1);
      const transObj = JSON.stringify({ original: body, translated: result.translated, sourceLang, targetLang: "zh" });
      
      await prisma.wAMessage.update({
        where: { id: msg.id },
        data: { translation: transObj, sourceLang }
      });
      console.log("  => " + result.translated);
    } catch (err) {
      console.error("  Error: " + err.message);
    }
  }
  console.log("Done!");
}

main().catch(console.error).finally(() => prisma.$disconnect());
