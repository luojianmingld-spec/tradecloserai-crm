import pino from 'pino';
import makeWASocket, { useMultiFileAuthState } from '@whiskeysockets/baileys';
import { SocksProxyAgent } from 'socks-proxy-agent';
import fs from 'fs';
import https from 'https';
import http from 'http';
import readline from 'readline';

const proxyUrl = 'socks5://ruqr3cqj:G48qWv1POOa9@66.93.242.127:5782';
const proxyAgent = new SocksProxyAgent(proxyUrl);
https.globalAgent = proxyAgent;
http.globalAgent = proxyAgent;

const sessionDir = '/opt/whatsapp-crm/backend/sessions/test-pairing';
fs.rmSync(sessionDir, { recursive: true, force: true });

const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

const sock = makeWASocket({
  auth: state,
  printQRInTerminal: false,
  logger: pino({ level: 'info' }),
  browser: ['Chrome (Windows)', 'Chrome', '125.0.0.0'],
  syncFullHistory: false,
  connectTimeoutMs: 30000,
  defaultQueryTimeoutMs: 60000,
  agent: proxyAgent,
  fetchAgent: proxyAgent,
  markOnlineOnConnect: false,
});

sock.ev.on('creds.update', saveCreds);
sock.ev.on('connection.update', async (update) => {
  const { connection, qr } = update;
  console.log('[EVENT] connection=' + connection + ', hasQR=' + !!qr);
  // 等连接建立后（noise握手成功后），请求pairing code
  if (!connection && qr) {
    // 不处理QR，直接等一下然后请求pairing code
  }
  if (connection === 'open') {
    console.log('=== LOGIN SUCCESS! ===');
    process.exit(0);
  }
  if (connection === 'close') {
    console.log('[CLOSE] reason:', update.lastDisconnect?.error?.output?.statusCode, update.lastDisconnect?.error?.message);
    process.exit(1);
  }
});

// 等待连接就绪（3秒，让noise握手完成）
setTimeout(async () => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question('输入WhatsApp手机号（带国家码，无+号，如8613800138000）：', async (phone) => {
    rl.close();
    phone = phone.trim();
    console.log('[PAIRING] 请求配对码，手机号:', phone);
    try {
      const code = await sock.requestPairingCode(phone);
      console.log('');
      console.log('========================================');
      console.log('  配对码:', code);
      console.log('  打开WhatsApp → 设置 → 已关联设备 → 关联设备 → 使用配对码');
      console.log('========================================');
      console.log('');
    } catch (e) {
      console.error('[PAIRING ERROR]', e.message);
    }
  });
}, 5000);

setTimeout(() => {
  console.log('[TIMEOUT] 120s elapsed');
  try { sock.end(); } catch {}
  process.exit(0);
}, 120000);
