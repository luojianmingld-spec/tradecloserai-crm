#!/usr/bin/env python3
"""
客户需求分析卡片化升级：
1. 后端prompt改为JSON结构输出（8板块有明确icon/标题/内容），避免Markdown # / | 显示问题
2. 前端拿到JSON后直接渲染成混元风格卡片：每个板块独立圆角深色卡片+icon+标题+内容
3. 表格部分把JSON数组直接渲染成表格
4. 列表也JSON化，避免符号
"""
import json

# ============== 1. 后端：改prompt，要求输出JSON结构化 ==============
back_path = '/opt/whatsapp-crm/backend/src/routes/customers.js'
with open(back_path, 'r', encoding='utf-8') as f:
    back = f.read()

old_sys_prompt_start = 'const systemPrompt = `你是资深外贸B2B销售分析师。基于客户档案和WhatsApp聊天记录，生成一份结构化的客户需求分析报告，用中文输出。'
old_sys_prompt_end = '6. 适配手机阅读，表格列数不超过3列`;'

# 找位置
si = back.find(old_sys_prompt_start)
assert si != -1, "sys prompt start not found"
ei = back.find(old_sys_prompt_end, si)
assert ei != -1, "sys prompt end not found"
ei += len(old_sys_prompt_end)

new_system_prompt = r'''const systemPrompt = `你是资深外贸B2B销售分析师。基于客户档案和WhatsApp聊天记录，生成一份结构化的客户需求分析报告。

【重要】必须输出严格的JSON，不要任何markdown标记、不要代码块包裹、不要解释文字。JSON结构如下：
{
  "title": "客户需求分析",
  "sections": [
    {
      "icon": "👤",
      "title": "客户基本信息",
      "type": "table",
      "rows": [{"label":"客户名称","value":"xxx"},{"label":"公司","value":"xxx"},{"label":"国家/地区","value":"xxx（推测/待确认）"},{"label":"职位/角色","value":"xxx"},{"label":"网站","value":"xxx"}]
    },
    {
      "icon": "📦",
      "title": "产品需求明细",
      "type": "table",
      "rows": [{"label":"产品类型","value":"xxx"},{"label":"规格参数","value":"xxx"},{"label":"包装要求","value":"xxx"},{"label":"认证/质量要求","value":"xxx"}]
    },
    {
      "icon": "📊",
      "title": "采购规模",
      "type": "table",
      "rows": [{"label":"采购量/频次","value":"xxx"},{"label":"订单性质","value":"xxx（试单/长期/一次性）"},{"label":"时间紧迫度","value":"xxx"}]
    },
    {
      "icon": "💼",
      "title": "商务条件",
      "type": "table",
      "rows": [{"label":"目标价/预算","value":"xxx"},{"label":"付款方式","value":"xxx"},{"label":"贸易条款","value":"xxx（FOB/CIF等）"},{"label":"起订量","value":"xxx"},{"label":"交期要求","value":"xxx"}]
    },
    {
      "icon": "🎯",
      "title": "客户画像",
      "type": "table",
      "rows": [{"label":"专业性/行业经验","value":"xxx"},{"label":"采购规模评级","value":"xxx"},{"label":"价格敏感度","value":"xxx"},{"label":"合作意向度","value":"高/中/低"},{"label":"谈判风格","value":"xxx"},{"label":"决策角色","value":"xxx"}]
    },
    {
      "icon": "⚠️",
      "title": "核心问题与风险",
      "type": "list",
      "items": ["风险点1：简短说明", "风险点2：简短说明"]
    },
    {
      "icon": "💡",
      "title": "建议跟进策略",
      "type": "list",
      "items": ["**策略1标题**：简短可执行说明", "**策略2标题**：简短可执行说明"]
    },
    {
      "icon": "❓",
      "title": "待确认事项",
      "type": "list",
      "items": ["问题1", "问题2"]
    }
  ]
}

填充规则：
1. 所有信息必须来自聊天记录或客户档案，严禁编造
2. 未提及的字段value直接填"未提及"，推测的标注"（推测）"，未知的填"待确认"
3. list板块items控制在2-5条，每条简短务实
4. 建议跟进策略每条用"**粗体关键词**：具体行动"格式（前端会自动加粗**之间**的文字）
5. 如果聊天全是测试消息/无实质业务，sections只保留一个板块：{"icon":"ℹ️","title":"提示","type":"text","content":"暂无可识别的采购需求，建议先与客户建立沟通。"}
6. 严格输出JSON，不要任何额外文字`;'''

back = back[:si] + new_system_prompt + back[ei:]

# 再修改parse逻辑：不再当Markdown处理，直接parse JSON
old_parse = """    let mdText = (raw || '').trim();
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

    res.json({ summary: mdText, raw });"""

new_parse = r"""    let rawText = (raw || '').trim();
    // 清理可能的markdown代码块包裹
    rawText = rawText.replace(/^```(?:json|markdown|md)?\s*/i, '').replace(/\s*```$/, '');
    // 尝试解析JSON（首选AI返回的结构化数据）
    let analysisData;
    try {
      // 找到第一个{和最后一个}之间的内容
      const firstBrace = rawText.indexOf('{');
      const lastBrace = rawText.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        analysisData = JSON.parse(rawText.slice(firstBrace, lastBrace + 1));
      }
    } catch (e) {
      console.warn('[Customers] ai-requirement JSON parse failed, fallback to raw text:', e.message);
    }
    // 如果解析失败，包装成简单文本块
    if (!analysisData || !analysisData.sections) {
      analysisData = {
        title: '客户需求分析',
        sections: [{ icon: '📝', title: 'AI分析', type: 'text', content: rawText.slice(0, 2000) }]
      };
    }
    // 存一份JSON字符串到summary字段（前端解析渲染）
    const summaryJson = JSON.stringify(analysisData);

    await prisma.customer.update({
      where: { id },
      data: {
        requirementSummary: summaryJson,
        requirementSource: 'ai',
        requirementUpdatedAt: new Date(),
      },
    });

    res.json({ summary: summaryJson, structured: true, raw });"""

assert old_parse in back, "old parse block not found"
back = back.replace(old_parse, new_parse, 1)

# 同时改userPrompt最后一句
back = back.replace(
    "请输出Markdown格式分析报告：",
    "请输出符合system要求的JSON："
)

with open(back_path, 'w', encoding='utf-8') as f:
    f.write(back)
print("BACKEND PATCH OK")
