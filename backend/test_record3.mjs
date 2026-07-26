import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const outboundMsg = await prisma.wAMessage.findUnique({ where: { id: 3664 } });

// Simulate collector logic
const BRACKET_RE = /^\s*\[[^\]]+\]\s*$/;
const FILENAME_RE = /\.[A-Za-z0-9]{1,8}$/;
const MEDIA_TYPES = new Set(['image', 'video', 'audio', 'document', 'sticker']);

function hasCollectibleText(msg) {
  const body = String(msg.body || '').trim();
  if (!body) return false;
  if (BRACKET_RE.test(body)) return false;
  const type = String(msg.type || 'text').toLowerCase();
  if (type === 'text') return true;
  if (MEDIA_TYPES.has(type)) {
    if (FILENAME_RE.test(body) && body.length < 200) {
      const hasSentence = /[。！？.!?？,，:：;；]/.test(body) || /[\u4e00-\u9fff]/.test(body);
      if (!hasSentence) return false;
    }
    return body.length >= 2;
  }
  return true;
}

function parseTranslation(transField) {
  if (!transField) return null;
  try {
    const obj = typeof transField === 'string' ? JSON.parse(transField) : transField;
    if (!obj || typeof obj !== 'object') return null;
    return {
      original: typeof obj.original === 'string' ? obj.original : null,
      translated: typeof obj.translated === 'string' ? obj.translated : null,
      sourceLang: typeof obj.sourceLang === 'string' ? obj.sourceLang : null,
      targetLang: typeof obj.targetLang === 'string' ? obj.targetLang : null,
    };
  } catch { return null; }
}

const outboundTrans = parseTranslation(outboundMsg.translation);
console.log('outboundTrans:', outboundTrans);
let salesReply = String(outboundMsg.body || '').trim();
let salesReplyTranslated = null;
let salesReplyLang = outboundMsg.sourceLang || null;
console.log('before branch - salesReply:', salesReply, 'lang init:', salesReplyLang);
if (outboundTrans) {
  console.log('branch if: translated=!!', !!outboundTrans.translated, 'original=!!', !!outboundTrans.original, 'neq=', outboundTrans.translated !== outboundTrans.original);
  if (outboundTrans.translated && outboundTrans.original && outboundTrans.translated !== outboundTrans.original) {
    console.log('ENTERED translated branch');
    salesReply = outboundTrans.translated;
    salesReplyTranslated = outboundTrans.original;
    salesReplyLang = outboundTrans.targetLang || outboundTrans.sourceLang || null;
  } else {
    console.log('ENTERED else branch');
    salesReplyTranslated = null;
    salesReplyLang = outboundTrans.sourceLang || null;
  }
}
console.log('final salesReply:', salesReply);
console.log('final salesReplyTranslated:', salesReplyTranslated);
console.log('final salesReplyLang:', salesReplyLang);
await prisma.$disconnect();
