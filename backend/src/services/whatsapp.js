import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import QRCode from 'qrcode';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const prisma = new PrismaClient();

const logger = pino({
  level: 'silent', // Suppress Baileys verbose logs
});

// Store active WhatsApp connections
const activeConnections = new Map();

/**
 * Get or create a WhatsApp connection for an account
 */
export async function getOrCreateConnection(accountId, userId, io) {
  if (activeConnections.has(accountId)) {
    return activeConnections.get(accountId);
  }
  return createConnection(accountId, userId, io);
}

/**
 * Create a new WhatsApp connection
 */
async function createConnection(accountId, userId, io) {
  // Get account from DB
  const account = await prisma.whatsAppAccount.findFirst({
    where: { id: accountId, userId },
  });
  if (!account) throw new Error('Account not found');

  // Ensure auth directory exists
  const authDir = path.join(__dirname, '..', 'sessions', account.sessionDir);
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  // Load auth state
  const { state, saveCreds } = await useMultiFileAuthState(authDir);

  // Get latest Baileys version
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    logger,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    printQRInTerminal: false,
    markOnlineOnConnect: false,
    connectTimeoutMs: 60000,
    defaultQueryTimeoutMs: 30000,
    keepAliveIntervalMs: 25000,
    generateHighQualityLinkPreview: false,
    syncFullHistory: false,
    browser: ['WhatsApp CRM', 'Chrome', '1.0.0'],
  });

  const connectionInfo = {
    sock,
    accountId,
    userId,
    saveCreds,
  };

  activeConnections.set(accountId, connectionInfo);

  // Save credentials when updated
  sock.ev.on('creds.update', saveCreds);

  // Handle connection updates
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      try {
        const qrDataUrl = await QRCode.toDataURL(qr, {
          width: 300,
          margin: 2,
          color: { dark: '#000000', light: '#ffffff' },
        });
        // Emit QR code to the user's room
        io.to(`user_${userId}`).emit('whatsapp:qr', {
          accountId,
          qr: qrDataUrl,
        });
        // Update account status
        await prisma.whatsAppAccount.update({
          where: { id: accountId },
          data: { status: 'connecting' },
        });
        io.to(`user_${userId}`).emit('whatsapp:status', {
          accountId,
          status: 'connecting',
        });
      } catch (err) {
        console.error('[WhatsApp] QR generation error:', err);
      }
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      if (statusCode === DisconnectReason.loggedOut) {
        // Clean up - user logged out from phone
        console.log(`[WhatsApp] Account ${accountId} logged out`);
        activeConnections.delete(accountId);
        await prisma.whatsAppAccount.update({
          where: { id: accountId },
          data: { status: 'disconnected' },
        });
        io.to(`user_${userId}`).emit('whatsapp:status', {
          accountId,
          status: 'disconnected',
          reason: 'logged_out',
        });
      } else if (shouldReconnect) {
        console.log(`[WhatsApp] Account ${accountId} reconnecting... (code: ${statusCode})`);
        await prisma.whatsAppAccount.update({
          where: { id: accountId },
          data: { status: 'reconnecting' },
        });
        io.to(`user_${userId}`).emit('whatsapp:status', {
          accountId,
          status: 'reconnecting',
        });
        // Reconnect after delay
        setTimeout(() => {
          if (activeConnections.has(accountId)) {
            activeConnections.delete(accountId);
          }
          createConnection(accountId, userId, io).catch(console.error);
        }, 3000);
      }
    }

    if (connection === 'open') {
      console.log(`[WhatsApp] Account ${accountId} connected`);

      // Get account info
      try {
        const meId = sock.user?.id;
        const meName = sock.user?.name || '';

        await prisma.whatsAppAccount.update({
          where: { id: accountId },
          data: {
            status: 'connected',
            phone: meId?.split('@')[0] || null,
            pushName: meName,
            lastActiveAt: new Date(),
          },
        });

        io.to(`user_${userId}`).emit('whatsapp:status', {
          accountId,
          status: 'connected',
          info: { phone: meId?.split('@')[0], name: meName },
        });

        // Load existing chats
        await loadChats(accountId, sock, io, userId);
      } catch (err) {
        console.error('[WhatsApp] Error updating account info:', err);
      }
    }
  });

  // Handle incoming messages
  sock.ev.on('messages.upsert', async (m) => {
    for (const msg of m.messages) {
      try {
        await handleIncomingMessage(accountId, userId, msg, io);
      } catch (err) {
        console.error('[WhatsApp] Error handling message:', err);
      }
    }
  });

  // Handle presence updates
  sock.ev.on('presence.update', (update) => {
    io.to(`user_${userId}`).emit('whatsapp:presence', {
      accountId,
      ...update,
    });
  });

  return connectionInfo;
}

