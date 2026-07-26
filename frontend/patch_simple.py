#!/usr/bin/env python3
"""需求分析面板极简傻瓜化：
1. 去掉标题栏右上角的✏️编辑按钮和🤖小按钮
2. 去掉面板内的customer-header头像/名字/更新时间框
3. 去掉编辑模式（textarea+编辑/保存按钮），只保留只读展示+底部一个主按钮
4. 底部按钮居中、大尺寸，无结果时显示"🤖 一键AI客户分析"，有结果显示"🔄 重新分析"
5. 标题改为"客户需求分析"（更直白）
"""
path = '/opt/whatsapp-crm/frontend/src/views/LayoutView.vue'
with open(path, 'r', encoding='utf-8') as f:
    src = f.read()

# === 修改1：标题栏——删掉✏️编辑按钮和小🤖按钮 ===
old_title = """              <div class="ai-title" v-else-if="activePanel === 'requirement'">
                <span class="ai-title-icon">🎯</span>
                <span class="ai-title-text">需求总结</span>
                <button class="col-toggle ai-mini-toggle" @click="reqEditMode = !reqEditMode" :title="reqEditMode ? '完成' : '编辑'">
                  <span style="font-size:14px">{{ reqEditMode ? '💾' : '✏️' }}</span>
                </button>
                <button class="col-toggle" @click="runReqAiAnalyze" title="客户需求分析" :disabled="reqAiLoading">
                  <span style="font-size:14px">{{ reqAiLoading ? '⏳' : '🤖' }}</span>
                </button>
              </div>"""
new_title = """              <div class="ai-title" v-else-if="activePanel === 'requirement'">
                <span class="ai-title-icon">🎯</span>
                <span class="ai-title-text">客户需求分析</span>
              </div>"""
assert old_title in src, "title block not found"
src = src.replace(old_title, new_title, 1)

# === 修改2：面板主体——去掉header、去掉编辑模式，只留结果+一个大按钮 ===
old_body = """            <template v-else>
              <div class="customer-header">
                <div class="customer-avatar" style="background:#7c3aed30;color:#a78bfa">{{ (reqData.contactName || reqData.name || reqData.phone || chatStore.activeJid || '?')[0] }}</div>
                <div class="customer-head-info">
                  <div class="customer-head-name">{{ reqData.contactName || reqData.name || reqData.phone || chatStore.activeJid }}</div>
                  <div class="customer-head-jid">
                    <span v-if="reqUpdatedAt" style="color:#8696a0;font-size:11px">更新于 {{ formatRelativeTime(reqUpdatedAt) }}</span>
                    <span v-if="reqData.requirementSource === 'ai_summary'" class="req-tag ai">AI</span>
                    <span v-else-if="reqData.requirementSource === 'manual'" class="req-tag manual">手动</span>
                  </div>
                </div>
              </div>
              <div class="req-alert" v-if="reqAiHint">
                <span style="color:#f59e0b">🤖 {{ reqAiHint }}</span>
              </div>
              <div v-if="!reqEditMode" class="req-fields">
                <div class="req-summary-text-block req-md-content" :class="{empty:!reqData.requirementSummary}" v-html="reqData.requirementSummary ? renderMarkdown(reqData.requirementSummary) : '<i>暂无需求总结，点击下方按钮一键AI分析</i>'"></div>
                <div class="customer-footer">
                  <button class="customer-btn-ghost" @click="reqEditMode = true">✏️ 编辑</button>
                  <button class="customer-btn-primary" style="background:#7c3aed" @click="runReqAiAnalyze" :disabled="reqAiLoading">{{ reqAiLoading ? '⏳ 分析中...' : (reqData.requirementSummary ? '🔄 重新生成' : '🤖 客户需求分析') }}</button>
                </div>
              </div>
              <div v-else class="req-fields">
                <div class="req-field">
                  <div class="req-label">📝 需求总结</div>
                  <el-input v-model="reqData.requirementSummary" class="customer-input" type="textarea" :autosize="{minRows:5,maxRows:12}" placeholder="一段文字描述客户的意向产品、数量、目标价、交期及关注点" />
                </div>
                <div class="customer-footer">
                  <button class="customer-btn-ghost" @click="reqEditMode = false; loadReqData()">取消</button>
                  <button class="customer-btn-primary" @click="saveReqData" :disabled="reqSaving">💾 保存</button>
                </div>
              </div>
            </template>"""

new_body = """            <template v-else>
              <div class="req-alert" v-if="reqAiHint">
                <span style="color:#f59e0b">🤖 {{ reqAiHint }}</span>
              </div>
              <div class="req-fields">
                <div class="req-summary-text-block req-md-content" :class="{empty:!reqData.requirementSummary}" v-html="reqData.requirementSummary ? renderMarkdown(reqData.requirementSummary) : '<i>点击下方按钮，AI自动分析客户聊天记录，生成需求报告</i>'"></div>
                <div class="customer-footer req-footer-center">
                  <button class="customer-btn-primary req-big-btn" @click="runReqAiAnalyze" :disabled="reqAiLoading">
                    {{ reqAiLoading ? '⏳ AI分析中，请稍候...' : (reqData.requirementSummary ? '🔄 重新分析' : '🤖 一键AI客户分析') }}
                  </button>
                </div>
              </div>
            </template>"""
assert old_body in src, "body block not found"
src = src.replace(old_body, new_body, 1)

# === 修改3：追加傻瓜按钮居中+大按钮样式 ===
style_append = """
/* 需求分析傻瓜化样式 */
.req-footer-center { justify-content: center !important; }
.req-big-btn {
  background: linear-gradient(135deg, #7c3aed, #5b21b6) !important;
  padding: 10px 28px !important;
  font-size: 14px !important;
  border-radius: 24px !important;
  width: 100% !important;
  box-shadow: 0 2px 8px #7c3aed50;
}
.req-big-btn:hover:not(:disabled) { box-shadow: 0 4px 12px #7c3aed80; }
.req-big-btn:disabled { opacity: .7; cursor: wait; }
"""
# 找一个安全的地方追加CSS（在最后一个 } 前？更简单的是append到style末尾之前）
# 找 req-summary-text-block.empty 的样式末尾
marker = ".req-summary-text-block.empty { color: #8696a0; font-style: italic; }"
assert marker in src, "css marker not found"
src = src.replace(marker, marker + style_append, 1)

with open(path, 'w', encoding='utf-8') as f:
    f.write(src)
print("PATCH OK - 需求分析面板极简傻瓜化")
