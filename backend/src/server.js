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
const DEPLOY_PORT = process.env.DEPLOY_RUN_PORT || 5000;
const isProduction = process.env.NODE_ENV === 'production';

// CORS
app.use(cors({
  origin: isProduction ? false : ['http://localhost:5173', 'http://localhost:5000', 'http://localhost:3000'],
  credentials: true,
}));

app.use(express.json());

// API Routes
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

// Serve frontend in production
if (isProduction) {
  const frontendPath = path.join(__dirname, '../../frontend/dist');
  app.use(express.static(frontendPath));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/socket.io')) {
      res.sendFile(path.join(frontendPath, 'index.html'));
    }
  });
  // In production, listen on DEPLOY_RUN_PORT
  const serverPort = DEPLOY_PORT;
  httpServer.listen(serverPort, '0.0.0.0', () => {
    console.log(`[Production] Server running on port ${serverPort}`);
  });
} else {
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`[Dev] Backend server running on port ${PORT}`);
  });
}

// Socket.io setup
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: isProduction ? false : ['http://localhost:5173', 'http://localhost:5000', 'http://localhost:3000'],
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Make io and prisma accessible
app.set('io', io);
app.set('prisma', prisma);

setupSocketHandlers(io, prisma);

// Seed default user if not exists
async function seedDefaultUser() {
  const bcrypt = await import('bcryptjs');
  const existing = await prisma.user.findUnique({ where: { username: 'admin' } });
  if (!existing) {
    const hash = await bcrypt.default.hash('admin123', 10);
    await prisma.user.create({
      data: { username: 'admin', password: hash, name: 'Admin', role: 'admin' },
    });
    console.log('[Seed] Default user created: admin / admin123');
  }
}

seedDefaultUser().catch(console.error);

export { app, io, prisma };
