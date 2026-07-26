#!/usr/bin/env python3
"""前端卡片化渲染 - v2修正"""
path = '/opt/whatsapp-crm/frontend/src/views/LayoutView.vue'
with open(path, 'r', encoding='utf-8') as f:
    src = f.read()

# === 1. reqData声明后加 reqSections + parseReqSummary ===
old_reqdata = """const reqData = ref({ contactName: '', name: '', phone: '', requirementProducts: '', requirementQuantity: '', requirementBudget: '', requirementDelivery: '', requirementSummary: '', requirementSource: '' });
const reqEditMode = ref(false);"""

new_reqdata = r"""const reqData = ref({ contactName: '', name: '', phone: '', requirementProducts: '', requirementQuantity: '', requirementBudget: '', requirementDelivery: '', requirementSummary: '', requirementSource: '' });
const reqSections = ref([]);
const reqEditMode = ref(false);

// 解析需求总结（JSON结构化优先，纯文本兜底）
function parseReqSummary(raw) {
  if (!raw) { reqSections.value = []; return; }
  try {
    const firstBrace = raw.indexOf('{');
    const lastBrace = raw.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      const obj = JSON.parse(raw.slice(firstBrace, lastBrace + 1));
      if (obj.sections && Array.isArray(obj.sections)) {
        obj.sections.forEach(s => {
          if (s.type === 'list' && Array.isArray(s.items)) {
            s.items = s.items.map(it => {
              if (typeof it !== 'string') return { title: '', desc: String(it) };
              const m = it.match(/^\*\*(.+?)\*\*[\s：:｜|\-]*([\s\S]*)$/);
              if (m) return { title: m[1].trim(), desc: (m[2]||'').trim() };
              return { title: '', desc: it };
            });
          }
        });
        reqSections.value = obj.sections;
        return;
      }
    }
  } catch(e) { console.warn('parse req JSON failed:', e.message); }
  reqSections.value = [{ icon: '📝', title: '需求总结', type: 'text', content: raw }];
}"""

assert old_reqdata in src
src = src.replace(old_reqdata, new_reqdata, 1)

# === 2. loadReqData：在 reqData.value = {...} 之后加 parseReqSummary ===
old_load_block = """    reqData.value = {
      contactName: data.contactName || data.name || '',
      name: data.name || '',
      phone: data.phone || '',
      requirementProducts: data.requirementProducts || '',
      requirementQuantity: data.requirementQuantity || '',
      requirementBudget: data.requirementBudget || '',
      requirementDelivery: data.requirementDelivery || '',
      requirementSummary: data.requirementSummary || '',
      requirementSource: data.requirementSource || '',
    };
    reqUpdatedAt.value = data.requirementUpdatedAt || data.updatedAt || null;"""
new_load_block = """    reqData.value = {
      contactName: data.contactName || data.name || '',
      name: data.name || '',
      phone: data.phone || '',
      requirementProducts: data.requirementProducts || '',
      requirementQuantity: data.requirementQuantity || '',
      requirementBudget: data.requirementBudget || '',
      requirementDelivery: data.requirementDelivery || '',
      requirementSummary: data.requirementSummary || '',
      requirementSource: data.requirementSource || '',
    };
    parseReqSummary(data.requirementSummary || '');
    reqUpdatedAt.value = data.requirementUpdatedAt || data.updatedAt || null;"""
assert old_load_block in src, "load block not found"
src = src.replace(old_load_block, new_load_block, 1)

# === 3. 清空时清sections（找reset位置） ===
old_reset = """    reqData.value = { contactName: '', name: '', phone: '', requirementProducts: '', requirementQuantity: '', requirementBudget: '', requirementDelivery: '', requirementSummary: '', requirementSource: '' };
    reqUpdatedAt.value = null;"""
new_reset = """    reqData.value = { contactName: '', name: '', phone: '', requirementProducts: '', requirementQuantity: '', requirementBudget: '', requirementDelivery: '', requirementSummary: '', requirementSource: '' };
    reqSections.value = [];
    reqUpdatedAt.value = null;"""
