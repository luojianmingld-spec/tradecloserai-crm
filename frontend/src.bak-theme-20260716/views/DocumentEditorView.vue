<template>
  <div class="doc-editor-page no-print">
    <!-- Top bar -->
    <div class="ed-topbar">
      <button class="back-btn" @click="goBack">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
        <span>返回客户</span>
      </button>
      <h3 class="ed-title">
        {{ doc.type === 'PI' ? '📋 PI 形式发票' : '🧾 报价单' }}
        <span v-if="doc.docNumber" class="ed-docnum">/ {{ doc.docNumber }}</span>
      </h3>
      <div class="spacer"></div>
      <button class="action-btn primary" @click="doSave" :disabled="saving">💾 保存</button>
      <button class="action-btn" @click="openPrint">👁️ 预览/打印</button>
      <button class="action-btn" @click="sendToast">📤 发送</button>
      <button class="action-btn ghost" @click="goBack">取消</button>
    </div>

    <!-- Main: split -->
    <div class="ed-main" v-if="loaded">
      <!-- Left form -->
      <div class="ed-left">
        <div class="ed-scroll">
          <!-- Type -->
          <section class="ed-sec">
            <div class="sec-title">📄 单证类型</div>
            <div class="type-cards">
              <div class="type-card" :class="{active:doc.type==='PI'}" @click="doc.type='PI'; onTypeChange()">
                <div class="tc-icon">📋</div>
                <div class="tc-name">PI形式发票</div>
              </div>
              <div class="type-card" :class="{active:doc.type==='QUOTATION'}" @click="doc.type='QUOTATION'; onTypeChange()">
                <div class="tc-icon">🧾</div>
                <div class="tc-name">报价单 Quotation</div>
              </div>
            </div>
          </section>

          <!-- Doc header -->
          <section class="ed-sec">
            <div class="sec-title">📅 单证信息</div>
            <div class="form-grid-2">
              <div class="fg"><label>编号(自动)</label><el-input v-model="doc.docNumber" disabled /></div>
              <div class="fg"><label>日期</label><el-input v-model="doc.issueDate" type="date" /></div>
              <div class="fg" v-if="doc.type==='QUOTATION'"><label>有效期至</label><el-input v-model="doc.validUntil" type="date" /></div>
              <div class="fg">
                <label>货币</label>
                <el-select v-model="doc.currency" style="width:100%">
                  <el-option label="USD $" value="USD" />
                  <el-option label="EUR €" value="EUR" />
                  <el-option label="CNY ¥" value="CNY" />
                  <el-option label="GBP £" value="GBP" />
                </el-select>
              </div>
            </div>
          </section>

          <!-- Buyer -->
          <section class="ed-sec">
            <div class="sec-title">
              👤 买方信息 (Buyer)
              <span class="sec-tip muted">自动带入客户资料，可修改</span>
            </div>
            <div class="form-grid-2">
              <div class="fg fg-full"><label>公司名</label><el-input v-model="doc.buyerInfo.companyName" /></div>
              <div class="fg fg-full"><label>地址</label><el-input v-model="doc.buyerInfo.address" /></div>
              <div class="fg"><label>联系人</label><el-input v-model="doc.buyerInfo.contactName" /></div>
              <div class="fg"><label>电话</label><el-input v-model="doc.buyerInfo.phone" /></div>
              <div class="fg"><label>邮箱</label><el-input v-model="doc.buyerInfo.email" /></div>
              <div class="fg"><label>国家</label><el-input v-model="doc.buyerInfo.country" /></div>
            </div>
          </section>

          <!-- Seller -->
          <section class="ed-sec">
            <div class="sec-title">
              🏢 卖方信息 (Seller)
              <a class="sec-tip link" @click="$router.push('/settings')">⚙️ 修改卖方信息</a>
            </div>
            <div class="seller-preview">
              <div class="sp-line"><b>{{ doc.sellerInfo.companyName || '_____' }}</b></div>
              <div class="sp-line muted">{{ doc.sellerInfo.address || '_____' }}</div>
              <div class="sp-line muted">
                Tel: {{ doc.sellerInfo.phone || '_____' }} · Email: {{ doc.sellerInfo.email || '_____' }}
              </div>
            </div>
            <el-collapse style="margin-top:8px">
              <el-collapse-item title="编辑卖方信息(本次单证)">
                <div class="form-grid-2">
                  <div class="fg fg-full"><label>公司名</label><el-input v-model="doc.sellerInfo.companyName" /></div>
                  <div class="fg fg-full"><label>地址</label><el-input v-model="doc.sellerInfo.address" /></div>
                  <div class="fg"><label>联系人</label><el-input v-model="doc.sellerInfo.contact" /></div>
                  <div class="fg"><label>电话</label><el-input v-model="doc.sellerInfo.phone" /></div>
                  <div class="fg"><label>邮箱</label><el-input v-model="doc.sellerInfo.email" /></div>
                  <div class="fg"><label>银行名</label><el-input v-model="doc.sellerInfo.bankName" /></div>
                  <div class="fg fg-full"><label>银行账号</label><el-input v-model="doc.sellerInfo.bankAccount" /></div>
                  <div class="fg"><label>SWIFT</label><el-input v-model="doc.sellerInfo.swiftCode" /></div>
                </div>
              </el-collapse-item>
            </el-collapse>
          </section>

          <!-- Trade terms -->
          <section class="ed-sec">
            <div class="sec-title">⚖️ 交易条款</div>
            <div class="form-grid-2">
              <div class="fg"><label>贸易术语</label>
                <el-select v-model="doc.tradeTerm" style="width:100%">
                  <el-option v-for="t in ['EXW','FOB','CIF','CFR','DAP','DDP']" :key="t" :label="t" :value="t" />
                </el-select>
              </div>
              <div class="fg"><label>付款方式</label><el-input v-model="doc.paymentTerm" /></div>
              <div class="fg"><label>装运港</label><el-input v-model="doc.portOfLoading" /></div>
              <div class="fg"><label>目的港</label><el-input v-model="doc.portOfDest" /></div>
              <div class="fg"><label>装运日期</label><el-input v-model="doc.shipDate" /></div>
            </div>
          </section>

          <!-- Products -->
          <section class="ed-sec">
            <div class="sec-title">📦 产品明细</div>
            <div class="items-table-wrap">
              <table class="items-table">
                <thead>
                  <tr>
                    <th style="width:36px">#</th>
                    <th>品名 Description</th>
                    <th style="width:100px">型号 Model</th>
                    <th style="width:100px">规格 Spec</th>
                    <th style="width:70px">数量 Qty</th>
                    <th style="width:70px">单位 Unit</th>
                    <th style="width:100px">单价 Price</th>
                    <th style="width:110px">金额 Amount</th>
                    <th style="width:40px"></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(it, idx) in doc.items" :key="idx">
                    <td class="idx-cell">{{ idx+1 }}</td>
                    <td><el-input v-model="it.productName" size="small" placeholder="产品名称" /></td>
                    <td><el-input v-model="it.model" size="small" /></td>
                    <td><el-input v-model="it.spec" size="small" /></td>
                    <td><el-input-number v-model="it.quantity" size="small" :min="0" :precision="2" controls-position="right" style="width:100%" @change="recalc" /></td>
                    <td><el-input v-model="it.unit" size="small" /></td>
                    <td><el-input-number v-model="it.unitPrice" size="small" :min="0" :precision="2" controls-position="right" style="width:100%" @change="recalc" /></td>
                    <td class="amount-cell">{{ doc.currency }} {{ fmt(it.amount) }}</td>
                    <td><button class="del-row" @click="removeItem(idx)">×</button></td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr>
                    <td colspan="7" class="total-label">合计 Total</td>
                    <td class="total-amount">{{ doc.currency }} {{ fmt(totalAmount) }}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <button class="add-item-btn" @click="addItem">+ 添加产品</button>
            <div class="amount-words">
              <span class="aw-label">金额大写：</span>
              <span class="aw-val">{{ amountInWords }}</span>
            </div>
          </section>

          <!-- Remarks -->
          <section class="ed-sec">
            <div class="sec-title">📝 备注/条款</div>
            <el-input v-model="doc.remarks" type="textarea" :rows="5" />
          </section>

          <!-- Bottom actions -->
          <div class="ed-bottom-actions">
            <button class="action-btn primary" @click="doSave" :disabled="saving">💾 保存</button>
            <button class="action-btn" @click="openPrint">👁️ 预览/打印</button>
            <button class="action-btn" @click="sendToast">📤 发送(占位)</button>
            <button class="action-btn ghost" @click="goBack">取消</button>
          </div>
        </div>
      </div>

      <!-- Right preview -->
      <div class="ed-right">
        <div class="preview-toolbar no-print">
          <span class="muted">A4 实时预览</span>
          <div class="spacer"></div>
          <button class="mini-btn" @click="setScale('fit')">适应</button>
          <button class="mini-btn" @click="setScale('100')">100%</button>
          <button class="mini-btn" @click="doPrint">🖨️ 打印</button>
        </div>
        <div class="preview-scroll" ref="previewScroll">
          <div class="a4-scaler" :style="{transform:`scale(${scale})`}">
            <div class="a4-page" ref="a4Page">
              <!-- A4 PI / QUOTATION TEMPLATE -->
              <div class="a4-header">
                <div class="a4-seller">
                  <div class="a4-logo">JZJ</div>
                  <div class="a4-seller-info">
                    <div class="a4-company">{{ sellerVal('companyName') }}</div>
                    <div>{{ sellerVal('address') }}</div>
                    <div>Tel: {{ sellerVal('phone') }} | Email: {{ sellerVal('email') }}</div>
                  </div>
                </div>
                <div class="a4-title-block">
                  <div class="a4-title">{{ doc.type === 'PI' ? 'PROFORMA INVOICE' : 'QUOTATION' }}</div>
                  <div class="a4-meta">
                    <div>No.: <b>{{ doc.docNumber }}</b></div>
                    <div>Date: {{ doc.issueDate }}</div>
                    <div v-if="doc.type==='QUOTATION'">Valid To: {{ doc.validUntil || '____' }}</div>
                  </div>
                </div>
              </div>

              <div class="a4-parties">
                <div class="a4-party">
                  <div class="party-label">Seller:</div>
                  <div><b>{{ sellerVal('companyName') }}</b></div>
                  <div>{{ sellerVal('address') }}</div>
                  <div>Tel: {{ sellerVal('phone') }} | Email: {{ sellerVal('email') }}</div>
                </div>
                <div class="a4-party">
                  <div class="party-label">Buyer:</div>
                  <div><b>{{ buyerVal('companyName') }}</b></div>
                  <div>{{ buyerVal('address') }}</div>
                  <div v-if="buyerVal('contactName')">Attn: {{ buyerVal('contactName') }}</div>
                  <div v-if="buyerVal('phone')">Tel: {{ buyerVal('phone') }}</div>
                  <div v-if="buyerVal('email')">Email: {{ buyerVal('email') }}</div>
                  <div v-if="buyerVal('country')">{{ buyerVal('country') }}</div>
                </div>
              </div>

              <div class="a4-terms">
                <div class="term-row">
                  <span><b>Trade Term:</b> {{ doc.tradeTerm || '____' }}</span>
                  <span><b>Payment:</b> {{ doc.paymentTerm || '____' }}</span>
                </div>
                <div class="term-row">
                  <span><b>Port of Loading:</b> {{ doc.portOfLoading || '____' }}</span>
                  <span><b>Port of Destination:</b> {{ doc.portOfDest || '____' }}</span>
                </div>
                <div class="term-row">
                  <span><b>Shipment Date:</b> {{ doc.shipDate || '____' }}</span>
                  <span><b>Currency:</b> {{ doc.currency }}</span>
                </div>
              </div>

              <table class="a4-items">
                <thead>
                  <tr>
                    <th style="width:32px">#</th>
                    <th>Description</th>
                    <th style="width:80px">Model</th>
                    <th style="width:80px">Spec</th>
                    <th style="width:50px">Qty</th>
                    <th style="width:50px">Unit</th>
                    <th style="width:70px">Unit Price</th>
                    <th style="width:80px">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(it,i) in doc.items" :key="i">
                    <td class="ac">{{ i+1 }}</td>
                    <td>{{ it.productName || '' }}</td>
                    <td>{{ it.model || '' }}</td>
                    <td>{{ it.spec || '' }}</td>
                    <td class="ac">{{ it.quantity }}</td>
                    <td class="ac">{{ it.unit || '' }}</td>
                    <td class="ar">{{ fmt(it.unitPrice) }}</td>
                    <td class="ar">{{ fmt(it.amount) }}</td>
                  </tr>
                  <tr v-if="!doc.items.length"><td colspan="8" class="ac" style="padding:20px;color:#888">No items</td></tr>
                </tbody>
                <tfoot>
                  <tr>
                    <td colspan="7" class="ar total-lab">Total</td>
                    <td class="ar total-amt">{{ doc.currency }} {{ fmt(totalAmount) }}</td>
                  </tr>
                </tfoot>
              </table>

              <div class="a4-words">{{ amountInWords }}</div>

              <div class="a4-remarks" v-if="doc.remarks">
                <div class="party-label">Terms &amp; Conditions:</div>
                <div class="rem-body">{{ doc.remarks }}</div>
              </div>

              <div class="a4-footer">
                <div class="a4-bank">
                  <div class="party-label">Bank Information:</div>
                  <div>Bank: {{ sellerVal('bankName') }}</div>
                  <div>A/C: {{ sellerVal('bankAccount') }}</div>
                  <div>SWIFT: {{ sellerVal('swiftCode') }}</div>
                </div>
                <div class="a4-sign">
                  <div>Authorized Signature</div>
                  <div class="sign-line"></div>
                  <div class="muted" style="font-size:9pt">{{ sellerVal('companyName') }}</div>
                </div>
              </div>

              <div v-if="doc.type==='QUOTATION'" class="a4-valid-note">
                * This quotation is valid for 30 days from the date of issue.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, nextTick, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import api from '../utils/api.js';

