/**
 * 话术库自主学习进化 V1 - 成交总结引擎 (WinSummary)
 * 成交信号(PartnerOrder.status 确认 / Customer.status=won|dealStage=won|completed)
 *  → 锁定成交客户+完整沟通链路 → LLM 生成 WinSummary
 *  → 关键话术打标后入该租户私有池（权重优先）
 */
import { LEARNING_CONFIG as CFG } from './config.js';
import { prisma, log, parseLLMJson, short, sessionsForAccount, llmDesensitize, llmChatComplete } from './learning.service.js';

/** PartnerOrder 视为成交的状态（非 pending/cancelled） */
const CONFIRMED_ORDER_STATUSES = ['confirmed', 'paid', 'in_production', 'producing', 'completed', 'delivered', 'shipped', 'done'];
/** Customer 视为成交的 dealStage */
const WON_DEAL_STAGES = ['won', 'completed'];
/** Customer.status 视为成交 */
const WON_CUSTOMER_STATUS = ['won'];

/** 归一化 jid：匹配手机号主体，兼容 @s.whatsapp.net / @c.us / @lid */
function jidVariants(jid) {
  if (!jid) return [];
  const phone = String(jid).split('@')[0];
  const v = new Set([jid, phone, phone + '@s.whatsapp.net', phone + '@c.us', phone + '@lid']);
  return [...v];
}

/**
 * 查找待处理的成交候选
 * @returns {Promise<Array>} candidates
 */
export async function findWinCandidates({ accountId = CFG.defaultAccountId } = {}) {
  const candidates = [];
  const sessions = await sessionsForAccount(accountId).catch(() => []);
  const sessionSet = new Set(sessions);

  // ── A) Customer 成交信号 ────────────────────────────────────────
  try {
    const customers = await prisma.customer.findMany({
      where: {
        userId: CFG.primaryUserId, // V1 单租户主用户下的客户
        OR: [
          { dealStage: { in: WON_DEAL_STAGES } },
          { status: { in: WON_CUSTOMER_STATUS } },
        ],
      },
      orderBy: { updatedAt: 'desc' },
    });
    for (const c of customers) {
      // 已处理过？
      const done = await prisma.winSummary.findFirst({
        where: { accountId, customerId: c.id },
        select: { id: true },
      });
      if (done) continue;
      candidates.push({ kind: 'customer', accountId, customerId: c.id, customer: c });
    }
    log('WinSummary', `客户成交信号: ${customers.length} 位，待处理 ${candidates.length}`);
  } catch (e) {
    log('WARN', 'findWinCandidates(customer) err:', e.message);
  }

  // ── B) PartnerOrder 成交信号 ────────────────────────────────────
  try {
    const orders = await prisma.partnerOrder.findMany({
      where: { tenantId: accountId, status: { in: CONFIRMED_ORDER_STATUSES } },
      orderBy: { updatedAt: 'desc' },
    });
    for (const o of orders) {
      const done = await prisma.winSummary.findFirst({
        where: { accountId, sourceOrderIds: { array_contains: [o.id] } },
        select: { id: true },
      }).catch(() => null);
      if (done) continue;
      candidates.push({ kind: 'partnerorder', accountId, orderId: o.id, order: o });
    }
    log('WinSummary', `订单成交信号: ${orders.length} 条，待处理 ${candidates.length - (candidates.filter(c=>c.kind==='customer').length)}`);
  } catch (e) {
    log('WARN', 'findWinCandidates(order) err:', e.message);
  }

  return { candidates, sessionSet };
}

/**
 * 提取成交客户的完整沟通链路（消息列表）
 */
