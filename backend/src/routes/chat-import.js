import { Router } from "express";
import multer from "multer";
import crypto from "crypto";
import { PrismaClient } from "@prisma/client";

const router = Router();
const prisma = new PrismaClient();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// 清洗不可见字符(U+200E等)与回车符，避免影响正则匹配
function cleanText(s) {
  return String(s)
    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g, "")
    .replace(/\r/g, "")
    .trim();
}

// 健壮日期解析：支持
//   M/D/YY hh:mm:ss          (9/28/25 09:50:52)
//   M/D/YYYY h:mm AM/PM      (1/15/24, 2:30 PM - Sender: Msg)
//   D/M/YYYY, hh:mm          (15/01/2024, 14:30 - Sender: Msg)
function parseDate(raw) {
  const s = String(raw).trim().replace(/,/g, " ");
  let m = s.match(/^(\d{4}|\d{1,2})\/(\d{1,2})\/(\d{2,4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*(AM|PM))?$/i);
  if (!m) return null;
  let [, p1, p2, p3, hh, mm, ss, ap] = m;
  let year, month, day;
  if (p1.length === 4 && parseInt(p1) >= 1000) {
    // YYYY/M/D（年份在前，如 2026/7/14）
    year = parseInt(p1); month = parseInt(p2); day = parseInt(p3);
  } else {
    // M/D/YY 或 M/D/YYYY
    year = p3.length === 2 ? (parseInt(p3) > 50 ? 1900 + parseInt(p3) : 2000 + parseInt(p3)) : parseInt(p3);
    month = parseInt(p1); day = parseInt(p2);
  }
  let hour = parseInt(hh);
  if (ap) {
    if (ap.toUpperCase() === "PM" && hour < 12) hour += 12;
    if (ap.toUpperCase() === "AM" && hour === 12) hour = 0;
  }
  const dt = new Date(year, month - 1, day, hour, parseInt(mm), ss ? parseInt(ss) : 0);
  return isNaN(dt.getTime()) ? null : dt;
}

// 解析WhatsApp导出的txt
function parseWhatsAppTxt(text) {
  const lines = cleanText(text).split("\n");
  const messages = [];

  const patterns = [
    // [2024/1/15 14:30:22] Sender: Message
    /^\[((?:\d{4}|\d{1,2})\/\d{1,2}\/\d{2,4}\s+\d{1,2}:\d{2}(?::\d{2})?(?:\s*(?:AM|PM))?)\]\s*([^:]+):\s*(.*)$/i,
    // 1/15/24, 2:30 PM - Sender: Message
    /^((?:\d{4}|\d{1,2})\/\d{1,2}\/\d{2,4},?\s+\d{1,2}:\d{2}(?::\d{2})?(?:\s*(?:AM|PM))?)\s*-\s*([^:]+):\s*(.*)$/i,
    // 15/01/2024, 14:30 - Sender: Message
    /^(\d{1,2}\/\d{1,2}\/\d{2,4},?\s+\d{1,2}:\d{2})\s*-\s*([^:]+):\s*(.*)$/,
  ];

  let currentMsg = null;
  for (const line of lines) {
    let matched = false;
    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match) {
        if (currentMsg) messages.push(currentMsg);
        currentMsg = {
          timestamp: match[1],
          sender: cleanText(match[2]),
          body: cleanText(match[3]),
        };
        matched = true;
        break;
      }
    }
    if (!matched && currentMsg) {
      // 多行消息 / 系统提示行(图像已忽略/文档已省略) 追加到当前消息
      currentMsg.body += "\n" + cleanText(line);
    }
  }
  if (currentMsg) messages.push(currentMsg);

  // 过滤掉纯系统提示类消息
  return messages.filter((m) => {
    if (m.sender === "图像已忽略" || m.sender === "文档已省略" || m.sender === "<attached>") return false;
    return true;
  });
}

// 规范化手机号为完整 jid
function toJid(phone) {
  let p = String(phone).replace(/[^0-9]/g, "");
  if (p.startsWith("0")) p = p.replace(/^0+/, "");
  if (!p.endsWith("@s.whatsapp.net")) p = p + "@s.whatsapp.net";
  return p.toLowerCase();
}

