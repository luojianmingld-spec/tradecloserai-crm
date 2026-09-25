<template>
  <div class="conv-page">
    <!-- ========== 状态一：未连接 WhatsApp ========== -->
    <template v-if="chatLoginVisible && !qrViewVisible && !phoneViewVisible">
      <div class="wa-welcome-card">
        <img src="/wa-logo.png" alt="WhatsApp" class="wa-welcome-logo" />
        <h1 class="wa-welcome-title">欢迎使用 WhatsApp</h1>
        <p class="wa-welcome-sub">安全、可靠的消息服务，随时随地与世界保持联系。</p>
        <button class="wa-login-btn" @click="onWelcomePrimary()">
          <svg v-if="startingQr" class="wa-spin" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10" opacity=".25"/><path d="M12 2a10 10 0 0 1 10 10"/></svg>
          <svg v-else viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M3 11h8V3H3v8zm2-6h4v4H5V5zm8-2v8h8V3h-8zm6 6h-4V5h4v4zM3 21h8v-8H3v8zm2-6h4v4H5v-4zm13-2h-2v3h-3v2h3v3h2v-3h3v-2h-3z"/></svg>
          {{ startingQr ? '正在加载...' : (chatStore.currentWaAccountId === null ? '新建会话' : '登录') }}
        </button>
        <div class="wa-intro-tips">
          <p><span class="wa-lock">🔒</span> 您的个人消息已启用端到端加密</p>
        </div>
      </div>
    </template>

    <!-- ========== 状态二：扫码大卡片 ========== -->
    <template v-else-if="chatLoginVisible && phoneViewVisible">
      <div class="wa-scan-wrap">
        <div class="wa-scan-card" style="max-width:480px">
          <div style="padding:40px 48px;width:100%">
            <h2 class="wa-scan-title" style="margin-bottom:8px;text-align:center">使用电话号码登录</h2>
            <p style="color:#8696a0;font-size:13px;margin:0 0 24px;text-align:center">选择国家/地区并输入你的电话号码，我们会给你一个8位配对码，在手机WhatsApp里输入即可登录。</p>
            <div v-if="!chatStore.pairingCode?.code">
              <div class="wa-phone-country-wrap">
                <div class="wa-phone-country" @click="phoneCountryOpen = true">
                  <span class="wa-phone-country-flag">{{ selectedCountry.flag }}</span>
                  <span class="wa-phone-country-name">{{ selectedCountry.name }}</span>
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" style="margin-left:auto;color:#8696a0"><path d="M6 9l6 6 6-6"/></svg>
                </div>
                <div v-if="phoneCountryOpen" class="wa-country-backdrop" @click="phoneCountryOpen = false"></div>
                <div v-if="phoneCountryOpen" class="wa-country-dialog">
                  <div class="wa-country-search">
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                    <input v-model="phoneCountrySearch" placeholder="搜索国家或区号" autofocus />
                  </div>
                  <div class="wa-country-list">
                    <div v-for="c in filteredPhoneCountries" :key="c.name + c.code" class="wa-country-item" :class="{active: c.name === selectedCountry.name && c.code === selectedCountry.code}" @click="selectPhoneCountry(c)">
                      <span class="wa-country-item-flag">{{ c.flag }}</span>
                      <span class="wa-country-item-names">
                        <span class="wa-country-item-name">{{ c.name }}</span>
                        <span class="wa-country-item-en">{{ c.name_en }}</span>
                      </span>
                      <span class="wa-country-item-code">{{ c.code }}</span>
                      <svg v-if="c.name === selectedCountry.name && c.code === selectedCountry.code" class="wa-country-item-check" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#22bb55" stroke-width="3"><path d="M5 12l5 5L20 7"/></svg>
                    </div>
                  </div>
                </div>
              </div>
              <div class="wa-phone-field">
                <span class="wa-phone-prefix">{{ selectedCountry.code }}</span>
                <span class="wa-phone-field-divider"></span>
                <input v-model="phoneLocal" placeholder="电话号码" inputmode="numeric"
                  class="wa-phone-input"
                  @keydown.enter="submitPairing" />
              </div>
              <div style="display:flex;justify-content:center;margin-top:16px">
                <button class="wa-phone-submit" @click="submitPairing" :disabled="chatStore.pairingLoading || !phoneLocal">
                  <span v-if="chatStore.pairingLoading">请求中...</span>
                  <span v-else>获取配对码</span>
                </button>
              </div>
              <p v-if="chatStore.pairingError" style="color:#f15c6d;font-size:12px;margin:8px 0 0">{{ chatStore.pairingError }}</p>
            </div>
            <div v-else style="text-align:left">
              <h3 class="wa-pair-title">在手机上输入代码</h3>
              <p class="wa-pair-sub">正在关联 WhatsApp 账户 <strong>{{ pairingDisplayPhone }}</strong><span class="wa-pair-edit" @click="chatStore.clearPairing()">（编辑）</span></p>
              <div class="wa-pair-code-box">
                <span v-for="(ch, i) in pairingCodeFormatted.slice(0,4)" :key="'a'+i" class="wa-pair-char">{{ ch }}</span>
                <span class="wa-pair-dash">-</span>
                <span v-for="(ch, i) in pairingCodeFormatted.slice(4,8)" :key="'b'+i" class="wa-pair-char">{{ ch }}</span>
              </div>
              <ol class="wa-pair-steps">
                <li>在你的手机上打开WhatsApp</li>
                <li>在Android手机上，轻触'菜单' · 在iPhone上，轻触'设置'</li>
                <li>依次轻触'已关联的设备'和'关联设备'</li>
                <li>轻触'改用电话号码关联'，然后在你的手机上输入此验证码</li>
              </ol>
            </div>
            <div class="wa-phone-link-bottom" @click="cancelPairing" style="margin-top:24px">
              使用二维码登录
            </div>
          </div>
        </div>
        <button class="wa-scan-back" style="top:auto;bottom:16px;left:16px" @click="cancelPairing" title="Back"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg></button>
      </div>

    </template>

    <template v-else-if="chatLoginVisible">
      <div class="wa-scan-wrap">
        <div class="wa-scan-card">
          <div class="wa-scan-left">
            <h2 class="wa-scan-title">登录 WhatsApp</h2>
            <ol class="wa-scan-steps">
              <li><span class="step-num">1</span><span class="step-text">使用手机摄像头扫描二维码</span></li>
              <li><span class="step-num">2</span><span class="step-text">轻触链接以打开WhatsApp <img src="/wa-logo.png" alt="WA" style="width:14px;height:14px;vertical-align:-2px;display:inline;" /></span></li>
              <li><span class="step-num">3</span><span class="step-text">再次扫描二维码以关联到你的账户</span></li>
            </ol>
            <a class="wa-help-link" href="https://faq.whatsapp.com/1317564962315842/?cms_platform=android&lang=zh-CN" target="_blank">需要帮助？ <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-1px"><path d="M7 17L17 7M17 7H7M17 7v10"/></svg></a>
            <label class="wa-stay-logged">
              <input type="checkbox" v-model="stayLoggedIn" />
              <span class="checkbox-box" :class="{checked: stayLoggedIn}">
                <svg v-if="stayLoggedIn" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#111b21" stroke-width="3.5"><path d="M5 12l5 5L20 7"/></svg>
              </span>
              <span>在此电脑上保持登录状态</span>
            </label>
          </div>
          <div class="wa-scan-right">
            <template v-if="qrError">
              <div class="qr-error-box">
                <div class="qr-error-icon">!</div>
                <div class="qr-error-text">{{ qrError }}</div>
                <button class="qr-reload-btn" @click="retryQR"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 4v6h6M23 20v-6h-6"/><path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15"/></svg> 重新加载二维码</button>
              </div>
            </template>
            <template v-else-if="qrExpired">
              <div class="qr-expired-box">
                <div class="qr-expired-title">二维码已过期</div>
                <button class="qr-reload-btn" @click="retryQR"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 4v6h6M23 20v-6h-6"/><path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15"/></svg> 点击重新加载</button>
              </div>
            </template>
            <template v-else-if="chatStore.qrCode?.qr && isDataUrl(chatStore.qrCode.qr)">
              <div class="qr-frame">
                <img :src="chatStore.qrCode.qr" class="qr-img" alt="QR code" />
                <div class="qr-overlay-logo">
                  <img src="/wa-qr-logo.png" alt="WhatsApp" style="width:60px;height:60px;" />
                </div>
                <span class="corner tl"></span><span class="corner tr"></span><span class="corner bl"></span><span class="corner br"></span>
              </div>
              <div class="qr-hint-text">
                <span v-if="qrCountdown > 0">二维码将在 <strong>{{ qrCountdown }}s</strong></span>
                <span v-else>扫描中...</span>
              </div>
            </template>
            <template v-else-if="chatStore.connectionStatus === 'scanning'">
              <div class="qr-loading-box">
                <div style="font-size:48px;margin-bottom:8px">📱</div>
                <div class="qr-loading-text" style="color:#00a884;font-weight:600">已扫描，正在登录...</div>
                <div style="font-size:12px;color:#8696a0;margin-top:8px">请在手机上确认登录</div>
              </div>
            </template>
            <template v-else-if="chatStore.connectionStatus === 'qr_refreshing' || chatStore.connectionStatus === 'reconnecting'">
              <div class="qr-loading-box"><div class="qr-loading-spin"></div><div class="qr-loading-text">{{ chatStore.connectionStatus === 'reconnecting' ? '连接断开，正在重试...' : 'QR code refreshing...' }}</div></div>
            </template>
            <template v-else-if="chatStore.connectionStatus === 'connecting'">
              <div class="qr-loading-box"><div class="qr-loading-spin"></div><div class="qr-loading-text">正在连接WhatsApp服务器...</div></div>
            </template>
            <template v-else-if="chatStore.connectionStatus === 'error'">
              <div class="qr-error-box">
                <div class="qr-error-icon">!</div>
                <div class="qr-error-text">{{ chatStore.waError || '连接失败，请确认代理/VPN已启动' }}</div>
                <button class="qr-reload-btn" @click="retryQR">重试连接</button>
              </div>
            </template>
            <template v-else>
              <div class="qr-loading-box"><div class="qr-loading-spin"></div><div class="qr-loading-text">正在加载二维码...</div></div>
            </template>
            <div class="wa-phone-link-bottom" @click="onPhoneLoginClick">使用电话号码登录</div>
          </div>
        </div>
        <div class="wa-scan-footer">
          <p class="wa-scan-lock"><svg viewBox="0 0 24 24" width="13" height="13" fill="#8696a0" style="margin-right:6px;vertical-align:-2px"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1s3.1 1.39 3.1 3.1v2z"/></svg> 您的个人消息已启用端到端加密</p>
        </div>
        <button class="wa-scan-back" @click="backToIntro" title="Back"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg></button>
      </div>
    </template>

    <!-- ========== 状态三：已连接 ========== -->
    <template v-else>
      <div class="conv-header" v-if="chatStore.activeConversation">
        <button class="back-btn mobile-only" @click="goBack"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg></button>
        <div class="ch-avatar ch-avatar-clickable" @click="openProfile" :style="!chAvatarOk ? {background: avatarColor(chatStore.activeConversation.name || chatStore.activeConversation.jid)} : {}"><img v-if="chatStore.loadAvatar(chatStore.activeConversation.jid, chatStore.activeConversation.avatar) && chAvatarOk" class="ch-avatar-img" :src="chatStore.loadAvatar(chatStore.activeConversation.jid, chatStore.activeConversation.avatar)" @load="onChAvatarLoad" @error="onChAvatarError" alt="" /><span v-else>{{ (chatStore.activeConversation.name || '?')[0] }}</span></div>
        <div class="ch-info">
          <div class="ch-name-row">
            <div class="ch-name">{{ chatStore.activeConversation.name }}</div>
          </div>
          <div class="ch-status-row">
            <span v-if="cultureIso && cultureInfo" class="ch-cul-badge" :class="'cul-s-'+cultureWorkStatus.status" @click="openCulturePanel" :title="'当地'+cultureWorkStatus.localTime+' · '+cultureWorkStatus.tip">
              {{ cultureInfo.name }} {{ cultureWorkStatus.localTime }} <span class="ch-cul-icon">{{ cultureWorkStatus.icon }}</span>
            </span>
            <button class="ch-conv-gen-btn assign-to-agent-btn" @click.stop="openAssignDialog()" title="发给 Agent 跟进">
              <span>🤖 发Agent</span>
            </button>
            <button class="ch-conv-gen-btn doc-archive-btn" @click.stop="openDocPanel" title="文档储存">
              <span>📁 文档储存</span>
            </button>
          </div>
          <!-- Phase 4: Conversation Status Indicators -->
          <!-- 发给 Agent 指派弹窗（V1.0 F6 沟通页入口） -->
          <transition name="fade">
            <div v-if="assignDialogOpen" class="assign-dialog-overlay" @click.self="assignDialogOpen = false">
              <div class="assign-dialog">
                <div class="assign-dialog-header">
                  <span>🤖 发给 Agent</span>
                  <button class="assign-dialog-close" @click="assignDialogOpen = false">✕</button>
                </div>
                <div class="assign-dialog-body">
                  <div v-if="assignCustomerLoading" class="assign-loading">正在识别会话客户...</div>
                  <template v-else>
                    <div v-if="assignCustomer" class="assign-cust-info">
                      <span class="aci-icon">👤</span>
                      <span class="aci-name">{{ assignCustomer.companyName || assignCustomer.name || assignCustomer.contactName || ('客户#' + assignCustomer.id) }}</span>
                    </div>
                    <div v-else class="assign-cust-info warn">⚠️ 该会话未绑定客户，请先在客户管理中为该联系人建立客户档案</div>
                    <div class="assign-agents">
                      <div v-for="ag in ASSIGN_AGENTS" :key="ag.type" class="assign-agent-card" :class="{ active: assignAgentType === ag.type }" @click="assignAgentType = ag.type">
                        <span class="aa-icon">{{ ag.icon }}</span>
                        <div class="aa-info"><div class="aa-name">{{ ag.name }}</div><div class="aa-desc">{{ ag.desc }}</div></div>
                        <span class="aa-check" v-if="assignAgentType === ag.type">✓</span>
                      </div>
                    </div>
                    <div class="assign-label">📝 跟进指令 <span class="assign-required">（必填）</span></div>
                    <textarea v-model="assignInstruction" class="assign-input" rows="3" placeholder="如：重点跟进报价，本周内发首封开发信，并预约下次跟进"></textarea>
                  </template>
                </div>
                <div class="assign-dialog-footer">
                  <button class="assign-dialog-btn cancel" @click="assignDialogOpen = false">取消</button>
                  <button class="assign-dialog-btn primary" :disabled="assigning || !assignCustomer" @click="doAssignFromChat">{{ assigning ? '指派中...' : '确认指派' }}</button>
                </div>
              </div>
            </div>
          </transition>

          <div class="ch-conv-status" v-if="convStatus && !convStatus.error" @click="convDetailOpen = true">
            <div class="ch-conv-progress">
              <div class="ch-conv-bar">
                <div class="ch-conv-bar-fill" :style="{width: Math.round(convStatus.completeness * 100) + '%', background: completenessColor(convStatus.completeness)}"></div>
              </div>
              <span class="ch-conv-pct" :style="{color: completenessColor(convStatus.completeness)}">{{ Math.round(convStatus.completeness * 100) }}%</span>
            </div>
            <span class="ch-conv-chip ch-conv-strategy" :class="'strat-' + (convStatus.strategy === 'PROVIDE_QUOTE' ? 'quote' : 'ask')">
              {{ convStatus.strategy === 'PROVIDE_QUOTE' ? '💰 报价' : '🔍 询问' }}
            </span>
            <span class="ch-conv-chip ch-conv-stage">{{ stageLabel(convStatus.stage) }}</span>
            <span class="ch-conv-chip ch-conv-rounds" v-if="convStatus.askedRounds > 0">追问 {{ convStatus.askedRounds }}/{{ convStatus.maxRounds }}</span>
            <button class="ch-conv-gen-btn" @click.stop="generateConvScript()" :disabled="convScriptLoading" title="生成话术">
              <svg v-if="convScriptLoading" class="wa-spin" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10" opacity=".25"/><path d="M12 2a10 10 0 0 1 10 10"/></svg>
              <span v-else>✍️ 话术</span>
            </button>
            <button class="ch-conv-gen-btn closing-btn" @click.stop="generateClosingReply()" :disabled="closingReplyLoading" title="成交回复">
              <svg v-if="closingReplyLoading" class="wa-spin" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10" opacity=".25"/><path d="M12 2a10 10 0 0 1 10 10"/></svg>
              <span v-else>🎯 成交</span>
            </button>
          </div>
        </div>
        <div class="ch-actions">
          <button title="搜索"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg></button>
          <button title="更多"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2.9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg></button>
        </div>
      </div>

          <!-- ========== Phase 4: Conversation Detail Dialog ========== -->
    <transition name="fade">
    <div v-if="convDetailOpen" class="conv-dialog-overlay" @click.self="convDetailOpen = false">
      <div class="conv-dialog">
        <div class="conv-dialog-header">
          <h3>📊 对话状态详情</h3>
          <button class="conv-dialog-close" @click="convDetailOpen = false">✕</button>
        </div>
        <div class="conv-dialog-body" v-if="convStatus">
          <div class="conv-dialog-section">
            <div class="cds-title">产品: {{ convStatus.productName }}</div>
            <div class="cds-progress-row">
              <span>信息完整度</span>
              <div class="cds-bar"><div class="cds-bar-fill" :style="{width: Math.round(convStatus.completeness*100)+'%', background: completenessColor(convStatus.completeness)}"></div></div>
              <span class="cds-pct" :style="{color: completenessColor(convStatus.completeness)}">{{ Math.round(convStatus.completeness*100) }}%</span>
            </div>
            <div class="cds-meta">
              <span class="cds-chip" :class="'strat-' + (convStatus.strategy === 'PROVIDE_QUOTE' ? 'quote' : 'ask')">{{ convStatus.strategy === 'PROVIDE_QUOTE' ? '💰 报价策略' : '🔍 询问策略' }}</span>
              <span class="cds-chip stage">{{ stageLabel(convStatus.stage) }}</span>
              <span class="cds-chip rounds">追问 {{ convStatus.askedRounds }}/{{ convStatus.maxRounds }}</span>
            </div>
          </div>
          <div class="conv-dialog-section">
            <div class="cds-title">必问问题 ({{ convStatus.requiredQuestions?.filter(q=>q.answered).length || 0 }}/{{ convStatus.requiredQuestions?.length || 0 }})</div>
            <div class="cds-q-list">
              <div v-for="q in convStatus.requiredQuestions" :key="q.id" class="cds-q-item" :class="{answered: q.answered}">
                <span class="cds-q-check">{{ q.answered ? '✅' : '⬜' }}</span>
                <div class="cds-q-content">
                  <div class="cds-q-text">{{ q.questionEn }}</div>
                  <div class="cds-q-text-cn">{{ q.questionCn }}</div>
                  <div v-if="q.answer" class="cds-q-answer">💬 {{ q.answer }}</div>
                </div>
              </div>
            </div>
          </div>
          <div class="conv-dialog-section" v-if="convStatus.followUpQuestions?.length">
            <div class="cds-title">进阶问题</div>
            <div class="cds-q-list">
              <div v-for="q in convStatus.followUpQuestions" :key="q.id" class="cds-q-item" :class="{answered: q.answered}">
                <span class="cds-q-check">{{ q.answered ? '✅' : '⬜' }}</span>
                <div class="cds-q-content">
                  <div class="cds-q-text">{{ q.questionEn }}</div>
                  <div class="cds-q-text-cn">{{ q.questionCn }}</div>
                </div>
              </div>
            </div>
          </div>
          <div class="conv-dialog-section" v-if="convStatus.bantScore">
            <div class="cds-title">BANT 评分</div>
            <div class="cds-bant">
              <div class="cds-bant-item"><span>预算</span><b>{{ convStatus.bantScore.budgetScore }}/10</b></div>
              <div class="cds-bant-item"><span>权限</span><b>{{ convStatus.bantScore.authorityScore }}/10</b></div>
              <div class="cds-bant-item"><span>需求</span><b>{{ convStatus.bantScore.needScore }}/10</b></div>
              <div class="cds-bant-item"><span>时间</span><b>{{ convStatus.bantScore.timelineScore }}/10</b></div>
              <div class="cds-bant-total"><span>综合</span><b>{{ convStatus.bantScore.totalScore }}/10 ({{ convStatus.bantScore.level }})</b></div>
            </div>
          </div>
        </div>
        <div class="conv-dialog-footer">
          <button class="cd-btn" @click="resetConvState()">🔄 重置对话</button>
          <button class="cd-btn primary" @click="convDetailOpen = false; generateConvScript()">✍️ 重新生成话术</button>
        </div>
      </div>
    </div>
    </transition>

    <!-- ========== Phase 4+5: Script Generation Dialog ========== -->
    <transition name="fade">
    <div v-if="convScriptOpen && convScript" class="conv-dialog-overlay" @click.self="convScriptOpen = false">
      <div class="conv-dialog script-dialog">
        <div class="conv-dialog-header">
          <h3>{{ convScript.strategy === 'PROVIDE_QUOTE' ? '💰 报价话术' : '🔍 询问话术' }}</h3>
          <button class="conv-dialog-close" @click="convScriptOpen = false">✕</button>
        </div>
        <!-- Phase 5: Context summary bar -->
        <div class="script-context-bar" v-if="convStatus">
          <span class="script-strategy-tag" :class="convScript.strategy">
            {{ convScript.strategy === 'PROVIDE_QUOTE' ? '💰 报价阶段' : '🔍 信息收集' }}
          </span>
          <span class="script-ctx-item">📊 完整度 {{ Math.round((convScript.completeness || 0) * 100) }}%</span>
          <span class="script-ctx-item" v-if="convStatus.stage">📍 {{ convStatus.stage }}</span>
          <span class="script-ctx-item" v-if="convStatus.bantScore">⭐ BANT {{ convStatus.bantScore.totalScore || 0 }}/10</span>
        </div>
        <div class="conv-dialog-body">
          <!-- Phase 5: Length selector tabs -->
          <div class="script-length-tabs">
            <button
              v-for="ln in scriptLengths"
              :key="ln.key"
              class="script-length-chip"
              :class="{ active: scriptLength === ln.key }"
              @click="scriptLength = ln.key"
            >{{ ln.icon }} {{ ln.label }}</button>
          </div>
          <div class="script-reason" v-if="convScript.reason">💡 {{ convScript.reason }}</div>
          <div class="script-block">
            <div class="script-label">外文 (发送给客户)</div>
            <div class="script-text script-en">{{ convScript.script_en }}</div>
            <div class="script-btn-row">
              <button class="script-copy-btn" @click="copyScript('en')">📋 复制英文</button>
            </div>
          </div>
          <div class="script-block">
            <div class="script-label">中文 (内部参考)</div>
            <div class="script-text script-cn">{{ convScript.script_cn }}</div>
            <div class="script-btn-row">
              <button class="script-copy-btn" @click="copyScript('cn')">📋 复制中文</button>
            </div>
          </div>
          <div class="script-questions" v-if="convScript.questionsToAsk?.length">
            <div class="script-label">本次询问的问题</div>
            <div v-for="q in convScript.questionsToAsk" :key="q.id" class="script-q-item">• {{ q.questionEn }} ({{ q.questionCn }})</div>
          </div>
          <div class="script-meta">
            <span>完整度: {{ Math.round((convScript.completeness || 0) * 100) }}%</span>
            <span>追问轮数: {{ convScript.askedRounds || 0 }}</span>
          </div>
        </div>
        <div class="conv-dialog-footer">
          <button class="cd-btn" @click="generateConvScript(convScript.strategy === 'ASK_FOR_INFO' ? 'quote' : 'ask')">
            🔄 {{ convScript.strategy === 'ASK_FOR_INFO' ? '改为报价话术' : '改为询问话术' }}
          </button>
          <button class="cd-btn" @click="regenerateConvScript()">
            🔄 {{ scriptLength === 'short' ? '短版' : scriptLength === 'long' ? '长版' : '标准' }}重新生成
          </button>
          <button class="cd-btn primary" @click="insertScriptToInput()">📩 插入聊天框</button>
        </div>
      </div>
    </div>
    </transition>

      <!-- ========== 🎯 成交回复弹窗 ========== -->
    <transition name="fade">
    <div v-if="closingReplyOpen && closingReplyResult" class="conv-dialog-overlay" @click.self="closingReplyOpen = false">
      <div class="conv-dialog closing-dialog">
        <div class="conv-dialog-header">
          <h3>🎯 成交回复</h3>
          <button class="conv-dialog-close" @click="closingReplyOpen = false">✕</button>
        </div>
        <div class="closing-strategy-bar">
          <span class="closing-stage-tag">📍 {{ closingReplyResult.stageName || closingReplyResult.stage }}</span>
          <span class="closing-strategy-tag">🎯 {{ closingReplyResult.closingStrategy || '' }}</span>
          <span class="closing-attitude-tag" v-if="closingReplyResult.attitudeSummary">💬 {{ closingReplyResult.attitudeSummary }}</span>
        </div>
        <div class="conv-dialog-body">
          <div v-for="(reply, idx) in closingReplyResult.replies" :key="idx" class="closing-reply-card">
            <div class="closing-tactic-badge">💡 {{ reply.tactic }}</div>
            <div class="closing-stage-advice" v-if="reply.stageAdvice">📌 {{ reply.stageAdvice }}</div>
            <div class="script-block">
              <div class="script-label">外文 (发送给客户)</div>
              <div class="script-text script-en">{{ reply.foreign }}</div>
              <div class="script-btn-row">
                <button class="script-copy-btn" @click="copyClosingReply(reply.foreign)">📋 复制</button>
                <button class="script-copy-btn primary" @click="insertClosingToInput(reply.foreign)">📩 插入聊天框</button>
              </div>
            </div>
            <div class="script-block">
              <div class="script-label">中文 (内部参考)</div>
              <div class="script-text script-cn">{{ reply.zh }}</div>
              <div class="script-btn-row">
                <button class="script-copy-btn" @click="copyClosingReply(reply.zh)">📋 复制中文</button>
              </div>
            </div>
          </div>
        </div>
        <div class="conv-dialog-footer">
          <button class="cd-btn primary" @click="generateClosingReply()">🔄 重新生成</button>
        </div>
      </div>
    </div>
    </transition>

      <!-- ========== 客户档案右侧抽屉 ========== -->
    <transition name="profile-slide">
    <div v-if="profileOpen" class="profile-drawer" @click.self="closeProfile">
      <div class="profile-panel">
        <!-- 顶部栏 -->
        <div class="pp-header">
          <button class="pp-back" @click="closeProfile"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg></button>
          <div class="pp-title">{{ profileEditing ? '编辑联系人' : '联系人信息' }}</div>
          <button v-if="!profileEditing" class="pp-edit-btn" @click="profileEditing=true" title="编辑"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a.996.996 0 000-1.41l-2.34-2.34a.996.996 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg></button>
          <button v-else class="pp-edit-btn" @click="profileEditing=false" title="完成"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg></button>
        </div>
        <div class="pp-scroll" @click.self="closeProfile">
          <!-- 头像区 -->
          <div class="pp-avatar-area">
            <div class="pp-avatar" :style="!chAvatarOk ? {background: avatarColor(chatStore.activeConversation.name || chatStore.activeConversation.jid)} : {}">
              <img v-if="chatStore.loadAvatar(chatStore.activeConversation.jid, chatStore.activeConversation.avatar) && chAvatarOk" class="pp-avatar-img" :src="chatStore.loadAvatar(chatStore.activeConversation.jid, chatStore.activeConversation.avatar)" @load="onChAvatarLoad" @error="onChAvatarError" alt=""/>
              <span v-else style="font-size:56px;font-weight:500">{{ (chatStore.activeConversation.name || '?')[0] }}</span>
            </div>
            <div class="pp-name">{{ profileForm.name || chatStore.activeConversation.name || chatStore.activeConversation.jid.split('@')[0] }}</div>
            <div class="pp-phone">{{ profileForm.phone || chatStore.activeConversation.phone || chatStore.activeConversation.jid.split('@')[0] }}</div>
            <div class="pp-meta-row">
              <span class="pp-level-tag" :class="'lv-'+(profileForm.customerLevel||'C')">{{ (profileForm.customerLevel||'C') }}级客户</span>
              <span class="pp-status-tag" v-if="profileForm.status">{{ statusLabel(profileForm.status) }}</span>
            </div>
          </div>
          <!-- 快捷操作：音视频/通话/搜索 占位 -->
          <div class="pp-quick">
            <button class="pp-quick-btn"><svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg><span>音频</span></button>
            <button class="pp-quick-btn"><svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg><span>视频</span></button>
            <button class="pp-quick-btn"><svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M12 5c-1.25 0-2.42.2-3.53.56l2.56 2.56c.31-.07.63-.12.97-.12 3.31 0 6 2.69 6 6 0 .34-.05.66-.12.97l2.56 2.56c.36-1.11.56-2.28.56-3.53 0-4.96-4.04-9-9-9zM2.89 3.72l-1.42 1.41 3.16 3.16C3.63 9.82 3 11.35 3 13c0 4.96 4.02 9 9 9 1.65 0 3.18-.63 4.7-1.63l3.16 3.16 1.41-1.41L18 18.83l-3.88-3.88-2.95-2.95L6.18 6.09 2.89 3.72z"/></svg><span>搜索</span></button>
          </div>
          <!-- 媒体/链接/文档 tab (占位，暂不做数据) -->
          <div class="pp-tabs">
            <div class="pp-tab active">媒体</div>
            <div class="pp-tab">链接</div>
            <div class="pp-tab">文档</div>
          </div>
          <div class="pp-empty-tab">暂无媒体文件</div>
          <!-- 编辑区 -->
          <div class="pp-section">
            <div class="pp-section-title">关于此联系人</div>
            <!-- 查看态 -->
            <template v-if="!profileEditing">
              <div class="pp-view-row" v-if="profileForm.name"><div class="pp-view-label">备注名</div><div class="pp-view-val">{{ profileForm.name }}</div></div>
              <div class="pp-view-row" v-if="profileForm.companyName"><div class="pp-view-label">公司名称</div><div class="pp-view-val">{{ profileForm.companyName }}</div></div>
              <div class="pp-view-row" v-if="profileForm.contactName"><div class="pp-view-label">联系人</div><div class="pp-view-val">{{ profileForm.contactName }}</div></div>
              <div class="pp-view-row" v-if="profileForm.title"><div class="pp-view-label">职位</div><div class="pp-view-val">{{ profileForm.title }}</div></div>
              <div class="pp-view-row" v-if="profileForm.phone"><div class="pp-view-label">电话</div><div class="pp-view-val">{{ profileForm.phone }}</div></div>
              <div class="pp-view-row" v-if="profileForm.email"><div class="pp-view-label">邮箱</div><div class="pp-view-val">{{ profileForm.email }}</div></div>
              <div class="pp-view-row" v-if="profileForm.website"><div class="pp-view-label">网站</div><div class="pp-view-val"><a :href="profileForm.website" target="_blank" style="color:#00a884;text-decoration:none">{{ profileForm.website }}</a></div></div>
              <div class="pp-view-row" v-if="profileForm.country"><div class="pp-view-label">国家/地区</div><div class="pp-view-val">{{ profileForm.country }}</div></div>
              <div class="pp-view-row" v-if="profileForm.industry"><div class="pp-view-label">行业</div><div class="pp-view-val">{{ profileForm.industry }}</div></div>
              <div class="pp-view-row" v-if="profileForm.address"><div class="pp-view-label">地址</div><div class="pp-view-val">{{ profileForm.address }}</div></div>
              <div class="pp-view-row" v-if="profileForm.source"><div class="pp-view-label">来源</div><div class="pp-view-val">{{ sourceLabel(profileForm.source) }}</div></div>
              <div class="pp-view-row" v-if="profileForm.tagsDisplay"><div class="pp-view-label">标签</div><div class="pp-view-val"><span v-for="t in profileForm.tagsDisplay.split(',')" class="pp-tag-chip">{{ t }}</span></div></div>
              <div class="pp-view-row" v-if="profileForm.notes"><div class="pp-view-label">备注</div><div class="pp-view-val" style="white-space:pre-wrap">{{ profileForm.notes }}</div></div>
              <div class="pp-view-empty" v-if="!profileForm.name && !profileForm.companyName && !profileForm.phone && !profileForm.email">暂无补充信息，点击右上角 ✏️ 添加</div>
            </template>
            <!-- 编辑态 -->
            <template v-else>
            <div class="pp-field">
              <label>备注名</label>
              <input v-model="profileForm.name" placeholder="备注名" />
            </div>
            <div class="pp-field">
              <label>公司名称</label>
              <input v-model="profileForm.companyName" placeholder="公司名称"/>
            </div>
            <div class="pp-field">
              <label>联系人</label>
              <input v-model="profileForm.contactName" placeholder="真实姓名"/>
            </div>
            <div class="pp-field">
              <label>职位</label>
              <input v-model="profileForm.title" placeholder="例如 Purchasing Manager"/>
            </div>
            <div class="pp-field">
              <label>电话</label>
              <input v-model="profileForm.phone" placeholder="手机号码"/>
            </div>
            <div class="pp-field">
              <label>邮箱</label>
              <input v-model="profileForm.email" placeholder="邮箱地址" type="email"/>
            </div>
            <div class="pp-field">
              <label>网站</label>
              <input v-model="profileForm.website" placeholder="https://"/>
            </div>
            <div class="pp-field">
              <label>国家/地区</label>
              <input v-model="profileForm.country" placeholder="国家/地区"/>
            </div>
            <div class="pp-field">
              <label>行业</label>
              <input v-model="profileForm.industry" placeholder="行业"/>
            </div>
            <div class="pp-field">
              <label>地址</label>
              <input v-model="profileForm.address" placeholder="地址"/>
            </div>
            <div class="pp-field">
              <label>客户来源</label>
              <select v-model="profileForm.source">
                <option value="whatsapp">WhatsApp</option>
                <option value="google">谷歌推广</option>
                <option value="tiktok">TikTok</option>
                <option value="facebook">Facebook</option>
                <option value="instagram">Instagram</option>
                <option value="linkedin">LinkedIn</option>
                <option value="website">官网</option>
                <option value="youtube">YouTube</option>
                <option value="exhibition">展会</option>
                <option value="referral">客户推荐</option>
                <option value="other">其他</option>
              </select>
            </div>
            <div class="pp-field">
              <label>客户等级</label>
              <select v-model="profileForm.customerLevel">
                <option value="A">A - 重点客户</option>
                <option value="B">B - 潜力客户</option>
                <option value="C">C - 普通客户</option>
                <option value="D">D - 无意向</option>
              </select>
            </div>
            <div class="pp-field">
              <label>跟进状态</label>
              <select v-model="profileForm.status">
                <option value="potential">潜在客户</option>
                <option value="contacted">已联系</option>
                <option value="qualified">已确认需求</option>
                <option value="quoting">报价中</option>
                <option value="negotiating">谈判中</option>
                <option value="won">已成交</option>
                <option value="lost">已流失</option>
              </select>
            </div>
            <div class="pp-field pp-field-tall">
              <label>标签（逗号分隔）</label>
              <input v-model="profileForm.tagsInput" placeholder="例如 大客户,老客户,急单"/>
            </div>
            <div class="pp-field pp-field-tall">
              <label>备注</label>
              <textarea v-model="profileForm.notes" placeholder="添加备注..." rows="3"></textarea>
            </div>
            <button class="pp-save-btn" @click="saveProfile" :disabled="profileSaving">{{ profileSaving ? '保存中...' : '保存' }}</button>
            </template>
          </div>
          <!-- 系统开关区 -->
          <div class="pp-section">
            <div class="pp-switch-row">
              <div class="pp-switch-label">
                <div>静音通知</div>
                <div class="pp-switch-sub">不推送该联系人消息</div>
              </div>
              <label class="pp-switch"><input type="checkbox"/><span class="pp-slider"></span></label>
            </div>
            <div class="pp-switch-row">
              <div class="pp-switch-label">
                <div>阅后即焚</div>
                <div class="pp-switch-sub">新消息24小时后消失</div>
              </div>
              <label class="pp-switch"><input type="checkbox"/><span class="pp-slider"></span></label>
            </div>
          </div>
          <div class="pp-section pp-encryption">
            🔒 消息和通话均为端到端加密
          </div>
          <div class="pp-bottom-spacer"></div>
        </div>
      </div>
    </div>
    </transition>

      <!-- ========== 📁 文档储存 右侧抽屉（2026-08-31 单证存档） ========== -->
    <transition name="profile-slide">
    <div v-if="docPanelOpen" class="profile-drawer doc-drawer" @click.self="closeDocPanel">
      <div class="profile-panel doc-panel">
        <!-- 顶部栏 -->
        <div class="pp-header">
          <button class="pp-back" @click="closeDocPanel"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg></button>
          <div class="pp-title">📁 文档储存</div>
          <button class="pp-edit-btn" @click="closeDocPanel" title="关闭"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg></button>
        </div>
        <div class="pp-scroll">
          <!-- 用量提示区 -->
          <div class="doc-usage" v-if="docUsage">
            <div class="doc-usage-row">
              <span class="doc-usage-label">已用 <b>{{ docUsage.usedMB }}</b> MB / 免费 {{ docUsage.freeQuotaMB }} MB</span>
              <span class="doc-usage-balance">积分余额 {{ docUsage.balance }}</span>
            </div>
            <div class="doc-usage-bar">
              <div class="doc-usage-fill" :style="{ width: Math.min(100, (docUsage.usedMB / docUsage.freeQuotaMB) * 100) + '%' }"></div>
            </div>
            <div class="doc-usage-tip" v-if="!docUsage.overQuota">免费额度内存档不扣积分，超出后按 4积分/MB 计费</div>
            <div class="doc-usage-tip" v-else style="color:#e74c3c">已超出免费额度，本次起按 4积分/MB 扣积分</div>
          </div>

          <!-- 上传按钮 -->
          <div class="doc-upload-area">
            <button class="doc-upload-btn" :disabled="docUploading" @click="triggerDocUpload">
              {{ docUploading ? '上传中...' : '＋ 上传单证' }}
            </button>
            <input ref="docFileInput" type="file" style="display:none" :accept="docAccept" @change="onDocFileChosen" />
          </div>

          <!-- 文件列表 -->
          <div class="doc-list">
            <div v-if="docLoading" class="doc-empty">加载中...</div>
            <div v-else-if="!docList.length" class="doc-empty">暂无存档单证，点击上方按钮上传</div>
            <div v-for="item in docList" :key="item.id" class="doc-item">
              <div class="doc-item-icon">📄</div>
              <div class="doc-item-info">
                <div class="doc-item-name" :title="item.fileName">{{ item.fileName }}</div>
                <div class="doc-item-meta">{{ formatDocSize(item.fileSize) }} · {{ formatDocTime(item.createdAt) }}</div>
              </div>
              <div class="doc-item-actions">
                <button class="doc-act-btn" title="下载" @click="downloadDoc(item)">⬇</button>
                <button class="doc-act-btn doc-act-del" title="删除" @click="deleteDoc(item)">🗑</button>
              </div>
            </div>
          </div>
          <div class="pp-bottom-spacer"></div>
        </div>
      </div>
    </div>
    </transition>

