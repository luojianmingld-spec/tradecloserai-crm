import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { chatComplete, analyzeImageWithVision } from './ai-client.js';
import { generateStructuredPDF, generateQuotePDF } from './pdf-generator.js';

const prisma = new PrismaClient();

// Agent可调用的工具定义
const TOOLS = [
  {
    name: 'query_customer',
    description: '查询客户信息，包括客户名称、联系方式、公司、阶段等',
    parameters: {
      customerName: '客户名称（模糊匹配，可选）',
      jid: 'WhatsApp JID（可选）'
    },
    needConfirm: false
  },
  {
    name: 'query_orders',
    description: '查询客户的订单列表',
    parameters: {
      customerId: '客户ID（必填）'
    },
    needConfirm: false
  },
  {
    name: 'query_messages',
    description: '查询和客户的历史对话消息',
    parameters: {
      jid: '客户WhatsApp JID（必填）',
      limit: '返回消息数量（可选，默认20）'
    },
    needConfirm: false
  },
  {
    name: 'send_message',
    description: '发送WhatsApp消息给客户',
    parameters: {
      jid: '客户WhatsApp JID（必填）',
      message: '消息内容（必填）'
    },
    needConfirm: true
  },
  {
    name: 'update_customer_status',
    description: '更新客户阶段状态',
    parameters: {
      customerId: '客户ID（必填）',
      stage: '客户阶段（必填，可选值：lead/contacted/qualified/proposal/negotiation/won/lost）'
    },
    needConfirm: true
  },
  {
    name: 'add_follow_up',
    description: '添加客户跟进记录',
    parameters: {
      customerId: '客户ID（必填）',
      note: '跟进内容（必填）',
      followUpDate: '下次跟进日期（YYYY-MM-DD，可选）'
    },
    needConfirm: false
  },
  {
    name: 'generate_document',
    description: '生成PDF文档（报价单、产品目录、备忘录等）。当用户要求生成PDF、报价单、PI、产品说明文档时调用此工具。',
    parameters: {
      docType: '文档类型（必填）。quote=报价单, PI=形式发票, CI=商业发票, contract=合同, customs=报关单, catalog=产品目录, general=通用文档',
      title: '文档标题（必填）',
      subtitle: '副标题/日期说明（可选）',
      content: '文档正文内容，支持Markdown格式（通用文档时必填）',
      customerName: '客户名称（报价单/PI时必填）',
      customerContact: '客户联系人（可选）',
      customerEmail: '客户邮箱（可选）',
      items: '产品列表JSON字符串，格式：[{\"name\":\"产品名\",\"spec\":\"规格\",\"qty\":数量,\"price\":单价}]（报价单/PI时必填）',
      notes: '备注说明（可选）'
    },
    needConfirm: false
  },
  {
    name: 'exchange_rate',
    description: '查询实时汇率。当用户询问汇率、货币转换、美元人民币价格时调用此工具。',
    parameters: {
      from: '源货币代码（默认USD，可选值：USD/EUR/GBP/CNY/JPY/HKD等）',
      to: '目标货币代码（默认CNY，可选值同上）',
      amount: '转换金额（默认1，可选）'
    },
    needConfirm: false
  },
  {
    name: 'query_dashboard',
    description: '查询CRM数据概览/统计信息。当用户询问今日数据、客户统计、消息统计、业绩概况时调用。',
    parameters: {},
    needConfirm: false
  },
  {
    name: 'track_topic',
    description: 'Subscribe to a topic for tracking. Use when user asks to track, follow, or monitor a topic or industry trend.',
    parameters: {
      topic: 'Topic name to track (required)',
      keywords: 'Search keywords JSON array string (optional)',
      focusAreas: 'Focus directions JSON array string (optional)',
      frequency: 'Tracking frequency: daily or weekly (optional, default daily)'
    },
    needConfirm: false
  },
  {
    name: 'list_topics',
    description: 'List all subscribed tracking topics.',
    parameters: {},
    needConfirm: false
  },
  {
    name: 'get_briefing',
    description: 'Get the latest briefing for a tracked topic.',
    parameters: {
      topic: 'Topic name (required)'
    },
    needConfirm: false
  },
  {
    name: 'web_search',
    description: '联网搜索互联网信息。用于市场分析、行业调研、竞品信息、最新动态、政策法规等需要实时信息的场景。',
    parameters: {
      query: '搜索关键词（必填）',
      topic: '搜索主题/领域（可选，如market_analysis/competitor/policy/trends）'
    },
    needConfirm: false
  }
];

// 构建工具描述（用于prompt）
const TOOLS_DESC = TOOLS.map(t => {
  const params = Object.entries(t.parameters).map(([k, v]) => `    - ${k}: ${v}`).join('\n');
  return `  - ${t.name}: ${t.description}\n    参数：\n${params}\n    需确认：${t.needConfirm ? '是' : '否'}`;
}).join('\n');

class AssistantService {
  /**
   * 处理销售发送的对话消息
   */

