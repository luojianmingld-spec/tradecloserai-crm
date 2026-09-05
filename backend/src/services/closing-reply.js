/**
 * Closing Reply Service — AI 成交模式回复
 * 根据 Pipeline 阶段 + 客户态度 + BANT 评分，生成针对性成交话术
 */
import { PrismaClient } from '@prisma/client';
import { chatComplete } from './ai-client.js';
import { resolveToPhoneJid } from './lid-mapping.js';

const prisma = new PrismaClient();

// ── Stage → 中文映射 + 成交策略 ──────────────────────────────────────
const STAGE_MAP = {
  new:         { name: '新线索',   group: 'early' },
  qualified:   { name: '已合格',   group: 'qualified' },
  quoting:     { name: '报价中',   group: 'proposal' },
  negotiating: { name: '谈判中',   group: 'negotiation' },
  won:         { name: '已成交',   group: 'won' },
  completed:   { name: '已完成',   group: 'won' },
  lost:        { name: '已流失',   group: 'lost' },
};

const GROUP_STRATEGIES = {
  early: {
    label: '建立信任·挖掘需求',
    prompt: `当前客户处于早期阶段（新线索/刚接触），还未建立足够信任。
成交策略重点：
- 建立信任：用专业、真诚的语气，展示对客户业务的理解
- 挖掘需求：通过提问引导客户说出真实痛点和需求
- 了解痛点：让客户感受到你关心他的问题，而不是急于推销
- 适度展示价值：提及成功案例或行业经验，但不施压
可用策略标签：社会证明、痛点共鸣、价值暗示、需求引导`,
    stageAdvice: '先建立信任再谈产品，了解客户痛点比展示产品更重要',
  },
  qualified: {
    label: '产品推荐·价值塑造',
    prompt: `当前客户已通过初步筛选，需求明确，进入产品推荐阶段。
成交策略重点：
- 产品推荐：根据客户需求精准推荐产品/方案
- 价值塑造：用具体数据、对比、ROI 展示产品价值
- 案例引用：引用同行业/同地区客户成功案例
- 差异化优势：突出与竞品的关键差异
可用策略标签：价值强化、社会证明、差异化优势、案例引用`,
    stageAdvice: '精准匹配需求推荐产品，用案例和数据塑造价值感',
  },
  proposal: {
    label: '强化价值·处理犹豫',
    prompt: `当前客户已收到报价，正在考虑中，可能存在犹豫。
成交策略重点：
- 强化价值：重申核心价值和投资回报
- 处理犹豫：识别犹豫原因（价格/交期/信任），针对性消除
- 对比优势：与竞品或替代方案对比，突出选择理由
- 降低风险：提供保障、试用、分阶段合作等降低决策风险
可用策略标签：价值强化、风险逆转、对比优势、社会证明、损失规避`,
    stageAdvice: '找到犹豫根源精准突破，用对比和保障降低决策门槛',
  },
  negotiation: {
    label: '让步策略·制造紧迫感',
    prompt: `当前客户进入谈判阶段，可能在压价或要求额外条件。
成交策略重点：
- 让步策略：让步必须换条件（如"可以降价，但增加数量"）
- 制造紧迫感：限时优惠、库存紧张、旺季将至等
- 限时优惠：设定明确截止时间，促进快速决策
- 双赢框架：让客户感到自己赢得了好交易
可用策略标签：直接成交法、紧迫感制造、让步换条件、限时优惠、损失规避`,
    stageAdvice: '让步必须换条件，用紧迫感推动决策但不要显得急切',
  },
  won: {
    label: '维护关系·铺垫复购',
    prompt: `当前客户已成交，这是维护关系和拓展机会的阶段。
成交策略重点：
- 维护关系：感谢合作，表达重视
- 铺垫复购：了解新需求，推荐相关产品
- 转介绍请求：请客户推荐有同样需求的朋友/同行
- 长期合作：提议框架协议或长期合作方案
可用策略标签：关系维护、复购引导、转介绍请求、长期合作`,
    stageAdvice: '成交不是终点，趁热打铁铺垫复购和转介绍',
  },
  lost: {
    label: '挽回策略·重新激活',
    prompt: `当前客户已流失，尝试挽回。
成交策略重点：
- 了解原因：温和询问流失原因
- 展示改变：说明产品/服务/价格的改进
- 提供诱惑：特别优惠或新方案
- 保持联系：即使暂时不回来也保持友好关系
可用策略标签：挽回激活、价值重塑、特别优惠`,
    stageAdvice: '温和了解流失原因，展示改进后重新提供价值',
  },
};

