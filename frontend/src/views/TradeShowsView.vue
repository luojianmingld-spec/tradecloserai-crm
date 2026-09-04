<template>
  <div class="trade-shows-page">
    <!-- 顶部标题 -->
    <div class="page-header">
      <h1 class="page-title">🌍 全球展会</h1>
      <p class="page-subtitle">全球近期展会概览 · 助您洞察行业动态、拓展商机</p>
    </div>

    <!-- 筛选区 -->
    <div class="filter-bar">
      <el-select
        v-model="filters.industry"
        placeholder="全部行业"
        clearable
        filterable
        class="filter-item filter-industry"
        @change="handleFilterChange"
      >
        <el-option v-for="ind in industryOptions" :key="ind" :label="ind" :value="ind" />
      </el-select>

      <el-select
        v-model="filters.country"
        placeholder="全部国家"
        clearable
        filterable
        class="filter-item filter-country"
        @change="handleFilterChange"
      >
        <el-option v-for="c in countryOptions" :key="c" :label="c" :value="c" />
      </el-select>

      <el-date-picker
        v-model="filters.month"
        type="month"
        placeholder="选择月份"
        value-format="YYYY-MM"
        clearable
        class="filter-item filter-month"
        @change="handleFilterChange"
      />

      <div class="search-input-wrap filter-item-grow">
        <el-input
          v-model="filters.keyword"
          placeholder="搜索展会名称 / 场馆 / 城市..."
          clearable
          @keyup.enter="handleSearch"
          @clear="handleSearch"
        >
          <template #prefix>🔍</template>
        </el-input>
      </div>
      <el-button type="primary" class="filter-search-btn" @click="handleSearch">搜索</el-button>
    </div>

    <!-- 结果统计 -->
    <div v-if="!loading && shows.length > 0" class="result-count">
      共 {{ total }} 场展会
      <span v-if="activeFilterCount > 0" class="result-count-sub">（已筛选 {{ activeFilterCount }} 项条件）</span>
    </div>

    <!-- 展会卡片网格 -->
    <div class="shows-grid" v-loading="loading">
      <el-empty
        v-if="!loading && shows.length === 0"
        :description="hasAnyFilter ? '没有符合筛选条件的展会' : '暂无近期展会数据'"
        style="grid-column: 1 / -1;"
      >
        <template #image>
          <div class="empty-emoji">🗓️</div>
        </template>
      </el-empty>

      <div
        v-for="show in shows"
        :key="show.id"
        class="show-card"
        @click="openDetail(show)"
      >
        <div class="card-header">
          <div class="show-icon-wrapper">
            <span class="show-emoji">🗓️</span>
          </div>
          <div class="show-meta">
            <div class="show-name-row">
              <span class="show-name">{{ show.nameZh || show.name }}</span>
              <span v-if="show.industry" class="status-badge badge-industry">{{ show.industry }}</span>
            </div>
            <span v-if="show.nameZh && show.nameZh !== show.name" class="show-name-en">{{ show.name }}</span>
            <span class="show-location">
              📍 {{ countryCity(show) }}
              <template v-if="show.venue"> · 🏢 {{ show.venue }}</template>
            </span>
          </div>
        </div>

        <!-- 摘要（截断，点击看详情） -->
        <p v-if="showSummary(show)" class="show-summary">{{ showSummary(show) }}</p>

        <div class="show-tags">
          <span class="tag">📅 {{ dateRange(show) }}</span>
          <span v-if="show.country" class="tag">{{ show.country }}</span>
          <span v-if="show.city" class="tag">{{ show.city }}</span>
          <span v-if="show.scale" class="tag">📈 {{ show.scale }}</span>
        </div>

        <div class="card-footer">
          <a
            v-if="show.website"
            :href="show.website"
            target="_blank"
            rel="noopener noreferrer"
            class="action-btn btn-link"
            @click.stop
          >🌐 官网</a>
          <span v-else class="action-btn btn-disabled">🌐 官网</span>
          <span class="source-tag" v-if="show.source">{{ show.source }}</span>
        </div>
      </div>
    </div>

    <!-- 分页 -->
    <div v-if="!loading && shows.length > 0 && total > pageSize" class="pagination-wrap">
      <el-pagination
        background
        layout="prev, pager, next"
        :total="total"
        :page-size="pageSize"
        :current-page="page"
        @current-change="handlePageChange"
      />
    </div>

    <!-- 详情弹窗 -->
    <el-dialog
      v-model="detailVisible"
      :title="detail?.nameZh || detail?.name || '展会详情'"
      width="520px"
      class="show-detail-dialog"
    >
      <div v-if="detail" class="detail-body">
        <div v-if="detail.nameZh && detail.nameZh !== detail.name" class="detail-en-name">{{ detail.name }}</div>

        <div class="detail-info-grid">
          <div class="detail-item" v-if="detail.industry">
            <span class="detail-label">行业</span>
            <span class="detail-value"><span class="status-badge badge-industry">{{ detail.industry }}</span></span>
          </div>
          <div class="detail-item" v-if="detail.startDate">
            <span class="detail-label">时间</span>
            <span class="detail-value">📅 {{ dateRange(detail) }}</span>
          </div>
          <div class="detail-item" v-if="detail.country || detail.city">
            <span class="detail-label">国家·城市</span>
            <span class="detail-value">📍 {{ countryCity(detail) }}</span>
          </div>
          <div class="detail-item" v-if="detail.region">
            <span class="detail-label">地区</span>
            <span class="detail-value">{{ detail.region }}</span>
          </div>
          <div class="detail-item" v-if="detail.venue">
            <span class="detail-label">场馆</span>
            <span class="detail-value">🏢 {{ detail.venue }}</span>
          </div>
          <div class="detail-item" v-if="detail.organizer">
            <span class="detail-label">主办方</span>
            <span class="detail-value">🏛️ {{ detail.organizer }}</span>
          </div>
          <div class="detail-item" v-if="detail.scale">
            <span class="detail-label">规模</span>
            <span class="detail-value">📈 {{ detail.scale }}</span>
          </div>
          <div class="detail-item" v-if="detail.source">
            <span class="detail-label">来源</span>
            <span class="detail-value"><span class="source-tag">{{ detail.source }}</span></span>
          </div>
        </div>

        <div v-if="detail.notes" class="detail-notes">
          <div class="detail-label">展会摘要</div>
          <div class="detail-notes-text">{{ detail.notes }}</div>
        </div>

        <div class="detail-links">
          <a
            v-if="detail.website"
            :href="detail.website"
            target="_blank"
            rel="noopener noreferrer"
            class="detail-link-btn"
          >🌐 访问官网</a>
          <a
            v-if="detail.sourceUrl"
            :href="detail.sourceUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="detail-link-btn secondary"
          >🔗 数据来源</a>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import api from '../utils/api.js'

