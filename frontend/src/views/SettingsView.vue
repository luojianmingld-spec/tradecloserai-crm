<template>
  <div class="stg">
    <!-- 顶部导航栏 -->
    <header class="stg-header">
      <button class="stg-header-back" @click="handleBack" :aria-label="currentView === 'menu' ? '返回应用' : '返回设置'">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M15 18l-6-6 6-6"/>
        </svg>
      </button>
      <h1 class="stg-header-title">{{ headerTitle }}</h1>
      <span class="stg-header-spacer"></span>
    </header>

    <!-- 可滚动内容区 -->
    <div class="stg-body" ref="bodyRef">
      <!-- ============ 桌面端左侧栏（≥992px 显示，参考扣子设置页双栏） ============ -->
      <aside v-if="isDesktop" class="stg-side">
        <div class="stg-side-head">
          <button class="stg-side-back" @click="goHome" aria-label="返回应用">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <span class="stg-side-title">设置</span>
        </div>

        <div class="stg-side-user">
          <div class="stg-avatar stg-side-avatar">{{ (authStore.user?.name || authStore.user?.username || 'U').charAt(0).toUpperCase() }}</div>
          <div class="stg-userinfo">
            <div class="stg-side-username">{{ authStore.user?.name || authStore.user?.username }}</div>
            <div class="stg-side-usersub">@{{ authStore.user?.username }} · {{ isAdmin ? '管理员' : '成员' }}</div>
          </div>
        </div>

        <nav class="stg-side-nav">
          <button class="stg-side-item" :class="{ active: panelView === 'credits' }" @click="openSub('credits')">
            <span class="stg-icon" style="--ic-bg: rgba(255, 204, 0, 0.16);">💰</span>
            <span class="stg-side-item-title">积分</span>
            <span class="stg-side-item-value">{{ creditsBalance === '--' ? '' : creditsBalance }}</span>
          </button>
          <button class="stg-side-item" :class="{ active: panelView === 'notifications' }" @click="openSub('notifications')">
            <span class="stg-icon" style="--ic-bg: rgba(255, 59, 48, 0.14);">🔔</span>
            <span class="stg-side-item-title">通知中心</span>
            <span v-if="hasUnread" class="stg-reddot" aria-label="有未读公告"></span>
          </button>
          <button class="stg-side-item" :class="{ active: panelView === 'appearance' }" @click="openSub('appearance')">
            <span class="stg-icon" style="--ic-bg: rgba(0, 122, 255, 0.14);">🎨</span>
            <span class="stg-side-item-title">外观设置</span>
            <span class="stg-side-item-value">{{ themeLabel }}</span>
          </button>
          <button class="stg-side-item" :class="{ active: panelView === 'privacy' }" @click="openSub('privacy')">
            <span class="stg-icon" style="--ic-bg: rgba(52, 199, 89, 0.14);">🔒</span>
            <span class="stg-side-item-title">隐私与政策</span>
          </button>
          <button class="stg-side-item" :class="{ active: panelView === 'help' }" @click="openSub('help')">
            <span class="stg-icon" style="--ic-bg: rgba(255, 149, 0, 0.15);">❓</span>
            <span class="stg-side-item-title">帮助中心</span>
          </button>
          <button class="stg-side-item" :class="{ active: panelView === 'about' }" @click="openSub('about')">
            <span class="stg-icon" style="--ic-bg: rgba(142, 142, 147, 0.18);">ℹ️</span>
            <span class="stg-side-item-title">关于TradeCloser AI</span>
          </button>

          <template v-if="isAdmin">
            <div class="stg-side-label">高级设置</div>
            <button class="stg-side-item" :class="{ active: panelView === 'wa' }" @click="openSub('wa')">
              <span class="stg-icon" style="--ic-bg: rgba(0, 168, 132, 0.16);">📱</span>
              <span class="stg-side-item-title">WhatsApp 账号</span>
            </button>
            <button class="stg-side-item" :class="{ active: panelView === 'tg' }" @click="openSub('tg')">
              <span class="stg-icon" style="--ic-bg: rgba(90, 200, 250, 0.16);">✈️</span>
              <span class="stg-side-item-title">Telegram 连接</span>
            </button>
            <button class="stg-side-item" :class="{ active: panelView === 'unattended' }" @click="openSub('unattended')">
              <span class="stg-icon" style="--ic-bg: rgba(162, 132, 94, 0.16);">⏰</span>
              <span class="stg-side-item-title">无人值守</span>
            </button>
            <button class="stg-side-item" :class="{ active: panelView === 'team' }" @click="openSub('team')">
              <span class="stg-icon" style="--ic-bg: rgba(0, 122, 255, 0.14);">👥</span>
              <span class="stg-side-item-title">团队管理</span>
            </button>
            <button class="stg-side-item" :class="{ active: panelView === 'wechat' }" @click="openSub('wechat')">
              <span class="stg-icon" style="--ic-bg: rgba(52, 199, 89, 0.14);">💚</span>
              <span class="stg-side-item-title">微信通知</span>
            </button>
          </template>
        </nav>

        <div class="stg-side-foot">
          <button class="stg-side-item stg-side-logout" @click="handleLogout">
            <span class="stg-icon" style="--ic-bg: rgba(255, 59, 48, 0.12);">🚪</span>
            <span class="stg-logout-text">退出登录</span>
          </button>
          <div class="stg-footnote">TradeCloser AI · 外贸智能 CRM</div>
        </div>
      </aside>

      <!-- ============ 一级菜单 ============ -->
      <div v-show="currentView === 'menu'" class="stg-menu">
        <!-- 用户卡 -->
        <div class="stg-usercard">
          <div class="stg-avatar">{{ (authStore.user?.name || authStore.user?.username || 'U').charAt(0).toUpperCase() }}</div>
          <div class="stg-userinfo">
            <div class="stg-username">{{ authStore.user?.name || authStore.user?.username }}</div>
            <div class="stg-usersub">@{{ authStore.user?.username }} · {{ isAdmin ? '管理员' : '成员' }}</div>
          </div>
        </div>

        <!-- 分组一：积分 -->
        <div class="stg-group">
          <button class="stg-row" @click="openSub('credits')">
            <span class="stg-icon" style="--ic-bg: rgba(255, 204, 0, 0.16);">💰</span>
            <span class="stg-row-title">积分</span>
            <span class="stg-row-value">{{ creditsBalance === '--' ? '' : creditsBalance }}</span>
            <span class="stg-chevron"></span>
          </button>
        </div>

        <!-- 分组二：通知中心 / 外观设置 -->
        <div class="stg-group">
          <button class="stg-row" @click="openSub('notifications')">
            <span class="stg-icon" style="--ic-bg: rgba(255, 59, 48, 0.14);">🔔</span>
            <span class="stg-row-title">通知中心</span>
            <span v-if="hasUnread" class="stg-reddot" aria-label="有未读公告"></span>
            <span class="stg-chevron"></span>
          </button>
          <button class="stg-row" @click="openSub('appearance')">
            <span class="stg-icon" style="--ic-bg: rgba(0, 122, 255, 0.14);">🎨</span>
            <span class="stg-row-title">外观设置</span>
            <span class="stg-row-value">{{ themeLabel }}</span>
            <span class="stg-chevron"></span>
          </button>
        </div>

        <!-- 分组三：隐私与政策 / 帮助中心 / 关于 -->
        <div class="stg-group">
          <button class="stg-row" @click="openSub('privacy')">
            <span class="stg-icon" style="--ic-bg: rgba(52, 199, 89, 0.14);">🔒</span>
            <span class="stg-row-title">隐私与政策</span>
            <span class="stg-chevron"></span>
          </button>
          <button class="stg-row" @click="openSub('help')">
            <span class="stg-icon" style="--ic-bg: rgba(255, 149, 0, 0.15);">❓</span>
            <span class="stg-row-title">帮助中心</span>
            <span class="stg-chevron"></span>
          </button>
          <button class="stg-row" @click="openSub('about')">
            <span class="stg-icon" style="--ic-bg: rgba(142, 142, 147, 0.18);">ℹ️</span>
            <span class="stg-row-title">关于TradeCloser AI</span>
            <span class="stg-chevron"></span>
          </button>
        </div>

        <!-- 高级设置（仅 admin） -->
        <template v-if="isAdmin">
          <div class="stg-group-label">高级设置</div>
          <div class="stg-group">
            <button class="stg-row" @click="openSub('wa')">
              <span class="stg-icon" style="--ic-bg: rgba(0, 168, 132, 0.16);">📱</span>
              <span class="stg-row-title">WhatsApp 账号</span>
              <span class="stg-chevron"></span>
            </button>
            <button class="stg-row" @click="openSub('tg')">
              <span class="stg-icon" style="--ic-bg: rgba(90, 200, 250, 0.16);">✈️</span>
              <span class="stg-row-title">Telegram 连接</span>
              <span class="stg-chevron"></span>
            </button>
            <button class="stg-row" @click="openSub('unattended')">
              <span class="stg-icon" style="--ic-bg: rgba(162, 132, 94, 0.16);">⏰</span>
              <span class="stg-row-title">无人值守</span>
              <span class="stg-chevron"></span>
            </button>
            <button class="stg-row" @click="openSub('team')">
              <span class="stg-icon" style="--ic-bg: rgba(0, 122, 255, 0.14);">👥</span>
              <span class="stg-row-title">团队管理</span>
              <span class="stg-chevron"></span>
            </button>
            <button class="stg-row" @click="openSub('wechat')">
              <span class="stg-icon" style="--ic-bg: rgba(52, 199, 89, 0.14);">💚</span>
              <span class="stg-row-title">微信通知</span>
              <span class="stg-chevron"></span>
            </button>
          </div>
        </template>

        <!-- 退出登录 -->
        <div class="stg-group">
          <button class="stg-row stg-row-logout" @click="handleLogout">
            <span class="stg-logout-text">退出登录</span>
          </button>
        </div>

        <div class="stg-footnote">TradeCloser AI · 外贸智能 CRM</div>
      </div>

      <!-- ============ 右栏内容区（移动端 display:contents 不影响布局） ============ -->
      <div class="stg-main" ref="mainRef">
        <div v-if="isDesktop" class="stg-pane-title">{{ paneTitle }}</div>

      <!-- ============ 二级页：积分 ============ -->
      <div v-show="panelView === 'credits'" class="stg-sub">
        <div class="stg-balance-card">
          <div class="stg-balance-num">{{ creditsBalance }}</div>
          <div class="stg-balance-label">当前积分</div>
          <div class="stg-balance-actions">
            <button class="stg-btn-primary" @click="goCredits">去充值</button>
            <button class="stg-btn-plain" @click="goCreditsTransactions">充值记录</button>
          </div>
        </div>
        <div class="stg-tip-card">
          <p>· AI 调用按模型分级扣费：轻量模型 10~60 积分，旗舰模型 135 积分</p>
          <p>· 1 元 = 1000 积分，100 元起充</p>
        </div>

        <div class="stg-group-label">积分明细</div>
        <div class="stg-group">
          <div v-if="creditsTxLoading" class="stg-row stg-row-static"><span class="stg-row-title stg-text-dim">加载中...</span></div>
          <template v-else-if="creditsTx.length > 0">
            <div v-for="tx in creditsTx" :key="tx.id" class="stg-row stg-row-static stg-tx-row">
              <span class="stg-tx-icon" :class="tx.amount >= 0 ? 'in' : 'out'">{{ tx.amount >= 0 ? '＋' : '－' }}</span>
              <span class="stg-tx-main">
                <span class="stg-tx-title">{{ tx.reason || txTypeLabel(tx.type) }}</span>
                <span class="stg-tx-time">{{ fmtTxTime(tx.createdAt) }}</span>
              </span>
              <span class="stg-tx-amount" :class="tx.amount >= 0 ? 'in' : 'out'">{{ tx.amount >= 0 ? '+' : '' }}{{ tx.amount }}</span>
            </div>
          </template>
          <div v-else class="stg-row stg-row-static"><span class="stg-row-title stg-text-dim">暂无积分明细</span></div>
        </div>
        <button v-if="creditsTx.length > 0" class="stg-link-btn" @click="goCreditsTransactions">查看全部明细</button>
      </div>

      <!-- ============ 二级页：通知中心 ============ -->
      <div v-show="panelView === 'notifications'" class="stg-sub">
        <div class="stg-note-intro">产品功能更新与公告</div>
        <div class="stg-group">
          <div v-for="(n, i) in releaseNotes" :key="i" class="stg-note-row">
            <div class="stg-note-date">{{ n.date }}</div>
            <div class="stg-note-body">
              <div class="stg-note-title">{{ n.title }}</div>
              <div class="stg-note-desc">{{ n.desc }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- ============ 二级页：外观设置 ============ -->
      <div v-show="panelView === 'appearance'" class="stg-sub">
        <div class="stg-note-intro">选择界面显示模式，将应用于整个平台。</div>
        <div class="stg-group">
          <button class="stg-row" @click="setTheme('light')">
            <span class="stg-icon" style="--ic-bg: rgba(255, 149, 0, 0.15);">☀️</span>
            <span class="stg-row-title">日间模式</span>
            <span class="stg-row-value">明亮清爽</span>
            <span v-if="!isDark" class="stg-check">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </span>
          </button>
          <button class="stg-row" @click="setTheme('dark')">
            <span class="stg-icon" style="--ic-bg: rgba(88, 86, 214, 0.15);">🌙</span>
            <span class="stg-row-title">夜间模式</span>
            <span class="stg-row-value">柔和护眼</span>
            <span v-if="isDark" class="stg-check">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </span>
          </button>
        </div>
      </div>

      <!-- ============ 二级页：隐私与政策 ============ -->
      <div v-show="panelView === 'privacy'" class="stg-sub">
        <div class="stg-legal-card">
          <h3>隐私政策</h3>
          <p class="stg-legal-update">更新日期：2026-08-01</p>
          <h4>1. 我们收集的信息</h4>
          <p>为提供外贸客户管理服务，我们会收集您注册时提供的账号信息（姓名、用户名），以及您在使用过程中授权接入的通信数据（如 WhatsApp / Telegram 消息、联系人信息）与业务数据（客户资料、跟进记录）。</p>
          <h4>2. 信息的使用</h4>
          <p>收集的信息仅用于：提供消息收发与同步、AI 翻译与话术生成、客户管理与分析等核心功能；不会用于任何与产品功能无关的用途。</p>
          <h4>3. 信息的存储与安全</h4>
          <p>您的数据存储于受访问控制保护的服务器中，传输过程采用加密通道。我们采用最小权限原则限制内部访问，并对关键操作留存审计日志。</p>
          <h4>4. 信息的共享</h4>
          <p>我们不会向第三方出售您的数据。仅在调用您自行配置的 AI 模型服务时，会将必要的对话内容发送至对应模型服务提供商以完成生成任务。</p>
          <h4>5. 您的权利</h4>
          <p>您可以随时在设置中管理账号与连接状态、解绑通知渠道。如需导出或删除您的数据，可通过下方入口或联系支持团队处理。</p>
        </div>
        <div class="stg-legal-card">
          <h3>用户协议</h3>
          <p class="stg-legal-update">更新日期：2026-08-01</p>
          <h4>1. 服务说明</h4>
          <p>TradeCloser AI 是一款面向外贸团队的智能 CRM SaaS 服务，提供多渠道消息聚合、AI 辅助沟通、客户管理等功能。</p>
          <h4>2. 账号与使用规范</h4>
          <p>您应妥善保管账号凭据，并对账号下的操作负责。请勿利用本服务发送垃圾信息、从事违法违规活动或侵犯第三方权益；违规账号可能被限制或终止服务。</p>
          <h4>3. 积分与付费</h4>
          <p>AI 相关功能按次消耗积分，积分通过充值获得，已充值积分不支持退款。扣费规则以产品内公示为准。</p>
          <h4>4. 服务的变更与终止</h4>
          <p>我们可能根据运营需要调整服务功能，重要调整将通过通知中心公告。您可随时停止使用并申请删除账号数据。</p>
          <h4>5. 免责声明</h4>
          <p>AI 生成内容仅供参考，请人工核验后再用于正式业务场景。因不可抗力或第三方服务异常导致的中断，我们将尽力恢复但不承担间接损失。</p>
        </div>
        <div class="stg-group">
          <div class="stg-row stg-row-static stg-row-disabled">
            <span class="stg-icon" style="--ic-bg: rgba(142, 142, 147, 0.18);">📦</span>
            <span class="stg-row-title">导出我的数据</span>
            <span class="stg-row-value">即将支持</span>
          </div>
        </div>
      </div>

      <!-- ============ 二级页：帮助中心 ============ -->
      <div v-show="panelView === 'help'" class="stg-sub">
        <div class="stg-help-hero">
          <div class="stg-help-hi">Hi, {{ authStore.user?.name || authStore.user?.username }} 👋</div>
          <div class="stg-help-sub">有什么可以帮你的？</div>
        </div>
        <div class="stg-guide-card" @click="openWecomGuide">
          <div class="stg-guide-ic">🏢</div>
          <div class="stg-guide-body">
            <div class="stg-guide-title">企业微信绑定 · 流程操作说明</div>
            <div class="stg-guide-desc">工厂对接 / 货代对接如何绑定企业微信，同步联系人并接管沟通，点击查看图文步骤</div>
          </div>
          <span class="stg-guide-arrow">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>
          </span>
        </div>
        <div class="stg-group-label">常见问题</div>
        <div class="stg-group">
          <div v-for="(f, i) in faqList" :key="i" class="stg-faq">
            <button class="stg-row stg-faq-q" @click="toggleFaq(i)">
              <span class="stg-row-title">{{ f.q }}</span>
              <span class="stg-faq-arrow" :class="{ open: faqOpen === i }">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
              </span>
            </button>
            <div v-show="faqOpen === i" class="stg-faq-a">{{ f.a }}</div>
          </div>
        </div>
        <a class="stg-link-btn" :href="'mailto:' + contactEmail">联系支持 · {{ contactEmail }}</a>
      </div>

      <!-- ============ 二级页：关于 ============ -->
      <div v-show="panelView === 'about'" class="stg-sub">
        <div class="stg-about-card">
          <img src="/tc-logo.png" class="stg-about-logo" alt="TradeCloser AI" onerror="this.style.display='none'" />
          <div class="stg-about-name">TradeCloser AI</div>
          <div class="stg-about-version">版本 {{ appVersion }}</div>
          <div class="stg-about-latest">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            已是最新版本
          </div>
        </div>
        <div class="stg-about-copy">© 2026 TradeCloser AI. All rights reserved.</div>
        <div class="stg-about-copy stg-text-dim">外贸团队的智能客户沟通工作台</div>
      </div>

      <!-- ============ 高级设置二级页（现有功能完整保留） ============ -->
      <div v-show="isAdvView" class="adv-page">
      <!-- 微信通知绑定 -->
      <section v-show="currentView === 'wechat'" class="settings-section">
        <div class="wechat-bind-card">
          <div class="wechat-bind-head">
            <span class="wechat-bind-title">📱 微信通知</span>
            <span class="wechat-bind-tag" :class="wechatBound ? 'bound' : 'unbound'">{{ wechatBound ? '已绑定' : '未绑定' }}</span>
          </div>
          <p class="wechat-bind-desc">绑定微信服务号后，客户无人回复、需人工介入等关键通知将实时推送到你手机。</p>
          <div v-if="wechatBound" class="wechat-bind-row">
            <span class="wechat-bind-openid">OpenID：{{ wechatOpenid }}</span>
            <button class="wechat-bind-btn plain" :disabled="wechatBusy" @click="unbindWechat">{{ wechatBusy ? '处理中...' : '解绑' }}</button>
          </div>
          <div v-else class="wechat-bind-row">
            <button class="wechat-bind-btn primary" :disabled="wechatBusy" @click="showWechatQr">{{ wechatBusy ? '处理中...' : '绑定微信' }}</button>
          </div>
        </div>
      </section>

      <!-- 团队成员管理（仅admin） -->
      <section v-show="currentView === 'team'" v-if="isAdmin" class="settings-section">
        <div class="section-header">
          <h2>团队成员</h2>
          <button class="btn-add" @click="showAddUser = true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            添加成员
          </button>
        </div>
        <div v-if="teamLoading" class="empty-state"><p>加载中...</p></div>
        <div v-else-if="teamUsers.length === 0" class="empty-state"><p>暂无成员</p></div>
        <div v-else class="team-list">
          <div v-for="u in teamUsers" :key="u.id" class="team-row">
            <div class="avatar-circle sm">{{ (u.name || u.username).charAt(0).toUpperCase() }}</div>
            <div class="team-info">
              <div class="team-name">{{ u.name }} <span v-if="u.id === authStore.user?.id" class="tag-me">我</span></div>
              <div class="team-sub">@{{ u.username }} · {{ String(u.role).toLowerCase() === 'admin' ? '管理员' : '成员' }}</div>
            </div>
            <div class="team-actions" v-if="u.id !== authStore.user?.id">
              <button class="btn-icon-sm" @click="resetPwd(u)" title="重置密码">🔑</button>
              <button class="btn-icon-sm btn-danger" @click="delUser(u)" title="删除">🗑️</button>
            </div>
          </div>
        </div>
      </section>

      <!-- Telegram User Bot -->
      <section v-show="currentView === 'tg'" class="settings-section tg-section">
        <div class="section-header">
          <h2>📡 Telegram 连接</h2>
          <button v-if="tgStatus.connected" class="btn-add" @click="syncTgContacts" :disabled="tgSyncing">
            {{ tgSyncing ? '同步中...' : '同步联系人' }}
          </button>
        </div>
        <p class="section-desc">连接你的 Telegram 账号后，可将联系人一键同步到客户管理，并在消息页面统一收发 Telegram 消息。</p>
        <div v-if="tgLoading" class="tg-status">
          <span class="tg-loading">加载中...</span>
        </div>
        <div v-else-if="tgStatus.connected" class="tg-info">
          <div class="tg-status-row">
            <span class="tg-dot connected"></span>
            <span class="tg-label">已连接</span>
            <span class="tg-username">@{{ tgStatus.user?.username }}</span>
            <span class="tg-phone">{{ tgStatus.user?.phone }}</span>
          </div>
          <div class="tg-stats">
            <span class="tg-stat">联系人: {{ tgContactCount }}</span>
          </div>
          <div v-if="tgSyncResult" class="tg-sync-result">
            ✅ 已同步 {{ tgSyncResult.synced }} 个联系人到CRM数据库
          </div>
        </div>
        <div v-else class="tg-status">
          <span class="tg-dot disconnected"></span>
          <span class="tg-label">未连接</span>
        </div>
      </section>


      <!-- WhatsApp 账号管理 -->
      <section v-show="currentView === 'wa'" class="settings-section wa-section">
        <div class="section-header">
          <h2>📱 WhatsApp 账号管理</h2>
          <button class="btn-add" @click="showCreateAccount = true">+ 新建账号</button>
        </div>
        <p class="section-desc">管理你的 WhatsApp 账号：连接新账号、查看在线状态、配置网络代理、断开闲置账号。💡同时在线多个账号时，建议为每个账号配置不同的网络代理，可降低封号风险。日常聊天请回到消息页面。</p>
        <div v-if="waLoading" class="tg-status"><span class="tg-loading">加载中...</span></div>
        <div v-else-if="waAccounts.length === 0" class="empty-state"><p>暂无 WhatsApp 账号</p></div>
        <div v-else class="wa-account-list">
          <div v-for="acct in waAccounts" :key="acct.id" class="wa-account-card">
            <div class="wa-account-info">
              <div class="wa-account-name">
                <span class="wa-dot" :class="acct.connectionState"></span>
                {{ acct.name || acct.phone || acct.instanceName }}
              </div>
              <div class="wa-account-meta">
                <span v-if="acct.phone">{{ acct.phone }}</span>
                <span v-if="acct.instanceName" class="wa-instance">{{ acct.instanceName }}</span>
                <span class="wa-state-badge" :class="acct.connectionState">{{ stateLabel(acct.connectionState) }}</span>
              </div>
            </div>
            <div class="wa-account-actions">
              <button class="btn-icon-sm btn-proxy" @click="openProxyModal(acct)" title="代理配置">
                🌐 代理
              </button>
              <button v-if="acct.connectionState !== 'open'" class="btn-icon-sm btn-primary-sm" @click="showQR(acct)" title="扫码连接">
                🔗 连接
              </button>
              <button v-if="acct.connectionState === 'open'" class="btn-icon-sm btn-danger-sm" @click="disconnectWA(acct)" title="断开连接">
                ⏏️ 断开
              </button>
            </div>
          </div>
        </div>
      </section>


      <section v-show="currentView === 'unattended'" class="settings-section">
        <h2>无人值守自动回复</h2>
        <p class="section-desc">非工作时间，AI 自动回复客户消息，不让客户等太久。</p>
        
        <div class="form-group">
          <label class="toggle-label">
            <input type="checkbox" v-model="unattendedForm.enabled" />
            <span>启用无人值守</span>
          </label>
        </div>

        <div class="form-group" v-if="unattendedForm.enabled">
          <label>开始时间（24小时制）</label>
          <select v-model="unattendedForm.startHour" class="form-select">
            <option v-for="h in 24" :key="h" :value="h - 1">{{ String(h - 1).padStart(2, '0') }}:00</option>
          </select>
        </div>

        <div class="form-group" v-if="unattendedForm.enabled">
          <label>结束时间（24小时制）</label>
          <select v-model="unattendedForm.endHour" class="form-select">
            <option v-for="h in 24" :key="h" :value="h - 1">{{ String(h - 1).padStart(2, '0') }}:00</option>
          </select>
        </div>

        <div class="form-group" v-if="unattendedForm.enabled">
          <label>时区</label>
          <select v-model="unattendedForm.timezone" class="form-select">
            <option value="Asia/Shanghai">北京时间 (UTC+8)</option>
            <option value="Asia/Dubai">迪拜 (UTC+4)</option>
            <option value="Asia/Kolkata">印度 (UTC+5:30)</option>
            <option value="America/New_York">美东 (UTC-5)</option>
            <option value="America/Los_Angeles">美西 (UTC-8)</option>
            <option value="Europe/London">伦敦 (UTC+0)</option>
            <option value="Europe/Berlin">柏林 (UTC+1)</option>
          </select>
        </div>

        <div class="form-group" v-if="unattendedForm.enabled">
          <label>回复策略</label>
          <div class="radio-group">
            <label class="radio-label">
              <input type="radio" v-model="unattendedForm.strategy" value="smart" />
              <span>智能回复（AI 根据客户消息生成）</span>
            </label>
            <label class="radio-label">
              <input type="radio" v-model="unattendedForm.strategy" value="simple" />
              <span>简单告知（固定话术：正在离线中）</span>
            </label>
          </div>
        </div>

        <div class="form-actions" v-if="unattendedForm.enabled">
          <button class="btn btn-primary" @click="saveUnattended" :disabled="unattendedSaving">
            {{ unattendedSaving ? '保存中...' : '保存设置' }}
          </button>
          <span v-if="unattendedSaved" class="save-hint">✓ 已保存</span>
        </div>
      </section>
      </div>
      </div>
    </div>

    <!-- ============ 弹窗（全部保留原有逻辑） ============ -->
    <!-- 微信绑定二维码弹窗 -->
    <div v-if="showWechatQrModal" class="modal-mask" @click.self="closeWechatQr">
      <div class="modal-card wechat-qr-modal">
        <h3>微信扫码绑定</h3>
        <p class="wechat-qr-tip">打开微信「扫一扫」，关注公众号后自动完成绑定</p>
        <div v-if="wechatQrLoading" class="wechat-qr-loading">二维码生成中...</div>
        <img v-else-if="wechatQrUrl" :src="wechatQrUrl" class="wechat-qr-img" alt="微信绑定二维码" />
        <div v-else class="wechat-qr-error">二维码获取失败，请关闭后重试</div>
        <div class="wechat-qr-foot">
          <button class="wechat-qr-cancel" @click="closeWechatQr">关闭</button>
        </div>
      </div>
    </div>

    <!-- 添加/重置密码弹窗（极简内联） -->
    <div v-if="showAddUser || pwdTarget" class="modal-mask" @click.self="closeModals">
      <div class="modal-card">
        <h3>{{ pwdTarget ? '重置密码 - ' + pwdTarget.name : '添加成员' }}</h3>
        <div v-if="!pwdTarget" class="form-group">
          <label>姓名</label>
          <input v-model="userForm.name" class="form-input" placeholder="显示名，如张三"/>
        </div>
        <div v-if="!pwdTarget" class="form-group">
          <label>用户名（登录用）</label>
          <input v-model="userForm.username" class="form-input" placeholder="英文/数字"/>
        </div>
        <div v-if="!pwdTarget" class="form-group">
          <label>角色</label>
          <select v-model="userForm.role" class="form-select">
            <option value="user">成员</option>
            <option value="admin">管理员</option>
          </select>
        </div>
        <div class="form-group">
          <label>{{ pwdTarget ? '新密码' : '初始密码' }}</label>
          <input v-model="userForm.password" class="form-input" type="text" placeholder="至少4位"/>
        </div>
        <div class="form-actions">
          <button class="btn-cancel" @click="closeModals">取消</button>
          <button class="btn-primary" @click="submitUser" :disabled="submitting">{{ submitting ? '提交中...' : '确认' }}</button>
        </div>
        <div v-if="modalMsg" class="inline-msg" :class="modalErr ? 'err' : 'ok'">{{ modalMsg }}</div>
      </div>
    </div>

    <!-- 代理配置右侧抽屉面板 -->
    <transition name="drawer-fade">
      <div v-if="showProxyModal" class="proxy-drawer-overlay" @click.self="closeProxyModal">
        <transition name="drawer-slide">
          <div v-if="showProxyModal" class="proxy-drawer">
            <div class="drawer-header">
              <h3>🌐 代理配置</h3>
              <button class="drawer-close" @click="closeProxyModal">✕</button>
            </div>
            <div class="drawer-subtitle">{{ proxyAccount?.name || proxyAccount?.instanceName }}</div>
            <!-- 静态住宅IP购买推荐 -->
            <div class="proxy-recommend-card">
              <div class="proxy-recommend-header" @click="showProxyRecommendation = !showProxyRecommendation">
                <span class="proxy-recommend-toggle">{{ showProxyRecommendation ? '▾' : '▸' }}</span>
                <span class="proxy-recommend-tip">💡 需要静态住宅IP？推荐使用静态住宅IP来降低WhatsApp封号风险</span>
              </div>
              <div v-show="showProxyRecommendation" class="proxy-recommend-body">
                <div class="proxy-recommend-vendor">
                  <div class="vendor-header">
                    <span class="vendor-name">🏷️ IPRoyal</span>
                    <span class="vendor-price">$7.99/月/个</span>
                  </div>
                  <p class="vendor-desc">支持SOCKS5，性价比高，适合WhatsApp多账号场景</p>
                  <a href="https://iproyal.com/residential-proxies.html" target="_blank" rel="noopener" class="vendor-link-btn">🔗 前往购买</a>
                </div>
                <div class="proxy-recommend-steps">
                  <p class="steps-title">📋 购买指引</p>
                  <ol>
                    <li>选择国家/地区（建议与目标客户匹配）</li>
                    <li>选择时长（按月/季度/年）</li>
                    <li>完成付款</li>
                    <li>获取IP地址、端口、用户名、密码</li>
                    <li>将获取到的信息填入下方表单</li>
                  </ol>
                </div>
              </div>
            </div>
            <div class="proxy-form">
              <div class="form-group">
                <label>代理协议</label>
                <select v-model="proxyForm.protocol" class="form-input">
                  <option value="socks5">SOCKS5</option>
                  <option value="http">HTTP</option>
                  <option value="https">HTTPS</option>
                </select>
              </div>
              <div class="form-group">
                <label>代理地址</label>
                <input v-model="proxyForm.host" class="form-input" placeholder="例如: 217.156.108.62" />
              </div>
              <div class="form-group">
                <label>代理端口</label>
                <input v-model="proxyForm.port" class="form-input" placeholder="例如: 50101" type="number" />
              </div>
              <div class="form-group">
                <label>用户名 <span class="optional">(可选)</span></label>
                <input v-model="proxyForm.username" class="form-input" placeholder="无认证可留空" />
              </div>
              <div class="form-group">
                <label>密码 <span class="optional">(可选)</span></label>
                <input v-model="proxyForm.password" class="form-input" type="password" placeholder="无认证可留空" />
              </div>
              <div v-if="proxyStatus" class="proxy-status" :class="proxyStatus.type">{{ proxyStatus.msg }}</div>
            </div>
            <div class="form-actions">
              <button class="btn-secondary" @click="deleteProxy" :disabled="!proxyForm.hasProxy">删除代理</button>
              <button class="btn-primary" @click="saveProxy">保存配置</button>
            </div>
          </div>
        </transition>
      </div>
    </transition>

    <!-- 新建账号弹窗 -->
    <div v-if="showCreateAccount" class="modal-mask" @click.self="showCreateAccount = false">
      <div class="modal-card create-account-modal">
        <h3>+ 新建 WhatsApp 账号</h3>
        <div class="form-group">
          <label>账号名称</label>
          <input v-model="newAccount.name" class="form-input" placeholder="例如: Eric、Alice" />
        </div>
        <div class="form-group">
          <label>手机号</label>
          <input v-model="newAccount.phone" class="form-input" placeholder="例如: 8618038118960" />
        </div>
        <div class="form-group">
          <label>实例名称 <span class="optional">(自动生成)</span></label>
          <input v-model="newAccount.instanceName" class="form-input" placeholder="留空自动生成" />
        </div>
        
        <!-- 代理配置折叠区 -->
        <div class="create-proxy-section">
          <div class="create-proxy-toggle" @click="showCreateProxy = !showCreateProxy">
            <span class="toggle-icon">{{ showCreateProxy ? '▾' : '▸' }}</span>
            <span class="toggle-label">🌐 配置代理 <span class="optional">(可选)</span></span>
            <span v-if="newAccount.proxy.host && !showCreateProxy" class="proxy-configured-badge">已配置</span>
          </div>
          <div v-show="showCreateProxy" class="create-proxy-form">
            <div class="proxy-tip">💡 建议使用静态住宅IP，可降低WhatsApp封号风险。推荐 <a href="https://iproyal.com/residential-proxies.html" target="_blank">IPRoyal</a> ($7.99/月)</div>
            <div class="form-group">
              <label>代理协议</label>
              <select v-model="newAccount.proxy.protocol" class="form-input">
                <option value="socks5">SOCKS5</option>
                <option value="http">HTTP</option>
                <option value="https">HTTPS</option>
              </select>
            </div>
            <div class="form-row">
              <div class="form-group flex-2">
                <label>代理地址</label>
                <input v-model="newAccount.proxy.host" class="form-input" placeholder="IP地址" />
              </div>
              <div class="form-group flex-1">
                <label>端口</label>
                <input v-model="newAccount.proxy.port" class="form-input" placeholder="端口" type="number" />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>用户名 <span class="optional">(可选)</span></label>
                <input v-model="newAccount.proxy.username" class="form-input" placeholder="无认证留空" />
              </div>
              <div class="form-group">
                <label>密码 <span class="optional">(可选)</span></label>
                <input v-model="newAccount.proxy.password" class="form-input" type="password" placeholder="无认证留空" />
              </div>
            </div>
          </div>
        </div>
        
        <div class="form-actions">
          <button class="btn-cancel" @click="showCreateAccount = false">取消</button>
          <button class="btn-primary" @click="createAccount" :disabled="!newAccount.name || createLoading">
            {{ createLoading ? '创建中...' : '创建并连接' }}
          </button>
        </div>
      </div>
    </div>

    <!-- WhatsApp 登录弹窗 (WhatsApp Web Style) -->
    <div v-if="showQRModal" class="modal-mask" @click.self="closeQRModal">
      <div class="modal-card wa-login-modal">
        <!-- Top banner -->
        <div class="wa-download-banner">
          <span class="wa-download-text">Download WhatsApp for Windows</span>
          <button class="wa-download-btn" @click="openExternal('https://apps.microsoft.com/detail/9NBLGGH5M64S')">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15v-4H7l5-7v4h4l-5 7z"/></svg>
            Download
          </button>
        </div>
        
        <!-- Main login area -->
        <div class="wa-login-content">
          <!-- Left: Steps -->
          <div class="wa-login-steps">
            <h2 class="wa-login-title">Scan to log in</h2>
            <div class="wa-steps-list">
              <div class="wa-step">
                <span class="wa-step-num">1</span>
                <span class="wa-step-text">Scan the QR code with your phone's camera</span>
              </div>
              <div class="wa-step">
                <span class="wa-step-num">2</span>
                <div class="wa-step-text">
                  Tap the link to open WhatsApp
                  <svg class="wa-inline-icon" viewBox="0 0 32 32" width="14" height="14" fill="#00a884"><path d="M16.003 3C9.385 3 4 8.384 4 15.002c0 2.416.719 4.669 1.956 6.542L4 27l5.567-1.874a11.94 11.94 0 006.436 1.878c6.617 0 12.002-5.384 12.002-12.001C28.005 8.384 22.62 3 16.003 3z"/></svg>
                </div>
              </div>
              <div class="wa-step">
                <span class="wa-step-num">3</span>
                <span class="wa-step-text">Scan the QR code again to link to your account</span>
              </div>
            </div>
            <a class="wa-need-help" href="https://faq.whatsapp.com" target="_blank">
              Need help?
              <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/></svg>
            </a>
          </div>
          
          <!-- Right: QR Code -->
          <div class="wa-qr-section">
            <div v-if="qrLoading" class="qr-loading">
              <div class="qr-loading-spinner"></div>
              <span>Getting QR code...</span>
            </div>
            <div v-else-if="qrBase64" class="qr-image-wrapper">
              <img :src="qrBase64" class="qr-image" alt="WhatsApp QR Code" />
              <div class="wa-qr-logo">
                <svg viewBox="0 0 32 32" width="32" height="32" fill="#fff"><path d="M16.003 3C9.385 3 4 8.384 4 15.002c0 2.416.719 4.669 1.956 6.542L4 27l5.567-1.874a11.94 11.94 0 006.436 1.878c6.617 0 12.002-5.384 12.002-12.001C28.005 8.384 22.62 3 16.003 3z"/></svg>
              </div>
            </div>
            <div v-else class="qr-error">
              <svg viewBox="0 0 24 24" width="48" height="48" fill="#8696a0"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
              <p>Failed to load QR code</p>
              <button class="wa-retry-btn" @click="refreshQR">Try again</button>
            </div>
          </div>
        </div>
        
        <!-- Bottom area -->
        <div class="wa-login-bottom">
          <label class="wa-stay-logged">
            <input type="checkbox" v-model="stayLoggedIn" />
            <span>Stay logged in on this browser</span>
            <span class="wa-info-icon" title="For your security, we recommend turning this off when using a public computer">&#9432;</span>
          </label>
          <a class="wa-phone-login" href="#" @click.prevent="switchLoginMode('phone')">
            Log in with phone number
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
          </a>
        </div>
        
        <!-- Phone login mode (overlay) -->
        <div v-if="loginMode === 'phone'" class="wa-phone-overlay">
          <div class="wa-phone-form">
            <h3 class="wa-phone-title">Link with phone number</h3>
            <p class="wa-phone-hint">Enter your phone number to get a pairing code</p>
            
            <div class="form-group">
              <label>Country/Region</label>
              <select v-model="phoneForm.countryCode" class="form-input country-select">
                <option v-for="c in countryList" :key="c.code" :value="c.code">
                  {{ c.flag }} {{ c.name }} ({{ c.nameZh }}) +{{ c.dialCode }}
                </option>
              </select>
            </div>
            
            <div class="form-group">
              <label>Phone number</label>
              <div class="phone-input-wrapper">
                <span class="dial-code">+{{ phoneForm.countryCode }}</span>
                <input v-model="phoneForm.phoneNumber" class="form-input phone-input" 
                       placeholder="Enter phone number" type="tel" />
              </div>
            </div>

            <div v-if="pairingCode" class="pairing-code-display">
              <label>Pairing code (enter in WhatsApp)</label>
              <div class="pairing-code-box">
                <span class="pairing-code">{{ pairingCode }}</span>
              </div>
              <p class="pairing-hint">Open WhatsApp > Settings > Linked Devices > Link with phone number > Enter this code</p>
            </div>

            <div v-if="pairingError" class="error-msg">{{ pairingError }}</div>

            <div v-if="showConflictDialog" class="conflict-dialog">
              <div class="conflict-dialog-card">
                <h4>WhatsApp 号码已被占用</h4>
                <p>{{ conflictInfo?.message }}</p>
                <p class="conflict-hint">确认后，原账号的 WhatsApp 将被强制下线。</p>
                <div class="conflict-actions">
                  <button class="btn-cancel" @click="cancelConflict">取消</button>
                  <button class="btn-primary btn-danger" @click="confirmForcePairing" :disabled="pairingLoading">
                    {{ pairingLoading ? '处理中...' : '确认下线原账号' }}
                  </button>
                </div>
              </div>
            </div>
            
            <div class="wa-phone-actions">
              <button class="btn-cancel" @click="switchLoginMode('qr')">Back</button>
              <button class="btn-primary" @click="requestPairingCode" 
                      :disabled="!phoneForm.phoneNumber || pairingLoading">
                {{ pairingLoading ? 'Getting code...' : (pairingCode ? 'Get new code' : 'Get pairing code') }}
              </button>
            </div>
          </div>
        </div>
        
        <!-- Footer -->
        <div class="wa-login-footer">
          <span>Don't have a WhatsApp account? <a href="https://www.whatsapp.com/download" target="_blank">Get started</a></span>
        </div>
        <div class="wa-encryption-notice">
          <span>&#128274; Your personal messages are end-to-end encrypted</span>
        </div>
        <div class="wa-terms">
          <a href="https://www.whatsapp.com/legal/terms-of-service" target="_blank">Terms</a>
          <span> &amp; </span>
          <a href="https://www.whatsapp.com/legal/privacy-policy" target="_blank">Privacy Policy</a>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted, onUnmounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '../stores/auth.js';
import { ElMessage, ElMessageBox } from 'element-plus';
import api from '../utils/api.js';
import pkg from '../../package.json';

// ===== 苹果/小米式极简设置：一级菜单 + 二级页内部视图切换（2026-08-29 改版） =====
const currentView = ref('menu');
const bodyRef = ref(null);

const viewTitles = {
  menu: '设置',
  credits: '积分',
  notifications: '通知中心',
  appearance: '外观设置',
  privacy: '隐私与政策',
  help: '帮助中心',
  about: '关于TradeCloser AI',
  wa: 'WhatsApp 账号',
  tg: 'Telegram 连接',
  unattended: '无人值守',
  team: '团队管理',
  wechat: '微信通知',
};
const ADV_VIEWS = ['wa', 'tg', 'unattended', 'team', 'wechat'];
const headerTitle = computed(() => viewTitles[currentView.value] || '设置');
// ===== 桌面双栏（≥992px，参考扣子设置页）：menu 态在桌面映射为默认面板（积分） =====
const isDesktop = ref(window.matchMedia('(min-width: 992px)').matches);
const mainRef = ref(null);
const panelView = computed(() => (isDesktop.value && currentView.value === 'menu') ? 'credits' : currentView.value);
const paneTitle = computed(() => viewTitles[panelView.value] || '设置');
const isAdvView = computed(() => ADV_VIEWS.includes(panelView.value));
let mql = null;
function onMqChange(e) { isDesktop.value = e.matches; }
const isAdmin = computed(() => String(authStore.user?.role || '').toLowerCase() === 'admin');

function openSub(v) {
  currentView.value = v;
  if (v === 'notifications') markReleaseRead();
  if (v === 'credits') loadCreditsTx();
}
function handleBack() {
  if (currentView.value !== 'menu') {
    currentView.value = 'menu';
  } else {
    router.push('/');
  }
}
watch(currentView, () => {
  bodyRef.value?.scrollTo({ top: 0 });
  mainRef.value?.scrollTo({ top: 0 });
});
// 桌面双栏：切到积分视图时确保明细已加载（初始加载在 onMounted 处理，函数内部有去重）
watch(panelView, (v) => {
  if (v === 'credits') loadCreditsTx();
});
function goHome() {
  router.push('/');
}

// 支持 /settings?tab=xxx 直达指定面板（兼容旧链接）
const TAB_MAP = {
  account: 'menu', appearance: 'appearance', credits: 'credits', notifications: 'notifications',
  privacy: 'privacy', help: 'help', about: 'about', wechat: 'wechat',
  wa: 'wa', tg: 'tg', models: 'models', translation: 'translation', reply: 'reply',
  summarize: 'summarize', background: 'background', unattended: 'unattended', team: 'team',
};

// 通知中心：产品更新公告（前端内置，时间倒序）
const releaseNotes = [
  { date: '2026-08-29', title: '设置页全新改版', desc: '一级菜单式极简设计，常用设置一步直达' },
  { date: '2026-08-29', title: '积分页上线', desc: '余额与积分明细一目了然，充值更顺畅' },
  { date: '2026-08-28', title: '欢迎页精简 & 移动端体验优化', desc: '首屏更聚焦，移动端操作更顺滑' },
  { date: '2026-08-27', title: '积分按模型分级扣费', desc: '不同模型分级计费更合理；新联系人客户确认、6大Agent文档生成同步上线' },
];
const RELEASE_READ_KEY = 'crm_release_last_read';
const releaseLastRead = ref(Number(localStorage.getItem(RELEASE_READ_KEY) || 0));
const hasUnread = computed(() => releaseNotes.some(n => new Date(n.date + 'T00:00:00').getTime() > releaseLastRead.value));
function markReleaseRead() {
  releaseLastRead.value = Date.now();
  localStorage.setItem(RELEASE_READ_KEY, String(releaseLastRead.value));
}

// 积分明细
const creditsTx = ref([]);
const creditsTxLoading = ref(false);
const creditsTxLoaded = ref(false);
async function loadCreditsTx() {
  if (creditsTxLoaded.value || creditsTxLoading.value) return;
  creditsTxLoading.value = true;
  try {
    const { data } = await api.get('/payments/transactions', { params: { page: 1, pageSize: 20 } });
    creditsTx.value = data?.data?.list || [];
    creditsTxLoaded.value = true;
  } catch (e) {
    creditsTx.value = [];
  } finally {
    creditsTxLoading.value = false;
  }
}
function txTypeLabel(t) {
  return { recharge: '充值', consume: '消耗', gift: '赠送', compensate: '补偿', freeze: '冻结', unfreeze: '解冻', deduct: '扣减' }[t] || t;
}
function fmtTxTime(s) {
  if (!s) return '-';
  const d = new Date(s);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// 帮助中心 FAQ
const faqOpen = ref(-1);
function toggleFaq(i) { faqOpen.value = faqOpen.value === i ? -1 : i; }
function openWecomGuide() { window.open('/help/wecom-binding.html', '_blank', 'noopener'); }
const contactEmail = 'support@tradecloser.ai';
const faqList = [
  { q: '如何扫码连接 WhatsApp？', a: '进入「设置 → 高级设置 → WhatsApp 账号」，点击「新建账号」创建账号后，用手机 WhatsApp 扫描弹出的二维码即可连接；也支持「手机号配对码」方式连接，全程约 1 分钟。' },
  { q: '积分是如何扣费的？', a: 'AI 翻译、回复生成、客户背调、文档生成等 AI 调用按次扣费，并按模型分级（标准调用每次 150 积分）。1 元 = 1000 积分，100 元起充，余额与明细可在「积分」页查看。' },
  { q: 'AI 助手怎么用？', a: '在工作台「助手」页直接向 AI 提问或下达指令，可生成回复话术、总结客户需求、背调客户公司、生成外贸单证等，生成结果可一键插入回复。' },
  { q: '如何使用消息翻译？', a: '在「高级设置 → 翻译设置」中开启自动翻译并选择目标语言；收到外语消息自动译成中文，发送中文时也可自动译成对方语言。' },
  { q: '支持多设备同时登录吗？', a: '支持。同一账号可在多台电脑/手机浏览器同时登录 CRM，消息与连接状态实时同步。' },
  { q: '收不到客户消息怎么办？', a: '请先到「高级设置 → WhatsApp 账号」检查连接状态是否为「已连接」；若显示未连接，点击「连接」重新扫码即可恢复。仍异常可尝试退出登录后重新登录。' },
  { q: '需要手动清理缓存吗？', a: '不需要。系统会在每次版本更新后自动清理旧缓存，无需手动操作；如遇页面异常，退出登录后重新登录即可。' },
];

// 关于页
const appVersion = pkg.version || '1.0.0';

// TG User Bot
const tgStatus = ref({ connected: false, user: null });
const tgLoading = ref(true);
const tgSyncing = ref(false);
const tgContactCount = ref(0);
const tgSyncResult = ref(null);

const router = useRouter();
const route = useRoute();
watch(() => route.query.tab, (v) => {
  if (v && TAB_MAP[v]) currentView.value = TAB_MAP[v];
}, { immediate: true });

const authStore = useAuthStore();
const teamUsers = ref([]);
const teamLoading = ref(false);
const showAddUser = ref(false);
const pwdTarget = ref(null);
const submitting = ref(false);
const modalMsg = ref('');
const modalErr = ref(false);
const userForm = reactive({ name:'', username:'', password:'', role:'user' });

async function loadTeam() {
  if (!isAdmin.value) return;
  teamLoading.value = true;
  try { const { data } = await api.get('/auth/users'); teamUsers.value = data; }
  catch(e) { ElMessage.error('加载成员失败'); }
  teamLoading.value = false;
}

function handleLogout() {
  ElMessageBox.confirm('确定退出登录？', '提示', { type: 'warning' }).then(() => {
    authStore.logout();
    router.push('/login');
  }).catch(()=>{});
}

function resetPwd(u) {
  pwdTarget.value = u;
  userForm.password = '';
  modalMsg.value = '';
}

async function delUser(u) {
  try {
    await ElMessageBox.confirm(`确定删除成员 ${u.name} (@${u.username})？`, '删除确认', { type: 'warning' });
    await api.delete('/auth/users/' + u.id);
    ElMessage.success('已删除');
    loadTeam();
  } catch(e) { if(e!=='cancel') ElMessage.error('删除失败'); }
}

function closeModals() {
  showAddUser.value = false; pwdTarget.value = null;
  modalMsg.value = ''; userForm.name=''; userForm.username=''; userForm.password=''; userForm.role='user';
}

async function submitUser() {
  submitting.value = true; modalMsg.value = ''; modalErr.value = false;
  try {
    if (pwdTarget.value) {
      if (!userForm.password || userForm.password.length < 4) throw new Error('密码至少4位');
      await api.put('/auth/users/' + pwdTarget.value.id, { password: userForm.password });
      ElMessage.success('密码已重置');
    } else {
      if (!userForm.username || !userForm.password) throw new Error('用户名密码必填');
      if (userForm.password.length < 4) throw new Error('密码至少4位');
      await api.post('/auth/register', { ...userForm });
      ElMessage.success('成员已添加');
    }
    closeModals();
    loadTeam();
  } catch(e) {
    modalErr.value = true;
    modalMsg.value = e.response?.data?.error || e.message || '操作失败';
  }
  submitting.value = false;
}


const isDark = ref((localStorage.getItem('crm-theme') || 'dark') === 'dark');
function setTheme(mode) {
  isDark.value = mode === 'dark';
  document.documentElement.setAttribute('data-theme', mode);
  localStorage.setItem('crm-theme', mode);
}
const themeLabel = computed(() => (isDark.value ? '夜间模式' : '日间模式'));

// 积分
const creditsBalance = ref('--');

// WeChat bind
const wechatBound = ref(false);
const wechatOpenid = ref('');
const wechatBusy = ref(false);
const showWechatQrModal = ref(false);
const wechatQrLoading = ref(false);
const wechatQrUrl = ref('');
let wechatQrTimer = null;

async function loadWechatStatus() {
  try {
    const res = await api.get('/wechat/bind-status');
    wechatBound.value = !!res.data.bound;
    wechatOpenid.value = res.data.openid || '';
  } catch (e) {
    console.warn('load wechat bind status failed:', e.message);
  }
}

async function showWechatQr() {
  wechatBusy.value = true;
  showWechatQrModal.value = true;
  wechatQrLoading.value = true;
  wechatQrUrl.value = '';
  try {
    const res = await api.get('/wechat/qrcode');
    const q = res.data.qrcode;
    if (q && q.ticket) {
      wechatQrUrl.value = 'https://api.weixin.qq.com/cgi-bin/showqrcode?ticket=' + encodeURIComponent(q.ticket);
    }
    clearInterval(wechatQrTimer);
    wechatQrTimer = setInterval(async () => {
      try {
        const st = await api.get('/wechat/bind-status');
        if (st.data.bound) {
          clearInterval(wechatQrTimer);
          wechatQrTimer = null;
          wechatBound.value = true;
          wechatOpenid.value = st.data.openid || '';
          showWechatQrModal.value = false;
          ElMessage.success('微信绑定成功，通知已开启');
        }
      } catch (e) { /* 轮询中忽略 */ }
    }, 3000);
  } catch (e) {
    ElMessage.error('获取二维码失败：' + (e.response?.data?.error || e.message));
    showWechatQrModal.value = false;
  } finally {
    wechatQrLoading.value = false;
    wechatBusy.value = false;
  }
}

function closeWechatQr() {
  clearInterval(wechatQrTimer);
  wechatQrTimer = null;
  showWechatQrModal.value = false;
}

async function unbindWechat() {
  try {
    await ElMessageBox.confirm('确定解绑微信？解绑后将收不到客户无人回复等微信通知。', '解绑确认', { type: 'warning' });
  } catch (e) { return; }
  wechatBusy.value = true;
  try {
    await api.post('/wechat/unbind');
    wechatBound.value = false;
    wechatOpenid.value = '';
    ElMessage.success('已解绑微信');
  } catch (e) {
    ElMessage.error('解绑失败：' + (e.response?.data?.error || e.message));
  } finally {
    wechatBusy.value = false;
  }
}
async function loadCreditsBalance() {
  try {
    const { data } = await api.get('/payments/balance');
    creditsBalance.value = data?.data?.balance ?? data?.balance ?? 0;
  } catch (e) { creditsBalance.value = '--'; }
}
function goCredits() { router.push('/credits'); }
function goCreditsTransactions() { router.push('/credits/transactions'); }


// Unattended settings
const unattendedForm = ref({
  enabled: false,
  startHour: 22,
  endHour: 8,
  timezone: 'Asia/Shanghai',
  strategy: 'smart',
});
const unattendedSaving = ref(false);
const unattendedSaved = ref(false);

async function loadUnattended() {
  try {
    const res = await api.get('/settings/unattended');
    unattendedForm.value = { ...unattendedForm.value, ...res.data };
  } catch (e) {
    console.warn('load unattended failed:', e.message);
  }
}

async function saveUnattended() {
  unattendedSaving.value = true;
  unattendedSaved.value = false;
  try {
    await api.put('/settings/unattended', unattendedForm.value);
    unattendedSaved.value = true;
    setTimeout(() => { unattendedSaved.value = false; }, 3000);
  } catch (e) {
    console.error('save unattended failed:', e);
  } finally {
    unattendedSaving.value = false;
  }
}


const fetchTgStatus = async () => {
  try {
    const res = await fetch('/api/tg-userbot/state');
    if (res.ok) {
      tgStatus.value = await res.json();
    }
    if (tgStatus.value.connected) {
      const contactsRes = await fetch('/api/tg-userbot/contacts').then(r => r.json());
      tgContactCount.value = contactsRes.contacts?.length || 0;
    }
  } catch (e) {
    console.warn('TG status fetch failed:', e);
  } finally {
    tgLoading.value = false;
  }
};

const syncTgContacts = async () => {
  tgSyncing.value = true;
  tgSyncResult.value = null;
  try {
    const res = await fetch('/api/tg-userbot/sync-contacts', { method: 'POST' });
    if (res.ok) {
      tgSyncResult.value = await res.json();
      tgContactCount.value = tgSyncResult.value.total;
    }
  } catch (e) {
    console.error('TG sync failed:', e);
  } finally {
    tgSyncing.value = false;
  }
};


      // ===== WhatsApp 账号管理 =====
      const waAccounts = ref([]);
      const waLoading = ref(false);
      const showQRModal = ref(false);
      const qrLoading = ref(false);
      const qrBase64 = ref(null);
      const currentQRAccount = ref(null);
      let qrPollTimer = null;
      const loginMode = ref('qr');
      const stayLoggedIn = ref(true);
      const phoneForm = ref({ countryCode: '86', phoneNumber: '' });
      const pairingCode = ref(null);
      const pairingError = ref(null);
      const pairingLoading = ref(false);
      const showConflictDialog = ref(false);
      const conflictInfo = ref(null);
      const countryList = [
        { code: '86', name: 'China', nameZh: '中国', dialCode: '86', flag: '🇨🇳' },
        { code: '1', name: 'United States', nameZh: '美国', dialCode: '1', flag: '🇺🇸' },
        { code: '1', name: 'Canada', nameZh: '加拿大', dialCode: '1', flag: '🇨🇦' },
        { code: '44', name: 'United Kingdom', nameZh: '英国', dialCode: '44', flag: '🇬🇧' },
        { code: '49', name: 'Germany', nameZh: '德国', dialCode: '49', flag: '🇩🇪' },
        { code: '33', name: 'France', nameZh: '法国', dialCode: '33', flag: '🇫🇷' },
        { code: '81', name: 'Japan', nameZh: '日本', dialCode: '81', flag: '🇯🇵' },
        { code: '82', name: 'South Korea', nameZh: '韩国', dialCode: '82', flag: '🇰🇷' },
        { code: '886', name: 'Taiwan', nameZh: '台湾', dialCode: '886', flag: '🇨🇳' },
        { code: '852', name: 'Hong Kong', nameZh: '香港', dialCode: '852', flag: '🇭🇰' },
        { code: '853', name: 'Macau', nameZh: '澳门', dialCode: '853', flag: '🇲🇴' },
        { code: '65', name: 'Singapore', nameZh: '新加坡', dialCode: '65', flag: '🇸🇬' },
        { code: '60', name: 'Malaysia', nameZh: '马来西亚', dialCode: '60', flag: '🇲🇾' },
        { code: '66', name: 'Thailand', nameZh: '泰国', dialCode: '66', flag: '🇹🇭' },
        { code: '62', name: 'Indonesia', nameZh: '印尼', dialCode: '62', flag: '🇮🇩' },
        { code: '63', name: 'Philippines', nameZh: '菲律宾', dialCode: '63', flag: '🇵🇭' },
        { code: '84', name: 'Vietnam', nameZh: '越南', dialCode: '84', flag: '🇻🇳' },
        { code: '91', name: 'India', nameZh: '印度', dialCode: '91', flag: '🇮🇳' },
        { code: '92', name: 'Pakistan', nameZh: '巴基斯坦', dialCode: '92', flag: '🇵🇰' },
        { code: '20', name: 'Egypt', nameZh: '埃及', dialCode: '20', flag: '🇪🇬' },
        { code: '27', name: 'South Africa', nameZh: '南非', dialCode: '27', flag: '🇿🇦' },
        { code: '234', name: 'Nigeria', nameZh: '尼日利亚', dialCode: '234', flag: '🇳🇬' },
        { code: '254', name: 'Kenya', nameZh: '肯尼亚', dialCode: '254', flag: '🇰🇪' },
        { code: '55', name: 'Brazil', nameZh: '巴西', dialCode: '55', flag: '🇧🇷' },
        { code: '52', name: 'Mexico', nameZh: '墨西哥', dialCode: '52', flag: '🇲🇽' },
        { code: '54', name: 'Argentina', nameZh: '阿根廷', dialCode: '54', flag: '🇦🇷' },
        { code: '56', name: 'Chile', nameZh: '智利', dialCode: '56', flag: '🇨🇱' },
        { code: '57', name: 'Colombia', nameZh: '哥伦比亚', dialCode: '57', flag: '🇨🇴' },
        { code: '34', name: 'Spain', nameZh: '西班牙', dialCode: '34', flag: '🇪🇸' },
        { code: '39', name: 'Italy', nameZh: '意大利', dialCode: '39', flag: '🇮🇹' },
        { code: '7', name: 'Russia', nameZh: '俄罗斯', dialCode: '7', flag: '🇷🇺' },
        { code: '380', name: 'Ukraine', nameZh: '乌克兰', dialCode: '380', flag: '🇺🇦' },
        { code: '90', name: 'Turkey', nameZh: '土耳其', dialCode: '90', flag: '🇹🇷' },
        { code: '971', name: 'UAE', nameZh: '阿联酋', dialCode: '971', flag: '🇦🇪' },
        { code: '966', name: 'Saudi Arabia', nameZh: '沙特', dialCode: '966', flag: '🇸🇦' },
        { code: '964', name: 'Iraq', nameZh: '伊拉克', dialCode: '964', flag: '🇮🇶' },
        { code: '98', name: 'Iran', nameZh: '伊朗', dialCode: '98', flag: '🇮🇷' },
        { code: '1', name: 'Australia', nameZh: '澳大利亚', dialCode: '61', flag: '🇦🇺' },
        { code: '64', name: 'New Zealand', nameZh: '新西兰', dialCode: '64', flag: '🇳🇿' },
      ];
      const showCreateAccount = ref(false);
      const newAccount = ref({ name: '', phone: '', instanceName: '', proxy: { protocol: 'socks5', host: '', port: '', username: '', password: '' } });
      const showCreateProxy = ref(false);
      const createLoading = ref(false);

      const stateLabel = (state) => {
        const map = { open: "已连接", connecting: "连接中", close: "未连接", disconnected: "已断开", no_instance: "未创建实例", error: "异常" };
        return map[state] || state;
      };

      const fetchWAStatus = async () => {
        waLoading.value = true;
        try {
          const res = await api.get(`/accounts/wa/status`);
          waAccounts.value = res.data;
        } catch (e) {
          console.error("Failed to fetch WA status:", e);
        } finally {
          waLoading.value = false;
        }
      };

      const showQR = async (acct) => {
        showQRModal.value = true;
        currentQRAccount.value = acct;
        qrBase64.value = null;
        await refreshQR();
      };

      const refreshQR = async () => {
        if (!currentQRAccount.value) return;
        qrLoading.value = true;
        qrBase64.value = null;
        try {
          const res = await api.get(`/accounts/wa/${currentQRAccount.value.id}/qr`);
          qrBase64.value = res.data.base64;
          // Poll for connection status
          if (qrPollTimer) clearInterval(qrPollTimer);
          qrPollTimer = setInterval(async () => {
            try {
              const statusRes = await api.get(`/accounts/wa/status`);
              waAccounts.value = statusRes.data;
              const acct = waAccounts.value.find(a => a.id === currentQRAccount.value.id);
              if (acct && acct.connectionState === "open") {
                clearInterval(qrPollTimer);
                qrPollTimer = null;
                closeQRModal();
              }
            } catch {}
          }, 3000);
        } catch (e) {
          console.error("QR fetch failed:", e);
        } finally {
          qrLoading.value = false;
        }
      };

      const openExternal = (url) => {
        window.open(url, '_blank');
      };

      const switchLoginMode = (mode) => {
        loginMode.value = mode;
        pairingCode.value = null;
        pairingError.value = null;
        if (mode === 'qr') {
          refreshQR();
        }
      };

      const requestPairingCode = async () => {
        if (!phoneForm.value.phoneNumber) return;
        pairingLoading.value = true;
        pairingError.value = null;
        pairingCode.value = null;
        try {
          // Get full phone with country code
          const dialCode = countryList.find(c => c.code === phoneForm.value.countryCode)?.dialCode || phoneForm.value.countryCode;
          const fullPhone = dialCode + phoneForm.value.phoneNumber;
          
          // Call backend to request pairing code via Evolution API
          const res = await api.post('/accounts/wa/' + currentQRAccount.value.id + '/pairing-code', {
            phone: fullPhone
          });
          
          if (res.data.conflict) {
            conflictInfo.value = res.data;
            showConflictDialog.value = true;
            return;
          }
          
          if (res.data.pairingCode) {
            pairingCode.value = res.data.pairingCode;
          } else if (res.data.base64) {
            // If no pairing code, fall back to QR mode
            loginMode.value = 'qr';
            qrBase64.value = res.data.base64;
          } else if (res.data.error) {
            pairingError.value = res.data.error;
          } else {
            pairingError.value = '配对码不可用，请尝试扫码登录';
          }
        } catch (e) {
          pairingError.value = e.response?.data?.error || '获取配对码失败';
        } finally {
          pairingLoading.value = false;
        }
      };

      const confirmForcePairing = async () => {
        if (!conflictInfo.value) return;
        pairingLoading.value = true;
        showConflictDialog.value = false;
        try {
          const res = await api.post('/accounts/wa/' + currentQRAccount.value.id + '/pairing-code/force', {
            phone: conflictInfo.value.phone
          });
          if (res.data.pairingCode) {
            pairingCode.value = res.data.pairingCode;
          } else if (res.data.error) {
            pairingError.value = res.data.error;
          } else {
            pairingError.value = '配对码不可用，请尝试扫码登录';
          }
        } catch (e) {
          pairingError.value = e.response?.data?.error || '获取配对码失败';
        } finally {
          pairingLoading.value = false;
          conflictInfo.value = null;
        }
      };

      const cancelConflict = () => {
        showConflictDialog.value = false;
        conflictInfo.value = null;
      };

      const closeQRModal = () => {
        showQRModal.value = false;
        qrBase64.value = null;
        currentQRAccount.value = null;
        pairingCode.value = null;
        pairingError.value = null;
        if (qrPollTimer) { clearInterval(qrPollTimer); qrPollTimer = null; }
      };

      const createAccount = async () => {
        if (!newAccount.value.name) return;
        createLoading.value = true;
        try {
          // Auto-generate instanceName if not provided
          const instName = newAccount.value.instanceName || 
            'wa_' + newAccount.value.name.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Date.now().toString(36);
          
          const res = await api.post('/accounts/wa/connect', {
            instanceName: instName,
            name: newAccount.value.name,
            phone: newAccount.value.phone || undefined,
          });
          
          // 如果填写了代理配置，自动设置代理
          const proxy = newAccount.value.proxy;
          if (proxy && proxy.host && proxy.port) {
            try {
              await api.post(`/accounts/wa/${res.data.account.id}/proxy`, {
                protocol: proxy.protocol,
                host: proxy.host,
                port: parseInt(proxy.port),
                username: proxy.username || undefined,
                password: proxy.password || undefined,
              });
            } catch (pe) {
              console.warn('设置代理失败，继续连接:', pe);
            }
          }
          
          // Close create modal, open QR modal with the new account
          showCreateAccount.value = false;
          newAccount.value = { name: '', phone: '', instanceName: '', proxy: { protocol: 'socks5', host: '', port: '', username: '', password: '' } };
          showCreateProxy.value = false;
          
          if (res.data.base64) {
            showQRModal.value = true;
            currentQRAccount.value = res.data.account;
            qrBase64.value = res.data.base64;
            // Start polling
            if (qrPollTimer) clearInterval(qrPollTimer);
            qrPollTimer = setInterval(async () => {
              try {
                const statusRes = await api.get('/accounts/wa/status');
                waAccounts.value = statusRes.data;
                const acct = waAccounts.value.find(a => a.id === res.data.account.id);
                if (acct && acct.connectionState === 'open') {
                  clearInterval(qrPollTimer);
                  qrPollTimer = null;
                  closeQRModal();
                }
              } catch {}
            }, 3000);
          } else {
            alert('获取二维码失败');
          }
        } catch (e) {
          const errMsg = e.response?.data?.message || e.response?.data?.error || e.message;
          if (e.response?.data?.error === 'wa_limit') {
            alert(errMsg);
          } else {
            alert('创建失败: ' + errMsg);
          }
        } finally {
          createLoading.value = false;
        }
      };

      const disconnectWA = async (acct) => {
        if (!confirm(`确定断开 ${acct.name || acct.phone} 的连接？`)) return;
        try {
          await api.post(`/accounts/wa/${acct.id}/disconnect`);
          await fetchWAStatus();
        } catch (e) {
          alert("断开失败: " + e.message);
        }
      };

      // ===== 代理配置 =====
      const showProxyModal = ref(false);
      const proxyAccount = ref(null);
      const proxyForm = ref({ protocol: 'socks5', host: '', port: '', username: '', password: '', hasProxy: false });
      const proxyStatus = ref(null);
      const showProxyRecommendation = ref(true);

      function openProxyModal(acct) {
        proxyAccount.value = acct;
        proxyStatus.value = null;
        proxyForm.value = { protocol: 'socks5', host: '', port: '', username: '', password: '', hasProxy: false };
        showProxyModal.value = true;
        fetch(`/api/accounts/wa/${acct.id}/proxy`)
          .then(r => r.json())
          .then(data => {
            if (data.proxy) {
              proxyForm.value = {
                protocol: data.proxy.protocol || 'socks5',
                host: data.proxy.host || '',
                port: String(data.proxy.port || ''),
                username: data.proxy.username || '',
                password: data.proxy.password || '',
                hasProxy: true,
              };
            }
          })
          .catch(e => console.warn('Load proxy failed:', e));
      }

      function closeProxyModal() {
        showProxyModal.value = false;
        proxyAccount.value = null;
        proxyStatus.value = null;
      }

      async function saveProxy() {
        if (!proxyAccount.value || !proxyForm.value.host || !proxyForm.value.port) {
          proxyStatus.value = { type: 'error', msg: '请填写代理地址和端口' };
          return;
        }
        proxyStatus.value = { type: 'info', msg: '保存中...' };
        try {
          const res = await fetch(`/api/accounts/wa/${proxyAccount.value.id}/proxy`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              protocol: proxyForm.value.protocol,
              host: proxyForm.value.host,
              port: parseInt(proxyForm.value.port),
              username: proxyForm.value.username || undefined,
              password: proxyForm.value.password || undefined,
            }),
          });
          const data = await res.json();
          if (res.ok) {
            proxyStatus.value = { type: 'success', msg: '✅ 代理配置已保存' };
            proxyForm.value.hasProxy = true;
            fetchWAStatus();
          } else {
            proxyStatus.value = { type: 'error', msg: '❌ ' + (data.error || '保存失败') };
          }
        } catch (e) {
          proxyStatus.value = { type: 'error', msg: '❌ 网络错误' };
        }
      }

      async function deleteProxy() {
        if (!proxyAccount.value) return;
        proxyStatus.value = { type: 'info', msg: '删除中...' };
        try {
          const res = await fetch(`/api/accounts/wa/${proxyAccount.value.id}/proxy`, {
            method: 'DELETE',
          });
          if (res.ok) {
            proxyStatus.value = { type: 'success', msg: '✅ 代理已删除' };
            proxyForm.value = { protocol: 'socks5', host: '', port: '', username: '', password: '', hasProxy: false };
            fetchWAStatus();
          } else {
            const data = await res.json();
            proxyStatus.value = { type: 'error', msg: '❌ ' + (data.error || '删除失败') };
          }
        } catch (e) {
          proxyStatus.value = { type: 'error', msg: '❌ 网络错误' };
        }
      }

