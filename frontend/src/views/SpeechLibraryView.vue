<template>
  <div class="speech-library-page">
    <!-- 顶部搜索栏 -->
    <div class="search-bar">
      <div class="search-row">
        <div class="search-input-wrap">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style="color:var(--mgmt-text-muted);flex-shrink:0">
            <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
          </svg>
          <input
            class="search-input"
            v-model="searchQuery"
            placeholder="搜索话术内容..."
            @keyup.enter="loadData"
          />
          <button v-if="searchQuery" class="search-clear" @click="searchQuery=''; loadData()">✕</button>
        </div>
        <el-select v-model="scenarioFilter" placeholder="场景筛选" clearable @change="loadData" style="width:140px;flex-shrink:0">
          <el-option label="全部场景" value="" />
          <el-option v-for="s in scenarioOptions" :key="s" :label="s" :value="s" />
        </el-select>
        <el-button type="primary" @click="showCreateDialog" style="flex-shrink:0">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" style="margin-right:4px">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
          </svg>
          新建话术
        </el-button>
      </div>
    </div>

    <!-- 话术卡片列表 -->
    <div class="card-list" v-loading="loading">
      <div v-if="!loading && items.length === 0" class="empty-state">
        <svg viewBox="0 0 24 24" width="48" height="48" fill="currentColor" style="color:var(--mgmt-text-muted)">
          <path d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
        </svg>
        <p>暂无话术，点击「新建话术」添加</p>
      </div>

      <div v-for="item in items" :key="item.id" class="speech-card" @click="openEditDialog(item)">
        <div class="card-top">
          <div class="customer-msg">
            <span class="msg-label">客户消息</span>
            <span class="msg-text">{{ item.customerMsg }}</span>
          </div>
        </div>
        <div class="card-mid">
          <div class="sales-reply">
            <span class="msg-label">销售回复</span>
            <span class="msg-text reply-text">{{ item.salesReply }}</span>
          </div>
        </div>
        <div class="card-bottom">
          <div class="meta-left">
            <span v-if="item.scenario" class="tag scenario-tag">{{ item.scenario }}</span>
            <span v-for="t in parseTags(item.tags)" :key="t" class="tag normal-tag">{{ t }}</span>
          </div>
          <div class="meta-right">
            <span v-if="item.effectivenessScore != null" class="score-badge">⭐ {{ item.effectivenessScore }}</span>
            <span class="time-text">{{ formatTime(item.createdAt) }}</span>
          </div>
        </div>
        <div class="card-actions" @click.stop>
          <button class="act-btn act-edit" @click="openEditDialog(item)">编辑</button>
          <button class="act-btn act-delete" @click="handleDelete(item)">删除</button>
        </div>
      </div>
    </div>

    <!-- 分页 -->
    <div v-if="total > pageSize" class="pagination-wrap">
      <el-pagination
        v-model:current-page="page"
        :page-size="pageSize"
        :total="total"
        layout="prev, pager, next"
        @current-change="loadData"
      />
    </div>

    <!-- 新建/编辑对话框 -->
    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑话术' : '新建话术'" width="560px" :close-on-click-modal="false">
      <el-form :model="formData" label-width="80px">
        <el-form-item label="客户消息" required>
          <el-input v-model="formData.customerMsg" type="textarea" :rows="3" placeholder="输入客户的典型问题或消息" />
        </el-form-item>
        <el-form-item label="销售回复" required>
          <el-input v-model="formData.salesReply" type="textarea" :rows="3" placeholder="输入推荐的销售回复话术" />
        </el-form-item>
        <el-form-item label="场景">
          <el-input v-model="formData.scenario" placeholder="如：价格咨询、交期询问、产品对比" />
        </el-form-item>
        <el-form-item label="标签">
          <el-input v-model="formData.tags" placeholder="多个标签用逗号分隔" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSave" :loading="saving">保存</el-button>
      </template>
    </el-dialog>

    <!-- 智能匹配区域 -->
    <div class="match-section">
      <div class="match-title">💡 智能话术匹配</div>
      <div class="match-input-row">
        <input class="match-input" v-model="matchQuery" placeholder="输入客户消息，匹配推荐话术..." @keyup.enter="doMatch" />
        <el-button type="primary" @click="doMatch" :loading="matching">匹配</el-button>
      </div>
      <div v-if="matchResults.length" class="match-results">
        <div v-for="(r, idx) in matchResults" :key="idx" class="match-item">
          <div class="match-score">匹配度: {{ (r.score * 100).toFixed(0) }}%</div>
          <div class="match-customer">客户: {{ r.customerMsg }}</div>
          <div class="match-reply">推荐回复: {{ r.salesReply }}</div>
          <span v-if="r.scenario" class="tag scenario-tag" style="margin-top:6px">{{ r.scenario }}</span>
        </div>
      </div>
      <div v-else-if="matchQuery && !matching" class="match-empty">输入客户消息后点击「匹配」查看推荐话术</div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import api from '../utils/api.js';

