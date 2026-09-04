<template>
  <div class="admin-page">
    <div class="page-header">
      <h2>共享上下文冲突裁决</h2>
      <el-button type="primary" @click="loadConflicts" :loading="loading">刷新</el-button>
    </div>

    <el-alert type="info" :closable="false" show-icon style="margin-bottom:16px">
      <p>6 个外贸 Agent 共享同一套客户/订单事实库。当不同 Agent 写入同一事实的结论互相矛盾时，会进入待裁决列表，不会被静默覆盖。</p>
      <p style="margin-top:6px">裁决后选中结论将被 🔒 锁定（人工确认最高优先级，任何 Agent 无法覆盖）；失败方自动标记为已废弃。</p>
    </el-alert>

    <div class="section-card" v-if="conflicts.length === 0">
      <el-empty description="暂无待裁决的上下文冲突" />
    </div>

    <div v-for="c in conflicts" :key="c.id" class="conflict-card">
      <div class="conflict-header">
        <el-tag type="warning" size="small">冲突 #{{ c.id }}</el-tag>
        <span class="conflict-meta">
          {{ c.entryA?.entityType }} / {{ c.entryA?.entityId }} / {{ c.entryA?.key }}
        </span>
        <span class="conflict-time">待裁决 · 创建于 {{ formatTime(c.createdAt) }}</span>
      </div>

      <div class="conflict-bodies">
        <div class="conflict-side" :class="{'is-winner': c.resolution === 'pick_a' || c.resolution === 'merge'}">
          <div class="side-label">结论 A（{{ agentName(c.entryA?.sourceAgent) }}）</div>
          <div class="side-value">{{ c.entryA?.value }}</div>
          <div class="side-meta">
            置信度 {{ c.entryA?.confidence }}/5
            <template v-if="c.entryA?.sourceRef"> · 来源：{{ c.entryA.sourceRef }}</template>
          </div>
          <div class="side-actions" v-if="!c.resolution">
            <el-button type="primary" size="small" @click="resolve(c.id, 'pick_a')">选 A 并锁定</el-button>
          </div>
        </div>

        <div class="conflict-vs">VS</div>

        <div class="conflict-side" :class="{'is-winner': c.resolution === 'pick_b'}">
          <div class="side-label">结论 B（{{ agentName(c.entryB?.sourceAgent) }}）</div>
          <div class="side-value">{{ c.entryB?.value }}</div>
          <div class="side-meta">
            置信度 {{ c.entryB?.confidence }}/5
            <template v-if="c.entryB?.sourceRef"> · 来源：{{ c.entryB.sourceRef }}</template>
          </div>
          <div class="side-actions" v-if="!c.resolution">
            <el-button type="primary" size="small" @click="resolve(c.id, 'pick_b')">选 B 并锁定</el-button>
          </div>
        </div>
      </div>

      <div class="conflict-actions" v-if="!c.resolution">
        <el-button size="small" @click="resolve(c.id, 'merge')">合并（A + 附注B）</el-button>
        <el-button size="small" @click="resolve(c.id, 'both_keep')">双保留（都锁定）</el-button>
      </div>

      <div v-else class="conflict-resolved">
        <el-tag type="success" size="small">已裁决：{{ resolutionText(c.resolution) }}</el-tag>
        <span class="conflict-time">by {{ c.resolvedBy || 'human' }} · {{ formatTime(c.resolvedAt) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import api from '../../utils/api.js';

const loading = ref(false);
const conflicts = ref([]);

const AGENT_NAMES = {
  'sales-champion': '外贸销冠',
  'background-report': '客户背调',
  'customs-agent': '外贸单证',
  'doc-agent': '工厂对接',
  'freight-agent': '货代对接',
  'legal-agent': '外贸法务',
  'general': '主助理',
  'human': '人工'
};

function agentName(t) { return AGENT_NAMES[t] || t || '未知'; }

function formatTime(t) {
  if (!t) return '-';
  return new Date(t).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
}

function resolutionText(r) {
  return { pick_a: '选择A并锁定', pick_b: '选择B并锁定', merge: '合并', both_keep: '双保留' }[r] || r;
}

async function loadConflicts() {
  loading.value = true;
  try {
    const res = await api.get('/context/conflicts');
    const d = res.data?.conflicts || res.data || [];
    conflicts.value = Array.isArray(d) ? d : [];
  } catch (e) {
    console.warn('loadConflicts error:', e);
    ElMessage.error('加载冲突列表失败');
  } finally {
    loading.value = false;
  }
}

async function resolve(id, resolution) {
  const labels = { pick_a: '选A并锁定', pick_b: '选B并锁定', merge: '合并（A+附注B）', both_keep: '双保留（都锁定）' };
  try {
    await ElMessageBox.confirm(
      `确认执行「${labels[resolution]}」？\n选中的结论将被锁定，任何 Agent 后续都无法覆盖。`,
      '冲突裁决确认',
      { confirmButtonText: '确认裁决', cancelButtonText: '取消', type: 'warning' }
    );
  } catch (e) { return; }
  try {
    const res = await api.post(`/context/conflicts/${id}/resolve`, { resolution, resolvedBy: 'human' });
    if (res.data?.success || res.data?.message) {
      ElMessage.success('裁决完成，结论已锁定');
    } else if (res.data?.error) {
      ElMessage.error(res.data.message || '裁决失败');
    }
    await loadConflicts();
  } catch (e) {
    console.warn('resolve error:', e);
    ElMessage.error('裁决失败：' + (e.response?.data?.message || e.message));
  }
}

onMounted(loadConflicts);
</script>

<style scoped>
.admin-page { padding: 20px; }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.page-header h2 { margin: 0; font-size: 20px; }
.section-card { background: var(--bg-card, #fff); border-radius: 12px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
.conflict-card { background: var(--bg-card, #fff); border-radius: 12px; padding: 16px 20px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); border-left: 4px solid #e6a23c; }
.conflict-header { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; flex-wrap: wrap; }
.conflict-meta { font-weight: 600; color: #303133; }
.conflict-time { color: #909399; font-size: 12px; margin-left: auto; }
.conflict-bodies { display: flex; align-items: stretch; gap: 12px; }
.conflict-side { flex: 1; border: 1px solid #ebeef5; border-radius: 8px; padding: 12px; background: #fafafa; }
.conflict-side.is-winner { border-color: #67c23a; background: #f0f9eb; }
.side-label { font-size: 12px; color: #909399; margin-bottom: 6px; }
.side-value { font-size: 15px; font-weight: 600; color: #303133; margin-bottom: 6px; }
.side-meta { font-size: 12px; color: #909399; margin-bottom: 8px; }
.side-actions { margin-top: 4px; }
.conflict-vs { display: flex; align-items: center; font-weight: 700; color: #e6a23c; padding: 0 4px; }
.conflict-actions { margin-top: 12px; display: flex; gap: 8px; }
.conflict-resolved { margin-top: 12px; display: flex; align-items: center; gap: 10px; }
.dark-mode .conflict-card, .dark-mode .section-card { background: #232340; }
.dark-mode .conflict-side { background: #1a1a2e; border-color: #2a2a4a; }
.dark-mode .conflict-side.is-winner { background: #1f2d1f; border-color: #67c23a; }
.dark-mode .side-value, .dark-mode .conflict-meta { color: #e0e0e0; }
</style>