const loading = ref(false)
const shows = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(12)

const industryOptions = ref([])
const countryOptions = ref([])

const filters = ref({
  industry: '',
  country: '',
  month: '',
  keyword: '',
})

const detailVisible = ref(false)
const detail = ref(null)

const hasAnyFilter = computed(() => {
  return !!(filters.value.industry || filters.value.country || filters.value.month || filters.value.keyword)
})
const activeFilterCount = computed(() => {
  let n = 0
  if (filters.value.industry) n++
  if (filters.value.country) n++
  if (filters.value.month) n++
  if (filters.value.keyword) n++
  return n
})

// 摘要：兼容 summary / notes / note 字段
function showSummary(show) {
  return (show && (show.summary || show.notes || show.note)) || ''
}

function formatDate(d) {
  if (!d) return ''
  const date = new Date(d)
  if (isNaN(date.getTime())) return String(d)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function dateRange(show) {
  if (!show.startDate) return ''
  const s = formatDate(show.startDate)
  const e = show.endDate ? formatDate(show.endDate) : ''
  return e && e !== s ? `${s} ~ ${e}` : s
}

function countryCity(show) {
  return [show.country, show.city].filter(Boolean).join(' · ') || '地点待定'
}

async function loadShows() {
  loading.value = true
  try {
    const params = { page: page.value, pageSize: pageSize.value }
    if (filters.value.industry) params.industry = filters.value.industry
    if (filters.value.country) params.country = filters.value.country
    if (filters.value.month) params.month = filters.value.month
    if (filters.value.keyword) params.keyword = filters.value.keyword
    const res = await api.get('/trade-shows', { params })
    if (res.data.success) {
      shows.value = res.data.data || []
      total.value = res.data.total || 0
    } else {
      throw new Error(res.data.error || '加载失败')
    }
  } catch (error) {
    console.error('loadShows error:', error)
    ElMessage.error('加载展会列表失败: ' + (error.response?.data?.error || error.message || ''))
  } finally {
    loading.value = false
  }
}

// 从数据中聚合 industry / country 去重（用于筛选下拉）
async function loadOptions() {
  try {
    const res = await api.get('/trade-shows', { params: { pageSize: 100 } })
    const items = (res.data.data || []).filter((x) => x.status === 'published')
    const indSet = new Set()
    const cntSet = new Set()
    items.forEach((x) => {
      if (x.industry) indSet.add(x.industry)
      if (x.country) cntSet.add(x.country)
    })
    industryOptions.value = [...indSet].sort()
    countryOptions.value = [...cntSet].sort()
  } catch (error) {
    console.warn('loadOptions error:', error)
  }
}

function handleFilterChange() {
  page.value = 1
  loadShows()
}

function handleSearch() {
  page.value = 1
  loadShows()
}

function handlePageChange(p) {
  page.value = p
  loadShows()
}

function openDetail(show) {
  detail.value = show
  detailVisible.value = true
}

onMounted(() => {
  loadShows()
  loadOptions()
})
</script>

<style scoped>
/* ── 页面：与技能商店(SkillStoreView)一致的视觉语言 ── */
.trade-shows-page {
  padding: 24px 28px 40px;
  width: 100%;
  box-sizing: border-box;
  background: var(--mgmt-bg);
  color: var(--text-primary);
  padding-bottom: 120px; /* 移动端底部留足 */
}

.page-header {
  margin-bottom: 20px;
}

.page-title {
  font-size: 26px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 6px;
}

.page-subtitle {
  font-size: 14px;
  color: var(--text-secondary);
  margin: 0;
}

/* ── 筛选区 ── */
.filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  background: var(--panel-bg);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 14px 16px;
  margin-bottom: 16px;
}

