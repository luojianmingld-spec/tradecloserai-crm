/**
 * whatsapp-provider.js (stub - Evolution API 接管后禁用)
 * 
 * 保留此文件仅为兼容 automation.service.js 等旧模块的 import，
 * 实际 WhatsApp 通信已由 evolution-connector.js 完全接管。
 * 不再初始化 Baileys/SocksProxyAgent，不再连接 WhatsApp，不再打印 1080 代理日志。
 */
import { EventEmitter } from "events";

class DummyProvider extends EventEmitter {
  constructor() {
    super();
    // 静默，不再输出 [WA] Provider initialized
  }
  getStatus() { return { connected: false, state: "evolution-managed" }; }
  getInstance() { return null; }
  async sendMessage() { throw new Error("Use evolution-connector instead"); }
  getSocket() { return null; }
}

const whatsappProvider = new DummyProvider();
export default whatsappProvider;
export { DummyProvider as BaileysProvider };
export function getBaileysProvider() { return whatsappProvider; }