// ── JID normalization (consistent with ai-reply.js + lid-mapping) ────
function normalizeJid(jid) {
  if (!jid) return jid;
  // Resolve @lid to phone JID first
  const resolved = resolveToPhoneJid(jid);
  const effective = resolved || jid;
  if (!effective.includes('@')) return effective.replace(/\D/g, '') + '@s.whatsapp.net';
  return effective;
}

// ── Build OR conditions for message query (兼容 whatsapp + telegram) ─
function buildJidOrConditions(jid) {
  const phone = jid.split('@')[0];
  const bareJid = phone + '@s.whatsapp.net';
  const lidJid = phone + '@lid';
  const cUsJid = phone + '@c.us';
  return [
    { from: jid, direction: 'inbound' },
    { to: jid, direction: 'outbound' },
    { from: bareJid, direction: 'inbound' },
    { to: bareJid, direction: 'outbound' },
    { from: lidJid, direction: 'inbound' },
    { to: lidJid, direction: 'outbound' },
    { from: cUsJid, direction: 'inbound' },
    { to: cUsJid, direction: 'outbound' },
  ];
}

// ── Fetch recent messages ─────────────────────────────────────────────
async function getRecentMessages(sessionId, jid, limit = 20) {
  try {
    const msgs = await prisma.wAMessage.findMany({
      where: {
        sessionId,
        OR: buildJidOrConditions(jid),
      },
      orderBy: { timestamp: 'desc' },
      take: limit,
      select: {
        body: true,
        translation: true,
        sourceLang: true,
        direction: true,
        timestamp: true,
      },
    });
    return msgs.reverse().map(m => ({
      fromMe: m.direction === 'outbound',
      content: m.body || '',
      translation: m.translation || null,
      sourceLang: m.sourceLang || null,
      timestamp: m.timestamp,
    }));
  } catch (e) {
    console.error('[ClosingReply] DB query error:', e.message);
    return [];
  }
}

// ── Build conversation context (same pattern as ai-reply.js) ──────────
function buildConversationContext(messages) {
  const lines = messages.map((msg) => {
    const sender = msg.fromMe ? '我方' : '客户';
    const time = new Date(msg.timestamp).toLocaleString('zh-CN', {
      month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    });
    let text = msg.content || '';
    if (!msg.fromMe && msg.translation) {
      let trans = msg.translation;
      if (typeof trans === 'string') {
        try { trans = JSON.parse(trans); } catch (_) {}
      }
      if (typeof trans === 'object' && trans.translated && trans.translated !== text) {
        text = `${text}（翻译：${trans.translated}）`;
      } else if (typeof trans === 'string' && trans && trans !== text) {
        text = `${text}（翻译：${trans}）`;
      }
    }
    return `[${time}] ${sender}: ${text}`;
  });
  return lines.join('\n');
}

