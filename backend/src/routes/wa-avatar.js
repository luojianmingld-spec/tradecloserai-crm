/**
 * WhatsApp 头像代理路由
 * GET /api/wa/avatar?jid=xxx
 * 优化: DB优先 → API兜底(2s超时) → 请求去重 → 更长缓存
 */

import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
const prisma = new PrismaClient();

const EVO_API_URL = process.env.EVOLUTION_API_URL || 'http://127.0.0.1:8081';
const EVO_API_KEY = process.env.EVOLUTION_API_KEY || 'B7E2A9D4C6F1E8A3B5D7F9C2E4A6B8D1';
const DEFAULT_INSTANCE = process.env.EVOLUTION_INSTANCE || 'jeremy-main';

// urlCache: key -> { url: string|null, ts: number }
const urlCache = new Map();
const URL_TTL_OK = 60 * 60 * 1000;       // 1h for successful hits
const URL_TTL_NULL = 5 * 60 * 1000;      // 5min for null misses

// 去重：正在请求中的 Promise
const pendingRequests = new Map();

const router = Router();

async function fetchAvatarUrlFromDB(jid, instance) {
  try {
    const r = await fetch(
      EVO_API_URL + '/chat/findContacts/' + encodeURIComponent(instance),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: EVO_API_KEY },
        body: JSON.stringify({ where: { remoteJid: jid }, page: 1, offset: 1 }),
      },
    );
    if (r.ok) {
      const arr = await r.json().catch(() => []);
      if (Array.isArray(arr) && arr.length) {
        const hit = arr.find((c) => c.remoteJid === jid);
        if (hit && hit.profilePicUrl) return hit.profilePicUrl;
      }
    }
  } catch (_) {}
  return null;
}

async function fetchAvatarUrlFromPictureApi(jid, instance) {
  const number = jid.split('@')[0];
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    const r = await fetch(
      EVO_API_URL + '/chat/fetchProfilePictureUrl/' + encodeURIComponent(instance),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: EVO_API_KEY },
        body: JSON.stringify({ number }),
        signal: controller.signal,
      },
    );
    clearTimeout(timer);
    if (r.ok) {
      const d = await r.json().catch(() => ({}));
      const u = d && (d.profilePictureUrl || d.pictureUrl || d.picture || d.url);
      if (u && typeof u === 'string' && u.startsWith('http')) return u;
    }
  } catch (_) {}
  return null;
}

// All WA instances to try (fallback order)
const WA_INSTANCES = ['jeremy-main', 'jeremy-eric'];

async function _fetchAvatarUrl(jid, instance) {
  // Try requested instance first
  let url = await fetchAvatarUrlFromDB(jid, instance);
  if (!url) {
    url = await fetchAvatarUrlFromPictureApi(jid, instance);
  }
  // Fallback: try other WA instances
  if (!url) {
    for (const other of WA_INSTANCES) {
      if (other === instance) continue;
      url = await fetchAvatarUrlFromDB(jid, other);
      if (url) break;
      url = await fetchAvatarUrlFromPictureApi(jid, other);
      if (url) break;
    }
  }
  return url;
}

async function fetchAvatarUrl(jid, instance) {
  const key = instance + ':' + jid;
  const cached = urlCache.get(key);
  const now = Date.now();
  if (cached) {
    const ttl = cached.url ? URL_TTL_OK : URL_TTL_NULL;
    if (now - cached.ts < ttl) {
      return cached.url;
    }
  }

  // 去重：如果同一个 key 正在请求中，复用该 Promise
  if (pendingRequests.has(key)) {
    return pendingRequests.get(key);
  }

  const p = _fetchAvatarUrl(jid, instance)
    .then(url => {
      urlCache.set(key, { url: url || null, ts: Date.now() });
      pendingRequests.delete(key);
      return url;
    })
    .catch(() => {
      urlCache.set(key, { url: null, ts: Date.now() });
      pendingRequests.delete(key);
      return null;
    });

  pendingRequests.set(key, p);
  return p;
}