router.post("/", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "请上传文件" });
    const { contactPhone } = req.body;
    if (!contactPhone) return res.status(400).json({ error: "缺少客户手机号" });

    const text = req.file.buffer.toString("utf-8");
    const messages = parseWhatsAppTxt(text);
    if (messages.length === 0) {
      return res.json({ success: true, count: 0, error: "未解析到有效消息" });
    }

    // 校验客户手机号有效（防止 undefined/null 等脏值传入）
    if (!contactPhone || typeof contactPhone !== "string" || /undefined|^null$|^NaN$/i.test(contactPhone)) {
      return res.status(400).json({ error: "客户手机号无效" });
    }
    // sessionId 动态映射，与 /api/whatsapp/messages 保持一致：
    // 该 userId 名下 whatsapp 账号按 id 升序 → user_1, user_2, ...
    const waAccts = await prisma.whatsAppAccount.findMany({
      where: { userId: req.userId, platform: "whatsapp" },
      orderBy: { id: "asc" },
      select: { id: true, phone: true, name: true },
    });
    if (waAccts.length === 0) {
      return res.status(400).json({ error: "当前用户未绑定 WhatsApp 账号" });
    }
    // 查找客户：必须限定在当前用户账号下（accountId），避免匹配到其他租户/历史幽灵同号记录
    const waAcctIds = waAccts.map((a) => a.id);
    const normalizedPhone = String(contactPhone).replace(/[^0-9]/g, "");
    const contact = await prisma.contact.findFirst({
      where: {
        OR: [
          { phone: contactPhone },
          { phone: normalizedPhone },
          { phone: { contains: normalizedPhone.slice(-11) } },
        ],
        platform: "whatsapp",
        accountId: { in: waAcctIds },
      },
      orderBy: { id: "desc" },
    });
    if (!contact) {
      return res.status(404).json({ error: "未找到该客户" });
    }
    const acctToSession = {};
    waAccts.forEach((a) => { acctToSession[a.id] = `user_${a.id}`; });
    // 优先选择与客户账号关联的账号；否则取第一个账号
    let waAcc = waAccts.find((a) => a.id === contact.accountId) || waAccts[0];
    const sessionId = acctToSession[waAcc.id];

    // 我方 jid = 该账号手机号；客户 jid = 客户手机号
    const myJid = toJid(waAcc.phone || waAccts[0].phone || contactPhone);
    const contactJid = toJid(contact.phone || contactPhone);
    const contactNames = [contact.name, contact.pushName, "Jeremy"].filter(Boolean);
    const contactJidNorm = (contact.phone || contactPhone).replace(/[^0-9]/g, "");

    const importResult = [];
    for (const msg of messages) {
      const ts = parseDate(msg.timestamp) || new Date();
      const senderNorm = msg.sender.toLowerCase();
      const senderDigits = msg.sender.replace(/[^0-9]/g, "");
      const isFromCustomer = contactNames.some(
        (n) => n && senderNorm.includes(String(n).toLowerCase())
      ) || (senderDigits.length > 6 && (contactJidNorm.includes(senderDigits.slice(-9)) || senderDigits.includes(contactJidNorm.slice(-9))));
      const direction = isFromCustomer ? "inbound" : "outbound";
      const from = direction === "inbound" ? contactJid : myJid;
      const to = direction === "inbound" ? myJid : contactJid;
      // 稳定 hash 作为 waMessageId，实现重复导入幂等(unique 冲突自动跳过)
      const hash = crypto.createHash("md5")
        .update(`${contactJid}|${ts.toISOString()}|${direction}|${msg.body}`)
        .digest("hex").slice(0, 20);

      try {
        const saved = await prisma.wAMessage.create({
          data: {
            sessionId,
            from,
            to,
            body: msg.body,
            type: "text",
            direction,
            timestamp: ts,
            waMessageId: `import_${hash}`,
            isAuto: false,
          },
        });
        importResult.push(saved);
      } catch (msgErr) {
        // unique 冲突(重复导入)或单条失败，不影响其他
        if (!msgErr.message.includes("Unique")) {
          console.warn("[ChatImport] single failed:", msgErr.message);
        }
      }
    }

    console.log(`[ChatImport] sessionId=${sessionId} contact=${contact.id} imported ${importResult.length}/${messages.length}`);
    res.json({ success: true, count: importResult.length, total: messages.length, skipped: messages.length - importResult.length, sessionId, contactId: contact.id });
  } catch (err) {
    console.error("[ChatImport Error]", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