assert old_reset in src
src = src.replace(old_reset, new_reset, 1)

# === 4. runReqAiAnalyze开头清空时加清sections ===
src = src.replace(
    "  reqData.value.requirementSummary = '';\n  try {",
    "  reqData.value.requirementSummary = '';\n  reqSections.value = [];\n  try {"
)

# === 5. 替换runReqAiAnalyze里的旧拼接逻辑 ===
old_run = """    const { data } = await api.post(`/customers/${cid}/ai-requirement`, { limit: 50 });
    // 合并AI返回的各字段到一段文字
    const parts = [];
    if (data.products) parts.push('意向产品：' + data.products);
    if (data.quantity) parts.push('数量：' + data.quantity);
    if (data.budget) parts.push('目标价：' + data.budget);
    if (data.delivery) parts.push('交期：' + data.delivery);
    const structured = parts.length ? parts.join('；') + '。' : '';
    const merged = (structured + (data.summary ? (structured ? '\\n\\n' + data.summary : data.summary) : '')).trim();
    reqData.value.requirementSummary = merged || reqData.value.requirementSummary;
    // 仍保留子字段更新（向后兼容/避免字段丢失）
    if (data.products) reqData.value.requirementProducts = data.products;
    if (data.quantity) reqData.value.requirementQuantity = data.quantity;
    if (data.budget) reqData.value.requirementBudget = data.budget;
    if (data.delivery) reqData.value.requirementDelivery = data.delivery;
    reqData.value.requirementSource = 'ai_summary';
    reqEditMode.value = false;
    reqAiHint.value = 'AI已生成需求总结';"""
new_run = """    const { data } = await api.post(`/customers/${cid}/ai-requirement`, { limit: 50 });
    if (data.summary) {
      reqData.value.requirementSummary = data.summary;
      parseReqSummary(data.summary);
    }
    reqData.value.requirementSource = 'ai_summary';
    reqEditMode.value = false;
    reqAiHint.value = 'AI已生成需求分析';"""
assert old_run in src, "run block not found"
src = src.replace(old_run, new_run, 1)

# === 6. 模板替换 ===
old_tpl = """              <div class="req-fields">
                <div class="req-summary-text-block req-md-content" :class="{empty:!reqData.requirementSummary}" v-html="reqData.requirementSummary ? renderMarkdown(reqData.requirementSummary) : '<i>点击下方按钮，AI自动分析客户聊天记录，生成需求报告</i>'"></div>
                <div class="customer-footer req-footer-center">
                  <button class="customer-btn-primary req-big-btn" @click="runReqAiAnalyze" :disabled="reqAiLoading">
                    {{ reqAiLoading ? '⏳ AI分析中，请稍候...' : (reqData.requirementSummary ? '🔄 重新分析' : '🤖 一键AI客户分析') }}
                  </button>
                </div>
              </div>"""
new_tpl = """              <div class="req-fields">
                <div v-if="reqSections.length === 0" class="req-empty-hint">
                  <div style="font-size:40px;margin-bottom:8px">🎯</div>
                  <div>点击下方按钮，AI自动分析客户聊天记录</div>
                  <div style="font-size:12px;color:#5a6a75;margin-top:4px">生成8大板块结构化需求报告</div>
                </div>
                <div v-else class="req-cards">
                  <div v-for="(sec, idx) in reqSections" :key="idx" class="req-card">
                    <div class="req-card-head">
                      <span class="req-card-icon">{{ sec.icon }}</span>
                      <span class="req-card-title">{{ sec.title }}</span>
                    </div>
                    <div class="req-card-body">
                      <table v-if="sec.type === 'table'" class="req-kv-table">
                        <tr v-for="(row, ri) in sec.rows" :key="ri">
                          <td class="kv-label">{{ row.label }}</td>
                          <td class="kv-value">{{ row.value }}</td>
                        </tr>
                      </table>
                      <ul v-else-if="sec.type === 'list'" class="req-list">
                        <li v-for="(it, li) in sec.items" :key="li">
                          <span class="req-list-badge">{{ li + 1 }}</span>
                          <span class="req-list-text">
                            <strong v-if="it.title" class="req-list-title">{{ it.title }}</strong>
                            <span v-if="it.desc">{{ it.title ? '：' : '' }}{{ it.desc }}</span>
                          </span>
                        </li>
                      </ul>
                      <div v-else-if="sec.type === 'text'" class="req-text">{{ sec.content }}</div>
                    </div>
                  </div>
                </div>
                <div class="customer-footer req-footer-center">
                  <button class="customer-btn-primary req-big-btn" @click="runReqAiAnalyze" :disabled="reqAiLoading">
                    {{ reqAiLoading ? '⏳ AI分析中，请稍候...' : (reqSections.length ? '🔄 重新分析' : '🤖 一键AI客户分析') }}
                  </button>
                </div>
              </div>"""
