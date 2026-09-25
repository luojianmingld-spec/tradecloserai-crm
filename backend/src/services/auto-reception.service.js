/**
 * Auto Reception Service (自动接待)
 * 核心逻辑：客户消息进来后，N 分钟（默认3分钟）内没有人工回复 → 外贸销冠 Agent 自动接待。
 * - 按销售(userId) 独立开关，销售自己决定是否开启自动接待
 * - 销冠分级：能准确回复的持续接待；判断无法准确回复的（报价/定制/大单/投诉等）→ 通知销售本人
 * - 通知渠道：微信公众号（模板消息/客服消息）优先；短信按条扣积分，余额不足自动降级微信
 */
import { PrismaClient } from '@prisma/client';
import { chatComplete } from './ai-client.js';
import { translateText, detectLanguage } from './ai.service.js';
import { getEvolutionConnector } from './evolution-connector.js';
import { assertEnoughCredits, deductCredits } from './credits.js';
import { sendTextMessage, sendTemplateMessage } from './wechat-official.service.js';
import crypto from 'crypto';
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

// 每条短信通知消耗的积分（1元=1000积分）
export const SMS_NOTIFY_COST = 100;

const DEFAULT_CONFIG = {
  enabled: false,        // 销售独立开关，默认关闭
  timeoutMinutes: 3,     // 超时分钟
  mode: 'always',        // always=全天超时接管 | offhours=仅无人值守时段
  startHour: 22,         // offhours 模式：开始小时
  endHour: 7,            // offhours 模式：结束小时
  timezone: 'Asia/Shanghai',
  strategy: 'smart',
  confirmMode: 'smart',   // smart=拿不准才推微信确认(all依赖needHuman)| all=每条都确认 | none=全自动不推微信
};

// 延迟接管计时器（内存，进程重启后由下一次入站重新评估）
const timers = new Map();
// 接管防重入锁
const taking = new Map();

// ===== 待销售确认的自动回复草稿（需把关：报价/承诺/定制/大单/纠纷不直接发送） =====
// 存储：<cwd>/data/auto-reception-pending.json（进程重启不丢）
const PENDING_TTL_MS = 60 * 60 * 1000; // 确认链接 60 分钟有效

function pendingFilePath() {
  const candidates = [
    path.join(process.cwd(), 'data', 'auto-reception-pending.json'),
    path.join(process.cwd(), 'backend', 'src', 'data', 'auto-reception-pending.json'),
  ];
  for (const p of candidates) {
    try { fs.accessSync(p, fs.constants.W_OK); return p; } catch {}
  }
  const dir = path.join(process.cwd(), 'data');
  try { fs.mkdirSync(dir, { recursive: true }); } catch {}
  return path.join(dir, 'auto-reception-pending.json');
}

function loadPending() {
  try {
    const raw = fs.readFileSync(pendingFilePath(), 'utf-8');
    const obj = JSON.parse(raw);
    return obj && typeof obj === 'object' ? obj : {};
  } catch {
    return {};
  }
}

function savePending(store) {
  try {
    fs.writeFileSync(pendingFilePath(), JSON.stringify(store, null, 2), 'utf-8');
  } catch (e) {
    console.warn('[AutoReception] save pending failed:', e.message);
  }
}

function addPendingDraft(draft) {
  const store = loadPending();
  const now = Date.now();
  for (const k of Object.keys(store)) {
    if (now - (store[k].createdAt || 0) > PENDING_TTL_MS) delete store[k];
  }
  store[draft.token] = { ...draft, createdAt: draft.createdAt || now, status: 'pending' };
  savePending(store);
  return draft;
}

function getPendingDraft(token) {
  const store = loadPending();
  const d = store[token];
  if (!d) return null;
  if (Date.now() - (d.createdAt || 0) > PENDING_TTL_MS) {
    d.status = 'expired';
    return d;
  }
  return d;
}

function consumePendingDraft(token, status) {
  const store = loadPending();
  if (!store[token]) return null;
  const d = { ...store[token], status };
  delete store[token];
  savePending(store);
  return d;
}

