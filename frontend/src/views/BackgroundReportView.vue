<template>
  <div class="bg-report-page">
    <div class="bg-report-header">
      <button class="back-btn" @click="$router.back()">← 返回</button>
      <h2>📊 360° 客户背调报告</h2>
      <span v-if="companyName" class="company-name">{{ companyName }}</span>
    </div>

    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>加载报告中...</p>
    </div>

    <div v-else-if="error" class="error-state">
      <p>⚠️ {{ error }}</p>
      <button @click="loadReport">重试</button>
    </div>

    <div v-else-if="report" class="report-content">
      <!-- 📋 报告正文（完整背调内容） -->
      <div v-if="reportBody" class="report-body-section">
        <h3>📋 背调报告正文</h3>
        <div class="report-body">{{ reportBody }}</div>
      </div>
      <div v-else class="report-body-empty">
        <p>⚠️ 该客户暂无背调报告内容，请返回客户沟通页点击「开始背调」重新生成。</p>
      </div>

      <!-- Score Card -->
      <div v-if="hasStructured" class="score-card" :class="'grade-' + rating">
        <div class="score-circle">
          <svg viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="42" fill="none" stroke="var(--border-color)" stroke-width="8"/>
            <circle cx="50" cy="50" r="42" fill="none" :stroke="scoreColor" stroke-width="8"
              :stroke-dasharray="`${scorePercent * 264} 264`"
              stroke-linecap="round" transform="rotate(-90 50 50)"/>
          </svg>
          <div class="score-value">{{ score }}</div>
          <div class="score-label">综合评分</div>
        </div>
        <div class="score-info">
          <div class="rating-badge" :class="'grade-' + rating">{{ rating }}级</div>
          <p class="exec-summary">{{ report.executiveSummary || '暂无总体评价' }}</p>
          <div class="risk-stats">
            <span class="risk-stat low">🟢 低风险 {{ riskCounts.low }}</span>
            <span class="risk-stat medium">🟡 中风险 {{ riskCounts.medium }}</span>
            <span class="risk-stat high">🔴 高风险 {{ riskCounts.high }}</span>
          </div>
        </div>
      </div>

      <!-- Chapters -->
      <div v-if="chapters.length" class="chapters-section">
        <h3>详细分析</h3>
        <div v-for="chapter in chapters" :key="chapter.id"
          class="chapter-card" :class="'status-' + chapter.status"
          @click="toggleChapter(chapter.id)">
          <div class="chapter-header">
            <div class="chapter-left">
              <span class="status-icon">{{ statusIcon(chapter.status) }}</span>
              <span class="chapter-title">{{ chapter.title }}</span>
            </div>
            <div class="chapter-right">
              <span class="risk-badge" :class="'risk-' + chapter.riskLevel">{{ riskLabel(chapter.riskLevel) }}</span>
              <span class="expand-arrow" :class="{ expanded: expandedChapters.has(chapter.id) }">▼</span>
            </div>
          </div>
          <transition name="slide">
            <div v-if="expandedChapters.has(chapter.id)" class="chapter-body">
              <p>{{ chapter.findings }}</p>
            </div>
          </transition>
        </div>
      </div>

      <!-- Recommendation -->
      <div v-if="report.recommendation" class="recommendation-section">
        <h3>💡 跟进建议</h3>
        <p>{{ report.recommendation }}</p>
      </div>

      <!-- Timestamp -->
      <div class="report-footer">
        <p>报告生成时间：{{ formatTime(report.updatedAt) }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import api from '../utils/api.js';

const route = useRoute();
const loading = ref(true);
const error = ref(null);
const report = ref(null);
const companyName = ref('');
const expandedChapters = ref(new Set());

const score = computed(() => report.value?.score ?? 0);
const rating = computed(() => {
  const s = score.value;
  return s >= 85 ? 'A' : s >= 70 ? 'B' : s >= 50 ? 'C' : 'D';
});
const scorePercent = computed(() => score.value / 100);
const scoreColor = computed(() => {
  const s = score.value;
  return s >= 85 ? '#00a884' : s >= 70 ? '#53bdeb' : s >= 50 ? '#f5a623' : '#e74c3c';
});
const chapters = computed(() => report.value?.chapters || []);
const hasStructured = computed(() => ((report.value?.score ?? 0) > 0) || ((report.value?.chapters?.length || 0) > 0));
const reportBody = computed(() => (report.value?.summary || '').trim());
const riskCounts = computed(() => {
  const counts = { low: 0, medium: 0, high: 0 };
  chapters.value.forEach(c => {
    if (counts[c.riskLevel] !== undefined) counts[c.riskLevel]++;
  });
  return counts;
});

function statusIcon(status) {
  return status === 'pass' ? '✅' : status === 'warning' ? '⚠️' : '❌';
}
function riskLabel(level) {
  return level === 'low' ? '低风险' : level === 'medium' ? '中风险' : '高风险';
}
function toggleChapter(id) {
  const s = new Set(expandedChapters.value);
  if (s.has(id)) s.delete(id); else s.add(id);
  expandedChapters.value = s;
}
function formatTime(iso) {
  if (!iso) return '未知';
  try { return new Date(iso).toLocaleString('zh-CN'); } catch { return iso; }
}

async function loadReport() {
  loading.value = true;
  error.value = null;
  try {
    const jid = route.query.jid;
    if (!jid) throw new Error('缺少客户标识');
    const { data } = await api.get(`/customers/by-jid/${encodeURIComponent(jid)}/bg-check`);
    if (!data.hasReport) {
      error.value = '该客户暂无背调报告';
    } else {
      report.value = data;
      companyName.value = data.companyName || '';
      // Auto-expand warning/fail chapters
      data.chapters?.forEach(c => {
        if (c.status === 'warning' || c.status === 'fail') {
          expandedChapters.value.add(c.id);
        }
      });
    }
  } catch (e) {
    error.value = e.message || '加载失败';
  } finally {
    loading.value = false;
  }
}

onMounted(loadReport);
</script>

<style scoped>
.bg-report-page {
  min-height: 100vh;
  background: var(--bg-primary, #0b141a);
  color: var(--text-primary, #e9edef);
  padding: 16px;
  max-width: 800px;
  margin: 0 auto;
}
.bg-report-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}
.back-btn {
  background: var(--bg-secondary, #1f2c33);
  border: none;
  color: var(--text-primary);
  padding: 8px 14px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
}
.back-btn:hover { background: var(--bg-hover, #2a3942); }
.bg-report-header h2 { margin: 0; font-size: 18px; }
.company-name {
  background: var(--bg-secondary);
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 13px;
  color: var(--accent, #00a884);
}

.loading-state, .error-state {
  text-align: center;
  padding: 60px 20px;
  color: var(--text-secondary);
}
.spinner {
  width: 40px; height: 40px;
  border: 3px solid var(--border-color);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 16px;
}
@keyframes spin { to { transform: rotate(360deg); } }

.report-body-section {
  background: var(--bg-secondary, #1f2c33);
  border: 1px solid var(--border-color, #2a3942);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 24px;
}
.report-body-section h3 { font-size: 16px; margin: 0 0 12px; }
.report-body {
  font-size: 14px;
  line-height: 1.8;
  color: var(--text-primary, #e9edef);
  white-space: pre-wrap;
  word-break: break-word;
}
.report-body-empty {
  background: var(--bg-secondary, #1f2c33);
  border: 1px solid var(--border-color, #2a3942);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 24px;
  font-size: 13px;
  color: var(--text-secondary, #8696a0);
}
.score-card {
  gap: 24px;
  align-items: center;
  background: var(--bg-secondary, #1f2c33);
  border-radius: 16px;
  padding: 24px;
  margin-bottom: 24px;
  border: 1px solid var(--border-color);
}
.score-circle {
  position: relative;
  width: 120px;
  height: 120px;
  flex-shrink: 0;
}
.score-circle svg { width: 100%; height: 100%; }
.score-value {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -60%);
  font-size: 32px;
  font-weight: 700;
}
.score-label {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, 40%);
  font-size: 12px;
  color: var(--text-secondary);
}
.score-info { flex: 1; }
.rating-badge {
  display: inline-block;
  padding: 4px 14px;
  border-radius: 20px;
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 10px;
}
.grade-A .rating-badge, .rating-badge.grade-A { background: rgba(0,168,132,0.2); color: #00a884; }
.grade-B .rating-badge, .rating-badge.grade-B { background: rgba(83,189,235,0.2); color: #53bdeb; }
.grade-C .rating-badge, .rating-badge.grade-C { background: rgba(245,166,35,0.2); color: #f5a623; }
.grade-D .rating-badge, .rating-badge.grade-D { background: rgba(231,76,60,0.2); color: #e74c3c; }
.exec-summary { font-size: 14px; line-height: 1.6; margin: 0 0 12px; color: var(--text-secondary); }
.risk-stats { display: flex; gap: 12px; flex-wrap: wrap; font-size: 13px; }
.risk-stat { padding: 2px 8px; border-radius: 10px; background: var(--bg-primary); }

.chapters-section { margin-bottom: 24px; }
.chapters-section h3 { font-size: 16px; margin: 0 0 12px; }
.chapter-card {
  background: var(--bg-secondary, #1f2c33);
  border-radius: 12px;
  margin-bottom: 8px;
  cursor: pointer;
  overflow: hidden;
  border-left: 4px solid var(--border-color);
  transition: all 0.2s;
}
.chapter-card:hover { background: var(--bg-hover, #2a3942); }
.chapter-card.status-pass { border-left-color: #00a884; }
.chapter-card.status-warning { border-left-color: #f5a623; }
.chapter-card.status-fail { border-left-color: #e74c3c; }
.chapter-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
}
.chapter-left { display: flex; align-items: center; gap: 10px; }
.status-icon { font-size: 18px; }
.chapter-title { font-size: 14px; font-weight: 500; }
.chapter-right { display: flex; align-items: center; gap: 10px; }
.risk-badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
}
.risk-low { background: rgba(0,168,132,0.15); color: #00a884; }
.risk-medium { background: rgba(245,166,35,0.15); color: #f5a623; }
.risk-high { background: rgba(231,76,60,0.15); color: #e74c3c; }
.expand-arrow {
  font-size: 10px;
  color: var(--text-secondary);
  transition: transform 0.2s;
}
.expand-arrow.expanded { transform: rotate(180deg); }
.chapter-body {
  padding: 0 16px 14px 44px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-secondary);
}
.slide-enter-active, .slide-leave-active { transition: all 0.2s ease; }
.slide-enter-from, .slide-leave-to { opacity: 0; max-height: 0; }
.slide-enter-to, .slide-leave-from { opacity: 1; max-height: 200px; }

.recommendation-section {
  background: var(--bg-secondary, #1f2c33);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 24px;
  border: 1px solid var(--accent, #00a884);
}
.recommendation-section h3 { font-size: 16px; margin: 0 0 10px; }
.recommendation-section p { font-size: 14px; line-height: 1.6; color: var(--text-secondary); margin: 0; }

.report-footer {
  text-align: center;
  font-size: 12px;
  color: var(--text-secondary);
  padding: 16px 0;
}

@media (max-width: 600px) {
  .score-card { flex-direction: column; text-align: center; }
  .risk-stats { justify-content: center; }
  .chapter-header { padding: 12px; }
  .chapter-body { padding-left: 36px; }
}
/* ===== 亮色主题适配 ===== */
[data-theme='light'] .page-container,
[data-theme='light'] .report-page,
[data-theme='light'] .legal-page,
[data-theme='light'] .customs-page,
[data-theme='light'] .freight-page {
  background: var(--mgmt-bg, #f5f7fa);
  color: var(--mgmt-text, #303133);
}
[data-theme='light'] .page-container *,
[data-theme='light'] .report-page *,
[data-theme='light'] .legal-page *,
[data-theme='light'] .customs-page *,
[data-theme='light'] .freight-page * {
  --text-color: var(--mgmt-text, #303133);
}
</style>
