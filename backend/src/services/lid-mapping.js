import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MAP_FILE = path.join(__dirname, "../../data/lid-mapping.json");

let mapping = {}; // { "8613910308625@s.whatsapp.net": "264304418922509@lid" }

function load() {
  try {
    if (fs.existsSync(MAP_FILE)) {
      mapping = JSON.parse(fs.readFileSync(MAP_FILE, "utf8"));
    }
  } catch (e) {
    console.warn("[LIDMap] load error:", e.message);
    mapping = {};
  }
}

function save() {
  try {
    const dir = path.dirname(MAP_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(MAP_FILE, JSON.stringify(mapping, null, 2));
  } catch (e) {
    console.warn("[LIDMap] save error:", e.message);
  }
}

/**
 * 记录映射：phoneJid ↔ lidJid
 * @param {string} phoneJid 如 8613910308625@s.whatsapp.net
 * @param {string} lidJid 如 264304418922509@lid
 */
export function recordLidMapping(phoneJid, lidJid) {
  if (!phoneJid || !lidJid) return;
  if (!phoneJid.includes("@s.whatsapp.net")) return;
  if (!lidJid.includes("@lid")) return;
  load();
  if (mapping[phoneJid] !== lidJid) {
    mapping[phoneJid] = lidJid;
    // 反向索引
    mapping[lidJid] = phoneJid;
    save();
    console.log(`[LIDMap] mapped ${phoneJid} <-> ${lidJid}`);
  }
}

/**
 * 把任意JID解析成"对外使用的JID"（手机号JID，用于会话主键/落库）
 * - @lid → 查映射返回手机号JID；没映射则返回原JID
 * - 手机号JID → 直接返回
 * - @g.us, @broadcast → 直接返回
 */
export function resolveToPhoneJid(jid) {
  if (!jid) return jid;
  if (jid.includes("@s.whatsapp.net")) return jid;
  if (jid.includes("@lid")) {
    load();
    // 去掉device后缀如 :3@lid
    const baseLid = jid.split(":")[0] + "@lid";
    return mapping[baseLid] || mapping[jid] || jid;
  }
  return jid;
}

/**
 * 发消息时：把手机号JID转换成要发送的目标JID（优先LID）
 * 如果有已知LID映射，返回LID（不带device后缀）；否则返回原JID
 */
export function resolveSendTarget(phoneJid) {
  if (!phoneJid) return phoneJid;
  if (!phoneJid.includes("@s.whatsapp.net")) return phoneJid;
  load();
  return mapping[phoneJid] || phoneJid;
}

/**
 * 获取纯数字号码（给Evolution sendText接口用）
 * 如果是@lid，返回lid部分数字；如果是手机号JID，返回手机号
 */
export function jidToSendNumber(jid) {
  if (!jid) return "";
  const resolved = resolveSendTarget(jid);
  return resolved.split("@")[0].replace(/\D/g, "");
}

load();
