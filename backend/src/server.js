import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';
import { setupSocketHandlers } from './socket/handlers.js';
import authRoutes from './routes/auth.js';
import accountRoutes from './routes/accounts.js';
import contactRoutes from './routes/contacts.js';
import messageRoutes from './routes/messages.js';
import settingsRoutes from './routes/settings.js';
import translationRoutes from './routes/translation.js';
import aiRoutes from './routes/ai.js';
import { authMiddleware } from './middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();
const app = express();
const httpServer = createServer(app);

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

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Serve frontend in production ───
if (isProduction) {
  const frontendPath = path.join(__dirname, '../../frontend/dist');
  app.use(express.static(frontendPath));
  // Express 5 requires named parameter instead of bare '*'
  app.get('{*path}', (req, res) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/socket.io')) {
      res.sendFile(path.join(frontendPath, 'index.html'));
    }
  });
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

// ─── Start server ───
httpServer.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[FATAL] Port ${LISTEN_PORT} is already in use. Exiting.`);
    process.exit(1);
  }
  console.error('[FATAL] Server error:', err);
});

httpServer.listen(LISTEN_PORT, '0.0.0.0', () => {
  console.log(`[${isProduction ? 'Production' : 'Dev'}] Server running on port ${LISTEN_PORT}`);
});

// ─── Seed default user ───
async function seedDefaultUser() {
  try {
    const bcrypt = await import('bcryptjs');
    const existing = await prisma.user.findUnique({ where: { username: 'admin' } });
    if (!existing) {
      const hash = await bcrypt.default.hash('admin123', 10);
      await prisma.user.create({
        data: { username: 'admin', password: hash, name: 'Admin', role: 'admin' },
      });
      console.log('[Seed] Default user created: admin / admin123');
    }
  } catch (err) {
    console.error('[Seed] Error creating default user:', err.message);
  }
}

seedDefaultUser();

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