/**
 * Load existing chats from WhatsApp
 */
async function loadChats(accountId, sock, io, userId) {
  try {
    // Baileys doesn't have a direct "get chats" method like the old version
    // Chats are synced via history sync events
    // We'll emit a notification that connection is ready
    io.to(`user_${userId}`).emit('whatsapp:chats_loaded', { accountId });
  } catch (err) {
    console.error('[WhatsApp] Error loading chats:', err);
  }
}

/**
 * Handle an incoming WhatsApp message
 */
async function handleIncomingMessage(accountId, userId, msg, io) {
  // Skip status messages and protocol messages
  if (msg.key.remoteJid === 'status@broadcast') return;
  if (msg.key.fromMe) return; // We handle sent messages differently
  if (!msg.message) return;

  const jid = msg.key.remoteJid;
  const pushName = msg.pushName || '';

  // Extract message content
  const content = extractMessageContent(msg.message);
  if (!content && !msg.message.imageMessage && !msg.message.documentMessage) return;

  const messageType = getMessageType(msg.message);

  // Ensure contact exists
  let contact = await prisma.contact.findUnique({
    where: { accountId_jid: { accountId, jid } },
  });

  if (!contact) {
    contact = await prisma.contact.create({
      data: {
        accountId,
        jid,
        name: pushName || jid.split('@')[0],
        pushName,
        phone: jid.split('@')[0],
      },
    });
  } else if (pushName && pushName !== contact.pushName) {
    await prisma.contact.update({
      where: { id: contact.id },
      data: { pushName, name: contact.name || pushName },
    });
  }

  // Check for duplicate message
  const existingMsg = await prisma.message.findFirst({
    where: {
      accountId,
      jid,
      fromMe: false,
      timestamp: new Date(Math.floor((msg.messageTimestamp || Date.now() / 1000) * 1000)),
    },
  });
  if (existingMsg) return;

  // Auto-translate incoming message
  let translationResult = null;
  try {
    const { autoTranslateMessage } = await import('./translation.js');
    translationResult = await autoTranslateMessage(content || '', userId);
  } catch (err) {
    console.error('[WhatsApp] Auto-translation error:', err);
  }

  // Save message (with translation if available)
  const timestamp = new Date(
    Math.floor((msg.messageTimestamp || Date.now() / 1000) * 1000)
  );

  const savedMessage = await prisma.message.create({
    data: {
      accountId,
      contactId: contact.id,
      jid,
      fromMe: false,
      content: content || '',
      messageType,
      timestamp,
      translation: translationResult?.translated || null,
      sourceLang: translationResult?.sourceLang || null,
    },
  });

  // Update or create conversation
  await prisma.conversation.upsert({
    where: { accountId_jid: { accountId, jid } },
    create: {
      accountId,
      contactId: contact.id,
      jid,
      lastMessage: content?.substring(0, 100) || `[${messageType}]`,
      lastMessageAt: timestamp,
      unreadCount: 1,
    },
    update: {
      lastMessage: content?.substring(0, 100) || `[${messageType}]`,
      lastMessageAt: timestamp,
      unreadCount: { increment: 1 },
    },
  });

  // Emit to user
  io.to(`user_${userId}`).emit('whatsapp:message', {
    accountId,
    message: savedMessage,
    contact,
  });
}

