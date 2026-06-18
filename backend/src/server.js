import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';
import { setupSocketHandlers } from './socket/handlers.js';
import { getBaileysProvider } from './services/whatsapp-provider.js';
import authRoutes from './routes/auth.js';
import accountRoutes from './routes/accounts.js';
import contactRoutes from './routes/contacts.js';
import messageRoutes from './routes/messages.js';
import settingsRoutes from './routes/settings.js';
import translationRoutes from './routes/translation.js';
import aiRoutes from './routes/ai.js';
import whatsappRoutes from './routes/whatsapp.js';
import customerRoutes from './routes/customers.js';
import { authMiddleware } from './middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();
const app = express();
const httpServer = createServer(app);

// Ensure database tables exist before starting
async function ensureDatabase() {
  try {
    // Quick check: can we query the User table?
    await prisma.user.count();
    console.log('[DB] Database connected, tables exist');
  } catch (err) {
    console.error('[DB] Database check failed, running prisma db push...');
    try {
      const { execSync } = await import('child_process');
      execSync('npx prisma db push --accept-data-loss', {
        stdio: 'inherit',
        cwd: process.cwd()
      });
      console.log('[DB] prisma db push completed');
    } catch (pushErr) {
      console.error('[DB] prisma db push failed:', pushErr.message);
      // Continue anyway - the tables might already exist
    }
  }
}

const PORT = process.env.PORT || 3001;
const isProduction = process.env.NODE_ENV === 'production';
// Production: MUST read from DEPLOY_RUN_PORT (injected by sandbox)
// Dev: use PORT (3001) for backend, Vite uses DEPLOY_RUN_PORT for frontend
const LISTEN_PORT = isProduction ? (parseInt(process.env.DEPLOY_RUN_PORT, 10) || 5000) : PORT;

// ─── Global error handlers ───
process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught Exception:', err.message);
  console.error(err.stack);
  // EADDRINUSE is fatal — the server cannot function without the port
  if (err.code === 'EADDRINUSE') {
    console.error(`[FATAL] Port ${LISTEN_PORT} is already in use. Exiting.`);
    process.exit(1);
  }
  // For other errors, keep the process alive
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[ERROR] Unhandled Promise Rejection:', reason);
  // Don't exit — keep the process alive
});

// ─── CORS ───
app.use(cors({
  origin: isProduction ? false : ['http://localhost:5173', 'http://localhost:5000', 'http://localhost:3000'],
  credentials: true,
}));

app.use(express.json());

// ─── API Routes ───
app.use('/api/auth', authRoutes);
app.use('/api/accounts', authMiddleware, accountRoutes);
app.use('/api/contacts', authMiddleware, contactRoutes);
app.use('/api/messages', authMiddleware, messageRoutes);
app.use('/api/settings', authMiddleware, settingsRoutes);
app.use('/api/translation', authMiddleware, translationRoutes);
app.use('/api/ai', authMiddleware, aiRoutes);
app.use('/api/whatsapp', authMiddleware, whatsappRoutes);
app.use('/api/customers', authMiddleware, customerRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Serve frontend in production ───
if (isProduction) {
  // Resolve frontend dist path robustly:
  // When started via start.sh, cwd is backend/ → ../frontend/dist
  // Fallback: __dirname (backend/src/) → ../../frontend/dist
  const cwdFrontendPath = path.join(process.cwd(), '../frontend/dist');
  const fallbackFrontendPath = path.join(__dirname, '../../frontend/dist');
  const frontendPath = fs.existsSync(cwdFrontendPath) ? cwdFrontendPath : fallbackFrontendPath;
  const hasDist = fs.existsSync(path.join(frontendPath, 'index.html'));
  console.log(`[Production] Serving frontend from: ${frontendPath} (dist exists: ${hasDist})`);

  if (hasDist) {
    app.use(express.static(frontendPath));
    // Express 5 SPA fallback: catch-all for non-API, non-static GET requests
    // Must call res.send() or next() for ALL matched routes, otherwise request hangs
    app.get('{*path}', (req, res, next) => {
      // Skip API and Socket.io paths - let them 404 naturally
      if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
        return next();
      }
      // For all other paths, serve the SPA index.html
      res.sendFile(path.join(frontendPath, 'index.html'));
    });
  } else {
    // No frontend dist - still serve API, return status page for root
    console.warn('[Production] WARNING: frontend dist not found, serving API-only mode');
    app.get('/', (req, res) => {
      res.json({ status: 'ok', mode: 'api-only', message: 'Frontend not built' });
    });
  }
}

// ─── Socket.io setup (BEFORE listen) ───
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: isProduction ? false : ['http://localhost:5173', 'http://localhost:5000', 'http://localhost:3000'],
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