assert old_tpl in src, "tpl not found"
src = src.replace(old_tpl, new_tpl, 1)

# === 7. 删除旧renderMarkdown函数 ===
rm_start = src.find('function renderMarkdown(md) {')
assert rm_start != -1
next_fn = src.find('\nfunction formatMsgTime', rm_start)
assert next_fn != -1
src = src[:rm_start] + src[next_fn+1:]

# === 8. 注入CSS ===
card_css = """
/* ========== 需求分析卡片化样式 ========== */
.req-empty-hint { text-align:center; padding:28px 12px; color:#8696a0; font-size:13px; }
.req-cards { display:flex; flex-direction:column; gap:10px; padding:2px 0 4px; }
.req-card { background:#202c33; border-radius:10px; overflow:hidden; border:1px solid #2a3942; }
.req-card-head { display:flex; align-items:center; gap:8px; padding:10px 12px 8px; border-bottom:1px solid #2a3942; }
.req-card-icon { font-size:15px; }
.req-card-title { color:#e9edef; font-size:13px; font-weight:600; }
.req-card-body { padding:6px 12px 10px; }
.req-kv-table { width:100%; border-collapse:collapse; font-size:12.5px; }
.req-kv-table tr { border-bottom:1px solid #2a394230; }
.req-kv-table tr:last-child { border-bottom:none; }
.req-kv-table td { padding:6px 4px; vertical-align:top; line-height:1.5; }
.kv-label { color:#8696a0; width:88px; min-width:88px; white-space:nowrap; font-size:12px; padding-right:10px !important; }
.kv-value { color:#d1d7db; word-break:break-word; }
.req-list { list-style:none; margin:0; padding:0; }
.req-list li { display:flex; gap:8px; padding:5px 0; font-size:12.5px; line-height:1.55; align-items:flex-start; }
.req-list-badge { display:inline-flex;align-items:center;justify-content:center;min-width:18px;height:18px;border-radius:50%;background:#00a88430;color:#00a884;font-size:10px;font-weight:700;flex-shrink:0;margin-top:1px; }
.req-list-text { color:#d1d7db; flex:1; word-break:break-word; }
.req-list-title { color:#00a884; font-weight:600; }
.req-text { color:#d1d7db; font-size:13px; line-height:1.65; white-space:pre-wrap; word-break:break-word; }
.req-footer-center { justify-content:center; padding-top:14px; }
.req-big-btn { width:100% !important; padding:10px 20px !important; font-size:14px !important; border-radius:22px !important; background:linear-gradient(135deg,#7c3aed,#5b21b6) !important; box-shadow:0 2px 8px #7c3aed40; border:none; color:#fff; }
.req-big-btn:hover:not(:disabled) { box-shadow:0 4px 14px #7c3aed70; }
.req-big-btn:disabled { opacity:.7; cursor:wait; }
"""
style_end = src.rfind('</style>')
assert style_end != -1
src = src[:style_end] + card_css + '\n' + src[style_end:]

with open(path, 'w', encoding='utf-8') as f:
    f.write(src)
print("FRONTEND PATCH v2 OK")