// ── Detect customer language ──────────────────────────────────────────
function detectCustomerLanguage(messages) {
  const customerMsgs = messages.filter(m => !m.fromMe).slice(-5);
  if (customerMsgs.length === 0) return 'en';
  const langs = customerMsgs.map(m => m.sourceLang).filter(Boolean);
  if (langs.length > 0) {
    const counts = {};
    langs.forEach(l => { counts[l] = (counts[l] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  }
  const text = customerMsgs.map(m => m.content).join(' ');
  if (/[\u4e00-\u9fff]/.test(text)) return 'zh';
  if (/[\u3040-\u309f\u30a0-\u30ff]/.test(text)) return 'ja';
  if (/[\uac00-\ud7af]/.test(text)) return 'ko';
  if (/[\u0600-\u06ff]/.test(text)) return 'ar';
  if (/[\u0400-\u04ff]/.test(text)) return 'ru';
  if (/\b(der|die|das|und|ist|ich)\b/i.test(text)) return 'de';
  if (/\b(el|la|los|las|de|en|que)\b/i.test(text)) return 'es';
  if (/\b(le|la|les|de|des|du|est)\b/i.test(text)) return 'fr';
  return 'en';
}

// ── Build attitude summary for prompt ─────────────────────────────────
function buildAttitudePrompt(attitude) {
  if (!attitude) return '客户态度数据暂无。';
  const parts = [];
  if (attitude.intentLevel) {
    const map = { HIGH: '高', MEDIUM: '中', LOW: '低' };
    parts.push(`购买意向：${map[attitude.intentLevel] || attitude.intentLevel}`);
  }
  if (attitude.sentiment) {
    const map = { POSITIVE: '积极', NEUTRAL: '中性', NEGATIVE: '消极' };
    parts.push(`情绪状态：${map[attitude.sentiment] || attitude.sentiment}`);
  }
  if (attitude.urgency) {
    const map = { URGENT: '紧急', NORMAL: '正常', PATIENT: '从容' };
    parts.push(`紧迫度：${map[attitude.urgency] || attitude.urgency}`);
  }
  if (attitude.trend) {
    const map = { IMPROVING: '上升', STABLE: '稳定', DECLINING: '下降' };
    parts.push(`趋势：${map[attitude.trend] || attitude.trend}`);
  }
  if (attitude.focusPoints) {
    let fp = attitude.focusPoints;
    if (typeof fp === 'string') { try { fp = JSON.parse(fp); } catch (_) {} }
    if (Array.isArray(fp) && fp.length) parts.push(`关注点：${fp.join('、')}`);
  }
  return parts.join('；') || '客户态度数据暂无。';
}

// ── Build attitude-based special instructions ─────────────────────────
function buildAttitudeAdjustment(attitude) {
  if (!attitude) return '';
  const adjustments = [];
  if (attitude.sentiment === 'NEGATIVE') {
    adjustments.push('⚠️ 客户情绪消极，必须先修复情绪再推进成交。用共情、道歉或理解的方式先缓和气氛，不要直接推进销售。');
  }
  if (attitude.urgency === 'URGENT') {
    adjustments.push('⚡ 客户紧急度高，可以加快节奏，直接切入核心方案和快速成交路径，减少铺垫。');
  }
  if (attitude.intentLevel === 'LOW') {
    adjustments.push('💡 客户购买意向较低，不要强推成交，先增强价值感知和需求紧迫性。');
  }
  if (attitude.sentiment === 'POSITIVE' && attitude.intentLevel === 'HIGH') {
    adjustments.push('🔥 客户情绪积极且购买意向高，可以直接使用强硬成交法，明确引导下单。');
  }
  if (attitude.trend === 'DECLINING') {
    adjustments.push('📉 客户兴趣在下降，需要用新亮点或新方案重新激发兴趣，避免客户流失。');
  }
  return adjustments.join('\n');
}

// ── Build BANT-based special instructions ─────────────────────────────
function buildBantAdjustment(bant) {
  if (!bant) return '';
  const adjustments = [];
  if (bant.budgetScore <= 3) {
    adjustments.push('💰 预算评分较低，强调性价比、分阶段投入、ROI 计算，帮助客户看到投资回报。');
  }
  if (bant.authorityScore <= 3) {
    adjustments.push('👔 决策权评分较低，引导客户引荐决策者，或帮助客户构建内部提案。');
  }
  if (bant.needScore <= 3) {
    adjustments.push('🎯 需求评分较低，先强化痛点感知和解决方案必要性，再推进成交。');
  }
  if (bant.timelineScore <= 3) {
    adjustments.push('⏰ 时间线评分较低，制造紧迫感（旺季、库存、涨价等），加速决策。');
  }
  if (bant.timelineScore >= 8) {
    adjustments.push('⏰ 时间线紧迫，直接推进快速成交路径，减少冗余沟通。');
  }
  return adjustments.join('\n');
}

// ── Parse LLM response ────────────────────────────────────────────────
function parseClosingReplies(content) {
  if (!content) return [];
  try {
    let jsonStr = content;
    const fenceMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) jsonStr = fenceMatch[1].trim();
    const parsed = JSON.parse(jsonStr);
    const arr = Array.isArray(parsed) ? parsed : parsed.replies;
    if (Array.isArray(arr)) {
      return arr
        .filter(r => r && typeof r === 'object')
        .map(r => ({
          foreign: String(r.foreign || '').trim(),
          zh: String(r.zh || '').trim(),
          tactic: String(r.tactic || '').trim(),
          stageAdvice: String(r.stageAdvice || '').trim(),
        }))
        .filter(r => r.foreign.length > 0)
        .slice(0, 3);
    }
  } catch (_) {}

  // Fallback: line-based parsing
  const lines = content.split('\n').filter(l => l.trim());
  const replies = [];
  for (const line of lines) {
    const cleaned = line.replace(/^\d+[\.、)）]\s*/, '').replace(/^[-*•]\s*/, '').trim();
    if (cleaned && cleaned.length > 5) {
      replies.push({ foreign: cleaned, zh: '', tactic: '通用', stageAdvice: '' });
    }
  }
  return replies.slice(0, 3);
}

// ── Main: generateClosingReply ────────────────────────────────────────
/**
 * Generate closing-stage-aware reply suggestions
 * @param {Object} params
 * @param {number} params.userId   - current user id
 * @param {number} params.accountId - account id (same as userId in single-account model)
 * @param {string} params.jid      - customer JID (required)
 * @returns {Object} { replies, stage, stageName, attitudeSummary, closingStrategy }
 */
export async function generateClosingReply({ userId, accountId, jid }) {
  if (!jid) return { replies: [], error: 'jid 是必填参数' };

  const effectiveUserId = accountId || userId;
  const targetJid = normalizeJid(jid);
  if (!targetJid) return { replies: [], error: '无效的 JID' };

  // 1. Find customer by JID variants
  const phone = targetJid.split('@')[0];
  const jidVariants = [targetJid];
  if (targetJid.endsWith('@s.whatsapp.net')) {
    jidVariants.push(phone + '@c.us', phone + '@lid');
  } else if (targetJid.endsWith('@c.us')) {
    jidVariants.push(phone + '@s.whatsapp.net', phone + '@lid');
  }

  let customer = null;
  try {
    customer = await prisma.customer.findFirst({
      where: {
        userId: effectiveUserId,
        OR: [
          { jid: { in: jidVariants } },
          { phone },
        ],
      },
    });
  } catch (e) {
    console.error('[ClosingReply] Customer query error:', e.message);
  }

  // 2. Get stage info
  const rawStage = customer?.dealStage || 'new';
  const stageInfo = STAGE_MAP[rawStage] || STAGE_MAP.new;
  const group = stageInfo.group;
  const stageName = stageInfo.name;
  const strategyInfo = GROUP_STRATEGIES[group] || GROUP_STRATEGIES.early;

  // 3. Get attitude data
  let attitude = null;
  if (customer) {
    try {
      attitude = await prisma.customerAttitude.findUnique({
        where: { contactId: customer.id },
      });
    } catch (e) {
      console.error('[ClosingReply] Attitude query error:', e.message);
    }
  }

  // 4. Get BANT score
  let bant = null;
  if (customer) {
    try {
      bant = await prisma.customerBantScore.findFirst({
        where: { contactId: customer.id },
        orderBy: { evaluatedAt: 'desc' },
      });
    } catch (e) {
      console.error('[ClosingReply] BANT query error:', e.message);
    }
  }

  // 5. Get recent messages
  const sessionId = 'user_' + effectiveUserId;
  const messages = await getRecentMessages(sessionId, targetJid, 20);
  if (!messages || messages.length === 0) {
    return { replies: [], error: '暂无消息记录，无法生成成交回复' };
  }

  // 6. Build context
  const customerLang = detectCustomerLanguage(messages);
  const contextStr = buildConversationContext(messages);
  const attitudeSummary = buildAttitudePrompt(attitude);
  const attitudeAdjust = buildAttitudeAdjustment(attitude);
  const bantAdjust = buildBantAdjustment(bant);

  // Customer info enrichment
  const customerInfo = [];
  if (customer?.name) customerInfo.push(`客户名：${customer.name}`);
  if (customer?.companyName) customerInfo.push(`公司：${customer.companyName}`);
  if (customer?.country) customerInfo.push(`国家：${customer.country}`);
  if (customer?.industry) customerInfo.push(`行业：${customer.industry}`);
  if (customer?.customerLevel) customerInfo.push(`客户等级：${customer.customerLevel}`);
  const customerInfoStr = customerInfo.length ? customerInfo.join('，') : '客户信息暂无';

  // BANT summary
  const bantStr = bant
    ? `BANT评分 — 预算:${bant.budgetScore}/10 权威:${bant.authorityScore}/10 需求:${bant.needScore}/10 时间线:${bant.timelineScore}/10 综合:${bant.totalScore}/10 (${bant.level})`
    : 'BANT评分暂无';

  // 7. Build system prompt
  const systemPrompt = `你是一位资深外贸成交教练，擅长根据客户所处 Pipeline 阶段、客户态度和 BANT 评分，生成精准的成交话术。

## 当前阶段策略
阶段：${stageName}（${rawStage}）
策略方向：${strategyInfo.label}
${strategyInfo.prompt}

## 客户态度
${attitudeSummary}
${attitudeAdjust ? '\n## 态度调整指令\n' + attitudeAdjust : ''}

## BANT 评分
${bantStr}
${bantAdjust ? '\n## BANT 调整指令\n' + bantAdjust : ''}

## 话术要求
1. 生成 3 条回复建议，每条侧重不同的成交策略
2. foreign 字段必须使用客户的语言（${customerLang || '英语'}），可以直接发送
3. zh 字段是 foreign 对应的中文翻译，供销售预览
4. tactic 字段是该回复使用的成交策略标签（如"直接成交法"、"价值强化"、"紧迫感制造"、"让步换条件"、"社会证明"、"损失规避"等）
5. stageAdvice 字段是该阶段的简短成交建议（1句话，给销售看）
6. 回复要自然流畅、针对性强，不能生硬模板化
7. 每条回复长度 1-3 句话
8. 必须融入客户态度和BANT数据的调整指令

请严格按以下JSON格式返回（纯JSON，不要加markdown代码块，不要加其他内容）：
{"replies":[{"foreign":"客户语言回复1","zh":"中文翻译1","tactic":"策略标签1","stageAdvice":"阶段建议1"},{"foreign":"客户语言回复2","zh":"中文翻译2","tactic":"策略标签2","stageAdvice":"阶段建议2"},{"foreign":"客户语言回复3","zh":"中文翻译3","tactic":"策略标签3","stageAdvice":"阶段建议3"}]}`;

  // 8. Call LLM
  try {
    const response = await chatComplete(
      [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `## 客户信息\n${customerInfoStr}\n\n## 最近对话上下文（对方=客户，我方=销售）\n${contextStr}\n\n请生成 3 条成交回复建议，严格按JSON格式返回。`,
        },
      ],
      { temperature: 0.8, creditUserId: effectiveUserId } // 【积分铁律 2026-09-05】按 effectiveUserId 扣
    );
    const content = (response || '').trim();
    const replies = parseClosingReplies(content);

    return {
      replies,
      stage: rawStage,
      stageName,
      attitudeSummary,
      closingStrategy: strategyInfo.label,
    };
  } catch (err) {
    console.error('[ClosingReply] Generation error:', err);
    return { replies: [], error: 'AI成交回复生成失败：' + err.message };
  }
}