<!-- ⚡ 首响等待提示 -->
      <div v-if="activeFirstResponse && !frWaitDismissedJids[chatStore.activeJid]" class="fr-wait-banner">
        <span class="fr-wb-icon">⚡</span>
        <span class="fr-wb-text">
          该客户已等待首响 <b>{{ activeFirstResponseLive.minutes }} 分 {{ activeFirstResponseLive.seconds }} 秒</b>，请尽快回复！
        </span>
        <button class="fr-wb-dismiss" @click="frWaitDismissedJids[chatStore.activeJid]=true">知道了</button>
      </div>

      <!-- 🤖 自动接待步骤流（销冠 Agent 实时步骤） -->
      <div v-if="activeAutoSteps.length" class="auto-step-banner">
        <span class="asb-title">🤖 销冠自动接待</span>
        <span v-for="(st, si) in activeAutoSteps" :key="si" class="asb-item">
          <span class="asb-ico">{{ st.done ? '✅' : (si < activeAutoSteps.length - 1 ? '✓' : '⏳') }}</span>{{ st.detail }}
        </span>
      </div>

      <div class="conv-messages" ref="msgArea">
        <template v-if="!chatStore.activeConversation">
          <div class="wa-noselect">
            <div class="wa-noselect-art"><svg viewBox="0 0 303 172" width="303" height="172"><path fill="#364147" d="M229.26 161.53h-148.5c-.8 0-1.46.65-1.46 1.46v7.04c0 .8.65 1.46 1.46 1.46h148.5c.8 0 1.46-.65 1.46-1.46v-7.04c0-.8-.66-1.46-1.46-1.46z"/><path fill="#233138" d="M231.34 164.69H80.51c-.8 0-1.46.65-1.46 1.46v2.42c0 .8.65 1.46 1.46 1.46h150.83c.8 0 1.46-.65 1.46-1.46v-2.42c0-.8-.66-1.46-1.46-1.46z"/><path fill="#364147" d="M72.73 154.69h165.57V25.06c0-5.9-4.79-10.69-10.69-10.69H83.42c-5.9 0-10.69 4.79-10.69 10.69v129.63z"/><path fill="#0b141a" d="M79.54 30.47h151.96v118.3H79.54z"/><path fill="#00a884" d="M140 60h30v50h-30z" opacity=".18"/><path fill="#fff" d="M148 72h14v3h-14zM148 79h24v3h-24zM148 86h22v3h-22z" opacity=".1"/><path fill="#00a884" d="M155 100c-3 0-5 1-7 3l-4 12 12-3c2 1 4 1 6 0v-12h-7z"/></svg></div>
            <h2 class="wa-noselect-title">WhatsApp Web</h2>
            <p class="wa-noselect-sub">发送私密消息，免费体验简单可靠的通话，这些功能均可在全球手机上使用。</p>
            <div class="wa-noselect-divider"></div>
            <p class="wa-noselect-tip">从左侧列表选择一个会话开始沟通</p>
            <p class="wa-noselect-encrypt">🔒 您的个人消息已启用端到端加密</p>
          </div>
        </template>

        <template v-else>
          <div v-if="chatStore.loadingMessages" class="msgs-loading"><span class="loading-dots">加载消息中</span></div>
          <template v-for="(group, gIdx) in groupedMessages" :key="gIdx">
            <div class="msg-date-divider"><span>{{ group.label }}</span></div>
            <div v-for="msg in group.msgs" :key="msg.id" class="msg"
              :class="{ incoming: !msg.fromMe, outgoing: msg.fromMe, 'msg-selected': selectedMsgIds.has(msg.id), 'msg-editing': chatStore.editingMsgId===msg.id }"
              @contextmenu.prevent="onMsgContextMenu($event, msg)"
              @touchstart.passive="onMsgTouchStart($event, msg)"
              @touchend="onMsgTouchEnd"
              @touchmove="onMsgTouchMove"
              @mouseenter="onMsgHoverIn(msg)"
              @mouseleave="onMsgHoverOut(msg)"
            >
              <!-- Multi-select checkbox -->
              <div v-if="multiSelectMode" class="msg-select-check" @click.stop="toggleSelectMsg(msg)">
                <span class="msc-box" :class="{checked: selectedMsgIds.has(msg.id)}">
                  <svg v-if="selectedMsgIds.has(msg.id)" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#fff" stroke-width="3"><path d="M5 12l5 5L20 7"/></svg>
                </span>
              </div>
              <!-- Emoji quick reaction bar on hover -->
              <div v-if="hoveredMsgId===msg.id && !multiSelectMode" class="msg-quick-reactions">
                <button v-for="e in hoverEmojis" :key="e" class="mqr-btn" @click.stop="onReaction(msg, e)">{{e}}</button>
              </div>
              <!-- reactions row on bubble -->
              <div v-if="msg.reactions && msg.reactions.length" class="msg-reactions-row">
                <span v-for="(r,i) in msg.reactions" :key="i" class="msg-reaction-chip" :class="{'mine': r.fromMe}">{{r.emoji}}</span>
              </div>
              <div v-if="editingMsgId===msg.id" class="msg-edit-wrap">
                <input ref="editInputEl" class="msg-edit-input" v-model="editingText" @keydown.enter="submitEdit(msg)" @keydown.esc="cancelEdit" @blur="cancelEdit"/>
              </div>
              <div v-else class="msg-bubble" :class="{ 'msg-bubble-media': isMediaMsg(msg) }">

                <template v-if="msg.messageType === 'video' || msg.type === 'video' || (msg.mimeType && msg.mimeType.startsWith('video/'))">
                  <div class="msg-media-video">
                    <video v-if="msg.mediaUrl || msg.previewDataUrl" controls preload="metadata" class="msg-video-player">
                      <source :src="msg.previewDataUrl || ('/api/wa/media?url=' + encodeURIComponent(msg.mediaUrl))" :type="msg.mimeType || 'video/mp4'"/>
                      您的浏览器不支持 video 标签
                    </video>
                    <div v-else class="msg-video-placeholder" @click="msg.mediaUrl || msg.id ? openMedia(msg) : null"><span style="font-size:32px;margin-bottom:6px;display:block;">📹</span><span>{{ msg.fileName || msg.body || '视频' }}</span><span v-if="msg.fromMe && !msg.mediaUrl" style="font-size:12px;opacity:.6;margin-top:4px;display:block;">视频上传后刷新可预览</span></div>
                  </div>
                  <div v-if="msg.body && msg.body !== '[视频]'" class="msg-caption">{{ msg.body }}</div>
                </template>
                <template v-else-if="msg.messageType === 'image' || msg.type === 'image'">
                  <a v-if="msg.mediaUrl && !msg.previewDataUrl" :href="'/api/wa/media?url=' + encodeURIComponent(msg.mediaUrl)" target="_blank" class="msg-media-img">
                    <img :src="msg.previewDataUrl || ('/api/wa/media?url=' + encodeURIComponent(msg.mediaUrl))" @error="onImgError($event)" alt="image" loading="lazy"/>
                  </a>
                  <div v-else class="msg-media-img">
                    <img :src="msg.previewDataUrl || (msg.mediaUrl ? '/api/wa/media?url=' + encodeURIComponent(msg.mediaUrl) : '')" @error="onImgError($event)" alt="image" loading="lazy"/>
                  </div>
                  <div v-if="msg.body && msg.body !== '[图片]'" class="msg-caption">{{ msg.body }}</div>
                </template>
                <template v-else-if="msg.messageType === 'document' || msg.type === 'document'">
                  <div
                    v-if="msg.mediaUrl"
                    class="msg-media-doc msg-media-doc-link"
                    :class="{ 'msg-media-pdf': isPreviewableMsg(msg) }"
                    @click="onMediaDocClick(msg)"
                  >
                    <div class="mmd-icon">{{ isPdfMsg(msg) ? '📕' : (isPreviewableMsg(msg) ? '👁' : '📄') }}</div>
                    <div class="mmd-info">
                      <div class="mmd-name">{{ msg.fileName || msg.body || '文件' }}</div>
                      <div class="mmd-size">{{ isPreviewableMsg(msg) ? (msg.fileSize ? formatFileSize(msg.fileSize) + ' · 点击预览' : '点击预览') : (msg.fileSize ? formatFileSize(msg.fileSize) : '点击下载') }}</div>
                    </div>
                    <a v-if="!isPreviewableMsg(msg)" class="mmd-download-hidden" :href="'/api/wa/media?url=' + encodeURIComponent(msg.mediaUrl) + '&dl=1'" :download="msg.fileName || 'file'" target="_blank"></a>
                  </div>
                  <div v-else-if="msg.fromMe || msg.direction === 'outbound'" class="msg-media-doc msg-media-doc-sent msg-media-doc-link"
                       :class="{ 'msg-media-pdf': isPreviewableMsg(msg) }"
                       @click="onMediaDocClick(msg)"
                  >
                    <div class="mmd-icon">{{ isPdfMsg(msg) ? '📕' : (isPreviewableMsg(msg) ? '👁' : '📄') }}</div>
                    <div class="mmd-info">
                      <div class="mmd-name">{{ msg.fileName || msg.body || '文件' }}</div>
                      <div class="mmd-size">{{ (msg.fileSize ? formatFileSize(msg.fileSize) + ' · ' : '') + (msg.pending ? '发送中…' : (isPreviewableMsg(msg) ? '点击预览' : '已发送 · 点击下载')) }}</div>
                    </div>
                  </div>
                  <div v-else class="msg-media-doc">
                    <div class="mmd-icon">📄</div>
                    <div class="mmd-info">
                      <div class="mmd-name">{{ msg.fileName || msg.body || '文件' }}</div>
                      <div class="mmd-size">文件不可用</div>
                    </div>
                  </div>
                  <div v-if="msg.body && msg.body !== (msg.fileName||'') && msg.body !== '[文件]' && msg.body !== '[文档]'" class="msg-caption">{{ msg.body }}</div>
                </template>
                <template v-else-if="msg.messageType === 'reaction' || msg.type === 'reaction'">
                  <div class="msg-reaction-bubble">{{ msg.body || '👍' }}</div>
                </template>
                <template v-else>
                  <div class="msg-text">{{ msgPrimaryText(msg) }}</div>
                </template>
                <div v-if="msg.translation" class="msg-translation">
                  <span class="msg-trans-text">{{ getTranslationText(msg) }}</span>
                  <button
                    class="msg-retranslate-btn"
                    :class="{ spinning: retranslatingIds.has(msg.id) }"
                    :disabled="retranslatingIds.has(msg.id)"
                    title="重新翻译"
                    @click.stop="onRetranslate(msg)"
                  >
                    <svg v-if="!retranslatingIds.has(msg.id)" viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>
                    <span v-else class="msg-retrans-spin"></span>
                  </button>
                </div>

              <button class="msg-menu-btn" :class="{ 'menu-outgoing': msg.fromMe, 'menu-incoming': !msg.fromMe, 'menu-active': msgMenuOpenFor===msg.id }" @click.stop="toggleMsgMenu(msg)">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
              </button>
              <div v-if="msgMenuOpenFor===msg.id" class="msg-context-menu" :class="{ 'cm-bubble-out': msg.fromMe, 'cm-bubble-in': !msg.fromMe }" @click.stop>
                <button class="cm-item" @click="onReplyMsg(msg)">💬 回复</button>
                <button class="cm-item" @click="onCopyMsg(msg)">📋 复制</button>
                <button class="cm-item cm-item-reactions" @mouseenter="emojiPickerFor=msg.id" @mouseleave="emojiPickerFor=null">
                  😀 表情回应
                  <div v-if="emojiPickerFor===msg.id" class="emoji-picker-pop" @click.stop>
                    <button v-for="e in quickEmojis" :key="e" class="emoji-pick-btn" @click="onReaction(msg,e)">{{e}}</button>
                  </div>
                </button>
                <button v-if="canEditMsg(msg)" class="cm-item" @click="onEditMsg(msg)">✏️ 编辑</button>
                <button class="cm-item cm-item-danger" @click="onDeleteMsg(msg)">🗑️ 删除</button>
              </div>
                                                <div class="msg-time">
                  {{ formatTime(msg.timestamp) }}
                  <span v-if="msg.fromMe && msg.ackError" class="msg-check error" title="发送失败">❌</span>
                  <span v-else-if="msg.fromMe && msg.pending" class="msg-check pending">⏳</span>
                  <span v-else-if="msg.fromMe && msg.readAt" class="msg-check read">✓✓</span>
                  <span v-else-if="msg.fromMe && msg.deliveredAt" class="msg-check delivered">✓✓</span>
                  <span v-else-if="msg.fromMe" class="msg-check sent">✓</span>
                </div>
              </div>
            </div>
          </template>
        </template>
      </div>

      <!-- 内嵌翻译对照确认面板（位于输入框上方） -->
      <div v-if="confirmPanelVisible" class="trans-confirm-panel">
        <div class="tcp-row tcp-top">
          <span class="tcp-label">译文:</span>
          <span class="tcp-text tcp-translated" :class="{ 'tcp-error': confirmError }">{{ confirmLoading ? '翻译中...' : confirmTranslated }}</span>
          <button class="tcp-swap" @click="swapConfirm" title="互换原文/译文">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" style="margin-right:2px"><path d="M16 17.01V10h-2v7.01h-3L15 21l4-3.99h-3zM9 3L5 6.99h3V14h2V6.99h3L9 3z"/></svg>
            <span>互换</span>
          </button>
        </div>
        <div class="tcp-divider"></div>
        <div class="tcp-row tcp-bottom">
          <span class="tcp-label">对照:</span>
          <span class="tcp-text tcp-original">{{ confirmOriginal }}</span>
        </div>
        <div class="tcp-tips">
          快捷键：Enter 发送译文 · Esc 取消 · Ctrl+T 只翻译不发送
        </div>
      </div>

      <!-- 多选操作栏 -->
      <div v-if="multiSelectMode" class="multi-select-bar">
        <button class="msb-btn" @click="selectAllMsgs">全选</button>
        <button class="msb-btn" @click="cancelMultiSelect">取消</button>
        <span class="msb-count">已选 {{ selectedMsgIds.size }} 条</span>
        <button class="msb-btn msb-danger" @click="deleteSelectedMsgs" :disabled="selectedMsgIds.size===0">删除</button>
      </div>

      <!-- 输入区 -->
      <!-- 回复引用条（在输入框上方） -->
      <div v-if="chatStore.replyTo" class="reply-quote-bar">
        <div class="rqb-line" :class="{'out': chatStore.replyTo.fromMe, 'in': !chatStore.replyTo.fromMe}"></div>
        <div class="rqb-info">
          <div class="rqb-name" :class="{'out': chatStore.replyTo.fromMe}">{{ chatStore.replyTo.name || '对方' }}</div>
          <div class="rqb-preview">{{ chatStore.replyTo.body }}</div>
        </div>
        <button class="rqb-close" @click="chatStore.clearReplyTo()" title="取消回复">✕</button>
      </div>

      <!-- 附件预览条（在输入框上方） -->
      <div v-if="chatStore.isConnected && chatStore.activeConversation && pendingFile" class="media-preview-bar">
        <div class="mpb-file">
          <img v-if="pendingMediaType === 'image'" class="mpb-thumb" :src="pendingFilePreview" alt="preview"/>
          <div v-else-if="pendingMediaType === 'video'" class="mpb-doc-icon">📹</div>
          <div v-else class="mpb-doc-icon">📄</div>
          <div class="mpb-info">
            <div class="mpb-name">{{ pendingFile.name }}</div>
            <div class="mpb-size">{{ formatFileSize(pendingFile.size) }}</div>
          </div>
        </div>
        <input class="mpb-caption" type="text" v-model="pendingCaption" placeholder="添加说明... (可选, Enter发送)"/>
        <button class="mpb-send" @click="sendPendingMedia" :disabled="sendingMedia" :title="sendingMedia ? '发送中' : '发送'">
          <span v-if="!sendingMedia"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg></span>
          <span v-else class="mpb-spin"></span>
        </button>
        <button class="mpb-cancel" @click="cancelPendingMedia" title="取消">✕</button>
      </div>

      <!-- AI 快捷建议条（仅移动端显示，位于附件预览条下方、输入框上方） -->
      <div v-if="aiSuggestVisible" class="ai-suggest-bar">
        <span class="aisb-icon" title="AI 建议">✨</span>
        <div class="aisb-scroll">
          <div v-if="aiSuggestLoading" class="aisb-skeleton-wrap">
            <span class="aisb-skeleton"></span>
            <span class="aisb-skeleton"></span>
            <span class="aisb-skeleton"></span>
          </div>
          <template v-else>
            <button v-for="(s, idx) in aiSuggestReplies" :key="'aisb-'+idx" class="aisb-chip" :class="{'with-zh': s && s.zh}" @click="onSuggestClick(s)">
              <span class="aisb-foreign">{{ s.foreign || s }}</span>
              <span v-if="s && s.zh" class="aisb-zh">{{ s.zh }}</span>
            </button>
          </template>
        </div>
        <button class="aisb-refresh" :disabled="aiSuggestLoading" title="刷新建议" @click="refreshAiSuggests">🔄</button>
      </div>

      <div class="conv-input-area" v-if="chatStore.activeConversation">
        <div class="attach-wrap">
          <button class="input-action" title="添加" @click="toggleAttachMenu"><svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg></button>
          <div v-if="attachMenuOpen" class="attach-menu">
            <div class="attach-arrow"></div>
            <button class="attach-item" @click="pickImage">
              <span class="attach-icon" style="background:#00a884">🖼️</span>
              <span>图片/视频</span>
            </button>
            <button class="attach-item" @click="pickDocument">
              <span class="attach-icon" style="background:#53bdeb">📄</span>
              <span>文件</span>
            </button>
          </div>
        </div>
        <input ref="imageInput" type="file" accept="image/*,video/*" style="display:none" @change="onFileSelected($event,'image')"/>
        <input ref="docInput" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar,.csv,application/*" style="display:none" @change="onFileSelected($event,'document')"/>
        <div class="input-wrap">
          <input ref="inputEl" type="text" v-model="draftMsg" placeholder="输入消息... (Enter发送)" @keydown="onInputKeydown" @input="onDraftInput"/>
          <button class="emoji-btn" title="表情">😊</button>
        </div>
        <!-- Voice recording state bar -->
        <div v-if="isRecording" class="recording-bar">
          <span class="rec-dot"></span>
          <span class="rec-time">{{ formatRecTime(recordingDuration) }}</span>
          <button class="rec-cancel-btn" @click="cancelRecording">取消</button>
          <button class="rec-send-btn" @click="stopRecording">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
          </button>
        </div>
        <!-- Mic button (when no text) -->
        <button v-if="!pendingFile && !draftMsg.trim() && !isRecording" class="send-btn mic-btn" @click="startRecording" title="语音输入">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5zm6 6c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>
        </button>
        <!-- Send button (when has text) -->
        <button v-if="!pendingFile && draftMsg.trim() && !isRecording" class="send-btn" :class="{disabled: !draftMsg.trim()}" :disabled="!draftMsg.trim()" @click="onSendClick"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg></button>
      </div>





      <!-- Toast 提示 -->
      <div ref="_toastEl" class="wa-toast">{{ _toastText }}</div>

      <!-- PDF 全屏预览层 -->
      <div v-if="pdfPreviewUrl" class="pdf-preview-overlay" @click.self="closePdfPreview" @keydown.esc="closePdfPreview">
        <div class="pdf-preview-toolbar">
          <span class="pdf-preview-fname">{{ pdfPreviewFileName || 'PDF 预览' }}</span>
          <a class="pdf-preview-download" :href="pdfPreviewUrl.replace('&inline=1','&dl=1').replace('&download=0','')" :download="pdfPreviewFileName || 'document.pdf'" target="_blank" title="下载">⬇ 下载</a>
          <a class="pdf-preview-newwin" :href="pdfPreviewUrl" target="_blank" rel="noopener" title="新窗口打开">↗ 新窗口</a>
          <button class="pdf-preview-close" @click="closePdfPreview" title="关闭">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
          </button>
        </div>
        <iframe class="pdf-preview-frame" :src="pdfPreviewUrl" frameborder="0"></iframe>
      </div>

    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, onBeforeUnmount, nextTick, watch, reactive, inject } from 'vue';
import { useRoute, useRouter } from 'vue-router';
const cultureInfo = inject('cultureInfo', computed(() => null));
const cultureWorkStatus = inject('cultureWorkStatus', computed(() => ({status:'none',icon:'',tip:'',localTime:''})));
const cultureIso = inject('cultureIso', computed(() => null));
function openCulturePanel() {
  window.dispatchEvent(new CustomEvent('open-culture-panel'));
}
import { useChatStore } from '../stores/chat.js';
import { useSocket } from '../utils/socket.js';
import api from '../utils/api.js';
import { ElMessage, ElMessageBox } from 'element-plus';

const emit = defineEmits(['go-back','open-translate-panel']);
const chatStore = useChatStore();

const route = useRoute();
const router = useRouter();

// ── ⚡ 5分钟首响：当前会话是否为首响客户 ──
const frWaitDismissedJids = reactive({});
// 切换会话时，如果该客户有新消息（firstResponseMap更新），重新显示
watch(() => chatStore.activeJid, () => {
  // 新会话不自动dismiss，只有点"知道了"才隐藏
});
const activeFirstResponse = computed(() => {
  if (!chatStore.activeJid) return null;
  return chatStore.firstResponseMapByJid?.[chatStore.activeJid] || null;
});
// 实时秒数计时
const activeFirstResponseLive = reactive({ minutes: 0, seconds: 0 });
// 自动接待步骤流（whatsapp:auto-step）
const autoStepsByJid = reactive({});
let autoStepSocketHandler = null;
const activeAutoSteps = computed(() => (autoStepsByJid[chatStore.activeJid] || []).slice(-8));
let frLiveTimer = null;
function updateFrLive() {
  const fr = activeFirstResponse.value;
  if (!fr?.lastMessageTime) { activeFirstResponseLive.minutes = 0; activeFirstResponseLive.seconds = 0; return; }
  const diff = Date.now() - new Date(fr.lastMessageTime).getTime();
  const totalSec = Math.max(0, Math.floor(diff / 1000));
  activeFirstResponseLive.minutes = Math.floor(totalSec / 60);
  activeFirstResponseLive.seconds = totalSec % 60;
}
watch(activeFirstResponse, (v) => {
  if (frLiveTimer) { clearInterval(frLiveTimer); frLiveTimer = null; }
  if (v) {
    updateFrLive();
    frLiveTimer = setInterval(updateFrLive, 1000);
  }
}, { immediate: true });
onBeforeUnmount(() => { if (frLiveTimer) clearInterval(frLiveTimer); });


// ── Phase 4: Conversation Manager ──
const convStatus = ref(null);
const convStatusLoading = ref(false);
const convDetailOpen = ref(false);
const convScriptOpen = ref(false);
const convScript = ref(null);
const convScriptLoading = ref(false);
const closingReplyLoading = ref(false);
const closingReplyResult = ref(null);
const closingReplyOpen = ref(false);
// Phase 5: Script length selector
const scriptLength = ref('medium');
const scriptLengths = [
  { key: 'short', label: '短版', icon: '⚡' },
  { key: 'medium', label: '标准', icon: '📝' },
  { key: 'long', label: '长版', icon: '📧' },
];

async function fetchConvStatus() {
  if (!chatStore.activeJid) return;
  convStatusLoading.value = true;
  try {
    const encoded = encodeURIComponent(chatStore.activeJid);
    const res = await api.get(`/customers/by-jid/${encoded}/conversation-status`);
    convStatus.value = res.data;
  } catch (e) {
    console.warn('[ConvStatus] fetch error:', e.message);
    convStatus.value = null;
  } finally {
    convStatusLoading.value = false;
  }
}

async function generateConvScript(type = null) {
  if (!chatStore.activeJid) return;
  convScriptLoading.value = true;
  try {
    const encoded = encodeURIComponent(chatStore.activeJid);
    const body = type ? { type } : {};
    const res = await api.post(`/customers/by-jid/${encoded}/generate-script`, body);
    convScript.value = res.data;
    convScriptOpen.value = true;
  } catch (e) {
    console.error('[ConvScript] error:', e.message);
    ElMessage.error('生成话术失败: ' + (e.response?.data?.error || e.message));
  } finally {
    convScriptLoading.value = false;
  }
}

async function generateClosingReply() {
  if (!chatStore.activeJid) return;
  closingReplyLoading.value = true;
  try {
    const res = await api.post('/ai/closing-reply', { jid: chatStore.activeJid });
    if (res.data.replies && res.data.replies.length > 0) {
      closingReplyResult.value = res.data;
      closingReplyOpen.value = true;
    } else {
      ElMessage.warning(res.data.error || '暂无足够信息生成成交回复');
    }
  } catch (e) {
    console.error('[ClosingReply] error:', e.message);
    ElMessage.error('生成成交回复失败: ' + (e.response?.data?.error || e.message));
  } finally {
    closingReplyLoading.value = false;
  }
}

function copyClosingReply(text) {
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => {
    ElMessage.success('已复制到剪贴板');
  }).catch(() => {
    ElMessage.error('复制失败');
  });
}

function insertClosingToInput(text) {
  if (!text) return;
  const input = document.querySelector('.chat-input textarea') || document.querySelector('#chatInput');
  if (input) {
    input.value = text;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.focus();
    ElMessage.success('已插入聊天框');
  } else {
    navigator.clipboard.writeText(text).then(() => {
      ElMessage.success('已复制到剪贴板');
    });
  }
}

async function resetConvState() {
  if (!chatStore.activeJid) return;
  try {
    const encoded = encodeURIComponent(chatStore.activeJid);
    await api.post(`/customers/by-jid/${encoded}/conversation-status/reset`);
    convStatus.value = null;
    await fetchConvStatus();
    ElMessage.success('对话状态已重置');
  } catch (e) {
    ElMessage.error('重置失败');
  }
}

function copyScript(lang) {
  const text = lang === 'en' ? convScript.value?.script_en : convScript.value?.script_cn;
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => {
    ElMessage.success(lang === 'en' ? '英文话术已复制' : '中文话术已复制');
  }).catch(() => {
    ElMessage.error('复制失败');
  });
}

function insertScriptToInput() {
  if (convScript.value?.script_en) {
    draftMsg.value = convScript.value.script_en;
    convScriptOpen.value = false;
    nextTick(() => { inputEl.value?.focus(); });
  }
}

// Phase 5: Re-generate script with current length preference
async function regenerateConvScript() {
  if (!chatStore.activeJid) return;
  convScriptLoading.value = true;
  try {
    const encoded = encodeURIComponent(chatStore.activeJid);
    // Pass length hint to the generate-script endpoint
    const type = convScript.value?.strategy === 'PROVIDE_QUOTE' ? 'quote' : 'ask';
    const res = await api.post(`/customers/by-jid/${encoded}/generate-script`, { type, length: scriptLength.value });
    convScript.value = res.data;
  } catch (e) {
    ElMessage.error('生成话术失败: ' + (e.response?.data?.error || e.message));
  } finally {
    convScriptLoading.value = false;
  }
}

function completenessColor(val) {
  if (val >= 0.8) return '#00a884';
  if (val >= 0.5) return '#f0b429';
  return '#e74c3c';
}

function stageLabel(stage) {
  const map = {
    '首次询盘': '🆕 First Inquiry',
    '需求明确': '📋 Needs Clear',
    '报价阶段': '💰 Quoting',
    '谈判阶段': '🤝 Negotiating',
    '已成交': '✅ Won',
  };
  return map[stage] || stage;
}

// Watch active conversation changes
watch(() => chatStore.activeJid, () => {
  convStatus.value = null;
  convScript.value = null;
  convScriptOpen.value = false;
  convDetailOpen.value = false;
  if (chatStore.activeJid) {
    fetchConvStatus();
  }
}, { immediate: true });

const draftMsg = ref('');
const msgArea = ref(null);
const inputEl = ref(null);
const imageInput = ref(null);
const docInput = ref(null);
const attachMenuOpen = ref(false);
const pendingFile = ref(null);
const pendingMediaType = ref('document');
const pendingFilePreview = ref(null);
const pendingCaption = ref('');
const sendingMedia = ref(false);
const hoveredMsgId = ref(null);
const msgMenuOpenFor = ref(null);
const emojiPickerFor = ref(null);
const quickEmojis = ['👍','❤️','😂','😮','😢','🙏'];
const hoverEmojis = ['❤️','👍','🔥','😍','😄'];

// ── Multi-select mode ──
const multiSelectMode = ref(false);
const selectedMsgIds = reactive(new Set());
function toggleSelectMsg(msg) {
  if (selectedMsgIds.has(msg.id)) selectedMsgIds.delete(msg.id);
  else selectedMsgIds.add(msg.id);
}
function selectAllMsgs() {
  const msgs = chatStore.currentMessages || [];
  msgs.forEach(m => selectedMsgIds.add(m.id));
}
function cancelMultiSelect() {
  multiSelectMode.value = false;
  selectedMsgIds.clear();
}
function deleteSelectedMsgs() {
  if (selectedMsgIds.size === 0) return;
  const count = selectedMsgIds.size;
  if (!confirm(`确定删除 ${count} 条消息？（仅本地隐藏，对方仍可见）`)) return;
  const jid = chatStore.activeJid;
  for (const id of selectedMsgIds) {
    chatStore.localDeleteMessage(jid, id);
  }
  cancelMultiSelect();
}
function onSelectMsg(msg) {
  msgMenuOpenFor.value = null;
  emojiPickerFor.value = null;
  multiSelectMode.value = true;
  selectedMsgIds.add(msg.id);
}

// ── Long-press (mobile context menu) ──
let longPressTimer = null;
let longPressFired = false;
function onMsgTouchStart(e, msg) {
  longPressFired = false;
  longPressTimer = setTimeout(() => {
    longPressFired = true;
    onMsgContextMenu(e.touches ? e : { clientX: 0, clientY: 0, target: e.target }, msg);
  }, 500);
}
function onMsgTouchEnd() {
  if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
}
function onMsgTouchMove() {
  if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
}

// ── Right-click context menu (desktop) ──
const contextMenuPos = reactive({ x: 0, y: 0 });
const contextMenuMsg = ref(null);
function onMsgContextMenu(e, msg) {
  // Close any existing bubble menu, open new one
  msgMenuOpenFor.value = msg.id;
  emojiPickerFor.value = null;
  contextMenuMsg.value = msg;
  // Position context menu at cursor
  if (e.clientX !== undefined) {
    contextMenuPos.x = e.clientX;
    contextMenuPos.y = e.clientY;
  }
}

// ── Hover emoji quick reactions ──
let hoverTimer = null;
function onMsgHoverIn(msg) {
  if (multiSelectMode.value) return;
  if (hoverTimer) clearTimeout(hoverTimer);
  hoverTimer = setTimeout(() => { hoveredMsgId.value = msg.id; }, 300);
}
function onMsgHoverOut(msg) {
  if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null; }
  // Small delay so user can move to reaction buttons
  setTimeout(() => {
    if (hoveredMsgId.value === msg.id) hoveredMsgId.value = null;
  }, 200);
}

// ── Voice recording (MediaRecorder API) ──
const isRecording = ref(false);
const recordingDuration = ref(0);
let mediaRecorder = null;
let audioChunks = [];
let recTimer = null;

function getSupportedMimeType() {
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/ogg', 'audio/mp4'];
  for (const t of types) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return '';
}

async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = getSupportedMimeType();
    const options = mimeType ? { mimeType } : {};
    mediaRecorder = new MediaRecorder(stream, options);
    audioChunks = [];
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunks.push(e.data);
    };
    mediaRecorder.onstop = () => {
      stream.getTracks().forEach(t => t.stop());
      if (audioChunks.length > 0) {
        const blob = new Blob(audioChunks, { type: mimeType || 'audio/webm' });
        const ext = mimeType.includes('ogg') ? 'ogg' : (mimeType.includes('mp4') ? 'mp4' : 'webm');
        const file = new File([blob], `voice_${Date.now()}.${ext}`, { type: mimeType || 'audio/webm' });
        // Use existing sendMedia flow
        chatStore.sendMedia(chatStore.activeJid, file, 'audio', '');
        scrollToBottom();
      }
      audioChunks = [];
      mediaRecorder = null;
    };
    mediaRecorder.start();
    isRecording.value = true;
    recordingDuration.value = 0;
    recTimer = setInterval(() => { recordingDuration.value++; }, 1000);
  } catch (err) {
    console.error('Microphone access denied:', err);
    ElMessage.error('无法访问麦克风，请检查浏览器权限');
  }
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
  isRecording.value = false;
  if (recTimer) { clearInterval(recTimer); recTimer = null; }
  recordingDuration.value = 0;
}

function formatRecTime(sec) {
  const m = Math.floor(sec / 60).toString().padStart(2, 0);
  const s = (sec % 60).toString().padStart(2, 0);
  return `${m}:${s}`;
}

function cancelRecording() {
  audioChunks = [];
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.onstop = null; // Prevent sending
    mediaRecorder.stop();
  }
  isRecording.value = false;
  if (recTimer) { clearInterval(recTimer); recTimer = null; }
  recordingDuration.value = 0;
  mediaRecorder = null;
}

// ── Translate message (context menu action) ──
async function onTranslateMsg(msg) {
  msgMenuOpenFor.value = null;
  emojiPickerFor.value = null;
  const text = msg.body || msg.content || '';
  if (!text) return;
  try {
    const apiMod = await getApi();
    await apiMod.post('/whatsapp/retranslate', { messageId: msg.id });
    showToast('翻译已请求');
  } catch (e) {
    console.error('Translate msg failed:', e);
    ElMessage.error('翻译失败');
  }
}
const editingText = ref('');
const editInputEl = ref(null);
const canEditMsg = (msg) => {
  if (!msg || !msg.fromMe) return false;
  // 只要是纯文本消息就允许编辑（降级为发修正消息，无需15分钟限制）
  const mt = msg.messageType || msg.type || 'text';
  if (mt !== 'text' && mt !== 'conversation' && mt !== 'extendedText') return false;
  // 非文本（图片/视频/文档）不能编辑
  if (msg.mediaUrl || msg.fileName) return false;
  return true;
};

// ── AI 快捷建议条（仅移动端） ──
const aiSuggestReplies = ref([]);
const aiSuggestLoading = ref(false);
const aiSuggestHiddenByInput = ref(false); // 用户开始输入后隐藏
const isMobileView = ref(false);
let aiSuggestAbort = 0;
let aiSuggestSocketHandler = null;

function updateMobileView() {
  isMobileView.value = window.innerWidth <= 900;
}
const aiSuggestVisible = computed(() => {
  if (!isMobileView.value) return false;
  if (!chatStore.isConnected || !chatStore.activeConversation) return false;
  if (!chatStore.activeJid) return false;
  // 仅在该会话有消息记录时显示（至少一条入站消息）
  const msgs = chatStore.currentMessages || [];
  const hasIncoming = msgs.some(m => !m.fromMe);
  if (!hasIncoming) return false;
  // 输入框已有文字则隐藏
  if (draftMsg.value && draftMsg.value.trim()) return false;
  if (aiSuggestHiddenByInput.value) return false;
  // loading 或有建议时显示
  return aiSuggestLoading.value || aiSuggestReplies.value.length > 0;
});

async function refreshAiSuggests() {
  const jid = chatStore.activeJid;
  if (!jid || !isMobileView.value) return;
  const mySeq = ++aiSuggestAbort;
  aiSuggestLoading.value = true;
  aiSuggestHiddenByInput.value = false;
  aiSuggestReplies.value = [];
  try {
    const res = await chatStore.fetchQuickReplies(jid, chatStore.replyStyle || 'formal');
    if (mySeq !== aiSuggestAbort) return; // 被新请求覆盖
    aiSuggestReplies.value = (res?.replies || []).slice(0, 3);
  } catch (e) {
    if (mySeq !== aiSuggestAbort) return;
    console.warn('[AI suggest] fetch failed, silent hide:', e?.message || e);
    aiSuggestReplies.value = [];
  } finally {
    if (mySeq === aiSuggestAbort) aiSuggestLoading.value = false;
  }
}

function onSuggestClick(s) {
  const text = (s && s.foreign) ? s.foreign : (typeof s === 'string' ? s : '');
  if (!text) return;
  // 点击建议 → 填入输入框，隐藏建议条（不再自动发送）
  _applyAiReplyRef(text);
  aiSuggestHiddenByInput.value = true;
  aiSuggestReplies.value = [];
}
// 占位引用，applyAiReply 定义后会赋值
let _applyAiReplyRef = (text) => { draftMsg.value = String(text); };
function onDraftInput() {
  // 用户开始输入后隐藏建议条
  if (!aiSuggestHiddenByInput.value) {
    aiSuggestHiddenByInput.value = true;
  }
}

function toggleAttachMenu(e) {
  attachMenuOpen.value = !attachMenuOpen.value;
}
function closeAttachMenu() { attachMenuOpen.value = false; }

function pickImage() {
  closeAttachMenu();
  imageInput.value?.click();
}
function pickDocument() {
  closeAttachMenu();
  docInput.value?.click();
}

function onFileSelected(e, mediatype) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  // WhatsApp官方大小限制：图片5MB/视频16MB/音频16MB/文档100MB
  let sizeLimit = 100 * 1024 * 1024; // default document 100MB
  let typeLabel = '文件';
  if (file.type && file.type.startsWith('image/')) {
    sizeLimit = 16 * 1024 * 1024;
    typeLabel = '图片';
  } else if (file.type && file.type.startsWith('video/')) {
    sizeLimit = 16 * 1024 * 1024;
    typeLabel = '视频';
  } else if (file.type && file.type.startsWith('audio/')) {
    sizeLimit = 16 * 1024 * 1024;
    typeLabel = '音频';
  }
  if (file.size > sizeLimit) {
    const mb = (sizeLimit / 1024 / 1024);
    const fSizeMB = (file.size / 1024 / 1024).toFixed(1);
    ElMessageBox.alert(
      typeLabel + '大小 ' + fSizeMB + 'MB，超过WhatsApp ' + mb + 'MB 限制，无法发送，请压缩后再试。',
      '文件过大',
      { type: 'warning', confirmButtonText: '我知道了', center: true, customClass: 'size-alert-modal' }
    ).catch(function(){});
    e.target.value = '';
    return;
  }
  // Auto-detect media type by MIME when coming from the photo/video picker
  let detectedType = mediatype;
  if (mediatype === 'image') {
    if (file.type && file.type.startsWith('video/')) {
      detectedType = 'video';
    } else if (file.type && file.type.startsWith('image/')) {
      detectedType = 'image';
    } else {
      detectedType = 'image';
    }
  }
  pendingFile.value = file;
  pendingMediaType.value = detectedType;
  pendingCaption.value = '';
  pendingFilePreview.value = null;
  if (detectedType === 'image') {
    const reader = new FileReader();
    reader.onload = () => { pendingFilePreview.value = reader.result; };
    reader.readAsDataURL(file);
  }
  e.target.value = '';
}

function cancelPendingMedia() {
  pendingFile.value = null;
  pendingFilePreview.value = null;
  pendingCaption.value = '';
  sendingMedia.value = false;
  if (chatStore.stagedMedia) chatStore.clearStagedMedia?.();
}

async function sendPendingMedia() {
  if (!pendingFile.value || sendingMedia.value) return;
  if (!chatStore.activeJid) return;
  sendingMedia.value = true;
  try {
    await chatStore.sendMedia(chatStore.activeJid, pendingFile.value, pendingMediaType.value, pendingCaption.value.trim());
    chatStore.clearStagedMedia?.();
    cancelPendingMedia();
    scrollToBottom();
  } catch (err) {
    ElMessage.error('媒体发送失败: ' + (err?.response?.data?.error || err?.message || '未知错误'));
    sendingMedia.value = false;
  }
}


// ── 监听 stagedMedia：外部（如AI单证面板）预挂文件到输入框附件条 ──
watch(() => chatStore.stagedMedia?._ts, (ts) => {
  if (!ts) return;
  const sm = chatStore.stagedMedia;
  if (!sm || !sm.file) return;
  const file = sm.file;
  const mt = sm.mediatype || 'document';
  pendingFile.value = file;
  pendingMediaType.value = mt;
  pendingCaption.value = sm.caption || '';
  pendingFilePreview.value = null;
  if (mt === 'image' && file.type && file.type.startsWith('image/')) {
    const reader = new FileReader();
    reader.onload = () => { pendingFilePreview.value = reader.result; };
    reader.readAsDataURL(file);
  }
}, { flush: 'post' });

// ── 重翻译 & PDF 预览 ──
const retranslatingIds = reactive(new Set());
const pdfPreviewUrl = ref('');
const pdfPreviewFileName = ref('');

function isPdfMsg(msg) {
  if (!msg) return false;
  const mt = (msg.mimeType || '').toLowerCase();
  const fn = (msg.fileName || '').toLowerCase();
  return mt === 'application/pdf' || fn.endsWith('.pdf');
}

function isMediaMsg(msg) {
  if (!msg) return false;
  const mt = msg.messageType || msg.type || '';
  if (mt === 'image' || mt === 'video') return true;
  if (msg.mimeType && (msg.mimeType.startsWith('image/') || msg.mimeType.startsWith('video/'))) return true;
  return false;
}

// 是否可在浏览器在线预览（pdf/图片/文本类）；Office 等二进制不在此列，保持下载
const PREVIEW_EXT = /\.(pdf|jpg|jpeg|png|gif|webp|svg|bmp|txt|csv|json|log|md|xml)$/i;
function isPreviewableMsg(msg) {
  if (!msg) return false;
  if (isPdfMsg(msg)) return true;
  const mt = (msg.mimeType || '').toLowerCase();
  if (mt.startsWith('image/') || mt.startsWith('text/')) return true;
  if (msg.fileName && PREVIEW_EXT.test(msg.fileName)) return true;
  return false;
}

async function onRetranslate(msg) {
  if (!msg || msg.id == null || retranslatingIds.has(msg.id)) return;
  retranslatingIds.add(msg.id);
  try {
    const api = await getApi();
    await api.post('/whatsapp/retranslate', { messageId: msg.id });
    // socket push (whatsapp:translation) will update UI via chatStore.handleMessageTranslated
  } catch (e) {
    console.error('[Retranslate] failed:', e);
    try { ElMessage.error('重新翻译失败：' + (e?.response?.data?.error || e.message || '未知错误')); } catch (_) {}
  } finally {
    // remove after a tick to allow socket event to arrive; keep spinning briefly for UX
    setTimeout(() => retranslatingIds.delete(msg.id), 400);
  }
}

function onMediaDocClick(msg) {
  if (!msg || !msg.mediaUrl) return;
  const mediaBase = '/api/wa/media?url=' + encodeURIComponent(msg.mediaUrl);
  if (isPreviewableMsg(msg)) {
    // 可在线预览类型（PDF/图片/文本类）：手机端新窗口打开 inline URL，PC 端 iframe 弹层预览
    // 浏览器原生阅读器负责预览；用户可在预览页下载
    const inlineUrl = mediaBase + '&inline=1&download=0';
    // 检测是否移动端
    const isMobileView = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || window.innerWidth <= 900;
    if (isMobileView) {
      // 手机端：新标签页打开（浏览器自带阅读器）
      window.open(inlineUrl, '_blank', 'noopener');
    } else {
      // PC端：保留iframe弹层预览（桌面Chrome/Firefox/Safari都支持iframe）
      pdfPreviewUrl.value = inlineUrl;
      pdfPreviewFileName.value = msg.fileName || 'document';
    }
  } else {
    // 其他类型（Office 等二进制）：直接下载
    const a = document.createElement('a');
    a.href = mediaBase + '&dl=1';
    a.download = msg.fileName || 'file';
    a.target = '_blank';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}

function closePdfPreview() { pdfPreviewUrl.value = ''; pdfPreviewFileName.value = ''; }

function onPdfKeydown(e) { if (e.key === 'Escape') closePdfPreview(); }

function formatFileSize(bytes) {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024*1024) return (bytes/1024).toFixed(1) + ' KB';
  return (bytes/1024/1024).toFixed(1) + ' MB';
}

function onImgError(e) {
  // hide broken image
  e.target.style.display = 'none';
}

// Close attach menu & context menu on outside click
function onDocClick(e) {
  if (attachMenuOpen.value && !e.target.closest('.attach-wrap')) attachMenuOpen.value = false;
  if (msgMenuOpenFor.value !== null && !e.target.closest('.msg-menu-btn') && !e.target.closest('.msg-context-menu') && !e.target.closest('.emoji-picker-pop')) {
    msgMenuOpenFor.value = null;
    emojiPickerFor.value = null;
  }
}
onMounted(() => { document.addEventListener('click', onDocClick); });
onBeforeUnmount(() => { document.removeEventListener('click', onDocClick); });


// ── 翻译设置（面板已移至 LayoutView） ──

// ── 内嵌翻译确认面板 ──
const confirmPanelVisible = ref(false);
const confirmLoading = ref(false);
const confirmError = ref(false);
const confirmOriginal = ref('');
const confirmTranslated = ref('');
const confirmSwapped = ref(false);
let confirmTranslateTimer = null;
let apiModule = null;
async function getApi() {
  if (!apiModule) apiModule = (await import('../utils/api.js')).default;
  return apiModule;
}

// 简单语言检测（中/阿/英）
function quickLang(text) {
  if (!text) return 'unknown';
  if (/[\u4e00-\u9fff]/.test(text)) return 'zh';
  if (/[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff]/.test(text)) return 'ar';
  return 'en';
}
// 判断是否需要翻译：sendEnabled 开启 且 源语言!=目标语言
function needsOutgoingTranslation(text) {
  const st = chatStore.translationSettings || {};
  if (!st.sendEnabled) return false;
  const tgt = st.sendTargetLang || 'en';
  if (tgt === 'auto') return false;
  const src = quickLang(text);
  // Latin family: treat en/es/fr/de/pt/it/nl/tr/id/vi as needing translation if target is ar/zh
  const latinFamily = ['en','es','fr','de','pt','it','nl','tr','id','vi'];
  if (src === tgt) return false;
  if (latinFamily.includes(src) && latinFamily.includes(tgt)) return false; // 拉丁语系内部不弹确认
  return true;
}

async function runPreTranslate(text) {
  const s = chatStore.translationSettings || {};
  confirmLoading.value = true;
  confirmError.value = false;
  confirmTranslated.value = '';
  try {
    const api = await getApi();
    const src = (s.sendSourceLang && s.sendSourceLang !== 'auto') ? s.sendSourceLang : 'auto';
    const tgt = s.sendTargetLang || 'en';
    const { data } = await api.post('/translation/translate', { text, from: src, to: tgt });
    const translated = (data && (data.translated || data.text)) || '';
    if (!translated) throw new Error('empty result');
    confirmTranslated.value = translated;
  } catch (e) {
    confirmError.value = true;
    confirmTranslated.value = '翻译失败，将发送原文';
  } finally {
    confirmLoading.value = false;
  }
}

function openConfirmPanel(text) {
  confirmPanelVisible.value = true;
  confirmSwapped.value = false;
  confirmOriginal.value = text;
  runPreTranslate(text);
  nextTick(() => { if (inputEl.value) inputEl.value.focus(); });
}
function closeConfirmPanel() {
  confirmPanelVisible.value = false;
  confirmOriginal.value = '';
  confirmTranslated.value = '';
  confirmSwapped.value = false;
  confirmError.value = false;
  confirmLoading.value = false;
  if (confirmTranslateTimer) { clearTimeout(confirmTranslateTimer); confirmTranslateTimer = null; }
}
function swapConfirm() { confirmSwapped.value = !confirmSwapped.value; }

// ── AI 话术面板调用：填入输入框并聚焦；如开启翻译确认且含中文则弹出译文确认 ──
function applyAiReply(text) {
  if (!text) return;
  // 先关闭旧的确认面板，避免残留译文
  closeConfirmPanel();
  draftMsg.value = String(text);
  nextTick(() => {
    if (inputEl.value) {
      inputEl.value.focus();
      // 将光标移到末尾
      try {
        const len = inputEl.value.value.length;
        inputEl.value.setSelectionRange(len, len);
      } catch(e) {}
    }
    if (needsOutgoingTranslation(draftMsg.value)) {
      const st = chatStore.translationSettings || {};
      if (st.translateConfirm) {
        openConfirmPanel(draftMsg.value);
      }
    }
  });
}
// 让 AI 建议条的 onSuggestClick 能复用 applyAiReply
_applyAiReplyRef = applyAiReply;
defineExpose({ applyAiReply, openAssignDialog });

// 输入框变更 -> 防抖重译
watch(draftMsg, (val) => {
  if (!confirmPanelVisible.value) return;
  confirmOriginal.value = val;
  if (confirmSwapped.value) confirmSwapped.value = false;
  if (confirmTranslateTimer) clearTimeout(confirmTranslateTimer);
  confirmTranslateTimer = setTimeout(() => {
    if (val && val.trim()) runPreTranslate(val.trim());
  }, 500);
});

function onInputKeydown(e) {
  if (confirmPanelVisible.value) {
    if (e.key === 'Enter') { e.preventDefault(); doSendConfirm(); return; }
    if (e.key === 'Escape') { e.preventDefault(); closeConfirmPanel(); return; }
    if ((e.ctrlKey || e.metaKey) && (e.key === 't' || e.key === 'T')) {
      e.preventDefault();
      if (confirmTranslated.value && !confirmError.value) {
        draftMsg.value = confirmTranslated.value;
        closeConfirmPanel();
      }
      return;
    }
  } else if (e.key === 'Enter') {
    e.preventDefault();
    onSendClick();
  }
}

// ─── 消息菜单操作 ───
function toggleMsgMenu(msg) {
  if (msgMenuOpenFor.value === msg.id) {
    msgMenuOpenFor.value = null;
    emojiPickerFor.value = null;
  } else {
    msgMenuOpenFor.value = msg.id;
    emojiPickerFor.value = null;
  }
}
function onReplyMsg(msg) {
  chatStore.setReplyTo(msg);
  msgMenuOpenFor.value = null;
  emojiPickerFor.value = null;
  nextTick(() => inputEl.value && inputEl.value.focus());
}
async function onCopyMsg(msg) {
  const text = msg.body || msg.content || msg.fileName || msg.caption || '';
  try {
    await navigator.clipboard.writeText(text);
    showToast('已复制');
  } catch(_) {
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch(__) {}
    document.body.removeChild(ta);
    showToast('已复制');
  }
  msgMenuOpenFor.value = null;
}
async function onReaction(msg, emoji) {
  await chatStore.sendReaction(chatStore.activeJid, msg, emoji);
  emojiPickerFor.value = null;
  msgMenuOpenFor.value = null;
}
function onEditMsg(msg) {
  editingMsgId.value = msg.id;
  editingText.value = msg.body || msg.content || '';
  msgMenuOpenFor.value = null;
  nextTick(() => { if (editInputEl.value) editInputEl.value.focus(); });
}
function cancelEdit() {
  editingMsgId.value = null;
  editingText.value = '';
}
async function submitEdit(msg) {
  const newText = editingText.value.trim();
  if (!newText || newText === (msg.body || '')) { cancelEdit(); return; }
  await chatStore.editMessage(chatStore.activeJid, msg.id, newText);
  cancelEdit();
}
function onDeleteMsg(msg) {
  msgMenuOpenFor.value = null;
  emojiPickerFor.value = null;
  if (!msg.fromMe) {
    showToast('只能删除自己发送的消息');
    return;
  }
  if (confirm('确定删除这条消息？（仅本地隐藏，对方仍可见）')) {
    chatStore.localDeleteMessage(chatStore.activeJid, msg.id);
    if (chatStore.replyTo && chatStore.replyTo.msgId === msg.id) chatStore.clearReplyTo();
  }
}
// toast helper
const _toastEl = ref(null);
const _toastText = ref('');
let _toastTimer = null;
function showToast(text) {
  _toastText.value = text;
  nextTick(() => {
    if (_toastEl.value) _toastEl.value.classList.add('show');
  });
  if (_toastTimer) clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => {
    if (_toastEl.value) _toastEl.value.classList.remove('show');
  }, 1800);
}

async function onSendClick() {
  const text = draftMsg.value.trim();
  if (!text || !chatStore.activeJid) return;
  const s = chatStore.translationSettings || {};
  const srcLang = quickLang(text);
  const tgtLang = s.sendTargetLang || 'en';
  const hasChinese = srcLang === 'zh';

  // 拦截：输入中文但没开翻译 → 阻止
  if (hasChinese && !s.sendEnabled) {
    ElMessage.error('请先开启发送翻译或输入外文消息');
    emit('open-translate-panel');
    return;
  }
  // blockChinese 兼容旧逻辑（保留）
  if (s.blockChinese && !s.sendEnabled && hasChinese) {
    ElMessage.error('请先开启发送翻译或输入英文消息');
    emit('open-translate-panel');
    return;
  }

  // 需要翻译且开启了翻译确认 → 弹确认面板
  if (needsOutgoingTranslation(text) && s.translateConfirm && !confirmPanelVisible.value) {
    openConfirmPanel(text);
    return;
  }

  doSendMsg();
}

function doSendConfirm() {
  let text;
  if (confirmSwapped.value) {
    text = confirmOriginal.value;
  } else if (confirmError.value || !confirmTranslated.value) {
    text = confirmOriginal.value;
  } else {
    text = confirmTranslated.value;
  }
  text = (text || '').trim();
  if (!text) return;
  doSendText(text);
  closeConfirmPanel();
}

function doSendText(text) {
  if (!text || !chatStore.activeJid) return;
  chatStore.sendMessage(chatStore.activeJid, text);
  chatStore.clearReplyTo();
  draftMsg.value = '';
  // 发送成功后隐藏建议条（直到下一次触发刷新）
  aiSuggestHiddenByInput.value = true;
  aiSuggestReplies.value = [];
  scrollToBottom();
}

function doSendMsg() { doSendText(draftMsg.value.trim()); }

function msgPrimaryText(msg) {
  // 出站消息：主气泡强制显示发给客户的外文(英文)原文；中文对照由 getTranslationText 放下方虚线
  const b = msg.body || msg.content || "";
  if (msg.fromMe || msg.direction === 'outbound' || msg.direction === 'outgoing') {
    const t = msg.translation;
    if (t && typeof t === 'object') {
      const cands = [t.translated, t.original, b].filter(x => x && typeof x === 'string');
      const foreign = cands.find(x => !/[一-鿿]/.test(x));
      if (foreign) return foreign;
    }
  }
  return b;
}

function getTranslationText(msg) {
  const t = msg.translation;
  if (!t) return "";
  if (typeof t === "string") return t;
  // 我方发出去的：
  //   气泡显示发出文本（body）
  //   虚线译文显示中文（优先 translated 如果是中文，否则 original 如果是中文）
  if (msg.fromMe) {
    // 优先显示中文内容（可能是 translated 回译或 original 原文）
    const hasChineseInOriginal = /[\u4e00-\u9fff]/.test(t.original || "");
    const hasChineseInTranslated = /[\u4e00-\u9fff]/.test(t.translated || "");
    if (hasChineseInTranslated) return t.translated;
    if (hasChineseInOriginal) return t.original;
    return t.translated || t.original || "";
  }
  // 对方发进来的：气泡显示原文外文，虚线显示中文译文 t.translated
  return t.translated || t.text || "";
}

const qrViewVisible = ref(false);
const startingQr = ref(false);
const qrError = ref(null);
const qrExpired = ref(false);
const qrCountdown = ref(0);
const stayLoggedIn = ref(true);
let qrTimer = null;

const chatLoginVisible = computed(() => chatStore.currentWaAccountId === null || !chatStore.isConnected);
// 欢迎卡主按钮：未选中账号→新建会话；已选中断开账号→登录
function onWelcomePrimary() {
  if (chatStore.currentWaAccountId === null) {
    window.dispatchEvent(new CustomEvent('wa:add-account'));
  } else {
    handleLoginClick();
  }
}

function startQrLogin(accountId) {
  startingQr.value = true; qrError.value = null; qrExpired.value = false; qrViewVisible.value = true;
  chatStore.requestQR(accountId).finally(() => { startingQr.value = false; });
}
function backToIntro() { qrViewVisible.value = false; phoneViewVisible.value = false; qrError.value = null; qrExpired.value = false; chatStore.clearPairing(); if (qrTimer) { clearInterval(qrTimer); qrTimer = null; } }
function retryQR() { qrError.value = null; qrExpired.value = false; chatStore.qrCode = null; chatStore.requestQR(chatStore.currentWaAccountId); }
function onHelpClick() { window.open('https://faq.whatsapp.com/1317546212400204', '_blank'); }
const phoneViewVisible = ref(false);
const phoneCountries = [

  { code: "+86", name: "中国", name_en: "China", flag: "🇨🇳" },
  { code: "+852", name: "中国香港", name_en: "Hong Kong", flag: "🇭🇰" },
  { code: "+853", name: "中国澳门", name_en: "Macau", flag: "🇲🇴" },
  { code: "+886", name: "中国台湾", name_en: "Taiwan", flag: "🇨🇳" },
  { code: "+1", name: "美国/加拿大", name_en: "USA/Canada", flag: "🇺🇸" },
  { code: "+1", name: "加拿大", name_en: "Canada", flag: "🇨🇦" },
  { code: "+44", name: "英国", name_en: "United Kingdom", flag: "🇬🇧" },
  { code: "+61", name: "澳大利亚", name_en: "Australia", flag: "🇦🇺" },
  { code: "+64", name: "新西兰", name_en: "New Zealand", flag: "🇳🇿" },
  { code: "+353", name: "爱尔兰", name_en: "Ireland", flag: "🇮🇪" },
  { code: "+81", name: "日本", name_en: "Japan", flag: "🇯🇵" },
  { code: "+82", name: "韩国", name_en: "South Korea", flag: "🇰🇷" },
  { code: "+65", name: "新加坡", name_en: "Singapore", flag: "🇸🇬" },
  { code: "+60", name: "马来西亚", name_en: "Malaysia", flag: "🇲🇾" },
  { code: "+66", name: "泰国", name_en: "Thailand", flag: "🇹🇭" },
  { code: "+84", name: "越南", name_en: "Vietnam", flag: "🇻🇳" },
  { code: "+62", name: "印度尼西亚", name_en: "Indonesia", flag: "🇮🇩" },
  { code: "+63", name: "菲律宾", name_en: "Philippines", flag: "🇵🇭" },
  { code: "+95", name: "缅甸", name_en: "Myanmar", flag: "🇲🇲" },
  { code: "+855", name: "柬埔寨", name_en: "Cambodia", flag: "🇰🇭" },
  { code: "+856", name: "老挝", name_en: "Laos", flag: "🇱🇦" },
  { code: "+673", name: "文莱", name_en: "Brunei", flag: "🇧🇳" },
  { code: "+91", name: "印度", name_en: "India", flag: "🇮🇳" },
  { code: "+92", name: "巴基斯坦", name_en: "Pakistan", flag: "🇵🇰" },
  { code: "+880", name: "孟加拉国", name_en: "Bangladesh", flag: "🇧🇩" },
  { code: "+94", name: "斯里兰卡", name_en: "Sri Lanka", flag: "🇱🇰" },
  { code: "+977", name: "尼泊尔", name_en: "Nepal", flag: "🇳🇵" },
  { code: "+971", name: "阿联酋", name_en: "UAE", flag: "🇦🇪" },
  { code: "+966", name: "沙特阿拉伯", name_en: "Saudi Arabia", flag: "🇸🇦" },
  { code: "+974", name: "卡塔尔", name_en: "Qatar", flag: "🇶🇦" },
  { code: "+965", name: "科威特", name_en: "Kuwait", flag: "🇰🇼" },
  { code: "+973", name: "巴林", name_en: "Bahrain", flag: "🇧🇭" },
  { code: "+968", name: "阿曼", name_en: "Oman", flag: "🇴🇲" },
  { code: "+967", name: "也门", name_en: "Yemen", flag: "🇾🇪" },
  { code: "+962", name: "约旦", name_en: "Jordan", flag: "🇯🇴" },
  { code: "+961", name: "黎巴嫩", name_en: "Lebanon", flag: "🇱🇧" },
  { code: "+963", name: "叙利亚", name_en: "Syria", flag: "🇸🇾" },
  { code: "+964", name: "伊拉克", name_en: "Iraq", flag: "🇮🇶" },
  { code: "+98", name: "伊朗", name_en: "Iran", flag: "🇮🇷" },
  { code: "+90", name: "土耳其", name_en: "Turkey", flag: "🇹🇷" },
  { code: "+972", name: "以色列", name_en: "Israel", flag: "🇮🇱" },
  { code: "+970", name: "巴勒斯坦", name_en: "Palestine", flag: "🇵🇸" },
  { code: "+20", name: "埃及", name_en: "Egypt", flag: "🇪🇬" },
  { code: "+212", name: "摩洛哥", name_en: "Morocco", flag: "🇲🇦" },
  { code: "+213", name: "阿尔及利亚", name_en: "Algeria", flag: "🇩🇿" },
  { code: "+216", name: "突尼斯", name_en: "Tunisia", flag: "🇹🇳" },
  { code: "+218", name: "利比亚", name_en: "Libya", flag: "🇱🇾" },
  { code: "+249", name: "苏丹", name_en: "Sudan", flag: "🇸🇩" },
  { code: "+234", name: "尼日利亚", name_en: "Nigeria", flag: "🇳🇬" },
  { code: "+27", name: "南非", name_en: "South Africa", flag: "🇿🇦" },
  { code: "+254", name: "肯尼亚", name_en: "Kenya", flag: "🇰🇪" },
  { code: "+233", name: "加纳", name_en: "Ghana", flag: "🇬🇭" },
  { code: "+251", name: "埃塞俄比亚", name_en: "Ethiopia", flag: "🇪🇹" },
  { code: "+255", name: "坦桑尼亚", name_en: "Tanzania", flag: "🇹🇿" },
  { code: "+256", name: "乌干达", name_en: "Uganda", flag: "🇺🇬" },
  { code: "+260", name: "赞比亚", name_en: "Zambia", flag: "🇿🇲" },
  { code: "+263", name: "津巴布韦", name_en: "Zimbabwe", flag: "🇿🇼" },
  { code: "+237", name: "喀麦隆", name_en: "Cameroon", flag: "🇨🇲" },
  { code: "+225", name: "科特迪瓦", name_en: "Ivory Coast", flag: "🇨🇮" },
  { code: "+221", name: "塞内加尔", name_en: "Senegal", flag: "🇸🇳" },
  { code: "+243", name: "刚果(金)", name_en: "DR Congo", flag: "🇨🇩" },
  { code: "+244", name: "安哥拉", name_en: "Angola", flag: "🇦🇴" },
  { code: "+258", name: "莫桑比克", name_en: "Mozambique", flag: "🇲🇿" },
  { code: "+261", name: "马达加斯加", name_en: "Madagascar", flag: "🇲🇬" },
  { code: "+49", name: "德国", name_en: "Germany", flag: "🇩🇪" },
  { code: "+33", name: "法国", name_en: "France", flag: "🇫🇷" },
  { code: "+34", name: "西班牙", name_en: "Spain", flag: "🇪🇸" },
  { code: "+39", name: "意大利", name_en: "Italy", flag: "🇮🇹" },
  { code: "+31", name: "荷兰", name_en: "Netherlands", flag: "🇳🇱" },
  { code: "+32", name: "比利时", name_en: "Belgium", flag: "🇧🇪" },
  { code: "+41", name: "瑞士", name_en: "Switzerland", flag: "🇨🇭" },
  { code: "+43", name: "奥地利", name_en: "Austria", flag: "🇦🇹" },
  { code: "+46", name: "瑞典", name_en: "Sweden", flag: "🇸🇪" },
  { code: "+47", name: "挪威", name_en: "Norway", flag: "🇳🇴" },
  { code: "+45", name: "丹麦", name_en: "Denmark", flag: "🇩🇰" },
  { code: "+358", name: "芬兰", name_en: "Finland", flag: "🇫🇮" },
  { code: "+351", name: "葡萄牙", name_en: "Portugal", flag: "🇵🇹" },
  { code: "+30", name: "希腊", name_en: "Greece", flag: "🇬🇷" },
  { code: "+48", name: "波兰", name_en: "Poland", flag: "🇵🇱" },
  { code: "+420", name: "捷克", name_en: "Czech Republic", flag: "🇨🇿" },
  { code: "+36", name: "匈牙利", name_en: "Hungary", flag: "🇭🇺" },
  { code: "+40", name: "罗马尼亚", name_en: "Romania", flag: "🇷🇴" },
  { code: "+380", name: "乌克兰", name_en: "Ukraine", flag: "🇺🇦" },
  { code: "+7", name: "俄罗斯", name_en: "Russia", flag: "🇷🇺" },
  { code: "+375", name: "白俄罗斯", name_en: "Belarus", flag: "🇧🇾" },
  { code: "+371", name: "拉脱维亚", name_en: "Latvia", flag: "🇱🇻" },
  { code: "+370", name: "立陶宛", name_en: "Lithuania", flag: "🇱🇹" },
  { code: "+372", name: "爱沙尼亚", name_en: "Estonia", flag: "🇪🇪" },
  { code: "+381", name: "塞尔维亚", name_en: "Serbia", flag: "🇷🇸" },
  { code: "+385", name: "克罗地亚", name_en: "Croatia", flag: "🇭🇷" },
  { code: "+421", name: "斯洛伐克", name_en: "Slovakia", flag: "🇸🇰" },
  { code: "+386", name: "斯洛文尼亚", name_en: "Slovenia", flag: "🇸🇮" },
  { code: "+359", name: "保加利亚", name_en: "Bulgaria", flag: "🇧🇬" },
  { code: "+55", name: "巴西", name_en: "Brazil", flag: "🇧🇷" },
  { code: "+52", name: "墨西哥", name_en: "Mexico", flag: "🇲🇽" },
  { code: "+54", name: "阿根廷", name_en: "Argentina", flag: "🇦🇷" },
  { code: "+56", name: "智利", name_en: "Chile", flag: "🇨🇱" },
  { code: "+57", name: "哥伦比亚", name_en: "Colombia", flag: "🇨🇴" },
  { code: "+51", name: "秘鲁", name_en: "Peru", flag: "🇵🇪" },
  { code: "+58", name: "委内瑞拉", name_en: "Venezuela", flag: "🇻🇪" },
  { code: "+593", name: "厄瓜多尔", name_en: "Ecuador", flag: "🇪🇨" },
  { code: "+598", name: "乌拉圭", name_en: "Uruguay", flag: "🇺🇾" },
  { code: "+595", name: "巴拉圭", name_en: "Paraguay", flag: "🇵🇾" },
  { code: "+591", name: "玻利维亚", name_en: "Bolivia", flag: "🇧🇴" },
  { code: "+507", name: "巴拿马", name_en: "Panama", flag: "🇵🇦" },
  { code: "+506", name: "哥斯达黎加", name_en: "Costa Rica", flag: "🇨🇷" },
  { code: "+503", name: "萨尔瓦多", name_en: "El Salvador", flag: "🇸🇻" },
  { code: "+502", name: "危地马拉", name_en: "Guatemala", flag: "🇬🇹" },
  { code: "+504", name: "洪都拉斯", name_en: "Honduras", flag: "🇭🇳" },
  { code: "+505", name: "尼加拉瓜", name_en: "Nicaragua", flag: "🇳🇮" },
  { code: "+509", name: "海地", name_en: "Haiti", flag: "🇭🇹" },
  { code: "+53", name: "古巴", name_en: "Cuba", flag: "🇨🇺" },
  { code: "+1809", name: "多米尼加", name_en: "Dominican Republic", flag: "🇩🇴" },
  { code: "+1876", name: "牙买加", name_en: "Jamaica", flag: "🇯🇲" },
  { code: "+1787", name: "波多黎各", name_en: "Puerto Rico", flag: "🇵🇷" },
  { code: "+1242", name: "巴哈马", name_en: "Bahamas", flag: "🇧🇸" },
  { code: "+1246", name: "巴巴多斯", name_en: "Barbados", flag: "🇧🇧" },
  { code: "+1268", name: "安提瓜和巴布达", name_en: "Antigua and Barbuda", flag: "🇦🇬" },
  { code: "+1868", name: "特立尼达和多巴哥", name_en: "Trinidad and Tobago", flag: "🇹🇹" }
];
const selectedCountry = ref(phoneCountries[0]);
const phoneLocal = ref('');
const phoneCountryOpen = ref(false);
const phoneCountrySearch = ref('');
const filteredPhoneCountries = computed(() => {
  const kw = phoneCountrySearch.value.trim().toLowerCase();
  if (!kw) return phoneCountries;
  return phoneCountries.filter(c =>
    c.name.toLowerCase().includes(kw) || c.name_en.toLowerCase().includes(kw) || c.code.includes(kw.replace('+', ''))
  );
});
function selectPhoneCountry(c) { selectedCountry.value = c; phoneCountryOpen.value = false; phoneCountrySearch.value = ''; }
const pairingDisplayPhone = computed(() => {
  const p = chatStore.pairingCode?.phone || '';
  return p ? '+' + String(p).replace(/[^0-9]/g, '') : '';
});
const pairingCodeFormatted = computed(() => {
  const code = chatStore.pairingCode?.code || '';
  return code.replace(/[^A-Za-z0-9]/g, '').toUpperCase().split('');
});
async function handleLoginClick() {
  // Step 1: 获取 WA 账号 ID
  let accId = null;
  try {
    if (chatStore.currentWaAccountId) {
      accId = chatStore.currentWaAccountId;
    } else {
      const { data: accounts } = await api.get('/accounts');
      const waAccount = accounts.find(a => a.platform === 'whatsapp');
      if (waAccount) accId = waAccount.id;
    }
  } catch(e) {
    console.warn('Failed to fetch accounts:', e);
  }

  // Step 2: 检查代理配置状态
  let proxyConfigured = false;
  if (accId) {
    try {
      const { data } = await api.get('/accounts/wa/' + accId + '/proxy');
      proxyConfigured = data.proxy && data.proxy.enabled !== false && data.proxy.proxyServer;
    } catch(e) {
      console.warn('Proxy check failed:', e);
    }
  }

  // Step 3: 未配置代理时弹窗提示，选否则打开代理面板（非阻塞，QR流程正常继续）
  if (!proxyConfigured) {
    try {
      const _proxyTipPromise = ElMessageBox.confirm(
        "\u26a0\ufe0f 尚未配置代理IP，建议使用静态住宅独享IP以降低封号风险。\n\n点击\"取消\"打开代理设置面板，点击\"确定\"跳过直接登录。",
        '提示',
        { type: 'warning', confirmButtonText: '确定', cancelButtonText: '取消', center: true, customClass: 'proxy-tip-modal' }
      );
      // 首帧即定位到 WhatsApp 登录图标正下方，消除"先居中再跳变"的阴影闪现
      const _positionProxyTip = () => {
        const _tipModal = document.querySelector('.proxy-tip-modal');
        const _waLogo = document.querySelector('.wa-welcome-logo');
        const _tipOverlay = document.querySelector('.el-overlay-message-box');
        if (_tipModal && _waLogo && _tipOverlay) {
          const _lr = _waLogo.getBoundingClientRect();
          const _mw = _tipModal.offsetWidth || 400;
          const _mh = _tipModal.offsetHeight || 200;
          let _left = _lr.x + _lr.width / 2 - _mw / 2;
          let _top = _lr.bottom + 30;
          if (_left < 16) _left = 16;
          if (_left + _mw > window.innerWidth - 16) _left = window.innerWidth - _mw - 16;
          if (_top + _mh > window.innerHeight - 16) _top = window.innerHeight - _mh - 16;
          if (_top < 16) _top = 16;
          _tipOverlay.style.setProperty('padding', '0', 'important');
          _tipModal.style.setProperty('margin', '0', 'important');
          _tipModal.style.setProperty('margin-left', _left + 'px', 'important');
          _tipModal.style.setProperty('margin-top', _top + 'px', 'important');
          _tipModal.style.setProperty('margin-right', 'auto', 'important');
          _tipModal.style.setProperty('margin-bottom', 'auto', 'important');
        }
      };
      // 弹窗 DOM 由 ElMessageBox 同步创建，requestAnimationFrame 保证首帧绘制前完成定位
      requestAnimationFrame(() => {
        _positionProxyTip();
        if (!document.querySelector('.proxy-tip-modal')) {
          setTimeout(_positionProxyTip, 50);
        }
      });
      const shouldContinue = await _proxyTipPromise;
      if (!shouldContinue) {
        window.dispatchEvent(new CustomEvent('open-proxy-panel'));
        return;
      }
    } catch(e) {
      // 用户点击取消或关闭弹窗 -> 打开代理面板
      window.dispatchEvent(new CustomEvent('open-proxy-panel'));
      return;
    }
  }

  // Step 4: 进入扫码登录
  qrViewVisible.value = true;
  startingQr.value = true;
  chatStore.requestQR(chatStore.currentWaAccountId);
}

function onPhoneLoginClick() { phoneViewVisible.value = true; qrViewVisible.value = false; }
function cancelPairing() { phoneViewVisible.value = false; qrViewVisible.value = true; chatStore.clearPairing(); }
async function submitPairing() {
  if (!phoneLocal.value.trim()) return;
  const cc = selectedCountry.value.code.replace(/[^0-9]/g, '');
  const local = phoneLocal.value.replace(/[^0-9]/g, '');
  if (!local) return;
  await chatStore.requestPairingCode(cc + local);
}

function resetQrCountdown() {
  if (qrTimer) { clearInterval(qrTimer); qrTimer = null; }
  qrCountdown.value = 60; qrExpired.value = false;
  qrTimer = setInterval(() => {
    qrCountdown.value--;
    if (qrCountdown.value <= 0) { clearInterval(qrTimer); qrTimer = null; qrExpired.value = true; }
  }, 1000);
}
watch(() => chatStore.qrCode?.qr, (val) => { if (val && qrViewVisible.value) resetQrCountdown(); });
watch(() => chatStore.connectionStatus, (s) => {
  console.log('[ChatView] connectionStatus changed to:', s);
  if (s === 'connected') { if (qrTimer){clearInterval(qrTimer);qrTimer=null;} qrExpired.value=false; qrError.value=null; qrViewVisible.value=false; phoneViewVisible.value=false; chatStore.clearPairing(); }
  else if (s === 'waiting_qr') { qrViewVisible.value = true; startingQr.value = false; }
  else if (s === 'qr_refreshing' || s === 'reconnecting') { qrExpired.value=false; qrError.value=null; if (qrTimer){clearInterval(qrTimer);qrTimer=null;} }
  else if (s === 'scanning') { if (qrTimer){clearInterval(qrTimer);qrTimer=null;} qrExpired.value=false; }
  else if (s === 'error' && qrViewVisible.value) { qrError.value = chatStore.waError || '连接失败'; if (qrTimer){clearInterval(qrTimer);qrTimer=null;} }
});

const colorPalette = ['#00a884','#4FC3F7','#AB47BC','#FF7043','#66BB6A','#FFA726','#EC407A','#26A69A','#EF5350','#5C6BC0'];
// header头像状态
// chAvatarOk moved to profile block
function onChAvatarError() { chAvatarOk.value = false; }
function onChAvatarLoad() { chAvatarOk.value = true; }

// ── 客户档案抽屉 ──
const profileOpen = ref(false);
const profileEditing = ref(false);
const profileSaving = ref(false);
const profileForm = reactive({
  name: '', companyName: '', contactName: '', title: '', phone: '',
  email: '', website: '', country: '', address: '', industry: '',
  tags: '[]', tagsInput: '', tagsDisplay: '', source: 'whatsapp', customerLevel: 'C',
  status: 'potential', notes: '',
});
const chAvatarOk = ref(true);

function safeParseTags(t) {
  if (!t) return '';
  if (Array.isArray(t)) return t.join(',');
  if (typeof t === 'string') {
    try { const arr = JSON.parse(t); return Array.isArray(arr) ? arr.join(',') : t; }
    catch { return t; }
  }
  return '';
}
function sourceLabel(s) {
  const m = {whatsapp:'WhatsApp',google:'谷歌推广',tiktok:'TikTok',facebook:'Facebook',instagram:'Instagram',linkedin:'LinkedIn',website:'官网',youtube:'YouTube',exhibition:'展会',referral:'客户推荐','老客户推荐':'客户推荐','独立站询盘':'官网',proactive:'主动开发',email:'邮件营销',other:'其他',manual:'手动添加'};
  return m[s] || s;
}
function statusLabel(s) {
  return ({potential:'潜在',contacted:'已联系',qualified:'已确认需求',quoting:'报价中',negotiating:'谈判中',won:'已成交',lost:'流失'})[s] || s;
}

async function openProfile() {
  profileOpen.value = true;
  profileEditing.value = false;
  try {
    const jid = encodeURIComponent(chatStore.activeConversation.jid);
    const api = await getApi();
    const { data } = await api.get('/customers/by-jid/' + jid);
    const tagsStr = safeParseTags(data.tags);
    Object.assign(profileForm, {
      name: data.name || '', companyName: data.companyName || '', contactName: data.contactName || '',
      title: data.title || '', phone: data.phone || chatStore.activeConversation.phone || '',
      email: data.email || '', website: data.website || '', country: data.country || '',
      address: data.address || '', industry: data.industry || '',
      tags: data.tags || '[]', tagsInput: tagsStr, tagsDisplay: tagsStr,
      source: data.source || 'whatsapp', customerLevel: data.customerLevel || 'C',
      status: data.status || 'potential', notes: data.notes || '',
    });
    if (data.name) {
      const conv = chatStore.conversations.find(c => c.jid === chatStore.activeJid.value);
      if (conv) conv.name = data.name;
    }
  } catch (e) {
    console.error('加载客户档案失败', e);
  }
}
function closeProfile() { profileOpen.value = false; profileEditing.value = false; }

// ── 📁 文档储存（2026-08-31 单证存档，按租户100MB免费+超出4积分/MB） ──
const docPanelOpen = ref(false);
const docList = ref([]);
const docUsage = ref(null);
const docLoading = ref(false);
const docUploading = ref(false);
const docFileInput = ref(null);
const docAccept = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,application/pdf,application/msword,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function formatDocSize(bytes) {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
function formatDocTime(t) {
  if (!t) return '';
  const d = new Date(t);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function loadDocUsage() {
  try {
    const { data } = await api.get('/doc-archive/usage');
    docUsage.value = data.data;
  } catch (e) {
    console.error('loadDocUsage failed:', e);
  }
}

async function loadDocList() {
  if (!chatStore.activeConversation?.jid) return;
  docLoading.value = true;
  try {
    const jid = encodeURIComponent(chatStore.activeConversation.jid);
    const { data } = await api.get('/doc-archive/list?jid=' + jid);
    docList.value = data.data || [];
  } catch (e) {
    console.error('loadDocList failed:', e);
    ElMessage.error('获取单证列表失败');
  } finally {
    docLoading.value = false;
  }
}

function openDocPanel() {
  if (!chatStore.activeConversation?.jid) {
    ElMessage.warning('请先选择一个客户会话');
    return;
  }
  docPanelOpen.value = true;
  loadDocUsage();
  loadDocList();
}
function closeDocPanel() { docPanelOpen.value = false; }

function triggerDocUpload() {
  if (docFileInput.value) docFileInput.value.click();
}

async function onDocFileChosen(e) {
  const file = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!file) return;
  if (!chatStore.activeConversation?.jid) {
    ElMessage.warning('请先选择一个客户会话');
    return;
  }
  // 1) 预检：算本次扣分
  let pre;
  try {
    const { data } = await api.post('/doc-archive/precheck', { size: file.size });
    pre = data.data;
  } catch (err) {
    console.error('precheck failed:', err);
    ElMessage.error('预检失败，请稍后重试');
    return;
  }
  const sizeTxt = formatDocSize(file.size) || (pre.sizeMB + ' MB');
  // 2) 弹确认框，明明白白
  let msg;
  if (pre.costCredits === 0) {
    msg = `文件「${file.name}」(${sizeTxt})\n\n租户已用 ${pre.usedMB} MB / 免费 ${pre.freeQuotaMB} MB，本次在免费额度内，不扣积分。\n\n确认上传存档？`;
  } else if (pre.sufficient) {
    msg = `文件「${file.name}」(${sizeTxt})\n\n租户已用 ${pre.usedMB} MB / 免费 ${pre.freeQuotaMB} MB\n本次将超出免费额度，扣除 <b>${pre.costCredits}</b> 积分（当前余额 ${pre.balance} 分）。\n\n确认上传存档？`;
  } else {
    msg = `文件「${file.name}」(${sizeTxt})\n\n本次将超出免费额度，需扣除 ${pre.costCredits} 积分，但当前余额不足（${pre.balance} 分）。`;
  }
  let ok = false;
  try {
    if (pre.sufficient) {
      await ElMessageBox.confirm(msg, '📁 文档储存确认', { confirmButtonText: '确认上传', cancelButtonText: '取消', type: 'warning', dangerouslyUseHTMLString: true });
      ok = true;
    } else {
      await ElMessageBox.confirm(msg + '\n\n是否前往充值？', '积分不足', { confirmButtonText: '去充值', cancelButtonText: '取消', type: 'warning', dangerouslyUseHTMLString: true });
      window.location.href = '/credits';
      return;
    }
  } catch (cancel) { return; }
  if (!ok) return;
  // 3) 上传
  docUploading.value = true;
  try {
    const fd = new FormData();
    fd.append('jid', chatStore.activeConversation.jid);
    fd.append('platform', chatStore.activeConversation.platform || 'whatsapp');
    fd.append('file', file);
    const { data } = await api.post('/doc-archive/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    const res = data.data;
    if (res.costCredits > 0) {
      ElMessage.success(`上传成功，本次扣除 ${res.costCredits} 积分`);
    } else {
      ElMessage.success('上传成功（免费额度内）');
    }
    loadDocList();
    loadDocUsage();
  } catch (err) {
    console.error('upload doc failed:', err);
    const code = err.response?.data?.code;
    if (code === 'INSUFFICIENT_CREDITS') {
      ElMessage.error(err.response?.data?.error || '积分不足');
    } else {
      ElMessage.error('上传失败：' + (err.response?.data?.error || err.message));
    }
  } finally {
    docUploading.value = false;
  }
}

async function downloadDoc(item) {
  try {
    const resp = await api.get('/doc-archive/download/' + item.id, { responseType: 'blob' });
    const blob = resp.data;
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = item.fileName || ('doc_' + item.id);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  } catch (e) {
    console.error('downloadDoc failed:', e);
    ElMessage.error('下载失败');
  }
}

async function deleteDoc(item) {
  try {
    await ElMessageBox.confirm(`确认删除「${item.fileName}」？删除后空间将释放（不退还积分）。`, '删除单证', { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' });
  } catch (cancel) { return; }
  try {
    await api.delete('/doc-archive/' + item.id);
    ElMessage.success('已删除');
    loadDocList();
    loadDocUsage();
  } catch (e) {
    console.error('deleteDoc failed:', e);
    ElMessage.error('删除失败');
  }
}

async function saveProfile() {
  if (!chatStore.activeConversation || !chatStore.activeConversation.jid) {
    alert('请先选择一个客户会话');
    return;
  }
  profileSaving.value = true;
  try {
    const jid = encodeURIComponent(chatStore.activeConversation.jid);
    const tagsArr = (typeof profileForm.tagsInput === 'string' ? profileForm.tagsInput : String(profileForm.tagsInput || ''))
      .split(/[,，]/).map(x=>x.trim()).filter(Boolean);
    // 安全构造payload：剥离Vue Proxy，排除非字段属性
    const payload = JSON.parse(JSON.stringify({
      name: profileForm.name || '',
      companyName: profileForm.companyName || '',
      contactName: profileForm.contactName || '',
      title: profileForm.title || '',
      phone: profileForm.phone || '',
      email: profileForm.email || '',
      website: profileForm.website || '',
      country: profileForm.country || '',
      address: profileForm.address || '',
      industry: profileForm.industry || '',
      source: profileForm.source || 'whatsapp',
      customerLevel: profileForm.customerLevel || 'C',
      status: profileForm.status || 'potential',
      notes: profileForm.notes || '',
      tags: tagsArr.length ? JSON.stringify(tagsArr) : '[]',
    }));
    const api = await getApi();
    const { data } = await api.put('/customers/by-jid/' + jid, payload);
    // 更新显示
    profileForm.tagsDisplay = safeParseTags(data.tags || payload.tags);
    if (data.name) {
      const conv = chatStore.conversations.find(c => c.jid === chatStore.activeJid.value);
      if (conv) conv.name = data.name;
      if (chatStore.activeConversation) chatStore.activeConversation.name = data.name;
    }
    Object.assign(profileForm, {
      name: data.name || '', companyName: data.companyName || '', contactName: data.contactName || '',
      title: data.title || '', phone: data.phone || '', email: data.email || '', website: data.website || '',
      country: data.country || '', address: data.address || '', industry: data.industry || '',
      source: data.source || 'whatsapp', customerLevel: data.customerLevel || 'C',
      status: data.status || 'potential', notes: data.notes || '',
    });
    profileSaving.value = false;
    profileEditing.value = false;
  } catch (e) {
    profileSaving.value = false;
    console.error('[saveProfile] failed', e, 'jid:', chatStore.activeConversation?.jid);
    const msg = e.response?.data?.error || e.message || (e.request ? '请求未响应，请检查网络' : '未知错误');
    alert('保存失败：' + msg);
  }
}

// 切换会话时重置头像加载状态
watch(() => chatStore.activeConversation?.jid, (newJid) => { chAvatarOk.value = false; const av = chatStore.activeConversation?.avatar || undefined; if (newJid && chatStore.loadAvatar(newJid, av)) { const preImg = new Image(); preImg.onload = () => { chAvatarOk.value = true; }; preImg.onerror = () => { chAvatarOk.value = false; }; preImg.src = chatStore.loadAvatar(newJid, av); } });

function avatarColor(name) {
  if (!name) return '#00a884';
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colorPalette[Math.abs(hash) % colorPalette.length];
}

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts); if (isNaN(d.getTime())) return '';
  return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
}
function getDayLabel(ts) {
  if (!ts) return '';
  const d = new Date(ts); if (isNaN(d.getTime())) return '';
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((today - msgDay) / (1000*60*60*24));
  if (diff === 0) return '今天';
  if (diff === 1) return '昨天';
  if (diff < 7) return ['周日','周一','周二','周三','周四','周五','周六'][d.getDay()];
  return String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
const groupedMessages = computed(() => {
  const msgs = chatStore.currentMessages || [];
  const groups = []; let lastLabel = null;
  for (const m of msgs) {
    const label = getDayLabel(m.timestamp);
    if (label !== lastLabel) { groups.push({ label, msgs: [m] }); lastLabel = label; }
    else groups[groups.length-1].msgs.push(m);
  }
  return groups;
});

function scrollToBottom() { nextTick(() => { if (msgArea.value) msgArea.value.scrollTop = msgArea.value.scrollHeight; }); }
watch(() => chatStore.currentMessages?.length, () => scrollToBottom());
watch(() => chatStore.activeJid, () => {
  draftMsg.value = '';
  cancelMultiSelect();
  aiSuggestHiddenByInput.value = false;
  aiSuggestReplies.value = [];
  scrollToBottom();
  // 切换会话时，自动拉取一次 AI 建议（移动端才真正请求）
  // 进入待跟进客户时主动刷新建议（手机端显示、PC端隐藏逻辑保持不变）
  nextTick(() => {
    if (chatStore.activeJid && isMobileView.value) refreshAiSuggests();
    // 切换会话时顺带刷新待跟进列表（兜底）
    chatStore.fetchPendingFollowups && chatStore.fetchPendingFollowups().catch(() => {});
  });
});
// 当前会话新增入站消息 → 刷新建议
watch(() => chatStore.currentMessages?.length, (newLen, oldLen) => {
  if (!isMobileView.value) return;
  if (!chatStore.activeJid) return;
  if (!newLen || newLen <= (oldLen || 0)) return;
  const msgs = chatStore.currentMessages || [];
  const last = msgs[msgs.length - 1];
  if (last && !last.fromMe) {
    // 收到客户新消息 → 重新刷新建议
    aiSuggestHiddenByInput.value = false;
    refreshAiSuggests();
  }
});
watch(() => chatStore.insertText, (val) => {
  if (val) {
    draftMsg.value = (draftMsg.value ? draftMsg.value + ' ' : '') + val;
    chatStore.clearInsertText();
    nextTick(() => { if (inputEl.value) inputEl.value.focus(); });
  }
});

function sendMsg() {
  // Legacy alias — prefer onSendClick which honors translation confirm
  onSendClick();
}
function goBack() { emit('go-back'); }

function isDataUrl(s) { return typeof s === 'string' && (s.startsWith('data:') || s.startsWith('http')); }

function onOpenQrEvent(e) { if (chatStore.currentWaAccountId === null || !chatStore.isConnected) startQrLogin(e?.detail?.accountId); }
function onShowIntroEvent() { qrViewVisible.value = false; phoneViewVisible.value = false; qrError.value = null; qrExpired.value = false; if (qrTimer) { clearInterval(qrTimer); qrTimer = null; } }
function onMhOpenProfileEvent() {
  if (chatStore.activeConversation) {
    profileOpen.value = true;
    profileEditing.value = false;
  }
}

onMounted(async () => {
  scrollToBottom();
  window.addEventListener('wa:open-qr', onOpenQrEvent);
  window.addEventListener('wa:show-intro', onShowIntroEvent);
  window.addEventListener('wa:open-profile', onMhOpenProfileEvent);
  window.addEventListener('keydown', onPdfKeydown);
  updateMobileView();
  window.addEventListener('resize', updateMobileView);
  try { useSocket(); } catch (e) { console.warn('socket init', e); }
  // 监听 socket 入站消息（兜底，watch currentMessages 之外的快速通道）
  try {
    const sock = useSocket();
    if (sock && !autoStepSocketHandler) {
      autoStepSocketHandler = (data) => {
        if (!data || !data.detail) return;
        const jid = data.jid || chatStore.activeJid;
        if (!jid) return;
        if (!autoStepsByJid[jid]) autoStepsByJid[jid] = [];
        autoStepsByJid[jid].push({ step: data.step, detail: data.detail, done: data.step === 'sent' || data.step === 'need_human' || data.step === 'timeout_cancel', ts: data.ts });
        nextTick(() => { if (msgArea.value) msgArea.value.scrollTop = msgArea.value.scrollHeight; });
      };
      sock.on('whatsapp:auto-step', autoStepSocketHandler);
    }
    if (sock && !aiSuggestSocketHandler) {
      aiSuggestSocketHandler = (data) => {
        if (!isMobileView.value) return;
        if (!chatStore.activeJid) return;
        const msg = data || {};
        // 仅当新消息是发给当前会话且非自己发出时刷新
        const jid = msg.jid || (msg.fromMe ? msg.to : msg.from);
        if (jid === chatStore.activeJid && !msg.fromMe && msg.direction !== 'outbound') {
          aiSuggestHiddenByInput.value = false;
          refreshAiSuggests();
        }
      };
      sock.on('whatsapp:message', aiSuggestSocketHandler);
    }
  } catch (e) { console.warn('socket listen for ai-suggest failed:', e); }
  // 加载翻译设置
  try { await chatStore.fetchTranslationSettings(); } catch (e) { console.warn('translation settings load failed:', e); }
  // 处理来自Dashboard的跳转参数：jid直接打开会话；filter按紧急/待跟进/待唤醒筛选并选第一个
  const jumpJid = route.query?.jid;
  const jumpFilter = route.query?.filter;
  const applyJump = async () => {
    try {
      // 等会话列表加载
      let tries = 0;
      while ((!chatStore.conversations || chatStore.conversations.length === 0) && tries < 20) {
        await new Promise(r => setTimeout(r, 200));
        tries++;
      }
      if (jumpJid) {
        // 先看conversations里有没有
        let target = chatStore.conversations.find(c => c.jid === jumpJid);
        // @lid 可能需要在所有已加载会话里按phone匹配
        if (!target && jumpJid.includes('@lid')) {
          const phone = jumpJid.split('@')[0];
          target = chatStore.conversations.find(c => c.jid && (c.jid.startsWith(phone + '@') || c.phone === phone));
        }
        if (target) {
          chatStore.setActiveConversation(target.jid);
          return;
        }
      }
      if (jumpFilter) {
        // filter=urgent/followup/reactivate：拉dashboard数据找第一个该分类的jid
        try {
          const { data } = await api.get('/dashboard/stats');
          const arr = data?.[jumpFilter];
          if (Array.isArray(arr) && arr.length > 0 && arr[0]?.jid) {
            const targetJid = arr[0].jid;
            let target = chatStore.conversations.find(c => c.jid === targetJid);
            if (!target && targetJid.includes('@lid')) {
              const phone = targetJid.split('@')[0];
              target = chatStore.conversations.find(c => c.jid && (c.jid.startsWith(phone + '@') || c.phone === phone));
            }
            if (target) chatStore.setActiveConversation(target.jid);
          }
        } catch (e) { console.warn('[jump] dashboard fetch failed:', e?.message); }
      }
    } catch (e) { console.warn('[jump] apply failed:', e?.message); }
  };
  applyJump();

  if (chatStore.isConnected) {
    // 已连接：从其他页面导航过来时 socket 早就 connected，
    // whatsapp:status 不会重复触发，需主动拉一次会话列表
    // 已连接：拉取会话列表（不自动选中，让用户自己选择）
    if (!chatStore.conversations || chatStore.conversations.length === 0) {
      console.log('[ChatView] Already connected but no conversations loaded, fetching now...');
      await chatStore.fetchConversations();
      console.log('[ChatView] fetchConversations completed, conversations count:', chatStore.conversations?.length);
    }
  }
});


// [FIX] 已移除 conversations 自动选中 watcher，用户需手动选择会话

// [FIX] 已移除 route.path 自动选中 watcher，用户需手动选择会话

onUnmounted(() => {
  window.removeEventListener('wa:open-qr', onOpenQrEvent);
  window.removeEventListener('wa:show-intro', onShowIntroEvent);
  window.removeEventListener('wa:open-profile', onMhOpenProfileEvent);
  window.removeEventListener('keydown', onPdfKeydown);
  window.removeEventListener('resize', updateMobileView);
  // Cleanup recording state
  cancelRecording();
  if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null; }
  try {
    const sock = useSocket();
    if (sock && aiSuggestSocketHandler) sock.off('whatsapp:message', aiSuggestSocketHandler);
    if (sock && autoStepSocketHandler) sock.off('whatsapp:auto-step', autoStepSocketHandler);
  } catch (_) {}
  aiSuggestSocketHandler = null;
  autoStepSocketHandler = null;
  if (qrTimer) { clearInterval(qrTimer); qrTimer = null; }
});
// ── 发给 Agent（V1.0 F6 沟通页入口） ──
const ASSIGN_AGENTS = [
  { type: 'sales-champion', icon: '🚀', name: '外贸销冠', desc: '智能跟单 · 话术 · 成交' },
  { type: 'background-report', icon: '🔍', name: '客户背调', desc: '背景调查 · 风险评估' },
  { type: 'customs-agent', icon: '📋', name: '外贸单证', desc: '报关单证 · HS编码' },
  { type: 'doc-agent', icon: '🏭', name: '工厂对接', desc: '验厂评估 · 生产跟进' },
  { type: 'freight-agent', icon: '🚢', name: '货代对接', desc: '海运空运 · 报关报检' },
  { type: 'legal-agent', icon: '⚖️', name: '外贸法务', desc: '合同审查 · 纠纷处理' },
];
const assignDialogOpen = ref(false);
const assignCustomerLoading = ref(false);
const assignCustomer = ref(null);
const assignAgentType = ref('sales-champion');
const assignInstruction = ref('');
const assigning = ref(false);

async function openAssignDialog() {
  assignDialogOpen.value = true;
  assignAgentType.value = 'sales-champion';
  assignInstruction.value = '';
  assignCustomer.value = null;
  const jid = chatStore.activeJid;
  if (!jid) { return; }
  assignCustomerLoading.value = true;
  try {
    const r = await api.get('/customers/id-by-jid/' + encodeURIComponent(jid));
    const id = r.data?.id;
    if (id) {
      const cd = await api.get('/customers/' + id);
      assignCustomer.value = cd.data || { id };
    }
  } catch (e) {
    assignCustomer.value = null;
  } finally { assignCustomerLoading.value = false; }
}
async function doAssignFromChat() {
  if (!assignCustomer.value) return;
  if (!assignInstruction.value.trim()) { ElMessage.warning('请先填写给 Agent 的跟进指令'); return; }
  assigning.value = true;
  try {
    const { data } = await api.post('/agent/tasks', {
      agentType: assignAgentType.value,
      customerIds: [assignCustomer.value.id],
      instruction: assignInstruction.value.trim() || null,
      source: 'chat_page'
    });
    const r = (data.results || [])[0];
    if (r && r.status === 'failed') ElMessage.error(r.error || '指派失败');
    else ElMessage.success(r && r.status === 'exists' ? '该客户已在此 Agent 的指派任务中' : (r && r.status === 'updated' ? '该客户已有指派任务，已更新最新指令' : '指派成功，Agent 对话页即可选择该客户跟进'));
    assignDialogOpen.value = false;
    // 指派成功自动跳转到对应 Agent 对话页（客户-Agent 双向指派 V1.0）
    const agentRouteMap = {
      'sales-champion': '/sales-champion',
      'background-report': '/background-report',
      'customs-agent': '/customs-agent',
      'doc-agent': '/doc-agent',
      'freight-agent': '/freight-agent',
      'legal-agent': '/legal-agent'
    };
    const target = (agentRouteMap[assignAgentType.value] || '/sales-champion') + '?assign=1&cid=' + assignCustomer.value.id;
    router.push(target);
  } catch (e) {
    ElMessage.error(e?.response?.data?.error || '指派失败');
  } finally { assigning.value = false; }
}
</script>

<style scoped>
.conv-page { display: flex; flex-direction: column; height: 100%; background: var(--chat-bg); position: relative; }

/* ── 未连接/扫码/无会话 等页面样式（保持原样） ── */
.wa-intro, .wa-welcome-card { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:40px 32px; color:var(--text-primary); background:var(--panel-bg); border-bottom:6px solid var(--accent); overflow-y:auto; }
.wa-welcome-logo { width:80px; height:80px; margin-bottom:24px; border-radius:16px; }
.wa-welcome-title { font-size:28px; font-weight:600; color:var(--text-primary); margin:0 0 14px; }
.wa-welcome-sub { font-size:14px; color:var(--text-secondary); text-align:center; max-width:440px; line-height:1.6; margin:0 0 32px; }
.wa-intro-art { margin-bottom:28px; opacity:.9; }
.wa-intro-svg { max-width:303px; width:100%; height:auto; }
.wa-intro-title { font-size:28px; font-weight:300; color:var(--text-primary); margin:0 0 14px; }
.wa-intro-sub { font-size:14px; color:var(--text-secondary); text-align:center; max-width:440px; line-height:1.5; margin:0 0 32px; }
.wa-login-btn { display:inline-flex; align-items:center; gap:10px; padding:12px 28px; background:var(--accent); color:var(--accent-text); border:none; border-radius:24px; font-size:14px; font-weight:600; cursor:pointer; transition:background .15s; font-family:inherit; }
.wa-login-btn:hover:not(:disabled) { background:var(--accent-hover); }
.wa-login-btn:disabled { opacity:.7; cursor:wait; }
.wa-spin { animation: wa-spin 1s linear infinite; }
@keyframes wa-spin { to { transform: rotate(360deg); } }
.wa-intro-tips { margin-top:40px; color:var(--text-secondary); font-size:12px; text-align:center; }
.wa-intro-tips p { margin:6px 0; display:flex; align-items:center; justify-content:center; gap:6px; }
.wa-lock { font-size:14px; }

