<template>
  <div class="print-page">
    <div class="print-toolbar no-print">
      <button class="p-btn" @click="$router.back()">← 返回</button>
      <div class="spacer"></div>
      <button class="p-btn primary" @click="doPrint">🖨️ 打印 / 另存PDF</button>
    </div>
    <div class="print-area">
      <div class="a4-page" v-if="doc">
        <div class="a4-header">
          <div class="a4-seller">
            <div class="a4-logo">JZJ</div>
            <div class="a4-seller-info">
              <div class="a4-company">{{ sv('companyName') }}</div>
              <div>{{ sv('address') }}</div>
              <div>Tel: {{ sv('phone') }} | Email: {{ sv('email') }}</div>
            </div>
          </div>
          <div class="a4-title-block">
            <div class="a4-title">{{ doc.type === 'PI' ? 'PROFORMA INVOICE' : 'QUOTATION' }}</div>
            <div class="a4-meta">
              <div>No.: <b>{{ doc.docNumber }}</b></div>
              <div>Date: {{ fmtDate(doc.issueDate) }}</div>
              <div v-if="doc.type==='QUOTATION'">Valid To: {{ fmtDate(doc.validUntil) }}</div>
            </div>
          </div>
        </div>

        <div class="a4-parties">
          <div class="a4-party">
            <div class="party-label">Seller:</div>
            <div><b>{{ sv('companyName') }}</b></div>
            <div>{{ sv('address') }}</div>
            <div>Tel: {{ sv('phone') }} | Email: {{ sv('email') }}</div>
          </div>
          <div class="a4-party">
            <div class="party-label">Buyer:</div>
            <div><b>{{ bv('companyName') }}</b></div>
            <div>{{ bv('address') }}</div>
            <div v-if="bv('contactName')">Attn: {{ bv('contactName') }}</div>
            <div v-if="bv('phone')">Tel: {{ bv('phone') }}</div>
            <div v-if="bv('email')">Email: {{ bv('email') }}</div>
            <div v-if="bv('country')">{{ bv('country') }}</div>
          </div>
        </div>

        <div class="a4-terms">
          <div class="term-row"><span><b>Trade Term:</b> {{ doc.tradeTerm || '____' }}</span><span><b>Payment:</b> {{ doc.paymentTerm || '____' }}</span></div>
          <div class="term-row"><span><b>Port of Loading:</b> {{ doc.portOfLoading || '____' }}</span><span><b>Port of Destination:</b> {{ doc.portOfDest || '____' }}</span></div>
          <div class="term-row"><span><b>Shipment Date:</b> {{ doc.shipDate || '____' }}</span><span><b>Currency:</b> {{ doc.currency }}</span></div>
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
              <th style="width:80px">Unit Price</th>
              <th style="width:90px">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(it,i) in doc.items" :key="i">
              <td class="ac">{{ i+1 }}</td>
              <td>{{ it.productName }}</td>
              <td>{{ it.model }}</td>
              <td>{{ it.spec }}</td>
              <td class="ac">{{ it.quantity }}</td>
              <td class="ac">{{ it.unit }}</td>
              <td class="ar">{{ fmt(it.unitPrice) }}</td>
              <td class="ar">{{ fmt(it.amount) }}</td>
            </tr>
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
            <div>Bank: {{ sv('bankName') }}</div>
            <div>A/C: {{ sv('bankAccount') }}</div>
            <div>SWIFT: {{ sv('swiftCode') }}</div>
          </div>
          <div class="a4-sign">
            <div>Authorized Signature</div>
            <div class="sign-line"></div>
            <div style="font-size:9pt;color:#555">{{ sv('companyName') }}</div>
          </div>
        </div>
        <div v-if="doc.type==='QUOTATION'" class="a4-valid-note">
          * This quotation is valid for 30 days from the date of issue.
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import api from '../utils/api.js';

const route = useRoute();
const docId = route.params.id;
const doc = ref(null);

