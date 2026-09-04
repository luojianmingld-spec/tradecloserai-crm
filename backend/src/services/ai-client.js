/**
 * AI Client - 统一AI服务
 * 使用 openai npm 包调用各种 LLM 提供商
 * 从 Settings 表读取当前激活的 provider 配置
 * v2: 模型下线自动检测 + 自动替换 + 智能 fallback
 */
import { PrismaClient } from "@prisma/client";
import { encrypt, decrypt, isEncrypted } from "../utils/encryption.js";

const prisma = new PrismaClient();
const USER_ID = 1;

// Legacy doubao model ids (kept for reference; runtime now uses per-provider lite)
export const DOUBAO_LITE_MODEL = "doubao-seed-2-0-lite-260215";
export const DOUBAO_PRO_MODEL = "doubao-pro-32k-250115";
// Default request timeout (ms)
export const DEFAULT_TIMEOUT_MS = 10000;

// In-memory cache of working model ids per provider id, to avoid repeated /models probes
// key = provider.id, value = working model id string or promise of such
const _modelCache = new Map();
// Providers that have been auto-fixed in this process, avoid redundant DB writes
// ── Provider fallback: priority order for auto-switching when current provider fails ──
// Higher priority = tried first. Uses provider.id values.
const FALLBACK_ORDER = [
  "p1786604068598", // GPT-4o (API2D) — 首选
  "p1786601770927", // DeepSeek V4 Flash — 备用
  "p1786601765650", // Doubao Seed 2.1 Turbo — 次备
  "p1786588190918", // 商汤SenseNova — 三备
];

// Track fallback hits per provider (in-memory, resets on restart)
const _fallbackHits = new Map();

// How many fallback hits before auto-switching the active provider
const FALLBACK_SWITCH_THRESHOLD = 2;

/**
 * 判断是否为 provider 级错误（非模型名无效，而是服务不可用）
 */
function isProviderError(err) {
  const msg = (err?.message || err?.error?.message || "") + "";
  if (!msg) return false;
  const patterns = [
    /timeout|timed out|ETIMEDOUT|ECONNREFUSED|ECONNRESET|ENOTFOUND/i,
    /5\d{2}\s/i,
    /rate.?limit|too many requests|429/i,
    /service.?unavailable|503/i,
    /bad gateway|502/i,
    /gateway.?timeout|504/i,
    /server error|internal.*error/i,
    /402|insufficient.?balance|payment.?required/i,
    /403|forbidden/i,
    /connection.*(closed|refused|reset|abort)/i,
    /network.*error|socket.*hang|TLS|SSL|EPIPE/i,
    /overloaded|busy|capacity|try again/i,
    /empty content|returned empty|no content|empty response/i,
  ];
  return patterns.some((re) => re.test(msg));
}

/**
 * 获取 fallback 候选列表（排除当前 provider）
 */
async function getFallbackCandidates(currentProvider) {
  const providers = await getProviders();
  const ordered = [];
  for (const fid of FALLBACK_ORDER) {
    const p = providers.find((p) => p.id === fid);
    if (p && p.id !== currentProvider?.id && p.apiKey && p.model) {
      ordered.push(p);
    }
  }
  // 追加不在 FALLBACK_ORDER 里但可用的 provider
  for (const p of providers) {
    if (!FALLBACK_ORDER.includes(p.id) && p.id !== currentProvider?.id && p.apiKey && p.model) {
      ordered.push(p);
    }
  }
  return ordered;
}

/**
 * 自动切换激活的 provider
 */
async function autoSwitchActiveProvider(newProviderId) {
  try {
    await prisma.setting.upsert({
      where: { userId_key: { userId: USER_ID, key: "ai_active_id" } },
      create: { userId: USER_ID, key: "ai_active_id", value: newProviderId },
      update: { value: newProviderId },
    });
    console.log(`[AI Client] Auto-switched active provider to ${newProviderId}`);
  } catch (e) {
    console.warn("[AI Client] auto-switch active provider failed:", e.message);
  }
}

const _fixedIds = new Set();

let openaiModule = null;

async function getOpenAI() {
  if (!openaiModule) {
    try {
      openaiModule = await import("openai");
    } catch (e) {
      console.error("[AI Client] openai package not available:", e.message);
      return null;
    }
  }
  return openaiModule.default || openaiModule;
}

/**
 * 获取所有 provider 配置
 * v2: 平台模型池优先（AIModelConfig 表 tenantId=0 全局配置，超管后台管理）
 *     → 平台池为空时 fallback 旧租户 settings ai_providers，保证老租户不挂
 */
