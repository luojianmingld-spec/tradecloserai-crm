/**
 * AI Client - 统一AI服务
 * 使用 openai npm 包调用各种 LLM 提供商
 * 从 Settings 表读取当前激活的 provider 配置
 * v2: 模型下线自动检测 + 自动替换 + 智能 fallback
 */
import { PrismaClient } from "@prisma/client";

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
 */
export async function getProviders() {
  const setting = await prisma.setting.findUnique({
    where: { userId_key: { userId: USER_ID, key: "ai_providers" } },
  });
  if (!setting || !setting.value) return [];
  try {
    return JSON.parse(setting.value);
  } catch {
    return [];
  }
}

/**
 * 保存所有 provider 配置
 */
async function saveProviders(providers) {
  await prisma.setting.upsert({
    where: { userId_key: { userId: USER_ID, key: "ai_providers" } },
    create: { userId: USER_ID, key: "ai_providers", value: JSON.stringify(providers) },
    update: { value: JSON.stringify(providers) },
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
  const provider = options.provider || (await getActiveProvider());
  if (!provider) {
    throw new Error("未配置 AI 模型，请先在设置中添加并激活一个 AI 模型");
  }
  const timeout = options.timeout || DEFAULT_TIMEOUT_MS;
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
    const response = await client.chat.completions.create(params);
    return response.choices?.[0]?.message?.content || "";
  } catch (err) {
    // 模型失效 → 清缓存重试一次（让 resolveWorkingModel 重新选）
    if (isModelInvalidError(err)) {
      console.warn("[AI Client] model invalid, attempting auto-recovery:", err.message);
      _modelCache.delete(provider.id);
      _modelCache.delete(provider.id + ":lite");
      _fixedIds.delete(provider.id);
      _fixedIds.delete(provider.id + ":lite");
      const { model: fixedModel } = await resolveWorkingModel(provider, {
        preferLite: !!options.useLite,
      });
      // 再试一次
      params.model = fixedModel;
      try {
        const response = await client.chat.completions.create(params);
        console.log(`[AI Client] auto-recovered with model ${fixedModel}`);
        return response.choices?.[0]?.message?.content || "";
      } catch (e2) {
        console.error("[AI Client] auto-recovery failed:", e2.message);
        throw e2;
      }
    }
    throw err;
  }
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
  // 优先找 GPT-4o 系列（支持 vision）
  let visionProvider = providers.find(p => 
    (p.model || '').toLowerCase().includes('4o') || 
    (p.name || '').toLowerCase().includes('gpt')
  );
  // fallback: 找 OpenAI provider
  if (!visionProvider) {
    visionProvider = providers.find(p => 
      (p.baseUrl || '').includes('openai') || p.provider === 'openai'
    );
  }
  // fallback: 任何 provider
  if (!visionProvider) {
    visionProvider = providers.find(p => p.active !== false) || providers[0];
  }
  if (!visionProvider) throw new Error('没有可用的 AI 模型来分析图片');

  const client = await createClient(visionProvider, 30000);
  const model = visionProvider.model || 'gpt-4o-mini';

  const content = [];
  if (question) {
    content.push({ type: 'text', text: question });
  }
  for (const img of images) {
    content.push({
      type: 'image_url',
      image_url: { url: `data:${img.mimeType};base64,${img.base64}` }
    });
  }

  const response = await client.chat.completions.create({
    model,
    messages: [{ role: 'user', content }],
    max_tokens: 1000,
    temperature: 0.3,
  });
  return response.choices?.[0]?.message?.content || '';
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
