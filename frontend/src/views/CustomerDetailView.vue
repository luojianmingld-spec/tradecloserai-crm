<template>
  <div class="cust-detail-page" v-if="customer">
    <!-- Header -->
    <div class="det-header">
      <button class="back-btn" @click="$router.push('/customers')">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
        <span>返回列表</span>
      </button>
      <div class="header-avatar" :style="{background: avatarColor(customer.companyName || customer.name)}">
        {{ (customer.companyName || customer.contactName || customer.name || '?')[0].toUpperCase() }}
      </div>
      <div class="header-info">
        <div class="h-row1">
          <h2 class="cust-title">{{ customer.companyName || customer.name || '(未命名)' }}</h2>
          <span class="level-tag" :class="'level-'+(customer.customerLevel||'c').toLowerCase()">{{ (customer.customerLevel||'C') }}级</span>
          <span class="status-tag" :class="'status-'+(customer.status||'new')">{{ statusLabel(customer.status) }}</span>
          <span class="stage-tag" :class="'stage-'+(customer.dealStage||'new')">{{ stageLabel(customer.dealStage) }}</span>
          <span v-if="customer.country" class="cust-flag">{{ countryFlag(customer.country) }} {{ customer.country }}</span>
          <span v-if="customer.contactName" class="contact-chip">👤 {{ customer.contactName }}</span>
        </div>
        <div class="h-row2">
          <span v-if="customer.title" class="muted">{{ customer.title }}</span>
          <span v-if="customer.industry" class="muted">· {{ customer.industry }}</span>
        </div>
      </div>
      <div class="spacer"></div>
      <div class="header-actions">
        <button class="action-btn wa-btn" @click="jumpToChat" title="WhatsApp沟通">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M16.75 13.96c.3.15.49.23.54.34.05.12.05.68-.17 1.35-.22.67-1.29 1.29-1.8 1.36-.5.08-1.13.12-1.83-.11-.41-.13-.93-.3-1.61-.59-2.83-1.22-4.67-4.06-4.81-4.25-.14-.19-1.16-1.53-1.16-2.92 0-1.39.73-2.07.99-2.36.26-.28.57-.35.76-.35.19 0 .38 0 .55.01.17.01.41-.07.64.49.23.56.78 1.94.85 2.08.07.14.11.3.02.49-.08.19-.14.3-.27.46-.13.16-.28.36-.4.48-.14.13-.28.27-.12.53.16.26.71 1.17 1.53 1.9 1.05.94 1.94 1.23 2.2 1.37.26.14.41.12.56-.07.15-.19.64-.75.81-1.01.17-.26.34-.22.58-.13.23.09 1.5.71 1.76.84z"/><path d="M12 2a10 10 0 00-8.5 15.25L2 22l4.86-1.28A10 10 0 1012 2zm0 18a8 8 0 01-4.09-1.13l-.29-.18-2.89.76.77-2.82-.19-.29A8 8 0 1112 20z"/></svg>
          <span>WhatsApp</span>
        </button>
        <button class="action-btn email-btn" @click="jumpToEmail" title="发送邮件">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>
          <span>Email</span>
        </button>
        <button class="action-btn edit-btn" @click="startEdit" v-if="!editing">
          <span>✏️</span><span>编辑</span>
        </button>
      </div>
    </div>

    <!-- Tabs -->
    <div class="det-tabs">
      <button v-for="t in tabs" :key="t.key" class="det-tab" :class="{active: activeTab===t.key}" @click="activeTab=t.key">{{ t.label }}</button>
    </div>

    <!-- Tab content -->
    <div class="det-body">
      <!-- Info Tab -->
      <div v-if="activeTab==='info'" class="tab-pane">
        <div v-if="editing" class="edit-panel">
          <div class="panel-title">✏️ 编辑客户信息</div>
          <div class="form-grid">
            <div class="fg"><label>公司名</label><el-input v-model="editForm.companyName" /></div>
            <div class="fg"><label>联系人</label><el-input v-model="editForm.contactName" /></div>
            <div class="fg"><label>职位</label><el-input v-model="editForm.title" /></div>
            <div class="fg"><label>国家</label><el-input v-model="editForm.country" /></div>
            <div class="fg"><label>城市/地址</label><el-input v-model="editForm.address" /></div>
            <div class="fg"><label>行业</label><el-input v-model="editForm.industry" /></div>
            <div class="fg"><label>采购产品</label><el-input v-model="editForm.requirementProducts" placeholder="如：Tempered Glass 8mm/10mm" /></div>
            <div class="fg"><label>WhatsApp</label><el-input v-model="editForm.jid" placeholder="如 97150xxx@s.whatsapp.net" /></div>
            <div class="fg"><label>电话</label><el-input v-model="editForm.phone" /></div>
            <div class="fg"><label>邮箱</label><el-input v-model="editForm.email" /></div>
            <div class="fg"><label>网站</label><el-input v-model="editForm.website" /></div>
            <div class="fg"><label>客户等级</label>
              <el-select v-model="editForm.customerLevel" style="width:100%">
                <el-option label="A 重点" value="A" /><el-option label="B 普通" value="B" /><el-option label="C 潜在" value="C" />
              </el-select>
            </div>
            <div class="fg"><label>客户来源</label>
              <el-select v-model="editForm.source" style="width:100%" allow-create filterable default-first-option>
                <el-option label="WhatsApp" value="whatsapp" />
                <el-option label="谷歌推广" value="google" />
                <el-option label="TikTok" value="tiktok" />
                <el-option label="Facebook" value="facebook" />
                <el-option label="Instagram" value="instagram" />
                <el-option label="LinkedIn" value="linkedin" />
                <el-option label="官网" value="website" />
                <el-option label="YouTube" value="youtube" />
                <el-option label="展会" value="展会" />
                <el-option label="客户推荐" value="referral" />
                <el-option label="手动添加" value="manual" />
                <el-option label="其他" value="other" />
              </el-select>
            </div>
          </div>
          <div class="fg-full"><label>备注</label><el-input v-model="editForm.notes" type="textarea" :rows="4" /></div>
          <div class="edit-actions">
            <el-button @click="cancelEdit">取消</el-button>
            <el-button type="primary" :loading="saving" @click="doSave">保存</el-button>
          </div>
        </div>

        <template v-else>
          <div class="info-grid">
          <div class="info-group">
            <div class="grp-title">📇 核心联系方式</div>
            <div class="info-row"><span class="ir-label">WhatsApp</span>
              <span class="ir-value">
                <span v-if="customer.jid">{{ customer.jid }}</span><span v-else class="muted">—</span>
                <button v-if="customer.jid" class="mini-btn" @click="copyText(customer.jid)">复制</button>
                <button v-if="customer.jid" class="mini-btn go" @click="jumpToChat">去沟通</button>
              </span>
            </div>
            <div class="info-row"><span class="ir-label">邮箱</span>
              <span class="ir-value">
                <span v-if="isAiField('email')" class="ai-badge" title="AI自动识别填充">🤖</span>
                <span v-if="customer.email">{{ customer.email }}</span><span v-else class="muted">—</span>
                <button v-if="customer.email" class="mini-btn" @click="copyText(customer.email)">复制</button>
                <button v-if="customer.email" class="mini-btn go" @click="jumpToEmail">发邮件</button>
              </span>
            </div>
            <div class="info-row"><span class="ir-label">电话</span>
              <span class="ir-value"><span v-if="customer.phone">{{ customer.phone }}</span><span v-else class="muted">—</span>
                <button v-if="customer.phone" class="mini-btn" @click="copyText(customer.phone)">复制</button>
              </span>
            </div>
            <div class="info-row"><span class="ir-label">网站</span>
              <span class="ir-value">
                <span v-if="isAiField('website')" class="ai-badge" title="AI自动识别填充">🤖</span>
                <a v-if="customer.website" :href="customer.website.startsWith('http')?customer.website:'https://'+customer.website" target="_blank" class="link">{{ customer.website }}</a>
                <span v-else class="muted">—</span>
                <button v-if="customer.website" class="mini-btn" @click="copyText(customer.website)">复制</button>
              </span>
            </div>
          </div>

          <div class="info-group">
            <div class="grp-title">🏢 公司信息</div>
            <div class="info-row"><span class="ir-label">公司名</span><span class="ir-value"><span v-if="isAiField('companyName')" class="ai-badge" title="AI自动识别填充">🤖</span>{{ customer.companyName || customer.company || '—' }}</span></div>
            <div class="info-row"><span class="ir-label">联系人</span><span class="ir-value"><span v-if="isAiField('contactName')" class="ai-badge" title="AI自动识别填充">🤖</span>{{ customer.contactName || '—' }}</span></div>
            <div class="info-row"><span class="ir-label">职位</span><span class="ir-value"><span v-if="isAiField('title')" class="ai-badge" title="AI自动识别填充">🤖</span>{{ customer.title || '—' }}</span></div>
            <div class="info-row"><span class="ir-label">国家</span><span class="ir-value"><span v-if="isAiField('country')" class="ai-badge" title="AI自动识别填充">🤖</span><span v-if="customer.country">{{ countryFlag(customer.country) }} {{ customer.country }}</span><span v-else class="muted">—</span></span></div>
            <div class="info-row"><span class="ir-label">地址</span><span class="ir-value"><span v-if="isAiField('address')" class="ai-badge" title="AI自动识别填充">🤖</span>{{ customer.address || '—' }}</span></div>
            <div class="info-row"><span class="ir-label">行业</span><span class="ir-value"><span v-if="isAiField('industry')" class="ai-badge" title="AI自动识别填充">🤖</span>{{ customer.industry || '—' }}</span></div>
          </div>

          <div class="info-group">
            <div class="grp-title">💼 业务信息</div>
            <div class="info-row"><span class="ir-label">来源</span><span class="ir-value">{{ sourceLabel(customer.source) }}</span></div>
            <div class="info-row"><span class="ir-label">客户等级</span>
              <span class="ir-value">
                <el-select v-model="customer.customerLevel" size="small" style="width:140px" @change="quickSaveLevel">
                  <el-option label="A 重点" value="A" /><el-option label="B 普通" value="B" /><el-option label="C 潜在" value="C" />
                </el-select>
              </span>
            </div>
            <div class="info-row"><span class="ir-label">状态</span><span class="ir-value">
              <el-select v-model="customer.status" size="small" style="width:140px" @change="quickSaveStatus">
                <el-option label="新客户" value="new" /><el-option label="待跟进" value="potential" />
                <el-option label="活跃" value="active" /><el-option label="跟进中" value="following" />
                <el-option label="沉睡" value="dormant" />
              </el-select>
            </span></div>
            <div class="info-row"><span class="ir-label">漏斗阶段</span><span class="ir-value">
              <el-select v-model="customer.dealStage" size="small" style="width:150px" @change="quickSaveStage">
                <el-option label="🆕 新询盘" value="new" />
                <el-option label="🔍 需求确认" value="qualified" />
                <el-option label="💰 报价中" value="quoting" />
                <el-option label="🤝 谈判/寄样" value="negotiating" />
                <el-option label="🎉 成交待付款" value="won" />
                <el-option label="✅ 已完成" value="completed" />
                <el-option label="❌ 已流失" value="lost" />
              </el-select>
            </span></div>
            <div class="info-row"><span class="ir-label">预估金额</span><span class="ir-value">
              <span v-if="customer.dealValue" style="color:#f59e0b;font-weight:600">${{ Math.round(customer.dealValue).toLocaleString() }}</span>
              <span v-else class="muted">—</span>
            </span></div>
            <div class="info-row"><span class="ir-label">采购产品</span><span class="ir-value"><span v-if="isAiField('requirementProducts')" class="ai-badge" title="AI自动识别填充">🤖</span><span v-if="customer.requirementProducts" class="prod-inline">{{ customer.requirementProducts }}</span><span v-else class="muted">—</span></span></div>
            <div class="info-row"><span class="ir-label">首次联系</span><span class="ir-value">{{ fmtDateTime(customer.firstContactAt) }}</span></div>
            <div class="info-row"><span class="ir-label">最近联系</span><span class="ir-value">{{ fmtDateTime(customer.lastContactAt) }}</span></div>
          </div>

          <div class="info-group">
            <div class="grp-title">🔍 AI 智能识别</div>
            <div class="ai-extract">
              <div class="ai-desc" v-if="customer.aiExtractedAt">上次AI识别：{{ fmtDateTime(customer.aiExtractedAt) }}</div>
              <div class="ai-desc muted" v-else>尚未识别，点击下方按钮从沟通记录自动抽取客户信息</div>
              <el-button type="primary" :loading="extracting" @click="doAIExtract" class="ai-btn">🤖 AI识别客户信息</el-button>
              <div v-if="aiResult" class="ai-result">
                <div class="ai-r-title">识别结果（点击采纳到表单）：</div>
                <div v-for="(v,k) in aiResult" :key="k" class="ai-r-row" v-if="v">
                  <span class="ai-r-label">{{ fieldLabel(k) }}</span>
                  <span class="ai-r-val">{{ v }}</span>
                  <button class="mini-btn go" @click="applyAIField(k,v)">采纳</button>
                </div>
                <el-button size="small" type="success" @click="applyAllAI">全部采纳并保存</el-button>
              </div>
            </div>
          </div>

          <!-- 🎯 需求总结模块 -->
          <div class="info-group full-row req-module" :class="{ 'ai-hint': reqAiDirty }">
            <div class="grp-title req-title">
              <span>🎯 需求总结</span>
              <span class="req-meta">
                <span v-if="customer.requirementUpdatedAt" class="muted req-updated">更新于 {{ relTime(customer.requirementUpdatedAt) }}</span>
                <span v-if="customer.requirementSource" class="req-source" :class="'src-'+customer.requirementSource">{{ customer.requirementSource === 'ai_summary' ? 'AI总结' : '手动' }}</span>
                <button class="mini-btn ai-req-btn" :disabled="aiReqLoading" @click="doAIRequirement">
                  <span v-if="aiReqLoading" class="spinner-mini"></span>
                  🤖 AI总结
                </button>
              </span>
            </div>

            <!-- 编辑态 -->
            <div v-if="reqEditing" class="req-form">
              <div v-if="reqAiDirty" class="ai-highlight">🤖 AI生成内容，请核对后保存</div>
              <div class="req-grid">
                <div class="fg"><label>📦 意向产品</label><el-input v-model="reqForm.requirementProducts" placeholder="如：Tempered Glass 8mm/10mm, Laminated Glass" /></div>
                <div class="fg"><label>🔢 数量</label><el-input v-model="reqForm.requirementQuantity" placeholder="如：500㎡/月" /></div>
                <div class="fg"><label>💰 目标价/预算</label><el-input v-model="reqForm.requirementBudget" placeholder="如：$15-18/㎡ FOB Shenzhen" /></div>
                <div class="fg"><label>📅 交期要求</label><el-input v-model="reqForm.requirementDelivery" placeholder="如：30天内发货" /></div>
              </div>
              <div class="fg-full"><label>📝 需求详情</label><el-input v-model="reqForm.requirementSummary" type="textarea" :rows="5" placeholder="客户完整需求、关注点、特殊要求等..." /></div>
              <div class="req-actions">
                <el-button @click="cancelReqEdit">取消</el-button>
                <el-button type="success" :loading="reqSaving" @click="saveRequirement" style="background:var(--mgmt-whatsapp);border-color:var(--mgmt-whatsapp);">💾 保存</el-button>
              </div>
            </div>

            <!-- 展示态 -->
            <div v-else class="req-view">
              <template v-if="hasRequirement">
                <div class="req-row4">
                  <div class="req-cell"><span class="rc-label">📦 产品</span><span class="rc-value">{{ customer.requirementProducts || '—' }}</span></div>
                  <div class="req-cell"><span class="rc-label">🔢 数量</span><span class="rc-value">{{ customer.requirementQuantity || '—' }}</span></div>
                  <div class="req-cell"><span class="rc-label">💰 预算</span><span class="rc-value">{{ customer.requirementBudget || '—' }}</span></div>
                  <div class="req-cell"><span class="rc-label">📅 交期</span><span class="rc-value">{{ customer.requirementDelivery || '—' }}</span></div>
                </div>
                <div v-if="customer.requirementSummary" class="req-summary-box">
                  <template v-if="parsedSummary && parsedSummary.sections && parsedSummary.sections.length">
                    <!-- AI结构化JSON格式 -->
                    <template v-for="(sec, sIdx) in parsedSummary.sections" :key="sIdx">
                      <!-- 文本段 -->
                      <div v-if="sec.type === 'text' && !isAllEmptyText(sec.content)" class="sec-text">
                        <span v-if="sec.icon" class="sec-icon">{{ sec.icon }}</span>
                        <span v-if="sec.title" class="sec-title">{{ sec.title }}</span>
                        <div class="sec-content">{{ sec.content }}</div>
                      </div>
                      <!-- 表格段（全"未提及"则隐藏，部分有值才显示） -->
                      <div v-else-if="sec.type === 'table' && sec.rows && meaningfulRows(sec.rows).length" class="sec-table">
                        <div class="sec-hdr">
                          <span v-if="sec.icon" class="sec-icon">{{ sec.icon }}</span>
                          <span v-if="sec.title" class="sec-title">{{ sec.title }}</span>
                        </div>
                        <div class="sec-rows">
                          <div v-for="(row, rIdx) in meaningfulRows(sec.rows)" :key="rIdx" class="sec-row">
                            <span class="sec-label">{{ row.label }}</span>
                            <span class="sec-val">{{ row.value }}</span>
                          </div>
                        </div>
                      </div>
                    </template>
                    <!-- 所有section都没实质内容时 -->
                    <div v-if="!hasMeaningfulContent(parsedSummary)" class="sec-empty">暂无可识别的采购需求，建议先与客户建立沟通</div>
                  </template>
                  <!-- 纯文本格式（老数据兼容） -->
                  <template v-else>{{ customer.requirementSummary }}</template>
                </div>
                <div class="req-view-actions">
                  <button class="mini-btn" @click="startReqEdit">✏️ 编辑</button>
                </div>
              </template>
              <div v-else class="req-empty muted">
                暂无需求记录，<a href="javascript:void(0)" @click="startReqEdit">点击编辑</a>添加或使用<a href="javascript:void(0)" @click="doAIRequirement">🤖 AI总结</a>
              </div>
            </div>
          </div>

          <div class="info-group full-row">
            <div class="grp-title">🗒️ 备注</div>
            <div class="notes-box">{{ customer.notes || '—' }}</div>
          </div>

          <div class="info-group full-row">
            <div class="grp-title">ℹ️ 系统信息</div>
            <div class="info-row"><span class="ir-label">创建时间</span><span class="ir-value">{{ fmtDateTime(customer.createdAt) }}</span></div>
            <div class="info-row"><span class="ir-label">更新时间</span><span class="ir-value">{{ fmtDateTime(customer.updatedAt) }}</span></div>
            <div class="info-row"><span class="ir-label">ID</span><span class="ir-value muted">{{ customer.id }}</span></div>
          </div>
          </div><!-- /info-grid -->
        </template>
      </div>

      <!-- Chat Tab -->
      <div v-if="activeTab==='chat'" class="tab-pane">
        <div class="tab-toolbar">
          <el-button type="primary" @click="jumpToChat">💬 打开沟通窗口</el-button>
          <span class="muted" v-if="customer._stats">共 {{ customer._stats.messageCount }} 条消息</span>
        </div>
        <div v-if="!customer._lastMessages || !customer._lastMessages.length" class="empty-state">
          <div style="font-size:40px;opacity:0.3">💬</div>
          <div class="empty-desc">暂无沟通记录</div>
        </div>
        <div v-else class="msg-list">
          <div v-for="m in customer._lastMessages" :key="m.id" class="msg-item" :class="{'out': m.direction==='outbound'||m.direction==='outgoing'}">
            <div class="msg-bubble">
              <div class="msg-meta">{{ m.direction==='outbound'||m.direction==='outgoing'?'我':'客户' }} · {{ fmtTime(m.timestamp) }}</div>
              <div class="msg-body">{{ m.body }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Documents Tab -->
      <div v-if="activeTab==='docs'" class="tab-pane">
        <div class="docs-toolbar">
          <div class="docs-title">📄 客户单证</div>
          <div class="docs-kpi muted" v-if="docStats">共{{ docStats.total }}份 · ${{ fmtMoney(docStats.totalAmount) }} · <span style="color:#f59e0b">待确认{{ docStats.pending }}份</span></div>
          <div class="spacer"></div>
          <el-dropdown trigger="click" @command="newDoc">
            <el-button type="primary" class="new-doc-btn"><span>📝 新建单证</span></el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="PI">📋 PI形式发票</el-dropdown-item>
                <el-dropdown-item command="QUOTATION">🧾 报价单</el-dropdown-item>
                <el-dropdown-item disabled command="CI" divided>📦 商业发票（即将推出）</el-dropdown-item>
                <el-dropdown-item disabled command="CONTRACT">📑 合同（即将推出）</el-dropdown-item>
                <el-dropdown-item disabled command="PL">📦 装箱单（即将推出）</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
        <div class="doc-filter-tabs">
          <button v-for="t in docTabs" :key="t.k" class="df-tab" :class="{active:docFilter===t.k,disabled:t.disabled}" :disabled="t.disabled" @click="docFilter=t.k;loadDocs()">{{ t.label }}</button>
        </div>
        <div v-if="docsLoading" class="empty-state">加载中...</div>
        <div v-else-if="!docs.length" class="empty-state">
          <div style="font-size:40px;opacity:0.3">📄</div>
          <div class="empty-desc">还没有单证，点击右上角📝新建第一份PI或报价单</div>
        </div>
        <div v-else class="doc-list">
          <div v-for="d in docs" :key="d.id" class="doc-card">
            <div class="doc-row1">
              <span class="doc-num">📋 {{ d.docNumber }}</span>
              <span class="doc-status" :class="'st-'+(d.status||'DRAFT').toLowerCase()">{{ docStatusLabel(d.status) }}</span>
              <span class="spacer"></span>
              <span class="doc-amount">${{ fmtMoney(d.totalAmount) }}</span>
            </div>
            <div class="doc-row2 muted">
              {{ docTypeLabel(d.type) }} · {{ fmtDate(d.issueDate) }}
              <span v-if="d.validUntil"> · 至 {{ fmtDate(d.validUntil) }}</span>
            </div>
            <div class="doc-actions">
              <button class="mini-btn" @click="$router.push(`/customers/${customer.id}/documents/${d.id}/edit`)">编辑</button>
              <button class="mini-btn" @click="previewDoc(d)">预览打印</button>
              <button class="mini-btn" @click="duplicateDoc(d)">复制</button>
              <button class="mini-btn" @click="sendDoc(d)">发送</button>
              <button class="mini-btn danger" @click="deleteDoc(d)">删除</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Follow-ups Tab -->
      <div v-if="activeTab==='follow'" class="tab-pane">
        <div class="fu-toolbar">
          <div class="docs-title">📝 跟进记录</div>
          <div class="spacer"></div>
          <el-button type="primary" :loading="genLoading" @click="generateFollowUps">🤖 AI智能总结</el-button>
          <el-button @click="showManualFu = true">+ 手动添加</el-button>
        </div>
        <div v-if="fuLoading" class="empty-state">加载中...</div>
        <div v-else-if="!followUps.length" class="empty-state">
          <div style="font-size:40px;opacity:0.3">📝</div>
          <div class="empty-desc">暂无跟进记录，点击上方🤖AI智能总结从沟通记录中自动生成</div>
        </div>
        <div v-else class="timeline">
          <div v-for="f in followUps" :key="f.id" class="tl-item">
            <div class="tl-dot" :class="{'ai': f.source==='ai_summary'}"></div>
            <div class="tl-content">
              <div class="tl-meta">
                <span>{{ fmtDateTime(f.createdAt) }}</span>
                <span v-if="f.source==='ai_summary'" class="tl-tag ai">🤖 AI</span>
                <span v-else class="tl-tag manual">✍️ 手动</span>
                <span class="spacer"></span>
                <button v-if="f.source==='manual'" class="mini-btn danger" @click="deleteFu(f)">删除</button>
              </div>
              <div class="tl-text">{{ f.content }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Manual follow-up dialog -->
    <el-dialog v-model="showManualFu" title="添加跟进记录" width="520px" :append-to-body="true">
      <el-input v-model="manualFuContent" type="textarea" :rows="4" placeholder="记录本次跟进要点..." />
      <template #footer>
        <el-button @click="showManualFu=false">取消</el-button>
        <el-button type="primary" @click="addManualFu">添加</el-button>
      </template>
    </el-dialog>
  </div>

  <div v-else class="cust-detail-page"><div class="loading">加载中...</div></div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useChatStore } from '../stores/chat.js';
import { ElMessage, ElMessageBox } from 'element-plus';
import api from '../utils/api.js';

const router = useRouter();
const route = useRoute();
const chatStore = useChatStore();
const customerId = computed(() => route.params.id);

const customer = ref(null);
const loading = ref(false);
const activeTab = ref('info');
const editing = ref(false);
const editForm = reactive({});
const saving = ref(false);
const extracting = ref(false);
const aiResult = ref(null);

// 需求总结
const reqEditing = ref(false);
const reqSaving = ref(false);
const aiReqLoading = ref(false);
const reqAiDirty = ref(false);
const reqForm = reactive({
  requirementSummary: '',
  requirementProducts: '',
  requirementBudget: '',
  requirementQuantity: '',
  requirementDelivery: '',
});
const hasRequirement = computed(() => {
  const c = customer.value;
  if (!c) return false;
  return !!(c.requirementSummary || c.requirementProducts || c.requirementBudget || c.requirementQuantity || c.requirementDelivery);
});
// 解析AI生成的结构化JSON需求
const parsedSummary = computed(() => {
  const raw = customer.value?.requirementSummary;
  if (!raw) return null;
  if (typeof raw !== 'string') return raw;
  const t = raw.trim();
  if (!t.startsWith('{')) return null;
  try { return JSON.parse(t); } catch { return null; }
});
// 判断文本是否全是"未提及/暂无/待确认"类空信息
function isEmptyVal(v) {
  if (!v) return true;
  const s = String(v).trim();
  if (!s || s === '—' || s === '-' || s === '/') return true;
  return /^(未提及|暂无|待确认|未知|无|none|n\/?a|不详)[\s，,。.（(\s]*推测?[\s）)\S]*$/.test(s) || /^未提及/.test(s);
}
function meaningfulRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.filter(r => r && !isEmptyVal(r.value));
}
function isAllEmptyText(s) {
  return isEmptyVal(s);
}
function hasMeaningfulContent(ps) {
  if (!ps || !ps.sections) return false;
  for (const sec of ps.sections) {
    if (sec.type === 'text' && !isEmptyVal(sec.content)) return true;
    if (sec.type === 'table' && Array.isArray(sec.rows) && meaningfulRows(sec.rows).length) return true;
  }
  return false;
}
function relTime(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return Math.floor(diff/60000) + '分钟前';
  if (diff < 86400000) return Math.floor(diff/3600000) + '小时前';
  if (diff < 86400000*30) return Math.floor(diff/86400000) + '天前';
  return new Date(iso).toLocaleDateString('zh-CN');
}
function startReqEdit() {
  Object.assign(reqForm, {
    requirementSummary: customer.value.requirementSummary || '',
    requirementProducts: customer.value.requirementProducts || '',
    requirementBudget: customer.value.requirementBudget || '',
    requirementQuantity: customer.value.requirementQuantity || '',
    requirementDelivery: customer.value.requirementDelivery || '',
  });
  reqEditing.value = true;
  reqAiDirty.value = false;
}
function cancelReqEdit() {
  reqEditing.value = false;
  reqAiDirty.value = false;
}
async function saveRequirement() {
  reqSaving.value = true;
  try {
    const payload = {
      requirementSummary: reqForm.requirementSummary,
      requirementProducts: reqForm.requirementProducts,
      requirementBudget: reqForm.requirementBudget,
      requirementQuantity: reqForm.requirementQuantity,
      requirementDelivery: reqForm.requirementDelivery,
      requirementSource: reqAiDirty.value ? 'ai_summary' : 'manual',
    };
    const { data } = await api.put(`/customers/${customerId.value}`, payload);
    customer.value = { ...customer.value, ...data };
    reqEditing.value = false;
    reqAiDirty.value = false;
    ElMessage.success('需求总结已保存');
  } catch(e) {
    ElMessage.error(e?.response?.data?.error || '保存失败');
  } finally { reqSaving.value = false; }
}
async function doAIRequirement() {
  if (!customer.value.jid) { ElMessage.warning('该客户没有WhatsApp沟通记录，无法AI总结'); return; }
  aiReqLoading.value = true;
  try {
    const { data } = await api.post(`/customers/${customerId.value}/ai-requirement`, { limit: 50 });
    Object.assign(reqForm, {
      requirementSummary: data.summary || '',
      requirementProducts: data.products || '',
      requirementBudget: data.budget || '',
      requirementQuantity: data.quantity || '',
      requirementDelivery: data.delivery || '',
    });
    reqEditing.value = true;
    reqAiDirty.value = true;
    ElMessage.success('AI总结已生成，请核对后保存');
  } catch(e) {
    ElMessage.error(e?.response?.data?.error || 'AI总结失败');
  } finally { aiReqLoading.value = false; }
}

