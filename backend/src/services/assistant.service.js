import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { chatComplete, analyzeImageWithVision, getProviderById } from './ai-client.js';
import { generateStructuredPDF, generateQuotePDF } from './pdf-generator.js';
import { TOOLS, buildToolsDesc } from '../tools/tools.schema.js';
import { contextSet, contextGet } from './context.service.js';
import { buildCustomerPanorama, formatPanoramaPrompt } from './panorama.service.js';
import { buildSystemPrompt } from '../prompts/agent-prompts.js';
import { AI_CONFIG } from '../config/ai.js';
import { logger } from '../utils/logger.js';
import unattendedService from './unattended.service.js';
import autoReceptionService from './auto-reception.service.js';

const prisma = new PrismaClient();

// Agent可调用的工具定义
// 工具定义(TOOLS)与 Agent Prompt(AGENT_PROMPTS)已抽取至
// ../tools/tools.schema.js 与 ../prompts/agent-prompts.js (v1.0)
const TOOLS_DESC = buildToolsDesc(TOOLS);

/**
 * 从 AI 原始回复中提取所有顶层 JSON 工具调用对象（支持单个或多个连续 JSON）
 * 用花括号深度扫描做平衡匹配，避免贪婪正则把多个 JSON 合并导致解析失败
 */
