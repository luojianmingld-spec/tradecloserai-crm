/**
 * Customer Background Check API — 9步结构化背调
 * 覆盖外贸客户背调SOP的9个维度
 */
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import dds from 'duck-duck-scrape';
const { search, SafeSearchType, SearchTimeType } = dds;
import { chatComplete, getAISettings } from '../services/ai.service.js';
import { getProviderById } from '../services/ai-client.js';

const router = Router();
const prisma = new PrismaClient();

// ── Helpers ─────────────────────────────────────────────────────

/** Sleep helper */
const sleep = ms => new Promise(r => setTimeout(r, ms));

/** DuckDuckGo search wrapper — returns top N results, with rate-limit protection */
let lastSearchTime = 0;
const SEARCH_COOLDOWN = 2000; // 2s between DDG calls to avoid rate-limit

async function ddgSearch(query, maxResults = 5) {
  try {
    // Rate limit: ensure at least 2s between searches
    const now = Date.now();
    const elapsed = now - lastSearchTime;
    if (elapsed < SEARCH_COOLDOWN) {
      await sleep(SEARCH_COOLDOWN - elapsed);
    }

    const result = await search(query, {
      safeSearch: SafeSearchType.MODERATE,
      time: SearchTimeType.YEAR,
    });
    lastSearchTime = Date.now();

    return (result.results || []).slice(0, maxResults).map(r => ({
      title: r.title || '',
      url: r.url || '',
      description: r.description || ''
    }));
  } catch (e) {
    console.error(`[BG-Check] DDG search error for "${query}":`, e.message);
    lastSearchTime = Date.now();
    return [];
  }
}

/** Extract domain from URL or email */
function extractDomain(str) {
  if (!str) return null;
  if (str.includes('@')) return str.split('@')[1]?.toLowerCase() || null;
  try {
    const url = new URL(str.startsWith('http') ? str : `https://${str}`);
    return url.hostname.replace(/^www\./, '');
  } catch {
    if (str.includes('.') && !str.includes(' ')) return str.toLowerCase();
    return null;
  }
}

/** Resolve AI provider for background check */
async function resolveBGProvider() {
  const gptProvider = await getProviderById('p1784629520517');
  return {
    provider: gptProvider || null,
    modelId: gptProvider ? gptProvider.model : 'gpt-4o-mini'
  };
}

/** Safe JSON parse from LLM output */
function safeParseLLMJson(raw) {
  if (!raw || typeof raw !== 'string') return null;
  // Try markdown code block first
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch) {
    try { return JSON.parse(fenceMatch[1].trim()); } catch {}
  }
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try { return JSON.parse(jsonMatch[0]); } catch {}
  }
  // Try array
  const arrMatch = raw.match(/\[[\s\S]*\]/);
  if (arrMatch) {
    try { return JSON.parse(arrMatch[0]); } catch {}
  }
  return null;
}

// ── 9 Dimensions ────────────────────────────────────────────────

/**
 * Step 1: Google搜索公司 — 用DDG搜索公司基本信息
 */
