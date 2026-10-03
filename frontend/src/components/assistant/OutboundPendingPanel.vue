<template>
  <!-- 悬浮入口（极简：一个铃铛 + 红点数量） -->
  <button
    class="ob-fab"
    :class="{ dark: isDark }"
    @click="open = !open"
    :title="'待确认外发'"
    aria-label="待确认外发"
  >
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M22 2 11 13" />
      <path d="M22 2 15 22l-4-9-9-4 20-7z" />
    </svg>
    <span v-if="pendingCount > 0" class="ob-badge">{{ pendingCount > 99 ? '99+' : pendingCount }}</span>
  </button>

  <transition name="ob-slide">
    <aside v-if="open" class="ob-panel" :class="{ dark: isDark }">
      <header class="ob-head">
        <div class="ob-title">待确认发送</div>
        <button class="ob-close" @click="open = false" aria-label="关闭">×</button>
      </header>

      <div class="ob-list">
        <div v-if="loading && drafts.length === 0" class="ob-empty">加载中…</div>
        <div v-else-if="drafts.length === 0" class="ob-empty">
          <div class="ob-empty-ic">✓</div>
          <div>暂无待确认内容</div>
        </div>

        <div v-for="d in drafts" :key="d.id" class="ob-card">
          <div class="ob-meta">
            <span class="ob-channel">{{ d.channel === 'email' ? '✉️ 邮件' : '🟢 WhatsApp' }}</span>
            <span class="ob-target">{{ d.target }}</span>
          </div>
          <div class="ob-content">{{ d.content }}</div>
          <div v-if="d.subject" class="ob-subject">主题：{{ d.subject }}</div>
          <div class="ob-actions">
            <button class="ob-btn primary" :disabled="busy[d.id]" @click="confirm(d)">
              {{ busy[d.id] === 'confirm' ? '发送中…' : '确认发送' }}
            </button>
            <button class="ob-btn ghost" :disabled="!!busy[d.id]" @click="reject(d)">拒发</button>
          </div>
          <div v-if="error[d.id]" class="ob-error">{{ error[d.id] }}</div>
        </div>
      </div>
    </aside>
  </transition>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import api from '../../utils/api.js'

const props = defineProps({
  isDark: { type: Boolean, default: true },
})

const open = ref(false)
const drafts = ref([])
const loading = ref(false)
const busy = ref({})
const error = ref({})
let timer = null

const pendingCount = computed(() => drafts.value.length)

async function load() {
  loading.value = true
  try {
    const { data } = await api.get('/outbound/drafts', { params: { status: 'pending' } })
    drafts.value = Array.isArray(data?.data) ? data.data : []
  } catch (e) {
    // 不打扰用户，仅在面板打开时静默；401 由全局拦截器处理
    if (open.value) console.error('[OutboundPanel] load failed:', e.message)
  } finally {
    loading.value = false
  }
}

async function confirm(d) {
  busy.value[d.id] = 'confirm'
  error.value[d.id] = ''
  try {
    // 后端做身份/租户归属/权限复校与幂等；这里不做任何前端安全假设
    const { data } = await api.post(`/outbound/drafts/${d.id}/confirm`, {})
    if (data?.success) {
      drafts.value = drafts.value.filter((x) => x.id !== d.id)
    }
  } catch (e) {
    const code = e.response?.data?.error || e.response?.data?.code || '发送失败'
    error.value[d.id] = friendly(code)
  } finally {
    busy.value[d.id] = null
    load()
  }
}

async function reject(d) {
  busy.value[d.id] = 'reject'
  error.value[d.id] = ''
  try {
    await api.post(`/outbound/drafts/${d.id}/reject`, {})
    drafts.value = drafts.value.filter((x) => x.id !== d.id)
  } catch (e) {
    const code = e.response?.data?.error || '操作失败'
    error.value[d.id] = friendly(code)
  } finally {
    busy.value[d.id] = null
    load()
  }
}

function friendly(code) {
  const map = {
    FORBIDDEN: '无权操作此草稿',
    NOT_FOUND: '草稿不存在或已处理',
    EXPIRED: '草稿已过期',
    REJECTED: '草稿已被拒发',
    SEND_FAILED: '发送失败，请重试',
    NO_SENDER: '发送通道未就绪',
    TOO_MANY_ATTEMPTS: '失败次数过多',
  }
  return map[code] || String(code)
}

onMounted(() => {
  load()
  timer = setInterval(load, 10000)
})
onUnmounted(() => timer && clearInterval(timer))

defineExpose({ refresh: load })
</script>

<style scoped>
.ob-fab {
  position: fixed;
  right: 22px;
  bottom: 22px;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  background: linear-gradient(135deg, #0a84ff, #0060df);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 24px rgba(10, 132, 255, 0.4);
  z-index: 1200;
}
.ob-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: #ff453a;
  color: #fff;
  font-size: 11px;
  line-height: 18px;
  font-weight: 600;
  border: 2px solid #0b1220;
}
.ob-panel {
  position: fixed;
  top: 0;
  right: 0;
  width: 360px;
  max-width: 92vw;
  height: 100%;
  background: rgba(245, 245, 247, 0.98);
  backdrop-filter: blur(20px);
  box-shadow: -8px 0 40px rgba(0, 0, 0, 0.3);
  z-index: 1300;
  display: flex;
  flex-direction: column;
}
.ob-panel.dark {
  background: rgba(22, 28, 36, 0.98);
  color: #f2f2f7;
}
.ob-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 20px;
  border-bottom: 1px solid rgba(120, 120, 128, 0.16);
}
.ob-title { font-size: 17px; font-weight: 600; }
.ob-close {
  border: none; background: transparent; font-size: 24px; line-height: 1;
  color: #8e8e93; cursor: pointer;
}
.ob-list { flex: 1; overflow-y: auto; padding: 14px; }
.ob-empty {
  text-align: center; color: #8e8e93; padding: 60px 20px; font-size: 14px;
}
.ob-empty-ic { font-size: 34px; margin-bottom: 10px; }
.ob-card {
  background: rgba(255, 255, 255, 0.7);
  border-radius: 14px;
  padding: 14px;
  margin-bottom: 12px;
}
.ob-panel.dark .ob-card { background: rgba(44, 52, 62, 0.8); }
.ob-meta {
  display: flex; align-items: center; gap: 8px; margin-bottom: 8px;
  font-size: 12px;
}
.ob-channel { white-space: nowrap; }
.ob-target { color: #8e8e93; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ob-content {
  font-size: 14px; line-height: 1.5; white-space: pre-wrap; word-break: break-word;
  margin-bottom: 6px;
}
.ob-subject { font-size: 12px; color: #8e8e93; margin-bottom: 8px; }
.ob-actions { display: flex; gap: 8px; margin-top: 10px; }
.ob-btn {
  flex: 1; border: none; border-radius: 10px; padding: 9px 12px;
  font-size: 14px; font-weight: 600; cursor: pointer;
}
.ob-btn.primary { background: #0a84ff; color: #fff; }
.ob-btn.primary:disabled { opacity: 0.6; }
.ob-btn.ghost {
  background: rgba(120, 120, 128, 0.16); color: inherit;
}
.ob-btn:disabled { opacity: 0.5; cursor: default; }
.ob-error { color: #ff453a; font-size: 12px; margin-top: 8px; }

.ob-slide-enter-active, .ob-slide-leave-active { transition: transform 0.25s ease; }
.ob-slide-enter-from, .ob-slide-leave-to { transform: translateX(100%); }

@media (max-width: 600px) {
  .ob-fab { right: 16px; bottom: 100px; }
}
</style>
