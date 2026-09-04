/**
 * 工具 Schema 定义
 * 版本: v1.0
 * 说明:
 *  - 从 services/assistant.service.js 抽取 TOOLS 定义，结构化集中管理
 *  - 每个工具包含：name(名称) / description(描述) / parameters(参数) /
 *    needConfirm(是否需确认) / triggers(触发条件，供 prompt 与意图识别参考)
 *  - buildToolsDesc(tools) 复刻原 TOOLS_DESC 构建逻辑，保证生成 prompt 一致
 */

export const TOOLS_SCHEMA_VERSION = 'v1.0';

export const TOOLS = [
  {
    name: 'query_customer',
    description: '查询客户信息，包括客户名称、联系方式、公司、阶段等',
    parameters: {
      customerName: '客户名称（模糊匹配，可选）',
      jid: 'WhatsApp JID（可选）'
    },
    needConfirm: false,
    triggers: '用户查询/搜索客户信息、客户列表、某客户资料时触发'
  },
  {
    name: 'query_orders',
    description: '查询CRM中已录入的订单列表（仅当Jeremy明确要求"查订单/查我的订单/订单状态/追踪订单"时才使用；客户询价、谈判等一律不触发）',
    parameters: {
      customerId: '客户ID（必填）'
    },
    needConfirm: false,
    triggers: '用户查询订单、订单列表、某客户下单情况时触发'
  },
  {
    name: 'query_messages',
    description: '查询和客户的历史对话消息',
    parameters: {
      jid: '客户WhatsApp JID（必填）',
      limit: '返回消息数量（可选，默认20）'
    },
    needConfirm: false,
    triggers: '用户查询聊天记录、历史消息、对话内容时触发'
  },
  {
    name: 'send_message',
    description: '发送WhatsApp消息给客户',
    parameters: {
      jid: '客户WhatsApp JID（必填）',
      message: '消息内容（必填）'
    },
    needConfirm: true,
    triggers: '用户要求发送/通知/回复 WhatsApp 消息给客户时触发（需确认）'
  },
  {
    name: 'update_customer_status',
    description: '更新客户阶段状态',
    parameters: {
      customerId: '客户ID（必填）',
      stage: '客户阶段（必填，可选值：lead/contacted/qualified/proposal/negotiation/won/lost）'
    },
    needConfirm: true,
    triggers: '用户要求更新/修改客户阶段、销售状态时触发（需确认）'
  },
  {
    name: 'add_follow_up',
    description: '添加客户跟进记录',
    parameters: {
      customerId: '客户ID（必填）',
      note: '跟进内容（必填）',
      followUpDate: '下次跟进日期（YYYY-MM-DD，可选）'
    },
    needConfirm: false,
    triggers: '用户要求添加跟进记录、记录跟进内容、设置下次跟进时触发'
  },
  {
    name: 'generate_document',
    description: '生成PDF文档（报价单、PI、合同、报关单等）。仅当明确要求"生成/制作/输出PDF文档"时才调用；客户口头询价（give a quote / ask price / quotation）不调用，直接自然回复。',
    parameters: {
      docType: '文档类型（必填）。quote=报价单, PI=形式发票, CI=商业发票, contract=合同, customs=报关单, catalog=产品目录, general=通用文档',
      title: '文档标题（必填）',
      subtitle: '副标题/日期说明（可选）',
      content: '文档正文内容，支持Markdown格式（通用文档时必填）',
      customerName: '客户名称（报价单/PI时必填）',
      customerContact: '客户联系人（可选）',
      customerEmail: '客户邮箱（可选）',
      items: '产品列表JSON字符串，格式：[{"name":"产品名","spec":"规格","qty":数量,"price":单价}]（报价单/PI时必填）',
      notes: '备注说明（可选）'
    },
    needConfirm: false,
    triggers: '用户要求生成 PDF、报价单、PI、CI、合同、报关单、产品目录等文档时触发'
  },
  {
    name: 'exchange_rate',
    description: '查询实时汇率。当用户询问汇率、货币转换、美元人民币价格时调用此工具。',
    parameters: {
      from: '源货币代码（默认USD，可选值：USD/EUR/GBP/CNY/JPY/HKD等）',
      to: '目标货币代码（默认CNY，可选值同上）',
      amount: '转换金额（默认1，可选）'
    },
    needConfirm: false,
    triggers: '用户询问汇率、货币转换、美元/欧元/人民币价格时触发'
  },
  {
    name: 'query_dashboard',
    description: '查询CRM数据概览/统计信息。当用户询问今日数据、客户统计、消息统计、业绩概况时调用。',
    parameters: {},
    needConfirm: false,
    triggers: '用户询问今日数据、客户统计、消息统计、业绩概况、dashboard 时触发'
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
    needConfirm: false,
    triggers: '用户要求追踪/订阅/关注某个话题或行业动态时触发'
  },
  {
    name: 'list_topics',
    description: 'List all subscribed tracking topics.',
    parameters: {},
    needConfirm: false,
    triggers: '用户查询已订阅的追踪话题列表时触发'
  },
  {
    name: 'get_briefing',
    description: 'Get the latest briefing for a tracked topic.',
    parameters: {
      topic: 'Topic name (required)'
    },
    needConfirm: false,
    triggers: '用户获取某个已追踪话题的最新简报时触发'
  },
  {
    name: 'web_search',
    description: '联网搜索互联网信息。用于市场分析、行业调研、竞品信息、最新动态、政策法规等需要实时信息的场景。',
    parameters: {
      query: '搜索关键词（必填）',
      topic: '搜索主题/领域（可选，如market_analysis/competitor/policy/trends）'
    },
    needConfirm: false,
    triggers: '用户要求联网搜索、市场分析、行业调研、竞品信息、最新动态、政策法规时触发'
  },
  {
    name: 'create_reminder',
    description: '创建日程提醒。当用户要求设置提醒/日程/闹钟，或说"提醒我/帮我记一下/设个提醒/到时候提醒/记一下"时调用。支持自然语言时间（如"明天上午10点""下周一9点""后天下午3点半"）。',
    parameters: {
      content: '提醒内容（必填），如"跟进尼日利亚 Lagos 客户的报价进展"',
      remindAt: '提醒时间（必填），自然语言或 ISO 格式，如"明天上午10点"、"2026-08-18 10:00"',
      title: '提醒标题（可选），简短概括，如"跟进报价"',
      jid: '客户WhatsApp JID（可选）。仅当用户明确要求"提醒客户/发消息提醒客户"时填写；默认提醒老板本人不需要填'
    },
    needConfirm: false,
    triggers: '用户要求设置提醒、日程、闹钟，或"提醒我XX时间做XX事"时触发'
  },
  {
    name: 'list_reminders',
    description: '查询当前待触发的日程提醒列表。当用户问"有哪些提醒/我的提醒/提醒列表/待办日程"时调用。',
    parameters: {},
    needConfirm: false,
    triggers: '用户查询提醒列表、日程安排、待办提醒时触发'
  },
  {
    name: 'cancel_reminder',
    description: '取消一个尚未触发的日程提醒。当用户要求取消/删除某个提醒时调用。',
    parameters: {
      reminderId: '提醒ID（必填）'
    },
    needConfirm: false,
    triggers: '用户要求取消/删除某个日程提醒时触发'
  },
  {
    name: 'context_get',
    description: '查询共享上下文中已沉淀的事实型结论。当需要了解某个客户/订单/公司的已有结论（如付款方式、决策人、信用评级、历史结论）时调用，避免重复询问和口径不一致。',
    parameters: {
      entityType: '业务对象类型（必填）：customer=客户, order=订单, company=公司, agent=Agent自身',
      entityId: '业务对象ID（必填）：客户填客户ID/名称，订单填订单ID，agent填自己的agentType',
      key: '事实键（可选），如 payment_terms / decision_maker / credit_rating'
    },
    needConfirm: false,
    triggers: '需要查客户/订单/公司的已有结论、历史记录、避免重复解释时触发'
  },
  {
    name: 'context_set',
    description: '将一条事实型结论写入共享上下文，供6个Agent团队共享。当确认了某个客户/订单/公司的重要事实（如付款方式、决策人、信用评级、合同条款）时调用沉淀。注意：只写事实型结论，不写过程性闲聊。',
    parameters: {
      entityType: '业务对象类型（必填）：customer=客户, order=订单, company=公司',
      entityId: '业务对象ID（必填）：客户填客户ID/名称，订单填订单ID',
      key: '事实键（必填），如 payment_terms / decision_maker / credit_rating / contract_terms',
      value: '结论内容（必填）',
      sourceRef: '原始依据（可选）：会话ID/消息ID/报告文件路径',
      confidence: '置信度1~5（可选，默认3）'
    },
    needConfirm: false,
    triggers: '确认了客户/订单/公司的重要事实结论，需要团队共享时触发'
  },
  {
    name: 'set_unattended',
    description: '设置或关闭自动接待（超时接管 / 无人值守时段）。当用户（租户）要求"开启/关闭自动接待""X分钟内没回复就自动接待""晚上X点到Y点自动接待询盘""无人值守自动接待"时调用。若指令含明确超时分钟（如3分钟）或时间段则直接设置；若没有，必须回复追问让用户补充触发方式。',
    parameters: {
      enabled: '是否开启（true 开启 / false 关闭）',
      timeoutMinutes: '超时分钟数（可选），如 3 表示客户消息 3 分钟内无人回复则自动接待',
      timeText: '时间段描述文本（可选），如"晚上10点到早上7点"、"22:00-07:00"，用于解析开始/结束时间'
    },
    needConfirm: false,
    triggers: '租户下达自动接待/无人值守开启、关闭、设置超时分钟或时间段指令时触发'
  }
];

/**
 * 构建工具描述文本（用于 system prompt）
 * 复刻原 assistant.service.js 中 TOOLS_DESC 的逻辑，保证输出完全一致
 */
export function buildToolsDesc(tools) {
  return tools.map(t => {
    const params = Object.entries(t.parameters).map(([k, v]) => `    - ${k}: ${v}`).join('\n');
    return `  - ${t.name}: ${t.description}\n    参数：\n${params}\n    需确认：${t.needConfirm ? '是' : '否'}`;
  }).join('\n');
}

export default TOOLS;
