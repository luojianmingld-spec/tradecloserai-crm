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
      docType: '文档类型（必填，可选值：quote/PI/general）。quote=报价单，PI=形式发票，general=通用文档',
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
    const keywords = ['查', '分析', '搜索', '找', '发', '更新', '修改', '添加',
      '客户', '订单', '消息', '记录', '状态', '跟进', '背调', '汇总', '总结',
      '出', '报价', 'PDF', 'pi', '生成', '文档', '发票', '目录', 'product',
      'query', 'send', 'update', 'add', 'analyze', 'generate', 'document', 'quotation'];
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
    const systemPrompt = `你是Jeremy的私人AI销售助理。你是一个有经验、有主见的外贸老手。

【极其重要 - 工具调用规则】
当用户要求你查询、分析、操作CRM数据（查客户/查订单/查消息/发消息/改状态/加跟进等）时，你必须且只能返回JSON格式的工具调用，绝对不能有任何其他文字！
正确格式：{"tool": "工具名", "params": {"参数名": "参数值"}}
错误示例："好的我去查一下" ← 这是错的！不要说任何话，只返回JSON。
正确示例：{"tool": "query_customer", "params": {}}

可用工具：
${TOOLS_DESC}

【回复规则】
1. 不需要工具时（闲聊/讨论/建议/翻译等），用纯文本回复，像同事微信聊天一样自然。
2. 绝对禁止使用**、-、#等Markdown符号，只用普通文字和标点。
3. 有主见：主动给判断和建议，不要问"您需要我做什么"。
4. 会认同：用户提出好想法时先肯定再补充。
5. 调用工具拿到数据后（由系统处理），必须分析总结给出洞察，不能只dump数据。

附件处理：用户可能上传图片，系统已自动分析图片内容并注入对话。直接基于分析结果回复，不要说"无法查看图片"。

回复简洁自然，使用中文。`;

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
          
          await prisma.assistantConversation.create({
            data: { userId, role: 'assistant', content: reply }
          });
          
          return { reply, tasks: [] };
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
          
          if (docType === 'quote' || docType === 'PI') {
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
                type: docType === 'PI' ? 'PI' : 'QUOTATION',
                docNumber: `DOC-${new Date().toISOString().split('T')[0].replace(/-/g,'')}-${Date.now().toString().slice(-3)}`,
                title: args.title || (docType === 'PI' ? 'Proforma Invoice' : 'Quotation'),
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
    
    return `${prefix}\n操作完成`;
  }
}

const assistantService = new AssistantService();
export default assistantService;
