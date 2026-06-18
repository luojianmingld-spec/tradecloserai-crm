/**
 * WhatsApp Provider 抽象层
 * 定义接口规范，当前实现为 BaileysProvider
 * 后续可扩展 OfficialAPIProvider 等
 */

import { EventEmitter } from 'events';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ============================================================
// 抽象接口定义（JSDoc — JS 无 interface 关键字，用文档约定）
// ============================================================

/**
 * @interface WhatsAppProvider
 * @method connect(sessionId) - 连接WhatsApp，返回QR码
 * @method sendMessage(sessionId, to, message) - 发送消息
 * @method disconnect(sessionId) - 断开连接
 * @method getStatus(sessionId) - 获取连接状态
 * @method on(event, listener) - 事件监听
 *
 * 事件:
 *   - 'qr'        (sessionId, qrCode)     — 二维码生成
 *   - 'connected' (sessionId, phone)       — 连接成功
 *   - 'disconnected' (sessionId, reason)   — 连接断开
 *   - 'message'   (sessionId, message)     — 收到新消息
 *   - 'sent'      (sessionId, message)     — 消息已发送
 *   - 'status'    (sessionId, status)      — 状态变更
 */

// ============================================================
// Baileys Provider 实现
// ============================================================

class BaileysProvider extends EventEmitter {
  constructor() {
    super();
    /** @type {Map<string, object>} sessionId → Baileys sock */
    this.sockets = new Map();
    /** @type {Map<string, string>} sessionId → connection status */
    this.statuses = new Map();
    /** @type {Map<string, string>} sessionId → phone number */
    this.phones = new Map();
    this._baileys = null;
    this._pino = null;
  }

  /** 动态加载 Baileys（ESM-only，安装失败时降级） */
  async _loadBaileys() {
    if (this._baileys) return this._baileys;
    try {
      const baileys = await import('@whiskeysockets/baileys');
      this._baileys = baileys;
      this._pino = (await import('pino')).default;
      console.log('[WA] Baileys loaded successfully');
      return baileys;
    } catch (err) {
      console.warn('[WA] Baileys not available:', err.message);
      this._baileys = null;
      return null;
    }
  }

  /** 检查 Baileys 是否可用 */
  isAvailable() {
    return this._baileys !== null;
  }

  /** 检测当前是否为生产环境（只读 fs） */
  _isProduction() {
    return process.env.NODE_ENV === 'production';
  }

  /** 获取 session 认证数据目录 */
  _getAuthDir(sessionId) {
    // 生产环境 fs 只读，使用 /tmp（唯一可写目录）
    const baseDir = this._isProduction()
      ? path.join('/tmp', 'wa-sessions')
      : path.join(process.cwd(), 'sessions');
    return path.join(baseDir, sessionId);
  }

  /** 使用 baileys 的 useMultiFileAuthState 管理认证 */
  async _getAuthState(sessionId) {
    const baileys = await this._loadBaileys();
    const { useMultiFileAuthState } = baileys;
    const authDir = this._getAuthDir(sessionId);

    // 确保目录存在（recursive 确保父目录也被创建）
    const fs = await import('fs');
    const pathMod = await import('path');
    const parentDir = pathMod.dirname(authDir);
    try {
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }
      if (!fs.existsSync(authDir)) {
        fs.mkdirSync(authDir, { recursive: true });
      }
    } catch (err) {
      console.warn(`[WA] Could not create auth dir ${authDir}: ${err.message}`);
      // 继续 — useMultiFileAuthState 可能仍然部分工作，或在后续步骤中优雅失败
    }

