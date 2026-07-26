import pino from 'pino';
import makeWASocket, { useMultiFileAuthState } from '@whiskeysockets/baileys';
import { SocksProxyAgent } from 'socks-proxy-agent';
import fs from 'fs';
import https from 'https';
import http from 'http';

const proxyUrl = 'socks5://ruqr3cqj:G48qWv1POOa9@66.93.242.127:5782';
const proxyAgent = new SocksProxyAgent(proxyUrl);
https.globalAgent = proxyAgent;
http.globalAgent = proxyAgent;

const sessionDir = '/opt/whatsapp-crm/backend/sessions/test-paid';
fs.rmSync(sessionDir, { recursive: true, force: true });

const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

const sock = makeWASocket({
  auth: state,
  printQRInTerminal: true,
  logger: pino({ level: 'info' }),
  browser: ['Chrome (Windows)', 'Chrome', '125.0.0.0'],
  syncFullHistory: false,
  connectTimeoutMs: 30000,
  defaultQueryTimeoutMs: 30000,
  agent: proxyAgent,
  fetchAgent: proxyAgent,
  markOnlineOnConnect: false,
});

sock.ev.on('creds.update', saveCreds);
sock.ev.on('connection.update', (update) => {
  const { connection, qr } = update;
  console.log('[EVENT] connection=' + connection + ', hasQR=' + !!qr);
  if (connection === 'open') {
    console.log('=== LOGIN SUCCESS! ===');
    process.exit(0);
  }
  if (connection === 'close') {
    console.log('[CLOSE] reason:', update.lastDisconnect?.error?.output?.statusCode, update.lastDisconnect?.error?.message);
  }
});

setTimeout(() => {
  console.log('[TIMEOUT] 90s elapsed, still alive');
  try { sock.end(); } catch {}
  process.exit(0);
}, 90000);
