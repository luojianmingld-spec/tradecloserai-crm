<template>
  <div class="pipeline-view" :class="{ 'is-mobile': isMobile }">
    <!-- 顶部统计条 -->
    <div class="pipe-summary">
      <div class="pipe-summary-item">
        <span class="ps-num">{{ total }}</span>
        <span class="ps-lbl">客户总数</span>
      </div>
      <div class="pipe-summary-item">
        <span class="ps-num">${{ formatMoney(totalValue) }}</span>
        <span class="ps-lbl">预估总金额</span>
      </div>
      <div class="pipe-summary-item">
        <span class="ps-num win-rate">{{ winRate }}%</span>
        <span class="ps-lbl">赢单率</span>
      </div>
    </div>

    <!-- 手机端：Tab切换 + 单列卡片 -->
    <template v-if="isMobile">
      <div class="pipe-tabs-wrap">
        <div class="pipe-tabs">
          <div
            v-for="st in stages"
            :key="st.key"
            class="pipe-tab"
            :class="{ active: activeStage === st.key }"
            :style="activeStage === st.key ? { background: st.color, borderColor: st.color } : {}"
            @click="activeStage = st.key"
          >
            <span class="pt-icon">{{ st.icon }}</span>
            <span class="pt-label">{{ st.label }}</span>
            <span class="pt-count" :class="{ urgent: hasUrgent(st) }">{{ st.count }}</span>
          </div>
        </div>
      </div>

      <div class="pipe-list">
        <div v-if="!currentStage" class="pipe-empty">加载中...</div>
        <template v-else>
          <div v-if="currentStage.items.length === 0" class="pipe-empty-stage">
            <span class="pes-icon">{{ currentStage.icon }}</span>
            <span class="pes-text">「{{ currentStage.label }}」阶段暂无客户</span>
          </div>
          <div v-for="c in currentStage.items" :key="c.id" class="pipe-card" @click="openCustomer(c.id)">
            <div class="pc-avatar" :style="{ background: avatarColor(c.name) }">{{ (c.name || '?')[0] }}</div>
            <div class="pc-body">
              <div class="pc-row1">
                <span class="pc-name">{{ c.name || '未命名客户' }}</span>
                <span class="lv-badge" :class="'lv-' + (c.customerLevel || 'C')">{{ c.customerLevel || 'C' }}</span>
              </div>
              <div class="pc-row2" v-if="c.companyName || c.country">
                <span v-if="c.companyName" class="pc-company">{{ c.companyName }}</span>
                <span v-if="c.country" class="pc-country">· {{ c.country }}</span>
              </div>
              <div class="pc-row3">
                <span v-if="c.dealValue" class="pc-value">💰 ${{ formatMoney(c.dealValue) }}</span>
                <span v-if="c.lastContactAt" class="pc-time">🕐 {{ relTime(c.lastContactAt) }}</span>
                <span v-if="c._followUpCount" class="pc-fu">📝 {{ c._followUpCount }}</span>
              </div>
            </div>
            <button class="pc-stage-btn" @click.stop="openStageMenu(c)">推进 →</button>
          </div>
        </template>
      </div>
    </template>

    <!-- PC端：看板7列 -->
    <div v-else class="kanban-board">
      <div
        v-for="st in stages"
        :key="st.key"
        class="kanban-col"
        :style="{ borderTopColor: st.color }"
      >
        <div class="kc-header">
          <div class="kc-h-left">
            <span class="kc-dot" :style="{ background: st.color }"></span>
            <span class="kc-label">{{ st.icon }} {{ st.label }}</span>
          </div>
          <span class="kc-count" :class="{ urgent: hasUrgent(st) }">{{ st.count }}</span>
        </div>
        <div class="kc-cards">
          <div v-if="st.items.length === 0" class="kc-empty">—</div>
          <div
            v-for="c in st.items"
            :key="c.id"
            class="kc-card"
            @click="openCustomer(c.id)"
          >
            <div class="kcc-top">
              <div class="kcc-avatar" :style="{ background: avatarColor(c.name) }">{{ (c.name || '?')[0] }}</div>
              <div class="kcc-info">
                <div class="kcc-name">{{ c.name || '未命名客户' }}</div>
                <div class="kcc-sub" v-if="c.companyName || c.country">
                  <span v-if="c.country">{{ c.country }}</span>
                  <span v-if="c.companyName" class="kcc-company">{{ c.companyName }}</span>
                </div>
              </div>
              <span class="lv-badge" :class="'lv-' + (c.customerLevel || 'C')">{{ c.customerLevel || 'C' }}</span>
            </div>
            <div class="kcc-meta">
              <span v-if="c.dealValue" class="pc-value">💰${{ formatMoney(c.dealValue) }}</span>
              <span v-if="c.lastContactAt" class="pc-time">{{ relTime(c.lastContactAt) }}</span>
              <span v-if="c._followUpCount" class="pc-fu">📝{{ c._followUpCount }}</span>
            </div>
            <button class="kcc-move-btn" :style="{ color: st.color, borderColor: st.color }" @click.stop="openStageMenu(c)">推进 →</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 阶段推进弹窗 -->
    <div v-if="menuCustomer" class="pipe-modal-mask" @click="menuCustomer = null">
      <div class="pipe-modal" @click.stop>
        <div class="pm-handle"></div>
        <div class="pm-title">推进阶段</div>
        <div class="pm-cust">{{ menuCustomer.name }}</div>
        <div class="pm-stages">
          <div
            v-for="st in stages"
            :key="st.key"
            class="pm-stage-item"
            :class="{ active: targetStage === st.key, current: menuCustomer.dealStage === st.key }"
            :style="targetStage === st.key ? { borderColor: st.color, background: st.color + '18' } : {}"
            @click="moveToStage(st.key)"
          >
            <span class="pmsi-dot" :style="{ background: st.color }"></span>
            <span class="pmsi-icon">{{ st.icon }}</span>
            <span class="pmsi-label">{{ st.label }}</span>
            <span v-if="menuCustomer.dealStage === st.key" class="pmsi-cur" :style="{ color: st.color }">当前</span>
          </div>
        </div>
        <div class="pm-amount" v-if="nextStageForValue">
          <label>预估成交金额 (USD)</label>
          <input type="number" v-model="newDealValue" placeholder="0" min="0" step="100" />
        </div>
        <div class="pm-note">
          <label>备注（可选）</label>
          <textarea v-model="stageNote" placeholder="推进原因/客户反馈/下一步行动..." rows="2"></textarea>
        </div>
        <div class="pm-btns">
          <button class="pm-cancel" @click="menuCustomer = null">取消</button>
          <button class="pm-confirm" @click="confirmMove" :disabled="!canSubmitMove">确认推进</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import api from '../utils/api.js';
