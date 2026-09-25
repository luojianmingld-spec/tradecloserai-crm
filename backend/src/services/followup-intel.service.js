/**
 * followup-intel.service.js — 智能跟进（intelligent follow-up）
 *
 * 【产品定位】一个能成交转化的外贸智能体。
 * 针对当前客户（会话），结合对话记录 + 背调报告 + 需求总结 + 商机阶段，
 * 由 AI 生成【跟进策略】→ 销售认可后生成【跟进话术】（多语言、可复制、销售手动发）。
 *
 * 数据表：FollowUpIntelligence（历史策略/话术落库，便于追溯复用）
 */
import { PrismaClient } from '@prisma/client';
import { chatComplete } from './ai-client.js';
import { detectLanguage } from './ai.service.js';

const prisma = new PrismaClient();

/**
 * 场景库定义（19 类）
 */
export const FOLLOWUP_SCENARIOS = [
  { key: 'inq_first',  group: 'A', label: '首次询盘后无回复', desc: '客户刚询盘(问价/需求)后无反馈', focus: '快速响应、确认需求、提供初步方案/样品信息' },
  { key: 'quoted',     group: 'A', label: '已报价未跟进',     desc: '已发报价单但客户未继续沟通',   focus: '追问反馈、强调价值、提供价格/技术弹性' },
  { key: 'sample',     group: 'A', label: '索样/寄样未回访',   desc: '已寄样品/打样,客户未反馈结果', focus: '询问样品测试结果、收集反馈、促成下一单' },
  { key: 'leads_expo', group: 'A', label: '展会/开发信客户',   desc: '展会名片、B2B开发信/平台询盘来源', focus: '破冰、自我介绍、挖掘需求建立信任' },
  { key: 'negotiate',  group: 'B', label: '谈判中/待签约',     desc: '洽谈价格条款、推进签约阶段',   focus: '推动决策、处理异议、明确下一步与时间点' },
  { key: 'price_worry',group: 'B', label: '价格异议/压价',     desc: '客户嫌贵/要求降价',            focus: '价值重述、成本拆解、梯度报价、附加服务' },
  { key: 'closing',    group: 'B', label: '逼单(意向已明确)',  desc: '已确认报价+样品验收通过,明确要下单却迟迟不下', focus: '制造紧迫感、扫清最后顾虑、明确下单节点、推动PO/定金' },
  { key: 'lockperiod', group: 'B', label: '锁单/临期提醒',     desc: '报价有有效期/库存产能紧张',    focus: '强调有效期、限时优惠、锁定产能' },
  { key: 'after_order',group: 'C', label: '下单后/生产期',     desc: '已下单,等待生产/交期',         focus: '进度同步、交期确认、增强信任' },
  { key: 'shipping',   group: 'C', label: '发货/物流中',       desc: '已发货,客户等待到货',          focus: '物流单号同步、清关提示、到货预期管理' },
  { key: 'arrived',    group: 'C', label: '到货收货确认',      desc: '客户已收到货',                 focus: '确认收货质量、收集反馈、铺垫复购' },
  { key: 'revisit',    group: 'D', label: '已成交客户回访',    desc: '已合作,阶段性维护',            focus: '满意度回访、使用反馈、交叉销售' },
  { key: 'd3_no_reply',group: 'D', label: '3天未回复',         desc: '上次联系后3天无回复',          focus: '温和提醒、补充价值信息、降低决策压力' },
  { key: 'd7_no_reply',group: 'D', label: '7天未回复',         desc: '上次联系后7天无回复',          focus: '唤醒型跟进、新卖点/案例、试探意向' },
  { key: 'silent_30',  group: 'D', label: '长期沉默(30天+)',   desc: '长期无互动,流失预警',          focus: '激活:新品/行情/节日问候,重建立联' },
  { key: 'reorder',    group: 'E', label: '复购周期提醒',      desc: '上次采购已过一定周期(如季度)', focus: '库存/补货提醒、新品推送、锁单' },
  { key: 'new_release',group: 'E', label: '新品/行情推送',     desc: '有新品上市或市场动态',         focus: '借新品/行情切入,激活存量客户' },
  { key: 'festival',   group: 'E', label: '节庆/时令问候',     desc: '客户所在国节庆(斋月/圣诞等)',  focus: '情感维系、顺带商务话题' },
  { key: 'referral',   group: 'E', label: '转介绍/口碑',       desc: '客户满意度高,意向优质',        focus: '请求推荐、老带新激励、案例背书' },
];

export function getScenario(key) {
  return FOLLOWUP_SCENARIOS.find(s => s.key === key) || null;
}

