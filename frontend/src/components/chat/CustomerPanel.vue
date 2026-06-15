<template>
  <div class="customer-panel">
    <!-- Tab navigation -->
    <div class="panel-tabs">
      <div
        class="panel-tab"
        :class="{ active: activeTab === 'info' }"
        @click="activeTab = 'info'"
      >
        客户
      </div>
      <div
        class="panel-tab"
        :class="{ active: activeTab === 'translation' }"
        @click="activeTab = 'translation'"
      >
        翻译
      </div>
    </div>

    <!-- Customer Info Tab -->
    <div v-show="activeTab === 'info'" class="tab-content">
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

    <!-- Translation Settings Tab -->
    <div v-show="activeTab === 'translation'" class="tab-content">
      <div class="panel-section">
        <div class="section-title">翻译设置</div>
        <div class="translation-settings">
          <!-- Translation Toggle -->
          <div class="setting-row">
            <div class="setting-label">
              <span class="setting-name">自动翻译</span>
              <span class="setting-desc">收到消息时自动翻译</span>
            </div>
            <el-switch
              v-model="settings.translationEnabled"
              active-color="#00a884"
              @change="saveSettings"
            />
          </div>

          <!-- Translation Engine -->
          <div class="setting-row vertical">
            <div class="setting-label">
              <span class="setting-name">翻译引擎</span>
              <span class="setting-desc">选择翻译使用的大模型</span>
            </div>
            <el-radio-group v-model="settings.translationEngine" @change="saveSettings">
              <el-radio label="doubao" border>
                <div class="engine-option">
                  <span class="engine-name">豆包</span>
                  <span class="engine-desc">doubao-seed-2-0-lite</span>
                </div>
              </el-radio>
              <el-radio label="deepseek" border>
                <div class="engine-option">
                  <span class="engine-name">DeepSeek</span>
                  <span class="engine-desc">deepseek-v3-2</span>
                </div>
              </el-radio>
            </el-radio-group>
          </div>

          <!-- Target Language -->
          <div class="setting-row vertical">
            <div class="setting-label">
              <span class="setting-name">目标语言</span>
              <span class="setting-desc">翻译到的语言（接收消息）</span>
            </div>
            <el-select
              v-model="settings.targetLanguage"
              size="small"
              style="width: 100%"
              @change="saveSettings"
            >
              <el-option label="中文" value="zh" />
              <el-option label="英语" value="en" />
              <el-option label="日语" value="ja" />
              <el-option label="韩语" value="ko" />
              <el-option label="西班牙语" value="es" />
              <el-option label="法语" value="fr" />
              <el-option label="德语" value="de" />
              <el-option label="葡萄牙语" value="pt" />
              <el-option label="俄语" value="ru" />
              <el-option label="阿拉伯语" value="ar" />
              <el-option label="印尼语" value="id" />
            </el-select>
          </div>
        </div>
      </div>

      <!-- API Keys -->
      <div class="panel-section">
        <div class="section-title">API 密钥</div>
        <div class="api-key-section">
          <div class="api-key-item">
            <label>
              <span class="api-engine-badge doubao">豆包</span>
              API Key
            </label>
            <el-input
              v-model="settings.doubaoApiKey"
              size="small"
              type="password"
              show-password
              placeholder="输入豆包 API Key"
              @blur="saveSettings"
            />
            <span class="api-hint">留空则使用系统默认配置</span>
          </div>
          <div class="api-key-item">
            <label>
              <span class="api-engine-badge deepseek">DeepSeek</span>
              API Key
            </label>
            <el-input
              v-model="settings.deepseekApiKey"
              size="small"
              type="password"
              show-password
              placeholder="输入 DeepSeek API Key"
              @blur="saveSettings"
            />
            <span class="api-hint">留空则使用系统默认配置</span>
          </div>
        </div>
      </div>

      <!-- Translation Preview -->
      <div class="panel-section">
        <div class="section-title">翻译测试</div>
        <div class="translation-test">
          <el-input
            v-model="testText"
            size="small"
            placeholder="输入文本测试翻译..."
            @keydown.enter="testTranslation"
          />
          <el-button
            size="small"
            type="primary"
            :loading="testing"
            :disabled="!testText.trim()"
            @click="testTranslation"
          >
            翻译
          </el-button>
        </div>
        <div v-if="testResult" class="test-result">
          <div class="test-result-meta">
            <span class="test-source-lang">{{ testResult.sourceLang }}</span>
            <span class="test-arrow">→</span>
            <span class="test-target-lang">{{ testResult.targetLang }}</span>
          </div>
          <p class="test-result-text">{{ testResult.translated }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, watch, computed, onMounted } from 'vue';
import { ChatDotRound, MagicStick, Document } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import api from '../../utils/api.js';
import { useChatStore } from '../../stores/chat.js';