app.set('io', io);
app.set('prisma', prisma);

setupSocketHandlers(io, prisma);

// ─── Bridge WhatsApp Provider events → Socket.io ───
const waProvider = getBaileysProvider();
waProvider.on('qr', (sessionId, qrDataUrl) => {
  const userId = sessionId.replace('user_', '');
  io.to(sessionId).emit('whatsapp:qr', { sessionId, qr: qrDataUrl });
  console.log(`[WA] QR emitted for ${sessionId}`);
});
waProvider.on('connected', (sessionId, phone) => {
  const userId = sessionId.replace('user_', '');
  io.to(sessionId).emit('whatsapp:status', { sessionId, status: 'connected', phone });
  io.to(`user_${userId}`).emit('whatsapp:status', { sessionId, status: 'connected', phone });
  console.log(`[WA] Connected: ${sessionId} (${phone})`);
});
waProvider.on('disconnected', (sessionId, reason) => {
  const userId = sessionId.replace('user_', '');
  io.to(sessionId).emit('whatsapp:status', { sessionId, status: 'disconnected', reason });
  io.to(`user_${userId}`).emit('whatsapp:status', { sessionId, status: 'disconnected', reason });
});
waProvider.on('status', (sessionId, status) => {
  const userId = sessionId.replace('user_', '');
  io.to(`user_${userId}`).emit('whatsapp:status', { sessionId, status });
});
waProvider.on('message', (sessionId, messageData) => {
  const userId = sessionId.replace('user_', '');
  // Extract contact JID (the other party, not "me")
  const fromJid = messageData.direction === 'inbound' ? messageData.from : messageData.to;
  const phone = fromJid?.split('@')[0] || '';
  io.to(`user_${userId}`).emit('whatsapp:message', {
    id: messageData.waMessageId || Date.now(),
    jid: fromJid,
    from: messageData.from,
    to: messageData.to,
    body: messageData.body,
    content: messageData.body,
    direction: messageData.direction,
    fromMe: messageData.direction === 'outbound',
    messageType: messageData.type || 'text',
    timestamp: messageData.timestamp,
    contact: { name: phone, phone },
  });
});
waProvider.on('sent', (sessionId, messageData) => {
  const userId = sessionId.replace('user_', '');
  io.to(`user_${userId}`).emit('whatsapp:message_sent', {
    id: messageData.waMessageId || Date.now(),
    jid: messageData.to,
    from: messageData.from,
    to: messageData.to,
    body: messageData.body,
    content: messageData.body,
    direction: 'outbound',
    fromMe: true,
    messageType: messageData.type || 'text',
    timestamp: messageData.timestamp,
  });
});

// ─── Start server ───
httpServer.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[FATAL] Port ${LISTEN_PORT} is already in use. Exiting.`);
    process.exit(1);
  }
  console.error('[FATAL] Server error:', err);
});

// ─── Initialize and start ───
async function startServer() {
  await ensureDatabase();
  await seedDefaultUser();

  httpServer.listen(LISTEN_PORT, '0.0.0.0', () => {
    console.log(`[${isProduction ? 'Production' : 'Dev'}] Server running on port ${LISTEN_PORT}`);
  });
}

startServer().catch(err => {
  console.error('[FATAL] Failed to start server:', err);
  process.exit(1);
});

// ─── Seed default user ───
async function seedDefaultUser() {
  try {
    // First ensure DB schema is pushed
    try {
      await prisma.$queryRaw`SELECT name FROM sqlite_master WHERE type='table' LIMIT 1`;
    } catch {
      console.log('[Seed] Database not ready, running db push...');
      const { execSync } = await import('child_process');
      execSync('npx prisma db push --accept-data-loss', { stdio: 'inherit', cwd: process.cwd() });
    }

    const bcrypt = (await import('bcryptjs')).default || (await import('bcryptjs'));
    const hashFunc = bcrypt.hash || bcrypt.default?.hash;
    if (!hashFunc) throw new Error('bcrypt.hash not available');

    const existing = await prisma.user.findUnique({ where: { username: 'admin' } });
    if (!existing) {
      const hash = await hashFunc('admin123', 10);
      await prisma.user.create({
        data: { username: 'admin', password: hash, name: 'Admin', role: 'admin' },
      });
      console.log('[Seed] Default user created: admin / admin123');
    }
  } catch (err) {
    console.error('[Seed] Error creating default user:', err.message);
    console.error('[Seed] Stack:', err.stack);
  }
}


// ─── Graceful shutdown ───
async function gracefulShutdown(signal) {
  console.log(`\n[${signal}] Shutting down gracefully...`);
  io.close();
  httpServer.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