async function step1_googleSearch(query, domain) {
  const terms = domain
    ? [`${query} company profile`, `site:${domain}`, `${query} business information`]
    : [`${query} company profile`, `${query} business`, `${query} official website`];

  let allResults = [];
  for (const term of terms) {
    const results = await ddgSearch(term, 5);
    allResults.push(...results);
  }
  // Dedupe
  const seen = new Set();
  const unique = allResults.filter(r => {
    if (!r.title || seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  }).slice(0, 10);

  // Use AI to summarize company info from results
  let companyInfo = '';
  if (unique.length > 0) {
    try {
      const { provider, modelId } = await resolveBGProvider();
      const summary = unique.map((r, i) => `[${i+1}] ${r.title}\n${r.description}`).join('\n');
      companyInfo = await chatComplete(modelId,
        'You are a business analyst. In 2-3 Chinese sentences, summarize the company based on search results. Only output the summary, nothing else.',
        `Company: ${query}\nSearch results:\n${summary}`,
        { temperature: 0.3, maxTokens: 200, provider: provider || undefined }
      );
    } catch (e) {
      companyInfo = '搜索结果不足，无法推断';
    }
  }

  return {
    step: 1,
    name: 'Google搜索公司',
    status: unique.length > 0 ? 'done' : 'error',
    data: {
      results: unique.slice(0, 5),
      companyInfo: companyInfo.trim()
    }
  };
}

/**
 * Step 2: 官网真实性验证 — fetch官网检查HTTP状态码、title、内容长度
 */
async function step2_websiteVerification(domain) {
  if (!domain) {
    return { step: 2, name: '官网真实性验证', status: 'skipped', data: { exists: false, url: null, title: null, contentLength: 0, isReal: 'low' } };
  }

  const url = `https://${domain}`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const resp = await fetch(url, { signal: controller.signal, redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' } });
    clearTimeout(timeout);

    if (!resp.ok) {
      return { step: 2, name: '官网真实性验证', status: 'done', data: { exists: false, url, title: null, contentLength: 0, isReal: 'low' } };
    }

    const html = await resp.text();
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : '';
    const contentLength = html.length;

    // Heuristic: real business sites have >2KB content and a meaningful title
    const isReal = contentLength > 2000 && title.length > 3 ? 'high'
      : contentLength > 500 ? 'medium' : 'low';

    return { step: 2, name: '官网真实性验证', status: 'done', data: { exists: true, url, title, contentLength, isReal } };
  } catch (e) {
    return { step: 2, name: '官网真实性验证', status: 'done', data: { exists: false, url, title: null, contentLength: 0, isReal: 'low', error: e.message } };
  }
}

/**
 * Step 3: Whois查询域名年龄 — 用免费RDAP API
 */
async function step3_whoisDomainAge(domain) {
  if (!domain) {
    return { step: 3, name: 'Whois查询域名年龄', status: 'skipped', data: { domain: null, registeredDate: null, age: null, registrar: null, isOld: null } };
  }

  // Try RDAP first
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    const resp = await fetch(`https://rdap.org/domain/${domain}`, {
      signal: controller.signal,
      headers: { 'Accept': 'application/rdap+json' }
    });
    clearTimeout(timeout);

    if (resp.ok) {
      const data = await resp.json();
      const eventReg = (data.events || []).find(e => e.eventAction === 'registration');
      const registeredDate = eventReg ? eventReg.eventDate : null;
      const registrar = data.entities?.find(e => e.roles?.includes('registrar'))?.vcardArray?.[1]?.find(v => v[0] === 'fn')?.[3] || null;

      let age = null;
      let isOld = null;
      if (registeredDate) {
        age = Math.floor((Date.now() - new Date(registeredDate).getTime()) / (365.25 * 24 * 3600 * 1000));
        isOld = age >= 3;
      }

      return { step: 3, name: 'Whois查询域名年龄', status: 'done', data: { domain, registeredDate, age, registrar, isOld } };
    }
  } catch (e) {
    console.error('[BG-Check] RDAP error:', e.message);
  }

  // Fallback: try free whois API
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    const resp = await fetch(`https://whois.freeaitools.dev/?domain=${domain}`, { signal: controller.signal });
    clearTimeout(timeout);

    if (resp.ok) {
      const text = await resp.text();
      const dateMatch = text.match(/(?:Creation Date|Created Date|created|Registered On|Creation)[:\s]+(\d{4}[-/]\d{2}[-/]\d{2})/i);
      const registeredDate = dateMatch ? dateMatch[1] : null;
      const registrarMatch = text.match(/(?:Registrar|Sponsoring Registrar)[:\s]+(.+)/i);
      const registrar = registrarMatch ? registrarMatch[1].trim() : null;

      let age = null, isOld = null;
      if (registeredDate) {
        age = Math.floor((Date.now() - new Date(registeredDate).getTime()) / (365.25 * 24 * 3600 * 1000));
        isOld = age >= 3;
      }

      return { step: 3, name: 'Whois查询域名年龄', status: 'done', data: { domain, registeredDate, age, registrar, isOld } };
    }
  } catch (e) {
    console.error('[BG-Check] Whois fallback error:', e.message);
  }

  return { step: 3, name: 'Whois查询域名年龄', status: 'error', data: { domain, registeredDate: null, age: null, registrar: null, isOld: null } };
}

/**
 * Step 4: Google Maps查看地址 — 搜索公司地址
 */
async function step4_googleMapsAddress(query) {
  const results = await ddgSearch(`${query} address location`, 5);
  const mapsResults = await ddgSearch(`${query} Google Maps`, 3);

  let address = '';
  let mapsLink = '';
  let verified = false;

  for (const r of [...mapsResults, ...results]) {
    const desc = r.description || r.title || '';
    if (desc.length > 10 && !address) {
      address = desc.substring(0, 200);
    }
    if (r.url.includes('maps.google') || r.url.includes('google.com/maps')) {
      mapsLink = r.url;
      verified = true;
    }
  }

  return {
    step: 4,
    name: 'Google Maps查看地址',
    status: results.length > 0 || mapsResults.length > 0 ? 'done' : 'error',
    data: { address, mapsLink, verified }
  };
}