// 列表数据
const items = ref([]);
const loading = ref(false);
const page = ref(1);
const pageSize = ref(20);
const total = ref(0);
const searchQuery = ref('');
const scenarioFilter = ref('');
const scenarioOptions = computed(() => {
  const set = new Set(items.value.map(i => i.scenario).filter(Boolean));
  return [...set];
});

// 对话框
const dialogVisible = ref(false);
const isEdit = ref(false);
const editId = ref(null);
const saving = ref(false);
const formData = ref({ customerMsg: '', salesReply: '', scenario: '', tags: '' });

// 智能匹配
const matchQuery = ref('');
const matchResults = ref([]);
const matching = ref(false);

// 加载话术列表
async function loadData() {
  loading.value = true;
  try {
    const params = { page: page.value, pageSize: pageSize.value };
    if (searchQuery.value) params.search = searchQuery.value;
    if (scenarioFilter.value) params.scenario = scenarioFilter.value;
    const { data } = await api.get('/speech-library', { params });
    items.value = data.items || [];
    total.value = data.total || 0;
  } catch (e) {
    console.error('加载话术失败', e);
    ElMessage.error('加载话术失败');
  } finally {
    loading.value = false;
  }
}

// 打开新建对话框
function showCreateDialog() {
  isEdit.value = false;
  editId.value = null;
  formData.value = { customerMsg: '', salesReply: '', scenario: '', tags: '' };
  dialogVisible.value = true;
}

// 打开编辑对话框
function openEditDialog(item) {
  isEdit.value = true;
  editId.value = item.id;
  formData.value = {
    customerMsg: item.customerMsg || '',
    salesReply: item.salesReply || '',
    scenario: item.scenario || '',
    tags: Array.isArray(item.tags) ? item.tags.join(',') : (item.tags || ''),
  };
  dialogVisible.value = true;
}

// 保存话术
async function handleSave() {
  if (!formData.value.customerMsg || !formData.value.salesReply) {
    ElMessage.warning('客户消息和销售回复为必填项');
    return;
  }
  saving.value = true;
  try {
    const body = { ...formData.value };
    if (isEdit.value) {
      await api.put(`/speech-library/${editId.value}`, body);
      ElMessage.success('更新成功');
    } else {
      await api.post('/speech-library', body);
      ElMessage.success('创建成功');
    }
    dialogVisible.value = false;
    loadData();
  } catch (e) {
    console.error('保存话术失败', e);
    ElMessage.error('保存失败');
  } finally {
    saving.value = false;
  }
}

// 删除话术
async function handleDelete(item) {
  try {
    await ElMessageBox.confirm('确定删除这条话术吗？', '确认删除', { type: 'warning' });
    await api.delete(`/speech-library/${item.id}`);
    ElMessage.success('删除成功');
    loadData();
  } catch (e) {
    if (e !== 'cancel') ElMessage.error('删除失败');
  }
}