import { ElMessage } from 'element-plus';

const router = useRouter();
const stages = ref([]);
const total = ref(0);
const totalValue = ref(0);
const activeStage = ref('qualified');
const isMobile = ref(window.innerWidth <= 768);
const menuCustomer = ref(null);
const nextStageForValue = ref(false);
const newDealValue = ref(0);
const stageNote = ref('');
const targetStage = ref(null);

const currentStage = computed(() => stages.value.find(s => s.key === activeStage.value));

const winRate = computed(() => {
  const won = stages.value.find(s => s.key === 'won')?.count || 0;
  const comp = stages.value.find(s => s.key === 'completed')?.count || 0;
  const lost = stages.value.find(s => s.key === 'lost')?.count || 0;
  const denom = won + comp + lost;
  return denom ? Math.round((won + comp) / denom * 100) : 0;
});

const canSubmitMove = computed(() => targetStage.value && targetStage.value !== menuCustomer.value?.dealStage);

function hasUrgent(st) {
  const now = Date.now();
  return st.items.some(c => c.lastContactAt && (now - new Date(c.lastContactAt).getTime()) > 7*24*3600*1000);
}

function formatMoney(v) {
  if (!v) return '0';
  if (v >= 10000) return (v/1000).toFixed(1) + 'k';
  return Math.round(v).toLocaleString();
}

