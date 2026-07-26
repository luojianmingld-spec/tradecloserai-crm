#!/usr/bin/env python3
"""
Copilot v1 patch:
- 在 ChatWindow.vue 输入框上方加 AI 建议气泡条（自动触发）
- 右侧工具栏💬沟通话术按钮保留，作为深度分析入口
- 手机端适配
- 加开关（默认开），可一键关闭
"""
import re, sys, os, shutil

PATH = '/opt/whatsapp-crm/frontend/src/components/chat/ChatWindow.vue'
SRC  = '/opt/whatsapp-crm/frontend/src/views/LayoutView.vue'  # for global copilotEnabled toggle

with open(PATH, 'r', encoding='utf-8') as f:
    content = f.read()

# ===== 1. 在 input-area 开头加 copilot suggestion bar (在 input-toolbar 之前) =====
old_input_area = '    <!-- Input Area -->\n    <div class="input-area">\n      <div class="input-toolbar">'
new_input_area = '''    <!-- Input Area -->
    <div class="input-area">
      <!-- 🤖 Copilot AI 建议条 -->
      <div v-if="copilot.suggestions.length || copilot.loading" class="copilot-bar">
        <div class="copilot-header">
          <span class="copilot-title">🤖 AI建议回复</span>
          <div class="copilot-actions">
            <button v-if="copilot.suggestions.length" class="copilot-action-btn" @click="copilotRegenerate" :disabled="copilot.loading" title="重新生成">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
            </button>
            <button class="copilot-action-btn" @click="copilotClear" title="关闭建议">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
        </div>
        <div v-if="copilot.loading" class="copilot-loading">
          <span class="copilot-dot"></span><span class="copilot-dot"></span><span class="copilot-dot"></span>
          <span style="margin-left:6px;font-size:12px;color:var(--text-secondary)">正在生成建议...</span>
        </div>
        <div v-else class="copilot-chips">
          <button
            v-for="(s, i) in copilot.suggestions"
            :key="'cop-'+i"
            class="copilot-chip"
            @click="copilotApply(s)"
          >
            <span class="copilot-chip-label">{{ s.name || ('建议'+(i+1)) }}</span>
            <span class="copilot-chip-text">{{ s.foreign || s.content || s }}</span>
          </button>
        </div>
        <div v-if="!copilot.loading && copilot.error" class="copilot-error">⚠️ {{ copilot.error }}</div>
      </div>
      <div class="input-toolbar">'''
assert old_input_area in content, 'input-area anchor not found!'
content = content.replace(old_input_area, new_input_area, 1)

# ===== 2. 在 input-toolbar 最右侧加 Copilot 开关按钮（在需求总结按钮之后） =====
# 找到 input-toolbar 最后一个按钮（需求总结那个 el-tooltip）的闭合
old_summary_btn = '''        <el-tooltip content="需求总结" placement="top">
          <el-button text circle size="small" @click="handleAISummarize" :loading="aiSummarizingLocal">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
              <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"/>
            </svg>
          </el-button>
        </el-tooltip>
      </div>'''
new_summary_btn = '''        <el-tooltip content="需求总结" placement="top">
          <el-button text circle size="small" @click="handleAISummarize" :loading="aiSummarizingLocal">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
              <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"/>
            </svg>
          </el-button>
        </el-tooltip>
        <el-tooltip :content="copilotEnabled ? 'AI智能建议（开）' : 'AI智能建议（关）'" placement="top">
          <el-button text circle size="small" @click="toggleCopilot" :class="{'copilot-toggle-on': copilotEnabled}">
            <svg v-if="copilotEnabled" viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M12 2a2 2 0 012 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 017 7h1a1 1 0 011 1v3a1 1 0 01-1 1h-1v1a2 2 0 01-2 2H5a2 2 0 01-2-2v-1H2a1 1 0 01-1-1v-3a1 1 0 011-1h1a7 7 0 017-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 012-2M7.5 13A1.5 1.5 0 006 14.5 1.5 1.5 0 007.5 16 1.5 1.5 0 009 14.5 1.5 1.5 0 007.5 13m9 0a1.5 1.5 0 00-1.5 1.5 1.5 1.5 0 001.5 1.5 1.5 1.5 0 001.5-1.5 1.5 1.5 0 00-1.5-1.5M12 9a5 5 0 00-5 5v1h10v-1a5 5 0 00-5-5z"/></svg>
            <svg v-else viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" opacity="0.4"><path d="M9.1 9.1a3 3 0 004.2 4.2M14 7V5.7A2 2 0 0012 4a2 2 0 00-1.3.5M6.2 6.2A7 7 0 005 14H4a1 1 0 00-1 1v3a1 1 0 001 1h1v1a2 2 0 002 2h10c.5 0 .9-.2 1.3-.5M9 9L2 2"/><path d="M20.5 7.5L18.5 9.5M18.5 7.5l2 2"/></svg>
          </el-button>
        </el-tooltip>
      </div>'''