/**
 * Step 5: LinkedIn查看员工 — 搜索LinkedIn公司页面和员工
 */
async function step5_linkedinEmployees(query) {
  const companyResults = await ddgSearch(`${query} site:linkedin.com/company`, 3);
  const employeeResults = await ddgSearch(`${query} LinkedIn employees`, 5);

  const companyPage = companyResults.length > 0 ? companyResults[0].url : '';

  const employees = employeeResults
    .filter(r => r.url.includes('linkedin.com/in/'))
    .slice(0, 5)
    .map(r => ({
      name: r.title.split(' - ')[0].split(' | ')[0].trim(),
      title: r.description?.substring(0, 100) || ''
    }));

  const orgSize = employees.length > 0 ? `${employees.length}+ found` : 'unknown';

  return {
    step: 5,
    name: 'LinkedIn查看员工',
    status: 'done',
    data: { companyPage, employees, orgSize }
  };
}

/**
 * Step 6: 海关数据分析 — 搜索海关进出口记录
 */
async function step6_customsData(query) {
  const results = await ddgSearch(`${query} customs import export trade data`, 5);
  const panjivaResults = await ddgSearch(`${query} site:panjiva.com`, 3);

  const allUrls = [...results, ...panjivaResults];
  const totalRecords = allUrls.length;

  let records = [];
  if (allUrls.length > 0) {
    try {
      const { provider, modelId } = await resolveBGProvider();
      const snippet = allUrls.map((r, i) => `[${i+1}] ${r.title}\n${r.description}`).join('\n');
      const aiResult = await chatComplete(modelId,
        'Extract customs/trade records from search results. Return JSON array: [{"date":"","product":"","country":"","weight":""}]. If no clear records found return empty array. Only output JSON array.',
        `Company: ${query}\nResults:\n${snippet}`,
        { temperature: 0.2, maxTokens: 500, provider: provider || undefined }
      );
      const parsed = safeParseLLMJson(aiResult);
      if (Array.isArray(parsed)) records = parsed.slice(0, 5);
    } catch {}
  }

  return {
    step: 6,
    name: '海关数据分析',
    status: 'done',
    data: { records, totalRecords }
  };
}

/**
 * Step 7: 企业信用调查 — 搜索诉讼/信用/风险信息
 */