const onOpenCreateAccount = () => { showCreateAccount.value = true; };

      onMounted(async () => {
  // 桌面双栏：注册断点监听；桌面默认展示积分页时主动加载积分明细（内部有去重）
  mql = window.matchMedia('(min-width: 992px)');
  mql.addEventListener('change', onMqChange);
  if (panelView.value === 'credits') loadCreditsTx();
  fetchTgStatus();
      fetchWAStatus();
  window.addEventListener('open-create-account', onOpenCreateAccount);
  loadTeam();
  await loadUnattended();
  await loadCreditsBalance();
  await loadWechatStatus();
});
onUnmounted(() => {
  window.removeEventListener('open-create-account', onOpenCreateAccount);
  if (mql) mql.removeEventListener('change', onMqChange);
  clearInterval(wechatQrTimer);
});
</script>

<style scoped>
.settings-page {
  min-height: 100%;
  background: var(--chat-bg);
  color: var(--text-primary);
}

.settings-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 20px;
  background: var(--panel-header-bg);
  border-bottom: 1px solid rgba(255,255,255,0.06);
}

.settings-header h1 {
  font-size: 18px;
  font-weight: 600;
}

.back-btn {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 4px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.back-btn:hover {
  background: rgba(255,255,255,0.06);
  color: var(--text-primary);
}

.settings-body {
  max-width: 640px;
  margin: 0 auto;
  padding: 24px 20px;
}

.settings-section {
  margin-bottom: 32px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.settings-section h2 {
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--accent);
}

.settings-section h3 {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 16px 0;
}

/* Empty state */
.empty-state {
  text-align: center;
  padding: 32px 16px;
  color: var(--text-secondary);
}

.empty-hint {
  font-size: 13px;
  color: var(--text-muted);
  margin-top: 4px;
}

/* Provider cards */
.provider-card {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--panel-header-bg);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 12px;
  padding: 14px 16px;
  margin-bottom: 10px;
  transition: all 0.2s;
}

