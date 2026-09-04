/**
 * Evolution API v2 Connector
 * 通过HTTP REST API对接Evolution，替代旧的裸Baileys直连
 * 支持多实例（后期多账号）
 */

import { resolveSendTarget } from "./lid-mapping.js";

// 双重保险：确保 .env 中的环境变量在模块加载时就生效
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const EVO_API_URL = process.env.EVOLUTION_API_URL || "http://127.0.0.1:8081";
const EVO_API_KEY = process.env.EVOLUTION_API_KEY || "B7E2A9D4C6F1E8A3B5D7F9C2E4A6B8D1";
const DEFAULT_INSTANCE = process.env.EVOLUTION_INSTANCE || "jeremy-eric";

class EvolutionConnector {
  constructor(instanceName = DEFAULT_INSTANCE) {
    this.instance = instanceName;
    this.connected = false;
    this.qrCallbacks = new Set();
    this.messageCallbacks = new Set();
    this.statusCallbacks = new Set();
  }

  /** 切换当前实例（多账号支持） */
  useInstance(name) {
    this.instance = name;
  }

  _headers() {
    return {
      "Content-Type": "application/json",
      apikey: EVO_API_KEY,
    };
  }

  async _get(path) {
    const res = await fetch(`${EVO_API_URL}${path}`, { headers: this._headers() });
    return res.json();
  }

  async _post(path, body = {}) {
    const res = await fetch(`${EVO_API_URL}${path}`, {
      method: "POST",
      headers: this._headers(),
      body: JSON.stringify(body),
    });
    return res.json();
  }


