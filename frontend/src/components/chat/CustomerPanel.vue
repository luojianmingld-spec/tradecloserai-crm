<template>
  <div class="customer-panel">
    <!-- Customer Header -->
    <div class="panel-section customer-header">
      <div class="customer-avatar-lg">
        <span class="avatar-text-lg">
          {{ getInitial(contact?.name || jid) }}
        </span>
      </div>
      <h3 class="customer-name">{{ contact?.name || jid.split('@')[0] }}</h3>
      <p class="customer-phone">{{ contact?.phone || jid.split('@')[0] }}</p>
      <div class="customer-status">
        <span class="status-dot online"></span>
        <span>在线</span>
      </div>
    </div>

    <!-- Customer Info -->
    <div class="panel-section">
      <div class="section-title">客户信息</div>
      <div class="info-grid">
        <div class="info-item">
          <label>备注名</label>
          <el-input
            v-model="editForm.name"
            size="small"
            placeholder="添加备注名"
            @blur="saveContact"
          />
        </div>
        <div class="info-item">
          <label>国家/地区</label>
          <el-input
            v-model="editForm.country"
            size="small"
            placeholder="如：美国、德国"
            @blur="saveContact"
          />
        </div>
        <div class="info-item">
          <label>语言</label>
          <el-input
            v-model="editForm.language"
            size="small"
            placeholder="如：英语、西班牙语"
            @blur="saveContact"
          />
        </div>
        <div class="info-item">
          <label>标签</label>
          <el-select
            v-model="editForm.tags"
            multiple
            filterable
            allow-create
            size="small"
            placeholder="添加标签"
            style="width: 100%"
            @change="saveContact"
          >
            <el-option label="VIP" value="VIP" />
            <el-option label="潜在客户" value="潜在客户" />
            <el-option label="老客户" value="老客户" />
            <el-option label="询价" value="询价" />
            <el-option label="已成交" value="已成交" />
          </el-select>
        </div>
        <div class="info-item full-width">
          <label>备注</label>
          <el-input
            v-model="editForm.notes"
            type="textarea"
            :rows="3"
            size="small"
            placeholder="添加客户备注..."
            @blur="saveContact"
          />
        </div>
      </div>
    </div>

    <!-- Quick Actions -->
    <div class="panel-section">
      <div class="section-title">快捷操作</div>
      <div class="quick-actions">
        <el-button size="small" @click="$emit('translate')">
          <el-icon><ChatDotRound /></el-icon>
          翻译消息
        </el-button>
        <el-button size="small" @click="$emit('aiReply')">
          <el-icon><MagicStick /></el-icon>
          AI生成回复
        </el-button>
        <el-button size="small" @click="$emit('summarize')">
          <el-icon><Document /></el-icon>
          需求总结
        </el-button>
      </div>
    </div>

    <!-- Stats -->
    <div class="panel-section">
      <div class="section-title">沟通统计</div>
      <div class="stats-grid">
        <div class="stat-item">
          <span class="stat-value">{{ messageCount }}</span>
          <span class="stat-label">消息数</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">{{ daysSinceContact }}</span>
          <span class="stat-label">接触天数</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, watch, computed } from 'vue';
import { ChatDotRound, MagicStick, Document } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import api from '../../utils/api.js';

const props = defineProps({
  contact: { type: Object, default: null },
  accountId: { type: Number, default: null },
  jid: { type: String, default: '' },
});

defineEmits(['translate', 'aiReply', 'summarize']);

const editForm = reactive({
  name: '',
  country: '',
  language: '',
  tags: [],
  notes: '',
});

const messageCount = computed(() => 0); // Will be updated with real data
const daysSinceContact = computed(() => {
  if (!props.contact?.createdAt) return 0;
  const diff = Date.now() - new Date(props.contact.createdAt).getTime();
  return Math.floor(diff / 86400000);
});

watch(
  () => props.contact,
  (contact) => {
    if (contact) {
      editForm.name = contact.name || '';
      editForm.country = contact.country || '';
      editForm.language = contact.language || '';
      editForm.tags = contact.tags ? contact.tags.split(',').filter(Boolean) : [];
      editForm.notes = contact.notes || '';
    }
  },
  { immediate: true }
);

async function saveContact() {
  if (!props.contact?.id) return;
  try {
    await api.put(`/contacts/${props.contact.id}`, {
      name: editForm.name,
      country: editForm.country,
      language: editForm.language,
      tags: editForm.tags.join(','),
      notes: editForm.notes,
    });
    ElMessage.success('已保存');
  } catch (err) {
    console.error('Failed to save contact:', err);
  }
}

function getInitial(name) {
  if (!name) return '?';
  return name.charAt(0).toUpperCase();
}
</script>

<style scoped>
.customer-panel {
  flex: 1;
  overflow-y: auto;
}

.panel-section {
  padding: 20px 16px;
  border-bottom: 1px solid var(--border-color);
}

.section-title {
  color: var(--accent);
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 12px;
}

/* Header */
.customer-header {
  text-align: center;
  padding: 24px 16px;
}

.customer-avatar-lg {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: linear-gradient(135deg, #00a884, #06cf9c);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 12px;
}

.avatar-text-lg {
  color: white;
  font-weight: 600;
  font-size: 28px;
}

.customer-name {
  color: var(--text-primary);
  font-size: 17px;
  font-weight: 500;
  margin-bottom: 4px;
}

.customer-phone {
  color: var(--text-secondary);
  font-size: 13px;
  margin-bottom: 8px;
}

.customer-status {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-secondary);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.status-dot.online {
  background: var(--accent);
}

.status-dot.offline {
  background: var(--text-muted);
}

/* Info Grid */
.info-grid {
  display: grid;
  gap: 12px;
}

.info-item label {
  display: block;
  color: var(--text-muted);
  font-size: 11px;
  margin-bottom: 4px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.info-item.full-width {
  grid-column: 1 / -1;
}

:deep(.el-input__wrapper) {
  background: var(--input-bg);
  border-color: transparent;
}

:deep(.el-input__inner) {
  color: var(--text-primary);
  font-size: 13px;
}

:deep(.el-input__inner::placeholder) {
  color: var(--text-muted);
}

:deep(.el-textarea__inner) {
  background: var(--input-bg);
  border-color: transparent;
  color: var(--text-primary);
  font-size: 13px;
}

:deep(.el-select .el-input__wrapper) {
  background: var(--input-bg);
}

/* Quick Actions */
.quick-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.quick-actions .el-button {
  justify-content: flex-start;
  background: var(--input-bg);
  border-color: transparent;
  color: var(--text-primary);
  width: 100%;
}

.quick-actions .el-button:hover {
  background: var(--sidebar-hover);
  border-color: var(--accent);
  color: var(--accent);
}

.quick-actions .el-button .el-icon {
  margin-right: 8px;
}

/* Stats */
.stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.stat-item {
  text-align: center;
  padding: 12px;
  background: var(--input-bg);
  border-radius: 8px;
}

.stat-value {
  display: block;
  font-size: 22px;
  font-weight: 600;
  color: var(--accent);
  margin-bottom: 4px;
}

.stat-label {
  color: var(--text-muted);
  font-size: 11px;
}
</style>