export async function buildCommunicationChain(candidate, sessionSet) {
  let jids = [];
  let customerName = null;
  let customerId = null;
  let productLine = null;
  let dealAmount = null;
  let currency = 'USD';
  let winDate = null;
  let industry = null;

  if (candidate.kind === 'customer') {
    const c = candidate.customer;
    jids = jidVariants(c.jid);
    customerName = c.companyName || c.contactName || c.name || c.jid || null;
    customerId = c.id;
    productLine = c.requirementProducts || c.company || null;
    dealAmount = c.dealValue || null;
    industry = c.industry || null;
    winDate = c.dealStageAt || c.updatedAt || null;
    if (!jids.length && (c.companyName || c.contactName)) {
      // 无 jid 但有名：尝试按公司名在 WAMessage 中找线索（跳过）
      log('WinSummary', `customer#${c.id} 无 jid，无法抽取沟通链路`);
      return { chain: [], customerName, customerId, productLine, dealAmount, currency, winDate, industry };
    }
  } else {
    const o = candidate.order;
    productLine = o.productName || null;
    dealAmount = o.totalPrice || null;
    currency = o.currency || 'USD';
    winDate = o.actualCompletion || o.orderDate || o.updatedAt || null;
    // PartnerOrder → Partner → 尝试匹配同名 Customer
    try {
      const partner = await prisma.partner.findUnique({ where: { id: o.partnerId }, select: { companyName: true, contactName: true, phone: true } });
      if (partner) {
        customerName = partner.companyName || partner.contactName || null;
        const matched = await prisma.customer.findFirst({
          where: { userId: CFG.primaryUserId, OR: [{ companyName: partner.companyName }, { contactName: partner.contactName }] },
          orderBy: { updatedAt: 'desc' },
        });
        if (matched && matched.jid) {
          jids = jidVariants(matched.jid);
          customerId = matched.id;
          industry = matched.industry || null;
        }
      }
    } catch (e) {
      log('WARN', 'Partner→Customer 匹配失败:', e.message);
    }
  }

  if (!jids.length) {
    return { chain: [], customerName, customerId, productLine, dealAmount, currency, winDate, industry };
  }

  // 拉取沟通链路（WAMessage，sessionId 限定该租户会话，jid 匹配）
  const chain = await prisma.wAMessage.findMany({
    where: {
      sessionId: { in: [...sessionSet] },
      OR: [{ from: { in: jids } }, { to: { in: jids } }],
    },
    orderBy: { timestamp: 'asc' },
    take: 300,
  });
  const textChain = chain
    .map((m) => `${m.direction === 'inbound' ? '客户' : '销售'}: ${short(String(m.body || '').trim(), 400)}`)
    .join('\n');
  return {
    chain: textChain.slice(0, 12000),
    chainCount: chain.length,
    sourceMsgIds: chain.map((m) => m.id),
    customerName,
    customerId,
    productLine,
    dealAmount,
    currency,
    winDate,
    industry,
  };
}

/**
 * LLM 生成成交总结
 */
async function generateWinSummary(candidate, ctx) {
  const chain = ctx.chain || '';
  const prompt = `你是外贸销售成交复盘专家。以下是某客户从初次接触到成交的完整沟通记录（销售:我方，客户:对方）。

成交信息：行业=${ctx.industry || '未知'} 产品=${ctx.productLine || '未知'} 金额=${ctx.dealAmount != null ? ctx.dealAmount + ' ' + (ctx.currency || 'USD') : '未知'} 成交时间=${ctx.winDate ? new Date(ctx.winDate).toISOString().slice(0, 10) : '未知'}

沟通记录：
"""${chain || '(无完整记录，仅基于成交信息总结)'}"""

请深度复盘并输出如下JSON（不要输出其他内容）：
{
  "industry": "行业(成交信息中的，或推断)",
  "productLine": "产品线",
  "keyPhrases": [
    {"scene":"场景(询盘/报价/砍价/催单/售后/技术答疑/其他)","text":"关键话术原文(脱敏，去掉人名/公司名/联系方式)","note":"该话术为什么有效(30字内)"}
  ],
  "negotiationSummary": "报价策略与异议处理总结(200字内)",
  "rhythmNotes": "沟通节奏与促成动作总结(200字内)",
  "reusableSop": "可复用的成交SOP步骤(300字内，分步骤)备注：若沟通记录为空，请基于该行业成交的一般规律给出通用SOP并标注(通用)"
}`;
  const raw = await llmChatComplete(
    [{ role: 'user', content: prompt }],
    { temperature: 0.3, max_tokens: 3500, timeout: CFG.llmTimeoutMs },
    6
  );
  const obj = parseLLMJson(raw) || {};
  const keyPhrases = Array.isArray(obj.keyPhrases)
    ? obj.keyPhrases.slice(0, 10).map((k) => ({
        scene: String(k.scene || '其他').slice(0, 20),
        text: String(k.text || '').slice(0, 500),
        note: String(k.note || '').slice(0, 120),
      })).filter((k) => k.text)
    : [];
  return {
    industry: obj.industry && obj.industry !== 'null' ? String(obj.industry).slice(0, 50) : ctx.industry || null,
    productLine: obj.productLine && obj.productLine !== 'null' ? String(obj.productLine).slice(0, 80) : ctx.productLine || null,
    keyPhrases,
    negotiationSummary: String(obj.negotiationSummary || '').slice(0, 600),
    rhythmNotes: String(obj.rhythmNotes || '').slice(0, 600),
    reusableSop: String(obj.reusableSop || '').slice(0, 900),
  };
}

/**
 * 将关键话术写入该租户私有池（权重优先）
 */