.provider-card.active {
  border-color: var(--accent);
  border-width: 2px;
}

.provider-status {
  flex-shrink: 0;
}

.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--text-muted);
}

.status-dot.active {
  background: var(--accent);
  box-shadow: 0 0 8px rgba(0,168,132,0.5);
}

.provider-info {
  flex: 1;
  min-width: 0;
}

.provider-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.provider-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.provider-tag {
  font-size: 11px;
  background: rgba(0,168,132,0.15);
  color: var(--accent);
  padding: 2px 8px;
  border-radius: 10px;
}

.provider-url {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.provider-model {
  font-size: 12px;
  color: var(--text-muted);
}

.provider-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.btn-icon {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 6px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}

.btn-icon:hover {
  background: rgba(255,255,255,0.08);
}

.btn-activate:hover { color: var(--accent) !important; }
.btn-edit:hover { color: var(--accent-info) !important; }
.btn-delete:hover { color: var(--danger) !important; }

/* Add button */
.btn-add {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border: 1px solid rgba(0,168,132,0.4);
  border-radius: 8px;
  background: transparent;
  color: var(--accent);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-add:hover {
  background: rgba(0,168,132,0.08);
  border-color: var(--accent);
}

/* Form card */
.form-card {
  background: var(--panel-header-bg);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 12px;
  padding: 20px;
  margin-top: 16px;
}

.form-card h3 {
  margin-bottom: 16px;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.form-group {
  margin-bottom: 16px;
}

.form-group.full-width {
  grid-column: 1 / -1;
}

.form-group > label {
  display: block;
  font-size: 14px;
  color: var(--text-primary);
  margin-bottom: 6px;
}

.form-select,
.form-input,
.form-textarea {
  width: 100%;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.12);
  background: var(--panel-bg);
  color: var(--text-primary);
  font-size: 14px;
  outline: none;
  transition: border-color 0.15s;
  box-sizing: border-box;
}

.form-textarea {
  resize: vertical;
  font-family: inherit;
}

.form-select:focus,
.form-input:focus,
.form-textarea:focus {
  border-color: var(--accent);
}

.form-select:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.form-hint {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 4px;
}

.input-with-toggle {
  position: relative;
  display: flex;
  align-items: center;
}

.input-with-toggle .form-input {
  padding-right: 40px;
}

.btn-toggle {
  position: absolute;
  right: 8px;
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
}

.btn-toggle:hover {
  color: var(--text-primary);
}

.test-result-inline {
  padding: 10px 12px;
  border-radius: 8px;
  font-size: 13px;
  margin-bottom: 16px;
}

.test-result-inline.success {
  background: rgba(0,168,132,0.1);
  color: var(--accent);
}

.test-result-inline.error {
  background: rgba(234,67,53,0.1);
  color: var(--danger);
}

.form-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.btn-primary {
  padding: 10px 20px;
  border-radius: 8px;
  border: none;
  background: var(--accent);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s;
}

.btn-primary:hover { opacity: 0.9; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-secondary {
  padding: 10px 20px;
  border-radius: 8px;
  border: 1px solid rgba(0,168,132,0.4);
  background: transparent;
  color: var(--accent);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-secondary:hover { background: rgba(0,168,132,0.08); }
.btn-secondary:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-cancel {
  padding: 10px 20px;
  border-radius: 8px;
  border: none;
  background: rgba(255,255,255,0.08);
  color: var(--text-secondary);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-cancel:hover { background: rgba(255,255,255,0.12); }

/* Tabs */
.tabs {
  display: flex;
  gap: 4px;
  background: var(--panel-header-bg);
  border-radius: 10px;
  padding: 4px;
  margin-bottom: 24px;
}

.tab-btn {
  flex: 1;
  padding: 10px 16px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.tab-btn:hover {
  color: var(--text-primary);
  background: rgba(255,255,255,0.06);
}

.tab-btn.active {
  background: var(--accent);
  color: #fff;
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
  background: var(--accent);
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

/* Radio group */
.radio-group {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.radio-label {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  font-size: 14px;
  color: var(--text-primary);
}

.radio-label input[type="radio"] {
  accent-color: var(--accent);
}

/* Test section */
.test-input-row {
  display: flex;
  gap: 8px;
}

.test-input-row .form-input {
  flex: 1;
}

.btn-test {
  padding: 10px 16px;
  border-radius: 8px;
  border: none;
  background: var(--accent);
  color: #fff;
  font-size: 14px;
  cursor: pointer;
  white-space: nowrap;
  transition: opacity 0.15s;
}

.btn-test:hover { opacity: 0.9; }
.btn-test:disabled { opacity: 0.5; cursor: not-allowed; }

.test-result {
  margin-top: 12px;
  padding: 12px;
  border-radius: 8px;
  background: rgba(0,168,132,0.1);
  font-size: 14px;
}

.result-label {
  color: var(--accent);
  font-size: 12px;
  margin-right: 8px;
}

.result-text {
  color: var(--text-primary);
}

/* Reply results */
.reply-results {
  margin-top: 16px;
}

.reply-item {
  background: var(--panel-header-bg);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 10px;
  padding: 14px;
  margin-bottom: 10px;
}

.reply-index {
  font-size: 12px;
  color: var(--accent);
  font-weight: 600;
  margin-bottom: 6px;
}

.reply-content {
  font-size: 14px;
  color: var(--text-primary);
  line-height: 1.5;
}

/* Summarize result */
.summarize-result,
.background-result {
  margin-top: 16px;
  background: var(--panel-header-bg);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 10px;
  padding: 16px;
}

.result-item {
  margin-bottom: 12px;
}

.result-item:last-child {
  margin-bottom: 0;
}

.result-key {
  display: block;
  font-size: 12px;
  color: var(--accent);
  margin-bottom: 4px;
}

.result-value {
  font-size: 14px;
  color: var(--text-primary);
  line-height: 1.5;
}

.result-section {
  margin-bottom: 16px;
}

.result-section:last-child {
  margin-bottom: 0;
}

.result-section h4 {
  font-size: 13px;
  color: var(--accent);
  margin: 0 0 8px 0;
}

.result-section p {
  font-size: 14px;
  color: var(--text-primary);
  line-height: 1.5;
  margin: 0;
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
  background: var(--accent);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s;
}

.save-btn:hover { opacity: 0.9; }
.save-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.save-msg {
  font-size: 13px;
  color: var(--accent);
}

.save-msg.error {
  color: var(--danger);
}

/* Responsive */
@media (max-width: 768px) {
  .settings-body {
    padding: 12px;
    max-width: 100%;
  }

  .form-grid {
    grid-template-columns: 1fr;
  }

  .form-group.full-width {
    grid-column: 1;
  }

  .tabs {
    flex-wrap: wrap;
  }

  .tab-btn {
    flex: 1 1 calc(50% - 4px);
  }

  .provider-card {
    flex-wrap: wrap;
  }

  .provider-actions {
    width: 100%;
    justify-content: flex-end;
    margin-top: 8px;
  }
}

/* ===== 账户卡片 & 团队管理 ===== */
.account-card {
  background: var(--panel-header-bg);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 12px;
  padding: 16px 18px;
  margin-bottom: 16px;
}
.account-top-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.account-header { display: flex; align-items: center; gap: 14px; flex: 1; min-width: 0; }
.avatar-circle {
  width: 48px; height: 48px; border-radius: 50%;
  background: linear-gradient(135deg, var(--accent), #008069);
  color: #fff; font-weight: 600; font-size: 20px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.avatar-circle.sm { width: 36px; height: 36px; font-size: 15px; }
.account-info { flex: 1; min-width: 0; }
.account-name { font-size: 16px; font-weight: 600; color: var(--text-primary); margin-bottom: 2px; }
.account-sub { font-size: 12px; color: var(--text-secondary); }
.btn-logout {
  padding: 8px 14px; border-radius: 8px; border: 1px solid rgba(239,68,68,0.4);
  background: transparent; color: #ef4444; font-size: 13px; cursor: pointer;
  transition: all 0.15s;
}
.btn-logout:hover { background: rgba(239,68,68,0.15); }

.team-list { display: flex; flex-direction: column; gap: 6px; }
.team-row {
  display: flex; align-items: center; gap: 12px;
  background: var(--panel-header-bg); border: 1px solid rgba(255,255,255,0.06);
  border-radius: 10px; padding: 10px 14px;
}
.team-info { flex: 1; min-width: 0; }
.team-name { font-size: 14px; font-weight: 500; color: var(--text-primary); display: flex; align-items: center; gap: 6px; }
.tag-me { font-size: 10px; background: var(--accent); color: #fff; padding: 1px 6px; border-radius: 6px; font-weight: 600; }
.team-sub { font-size: 11.5px; color: var(--text-secondary); margin-top: 2px; }
.team-actions { display: flex; gap: 4px; flex-shrink: 0; }
.btn-icon-sm {
  width: 32px; height: 32px; border: none; border-radius: 8px;
  background: transparent; cursor: pointer; font-size: 14px;
  display: flex; align-items: center; justify-content: center;
  transition: background 0.15s;
}
.btn-icon-sm:hover { background: rgba(255,255,255,0.08); }
.btn-icon-sm.btn-danger:hover { background: rgba(239,68,68,0.2); }

/* 弹窗 */
.modal-mask {
  position: fixed; inset: 0; background: rgba(0,0,0,0.6);
  display: flex; align-items: center; justify-content: center;
  z-index: 2000; padding: 20px;
}
.modal-card {
  background: var(--panel-header-bg); border-radius: 14px; padding: 20px 22px;
  width: 100%; max-width: 400px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.5);
  border: 1px solid var(--text-muted);
}
.modal-card h3 { font-size: 16px; font-weight: 600; color: var(--text-primary); margin: 0 0 16px 0; }
.inline-msg {
  margin-top: 12px; padding: 8px 12px; border-radius: 8px;
  font-size: 12.5px; text-align: center;
}
.inline-msg.ok { background: rgba(0,168,132,0.15); color: var(--accent); }
.inline-msg.err { background: rgba(239,68,68,0.15); color: #ef4444; }


/* Telegram Section */
.tg-section { border-left: 3px solid #0088cc; }
.tg-status { display: flex; align-items: center; gap: 8px; padding: 8px 0; }
.tg-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.tg-dot.connected { background: #4caf50; box-shadow: 0 0 6px rgba(76,175,80,0.5); }
.tg-dot.disconnected { background: #999; }
.tg-label { font-weight: 500; }
.tg-info { padding: 8px 0; }
.tg-status-row { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; flex-wrap: wrap; }
.tg-username { color: #0088cc; font-weight: 500; }
.tg-phone { color: #888; font-size: 13px; }
.tg-stats { display: flex; gap: 16px; margin-top: 4px; }
.tg-stat { background: var(--bg-secondary, #f5f5f5); padding: 4px 12px; border-radius: 12px; font-size: 13px; color: #666; }
.tg-sync-result { margin-top: 8px; color: #4caf50; font-size: 13px; }
.tg-loading { color: #888; }

/* WhatsApp 账号管理 */
.wa-section { margin-top: 0; }
.wa-account-list { display: flex; flex-direction: column; gap: 12px; }
.wa-account-card {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px; border-radius: 12px;
  background: var(--bg-card, #fff);
  border: 1px solid var(--border, #e5e7eb);
  transition: border-color 0.15s, box-shadow 0.15s;
}
.wa-account-card:hover { border-color: #3b82f6; box-shadow: 0 2px 8px rgba(59,130,246,0.08); }
.wa-account-info { flex: 1; min-width: 0; }
.wa-account-name {
  display: flex; align-items: center; gap: 8px;
  font-weight: 600; font-size: 15px; color: var(--text, #111);
}
.wa-account-meta {
  display: flex; align-items: center; gap: 8px; margin-top: 4px;
  font-size: 13px; color: var(--text-secondary, #6b7280);
}
.wa-instance { background: var(--bg-hover, #f3f4f6); padding: 2px 8px; border-radius: 10px; font-size: 12px; }
.wa-dot {
  width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0;
}
.wa-dot.open { background: #22c55e; box-shadow: 0 0 4px rgba(34,197,94,0.4); }
.wa-dot.connecting { background: #f59e0b; animation: pulse 1.5s infinite; }
.wa-dot.close, .wa-dot.disconnected { background: #9ca3af; }
.wa-dot.error { background: #ef4444; }
.wa-state-badge {
  font-size: 11px; padding: 2px 8px; border-radius: 10px; font-weight: 500;
}
.wa-state-badge.open { background: #dcfce7; color: #15803d; }
.wa-state-badge.connecting { background: #fef3c7; color: #b45309; }
.wa-state-badge.close, .wa-state-badge.disconnected { background: #f3f4f6; color: #6b7280; }
.wa-state-badge.error { background: #fee2e2; color: #b91c1c; }
.wa-state-badge.no_instance { background: #f3f4f6; color: #9ca3af; }
.wa-account-actions { display: flex; gap: 8px; flex-shrink: 0; }
.btn-primary-sm {
  background: #3b82f6; color: #fff; border: none; padding: 6px 12px;
  border-radius: 8px; font-size: 13px; cursor: pointer; font-weight: 500;
}
.btn-primary-sm:hover { background: #2563eb; }
.btn-danger-sm {
  background: #fee2e2; color: #b91c1c; border: 1px solid #fecaca; padding: 6px 12px;
  border-radius: 8px; font-size: 13px; cursor: pointer; font-weight: 500;
}
.btn-danger-sm:hover { background: #fecaca; }

/* QR Modal */
.wa-login-modal {
  width: 660px;
  max-width: 95vw;
  padding: 0;
  overflow: hidden;
  background: #fff;
}

.wa-download-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 24px;
  background: #f0f2f5;
  border-bottom: 1px solid #e5e7eb;
}

.wa-download-text {
  font-size: 13px;
  color: #3b4a54;
}

.wa-download-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 16px;
  background: #00a884;
  color: #fff;
  border: none;
  border-radius: 24px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.wa-download-btn:hover {
  background: #008f72;
}

.wa-login-content {
  display: flex;
  align-items: flex-start;
  padding: 32px 36px 24px;
  gap: 40px;
}

.wa-login-steps {
  flex: 1;
  min-width: 0;
}

.wa-login-title {
  font-size: 28px;
  font-weight: 600;
  color: #111b21;
  margin: 0 0 28px;
  line-height: 1.2;
}

.wa-steps-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
  position: relative;
}

.wa-step {
  display: flex;
  align-items: flex-start;
  gap: 16px;
}

.wa-step-num {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid #00a884;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 600;
  color: #00a884;
  flex-shrink: 0;
}

.wa-step-text {
  font-size: 14px;
  color: #3b4a54;
  line-height: 1.5;
  padding-top: 3px;
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

.wa-inline-icon {
  flex-shrink: 0;
}

.wa-need-help {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-top: 24px;
  font-size: 13px;
  color: #00a884;
  text-decoration: none;
}

.wa-need-help:hover {
  text-decoration: underline;
}

.wa-qr-section {
  flex-shrink: 0;
  width: 220px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.qr-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: #667781;
  font-size: 14px;
}

.qr-loading-spinner {
  width: 36px;
  height: 36px;
  border: 3px solid #e5e7eb;
  border-top-color: #00a884;
  border-radius: 50%;
  animation: qr-spin 0.8s linear infinite;
}

@keyframes qr-spin {
  to { transform: rotate(360deg); }
}

.qr-image-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.qr-image {
  width: 200px;
  height: 200px;
  border-radius: 4px;
}

.wa-qr-logo {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 48px;
  height: 48px;
  background: #00a884;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.qr-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: #667781;
  text-align: center;
}

.qr-error p {
  font-size: 14px;
  margin: 0;
}

.wa-retry-btn {
  margin-top: 8px;
  padding: 8px 20px;
  background: #00a884;
  color: #fff;
  border: none;
  border-radius: 24px;
  font-size: 13px;
  cursor: pointer;
}

.wa-retry-btn:hover {
  background: #008f72;
}

.wa-login-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 36px 16px;
  border-top: 1px solid #f0f2f5;
}

.wa-stay-logged {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #667781;
  cursor: pointer;
}

.wa-stay-logged input[type="checkbox"] {
  width: 18px;
  height: 18px;
  accent-color: #00a884;
}

.wa-info-icon {
  font-size: 14px;
  color: #8696a0;
  cursor: help;
}

.wa-phone-login {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: #00a884;
  text-decoration: none;
}

.wa-phone-login:hover {
  text-decoration: underline;
}

.wa-phone-overlay {
  position: absolute;
  inset: 0;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  padding: 32px;
  border-radius: 8px;
}

.wa-phone-form {
  width: 100%;
  max-width: 380px;
}

.wa-phone-title {
  font-size: 20px;
  font-weight: 600;
  color: #111b21;
  margin: 0 0 8px;
}

.wa-phone-hint {
  font-size: 13px;
  color: #667781;
  margin: 0 0 24px;
}

.wa-phone-actions {
  display: flex;
  gap: 12px;
  margin-top: 24px;
}

.wa-login-footer {
  text-align: center;
  padding: 0 36px 8px;
  font-size: 13px;
  color: #667781;
}

.wa-login-footer a {
  color: #00a884;
  text-decoration: none;
}

.wa-login-footer a:hover {
  text-decoration: underline;
}

.wa-encryption-notice {
  text-align: center;
  padding: 0 36px 4px;
  font-size: 12px;
  color: #8696a0;
}

.wa-terms {
  text-align: center;
  padding: 0 36px 20px;
  font-size: 12px;
}

.wa-terms a {
  color: #00a884;
  text-decoration: none;
}

.wa-terms a:hover {
  text-decoration: underline;
}

.wa-terms span {
  color: #8696a0;
}

/* Phone form inputs reuse */
.form-group { margin-bottom: 16px; }
.form-group label { display: block; font-size: 13px; color: #667781; margin-bottom: 6px; }
.form-input { width: 100%; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px; outline: none; transition: border-color 0.2s; }
.form-input:focus { border-color: #00a884; box-shadow: 0 0 0 3px rgba(0,168,132,0.1); }
.country-select { font-size: 14px; }
.phone-input-wrapper { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 8px; background: #f9fafb; }
.phone-input-wrapper:focus-within { border-color: #00a884; background: #fff; box-shadow: 0 0 0 3px rgba(0,168,132,0.1); }
.dial-code { font-size: 16px; color: #374151; font-weight: 500; min-width: 48px; }
.phone-input { flex: 1; border: none; background: transparent; padding: 0; font-size: 16px; }
.phone-input:focus { outline: none; box-shadow: none; }
.pairing-code-display { margin-top: 24px; text-align: center; }
.conflict-dialog { position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 1200; display: flex; align-items: center; justify-content: center; }
.conflict-dialog-card { background: #fff; color: #111b21; border-radius: 12px; padding: 24px; max-width: 360px; width: 90%; box-shadow: 0 8px 30px rgba(0,0,0,0.2); text-align: center; }
.conflict-dialog-card h4 { margin: 0 0 10px; font-size: 16px; }
.conflict-dialog-card p { margin: 6px 0; font-size: 14px; line-height: 1.5; }
.conflict-hint { color: #667781; font-size: 13px; }
.conflict-actions { display: flex; gap: 10px; justify-content: center; margin-top: 18px; }
.btn-danger { background: #d9534f !important; border-color: #d9534f !important; }
.pairing-code-display label { font-size: 13px; color: #667781; margin-bottom: 8px; display: block; }
.pairing-code-box { background: linear-gradient(135deg, #00a884 0%, #008f72 100%); border-radius: 12px; padding: 20px; margin: 12px 0; }
.pairing-code { font-size: 36px; font-weight: 700; color: #fff; letter-spacing: 4px; font-family: 'Courier New', monospace; }
.pairing-hint { font-size: 12px; color: #8696a0; margin-top: 12px; line-height: 1.5; }
.error-msg { color: #dc2626; font-size: 13px; margin-top: 12px; text-align: center; padding: 8px 12px; background: #fef2f2; border-radius: 6px; }
.btn-cancel { padding: 10px 20px; background: #f0f2f5; color: #3b4a54; border: none; border-radius: 8px; font-size: 14px; cursor: pointer; }
.btn-cancel:hover { background: #e5e7eb; }
.btn-primary { padding: 10px 20px; background: #00a884; color: #fff; border: none; border-radius: 8px; font-size: 14px; cursor: pointer; }
.btn-primary:hover { background: #008f72; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

/* Remove old styles */
.login-tabs, .login-tab, .tab-icon, .login-switch, .login-switch a { display: none; }


/* Proxy recommendation card */
.proxy-recommend-card {
  background: linear-gradient(135deg, #f0f9ff 0%, #eff6ff 100%);
  border: 1px solid #bfdbfe;
  border-radius: 12px;
  padding: 0;
  margin-bottom: 16px;
  overflow: hidden;
}
.proxy-recommend-header {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding: 12px 14px;
  cursor: pointer;
  user-select: none;
  transition: background 0.15s;
}
.proxy-recommend-header:hover {
  background: rgba(59, 130, 246, 0.06);
}
.proxy-recommend-toggle {
  font-size: 11px;
  color: #6366f1;
  margin-top: 2px;
  flex-shrink: 0;
}
.proxy-recommend-tip {
  font-size: 13px;
  color: #1e40af;
  font-weight: 500;
  line-height: 1.5;
}
.proxy-recommend-body {
  padding: 0 14px 14px;
}
.proxy-recommend-vendor {
  background: #fff;
  border-radius: 10px;
  padding: 12px 14px;
  border: 1px solid #dbeafe;
  margin-bottom: 12px;
}
.vendor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}
.vendor-name {
  font-weight: 600;
  font-size: 14px;
  color: #1e3a5f;
}
.vendor-price {
  background: #dcfce7;
  color: #166534;
  font-size: 12px;
  font-weight: 600;
  padding: 2px 10px;
  border-radius: 20px;
}
.vendor-desc {
  font-size: 12.5px;
  color: #6b7280;
  margin: 0 0 10px;
  line-height: 1.5;
}
.vendor-link-btn {
  display: inline-block;
  background: #3b82f6;
  color: #fff !important;
  text-decoration: none !important;
  font-size: 13px;
  font-weight: 500;
  padding: 6px 16px;
  border-radius: 8px;
  transition: background 0.15s;
}
.vendor-link-btn:hover {
  background: #2563eb;
}
.proxy-recommend-steps {
  background: #fff;
  border-radius: 10px;
  padding: 12px 14px;
  border: 1px solid #dbeafe;
}
.steps-title {
  font-size: 13px;
  font-weight: 600;
  color: #1e3a5f;
  margin: 0 0 8px;
}
.proxy-recommend-steps ol {
  margin: 0;
  padding-left: 20px;
}
.proxy-recommend-steps li {
  font-size: 12.5px;
  color: #4b5563;
  line-height: 1.8;
}

/* Proxy drawer */
.proxy-drawer-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.3);
  z-index: 1000;
  display: flex;
  justify-content: flex-end;
}
.proxy-drawer {
  width: 380px !important;
  max-width: 90vw !important;
  height: 100% !important;
  background: #ffffff !important;
  color: #1f2937 !important;
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.12);
  overflow-y: auto !important;
  padding: 24px 20px !important;
  display: flex !important;
  flex-direction: column !important;
}
.proxy-drawer * {
  color: #1f2937 !important;
}
.proxy-drawer h3,
.proxy-drawer .drawer-header h3 {
  color: #111827 !important;
  font-size: 18px !important;
  font-weight: 600 !important;
}
.proxy-drawer .drawer-subtitle {
  color: #6b7280 !important;
  font-size: 13px !important;
  margin-bottom: 16px !important;
}
.proxy-drawer .drawer-close {
  color: #6b7280 !important;
}
.proxy-drawer .drawer-close:hover {
  color: #374151 !important;
}
.proxy-drawer .form-group label {
  color: #374151 !important;
  font-size: 13px !important;
  font-weight: 500 !important;
  display: block !important;
  margin-bottom: 6px !important;
}
.proxy-drawer .optional {
  color: #9ca3af !important;
  font-weight: 400 !important;
  font-size: 11px !important;
}
.proxy-drawer .form-input,
.proxy-drawer select.form-input {
  background: #f9fafb !important;
  color: #1f2937 !important;
  border: 1px solid #d1d5db !important;
  border-radius: 8px !important;
  padding: 10px 12px !important;
  font-size: 14px !important;
  width: 100% !important;
}
.proxy-drawer .form-input:focus {
  border-color: #2563eb !important;
  background: #ffffff !important;
  outline: none !important;
}
.proxy-drawer .proxy-recommend-card {
  background: #f0f9ff !important;
  border: 1px solid #bfdbfe !important;
}
.proxy-drawer .proxy-recommend-tip {
  color: #1e40af !important;
}
.proxy-drawer .vendor-name {
  color: #1e3a5f !important;
}
.proxy-drawer .vendor-desc {
  color: #6b7280 !important;
}
.proxy-drawer .steps-title {
  color: #1e3a5f !important;
}
.proxy-drawer .proxy-recommend-steps li {
  color: #4b5563 !important;
}
.proxy-drawer .btn-primary {
  background: #2563eb !important;
  color: #ffffff !important;
  border: none !important;
}
.proxy-drawer .btn-secondary {
  color: #6b7280 !important;
  border: 1px solid #d1d5db !important;
  background: #ffffff !important;
}
.proxy-drawer .proxy-status {
  font-size: 13px !important;
  padding: 8px 12px !important;
  border-radius: 8px !important;
  margin-bottom: 8px !important;
}
.proxy-drawer .proxy-status.success {
  background: #d1fae5 !important;
  color: #065f46 !important;
}
.proxy-drawer .proxy-status.error {
  background: #fee2e2 !important;
  color: #991b1b !important;
}
.proxy-drawer .proxy-status.info {
  background: #dbeafe !important;
  color: #1e40af !important;
}

/* Create account proxy section */
.create-proxy-section {
  margin: 8px 0 12px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  overflow: hidden;
}
.create-proxy-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 14px;
  cursor: pointer;
  user-select: none;
  background: #f9fafb;
  transition: background 0.15s;
}
.create-proxy-toggle:hover {
  background: #f3f4f6;
}
.toggle-icon {
  font-size: 12px;
  color: #6b7280;
}
.toggle-label {
  font-size: 13.5px;
  font-weight: 500;
  color: #374151;
}
.proxy-configured-badge {
  margin-left: auto;
  font-size: 11px;
  color: #059669;
  background: #d1fae5;
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 500;
}
.create-proxy-form {
  padding: 12px 14px;
  border-top: 1px solid #e5e7eb;
  background: #fff;
}
.proxy-tip {
  font-size: 12px;
  color: #6b7280;
  background: #f0f9ff;
  border: 1px solid #bfdbfe;
  border-radius: 8px;
  padding: 8px 12px;
  margin-bottom: 12px;
  line-height: 1.5;
}
.proxy-tip a {
  color: #2563eb;
  text-decoration: none;
  font-weight: 500;
}
.proxy-tip a:hover {
  text-decoration: underline;
}
.form-row {
  display: flex;
  gap: 12px;
}
.form-row .form-group {
  flex: 1;
}
.form-row .flex-2 {
  flex: 2;
}
.form-row .flex-1 {
  flex: 1;
}
.create-account-modal {
  max-width: 460px;
}
.proxy-form .form-group {
  margin-bottom: 12px;
}
.proxy-form .form-group label {
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 4px;
}
.proxy-form .optional {
  font-weight: 400;
  font-size: 11px;
  color: var(--text-muted);
}
.proxy-status {
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 13px;
  margin-top: 8px;
}
.proxy-status.success {
  background: rgba(34, 197, 94, 0.1);
  color: #22c55e;
  border: 1px solid rgba(34, 197, 94, 0.2);
}
.proxy-status.error {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.2);
}
.proxy-status.info {
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
  border: 1px solid rgba(59, 130, 246, 0.2);
}
.btn-proxy {
  background: rgba(139, 92, 246, 0.1);
  color: #8b5cf6;
  border: 1px solid rgba(139, 92, 246, 0.2);
}
.btn-proxy:hover {
  background: rgba(139, 92, 246, 0.2);
}
.btn-secondary {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.2);
}
.btn-secondary:hover {
  background: rgba(239, 68, 68, 0.2);
}
.btn-secondary:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}


/* ========== GPT 风格整页设置布局（2026-08-20 改版） ========== */
.settings-layout {
  display: flex;
  height: calc(100vh - 60px);
  width: 100%;
  overflow: hidden;
}
.settings-sidebar {
  width: 260px;
  min-width: 260px;
  border-right: 1px solid var(--border-color, rgba(134,150,160,.15));
  background: var(--panel-header-bg, #f0f2f5);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  flex-shrink: 0;
}
.settings-search {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 14px 14px 8px;
  padding: 8px 12px;
  border-radius: 8px;
  background: var(--bg-input, rgba(134,150,160,.12));
  color: var(--text-secondary);
}
.settings-search-input {
  flex: 1;
  background: none;
  border: none;
  outline: none;
  color: var(--text-primary);
  font-size: 13px;
  min-width: 0;
}
.settings-search-input::placeholder { color: var(--text-secondary); }
.settings-nav {
  padding: 4px 0 12px;
  flex: 1;
}
.settings-nav-group-title {
  padding: 12px 20px 6px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: .5px;
  text-transform: uppercase;
  color: var(--text-secondary, #8696a0);
}
.settings-nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 9px 20px;
  border: none;
  background: none;
  cursor: pointer;
  color: var(--text-secondary);
  font-size: 13px;
  text-align: left;
  transition: background .15s, color .15s;
}
.settings-nav-item:hover { background: var(--sidebar-active); color: var(--text-primary); }
.settings-nav-item.active { background: rgba(0,168,132,.12); color: var(--accent); }
.settings-nav-item.active .nav-label { font-weight: 600; }
.settings-nav-item .nav-icon { width: 20px; text-align: center; font-size: 15px; }
.settings-sidebar-foot {
  padding: 12px 14px;
  border-top: 1px solid var(--border-color, rgba(134,150,160,.15));
}
.settings-back-app {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--border-color, rgba(134,150,160,.2));
  border-radius: 8px;
  background: none;
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: all .15s;
}
.settings-back-app:hover { background: var(--sidebar-active); color: var(--text-primary); }
.settings-content {
  flex: 1;
  padding: 28px 32px;
  overflow-y: auto;
  background: var(--panel-bg);
}
.settings-content .settings-section {
  max-width: 920px;
}

/* 积分卡片（账号设置） */
.credits-card {
  margin-top: 20px;
  background: linear-gradient(135deg, #6a5cff 0%, #00a884 100%);
  border-radius: 14px;
  padding: 24px;
  color: #fff;
}
.credits-card-head { margin-bottom: 12px; }
.credits-card-title { font-size: 14px; font-weight: 600; opacity: .95; }
.credits-balance-num { font-size: 44px; font-weight: 700; line-height: 1.1; }
.credits-balance-label { font-size: 13px; opacity: .85; margin-bottom: 16px; }
.credits-actions { display: flex; gap: 10px; }
.credits-btn-primary {
  padding: 9px 22px; border: none; border-radius: 8px;
  background: #fff; color: #111b21; font-size: 13px; font-weight: 600; cursor: pointer;
}
.credits-btn-primary:hover { opacity: .9; }
.credits-btn-plain {
  padding: 9px 18px; border: 1px solid rgba(255,255,255,.6); border-radius: 8px;
  background: transparent; color: #fff; font-size: 13px; cursor: pointer;
}
.credits-btn-plain:hover { background: rgba(255,255,255,.15); }
.credits-tips { margin-top: 16px; font-size: 12px; opacity: .9; line-height: 1.7; }
.credits-tips p { margin: 0; }

/* 微信通知绑定卡片 */
.wechat-bind-card {
  margin-top: 16px;
  border: 1px solid var(--border-color, rgba(134,150,160,.15));
  border-radius: 12px;
  padding: 16px 18px;
  background: var(--panel-header-bg, #fff);
}
.wechat-bind-head { display: flex; align-items: center; justify-content: space-between; }
.wechat-bind-title { font-size: 14px; font-weight: 600; color: var(--text-primary); }
.wechat-bind-tag { font-size: 12px; padding: 2px 10px; border-radius: 10px; }
.wechat-bind-tag.bound { background: rgba(0,168,132,.12); color: #00a884; }
.wechat-bind-tag.unbound { background: rgba(134,150,160,.15); color: var(--text-secondary, #8696a0); }
.wechat-bind-desc { font-size: 12px; color: var(--text-secondary, #8696a0); line-height: 1.6; margin: 10px 0 12px; }
.wechat-bind-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.wechat-bind-openid { font-size: 12px; color: var(--text-secondary, #8696a0); word-break: break-all; }
.wechat-bind-btn { padding: 8px 20px; border: none; border-radius: 8px; font-size: 13px; cursor: pointer; }
.wechat-bind-btn.primary { background: #07c160; color: #fff; font-weight: 600; }
.wechat-bind-btn.primary:hover { opacity: .9; }
.wechat-bind-btn.plain { background: transparent; border: 1px solid var(--border-color, rgba(134,150,160,.3)); color: var(--text-secondary, #8696a0); }
.wechat-bind-btn.plain:hover { color: #f56c6c; border-color: #f56c6c; }
.wechat-bind-btn:disabled { opacity: .5; cursor: not-allowed; }

/* 微信二维码弹窗 */
.wechat-qr-modal { text-align: center; }
.wechat-qr-tip { font-size: 12px; color: var(--text-secondary, #8696a0); margin: -8px 0 16px; }
.wechat-qr-img { width: 220px; height: 220px; border-radius: 8px; display: block; margin: 0 auto; }
.wechat-qr-loading, .wechat-qr-error { height: 220px; display: flex; align-items: center; justify-content: center; color: var(--text-secondary, #8696a0); font-size: 13px; }
.wechat-qr-foot { margin-top: 16px; }
.wechat-qr-cancel { padding: 8px 28px; border: 1px solid var(--border-color, rgba(134,150,160,.3)); border-radius: 8px; background: transparent; color: var(--text-secondary, #8696a0); cursor: pointer; }
.wechat-qr-cancel:hover { opacity: .8; }

/* 设置页头部返回文字 */
.settings-header { display: flex; align-items: center; gap: 8px; padding: 0 20px; height: 60px; border-bottom: 1px solid var(--border-color, rgba(134,150,160,.15)); background: var(--panel-header-bg); }
.settings-header h1 { font-size: 18px; font-weight: 700; color: var(--text-primary); margin: 0; }

/* 移动端适配 */
@media (max-width: 900px) {
  .settings-layout { height: calc(100vh - 50px); }
  /* 手机端侧栏缩为图标栏，避免挤压内容区导致积分卡/按钮溢出屏幕 */
  .settings-sidebar { width: 64px; min-width: 64px; }
  .settings-content { padding: 20px 16px; min-width: 0; }
  .settings-search { display: none; }
  .settings-nav-group-title { padding: 10px 6px 4px; text-align: center; font-size: 9px; }
  .settings-nav-item { justify-content: center; padding: 10px 4px; }
  .settings-nav-item .nav-label { display: none; }
  .settings-sidebar-foot .settings-back-app { font-size: 0; padding: 10px 4px; }
  .settings-content .settings-section { min-width: 0; }
  /* 积分卡：收窄内边距，操作按钮允许换行不溢出 */
  .credits-card { padding: 18px 14px; }
  .credits-actions { flex-wrap: wrap; }
  .credits-btn-primary, .credits-btn-plain { flex: 1 1 auto; text-align: center; }
}


/* 主题外观 */
.appearance-desc-line { font-size: 13px; opacity: .75; margin: -6px 0 20px; }
.appearance-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 14px; max-width: 560px; }
.appearance-card {
  position: relative; padding: 24px 18px; border-radius: 12px; text-align: left; cursor: pointer;
  border: 1.5px solid var(--border-color, rgba(134,150,160,.25));
  background: var(--card-bg, #fff); transition: all .15s ease; color: #1f2937;
}
.appearance-card:hover { border-color: var(--primary-color, #6c5ce7); }
.appearance-card.active { border-color: var(--primary-color, #6c5ce7); box-shadow: 0 0 0 3px rgba(108,92,231,.18); }
.appearance-icon { font-size: 30px; margin-bottom: 10px; }
.appearance-name { font-size: 15px; font-weight: 600; margin-bottom: 4px; color: #111827; }
.appearance-sub { font-size: 12px; opacity: .85; color: #4b5563; }
.appearance-check {
  position: absolute; top: 12px; right: 12px; width: 22px; height: 22px; border-radius: 50%;
  background: var(--primary-color, #6c5ce7); color: #fff; font-size: 13px;
  display: flex; align-items: center; justify-content: center; font-weight: 700;
}

/* ==================================================================
   苹果/小米式极简设置（2026-08-29 改版）一级菜单 + 二级页样式
   ================================================================== */
.stg {
  --stg-bg: #f5f5f4;
  --stg-card: #ffffff;
  --stg-text: #1c1c1e;
  --stg-text-2: #8e8e93;
  --stg-sep: rgba(60, 60, 67, 0.12);
  --stg-blue: #007aff;
  --stg-red: #ff3b30;
  --stg-green: #34c759;
  --stg-chevron: #c7c7cc;
  --stg-hover: rgba(60, 60, 67, 0.06);
  --stg-active: #ffffff;
  --stg-header-bg: rgba(245, 245, 244, 0.82);
  height: 100%;
  height: 100dvh;
  display: flex;
  flex-direction: column;
  background: var(--stg-bg);
  color: var(--stg-text);
  overflow: hidden;
}
[data-theme="dark"] .stg {
  --stg-bg: #000000;
  --stg-card: #1c1c1e;
  --stg-text: #f2f2f7;
  --stg-text-2: #8e8e93;
  --stg-sep: rgba(84, 84, 88, 0.5);
  --stg-blue: #0a84ff;
  --stg-red: #ff453a;
  --stg-green: #30d158;
  --stg-chevron: #48484a;
  --stg-hover: rgba(84, 84, 88, 0.22);
  --stg-active: #2c2c2e;
  --stg-header-bg: rgba(0, 0, 0, 0.72);
}

/* ---- 顶部导航栏 ---- */
.stg-header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  height: 52px;
  padding: 0 8px;
  background: var(--stg-header-bg);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 0.5px solid var(--stg-sep);
  position: relative;
  z-index: 20;
}
.stg-header-back {
  background: none;
  border: none;
  color: var(--stg-blue);
  cursor: pointer;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
}
.stg-header-back:active { opacity: 0.5; }
.stg-header-title {
  flex: 1;
  text-align: center;
  font-size: 17px;
  font-weight: 600;
  color: var(--stg-text);
  margin: 0;
}
.stg-header-spacer { width: 40px; flex-shrink: 0; }

/* ---- 内容滚动区 ---- */
.stg-body {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: 24px 28px 100px; /* 桌面靠左留呼吸感；移动端由媒体查询覆盖 */
}
.stg-menu,
.stg-sub,
.adv-page {
  max-width: 920px;
  margin: 0;
  width: 100%;
}

/* ---- 用户卡 ---- */
.stg-usercard {
  display: flex;
  align-items: center;
  gap: 14px;
  background: var(--stg-card);
  border-radius: 16px;
  padding: 16px;
  margin-bottom: 20px;
}
.stg-avatar {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: linear-gradient(135deg, #00a884, #06cf9c);
  color: #ffffff;
  font-size: 22px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.stg-userinfo { min-width: 0; }
.stg-username { font-size: 18px; font-weight: 600; color: var(--stg-text); }
.stg-usersub { font-size: 13px; color: var(--stg-text-2); margin-top: 3px; }

/* ---- 分组与列表行 ---- */
.stg-group {
  background: var(--stg-card);
  border-radius: 16px;
  overflow: hidden;
  margin-bottom: 20px;
}
.stg-group-label {
  font-size: 13px;
  color: var(--stg-text-2);
  margin: 0 0 8px 16px;
}
.stg-row {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-height: 52px;
  padding: 8px 16px;
  background: none;
  border: none;
  font: inherit;
  text-align: left;
  color: var(--stg-text);
  cursor: pointer;
}
button.stg-row:active { background: var(--stg-sep); }
.stg-row-static { cursor: default; }
.stg-row-disabled { opacity: 0.65; }
/* 组内 hairline 分割线（从图标右侧起） */
.stg-group > .stg-row:not(:first-child)::before,
.stg-group > .stg-faq:not(:first-child)::before,
.stg-group > .stg-note-row:not(:first-child)::before {
  content: '';
  position: absolute;
  top: 0;
  left: 62px;
  right: 0;
  height: 0.5px;
  background: var(--stg-sep);
}
.stg-group > .stg-faq:not(:first-child)::before,
.stg-group > .stg-note-row:not(:first-child)::before { left: 16px; }
.stg-faq { position: relative; }

.stg-icon {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  background: var(--ic-bg, rgba(142, 142, 147, 0.16));
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 17px;
  flex-shrink: 0;
}
.stg-row-title { flex: 1; font-size: 15px; color: var(--stg-text); min-width: 0; }
.stg-row-value { font-size: 14px; color: var(--stg-text-2); flex-shrink: 0; }
.stg-text-dim { color: var(--stg-text-2); }

/* 右侧箭头 › */
.stg-chevron {
  width: 8px;
  height: 8px;
  border-top: 2px solid var(--stg-chevron);
  border-right: 2px solid var(--stg-chevron);
  transform: rotate(45deg);
  flex-shrink: 0;
}
/* 未读红点 */
.stg-reddot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--stg-red);
  flex-shrink: 0;
}
/* 蓝色对勾 */
.stg-check { color: var(--stg-blue); display: flex; align-items: center; flex-shrink: 0; }

/* 退出登录 */
.stg-row-logout { justify-content: center; }
.stg-logout-text { font-size: 15px; font-weight: 500; color: var(--stg-red); }

.stg-footnote {
  text-align: center;
  font-size: 12px;
  color: var(--stg-text-2);
  margin-top: 8px;
}

/* ---- 二级页通用 ---- */
.stg-note-intro {
  font-size: 13px;
  color: var(--stg-text-2);
  margin: 0 0 12px 16px;
}
.stg-link-btn {
  display: block;
  width: 100%;
  background: none;
  border: none;
  font: inherit;
  font-size: 14px;
  color: var(--stg-blue);
  text-align: center;
  padding: 12px 0;
  cursor: pointer;
  text-decoration: none;
}
.stg-link-btn:active { opacity: 0.5; }

/* ---- 积分页 ---- */
.stg-balance-card {
  background: var(--stg-card);
  border-radius: 16px;
  padding: 28px 20px 22px;
  text-align: center;
  margin-bottom: 14px;
}
.stg-balance-num {
  font-size: 42px;
  font-weight: 700;
  color: var(--stg-text);
  letter-spacing: -0.5px;
  line-height: 1.1;
}
.stg-balance-label { font-size: 13px; color: var(--stg-text-2); margin-top: 6px; }
.stg-balance-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  margin-top: 18px;
}
.stg-btn-primary {
  padding: 9px 26px;
  border: none;
  border-radius: 20px;
  background: var(--accent, #00a884);
  color: var(--accent-text, #ffffff);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}
.stg-btn-primary:active { opacity: 0.8; }
.stg-btn-plain {
  padding: 9px 22px;
  border: 1px solid var(--stg-sep);
  border-radius: 20px;
  background: none;
  color: var(--stg-blue);
  font-size: 14px;
  cursor: pointer;
}
.stg-btn-plain:active { opacity: 0.6; }
.stg-tip-card {
  background: var(--stg-card);
  border-radius: 16px;
  padding: 14px 16px;
  margin-bottom: 20px;
}
.stg-tip-card p { font-size: 12px; color: var(--stg-text-2); line-height: 1.7; margin: 0; }

/* 积分明细行 */
.stg-tx-row { gap: 12px; }
.stg-tx-icon {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  flex-shrink: 0;
}
.stg-tx-icon.in { background: rgba(52, 199, 89, 0.14); color: var(--stg-green); }
.stg-tx-icon.out { background: rgba(255, 69, 58, 0.12); color: var(--stg-red); }
.stg-tx-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.stg-tx-title {
  font-size: 14px;
  color: var(--stg-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.stg-tx-time { font-size: 12px; color: var(--stg-text-2); }
.stg-tx-amount { font-size: 15px; font-weight: 600; flex-shrink: 0; }
.stg-tx-amount.in { color: var(--stg-green); }
.stg-tx-amount.out { color: var(--stg-red); }

/* ---- 通知中心 ---- */
.stg-note-row {
  position: relative;
  display: flex;
  gap: 14px;
  padding: 14px 16px;
}
.stg-note-date {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--stg-text-2);
  width: 74px;
  padding-top: 2px;
}
.stg-note-body { min-width: 0; }
.stg-note-title { font-size: 15px; font-weight: 600; color: var(--stg-text); }
.stg-note-desc { font-size: 13px; color: var(--stg-text-2); margin-top: 4px; line-height: 1.5; }

/* ---- 隐私与政策 ---- */
.stg-legal-card {
  background: var(--stg-card);
  border-radius: 16px;
  padding: 20px 18px;
  margin-bottom: 16px;
}
.stg-legal-card h3 { font-size: 16px; font-weight: 700; color: var(--stg-text); margin: 0 0 4px; }
.stg-legal-update { font-size: 11px; color: var(--stg-text-2); margin: 0 0 12px; }
.stg-legal-card h4 { font-size: 13px; font-weight: 600; color: var(--stg-text); margin: 14px 0 4px; }
.stg-legal-card p { font-size: 13px; color: var(--stg-text-2); line-height: 1.75; margin: 0; }

/* ---- 帮助中心：操作指南入口 ---- */
.stg-guide-card {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--stg-card);
  border: 1px solid rgba(0, 122, 255, 0.22);
  border-radius: 14px;
  padding: 14px 16px;
  margin-bottom: 16px;
  cursor: pointer;
  transition: border-color .18s, box-shadow .18s;
}
.stg-guide-card:hover {
  border-color: var(--stg-blue);
  box-shadow: 0 2px 10px rgba(0, 122, 255, 0.10);
}
.stg-guide-ic {
  flex: 0 0 42px;
  height: 42px;
  border-radius: 12px;
  background: rgba(0, 122, 255, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
}
.stg-guide-body { flex: 1; min-width: 0; }
.stg-guide-title { font-size: 15px; font-weight: 700; color: var(--stg-text); }
.stg-guide-desc { font-size: 12px; color: var(--stg-text-2); margin-top: 3px; line-height: 1.55; }
.stg-guide-arrow { color: var(--stg-chevron); flex-shrink: 0; display: flex; }
.stg-guide-card:active .stg-guide-arrow { transform: translateX(2px); }

/* ---- 帮助中心 ---- */
.stg-help-hero { padding: 8px 4px 18px; }
.stg-help-hi { font-size: 24px; font-weight: 700; color: var(--stg-text); }
.stg-help-sub { font-size: 14px; color: var(--stg-text-2); margin-top: 6px; }
.stg-faq-q { min-height: 48px; }
.stg-faq-arrow {
  color: var(--stg-chevron);
  display: flex;
  align-items: center;
  transition: transform 0.2s;
  flex-shrink: 0;
}
.stg-faq-arrow.open { transform: rotate(180deg); }
.stg-faq-a {
  padding: 0 16px 14px;
  font-size: 13px;
  color: var(--stg-text-2);
  line-height: 1.7;
}

/* ---- 关于 ---- */
.stg-about-card {
  background: var(--stg-card);
  border-radius: 16px;
  padding: 32px 20px 24px;
  text-align: center;
  margin-bottom: 16px;
}
.stg-about-logo {
  width: 72px;
  height: 72px;
  border-radius: 18px;
  object-fit: cover;
  margin-bottom: 14px;
  background: var(--stg-sep);
}
.stg-about-name { font-size: 17px; font-weight: 600; color: var(--stg-text); }
.stg-about-version { font-size: 13px; color: var(--stg-text-2); margin-top: 4px; }
.stg-about-latest {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: var(--stg-green);
  margin-top: 14px;
  padding: 5px 12px;
  border-radius: 12px;
  background: rgba(52, 199, 89, 0.12);
}
.stg-about-copy { text-align: center; font-size: 12px; color: var(--stg-text-2); margin-top: 8px; }

/* ---- 高级设置二级页：沿用原有面板样式，套一层卡片 ---- */
.adv-page .settings-section {
  background: var(--bg-card, var(--stg-card));
  border-radius: 16px;
  padding: 18px 16px;
  margin-bottom: 20px;
  color: var(--text-primary, var(--stg-text));
}
.adv-page .settings-section h2 { margin-top: 0; }

/* 移动端微调 */
@media (max-width: 480px) {
  .stg-body { padding: 16px 12px 100px; }
  .stg-balance-num { font-size: 38px; }
}
/* ==================================================================
   桌面双栏布局（≥992px）：左侧菜单栏 + 右侧内容区（参考扣子设置页）
   ================================================================== */
@media (max-width: 991.98px) {
  /* 移动端：右栏包装器不参与布局，保持原有单栏样式完全不变 */
  .stg-main { display: contents; }
}
@media (min-width: 992px) {
  /* 桌面端非钻取导航：隐藏移动端顶栏（含返回按钮）与单栏菜单 */
  .stg-header { display: none; }
  .stg-menu { display: none !important; }
  .stg-body {
    display: flex;
    align-items: stretch;
    gap: 26px;
    padding: 22px 30px 22px 26px;
    overflow: hidden;
  }

  /* ---- 左侧栏（独立滚动） ---- */
  .stg-side {
    width: 250px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    padding: 14px 12px 12px;
    background: var(--panel-bg);
    border: 1px solid var(--border-color, rgba(134,150,160,.15));
    border-radius: 14px;
  }
  .stg-side-head { display: flex; align-items: center; gap: 4px; padding: 4px 2px 14px; }
  .stg-side-back {
    background: none; border: none; color: var(--stg-text-2); cursor: pointer;
    width: 30px; height: 30px; border-radius: 8px; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
  }
  .stg-side-back:hover { background: var(--stg-hover); color: var(--stg-text); }
  .stg-side-title { font-size: 21px; font-weight: 700; color: var(--stg-text); }
  .stg-side-user {
    display: flex; align-items: center; gap: 10px;
    background: var(--stg-card); border-radius: 12px;
    padding: 10px 12px; margin-bottom: 16px;
  }
  .stg-side-avatar { width: 38px; height: 38px; font-size: 16px; }
  .stg-side-username {
    font-size: 14px; font-weight: 600; color: var(--stg-text);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .stg-side-usersub { font-size: 12px; color: var(--stg-text-2); margin-top: 2px; }
  .stg-side-nav { display: flex; flex-direction: column; gap: 2px; }
  .stg-side-item {
    display: flex; align-items: center; gap: 10px;
    width: 100%; min-height: 38px; padding: 6px 10px;
    background: none; border: none; border-radius: 10px;
    font: inherit; text-align: left; cursor: pointer; color: var(--stg-text);
  }
  .stg-side-item:hover { background: var(--stg-hover); }
  .stg-side-item.active { background: var(--stg-active); box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08); }
  .stg-side-item .stg-icon { width: 26px; height: 26px; font-size: 15px; border-radius: 7px; }
  .stg-side-item-title {
    flex: 1; font-size: 14px; color: var(--stg-text); min-width: 0;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .stg-side-item.active .stg-side-item-title { font-weight: 600; }
  .stg-side-item-value {
    font-size: 12px; color: var(--stg-text-2); flex-shrink: 0; max-width: 76px;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .stg-side-label { font-size: 12px; color: var(--stg-text-2); margin: 16px 0 6px 10px; }
  .stg-side-foot { margin-top: 20px; padding-top: 12px; border-top: 0.5px solid var(--stg-sep); }
  .stg-side-logout .stg-logout-text { font-size: 14px; }
  .stg-side .stg-footnote { text-align: left; padding: 6px 10px 0; margin-top: 2px; }

  /* ---- 右侧内容区（独立滚动） ---- */
  .stg-main {
    flex: 1;
    min-width: 0;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    padding: 6px 8px 80px 2px;
  }
  .stg-pane-title {
    font-size: 22px;
    font-weight: 700;
    color: var(--stg-text);
    margin: 0 0 18px 2px;
    max-width: 920px;
  }
}
</style>
