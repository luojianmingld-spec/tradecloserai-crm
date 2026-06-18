<template>
  <div class="settings-page">
    <div class="settings-header">
      <button class="back-btn" @click="$router.push('/')">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
      </button>
      <h1>AI 设置</h1>
    </div>

    <div class="settings-body">
      <!-- Model Selection -->
      <section class="settings-section">
        <h2>模型配置</h2>
        <div class="form-group">
          <label>AI 模型</label>
          <select v-model="form.aiModel" class="form-select">
            <option v-for="m in models" :key="m.key" :value="m.key">
              {{ m.name }} ({{ m.id }})
            </option>
          </select>
          <p class="form-hint">选择用于翻译、话术生成和需求总结的 AI 模型</p>
        </div>
      </section>

      <!-- Translation Settings -->
      <section class="settings-section">
        <h2>翻译设置</h2>
        <div class="form-group">
          <label class="toggle-label">
            <span>启用自动翻译</span>
            <button
              class="toggle-btn"
              :class="{ active: form.translationEnabled === 'true' }"
              @click="form.translationEnabled = form.translationEnabled === 'true' ? 'false' : 'true'"
            >
              <span class="toggle-thumb"></span>
            </button>
          </label>
        </div>

        <div class="form-group">
          <label>翻译引擎</label>
          <select v-model="form.translationEngine" class="form-select">
            <option value="doubao">豆包 Doubao</option>
            <option value="deepseek">DeepSeek</option>
          </select>
        </div>

        <div class="form-group">
          <label>目标翻译语言</label>
          <select v-model="form.translationTargetLang" class="form-select">
            <option value="auto">自动检测</option>
            <option value="zh">中文</option>
            <option value="en">English</option>
            <option value="ja">日本語</option>
            <option value="ko">한국어</option>
            <option value="es">Espanol</option>
            <option value="fr">Francais</option>
            <option value="de">Deutsch</option>
            <option value="ar">العربية</option>
          </select>
        </div>

        <div class="form-group">
          <label class="toggle-label">
            <span>发送时自动翻译</span>
            <button
              class="toggle-btn"
              :class="{ active: form.translationAutoSend === 'true' }"
              @click="form.translationAutoSend = form.translationAutoSend === 'true' ? 'false' : 'true'"
            >
              <span class="toggle-thumb"></span>
            </button>
          </label>
          <p class="form-hint">开启后，发送消息时会自动将中文翻译为对方语言</p>
        </div>
      </section>

      <!-- Test Section -->
      <section class="settings-section">
        <h2>功能测试</h2>
        <div class="test-group">
          <label>翻译测试</label>
          <div class="test-input-row">
            <input
              v-model="testText"
              class="form-input"
              placeholder="输入文本测试翻译..."
              @keyup.enter="testTranslate"
            />
            <button class="test-btn" @click="testTranslate" :disabled="testing">
              {{ testing ? '翻译中...' : '测试' }}
            </button>
          </div>
          <div v-if="testResult" class="test-result">
            <span class="result-label">翻译结果:</span>
            <span class="result-text">{{ testResult }}</span>
          </div>
        </div>
      </section>

      <!-- Save -->
      <div class="settings-actions">
        <button class="save-btn" @click="saveSettings" :disabled="saving">
          {{ saving ? '保存中...' : '保存设置' }}
        </button>
        <span v-if="saveMsg" class="save-msg" :class="{ error: saveMsg.includes('失败') }">{{ saveMsg }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import api from '../utils/api.js';

const form = ref({
  aiModel: 'doubao-pro',
  translationEnabled: 'true',
  translationEngine: 'doubao',
  translationTargetLang: 'auto',
  translationAutoSend: 'false',
});

const models = ref([]);
const testText = ref('');
const testResult = ref('');
const testing = ref(false);
const saving = ref(false);
const saveMsg = ref('');

onMounted(async () => {
  try {
    const res = await api.get('/api/settings/ai');
    if (res.data.settings) {
      Object.assign(form.value, res.data.settings);
    }
    if (res.data.models) {
      models.value = res.data.models;
    }
  } catch (err) {
    console.error('Failed to load AI settings:', err);
  }
});

async function saveSettings() {
  saving.value = true;
  saveMsg.value = '';
  try {
    const res = await api.put('/api/settings/ai', form.value);
    if (res.data.settings) {
      Object.assign(form.value, res.data.settings);
    }
    saveMsg.value = '保存成功';
    setTimeout(() => { saveMsg.value = ''; }, 3000);
  } catch (err) {
    saveMsg.value = '保存失败: ' + (err.response?.data?.error || err.message);
  } finally {
    saving.value = false;
  }
}

async function testTranslate() {
  if (!testText.value.trim()) return;
  testing.value = true;
  testResult.value = '';
  try {
    const res = await api.post('/api/ai/translate', {
      text: testText.value,
      sourceLang: 'auto',
      targetLang: form.value.translationTargetLang === 'auto' ? 'zh' : form.value.translationTargetLang,
      engine: form.value.translationEngine,
    });
    testResult.value = res.data.translated || '无结果';
  } catch (err) {
    testResult.value = '翻译失败: ' + (err.response?.data?.error || err.message);
  } finally {
    testing.value = false;
  }
}
</script>

<style scoped>
.settings-page {
  min-height: 100vh;
  background: var(--bg-primary, #0b141a);
  color: var(--text-primary, #e9edef);
}

.settings-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 20px;
  background: var(--bg-panel, #202c33);
  border-bottom: 1px solid rgba(255,255,255,0.06);
}

.settings-header h1 {
  font-size: 18px;
  font-weight: 600;
}

.back-btn {
  background: none;
  border: none;
  color: var(--text-secondary, #8696a0);
  cursor: pointer;
  padding: 4px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.back-btn:hover {
  background: rgba(255,255,255,0.06);
  color: var(--text-primary, #e9edef);
}

.settings-body {
  max-width: 640px;
  margin: 0 auto;
  padding: 24px 20px;
}

.settings-section {
  margin-bottom: 32px;
}

.settings-section h2 {
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--color-primary, #00a884);
  margin-bottom: 16px;
}

.form-group {
  margin-bottom: 16px;
}

.form-group > label {
  display: block;
  font-size: 14px;
  color: var(--text-primary, #e9edef);
  margin-bottom: 6px;
}

.form-select,
.form-input {
  width: 100%;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.12);
  background: var(--bg-secondary, #111b21);
  color: var(--text-primary, #e9edef);
  font-size: 14px;
  outline: none;
  transition: border-color 0.15s;
}

.form-select:focus,
.form-input:focus {
  border-color: var(--color-primary, #00a884);
}

.form-hint {
  font-size: 12px;
  color: var(--text-tertiary, #667781);
  margin-top: 4px;
}

/* Toggle */
.toggle-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
}

.toggle-btn {
  position: relative;
  width: 44px;
  height: 24px;
  border-radius: 12px;
  border: none;
  background: rgba(255,255,255,0.12);
  cursor: pointer;
  transition: background 0.2s;
  flex-shrink: 0;
}

.toggle-btn.active {
  background: var(--color-primary, #00a884);
}

.toggle-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.2s;
}

.toggle-btn.active .toggle-thumb {
  transform: translateX(20px);
}

/* Test */
.test-group {
  margin-bottom: 16px;
}

.test-group > label {
  display: block;
  font-size: 14px;
  color: var(--text-primary, #e9edef);
  margin-bottom: 8px;
}

.test-input-row {
  display: flex;
  gap: 8px;
}

.test-input-row .form-input {
  flex: 1;
}

.test-btn {
  padding: 10px 16px;
  border-radius: 8px;
  border: none;
  background: var(--color-primary, #00a884);
  color: #fff;
  font-size: 14px;
  cursor: pointer;
  white-space: nowrap;
  transition: opacity 0.15s;
}

.test-btn:hover {
  opacity: 0.9;
}

.test-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.test-result {
  margin-top: 8px;
  padding: 10px 12px;
  border-radius: 8px;
  background: rgba(0,168,132,0.1);
  font-size: 14px;
}

.result-label {
  color: var(--color-primary, #00a884);
  font-size: 12px;
  margin-right: 8px;
}

.result-text {
  color: var(--text-primary, #e9edef);
}

/* Actions */
.settings-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-top: 16px;
  border-top: 1px solid rgba(255,255,255,0.06);
}

.save-btn {
  padding: 10px 24px;
  border-radius: 8px;
  border: none;
  background: var(--color-primary, #00a884);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s;
}

.save-btn:hover {
  opacity: 0.9;
}

.save-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.save-msg {
  font-size: 13px;
  color: var(--color-primary, #00a884);
}

.save-msg.error {
  color: #ea4335;
}

@media (max-width: 768px) {
  .settings-page {
    padding: 0;
  }

  .settings-header h1 {
    font-size: 16px;
  }

  .settings-body {
    padding: 12px;
    max-width: 100%;
  }

  .settings-section {
    padding: 12px;
    margin-bottom: 12px;
  }

  .settings-section h2 {
    font-size: 14px;
  }

  .form-select,
  .form-input {
    font-size: 14px;
    min-height: 44px;
  }

  .toggle-switch {
    min-width: 44px;
    min-height: 44px;
  }

  .save-btn {
    width: 100%;
    height: 44px;
    font-size: 16px;
  }
}
</style>