// 智能匹配
async function doMatch() {
  if (!matchQuery.value.trim()) {
    ElMessage.warning('请输入客户消息');
    return;
  }
  matching.value = true;
  matchResults.value = [];
  try {
    const { data } = await api.post('/speech-library/match', { query: matchQuery.value });
    matchResults.value = data.results || data || [];
  } catch (e) {
    console.error('匹配失败', e);
    ElMessage.error('匹配失败');
  } finally {
    matching.value = false;
  }
}

// 辅助方法
function parseTags(tags) {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags;
  return tags.split(',').map(t => t.trim()).filter(Boolean);
}

function formatTime(t) {
  if (!t) return '';
  const d = new Date(t);
  if (isNaN(d)) return t;
  return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

onMounted(() => {
  loadData();
});
</script>

<style scoped>
.speech-library-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--mgmt-bg);
  color: var(--mgmt-text);
  overflow-y: auto;
  padding: 16px;
  box-sizing: border-box;
}

/* 搜索栏 */
.search-bar {
  background: var(--mgmt-card-bg);
  border-radius: 6px;
  padding: 12px 16px;
  margin-bottom: 16px;
  flex-shrink: 0;
}
.search-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.search-input-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  background: var(--mgmt-bg);
  border-radius: 6px;
  padding: 0 12px;
  border: 1px solid var(--mgmt-input-border);
  transition: border-color .2s;
  min-width: 0;
}
.search-input-wrap:focus-within { border-color: var(--accent); }
.search-input {
  flex: 1;
  background: transparent;
  border: none;
  color: var(--mgmt-text);
  padding: 9px 8px;
  font-size: 14px;
  outline: none;
  min-width: 0;
}
.search-input::placeholder { color: var(--mgmt-text-muted); }
.search-clear {
  background: transparent;
  border: none;
  color: var(--mgmt-text-muted);
  font-size: 14px;
  cursor: pointer;
  padding: 4px 8px;
}

/* 话术卡片 */
.card-list {
  flex: 1;
  min-height: 0;
}
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 16px;
  color: var(--mgmt-text-muted);
}
.empty-state p { margin-top: 12px; font-size: 14px; }

.speech-card {
  background: var(--mgmt-card-bg);
  border: 1px solid var(--mgmt-divider);
  border-radius: 12px;
  padding: 14px 16px;
  margin-bottom: 12px;
  cursor: pointer;
  transition: border-color .15s, box-shadow .15s;
}
.speech-card:hover {
  border-color: var(--accent);
  box-shadow: 0 2px 8px rgba(0,168,132,.08);
}

.card-top { margin-bottom: 10px; }
.card-mid { margin-bottom: 10px; }
.msg-label {
  display: block;
  font-size: 11px;
  color: var(--mgmt-text-muted);
  margin-bottom: 4px;
  text-transform: uppercase;
  letter-spacing: .5px;
}
.msg-text {
  font-size: 14px;
  color: var(--mgmt-text);
  line-height: 1.5;
  word-break: break-word;
}
.reply-text {
  color: var(--mgmt-tag-green);
}

.card-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}
.meta-left { display: flex; flex-wrap: wrap; gap: 6px; flex: 1; }
.meta-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }

.tag {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}
.scenario-tag {
  background: var(--mgmt-tag-blue-bg);
  color: var(--mgmt-tag-blue);
  border: 1px solid var(--mgmt-tag-blue-border);
}
.normal-tag {
  background: var(--mgmt-tag-gray-bg);
  color: var(--mgmt-tag-gray);
  border: 1px solid var(--mgmt-tag-gray-border);
}
.score-badge {
  font-size: 12px;
  color: var(--mgmt-tag-orange);
  font-weight: 600;
}
.time-text {
  font-size: 12px;
  color: var(--mgmt-text-muted);
}