  async _postMultipart(path, formData, timeoutMs = 180000) {
    const headers = { apikey: EVO_API_KEY };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${EVO_API_URL}${path}`, {
        method: 'POST',
        headers,
        body: formData,
        signal: controller.signal,
      });
      const text = await res.text();
      try { return JSON.parse(text); } catch { return { raw: text, status: res.status }; }
    } finally {
      clearTimeout(timer);
    }
  }

  async _delete(path) {
    const res = await fetch(`${EVO_API_URL}${path}`, {
      method: "DELETE",
      headers: this._headers(),
    });
    return res.json();
  }

  /** 检查实例连接状态 */
  async getConnectionState() {
    try {
      const r = await this._get(`/instance/connectionState/${this.instance}`);
      const state = r?.instance?.state || "close";
      this.connected = state === "open";
      return state;
    } catch (e) {
      return "close";
    }
  }

  /** 获取当前QR码 */
  async getQRCode() {
    try {
      const r = await this._get(`/instance/connect/${this.instance}`);
      return r?.base64 || null;
    } catch (e) {
      return null;
    }
  }


  // === 安全模式（账号受限/风控期间阻断所有出站）===
  _safeBlock(reason) {
    if (process.env.WA_SAFE_MODE === '1') {
      console.log('[SAFE MODE] Blocked: ' + reason);
      return { success: false, error: '[SAFE MODE] ' + reason, safeMode: true };
    }
    return null;
  }

  /** 发送文本消息（优先使用LID地址） */
  async sendTextMessage(jidOrNumber, text, options = {}) {
    const _b = this._safeBlock("sendTextMessage"); if (_b) return _b;
    let targetJid = jidOrNumber;
    if (jidOrNumber.includes("@s.whatsapp.net")) {
      targetJid = resolveSendTarget(jidOrNumber);
      console.log(`[Evolution] send target: ${jidOrNumber} -> ${targetJid}`);
    }
    const number = targetJid.includes("@lid") ? targetJid : targetJid.split("@")[0].replace(/\D/g, "");
    try {
      const body = { number, text };
      if (options.quoted && options.quoted.key) {
        body.quoted = options.quoted;
      }
      const r = await this._post(`/message/sendText/${this.instance}`, body);
      return {
        success: !r?.error,
        key: r?.key || null,
        messageId: r?.key?.id || null,
        data: r,
      };
    } catch (e) {
      console.error("[Evolution] sendText error:", e.message);
      return { success: false, error: e.message };
    }
  }

  /** 发送表情回应（message reaction） */
  async sendReaction(jidOrNumber, msgKey, emoji) {
    const _b = this._safeBlock("sendReaction"); if (_b) return _b;
    let targetJid = jidOrNumber;
    if (jidOrNumber.includes("@s.whatsapp.net")) {
      targetJid = resolveSendTarget(jidOrNumber);
    }
    try {
      // sendReaction 需要 key.remoteJid 为实际目标JID（@s.whatsapp.net 或 @lid）
      const reactionKey = { ...msgKey, remoteJid: targetJid };
      const r = await this._post(`/message/sendReaction/${this.instance}`, {
        key: reactionKey,
        reaction: emoji,
      });
      return { success: !r?.error, key: r?.key || null, data: r };
    } catch (e) {
      console.error("[Evolution] sendReaction error:", e.message);
      return { success: false, error: e.message };
    }
  }

  
  /** 发送媒体消息（图片/文件）— multipart/form-data */
  async sendMediaMessage(jidOrNumber, { mediaBuffer, fileName, mimeType, mediatype, caption }) {
    const _b = this._safeBlock("sendMediaMessage"); if (_b) return _b;
    let targetJid = jidOrNumber;
    if (jidOrNumber.includes('@s.whatsapp.net')) {
      targetJid = resolveSendTarget(jidOrNumber);
      console.log(`[Evolution] sendMedia target: ${jidOrNumber} -> ${targetJid}`);
    }
    const number = targetJid.includes('@lid') ? targetJid : targetJid.split('@')[0].replace(/\D/g, '');

    const fd = new FormData();
    fd.append('number', number);
    fd.append('mediatype', mediatype || 'document');
    if (mimeType) fd.append('mimeType', mimeType);
    if (fileName) fd.append('fileName', fileName);
    if (caption) fd.append('caption', caption);
    fd.append('file', new Blob([mediaBuffer], { type: mimeType || 'application/octet-stream' }), fileName || 'file');

    try {
      let r = await this._postMultipart(`/message/sendMedia/${this.instance}`, fd);
      // 如果超时或失败，重试1次
      if ((r?.error || !r?.key?.id) && (r?.raw?.includes('timeout') || r?.error || !r?.key?.id)) {
        const errMsg = r?.error || (r?.key ? 'no key id' : JSON.stringify(r).slice(0,100));
        console.warn(`[Evolution] sendMedia first attempt issue (${errMsg}), retrying...`);
        // 重建FormData（因为FormData不能复用）
        const fd2 = new FormData();
        fd2.append('number', number);
        fd2.append('mediatype', mediatype || 'document');
        if (mimeType) fd2.append('mimeType', mimeType);
        if (fileName) fd2.append('fileName', fileName);
        if (caption) fd2.append('caption', caption);
        fd2.append('file', new Blob([mediaBuffer], { type: mimeType || 'application/octet-stream' }), fileName || 'file');
        r = await this._postMultipart(`/message/sendMedia/${this.instance}`, fd2);
      }
      const key = r?.key || r?.response?.key || null;
      return {
        success: !r?.error && !!key?.id,
        key,
        messageId: key?.id || null,
        data: r,
      };
    } catch (e) {
      console.error('[Evolution] sendMedia error:', e.message);
      return { success: false, error: e.message };
    }
  }

/** 获取聊天列表（POST /chat/findChats） */
  async fetchChats() {
    try {
      const r = await this._post(`/chat/findChats/${this.instance}`, {
        where: { conversationTimestamp: { $gt: 0 } },
        page: 1,
        offset: 100,
        sort: "-conversationTimestamp",
      });
      // Evolution 2.3.7 直接返回数组
      if (Array.isArray(r)) return r;
      if (r?.response && Array.isArray(r.response)) return r.response;
      if (r?.data && Array.isArray(r.data)) return r.data;
      return [];
    } catch (e) {
      console.error("[Evolution] fetchChats error:", e.message);
      return [];
    }
  }

  /** 获取联系人列表（POST /chat/findContacts） */
  async fetchContacts() {
    try {
      const r = await this._post(`/chat/findContacts/${this.instance}`, {});
      if (Array.isArray(r)) return r;
      if (r?.response && Array.isArray(r.response)) return r.response;
      if (r?.data && Array.isArray(r.data)) return r.data;
      return [];
    } catch (e) {
      console.error("[Evolution] fetchContacts error:", e.message);
      return [];
    }
  }

  /** 获取某个聊天的消息历史（POST /chat/findMessages） */
  async fetchMessages(remoteJid, limit = 50) {
    const number = remoteJid.replace(/@.*/, "").replace(/\D/g, "");
    try {
      const r = await this._post(`/chat/findMessages/${this.instance}`, {
        where: { number },
        page: 1,
        offset: limit,
        sort: "-messageTimestamp",
      });
      // 新版返回格式 {messages: {records: [...]}}
      let list = [];
      if (Array.isArray(r)) list = r;
      else if (r?.messages?.records && Array.isArray(r.messages.records)) list = r.messages.records;
      else if (r?.response?.messages?.records) list = r.response.messages.records;
      else if (r?.data && Array.isArray(r.data)) list = r.data;
      // 按时间升序返回（旧的在前）
      return list.sort((a, b) => (a.messageTimestamp || 0) - (b.messageTimestamp || 0));
    } catch (e) {
      console.error("[Evolution] fetchMessages error:", e.message);
      return [];
    }
  }

  /** 实例基本信息 */
  async getInstanceInfo() {
    try {
      const instances = await this._get("/instance/fetchInstances");
      const list = Array.isArray(instances) ? instances : (instances?.response || []);
      return list.find(i => i.name === this.instance || i.instanceName === this.instance) || null;
    } catch (e) {
      return null;
    }
  }

  /** 获取所有者JID（当前登录的我自己） */
  async getOwnerJid() {
    const info = await this.getInstanceInfo();
    return info?.ownerJid || null;
  }

  on(event, cb) {
    if (event === "qr") this.qrCallbacks.add(cb);
    else if (event === "message") this.messageCallbacks.add(cb);
    else if (event === "status") this.statusCallbacks.add(cb);
  }

  /** 由webhook路由调用 */
  handleWebhookEvent(event) {
    const eventType = event.event || event.type;
    if (eventType === "messages.upsert") {
      const msgs = event?.data?.messages || [];
      msgs.forEach(msg => {
        this.messageCallbacks.forEach(cb => { try { cb(msg); } catch (e) {} });
      });
    } else if (eventType === "connection.update") {
      this.statusCallbacks.forEach(cb => { try { cb(event.data); } catch (e) {} });
    }
  }

  async init() {
    console.log(`[Evolution Connector] API=${EVO_API_URL} instance=${this.instance}`);
    const state = await this.getConnectionState();
    console.log(`[Evolution Connector] state=${state}`);
    this.connected = state === "open";
    return this;
  }
}

// 多实例连接器池
const _connectors = new Map();
export function getEvolutionConnector(name) {
  const key = name || DEFAULT_INSTANCE;
  if (!_connectors.has(key)) {
    _connectors.set(key, new EvolutionConnector(key));
  }
  return _connectors.get(key);
}

export default EvolutionConnector;