// ── 上下文读取（本地实现）──
async function getRecentMessages(accountId, jid, limit = 20) {
  let sessionIds = [];
  if (jid && jid.endsWith('@telegram')) {
    try {
      const where = { OR: [{ from: jid }, { to: jid }] };
      return await prisma.wAMessage.findMany({ where, orderBy: { timestamp: 'desc' }, take: limit });
    } catch (e) { return []; }
  }
  try {
    const acc = await prisma.whatsAppAccount.findUnique({ where: { id: accountId } });
    if (acc && acc.phone) {
      const conn = await prisma.wAConnection.findFirst({ where: { userId: acc.userId || 1, phone: acc.phone, sessionId: { startsWith: 'user_' } } });
      if (conn) sessionIds.push(conn.sessionId);
    }
    if (!sessionIds.length) {
      const fb = await prisma.wAConnection.findFirst({ where: { sessionId: 'user_' + accountId } });
      if (fb) sessionIds.push(fb.sessionId);
      else if (acc && acc.instanceName === 'jeremy-eric') sessionIds.push('user_2');
      else sessionIds.push('user_1');
    }
  } catch (e) { sessionIds.push('user_1'); }
  try {
    return await prisma.wAMessage.findMany({
      where: { OR: [{ from: jid }, { to: jid }], sessionId: { in: sessionIds } },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
  } catch (e) { return []; }
}

async function getContactInfo(accountId, jid) {
  try {
    const phone = (jid || '').split('@')[0];
    const customer = await prisma.customer.findFirst({ where: { userId: accountId, OR: [{ phone }, { jid }] } });
    if (customer) return { name: customer.name, country: customer.country || '', language: '', phone };
  } catch (e) {}
  return null;
}

function buildConversationContext(messages, contact) {
  const contactInfo = contact ? '客户: ' + (contact.name || contact.phone || '未知') + ', 国家: ' + (contact.country || '未知') + ', 语言: ' + (contact.language || '未知') : '';
  const msgLines = messages.slice().reverse().map(m => {
    const isFromMe = m.fromMe === true || m.direction === 'outbound' || m.direction === 'outgoing';
    const role = isFromMe ? '我方' : '客户';
    const content = m.body || m.content || '';
    const time = new Date(m.timestamp).toLocaleString('zh-CN');
    return '[' + time + '] ' + role + ': ' + content;
  });
  return (contactInfo ? contactInfo + '\n\n' : '') + msgLines.join('\n');
}

// ── 客户对象 → 上下文摘要 ──
function buildCustomerContext(customer) {
  if (!customer) return '';
  const parts = [];
  if (customer.name || customer.contactName) parts.push('客户名称: ' + (customer.contactName || customer.name));
  if (customer.companyName || customer.company) parts.push('公司: ' + (customer.companyName || customer.company));
  if (customer.country) parts.push('国家/地区: ' + customer.country);
  if (customer.industry) parts.push('行业: ' + customer.industry);
  if (customer.customerLevel) parts.push('客户等级: ' + customer.customerLevel);
  if (customer.dealStage) parts.push('商机阶段: ' + customer.dealStage);
  if (customer.aiGrade) parts.push('AI评级: ' + customer.aiGrade);
  if (customer.requirementSummary) parts.push('需求总结: ' + customer.requirementSummary);
  if (customer.bgReport) parts.push('背调信息: ' + String(customer.bgReport).slice(0, 800));
  if (customer.notes) parts.push('备注: ' + customer.notes);
  return parts.join('\n');
}

/**
 * 生成跟进策略
 * 返回：{ strategy: 对象, scenario, engine, historyId }
 */
export async function generateFollowupStrategy({ userId, accountId, jid, scenario: scenarioKey, modelKey } = {}) {
  const acctId = accountId || userId;
  let messages = [];
  try { messages = await getRecentMessages(acctId, jid, 30); } catch (e) { console.warn('[FollowUp] getRecentMessages:', e.message); }
  let customer = null;
  try {
    const phone = (jid || '').split('@')[0];
    customer = await prisma.customer.findFirst({ where: { userId: acctId, OR: [{ phone }, { jid }] } });
  } catch (e) { console.warn('[FollowUp] load customer:', e.message); }
  const contact = (acctId && jid) ? await getContactInfo(acctId, jid) : null;

  if (!messages.length) return { error: '该客户暂无消息记录，无法生成智能跟进策略' };

  const scenario = getScenario(scenarioKey);
  const msgStr = buildConversationContext(messages, contact);
  const custStr = buildCustomerContext(customer);

  const scenarioLine = scenario
    ? '【' + scenario.label + '】' + scenario.desc + ' —— 策略应围绕：' + scenario.focus
    : '由你根据客户情况自行判断最合适的跟进场景';

  const systemPrompt = '你是一位资深、专业、擅长成交转化的外贸跟单专家（Top Sales + 谈判专家）。你的目标是把客户顺利推进到成交，而不是机械复述流程。\n\n'
    + '当前跟进场景：' + scenarioLine + '\n\n'
    + '客户上下文（背调/需求/商机）：\n' + (custStr || '（无额外客户资料）') + '\n\n'
    + '请基于以上信息制定一份【可执行的跟进策略】，严格按以下 JSON 结构返回（不要任何其他文字）：\n'
    + '{\n'
    + '  "scenario": "给当前客户匹配的跟进场景key",\n'
    + '  "scenarioName": "场景中文名",\n'
    + '  "goal": "本次跟进的核心目标(一句话,要指向推进成交)",\n'
    + '  "timing": "建议跟进时机(如1-2天内)",\n'
    + '  "approach": "跟进思路(3-5条要点,每条具体可执行,紧扣成交)",\n'
    + '  "concerns": "该客户可能的顾虑/风险点(2-3条)",\n'
    + '  "signals": "成交信号与判断标准(哪些信号表明可以正式逼单/下单)",\n'
    + '  "suggestedScenarioKeys": ["此客户最可能的3个场景key(含本场景)", "...", "..."]\n'
    + '}\n\n'
    + '要求：\n'
    + '- approach 每条要具体（给话术/策略方向），不要空话\n'
    + '- 如果客户已经确认报价、样品验收通过、明确要下单但迟迟不下，要给出有力的逼单策略（紧迫感、扫清顾虑、明确节点、推动PO/定金）\n'
    + '- 全程站在"促进成交"角度\n'
    + '- 可用场景key(只能从中取值,scenario取1个,suggestedScenarioKeys取3个,scenarioName取对应中文名): ' + FOLLOWUP_SCENARIOS.map(s => s.key + '=' + s.label).join('；') + '\n';

  let result = await chatComplete(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: msgStr },
    ],
    { temperature: 0.4, max_tokens: 1400, model: modelKey || undefined }
  );

  let parsed = null;
  for (let attempt = 0; attempt < 2 && !parsed; attempt++) {
    if (attempt > 0) {
      const r2 = await chatComplete(
        [
          { role: 'system', content: systemPrompt + '\n\n重要：只输出一个合法的JSON对象，不要任何额外文字、注释或非标准键名。' },
          { role: 'user', content: msgStr + (result ? '\n\n你上次返回了无法解析的内容：\n' + String(result).slice(0, 500) + '\n请重新只输出合法JSON。' : '') },
        ],
        { temperature: 0.3, max_tokens: 1400, model: modelKey || undefined }
      );
      result = r2;
    }
    try {
      const m = String(result || '').match(/\{[\s\S]*\}/);
      if (m) parsed = JSON.parse(m[0]);
    } catch (e) { console.warn('[FollowUp] strategy JSON parse:', e.message); }
  }

  const strategyObj = parsed || { scenario: scenarioKey || 'auto', goal: '', approach: [], concerns: [], signals: [] };
  // 【2026-09-22 修复排版】AI 可能把 approach/concerns/signals 返回成整段字符串，前端 v-for 遍历字符串会逐字竖排；统一规整为数组
  for (const _k of ['approach', 'concerns', 'signals']) {
    const _v = strategyObj[_k];
    if (typeof _v === 'string' && _v.trim()) strategyObj[_k] = [_v.trim()];
    else if (!Array.isArray(_v)) strategyObj[_k] = [];
  }

  let historyId = null;
  try {
    const rec = await prisma.followUpIntelligence.create({
      data: {
        userId,
        jid: jid || null,
        customerId: customer?.id || null,
        customerName: (customer?.contactName || customer?.name || contact?.name || '') || '',
        scenario: strategyObj.scenario || scenarioKey || 'auto',
        stage: 'strategy',
        strategy: JSON.stringify(strategyObj),
        modelKey: modelKey || 'doubao-lite',
      },
    });
    historyId = rec.id;
  } catch (e) { console.warn('[FollowUp] save strategy log:', e.message); }

  return { strategy: strategyObj, scenario: strategyObj.scenario, engine: 'active', historyId };
}