export async function getProviders() {
  // 1) 平台模型池优先：超管后台配置的全局模型
  try {
    const pool = await prisma.aIModelConfig.findMany({
      where: { tenantId: 0, isEnabled: true },
      orderBy: [{ id: 'asc' }],
    });
    if (pool && pool.length > 0) {
      return pool.map((m, idx) => {
        let cfg = null;
        try { cfg = m.config ? JSON.parse(m.config) : null; } catch {}
        const legacyId = cfg && cfg.legacyId;
        // isDefault：优先读迁移时保存的原值（config.isDefault），否则兜底 idx===0
        const legacyIsDefault = cfg && cfg.isDefault;
        return {
          id: legacyId || ('pool-' + m.id),
          name: m.displayName || m.modelName,
          provider: m.provider || 'openai',
          model: m.modelName,
          baseUrl: m.baseUrl || '',
          apiKey: m.apiKey ? (isEncrypted(m.apiKey) ? decrypt(m.apiKey) : m.apiKey) : '',
          isDefault: legacyIsDefault || idx === 0,
          active: m.isEnabled !== false,
          _poolId: m.id,
          _fromPool: true,
        };
      });
    }
  } catch (e) {
    console.warn('[AI Client] read platform model pool failed:', e.message);
  }

  // 2) fallback：旧租户 settings ai_providers（平台池未配置时兜底）
  const setting = await prisma.setting.findUnique({
    where: { userId_key: { userId: USER_ID, key: "ai_providers" } },
  });
  if (!setting || !setting.value) return [];
  try {
    const raw = isEncrypted(setting.value) ? decrypt(setting.value) : setting.value;
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/**
 * 保存所有 provider 配置
 * v2: 平台池模式（_fromPool）→ 写回 AIModelConfig 表（模型自动修复）；
 *     旧模式 → 写回 settings ai_providers
 */
async function saveProviders(providers) {
  const fromPool = Array.isArray(providers) && providers.length > 0 && providers[0]._fromPool;
  if (fromPool) {
    try {
      for (const p of providers) {
        if (p._poolId && p.model) {
          await prisma.aIModelConfig.update({ where: { id: p._poolId }, data: { modelName: p.model } });
        }
      }
    } catch (e) {
      console.warn('[AI Client] save platform pool models failed:', e.message);
    }
    return;
  }
  await prisma.setting.upsert({
    where: { userId_key: { userId: USER_ID, key: "ai_providers" } },
    create: { userId: USER_ID, key: "ai_providers", value: encrypt(JSON.stringify(providers)) },
    update: { value: encrypt(JSON.stringify(providers)) },
  });
}

/**
 * 获取当前激活的 provider
 */
export async function getActiveProvider() {
  const providers = await getProviders();
  const activeIdSetting = await prisma.setting.findUnique({
    where: { userId_key: { userId: USER_ID, key: "ai_active_id" } },
  });
  const activeId = activeIdSetting?.value;
  if (!activeId) {
    return providers.find((p) => p.isDefault) || providers[0] || null;
  }
  return providers.find((p) => p.id === activeId) || providers[0] || null;
}

/**
 * 按 id 获取指定 provider（用于按模型路由到不同供应商）
 */
export async function getProviderById(id) {
  if (!id) return null;
  const providers = await getProviders();
  return providers.find((p) => p.id === id) || null;
}

/**
 * 创建 OpenAI client 实例
 */
async function createClient(provider, timeout = DEFAULT_TIMEOUT_MS) {
  const OpenAI = await getOpenAI();
  if (!OpenAI) {
    throw new Error("openai npm 包不可用，请检查安装");
  }
  if (!provider || !provider.apiKey) {
    throw new Error("未配置 AI 模型，请先在设置中添加并激活一个 AI 模型");
  }
  return new OpenAI({
    apiKey: provider.apiKey,
    baseURL: provider.baseUrl || undefined,
    timeout,
  });
}

/**
 * 查询 provider 支持的模型 id 列表（GET /models）
 */
async function listProviderModels(provider, timeout = 8000) {
  try {
    const client = await createClient(provider, timeout);
    const resp = await client.models.list();
    const ids = [];
    for (const m of resp.data || []) {
      if (m && m.id) ids.push(m.id);
    }
    return ids;
  } catch (e) {
    console.warn("[AI Client] listProviderModels failed:", e.message);
    return [];
  }
}

/**
 * 为 provider 挑选一个工作模型：
 * 1) 优先使用 provider.model（如有效）
 * 2) 无效则从 /models 返回列表里挑：先找带 flash/lite/mini/small 的快模型，否则第一个
 * 3) 如果 provider.model 失效且找到新模型，自动持久化更新配置
 * Returns { model, fixed: boolean }  fixed=true 表示做了自动修复
 */
async function resolveWorkingModel(provider, opts = {}) {
  if (!provider) throw new Error("未配置 AI 模型");

  // 先试缓存
  const cacheKey = provider.id + (opts.preferLite ? ":lite" : "");
  if (_modelCache.has(cacheKey)) {
    const cached = _modelCache.get(cacheKey);
    if (cached && typeof cached.then !== "function") {
      return { model: cached, fixed: false };
    }
  }

  const pending = (async () => {
    const baseUrl = provider.baseUrl || "";
    const isDeepSeek = baseUrl.includes("deepseek") || provider.provider === "deepseek";
    const isDoubao = baseUrl.includes("volces") || baseUrl.includes("doubao") || provider.provider === "doubao";
    const isOpenAI = baseUrl.includes("openai") || provider.provider === "openai" || provider.provider === "gpt";

    // 已知下线模型 → 对应推荐替代（避免等一次失败才发现）
    const KNOWN_DEPRECATED = {
      "deepseek-chat": { deepseek: "deepseek-v4-flash" },
      "deepseek-reasoner": { deepseek: "deepseek-v4-pro" },
      "gpt-3.5-turbo": { openai: "gpt-4o-mini" },
      "doubao-seed-2-0-code": { doubao: "doubao-seed-2-1-turbo" },
      "doubao-seed-2-0-pro": { doubao: "doubao-seed-2-1-turbo" },
    };

    let desiredModel = opts.preferLite ? null : provider.model;
    // 对于 lite 需求，优先选快模型；无显式 model 时用默认策略
    if (opts.preferLite) {
      desiredModel = null; // 让自动选择逻辑处理
    }

    // 如果当前配置的模型已知下线，直接切
    let modelIsDeprecated = false;
    if (desiredModel && KNOWN_DEPRECATED[desiredModel]) {
      const map = KNOWN_DEPRECATED[desiredModel];
      if ((isDeepSeek && map.deepseek) || (isOpenAI && map.openai) || (isDoubao && map.doubao)) {
        desiredModel = (isDeepSeek && map.deepseek) || (isOpenAI && map.openAI) || (isDoubao && map.doubao) || desiredModel;
        modelIsDeprecated = true;
      }
    }

    // 向 provider 查询真实可用模型列表
    const available = await listProviderModels(provider);
    let picked = null;

    if (desiredModel && available.includes(desiredModel)) {
      picked = desiredModel;
    } else if (desiredModel && !available.length) {
      // /models 查询失败（部分供应商不开放），只能信任 desiredModel
      picked = desiredModel;
    } else {
      // 从 available 里选
      const pickByKeyword = (kws) => {
        for (const kw of kws) {
          const found = available.find((m) => m.toLowerCase().includes(kw));
          if (found) return found;
        }
        return null;
      };
      if (opts.preferLite) {
        picked =
          pickByKeyword(["flash", "lite", "mini", "small", "haiku", "nano", "speed", "fast"]) ||
          (isDeepSeek && available.find((m) => m.includes("flash"))) ||
          (isDoubao && available.find((m) => m.includes("lite"))) ||
          available[0] ||
          desiredModel;
      } else {
        picked =
          pickByKeyword(["pro", "max", "large", "opus", "sonnet", "4o", "turbo", "premium"]) ||
          available[0] ||
          desiredModel;
      }
    }

    // 如果检测到模型下线，自动持久化修复
    let fixed = false;
    const oldModel = provider.model;
    if (picked && picked !== oldModel && (modelIsDeprecated || !available.includes(oldModel))) {
      try {
        // 更新内存里的 provider
        provider.model = picked;
        // 持久化到数据库（只修一次，避免并发重复写）
        if (!_fixedIds.has(provider.id + ":" + cacheKey)) {
          _fixedIds.add(provider.id + ":" + cacheKey);
          const providers = await getProviders();
          const target = providers.find((p) => p.id === provider.id);
          if (target && target.model !== picked) {
            target.model = picked;
            await saveProviders(providers);
            fixed = true;
            console.log(
              `[AI Client] Auto-fixed model for ${provider.name || provider.id}: ${oldModel} -> ${picked}`
            );
          }
        }
      } catch (e) {
        console.warn("[AI Client] auto-persist fixed model failed:", e.message);
      }
    }

    return { model: picked, fixed };
  })();

  _modelCache.set(cacheKey, pending);
  try {
    const res = await pending;
    _modelCache.set(cacheKey, res.model);
    return res;
  } catch (e) {
    _modelCache.delete(cacheKey);
    throw e;
  }
}

/**
 * 错误信息是否表示"模型名无效/下线"
 */
function isModelInvalidError(err) {
  const msg = (err?.message || err?.error?.message || "") + "";
  if (!msg) return false;
  const patterns = [
    /model.*(not exist|doesn't exist|not found|invalid|not support|supported|deprecated|unavailable)/i,
    /The model.*(does not exist|is not supported|is deprecated)/i,
    /invalid_request_error/i,
  ];
  return patterns.some((re) => re.test(msg));
}

/**
 * 统一的 chat completion 调用
 * @param {Array} messages - [{role, content}]
 * @param {Object} options - { model, temperature, max_tokens, provider, timeout, useLite }
 */
export async function chatComplete(messages, options = {}) {
  let provider = options.provider || (await getActiveProvider());
  if (!provider) {
    throw new Error("未配置 AI 模型，请先在设置中添加并激活一个 AI 模型");
  }
  const timeout = options.timeout || DEFAULT_TIMEOUT_MS;
  
  // Track which providers we've tried already
  const triedProviders = new Set();
  const originalProvider = provider;
  let lastError = null;

  while (provider) {
    // 【换家重试 2026-09-02】格式异常重试时跳过指定 provider，避免同一家模型再次失败
    if (options.skipProviderId && provider.id === options.skipProviderId) {
      console.warn(`[AI Client] skip provider ${provider.id} (skipProviderId), trying fallback...`);
      const candidates = await getFallbackCandidates(provider);
      provider = candidates.find((c) => !triedProviders.has(c.id)) || null;
      if (!provider) break;
      continue;
    }
    triedProviders.add(provider.id);
    const client = await createClient(provider, timeout);

    // 解析工作模型
    const { model: resolvedModel } = await resolveWorkingModel(provider, {
      preferLite: !!options.useLite,
    });
    let model = options.model || resolvedModel;

    const params = {
      model,
      messages,
      temperature: options.temperature ?? 0.7,
    };
    if (options.max_tokens || options.maxTokens) {
      params.max_tokens = options.max_tokens || options.maxTokens;
    }

    try {
      const response = await client.chat.completions.create(params, options.signal ? { signal: options.signal } : undefined); // 【终止按钮】透传 AbortSignal
      const _c0 = response.choices?.[0]?.message?.content || "";
      if (!_c0.trim()) {
        // 【空响应修复 2026-09-02】provider 返回空 content（finish=length），视为 provider 级错误触发 fallback
        throw new Error(`AI provider ${provider.name || provider.id} returned empty content (finish=${response.choices?.[0]?.finish_reason || 'unknown'})`);
      }
      return _c0;
    } catch (err) {
      lastError = err;

      // 【终止按钮】客户端已中止：直接抛出，不做模型恢复/provider fallback
      if (options.signal?.aborted || err?.name === 'APIUserAbortError' || err?.name === 'AbortError') {
        throw err;
      }

      // 模型失效 → 同 provider 内重试
      if (isModelInvalidError(err)) {
        console.warn("[AI Client] model invalid, attempting auto-recovery:", err.message);
        _modelCache.delete(provider.id);
        _modelCache.delete(provider.id + ":lite");
        _fixedIds.delete(provider.id);
        _fixedIds.delete(provider.id + ":lite");
        const { model: fixedModel } = await resolveWorkingModel(provider, {
          preferLite: !!options.useLite,
        });
        params.model = fixedModel;
        try {
          const response = await client.chat.completions.create(params, options.signal ? { signal: options.signal } : undefined); // 【终止按钮】透传 AbortSignal
          console.log(`[AI Client] auto-recovered with model ${fixedModel}`);
          const _c1 = response.choices?.[0]?.message?.content || "";
          if (!_c1.trim()) {
            // 【空响应修复 2026-09-02】auto-recovered 仍返回空，抛 provider 级错误继续 fallback
            throw new Error(`AI provider ${provider.name || provider.id} auto-recovered but returned empty content`);
          }
          return _c1;
        } catch (e2) {
          console.error("[AI Client] auto-recovery failed:", e2.message);
          lastError = e2;
          // 继续走 provider 级 fallback
        }
      }

      // Provider 级错误 → 尝试下一个 fallback
      if (isProviderError(err) || isModelInvalidError(err)) {
        console.warn(`[AI Client] provider ${provider.name || provider.id} failed: ${err.message}, trying fallback...`);
        const candidates = await getFallbackCandidates(provider);
        provider = candidates.find((c) => !triedProviders.has(c.id)) || null;
        
        if (provider) {
          // 记录 fallback 次数
          const hits = (_fallbackHits.get(originalProvider.id) || 0) + 1;
          _fallbackHits.set(originalProvider.id, hits);
          
          console.log(`[AI Client] falling back to ${provider.name || provider.id} (${provider.model})`);
          // 【修复 2026-08-26】fallback 到新 provider 后必须重置显式模型名，
          // 否则会把原 provider 的模型名(如 gpt-5.6-terra)发给新 provider(如 DeepSeek)导致 400
          options.model = undefined;
          
          // 达到阈值 → 自动切换激活 provider
          if (hits >= FALLBACK_SWITCH_THRESHOLD) {
            await autoSwitchActiveProvider(provider.id);
            _fallbackHits.set(originalProvider.id, 0); // reset
          }
          continue;
        }
      }
      
      // 所有 provider 都试过了，抛出最后的错误
      throw err;
    }
  }

  throw lastError || new Error("All AI providers failed");
}

/**
 * 轻量快速 chat completion（自动选 provider 的快模型，短超时，短输出）
 * 适合翻译/语言检测等追求速度的场景
 */
export async function chatCompleteLite(messages, options = {}) {
  return chatComplete(messages, {
    ...options,
    useLite: true,
    timeout: options.timeout || DEFAULT_TIMEOUT_MS,
    max_tokens: options.max_tokens || options.maxTokens || 256,
    temperature: options.temperature ?? 0.1,
  });
}

/**
 * 调用视觉模型分析图片内容（使用 GPT-4o-mini 或任何支持 vision 的 provider）
 * @param {Array} images - [{base64, mimeType, filename}]
 * @param {string} question - 可选的提问
 * @returns {string} 图片描述
 */
export async function analyzeImageWithVision(images, question) {
  const providers = await getProviders();
  const active = providers.filter(p => p.active !== false);
  if (!active.length) throw new Error('没有可用的 AI 模型来分析图片');

  // 优先级排序：GPT-4o/GPT系列 > OpenAI baseUrl > 其他
  const priority = (p) => {
    const m = (p.model || '').toLowerCase();
    const n = (p.name || '').toLowerCase();
    const u = (p.baseUrl || '').toLowerCase();
    if (m.includes('4o') || n.includes('gpt')) return 0;
    if (u.includes('openai') || p.provider === 'openai') return 1;
    return 2;
  };
  const ordered = [...active].sort((a, b) => priority(a) - priority(b));

  const content = [];
  if (question) content.push({ type: 'text', text: question });
  for (const img of images) {
    content.push({
      type: 'image_url',
      image_url: { url: `data:${img.mimeType};base64,${img.base64}` }
    });
  }

  // 按优先级尝试每个 provider，第一个成功的就用
  let lastErr = null;
  for (const visionProvider of ordered) {
    try {
      const client = await createClient(visionProvider, 30000);
      const model = visionProvider.model || 'gpt-4o-mini';
      const response = await client.chat.completions.create({
        model,
        messages: [{ role: 'user', content }],
        max_tokens: 1000,
        temperature: 0.3,
      });
      const result = response.choices?.[0]?.message?.content || '';
      if (result) {
        console.log(`[Vision] success with provider: ${visionProvider.name || visionProvider.id} (model: ${model})`);
        return result;
      }
    } catch (err) {
      lastErr = err;
      console.warn(`[Vision] provider ${visionProvider.name || visionProvider.id} failed: ${err.message}, trying next...`);
      continue;
    }
  }
  throw lastErr || new Error('所有 AI 模型都无法分析图片');
}

/**
 * 测试某个 provider 的连接
 */
export async function testConnection(providerConfig) {
  try {
    // 先尝试解析模型（会触发 /models 探测 + 自动修复）
    const { model } = await resolveWorkingModel(providerConfig);
    const client = await createClient(providerConfig, DEFAULT_TIMEOUT_MS);
    const response = await client.chat.completions.create({
      model,
      messages: [{ role: "user", content: "Hi" }],
      max_tokens: 5,
      temperature: 0,
    });
    return {
      success: true,
      message: "连接成功（模型: " + model + "）",
      response: response.choices?.[0]?.message?.content || "",
    };
  } catch (err) {
    return {
      success: false,
      message: "连接失败: " + (err.message || "未知错误"),
    };
  }
}
