
import crypto from 'crypto';

// AES-256-GCM 加密/解密工具
// 密钥从环境变量或硬编码（后续可迁移到 env）
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 32) {
  console.error('[FATAL] ENCRYPTION_KEY environment variable must be exactly 32 hex characters (16 bytes)');
  process.exit(1);
} // 必须32字节
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

/**
 * 加密字符串
 * @param {string} text - 明文
 * @returns {string} - 格式: iv:authTag:encrypted (均为hex)
 */
export function encrypt(text) {
  if (!text) return text;
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'utf8'), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * 解密字符串
 * @param {string} encryptedText - 格式: iv:authTag:encrypted
 * @returns {string} - 明文
 */
export function decrypt(encryptedText) {
  if (!encryptedText || !encryptedText.includes(':')) return encryptedText;
  try {
    const [ivHex, tagHex, encHex] = encryptedText.split(':');
    if (!ivHex || !tagHex || !encHex) return encryptedText; // 不是加密格式，原样返回
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(tagHex, 'hex');
    const encrypted = encHex;
    const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'utf8'), iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (e) {
    // 解密失败说明不是加密数据，原样返回
    return encryptedText;
  }
}

/**
 * 判断字符串是否已加密
 */
export function isEncrypted(text) {
  if (!text || typeof text !== 'string') return false;
  const parts = text.split(':');
  if (parts.length !== 3) return false;
  // iv=32hex, tag=32hex, encrypted>=2hex
  return /^[0-9a-f]{32}$/.test(parts[0]) && /^[0-9a-f]{32}$/.test(parts[1]) && /^[0-9a-f]+$/.test(parts[2]);
}

export default { encrypt, decrypt, isEncrypted };