.card-actions {
  display: flex;
  gap: 8px;
  padding-top: 10px;
  border-top: 1px solid var(--mgmt-divider);
}
.act-btn {
  padding: 4px 12px;
  border-radius: 4px;
  border: 1px solid var(--mgmt-input-border);
  background: transparent;
  color: var(--mgmt-text);
  font-size: 12px;
  cursor: pointer;
  transition: all .15s;
}
.act-btn:hover { border-color: var(--accent); color: var(--accent); }
.act-delete:hover { border-color: var(--mgmt-tag-red); color: var(--mgmt-tag-red); }

/* 分页 */
.pagination-wrap {
  display: flex;
  justify-content: center;
  padding: 12px 0;
  flex-shrink: 0;
}

/* 智能匹配区域 */
.match-section {
  background: var(--mgmt-card-bg);
  border: 1px solid var(--mgmt-divider);
  border-radius: 12px;
  padding: 16px;
  margin-top: 16px;
}
.match-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 12px;
  color: var(--mgmt-text);
}
.match-input-row {
  display: flex;
  gap: 10px;
  margin-bottom: 12px;
}
.match-input {
  flex: 1;
  background: var(--mgmt-bg);
  border: 1px solid var(--mgmt-input-border);
  border-radius: 6px;
  padding: 9px 12px;
  color: var(--mgmt-text);
  font-size: 14px;
  outline: none;
  transition: border-color .2s;
}
.match-input:focus { border-color: var(--accent); }
.match-input::placeholder { color: var(--mgmt-text-muted); }

.match-results { display: flex; flex-direction: column; gap: 10px; }
.match-item {
  background: var(--mgmt-bg);
  border: 1px solid var(--mgmt-divider);
  border-radius: 8px;
  padding: 12px;
}
.match-score {
  font-size: 12px;
  color: var(--mgmt-tag-green);
  font-weight: 600;
  margin-bottom: 6px;
}
.match-customer {
  font-size: 13px;
  color: var(--mgmt-text-muted);
  margin-bottom: 4px;
}
.match-reply {
  font-size: 14px;
  color: var(--mgmt-text);
  line-height: 1.5;
}
.match-empty {
  color: var(--mgmt-text-muted);
  font-size: 13px;
  text-align: center;
  padding: 16px 0;
}

/* Element Plus 对话框样式适配 */
:deep(.el-dialog) {
  background: var(--mgmt-card-bg);
  border-radius: 12px;
  max-width: 90vw;
}
:deep(.el-dialog__header) {
  background: var(--mgmt-card-bg);
  border-bottom: 1px solid var(--mgmt-divider);
  padding: 16px 20px;
}
:deep(.el-dialog__title) { color: var(--mgmt-text); font-size: 18px; font-weight: 600; }
:deep(.el-dialog__headerbtn .el-dialog__close) { color: var(--mgmt-text-muted); }
:deep(.el-dialog__body) { padding: 20px; background: var(--mgmt-card-bg); }
:deep(.el-dialog__footer) {
  background: var(--mgmt-card-bg);
  border-top: 1px solid var(--mgmt-divider);
  padding: 12px 20px;
}
:deep(.el-form-item__label) {
  font-weight: 600;
  font-size: 13px;
  color: var(--mgmt-text) !important;
}
:deep(.el-textarea__inner),
:deep(.el-input__inner) {
  background: var(--mgmt-bg) !important;
  color: var(--mgmt-text) !important;
  border-color: var(--mgmt-input-border) !important;
}
:deep(.el-select .el-input__inner) { color: var(--mgmt-text) !important; }

/* 响应式适配 */
@media (max-width: 768px) {
  .speech-library-page { padding: 8px; }
  .search-row { flex-wrap: wrap; }
  .search-input-wrap { width: 100%; flex: none; }
  .search-bar { padding: 10px 12px; }
  .speech-card { padding: 12px; }
  .card-bottom { flex-direction: column; align-items: flex-start; }
  .match-input-row { flex-direction: column; }
  .match-section { margin-top: 12px; }
}
</style>
