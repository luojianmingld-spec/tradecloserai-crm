#!/usr/bin/env python3
"""修复defaultModel未定义：在try前声明const defaultModel = await resolveModelId()"""
path = '/opt/whatsapp-crm/backend/src/routes/customers.js'
with open(path, 'r', encoding='utf-8') as f:
    src = f.read()

old = """    // 调用AI：先用豆包Lite快速，失败fallback到默认模型
    let raw;
    try {
      raw = await chatComplete(DOUBAO_LITE_MODEL, systemPrompt, userPrompt, { temperature: 0.3, maxTokens: 2500, timeout: 90000 });
    } catch (e1) {
      console.warn('[Customers] ai-requirement DOUBAO_LITE failed, fallback to default:', e1.message);
      raw = await chatComplete(defaultModel, systemPrompt, userPrompt, { temperature: 0.3, maxTokens: 2500, timeout: 90000 });
    }"""
new = """    // 调用AI：先用豆包Lite快速，失败fallback到默认模型
    const defaultModel = await resolveModelId();
    let raw;
    try {
      raw = await chatComplete(DOUBAO_LITE_MODEL, systemPrompt, userPrompt, { temperature: 0.3, maxTokens: 2500, timeout: 90000 });
    } catch (e1) {
      console.warn('[Customers] ai-requirement DOUBAO_LITE failed, fallback to default:', e1.message);
      raw = await chatComplete(defaultModel, systemPrompt, userPrompt, { temperature: 0.3, maxTokens: 2500, timeout: 90000 });
    }"""
assert old in src, "not found"
src = src.replace(old, new, 1)
with open(path, 'w', encoding='utf-8') as f:
    f.write(src)
print("PATCH OK")