// ===== 客户级接管开启（2026-09-17） =====
// 接管需先由外贸销冠在该客户会话发送指令（点胶囊）才开启；关闭/未指令的客户不被自动拦截
// 存储：<cwd>/data/auto-reception-customers.json
function loadCustomerTakeovers() {
  try {
    const p = path.join(process.cwd(), 'data', 'auto-reception-customers.json');
    fs.mkdirSync(path.dirname(p), { recursive: true });
    const raw = fs.readFileSync(p, 'utf-8');
    const obj = JSON.parse(raw);
    return obj && typeof obj === 'object' ? obj : {};
  } catch {
    return {};
  }
}

function saveCustomerTakeovers(store) {
  try {
    const p = path.join(process.cwd(), 'data', 'auto-reception-customers.json');
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(store, null, 2), 'utf-8');
  } catch (e) {
    console.warn('[AutoReception] save customer takeovers failed:', e.message);
  }
}

function customerTakeoverKey(userId, remoteJid) {
  return `${userId}:${remoteJid}`;
}

/** 对指定客户开启接管（外贸销冠在该客户会话发指令后调用） */
async function enableCustomerTakeover(userId, remoteJid, opts = {}) {
  const store = loadCustomerTakeovers();
  store[customerTakeoverKey(userId, remoteJid)] = {
    enabled: true, // 覆盖该客户此前的 enabled:false
    timeoutMinutes: parseInt(opts.timeoutMinutes, 10) || 3,
    mode: opts.mode || 'always',
    confirmMode: ['smart', 'all', 'none'].includes(opts.confirmMode) ? opts.confirmMode : 'smart',
    ...(opts.startHour != null ? { startHour: opts.startHour } : {}),
    ...(opts.endHour != null ? { endHour: opts.endHour } : {}),
    timezone: opts.timezone || 'Asia/Shanghai',
    updatedAt: Date.now(),
  };
  saveCustomerTakeovers(store);
  return store[customerTakeoverKey(userId, remoteJid)];
}

/** 关闭指定客户接管（明确标记，可覆盖全局；再次开启会覆盖回 enabled:true） */
async function disableCustomerTakeover(userId, remoteJid) {
  const store = loadCustomerTakeovers();
  store[customerTakeoverKey(userId, remoteJid)] = {
    enabled: false, updatedAt: Date.now(),
  };
  saveCustomerTakeovers(store);
  return true;
}

/** 关闭该用户全部客户接管（全局关闭指令） */
async function disableAllCustomerTakeovers(userId) {
  const store = loadCustomerTakeovers();
  let n = 0;
  const prefix = `${userId}:`;
  for (const k of Object.keys(store)) {
    if (k.startsWith(prefix)) { delete store[k]; n++; }
  }
  if (n) saveCustomerTakeovers(store);
  return n;
}

/** 查询指定客户的接管设置；未设置返回 null（调用方按全局处理） */
function getCustomerTakeover(userId, remoteJid) {
  const store = loadCustomerTakeovers();
  const c = store[customerTakeoverKey(userId, remoteJid)];
  return c || null;
}

function configKey(userId) { return `auto_reception:${userId}`; }