router.get('/api/wa/avatar', async (req, res) => {
  const jid = (req.query.jid || '').toString().trim();
  if (!jid) {
    return res.status(400).set('Content-Type', 'text/plain').send('Missing jid parameter');
  }
  if (!/^[\d.+-]+@(s\.whatsapp\.net|g\.us|lid|broadcast|telegram)$/.test(jid)) {
    return res.status(400).set('Content-Type', 'text/plain').send('Invalid jid format');
  }
  const instance = (req.query.instance || DEFAULT_INSTANCE).toString().trim();

  // TG JID: look up avatarUrl from Contact table directly
  if (jid.endsWith('@telegram')) {
    try {
      const contact = await prisma.contact.findFirst({
        where: { jid, platform: 'telegram', avatarUrl: { not: null } },
        select: { avatarUrl: true },
      });
      const picUrl = contact?.avatarUrl || null;
      if (!picUrl) {
        return res.status(404).set('Content-Type', 'text/plain').send('No avatar');
      }
      // Support local file paths (e.g. /uploads/tg_avatars/xxx.jpg)
      if (picUrl.startsWith('/uploads/')) {
        const fullPath = path.join('/opt/whatsapp-crm/backend/src', picUrl);
        if (!fs.existsSync(fullPath)) {
          return res.status(404).set('Content-Type', 'text/plain').send('Avatar file not found');
        }
        const ext = path.extname(fullPath).toLowerCase();
        const mimeMap = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
        res.set('Content-Type', mimeMap[ext] || 'image/jpeg');
        res.set('Cache-Control', 'public, max-age=3600');
        res.status(200).sendFile(fullPath);
        return;
      }
      // Remote URL: proxy via fetch
      const upRes = await fetch(picUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (WhatsApp-CRM-Proxy)' },
        redirect: 'follow',
        signal: AbortSignal.timeout(5000),
      });
      if (!upRes.ok || !upRes.body) {
        return res.status(404).set('Content-Type', 'text/plain').send('Avatar fetch failed');
      }
      const ct = upRes.headers.get('content-type') || 'image/jpeg';
      const imgBuf = Buffer.from(await upRes.arrayBuffer());
      res.set('Content-Type', ct);
      res.set('Content-Length', imgBuf.length);
      res.set('Cache-Control', 'public, max-age=3600');
      res.status(200).send(imgBuf);
      return;
    } catch (err) {
      console.error('[avatar proxy TG] error for jid', jid, err && err.message);
      if (!res.headersSent) {
        res.status(404).set('Content-Type', 'text/plain').send('No avatar');
      } else {
        try { res.end(); } catch (_) {}
      }
      return;
    }
  }

  try {
    const picUrl = await fetchAvatarUrl(jid, instance);
    if (!picUrl) {
      return res.status(404).set('Content-Type', 'text/plain').send('No avatar');
    }

    const upRes = await fetch(picUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (WhatsApp-CRM-Proxy)' },
      redirect: 'follow',
      signal: AbortSignal.timeout(5000),
    });
    if (!upRes.ok || !upRes.body) {
      urlCache.delete(instance + ':' + jid);
      return res.status(404).set('Content-Type', 'text/plain').send('Avatar fetch failed');
    }

    const ct = upRes.headers.get('content-type') || 'image/jpeg';
    const imgBuf = Buffer.from(await upRes.arrayBuffer());
    res.set('Content-Type', ct);
    res.set('Content-Length', imgBuf.length);
    res.set('Cache-Control', 'public, max-age=3600');
    res.status(200).send(imgBuf);
  } catch (err) {
    console.error('[avatar proxy] error for jid', jid, err && err.message);
    if (!res.headersSent) {
      res.status(404).set('Content-Type', 'text/plain').send('No avatar');
    } else {
      try { res.end(); } catch (_) {}
    }
  }
});

export default router;