.filter-industry {
  width: 180px;
}

.filter-country {
  width: 150px;
}

.filter-month {
  width: 160px;
}

.search-input-wrap {
  flex: 1 1 180px;
  min-width: 160px;
}

.filter-bar :deep(.el-input__wrapper),
.filter-bar :deep(.el-select__wrapper) {
  background: var(--search-bg);
  box-shadow: 0 0 0 1px var(--border-color) inset;
}

.filter-bar :deep(.el-input__inner),
.filter-bar :deep(.el-select__placeholder) {
  color: var(--text-primary);
}

.result-count {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 0 0 12px 4px;
}

.result-count-sub {
  color: var(--text-muted);
  font-size: 12px;
}

/* ── 展会卡片网格（对齐技能商店卡片风格） ── */
.shows-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  min-height: 120px;
}

.show-card {
  background: var(--panel-bg);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  cursor: pointer;
  transition: border-color 0.2s, transform 0.2s;
}

.show-card:hover {
  border-color: #3b82f6;
  transform: translateY(-1px);
}

.card-header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 12px;
}

.show-icon-wrapper {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: var(--search-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.show-emoji {
  font-size: 22px;
}

.show-meta {
  flex: 1;
  min-width: 0;
}

.show-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.show-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  word-break: break-word;
}

.show-name-en {
  display: block;
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 2px;
}

.show-location {
  display: block;
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 3px;
  word-break: break-word;
}

.status-badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 500;
  white-space: nowrap;
}

.badge-industry {
  background: rgba(83, 189, 235, 0.15);
  color: var(--accent-info, #53bdeb);
}

/* 摘要：截断显示，点击卡片可看详情 */
.show-summary {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
  margin-bottom: 12px;
  flex: 1;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
}

.show-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 14px;
}

.tag {
  font-size: 11px;
  padding: 3px 10px;
  border-radius: 12px;
  background: var(--search-bg);
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid var(--border-color);
}

.action-btn {
  display: inline-flex;
  align-items: center;
  font-size: 12px;
  padding: 5px 14px;
  border-radius: 6px;
  color: #fff;
  background: var(--accent);
  text-decoration: none;
  transition: background 0.2s;
}

.action-btn.btn-link:hover {
  background: var(--accent-hover);
}

.action-btn.btn-disabled {
  background: var(--search-bg);
  color: var(--text-muted);
  cursor: default;
}

.source-tag {
  font-size: 11px;
  color: var(--text-muted);
  padding: 2px 8px;
  border-radius: 10px;
  background: var(--search-bg);
}

/* ── 分页 ── */
.pagination-wrap {
  display: flex;
  justify-content: center;
  margin-top: 20px;
}

/* ── 详情弹窗 ── */
.empty-emoji {
  font-size: 56px;
  line-height: 1;
}

.detail-en-name {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 12px;
}

.detail-info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px 16px;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.detail-label {
  font-size: 12px;
  color: var(--text-muted);
}

.detail-value {
  font-size: 13px;
  color: var(--text-primary);
  word-break: break-word;
}

.detail-notes {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid var(--border-color);
}

.detail-notes-text {
  margin-top: 6px;
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
}

.detail-links {
  display: flex;
  gap: 10px;
  margin-top: 16px;
  flex-wrap: wrap;
}

.detail-link-btn {
  display: inline-flex;
  align-items: center;
  font-size: 13px;
  padding: 7px 16px;
  border-radius: 6px;
  color: #fff;
  background: var(--accent);
  text-decoration: none;
}

.detail-link-btn:hover {
  background: var(--accent-hover);
}

.detail-link-btn.secondary {
  background: var(--search-bg);
  color: var(--text-primary);
}

/* ── 响应式 ── */
@media (max-width: 1100px) {
  .shows-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 700px) {
  .trade-shows-page {
    padding: 12px;
    padding-bottom: 140px;
  }

  .shows-grid {
    grid-template-columns: 1fr;
  }

  .filter-industry,
  .filter-country,
  .filter-month {
    width: calc(50% - 5px);
  }

  .detail-info-grid {
    grid-template-columns: 1fr;
  }
}
</style>
