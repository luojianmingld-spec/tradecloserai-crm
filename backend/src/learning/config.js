/**
 * 话术库自主学习进化 V1 - 配置
 * 单租户学习闭环（采集→分类→评估→脱敏→自动入库→检索复用 + WinSummary）
 */
export const LEARNING_CONFIG = {
  /** 自动入库质量分阈值（质量分≥该值才写入租户私有池） */
  qualityThreshold: 60,
  /** 客户消息后最多配对的销售回复条数 N */
  maxReplyMessages: 3,
  /** 客户消息与其回复之间允许的最大时间间隔（毫秒），超时视为不配对 */
  replyWindowMs: 48 * 60 * 60 * 1000,
  /** 每轮最多处理原始消息条数（成本/耗时控制） */
  maxMessagesPerRun: 2000,
  /** 每轮最多评估样本数（LLM 成本控制） */
  maxSamplesPerRun: 120,
  /** LLM 并发数 */
  llmConcurrency: 3,
  /** 默认租户 accountId（V1 单租户主命名空间） */
  defaultAccountId: 1,
  /** 主用户 userId（accountId=1 的历史命名空间归属） */
  primaryUserId: 1,
  /** 权重基准与加成 */
  weightBase: 1.0,
  weightAiModifiedBonus: 0.3,
  weightWinBonus: 1.0,
  /** LLM 参数 */
  llmMaxTokens: 2600,
  llmTimeoutMs: 60000,
  /** 默认学习游标回看窗口（毫秒）首次全量=0，增量从此计算 */
  lookbackDays: 90,
};