assert old_summary_btn in content, 'summary btn anchor not found!'
content = content.replace(old_summary_btn, new_summary_btn, 1)

# ===== 3. JS: 添加 copilot 状态 + watch 新消息自动触发 + API调用逻辑 =====
# 找到 handleSend 函数之前插入 copilot 代码
old_js_anchor = "async function handleSend() {"
new_js_anchor = '''// ─── 🤖 Copilot AI 实时建议 ───
const copilotEnabled = ref(
  localStorage.getItem('crm_copilot_enabled') !== '0' // 默认开
);
const copilot = reactive({
  loading: false,
  suggestions: [],  // [{name, foreign, chinese, desc}]
  error: '',
  lastMsgId: null,  // 节流：同一条消息只触发一次
  abortCtrl: null,
});

function toggleCopilot() {
  copilotEnabled.value = !copilotEnabled.value;
  localStorage.setItem('crm_copilot_enabled', copilotEnabled.value ? '1' : '0');
  if (!copilotEnabled.value) {
    copilotClear();
  } else {
    // 开启时，立即为当前会话最新消息生成建议
    triggerCopilotForLatest();
  }
}

function copilotClear() {
  if (copilot.abortCtrl) { try { copilot.abortCtrl.abort(); } catch(e){} }
  copilot.suggestions = [];
  copilot.loading = false;
  copilot.error = '';
  copilot.lastMsgId = null;
}

async function copilotRegenerate() {
  copilot.lastMsgId = null; // 强制重生成
  await triggerCopilotForLatest();
}

function copilotApply(s) {
  // 一键填入输入框；如已开自动翻译则译文会自动出现在发送预览
  const text = s.foreign || s.content || s;
  if (!text) return;
  inputText.value = text;
  nextTick(() => {
    inputRef.value?.focus();
  });
}

function getLatestInboundMsg() {
  if (!props.jid) return null;
  const list = chatStore.messages[props.jid] || [];
  // 倒序找最后一条 fromMe=false 的文本消息
  for (let i = list.length - 1; i >= 0; i--) {
    const m = list[i];
    if (!m.fromMe && m.messageType === 'text' && (m.content || '').trim().length > 0) {
      return m;
    }
  }
  return null;
}

async function triggerCopilotForLatest() {
  if (!copilotEnabled.value) return;
  if (!props.jid) return;
  // 如果输入框已经有内容（用户在打字），不打断
  if (inputText.value && inputText.value.trim().length > 0) return;
  const last = getLatestInboundMsg();
  if (!last) return;
  if (copilot.lastMsgId === last.id) return; // 同一条消息已处理
  if (copilot.loading) return;

  copilot.lastMsgId = last.id;
  copilot.loading = true;
  copilot.error = '';
  copilot.suggestions = [];
  if (copilot.abortCtrl) { try { copilot.abortCtrl.abort(); } catch(e){} }
  copilot.abortCtrl = new AbortController();

  try {
    const body = {
      jid: props.jid,
      accountId: 1,
      targetLang: 'auto',
    };
    const token = localStorage.getItem('crm_token') || '';
    const resp = await fetch('/api/ai/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token,
      },
      body: JSON.stringify(body),
      signal: copilot.abortCtrl.signal,
    });
    const data = await resp.json();
    if (data?.success && Array.isArray(data.data?.replies) && data.data.replies.length) {
      copilot.suggestions = data.data.replies.slice(0, 3).map((r, i) => ({
        name: r.styleName || ['简洁','正式','友好'][i] || ('建议'+(i+1)),
        foreign: r.foreign || r.content || '',
        chinese: r.chinese || '',
        desc: r.desc || '',
      })).filter(s => s.foreign);
      if (!copilot.suggestions.length) {
        copilot.error = '未生成建议';
      }
    } else {
      copilot.error = data?.error || '暂无建议';
    }
  } catch (err) {
    if (err.name !== 'AbortError') {
      copilot.error = err.message || '生成失败';
    }
  } finally {
    copilot.loading = false;
  }
}

// 监听：新消息入站时（chatStore 已push），延迟触发 Copilot
watch(
  () => {
    if (!props.jid) return null;
    const list = chatStore.messages[props.jid] || [];
    const last = list[list.length - 1];
    return last ? last.id + ':' + last.fromMe : null;
  },
  (val, oldVal) => {
    if (!val) return;
    const [id, fromMe] = val.split(':');
    if (fromMe === 'false') {
      // 客户来新消息，清除旧建议，延迟 800ms 等翻译渲染完再触发
      copilotClear();
      setTimeout(() => triggerCopilotForLatest(), 800);
    } else {
      // 我方发消息后清除建议
      copilotClear();
    }
  }
);

// 切换会话时清空建议
watch(() => props.jid, () => {
  copilotClear();
  // 新会话如果开启了，等消息列表加载完再触发
  setTimeout(() => triggerCopilotForLatest(), 1200);
});

// 输入框有内容时隐藏建议（开始打字就不挡着）
watch(inputText, (val) => {
  if (val && val.trim().length > 2 && copilot.suggestions.length) {
    // 用户开始打字就把建议收起来（但不清空数据，用户清空输入时可重新展示）
    // 不主动 clear，只标记隐藏——简化起见直接清掉
    copilot.suggestions = [];
    copilot.loading = false;
  }
});

async function handleSend() {'''
assert old_js_anchor in content, 'handleSend anchor not found!'
content = content.replace(old_js_anchor, new_js_anchor, 1)