/**
 * Send a text message via WhatsApp
 */
export async function sendMessage(accountId, userId, jid, text, io) {
  const conn = activeConnections.get(accountId);
  if (!conn || !conn.sock) {
    throw new Error('WhatsApp not connected');
  }

  const sent = await conn.sock.sendMessage(jid, { text });

  // Ensure contact exists
  let contact = await prisma.contact.findUnique({
    where: { accountId_jid: { accountId, jid } },
  });

  if (!contact) {
    contact = await prisma.contact.create({
      data: {
        accountId,
        jid,
        name: jid.split('@')[0],
        phone: jid.split('@')[0],
      },
    });
  }

  // Save sent message
  const timestamp = new Date();
  const savedMessage = await prisma.message.create({
    data: {
      accountId,
      contactId: contact.id,
      jid,
      fromMe: true,
      content: text,
      messageType: 'text',
      timestamp,
    },
  });

  // Update conversation
  await prisma.conversation.upsert({
    where: { accountId_jid: { accountId, jid } },
    create: {
      accountId,
      contactId: contact.id,
      jid,
      lastMessage: text.substring(0, 100),
      lastMessageAt: timestamp,
      unreadCount: 0,
    },
    update: {
      lastMessage: text.substring(0, 100),
      lastMessageAt: timestamp,
    },
  });

  return savedMessage;
}

/**
 * Disconnect a WhatsApp account
 */
export async function disconnectAccount(accountId, userId) {
  const conn = activeConnections.get(accountId);
  if (conn) {
    await conn.sock.logout();
    activeConnections.delete(accountId);
  }
  await prisma.whatsAppAccount.update({
    where: { id: accountId },
    data: { status: 'disconnected' },
  });
}

/**
 * Get active connection for an account
 */
export function getConnection(accountId) {
  return activeConnections.get(accountId);
}

/**
 * Get all active connections for a user
 */
export function getUserConnections(userId) {
  const result = [];
  for (const [accountId, conn] of activeConnections.entries()) {
    if (conn.userId === userId) {
      result.push({ accountId, status: 'connected' });
    }
  }
  return result;
}

// Helper functions

function extractMessageContent(message) {
  if (message.conversation) return message.conversation;
  if (message.extendedTextMessage?.text) return message.extendedTextMessage.text;
  if (message.imageMessage?.caption) return message.imageMessage.caption;
  if (message.videoMessage?.caption) return message.videoMessage.caption;
  if (message.documentMessage?.caption) return message.documentMessage.caption;
  if (message.buttonsResponseMessage?.selectedDisplayText)
    return message.buttonsResponseMessage.selectedDisplayText;
  if (message.listResponseMessage?.title) return message.listResponseMessage.title;
  if (message.templateButtonReplyMessage?.selectedDisplayText)
    return message.templateButtonReplyMessage.selectedDisplayText;
  if (message.reactionMessage?.text) return `[Reaction: ${message.reactionMessage.text}]`;
  if (message.contactMessage?.displayName) return `[Contact: ${message.contactMessage.displayName}]`;
  if (message.locationMessage) {
    const lat = message.locationMessage.degreesLatitude;
    const lng = message.locationMessage.degreesLongitude;
    return `[Location: ${lat}, ${lng}]`;
  }
  return null;
}

function getMessageType(message) {
  if (message.conversation || message.extendedTextMessage) return 'text';
  if (message.imageMessage) return 'image';
  if (message.videoMessage) return 'video';
  if (message.audioMessage) return 'audio';
  if (message.documentMessage) return 'document';
  if (message.stickerMessage) return 'sticker';
  if (message.contactMessage) return 'contact';
  if (message.locationMessage) return 'location';
  if (message.reactionMessage) return 'reaction';
  return 'unknown';
}