  /**
   * 清除Markdown符号，返回纯文本
   */
  _stripMarkdown(text) {
    if (!text) return text;
    let s = text;
    s = s.replace(/\*\*(.+?)\*\*/g, '$1');
    s = s.replace(/\*(.+?)\*/g, '$1');
    s = s.replace(/__(.+?)__/g, '$1');
    s = s.replace(/_(.+?)_/g, '$1');
    s = s.replace(/^### (.+)$/gm, '$1');
    s = s.replace(/^## (.+)$/gm, '$1');
    s = s.replace(/^# (.+)$/gm, '$1');
    s = s.replace(/^---+$/gm, '');
    s = s.replace(/^\* (.+)$/gm, '$1');
    s = s.replace(/^- (.+)$/gm, '$1');
    s = s.replace(/^\d+\. (.+)$/gm, '$1');
    s = s.replace(/`([^`]+)`/g, '$1');
    s = s.replace(/```[\s\S]*?```/g, '');
    s = s.replace(/\n{3,}/g, '\n\n');
    return s.trim();
  }


  /**
   * 判断用户消息是否是CRM任务（需要调用工具）
   */
  _isCrmTask(msg) {
    if (!msg) return false;
    const keywords = ['查', '分析', '搜索', '找', '发', '更新', '修改', '添加', '追踪', '关注', '订阅', '动态', '简报',
      '客户', '订单', '消息', '记录', '状态', '跟进', '背调', '汇总', '总结',
      '出', '报价', 'PDF', 'pi', 'ci', '生成', '文档', '发票', '目录', 'product',
      'query', 'send', 'update', 'add', 'analyze', 'generate', 'document', 'quotation',
      '汇率', 'exchange', 'rate', '概览', '统计', 'dashboard',
      '开发信', '邮件', 'email', '合同', 'contract', '报关', 'customs',
      '谈判', '建议', '策略', '市场', '竞品', '意向', '风险',
      '调研', '趋势', '行业', '报告', '政策', '关税', '网上', '搜索'];
    return keywords.some(k => msg.includes(k));
  }

  /**
   * 后端意图识别：根据用户消息判断要调用哪个工具及参数
   */
  _detectIntent(msg) {
    if (!msg) return null;
    const m = msg.toLowerCase();

    // 查所有客户 / 客户列表
    if (m.includes('所有客户') || m.includes('客户列表') || m.includes('查客户') || (m.includes('查') && m.includes('客户'))) {
      return { tool: 'query_customer', params: {} };
    }

    // 查某客户的聊天记录/消息
    if (m.includes('聊天记录') || m.includes('消息记录') || m.includes('历史消息') || (m.includes('聊天') && (m.includes('查') || m.includes('看') || m.includes('调')))) {
      // 尝试提取客户名
      let customerName = '';
      const namePatterns = [
        /分析(.+?)(?:的|客户|聊天)/,
        /查(.+?)(?:的|客户|聊天)/,
        /看(.+?)(?:的|客户|聊天)/,
        /(.+?)(?:客户)?.{0,2}(聊天记录|消息)/
      ];
      for (const p of namePatterns) {
        const match = msg.match(p);
        if (match && match[1] && match[1].length <= 10 && !['一下','所有','每个','全部','这个','那个'].includes(match[1])) {
          customerName = match[1].trim();
          break;
        }
      }
      return { tool: 'query_messages', params: { customerName, limit: 30 } };
    }

    // 查某客户信息
    if (m.includes('查') && m.includes('客户') && !m.includes('所有')) {
      let customerName = '';
      const patterns = [/查(.+?)客户/, /分析(.+?)客户/, /看(.+?)客户/, /(.+?)的信息/];
      for (const p of patterns) {
        const match = msg.match(p);
        if (match && match[1] && match[1].length <= 10) {
          customerName = match[1].trim();
          break;
        }
      }
      return { tool: 'query_customer', params: { customerName } };
    }

    // 查订单
    if (m.includes('订单') || m.includes('order')) {
      return { tool: 'query_orders', params: {} };
    }

    // 发消息
    if ((m.includes('发消息') || m.includes('发送') || m.includes('通知')) && m.includes('客户')) {
      return { tool: 'send_message', params: {} };
    }

    // 更新状态
    if (m.includes('更新') || m.includes('改') && m.includes('状态')) {
      return { tool: 'update_customer_status', params: {} };
    }

    // 添加跟进
    if (m.includes('跟进') || m.includes('添加跟进') || (m.includes('记录') && m.includes('添加'))) {
      return { tool: 'add_follow_up', params: {} };
    }

    // 生成PDF/报价单/PI
    if (m.includes('报价') || m.includes('pdf') || m.includes('pi') || m.includes('发票') ||
        m.includes('出报价') || m.includes('出份') || m.includes('出个') || m.includes('生成文档') ||
        m.includes('产品目录') || m.includes('quotation') || m.includes('proforma')) {
      return { tool: 'generate_document', params: { docType: m.includes('pi') || m.includes('发票') || m.includes('proforma') ? 'PI' : 'quote' } };
    }

    // 汇率查询
    if (m.includes('汇率') || m.includes('exchange') || m.includes('rate') ||
        ((m.includes('美元') || m.includes('美金') || m.includes('usd') || m.includes('欧元') || m.includes('eur') ||
          m.includes('人民币') || m.includes('cny') || m.includes('英鎊') || m.includes('gbp')) &&
         (m.includes('多少') || m.includes('转换') || m.includes('换') || m.includes('折算')))) {
      let from = 'USD', to = 'CNY';
      if (m.includes('欧元') || m.includes('eur')) from = 'EUR';
      else if (m.includes('英鎊') || m.includes('gbp')) from = 'GBP';
      else if (m.includes('日元') || m.includes('jpy')) from = 'JPY';
      else if (m.includes('美元') || m.includes('美金') || m.includes('usd')) from = 'USD';
      if (m.includes('美元') || m.includes('美金') || m.includes('usd')) { to = 'USD'; from = 'CNY'; }
      let amount = 1;
      const amtMatch = msg.match(/(\d+\.?\d*)\s*(?:美元|美金|usd|元|块|欧元|英鎊|日元)/i);
      if (amtMatch) amount = parseFloat(amtMatch[1]);
      return { tool: 'exchange_rate', params: { from, to, amount } };
    }

    // 数据概览/统计
    if (m.includes('概览') || m.includes('统计') || m.includes('概况') || m.includes('dashboard') ||
        (m.includes('今天') && (m.includes('数据') || m.includes('业绩'))) ||
        m.includes('客户数') || m.includes('消息数')) {
      return { tool: 'query_dashboard', params: {} };
    }

    // 市场分析/联网搜索/竞品分析
    if (m.includes('市场') || m.includes('行业') || m.includes('趋势') || m.includes('竞品') ||
        m.includes('竞争对手') || m.includes('调研') || m.includes('最新动态') || m.includes('新闻') ||
        m.includes('政策') || m.includes('关税') || m.includes('分析报告') || m.includes('网上') ||
        m.includes('搜一下') || m.includes('查一下市场') || m.includes('行业报告')) {
      // Extract search query from user message
      let searchQuery = msg;
      // Try to extract the main topic
      const topicPatterns = [
        /(?:分析|调研|搜索|查一下|搜一下|看看)(.{2,30}?)(?:的|市场|行业|情况|报告|趋势)/,
        /(.{2,20}?)(?:市场分析|行业分析|竞品分析|调研报告|发展趋势)/,
      ];
      for (const p of topicPatterns) {
        const match = msg.match(p);
        if (match && match[1]) {
          searchQuery = match[1].trim();
          break;
        }
      }
      return { tool: 'web_search', params: { query: searchQuery, topic: 'market' } };
    }

    // 发送邮件
    if ((m.includes('发邮件') || m.includes('email') || m.includes('写邮件')) && (m.includes('给') || m.includes('发送'))) {
      return { tool: 'send_email', params: {} };
    }

    // 写开发信
    if (m.includes('开发信') || m.includes('cold email') || m.includes('outreach') || (m.includes('写信') && m.includes('客户'))) {
      // 开发信不需要工具，LLM直接生成
      return null;
    }

    // 分析客户（单个或全部）
    if ((m.includes('分析') && m.includes('客户')) || m.includes('跟进策略') || m.includes('客户问题') ||
        m.includes('意向') || m.includes('风险客户') || m.includes('不活跃')) {
      let customerName = '';
      const patterns = [/分析(.+?)(?:的|客户)/, /(.+?)的情况/, /(.+?)有什么问题/, /(.+?)怎么跟进/];
      for (const p of patterns) {
        const match = msg.match(p);
        if (match && match[1] && match[1].length <= 10 && !['所有','全部','每个','一下','这些','那些'].includes(match[1])) {
          customerName = match[1].trim();
          break;
        }
      }
      return { tool: 'analyze_customers', params: { customerName } };
    }

    // 生成CI/合同/报关单
    if (m.includes('ci') || m.includes('商业发票') || m.includes('commercial invoice')) {
      return { tool: 'generate_document', params: { docType: 'CI' } };
    }
    if (m.includes('合同') || m.includes('contract')) {
      return { tool: 'generate_document', params: { docType: 'contract' } };
    }
    if (m.includes('报关') || m.includes('customs') || m.includes('报关单') || m.includes('海关')) {
      return { tool: 'generate_document', params: { docType: 'customs' } };
    }

    return null;
  }

  async processMessage(userId, userMessage, providerId = null, context = {}) {
    // 1. 保存用户消息
    const userConv = await prisma.assistantConversation.create({
      data: {
        userId,
        role: 'user',
        content: userMessage
      }
    });

    // 1.5 处理附件 - 图片用视觉模型分析，其他文件列出信息
    let attachmentDescs = '';
    const imageAttachments = (context.attachments || []).filter(a => a.type && a.type.startsWith('image/'));
    const otherAttachments = (context.attachments || []).filter(a => !(a.type && a.type.startsWith('image/')));
    
    if (imageAttachments.length > 0) {
      try {
        const images = [];
        for (const img of imageAttachments) {
          const buffer = fs.readFileSync(img.path);
          images.push({
            base64: buffer.toString('base64'),
            mimeType: img.type,
            filename: img.name
          });
        }
        const question = userMessage || '请描述这张图片的内容';
        const visionResult = await analyzeImageWithVision(images, question);
        attachmentDescs = '[图片分析结果]\n' + visionResult;
      } catch (e) {
        console.error('[Assistant] Vision analysis failed:', e.message);
        attachmentDescs = imageAttachments.map(a =>
          `[图片: ${a.name}, 大小: ${Math.round((a.size||0)/1024)}KB, 视觉分析失败: ${e.message}]`
        ).join(',\n');
      }
    }
    
    if (otherAttachments.length > 0) {
      const otherDesc = otherAttachments.map(a =>
        `[附件: ${a.name}, 类型: ${a.type}, 大小: ${Math.round((a.size||0)/1024)}KB]`
      ).join(',\n');
      attachmentDescs = attachmentDescs ? attachmentDescs + '\n' + otherDesc : otherDesc;
    }

    // 2. 获取最近10轮对话作为上下文
    const history = await prisma.assistantConversation.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20
    });
    const contextMessages = history.reverse().map(h => ({
      role: h.role === 'user' ? 'user' : 'assistant',
      content: h.content
    }));

    // 3. 构建prompt，让LLM判断是否需要调用工具
    const systemPrompt = `你是Jeremy的私人AI销售助理，也是一位拥有15年经验的资深外贸业务员和外贸顾问。你具备以下核心能力：

【你的专业领域】
1. 客户开发与跟进：
   - 写开发信（cold email）：专业、有吸引力、针对目标客户定制
   - 制定跟进策略：根据客户阶段、响应情况、行业特点给出具体跟进计划
   - 分析每个客户的问题：识别卡点、判断意向等级、建议下一步行动

2. 外贸单证制作：
   - 报价单（Quotation）、PI（形式发票）、CI（商业发票）
   - 合同（Contract）、报关单（Customs Declaration）、产品目录
   - 主动提醒关键条款风险（付款方式、贸易条款、交期等）

3. 市场分析与竞品调研：
   - 行业市场趋势分析（需联网搜索最新数据时调用web_search工具）
   - 竞争对手分析：产品、价格、渠道、营销策略对比
   - 目标市场画像：客户需求特征、采购习惯、决策流程
   - 竞品分析报告：结构化输出，包含SWOT分析、差异化建议

4. 商务谈判：
   - 报价策略、议价技巧、付款方式谈判
   - 贸易条款建议（FOB/CIF/EXW等的选择与风险）
   - 合同条款审查与风险提示

5. 邮件沟通：
   - 开发信、跟进邮件、报价邮件、售后邮件
   - 回复客户询盘、处理投诉邮件
   - 可通过send_email工具直接发送邮件（需确认后发送）

6. 汇率查询：实时汇率查询和货币转换

【极其重要 - 工具调用规则】
当用户要求你操作CRM数据或需要实时数据（汇率、市场信息等）时，你必须且只能返回JSON格式的工具调用：
正确格式：{"tool": "工具名", "params": {"参数名": "参数值"}}
错误示例："好的我去查一下" ← 绝对不要这样说！只返回JSON。
正确示例：{"tool": "web_search", "params": {"query": "玻璃行业出口趋势2026"}}

可用工具：
${TOOLS_DESC}

【回复规则】
1. 不需要工具时（写开发信/给建议/讨论策略/分析客户/谈判建议等），直接给出专业回复。
2. 绝对禁止使用**、-、#等Markdown符号，只用普通文字和标点。
3. 有主见：像老业务员一样主动给判断，不模棱两可。给建议要具体可执行，不要泛泛而谈。
4. 写开发信/邮件时：专业、简洁、有针对性，符合外贸行业习惯。包含主题行、称呼、正文、结尾。
5. 分析客户时：结合客户阶段、历史记录、沟通频率给出具体可执行的建议。每个客户列出问题和对应策略。
6. 做市场分析/竞品调研时：先调用web_search获取最新信息，然后综合分析给出结论。
7. 做竞品分析报告时：结构清晰，包含市场概况、竞品列表、优劣势对比、差异化建议。
8. 谈单证时：主动提醒关键点（付款方式风险、贸易条款选择、报关注意事项）。
9. 调用工具拿到数据后，必须分析总结给出洞察，不能只dump数据。

附件处理：用户可能上传图片，系统已自动分析图片内容。直接基于分析结果回复。

回复简洁自然，像同事之间微信聊天。使用中文。`;

    // 组装发给AI的用户消息（含附件信息）
    let userContent = userMessage || '';
    if (attachmentDescs) {
      userContent = (userContent ? userContent + '\n\n' : '') + '用户上传了以下附件：\n' + attachmentDescs;
    }

    const messages = [
      { role: 'system', content: systemPrompt },
      ...contextMessages,
      { role: 'user', content: userContent || '（发送了附件）' }
    ];

    const aiResponse = await chatComplete(messages, {
      temperature: 0.3,
      maxTokens: 1000
    });

    // 4. 解析响应，判断是否有工具调用
    let toolCall = null;
    console.log("[Assistant] AI raw response:", JSON.stringify(aiResponse).substring(0, 500));
    try {
      const jsonMatch = aiResponse.match(/\{[\s\S]*"tool"[\s\S]*\}/);
      if (jsonMatch) {
        toolCall = JSON.parse(jsonMatch[0]);
        console.log("[Assistant] Parsed toolCall from AI JSON:", JSON.stringify(toolCall));
      } else {
        console.log("[Assistant] No JSON tool pattern found in AI response");
      }
    } catch (e) {
      console.log("[Assistant] JSON parse failed:", e.message);
    }

    // 4.5 后端意图识别：AI不返回JSON时，直接在后端判断该调什么工具
    if (!toolCall && this._isCrmTask(userMessage)) {
      toolCall = this._detectIntent(userMessage);
      console.log("[Assistant] Backend intent detected:", JSON.stringify(toolCall));
    } else if (!toolCall) {
      console.log("[Assistant] No CRM task detected for:", userMessage.substring(0, 50));
    }

    if (toolCall && toolCall.tool) {
      const funcName = toolCall.tool;
      const funcArgs = toolCall.params || {};
      
      // 查找工具定义
      const tool = TOOLS.find(t => t.name === funcName);
      if (!tool) {
        const reply = `抱歉，我不支持这个操作：${funcName}`;
        await prisma.assistantConversation.create({
          data: { userId, role: 'assistant', content: reply }
        });
        return { reply: this._stripMarkdown(reply), tasks: [] };
      }

      // 5. 判断是否需要确认
      if (tool.needConfirm) {
        // 创建待确认任务
        const task = await prisma.assistantTask.create({
          data: {
            conversationId: userConv.id,
            userId,
            type: funcName,
            status: 'pending',
            params: JSON.stringify(funcArgs)
          }
        });

        const reply = this._formatConfirmMessage(funcName, funcArgs);
        
        await prisma.assistantConversation.update({
          where: { id: userConv.id },
          data: { tasks: JSON.stringify([task.id]) }
        });
        
        await prisma.assistantConversation.create({
          data: { userId, role: 'assistant', content: reply }
        });
        
        return {
          reply,
          tasks: [{
            id: task.id,
            type: funcName,
            status: 'pending',
            params: funcArgs,
            label: tool.description
          }]
        };
      } else {
        // 6. 直接执行工具
        try {
          const result = await this._executeTool(funcName, funcArgs);
          const rawSummary = this._formatResult(funcName, funcArgs, result);
          
          // 把工具结果喂回AI，让AI分析后自然回复
          const analysisPrompt = `用户刚才说："${userMessage}"
我帮你查了数据，结果如下：
${rawSummary}

请根据用户的需求，对这些数据进行分析、总结和给出建议。用口语化的方式回复，像同事之间聊天一样自然。不要原样展示数据，要给出你的判断和洞察。`;

          const analysisReply = await chatComplete([
            { role: 'system', content: systemPrompt },
            { role: 'user', content: analysisPrompt }
          ], { temperature: 0.5, maxTokens: 1000 });
          
          const reply = this._stripMarkdown(analysisReply || rawSummary);
          
          // 提取文件附件信息（generate_document 产出）
          const attachments = [];
          if (funcName === 'generate_document' && result && result.url) {
            const host = process.env.BASE_URL || 'https://ai.jzjglass.com';
            const fileUrl = result.url.startsWith('http') ? result.url : host + result.url;
            attachments.push({
              name: result.filename || (args.title || 'Document') + '.pdf',
              url: fileUrl,
              type: 'application/pdf',
              docId: result.docId || null
            });
          }
          
          await prisma.assistantConversation.create({
            data: { userId, role: 'assistant', content: reply, attachments: attachments.length ? JSON.stringify(attachments) : null }
          });
          
          return { reply, tasks: [], attachments };
        } catch (err) {
          const reply = `❌ 执行失败：${err.message}`;
          await prisma.assistantConversation.create({
            data: { userId, role: 'assistant', content: reply }
          });
          return { reply, tasks: [], error: err.message };
        }
      }
    } else {
      // 7. 纯对话回复（无工具调用）
      const reply = this._stripMarkdown(aiResponse || '好的，我理解了。');
      await prisma.assistantConversation.create({
        data: { userId, role: 'assistant', content: reply }
      });
      return { reply: this._stripMarkdown(reply), tasks: [] };
    }
  }

  /**
   * 确认并执行任务
   */
  async confirmTask(userId, taskId, modifications) {
    const task = await prisma.assistantTask.findUnique({ where: { id: taskId } });
    if (!task) throw new Error('任务不存在');
    if (task.userId !== userId) throw new Error('无权操作');
    if (task.status !== 'pending') throw new Error('任务已处理');

    // 合并修改（如修改消息内容）
    const params = modifications 
      ? { ...JSON.parse(task.params), ...modifications }
      : JSON.parse(task.params);

    // 执行工具
    const result = await this._executeTool(task.type, params);

    // 更新任务状态
    await prisma.assistantTask.update({
      where: { id: taskId },
      data: {
        status: 'executed',
        params: JSON.stringify(params),
        result: JSON.stringify(result),
        confirmedAt: new Date(),
        executedAt: new Date()
      }
    });

    const reply = this._stripMarkdown(this._formatResult(task.type, params, result, true));
    await prisma.assistantConversation.create({
      data: { userId, role: 'assistant', content: reply }
    });

    return { reply, result };
  }

  /**
   * 取消任务
   */
  async cancelTask(userId, taskId) {
    const task = await prisma.assistantTask.findUnique({ where: { id: taskId } });
    if (!task) throw new Error('任务不存在');
    if (task.userId !== userId) throw new Error('无权操作');
    if (task.status !== 'pending') throw new Error('任务已处理');

    await prisma.assistantTask.update({
      where: { id: taskId },
      data: { status: 'cancelled' }
    });

    return { message: '任务已取消' };
  }

  /**
   * 查询对话历史
   */
  async getConversations(userId, limit = 200) {
    // 先取最新的N条（desc），再反转为时间升序给前端显示
    const msgs = await prisma.assistantConversation.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit
    });
    return msgs.reverse();
  }

  /**
   * 查询任务列表
   */
  async getTasks(userId, status) {
    const where = { userId };
    if (status) where.status = status;
    return prisma.assistantTask.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50
    });
  }

  /**
   * 执行工具（调用CRM API）
   */
  async _executeTool(funcName, args) {
    switch (funcName) {
      case 'query_customer': {
        const where = {};
        if (args.customerName) {
          where.OR = [
            { name: { contains: args.customerName } },
            { companyName: { contains: args.customerName } },
            { contactName: { contains: args.customerName } },
            { company: { contains: args.customerName } }
          ];
        }
        if (args.jid) where.jid = { contains: args.jid };
        const customers = await prisma.customer.findMany({ where, take: 10 });
        return { customers };
      }

      case 'query_orders': {
        const orders = await prisma.order.findMany({ 
          where: { customerId: args.customerId },
          take: 10,
          orderBy: { createdAt: 'desc' }
        });
        return { orders };
      }

      case 'query_messages': {
        let jid = args.jid;
        if (!jid && args.customerName) {
          // 先通过客户名查找JID
          const customer = await prisma.customer.findFirst({
            where: {
              OR: [
                { name: { contains: args.customerName } },
                { companyName: { contains: args.customerName } },
                { contactName: { contains: args.customerName } },
                { company: { contains: args.customerName } }
              ]
            }
          });
          if (customer && customer.jid) jid = customer.jid;
        }
        if (!jid) {
          // 没有指定客户，返回最近有消息的客户列表
          const recentMsgs = await prisma.wAMessage.findMany({
            orderBy: { timestamp: 'desc' },
            take: 50,
            select: { from: true, to: true }
          });
          const jids = new Set();
          recentMsgs.forEach(m => {
            if (m.from && m.from.includes('s.whatsapp.net')) jids.add(m.from);
            if (m.to && m.to.includes('s.whatsapp.net')) jids.add(m.to);
          });
          const customers = await prisma.customer.findMany({
            where: { jid: { in: [...jids].slice(0, 10) } },
            take: 10
          });
          return { 
            error: '请指定要查看哪位客户的聊天记录。以下是最近有消息的客户：' + 
            customers.map(c => c.name || c.contactName || c.jid).join('、') 
          };
        }
        const fullJid = jid.includes('@') ? jid : `${jid}@s.whatsapp.net`;
        const messages = await prisma.wAMessage.findMany({
          where: { OR: [{ from: fullJid }, { to: fullJid }] },
          orderBy: { timestamp: 'desc' },
          take: args.limit || 30
        });
        return { messages: messages.reverse(), customerName: args.customerName || jid };
      }

      case 'send_message': {
        // 调用Evolution API发送消息
        const { default: evolutionConnector } = await import('./evolution-connector.js');
        const jid = args.jid.includes('@') ? args.jid : `${args.jid}@s.whatsapp.net`;
        const result = await evolutionConnector.sendTextMessage(jid, args.message);
        return { success: true, messageId: result?.key?.id };
      }

      case 'update_customer_status': {
        const updated = await prisma.customer.update({
          where: { id: args.customerId },
          data: { stage: args.stage }
        });
        return { customer: updated };
      }

      case 'add_follow_up': {
        const followUp = await prisma.customerFollowUp.create({
          data: {
            customerId: parseInt(args.customerId),
            content: args.note || '',
            source: 'assistant',
            metadata: args.followUpDate ? JSON.stringify({followUpDate: args.followUpDate}) : null
          }
        });
        return { followUp };
      }

      case 'generate_document': {
        try {
          const { default: axios } = await import('axios');
          const port = process.env.DEPLOY_RUN_PORT || 3000;
          const baseUrl = `http://127.0.0.1:${port}`;
          
          const docType = args.docType || 'general';
          
          if (docType === 'quote' || docType === 'PI' || docType === 'CI') {
            // Parse items
            let items = [];
            if (typeof args.items === 'string') {
              try { items = JSON.parse(args.items); } catch(e) { items = []; }
            } else if (Array.isArray(args.items)) {
              items = args.items;
            }
            
            // Try to find customer
            let customerId = null;
            if (args.customerName) {
              const cust = await prisma.customer.findFirst({
                where: {
                  OR: [
                    { name: { contains: args.customerName } },
                    { companyName: { contains: args.customerName } },
                    { contactName: { contains: args.customerName } }
                  ]
                }
              });
              if (cust) customerId = cust.id;
            }
            
            const docItems = items.map((item, idx) => ({
              sortOrder: idx,
              productName: item.name || item.productName || '',
              model: item.model || '',
              spec: item.spec || '',
              quantity: item.qty || item.quantity || 0,
              unit: item.unit || 'pcs',
              unitPrice: item.price || item.unitPrice || 0,
              amount: (item.qty || item.quantity || 0) * (item.price || item.unitPrice || 0),
              remark: item.remark || ''
            }));
            
            const total = docItems.reduce((s, i) => s + (i.amount || 0), 0);
            
            // Create document record
            const docRecord = await prisma.document.create({
              data: {
                userId: 1,
                customerId: customerId,
                type: docType === 'PI' ? 'PI' : (docType === 'CI' ? 'CI' : 'QUOTATION'),
                docNumber: `DOC-${new Date().toISOString().split('T')[0].replace(/-/g,'')}-${Date.now().toString().slice(-3)}`,
                title: args.title || (docType === 'PI' ? 'Proforma Invoice' : (docType === 'CI' ? 'Commercial Invoice' : 'Quotation')),
                issueDate: new Date(),
                currency: 'USD',
                totalAmount: total,
                amountInWords: '',
                status: 'DRAFT',
                sellerInfo: {},
                buyerInfo: {
                  companyName: args.customerName || '',
                  contactName: args.customerContact || '',
                  email: args.customerEmail || ''
                },
                remarks: args.notes || ''
              }
            });
            
            // Create items
            for (const di of docItems) {
              await prisma.documentItem.create({
                data: { documentId: docRecord.id, ...di }
              });
            }
            
            // Generate PDF directly
            const pdfResult = await generateQuotePDF(docRecord);
            return { success: true, url: pdfResult.url, filename: pdfResult.filename, docId: docRecord.id };
            
          } else if (docType === 'contract' || docType === 'customs' || docType === 'catalog') {
            // Contract/Customs/Catalog - structured document with specific sections
            const contentStr = args.content || args.title || '';
            const sections = [];
            const lines = contentStr.split('\n');
            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed) continue;
              if (trimmed.startsWith('## ')) {
                sections.push({ type: 'heading', content: trimmed.slice(3) });
              } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                const lastSection = sections[sections.length - 1];
                if (lastSection && lastSection.type === 'bullet-list') {
                  lastSection.items.push(trimmed.slice(2));
                } else {
                  sections.push({ type: 'bullet-list', items: [trimmed.slice(2)] });
                }
              } else {
                sections.push({ type: 'paragraph', content: trimmed });
              }
            }
            
            // Add trade-specific metadata to sections
            const metaInfo = [];
            if (args.paymentTerms) metaInfo.push('Payment Terms: ' + args.paymentTerms);
            if (args.incoterms) metaInfo.push('Incoterms: ' + args.incoterms);
            if (args.portOfLoading) metaInfo.push('Port of Loading: ' + args.portOfLoading);
            if (args.portOfDischarge) metaInfo.push('Port of Discharge: ' + args.portOfDischarge);
            if (metaInfo.length > 0) {
              sections.unshift({ type: 'heading', content: 'Trade Terms' });
              sections.unshift({ type: 'paragraph', content: metaInfo.join(' | ') });
            }
            
            const docTitle = args.title || (docType === 'contract' ? 'Sales Contract' : (docType === 'customs' ? 'Customs Declaration' : 'Product Catalog'));
            const payload = {
              title: docTitle,
              subtitle: args.subtitle || '',
              sections,
              options: {
                companyName: args.customerName || '',
                date: new Date().toISOString().split('T')[0],
                incoterms: args.incoterms || '',
                paymentTerms: args.paymentTerms || ''
              }
            };
            
            const pdfResult = await generateStructuredPDF(payload);
            return { success: true, url: pdfResult.url, filename: pdfResult.filename };
          } else {
            // General document - parse markdown-like content into sections
            const contentStr = args.content || args.title || '';
            const sections = [];
            const lines = contentStr.split('\n');
            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed) continue;
              if (trimmed.startsWith('## ')) {
                sections.push({ type: 'heading', content: trimmed.slice(3) });
              } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                const lastSection = sections[sections.length - 1];
                if (lastSection && lastSection.type === 'bullet-list') {
                  lastSection.items.push(trimmed.slice(2));
                } else {
                  sections.push({ type: 'bullet-list', items: [trimmed.slice(2)] });
                }
              } else {
                sections.push({ type: 'paragraph', content: trimmed });
              }
            }
            
            const payload = {
              title: args.title || 'Document',
              subtitle: args.subtitle || '',
              sections,
              options: {
                companyName: args.customerName || '',
                date: new Date().toISOString().split('T')[0]
              }
            };
            
            const pdfResult = await generateStructuredPDF(payload);
            return { success: true, url: pdfResult.url, filename: pdfResult.filename };
          }
        } catch (genErr) {
          console.error('[Assistant] generate_document error:', genErr);
          return { error: genErr.message };
        }
      }

      case 'send_email': {
        try {
          const { sendEmail } = await import('./email.js');
          // Find email account
          const emailAccount = await prisma.emailAccount.findFirst({
            where: { userId, status: 'active' },
            orderBy: { lastSyncAt: 'desc' }
          });
          if (!emailAccount) return { error: true, message: '没有可用的邮件账户，请先配置邮箱' };
          const result = await sendEmail(emailAccount.id, {
            to: args.to,
            subject: args.subject || '',
            body: args.body || '',
            html: args.body || ''
          });
          return { success: true, messageId: result.messageId, to: args.to };
        } catch(e) {
          return { error: true, message: '邮件发送失败：' + e.message };
        }
      }

      case 'analyze_customers': {
        try {
          const where = {};
          if (args.customerName) {
            where.OR = [
              { name: { contains: args.customerName } },
              { companyName: { contains: args.customerName } },
              { contactName: { contains: args.customerName } }
            ];
          }
          const customers = await prisma.customer.findMany({
            where,
            include: {
              messages: { take: 5, orderBy: { createdAt: 'desc' } },
              followUps: { take: 3, orderBy: { createdAt: 'desc' } }
            },
            take: args.customerName ? 5 : 50
          });
          const analysis = customers.map(c => ({
            id: c.id,
            name: c.name || c.pushName,
            company: c.company,
            stage: c.stage,
            email: c.email,
            jid: c.jid,
            lastMessageAt: c.lastMessageAt,
            messageCount: c._count?.messages || 0,
            recentMessages: (c.messages || []).map(m => ({ dir: m.direction, body: (m.body||'').substring(0,100), time: m.createdAt })),
            followUps: (c.followUps || []).map(f => ({ content: f.content, date: f.createdAt }))
          }));
          return { customers: analysis, count: analysis.length };
        } catch(e) {
          return { error: true, message: '客户分析失败：' + e.message };
        }
      }

      case 'web_search': {
        try {
          const { default: axios } = await import('axios');
          const query = args.query || userMessage || '';
          // Use DuckDuckGo instant answer API
          const ddgResp = await axios.get('https://api.duckduckgo.com/', {
            params: {
              q: query,
              format: 'json',
              no_html: 1,
              skip_disambig: 1
            },
            timeout: 10000
          });
          const ddgData = ddgResp.data;
          let results = [];
          
          // Extract abstract/summary
          if (ddgData.Abstract) {
            results.push({
              title: ddgData.Heading || query,
              snippet: ddgData.Abstract,
              url: ddgData.AbstractURL || ''
            });
          }
          
          // Extract related topics
          if (ddgData.RelatedTopics && ddgData.RelatedTopics.length > 0) {
            for (const topic of ddgData.RelatedTopics.slice(0, 8)) {
              if (topic.Text) {
                results.push({
                  title: topic.Text.substring(0, 80),
                  snippet: topic.Text,
                  url: topic.FirstURL || ''
                });
              }
            }
          }
          
          // If DDG instant answer is empty, try a basic web scrape approach
          if (results.length === 0) {
            // Fallback: use a search results page approach
            const searchUrl = 'https://html.duckduckgo.com/html/';
            const searchResp = await axios.post(searchUrl, 
              new URLSearchParams({ q: query }).toString(),
              {
                headers: { 
                  'Content-Type': 'application/x-www-form-urlencoded',
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                timeout: 10000
              }
            );
            // Parse basic results from HTML
            const html = searchResp.data || '';
            const resultRegex = /<a rel="nofollow" class="result__a" href="([^"]+)".*?>(.*?)<\/a>.*?<a class="result__snippet"[^>]*>(.*?)<\/a>/gs;
            let match;
            let count = 0;
            while ((match = resultRegex.exec(html)) !== null && count < 8) {
              const url = match[1];
              const title = match[2].replace(/<[^>]+>/g, '').trim();
              const snippet = match[3].replace(/<[^>]+>/g, '').trim();
              if (title && snippet) {
                results.push({ title, snippet, url });
                count++;
              }
            }
          }
          
          return { 
            query, 
            results: results.slice(0, 8),
            count: results.length,
            timestamp: new Date().toISOString()
          };
        } catch(e) {
          return { error: true, message: '搜索失败：' + (e.response?.data?.message || e.message), query: args.query };
        }
      }

      case 'exchange_rate': {
        try {
          const { default: axios } = await import('axios');
          const from = (args.from || 'USD').toUpperCase();
          const to = (args.to || 'CNY').toUpperCase();
          const amount = parseFloat(args.amount) || 1;
          const resp = await axios.get('https://api.frankfurter.dev/v1/latest', {
            params: { from: 'EUR' },
            timeout: 8000
          });
          const rates = resp.data.rates || {};
          rates['EUR'] = 1;
          const fromRate = rates[from];
          const toRate = rates[to];
          if (!fromRate || !toRate) {
            return { error: true, message: '不支持的货币。支持：USD/EUR/GBP/CNY/JPY/HKD/AUD/CAD/CHF等' };
          }
          const rate = toRate / fromRate;
          const result = amount * rate;
          return {
            from, to, amount, rate: rate.toFixed(4),
            result: result.toFixed(4),
            date: resp.data.date || '',
            base: 'ECB'
          };
        } catch(e) {
          return { error: true, message: '汇率查询失败：' + (e.response?.data?.message || e.message) };
        }
      }

      case 'query_dashboard': {
        try {
          const today = new Date();
          today.setHours(0,0,0,0);
          const [totalCustomers, todayCustomers, totalMessages, totalDocuments, pipelineStats] = await Promise.all([
            prisma.customer.count(),
            prisma.customer.count({ where: { createdAt: { gte: today } } }),
            prisma.message.count(),
            prisma.document.count(),
            prisma.customer.groupBy({
              by: ['stage'],
              _count: true
            })
          ]);
          const stageMap = {};
          for (const s of pipelineStats) {
            stageMap[s.stage || 'unknown'] = s._count;
          }
          return {
            totalCustomers,
            todayCustomers,
            totalMessages,
            totalDocuments,
            pipeline: stageMap
          };
        } catch(e) {
          return { error: true, message: '统计查询失败：' + e.message };
        }
      }


      case "track_topic": {
        try {
          const topic = args.topic || userMessage;
          const kw = args.keywords ? (typeof args.keywords === "string" ? JSON.parse(args.keywords) : args.keywords) : [];
          const fa = args.focusAreas ? (typeof args.focusAreas === "string" ? JSON.parse(args.focusAreas) : args.focusAreas) : [];
          const freq = args.frequency || "daily";
          const sub = await prisma.topicSubscription.upsert({
            where: { userId_topic: { userId: 1, topic } },
            update: { keywords: JSON.stringify(kw), focusAreas: JSON.stringify(fa), frequency: freq, active: true },
            create: { userId: 1, topic, keywords: JSON.stringify(kw), focusAreas: JSON.stringify(fa), frequency: freq }
          });
          return { success: true, id: sub.id, topic: sub.topic };
        } catch(e) {
          return { error: true, message: "Subscribe failed: " + e.message };
        }
      }

      case "list_topics": {
        try {
          const subs = await prisma.topicSubscription.findMany({
            where: { userId: 1, active: true },
            include: { briefings: { take: 1, orderBy: { createdAt: "desc" } } },
            orderBy: { updatedAt: "desc" }
          });
          return {
            topics: subs.map(s => ({ id: s.id, topic: s.topic, frequency: s.frequency, lastRunAt: s.lastRunAt, latestSummary: s.briefings[0]?.summary || null })),
            count: subs.length
          };
        } catch(e) {
          return { error: true, message: "List failed: " + e.message };
        }
      }

      case "get_briefing": {
        try {
          const topic = args.topic;
          const sub = await prisma.topicSubscription.findFirst({
            where: { userId: 1, topic: { contains: topic || "" }, active: true },
            include: { briefings: { take: 3, orderBy: { createdAt: "desc" } } }
          });
          if (!sub) return { error: true, message: "Topic not found: " + topic };
          return {
            topic: sub.topic,
            briefings: sub.briefings.map(b => ({ summary: b.summary, content: b.content, createdAt: b.createdAt })),
            lastRunAt: sub.lastRunAt
          };
        } catch(e) {
          return { error: true, message: "Briefing failed: " + e.message };
        }
      }
      default:
        throw new Error(`未知工具：${funcName}`);
    }
  }

  /**
   * 格式化确认消息
   */
  _formatConfirmMessage(funcName, args) {
    const labels = {
      send_message: '📤 发送消息',
      update_customer_status: '🔄 更新客户状态'
    };
    
    let detail = '';
    if (funcName === 'send_message') {
      detail = `收件人：${args.jid}\n内容：${args.message}`;
    } else if (funcName === 'update_customer_status') {
      detail = `客户ID：${args.customerId}\n新状态：${args.stage}`;
    }
    
    return `⏳ 待确认任务\n${labels[funcName] || funcName}\n${detail}\n\n请回复"确认"执行，或"取消"放弃。`;
  }

  /**
   * 格式化执行结果
   */
  _formatResult(funcName, args, result, justConfirmed = false) {
    const prefix = justConfirmed ? '✅ 执行完成\n' : '✅ 查询完成\n';
    
    if (funcName === 'query_customer') {
      const list = result.customers.map(c => 
        `- ${c.name || c.pushName || '未知'} (${c.jid})\n  公司：${c.company || '无'}\n  阶段：${c.stage || '未设置'}`
      ).join('\n');
      return `${prefix}\n找到 ${result.customers.length} 个客户：\n${list || '无匹配结果'}`;
    }
    
    if (funcName === 'query_orders') {
      const list = result.orders.map(o => 
        `- 订单#${o.id}：$${o.totalAmount || 0}\n  状态：${o.status || '未知'}`
      ).join('\n');
      return `${prefix}\n找到 ${result.orders.length} 个订单：\n${list || '暂无订单'}`;
    }
    
    if (funcName === 'query_messages') {
      if (result.error) return `${prefix}\n${result.error}`;
      if (!result.messages || result.messages.length === 0) return `${prefix}\n未找到聊天记录`;
      const msgs = result.messages.slice(-10).map(m => {
        const role = m.direction === 'outbound' ? '我' : '客户';
        const body = (m.body || m.text || '').substring(0, 80);
        return `  [${role}] ${body}`;
      }).join('\n');
      return `${prefix}\n最近 ${result.messages.length} 条消息：\n${msgs}`;
    }
    
    if (funcName === 'send_message') {
      return `${prefix}\n消息已发送给 ${args.jid}`;
    }
    
    if (funcName === 'update_customer_status') {
      return `${prefix}\n客户状态已更新为 ${args.stage}`;
    }
    
    if (funcName === 'add_follow_up') {
      return `${prefix}\n跟进记录已添加`;
    }
    
    if (funcName === 'generate_document') {
      if (result.error) return `${prefix}\n文档生成失败：${result.error}`;
      const host = process.env.BASE_URL || 'https://ai.jzjglass.com';
      return `${prefix}\n文档「${args.title || 'Document'}」已生成！\n📄 下载地址：${host}${result.url}`;
    }
    
    if (funcName === 'send_email') {
      if (result.error) return '❌ ' + result.message;
      return '✅ 邮件已发送至 ' + result.to;
    }

    if (funcName === 'analyze_customers') {
      if (result.error) return '❌ ' + result.message;
      if (result.count === 0) return '未找到匹配的客户';
      let summary = '📊 客户分析结果（' + result.count + '个客户）\n\n';
      result.customers.forEach(c => {
        summary += '【' + (c.name||'未知') + '】' + (c.company ? ' / ' + c.company : '') + '\n';
        summary += '  阶段: ' + (c.stage||'未设置') + ' | 邮箱: ' + (c.email||'无') + '\n';
        if (c.lastMessageAt) summary += '  最后联系: ' + new Date(c.lastMessageAt).toLocaleDateString() + '\n';
        if (c.recentMessages && c.recentMessages.length > 0) {
          summary += '  最近消息: ' + c.recentMessages.length + '条\n';
        }
        summary += '\n';
      });
      return summary;
    }

    if (funcName === 'web_search') {
      if (result.error) return '❌ ' + result.message;
      if (!result.results || result.results.length === 0) {
        return '🔍 未找到关于「' + result.query + '」的相关信息。';
      }
      let summary = '🔍 搜索结果：「' + result.query + '」\n\n';
      result.results.forEach((r, i) => {
        summary += (i + 1) + '. ' + r.title + '\n';
        summary += '   ' + (r.snippet || '').substring(0, 150) + '\n';
        if (r.url) summary += '   链接: ' + r.url + '\n';
        summary += '\n';
      });
      return summary;
    }

    if (funcName === 'exchange_rate') {
      if (result.error) return '❌ ' + result.message;
      return '💱 汇率查询结果\n' +
        '日期：' + result.date + '（ECB参考汇率）\n' +
        result.amount + ' ' + result.from + ' = ' + result.result + ' ' + result.to + '\n' +
        '汇率：1 ' + result.from + ' = ' + result.rate + ' ' + result.to;
    }

    if (funcName === 'query_dashboard') {
      if (result.error) return '❌ ' + result.message;
      const pipeline = result.pipeline || {};
      const stageLabels = {lead:'线索',contacted:'已联系',qualified:'已确认',proposal:'报价中',negotiation:'谈判中',won:'成功',lost:'失败'};
      const stages = ['lead','contacted','qualified','proposal','negotiation','won','lost'].map(s => {
        const count = pipeline[s] || 0;
        if (!count) return '';
        return '  ' + (stageLabels[s]||s) + ': ' + count + '个';
      }).filter(Boolean).join('\n');
      return '📊 CRM数据概览\n' +
        '客户总数：' + result.totalCustomers + '\n' +
        '今日新增：' + result.todayCustomers + '\n' +
        '消息总数：' + result.totalMessages + '\n' +
        '文档总数：' + result.totalDocuments + '\n\n' +
        '📈 漏斗分布：\n' + (stages || '  暂无数据');
    }


    if (funcName === "track_topic") {
      if (result.error) return "Error: " + result.message;
      return "Subscribed to topic: " + result.topic + ". I will periodically search and summarize the latest developments.";
    }

    if (funcName === "list_topics") {
      if (result.error) return "Error: " + result.message;
      if (result.count === 0) return "No tracked topics. Say something like track AI Agent trends to subscribe.";
      let s = "Tracked " + result.count + " topics:\\n\\n";
      result.topics.forEach((t, i) => {
        s += (i+1) + ". " + t.topic + " (freq: " + t.frequency + ")\\n";
        if (t.latestSummary) s += "   Latest: " + t.latestSummary.substring(0,60) + "...\\n";
      });
      return s;
    }

    if (funcName === "get_briefing") {
      if (result.error) return "Error: " + result.message;
      if (!result.briefings || result.briefings.length === 0) {
        return "No briefing for topic: " + result.topic + ". I can search for latest developments now.";
      }
      let s = "Briefing for " + result.topic + ":\\n\\n";
      result.briefings.forEach(b => { if (b.summary) s += b.summary + "\\n\\n"; });
      return s;
    }
    return `${prefix}\n操作完成`;
  }
}

const assistantService = new AssistantService();
export default assistantService;