async function importKeyPhrasesToPool(accountId, winSummaryId, keyPhrases, extra = {}) {
  let imported = 0;
  for (const kp of keyPhrases) {
    if (!kp.text) continue;
    const dup = await prisma.messageSample.findFirst({
      where: { accountId, salesReply: kp.text, sourceType: 'winsummary' },
      select: { id: true },
    }).catch(() => null);
    if (dup) continue;
    await prisma.messageSample.create({
      data: {
        accountId,
        contactJid: extra.contactJid || 'win-customer',
        customerMsg: `[成交总结#${winSummaryId}] 场景:${kp.scene || '其他'}`,
        salesReply: kp.text,
        usedAi: true,
        aiSuggestion: null,
        aiModified: false,
        contextBefore: `成交话术(权重优先)，备注:${kp.note || ''}`,
        industry: extra.industry || null,
        productLine: extra.productLine || null,
        scene: kp.scene || '其他',
        favorited: false,
        qualityScore: 95, // 成交话术默认高质
        sourceType: 'winsummary',
        sourceMsgIds: JSON.stringify([winSummaryId]),
        publicPool: false,
        reviewStatus: 'pending',
        weight: CFG.weightBase + CFG.weightWinBonus, // 成交话术权重优先
      },
      select: { id: true, weight: true, scene: true },
    });
    imported++;
  }
  return imported;
}

/**
 * 成交总结引擎主入口
 */
export async function runWinSummary({ accountId = CFG.defaultAccountId, limit = 20 } = {}) {
  const started = new Date();
  const job = await prisma.learningJob.create({
    data: { accountId, status: 'running', type: 'winsummary', processed: 0 },
  });
  log('WinSummary', `job#${job.id} 开始成交总结 accountId=${accountId}`);

  let processed = 0;
  try {
    const { candidates, sessionSet } = await findWinCandidates({ accountId });
    let processedCandidates = 0;
    for (const cand of candidates) {
      if (processedCandidates >= limit) break;
      try {
        const ctx = await buildCommunicationChain(cand, sessionSet);
        const summary = await generateWinSummary(cand, ctx);
        const winRecord = await prisma.winSummary.create({
          data: {
            accountId,
            customerId: ctx.customerId ?? (cand.kind === 'partnerorder' ? null : cand.customerId),
            customerName: ctx.customerName ? String(await llmDesensitize(ctx.customerName, '').then((d) => d.customerMsg || ctx.customerName)).slice(0, 100) : null,
            contactJid: cand.kind === 'customer' ? (cand.customer.jid || null) : null,
            industry: summary.industry || null,
            productLine: summary.productLine || null,
            dealAmount: ctx.dealAmount ?? null,
            currency: ctx.currency || 'USD',
            winDate: ctx.winDate ? new Date(ctx.winDate) : null,
            keyPhrases: summary.keyPhrases || [],
            negotiationSummary: summary.negotiationSummary || null,
            rhythmNotes: summary.rhythmNotes || null,
            reusableSop: summary.reusableSop || null,
            sourceMsgIds: ctx.sourceMsgIds || [],
            sourceOrderIds: cand.kind === 'partnerorder' ? [cand.orderId] : null,
            sourceType: cand.kind,
            status: cand.kind === 'customer' ? (cand.customer.dealStage || 'won') : cand.order.status,
          },
          select: { id: true },
        });
        // 关键话术入私有池（权重优先）
        const imported = await importKeyPhrasesToPool(accountId, winRecord.id, summary.keyPhrases, {
          contactJid: cand.kind === 'customer' ? cand.customer.jid : null,
          industry: summary.industry,
          productLine: summary.productLine,
        });
        processed++;
        processedCandidates++;
        log('WinSummary', `job#${job.id} 成交总结#${winRecord.id} 客户=${short(ctx.customerName)} 关键话术=${summary.keyPhrases.length} 入池=${imported}`);
      } catch (e) {
        log('WARN', `job#${job.id} 候选处理失败:`, e.message);
      }
    }
    const finished = new Date();
    const doneJob = await prisma.learningJob.update({
      where: { id: job.id },
      data: { status: 'done', processed: processed, total: candidates.length, imported: processed, message: `成交候选${candidates.length} 完成总结${processed}`, finished },
    });
    log('WinSummary', `job#${doneJob.id} 完成: 候选=${candidates.length} 总结=${processed} 耗时=${((finished - started) / 1000).toFixed(1)}s`);
    return { jobId: doneJob.id, candidates: candidates.length, processed };
  } catch (e) {
    log('WinSummary', `job#${job.id} 失败:`, e.stack || e.message);
    await prisma.learningJob.update({
      where: { id: job.id },
      data: { status: 'failed', message: String(e.message || e).slice(0, 500), finished: new Date() },
    });
    throw e;
  }
}

export default { runWinSummary, findWinCandidates, buildCommunicationChain };