function avatarColor(name) {
  const colors = ['#06cf9c','#25d366','#128c7e','#34b7f1','#ff8c00','#e5422b','#8b5cf6','#ec4899'];
  let h = 0;
  for (let i = 0; i < (name||'?').length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return colors[h % colors.length];
}

function relTime(d) {
  const diff = Date.now() - new Date(d).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return '刚刚';
  if (h < 24) return h + '小时前';
  const day = Math.floor(h / 24);
  if (day < 30) return day + '天前';
  return Math.floor(day/30) + '月前';
}

async function loadPipeline() {
  try {
    const { data } = await api.get('/customers/pipeline');
    stages.value = data.stages;
    total.value = data.total;
    totalValue.value = data.totalValue;
    if (!currentStage.value || currentStage.value.count === 0) {
      const firstNonEmpty = stages.value.find(s => s.count > 0);
      if (firstNonEmpty) activeStage.value = firstNonEmpty.key;
    }
  } catch (e) {
    console.error('load pipeline error:', e);
  }
}

function openCustomer(id) {
  router.push('/customers/' + id);
}

function openStageMenu(c) {
  menuCustomer.value = c;
  targetStage.value = c.dealStage;
  newDealValue.value = c.dealValue || 0;
  stageNote.value = '';
  nextStageForValue.value = ['quoting','negotiating','won','completed'].includes(c.dealStage);
}

function moveToStage(key) {
  targetStage.value = key;
  nextStageForValue.value = ['quoting','negotiating','won','completed'].includes(key);
}

async function confirmMove() {
  if (!targetStage.value || targetStage.value === menuCustomer.value.dealStage) return;
  try {
    await api.patch(`/customers/${menuCustomer.value.id}/stage`, {
      stage: targetStage.value,
      note: stageNote.value.trim() || undefined,
      dealValue: nextStageForValue.value ? Number(newDealValue.value || 0) : undefined,
    });
    ElMessage.success('阶段已更新');
    menuCustomer.value = null;
    await loadPipeline();
  } catch (e) {
    ElMessage.error('更新失败：' + (e.response?.data?.error || e.message));
  }
}

function onResize() { isMobile.value = window.innerWidth <= 768; }

onMounted(() => {
  loadPipeline();
  window.addEventListener('resize', onResize);
});
onBeforeUnmount(() => window.removeEventListener('resize', onResize));
</script>

<style scoped>
.pipeline-view {
  padding: 12px;
  padding-bottom: 80px;
  background: var(--mgmt-bg);
  min-width: 0;
  position: relative;
}
/* PC端看板撑满 */
.pipeline-view:not(.is-mobile) {
  height: calc(100vh - 60px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding-bottom: 12px;
}

/* 顶部统计 */
.pipe-summary {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
  flex-shrink: 0;
}
.pipe-summary-item {
  flex: 1;
  background: var(--mgmt-card-bg);
  border: 1px solid var(--mgmt-divider);
  border-radius: 10px;
  padding: 10px 6px;
  text-align: center;
  min-width: 0;
}
.ps-num {
  display: block;
  font-size: 20px;
  font-weight: 700;
  color: var(--mgmt-text);
}
.ps-num.win-rate { color: #10b981; }
.ps-lbl {
  font-size: 11px;
  color: var(--mgmt-text-secondary);
  margin-top: 2px;
  display: block;
}

/* ========= 手机端 ========= */
.pipe-tabs-wrap {
  margin-bottom: 10px;
  margin-left: -12px;
  margin-right: -12px;
  padding: 0 12px 8px;
  overflow-x: auto;
  overflow-y: hidden;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}
.pipe-tabs-wrap::-webkit-scrollbar { display: none; height: 0; }
.pipe-tabs {
  display: inline-flex;
  gap: 6px;
  white-space: nowrap;
}
.pipe-tab {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 8px 14px;
  border-radius: 20px;
  background: var(--mgmt-card-alt);
  border: 1.5px solid var(--mgmt-divider);
  font-size: 13px;
  color: var(--mgmt-text-secondary);
  cursor: pointer;
  transition: all .2s;
  white-space: nowrap;
  -webkit-tap-highlight-color: transparent;
}
.pipe-tab.active {
  color: #fff;
}
.pt-count {
  background: rgba(0,0,0,.1);
  border-radius: 10px;
  padding: 0 7px;
  font-size: 11px;
  font-weight: 600;
  min-width: 20px;
  text-align: center;
}
.pipe-tab.active .pt-count { background: rgba(255,255,255,.25); }
.pt-count.urgent { background: #ef4444; color: #fff; animation: pulse 1.5s infinite; }
@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.6} }

.pipe-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.pipe-empty, .pipe-empty-stage {
  text-align: center;
  padding: 48px 20px;
  color: var(--mgmt-text-secondary);
  font-size: 14px;
}
.pes-icon { font-size: 36px; display: block; margin-bottom: 8px; opacity: .5; }

.pipe-card {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--mgmt-card-bg);
  border: 1px solid var(--mgmt-divider);
  border-radius: 10px;
  padding: 10px 12px;
  cursor: pointer;
  transition: all .15s;
  flex-shrink: 0;
}
.pipe-card:active { transform: scale(.98); }

.pc-avatar {
  width: 42px; height: 42px;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-weight: 600; font-size: 16px;
  flex-shrink: 0;
}
.pc-body { flex: 1; min-width: 0; }
.pc-row1 { display: flex; align-items: center; gap: 6px; }
.pc-name { font-size: 14px; font-weight: 600; color: var(--mgmt-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 120px; }
.pc-row2 { font-size: 12px; color: var(--mgmt-text-secondary); margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pc-row3 { display: flex; gap: 10px; font-size: 11px; color: var(--mgmt-text-muted); margin-top: 4px; flex-wrap: wrap; }
.pc-value { color: #f59e0b; font-weight: 600; }
.pc-time { color: var(--mgmt-text-muted); }
.pc-fu { color: var(--mgmt-text-muted); }

.pc-stage-btn {
  background: var(--mgmt-primary, #25d366);
  color: #fff; border: none; border-radius: 16px;
  padding: 6px 12px; font-size: 12px; font-weight: 600;
  cursor: pointer; white-space: nowrap; flex-shrink: 0;
}

.lv-badge {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 20px; height: 18px; border-radius: 4px;
  padding: 0 5px; font-size: 10px; font-weight: 700; color: #fff;
  flex-shrink: 0;
}
.lv-A { background: #ef4444; }
.lv-B { background: #f59e0b; }
.lv-C { background: #6b7280; }
.lv-D { background: #9ca3af; }

/* ========= PC端：看板布局 ========= */
.kanban-board {
  flex: 1;
  display: flex;
  gap: 10px;
  overflow-x: auto;
  overflow-y: auto;
  padding-bottom: 8px;
  min-height: 0;
  min-width: 0;
  -webkit-overflow-scrolling: touch;
}
.kanban-board::-webkit-scrollbar { height: 8px; }
.kanban-board::-webkit-scrollbar-thumb { background: var(--mgmt-divider); border-radius: 4px; }
.kanban-col {
  background: var(--mgmt-card-alt);
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  min-width: 220px;
  width: 220px;
  flex-shrink: 0;
  min-height: 100%;
  border-top: 3px solid #6b7280;
}
.kc-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  flex-shrink: 0;
  border-bottom: 1px solid var(--mgmt-divider);
}
.kc-h-left {
  display: flex; align-items: center; gap: 6px;
  font-size: 13px; font-weight: 600; color: var(--mgmt-text);
  overflow: hidden;
}
.kc-dot {
  width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
}
.kc-label { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.kc-count {
  background: var(--mgmt-divider);
  border-radius: 10px;
  padding: 1px 8px;
  font-size: 12px;
  font-weight: 700;
  color: var(--mgmt-text-secondary);
  flex-shrink: 0;
}
.kc-count.urgent { background: #ef4444; color: #fff; animation: pulse 1.5s infinite; }

.kc-cards {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 7px;
  min-height: 100px;
}
.kc-empty {
  text-align: center;
  padding: 24px 0;
  color: var(--mgmt-text-muted);
  font-size: 13px;
  opacity: .4;
}

.kc-card {
  background: var(--mgmt-card-bg);
  border: 1px solid var(--mgmt-divider);
  border-radius: 8px;
  padding: 10px;
  cursor: pointer;
  transition: box-shadow .15s, transform .1s;
  flex-shrink: 0;
}
.kc-card:hover {
  box-shadow: 0 2px 8px rgba(0,0,0,.08);
}
.kcc-top {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 6px;
}
.kcc-avatar {
  width: 32px; height: 32px;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-weight: 600; font-size: 13px;
  flex-shrink: 0;
}
.kcc-info { flex: 1; min-width: 0; }
.kcc-name {
  font-size: 13px; font-weight: 600; color: var(--mgmt-text);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.kcc-sub {
  font-size: 11px; color: var(--mgmt-text-secondary);
  margin-top: 1px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.kcc-company { margin-left: 4px; }
.kcc-meta {
  display: flex; gap: 8px;
  font-size: 10.5px;
  color: var(--mgmt-text-muted);
  margin-bottom: 8px;
  flex-wrap: wrap;
}
.kcc-meta .pc-value { color: #f59e0b; font-weight: 600; font-size: 11px; }
.kcc-move-btn {
  width: 100%;
  background: transparent;
  border: 1px solid #6b7280;
  border-radius: 6px;
  padding: 5px 0;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all .15s;
}
.kcc-move-btn:hover {
  background: #6b7280;
  color: #fff;
}

/* ========= 弹窗 - 修复兼容性问题 ========= */
.pipe-modal-mask {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  background: rgba(0,0,0,.6);
  z-index: 9999;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  -webkit-tap-highlight-color: transparent;
}
.pipe-modal {
  background: var(--mgmt-card-bg, #1a1f2e);
  width: 100%;
  max-width: 480px;
  border-radius: 16px 16px 0 0;
  padding: 8px 16px 28px;
  max-height: 85vh;
  overflow-y: auto;
  box-shadow: 0 -4px 20px rgba(0,0,0,.3);
  position: relative;
}
@media (min-width: 769px) {
  .pipe-modal-mask { align-items: center; }
  .pipe-modal { border-radius: 16px; padding: 24px 20px 24px; }
}
.pm-handle {
  width: 36px;
  height: 4px;
  background: var(--mgmt-divider);
  border-radius: 2px;
  margin: 0 auto 12px;
}
@media (min-width: 769px) { .pm-handle { display: none; } }
.pm-title { font-size: 17px; font-weight: 700; color: var(--mgmt-text); margin-bottom: 4px; }
.pm-cust { font-size: 13px; color: var(--mgmt-text-secondary); margin-bottom: 16px; }
.pm-stages {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}
.pm-stage-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border: 1.5px solid var(--mgmt-divider);
  border-radius: 10px;
  font-size: 14px;
  color: var(--mgmt-text);
  cursor: pointer;
  position: relative;
  transition: all .15s;
  background: var(--mgmt-card-bg, #1a1f2e);
  -webkit-tap-highlight-color: transparent;
}
.pm-stage-item:active { opacity: .7; }
.pm-stage-item.current {
  border-style: dashed;
}
.pmsi-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}
.pmsi-icon { font-size: 16px; }
.pmsi-label { flex: 1; font-weight: 500; }
.pmsi-cur {
  font-size: 11px;
  font-weight: 600;
  flex-shrink: 0;
}
.pm-amount, .pm-note { margin-bottom: 14px; }
.pm-amount label, .pm-note label {
  display: block; font-size: 12px;
  color: var(--mgmt-text-secondary); margin-bottom: 6px;
}
.pm-amount input, .pm-note textarea {
  width: 100%; box-sizing: border-box;
  padding: 10px 12px;
  border: 1px solid var(--mgmt-divider);
  border-radius: 8px; font-size: 14px;
  background: var(--bg-input, #2a3040);
  color: var(--mgmt-text);
  outline: none; font-family: inherit;
}
.pm-amount input:focus, .pm-note textarea:focus {
  border-color: var(--mgmt-primary, #25d366);
}
.pm-btns { display: flex; gap: 10px; margin-top: 18px; }
.pm-cancel, .pm-confirm {
  flex: 1; padding: 13px; border-radius: 10px;
  border: none; font-size: 15px; font-weight: 600; cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.pm-cancel { background: var(--mgmt-divider, #2a3040); color: var(--mgmt-text); }
.pm-confirm { background: var(--mgmt-primary, #25d366); color: #fff; }
.pm-confirm:disabled { opacity: .4; cursor: not-allowed; }
</style>
