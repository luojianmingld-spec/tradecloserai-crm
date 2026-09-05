/**
 * credit-context.js - 请求级积分扣分上下文（AsyncLocalStorage）
 *
 * authMiddleware 为每个请求建立 ALS 上下文（userId + 请求 body 中的 model），
 * ai-client.chatComplete 在 LLM 调用成功时从上下文自动扣分（按模型分级），
 * 覆盖所有走 auth 的 HTTP 路由，无需逐路由挂中间件。
 *
 * 去重：路由层 chargeCredits 手动扣分成功后置 manualCharged=true，
 * 底层 ai-client 检测到后不再重复扣。
 */
import { AsyncLocalStorage } from 'node:async_hooks';

export const creditALS = new AsyncLocalStorage();

export function runCreditContext(userId, model, fn) {
  return creditALS.run({ userId: userId ?? null, model: model ?? null, manualCharged: false }, fn);
}

export function getCreditContext() {
  return creditALS.getStore() || null;
}