async function getConfig(userId) {
  const setting = await prisma.setting.findUnique({
    where: { userId_key: { userId, key: configKey(userId) } },
  });
  if (!setting || !setting.value) return { ...DEFAULT_CONFIG };
  try {
    return { ...DEFAULT_CONFIG, ...JSON.parse(setting.value) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

async function saveConfig(userId, config) {
  const merged = { ...DEFAULT_CONFIG, ...config };
  await prisma.setting.upsert({
    where: { userId_key: { userId, key: configKey(userId) } },
    create: { userId, key: configKey(userId), value: JSON.stringify(merged) },
    update: { value: JSON.stringify(merged) },
  });
  return merged;
}

function isOffHours(now, config) {
  const tz = config.timezone || 'Asia/Shanghai';
  const formatter = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hour12: false });
  const currentHour = parseInt(formatter.format(now), 10);
  const start = config.startHour;
  const end = config.endHour;
  if (start > end) return currentHour >= start || currentHour < end;
  return currentHour >= start && currentHour < end;
}

/**
 * webhook 入站消息入口
 * 返回：null=不接管 / {scheduled} / {sent}
 */
async function handleInbound({ remoteJid, body, pushName, sessionId, userId, ownerJid, emitStep }) {
  if (!userId || !remoteJid || !body || body === '[unknown]') return null;
  const config = await getConfig(userId);

  // 指派任务驱动：该客户有未完成指派任务(CREATED/ACTIVE)时，强制自动接待（绕过开关/时段限制）
  const assignedTask = await findAssignedTask(userId, remoteJid);
  const taskDriven = !!assignedTask;
  let custConf = null;
  if (!taskDriven) {
    // 【2026-09-17】双模式：支持全局所有客户 / 指定客户；指定关闭可覆盖全局
    custConf = getCustomerTakeover(userId, remoteJid);
    if (custConf) {
      // 有客户级设置
      if (custConf.enabled === false) return null; // 明确关闭该客户，即使全局开启也不接管
      if (custConf.mode === 'offhours' && !isOffHours(new Date(), custConf)) return null;
    } else {
      // 未对客户单独设置 → 按全局配置
      if (!config.enabled) return null;
      if (config.mode === 'offhours' && !isOffHours(new Date(), config)) return null;
    }
  }

  // 查该会话最近一条我方发出的消息
  const lastOut = await prisma.wAMessage.findFirst({
    where: { sessionId, to: remoteJid, direction: 'outbound' },
    orderBy: { timestamp: 'desc' },
  });

  const now = Date.now();
  const timeoutMs = (taskDriven ? (config.timeoutMinutes || 3) : ((custConf && custConf.timeoutMinutes) || config.timeoutMinutes || 3)) * 60 * 1000;

  if (lastOut?.isAuto) {
    // 最近回复是 AI 发出 → AI 正在接待该客户，继续由 AI 持续接待（直到人工介入）
    return doTakeover({ remoteJid, body, pushName, sessionId, userId, ownerJid, emitStep, assignedTask });
  }
  if (lastOut && (now - new Date(lastOut.timestamp).getTime()) <= timeoutMs) {
    // 人工刚回复过（在超时窗口内）→ 不接管
    return null;
  }
  // 无回复 或 人工回复已超时 → 启动延迟接管（客户连发消息会重置计时）
  return scheduleTakeover({ remoteJid, body, pushName, sessionId, userId, ownerJid, emitStep, assignedTask }, timeoutMs);
}

function scheduleTakeover(ctx, timeoutMs) {
  const step = ctx.emitStep || (() => {});
  const key = `${ctx.sessionId}:${ctx.remoteJid}`;
  if (timers.has(key)) clearTimeout(timers.get(key));
  const t = setTimeout(async () => {
    timers.delete(key);
    try {
      // 到时再查：该客户最新消息之后是否已有人工/AI回复
      const hasReply = await hasReplySinceLatestInbound(ctx.sessionId, ctx.remoteJid);
      if (!hasReply) {
        step('timeout_check', '已超时未回复，销冠 Agent 接管');
        await doTakeover(ctx);
      } else {
        step('timeout_cancel', '已检测到回复，取消接管');
      }
    } catch (e) {
      console.warn('[AutoReception] delayed takeover error:', e.message);
    }
  }, timeoutMs);
  timers.set(key, t);
  console.log(`[AutoReception] scheduled takeover for ${ctx.remoteJid} in ${Math.round(timeoutMs / 60000)}min`);
  return { scheduled: true, timeoutMinutes: Math.round(timeoutMs / 60000) };
}

async function hasReplySinceLatestInbound(sessionId, remoteJid) {
  const latestIn = await prisma.wAMessage.findFirst({
    where: { sessionId, from: remoteJid, direction: 'inbound' },
    orderBy: { timestamp: 'desc' },
  });
  if (!latestIn) return true;
  const laterOut = await prisma.wAMessage.findFirst({
    where: { sessionId, to: remoteJid, direction: 'outbound', timestamp: { gt: latestIn.timestamp } },
    orderBy: { timestamp: 'desc' },
  });
  return !!laterOut;
}

async function doTakeover(ctx) {
  const step = ctx.emitStep || (() => {});
  step('takeover_start', '销冠 Agent 开始自动接待');
  const lockKey = `${ctx.sessionId}:${ctx.remoteJid}`;
  if (taking.has(lockKey)) return null;
  taking.set(lockKey, true);
  try {
    return await generateAndSend(ctx);
  } catch (e) {
    console.error('[AutoReception] takeover failed:', e.message);
    return { sent: false, error: e.message };
  } finally {
    taking.delete(lockKey);
  }
}

async function generateAndSend({ remoteJid, body, pushName, sessionId, userId, ownerJid, emitStep, assignedTask }) {
  const step = emitStep || (() => {});
  // 1. 上下文：客户画像 + 最近对话 + 话术库 + 产品知识库
  const customer = await findCustomer(userId, remoteJid);
  const history = await getRecentHistory(sessionId, remoteJid, 8);
  const samples = await getTopSamples(userId, body, 3);

  step('analyzing', '正在分析客户需求');
  // 2. 销冠生成回复 + 判断是否需要人工介入
  const { reply, needHuman, reason } = await generateAutoReply({
    pushName, customerMessage: body, customer, history, samples, userId, assignedTask: assignedTask || null,
  });

  step('generating', needHuman ? '正在生成回复并评估是否需要人工介入' : '正在生成回复');
  // 3. 翻译成客户语言（google 429 时 LLM 兜底）
  let sendText = reply;
  let translationObj = null;
  try {
    const srcLang = await detectLanguage(body || '', 'deepl');
    const tgtLang = srcLang && srcLang !== 'zh' && srcLang !== 'unknown' ? srcLang : null;
    if (tgtLang) {
      const tr = await translateText(reply, 'zh', tgtLang, 'deepl', userId);
      if (tr && tr.translated) {
        sendText = tr.translated;
        translationObj = JSON.stringify({ original: reply, translated: sendText, sourceLang: 'zh', targetLang: tgtLang });
      }
    }
  } catch (te) {
    console.warn('[AutoReception] translate failed, sending zh:', te.message);
  }

  step('translating', '正在翻译成客户语言');

  // 4.【需把关分流 2026-09-17】根据把关方式(confirmMode)决定是否推微信确认
  //   smart(默认)：销冠判定需把关的（报价/承诺/定制/大单/纠纷）→ 推微信；标准化问题直接回
  //   all：每条都推微信确认，确认后才发送
  //   none：全自动直接回，不推微信
  let confirmMode = 'smart';
  try {
    const cc = getCustomerTakeover(userId, remoteJid) || await getConfig(userId);
    confirmMode = cc.confirmMode || 'smart';
  } catch (ce) { /* 配置异常按默认 smart 处理 */ }
  if (confirmMode === 'all' || (confirmMode === 'smart' && needHuman)) {
    const pending = await createPendingAndNotify({
      remoteJid, body, pushName, userId, ownerJid,
      sendText, replyZh: reply, reason, sessionId, translationObj,
    });
    step('need_human', '已推微信待您确认发送');
    console.log(`[AutoReception] ⏳ ${confirmMode} 需确认 ${remoteJid} → token=${pending?.token}`);
    return { sent: false, pending: true, needHuman, reason, token: pending?.token };
  }

  // none 或 smart 且不需把关 → AI 直接发送 + 落库（isAuto=true，区分人工回复）
  const sent = await sendAndSave({ remoteJid, sendText, sessionId, userId, ownerJid, translationObj });
  step('sent', '已回复客户');
  console.log(`[AutoReception] ✅ replied to ${remoteJid} confirmMode=${confirmMode} needHuman=${needHuman}`);
  return { sent, needHuman, reason };
}

/**
 * 查询该客户是否有未完成的指派任务（CREATED/ACTIVE）
 */
async function findAssignedTask(userId, remoteJid) {
  try {
    const phone = remoteJid.split('@')[0];
    const customer = await prisma.customer.findFirst({ where: { userId, phone } });
    if (!customer) return null;
    const task = await prisma.agentTask.findFirst({
      where: {
        userId,
        agentType: 'sales-champion',
        customerId: customer.id,
        status: { in: ['CREATED', 'ACTIVE'] },
      },
      orderBy: { createdAt: 'asc' },
    });
    return task || null;
  } catch (e) {
    console.warn('[AutoReception] findAssignedTask error:', e.message);
    return null;
  }
}

async function findCustomer(userId, remoteJid) {
  try {
    const phone = remoteJid.split('@')[0];
    return await prisma.customer.findFirst({ where: { userId, phone } });
  } catch {
    return null;
  }
}

async function getRecentHistory(sessionId, remoteJid, limit = 8) {
  try {
    const msgs = await prisma.wAMessage.findMany({
      where: { sessionId, OR: [{ from: remoteJid }, { to: remoteJid }] },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
    return msgs.reverse().map((m) => {
      const who = m.direction === 'inbound' ? '客户' : '我方';
      const text = m.isAuto ? `[AI自动回复] ${m.body}` : m.body;
      return `${who}: ${String(text || '').slice(0, 200)}`;
    }).join('\n');
  } catch {
    return '';
  }
}

async function getTopSamples(userId, customerMsg, limit = 3) {
  try {
    const samples = await prisma.messageSample.findMany({
      where: { accountId: userId, reviewStatus: 'reviewed' },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return samples.map((s) => `客户问：${s.customerMsg}\n销冠回：${s.salesReply}`).join('\n\n');
  } catch {
    return '';
  }
}

// 【2026-09-17】通用公司资料「产品目录价格表」→ 标准报价数据源（所有客户共用，非客户级）
const _companyCatalogCache = new Map(); // accountId -> { text, at }
async function loadCompanyCatalog(userId) {
  const hit = _companyCatalogCache.get(userId);
  if (hit && Date.now() - hit.at < 5 * 60 * 1000) return hit.text;
  const cache = { text: '', at: Date.now() };
  _companyCatalogCache.set(userId, cache);
  try {
    const mats = await prisma.companyMaterial.findMany({
      where: { accountId: userId },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });
    const productMats = mats.filter((m) => m.category === 'product' || (m.category === 'company' && m.type === 'file'));
    if (!productMats.length) return '';
    const lines = [];
    for (const m of productMats) {
      if (m.type === 'text' && m.content) { lines.push(String(m.content).trim()); continue; }
      if (m.type === 'file' && m.filePath) {
        if (m.mimeType === 'application/pdf') {
          try {
            const pdfParse = createRequire(import.meta.url)('pdf-parse');
            const buf = fs.readFileSync(path.join(process.cwd(), 'uploads', 'company', m.filePath));
            const r = await pdfParse(buf);
            if (r && r.text) lines.push(r.text.trim());
          } catch (pe) {
            lines.push(`[产品目录：${m.fileName || 'PDF文件'} 暂无法读取，请联系销售确认]`);
          }
        } else {
          lines.push(`[产品目录图表：${m.fileName || '附件'}（图片/视频类，仅供人工参考）]`);
        }
      }
    }
    cache.text = lines.filter(Boolean).join('\n');
    return cache.text;
  } catch (e) {
    console.warn('[AutoReception] loadCompanyCatalog failed:', e.message);
    return '';
  }
}

async function loadProducts(userId) {
  try {
    const products = await prisma.productKnowledgeBase.findMany({
      where: { accountId: userId, isActive: true },
      take: 20,
    });
    if (!products.length) return '';
    return products.map((p) => {
      let line = `- ${p.productNameEn || p.productNameCn}${p.productDesc ? '：' + p.productDesc : ''}`;
      if (p.basePrice != null) line += `，参考价 ${p.basePrice}${p.pricingUnit || ''}`;
      if (p.moq != null) line += `，MOQ ${p.moq}`;
      if (p.deliveryDays != null) line += `，交期约 ${p.deliveryDays} 天`;
      return line;
    }).join('\n');
  } catch {
    return '';
  }
}

/**
 * 销冠生成回复 + 分级判断（结构化 JSON 输出）
 */
async function generateAutoReply({ pushName, customerMessage, customer, history, samples, userId, assignedTask }) {
  const customerInfo = customer
    ? `\n客户画像：\n- 姓名：${pushName || '未知'}\n- 国家：${customer.country || '未知'}\n- 公司：${customer.company || customer.companyName || '未知'}\n- 行业：${customer.industry || '未知'}\n- 阶段：${customer.status || '未知'}\n`
    : `\n客户画像：${pushName || '未知'}（暂无更多画像）\n`;

  const historyStr = history ? `\n最近对话：\n${history}\n` : '';
  const samplesStr = samples ? `\n历史优质话术参考：\n${samples}\n` : '';
  // 【2026-09-17】标准报价数据源：优先通用公司资料「产品目录价格表」，缺失时用产品知识库兜底
  const productContext = (await loadCompanyCatalog(userId)) || (await loadProducts(userId));

  // 老板指派任务指令（最高优先级）：客户被指派给销冠时，必须围绕指派指令跟进
  const taskStr = assignedTask?.instruction
    ? `\n【老板指派任务（必须执行）】老板已将该客户指派给你跟进，指派指令：\n${assignedTask.instruction}\n请始终围绕该指派指令推进跟进；当客户回复消息时，按指派指令进行下一轮跟进，回复内容需体现该指令要求。\n`
    : '';

  const prompt = `你是金至晶玻璃（Jinzhijing Glass）的外贸销冠Agent，正在自动接待海外客户询盘（此时人工销售暂未及时回复，由你专业接待）。

公司主营产品线：
${productContext || '- AR防眩光玻璃 / AG防眩光玻璃 / 触摸屏盖板玻璃 / 显示与工业玻璃等特种玻璃（金至晶玻璃）'}

客户刚发来消息：
\"${customerMessage}\"
${customerInfo}
${historyStr}
${samplesStr}
${taskStr}

外贸销冠接待要求：
1. 用专业、热情、简洁的口吻回应，让客户感到被重视；篇幅 3-4 句以内，符合 WhatsApp 商务习惯
2. 产品/规格/MOQ/交期/样品/用途等可准确回答的内容 → 直接专业回复，引导客户留下关键信息（产品类型、数量、目的国、用途）
3. 不编造产品细节、价格或公司承诺，产品信息与价格一律以产品线清单为准
4. 【新询盘先问需求】客户为首次询盘、或需求（产品型号/材质/规格/数量/是否定制/用途）尚不明确时 → 先礼貌把需求问清楚，不要急着报价，也不要用模板敷衍
5. 【标准报价】仅当客户需求明确、且能匹配产品线清单中的标准产品时，才按该产品列的 basePrice 报标准参考价（可顺带说明单位/MOQ/交期）；价格只引用清单中该产品的 basePrice
6. 【定制化不报价】客户要求定制规格/非标尺寸/特殊加工等不在标准产品清单内的需求 → 明确说明此类需专项确认、会安排同事跟进，不给出任何价格
7. 先用简体中文起草（系统会自动翻译成客户语言）

【分级判断】判断这条询盘是否需要人工销售介入（needHuman）。以下情况 needHuman=true：
- 客户要求的定制规格/非标需求超出标准产品清单（定制化，不报价，转人工确认）
- 客户直接要求报价单/正式PI、要求折扣、或要求大单量议价
- 需求已匹配标准产品，但涉及大订单量、付款条款、样品费、运费等商务条款
- 客户投诉、质量问题、退款、索赔、情绪不满
- 涉及交期承诺、独家代理、批量合作等需要人工决策的事项
- 需求模糊但客户一再催促报价（需人工把握）
以下情况 needHuman=false（AI 可继续接待）：
- 新询盘需求未明，AI 正在引导澄清（不报价、不解算金额）
- 常规产品咨询，且可按标准产品直接答复（含按清单 basePrice 标准报价）
其他常规产品咨询 → needHuman=false（AI 可继续接待）

只返回严格 JSON，不要任何解释、前缀或 Markdown 代码块：
{"reply": "回复正文", "needHuman": true或false, "reason": "needHuman为true时的简短原因，否则为空字符串"}`;

  try {
    const raw = await chatComplete([
      { role: 'system', content: prompt },
      { role: 'user', content: 'Generate the JSON now.' },
    ], { temperature: 0.5, maxTokens: 400, creditUserId: userId }); // 【积分铁律 2026-09-05】自动接待按销售 userId 扣
    return parseJsonReply(raw, customerMessage);
  } catch (e) {
    console.error('[AutoReception] AI generation failed:', e.message);
    return {
      reply: '感谢您的留言！我们正在为您确认，专业同事会尽快与您详细沟通。',
      needHuman: false,
      reason: '',
    };
  }
}

function parseJsonReply(raw, customerMessage) {
  const fallback = { reply: '感谢您的留言！我们正在为您确认，专业同事会尽快与您详细沟通。', needHuman: false, reason: '' };
  if (!raw) return fallback;
  let text = String(raw).trim();
  // 去掉 ```json ... ``` 包裹
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) text = fence[1].trim();
  // 提取第一个 { ... } 对象
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return fallback;
  try {
    const obj = JSON.parse(text.slice(start, end + 1));
    const reply = String(obj.reply || '').trim();
    if (!reply) return fallback;
    return {
      reply,
      needHuman: obj.needHuman === true || obj.needHuman === 'true',
      reason: String(obj.reason || '').trim(),
    };
  } catch {
    return fallback;
  }
}

async function sendAndSave({ remoteJid, sendText, sessionId, userId, ownerJid, translationObj }) {
  const evo = getEvolutionConnector();
  const result = await evo.sendTextMessage(remoteJid, sendText);
  const waMessageId = result?.messageId || result?.key?.id || null;
  if (waMessageId) {
    try {
      await prisma.wAMessage.create({
        data: {
          sessionId,
          from: ownerJid || '',
          to: remoteJid,
          body: sendText,
          type: 'text',
          direction: 'outbound',
          isAuto: true,
          timestamp: new Date(),
          waMessageId,
          translation: translationObj,
          sourceLang: translationObj ? 'zh' : null,
        },
      });
    } catch (e) {
      console.warn('[AutoReception] save auto reply failed:', e.message);
    }
  }
  return { sent: !!waMessageId, messageId: waMessageId };
}

/** 创建待确认草稿并推送到销售微信（客户原话 + AI 话术 + 确认链接） */
async function createPendingAndNotify({ remoteJid, body, pushName, userId, ownerJid, sendText, replyZh, reason, sessionId, translationObj }) {
  let token = '';
  try { token = crypto.randomBytes(16).toString('hex'); } catch { token = Date.now().toString(36) + Math.random().toString(36).slice(2); }
  addPendingDraft({
    token, remoteJid, body, pushName, userId, ownerJid,
    sendText, replyZh, reason, sessionId, translationObj,
    createdAt: Date.now(), status: 'pending',
  });
  await pushPendingDraftToWechat(userId, {
    token, remoteJid, body, pushName, userId, ownerJid,
    sendText, replyZh, reason, sessionId, translationObj,
  });
  return { token, status: 'pending' };
}

/** 微信推送待确认：客户问题 + AI 话术 + 确认链接（H5） */
async function pushPendingDraftToWechat(userId, draft) {
  const openid = await getWechatOpenid(userId);
  if (!openid) {
    console.warn('[AutoReception] no wechat openid for userId=' + userId + ', pending draft not pushed');
    return false;
  }
  const base = process.env.PUBLIC_BASE_URL || `http://45.76.223.251:3002`;
  const confirmUrl = `${base}/auto-reception/confirm/${draft.token}`;
  const customerLine = `客户：${draft.pushName || draft.remoteJid}\n客户消息：${String(draft.body || '').slice(0, 200)}`;
  const aiLine = `销冠拟回复（${draft.reason || '需把关'}）：\n${String(draft.sendText || draft.replyZh || '').slice(0, 400)}`;
  const text = `【销冠待您确认发送】\n${customerLine}\n\n${aiLine}\n\n点此确认/修改/拒发：\n${confirmUrl}\n（60分钟内有效）`;
  try {
    const templateId = process.env.WECHAT_TEMPLATE_ID;
    if (templateId) {
      await sendTemplateMessage(openid, templateId, {
        first: '销冠需您确认后发送',
        keyword1: draft.pushName || draft.remoteJid,
        keyword2: String(draft.body || '').slice(0, 80),
        remark: '销冠拟好回复，点开确认后才会发给客户',
      }, confirmUrl);
    } else {
      await sendTextMessage(openid, text);
    }
    return true;
  } catch (e) {
    console.warn('[AutoReception] push pending to wechat failed:', e.message);
    return false;
  }
}

/** 销售确认后：发送给客户并落库（确认/修改/拒发） */
async function confirmAndSend(token, opts = {}) {
  const draft = getPendingDraft(token);
  if (!draft) return { ok: false, error: 'NOT_FOUND', message: '确认链接不存在或已失效' };
  if (draft.status === 'expired') return { ok: false, error: 'EXPIRED', message: '确认链接已过期（60分钟），请人工接手该客户' };
  if (opts.action === 'reject') {
    consumePendingDraft(token, 'rejected');
    return { ok: true, rejected: true, message: '已拒发，未发送给客户，请人工接手' };
  }
  const finalText = opts.action === 'edit' && opts.text ? String(opts.text).trim() : draft.sendText;
  if (!finalText) return { ok: false, error: 'EMPTY', message: '回复内容为空，无法发送' };
  const res = await sendAndSave({
    remoteJid: draft.remoteJid, sendText: finalText,
    sessionId: draft.sessionId, userId: draft.userId, ownerJid: draft.ownerJid,
    translationObj: draft.translationObj,
  });
  const st = opts.action === 'edit' ? 'sent-edited' : 'sent';
  consumePendingDraft(token, res.sent ? st : 'failed');
  return { ok: res.sent, sent: res.sent, message: res.sent ? '已发送给客户' : '发送失败，请重试', draft };
}

/**
 * 通知销售本人：微信（模板消息/客服消息）+ 短信（扣积分）
 */
async function notifySales(userId, { customerName, customerMessage, reason, remoteJid }) {
  const text = `【询盘待处理提醒】\n客户：${customerName || remoteJid}\n消息：${String(customerMessage || '').slice(0, 120)}\n原因：${reason || '销冠无法准确回复'}\n请登录 TradeCloser AI 及时接手。`;

  // 1. 微信公众号通知
  const openid = await getWechatOpenid(userId);
  if (openid) {
    try {
      const templateId = process.env.WECHAT_TEMPLATE_ID;
      if (templateId) {
        await sendTemplateMessage(openid, templateId, { first: '您有一条询盘待处理', keyword1: customerName || remoteJid, keyword2: String(customerMessage || '').slice(0, 80), remark: reason || '请及时登录处理' });
      } else {
        await sendTextMessage(openid, text);
      }
      console.log('[AutoReception] wechat notify sent to userId=' + userId);
    } catch (e) {
      console.warn('[AutoReception] wechat notify failed:', e.message);
    }
  }

  // 2. 短信通知（扣积分）
  const phone = await getUserPhone(userId);
  if (phone) {
    try {
      await assertEnoughCredits(userId, SMS_NOTIFY_COST);
      const sent = await sendSms(phone, text);
      if (sent) {
        await deductCredits(userId, SMS_NOTIFY_COST, '短信通知（自动接待）', { orderId: null });
        console.log('[AutoReception] sms notify sent, deducted ' + SMS_NOTIFY_COST + ' credits');
      } else {
        console.warn('[AutoReception] sms channel unavailable, wechat-only fallback');
      }
    } catch (e) {
      if (e.code === 'INSUFFICIENT_CREDITS') {
        console.warn('[AutoReception] insufficient credits, skip sms: ' + e.message);
      } else {
        console.warn('[AutoReception] sms notify error:', e.message);
      }
    }
  }

  return { wechat: !!openid, sms: false };
}

async function getWechatOpenid(userId) {
  try {
    const m = await prisma.userMetadata.findUnique({
      where: { userId_key: { userId, key: 'wechat_openid' } },
    });
    return m?.value || null;
  } catch {
    return null;
  }
}

async function getUserPhone(userId) {
  try {
    const u = await prisma.user.findUnique({ where: { id: userId } });
    return u?.phone || null;
  } catch {
    return null;
  }
}

/** 短信发送：委托社区内部接口（预留端点；社区未提供时返回 false，自动降级微信） */
async function sendSms(phone, text) {
  const base = process.env.COMMUNITY_API_BASE || 'https://bbs.tradecloserai.com';
  const key = process.env.COMMUNITY_INTERNAL_KEY || '';
  if (!key) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${base}/api/internal/send-notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Internal-Key': key },
      body: JSON.stringify({ phone, text, scene: 'sales_notify' }),
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    return res.ok && data?.sent !== false;
  } catch (e) {
    console.warn('[AutoReception] sms send error:', e.message);
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export default {
  getConfig,
  saveConfig,
  handleInbound,
  doTakeover,
  notifySales,
  confirmAndSend,
  getPendingDraft,
  enableCustomerTakeover,
  disableCustomerTakeover,
  disableAllCustomerTakeovers,
  getCustomerTakeover,
  SMS_NOTIFY_COST,
  DEFAULT_CONFIG,
};