function sv(k){ const v=doc.value?.sellerInfo?.[k]; return (v===''||v==null||v===undefined)?'_____':v; }
function bv(k){ const v=doc.value?.buyerInfo?.[k]; return (v===''||v==null||v===undefined)?'':v; }
function fmt(n){ if(n==null||isNaN(n))return '0.00'; return Number(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function fmtDate(d){ if(!d) return '____'; try{ return String(d).slice(0,10); }catch{return d;} }
const totalAmount = computed(() => doc.value?.items?.reduce((s,i)=>s+((Number(i.quantity)||0)*(Number(i.unitPrice)||0)),0) || 0);

const ONES=['','ONE','TWO','THREE','FOUR','FIVE','SIX','SEVEN','EIGHT','NINE','TEN','ELEVEN','TWELVE','THIRTEEN','FOURTEEN','FIFTEEN','SIXTEEN','SEVENTEEN','EIGHTEEN','NINETEEN'];
const TENS=['','','TWENTY','THIRTY','FORTY','FIFTY','SIXTY','SEVENTY','EIGHTY','NINETY'];
const SCALES=['','THOUSAND','MILLION','BILLION'];
function b1000(n){let s='';const h=Math.floor(n/100),r=n%100;if(h)s+=ONES[h]+' HUNDRED'+(r?' ':'');if(r<20)s+=ONES[r];else{const t=Math.floor(r/10),o=r%10;s+=TENS[t]+(o?'-'+ONES[o]:'');}return s.trim();}
function iToW(n){if(n===0)return'ZERO';let p=[],i=0;while(n>0){const c=n%1000;if(c>0)p.unshift(b1000(c)+(SCALES[i]?' '+SCALES[i]:''));n=Math.floor(n/1000);i++;}return p.join(' ').replace(/\s+/g,' ').trim();}
function n2w(num,curr){const CM={USD:{m:'US DOLLARS',c:'CENTS'},EUR:{m:'EUROS',c:'CENTS'},CNY:{m:'YUAN',c:'FEN'},GBP:{m:'POUNDS STERLING',c:'PENCE'}};const c=CM[curr]||CM.USD;if(isNaN(num)||num<0)return'';const n=Math.round(num*100)/100,d=Math.floor(n),ce=Math.round((n-d)*100);let s='SAY TOTAL '+iToW(d)+' '+c.m;if(ce>0)s+=' AND '+iToW(ce)+' '+c.c;return s+' ONLY';}
const amountInWords = computed(() => n2w(totalAmount.value, doc.value?.currency||'USD'));

async function load() {
  try {
    const { data } = await api.get(`/documents/${docId}`);
    data.sellerInfo = typeof data.sellerInfo === 'string' ? JSON.parse(data.sellerInfo) : data.sellerInfo;
    data.buyerInfo = typeof data.buyerInfo === 'string' ? JSON.parse(data.buyerInfo) : data.buyerInfo;
    doc.value = data;
    setTimeout(() => window.print(), 500);
  } catch(e) { console.error(e); }
}
function doPrint() { window.print(); }
onMounted(load);
</script>

<style>
html, body { margin:0; padding:0; background:#e6e6e6; }
.print-page { min-height:100vh; }
.print-toolbar { position:sticky; top:0; background:var(--panel-header-bg); color:var(--text-primary); padding:10px 20px; display:flex; align-items:center; gap:10px; z-index:10; }
.p-btn { padding:8px 18px; border-radius:8px; border:1px solid var(--text-muted); background:var(--sidebar-active); color:var(--text-primary); cursor:pointer; }
.p-btn.primary { background:var(--accent); border-color:var(--accent); color:#fff; }
.p-btn:hover { filter:brightness(1.1); }
.spacer { flex:1; }
.print-area { padding:24px; display:flex; justify-content:center; }
.a4-page { width:210mm; min-height:297mm; padding:15mm; margin:0 auto; background:white; color:#000; font-family:Arial,"Microsoft YaHei",sans-serif; font-size:10.5pt; line-height:1.5; box-shadow:0 2px 12px rgba(0,0,0,.25); }
.a4-header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #000;padding-bottom:14px;margin-bottom:18px;}
.a4-seller{display:flex;gap:14px;align-items:flex-start;}
.a4-logo{width:52px;height:52px;background:var(--accent);color:#fff;border-radius:8px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:16px;}
.a4-seller-info{font-size:10pt;line-height:1.5;}
.a4-company{font-size:13pt;font-weight:700;}
.a4-title-block{text-align:right;}
.a4-title{font-size:22pt;font-weight:800;letter-spacing:1px;}
.a4-meta{margin-top:8px;font-size:10pt;line-height:1.7;text-align:right;}
.a4-parties{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:16px;}
.a4-party{font-size:10pt;line-height:1.6;}
.party-label{font-weight:700;margin-bottom:4px;font-size:9.5pt;text-transform:uppercase;color:#444;}
.a4-terms{border:1px solid #ccc;padding:10px 14px;border-radius:6px;margin-bottom:14px;font-size:9.5pt;display:flex;flex-direction:column;gap:4px;}
.term-row{display:flex;justify-content:space-between;gap:20px;}
.a4-items{width:100%;border-collapse:collapse;margin-bottom:10px;font-size:9.5pt;}
.a4-items th{border:1px solid #666;background:#f0f0f0;padding:5px 6px;font-weight:600;text-align:left;font-size:9pt;}
.a4-items td{border:1px solid #999;padding:5px 6px;vertical-align:top;}
.ac{text-align:center;}.ar{text-align:right;}
.a4-items tfoot td{border:1px solid #666;font-weight:700;background:#f8f8f8;}
.total-amt{font-size:11pt;}
.a4-words{font-style:italic;margin:10px 0;font-size:10pt;font-weight:600;}
.a4-remarks{margin-bottom:18px;font-size:9.5pt;}
.rem-body{margin-top:4px;white-space:pre-wrap;}
.a4-footer{display:grid;grid-template-columns:2fr 1fr;gap:20px;margin-top:30px;font-size:9.5pt;}
.a4-bank{line-height:1.7;}
.a4-sign{text-align:right;}
.sign-line{margin-top:60px;border-top:1px solid #333;padding-top:6px;font-size:9pt;}
.a4-valid-note{margin-top:14px;font-size:9pt;color:#666;font-style:italic;border-top:1px dashed #ccc;padding-top:8px;}

@page{size:A4;margin:12mm;}
@media print{
  .no-print{display:none !important;}
  body{background:white;}
  .print-area{padding:0;}
  .a4-page{margin:0;box-shadow:none;width:auto;min-height:auto;padding:0;}
}
</style>