.wa-scan-wrap { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; background:var(--panel-bg); padding:24px; position:relative; }
.wa-scan-back { position:absolute; top:16px; left:16px; width:36px; height:36px; background:var(--panel-header-bg); border:none; color:var(--text-primary); border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:background .15s; }
.wa-scan-back:hover { background:var(--sidebar-active); }
.wa-scan-card { display:flex; gap:40px; background:var(--bg-card, #fff); border-radius:4px; padding:48px 56px 40px; max-width:820px; width:100%; align-items:flex-start; color:var(--text-primary); --bg-card:#fff; --text-secondary:#667781; }
.wa-scan-card * { color: inherit; }
[data-theme='light'] .wa-scan-card { --bg-card:#fff; --text-primary:#111b21; --text-secondary:#667781; color:#111b21; }
[data-theme='light'] .wa-scan-card * { color:inherit; }
html:not([data-theme='light']) .wa-scan-card { --bg-card:#1f2c34; --text-primary:#e9edef; --text-secondary:#8696a0; color:#e9edef; }
html:not([data-theme='light']) .wa-scan-card * { color:inherit; }
.wa-scan-left { flex:0 0 380px; color:var(--text-primary, #111b21); }
.wa-scan-right { flex-shrink:0; display:flex; flex-direction:column; align-items:center; }
.wa-scan-title { font-size:28px; font-weight:300; color:var(--text-primary, #111b21); margin:0 0 32px; line-height:1.2; }
.wa-scan-steps { list-style:none; padding:0; margin:0 0 32px; }
.wa-scan-steps li { display:flex; align-items:flex-start; gap:18px; margin-bottom:20px; font-size:14px; line-height:1.5; color:var(--text-primary); }
.step-num { flex-shrink:0; width:24px; height:24px; border-radius:50%; background:transparent; border:2px solid var(--text-primary); color:var(--text-primary); display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:600; }
.step-text { color:var(--text-primary); }
.step-text strong { color:var(--text-primary); font-weight:600; }
.wa-help-link { color:#00a884 !important; display:block; color:var(--accent-info); text-decoration:none; font-size:14px; margin-bottom:16px; }
.wa-help-link:hover { text-decoration:underline; }
.wa-phone-link-bottom { margin-top:18px; padding-top:0; font-size:14px; color:#25d366; font-weight:bold; cursor:pointer; display:flex; align-items:center; gap:4px; justify-content:center; width:100%; }
.wa-phone-link-bottom:hover { text-decoration:underline; }
.wa-stay-logged { display:flex; align-items:center; gap:10px; font-size:14px; color:var(--text-primary); cursor:pointer; margin-bottom:24px; user-select:none; }
.wa-stay-logged input { display:none; }
.checkbox-box { width:18px; height:18px; border-radius:3px; border:2px solid var(--text-secondary); display:flex; align-items:center; justify-content:center; flex-shrink:0; transition:all .15s; }
.checkbox-box.checked { background:var(--accent); border-color:var(--accent); }
.wa-phone-login { display:inline-flex; align-items:center; gap:6px; color:var(--accent-info); font-size:14px; cursor:pointer; margin-top:4px; }
.wa-phone-login:hover { text-decoration:underline; }
.qr-frame { position:relative; width:264px; height:264px; background:#fff; border-radius:4px; padding:12px; display:flex; align-items:center; justify-content:center; }
.qr-img { width:240px; height:240px; display:block; }
.qr-overlay-logo { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); width:60px; height:60px; background:transparent; border-radius:0; display:flex; align-items:center; justify-content:center; padding:0; z-index:2; }
.corner { position:absolute; width:24px; height:24px; border:4px solid var(--accent); }
.corner.tl { top:0; left:0; border-right:none; border-bottom:none; border-top-left-radius:4px; }
.corner.tr { top:0; right:0; border-left:none; border-bottom:none; border-top-right-radius:4px; }
.corner.bl { bottom:0; left:0; border-right:none; border-top:none; border-bottom-left-radius:4px; }
.corner.br { bottom:0; right:0; border-left:none; border-top:none; border-bottom-right-radius:4px; }
.qr-hint-text { margin-top:18px; font-size:13px; color:var(--text-secondary); text-align:center; }
.qr-hint-text strong { color:var(--accent); }
.qr-loading-box, .qr-expired-box, .qr-error-box { width:264px; height:264px; background:#fff; border-radius:4px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:16px; padding:24px; text-align:center; }
.qr-loading-spin { width:36px; height:36px; border:3px solid var(--text-primary); border-top-color:var(--accent); border-radius:50%; animation: wa-spin .8s linear infinite; }
.qr-loading-text { font-size:13px; color:var(--text-muted); }
.qr-expired-title { font-size:16px; font-weight:500; color:var(--accent-text); }
.qr-error-icon { width:40px; height:40px; border-radius:50%; background:var(--danger); color:#fff; display:flex; align-items:center; justify-content:center; font-size:22px; font-weight:700; }
.qr-error-text { font-size:13px; color:var(--accent-text); line-height:1.4; }
.qr-reload-btn { display:inline-flex; align-items:center; gap:6px; padding:8px 18px; background:var(--accent); color:#fff; border:none; border-radius:20px; font-size:13px; font-weight:500; cursor:pointer; transition:background .15s; font-family:inherit; }
.qr-reload-btn:hover { background:var(--accent-hover); }
.wa-scan-footer { margin-top:24px; text-align:center; color:var(--text-secondary); font-size:12px; }
.wa-scan-footer p { margin:6px 0; }
.wa-scan-lock { display:flex; align-items:center; justify-content:center; }
.wa-scan-footer a { color:var(--accent-info); text-decoration:none; }
.wa-scan-footer a:hover { text-decoration:underline; }
.wa-scan-terms .dot { margin:0 6px; }
.wa-scan-create a { color:var(--accent); }

.wa-noselect { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:40px 32px; background:var(--panel-bg); border-bottom:6px solid var(--accent); color:var(--text-primary); }
.wa-noselect-art { margin-bottom:28px; opacity:.75; }
.wa-noselect-title { font-size:28px; font-weight:300; margin:0 0 12px; color:var(--text-primary); }
.wa-noselect-sub { font-size:13px; color:var(--text-secondary); text-align:center; max-width:440px; line-height:1.5; margin:0; }
.wa-noselect-divider { width:240px; height:1px; background:var(--border-color); margin:32px 0 24px; }
.wa-noselect-tip { font-size:14px; color:var(--text-primary); margin:0 0 16px; }
.wa-noselect-encrypt { font-size:12px; color:var(--text-secondary); margin:0; }

/* ── ⚡ 首响等待提示 banner ── */
.auto-step-banner {
  background: linear-gradient(90deg, rgba(0,168,132,0.18), rgba(0,168,132,0.08));
  color: #c8e6d8;
  padding: 8px 12px 8px 16px;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
  border-bottom: 1px solid rgba(0,168,132,0.25);
  flex-wrap: wrap;
}
.asb-title { font-weight: 600; color: #00c49a; font-size: 13px; white-space: nowrap; }
.asb-item { display: inline-flex; align-items: center; gap: 3px; color: #bcd9ca; }
/* 【P0修复 2026-09-20】日间模式销冠横栏文字加深 */
[data-theme='light'] .auto-step-banner { color: #1f6f5c; }
[data-theme='light'] .asb-title { color: #00897b; }
[data-theme='light'] .asb-item { color: #1f6f5c; }
.asb-ico { font-size: 11px; }

.fr-wait-banner {
  background: linear-gradient(90deg, var(--danger), #b9303f);
  color: #fff;
  padding: 8px 12px 8px 16px;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  animation: frb-pulse-chat 2s ease-in-out infinite;
  box-shadow: 0 2px 8px rgba(241, 92, 109, 0.3);
}
.fr-wb-text { flex: 1; }
.fr-wb-dismiss {
  background: rgba(255,255,255,0.2);
  color: #fff;
  border: none;
  padding: 4px 12px;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  flex-shrink: 0;
  font-weight: 500;
  transition: background .15s;
}
.fr-wb-dismiss:hover { background: rgba(255,255,255,0.35); }
@keyframes frb-pulse-chat {
  0%, 100% { background: linear-gradient(90deg, var(--danger), #b9303f); }
  50% { background: linear-gradient(90deg, #ff6b7a, #c9404f); }
}
.fr-wb-icon { font-size: 18px; animation: frb-bell 1s ease-in-out infinite; }
.fr-wb-text b { font-size: 15px; }

/* ── 对话 Header ── */
.conv-header { min-height:60px; background:var(--panel-header-bg); border-bottom:1px solid var(--border-color); display:flex; align-items:center; padding:8px 16px; gap:12px; flex-shrink:0; }
.back-btn { display:none; background:none; border:none; color:var(--text-primary); cursor:pointer; padding:6px; }
.ch-avatar { width:38px; height:38px; border-radius:50%; display:flex; align-items:center; justify-content:center; color:#fff; font-weight:600; flex-shrink:0; overflow:hidden; }
.ch-avatar-img { width:100%; height:100%; border-radius:50%; object-fit:cover; }
.ch-info { flex:1; min-width:0; }
.ch-name { font-size:15px; font-weight:500; color:var(--text-primary); }
.ch-status { font-size:12px; color:var(--text-secondary); display:flex; align-items:center; gap:4px; }
.ch-status-row { display:flex; align-items:center; gap:8px; margin-top:5px; min-width:0; }
.online-dot { width:7px; height:7px; border-radius:50%; background:var(--accent); }
.online-dot.offline { background:var(--text-muted); }
.ch-actions { display:flex; gap:6px; }
.ch-actions button { width:34px; height:34px; display:flex; align-items:center; justify-content:center; background:none; border:none; color:var(--text-secondary); border-radius:50%; cursor:pointer; }
.ch-actions button:hover { background:var(--sidebar-active); color:var(--text-primary); }

/* ── 消息区 ── */
.conv-messages { flex:1; overflow-y:auto; padding:16px 8% 16px calc(8% + 8px); display:flex; flex-direction:column; gap:4px; }
.msgs-loading { display:flex; justify-content:center; padding:20px; color:var(--text-secondary); font-size:12px; }
.loading-dots::after { content:''; animation: dots 1.5s infinite; }
@keyframes dots { 0%,20%{content:'.'} 40%{content:'..'} 60%,100%{content:'...'} }
.msg-date-divider { display:flex; justify-content:center; margin:12px 0; }
.msg-date-divider span { background:var(--panel-header-bg); color:var(--text-secondary); padding:5px 12px; border-radius:8px; font-size:11px; }
.msg { display:flex; margin-bottom:2px; position:relative; }
.msg.incoming { justify-content:flex-start; padding-right:40px; }
.msg.outgoing { justify-content:flex-end; }
.msg-bubble {
  max-width:75%; padding:8px 28px 6px 12px; border-radius:8px;
  font-size:14.5px; line-height:1.4; position:relative; word-wrap:break-word;
  display:flex; flex-direction:column; gap:0;
}
.msg.incoming .msg-bubble { background:var(--panel-header-bg); color:var(--text-primary); border-top-left-radius:2px; }
.msg-bubble.msg-bubble-media { background:transparent !important; box-shadow:none !important; padding:2px 34px 2px 0; border-radius:8px; }
.msg.outgoing .msg-bubble { background:var(--msg-outgoing); color:var(--text-primary); border-top-right-radius:2px; }
.msg-text { padding-right:0; white-space:pre-wrap; word-break:break-word; font-size:15px; }
.msg-translation {
  margin-top:6px; padding-top:6px; padding-bottom:2px;
  border-top:1px dashed rgba(255,255,255,0.2);
  font-size:14px; color:var(--text-primary); font-style:normal; line-height:1.4;
  display:flex; align-items:center; gap:8px;
}
.msg-translation::after { content: none; }
.msg-trans-text { flex:1; min-width:0; }
.msg-retranslate-btn {
  margin-left:auto; flex-shrink:0;
  background:transparent; border:none; color:var(--text-secondary); cursor:pointer;
  padding:2px; border-radius:4px; display:inline-flex; align-items:center; justify-content:center;
  opacity:.6; transition: opacity .15s, transform .3s, color .15s;
}
.msg-retranslate-btn:hover { opacity:1; color:var(--accent-info); }
.msg-retranslate-btn.spinning { opacity:.8; cursor:wait; }
.msg-retranslate-btn.spinning .msg-retrans-spin {
  width:12px; height:12px; border:2px solid rgba(134,150,160,.35);
  border-top-color:var(--text-secondary); border-radius:50%;
  animation: wa-spin .7s linear infinite; display:inline-block;
}
.msg-media-doc-link { cursor:pointer; }
.msg-media-doc-link:hover .mmd-name { color:var(--accent-info); }
.msg-media-pdf { cursor:zoom-in; }
.mmd-download-hidden { display:none; }

/* ── PDF 全屏预览 ── */
.pdf-preview-overlay {
  position:fixed; inset:0; background:rgba(0,0,0,.92);
  z-index:9999; display:flex; flex-direction:column;
}
.pdf-preview-toolbar {
  display:flex; align-items:center; gap:12px; padding:12px 20px;
  background:rgba(30,30,30,.95); color:#eee; flex-shrink:0;
}
.pdf-preview-fname { flex:1; font-size:14px; color:#eee; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.pdf-preview-download, .pdf-preview-newwin {
  color:#eee; text-decoration:none; font-size:13px; padding:6px 12px;
  border-radius:6px; background:rgba(255,255,255,.12); transition:background .15s; cursor:pointer;
}
.pdf-preview-download:hover, .pdf-preview-newwin:hover { background:rgba(255,255,255,.25); }
.pdf-preview-frame {
  flex:1; width:100%; border:none; background:#555; min-height:0;
}
.pdf-preview-close {
  width:36px; height:36px; border-radius:50%; flex-shrink:0;
  background:rgba(255,255,255,.1); color:#fff; border:none; cursor:pointer;
  display:flex; align-items:center; justify-content:center;
  transition:background .15s;
}
.pdf-preview-close:hover { background:rgba(255,255,255,.22); }
.msg-time {
  align-self:flex-end; font-size:10.5px; color:var(--text-secondary);
  display:flex; align-items:center; gap:3px; margin-top:4px;
}
.msg-check { color:var(--accent-info); font-size:12px; margin-left:3px; }
.msg-check.pending { color:var(--text-secondary); font-size:11px; }
.msg-check.sent { color:var(--text-secondary); font-size:12px; }
.msg-check.delivered { color:#22bb55; font-size:12px; font-weight:600; }
.msg-check.read { color:#22bb55; font-size:12px; font-weight:600; }
.msg-check.error { color:var(--danger); font-size:11px; }

/* ── 消息悬浮 AI 小圆点按钮（只在 incoming 上显示） ── */

/* ── 输入区 ── */
.conv-input-area { background:var(--panel-header-bg); padding:8px 12px; display:flex; align-items:center; gap:8px; flex-shrink:0; }
.input-action, .emoji-btn { background:none; border:none; color:var(--text-secondary); cursor:pointer; padding:6px; border-radius:50%; display:flex; align-items:center; justify-content:center; }
.input-action:hover, .emoji-btn:hover { color:var(--text-primary); }
.input-wrap { flex:1; background:var(--sidebar-active); border-radius:22px; display:flex; align-items:center; padding:0 6px 0 16px; }
.input-wrap input { flex:1; background:transparent; border:none; color:var(--text-primary); padding:10px 0; font-size:14px; outline:none; font-family:inherit; }
.send-btn { width:40px; height:40px; border-radius:50%; background:var(--accent); color:#fff; border:none; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:background .15s,opacity .15s; }
.send-btn.disabled { opacity:.4; cursor:not-allowed; background:var(--text-muted) !important; }
.send-btn:hover { background:var(--accent-hover); }
/* ── 内嵌翻译确认面板 ── */
.trans-confirm-panel { position:relative; margin:0 80px 8px 16px; background:var(--panel-header-bg); border-radius:8px; box-shadow:0 2px 10px rgba(0,0,0,.4); padding:12px 14px; border:1px solid var(--sidebar-active); }
.tcp-row { display:flex; align-items:flex-start; gap:8px; }
.tcp-top { justify-content:space-between; align-items:center; }
.tcp-label { font-size:13px; color:var(--text-secondary); flex-shrink:0; line-height:1.5; }
.tcp-text { flex:1; font-size:14px; line-height:1.5; word-break:break-all; }
.tcp-translated { color:var(--text-primary); font-weight:500; }
.tcp-original { color:var(--text-secondary); }
.tcp-error { color:#ea6b6b !important; }
.tcp-swap { display:inline-flex; align-items:center; background:none; border:1px solid var(--text-muted); color:var(--accent); font-size:12px; cursor:pointer; padding:3px 8px; border-radius:4px; flex-shrink:0; font-family:inherit; transition:all .15s; }
.tcp-swap:hover { background:#00a88420; border-color:var(--accent); color:var(--accent); }
.tcp-divider { height:1px; border-top:1px dashed var(--text-muted); margin:8px 0; }
.tcp-tips { margin-top:8px; text-align:right; font-size:11px; color:var(--text-secondary); line-height:1.5; }

/* ── 移动端适配 ── *//* ── 移动端适配 ── */
@media (max-width: 900px) {
  .conv-header, .conv-input-area { padding-right:16px !important; }
  .conv-messages { padding-right:12px !important; }
  .trans-confirm-panel { margin-right:16px !important; }
  .wa-scan-card { flex-direction:column; padding:24px 20px; gap:24px; align-items:center; }
  .wa-scan-left { order:2; width:100%; }
  .wa-scan-right { order:1; }
  .wa-scan-title { font-size:22px; margin-bottom:20px; }
  .wa-intro-title, .wa-noselect-title { font-size:22px; }
  .qr-frame, .qr-loading-box, .qr-expired-box, .qr-error-box { width:220px; height:220px; }
  .qr-img { width:196px; height:196px; }
  .conv-messages { padding:12px; }
  .msg-bubble { max-width:85%; }
  .back-btn { display:flex; }
  .ch-actions button:nth-child(1) { display:none; }
  .wa-scan-back { top:8px; left:8px; }
}

/* ===== 2026-07-13 移动端响应式补丁（追加） ===== */
@media (max-width: 900px) {
  /* 顶部header - 手机端由LayoutView的mobile-header承载,隐藏原header避免双层 */
  .conv-header {
    display: none !important;
  }
  .ch-avatar { width: 36px; height: 36px; font-size: 15px; }
.ch-avatar-img { width:100%; height:100%; border-radius:50%; object-fit:cover; }
  .ch-name { font-size: 15px; }
  .ch-status { font-size: 11px; }
  /* 搜索按钮隐藏，保留更多按钮 */
  .ch-actions button { width: 38px; height: 38px; }

  /* 返回按钮 */
  .back-btn { display: flex !important; width: 38px; height: 38px; align-items:center; justify-content:center; }

  /* 消息区 */
  .conv-messages {
    padding: 10px 10px 10px 12px !important;
    -webkit-overflow-scrolling: touch;
  }
  .msg-bubble {
    max-width: 82% !important;
    padding: 7px 10px 9px !important;
    font-size: 15px !important;
    line-height: 1.45 !important;
    border-radius: 10px !important;
  }
  .msg.incoming { padding-right: 0 !important; }
  .msg.incoming .msg-bubble { border-top-left-radius: 2px !important; }
  .msg.outgoing .msg-bubble { border-top-right-radius: 2px !important; }
  .msg-text { padding-right: 0; font-size:14px; }
  .msg-time { font-size: 10px; margin-top:3px; }
  .msg-translation { font-size:14px; }


  /* 输入区 */
  .conv-input-area {
    padding: 8px 10px !important;
    gap: 6px !important;
    padding-bottom: calc(8px + env(safe-area-inset-bottom, 0)) !important;
  }
  .input-action, .emoji-btn {
    width: 42px; height: 42px;
    flex-shrink: 0;
  }
  .input-wrap {
    border-radius: 24px;
    padding: 0 8px 0 16px;
    min-height: 44px;
  }
  .input-wrap input {
    padding: 11px 0 !important;
    font-size: 16px !important; /* 防止iOS自动缩放 */
    line-height: 1.4;
  }
  .send-btn {
    width: 44px; height: 44px; flex-shrink: 0;
  }

  /* 翻译确认弹窗 */
  .trans-confirm-panel {
    margin: 0 10px 8px 10px !important;
    padding: 10px 12px !important;
    border-radius: 10px !important;
  }
  .tcp-row { gap: 6px; }
  .tcp-label { font-size: 12px; min-width: 36px; }
  .tcp-text { font-size: 14px; }
  .tcp-swap { padding: 6px 10px; min-height: 36px; font-size: 12px; }
  .tcp-tips { font-size: 10px; text-align: center; margin-top: 6px; }

  /* 扫码页适配 */
  .wa-scan-wrap { padding: 16px 12px; }
  .wa-scan-card { padding: 24px 16px; gap: 20px; }
  .qr-frame, .qr-loading-box, .qr-expired-box, .qr-error-box { width: 200px; height: 200px; }
  .qr-img { width: 176px; height: 176px; }
  .wa-scan-title { font-size: 20px; margin-bottom: 16px; text-align:center; }
  .wa-scan-steps li { font-size: 13px; gap: 10px; margin-bottom: 14px; }
  .wa-scan-back { top: 10px; left: 10px; width: 40px; height: 40px; }
  .wa-login-btn { padding: 12px 24px; font-size: 14px; min-height: 48px; }
  .qr-reload-btn { min-height: 40px; padding: 8px 18px; font-size: 14px; }

  /* 无会话占位 */
  .wa-noselect { padding: 32px 20px; }
  .wa-noselect-title { font-size: 20px; }
  .wa-noselect-sub { font-size: 13px; }

  /* 日期分隔条 */
  .msg-date-divider span { font-size: 11px; padding: 4px 10px; }

  /* body 禁止橡皮筋 */
  :deep(body) { overscroll-behavior: none; }
}


/* ── 附件菜单 ── */
.attach-wrap { position:relative; }
.attach-menu {
  position:absolute;
  bottom:calc(100% + 6px);
  left:0;
  background:#233138;
  border-radius:8px;
  box-shadow:0 4px 16px rgba(0,0,0,.5);
  padding:6px;
  z-index:50;
  min-width:180px;
  border:1px solid var(--sidebar-active);
}
.attach-arrow {
  position:absolute;
  bottom:-6px; left:16px;
  width:10px; height:10px;
  background:#233138;
  border-right:1px solid var(--sidebar-active);
  border-bottom:1px solid var(--sidebar-active);
  transform:rotate(45deg);
}
.attach-item {
  display:flex; align-items:center; gap:10px;
  width:100%;
  background:none; border:none; color:var(--text-primary);
  padding:10px 12px;
  border-radius:6px; cursor:pointer;
  font-size:14px; font-family:inherit; text-align:left;
}
.attach-item:hover { background:var(--sidebar-active); }
.attach-icon {
  width:32px; height:32px; border-radius:50%;
  display:flex; align-items:center; justify-content:center;
  font-size:16px; flex-shrink:0; color:#fff;
}
/* 日间模式附件菜单 */
[data-theme='light'] .attach-menu {
  background:#fff;
  border-color:#e0e0e0;
  box-shadow:0 4px 16px rgba(0,0,0,.12);
}
[data-theme='light'] .attach-arrow {
  background:#fff;
  border-color:#e0e0e0;
}
[data-theme='light'] .attach-item {
  color:#111b21;
}
[data-theme='light'] .attach-item:hover {
  background:#f0f2f5;
}

/* ── 附件预览条 ── */
.media-preview-bar {
  background:var(--panel-header-bg);
  margin:0 12px;
  padding:8px 10px;
  border-radius:8px 8px 0 0;
  border-top:1px solid var(--sidebar-active);
  display:flex; align-items:center; gap:8px;
}
.mpb-file { display:flex; align-items:center; gap:8px; min-width:0; }
.mpb-thumb { width:44px; height:44px; object-fit:cover; border-radius:6px; flex-shrink:0; }
.mpb-doc-icon {
  width:44px; height:44px; border-radius:6px;
  background:var(--sidebar-active); display:flex; align-items:center; justify-content:center;
  font-size:22px; flex-shrink:0;
}
.mpb-info { min-width:0; }
.mpb-name { font-size:13px; color:var(--text-primary); max-width:160px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.mpb-size { font-size:11px; color:var(--text-secondary); margin-top:2px; }
.mpb-caption {
  flex:1;
  background:var(--sidebar-active); border:none; outline:none;
  color:var(--text-primary); padding:8px 12px; border-radius:18px;
  font-size:13px; font-family:inherit;
  min-width:80px;
}
.mpb-send {
  width:38px; height:38px; border-radius:50%;
  background:var(--accent); color:#fff; border:none; cursor:pointer;
  display:flex; align-items:center; justify-content:center; flex-shrink:0;
}
.mpb-send:disabled { background:var(--text-muted); cursor:wait; }
.mpb-cancel {
  width:32px; height:32px; border-radius:50%;
  background:none; border:none; color:var(--text-secondary); cursor:pointer;
  display:flex; align-items:center; justify-content:center; flex-shrink:0;
}
.mpb-cancel:hover { color:var(--text-primary); }
.mpb-spin {
  width:16px; height:16px; border:2px solid rgba(255,255,255,.3);
  border-top-color:#fff; border-radius:50%;
  animation: wa-spin .7s linear infinite;
  display:inline-block;
}

/* ── 消息气泡中的媒体 ── */
.msg-media-img { max-width:280px; max-height:280px; border-radius:6px; overflow:hidden; margin-right:50px; margin-bottom:4px; }
.msg-media-img img { max-width:100%; max-height:280px; display:block; border-radius:6px; object-fit:cover; cursor:pointer; }
.msg-media-video { max-width:320px; margin-right:50px; margin-bottom:4px; border-radius:8px; overflow:hidden; }
.msg-video-player { width:100%; max-height:420px; display:block; border-radius:8px; }
.msg-video-placeholder { padding:28px 18px; color:#fff; text-align:center; font-size:14px; background:var(--panel-header-bg); border-radius:8px; }
.msg-media-doc {
  display:flex; align-items:center; gap:10px;
  padding:6px 50px 6px 0;
  max-width:280px;
}
.mmd-icon {
  width:40px; height:40px; border-radius:6px;
  background:rgba(255,255,255,.12); display:flex; align-items:center; justify-content:center;
  font-size:22px; flex-shrink:0;
}
.msg.incoming .mmd-icon { background:var(--sidebar-active); }
.mmd-info { min-width:0; }
.mmd-name { font-size:14px; color:var(--text-primary); word-break:break-all; }
.mmd-size { font-size:11px; color:var(--text-secondary); margin-top:2px; }
.msg-caption { font-size:13px; color:var(--text-primary); margin-top:4px; padding-right:0; white-space:pre-wrap; line-height:1.4; }
@media (max-width:900px) {
  .msg-media-img { max-width:220px; max-height:220px; margin-right:46px; }
  .msg-media-img img { max-height:220px; }
  .msg-media-video { max-width:240px; margin-right:46px; }
  .msg-video-player { max-height:300px; }
  .msg-media-doc { max-width:240px; padding-right:46px; }
  .attach-menu { min-width:160px; }
  .mpb-name { max-width:100px; }
}

/* ── AI 快捷建议条（默认隐藏，仅移动端显示） ── */
.ai-suggest-bar { display: none !important; }
@media (max-width: 900px) {
  .ai-suggest-bar {
    display: none !important;
  }
  .aisb-hidden-placeholder { display:block; }
  /* 原样式保留但被上面覆盖
  .ai-suggest-bar-old {
    display: flex;
    align-items: center;
    gap: 6px;
    background: var(--panel-bg);
    padding: 6px 10px;
    flex-shrink: 0;
    border-top: 1px solid #1f2c34;
  }
  .aisb-icon {
    font-size: 14px;
    flex-shrink: 0;
    width: 22px;
    text-align: center;
    line-height: 1;
  }
  .aisb-scroll {
    flex: 1;
    min-width: 0;
    overflow-x: auto;
    overflow-y: hidden;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    -ms-overflow-style: none;
  }
  .aisb-scroll::-webkit-scrollbar { display: none; width: 0; height: 0; }
  .aisb-chip {
    display: inline-flex;
    flex-direction: column;
    align-items: flex-start;
    flex: 0 0 auto;
    background: var(--panel-header-bg);
    color: var(--text-primary);
    border: 1px solid var(--sidebar-active);
    border-radius: 14px;
    padding: 8px 12px;
    font-family: inherit;
    cursor: pointer;
    margin-right: 6px;
    max-width: 60vw;
    overflow: hidden;
    transition: background .15s, color .15s, border-color .15s;
    gap: 0;
  }
  .aisb-foreign {
    font-size: 13px; line-height: 1.35; color: var(--text-primary);
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
    overflow: hidden; word-break: break-word;
  }
  .aisb-zh {
    font-size: 11px; line-height: 1.3; color: var(--text-secondary); font-style: italic;
    margin-top: 3px;
    display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical;
    overflow: hidden; word-break: break-word;
  }
  .aisb-chip.with-zh { padding: 7px 12px 8px; }
  .aisb-chip:first-child { margin-left: 2px; }
  .aisb-chip:last-child { margin-right: 2px; }
  .aisb-chip:hover, .aisb-chip:active {
    background: var(--sidebar-active);
    border-color: var(--accent);
    color: var(--text-primary);
  }
  .aisb-refresh {
    flex-shrink: 0;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: transparent;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    padding: 0;
    transition: color .15s, transform .3s, background .15s;
  }
  .aisb-refresh:hover { color: var(--accent); background: var(--panel-header-bg); }
  .aisb-refresh:disabled { opacity: .5; cursor: wait; }
  .aisb-refresh:disabled .aisb-refresh-spin { animation: aisb-spin .8s linear infinite; display:inline-block; }
  /* 骨架屏 */
  .aisb-skeleton-wrap {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 2px;
  }
  .aisb-skeleton {
    display: inline-block;
    height: 30px;
    border-radius: 20px;
    background: linear-gradient(90deg, var(--panel-header-bg) 0%, var(--sidebar-active) 50%, var(--panel-header-bg) 100%);
    background-size: 200% 100%;
    animation: aisb-skeleton 1.2s ease-in-out infinite;
  }
  .aisb-skeleton:nth-child(1) { width: 92px; }
  .aisb-skeleton:nth-child(2) { width: 128px; }
  .aisb-skeleton:nth-child(3) { width: 76px; }
}
@keyframes aisb-skeleton {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
@keyframes aisb-spin {
  to { transform: rotate(360deg); }
}


.ch-avatar-clickable{cursor:pointer;transition:transform .15s;position:relative;z-index:5;pointer-events:auto!important}
.ch-avatar-clickable:hover{transform:scale(1.05)}
.ch-avatar-clickable img,.ch-avatar-clickable span{pointer-events:none}
/* Profile Drawer */
.profile-drawer{position:absolute;top:0;right:0;bottom:0;width:100%;max-width:420px;background:rgba(11,20,26,.6);z-index:500;display:flex;justify-content:flex-end}
.profile-panel{width:100%;max-width:400px;background:var(--panel-bg);display:flex;flex-direction:column;height:100%;box-shadow:-4px 0 20px rgba(0,0,0,.4);transform:translateX(0)}
.pp-header{height:56px;background:var(--panel-header-bg);display:flex;align-items:center;padding:0 8px;flex-shrink:0;gap:8px}
.pp-back{background:transparent;border:none;color:var(--text-secondary);cursor:pointer;padding:8px;border-radius:50%;display:flex;align-items:center;justify-content:center}
.pp-back:hover{background:var(--sidebar-active)}
.pp-title{flex:1;color:var(--text-primary);font-size:16px;font-weight:500;text-align:center}
.pp-scroll{flex:1;overflow-y:auto;background:var(--panel-bg)}
.pp-avatar-area{padding:28px 16px 20px;display:flex;flex-direction:column;align-items:center;background:var(--panel-bg)}
.pp-avatar{width:140px;height:140px;border-radius:50%;background:var(--accent);color:#fff;display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;cursor:pointer}
.pp-avatar-img{width:100%;height:100%;object-fit:cover}
.pp-name{margin-top:16px;font-size:22px;color:var(--text-primary);font-weight:500;text-align:center;word-break:break-word}
.pp-phone{margin-top:6px;color:var(--accent);font-size:14px}
.pp-meta-row{margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;justify-content:center}
.pp-level-tag{font-size:12px;padding:3px 10px;border-radius:10px;font-weight:500}
.pp-level-tag.lv-A{background:var(--accent);color:#fff}
.pp-level-tag.lv-B{background:var(--accent-info);color:var(--accent-text)}
.pp-level-tag.lv-C{background:var(--text-muted);color:var(--text-secondary)}
.pp-level-tag.lv-D{background:var(--danger);color:#fff}
.pp-status-tag{font-size:12px;padding:3px 10px;border-radius:10px;background:var(--sidebar-active);color:var(--text-secondary)}
.pp-quick{display:flex;background:var(--panel-bg);border-bottom:8px solid var(--chat-bg);padding:0 16px 16px;gap:8px}
.pp-quick-btn{flex:1;background:var(--panel-header-bg);border:none;color:var(--text-secondary);cursor:pointer;padding:12px 4px;border-radius:8px;display:flex;flex-direction:column;align-items:center;gap:6px;font-size:12px;transition:background .15s}
.pp-quick-btn:hover{background:var(--sidebar-active)}
.pp-tabs{display:flex;background:var(--panel-bg);border-bottom:1px solid var(--border-color)}
.pp-tab{flex:1;text-align:center;padding:12px 0;color:var(--text-secondary);font-size:14px;cursor:pointer;border-bottom:3px solid transparent;transition:color .15s}
.pp-tab.active{color:var(--accent);border-bottom-color:var(--accent)}
.pp-empty-tab{padding:32px 16px;text-align:center;color:var(--text-muted);font-size:13px;background:var(--panel-bg);border-bottom:8px solid var(--chat-bg)}
.pp-section{background:var(--panel-bg);padding:0 16px;border-bottom:8px solid var(--chat-bg)}
.pp-section-title{color:var(--accent);font-size:13px;font-weight:600;padding:16px 0 8px;text-transform:uppercase;letter-spacing:.3px}
.pp-field{padding:10px 0;border-bottom:1px solid var(--border-color)}
.pp-field-tall{padding:14px 0}
.pp-field label{display:block;color:var(--text-secondary);font-size:12px;margin-bottom:4px}
.pp-field input,.pp-field select,.pp-field textarea{width:100%;background:transparent;border:none;color:var(--text-primary);font-size:15px;padding:6px 0;outline:none;font-family:inherit;resize:vertical}
.pp-field select{appearance:none;-webkit-appearance:none;background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='%238696a0'><path d='M7 10l5 5 5-5z'/></svg>");background-repeat:no-repeat;background-position:right 4px center;padding-right:20px}
.pp-field input::placeholder,.pp-field textarea::placeholder{color:var(--text-muted)}
.pp-field select option{background:var(--panel-header-bg);color:var(--text-primary)}
.pp-save-btn{width:100%;background:var(--accent);color:var(--accent-text);border:none;padding:12px;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;margin:16px 0;transition:background .15s}
.pp-save-btn:hover{background:var(--accent-hover)}
.pp-save-btn:disabled{opacity:.5;cursor:not-allowed}
.pp-switch-row{display:flex;align-items:center;justify-content:space-between;padding:14px 0;border-bottom:1px solid var(--border-color)}
.pp-switch-row:last-child{border-bottom:none}
.pp-switch-label{}
.pp-switch-label>div:first-child{color:var(--text-primary);font-size:15px}
.pp-switch-sub{color:var(--text-secondary);font-size:13px;margin-top:2px}
.pp-switch{position:relative;display:inline-block;width:46px;height:26px;flex-shrink:0}
.pp-switch input{opacity:0;width:0;height:0}
.pp-slider{position:absolute;cursor:pointer;top:0;left:0;right:0;bottom:0;background:var(--text-muted);border-radius:26px;transition:.2s}
.pp-slider:before{content:"";position:absolute;height:20px;width:20px;left:3px;bottom:3px;background:#fff;border-radius:50%;transition:.2s}
.pp-switch input:checked+.pp-slider{background:var(--accent)}
.pp-switch input:checked+.pp-slider:before{transform:translateX(20px)}
.pp-encryption{padding:16px;text-align:center;color:var(--text-secondary);font-size:12px}
.pp-bottom-spacer{height:20px}
.pp-edit-btn{background:transparent;border:none;color:var(--text-secondary);cursor:pointer;padding:8px;border-radius:50%;display:flex;align-items:center;justify-content:center}
.pp-edit-btn:hover{background:var(--sidebar-active);color:var(--text-primary)}
.pp-view-row{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;padding:12px 0;border-bottom:1px solid var(--border-color)}
.pp-view-row:last-child{border-bottom:none}
.pp-view-label{color:var(--text-secondary);font-size:13px;flex-shrink:0;min-width:80px}
.pp-view-val{color:var(--text-primary);font-size:14px;text-align:right;word-break:break-word;flex:1}
.pp-view-empty{padding:32px 0;text-align:center;color:var(--text-muted);font-size:14px}
.pp-tag-chip{display:inline-block;background:var(--panel-header-bg);color:var(--accent);font-size:12px;padding:2px 10px;border-radius:10px;margin:2px 0 2px 4px}
/* 抽屉动画 */
.profile-slide-enter-active,.profile-slide-leave-active{transition:opacity .2s}
.profile-slide-enter-from,.profile-slide-leave-to{opacity:0}
.profile-slide-enter-active .profile-panel,.profile-slide-leave-active .profile-panel{transition:transform .25s ease}
.profile-slide-enter-from .profile-panel,.profile-slide-leave-to .profile-panel{transform:translateX(100%)}
/* 手机端抽屉铺满 */
@media (max-width:900px){
  .profile-drawer{max-width:100%}
  .profile-panel{max-width:100%}
}

/* ── 📁 文档储存抽屉（2026-08-31） ── */
.doc-panel{max-width:420px}
.doc-usage{padding:14px 16px;background:var(--panel-bg);border-bottom:1px solid var(--border-color)}
.doc-usage-row{display:flex;justify-content:space-between;align-items:center;font-size:13px;color:var(--text-secondary);margin-bottom:8px}
.doc-usage-balance{color:var(--accent);font-size:12px}
.doc-usage-bar{height:6px;border-radius:6px;background:var(--sidebar-active);overflow:hidden}
.doc-usage-fill{height:100%;background:var(--accent);border-radius:6px;transition:width .3s}
.doc-usage-tip{font-size:12px;color:var(--text-muted);margin-top:8px;line-height:1.5}
.doc-upload-area{padding:14px 16px;background:var(--panel-bg);border-bottom:1px solid var(--border-color)}
.doc-upload-btn{width:100%;background:var(--accent);color:var(--accent-text);border:none;padding:11px;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;transition:background .15s}
.doc-upload-btn:hover{background:var(--accent-hover)}
.doc-upload-btn:disabled{opacity:.5;cursor:not-allowed}
.doc-list{background:var(--panel-bg);padding:8px 0}
.doc-empty{padding:32px 16px;text-align:center;color:var(--text-muted);font-size:13px}
.doc-item{display:flex;align-items:center;gap:10px;padding:10px 16px;border-bottom:1px solid var(--border-color);transition:background .15s}
.doc-item:hover{background:var(--sidebar-active)}
.doc-item-icon{font-size:22px;flex-shrink:0}
.doc-item-info{flex:1;min-width:0}
.doc-item-name{font-size:14px;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.doc-item-meta{font-size:12px;color:var(--text-muted);margin-top:2px}
.doc-item-actions{display:flex;gap:4px;flex-shrink:0}
.doc-act-btn{background:transparent;border:none;color:var(--text-secondary);cursor:pointer;padding:6px;border-radius:50%;font-size:15px;display:flex;align-items:center;justify-content:center}
.doc-act-btn:hover{background:var(--panel-header-bg);color:var(--text-primary)}
.doc-act-del:hover{color:#e74c3c}

.ch-name-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.ch-cul-badge {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 2px 8px; border-radius: 10px;
  font-size: 11px; font-weight: 500; cursor: pointer;
  transition: all .2s; font-variant-numeric: tabular-nums;
}
.ch-cul-badge:hover { transform: scale(1.05); }
.ch-cul-badge.cul-s-working { background: rgba(46,204,113,0.15); color: #27ae60; }
.ch-cul-badge.cul-s-morning { background: rgba(241,196,15,0.15); color: #d68910; }
.ch-cul-badge.cul-s-evening { background: rgba(230,126,34,0.15); color: #d35400; }
.ch-cul-badge.cul-s-night { background: rgba(52,152,219,0.12); color: #2471a3; }
.ch-cul-badge.cul-s-weekend { background: rgba(155,89,182,0.15); color: #7d3c98; }
.ch-cul-icon { font-size: 11px; }


/* ── 消息菜单（气泡内右上角小按钮） ── */
.msg-menu-btn {
  position:absolute; top:4px; right:4px;
  background:transparent;
  border:none;
  border-radius:50%;
  width:22px; height:22px;
  display:flex; align-items:center; justify-content:center;
  color:rgba(255,255,255,0.45);
  cursor:pointer; z-index:6;
  opacity:0; transition:opacity .15s, background .15s, color .15s;
  padding:0;
  flex-shrink:0;
}
.msg:hover .msg-menu-btn { opacity:0.7; }
.msg-menu-btn.menu-active { opacity:1 !important; background:rgba(0,0,0,0.25); color:#fff; }
.msg-menu-btn:hover { opacity:1 !important; background:rgba(0,0,0,0.35); color:#fff; }
.msg-menu-btn.menu-incoming { right:4px; color:rgba(0,0,0,0.35); }
.msg-menu-btn.menu-incoming:hover, .msg-menu-btn.menu-incoming.menu-active { background:rgba(0,0,0,0.12); color:rgba(0,0,0,0.75); }
.msg-context-menu {
  position:absolute; top:28px; right:0; z-index:50;
  background:var(--panel-header-bg,#202c33);
  border:1px solid var(--sidebar-active,#2a3942);
  border-radius:8px; padding:6px 0; min-width:140px;
  box-shadow:0 4px 16px rgba(0,0,0,.4);
}
.msg-context-menu.cm-bubble-in { right:0; }
.msg-context-menu.cm-bubble-out { right:0; }
.cm-item {
  width:100%; text-align:left; background:transparent; border:none;
  color:var(--text-primary,#e9edef); font-size:14px; font-family:inherit;
  padding:9px 14px; cursor:pointer; display:flex; align-items:center; gap:10px;
  position:relative;
  white-space:nowrap;
}
.cm-item:hover { background:var(--sidebar-active,#2a3942); }
.cm-item-danger { color:#ea6b6b; }
.cm-item-reactions { position:relative; }
.emoji-picker-pop {
  position:absolute; right:0; top:calc(100% + 4px);
  background:var(--panel-header-bg,#202c33);
  border:1px solid var(--sidebar-active,#2a3942);
  border-radius:24px; padding:6px 10px;
  display:flex; gap:4px;
  box-shadow:0 4px 12px rgba(0,0,0,.35);
  white-space:nowrap; z-index:51;
}
.emoji-pick-btn {
  background:transparent; border:none; font-size:20px; cursor:pointer;
  padding:4px; border-radius:50%; transition:background .15s, transform .15s;
  line-height:1;
}
.emoji-pick-btn:hover { background:var(--sidebar-active,#2a3942); transform:scale(1.2); }
.msg-reactions-row {
  position:absolute; bottom:-10px; right:8px;
  display:flex; gap:2px;
  z-index:3;
}
.msg.incoming .msg-reactions-row { right:8px; left:auto; }
.msg.outgoing .msg-reactions-row { right:8px; left:auto; }
.msg-reaction-chip {
  background:var(--panel-header-bg,#202c33);
  border:1px solid var(--msg-outgoing,#005c4b);
  border-radius:10px; padding:1px 5px; font-size:13px;
  display:inline-flex; align-items:center;
}
.msg-reaction-chip.mine { border-color:var(--accent,#00a884); }


/* ── 回复引用条 ── */
.reply-quote-bar {
  display:flex; align-items:stretch;
  background:var(--sidebar-active,#2a3942);
  padding:8px 10px 8px 0; margin:0 8px 0 8px;
  border-radius:8px; gap:10px;
}
.rqb-line { width:4px; border-radius:2px; flex-shrink:0; }
.rqb-line.in { background:#53bdeb; }
.rqb-line.out { background:#00a884; }
.rqb-info { flex:1; min-width:0; }
.rqb-name { font-size:13px; font-weight:600; margin-bottom:2px; }
.rqb-name.out { color:#00a884; }
.rqb-name:not(.out) { color:#53bdeb; }
.rqb-preview { font-size:13px; color:var(--text-secondary,#8696a0); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.rqb-close {
  background:transparent; border:none; color:var(--text-secondary,#8696a0);
  cursor:pointer; padding:4px 8px; font-size:14px; border-radius:50%;
  align-self:center; transition:background .15s;
}
.rqb-close:hover { background:rgba(255,255,255,.08); color:var(--text-primary); }

/* ── 消息编辑输入框 ── */
.msg-edit-wrap { padding:4px 0; }
.msg-edit-input {
  width:100%; background:rgba(255,255,255,.08);
  border:1px solid var(--accent,#00a884);
  color:var(--text-primary,#e9edef);
  border-radius:6px; padding:6px 8px; font-size:14px; font-family:inherit;
  outline:none;
}

/* ── Toast ── */
.wa-toast {
  position:fixed; bottom:80px; left:50%; transform:translateX(-50%) translateY(20px);
  background:rgba(0,0,0,.8); color:#fff;
  padding:8px 18px; border-radius:20px; font-size:13px;
  opacity:0; pointer-events:none; transition:opacity .2s, transform .2s;
  z-index:99999;
}
.wa-toast.show { opacity:1; transform:translateX(-50%) translateY(0); }

/* ── 手机端消息菜单适配 ── */
@media (max-width: 900px) {
  .msg-menu-btn { opacity:0.7; } /* 手机端菜单按钮默认半可见，不依赖hover */
  .msg-context-menu { min-width:130px; }
  .emoji-picker-pop { right:0; top:calc(100% + 4px); }
  .msg.incoming { padding-right:0; }
}


/* ── Voice recording ── */
.recording-bar { display:flex; align-items:center; gap:10px; padding:0 8px; flex:1; }
.rec-time { font-size:14px; color:#ea4335; font-weight:600; font-variant-numeric:tabular-nums; min-width:42px; }
.rec-send-btn { width:40px; height:40px; border-radius:50%; background:#ea4335; color:#fff; border:none; cursor:pointer; display:flex; align-items:center; justify-content:center; margin-left:auto; transition:background .15s; }
.rec-send-btn:hover { background:#c62828; }

.mic-btn { background: var(--accent) !important; }
.mic-btn.rec-active { background: #ea4335 !important; animation: rec-pulse 1s ease-in-out infinite; }
@keyframes rec-pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(234,67,53,0.4); } 50% { box-shadow: 0 0 0 10px rgba(234,67,53,0); } }
.recording-indicator { display:flex; align-items:center; gap:6px; padding:0 8px; }
.rec-dot { width:10px; height:10px; border-radius:50%; background:#ea4335; animation: rec-blink 1s ease-in-out infinite; }
@keyframes rec-blink { 0%,100% { opacity:1; } 50% { opacity:0.3; } }
.rec-timer { font-size:13px; color:#ea4335; font-weight:600; font-variant-numeric:tabular-nums; }
.rec-cancel-btn { background:none; border:1px solid var(--text-secondary); color:var(--text-secondary); border-radius:50%; width:32px; height:32px; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:14px; transition:border-color .15s, color .15s; }
.rec-cancel-btn:hover { border-color:#ea4335; color:#ea4335; }

/* ── Multi-select ── */
.multi-select-bar { display:flex; align-items:center; gap:8px; padding:8px 12px; background:var(--panel-header-bg); border-top:1px solid var(--border-color); flex-shrink:0; }
.msb-btn { background:var(--sidebar-active); border:none; color:var(--text-primary); padding:6px 14px; border-radius:6px; font-size:13px; cursor:pointer; transition:background .15s; font-family:inherit; }
.msb-btn:hover { background:var(--accent); color:#fff; }
.msb-count { flex:1; text-align:center; font-size:13px; color:var(--text-secondary); }
.msb-danger { background:rgba(234,67,53,0.15) !important; color:#ea4335 !important; }
.msb-danger:hover { background:#ea4335 !important; color:#fff !important; }
.msb-danger:disabled { opacity:.4; cursor:not-allowed; }
.msg-select-check { position:absolute; left:-28px; top:50%; transform:translateY(-50%); z-index:5; }
.msc-box { width:20px; height:20px; border-radius:4px; border:2px solid var(--text-secondary); display:flex; align-items:center; justify-content:center; cursor:pointer; transition:all .15s; background:transparent; }
.msc-box.checked { background:var(--accent); border-color:var(--accent); }
.msg-selected { background:rgba(0,168,132,0.08) !important; }

/* ── Emoji quick reactions on hover ── */
.msg-quick-reactions { position:absolute; top:-32px; left:50%; transform:translateX(-50%); display:flex; gap:2px; background:var(--panel-header-bg,#202c33); border:1px solid var(--sidebar-active,#2a3942); border-radius:20px; padding:4px 6px; box-shadow:0 2px 8px rgba(0,0,0,.3); z-index:10; white-space:nowrap; }
.msg.outgoing .msg-quick-reactions { left:auto; right:8px; transform:none; }
.msg.incoming .msg-quick-reactions { left:8px; transform:none; }
.mqr-btn { background:transparent; border:none; font-size:18px; cursor:pointer; padding:2px 3px; border-radius:50%; transition:background .15s, transform .15s; line-height:1; }
.mqr-btn:hover { background:var(--sidebar-active,#2a3942); transform:scale(1.25); }

/* ── Mobile adjustments ── */
@media (max-width: 900px) {
  .msg-quick-reactions { top:-30px; }
  .msg-select-check { left:-24px; }
  .msc-box { width:18px; height:18px; }
  .recording-indicator { font-size:12px; }
}

/* ═══ Phase 4: Conversation Manager Styles ═══ */
.ch-assign-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  padding: 3px 0;
}
.ch-conv-status {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  cursor: pointer;
  padding: 3px 0;
}
.ch-conv-progress {
  display: flex;
  align-items: center;
  gap: 4px;
}
.ch-conv-bar {
  width: 48px;
  height: 4px;
  background: rgba(255,255,255,0.15);
  border-radius: 2px;
  overflow: hidden;
}
.ch-conv-bar-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.4s ease, background 0.4s ease;
}
.ch-conv-pct {
  font-size: 10px;
  font-weight: 600;
  min-width: 24px;
}
.ch-conv-chip {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 8px;
  white-space: nowrap;
  font-weight: 500;
}
.ch-conv-strategy.strat-ask {
  background: rgba(0,168,132,0.15);
  color: #00a884;
}
.ch-conv-strategy.strat-quote {
  background: rgba(240,180,41,0.15);
  color: #f0b429;
}
.ch-conv-stage {
  background: rgba(100,150,255,0.12);
  color: #8696a0;
}
.ch-conv-rounds {
  background: rgba(231,76,60,0.12);
  color: #e74c3c;
  font-size: 9px;
}
.ch-conv-gen-btn {
  background: rgba(0,168,132,0.12);
  border: none;
  color: #00a884;
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 3px;
  transition: background 0.2s;
}
.ch-conv-gen-btn:hover {
  background: rgba(0,168,132,0.25);
}
.ch-conv-gen-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Dialog overlay */
.conv-dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  animation: fadeIn 0.2s ease;
}
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
.conv-dialog {
  background: #111b21;
  border-radius: 12px;
  width: 90%;
  max-width: 520px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 8px 32px rgba(0,0,0,0.4);
  border: 1px solid rgba(255,255,255,0.08);
}
.conv-dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(255,255,255,0.08);
}
.conv-dialog-header h3 {
  margin: 0;
  font-size: 15px;
  color: #e9edef;
  font-weight: 600;
}
.conv-dialog-close {
  background: none;
  border: none;
  color: #8696a0;
  font-size: 18px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
}
.conv-dialog-close:hover {
  background: rgba(255,255,255,0.08);
  color: #e9edef;
}
.conv-dialog-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
}
.conv-dialog-footer {
  display: flex;
  gap: 8px;
  padding: 12px 20px;
  border-top: 1px solid rgba(255,255,255,0.08);
  justify-content: flex-end;
}
.cd-btn {
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  color: #e9edef;
  padding: 8px 16px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  transition: background 0.2s;
}
.cd-btn:hover {
  background: rgba(255,255,255,0.1);
}
.cd-btn.primary {
  background: #00a884;
  border-color: #00a884;
  color: #fff;
}
.cd-btn.primary:hover {
  background: #009172;
}

/* Dialog sections */
.conv-dialog-section {
  margin-bottom: 16px;
}
.cds-title {
  font-size: 12px;
  color: #8696a0;
  font-weight: 600;
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.cds-progress-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.cds-progress-row span:first-child {
  font-size: 12px;
  color: #8696a0;
  min-width: 60px;
}
.cds-bar {
  flex: 1;
  height: 6px;
  background: rgba(255,255,255,0.1);
  border-radius: 3px;
  overflow: hidden;
}
.cds-bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.4s ease;
}
.cds-pct {
  font-size: 13px;
  font-weight: 700;
  min-width: 36px;
  text-align: right;
}
.cds-meta {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.cds-chip {
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 10px;
  background: rgba(255,255,255,0.06);
  color: #8696a0;
}
.cds-chip.strat-ask {
  background: rgba(0,168,132,0.15);
  color: #00a884;
}
.cds-chip.strat-quote {
  background: rgba(240,180,41,0.15);
  color: #f0b429;
}
.cds-chip.stage {
  background: rgba(100,150,255,0.12);
}
.cds-chip.rounds {
  background: rgba(231,76,60,0.12);
  color: #e74c3c;
}

/* Question list */
.cds-q-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.cds-q-item {
  display: flex;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 8px;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.05);
}
.cds-q-item.answered {
  background: rgba(0,168,132,0.06);
  border-color: rgba(0,168,132,0.15);
}
.cds-q-check {
  font-size: 14px;
  flex-shrink: 0;
  margin-top: 1px;
}
.cds-q-content {
  flex: 1;
  min-width: 0;
}
.cds-q-text {
  font-size: 13px;
  color: #e9edef;
  line-height: 1.3;
}
.cds-q-text-cn {
  font-size: 11px;
  color: #8696a0;
  margin-top: 1px;
}
.cds-q-answer {
  font-size: 12px;
  color: #00a884;
  margin-top: 4px;
  padding: 4px 8px;
  background: rgba(0,168,132,0.08);
  border-radius: 6px;
}

/* BANT section */
.cds-bant {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}
.cds-bant-item, .cds-bant-total {
  display: flex;
  justify-content: space-between;
  padding: 6px 10px;
  background: rgba(255,255,255,0.04);
  border-radius: 6px;
  font-size: 12px;
}
.cds-bant-item span, .cds-bant-total span {
  color: #8696a0;
}
.cds-bant-item b, .cds-bant-total b {
  color: #e9edef;
}
.cds-bant-total {
  grid-column: 1 / -1;
  background: rgba(0,168,132,0.08);
}

/* Script dialog */
.script-dialog {
  max-width: 560px;
}
.script-reason {
  background: rgba(240,180,41,0.08);
  border: 1px solid rgba(240,180,41,0.15);
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 12px;
  color: #f0b429;
  margin-bottom: 14px;
  line-height: 1.4;
}
.script-block {
  margin-bottom: 14px;
}
.script-label {
  font-size: 11px;
  color: #8696a0;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 6px;
}
.script-text {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 8px;
  padding: 12px 14px;
  font-size: 13px;
  color: #e9edef;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}
.script-en {
  border-left: 3px solid #00a884;
}
.script-cn {
  border-left: 3px solid #8696a0;
}
.script-copy-btn {
  margin-top: 6px;
  background: none;
  border: 1px solid rgba(255,255,255,0.1);
  color: #8696a0;
  font-size: 11px;
  padding: 4px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}
.script-copy-btn:hover {
  background: rgba(255,255,255,0.06);
  color: #e9edef;
}
.script-questions {
  margin-bottom: 12px;
}
.script-q-item {
  font-size: 12px;
  color: #8696a0;
  padding: 3px 0;
}
.script-meta {
  display: flex;
  gap: 12px;
  font-size: 11px;
  color: #8696a0;
  padding-top: 8px;
  border-top: 1px solid rgba(255,255,255,0.06);
}

/* Fade transition */
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}


/* ═══ Phase 5: Script dialog enhancements ═══ */
.script-context-bar {
  display: flex; align-items: center; gap: 8px; padding: 8px 16px;
  background: #f0f7ff; border-bottom: 1px solid #e0e0e0; flex-wrap: wrap;
}
.script-strategy-tag {
  padding: 2px 10px; border-radius: 12px; font-size: 12px; font-weight: 600;
}
.script-strategy-tag.PROVIDE_QUOTE { background: #fff3cd; color: #856404; }
.script-strategy-tag.ASK_FOR_INFO { background: #d1ecf1; color: #0c5460; }
.script-ctx-item { font-size: 12px; color: #555; }
.script-length-tabs {
  display: flex; gap: 6px; margin-bottom: 12px;
}
.script-length-chip {
  padding: 4px 14px; border-radius: 16px; border: 1px solid #ddd;
  background: #f8f8f8; cursor: pointer; font-size: 12px;
  transition: all .2s; color: #555;
}
.script-length-chip.active {
  background: #0088cc; color: #fff; border-color: #0088cc;
}
.script-length-chip:hover:not(.active) {
  border-color: #0088cc; color: #0088cc;
}
.script-btn-row {
  display: flex; gap: 6px; margin-top: 4px;
}

/* ===== 🎯 成交按钮 ===== */
.closing-btn {
  background: linear-gradient(135deg, #ef4444 0%, #f97316 100%) !important;
  color: white !important;
  border: none !important;
}
.closing-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #dc2626 0%, #ea580c 100%) !important;
  transform: scale(1.02);
}
.closing-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* ===== 🎯 成交弹窗 ===== */
.closing-dialog {
  max-width: 560px;
  width: 92%;
  max-height: 80vh;
}
.closing-strategy-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 12px 20px;
  background: var(--bg-secondary, #f8fafc);
  border-bottom: 1px solid var(--border-color, #e5e7eb);
}
.closing-stage-tag,
.closing-strategy-tag,
.closing-attitude-tag {
  font-size: 12px;
  padding: 3px 10px;
  border-radius: 12px;
  background: var(--bg-tertiary, #e2e8f0);
  color: var(--text-secondary, #475569);
  white-space: nowrap;
}
.closing-strategy-tag {
  background: #fef3c7;
  color: #92400e;
  font-weight: 600;
}
.closing-reply-card {
  background: var(--bg-primary, #fff);
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
}
.closing-reply-card:last-child {
  margin-bottom: 0;
}
.closing-tactic-badge {
  display: inline-block;
  font-size: 12px;
  font-weight: 600;
  color: #059669;
  background: #d1fae5;
  padding: 3px 10px;
  border-radius: 12px;
  margin-bottom: 8px;
}
.closing-stage-advice {
  font-size: 12px;
  color: var(--text-secondary, #64748b);
  background: var(--bg-secondary, #f1f5f9);
  padding: 6px 12px;
  border-radius: 8px;
  margin-bottom: 12px;
  line-height: 1.5;
}
.script-copy-btn.primary {
  background: var(--color-primary, #2563eb) !important;
  color: white !important;
}

    .assign-to-agent-btn { border-color: rgba(37,211,102,.5); color: #25d366; }
.assign-dialog-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.55); z-index: 2000; display: flex; align-items: center; justify-content: center; padding: 20px; }
.assign-dialog { width: 100%; max-width: 440px; background: #111b21; border-radius: 14px; overflow: hidden; box-shadow: 0 12px 40px rgba(0,0,0,.5); }
.assign-dialog-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; font-weight: 600; font-size: 15px; color: #e9edef; border-bottom: 1px solid rgba(255,255,255,.08); }
.assign-dialog-close { background: none; border: none; color: #8696a0; font-size: 16px; cursor: pointer; }
.assign-dialog-body { padding: 14px 18px; }
.assign-loading { color: #8696a0; font-size: 13px; padding: 10px 0; }
.assign-cust-info { display: flex; align-items: center; gap: 8px; background: rgba(37,211,102,.1); padding: 8px 12px; border-radius: 8px; margin-bottom: 12px; font-size: 13px; color: #e9edef; }
.assign-cust-info.warn { background: rgba(245,158,11,.12); color: #f5c34d; }
.aci-icon { font-size: 15px; }
.aci-name { font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.assign-agents { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-bottom: 12px; }
.assign-agent-card { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 10px; border: 1.5px solid rgba(255,255,255,.1); cursor: pointer; transition: all .15s; background: rgba(255,255,255,.03); }
.assign-agent-card:hover { border-color: #25d366; }
.assign-agent-card.active { border-color: #25d366; background: rgba(37,211,102,.1); }
.aa-icon { font-size: 20px; }
.aa-info { flex: 1; min-width: 0; }
.aa-name { font-size: 13px; font-weight: 600; color: #e9edef; }
.aa-desc { font-size: 11px; color: #8696a0; }
.aa-check { color: #25d366; font-weight: 700; font-size: 16px; }
.assign-label { font-size: 12px; color: #8696a0; margin-bottom: 6px; }
.assign-required { color: #f5c34d; font-weight: 600; }
.assign-input { width: 100%; box-sizing: border-box; padding: 8px 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,.12); background: rgba(255,255,255,.05); color: #e9edef; font-size: 13px; resize: vertical; }
.assign-dialog-footer { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 18px; border-top: 1px solid rgba(255,255,255,.08); }
.assign-dialog-btn { padding: 7px 16px; border-radius: 8px; border: none; font-size: 13px; cursor: pointer; font-weight: 500; }
.assign-dialog-btn.cancel { background: rgba(255,255,255,.08); color: #e9edef; }
.assign-dialog-btn.primary { background: #25d366; color: #0b141a; }
.assign-dialog-btn:disabled { opacity: .5; cursor: not-allowed; }

/* ===== 手机号登录·国家选择与配对码（对齐 WhatsApp Web 官方样式）===== */
.wa-phone-country-wrap { position:relative; }
.wa-phone-country { display:flex; align-items:center; gap:10px; background:#111b21; border:1px solid #374248; border-radius:8px; padding:11px 14px; cursor:pointer; color:#e9edef; }
.wa-phone-country:hover { background:#202c33; }
.wa-phone-country-flag { font-size:22px; line-height:1; }
.wa-phone-country-name { font-size:15px; font-weight:500; }
.wa-country-backdrop { position:fixed; inset:0; z-index:990; }
.wa-country-dialog { position:absolute; top:calc(100% + 6px); left:0; right:0; z-index:1000; background:#111b21; border:1px solid #374248; border-radius:10px; display:flex; flex-direction:column; overflow:hidden; box-shadow:0 8px 30px rgba(0,0,0,.5); }
.wa-country-search { display:flex; align-items:center; gap:8px; margin:8px; padding:8px 12px; border:2px solid #22bb55; border-radius:8px; color:#22bb55; }
.wa-country-search input { flex:1; background:transparent; border:none; color:#e9edef; font-size:14px; outline:none; }
.wa-country-search input::placeholder { color:#8696a0; }
.wa-country-list { overflow-y:auto; max-height:236px; }
.wa-country-item { display:flex; align-items:center; gap:10px; padding:9px 14px; cursor:pointer; }
.wa-country-item:hover { background:#202c33; }
.wa-country-item.active { background:#202c33; }
.wa-country-item-flag { font-size:20px; width:26px; flex:0 0 auto; text-align:center; }
.wa-country-item-names { flex:1; display:flex; flex-direction:column; min-width:0; }
.wa-country-item-name { font-size:14px; color:#e9edef; }
.wa-country-item-en { font-size:12px; color:#8696a0; }
.wa-country-item-code { font-size:14px; color:#8696a0; margin-left:8px; flex:0 0 auto; }
.wa-country-item-check { flex:0 0 auto; }
.wa-phone-field { display:flex; align-items:center; background:#111b21; border:1px solid #374248; border-radius:8px; margin-top:12px; overflow:hidden; }
.wa-phone-field:focus-within { border-color:#22bb55; }
.wa-phone-prefix { padding:11px 0 11px 14px; color:#e9edef; font-size:15px; flex:0 0 auto; }
.wa-phone-field-divider { width:1px; height:20px; background:#374248; margin:0 10px; flex:0 0 auto; }
.wa-phone-input { flex:1; background:transparent; border:none; color:#e9edef; font-size:15px; padding:11px 14px 11px 0; outline:none; min-width:0; }
.wa-phone-input::placeholder { color:#8696a0; }
.wa-phone-submit { background:#22bb55; color:#fff; border:none; border-radius:24px; padding:11px 30px; font-size:15px; font-weight:600; cursor:pointer; }
.wa-phone-submit:hover:not(:disabled) { background:#1fa94c; }
.wa-phone-submit:disabled { background:#2a3942; color:#7d8a93; cursor:not-allowed; box-shadow:inset 0 0 0 1px #374248; opacity:.9; }
.wa-pair-title { font-size:20px; font-weight:500; margin:0 0 6px; color:#e9edef; }
.wa-pair-sub { font-size:13px; color:#8696a0; margin:0 0 20px; }
.wa-pair-sub strong { color:#e9edef; }
.wa-pair-edit { color:#25d366; cursor:pointer; font-weight:500; }
.wa-pair-code-box { display:flex; align-items:center; gap:6px; justify-content:center; background:#111b21; border:2px dashed #25d366; border-radius:12px; padding:24px; margin:0 auto 20px; user-select:all; }
.wa-pair-char { font-family:'Courier New',monospace; font-size:34px; font-weight:700; color:#25d366; letter-spacing:2px; }
.wa-pair-dash { font-family:'Courier New',monospace; font-size:30px; font-weight:700; color:#25d366; margin:0 6px; }
.wa-pair-steps { margin:0; padding-left:20px; color:#e9edef; font-size:13px; line-height:1.9; }
.wa-pair-steps li { margin-bottom:2px; }

/* ==== WA官方样式颜色加固：固定深色底控件内文字不被 .wa-scan-card *{color:inherit} 覆盖 ==== */
.wa-phone-country { color:#e9edef !important; }
.wa-phone-country-name { color:#e9edef !important; }
.wa-country-search { color:#22bb55 !important; }
.wa-country-search input { color:#e9edef !important; }
.wa-country-search input::placeholder { color:#8696a0 !important; }
.wa-country-item-name { color:#e9edef !important; }
.wa-country-item-en { color:#8696a0 !important; }
.wa-country-item-code { color:#8696a0 !important; }
.wa-phone-prefix { color:#e9edef !important; }
.wa-phone-input { color:#e9edef !important; }
.wa-phone-input::placeholder { color:#8696a0 !important; }
.wa-phone-submit { color:#fff !important; }
.wa-phone-submit:disabled { color:#8696a0 !important; }
.wa-phone-link-bottom { color:#22bb55 !important; }
.wa-pair-edit { color:#25d366 !important; }
.wa-pair-char { color:#25d366 !important; }
.wa-pair-dash { color:#25d366 !important; }

</style>