const props = defineProps({
  contact: { type: Object, default: null },
  accountId: { type: Number, default: null },
  jid: { type: String, default: '' },
});

defineEmits(['translate', 'aiReply', 'summarize']);

const chatStore = useChatStore();
const activeTab = ref('info');

const editForm = reactive({
  name: '',
  country: '',
  language: '',
  tags: [],
  notes: '',
});

const settings = reactive({
  translationEnabled: true,
  translationEngine: 'doubao',
  targetLanguage: 'zh',
  doubaoApiKey: '',
  deepseekApiKey: '',
});

const testText = ref('');
const testing = ref(false);
const testResult = ref(null);

const messageCount = computed(() => 0);
const daysSinceContact = computed(() => {
  if (!props.contact?.createdAt) return 0;
  const diff = Date.now() - new Date(props.contact.createdAt).getTime();
  return Math.floor(diff / 86400000);
});

// Load settings from store on mount
onMounted(async () => {
  await chatStore.fetchTranslationSettings();
  syncSettingsFromStore();
});

function syncSettingsFromStore() {
  const s = chatStore.translationSettings;
  settings.translationEnabled = s.translationEnabled;
  settings.translationEngine = s.translationEngine;
  settings.targetLanguage = s.targetLanguage;
  settings.doubaoApiKey = s.doubaoApiKey;
  settings.deepseekApiKey = s.deepseekApiKey;
}

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

async function saveSettings() {
  try {
    await chatStore.updateTranslationSettings({ ...settings });
  } catch (err) {
    console.error('Failed to save translation settings:', err);
    ElMessage.error('保存翻译设置失败');
  }
}

async function testTranslation() {
  if (!testText.value.trim()) return;
  testing.value = true;
  testResult.value = null;
  try {
    const result = await chatStore.translateMessage(
      testText.value,
      'auto',
      settings.targetLanguage
    );
    if (result) {
      testResult.value = result;
    } else {
      ElMessage.warning('翻译失败，请检查API Key配置');
    }
  } catch (err) {
    ElMessage.error('翻译请求失败');
  } finally {
    testing.value = false;
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
  display: flex;
  flex-direction: column;
}

/* Tab Navigation */
.panel-tabs {
  display: flex;
  border-bottom: 1px solid var(--border-color);
  background: var(--panel-header-bg);
}

.panel-tab {
  flex: 1;
  text-align: center;
  padding: 12px 0;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
  border-bottom: 2px solid transparent;
}

.panel-tab:hover {
  color: var(--text-primary);
}

.panel-tab.active {
  color: var(--accent);
  border-bottom-color: var(--accent);
}

.tab-content {
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

/* Translation Settings */
.translation-settings {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.setting-row.vertical {
  flex-direction: column;
  align-items: stretch;
}

.setting-label {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.setting-name {
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 500;
}

.setting-desc {
  color: var(--text-muted);
  font-size: 11px;
}

/* Engine Radio */
:deep(.el-radio-group) {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

:deep(.el-radio.is-bordered) {
  background: var(--input-bg);
  border-color: var(--border-color);
  border-radius: 8px;
  padding: 10px 12px;
  margin: 0;
  width: 100%;
}

:deep(.el-radio.is-bordered.is-checked) {
  border-color: var(--accent);
  background: rgba(0, 168, 132, 0.08);
}

:deep(.el-radio__label) {
  color: var(--text-primary);
}

:deep(.el-radio__input.is-checked + .el-radio__label) {
  color: var(--accent);
}

.engine-option {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.engine-name {
  font-weight: 500;
  font-size: 13px;
}

.engine-desc {
  font-size: 11px;
  color: var(--text-muted);
}

/* API Key */
.api-key-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.api-key-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.api-key-item label {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 500;
}

.api-engine-badge {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: 600;
}

.api-engine-badge.doubao {
  background: rgba(0, 168, 132, 0.15);
  color: #00a884;
}

.api-engine-badge.deepseek {
  background: rgba(66, 133, 244, 0.15);
  color: #4285f4;
}

.api-hint {
  font-size: 11px;
  color: var(--text-muted);
}

/* Translation Test */
.translation-test {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.translation-test .el-input {
  flex: 1;
}

.test-result {
  background: var(--input-bg);
  border-radius: 8px;
  padding: 10px 12px;
  animation: fadeIn 0.15s ease-out;
}

.test-result-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
  font-size: 11px;
  color: var(--text-muted);
}

.test-arrow {
  color: var(--accent);
}

.test-source-lang,
.test-target-lang {
  background: rgba(0, 168, 132, 0.1);
  color: var(--accent);
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 10px;
}

.test-result-text {
  color: var(--text-primary);
  font-size: 13px;
  line-height: 1.4;
  margin: 0;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
</style>