# ===== 4. CSS：copilot 样式 =====
# 找到文件末尾的 </style> 标签前插入
old_style_end = '</style>'
new_style_end = '''/* ========== 🤖 Copilot AI 建议条 ========== */
.copilot-bar {
  padding: 8px 12px 4px;
  border-bottom: 1px solid var(--border-color, #e9edef);
  background: var(--bg-bubble-in, #f0f2f5);
}
.copilot-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}
.copilot-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--accent, #00a884);
  display: flex;
  align-items: center;
  gap: 4px;
}
.copilot-actions {
  display: flex;
  gap: 4px;
}
.copilot-action-btn {
  background: transparent;
  border: none;
  color: var(--text-secondary, #667781);
  cursor: pointer;
  padding: 3px 6px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.copilot-action-btn:hover { background: rgba(0,0,0,0.06); color: var(--text-primary); }
.copilot-action-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.copilot-loading {
  display: flex;
  align-items: center;
  padding: 8px 0;
}
.copilot-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: var(--accent, #00a884);
  margin: 0 2px;
  animation: copilotBounce 1.2s infinite ease-in-out;
}
.copilot-dot:nth-child(2) { animation-delay: 0.2s; }
.copilot-dot:nth-child(3) { animation-delay: 0.4s; }
@keyframes copilotBounce {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.5; }
  40% { transform: scale(1); opacity: 1; }
}
.copilot-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding-bottom: 4px;
}
.copilot-chip {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  background: var(--bg-primary, #fff);
  border: 1px solid var(--border-color, #e9edef);
  border-radius: 12px;
  padding: 6px 10px;
  cursor: pointer;
  max-width: 100%;
  transition: all 0.15s ease;
  text-align: left;
}
.copilot-chip:hover {
  border-color: var(--accent, #00a884);
  background: rgba(0,168,132,0.06);
  transform: translateY(-1px);
  box-shadow: 0 2px 6px rgba(0,0,0,0.08);
}
.copilot-chip-label {
  font-size: 10px;
  color: var(--accent, #00a884);
  font-weight: 600;
  margin-bottom: 2px;
}
.copilot-chip-text {
  font-size: 12.5px;
  color: var(--text-primary, #111b21);
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 260px;
}
.copilot-error {
  font-size: 12px;
  color: #ef4444;
  padding: 4px 0;
}
.copilot-toggle-on {
  color: var(--accent, #00a884) !important;
}
/* 手机端适配 */
@media (max-width: 768px) {
  .copilot-chip-text { max-width: 180px; }
  .copilot-bar { padding: 6px 10px 2px; }
}
</style>'''
assert old_style_end in content, 'style end not found!'
# 只替换最后一个 </style>（文件内可能有多个？Vue单文件应该只有一个）
last_style_idx = content.rfind(old_style_end)
content = content[:last_style_idx] + new_style_end + content[last_style_idx+len(old_style_end):]

# 写入备份目录（scp 之前）
os.makedirs('/tmp/copilot_patch_out', exist_ok=True)
with open('/tmp/copilot_patch_out/ChatWindow.vue', 'w', encoding='utf-8') as f:
    f.write(content)
print(f'Patch applied successfully, Total lines: {len(content.splitlines())}')
