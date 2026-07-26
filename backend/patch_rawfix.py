#!/usr/bin/env python3
"""修复 ai-requirement 路由：raw未定义bug——补上chatComplete调用+fallback+DB更新逻辑"""
import re

path = '/opt/whatsapp-crm/backend/src/routes/customers.js'
with open(path, 'r', encoding='utf-8') as f:
    src = f.read()

# 找到损坏的块：从"const userPrompt = knownInfo + ...分析报告：`;" 之后 到 "const result = { summary: mdText, raw };"
# 替换为正确的：声明raw -> try DOUBAO_LITE -> fallback default -> parse mdText -> update DB -> return result

old_block = """    const userPrompt = knownInfo + `聊天记录（最近${messages.length}条，按时间顺序）：\\n${context}\\n\\n请输出Markdown格式分析报告：`;

    let mdText = (raw || '').trim();
    // 清理markdown代码块包裹
    mdText = mdText.replace(/^```(?:markdown|md)?\\s*/i, '').replace(/\\s*```$/, '');
    // 如果AI错误返回了JSON，尝试提取
    try {
      const mj = mdText.match(/\\{[\\s\\S]*\\}/);
      if (mj && mdText.trim().startsWith('{')) {
        const parsed = JSON.parse(mj[0]);
        if (parsed.summary && typeof parsed.summary === 'string') mdText = parsed.summary;
      }
    } catch (_) {}
    mdText = mdText.slice(0, 4000);
    const result = { summary: mdText, raw };
  } catch (err) {
    console.error('[Customers] ai-requirement error:', err);
    res.status(500).json({ error: 'AI需求总结失败: ' + err.message });
  }
});"""

new_block = """    const userPrompt = knownInfo + `聊天记录（最近${messages.length}条，按时间顺序）：\\n${context}\\n\\n请输出Markdown格式分析报告：`;

    // 调用AI：先用豆包Lite快速，失败fallback到默认模型
    let raw;
    try {
      raw = await chatComplete(DOUBAO_LITE_MODEL, systemPrompt, userPrompt, { temperature: 0.3, maxTokens: 2500, timeout: 90000 });
    } catch (e1) {
      console.warn('[Customers] ai-requirement DOUBAO_LITE failed, fallback to default:', e1.message);
      raw = await chatComplete(defaultModel, systemPrompt, userPrompt, { temperature: 0.3, maxTokens: 2500, timeout: 90000 });
    }

    let mdText = (raw || '').trim();
    // 清理markdown代码块包裹
    mdText = mdText.replace(/^```(?:markdown|md)?\\s*/i, '').replace(/\\s*```$/, '');
    // 如果AI错误返回了JSON，尝试提取
    try {
      const mj = mdText.match(/\\{[\\s\\S]*\\}/);
      if (mj && mdText.trim().startsWith('{')) {
        const parsed = JSON.parse(mj[0]);
        if (parsed.summary && typeof parsed.summary === 'string') mdText = parsed.summary;
      }
    } catch (_) {}
    mdText = mdText.slice(0, 4000);

    // 更新客户需求总结字段
    await prisma.customer.update({
      where: { id },
      data: {
        requirementSummary: mdText,
        requirementSource: 'ai',
        requirementUpdatedAt: new Date(),
      },
    });

    res.json({ summary: mdText, raw });
  } catch (err) {
    console.error('[Customers] ai-requirement error:', err);
    res.status(500).json({ error: 'AI需求总结失败: ' + err.message });
  }
});"""

assert old_block in src, "old_block NOT FOUND in file!"
src = src.replace(old_block, new_block, 1)

with open(path, 'w', encoding='utf-8') as f:
    f.write(src)

print("PATCH OK - ai-requirement fixed (chatComplete + fallback + DB update restored)")