const router = useRouter();
const route = useRoute();
const customerId = route.params.id;
const docId = route.params.docId;
const isNew = !docId;

const loaded = ref(false);
const saving = ref(false);
const scale = ref(0.6);
const previewScroll = ref(null);

// Default remarks per type
const PI_REMARKS = "Please confirm this PI and arrange the deposit. Bank charges outside China are for buyer's account.";
const QT_REMARKS = "This quotation is valid for 30 days from the date of issue.";

const doc = reactive({
  id: null,
  type: (route.query.type || 'PI').toUpperCase(),
  docNumber: '',
  issueDate: new Date().toISOString().slice(0,10),
  validUntil: null,
  currency: 'USD',
  status: 'DRAFT',
  sellerInfo: {},
  buyerInfo: { companyName:'', address:'', contactName:'', phone:'', email:'', country:'' },
  tradeTerm: 'FOB',
  paymentTerm: 'T/T 30% deposit, 70% before shipment',
  portOfLoading: 'Shenzhen, China',
  portOfDest: '',
  shipDate: '',
  remarks: PI_REMARKS,
  items: [],
});

function blankItem() {
  return { productName:'', model:'', spec:'', quantity:1, unit:'pcs', unitPrice:0, amount:0 };
}

function fmt(n) {
  if (n==null || isNaN(n)) return '0.00';
  return Number(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
}

function numberToWordsJS(num, currency='USD') {
  const CURRENCY_MAP = {
    USD:{major:'US DOLLARS',minor:'CENTS'},
    EUR:{major:'EUROS',minor:'CENTS'},
    CNY:{major:'YUAN',minor:'FEN'},
    GBP:{major:'POUNDS STERLING',minor:'PENCE'},
  };
  const c = CURRENCY_MAP[currency] || CURRENCY_MAP.USD;
  if (isNaN(num)||num<0) return '';
  const n = Math.round(num*100)/100;
  const d = Math.floor(n), cents = Math.round((n-d)*100);
  const w = iToW(d);
  let s = 'SAY TOTAL ' + w + ' ' + c.major;
  if (cents>0) s += ' AND ' + iToW(cents) + ' ' + c.minor;
  return s + ' ONLY';
}
const ONES=['','ONE','TWO','THREE','FOUR','FIVE','SIX','SEVEN','EIGHT','NINE','TEN','ELEVEN','TWELVE','THIRTEEN','FOURTEEN','FIFTEEN','SIXTEEN','SEVENTEEN','EIGHTEEN','NINETEEN'];
const TENS=['','','TWENTY','THIRTY','FORTY','FIFTY','SIXTY','SEVENTY','EIGHTY','NINETY'];
const SCALES=['','THOUSAND','MILLION','BILLION'];
function b1000(n){
  let s=''; const h=Math.floor(n/100), r=n%100;
  if(h)s+=ONES[h]+' HUNDRED'+(r?' ':'');
  if(r<20)s+=ONES[r]; else{ const t=Math.floor(r/10),o=r%10; s+=TENS[t]+(o?'-'+ONES[o]:''); }
  return s.trim();
}
function iToW(n){
  if(n===0)return 'ZERO';
  let parts=[], i=0;
  while(n>0){ const c=n%1000; if(c>0) parts.unshift(b1000(c)+(SCALES[i]?' '+SCALES[i]:'')); n=Math.floor(n/1000); i++; }
  return parts.join(' ').replace(/\s+/g,' ').trim();
}

const totalAmount = computed(() => {
  let t = 0;
  for (const it of doc.items) {
    const q = Number(it.quantity)||0, p = Number(it.unitPrice)||0;
    it.amount = Math.round(q*p*100)/100;
    t += it.amount;
  }
  return Math.round(t*100)/100;
});
const amountInWords = computed(() => numberToWordsJS(totalAmount.value, doc.currency));

function sellerVal(k){
  const v = doc.sellerInfo?.[k];
  return (v===''||v==null||v===undefined) ? '_____' : v;
}
function buyerVal(k){
  const v = doc.buyerInfo?.[k];
  return (v===''||v==null||v===undefined) ? '' : v;
}
function recalc() { /* reactive via computed */ }
function addItem() { doc.items.push(blankItem()); fitScale(); }
function removeItem(i) { doc.items.splice(i,1); }

function onTypeChange() {
  if (doc.type === 'PI') {
    if (doc.remarks === QT_REMARKS || !doc.remarks) doc.remarks = PI_REMARKS;
    doc.validUntil = null;
  } else {
    if (doc.remarks === PI_REMARKS || !doc.remarks) doc.remarks = QT_REMARKS;
    const d = new Date(); d.setDate(d.getDate()+30);
    doc.validUntil = d.toISOString().slice(0,10);
  }
  // refresh docNumber on new doc
  if (isNew) refreshNumber();
}

async function refreshNumber() {
  try {
    const { data } = await api.get(`/documents/next-number?type=${doc.type}`);
    doc.docNumber = data.docNumber;
  } catch(e) {}
}

async function loadDoc() {
  try {
    const [seller, cust] = await Promise.all([
      api.get('/documents/seller-info'),
      api.get(`/customers/${customerId}`),
    ]);
    doc.sellerInfo = seller.data;
    const c = cust.data;
    doc.buyerInfo = {
      companyName: c.companyName || c.company || c.name || '',
      address: c.address || '',
      contactName: c.contactName || c.name || '',
      phone: c.phone || (c.jid ? c.jid.split('@')[0] : ''),
      email: c.email || '',
      country: c.country || '',
    };
    doc.customerJid = c.jid || null;

    if (isNew) {
      await refreshNumber();
      doc.items = [blankItem()];
      onTypeChange();
    } else {
      const { data } = await api.get(`/documents/${docId}`);
      Object.assign(doc, {
        id: data.id, type: data.type, docNumber: data.docNumber,
        issueDate: data.issueDate ? data.issueDate.slice(0,10) : '',
        validUntil: data.validUntil ? data.validUntil.slice(0,10) : null,
        currency: data.currency, status: data.status,
        sellerInfo: data.sellerInfo, buyerInfo: data.buyerInfo,
        tradeTerm: data.tradeTerm, paymentTerm: data.paymentTerm,
        portOfLoading: data.portOfLoading, portOfDest: data.portOfDest,
        shipDate: data.shipDate, remarks: data.remarks,
        items: (data.items||[]).map(it => ({
          productName:it.productName, model:it.model, spec:it.spec,
          quantity:it.quantity, unit:it.unit, unitPrice:it.unitPrice, amount:it.amount, remark:it.remark,
        })),
      });
    }
    loaded.value = true;
    nextTick(fitScale);
  } catch(e) {
    console.error(e);
    ElMessage.error('加载失败');
  }
}

function validate() {
  if (!doc.buyerInfo.companyName) { ElMessage.warning('请填写买方公司名'); return false; }
  if (!doc.items.length || doc.items.every(i => !i.productName)) { ElMessage.warning('请至少添加一个产品'); return false; }
  if (totalAmount.value <= 0) { ElMessage.warning('总金额必须大于0'); return false; }
  return true;
}

async function doSave() {
  if (!validate()) return;
  saving.value = true;
  try {
    const payload = {
      customerId: parseInt(customerId),
      customerJid: doc.customerJid,
      type: doc.type,
      docNumber: doc.docNumber,
      issueDate: doc.issueDate,
      validUntil: doc.validUntil,
      currency: doc.currency,
      status: doc.status,
      sellerInfo: doc.sellerInfo,
      buyerInfo: doc.buyerInfo,
      tradeTerm: doc.tradeTerm,
      paymentTerm: doc.paymentTerm,
      portOfLoading: doc.portOfLoading,
      portOfDest: doc.portOfDest,
      shipDate: doc.shipDate,
      remarks: doc.remarks,
      items: doc.items,
    };
    if (isNew) {
      const { data } = await api.post('/documents', payload);
      doc.id = data.id;
      ElMessage.success('已创建');
      router.replace(`/customers/${customerId}/documents/${data.id}/edit`);
    } else {
      await api.put(`/documents/${docId}`, payload);
      ElMessage.success('已保存');
    }
  } catch(e) {
    ElMessage.error(e?.response?.data?.error || '保存失败');
  } finally { saving.value = false; }
}

function openPrint() {
  if (!doc.id) {
    ElMessage.warning('请先保存单证再预览'); return;
  }
  window.open(`/documents/${doc.id}/print`, '_blank');
}
function doPrint() {
  // Print the a4-page directly
  const a4 = document.querySelector('.a4-page');
  if (!a4) return;
  window.print();
}
function sendToast() { ElMessage.info('发送功能即将开放'); }
function goBack() { router.push(`/customers/${customerId}`); }

function fitScale() {
  nextTick(() => {
    const el = previewScroll.value;
    if (!el) return;
    const w = el.clientWidth - 40;
    // a4 page ~794px wide (210mm at 96dpi)
    const s = Math.min(1, w / 820);
    scale.value = Math.max(0.3, s);
  });
}
function setScale(m) {
  if (m === 'fit') fitScale();
  else scale.value = Number(m)/100;
}

window.addEventListener('resize', fitScale);
onMounted(() => {
  loadDoc();
});

// Watch for any change to refit scale when first loaded
watch(loaded, v => { if (v) nextTick(fitScale); });
</script>

<style scoped>
.doc-editor-page { flex:1; display:flex; flex-direction:column; background:#111b21; color:#e9edef; height:100%; overflow:hidden; }
.ed-topbar { display:flex; align-items:center; gap:10px; padding:10px 20px; background:#202c33; border-bottom:1px solid #222d34; flex-shrink:0; flex-wrap:wrap; }
.back-btn { display:flex; align-items:center; gap:6px; background:transparent; border:1px solid #3b4a54; color:#e9edef; padding:8px 14px; border-radius:8px; cursor:pointer; }
.back-btn:hover { background:#2a3942; }
.ed-title { margin:0; font-size:16px; font-weight:600; }
.ed-docnum { color:#8696a0; font-weight:400; font-size:14px; }
.spacer { flex:1; }
.action-btn { padding:8px 16px; border-radius:8px; border:1px solid #3b4a54; background:#2a3942; color:#e9edef; cursor:pointer; font-size:13px; min-height:36px; }
.action-btn:hover { background:#3b4a54; }
.action-btn.primary { background:#00a884; border-color:#00a884; color:#fff; }
.action-btn.primary:hover { background:#06cf9c; }
.action-btn.primary:disabled { opacity:0.6; cursor:not-allowed; }
.action-btn.ghost { background:transparent; }

.ed-main { flex:1; display:flex; overflow:hidden; min-height:0; }
.ed-left { width:50%; border-right:1px solid #222d34; display:flex; flex-direction:column; min-width:360px; }
.ed-right { flex:1; display:flex; flex-direction:column; background:#0b141a; min-width:360px; }
.ed-scroll { flex:1; overflow-y:auto; padding:16px 20px 80px; }

.ed-sec { background:#202c33; border:1px solid #222d34; border-radius:10px; padding:16px; margin-bottom:14px; }
.sec-title { font-weight:600; font-size:14px; margin-bottom:12px; display:flex; align-items:center; gap:8px; }
.sec-tip { font-size:12px; font-weight:400; }
.link { color:#4FC3F7; cursor:pointer; }
.form-grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:10px 14px; }
.fg { display:flex; flex-direction:column; gap:4px; }
.fg label { color:#8696a0; font-size:12px; }
.fg-full { grid-column:1/-1; }
:deep(.el-input__wrapper), :deep(.el-textarea__inner) { background:#2a3942 !important; box-shadow:none !important; }
:deep(.el-input__inner), :deep(.el-textarea__inner), :deep(.el-select__placeholder) { color:#e9edef !important; }
:deep(.el-input-number .el-input__wrapper) { background:#2a3942; }

.type-cards { display:flex; gap:10px; }
.type-card { flex:1; background:#2a3942; border:2px solid transparent; border-radius:10px; padding:14px; cursor:pointer; text-align:center; transition:all .15s; }
.type-card:hover { background:#3b4a54; }
.type-card.active { border-color:#7c3aed; background:rgba(124,58,237,0.1); }
.tc-icon { font-size:28px; margin-bottom:6px; }
.tc-name { font-size:13px; font-weight:500; }

.seller-preview { background:#111b21; border-radius:8px; padding:12px; font-size:13px; line-height:1.8; }
.sp-line { color:#e9edef; }

.items-table-wrap { overflow-x:auto; }
.items-table { width:100%; border-collapse:collapse; font-size:12px; }
.items-table th { background:#111b21; color:#8696a0; font-weight:500; text-align:left; padding:8px 6px; border-bottom:1px solid #3b4a54; font-size:11px; }
.items-table td { padding:4px; border-bottom:1px solid #222d34; vertical-align:middle; }
.items-table :deep(.el-input__wrapper) { padding:0 8px; }
.idx-cell { text-align:center; color:#8696a0; }
.amount-cell { text-align:right; font-weight:600; color:#f59e0b; font-size:12px; white-space:nowrap; }
.del-row { width:24px; height:24px; border-radius:50%; border:none; background:#dc2626; color:#fff; cursor:pointer; font-size:16px; line-height:1; }
.total-label { text-align:right; font-weight:600; padding:8px !important; color:#e9edef; }
.total-amount { text-align:right; font-weight:700; color:#f59e0b; font-size:14px; padding:8px !important; }
.add-item-btn { margin-top:8px; background:transparent; border:1px dashed #3b4a54; color:#8696a0; padding:8px; width:100%; border-radius:8px; cursor:pointer; }
.add-item-btn:hover { background:#2a3942; color:#e9edef; }
.amount-words { margin-top:10px; padding:10px; background:#111b21; border-radius:8px; font-size:12px; }
.aw-label { color:#8696a0; }
.aw-val { color:#e9edef; font-weight:500; }

.ed-bottom-actions { display:flex; gap:8px; padding:12px 0; justify-content:flex-end; flex-wrap:wrap; }

/* Preview area */
.preview-toolbar { padding:8px 16px; display:flex; gap:8px; align-items:center; background:#202c33; border-bottom:1px solid #222d34; flex-shrink:0; }
.mini-btn { background:#2a3942; border:1px solid #3b4a54; color:#e9edef; padding:5px 12px; border-radius:6px; cursor:pointer; font-size:12px; }
.mini-btn:hover { background:#3b4a54; }
.preview-scroll { flex:1; overflow:auto; padding:20px; display:flex; justify-content:center; align-items:flex-start; }
.a4-scaler { transform-origin: top center; transition: transform .2s; }

/* A4 styles */
.a4-page {
  width: 794px; /* 210mm @96dpi ≈794px */
  min-height: 1123px; /* 297mm */
  padding: 48px 44px;
  background: white; color: #000;
  font-family: Arial, "Microsoft YaHei", sans-serif;
  font-size: 10.5pt; line-height: 1.5;
  box-shadow: 0 2px 12px rgba(0,0,0,0.3);
  margin: 0 auto;
}
.a4-header { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid #000; padding-bottom:14px; margin-bottom:18px; }
.a4-seller { display:flex; gap:14px; align-items:flex-start; }
.a4-logo { width:52px; height:52px; background:#00a884; color:#fff; border-radius:8px; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:16px; }
.a4-seller-info { font-size:10pt; line-height:1.5; }
.a4-company { font-size:13pt; font-weight:700; }
.a4-title-block { text-align:right; }
.a4-title { font-size:20pt; font-weight:800; letter-spacing:1px; }
.a4-meta { margin-top:8px; font-size:10pt; line-height:1.6; text-align:right; }
.a4-parties { display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-bottom:16px; }
.a4-party { font-size:10pt; line-height:1.6; }
.party-label { font-weight:700; margin-bottom:4px; font-size:9.5pt; text-transform:uppercase; color:#444; }
.a4-terms { border:1px solid #ccc; padding:10px 14px; border-radius:6px; margin-bottom:14px; font-size:9.5pt; display:flex; flex-direction:column; gap:4px; }
.term-row { display:flex; justify-content:space-between; gap:20px; }
.a4-items { width:100%; border-collapse:collapse; margin-bottom:10px; font-size:9.5pt; }
.a4-items th { border:1px solid #666; background:#f0f0f0; padding:5px 6px; font-weight:600; text-align:left; font-size:9pt; }
.a4-items td { border:1px solid #999; padding:5px 6px; vertical-align:top; }
.a4-items .ac { text-align:center; }
.a4-items .ar { text-align:right; }
.a4-items tfoot td { border:1px solid #666; font-weight:700; background:#f8f8f8; }
.total-lab { }
.total-amt { font-size:11pt; }
.a4-words { font-style:italic; margin:10px 0; font-size:10pt; font-weight:600; }
.a4-remarks { margin-bottom:18px; font-size:9.5pt; }
.rem-body { margin-top:4px; }
.a4-footer { display:grid; grid-template-columns:2fr 1fr; gap:20px; margin-top:20px; font-size:9.5pt; }
.a4-bank { line-height:1.6; }
.a4-sign { text-align:right; }
.sign-line { margin-top:50px; border-top:1px solid #333; padding-top:6px; font-size:9pt; }
.a4-valid-note { margin-top:14px; font-size:9pt; color:#666; font-style:italic; border-top:1px dashed #ccc; padding-top:8px; }

.muted { color:#8696a0; }

@media (max-width:900px) {
  .ed-main { flex-direction:column; overflow-y:auto; }
  .ed-left, .ed-right { width:100%; min-width:0; border:none; }
  .ed-right { min-height:600px; }
}

@media print {
  .no-print { display:none !important; }
  .doc-editor-page { display:block; background:white; }
  .ed-topbar, .ed-left, .preview-toolbar, .ed-bottom-actions { display:none !important; }
  .ed-main { display:block; }
  .ed-right { display:block; background:white; }
  .preview-scroll { padding:0; overflow:visible; display:block; }
  .a4-scaler { transform:none !important; }
  .a4-page { margin:0; box-shadow:none; width:auto; padding:15mm; min-height:auto; }
}
</style>