    return await useMultiFileAuthState(authDir);
  }

  /**
   * 判断是否为网络不可达错误（sandbox 等受限环境）
   */
  _isNetworkError(lastDisconnect) {
    const err = lastDisconnect?.error;
    if (!err) return false;
    // ETIMEDOUT, ENOTFOUND, ECONNREFUSED, EAI_AGAIN 等
    const code = err.data?.code || err.code;
    if (code && ['ETIMEDOUT', 'ENOTFOUND', 'ECONNREFUSED', 'EAI_AGAIN', 'EHOSTUNREACH', 'ENETUNREACH'].includes(code)) {
      return true;
    }
    // statusCode 408 = Request Time-out
    const statusCode = err.output?.statusCode;
    if (statusCode === 408) return true;
    return false;
  }

  /**
   * 连接 WhatsApp — 生成 QR 码供前端扫码
   * @param {string} sessionId
   * @returns {Promise<{status: string, qr?: string}>}
   */
  async connect(sessionId) {
    // 尝试加载 Baileys
    const baileys = await this._loadBaileys();
    if (!baileys) {
      return { status: 'unavailable', message: 'WhatsApp library not installed. Contact admin to enable WhatsApp integration.' };
    }

    // 已连接则直接返回
    if (this.sockets.has(sessionId) && this.statuses.get(sessionId) === 'connected') {
      return { status: 'connected', phone: this.phones.get(sessionId) };
    }

    // 正在连接中（防止重复连接）
    if (this.statuses.get(sessionId) === 'connecting') {
      return { status: 'connecting', sessionId };
    }

    const { makeWASocket, DisconnectReason, fetchLatestBaileysVersion, useMultiFileAuthState } = baileys;

    this.statuses.set(sessionId, 'connecting');
    this.emit('status', sessionId, 'connecting');

    // 重置重连计数
    this._retryCount = this._retryCount || new Map();
    const retries = this._retryCount.get(sessionId) || 0;

    // 获取最新版本号（加超时保护）
    let version;
    try {
      const result = await Promise.race([
        fetchLatestBaileysVersion(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('version fetch timeout')), 10000)),
      ]);
      version = result.version;
    } catch {
      version = [2, 3000, 1025]; // fallback
    }

    const { state, saveCreds } = await this._getAuthState(sessionId);

    const sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      logger: this._pino?.({ level: 'warn' }) || undefined,
      defaultQueryTimeoutMs: 60000,
      connectTimeoutMs: 20000,
    });

    // 保存凭据更新
    sock.ev.on('creds.update', saveCreds);

    // QR 超时定时器：如果 30 秒内没有收到 QR，通知前端
    let qrTimeout = setTimeout(() => {
      if (this.statuses.get(sessionId) === 'connecting') {
        console.warn(`[WA] QR timeout for ${sessionId} — WhatsApp servers may be unreachable`);
        this.statuses.set(sessionId, 'error');
        this.emit('status', sessionId, 'error');
        this.emit('error', sessionId, {
          message: '无法连接到 WhatsApp 服务器。可能是网络限制或防火墙阻止了连接。请检查网络环境后重试。',
          code: 'QR_TIMEOUT',
        });
        // 尝试关闭 socket
        try { sock.end(new Error('QR timeout')); } catch { /* ignore */ }
        this.sockets.delete(sessionId);
      }
    }, 30000);

    // QR 码事件
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        // 清除 QR 超时
        clearTimeout(qrTimeout);
        qrTimeout = null;

        // 生成 QR 码 Data URL
        try {
          const QRCode = (await import('qrcode')).default;
          const qrDataUrl = await QRCode.toDataURL(qr, { width: 256 });
          this.statuses.set(sessionId, 'waiting_qr');
          this.emit('status', sessionId, 'waiting_qr');
          this.emit('qr', sessionId, qrDataUrl);
        } catch (err) {
          console.error('[WA] QR generation failed:', err.message);
          this.emit('error', sessionId, { message: '二维码生成失败: ' + err.message, code: 'QR_GEN_ERROR' });
        }
      }

      if (connection === 'close') {
        // 清除 QR 超时
        if (qrTimeout) { clearTimeout(qrTimeout); qrTimeout = null; }

        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const reason = lastDisconnect?.error?.message || 'Unknown';

        // 网络不可达 — 不重试，直接报错
        if (this._isNetworkError(lastDisconnect)) {
          console.error(`[WA] Network unreachable for ${sessionId}: ${reason}`);
          this.sockets.delete(sessionId);
          this.statuses.set(sessionId, 'error');
          this.emit('status', sessionId, 'error');
          this.emit('error', sessionId, {
            message: '无法连接到 WhatsApp 服务器。当前网络环境可能无法访问 WhatsApp，请检查网络或联系管理员。',
            code: 'NETWORK_UNREACHABLE',
            detail: reason,
          });
          await this._updateDBStatus(sessionId, 'error');
          return;
        }

        if (statusCode === DisconnectReason.loggedOut) {
          // 被登出 — 清理
          this.sockets.delete(sessionId);
          this.statuses.set(sessionId, 'disconnected');
          this.phones.delete(sessionId);
          this.emit('status', sessionId, 'disconnected');
          this.emit('disconnected', sessionId, 'logged_out');
          await this._updateDBStatus(sessionId, 'disconnected');
        } else if (retries < 3) {
          // 有限重连（最多 3 次）
          this._retryCount.set(sessionId, retries + 1);
          this.statuses.set(sessionId, 'reconnecting');
          this.emit('status', sessionId, 'reconnecting');
          setTimeout(() => this.connect(sessionId), 5000);
        } else {
          // 超过最大重试次数 — 报错
          this._retryCount.set(sessionId, 0);
          this.sockets.delete(sessionId);
          this.statuses.set(sessionId, 'error');
          this.emit('status', sessionId, 'error');
          this.emit('error', sessionId, {
            message: '连接 WhatsApp 失败，已重试 3 次仍无法连接。请稍后重试或检查网络。',
            code: 'MAX_RETRIES',
            detail: reason,
          });
          await this._updateDBStatus(sessionId, 'error');
        }
      }

      if (connection === 'open') {
        // 清除 QR 超时
        if (qrTimeout) { clearTimeout(qrTimeout); qrTimeout = null; }
        // 重置重连计数
        this._retryCount?.set(sessionId, 0);

        const phone = sock.user?.id?.split(':')[0] || 'unknown';
        this.sockets.set(sessionId, sock);
        this.statuses.set(sessionId, 'connected');
        this.phones.set(sessionId, phone);
        this.emit('status', sessionId, 'connected');
        this.emit('connected', sessionId, phone);
        await this._updateDBStatus(sessionId, 'connected', phone);
      }
    });

    // 收到新消息
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;

      for (const msg of messages) {
        if (!msg.key.fromMe && msg.message) {
          const from = msg.key.remoteJid;
          let body = '';

          if (msg.message.conversation) {
            body = msg.message.conversation;
          } else if (msg.message.extendedTextMessage?.text) {
            body = msg.message.extendedTextMessage.text;
          } else if (msg.message.imageMessage?.caption) {
            body = msg.message.imageMessage.caption;
          }

          if (!body || !from) continue;

          const messageData = {
            sessionId,
            from,
            to: sock.user?.id || 'me',
            body,
            type: 'text',
            direction: 'inbound',
            timestamp: new Date(parseInt(msg.messageTimestamp?.toString() || '0') * 1000 || Date.now()),
            waMessageId: msg.key.id,
          };

          // 存数据库
          await this._saveMessage(messageData);

          // 通知前端
          this.emit('message', sessionId, messageData);

          // 自动创建/更新客户
          await this._autoCreateCustomer(from, body);
        }
      }
    });

    // 暂存 socket（即使未完全连接也存，用于 QR 事件）
    this.sockets.set(sessionId, sock);

    return { status: 'connecting' };
  }

  /**
   * 发送消息
   * @param {string} sessionId
   * @param {string} to - JID (e.g. "8613800138000@s.whatsapp.net")
   * @param {string} message
   * @returns {Promise<{success: boolean, messageId?: string}>}
   */
  async sendMessage(sessionId, to, message) {
    // 检查 Baileys 是否可用
    if (!this._baileys && !(await this._loadBaileys())) {
      throw new Error('WhatsApp library not installed');
    }

    const sock = this.sockets.get(sessionId);
    if (!sock || this.statuses.get(sessionId) !== 'connected') {
      throw new Error('WhatsApp not connected');
    }

    // 确保 JID 格式正确
    if (!to.includes('@')) {
      to = `${to}@s.whatsapp.net`;
    }

    const sent = await sock.sendMessage(to, { text: message });

    const messageData = {
      sessionId,
      from: sock.user?.id || 'me',
      to,
      body: message,
      type: 'text',
      direction: 'outbound',
      timestamp: new Date(),
      waMessageId: sent.key.id,
    };

    await this._saveMessage(messageData);
    this.emit('sent', sessionId, messageData);

    return { success: true, messageId: sent.key.id };
  }

  /**
   * 断开连接
   * @param {string} sessionId
   */
  async disconnect(sessionId) {
    const sock = this.sockets.get(sessionId);
    if (sock) {
      try { await sock.logout(); } catch { /* ignore */ }
      this.sockets.delete(sessionId);
    }
    this.statuses.set(sessionId, 'disconnected');
    this.phones.delete(sessionId);
    this.emit('status', sessionId, 'disconnected');
    this.emit('disconnected', sessionId, 'manual');
    await this._updateDBStatus(sessionId, 'disconnected');
  }

  /**
   * 获取连接状态
   * @param {string} sessionId
   * @returns {{status: string, phone?: string}}
   */
  getStatus(sessionId) {
    return {
      status: this.statuses.get(sessionId) || 'disconnected',
      phone: this.phones.get(sessionId),
    };
  }

  /**
   * 获取所有活跃连接
   */
  getActiveConnections() {
    const connections = [];
    for (const [sessionId, status] of this.statuses) {
      if (status !== 'disconnected') {
        connections.push({ sessionId, status, phone: this.phones.get(sessionId) });
      }
    }
    return connections;
  }

  // ============================================================
  // 内部辅助方法
  // ============================================================

  /** 保存消息到数据库 */
  async _saveMessage(msgData) {
    try {
      await prisma.wAMessage.create({
        data: {
          sessionId: msgData.sessionId,
          from: msgData.from,
          to: msgData.to,
          body: msgData.body,
          type: msgData.type,
          direction: msgData.direction,
          timestamp: msgData.timestamp,
          waMessageId: msgData.waMessageId,
        },
      });
    } catch (err) {
      console.error('[WA] Failed to save message:', err.message);
    }
  }

  /** 更新数据库中的连接状态 */
  async _updateDBStatus(sessionId, status, phone) {
    try {
      await prisma.wAConnection.upsert({
        where: { sessionId },
        create: { sessionId, status, phone, lastConnectedAt: status === 'connected' ? new Date() : null },
        update: { status, ...(phone && { phone }), ...(status === 'connected' && { lastConnectedAt: new Date() }) },
      });
    } catch (err) {
      console.error('[WA] Failed to update DB status:', err.message);
    }
  }

  /** 自动创建客户记录 */
  async _autoCreateCustomer(jid, messageBody) {
    try {
      const phone = jid.split('@')[0];
      const existing = await prisma.customer.findFirst({ where: { phone } });
      if (!existing) {
        await prisma.customer.create({
          data: {
            phone,
            name: phone, // 默认用手机号，用户可后续编辑
            source: 'whatsapp',
            status: 'potential',
            lastContactAt: new Date(),
          },
        });
        console.log(`[WA] Auto-created customer for ${phone}`);
      } else {
        await prisma.customer.update({
          where: { id: existing.id },
          data: { lastContactAt: new Date() },
        });
      }
    } catch (err) {
      console.error('[WA] Failed to auto-create customer:', err.message);
    }
  }
}

// ============================================================
// 导出单例
// ============================================================

const whatsappProvider = new BaileysProvider();
export default whatsappProvider;
export { BaileysProvider };
export function getBaileysProvider() { return whatsappProvider; }
