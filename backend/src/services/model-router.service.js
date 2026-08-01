/**
 * Model Router Service - 智能模型路由
 * 根据任务类型自动选择最合适的模型，支持自动降级
 */
import { getProviders, getProviderById, getActiveProvider } from './ai-client.js';

// -- 路由规则配置 --
const ROUTE_TABLE = {
  'reply-generation': {
    primary: 'deepseek-v4-flash',
    fallback: 'deepseek-v4-flash',
    description: '话术生成',
  },
  'attitude-analysis': {
    primary: 'deepseek-reasoner',
    fallback: 'deepseek-v4-flash',
    description: '客户态度分析',
  },
  'inquiry-analysis': {
    primary: 'deepseek-v4-flash',
    fallback: 'deepseek-v4-flash',
    description: '询盘深度分析',
  },
  'translation': {
    primary: 'deepseek-v4-flash',
    fallback: 'doubao-lite',
    description: '翻译',
  },
  'background-check': {
    primary: 'gpt-4o-mini',
    fallback: 'deepseek-v4-flash',
    description: '客户背调',
  },
  'copilot-chat': {
    primary: 'deepseek-v4-flash',
    fallback: 'deepseek-v4-flash',
    description: 'Copilot对话',
  },
  'speech-scoring': {
    primary: 'deepseek-v4-flash',
    fallback: 'doubao-lite',
    description: '话术评分',
  },
  'doc-generation': {
    primary: 'deepseek-v4-flash',
    fallback: 'deepseek-v4-flash',
    description: '文档生成',
  },
};

const MODEL_NAME_MAP = {
  'deepseek-v4-flash': 'deepseek',
  'deepseek-reasoner': 'deepseek',
  'deepseek-v4-flash': 'deepseek',
  'doubao-lite': 'doubao',
  'doubao-pro': 'doubao',
  'gpt-4o-mini': 'openai',
};

let _providerCache = null;
let _cacheTime = 0;
const CACHE_TTL = 60000;

async function getCachedProviders() {
  const now = Date.now();
  if (_providerCache && (now - _cacheTime) < CACHE_TTL) {
    return _providerCache;
  }
  _providerCache = await getProviders();
  _cacheTime = now;
  return _providerCache;
}

async function findProviderForModel(modelName) {
  const providers = await getCachedProviders();
  
  // 1. exact match
  const exact = providers.find(p => p.model === modelName && p.apiKey);
  if (exact) return { ...exact };
  
  // 2. provider type match
  const providerType = MODEL_NAME_MAP[modelName];
  if (providerType) {
    const byType = providers.find(p => p.provider === providerType && p.apiKey);
    if (byType) return { ...byType, model: modelName };
  }
  
  // 3. fuzzy match
  const fuzzy = providers.find(p => 
    (p.model && modelName && (p.model.includes(modelName) || modelName.includes(p.model)))
  );
  if (fuzzy) return { ...fuzzy };
  
  return null;
}

export async function getModelForTask(taskType) {
  const route = ROUTE_TABLE[taskType];
  if (!route) {
    console.warn('[ModelRouter] Unknown task type: ' + taskType + ', using fallback');
    const active = await getActiveProvider();
    return {
      provider: active,
      model: active?.model || 'deepseek-v4-flash',
      taskType: taskType,
    };
  }
  
  // Try primary
  try {
    const primary = await findProviderForModel(route.primary);
    if (primary) {
      console.log('[ModelRouter] ' + route.description + ' -> ' + route.primary + ' (primary)');
      return {
        provider: { ...primary, model: route.primary },
        model: route.primary,
        taskType: taskType,
      };
    }
  } catch (e) {
    console.warn('[ModelRouter] Primary model ' + route.primary + ' failed: ' + e.message);
  }
  
  // Try fallback
  try {
    const fb = await findProviderForModel(route.fallback);
    if (fb) {
      console.log('[ModelRouter] ' + route.description + ' -> ' + route.fallback + ' (fallback)');
      return {
        provider: fb,
        model: route.fallback,
        taskType: taskType,
      };
    }
  } catch (e) {
    console.warn('[ModelRouter] Fallback model ' + route.fallback + ' failed: ' + e.message);
  }
  
  const active = await getActiveProvider();
  console.warn('[ModelRouter] All models failed for ' + taskType + ', using active provider');
  return {
    provider: active,
    model: active?.model || 'deepseek-v4-flash',
    taskType: taskType,
  };
}

export async function chatCompleteWithRouting(taskType, messages, options = {}) {
  const { provider, model } = await getModelForTask(taskType);
  const { chatComplete } = await import('./ai-client.js');
  
  try {
    const result = await chatComplete(messages, {
      model,
      provider,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 4096,
      timeout: options.timeout ?? 90000,
      ...options,
    });
    return result;
  } catch (err) {
    console.error('[ModelRouter] Call failed for ' + taskType + ' with ' + model + ': ' + err.message);
    
    const route = ROUTE_TABLE[taskType];
    if (route && model === route.primary) {
      console.log('[ModelRouter] Retrying with fallback: ' + route.fallback);
      const fallback = await findProviderForModel(route.fallback);
      if (fallback) {
        return chatComplete(messages, {
          model: route.fallback,
          provider: fallback,
          temperature: options.temperature ?? 0.7,
          max_tokens: options.maxTokens ?? 4096,
          timeout: options.timeout ?? 90000,
          ...options,
        });
      }
    }
    throw err;
  }
}

export function getRouteTable() {
  return { ...ROUTE_TABLE };
}

export function clearProviderCache() {
  _providerCache = null;
  _cacheTime = 0;
}