/**
 * 生成跟进话术
 * 返回：{ speech, lang, engine, historyId }
 */
export async function generateFollowupSpeech({ userId, accountId, jid, strategyStr, scenario: scenarioKey, lang = 'auto', modelKey } = {}) {
  const acctId = accountId || userId;
  let messages = [];
  try { messages = await getRecentMessages(acctId, jid, 20); } catch (e) {}
  const contact = (acctId && jid) ? await getContactInfo(acctId, jid) : null;
  const scenario = getScenario(scenarioKey);

  let strategyObj = null;
  if (strategyStr) { try { strategyObj = typeof strategyStr === 'string' ? JSON.parse(strategyStr) : strategyStr; } catch (e) {} }

  // 【2026-09-22 语言自动匹配】lang='auto' 或缺省时，自动检测客户最近消息语言（客户英文→英文话术，西语→西语话术），不再默认中文
  let effLang = lang || 'auto';
  if (effLang === 'auto') {
    try {
      const lastIn = messages.slice().reverse().find(m => !m.fromMe && (m.body || m.content || m.text));
      const sample = lastIn ? String(lastIn.body || lastIn.content || lastIn.text || '') : '';
      if (sample) {
        const det = await detectLanguage(sample);
        if (det && ['en','es','ar','fr','pt','ru','de','ja','ko'].includes(det)) effLang = det;
      }
    } catch (e) { console.warn('[FollowUp] lang detect fail:', e.message); }
  }

  const langGuide = {
    zh: '中文', en: '英文（适合欧美客户）', es: '西班牙语', ar: '阿拉伯语（中东客户）',
    fr: '法语', pt: '葡萄牙语（南美客户）', ru: '俄语', de: '德语', ja: '日语', ko: '韩语',
  }[effLang] || '中文';

  const strategyBlock = strategyObj
    ? JSON.stringify(strategyObj, null, 2)
    : (scenario ? '场景:' + scenario.label + '，思路:' + scenario.focus : '（无明确策略，按专业外贸跟进逻辑自行撰写）');

  const systemPrompt = '你是一位专业、有经验、能促成成交的外贸销售（Top Sales）。请根据给出的【跟进策略】和【客户信息】，生成一段可直接发送给客户的【跟进话术】。\n\n'
    + '语言要求：请用' + langGuide + '撰写。客户所在国家：' + (contact?.country || '未知') + '。若明确客户母语，优先用客户母语。\n\n'
    + '跟进策略：\n' + strategyBlock + '\n\n'
    + '要求：\n'
    + '- 语气专业、自然、不机械，像真人销售\n'
    + '- 紧扣策略目标，推动客户给出明确回应或推进下单\n'
    + '- 篇幅适中（80-160字），避免过长\n'
    + '- 只用纯文本话术内容，不要输出任何解释、标题或前后缀\n'
    + '- 若是逼单场景，要有力、得体地推动客户确认下单\n'
    + '- 话术正文用客户语言(客户能看懂的语言)撰写；最后另起一行输出分隔符---ZH---，再接这段话术的中文翻译（给销售人员参考，不发给客户）';

  const result = await chatComplete(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: '客户信息：' + (contact ? '姓名:' + (contact.name || '') + ' 国家:' + (contact.country || '') : '未知') },
    ],
    { temperature: 0.6, max_tokens: 700, model: modelKey || undefined }
  );

  // 中英对照：话术原文(客户语言) + 中文翻译 speechZh，供销售参考；发送仍用原文
  const rawSpeech = String(result || '').trim();
  let speech = rawSpeech;
  let speechZh = null;
  const _zhM = rawSpeech.match(/---ZH---\s*([\s\S]*)$/);
  if (_zhM && _zhM[1] && _zhM[1].trim()) {
    speechZh = _zhM[1].trim();
    speech = rawSpeech.replace(/---ZH---[\s\S]*$/, '').trim();
  }

  let historyId = null;
  try {
    const rec = await prisma.followUpIntelligence.create({
      data: {
        userId,
        jid: jid || null,
        scenario: scenarioKey || 'auto',
        stage: 'speech',
        strategy: strategyStr || null,
        speech,
        language: effLang,
        modelKey: modelKey || 'doubao-lite',
      },
    });
    historyId = rec.id;
  } catch (e) { console.warn('[FollowUp] save speech log:', e.message); }

  return { speech, speechZh, lang, engine: 'active', historyId };
}

/**
 * 查询历史跟进记录（按客户，倒序）
 */
export async function getFollowupHistory({ userId, jid, customerId, limit = 20 } = {}) {
  const where = { userId };
  if (jid) where.jid = jid;
  if (customerId) where.customerId = customerId;
  const list = await prisma.followUpIntelligence.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  return list;
}

/**
 * 场景库（供前端下拉/识别使用）
 */
export function getScenarioLibrary() {
  return FOLLOWUP_SCENARIOS;
}