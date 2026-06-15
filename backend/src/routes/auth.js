import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { generateToken } from '../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken(user.id, user.role);
    res.json({
      token,
      user: { id: user.id, username: user.username, name: user.name, role: user.role },
    });
  } catch (err) {
    console.error('[Auth] Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.post('/register', async (req, res) => {
  try {
    const { username, password, name } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    const hash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { username, password: hash, name: name || username },
    });

    const token = generateToken(user.id, user.role);
    res.status(201).json({
      token,
      user: { id: user.id, username: user.username, name: user.name, role: user.role },
    });
  } catch (err) {
    console.error('[Auth] Register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.get('/me', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No token' });

  try {
    const jwt = (await import('jsonwebtoken')).default;
    const { JWT_SECRET } = await import('../middleware/auth.js');
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user) return res.status(401).json({ error: 'User not found' });
    res.json({ id: user.id, username: user.username, name: user.name, role: user.role });
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
});

export default router;