async function step7_creditCheck(query) {
  const riskResults = await ddgSearch(`${query} lawsuit litigation risk`, 3);
  const creditResults = await ddgSearch(`${query} credit rating financial`, 3);
  const scamResults = await ddgSearch(`${query} scam fraud complaint`, 3);

  const allResults = [...riskResults, ...creditResults, ...scamResults];
  const seen = new Set();
  const unique = allResults.filter(r => {
    if (seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });

  let score = 'unknown';
  let risks = [];
  let legalIssues = [];

  if (unique.length > 0) {
    try {
      const { provider, modelId } = await resolveBGProvider();
      const snippet = unique.map((r, i) => `[${i+1}] ${r.title}\n${r.description}`).join('\n');
      const aiResult = await chatComplete(modelId,
        'Analyze credit/legal risk from search results. Return JSON: {"score":"low/medium/high","risks":["risk1"],"legalIssues":["issue1"]}. score=high means HIGH RISK. Only output JSON.',
        `Company: ${query}\nSearch results:\n${snippet}`,
        { temperature: 0.2, maxTokens: 400, provider: provider || undefined }
      );
      const parsed = safeParseLLMJson(aiResult);
      if (parsed) {
        score = parsed.score || 'unknown';
        risks = Array.isArray(parsed.risks) ? parsed.risks : [];
        legalIssues = Array.isArray(parsed.legalIssues) ? parsed.legalIssues : [];
      }
    } catch {}
  }

  return {
    step: 7,
    name: '企业信用调查',
    status: 'done',
    data: { score, risks, legalIssues }
  };
}

/**
 * Step 8: 确认采购负责人 — 从LinkedIn/官网推断采购决策人
 */
async function step8_procurementContact(query) {
  const results = await ddgSearch(`${query} purchasing manager procurement buyer LinkedIn`, 5);
  const directorResults = await ddgSearch(`${query} procurement director supply chain`, 3);

  const allResults = [...results, ...directorResults];

  let name = '';
  let title = '';
  let linkedin = '';
  let source = '';

  const linkedinMatch = allResults.find(r =>
    r.url.includes('linkedin.com/in/') &&
    (r.title.toLowerCase().includes('purchas') || r.title.toLowerCase().includes('procurement') || r.title.toLowerCase().includes('buyer') || r.title.toLowerCase().includes('supply chain'))
  );

  if (linkedinMatch) {
    name = linkedinMatch.title.split(' - ')[0].split(' | ')[0].trim();
    linkedin = linkedinMatch.url;
    source = 'LinkedIn';
    title = linkedinMatch.description?.substring(0, 100) || '';
  }

  if (!name && allResults.length > 0) {
    try {
      const { provider, modelId } = await resolveBGProvider();
      const snippet = allResults.map((r, i) => `[${i+1}] ${r.title}\n${r.url}\n${r.description}`).join('\n');
      const aiResult = await chatComplete(modelId,
        'Find the procurement/purchasing decision maker from search results. Return JSON: {"name":"","title":"","linkedin":"","source":""}. If not found, return empty strings. Only output JSON.',
        `Company: ${query}\nSearch results:\n${snippet}`,
        { temperature: 0.2, maxTokens: 300, provider: provider || undefined }
      );
      const parsed = safeParseLLMJson(aiResult);
      if (parsed && parsed.name) {
        name = parsed.name;
        title = parsed.title || '';
        linkedin = parsed.linkedin || '';
        source = parsed.source || 'AI推断';
      }
    } catch {}
  }

  return {
    step: 8,
    name: '确认采购负责人',
    status: 'done',
    data: { name, title, linkedin, source: source || '未找到' }
  };
}

/**
 * Step 9: 客户评分（A/B/C/D）— AI综合评分
 */
async function step9_rating(query, dimensions) {
  try {
    const { provider, modelId } = await resolveBGProvider();

    const dimSummary = dimensions.map(d => {
      return `Step ${d.step} [${d.name}] status=${d.status}:\n${JSON.stringify(d.data, null, 2)}`;
    }).join('\n\n');

    const aiResult = await chatComplete(modelId,
      `你是一位资深外贸客户背调评分师。根据以下9个维度的背调结果，给出A/B/C/D评级和综合分析。

评分标准：
- A: 官网真实、域名≥3年、LinkedIn有员工、海关有数据、无信用风险 → 优质客户
- B: 官网存在但信息一般、域名1-3年、部分数据可查 → 值得跟进
- C: 官网不存在或信息极少、域名<1年、无海关数据 → 需谨慎
- D: 有诉讼/欺诈记录、网站虚假、新域名高风险 → 建议回避

严格返回JSON（不要markdown代码块）：
{"rating":"A/B/C/D","reasons":["原因1","原因2","..."],"recommendation":"跟进策略建议2-3句"}`,
      `客户: ${query}\n\n${dimSummary}`,
      { temperature: 0.3, maxTokens: 800, provider: provider || undefined }
    );

    const parsed = safeParseLLMJson(aiResult);
    if (parsed) {
      return {
        step: 9,
        name: '客户评分',
        status: 'done',
        data: {
          rating: ['A','B','C','D'].includes(parsed.rating) ? parsed.rating : 'C',
          reasons: Array.isArray(parsed.reasons) ? parsed.reasons : [],
          recommendation: parsed.recommendation || ''
        }
      };
    }
  } catch (e) {
    console.error('[BG-Check] Step 9 AI error:', e.message);
  }

  return {
    step: 9,
    name: '客户评分',
    status: 'done',
    data: { rating: 'C', reasons: ['AI评分失败，默认C级'], recommendation: '建议人工复核' }
  };
}

// ── Main 9-step background check ────────────────────────────────

export async function runFullBackgroundCheck(query, { email, context } = {}) {
  console.log(`[BG-Check] Starting 9-step check for: ${query}`);

  const domain = extractDomain(email) || extractDomain(query);
  const dimensions = [];

  // Step 1
  console.log('[BG-Check] Step 1: Google搜索公司...');
  dimensions.push(await step1_googleSearch(query, domain));

  // Step 2
  console.log('[BG-Check] Step 2: 官网真实性验证...');
  dimensions.push(await step2_websiteVerification(domain));

  // Step 3
  console.log('[BG-Check] Step 3: Whois查询域名年龄...');
  dimensions.push(await step3_whoisDomainAge(domain));

  // Step 4
  console.log('[BG-Check] Step 4: Google Maps查看地址...');
  dimensions.push(await step4_googleMapsAddress(query));

  // Step 5
  console.log('[BG-Check] Step 5: LinkedIn查看员工...');
  dimensions.push(await step5_linkedinEmployees(query));

  // Step 6
  console.log('[BG-Check] Step 6: 海关数据分析...');
  dimensions.push(await step6_customsData(query));

  // Step 7
  console.log('[BG-Check] Step 7: 企业信用调查...');
  dimensions.push(await step7_creditCheck(query));

  // Step 8
  console.log('[BG-Check] Step 8: 确认采购负责人...');
  dimensions.push(await step8_procurementContact(query));

  // Step 9
  console.log('[BG-Check] Step 9: 客户评分...');
  const step9Result = await step9_rating(query, dimensions);
  dimensions.push(step9Result);

  // Collect all source URLs
  const sources = [];
  const seenUrls = new Set();
  for (const d of dimensions) {
    if (d.data?.results) {
      for (const r of d.data.results) {
        if (r.url && !seenUrls.has(r.url)) {
          seenUrls.add(r.url);
          sources.push({ title: r.title, url: r.url });
        }
      }
    }
    if (d.data?.url && !seenUrls.has(d.data.url)) {
      seenUrls.add(d.data.url);
      sources.push({ title: d.data.title || d.name, url: d.data.url });
    }
    if (d.data?.companyPage && !seenUrls.has(d.data.companyPage)) {
      seenUrls.add(d.data.companyPage);
      sources.push({ title: 'LinkedIn Company', url: d.data.companyPage });
    }
    if (d.data?.mapsLink && !seenUrls.has(d.data.mapsLink)) {
      seenUrls.add(d.data.mapsLink);
      sources.push({ title: 'Google Maps', url: d.data.mapsLink });
    }
    if (d.data?.linkedin && !seenUrls.has(d.data.linkedin)) {
      seenUrls.add(d.data.linkedin);
      sources.push({ title: 'LinkedIn Profile', url: d.data.linkedin });
    }
  }

  const rating = step9Result.data?.rating || 'C';
  const summary = `评级: ${rating}\n` +
    (step9Result.data?.reasons?.length ? `原因: ${step9Result.data.reasons.join('; ')}\n` : '') +
    (step9Result.data?.recommendation ? `建议: ${step9Result.data.recommendation}` : '');

  console.log(`[BG-Check] Completed. Rating: ${rating}`);

  return {
    query,
    dimensions,
    rating,
    summary,
    sources: sources.slice(0, 20),
    completedAt: new Date().toISOString()
  };
}

// ── Routes ──────────────────────────────────────────────────────

/**
 * POST /api/background-check
 * Body: { query, context?, email? }
 */
router.post('/', async (req, res) => {
  try {
    const { query, context, email } = req.body;
    if (!query) {
      return res.status(400).json({ error: '请输入公司名称、域名或关键词' });
    }

    const result = await runFullBackgroundCheck(query, { email, context });
    res.json(result);
  } catch (err) {
    console.error('[BG-Check] Error:', err);
    res.status(500).json({ error: '背调分析失败，请稍后重试', details: err.message });
  }
});

/**
 * POST /api/background-check/by-jid/:jid
 * 从CRM聊天中自动获取客户信息，执行9步背调
 */
router.post('/by-jid/:jid', async (req, res) => {
  try {
    const { jid } = req.params;
    if (!jid) {
      return res.status(400).json({ error: '缺少jid参数' });
    }

    const userId = req.userId || 1;
    const customer = await prisma.customer.findFirst({
      where: { jid, userId }
    });

    if (!customer) {
      return res.status(404).json({ error: '未找到该客户记录，请先添加客户信息' });
    }

    let query = customer.companyName || customer.company || customer.name || '';
    if (!query && customer.phone) {
      query = customer.phone;
    }
    if (!query) {
      return res.status(400).json({ error: '该客户缺少公司名/联系人名/手机号，无法执行背调' });
    }

    const result = await runFullBackgroundCheck(query, {
      email: customer.email || undefined,
      context: `${customer.contactName || ''} ${customer.title || ''} ${customer.country || ''} ${customer.city || ''} ${customer.address || ''}`
    });

    // Save background check result to customer record
    try {
      const existingFields = customer.aiAutoFields ? JSON.parse(customer.aiAutoFields) : {};
      await prisma.customer.update({
        where: { id: customer.id },
        data: {
          aiAutoFields: JSON.stringify({
            ...existingFields,
            backgroundCheck: {
              rating: result.rating,
              dimensions: result.dimensions.map(d => ({ step: d.step, name: d.name, status: d.status })),
              completedAt: result.completedAt
            }
          })
        }
      });
    } catch (e) {
      console.error('[BG-Check] Failed to save result to customer:', e.message);
    }

    res.json(result);
  } catch (err) {
    console.error('[BG-Check] by-jid Error:', err);
    res.status(500).json({ error: '背调分析失败，请稍后重试', details: err.message });
  }
});

export default router;
