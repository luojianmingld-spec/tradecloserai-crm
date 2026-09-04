/**
 * AI 模型参数统一配置
 * 版本: v1.0
 * 说明:
 *  - 集中管理 AI 调用的模型相关参数（temperature / maxTokens / 超时等）
 *  - 代码通过 import { AI_CONFIG } from '../config/ai.js' 引用，避免硬编码
 *  - 模型选择（具体供应商/model）由 services/ai-client.js 依据数据库
 *    provider 配置动态解析（getActiveProvider / resolveWorkingModel），
 *    本配置仅负责可调参数与策略默认值，不影响运行逻辑。
 */

export const AI_CONFIG = {
  /** 配置版本 */
  version: 'v1.0',

  /** assistant.service.js 使用的助手对话参数 */
  assistant: {
    // 第 1 次调用：AI 判断是否需要调用工具（工具决策）
    toolDecision: {
      temperature: 0.3,
      maxTokens: 1000,
    },
    // 第 2 次调用：工具结果回喂给 AI 做分析总结
    analysis: {
      temperature: 0.5,
      maxTokens: 1000,
    },
  },

  /** ai-client.js 通用默认参数（与代码现状保持一致） */
  aiClient: {
    // 默认请求超时（ms）
    defaultTimeoutMs: 10000,
    // 默认 temperature
    defaultTemperature: 0.7,
    // 轻量调用（chatCompleteLite）默认参数
    lite: {
      temperature: 0.1,
      maxTokens: 256,
    },
  },
};

export default AI_CONFIG;