const tabs = [
  { key: 'info', label: '👤 信息' },
  { key: 'chat', label: '💬 沟通记录' },
  { key: 'docs', label: '📄 单证' },
  { key: 'follow', label: '📝 跟进' },
];

// Docs
const docs = ref([]);
const docFilter = ref('all');
const docsLoading = ref(false);
const docStats = ref(null);
const docTabs = [
  { k:'all', label:'全部' }, { k:'PI', label:'PI' }, { k:'QUOTATION', label:'报价单' },
  { k:'CI', label:'CI', disabled:true }, { k:'CONTRACT', label:'合同', disabled:true }, { k:'PL', label:'装箱单', disabled:true },
];

// Follow-ups
const followUps = ref([]);
const fuLoading = ref(false);
const genLoading = ref(false);
const showManualFu = ref(false);
const manualFuContent = ref('');

function avatarColor(name) {
  if (!name) return 'var(--mgmt-whatsapp)';
  const palette = ['var(--mgmt-whatsapp)','#4FC3F7','#AB47BC','#FF7043','#66BB6A','#FFA726','#EC407A','#26A69A','#EF5350','#5C6BC0'];
  let hash = 0;
  for (let i=0;i<name.length;i++) hash = name.charCodeAt(i) + ((hash<<5) - hash);
  return palette[Math.abs(hash) % palette.length];
}
function statusLabel(s){ return ({active:'活跃',following:'跟进中',dormant:'沉睡',potential:'待跟进',new:'新客户'})[s] || s || '新'; }
function stageLabel(s){ return ({new:'🆕 新询盘',qualified:'🔍 需求确认',quoting:'💰 报价中',negotiating:'🤝 谈判',won:'🎉 成交',completed:'✅ 完成',lost:'❌ 流失'})[s] || '🆕 新询盘'; }
function docStatusLabel(s){ return ({DRAFT:'草稿',SENT:'已发送',CONFIRMED:'已确认'})[s] || s; }
function docTypeLabel(t){ return ({PI:'PI形式发票',QUOTATION:'报价单',CI:'商业发票'})[t] || t; }
function countryFlag(c){
  if(!c)return '🌍';
  const map={UAE:'🇦🇪','阿联酋':'🇦🇪','China':'🇨🇳','中国':'🇨🇳','USA':'🇺🇸','美国':'🇺🇸','UK':'🇬🇧','英国':'🇬🇧','India':'🇮🇳','印度':'🇮🇳','Saudi':'🇸🇦','沙特':'🇸🇦','Germany':'🇩🇪','德国':'🇩🇪','France':'🇫🇷','法国':'🇫🇷','Turkey':'🇹🇷','土耳其':'🇹🇷','Egypt':'🇪🇬','埃及':'🇪🇬','Brazil':'🇧🇷','巴西':'🇧🇷','Russia':'🇷🇺','俄罗斯':'🇷🇺','Japan':'🇯🇵','日本':'🇯🇵','Korea':'🇰🇷','韩国':'🇰🇷','Italy':'🇮🇹','意大利':'🇮🇹','Spain':'🇪🇸','西班牙':'🇪🇸','Pakistan':'🇵🇰','巴基斯坦':'🇵🇰','Bangladesh':'🇧🇩','孟加拉':'🇧🇩','Nigeria':'🇳🇬','尼日利亚':'🇳🇬','South Africa':'🇿🇦','南非':'🇿🇦','Kenya':'🇰🇪','肯尼亚':'🇰🇪','Mexico':'🇲🇽','墨西哥':'🇲🇽','Canada':'🇨🇦','加拿大':'🇨🇦','Australia':'🇦🇺','澳大利亚':'🇦🇺'};
  for(const k in map) if(c.toLowerCase().includes(k.toLowerCase())) return map[k];
  return '🌍';
}
function fmtDateTime(iso){ if(!iso)return '—'; try{const d=new Date(iso);return d.toLocaleString('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});}catch{return '—';} }
function fmtDate(iso){ if(!iso)return '—'; try{return new Date(iso).toISOString().slice(0,10);}catch{return '—';} }
function fmtTime(iso){ if(!iso)return ''; try{return new Date(iso).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'});}catch{return '';} }
function fmtMoney(n){ if(n==null)return '0.00'; return Number(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function copyText(t){ navigator.clipboard?.writeText(t); ElMessage.success('已复制'); }
function fieldLabel(k){ return ({companyName:'公司名',contactName:'联系人',country:'国家',title:'职位',email:'邮箱',website:'网站',address:'地址',industry:'行业',source:'来源',notes:'备注',requirementProducts:'采购产品'})[k] || k; }
function isAiField(k){ try{ const arr = customer.value.aiAutoFields ? JSON.parse(customer.value.aiAutoFields) : []; return Array.isArray(arr) && arr.includes(k); }catch{ return false; } }

async function load() {
  loading.value = true;
  try {
    const { data } = await api.get(`/customers/${customerId.value}`);
    customer.value = data;
    Object.assign(editForm, data);
    loadDocs();
    loadFollowUps();
  } catch(e) {
    ElMessage.error('加载客户信息失败');
  } finally { loading.value = false; }
}
function sourceLabel(s){const m={whatsapp:'WhatsApp',google:'谷歌推广',tiktok:'TikTok',facebook:'Facebook',instagram:'Instagram',linkedin:'LinkedIn',website:'官网',youtube:'YouTube','展会':'展会',referral:'客户推荐','老客户推荐':'客户推荐','独立站询盘':'官网',proactive:'主动开发',email:'邮件营销',manual:'手动添加',other:'其他'};return m[s]||s||'—';}

function startEdit(){
  Object.assign(editForm, JSON.parse(JSON.stringify(customer.value)));
  editing.value = true; aiResult.value = null;
}
function cancelEdit(){ editing.value=false; aiResult.value=null; }
async function doSave(){
  saving.value = true;
  try {
    const { data } = await api.put(`/customers/${customerId.value}`, editForm);
    customer.value = { ...customer.value, ...data };
    editing.value = false; aiResult.value = null;
    ElMessage.success('已保存');
  } catch(e) { ElMessage.error('保存失败'); } finally { saving.value = false; }
}
async function quickSaveLevel(v){ await api.put(`/customers/${customerId.value}`, { customerLevel: v }); ElMessage.success('等级已更新'); }
async function quickSaveStage(v){
  try {
    await api.patch(`/customers/${customerId.value}/stage`, { stage: v });
    ElMessage.success('阶段已更新');
    await loadCustomer();
  } catch(e) { ElMessage.error('更新失败：' + (e.response?.data?.error || e.message)); }
}
async function quickSaveStatus(v){ await api.put(`/customers/${customerId.value}`, { status: v }); ElMessage.success('状态已更新'); }

async function doAIExtract() {
  if (!customer.value.jid) { ElMessage.warning('该客户没有WhatsApp JID，无法从沟通识别'); return; }
  extracting.value = true; aiResult.value = null;
  try {
    const jid = encodeURIComponent(customer.value.jid);
    const { data } = await api.post(`/customers/by-jid/${jid}/extract-ai`, { limit: 30 });
    aiResult.value = data;
    ElMessage.success('识别完成，请选择采纳字段');
  } catch(e) { ElMessage.error('AI识别失败'); }
  finally { extracting.value = false; }
}
function applyAIField(k, v) {
  editForm[k] = v;
  if (!editing.value) startEdit();
  ElMessage.success(`已填入${fieldLabel(k)}`);
}
async function applyAllAI() {
  if (!editing.value) startEdit();
  for (const k in aiResult.value) { if (aiResult.value[k]) editForm[k] = aiResult.value[k]; }
  await doSave();
}

// Jump to chat
async function jumpToChat() {
  if (!customer.value.jid) {
    ElMessage.warning('该客户暂无WhatsApp号码，请先编辑添加JID');
    return;
  }
  await router.push('/chat');
  // Let LayoutView/ChatView pick up target jid via sessionStorage
  sessionStorage.setItem('wa-open-jid', customer.value.jid);
}
async function jumpToEmail() {
  if (!customer.value.email) { ElMessage.warning('该客户暂无邮箱'); return; }
  await router.push('/emails');
  sessionStorage.setItem('email-open-addr', customer.value.email);
}

// Docs
async function loadDocs() {
  docsLoading.value = true;
  try {
    const params = {};
    if (docFilter.value !== 'all') params.type = docFilter.value;
    const qs = new URLSearchParams(params).toString();
    const { data } = await api.get(`/customers/${customerId.value}/documents?${qs}`);
    docs.value = data.items || [];
    docStats.value = data.stats || {};
  } catch(e) { /* ignore */ }
  finally { docsLoading.value = false; }
}
function newDoc(type) {
  router.push(`/customers/${customerId.value}/documents/new?type=${type}`);
}
function previewDoc(d) {
  window.open(`/documents/${d.id}/print`, '_blank');
}
async function duplicateDoc(d) {
  try {
    await api.post(`/documents/${d.id}/duplicate`);
    ElMessage.success('已复制');
    loadDocs();
  } catch(e) { ElMessage.error('复制失败'); }
}
function sendDoc() { ElMessage.info('发送功能即将开放'); }
async function deleteDoc(d) {
  try {
    await ElMessageBox.confirm(`确认删除单证 ${d.docNumber} 吗？`, '确认', { type:'warning' });
    await api.delete(`/documents/${d.id}`);
    ElMessage.success('已删除');
    loadDocs();
  } catch(e) { /* cancelled */ }
}

// Follow-ups
async function loadFollowUps() {
  fuLoading.value = true;
  try {
    const { data } = await api.get(`/customers/${customerId.value}/follow-ups`);
    followUps.value = data || [];
  } catch(e) {} finally { fuLoading.value = false; }
}
async function generateFollowUps() {
  genLoading.value = true;
  try {
    const { data } = await api.post(`/customers/${customerId.value}/generate-followups`, {});
    ElMessage.success(`AI总结完成，生成${data.generated}条记录`);
    loadFollowUps();
  } catch(e) { ElMessage.error(e?.response?.data?.error || 'AI总结失败'); }
  finally { genLoading.value = false; }
}
async function addManualFu() {
  if (!manualFuContent.value.trim()) return;
  try {
    await api.post(`/customers/${customerId.value}/follow-ups`, { content: manualFuContent.value.trim(), source: 'manual' });
    manualFuContent.value = ''; showManualFu.value = false;
    ElMessage.success('已添加'); loadFollowUps();
  } catch(e) { ElMessage.error('添加失败'); }
}
async function deleteFu(f) {
  try {
    await ElMessageBox.confirm('删除这条跟进记录？', '确认', { type:'warning' });
    await api.delete(`/customers/follow-ups/${f.id}`);
    loadFollowUps();
  } catch(e) {}
}

onMounted(load);
</script>

<style scoped>
.cust-detail-page { flex:1; display:flex; flex-direction:column; background:var(--mgmt-bg); color:var(--mgmt-text); height:100%; overflow:hidden; min-width:0; }
.det-header { display:flex; align-items:center; gap:14px; padding:14px 20px; background:var(--mgmt-card-bg); border-bottom:1px solid var(--mgmt-divider); flex-shrink:0; flex-wrap:wrap; }
.back-btn { display:flex; align-items:center; gap:6px; background:transparent; border:1px solid var(--mgmt-input-border); color:var(--mgmt-text-secondary); padding:8px 14px; border-radius:6px; cursor:pointer; font-size:14px; transition:all .2s; }
.back-btn:hover { background:var(--mgmt-bg); border-color:var(--mgmt-input-border-hover); color:var(--mgmt-text); }
.header-avatar { width:52px; height:52px; border-radius:50%; display:flex; align-items:center; justify-content:center; color:#fff; font-weight:700; font-size:22px; flex-shrink:0; }
.header-info { flex:1; min-width:200px; }
.h-row1 { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.cust-title { margin:0; font-size:18px; font-weight:600; color:var(--mgmt-text); }
.level-tag { padding:2px 10px; border-radius:4px; font-size:12px; font-weight:500; }
.level-tag.level-a { background:var(--mgmt-tag-red-bg); color:var(--mgmt-tag-red); border:1px solid var(--mgmt-tag-red-border); }
.level-tag.level-b { background:var(--mgmt-tag-orange-bg); color:var(--mgmt-tag-orange); border:1px solid var(--mgmt-tag-orange-border); }
.level-tag.level-c { background:var(--mgmt-tag-gray-bg); color:var(--mgmt-text-muted); border:1px solid var(--mgmt-tag-gray-border); }
.level-tag.level-d { background:var(--mgmt-tag-blue-bg); color:var(--mgmt-tag-blue); border:1px solid var(--mgmt-tag-blue-border); }
.status-tag { padding:2px 10px; border-radius:4px; font-size:12px; font-weight:500; }
.status-tag.status-active { background:var(--mgmt-tag-green-bg); color:var(--mgmt-tag-green); border:1px solid var(--mgmt-tag-green-border); }
.status-tag.status-following { background:var(--mgmt-tag-orange-bg); color:var(--mgmt-tag-orange); border:1px solid var(--mgmt-tag-orange-border); }
.status-tag.status-dormant { background:var(--mgmt-tag-gray-bg); color:var(--mgmt-text-muted); border:1px solid var(--mgmt-tag-gray-border); }
.status-tag.status-potential { background:var(--mgmt-tag-red-bg); color:var(--mgmt-tag-red); border:1px solid var(--mgmt-tag-red-border); }
.status-tag.status-new { background:var(--mgmt-tag-purple-bg); color:var(--mgmt-tag-purple); border:1px solid var(--mgmt-tag-purple-border); }
.cust-flag { font-size:15px; color:var(--mgmt-text-muted); }
.contact-chip { color:var(--mgmt-text-muted); font-size:13px; }
.h-row2 { font-size:13px; margin-top:4px; color:var(--mgmt-text-muted); }
.muted { color:var(--mgmt-text-muted); }
.prod-inline { display:inline-block; background:var(--mgmt-tag-blue-bg); color:var(--mgmt-tag-blue); padding:2px 10px; border-radius:4px; font-size:12px; font-weight:500; border:1px solid var(--mgmt-tag-blue-border); }
.ai-badge { display:inline-flex; align-items:center; font-size:11px; margin-right:4px; opacity:0.8; cursor:help; }
.spacer { flex:1; }
.header-actions { display:flex; gap:8px; }
.action-btn { display:inline-flex; align-items:center; gap:6px; padding:8px 14px; border-radius:6px; border:1px solid var(--mgmt-input-border); background:var(--mgmt-card-bg); color:var(--mgmt-text-secondary); font-size:13px; cursor:pointer; min-height:36px; transition:all .2s; }
.action-btn:hover { background:var(--mgmt-bg); border-color:var(--mgmt-input-border-hover); color:var(--mgmt-text); }
.wa-btn { background:var(--mgmt-whatsapp) !important; border-color:var(--mgmt-whatsapp) !important; color:#fff !important; }
.wa-btn:hover { background:var(--mgmt-whatsapp-hover) !important; border-color:var(--mgmt-whatsapp-hover) !important; }
.email-btn { background:var(--mgmt-email) !important; border-color:var(--mgmt-email) !important; color:#fff !important; }
.email-btn:hover { background:var(--mgmt-email) !important; }

.det-tabs { display:flex; gap:4px; padding:0 20px; background:var(--mgmt-card-bg); border-bottom:1px solid var(--mgmt-divider); flex-shrink:0; overflow-x:auto; }
.det-tab { background:transparent; border:none; color:var(--mgmt-text-muted); padding:12px 18px; cursor:pointer; font-size:14px; border-bottom:2px solid transparent; white-space:nowrap; transition:color .2s; }
.det-tab.active { color:var(--mgmt-tag-blue); border-bottom-color:var(--mgmt-tag-blue); font-weight:500; }
.det-tab:hover:not(.active) { color:var(--mgmt-text); background:var(--mgmt-bg); }

.det-body { flex:1; overflow-y:auto; overflow-x:hidden; padding:16px 20px; min-width:0; }
@media (max-width:768px) { .det-body { padding:12px; } .det-header { padding:12px 16px; } .det-tabs { padding:0 16px; } .info-grid { gap:10px; } }
@media (max-width:768px) { .det-body { padding:12px; } .det-header { padding:12px 16px; } .det-tabs { padding:0 16px; } .info-grid { gap:10px; } }
.tab-pane { max-width:100%; margin:0; }
.info-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
.info-grid .info-group { margin-bottom:0; }
.info-grid .info-group.full-row { grid-column:1/-1; }

/* Info */
.info-group { background:var(--mgmt-card-bg); border-radius:6px; padding:16px 20px; margin-bottom:0; border:1px solid var(--mgmt-divider); box-shadow:var(--mgmt-shadow); }
.grp-title { font-weight:600; font-size:14px; margin-bottom:12px; color:var(--mgmt-text); padding-bottom:8px; border-bottom:1px solid var(--mgmt-divider); display:flex; align-items:center; gap:6px; }
.info-row { display:flex; padding:8px 0; border-bottom:1px solid var(--mgmt-divider); font-size:13px; gap:10px; align-items:center; }
.info-row:last-child { border-bottom:none; }
.ir-label { width:90px; color:var(--mgmt-text-muted); flex-shrink:0; font-size:13px; }
.ir-value { flex:1; color:var(--mgmt-text); word-break:break-word; display:flex; align-items:center; gap:6px; flex-wrap:wrap; font-size:13px; }
.link { color:var(--mgmt-tag-blue); text-decoration:none; }
.link:hover { text-decoration:underline; }
.mini-btn { background:var(--mgmt-card-bg); border:1px solid var(--mgmt-input-border); color:var(--mgmt-text-secondary); padding:3px 10px; border-radius:4px; cursor:pointer; font-size:12px; transition:all .2s; }
.mini-btn:hover { background:var(--mgmt-bg); border-color:var(--mgmt-input-border-hover); color:var(--mgmt-text); }
.mini-btn.go { color:var(--mgmt-tag-green); border-color:#c2e7b0; background:var(--mgmt-tag-green-bg); }
.mini-btn.go:hover { background:var(--mgmt-tag-green-border); }
.mini-btn.danger { color:#f87171; border-color:#dc2626; }
.mini-btn.danger:hover { background:rgba(220,38,38,0.15); }
.notes-box { background:var(--mgmt-bg); padding:12px; border-radius:4px; color:var(--mgmt-text); font-size:14px; min-height:60px; white-space:pre-wrap; border:1px solid var(--mgmt-divider); }

/* Edit panel */
.edit-panel { background:var(--mgmt-card-bg); border-radius:6px; padding:20px; border:1px solid var(--mgmt-divider); box-shadow:var(--mgmt-shadow); }
.panel-title { font-weight:600; font-size:16px; color:var(--mgmt-text); margin-bottom:18px; padding-bottom:12px; border-bottom:1px solid var(--mgmt-divider); }
.form-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px 24px; }
.fg { display:flex; flex-direction:column; gap:6px; }
.fg label { color:var(--mgmt-text-secondary); font-size:14px; font-weight:500; margin-bottom:2px; }
.fg-full { margin-top:16px; display:flex; flex-direction:column; gap:6px; }
.fg-full label { color:var(--mgmt-text-secondary); font-size:14px; margin-bottom:6px; font-weight:500; }
.edit-actions { margin-top:20px; display:flex; gap:10px; justify-content:flex-end; padding-top:16px; border-top:1px solid var(--mgmt-divider); }
/* 扁平白底输入框：参考图风格 */
:deep(.edit-panel .el-input__wrapper) {
  background:var(--mgmt-card-bg) !important;
  box-shadow:0 0 0 1px var(--mgmt-input-border) inset !important;
  border-radius:4px !important;
  padding:0 12px !important;
  min-height:36px !important;
  transition:border-color .2s, box-shadow .2s;
}
:deep(.edit-panel .el-input__wrapper:hover) { box-shadow:0 0 0 1px var(--mgmt-input-border-hover) inset !important; }
:deep(.edit-panel .el-input__wrapper.is-focus) { box-shadow:0 0 0 1px var(--accent-info,var(--mgmt-tag-blue)) inset !important; }
:deep(.edit-panel .el-input__inner) {
  color:var(--mgmt-text) !important;
  font-size:14px !important;
  height:36px !important;
  line-height:36px !important;
}
:deep(.edit-panel .el-input__inner::placeholder) { color:var(--mgmt-text-placeholder) !important; }
:deep(.edit-panel .el-textarea__inner) {
  background:var(--mgmt-card-bg) !important;
  color:var(--mgmt-text) !important;
  border:1px solid var(--mgmt-input-border) !important;
  border-radius:4px !important;
  padding:8px 12px !important;
  font-family:inherit !important;
  font-size:14px !important;
  min-height:80px !important;
  line-height:1.5 !important;
}
:deep(.edit-panel .el-textarea__inner:hover) { border-color:var(--mgmt-input-border-hover) !important; }
:deep(.edit-panel .el-textarea__inner:focus) { border-color:var(--accent-info,var(--mgmt-tag-blue)) !important; outline:none; }
:deep(.edit-panel .el-textarea__inner::placeholder) { color:var(--mgmt-text-placeholder) !important; }
:deep(.edit-panel .el-select .el-input__wrapper) { background:var(--mgmt-card-bg) !important; }
:deep(.edit-panel .el-select .el-input.is-focus .el-input__wrapper) { box-shadow:0 0 0 1px var(--accent-info,var(--mgmt-tag-blue)) inset !important; }

/* AI */
.ai-extract { display:flex; flex-direction:column; gap:10px; align-items:flex-start; }
.ai-desc { font-size:13px; color:var(--mgmt-text-muted); }
.ai-btn { background:var(--mgmt-email) !important; border-color:var(--mgmt-email) !important; }
.ai-result { width:100%; background:var(--mgmt-bg); border-radius:6px; padding:12px 16px; margin-top:8px; border:1px solid var(--mgmt-divider); }
.ai-r-title { color:var(--mgmt-text-muted); font-size:13px; margin-bottom:8px; }
.ai-r-row { display:flex; align-items:center; gap:8px; padding:6px 0; border-bottom:1px solid var(--mgmt-divider); font-size:13px; }
.ai-r-label { width:80px; color:var(--mgmt-text-muted); flex-shrink:0; }
.ai-r-val { flex:1; color:var(--mgmt-text); }

/* Chat */
.tab-toolbar { display:flex; align-items:center; gap:12px; margin-bottom:14px; }
.msg-list { display:flex; flex-direction:column; gap:8px; }
.msg-item { display:flex; }
.msg-item.out { justify-content:flex-end; }
.msg-bubble { max-width:75%; background:var(--mgmt-card-bg); padding:10px 14px; border-radius:10px; border:1px solid var(--mgmt-divider); }
.msg-item.out .msg-bubble { background:var(--mgmt-bubble-outgoing); color:var(--text-primary); border-color:var(--mgmt-bubble-outgoing-border); }
.msg-meta { font-size:11px; color:var(--mgmt-text-placeholder); margin-bottom:4px; }
.msg-body { font-size:14px; color:var(--mgmt-text); white-space:pre-wrap; word-break:break-word; }

/* Docs */
.docs-toolbar { display:flex; align-items:center; gap:12px; margin-bottom:14px; flex-wrap:wrap; }
.docs-title { font-size:16px; font-weight:600; color:var(--mgmt-text); }
.docs-kpi { font-size:13px; color:var(--mgmt-text-muted); }
.new-doc-btn { background:var(--mgmt-email) !important; border-color:var(--mgmt-email) !important; }
.new-doc-btn:hover { background:var(--mgmt-email) !important; }
.doc-filter-tabs { display:flex; gap:6px; margin-bottom:12px; }
.df-tab { background:var(--mgmt-card-bg); border:1px solid var(--mgmt-input-border); color:var(--mgmt-text-secondary); padding:6px 14px; border-radius:4px; font-size:13px; cursor:pointer; transition:all .2s; }
.df-tab.active { background:var(--mgmt-email); color:#fff; border-color:var(--mgmt-email); }
.df-tab:hover:not(.active):not(.disabled) { background:var(--mgmt-bg); color:var(--mgmt-text); border-color:var(--mgmt-input-border-hover); }
.df-tab.disabled { opacity:0.4; cursor:not-allowed; }
.doc-list { display:flex; flex-direction:column; gap:8px; }
.doc-card { background:var(--mgmt-card-bg); border:1px solid var(--mgmt-divider); border-radius:6px; padding:14px 16px; box-shadow:var(--mgmt-shadow); margin-bottom:8px; }
.doc-row1 { display:flex; align-items:center; gap:10px; }
.doc-num { font-weight:600; font-size:15px; color:var(--mgmt-text); }
.doc-status { padding:2px 8px; border-radius:10px; font-size:11px; font-weight:600; }
.doc-status.st-draft { background:var(--mgmt-tag-gray-bg); color:var(--mgmt-text-muted); }
.doc-status.st-sent { background:var(--mgmt-tag-blue-bg); color:var(--mgmt-tag-blue); }
.doc-status.st-confirmed { background:var(--mgmt-tag-green-bg); color:var(--mgmt-tag-green); }
.doc-amount { font-weight:600; color:var(--mgmt-tag-orange); }
.doc-row2 { font-size:13px; margin-top:4px; color:var(--mgmt-text-muted); }
.doc-actions { margin-top:10px; display:flex; gap:6px; flex-wrap:wrap; }

/* Follow-ups */
.fu-toolbar { display:flex; align-items:center; gap:10px; margin-bottom:16px; flex-wrap:wrap; }
.timeline { position:relative; padding-left:20px; }
.timeline::before { content:''; position:absolute; left:8px; top:0; bottom:0; width:2px; background:var(--mgmt-divider); }
.tl-item { position:relative; margin-bottom:16px; }
.tl-dot { position:absolute; left:-18px; top:6px; width:12px; height:12px; border-radius:50%; background:var(--mgmt-text-placeholder); border:2px solid var(--mgmt-bg); }
.tl-dot.ai { background:var(--mgmt-email); }
.tl-content { background:var(--mgmt-card-bg); border-radius:6px; padding:12px 16px; border:1px solid var(--mgmt-divider); box-shadow:var(--mgmt-shadow); }
.tl-meta { display:flex; align-items:center; gap:8px; font-size:12px; color:var(--mgmt-text-muted); margin-bottom:6px; }
.tl-tag { padding:1px 8px; border-radius:8px; font-size:11px; }
.tl-tag.ai { background:var(--mgmt-tag-purple-bg); color:var(--mgmt-tag-purple); }
.tl-tag.manual { background:var(--mgmt-tag-green-bg); color:var(--mgmt-tag-green); }
.tl-text { font-size:14px; line-height:1.6; white-space:pre-wrap; color:var(--mgmt-text); }

.empty-state { display:flex; flex-direction:column; align-items:center; justify-content:center; padding:60px 20px; color:var(--mgmt-text-muted); }
.empty-desc { margin-top:12px; text-align:center; }
.loading { text-align:center; padding:60px; color:var(--mgmt-text-muted); }

/* ===== 需求总结模块 ===== */
.req-summary-box { background:var(--mgmt-bg); border-radius:6px; padding:12px 16px; font-size:13px; color:var(--mgmt-text-secondary); line-height:1.6; margin-top:8px; word-break:break-word; border:1px solid var(--mgmt-divider); }
.sec-text { margin-bottom:8px; }
.sec-text:last-child { margin-bottom:0; }
.sec-hdr { display:flex; align-items:center; gap:6px; margin-bottom:6px; }
.sec-icon { font-size:14px; }
.sec-title { font-size:13px; font-weight:600; color:var(--mgmt-text-secondary); }
.sec-content { color:var(--mgmt-text); font-size:13px; line-height:1.6; padding-left:0; margin-top:2px; }
.sec-table { margin-bottom:10px; }
.sec-table:last-child { margin-bottom:0; }
.sec-rows { display:grid; grid-template-columns: 1fr; gap:4px; }
.sec-row { display:flex; justify-content:space-between; gap:10px; padding:6px 0; border-bottom:1px solid var(--mgmt-divider); font-size:13px; }
.sec-row:last-child { border-bottom:none; }
.sec-label { color:var(--mgmt-text-muted); flex-shrink:0; }
.sec-val { color:var(--mgmt-text); text-align:right; flex:1; word-break:break-word; }
.sec-empty { color:var(--mgmt-text-placeholder); font-style:italic; text-align:center; padding:12px; font-size:13px; }
.req-module { border-color:var(--mgmt-divider); }
.req-module.ai-hint { border-color:#f59e0b; box-shadow:0 0 0 1px rgba(245,158,11,0.25); }
.req-title { display:flex; align-items:center; justify-content:space-between; gap:10px; }
.req-meta { display:flex; align-items:center; gap:8px; font-size:12px; font-weight:normal; }
.req-updated { font-size:12px; color:var(--mgmt-text-placeholder); }
.req-source { padding:1px 8px; border-radius:8px; font-size:11px; }
.req-source.src-manual { background:var(--mgmt-tag-green-bg); color:var(--mgmt-tag-green); }
.req-source.src-ai_summary { background:var(--mgmt-tag-purple-bg); color:var(--mgmt-tag-purple); }
.ai-req-btn { background:var(--mgmt-tag-purple-bg); border:1px solid #d3b8ff; color:var(--mgmt-tag-purple); border-radius:4px; transition:all .2s; }
.ai-req-btn:hover:not(:disabled) { background:var(--mgmt-tag-purple-border); color:#531dab; }
.ai-req-btn:disabled { opacity:0.6; cursor:not-allowed; }
.spinner-mini { display:inline-block; width:10px; height:10px; border:2px solid rgba(114,46,209,0.2); border-top-color:var(--mgmt-tag-purple); border-radius:50%; animation:spin 0.8s linear infinite; margin-right:4px; vertical-align:-1px; }
@keyframes spin { to { transform:rotate(360deg); } }

.ai-highlight { background:var(--mgmt-tag-orange-bg); border:1px solid var(--mgmt-tag-orange-border); color:var(--mgmt-tag-orange); padding:8px 12px; border-radius:4px; font-size:13px; margin-bottom:10px; }
.req-form { padding-top:12px; border-top:1px solid var(--mgmt-divider); margin-top:12px; }
.req-grid { display:grid; grid-template-columns:1fr 1fr; gap:14px 20px; }
.req-grid .fg { display:flex; flex-direction:column; gap:6px; }
.req-grid .fg label { display:block; font-size:14px; font-weight:500; color:var(--mgmt-text-secondary); margin-bottom:2px; }
.req-grid .fg :deep(.el-input__wrapper) {
  background:var(--mgmt-card-bg) !important;
  box-shadow:0 0 0 1px var(--mgmt-input-border) inset !important;
  border-radius:4px !important;
  padding:0 12px !important;
  min-height:36px !important;
}
.req-grid .fg :deep(.el-input__wrapper:hover) { box-shadow:0 0 0 1px var(--mgmt-input-border-hover) inset !important; }
.req-grid .fg :deep(.el-input__wrapper.is-focus) { box-shadow:0 0 0 1px var(--accent-info,var(--mgmt-tag-blue)) inset !important; }
.req-grid .fg :deep(.el-input__inner) { color:var(--mgmt-text) !important; font-size:14px !important; height:36px !important; line-height:36px !important; }
.req-grid .fg :deep(.el-input__inner::placeholder) { color:var(--mgmt-text-placeholder) !important; }
.req-form .fg-full { margin-top:14px; }
.req-form .fg-full label { display:block; font-size:14px; font-weight:500; color:var(--mgmt-text-secondary); margin-bottom:6px; }
.req-form .fg-full :deep(.el-textarea__inner) {
  background:var(--mgmt-card-bg) !important;
  color:var(--mgmt-text) !important;
  border:1px solid var(--mgmt-input-border) !important;
  border-radius:4px !important;
  padding:8px 12px !important;
  font-family:inherit !important;
  font-size:14px !important;
  min-height:100px !important;
}
.req-form .fg-full :deep(.el-textarea__inner:hover) { border-color:var(--mgmt-input-border-hover) !important; }
.req-form .fg-full :deep(.el-textarea__inner:focus) { border-color:var(--accent-info,var(--mgmt-tag-blue)) !important; outline:none; }
.req-form .fg-full :deep(.el-textarea__inner::placeholder) { color:var(--mgmt-text-placeholder) !important; }
.req-actions { display:flex; justify-content:flex-end; gap:8px; margin-top:12px; }
.req-actions .el-button--success { background:var(--mgmt-whatsapp) !important; border-color:var(--mgmt-whatsapp) !important; }
.req-actions .el-button--success:hover { background:var(--mgmt-whatsapp-hover) !important; border-color:var(--mgmt-whatsapp-hover) !important; }

.req-view .req-row4 { display:grid; grid-template-columns:repeat(4, 1fr); gap:10px; margin-bottom:10px; }
.req-cell { background:var(--mgmt-bg); border-radius:4px; padding:8px 10px; min-height:48px; border:1px solid var(--mgmt-divider); }
.rc-label { display:block; font-size:11px; color:var(--mgmt-text-muted); margin-bottom:3px; }
.rc-value { display:block; font-size:13px; color:var(--mgmt-text); word-break:break-word; line-height:1.4; }
.req-summary-box { background:var(--mgmt-bg); border-radius:6px; padding:12px 16px; color:var(--mgmt-text); font-size:13px; line-height:1.6; white-space:pre-wrap; border:1px solid var(--mgmt-divider); margin-top:8px; }
.req-view-actions { display:flex; justify-content:flex-end; gap:8px; margin-top:10px; }
.req-empty { text-align:center; padding:18px 10px; font-size:13px; }
.req-empty a { color:var(--mgmt-whatsapp); cursor:pointer; text-decoration:none; }
.req-empty a:hover { text-decoration:underline; }

@media (max-width:768px) {
  .req-grid { grid-template-columns:1fr; }
  .req-view .req-row4 { grid-template-columns:1fr 1fr; }
  .req-title { flex-wrap:wrap; }
}

@media (max-width:768px) {
  .det-header { padding:10px 12px; gap:8px; }
  .header-avatar { width:40px; height:40px; font-size:18px; }
  .cust-title { font-size:16px; }
  .action-btn { padding:8px 10px; min-height:44px; }
  .action-btn span:not(:first-child) { display:none; }
  .det-body { padding:12px; }
  .form-grid { grid-template-columns:1fr; }
  .ir-label { width:90px; font-size:13px; }
  .info-grid { grid-template-columns:1fr; gap:12px; }
}
@media (max-width:1024px) and (min-width:769px) {
  .info-grid { grid-template-columns:1fr; }
}
.stage-tag {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
  color: #fff;
}
.stage-new { background: #6b7280; }
.stage-qualified { background: #3b82f6; }
.stage-quoting { background: #f59e0b; }
.stage-negotiating { background: #8b5cf6; }
.stage-won { background: #10b981; }
.stage-completed { background: #059669; }
.stage-lost { background: #ef4444; }
</style>