function extractToolCalls(text) {
  const results = [];
  if (!text) return results;
  const s = String(text);
  let start = -1, depth = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0 && start >= 0) {
        const candidate = s.slice(start, i + 1);
        start = -1;
        try {
          const obj = JSON.parse(candidate);
          if (obj && obj.tool) results.push(obj);
        } catch (e) { /* skip invalid */ }
      }
    }
  }
  return results;
}

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
      '报价', 'PDF', '生成', '文档', '发票', '目录', 'product',
      'query', 'send', 'update', 'add', 'analyze', 'generate', 'document', 'quotation',
      '汇率', 'exchange', 'rate', '概览', '统计', 'dashboard',
      '开发信', '邮件', 'email', '合同', 'contract', '报关', 'customs',
      '谈判', '建议', '策略', '市场', '竞品', '意向', '风险',
      '调研', '趋势', '行业', '报告', '政策', '关税', '网上', '搜索', '提醒', '日程', '闹钟',
      '接待', '无人值守', '自动接待'];
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

    // 查订单：仅当明确表达"查询/查看/追踪订单"意图时才触发（客户谈判中的 order 提及不算）
    if (/(订单.*(查|查询|查看|看|追踪|跟踪|状态)|(查|查询|查看|追踪|跟踪).{0,12}(订单|order)|订单状态|订单列表|我的订单|order\s*(status|list|history)|track\s*(my\s*)?order|check\s*(my\s*)?orders?|query\s*orders?|list\s*orders|where\s*is\s*my\s*order|orders?\s*status)/.test(m)) {
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

    // 生成PDF/报价单/PI：仅当明确要求"生成/做/出"文档时才触发；客户口头询价（give a quote / ask price）不触发
    if (/(生成|做一份|做份|做一下|做张|出一份|出个|出报价单|出报价|做成pdf|pdf文档|生成文档|产品目录|开发信|generate\s*(a\s*)?(quotation|quote|pdf|document|proforma|invoice))/i.test(m)) {
      const docType = /\bpi\b/i.test(m) || m.includes('发票') || m.includes('proforma') ? 'PI' : 'quote';
      return { tool: 'generate_document', params: { docType } };
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

    // 共享上下文（6 Agent 团队共享事实层）：写入/查询
    // context_get 触发："查一下共享上下文""上下文里XX是什么结论""查客户X的付款方式结论"
    if (/(查|查看|看下|看看|查询|读|取).{0,6}(共享上下文|上下文|共享结论)/.test(m) || m.includes('共享上下文里') || m.includes('上下文里')) {
      const entityM = msg.match(/(?:客户|订单|company)\s*[:：]?\s*([A-Za-z0-9_\-]+)/i);
      return { tool: 'context_get', params: entityM ? { entityId: entityM[1], raw: msg } : { raw: msg } };
    }
    // context_set 触发："请记住并写入共享上下文""写入上下文""记住XX结论""沉淀XX事实"
    if (/(写入|记住|记一下|记下|沉淀|保存|记录).{0,12}(共享上下文|上下文|共享)/.test(m) || m.includes('共享上下文') || m.includes('写入共享')) {
      const entityM = msg.match(/(?:客户|订单|company)\s*[:：]?\s*([A-Za-z0-9_\-]+)/i);
      return { tool: 'context_set', params: entityM ? { entityId: entityM[1], raw: msg } : { raw: msg } };
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
    if (/\bci\b/i.test(m) || m.includes('商业发票') || m.includes('commercial invoice')) {
      return { tool: 'generate_document', params: { docType: 'CI' } };
    }
    if (m.includes('合同') || m.includes('contract')) {
      return { tool: 'generate_document', params: { docType: 'contract' } };
    }
    if (m.includes('报关') || m.includes('customs') || m.includes('报关单') || m.includes('海关')) {
      return { tool: 'generate_document', params: { docType: 'customs' } };
    }

    // 日程提醒：设置/创建/取消提醒（宽松匹配：兼容“设置一个提醒”“帮我设个日程”“提醒我X点做Y”“取消掉”等口语）
    if (/(设置|创建|新建|设个|设一个|加一个|加个|帮我设|帮我安排|安排一个|添加一个).{0,12}(提醒|闹钟|日程)/.test(m) ||
        /(提醒|闹钟|日程).{0,2}我/.test(m) || m.includes('提醒我') || m.includes('闹钟提醒')) {
      // 优先提取 ISO 时间；否则把整句交给 _parseRemindAt 解析（兼容“明天上午10点”“下午3点”等）
      const isoM = msg.match(/\d{4}[-/]\d{1,2}[-/]\d{1,2}[T\s]+\d{1,2}:\d{2}(?::\d{2})?([Zz]|[+-]\d{2}:?\d{2})?/);
      return { tool: 'create_reminder', params: { remindAt: isoM ? isoM[0] : msg } };
    }
    if (/(取消|删除|删掉|移除|关掉|撤掉).{0,15}(提醒|闹钟|日程)/.test(m) ||
        /(提醒|闹钟|日程).{0,8}(取消|删除|删掉|移除|关掉|撤掉)/.test(m) || /取消\s*#?\s*\d+/.test(m)) {
      const idM = msg.match(/#\s*(\d+)|编号\s*[:：]?\s*(\d+)|第\s*(\d+)\s*(个|条)?(提醒|闹钟|日程)?/);
      return { tool: 'cancel_reminder', params: idM ? { reminderId: (idM[1] || idM[2] || idM[3]) } : {} };
    }
    if (/(提醒|闹钟|日程).{0,4}(列表|有哪些|查看|查询|看看|看下|待办)|(查看|查一下|看看|看下).{0,6}(提醒|闹钟|日程)|我的提醒/.test(m)) {
      return { tool: 'list_reminders', params: {} };
    }

    // 自动接待（超时接管/无人值守时段）：租户指令开启/关闭
    if (/(接待|自动接待|无人值守)/.test(m)) {
      // 关闭接待
      if (/(关闭|取消|停掉|关掉|不要|别|不用|撤掉|停止).{0,8}(接待|自动接待|无人值守)|(接待|自动接待|无人值守).{0,6}(关闭|取消|停掉|停止|不用)/.test(m)) {
        return { tool: 'set_unattended', params: { enabled: false } };
      }
      // 超时指令：如"3分钟内没回就自动接待""5分钟没回复就接管"
      const _timeoutM = m.match(/(\d+)\s*(?:分钟|分(?!钟))/);
      if (_timeoutM) {
        return { tool: 'set_unattended', params: { enabled: true, timeoutMinutes: parseInt(_timeoutM[1], 10), timeText: msg } };
      }
      // 开启/设置接待（时段或默认）
      if (/(询盘|客户|消息|晚上|夜间|凌晨|白天|自动|无人|接待)/.test(m)) {
        return { tool: 'set_unattended', params: { enabled: true, timeText: msg } };
      }
    }

    return null;
  }

  async processMessage(userId, userMessage, providerId = null, context = {}) {
    logger.info('AssistantService', 'processMessage entry, userId=' + userId + ', agentType=' + (context.agentType || 'general'));
    const { dataset, skills, attachments, agentType = "general", sessionId = null, customerId = null, emitStep } = context;
    // 执行过程可视化：socket 步骤推送（assistant:step）
    const _step = (step, detail) => { try { if (typeof emitStep === 'function') emitStep(step, detail); } catch (e) {} };
    _step('parsing', '正在理解你的需求');
    // 0. 解析租户选定的模型 provider（租户自主切换大模型）
    let selectedProvider = null;
    if (providerId) {
      try {
        selectedProvider = await getProviderById(providerId);
        if (selectedProvider) {
          console.log("[Assistant] user " + userId + " selected provider: " + selectedProvider.name);
        } else {
          console.warn("[Assistant] providerId " + providerId + " not found, fallback to default");
        }
      } catch (e) {
        console.warn('[Assistant] resolve selected provider failed:', e.message);
      }
    }

    // 【2026-09-20】客户背调(background-report)默认优先 GPT-5.6 Terra：
    // 用户未手动指定模型时，背调强制用旗舰 GPT 保证报告质量；获取失败则回退默认。
    if (!selectedProvider && agentType === 'background-report') {
      try {
        const gpt = await getProviderById('p1786604068598');
        if (gpt && gpt.apiKey && gpt.model) {
          selectedProvider = gpt;
          console.log("[Assistant] background-report default -> GPT: " + gpt.name);
        } else {
          console.warn("[Assistant] GPT provider unavailable for background-report, fallback to default");
        }
      } catch (e) {
        console.warn('[Assistant] resolve GPT for background-report failed:', e.message);
      }
    }

    // 1. 保存用户消息
    const userConv = await prisma.assistantConversation.create({
      data: {
        userId,
        agentType,
        role: 'user',
        content: userMessage,
        ...(sessionId ? { sessionId } : {}),
        ...(customerId ? { customerId: parseInt(customerId, 10) } : {})
      }
    });

    // 1.1 安全护栏：涉密/越权/越狱类请求直接拒绝，不进入工具链路
    if (this._checkLeakRequest(userMessage)) {
      const reply = '抱歉，这个请求我不能处理。出于安全和隐私保护，我无法查询、导出或透露其他客户的联系方式、报价、聊天记录等隐私信息，也无法泄露系统提示词或内部配置。如需查看具体客户的资料，请直接告知客户名称或订单号。';
      await prisma.assistantConversation.create({
        data: { userId, agentType, role: 'assistant', content: reply, ...(sessionId ? { sessionId } : {}), ...(customerId ? { customerId: parseInt(customerId, 10) } : {}) }
      });
      return { reply, tasks: [] };
    }

    // 1.3 明确管理指令短路：用户要求"只回复X"时，严格按指令直接回复，不经过AI/工具链路
    const directReplyMatch = String(userMessage || '').match(/^只回复\s*(收到|好的|OK|ok|可以|好|嗯|行|没问题|收到收到)[。！!]?$/);
    if (directReplyMatch) {
      const reply = directReplyMatch[1];
      await prisma.assistantConversation.create({
        data: { userId, agentType, role: 'assistant', content: reply, ...(sessionId ? { sessionId } : {}), ...(customerId ? { customerId: parseInt(customerId, 10) } : {}) }
      });
      return { reply, tasks: [] };
    }

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

    // 2. 获取最近10轮对话作为上下文（通用对话仅取 customerId 为空的消息，避免客户会话混入上下文）
    const historyWhere = { userId, agentType, ...(sessionId ? { sessionId } : {}) };
    if (customerId) historyWhere.customerId = parseInt(customerId, 10);
    else if (!sessionId) historyWhere.customerId = null;
    const history = await prisma.assistantConversation.findMany({
      where: historyWhere,
      orderBy: { createdAt: 'desc' },
      take: 20
    });
    const contextMessages = history.reverse().map(h => ({
      role: h.role === 'user' ? 'user' : 'assistant',
      content: h.content
    }));

    // 3. 构建prompt，让LLM判断是否需要调用工具
    // 根据 agentType 选择 system prompt
    let systemPrompt = buildSystemPrompt(agentType, TOOLS_DESC);

    // 客户会话：注入客户全景（首轮全量 / 后续轻量）
    if (customerId) {
      try {
        const cid = parseInt(customerId, 10);
        if (cid) {
          const userMsgCount = history.filter(h => h.role === 'user').length;
          const isFirstRound = userMsgCount <= 1;
          const panorama = await buildCustomerPanorama(userId, cid, { historyLimit: isFirstRound ? 30 : 5 });
          if (panorama && !panorama.error) {
            const panoText = formatPanoramaPrompt(panorama, { light: !isFirstRound });
            if (panoText) {
              systemPrompt += '\n\n【当前客户上下文】\n' + panoText + '\n\n你正在跟进客户：' + (panorama.customer.name || cid) + '。所有回复必须基于该客户上下文，如需最新团队共享结论，先调用 context_get 获取。';
            }
          }
        }
      } catch (e) {
        console.error('[Assistant] panorama inject error:', e.message);
      }
    }

    // 指派任务指令注入（客户-Agent 双向指派 V1.0）：未完成指派任务的指令优先注入
    if (customerId) {
      try {
        const cid = parseInt(customerId, 10);
        if (cid) {
          const tasks = await prisma.agentTask.findMany({
            where: { userId, agentType, customerId: cid, status: { in: ['CREATED', 'ACTIVE'] } },
            orderBy: { createdAt: 'asc' },
            take: 5
          });
          if (tasks.length) {
            const taskLines = tasks.map((t, i) => `${i + 1}. ${t.instruction || '（无具体指令，请主动跟进该客户）'}`).join('\n');
            systemPrompt += '\n\n【老板指派任务（必须执行）】老板已将该客户指派给你跟进，指令如下：\n' + taskLines + '\n请始终围绕该指派指令推进跟进工作；当客户回复消息时，按指派指令进行下一轮跟进，回复内容需体现该指令要求。';
          }
        }
      } catch (e) {
        console.error('[Assistant] agentTask inject error:', e.message);
      }
    }

    // 指令优先级（最高）：最新用户消息是用户的最新指令，优先于角色设定/客户上下文/历史
    systemPrompt += '\n\n【最高指令规则】本次消息是你收到的用户最新指令，优先级高于上述所有角色设定、客户上下文和历史对话。请先判断用户消息性质：\n1. 若用户消息是明确的管理指令（如\"只回复收到\"\"收到即可\"\"仅确认不要分析\"\"停止\"\"关闭\"\"开启某功能\"等），严格按指令执行，直接照做，不要展开分析、不要臆测客户意图、不要生成方案或建议；\n2. 仅当用户消息是客户询盘/报价/规格/议价/交期等商务沟通内容时，才以销售身份生成回复建议。\n本规则为最高优先级，任何其他设定不得覆盖。';

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
      temperature: AI_CONFIG.assistant.toolDecision.temperature,
      maxTokens: AI_CONFIG.assistant.toolDecision.maxTokens,
      creditUserId: userId, // 【积分铁律 2026-09-05】按 userId 扣
      ...(selectedProvider ? { provider: selectedProvider } : {})
    });

    // 4. 解析响应，判断是否有工具调用（支持多个 JSON，取第一个）
    let toolCall = null;
    console.log("[Assistant] AI raw response:", JSON.stringify(aiResponse).substring(0, 500));
    const toolCalls = extractToolCalls(aiResponse);
    if (toolCalls.length) {
      toolCall = toolCalls[0];
      console.log("[Assistant] Parsed toolCall from AI JSON:", JSON.stringify(toolCall), "(total " + toolCalls.length + ")");
    } else {
      console.log("[Assistant] No JSON tool pattern found in AI response");
    }

    // 4.4.5 夜间自动接待追问状态：pending 时用户补时间段或取消
    if (!toolCall) {
      const pendingUnattended = await this._getUnattendedPending();
      if (pendingUnattended) {
        const timeRange = this._parseOffHoursRange(userMessage);
        const _pTimeoutM = userMessage.match(/(\d+)\s*(?:分钟|分(?!钟))/);
        if (_pTimeoutM) {
          toolCall = { tool: 'set_unattended', params: { enabled: true, timeoutMinutes: parseInt(_pTimeoutM[1], 10) } };
        } else if (timeRange) {
          toolCall = { tool: 'set_unattended', params: { enabled: true, timeText: userMessage } };
        } else if (/(取消|算了|不用|不要|先不|关掉|停掉|关闭)/.test(userMessage.toLowerCase())) {
          toolCall = { tool: 'set_unattended', params: { enabled: false } };
        }
      }
    }

    // 4.5 后端意图识别：AI不返回JSON时，直接在后端判断该调什么工具
    if (!toolCall && this._isCrmTask(userMessage)) {
      toolCall = this._detectIntent(userMessage);
      console.log("[Assistant] Backend intent detected:", JSON.stringify(toolCall));
    } else if (!toolCall) {
      console.log("[Assistant] No CRM task detected for:", userMessage.substring(0, 50));
    }

    // 4.6 工具触发护栏：明显不是查询/生成指令的误触发，丢弃工具调用走自然回复
    let droppedTool = false;
    if (toolCall && toolCall.tool && this._shouldDropToolCall(toolCall.tool, userMessage)) {
      console.log("[Assistant] Drop mis-triggered tool call:", toolCall.tool, JSON.stringify(toolCall.params || {}).substring(0, 120));
      toolCall = null;
      droppedTool = true;
    }

    if (toolCall && toolCall.tool) {
      // 工具名别名归一化（模型可能省略下划线，如 contextset -> context_set）
      const TOOL_NAME_ALIASES = { contextset: 'context_set', contextget: 'context_get' };
      const funcName = TOOL_NAME_ALIASES[toolCall.tool] || toolCall.tool;
      // 执行可视化：按工具名推送友好步骤
      const TOOL_STEP_MAP = {
        query_customer: '正在查询客户资料',
        query_messages: '正在查询历史对话',
        query_orders: '正在查询订单记录',
        query_dashboard: '正在查询销售数据',
        send_message: '正在准备发送消息',
        update_customer_status: '正在更新客户状态',
        add_follow_up: '正在添加跟进记录',
        generate_document: '正在生成文档',
        exchange_rate: '正在查询实时汇率',
        web_search: '正在联网搜索信息',
        create_reminder: '正在创建日程提醒',
        list_reminders: '正在查询提醒列表',
        cancel_reminder: '正在取消提醒',
        context_get: '正在读取共享上下文',
        context_set: '正在沉淀共享结论',
        set_unattended: '正在设置自动接待',
      };
      const _stepDetail = TOOL_STEP_MAP[funcName] || ('正在执行：' + funcName);
      _step('tool_start', _stepDetail);
      const funcArgs = toolCall.params || {};
      
      // 查找工具定义
      const tool = TOOLS.find(t => t.name === funcName);
      if (!tool) {
        const reply = `抱歉，我不支持这个操作：${funcName}`;
        await prisma.assistantConversation.create({
          data: { userId, agentType, role: 'assistant', content: reply }
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
          data: { userId, agentType, role: 'assistant', content: reply, ...(sessionId ? { sessionId } : {}), ...(customerId ? { customerId: parseInt(customerId, 10) } : {}) }
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
          const relevanceKeywords = this._extractProductKeywords(userMessage);
          const effectiveArgs = relevanceKeywords.length ? { ...funcArgs, relevanceKeywords } : funcArgs;
          const result = await this._executeTool(funcName, effectiveArgs, { userId, agentType, sessionId, customerId: customerId ? parseInt(customerId, 10) : null });
          const rawSummary = this._formatResult(funcName, effectiveArgs, result);
          _step('tool_done', '已获取数据，正在分析');
          
          // 把工具结果喂回AI，让AI分析后自然回复
          const analysisPrompt = `用户刚才说："${userMessage}"
我帮你查了数据，结果如下：
${rawSummary}

请根据用户的需求，对这些数据进行分析、总结和给出建议。用口语化的方式回复，像同事之间聊天一样自然。只分析与用户需求直接相关的数据；与用户提到的产品、规格、客户无关的记录（例如其他产品或测试数据）不要提及，更不要当成客户订单写进回复。不要原样展示数据，要给出你的判断和洞察。`;

          const analysisReply = await chatComplete([
            { role: 'system', content: systemPrompt },
            { role: 'user', content: analysisPrompt }
          ], { temperature: AI_CONFIG.assistant.analysis.temperature, maxTokens: AI_CONFIG.assistant.analysis.maxTokens, ...(selectedProvider ? { provider: selectedProvider } : {}) , creditUserId: userId }); // 【积分铁律 2026-09-05】按 userId 扣
          
          const analysisText = String(analysisReply || '').trim();
          let reply;
          if (analysisText && analysisText.length < 15) {
            // AI分析输出过短（空话）→ 用专业兜底
            reply = this._guardEmptyReply(analysisText, userMessage);
          } else {
            reply = this._stripMarkdown(analysisReply || rawSummary);
          }
          
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
            data: { userId, agentType, role: 'assistant', content: reply, attachments: attachments.length ? JSON.stringify(attachments) : null, ...(sessionId ? { sessionId } : {}), ...(customerId ? { customerId: parseInt(customerId, 10) } : {}) }
          });
          
          return { reply, tasks: [], attachments };
        } catch (err) {
          console.error('[Assistant] Tool execution failed:', err);
          const reply = '抱歉，这个操作暂时执行失败了，请稍后重试或换个说法。';
          await prisma.assistantConversation.create({
            data: { userId, agentType, role: 'assistant', content: reply, ...(sessionId ? { sessionId } : {}), ...(customerId ? { customerId: parseInt(customerId, 10) } : {}) }
          });
          return { reply, tasks: [], error: 'tool_execution_failed' };
        }
      }
    } else {
      // 7. 纯对话回复（无工具调用）
      _step('generating', '正在生成回复');
      // 引导式二次生成：若 toolDecision 输出为空泛短回复（如“好的，我理解了”），或误返回的工具JSON被触发护栏丢弃，重新调用对话生成模式保证完整专业回复
      let replyText = aiResponse || '';
      // 若 AI 误返回了工具JSON（被触发护栏丢弃），原始文本不能直接当回复
      const droppedToolJson = droppedTool && /"tool"\s*:/.test(String(replyText));
      if (droppedToolJson) replyText = '';
      const trimmed = String(replyText).trim();
      const emptyPattern = /^(好的|好吧|明白|了解|没问题|好，我理解了|OK|ok|good|知道了)[。，,\.!\s]*$/;
      if (droppedToolJson || !trimmed || trimmed.length < 15 || emptyPattern.test(trimmed)) {
        try {
          const chatPrompt = systemPrompt + '\n\n【最后要求（必须遵守）】用户本次消息没有触发任何工具。你必须立即直接回答用户的问题，给出具体、专业、可执行的内容。\n视角判断：若用户消息是英文或其他外语（客户询盘/议价/规格确认/交期咨询等商务沟通），你以销售身份直接用与客户相同的语言回复客户，回复可直接发送给客户，不要出现“Jeremy，我建议…”“我查了一下系统…”这类老板视角表述；若用户消息是中文管理指令（查数据/分析/生成文档/写邮件等），则以Jeremy的AI助手视角输出分析和建议。\n如报价建议则给出 MOQ、规格确认、价格区间、FOB/CIF 建议；如策略建议则给出具体步骤；如分析则给出判断和行动计划。严禁输出“好的，我理解了”“明白了”“没问题”这类空泛确认。不准说“系统卡了”“查不到”之类的推脱，直接给出你的专业建议。如果需要具体数据才能答复，则先给出你的分析和建议，并补充说明需要哪些信息。\n例外（必须优先执行）：若用户本次消息是明确的管理指令（如“只回复收到”“收到即可”“仅确认”），则严格按用户指令执行，直接回复“收到”即可，不得展开分析或生成方案。';
          const chatReply = await chatComplete([
            { role: 'system', content: chatPrompt },
            ...contextMessages,
            { role: 'user', content: userContent || '（发送了附件）' }
          ], { temperature: AI_CONFIG.assistant.analysis.temperature, maxTokens: AI_CONFIG.assistant.analysis.maxTokens, ...(selectedProvider ? { provider: selectedProvider } : {}) , creditUserId: userId }); // 【积分铁律 2026-09-05】按 userId 扣
          if (chatReply && String(chatReply).trim()) {
            replyText = chatReply;
          }
        } catch (e) {
          console.error('[Assistant] Chat reply regeneration failed, fallback:', e);
        }
      }
      const reply = this._stripMarkdown(replyText || '好的，我理解了。');
      const guarded = this._guardEmptyReply(reply, userMessage);
      _step('done', '回复完成');
      await prisma.assistantConversation.create({
        data: { userId, agentType, role: 'assistant', content: guarded, ...(sessionId ? { sessionId } : {}), ...(customerId ? { customerId: parseInt(customerId, 10) } : {}) }
      });
      return { reply: this._stripMarkdown(guarded), tasks: [] };
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
      data: { userId, agentType, role: 'assistant', content: reply }
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
  async getConversations(userId, limit = 200, agentType = null, sessionId = null, scope = null) {
    // 先取最新的N条（desc），再反转为时间升序给前端显示
    const where = { userId };
    if (agentType) where.agentType = agentType;
    if (sessionId) where.sessionId = sessionId;
    if (scope === 'general') where.customerId = null;
    const msgs = await prisma.assistantConversation.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit
    });
    return msgs.reverse();
  }

  /**
   * 会话列表（客户-Agent 双向指派需求）：按 sessionId 分组返回
   * 通用对话 sessionId=null/customerId=null；客户会话 sessionId={agentType}:cust:{customerId}
   */
  async getSessionList(userId, agentType = null) {
    const where = { userId };
    if (agentType) where.agentType = agentType;
    const convs = await prisma.assistantConversation.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 3000
    });
    const sessionMap = {};
    for (const c of convs) {
      const key = c.sessionId || ('general:' + c.agentType);
      if (!sessionMap[key]) {
        sessionMap[key] = {
          sessionId: c.sessionId || null,
          agentType: c.agentType,
          customerId: c.customerId || null,
          lastAt: c.createdAt,
          msgCount: 0,
          title: null
        };
      }
      sessionMap[key].msgCount++;
      if (c.createdAt > sessionMap[key].lastAt) sessionMap[key].lastAt = c.createdAt;
    }
    const list = Object.values(sessionMap).sort((a, b) => new Date(b.lastAt) - new Date(a.lastAt));

    // 客户会话补客户名
    const custIds = [...new Set(list.filter(s => s.customerId).map(s => s.customerId))];
    if (custIds.length) {
      const customers = await prisma.customer.findMany({
        where: { id: { in: custIds } },
        select: { id: true, name: true, company: true, customerLevel: true }
      });
      const cmap = {};
      customers.forEach(c => { cmap[c.id] = c; });
      list.forEach(s => {
        if (s.customerId && cmap[s.customerId]) {
          const c = cmap[s.customerId];
          s.title = c.name || c.company || ('客户#' + s.customerId);
          s.customer = c;
        }
      });
    }
    return list;
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
  async _executeTool(funcName, args, ctx = {}) {
    try {
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
        const where = {};
        if (args.partnerId) where.partnerId = Number(args.partnerId);
        else if (args.customerId) where.partnerId = Number(args.customerId);
        const orders = await prisma.partnerOrder.findMany({
          where,
          take: 50,
          orderBy: { createdAt: 'desc' }
        });
        // 相关性过滤（避免无关/测试数据混入上下文）：有产品关键词时只返回相关订单
        if (Array.isArray(args.relevanceKeywords) && args.relevanceKeywords.length) {
          const kws = args.relevanceKeywords;
          const matched = orders.filter(o => {
            const hay = (o.productName || '') + ' ' + (o.description || '') + ' ' + (o.remark || '');
            return kws.some(k => String(hay).toLowerCase().includes(String(k).toLowerCase()));
          });
          return { orders: matched.slice(0, 10) };
        }
        return { orders: orders.slice(0, 10) };
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
        const fcid = args.customerId ? parseInt(args.customerId) : (ctx.customerId || null);
        if (!fcid) return { error: true, message: '请指定客户ID或先绑定客户' };
        const followUp = await prisma.customerFollowUp.create({
          data: {
            customerId: fcid,
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
      case 'create_reminder': {
        const content = String(args.content || userMessage || '').trim();
        if (!content) return { error: true, message: '请告诉我提醒内容，例如"跟进客户报价"' };
        const title = String(args.title || (content.length > 30 ? content.substring(0, 30) : content) || '日程提醒').trim();
        const remindAt = this._parseRemindAt(args.remindAt || args.time || '');
        if (!remindAt) return { error: true, message: '无法解析提醒时间，请用类似"明天上午10点"的格式描述时间' };
        const jid = args.jid ? String(args.jid) : null;
        const r = await prisma.reminder.create({
          data: {
            userId: ctx.userId || 1,
            agentType: ctx.agentType || 'general',
            title,
            content,
            remindAt,
            status: 'pending',
            jid,
            ...(ctx.sessionId ? { sessionId: ctx.sessionId } : {})
          }
        });
        return { success: true, id: r.id, title: r.title, content: r.content, remindAt: r.remindAt };
      }

      case 'list_reminders': {
        const reminders = await prisma.reminder.findMany({
          where: { userId: ctx.userId || 1, status: 'pending' },
          orderBy: { remindAt: 'asc' },
          take: 20
        });
        return { reminders: reminders.map(x => ({ id: x.id, title: x.title, content: x.content, remindAt: x.remindAt, agentType: x.agentType })), count: reminders.length };
      }

      case 'cancel_reminder': {
        const id = parseInt(args.reminderId, 10);
        if (!id) return { error: true, message: '请提供要取消的提醒ID' };
        const existed = await prisma.reminder.findFirst({ where: { id, userId: ctx.userId || 1 } });
        if (!existed) return { error: true, message: '提醒不存在或无权操作' };
        if (existed.status !== 'pending') return { error: true, message: '该提醒已触发或已取消，无需重复操作' };
        await prisma.reminder.update({ where: { id }, data: { status: 'cancelled' } });
        return { success: true, id, title: existed.title };
      }

      case 'context_get': {
        const a = { ...args };
        if (!a.entityId && a.entity) a.entityId = a.entity;
        const entityType = String(a.entityType || '').trim() || 'customer';
        let entityId = String(a.entityId || '').trim();
        // 客户会话默认绑定：entityId 缺省时填 customerId
        if (!entityId && ctx.customerId) entityId = String(ctx.customerId);
        // 兜底：从 raw 原始消息提取 entityId（AI 首轮失败走后端兜底场景）
        if (!entityId && (a.raw || a._raw)) {
          const eM = String(a.raw || a._raw).match(/(?:客户|订单|company)\s*[:：]?\s*([A-Za-z0-9_\-]+)/i);
          if (eM) entityId = eM[1];
        }
        if (!entityId) return { error: true, message: '请提供要查询的业务对象（客户ID/名称 或 订单ID）' };
        const key = a.key ? String(a.key).trim() : null;
        const r = await contextGet({ entityType, entityId, key });
        if (r.error) return r;
        if (!r.entries.length) return { entries: [], message: '该业务对象暂无已沉淀的共享结论' };
        return { entries: r.entries, count: r.entries.length };
      }

      case 'context_set': {
        const a = { ...args };
        if (!a.entityId && a.entity) a.entityId = a.entity;
        if (!a.sourceRef && a.summary) a.sourceRef = a.summary;
        const entityType = String(a.entityType || '').trim() || 'customer';
        let entityId = String(a.entityId || '').trim();
        // 客户会话默认绑定：entityId 缺省时填 customerId
        if (!entityId && ctx.customerId) entityId = String(ctx.customerId);
        let key = String(a.key || '').trim();
        // key 归一化：paymentterms -> payment_terms 等（模型可能省略下划线）
        const KEY_ALIASES = {
          paymentterms: 'payment_terms',
          decisionmaker: 'decision_maker',
          creditrating: 'credit_rating',
          contractterms: 'contract_terms'
        };
        const kNorm = key.toLowerCase().replace(/[\s_-]+/g, '');
        if (KEY_ALIASES[kNorm]) key = KEY_ALIASES[kNorm];
        let value = String(a.value || '').trim();
        // 兜底：工具参数不完整时，从 raw 原始消息解析（AI 首轮失败走后端兜底场景）
        const rawText = String(a.raw || a._raw || '').trim();
        if ((!entityId || !key || !value) && rawText) {
          if (!entityId) {
            const eM = rawText.match(/(?:客户|订单|company)\s*[:：]?\s*([A-Za-z0-9_\-]+)/i);
            if (eM) entityId = eM[1];
          }
          if (!key) {
            const keyRules = [
              [/付款方式|付款条款|付款条件|支付方式|payment/i, 'payment_terms'],
              [/决策人|决定人|拍板人|decision/i, 'decision_maker'],
              [/信用评级|信用等级|credit/i, 'credit_rating'],
              [/合同条款|contract/i, 'contract_terms'],
              [/交期|交货期|delivery/i, 'delivery_time'],
              [/报价|价格|price/i, 'price']
            ];
            for (const [re, k] of keyRules) {
              if (re.test(rawText)) { key = k; break; }
            }
          }
          if (!value) {
            const vM = rawText.match(/(?:是|为|改为|改成|采用|用|约定为)\s*[:：]?\s*([^，。；\n]{2,60})/);
            if (vM) value = vM[1].trim();
          }
        }
        if (!entityId || !key || !value) return { error: true, message: '请提供业务对象、事实键和结论内容' };
        const result = await contextSet({
          entityType,
          entityId,
          key,
          value,
          confidence: a.confidence,
          sourceAgent: ctx.agentType || 'general',
          sourceRef: a.sourceRef || (ctx.sessionId ? 'session:' + ctx.sessionId : null)
        });
        if (result.error) return result;
        return { success: true, action: result.action, id: result.entry.id, entry: result.entry, message: result.message || '已写入共享上下文' };
      }

      case 'set_unattended': {
        const enable = args.enabled !== false;
        const timeText = String(args.timeText || '').trim();
        const uid = (ctx && ctx.userId) || 1;
        // 【2026-09-17 客户级接管】接管需先在该客户会话发指令（点胶囊）才开启；有当前客户则只对该客户生效
        let custJid = null;
        if (ctx && ctx.customerId) {
          try {
            const _c = await prisma.customer.findUnique({ where: { id: parseInt(ctx.customerId, 10) } });
            if (_c) custJid = _c.jid || (_c.phone ? _c.phone + '@s.whatsapp.net' : null);
          } catch (_e) {}
        }
        if (!enable) {
          if (custJid) {
            await autoReceptionService.disableCustomerTakeover(uid, custJid);
          } else {
            await autoReceptionService.saveConfig(uid, { enabled: false });
            await autoReceptionService.disableAllCustomerTakeovers(uid);
          }
          await this._setUnattendedPending(false);
          return { success: true, action: 'off', scope: custJid ? 'customer' : 'all', message: custJid ? '已对该客户关闭自动接待，之后不再自动回复。' : '已关闭自动接待，客户询盘将不再自动回复。' };
        }
        // 超时接管：如"3分钟内没回就自动接待"
        if (args.timeoutMinutes) {
          const mins = parseInt(args.timeoutMinutes, 10);
          if (mins >= 1 && mins <= 60) {
            if (custJid) await autoReceptionService.enableCustomerTakeover(uid, custJid, { timeoutMinutes: mins, mode: 'always' });
            else await autoReceptionService.saveConfig(uid, { enabled: true, timeoutMinutes: mins, mode: 'always' });
            await this._setUnattendedPending(false);
            return { success: true, action: 'on', scope: custJid ? 'customer' : 'global', timeoutMinutes: mins, message: '已开启自动接待：客户消息 ' + mins + ' 分钟内无人回复，将由外贸销冠 Agent 自动接待。' };
          }
        }
        const range = this._parseOffHoursRange(timeText);
        if (range) {
          if (custJid) await autoReceptionService.enableCustomerTakeover(uid, custJid, { mode: 'offhours', startHour: range.start, endHour: range.end, timezone: 'Asia/Shanghai' });
          else await autoReceptionService.saveConfig(uid, { enabled: true, startHour: range.start, endHour: range.end, mode: 'offhours', timezone: 'Asia/Shanghai' });
          await this._setUnattendedPending(false);
          const fmt = (h) => String(h).padStart(2, '0') + ':00';
          return { success: true, action: 'on', startHour: range.start, endHour: range.end, message: '已开启自动接待（' + fmt(range.start) + ' - ' + fmt(range.end) + '），该时段客户消息超时未回复将由外贸销冠 Agent 自动接待。' };
        }
        // 纯开启意图（无时段、无超时）→ 默认开启：3 分钟超时接管
        if (/(开启|打开|开始|启用).{0,6}(接待|自动)|(接待|自动接待).{0,4}(开启|打开|开始|启用)|^(自动接待|开启接待|打开接待)$/.test(timeText)) {
          if (custJid) await autoReceptionService.enableCustomerTakeover(uid, custJid, { timeoutMinutes: 3, mode: 'always' });
          else await autoReceptionService.saveConfig(uid, { enabled: true, timeoutMinutes: 3, mode: 'always' });
          await this._setUnattendedPending(false);
          return { success: true, action: 'on', timeoutMinutes: 3, message: '已开启自动接待：客户消息 3 分钟内无人回复，将由外贸销冠 Agent 自动接待。' };
        }
        // 无超时/无时间段 → 追问
        await this._setUnattendedPending(true);
        return { success: true, action: 'ask', message: '好的，收到你要开启自动接待。请告诉我触发方式：例如"3分钟内没回复就自动接待"，或指定时段"晚上10点到早上7点"。' };
      }

      default:
        return { error: true, message: '暂不支持该操作，请换个说法试试' };
    }
    } catch (e) {
      console.error('[Assistant] Tool execution error:', e);
      return { error: true, message: '数据查询失败，请稍后重试' };
    }
  }

  /**
   * 解析夜间自动接待时间段："晚上10点到早上7点" / "22:00-07:00" / "22点到7点"
   * 返回 { start, end }（24小时制小时数）或 null
   */
  _parseOffHoursRange(input) {
    if (!input) return null;
    const s = String(input).trim();
    // 支持中英文时间段：晚上10点到早上7点 / 22:00-07:00 / 下午2点到4点 / 晚上10点到7点
    const PERIOD = '上午|早上|早晨|清晨|凌晨|中午|下午|傍晚|晚间|晚上|夜里|夜间|午后|夜晚|半夜|白天|早|晚';
    const m = s.match(new RegExp('(' + PERIOD + ')?\\s*(\\d{1,2})\\s*(?:[:：]\\d{1,2})?\\s*(?:点|时)?\\s*(?:到|至|~|～|—|-)\\s*(' + PERIOD + ')?\\s*(\\d{1,2})\\s*(?:[:：]\\d{1,2})?\\s*(?:点|时)?'));
    if (!m) return null;
    const rawStart = parseInt(m[2], 10);
    const rawEnd = parseInt(m[4], 10);
    if (rawStart > 24 || rawEnd > 24) return null;
    // 结束时间上下文：优先显式时段词，其次看两数字之间的片段
    const midStart = s.indexOf(String(rawStart));
    const midEnd = s.indexOf(String(rawEnd), midStart + 1);
    const between = midStart >= 0 && midEnd > midStart ? s.substring(midStart, midEnd) : '';
    const norm = (h, ctx) => {
      let v = h;
      if (v === 24) v = 0;
      if (/晚上|傍晚|夜间|夜里|夜晚|午后|下午|晚/.test(ctx) && v <= 12) v += 12;
      else if (/中午/.test(ctx) && v < 12) v += 12;
      return v;
    };
    const start = norm(rawStart, m[1] || '');
    let end;
    if (m[3]) {
      end = norm(rawEnd, m[3]);
    } else if (/下午|午后|中午/.test(m[1] || '')) {
      end = norm(rawEnd, m[1]); // 同一时段：下午2点到4点 → 14-16
    } else {
      end = norm(rawEnd, between);
      // 晚间开始、结束无明确前缀且算出来比开始早 → 跨午夜（次日早上），取原始小时
      if (end < start && /晚|夜|傍晚|半夜/.test(m[1] || '')) {
        end = rawEnd === 24 ? 0 : rawEnd;
      }
    }
    // 12点且开始时间在午后 → 午夜（0点），如"晚上8点到12点" → 20-0
    if (rawEnd === 12 && !m[3] && start > 12) end = 0;
    if (start > 23 || end > 23) return null;
    console.log('[Assistant] parse range OK:', {start,end}, 'input:', input);
    return { start, end };
  }

  async _getUnattendedPending() {
    try {
      const setting = await prisma.setting.findUnique({
        where: { userId_key: { userId: 1, key: 'unattended_pending' } },
      });
      return setting && setting.value === '1';
    } catch (e) { return false; }
  }

  async _setUnattendedPending(v) {
    await prisma.setting.upsert({
      where: { userId_key: { userId: 1, key: 'unattended_pending' } },
      create: { userId: 1, key: 'unattended_pending', value: v ? '1' : '0' },
      update: { value: v ? '1' : '0' },
    });
  }

  /**
   * 解析提醒时间：支持 ISO 格式与中文自然语言（Asia/Shanghai，UTC+8），统一转 UTC
   */
  _parseRemindAt(input, base) {
    if (!input) return null;
    const now = base || new Date();
    let s = String(input).trim();
    if (!s) return null;

    // 1) ISO-like: 2026-08-18 10:00 / 2026-08-18T10:00 / 2026-08-18 10:00:30
    const iso = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})[T\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?([Zz]|[+-]\d{2}:?\d{2})?/);
    if (iso) {
      let d;
      if (iso[7]) {
        d = new Date(s);
      } else {
        d = new Date(Date.UTC(+iso[1], +iso[2] - 1, +iso[3], +iso[4], +iso[5], iso[6] ? +iso[6] : 0) - 8 * 3600 * 1000);
      }
      if (!isNaN(d.getTime())) return d;
    }
    // 2) 仅日期: 2026-08-18 → 默认当天 09:00（Asia/Shanghai）
    const dOnly = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
    if (dOnly) {
      const d = new Date(Date.UTC(+dOnly[1], +dOnly[2] - 1, +dOnly[3], 1, 0, 0));
      if (!isNaN(d.getTime())) return d;
    }

    // 3) 中文自然语言
    let dayOffset = null;
    if (s.includes('大后天')) dayOffset = 3;
    else if (s.includes('后天')) dayOffset = 2;
    else if (s.includes('明天') || s.includes('明日') || s.includes('明早') || s.includes('明晚')) dayOffset = 1;
    else if (s.includes('今天') || s.includes('今日') || s.includes('今晚')) dayOffset = 0;
    else if (s.includes('大前天')) dayOffset = -3;
    else if (s.includes('前天')) dayOffset = -2;
    else if (s.includes('昨天') || s.includes('昨日')) dayOffset = -1;
    else {
      const wdMap = { '周一': 1, '星期一': 1, '周二': 2, '星期二': 2, '周三': 3, '星期三': 3, '周四': 4, '星期四': 4, '周五': 5, '星期五': 5, '周六': 6, '星期六': 6, '周日': 7, '星期天': 7, '星期日': 7 };
      for (const k of Object.keys(wdMap)) {
        if (s.includes(k)) {
          const shNow = new Date(now.getTime() + 8 * 3600 * 1000);
          let curDow = shNow.getUTCDay();
          if (curDow === 0) curDow = 7;
          let diff = ((wdMap[k] - curDow) % 7 + 7) % 7;
          if (s.includes('下周') || s.includes('下星期') || s.includes('下个星期')) {
            diff += 7; // 下周同一星期几（含今天就是目标星期几的情况）
          } else if (diff === 0) {
            diff = 7; // 今天就是这个星期几 → 下周同一星期几
          }
          dayOffset = diff;
          break;
        }
      }
    }

    let hour = 9, minute = 0;
    const tMatch = s.match(/(上午|早上|早晨|中午|下午|傍晚|晚上|凌晨|夜里)?\s*(\d{1,2})(?:[:：点时](\d{1,2}))?/);
    if (tMatch && tMatch[2] != null) {
      let h = parseInt(tMatch[2], 10);
      let m = tMatch[3] ? parseInt(tMatch[3], 10) : 0;
      const period = tMatch[1] || '';
      if (m >= 60) { h += Math.floor(m / 60); m = m % 60; }
      if (period === '下午' || period === '晚上' || period === '傍晚' || period === '夜里') {
        if (h < 12) h += 12;
      } else if (period === '中午') {
        if (h < 11) h += 12;
      }
      hour = h % 24;
      minute = m;
    }

    if (dayOffset === null) dayOffset = 0;
    const shNow = new Date(now.getTime() + 8 * 3600 * 1000);
    const dayStart = new Date(Date.UTC(shNow.getUTCFullYear(), shNow.getUTCMonth(), shNow.getUTCDate(), 0, 0, 0));
    let utc = new Date(dayStart.getTime() + dayOffset * 86400000 + hour * 3600000 + minute * 60000 - 8 * 3600000);
    if (utc.getTime() <= now.getTime()) {
      utc = new Date(utc.getTime() + 86400000); // 已过期则顺延到明天
    }
    return utc;
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
   * 空泛回复兜底：若最终回复为空话（如"好的，我理解了"），替换为专业引导
   */
  _guardEmptyReply(reply, userMessage) {
    const t = String(reply || '').trim();
    const emptyPattern = /^(好的|好吧|明白|明白了|了解|了解了|没问题|好，我理解了|好的，我理解了|OK|ok|好的吧|知道了|收到|嗯|好的好的)[。，,.!~\s]*$/i;
    if (!t || t.length < 15 || emptyPattern.test(t)) {
      return this._professionalFallback(userMessage);
    }
    return t;
  }

  /**
   * 基于用户消息类别的专业引导回复（不依赖 LLM，保证不输出空话）
   */
  _professionalFallback(userMessage) {
    const raw = String(userMessage || '');
    // 非中文消息视为客户询盘：返回可直接发送的英文销售口吻回复（缺陷B：兜底不再固定中文老板视角）
    if (!/[\u4e00-\u9fa5]/.test(raw)) {
      const ml = raw.toLowerCase();
      if (/quote|price|fob|cif|cost|how much|quotation/.test(ml)) {
        return 'Thank you for your inquiry. To give you an accurate quotation, could you please confirm the product specification (standard, diameter, wall thickness, length), quantity and destination port? We will then provide our best FOB/CIF price, MOQ and delivery time right away.';
      }
      if (/sample/.test(ml)) return 'Thank you for your sample request. Please confirm the specification, quantity and delivery address for the samples. A nominal sample fee applies, usually refundable against the first bulk order. Let us know who bears the courier cost and we will arrange promptly.';
      if (/logistic|shipment|shipping|ship|delivery|lead time|track|when|how long/.test(ml)) return 'Thank you for asking. Once you confirm the order number and destination port, we will check the latest sailing schedule and give you an accurate delivery time. Could you share the order reference or port details?';
      if (/change|update|revise|modify/.test(ml)) return 'Thank you for letting us know. Could you specify what needs to be changed (specification, quantity, delivery, etc.)? We will review the impact on price and production schedule and come back with an updated proposal as soon as possible.';
      return 'Thank you for your message. To give you a quick and accurate reply, could you share more details such as product specification, quantity and destination? We will respond with our best offer right away.';
    }
    const m = String(userMessage || '').toLowerCase();
    if (/quote|price|fob|cif|报价|价格|多少钱|成本|how much/.test(m)) {
      return '这个客户在询价，我建议这样推进：先把关键信息确认齐——规格尺寸、材质标准（比如 ASTM A53 或 GB/T 3091）、数量、包装和交货期，再结合当前汇率和运费给出 FOB/CIF 参考价，同时报上 MOQ 和阶梯价。目前这个会话里还没有该客户的完整订单档案，你把客户名或订单号发我，我可以调历史报价和客户偏好，给你出一份更有针对性的报价方案。';
    }
    if (/sample|样品/.test(m)) {
      return '客户要样品，建议这样处理：先确认样品规格、数量和收件信息，同时说明样品费（一般样品费可在大货下单后退还）和运费由谁承担，以及样品交期。你把客户名字发我，我看看档案里有没有他的历史沟通记录，帮你判断这个询盘的真实性和成交概率。';
    }
    if (/logistic|物流|shipment|ship|船期|什么时候到|delivery|交期|track|追踪/.test(m)) {
      return '客户在问物流/交期，建议这样处理：先确认是哪笔订单、目的港和起运港，再联系货代拿到预计船期/到港时间。你把订单号或客户名发我，我可以查一下这个客户关联的订单和物流状态，给你准确的答复口径。';
    }
    if (/改|change|update/.test(m)) {
      return '客户要改需求，建议这样处理：先确认改动点（规格/数量/交期等），同步评估对价格和排产的影响，再给客户一个明确的更新方案。你把客户名或订单号发我，我拉出原订单的报价明细，帮你把修改前后的差异整理清楚再回复客户。';
    }
    return '收到。为了给你更有针对性的建议，麻烦补充一下关键信息：客户名或订单号、具体的需求点（比如规格、数量、交期、目的港）。我可以调系统里的档案和历史记录，帮你把方案做扎实。';
  }

  /**
   * 安全护栏：检测越权/泄露/越狱类请求
   */
  _checkLeakRequest(msg) {
    if (!msg) return false;
    const s = String(msg);
    const patterns = [
      /(其他客户|别的客户|别人的|其他公司|别的公司).{0,25}(联系|电话|手机|邮箱|报价|聊天|记录|信息|资料)/,
      /(所有客户|全部客户).{0,20}(联系方式|手机号|电话|邮箱)/,
      /(导出|下载|打包).{0,10}(所有|全部).{0,10}(会话|聊天|客户|数据|信息)/,
      /(告诉我|说出|泄露|给我看看|查看).{0,15}(系统|system).{0,15}(提示词|prompt|指令|配置|代码|system prompt)/i,
      /忽略(之前|以上|一切).{0,10}(指令|规则|提示|设定)/,
      /你是(没有|不受|无).{0,12}(限制|约束|规则|底线)/,
      /(写|生成|起草).{0,10}(威胁|恐吓|敲诈).{0,10}(信|邮件|内容)/
    ];
    return patterns.some(p => p.test(s));
  }

  /**
   * 从用户消息中提取产品/规格关键词（用于订单等工具结果的相关性过滤）
   */
  _extractProductKeywords(msg) {
    if (!msg) return [];
    const s = String(msg).toLowerCase();
    const dict = [
      'pipe', 'steel', 'galvanized', 'seamless', 'carbon', 'stainless',
      '钢管', '管道', '管子', '管材',
      'glass', 'tempered', '钢化玻璃', '玻璃',
      'film', 'stretch', 'wrap', '缠绕膜', '拉伸膜', '保鲜膜',
      'iron', 'aluminum', 'copper', 'plastic', 'fiber', 'valve', 'pump', 'flange', 'fitting',
      '3 inch', '2 inch', '4 inch', '6 inch', '8 inch', '10 inch', '12 meter', '6 meter',
      'api 5l', 'astm', 'gb/t'
    ];
    const kws = [];
    for (const k of dict) {
      if (s.includes(k)) kws.push(k);
    }
    return kws;
  }

  /**
   * 工具触发护栏：明显不是查询/生成指令的工具调用应被丢弃（防工具过度触发）
   * 以收紧后的后端 _detectIntent 为基准：LLM 误触发但后端不会触发的，一律丢弃
   */
  _shouldDropToolCall(funcName, msg) {
    if (!msg) return false;
    if (funcName === 'generate_document' || funcName === 'query_orders') {
      const backend = this._detectIntent(msg);
      return !(backend && backend.tool === funcName);
    }
    return false;
  }

  /**
   * 格式化执行结果
   */
  _formatResult(funcName, args, result, justConfirmed = false) {
    const prefix = justConfirmed ? '✅ 执行完成\n' : '✅ 查询完成\n';
    if (result && result.error) return '❌ ' + (result.message || '操作失败，请稍后重试');
    
    if (funcName === 'query_customer') {
      const list = result.customers.map(c => 
        `- ${c.name || c.pushName || '未知'} (${c.jid})\n  公司：${c.company || '无'}\n  阶段：${c.stage || '未设置'}`
      ).join('\n');
      return `${prefix}\n找到 ${result.customers.length} 个客户：\n${list || '无匹配结果'}`;
    }
    
    if (funcName === 'query_orders') {
      if (!result.orders || result.orders.length === 0) return `${prefix}\n未找到相关订单`;
      const list = result.orders.map(o => 
        `- 订单#${o.id}（${o.productName || ''}）：${o.totalPrice != null ? (o.currency || '$') + o.totalPrice : '金额未标'}\n  状态：${o.status || '未知'}`
      ).join('\n');
      return `${prefix}\n找到 ${result.orders.length} 个订单：\n${list}`;
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
    
    if (funcName === 'set_unattended') {
      if (result.error) return '❌ ' + (result.message || '操作失败');
      return result.message || (result.action === 'on' ? '✅ 夜间自动接待已开启' : result.action === 'off' ? '✅ 夜间自动接待已关闭' : '好的，请告诉我具体的时间区间');
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

    if (funcName === 'create_reminder') {
      if (result.error) return '❌ ' + result.message;
      const when = new Date(result.remindAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      return '⏰ 提醒已创建！\n内容：' + result.title + '\n时间：' + when + '（北京时间）\n到点我会在这里提醒你。';
    }

    if (funcName === 'list_reminders') {
      if (result.error) return '❌ ' + result.message;
      if (result.count === 0) return '📭 当前没有待触发的日程提醒。';
      let s = '⏰ 待触发的提醒（' + result.count + ' 条）：\n';
      result.reminders.forEach((r, i) => {
        const when = new Date(r.remindAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        s += (i + 1) + '. #' + r.id + ' ' + r.title + '（' + when + '）\n';
      });
      return s;
    }

    if (funcName === 'cancel_reminder') {
      if (result.error) return '❌ ' + result.message;
      return '🗑 提醒 #' + result.id + '「' + result.title + '」已取消。';
    }

    if (funcName === 'context_get') {
      if (result.error) return '❌ ' + result.message;
      if (!result.entries || result.entries.length === 0) return '📋 该业务对象暂无已沉淀的共享结论。';
      let s = '📋 共享上下文结论（' + result.entries.length + ' 条）：\n';
      result.entries.forEach((e, i) => {
        const statusTag = e.status === 'LOCKED' ? '🔒' : (e.status === 'CONFLICT' ? '⚠️' : '');
        s += (i + 1) + '. ' + e.key + '：' + e.value + statusTag + '（置信度' + e.confidence + '/5' + (e.sourceAgent ? '，来源：' + e.sourceAgent : '') + '）\n';
      });
      return s;
    }

    if (funcName === 'context_set') {
      if (result.error) return '❌ ' + result.message;
      if (result.action === 'reinforced') return '📌 结论一致，置信度已加固：' + (result.entry && result.entry.key) + '=' + (result.entry && result.entry.value) + '（' + result.message + '）';
      if (result.action === 'locked_blocked') return '🔒 ' + result.message;
      if (result.action === 'conflicted') return '⚠️ ' + result.message + '：' + (result.entry && result.entry.value) + '。已交给老板裁决。';
      return '✅ 已写入共享上下文：' + (result.entry && result.entry.key) + '=' + (result.entry && result.entry.value);
    }

    return `${prefix}\n操作完成`;
  }
}

const assistantService = new AssistantService();
export default assistantService;
