<template>
  <div class="crm-layout" :class="{ 'platform-collapsed': platformCollapsed, 'mobile-view': isMobile }">
    <!-- ① 平台导航栏 -->
    <aside class="platform-nav">
      <div class="platform-nav-top">
        <div class="platform-logo-row">
        <div class="logo-wrap" @click="goHome">
          <img src="/tc-logo.png" class="logo-icon" alt="TradeAgent" />
          <transition name="fade">
            <span v-if="!platformCollapsed" class="logo-text">TradeAgent</span>
          </transition>
        </div>
        </div>
        <nav class="platform-menu">
          <template v-for="item in platformItems" :key="item.key">
            <div class="platform-item-wrap">
            <div
              class="platform-item"
              :class="{ active: isParentActive(item), 'has-children': item.children && !platformCollapsed }"
              @click="item.children && !isPlatformActive(item.key) ? toggleExpand(item.key) : switchPlatform(item)"
            >
              <span class="p-icon" v-html="item.icon"></span>
              <transition name="fade">
                <span v-if="!platformCollapsed" class="p-label">{{ item.label }}</span>
              </transition>
              <span v-if="item.badge && !platformCollapsed" class="p-badge">{{ item.badge }}</span>
              <svg v-if="item.children && !platformCollapsed" class="p-arrow" :class="{ open: expandedKeys[item.key] }" viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z"/></svg>
              <div v-if="platformCollapsed && !(item.children && expandedKeys[item.key])" class="p-tooltip">{{ item.label }}</div>
            </div>
            <transition name="slide-down">
              <div v-if="item.children && expandedKeys[item.key]" class="platform-children">
                <div
                  v-for="child in item.children"
                  :key="child.key"
                  class="platform-child"
                  :class="{ active: isChildActive(child) }"
                  @click.stop="onChildClick(child)"
                >
                  <span class="p-child-icon">{{ child.icon }}</span>
                  <span class="p-child-label">{{ child.label }}</span>
                </div>
              </div>
            </transition>
            </div>
          </template>
        </nav>
      </div>

      <div class="platform-nav-bottom">
        <button class="p-setting" @click="goSettings()">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
            <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94 0 .31.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
          </svg>
          <transition name="fade">
            <span v-if="!platformCollapsed">设置</span>
          </transition>
          <div v-if="platformCollapsed" class="p-tooltip">设置</div>
        </button>
        <button class="p-setting ta-nav-wx-btn" @click="openWxQr" title="微信直连外贸Agent">
          <span class="p-icon" style="color:#07c160;font-size:20px;line-height:1;">💬</span>
          <transition name="fade">
            <span v-if="!platformCollapsed" style="color:#07c160;font-weight:600;">微信直连</span>
          </transition>
          <div v-if="platformCollapsed" class="p-tooltip">微信直连</div>
        </button>
        <div class="p-feedback-wrap">
          <button class="p-setting p-feedback-btn" @click="feedbackOpen = !feedbackOpen" :title="feedbackOpen ? '收起反馈' : '反馈建议'">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
            <transition name="fade">
              <span v-if="!platformCollapsed">反馈建议</span>
            </transition>
            <svg v-if="!platformCollapsed" class="p-feedback-arrow" :class="{ open: feedbackOpen }" viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z"/></svg>
            <div v-if="platformCollapsed" class="p-tooltip">反馈建议</div>
          </button>
          <div v-if="feedbackOpen" class="p-feedback-menu">
            <a class="p-feedback-item" href="https://bbs.tradecloserai.com/circle/bug-report" target="_blank" rel="noopener"><span class="p-feedback-item-icon">🐛</span>Bug反馈</a>
            <a class="p-feedback-item" href="https://bbs.tradecloserai.com/circle/feedback" target="_blank" rel="noopener"><span class="p-feedback-item-icon">💡</span>需求建议</a>
          </div>
        </div>
        <button class="p-collapse-bottom" @click="togglePlatform" :title="platformCollapsed ? '展开侧边栏' : '收起侧栏'">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
            <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>
          </svg>
          <transition name="fade">
            <span v-if="!platformCollapsed">收起侧栏</span>
          </transition>
          <div v-if="platformCollapsed" class="p-tooltip">展开侧边栏</div>
        </button>
      </div>
    </aside>

    <!-- 移动端栏目抽屉（☰ 打开） -->
    <div class="mobile-drawer" v-if="isMobile && mobileDrawerOpen" @click.self="mobileDrawerOpen = false">
      <div class="mobile-drawer-panel">
        <div class="mdp-header">
          <div class="mdp-logo" style="cursor:pointer" @click="goHome()"><img src="/tc-logo.png" class="mdp-logo-img" alt="TradeAgent" /> TradeAgent</div>
          <button class="mdp-close" @click="mobileDrawerOpen = false">✕</button>
        </div>
        <div class="mdp-wa-status" :class="chatStore.connectionStatus">
          <span class="mdp-status-dot"></span>
          <span>{{ chatStore.connectionStatus === 'connected' ? 'WhatsApp 已连接' : 'WhatsApp 未连接' }}</span>
        </div>
        <nav class="mdp-nav">
          <template v-for="item in mobileDrawerItems" :key="item.key">
            <button
              class="mdp-item"
              :class="{ active: isDrawerActive(item.key) }"
              @click="item.key === 'trade-agent' ? goHome() : (item.children ? (expandedKeys[item.key] = expandedKeys[item.key] === false ? true : false) : onDrawerItemClick(item))"
            >
              <span class="mdp-icon" v-html="item.icon"></span>
              <span class="mdp-label">{{ item.label }}</span>
              <span v-if="item.badge" class="mdp-badge">{{ item.badge }}</span>
              <svg v-if="item.children" class="mdp-arrow" :class="{ open: expandedKeys[item.key] !== false }" @click.stop="expandedKeys[item.key] = expandedKeys[item.key] === false ? true : false" viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style="cursor:pointer;padding:4px"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z"/></svg>
            </button>
            <div v-if="item.children && expandedKeys[item.key] !== false" class="mdp-children">
              <button
                v-for="child in item.children"
                :key="child.key"
                class="mdp-item mdp-child"
                :class="{ active: isDrawerActive(child.key) }"
                @click="onDrawerItemClick(child)"
              >
                <span class="mdp-icon">{{ child.icon }}</span>
                <span class="mdp-label">{{ child.label }}</span>
              </button>
            </div>
          </template>
        </nav>
        <div class="mdp-footer">
          <button class="mdp-item" @click="goSettings(); mobileDrawerOpen = false">
            <span class="mdp-icon">⚙️</span>
            <span class="mdp-label">设置</span>
          </button>
          <button class="mdp-item ta-nav-wx-btn" @click="openWxQr; mobileDrawerOpen = false">
            <span class="mdp-icon" style="color:#07c160;">💬</span>
            <span class="mdp-label" style="color:#07c160;font-weight:600;">微信直连</span>
          </button>
          <button class="mdp-item" @click="feedbackOpen = !feedbackOpen">
            <span class="mdp-icon">💬</span>
            <span class="mdp-label">反馈建议</span>
            <svg class="mdp-arrow" :class="{ open: feedbackOpen }" viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style="cursor:pointer;padding:4px"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z"/></svg>
          </button>
          <div v-if="feedbackOpen" class="mdp-children">
            <a class="mdp-item mdp-child" href="https://bbs.tradecloserai.com/circle/bug-report" target="_blank" rel="noopener" style="text-decoration:none;color:inherit">
              <span class="mdp-icon">🐛</span><span class="mdp-label">Bug反馈</span>
            </a>
            <a class="mdp-item mdp-child" href="https://bbs.tradecloserai.com/circle/feedback" target="_blank" rel="noopener" style="text-decoration:none;color:inherit">
              <span class="mdp-icon">💡</span><span class="mdp-label">需求建议</span>
            </a>
          </div>
        </div>
      </div>
    </div>

    <!-- 移动端遮罩（账号抽屉打开、进入对话、AI面板打开时显示） -->
    <div
      class="mobile-overlay"
      v-if="isMobile && (mobileAccountsOpen || mobilePanel)"
      @click="mobilePanel = null; mobileAccountsOpen = false; mhMenuOpen = null; tgMenuOpen = null;"
    ></div>

    <!-- 下拉菜单透明点击层（不黑屏，点外部关菜单） -->
    <div class="mh-menu-mask" v-if="isMobile && mhMenuOpen" @click="mhMenuOpen=null"></div>
    <!-- TG dropdown: no mask needed, items handle their own close; mask would block taps (z-index conflict) -->
    <div class="mh-menu-mask" v-if="isMobile && mobileFilterMenuOpen" @click="mobileFilterMenuOpen=false"></div>

    <!-- 渠道/账号切换 ActionSheet（手机端顶栏标题点击弹出） -->
    <transition name="sheet-fade">
      <div v-if="isMobile && channelSheetOpen" class="sheet-mask" @click="channelSheetOpen=false"></div>
    </transition>
    <transition name="sheet-up">
      <div v-if="isMobile && channelSheetOpen" class="action-sheet channel-sheet" @click.stop>
        <div class="action-sheet-title">切换渠道</div>
        <template v-for="ch in channels" :key="ch.id">
          <template v-if="ch.id==='whatsapp'">
            <button class="action-sheet-item asi-channel-header"
                    :class="{active: activeChannel===ch.id}"
                    @click="selectChannel(ch.id); channelSheetOpen=false">
              <span class="asi-icon asi-ch-icon" v-html="channelIcons[ch.id] || ch.icon"></span>
              <span class="asi-label">{{ ch.name }}</span>
              <span v-if="(chatStore.followupCounts?.firstResponse||0) > 0" class="asi-badge asi-badge-red">{{ chatStore.followupCounts.firstResponse }}</span>
              <span v-if="activeChannel===ch.id" class="asi-check">✓</span>
            </button>
          </template>
          <template v-else>
            <button class="action-sheet-item"
                    :class="{active: activeChannel===ch.id, 'asi-offline': ch.status==='offline'}"
                    @click="selectChannel(ch.id); channelSheetOpen=false">
              <span class="asi-icon asi-ch-icon" v-html="channelIcons[ch.id] || ch.icon"></span>
              <span class="asi-label">{{ ch.name }}</span>
              <span v-if="ch.id==='telegram' && tgUnreadTotal > 0" class="asi-badge" style="background:#2AABEE;">{{ tgUnreadTotal }}</span>
              <span v-else-if="ch.id==='email' && emailUnreadTotal > 0" class="asi-badge" style="background:#EA4335;">{{ emailUnreadTotal }}</span>
              <span v-if="ch.status==='offline'" class="asi-tag asi-tag-soon">即将上线</span>
              <span v-if="activeChannel===ch.id" class="asi-check">✓</span>
            </button>
          </template>
          <!-- WA多账号作为二级菜单紧跟WhatsApp按钮 -->
          <div class="as-sub-accounts as-sub-menu" v-if="ch.id==='whatsapp' && waAccounts.length > 1">
            <button class="action-sheet-item as-sub-item"
                    v-for="acc in waAccounts" :key="acc.id"
                    :class="{active: acc.id===currentWaAccountId}"
                    @click="switchWaAccount(acc.id); activeChannel='whatsapp'; channelSheetOpen=false">
              <span class="asi-icon">
                <span class="as-acc-avatar as-acc-fallback" :style="{background: acc.color}">{{ (acc.name||'?')[0] }}</span>
              </span>
              <span class="asi-label">{{ acc.name }}</span>
              <span v-if="acc.online" class="asi-tag asi-tag-online">在线</span>
              <span v-else class="asi-tag">离线</span>
              <span v-if="acc.id===currentWaAccountId && activeChannel==='whatsapp'" class="asi-check">✓</span>
            </button>
          </div>
          <div class="as-sub-accounts as-sub-menu" v-else-if="ch.id==='whatsapp'">
            <button class="action-sheet-item as-sub-item as-current-acc"
                    @click="selectChannel('whatsapp'); channelSheetOpen=false">
              <span class="as-cur-name">{{ chatStore.pushName || chatStore.connectedPhone || 'WhatsApp' }}</span>
              <span class="asi-tag asi-tag-online" v-if="chatStore.isConnected">在线</span>
              <span class="asi-tag" v-else>未连接</span>
            </button>
          </div>
        </template>

        <button class="action-sheet-item asi-cancel" @click="channelSheetOpen=false">取消</button>
      </div>
    </transition>


    <!-- 移动端顶部栏 -->
    <!-- 移动端全局顶部栏 -->
    <header class="mobile-header" v-if="isMobile && !(activeChannel === 'telegram' && mobileInConv && tgActiveJid)">
      <!-- 聊天列表/其他平台：☰栏目 -->
      <button type="button" class="mh-btn" v-if="!mobileInConv" @click="mobileDrawerOpen = !mobileDrawerOpen" style="touch-action:manipulation;">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/></svg>
      </button>
      <!-- 对话内：返回（邮箱渠道按层级返回） -->
      <button type="button" class="mh-btn" v-else @click="handleMobileBackConv" style="touch-action:manipulation;">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
      </button>
      <div class="mh-title"
           :class="{'mh-clickable': (mobileInConv && activeChannel==='whatsapp') || (!mobileInConv && activePlatform==='communication') || (!mobileInConv && activePlatform==='assistant') || (activePlatform==='trade-agent'), 'mh-title-list': !mobileInConv && activePlatform==='communication'}"
           @click="!mobileInConv && activePlatform==='assistant' ? (emitAssistantProfile = true) : onMhTitleClick()"
           style="touch-action:manipulation;">
        <!-- 列表视图 + 客户沟通页：显示渠道图标+名称+下拉箭头 -->
        <template v-if="!mobileInConv && activePlatform==='communication'">
          <span class="mh-ch-icon" v-html="channelIcons[activeChannel] || '💬'"></span>
          <div class="mh-name-row mh-name-row-list">
            <span class="mh-name-text">{{ mobileHeaderTitle }}</span>
            <span v-if="chatStore.activeJid && getBgRating(chatStore.activeJid)" class="mh-bg-rating" :style="{background: bgRatingColor(getBgRating(chatStore.activeJid))}" :title="'背调评级: ' + getBgRating(chatStore.activeJid)">{{ getBgRating(chatStore.activeJid) }}</span>
            <span v-if="chatStore.activeJid && getBantLevel(chatStore.activeJid)" class="mh-bant-level" :class="'bant-' + getBantLevel(chatStore.activeJid).toLowerCase()" @click="openBantDetail(chatStore.activeJid)" :title="'BANT: ' + getBantLevel(chatStore.activeJid) + ' · ' + (bantScoreMap[chatStore.activeJid]?.totalScore || '')">{{ getBantLevel(chatStore.activeJid) }} · {{ bantScoreMap[chatStore.activeJid]?.totalScore }}</span>
            <svg class="mh-ch-caret" viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M7 10l5 5 5-5z"/></svg>

          </div>
        </template>
        <!-- 列表视图 + 非沟通页：只显示页面标题 -->
        <template v-else-if="!mobileInConv">
          <span class="mh-name-text">{{ mobileHeaderTitle }}</span>
          <svg v-if="activePlatform==='assistant'" class="mh-ch-arrow" viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z"/></svg>
        </template>
        <!-- 对话视图：头像+名字 -->
        <template v-else>
          <div v-if="activeChannel==='whatsapp' && chatStore.activeConversation" class="mh-avatar" :style="{background: avatarColor(chatStore.activeConversation.name || chatStore.activeConversation.jid)}">
            <img v-if="!(chatStore.activeConversation.jid && chatStore.activeConversation.jid.includes('@g.us')) && chatStore.loadAvatar(chatStore.activeConversation.jid) && !mhAvatarFailed" :src="chatStore.loadAvatar(chatStore.activeConversation.jid)" @error="mhAvatarFailed=true" alt=""/>
            <span v-else-if="chatStore.activeConversation.jid && chatStore.activeConversation.jid.includes('@g.us')" style="font-size:14px;font-weight:700">群</span>
            <span v-else>{{ (chatStore.activeConversation.name || '?')[0] }}</span>
          </div>
          <div v-else-if="activeChannel==='telegram' && tgActiveJid" class="mh-avatar" :style="!tgHeaderAvatar ? {background:'#2AABEE'} : {}">
            <img v-if="tgHeaderAvatar && !tgHeaderAvatarFailed" :src="tgHeaderAvatar" @error="tgHeaderAvatarFailed=true" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;"/>
            <span v-else style="font-size:18px;">{{ (tgActiveConv?.name?.[0] || '?') }}</span>
          </div>
          <div v-else-if="activeChannel==='email'" class="mh-avatar" style="background:#EA4335;">
            <span style="font-size:18px;">✉️</span>
          </div>
          <div class="mh-name-row">
            <span class="mh-name-text">{{ mobileHeaderTitle }}</span>
            <span v-if="cultureIso && cultureInfo && (activeChannel==='whatsapp' || activeChannel==='telegram')" style="font-size:11px;color:var(--text-secondary,#8696a0);font-variant-numeric:tabular-nums;white-space:nowrap;padding:0;margin:0;" @click.stop="switchPanel('worldclock')">{{ cultureInfo.name }} {{ cultureWorkStatus.localTime }}</span>
            <span v-else-if="activeChannel==='telegram' && !cultureIso && chatStore.activeConversation && chatStore.activeConversation.platform === 'telegram' && !chatStore.activeConversation.contactPhone" class="mh-cul-badge mh-cul-set-hint" @click.stop="switchPanel('worldclock')">
              🌐 设置国家
            </span>
          </div>
        </template>
      </div>
      <div class="mh-right" v-if="mobileInConv && activePlatform === 'communication' && activeChannel === 'whatsapp'">
        <div class="mh-menu-wrap" v-for="g in MH_GROUPS" :key="g.key">
          <button type="button" class="mh-btn mh-group-btn" :class="{active: mhMenuOpen===g.key || g.items.some(i=>i.key===mobilePanel)}" @click.stop="toggleMhMenu(g.key)" :title="g.label" :aria-label="g.label" style="touch-action:manipulation;">
            <span class="mh-g-icon">{{ g.icon }}</span><span class="mh-g-caret" :class="{open: mhMenuOpen===g.key}">▾</span>
          </button>
          <div class="mh-dropdown" v-if="mhMenuOpen===g.key" @click.stop>
            <div class="mh-dd-item" v-for="it in g.items" :key="it.key" :class="{active: mobilePanel===it.key}" @click="mhMenuOpen=null; openMobilePanel(it.key)">
              <span class="mh-dd-icon">{{ it.icon }}</span>
              <span class="mh-dd-label">{{ it.label }}</span>
              <span class="mh-dd-check" v-if="mobilePanel===it.key">✓</span>
            </div>
          </div>
        </div>
      </div>
    </header>

    <!-- 工作区 -->
    <div class="workspace" :class="{ 'has-mheader': isMobile, 'has-tabbar': isMobile, 'full-page': isMobile && activePlatform !== 'communication' }">
      <!-- 沟通模块 -->

    <!-- 外贸Agent模块：三栏聊天界面 -->
    <div v-if="activePlatform === 'trade-agent'" class="trade-agent-module">
      <!-- 中间：聊天区 -->
      <div class="ta-chat-main">
        <!-- 聊天头部 -->
        <div class="ta-chat-header">
          <div class="ta-header-avatar"><span>{{ currentAgentObj?.icon || '🤖' }}</span></div>
          <div class="ta-header-info">
            <div class="ta-header-name">{{ currentAgentObj?.label || '外贸销冠' }}</div>
            <div class="ta-header-status">在线</div>
          </div>
          <!-- V1.0 客户绑定（工厂/货代不走客户会话，隐藏） -->
          <div class="ta-header-cust" v-if="!['doc-agent','freight-agent'].includes(currentTradeAgent)">
            <template v-if="selectedCustomer">
              <span class="ta-cust-tag" @click="customerPickerOpen = true" title="切换客户">👤 {{ selectedCustomer.name || selectedCustomer.companyName || selectedCustomer.company || ('客户#'+selectedCustomer.id) }}</span>
              <span class="ta-cust-clear" @click.stop="clearCustomer()" title="解除绑定，回到通用对话">✕</span>
            </template>
            <button v-else class="ta-cust-btn" @click="customerPickerOpen = true" title="绑定客户，对话将带客户上下文">👤 客户</button>
            <button class="ta-cust-btn ta-wx-link-btn" @click="openWxQr" title="微信直连外贸Agent">💬 微信直连</button>
          </div>
        </div>

        <!-- 消息区 -->
        <div class="ta-chat-messages" ref="chatMessagesEl">
          <template v-if="agentMessages.length === 0">
            <div class="ta-welcome">
              <div class="ta-welcome-icon">{{ currentAgentObj?.icon || '🤖' }}</div>
              <h2>{{ currentAgentObj?.label || '外贸销冠' }}</h2>
              <p>{{ currentAgentObj?.desc || 'AI赋能外贸全流程' }}</p>
              <div v-if="!['doc-agent','freight-agent'].includes(currentTradeAgent)" class="ta-wx-entry" @click="openWxQr">
                <div class="ta-wx-entry-icon">💬</div>
                <div class="ta-wx-entry-txt">
                  <div class="ta-wx-entry-title">加微信好友，随时随地找外贸Agent</div>
                  <div class="ta-wx-entry-sub">扫码添加「外贸Agent」微信，微信上也能做单证、跟客户</div>
                </div>
                <div class="ta-wx-entry-btn">扫码连接</div>
              </div>
              <div class="ta-quick-prompts">
                <button v-for="p in currentQuickPrompts" :key="p" @click="agentInput=p; sendAgentMessage()">{{ p }}</button>
              </div>
            </div>
          </template>
          <div v-else v-for="(msg, i) in agentMessages" :key="i" class="ta-message" :class="msg.role">
            <div v-if="msg.role === 'ai' || msg.role === 'assistant'" class="ta-msg-avatar"><span>{{ currentAgentObj?.icon || '🤖' }}</span></div>
            <div class="ta-msg-bubble" :class="[msg.role, { 'ta-img-only': isImageOnlyMsg(msg) }]" v-html="renderMsgContent(msg)"></div>
            <div v-if="msg.role === 'user'" class="ta-msg-avatar user-avatar"><span>👤</span></div>
          </div>
          <!-- Agent 执行过程可视化：步骤流 + 思考中 -->
          <div v-if="agentSending" class="ta-loading-block">
            <div class="ta-loading-row"><span class="ta-loading-dot"></span><span class="ta-loading-dot"></span><span class="ta-loading-dot"></span> <span class="ta-loading-txt">销冠 Agent 处理中…</span></div>
            <div v-if="agentSteps.length" class="ta-steps">
              <div v-for="(st, si) in agentSteps" :key="si" class="ta-step-item">
                <span class="ta-step-ico">{{ st.done ? '✅' : (si < agentSteps.length - 1 ? '✓' : '⏳') }}</span>
                <span class="ta-step-txt">{{ st.detail }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 胶囊快捷指令（输入框上方常驻） -->
        <div class="ta-capsule-bar" v-if="quickCapsules.length">
          <button v-for="(cap, i) in quickCapsules" :key="i" class="ta-capsule-btn" @click="agentInput=cap; sendAgentMessage()" :title="cap">{{ cap }}</button>
        </div>

        <!-- 底部输入区 -->
        <div class="ta-input-area">
          <div class="ta-input-row">
            <!-- 附件预览条：在输入框内部顶部，元宝风格 -->
            <div v-if="pendingFiles.length" class="ta-attach-bar">
              <div v-for="(f, i) in pendingFiles" :key="i" class="ta-attach-chip">
                <img v-if="f.type === 'image'" :src="f.content" class="ta-attach-thumb" />
                <span v-else class="ta-attach-fileicon"></span>
                <span v-if="f.type !== 'image'" class="ta-attach-filename">{{ f.name }}</span>
                <button class="ta-attach-remove" @click="removePendingFile(i)" title="移除">×</button>
              </div>
            </div>
            <div class="ta-input-inner">
              <textarea v-model="agentInput" class="ta-input-textarea"
                        :placeholder="isMobile ? '跟我说说你的需求' : '跟我说说你的需求，我来帮你处理'"
                        @keydown.enter.exact.prevent="sendAgentMessage"
                        rows="1" ref="agentTextarea"></textarea>
              <div class="ta-input-actions">
              <button class="ta-model-btn" @click.stop="showModelSelector = !showModelSelector">
                {{ selectedModel }} <span class="ta-chevron">▾</span>
              </button>
              <button class="ta-file-btn" @click.stop="toggleFilePanel()" title="文件面板">📁</button>
              <button class="ta-mic-btn" title="语音输入">🎙️</button>
              <button class="ta-input-plus" @click.stop="showAttachMenu = !showAttachMenu" title="上传附件">+</button>
              <button class="ta-send-btn" @click="sendAgentMessage" :disabled="!canSend" title="发送">↑</button>
              </div>
            </div>
          </div>
          <!-- 附件菜单 -->
          <div v-if="showAttachMenu" class="ta-attach-menu">
            <button @click="triggerFileUpload">📄 上传文件</button>
            <button @click="triggerImageUpload">🖼️ 上传图片</button>
          </div>
          <input type="file" ref="fileInput" style="display:none" multiple @change="handleFileUpload" />
          <!-- 模型选择弹窗 -->
          <div v-if="showModelSelector" class="ta-model-overlay">
            <div class="ta-model-backdrop" @click="showModelSelector = false"></div>
            <div class="ta-model-popup">
              <!-- 智能选择开关 -->
              <div class="ta-model-auto-row">
                <div class="ta-model-auto-info">
                  <span class="ta-model-auto-icon">⚡</span>
                  <div>
                    <div class="ta-model-auto-title">智能选择</div>
                    <div class="ta-model-auto-desc">不用自己选，系统帮你挑最合适的</div>
                  </div>
                </div>
                <button class="ta-model-toggle" :class="{on: selectedAutoMode}" @click.stop="toggleAutoMode">
                  <span class="ta-model-toggle-knob"></span>
                </button>
              </div>


              <div class="ta-model-list">
                <div v-for="m in filteredModels" :key="m.model || m.name"
                     class="ta-model-item" :class="{active: selectedModel === m.name}"
                     @click="selectModel(m.name)">
                  <span class="ta-model-icon">{{ m.icon }}</span>
                  <div class="ta-model-item-content">
                    <div class="ta-model-item-header">
                      <span class="ta-model-name">{{ m.name }}</span>
                      <span v-if="m.tag" class="ta-model-tag" :class="m.tagType">{{ m.tag }}</span>
                      <span v-if="selectedModel === m.name" class="ta-model-check">✓</span>
                    </div>
                    <span class="ta-model-desc">{{ m.desc }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 右栏：企业微信设置面板 -->
      <aside class="ta-wecom-panel" :class="{open: wecomPanelOpen}">
        <div class="ta-wecom-header">
          <span>🏢 企业微信设置</span>
          <button class="ta-wecom-close" @click="wecomPanelOpen = false">✕</button>
        </div>
        <div class="ta-wecom-body">
          <template v-if="wecomConfigured">
            <div class="ta-wecom-status ok">
              <span class="ta-wecom-status-dot"></span>已接入企业微信
            </div>
            <div class="ta-wecom-meta" v-if="wecomConfig">
              <div class="ta-wecom-meta-row" v-if="wecomConfig.corpId"><span>CorpID</span><span class="mono">{{ wecomConfig.corpId }}</span></div>
              <div class="ta-wecom-meta-row" v-if="wecomConfig.contactCount"><span>已同步联系人</span><span>{{ wecomConfig.contactCount }}</span></div>
            </div>
            <button class="ta-wecom-btn primary" @click="syncWecomContacts" :disabled="syncing">{{ syncing ? '同步中...' : '🔄 同步企微联系人' }}</button>
          </template>
          <div class="ta-wecom-form">
            <p class="ta-wecom-hint">在企业微信管理后台获取：<br>CorpID：我的企业 → 企业信息 → 企业ID<br>CorpSecret：应用管理 → 自建应用 → Secret</p>
            <a href="https://work.weixin.qq.com" target="_blank" class="ta-wecom-link">打开企业微信管理后台 →</a> <a href="/help/wecom-binding.html" target="_blank" class="ta-wecom-link">查看绑定流程操作说明 →</a>
            <div class="ta-wecom-field"><label>CorpID (企业ID) *</label><input v-model="wecomForm.corpId" placeholder="企业ID" /></div>
            <div class="ta-wecom-field"><label>CorpSecret (Secret) *</label><input v-model="wecomForm.corpSecret" type="password" :placeholder="wecomConfig?.corpSecret || '输入新的Secret'" /></div>
            <div class="ta-wecom-field"><label>AgentID (应用ID，可选)</label><input v-model="wecomForm.agentId" placeholder="应用ID" /></div>
            <div v-if="testResult" class="ta-wecom-test" :class="testResult.success ? 'ok' : 'err'">{{ testResult.message }}</div>
            <div class="ta-wecom-actions">
              <button class="ta-wecom-btn" @click="testWecomConnection" :disabled="testing">{{ testing ? '测试中...' : '测试连接' }}</button>
              <button class="ta-wecom-btn primary" @click="saveWecomConfig">保存配置</button>
            </div>
          </div>
        </div>
      </aside>

      <!-- 右栏：文件面板 -->
      <aside class="ta-file-panel" :class="{open: filePanelOpen}">
        <div class="ta-file-panel-header">
          <span>{{ currentAgentObj?.label || '外贸Agent' }}的文件</span>
          <button class="ta-file-panel-close" @click="filePanelOpen = false">✕</button>
        </div>
        <div class="ta-file-panel-tabs">
          <button :class="{active: filePanelTab === 'files'}" @click="filePanelTab = 'files'">工作文件</button>
          <button :class="{active: filePanelTab === 'memory'}" @click="filePanelTab = 'memory'">记忆</button>
        </div>
        <div class="ta-file-panel-search">
          <input type="text" placeholder="搜索文件" />
        </div>
        <div class="ta-file-panel-content">
          <div v-if="filePanelTab === 'files'" class="ta-file-tree">
            <div class="ta-file-empty">
              <span style="font-size:32px;opacity:0.3"></span>
              <p>暂无文件</p>
              <p style="font-size:12px;opacity:0.5">点击底部 + 号上传文件</p>
            </div>
          </div>
          <div v-else class="ta-memory-list">
            <div class="ta-file-empty">
              <span style="font-size:32px;opacity:0.3"></span>
              <p>暂无记忆</p>
            </div>
          </div>
        </div>
        <div class="ta-file-panel-footer">当前文件已用 0 MB</div>
      </aside>

      <!-- V1.1 任务指派面板：右侧工作文件下方 -->
      <aside class="ta-task-panel" :class="{open: taskPanelOpen}">
        <div class="ta-task-panel-header">
          <span>📌 任务指派</span>
          <button class="ta-task-panel-close" @click="taskPanelOpen = false">✕</button>
        </div>
        <div class="ta-task-panel-body">
          <template v-if="currentAssignTask">
            <div class="ta-task-card">
              <div class="ta-task-card-name">跟进 {{ currentAssignTask.customer?.name || currentAssignTask.customer?.companyName || ('客户#'+currentAssignTask.customerId) }}</div>
              <div class="ta-task-card-status"><span class="ta-task-dot"></span>指派任务进行中</div>
              <div class="ta-task-card-label">指令</div>
              <div class="ta-task-card-instr">{{ currentAssignTask.instruction || '跟进该客户' }}</div>
              <button class="ta-task-terminate" @click="terminateTask(currentAssignTask)" title="终止该指派任务">终止任务</button>
            </div>
          </template>
          <template v-else>
            <div class="ta-task-empty">
              <span style="font-size:32px;opacity:0.3">📌</span>
              <p>暂无指派任务</p>
              <p style="font-size:12px;opacity:0.5">从客户沟通指派客户后在此查看</p>
            </div>
          </template>
        </div>
      </aside>

      <!-- 右栏图标：工作文件 + 企业微信（互斥面板） -->
      <aside class="ta-iconbar">
        <div class="ta-ib-items">
          <button class="ta-ib-item" :class="{active: filePanelOpen}" @click="toggleFilePanel()" title="工作文件">
            <span class="ta-ib-icon">📁</span>
            <span class="ta-ib-label">工作文件</span>
          </button>
          <button class="ta-ib-item" :class="{active: taskPanelOpen}" @click="toggleTaskPanel()" title="任务指派">
            <span class="ta-ib-icon">📌</span>
            <span class="ta-ib-label">任务指派</span>
          </button>
          <button v-if="['doc-agent','freight-agent'].includes(currentTradeAgent)" class="ta-ib-item" :class="{active: wecomPanelOpen}" @click="toggleWecomPanel()" title="企业微信设置">
            <span class="ta-ib-icon">🏢</span>
            <span class="ta-ib-label">企业微信</span>
          </button>
        </div>
      </aside>

      <!-- V1.0 客户选择面板 -->
      <div v-if="customerPickerOpen && !['doc-agent','freight-agent'].includes(currentTradeAgent)" class="ta-cust-overlay" @click.self="customerPickerOpen = false">
        <div class="ta-cust-panel">
          <div class="ta-cust-panel-header">
            <span>绑定客户</span>
            <button class="ta-cust-panel-close" @click="customerPickerOpen = false">✕</button>
          </div>
          <div class="ta-cust-search">
            <input v-model="customerSearch" placeholder="搜索客户名 / 电话 / 邮箱" @input="onCustomerSearch" />
          </div>
          <div class="ta-cust-general" :class="{active: !selectedCustomer}" @click="selectGeneralChat()">
            <span class="ta-cust-general-icon">🗂️</span>
            <span class="ta-cust-general-label">通用对话</span>
            <span class="ta-cust-check" v-if="!selectedCustomer">✓</span>
          </div>
          <template v-if="agentTasks.length">
            <div class="ta-cust-group-title" style="color:#f59e0b;">📌 指派任务</div>
            <div class="ta-cust-list">
              <div v-for="task in agentTasks" :key="'task-'+task.id"
                   class="ta-cust-item task-item" :class="{active: selectedCustomer && selectedCustomer.id === task.customerId}"
                   @click="selectTaskCustomer(task)">
                <div class="ta-cust-item-avatar" style="background:rgba(245,158,11,.15);color:#f59e0b;">📌</div>
                <div class="ta-cust-item-info">
                  <div class="ta-cust-item-name">{{ task.customer?.name || task.customer?.companyName || ('客户#'+task.customerId) }}</div>
                  <div class="ta-cust-item-meta" style="color:#f59e0b;">{{ task.instruction || '跟进该客户' }}</div>
                </div>
                <span v-if="selectedCustomer && selectedCustomer.id === task.customerId" class="ta-cust-check">✓</span>
              </div>
            </div>
          </template>
          <div class="ta-cust-group-title">👤 客户会话</div>
          <div class="ta-cust-list">
            <div v-for="c in filteredCustomers" :key="c.id"
                 class="ta-cust-item" :class="{active: selectedCustomer && selectedCustomer.id === c.id}"
                 @click="selectCustomer(c)">
              <div class="ta-cust-item-avatar">{{ (c.name || c.companyName || c.company || '客')[0] }}</div>
              <div class="ta-cust-item-info">
                <div class="ta-cust-item-name">{{ c.name || c.companyName || c.company || ('客户#'+c.id) }}</div>
                <div class="ta-cust-item-meta">
                  {{ [c.companyName || c.company, c.country].filter(Boolean).join(' · ') }}
                  <span v-if="c.customerLevel" class="ta-cust-level">{{ c.customerLevel }}</span>
                </div>
              </div>
              <span v-if="selectedCustomer && selectedCustomer.id === c.id" class="ta-cust-check">✓</span>
            </div>
            <div v-if="filteredCustomers.length === 0" class="ta-cust-empty">没有匹配的客户</div>
          </div>
        </div>
      </div>


    </div>

    <div v-if="activePlatform === 'communication'" class="comm-module" :class="{ 'email-active': activeChannel === 'email', 'drawer-open': isMobile && mobileDrawerOpen, 'in-conv': isMobile && (mobileInConv || mobilePanel) }">
        <!-- 渠道图标切换条：v-for遍历channels，后期加渠道只需在channels数组+channelIcons加一项 -->
          <div class="ch-switch" v-if="activePlatform==='communication' && !mobileInConv && !mobilePanel && !isMobile">
            <button
              v-for="ch in channels"
              :key="ch.id"
              class="ch-sw-btn"
              :class="{active: activeChannel===ch.id, disabled: ch.status==='offline'}"
              @click="ch.status==='offline' ? $message.info(ch.name+' 渠道即将上线') : selectChannel(ch.id)"
              :title="ch.status==='offline' ? ch.name+'（即将上线）' : ch.name"
            >
              <span v-html="channelIcons[ch.id] || ch.icon"></span>
              <span v-if="ch.id==='whatsapp' && chatStore.followupCounts?.firstResponse > 0" class="ch-sw-badge ch-sw-warn">{{ chatStore.followupCounts.firstResponse }}</span>
              <span v-if="ch.id==='telegram' && tgUnreadTotal > 0" class="ch-sw-badge" style="background:#2AABEE;color:#fff;">{{ tgUnreadTotal }}</span>
              <span v-if="ch.id==='email' && emailUnreadTotal > 0" class="ch-sw-badge" style="background:#EA4335;color:#fff;">{{ emailUnreadTotal }}</span>
            </button>
          </div>

        <!-- ② 账号/渠道栏 -->
        <aside class="col-accounts" :class="{ collapsed: !isMobile && accountsCollapsed, 'm-open': isMobile && mobileAccountsOpen }">
          <div class="wa-col-header">
            <div class="wa-col-brand">
              <!-- WhatsApp -->
              <template v-if="activeChannel === 'whatsapp'">
                <svg viewBox="0 0 32 32" width="24" height="24" fill="#00a884"><path d="M16.003 3C9.385 3 4 8.384 4 15.002c0 2.416.719 4.669 1.956 6.542L4 27l5.567-1.874a11.94 11.94 0 006.436 1.878c6.617 0 12.002-5.384 12.002-12.001C28.005 8.384 22.62 3 16.003 3z"/></svg>
                <span class="wa-col-title" v-if="!accountsCollapsed">WhatsApp</span>
              </template>
              <!-- Telegram -->
              <template v-else-if="activeChannel === 'telegram'">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="#2AABEE"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.295-.6.295l.213-3.054 5.56-5.022c.24-.213-.054-.334-.373-.121l-6.869 4.326-2.96-.924c-.64-.203-.658-.64.135-.954l11.566-4.458c.538-.196 1.006.128.832.941z"/></svg>
                <span class="wa-col-title" v-if="!accountsCollapsed">Telegram</span>
              </template>
              <!-- Email -->
              <template v-else-if="activeChannel === 'email'">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="#EA4335"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>
                <span class="wa-col-title" v-if="!accountsCollapsed">邮箱</span>
              </template>
            </div>
            <button class="col-toggle" @click="accountsCollapsed = !accountsCollapsed" :title="accountsCollapsed ? '展开' : '收起'">
              <svg v-if="accountsCollapsed" viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
              <svg v-else viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
            </button>
          </div>

          <template v-if="!accountsCollapsed">
            <!-- 多WA账号列表 -->
            <div class="wa-account-list" v-if="activeChannel === 'whatsapp'">
              <!-- 绿色新建会话按钮（对标竞品） -->
              <div class="wa-new-session-btn" @click="onAddAccount">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
                <span>新建会话</span>
              </div>
              <!-- 各WA账号卡片 -->
              <div v-for="acc in waAccounts" :key="acc.id"
                   class="wa-account-item"
                   :class="{active: currentWaAccountId === acc.id}"
                   @click="onAccountCardClick(acc)">
                <div class="acc-top-row">
                  <div class="acc-avatar" :style="!acc.avatar ? {background: acc.color} : {}">
                    <img v-if="acc.avatar" class="acc-avatar-img" :src="acc.avatar" alt="" />
                    <span v-else class="acc-avatar-initial">{{ (acc.name||'?')[0] }}</span>
                    <span v-if="acc.online" class="acc-online-dot"></span>
                  </div>
                  <div class="acc-info">
                    <div class="acc-name">{{ acc.name }}</div>
                    <div v-if="acc._launching" style="color:#25D366;font-size:11px;margin-top:2px;">正在启动中...</div>
                    <div v-else class="acc-meta" :class="acc.online ? 'online-text' : 'offline-text'">
                      <template v-if="!acc.online"><span style="color:#ef4444;font-size:11px;">未连接</span> · </template>{{ acc.phone || acc.instanceName }}
                      <span v-if="acc.proxyIp" class="acc-proxy-tag"> · {{ acc.proxyIp }}</span>
                    </div>
                  </div>
                  <span v-if="currentWaAccountId === acc.id" class="acc-check">✓</span>
                </div>
                <!-- Hover actions：启动/配置/删除 -->
                <div class="acc-actions">
                  <button class="acc-action-btn" @click.stop="launchAccount(acc)" title="启动">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                  </button>
                  <button class="acc-action-btn" @click.stop="configureAccount(acc)" title="配置">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M4 8h4V4H4v4zm6 12h4v-4h-4v4zm-6 0h4v-4H4v4zm0-6h4v-4H4v4zm6 0h4v-4h-4v4zm6-10v4h4V4h-4zm-6 4h4V4h-4v4zm6 6h4v-4h-4v4zm0 6h4v-4h-4v4z"/></svg>
                  </button>
                  <button class="acc-action-btn acc-action-danger" @click.stop="deleteAccount(acc)" title="删除">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                  </button>
                </div>
              </div>
            </div>
            <div v-if="activeChannel === 'telegram'" class="wa-account-list">
              <!-- TG 新建会话按钮（对齐 WhatsApp）：未添加账号时点击进入登录欢迎页 -->
              <div class="wa-new-session-btn" @click="tgOpenNewSession">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
                <span>新建会话</span>
              </div>
              <template v-if="tgAccounts.length">
                <div v-for="tg in tgAccounts" :key="tg.id" class="wa-account-item active">
                  <div class="acc-top-row">
                    <div class="acc-avatar" style="background:#2AABEE;overflow:hidden;">
                      <img v-if="tg.avatarUrl" :src="tg.avatarUrl" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" @error="$event.target.style.display='none'" />
                      <img v-if="!tg.avatarUrl" src="/tg_avatar.jpg" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />
                      <span class="acc-online-dot"></span>
                    </div>
                    <div class="acc-info">
                      <div class="acc-name">{{ tg.pushName || tg.name || ('@'+tg.telegramBotUsername) }}</div>
                      <div v-if="tg._tgLaunching" style="color:#2AABEE;font-size:11px;margin-top:2px;">正在启动...</div>
                      <div v-else class="acc-meta online-text">在线</div>
                    </div>
                  </div>
                  <!-- Hover actions：启动/配置代理/删除（对齐 WhatsApp） -->
                  <div class="acc-actions">
                    <button class="acc-action-btn" @click.stop="tgLaunchAccount(tg)" title="启动">
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                    </button>
                    <button class="acc-action-btn" @click.stop="tgConfigureAccount(tg)" title="配置代理">
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M4 8h4V4H4v4zm6 12h4v-4h-4v4zm-6 0h4v-4H4v4zm0-6h4v-4H4v4zm6 0h4v-4h-4v4zm6-10v4h4V4h-4zm-6 4h4V4h-4v4zm6 6h4v-4h-4v4zm0 6h4v-4h-4v4z"/></svg>
                    </button>
                    <button class="acc-action-btn acc-action-danger" @click.stop="tgDeleteAccount(tg)" title="删除">
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                    </button>
                  </div>
                </div>
              </template>
              <div v-else-if="tgConnecting" class="wa-empty-card">
                <div class="wa-empty-avatar"><span style="font-size:22px;">✈️</span></div>
                <div class="wa-empty-info">
                  <div class="wa-empty-name">Telegram</div>
                  <div class="wa-empty-meta"><span class="status-text connecting">连接中...</span></div>
                </div>
              </div>
            </div>

            <!-- 邮箱账号区 -->
            <div v-if="activeChannel === 'email'" class="wa-account-list">
              <div class="wa-account-item active">
                <div class="acc-avatar" style="background:#EA4335;">
                  <span style="font-size:18px;">✉️</span>
                  <span class="acc-online-dot"></span>
                </div>
                <div class="acc-info">
                  <div class="acc-name">pm-jeremy@coze.email</div>
                  <div class="acc-meta online-text">在线</div>
                </div>
              </div>
            </div>

          </template>

          <!-- 折叠态：当前渠道显示头像，点击展开 -->
          <div class="channel-icons" v-else>
            <!-- WhatsApp -->
            <div v-if="activeChannel === 'whatsapp'" class="ch-avatar-btn active" @click="accountsCollapsed = false" title="点击展开" :style="{ width: '48px', borderRadius: '50%', height: waAccounts.length > 1 ? 'auto' : '48px', padding: waAccounts.length > 1 ? '4px 2px' : '0' }">
              <!-- 多账号堆叠头像 -->
              <div v-if="waAccounts.length > 1" class="ch-avatar-stack">
                <div v-for="(acc, idx) in waAccounts.slice(0, 3)" :key="acc.id"
                  class="ch-avatar ch-avatar-stacked" :style="{ background: acc.color, width: '44px', height: '44px', fontSize: '16px', border: '2px solid var(--sidebar-bg,#0b141a)' }">
                  <img v-if="acc.profilePicUrl" class="ch-avatar-img" :src="acc.profilePicUrl" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />
                  <span v-else class="ch-avatar-initial">{{ (acc.name || '?')[0] }}</span>
                </div>
                <span v-if="waAccounts.length > 3" class="ch-avatar-more" style="width:44px;height:44px;border-radius:50%;background:#555;color:#fff;font-size:14px;display:flex;align-items:center;justify-content:center;border:2px solid var(--sidebar-bg,#0b141a);">+{{ waAccounts.length - 3 }}</span>
              </div>
              <!-- 单账号 -->
              <div v-else class="ch-avatar" :style="!selfAvatarOk ? {background: selfAvatarBg} : {}">
                <img v-if="chatStore.selfAvatarUrl && selfAvatarOk" class="ch-avatar-img" :src="chatStore.selfAvatarUrl" @error="onSelfAvatarError" alt="" />
                <span v-else class="ch-avatar-initial">{{ selfInitial }}</span>
              </div>
              <div class="p-tooltip">{{ waAccounts.length > 1 ? waAccounts.map(a=>a.name).join(',') : (chatStore.pushName || 'WhatsApp') }}</div>
            </div>
            <!-- Telegram -->
            <div v-else-if="activeChannel === 'telegram'" class="ch-avatar-btn active" @click="accountsCollapsed = false" title="点击展开" style="background:#2AABEE;">
              <span style="font-size:20px;">✈️</span>
              <div class="p-tooltip">Telegram</div>
            </div>
            <!-- Email -->
            <div v-else-if="activeChannel === 'email'" class="ch-avatar-btn active" @click="accountsCollapsed = false" title="点击展开" style="background:#EA4335;">
              <span style="font-size:20px;">✉️</span>
              <div class="p-tooltip">邮箱</div>
            </div>
          </div>
        </aside>

        <!-- ④ 聊天列表栏 -->
        <aside class="col-chatlist" :class="{ 'm-hidden': isMobile && mobileInConv && (activeConv || tgActiveJid), 'wa-hidden': activeChannel === 'whatsapp' && (chatStore.currentWaAccountId === null || !chatStore.isConnected), 'tg-hidden': activeChannel === 'telegram' && tgAccounts.length === 0 && !tgConnecting }">
          <div class="col-header" v-if="activeChannel === 'telegram' && !isMobile">
            <div class="wa-col-brand">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="#2AABEE"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.295-.6.295l.213-3.054 5.56-5.022c.24-.213-.054-.334-.373-.121l-6.869 4.326-2.96-.924c-.64-.203-.658-.64.135-.954l11.566-4.458c.538-.196 1.006.128.832.941z"/></svg>
              <span class="wa-col-title">Telegram</span>
            </div>
          </div>
          <div class="col-header" v-if="activeChannel === 'whatsapp'">
            <div class="search-box">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
                <input type="text" v-model="searchKeyword" placeholder="搜索客户/消息..." @input="onSearchInput" />
                <span v-if="mobileFollowupTotal > 0" class="search-fu-badge" @click="toggleMobileFilter('followup')" title="待跟进">{{ mobileFollowupTotal }}</span>
              </div>
              <div class="col-header-actions">
                <button class="col-new-chat" @click="openNewChat" title="新建聊天" :disabled="!chatStore.isConnected">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-3 9h-4v4h-2v-4H7V9h4V5h2v4h4v2z"/></svg>
                </button>
                <button class="col-filter-btn" v-if="isMobile" @click.stop="mobileFilterMenuOpen = !mobileFilterMenuOpen" title="筛选">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
                  <span v-if="mobileListFilter !== 'all'" class="filter-active-dot"></span>
                </button>
              </div>
              <div class="mobile-filter-menu" v-if="isMobile && mobileFilterMenuOpen" @click.stop>
                <div class="mfm-item" :class="{active: mobileListFilter === 'all'}" @click="setMobileFilter('all'); mobileFilterMenuOpen=false">
                  <span class="mfm-icon">💬</span><span class="mfm-label">全部</span><span class="mfm-check" v-if="mobileListFilter==='all'">✓</span>
                </div>
                <div class="mfm-item" :class="{active: mobileListFilter === 'unread'}" @click="setMobileFilter('unread'); mobileFilterMenuOpen=false">
                  <span class="mfm-icon">🔵</span><span class="mfm-label">未读消息</span>
                  <span v-if="unreadCount > 0" class="mfm-badge">{{ unreadCount }}</span>
                  <span class="mfm-check" v-if="mobileListFilter==='unread'">✓</span>
                </div>
                <div class="mfm-item" :class="{active: mobileListFilter === 'starred'}" @click="setMobileFilter('starred'); mobileFilterMenuOpen=false">
                  <span class="mfm-icon">⭐</span><span class="mfm-label">特别关注</span><span class="mfm-check" v-if="mobileListFilter==='starred'">✓</span>
                </div>
                <div class="mfm-item mfm-divider" :class="{active: mobileListFilter === 'followup'}" @click="setMobileFilter('followup'); mobileFilterMenuOpen=false">
                  <span class="mfm-icon">📋</span><span class="mfm-label">待跟进客户</span>
                  <span v-if="mobileFollowupTotal > 0" class="mfm-badge mfm-badge-urgent">{{ mobileFollowupTotal }}</span>
                  <span class="mfm-check" v-if="mobileListFilter==='followup'">✓</span>
                </div>
                <div class="mfm-sub">
                  <span v-if="urgentCount > 0" class="mfm-sub-item" @click.stop="setMobileFilter('followup')">🔴 {{ urgentCount }} 立即回复</span>
                  <span v-if="followCount > 0" class="mfm-sub-item" @click.stop="setMobileFilter('followup')">🟡 {{ followCount }} 待跟进</span>
                  <span v-if="reactivateCount > 0" class="mfm-sub-item" @click.stop="setMobileFilter('followup')">🔵 {{ reactivateCount }} 待唤醒</span>
                </div>
              </div>
          </div>
          <!-- 会话分类筛选胶囊 tab（PC端保留） -->
          <div class="chat-filters" v-if="activeChannel === 'whatsapp' && !isMobile">
            <div class="filter-tabs">
              <button v-for="f in filters" :key="f.key"
                      class="filter-tab"
                      :class="{active: activeFilter === f.key}"
                      @click="onFilterClick(f.key)">
                <span v-if="f.icon" style="margin-right:3px">{{ f.icon }}</span>
                {{ f.label }}
                <span v-if="f.badge" class="filter-tab-badge">{{ f.badge }}</span>
              </button>
              <button class="filter-tab filter-tab-more" title="更多标签">⌄</button>
            </div>
          </div>
          <!-- ⚡ 5分钟首响提醒条（最醒目，最高优先级） -->
          <div
            v-if="activeChannel === 'whatsapp' && chatStore.isConnected && chatStore.followupCounts.firstResponse > 0 && !frBarDismissed && !isMobile"
            class="first-response-bar"
          >
            <span class="frb-icon">🔔</span>
            <span class="frb-text" @click="jumpToFirstResponse(0)" style="cursor:pointer">
              <b>{{ chatStore.followupCounts.firstResponse }} 位客户等待首响超过 5 分钟！</b>
            </span>
            <span class="frb-names" @click="jumpToFirstResponse(0)" style="cursor:pointer">
              <template v-for="(alert, i) in firstResponsePreview" :key="alert.jid">
                <span class="frb-name" @click.stop="jumpToFirstResponseByName(alert)">{{ alert.name }}</span><span v-if="i < firstResponsePreview.length - 1">、</span>
              </template>
              <span v-if="chatStore.followupCounts.firstResponse > 3" class="frb-more"> +{{ chatStore.followupCounts.firstResponse - 3 }}</span>
            </span>
            <button class="frb-btn frb-btn-reply" @click.stop="jumpToFirstResponse(0)">立即回复 ⚡</button>
            <button class="frb-btn frb-btn-dismiss" @click.stop="frBarDismissed=true">知道了</button>
          </div>
          <!-- 待跟进汇总条（PC端保留） -->
          <div
            v-if="activeChannel === 'whatsapp' && chatStore.isConnected && !isMobile"
            class="followup-summary-bar"
            :class="{ active: chatStore.showFollowupsOnly }"
            @click="chatStore.toggleFollowupsFilter()"
            title="点击切换“只看待跟进”筛选"
          >
            <span v-if="chatStore.followupCounts.urgent > 0" class="fu-badge fu-urgent">
              🔴 {{ chatStore.followupCounts.urgent }} 需立即回复
            </span>
            <span v-if="chatStore.followupCounts.followup > 0" class="fu-badge fu-followup">
              🟡 {{ chatStore.followupCounts.followup }} 待跟进
            </span>
            <span v-if="chatStore.followupCounts.reactivate > 0" class="fu-badge fu-reactivate">
              🔵 {{ chatStore.followupCounts.reactivate }} 待唤醒
            </span>
            <span v-if="chatStore.followupCounts.total === 0" class="fu-empty">✅ 今日无待跟进客户</span>
            <span v-if="chatStore.showFollowupsOnly" class="fu-filter-on">· 仅待跟进</span>
          </div>
          <div class="chatlist-body" v-if="(activeChannel === 'whatsapp' && chatStore.isConnected) || activeChannel === 'telegram'">
            <template v-if="activeChannel === 'whatsapp' && !chatStore.isConnected">
              <div class="empty-list-hint">
                <div style="font-size:32px;opacity:0.3"></div>
                <div style="font-size:13px;color:#8696a0;margin-top:8px;text-align:center;padding:0 16px;">请先连接 WhatsApp 账号</div>
              </div>
            </template>
            <template v-else-if="activeChannel === 'telegram' && (tgAccounts.length === 0 || tgConversationsLoading)">
              <div class="empty-list-hint">
                <div style="font-size:32px;opacity:0.3">✈️</div>
                <div style="font-size:13px;color:#8696a0;margin-top:8px;text-align:center;padding:0 16px;">Telegram 加载中...</div>
              </div>
            </template>
            <template v-else-if="activeChannel === 'whatsapp' && displayConversations.length === 0">
              <div class="empty-list-hint">
                <div style="font-size:32px;opacity:0.3">💬</div>
                <div style="font-size:13px;color:#8696a0;margin-top:8px;text-align:center;padding:0 16px;">{{ chatStore.connectionStatus === 'connected' ? '暂无会话' : '加载中...' }}</div>
              </div>
            </template>
            <template v-else-if="activeChannel === 'telegram' && displayConversations.length === 0">
              <div class="empty-list-hint" style="padding:20px;text-align:center;">
                <div style="font-size:40px;">✈️</div>
                <div style="font-size:14px;font-weight:600;margin:12px 0 6px;color:var(--text-primary,#e9edef);">等待消息</div>
                <div style="font-size:12px;color:var(--text-secondary,#8696a0);line-height:1.6;">
                  在 Telegram 中找到你的 Bot<br/>
                  发送 /start 或任意消息即可开始对话
                </div>
                <div v-if="tgAccounts.filter(a=>!a.telegramBotToken).length > 0" style="margin-top:12px;font-size:11px;color:#2AABEE;background:#E3F2FD;padding:6px 12px;border-radius:12px;display:inline-block;">
                  ✅ @{{ (tgAccounts.find(a=>!a.telegramBotToken)||{}).name || "UserBot" }}
                </div>
              </div>
            </template>
            <div
              v-for="conv in displayConversations"
              :key="conv.jid"
              class="conv-item"
              :class="{ active: activeConv === conv.jid, 'conv-fu': !!conv.followupStatus, 'conv-first-response': !!conv.firstResponseWaited, 'conv-pinned': conv.pinned, 'conv-menu-open': convMenu.visible && convMenu.conv && convMenu.conv.jid === conv.jid }"
              @click="onConvClick(conv, $event)"
              @contextmenu.prevent="openConvMenu(conv, $event)"
              @touchstart.passive="onConvTouchStart(conv, $event)"
              @touchend="onConvTouchEnd(conv, $event)"
              @touchmove.passive="onConvTouchMove"
            >
              <div class="conv-avatar" :style="!convAvatarOk(conv) ? {background: conv.color} : {}">
                <img v-if="!(conv.jid && conv.jid.includes('@g.us')) && chatStore.loadAvatar(conv.jid, conv.avatar) && convAvatarOk(conv)" class="conv-avatar-img" :src="chatStore.loadAvatar(conv.jid, conv.avatar)" @error="onConvAvatarError(conv.jid)" alt="" />
                <span v-else-if="conv.jid && conv.jid.includes('@g.us')" class="conv-avatar-initial" style="font-size:14px;font-weight:700;letter-spacing:-1px">群</span>
                <span v-else class="conv-avatar-initial">{{ convInitial(conv) }}</span>
                <span class="conv-status-dot" :class="conv.status || 'offline'"></span>
                <span v-if="conv.followupStatus" class="conv-followup-dot" :class="'fu-dot-' + conv.followupStatus"></span>
                <span v-if="conv.firstResponseWaited" class="conv-fr-badge" :title="'已等待 ' + conv.firstResponseWaited + ' 分钟'">⚡急</span>
                <span v-if="getBgRating(conv.jid)" class="conv-bg-rating" :style="{background: bgRatingColor(getBgRating(conv.jid))}" :title="'背调评级: ' + getBgRating(conv.jid)">{{ getBgRating(conv.jid) }}</span>
                <span v-if="getBantLevel(conv.jid)" class="conv-bant-level" :class="'bant-' + getBantLevel(conv.jid).toLowerCase()" @click.stop="openBantDetail(conv.jid)" :title="'BANT: ' + getBantLevel(conv.jid) + ' · ' + (bantScoreMap[conv.jid]?.totalScore || '')">{{ getBantLevel(conv.jid).charAt(0) }}</span>
              </div>
              <div class="conv-main">
                <div class="conv-row">
                  <span class="conv-name">
                    <span v-if="conv.firstResponseWaited" class="conv-fr-dot-inline" :title="'已等待 ' + conv.firstResponseWaited + ' 分钟'">⚡</span>
                    <span v-else-if="conv.followupStatus" class="conv-followup-dot-inline" :class="'fu-dot-' + conv.followupStatus"></span>
                    <span v-if="conv.platform === 'telegram'" class="conv-badge" title="Telegram" style="background:#2AABEE;color:#fff;font-size:9px;padding:1px 4px;border-radius:3px;margin-right:4px;font-weight:600;">TG</span>
                    <span v-if="conv.platform === 'whatsapp' && chatStore.accountFilter == null && waAccounts.length > 1 && conv.accountName" class="conv-badge conv-acc-badge" :style="{background: accColor(conv.accountId)}" :title="conv.accountName">{{ conv.accountName }}</span>
                    {{ conv.name }}
                    <span v-if="conv.pinned" class="conv-badge conv-badge-pin" title="已置顶">📌</span>
                    <span v-if="conv.starred" class="conv-badge conv-badge-star" title="特别关注">⭐</span>
                  </span>
                  <span class="conv-time">{{ conv.time }}</span>
                </div>
                <div class="conv-row">
                  <span class="conv-preview">
                    <span v-if="conv.firstResponseWaited" class="conv-fr-wait-text">[待首响 {{ conv.firstResponseWaited }}分钟] </span>
                    {{ conv.preview || '点击开始对话' }}
                  </span>
                  <span v-if="conv.unread" class="conv-unread">{{ conv.unread }}</span>
                  <button class="conv-chevron" @click.stop="openConvMenu(conv, $event)" title="更多操作">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M7 10l5 5 5-5z"/></svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
                  <!-- 会话操作菜单 ActionSheet -->
          <transition name="sheet-fade">
            <div v-if="convMenu.visible" class="sheet-mask" @click="closeConvMenu"></div>
          </transition>
          <transition name="sheet-up">
            <div v-if="convMenu.visible" class="action-sheet" @click.stop>
              <div class="action-sheet-title">{{ convMenu.conv ? convMenu.conv.name : '' }}</div>
              <button class="action-sheet-item" @click="doTogglePin">
                <span class="asi-icon">{{ convMenu.conv && convMenu.conv.pinned ? '📌' : '📌' }}</span>
                <span>{{ convMenu.conv && convMenu.conv.pinned ? '取消置顶' : '置顶聊天' }}</span>
              </button>
              <button class="action-sheet-item" @click="doToggleStar">
                <span class="asi-icon">⭐</span>
                <span>{{ convMenu.conv && convMenu.conv.starred ? '取消特别关注' : '添加到特别关注' }}</span>
              </button>
              <button class="action-sheet-item asi-danger" @click="doToggleBlock">
                <span class="asi-icon">🚫</span>
                <span>{{ convMenu.conv && convMenu.conv.blocked ? '解除封锁' : '封锁' }}</span>
              </button>
              <button class="action-sheet-item asi-danger" @click="doDeleteConv">
                <span class="asi-icon">🗑️</span>
                <span>删除联系人</span>
              </button>
              <button class="action-sheet-item asi-cancel" @click="closeConvMenu">取消</button>
            </div>
          </transition>

</aside>
        <main class="col-conversation" :class="{ 'm-in': isMobile && (mobileInConv && (activeConv || tgActiveJid) || activeChannel === 'email'), 'email-conv': activeChannel === 'email' }">

          <!-- ====== L2: Business Confirmation Banner ====== -->
          <transition name="biz-confirm-slide">
            <div v-if="bizConfirmPending.length > 0 && activeChannel === 'whatsapp'" class="biz-confirm-banner">
              <div class="biz-confirm-inner">
                <div class="biz-confirm-icon">🔍</div>
                <div class="biz-confirm-text">
                  <span class="biz-confirm-label"><span class="biz-confirm-name">「{{ bizConfirmPending[currentBizConfirmIdx]?.displayName }}<span class="biz-confirm-phone" v-if="bizConfirmPending[currentBizConfirmIdx]?.phone && bizConfirmPending[currentBizConfirmIdx]?.phone !== bizConfirmPending[currentBizConfirmIdx]?.displayName"> · {{ bizConfirmPending[currentBizConfirmIdx]?.phone }}</span>」</span><span class="biz-confirm-q">是业务客户吗？</span></span>
                  <span class="biz-confirm-counter" v-if="bizConfirmPending.length > 1">{{ currentBizConfirmIdx + 1 }}/{{ bizConfirmPending.length }}</span>
                </div>
                <div class="biz-confirm-actions">
                  <button class="biz-confirm-btn biz-confirm-view" @click="onViewBizConversation">查看会话</button>
                  <button class="biz-confirm-btn biz-confirm-yes" @click="onConfirmBusiness(true)">✓ 标记为业务客户</button>
                  <button class="biz-confirm-btn biz-confirm-no" @click="onConfirmBusiness(false)">忽略</button>
                </div>
              </div>
            </div>
          </transition>

          <!-- 📧 邮箱渠道嵌入式视图 -->
          <EmailChannelView v-if="activeChannel === 'email'" :embedded="true" @unread-count="onEmailUnread" />
          <template v-else>
          <!-- TG tab 且未选中会话：TG 登录欢迎页（扫码/手机号） -->
          <div v-if="activeChannel === 'telegram' && !tgActiveJid" class="tg-no-session-wrap">
            <div v-if="tgAccounts.length === 0 && tgLoginView === 'welcome'" class="conv-placeholder tg-welcome-page">
              <div class="no-account-empty">
                <div class="no-account-icon-wrap tg-welcome-icon-wrap">
                  <svg class="no-account-tg-icon" viewBox="0 0 24 24" width="64" height="64" aria-hidden="true"><path fill="#2AABEE" d="M9.04 15.51l-.38 5.33c.54 0 .78-.24 1.06-.52l2.55-2.44 5.28 3.87c.97.53 1.66.25 1.92-.9L22.9 4.32c.31-1.42-.52-1.97-1.46-1.63L2.58 9.47c-1.39.54-1.37 1.32-.24 1.67l4.75 1.48 11.03-6.94c.52-.32 1-.14.61.19L9.04 15.51z"/></svg>
                </div>
                <div class="no-account-title">欢迎使用 Telegram</div>
                <div class="no-account-subtitle">连接 Telegram 账号，与海外客户实时沟通、跟进询盘。点击下方按钮，即可扫码或手机号快速登录。</div>
                <button class="no-account-cta tg-welcome-cta" @click="tgOpenNewSession">新建会话</button>
              </div>
            </div>
            <div v-else-if="tgAccounts.length > 0 && tgLoginView === 'welcome'" class="conv-placeholder">
              <div class="ph-icon">💬</div>
              <div class="ph-title">从左侧列表选择一个会话开始沟通</div>
            </div>
            <div v-else class="conv-placeholder tg-login-welcome">
            <div class="tg-login-card">
              <!-- 视图一：扫码登录 -->
              <div v-if="tgLoginView === 'qr'" class="tg-login-view">
                <div class="tg-login-logo-row">
                  <span class="tg-login-logo-mini" aria-hidden="true">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff" role="img" aria-label="Telegram 纸飞机图标"><desc>Telegram 纸飞机图标</desc><path d="M9.04 15.51l-.38 5.33c.54 0 .78-.24 1.06-.52l2.55-2.44 5.28 3.87c.97.53 1.66.25 1.92-.9L22.9 4.32c.31-1.42-.52-1.97-1.46-1.63L2.58 9.47c-1.39.54-1.37 1.32-.24 1.67l4.75 1.48 11.03-6.94c.52-.32 1-.14.61.19L9.04 15.51z"/></svg>
                  </span>
                  <span class="tg-login-brand">Telegram</span>
                </div>
                <h2 class="tg-qr-title">通过扫码登录 Telegram</h2>
                <p class="tg-qr-sub">使用手机上的 Telegram 扫描二维码，快速安全登录</p>
                <div class="tg-qr-box">
                  <svg id="tgLoginQrSvg" viewBox="0 0 232 232" role="img" aria-label="登录二维码"></svg>
                </div>
                <ol class="tg-qr-steps">
                  <li><span class="tg-num">1</span><span>打开手机上的 <b>Telegram</b> 应用</span></li>
                  <li><span class="tg-num">2</span><span>进入 <b>设置 → 设备 → 扫码登录</b></span></li>
                  <li><span class="tg-num">3</span><span>对准本屏幕扫描二维码，并在手机上确认登录</span></li>
                </ol>
                <button type="button" class="tg-switch-link" @click="tgSwitchLoginView('phone')"><small>没有二维码？</small>使用手机号登录</button>
              </div>
              <!-- 视图二：手机号登录 -->
              <div v-else class="tg-login-view">
                <div class="tg-phone-wrap">
                  <span class="tg-logo-big" aria-hidden="true">
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="#fff" role="img" aria-label="Telegram 图标"><desc>Telegram 纸飞机图标</desc><path d="M9.04 15.51l-.38 5.33c.54 0 .78-.24 1.06-.52l2.55-2.44 5.28 3.87c.97.53 1.66.25 1.92-.9L22.9 4.32c.31-1.42-.52-1.97-1.46-1.63L2.58 9.47c-1.39.54-1.37 1.32-.24 1.67l4.75 1.48 11.03-6.94c.52-.32 1-.14.61.19L9.04 15.51z"/></svg>
                  </span>
                  <h2 class="tg-phone-title">Telegram</h2>
                  <p class="tg-phone-sub">请确认国家区号并输入您的手机号</p>
                  <div class="tg-country-field" :class="{open: tgCountryOpen}" @click="tgOpenCountry" role="button" tabindex="0" aria-haspopup="listbox" :aria-expanded="tgCountryOpen ? 'true' : 'false'" @keydown.enter.prevent="tgOpenCountry">
                    <span class="tg-flag">{{ tgCountries[tgCountryIdx].flag }}</span>
                    <span class="tg-cname">{{ tgCountries[tgCountryIdx].name }}</span>
                    <span class="tg-ccode">{{ tgCountries[tgCountryIdx].code }}</span>
                    <span class="tg-chev" aria-hidden="true">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
                    </span>
                  </div>
                  <div class="tg-country-drop" v-if="tgCountryOpen" role="listbox" aria-label="国家列表">
                    <div class="tg-drop-search">
                      <input v-model="tgCountrySearch" type="text" placeholder="搜索国家或区号…" autocomplete="off" />
                    </div>
                    <div class="tg-drop-list">
                      <div v-for="c in tgCountryFiltered" :key="c.name" class="tg-drop-item" :class="{selected: tgCountries.indexOf(c) === tgCountryIdx}" @click="tgSelectCountry(tgCountries.indexOf(c))" role="option" :aria-selected="tgCountries.indexOf(c) === tgCountryIdx">
                        <span class="tg-flag">{{ c.flag }}</span>
                        <span class="tg-dname">{{ c.name }}</span>
                        <span class="tg-dcode">{{ c.code }}</span>
                      </div>
                      <div v-if="tgCountryFiltered.length === 0" class="tg-drop-empty">未找到匹配的国家</div>
                    </div>
                  </div>
                  <div class="tg-phone-field">
                    <span class="tg-prefix">{{ tgCountries[tgCountryIdx].code }}</span>
                    <input v-model="tgPhoneNum" type="tel" placeholder="请输入手机号" inputmode="numeric" autocomplete="tel-national" aria-label="手机号" />
                  </div>
                  <label class="tg-keep-row">
                    <input type="checkbox" v-model="tgKeepSigned" />
                    <span class="tg-check" aria-hidden="true">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12.5l5.2 5.2L20 6.5"/></svg>
                    </span>
                    <span>保持登录状态</span>
                  </label>
                  <button type="button" class="tg-next-btn" @click="tgLoginNext">下一步</button>
                  <button type="button" class="tg-switch-link" @click="tgSwitchLoginView('qr')"><small>没有手机验证码？</small>使用扫码登录</button>
                </div>
              </div>
            </div>
            </div>
          </div>
                    <!-- TG tab 且选中了会话：内联TG聊天面板（不经过ChatView，避免WA依赖） -->
          <div v-else-if="activeChannel === 'telegram' && tgActiveJid" class="tg-chat" style="display:flex;flex-direction:column;height:100%;background:var(--chat-bg,#0b141a);">
            <div class="tg-header" style="display:flex;align-items:center;gap:10px;padding:10px 16px;background:var(--panel-header-bg,#202c33);border-bottom:1px solid var(--border-color,#222d34);position:relative;z-index:50;touch-action:manipulation;overflow:visible;">
              <button @click="tgActiveJid=null;activeConv=null;chatStore.activeConversation=null;if(isMobile){mobileInConv=false;mobilePanel=null;activeConv=null;}" @touchend.stop.prevent="tgActiveJid=null;activeConv=null;chatStore.activeConversation=null;if(isMobile){mobileInConv=false;mobilePanel=null;activeConv=null;}" style="background:none;border:none;color:var(--text-secondary,#8696a0);font-size:20px;cursor:pointer;padding:4px 8px;">←</button>
              <div class="tg-avatar" :style="!tgHeaderAvatar ? {background:'#2AABEE'} : {}" style="width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:600;font-size:18px;overflow:hidden;">
                <img v-if="tgHeaderAvatar && !tgHeaderAvatarFailed" :src="tgHeaderAvatar" @error="tgHeaderAvatarFailed=true" alt="" style="width:100%;height:100%;object-fit:cover;"/>
                <span v-else>{{ (tgConversations.find(c=>c.jid===tgActiveJid)?.name || '?')[0] }}</span>
              </div>
              <div style="flex:1;">
                <div style="font-weight:600;color:var(--text-primary,#e9edef);font-size:16px;">{{ tgConversations.find(c=>c.jid===tgActiveJid)?.name || tgActiveJid }}</div>
                <div style="font-size:12px;color:var(--text-secondary,#8696a0);display:flex;align-items:center;gap:4px;justify-content:flex-start;">
                  <span v-if="tgCultureInfo && tgCultureWorkStatus.localTime" :style="{display:'inline-flex',alignItems:'center',gap:'3px',fontSize:'11px',fontWeight:500,marginRight:'auto',color:'var(--text-secondary,#8696a0)',cursor:'pointer'}" @click.stop="switchPanel('worldclock')">
                    {{ tgCultureInfo.name }} {{ tgCultureWorkStatus.localTime }}
                  </span>
                  <span v-else-if="tgActiveConv && tgActiveConv.platform === 'telegram' && !tgActiveConv.contactPhone" style="color:#e67e22;font-size:11px;cursor:pointer;" @click.stop="switchPanel('worldclock')">🌐 请设置国家</span>
                  <span v-else>✈️ Telegram</span>
                </div>
              </div>
              <div v-if="isMobile" style="display:flex;gap:4px;margin-left:auto;align-items:center;">
                <div class="mh-menu-wrap" v-for="g in MH_GROUPS" :key="g.key">
                  <button type="button" class="mh-btn mh-group-btn" :class="{active: tgMenuOpen===g.key || g.items.some(i=>i.key===activePanel)}" @click.stop="tgMenuOpen=tgMenuOpen===g.key?null:g.key" @touchend.stop.prevent="tgMenuOpen=tgMenuOpen===g.key?null:g.key" :title="g.label" style="touch-action:manipulation !important;-webkit-tap-highlight-color:transparent;background:transparent;border:none;color:var(--text-secondary,#8696a0);cursor:pointer;padding:6px;border-radius:50%;font-size:16px;position:relative;z-index:2;pointer-events:auto !important;">
                    <span class="mh-g-icon">{{ g.icon }}</span><span class="mh-g-caret" :class="{open: tgMenuOpen===g.key}">▾</span>
                  </button>
                  <div class="mh-dropdown" v-if="tgMenuOpen===g.key" @click.stop>
                    <div class="mh-dd-item" v-for="it in g.items" :key="it.key" :class="{active: activePanel===it.key}" @click="tgMenuOpen=null; switchPanel(it.key)" @touchend.stop.prevent="tgMenuOpen=null; switchPanel(it.key)" style="touch-action:manipulation;-webkit-tap-highlight-color:transparent;cursor:pointer;">
                      <span class="mh-dd-icon">{{ it.icon }}</span>
                      <span class="mh-dd-label">{{ it.label }}</span>
                      <span class="mh-dd-check" v-if="activePanel===it.key">✓</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div class="tg-msgs" style="flex:1;overflow-y:auto;padding:16px 8%;display:flex;flex-direction:column;gap:6px;position:relative;z-index:1;">
              <div v-for="m in tgMessages" :key="m.id" :style="{alignSelf:m.fromMe?'flex-end':'flex-start',maxWidth:'75%'}">
                <div :style="{background:(m.messageType==='image'||m.messageType==='MessageMediaPhoto'||m.mediaType==='MessageMediaPhoto')&&m.mediaUrl&&isMediaPlaceholderText(m.text)?'transparent':(m.fromMe?'#2AABEE':'var(--msg-incoming,#202c33)'),color:m.fromMe?'#fff':'var(--text-primary,#e9edef)',padding:(m.messageType==='image'||m.messageType==='MessageMediaPhoto'||m.mediaType==='MessageMediaPhoto')&&m.mediaUrl&&isMediaPlaceholderText(m.text)?'0':'8px 12px',borderRadius:m.fromMe?'8px 8px 0 8px':'8px 8px 8px 0',fontSize:'14px',lineHeight:1.4,wordBreak:'break-word',overflow:'hidden'}">
                  <!-- 媒体消息：显示图片/视频 -->
                  <template v-if="m.mediaUrl && (m.messageType === 'image' || m.messageType === 'MessageMediaPhoto' || m.mediaType === 'MessageMediaPhoto')">
                    <a :href="m.mediaUrl" target="_blank" rel="noopener"><img :src="m.mediaUrl" style="width:100%;max-height:320px;object-fit:contain;display:block;cursor:pointer;" @error="$event.target.style.display='none'" /></a>
                  </template>
                  <template v-else-if="m.mediaUrl && (m.messageType === 'video' || m.messageType === 'MessageMediaVideo')">
                    <video :src="m.mediaUrl" controls style="max-width:100%;border-radius:8px;margin-bottom:4px;max-height:240px;"></video>
                  </template>
                  <template v-else-if="m.mediaUrl">
                    <a :href="m.mediaUrl" target="_blank" style="color:inherit;text-decoration:underline;">📎 {{ m.text || '附件' }}</a>
                  </template>
                  <!-- 文本消息 -->
                  <template v-if="m.translationObj">
                    <div style="color:inherit;">{{ m._sending ? '...' : (isMediaPlaceholderText(m.text) ? '' : (m.fromMe ? (m.translationObj.translated || m.text) : m.text)) }}</div>
                    <div :style="{fontSize:transForm.translationSize,color:'inherit',marginTop:'0',fontStyle:'italic',paddingTop:'6px',borderTop:'1.5px dashed '+(isDark?'rgba(255,255,255,0.35)':'rgba(0,0,0,0.5)'),width:'100%'}">{{ isMediaPlaceholderText(m.translationObj.original) ? '' : (m.fromMe ? m.translationObj.original : m.translationObj.translated) }}</div>
                  </template>
                  <template v-else>{{ m._sending ? '...' : (isMediaPlaceholderText(m.text) ? '' : m.text) }}</template>
                </div>
                <div :style="{fontSize:'11px',color:'var(--text-secondary,#8696a0)',textAlign:m.fromMe?'right':'left',marginTop:'2px'}">{{ m.time }}<template v-if="m.fromMe && m.read"> ✓✓</template><template v-else-if="m.fromMe"> ✓</template></div>
              </div>
              <div v-if="tgMessages.length === 0" style="text-align:center;color:var(--text-secondary,#8696a0);padding:20px;">暂无消息，在 Telegram 发第一条消息吧</div>
            </div>
            <!-- TG 附件预览 -->
            <div v-if="tgPendingFile" class="tg-media-preview" style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--panel-header-bg,#202c33);border-top:1px solid var(--border-color,#222d34);">
              <div style="position:relative;display:inline-flex;align-items:center;gap:6px;background:rgba(255,255,255,0.08);border-radius:10px;padding:6px 10px;max-width:80%;">
                <span style="font-size:20px;">{{ tgPendingFile.type && tgPendingFile.type.startsWith('image/') ? '🖼️' : tgPendingFile.type && tgPendingFile.type.startsWith('video/') ? '🎬' : '📄' }}</span>
                <span style="color:var(--text-primary,#e9edef);font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:180px;">{{ tgPendingFile.name }}</span>
                <span style="color:var(--text-secondary,#8696a0);font-size:11px;">{{ formatTgFileSize(tgPendingFile.size) }}</span>
                <button @click="tgPendingFile=null" style="position:absolute;top:-6px;right:-6px;width:18px;height:18px;border-radius:50%;border:none;background:#ef4444;color:#fff;font-size:11px;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1;">✕</button>
              </div>
            </div>
            <!-- TG 输入区 -->
            <div class="tg-input" style="display:flex;gap:8px;padding:10px 12px;background:var(--panel-header-bg,#202c33);border-top:1px solid var(--border-color,#222d34);">
              <div class="tg-attach-wrap" style="position:relative;">
                <button class="tg-attach-btn" @click="tgToggleAttachMenu" style="width:42px;height:42px;border-radius:50%;border:none;background:none;color:var(--text-secondary,#8696a0);cursor:pointer;font-size:20px;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:color 0.15s;">
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
                </button>
                <div v-if="tgAttachMenuOpen" class="tg-attach-menu" style="position:absolute;bottom:calc(100% + 6px);left:0;background:#233138;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,0.5);padding:6px;z-index:50;min-width:180px;border:1px solid var(--sidebar-active,#374045);">
                  <div style="position:absolute;bottom:-6px;left:16px;width:10px;height:10px;background:#233138;border-right:1px solid var(--sidebar-active,#374045);border-bottom:1px solid var(--sidebar-active,#374045);transform:rotate(45deg);"></div>
                  <button class="tg-attach-item" @click="tgPickFile('image')" style="display:flex;align-items:center;gap:10px;width:100%;background:none;border:none;color:var(--text-primary,#e9edef);padding:10px 12px;border-radius:6px;cursor:pointer;font-size:14px;text-align:left;">
                    <span style="width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;background:#00a884;flex-shrink:0;color:#fff;">🖼️</span>
                    <span>图片/视频</span>
                  </button>
                  <button class="tg-attach-item" @click="tgPickFile('document')" style="display:flex;align-items:center;gap:10px;width:100%;background:none;border:none;color:var(--text-primary,#e9edef);padding:10px 12px;border-radius:6px;cursor:pointer;font-size:14px;text-align:left;">
                    <span style="width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;background:#53bdeb;flex-shrink:0;color:#fff;">📄</span>
                    <span>文件</span>
                  </button>
                </div>
              </div>
              <input ref="tgImageInput" type="file" accept="image/*,video/*" style="display:none" @change="tgOnFileSelected($event)" />
              <input ref="tgDocInput" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar,.csv,application/*" style="display:none" @change="tgOnFileSelected($event)" />
              <input v-model="tgInputText" @keydown.enter="sendTgMessage" placeholder="输入消息..." style="flex:1;background:var(--input-bg,#2a3942);border:none;border-radius:20px;padding:10px 16px;color:var(--text-primary,#e9edef);font-size:14px;outline:none;" />
              <button @click="sendTgMessage" :disabled="tgSending" style="width:42px;height:42px;border-radius:50%;border:none;background:#2AABEE;color:#fff;cursor:pointer;font-size:18px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">➤</button>
            </div>
          </div>
          <!-- 其他渠道：正常渲染router-view -->
          <template v-else>
          <router-view v-slot="{ Component }">
            <component ref="chatViewRef" :is="Component" v-if="Component" @go-back="handleGoBack" @open-translate-panel="onOpenTranslatePanel" />
            <div v-else class="conv-placeholder" :class="{'wa-empty-bg': !chatStore.isConnected}">
              <template v-if="!chatStore.isConnected && waAccounts.length === 0">
                <div class="no-account-empty">
                  <div class="no-account-icon-wrap">
                    <svg class="no-account-wa-icon" viewBox="0 0 48 48" width="64" height="64">
                      <path d="M24 3C12.42 3 3 12.42 3 24c0 3.78 1.01 7.34 2.77 10.42L3 45l10.89-2.71A20.91 20.91 0 0 0 24 45c11.58 0 21-9.42 21-21S35.58 3 24 3zm0 38.5a17.42 17.42 0 0 1-8.88-2.42l-.64-.38-6.6 1.55 1.58-6.44-.42-.66A17.46 17.46 0 0 1 6.5 24c0-9.65 7.85-17.5 17.5-17.5S41.5 14.35 41.5 24 33.65 41.5 24 41.5zm9.55-13.1c-.53-.27-3.13-1.54-3.62-1.72-.48-.18-.84-.27-1.2.27-.35.54-1.36 1.72-1.67 2.08-.31.35-.62.4-1.14.13-.53-.27-2.22-.82-4.23-2.61-1.56-1.39-2.62-3.1-2.93-3.63-.31-.54-.03-.83.23-1.09.24-.23.53-.6.79-.88.26-.29.35-.49.53-.8.17-.31.09-.58-.04-.85-.14-.27-1.18-2.84-1.62-3.89-.43-1.02-.86-.88-1.18-.89l-1.01-.02c-.35 0-.91.13-1.4.66-.48.53-1.83 1.79-1.83 4.35 0 2.55 1.87 5.01 2.13 5.36.26.35 3.69 5.62 8.93 7.88 1.24.54 2.21.85 2.97 1.09 1.25.39 2.38.34 3.29.2.99-.15 3.1-1.27 3.54-2.49.44-1.22.44-2.27.31-2.49-.14-.22-.48-.35-1.01-.62z" fill="#25D366"/>
                    </svg>
                  </div>
                  <div class="no-account-title">欢迎使用 WhatsApp</div>
                  <div class="no-account-subtitle">简单、可靠且私密。与亲友和同事私密收发消息、进行通话以及分享文件。</div>
                  <button class="no-account-cta" @click="onAddAccount">新建会话</button>
                </div>
              </template>
              <template v-else-if="!chatStore.isConnected">
                <div class="ph-icon wa-green">💚</div>
                <div class="ph-title">WhatsApp Web</div>
                <div class="ph-desc">发送私密消息，免费体验简单可靠的通话</div>
                <button class="connect-btn-big" @click="doConnectWA">扫码连接</button>
              </template>
              <template v-else>
                <div class="ph-icon">💬</div>
                <div class="ph-title">从左侧列表选择一个会话开始沟通</div>
              </template>
            </div>
          </router-view>
          </template>
          </template>
        </main>

        <!-- ⑥ 功能面板（AI助手 / 翻译设置） -->
        <aside class="col-function-panel" :class="{ collapsed: !isMobile && panelCollapsed, mini: !isMobile && aiMiniMode && activePanel === 'ai', translating: !isMobile && activePanel === 'translate', aitalking: !isMobile && activePanel === 'aitalk', customering: !isMobile && activePanel === 'customer', bgchecking: !isMobile && activePanel === 'bgcheck', requirementing: !isMobile && activePanel === 'requirement', documenting: !isMobile && activePanel === 'documents', companying: !isMobile && activePanel === 'company', clocking: !isMobile && activePanel === 'worldclock', forexing: !isMobile && activePanel === 'forex', freighting: !isMobile && activePanel === 'freight', 'm-panel': isMobile, 'm-panel-show': isMobile && mobilePanel, tracking: !isMobile && activePanel === 'tracking', importing: !isMobile && activePanel === 'import' }" :style="!isMobile && !panelCollapsed ? 'width:' + panelWidth + 'px' : ''">
          <div v-if="!isMobile && !panelCollapsed && activePanel" class="ai-resize-handle" @mousedown="startPanelDrag"></div>
          <div class="col-header panel-col-header" :class="{ 'ai-col-header': activePanel === 'ai' }">
            <template v-if="!panelCollapsed">
              <div class="ai-title" v-if="activePanel === 'ai'">
                <span class="ai-title-icon">🤖</span>
                <span v-if="!aiMiniMode" class="ai-title-text">AI 助手</span>
              </div>
              <div class="ai-title" v-else-if="activePanel === 'translate'">
                <span class="ai-title-icon">🌐</span>
                <span class="ai-title-text">翻译设置</span>
              </div>
              <div class="ai-title" v-else-if="activePanel === 'import'">
                <span class="ai-title-icon">📥</span>
                <span class="ai-title-text">导入聊天</span>
              </div>
              <div class="ai-title" v-else-if="activePanel === 'aitalk'">
                <span class="ai-title-icon">💬</span>
                <span class="ai-title-text">沟通话术</span>
              </div>
              <div class="ai-title" v-else-if="activePanel === 'bgcheck'">
                <span class="ai-title-icon">🔍</span>
                <span class="ai-title-text">客户背调</span>
              </div>
              <div class="ai-title" v-else-if="activePanel === 'requirement'">
                <span class="ai-title-icon">🎯</span>
                <span class="ai-title-text">客户需求分析</span>
              </div>
              <div class="ai-title" v-else-if="activePanel === 'company'">
              <span class="ai-title-icon">🏢</span>
              <span>公司资料</span>
              <div class="cm-add-dropdown" style="position:relative;margin-left:auto">
                <button class="col-toggle" @click.stop="openCompanyDialog()" title="新增资料（文字/文件）">➕</button>
              </div>
            </div>
            <div class="ai-title" v-else-if="activePanel === 'documents'">
                <span class="ai-title-icon">📄</span>
                <span class="ai-title-text">外贸单证</span>
                <button class="col-toggle" @click="openAiDocDialog = true" title="AI生成单证">
                  <span style="font-size:14px">🤖</span>
                </button>
              </div>
              <div class="ai-title" v-else-if="activePanel === 'worldclock'">
                🕰️ 时间文化
                <span class="ai-title-text">时间与文化</span>
                <button v-if="cultureIso" class="col-toggle" @click="cultureShowCustom = !cultureShowCustom" title="切换国籍/所在国">🔄</button>
              </div>
              <div class="ai-title" v-else-if="activePanel === 'forex'">
                <span class="ai-title-icon">💱</span>
                <span class="ai-title-text">汇率计算</span>
                <button class="col-toggle" @click="exRefreshRates()" title="刷新汇率">⟳</button>
              </div>
              <div class="ai-title" v-else-if="activePanel === 'freight'">
                <span class="ai-title-icon">🚢</span>
                <span class="ai-title-text">运费查询</span>
              </div>
              <div class="ai-title" v-else-if="activePanel === 'tracking'">
                <span class="ai-title-icon">📈</span>
                <span class="ai-title-text">效果追踪</span>
                <button class="col-toggle" @click="loadTrackingData()" title="刷新">⟳</button>
              </div>
              <div class="ai-title" v-else-if="activePanel === 'customer'">
                <span class="ai-title-icon">👤</span>
                <span class="ai-title-text">客户画像</span>
                <button class="col-toggle ai-mini-toggle" @click="customerEditMode = !customerEditMode" :title="customerEditMode ? '完成编辑' : '编辑资料'">
                  <span style="font-size:14px">{{ customerEditMode ? '💾' : '✏️' }}</span>
                </button>
                <button class="col-toggle" @click="runCustomerAiExtract" title="AI智能识别" :disabled="customerExtractLoading || !chatStore.activeJid">
                  <span style="font-size:14px">{{ customerExtractLoading ? '⏳' : '🔍' }}</span>
                </button>
              </div>
              <button v-if="activePanel === 'ai'" class="col-toggle ai-mini-toggle" @click="aiMiniMode = !aiMiniMode" :title="aiMiniMode ? '展开AI' : '迷你模式'">
                <svg v-if="aiMiniMode" viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
                <svg v-else viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
              </button>
              <button class="col-toggle m-panel-close" v-if="isMobile" @click="closeMobilePanel" title="关闭">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
              </button>
              <button class="col-toggle" v-if="!isMobile" @click="closePanel" title="收起面板">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12l-4.58 4.59z"/></svg>
              </button>
            </template>
            <button v-else class="col-toggle col-toggle-avatar" @click="switchPanel(lastActivePanel || 'aitalk')" :title="(customerData?.contactName || customerData?.name || chatStore.activeJid || '面板') + ' - 点击展开'">
              <img v-if="chatStore.activeJid && !chatStore.avatarFailed[chatStore.activeJid]"
                :src="chatStore.loadAvatar(chatStore.activeJid)"
                @error="chatStore.markAvatarFailed(chatStore.activeJid)"
                class="col-avatar-img" alt="" />
              <span v-else class="col-avatar-fallback">{{ (customerData?.contactName || customerData?.name || customerData?.phone || chatStore.activeJid || '?')[0] }}</span>
            </button>
          </div>
          <!-- AI 助手面板 -->
          <div class="ai-body" v-if="!panelCollapsed && activePanel === 'ai'">
            <!-- AI 模式选择 -->
            <div class="ai-actions">
              <button
                v-for="b in aiActions"
                :key="b.key"
                class="ai-action-btn"
                :class="{ active: chatStore.aiMode === b.key, hot: b.hot, disabled: !chatStore.activeJid }"
                :disabled="!chatStore.activeJid || chatStore.aiLoading"
                :title="b.label + '：' + b.desc"
                @click="handleAiActionClick(b.key)"
              >
                <span style="margin-right:4px">{{ b.icon }}</span>{{ b.label }}
              </button>
            </div>
            <!-- 窄版豆包聊天框（结果区） -->
            <div class="ai-chat-wrap">
              <div class="ai-chat-header" v-if="chatStore.aiMode">
                <span class="ai-chat-title">{{ aiModeTitle }}</span>
                <div class="ai-chat-actions">
                  <button class="ai-chat-icon-btn" :disabled="chatStore.aiLoading || !chatStore.aiChat.length" @click="chatStore.regenerateLastAi()" title="重新生成">🔄</button>
                  <button class="ai-chat-icon-btn" @click="chatStore.clearAiChat()" title="清空">🗑️</button>
                </div>
              </div>
              <div ref="aiResultRef" class="ai-result-area ai-chat-messages">
                <div v-if="!chatStore.activeJid" class="ai-empty">
                  <div class="ai-empty-icon">💬</div>
                  <div class="ai-empty-text">请先从左侧选择一个会话</div>
                </div>
                <template v-else-if="!chatStore.aiMode">
                  <div class="ai-welcome">
                    <div class="ai-welcome-icon">🤖</div>
                    <div class="ai-welcome-title">选择一个 AI 功能开始</div>
                    <div class="ai-welcome-desc">AI 会自动读取当前会话上下文</div>
                  </div>
                </template>

                <!-- AI话术：专用UI -->
                <template v-else-if="chatStore.aiMode === 'reply'">
                  <div class="ai-reply-panel">
                    <div class="ai-reply-styles">
                      <div class="ai-section-title-row">
                        <div class="ai-section-title">回复风格</div>
                        <button
                          v-if="chatStore.aiReplyResults.length"
                          class="ai-clear-btn"
                          @click="chatStore.aiReplyResults = []"
                          title="清空已生成话术"
                        >🗑️ 清空</button>
                      </div>
                      <div class="ai-style-row">
                        <div
                          v-for="st in replyStyles"
                          :key="st.key"
                          class="ai-style-card"
                          :class="{ active: chatStore.replyStyle === st.key }"
                          @click="chatStore.setReplyStyle(st.key)"
                        >
                          <span class="ai-style-icon">{{ st.icon }}</span>
                          <span>{{ st.label }}</span>
                        </div>
                      </div>
                      <!-- Phase 5: Length selector -->
                      <div class="ai-section-title-row" style="margin-top:8px">
                        <div class="ai-section-title">话术长度</div>
                      </div>
                      <div class="ai-length-chips">
                        <button
                          v-for="ln in replyLengths"
                          :key="ln.key"
                          class="ai-length-chip"
                          :class="{ active: replyLength === ln.key }"
                          @click="replyLength = ln.key"
                        >{{ ln.icon }} {{ ln.label }}</button>
                      </div>
                      <!-- Phase 5: Context toggle -->
                      <div class="ai-context-toggle">
                        <label class="ai-toggle-label">
                          <input type="checkbox" v-model="replyIncludeContext" />
                          <span>📊 注入上下文（背调+BANT+产品库+策略）</span>
                        </label>
                      </div>
                    </div>
                    <button
                      class="ai-gen-btn"
                      :disabled="chatStore.aiLoading || chatStore.aiGenerating || !chatStore.activeJid"
                      @click="handleGenerateReplies"
                    >
                      <template v-if="chatStore.aiGenerating"><span class="ai-dots-inline"><span></span><span></span><span></span></span></template>
                      <template v-else>⚡ 生成AI回复</template>
                    </button>
                    <button v-if="chatStore.aiGenerating" class="aitalk-stop-btn" @click="chatStore.stopAiGenerating()" title="终止本次AI生成">
                      <span class="aitalk-stop-icon">⏹</span><span>终止</span>
                    </button>
                    <div v-if="chatStore.aiReplyResults.length" class="ai-reply-list">
                      <!-- Phase 5: Context banner on first card -->
                      <div v-if="chatStore.aiReplyResults.length && chatStore.aiReplyResults[0]?.context" class="ai-context-banner">
                        <div class="ai-context-line" v-if="chatStore.aiReplyResults[0].context.strategy">
                          <span class="ai-ctx-tag" :class="chatStore.aiReplyResults[0].context.strategy === 'PROVIDE_QUOTE' ? 'tag-quote' : 'tag-ask'">
                            {{ chatStore.aiReplyResults[0].context.strategy === 'PROVIDE_QUOTE' ? '💰 报价阶段' : '🔍 信息收集' }}
                          </span>
                          <span class="ai-ctx-text">{{ chatStore.aiReplyResults[0].context.stage || '' }}</span>
                          <span class="ai-ctx-text">完整度 {{ Math.round((chatStore.aiReplyResults[0].context.completeness || 0) * 100) }}%</span>
                        </div>
                        <div class="ai-context-line" v-if="chatStore.aiReplyResults[0].context.backgroundCheck">
                          <span class="ai-ctx-text">🏢 {{ chatStore.aiReplyResults[0].context.backgroundCheck.companyName || '' }} ({{ chatStore.aiReplyResults[0].context.backgroundCheck.country || '' }})</span>
                        </div>
                        <div class="ai-context-line" v-if="chatStore.aiReplyResults[0].context.bantScore">
                          <span class="ai-ctx-text">BANT: {{ chatStore.aiReplyResults[0].context.bantScore.totalScore || 0 }}/10 ({{ chatStore.aiReplyResults[0].context.bantScore.level || '' }})</span>
                        </div>
                      </div>
                      <div
                        v-for="r in chatStore.aiReplyResults"
                        :key="r.id"
                        class="ai-reply-card"
                        :class="{ 'ai-error-card': r.error }"
                      >
                        <div class="ai-reply-text">{{ r.content }}</div>
                        <!-- Phase 5: Chinese translation -->
                        <div v-if="r.contentCn && !r.error" class="ai-reply-cn-block">
                          <div class="ai-reply-cn-text">{{ r.contentCn }}</div>
                        </div>
                        <div class="ai-reply-footer">
                          <div class="ai-reply-meta">
                            <span class="ai-reply-meta-tag">{{ r.styleIcon }} {{ r.styleName }}</span>
                            <span v-if="r.length" class="ai-reply-meta-tag length-tag">{{ lengthLabels[r.length] || r.length }}</span>
                          </div>
                          <div class="ai-reply-actions" v-if="!r.error">
                            <button class="ai-copy-btn" @click="copyToClipboard(r.contentCn)" v-if="r.contentCn" title="复制中文">📋 中文</button>
                            <button class="ai-insert-btn" @click="fillAiInput(r.content)">📝 插入</button>
                          </div>
                        </div>
                      </div>
                      <button
                        class="ai-gen-btn"
                        :disabled="chatStore.aiGenerating || chatStore.aiLoading || !chatStore.activeJid"
                        @click="handleGenerateReplies"
                      >
                        <template v-if="chatStore.aiGenerating"><span class="ai-dots-inline"><span></span><span></span><span></span></span></template>
                        <template v-else>⚡ 根据最新消息重新生成</template>
                      </button>
                      <button v-if="chatStore.aiGenerating" class="aitalk-stop-btn" @click="chatStore.stopAiGenerating()" title="终止本次AI生成">
                        <span class="aitalk-stop-icon">⏹</span><span>终止</span>
                      </button>
                    </div>
                    <!-- 追问气泡（user消息） -->
                    <div
                      v-for="m in chatStore.aiChat.filter(x => x.role === 'user')"
                      :key="m.id"
                      class="ai-chat-msg ai-user"
                    >
                      <div class="ai-chat-bubble">{{ m.content }}</div>
                    </div>
                  </div>
                </template>

                <!-- 需求总结：专用UI -->
                <template v-else-if="chatStore.aiMode === 'summary'">
                  <div class="ai-summary-panel">
                    <button
                      class="ai-gen-btn"
                      :disabled="chatStore.aiLoading || !chatStore.activeJid"
                      @click="handleGenerateSummary"
                    >
                      <template v-if="chatStore.aiLoading"><span class="ai-dots-inline"><span></span><span></span><span></span></span></template>
                      <template v-else>📋 分析客户需求</template>
                    </button>
                    <div v-if="chatStore.aiSummaryResult" class="ai-summary-result">
                      <!-- 意向度 -->
                      <div v-if="chatStore.aiSummaryResult.score != null" class="ai-score-block">
                        <div class="ai-score-header">
                          <span class="ai-section-title">意向度评分</span>
                          <span class="ai-score-num">{{ chatStore.aiSummaryResult.score }}/10</span>
                        </div>
                        <div class="ai-score-bar">
                          <div class="ai-score-fill" :style="{ width: (chatStore.aiSummaryResult.score * 10) + '%' }"></div>
                        </div>
                      </div>
                      <!-- 决策阶段 -->
                      <div v-if="chatStore.aiSummaryResult.stage" class="ai-stage-block">
                        <div class="ai-section-title">决策阶段</div>
                        <div class="ai-stage-text">{{ chatStore.aiSummaryResult.stage }}</div>
                      </div>
                      <!-- 字段卡片 -->
                      <div v-if="chatStore.aiSummaryResult.fields" class="ai-fields-grid">
                        <div
                          v-for="(val, key) in chatStore.aiSummaryResult.fields"
                          :key="key"
                          class="ai-field-card"
                          v-if="val"
                        >
                          <div class="ai-field-label">{{ summaryFieldLabels[key] || key }}</div>
                          <div class="ai-field-value">{{ val }}</div>
                        </div>
                      </div>
                      <!-- AI总结 -->
                      <div v-if="chatStore.aiSummaryResult.summary" class="ai-summary-block">
                        <div class="ai-summary-title">AI总结</div>
                        <div class="ai-summary-text">{{ chatStore.aiSummaryResult.summary }}</div>
                      </div>
                    </div>
                    <!-- 追问消息气泡 -->
                    <template v-if="chatStore.aiChat.length">
                      <div
                        v-for="m in chatStore.aiChat.slice(1)"
                        :key="m.id"
                        class="ai-chat-msg"
                        :class="{ 'ai-user': m.role === 'user', 'ai-assistant': m.role === 'assistant', 'ai-error': m.error }"
                      >
                        <div class="ai-chat-bubble">
                          <template v-if="m.segments && m.segments.length">
                            <div v-for="(seg,si) in m.segments" :key="si">
                              <div v-if="seg.type==='text'" class="ai-chat-content-seg" style="white-space:pre-wrap">{{ seg.text }}</div>
                              <div v-else-if="seg.type==='bilingual'" class="ai-bilingual-block">
                                <div class="ai-bilingual-foreign" :dir="autoDir(seg.foreign)" style="white-space:pre-wrap">{{ seg.foreign }}</div>
                                <div class="ai-bilingual-zh" style="white-space:pre-wrap;color:#8696a0;font-size:13px;font-style:italic;margin-top:4px;border-top:1px dashed rgba(134,150,160,0.25);padding-top:4px">{{ seg.zh }}</div>
                                <div class="ai-bilingual-actions" style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap">
                                  <button class="ai-insert-btn" @click="fillAiInput(seg.foreign)">📝 使用外文</button>
                                  <button class="ai-insert-btn ai-insert-btn-secondary" @click="copyText(seg.foreign)">📋 复制外文</button>
                                </div>
                              </div>
                            </div>
                          </template>
                          <div v-else class="ai-chat-content" style="white-space:pre-wrap">{{ m.content }}</div>
                          <div v-if="m.role === 'assistant' && !m.error && !m.segments" class="ai-insert-row">
                            <button class="ai-insert-btn" @click="fillAiInput(m.content)">📝 一键插入</button>
                          </div>
                          <div v-if="m.role === 'assistant' && !m.error && m.segments" class="ai-insert-row" style="margin-top:8px">
                            <button class="ai-insert-btn ai-insert-btn-secondary" @click="fillAiInput(m.content || (m.segments.filter(x=>x.type==='bilingual').map(x=>x.foreign).join('\n\n')))">📝 插入所有外文</button>
                          </div>
                        </div>
                      </div>
                    </template>
                  </div>
                </template>

                <!-- 翻译模式：专用双区块卡片（已有） -->
                <template v-else-if="chatStore.aiMode === 'translate'">
                  <div
                    v-for="m in chatStore.aiChat"
                    :key="m.id"
                    class="ai-chat-msg"
                    :class="{ 'ai-user': m.role === 'user', 'ai-assistant': m.role === 'assistant', 'ai-error': m.error }"
                  >
                    <div class="ai-chat-bubble">
                      <template v-if="m.role === 'assistant' && m.translateData">
                        <div class="ai-translate-card">
                          <div class="ai-trans-section">
                            <div class="ai-trans-label">ORIGINAL</div>
                            <div class="ai-trans-text">{{ m.translateData.original }}</div>
                            <div class="ai-trans-actions">
                              <button class="ai-insert-btn ai-insert-btn-secondary" @click="copyText(m.translateData.original)">📋 复制原文</button>
                              <button class="ai-insert-btn ai-insert-btn-secondary" @click="fillAiInput(m.translateData.original)">📝 插入原文</button>
                            </div>
                          </div>
                          <div class="ai-trans-section">
                            <div class="ai-trans-label">TRANSLATION</div>
                            <div class="ai-trans-text ai-trans-result">{{ m.translateData.translated }}</div>
                            <div class="ai-trans-actions">
                              <button class="ai-insert-btn" @click="copyText(m.translateData.translated)">📋 复制译文</button>
                              <button class="ai-insert-btn" @click="fillAiInput(m.translateData.translated)">📝 插入译文</button>
                            </div>
                          </div>
                        </div>
                      </template>
                      <template v-else>
                        <div class="ai-chat-content">{{ m.content }}</div>
                      </template>
                    </div>
                  </div>
                  <div v-if="chatStore.aiLoading" class="ai-chat-msg ai-assistant">
                    <div class="ai-chat-bubble ai-loading-bubble">
                      <div class="ai-dots"><span></span><span></span><span></span></div>
                    </div>
                  </div>
                </template>

                <!-- 其他模式（profile/空）：通用气泡 -->
                <template v-else>
                  <!-- profile 欢迎 + 生成按钮 -->
                  <template v-if="chatStore.aiMode === 'profile' && !chatStore.aiChat.length">
                    <div class="ai-welcome">
                      <div class="ai-welcome-icon">👤</div>
                      <div class="ai-welcome-text">点击"🔍 分析客户"开始分析</div>
                    </div>
                    <button
                      class="ai-gen-btn ai-profile-gen-btn"
                      :disabled="chatStore.aiLoading || !chatStore.activeJid"
                      @click="handleGenerateProfile"
                    >
                      <template v-if="chatStore.aiLoading"><span class="ai-dots-inline"><span></span><span></span><span></span></span></template>
                      <template v-else>🔍 分析客户</template>
                    </button>
                  </template>
                  <div
                    v-for="m in chatStore.aiChat"
                    :key="m.id"
                    class="ai-chat-msg"
                    :class="{ 'ai-user': m.role === 'user', 'ai-assistant': m.role === 'assistant', 'ai-error': m.error }"
                  >
                    <div class="ai-chat-bubble">
                      <div v-if="m.loading" class="ai-dots"><span></span><span></span><span></span></div>
                      <template v-else>
                        <div class="ai-chat-content">{{ m.content }}</div>
                        <div v-if="m.role === 'assistant' && !m.error" class="ai-insert-row">
                          <button class="ai-insert-btn" @click="fillAiInput(m.content)">📝 一键插入</button>
                        </div>
                      </template>
                    </div>
                  </div>
                  <div v-if="chatStore.aiLoading && !chatStore.aiChat.some(m => m.role === 'assistant' && !m.content)" class="ai-chat-msg ai-assistant">
                    <div class="ai-chat-bubble ai-loading-bubble">
                      <div class="ai-dots"><span></span><span></span><span></span></div>
                    </div>
                  </div>
                </template>
              </div>
              <!-- 底部迷你输入框 -->
              <div v-if="chatStore.aiMode && chatStore.activeJid" class="ai-chat-input-wrap">
                <input
                  ref="aiInputEl"
                  v-model="aiInputText"
                  class="ai-chat-input"
                  :placeholder="aiModePlaceholder"
                  :disabled="chatStore.aiLoading || chatStore.aiGenerating"
                  @keydown.enter="sendAiChat"
                />
                <button class="ai-chat-send" :disabled="chatStore.aiLoading || chatStore.aiGenerating || !aiInputText.trim()" @click="sendAiChat">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
                </button>
              </div>
            </div>
            <div v-if="aiMiniMode && !chatStore.activeJid" class="ai-mini-tip">请先选择会话</div>
            <button v-if="aiMiniMode" class="ai-mini-expand" @click="aiMiniMode = false">⤢ 展开完整面板</button>
          </div>
          <!-- AI 话术面板 v2 -->
          <div v-if="!panelCollapsed && activePanel === 'aitalk'" class="aitalk-panel-body">
            <!-- 顶部：模型选择 + 模式切换 + 清空 -->
            <div class="aitalk-top-bar aitalk-top-bar-compact">
              <div class="aitalk-top-first-row">
                <el-select v-model="aitalkModel" class="sub-select aitalk-model-select" popper-class="crm-dark-popper" placeholder="选择模型" size="small" @change="v => localStorage.setItem('crm_aitalk_model', v)">
                  <el-option v-for="m in aiModels" :key="m.key" :label="m.name + ' (' + (m.creditCost || 150) + '积分)'" :value="m.key" />
                </el-select>
                <el-select v-model="aitalkTargetLang" class="sub-select aitalk-lang-select-compact" popper-class="crm-dark-popper" placeholder="语言" size="small">
                  <el-option label="🌐 自动" value="follow" />
                  <el-option label="العربية" value="ar" />
                  <el-option label="English" value="en" />
                  <el-option label="中文" value="zh" />
                </el-select>
                <div class="aitalk-top-actions">
                  <span class="aitalk-autogen-wrap" :title="aitalkAutoGen ? '自动生成已开启：客户新消息自动生成话术' : '自动生成已关闭：需手动点击生成'">
                    <span class="aitalk-autogen-text">自动</span>
                    <el-switch v-model="aitalkAutoGen" size="small" />
                  </span>
                  <button class="aitalk-mode-btn" :class="{active: aitalkMode === 'quick'}" @click="aitalkMode = 'quick'" title="快捷生成">⚡</button>
                  <button class="aitalk-mode-btn" :class="{active: aitalkMode === 'chat'}" @click="switchToChatMode" title="对话模式">💬</button>
                  <button v-if="aiMessages.length" class="aitalk-clear-btn" @click="clearAiMessages" title="清空">🗑️</button>
                </div>
              </div>
            </div>

            <!-- Tab 切换条 -->
            <div class="profile-tabs aitalk-tabs">
              <button class="profile-tab" :class="{active: aitalkTab==='ai'}" @click="aitalkTab='ai'">
                <span class="profile-tab-ic">💬</span>
                <span class="profile-tab-lb">回复话术</span>
              </button>
              <!-- 话术库暂时隐藏（2026-08-23 话术语言不统一，待整理语种后恢复）
              <button class="profile-tab" :class="{active: aitalkTab==='library'}" @click="aitalkTab='library';loadSpeechSamples()">
                <span class="profile-tab-ic">📚</span>
                <span class="profile-tab-lb">话术库</span>
              </button>
              -->
            </div>

            <!-- 💬 沟通话术 Tab -->
            <template v-if="aitalkTab==='ai'">
            <!-- 中间对话/结果区 -->
            <div ref="aitalkScrollRef" class="aitalk-scroll" @scroll="onAitalkScroll">
              <!-- 空状态欢迎 -->
              <div v-if="aiMessages.length === 0 && !aitalkLoading" class="aitalk-welcome">
                <div class="aitalk-welcome-icon">🤖</div>
                <div class="aitalk-welcome-title">AI帮你写回复，搞定外贸客户</div>
                <div class="aitalk-chips">
                  <button class="aitalk-chip" @click="triggerQuickGenerate">✉️ 帮我写回复</button>
                  <button class="aitalk-chip" @click="sendQuickPrompt('请分析客户意图和关键信号，判断客户意向等级')">💡 分析客户意图</button>
                  <button class="aitalk-chip" @click="sendQuickPrompt('请帮我写一封报价跟进邮件/消息，礼貌催促客户确认价格')">💰 报价跟进</button>
                  <button class="aitalk-chip" @click="sendQuickPrompt('客户说价格太贵了，请帮我写一段有说服力的回复，强调价值而非降价')">🤝 价格谈判</button>
                  <button class="aitalk-chip" @click="sendQuickPrompt('请帮我写一段催单/催付款的话术，礼貌但有紧迫感')">⏰ 催单催款</button>
                  <button class="aitalk-chip" @click="sendQuickPrompt('客户已沉默多日未回复，请帮我写一段重新激活客户的话术')">🔄 激活沉默客户</button>
                  <button class="aitalk-chip" @click="sendQuickPrompt('请总结与该客户的沟通要点，包括询盘产品、数量、关注点、报价状态和待办事项')">📊 客户沟通总结</button>
                  <button class="aitalk-chip" @click="sendQuickPrompt('请帮我写一段发货通知话术，包含物流信息、预计到货时间和售后提醒')">📦 发货通知</button>
                  <button class="aitalk-chip" @click="sendQuickPrompt('收到客户投诉/质量问题反馈，请帮我写一段专业安抚和处理方案回复')">🛠️ 售后处理</button>
                  <button class="aitalk-chip" @click="sendQuickPrompt('请帮我写一段节日问候+业务维系的话术，自然不生硬')">🎉 节日问候</button>
                  <button class="aitalk-chip" @click="triggerQuickGenerate">✉️ 生成回复话术</button>
                  <button class="aitalk-chip" @click="sendQuickPrompt('请帮我写一段礼貌询问客户公司名称和官网的话术，自然不突兀')">🏢 询问公司名/官网</button>
                  <button class="aitalk-chip" @click="sendQuickPrompt('请帮我写一段礼貌询问客户如何称呼的话术')">🙋 询问客户称呼</button>
                  <button class="aitalk-chip" @click="sendQuickPrompt('请帮我写一段礼貌询问客户需要什么产品/具体需求的话术')">📦 询问客户需求</button>
                </div>
              </div>

              <!-- 消息列表 -->
              <template v-for="(msg, mi) in aiMessages" :key="msg.id">
                <!-- 用户消息 -->
                <div v-if="msg.role === 'user'" class="aitalk-msg aitalk-msg-user">
                  <div class="aitalk-bubble aitalk-bubble-user" v-html="renderMarkdown(msg.content)"></div>
                  <div class="aitalk-msg-time">{{ formatMsgTime(msg.ts) }}</div>
                </div>
                <!-- AI 回复 -->
                <div v-else class="aitalk-msg aitalk-msg-ai" :data-mid="msg.id">
                  <div v-if="msg.loading" class="aitalk-bubble aitalk-bubble-ai aitalk-typing">
                    <div class="aitalk-progress">
                      <div class="aitalk-progress-line">
                        <span class="aitalk-progress-stage">{{ progressStageText(msg._stage || 0) }}</span>
                        <span class="aitalk-progress-time">已处理 {{ formatElapsed(msg._elapsed || 0) }}</span>
                      </div>
                    </div>
                  </div>
                  <div v-else-if="msg.error" class="aitalk-error-block">
                    <div class="aitalk-error-text">❌ {{ msg.content }}</div>
                    <button class="aitalk-retry-btn" @click="retryLastRequest">重试</button>
                  </div>
                  <template v-else-if="msg.type === 'replies' && isLegacyRepliesMsg(msg)">
                    <div v-for="(r, idx) in msg.content" :key="idx" class="aitalk-reply-card-v2">
                      <div class="aitalk-reply-num">#{{ idx + 1 }}</div>
                      <div class="aitalk-reply-head">
                        <span class="aitalk-reply-name">{{ r.name }}</span>
                        <span class="aitalk-reply-sep"> — </span>
                        <span class="aitalk-reply-desc">{{ r.desc }}</span>
                      </div>
                      <template v-if="!r._editing">
                        <div class="aitalk-reply-foreign" :dir="autoDir(r.foreign)">{{ r.foreign }}</div>
                        <div class="aitalk-reply-chinese">{{ r.chinese }}</div>
                      </template>
                      <template v-else>
                        <textarea class="aitalk-edit-input aitalk-edit-foreign" v-model="r._editForeign" rows="3" placeholder="编辑外文话术（发送版）"></textarea>
                        <textarea class="aitalk-edit-input aitalk-edit-chinese" v-model="r._editChinese" rows="2" placeholder="编辑中文参考"></textarea>
                      </template>
                      <div class="aitalk-reply-actions">
                        <template v-if="!r._editing">
                          <button class="aitalk-mini-btn" @click="copyForeign(r.foreign, $event)">📋 复制外文</button>
                          <button class="aitalk-mini-btn" @click="copyForeign(r.chinese, $event)">📋 复制中文</button>
                          <button class="aitalk-mini-btn aitalk-edit-btn" @click="startEditReply(r)" title="编辑后复制或直接发送">✏️ 编辑</button>
                        </template>
                        <template v-else>
                          <button class="aitalk-mini-btn aitalk-save-btn" @click="saveEditReply(r)">💾 保存</button>
                          <button class="aitalk-mini-btn" @click="cancelEditReply(r)">↩️ 取消</button>
                        </template>
                      </div>
                      <button v-if="!r._editing" class="aitalk-use-btn" :class="{done: r._applied}" @click="useForeignReply(r, $event)">
                        {{ r._applied ? '✓ 已填入输入框' : '✏️ 点这里直接用' }}
                      </button>
                    </div>
                  </template>
                  <template v-else-if="msg.type === 'replies' && isRichRepliesMsg(msg)">
                    <!-- 🔬 产品分析卡片 -->
                    <div v-if="msg.content.productAnalysis && msg.content.productAnalysis.needed" class="aitalk-product-card">
                      <div class="aitalk-product-header">
                        <span class="aitalk-product-icon">🔬</span>
                        <span class="aitalk-product-title">产品概念分析</span>
                        <span class="aitalk-match-badge" :class="'match-' + (msg.content.productAnalysis.matchLevel || 'MEDIUM').toLowerCase()">
                          {{ {HIGH:'高度匹配',MEDIUM:'部分匹配',LOW:'低匹配'}[msg.content.productAnalysis.matchLevel] || '匹配分析' }}
                        </span>
                      </div>
                      <div class="aitalk-product-body">
                        <div class="aitalk-product-explain">{{ msg.content.productAnalysis.productExplanation }}</div>
                        <div v-if="msg.content.productAnalysis.matchedProducts && msg.content.productAnalysis.matchedProducts.length" class="aitalk-product-matched">
                          <span class="aitalk-pm-label">匹配产品：</span>
                          <span v-for="p in msg.content.productAnalysis.matchedProducts" :key="p" class="aitalk-pm-chip">{{ p }}</span>
                        </div>
                        <div v-if="msg.content.productAnalysis.keyParamsToConfirm && msg.content.productAnalysis.keyParamsToConfirm.length" class="aitalk-product-params">
                          <span class="aitalk-pp-label">需追问参数：</span>
                          <span v-for="p in msg.content.productAnalysis.keyParamsToConfirm" :key="p" class="aitalk-pp-chip">{{ p }}</span>
                        </div>
                      </div>
                    </div>
                    <!-- 询盘分类徽章 -->
                    <div v-if="msg.content.inquiryType" class="aitalk-inquiry-badge" :class="'inq-'+inqTypeClass(msg.content.inquiryType.category)">
                      <span class="inq-cat-prefix">🏷️ 询盘类型</span>
                      <span class="inq-cat-sep"></span>
                      <span class="inq-cat-icon">{{ inqTypeIcon(msg.content.inquiryType.category) }}</span>
                      <span class="inq-cat-label">{{ msg.content.inquiryType.label }}</span>
                      <span class="inq-cat-tip">{{ msg.content.inquiryType.tip }}</span>
                    </div>
                    <!-- 场景分析 -->
                    <div v-if="msg.content.analysis" class="aitalk-scene-card">
                      <div class="aitalk-scene-icon">💡</div>
                      <div class="aitalk-scene-body">
                        <div class="aitalk-scene-title">场景分析</div>
                        <div class="aitalk-scene-text" style="white-space:pre-wrap">{{ msg.content.analysis }}</div>
                      </div>
                    </div>
                    <!-- 推荐回复 分隔 -->
                    <div class="aitalk-section-label">推荐回复</div>
                    <div v-for="(r, idx) in msg.content.replies" :key="'r-'+idx" class="aitalk-reply-card-v2">
                      <div class="aitalk-reply-num">#{{ idx + 1 }}</div>
                      <div class="aitalk-reply-head">
                        <span class="aitalk-reply-name">{{ r.name }}</span>
                        <span class="aitalk-reply-sep"> — </span>
                        <span class="aitalk-reply-desc">{{ r.desc }}</span>
                      </div>
                      <template v-if="!r._editing">
                        <div class="aitalk-reply-foreign" :dir="autoDir(r.foreign)">{{ r.foreign }}</div>
                        <div class="aitalk-reply-chinese">{{ r.chinese }}</div>
                      </template>
                      <template v-else>
                        <textarea class="aitalk-edit-input aitalk-edit-foreign" v-model="r._editForeign" rows="3" placeholder="编辑外文话术（发送版）"></textarea>
                        <textarea class="aitalk-edit-input aitalk-edit-chinese" v-model="r._editChinese" rows="2" placeholder="编辑中文参考"></textarea>
                      </template>
                      <div class="aitalk-reply-actions">
                        <template v-if="!r._editing">
                          <button class="aitalk-mini-btn" @click="copyForeign(r.foreign, $event)">📋 复制外文</button>
                          <button class="aitalk-mini-btn" @click="copyForeign(r.chinese, $event)">📋 复制中文</button>
                          <button class="aitalk-mini-btn aitalk-edit-btn" @click="startEditReply(r)" title="编辑后复制或直接发送">✏️ 编辑</button>
                        </template>
                        <template v-else>
                          <button class="aitalk-mini-btn aitalk-save-btn" @click="saveEditReply(r)">💾 保存</button>
                          <button class="aitalk-mini-btn" @click="cancelEditReply(r)">↩️ 取消</button>
                        </template>
                      </div>
                      <button v-if="!r._editing" class="aitalk-use-btn" :class="{done: r._applied}" @click="useForeignReply(r, $event)">
                        {{ r._applied ? '✓ 已填入输入框' : '✏️ 点这里直接用' }}
                      </button>
                    </div>
                    <!-- 话术设计思路 -->
                    <div v-if="Array.isArray(msg.content.designThinking) && msg.content.designThinking.length" class="aitalk-design-block">
                      <div class="aitalk-section-label">话术设计思路</div>
                      <div class="aitalk-design-table">
                        <div v-for="(row, ri) in msg.content.designThinking" :key="'dt-'+ri" class="aitalk-design-row">
                          <div class="aitalk-design-psych">{{ row.customerPsych }}</div>
                          <div class="aitalk-design-strategy">{{ row.strategy }}</div>
                        </div>
                      </div>
                    </div>
                    <!-- 补充建议 -->
                    <div v-if="Array.isArray(msg.content.suggestions) && msg.content.suggestions.length" class="aitalk-suggest-block">
                      <div class="aitalk-section-label">补充建议</div>
                      <ul class="aitalk-suggest-list">
                        <li v-for="(s, si) in msg.content.suggestions" :key="'sg-'+si">{{ s }}</li>
                      </ul>
                    </div>
                    <!-- 底部提示 -->
                    <div class="aitalk-footer-hint">💡 如果需要我帮你润色得更简短或更口语化，请切换到对话模式告诉我</div>
                    <!-- 优化反馈区 -->
                    <div class="aitalk-refine-block">
                      <div class="aitalk-refine-title">😕 不满意？告诉AI哪里需要改进：</div>
                      <div class="aitalk-refine-chips">
                        <button
                          v-for="chip in REFINE_CHIPS" :key="chip"
                          class="aitalk-refine-chip"
                          :class="{active: (msg._refineChips||[]).includes(chip)}"
                          @click="toggleRefineChip(msg, chip)"
                        >{{ chip }}</button>
                      </div>
                      <textarea
                        v-model="msg._refineText"
                        class="aitalk-refine-textarea"
                        placeholder="或者直接输入你的要求，比如：客户说太贵了怎么回 / 想约客户视频看厂 / 语气再客气一点..."
                        rows="2"
                      ></textarea>
                      <button
                        class="aitalk-refine-btn"
                        :disabled="!!msg._refineLoading || aitalkLoading"
                        @click="triggerRefine(msg)"
                      >
                        <span v-if="msg._refineLoading">⏳ AI优化中...</span>
                        <span v-else>✨ 按要求重写</span>
                      </button>
                      <div class="aitalk-refine-hint">💡 提示：可以点上面的标签快速选择，也可以自己输入要求</div>
                    </div>
                  </template>
                  <div v-else class="aitalk-bubble aitalk-bubble-ai" v-html="renderMarkdown(msg.content)"></div>
                  <div v-if="!msg.loading && !msg.error" class="aitalk-msg-time">{{ formatMsgTime(msg.ts) }}</div>
                </div>
              </template>
            </div>

            <button v-if="showScrollDownBtn" class="aitalk-scroll-down" @click="scrollAitalkToBottom(true)">↓</button>

            <div v-if="aitalkError" class="aitalk-error-global">⚠️ {{ aitalkError }}</div>

            <!-- 底部区域 -->
            <div class="aitalk-footer">
              <template v-if="aitalkMode === 'quick'">
                <button
                  class="aitalk-gen-btn"
                  :disabled="aitalkLoading || !chatStore.activeJid"
                  @click="triggerQuickGenerate"
                >
                  <span v-if="aitalkLoading" class="aitalk-spinner">⏳</span>
                  <span v-else>✨</span>
                  <span>{{ aitalkLoading ? 'AI思考中...' : (aiMessages.length ? '✨ 重新生成一版' : '✨ 生成AI回复') }}</span>
                </button>
                <button v-if="aitalkLoading" class="aitalk-stop-btn" @click="stopAitalkGeneration" title="终止本次AI生成">
                  <span class="aitalk-stop-icon">⏹</span><span>终止</span>
                </button>
                <button class="aitalk-switch-mode-link" @click="switchToChatMode">💬 切换到对话模式</button>
              </template>
              <template v-else>
                <div class="aitalk-quick-chips">
                  <button class="aitalk-mini-chip" @click="appendInput('更正式商务一些')">更正式</button>
                  <button class="aitalk-mini-chip" @click="appendInput('更简短直接')">更简洁</button>
                  <button class="aitalk-mini-chip" @click="appendInput('更热情友好')">更热情</button>
                  <button class="aitalk-mini-chip" @click="appendInput('语气更强硬一些，表达我们的立场')">更强硬</button>
                  <button class="aitalk-mini-chip" @click="appendInput('换个角度重新写一版')">换一版</button>
                  <button class="aitalk-mini-chip" @click="appendInput('继续追问客户的具体需求和数量')">追问需求</button>
                  <button class="aitalk-mini-chip" @click="appendInput('翻译成英语')">英语</button>
                  <button class="aitalk-mini-chip" @click="appendInput('翻译成阿拉伯语')">阿拉伯语</button>
                  <button class="aitalk-mini-chip" @click="appendInput('翻译成西班牙语')">西班牙语</button>
                </div>
                <div class="aitalk-input-row">
                  <textarea
                    ref="aitalkInputRef"
                    v-model="aitalkInputText"
                    class="aitalk-textarea"
                    placeholder="和AI对话，让它帮你分析/翻译/优化话术..."
                    rows="1"
                    @keydown="onAitalkInputKeydown"
                    @input="autoGrowAitalkInput"
                  ></textarea>
                  <button v-if="aitalkLoading" class="aitalk-stop-btn aitalk-stop-btn-inline" @click="stopAitalkGeneration" title="终止本次AI生成">
                    <span class="aitalk-stop-icon">⏹</span><span>终止</span>
                  </button>
                  <button class="aitalk-send-btn" :disabled="!aitalkInputText.trim() || aitalkLoading || !chatStore.activeJid" @click="sendAitalkChat">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
                  </button>
                </div>
                <button class="aitalk-switch-mode-link" @click="aitalkMode = 'quick'">⚡ 切换到快捷生成</button>
              </template>
            </div>
            </template>

            <!-- 📚 话术库 Tab -->
            <div v-if="aitalkTab==='library'" class="speechlib-panel">
              <!-- 智能匹配区 -->
              <div class="speechlib-match-section">
                <div class="speechlib-match-header">
                  <span class="speechlib-match-title">🎯 智能匹配</span>
                  <button class="speechlib-match-btn" :disabled="speechLibLoading || !currentChannelHasContext()" @click="smartMatchSpeech">
                    {{ speechLibLoading ? '匹配中...' : '匹配当前客户' }}
                  </button>
                </div>
                <div v-if="speechLibMatched.length" class="speechlib-match-list">
                  <div v-for="(s, si) in speechLibMatched" :key="'m-'+si" class="speechlib-card">
                    <span class="speechlib-source-badge" :class="'src-' + (s.source || 'message_sample')">{{ s.sourceLabel || '话术库' }}</span>
                    <template v-if="s.source === 'community'">
                      <div class="speechlib-card-q">📌 {{ s.title }}</div>
                      <div class="speechlib-card-a">💡 {{ s.content }}</div>
                    </template>
                    <template v-else-if="s.source === 'qa'">
                      <div class="speechlib-card-q">❓ {{ s.question }}</div>
                      <div class="speechlib-card-a">💡 {{ s.answer }}</div>
                    </template>
                    <template v-else>
                      <div class="speechlib-card-q">🗣 {{ s.customerMsg }}</div>
                      <div class="speechlib-card-a">💡 {{ s.salesReply }}</div>
                    </template>
                    <div class="speechlib-card-meta">
                      <span v-if="s.scene" class="speechlib-tag">{{ s.scene }}</span>
                      <span v-if="s.industry" class="speechlib-tag">{{ s.industry }}</span>
                      <span v-if="s.productLine" class="speechlib-tag">{{ s.productLine }}</span>
                      <span v-if="s.source === 'message_sample' && s.qualityScore" class="speechlib-tag speechlib-tag-score">⭐{{ s.qualityScore }}</span>
                    </div>
                    <button class="speechlib-copy-btn" @click="copySpeechReply(s.salesReply || s.content || s.answer)">📋 复制回复</button>
                  </div>
                </div>
                <div v-else-if="!speechLibLoading && speechLibSearched" class="speechlib-empty">
                  <p>未找到匹配话术</p>
                </div>
                <div v-else-if="!currentChannelHasContext()" class="speechlib-empty">
                  <p>请先选择客户会话</p>
                </div>
              </div>

              <!-- 话术列表 -->
              <div class="speechlib-list-section">
                <div class="speechlib-list-header">
                  <span class="speechlib-list-title">📋 全部话术 ({{ speechLibTotal }})</span>
                  <button class="speechlib-refresh-btn" @click="loadSpeechSamples()" title="刷新">⟳</button>
                </div>
                <div v-if="speechLibLoading && !speechLibMatched.length" class="speechlib-loading">加载中...</div>
                <div v-else-if="speechLibSamples.length" class="speechlib-sample-list">
                  <div v-for="(s, si) in speechLibSamples" :key="'s-'+si" class="speechlib-card speechlib-card-compact">
                    <div class="speechlib-card-q">🗣 {{ s.customerMsg }}</div>
                    <div class="speechlib-card-a">💡 {{ s.salesReply }}</div>
                    <div class="speechlib-card-meta">
                      <span v-if="s.scene" class="speechlib-tag">{{ s.scene }}</span>
                      <span v-if="s.productLine" class="speechlib-tag">{{ s.productLine }}</span>
                      <span v-if="s.favorited" class="speechlib-tag speechlib-tag-fav">⭐ 收藏</span>
                    </div>
                    <button class="speechlib-copy-btn" @click="copySpeechReply(s.salesReply)">📋 复制</button>
                  </div>
                </div>
                <div v-else class="speechlib-empty">
                  <div style="font-size:32px;margin-bottom:8px;opacity:0.6">📚</div>
                  <p>暂无话术</p>
                  <p style="font-size:12px;color:var(--text-secondary);margin-top:4px">使用AI生成回复后将自动收藏</p>
                </div>
              </div>
            </div>

          </div>
          <div v-if="!panelCollapsed && activePanel === 'customer'" class="customer-panel-body">
            <!-- 空状态 -->
            <div v-if="!chatStore.activeJid" class="customer-empty">
              <div style="font-size:48px;margin-bottom:12px">👤</div>
              <div style="color:#8696a0;font-size:13px">请先选择一个客户会话</div>
            </div>
            <template v-else>
              <!-- 客户头部 Hero -->
              <div class="customer-header">
                <div class="customer-avatar customer-hero-avatar">
                  <img v-if="chatStore.activeJid && !chatStore.avatarFailed[chatStore.activeJid]"
                    :src="chatStore.loadAvatar(chatStore.activeJid)"
                    @error="chatStore.markAvatarFailed(chatStore.activeJid)"
                    class="customer-hero-img" alt="" />
                  <span v-else class="customer-hero-fallback">{{ (customerData.contactName || customerData.name || customerData.phone || chatStore.activeJid || '?')[0] }}</span>
                </div>
                <div class="customer-head-info">
                  <div class="customer-head-name">{{ customerData.contactName || customerData.name || customerData.phone || chatStore.activeJid }}</div>
                  <div v-if="customerData.companyName" class="customer-head-company">🏢 {{ customerData.companyName }}</div>
                  <div class="customer-head-jid">{{ customerData.jid || chatStore.activeJid }}</div>
                </div>
                <div class="customer-head-actions">
                  <span class="source-tag" :class="'src-' + customerSourceKey(customerData)">{{ customerSourceIcon(customerData) }} {{ customerSourceLabel(customerData) }}</span>
                  <span class="customer-level-tag" :class="'lv-' + (customerData.customerLevel || 'C')">{{ levelLabel(customerData.customerLevel || 'C') }}</span>
                </div>
              </div>

              <!-- Tab 切换条 -->
              <div class="profile-tabs">
                <button v-for="t in PROFILE_TABS" :key="t.key" class="profile-tab" :class="{active: customerTab===t.key}" @click="customerTab=t.key">
                  <span class="profile-tab-ic">{{ t.icon }}</span>
                  <span class="profile-tab-lb">{{ t.label }}</span>
                </button>
              </div>

              <!-- 可滚动内容区 -->
              <div class="profile-scroll">

                <!-- 📋 基本信息 Tab -->
                <div v-if="customerTab==='basic'" class="profile-tab-pane">
                  <!-- AI抽取结果预览 -->
                  <div v-if="customerExtractResult" class="customer-extract-card">
                    <div class="customer-extract-head">
                      <span style="color:#00a884;font-weight:700;font-size:14px">🔍 AI识别结果</span>
                      <button class="customer-extract-close" @click="customerExtractResult = null">✕</button>
                    </div>
                    <div class="customer-extract-fields">
                      <div v-for="(val, key) in customerExtractResult" :key="key" class="customer-extract-row" v-show="val">
                        <span class="customer-extract-label">{{ CUSTOMER_FIELD_LABELS[key] || key }}</span>
                        <span class="customer-extract-val">{{ val }}</span>
                        <button v-if="!customerData[key]" class="customer-extract-adopt" @click="adoptExtractField(key, val)">✓ 采用</button>
                        <span v-else class="customer-extract-exists">已填</span>
                      </div>
                    </div>
                    <div class="customer-extract-footer">
                      <button class="customer-btn-primary" @click="adoptExtractAll">全部采用</button>
                      <button class="customer-btn-ghost" @click="customerExtractResult = null">关闭</button>
                    </div>
                  </div>

                  <!-- 字段列表 -->
                  <div class="customer-fields">
                    <template v-for="f in CUSTOMER_FIELDS" :key="f.key">
                      <div class="customer-field" :class="{ warn: f.warnIfEmpty && !customerData[f.key] && !customerEditMode }">
                        <div class="customer-field-label">
                          {{ f.label }}
                          <span v-if="f.required" class="customer-required">*</span>
                        </div>
                        <template v-if="!customerEditMode || f.readonly">
                          <div class="customer-field-value" :class="{ empty: !formatField(customerData, f) }">
                            <template v-if="f.key === 'customerLevel'">
                              <span class="customer-level-tag" :class="'lv-' + (customerData.customerLevel || 'C')">{{ levelLabel(customerData.customerLevel || 'C') }}</span>
                            </template>
                            <template v-else-if="f.key === 'source'">
                              <span class="source-tag" :class="'src-' + customerSourceKey(customerData)">{{ customerSourceIcon(customerData) }} {{ customerSourceLabel(customerData) }}</span>
                            </template>
                            <template v-else>
                              {{ formatField(customerData, f) || '未填写' }}
                            </template>
                          </div>
                        </template>
                        <template v-else>
                          <el-select v-if="f.type === 'select'" v-model="customerData[f.key]" class="customer-input" popper-class="crm-dark-popper" :placeholder="'请选择'">
                            <el-option v-for="opt in f.options" :key="opt.value" :label="opt.label" :value="opt.value" />
                          </el-select>
                          <el-input v-else-if="f.type === 'textarea'" v-model="customerData[f.key]" class="customer-input" type="textarea" :autosize="{minRows:2,maxRows:5}" :placeholder="'请输入' + f.label" />
                          <el-input v-else v-model="customerData[f.key]" class="customer-input" :placeholder="'请输入' + f.label" />
                        </template>
                      </div>
                    </template>
                  </div>

                  <!-- 编辑模式底部按钮 -->
                  <div v-if="customerEditMode" class="customer-footer">
                    <button class="customer-btn-ghost" @click="cancelCustomerEdit">取消</button>
                    <button class="customer-btn-primary" @click="saveCustomer" :disabled="customerSaving">💾 保存</button>
                  </div>
                </div>

                <!-- 🎯 需求 Tab -->
                <div v-if="customerTab==='requirement'" class="profile-tab-pane">
                  <div class="profile-section-hint">记录客户的产品意向、预算、数量和交期信息</div>
                  <div class="customer-fields">
                    <template v-for="f in REQUIREMENT_FIELDS_DEF" :key="f.key">
                      <div class="customer-field">
                        <div class="customer-field-label">
                          {{ f.icon }} {{ f.label }}
                        </div>
                        <template v-if="!customerEditMode">
                          <div class="customer-field-value" :class="{ empty: !customerData[f.key] }">
                            {{ customerData[f.key] || '未填写' }}
                          </div>
                        </template>
                        <template v-else>
                          <el-input v-if="f.type === 'textarea'" v-model="customerData[f.key]" class="customer-input" type="textarea" :autosize="{minRows:2,maxRows:5}" :placeholder="'请输入' + f.label" />
                          <el-input v-else v-model="customerData[f.key]" class="customer-input" :placeholder="'请输入' + f.label" />
                        </template>
                      </div>
                    </template>
                  </div>
                  <div v-if="customerEditMode" class="customer-footer">
                    <button class="customer-btn-ghost" @click="cancelCustomerEdit">取消</button>
                    <button class="customer-btn-primary" @click="saveCustomer" :disabled="customerSaving">💾 保存</button>
                  </div>
                  <!-- 📝 需求总结字段：结构化渲染JSON，纯文本兜底 -->
                  <div class="customer-field">
                    <div class="customer-field-label">📝 需求总结</div>
                    <template v-if="!customerEditMode">
                      <!-- JSON 结构化卡片 -->
                      <div v-if="profileReqIsJson" class="req-cards">
                        <div v-for="(sec, si) in profileReqSections" :key="si" class="req-card">
                          <div class="req-card-head">
                            <span class="req-card-icon">{{ sec.icon || '📋' }}</span>
                            <span class="req-card-title">{{ sec.title || '信息' }}</span>
                          </div>
                          <div class="req-card-body">
                            <table v-if="sec.type === 'table' && sec._parsedRows" class="req-kv-table">
                              <tr v-for="(row, ri) in sec._parsedRows" :key="ri">
                                <td class="kv-label">{{ row.label }}</td>
                                <td class="kv-value">{{ row.value }}</td>
                              </tr>
                            </table>
                            <ul v-else-if="sec.type === 'list' && sec._parsedItems" class="req-list">
                              <li v-for="(it, ii) in sec._parsedItems" :key="ii">
                                <span class="req-list-badge">{{ ii + 1 }}</span>
                                <span class="req-list-text">
                                  <strong v-if="it.title" class="req-list-title">{{ it.title }}</strong>
                                  <span v-if="it.desc">{{ it.title ? '：' : '' }}{{ it.desc }}</span>
                                </span>
                              </li>
                            </ul>
                            <div v-else class="req-text">{{ sec.content || '' }}</div>
                          </div>
                        </div>
                      </div>
                      <!-- 空值或纯文本 -->
                      <div v-else class="customer-field-value" :class="{ empty: !customerData.requirementSummary }">
                        {{ displayReqSummaryRaw() }}
                      </div>
                    </template>
                    <template v-else>
                      <el-input v-model="customerData.requirementSummary" class="customer-input" type="textarea" :autosize="{minRows:3,maxRows:8}" placeholder="AI自动生成的需求总结（JSON或纯文本）" />
                    </template>
                  </div>
                  <div v-if="!customerEditMode" class="customer-footer">
                    <button class="customer-btn-ghost" @click="enterCustomerEdit">✏️ 编辑需求</button>
                  </div>
                </div>

                <!-- 📝 跟进记录 Tab -->
                <div v-if="customerTab==='followups'" class="profile-tab-pane">
                  <div class="profile-section-hint">最近跟进记录（最多5条）</div>
                  <div v-if="followUpsLoading" class="profile-loading">{{ followUpGenerating ? '🤖 正在自动总结聊天记录，生成跟进...' : '加载中...' }}</div>
                  <div v-else-if="!followUpsList.length" class="profile-empty">
                    <div style="font-size:32px;margin-bottom:6px">📝</div>
                    <div style="color:var(--text-secondary);font-size:13px;margin-bottom:10px">暂无跟进记录</div>
                  </div>
                  <div v-else class="followup-list">
                    <div v-for="fu in followUpsList.slice(0,5)" :key="fu.id" class="followup-item">
                      <div class="followup-time">{{ formatFuTime(fu.createdAt) }}</div>
                      <div class="followup-content">{{ fu.content }}</div>
                    </div>
                  </div>
                  <!-- 快速添加 -->
                  <div class="followup-add">
                    <el-input v-model="newFollowUpContent" class="customer-input" type="textarea" :autosize="{minRows:2,maxRows:4}" placeholder="记录本次跟进内容，例如：客户要求提供PI，已发送..." />
                    <button class="customer-btn-primary followup-add-btn" @click="addFollowUp" :disabled="!newFollowUpContent.trim() || followUpSaving">
                      {{ followUpSaving ? '⏳ 保存中' : '➕ 添加跟进' }}
                    </button>
                  </div>
                </div>

              </div><!-- /.profile-scroll -->
            </template>
          </div>

                    <!-- 🔍 客户背调独立面板 -->
          <div v-if="!panelCollapsed && activePanel === 'bgcheck'" class="customer-panel-body bgcheck-panel-body">
            <div v-if="!chatStore.activeJid" class="customer-empty">
              <div style="font-size:48px;margin-bottom:12px">🔍</div>
              <div style="color:#8696a0;font-size:13px">请先选择一个客户会话</div>
            </div>
            <template v-else>
              <div class="bgcheck-content">
                <div class="profile-section-hint">背调客户背景、公司资质与风险评级，一键生成背调报告</div>
                <div class="customer-bg-btn-wrap">
                  <button class="customer-bg-btn" @click="runBgCheck" :disabled="bgCheckLoading">
                    {{ bgCheckLoading ? '🔍 背调进行中...' : (customerData.bgReport ? '🔄 重新背调' : '🚀 开始背调') }}
                  </button>
                  <div v-if="customerData.bgUpdatedAt" class="bg-check-time">上次背调：{{ formatBgTime(customerData.bgUpdatedAt) }}</div>
                </div>
                <div v-if="bgCheckReport || customerData.bgReport" class="bg-report-card">
                  <div class="bg-report-head">
                    <span style="color:#00a884;font-weight:700;font-size:14px">📋 客户背调报告</span>
                    <button v-if="bgCheckReport || customerData.bgReport" class="view-360-btn" @click="$router.push('/background-report?jid=' + encodeURIComponent(activeJid))">📊 查看360°报告</button>
                  </div>
                  <div class="bg-report-body">
                    <p v-for="(para, pi) in (bgCheckReport || customerData.bgReport || '').split('\n')" :key="pi" :class="{'bg-report-empty': !para.trim()}">{{ para }}</p>
                  </div>
                  <div v-if="bgMissingInfo.length" class="bg-report-footer">
                    <div class="bg-missing-tip">ℹ️ 还缺少以下信息：<span class="bg-missing-tags">{{ bgMissingInfo.filter(m => !m.includes('联网搜索')).join('、') }}</span></div>
                    <button class="customer-bg-btn bg-ask-btn" @click="bgInsertAskReply" :disabled="bgAskInserted">
                      {{ bgAskInserted ? '✅ 已填入输入框' : '🤖 生成询问客户信息话术' }}
                    </button>
                  </div>
                </div>
                <div v-else-if="!bgCheckLoading" class="profile-empty">
                  <div style="font-size:32px;margin-bottom:6px">🔍</div>
                  <div style="color:var(--text-secondary);font-size:13px">点击上方按钮开始客户背调</div>
                </div>
              </div>
            </template>
          </div>

          <!-- 🎯 需求总结面板 -->
          <div v-if="!panelCollapsed && activePanel === 'requirement'" class="req-panel-body">
            <div v-if="!chatStore.activeJid" class="customer-empty">
              <div style="font-size:48px;margin-bottom:12px">🎯</div>
              <div style="color:#8696a0;font-size:13px">请先选择一个客户会话</div>
            </div>
            <template v-else>
              <div class="req-alert" v-if="reqAiHint">
                <span style="color:#f59e0b">🤖 {{ reqAiHint }}</span>
              </div>
              <div class="req-fields">
                <div v-if="reqSections.length === 0" class="req-empty-hint">
                  <div style="font-size:40px;margin-bottom:8px">🎯</div>
                  <div>点击下方按钮，AI自动分析客户沟通记录</div>
                  <div style="font-size:12px;color:#5a6a75;margin-top:4px">生成8大板块结构化需求报告</div>
                </div>
                <div v-else class="req-cards">
                  <div v-for="(sec, idx) in reqSections" :key="idx" class="req-card">
                    <div class="req-card-head">
                      <span class="req-card-icon">{{ sec.icon }}</span>
                      <span class="req-card-title">{{ sec.title }}</span>
                    </div>
                    <div class="req-card-body">
                      <table v-if="sec.type === 'table'" class="req-kv-table">
                        <tr v-for="(row, ri) in sec.rows" :key="ri">
                          <td class="kv-label">{{ row.label }}</td>
                          <td class="kv-value">{{ row.value }}</td>
                        </tr>
                      </table>
                      <ul v-else-if="sec.type === 'list'" class="req-list">
                        <li v-for="(it, li) in sec.items" :key="li">
                          <span class="req-list-badge">{{ li + 1 }}</span>
                          <span class="req-list-text">
                            <strong v-if="it.title" class="req-list-title">{{ it.title }}</strong>
                            <span v-if="it.desc">{{ it.title ? '：' : '' }}{{ it.desc }}</span>
                          </span>
                        </li>
                      </ul>
                      <div v-else-if="sec.type === 'text'" class="req-text">{{ sec.content }}</div>
                    </div>
                  </div>
                </div>
                <div class="customer-footer req-footer-center">
                  <button class="customer-btn-primary req-big-btn" @click="runReqAiAnalyze" :disabled="reqAiLoading">
                    {{ reqAiLoading ? '⏳ AI分析中，请稍候...' : (reqSections.length ? '🔄 重新分析' : '🤖 一键AI客户分析') }}
                  </button>
                </div>
              </div>
            </template>
          </div>

          <!-- 📄 客户单证面板（快捷生成 v2） -->
          <div v-if="!panelCollapsed && activePanel === 'documents'" class="doc-panel-body doc-panel-v2">
            <div v-if="!chatStore.activeJid" class="customer-empty">
              <div style="font-size:48px;margin-bottom:12px">📄</div>
              <div style="color:#8696a0;font-size:13px">请先选择一个客户会话</div>
            </div>
            <template v-else>
              <!-- 客户头部 -->
              <div class="customer-header">
                <div class="customer-avatar" style="background:#00a88430;color:#00a884">{{ (customerData.contactName || customerData.name || customerData.phone || chatStore.activeJid || '?')[0] }}</div>
                <div class="customer-head-info">
                  <div class="customer-head-name">{{ customerData.contactName || customerData.name || customerData.phone || chatStore.activeJid }}</div>
                  <div class="customer-head-jid" style="color:#8696a0;font-size:11px">🤖 AI 快捷单证 · 一键生成</div>
                </div>
                <button class="doc-new-formal-btn" @click="newDoc('QUOTATION')" title="新建正式单证（跳转编辑器）">＋</button>
              </div>

              <!-- 单证类型选择区（未生成态 / 换类型展开时显示） -->
              <template v-if="!docGenerated || showTypeSwitcher">
                <div class="doc-type-chips-wrap">
                  <div class="doc-type-chips">
                    <button
                      v-for="t in DOC_TYPES" :key="t.key"
                      class="doc-type-chip"
                      :class="{ active: selectedDocType === t.key }"
                      @click="selectedDocType = t.key; if (showTypeSwitcher) { switchDocTypeFromCompact(t); } else { resetDocPanel(); }"
                    >
                      <span class="doc-type-chip-icon">{{ t.icon }}</span>
                      <span class="doc-type-chip-label">{{ t.label }}</span>
                    </button>
                  </div>
                </div>
              </template>

              <!-- 已生成态：紧凑顶栏（类型chip+语言+换类型+重生成） -->
              <template v-if="docGenerated && !showTypeSwitcher">
                <div class="doc-compact-bar">
                  <span class="doc-current-chip" :class="{active: true}">
                    <span class="doc-chip-ic">{{ docCurrentTypeMeta.icon }}</span>
                    <span>{{ docCurrentTypeMeta.label }}</span>
                  </span>
                  <button class="doc-compact-act doc-lang-btn" @click="toggleLangPicker" :class="{open: showLangPicker}">
                    🌐 {{ currentDocLangMeta.emoji }} {{ docLang === 'zh' ? '中文' : currentDocLangMeta.label.slice(0,2).toUpperCase() }} ▾
                  </button>
                  <div class="doc-compact-spacer"></div>
                  <button class="doc-compact-act" @click="toggleTypeSwitcher">⇄ 换类型</button>
                  <button class="doc-compact-act doc-compact-act-danger" @click="restartDocAll">🗑️</button>
                </div>
                <!-- 语言选择浮层 -->
                <transition name="doc-pop">
                  <div v-if="showLangPicker" class="doc-lang-picker">
                    <div
                      v-for="l in DOC_LANGS" :key="l.code"
                      class="doc-lang-option"
                      :class="{active: l.code === docLang}"
                      @click="switchDocLang(l)"
                    >
                      <span class="doc-lang-emoji">{{ l.emoji }}</span>
                      <span>{{ l.label }}</span>
                      <span v-if="l.code === docLang" class="doc-lang-check">✓</span>
                    </div>
                  </div>
                </transition>
              </template>

              <!-- 模式切换（仅未生成态显示） -->
              <div v-if="!docGenerated" class="doc-mode-bar">
                <button class="doc-mode-btn" :class="{active: docMode === 'quick'}" @click="switchDocMode('quick')">
                  <span>⚡</span><span>快捷生成</span>
                </button>
                <button class="doc-mode-btn" :class="{active: docMode === 'chat'}" @click="switchDocMode('chat')">
                  <span>💬</span><span>描述修改</span>
                </button>
              </div>

              <!-- 结果/对话滚动区（全屏让给预览区） -->
              <div ref="docScrollRef" class="doc-result-scroll" :class="{'doc-generated-view': docGenerated}">
                <!-- 空态（未生成，quick模式无结果且未加载） -->
                <div v-if="!docGenerated && docMode === 'quick' && docMessages.length === 0 && !docQLoading && !docError" class="doc-empty">
                  <div class="doc-empty-icon">📄</div>
                  <div class="doc-empty-title">{{ docCurrentTypeMeta.label }} · 一键生成</div>
                  <div class="doc-empty-sub">AI根据最近沟通记录自动生成专业外贸{{ docCurrentTypeMeta.label }}</div>
                </div>
                <!-- 错误 -->
                <div v-if="docError" class="doc-error-block">
                  <div class="doc-error-text">❌ {{ docError }}</div>
                </div>

                <!-- Quick / Chat 消息列表（非编辑态） -->
                <template v-if="!docEditing">
                  <template v-for="(m, mi) in docMessages" :key="'dm-'+mi">
                    <!-- user message (chat mode 或 编辑后重生成) -->
                    <div v-if="m.role==='user'" class="doc-msg doc-msg-user">
                      <div class="doc-user-bubble" v-html="renderMarkdown(m.content)"></div>
                      <div class="doc-msg-time">{{ new Date(m.ts).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'}) }}</div>
                    </div>
                    <!-- assistant loading -->
                    <div v-else-if="m.loading" class="doc-typing-card">
                      <div class="doc-ai-bubble doc-loading-bubble">
                        <span class="aitalk-dot"></span><span class="aitalk-dot"></span><span class="aitalk-dot"></span>
                      </div>
                      <div class="doc-typing-text">AI正在生成{{ docLang !== 'zh' ? docLangLabel : currentDocLabel }}…</div>
                    </div>
                    <!-- assistant doc card (最新一张在已生成态下作为主预览) -->
                    <div v-else-if="m.role==='assistant' && m.content" class="doc-result-outer" :class="{'doc-main-preview': docGenerated && m === latestDoc}">
                      <div v-if="m.version && m.version > 1" class="doc-version-tag">#{{ m.version }} 修改版</div>
                      <div class="doc-result-card">
                        <div class="doc-result-head">
                          <span class="doc-result-type-tag">AI {{ (m.typeMeta || docCurrentTypeMeta).icon }} {{ (m.typeMeta || docCurrentTypeMeta).label }}<span v-if="docLang !== 'zh'" class="doc-lang-tag"> · {{ docLangLabel }}</span></span>
                          <div class="doc-result-head-actions">
                            <span v-if="m._saved" class="doc-saved-badge">✅ 已保存</span>
                            <span class="doc-result-time">{{ new Date(m.ts).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'}) }}</span>
                            <button class="doc-head-icon-btn" @click="copyDocText(m.content, $event)" title="复制全文">📋</button>
                            <button class="doc-head-icon-btn" @click="downloadDocResult(m, $event)" title="下载PDF" :disabled="pdfDownloading">
                              <span v-if="pdfDownloading">⏳</span><span v-else>⬇️</span>
                            </button>
                            <button class="doc-head-icon-btn doc-head-icon-btn-primary" @click="sendDocPdf(m)" title="PDF发给客户" :disabled="pdfSending">
                              <span v-if="pdfSending">⏳</span><span v-else>📄</span>
                            </button>
                          </div>
                        </div>
                        <div class="doc-result-body-wrap" :class="{'doc-collapsed': !m.expanded && !(docGenerated && m === latestDoc)}">
                          <div class="doc-result-body markdown-body">
                            <template v-if="splitDocSections(m.content).title">
                              <div class="doc-doc-title">{{ splitDocSections(m.content).title }}</div>
                            </template>
                            <div v-for="(sec, si) in splitDocSections(m.content).sections" :key="'sec-'+mi+'-'+si" class="doc-section-card">
                              <div class="doc-section-head">
                                <span class="doc-section-icon">{{ sec.icon }}</span>
                                <span class="doc-section-title">{{ sec.title }}</span>
                              </div>
                              <div class="doc-section-body" v-html="sec.bodyHtml"></div>
                            </div>
                          </div>
                          <div v-if="!m.expanded && !(docGenerated && m === latestDoc)" class="doc-fade-mask"></div>
                        </div>
                        <button v-if="!(docGenerated && m === latestDoc)" class="doc-expand-btn" @click="toggleDocExpand(m)">
                          {{ m.expanded ? '收起 ▲' : '查看全文 ▼' }}
                        </button>
                        <!-- 底部操作区（主预览卡片显示更丰富操作） -->
                        <div v-if="docGenerated && m === latestDoc" class="doc-result-bottom-actions doc-main-bottom">
                          <button class="doc-act-sec" @click="enterDocEdit(m)" :disabled="docChatLoading || docQLoading">✏️ 直接编辑</button>
                          <button class="doc-act-sec" @click="switchDocMode('chat'); showLangPicker=false" :disabled="docChatLoading || docQLoading">💬 描述修改</button>
                          <button class="doc-act-sec" :class="{saved: m._saved}" @click="saveDocLocal(m, $event)" :disabled="m._saving">
                            <span v-if="m._saving">⏳</span>
                            <span v-else-if="m._saved">✅ 已保存</span>
                            <span v-else>💾 保存</span>
                          </button>
                          <button class="doc-act-primary" @click="sendDocPdf(m)" :disabled="pdfSending">
                            <span v-if="pdfSending">⏳ 发送中...</span>
                            <span v-else>📄 PDF发给客户</span>
                          </button>
                        </div>
                        <!-- 非主预览的历史版本用精简操作 -->
                        <div v-else class="doc-result-bottom-actions">
                          <button class="doc-act-sec" @click="refineDocInline(m)">✏️ 修改</button>
                          <button class="doc-act-sec" :class="{saved: m._saved}" @click="saveDocLocal(m, $event)" :disabled="m._saving">
                            <span v-if="m._saving">⏳</span>
                            <span v-else-if="m._saved">✅</span>
                            <span v-else>💾</span>
                          </button>
                          <button class="doc-act-primary" @click="m.expanded=true; nextTick(()=>{ const idx=docMessages.indexOf(m); Object.assign(latestDoc||{}, {}); docMessages.value = [...docMessages.value.slice(0,idx+1)]; docGenerated.value = true; });">👁 采用此版本</button>
                        </div>
                      </div>
                    </div>
                  </template>
                </template>

                <!-- ✏️ 直接编辑态 -->
                <div v-if="docEditing" class="doc-edit-wrap">
                  <div class="doc-edit-header">
                    <span>✏️ 编辑中…直接修改下面的内容，点应用修改让AI整理</span>
                  </div>
                  <textarea
                    ref="docEditTextarea"
                    v-model="docEditText"
                    class="doc-edit-textarea"
                    placeholder="直接编辑单证内容..."
                  ></textarea>
                  <div class="doc-edit-footer">
                    <button class="doc-edit-cancel" @click="cancelDocEdit" :disabled="docChatLoading">取消</button>
                    <button class="doc-edit-apply" @click="applyDocEdit" :disabled="docChatLoading || !docEditText.trim()">
                      <span v-if="docChatLoading">⏳ AI整理中...</span>
                      <span v-else>✅ 应用修改</span>
                    </button>
                  </div>
                </div>

                <!-- Quick 模式 loading state (未生成态) -->
                <div v-if="!docGenerated && docMode === 'quick' && docQLoading && docMessages.length === 0" class="doc-typing-card">
                  <div class="doc-ai-bubble doc-loading-bubble">
                    <span class="aitalk-dot"></span><span class="aitalk-dot"></span><span class="aitalk-dot"></span>
                  </div>
                  <div class="doc-typing-text">AI正在生成{{ currentDocLabel }}…</div>
                </div>
              </div>

              <!-- 底部操作区（仅未生成态显示；已生成态隐藏让出空间） -->
              <div v-if="!docGenerated" class="doc-footer">
                <template v-if="docMode === 'quick'">
                  <button
                    class="doc-gen-btn"
                    :disabled="docQLoading || !chatStore.activeJid"
                    @click="runDocGenerate"
                  >
                    <span v-if="docQLoading">⏳ 生成中...</span>
                    <span v-else>✨ 一键生成{{ currentDocLabel }}</span>
                  </button>
                  <button class="doc-switch-link" @click="switchDocMode('chat')">💬 用对话补充需求</button>
                </template>
                <template v-else>
                  <div class="doc-input-row">
                    <textarea
                      ref="docInputRef"
                      v-model="docInputText"
                      class="doc-textarea"
                      placeholder="告诉AI如何修改，例如：把价格改成FOB Shanghai / 总金额改成USD 5000 / 增加MOQ条款…"
                      rows="1"
                      @keydown="onDocInputKeydown"
                    ></textarea>
                    <button class="doc-send-btn" :disabled="!docInputText.trim() || docChatLoading" @click="sendDocChat">
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
                    </button>
                  </div>
                  <button class="doc-switch-link" @click="switchDocMode('quick')">⚡ 回到快捷生成</button>
                </template>
              </div>

              <!-- 已生成态也可以在底部留一个对话输入条（仅对话模式展开时显示） -->
              <div v-if="docGenerated && docMode === 'chat' && !docEditing" class="doc-footer doc-footer-compact">
                <div class="doc-input-row">
                  <textarea
                    ref="docInputRef"
                    v-model="docInputText"
                    class="doc-textarea"
                    placeholder="继续告诉AI修改要求..."
                    rows="1"
                    @keydown="onDocInputKeydown"
                  ></textarea>
                  <button class="doc-send-btn" :disabled="!docInputText.trim() || docChatLoading" @click="sendDocChat">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
                  </button>
                </div>
              </div>

              <!-- 历史单证折叠区 -->
              <details class="doc-history-details">
                <summary class="doc-history-summary">
                  <span>📚 历史单证</span>
                  <span class="doc-history-count">{{ docList.length }}份</span>
                  <span class="doc-history-actions">
                    <button class="doc-history-new" @click.stop="newDoc('QUOTATION')">＋新建</button>
                  </span>
                </summary>
                <div class="doc-history-body">
                  <div v-if="docList.length === 0" class="doc-history-empty">暂无历史单证</div>
                  <div v-else class="doc-card-list">
                    <div v-for="d in docList" :key="d.id" class="doc-card">
                      <div class="doc-card-top">
                        <span class="doc-type-tag" :class="'dt-'+(d.type||'').toLowerCase()">{{ d.type === 'PI' ? 'PI' : (d.type === 'QUOTATION' ? '报价' : (d.type||'')) }}</span>
                        <span class="doc-number">{{ d.docNumber }}</span>
                        <span class="doc-status" :class="'ds-'+(d.status||'draft').toLowerCase()">{{ docStatusLabel(d.status) }}</span>
                      </div>
                      <div class="doc-card-body">
                        <div class="doc-amount">{{ d.currency || 'USD' }} {{ (d.totalAmount||0).toLocaleString() }}</div>
                        <div class="doc-date">{{ d.issueDate ? new Date(d.issueDate).toLocaleDateString('zh-CN') : '' }}</div>
                      </div>
                      <div class="doc-card-actions">
                        <button class="doc-action-btn" @click="router.push('/documents/'+d.id+'/print')">👁 预览</button>
                        <button class="doc-action-btn" @click="router.push('/customers/'+(customerData.id||'')+'/documents/'+d.id+'/edit')">✏️ 编辑</button>
                      </div>
                    </div>
                  </div>
                </div>
              </details>

              <!-- 保留旧弹窗（+按钮跳转编辑器时使用） -->
              <div class="doc-type-dialog" v-if="openAiDocDialog" @click.self="openAiDocDialog=false">
                <div class="doc-type-card">
                  <div style="font-size:15px;font-weight:600;margin-bottom:12px;color:#e9edef">选择单证类型（旧版·跳转编辑器）</div>
                  <button class="doc-type-option" @click="aiGenerateDoc('PI')">
                    <span style="font-size:24px">📋</span>
                    <span style="font-weight:600">PI (Proforma Invoice)</span>
                    <span style="color:#8696a0;font-size:12px">形式发票，用于客户付款，入库保存</span>
                  </button>
                  <button class="doc-type-option" @click="aiGenerateDoc('QUOTATION')">
                    <span style="font-size:24px">💰</span>
                    <span style="font-weight:600">Quotation 报价单</span>
                    <span style="color:#8696a0;font-size:12px">报价单，入库保存</span>
                  </button>
                  <button class="doc-type-cancel" @click="openAiDocDialog=false">取消</button>
                </div>
              </div>
            </template>
          </div>

          <!-- 翻译设置面板 -->
          <div v-if="!panelCollapsed && activePanel === 'translate'" class="trans-panel-body">
            <div class="trans-panel">
              <!-- 接收翻译设置块 -->
              <div class="trans-block">
                <div class="switch-row">
                  <span class="switch-label">接收翻译设置</span>
                  <el-switch v-model="transForm.receiveEnabled" active-color="#00a884" />
                </div>
                <template v-if="transForm.receiveEnabled">
                  <div class="sub-row">
                    <span class="sub-label">翻译线路</span>
                    <el-select v-model="transForm.receiveEngine" class="sub-select" popper-class="crm-dark-popper" placeholder="选择翻译线路">
                      <el-option label="DeepL(推荐)" value="deepl" />
                      <el-option label="DeepSeek" value="deepseek" />
                      <el-option label="豆包AI" value="doubao" />
                      <el-option label="GPT-5.6" value="openai" />
                    </el-select>
                  </div>
                  <div class="sub-row">
                    <span class="sub-label">源语言</span>
                    <el-select v-model="transForm.receiveSourceLang" class="sub-select" popper-class="crm-dark-popper" placeholder="选择源语言" filterable>
                      <el-option v-for="lang in LANG_OPTIONS_WITH_AUTO" :key="lang.value" :label="lang.label" :value="lang.value" />
                    </el-select>
                  </div>
                  <div class="sub-row">
                    <span class="sub-label">目标语言</span>
                    <el-tooltip content="对方消息将被翻译成该语言显示" placement="top" effect="dark">
                      <el-icon class="sub-help"><QuestionFilled /></el-icon>
                    </el-tooltip>
                    <el-select v-model="transForm.receiveTargetLang" class="sub-select" popper-class="crm-dark-popper" placeholder="选择目标语言" filterable>
                      <el-option v-for="lang in LANG_OPTIONS" :key="lang.value" :label="lang.label" :value="lang.value" />
                    </el-select>
                  </div>
                </template>
              </div>
              <!-- 发送翻译设置块 -->
              <div class="trans-block">
                <div class="switch-row">
                  <span class="switch-label">发送翻译设置</span>
                  <el-switch v-model="transForm.sendEnabled" active-color="#00a884" />
                </div>
                <template v-if="transForm.sendEnabled">
                  <div class="sub-row">
                    <span class="sub-label">翻译线路</span>
                    <el-select v-model="transForm.sendEngine" class="sub-select" popper-class="crm-dark-popper" placeholder="选择翻译线路">
                      <el-option label="DeepL(推荐)" value="deepl" />
                      <el-option label="DeepSeek" value="deepseek" />
                      <el-option label="豆包AI" value="doubao" />
                      <el-option label="GPT-5.6" value="openai" />
                    </el-select>
                  </div>
                  <div class="sub-row">
                    <span class="sub-label">翻译成</span>
                    <el-tooltip content="你的消息将被翻译成该语言发送" placement="top" effect="dark">
                      <el-icon class="sub-help"><QuestionFilled /></el-icon>
                    </el-tooltip>
                    <el-select v-model="transForm.sendTargetLang" class="sub-select" popper-class="crm-dark-popper" placeholder="选择目标语言" filterable>
                      <el-option v-for="lang in LANG_OPTIONS" :key="lang.value" :label="lang.label" :value="lang.value" />
                    </el-select>
                  </div>
                </template>
              </div>
              <!-- 三个开关 -->
              <div class="trans-block">
                <div class="switch-row">
                  <span class="switch-label">群组自动翻译</span>
                  <el-switch v-model="transForm.groupAutoTranslate" active-color="#00a884" />
                </div>
                <div class="switch-row">
                  <span class="switch-label">禁发中文</span>
                  <el-tooltip content="开启后，发送消息时若检测到中文且未开启发送翻译，将拦截并提示" placement="top" effect="dark">
                    <el-icon class="sub-help switch-help"><QuestionFilled /></el-icon>
                  </el-tooltip>
                  <el-switch v-model="transForm.blockChinese" active-color="#00a884" />
                </div>
                <div class="switch-row">
                  <span class="switch-label">翻译确认</span>
                  <el-tooltip content="开启后，发送中文消息前会在输入框上方显示译文对照" placement="top" effect="dark">
                    <el-icon class="sub-help switch-help"><QuestionFilled /></el-icon>
                  </el-tooltip>
                  <el-switch v-model="transForm.translateConfirm" active-color="#00a884" />
                </div>
              </div>
              <!-- 全局配置分隔线 -->
              <div class="trans-divider"><span class="trans-divider-text">全局配置</span></div>
              <!-- 全局配置 -->
              <div class="trans-block">
                <div class="cfg-row">
                  <span class="sub-label">文字大小</span>
                  <el-tooltip content="设置译文显示的文字大小" placement="top" effect="dark">
                    <el-icon class="sub-help cfg-help"><QuestionFilled /></el-icon>
                  </el-tooltip>
                  <el-select v-model="transForm.translationSize" class="sub-select" popper-class="crm-dark-popper" placeholder="选择字号">
                    <el-option v-for="s in SIZE_OPTIONS" :key="s" :label="s" :value="s" />
                  </el-select>
                </div>
              </div>
              <button class="trans-save-btn" :disabled="transSaving" @click="saveTransSettings">{{ transSaving ? '保存中...' : '保存' }}</button>
            </div>
          </div>

          <!-- 📥 导入聊天面板 -->
          <div v-if="!panelCollapsed && activePanel === 'import'" class="import-panel-body">
            <div class="import-panel">
              <div class="import-desc">
                <p class="import-main-title">📥 导入WhatsApp历史聊天记录</p>
                <p class="import-hint">从手机WhatsApp导出聊天文本文件，上传后自动解析并存入当前客户的聊天记录中。</p>
                <div class="import-steps">
                  <p class="import-step-title">操作步骤：</p>
                  <p>1️⃣ 打开手机WhatsApp，进入目标客户的聊天</p>
                  <p>2️⃣ 点击右上角「更多」→「导出聊天记录」</p>
                  <p>3️⃣ 选择「无媒体」（仅文字，速度更快）</p>
                  <p>4️⃣ 将导出的 .txt 文件上传到下方</p>
                </div>
              </div>
              <div class="import-actions">
                <input type="file" ref="chatImportInput" accept=".txt" style="display:none" @change="handleChatImport" />
                <button class="import-btn" @click="$refs.chatImportInput.click()">
                  <el-icon><Upload /></el-icon>
                  选择 .txt 文件并导入
                </button>
                <span v-if="importStatus" class="import-status" :class="importStatus.type">{{ importStatus.text }}</span>
              </div>
              <div v-if="!chatStore.activeJid" class="import-no-contact">
                ⚠️ 请先选择一个客户会话
              </div>
            </div>
          </div>

          <!-- 🏢 公司资料面板 -->
          <div v-if="!panelCollapsed && activePanel === 'company'" class="cm-panel-body">
            <div class="cm-chips">
              <button class="cm-chip" :class="{active: companyCategory==='all'}" @click="companyCategory='all'; fetchCompanyMaterials()">📚 全部</button>
              <button v-for="c in companyCategories" :key="c.refValue" class="cm-chip" :class="{active: companyCategory===c.refValue}" @click="companyCategory=c.refValue; fetchCompanyMaterials()">{{ c.icon }} {{ c.name }}</button>
              <button class="cm-chip cm-chip-manage" @click="showCategoryManager=true; refreshCategoryManager()" title="管理分类">⚙️</button>
            </div>
            <div v-if="cmUploading" class="cm-uploading">⏳ 上传中... {{ cmUploadProgress }}%</div>
            <div v-if="companyLoading" class="cm-empty"><div class="cm-empty-icon">⏳</div>加载中...</div>
            <div v-else-if="filteredCompanyMaterials.length === 0" class="cm-empty">
              <div class="cm-empty-icon">📁</div>
              <div>暂无资料</div>
              <button class="cm-empty-add" @click="openCompanyDialog('text')">➕ 添加文本</button>
              <button class="cm-empty-add" style="margin-left:8px" @click="openCompanyDialog('file')">📎 上传文件</button>
            </div>
            <div v-else class="cm-list">
              <div v-for="m in filteredCompanyMaterials" :key="m.id" class="cm-card">
                <div class="cm-card-top">
                  <div class="cm-title-wrap">
                    <span class="cm-type-icon">{{ cmTypeIcon(m.type) }}</span>
                    <span class="cm-title">{{ m.title }}</span>
                    <span class="cm-lang-badge" :class="'cm-lang-'+m.lang">{{ cmLangLabel(m.lang) }}</span>
                  </div>
                  <div class="cm-card-actions-top">
                    <button class="cm-icon-btn" @click="openCompanyDialog('text', m)" title="编辑">✏️</button>
                    <button class="cm-icon-btn" @click="deleteCompanyMaterial(m)" title="删除">🗑</button>
                  </div>
                </div>
                <div v-if="m.type !== 'text'" class="cm-file-preview">
                  <div v-if="m.type === 'image'" class="cm-file-thumb" @click="window.open(m.fileUrl,'_blank')">
                    <img :src="m.fileUrl" :alt="m.title" loading="lazy" />
                  </div>
                  <div v-else class="cm-file-icon" @click="window.open(m.fileUrl,'_blank')">
                    <span style="font-size:40px">{{ m.type === 'video' ? '🎬' : '📄' }}</span>
                  </div>
                  <div class="cm-file-info">
                    <div class="cm-file-name">{{ m.fileName || m.title }}</div>
                    <div class="cm-file-meta">{{ formatFileSize(m.fileSize) }} · {{ cmTypeLabel(m.type) }}</div>
                    <div v-if="m.content" class="cm-file-desc">{{ m.content }}</div>
                  </div>
                </div>
                <div v-else class="cm-content-wrap">
                  <div class="cm-content" :class="{expanded: cmExpanded[m.id]}" @click="cmExpanded[m.id]=!cmExpanded[m.id]">{{ m.content }}</div>
                  <button class="cm-expand-btn" @click.stop="cmExpanded[m.id]=!cmExpanded[m.id]">{{ cmExpanded[m.id] ? '收起 ▲' : '展开 ▼' }}</button>
                </div>
                <div class="cm-card-bottom">
                  <template v-if="m.type === 'text'">
                    <button class="cm-action-btn" @click="copyMaterial(m.content)">📋 复制</button>
                    <button class="cm-action-btn" @click="fillAiInput(m.content)">📝 插入</button>
                    <button class="cm-action-btn cm-action-primary" :disabled="!chatStore.activeJid" @click="sendMaterialText(m)">🚀 发送</button>
                    <button class="cm-action-btn cm-action-danger" @click="deleteCompanyMaterial(m)">🗑 删除</button>
                  </template>
                  <template v-else>
                    <a class="cm-action-btn" :href="m.fileUrl" target="_blank" rel="noopener">👁 预览</a>
                    <button class="cm-action-btn cm-action-primary" :disabled="!chatStore.activeJid" @click="sendMaterialFile(m)">📎 发送附件</button>
                    <button class="cm-action-btn cm-action-danger" @click="deleteCompanyMaterial(m)">🗑 删除</button>
                  </template>
                </div>
              </div>
            </div>
          </div>

          <!-- 🏢 公司资料新增/编辑对话框 -->
          <el-dialog v-model="showCompanyDialog" :title="dialogTitle" width="520px" class="cm-dialog" :append-to-body="true" @closed="resetCompanyForm">
            <el-form :model="companyForm" label-position="top" class="cm-form">
              <el-form-item label="分类">
                <el-select v-model="companyForm.category" popper-class="crm-dark-popper" style="width:100%">
                  <el-option v-for="c in companyCategories" :key="c.refValue" :label="c.icon+' '+c.name" :value="c.refValue" />
                </el-select>
              </el-form-item>
              <el-form-item label="语言">
                <el-select v-model="companyForm.lang" popper-class="crm-dark-popper" style="width:100%">
                  <el-option v-for="l in CM_LANGS" :key="l.value" :label="l.label" :value="l.value" />
                </el-select>
              </el-form-item>
              <el-form-item label="标题">
                <el-input v-model="companyForm.title" placeholder="如：公司介绍-简版" />
              </el-form-item>
              <el-form-item label="内容">
                <el-input v-model="companyForm.content" type="textarea" :rows="5" placeholder="输入文本内容（支持多行），也可作为附件的说明文字" />
              </el-form-item>
              <el-form-item label="附件（可选，内容与附件至少填一项）">
                <input ref="cmFileInput" type="file" class="cm-file-input" @change="onCmFileChange" accept="image/*,video/*,application/pdf" />
                <div class="cm-file-hint">支持图片 / PDF ≤ 20MB，视频 ≤ 50MB；超过上限将无法上传</div>
                <div v-if="companyForm.file" class="cm-file-selected">✅ {{ companyForm.file.name }} ({{ formatFileSize(companyForm.file.size) }})</div>
                <div v-else-if="editingCompanyId && editingFileInfo" class="cm-file-selected">📎 当前附件：{{ editingFileInfo }}（编辑模式不更换附件）</div>
              </el-form-item>
            </el-form>
            <template #footer>
              <el-button @click="closeCompanyDialog">取消</el-button>
              <el-button type="primary" @click="saveCompanyMaterial" :loading="cmSaving">保存</el-button>
            </template>
          </el-dialog>

          <!-- ⚙️ 公司资料分类管理弹窗 -->
          <el-dialog v-model="showCategoryManager" title="管理分类（可新增/改名/删除）" width="460px" class="cm-cat-dialog" :append-to-body="true">
            <div class="cm-cat-list">
              <div v-for="c in categoryManagerList" :key="c.id" class="cm-cat-row">
                <span class="cm-cat-icon">{{ c.icon }}</span>
                <el-input v-model="c.name" size="small" class="cm-cat-name-input" @keyup.enter="saveCategoryName(c)" />
                <el-button size="small" @click="saveCategoryName(c)" :loading="c.saving">保存</el-button>
                <el-button size="small" type="danger" @click="deleteCategory(c)">删除</el-button>
              </div>
              <div class="cm-cat-empty" v-if="categoryManagerList.length===0">暂无分类，请新增</div>
            </div>
            <div class="cm-cat-add">
              <el-input v-model="newCategoryName" placeholder="新分类名称" size="small" @keyup.enter="addCategory" />
              <el-button size="small" type="primary" @click="addCategory" :loading="categorySaving">＋ 新增</el-button>
            </div>
          </el-dialog>

          <!-- 📊 BANT 评分详情弹窗 -->
          <el-dialog v-model="showBantDetailDialog" title="BANT 客户价值评分" width="520px" class="bant-dialog" :append-to-body="true">
            <div v-if="bantDetailJid && bantDetailMap[bantDetailJid]" class="bant-detail-body">
              <div class="bant-summary">
                <span class="bant-level-badge" :class="'bant-' + (bantDetailMap[bantDetailJid].level || '').toLowerCase()">{{ bantDetailMap[bantDetailJid].level }}</span>
                <span class="bant-total-score">{{ bantDetailMap[bantDetailJid].totalScore }} 分</span>
              </div>
              <div class="bant-dimensions">
                <div class="bant-dim-item">
                  <div class="bant-dim-head"><span class="bant-dim-label">💰 Budget 预算</span><span class="bant-dim-score">{{ bantDetailMap[bantDetailJid].budgetScore }}</span></div>
                  <div class="bant-dim-bar"><div class="bant-bar-fill bant-bar-budget" :style="{width: (bantDetailMap[bantDetailJid].budgetScore / 10 * 100) + '%'}"></div></div>
                  <p class="bant-dim-reason" v-if="bantDetailMap[bantDetailJid].evaluationDetails?.budget?.reason">{{ bantDetailMap[bantDetailJid].evaluationDetails.budget.reason }}</p>
                </div>
                <div class="bant-dim-item">
                  <div class="bant-dim-head"><span class="bant-dim-label">👤 Authority 决策权</span><span class="bant-dim-score">{{ bantDetailMap[bantDetailJid].authorityScore }}</span></div>
                  <div class="bant-dim-bar"><div class="bant-bar-fill bant-bar-authority" :style="{width: (bantDetailMap[bantDetailJid].authorityScore / 10 * 100) + '%'}"></div></div>
                  <p class="bant-dim-reason" v-if="bantDetailMap[bantDetailJid].evaluationDetails?.authority?.reason">{{ bantDetailMap[bantDetailJid].evaluationDetails.authority.reason }}</p>
                </div>
                <div class="bant-dim-item">
                  <div class="bant-dim-head"><span class="bant-dim-label">🎯 Need 需求</span><span class="bant-dim-score">{{ bantDetailMap[bantDetailJid].needScore }}</span></div>
                  <div class="bant-dim-bar"><div class="bant-bar-fill bant-bar-need" :style="{width: (bantDetailMap[bantDetailJid].needScore / 10 * 100) + '%'}"></div></div>
                  <p class="bant-dim-reason" v-if="bantDetailMap[bantDetailJid].evaluationDetails?.need?.reason">{{ bantDetailMap[bantDetailJid].evaluationDetails.need.reason }}</p>
                </div>
                <div class="bant-dim-item">
                  <div class="bant-dim-head"><span class="bant-dim-label">⏰ Timeline 时间线</span><span class="bant-dim-score">{{ bantDetailMap[bantDetailJid].timelineScore }}</span></div>
                  <div class="bant-dim-bar"><div class="bant-bar-fill bant-bar-timeline" :style="{width: (bantDetailMap[bantDetailJid].timelineScore / 10 * 100) + '%'}"></div></div>
                  <p class="bant-dim-reason" v-if="bantDetailMap[bantDetailJid].evaluationDetails?.timeline?.reason">{{ bantDetailMap[bantDetailJid].evaluationDetails.timeline.reason }}</p>
                </div>
              </div>
              <p v-if="bantDetailMap[bantDetailJid].evaluationDetails?.summary" class="bant-summary-text">{{ bantDetailMap[bantDetailJid].evaluationDetails.summary }}</p>
              <p v-if="bantDetailMap[bantDetailJid].evaluatedAt" class="bant-eval-time">评估时间: {{ new Date(bantDetailMap[bantDetailJid].evaluatedAt).toLocaleString('zh-CN') }}</p>
            </div>
            <div v-else class="bant-detail-empty"><p>暂无 BANT 评分数据</p><p class="bant-empty-hint">点击"重新评分"开始评估</p></div>
            <template #footer>
              <el-button @click="showBantConfigDialog = true; loadBantConfig()">⚙️ 评分配置</el-button>
              <el-button type="primary" @click="triggerBantRescore(bantDetailJid)" :loading="bantRescoreLoading">🔄 重新评分</el-button>
            </template>
          </el-dialog>

          <!-- ⚙️ BANT 评分配置弹窗 -->
          <el-dialog v-model="showBantConfigDialog" title="BANT 评分配置" width="440px" class="bant-config-dialog" :append-to-body="true">
            <div class="bant-config-body">
              <div class="bant-config-section">
                <h4>维度权重（总和 100%）</h4>
                <div class="bant-config-row"><label>💰 Budget</label><el-slider v-model="bantConfigForm.weights.budget" :min="0" :max="100" :step="5" show-input size="small" /></div>
                <div class="bant-config-row"><label>👤 Authority</label><el-slider v-model="bantConfigForm.weights.authority" :min="0" :max="100" :step="5" show-input size="small" /></div>
                <div class="bant-config-row"><label>🎯 Need</label><el-slider v-model="bantConfigForm.weights.need" :min="0" :max="100" :step="5" show-input size="small" /></div>
                <div class="bant-config-row"><label>⏰ Timeline</label><el-slider v-model="bantConfigForm.weights.timeline" :min="0" :max="100" :step="5" show-input size="small" /></div>
              </div>
              <div class="bant-config-section">
                <h4>评级阈值</h4>
                <div class="bant-config-row"><label>HIGH 阈值（≥）</label><el-slider v-model="bantConfigForm.highThreshold" :min="1" :max="10" :step="0.5" show-input size="small" /></div>
                <div class="bant-config-row"><label>LOW 阈值（＜）</label><el-slider v-model="bantConfigForm.lowThreshold" :min="0" :max="9" :step="0.5" show-input size="small" /></div>
              </div>
            </div>
            <template #footer>
              <el-button @click="showBantConfigDialog = false">取消</el-button>
              <el-button type="primary" @click="saveBantConfig">保存</el-button>
            </template>
          </el-dialog>

          <!-- 🕰️ 时间与文化面板（自动关联当前客户） -->
          <div v-if="!panelCollapsed && activePanel === 'worldclock'" class="wc-panel-body culture-panel">
            <!-- 当前客户文化信息 -->
            <template v-if="cultureIso && cultureInfo">
              <!-- 客户身份条 -->
              <div class="cul-hero">
                <div class="cul-hero-flag">{{ cultureInfo.flag }}</div>
                <div class="cul-hero-main">
                  <div class="cul-hero-name">{{ cultureInfo.name }}</div>
                  <div class="cul-hero-sub">{{ cultureCustomerLabel }}</div>
                </div>
                <div class="cul-hero-status" :class="'cul-s-' + cultureWorkStatus.status">
                  <span class="cul-s-icon">{{ cultureWorkStatus.icon }}</span>
                  <span class="cul-s-text">{{ cultureWorkStatus.localTime }}</span>
                </div>
              </div>
              <!-- 工作时段建议 -->
              <div class="cul-section cul-time-advice" :class="'cul-s-' + cultureWorkStatus.status">
                <div class="cul-sec-title">⏰ {{ customerData.city ? customerData.city + ' ' : '' }}当地时间与联系建议</div>
                <div class="cul-big-time">{{ cultureWorkStatus.icon }} {{ cultureWorkStatus.localTime }}</div>
                <div class="cul-tip">{{ cultureWorkStatus.tip }}</div>
                <div class="cul-meta-grid">
                  <div class="cul-meta-item"><span class="cul-meta-label">工作时间</span><span class="cul-meta-val">{{ cultureInfo.workHours.start }}:00 - {{ cultureInfo.workHours.end }}:00</span></div>
                  <div class="cul-meta-item"><span class="cul-meta-label">休息日</span><span class="cul-meta-val">{{ cultureWeekendText }}</span></div>
                  <div class="cul-meta-item"><span class="cul-meta-label">时差</span><span class="cul-meta-val">{{ cultureTzDiff }}</span></div>
                </div>
                <!-- 切换国籍/所在国 -->
                <div v-if="cultureResidenceIso && cultureResidenceIso !== cultureIso" class="cul-switch-hint">
                  <button class="cul-switch-btn" @click="cultureUseResidence = !cultureUseResidence; cultureSaveManual()">
                    🔄 {{ cultureUseResidence ? '查看国籍文化('+cultureInfoNationality.name+')' : '切换到所在国('+cultureResidenceName+')' }}
                  </button>
                </div>
              </div>
              <!-- 基础信息 -->
              <div class="cul-section">
                <div class="cul-sec-title">🏷️ 国家基础信息</div>
                <div class="cul-meta-grid">
                  <div class="cul-meta-item"><span class="cul-meta-label">官方语言</span><span class="cul-meta-val">{{ cultureInfo.language }}</span></div>
                  <div class="cul-meta-item"><span class="cul-meta-label">英语水平</span><span class="cul-meta-val">{{ cultureInfo.englishLevel }}</span></div>
                  <div class="cul-meta-item"><span class="cul-meta-label">货币</span><span class="cul-meta-val">{{ cultureInfo.currency }}</span></div>
                  <div class="cul-meta-item"><span class="cul-meta-label">重要节日</span><span class="cul-meta-val cul-multiline">{{ cultureInfo.holidays }}</span></div>
                  <div class="cul-meta-item"><span class="cul-meta-label">商务着装</span><span class="cul-meta-val">{{ cultureInfo.dress }}</span></div>
                  <div class="cul-meta-item"><span class="cul-meta-label">送礼建议</span><span class="cul-meta-val cul-multiline">{{ cultureInfo.gifts }}</span></div>
                </div>
              </div>
              <!-- 商务礼仪 -->
              <div class="cul-section">
                <div class="cul-sec-title">🤝 商务礼仪要点</div>
                <div class="cul-two-col">
                  <div class="cul-sub-sec">
                    <div class="cul-sub-title">⏱️ 时间观</div>
                    <div class="cul-text">{{ cultureInfo.timePerception }}</div>
                  </div>
                  <div class="cul-sub-sec">
                    <div class="cul-sub-title">👋 问候方式</div>
                    <div class="cul-text">{{ cultureInfo.greeting }}</div>
                  </div>
                </div>
                <ul class="cul-list">
                  <li v-for="(item,i) in cultureInfo.etiquette" :key="'e'+i">{{ item }}</li>
                </ul>
              </div>
              <!-- 谈单技巧 -->
              <div class="cul-section cul-nego">
                <div class="cul-sec-title">💼 谈单技巧与注意</div>
                <ul class="cul-list">
                  <li v-for="(item,i) in cultureInfo.negotiationTips" :key="'n'+i">{{ item }}</li>
                </ul>
              </div>
              <!-- 禁忌 -->
              <div class="cul-section cul-taboos">
                <div class="cul-sec-title">⚠️ 禁忌红线</div>
                <ul class="cul-list cul-list-warn">
                  <li v-for="(item,i) in cultureInfo.taboos" :key="'t'+i">{{ item }}</li>
                </ul>
              </div>
              <!-- 手动选择/修正国家 -->
              <div class="cul-section cul-manual">
                <div class="cul-sec-title">🔧 修正国籍/所在国</div>
                <div class="cul-two-col">
                  <div class="cul-pick">
                    <label class="cul-pick-label">国籍 (文化归属)</label>
                    <select v-model="cultureManualNationality" class="cul-pick-select" @change="cultureSaveManual">
                      <option value="">自动 (按手机号国家码)</option>
                      <option v-for="c in cultureAllCountries" :key="'n'+c.iso" :value="c.iso">{{ c.flag }} {{ c.name }}</option>
                    </select>
                  </div>
                  <div class="cul-pick">
                    <label class="cul-pick-label">所在国 (当地时间)</label>
                    <select v-model="cultureManualResidence" class="cul-pick-select" @change="cultureSaveManual">
                      <option value="">同国籍</option>
                      <option v-for="c in cultureAllCountries" :key="'r'+c.iso" :value="c.iso">{{ c.flag }} {{ c.name }}</option>
                    </select>
                  </div>
                </div>
              </div>
            </template>
            <!-- 无选中客户时提示 -->
            <template v-else-if="chatStore.activeConversation">
              <div class="cul-empty-tip">
                <div style="font-size:32px;margin-bottom:8px">🌐</div>
                <div style="color:var(--text-secondary)">未检测到该客户所在国家</div>
                <div style="color:var(--text-tertiary);font-size:12px;margin-top:4px;margin-bottom:16px">请手动选择国籍或所在国</div>
                <div class="cul-two-col" style="margin-top:8px">
                  <div class="cul-pick">
                    <label class="cul-pick-label">国籍 (文化归属)</label>
                    <select v-model="cultureManualNationality" class="cul-pick-select" @change="cultureSaveManual">
                      <option value="">自动 (按手机号国家码)</option>
                      <option v-for="c in cultureAllCountries" :key="'n'+c.iso" :value="c.iso">{{ c.flag }} {{ c.name }}</option>
                    </select>
                  </div>
                  <div class="cul-pick">
                    <label class="cul-pick-label">所在国 (当地时间)</label>
                    <select v-model="cultureManualResidence" class="cul-pick-select" @change="cultureSaveManual">
                      <option value="">同国籍</option>
                      <option v-for="c in cultureAllCountries" :key="'r'+c.iso" :value="c.iso">{{ c.flag }} {{ c.name }}</option>
                    </select>
                  </div>
                </div>
              </div>
            </template>
            <template v-else>
              <div class="cul-empty-tip">
                <div style="font-size:32px;margin-bottom:8px">👈</div>
                <div style="color:var(--text-secondary)">请先选择一个客户对话</div>
                <div style="color:var(--text-tertiary);font-size:12px;margin-top:4px">选中客户后将自动显示其所在国时间 + 商务文化礼仪</div>
              </div>
            </template>
          </div>

          <!-- 💱 汇率计算面板 -->
          <div v-if="!panelCollapsed && activePanel === 'forex'" class="ex-panel-body">
            <div class="ex-header">
              <div class="ex-rate-date" v-if="exLastUpdate">
                📅 {{ exLastUpdate }} · ECB参考汇率
              </div>
              <div class="ex-loading" v-else>⏳ 加载中...</div>
              <div class="ex-error" v-if="exError">{{ exError }}</div>
            </div>
            <div class="ex-converter">
              <div class="ex-row">
                <input type="number" v-model.number="exAmount" class="ex-amount" min="0" step="0.01" placeholder="金额" @input="exCalc" />
                <select v-model="exFrom" class="ex-currency" @change="exCalc">
                  <option v-for="cur in exCurrencies" :key="cur.code" :value="cur.code">{{ cur.symbol }} {{ cur.code }}</option>
                </select>
              </div>
              <div class="ex-swap-row">
                <button class="ex-swap-btn" @click="exSwap" title="互换">⇅</button>
              </div>
              <div class="ex-row">
                <input type="text" :value="exResultText" class="ex-amount ex-result" readonly />
                <select v-model="exTo" class="ex-currency" @change="exCalc">
                  <option v-for="cur in exCurrencies" :key="cur.code" :value="cur.code">{{ cur.symbol }} {{ cur.code }}</option>
                </select>
              </div>
              <div class="ex-rate-info" v-if="exRateVal">
                1 {{ exFrom }} = {{ exRateVal.toFixed(4) }} {{ exTo }}
              </div>
            </div>
            <div class="ex-quick-title">📊 常用汇率速查（CNY基准）</div>
            <div class="ex-quick-grid">
              <div v-for="q in exQuickRates" :key="q.code" class="ex-quick-card">
                <div class="ex-qc-top">{{ q.symbol }} {{ q.code }}</div>
                <div class="ex-qc-rate" v-if="q.rate">{{ (1/q.rate).toFixed(4) }}</div>
                <div class="ex-qc-rate" v-else style="color:var(--text-secondary)">-</div>
                <div class="ex-qc-name">{{ q.name }}</div>
              </div>
            </div>
          </div>

          <!-- 🚢 运费查询面板 -->
          <div v-if="!panelCollapsed && activePanel === 'freight'" class="fr-panel-body">
            <div class="fr-header">
              <div class="fr-note">📌 参考运价 · {{ frLastUpdate }}</div>
            </div>
            <div class="fr-selectors">
              <div class="fr-select-row">
                <label class="fr-label">起运港</label>
                <select v-model="frOrigin" class="fr-select">
                  <option v-for="p in frPorts" :key="'o'+p.code" :value="p.code">{{ p.flag }} {{ p.name }} ({{ p.code }})</option>
                </select>
              </div>
              <div class="fr-select-row">
                <label class="fr-label">目的港</label>
                <select v-model="frDest" class="fr-select">
                  <option v-for="p in frDestPorts" :key="'d'+p.code" :value="p.code">{{ p.flag }} {{ p.name }} ({{ p.code }})</option>
                </select>
              </div>
              <div class="fr-select-row">
                <label class="fr-label">柜型</label>
                <div class="fr-container-tabs">
                  <button v-for="c in frContainers" :key="c.key" class="fr-ctab" :class="{active: frContainer===c.key}" @click="frContainer=c.key">{{ c.label }}</button>
                </div>
              </div>
            </div>
            <div v-if="frCurrentRoute" class="fr-result-card">
              <div class="fr-price-row">
                <span class="fr-price-label">{{ frCurrentRoute.name }}</span>
                <span class="fr-price-value" :class="frTrendClass">{{ frPriceDisplay }} <span class="fr-price-unit">USD</span></span>
              </div>
              <div class="fr-price-meta">
                <span class="fr-trend" :class="frTrendClass">
                  <template v-if="frTrend==='up'">📈 上涨中</template>
                  <template v-else-if="frTrend==='down'">📉 回落中</template>
                  <template v-else>➡️ 基本稳定</template>
                </span>
                <span class="fr-transit">⏱ {{ frCurrentRoute.transit }}天</span>
              </div>
              <div class="fr-price-range" v-if="frRangeText">{{ frRangeText }}</div>
              <div class="fr-price-disclaimer">⚠️ 以上为市场参考价({{ frLastUpdate }})，实际以货代报价为准</div>
            </div>
            <div v-else class="fr-empty">
              <div style="color:var(--text-secondary);text-align:center;padding:20px 0">请选择航线</div>
            </div>
            <div class="fr-quick-title">🔥 常用航线速查（{{ frContainerLabel }}）</div>
            <div class="fr-quick-grid">
              <div v-for="r in frAllRoutes" :key="r.key" class="fr-quick-card" :class="{active: frOrigin+'-'+frDest===r.key}" @click="frOrigin=r.from;frDest=r.to">
                <div class="fr-qc-route">{{ r.fromFlag }}{{ r.fromName }} → {{ r.toFlag }}{{ r.toName }}</div>
                <div class="fr-qc-price">${{ r.prices[frContainer] || '-' }}</div>
                <div class="fr-qc-meta">
                  <span :class="'fr-trend-mini fr-'+(r.trend||'stable')">{{ r.trend==='up'?'↑':r.trend==='down'?'↓':'→' }}</span>
                  <span class="fr-qc-transit">⏱{{ r.transit }}d</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 📈 效果追踪面板 -->
          <div v-if="!panelCollapsed && activePanel === 'tracking'" class="tracking-panel-body">
            <div v-if="trackingLoading" class="tracking-loading">
              <span>加载中...</span>
            </div>
            <div v-else-if="!chatStore.activeJid" class="tracking-empty">
              <div class="tracking-empty-icon">📈</div>
              <p>请先选择一个客户会话</p>
            </div>
            <div v-else-if="trackingData" class="tracking-content">
              <div class="tracking-stats-grid">
                <div class="tracking-stat-card">
                  <div class="tracking-stat-icon">📨</div>
                  <div class="tracking-stat-num">{{ trackingData.totalMessages || 0 }}</div>
                  <div class="tracking-stat-label">总消息</div>
                </div>
                <div class="tracking-stat-card">
                  <div class="tracking-stat-icon">💬</div>
                  <div class="tracking-stat-num tracking-green">{{ trackingData.messagesWithReply || 0 }}</div>
                  <div class="tracking-stat-label">已回复</div>
                </div>
                <div class="tracking-stat-card">
                  <div class="tracking-stat-icon">📊</div>
                  <div class="tracking-stat-num tracking-green">{{ fmtTrackPercent(trackingData.replyRate) }}</div>
                  <div class="tracking-stat-label">回复率</div>
                </div>
                <div class="tracking-stat-card">
                  <div class="tracking-stat-icon">⏱️</div>
                  <div class="tracking-stat-num">{{ fmtTrackTime(trackingData.avgResponseTimeMs) }}</div>
                  <div class="tracking-stat-label">平均响应</div>
                </div>
                <div class="tracking-stat-card">
                  <div class="tracking-stat-icon">⭐</div>
                  <div class="tracking-stat-num tracking-orange">{{ fmtTrackScore(trackingData.avgEffectivenessScore) }}</div>
                  <div class="tracking-stat-label">效果评分</div>
                </div>
                <div class="tracking-stat-card">
                  <div class="tracking-stat-icon">🎯</div>
                  <div class="tracking-stat-num">{{ fmtTrackScore(trackingData.avgAttitudeScore) }}</div>
                  <div class="tracking-stat-label">态度评分</div>
                </div>
              </div>
              <div v-if="trackingData.recentTrend && trackingData.recentTrend.length" class="tracking-trend-section">
                <div class="tracking-section-title">📉 近期趋势</div>
                <div class="tracking-trend-list">
                  <div v-for="t in trackingData.recentTrend.slice(-7)" :key="t.date" class="tracking-trend-item">
                    <span class="tracking-trend-date">{{ t.date }}</span>
                    <span class="tracking-trend-bar-wrap">
                      <span class="tracking-trend-bar" :style="{width: Math.min(100, (t.replyRate||0)*100) + '%'}"></span>
                    </span>
                    <span class="tracking-trend-rate">{{ fmtTrackPercent(t.replyRate) }}</span>
                  </div>
                </div>
              </div>
              <div v-if="trackingData.lastAttitude" class="tracking-attitude-section">
                <div class="tracking-section-title">🧠 最新态度分析</div>
                <div class="tracking-attitude-card">
                  <div class="tracking-att-row">
                    <span>意向强度</span>
                    <span class="tracking-att-badge" :class="'att-intent-' + (trackingData.lastAttitude.intentLevel || 'medium')">{{ trackingData.lastAttitude.intentLevel || '--' }}</span>
                  </div>
                  <div class="tracking-att-row">
                    <span>情绪</span>
                    <span class="tracking-att-badge" :class="'att-sent-' + (trackingData.lastAttitude.sentiment || 'neutral')">{{ trackingData.lastAttitude.sentiment || '--' }}</span>
                  </div>
                  <div class="tracking-att-row">
                    <span>紧急度</span>
                    <span class="tracking-att-badge" :class="'att-urg-' + (trackingData.lastAttitude.urgency || 'low')">{{ trackingData.lastAttitude.urgency || '--' }}</span>
                  </div>
                </div>
              </div>
            </div>
            <div v-else class="tracking-empty">
              <div class="tracking-empty-icon">📭</div>
              <p>暂无该客户的效果数据</p>
              <p style="font-size:12px;color:var(--text-secondary);margin-top:4px">持续沟通后将自动生成分析</p>
            </div>
          </div>
        </aside>

        <!-- ⑦ 图标列（常驻）） -->
        <aside class="col-iconbar" :class="{ collapsed: iconbarCollapsed }">
          <div class="ib-items">
            <button class="ib-item" :class="{ active: activePanel === 'translate' }" @click="switchPanel('translate')" :title="iconbarCollapsed ? '翻译设置' : ''">
              <span class="ib-icon">🌐</span>
              <span class="ib-label">翻译设置</span>
            </button>
            <button class="ib-item" :class="{ active: configPanelOpen }" @click="openConfigPanel" :title="iconbarCollapsed ? '代理设置' : ''">
              <span class="ib-icon">🔌</span>
              <span class="ib-label">代理设置</span>
            </button>
            <button class="ib-item" :class="{ active: activePanel === 'import' }" @click="switchPanel('import')" :title="iconbarCollapsed ? '导入聊天' : ''">
              <span class="ib-icon">📥</span>
              <span class="ib-label">导入聊天</span>
            </button>
            <button class="ib-item" :class="{ active: activePanel === 'aitalk' }" @click="switchPanel('aitalk')" :title="iconbarCollapsed ? '沟通话术' : ''">
              <span class="ib-icon">💬</span>
              <span class="ib-label">沟通话术</span>
            </button>
            <button class="ib-item" :class="{ active: activePanel === 'bgcheck' }" @click="switchPanel('bgcheck')" :title="iconbarCollapsed ? '客户背调' : ''">
              <span class="ib-icon">🔍</span>
              <span class="ib-label">客户背调</span>
            </button>
            <button class="ib-item" :class="{ active: activePanel === 'requirement' }" @click="switchPanel('requirement')" :title="iconbarCollapsed ? '需求总结' : ''">
              <span class="ib-icon">🎯</span>
              <span class="ib-label">需求总结</span>
            </button>
            <button class="ib-item" :class="{ active: activePanel === 'tracking' }" @click="switchPanel('tracking')" :title="iconbarCollapsed ? '效果追踪' : ''">
              <span class="ib-icon">📈</span>
              <span class="ib-label">效果追踪</span>
            </button>
            <button class="ib-item" :class="{ active: activePanel === 'customer' }" @click="switchPanel('customer')" :title="iconbarCollapsed ? '客户画像' : ''">
              <span class="ib-icon">👤</span>
              <span class="ib-label">客户画像</span>
            </button>
            <button class="ib-item" :class="{ active: activePanel === 'company' }" @click="switchPanel('company')" :title="iconbarCollapsed ? '公司资料' : ''">
              <span class="ib-icon">🏢</span>
              <span class="ib-label">公司资料</span>
            </button>
            <button class="ib-item" :class="{ active: activePanel === 'freight' }" @click="switchPanel('freight')" :title="iconbarCollapsed ? '运费查询' : ''">
              <span class="ib-icon">🚢</span>
              <span class="ib-label">运费查询</span>
            </button>
            <button class="ib-item" :class="{ active: activePanel === 'documents' }" @click="switchPanel('documents')" :title="iconbarCollapsed ? '外贸单证' : ''">
              <span class="ib-icon">📄</span>
              <span class="ib-label">外贸单证</span>
            </button>
            <button class="ib-item" :class="{ active: activePanel === 'worldclock' }" @click="switchPanel('worldclock')" :title="iconbarCollapsed ? '时间文化' : ''">
              <span class="ib-icon">🕰️</span>
              <span class="ib-label">时间文化</span>
            </button>
            <button class="ib-item" :class="{ active: activePanel === 'forex' }" @click="switchPanel('forex')" :title="iconbarCollapsed ? '汇率计算' : ''">
              <span class="ib-icon">💱</span>
              <span class="ib-label">汇率计算</span>
            </button>
          </div>
          <button class="ib-toggle" :class="{ expanded: !iconbarCollapsed }" @click="iconbarCollapsed = !iconbarCollapsed" :title="iconbarCollapsed ? '展开' : '收起'">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M15.41 16.59L10.83 12l4.58-4.59L14 6l-6 6 6 6z"/></svg>
          </button>
        </aside>

      </div>

    <!-- 其他模块占位：由 router-view 填充 -->
    <div v-if="activePlatform !== 'trade-agent' && activePlatform !== 'communication'" class="module-full">
      <router-view />
    </div>
    </div>

    <!-- 设置全屏弹窗 -->
    <div class="settings-modal" v-if="showSettings" @click.self="showSettings = false">
      <div class="settings-dialog">
        <div class="settings-sidebar">
          <div class="settings-title">设置</div>
          <div
            v-for="s in settingsTabs"
            :key="s.key"
            class="settings-nav-item"
            :class="{ active: activeSettingsTab === s.key }"
            @click="activeSettingsTab = s.key"
          >
            <span v-html="s.icon"></span>
            <span>{{ s.label }}</span>
          </div>
          <button class="settings-close" @click="showSettings = false">✕ 关闭</button>
        </div>
        <div class="settings-content">
          <!-- 无人值守设置 -->
          <div v-if="activeSettingsTab === 'unattended'" class="unattended-settings">
            <h2>无人值守自动回复</h2>
            <p class="section-desc">非工作时间，AI 自动回复客户消息，不让客户等太久。</p>

            <div class="form-group">
              <label class="toggle-label">
                <input type="checkbox" v-model="unattendedForm.enabled" />
                <span class="toggle-switch"></span>
                <span>启用无人值守</span>
              </label>
            </div>

            <div v-if="unattendedForm.enabled" class="unattended-fields">
              <div class="form-group">
                <label>开始时间（24小时制）</label>
                <select v-model="unattendedForm.startHour" class="form-select">
                  <option v-for="h in 24" :key="h" :value="h - 1">{{ String(h - 1).padStart(2, '0') }}:00</option>
                </select>
              </div>

              <div class="form-group">
                <label>结束时间（24小时制）</label>
                <select v-model="unattendedForm.endHour" class="form-select">
                  <option v-for="h in 24" :key="h" :value="h - 1">{{ String(h - 1).padStart(2, '0') }}:00</option>
                </select>
              </div>

              <div class="form-group">
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

              <div class="form-group">
                <label>回复策略</label>
                <div class="radio-group">
                  <label class="radio-label">
                    <input type="radio" v-model="unattendedForm.strategy" value="smart" />
                    <span>智能回复（AI 根据客户消息生成）</span>
                  </label>
                  <label class="radio-label">
                    <input type="radio" v-model="unattendedForm.strategy" value="simple" />
                    <span>简单告知（固定话术：正在休息中）</span>
                  </label>
                </div>
              </div>

              <div class="form-actions">
                <button class="btn btn-primary" @click="saveUnattended" :disabled="unattendedSaving">
                  {{ unattendedSaving ? '保存中...' : '保存设置' }}
                </button>
                <span v-if="unattendedSaved" class="save-hint">✓ 已保存</span>
              </div>
            </div>
          </div>

          <!-- 账号设置：我的积分 -->
          <div v-else-if="activeSettingsTab === 'account'" class="account-settings">
            <h2>我的积分</h2>
            <p class="section-desc">AI 助手每次调用消耗积分，充值后即可畅用全部 AI 能力。</p>
            <div class="credits-balance-card">
              <div class="credits-balance-num">{{ creditsBalance }}</div>
              <div class="credits-balance-label">当前积分</div>
              <div class="credits-balance-actions">
                <button class="credits-btn-primary" @click="goCredits">去充值</button>
                <button class="credits-btn-plain" @click="goCreditsTransactions">充值记录</button>
              </div>
            </div>
            <div class="credits-tips">
              <p>· AI 调用按模型分级扣费：轻量模型 10~60 积分，旗舰模型 135 积分</p>
              <p>· 1 元 = 1000 积分，100 元起充</p>
            </div>
          </div>

          <!-- 其他设置tab占位 -->
          <div v-else class="settings-placeholder">
            <h2>{{ currentSettingsName }}</h2>
            <p>设置模块开发中...</p>
          </div>
        </div>
      </div>
    </div>

    <!-- 移动端底部Tab Bar -->
    <!-- 渠道选择弹出菜单 -->
      <div class="channel-popup-mask" v-if="channelPopupOpen" @click="channelPopupOpen=false"></div>
      <div class="channel-popup" v-if="channelPopupOpen">
        <div class="channel-popup-arrow"></div>
        <button v-for="ch in activeChannels" :key="ch.id" class="channel-popup-item" :class="{active: popupSelected && activeChannel===ch.id}" @click="popupSelected=true; selectChannel(ch.id); channelPopupOpen=false; activePlatform='communication'; if($router.currentRoute.value.path!=='/chat')$router.push('/chat')">
          <span v-html="channelIcons[ch.id] || ch.icon"></span>
          <span>{{ ch.name }}</span>
          <span v-if="popupSelected && activeChannel===ch.id" class="channel-popup-check">✓</span>
        </button>
      </div>
      <nav class="mobile-tabbar" v-if="isMobile && $route.path !== '/assistant' && !showModelSelector">
      <button
        v-for="tab in mobileTabs"
        :key="tab.key"
        class="m-tab"
        :class="{ active: isTabActive(tab) }"
        @click="handleMobileTab(tab)"
      >
        <span v-html="tab.icon"></span>
        <span>{{ tab.label }}</span>
      </button>
    </nav>

    <!-- 移动端AI悬浮按钮 -->
    <button class="mobile-ai-fab" v-if="isMobile && activePlatform === 'communication'" @click="onMobileAIFab">
      🤖
    </button>
  </div>

          <!-- 新建聊天弹窗 -->
          <div v-if="showNewChat" class="nc-mask" @click.self="ncClose()">
            <div class="nc-dialog">
              <div class="nc-header">
                <button class="nc-back" @click="ncClose()">←</button>
                <span class="nc-title">新联系人</span>
                <span class="nc-spacer"></span>
              </div>
              <div class="nc-body">
                <div class="nc-field nc-phone-row">
                  <div class="nc-country" @click.stop="ncToggleCountry">
                    <span class="nc-flag">{{ ncCurrentCountry.flag }}</span>
                    <span class="nc-cc">{{ ncCountryCode }}</span>
                    <span class="nc-caret">▾</span>
                    <div v-if="ncCountryOpen" class="nc-country-list" @click.stop>
                      <div class="nc-search-wrap">
                        <span class="nc-search-icon">🔍</span>
                        <input ref="ncCountrySearchInput" v-model="ncCountrySearch" class="nc-search-input" type="text" placeholder="搜索国家/地区" />
                      </div>
                      <div class="nc-country-scroll">
                        <div v-for="c in ncFilteredCountries" :key="c.code+c.name" class="nc-country-item" @click.stop="ncPickCountry(c)">
                          <span>{{ c.flag }} {{ c.name }}<span class="nc-ci-en" v-if="c.name_en && c.name_en!==c.name"> {{ c.name_en }}</span></span>
                          <span class="nc-ci-code">{{ c.code }}</span>
                        </div>
                        <div v-if="!ncFilteredCountries.length" class="nc-no-result">未找到匹配的国家</div>
                      </div>
                    </div>
                  </div>
                  <input ref="ncPhoneInput" v-model="ncPhone" class="nc-input nc-phone-input" type="tel" placeholder="请输入手机号" @input="ncOnPhoneInput" @keyup.enter="ncSubmit()" />
                </div>
                <div v-if="ncPhone" class="nc-hint">将发送到 {{ ncCountryCode }}{{ ncPhone.replace(/[\s+\-()]/g,'') }}@whatsapp</div>
                <div v-if="ncCheckResult" class="nc-check" :class="{'nc-ok': ncCheckResult.exists, 'nc-bad': !ncCheckResult.exists}">
                  <span v-if="ncCheckResult.exists">✓ {{ ncCheckResult.name || '已注册 WhatsApp' }}{{ ncCheckResult._autoCountryCode ? '（已自动补国家码）' : '' }}</span>
                  <span v-else>✗ 该号码未注册 WhatsApp，请检查号码或国家码</span>
                </div>
                <div v-if="ncError" class="nc-error">✗ {{ ncError }}</div>
                <div class="nc-field" style="margin-top:16px">
                  <label class="nc-label">首条消息 <span class="nc-opt">（可选）</span></label>
                  <textarea v-model="ncMessage" class="nc-textarea" rows="3" placeholder="发送后自动创建会话；不填则只打开聊天窗口"></textarea>
                </div>
              </div>
              <div class="nc-footer">
                <button class="nc-btn nc-cancel" @click="ncClose()" :disabled="ncSending">取消</button>
                <button class="nc-btn nc-primary" @click="ncSubmit" :disabled="ncChecking || ncSending || !ncPhone || (ncCheckResult && ncCheckResult.exists===false)">
                  {{ ncChecking ? '验证中…' : ncSending ? '创建中…' :
                     (ncCheckResult && ncCheckResult.exists) ? '开始聊天' : '验证号码并开始聊天' }}
                </button>
              </div>
            </div>
          </div>


<!-- Telegram Bot 连接弹窗 -->
<transition name="fade">
  <div v-if="showTgModal" style="position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center;" @click.self="showTgModal=false">
    <div style="background:var(--bg-elevated,#202c33);border-radius:12px;padding:20px;width:420px;max-width:90vw;color:var(--text-primary,#e9edef);">
      <div style="font-size:16px;font-weight:600;margin-bottom:16px;display:flex;align-items:center;gap:8px;">
        <span style="font-size:22px;">✈️</span> 连接 Telegram Bot
      </div>
      <div style="font-size:12px;color:var(--text-secondary,#8696a0);margin-bottom:12px;line-height:1.6;">
        1. 在 Telegram 搜索 <b>@BotFather</b>，发送 <code>/newbot</code> 创建机器人<br/>
        2. 按提示设置名字和用户名（需以bot结尾）<br/>
        3. 创建后BotFather会给你一个HTTP API Token，粘贴到下方
      </div>
      <input v-model="tgTokenInput" placeholder="Bot Token，例如 123456:ABC-def..." style="width:100%;padding:10px;background:var(--bg-input,#2a3942);border:1px solid var(--border-color,rgba(134,150,160,.15));border-radius:8px;color:inherit;font-size:13px;margin-bottom:10px;box-sizing:border-box;outline:none;"/>
      <input v-model="tgBotName" placeholder="显示名称（可选，如 JZJ Glass Bot）" style="width:100%;padding:10px;background:var(--bg-input,#2a3942);border:1px solid var(--border-color,rgba(134,150,160,.15));border-radius:8px;color:inherit;font-size:13px;margin-bottom:16px;box-sizing:border-box;outline:none;"/>
      <div style="display:flex;gap:8px;justify-content:flex-end;">
        <button @click="showTgModal=false" style="padding:8px 16px;background:transparent;color:var(--text-secondary,#8696a0);border:none;border-radius:6px;cursor:pointer;">取消</button>
        <button @click="tgConnect" :disabled="!tgTokenInput || tgConnecting" style="padding:8px 16px;background:#2AABEE;color:#fff;border:none;border-radius:6px;cursor:pointer;" :class="{ 'opacity-50': !tgTokenInput || tgConnecting }">{{ tgConnecting ? '连接中...' : '连接' }}</button>
      </div>
    </div>
  </div>
</transition>

<!-- 微信直连外贸Agent 二维码弹窗 -->
<transition name="fade">
  <div v-if="showWxQrModal" style="position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;display:flex;align-items:center;justify-content:center;" @click.self="closeWxQr">
    <div style="background:var(--bg-elevated,#202c33);border-radius:16px;padding:24px;width:420px;max-width:92vw;color:var(--text-primary,#e9edef);text-align:center;">
      <div style="font-size:18px;font-weight:600;margin-bottom:8px;display:flex;align-items:center;justify-content:center;gap:8px;">
        <span style="font-size:22px;">💬</span> 微信直连外贸Agent
      </div>
      <div style="font-size:13px;color:var(--text-secondary,#8696a0);margin-bottom:16px;line-height:1.7;">
        打开微信「扫一扫」添加外贸Agent为好友<br/>随时随地做单证、问报价、跟进客户
      </div>
      <div style="background:#fff;border-radius:12px;padding:12px;width:260px;height:260px;margin:0 auto 14px;display:flex;align-items:center;justify-content:center;">
        <img :src="'/wechat-agent-qr.png?v=' + wxQrTs" style="width:236px;height:236px;" alt="外贸Agent微信二维码"/>
      </div>
      <div style="font-size:12px;color:var(--text-secondary,#8696a0);line-height:1.6;">
        <template v-if="wxConnected">✅ 已成功连接，去微信和外贸Agent打个招呼吧！</template>
        <template v-else>⏳ 二维码每 5 分钟自动刷新，请用手机微信扫码连接</template>
      </div>
      <div style="display:flex;gap:8px;justify-content:center;margin-top:16px;">
        <button @click="closeWxQr" style="padding:8px 24px;background:rgba(7,193,96,.12);color:#07c160;border:1px solid rgba(7,193,96,.35);border-radius:8px;cursor:pointer;">关闭</button>
      </div>
    </div>
  </div>
</transition>

<!-- 账号代理配置抽屉 -->
<transition name="slide-right">
  <div v-if="configPanelOpen" class="config-panel-overlay" @click.self="configPanelOpen=false">
    <div class="config-panel-drawer">
      <div class="config-panel-header">
        <h3>代理设置</h3>
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-size:12px;color:var(--text-secondary,#8696a0);">{{ configAccountName }}</span>
          <span class="config-panel-close" @click="configPanelOpen=false">✕</span>
        </div>
      </div>
      <div class="config-panel-body">
        <div class="cp-section-title">代理配置</div>
        <div class="cp-field">
          <label>协议</label>
          <select v-model="configProxyProtocol" class="cp-select">
            <option value="HTTP">HTTP</option>
            <option value="HTTPS">HTTPS</option>
            <option value="SOCKS4">SOCKS4</option>
            <option value="SOCKS5">SOCKS5</option>
          </select>
        </div>
        <div class="cp-field">
          <label>代理主机</label>
          <input v-model="configProxyHost" class="cp-input" placeholder="请输入代理" />
        </div>
        <div class="cp-field">
          <label>代理端口</label>
          <input v-model="configProxyPort" class="cp-input" placeholder="请输入端口" type="number" />
        </div>
        <div class="cp-field">
          <label>用户名</label>
          <input v-model="configProxyUser" class="cp-input" placeholder="请输入账号 (选填)" />
        </div>
        <div class="cp-field">
          <label>密码</label>
          <div style="display:flex;gap:8px;">
            <input v-model="configProxyPass" class="cp-input" style="flex:1" placeholder="请输入密码 (选填)" type="password" />
            <button class="cp-btn cp-btn-sm cp-btn-primary" @click="testProxy" :disabled="configTesting" style="white-space:nowrap;">{{ configTesting ? '测试中...' : '代理检测' }}</button>
          </div>
        </div>
        <div v-if="configTestResult" class="cp-test-result" :style="{color: configTestResult.includes('✅') ? '#00a884' : '#ef4444', borderColor: configTestResult.includes('✅') ? 'rgba(0,168,132,0.3)' : 'rgba(239,68,68,0.3)', background: configTestResult.includes('✅') ? 'rgba(0,168,132,0.1)' : 'rgba(239,68,68,0.1)'}">{{ configTestResult }}</div>
        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px;">
          <button class="cp-btn cp-btn-primary" @click="saveProxyConfig">保存</button>
        </div>
      </div>
    </div>
  </div>
</transition>
</template>

<script setup>
import EmailChannelView from '../components/EmailChannelView.vue';
import { ref, computed, onMounted, onUnmounted, watch, nextTick, reactive } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '../stores/auth.js';
import { useChatStore } from '../stores/chat.js';
import { initSocket, useSocket } from '../utils/socket.js';
import api from '../utils/api.js';
import QRCode from 'qrcode';
import { LANG_OPTIONS as _LANG_200, LANG_OPTIONS_WITH_AUTO as _LANG_AUTO_200 } from '../utils/languages.js';
import { ElMessage, ElMessageBox } from 'element-plus';
import { QuestionFilled, Upload } from '@element-plus/icons-vue';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const chatStore = useChatStore();

// ====== L2: Business Confirmation ======
const bizConfirmPending = ref([]);
const currentBizConfirmIdx = ref(0);
const bizConfirmDismissed = ref(new Set());

async function loadBizConfirmPending() {
  try {
    const token = localStorage.getItem('token');
    const resp = await fetch('/api/customers/pending-business-check', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (!resp.ok) return;
    const data = await resp.json();
    bizConfirmPending.value = (data.pending || []).filter(
      c => !bizConfirmDismissed.value.has(c.id)
      && !String(c.jid || '').endsWith('@telegram')
    );
    if (currentBizConfirmIdx.value >= bizConfirmPending.value.length) {
      currentBizConfirmIdx.value = 0;
    }
  } catch (e) {
    console.warn('[bizConfirm] load error:', e);
  }
}

async function onConfirmBusiness(isBusiness) {
  const current = bizConfirmPending.value[currentBizConfirmIdx.value];
  if (!current) return;
  // L2新需求：「标记为业务客户」先弹确认提示，说明按钮含义；「忽略」直接执行
  if (isBusiness) {
    try {
      await ElMessageBox.confirm(
        `即将为「${current.displayName}」自动建档，建档后将进入客户管理`,
        '确认业务客户',
        { confirmButtonText: '确认建档', cancelButtonText: '取消', type: 'warning' }
      );
    } catch { return; } // 用户取消，不执行
  }
  try {
    const token = localStorage.getItem('token');
    const resp = await fetch('/api/customers/pending-business-check/' + current.id, {
      method: 'PUT',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ isBusiness })
    });
    if (resp.ok) {
      window.dispatchEvent(new CustomEvent('l2-biz-confirmed', { detail: { id: current.id } }));
      bizConfirmDismissed.value.add(current.id);
      bizConfirmPending.value.splice(currentBizConfirmIdx.value, 1);
      if (currentBizConfirmIdx.value >= bizConfirmPending.value.length) {
        currentBizConfirmIdx.value = 0;
      }
      if (isBusiness) ElMessage.success('已自动建档，可在客户管理中查看');
    }
  } catch (e) {
    console.warn('[bizConfirm] update error:', e);
  }
}

function onViewBizConversation() {
  const current = bizConfirmPending.value[currentBizConfirmIdx.value];
  if (!current || !current.jid) return;
  router.push({ path: '/chat', query: { jid: current.jid } });
}

// ========== 折叠状态 ==========
const platformCollapsed = ref(localStorage.getItem('platform-collapsed') === 'true');
const feedbackOpen = ref(false);
const expandedKeys = ref({});
const isDark = ref((localStorage.getItem('crm-theme') || 'dark') === 'dark');
// 初始化时立即同步data-theme属性（防止刷新后闪回默认深色）
document.documentElement.setAttribute('data-theme', isDark.value ? 'dark' : 'light');
const accountsCollapsed = ref(localStorage.getItem('accounts-collapsed') === 'true');
const chatlistCollapsed = ref(false);
// ── 功能面板状态 ──
const activePanel = ref(null); // 默认收起面板（右侧导航列显示图标+文字，点击图标再展开）
const lastActivePanel = ref('aitalk');
const panelWidth = ref((() => {
  const v = parseInt(localStorage.getItem('crm-function-panel-width') || localStorage.getItem('panel-width') || '360');
  if (isNaN(v) || v < 280 || v > 600) return 360;
  return v;
})());
const iconbarCollapsed = ref(localStorage.getItem('iconbar-collapsed') ? localStorage.getItem('iconbar-collapsed') === '1' : false);
const aiMiniMode = ref(false);
const chatViewRef = ref(null);
// ── AI 话术面板 v2 状态 ──
const aitalkModel = ref(localStorage.getItem('crm_aitalk_model') || '');
// 【自动生成开关】默认开启（仅当存值为 '0' 时关闭）；localStorage 持久化，与 crm_aitalk_model 同一 UI 偏好机制
// 注意：main.js 的构建版本清理机制会在新部署后重置非白名单偏好（本开关与模型选择同），刷新页面不受影响
const aitalkAutoGen = ref(localStorage.getItem('crm_script_autogen') !== '0');
watch(aitalkAutoGen, (v) => localStorage.setItem('crm_script_autogen', v ? '1' : '0'));
const aiModels = ref([]);
const aitalkLoading = ref(false);
const aitalkError = ref('');
const aitalkMode = ref('quick');
const aitalkTargetLang = ref('follow');
const TARGET_LABEL = { follow: '🔍 跟随翻译设置', ar: 'العربية (阿拉伯语)', en: 'English (英语)', zh: '中文' };

function resolveTargetLang() {
  if (aitalkTargetLang.value && aitalkTargetLang.value !== 'follow') {
    return aitalkTargetLang.value;
  }
  const ts = chatStore.translationSettings || {};
  const t = ts.sendTargetLang;
  if (t && t !== 'auto' && ['ar','en','zh','es','fr','de','ja','ko','pt','ru','it','tr','th','vi','id','hi','nl'].includes(t)) {
    return t;
  }
  return 'auto';
}
const aiMessages = ref([]);
const aitalkInputText = ref('');
const aitalkScrollRef = ref(null);
const aitalkInputRef = ref(null);
const showScrollDownBtn = ref(false);
let aitalkLastRequest = null;
let aitalkMsgIdSeq = 0;
const nextAitalkMsgId = () => `aim-${++aitalkMsgIdSeq}-${Date.now()}`;

async function loadAiModels() {
  try {
    const { data } = await api.get('/ai/models');
    const list = Array.isArray(data?.models) ? data.models : [];
    aiModels.value = list;
    if (list.length) {
      // 自动模式：跟随系统默认模型（当前首选 GPT-4o）
      const def = list.find(m => m.isDefault) || list[0];
      const saved = localStorage.getItem('crm_aitalk_model');
      const exists = list.find(m => m.key === saved);
      if (!exists || saved !== def.key) {
        aitalkModel.value = def.key;
        localStorage.setItem('crm_aitalk_model', def.key);
      } else {
        aitalkModel.value = saved;
      }
    }
  } catch (e) {
    aiModels.value = [];
  }
}
loadAiModels();

function inqTypeClass(cat) {
  const map = { '信息型':'info','价格型':'price','样品型':'sample','资质型':'cert','合作型':'coop','拒绝型':'reject','转介绍型':'refer' };
  return map[cat] || 'info';
}
function inqTypeIcon(cat) {
  const map = { '信息型':'❓','价格型':'💰','样品型':'📦','资质型':'📜','合作型':'🤝','拒绝型':'🚫','转介绍型':'🔗' };
  return map[cat] || '❓';
}
function autoDir(text) {
  if (!text) return 'auto';
  return /[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff]/.test(text) ? 'rtl' : 'auto';
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
/** Render markdown-lite to HTML (bold/italic/headings/lists/tables). */
function renderMarkdown(raw) {
  if (!raw) return '';
  let s = escapeHtml(raw);
  // fenced code
  s = s.replace(/```([\s\S]*?)```/g, (m, code) =>
    '<pre style="background:#111b21;border-radius:6px;padding:10px;overflow-x:auto;font-size:12px;line-height:1.5;color:#d1d7db;margin:6px 0;white-space:pre-wrap"><code>' + code.replace(/^\n+/, '').replace(/\n+$/, '') + '</code></pre>'
  );
  s = s.replace(/`([^`\n]+)`/g, '<code style="background:#111b21;padding:1px 5px;border-radius:3px;font-size:12.5px;color:#e9edef">$1</code>');
  // pipe tables
  const lines = s.split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i+1])) {
      const headerCells = line.split('|').slice(1,-1).map(c => c.trim());
      i += 2;
      const rows = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        rows.push(lines[i].split('|').slice(1,-1).map(c => c.trim()));
        i++;
      }
      let tbl = '<div style="overflow-x:auto;margin:8px 0"><table style="width:100%;border-collapse:collapse;font-size:12.5px;background:#111b21;border-radius:6px;overflow:hidden">';
      tbl += '<thead><tr>';
      for (const h of headerCells) tbl += '<th style="padding:7px 9px;text-align:left;border-bottom:1px solid #2a3942;color:#00a884;font-weight:600;white-space:nowrap">' + _mdInline(h) + '</th>';
      tbl += '</tr></thead><tbody>';
      for (const r of rows) {
        tbl += '<tr>';
        for (let ci=0; ci<headerCells.length; ci++) {
          const cell = r[ci] !== undefined ? r[ci] : '';
          tbl += '<td style="padding:7px 9px;border-bottom:1px solid #1f2c33;color:#d1d7db;word-break:break-word;vertical-align:top">' + _mdInline(cell) + '</td>';
        }
        tbl += '</tr>';
      }
      tbl += '</tbody></table></div>';
      out.push(tbl);
      continue;
    }
    out.push(line); i++;
  }
  s = out.join('\n');
  // headings (h1 treated as title, center)
  s = s.replace(/^###\s+(.+)$/gm, '<h3 style="color:#e9edef;font-size:13.5px;font-weight:700;margin:12px 0 6px;padding-bottom:4px;border-bottom:1px solid #2a3942">$1</h3>');
  s = s.replace(/^##\s+(.+)$/gm, '<h2 style="color:#e9edef;font-size:15px;font-weight:700;margin:14px 0 8px">$1</h2>');
  s = s.replace(/^#\s+(.+)$/gm, '<h1 style="color:#fff;font-size:17px;font-weight:700;margin:8px 0 12px;text-align:center">$1</h1>');
  s = _mdBlockInline(s);
  // lists (naive)
  s = s.replace(/(?:^|\n)\s*[-•]\s+/g, '\n<li style="margin-left:18px;list-style:disc;margin-bottom:3px;color:#d1d7db">');
  s = s.replace(/(<li[^>]*>)([\s\S]*?)(?=(?:<li[^>]*>)|(?:<h[1-3]>)|(?:<div)|(?:<table)|$)/g, (m, tag, body) => tag + body.replace(/\n/g, '<br>') + '</li>');
  // hr
  s = s.replace(/^\s*---+\s*$/gm, '<hr style="border:none;border-top:1px solid #2a3942;margin:10px 0">');
  // paragraphs: double line-break
  s = s.replace(/\n{2,}/g, '<br><br>');
  s = s.replace(/\n/g, '<br>');
  return s;
}
/** Split markdown into sections by ## headings; each section: {icon?, title, bodyHtml} */
function splitDocSections(md) {
  if (!md) return [];
  const raw = String(md).replace(/\r/g, '');
  // Extract h1 as title if present
  let title = '';
  let content = raw;
  const h1m = raw.match(/^#\s+(.+)$/m);
  if (h1m) {
    title = h1m[1].trim();
    content = raw.replace(h1m[0], '').trim();
  }
  // Split on ## headings
  const parts = content.split(/^##\s+/m).filter(p => p && p.trim());
  const sections = [];
  for (const p of parts) {
    const lines = p.split('\n');
    const headLine = lines[0].trim();
    const body = lines.slice(1).join('\n').trim();
    // detect icon/emoji prefix in header
    let icon = '';
    let headText = headLine;
    const emoMatch = headLine.match(/^([^\w\u4e00-\u9fff#\s]{1,4}|:[a-z]+:)\s*(.*)$/);
    if (emoMatch) { icon = emoMatch[1]; headText = emoMatch[2] || headLine; }
    sections.push({ icon: icon || _guessSectionIcon(headText), title: headText, bodyHtml: renderMarkdown(body) });
  }
  // If no sections (no ##), put everything as one overview block
  if (sections.length === 0 && content.trim()) {
    sections.push({ icon: '📄', title: '单证内容', bodyHtml: renderMarkdown(content.trim()) });
  }
  return { title, sections };
}
function _guessSectionIcon(t) {
  if (!t) return '📄';
  const s = t.toLowerCase();
  if (/卖方|seller|shipper|出口商|发货人|出票人|我方|公司信息|seller info/i.test(s)) return '🏢';
  if (/买方|buyer|consignee|收货人|客户|applicant|importer/i.test(s)) return '👤';
  if (/产品|product|goods|item|明细|商品|货物|description/i.test(s)) return '📦';
  if (/付款|payment|payment terms|terms of payment|tt|l\/c|信用证/i.test(s)) return '💳';
  if (/交货|delivery|shipment|装运|交期|delivery time/i.test(s)) return '🚚';
  if (/价格|price|amount|total|total amount|金额|总额|单价|贸易术语|fob|cif|cfr|成交方式/i.test(s)) return '💰';
  if (/包装|packing|装箱|毛重|净重|体积|weight/i.test(s)) return '📦';
  if (/港口|port|loading|discharge|起运|运抵|目的港|装运港/i.test(s)) return '⚓';
  if (/集装箱|container|箱号/i.test(s)) return '🚢';
  if (/签章|signature|盖章|签署|sign/i.test(s)) return '✍️';
  if (/备注|remark|note|others|其他|misc/i.test(s)) return '📝';
  if (/编号|no\.?|number|invoice no|合同号|发票号|日期|date/i.test(s)) return '🔖';
  if (/银行|bank|beneficiary|账号|bank info/i.test(s)) return '🏦';
  if (/原产|origin|made in|原产地/i.test(s)) return '🌏';
  if (/条款|terms|clause|conditions|quality|warranty|dispute|不可抗力|争议|质量/i.test(s)) return '📜';
  if (/报关|申报|customs|申报日期|经营单位|报关单|hs编码|hs code|商品项号|征免|许可证|监管/i.test(s)) return '🛃';
  if (/保险|insurance|保费/i.test(s)) return '🛡️';
  if (/运费|freight/i.test(s)) return '🚛';
  return '📄';
}
function _mdInline(t) {
  return String(t).replace(/\*\*([^*]+)\*\*/g, '<b style="color:#e9edef;font-weight:700">$1</b>')
                  .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<i>$2</i>');
}
function _mdBlockInline(s) {
  s = s.replace(/\*\*([^*]+)\*\*/g, '<b style="font-weight:700;color:#e9edef">$1</b>');
  s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<i style="color:#d1d7db">$2</i>');
  return s;
}
/** Convert markdown to plain text (strip markdown symbols, keep tables as aligned text) */
function markdownToPlainText(md) {
  if (!md) return '';
  let s = String(md).replace(/\r/g, '');
  // remove fenced code markers
  s = s.replace(/```/g, '');
  // Strip headings
  s = s.replace(/^#{1,6}\s+/gm, '');
  // Bold/italic
  s = s.replace(/\*\*([^*]+)\*\*/g, '$1');
  s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1$2');
  s = s.replace(/`([^`]+)`/g, '$1');
  return s.trim();
}
/** Trigger browser download of text content as .txt file */
function downloadTextAsFile(filename, content, mime='text/plain;charset=utf-8') {
  try {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.style.display = 'none';
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch(e) { return false; }
}
function formatMsgTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function scrollAitalkToBottom(force = false) {
  nextTick(() => {
    const el = aitalkScrollRef.value;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    if (force) showScrollDownBtn.value = false;
  });
}
function scrollAitalkToMsg(msgId, block = 'start') {
  nextTick(() => {
    const container = aitalkScrollRef.value;
    if (!container) return;
    const target = container.querySelector(`[data-mid="${msgId}"]`);
    if (!target) { scrollAitalkToBottom(true); return; }
    const cRect = container.getBoundingClientRect();
    const tRect = target.getBoundingClientRect();
    const offset = tRect.top - cRect.top - 8; // 留8px间距
    container.scrollTop = Math.max(0, container.scrollTop + offset);
    showScrollDownBtn.value = false;
  });
}
function onAitalkScroll() {
  const el = aitalkScrollRef.value;
  if (!el) return;
  const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  showScrollDownBtn.value = !nearBottom;
}
function switchToChatMode() {
  aitalkMode.value = 'chat';
  nextTick(() => aitalkInputRef.value?.focus());
}
function clearAiMessages() {
  aiMessages.value = [];
  aitalkError.value = '';
  showScrollDownBtn.value = false;
}
function appendInput(text) {
  if (aitalkMode.value !== 'chat') switchToChatMode();
  const cur = aitalkInputText.value;
  aitalkInputText.value = cur ? (cur.endsWith(' ') ? cur + text : cur + ' ' + text) : text;
  nextTick(() => { autoGrowAitalkInput(); aitalkInputRef.value?.focus(); });
}
function autoGrowAitalkInput() {
  const ta = aitalkInputRef.value;
  if (!ta) return;
  ta.style.height = 'auto';
  const h = Math.min(ta.scrollHeight, 120);
  ta.style.height = h + 'px';
}
function onAitalkInputKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendAitalkChat();
  }
}

async function copyForeign(text, ev) {
  const ok = await doCopy(text || '');
  const btn = ev?.currentTarget;
  if (btn) {
    const orig = btn.innerHTML;
    btn.innerHTML = ok ? '✓ 已复制' : '复制失败';
    setTimeout(() => { btn.innerHTML = orig; }, 1500);
  }
  if (ok) ElMessage.success('已复制');
  else ElMessage.error('复制失败');
}

async function doCopy(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch(e) { /* fallback */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch(e) {
    return false;
  }
}

function applyForeignToInput(text) {
  activePanel.value = null;
  if (isMobile.value) mobilePanel.value = null; // 同步关闭移动端面板，避免空壳盖住聊天区
  nextTick(() => {
    let inst = chatViewRef.value;
    if (inst && inst.$ && typeof inst.applyAiReply !== 'function') {
      inst = inst.$.exposed || inst;
    }
    if (inst && typeof inst.applyAiReply === 'function') {
      inst.applyAiReply(text);
    } else {
      console.warn('[aitalk] ChatView applyAiReply not found');
    }
  });
}
function useForeignReply(r, ev) {
  if (!r?.foreign) return;
  applyForeignToInput(r.foreign);
  r._applied = true;
  setTimeout(() => { r._applied = false; }, 1500);
}

function startEditReply(r) {
  if (!r) return;
  r._editForeign = r.foreign;
  r._editChinese = r.chinese;
  r._editing = true;
}
function saveEditReply(r) {
  if (!r) return;
  const f = (typeof r._editForeign === 'string') ? r._editForeign : (r.foreign || '');
  const c = (typeof r._editChinese === 'string') ? r._editChinese : (r.chinese || '');
  r.foreign = f.trim();
  r.chinese = c.trim();
  r._editing = false;
  ElMessage.success('已保存修改');
}
function cancelEditReply(r) {
  if (!r) return;
  r._editing = false;
  r._editForeign = undefined;
  r._editChinese = undefined;
}

const AI_PROGRESS_STAGES = ['正在读取对话消息…', '正在分析客户意图…', '正在生成 3 版话术…', '正在收尾，马上出结果…'];
// 【终止按钮】当前 aitalk 面板生成请求的 AbortController（_doAnalyze / sendAitalkChat 共用）
let aitalkAbortCtrl = null;
function stopAitalkGeneration() {
  if (aitalkAbortCtrl) {
    try { aitalkAbortCtrl.abort(); } catch (_) {}
    aitalkAbortCtrl = null;
  }
  aitalkLoading.value = false; // 立即复位 UI；loading 消息由各自 catch 替换为「已终止」提示
}
function formatElapsed(sec) {
  const m = Math.floor(sec / 60), s = sec % 60;
  return m > 0 ? (m + ' 分 ' + s + ' 秒') : (s + ' 秒');
}
function progressStageText(stage) {
  const i = Math.max(0, Math.min(stage || 0, AI_PROGRESS_STAGES.length - 1));
  return AI_PROGRESS_STAGES[i];
}
function startProgressTimer(lm) {
  if (lm._timer) return; // 防重复触发叠加多个 interval
  lm._startTs = lm._startTs || Date.now();
  lm._elapsed = 0;
  lm._stage = 0;
  lm._timer = setInterval(() => {
    // 【计时器修复】loading 消息是 push 进 ref 数组的原始对象，直接改 lm._elapsed 绕过
    // Vue 响应式 proxy 的 set（不触发 trigger），秒数只在其他状态变化间接重渲染时跳动、
    // 随后卡住。改为按 id 定位当前消息并整体替换，保证每秒真实触发一次响应式更新。
    const idx = aiMessages.value.findIndex(m => m.id === lm.id);
    if (idx === -1) { clearInterval(lm._timer); lm._timer = null; return; } // 消息被移除时自清，防泄露
    const cur = aiMessages.value[idx];
    if (!cur.loading) { clearInterval(lm._timer); lm._timer = null; return; } // 已被 replaceMsg 收敛时自清
    const elapsed = Math.floor((Date.now() - lm._startTs) / 1000);
    if (cur._elapsed === elapsed) return;
    const stage = Math.min(AI_PROGRESS_STAGES.length - 1, Math.floor(elapsed / 4));
    aiMessages.value[idx] = { ...cur, _elapsed: elapsed, _stage: stage };
  }, 1000);
}
function pushLoadingMsg() {
  const msg = { id: nextAitalkMsgId(), role: 'assistant', type: 'text', content: '', loading: true, ts: Date.now(), _startTs: Date.now(), _elapsed: 0, _stage: 0, _timer: null };
  aiMessages.value.push(msg);
  scrollAitalkToBottom(true);
  return msg;
}
function replaceMsg(id, patch) {
  const idx = aiMessages.value.findIndex(m => m.id === id);
  if (idx === -1) return;
  aiMessages.value[idx] = { ...aiMessages.value[idx], ...patch, loading: false };
  // 快捷生成话术（replies卡片）→ 滚到该条消息顶部，让话术正文从第一行可见
  if (patch.type === 'replies') {
    scrollAitalkToMsg(id, 'start');
  } else {
    scrollAitalkToBottom(true);
  }
}

const REFINE_CHIPS = ['更简短','更正式','更热情友好','突出价格优势','催促下单','突出质量/工厂实力','延长考虑时间','更口语化'];

function isLegacyRepliesMsg(msg) {
  return msg && msg.type === 'replies' && Array.isArray(msg.content);
}
function isRichRepliesMsg(msg) {
  return msg && msg.type === 'replies' && msg.content && !Array.isArray(msg.content) && Array.isArray(msg.content.replies);
}
function toggleRefineChip(msg, chip) {
  if (!msg) return;
  if (!Array.isArray(msg._refineChips)) msg._refineChips = [];
  const idx = msg._refineChips.indexOf(chip);
  if (idx >= 0) msg._refineChips.splice(idx, 1);
  else msg._refineChips.push(chip);
  // trigger reactivity
  msg._refineChips = [...msg._refineChips];
}
function buildFeedbackFromMsg(msg) {
  const chips = Array.isArray(msg._refineChips) ? msg._refineChips.slice() : [];
  const text = (typeof msg._refineText === 'string' ? msg._refineText.trim() : '');
  const parts = [];
  if (chips.length) parts.push('按以下方向调整：' + chips.join('、'));
  if (text) parts.push(text);
  return parts.join('；');
}

async function _doAnalyze({ feedback, onLoadingReplace, loadingMsg } = {}) {
  if (!chatStore.activeJid) {
    aitalkError.value = '请先选择一个客户会话';
    ElMessage.warning('请先选择一个客户会话');
    return;
  }
  aitalkLoading.value = true;
  aitalkError.value = '';
  if (aitalkAbortCtrl) { try { aitalkAbortCtrl.abort(); } catch (_) {} } // 【终止按钮】防并发残留
  aitalkAbortCtrl = new AbortController();
  const ac = aitalkAbortCtrl;
  const lm = loadingMsg || pushLoadingMsg();
  startProgressTimer(lm);
  if (onLoadingReplace) onLoadingReplace(lm);
  const model = aitalkModel.value || null;
  aitalkLastRequest = { type: 'analyze', jid: chatStore.activeJid, model, feedback };
  try {
    const body = { jid: chatStore.activeJid, accountId: chatStore.activeConversation?.accountId || 1, model, targetLang: resolveTargetLang() };
    if (feedback) body.feedback = feedback;
    const { data } = await api.post('/ai/analyze', body, { signal: ac.signal, timeout: 180000 }); // 【终止按钮】【超时修复】180s
    if (data?.success && Array.isArray(data.data?.replies) && data.data.replies.length) {
      const payload = {
        replies: data.data.replies,
        analysis: data.data.analysis || '',
        designThinking: Array.isArray(data.data.designThinking) ? data.data.designThinking : [],
        suggestions: Array.isArray(data.data.suggestions) ? data.data.suggestions : [],
        inquiryType: data.data.inquiryType || null,
        productAnalysis: data.data.productAnalysis || null,
        isFirstInquiry: data.data.isFirstInquiry === true,
      };
      replaceMsg(lm.id, { role: 'assistant', type: 'replies', content: payload, ts: Date.now(), _refineChips: [], _refineText: '', _refineLoading: false });
    } else {
      replaceMsg(lm.id, { role: 'assistant', type: 'text', content: data?.error || '未生成回复，请重试', error: true, ts: Date.now() });
    }
  } catch (err) {
    if (ac.signal.aborted) { // 【终止按钮】
      replaceMsg(lm.id, { role: 'assistant', type: 'text', content: '⏹ 已终止生成', error: true, ts: Date.now() });
    } else {
      const msg = fmtAiGenErr(err, '生成失败，请重试'); // 【超时修复】
      replaceMsg(lm.id, { role: 'assistant', type: 'text', content: msg, error: true, ts: Date.now() });
    }
  } finally {
    if (lm._timer) clearInterval(lm._timer);
    if (aitalkAbortCtrl === ac) aitalkAbortCtrl = null; // 【终止按钮】
    aitalkLoading.value = false;
    // 滚动已由 replaceMsg 统一处理，这里不再强制滚到底
  }
}

async function triggerQuickGenerate() {
  if (aitalkLoading.value) return;
  await _doAnalyze({});
}

async function triggerRefine(msg) {
  if (!msg || aitalkLoading.value) return;
  const feedback = buildFeedbackFromMsg(msg);
  if (!feedback) {
    ElMessage.warning('请先选个标签或输入你的要求~');
    return;
  }
  msg._refineLoading = true;
  // push a user-style echo msg showing the refinement request, then loading, then new reply
  aiMessages.value.push({
    id: nextAitalkMsgId(), role: 'user', type: 'text',
    content: '🔧 按要求重写：' + feedback, ts: Date.now()
  });
  const loadingMsg = pushLoadingMsg();
  await _doAnalyze({ feedback, loadingMsg });
  msg._refineLoading = false;
}

function buildHistoryForApi() {
  const out = [];
  for (const m of aiMessages.value) {
    if (m.loading || m.error) continue;
    if (m.role === 'user' && typeof m.content === 'string') {
      out.push({ role: 'user', content: m.content });
    } else if (m.role === 'assistant' && m.type === 'text' && typeof m.content === 'string') {
      out.push({ role: 'assistant', content: m.content });
    }
  }
  return out;
}

async function sendAitalkChat() {
  const text = (aitalkInputText.value || '').trim();
  if (!text || aitalkLoading.value) return;
  if (!chatStore.activeJid) {
    ElMessage.warning('请先选择一个客户会话');
    return;
  }
  aiMessages.value.push({ id: nextAitalkMsgId(), role: 'user', type: 'text', content: text, ts: Date.now() });
  aitalkInputText.value = '';
  nextTick(() => autoGrowAitalkInput());
  aitalkLoading.value = true;
  aitalkError.value = '';
  if (aitalkAbortCtrl) { try { aitalkAbortCtrl.abort(); } catch (_) {} } // 【终止按钮】防并发残留
  aitalkAbortCtrl = new AbortController();
  const ac = aitalkAbortCtrl;
  const loadingMsg = pushLoadingMsg();
  startProgressTimer(loadingMsg);
  const history = buildHistoryForApi();
  const model = aitalkModel.value || null;
  aitalkLastRequest = { type: 'chat', jid: chatStore.activeJid, model, text };
  try {
    const { data } = await api.post('/ai/chat', { jid: chatStore.activeJid, accountId: chatStore.activeConversation?.accountId || 1, model, targetLang: resolveTargetLang(), messages: history }, { signal: ac.signal, timeout: 180000 }); // 【终止按钮】【超时修复】180s
    if (data?.success && typeof data.data?.reply === 'string') {
      const reply = data.data.reply;
      const parsed = tryParseRepliesInText(reply);
      if (parsed && parsed.length) {
        replaceMsg(loadingMsg.id, { role: 'assistant', type: 'replies', content: parsed, ts: Date.now() });
      } else {
        replaceMsg(loadingMsg.id, { role: 'assistant', type: 'text', content: reply, ts: Date.now() });
      }
    } else {
      replaceMsg(loadingMsg.id, { role: 'assistant', type: 'text', content: data?.error || 'AI没有返回内容', error: true, ts: Date.now() });
    }
  } catch (err) {
    if (ac.signal.aborted) { // 【终止按钮】
      replaceMsg(loadingMsg.id, { role: 'assistant', type: 'text', content: '⏹ 已终止生成', error: true, ts: Date.now() });
    } else {
      const msg = fmtAiGenErr(err, '请求失败，请重试'); // 【超时修复】
      replaceMsg(loadingMsg.id, { role: 'assistant', type: 'text', content: msg, error: true, ts: Date.now() });
    }
  } finally {
    if (loadingMsg._timer) clearInterval(loadingMsg._timer);
    if (aitalkAbortCtrl === ac) aitalkAbortCtrl = null; // 【终止按钮】
    aitalkLoading.value = false;
    nextTick(() => aitalkInputRef.value?.focus());
  }
}

function fmtAiGenErr(err, fallback) { // 【超时修复】超时错误文案友好化
  const m = err?.message || '';
  if (/timeout of \d+ms exceeded/.test(m)) return '生成超时（已超过180秒），请重试或更换模型';
  return err?.response?.data?.error || m || fallback;
}

function tryParseRepliesInText(text) {
  if (!text) return null;
  // 【DeepSeek JSON修复】多候选健壮提取：原文 → 各 ```json 围栏块 → 配平括号扫描（字符串/转义感知）
  const candidates = [];
  const t = String(text).trim();
  if (t) candidates.push(t);
  const fenceRe = /```(?:json)?\s*([\s\S]*?)\s*```/gi;
  let fm;
  while ((fm = fenceRe.exec(text)) !== null) {
    if (fm[1] && fm[1].trim()) candidates.push(fm[1].trim());
  }
  let depth = 0, start = -1, inStr = false, esc = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') { inStr = true; continue; }
    if (ch === '{') { if (depth === 0) start = i; depth++; }
    else if (ch === '}') {
      if (depth > 0) {
        depth--;
        if (depth === 0 && start !== -1) { candidates.push(text.slice(start, i + 1)); start = -1; }
      }
    }
  }
  const tryOne = (cand) => {
    try {
      const obj = JSON.parse(cand);
      if (obj && Array.isArray(obj.replies)) {
        return obj.replies.filter(r => r && (r.foreign || r.chinese)).slice(0,3).map((r,i) => ({
          name: typeof r.name === 'string' && r.name.trim() ? r.name.trim() : ['版本一','版本二','版本三'][i],
          desc: typeof r.desc === 'string' ? r.desc.trim() : '',
          foreign: typeof r.foreign === 'string' ? r.foreign.trim() : '',
          chinese: typeof r.chinese === 'string' ? r.chinese.trim() : '',
        }));
      }
    } catch (_) {}
    return null;
  };
  for (const cand of candidates) { const r = tryOne(cand); if (r) return r; }
  // 【DeepSeek JSON修复】字符串内原始控制字符（字面 \n \t 等）清洗后再试一轮
  const sanitizeCtrl = (s) => {
    let out = '', is = false, e2 = false;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (is) {
        if (e2) { out += ch; e2 = false; continue; }
        if (ch === '\\') { out += ch; e2 = true; continue; }
        if (ch === '"') { out += ch; is = false; continue; }
        const c = ch.charCodeAt(0);
        if (c === 10) { out += '\\n'; continue; }
        if (c === 13) { out += '\\r'; continue; }
        if (c === 9) { out += '\\t'; continue; }
        if (c < 32) { out += ' '; continue; }
        out += ch; continue;
      }
      if (ch === '"') is = true;
      out += ch;
    }
    return out;
  };
  for (const cand of candidates) { const r = tryOne(sanitizeCtrl(cand)); if (r) return r; }
  // 【DeepSeek JSON修复】提取失败：保留现状兜底（调用方展示原文），仅在疑似JSON时告警
  if (/"replies"|```|^\s*\{/.test(t)) console.warn('[aitalk] tryParseRepliesInText: JSON extract failed, show raw text');
  return null;
}

function sendQuickPrompt(prompt) {
  if (aitalkLoading.value) return;
  if (!chatStore.activeJid) {
    ElMessage.warning('请先选择一个客户会话');
    return;
  }
  if (aitalkMode.value !== 'chat') switchToChatMode();
  aitalkInputText.value = prompt;
  nextTick(() => sendAitalkChat());
}

async function retryLastRequest() {
  const req = aitalkLastRequest;
  if (!req) return;
  if (req.type === 'analyze') {
    await triggerQuickGenerate();
  } else {
    aitalkInputText.value = req.text || '';
    await sendAitalkChat();
  }
}

watch(() => chatStore.activeJid, () => {
  aiMessages.value = [];
  aitalkError.value = '';
  showScrollDownBtn.value = false;
});

// ─── 🤖 Copilot 自动话术触发 ───
// 监听当前会话的最新消息：客户来新消息 → 自动打开话术面板并生成3条回复
let copilotLastMsgKey = null;
let copilotTimer = null;
function triggerCopilotForMsg() {
  if (!aitalkAutoGen.value) return; // 【自动生成开关】关闭：不自动弹面板/生成
  if (activePlatform.value !== 'communication') return;
  if (activeChannel.value !== 'whatsapp') return;
  const jid = chatStore.activeJid;
  if (!jid) return;
  const list = chatStore.messages?.[jid];
  if (!list || !list.length) return;
  const msg = list[list.length - 1];
  if (!msg || msg.fromMe) return;
  // 用消息的唯一key去重（id+时间戳+fromMe）
  const msgKey = (msg.id || msg.waMessageId || '') + '|' + (msg.timestamp || 0);
  if (copilotLastMsgKey === msgKey) return;
  copilotLastMsgKey = msgKey;
  // PC端：面板收着或已经在aitalk/ai时，自动切到aitalk
  // 手机端：不强制弹出（避免抢占聊天页），用户点💬按钮时再生成
  if (!isMobile.value) {
    const stayPanels = ['customer', 'company', 'documents', 'freight', 'worldclock', 'forex', 'translate', 'requirement'];
    const shouldAutoOpen = activePanel.value === null || activePanel.value === 'aitalk' || activePanel.value === 'ai';
    if (shouldAutoOpen && activePanel.value !== 'aitalk') {
      // 直接设置面板为 aitalk（不走 switchPanel：它有 toggle 收起 + 300ms 防抖，会吞掉第二条消息的二次触发）
      activePanel.value = 'aitalk';
      aiMiniMode.value = false;
      aitalkError.value = '';
    }
  }
  // 延迟触发（等消息渲染、翻译完成）
  if (copilotTimer) clearTimeout(copilotTimer);
  copilotTimer = setTimeout(() => {
    if (!aitalkAutoGen.value) return; // 【自动生成开关】延迟期间被关闭则取消
    if (!isMobile.value && activePanel.value === 'aitalk') {
      aiMessages.value = [];
      aitalkError.value = '';
      _doAnalyze({});
    }
  }, 600);
}

watch(
  () => {
    const jid = chatStore.activeJid;
    if (!jid) return 'no-jid';
    const list = chatStore.messages?.[jid];
    if (!list || !list.length) return 'empty:' + jid;
    const last = list[list.length - 1];
    if (!last) return 'no-last:' + jid;
    // 返回长度+末位fromMe状态+id组合，既能捕获新消息也能捕获末位替换
    return (last.fromMe ? 'me:' : 'them:') + list.length + ':' + (last.id || last.waMessageId || '') + ':' + (last.timestamp || 0);
  },
  (newVal, oldVal) => {
    if (!newVal || newVal.startsWith('no-jid') || newVal.startsWith('empty:') || newVal.startsWith('no-last:')) return;
    if (newVal.startsWith('them:')) {
      // 新的末位消息是对方消息，触发copilot
      triggerCopilotForMsg();
    }
  },
  { flush: 'post' }
);

// 切换会话时重置copilot状态，避免旧会话的最后一条被当作新消息触发
watch(() => chatStore.activeJid, () => {
  copilotLastMsgKey = null;
  if (copilotTimer) { clearTimeout(copilotTimer); copilotTimer = null; }
});

// 手机端：用户打开aitalk面板时，如果有新客户消息未生成，自动生成
watch(activePanel, (p) => {
  if (isMobile.value && p === 'aitalk') {
    if (!aitalkAutoGen.value) return; // 【自动生成开关】关闭：手机端也不自动生成
    setTimeout(() => {
      const hasContent = aiMessages.value.some(m => !m.loading && !m.error && (typeof m.content === 'string' ? m.content.trim().length > 0 : (m.content?.replies?.length > 0)));
      if (!hasContent && aitalkLoading.value === false) {
        _doAnalyze({});
      }
    }, 300);
  }
});

const aiWidth = computed(() => panelWidth.value);
const aiCollapsed = computed(() => activePanel.value !== 'ai');
const panelCollapsed = computed(() => activePanel.value === null);
const channelDropdown = ref(false);
const activeFilter = ref('all');
const mobileFilterMenuOpen = ref(false);
const channelSheetOpen = ref(false);
const waAccountsRaw = ref([]);
const waAccountsLoading = ref(false);
async function loadWaAccounts() {
  try {
    waAccountsLoading.value = true;
    const { data } = await api.get('/accounts');
    waAccountsRaw.value = (data || []).filter(a => a.platform === 'whatsapp');
  } catch(e) {
    console.warn('[Layout] loadWaAccounts error:', e.message);
  } finally {
    waAccountsLoading.value = false;
  }
}
const waAccounts = computed(() => {
  return waAccountsRaw.value.map(a => ({
    id: a.id,
    name: a.profileName || a.pushName || a.name || a.phone || a.instanceName || 'WhatsApp',
    phone: a.phone || '',
    avatar: a.profilePicUrl || a.avatarUrl || null,
    color: '#' + ((a.id * 2654435761) >>> 0).toString(16).slice(-6).padStart(6, '0'),
    online: a.status === 'connected' || a.connectionStatus === 'open',
    instanceName: a.instanceName,
    proxyIp: a.proxyIp || null,
    proxyPort: a.proxyPort || null,
    connectionStatus: a.connectionStatus || a.status,
    profilePicUrl: a.profilePicUrl || null,
  }));
});
const currentWaAccountId = ref(null);
const accColors = ['#4A90D9', '#50C878', '#FF6B6B', '#FFB347', '#9B59B6', '#1ABC9C'];
function accColor(accId) {
  if (!accId) return '#888';
  return accColors[(accId - 1) % accColors.length];
}
function switchWaAccount(id) {
  // 修复：点击已选账号时保持选中并强制重新加载，不再 toggle 取消选中置 null（避免列表被隐藏）
  const newId = id;
  currentWaAccountId.value = newId;
  // 同步到全局 store，作为 ChatView 登录态/列表栏门控基准
  chatStore.currentWaAccountId = newId;
  // 切换账号时清空当前会话，避免显示上一个账号的对话
  chatStore.activeJid = null;
  // 清除消息缓存，避免残留旧数据
  chatStore.messages = {};
  // 更新连接状态：根据选中账号的在线状态设置
  if (newId != null) {
    const acc = waAccounts.value.find(a => a.id === newId);
    chatStore.connectionStatus = (acc && acc.online) ? 'connected' : 'disconnected';
    chatStore.connectedPhone = acc ? (acc.phone || null) : null;
    chatStore.pushName = acc ? (acc.name || acc.phone || null) : null;
  } else {
    // null = 全部账号，任一在线即视为已连接
    const anyOnline = waAccounts.value.some(a => a.online);
    chatStore.connectionStatus = anyOnline ? 'connected' : 'disconnected';
    chatStore.connectedPhone = null;
    chatStore.pushName = null;
  }
  // Filter conversations by accountId - null means show all
  if (chatStore.setAccountFilter) {
    chatStore.setAccountFilter(newId);
  }
  // Re-fetch conversations with new account filter
  if (chatStore.fetchConversations) {
    chatStore.fetchConversations().catch(e => console.error('Refetch convs after account switch failed:', e));
  }
}
const mobileChannelBadge = computed(() => {
  if (activeChannel.value === 'whatsapp') return (chatStore.followupCounts?.firstResponse || 0) + (chatStore.followupCounts?.total || 0);
  if (activeChannel.value === 'telegram') return tgUnreadTotal.value || 0;
  if (activeChannel.value === 'email') return emailUnreadTotal.value || 0;
  return 0;
});
function onMhTitleClick() {
  // TradeAgent/Assistant：无论是否在对话中，都回到欢迎页
  if (activePlatform.value === 'assistant' || activePlatform.value === 'trade-agent') {
    goHome();
    return;
  }
  if (mobileInConv.value) {
    if (activeChannel.value === 'whatsapp') openMhProfile();
    return;
  }
  // 只在客户沟通页打开渠道切换sheet
  if (activePlatform.value !== 'communication') return;
  mobileFilterMenuOpen.value = false;
  mhMenuOpen.value = null;
  channelSheetOpen.value = true;
}
const mobileListFilter = ref('all');
const filters = [
  { key: 'all',     label: '全部',     icon: '' },
  { key: 'unread',  label: '未读',     icon: '' },
  { key: 'starred', label: '特别关注', icon: '⭐' },
];
function onFilterClick(key) {
  activeFilter.value = key;
  const params = {};
  if (key === 'unread') params.filter = 'unread';
  else if (key === 'starred') params.filter = 'starred';
  chatStore.setConvFilter(params);
}
// 手机端筛选（走⋮三点菜单）
function setMobileFilter(key) {
  mobileListFilter.value = key;
  const params = {};
  if (key === 'unread') { params.filter = 'unread'; chatStore.setConvFilter(params); }
  else if (key === 'starred') { params.filter = 'starred'; chatStore.setConvFilter(params); }
  else if (key === 'followup') { chatStore.toggleFollowupsFilter(); }
  else { chatStore.setConvFilter({}); if (chatStore.showFollowupsOnly) chatStore.toggleFollowupsFilter(); }
  activeFilter.value = key === 'followup' ? 'all' : key;
}
function toggleMobileFilter(key) { setMobileFilter(mobileListFilter.value === key ? 'all' : key); }
// 待跟进徽章数字（computed）
const mobileFollowupTotal = computed(() => (chatStore.followupCounts?.total || 0) + (chatStore.followupCounts?.firstResponse || 0));
const urgentCount = computed(() => chatStore.followupCounts?.firstResponse || 0);
const followCount = computed(() => chatStore.followupCounts?.urgent || chatStore.followupCounts?.followup || 0);
const reactivateCount = computed(() => chatStore.followupCounts?.reactivate || 0);
const unreadCount = computed(() => chatStore.conversations?.filter(c => (c.unread || 0) > 0).length || 0);


// 会话搜索
const searchKeyword = ref('');
let searchTimer = null;
function onSearchInput() {
  if (searchTimer) clearTimeout(searchTimer);
  const kw = searchKeyword.value.trim();
  searchTimer = setTimeout(() => {
    chatStore.searchConversations(kw);
  }, 250);
}

// 功能面板拖拽
let panelDragStartX = 0;
let panelDragStartWidth = 0;
function startPanelDrag(e) {
  panelDragStartX = e.clientX;
  panelDragStartWidth = panelWidth.value;
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
  document.addEventListener('mousemove', onPanelDrag);
  document.addEventListener('mouseup', stopPanelDrag);
}
function onPanelDrag(e) {
  const dx = panelDragStartX - e.clientX;
  let w = panelDragStartWidth + dx;
  if (w < 280) w = 280;
  if (w > 600) w = 600;
  panelWidth.value = w;
  aiMiniMode.value = false;
}
function stopPanelDrag() {
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
  document.removeEventListener('mousemove', onPanelDrag);
  document.removeEventListener('mouseup', stopPanelDrag);
  localStorage.setItem('crm-function-panel-width', panelWidth.value);
}

watch(platformCollapsed, v => localStorage.setItem('platform-collapsed', v));
watch(accountsCollapsed, v => localStorage.setItem('accounts-collapsed', v));
watch(activePanel, (v) => {
  // 不持久化activePanel，每次进入默认收起
  if (v) lastActivePanel.value = v;
});
watch(panelWidth, (v) => localStorage.setItem('crm-function-panel-width', v));
watch(iconbarCollapsed, (v) => localStorage.setItem('iconbar-collapsed', v ? '1' : '0'));

// ── 翻译设置（原 ChatView 中的配置，已迁到功能面板） ──
// 200+ 语言目录（来自 utils/languages.js，与后端同步）
const LANG_OPTIONS = _LANG_200;
const LANG_OPTIONS_WITH_AUTO = _LANG_AUTO_200;
const SIZE_OPTIONS = ['12px', '13px', '14px', '15px', '16px', '18px', '20px'];

const transSaving = ref(false);

// ===== 聊天记录导入 =====
const chatImportInput = ref(null);
const importStatus = ref(null);

async function handleChatImport(e) {
  const file = e.target.files[0];
  if (!file) return;

  if (!chatStore.activeJid) {
    importStatus.value = { type: 'error', text: '请先选择一个客户会话' };
    setTimeout(() => { importStatus.value = null; }, 4000);
    e.target.value = '';
    return;
  }

  if (!file.name.endsWith('.txt')) {
    importStatus.value = { type: 'error', text: '只支持 .txt 文件' };
    setTimeout(() => { importStatus.value = null; }, 4000);
    e.target.value = '';
    return;
  }

  if (file.size > 10 * 1024 * 1024) {
    importStatus.value = { type: 'error', text: '文件不能超过10MB' };
    setTimeout(() => { importStatus.value = null; }, 4000);
    e.target.value = '';
    return;
  }

  importStatus.value = { type: 'loading', text: '正在解析导入...' };

  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('contactPhone', chatStore.activeJid);

    const res = await api.post('/chat-import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });

    const data = res.data;
    if (data.success) {
      const _total = data.total ?? data.count;
      if (data.count > 0) {
        importStatus.value = { type: 'success', text: `导入成功！共解析 ${_total} 条消息，新增 ${data.count} 条` };
      } else if (data.skipped > 0) {
        importStatus.value = { type: 'success', text: `消息已存在，${data.skipped} 条重复消息已跳过（共解析 ${_total} 条）` };
      } else {
        importStatus.value = { type: 'error', text: data.error || '未解析到有效消息' };
      }
      // 刷新当前客户的消息列表
      if (chatStore.activeJid) {
        chatStore.fetchMessages(chatStore.activeJid);
      }
    } else {
      importStatus.value = { type: 'error', text: data.error || '导入失败' };
    }
  } catch (err) {
    importStatus.value = { type: 'error', text: '导入失败：' + (err.response?.data?.error || err.message) };
  }

  e.target.value = '';
  setTimeout(() => { importStatus.value = null; }, 5000);
}

const transForm = reactive({
  receiveEnabled: true,
  receiveEngine: 'deepl',
  receiveSourceLang: 'auto',
  receiveTargetLang: 'zh',
  sendEnabled: true,
  sendEngine: 'deepl',
  sendSourceLang: 'auto',
  sendTargetLang: 'en',
  groupAutoTranslate: false,
  blockChinese: true,
  translateConfirm: false,
  translationColor: '#8696a0',
  translationSize: '14px',
});

function syncTransFormFromStore() {
  const s = chatStore.translationSettings || {};
  // Resolve canonical field names (backend returns both UI aliases and internal names)
  const recvEnabled = s.receiveEnabled !== undefined ? s.receiveEnabled : (s.translationEnabled !== undefined ? s.translationEnabled : true);
  const recvEngine = s.receiveEngine || s.translationEngine || 'deepl';
  const recvTarget = s.receiveTargetLang || s.targetLanguage || 'zh';
  const sendEng = s.sendEngine || recvEngine || 'deepl';
  const sendTarget = s.sendTargetLang || s.sendTargetLanguage || 'en';
  Object.assign(transForm, {
    receiveEnabled: recvEnabled !== false,
    receiveEngine: recvEngine,
    receiveSourceLang: s.receiveSourceLang || 'auto',
    receiveTargetLang: recvTarget,
    sendEnabled: s.sendEnabled !== false,
    sendEngine: sendEng,
    sendSourceLang: s.sendSourceLang || 'auto',
    sendTargetLang: sendTarget,
    groupAutoTranslate: !!s.groupAutoTranslate,
    blockChinese: s.blockChinese !== false,
    translateConfirm: !!s.translateConfirm,
    translationColor: s.translationColor || '#8696a0',
    translationSize: s.translationSize || '14px',
  });
  console.log('[transForm] synced color:', transForm.translationColor, 'size:', transForm.translationSize, 'storeColor:', s.translationColor);
}

async function saveTransSettings() {
  console.log('[transForm] saving color:', transForm.translationColor, 'size:', transForm.translationSize);
  transSaving.value = true;
  try {
    const payload = { ...transForm };
    let ok = false;
    if (chatStore.activeJid) {
      try {
        const encodedJid = encodeURIComponent(chatStore.activeJid);
        const { data } = await api.put(`/translation/settings/customer/${encodedJid}`, payload);
        ok = !!(data && data.success);
      } catch (e) {
        console.warn('Per-customer save failed, falling back to global:', e.message);
        ok = await chatStore.updateTranslationSettings(payload);
      }
      if (ok) await chatStore.loadCustomerTranslation(chatStore.activeJid);
    } else {
      ok = await chatStore.updateTranslationSettings(payload);
    }
    if (ok) {
      ElMessage.success('翻译设置已保存（当前客户独立）');
    } else {
      ElMessage.error('保存失败');
    }
  } finally {
    transSaving.value = false;
  }
}

// Watch store translationSettings (changes when switching conversations) and sync transForm
watch(
  () => chatStore.translationSettings,
  () => { syncTransFormFromStore(); },
  { deep: true }
);

// ── 客户资料面板 ──
const CUSTOMER_FIELDS = [
  { key: 'companyName', label: '公司名', required: true, warnIfEmpty: true },
  { key: 'contactName', label: '联系人名' },
  { key: 'title', label: '职位/头衔' },
  { key: 'country', label: '国家/地区' },
  { key: 'city', label: '城市/地区' },
  { key: 'email', label: '邮箱' },
  { key: 'phone', label: '电话/账号', readonly: true },
  { key: 'website', label: '网站' },
  { key: 'source', label: '客户来源', type: 'select', options: [
    { label: 'WhatsApp', value: 'whatsapp' },
    { label: 'Telegram', value: 'telegram' },
    { label: 'Instagram', value: 'instagram' },
    { label: '邮箱', value: 'email' },
    { label: '展会', value: '展会' },
    { label: '手动录入', value: 'manual' },
    { label: '谷歌推广', value: 'google' },
    { label: 'TikTok', value: 'tiktok' },
    { label: 'Facebook', value: 'facebook' },
    { label: 'LinkedIn', value: 'linkedin' },
    { label: '官网', value: 'website' },
    { label: 'YouTube', value: 'youtube' },
    { label: '客户推荐', value: 'referral' },
    { label: '其他', value: 'other' },
  ]},
  { key: 'customerLevel', label: '客户等级', type: 'select', options: [
    { label: 'A 级 - 核心客户', value: 'A' },
    { label: 'B 级 - 意向客户', value: 'B' },
    { label: 'C 级 - 待培育', value: 'C' },
    { label: 'D 级 - 已冷冻', value: 'D' },
  ]},
  { key: 'firstContactAt', label: '首条消息时间', readonly: true, type: 'date' },
  { key: 'lastContactAt', label: '最近联系时间', readonly: true, type: 'date' },
  { key: 'notes', label: '备注', type: 'textarea' },
];

const REQUIREMENT_FIELDS_DEF = [
  { key: 'requirementProducts', label: '意向产品', icon: '📦', type: 'textarea' },
  { key: 'requirementBudget',   label: '预算/目标价', icon: '💰' },
  { key: 'requirementQuantity', label: '采购数量',   icon: '🔢' },
  { key: 'requirementDelivery', label: '交期要求',   icon: '📅' },
];

const PROFILE_TABS = [
  { key: 'basic',     icon: '📋', label: '基本' },
  { key: 'requirement', icon: '🎯', label: '需求' },
  { key: 'followups', icon: '📝', label: '跟进' },
];
const CUSTOMER_FIELD_LABELS = Object.fromEntries(CUSTOMER_FIELDS.map(f => [f.key, f.label]));

const emptyCustomer = () => ({
  jid: null, name: '', companyName: '', contactName: '', country: '', city: '', title: '',
  email: '', website: '', phone: '', notes: '', source: 'whatsapp', customerLevel: 'C',
  tags: [], firstContactAt: null, lastContactAt: null,
  bgReport: null, bgUpdatedAt: null,
  requirementProducts: '', requirementBudget: '', requirementQuantity: '',
  requirementDelivery: '', requirementSummary: '',
});

const customerData = ref(emptyCustomer());
const customerEditMode = ref(false);
const customerSaving = ref(false);
const customerExtractLoading = ref(false);
const customerExtractResult = ref(null);
const customerAskLoading = ref(false);
const customerAskReplies = ref([]);
const bgCheckLoading = ref(false);
const bgCheckReport = ref('');
const bgRatingMap = reactive({}); // jid -> A/B/C/D rating
const bantScoreMap = reactive({}); // jid -> { level, totalScore }
const bantDetailMap = reactive({}); // jid -> full details
const bgMissingInfo = ref([]);
const bgAskReply = ref('');
const bgAskInserted = ref(false);
let customerBackup = null;
// v9.2a customer profile tabs state
const customerTab = ref('basic');
const followUpsList = ref([]);
const followUpsLoading = ref(false);
const followUpSaving = ref(false);
const followUpGenerating = ref(false);
const newFollowUpContent = ref('');


// ── 🎯 需求总结面板状态 ──
const reqData = ref({ contactName: '', name: '', phone: '', requirementProducts: '', requirementQuantity: '', requirementBudget: '', requirementDelivery: '', requirementSummary: '', requirementSource: '' });
const reqSections = ref([]);
const reqEditMode = ref(false);

// 【修复 2026-08-24】需求分析文本清洗：text板块content若是（转义）JSON字符串，提取可读内容，避免裸JSON字符
function cleanReqTextContent(content) {
  if (!content) return '';
  let text = String(content);
  if (!text.includes('\\"') && !/^[{[]/.test(text.trim())) return text;
  let unescaped = text.replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\\\/g, '\\');
  const lines = [];
  const pairRe = /"label"\s*:\s*"([^"]*)"\s*,\s*"value"\s*:\s*"([^"]*)"/g;
  let m; let found = false;
  while ((m = pairRe.exec(unescaped))) { found = true; lines.push(m[1] + '：' + m[2]); }
  if (!found) {
    const titleRe = /"title"\s*:\s*"([^"]*)"/g;
    while ((m = titleRe.exec(unescaped))) { found = true; lines.push(m[1]); }
  }
  if (found) return lines.join('\n');
  return unescaped.replace(/[{}"[\]]/g, '').replace(/,\s*/g, '\n').replace(/\n{2,}/g, '\n').trim() || text;
}

// 解析需求总结（JSON结构化优先，纯文本兜底）
function parseReqSummary(raw) {
  if (!raw) { reqSections.value = []; return; }
  try {
    const firstBrace = raw.indexOf('{');
    const lastBrace = raw.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      const obj = JSON.parse(raw.slice(firstBrace, lastBrace + 1));
      if (obj.sections && Array.isArray(obj.sections)) {
        obj.sections.forEach(s => {
          if (s.type === 'list' && Array.isArray(s.items)) {
            s.items = s.items.map(it => {
              if (typeof it !== 'string') return { title: '', desc: String(it) };
              const m = it.match(/^\*\*(.+?)\*\*[\s：:｜|\-]*([\s\S]*)$/);
              if (m) return { title: m[1].trim(), desc: (m[2]||'').trim() };
              return { title: '', desc: it };
            });
          }
          if (s.type === 'text' && typeof s.content === 'string') {
            s.content = cleanReqTextContent(s.content);
          }
        });
        reqSections.value = obj.sections;
        return;
      }
    }
  } catch(e) { console.warn('parse req JSON failed:', e.message); }
  reqSections.value = [{ icon: '📝', title: '需求总结', type: 'text', content: cleanReqTextContent(raw) }];
}
// 客户画像需求Tab里的需求总结解析（独立于右侧 reqSections，不冲突）
const profileReqSections = computed(() => {
  const raw = customerData.value?.requirementSummary;
  if (!raw) return [];
  try {
    const fb = raw.indexOf('{');
    const lb = raw.lastIndexOf('}');
    if (fb !== -1 && lb > fb) {
      const obj = JSON.parse(raw.slice(fb, lb + 1));
      if (obj.sections && Array.isArray(obj.sections)) {
        return obj.sections.map(s => {
          const sec = { ...s };
          if (sec.type === 'list' && Array.isArray(sec.items)) {
            sec._parsedItems = sec.items.map(it => {
              if (typeof it !== 'string') return { title: '', desc: String(it) };
              const m = it.match(/^\*\*(.+?)\*\*[\s：:｜|\-]*([\s\S]*)$/);
              if (m) return { title: m[1].trim(), desc: (m[2]||'').trim() };
              return { title: '', desc: it };
            });
          }
          if (sec.type === 'table' && Array.isArray(sec.rows)) {
            sec._parsedRows = sec.rows.map(r => ({ label: r.label || '', value: r.value || '' }));
          }
          if (sec.type === 'text' && typeof sec.content === 'string') {
            sec.content = cleanReqTextContent(sec.content);
          }
          return sec;
        });
      }
    }
  } catch(e) { /* 解析失败走纯文本兜底 */ }
  return [];
});
const profileReqIsJson = computed(() => profileReqSections.value.length > 0);
// 客户画像需求Tab：纯文本兜底展示（清洗转义JSON字符）
function displayReqSummaryRaw() {
  const raw = customerData.value?.requirementSummary;
  if (!raw) return '未填写';
  return cleanReqTextContent(raw);
}

const reqSaving = ref(false);
const reqAiLoading = ref(false);
const reqAiHint = ref('');
const reqUpdatedAt = ref(null);
let reqBackup = null;

// ── 📄 客户单证面板状态 ──
const docList = ref([]);
const docLoading = ref(false);
const aiDocLoading = ref(false);
const openAiDocDialog = ref(false);

function formatRelativeTime(d) {
  if (!d) return '';
  const date = new Date(d);
  const now = new Date();
  const diff = (now - date) / 1000;
  if (diff < 60) return '刚刚';
  if (diff < 3600) return Math.floor(diff/60) + '分钟前';
  if (diff < 86400) return Math.floor(diff/3600) + '小时前';
  if (diff < 86400*7) return Math.floor(diff/86400) + '天前';
  return date.toLocaleDateString('zh-CN');
}

function docStatusLabel(s) {
  const map = { DRAFT:'草稿', CONFIRMED:'已确认', SENT:'已发送', PAID:'已付款', CANCELLED:'已取消' };
  return map[s] || s || '草稿';
}

async function loadReqData() {
  if (!chatStore.activeJid) {
    reqData.value = { contactName: '', name: '', phone: '', requirementProducts: '', requirementQuantity: '', requirementBudget: '', requirementDelivery: '', requirementSummary: '', requirementSource: '' };
    reqSections.value = [];
    reqUpdatedAt.value = null;
    return;
  }
  try {
    const { data } = await api.get(`/customers/by-jid/${encodeURIComponent(chatStore.activeJid)}`);
    reqData.value = {
      contactName: data.contactName || data.name || '',
      name: data.name || '',
      phone: data.phone || '',
      requirementProducts: data.requirementProducts || '',
      requirementQuantity: data.requirementQuantity || '',
      requirementBudget: data.requirementBudget || '',
      requirementDelivery: data.requirementDelivery || '',
      requirementSummary: data.requirementSummary || '',
      requirementSource: data.requirementSource || '',
    };
    parseReqSummary(data.requirementSummary || '');
    reqUpdatedAt.value = data.requirementUpdatedAt || data.updatedAt || null;
    // Also refresh doc list when customer changes
    loadDocList(data.id);
    // Make sure customerData (used by doc panel header) has id
    if (data.id && !customerData.value.id) customerData.value.id = data.id;
  } catch(e) {
    console.error('loadReqData error', e);
  }
}

async function saveReqData() {
  if (!chatStore.activeJid) return;
  reqSaving.value = true;
  reqAiHint.value = '';
  try {
    const payload = {
      requirementProducts: reqData.value.requirementProducts,
      requirementQuantity: reqData.value.requirementQuantity,
      requirementBudget: reqData.value.requirementBudget,
      requirementDelivery: reqData.value.requirementDelivery,
      requirementSummary: reqData.value.requirementSummary,
      requirementSource: 'manual',
    };
    const { data } = await api.put(`/customers/by-jid/${encodeURIComponent(chatStore.activeJid)}`, payload);
    Object.assign(reqData.value, {
      requirementProducts: data.requirementProducts || '',
      requirementQuantity: data.requirementQuantity || '',
      requirementBudget: data.requirementBudget || '',
      requirementDelivery: data.requirementDelivery || '',
      requirementSummary: data.requirementSummary || '',
      requirementSource: data.requirementSource || 'manual',
    });
    reqUpdatedAt.value = data.requirementUpdatedAt || new Date();
    reqEditMode.value = false;
    ElMessage.success('需求已保存');
  } catch(e) {
    console.error(e);
    ElMessage.error('保存失败');
  } finally {
    reqSaving.value = false;
  }
}


async function runReqAiAnalyze() {
  if (!chatStore.activeJid) return;
  reqAiLoading.value = true;
  reqAiHint.value = '';
  // 重新生成时清空旧结果，让用户感知刷新
  reqData.value.requirementSummary = '';
  reqSections.value = [];
  try {
    // Need numeric customer ID for the ai-requirement endpoint
    const cust = await api.get(`/customers/by-jid/${encodeURIComponent(chatStore.activeJid)}`);
    const cid = cust.data.id;
    if (!cid) { ElMessage.error('客户档案未建立'); return; }
    const { data } = await api.post(`/customers/${cid}/ai-requirement`, { limit: 50 });
    if (data.summary) {
      reqData.value.requirementSummary = data.summary;
      parseReqSummary(data.summary);
    }
    reqData.value.requirementSource = 'ai_summary';
    reqEditMode.value = false;
    reqAiHint.value = 'AI已生成需求分析';
    if (cust.data.id && !customerData.value.id) customerData.value.id = cust.data.id;
    reqUpdatedAt.value = new Date();
  } catch(e) {
    console.error(e);
    const msg = e?.response?.data?.error || e.message || 'AI分析失败';
    ElMessage.error(msg);
  } finally {
    reqAiLoading.value = false;
  }
}

async function loadDocList(customerId) {
  if (!customerId) { docList.value = []; return; }
  docLoading.value = true;
  try {
    const { data } = await api.get(`/customers/${customerId}/documents`);
    docList.value = Array.isArray(data) ? data : (data.documents || data.data || []);
  } catch(e) {
    console.error('loadDocList error', e);
    docList.value = [];
  } finally {
    docLoading.value = false;
  }
}

function newDoc(type) {
  const cid = customerData.value.id;
  if (!cid) { ElMessage.warning('请先在客户资料中建立客户档案'); switchPanel('customer'); return; }
  router.push(`/customers/${cid}/documents/new?type=${type}`);
}

async function aiGenerateDoc(type) {
  if (type && type !== 'PI' && type !== 'QUOTATION') {
    // Called without type from footer - open dialog
    openAiDocDialog.value = true;
    return;
  }
  if (!type) { openAiDocDialog.value = true; return; }
  openAiDocDialog.value = false;
  const cid = customerData.value.id;
  if (!cid) { ElMessage.warning('请先建立客户档案'); return; }
  if (!reqData.value.requirementSummary && !reqData.value.requirementProducts) {
    ElMessage.warning('请先做"客户需求分析"，AI需要需求信息来生成单证');
    switchPanel('requirement');
    return;
  }
  aiDocLoading.value = true;
  try {
    const { data } = await api.post(`/customers/${cid}/ai-document`, { type, limit: 50 });
    if (data.docId) {
      ElMessage.success('AI已生成单证，跳转编辑...');
      setTimeout(() => router.push(`/customers/${cid}/documents/${data.docId}/edit`), 500);
    }
  } catch(e) {
    console.error(e);
    ElMessage.error(e?.response?.data?.error || 'AI生成失败');
  } finally {
    aiDocLoading.value = false;
  }
}

// ── 📄 单证快捷生成面板状态 ──
const DOC_TYPES = [
  { key: 'quotation', icon: '💰', label: '报价单' },
  { key: 'invoice',   icon: '📋', label: 'PI' },
  { key: 'ci',        icon: '🧾', label: 'CI' },
  { key: 'packing',   icon: '📦', label: '装箱单' },
  { key: 'contract',  icon: '📝', label: '销售合同' },
  { key: 'customs',   icon: '🚢', label: '报关单' },
];
const selectedDocType = ref('quotation');
const docMode = ref('quick');
const docQLoading = ref(false);
const docChatLoading = ref(false);
const docMessages = ref([]);  // [{role, content, ts, expanded?}]
const docInputText = ref('');
const docInputRef = ref(null);
const docScrollRef = ref(null);
const docHistoryCollapsed = ref(true);
const docError = ref('');
const docFullView = ref(false);  // full screen preview (simple version)
// ── v3 新增状态：生成后收起芯片、直接编辑、语言切换、PDF发送 ──
const docGenerated = ref(false);
const docLang = ref('zh');
const docLangLabel = ref('中文');
const docEditing = ref(false);
const docEditText = ref('');
const showLangPicker = ref(false);
const showTypeSwitcher = ref(false);
const pdfSending = ref(false);
const pdfDownloading = ref(false);
const DOC_LANGS = [
  { code:'zh', label:'中文', emoji:'🇨🇳' },
  { code:'en', label:'English', emoji:'🇺🇸' },
  { code:'es', label:'Español', emoji:'🇪🇸' },
  { code:'ar', label:'العربية', emoji:'🇸🇦' },
  { code:'fr', label:'Français', emoji:'🇫🇷' },
  { code:'ru', label:'Русский', emoji:'🇷🇺' },
  { code:'pt', label:'Português', emoji:'🇵🇹' },
  { code:'ja', label:'日本語', emoji:'🇯🇵' },
  { code:'de', label:'Deutsch', emoji:'🇩🇪' },
  { code:'ko', label:'한국어', emoji:'🇰🇷' },
  { code:'it', label:'Italiano', emoji:'🇮🇹' },
  { code:'tr', label:'Türkçe', emoji:'🇹🇷' },
];
const currentDocLangMeta = computed(() => DOC_LANGS.find(l => l.code === docLang.value) || DOC_LANGS[0]);
const latestDoc = computed(() => {
  const arr = docMessages.value.filter(m => m.role === 'assistant' && !m.loading && m.content);
  return arr.length ? arr[arr.length - 1] : null;
});
const currentDocLabel = computed(() => {
  const t = DOC_TYPES.find(d => d.key === selectedDocType.value);
  return t ? t.label : '单证';
});
const docCurrentTypeMeta = computed(() => DOC_TYPES.find(d => d.key === selectedDocType.value) || DOC_TYPES[0]);

function resetDocPanel() {
  docMessages.value = [];
  docError.value = '';
  docInputText.value = '';
  docGenerated.value = false;
  docEditing.value = false;
  docEditText.value = '';
  showTypeSwitcher.value = false;
  showLangPicker.value = false;
}
function scrollDocToBottom() {
  nextTick(() => { const el = docScrollRef.value; if (el) el.scrollTop = el.scrollHeight; });
}
async function copyDocText(text, ev) {
  try {
    await navigator.clipboard.writeText(text || '');
    const btn = ev?.currentTarget;
    if (btn) { const orig = btn.innerHTML; btn.innerHTML = '✓ 已复制'; setTimeout(() => { btn.innerHTML = orig; }, 1500); }
    ElMessage.success('已复制到剪贴板');
  } catch(e) { ElMessage.error('复制失败'); }
}
async function downloadDocResult(doc, ev) {
  if (!doc || !doc.content) return;
  pdfDownloading.value = true;
  const btn = ev?.currentTarget;
  const orig = btn?.innerHTML;
  try {
    const { data: pdfBlob } = await api.post('/ai/doc-pdf', {
      docType: doc.typeMeta?.key || selectedDocType.value,
      content: doc.content,
      lang: docLang.value,
    }, { responseType: 'blob' });
    const ts = new Date();
    const pad = n => String(n).padStart(2,'0');
    const fname = `${doc.typeMeta?.label||'单证'}_${ts.getFullYear()}${pad(ts.getMonth()+1)}${pad(ts.getDate())}${pad(ts.getHours())}${pad(ts.getMinutes())}.pdf`;
    const url = URL.createObjectURL(new Blob([pdfBlob], { type: 'application/pdf' }));
    const a = document.createElement('a');
    a.href = url; a.download = fname; document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    if (btn) { btn.innerHTML = '✓'; setTimeout(() => { btn.innerHTML = orig; }, 1500); }
    ElMessage.success('PDF 已下载');
  } catch(e) {
    console.error(e);
    ElMessage.error(e?.response?.data?.error || e?.message || 'PDF下载失败');
  } finally {
    pdfDownloading.value = false;
  }
}
function insertDocToInput(text) {
  // Insert into chat input (similar to applyForeignReply logic but for doc content)
  const plain = markdownToPlainText(text);
  if (!plain) return;
  if (plain.length > 1000) {
    ElMessageBox.confirm(
      '单证内容较长（约' + plain.length + '字），将插入沟通输入框，你可以检查后按Enter发送。',
      '内容较长',
      { confirmButtonText: '继续插入', cancelButtonText: '取消', type: 'info' }
    ).then(() => {
      _doInsertDocToInput(plain);
    }).catch(() => {});
  } else {
    _doInsertDocToInput(plain);
  }
}
function _doInsertDocToInput(text) {
  // Use chatStore.insertToInput which ChatView watches and appends to draftMsg + focuses
  chatStore.insertToInput(text);
  // Also directly try the chatView ref approach for immediate focus
  try {
    let inst = chatViewRef.value;
    if (inst && inst.$ && typeof inst.applyAiReply !== 'function') inst = inst.$.exposed || inst;
    // Don't call applyAiReply (which may trigger translate confirm), just set draftMsg via insertText
  } catch(_) {}
  // Close panel on mobile to show chat input
  if (isMobile.value) mobilePanel.value = null;
  activePanel.value = null;
  ElMessage.success('已填入消息框，按Enter即可发送');
}
async function sendDocNow(doc) {
  if (!doc || !doc.content) return;
  const jid = chatStore.activeJid;
  if (!jid) { ElMessage.warning('请先选择客户'); return; }
  const plain = markdownToPlainText(doc.content);
  try {
    await ElMessageBox.confirm(
      '确定将此' + (doc.typeMeta?.label || '单证') + '直接发送给客户吗？发送后不可撤回。',
      '确认发送',
      { confirmButtonText: '直接发送', cancelButtonText: '取消', type: 'warning' }
    );
  } catch(_) { return; }
  try {
    await chatStore.sendMessage(jid, plain);
    ElMessage.success('已发送');
    if (isMobile.value) mobilePanel.value = null;
    activePanel.value = null;
  } catch(e) {
    ElMessage.error(e?.response?.data?.error || e?.message || '发送失败');
  }
}
function refineDocInline(m) {
  // Switch to chat mode and focus input; optionally pre-seed with hint
  switchDocMode('chat');
  ElMessage.info('已切换到对话模式，请在下方输入修改要求');
}
function saveDocLocal(m, ev) {
  if (!m || !m.content || m._saved) return;
  m._saving = true;
  try {
    // MVP: save to localStorage (no backend schema change)
    const key = 'crm_saved_docs';
    let list = [];
    try { list = JSON.parse(localStorage.getItem(key) || '[]'); } catch(_) { list = []; }
    const savedEntry = {
      id: 'loc-' + m.ts,
      jid: chatStore.activeJid,
      docType: m.typeMeta?.key || selectedDocType.value,
      docTypeLabel: m.typeMeta?.label || currentDocLabel.value,
      content: m.content,
      ts: m.ts,
      savedAt: Date.now(),
    };
    list.unshift(savedEntry);
    // cap to 50 entries
    if (list.length > 50) list = list.slice(0,50);
    localStorage.setItem(key, JSON.stringify(list));
    m._saved = true;
    const btn = ev?.currentTarget;
    if (btn) { const orig = btn.innerHTML; /* keep 已保存 text */ }
    ElMessage.success('已保存到本地档案');
    // Also refresh docList (historical docs from DB) in case user had created formal docs
    if (customerData.value.id) loadDocList(customerData.value.id);
  } catch(e) {
    ElMessage.error('保存失败: ' + (e.message||''));
  } finally {
    m._saving = false;
  }
}
async function runDocGenerate() {
  if (!chatStore.activeJid) { ElMessage.warning('请先选择一个客户会话'); return; }
  if (docQLoading.value) return;
  docQLoading.value = true;
  docError.value = '';
  try {
    const { data } = await api.post('/ai/generate-document', {
      accountId: chatStore.activeConversation?.accountId || 1, jid: chatStore.activeJid, docType: selectedDocType.value,
    });
    if (data?.success && typeof data.content === 'string') {
      const meta = docCurrentTypeMeta.value;
      const rec = { role: 'assistant', content: data.content, ts: Date.now(), typeMeta: meta, version: 1, expanded: true };
      docMessages.value = [rec];
      docGenerated.value = true;
      showTypeSwitcher.value = false;
      ElMessage.success(meta.label + '已生成');
    } else {
      docError.value = data?.error || '生成失败，请重试';
      ElMessage.error(docError.value);
    }
  } catch(err) {
    const msg = err?.response?.data?.error || err?.message || '请求失败';
    docError.value = msg; ElMessage.error(msg);
  } finally {
    docQLoading.value = false;
    scrollDocToBottom();
  }
}
function onDocInputKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendDocChat(); }
}
async function sendDocChat() {
  const text = (docInputText.value || '').trim();
  if (!text || docChatLoading.value) return;
  if (!chatStore.activeJid) { ElMessage.warning('请先选择一个客户会话'); return; }
  docMessages.value.push({ role: 'user', content: text, ts: Date.now() });
  docInputText.value = '';
  docChatLoading.value = true;
  docError.value = '';
  const loadMsg = { role: 'assistant', content: '', loading: true, ts: Date.now() };
  docMessages.value.push(loadMsg);
  scrollDocToBottom();
  try {
    const hist = docMessages.value
      .filter(m => !m.loading && typeof m.content === 'string' && m.content.trim())
      .map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content }));
    const { data } = await api.post('/ai/generate-document', {
      accountId: chatStore.activeConversation?.accountId || 1, jid: chatStore.activeJid, docType: selectedDocType.value, messages: hist,
    });
    if (data?.success && typeof data.content === 'string') {
      const idx = docMessages.value.indexOf(loadMsg);
      const aiCount = docMessages.value.filter(m => m.role === 'assistant' && !m.loading).length + 1;
      const rec = {
        role: 'assistant', content: data.content, ts: Date.now(),
        typeMeta: docCurrentTypeMeta.value, version: aiCount, expanded: false,
      };
      if (idx >= 0) docMessages.value.splice(idx, 1, rec);
      docGenerated.value = true;
      showTypeSwitcher.value = false;
    } else {
      const idx = docMessages.value.indexOf(loadMsg);
      if (idx >= 0) docMessages.value.splice(idx, 1);
      docError.value = data?.error || 'AI没有返回内容';
      ElMessage.error(docError.value);
    }
  } catch(err) {
    const idx = docMessages.value.indexOf(loadMsg);
    if (idx >= 0) docMessages.value.splice(idx, 1);
    const msg = err?.response?.data?.error || err?.message || '请求失败';
    docError.value = msg; ElMessage.error(msg);
  } finally {
    docChatLoading.value = false;
    scrollDocToBottom();
    nextTick(() => docInputRef.value?.focus());
  }
}
function switchDocMode(mode) {
  docMode.value = mode;
  if (mode === 'chat') nextTick(() => docInputRef.value?.focus());
}
function toggleDocExpand(m) { m.expanded = !m.expanded; }

// ── ✏️ 直接编辑模式 ──
const docEditTextarea = ref(null);
function enterDocEdit(doc) {
  if (!doc) doc = latestDoc.value;
  if (!doc) return;
  docEditing.value = true;
  docEditText.value = doc.content || '';
  showLangPicker.value = false;
  nextTick(() => {
    const ta = docEditTextarea.value;
    if (ta) { ta.focus(); ta.scrollTop = 0; }
  });
}
function cancelDocEdit() {
  docEditing.value = false;
  docEditText.value = '';
}
async function applyDocEdit() {
  const text = (docEditText.value || '').trim();
  if (!text) { ElMessage.warning('内容不能为空'); return; }
  if (docChatLoading.value || docQLoading.value) return;
  // Append user message with edited text, call chat-style generate
  const curDoc = latestDoc.value;
  if (curDoc) docMessages.value.push({ role: 'assistant', content: curDoc.content, ts: curDoc.ts });
  docMessages.value.push({ role: 'user', content:
    '请根据以下我直接修改后的文本，整理为格式规范的' + docCurrentTypeMeta.value.label +
    (docLang.value !== 'zh' ? '（' + docLangLabel.value + '）' : '') +
    '，保持我修改的所有内容（包括数据、公司信息、条款），输出规范的Markdown格式：\n\n' + text,
    ts: Date.now()
  });
  docEditing.value = false;
  docEditText.value = '';
  docChatLoading.value = true;
  docError.value = '';
  const loadMsg = { role: 'assistant', content: '', loading: true, ts: Date.now() };
  docMessages.value.push(loadMsg);
  scrollDocToBottom();
  try {
    const hist = docMessages.value
      .filter(m => !m.loading && typeof m.content === 'string' && m.content.trim())
      .map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content }));
    const { data } = await api.post('/ai/generate-document', {
      accountId: chatStore.activeConversation?.accountId || 1, jid: chatStore.activeJid, docType: selectedDocType.value, messages: hist,
    });
    if (data?.success && typeof data.content === 'string') {
      const idx = docMessages.value.indexOf(loadMsg);
      const aiCount = docMessages.value.filter(m => m.role === 'assistant' && !m.loading).length + 1;
      const rec = { role: 'assistant', content: data.content, ts: Date.now(), typeMeta: docCurrentTypeMeta.value, version: aiCount, expanded: true };
      if (idx >= 0) docMessages.value.splice(idx, 1, rec);
      docGenerated.value = true;
      ElMessage.success('已按修改重新整理');
    } else {
      const idx = docMessages.value.indexOf(loadMsg);
      if (idx >= 0) docMessages.value.splice(idx, 1);
      docError.value = data?.error || 'AI没有返回内容';
      ElMessage.error(docError.value);
    }
  } catch(err) {
    const idx = docMessages.value.indexOf(loadMsg);
    if (idx >= 0) docMessages.value.splice(idx, 1);
    docError.value = err?.response?.data?.error || err?.message || '请求失败';
    ElMessage.error(docError.value);
  } finally {
    docChatLoading.value = false;
    scrollDocToBottom();
  }
}

// ── 🌐 语言切换 ──
function toggleLangPicker() {
  showLangPicker.value = !showLangPicker.value;
  showTypeSwitcher.value = false;
}
async function switchDocLang(lang) {
  if (!lang || lang.code === docLang.value) { showLangPicker.value = false; return; }
  if (docChatLoading.value || docQLoading.value) return;
  const curDoc = latestDoc.value;
  if (!curDoc) {
    docLang.value = lang.code; docLangLabel.value = lang.label;
    showLangPicker.value = false;
    return;
  }
  docLang.value = lang.code; docLangLabel.value = lang.label;
  showLangPicker.value = false;
  // Push translation instruction as user message
  docMessages.value.push({ role: 'assistant', content: curDoc.content, ts: curDoc.ts });
  docMessages.value.push({ role: 'user', content:
    '请把以上' + docCurrentTypeMeta.value.label + '完整翻译为' + lang.label +
    '，保持所有表格、条款、金额、编号、公司信息和Markdown格式结构完全不变，只翻译文字内容。',
    ts: Date.now()
  });
  docChatLoading.value = true;
  docError.value = '';
  const loadMsg = { role: 'assistant', content: '', loading: true, ts: Date.now() };
  docMessages.value.push(loadMsg);
  scrollDocToBottom();
  try {
    const hist = docMessages.value
      .filter(m => !m.loading && typeof m.content === 'string' && m.content.trim())
      .map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content }));
    const { data } = await api.post('/ai/generate-document', {
      accountId: chatStore.activeConversation?.accountId || 1, jid: chatStore.activeJid, docType: selectedDocType.value, messages: hist,
    });
    if (data?.success && typeof data.content === 'string') {
      const idx = docMessages.value.indexOf(loadMsg);
      const aiCount = docMessages.value.filter(m => m.role === 'assistant' && !m.loading).length + 1;
      const rec = { role: 'assistant', content: data.content, ts: Date.now(), typeMeta: docCurrentTypeMeta.value, version: aiCount, expanded: true };
      if (idx >= 0) docMessages.value.splice(idx, 1, rec);
      docGenerated.value = true;
      ElMessage.success('已切换为' + lang.label);
    } else {
      const idx = docMessages.value.indexOf(loadMsg);
      if (idx >= 0) docMessages.value.splice(idx, 1);
      docError.value = data?.error || '翻译失败';
      ElMessage.error(docError.value);
    }
  } catch(err) {
    const idx = docMessages.value.indexOf(loadMsg);
    if (idx >= 0) docMessages.value.splice(idx, 1);
    docError.value = err?.response?.data?.error || err?.message || '请求失败';
    ElMessage.error(docError.value);
  } finally {
    docChatLoading.value = false;
    scrollDocToBottom();
  }
}

// ── 📄 PDF预挂到聊天输入框附件条（不直接发送，用户点绿色按钮才发） ──
async function sendDocPdf(doc) {
  if (!doc) doc = latestDoc.value;
  if (!doc || !doc.content) { ElMessage.warning('没有可发送的单证'); return; }
  if (!chatStore.activeJid) { ElMessage.warning('请先选择客户'); return; }
  if (pdfSending.value) return;
  pdfSending.value = true;
  let toast = null;
  try {
    toast = ElMessage({ message: '📄 正在生成PDF，请稍候...', type: 'info', duration: 0 });
    const docKey = doc.typeMeta?.key || selectedDocType.value;
    const { data: pdfBlob } = await api.post('/ai/doc-pdf', {
      docType: docKey,
      content: doc.content,
      lang: docLang.value,
    }, { responseType: 'blob', timeout: 120000 });
    // 服务器错误也会以 blob 形式返回，检测并读出错误消息
    if (pdfBlob && pdfBlob.type && pdfBlob.type.includes('application/json')) {
      const txt = await pdfBlob.text();
      let errMsg = 'PDF生成失败';
      try { errMsg = JSON.parse(txt).error || errMsg; } catch(_) { errMsg = txt || errMsg; }
      throw new Error(errMsg);
    }
    if (!pdfBlob || pdfBlob.size < 1024) {
      throw new Error('PDF文件异常（太小），请重试');
    }
    // 生成文件名
    const ts = new Date();
    const pad = n => String(n).padStart(2,'0');
    const labelMap = { quotation:'报价单', pi:'形式发票', ci:'商业发票', packing:'装箱单', contract:'销售合同', customs:'报关单' };
    const label = labelMap[docKey] || '单证';
    const fname = `${label}_${ts.getFullYear()}${pad(ts.getMonth()+1)}${pad(ts.getDate())}${pad(ts.getHours())}${pad(ts.getMinutes())}.pdf`;
    const pdfFile = new File([pdfBlob], fname, { type: 'application/pdf' });
    // 预挂到附件条
    chatStore.stagePendingMedia(pdfFile, 'document', '');
    // 关闭单证面板回到聊天区
    if (isMobile.value) mobilePanel.value = null;
    activePanel.value = null;
    toast?.close();
    ElMessage.success('📄 PDF已贴到输入框，点绿色发送即可发给客户');
  } catch(e) {
    console.error('PDF预挂失败', e);
    toast?.close();
    let errMsg = 'PDF准备失败';
    if (e?.response?.data) {
      const d = e.response.data;
      if (d instanceof Blob) {
        try { errMsg = JSON.parse(await d.text()).error || errMsg; } catch(_) {}
      } else if (typeof d === 'string') {
        try { errMsg = JSON.parse(d).error || errMsg; } catch(_) { errMsg = d; }
      } else if (d?.error) {
        errMsg = d.error;
      }
    } else if (e?.message) {
      errMsg = e.message;
      if (errMsg === 'Network Error' || e?.code === 'ERR_NETWORK') errMsg = '网络错误，请检查连接';
      else if (e?.code === 'ECONNABORTED' || errMsg.includes('timeout')) errMsg = 'PDF生成超时，请重试';
    }
    ElMessage.error(errMsg);
  } finally {
    pdfSending.value = false;
  }
}

// ── ⇄ 换类型（已生成态下展开芯片） ──
function toggleTypeSwitcher() {
  showTypeSwitcher.value = !showTypeSwitcher.value;
  showLangPicker.value = false;
}
function switchDocTypeFromCompact(type) {
  if (type.key === selectedDocType.value) { showTypeSwitcher.value = false; return; }
  resetDocPanel();
  selectedDocType.value = type.key;
  // auto trigger quick generate
  showTypeSwitcher.value = false;
  nextTick(() => runDocGenerate());
}
function restartDocAll() {
  resetDocPanel();
  selectedDocType.value = 'quotation';
  docMode.value = 'quick';
  docLang.value = 'zh';
  docLangLabel.value = '中文';
}

// ── 点击外部关闭浮层 ──
function onDocActionClickOutside(e) {
  try {
    if (!e.target.closest('.doc-lang-picker') && !e.target.closest('.doc-lang-btn')) showLangPicker.value = false;
    if (!e.target.closest('.doc-type-switcher-pop') && !e.target.closest('.doc-switch-type-btn')) showTypeSwitcher.value = false;
  } catch(_) {}
}

// Watch: reset quick-gen state when switching customer
watch(() => chatStore.activeJid, () => {
  resetDocPanel();
  selectedDocType.value = 'quotation';
  docMode.value = 'quick';
});

// Watch for panel+jid changes to load req/doc data
watch([() => activePanel.value, () => chatStore.activeJid], ([panel, jid]) => {
  if ((panel === 'requirement' || panel === 'documents') && jid) {
    reqAiHint.value = '';
    reqEditMode.value = false;
    loadReqData();
  }
}, { immediate: false });



const SOURCE_LABEL = {whatsapp:'WhatsApp',google:'谷歌推广',tiktok:'TikTok',facebook:'Facebook',instagram:'Instagram',linkedin:'LinkedIn',website:'官网',youtube:'YouTube','展会':'展会',referral:'客户推荐','老客户推荐':'客户推荐','独立站询盘':'官网',proactive:'主动开发',email:'邮件营销',manual:'手动添加',other:'其他'};
function formatField(c, f) {
  let v = c?.[f.key];
  if (v == null || v === '') return '';
  if (f.key === 'source' && SOURCE_LABEL[v]) v = SOURCE_LABEL[v];
  if (f.type === 'date' && v) {
    try { return new Date(v).toLocaleString('zh-CN', { hour12: false }); } catch { return String(v); }
  }
  if (Array.isArray(v)) return v.join(', ');
  return String(v);
}

async function loadCustomer(jid) {
  if (!jid) { customerData.value = emptyCustomer(); customerTab.value = 'basic'; followUpsList.value = []; return; }
  try {
    const { data } = await api.get(`/customers/by-jid/${encodeURIComponent(jid)}`);
    customerData.value = { ...emptyCustomer(), ...data, tags: Array.isArray(data.tags) ? data.tags : [] };
    if (customerData.value.bgReport) { bgCheckReport.value = customerData.value.bgReport; } else { bgCheckReport.value = ''; }
    bgMissingInfo.value = []; bgAskReply.value = ''; bgAskInserted.value = false;
    customerTab.value = 'basic';
    loadFollowUps();
    // Load bg rating from structured check
    try {
      const { data: bgData } = await api.get(`/customers/by-jid/${encodeURIComponent(jid)}/bg-check`);
      if (bgData && bgData.rating) bgRatingMap[jid] = bgData.rating;
    } catch {}
  } catch (e) {
    // L2: by-jid 404（无消息不建档）属正常态 —— 静默清空档案面板，不弹错误提示
    if (e?.response?.status !== 404) console.error('loadCustomer error', e);
    customerData.value = { ...emptyCustomer(), jid, phone: jid.split('@')[0] };
    bgCheckReport.value = ''; bgMissingInfo.value = []; bgAskReply.value = ''; bgAskInserted.value = false;
    followUpsList.value = [];
  }
}

async function saveCustomer() {
  if (!chatStore.activeJid) return;
  customerSaving.value = true;
  try {
    const payload = { ...customerData.value };
    // ensure requirement fields included (they already exist on customerData)
    const { data } = await api.put(`/customers/by-jid/${encodeURIComponent(chatStore.activeJid)}`, payload);
    customerData.value = { ...emptyCustomer(), ...data, tags: Array.isArray(data.tags) ? data.tags : [] };
    if (customerData.value.bgReport) { bgCheckReport.value = customerData.value.bgReport; } else { bgCheckReport.value = ''; }
    bgMissingInfo.value = []; bgAskReply.value = ''; bgAskInserted.value = false;
    customerEditMode.value = false;
    
    loadFollowUps();
    ElMessage.success('已保存');
  } catch (e) {
    console.error(e);
    ElMessage.error('保存失败');
  } finally {
    customerSaving.value = false;
  }
}

function cancelCustomerEdit() {
  if (customerBackup) { customerData.value = customerBackup; customerBackup = null; }
  customerEditMode.value = false;
  
}

function levelLabel(lv) {
  const map = { A: 'A级·核心客户', B: 'B级·意向中', C: 'C级·待培育', D: 'D级·已冷冻' };
  return map[lv] || (lv || 'C') + '级';
}
function customerSourceKey(c) {
  if (!c) return 'other';
  const s = String(c.source || '').toLowerCase();
  const jid = c.jid || '';
  if (s === 'telegram' || jid.includes('@telegram')) return 'telegram';
  if (s === 'whatsapp' || jid.includes('@s.whatsapp.net') || jid.includes('@c.us')) return 'whatsapp';
  if (s === 'instagram') return 'instagram';
  if (s === 'email') return 'email';
  if (s === '展会' || s === 'exhibition') return 'exhibition';
  if (s === 'manual') return 'manual';
  if (!s || s === 'other') return 'other';
  return 'other';
}
function customerSourceIcon(c) {
  const k = customerSourceKey(c);
  const icons = { whatsapp: '💬', telegram: '✈️', instagram: '📸', email: '✉️', exhibition: '🎪', manual: '👤', other: '❓' };
  return icons[k] || '❓';
}
function customerSourceLabel(c) {
  const k = customerSourceKey(c);
  const labels = { whatsapp: 'WA', telegram: 'TG', instagram: 'IG', email: 'Email', exhibition: '展会', manual: '手动', other: '其他' };
  return labels[k] || '其他';
}
function formatFuTime(t) {
  if (!t) return '';
  const d = new Date(t);
  if (isNaN(d)) return '';
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const pad = n => String(n).padStart(2, '0');
  if (sameDay) return pad(d.getHours()) + ':' + pad(d.getMinutes());
  return (d.getMonth()+1) + '/' + d.getDate() + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}
async function loadFollowUps({ autoGenerate = false } = {}) {
  if (!customerData.value?.id) { followUpsList.value = []; return; }
  followUpsLoading.value = true;
  try {
    const { data } = await api.get('/customers/' + customerData.value.id + '/follow-ups');
    followUpsList.value = Array.isArray(data) ? data : [];
    if (autoGenerate && !followUpsList.value.some(f => f.source === 'ai_summary')) {
      await generateFollowUpsAuto();
    }
  } catch (e) {
    console.warn('loadFollowUps err', e);
    followUpsList.value = [];
  } finally {
    followUpsLoading.value = false;
  }
}
async function generateFollowUpsAuto() {
  if (!customerData.value?.id || followUpGenerating.value) return;
  followUpGenerating.value = true;
  try {
    await api.post('/customers/' + customerData.value.id + '/generate-followups');
    const { data } = await api.get('/customers/' + customerData.value.id + '/follow-ups');
    followUpsList.value = Array.isArray(data) ? data : [];
  } catch (e) {
    // 无聊天记录 / 无 JID 时后端返回 400，静默跳过不弹错
    console.warn('generateFollowUpsAuto skip', e.response ? e.response.status : e.message);
  } finally {
    followUpGenerating.value = false;
  }
}
watch(customerTab, (v) => {
  if (v === 'followups') loadFollowUps({ autoGenerate: true });
});
async function addFollowUp() {
  const content = newFollowUpContent.value.trim();
  if (!content || !customerData.value?.id) return;
  followUpSaving.value = true;
  try {
    const { data } = await api.post('/customers/' + customerData.value.id + '/follow-ups', { content });
    followUpsList.value.unshift(data);
    newFollowUpContent.value = '';
    ElMessage.success('跟进已添加');
  } catch (e) {
    console.error(e);
    ElMessage.error('添加失败');
  } finally {
    followUpSaving.value = false;
  }
}
function enterCustomerEdit() {
  customerEditMode.value = true;
}

async function runCustomerAiExtract() {
  if (!chatStore.activeJid) return;
  customerExtractLoading.value = true;
  customerExtractResult.value = null;
  try {
    const { data } = await api.post(`/customers/by-jid/${encodeURIComponent(chatStore.activeJid)}/extract-ai`, { limit: 20 });
    // 只保留非空字段
    const filtered = {};
    for (const k of Object.keys(data)) {
      if (data[k] != null && data[k] !== '' && data[k] !== '未知') filtered[k] = data[k];
    }
    if (!Object.keys(filtered).length) {
      ElMessage.info('AI未识别到新的客户信息');
      return;
    }
    customerExtractResult.value = filtered;
  } catch (e) {
    console.error(e);
    ElMessage.error('AI识别失败');
  } finally {
    customerExtractLoading.value = false;
  }
}

function adoptExtractField(key, val) {
  if (customerData.value[key] == null || customerData.value[key] === '') {
    customerData.value[key] = val;
  }
  const next = { ...customerExtractResult.value };
  delete next[key];
  customerExtractResult.value = Object.keys(next).length ? next : null;
}

function adoptExtractAll() {
  if (!customerExtractResult.value) return;
  for (const [k, v] of Object.entries(customerExtractResult.value)) {
    if (customerData.value[k] == null || customerData.value[k] === '') {
      customerData.value[k] = v;
    }
  }
  customerExtractResult.value = null;
  ElMessage.success('已填充识别到的信息，请记得保存');
}

async function generateCompanyAsk() {
  if (!chatStore.activeJid) return;
  customerAskLoading.value = true;
  try {
    const { data } = await api.post(`/customers/by-jid/${encodeURIComponent(chatStore.activeJid)}/ask-company`, { limit: 20 });
    customerAskReplies.value = data.replies || [];
  } catch (e) {
    console.error(e);
    ElMessage.error('生成失败');
  } finally {
    customerAskLoading.value = false;
  }
}

function useAskReply(text) {
  chatStore.insertToInput(text);
  ElMessage.success('已填入输入框');
}

// 切到 customer 面板或切换会话时加载数据
watch([() => activePanel.value, () => chatStore.activeJid], ([panel, jid]) => {
  if ((panel === 'customer' || panel === 'bgcheck') && jid) {
    customerAskReplies.value = [];
    customerExtractResult.value = null;
    customerEditMode.value = false;
    bgCheckReport.value = ''; bgMissingInfo.value = []; bgAskReply.value = ''; bgAskInserted.value = false; bgCheckLoading.value = false;
    loadCustomer(jid);
  } else if (panel !== 'customer' && panel !== 'bgcheck') {
    // 离开面板时清理
    customerEditMode.value = false;
  }
}, { immediate: true });

// ── 📈 效果追踪面板状态 ──
const trackingData = ref(null);
const trackingLoading = ref(false);

async function loadTrackingData() {
  const jid = chatStore.activeJid;
  if (!jid) { trackingData.value = null; return; }
  trackingLoading.value = true;
  try {
    const { data } = await api.get(`/effectiveness/customer/${encodeURIComponent(jid)}`);
    // Also try to load attitude data
    try {
      const attRes = await api.get(`/attitude/by-jid/${encodeURIComponent(jid)}`);
      if (attRes.data) data.lastAttitude = attRes.data;
    } catch(e) { /* attitude may not exist yet */ }
    // Load trend
    try {
      const trendRes = await api.get(`/attitude/by-jid/${encodeURIComponent(jid)}/trend`);
      if (trendRes.data && Array.isArray(trendRes.data)) data.recentTrend = trendRes.data;
    } catch(e) { /* trend may not exist */ }
    trackingData.value = data;
  } catch (e) {
    if (e.response?.status === 404) {
      trackingData.value = null;
    } else {
      console.error('加载效果追踪失败', e);
      trackingData.value = null;
    }
  } finally {
    trackingLoading.value = false;
  }
}

function fmtTrackTime(ms) {
  if (ms == null || isNaN(ms)) return '--';
  if (ms < 1000) return ms + 'ms';
  if (ms < 60000) return (ms / 1000).toFixed(1) + 's';
  return (ms / 60000).toFixed(1) + 'min';
}
function fmtTrackPercent(v) {
  if (v == null || isNaN(v)) return '--';
  return (v * 100).toFixed(1) + '%';
}
function fmtTrackScore(v) {
  if (v == null || isNaN(v)) return '--';
  return Number(v).toFixed(1);
}

// ── 📚 话术库面板状态 ──
const aitalkTab = ref('ai'); // 'ai' | 'library'
const speechLibSamples = ref([]);
const speechLibMatched = ref([]);
const speechLibTotal = ref(0);
const speechLibLoading = ref(false);
const speechLibSearched = ref(false);

async function loadSpeechSamples() {
  speechLibLoading.value = true;
  try {
    const { data } = await api.get('/speech-library', { params: { pageSize: 50, accountId: chatStore.activeConversation?.accountId || 1 } });
    speechLibSamples.value = data.samples || [];
    speechLibTotal.value = data.pagination?.total || 0;
  } catch(e) {
    console.error('加载话术库失败', e);
  } finally {
    speechLibLoading.value = false;
  }
}

async function smartMatchSpeech() {
  const payload = {};
  if (activeChannel.value === 'telegram') {
    if (!tgActiveJid.value) return;
    payload.platform = 'telegram';
    payload.jid = tgActiveJid.value;
  } else if (activeChannel.value === 'email') {
    payload.platform = 'email';
    // email 上下文由后端兜底最近 inbound 邮件
  } else {
    if (!chatStore.activeJid) return;
    payload.platform = 'whatsapp';
    payload.jid = chatStore.activeJid;
    payload.accountId = chatStore.activeConversation?.accountId || 1;
  }
  speechLibLoading.value = true;
  speechLibSearched.value = true;
  try {
    const { data } = await api.post('/speech-library/match', payload);
    speechLibMatched.value = data.samples || [];
  } catch(e) {
    console.error('智能匹配失败', e);
    speechLibMatched.value = [];
  } finally {
    speechLibLoading.value = false;
  }
}

function currentChannelHasContext() {
  if (activeChannel.value === 'telegram') return !!tgActiveJid.value;
  if (activeChannel.value === 'email') return true; // email 后端兜底最近邮件
  return !!chatStore.activeJid;
}

function copySpeechReply(text) {
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => {
    ElMessage.success('已复制到剪贴板');
  }).catch(() => {
    // fallback
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    ElMessage.success('已复制');
  });
}

// Auto-load tracking when panel opens or JID changes
watch([() => activePanel.value, () => chatStore.activeJid], ([panel, jid]) => {
  if (panel === 'tracking' && jid) {
    loadTrackingData();
  } else {
    trackingData.value = null;
  }
  // Reset speech lib match when JID changes
  if (panel === 'aitalk') {
    speechLibMatched.value = [];
    speechLibSearched.value = false;
    if (aitalkTab.value === 'library') loadSpeechSamples();
  }
});

watch(() => customerEditMode.value, (v) => {
  if (v) {
    customerBackup = JSON.parse(JSON.stringify(customerData.value));
  } else {
    customerBackup = null;
  }
});

function formatBgTime(v) {
  if (!v) return '';
  try { return new Date(v).toLocaleString('zh-CN', { hour12: false }); } catch { return String(v); }
}

function getBgRating(jid) {
  return bgRatingMap[jid] || null;
}

function bgRatingColor(rating) {
  const map = { A: '#10b981', B: '#3b82f6', C: '#f59e0b', D: '#ef4444' };
  return map[rating] || '#9ca3af';
}

// ── BANT Score functions ──
function getBantLevel(jid) {
  return bantScoreMap[jid]?.level || null;
}

function openBantDetail(jid) {
  bantDetailJid.value = jid;
  showBantDetailDialog.value = true;
  loadBantScoreDetail(jid);
}

async function loadBantScoreDetail(jid) {
  try {
    const { data } = await api.get(`/customers/by-jid/${encodeURIComponent(jid)}/bant-score`);
    if (data && data.exists) {
      bantDetailMap[jid] = data;
    }
  } catch (e) {
    console.warn('[BANT] load detail error:', e.message);
  }
}

async function loadBantScore(jid) {
  if (!jid) return;
  try {
    const { data } = await api.get(`/customers/by-jid/${encodeURIComponent(jid)}/bant-score`);
    if (data && data.exists) {
      bantScoreMap[jid] = { level: data.level, totalScore: data.totalScore };
      bantDetailMap[jid] = data;
    }
  } catch {}
}

async function triggerBantRescore(jid) {
  bantRescoreLoading.value = true;
  try {
    const { data } = await api.post(`/customers/by-jid/${encodeURIComponent(jid)}/bant-score`);
    if (data && data.success) {
      bantScoreMap[jid] = { level: data.level, totalScore: data.totalScore };
      await loadBantScoreDetail(jid);
      ElMessage.success('BANT 评分完成: ' + data.level + ' · ' + data.totalScore);
    } else {
      ElMessage.warning('评分未完成: ' + (data?.reason || '数据不足'));
    }
  } catch (e) {
    ElMessage.error('评分失败: ' + e.message);
  } finally {
    bantRescoreLoading.value = false;
  }
}

function onBantScoreDone(event) {
  const data = event.detail;
  if (data && data.jid) {
    bantScoreMap[data.jid] = { level: data.level, totalScore: data.totalScore };
    if (chatStore.activeJid === data.jid) {
      loadBantScoreDetail(data.jid);
    }
  }
}

// BANT Config
const showBantConfigDialog = ref(false);
const bantConfigForm = reactive({
  weights: { budget: 25, authority: 25, need: 25, timeline: 25 },
  highThreshold: 7,
  lowThreshold: 4,
});

async function loadBantConfig() {
  try {
    const jid = chatStore.activeJid || 'default';
    const { data } = await api.get(`/customers/by-jid/${encodeURIComponent(jid)}/bant-score/config`);
    if (data) {
      bantConfigForm.weights.budget = Math.round((data.weights?.budget || 0.25) * 100);
      bantConfigForm.weights.authority = Math.round((data.weights?.authority || 0.25) * 100);
      bantConfigForm.weights.need = Math.round((data.weights?.need || 0.25) * 100);
      bantConfigForm.weights.timeline = Math.round((data.weights?.timeline || 0.25) * 100);
      bantConfigForm.highThreshold = data.thresholds?.high || 7;
      bantConfigForm.lowThreshold = data.thresholds?.low || 4;
    }
  } catch {}
}

async function saveBantConfig() {
  try {
    const jid = chatStore.activeJid || 'default';
    const payload = {
      weights: {
        budget: bantConfigForm.weights.budget / 100,
        authority: bantConfigForm.weights.authority / 100,
        need: bantConfigForm.weights.need / 100,
        timeline: bantConfigForm.weights.timeline / 100,
      },
      thresholds: {
        high: bantConfigForm.highThreshold,
        low: bantConfigForm.lowThreshold,
      }
    };
    await api.post(`/customers/by-jid/${encodeURIComponent(jid)}/bant-score/config`, payload);
    ElMessage.success('BANT 配置已保存');
    showBantConfigDialog.value = false;
  } catch (e) {
    ElMessage.error('保存失败: ' + e.message);
  }
}

const bantDetailJid = ref(null);
const showBantDetailDialog = ref(false);
const bantRescoreLoading = ref(false);

function onBgCheckDone(event) {
  const data = event.detail;
  if (data && data.jid && data.rating) {
    bgRatingMap[data.jid] = data.rating;
    // If currently viewing this customer, refresh
    if (chatStore.activeJid === data.jid) {
      loadCustomer(data.jid);
      ElMessage.success('🔍 自动背调完成，评级: ' + data.rating);
    }
  }
}

async function runBgCheck() {
  if (!chatStore.activeJid) return;
  bgCheckLoading.value = true;
  bgAskInserted.value = false;
  try {
    const { data } = await api.post(`/customers/by-jid/${encodeURIComponent(chatStore.activeJid)}/bg-check`, {});
    bgCheckReport.value = data.report || '';
    bgMissingInfo.value = Array.isArray(data.missingInfo) ? data.missingInfo : [];
    bgAskReply.value = data.askReply || '';
    if (data.bgUpdatedAt) { customerData.value.bgReport = data.report; customerData.value.bgUpdatedAt = data.bgUpdatedAt; }
    ElMessage.success('背调完成');
  } catch (e) {
    console.error(e);
    ElMessage.error('背调失败：' + (e?.response?.data?.error || e.message || '未知错误'));
  } finally {
    bgCheckLoading.value = false;
  }
}

function bgInsertAskReply() {
  if (!bgAskReply.value) { ElMessage.warning('暂无询问话术'); return; }
  chatStore.insertToInput(bgAskReply.value);
  bgAskInserted.value = true;
  ElMessage.success('已将询问话术填入输入框');
}

// ── 面板切换 ──
let _panelSwitchLock = 0;
function switchPanel(key) {
  // 防抖：300ms 内重复调用忽略（解决移动端 touchend+click 双触发）
  const now = Date.now();
  if (now - _panelSwitchLock < 300) return;
  _panelSwitchLock = now;
  // 手机端：走 openMobilePanel 统一入口（它自己处理 activePanel/mobilePanel/会话检查）
  if (isMobile.value) { openMobilePanel(key); return; }
  // 点已激活的图标 → 收起
  if (activePanel.value === key) {
    activePanel.value = null;
    return;
  }
  activePanel.value = key;
  aiMiniMode.value = false;
  if (key === 'translate') syncTransFormFromStore();
  if (key === 'aitalk') {
    aitalkError.value = '';
  }
}
function closePanel() {
  activePanel.value = null;
}
function onOpenTranslatePanel() { if (isMobile.value) { openMobilePanel('translate'); return; } switchPanel('translate'); }

function togglePlatform() { platformCollapsed.value = !platformCollapsed.value; }
function closeAllPanels() { channelDropdown.value = false; }

// 点击外部关闭下拉
function handleDocClick(e) {
  if (!e.target.closest('.channel-selector')) channelDropdown.value = false;
  onDocActionClickOutside(e);
}
// 切换会话时重置AI话术生成语言为"跟随翻译设置"
watch(() => chatStore.activeJid, () => {
  aitalkTargetLang.value = 'follow';
});

onMounted(async () => {
  document.addEventListener('click', handleDocClick);
  window.addEventListener('resize', checkMobile);
  checkMobile();
  try { initSocket(); } catch(e) { console.warn('initSocket failed', e); }
  
  const loadCompanyCategories = fetchCompanyCategories().catch(e => console.warn('company categories load failed:', e));
  
  // 并行加载非关键数据，提升首屏速度
  const loadTranslationSettings = chatStore.fetchTranslationSettings().then(() => {
    syncTransFormFromStore();
  }).catch(e => console.warn('translation settings load failed:', e));
  
  const loadAccounts = (async () => {
    try {
      await loadTgAccounts();
      await loadWaAccounts();
      // 自动选中第一个已连接的 WA 账号：进入 /chat 直接展示客户列表栏，无需手动点击账号
      const connectedAcc = waAccounts.value.find(a => a.online);
      if (connectedAcc) {
        switchWaAccount(connectedAcc.id);
      } else {
        chatStore.currentWaAccountId = null;
      }
    } catch(e) { console.warn('loadAccounts failed', e); }
  })();

  // 修复刷新后竞态：先等账号加载并自动选中，再拉连接状态（以选中账号为准设置 isConnected），最后加载会话列表。
  // 原逻辑 loadConnectionAndData 与 loadAccounts 并行，fetchConnectionStatus 可能在账号未选中时回退到首个账号，
  // 导致 isConnected=false、列表被 wa-hidden 隐藏，需点击两次账号才显示。
  const loadConnectionAndData = (async () => {
    try {
      await loadAccounts;
      await chatStore.fetchConnectionStatus();
      if (chatStore.isConnected) {
        // 会话列表和待跟进并行
        await Promise.all([
          chatStore.fetchConversations(),
          chatStore.fetchPendingFollowups()
        ]);
      }
    } catch(e) { console.warn('fetchStatus failed', e); }
  })();
  // Support jumping to a specific WA conversation from other pages (Customer detail)
  tryOpenPendingJid();
  // 启动首响/待跟进轮询
  scheduleFollowupPoll();
  
  if (activeChannel.value === 'telegram') {
    loadTgConversations();
  }

  // TG socket实时事件监听
  window.addEventListener('tg:message', onTgSocketMessage);
  window.addEventListener('tg:translation', onTgTranslationUpdate);
  window.addEventListener('tg:conv-update', onTgSocketConvUpdate);

  // Background check done event
  window.addEventListener('customer:bgcheck:done', onBgCheckDone);
  window.addEventListener('wa:add-account', onAddAccount);
  // 指派任务加载 + 指派跳转自动选中（客户-Agent 双向指派 V1.0）
  loadAgentTasks().then(() => handleAssignQuery());

  // TG兜底轮询（仅在TG tab激活时，10秒刷新会话列表；消息靠socket实时推送）
  tgPollTimer = setInterval(() => {
    if (activeChannel.value === 'telegram') {
      loadTgConversations();
      // 不再每2秒轮询消息列表，避免覆盖socket实时消息和乐观消息
      // 消息通过socket事件(tg:message)实时追加，打开会话时loadTgMessages一次性加载
    }
  }, 10000);

  // Auto-open TG conversation from customer list jump
  try {
    const tgOpenJid = sessionStorage.getItem('tg_open_jid');
    if (tgOpenJid) {
      sessionStorage.removeItem('tg_open_jid');
      activePlatform.value = 'communication';
      setTimeout(() => {
        activeChannel.value = 'telegram';
        chatStore.setActiveConversation(null);
        loadTgConversations().then(() => {
          tgActiveJid.value = tgOpenJid;
          chatStore.activeJid = tgOpenJid;
          chatStore.activePlatform = 'telegram';
          if (isMobile.value) mobileInConv.value = true;
          loadTgMessages(tgOpenJid);
          loadCustomerByJid(tgOpenJid);
        });
      }, 300);
    }
  } catch(e) { console.warn('tg auto-open failed', e); }
});

async function openJid(targetJid, source) {
  if (!targetJid) return false;
  if (source === 'session') sessionStorage.removeItem('wa-open-jid');
  activePlatform.value = 'communication';

  // 处理 Telegram JID（以 @telegram 结尾）
  if (targetJid.endsWith('@telegram')) {
    activeChannel.value = 'telegram';
    chatStore.setActiveConversation(null);
    tgActiveJid.value = targetJid;
    chatStore.activeJid = targetJid;
    chatStore.activePlatform = 'telegram';
    if (isMobile.value) { mobileInConv.value = true; mhAvatarFailed.value = false; mobilePanel.value = null; }
    loadTgConversations().then(() => { loadTgMessages(targetJid); loadCustomerByJid(targetJid); });
    if (route.path !== '/chat') {
      router.push({ path: '/chat', query: { jid: targetJid } });
    }
    return true;
  }

  // WA 会话：确保频道切回 whatsapp
  activeChannel.value = 'whatsapp';
  chatStore.activePlatform = 'whatsapp';

  // 从其他页面跳转打开具体会话：自动选中首个在线账号，恢复会话视图
  if (currentWaAccountId.value === null) {
    const fo = waAccounts.value.find(a => a.online);
    if (fo) switchWaAccount(fo.id);
  }

  if (route.path !== '/chat') {
    router.push({ path: '/chat', query: { jid: targetJid } });
  }
  let tries = 0;
  const iv = setInterval(() => {
    tries++;
    const conv = chatStore.conversations.find(c => c.jid === targetJid);
    if (conv) {
      selectConv(conv);
      if (isMobile.value) { mobileInConv.value = true; mhAvatarFailed.value = false; mobilePanel.value = null; }
      clearInterval(iv);
    } else if (tries > 30) {
      chatStore.setActiveConversation(targetJid);
      if (isMobile.value) mobileInConv.value = true;
      clearInterval(iv);
    }
  }, 300);
  return true;
}

async function tryOpenPendingJid() {
  // 优先读URL ?jid=xxx（从Dashboard/客户详情跳转）
  const urlJid = route.query?.jid;
  if (urlJid) { openJid(String(urlJid), 'url'); return; }
  const targetJid = sessionStorage.getItem('wa-open-jid');
  if (targetJid) { openJid(targetJid, 'session'); }
}

// 监听URL ?jid=xxx 变化（从其他页面跳转过来时自动打开会话）
watch(() => route.query?.jid, (jid, oldJid) => {
  if (jid && jid !== oldJid) openJid(String(jid), 'url-watch');
});

onUnmounted(() => {
  document.removeEventListener('click', handleDocClick);
  window.removeEventListener('resize', checkMobile);
  try {
    if (layoutStepSocketHandler) useSocket()?.off('assistant:step', layoutStepSocketHandler);
    if (layoutAutoStepSocketHandler) useSocket()?.off('whatsapp:auto-step', layoutAutoStepSocketHandler);
  } catch (e) {}
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  if (followupPollTimer) clearInterval(followupPollTimer);
  stopTitleFlash();
  if (inPageFlashTimer) clearInterval(inPageFlashTimer);
  updateTitleBadge();
  window.removeEventListener('tg:message', onTgSocketMessage);
    window.removeEventListener('tg:translation', onTgTranslationUpdate);
  window.removeEventListener('tg:conv-update', onTgSocketConvUpdate);
  window.removeEventListener('customer:bgcheck:done', onBgCheckDone);
  window.removeEventListener('wa:add-account', onAddAccount);
  if (tgPollTimer) clearInterval(tgPollTimer);
});

// ========== 平台导航 ==========
const activePlatform = ref('assistant');
// 外贸Agent子模块
const tradeAgents = [
  { key: 'sales-champion', label: '外贸销冠', icon: '🏆', desc: 'AI话术、客户分层、报价优化' },
  { key: 'background-report', label: '客户背调', icon: '🔍', desc: '公司背调、风险评估、竞品分析' },
  { key: 'customs-agent', label: '外贸单证', icon: '📋', desc: '报关单证、HS编码、信用证审核' },
  { key: 'doc-agent', label: '工厂对接', icon: '🏭', desc: '工厂评估、排产跟进、验货标准' },
  { key: 'freight-agent', label: '货代对接', icon: '🚢', desc: '海运方案、空运方案、报关报检' },
  { key: 'legal-agent', label: '外贸法务', icon: '⚖️', desc: '合同审查、纠纷处理、合规检查' },
];
const currentTradeAgent = ref('sales-champion');

// Agent聊天界面状态
const agentInput = ref('');
const pendingFiles = ref([]); // [{ name, type, content, size, mimeType }]
const canSend = computed(() => agentInput.value.trim().length > 0 || pendingFiles.value.length > 0);
// 从 localStorage 加载聊天记录
const loadAgentChatHistory = () => {
  try {
    const saved = localStorage.getItem('crm_agent_chat_history');
    return saved ? JSON.parse(saved) : {};
  } catch (e) {
    return {};
  }
};
const agentChatHistory = ref(loadAgentChatHistory()); // { 'sales-champion': [{role, content}], ... } 按agentKey隔离

// 保存聊天记录到 localStorage
const saveAgentChatHistory = () => {
  try {
    localStorage.setItem('crm_agent_chat_history', JSON.stringify(agentChatHistory.value));
  } catch (e) {
    console.warn('Failed to save chat history:', e);
  }
};
const selectedModel = ref('Auto');
const showModelSelector = ref(false);
const showAttachMenu = ref(false);
const filePanelOpen = ref(false);
const taskPanelOpen = ref(false);
const filePanelTab = ref('files');
const wecomPanelOpen = ref(false);
const wecomConfig = ref(null);
const wecomConfigured = ref(false);
const wecomForm = ref({ corpId: '', corpSecret: '', agentId: '' });
const testing = ref(false);
const testResult = ref(null);
const syncing = ref(false);
// modelTab removed: 语言/多模态分类对外贸销售太技术化，模型平铺即可
const sidebarExpanded = ref(true);
const chatMessagesEl = ref(null);
const agentTextarea = ref(null);
const fileInput = ref(null);
const showAddModel = ref(false);

// ===== V1.0 客户-Agent 双向指派：客户选择 + 会话隔离 =====
const customerPickerOpen = ref(false);
const customerList = ref([]);
const customerSearch = ref('');
const selectedCustomer = ref(null);   // { id, name, company, country, phone, customerLevel, ... }
const agentSessions = ref([]);
const activeSessionId = ref(null);    // 客户会话 = {agentType}:cust:{id}；通用对话 = null
const activeMessages = ref([]);       // 服务端当前会话消息（V1.0 权威数据）
const providerList = ref([]);
// V1.0 指派任务列表（仅当前 Agent 未完成）
const agentTasks = ref([]);

// V1.1 当前选中客户对应的指派任务（用于聊天区顶部横幅展示）
const currentAssignTask = computed(() => {
  if (!selectedCustomer.value) return null;
  return agentTasks.value.find(t => t.customerId === selectedCustomer.value.id && ['CREATED', 'ACTIVE'].includes(t.status)) || null;
});

const filteredCustomers = computed(() => {
  const kw = (customerSearch.value || '').trim().toLowerCase();
  if (!kw) return customerList.value;
  return customerList.value.filter(c =>
    [c.name, c.company, c.phone, c.email, c.country, c.companyName, c.contactName]
      .some(v => v && String(v).toLowerCase().includes(kw))
  );
});

// 客户列表（服务端搜索 + 本地过滤双保险）
async function loadCustomers() {
  try {
    const token = localStorage.getItem('token');
    const params = { page: '1', pageSize: '100' };
    if (customerSearch.value && customerSearch.value.trim()) params.search = customerSearch.value.trim();
    const qs = new URLSearchParams(params).toString();
    const resp = await fetch('/api/customers?' + qs, { headers: { 'Authorization': 'Bearer ' + token } });
    if (resp.ok) {
      const data = await resp.json();
      customerList.value = data.items || [];
    }
  } catch (e) { console.warn('loadCustomers failed:', e.message); }
}
function onCustomerSearch() { loadCustomers(); }

// 指派任务加载（当前 Agent 未完成任务）
async function loadAgentTasks() {
  try {
    const token = localStorage.getItem('token');
    const resp = await fetch(`/api/agent/tasks?agentType=${encodeURIComponent(currentTradeAgent.value)}`, { headers: { 'Authorization': 'Bearer ' + token } });
    if (resp.ok) {
      const data = await resp.json();
      agentTasks.value = (data.tasks || []).filter(t => ['CREATED', 'ACTIVE'].includes(t.status));
    }
  } catch (e) { console.warn('loadAgentTasks failed:', e.message); }
}
// 点击指派任务 → 选中该客户会话
function selectTaskCustomer(task) {
  const c = task.customer || { id: task.customerId, name: '客户#' + task.customerId };
  selectCustomer(c);
  customerPickerOpen.value = false;
}

// V1.1 终止指派任务：确认后置 COMPLETED 并刷新列表
async function terminateTask(task) {
  try {
    await ElMessageBox.confirm('确定终止该客户的指派任务吗？终止后任务将标记完成，不再显示。', '终止任务', {
      confirmButtonText: '终止',
      cancelButtonText: '取消',
      type: 'warning'
    });
  } catch (e) { return; }
  try {
    const token = localStorage.getItem('token');
    const resp = await fetch(`/api/agent/tasks/${task.id}/complete`, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    ElMessage.success('任务已终止');
    await loadAgentTasks();
    if (selectedCustomer.value && selectedCustomer.value.id === task.customerId) {
      // 任务终止后若当前选中客户无其他任务，解除客户绑定回到通用对话
      const still = agentTasks.value.find(t => t.customerId === task.customerId && ['CREATED', 'ACTIVE'].includes(t.status));
      if (!still) { selectGeneralChat(); taskPanelOpen.value = false; }
    }
  } catch (e) {
    console.warn('terminateTask failed:', e.message);
    ElMessage.error('终止失败，请重试');
  }
}

// 模型→provider 映射（assistant/chat 用 providerId）
async function loadProviders() {
  try {
    const token = localStorage.getItem('token');
    const resp = await fetch('/api/assistant/providers', { headers: { 'Authorization': 'Bearer ' + token } });
    if (resp.ok) providerList.value = await resp.json();
  } catch (e) {}
}
function matchProviderId(modelName) {
  if (!modelName || modelName === 'Auto') return '';
  const key = String(modelName).toLowerCase().replace(/[\s-]/g, '');
  const p = providerList.value.find(x => (x.model || '').toLowerCase().replace(/[\s-]/g, '').includes(key))
         || providerList.value.find(x => (x.name || '').toLowerCase().replace(/[\s-]/g, '').includes(key));
  return p ? p.id : '';
}

// 当前 Agent 的会话列表（通用+客户）
async function loadAgentSessions() {
  try {
    const token = localStorage.getItem('token');
    const resp = await fetch(`/api/assistant/sessions?agentType=${encodeURIComponent(currentTradeAgent.value)}`, { headers: { 'Authorization': 'Bearer ' + token } });
    if (resp.ok) {
      const data = await resp.json();
      agentSessions.value = data.sessions || [];
    }
  } catch (e) { console.warn('loadAgentSessions failed:', e.message); }
}

// 当前会话消息（服务端权威）
async function loadAgentMessages() {
  try {
    const token = localStorage.getItem('token');
    const params = new URLSearchParams({ agentType: currentTradeAgent.value, limit: '200' });
    if (activeSessionId.value) params.set('sessionId', activeSessionId.value);
    else params.set('scope', 'general');
    const resp = await fetch('/api/assistant/conversations?' + params.toString(), { headers: { 'Authorization': 'Bearer ' + token } });
    if (resp.ok) {
      activeMessages.value = await resp.json() || [];
    } else {
      activeMessages.value = [];
    }
  } catch (e) {
    console.warn('loadAgentMessages failed:', e.message);
    activeMessages.value = [];
  }
  nextTick(() => { if (chatMessagesEl.value) chatMessagesEl.value.scrollTop = chatMessagesEl.value.scrollHeight; });
}

// 选中客户 → 绑定客户会话
function handleAssignQuery() {
  const q = route.query;
  if (q.assign === '1' && q.cid) {
    const cid = parseInt(q.cid, 10);
    const task = agentTasks.value.find(t => t.customerId === cid);
    if (task) { selectTaskCustomer(task); taskPanelOpen.value = true; return; }
    const c = customerList.value.find(x => x.id === cid);
    if (c) { selectCustomer(c); return; }
    customerPickerOpen.value = true;
    router.replace({ query: {} });
  }
}
function selectCustomer(c) {
  selectedCustomer.value = c;
  customerPickerOpen.value = false;
  activeSessionId.value = `${currentTradeAgent.value}:cust:${c.id}`;
  loadAgentMessages();
}
// 通用对话（解除客户绑定）
function selectGeneralChat() {
  selectedCustomer.value = null;
  customerPickerOpen.value = false;
  activeSessionId.value = null;
  loadAgentMessages();
}
function clearCustomer() { selectGeneralChat(); }

// 打开客户选择面板时：加载客户列表 + 模型列表
// 模型选择器打开时：同步智能选择状态
watch(showModelSelector, (v) => { if (v) loadProviders(); });
watch(customerPickerOpen, (v) => { if (v) { loadCustomers(); loadProviders(); } });

const selectedAutoMode = ref(true);
// 模型业务说明：告诉销售每个模型擅长干什么活（数据以后端 /assistant/providers 为准）
const MODEL_META = [
  { match: 'gpt-5.6-terra', icon: '🧠', tag: '最专业', tagType: 'new-tag', desc: '查客户背景、公司背调、写专业报告，能力最强' },
  { match: 'deepseek-v4-pro', icon: '🔷', tag: '', tagType: '', desc: '分析难搞的客户、琢磨谈判策略，复杂问题拿手' },
  { match: 'deepseek-v4-flash', icon: '⚡', tag: '省积分', tagType: 'special-tag', desc: '日常聊客户、回询盘，回复快又省积分' },
  { match: 'doubao-seed-evolving', icon: '🫘', tag: 'NEW', tagType: 'new-tag', desc: '豆包最新版，看图读截图、写文案都行' },
  { match: 'doubao-seed-2-1-turbo', icon: '🚀', tag: '', tagType: '', desc: '简单翻译、快速问答，秒回不用等' },
  { match: 'doubao-seed-2-0-pro', icon: '🖼️', tag: '', tagType: '', desc: '看懂产品图、聊天截图，图文任务拿手' },
  { match: 'sensenova', icon: '🔆', tag: '', tagType: '', desc: '轻量快速，简单小任务够用' },
];
function modelMetaOf(p) {
  const key = String(p.model || p.name || '').toLowerCase().replace(/[\s-]/g, '');
  const hit = MODEL_META.find(m => key.includes(m.match.toLowerCase().replace(/[\s-]/g, '')));
  return hit || { icon: '🤖', tag: '', tagType: '', desc: '智能助手，帮你处理各类工作' };
}

// 恢复智能选择状态
const savedAutoMode = localStorage.getItem('crm_auto_model');
if (savedAutoMode === '0') {
  selectedAutoMode.value = false;
  const savedModel = localStorage.getItem('crm_aitalk_model');
  if (savedModel && savedModel !== 'Auto') selectedModel.value = savedModel;
}
// 计算当前Agent对象
const currentAgentObj = computed(() => {
  return tradeAgents.find(a => a.key === currentTradeAgent.value);
});

// 计算当前Agent的消息（按agentKey隔离读取）
const agentMessages = computed(() => {
  if (activeMessages.value && activeMessages.value.length) return activeMessages.value;
  return agentChatHistory.value[currentTradeAgent.value] || [];
});

// 计算当前快捷提示
const quickPromptsMap = {
  'sales-champion': ['帮我分析这个客户', '优化我的报价话术', '客户分层建议'],
  'background-report': ['帮我查一下这家公司', '风险评估报告', '竞品分析'],
  'customs-agent': ['HS编码查询', '报关单证模板', '信用证审核'],
  'doc-agent': ['工厂评估报告', '排产计划跟进', '验货标准制定'],
  'freight-agent': ['海运方案对比', '空运报价查询', '报关报检流程'],
  'legal-agent': ['合同条款审查', '纠纷处理建议', '合规检查'],
};
const currentQuickPrompts = computed(() => quickPromptsMap[currentTradeAgent.value] || []);
// 执行过程可视化：胶囊快捷指令 + 步骤流
const agentSending = ref(false);
const agentSteps = ref([]);
let layoutStepSocketHandler = null;
let layoutAutoStepSocketHandler = null;
const quickCapsules = computed(() => {
  if (currentTradeAgent.value === 'sales-champion') {
    return ['🤖 开启自动接待', '⏸️ 关闭自动接待', '⏱️ 3分钟没回就自动接待', '🌙 设定接待时段', '📋 查客户资料', '✉️ 写跟进邮件', '📊 查销售漏斗'];
  }
  return (quickPromptsMap[currentTradeAgent.value] || []).slice(0, 6);
});

// 模型过滤
const filteredModels = computed(() => {
  return (providerList.value || [])
    .filter(p => p.active !== false)
    .map(p => {
      const meta = modelMetaOf(p);
      return { name: p.name || p.model, model: p.model, icon: meta.icon, tag: meta.tag, tagType: meta.tagType, desc: meta.desc };
    });
});

function toggleAutoMode() {
  selectedAutoMode.value = !selectedAutoMode.value;
  if (selectedAutoMode.value) {
    selectedModel.value = 'Auto';
  }
  localStorage.setItem('crm_auto_model', selectedAutoMode.value ? '1' : '0');
}
function selectModel(name) {
  selectedAutoMode.value = false;
  selectedModel.value = name;
  showModelSelector.value = false;
  localStorage.setItem('crm_auto_model', '0');
}

function isImageOnlyMsg(msg) {
  if (!msg || !msg.attachments || !msg.attachments.length) return false;
  const hasNonImage = msg.attachments.some(a => a.type !== 'image');
  if (hasNonImage) return false;
  const textWithoutImageTags = (msg.content || '').replace(/\[图片:.*?\]/g, '').trim();
  return textWithoutImageTags.length === 0;
}
function renderMsgContent(msg) {
  if (!msg.content) return '';
  let html = escapeHtml(msg.content);
  // Render [图片: xxx] as <img> if msg has attachments with dataURLs
  if (msg.attachments && msg.attachments.length) {
    for (const att of msg.attachments) {
      if (att.type === 'image' && att.dataUrl) {
        const tag = `[图片: ${escapeHtml(att.name)}]`;
        const imgTag = `<img src="${att.dataUrl}" class="ta-msg-img" style="max-width:200px;border-radius:8px;cursor:pointer" onclick="window.open(this.src)"/>`;
        html = html.replace(tag, imgTag);
      }
    }
  }
  return html;
}
async function sendAgentMessage() {
  const text = agentInput.value.trim();
  const files = pendingFiles.value.slice();
  if (!text && !files.length) return;
  agentSteps.value = [];
  agentSending.value = true;
  // 确保当前Agent的历史数组存在
  if (!agentChatHistory.value[currentTradeAgent.value]) {
    agentChatHistory.value[currentTradeAgent.value] = [];
  }
  // 追加用户消息到对应Agent的历史
  // Build message with optional attachments
  let fullMessage = text;
  const attachParts = [];
  for (const file of files) {
    if (file.type === 'image') {
      attachParts.push(`[图片: ${file.name}]`);
    } else {
      const textContent = typeof file.content === 'string' ? file.content.substring(0, 3000) : '';
      if (textContent) {
        attachParts.push(`📎 [文件: ${file.name}]\n\`\`\`\n${textContent}\n\`\`\``);
      } else {
        attachParts.push(`📎 [文件: ${file.name} (${(file.size/1024).toFixed(1)}KB)]`);
      }
    }
  }
  if (attachParts.length) {
    fullMessage = text ? `${text}\n\n` + attachParts.join('\n\n') : attachParts.join('\n\n');
  }
  // 构建附件数据（图片 dataURL 用于前端渲染）
  const msgAttachments = [];
  for (const file of files) {
    if (file.type === 'image' && file.content) {
      msgAttachments.push({ type: 'image', name: file.name, dataUrl: file.content });
    }
  }
  pendingFiles.value = [];
  const userMsg = { role: 'user', content: fullMessage };
  if (msgAttachments.length) userMsg.attachments = msgAttachments;
  activeMessages.value.push(userMsg);
  agentChatHistory.value[currentTradeAgent.value].push(userMsg);
  agentInput.value = '';
  nextTick(() => { if (chatMessagesEl.value) chatMessagesEl.value.scrollTop = chatMessagesEl.value.scrollHeight; });
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      agentChatHistory.value[currentTradeAgent.value].push({ role: 'ai', content: '⚠️ 登录已过期，请重新登录后再试。' });
      saveAgentChatHistory();
      agentSending.value = false;
      return;
    }
    // V1.0：接入 assistant 体系（customerId/全景注入/会话隔离）
    const pid = matchProviderId(selectedModel.value);
    let resp;
    if (files.length > 0) {
      // 有附件：用 FormData 真实上传文件，后端 vision 链路才能拿到图片
      const fd = new FormData();
      fd.append('message', text || '');
      fd.append('agentType', currentTradeAgent.value);
      if (activeSessionId.value) fd.append('sessionId', activeSessionId.value);
      if (selectedCustomer.value) fd.append('customerId', String(selectedCustomer.value.id));
      if (pid) fd.append('providerId', pid);
      for (const f of files) { if (f.raw) fd.append('files', f.raw); }
      resp = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token },
        body: fd
      });
    } else {
      const payload = {
        message: fullMessage,
        agentType: currentTradeAgent.value,
        sessionId: activeSessionId.value,
        customerId: selectedCustomer.value ? selectedCustomer.value.id : null
      };
      if (pid) payload.providerId = pid;
      resp = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify(payload)
      });
    }
    const pushAi = (content) => {
      const m = { role: 'ai', content };
      activeMessages.value.push(m);
      agentChatHistory.value[currentTradeAgent.value].push(m);
      saveAgentChatHistory();
    };
    if (resp.status === 401) {
      pushAi('⚠️ 登录已过期，请重新登录后再试。');
      agentSending.value = false;
      return;
    }
    if (!resp.ok) {
      const errText = await resp.text();
      console.error('[Agent API Error]', resp.status, errText);
      pushAi(`服务暂时不可用(${resp.status})，请稍后再试。`);
      agentSending.value = false;
      return;
    }
    const data = await resp.json();
    if (data.reply) {
      pushAi(data.reply);
    } else if (data.error) {
      pushAi('❌ ' + data.error);
    } else {
      pushAi('抱歉，暂时无法回复，请稍后再试。');
    }
  } catch (e) {
    console.error('[Agent Fetch Error]', e);
    agentChatHistory.value[currentTradeAgent.value].push({ role: 'ai', content: '网络连接失败，请检查网络后重试。' });
    saveAgentChatHistory();
  }
  agentSending.value = false;
  nextTick(() => { if (chatMessagesEl.value) chatMessagesEl.value.scrollTop = chatMessagesEl.value.scrollHeight; });
}

function triggerFileUpload() { showAttachMenu.value = false; fileInput.value?.click(); }
function triggerImageUpload() { showAttachMenu.value = false; fileInput.value?.click(); }
function handleFileUpload(e) {
  showAttachMenu.value = false;
  const fileList = Array.from(e.target.files || []);
  if (!fileList.length) return;
  for (const file of fileList) {
    const isImage = file.type.startsWith('image/');
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target.result;
      // 纯 base64（不含 data:xxx;base64, 前缀）——后端 vision 链路需要
      let pureBase64 = null;
      if (isImage && typeof result === 'string' && result.startsWith('data:')) {
        const comma = result.indexOf(',');
        pureBase64 = comma >= 0 ? result.substring(comma + 1) : result;
      }
      pendingFiles.value.push({
        name: file.name,
        type: isImage ? 'image' : 'file',
        mimeType: file.type,
        size: file.size,
        content: result,
        pureBase64: pureBase64,
        raw: file
      });
    };
    if (isImage) {
      reader.readAsDataURL(file);
    } else {
      reader.readAsText(file);
    }
  }
  e.target.value = '';
}

function removePendingFile(idx) {
  if (typeof idx === 'number') {
    pendingFiles.value.splice(idx, 1);
  } else {
    pendingFiles.value = [];
  }
}


async function loadWecomConfig() {
  try {
    const resp = await api.get('/wecom/config');
    const config = resp?.data ?? resp;
    wecomConfig.value = config;
    wecomConfigured.value = !!(config && config.configured);
    if (config && config.configured) {
      wecomForm.value = { corpId: config.corpId || '', corpSecret: '', agentId: config.agentId || '' };
    }
    // 新租户引导：进入工厂/货代且未配置企微时，自动弹出设置面板
    if (!wecomConfigured.value && ['doc-agent','freight-agent'].includes(currentTradeAgent.value)) {
      wecomPanelOpen.value = true;
    }
  } catch(e) { console.warn('loadWecomConfig failed', e); }
}
async function saveWecomConfig() {
  try {
    await api.put('/wecom/config', wecomForm.value);
    ElMessage.success('企微配置已保存');
    await loadWecomConfig();
  } catch(e) { ElMessage.error('保存失败: ' + (e.message || e)); }
}
async function testWecomConnection() {
  testing.value = true; testResult.value = null;
  try {
    const resp = await api.get('/wecom/test');
    const result = resp?.data ?? resp;
    testResult.value = result || { success: false, message: '无响应' };
  } catch(e) { testResult.value = { success: false, message: e.message }; }
  testing.value = false;
}
async function syncWecomContacts() {
  syncing.value = true;
  try {
    const resp = await api.post('/wecom/sync-contacts');
    const result = resp?.data ?? resp;
    if (result && result.success) { ElMessage.success(result.message || '同步成功'); }
    else { ElMessage.error('同步失败: ' + (result?.error || '')); }
    await loadWecomConfig();
  } catch(e) { ElMessage.error('同步失败: ' + e.message); }
  syncing.value = false;
}
function toggleTaskPanel() {
  taskPanelOpen.value = !taskPanelOpen.value;
  if (taskPanelOpen.value) { filePanelOpen.value = false; wecomPanelOpen.value = false; }
}
function toggleFilePanel() {
  filePanelOpen.value = !filePanelOpen.value;
  if (filePanelOpen.value) wecomPanelOpen.value = false;
}
function toggleWecomPanel() {
  wecomPanelOpen.value = !wecomPanelOpen.value;
  if (wecomPanelOpen.value) filePanelOpen.value = false;
}

function selectTradeAgent(agentKey) {
  currentTradeAgent.value = agentKey;
  activePlatform.value = 'trade-agent';
  loadAgentTasks();
  if (['doc-agent','freight-agent'].includes(agentKey)) {
    // 工厂/货代通过企业微信接管沟通，不带客户上下文
    if (selectedCustomer.value) {
      selectedCustomer.value = null;
      customerPickerOpen.value = false;
    }
    loadWecomConfig();
  } else {
    // 非工厂/货代 Agent：关闭企业微信设置面板
    wecomPanelOpen.value = false;
  }
  // V1.0：切换 Agent 时按客户绑定重载会话
  if (selectedCustomer.value) {
    activeSessionId.value = `${agentKey}:cust:${selectedCustomer.value.id}`;
  } else {
    activeSessionId.value = null;
  }
  loadAgentSessions();
  loadAgentMessages();
}

const showSettings = ref(false);
function goSettings() { router.push('/settings'); }
const creditsBalance = ref('--');
async function loadCreditsBalance() {
  try {
    const { data } = await api.get('/payments/balance');
    creditsBalance.value = data.balance ?? 0;
  } catch (e) { creditsBalance.value = '--'; }
}
function goCredits() { showSettings.value = false; router.push('/credits'); }
function goCreditsTransactions() { showSettings.value = false; router.push('/credits/transactions'); }
const activeSettingsTab = ref('account');

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
    setTimeout(() => { unattendedSaved.value = false; }, 2000);
  } catch (e) {
    alert('保存失败：' + (e.response?.data?.error || e.message));
  } finally {
    unattendedSaving.value = false;
  }
}

// 当设置弹窗打开时，加载无人值守配置
watch(showSettings, (v) => {
  if (v) { loadUnattended(); loadCreditsBalance(); }
});

const platformItems = [  { key: 'trade-agent', label: '外贸Agent', icon: '🤖', children: [
    { key: 'sales-champion', label: '外贸销冠', icon: '🏆' },
    { key: 'background-report', label: '客户背调', icon: '🔍' },
    { key: 'customs-agent', label: '外贸单证', icon: '📋' },
    { key: 'doc-agent', label: '工厂对接', icon: '🏭' },
    { key: 'freight-agent', label: '货代对接', icon: '🚢' },
    { key: 'legal-agent', label: '外贸法务', icon: '⚖️' },
  ] },
  { key: 'work-group', label: '工作群组', icon: '👥' },
  { key: 'communication', label: '客户沟通', icon: '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>' },
  { key: 'customers', label: '客户管理', icon: '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>' },
  { key: 'pipeline', label: '销售看板', icon: '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M3 13h2v8H3v-8zm4-4h2v12H7V9zm4-4h2v16h-2V5zm4 6h2v10h-2V11zm4-4h2v14h-2V7z"/></svg>' },
  { key: 'product-knowledge', label: '产品知识', icon: '📦' },
  { key: 'dashboard', label: '数据概览', icon: '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/></svg>' },
  { key: 'my-stats', label: '我的业绩', icon: '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M3.5 18.49l6-6.01 4 4L22 6.92l-1.41-1.41-7.09 7.97-4-4L2 16.99z"/></svg>' },
  { key: 'trade-shows', label: '全球展会', icon: '🗓️' },
  { key: 'skills', label: '技能商店', icon: '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M18 6h-2c0-2.21-1.79-4-4-4S8 3.79 8 6H6c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-6-2c1.1 0 2 .9 2 2h-4c0-1.1.9-2 2-2zm6 16H6V8h2v2c0 .55.45 1 1 1s1-.45 1-1V8h4v2c0 .55.45 1 1 1s1-.45 1-1V8h2v12z"/></svg>' },
];

const settingsTabs = [
  { key: 'account', label: '账号设置', icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>' },
  { key: 'channels', label: '渠道管理', icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>' },
  { key: 'ai', label: 'AI设置', icon: '🤖' },
  { key: 'automation', label: '自动化规则', icon: '⚡' },
  { key: 'team', label: '团队成员', icon: '👥' },
  { key: 'unattended', label: '无人值守', icon: '🤖' },
  { key: 'system', label: '系统设置', icon: '⚙️' },
];

const mobileTabs = [
  { key: 'trade-agent', label: '外贸Agent', icon: '🤖' },
  { key: 'dashboard', label: '数据概览', icon: '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/></svg>' },
  { key: 'my-stats', label: '我的业绩', icon: '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M3.5 18.49l6-6.01 4 4L22 6.92l-1.41-1.41-7.09 7.97-4-4L2 16.99z"/></svg>' },
  { key: 'chatlist', label: '客户沟通', icon: '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>' },
  { key: 'settings', label: '我的', icon: '⚙️' },
];

const isMobile = ref(false);
const mobileDrawerOpen = ref(false);
const mobileAccountsOpen = ref(false);
const mobileInConv = ref(false);
const mhAvatarFailed = ref(false)
const emitAssistantProfile = ref(false)

watch(emitAssistantProfile, (val) => {
  if (val) {
    window.dispatchEvent(new CustomEvent('open-assistant-profile'))
    setTimeout(() => { emitAssistantProfile.value = false }, 300)
  }
});
const channelPopupOpen = ref(false);
const popupSelected = ref(false); // track if user has made a selection in this popup session
function openMhProfile() {
  window.dispatchEvent(new CustomEvent('wa:open-profile'));
}
const mobilePanel = ref(null); // 'aitalk'|'customer'|'translate'|'ai'|null
const mhMenuOpen = ref(null);
const tgMenuOpen = ref(null);
const MH_GROUPS = [
  { key:'ai', icon:'🤖', items:[
    {key:'translate', icon:'🌐', label:'翻译设置'},
    {key:'aitalk', icon:'💬', label:'沟通话术'},
    {key:'bgcheck', icon:'🔍', label:'客户背调'},
    {key:'requirement', icon:'🎯', label:'需求总结'},
    {key:'assign-agent', icon:'🤖', label:'发给Agent'},
  ]},
  { key:'customer', icon:'👤', items:[
    {key:'tracking', icon:'📈', label:'效果追踪'},
    {key:'customer', icon:'👤', label:'客户画像'},
    {key:'company', icon:'🏢', label:'公司资料'},
    {key:'freight', icon:'🚢', label:'运费查询'},
  ]},
  { key:'tools', icon:'🧰', items:[
    {key:'documents', icon:'📄', label:'外贸单证'},
    {key:'worldclock', icon:'🕰️', label:'时间文化'},
    {key:'forex', icon:'💱', label:'汇率计算'},
  ]},
];
function toggleMhMenu(key) {
  mhMenuOpen.value = mhMenuOpen.value === key ? null : key;
}

// 移动端栏目抽屉菜单
const mobileDrawerItems = [
  { key: 'trade-agent', label: '外贸Agent', icon: '🤖', children: [
    { key: 'sales-champion', label: '外贸销冠', icon: '🏆' },
    { key: 'background-report', label: '客户背调', icon: '🔍' },
    { key: 'customs-agent', label: '外贸单证', icon: '📋' },
    { key: 'doc-agent', label: '工厂对接', icon: '🏭' },
    { key: 'freight-agent', label: '货代对接', icon: '🚢' },
    { key: 'legal-agent', label: '外贸法务', icon: '⚖️' },
  ] },
  { key: 'chatlist', label: '客户沟通', icon: '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>' },
  { key: 'customers', label: '客户管理', icon: '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>' },
  { key: 'pipeline', label: '销售看板', icon: '📊' },
  { key: 'product-knowledge', label: '产品知识', icon: '📦' },
  { key: 'dashboard', label: '数据概览', icon: '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/></svg>' },
  { key: 'trade-shows', label: '全球展会', icon: '🗓️' },
  { key: 'skills', label: '技能商店', icon: '🧩' },
];
const mobileHeaderTitle = computed(() => {
  if (mobileInConv.value && activeChannel.value === 'telegram' && tgActiveJid.value) { const c = tgConversations.value.find(x => x.jid === tgActiveJid.value); return c?.name || 'Telegram'; }
  if (mobileInConv.value && activeChannel.value === 'email') return '邮箱';
  if (mobileInConv.value && chatStore.activeConversation?.name) return chatStore.activeConversation.name;
  if (activePlatform.value === 'work-group') return '工作群组';
  if (activePlatform.value === 'dashboard') return '数据概览';
  if (activePlatform.value === 'assistant') return '外贸Agent';
  if (activePlatform.value === 'communication' && activeChannel.value === 'whatsapp' && currentWaAccountId.value) { const acc = waAccounts.value.find(a => a.id === currentWaAccountId.value); return acc?.name || 'WhatsApp'; }
  if (activePlatform.value === 'communication') return currentChannel.value?.name || '客户沟通';
  if (activePlatform.value === 'customers') return '客户管理';
  if (activePlatform.value === 'pipeline') return '销售看板';
  if (activePlatform.value === 'product-knowledge') return '产品知识';
  if (activePlatform.value === 'trade-shows') return '全球展会';
  if (activePlatform.value === 'speech-library') return '话术库';
  if (activePlatform.value === 'skills') return '技能商店';
  if (activePlatform.value === 'credits') return '积分充值';
  return 'TradeAgent';
});
function isDrawerActive(key) {
  if (key === 'chatlist') return activePlatform.value === 'communication' && !mobileInConv.value;
  if (key === 'translate_set') return false;
  if (['sales-champion','background-report','customs-agent','doc-agent','freight-agent','legal-agent'].includes(key)) return activePlatform.value === 'trade-agent' && currentTradeAgent.value === key;
  if (key === 'trade-agent') return false;
  return activePlatform.value === key;
}
function closeAllMobileOverlays() {
  mobileDrawerOpen.value = false;
  mobilePanel.value = null;
  mobileAccountsOpen.value = false;
  mobileInConv.value = false;
  showSettings.value = false;
}
function onDrawerItemClick(item) {
  closeAllMobileOverlays();
  if (item.key === 'chatlist') {
    activePlatform.value = 'communication';
    if (route.path !== '/chat') router.push('/chat');
    return;
  }
  if (item.key === 'translate_set') {
    router.push('/settings?tab=translation');
    return;
  }
  if (item.key === 'emails') {
    activePlatform.value = 'emails';
    if (route.path !== '/emails') router.push('/emails');
    return;
  }
  // Trade agent sub-items → stay in chat interface
  if (['sales-champion','background-report','customs-agent','doc-agent','freight-agent','legal-agent'].includes(item.key)) {
    selectTradeAgent(item.key);
    return;
  }
  switchPlatform({ key: item.key });
}
function checkMobile() {
  const wasMobile = isMobile.value;
  const ua = navigator.userAgent || '';
  const isMobileUA = /Mobi|Android|iPhone|iPad|iPod|Windows Phone|BlackBerry|Opera Mini|IEMobile/i.test(ua);
  isMobile.value = window.innerWidth <= 900 || isMobileUA;
  // 仅在真正跨断点切换时重置面板状态；输入法弹起/收起引起的高度变化(宽度不变)不打断当前会话
  if (!wasMobile && isMobile.value) {
    // PC → 移动端
    accountsCollapsed.value = false;
    chatlistCollapsed.value = false;
    mobileAccountsOpen.value = false;
    mobileInConv.value = false;
    mobilePanel.value = null;
  } else if (wasMobile && !isMobile.value) {
    // 移动端 → PC
    mobileAccountsOpen.value = false;
    mobilePanel.value = null;
  }
  // 移动端内部 resize（键盘弹起/旋转等）不重置 mobileInConv，保持当前会话
}

function isPlatformActive(key) { return activePlatform.value === key; }
function isChildActive(child) {
  if (['sales-champion','background-report','customs-agent','doc-agent','freight-agent','legal-agent'].includes(child.key)) return activePlatform.value === 'trade-agent' && currentTradeAgent.value === child.key;
  return activePlatform.value === child.key;
}
function isParentActive(item) {
  if (item.key === 'trade-agent') return false;
  return activePlatform.value === item.key;
}

function toggleExpand(key) { expandedKeys.value[key] = !expandedKeys.value[key]; }
function onChildClick(child) {
  // Trade agent sub-items → stay in chat interface, just switch agent
  if (['sales-champion','background-report','customs-agent','doc-agent','freight-agent','legal-agent'].includes(child.key)) {
    selectTradeAgent(child.key);
    return;
  }
  switchPlatform(child);
}

function goHome() {
  // 回到欢迎页：等同于点击 trade-agent
  activePlatform.value = 'assistant';
  currentTradeAgent.value = 'sales-champion';
  activeSessionId.value = null;
  activeMessages.value = [];
  if (agentChatHistory.value['sales-champion']) agentChatHistory.value['sales-champion'] = [];
  closeAllMobileOverlays();
  router.push('/assistant?welcome=1');
}

function switchPlatform(item) {
  if (item.key === 'settings') { showSettings.value = true; return; }
  if (item.key === 'trade-agent') {
    // 重置到欢迎页：显示 AssistantView (router-view)
    activePlatform.value = 'assistant';
    currentTradeAgent.value = 'sales-champion';
    activeSessionId.value = null;
    activeMessages.value = [];
    if (agentChatHistory.value['sales-champion']) agentChatHistory.value['sales-champion'] = [];
    closeAllMobileOverlays();
    router.push('/assistant?welcome=1');
    return;
  }
  activePlatform.value = item.key;
  closeAllMobileOverlays();
  const routeMap = {
    dashboard: '/dashboard',
    assistant: '/assistant',
    'trade-agent': '/assistant',
    communication: '/chat',
    customers: '/customers',
    pipeline: '/pipeline',
    automation: '/automation',
    emails: '/emails',
    data: '/dashboard',
    'product-knowledge': '/product-knowledge',
    'trade-shows': '/trade-shows',
    'speech-library': '/speech-library',
    'my-stats': '/my-stats',
    skills: '/skill-store',
    credits: '/credits',
    'sales-champion': '/sales-champion',
    'background-report': '/background-report',
    'customs-agent': '/customs-agent',
    'doc-agent': '/doc-agent',
    'freight-agent': '/freight-agent',
    'legal-agent': '/legal-agent',
    'work-group': '/work-group',
  };
  const target = routeMap[item.key] || '/';
  if (route.path !== target) router.push(target);
}

function openMobilePanel(key) {
      mhMenuOpen.value = null;
      // 手机端：指派Agent → 调起 ChatView 指派弹窗
      if (key === 'assign-agent') { chatViewRef.value?.openAssignDialog?.(); return; }
      // 点击已激活的顶部快捷按钮 → 关闭
      if (mobilePanel.value === key) { mobilePanel.value = null; activePanel.value = null; return; }
      if (!chatStore.activeJid && (key === 'aitalk' || key === 'bgcheck' || key === 'customer' || key === 'translate' || key === 'worldclock' || key === 'tracking' || key === 'speechlib')) {
        ElMessage.warning('请先选择一个会话'); return;
      }
      activePanel.value = key;
      panelCollapsed.value = false;
      if (key === 'translate') syncTransFormFromStore();
      if (key === 'aitalk') { aitalkError.value = ''; }
      mobilePanel.value = key;
    }
    function closeMobilePanel() { mobilePanel.value = null; activePanel.value = null; mhMenuOpen.value = null; }
    function onMobileAIFab() { openMobilePanel('aitalk'); }
function isTabActive(tab) {
  if (tab.key === 'settings') return route.path === '/settings';
  if (tab.key === 'chatlist') return activePlatform.value === 'communication';
  return activePlatform.value === tab.key;
}
function handleMobileTab(tab) {
  mobileDrawerOpen.value = false;
  if (tab.key === 'settings') {
    router.push('/settings'); return;
  }
  showSettings.value = false;
  mobilePanel.value = null;
  mobileInConv.value = false;
  mobileAccountsOpen.value = false;
  if (tab.key === 'dashboard') {
    activePlatform.value = 'dashboard';
    if (route.path !== '/' && route.path !== '/dashboard') router.push('/dashboard');
    return;
  }
  if (tab.key === 'assistant') {
    activePlatform.value = 'assistant';
    if (route.path !== '/assistant') router.push('/assistant');
    return;
  }
  if (tab.key === 'chatlist') {
    activePlatform.value = 'communication';
    if (route.path !== '/chat') router.push('/chat');
    popupSelected.value = false;
    channelSheetOpen.value = true;
    return;
  }
  if (tab.key === 'customers') {
    activePlatform.value = 'customers';
    if (route.path !== '/customers') router.push('/customers');
    return;
  }
  if (tab.key === 'pipeline') {
    activePlatform.value = 'pipeline';
    if (route.path !== '/pipeline') router.push('/pipeline');
    return;
  }
  if (tab.key === 'automation') {
    activePlatform.value = 'automation';
    if (route.path !== '/automation') router.push('/automation');
    return;
  }
  switchPlatform(tab);
}

watch(() => route.path, (p) => {
  if (p === '/' || p === '/dashboard') activePlatform.value = 'dashboard';
  else if (p.startsWith('/assistant') && !route.query._t) activePlatform.value = 'assistant';
  else if (p.startsWith('/chat')) activePlatform.value = 'communication';
  else if (p.startsWith('/emails')) activePlatform.value = 'emails';
  else if (p.startsWith('/customers')) activePlatform.value = 'customers';
  else if (p.startsWith('/pipeline')) activePlatform.value = 'pipeline';
  else if (p.startsWith('/automation')) activePlatform.value = 'automation';
  else if (p.startsWith('/product-knowledge')) activePlatform.value = 'product-knowledge';
  else if (p.startsWith('/trade-shows')) activePlatform.value = 'trade-shows';
  else if (p.startsWith('/speech-library')) activePlatform.value = 'speech-library';
  else if (p.startsWith('/skill-store')) activePlatform.value = 'skills';
  else if (p.startsWith('/credits')) activePlatform.value = 'credits';
  else if (p === '/sales-champion') { activePlatform.value = 'trade-agent'; currentTradeAgent.value = 'sales-champion'; wecomPanelOpen.value = false; loadAgentSessions(); loadAgentMessages(); loadAgentTasks().then(handleAssignQuery); }
  else if (['background-report','customs-agent','doc-agent','freight-agent','legal-agent'].includes(p.replace('/',''))) { const k = p.replace('/',''); activePlatform.value = 'trade-agent'; currentTradeAgent.value = k; if (['doc-agent','freight-agent'].includes(k)) loadWecomConfig(); else wecomPanelOpen.value = false; loadAgentSessions(); loadAgentMessages(); loadAgentTasks().then(handleAssignQuery); }
  else if (p.startsWith('/work-group')) activePlatform.value = 'work-group';
  else if (p.startsWith('/settings')) { activePlatform.value = 'dashboard'; }
}, { immediate: true });

// ========== 沟通模块状态 ==========
    // WhatsApp风控冷却倒计时（从后端读cooldownUntil）
    const waRestrictUntil = ref(0);
    const waRestricted = ref(false);
    const restRemain = ref('');
    async function fetchCooldownStatus() {
      try {
        const r = await fetch('/api/whatsapp/status');
        const d = await r.json();
        if (d.cooldownUntil) {
          const t = new Date(d.cooldownUntil).getTime();
          if (t > Date.now()) {
            waRestrictUntil.value = t;
            waRestricted.value = true;
            updateRest();
            return;
          }
        }
        waRestricted.value = false;
        restRemain.value = '';
      } catch(e) {}
    }
    function updateRest() {
      const left = waRestrictUntil.value - Date.now();
      if (left <= 0) { waRestricted.value = false; restRemain.value = ''; return; }
      const h = Math.floor(left/3600000);
      const m = Math.floor((left%3600000)/60000);
      restRemain.value = h+'时'+m+'分后自动解除';
    }
    fetchCooldownStatus();
    setInterval(fetchCooldownStatus, 5*60000);

    const activeChannel = ref(typeof window !== 'undefined' && localStorage.getItem('active_channel') || 'whatsapp');
const activeAccount = ref('wa-1');
const activeConv = ref(null); // jid

const totalUnread = computed(() => {
  let n = 0;
  for (const c of chatStore.sortedConversations) n += (c.unreadCount || 0);
  return n > 0 ? n : '';
});
watch(totalUnread, (v) => { platformItems[1].badge = v; }, { immediate: true });
// Persist activeChannel to localStorage
watch(activeChannel, (val) => { try { localStorage.setItem('active_channel', val || 'whatsapp'); } catch(e) {} });

function avatarColor(name) {
  if (!name) return '#00a884';
  const palette = ['#00a884', '#4FC3F7', '#AB47BC', '#FF7043', '#66BB6A', '#FFA726', '#EC407A', '#26A69A', '#EF5350', '#5C6BC0'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return palette[Math.abs(hash) % palette.length];
}

function formatConvTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((today - msgDay) / (1000*60*60*24));
  if (diff === 0) {
    return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
  }
  if (diff === 1) return '昨天';
  if (diff < 7) {
    const days = ['周日','周一','周二','周三','周四','周五','周六'];
    return days[d.getDay()];
  }
  return String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}

// ========== 头像辅助 ==========
const selfAvatarOk = ref(true);
const convAvatarFailedSet = reactive({}); // {jid: true}
function onSelfAvatarError() { selfAvatarOk.value = false; }
function onConvAvatarError(jid) { convAvatarFailedSet[jid] = true; chatStore.markAvatarFailed(jid); }
function convAvatarOk(conv) { return conv && conv.jid && !convAvatarFailedSet[conv.jid]; }
function _letterOf(name) {
  if (!name) return '?';
  const s = String(name).trim();
  // 中文名/阿拉伯文/任意非数字优先取第一个可见字符
  for (const ch of s) {
    if (/\p{L}/u.test(ch)) return ch.toUpperCase();
  }
  return s[0].toUpperCase();
}
const selfInitial = computed(() => _letterOf(chatStore.pushName || chatStore.connectedPhone || 'W'));
const unreadTotal = computed(() => conversations.value.reduce((s, c) => s + (c.unreadCount||0), 0));
const tgUnreadTotal = computed(() => tgConversations.value.reduce((s, c) => s + (c.unread||0), 0));
// TG聊天头部：国家+时间badge
const tgActiveConv = computed(() => tgConversations.value.find(c => c.jid === tgActiveJid.value));
const tgCultureIso = computed(() => {
  if (!tgActiveJid.value) return null;
  return cultureGetAutoIso(tgActiveJid.value, tgActiveConv.value);
});
const tgCultureInfo = computed(() => tgCultureIso.value ? getCulture(tgCultureIso.value) : null);
const tgCultureWorkStatus = computed(() => {
  if (!tgCultureIso.value) return { status:'none', icon:'', tip:'', localTime:'', hour:0, weekday:'', isWeekend:false };
  const info = tgCultureInfo.value;
  if (!info) return { status:'none', icon:'', tip:'', localTime:'', hour:0, weekday:'', isWeekend:false };
  return getLocalWorkStatus(info.tz, info.workHours) || { status:'none', icon:'', tip:'', localTime:'', hour:0, weekday:'', isWeekend:false };
});
const emailUnreadTotal = ref(0); // TODO: email unread
function convInitial(conv) { return _letterOf(conv?.pushName || conv?.name || '?'); }
const selfAvatarBg = computed(() => {
  // 给占位圈一个稳定颜色（基于 jid/phone hash）
  const palette = ['#00a884','#25d366','#34b7f1','#06cf9c','#ff7a59','#ae73d6','#f5a623','#ef4a7b'];
  const key = chatStore.connectedPhone || 'self';
  let h = 0; for (let i=0;i<key.length;i++) h = (h*31 + key.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
});
// 监听连接状态，头像加载失败后在重连/重登成功时重置
watch(() => chatStore.selfAvatarUrl, (v) => { if (v) selfAvatarOk.value = true; });

const tgActiveJid = ref(null);
const tgHeaderAvatarFailed = ref(false);
const tgHeaderAvatar = computed(() => {
  if (!tgActiveJid.value) return '';
  const conv = tgConversations.value.find(c => c.jid === tgActiveJid.value);
  if (!conv) return '';
  return chatStore.loadAvatar(tgActiveJid.value, conv.avatarUrl);
});
watch(tgActiveJid, () => { tgHeaderAvatarFailed.value = false; });
const tgMessages = ref([]);
function isMediaPlaceholderText(t) {
  if (!t) return true;
  const s = String(t).trim();
  if (!s) return true;
  if (s.startsWith('[MessageMedia') && s.endsWith(']')) return true;
  if (s === '[media]' || s === '[Media]') return true;
  return false;
}
const tgInputText = ref('');
const tgSending = ref(false);
const tgPendingFile = ref(null);
const tgAttachMenuOpen = ref(false);
const tgImageInput = ref(null);
const tgDocInput = ref(null);
let tgAttachCloseHandler = null;

function tgToggleAttachMenu() {
  tgAttachMenuOpen.value = !tgAttachMenuOpen.value;
}
function tgPickFile(type) {
  tgAttachMenuOpen.value = false;
  if (type === 'image' && tgImageInput.value) tgImageInput.value.click();
  else if (type === 'document' && tgDocInput.value) tgDocInput.value.click();
}
function tgOnFileSelected(e) {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;
  sendTgMediaDirect(file);
}
async function sendTgMediaDirect(file) {
  if (tgSending.value || !tgActiveJid.value) return;
  tgSending.value = true;
  try {
    const fd = new FormData();
    fd.append('jid', tgActiveJid.value);
    fd.append('file', file);
    fd.append('mediatype', file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'document');
    const { data } = await api.post('/whatsapp/send-media', fd, { timeout: 120000 });
    await loadTgMessages(tgActiveJid.value);
    loadTgConversations();
  } catch(e) {
    ElMessage.error('媒体发送失败：' + (e.response?.data?.error || e.message));
  } finally { tgSending.value = false; }
}
function formatTgFileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}

// 点击外部关闭TG附件菜单
function tgCloseAttachMenu(e) {
  if (tgAttachMenuOpen.value && !e.target.closest('.tg-attach-wrap')) {
    tgAttachMenuOpen.value = false;
  }
}
onMounted(() => { document.addEventListener('click', tgCloseAttachMenu); });
onUnmounted(() => { document.removeEventListener('click', tgCloseAttachMenu); });

async function loadTgMessages(jid) {
  try {
    let data = null;
    if (jid && jid.endsWith('@telegram')) {
      // TG 历史消息：从 TG API 实时拉取（数据库未入库）
      const peerId = jid.replace('@telegram', '');
      const hist = await api.get('/tg-userbot/history', { params: { peerId, limit: 50 } });
      const msgs = (hist.data && hist.data.messages) || [];
      data = msgs.map(m => ({
        id: 'tg' + (m.id || Math.random().toString(36).slice(2)),
        body: m.text || '',
        content: m.text || '',
        fromMe: !!m.fromMe,
        timestamp: m.timestamp || Date.now(),
        messageType: m.mediaType ? 'media' : 'text',
        mediaType: m.mediaType || null,
        platform: 'telegram',
      }));
    } else {
      const resp = await api.get('/whatsapp/messages', { params: { jid } });
      data = resp.data || [];
    }
    tgMessages.value = (data || []).slice().reverse().map(m => {
      let transObj = null;
      if (m.translation) {
        if (typeof m.translation === 'string') {
          // API may return either a JSON string or a plain translation string
          const trimmed = m.translation.trim();
          if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
            try { transObj = JSON.parse(trimmed); } catch(e) { /* plain string, treat as translated */ }
          }
          if (!transObj) {
            // API already extracted the correct string based on direction
            transObj = { translated: m.translation };
          }
        } else {
          transObj = m.translation;
        }
      }
      return {
        ...m,
        text: m.body || m.content || '',
        time: formatMsgTime(m.timestamp),
        translationObj: transObj,
      };
    });
    nextTick(() => {
      const box = document.querySelector('.tg-msgs');
      if (box) box.scrollTop = box.scrollHeight;
    });
    // Trigger batch retranslation for messages missing translations
    const msgsNeedingTranslation = tgMessages.value.filter(m => 
      (m.messageType === 'text' || m.type === 'text') && 
      !m.translationObj && 
      m.text && 
      !m.text.startsWith('[') &&
      !m.fromMe  // Only incoming messages need auto-translation
    );
    if (msgsNeedingTranslation.length > 0) {
      console.log('[TG] Found', msgsNeedingTranslation.length, 'messages needing translation, triggering batch retranslate');
      setTimeout(() => chatStore.retranslateBatchMissing(jid), 1000);
    }
  } catch(e) { console.warn('loadTgMsg err', e); }
}

async function sendTgMessage() {
  const text = tgInputText.value.trim();
  const file = tgPendingFile.value;
  if ((!text && !file) || tgSending.value || !tgActiveJid.value) return;
  tgSending.value = true;
  tgInputText.value = '';

  // 如果有附件，走媒体发送
  if (file) {
    tgPendingFile.value = null;
    tgAttachMenuOpen.value = false;
    try {
      const fd = new FormData();
      fd.append('jid', tgActiveJid.value);
      fd.append('file', file);
      fd.append('mediatype', file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'document');
      if (text) fd.append('caption', text);
      const { data } = await api.post('/whatsapp/send-media', fd, { timeout: 120000 });
      await loadTgMessages(tgActiveJid.value);
      loadTgConversations();
    } catch(e) {
      ElMessage.error('媒体发送失败：' + (e.response?.data?.error || e.message));
    } finally { tgSending.value = false; }
    return;
  }
  // 乐观消息：立即显示，不等API返回
  const tempId = 'tmp-tg-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
  tgMessages.value.push({
    id: tempId,
    fromMe: true,
    body: text,
    text: text,
    timestamp: new Date().toISOString(),
    direction: 'outbound',
    time: formatMsgTime(new Date()),
    platform: 'telegram',
    waMessageId: '',
    translationObj: null,
    _tempId: tempId,
    _sending: true,
  });
  nextTick(() => {
    const box = document.querySelector('.tg-msgs');
    if (box) box.scrollTop = box.scrollHeight;
  });
  try {
    const { data } = await api.post('/whatsapp/send', { to: tgActiveJid.value, message: text });
    // API返回后，更新乐观消息（加翻译、真实ID）
    let localTrans = null;
    if (data?.translation) {
      if (typeof data.translation === 'string') {
        const ts = data.translation.trim();
        if (ts.startsWith('{') && ts.endsWith('}')) { try { localTrans = JSON.parse(ts); } catch(e){} }
        if (!localTrans) localTrans = { translated: data.translation };
      } else { localTrans = data.translation; }
    }
    const idx = tgMessages.value.findIndex(m => m._tempId === tempId);
    if (idx >= 0) {
      tgMessages.value[idx] = {
        ...tgMessages.value[idx],
        id: data?.savedId || tgMessages.value[idx].id,
        waMessageId: data?.waMessageId || '',
        text: localTrans?.translated || tgMessages.value[idx].text,
        body: localTrans?.translated || tgMessages.value[idx].body,
        translationObj: localTrans,
        _tempId: tempId,
        _sending: false,
      };
    }
    loadTgConversations();
  } catch(e) {
    // 发送失败，移除乐观消息
    const idx = tgMessages.value.findIndex(m => m._tempId === tempId);
    if (idx >= 0) tgMessages.value.splice(idx, 1);
    ElMessage.error('发送失败：' + (e.response?.data?.error || e.message));
  } finally { tgSending.value = false; }
}

function selectConv(conv) {
  activeConv.value = conv.jid;
  if (conv.platform === 'telegram') {
    tgActiveJid.value = conv.jid;
    tgMessages.value = [];
    loadTgMessages(conv.jid);
    // Sync activeJid so right panels (customer/culture/aitalk) work
    chatStore.activeJid = conv.jid;
    chatStore.activePlatform = 'telegram';
    // Mark TG messages as read & clear unread badge
    try { const sock = useSocket(); sock.emit('whatsapp:mark_read', { jid: conv.jid }); } catch(e) {}
    conv.unread = 0;
    // Load customer data for TG contact
    loadCustomerByJid(conv.jid);
    // Load per-customer translation settings
    chatStore.loadCustomerTranslation(conv.jid);
    if (isMobile.value) {
      mobileInConv.value = true;
      mobileAccountsOpen.value = false;
      mobilePanel.value = null;
    }
    // Auto open aitalk on mobile when entering conv
    if (isMobile.value && activePanel.value !== 'aitalk') {
      // Don't auto-open; let user tap button
    }
    return;
  }
  chatStore.setActiveConversation(conv.jid);
  // 【TC-020修复】WhatsApp会话打开时同步加载客户档案(country等)，供时间文化面板与头部文化徽标使用
  loadCustomerByJid(conv.jid);
  if (isMobile.value) {
    mobileInConv.value = true;
    mobileAccountsOpen.value = false;
    mobilePanel.value = null;
  }
}

// ─── 会话操作 ActionSheet ───
const convMenu = reactive({ visible: false, conv: null });
function handleConvTouchStart(conv, e) {
  // 阻止移动端长按默认菜单
  if (e.touches && e.touches.length === 1) {
    const touch = e.touches[0];
    // 记录触摸起始位置，用于长按检测
    convMenu._touchStart = { x: touch.clientX, y: touch.clientY, time: Date.now(), conv };
  }
}
// 长按检测
let touchTimer = null;
document.addEventListener('touchend', (e) => {
  if (convMenu._touchStart) {
    const elapsed = Date.now() - convMenu._touchStart.time;
    if (elapsed >= 500) { // 500ms 视为长按
      openConvMenu(convMenu._touchStart.conv, { clientX: convMenu._touchStart.x, clientY: convMenu._touchStart.y, preventDefault: ()=>{} });
    }
    convMenu._touchStart = null;
  }
});
let _lpTimer = null;
let _lpMoved = false;
const LONG_PRESS_MS = 600;
function openConvMenu(conv, ev) {
  convMenu.conv = conv;
  convMenu.visible = true;
  nextTick(() => {
    const sheet = document.querySelector('.action-sheet');
    if (!sheet) return;
    if (ev && ev.clientX && window.innerWidth > 768) {
      // PC端：在点击位置下方显示
      const x = ev.clientX;
      const y = ev.clientY;
      const rect = sheet.getBoundingClientRect();
      const vw = window.innerWidth, vh = window.innerHeight;
      let left = x - rect.width;
      let top = y + 6;
      if (left < 8) left = 8;
      if (top + rect.height > vh - 8) top = y - rect.height - 6;
      sheet.style.left = left + 'px';
      sheet.style.top = top + 'px';
      sheet.style.right = 'auto';
      sheet.style.bottom = 'auto';
    } else {
      // 手机端：底部弹出
      sheet.style.left = '';
      sheet.style.top = '';
      sheet.style.right = '';
      sheet.style.bottom = '';
    }
  });
}
function closeConvMenu() {
  convMenu.visible = false;
  convMenu.conv = null;
}
function onConvClick(conv, ev) {
  // 短按才进入会话（长按触发菜单时阻止click）
  if (_lpMoved) { _lpMoved = false; return; }
  if (convMenu.visible) { closeConvMenu(); return; }
  selectConv(conv);
}
function onConvTouchStart(conv, ev) {
  _lpMoved = false;
  if (_lpTimer) clearTimeout(_lpTimer);
  _lpTimer = setTimeout(() => {
    _lpMoved = true; // 阻止后续click触发selectConv
    if (navigator.vibrate) try { navigator.vibrate(30); } catch(_){}
    openConvMenu(conv);
  }, LONG_PRESS_MS);
}
function onConvTouchEnd(conv, ev) {
  if (_lpTimer) { clearTimeout(_lpTimer); _lpTimer = null; }
}
function onConvTouchMove() {
  if (_lpTimer) { clearTimeout(_lpTimer); _lpTimer = null; }
  _lpMoved = true;
}
async function doTogglePin() {
  if (!convMenu.conv) return;
  const jid = convMenu.conv.jid;
  try {
    await chatStore.togglePin(jid);
  } catch(e) { alert('置顶失败'); }
  closeConvMenu();
}
async function doToggleStar() {
  if (!convMenu.conv) return;
  const jid = convMenu.conv.jid;
  try {
    await chatStore.toggleStar(jid);
  } catch(e) { alert('特别关注失败'); }
  closeConvMenu();
}
async function doToggleBlock() {
  if (!convMenu.conv) return;
  const jid = convMenu.conv.jid;
  const name = convMenu.conv.name || jid;
  if (!confirm(`确定要封锁 ${name}？\n封锁后将不再收到该联系人的消息。`)) return;
  try {
    await chatStore.toggleBlock(jid);
  } catch(e) { alert('封锁失败'); }
  closeConvMenu();
}
async function doDeleteConv() {
  if (!convMenu.conv) return;
  const jid = convMenu.conv.jid;
  const name = convMenu.conv.name || jid;
  if (!confirm(`确定要删除联系人「${name}」吗？\n将同时清除该联系人的所有聊天记录、客户资料和跟进数据，此操作不可恢复！`)) return;
  try {
    await chatStore.deleteConversation(jid, true);
  } catch(e) { alert('删除失败: ' + (e.response?.data?.error || e.message)); }
  closeConvMenu();
}

function handleGoBack() {
  mobileInConv.value = false;
  mobilePanel.value = null;
}
function handleMobileBackConv() {
  if (activeChannel.value === 'email') {
    window.dispatchEvent(new CustomEvent('email:mobile-back'));
    return;
  }
  mobileInConv.value = false;
}
function onEmailUnread(n) {
  const ch = channels.find(c => c.id === 'email');
  if (ch) ch.unread = n || 0;
}

const waStatus = computed(() => {
  const s = chatStore.connectionStatus;
  if (s === 'connected') return 'connected';
  if (s === 'error') return 'error';
  return 'disconnected';
});
const waStatusText = computed(() => {
  const map = {
    connected: 'WhatsApp 已连接',
    connecting: 'WhatsApp 连接中...',
    waiting_qr: '等待扫码',
    error: 'WhatsApp 连接错误',
    disconnected: 'WhatsApp 未连接',
    reconnecting: '重新连接中...',
  };
  return map[chatStore.connectionStatus] || 'WhatsApp 未连接';
});

const waAccountCard = computed(() => {
  if (!chatStore.isConnected) return null;
  return {
    id: 'wa-1',
    name: chatStore.connectedPhone || 'WhatsApp',
    phone: chatStore.connectedPhone || '已连接',
    color: '#00a884',
    status: 'online',
  };
});

const showQrInline = ref(false);

function disconnectWA() {
  if (!confirm('确定要断开 WhatsApp 连接吗？')) return;
  chatStore.disconnectWhatsApp();
  showQrInline.value = false;
}

function refreshWA() {
  chatStore.fetchConnectionStatus();
  if (chatStore.isConnected) {
    chatStore.fetchConversations();
    chatStore.fetchPendingFollowups();
  } else {
    chatStore.requestQR();
    if (route.path !== '/chat') router.push('/chat');
    setTimeout(() => window.dispatchEvent(new CustomEvent('wa:open-qr')), 300);
  }
}

function openQrFromAccount() {
  chatStore.requestQR();
}

function doConnectWA() {
  chatStore.requestQR();
  // Navigate to chat page so user sees QR dialog
  if (route.path !== '/chat') router.push('/chat');
  // Dispatch event for ChatView to open its QR dialog
  setTimeout(() => window.dispatchEvent(new CustomEvent('wa:open-qr')), 300);
}
// ========== WA 账号体验（对标竞品：新建会话/启动/配置/删除） ==========
const configPanelOpen = ref(false);
const configTargetPlatform = ref('whatsapp'); // whatsapp | telegram
const configAccountId = ref(null);
const configAccountName = ref('');
const configProxyProtocol = ref('socks5');
const configProxyHost = ref('');
const configProxyPort = ref('');
const configProxyUser = ref('');
const configProxyPass = ref('');
const configTestResult = ref('');
const configTesting = ref(false);

function configureAccount(acc) {
  configPanelOpen.value = true;
  configAccountId.value = acc.id;
  configAccountName.value = acc.name;
  configProxyProtocol.value = 'socks5';
  configProxyHost.value = '';
  configProxyPort.value = '';
  configProxyUser.value = '';
  configProxyPass.value = '';
  configTestResult.value = '';
  loadProxyConfig(acc.id);
}

function openConfigPanel() {
  // 右侧栏「代理设置」入口：优先当前选中 WA 账号，否则取第一个；无账号时提示
  const acc = currentWaAccountId.value ? waAccounts.value.find(a => a.id === currentWaAccountId.value) : (waAccounts.value.length > 0 ? waAccounts.value[0] : null);
  if (acc) { configureAccount(acc); return; }
  ElMessage.warning('请先添加 WhatsApp 账号再配置代理');
}

function onOpenProxyPanel() { openConfigPanel(); }

async function loadProxyConfig(id) {
  try {
    const { data } = await api.get(`/accounts/wa/${id}/proxy`);
    if (data?.proxy && data.proxy.enabled !== false) {
      configProxyHost.value = data.proxy.host || '';
      configProxyPort.value = String(data.proxy.port || '');
      configProxyProtocol.value = data.proxy.protocol || 'socks5';
      configProxyUser.value = data.proxy.username || '';
      configProxyPass.value = data.proxy.password || '';
    }
  } catch(e) { /* ignore */ }
}

async function saveProxyConfig() {
  if (!configProxyHost.value.trim()) { alert('请输入代理地址'); return; }
  try {
    const body = { enabled: true, host: configProxyHost.value.trim(), port: Number(configProxyPort.value), protocol: configProxyProtocol.value, username: configProxyUser.value.trim() || undefined, password: configProxyPass.value.trim() || undefined };
    if (configTargetPlatform.value === 'telegram') {
      await api.post(`/accounts/telegram/${configAccountId.value}/proxy`, body);
      alert('代理设置已保存');
      await loadTgAccounts();
    } else {
      await api.post(`/accounts/wa/${configAccountId.value}/proxy`, body);
      alert('代理设置已保存');
      await loadWaAccounts();
    }
  } catch(e) { alert('保存失败: ' + (e.response?.data?.error || e.message)); }
}

async function testProxy() {
  configTesting.value = true; configTestResult.value = '';
  try {
    const { data } = await api.post(`${configTargetPlatform.value === 'telegram' ? '/accounts/telegram' : '/accounts/wa'}/${configAccountId.value}/proxy/test`);
    configTestResult.value = data?.success ? '✅ 代理连接正常' : ('❌ ' + (data?.error || '连接失败'));
  } catch(e) { configTestResult.value = '❌ 测试失败: ' + (e.response?.data?.error || e.message); }
  finally { configTesting.value = false; }
}

async function deleteAccount(acc) {
  if (!confirm(`确定要删除账号 "${acc.name}" 吗？`)) return;
  try {
    await api.delete(`/accounts/${acc.id}`);
    await loadWaAccounts();
    if (currentWaAccountId.value === acc.id) {
      currentWaAccountId.value = null;
      chatStore.currentWaAccountId = null;
    }
  } catch(e) {
    alert('删除失败: ' + (e.response?.data?.error || e.message));
  }
}

function onAccountCardClick(acc) {
  activeChannel.value = 'whatsapp';
  channelSheetOpen.value = false;
  if (!acc.online) {
    // 断开账号：先选中它进入其登录态，再引导登录
    if (currentWaAccountId.value !== acc.id) switchWaAccount(acc.id);
    if (typeof router !== 'undefined' && router.currentRoute.value.path !== '/chat') {
      router.push('/chat');
    }
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('wa:show-intro', { detail: { accountId: acc.id } }));
    }, 50);
    return;
  }
  switchWaAccount(acc.id);
}

function launchAccount(acc) {
  if (!acc.online) {
    // 先选中该账号（已选中则保持），再直接进入扫码登录页
    if (currentWaAccountId.value !== acc.id) switchWaAccount(acc.id);
    acc._launching = true;
    if (typeof router !== 'undefined' && router.currentRoute.value.path !== '/chat') {
      router.push('/chat');
    }
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('wa:open-qr', { detail: { accountId: acc.id } }));
      setTimeout(() => { if (acc._launching) acc._launching = false; }, 3000);
    }, 50);
  } else {
    switchWaAccount(acc.id);
  }
}

async function onAddAccount() {
  try {
    const existingCount = waAccounts.value.length;
    const newName = 'WhatsApp' + (existingCount + 1);
    const instName = 'wa_' + newName.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Date.now().toString(36);
    const { data: resData } = await api.post('/accounts/wa/connect', { instanceName: instName, name: newName });
    const newAccount = resData.account;
    await loadWaAccounts();
    currentWaAccountId.value = newAccount.id;
    chatStore.currentWaAccountId = newAccount.id;
    chatStore.connectionStatus = 'disconnected';
    if (route.path !== '/chat') {
      await router.push('/chat');
    }
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('wa:show-intro'));
    }, 50);
  } catch (e) {
    console.error('[Layout] Create account failed:', e);
    const errMsg = e.response?.data?.message || e.response?.data?.error || e.message;
    if (e.response?.data?.error === 'wa_limit') {
      alert(errMsg);
    } else {
      alert('Create failed: ' + errMsg);
    }
  }
}

const channels = [
  { id: 'whatsapp', name: 'WhatsApp', icon: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/></svg>', status: 'online', unread: 8 },
  { id: 'email', name: '邮箱', icon: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>', status: 'online', unread: 0 },
  { id: 'telegram', name: 'Telegram', icon: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.295-.6.295l.213-3.053 5.56-5.022c.24-.213-.054-.334-.373-.121l-6.869 4.326-2.96-.924c-.64-.203-.658-.64.135-.954l11.566-4.458c.538-.196 1.006.128.832.94z"/></svg>', status: 'online', unread: 0 },
  // 预留渠道：上线时把 status 改为 'online' 即自动显示在切换条，channelIcons里补上对应SVG
  // { id: 'facebook', name: 'Facebook', icon: '...', status: 'offline', unread: 0 },
  // { id: 'instagram', name: 'Instagram', icon: '...', status: 'offline', unread: 0 },
  // { id: 'linkedin', name: 'LinkedIn', icon: '...', status: 'offline', unread: 0 },
];

/* 渠道图标SVG映射：新增渠道在此加一项即可自动显示（优先使用这里的大图标，fallback到ch.icon） */
const channelIcons = {
  whatsapp: '<svg viewBox="0 0 32 32" width="22" height="22"><circle cx="16" cy="16" r="14" fill="#00a884"/><path d="M16.003 6.5C10.76 6.5 6.5 10.76 6.5 16.003c0 1.91.57 3.69 1.55 5.17L6.5 24.5l3.43-1.48a9.44 9.44 0 006.07 2.18c5.24 0 9.5-4.26 9.5-9.5S21.24 6.5 16.003 6.5z" fill="#fff"/><path d="M12.85 11.96c-.21-.48-.44-.49-.65-.5l-.55-.01c-.19 0-.5.07-.76.36-.26.29-1 1-1 2.38s1.02 2.75 1.16 2.94 1.99 3.1 4.86 4.3c2.42 1 2.91.8 3.44.75.52-.06 1.69-.69 1.93-1.36.24-.67.24-1.24.17-1.36-.07-.12-.26-.19-.55-.33-.29-.14-1.69-.83-1.95-.93-.26-.1-.45-.14-.65.14-.2.28-.74.93-.91 1.11-.17.19-.33.22-.62.07-.29-.14-1.21-.45-2.3-1.42-.85-.76-1.43-1.69-1.59-1.98-.17-.28-.02-.44.12-.58.13-.13.29-.33.43-.5.14-.17.19-.28.29-.47.1-.19.05-.36-.02-.5-.08-.14-.64-1.56-.88-2.14z" fill="#00a884"/></svg>',
  email: '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>',
  telegram: '<svg viewBox="0 0 24 24" width="22" height="22" fill="#2AABEE"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.295-.6.295l.213-3.053 5.56-5.022c.24-.213-.054-.334-.373-.121l-6.869 4.326-2.96-.924c-.64-.203-.658-.64.135-.954l11.566-4.458c.538-.196 1.006.128.832.94z"/></svg>',
  facebook: '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>',
  instagram: '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>',
  linkedin: '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>',
};

const activeChannels = computed(() => channels.filter(c => c.status !== "offline"));
const currentChannel = computed(() => channels.find(c => c.id === activeChannel.value) || channels[0]);

function switchChannel(ch) {
  channelDropdown.value = false;
  activeChannel.value = ch.id;
  if (isMobile.value) {
    mobilePanel.value = null;
    mobileInConv.value = (ch.id === 'email' || ch.id === 'telegram');
  }
  // 切到TG/邮箱时清除WA的activeConv，避免残留聊天视图
  if (ch.id === 'telegram' || ch.id === 'email') {
    chatStore.setActiveConversation(null);
    tgActiveJid.value = null;
    router.push('/chat');
  }
  // 切回WA时清除TG残留状态，避免移动端布局异常
  if (ch.id === 'whatsapp') {
    tgActiveJid.value = null;
  }
  if (ch.id === 'telegram') {
    loadTgConversations();
  }
}

function selectChannel(id) {
  channelDropdown.value = false;
  const ch = channels.find(c => c.id === id) || { id };
  activeChannel.value = ch.id;
  if (isMobile.value) {
    mobilePanel.value = null;
    mobileInConv.value = false; // 切到渠道列表页时都应是列表视图，不设为in-conv
  }
  if (id === 'telegram' || id === 'email') {
    chatStore.setActiveConversation(null);
    tgActiveJid.value = null;
    activeConv.value = null;
    router.push('/chat');
  }
  if (id === 'whatsapp') {
    tgActiveJid.value = null;
  }
  if (id === 'telegram') {
    loadTgConversations();
  }
}

const currentChannelAccounts = computed(() => {
  if (activeChannel.value === 'whatsapp') {
    // Multi-account: show all connected WA accounts
    const connected = waAccounts.value.filter(a => a.online);
    if (connected.length > 0) return connected;
    return [];
  }
  if (activeChannel.value === 'email') {
    return [
      { id: 'em-1', name: 'Sales', email: 'sales@jzjglass.com', color: '#EA4335', status: 'online' },
    ];
  }
  return [];
});


// Conversations from chatStore - mapped via computed
// ─── TG 登录欢迎页 ───
const tgLoginView = ref('welcome'); // welcome | qr | phone
const tgCountryOpen = ref(false);
const tgCountrySearch = ref('');
const tgCountryIdx = ref(0);
const tgPhoneNum = ref('');
const tgKeepSigned = ref(true);
const tgCountries = [
  {name:'中国',flag:'🇨🇳',code:'+86'},{name:'中国香港',flag:'🇭🇰',code:'+852'},{name:'中国澳门',flag:'🇲🇴',code:'+853'},
  {name:'美国',flag:'🇺🇸',code:'+1'},{name:'新加坡',flag:'🇸🇬',code:'+65'},{name:'马来西亚',flag:'🇲🇾',code:'+60'},
  {name:'印度尼西亚',flag:'🇮🇩',code:'+62'},{name:'泰国',flag:'🇹🇭',code:'+66'},{name:'越南',flag:'🇻🇳',code:'+84'},
  {name:'菲律宾',flag:'🇵🇭',code:'+63'},{name:'缅甸',flag:'🇲🇲',code:'+95'},{name:'柬埔寨',flag:'🇰🇭',code:'+855'},
  {name:'老挝',flag:'🇱🇦',code:'+856'},{name:'印度',flag:'🇮🇳',code:'+91'},{name:'巴基斯坦',flag:'🇵🇰',code:'+92'},
  {name:'孟加拉国',flag:'🇧🇩',code:'+880'},{name:'尼泊尔',flag:'🇳🇵',code:'+977'},{name:'斯里兰卡',flag:'🇱🇰',code:'+94'},
  {name:'哈萨克斯坦',flag:'🇰🇿',code:'+7'},{name:'乌兹别克斯坦',flag:'🇺🇿',code:'+998'},{name:'蒙古',flag:'🇲🇳',code:'+976'},
  {name:'日本',flag:'🇯🇵',code:'+81'},{name:'韩国',flag:'🇰🇷',code:'+82'},{name:'英国',flag:'🇬🇧',code:'+44'},
  {name:'德国',flag:'🇩🇪',code:'+49'},{name:'法国',flag:'🇫🇷',code:'+33'},{name:'意大利',flag:'🇮🇹',code:'+39'},
  {name:'西班牙',flag:'🇪🇸',code:'+34'},{name:'葡萄牙',flag:'🇵🇹',code:'+351'},{name:'荷兰',flag:'🇳🇱',code:'+31'},
  {name:'比利时',flag:'🇧🇪',code:'+32'},{name:'瑞士',flag:'🇨🇭',code:'+41'},{name:'瑞典',flag:'🇸🇪',code:'+46'},
  {name:'挪威',flag:'🇳🇴',code:'+47'},{name:'丹麦',flag:'🇩🇰',code:'+45'},{name:'芬兰',flag:'🇫🇮',code:'+358'},
  {name:'波兰',flag:'🇵🇱',code:'+48'},{name:'乌克兰',flag:'🇺🇦',code:'+380'},{name:'俄罗斯',flag:'🇷🇺',code:'+7'},
  {name:'土耳其',flag:'🇹🇷',code:'+90'},{name:'阿联酋',flag:'🇦🇪',code:'+971'},{name:'沙特阿拉伯',flag:'🇸🇦',code:'+966'},
  {name:'卡塔尔',flag:'🇶🇦',code:'+974'},{name:'科威特',flag:'🇰🇼',code:'+965'},{name:'以色列',flag:'🇮🇱',code:'+972'},
  {name:'埃及',flag:'🇪🇬',code:'+20'},{name:'摩洛哥',flag:'🇲🇦',code:'+212'},{name:'尼日利亚',flag:'🇳🇬',code:'+234'},
  {name:'肯尼亚',flag:'🇰🇪',code:'+254'},{name:'南非',flag:'🇿🇦',code:'+27'},{name:'澳大利亚',flag:'🇦🇺',code:'+61'},
  {name:'加拿大',flag:'🇨🇦',code:'+1'},{name:'巴西',flag:'🇧🇷',code:'+55'},{name:'墨西哥',flag:'🇲🇽',code:'+52'},
  {name:'阿根廷',flag:'🇦🇷',code:'+54'}
];
const tgCountryFiltered = computed(() => {
  const kw = (tgCountrySearch.value || '').trim().toLowerCase();
  if (!kw) return tgCountries;
  return tgCountries.filter(c => c.name.toLowerCase().indexOf(kw) > -1 || c.code.indexOf(kw) > -1);
});
// ─── Telegram Bot 连接 ───
const tgAccounts = ref([]);
const tgConnecting = ref(false);
const showTgModal = ref(false);
const tgTokenInput = ref('');
const tgBotName = ref('');
// ─── 微信直连外贸Agent（二维码弹窗） ───
const showWxQrModal = ref(false);
const wxQrTs = ref(Date.now());
const wxConnected = ref(false);
let wxQrTimer = null;
function openWxQr() {
  showWxQrModal.value = true;
  wxQrTs.value = Date.now();
  wxConnected.value = false;
  clearInterval(wxQrTimer);
  wxQrTimer = setInterval(async () => {
    wxQrTs.value = Date.now(); // 刷新二维码图片（防缓存）
    try {
      const r = await fetch('/wechat-agent-qr-state.json?v=' + Date.now());
      if (r.ok) {
        const st = await r.json();
        wxConnected.value = !!st.connected;
      }
    } catch(e) {}
  }, 15000);
}
function closeWxQr() {
  showWxQrModal.value = false;
  clearInterval(wxQrTimer);
  wxQrTimer = null;
}
async function loadTgAccounts() {
  try {
    const { data } = await api.get('/accounts');
    tgAccounts.value = (data || []).filter(a => a.platform === 'telegram');
  } catch(e) {}
}

// TG会话列表（独立于chatStore，因为TG走不同sessionId）
const tgConversations = ref([]);
const tgConversationsLoading = ref(true); // Track initial load to avoid two-stage loading
let tgPollTimer = null;
function onTgSocketMessage(e) {
  const data = e.detail;
  if (!data) return;
  const jid = data.jid;
  if (!jid) return;
  // 刷新会话列表
  loadTgConversations();
  // 如果正是当前打开的会话，追加消息
  if (tgActiveJid.value === jid) {
    // 兼容两种emit格式：telegram:message（data.message）和 whatsapp:message兼容格式（data.message带body）
    const m = data.message || data;
    const body = m.body || m.content || m.text || '';
    const fromMe = !!m.fromMe;
    const waId = m.waMessageId || String(m.id || Date.now());
    // Normalize media placeholder text for socket events
    const normalizedText = ['image','video','document'].includes(m.messageType || m.type) ? '[media]' : (m.text || body);
    // 出站消息去重：匹配waMessageId/id，同时检查_tempId（乐观消息）
    const exists = tgMessages.value.some(x => {
      if (x.waMessageId && x.waMessageId === waId) return true;
      if (x.id === m.id) return true;
      // 出站乐观消息：用body+方向匹配（socket还没带tempId）
      if (fromMe && x._tempId && x.direction === 'outbound') return true;
      return false;
    });
    if (!exists && body) {
      let tgTransObj = null;
      if (m.translation) {
        if (typeof m.translation === 'string') {
          const ts = m.translation.trim();
          if (ts.startsWith('{') && ts.endsWith('}')) { try { tgTransObj = JSON.parse(ts); } catch(e){} }
          if (!tgTransObj) tgTransObj = { translated: m.translation };
        } else { tgTransObj = m.translation; }
      }
      tgMessages.value.push({
        id: m.id || Date.now(),
        from: fromMe ? 'me' : jid.split('@')[0],
        body,
        text: normalizedText,
        time: formatMsgTime(m.timestamp || new Date()),
        timestamp: m.timestamp || Date.now(),
        direction: fromMe ? 'outbound' : 'inbound',
        fromMe,
        waMessageId: waId,
        platform: 'telegram',
        translationObj: tgTransObj,
        mediaUrl: m.mediaUrl || null,
        messageType: m.messageType || 'text',
      });
    } else if (exists && fromMe && body) {
      // 出站消息已存在（乐观消息），更新其真实ID/翻译
      let tgTransObj2 = null;
      if (m.translation) {
        if (typeof m.translation === 'string') {
          const ts2 = m.translation.trim();
          if (ts2.startsWith('{') && ts2.endsWith('}')) { try { tgTransObj2 = JSON.parse(ts2); } catch(e){} }
          if (!tgTransObj2) tgTransObj2 = { translated: m.translation };
        } else { tgTransObj2 = m.translation; }
      }
      const existIdx = tgMessages.value.findIndex(x => {
        if (x.waMessageId && x.waMessageId === waId) return true;
        if (x.id === m.id) return true;
        if (x._tempId && x.direction === 'outbound') return true;
        return false;
      });
      if (existIdx >= 0) {
        tgMessages.value[existIdx] = {
          ...tgMessages.value[existIdx],
          id: m.id || tgMessages.value[existIdx].id,
          waMessageId: waId,
          translationObj: tgTransObj2 || tgMessages.value[existIdx].translationObj,
          mediaUrl: m.mediaUrl || tgMessages.value[existIdx].mediaUrl || null,
          messageType: m.messageType || tgMessages.value[existIdx].messageType || 'text',
          text: ['image','video','document'].includes(m.messageType || m.type) ? '[media]' : (m.text || body),
        };
      }
      nextTick(() => {
        const box = document.querySelector('.tg-msgs');
        if (box) box.scrollTop = box.scrollHeight;
      });
    }
  }
}
function onTgTranslationUpdate(e) {
  const data = e.detail;
  if (!data) return;
  const { id: msgId, waId, jid, translation } = data;
  // Find and update the matching message in tgMessages
  const idx = tgMessages.value.findIndex(m => 
    (waId && m.waMessageId === waId) || 
    (msgId && m.id === msgId)
  );
  if (idx >= 0 && translation) {
    tgMessages.value[idx].translationObj = translation;
    // Trigger reactivity
    tgMessages.value = [...tgMessages.value];
  }
}
function onTgSocketConvUpdate(e) {
  loadTgConversations();
}
// 定时刷新TG会话未读数（不用切渠道也能看到红点）
let tgRefreshTimer = null;
function startTgUnreadPolling() {
  if (tgRefreshTimer) clearInterval(tgRefreshTimer);
  loadTgConversations();
  tgRefreshTimer = setInterval(() => { loadTgConversations().catch(()=>{}); }, 30000);
}
async function loadTgConversations() {
  const wasLoading = tgConversationsLoading.value;
  try {
    const { data } = await api.get('/whatsapp/conversations', { params: { platform: 'telegram' } });
    // 自聊天过滤由后端按真实 JID 完成（getMe().id），前端不再按 name 误伤同名真实客户
    tgConversations.value = (data || [])
      .map(c => ({
      ...c,
      id: c.jid,
      avatar: c.avatarUrl || c.avatar || '',
      color: avatarColor(c.name || c.phone || c.jid),
      platform: 'telegram',
      preview: c.lastMessage || '',
      time: formatConvTime(c.lastMessageTime),
      unread: c.unreadCount || 0,
    }));
    if (wasLoading) tgConversationsLoading.value = false;
  } catch(e) { console.warn('loadTgConv err', e); if (wasLoading) tgConversationsLoading.value = false; }
}
function tgSwitchLoginView(v){ tgLoginView.value = v; tgCountryOpen.value = false; }
  function tgOpenCountry(){ tgCountryOpen.value = !tgCountryOpen.value; }
  function tgSelectCountry(i){ tgCountryIdx.value = i; tgCountryOpen.value = false; tgCountrySearch.value = ''; }
  function tgLoginNext(){
    const num = (tgPhoneNum.value || '').replace(/[\s\-()]/g, '');
    if (!num) { ElMessage.warning('请输入手机号'); return; }
    ElMessage.info('登录接口接入中：将向 ' + tgCountries[tgCountryIdx.value].code + ' ' + num + ' 发送验证码');
  }
  // ── TG 真实扫码登录（QR token + 轮询） ──
  const tgQrToken = ref('');
  const tgQrTimer = ref(null);
  const tgQrPasswordNeeded = ref(false);
  function tgStopQrPoll() {
    if (tgQrTimer.value) { clearInterval(tgQrTimer.value); tgQrTimer.value = null; }
  }
  async function tgRenderQr(svg, token) {
    if (!svg || !token) return;
    try {
      const url = 'tg://login?token=' + token;
      const dataUrl = await QRCode.toDataURL(url, { width: 232, margin: 1, errorCorrectionLevel: 'M', color: { dark: '#1a1a1a', light: '#ffffff' } });
      svg.replaceChildren();
      const ns = 'http://www.w3.org/2000/svg';
      const img = document.createElementNS(ns, 'image');
      img.setAttribute('href', dataUrl);
      img.setAttribute('x', '0'); img.setAttribute('y', '0');
      img.setAttribute('width', '232'); img.setAttribute('height', '232');
      svg.appendChild(img);
    } catch (e) { console.warn('tgRenderQr err', e); }
  }
  async function tgPollQrLogin() {
    if (!tgQrToken.value) return;
    try {
      const { data } = await api.post('/tg-userbot/qr/poll', { qrToken: tgQrToken.value });
      if (!data) return;
      if (data.status === 'connected') {
        tgStopQrPoll();
        if (tgLoginView.value !== 'welcome') {
          ElMessage.success('Telegram 登录成功');
        }
        tgLoginView.value = 'welcome';
        await loadTgAccounts();
        // 同步会话（联系人+对话），刷新客户列表
        try { await api.post('/tg-userbot/sync-dialogs', { limit: 200 }); } catch(e) { console.warn('tg sync-dialogs err', e); }
        await loadTgConversations();
        // 头像同步（后台触发，不阻塞登录流程）
        try { api.post('/tg-userbot/sync-avatars'); } catch(e) { console.warn('tg sync-avatars err', e); }
        return;
      }
      if (data.status === 'password_needed') {
        tgStopQrPoll();
        if (tgQrPasswordNeeded.value) return; // 已在输入中
        tgQrPasswordNeeded.value = true;
        try {
          const { value } = await ElMessageBox.prompt('该账号已开启两步验证，请输入验证密码：', '两步验证', {
            confirmButtonText: '确认', cancelButtonText: '取消', inputType: 'password',
            inputValidator: (v) => (v && v.trim() ? true : '密码不能为空'),
          });
          const res = await api.post('/tg-userbot/qr/password', { password: value });
          if (res.data && res.data.status === 'connected') {
            ElMessage.success('Telegram 登录成功');
            tgLoginView.value = 'welcome';
            await loadTgAccounts();
          } else if (res.data && res.data.status === 'pending') {
            ElMessage.success('密码验证通过，正在完成登录…');
            tgQrPasswordNeeded.value = false;
            tgQrTimer.value = setInterval(tgPollQrLogin, 3000);
          } else {
            ElMessage.error((res.data && res.data.error) || '登录失败');
            tgQrPasswordNeeded.value = false;
            const svg = document.getElementById('tgLoginQrSvg');
            if (svg) await tgBuildQrSvg();
          }
        } catch (e) {
          tgQrPasswordNeeded.value = false;
          const svg = document.getElementById('tgLoginQrSvg');
          if (svg) await tgBuildQrSvg();
        }
        return;
      }
      if (data.status === 'expired' || data.status === 'invalid') {
        tgStopQrPoll();
        ElMessage.warning('二维码已过期，正在刷新…');
        await tgBuildQrSvg();
        return;
      }
      if (data.status === 'error') {
        tgStopQrPoll();
        ElMessage.error('登录失败：' + (data.error || '未知错误'));
        return;
      }
      // pending：token 变化则重绘
      if (data.token && data.token !== tgQrToken.value) {
        tgQrToken.value = data.token;
        const svg = document.getElementById('tgLoginQrSvg');
        if (svg) await tgRenderQr(svg, data.token);
      }
    } catch (e) { console.warn('tgPollQrLogin err', e); }
  }
  async function tgBuildQrSvg() {
    tgStopQrPoll();
    const svg = document.getElementById('tgLoginQrSvg');
    if (!svg) return;
    svg.replaceChildren();
    try {
      const { data } = await api.get('/tg-userbot/qr');
      // 后端已连接：直接进入成功流程（真实扫码后并发请求可能拿到 already_connected）
      if (data && data.status === 'already_connected') {
        // 防重复弹窗：已在欢迎页则不重复提示
        if (tgLoginView.value !== 'welcome') {
          ElMessage.success('Telegram 登录成功');
        }
        tgLoginView.value = 'welcome';
        await loadTgAccounts();
        try { await api.post('/tg-userbot/sync-dialogs', { limit: 200 }); } catch(e) { console.warn('tg sync-dialogs err', e); }
        await loadTgConversations();
        // 头像同步（后台触发，不阻塞登录流程）
        try { api.post('/tg-userbot/sync-avatars'); } catch(e) { console.warn('tg sync-avatars err', e); }
        return;
      }
      if (!data || data.status !== 'pending' || !data.token) {
        if (data && data.status === 'error') ElMessage.error('二维码获取失败：' + (data.error || '未知错误'));
        else ElMessage.error('二维码获取失败，请重试');
        return;
      }
      tgQrToken.value = data.token;
      await tgRenderQr(svg, data.token);
      tgQrTimer.value = setInterval(tgPollQrLogin, 3000);
    } catch (e) {
      console.warn('tgBuildQrSvg err', e);
      ElMessage.error('二维码获取失败，请重试');
    }
  }
  watch(tgLoginView, () => { nextTick(() => { tgBuildQrSvg(); }); });
  watch([activeChannel, tgActiveJid], () => {
    nextTick(() => {
      if (activeChannel.value === 'telegram' && !tgActiveJid.value) tgBuildQrSvg();
    });
  });
  onMounted(() => { nextTick(() => { tgBuildQrSvg(); }); });
// ─── TG 账号操作（对齐 WhatsApp：新建会话/启动/配置代理/删除） ───
function tgOpenNewSession() {
  activeChannel.value = 'telegram';
  tgActiveJid.value = null;
  activeConv.value = null;
  chatStore.activeConversation = null;
  tgLoginView.value = 'qr';
  tgCountryOpen.value = false;
  if (typeof router !== 'undefined' && router.currentRoute.value.path !== '/chat') router.push('/chat');
  nextTick(() => { tgBuildQrSvg(); });
}

async function tgLaunchAccount(tg) {
  try {
    tg._tgLaunching = true;
    const { data } = await api.post(`/accounts/telegram/${tg.id}/launch`);
    ElMessage.success('Telegram 账号已启动');
    await loadTgAccounts();
  } catch (e) {
    ElMessage.error('启动失败: ' + (e.response?.data?.error || e.message));
  } finally {
    tg._tgLaunching = false;
  }
}

function tgConfigureAccount(tg) {
  // 复用代理配置抽屉，按 TG 接口读取/保存
  configPanelOpen.value = true;
  configAccountId.value = tg.id;
  configAccountName.value = tg.name || ('@' + tg.telegramBotUsername) || 'Telegram';
  configProxyProtocol.value = 'socks5';
  configProxyHost.value = '';
  configProxyPort.value = '';
  configProxyUser.value = '';
  configProxyPass.value = '';
  configTestResult.value = '';
  configTargetPlatform.value = 'telegram';
  loadTgProxyConfig(tg.id);
}

async function loadTgProxyConfig(id) {
  try {
    const { data } = await api.get(`/accounts/telegram/${id}/proxy`);
    if (data?.proxy && data.proxy.enabled !== false) {
      configProxyHost.value = data.proxy.host || '';
      configProxyPort.value = String(data.proxy.port || '');
      configProxyProtocol.value = data.proxy.protocol || 'socks5';
      configProxyUser.value = data.proxy.username || '';
      configProxyPass.value = data.proxy.password || '';
    }
  } catch(e) { /* ignore */ }
}

async function tgDeleteAccount(tg) {
  const name = tg.name || ('@' + tg.telegramBotUsername) || 'Telegram';
  if (!confirm(`确定要删除 TG 账号 "${name}" 吗？此操作不可恢复。`)) return;
  try {
    await api.delete(`/accounts/telegram/${tg.id}`);
    ElMessage.success('TG 账号已删除');
    await loadTgAccounts();
    if (tgActiveJid.value) tgActiveJid.value = null;
    if (tgAccounts.value.length === 0) tgLoginView.value = 'welcome';
  } catch(e) {
    alert('删除失败: ' + (e.response?.data?.error || e.message));
  }
}

async function tgConnect() {
  const token = tgTokenInput.value.trim();
  if (!token) return;
  tgConnecting.value = true;
  try {
    const { data } = await api.post('/accounts/telegram/connect', { token, name: tgBotName.value || undefined });
    ElMessage.success('Telegram Bot @' + (data.bot?.username || 'bot') + ' 连接成功！');
    tgTokenInput.value = ''; tgBotName.value = ''; showTgModal.value = false;
    await loadTgAccounts();
    await loadTgConversations();
    await chatStore.fetchConversations();
  } catch (e) {
    ElMessage.error('连接失败：' + (e.response?.data?.error || e.message));
  } finally { tgConnecting.value = false; }
}
async function tgDisconnect(id) {
  try {
    await api.delete('/accounts/telegram/' + id);
    ElMessage.success('Telegram Bot 已断开');
    await loadTgAccounts();
  } catch (e) {
    ElMessage.error('断开失败：' + (e.response?.data?.error || e.message));
  }
}

const conversations = computed(() => {
  const fuMap = chatStore.followupMapByJid || {};
  const frMap = chatStore.firstResponseMapByJid || {};
  let list = chatStore.sortedConversations.map(c => {
    const fr = frMap[c.jid];
    return {
      jid: c.jid,
      id: c.jid,
      name: c.name || (c.phone || c.jid),
      phone: c.phone,
      preview: c.lastMessage || '',
      time: formatConvTime(c.lastMessageTime),
      unread: c.unreadCount || 0,
      color: avatarColor(c.name || c.phone || ''),
      status: 'offline',
      followupStatus: fuMap[c.jid] || null,
      firstResponseWaited: fr?.minutesWaited || null,
      pinned: !!c.pinned,
      starred: !!c.starred,
      blocked: !!c.blocked,
      accountId: c.accountId || null,
      accountName: c.accountName || null,
      platform: c.platform || 'whatsapp',
    };
  });
  // 首响客户永远排最前（按等待时间最久在前）
  list.sort((a, b) => {
    if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
    const aFr = a.firstResponseWaited ? 1 : 0;
    const bFr = b.firstResponseWaited ? 1 : 0;
    if (aFr !== bFr) return bFr - aFr;
    if (aFr && bFr) return b.firstResponseWaited - a.firstResponseWaited;
    return 0;
  });
  if (chatStore.showFollowupsOnly) {
    list = list.filter(c => !!c.followupStatus || !!c.firstResponseWaited);
  }
  return list;
});

// 按当前渠道过滤的会话列表（不影响conversations原始引用）
const displayConversations = computed(() => {
  if (activeChannel.value === 'telegram') {
    return tgConversations.value;
  }
  // WhatsApp/其他：显示无platform标记（WA旧数据）或platform==='whatsapp'的
  return conversations.value.filter(c => !c.platform || c.platform === 'whatsapp');
});

// 首响提醒条预览：前 3 位
const firstResponsePreview = computed(() => chatStore.firstResponseAlerts.slice(0, 3));
const frBarDismissed = ref(false);
let _lastFrCount = 0;
watch(() => chatStore.followupCounts.firstResponse, (count) => {
  if (count > _lastFrCount) frBarDismissed.value = false;
  _lastFrCount = count;
  if (count === 0) frBarDismissed.value = false;
});

// 跳转到指定 index 的首响客户
// ─── 新建聊天 ───
const showNewChat = ref(false);
const ncPhone = ref('');
const ncMessage = ref('');
const ncCheckResult = ref(null);
const ncChecking = ref(false);
const ncSending = ref(false);
const ncError = ref('');
const ncCountryOpen = ref(false);
const ncCountryCode = ref('+86');
const ncPhoneInput = ref(null);
const ncCountrySearch = ref('');
const ncCountrySearchInput = ref(null);
const ncCountries = [
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
const ncFilteredCountries = computed(() => {
  const q = ncCountrySearch.value.trim().toLowerCase();
  if (!q) return ncCountries;
  return ncCountries.filter(c =>
    c.name.includes(ncCountrySearch.value.trim()) ||
    c.name_en.toLowerCase().includes(q) ||
    c.code.includes(ncCountrySearch.value.trim())
  );
});
function ncPickCountry(c) {
  ncCountryCode.value = c.code;
  ncCountryOpen.value = false;
  ncCountrySearch.value = '';
  ncCheckResult.value = null;
  ncError.value = '';
  // 切换国家后如果已经有号，重新触发验号
  if (ncPhone.value.trim()) {
    clearTimeout(ncCheckTimer);
    ncCheckTimer = setTimeout(() => ncCheckPhone(ncBuildFullNumber()), 300);
  }
  ncFocusPhone();
}
function ncToggleCountry() {
  // 点flag/cc/caret才toggle；点列表项会被 @click.stop 吃掉不会冒泡到这
  ncCountryOpen.value = !ncCountryOpen.value;
  if (ncCountryOpen.value) ncCountrySearch.value = '';
}

// 打开国家列表时自动聚焦搜索框
watch(ncCountryOpen, (v) => {
  if (v) nextTick(() => { if (ncCountrySearchInput.value) ncCountrySearchInput.value.focus(); });
});
const ncCurrentCountry = computed(() => {
  return ncCountries.find(c => c.code === ncCountryCode.value) || ncCountries[0];
});

function ncFocusPhone() {
  nextTick(() => { if (ncPhoneInput.value) ncPhoneInput.value.focus(); });
}

function ncClose() {
  showNewChat.value = false;
  ncCountryOpen.value = false;
  ncError.value = '';
  clearTimeout(ncCheckTimer);
  ncCheckTimer = null;
}

let ncCheckTimer = null;
let ncLastChecked = '';

function openNewChat() {
  ncPhone.value = '';
  ncMessage.value = '';
  ncCheckResult.value = null;
  ncError.value = '';
  ncChecking.value = false;
  ncSending.value = false;
  ncLastChecked = '';
  showNewChat.value = true;
  ncFocusPhone();
}

function ncBuildFullNumber() {
  const digits = ncPhone.value.replace(/[\s+\-()]/g, '');
  const cc = ncCountryCode.value.replace('+', '');
  if (!digits) return '';
  if (digits.startsWith(cc) && digits.length > cc.length + 4) return digits;
  if (cc === '86' && /^1\d{10}$/.test(digits)) return '86' + digits;
  return cc + digits.replace(/^0+/, '');
}

function ncOnPhoneInput() {
  ncCheckResult.value = null;
  ncError.value = '';
  clearTimeout(ncCheckTimer);
  const fullNum = ncBuildFullNumber();
  // 中国号码13位(86+11)直接查；其他国家码数字够7位就查
  const minLen = ncCountryCode.value === '+86' ? 13 : (ncCountryCode.value.length + 6);
  if (fullNum.length >= minLen && fullNum !== ncLastChecked) {
    ncCheckTimer = setTimeout(() => {
      ncCheckPhone(fullNum);
    }, 600);
  }
}

async function ncCheckPhone(fullNum) {
  const phone = fullNum || ncBuildFullNumber();
  if (!phone) { ncCheckResult.value = null; return null; }
  ncChecking.value = true;
  ncError.value = '';
  ncLastChecked = phone;
  try {
    const { data } = await api.post('/whatsapp/check-number', { numbers: [phone] });
    const item = Array.isArray(data) ? data[0] : null;
    // 若用户在请求期间又输入了新号码，不覆盖结果
    if (phone !== ncBuildFullNumber()) return null;
    ncCheckResult.value = item || { exists: false };
    return item;
  } catch (e) {
    ncError.value = '网络错误：' + (e.response?.data?.error || e.message);
    ncCheckResult.value = { exists: false };
    return null;
  } finally {
    ncChecking.value = false;
  }
}

async function ncSubmit() {
  const phone = ncPhone.value.replace(/[\s+\-()]/g, '');
  if (!phone) { ncError.value = '请输入手机号'; return; }
  ncError.value = '';
  let item = ncCheckResult.value;
  const fullNum = ncBuildFullNumber();
  if (!item || !item.exists || item.number !== fullNum) {
    item = await ncCheckPhone(fullNum);
  }
  if (!item || !item.exists) {
    if (item && !item.exists) ncError.value = '该号码未注册 WhatsApp，请检查号码或国家码';
    return;
  }
  const jid = item.jid || (fullNum + '@s.whatsapp.net');
  // 先发首条消息的分支
  if (ncMessage.value.trim()) {
    ncSending.value = true;
    ncError.value = '';
    try {
      await api.post('/whatsapp/send', { to: jid, message: ncMessage.value.trim() });
      ncClose();
      // 发送成功后等后端落库，再刷新会话并跳转
      setTimeout(async () => {
        await chatStore.fetchConversations();
        ncNavigateToJid(jid, fullNum, item.name || phone);
      }, 1200);
    } catch (e) {
      ncError.value = '发送失败：' + (e.response?.data?.error || e.message);
      ncSending.value = false;
    }
    return;
  }
  // 不发消息，直接打开聊天（核心：复用 selectConv 路径，确保手机端正确切换）
  ncClose();
  nextTick(() => {
    ncNavigateToJid(jid, fullNum, item.name || phone);
  });
}

// 统一的跳转工具函数：完全模拟 selectConv 的状态切换，并处理路由
function ncNavigateToJid(jid, fullNum, name) {
  // 确保在通信模块
  activePlatform.value = 'communication';
  activeChannel.value = 'whatsapp';
  // 构造临时会话对象（新号未发过消息时后端列表里没有，必须占位）
  const tmpConv = {
    jid,
    name: name || fullNum,
    phone: fullNum,
    lastMessage: '',
    lastMessageTime: new Date().toISOString(),
    timestamp: Date.now(),
    unreadCount: 0,
    unread: 0,
    isNew: true
  };
  // 确保会话在列表中
  let conv = chatStore.conversations.find(c => c.jid === jid);
  if (!conv) {
    chatStore.conversations.unshift(tmpConv);
    conv = tmpConv;
  }
  // 完全走 selectConv 的逻辑设置状态
  activeConv.value = jid;
  chatStore.setActiveConversation(jid);
  if (isMobile.value) {
    mobileInConv.value = true;
    mobileAccountsOpen.value = false;
    mobileDrawerOpen.value = false;
    mobilePanel.value = null;
  }
  // 路由跳转
  const targetQuery = { jid };
  if (route.path !== '/chat') {
    router.push({ path: '/chat', query: targetQuery });
  } else {
    // 同一 /chat 页只更新 query，避免组件重挂载
    router.replace({ path: '/chat', query: targetQuery });
  }
  // 异步刷新会话列表，但要保护刚插入的新会话不被后端空数据覆盖
  chatStore.fetchConversations().then(() => {
    // fetch 后如果新 jid 不在列表中（未发过消息的新号后端无记录），补插回去
    if (!chatStore.conversations.find(c => c.jid === jid)) {
      chatStore.conversations.unshift({ ...tmpConv, timestamp: Date.now() });
    }
  }).catch(()=>{});
}


function jumpToFirstResponse(index) {
  const alerts = chatStore.firstResponseAlerts;
  const target = alerts[index] || alerts[0];
  if (!target) return;
  jumpToJid(target.jid);
}
function jumpToFirstResponseByName(alert) {
  if (!alert?.jid) return;
  jumpToJid(alert.jid);
}
function jumpToJid(jid) {
  activePlatform.value = 'communication';
  if (route.path !== '/chat') router.push('/chat');
  // 确保会话已在列表中
  let conv = chatStore.conversations.find(c => c.jid === jid);
  if (!conv) {
    // 若会话未加载，先 fetch 一次
    startTgUnreadPolling();
    chatStore.fetchConversations().then(() => {
      const found = chatStore.conversations.find(c => c.jid === jid);
      if (found) {
        activeConv.value = jid;
        chatStore.setActiveConversation(jid);
        if (isMobile.value) mobileInConv.value = true;
      } else {
        activeConv.value = jid;
        chatStore.setActiveConversation(jid);
      }
    });
    return;
  }
  activeConv.value = jid;
  chatStore.setActiveConversation(jid);
  if (isMobile.value) mobileInConv.value = true;
}

// ── 5分钟首响：浏览器标签页标题闪烁 ──
const ORIGIN_TITLE = 'CRM';
let titleFlashTimer = null;
let titleFlashOn = false;

function updateTitleBadge() {
  // 首响优先级最高，其次显示普通未读
  const firstResp = chatStore.followupCounts?.firstResponse || 0;
  if (firstResp > 0) return; // 由startTitleFlash接管
  const ur = unreadTotal.value || 0;
  document.title = ur > 0 ? `(${ur}) ${ORIGIN_TITLE}` : ORIGIN_TITLE;
}
function stopTitleFlash() {
  if (titleFlashTimer) {
    clearInterval(titleFlashTimer);
    titleFlashTimer = null;
  }
  titleFlashOn = false;
  updateTitleBadge();
}
function startTitleFlash(count) {
  stopTitleFlash();
  titleFlashTimer = setInterval(() => {
    titleFlashOn = !titleFlashOn;
    document.title = titleFlashOn ? `🔴 ${count}位客户待首响！` : ORIGIN_TITLE;
  }, 1000);
}
// 页面可见性变化：回到页面时停止闪烁
function handleVisibilityChange() {
  if (!document.hidden) {
    stopTitleFlash();
    updateTitleBadge();
    // 回到页面刷新一次
    if (chatStore.isConnected) chatStore.fetchPendingFollowups().catch(() => {});
  }
}
document.addEventListener('visibilitychange', handleVisibilityChange);

// 监听首响列表变化，控制标题闪烁
watch(() => chatStore.followupCounts.firstResponse, (count) => {
  if (count > 0 && document.hidden) {
    startTitleFlash(count);
  } else {
    stopTitleFlash();
  }
});
// 监听普通未读总数，更新标题徽章（无首响时生效）
watch(unreadTotal, () => { updateTitleBadge(); });
// 页面内也在首响数 > 0 时闪烁（不强闪，但标题切换提醒）
let inPageFlashTimer = null;
watch(() => chatStore.followupCounts.firstResponse, (count) => {
  if (count > 0 && !document.hidden) {
    // 短闪烁 3 次提示，后停在 CRM
    if (inPageFlashTimer) clearInterval(inPageFlashTimer);
    let flashes = 0;
    inPageFlashTimer = setInterval(() => {
      flashes++;
      titleFlashOn = !titleFlashOn;
      document.title = titleFlashOn ? `🔴 ${count}位客户待首响！` : ORIGIN_TITLE;
      if (flashes >= 6) {
        clearInterval(inPageFlashTimer);
        inPageFlashTimer = null;
        updateTitleBadge();
      }
    }, 700);
  }
});

// ── 首响轮询：有首响时 15 秒刷新一次，无首响时 60 秒一次 ──
let followupPollTimer = null;
function scheduleFollowupPoll() {
  if (followupPollTimer) clearInterval(followupPollTimer);
  const interval = (chatStore.followupCounts.firstResponse > 0 || chatStore.pendingFollowups?.total > 0) ? 15000 : 60000;
  followupPollTimer = setInterval(() => {
    if (chatStore.isConnected) chatStore.fetchPendingFollowups().catch(() => {});
  }, interval);
}
watch(() => chatStore.followupCounts.firstResponse + chatStore.pendingFollowups?.total, () => {
  scheduleFollowupPoll();
});




// ========== AI 面板（窄版豆包聊天框） ==========
const aiResultRef = ref(null);
const aiInputEl = ref(null);
const aiInputText = ref('');

const aiActions = [
  { key: 'reply',     label: 'AI话术',   miniLabel: '💬 话术', desc: '生成可直接发送的回复',  icon: '💬', hot: true },
  { key: 'summary',   label: '需求总结', miniLabel: '📋 总结', desc: '提取客户需求要点',      icon: '📋' },
  { key: 'profile',   label: '客户背调', miniLabel: '👤 背调', desc: '分析客户类型/风格/意向度', icon: '👤' },
  { key: 'translate', label: '翻译消息', miniLabel: '🌐 翻译', desc: '翻译客户最近一条消息',  icon: '🌐' },
];

const AI_META = {
  reply:     { title: '💬 AI 话术',   placeholder: '对回复有补充要求？如「更简短一些」…' },
  summary:   { title: '📋 需求总结', placeholder: '追问某个要点，如「价格需求是什么？」' },
  profile:   { title: '👤 客户背调', placeholder: '追问客户特征，如「他的意向度？」' },
  translate: { title: '🌐 翻译消息', placeholder: '输入要翻译的文字…' },
};
const aiModeTitle = computed(() => (AI_META[chatStore.aiMode] && AI_META[chatStore.aiMode].title) || 'AI 助手');
const aiModePlaceholder = computed(() => (AI_META[chatStore.aiMode] && AI_META[chatStore.aiMode].placeholder) || '继续和 AI 对话...');

// ── AI 话术风格 ──
const replyStyles = [
  { key: 'formal',   label: '正式商务', icon: '🤵' },
  { key: 'friendly', label: '友好亲切', icon: '😊' },
  { key: 'concise',  label: '简洁高效', icon: '⚡' },
];

const summaryFieldLabels = {
  productNeed: '产品需求',
  quantity: '数量/规格',
  budget: '预算/价格',
  delivery: '交付时间',
  scenario: '应用场景/客户风格',
  concerns: '关注点/顾虑',
};

// Phase 5: reply length + context state
const replyLength = ref('medium');
const replyIncludeContext = ref(true);
const replyLengths = [
  { key: 'short', label: '短', icon: '⚡' },
  { key: 'medium', label: '中', icon: '📝' },
  { key: 'long', label: '长', icon: '📧' },
];
const lengthLabels = { short: '短', medium: '中', long: '长' };

async function handleGenerateReplies() {
  if (!chatStore.activeJid) return;
  await chatStore.generateAiReplies(null, { length: replyLength.value, includeContext: replyIncludeContext.value });
  scrollAiChatBottom();
}
async function handleGenerateSummary() {
  if (!chatStore.activeJid) return;
  await chatStore.generateAiSummary();
  scrollAiChatBottom();
}
async function handleGenerateProfile() {
  if (!chatStore.activeJid) return;
  await chatStore.generateAiProfile();
  scrollAiChatBottom();
}

async function generateReplies() {
  const extra = (aiInputText.value || '').trim();
  if (extra) aiInputText.value = '';
  await chatStore.generateAiReplies(extra || null, { length: replyLength.value, includeContext: replyIncludeContext.value });
  scrollAiChatBottom();
  nextTick(() => { aiInputEl.value && aiInputEl.value.focus(); });
}

function scrollAiChatBottom() {
  nextTick(() => {
    const el = aiResultRef.value;
    if (el) el.scrollTop = el.scrollHeight;
  });
}

function handleAiActionClick(key) {
  if (!chatStore.activeJid || chatStore.aiLoading || chatStore.aiGenerating) return;
  aiInputText.value = '';
  chatStore.startAIMode(key);
  activePanel.value = 'ai';
  aiMiniMode.value = false;
  scrollAiChatBottom();
  nextTick(() => { aiInputEl.value && aiInputEl.value.focus(); });
}

async function sendAiChat() {
  const text = aiInputText.value.trim();
  if (!text || chatStore.aiLoading || chatStore.aiGenerating) return;
  aiInputText.value = '';
  await chatStore.sendAiChat(text);
  scrollAiChatBottom();
  nextTick(() => { aiInputEl.value && aiInputEl.value.focus(); });
}

function fillAiInput(text) {
  if (!text) return;
  chatStore.insertToInput(text);
}

// Phase 5: Copy to clipboard helper
function copyToClipboard(text) {
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => {
    // Use a simple toast if available
    if (typeof ElMessage !== 'undefined') {
      ElMessage.success('已复制到剪贴板');
    }
  }).catch(() => {});
}

function onOpenAIPanel() { if (isMobile.value) { openMobilePanel('aitalk'); return; } switchPanel('aitalk'); }

watch(() => chatStore.aiChat.length, () => scrollAiChatBottom());
watch(() => chatStore.aiReplyResults.length, () => scrollAiChatBottom());
watch(() => chatStore.aiSummaryResult, () => scrollAiChatBottom());
watch(() => chatStore.aiMode, (m) => {
  if (m) {
    if (!isMobile.value) activePanel.value = 'ai';
    aiMiniMode.value = false;
    scrollAiChatBottom();
  }
});
watch(() => chatStore.activeJid, () => {
  aiInputText.value = '';
});

function starText(n) {
  const v = parseInt(n) || 0;
  if (v <= 0) return '—';
  return '⭐'.repeat(Math.min(v, 10)) + ' ' + v + '/10';
}

// When connected, hide inline QR
watch(() => chatStore.connectionStatus, (s) => {
  if (s === 'connected') showQrInline.value = false;
});

function handleLogout() {
  authStore.logout();
  router.push('/login');
}

const currentSettingsName = computed(() => {
  const m = { account:'账号设置', channels:'渠道管理', ai:'AI设置', automation:'自动化规则', team:'团队成员', system:'系统设置' };
  return m[activeSettingsTab.value] || '设置';
});

// ── 🏢 公司资料面板状态 ──
// 公司资料分类（动态加载，租户可增删改；默认含3个通用样本）
const companyCategories = ref([]); // [{id,name,icon,refValue,isDefault}]
const showCategoryManager = ref(false);
const categoryManagerList = ref([]);
const newCategoryName = ref('');
const categorySaving = ref(false);
async function fetchCompanyCategories() {
  try {
    const resp = await api.get('/company-categories');
    const d = resp.data || {};
    companyCategories.value = Array.isArray(d.data) ? d.data : [];
  } catch (e) {
    console.error('[company] fetch categories error', e);
    companyCategories.value = [];
  }
}
function refreshCategoryManager() {
  categoryManagerList.value = companyCategories.value.map(c => ({ ...c, _origName: c.name, saving: false }));
}
async function addCategory() {
  const name = newCategoryName.value.trim();
  if (!name) { ElMessage.warning('请输入分类名称'); return; }
  categorySaving.value = true;
  try {
    await api.post('/company-categories', { name });
    ElMessage.success('分类已添加');
    newCategoryName.value = '';
    await fetchCompanyCategories();
    refreshCategoryManager();
  } catch (e) { ElMessage.error(e.response?.data?.error || '添加失败'); }
  finally { categorySaving.value = false; }
}
async function saveCategoryName(c) {
  const nm = String(c.name || '').trim();
  if (!nm) { ElMessage.warning('分类名称不能为空'); return; }
  if (nm === c._origName) return;
  c.saving = true;
  try {
    await api.put('/company-categories/' + c.id, { name: nm });
    ElMessage.success('已重命名');
    await fetchCompanyCategories();
    refreshCategoryManager();
  } catch (e) { ElMessage.error(e.response?.data?.error || '保存失败'); }
  finally { c.saving = false; }
}
async function deleteCategory(c) {
  try {
    await ElMessageBox.confirm('确定删除分类「' + c.name + '」？\n该分类下的资料将一并删除（如需保留请先删除或移走资料）。', '删除分类', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' });
  } catch { return; }
  try {
    await api.delete('/company-categories/' + c.id + '?force=1');
    ElMessage.success('已删除');
    await fetchCompanyCategories();
    refreshCategoryManager();
    if (companyCategory.value === c.refValue) { companyCategory.value = 'all'; }
    await fetchCompanyMaterials();
  } catch (e) { ElMessage.error(e.response?.data?.error || '删除失败'); }
}
const CM_LANGS = [
  { value: 'en', label: 'English (EN)' },
  { value: 'zh', label: '中文 (ZH)' },
  { value: 'es', label: 'Español (ES)' },
];
const companyMaterials = ref([]);
const companyCategory = ref('all');
const companyLoading = ref(false);
const cmExpanded = reactive({});
const cmAddMenuOpen = ref(false);
const showCompanyDialog = ref(false);
const editingFileInfo = ref(''); // 编辑时当前附件名
const editingCompanyId = ref(null);
const cmSaving = ref(false);
const cmUploading = ref(false);
const cmUploadProgress = ref(0);
const cmFileInput = ref(null);
const companyForm = reactive({ category: 'company', title: '', content: '', lang: 'en', sortOrder: 0, file: null });
const filteredCompanyMaterials = computed(() => {
  if (companyCategory.value === 'all') return companyMaterials.value;
  return companyMaterials.value.filter(m => m.category === companyCategory.value);
});

function cmTypeIcon(t) {
  return { text: '📝', image: '🖼', video: '🎬', pdf: '📄' }[t] || '📁';
}
function cmTypeLabel(t) {
  return { text: '文本', image: '图片', video: '视频', pdf: 'PDF' }[t] || '文件';
}
function cmLangLabel(l) {
  return ({ en: 'EN', zh: '中文', es: 'ES', fr: 'FR', de: 'DE', ar: 'AR', pt: 'PT', ru: 'RU', ja: 'JA', ko: 'KO' })[l] || (l || '').toUpperCase();
}
function formatFileSize(n) {
  if (!n) return '';
  if (n < 1024) return n + ' B';
  if (n < 1024*1024) return (n/1024).toFixed(1) + ' KB';
  return (n/1024/1024).toFixed(2) + ' MB';
}

async function fetchCompanyMaterials() {
  companyLoading.value = true;
  try {
    const cat = companyCategory.value === 'all' ? '' : '?category=' + encodeURIComponent(companyCategory.value);
    const resp = await api.get('/company-materials' + cat);
    const d = resp.data || {};
    companyMaterials.value = Array.isArray(d.data) ? d.data : (Array.isArray(d) ? d : []);
  } catch (e) {
    console.error('[company] fetch error', e);
    ElMessage.error('加载公司资料失败');
    companyMaterials.value = [];
  } finally {
    companyLoading.value = false;
  }
}

function resetCompanyForm() {
  companyForm.category = 'company';
  companyForm.title = '';
  companyForm.content = '';
  companyForm.lang = 'en';
  companyForm.sortOrder = 0;
  companyForm.file = null;
  editingCompanyId.value = null;
  editingFileInfo.value = '';
}
function openCompanyDialog(material) {
  resetCompanyForm();
  if (material) {
    editingCompanyId.value = material.id;
    companyForm.category = material.category || (companyCategories.value[0]?.refValue || 'company');
    companyForm.title = material.title || '';
    companyForm.content = material.content || '';
    companyForm.lang = material.lang || 'en';
    companyForm.sortOrder = material.sortOrder || 0;
    editingFileInfo.value = material.type !== 'text' ? (material.fileName || material.title || '') : '';
  }
  showCompanyDialog.value = true;
  cmAddMenuOpen.value = false;
}
function closeCompanyDialog() {
  showCompanyDialog.value = false;
  resetCompanyForm();
}

async function saveCompanyMaterial() {
  if (!companyForm.title.trim()) { ElMessage.warning('请输入标题'); return; }
  if (!companyForm.category) { ElMessage.warning('请选择分类'); return; }
  if (!companyForm.content.trim() && !companyForm.file) { ElMessage.warning('请填写内容或上传附件（至少一项）'); return; }
  cmSaving.value = true;
  cmUploading.value = !!companyForm.file;
  cmUploadProgress.value = 0;
  try {
    if (companyForm.file) {
      // 上传模式：文件 + 文字描述可同时提交
      const fd = new FormData();
      fd.append('file', companyForm.file);
      fd.append('category', companyForm.category);
      fd.append('title', companyForm.title.trim());
      fd.append('lang', companyForm.lang);
      fd.append('content', companyForm.content || '');
      fd.append('sortOrder', String(companyForm.sortOrder || 0));
      await api.post('/company-materials/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (evt) => {
          if (evt.total) cmUploadProgress.value = Math.round((evt.loaded/evt.total)*100);
        }
      });
      ElMessage.success('已保存');
    } else {
      if (editingCompanyId.value) {
        await api.put('/company-materials/' + editingCompanyId.value, {
          category: companyForm.category, title: companyForm.title.trim(), content: companyForm.content,
          lang: companyForm.lang, sortOrder: companyForm.sortOrder
        });
        ElMessage.success('已更新');
      } else {
        await api.post('/company-materials', {
          category: companyForm.category, title: companyForm.title.trim(), content: companyForm.content,
          lang: companyForm.lang, sortOrder: companyForm.sortOrder
        });
        ElMessage.success('已添加');
      }
    }
    closeCompanyDialog();
    await fetchCompanyMaterials();
  } catch (e) {
    console.error(e);
    ElMessage.error(e.response?.data?.error || '保存失败');
  } finally {
    cmSaving.value = false;
    cmUploading.value = false;
    cmUploadProgress.value = 0;
  }
}

function onCmFileChange(e) {
  const f = e.target.files && e.target.files[0];
  if (!f) return;
  const isImage = f.type.startsWith('image/');
  const isVideo = f.type.startsWith('video/');
  const isPdf = f.type === 'application/pdf';
  if (!isImage && !isVideo && !isPdf) {
    ElMessage.error('不支持的文件类型：仅支持图片、视频、PDF');
    e.target.value = '';
    return;
  }
  const limit = isVideo ? 50 * 1024 * 1024 : 20 * 1024 * 1024;
  const mb = isVideo ? 50 : 20;
  if (f.size > limit) {
    ElMessage.error('文件超过 ' + mb + 'MB 上限（PDF/图片 20MB、视频 50MB），无法上传');
    e.target.value = '';
    companyForm.file = null;
    return;
  }
  companyForm.file = f;
  if (!companyForm.title.trim()) companyForm.title = f.name;
}

async function deleteCompanyMaterial(m) {
  try {
    await ElMessageBox.confirm('确定删除「' + m.title + '」？', '删除确认', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' });
  } catch { return; }
  try {
    await api.delete('/company-materials/' + m.id);
    ElMessage.success('已删除');
    await fetchCompanyMaterials();
  } catch (e) {
    ElMessage.error(e.response?.data?.error || '删除失败');
  }
}

async function copyMaterial(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
    }
    ElMessage.success('已复制到剪贴板');
  } catch (e) {
    ElMessage.error('复制失败');
  }
}

function cooldownConfirm(msg) {
  // ⚠️ 降频期至 2026-07-16 21:00: 所有"发送"按钮二次确认
  const now = new Date();
  const until = new Date('2026-07-16T21:00:00+08:00');
  if (now < until) {
    return ElMessageBox.confirm('⚠️ 降频期（至21:00），确认发送？\n\n' + msg, '降频期提醒', { type: 'warning', confirmButtonText: '确认发送', cancelButtonText: '取消' });
  }
  return Promise.resolve();
}

async function sendMaterialText(m) {
  if (!chatStore.activeJid) { ElMessage.warning('请先选择客户会话'); return; }
  try {
    await cooldownConfirm('即将发送文本：' + (m.title || ''));
  } catch { return; }
  try {
    await chatStore.sendMessage(chatStore.activeJid, m.content);
    ElMessage.success('已发送');
  } catch (e) {
    ElMessage.error('发送失败');
  }
}

async function sendMaterialFile(m) {
  if (!chatStore.activeJid) { ElMessage.warning('请先选择客户会话'); return; }
  try {
    await cooldownConfirm('即将发送附件：' + (m.fileName || m.title));
  } catch { return; }
  try {
    const resp = await fetch(m.fileUrl, { credentials: 'include' });
    if (!resp.ok) throw new Error('下载失败: ' + resp.status);
    const blob = await resp.blob();
    const fname = m.fileName || m.title || 'file';
    const file = new File([blob], fname, { type: m.mimeType || blob.type || 'application/octet-stream' });
    const mediatype = m.type === 'image' ? 'image' : m.type === 'video' ? 'video' : 'document';
    await chatStore.sendMedia(chatStore.activeJid, file, mediatype, m.content || '');
    ElMessage.success('已发送');
  } catch (e) {
    console.error(e);
    ElMessage.error('发送附件失败: ' + (e.message || ''));
  }
}

// Watch: 切到company时拉取数据（PC端activePanel，移动端mobilePanel都覆盖）
watch(activePanel, (v) => {
  if (v === 'company') fetchCompanyMaterials();
  if (v !== 'company') cmAddMenuOpen.value = false;
});
watch(mobilePanel, (v) => {
  if (v === 'company') fetchCompanyMaterials();
  if (v !== 'company') cmAddMenuOpen.value = false;
});


const dialogTitle = computed(() => {
  return editingCompanyId.value ? '编辑资料' : '新增资料';
});

// ========== 🕰️ 客户时间与文化系统 ==========
// ========== 🕐 国家文化数据（时间+商务礼仪+谈单注意）==========
// 字段说明：
// flag/name: 显示名；tz: 时区IANA；weekend: 周末；workHours: 当地工作时段(24h)
// etiquette: 商务礼仪要点；negotiationTips: 谈单注意；taboos: 禁忌
// timePerception: 时间观；greeting: 问候方式
// 国家键为ISO 3166-1 alpha-2大写


// ── 城市→时区映射（多时区国家细分） ──
const CITY_TIMEZONES = {
  US: {
    'New York': 'America/New_York',
    'Los Angeles': 'America/Los_Angeles',
    'Chicago': 'America/Chicago',
    'Houston': 'America/Chicago',
    'Dallas': 'America/Chicago',
    'Austin': 'America/Chicago',
    'San Antonio': 'America/Chicago',
    'Denver': 'America/Denver',
    'Phoenix': 'America/Phoenix',
    'Seattle': 'America/Los_Angeles',
    'Portland': 'America/Los_Angeles',
    'San Francisco': 'America/Los_Angeles',
    'Boston': 'America/New_York',
    'Miami': 'America/New_York',
    'Atlanta': 'America/New_York',
    'Detroit': 'America/Detroit',
    'Philadelphia': 'America/New_York',
    'Washington DC': 'America/New_York',
    'Las Vegas': 'America/Los_Angeles',
    'Salt Lake City': 'America/Denver',
    'Minneapolis': 'America/Chicago',
    'St. Louis': 'America/Chicago',
    'New Orleans': 'America/Chicago',
    'Nashville': 'America/Chicago',
    'Charlotte': 'America/New_York',
    'Tampa': 'America/New_York',
    'Orlando': 'America/New_York',
    'Anchorage': 'America/Anchorage',
    'Honolulu': 'Pacific/Honolulu',
  },
  CA: {
    'Toronto': 'America/Toronto',
    'Montreal': 'America/Toronto',
    'Vancouver': 'America/Vancouver',
    'Calgary': 'America/Edmonton',
    'Edmonton': 'America/Edmonton',
    'Winnipeg': 'America/Winnipeg',
    'Ottawa': 'America/Toronto',
    'Halifax': 'America/Halifax',
  },
  AU: {
    'Sydney': 'Australia/Sydney',
    'Melbourne': 'Australia/Melbourne',
    'Brisbane': 'Australia/Brisbane',
    'Perth': 'Australia/Perth',
    'Adelaide': 'Australia/Adelaide',
    'Darwin': 'Australia/Darwin',
    'Hobart': 'Australia/Hobart',
  },
  RU: {
    'Moscow': 'Europe/Moscow',
    'St. Petersburg': 'Europe/Moscow',
    'Novosibirsk': 'Asia/Novosibirsk',
    'Yekaterinburg': 'Asia/Yekaterinburg',
    'Vladivostok': 'Asia/Vladivostok',
    'Krasnoyarsk': 'Asia/Krasnoyarsk',
    'Irkutsk': 'Asia/Irkutsk',
  },
  BR: {
    'Sao Paulo': 'America/Sao_Paulo',
    'Rio de Janeiro': 'America/Sao_Paulo',
    'Brasilia': 'America/Sao_Paulo',
    'Manaus': 'America/Manaus',
    'Salvador': 'America/Bahia',
  },
  MX: {
    'Mexico City': 'America/Mexico_City',
    'Guadalajara': 'America/Mexico_City',
    'Monterrey': 'America/Monterrey',
    'Cancun': 'America/Cancun',
    'Tijuana': 'America/Tijuana',
  },
  ID: {
    'Jakarta': 'Asia/Jakarta',
    'Bali': 'Asia/Makassar',
    'Surabaya': 'Asia/Jakarta',
    'Medan': 'Asia/Jakarta',
  },
  CN: {
    'Beijing': 'Asia/Shanghai',
    'Shanghai': 'Asia/Shanghai',
    'Guangzhou': 'Asia/Shanghai',
    'Shenzhen': 'Asia/Shanghai',
    'Chengdu': 'Asia/Shanghai',
    'Urumqi': 'Asia/Urumqi',
  },
};


// 根据客户城市+国家解析时区
function resolveCustomerTz(city, countryIso) {
  if (!city || !countryIso) return null;
  const countryMap = CITY_TIMEZONES[countryIso.toUpperCase()];
  if (!countryMap) return null;
  // 精确匹配
  if (countryMap[city]) return countryMap[city];
  // 忽略大小写匹配
  const cityLower = city.toLowerCase();
  for (const [c, tz] of Object.entries(countryMap)) {
    if (c.toLowerCase() === cityLower) return tz;
  }
  // 部分匹配（如输入 Austin 匹配 Austin）
  for (const [c, tz] of Object.entries(countryMap)) {
    if (c.toLowerCase().includes(cityLower) || cityLower.includes(c.toLowerCase())) return tz;
  }
  return null;
}

const CULTURE_DATA = {
  // ── 中东 ──
  SY: {
    flag:'🇸🇾', name:'叙利亚', nameEn:'Syria', tz:'Asia/Damascus',
    weekend:['Friday','Saturday'], workHours:{start:9,end:17},
    currency:'SYP（叙利亚镑）', language:'阿拉伯语', englishLevel:'法语较普及，英语一般',
    timePerception:'弹性时间观，约定时间迟到15-30分钟较常见，不要因此不悦',
    greeting:'先说"As-salamu alaykum"（愿平安与你同在），握手为主；异性之间等对方主动伸手',
    etiquette:[
      '初次见面先寒暄家常（家庭、健康、天气），不要一上来谈业务',
      '商务名片用右手递接，最好有阿拉伯文一面朝向对方',
      '称呼用"先生/女士"+姓，熟悉后可称名',
      '接受对方递的咖啡/茶是礼貌，不喝也要接过来放着',
      '斋月(Ramadan)期间白天不要在对方面前吃喝',
    ],
    negotiationTips:[
      '极度重视人际关系，先做朋友再谈生意，需要多次沟通建立信任',
      '决策节奏慢，不要催单；催促会被视为不尊重',
      '讨价还价是文化一部分，首轮报价留出空间但不要虚高太多',
      '对方说"Insha\'Allah"（如真主意欲）不代表承诺，是礼貌性拖延',
      '产品样本、认证、案例图片很有说服力',
      '不要在第一次见面就逼单，留后续跟进空间',
    ],
    taboos:[
      '绝对避免讨论政治（内战、政府、阿萨德）和宗教教派话题',
      '不要用左手递物、握手或吃饭',
      '不要用食指指向人，不要脚底对着人',
      '不要给穆斯林送酒、猪肉制品、带狗或裸露人像的礼品',
      '不要过度赞美对方的物品（阿拉伯人有"赠送被赞美物品"的传统，会让对方为难）',
    ],
    holidays:'开斋节、宰牲节（ Eid ），放假3-7天；伊斯兰新年、圣纪',
    dress:'商务正装保守得体，男士西装领带，女士套装/长裙遮肩',
    gifts:'巧克力、高档笔、公司纪念礼品可接受，避免酒/猪肉/狗形象物品',
  },
  LB: {
    flag:'🇱🇧', name:'黎巴嫩', nameEn:'Lebanon', tz:'Asia/Beirut',
    weekend:['Saturday','Sunday'], workHours:{start:9,end:18},
    currency:'LBP（黎巴嫩镑）', language:'阿拉伯语/法语/英语', englishLevel:'商业圈英语普及，法语亦常用',
    timePerception:'相对守时，但迟到10-15分钟可接受；商务会议较准时',
    greeting:'握手问候为主，法语"Bonjour"也常用；熟人行贴面礼（左右各一次）',
    etiquette:[
      '黎巴嫩商业文化中东最西化，但关系导向依然重要',
      '寒暄是必须环节：问家庭、健康，但不要细问女眷',
      '商务名片法英双语为佳，右手递接',
      '待客以咖啡/茶/Arak酒，接受是礼貌',
      '贝鲁特商人国际化程度高，商务午餐常见',
    ],
    negotiationTips:[
      '黎巴嫩商人以精明善谈著称，准备好充足的价格空间和谈判策略',
      '多次会面后才进入实质谈判，前1-2次主要是建立关系',
      '法语和英语在商业场合均可用，法语加分',
      '口头承诺约束力弱，所有条款落到书面合同',
      '展示公司实力、认证、欧美客户案例非常有说服力',
      '合同细节要抠细，黎商合同意识较强',
      '价格谈判激烈，做好多轮拉锯准备',
    ],
    taboos:[
      '避免政治话题：内战、叙利亚问题、真主党、以色列',
      '宗教敏感：基督徒和穆斯林约各半，不要偏袒或议论教派',
      '不要用左手递物',
      '避免评论黎巴嫩当前经济危机，客户提起时表示理解即可',
    ],
    holidays:'开斋节、宰牲节、圣诞节（基督徒占比高）、新年、独立日',
    dress:'商务正装，贝鲁特较时尚国际化，男士西装，女士可时尚但不暴露',
    gifts:'高质量巧克力、品牌小礼品、公司纪念品均可',
  },
  AE: {
    flag:'🇦🇪', name:'阿联酋（迪拜/阿布扎比）', nameEn:'UAE', tz:'Asia/Dubai',
    weekend:['Saturday','Sunday'], workHours:{start:9,end:18},
    currency:'AED（迪拉姆）', language:'阿拉伯语，英语通用', englishLevel:'极高，商务通用英语',
    timePerception:'商务场合较守时；政府部门办事弹性较大',
    greeting:'"As-salamu alaykum"，握手时对方先伸手；异性间男士等女士伸手',
    etiquette:[
      '迪拜国际化程度高，但仍要尊重伊斯兰文化',
      '称呼最高头衔"Sheikh/Sheikha"或"Mr./Mrs."+姓',
      '商务交换名片用右手，有阿文一面更好',
      '会议开始先寒暄（旅途、天气、健康），然后进入正题',
      '斋月期间白天公共场合不进食饮水',
    ],
    negotiationTips:[
      '重视长期关系和信任，不要急于成交',
      '决策者通常是高层，争取直接对接老板',
      '报价要有竞争力但不廉价，阿联酋客户重品质也重性价比',
      '价格谈判常见，留好空间；不要先亮底价',
      '展示品牌实力、认证、中东其他客户案例很加分',
      '合同正式，走流程较慢但履约较规范',
      '周五周六是周末，周日开始工作周（2022年起改为周六日休）',
    ],
    taboos:[
      '不要用左手递物握手',
      '不要在公共场合饮酒醉酒',
      '宗教/政治敏感话题少谈',
      '不要给当地女性拍照',
      '穿着保守，尤其是清真寺等场所',
    ],
    holidays:'开斋节（3-5天）、宰牲节（3-5天）、伊斯兰新年、国庆日12/2',
    dress:'商务正装，男士西装领带；女士套装保守得体',
    gifts:'高档笔、香水（非酒精）、巧克力；不要送酒/猪肉',
  },
  SA: {
    flag:'🇸🇦', name:'沙特阿拉伯', nameEn:'Saudi Arabia', tz:'Asia/Riyadh',
    weekend:['Friday','Saturday'], workHours:{start:9,end:17},
    currency:'SAR（里亚尔）', language:'阿拉伯语', englishLevel:'商务圈英语可沟通',
    timePerception:'弹性大，会议常晚开始；不催促',
    greeting:'"As-salamu alaykum"，男士之间握手+可能拍肩；异性不要主动伸手',
    etiquette:[
      '极度保守伊斯兰文化，着装必须保守',
      '祷告时间一天5次，会议中对方去祈祷要耐心等待',
      '寒暄时间很长（家庭、健康、骆驼、体育），不要急着转业务',
      '商务场合几乎全是男性，女性销售需注意',
      '名片右手递接，阿文一面朝上',
    ],
    negotiationTips:[
      '关系第一，没建立信任前基本谈不成生意',
      '决策极慢，需要高层签字，做好长期跟进准备',
      '价格敏感但也重品质，有Vision 2030转型需求',
      '首次见面可能完全不谈业务，纯社交',
      '谈判中可能有沉默，不要急着填补',
      '"Yes"不一定是承诺，"Insha\'Allah"最保险',
      '合同和协议需要正式签署',
    ],
    taboos:[
      '绝对不饮酒、不送酒、不在公共场合饮酒',
      '不讨论宗教（尤其是批评）、王室、政治',
      '不用左手、不脚底对人、不竖大拇指（粗鲁）',
      '女性着装必须Abaya黑袍，男士不穿短裤',
      '不主动与沙特女性握手/交谈',
    ],
    holidays:'开斋节（约10天）、宰牲节（约10天）、国庆日9/23、伊斯兰新年',
    dress:'男士必须西装领带；女士必须保守着装（Abaya在公共场合）',
    gifts:'贵重但不奢侈的笔、指南针（指向麦加）、高级香水（非酒精）',
  },
  QA: {
    flag:'🇶🇦', name:'卡塔尔', nameEn:'Qatar', tz:'Asia/Qatar',
    weekend:['Friday','Saturday'], workHours:{start:8,end:15},
    currency:'QAR（里亚尔）', language:'阿拉伯语', englishLevel:'商务英语可用，多哈国际化',
    timePerception:'商务较守时，政府部门弹性',
    greeting:'同沙特/阿联酋规范，保守伊斯兰',
    etiquette:[
      '类似沙特但稍开放，多哈因世界杯后更国际化',
      '祷告时间必须尊重',
      '关系建立比业务本身重要',
      '名片右手递接',
    ],
    negotiationTips:[
      '决策慢，王室/高层最终拍板',
      '重视品质、品牌、认证，价格不是唯一因素',
      '2030国家愿景带动大量建设需求',
      '合同正式，法律体系较完善',
    ],
    taboos:['同海湾国家禁忌','避免政治/宗教讨论','斋月期间尊重'],
    holidays:'开斋节、宰牲节、国庆日12/18',
    dress:'商务正装保守',
    gifts:'高质量商务礼品，避免酒/猪肉',
  },
  KW: {
    flag:'🇰🇼', name:'科威特', nameEn:'Kuwait', tz:'Asia/Kuwait',
    weekend:['Friday','Saturday'], workHours:{start:8,end:14},
    currency:'KWD（第纳尔）', language:'阿拉伯语', englishLevel:'商务英语可沟通',
    timePerception:'弹性大，会议迟到常见',
    greeting:'"Salamu alaykum"，右手握手',
    etiquette:['类似沙特但稍宽松','名片右手递接','寒暄重要'],
    negotiationTips:[
      '科威特商人直接但重关系',
      '石油经济富裕，购买力强',
      '决策链较长，家族企业多',
    ],
    taboos:['伊斯兰禁忌同沙特','避免政治/宗教话题'],
    holidays:'开斋节、宰牲节、国庆日2/25',
    dress:'商务正装',
    gifts:'高质量笔、香水（无酒精）',
  },
  EG: {
    flag:'🇪🇬', name:'埃及', nameEn:'Egypt', tz:'Africa/Cairo',
    weekend:['Friday','Saturday'], workHours:{start:9,end:17},
    currency:'EGP（埃镑）', language:'阿拉伯语', englishLevel:'商务圈英语可用',
    timePerception:'弹性很大，"Egyptian time"迟到30分钟+常见',
    greeting:'"Salamu alaykum"，握手热情，可能拍肩；异性谨慎',
    etiquette:[
      '埃及人热情好客，寒暄时间很长（家庭、健康、天气）',
      '商务着装正式，开罗夏天炎热但室内有空调',
      '名片右手递接',
      '茶/咖啡是待客必备，接受并小口品尝是礼貌',
    ],
    negotiationTips:[
      '价格极度敏感，讨价还价是国民运动',
      '关系导向，信任需要时间建立',
      '决策慢，政府/军方项目流程更长',
      '埃及人喜欢聊天和辩论，谈判中保持幽默但不失尊重',
      '预付款/信用证要慎重，信用风险较高',
      '展示性价比而非高端品牌',
    ],
    taboos:[
      '不要讨论政治（塞西政府、穆兄会）、宗教敏感话题',
      '不要用左手',
      '不要拍当地人尤其是女性',
      '穿着保守，女性游客避免暴露',
    ],
    holidays:'开斋节、宰牲节、西奈解放日4/25、国庆日7/23',
    dress:'商务正装，夏天可稍轻便但不可短袖短裤（正式场合）',
    gifts:'小礼品、笔、中国特色纪念品',
  },
  TR: {
    flag:'🇹🇷', name:'土耳其', nameEn:'Turkey', tz:'Europe/Istanbul',
    weekend:['Saturday','Sunday'], workHours:{start:9,end:18},
    currency:'TRY（里拉）', language:'土耳其语', englishLevel:'商务圈英语可用，旅游区普及',
    timePerception:'商务较守时，社交弹性',
    greeting:'握手+眼神接触+"Merhaba"；熟人贴面礼',
    etiquette:[
      '土耳其人热情好客，商务关系基于信任',
      '初次见面握手+交换名片',
      '茶(Cay)是土耳其社交核心，一定会被招待，接受是礼貌',
      '称呼用"Mr./Mrs."+名，土耳其人有名+姓，正式场合用姓',
      '不要急于谈生意，先寒暄喝茶',
    ],
    negotiationTips:[
      '土耳其人善谈判，风格热情直接但不鲁莽',
      '关系重要但决策较快（相对于阿拉伯国家）',
      '讨价还价正常，首报留空间',
      '经济波动大，注意汇率风险和付款条件',
      '欧洲和中东之间的桥梁，对品质和价格都敏感',
      '伊斯坦布尔是商业中心',
    ],
    taboos:[
      '避免政治敏感（库尔德问题、亚美尼亚争议、塞浦路斯）',
      '不要用手指指人',
      '进清真寺要脱鞋，女士包头巾',
      '对土耳其国父凯末尔(Atatürk)表示尊重，不要批评',
    ],
    holidays:'开斋节(Ramadan Bayram)、宰牲节(Kurban Bayrami)、共和国日10/29、新年',
    dress:'商务正装，伊斯坦布尔较时尚；小城市保守',
    gifts:'中国茶、丝绸小礼品、纪念品',
  },
  IL: {
    flag:'🇮🇱', name:'以色列', nameEn:'Israel', tz:'Asia/Jerusalem',
    weekend:['Friday','Saturday'], workHours:{start:8,end:17},
    currency:'ILS（新谢克尔）', language:'希伯来语/阿拉伯语', englishLevel:'高，商务通用英语',
    timePerception:'直接高效文化，守时，不要浪费时间',
    greeting:'握手+"Shalom"，商务直接进入主题',
    etiquette:[
      '以色列人非常直接，"chutzpah"（直率）文化，不绕弯子',
      '不要期待太多寒暄，快速进入实质讨论',
      '商务着装相对随意（高科技氛围），但正式会议还是西装',
      '周五下午到周六日落是Shabbat（安息日），不安排业务',
    ],
    negotiationTips:[
      '谈判风格直接、有话直说，甚至会当面质疑你',
      '不喜欢客套，准备好被挑战和辩论',
      '决策快，注重数据和事实',
      '高科技氛围，创新和技术细节很重要',
      '犹太人节日(Rosh Hashanah, Yom Kippur, Passover)放假',
    ],
    taboos:[
      '避免政治话题（巴以冲突）除非对方主动提起',
      '安息日(周五日落至周六日落)不要打电话或谈生意',
      '宗教场所示尊重',
    ],
    holidays:'Rosh Hashanah(犹太新年)、Yom Kippur(赎罪日)、Passover(逾越节)、Hanukkah',
    dress:'商务休闲到正装均可，高科技公司较随意',
    gifts:'一般不送礼（商务文化中不常见）',
  },
  JO: {
    flag:'🇯🇴', name:'约旦', nameEn:'Jordan', tz:'Asia/Amman',
    weekend:['Friday','Saturday'], workHours:{start:9,end:17},
    currency:'JOD（第纳尔）', language:'阿拉伯语', englishLevel:'中上层商务英语可沟通',
    timePerception:'弹性，迟到20-30分钟常见',
    greeting:'"Salamu alaykum"，右手握手',
    etiquette:['类似其他阿拉伯国家','关系导向','名片右手递接','茶/咖啡招待必接受'],
    negotiationTips:['决策较慢','价格敏感但重品质','王室/政府项目需人脉','安曼是商业中心'],
    taboos:['伊斯兰禁忌','不讨论政治敏感（阿以关系、王室）'],
    holidays:'开斋节、宰牲节、独立日5/25',
    dress:'商务正装保守',
    gifts:'笔、巧克力、中国特色礼品',
  },
  IQ: {
    flag:'🇮🇶', name:'伊拉克', nameEn:'Iraq', tz:'Asia/Baghdad',
    weekend:['Friday','Saturday'], workHours:{start:9,end:16},
    currency:'IQD（第纳尔）', language:'阿拉伯语/库尔德语', englishLevel:'有限，翻译可能需要',
    timePerception:'弹性大，安全局势影响行程',
    greeting:'"Salamu alaykum"，保守伊斯兰',
    etiquette:['高度保守，关系极其重要','安全因素影响会面安排','茶/咖啡招待必接受'],
    negotiationTips:[
      '战后重建市场，需求大但风险高',
      '预付款和信用证极重要，信用风险高',
      '政府/油田项目有门槛，需当地代理',
      '决策慢，家族/部落关系影响商业',
    ],
    taboos:['政治敏感（萨达姆、宗派冲突、美伊关系）','伊斯兰严格禁忌','安全话题谨慎'],
    holidays:'开斋节、宰牲节、国庆日10/3',
    dress:'极度保守商务正装',
    gifts:'简单小礼品即可',
  },
  // ── 欧洲 ──
  DE: {
    flag:'🇩🇪', name:'德国', nameEn:'Germany', tz:'Europe/Berlin',
    weekend:['Saturday','Sunday'], workHours:{start:9,end:18},
    currency:'EUR（欧元）', language:'德语', englishLevel:'高，商务英语可沟通但德语加分',
    timePerception:'极度守时，迟到即不尊重，提前5分钟到',
    greeting:'坚定握手+"Guten Tag"+姓（Herr/Frau+姓），不直呼名字',
    etiquette:[
      '极其重视头衔，博士/教授头衔一定要用',
      '商务正式，称呼Herr/Frau+姓',
      '名片德文一面朝上',
      '会议准备充分，德国人提前看资料',
      '不要在工作场合闲聊过多',
    ],
    negotiationTips:[
      '严谨理性，重数据、技术细节、认证标准',
      '决策过程慢，需要多层审批',
      '不喜欢讨价还价，报价要实在',
      '质量和可靠性是核心，价格其次',
      '合同条款详细，履约严格',
      '承诺必须兑现，说到做到',
    ],
    taboos:[
      '避免纳粹/二战话题',
      '不要直呼名字除非对方邀请',
      '不要迟到',
      '避免夸张推销，德国人反感',
    ],
    holidays:'圣诞(12/25-26)、新年、复活节、国庆节10/3等各州不同',
    dress:'深色商务正装，非常正式',
    gifts:'一般不送礼；深交后可送高品质小物',
  },
  FR: {
    flag:'🇫🇷', name:'法国', nameEn:'France', tz:'Europe/Paris',
    weekend:['Saturday','Sunday'], workHours:{start:9,end:18},
    currency:'EUR（欧元）', language:'法语', englishLevel:'商务圈可用但会法语非常加分',
    timePerception:'守时，商务场合迟到不超过10分钟',
    greeting:'握手+"Bonjour"+Monsieur/Madame+姓；熟人贴面礼',
    etiquette:[
      '法国商务礼仪正式，永远用vous（您）而非tu（你）',
      '名片法文一面更好',
      '先寒暄（艺术、美食、文化）再谈业务',
      '午餐是重要商务场合，可能2小时+',
      '不要在周一上午或周五下午安排重要会议',
    ],
    negotiationTips:[
      '法国人喜欢辩论和逻辑分析，准备好论证',
      '决策较慢，层级分明',
      '会法语是极大加分项',
      '品味和风格重要，产品展示要有设计感',
      '不要过度推销，逻辑说服更有效',
      '8月是度假月，全法基本停滞',
    ],
    taboos:[
      '不要直接切入业务，先礼貌寒暄',
      '不要在餐桌上谈钱/价格细节',
      '避免评论法语/法国人的英语',
      '不要把钱/财富作为话题',
    ],
    holidays:'国庆日7/14、圣诞、新年、8月全民休假',
    dress:'时尚商务正装，巴黎品味讲究',
    gifts:'鲜花（不送菊花/康乃馨）、巧克力、高质量商务礼',
  },
  IT: {
    flag:'🇮🇹', name:'意大利', nameEn:'Italy', tz:'Europe/Rome',
    weekend:['Saturday','Sunday'], workHours:{start:9,end:18},
    currency:'EUR（欧元）', language:'意大利语', englishLevel:'北部商务圈可用，南部较弱',
    timePerception:'弹性，南方迟到30分钟常见；北方(米兰)较守时',
    greeting:'握手+"Buongiorno"+头衔+姓；熟人贴面礼',
    etiquette:[
      '重视形象和着装（"la bella figura"），第一印象极重要',
      '称呼用头衔+姓（Dottore/Dottoressa很常用）',
      '名片一面意大利文更好',
      '商务午餐/咖啡是核心社交场景',
      '8月全民休假(Ferragosto)',
    ],
    negotiationTips:[
      '关系导向，建立个人信任很重要',
      '北意(米兰/都灵)较高效，南意(那不勒斯/西西里)节奏慢',
      '讨价还价正常，风格戏剧化但不咄咄逼人',
      '设计感和美学很重要，产品外观加分',
      '决策链较长，家族企业多',
      '合同和承诺需要书面确认',
    ],
    taboos:[
      '不要批评意大利食物/文化',
      '避免政治话题（贝卢斯科尼、黑手党）',
      '不要在午餐时间（13-15点）安排紧凑会议',
      '穿着要体面",意大利人以貌取人"',
    ],
    holidays:'圣诞、新年、Ferragosto 8/15、复活节、共和国日6/2',
    dress:'时尚正装，米兰风格，品质要好',
    gifts:'红酒、巧克力、高质量工艺品',
  },
  ES: {
    flag:'🇪🇸', name:'西班牙', nameEn:'Spain', tz:'Europe/Madrid',
    weekend:['Saturday','Sunday'], workHours:{start:9,end:14,lunchBreak:'14-16',evening:'16-19'},
    currency:'EUR（欧元）', language:'西班牙语', englishLevel:'一般，会西班牙语非常加分',
    timePerception:'弹性大，"mañana"文化，不急；会议晚开始',
    greeting:'握手+"Buenos días"+姓；熟人贴面礼（女女/男女）',
    etiquette:[
      '时间观念弹性大，不要为迟到生气',
      '午餐14:00-16:00是核心商务餐，可能2小时+',
      '名片西班牙文一面好',
      '寒暄重要：足球、美食、家庭',
    ],
    negotiationTips:[
      '关系第一，个人交情决定商业',
      '谈判风格热烈、有激情，可能打断你，不代表不尊重',
      '决策慢，多层级',
      '讨价还价常见',
      '午休(Siesta)时间不安排商务',
      '8月基本全休',
    ],
    taboos:[
      '不要批评斗牛、佛朗哥历史、加泰罗尼亚独立问题',
      '不要在午休时间打电话',
      '不要穿短裤参加商务场合',
    ],
    holidays:'圣诞、新年、三王节1/6、国庆日10/12、8月休假',
    dress:'商务正装，风格较时尚',
    gifts:'红酒、火腿、橄榄油等美食礼品',
  },
  GB: {
    flag:'🇬🇧', name:'英国', nameEn:'UK', tz:'Europe/London',
    weekend:['Saturday','Sunday'], workHours:{start:9,end:17},
    currency:'GBP（英镑）', language:'英语', englishLevel:'母语',
    timePerception:'守时，商务场合不要迟到超过5分钟',
    greeting:'坚定握手+"How do you do"或"Pleased to meet you"，称呼Mr./Ms.+姓',
    etiquette:[
      '礼貌含蓄、幽默自嘲、避免情绪化',
      '称呼Mr./Mrs./Ms.+姓，受邀后才直呼名',
      '排队文化、尊重秩序',
      'Small talk很重要：天气是万能话题',
      'Pub午餐是常见商务场景',
    ],
    negotiationTips:[
      '英式谈判风格含蓄、委婉，不会直接说"不"，要听潜台词',
      '重合同、重信誉、守承诺',
      '报价合理，不喜欢夸张讨价还价',
      '决策中速，尊重层级',
      '英式幽默加分，但不懂就别硬学',
      '圣诞节前后两周效率低',
    ],
    taboos:[
      '不要过于直接/咄咄逼人',
      '避免询问隐私（收入、年龄、婚姻）',
      '不要插队',
      '避免王室争议话题',
      '不要把英国统称为"England"（苏格兰/威尔士/北爱尔兰人敏感）',
    ],
    holidays:'圣诞(12/25-26)、新年、Easter、Bank Holidays',
    dress:'深色商务正装，保守得体',
    gifts:'一般不送礼；圣诞可送小礼物、酒',
  },
  IE: {
    flag:'🇮🇪', name:'爱尔兰', nameEn:'Ireland', tz:'Europe/Dublin',
    weekend:['Saturday','Sunday'], workHours:{start:9,end:17},
    currency:'EUR（欧元）', language:'英语', englishLevel:'母语',
    timePerception:'守时，商务迟到5分钟内可接受',
    greeting:'握手+"How are you"或"Pleased to meet you"，称呼Mr./Ms.+姓',
    etiquette:[
      '友好热情、健谈，寒暄家常（天气、家庭、体育）',
      '称呼可较快过渡到直呼名（爱尔兰人较随意）',
      '酒馆(Pub)是常见社交和商务场所',
      '尊重对方观点，直接反驳被视为不礼貌',
      'Small talk很重要：天气、GAA体育、橄榄球是热门话题',
    ],
    negotiationTips:[
      '关系导向，建立信任后谈判更顺畅',
      '风格直接但友好，避免咄咄逼人',
      '重合同、守信用，口头承诺也需书面确认',
      '决策中速，尊重层级但关系重要',
      '幽默（自嘲式）加分',
      '圣诞节前后及8月度假季效率低',
    ],
    taboos:[
      '避免讨论北爱尔兰/英国政治敏感话题',
      '不要过于直接或施压',
      '避免询问隐私（收入、年龄、婚姻）',
      '不要将爱尔兰与英国混淆',
    ],
    holidays:'圣诞(12/25-26)、新年、St. Patrick\'s Day(3/17)、Easter、Bank Holidays',
    dress:'商务正装，较保守得体',
    gifts:'一般不送礼；圣诞可送小礼物、酒',
  },
  PL: {
    flag:'🇵🇱', name:'波兰', nameEn:'Poland', tz:'Europe/Warsaw',
    weekend:['Saturday','Sunday'], workHours:{start:9,end:17},
    currency:'PLN（兹罗提）', language:'波兰语', englishLevel:'年轻一代商务英语较好',
    timePerception:'较守时，迟到即不礼貌',
    greeting:'握手+"Dzień dobry"+Pan/Pani+姓',
    etiquette:['正式称呼，不直呼名字','名片波兰文/英文','尊重层级','小饮酒文化（伏特加）'],
    negotiationTips:['价格敏感，性价比重要','决策较慢','重关系但效率高于俄罗斯','制造业基础好'],
    taboos:['二战/苏联时期敏感话题','不要在公共场合大声喧哗','宗教(天主教)尊重'],
    holidays:'圣诞、新年、复活节、独立日11/11',
    dress:'商务正装',
    gifts:'伏特加/花(不送菊花)',
  },
  NL: {
    flag:'🇳🇱', name:'荷兰', nameEn:'Netherlands', tz:'Europe/Amsterdam',
    weekend:['Saturday','Sunday'], workHours:{start:8,end:17},
    currency:'EUR（欧元）', language:'荷兰语', englishLevel:'极高（非母语国最高），商务通用英语',
    timePerception:'极其守时，精确到分钟',
    greeting:'握手+"Goedendag"，直接称呼名字（荷兰文化较平等）',
    etiquette:['直接到粗鲁的程度是正常的，不要介意','重效率，小talk少','AA制很正常','工作生活平衡重视'],
    negotiationTips:[
      '荷兰人最直接："Nee"就是no，不要过度解读',
      '重数据、重性价比，不花哨',
      '决策快，扁平组织',
      '不喜欢过度客套和销售套路',
    ],
    taboos:['不要浪费时间寒暄太长','不要夸大产品','避免敏感话题（二战、宽容政策）'],
    holidays:'圣诞、新年、国王日4/27、解放日5/5',
    dress:'商务休闲到正装，较随性',
    gifts:'一般不送礼，简约实用风格',
  },
  RU: {
    flag:'🇷🇺', name:'俄罗斯', nameEn:'Russia', tz:'Europe/Moscow',
    weekend:['Saturday','Sunday'], workHours:{start:10,end:19},
    currency:'RUB（卢布）', language:'俄语', englishLevel:'商务圈有限，会俄语或有翻译更好',
    timePerception:'弹性，"耐心是美德"，等待和拖延是常态',
    greeting:'坚定握手+"Zdravstvuyte"，称呼名字+父称最礼貌',
    etiquette:[
      '称呼极其正式：名字+父称（如"伊万·伊万诺维奇"）',
      '初面冷淡严肃，熟络后才热情',
      '名片俄文一面朝上',
      '伏特加文化：敬酒要喝，不喝解释清楚',
      '不要随便微笑（俄罗斯人不对陌生人笑）',
    ],
    negotiationTips:[
      '谈判强硬，会用各种施压手段',
      '决策慢，层级严格，需要找到决策者',
      '关系(blat)极其重要，没有关系很难推进',
      '价格敏感，但西方制裁后转向中国供应商',
      '合同签后还要继续维护关系',
      '准备好长沉默和情绪波动',
      '付款风险：注意制裁和汇率波动',
    ],
    taboos:[
      '不要在门口握手（要进屋）',
      '不要送偶数鲜花（给死人）',
      '不要随便微笑（被视为不真诚）',
      '避免政治话题（乌克兰、制裁、斯大林）',
      '不批评俄罗斯',
    ],
    holidays:'新年长假期(1/1-1/8)、东正教圣诞1/7、胜利日5/9、国庆日6/12',
    dress:'正式深色商务装，女士正装或连衣裙',
    gifts:'好酒（如果对方喝）、高质量巧克力、中国特色礼品',
  },
  // ── 东南亚 ──
  VN: {
    flag:'🇻🇳', name:'越南', nameEn:'Vietnam', tz:'Asia/Ho_Chi_Minh',
    weekend:['Saturday','Sunday'], workHours:{start:8,end:17},
    currency:'VND（盾）', language:'越南语', englishLevel:'年轻一代/南部较好，北部有限',
    timePerception:'较弹性，迟到5-15分钟可接受',
    greeting:'握手+"Xin chào"，称呼用Anh/Chi(哥/姐)+名(不用姓)',
    etiquette:[
      '称呼用Anh(哥)/Chi(姐)+名（如Anh Minh），非常重要',
      '名片双手递接，越南文一面朝上',
      '不要拍头、摸小孩头',
      '商务宴请常见，喝酒文化在北部较浓',
    ],
    negotiationTips:[
      '价格极度敏感，越南客户很会砍价',
      '决策慢，国企更慢',
      '关系导向，需要多次会面',
      '南方(胡志明市)较开放商业氛围，北方(河内)较官僚',
      '中国产品接受度高，但有历史敏感',
      '付款方式要谨慎，LC或预付款',
    ],
    taboos:[
      '避免中越战争/历史话题',
      '不要用手指人，招手用掌心向下',
      '不要在公共场合亲密举动',
      '给老人/地位高的人递物用双手',
    ],
    holidays:'Tet春节（最重要，约7-10天，1月底-2月初）、国庆日9/2、统一日4/30',
    dress:'商务正装，南方可稍轻便',
    gifts:'中国茶叶、纪念品、高档白酒（北）',
  },
  TH: {
    flag:'🇹🇭', name:'泰国', nameEn:'Thailand', tz:'Asia/Bangkok',
    weekend:['Saturday','Sunday'], workHours:{start:9,end:17},
    currency:'THB（铢）', language:'泰语', englishLevel:'旅游/商务圈可用',
    timePerception:'弹性，"mai pen rai"(没关系)文化，时间灵活',
    greeting:'Wai礼(双手合十)+"Sawasdee krub/ka"，外国人点头微笑即可',
    etiquette:[
      'Wai礼是标准问候，但外国人握手也可',
      '头是神圣的，不要摸任何人的头包括小孩',
      '脚是最低的，不要用脚指物/脚底对人',
      '对王室极度尊重，不要批评国王',
      '名片双手递接',
    ],
    negotiationTips:[
      '泰国人友善但不直接说"不"，"maybe"常常是no',
      '关系导向，建立信任需要时间',
      '决策慢，层级多',
      '价格敏感，中国产品受欢迎',
      '讨价还价正常但不要激烈',
      '4月泼水节(Songkran)基本不工作',
    ],
    taboos:[
      '绝对不要批评王室（法律犯罪）',
      '不要摸头、不要脚底对人',
      '不要在公共场合亲密',
      '不要踩门槛，进寺庙脱鞋',
      '佛像不能拍照/亵渎',
    ],
    holidays:'Songkran泼水节4/13-15、国王生日、佛诞日',
    dress:'商务正装（颜色保守），进寺庙遮肩盖膝',
    gifts:'水果、中式糕点、纪念品',
  },
  MY: {
    flag:'🇲🇾', name:'马来西亚', nameEn:'Malaysia', tz:'Asia/Kuala_Lumpur',
    weekend:['Friday','Saturday'], workHours:{start:9,end:17},
    currency:'MYR（林吉特）', language:'马来语/英语/华语', englishLevel:'高，商务通用英语',
    timePerception:'较弹性，但商务场合较守时',
    greeting:'马来人"Salam"（握手+摸心口），华人握手即可',
    etiquette:[
      '多元种族（马来人/华人/印度人），注意对方族群习俗',
      '马来人穆斯林用右手，不碰异性',
      '华人客户可用华语沟通，文化接近中国',
      '名片右手递接',
    ],
    negotiationTips:[
      '关系导向，但华人客户商业效率较高',
      '马来人决策较慢，华人较直接',
      '价格敏感，中国供应商多竞争激烈',
      '伊斯兰金融产品有特殊规则',
      '清真认证(Halal)对食品/消费品重要',
    ],
    taboos:[
      '对马来人：不送酒/猪肉、不用左手',
      '不要在公共场合饮酒',
      '避免宗教/种族敏感话题',
      '不要用食指指人',
    ],
    holidays:'开斋节(最重要)、华人新年、屠妖节(Deepavali)、国庆日8/31',
    dress:'商务正装，穆斯林女士包头巾',
    gifts:'给马来人：避免酒/猪肉；给华人：茶/水果',
  },
  ID: {
    flag:'🇮🇩', name:'印尼', nameEn:'Indonesia', tz:'Asia/Jakarta',
    weekend:['Saturday','Sunday'], workHours:{start:8,end:17},
    currency:'IDR（卢比）', language:'印尼语', englishLevel:'大城市商务圈可用',
    timePerception:'弹性大，"jam karet"(橡皮时间)，迟到30分钟常见',
    greeting:'握手+"Selamat pagi/siang/sore"，穆斯林右手按胸',
    etiquette:[
      '印尼人友善温和，说话轻声细语',
      '名片右手/双手递接',
      '穆斯林多，注意伊斯兰礼节',
      ' Hierarchy重要，对年长者/上级尊重',
    ],
    negotiationTips:[
      '极度关系导向，需要建立个人信任',
      '决策慢，家族企业多',
      '价格敏感，议价空间大',
      '"Belum"(还没)是常见拒绝语，不要逼太急',
      '本地代理/合作伙伴很重要（印尼幅员辽阔）',
      '华裔商人商业能力强',
    ],
    taboos:[
      '不用左手、不摸头、不脚底对人',
      '避免政治话题（人权、东帝汶、巴布亚）',
      '公共场合穿着保守',
      '宗教敏感（穆斯林占多数）',
    ],
    holidays:'开斋节(Lebaran，最重要，约7天)、宰牲节、独立日8/17、Nyepi静居日(巴厘岛)',
    dress:'商务正装，雅加达较正式',
    gifts:'纪念品、茶、避免酒/猪肉',
  },
  PH: {
    flag:'🇵🇭', name:'菲律宾', nameEn:'Philippines', tz:'Asia/Manila',
    weekend:['Saturday','Sunday'], workHours:{start:9,end:18},
    currency:'PHP（比索）', language:'菲律宾语/英语', englishLevel:'高，亚洲英语最好之一，商务通用',
    timePerception:'"Filipino time"迟到30分钟-1小时常见',
    greeting:'握手+"How are you"，称呼Sir/Ma\'am很常见',
    etiquette:[
      '美式文化影响深，英语商务流畅',
      '家庭和关系极其重要(utang na loob-人情债)',
      '称呼Sir/Ma\'am+名或用头衔',
      '极度好客，面子(hiya)文化重要',
      'Karaoke文化常见',
    ],
    negotiationTips:[
      '友好亲切但决策慢',
      '不要当面让人丢面子(hiya)',
      '美式商业风格+亚洲关系文化混合',
      '价格敏感，BPO和海外务工经济',
      '台风季(6-11月)影响物流和工作',
    ],
    taboos:[
      '不要公开批评或让人难堪（面子文化）',
      '避免政治争议话题',
      '腐败话题谨慎',
      '不用手指人',
    ],
    holidays:'圣诞季(9月-12月，超长)、圣周(Holy Week)、独立日6/12、新年',
    dress:'商务正装，美式风格',
    gifts:'美式风格礼品、巧克力',
  },
  SG: {
    flag:'🇸🇬', name:'新加坡', nameEn:'Singapore', tz:'Asia/Singapore',
    weekend:['Saturday','Sunday'], workHours:{start:9,end:18},
    currency:'SGD（新元）', language:'英语/华语/马来语/泰米尔语', englishLevel:'母语级别，商务通用英语',
    timePerception:'极度守时，效率至上',
    greeting:'握手+英文名直接称呼（英式+华人混合文化）',
    etiquette:[
      '亚洲最国际化商业中心，非常规范',
      '名片双手递接',
      '效率极高，寒暄简短直接进主题',
      '多元种族注意各自习俗',
      '法规严格，不要行贿（极其严厉）',
    ],
    negotiationTips:[
      '高效直接，决策快',
      '重合同、重信誉、重数据',
      '价格竞争激烈但品质要求高',
      '新加坡是东南亚枢纽，作为区域总部入口',
      '英语商务，不需要本地语言',
    ],
    taboos:[
      '不要行贿（死刑级别）',
      '不要在公共场合吃东西/嚼口香糖（罚款）',
      '避免种族/宗教敏感话题',
      '不要随地吐痰/乱扔垃圾',
    ],
    holidays:'华人新年、开斋节、屠妖节、国庆日8/9、圣诞',
    dress:'商务正装，热带气候可衬衫领带',
    gifts:'一般不送礼（反腐严格）；可送公司纪念品',
  },
  // ── 南亚 ──
  IN: {
    flag:'🇮🇳', name:'印度', nameEn:'India', tz:'Asia/Kolkata',
    weekend:['Sunday'], workHours:{start:10,end:18},
    currency:'INR（卢比）', language:'印地语/英语', englishLevel:'商务圈通用英语',
    timePerception:'弹性大，"IST"=Indian Stretchable Time，迟到30分钟+',
    greeting:'双手合十"Namaste"；商务握手也可；异性等对方伸手',
    etiquette:[
      '等级分明(Caste制度虽废除但影响仍在)，对老板/上级尊重',
      '称呼用Sir/Madam或Mr./Mrs.+姓',
      '右手递物，左手被视为不洁',
      '不要拍头，脚是不洁的',
      '牛是神圣的，不要吃牛肉/送牛皮制品',
      '商务招待多素食',
    ],
    negotiationTips:[
      '印度人超级善谈判，全球最会砍价之一',
      '价格极度敏感，但不能只卖低价，要展示价值',
      '决策慢，层级多，最后拍板的是大老板',
      '"I will consider"常常是no',
      '古吉拉特/马尔瓦里商人最精明',
      '合同条款要非常详细，印度合同纠纷多',
      '注意付款信用，建议LC或预付款',
      '地域差异大：孟买/德里商业氛围不同',
    ],
    taboos:[
      '不吃牛肉（印度教徒），不送牛皮',
      '不用左手',
      '宗教敏感（印度教/穆斯林/锡克教）',
      '巴基斯坦话题避免',
      '不要在公共场合亲密',
    ],
    holidays:'Holi(3月)、Diwali排灯节(10-11月，最重要)、独立日8/15、Republic Day 1/26',
    dress:'商务正装保守，女士可穿纱丽或套装',
    gifts:'甜食、巧克力、花(不送白色花)、避免牛皮/酒',
  },
  PK: {
    flag:'🇵🇰', name:'巴基斯坦', nameEn:'Pakistan', tz:'Asia/Karachi',
    weekend:['Saturday','Sunday'], workHours:{start:9,end:17},
    currency:'PKR（卢比）', language:'乌尔都语/英语', englishLevel:'商务圈/政府通用英语',
    timePerception:'弹性，"Pakistani time"迟到常见',
    greeting:'"As-salamu alaykum"，右手握手，异性等对方伸手',
    etiquette:['伊斯兰保守文化','中国是"铁杆朋友"，对华友好度极高','称呼Mr./Mrs.+姓','茶(Chai)招待必接受'],
    negotiationTips:[
      '中巴经济走廊(CPEC)带来大量基建需求',
      '中国供应商接受度极高',
      '决策较慢，关系导向',
      '价格敏感，但对中国兄弟较友好',
      '注意付款安全',
    ],
    taboos:['伊斯兰严格禁忌','不饮酒、不送酒','避免政治话题(印度/克什米尔/军方)','不用左手'],
    holidays:'开斋节、宰牲节、独立日8/14、巴基斯坦日3/23',
    dress:'保守商务正装，女士遮体',
    gifts:'简单礼品即可，避免酒/猪肉',
  },
  BD: {
    flag:'🇧🇩', name:'孟加拉国', nameEn:'Bangladesh', tz:'Asia/Dhaka',
    weekend:['Friday','Saturday'], workHours:{start:10,end:18},
    currency:'BDT（塔卡）', language:'孟加拉语', englishLevel:'商务圈可用',
    timePerception:'弹性大，迟到常见',
    greeting:'"Salamu alaykum"（穆斯林为主），右手握手',
    etiquette:['伊斯兰文化','右物右手','中国友好','服装出口业发达'],
    negotiationTips:['价格极度敏感','决策慢','RMG(成衣)产业发达，建材有需求','注意银行/付款风险'],
    taboos:['伊斯兰禁忌','不用左手','避免政治敏感话题'],
    holidays:'开斋节(Eid-ul-Fitr，最重要)、宰牲节、独立日3/26、胜利日12/16',
    dress:'保守商务装',
    gifts:'简单小礼品',
  },
  LK: {
    flag:'🇱🇰', name:'斯里兰卡', nameEn:'Sri Lanka', tz:'Asia/Colombo',
    weekend:['Saturday','Sunday'], workHours:{start:9,end:17},
    currency:'LKR（卢比）', language:'僧伽罗语/泰米尔语', englishLevel:'商务圈可用',
    timePerception:'弹性，"斯里兰卡时间"慢节奏',
    greeting:'双手合十"Ayubowan"，握手也可',
    etiquette:['佛教文化为主，也有印度教/穆斯林/基督徒','头是神圣的不摸头','进寺庙脱鞋','茶(Ceylon Tea)是重要社交'],
    negotiationTips:['决策慢，关系导向','价格敏感','茶叶/服装/旅游业主导，建材有市场'],
    taboos:['不摸头、佛像是神圣的（背对佛像拍照不礼貌）、避免政治(内战/人权)话题'],
    holidays:'僧伽罗/泰米尔新年4月、Vesak卫塞节、独立日2/4',
    dress:'商务正装保守',
    gifts:'茶叶、纪念品',
  },
  // ── 非洲 ──
  NG: {
    flag:'🇳🇬', name:'尼日利亚', nameEn:'Nigeria', tz:'Africa/Lagos',
    weekend:['Saturday','Sunday'], workHours:{start:8,end:17},
    currency:'NGN（奈拉）', language:'英语', englishLevel:'官方语言英语，商务通用',
    timePerception:'弹性大，"African time"迟到30分钟-1小时常见',
    greeting:'握手+"Good morning/afternoon"，称呼Sir/Chief+名',
    etiquette:[
      '非洲最大经济体，商业活跃度高',
      '头衔和等级重要，长者和老板要高度尊重',
      '名片右手递接',
      '尼日利亚人外向健谈，商务场合寒暄较多',
    ],
    negotiationTips:[
      '尼日利亚商人精明，谈判技巧高超',
      '价格极度敏感，做好拉锯战准备',
      '419诈骗臭名昭著，严格核实合作伙伴和付款',
      '石油经济带来财富但汇率波动大',
      '拉各斯(Lagos)是商业中心',
      '本地代理很重要',
      '绝对要求预付款或LC',
    ],
    taboos:[
      '避免政治/腐败话题',
      '不要用左手递物',
      '部落敏感（约鲁巴/伊博/豪萨）少谈',
      '诈骗问题是敏感话题',
    ],
    holidays:'独立日10/1、开斋节/宰牲节（穆斯林多）、圣诞/复活节（基督徒多）、新年',
    dress:'商务正装，拉各斯较时尚',
    gifts:'简单小礼品即可',
  },
  KE: {
    flag:'🇰🇪', name:'肯尼亚', nameEn:'Kenya', tz:'Africa/Nairobi',
    weekend:['Saturday','Sunday'], workHours:{start:8,end:17},
    currency:'KES（先令）', language:'斯瓦希里语/英语', englishLevel:'官方英语，商务通用',
    timePerception:'相对东非最守时，但还是弹性',
    greeting:'握手+"Jambo/How are you"，称呼Mr./Mrs.+姓',
    etiquette:['东非最大经济体，区域枢纽','斯瓦希里语"Jambo/Hakuna matata"是友好表示','名片右手递接','内罗毕是东非商业中心'],
    negotiationTips:['相对成熟商业环境','决策中速','价格敏感但重品质','英美法系，合同较规范','中国基建项目多，接受度高'],
    taboos:['避免政治/腐败/部落话题','不要用左手','野生动物保护是正面话题'],
    holidays:'Jamhuri Day 12/12、Madaraka Day 6/1、开斋节、圣诞',
    dress:'商务正装',
    gifts:'纪念品即可',
  },
  ZA: {
    flag:'🇿🇦', name:'南非', nameEn:'South Africa', tz:'Africa/Johannesburg',
    weekend:['Saturday','Sunday'], workHours:{start:8,end:17},
    currency:'ZAR（兰特）', language:'英语/阿非利卡语/祖鲁语等11种', englishLevel:'商务通用英语',
    timePerception:'相对守时（英式影响）',
    greeting:'坚定握手，称呼Mr./Mrs./Ms.+姓',
    etiquette:['非洲最发达经济体','彩虹文化多元（黑人/白人/印度人/混血）','英式商务礼仪为基础','约翰内斯堡/开普敦商业发达'],
    negotiationTips:[
      '英式商业风格，较规范',
      '重合同、重信用',
      '矿业/制造业/金融业发达',
      'BBBEE（黑人经济振兴）政策影响商业',
      '价格和品质并重',
    ],
    taboos:['种族隔离(Apartheid)历史敏感','不要拍贫困/贫民窟场景','犯罪安全话题谨慎'],
    holidays:'Freedom Day 4/27、Heritage Day 9/24、人权日3/21、圣诞/新年',
    dress:'商务正装，英式风格',
    gifts:'红酒、巧克力、商务礼品',
  },
  MA: {
    flag:'🇲🇦', name:'摩洛哥', nameEn:'Morocco', tz:'Africa/Casablanca',
    weekend:['Saturday','Sunday'], workHours:{start:9,end:18},
    currency:'MAD（迪拉姆）', language:'阿拉伯语/柏柏尔语/法语', englishLevel:'法语是商务语言，英语在增长',
    timePerception:'弹性大，急不得',
    greeting:'"Salamu alaykum"+握手；法式贴面礼在商界',
    etiquette:['阿拉伯+柏柏尔+法/西混合文化','法语是商业通用语','卡萨布兰卡是经济中心','茶(Mint Tea)是招待核心，至少喝一杯'],
    negotiationTips:['法式+阿拉伯混合谈判风格','讨价还价是文化','关系导向','决策慢','制造业（磷矿/纺织/汽车）和旅游业发达'],
    taboos:[
      '不要用左手',
      '进清真寺非穆斯林限制',
      '宗教/王室敏感话题（国王受尊敬）',
      '斋月尊重',
      '不要给当地人拍照未经允许',
    ],
    holidays:'开斋节、宰牲节、王位日7/30、新年、独立日11/18',
    dress:'商务正装，卡萨布兰卡较国际化',
    gifts:'法式风格小礼品',
  },
  GH: {
    flag:'🇬🇭', name:'加纳', nameEn:'Ghana', tz:'Africa/Accra',
    weekend:['Saturday','Sunday'], workHours:{start:8,end:17},
    currency:'GHS（塞地）', language:'英语', englishLevel:'官方英语',
    timePerception:'弹性，但西非较守时',
    greeting:'握手，称呼Mr./Mrs.+姓',
    etiquette:['西非较稳定民主国家','阿克拉是商业中心','名片右手递接','右物右手'],
    negotiationTips:['相对规范商业环境','金矿/可可/石油经济','价格敏感','本地代理重要'],
    taboos:['不要用左手','政治话题避免','部落敏感'],
    holidays:'独立日3/6、开斋节、圣诞',
    dress:'商务正装',
    gifts:'简单礼品',
  },
  ET: {
    flag:'🇪🇹', name:'埃塞俄比亚', nameEn:'Ethiopia', tz:'Africa/Addis_Ababa',
    weekend:['Saturday','Sunday'], workHours:{start:8,end:17},
    currency:'ETB（比尔）', language:'阿姆哈拉语', englishLevel:'商务圈有限',
    timePerception:'弹性',
    greeting:'握手问候',
    etiquette:['非洲唯一未被殖民国家，文化自豪感强','咖啡发源地，咖啡仪式隆重','非盟总部所在地'],
    negotiationTips:['东非人口大国增长快','价格敏感','政府主导经济，Bureaucracy重','本地代理必要'],
    taboos:['避免殖民/政治敏感话题'],
    holidays:'Enkutatash(埃塞新年9/11)、Meskel、开斋节、圣诞(1/7)',
    dress:'商务正装',
    gifts:'纪念品',
  },
  TZ: {
    flag:'🇹🇿', name:'坦桑尼亚', nameEn:'Tanzania', tz:'Africa/Dar_es_Salaam',
    weekend:['Saturday','Sunday'], workHours:{start:8,end:17},
    currency:'TZS（先令）', language:'斯瓦希里语/英语', englishLevel:'商务英语可用',
    timePerception:'弹性（"pole pole"慢慢来哲学）',
    greeting:'"Jambo"+握手',
    etiquette:['达累斯萨拉姆是商业中心','斯瓦希里文化，友善温和','中国在坦基建多，接受度高'],
    negotiationTips:['价格敏感','关系导向','中坦友好','矿业/农业/旅游业'],
    taboos:['左手禁忌','政治话题避免'],
    holidays:'Union Day 4/26、独立日12/9、开斋节、圣诞',
    dress:'商务正装',
    gifts:'简单礼品',
  },
  // ── 拉美 ──
  BR: {
    flag:'🇧🇷', name:'巴西', nameEn:'Brazil', tz:'America/Sao_Paulo',
    weekend:['Saturday','Sunday'], workHours:{start:9,end:18},
    currency:'BRL（雷亚尔）', language:'葡萄牙语', englishLevel:'有限，会葡语非常加分',
    timePerception:'弹性大，社交迟到15-30分钟正常，商务稍好',
    greeting:'热情握手+贴面礼（女士之间/男女），男士拍肩握手',
    etiquette:[
      '巴西人热情外向，身体距离近',
      '称呼用"Você"+名（不称姓）',
      '名片英文/葡文都可',
      '咖啡(Cafezinho)是必喝的，不要拒绝',
      '午餐是正餐，商务午餐常见',
    ],
    negotiationTips:[
      '关系导向极重，没有个人信任做不成生意',
      '谈判风格热情但不草率，可能多轮拉锯',
      '价格敏感但也重品质',
      '进口税高，报价要考虑总到岸成本',
      '付款风险：注意汇率和外汇管制',
      '圣保罗是商业中心',
      '狂欢节(Carnival,2-3月)前后不要安排重要业务',
    ],
    taboos:[
      '不要OK手势（粗鲁），竖大拇指才是正面',
      '不要讨论阿根廷（竞争关系）、亚马逊雨林破坏、腐败',
      '不要在商务场合用西班牙语（巴西说葡语）',
      '穿着要讲究，巴西人重视外表',
    ],
    holidays:'狂欢节(2-3月)、独立日9/7、圣诞、新年、Tiradentes 4/21',
    dress:'时尚商务正装，圣保罗注重外表',
    gifts:'好咖啡、巧克力、不要送手帕（意味离别）',
  },
  MX: {
    flag:'🇲🇽', name:'墨西哥', nameEn:'Mexico', tz:'America/Mexico_City',
    weekend:['Saturday','Sunday'], workHours:{start:9,end:18},
    currency:'MXN（比索）', language:'西班牙语', englishLevel:'北部/旅游区较好，城内外有限',
    timePerception:'弹性，"la hora mexicana"迟到30分钟常见',
    greeting:'握手+拥抱(熟人)+贴面礼（女士）',
    etiquette:[
      '热情友好，身体距离近',
      '头衔重要：Licenciado/Ingeniero/Doctor',
      '称呼名+姓，或头衔+姓',
      '午餐(Comida)是核心商务餐，14:00-16:00，可能很长',
    ],
    negotiationTips:[
      '关系第一，"personalismo"个人关系决定商业',
      '讨价还价是文化，留好空间',
      '决策较慢，层级分明',
      '美国影响大，但有民族自豪感',
      '汇率波动大，注意付款条款',
      '北部(蒙特雷)较工业化效率高',
    ],
    taboos:[
      '不要讨论毒品/贩毒集团、腐败、美墨边界问题',
      '不要用"gringo"相关词',
      '不要在公共场合戴草帽/穿墨西哥刻板印象服装',
      '不要拒绝食物/饮品招待',
    ],
    holidays:'独立日9/16、亡灵节11/1-2、Cinco de Mayo 5/5、圣诞/新年、圣周',
    dress:'商务正装，墨西哥城正式',
    gifts:'商务笔、巧克力、龙舌兰（如果对方喝）',
  },
  CL: {
    flag:'🇨🇱', name:'智利', nameEn:'Chile', tz:'America/Santiago',
    weekend:['Saturday','Sunday'], workHours:{start:9,end:18},
    currency:'CLP（比索）', language:'西班牙语', englishLevel:'商务圈有限',
    timePerception:'拉美最守时，商务场合基本准时',
    greeting:'握手+称呼Señor/Señora+姓',
    etiquette:['拉美最保守/最欧洲化的商务文化','圣地亚哥商业规范','名片西文/英文','较正式拘谨'],
    negotiationTips:['决策相对拉美较快','合同意识强','价格和品质并重','矿业（铜）和林业/渔业/葡萄酒主导','中国是最大贸易伙伴'],
    taboos:['避免皮诺切特/人权历史话题','不要和阿根廷比'],
    holidays:'独立日9/18-19、新年、圣诞、圣周',
    dress:'深色商务正装，最正式拉美国家',
    gifts:'葡萄酒、巧克力',
  },
  PE: {
    flag:'🇵🇪', name:'秘鲁', nameEn:'Peru', tz:'America/Lima',
    weekend:['Saturday','Sunday'], workHours:{start:9,end:18},
    currency:'PEN（索尔）', language:'西班牙语', englishLevel:'利马商务圈一般',
    timePerception:'弹性，迟到15-30分钟',
    greeting:'握手，熟人拥抱',
    etiquette:['利马是商业中心','矿业(铜/银/金)/渔业/农业经济','名片西/英文','正式但不如智利拘谨'],
    negotiationTips:['关系导向','价格敏感','矿业相关需求大','中国投资多'],
    taboos:['避免政治(藤森/腐败)话题'],
    holidays:'独立日7/28-29、圣周、圣诞/新年',
    dress:'商务正装',
    gifts:'简单商务礼品',
  },
  AR: {
    flag:'🇦🇷', name:'阿根廷', nameEn:'Argentina', tz:'America/Argentina/Buenos_Aires',
    weekend:['Saturday','Sunday'], workHours:{start:9,end:18},
    currency:'ARS（比索）', language:'西班牙语', englishLevel:'布宜诺斯艾利斯商务圈可用',
    timePerception:'弹性，迟到30分钟常见，晚餐21点后',
    greeting:'热情握手+贴面礼（异性/女女），男士拥抱',
    etiquette:[
      '阿根廷人自认为最欧洲的拉美国家',
      '布宜诺斯艾利斯时尚精致',
      '称呼用名+姓，朋友间用名',
      '晚餐极晚(21-23点)，商务晚餐也是',
      'Mate马黛茶是社交标志',
    ],
    negotiationTips:[
      '阿根廷人健谈善辩，谈判激烈有激情',
      '价格谈判空间大',
      '经济波动极大，汇率风险，注意付款',
      '农业/矿业/油气/服务业',
      '不要拿阿根廷和其他拉美国家比',
    ],
    taboos:[
      '避免福克兰群岛/马岛战争话题',
      '不要批评阿根廷牛肉/足球',
      '庇隆主义政治话题谨慎',
      '不要穿正式西装吃Asado(烤肉)',
    ],
    holidays:'独立日7/9、革命日5/25、圣周、圣诞/新年',
    dress:'时尚商务正装，布宜诺斯艾利斯欧式时尚',
    gifts:'红酒、优质牛肉相关、巧克力',
  },
  CO: {
    flag:'🇨🇴', name:'哥伦比亚', nameEn:'Colombia', tz:'America/Bogota',
    weekend:['Saturday','Sunday'], workHours:{start:8,end:17},
    currency:'COP（比索）', language:'西班牙语', englishLevel:'波哥大商务圈有限',
    timePerception:'弹性，迟到15-30分钟',
    greeting:'握手+男士拍肩，女士贴面礼',
    etiquette:['波哥大/麦德林商业氛围','咖啡是重要招待','名片西/英文','称呼正式'],
    negotiationTips:['关系导向','价格敏感','咖啡/石油/花卉/煤炭经济','麦德林集团历史不要提','安全局势改善中'],
    taboos:['绝对避免毒品/巴勃罗/游击队话题','不要说"coca"随意','政治/腐败话题谨慎'],
    holidays:'独立日7/20、圣周、Battle of Boyaca 8/7、圣诞/新年',
    dress:'商务正装，波哥大高原凉爽需外套',
    gifts:'咖啡、商务笔',
  },
  // ── 北美/大洋洲 ──
  US: {
    flag:'🇺🇸', name:'美国', nameEn:'USA', tz:'America/New_York',
    weekend:['Saturday','Sunday'], workHours:{start:9,end:17},
    currency:'USD（美元）', language:'英语', englishLevel:'母语',
    timePerception:'时间就是金钱，守时高效',
    greeting:'坚定握手+称呼名字（美国文化直呼名字），"Hi, I\'m [First Name]"',
    etiquette:[
      '非常直接高效，small talk简短（天气/体育/通勤）然后进主题',
      '直呼名字是标准，不用头衔除非医生/教授',
      '名片交换随意，不特别仪式化',
      '商务午餐常见，咖啡会议也可以',
    ],
    negotiationTips:[
      '直接务实，"What\'s the bottom line?"',
      '决策快，尊重数据和事实',
      '不喜欢浪费时间，准备好电梯演讲',
      '合同详尽正式，律师介入多',
      '价格竞争激烈但愿意为价值付费',
      '区域差异：东海岸正式快节奏，西海岸休闲科技感，南部热情慢节奏',
    ],
    taboos:[
      '避免询问年龄/收入/婚姻/宗教/政治',
      '不要过度谦虚（会被认为能力不足）',
      '不要批评美国',
      '种族/性别敏感话题谨慎',
    ],
    holidays:'独立日7/4、感恩节11月第4个周四、圣诞/新年、劳动节9月第一个周一',
    dress:'商务正装(东海岸/传统行业)到商务休闲(西海岸/科技)',
    gifts:'一般不送礼；可送公司纪念品或请客吃饭',
  },
  CA: {
    flag:'🇨🇦', name:'加拿大', nameEn:'Canada', tz:'America/Toronto',
    weekend:['Saturday','Sunday'], workHours:{start:9,end:17},
    currency:'CAD（加元）', language:'英语/法语', englishLevel:'母语',
    timePerception:'守时',
    greeting:'握手+直呼名字，比美国稍含蓄',
    etiquette:['比美国更礼貌/含蓄，爱说"sorry"','魁北克用法语','多元文化尊重','名片较随意'],
    negotiationTips:['类似美国但稍温和','决策中速','重合同','法语在魁北克加分'],
    taboos:['不要和美国混淆","魁北克独立话题谨慎","文化尊重（原住民/移民）'],
    holidays:'Canada Day 7/1、感恩节10月第二个周一、圣诞/新年、Victoria Day',
    dress:'商务正装到商务休闲',
    gifts:'冰酒、枫糖产品',
  },
  AU: {
    flag:'🇦🇺', name:'澳大利亚', nameEn:'Australia', tz:'Australia/Sydney',
    weekend:['Saturday','Sunday'], workHours:{start:9,end:17},
    currency:'AUD（澳元）', language:'英语', englishLevel:'母语',
    timePerception:'守时但不刻板',
    greeting:'握手+直呼名字，"G\'day"在非正式场合',
    etiquette:[
      '随和直率，"no worries"文化',
      '不喜欢装腔作势(tall poppy syndrome)',
      '商务着装偏休闲',
      '酒吧社交很常见',
    ],
    negotiationTips:[
      '直接务实，不自夸不吹牛',
      '决策快，重数据',
      '矿业/农业/建筑/服务业发达',
      '中澳关系波动但贸易量大',
      '合同正式',
    ],
    taboos:[
      '不要自夸/吹嘘',
      '原住民话题谨慎',
      '不要拿口音/俚语开玩笑',
    ],
    holidays:'Australia Day 1/26、ANZAC Day 4/25、圣诞/新年、女王生日(6月)',
    dress:'商务休闲为主，悉尼/墨尔本较正式',
    gifts:'一般不送礼；啤酒/葡萄酒',
  },
  NZ: {
    flag:'🇳🇿', name:'新西兰', nameEn:'New Zealand', tz:'Pacific/Auckland',
    weekend:['Saturday','Sunday'], workHours:{start:8,end:17},
    currency:'NZD（纽元）', language:'英语/毛利语', englishLevel:'母语',
    timePerception:'守时',
    greeting:'握手+直呼名字+Kia Ora(毛利问候)',
    etiquette:['比澳洲更安静保守','毛利文化尊重','Kiwi务实低调'],
    negotiationTips:['务实直接','小规模市场','农业/乳制品/旅游为主','决策快'],
    taboos:['避免毛利文化不尊重','不要和澳洲混为一谈'],
    holidays:'Waitangi Day 2/6、ANZAC Day、圣诞/新年',
    dress:'商务休闲',
    gifts:'简单纪念品',
  },
  // ── 东亚（客户/供应链）──
  JP: {
    flag:'🇯🇵', name:'日本', nameEn:'Japan', tz:'Asia/Tokyo',
    weekend:['Saturday','Sunday'], workHours:{start:9,end:18},
    currency:'JPY（日元）', language:'日语', englishLevel:'商务圈有限，翻译常需要',
    timePerception:'极度守时，提前5分钟到，迟到即大不尊重',
    greeting:'鞠躬(15-30度)；握手也可，但力度轻；称呼XX-san',
    etiquette:[
      '名片是仪式：双手递接，日文一面朝上，接过要认真看',
      '称呼姓+san（如"Tanaka-san"），绝不直呼名',
      '鞠躬是基本礼仪，外国人微微点头鞠躬即可',
      '不要在商务场合插兜',
      '沉默是金，不要填补所有空隙',
      '喝酒文化(Nomikai)是商务重要部分',
    ],
    negotiationTips:[
      '决策极慢，Ringi(禀议)制度需要层层审批',
      '重视品质、细节、长期关系，不只是价格',
      '一旦建立关系非常忠诚',
      '"Hai"是"我听到了"不是"我同意"',
      '不要直接说no，用"検討します"(我们研究)代表拒绝',
      '包装和样品呈现要精致',
      '合同前会反复确认细节',
    ],
    taboos:[
      '不要在名片上写字/折名片（名片是人本身）',
      '不要用筷子插饭（葬礼仪式）',
      '不要在公共场合吹鼻涕',
      '不要4/9数字（不吉利）',
      '不要直接拒绝（要委婉）',
    ],
    holidays:'新年(1/1-3)、樱花季(3-4月)、Golden Week(4/29-5/5)、盂兰盆节(8月中)',
    dress:'深色商务正装，一丝不苟',
    gifts:'包装精致的食品/酒/公司纪念品（中元/岁暮文化）',
  },
  KR: {
    flag:'🇰🇷', name:'韩国', nameEn:'South Korea', tz:'Asia/Seoul',
    weekend:['Saturday','Sunday'], workHours:{start:9,end:18},
    currency:'KRW（韩元）', language:'韩语', englishLevel:'大公司(三星/现代)可用英语，中小有限',
    timePerception:'守时，迟到不尊重',
    greeting:'鞠躬+握手（双手或右手），称呼XX-ssi',
    etiquette:[
      '等级分明，年龄/职位极其重要',
      '名片双手递接，韩文一面朝上',
      '称呼姓+职位+nim/ssi（如"Kim sajang-nim"金社长）',
      '喝酒文化：转身背向长辈/上级喝',
      '聚餐(Hoesik)是必须参加的商务场合',
    ],
    negotiationTips:[
      '决策较快但重层级，最终拍板是会长/社长',
      '价格+品质+交付(Pali-pali 快快文化)',
      '一旦建立关系较忠诚',
      '五大财阀(三星/现代/SK/LG/乐天)主导',
      '合同和细节要明确',
      '情绪表达比日本多，但等级还是重要',
    ],
    taboos:[
      '不要用红笔写名字（死亡）',
      '不要在长辈/上级面前抽烟/喝酒不转身',
      '不要直接拒绝，要委婉',
      '不要把日本作为比较基准',
    ],
    holidays:'Seollal春节(1-2月3天)、Chuseok中秋(9-10月3天)、光复节8/15、新年',
    dress:'深色商务正装，时尚但保守',
    gifts:'包装精致的礼品（水果/人参/牛肉/酒），送礼文化发达',
  },

  CN: {
    flag:'🇨🇳', name:'中国', nameEn:'China', tz:'Asia/Shanghai',
    weekend:['Saturday','Sunday'], workHours:{start:9,end:18},
    currency:'CNY（人民币）', language:'中文', englishLevel:'英语普及率一般，商务场合可用英语',
    timePerception:'守时是基本素养，约定时间应准时到达，迟到需提前告知并道歉',
    greeting:'点头微笑或握手，熟人之间可拍肩或挥手致意；商务场合互换名片（双手递接）',
    etiquette:[
      '商务会面先互换名片，仔细阅读对方名片后再收起',
      '送礼讲究包装和寓意，避免送钟（谐音"送终"）和白色/黑色包装',
      '餐桌文化重要，商务宴请是建立关系的重要环节',
      '尊重长幼尊卑，座位安排有讲究（面朝门为上座）',
      '商务谈判注重关系和信任，初次合作可能需多次面谈'
    ],
    negotiationTips:[
      '关系先行：先建立个人信任和好感，再谈业务细节',
      '耐心为上：决策流程较长，可能需要多层审批，不要催促',
      '面子很重要：公开场合避免让对方丢面子，分歧私下沟通',
      '价格谈判留有余地：初次报价通常有议价空间，不要一口价',
      '重视节日节奏：春节前1-2周基本停摆，国庆黄金周同理'
    ],
    taboos:[
      '数字4（谐音"死"）——楼层、房间号、礼品数量都要避免',
      '白色和黑色与丧事相关，包装/礼物慎用',
      '绿色帽子=伴侣出轨，绝对不能送',
      '不要公开批评中国文化或政治敏感话题',
      '不要直接拒绝——用"我们考虑考虑"代替"不行"'
    ],
    holidays:'春节（1-2月）、国庆（10.1）、中秋、端午、清明、劳动节（5.1）'
  },
};

// 电话国家码 → ISO alpha-2
// WhatsApp JID前缀（不带+号）→ ISO代码
const PHONE_PREFIX_TO_ISO = {
  '963':'SY','961':'LB','971':'AE','966':'SA','974':'QA','965':'KW','973':'BH','968':'OM',
  '962':'JO','964':'IQ','20':'EG','90':'TR','972':'IL','98':'IR','970':'PS','967':'YE',
  '49':'DE','33':'FR','39':'IT','34':'ES','44':'GB','48':'PL','31':'NL','32':'BE','43':'AT',
  '41':'CH','46':'SE','47':'NO','45':'DK','351':'PT','30':'GR','420':'CZ','36':'HU','40':'RO',
  '7':'RU','380':'UA','375':'BY',
  '84':'VN','66':'TH','60':'MY','62':'ID','63':'PH','65':'SG','95':'MM','855':'KH','856':'LA',
  '91':'IN','92':'PK','880':'BD','94':'LK','977':'NP',
  '234':'NG','254':'KE','27':'ZA','212':'MA','233':'GH','251':'ET','255':'TZ','256':'UG','258':'MZ',
  '20':'EG','213':'DZ','216':'TN','225':'CI','228':'TG','229':'BJ',
  '55':'BR','52':'MX','56':'CL','51':'PE','54':'AR','57':'CO','58':'VE','593':'EC','591':'BO',
  '595':'PY','598':'UY','507':'PA','506':'CR','503':'SV','504':'HN','502':'GT','1':'US',
  '1':'CA',  // 北美1开头需要更多判断
  '61':'AU','64':'NZ',
  '81':'JP','82':'KR','86':'CN','886':'TW','852':'HK','853':'MO',
};

// 北美1开头的特殊处理（美国/加拿大/加勒比）
const NORTH_AMERICA_PREFIX = {
  // 美国常见区号+加拿大，简化处理：1开头且不是其他北美地区默认美国
};

function detectCountryFromJid(jid) {
  if (!jid) return null;
  // 格式: 国家码+号码@s.whatsapp.net
  const phonePart = jid.split('@')[0];
  if (!phonePart) return null;
  // 从长前缀开始匹配
  const sorted = Object.keys(PHONE_PREFIX_TO_ISO).sort((a,b) => b.length - a.length);
  for (const prefix of sorted) {
    if (phonePart.startsWith(prefix)) {
      // 北美1开头需要区分（暂不细分，默认美国）
      if (prefix === '1') return 'US';
      return PHONE_PREFIX_TO_ISO[prefix];
    }
  }
  return null;
}

// \u4ece\u8054\u7cfb\u4eba\u540d\u5b57\u63a8\u65ad\u56fd\u5bb6ISO\u7801\uff08\u652f\u6301\u4e2d\u82f1\u6587\u5173\u952e\u8bcd\uff09
const countryNameMap = {
  '\u80af\u5c3c\u4e9a':'KE','\u5766\u6851\u5c3c\u4e9a':'TZ','\u4e4c\u5e72\u8fbe':'UG','\u5362\u65fa\u8fbe':'RW','\u57c3\u585e\u4fc4\u6bd4\u4e9a':'ET',
  '\u5357\u975e':'ZA','\u5c3c\u65e5\u5229\u4e9a':'NG','\u52a0\u7eb3':'GH','\u57c3\u53ca':'EG','\u6469\u6d1b\u54e5':'MA','\u963f\u5c14\u53ca\u5229\u4e9a':'DZ',
  '\u7a81\u5c3c\u65af':'TN','\u5580\u9ea6\u9686':'CM','\u79d1\u7279\u8fea\u74e6':'CI','\u585e\u5185\u52a0\u5c14':'SN','\u9a6c\u91cc':'ML',
  '\u521a\u679c':'CD','\u5b89\u54e5\u62c9':'AO','\u83ab\u6851\u6bd4\u514b':'MZ','\u8d5e\u6bd4\u4e9a':'ZM','\u6d25\u5df4\u5e03\u97e6':'ZW',
  '\u7eb3\u7c73\u6bd4\u4e9a':'NA','\u535a\u8328\u74e6\u7eb3':'BW','\u9a6c\u62c9\u7ef4':'MW','\u9a6c\u8fbe\u52a0\u65af\u52a0':'MG','\u82cf\u4e39':'SD',
  '\u5229\u6bd4\u4e9a':'LY','\u6bdb\u91cc\u6c42\u65af':'MU','\u52a0\u84ec':'GA','\u591a\u54e5':'TG','\u8d1d\u5b81':'BJ',
  '\u5e03\u57fa\u7eb3\u6cd5\u7d22':'BF','\u51e0\u5185\u4e9a':'GN','\u585e\u62c9\u5229\u6602':'SL','\u5229\u6bd4\u91cc\u4e9a':'LR',
  '\u4e2d\u56fd':'CN','\u5370\u5ea6':'IN','\u5df4\u57fa\u65af\u5766':'PK','\u5b5f\u52a0\u62c9':'BD','\u65af\u91cc\u5170\u5361':'LK',
  '\u7f05\u7538':'MM','\u6cf0\u56fd':'TH','\u8d8a\u5357':'VN','\u67ec\u57d4\u5be8':'KH','\u8001\u631d':'LA',
  '\u9a6c\u6765\u897f\u4e9a':'MY','\u65b0\u52a0\u5761':'SG','\u5370\u5c3c':'ID','\u5370\u5ea6\u5c3c\u897f\u4e9a':'ID','\u83f2\u5f8b\u5bbe':'PH',
  '\u65e5\u672c':'JP','\u97e9\u56fd':'KR','\u671d\u9c9c':'KP','\u8499\u53e4':'MN','\u5c3c\u6cca\u5c14':'NP',
  '\u4f0a\u6717':'IR','\u4f0a\u62c9\u514b':'IQ','\u6c99\u7279':'SA','\u6c99\u7279\u963f\u62c9\u4f2f':'SA','\u963f\u8054\u914b':'AE',
  '\u8fea\u62dc':'AE','\u5361\u5854\u5c14':'QA','\u79d1\u5a01\u7279':'KW','\u5df4\u6797':'BH','\u963f\u66fc':'OM',
  '\u4ee5\u8272\u5217':'IL','\u571f\u8033\u5176':'TR','\u7ea6\u65e6':'JO','\u9ece\u5df4\u5ae9':'LB','\u53d9\u5229\u4e9a':'SY',
  '\u4e5f\u95e8':'YE','\u963f\u5bcc\u6c57':'AF','\u683c\u9c81\u5409\u4e9a':'GE','\u4e9a\u7f8e\u5c3c\u4e9a':'AM','\u963f\u585e\u62dc\u7586':'AZ',
  '\u4fc4\u7f57\u65af':'RU','\u4e4c\u514b\u5170':'UA','\u767d\u4fc4\u7f57\u65af':'BY','\u6ce2\u5170':'PL','\u6377\u514b':'CZ',
  '\u65af\u6d1b\u4f10\u514b':'SK','\u5308\u7259\u5229':'HU','\u7f57\u9a6c\u5c3c\u4e9a':'RO','\u4fdd\u52a0\u5229\u4e9a':'BG','\u585e\u5c14\u7ef4\u4e9a':'RS',
  '\u514b\u7f57\u5730\u4e9a':'HR','\u65af\u6d1b\u6587\u5c3c\u4e9a':'SI','\u5e0c\u814a':'GR','\u610f\u5927\u5229':'IT','\u897f\u73ed\u7259':'ES',
  '\u8461\u8404\u7259':'PT','\u6cd5\u56fd':'FR','\u5fb7\u56fd':'DE','\u82f1\u56fd':'GB','\u7231\u5c14\u5170':'IE',
  '\u8377\u5170':'NL','\u6bd4\u5229\u65f6':'BE','\u5362\u68ee\u5821':'LU','\u745e\u58eb':'CH','\u5965\u5730\u5229':'AT',
  '\u745e\u5178':'SE','\u631a\u5a01':'NO','\u4e39\u9ea6':'DK','\u82ac\u5170':'FI','\u51b0\u5c9b':'IS',
  '\u7f8e\u56fd':'US','\u52a0\u62ff\u5927':'CA','\u58a8\u897f\u54e5':'MX','\u5df4\u897f':'BR','\u963f\u6839\u5ef7':'AR',
  '\u667a\u5229':'CL','\u79d8\u9c81':'PE','\u54e5\u4f26\u6bd4\u4e9a':'CO','\u59d4\u5185\u745e\u62c9':'VE','\u5384\u74dc\u591a\u5c14':'EC',
  '\u73bb\u5229\u7ef4\u4e9a':'BO','\u5df4\u62c9\u572d':'PY','\u4e4c\u62c9\u572d':'UY','\u53e4\u5df4':'CU','\u5df4\u62ff\u9a6c':'PA',
  '\u54e5\u65af\u8fbe\u9ece\u52a0':'CR','\u5371\u5730\u9a6c\u62c9':'GT','\u6d2a\u90fd\u62c9\u65af':'HN','\u8428\u5c14\u74e6\u591a':'SV','\u5c3c\u52a0\u62c9\u74dc':'NI',
  '\u591a\u660e\u5c3c\u52a0':'DO','\u7259\u4e70\u52a0':'JM','\u6d77\u5730':'HT','\u7279\u7acb\u5c3c\u8fbe':'TT',
  '\u6fb3\u5927\u5229\u4e9a':'AU','\u65b0\u897f\u5170':'NZ','\u6590\u6d4e':'FJ',
  'Kenya':'KE','Tanzania':'TZ','Uganda':'UG','Rwanda':'RW','Ethiopia':'ET',
  'South Africa':'ZA','Nigeria':'NG','Ghana':'GH','Egypt':'EG','Morocco':'MA','Algeria':'DZ',
  'Tunisia':'TN','Cameroon':'CM','Ivory Coast':'CI','Senegal':'SN','Mali':'ML',
  'Congo':'CD','Angola':'AO','Mozambique':'MZ','Zambia':'ZM','Zimbabwe':'ZW',
  'Namibia':'NA','Botswana':'BW','Malawi':'MW','Madagascar':'MG','Sudan':'SD',
  'Libya':'LY','Mauritius':'MU','Gabon':'GA','Togo':'TG','Benin':'BJ',
  'Burkina Faso':'BF','Guinea':'GN','Sierra Leone':'SL','Liberia':'LR',
  'China':'CN','India':'IN','Pakistan':'PK','Bangladesh':'BD','Sri Lanka':'LK',
  'Myanmar':'MM','Thailand':'TH','Vietnam':'VN','Cambodia':'KH','Laos':'LA',
  'Malaysia':'MY','Singapore':'SG','Indonesia':'ID','Philippines':'PH',
  'Japan':'JP','Korea':'KR','Mongolia':'MN','Nepal':'NP',
  'Iran':'IR','Iraq':'IQ','Saudi Arabia':'SA','UAE':'AE','Dubai':'AE',
  'Qatar':'QA','Kuwait':'KW','Bahrain':'BH','Oman':'OM',
  'Israel':'IL','Turkey':'TR','Jordan':'JO','Lebanon':'LB','Syria':'SY',
  'Yemen':'YE','Afghanistan':'AF','Georgia':'GE','Armenia':'AM','Azerbaijan':'AZ',
  'Russia':'RU','Ukraine':'UA','Belarus':'BY','Poland':'PL','Czech':'CZ',
  'Slovakia':'SK','Hungary':'HU','Romania':'RO','Bulgaria':'BG','Serbia':'RS',
  'Croatia':'HR','Slovenia':'SI','Greece':'GR','Italy':'IT','Spain':'ES',
  'Portugal':'PT','France':'FR','Germany':'DE','United Kingdom':'GB','UK':'GB','Britain':'GB',
  'Ireland':'IE','Netherlands':'NL','Belgium':'BE','Luxembourg':'LU','Switzerland':'CH','Austria':'AT',
  'Sweden':'SE','Norway':'NO','Denmark':'DK','Finland':'FI','Iceland':'IS',
  'United States':'US','USA':'US','America':'US','Canada':'CA','Mexico':'MX',
  'Brazil':'BR','Argentina':'AR','Chile':'CL','Peru':'PE','Colombia':'CO',
  'Venezuela':'VE','Ecuador':'EC','Bolivia':'BO','Paraguay':'PY','Uruguay':'UY',
  'Cuba':'CU','Panama':'PA','Costa Rica':'CR','Guatemala':'GT','Honduras':'HN',
  'El Salvador':'SV','Nicaragua':'NI','Dominican Republic':'DO','Jamaica':'JM','Haiti':'HT',
  'Australia':'AU','New Zealand':'NZ','Fiji':'FJ',
};

function detectCountryFromName(name) {
  if (!name) return null;
  const trimmed = name.trim();
  if (countryNameMap[trimmed]) return countryNameMap[trimmed];
  for (const [key, val] of Object.entries(countryNameMap)) {
    if (key.length >= 2 && trimmed.toLowerCase().includes(key.toLowerCase())) {
      return val;
    }
  }
  for (const [key, val] of Object.entries(countryNameMap)) {
    if (trimmed.includes(key)) return val;
  }
  return null;
}

function getCulture(iso) {
  if (!iso) return null;
  return CULTURE_DATA[iso.toUpperCase()] || null;
}

// 计算当地时间的工作状态
function getLocalWorkStatus(tz, workHours) {
  try {
    const now = new Date();
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hour12:false,
      hour:'2-digit', minute:'2-digit', weekday:'short',
    });
    const parts = {};
    for (const p of fmt.formatToParts(now)) {
      if (p.type !== 'literal') parts[p.type] = p.value;
    }
    const h = parseInt(parts.hour||'0',10);
    const wd = parts.weekday;
    const start = workHours?.start ?? 9;
    const end = workHours?.end ?? 18;
    const weekends = workHours?.weekend || ['Saturday','Sunday'];
    const isWeekend = weekends.includes(wd);
    let status, icon, tip;
    if (isWeekend) {
      status = 'weekend'; icon = '🎉'; tip = '休息日中，建议下工作日再联系';
    } else if (h >= start && h < end) {
      status = 'working'; icon = '🟢'; tip = '工作时间，现在联系合适';
    } else if (h >= end && h < end+3) {
      status = 'evening'; icon = '🌆'; tip = '晚间，紧急可联系但非最佳';
    } else if (h >= 7 && h < start) {
      status = 'morning'; icon = '🌅'; tip = '清晨，对方可能还未上班';
    } else {
      status = 'night'; icon = '🌙'; tip = '深夜休息中，建议明早再联系';
    }
    // 格式化当前时间
    const timeFmt = new Intl.DateTimeFormat('zh-CN', {
      timeZone: tz, hour12:false,
      hour:'2-digit', minute:'2-digit', weekday:'short',
    });
    return { status, icon, tip, localTime: timeFmt.format(now), hour: h, weekday: wd, isWeekend };
  } catch(e) { return null; }
}



const cultureManualNationality = ref('');
const cultureManualResidence = ref('');
const cultureUseResidence = ref(false);
const cultureShowCustom = ref(false);
const cultureTick = ref(Date.now());
let cultureTimer = null;

const cultureAllCountries = computed(() => {
  return Object.entries(CULTURE_DATA).map(([iso, d]) => ({ iso, ...d }));
});

// 从localStorage读取手动修正
function cultureLoadManual() {
  // 优先使用TG jid，否则使用WA jid
  const jid = tgActiveJid.value || chatStore.activeJid;
  if (!jid) { cultureManualNationality.value = ''; cultureManualResidence.value = ''; return; }
  // 先从localStorage快速加载
  try {
    const raw = localStorage.getItem('culture_manual_map');
    const map = raw ? JSON.parse(raw) : {};
    const entry = map[jid] || {};
    cultureManualNationality.value = entry.nationality || '';
    cultureManualResidence.value = entry.residence || '';
    cultureUseResidence.value = entry.useResidence === true;
  } catch(e) {}
  // 从后端API加载最新值（覆盖localStorage缓存）
  const token = localStorage.getItem('token');
  if (!token) return;
  fetch('/api/culture-settings/' + encodeURIComponent(jid), {
    headers: { 'Authorization': 'Bearer ' + token }
  }).then(r => r.ok ? r.json() : null).then(data => {
    if (data && (data.nationality || data.residence)) {
      cultureManualNationality.value = data.nationality || '';
      cultureManualResidence.value = data.residence || '';
      cultureUseResidence.value = data.useResidence === true;
      // 同步到localStorage缓存
      try {
        const raw = localStorage.getItem('culture_manual_map');
        const map = raw ? JSON.parse(raw) : {};
        map[jid] = { nationality: data.nationality, residence: data.residence, useResidence: data.useResidence };
        localStorage.setItem('culture_manual_map', JSON.stringify(map));
      } catch(e) {}
    }
  }).catch(() => {});
}

function cultureSaveManual() {
  // 优先使用TG jid，否则使用WA jid
  const jid = tgActiveJid.value || chatStore.activeJid;
  if (!jid) return;
  // 保存到localStorage缓存
  try {
    const raw = localStorage.getItem('culture_manual_map');
    const map = raw ? JSON.parse(raw) : {};
    map[jid] = { nationality: cultureManualNationality.value, residence: cultureManualResidence.value, useResidence: cultureUseResidence.value };
    localStorage.setItem('culture_manual_map', JSON.stringify(map));
  } catch(e) {}
  // 保存到后端API（永久存储）
  const token = localStorage.getItem('token');
  if (!token) return;
  fetch('/api/culture-settings/' + encodeURIComponent(jid), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({
      nationality: cultureManualNationality.value || null,
      residence: cultureManualResidence.value || null,
      useResidence: cultureUseResidence.value,
    })
  }).catch(() => {});
}

// Auto-save whenever manual values change (more reliable than @change on mobile)
watch([cultureManualNationality, cultureManualResidence, cultureUseResidence], () => {
  cultureSaveManual();
});

// 检测客户ISO（优先手动→客户档案country→手机号国家码）
const _customerCountryIsoCache = new Map();
function cultureGetAutoIso(jid, conv) {
  if (!jid) return null;
  // 1. 手动设置优先
  if (cultureManualNationality.value) return cultureManualNationality.value;
  // 1.5 【TC-020修复】客户档案 country 优先（号码为中国号不应覆盖客户公司所在地）
  // 2026-08-24 国家自动同步后 country 存中文名，需映射回 ISO 供文化库查询
  const _custCountry = customerData.value?.country;
  if (_custCountry) {
    const _cn = String(_custCountry).trim();
    const _iso = countryNameMap[_cn] || (/^[A-Za-z]{2}$/.test(_cn) ? _cn.toUpperCase() : null);
    if (_iso) return _iso;
  }
  // 1.6 【TC-020修复】从客户公司名/联系人名推断国家（公司所在地优先于号码归属地）
  const _nameCand = customerData.value?.companyName || conv?.name || customerData.value?.contactName || customerData.value?.name || '';
  if (_nameCand) {
    const _nameIso = detectCountryFromName(_nameCand);
    if (_nameIso) return _nameIso;
  }
  // 2. 从jid推断国家码（号码归属地仅作兜底）
  let iso = detectCountryFromJid(jid);
  if (iso) return iso;
  // 2.5 TG JID: 从jid中提取电话号码（格式：123456789@telegram）
  if (jid.endsWith('@telegram')) {
    const tgPhone = jid.split('@')[0];
    if (tgPhone) {
      iso = detectCountryFromJid(tgPhone + '@s.whatsapp.net');
      if (iso) return iso;
    }
  }
  // 3. 从conversation对象的contactPhone字段（后端从Contact表获取）
  const convPhone = conv?.contactPhone;
  if (convPhone) {
    iso = detectCountryFromJid(convPhone + '@s.whatsapp.net');
    if (iso) return iso;
  }
  // 4. 回退到customerData的phone字段
  const phone = customerData.value?.phone;
  if (phone) {
    iso = detectCountryFromJid(phone + '@s.whatsapp.net');
    if (iso) return iso;
  }
  // 3.5 从联系人名字推断国家（中英文关键词）
  const nameCandidate = conv?.name || customerData.value?.contactName || customerData.value?.name || '';
  if (nameCandidate) {
    const nameIso = detectCountryFromName(nameCandidate);
    if (nameIso) return nameIso;
  }
  // 5. 客户档案country字段
  const country = customerData.value?.country;
  if (country) {
    const _cn = String(country).trim();
    const _iso = countryNameMap[_cn] || (/^[A-Za-z]{2}$/.test(_cn) ? _cn.toUpperCase() : null);
    if (_iso) return _iso;
  }
  return null;
}

const cultureNationalityIso = computed(() => {
  const jid = chatStore.activeJid;
  const conv = chatStore.activeConversation;
  if (!jid) return null;
  return cultureGetAutoIso(jid, conv);
});

const cultureResidenceIso = computed(() => {
  if (cultureManualResidence.value) return cultureManualResidence.value;
  return null; // 默认同国籍
});

const cultureResidenceName = computed(() => {
  if (!cultureResidenceIso.value) return '';
  const c = getCulture(cultureResidenceIso.value);
  return c ? c.name : '';
});

const cultureIso = computed(() => {
  // 当前展示的ISO：useResidence时展示所在国时间，但文化信息仍看国籍
  if (cultureUseResidence.value && cultureResidenceIso.value) return cultureResidenceIso.value;
  return cultureNationalityIso.value;
});

const cultureInfoNationality = computed(() => getCulture(cultureNationalityIso.value));
const cultureInfo = computed(() => getCulture(cultureIso.value));

const cultureCustomerLabel = computed(() => {
  if (!cultureNationalityIso.value) return '';
  const nat = getCulture(cultureNationalityIso.value);
  if (!nat) return '';
  const city = customerData.value?.city;
  const parts = [];
  if (cultureResidenceIso.value && cultureResidenceIso.value !== cultureNationalityIso.value) {
    const res = getCulture(cultureResidenceIso.value);
    parts.push(nat.flag + nat.name + '国籍');
    if (res) {
      let locStr = res.flag + res.name;
      if (city) locStr += ' · ' + city;
      parts.push('现居' + locStr);
    }
    return parts.join(' · ');
  }
  // 国籍=所在国或无所在国时，显示城市
  if (city) return nat.flag + nat.name + ' · ' + city;
  return nat.flag + nat.name;
});


// 客户实际时区：优先城市→所在国→国籍国
const cultureCustomerTz = computed(() => {
  // 1. 尝试从客户城市解析
  const city = customerData.value?.city;
  const countryIso = cultureResidenceIso.value || cultureNationalityIso.value;
  if (city && countryIso) {
    const tz = resolveCustomerTz(city, countryIso);
    if (tz) return tz;
  }
  // 2. 回退到国家默认时区
  if (cultureResidenceIso.value) {
    const resInfo = getCulture(cultureResidenceIso.value);
    if (resInfo?.tz) return resInfo.tz;
  }
  const info = cultureInfo.value;
  return info?.tz || null;
});

const cultureWorkStatus = computed(() => {
  cultureTick.value; // 依赖刷新
  if (!cultureIso.value) return { status:'none', icon:'', tip:'', localTime:'', hour:0, weekday:'', isWeekend:false };
  const info = cultureInfo.value;
  if (!info) return { status:'none', icon:'', tip:'', localTime:'', hour:0, weekday:'', isWeekend:false };
  // 优先使用客户城市时区，回退到国家默认
  const tz = cultureCustomerTz.value || info.tz;
  return getLocalWorkStatus(tz, info.workHours) || { status:'none', icon:'', tip:'', localTime:'', hour:0, weekday:'', isWeekend:false };
});

const cultureWeekendText = computed(() => {
  const info = cultureInfo.value;
  if (!info) return '';
  const map = { Monday:'周一', Tuesday:'周二', Wednesday:'周三', Thursday:'周四', Friday:'周五', Saturday:'周六', Sunday:'周日' };
  return (info.weekend||[]).map(w => map[w]||w).join(' / ');
});

function cultureTzDiffFromNow(tz) {
  try {
    const now = new Date();
    function getOffsetMin(tz) {
      const dtf = new Intl.DateTimeFormat('en-US', {timeZone:tz,hour12:false,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'});
      const parts={};
      for (const p of dtf.formatToParts(now)) if (p.type!=='literal') parts[p.type]=p.value;
      const asUTC=Date.UTC(+parts.year,+parts.month-1,+parts.day,+parts.hour,+parts.minute,+parts.second);
      return (asUTC-now.getTime())/60000;
    }
    const targetMin=getOffsetMin(tz);
    const localMin=-now.getTimezoneOffset();
    let diff=targetMin-localMin;
    while(diff>720)diff-=1440;while(diff<-720)diff+=1440;
    const h=diff/60;
    if(diff===0)return '与本地相同';
    const abs=Math.abs(h);
    const s=Number.isInteger(abs)?abs:abs.toFixed(1);
    return diff>0?`比本地快${s}小时`:`比本地慢${s}小时`;
  }catch(e){return '';}
}
const cultureTzDiff = computed(() => {
  const info = cultureInfo.value;
  return info ? cultureTzDiffFromNow(info.tz) : '';
});

// 切换会话时重新加载手动修正（WA + TG）
watch(() => chatStore.activeJid, (newJid, oldJid) => {
  if (newJid && newJid !== oldJid) {
    cultureLoadManual();
  }
});
watch(tgActiveJid, (newJid, oldJid) => {
  if (newJid && newJid !== oldJid) {
    cultureLoadManual();
  }
});

// provide给子组件（ChatWindow等）使用
provide('cultureInfo', cultureInfo);
provide('cultureWorkStatus', cultureWorkStatus);
provide('cultureIso', cultureIso);



// ========== 🕐 世界时钟 ==========
const WC_PRESET_CITIES = [
  { flag: '🇨🇳', name: '北京/上海', tz: 'Asia/Shanghai', tz_label: 'UTC+8' },
  { flag: '🇺🇸', name: '纽约', tz: 'America/New_York', tz_label: 'UTC-5/-4' },
  { flag: '🇺🇸', name: '洛杉矶', tz: 'America/Los_Angeles', tz_label: 'UTC-8/-7' },
  { flag: '🇺🇸', name: '芝加哥', tz: 'America/Chicago', tz_label: 'UTC-6/-5' },
  { flag: '🇬🇧', name: '伦敦', tz: 'Europe/London', tz_label: 'UTC+0/+1' },
  { flag: '🇩🇪', name: '柏林/法兰克福', tz: 'Europe/Berlin', tz_label: 'UTC+1/+2' },
  { flag: '🇫🇷', name: '巴黎', tz: 'Europe/Paris', tz_label: 'UTC+1/+2' },
  { flag: '🇮🇹', name: '罗马/米兰', tz: 'Europe/Rome', tz_label: 'UTC+1/+2' },
  { flag: '🇪🇸', name: '马德里', tz: 'Europe/Madrid', tz_label: 'UTC+1/+2' },
  { flag: '🇳🇱', name: '阿姆斯特丹', tz: 'Europe/Amsterdam', tz_label: 'UTC+1/+2' },
  { flag: '🇷🇺', name: '莫斯科', tz: 'Europe/Moscow', tz_label: 'UTC+3' },
  { flag: '🇦🇪', name: '迪拜', tz: 'Asia/Dubai', tz_label: 'UTC+4' },
  { flag: '🇸🇦', name: '利雅得', tz: 'Asia/Riyadh', tz_label: 'UTC+3' },
  { flag: '🇮🇳', name: '新德里', tz: 'Asia/Kolkata', tz_label: 'UTC+5:30' },
  { flag: '🇸🇬', name: '新加坡', tz: 'Asia/Singapore', tz_label: 'UTC+8' },
  { flag: '🇭🇰', name: '香港', tz: 'Asia/Hong_Kong', tz_label: 'UTC+8' },
  { flag: '🇯🇵', name: '东京', tz: 'Asia/Tokyo', tz_label: 'UTC+9' },
  { flag: '🇰🇷', name: '首尔', tz: 'Asia/Seoul', tz_label: 'UTC+9' },
  { flag: '🇹🇭', name: '曼谷', tz: 'Asia/Bangkok', tz_label: 'UTC+7' },
  { flag: '🇻🇳', name: '河内/胡志明', tz: 'Asia/Ho_Chi_Minh', tz_label: 'UTC+7' },
  { flag: '🇮🇩', name: '雅加达', tz: 'Asia/Jakarta', tz_label: 'UTC+7' },
  { flag: '🇵🇭', name: '马尼拉', tz: 'Asia/Manila', tz_label: 'UTC+8' },
  { flag: '🇲🇾', name: '吉隆坡', tz: 'Asia/Kuala_Lumpur', tz_label: 'UTC+8' },
  { flag: '🇦🇺', name: '悉尼', tz: 'Australia/Sydney', tz_label: 'UTC+10/+11' },
  { flag: '🇦🇺', name: '墨尔本', tz: 'Australia/Melbourne', tz_label: 'UTC+10/+11' },
  { flag: '🇧🇷', name: '圣保罗', tz: 'America/Sao_Paulo', tz_label: 'UTC-3' },
  { flag: '🇲🇽', name: '墨西哥城', tz: 'America/Mexico_City', tz_label: 'UTC-6' },
  { flag: '🇨🇦', name: '多伦多', tz: 'America/Toronto', tz_label: 'UTC-5/-4' },
  { flag: '🇨🇦', name: '温哥华', tz: 'America/Vancouver', tz_label: 'UTC-8/-7' },
  { flag: '🇹🇷', name: '伊斯坦布尔', tz: 'Europe/Istanbul', tz_label: 'UTC+3' },
  { flag: '🇿🇦', name: '约翰内斯堡', tz: 'Africa/Johannesburg', tz_label: 'UTC+2' },
  { flag: '🇪🇬', name: '开罗', tz: 'Africa/Cairo', tz_label: 'UTC+2' },
  { flag: '🇳🇬', name: '拉各斯', tz: 'Africa/Lagos', tz_label: 'UTC+1' },
  { flag: '🇵🇰', name: '卡拉奇', tz: 'Asia/Karachi', tz_label: 'UTC+5' },
  { flag: '🇧🇩', name: '达卡', tz: 'Asia/Dhaka', tz_label: 'UTC+6' },
  { flag: '🇨🇳', name: '台北', tz: 'Asia/Taipei', tz_label: 'UTC+8' },
];

const wcClocks = ref([]);
const wcSelectedCity = ref('');
const wcTick = ref(Date.now());
// 时钟刻度（12个）
const wcHourMarks = [];
for (let _i = 1; _i <= 12; _i++) {
  const a = _i * Math.PI / 6;
  wcHourMarks.push({ x1: 50+40*Math.sin(a), y1: 50-40*Math.cos(a), x2: 50+44*Math.sin(a), y2: 50-44*Math.cos(a) });
}
let wcTimer = null;

function wcLoadClocks() {
  try {
    const saved = localStorage.getItem('wc_clocks');
    if (saved) {
      wcClocks.value = JSON.parse(saved);
    } else {
      // 默认：北京+纽约+伦敦+迪拜+东京
      wcClocks.value = WC_PRESET_CITIES.filter(c =>
        ['Asia/Shanghai','America/New_York','Europe/London','Asia/Dubai','Asia/Tokyo'].includes(c.tz)
      ).map(c => ({ flag: c.flag, name: c.name, tz: c.tz }));
    }
  } catch(e) {
    wcClocks.value = [];
  }
}

function wcSaveClocks() {
  try { localStorage.setItem('wc_clocks', JSON.stringify(wcClocks.value)); } catch(e) {}
}

const wcAvailableCities = computed(() => {
  const added = new Set(wcClocks.value.map(c => c.tz));
  return WC_PRESET_CITIES.filter(c => !added.has(c.tz));
});

function wcAddClock(tz) {
  if (!tz) return;
  const preset = WC_PRESET_CITIES.find(c => c.tz === tz);
  if (preset && !wcClocks.value.find(c => c.tz === tz)) {
    wcClocks.value.push({ flag: preset.flag, name: preset.name, tz: tz });
    wcSaveClocks();
  }
  wcSelectedCity.value = '';
}

function wcRemoveClock(idx) {
  wcClocks.value.splice(idx, 1);
  wcSaveClocks();
}

function wcTzDiff(tz) {
  try {
    // 用Intl.DateTimeFormat获取该时区与UTC的偏移
    const now = new Date(wcTick.value);
    function getOffsetMin(timeZone) {
      const dtf = new Intl.DateTimeFormat('en-US', {
        timeZone, hour12: false,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });
      const parts = {};
      for (const p of dtf.formatToParts(now)) {
        if (p.type !== 'literal') parts[p.type] = p.value;
      }
      const asUTC = Date.UTC(+parts.year, +parts.month-1, +parts.day, +parts.hour, +parts.minute, +parts.second);
      return (asUTC - now.getTime()) / 60000;
    }
    const targetMin = getOffsetMin(tz);
    const localMin = -now.getTimezoneOffset(); // 本地相对UTC的分钟偏移
    let diffMin = targetMin - localMin;
    // 归一化到[-720,720]
    while (diffMin > 720) diffMin -= 1440;
    while (diffMin < -720) diffMin += 1440;
    const diffH = diffMin / 60;
    if (diffMin === 0) return '与本地相同';
    const absH = Math.abs(diffH);
    const hrs = Number.isInteger(absH) ? absH : absH.toFixed(1);
    if (diffH > 0) return `比本地快${hrs}h`;
    return `比本地慢${hrs}h`;
  } catch(e) { return ''; }
}

function wcTime(tz) {
  try {
    const d = new Date(wcTick.value);
    const fmt = new Intl.DateTimeFormat('zh-CN', {
      timeZone: tz, hour12: false,
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short'
    });
    const parts = {};
    for (const p of fmt.formatToParts(d)) {
      if (p.type !== 'literal') parts[p.type] = p.value;
    }
    const h = parseInt(parts.hour||'0',10);
    const m = parseInt(parts.minute||'0',10);
    const s = parseInt(parts.second||'0',10);
    const timeStr = `${parts.hour}:${parts.minute}:${parts.second}`;
    const dateStr = `${parts.year}-${parts.month}-${parts.day}`;
    const hA = (h%12)*30*Math.PI/180 + m*0.5*Math.PI/180;
    const mA = m*6*Math.PI/180 + s*0.1*Math.PI/180;
    const sA = s*6*Math.PI/180;
    return {
      time: timeStr, date: dateStr, day: parts.weekday||'',
      hx: 50+22*Math.sin(hA), hy: 50-22*Math.cos(hA),
      mx: 50+32*Math.sin(mA), my: 50-32*Math.cos(mA),
      sx: 50+36*Math.sin(sA), sy: 50-36*Math.cos(sA),
    };
  } catch(e) {
    return { time:'--:--:--', date:'----', day:'', hAngle:0, mAngle:0, sAngle:0 };
  }
}


async function loadCustomerByJid(jid) {
  if (!jid) return;
  try {
    const { data } = await api.get('/customers/by-jid/' + encodeURIComponent(jid)).catch(() => ({data:null}));
    if (data) customerData.value = data;
    else {
      // Try search by phone
      const phone = jid.split('@')[0];
      const { data: list } = await api.get('/customers?search=' + encodeURIComponent(phone)).catch(()=>({data:null}));
      if (list?.items?.length) customerData.value = list.items[0];
    }
  } catch(e) { console.warn('loadCustomerByJid err', e); }
}

onMounted(() => {
  wcLoadClocks();
  wcTimer = setInterval(() => { wcTick.value = Date.now(); }, 1000);
  cultureTimer = setInterval(() => { cultureTick.value = Date.now(); }, 30000);
  cultureLoadManual();
  exRefreshRates();
  window.addEventListener('open-culture-panel', () => { switchPanel('worldclock'); });
  window.addEventListener('open-proxy-panel', onOpenProxyPanel);
});
onUnmounted(() => {
  if (wcTimer) clearInterval(wcTimer);
  if (cultureTimer) clearInterval(cultureTimer);
  window.removeEventListener('open-culture-panel', () => { switchPanel('worldclock'); });
  window.removeEventListener('open-proxy-panel', onOpenProxyPanel);
});


// ========== 💱 汇率计算 ==========
const EX_CURRENCIES = [
  { code: 'CNY', symbol: '¥', name: '人民币' },
  { code: 'USD', symbol: '$', name: '美元' },
  { code: 'EUR', symbol: '€', name: '欧元' },
  { code: 'GBP', symbol: '£', name: '英镑' },
  { code: 'JPY', symbol: '¥', name: '日元' },
  { code: 'KRW', symbol: '₩', name: '韩元' },
  { code: 'HKD', symbol: 'HK$', name: '港币' },
  { code: 'SGD', symbol: 'S$', name: '新加坡元' },
  { code: 'AUD', symbol: 'A$', name: '澳元' },
  { code: 'NZD', symbol: 'NZ$', name: '新西兰元' },
  { code: 'CAD', symbol: 'C$', name: '加元' },
  { code: 'CHF', symbol: 'CHF', name: '瑞郎' },
  { code: 'SEK', symbol: 'kr', name: '瑞典克朗' },
  { code: 'NOK', symbol: 'kr', name: '挪威克朗' },
  { code: 'DKK', symbol: 'kr', name: '丹麦克朗' },
  { code: 'INR', symbol: '₹', name: '印度卢比' },
  { code: 'THB', symbol: '฿', name: '泰铢' },
  { code: 'MYR', symbol: 'RM', name: '林吉特' },
  { code: 'PHP', symbol: '₱', name: '菲律宾比索' },
  { code: 'IDR', symbol: 'Rp', name: '印尼盾' },
  { code: 'BRL', symbol: 'R$', name: '巴西雷亚尔' },
  { code: 'MXN', symbol: 'Mex$', name: '墨西哥比索' },
  { code: 'TRY', symbol: '₺', name: '土耳其里拉' },
  { code: 'ZAR', symbol: 'R', name: '南非兰特' },
  { code: 'PLN', symbol: 'zł', name: '波兰兹罗提' },
  { code: 'ILS', symbol: '₪', name: '以色列新谢克尔' },
  { code: 'HUF', symbol: 'Ft', name: '匈牙利福林' },
  { code: 'CZK', symbol: 'Kč', name: '捷克克朗' },
  { code: 'RON', symbol: 'lei', name: '罗马尼亚列伊' },
  { code: 'ISK', symbol: 'kr', name: '冰岛克朗' },
];

const exRates = ref({});
const exBase = ref('EUR');
const exLastUpdate = ref('');
const exLoading = ref(false);
const exError = ref('');
const exAmount = ref(1);
const exFrom = ref('CNY');
const exTo = ref('USD');
const exRateVal = ref(0);

const exCurrencies = computed(() => EX_CURRENCIES);
const exQuickCodes = ['USD','EUR','GBP','JPY','HKD','AUD','CAD','SGD','INR','KRW','THB','MYR'];
const exQuickRates = computed(() => {
  return exQuickCodes.map(code => {
    const cur = EX_CURRENCIES.find(c => c.code === code);
    let rate = null;
    if (exRates.value && exRates.value['CNY'] && exRates.value[code]) {
      rate = exRates.value[code] / exRates.value['CNY'];
    }
    return { code, symbol: cur?.symbol||'', name: cur?.name||'', rate };
  });
});
const exResultText = computed(() => {
  if (!exRateVal.value || !exAmount.value) return '';
  const val = Number(exAmount.value) * exRateVal.value;
  return val.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
});

function exCalc() {
  if (!exRates.value || Object.keys(exRates.value).length === 0) { exRateVal.value = 0; return; }
  const rates = exRates.value;
  const from = exFrom.value, to = exTo.value;
  const rFrom = rates[from] || (from === exBase.value ? 1 : null);
  const rTo = rates[to] || (to === exBase.value ? 1 : null);
  if (!rFrom || !rTo) { exRateVal.value = 0; return; }
  exRateVal.value = rTo / rFrom;
  exError.value = '';
}
function exSwap() {
  const tmp = exFrom.value; exFrom.value = exTo.value; exTo.value = tmp; exCalc();
}
async function exRefreshRates() {
  exLoading.value = true; exError.value = '';
  try {
    const cached = localStorage.getItem('ex_rates_cache');
    if (cached) {
      try {
        const obj = JSON.parse(cached);
        if (obj.date && Date.now() - obj.ts < 3600000) {
          exRates.value = obj.rates; exBase.value = obj.base; exLastUpdate.value = obj.date;
          exCalc(); exLoading.value = false; return;
        }
      } catch(e) {}
    }
    const resp = await fetch('https://api.frankfurter.dev/v1/latest?from=' + exBase.value);
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const data = await resp.json();
    // Ensure CNY is present (Frankfurter base=EUR usually includes all)
    exRates.value = data.rates || {};
    exBase.value = data.base || 'EUR';
    exLastUpdate.value = data.date || '';
    // Add base currency itself
    exRates.value[data.base] = 1;
    try {
      localStorage.setItem('ex_rates_cache', JSON.stringify({ rates: exRates.value, base: exBase.value, date: exLastUpdate.value, ts: Date.now() }));
    } catch(e) {}
    exCalc();
  } catch(e) {
    exError.value = '汇率加载失败，请检查网络';
    try {
      const c2 = localStorage.getItem('ex_rates_cache');
      if (c2) {
        const obj = JSON.parse(c2);
        exRates.value = obj.rates; exBase.value = obj.base; exLastUpdate.value = (obj.date||'') + '(缓存)';
        exCalc();
      }
    } catch(e2) {}
  } finally {
    exLoading.value = false;
  }
}

// ========== 运费查询 (Freight) ==========
const frLastUpdate = '2026年7月第三周';
const frContainers = [
  { key: '20gp', label: '20GP' },
  { key: '40gp', label: '40GP' },
  { key: '40hq', label: '40HQ' },
];
const frContainer = ref('40hq');
const frContainerLabel = computed(() => {
  const c = frContainers.find(x => x.key === frContainer.value);
  return c ? c.label : '';
});
const frPorts = [
  { code: 'CNSHA', name: '上海', flag: '🇨🇳' },
  { code: 'CNNGB', name: '宁波', flag: '🇨🇳' },
  { code: 'CNSZN', name: '深圳', flag: '🇨🇳' },
  { code: 'CNGZH', name: '广州', flag: '🇨🇳' },
  { code: 'CNQIN', name: '青岛', flag: '🇨🇳' },
  { code: 'CNTSN', name: '天津', flag: '🇨🇳' },
  { code: 'CNXMN', name: '厦门', flag: '🇨🇳' },
  { code: 'HKHKG', name: '香港', flag: '🇭🇰' },
];
const frDestMap = {
  'CNSHA': [
    { code: 'USLAX', name: '洛杉矶', flag: '🇺🇸' },
    { code: 'USLGB', name: '长滩', flag: '🇺🇸' },
    { code: 'USOAK', name: '奥克兰', flag: '🇺🇸' },
    { code: 'USSEA', name: '西雅图', flag: '🇺🇸' },
    { code: 'USNYC', name: '纽约', flag: '🇺🇸' },
    { code: 'USSAV', name: '萨瓦纳', flag: '🇺🇸' },
    { code: 'USNFK', name: '诺福克', flag: '🇺🇸' },
    { code: 'USHOU', name: '休斯顿', flag: '🇺🇸' },
    { code: 'CAVAN', name: '温哥华', flag: '🇨🇦' },
    { code: 'CATOR', name: '多伦多', flag: '🇨🇦' },
    { code: 'NLRTM', name: '鹿特丹', flag: '🇳🇱' },
    { code: 'DEHAM', name: '汉堡', flag: '🇩🇪' },
    { code: 'BEANR', name: '安特卫普', flag: '🇧🇪' },
    { code: 'GBFXT', name: '费力克斯托', flag: '🇬🇧' },
    { code: 'ITGOA', name: '热那亚', flag: '🇮🇹' },
    { code: 'ESVLC', name: '瓦伦西亚', flag: '🇪🇸' },
    { code: 'ESBCN', name: '巴塞罗那', flag: '🇪🇸' },
    { code: 'GRPIR', name: '比雷埃夫斯', flag: '🇬🇷' },
    { code: 'FRMRS', name: '马赛', flag: '🇫🇷' },
    { code: 'AESYD', name: '杰贝阿里', flag: '🇦🇪' },
    { code: 'SADMM', name: '达曼', flag: '🇸🇦' },
    { code: 'SAJED', name: '吉达', flag: '🇸🇦' },
    { code: 'AEKHI', name: '霍尔木兹', flag: '🇮🇷' },
    { code: 'INNSA', name: '那瓦舍瓦', flag: '🇮🇳' },
    { code: 'INMUN', name: '蒙德拉', flag: '🇮🇳' },
    { code: 'PKKHI', name: '卡拉奇', flag: '🇵🇰' },
    { code: 'LKCMB', name: '科伦坡', flag: '🇱🇰' },
    { code: 'BDCGP', name: '吉大港', flag: '🇧🇩' },
    { code: 'SGSIN', name: '新加坡', flag: '🇸🇬' },
    { code: 'MYPKG', name: '巴生港', flag: '🇲🇾' },
    { code: 'THBKK', name: '曼谷', flag: '🇹🇭' },
    { code: 'VNHCM', name: '胡志明', flag: '🇻🇳' },
    { code: 'PHMNL', name: '马尼拉', flag: '🇵🇭' },
    { code: 'IDJKT', name: '雅加达', flag: '🇮🇩' },
    { code: 'MYTPP', name: '丹绒帕拉帕斯', flag: '🇲🇾' },
    { code: 'KRPUS', name: '釜山', flag: '🇰🇷' },
    { code: 'JPTYO', name: '东京', flag: '🇯🇵' },
    { code: 'JPYOK', name: '横滨', flag: '🇯🇵' },
    { code: 'JPOSA', name: '大阪', flag: '🇯🇵' },
    { code: 'AUMEL', name: '墨尔本', flag: '🇦🇺' },
    { code: 'AUSYD', name: '悉尼', flag: '🇦🇺' },
    { code: 'AUBNE', name: '布里斯班', flag: '🇦🇺' },
    { code: 'NZAKL', name: '奥克兰', flag: '🇳🇿' },
    { code: 'BRSSZ', name: '桑托斯', flag: '🇧🇷' },
    { code: 'MXZLO', name: '曼萨尼约', flag: '🇲🇽' },
    { code: 'PECLL', name: '卡亚俄', flag: '🇵🇪' },
    { code: 'CLVAP', name: '瓦尔帕莱索', flag: '🇨🇱' },
    { code: 'ARBUE', name: '布宜诺斯艾利斯', flag: '🇦🇷' },
    { code: 'ZADUR', name: '德班', flag: '🇿🇦' },
    { code: 'NGLOS', name: '拉各斯', flag: '🇳🇬' },
    { code: 'ZACPT', name: '开普敦', flag: '🇿🇦' },
    { code: 'KEMBA', name: '蒙巴萨', flag: '🇰🇪' },
    { code: 'EGPSD', name: '塞得港', flag: '🇪🇬' },
  ],
  'CNNGB': [
    { code: 'USLAX', name: '洛杉矶', flag: '🇺🇸' },
    { code: 'USLGB', name: '长滩', flag: '🇺🇸' },
    { code: 'USOAK', name: '奥克兰', flag: '🇺🇸' },
    { code: 'USSEA', name: '西雅图', flag: '🇺🇸' },
    { code: 'USNYC', name: '纽约', flag: '🇺🇸' },
    { code: 'USSAV', name: '萨瓦纳', flag: '🇺🇸' },
    { code: 'USNFK', name: '诺福克', flag: '🇺🇸' },
    { code: 'USHOU', name: '休斯顿', flag: '🇺🇸' },
    { code: 'CAVAN', name: '温哥华', flag: '🇨🇦' },
    { code: 'CATOR', name: '多伦多', flag: '🇨🇦' },
    { code: 'NLRTM', name: '鹿特丹', flag: '🇳🇱' },
    { code: 'DEHAM', name: '汉堡', flag: '🇩🇪' },
    { code: 'BEANR', name: '安特卫普', flag: '🇧🇪' },
    { code: 'GBFXT', name: '费力克斯托', flag: '🇬🇧' },
    { code: 'ITGOA', name: '热那亚', flag: '🇮🇹' },
    { code: 'ESVLC', name: '瓦伦西亚', flag: '🇪🇸' },
    { code: 'ESBCN', name: '巴塞罗那', flag: '🇪🇸' },
    { code: 'GRPIR', name: '比雷埃夫斯', flag: '🇬🇷' },
    { code: 'FRMRS', name: '马赛', flag: '🇫🇷' },
    { code: 'AESYD', name: '杰贝阿里', flag: '🇦🇪' },
    { code: 'SADMM', name: '达曼', flag: '🇸🇦' },
    { code: 'SAJED', name: '吉达', flag: '🇸🇦' },
    { code: 'AEKHI', name: '霍尔木兹', flag: '🇮🇷' },
    { code: 'INNSA', name: '那瓦舍瓦', flag: '🇮🇳' },
    { code: 'INMUN', name: '蒙德拉', flag: '🇮🇳' },
    { code: 'PKKHI', name: '卡拉奇', flag: '🇵🇰' },
    { code: 'LKCMB', name: '科伦坡', flag: '🇱🇰' },
    { code: 'BDCGP', name: '吉大港', flag: '🇧🇩' },
    { code: 'SGSIN', name: '新加坡', flag: '🇸🇬' },
    { code: 'MYPKG', name: '巴生港', flag: '🇲🇾' },
    { code: 'THBKK', name: '曼谷', flag: '🇹🇭' },
    { code: 'VNHCM', name: '胡志明', flag: '🇻🇳' },
    { code: 'PHMNL', name: '马尼拉', flag: '🇵🇭' },
    { code: 'IDJKT', name: '雅加达', flag: '🇮🇩' },
    { code: 'MYTPP', name: '丹绒帕拉帕斯', flag: '🇲🇾' },
    { code: 'KRPUS', name: '釜山', flag: '🇰🇷' },
    { code: 'JPTYO', name: '东京', flag: '🇯🇵' },
    { code: 'JPYOK', name: '横滨', flag: '🇯🇵' },
    { code: 'JPOSA', name: '大阪', flag: '🇯🇵' },
    { code: 'AUMEL', name: '墨尔本', flag: '🇦🇺' },
    { code: 'AUSYD', name: '悉尼', flag: '🇦🇺' },
    { code: 'AUBNE', name: '布里斯班', flag: '🇦🇺' },
    { code: 'NZAKL', name: '奥克兰', flag: '🇳🇿' },
    { code: 'BRSSZ', name: '桑托斯', flag: '🇧🇷' },
    { code: 'MXZLO', name: '曼萨尼约', flag: '🇲🇽' },
    { code: 'PECLL', name: '卡亚俄', flag: '🇵🇪' },
    { code: 'CLVAP', name: '瓦尔帕莱索', flag: '🇨🇱' },
    { code: 'ARBUE', name: '布宜诺斯艾利斯', flag: '🇦🇷' },
    { code: 'ZADUR', name: '德班', flag: '🇿🇦' },
    { code: 'NGLOS', name: '拉各斯', flag: '🇳🇬' },
    { code: 'ZACPT', name: '开普敦', flag: '🇿🇦' },
    { code: 'KEMBA', name: '蒙巴萨', flag: '🇰🇪' },
    { code: 'EGPSD', name: '塞得港', flag: '🇪🇬' },
  ],
  'CNSZN': [
    { code: 'USLAX', name: '洛杉矶', flag: '🇺🇸' },
    { code: 'USLGB', name: '长滩', flag: '🇺🇸' },
    { code: 'USOAK', name: '奥克兰', flag: '🇺🇸' },
    { code: 'USSEA', name: '西雅图', flag: '🇺🇸' },
    { code: 'USNYC', name: '纽约', flag: '🇺🇸' },
    { code: 'USSAV', name: '萨瓦纳', flag: '🇺🇸' },
    { code: 'USNFK', name: '诺福克', flag: '🇺🇸' },
    { code: 'CAVAN', name: '温哥华', flag: '🇨🇦' },
    { code: 'NLRTM', name: '鹿特丹', flag: '🇳🇱' },
    { code: 'DEHAM', name: '汉堡', flag: '🇩🇪' },
    { code: 'BEANR', name: '安特卫普', flag: '🇧🇪' },
    { code: 'GBFXT', name: '费力克斯托', flag: '🇬🇧' },
    { code: 'ITGOA', name: '热那亚', flag: '🇮🇹' },
    { code: 'ESVLC', name: '瓦伦西亚', flag: '🇪🇸' },
    { code: 'ESBCN', name: '巴塞罗那', flag: '🇪🇸' },
    { code: 'GRPIR', name: '比雷埃夫斯', flag: '🇬🇷' },
    { code: 'FRMRS', name: '马赛', flag: '🇫🇷' },
    { code: 'AESYD', name: '杰贝阿里', flag: '🇦🇪' },
    { code: 'SADMM', name: '达曼', flag: '🇸🇦' },
    { code: 'SAJED', name: '吉达', flag: '🇸🇦' },
    { code: 'AEKHI', name: '霍尔木兹', flag: '🇮🇷' },
    { code: 'INNSA', name: '那瓦舍瓦', flag: '🇮🇳' },
    { code: 'INMUN', name: '蒙德拉', flag: '🇮🇳' },
    { code: 'PKKHI', name: '卡拉奇', flag: '🇵🇰' },
    { code: 'LKCMB', name: '科伦坡', flag: '🇱🇰' },
    { code: 'BDCGP', name: '吉大港', flag: '🇧🇩' },
    { code: 'SGSIN', name: '新加坡', flag: '🇸🇬' },
    { code: 'MYPKG', name: '巴生港', flag: '🇲🇾' },
    { code: 'THBKK', name: '曼谷', flag: '🇹🇭' },
    { code: 'VNHCM', name: '胡志明', flag: '🇻🇳' },
    { code: 'PHMNL', name: '马尼拉', flag: '🇵🇭' },
    { code: 'IDJKT', name: '雅加达', flag: '🇮🇩' },
    { code: 'MYTPP', name: '丹绒帕拉帕斯', flag: '🇲🇾' },
    { code: 'KRPUS', name: '釜山', flag: '🇰🇷' },
    { code: 'JPTYO', name: '东京', flag: '🇯🇵' },
    { code: 'JPYOK', name: '横滨', flag: '🇯🇵' },
    { code: 'JPOSA', name: '大阪', flag: '🇯🇵' },
    { code: 'AUMEL', name: '墨尔本', flag: '🇦🇺' },
    { code: 'AUSYD', name: '悉尼', flag: '🇦🇺' },
    { code: 'AUBNE', name: '布里斯班', flag: '🇦🇺' },
    { code: 'NZAKL', name: '奥克兰', flag: '🇳🇿' },
    { code: 'BRSSZ', name: '桑托斯', flag: '🇧🇷' },
    { code: 'MXZLO', name: '曼萨尼约', flag: '🇲🇽' },
    { code: 'PECLL', name: '卡亚俄', flag: '🇵🇪' },
    { code: 'CLVAP', name: '瓦尔帕莱索', flag: '🇨🇱' },
    { code: 'ARBUE', name: '布宜诺斯艾利斯', flag: '🇦🇷' },
    { code: 'ZADUR', name: '德班', flag: '🇿🇦' },
    { code: 'NGLOS', name: '拉各斯', flag: '🇳🇬' },
    { code: 'ZACPT', name: '开普敦', flag: '🇿🇦' },
    { code: 'KEMBA', name: '蒙巴萨', flag: '🇰🇪' },
    { code: 'EGPSD', name: '塞得港', flag: '🇪🇬' },
  ],
  'CNGZH': [
    { code: 'USLAX', name: '洛杉矶', flag: '🇺🇸' },
    { code: 'USLGB', name: '长滩', flag: '🇺🇸' },
    { code: 'USOAK', name: '奥克兰', flag: '🇺🇸' },
    { code: 'USSEA', name: '西雅图', flag: '🇺🇸' },
    { code: 'USNYC', name: '纽约', flag: '🇺🇸' },
    { code: 'USSAV', name: '萨瓦纳', flag: '🇺🇸' },
    { code: 'USNFK', name: '诺福克', flag: '🇺🇸' },
    { code: 'CAVAN', name: '温哥华', flag: '🇨🇦' },
    { code: 'NLRTM', name: '鹿特丹', flag: '🇳🇱' },
    { code: 'DEHAM', name: '汉堡', flag: '🇩🇪' },
    { code: 'BEANR', name: '安特卫普', flag: '🇧🇪' },
    { code: 'GBFXT', name: '费力克斯托', flag: '🇬🇧' },
    { code: 'ITGOA', name: '热那亚', flag: '🇮🇹' },
    { code: 'ESVLC', name: '瓦伦西亚', flag: '🇪🇸' },
    { code: 'ESBCN', name: '巴塞罗那', flag: '🇪🇸' },
    { code: 'GRPIR', name: '比雷埃夫斯', flag: '🇬🇷' },
    { code: 'FRMRS', name: '马赛', flag: '🇫🇷' },
    { code: 'AESYD', name: '杰贝阿里', flag: '🇦🇪' },
    { code: 'SADMM', name: '达曼', flag: '🇸🇦' },
    { code: 'SAJED', name: '吉达', flag: '🇸🇦' },
    { code: 'AEKHI', name: '霍尔木兹', flag: '🇮🇷' },
    { code: 'INNSA', name: '那瓦舍瓦', flag: '🇮🇳' },
    { code: 'INMUN', name: '蒙德拉', flag: '🇮🇳' },
    { code: 'PKKHI', name: '卡拉奇', flag: '🇵🇰' },
    { code: 'LKCMB', name: '科伦坡', flag: '🇱🇰' },
    { code: 'SGSIN', name: '新加坡', flag: '🇸🇬' },
    { code: 'MYPKG', name: '巴生港', flag: '🇲🇾' },
    { code: 'THBKK', name: '曼谷', flag: '🇹🇭' },
    { code: 'VNHCM', name: '胡志明', flag: '🇻🇳' },
    { code: 'PHMNL', name: '马尼拉', flag: '🇵🇭' },
    { code: 'IDJKT', name: '雅加达', flag: '🇮🇩' },
    { code: 'MYTPP', name: '丹绒帕拉帕斯', flag: '🇲🇾' },
    { code: 'KRPUS', name: '釜山', flag: '🇰🇷' },
    { code: 'JPTYO', name: '东京', flag: '🇯🇵' },
    { code: 'JPYOK', name: '横滨', flag: '🇯🇵' },
    { code: 'JPOSA', name: '大阪', flag: '🇯🇵' },
    { code: 'AUMEL', name: '墨尔本', flag: '🇦🇺' },
    { code: 'AUSYD', name: '悉尼', flag: '🇦🇺' },
    { code: 'AUBNE', name: '布里斯班', flag: '🇦🇺' },
    { code: 'NZAKL', name: '奥克兰', flag: '🇳🇿' },
    { code: 'BRSSZ', name: '桑托斯', flag: '🇧🇷' },
    { code: 'MXZLO', name: '曼萨尼约', flag: '🇲🇽' },
    { code: 'PECLL', name: '卡亚俄', flag: '🇵🇪' },
    { code: 'CLVAP', name: '瓦尔帕莱索', flag: '🇨🇱' },
    { code: 'ARBUE', name: '布宜诺斯艾利斯', flag: '🇦🇷' },
    { code: 'ZADUR', name: '德班', flag: '🇿🇦' },
    { code: 'NGLOS', name: '拉各斯', flag: '🇳🇬' },
    { code: 'ZACPT', name: '开普敦', flag: '🇿🇦' },
    { code: 'KEMBA', name: '蒙巴萨', flag: '🇰🇪' },
    { code: 'EGPSD', name: '塞得港', flag: '🇪🇬' },
  ],
  'CNQIN': [
    { code: 'USLAX', name: '洛杉矶', flag: '🇺🇸' },
    { code: 'USLGB', name: '长滩', flag: '🇺🇸' },
    { code: 'USOAK', name: '奥克兰', flag: '🇺🇸' },
    { code: 'USSEA', name: '西雅图', flag: '🇺🇸' },
    { code: 'USNYC', name: '纽约', flag: '🇺🇸' },
    { code: 'USSAV', name: '萨瓦纳', flag: '🇺🇸' },
    { code: 'USNFK', name: '诺福克', flag: '🇺🇸' },
    { code: 'USHOU', name: '休斯顿', flag: '🇺🇸' },
    { code: 'CAVAN', name: '温哥华', flag: '🇨🇦' },
    { code: 'CATOR', name: '多伦多', flag: '🇨🇦' },
    { code: 'NLRTM', name: '鹿特丹', flag: '🇳🇱' },
    { code: 'DEHAM', name: '汉堡', flag: '🇩🇪' },
    { code: 'BEANR', name: '安特卫普', flag: '🇧🇪' },
    { code: 'GBFXT', name: '费力克斯托', flag: '🇬🇧' },
    { code: 'ITGOA', name: '热那亚', flag: '🇮🇹' },
    { code: 'ESVLC', name: '瓦伦西亚', flag: '🇪🇸' },
    { code: 'ESBCN', name: '巴塞罗那', flag: '🇪🇸' },
    { code: 'GRPIR', name: '比雷埃夫斯', flag: '🇬🇷' },
    { code: 'AESYD', name: '杰贝阿里', flag: '🇦🇪' },
    { code: 'SADMM', name: '达曼', flag: '🇸🇦' },
    { code: 'SAJED', name: '吉达', flag: '🇸🇦' },
    { code: 'INNSA', name: '那瓦舍瓦', flag: '🇮🇳' },
    { code: 'INMUN', name: '蒙德拉', flag: '🇮🇳' },
    { code: 'PKKHI', name: '卡拉奇', flag: '🇵🇰' },
    { code: 'LKCMB', name: '科伦坡', flag: '🇱🇰' },
    { code: 'SGSIN', name: '新加坡', flag: '🇸🇬' },
    { code: 'MYPKG', name: '巴生港', flag: '🇲🇾' },
    { code: 'THBKK', name: '曼谷', flag: '🇹🇭' },
    { code: 'VNHCM', name: '胡志明', flag: '🇻🇳' },
    { code: 'PHMNL', name: '马尼拉', flag: '🇵🇭' },
    { code: 'IDJKT', name: '雅加达', flag: '🇮🇩' },
    { code: 'KRPUS', name: '釜山', flag: '🇰🇷' },
    { code: 'JPTYO', name: '东京', flag: '🇯🇵' },
    { code: 'JPYOK', name: '横滨', flag: '🇯🇵' },
    { code: 'JPOSA', name: '大阪', flag: '🇯🇵' },
    { code: 'AUMEL', name: '墨尔本', flag: '🇦🇺' },
    { code: 'AUSYD', name: '悉尼', flag: '🇦🇺' },
    { code: 'AUBNE', name: '布里斯班', flag: '🇦🇺' },
    { code: 'NZAKL', name: '奥克兰', flag: '🇳🇿' },
    { code: 'BRSSZ', name: '桑托斯', flag: '🇧🇷' },
    { code: 'MXZLO', name: '曼萨尼约', flag: '🇲🇽' },
    { code: 'PECLL', name: '卡亚俄', flag: '🇵🇪' },
    { code: 'CLVAP', name: '瓦尔帕莱索', flag: '🇨🇱' },
    { code: 'ARBUE', name: '布宜诺斯艾利斯', flag: '🇦🇷' },
    { code: 'ZADUR', name: '德班', flag: '🇿🇦' },
    { code: 'NGLOS', name: '拉各斯', flag: '🇳🇬' },
    { code: 'ZACPT', name: '开普敦', flag: '🇿🇦' },
    { code: 'KEMBA', name: '蒙巴萨', flag: '🇰🇪' },
    { code: 'EGPSD', name: '塞得港', flag: '🇪🇬' },
  ],
  'CNTSN': [
    { code: 'USLAX', name: '洛杉矶', flag: '🇺🇸' },
    { code: 'USLGB', name: '长滩', flag: '🇺🇸' },
    { code: 'USOAK', name: '奥克兰', flag: '🇺🇸' },
    { code: 'USSEA', name: '西雅图', flag: '🇺🇸' },
    { code: 'USNYC', name: '纽约', flag: '🇺🇸' },
    { code: 'USSAV', name: '萨瓦纳', flag: '🇺🇸' },
    { code: 'CAVAN', name: '温哥华', flag: '🇨🇦' },
    { code: 'NLRTM', name: '鹿特丹', flag: '🇳🇱' },
    { code: 'DEHAM', name: '汉堡', flag: '🇩🇪' },
    { code: 'BEANR', name: '安特卫普', flag: '🇧🇪' },
    { code: 'GBFXT', name: '费力克斯托', flag: '🇬🇧' },
    { code: 'ITGOA', name: '热那亚', flag: '🇮🇹' },
    { code: 'ESVLC', name: '瓦伦西亚', flag: '🇪🇸' },
    { code: 'ESBCN', name: '巴塞罗那', flag: '🇪🇸' },
    { code: 'AESYD', name: '杰贝阿里', flag: '🇦🇪' },
    { code: 'SAJED', name: '吉达', flag: '🇸🇦' },
    { code: 'INNSA', name: '那瓦舍瓦', flag: '🇮🇳' },
    { code: 'PKKHI', name: '卡拉奇', flag: '🇵🇰' },
    { code: 'SGSIN', name: '新加坡', flag: '🇸🇬' },
    { code: 'MYPKG', name: '巴生港', flag: '🇲🇾' },
    { code: 'THBKK', name: '曼谷', flag: '🇹🇭' },
    { code: 'VNHCM', name: '胡志明', flag: '🇻🇳' },
    { code: 'PHMNL', name: '马尼拉', flag: '🇵🇭' },
    { code: 'IDJKT', name: '雅加达', flag: '🇮🇩' },
    { code: 'KRPUS', name: '釜山', flag: '🇰🇷' },
    { code: 'JPTYO', name: '东京', flag: '🇯🇵' },
    { code: 'JPYOK', name: '横滨', flag: '🇯🇵' },
    { code: 'JPOSA', name: '大阪', flag: '🇯🇵' },
    { code: 'AUMEL', name: '墨尔本', flag: '🇦🇺' },
    { code: 'AUSYD', name: '悉尼', flag: '🇦🇺' },
    { code: 'BRSSZ', name: '桑托斯', flag: '🇧🇷' },
    { code: 'MXZLO', name: '曼萨尼约', flag: '🇲🇽' },
    { code: 'ZADUR', name: '德班', flag: '🇿🇦' },
    { code: 'NGLOS', name: '拉各斯', flag: '🇳🇬' },
    { code: 'EGPSD', name: '塞得港', flag: '🇪🇬' },
  ],
  'CNXMN': [
    { code: 'USLAX', name: '洛杉矶', flag: '🇺🇸' },
    { code: 'USLGB', name: '长滩', flag: '🇺🇸' },
    { code: 'USNYC', name: '纽约', flag: '🇺🇸' },
    { code: 'NLRTM', name: '鹿特丹', flag: '🇳🇱' },
    { code: 'DEHAM', name: '汉堡', flag: '🇩🇪' },
    { code: 'ITGOA', name: '热那亚', flag: '🇮🇹' },
    { code: 'AESYD', name: '杰贝阿里', flag: '🇦🇪' },
    { code: 'SGSIN', name: '新加坡', flag: '🇸🇬' },
    { code: 'MYPKG', name: '巴生港', flag: '🇲🇾' },
    { code: 'VNHCM', name: '胡志明', flag: '🇻🇳' },
    { code: 'PHMNL', name: '马尼拉', flag: '🇵🇭' },
    { code: 'IDJKT', name: '雅加达', flag: '🇮🇩' },
    { code: 'KRPUS', name: '釜山', flag: '🇰🇷' },
    { code: 'JPTYO', name: '东京', flag: '🇯🇵' },
    { code: 'JPOSA', name: '大阪', flag: '🇯🇵' },
    { code: 'AUMEL', name: '墨尔本', flag: '🇦🇺' },
    { code: 'AUSYD', name: '悉尼', flag: '🇦🇺' },
    { code: 'BRSSZ', name: '桑托斯', flag: '🇧🇷' },
    { code: 'ZADUR', name: '德班', flag: '🇿🇦' },
    { code: 'MYTPP', name: '丹绒帕拉帕斯', flag: '🇲🇾' },
    { code: 'THBKK', name: '曼谷', flag: '🇹🇭' },
  ],
  'HKHKG': [
    { code: 'USLAX', name: '洛杉矶', flag: '🇺🇸' },
    { code: 'USLGB', name: '长滩', flag: '🇺🇸' },
    { code: 'USOAK', name: '奥克兰', flag: '🇺🇸' },
    { code: 'USSEA', name: '西雅图', flag: '🇺🇸' },
    { code: 'USNYC', name: '纽约', flag: '🇺🇸' },
    { code: 'USSAV', name: '萨瓦纳', flag: '🇺🇸' },
    { code: 'USNFK', name: '诺福克', flag: '🇺🇸' },
    { code: 'USHOU', name: '休斯顿', flag: '🇺🇸' },
    { code: 'CAVAN', name: '温哥华', flag: '🇨🇦' },
    { code: 'NLRTM', name: '鹿特丹', flag: '🇳🇱' },
    { code: 'DEHAM', name: '汉堡', flag: '🇩🇪' },
    { code: 'BEANR', name: '安特卫普', flag: '🇧🇪' },
    { code: 'GBFXT', name: '费力克斯托', flag: '🇬🇧' },
    { code: 'ITGOA', name: '热那亚', flag: '🇮🇹' },
    { code: 'ESVLC', name: '瓦伦西亚', flag: '🇪🇸' },
    { code: 'ESBCN', name: '巴塞罗那', flag: '🇪🇸' },
    { code: 'GRPIR', name: '比雷埃夫斯', flag: '🇬🇷' },
    { code: 'FRMRS', name: '马赛', flag: '🇫🇷' },
    { code: 'AESYD', name: '杰贝阿里', flag: '🇦🇪' },
    { code: 'SADMM', name: '达曼', flag: '🇸🇦' },
    { code: 'SAJED', name: '吉达', flag: '🇸🇦' },
    { code: 'AEKHI', name: '霍尔木兹', flag: '🇮🇷' },
    { code: 'INNSA', name: '那瓦舍瓦', flag: '🇮🇳' },
    { code: 'INMUN', name: '蒙德拉', flag: '🇮🇳' },
    { code: 'PKKHI', name: '卡拉奇', flag: '🇵🇰' },
    { code: 'LKCMB', name: '科伦坡', flag: '🇱🇰' },
    { code: 'SGSIN', name: '新加坡', flag: '🇸🇬' },
    { code: 'MYPKG', name: '巴生港', flag: '🇲🇾' },
    { code: 'THBKK', name: '曼谷', flag: '🇹🇭' },
    { code: 'VNHCM', name: '胡志明', flag: '🇻🇳' },
    { code: 'PHMNL', name: '马尼拉', flag: '🇵🇭' },
    { code: 'IDJKT', name: '雅加达', flag: '🇮🇩' },
    { code: 'MYTPP', name: '丹绒帕拉帕斯', flag: '🇲🇾' },
    { code: 'KRPUS', name: '釜山', flag: '🇰🇷' },
    { code: 'JPTYO', name: '东京', flag: '🇯🇵' },
    { code: 'JPYOK', name: '横滨', flag: '🇯🇵' },
    { code: 'JPOSA', name: '大阪', flag: '🇯🇵' },
    { code: 'AUMEL', name: '墨尔本', flag: '🇦🇺' },
    { code: 'AUSYD', name: '悉尼', flag: '🇦🇺' },
    { code: 'AUBNE', name: '布里斯班', flag: '🇦🇺' },
    { code: 'NZAKL', name: '奥克兰', flag: '🇳🇿' },
    { code: 'BRSSZ', name: '桑托斯', flag: '🇧🇷' },
    { code: 'MXZLO', name: '曼萨尼约', flag: '🇲🇽' },
    { code: 'PECLL', name: '卡亚俄', flag: '🇵🇪' },
    { code: 'CLVAP', name: '瓦尔帕莱索', flag: '🇨🇱' },
    { code: 'ARBUE', name: '布宜诺斯艾利斯', flag: '🇦🇷' },
    { code: 'ZADUR', name: '德班', flag: '🇿🇦' },
    { code: 'NGLOS', name: '拉各斯', flag: '🇳🇬' },
    { code: 'ZACPT', name: '开普敦', flag: '🇿🇦' },
    { code: 'KEMBA', name: '蒙巴萨', flag: '🇰🇪' },
    { code: 'EGPSD', name: '塞得港', flag: '🇪🇬' },
  ]
};
const frOrigin = ref('CNSHA');
const frDest = ref('USLAX');
const frDestPorts = computed(() => frDestMap[frOrigin.value] || frDestMap['CNSHA']);
// 当起运港变化时，如果目的港不在可选列表里，重置
watch(frOrigin, (val) => {
  const dests = frDestMap[val] || [];
  if (!dests.find(d => d.code === frDest.value)) {
    frDest.value = dests[0]?.code || '';
  }
});
// 参考运价数据（基于Drewry WCI + Freightos FBX 2026年7月第三周基准）
// prices: 20gp/40gp/40hq
const FR_ROUTES = [
  { key:'CNSHA-USLAX', from:'CNSHA', to:'USLAX', fromFlag:'🇨🇳', fromName:'上海', toFlag:'🇺🇸', toName:'洛杉矶', name:'上海→洛杉矶(美西)', transit:14, trend:'up', prices:{'20gp':3450,'40gp':4900,'40hq':6270}, range:'淡季$4800-5800 / 旺季$7000-9000' },
  { key:'CNSHA-USLGB', from:'CNSHA', to:'USLGB', fromFlag:'🇨🇳', fromName:'上海', toFlag:'🇺🇸', toName:'长滩', name:'上海→长滩(美西)', transit:14, trend:'up', prices:{'20gp':3400,'40gp':4850,'40hq':6200}, range:'洛杉矶港邻港，价格略低' },
  { key:'CNSHA-USOAK', from:'CNSHA', to:'USOAK', fromFlag:'🇨🇳', fromName:'上海', toFlag:'🇺🇸', toName:'奥克兰', name:'上海→奥克兰(美西)', transit:16, trend:'up', prices:{'20gp':3500,'40gp':5000,'40hq':6400}, range:'' },
  { key:'CNSHA-USSEA', from:'CNSHA', to:'USSEA', fromFlag:'🇨🇳', fromName:'上海', toFlag:'🇺🇸', toName:'西雅图', name:'上海→西雅图(美西)', transit:17, trend:'up', prices:{'20gp':3600,'40gp':5050,'40hq':6500}, range:'PNW基本港' },
  { key:'CNSHA-USNYC', from:'CNSHA', to:'USNYC', fromFlag:'🇨🇳', fromName:'上海', toFlag:'🇺🇸', toName:'纽约', name:'上海→纽约(美东)', transit:28, trend:'stable', prices:{'20gp':4350,'40gp':6150,'40hq':7880}, range:'淡季$6500-7500 / 旺季$8500-10500' },
  { key:'CNSHA-USSAV', from:'CNSHA', to:'USSAV', fromFlag:'🇨🇳', fromName:'上海', toFlag:'🇺🇸', toName:'萨瓦纳', name:'上海→萨瓦纳(美东)', transit:30, trend:'stable', prices:{'20gp':4200,'40gp':5950,'40hq':7600}, range:'美东基本港，价格略低于NYC' },
  { key:'CNSHA-USNFK', from:'CNSHA', to:'USNFK', fromFlag:'🇨🇳', fromName:'上海', toFlag:'🇺🇸', toName:'诺福克', name:'上海→诺福克(美东)', transit:30, trend:'stable', prices:{'20gp':4250,'40gp':6050,'40hq':7750}, range:'' },
  { key:'CNSHA-USHOU', from:'CNSHA', to:'USHOU', fromFlag:'🇨🇳', fromName:'上海', toFlag:'🇺🇸', toName:'休斯顿', name:'上海→休斯顿(美湾)', transit:32, trend:'up', prices:{'20gp':4500,'40gp':6400,'40hq':8200}, range:'墨西哥湾航线，经巴拿马运河' },
  { key:'CNSHA-CAVAN', from:'CNSHA', to:'CAVAN', fromFlag:'🇨🇳', fromName:'上海', toFlag:'🇨🇦', toName:'温哥华', name:'上海→温哥华(美西)', transit:16, trend:'up', prices:{'20gp':3650,'40gp':5150,'40hq':6600}, range:'加拿大西岸基本港' },
  { key:'CNSHA-CATOR', from:'CNSHA', to:'CATOR', fromFlag:'🇨🇳', fromName:'上海', toFlag:'🇨🇦', toName:'多伦多', name:'上海→多伦多(美东)', transit:35, trend:'stable', prices:{'20gp':5050,'40gp':7200,'40hq':9200}, range:'经温哥华/王子港陆联运' },
  { key:'CNSHA-NLRTM', from:'CNSHA', to:'NLRTM', fromFlag:'🇨🇳', fromName:'上海', toFlag:'🇳🇱', toName:'鹿特丹', name:'上海→鹿特丹(北欧)', transit:32, trend:'stable', prices:{'20gp':2700,'40gp':3800,'40hq':4870}, range:'淡季$3800-4500 / 旺季$5500-7000' },
  { key:'CNSHA-DEHAM', from:'CNSHA', to:'DEHAM', fromFlag:'🇨🇳', fromName:'上海', toFlag:'🇩🇪', toName:'汉堡', name:'上海→汉堡(北欧)', transit:34, trend:'stable', prices:{'20gp':2700,'40gp':3850,'40hq':4950}, range:'$4000-5500' },
  { key:'CNSHA-BEANR', from:'CNSHA', to:'BEANR', fromFlag:'🇨🇳', fromName:'上海', toFlag:'🇧🇪', toName:'安特卫普', name:'上海→安特卫普(北欧)', transit:32, trend:'stable', prices:{'20gp':2650,'40gp':3800,'40hq':4850}, range:'与鹿特丹同价' },
  { key:'CNSHA-GBFXT', from:'CNSHA', to:'GBFXT', fromFlag:'🇨🇳', fromName:'上海', toFlag:'🇬🇧', toName:'费力克斯托', name:'上海→费力克斯托(北欧)', transit:30, trend:'stable', prices:{'20gp':2700,'40gp':3850,'40hq':4950}, range:'英国基本港' },
  { key:'CNSHA-ITGOA', from:'CNSHA', to:'ITGOA', fromFlag:'🇨🇳', fromName:'上海', toFlag:'🇮🇹', toName:'热那亚', name:'上海→热那亚(地中海)', transit:30, trend:'down', prices:{'20gp':3450,'40gp':4900,'40hq':6300}, range:'$5500-7000（绕行好望角）' },
  { key:'CNSHA-ESVLC', from:'CNSHA', to:'ESVLC', fromFlag:'🇨🇳', fromName:'上海', toFlag:'🇪🇸', toName:'瓦伦西亚', name:'上海→瓦伦西亚(地中海)', transit:28, trend:'down', prices:{'20gp':3300,'40gp':4700,'40hq':6000}, range:'西地中海基本港' },
  { key:'CNSHA-ESBCN', from:'CNSHA', to:'ESBCN', fromFlag:'🇨🇳', fromName:'上海', toFlag:'🇪🇸', toName:'巴塞罗那', name:'上海→巴塞罗那(地中海)', transit:29, trend:'down', prices:{'20gp':3350,'40gp':4750,'40hq':6100}, range:'' },
  { key:'CNSHA-GRPIR', from:'CNSHA', to:'GRPIR', fromFlag:'🇨🇳', fromName:'上海', toFlag:'🇬🇷', toName:'比雷埃夫斯', name:'上海→比雷埃夫斯(地中海)', transit:26, trend:'down', prices:{'20gp':3200,'40gp':4500,'40hq':5800}, range:'希腊中转枢纽，航程较短' },
  { key:'CNSHA-FRMRS', from:'CNSHA', to:'FRMRS', fromFlag:'🇨🇳', fromName:'上海', toFlag:'🇫🇷', toName:'马赛', name:'上海→马赛(地中海)', transit:29, trend:'down', prices:{'20gp':3350,'40gp':4700,'40hq':6050}, range:'' },
  { key:'CNSHA-AESYD', from:'CNSHA', to:'AESYD', fromFlag:'🇨🇳', fromName:'上海', toFlag:'🇦🇪', toName:'杰贝阿里', name:'上海→杰贝阿里(中东)', transit:18, trend:'up', prices:{'20gp':1750,'40gp':2500,'40hq':3200}, range:'$2500-3800，迪拜基本港' },
  { key:'CNSHA-SADMM', from:'CNSHA', to:'SADMM', fromFlag:'🇨🇳', fromName:'上海', toFlag:'🇸🇦', toName:'达曼', name:'上海→达曼(中东)', transit:20, trend:'up', prices:{'20gp':1800,'40gp':2550,'40hq':3300}, range:'沙特东岸基本港' },
  { key:'CNSHA-SAJED', from:'CNSHA', to:'SAJED', fromFlag:'🇨🇳', fromName:'上海', toFlag:'🇸🇦', toName:'吉达', name:'上海→吉达(红海)', transit:22, trend:'up', prices:{'20gp':2050,'40gp':2900,'40hq':3700}, range:'沙特红海基本港' },
  { key:'CNSHA-AEKHI', from:'CNSHA', to:'AEKHI', fromFlag:'🇨🇳', fromName:'上海', toFlag:'🇮🇷', toName:'霍尔木兹', name:'上海→霍尔木兹(中东)', transit:20, trend:'up', prices:{'20gp':1850,'40gp':2650,'40hq':3400}, range:'' },
  { key:'CNSHA-INNSA', from:'CNSHA', to:'INNSA', fromFlag:'🇨🇳', fromName:'上海', toFlag:'🇮🇳', toName:'那瓦舍瓦', name:'上海→那瓦舍瓦(印巴)', transit:20, trend:'stable', prices:{'20gp':1950,'40gp':2750,'40hq':3500}, range:'印度孟买新港，基本港' },
  { key:'CNSHA-INMUN', from:'CNSHA', to:'INMUN', fromFlag:'🇨🇳', fromName:'上海', toFlag:'🇮🇳', toName:'蒙德拉', name:'上海→蒙德拉(印巴)', transit:19, trend:'stable', prices:{'20gp':1850,'40gp':2650,'40hq':3400}, range:'印度西海岸' },
  { key:'CNSHA-PKKHI', from:'CNSHA', to:'PKKHI', fromFlag:'🇨🇳', fromName:'上海', toFlag:'🇵🇰', toName:'卡拉奇', name:'上海→卡拉奇(印巴)', transit:22, trend:'stable', prices:{'20gp':1800,'40gp':2550,'40hq':3300}, range:'巴基斯坦基本港' },
  { key:'CNSHA-LKCMB', from:'CNSHA', to:'LKCMB', fromFlag:'🇨🇳', fromName:'上海', toFlag:'🇱🇰', toName:'科伦坡', name:'上海→科伦坡(印巴)', transit:18, trend:'stable', prices:{'20gp':1550,'40gp':2200,'40hq':2800}, range:'南亚中转枢纽' },
  { key:'CNSHA-BDCGP', from:'CNSHA', to:'BDCGP', fromFlag:'🇨🇳', fromName:'上海', toFlag:'🇧🇩', toName:'吉大港', name:'上海→吉大港(印巴)', transit:24, trend:'up', prices:{'20gp':2100,'40gp':2950,'40hq':3800}, range:'孟加拉国基本港' },
  { key:'CNSHA-SGSIN', from:'CNSHA', to:'SGSIN', fromFlag:'🇨🇳', fromName:'上海', toFlag:'🇸🇬', toName:'新加坡', name:'上海→新加坡(东南亚)', transit:7, trend:'stable', prices:{'20gp':600,'40gp':850,'40hq':1100}, range:'近洋航线，价格稳定' },
  { key:'CNSHA-MYPKG', from:'CNSHA', to:'MYPKG', fromFlag:'🇨🇳', fromName:'上海', toFlag:'🇲🇾', toName:'巴生港', name:'上海→巴生港(东南亚)', transit:8, trend:'stable', prices:{'20gp':600,'40gp':800,'40hq':1050}, range:'马来西亚基本港' },
  { key:'CNSHA-THBKK', from:'CNSHA', to:'THBKK', fromFlag:'🇨🇳', fromName:'上海', toFlag:'🇹🇭', toName:'曼谷', name:'上海→曼谷(东南亚)', transit:9, trend:'stable', prices:{'20gp':650,'40gp':950,'40hq':1200}, range:'泰国林查班' },
  { key:'CNSHA-VNHCM', from:'CNSHA', to:'VNHCM', fromFlag:'🇨🇳', fromName:'上海', toFlag:'🇻🇳', toName:'胡志明', name:'上海→胡志明(东南亚)', transit:7, trend:'stable', prices:{'20gp':500,'40gp':700,'40hq':900}, range:'越南基本港' },
  { key:'CNSHA-PHMNL', from:'CNSHA', to:'PHMNL', fromFlag:'🇨🇳', fromName:'上海', toFlag:'🇵🇭', toName:'马尼拉', name:'上海→马尼拉(东南亚)', transit:5, trend:'stable', prices:{'20gp':450,'40gp':600,'40hq':800}, range:'菲律宾基本港' },
  { key:'CNSHA-IDJKT', from:'CNSHA', to:'IDJKT', fromFlag:'🇨🇳', fromName:'上海', toFlag:'🇮🇩', toName:'雅加达', name:'上海→雅加达(东南亚)', transit:10, trend:'stable', prices:{'20gp':700,'40gp':1000,'40hq':1300}, range:'印尼基本港' },
  { key:'CNSHA-MYTPP', from:'CNSHA', to:'MYTPP', fromFlag:'🇨🇳', fromName:'上海', toFlag:'🇲🇾', toName:'丹绒帕拉帕斯', name:'上海→丹绒帕拉帕斯(东南亚)', transit:9, trend:'stable', prices:{'20gp':550,'40gp':800,'40hq':1000}, range:'马来西亚新港' },
  { key:'CNSHA-KRPUS', from:'CNSHA', to:'KRPUS', fromFlag:'🇨🇳', fromName:'上海', toFlag:'🇰🇷', toName:'釜山', name:'上海→釜山(日韩)', transit:2, trend:'stable', prices:{'20gp':300,'40gp':400,'40hq':500}, range:'韩国基本港' },
  { key:'CNSHA-JPTYO', from:'CNSHA', to:'JPTYO', fromFlag:'🇨🇳', fromName:'上海', toFlag:'🇯🇵', toName:'东京', name:'上海→东京(日韩)', transit:4, trend:'stable', prices:{'20gp':400,'40gp':550,'40hq':700}, range:'日本关东基本港' },
  { key:'CNSHA-JPYOK', from:'CNSHA', to:'JPYOK', fromFlag:'🇨🇳', fromName:'上海', toFlag:'🇯🇵', toName:'横滨', name:'上海→横滨(日韩)', transit:4, trend:'stable', prices:{'20gp':400,'40gp':550,'40hq':720}, range:'' },
  { key:'CNSHA-JPOSA', from:'CNSHA', to:'JPOSA', fromFlag:'🇨🇳', fromName:'上海', toFlag:'🇯🇵', toName:'大阪', name:'上海→大阪(日韩)', transit:3, trend:'stable', prices:{'20gp':350,'40gp':550,'40hq':680}, range:'日本关西基本港' },
  { key:'CNSHA-AUMEL', from:'CNSHA', to:'AUMEL', fromFlag:'🇨🇳', fromName:'上海', toFlag:'🇦🇺', toName:'墨尔本', name:'上海→墨尔本(澳新)', transit:16, trend:'stable', prices:{'20gp':1550,'40gp':2200,'40hq':2800}, range:'$2200-3500' },
  { key:'CNSHA-AUSYD', from:'CNSHA', to:'AUSYD', fromFlag:'🇨🇳', fromName:'上海', toFlag:'🇦🇺', toName:'悉尼', name:'上海→悉尼(澳新)', transit:15, trend:'stable', prices:{'20gp':1600,'40gp':2250,'40hq':2900}, range:'' },
  { key:'CNSHA-AUBNE', from:'CNSHA', to:'AUBNE', fromFlag:'🇨🇳', fromName:'上海', toFlag:'🇦🇺', toName:'布里斯班', name:'上海→布里斯班(澳新)', transit:17, trend:'stable', prices:{'20gp':1550,'40gp':2200,'40hq':2850}, range:'' },
  { key:'CNSHA-NZAKL', from:'CNSHA', to:'NZAKL', fromFlag:'🇨🇳', fromName:'上海', toFlag:'🇳🇿', toName:'奥克兰', name:'上海→奥克兰(澳新)', transit:18, trend:'stable', prices:{'20gp':1700,'40gp':2400,'40hq':3100}, range:'新西兰基本港' },
  { key:'CNSHA-BRSSZ', from:'CNSHA', to:'BRSSZ', fromFlag:'🇨🇳', fromName:'上海', toFlag:'🇧🇷', toName:'桑托斯', name:'上海→桑托斯(南美东)', transit:38, trend:'up', prices:{'20gp':3600,'40gp':5050,'40hq':6500}, range:'$5500-7500' },
  { key:'CNSHA-MXZLO', from:'CNSHA', to:'MXZLO', fromFlag:'🇨🇳', fromName:'上海', toFlag:'🇲🇽', toName:'曼萨尼约', name:'上海→曼萨尼约(拉美)', transit:20, trend:'up', prices:{'20gp':2850,'40gp':4050,'40hq':5200}, range:'墨西哥西岸基本港' },
  { key:'CNSHA-PECLL', from:'CNSHA', to:'PECLL', fromFlag:'🇨🇳', fromName:'上海', toFlag:'🇵🇪', toName:'卡亚俄', name:'上海→卡亚俄(南美西)', transit:28, trend:'stable', prices:{'20gp':3050,'40gp':4300,'40hq':5500}, range:'秘鲁基本港' },
  { key:'CNSHA-CLVAP', from:'CNSHA', to:'CLVAP', fromFlag:'🇨🇳', fromName:'上海', toFlag:'🇨🇱', toName:'瓦尔帕莱索', name:'上海→瓦尔帕莱索(南美西)', transit:32, trend:'stable', prices:{'20gp':3100,'40gp':4350,'40hq':5600}, range:'智利基本港' },
  { key:'CNSHA-ARBUE', from:'CNSHA', to:'ARBUE', fromFlag:'🇨🇳', fromName:'上海', toFlag:'🇦🇷', toName:'布宜诺斯艾利斯', name:'上海→布宜诺斯艾利斯(南美东)', transit:40, trend:'up', prices:{'20gp':3750,'40gp':5300,'40hq':6800}, range:'阿根廷基本港' },
  { key:'CNSHA-ZADUR', from:'CNSHA', to:'ZADUR', fromFlag:'🇨🇳', fromName:'上海', toFlag:'🇿🇦', toName:'德班', name:'上海→德班(非洲)', transit:25, trend:'stable', prices:{'20gp':2500,'40gp':3500,'40hq':4500}, range:'$3800-5500' },
  { key:'CNSHA-NGLOS', from:'CNSHA', to:'NGLOS', fromFlag:'🇨🇳', fromName:'上海', toFlag:'🇳🇬', toName:'拉各斯', name:'上海→拉各斯(非洲)', transit:32, trend:'up', prices:{'20gp':3050,'40gp':4300,'40hq':5500}, range:'西非基本港（阿帕帕）' },
  { key:'CNSHA-ZACPT', from:'CNSHA', to:'ZACPT', fromFlag:'🇨🇳', fromName:'上海', toFlag:'🇿🇦', toName:'开普敦', name:'上海→开普敦(非洲)', transit:28, trend:'stable', prices:{'20gp':2350,'40gp':3350,'40hq':4300}, range:'南非' },
  { key:'CNSHA-KEMBA', from:'CNSHA', to:'KEMBA', fromFlag:'🇨🇳', fromName:'上海', toFlag:'🇰🇪', toName:'蒙巴萨', name:'上海→蒙巴萨(非洲)', transit:22, trend:'stable', prices:{'20gp':2200,'40gp':3100,'40hq':4000}, range:'东非基本港' },
  { key:'CNSHA-EGPSD', from:'CNSHA', to:'EGPSD', fromFlag:'🇨🇳', fromName:'上海', toFlag:'🇪🇬', toName:'塞得港', name:'上海→塞得港(地中海)', transit:23, trend:'stable', prices:{'20gp':2650,'40gp':3750,'40hq':4800}, range:'埃及地中海基本港' },
  { key:'CNNGB-USLAX', from:'CNNGB', to:'USLAX', fromFlag:'🇨🇳', fromName:'宁波', toFlag:'🇺🇸', toName:'洛杉矶', name:'宁波→洛杉矶(美西)', transit:15, trend:'up', prices:{'20gp':3400,'40gp':4850,'40hq':6200}, range:'淡季$4800-5800 / 旺季$7000-9000' },
  { key:'CNNGB-USLGB', from:'CNNGB', to:'USLGB', fromFlag:'🇨🇳', fromName:'宁波', toFlag:'🇺🇸', toName:'长滩', name:'宁波→长滩(美西)', transit:15, trend:'up', prices:{'20gp':3350,'40gp':4750,'40hq':6100}, range:'洛杉矶港邻港，价格略低' },
  { key:'CNNGB-USOAK', from:'CNNGB', to:'USOAK', fromFlag:'🇨🇳', fromName:'宁波', toFlag:'🇺🇸', toName:'奥克兰', name:'宁波→奥克兰(美西)', transit:17, trend:'up', prices:{'20gp':3450,'40gp':4900,'40hq':6300}, range:'' },
  { key:'CNNGB-USSEA', from:'CNNGB', to:'USSEA', fromFlag:'🇨🇳', fromName:'宁波', toFlag:'🇺🇸', toName:'西雅图', name:'宁波→西雅图(美西)', transit:18, trend:'up', prices:{'20gp':3500,'40gp':5000,'40hq':6400}, range:'PNW基本港' },
  { key:'CNNGB-USNYC', from:'CNNGB', to:'USNYC', fromFlag:'🇨🇳', fromName:'宁波', toFlag:'🇺🇸', toName:'纽约', name:'宁波→纽约(美东)', transit:29, trend:'stable', prices:{'20gp':4250,'40gp':6050,'40hq':7750}, range:'淡季$6500-7500 / 旺季$8500-10500' },
  { key:'CNNGB-USSAV', from:'CNNGB', to:'USSAV', fromFlag:'🇨🇳', fromName:'宁波', toFlag:'🇺🇸', toName:'萨瓦纳', name:'宁波→萨瓦纳(美东)', transit:31, trend:'stable', prices:{'20gp':4100,'40gp':5850,'40hq':7500}, range:'美东基本港，价格略低于NYC' },
  { key:'CNNGB-USNFK', from:'CNNGB', to:'USNFK', fromFlag:'🇨🇳', fromName:'宁波', toFlag:'🇺🇸', toName:'诺福克', name:'宁波→诺福克(美东)', transit:31, trend:'stable', prices:{'20gp':4200,'40gp':5950,'40hq':7650}, range:'' },
  { key:'CNNGB-USHOU', from:'CNNGB', to:'USHOU', fromFlag:'🇨🇳', fromName:'宁波', toFlag:'🇺🇸', toName:'休斯顿', name:'宁波→休斯顿(美湾)', transit:33, trend:'up', prices:{'20gp':4450,'40gp':6300,'40hq':8100}, range:'墨西哥湾航线，经巴拿马运河' },
  { key:'CNNGB-CAVAN', from:'CNNGB', to:'CAVAN', fromFlag:'🇨🇳', fromName:'宁波', toFlag:'🇨🇦', toName:'温哥华', name:'宁波→温哥华(美西)', transit:17, trend:'up', prices:{'20gp':3600,'40gp':5050,'40hq':6500}, range:'加拿大西岸基本港' },
  { key:'CNNGB-CATOR', from:'CNNGB', to:'CATOR', fromFlag:'🇨🇳', fromName:'宁波', toFlag:'🇨🇦', toName:'多伦多', name:'宁波→多伦多(美东)', transit:36, trend:'stable', prices:{'20gp':5000,'40gp':7050,'40hq':9050}, range:'经温哥华/王子港陆联运' },
  { key:'CNNGB-NLRTM', from:'CNNGB', to:'NLRTM', fromFlag:'🇨🇳', fromName:'宁波', toFlag:'🇳🇱', toName:'鹿特丹', name:'宁波→鹿特丹(北欧)', transit:33, trend:'stable', prices:{'20gp':2650,'40gp':3750,'40hq':4800}, range:'淡季$3800-4500 / 旺季$5500-7000' },
  { key:'CNNGB-DEHAM', from:'CNNGB', to:'DEHAM', fromFlag:'🇨🇳', fromName:'宁波', toFlag:'🇩🇪', toName:'汉堡', name:'宁波→汉堡(北欧)', transit:35, trend:'stable', prices:{'20gp':2700,'40gp':3800,'40hq':4900}, range:'$4000-5500' },
  { key:'CNNGB-BEANR', from:'CNNGB', to:'BEANR', fromFlag:'🇨🇳', fromName:'宁波', toFlag:'🇧🇪', toName:'安特卫普', name:'宁波→安特卫普(北欧)', transit:33, trend:'stable', prices:{'20gp':2650,'40gp':3750,'40hq':4800}, range:'与鹿特丹同价' },
  { key:'CNNGB-GBFXT', from:'CNNGB', to:'GBFXT', fromFlag:'🇨🇳', fromName:'宁波', toFlag:'🇬🇧', toName:'费力克斯托', name:'宁波→费力克斯托(北欧)', transit:31, trend:'stable', prices:{'20gp':2700,'40gp':3800,'40hq':4900}, range:'英国基本港' },
  { key:'CNNGB-ITGOA', from:'CNNGB', to:'ITGOA', fromFlag:'🇨🇳', fromName:'宁波', toFlag:'🇮🇹', toName:'热那亚', name:'宁波→热那亚(地中海)', transit:31, trend:'down', prices:{'20gp':3400,'40gp':4850,'40hq':6200}, range:'$5500-7000（绕行好望角）' },
  { key:'CNNGB-ESVLC', from:'CNNGB', to:'ESVLC', fromFlag:'🇨🇳', fromName:'宁波', toFlag:'🇪🇸', toName:'瓦伦西亚', name:'宁波→瓦伦西亚(地中海)', transit:29, trend:'down', prices:{'20gp':3250,'40gp':4600,'40hq':5900}, range:'西地中海基本港' },
  { key:'CNNGB-ESBCN', from:'CNNGB', to:'ESBCN', fromFlag:'🇨🇳', fromName:'宁波', toFlag:'🇪🇸', toName:'巴塞罗那', name:'宁波→巴塞罗那(地中海)', transit:30, trend:'down', prices:{'20gp':3300,'40gp':4700,'40hq':6000}, range:'' },
  { key:'CNNGB-GRPIR', from:'CNNGB', to:'GRPIR', fromFlag:'🇨🇳', fromName:'宁波', toFlag:'🇬🇷', toName:'比雷埃夫斯', name:'宁波→比雷埃夫斯(地中海)', transit:27, trend:'down', prices:{'20gp':3150,'40gp':4450,'40hq':5700}, range:'希腊中转枢纽，航程较短' },
  { key:'CNNGB-FRMRS', from:'CNNGB', to:'FRMRS', fromFlag:'🇨🇳', fromName:'宁波', toFlag:'🇫🇷', toName:'马赛', name:'宁波→马赛(地中海)', transit:30, trend:'down', prices:{'20gp':3250,'40gp':4650,'40hq':5950}, range:'' },
  { key:'CNNGB-AESYD', from:'CNNGB', to:'AESYD', fromFlag:'🇨🇳', fromName:'宁波', toFlag:'🇦🇪', toName:'杰贝阿里', name:'宁波→杰贝阿里(中东)', transit:19, trend:'up', prices:{'20gp':1750,'40gp':2450,'40hq':3150}, range:'$2500-3800，迪拜基本港' },
  { key:'CNNGB-SADMM', from:'CNNGB', to:'SADMM', fromFlag:'🇨🇳', fromName:'宁波', toFlag:'🇸🇦', toName:'达曼', name:'宁波→达曼(中东)', transit:21, trend:'up', prices:{'20gp':1800,'40gp':2550,'40hq':3250}, range:'沙特东岸基本港' },
  { key:'CNNGB-SAJED', from:'CNNGB', to:'SAJED', fromFlag:'🇨🇳', fromName:'宁波', toFlag:'🇸🇦', toName:'吉达', name:'宁波→吉达(红海)', transit:23, trend:'up', prices:{'20gp':2000,'40gp':2850,'40hq':3650}, range:'沙特红海基本港' },
  { key:'CNNGB-AEKHI', from:'CNNGB', to:'AEKHI', fromFlag:'🇨🇳', fromName:'宁波', toFlag:'🇮🇷', toName:'霍尔木兹', name:'宁波→霍尔木兹(中东)', transit:21, trend:'up', prices:{'20gp':1850,'40gp':2600,'40hq':3350}, range:'' },
  { key:'CNNGB-INNSA', from:'CNNGB', to:'INNSA', fromFlag:'🇨🇳', fromName:'宁波', toFlag:'🇮🇳', toName:'那瓦舍瓦', name:'宁波→那瓦舍瓦(印巴)', transit:21, trend:'stable', prices:{'20gp':1900,'40gp':2700,'40hq':3450}, range:'印度孟买新港，基本港' },
  { key:'CNNGB-INMUN', from:'CNNGB', to:'INMUN', fromFlag:'🇨🇳', fromName:'宁波', toFlag:'🇮🇳', toName:'蒙德拉', name:'宁波→蒙德拉(印巴)', transit:20, trend:'stable', prices:{'20gp':1850,'40gp':2600,'40hq':3350}, range:'印度西海岸' },
  { key:'CNNGB-PKKHI', from:'CNNGB', to:'PKKHI', fromFlag:'🇨🇳', fromName:'宁波', toFlag:'🇵🇰', toName:'卡拉奇', name:'宁波→卡拉奇(印巴)', transit:23, trend:'stable', prices:{'20gp':1800,'40gp':2550,'40hq':3250}, range:'巴基斯坦基本港' },
  { key:'CNNGB-LKCMB', from:'CNNGB', to:'LKCMB', fromFlag:'🇨🇳', fromName:'宁波', toFlag:'🇱🇰', toName:'科伦坡', name:'宁波→科伦坡(印巴)', transit:19, trend:'stable', prices:{'20gp':1500,'40gp':2150,'40hq':2750}, range:'南亚中转枢纽' },
  { key:'CNNGB-BDCGP', from:'CNNGB', to:'BDCGP', fromFlag:'🇨🇳', fromName:'宁波', toFlag:'🇧🇩', toName:'吉大港', name:'宁波→吉大港(印巴)', transit:25, trend:'up', prices:{'20gp':2050,'40gp':2900,'40hq':3750}, range:'孟加拉国基本港' },
  { key:'CNNGB-SGSIN', from:'CNNGB', to:'SGSIN', fromFlag:'🇨🇳', fromName:'宁波', toFlag:'🇸🇬', toName:'新加坡', name:'宁波→新加坡(东南亚)', transit:8, trend:'stable', prices:{'20gp':600,'40gp':850,'40hq':1080}, range:'近洋航线，价格稳定' },
  { key:'CNNGB-MYPKG', from:'CNNGB', to:'MYPKG', fromFlag:'🇨🇳', fromName:'宁波', toFlag:'🇲🇾', toName:'巴生港', name:'宁波→巴生港(东南亚)', transit:9, trend:'stable', prices:{'20gp':600,'40gp':800,'40hq':1050}, range:'马来西亚基本港' },
  { key:'CNNGB-THBKK', from:'CNNGB', to:'THBKK', fromFlag:'🇨🇳', fromName:'宁波', toFlag:'🇹🇭', toName:'曼谷', name:'宁波→曼谷(东南亚)', transit:10, trend:'stable', prices:{'20gp':650,'40gp':900,'40hq':1180}, range:'泰国林查班' },
  { key:'CNNGB-VNHCM', from:'CNNGB', to:'VNHCM', fromFlag:'🇨🇳', fromName:'宁波', toFlag:'🇻🇳', toName:'胡志明', name:'宁波→胡志明(东南亚)', transit:8, trend:'stable', prices:{'20gp':500,'40gp':700,'40hq':880}, range:'越南基本港' },
  { key:'CNNGB-PHMNL', from:'CNNGB', to:'PHMNL', fromFlag:'🇨🇳', fromName:'宁波', toFlag:'🇵🇭', toName:'马尼拉', name:'宁波→马尼拉(东南亚)', transit:6, trend:'stable', prices:{'20gp':450,'40gp':600,'40hq':780}, range:'菲律宾基本港' },
  { key:'CNNGB-IDJKT', from:'CNNGB', to:'IDJKT', fromFlag:'🇨🇳', fromName:'宁波', toFlag:'🇮🇩', toName:'雅加达', name:'宁波→雅加达(东南亚)', transit:11, trend:'stable', prices:{'20gp':700,'40gp':1000,'40hq':1280}, range:'印尼基本港' },
  { key:'CNNGB-MYTPP', from:'CNNGB', to:'MYTPP', fromFlag:'🇨🇳', fromName:'宁波', toFlag:'🇲🇾', toName:'丹绒帕拉帕斯', name:'宁波→丹绒帕拉帕斯(东南亚)', transit:10, trend:'stable', prices:{'20gp':550,'40gp':800,'40hq':1000}, range:'马来西亚新港' },
  { key:'CNNGB-KRPUS', from:'CNNGB', to:'KRPUS', fromFlag:'🇨🇳', fromName:'宁波', toFlag:'🇰🇷', toName:'釜山', name:'宁波→釜山(日韩)', transit:3, trend:'stable', prices:{'20gp':250,'40gp':350,'40hq':450}, range:'韩国基本港' },
  { key:'CNNGB-JPTYO', from:'CNNGB', to:'JPTYO', fromFlag:'🇨🇳', fromName:'宁波', toFlag:'🇯🇵', toName:'东京', name:'宁波→东京(日韩)', transit:5, trend:'stable', prices:{'20gp':350,'40gp':500,'40hq':650}, range:'日本关东基本港' },
  { key:'CNNGB-JPYOK', from:'CNNGB', to:'JPYOK', fromFlag:'🇨🇳', fromName:'宁波', toFlag:'🇯🇵', toName:'横滨', name:'宁波→横滨(日韩)', transit:5, trend:'stable', prices:{'20gp':350,'40gp':500,'40hq':670}, range:'' },
  { key:'CNNGB-JPOSA', from:'CNNGB', to:'JPOSA', fromFlag:'🇨🇳', fromName:'宁波', toFlag:'🇯🇵', toName:'大阪', name:'宁波→大阪(日韩)', transit:4, trend:'stable', prices:{'20gp':350,'40gp':500,'40hq':630}, range:'日本关西基本港' },
  { key:'CNNGB-AUMEL', from:'CNNGB', to:'AUMEL', fromFlag:'🇨🇳', fromName:'宁波', toFlag:'🇦🇺', toName:'墨尔本', name:'宁波→墨尔本(澳新)', transit:17, trend:'stable', prices:{'20gp':1500,'40gp':2150,'40hq':2750}, range:'$2200-3500' },
  { key:'CNNGB-AUSYD', from:'CNNGB', to:'AUSYD', fromFlag:'🇨🇳', fromName:'宁波', toFlag:'🇦🇺', toName:'悉尼', name:'宁波→悉尼(澳新)', transit:16, trend:'stable', prices:{'20gp':1550,'40gp':2200,'40hq':2850}, range:'' },
  { key:'CNNGB-AUBNE', from:'CNNGB', to:'AUBNE', fromFlag:'🇨🇳', fromName:'宁波', toFlag:'🇦🇺', toName:'布里斯班', name:'宁波→布里斯班(澳新)', transit:18, trend:'stable', prices:{'20gp':1550,'40gp':2200,'40hq':2800}, range:'' },
  { key:'CNNGB-NZAKL', from:'CNNGB', to:'NZAKL', fromFlag:'🇨🇳', fromName:'宁波', toFlag:'🇳🇿', toName:'奥克兰', name:'宁波→奥克兰(澳新)', transit:19, trend:'stable', prices:{'20gp':1700,'40gp':2400,'40hq':3050}, range:'新西兰基本港' },
  { key:'CNNGB-BRSSZ', from:'CNNGB', to:'BRSSZ', fromFlag:'🇨🇳', fromName:'宁波', toFlag:'🇧🇷', toName:'桑托斯', name:'宁波→桑托斯(南美东)', transit:39, trend:'up', prices:{'20gp':3500,'40gp':5000,'40hq':6400}, range:'$5500-7500' },
  { key:'CNNGB-MXZLO', from:'CNNGB', to:'MXZLO', fromFlag:'🇨🇳', fromName:'宁波', toFlag:'🇲🇽', toName:'曼萨尼约', name:'宁波→曼萨尼约(拉美)', transit:21, trend:'up', prices:{'20gp':2800,'40gp':4000,'40hq':5100}, range:'墨西哥西岸基本港' },
  { key:'CNNGB-PECLL', from:'CNNGB', to:'PECLL', fromFlag:'🇨🇳', fromName:'宁波', toFlag:'🇵🇪', toName:'卡亚俄', name:'宁波→卡亚俄(南美西)', transit:29, trend:'stable', prices:{'20gp':2950,'40gp':4200,'40hq':5400}, range:'秘鲁基本港' },
  { key:'CNNGB-CLVAP', from:'CNNGB', to:'CLVAP', fromFlag:'🇨🇳', fromName:'宁波', toFlag:'🇨🇱', toName:'瓦尔帕莱索', name:'宁波→瓦尔帕莱索(南美西)', transit:33, trend:'stable', prices:{'20gp':3050,'40gp':4300,'40hq':5500}, range:'智利基本港' },
  { key:'CNNGB-ARBUE', from:'CNNGB', to:'ARBUE', fromFlag:'🇨🇳', fromName:'宁波', toFlag:'🇦🇷', toName:'布宜诺斯艾利斯', name:'宁波→布宜诺斯艾利斯(南美东)', transit:41, trend:'up', prices:{'20gp':3700,'40gp':5250,'40hq':6700}, range:'阿根廷基本港' },
  { key:'CNNGB-ZADUR', from:'CNNGB', to:'ZADUR', fromFlag:'🇨🇳', fromName:'宁波', toFlag:'🇿🇦', toName:'德班', name:'宁波→德班(非洲)', transit:26, trend:'stable', prices:{'20gp':2450,'40gp':3450,'40hq':4450}, range:'$3800-5500' },
  { key:'CNNGB-NGLOS', from:'CNNGB', to:'NGLOS', fromFlag:'🇨🇳', fromName:'宁波', toFlag:'🇳🇬', toName:'拉各斯', name:'宁波→拉各斯(非洲)', transit:33, trend:'up', prices:{'20gp':2950,'40gp':4200,'40hq':5400}, range:'西非基本港（阿帕帕）' },
  { key:'CNNGB-ZACPT', from:'CNNGB', to:'ZACPT', fromFlag:'🇨🇳', fromName:'宁波', toFlag:'🇿🇦', toName:'开普敦', name:'宁波→开普敦(非洲)', transit:29, trend:'stable', prices:{'20gp':2350,'40gp':3300,'40hq':4250}, range:'南非' },
  { key:'CNNGB-KEMBA', from:'CNNGB', to:'KEMBA', fromFlag:'🇨🇳', fromName:'宁波', toFlag:'🇰🇪', toName:'蒙巴萨', name:'宁波→蒙巴萨(非洲)', transit:23, trend:'stable', prices:{'20gp':2150,'40gp':3100,'40hq':3950}, range:'东非基本港' },
  { key:'CNNGB-EGPSD', from:'CNNGB', to:'EGPSD', fromFlag:'🇨🇳', fromName:'宁波', toFlag:'🇪🇬', toName:'塞得港', name:'宁波→塞得港(地中海)', transit:24, trend:'stable', prices:{'20gp':2600,'40gp':3700,'40hq':4750}, range:'埃及地中海基本港' },
  { key:'CNSZN-USLAX', from:'CNSZN', to:'USLAX', fromFlag:'🇨🇳', fromName:'深圳', toFlag:'🇺🇸', toName:'洛杉矶', name:'深圳→洛杉矶(美西)', transit:15, trend:'up', prices:{'20gp':3400,'40gp':4850,'40hq':6200}, range:'淡季$4800-5800 / 旺季$7000-9000' },
  { key:'CNSZN-USLGB', from:'CNSZN', to:'USLGB', fromFlag:'🇨🇳', fromName:'深圳', toFlag:'🇺🇸', toName:'长滩', name:'深圳→长滩(美西)', transit:15, trend:'up', prices:{'20gp':3400,'40gp':4800,'40hq':6150}, range:'洛杉矶港邻港，价格略低' },
  { key:'CNSZN-USOAK', from:'CNSZN', to:'USOAK', fromFlag:'🇨🇳', fromName:'深圳', toFlag:'🇺🇸', toName:'奥克兰', name:'深圳→奥克兰(美西)', transit:17, trend:'up', prices:{'20gp':3500,'40gp':4950,'40hq':6350}, range:'' },
  { key:'CNSZN-USSEA', from:'CNSZN', to:'USSEA', fromFlag:'🇨🇳', fromName:'深圳', toFlag:'🇺🇸', toName:'西雅图', name:'深圳→西雅图(美西)', transit:18, trend:'up', prices:{'20gp':3550,'40gp':5050,'40hq':6450}, range:'PNW基本港' },
  { key:'CNSZN-USNYC', from:'CNSZN', to:'USNYC', fromFlag:'🇨🇳', fromName:'深圳', toFlag:'🇺🇸', toName:'纽约', name:'深圳→纽约(美东)', transit:29, trend:'stable', prices:{'20gp':4300,'40gp':6100,'40hq':7800}, range:'淡季$6500-7500 / 旺季$8500-10500' },
  { key:'CNSZN-USSAV', from:'CNSZN', to:'USSAV', fromFlag:'🇨🇳', fromName:'深圳', toFlag:'🇺🇸', toName:'萨瓦纳', name:'深圳→萨瓦纳(美东)', transit:31, trend:'stable', prices:{'20gp':4100,'40gp':5850,'40hq':7500}, range:'美东基本港，价格略低于NYC' },
  { key:'CNSZN-USNFK', from:'CNSZN', to:'USNFK', fromFlag:'🇨🇳', fromName:'深圳', toFlag:'🇺🇸', toName:'诺福克', name:'深圳→诺福克(美东)', transit:31, trend:'stable', prices:{'20gp':4200,'40gp':5950,'40hq':7650}, range:'' },
  { key:'CNSZN-CAVAN', from:'CNSZN', to:'CAVAN', fromFlag:'🇨🇳', fromName:'深圳', toFlag:'🇨🇦', toName:'温哥华', name:'深圳→温哥华(美西)', transit:17, trend:'up', prices:{'20gp':3600,'40gp':5100,'40hq':6550}, range:'加拿大西岸基本港' },
  { key:'CNSZN-NLRTM', from:'CNSZN', to:'NLRTM', fromFlag:'🇨🇳', fromName:'深圳', toFlag:'🇳🇱', toName:'鹿特丹', name:'深圳→鹿特丹(北欧)', transit:33, trend:'stable', prices:{'20gp':2650,'40gp':3750,'40hq':4800}, range:'淡季$3800-4500 / 旺季$5500-7000' },
  { key:'CNSZN-DEHAM', from:'CNSZN', to:'DEHAM', fromFlag:'🇨🇳', fromName:'深圳', toFlag:'🇩🇪', toName:'汉堡', name:'深圳→汉堡(北欧)', transit:35, trend:'stable', prices:{'20gp':2700,'40gp':3800,'40hq':4900}, range:'$4000-5500' },
  { key:'CNSZN-BEANR', from:'CNSZN', to:'BEANR', fromFlag:'🇨🇳', fromName:'深圳', toFlag:'🇧🇪', toName:'安特卫普', name:'深圳→安特卫普(北欧)', transit:33, trend:'stable', prices:{'20gp':2650,'40gp':3750,'40hq':4800}, range:'与鹿特丹同价' },
  { key:'CNSZN-GBFXT', from:'CNSZN', to:'GBFXT', fromFlag:'🇨🇳', fromName:'深圳', toFlag:'🇬🇧', toName:'费力克斯托', name:'深圳→费力克斯托(北欧)', transit:31, trend:'stable', prices:{'20gp':2700,'40gp':3800,'40hq':4900}, range:'英国基本港' },
  { key:'CNSZN-ITGOA', from:'CNSZN', to:'ITGOA', fromFlag:'🇨🇳', fromName:'深圳', toFlag:'🇮🇹', toName:'热那亚', name:'深圳→热那亚(地中海)', transit:31, trend:'down', prices:{'20gp':3450,'40gp':4900,'40hq':6250}, range:'$5500-7000（绕行好望角）' },
  { key:'CNSZN-ESVLC', from:'CNSZN', to:'ESVLC', fromFlag:'🇨🇳', fromName:'深圳', toFlag:'🇪🇸', toName:'瓦伦西亚', name:'深圳→瓦伦西亚(地中海)', transit:29, trend:'down', prices:{'20gp':3250,'40gp':4650,'40hq':5950}, range:'西地中海基本港' },
  { key:'CNSZN-ESBCN', from:'CNSZN', to:'ESBCN', fromFlag:'🇨🇳', fromName:'深圳', toFlag:'🇪🇸', toName:'巴塞罗那', name:'深圳→巴塞罗那(地中海)', transit:30, trend:'down', prices:{'20gp':3350,'40gp':4700,'40hq':6050}, range:'' },
  { key:'CNSZN-GRPIR', from:'CNSZN', to:'GRPIR', fromFlag:'🇨🇳', fromName:'深圳', toFlag:'🇬🇷', toName:'比雷埃夫斯', name:'深圳→比雷埃夫斯(地中海)', transit:27, trend:'down', prices:{'20gp':3150,'40gp':4500,'40hq':5750}, range:'希腊中转枢纽，航程较短' },
  { key:'CNSZN-FRMRS', from:'CNSZN', to:'FRMRS', fromFlag:'🇨🇳', fromName:'深圳', toFlag:'🇫🇷', toName:'马赛', name:'深圳→马赛(地中海)', transit:30, trend:'down', prices:{'20gp':3300,'40gp':4700,'40hq':6000}, range:'' },
  { key:'CNSZN-AESYD', from:'CNSZN', to:'AESYD', fromFlag:'🇨🇳', fromName:'深圳', toFlag:'🇦🇪', toName:'杰贝阿里', name:'深圳→杰贝阿里(中东)', transit:19, trend:'up', prices:{'20gp':1750,'40gp':2450,'40hq':3150}, range:'$2500-3800，迪拜基本港' },
  { key:'CNSZN-SADMM', from:'CNSZN', to:'SADMM', fromFlag:'🇨🇳', fromName:'深圳', toFlag:'🇸🇦', toName:'达曼', name:'深圳→达曼(中东)', transit:21, trend:'up', prices:{'20gp':1800,'40gp':2550,'40hq':3250}, range:'沙特东岸基本港' },
  { key:'CNSZN-SAJED', from:'CNSZN', to:'SAJED', fromFlag:'🇨🇳', fromName:'深圳', toFlag:'🇸🇦', toName:'吉达', name:'深圳→吉达(红海)', transit:23, trend:'up', prices:{'20gp':2000,'40gp':2850,'40hq':3650}, range:'沙特红海基本港' },
  { key:'CNSZN-AEKHI', from:'CNSZN', to:'AEKHI', fromFlag:'🇨🇳', fromName:'深圳', toFlag:'🇮🇷', toName:'霍尔木兹', name:'深圳→霍尔木兹(中东)', transit:21, trend:'up', prices:{'20gp':1850,'40gp':2600,'40hq':3350}, range:'' },
  { key:'CNSZN-INNSA', from:'CNSZN', to:'INNSA', fromFlag:'🇨🇳', fromName:'深圳', toFlag:'🇮🇳', toName:'那瓦舍瓦', name:'深圳→那瓦舍瓦(印巴)', transit:21, trend:'stable', prices:{'20gp':1900,'40gp':2700,'40hq':3450}, range:'印度孟买新港，基本港' },
  { key:'CNSZN-INMUN', from:'CNSZN', to:'INMUN', fromFlag:'🇨🇳', fromName:'深圳', toFlag:'🇮🇳', toName:'蒙德拉', name:'深圳→蒙德拉(印巴)', transit:20, trend:'stable', prices:{'20gp':1850,'40gp':2600,'40hq':3350}, range:'印度西海岸' },
  { key:'CNSZN-PKKHI', from:'CNSZN', to:'PKKHI', fromFlag:'🇨🇳', fromName:'深圳', toFlag:'🇵🇰', toName:'卡拉奇', name:'深圳→卡拉奇(印巴)', transit:23, trend:'stable', prices:{'20gp':1800,'40gp':2550,'40hq':3250}, range:'巴基斯坦基本港' },
  { key:'CNSZN-LKCMB', from:'CNSZN', to:'LKCMB', fromFlag:'🇨🇳', fromName:'深圳', toFlag:'🇱🇰', toName:'科伦坡', name:'深圳→科伦坡(印巴)', transit:19, trend:'stable', prices:{'20gp':1500,'40gp':2150,'40hq':2750}, range:'南亚中转枢纽' },
  { key:'CNSZN-BDCGP', from:'CNSZN', to:'BDCGP', fromFlag:'🇨🇳', fromName:'深圳', toFlag:'🇧🇩', toName:'吉大港', name:'深圳→吉大港(印巴)', transit:25, trend:'up', prices:{'20gp':2050,'40gp':2900,'40hq':3750}, range:'孟加拉国基本港' },
  { key:'CNSZN-SGSIN', from:'CNSZN', to:'SGSIN', fromFlag:'🇨🇳', fromName:'深圳', toFlag:'🇸🇬', toName:'新加坡', name:'深圳→新加坡(东南亚)', transit:5, trend:'stable', prices:{'20gp':450,'40gp':650,'40hq':850}, range:'近洋' },
  { key:'CNSZN-MYPKG', from:'CNSZN', to:'MYPKG', fromFlag:'🇨🇳', fromName:'深圳', toFlag:'🇲🇾', toName:'巴生港', name:'深圳→巴生港(东南亚)', transit:6, trend:'stable', prices:{'20gp':450,'40gp':600,'40hq':800}, range:'马来西亚基本港' },
  { key:'CNSZN-THBKK', from:'CNSZN', to:'THBKK', fromFlag:'🇨🇳', fromName:'深圳', toFlag:'🇹🇭', toName:'曼谷', name:'深圳→曼谷(东南亚)', transit:7, trend:'stable', prices:{'20gp':500,'40gp':750,'40hq':950}, range:'泰国林查班' },
  { key:'CNSZN-VNHCM', from:'CNSZN', to:'VNHCM', fromFlag:'🇨🇳', fromName:'深圳', toFlag:'🇻🇳', toName:'胡志明', name:'深圳→胡志明(东南亚)', transit:4, trend:'stable', prices:{'20gp':350,'40gp':500,'40hq':650}, range:'越南基本港' },
  { key:'CNSZN-PHMNL', from:'CNSZN', to:'PHMNL', fromFlag:'🇨🇳', fromName:'深圳', toFlag:'🇵🇭', toName:'马尼拉', name:'深圳→马尼拉(东南亚)', transit:3, trend:'stable', prices:{'20gp':350,'40gp':450,'40hq':600}, range:'菲律宾基本港' },
  { key:'CNSZN-IDJKT', from:'CNSZN', to:'IDJKT', fromFlag:'🇨🇳', fromName:'深圳', toFlag:'🇮🇩', toName:'雅加达', name:'深圳→雅加达(东南亚)', transit:8, trend:'stable', prices:{'20gp':550,'40gp':800,'40hq':1000}, range:'印尼基本港' },
  { key:'CNSZN-MYTPP', from:'CNSZN', to:'MYTPP', fromFlag:'🇨🇳', fromName:'深圳', toFlag:'🇲🇾', toName:'丹绒帕拉帕斯', name:'深圳→丹绒帕拉帕斯(东南亚)', transit:10, trend:'stable', prices:{'20gp':550,'40gp':800,'40hq':1000}, range:'马来西亚新港' },
  { key:'CNSZN-KRPUS', from:'CNSZN', to:'KRPUS', fromFlag:'🇨🇳', fromName:'深圳', toFlag:'🇰🇷', toName:'釜山', name:'深圳→釜山(日韩)', transit:4, trend:'stable', prices:{'20gp':300,'40gp':450,'40hq':550}, range:'韩国基本港' },
  { key:'CNSZN-JPTYO', from:'CNSZN', to:'JPTYO', fromFlag:'🇨🇳', fromName:'深圳', toFlag:'🇯🇵', toName:'东京', name:'深圳→东京(日韩)', transit:6, trend:'stable', prices:{'20gp':400,'40gp':600,'40hq':750}, range:'日本关东基本港' },
  { key:'CNSZN-JPYOK', from:'CNSZN', to:'JPYOK', fromFlag:'🇨🇳', fromName:'深圳', toFlag:'🇯🇵', toName:'横滨', name:'深圳→横滨(日韩)', transit:6, trend:'stable', prices:{'20gp':450,'40gp':600,'40hq':780}, range:'' },
  { key:'CNSZN-JPOSA', from:'CNSZN', to:'JPOSA', fromFlag:'🇨🇳', fromName:'深圳', toFlag:'🇯🇵', toName:'大阪', name:'深圳→大阪(日韩)', transit:5, trend:'stable', prices:{'20gp':400,'40gp':550,'40hq':720}, range:'日本关西基本港' },
  { key:'CNSZN-AUMEL', from:'CNSZN', to:'AUMEL', fromFlag:'🇨🇳', fromName:'深圳', toFlag:'🇦🇺', toName:'墨尔本', name:'深圳→墨尔本(澳新)', transit:17, trend:'stable', prices:{'20gp':1500,'40gp':2150,'40hq':2750}, range:'$2200-3500' },
  { key:'CNSZN-AUSYD', from:'CNSZN', to:'AUSYD', fromFlag:'🇨🇳', fromName:'深圳', toFlag:'🇦🇺', toName:'悉尼', name:'深圳→悉尼(澳新)', transit:16, trend:'stable', prices:{'20gp':1550,'40gp':2200,'40hq':2850}, range:'' },
  { key:'CNSZN-AUBNE', from:'CNSZN', to:'AUBNE', fromFlag:'🇨🇳', fromName:'深圳', toFlag:'🇦🇺', toName:'布里斯班', name:'深圳→布里斯班(澳新)', transit:18, trend:'stable', prices:{'20gp':1550,'40gp':2200,'40hq':2800}, range:'' },
  { key:'CNSZN-NZAKL', from:'CNSZN', to:'NZAKL', fromFlag:'🇨🇳', fromName:'深圳', toFlag:'🇳🇿', toName:'奥克兰', name:'深圳→奥克兰(澳新)', transit:19, trend:'stable', prices:{'20gp':1700,'40gp':2400,'40hq':3050}, range:'新西兰基本港' },
  { key:'CNSZN-BRSSZ', from:'CNSZN', to:'BRSSZ', fromFlag:'🇨🇳', fromName:'深圳', toFlag:'🇧🇷', toName:'桑托斯', name:'深圳→桑托斯(南美东)', transit:39, trend:'up', prices:{'20gp':3550,'40gp':5050,'40hq':6450}, range:'$5500-7500' },
  { key:'CNSZN-MXZLO', from:'CNSZN', to:'MXZLO', fromFlag:'🇨🇳', fromName:'深圳', toFlag:'🇲🇽', toName:'曼萨尼约', name:'深圳→曼萨尼约(拉美)', transit:21, trend:'up', prices:{'20gp':2850,'40gp':4000,'40hq':5150}, range:'墨西哥西岸基本港' },
  { key:'CNSZN-PECLL', from:'CNSZN', to:'PECLL', fromFlag:'🇨🇳', fromName:'深圳', toFlag:'🇵🇪', toName:'卡亚俄', name:'深圳→卡亚俄(南美西)', transit:29, trend:'stable', prices:{'20gp':3000,'40gp':4250,'40hq':5450}, range:'秘鲁基本港' },
  { key:'CNSZN-CLVAP', from:'CNSZN', to:'CLVAP', fromFlag:'🇨🇳', fromName:'深圳', toFlag:'🇨🇱', toName:'瓦尔帕莱索', name:'深圳→瓦尔帕莱索(南美西)', transit:33, trend:'stable', prices:{'20gp':3050,'40gp':4350,'40hq':5550}, range:'智利基本港' },
  { key:'CNSZN-ARBUE', from:'CNSZN', to:'ARBUE', fromFlag:'🇨🇳', fromName:'深圳', toFlag:'🇦🇷', toName:'布宜诺斯艾利斯', name:'深圳→布宜诺斯艾利斯(南美东)', transit:41, trend:'up', prices:{'20gp':3700,'40gp':5250,'40hq':6750}, range:'阿根廷基本港' },
  { key:'CNSZN-ZADUR', from:'CNSZN', to:'ZADUR', fromFlag:'🇨🇳', fromName:'深圳', toFlag:'🇿🇦', toName:'德班', name:'深圳→德班(非洲)', transit:26, trend:'stable', prices:{'20gp':2450,'40gp':3450,'40hq':4450}, range:'$3800-5500' },
  { key:'CNSZN-NGLOS', from:'CNSZN', to:'NGLOS', fromFlag:'🇨🇳', fromName:'深圳', toFlag:'🇳🇬', toName:'拉各斯', name:'深圳→拉各斯(非洲)', transit:33, trend:'up', prices:{'20gp':3000,'40gp':4250,'40hq':5450}, range:'西非基本港（阿帕帕）' },
  { key:'CNSZN-ZACPT', from:'CNSZN', to:'ZACPT', fromFlag:'🇨🇳', fromName:'深圳', toFlag:'🇿🇦', toName:'开普敦', name:'深圳→开普敦(非洲)', transit:29, trend:'stable', prices:{'20gp':2350,'40gp':3300,'40hq':4250}, range:'南非' },
  { key:'CNSZN-KEMBA', from:'CNSZN', to:'KEMBA', fromFlag:'🇨🇳', fromName:'深圳', toFlag:'🇰🇪', toName:'蒙巴萨', name:'深圳→蒙巴萨(非洲)', transit:23, trend:'stable', prices:{'20gp':2150,'40gp':3100,'40hq':3950}, range:'东非基本港' },
  { key:'CNSZN-EGPSD', from:'CNSZN', to:'EGPSD', fromFlag:'🇨🇳', fromName:'深圳', toFlag:'🇪🇬', toName:'塞得港', name:'深圳→塞得港(地中海)', transit:24, trend:'stable', prices:{'20gp':2600,'40gp':3700,'40hq':4750}, range:'埃及地中海基本港' },
  { key:'CNGZH-USLAX', from:'CNGZH', to:'USLAX', fromFlag:'🇨🇳', fromName:'广州', toFlag:'🇺🇸', toName:'洛杉矶', name:'广州→洛杉矶(美西)', transit:16, trend:'up', prices:{'20gp':3350,'40gp':4750,'40hq':6100}, range:'淡季$4800-5800 / 旺季$7000-9000' },
  { key:'CNGZH-USLGB', from:'CNGZH', to:'USLGB', fromFlag:'🇨🇳', fromName:'广州', toFlag:'🇺🇸', toName:'长滩', name:'广州→长滩(美西)', transit:16, trend:'up', prices:{'20gp':3350,'40gp':4700,'40hq':6050}, range:'洛杉矶港邻港，价格略低' },
  { key:'CNGZH-USOAK', from:'CNGZH', to:'USOAK', fromFlag:'🇨🇳', fromName:'广州', toFlag:'🇺🇸', toName:'奥克兰', name:'广州→奥克兰(美西)', transit:18, trend:'up', prices:{'20gp':3450,'40gp':4900,'40hq':6250}, range:'' },
  { key:'CNGZH-USSEA', from:'CNGZH', to:'USSEA', fromFlag:'🇨🇳', fromName:'广州', toFlag:'🇺🇸', toName:'西雅图', name:'广州→西雅图(美西)', transit:19, trend:'up', prices:{'20gp':3500,'40gp':4950,'40hq':6350}, range:'PNW基本港' },
  { key:'CNGZH-USNYC', from:'CNGZH', to:'USNYC', fromFlag:'🇨🇳', fromName:'广州', toFlag:'🇺🇸', toName:'纽约', name:'广州→纽约(美东)', transit:30, trend:'stable', prices:{'20gp':4250,'40gp':6000,'40hq':7700}, range:'淡季$6500-7500 / 旺季$8500-10500' },
  { key:'CNGZH-USSAV', from:'CNGZH', to:'USSAV', fromFlag:'🇨🇳', fromName:'广州', toFlag:'🇺🇸', toName:'萨瓦纳', name:'广州→萨瓦纳(美东)', transit:32, trend:'stable', prices:{'20gp':4050,'40gp':5750,'40hq':7400}, range:'美东基本港，价格略低于NYC' },
  { key:'CNGZH-USNFK', from:'CNGZH', to:'USNFK', fromFlag:'🇨🇳', fromName:'广州', toFlag:'🇺🇸', toName:'诺福克', name:'广州→诺福克(美东)', transit:32, trend:'stable', prices:{'20gp':4150,'40gp':5900,'40hq':7550}, range:'' },
  { key:'CNGZH-CAVAN', from:'CNGZH', to:'CAVAN', fromFlag:'🇨🇳', fromName:'广州', toFlag:'🇨🇦', toName:'温哥华', name:'广州→温哥华(美西)', transit:18, trend:'up', prices:{'20gp':3550,'40gp':5050,'40hq':6450}, range:'加拿大西岸基本港' },
  { key:'CNGZH-NLRTM', from:'CNGZH', to:'NLRTM', fromFlag:'🇨🇳', fromName:'广州', toFlag:'🇳🇱', toName:'鹿特丹', name:'广州→鹿特丹(北欧)', transit:34, trend:'stable', prices:{'20gp':2600,'40gp':3700,'40hq':4750}, range:'淡季$3800-4500 / 旺季$5500-7000' },
  { key:'CNGZH-DEHAM', from:'CNGZH', to:'DEHAM', fromFlag:'🇨🇳', fromName:'广州', toFlag:'🇩🇪', toName:'汉堡', name:'广州→汉堡(北欧)', transit:36, trend:'stable', prices:{'20gp':2650,'40gp':3800,'40hq':4850}, range:'$4000-5500' },
  { key:'CNGZH-BEANR', from:'CNGZH', to:'BEANR', fromFlag:'🇨🇳', fromName:'广州', toFlag:'🇧🇪', toName:'安特卫普', name:'广州→安特卫普(北欧)', transit:34, trend:'stable', prices:{'20gp':2600,'40gp':3700,'40hq':4750}, range:'与鹿特丹同价' },
  { key:'CNGZH-GBFXT', from:'CNGZH', to:'GBFXT', fromFlag:'🇨🇳', fromName:'广州', toFlag:'🇬🇧', toName:'费力克斯托', name:'广州→费力克斯托(北欧)', transit:32, trend:'stable', prices:{'20gp':2650,'40gp':3800,'40hq':4850}, range:'英国基本港' },
  { key:'CNGZH-ITGOA', from:'CNGZH', to:'ITGOA', fromFlag:'🇨🇳', fromName:'广州', toFlag:'🇮🇹', toName:'热那亚', name:'广州→热那亚(地中海)', transit:32, trend:'down', prices:{'20gp':3400,'40gp':4800,'40hq':6150}, range:'$5500-7000（绕行好望角）' },
  { key:'CNGZH-ESVLC', from:'CNGZH', to:'ESVLC', fromFlag:'🇨🇳', fromName:'广州', toFlag:'🇪🇸', toName:'瓦伦西亚', name:'广州→瓦伦西亚(地中海)', transit:30, trend:'down', prices:{'20gp':3200,'40gp':4550,'40hq':5850}, range:'西地中海基本港' },
  { key:'CNGZH-ESBCN', from:'CNGZH', to:'ESBCN', fromFlag:'🇨🇳', fromName:'广州', toFlag:'🇪🇸', toName:'巴塞罗那', name:'广州→巴塞罗那(地中海)', transit:31, trend:'down', prices:{'20gp':3250,'40gp':4650,'40hq':5950}, range:'' },
  { key:'CNGZH-GRPIR', from:'CNGZH', to:'GRPIR', fromFlag:'🇨🇳', fromName:'广州', toFlag:'🇬🇷', toName:'比雷埃夫斯', name:'广州→比雷埃夫斯(地中海)', transit:28, trend:'down', prices:{'20gp':3100,'40gp':4400,'40hq':5650}, range:'希腊中转枢纽，航程较短' },
  { key:'CNGZH-FRMRS', from:'CNGZH', to:'FRMRS', fromFlag:'🇨🇳', fromName:'广州', toFlag:'🇫🇷', toName:'马赛', name:'广州→马赛(地中海)', transit:31, trend:'down', prices:{'20gp':3250,'40gp':4600,'40hq':5900}, range:'' },
  { key:'CNGZH-AESYD', from:'CNGZH', to:'AESYD', fromFlag:'🇨🇳', fromName:'广州', toFlag:'🇦🇪', toName:'杰贝阿里', name:'广州→杰贝阿里(中东)', transit:20, trend:'up', prices:{'20gp':1700,'40gp':2400,'40hq':3100}, range:'$2500-3800，迪拜基本港' },
  { key:'CNGZH-SADMM', from:'CNGZH', to:'SADMM', fromFlag:'🇨🇳', fromName:'广州', toFlag:'🇸🇦', toName:'达曼', name:'广州→达曼(中东)', transit:22, trend:'up', prices:{'20gp':1750,'40gp':2500,'40hq':3200}, range:'沙特东岸基本港' },
  { key:'CNGZH-SAJED', from:'CNGZH', to:'SAJED', fromFlag:'🇨🇳', fromName:'广州', toFlag:'🇸🇦', toName:'吉达', name:'广州→吉达(红海)', transit:24, trend:'up', prices:{'20gp':2000,'40gp':2800,'40hq':3600}, range:'沙特红海基本港' },
  { key:'CNGZH-AEKHI', from:'CNGZH', to:'AEKHI', fromFlag:'🇨🇳', fromName:'广州', toFlag:'🇮🇷', toName:'霍尔木兹', name:'广州→霍尔木兹(中东)', transit:22, trend:'up', prices:{'20gp':1800,'40gp':2550,'40hq':3300}, range:'' },
  { key:'CNGZH-INNSA', from:'CNGZH', to:'INNSA', fromFlag:'🇨🇳', fromName:'广州', toFlag:'🇮🇳', toName:'那瓦舍瓦', name:'广州→那瓦舍瓦(印巴)', transit:22, trend:'stable', prices:{'20gp':1850,'40gp':2650,'40hq':3400}, range:'印度孟买新港，基本港' },
  { key:'CNGZH-INMUN', from:'CNGZH', to:'INMUN', fromFlag:'🇨🇳', fromName:'广州', toFlag:'🇮🇳', toName:'蒙德拉', name:'广州→蒙德拉(印巴)', transit:21, trend:'stable', prices:{'20gp':1800,'40gp':2550,'40hq':3300}, range:'印度西海岸' },
  { key:'CNGZH-PKKHI', from:'CNGZH', to:'PKKHI', fromFlag:'🇨🇳', fromName:'广州', toFlag:'🇵🇰', toName:'卡拉奇', name:'广州→卡拉奇(印巴)', transit:24, trend:'stable', prices:{'20gp':1750,'40gp':2500,'40hq':3200}, range:'巴基斯坦基本港' },
  { key:'CNGZH-LKCMB', from:'CNGZH', to:'LKCMB', fromFlag:'🇨🇳', fromName:'广州', toFlag:'🇱🇰', toName:'科伦坡', name:'广州→科伦坡(印巴)', transit:20, trend:'stable', prices:{'20gp':1500,'40gp':2150,'40hq':2750}, range:'南亚中转枢纽' },
  { key:'CNGZH-SGSIN', from:'CNGZH', to:'SGSIN', fromFlag:'🇨🇳', fromName:'广州', toFlag:'🇸🇬', toName:'新加坡', name:'广州→新加坡(东南亚)', transit:6, trend:'stable', prices:{'20gp':500,'40gp':700,'40hq':880}, range:'近洋航线，价格稳定' },
  { key:'CNGZH-MYPKG', from:'CNGZH', to:'MYPKG', fromFlag:'🇨🇳', fromName:'广州', toFlag:'🇲🇾', toName:'巴生港', name:'广州→巴生港(东南亚)', transit:7, trend:'stable', prices:{'20gp':450,'40gp':650,'40hq':830}, range:'马来西亚基本港' },
  { key:'CNGZH-THBKK', from:'CNGZH', to:'THBKK', fromFlag:'🇨🇳', fromName:'广州', toFlag:'🇹🇭', toName:'曼谷', name:'广州→曼谷(东南亚)', transit:8, trend:'stable', prices:{'20gp':550,'40gp':750,'40hq':980}, range:'泰国林查班' },
  { key:'CNGZH-VNHCM', from:'CNGZH', to:'VNHCM', fromFlag:'🇨🇳', fromName:'广州', toFlag:'🇻🇳', toName:'胡志明', name:'广州→胡志明(东南亚)', transit:5, trend:'stable', prices:{'20gp':350,'40gp':550,'40hq':680}, range:'越南基本港' },
  { key:'CNGZH-PHMNL', from:'CNGZH', to:'PHMNL', fromFlag:'🇨🇳', fromName:'广州', toFlag:'🇵🇭', toName:'马尼拉', name:'广州→马尼拉(东南亚)', transit:4, trend:'stable', prices:{'20gp':350,'40gp':500,'40hq':620}, range:'菲律宾基本港' },
  { key:'CNGZH-IDJKT', from:'CNGZH', to:'IDJKT', fromFlag:'🇨🇳', fromName:'广州', toFlag:'🇮🇩', toName:'雅加达', name:'广州→雅加达(东南亚)', transit:9, trend:'stable', prices:{'20gp':600,'40gp':800,'40hq':1050}, range:'印尼基本港' },
  { key:'CNGZH-MYTPP', from:'CNGZH', to:'MYTPP', fromFlag:'🇨🇳', fromName:'广州', toFlag:'🇲🇾', toName:'丹绒帕拉帕斯', name:'广州→丹绒帕拉帕斯(东南亚)', transit:11, trend:'stable', prices:{'20gp':550,'40gp':800,'40hq':1000}, range:'马来西亚新港' },
  { key:'CNGZH-KRPUS', from:'CNGZH', to:'KRPUS', fromFlag:'🇨🇳', fromName:'广州', toFlag:'🇰🇷', toName:'釜山', name:'广州→釜山(日韩)', transit:5, trend:'stable', prices:{'20gp':350,'40gp':450,'40hq':600}, range:'韩国基本港' },
  { key:'CNGZH-JPTYO', from:'CNGZH', to:'JPTYO', fromFlag:'🇨🇳', fromName:'广州', toFlag:'🇯🇵', toName:'东京', name:'广州→东京(日韩)', transit:7, trend:'stable', prices:{'20gp':450,'40gp':600,'40hq':800}, range:'日本关东基本港' },
  { key:'CNGZH-JPYOK', from:'CNGZH', to:'JPYOK', fromFlag:'🇨🇳', fromName:'广州', toFlag:'🇯🇵', toName:'横滨', name:'广州→横滨(日韩)', transit:7, trend:'stable', prices:{'20gp':450,'40gp':650,'40hq':830}, range:'' },
  { key:'CNGZH-JPOSA', from:'CNGZH', to:'JPOSA', fromFlag:'🇨🇳', fromName:'广州', toFlag:'🇯🇵', toName:'大阪', name:'广州→大阪(日韩)', transit:6, trend:'stable', prices:{'20gp':400,'40gp':600,'40hq':770}, range:'日本关西基本港' },
  { key:'CNGZH-AUMEL', from:'CNGZH', to:'AUMEL', fromFlag:'🇨🇳', fromName:'广州', toFlag:'🇦🇺', toName:'墨尔本', name:'广州→墨尔本(澳新)', transit:18, trend:'stable', prices:{'20gp':1500,'40gp':2150,'40hq':2750}, range:'$2200-3500' },
  { key:'CNGZH-AUSYD', from:'CNGZH', to:'AUSYD', fromFlag:'🇨🇳', fromName:'广州', toFlag:'🇦🇺', toName:'悉尼', name:'广州→悉尼(澳新)', transit:17, trend:'stable', prices:{'20gp':1550,'40gp':2200,'40hq':2850}, range:'' },
  { key:'CNGZH-AUBNE', from:'CNGZH', to:'AUBNE', fromFlag:'🇨🇳', fromName:'广州', toFlag:'🇦🇺', toName:'布里斯班', name:'广州→布里斯班(澳新)', transit:19, trend:'stable', prices:{'20gp':1550,'40gp':2200,'40hq':2800}, range:'' },
  { key:'CNGZH-NZAKL', from:'CNGZH', to:'NZAKL', fromFlag:'🇨🇳', fromName:'广州', toFlag:'🇳🇿', toName:'奥克兰', name:'广州→奥克兰(澳新)', transit:20, trend:'stable', prices:{'20gp':1650,'40gp':2350,'40hq':3000}, range:'新西兰基本港' },
  { key:'CNGZH-BRSSZ', from:'CNGZH', to:'BRSSZ', fromFlag:'🇨🇳', fromName:'广州', toFlag:'🇧🇷', toName:'桑托斯', name:'广州→桑托斯(南美东)', transit:40, trend:'up', prices:{'20gp':3500,'40gp':4950,'40hq':6350}, range:'$5500-7500' },
  { key:'CNGZH-MXZLO', from:'CNGZH', to:'MXZLO', fromFlag:'🇨🇳', fromName:'广州', toFlag:'🇲🇽', toName:'曼萨尼约', name:'广州→曼萨尼约(拉美)', transit:22, trend:'up', prices:{'20gp':2800,'40gp':3950,'40hq':5050}, range:'墨西哥西岸基本港' },
  { key:'CNGZH-PECLL', from:'CNGZH', to:'PECLL', fromFlag:'🇨🇳', fromName:'广州', toFlag:'🇵🇪', toName:'卡亚俄', name:'广州→卡亚俄(南美西)', transit:30, trend:'stable', prices:{'20gp':2950,'40gp':4150,'40hq':5350}, range:'秘鲁基本港' },
  { key:'CNGZH-CLVAP', from:'CNGZH', to:'CLVAP', fromFlag:'🇨🇳', fromName:'广州', toFlag:'🇨🇱', toName:'瓦尔帕莱索', name:'广州→瓦尔帕莱索(南美西)', transit:34, trend:'stable', prices:{'20gp':3000,'40gp':4250,'40hq':5450}, range:'智利基本港' },
  { key:'CNGZH-ARBUE', from:'CNGZH', to:'ARBUE', fromFlag:'🇨🇳', fromName:'广州', toFlag:'🇦🇷', toName:'布宜诺斯艾利斯', name:'广州→布宜诺斯艾利斯(南美东)', transit:42, trend:'up', prices:{'20gp':3650,'40gp':5200,'40hq':6650}, range:'阿根廷基本港' },
  { key:'CNGZH-ZADUR', from:'CNGZH', to:'ZADUR', fromFlag:'🇨🇳', fromName:'广州', toFlag:'🇿🇦', toName:'德班', name:'广州→德班(非洲)', transit:27, trend:'stable', prices:{'20gp':2400,'40gp':3450,'40hq':4400}, range:'$3800-5500' },
  { key:'CNGZH-NGLOS', from:'CNGZH', to:'NGLOS', fromFlag:'🇨🇳', fromName:'广州', toFlag:'🇳🇬', toName:'拉各斯', name:'广州→拉各斯(非洲)', transit:34, trend:'up', prices:{'20gp':2950,'40gp':4150,'40hq':5350}, range:'西非基本港（阿帕帕）' },
  { key:'CNGZH-ZACPT', from:'CNGZH', to:'ZACPT', fromFlag:'🇨🇳', fromName:'广州', toFlag:'🇿🇦', toName:'开普敦', name:'广州→开普敦(非洲)', transit:30, trend:'stable', prices:{'20gp':2300,'40gp':3300,'40hq':4200}, range:'南非' },
  { key:'CNGZH-KEMBA', from:'CNGZH', to:'KEMBA', fromFlag:'🇨🇳', fromName:'广州', toFlag:'🇰🇪', toName:'蒙巴萨', name:'广州→蒙巴萨(非洲)', transit:24, trend:'stable', prices:{'20gp':2150,'40gp':3050,'40hq':3900}, range:'东非基本港' },
  { key:'CNGZH-EGPSD', from:'CNGZH', to:'EGPSD', fromFlag:'🇨🇳', fromName:'广州', toFlag:'🇪🇬', toName:'塞得港', name:'广州→塞得港(地中海)', transit:25, trend:'stable', prices:{'20gp':2600,'40gp':3650,'40hq':4700}, range:'埃及地中海基本港' },
  { key:'CNQIN-USLAX', from:'CNQIN', to:'USLAX', fromFlag:'🇨🇳', fromName:'青岛', toFlag:'🇺🇸', toName:'洛杉矶', name:'青岛→洛杉矶(美西)', transit:16, trend:'up', prices:{'20gp':3500,'40gp':5000,'40hq':6400}, range:'淡季$4800-5800 / 旺季$7000-9000' },
  { key:'CNQIN-USLGB', from:'CNQIN', to:'USLGB', fromFlag:'🇨🇳', fromName:'青岛', toFlag:'🇺🇸', toName:'长滩', name:'青岛→长滩(美西)', transit:16, trend:'up', prices:{'20gp':3450,'40gp':4900,'40hq':6300}, range:'洛杉矶港邻港，价格略低' },
  { key:'CNQIN-USOAK', from:'CNQIN', to:'USOAK', fromFlag:'🇨🇳', fromName:'青岛', toFlag:'🇺🇸', toName:'奥克兰', name:'青岛→奥克兰(美西)', transit:18, trend:'up', prices:{'20gp':3600,'40gp':5100,'40hq':6550}, range:'' },
  { key:'CNQIN-USSEA', from:'CNQIN', to:'USSEA', fromFlag:'🇨🇳', fromName:'青岛', toFlag:'🇺🇸', toName:'西雅图', name:'青岛→西雅图(美西)', transit:19, trend:'up', prices:{'20gp':3650,'40gp':5200,'40hq':6650}, range:'PNW基本港' },
  { key:'CNQIN-USNYC', from:'CNQIN', to:'USNYC', fromFlag:'🇨🇳', fromName:'青岛', toFlag:'🇺🇸', toName:'纽约', name:'青岛→纽约(美东)', transit:30, trend:'stable', prices:{'20gp':4450,'40gp':6300,'40hq':8050}, range:'淡季$6500-7500 / 旺季$8500-10500' },
  { key:'CNQIN-USSAV', from:'CNQIN', to:'USSAV', fromFlag:'🇨🇳', fromName:'青岛', toFlag:'🇺🇸', toName:'萨瓦纳', name:'青岛→萨瓦纳(美东)', transit:32, trend:'stable', prices:{'20gp':4250,'40gp':6050,'40hq':7750}, range:'美东基本港，价格略低于NYC' },
  { key:'CNQIN-USNFK', from:'CNQIN', to:'USNFK', fromFlag:'🇨🇳', fromName:'青岛', toFlag:'🇺🇸', toName:'诺福克', name:'青岛→诺福克(美东)', transit:32, trend:'stable', prices:{'20gp':4350,'40gp':6150,'40hq':7900}, range:'' },
  { key:'CNQIN-USHOU', from:'CNQIN', to:'USHOU', fromFlag:'🇨🇳', fromName:'青岛', toFlag:'🇺🇸', toName:'休斯顿', name:'青岛→休斯顿(美湾)', transit:34, trend:'up', prices:{'20gp':4600,'40gp':6500,'40hq':8350}, range:'墨西哥湾航线，经巴拿马运河' },
  { key:'CNQIN-CAVAN', from:'CNQIN', to:'CAVAN', fromFlag:'🇨🇳', fromName:'青岛', toFlag:'🇨🇦', toName:'温哥华', name:'青岛→温哥华(美西)', transit:18, trend:'up', prices:{'20gp':3700,'40gp':5250,'40hq':6750}, range:'加拿大西岸基本港' },
  { key:'CNQIN-CATOR', from:'CNQIN', to:'CATOR', fromFlag:'🇨🇳', fromName:'青岛', toFlag:'🇨🇦', toName:'多伦多', name:'青岛→多伦多(美东)', transit:37, trend:'stable', prices:{'20gp':5150,'40gp':7350,'40hq':9400}, range:'经温哥华/王子港陆联运' },
  { key:'CNQIN-NLRTM', from:'CNQIN', to:'NLRTM', fromFlag:'🇨🇳', fromName:'青岛', toFlag:'🇳🇱', toName:'鹿特丹', name:'青岛→鹿特丹(北欧)', transit:34, trend:'stable', prices:{'20gp':2700,'40gp':3850,'40hq':4950}, range:'淡季$3800-4500 / 旺季$5500-7000' },
  { key:'CNQIN-DEHAM', from:'CNQIN', to:'DEHAM', fromFlag:'🇨🇳', fromName:'青岛', toFlag:'🇩🇪', toName:'汉堡', name:'青岛→汉堡(北欧)', transit:36, trend:'stable', prices:{'20gp':2800,'40gp':3950,'40hq':5050}, range:'$4000-5500' },
  { key:'CNQIN-BEANR', from:'CNQIN', to:'BEANR', fromFlag:'🇨🇳', fromName:'青岛', toFlag:'🇧🇪', toName:'安特卫普', name:'青岛→安特卫普(北欧)', transit:34, trend:'stable', prices:{'20gp':2700,'40gp':3850,'40hq':4950}, range:'与鹿特丹同价' },
  { key:'CNQIN-GBFXT', from:'CNQIN', to:'GBFXT', fromFlag:'🇨🇳', fromName:'青岛', toFlag:'🇬🇧', toName:'费力克斯托', name:'青岛→费力克斯托(北欧)', transit:32, trend:'stable', prices:{'20gp':2800,'40gp':3950,'40hq':5050}, range:'英国基本港' },
  { key:'CNQIN-ITGOA', from:'CNQIN', to:'ITGOA', fromFlag:'🇨🇳', fromName:'青岛', toFlag:'🇮🇹', toName:'热那亚', name:'青岛→热那亚(地中海)', transit:32, trend:'down', prices:{'20gp':3550,'40gp':5050,'40hq':6450}, range:'$5500-7000（绕行好望角）' },
  { key:'CNQIN-ESVLC', from:'CNQIN', to:'ESVLC', fromFlag:'🇨🇳', fromName:'青岛', toFlag:'🇪🇸', toName:'瓦伦西亚', name:'青岛→瓦伦西亚(地中海)', transit:30, trend:'down', prices:{'20gp':3350,'40gp':4750,'40hq':6100}, range:'西地中海基本港' },
  { key:'CNQIN-ESBCN', from:'CNQIN', to:'ESBCN', fromFlag:'🇨🇳', fromName:'青岛', toFlag:'🇪🇸', toName:'巴塞罗那', name:'青岛→巴塞罗那(地中海)', transit:31, trend:'down', prices:{'20gp':3400,'40gp':4850,'40hq':6200}, range:'' },
  { key:'CNQIN-GRPIR', from:'CNQIN', to:'GRPIR', fromFlag:'🇨🇳', fromName:'青岛', toFlag:'🇬🇷', toName:'比雷埃夫斯', name:'青岛→比雷埃夫斯(地中海)', transit:28, trend:'down', prices:{'20gp':3250,'40gp':4600,'40hq':5900}, range:'希腊中转枢纽，航程较短' },
  { key:'CNQIN-AESYD', from:'CNQIN', to:'AESYD', fromFlag:'🇨🇳', fromName:'青岛', toFlag:'🇦🇪', toName:'杰贝阿里', name:'青岛→杰贝阿里(中东)', transit:20, trend:'up', prices:{'20gp':1800,'40gp':2550,'40hq':3250}, range:'$2500-3800，迪拜基本港' },
  { key:'CNQIN-SADMM', from:'CNQIN', to:'SADMM', fromFlag:'🇨🇳', fromName:'青岛', toFlag:'🇸🇦', toName:'达曼', name:'青岛→达曼(中东)', transit:22, trend:'up', prices:{'20gp':1850,'40gp':2600,'40hq':3350}, range:'沙特东岸基本港' },
  { key:'CNQIN-SAJED', from:'CNQIN', to:'SAJED', fromFlag:'🇨🇳', fromName:'青岛', toFlag:'🇸🇦', toName:'吉达', name:'青岛→吉达(红海)', transit:24, trend:'up', prices:{'20gp':2050,'40gp':2900,'40hq':3750}, range:'沙特红海基本港' },
  { key:'CNQIN-INNSA', from:'CNQIN', to:'INNSA', fromFlag:'🇨🇳', fromName:'青岛', toFlag:'🇮🇳', toName:'那瓦舍瓦', name:'青岛→那瓦舍瓦(印巴)', transit:22, trend:'stable', prices:{'20gp':1950,'40gp':2750,'40hq':3550}, range:'印度孟买新港，基本港' },
  { key:'CNQIN-INMUN', from:'CNQIN', to:'INMUN', fromFlag:'🇨🇳', fromName:'青岛', toFlag:'🇮🇳', toName:'蒙德拉', name:'青岛→蒙德拉(印巴)', transit:21, trend:'stable', prices:{'20gp':1900,'40gp':2700,'40hq':3450}, range:'印度西海岸' },
  { key:'CNQIN-PKKHI', from:'CNQIN', to:'PKKHI', fromFlag:'🇨🇳', fromName:'青岛', toFlag:'🇵🇰', toName:'卡拉奇', name:'青岛→卡拉奇(印巴)', transit:24, trend:'stable', prices:{'20gp':1850,'40gp':2600,'40hq':3350}, range:'巴基斯坦基本港' },
  { key:'CNQIN-LKCMB', from:'CNQIN', to:'LKCMB', fromFlag:'🇨🇳', fromName:'青岛', toFlag:'🇱🇰', toName:'科伦坡', name:'青岛→科伦坡(印巴)', transit:20, trend:'stable', prices:{'20gp':1550,'40gp':2200,'40hq':2850}, range:'南亚中转枢纽' },
  { key:'CNQIN-SGSIN', from:'CNQIN', to:'SGSIN', fromFlag:'🇨🇳', fromName:'青岛', toFlag:'🇸🇬', toName:'新加坡', name:'青岛→新加坡(东南亚)', transit:10, trend:'stable', prices:{'20gp':700,'40gp':1000,'40hq':1250}, range:'近洋航线，价格稳定' },
  { key:'CNQIN-MYPKG', from:'CNQIN', to:'MYPKG', fromFlag:'🇨🇳', fromName:'青岛', toFlag:'🇲🇾', toName:'巴生港', name:'青岛→巴生港(东南亚)', transit:11, trend:'stable', prices:{'20gp':650,'40gp':950,'40hq':1200}, range:'马来西亚基本港' },
  { key:'CNQIN-THBKK', from:'CNQIN', to:'THBKK', fromFlag:'🇨🇳', fromName:'青岛', toFlag:'🇹🇭', toName:'曼谷', name:'青岛→曼谷(东南亚)', transit:12, trend:'stable', prices:{'20gp':750,'40gp':1050,'40hq':1350}, range:'泰国林查班' },
  { key:'CNQIN-VNHCM', from:'CNQIN', to:'VNHCM', fromFlag:'🇨🇳', fromName:'青岛', toFlag:'🇻🇳', toName:'胡志明', name:'青岛→胡志明(东南亚)', transit:10, trend:'stable', prices:{'20gp':550,'40gp':800,'40hq':1000}, range:'越南基本港' },
  { key:'CNQIN-PHMNL', from:'CNQIN', to:'PHMNL', fromFlag:'🇨🇳', fromName:'青岛', toFlag:'🇵🇭', toName:'马尼拉', name:'青岛→马尼拉(东南亚)', transit:8, trend:'stable', prices:{'20gp':500,'40gp':750,'40hq':950}, range:'菲律宾基本港' },
  { key:'CNQIN-IDJKT', from:'CNQIN', to:'IDJKT', fromFlag:'🇨🇳', fromName:'青岛', toFlag:'🇮🇩', toName:'雅加达', name:'青岛→雅加达(东南亚)', transit:13, trend:'stable', prices:{'20gp':800,'40gp':1150,'40hq':1450}, range:'印尼基本港' },
  { key:'CNQIN-KRPUS', from:'CNQIN', to:'KRPUS', fromFlag:'🇨🇳', fromName:'青岛', toFlag:'🇰🇷', toName:'釜山', name:'青岛→釜山(日韩)', transit:2, trend:'stable', prices:{'20gp':300,'40gp':400,'40hq':500}, range:'近洋' },
  { key:'CNQIN-JPTYO', from:'CNQIN', to:'JPTYO', fromFlag:'🇨🇳', fromName:'青岛', toFlag:'🇯🇵', toName:'东京', name:'青岛→东京(日韩)', transit:4, trend:'stable', prices:{'20gp':400,'40gp':550,'40hq':700}, range:'近洋' },
  { key:'CNQIN-JPYOK', from:'CNQIN', to:'JPYOK', fromFlag:'🇨🇳', fromName:'青岛', toFlag:'🇯🇵', toName:'横滨', name:'青岛→横滨(日韩)', transit:4, trend:'stable', prices:{'20gp':400,'40gp':550,'40hq':720}, range:'' },
  { key:'CNQIN-JPOSA', from:'CNQIN', to:'JPOSA', fromFlag:'🇨🇳', fromName:'青岛', toFlag:'🇯🇵', toName:'大阪', name:'青岛→大阪(日韩)', transit:3, trend:'stable', prices:{'20gp':350,'40gp':550,'40hq':680}, range:'日本关西基本港' },
  { key:'CNQIN-AUMEL', from:'CNQIN', to:'AUMEL', fromFlag:'🇨🇳', fromName:'青岛', toFlag:'🇦🇺', toName:'墨尔本', name:'青岛→墨尔本(澳新)', transit:18, trend:'stable', prices:{'20gp':1550,'40gp':2200,'40hq':2850}, range:'$2200-3500' },
  { key:'CNQIN-AUSYD', from:'CNQIN', to:'AUSYD', fromFlag:'🇨🇳', fromName:'青岛', toFlag:'🇦🇺', toName:'悉尼', name:'青岛→悉尼(澳新)', transit:17, trend:'stable', prices:{'20gp':1600,'40gp':2300,'40hq':2950}, range:'' },
  { key:'CNQIN-AUBNE', from:'CNQIN', to:'AUBNE', fromFlag:'🇨🇳', fromName:'青岛', toFlag:'🇦🇺', toName:'布里斯班', name:'青岛→布里斯班(澳新)', transit:19, trend:'stable', prices:{'20gp':1600,'40gp':2250,'40hq':2900}, range:'' },
  { key:'CNQIN-NZAKL', from:'CNQIN', to:'NZAKL', fromFlag:'🇨🇳', fromName:'青岛', toFlag:'🇳🇿', toName:'奥克兰', name:'青岛→奥克兰(澳新)', transit:20, trend:'stable', prices:{'20gp':1750,'40gp':2450,'40hq':3150}, range:'新西兰基本港' },
  { key:'CNQIN-BRSSZ', from:'CNQIN', to:'BRSSZ', fromFlag:'🇨🇳', fromName:'青岛', toFlag:'🇧🇷', toName:'桑托斯', name:'青岛→桑托斯(南美东)', transit:40, trend:'up', prices:{'20gp':3650,'40gp':5200,'40hq':6650}, range:'$5500-7500' },
  { key:'CNQIN-MXZLO', from:'CNQIN', to:'MXZLO', fromFlag:'🇨🇳', fromName:'青岛', toFlag:'🇲🇽', toName:'曼萨尼约', name:'青岛→曼萨尼约(拉美)', transit:22, trend:'up', prices:{'20gp':2900,'40gp':4150,'40hq':5300}, range:'墨西哥西岸基本港' },
  { key:'CNQIN-PECLL', from:'CNQIN', to:'PECLL', fromFlag:'🇨🇳', fromName:'青岛', toFlag:'🇵🇪', toName:'卡亚俄', name:'青岛→卡亚俄(南美西)', transit:30, trend:'stable', prices:{'20gp':3100,'40gp':4350,'40hq':5600}, range:'秘鲁基本港' },
  { key:'CNQIN-CLVAP', from:'CNQIN', to:'CLVAP', fromFlag:'🇨🇳', fromName:'青岛', toFlag:'🇨🇱', toName:'瓦尔帕莱索', name:'青岛→瓦尔帕莱索(南美西)', transit:34, trend:'stable', prices:{'20gp':3150,'40gp':4450,'40hq':5700}, range:'智利基本港' },
  { key:'CNQIN-ARBUE', from:'CNQIN', to:'ARBUE', fromFlag:'🇨🇳', fromName:'青岛', toFlag:'🇦🇷', toName:'布宜诺斯艾利斯', name:'青岛→布宜诺斯艾利斯(南美东)', transit:42, trend:'up', prices:{'20gp':3800,'40gp':5400,'40hq':6950}, range:'阿根廷基本港' },
  { key:'CNQIN-ZADUR', from:'CNQIN', to:'ZADUR', fromFlag:'🇨🇳', fromName:'青岛', toFlag:'🇿🇦', toName:'德班', name:'青岛→德班(非洲)', transit:27, trend:'stable', prices:{'20gp':2550,'40gp':3600,'40hq':4600}, range:'$3800-5500' },
  { key:'CNQIN-NGLOS', from:'CNQIN', to:'NGLOS', fromFlag:'🇨🇳', fromName:'青岛', toFlag:'🇳🇬', toName:'拉各斯', name:'青岛→拉各斯(非洲)', transit:34, trend:'up', prices:{'20gp':3100,'40gp':4350,'40hq':5600}, range:'西非基本港（阿帕帕）' },
  { key:'CNQIN-ZACPT', from:'CNQIN', to:'ZACPT', fromFlag:'🇨🇳', fromName:'青岛', toFlag:'🇿🇦', toName:'开普敦', name:'青岛→开普敦(非洲)', transit:30, trend:'stable', prices:{'20gp':2400,'40gp':3450,'40hq':4400}, range:'南非' },
  { key:'CNQIN-KEMBA', from:'CNQIN', to:'KEMBA', fromFlag:'🇨🇳', fromName:'青岛', toFlag:'🇰🇪', toName:'蒙巴萨', name:'青岛→蒙巴萨(非洲)', transit:24, trend:'stable', prices:{'20gp':2250,'40gp':3200,'40hq':4100}, range:'东非基本港' },
  { key:'CNQIN-EGPSD', from:'CNQIN', to:'EGPSD', fromFlag:'🇨🇳', fromName:'青岛', toFlag:'🇪🇬', toName:'塞得港', name:'青岛→塞得港(地中海)', transit:25, trend:'stable', prices:{'20gp':2700,'40gp':3800,'40hq':4900}, range:'埃及地中海基本港' },
  { key:'CNTSN-USLAX', from:'CNTSN', to:'USLAX', fromFlag:'🇨🇳', fromName:'天津', toFlag:'🇺🇸', toName:'洛杉矶', name:'天津→洛杉矶(美西)', transit:17, trend:'up', prices:{'20gp':3550,'40gp':5050,'40hq':6450}, range:'淡季$4800-5800 / 旺季$7000-9000' },
  { key:'CNTSN-USLGB', from:'CNTSN', to:'USLGB', fromFlag:'🇨🇳', fromName:'天津', toFlag:'🇺🇸', toName:'长滩', name:'天津→长滩(美西)', transit:17, trend:'up', prices:{'20gp':3500,'40gp':5000,'40hq':6400}, range:'洛杉矶港邻港，价格略低' },
  { key:'CNTSN-USOAK', from:'CNTSN', to:'USOAK', fromFlag:'🇨🇳', fromName:'天津', toFlag:'🇺🇸', toName:'奥克兰', name:'天津→奥克兰(美西)', transit:19, trend:'up', prices:{'20gp':3650,'40gp':5150,'40hq':6600}, range:'' },
  { key:'CNTSN-USSEA', from:'CNTSN', to:'USSEA', fromFlag:'🇨🇳', fromName:'天津', toFlag:'🇺🇸', toName:'西雅图', name:'天津→西雅图(美西)', transit:20, trend:'up', prices:{'20gp':3700,'40gp':5250,'40hq':6700}, range:'PNW基本港' },
  { key:'CNTSN-USNYC', from:'CNTSN', to:'USNYC', fromFlag:'🇨🇳', fromName:'天津', toFlag:'🇺🇸', toName:'纽约', name:'天津→纽约(美东)', transit:31, trend:'stable', prices:{'20gp':4450,'40gp':6300,'40hq':8100}, range:'淡季$6500-7500 / 旺季$8500-10500' },
  { key:'CNTSN-USSAV', from:'CNTSN', to:'USSAV', fromFlag:'🇨🇳', fromName:'天津', toFlag:'🇺🇸', toName:'萨瓦纳', name:'天津→萨瓦纳(美东)', transit:33, trend:'stable', prices:{'20gp':4300,'40gp':6100,'40hq':7850}, range:'美东基本港，价格略低于NYC' },
  { key:'CNTSN-CAVAN', from:'CNTSN', to:'CAVAN', fromFlag:'🇨🇳', fromName:'天津', toFlag:'🇨🇦', toName:'温哥华', name:'天津→温哥华(美西)', transit:19, trend:'up', prices:{'20gp':3750,'40gp':5300,'40hq':6800}, range:'加拿大西岸基本港' },
  { key:'CNTSN-NLRTM', from:'CNTSN', to:'NLRTM', fromFlag:'🇨🇳', fromName:'天津', toFlag:'🇳🇱', toName:'鹿特丹', name:'天津→鹿特丹(北欧)', transit:35, trend:'stable', prices:{'20gp':2750,'40gp':3900,'40hq':5000}, range:'淡季$3800-4500 / 旺季$5500-7000' },
  { key:'CNTSN-DEHAM', from:'CNTSN', to:'DEHAM', fromFlag:'🇨🇳', fromName:'天津', toFlag:'🇩🇪', toName:'汉堡', name:'天津→汉堡(北欧)', transit:37, trend:'stable', prices:{'20gp':2800,'40gp':4000,'40hq':5100}, range:'$4000-5500' },
  { key:'CNTSN-BEANR', from:'CNTSN', to:'BEANR', fromFlag:'🇨🇳', fromName:'天津', toFlag:'🇧🇪', toName:'安特卫普', name:'天津→安特卫普(北欧)', transit:35, trend:'stable', prices:{'20gp':2750,'40gp':3900,'40hq':5000}, range:'与鹿特丹同价' },
  { key:'CNTSN-GBFXT', from:'CNTSN', to:'GBFXT', fromFlag:'🇨🇳', fromName:'天津', toFlag:'🇬🇧', toName:'费力克斯托', name:'天津→费力克斯托(北欧)', transit:33, trend:'stable', prices:{'20gp':2800,'40gp':4000,'40hq':5100}, range:'英国基本港' },
  { key:'CNTSN-ITGOA', from:'CNTSN', to:'ITGOA', fromFlag:'🇨🇳', fromName:'天津', toFlag:'🇮🇹', toName:'热那亚', name:'天津→热那亚(地中海)', transit:33, trend:'down', prices:{'20gp':3600,'40gp':5050,'40hq':6500}, range:'$5500-7000（绕行好望角）' },
  { key:'CNTSN-ESVLC', from:'CNTSN', to:'ESVLC', fromFlag:'🇨🇳', fromName:'天津', toFlag:'🇪🇸', toName:'瓦伦西亚', name:'天津→瓦伦西亚(地中海)', transit:31, trend:'down', prices:{'20gp':3400,'40gp':4850,'40hq':6200}, range:'西地中海基本港' },
  { key:'CNTSN-ESBCN', from:'CNTSN', to:'ESBCN', fromFlag:'🇨🇳', fromName:'天津', toFlag:'🇪🇸', toName:'巴塞罗那', name:'天津→巴塞罗那(地中海)', transit:32, trend:'down', prices:{'20gp':3450,'40gp':4900,'40hq':6300}, range:'' },
  { key:'CNTSN-AESYD', from:'CNTSN', to:'AESYD', fromFlag:'🇨🇳', fromName:'天津', toFlag:'🇦🇪', toName:'杰贝阿里', name:'天津→杰贝阿里(中东)', transit:21, trend:'up', prices:{'20gp':1800,'40gp':2550,'40hq':3300}, range:'$2500-3800，迪拜基本港' },
  { key:'CNTSN-SAJED', from:'CNTSN', to:'SAJED', fromFlag:'🇨🇳', fromName:'天津', toFlag:'🇸🇦', toName:'吉达', name:'天津→吉达(红海)', transit:25, trend:'up', prices:{'20gp':2100,'40gp':2950,'40hq':3800}, range:'沙特红海基本港' },
  { key:'CNTSN-INNSA', from:'CNTSN', to:'INNSA', fromFlag:'🇨🇳', fromName:'天津', toFlag:'🇮🇳', toName:'那瓦舍瓦', name:'天津→那瓦舍瓦(印巴)', transit:23, trend:'stable', prices:{'20gp':2000,'40gp':2800,'40hq':3600}, range:'印度孟买新港，基本港' },
  { key:'CNTSN-PKKHI', from:'CNTSN', to:'PKKHI', fromFlag:'🇨🇳', fromName:'天津', toFlag:'🇵🇰', toName:'卡拉奇', name:'天津→卡拉奇(印巴)', transit:25, trend:'stable', prices:{'20gp':1850,'40gp':2650,'40hq':3400}, range:'巴基斯坦基本港' },
  { key:'CNTSN-SGSIN', from:'CNTSN', to:'SGSIN', fromFlag:'🇨🇳', fromName:'天津', toFlag:'🇸🇬', toName:'新加坡', name:'天津→新加坡(东南亚)', transit:11, trend:'stable', prices:{'20gp':750,'40gp':1050,'40hq':1350}, range:'近洋航线，价格稳定' },
  { key:'CNTSN-MYPKG', from:'CNTSN', to:'MYPKG', fromFlag:'🇨🇳', fromName:'天津', toFlag:'🇲🇾', toName:'巴生港', name:'天津→巴生港(东南亚)', transit:12, trend:'stable', prices:{'20gp':700,'40gp':1000,'40hq':1300}, range:'马来西亚基本港' },
  { key:'CNTSN-THBKK', from:'CNTSN', to:'THBKK', fromFlag:'🇨🇳', fromName:'天津', toFlag:'🇹🇭', toName:'曼谷', name:'天津→曼谷(东南亚)', transit:13, trend:'stable', prices:{'20gp':800,'40gp':1150,'40hq':1450}, range:'泰国林查班' },
  { key:'CNTSN-VNHCM', from:'CNTSN', to:'VNHCM', fromFlag:'🇨🇳', fromName:'天津', toFlag:'🇻🇳', toName:'胡志明', name:'天津→胡志明(东南亚)', transit:11, trend:'stable', prices:{'20gp':600,'40gp':850,'40hq':1100}, range:'越南基本港' },
  { key:'CNTSN-PHMNL', from:'CNTSN', to:'PHMNL', fromFlag:'🇨🇳', fromName:'天津', toFlag:'🇵🇭', toName:'马尼拉', name:'天津→马尼拉(东南亚)', transit:9, trend:'stable', prices:{'20gp':550,'40gp':800,'40hq':1000}, range:'菲律宾基本港' },
  { key:'CNTSN-IDJKT', from:'CNTSN', to:'IDJKT', fromFlag:'🇨🇳', fromName:'天津', toFlag:'🇮🇩', toName:'雅加达', name:'天津→雅加达(东南亚)', transit:14, trend:'stable', prices:{'20gp':850,'40gp':1200,'40hq':1550}, range:'印尼基本港' },
  { key:'CNTSN-KRPUS', from:'CNTSN', to:'KRPUS', fromFlag:'🇨🇳', fromName:'天津', toFlag:'🇰🇷', toName:'釜山', name:'天津→釜山(日韩)', transit:2, trend:'stable', prices:{'20gp':250,'40gp':350,'40hq':450}, range:'近洋' },
  { key:'CNTSN-JPTYO', from:'CNTSN', to:'JPTYO', fromFlag:'🇨🇳', fromName:'天津', toFlag:'🇯🇵', toName:'东京', name:'天津→东京(日韩)', transit:5, trend:'stable', prices:{'20gp':350,'40gp':500,'40hq':650}, range:'日本关东基本港' },
  { key:'CNTSN-JPYOK', from:'CNTSN', to:'JPYOK', fromFlag:'🇨🇳', fromName:'天津', toFlag:'🇯🇵', toName:'横滨', name:'天津→横滨(日韩)', transit:5, trend:'stable', prices:{'20gp':350,'40gp':550,'40hq':680}, range:'' },
  { key:'CNTSN-JPOSA', from:'CNTSN', to:'JPOSA', fromFlag:'🇨🇳', fromName:'天津', toFlag:'🇯🇵', toName:'大阪', name:'天津→大阪(日韩)', transit:4, trend:'stable', prices:{'20gp':350,'40gp':500,'40hq':630}, range:'日本关西基本港' },
  { key:'CNTSN-AUMEL', from:'CNTSN', to:'AUMEL', fromFlag:'🇨🇳', fromName:'天津', toFlag:'🇦🇺', toName:'墨尔本', name:'天津→墨尔本(澳新)', transit:19, trend:'stable', prices:{'20gp':1600,'40gp':2250,'40hq':2900}, range:'$2200-3500' },
  { key:'CNTSN-AUSYD', from:'CNTSN', to:'AUSYD', fromFlag:'🇨🇳', fromName:'天津', toFlag:'🇦🇺', toName:'悉尼', name:'天津→悉尼(澳新)', transit:18, trend:'stable', prices:{'20gp':1650,'40gp':2350,'40hq':3000}, range:'' },
  { key:'CNTSN-BRSSZ', from:'CNTSN', to:'BRSSZ', fromFlag:'🇨🇳', fromName:'天津', toFlag:'🇧🇷', toName:'桑托斯', name:'天津→桑托斯(南美东)', transit:41, trend:'up', prices:{'20gp':3700,'40gp':5250,'40hq':6700}, range:'$5500-7500' },
  { key:'CNTSN-MXZLO', from:'CNTSN', to:'MXZLO', fromFlag:'🇨🇳', fromName:'天津', toFlag:'🇲🇽', toName:'曼萨尼约', name:'天津→曼萨尼约(拉美)', transit:23, trend:'up', prices:{'20gp':2950,'40gp':4150,'40hq':5350}, range:'墨西哥西岸基本港' },
  { key:'CNTSN-ZADUR', from:'CNTSN', to:'ZADUR', fromFlag:'🇨🇳', fromName:'天津', toFlag:'🇿🇦', toName:'德班', name:'天津→德班(非洲)', transit:28, trend:'stable', prices:{'20gp':2550,'40gp':3650,'40hq':4650}, range:'$3800-5500' },
  { key:'CNTSN-NGLOS', from:'CNTSN', to:'NGLOS', fromFlag:'🇨🇳', fromName:'天津', toFlag:'🇳🇬', toName:'拉各斯', name:'天津→拉各斯(非洲)', transit:35, trend:'up', prices:{'20gp':3100,'40gp':4400,'40hq':5650}, range:'西非基本港（阿帕帕）' },
  { key:'CNTSN-EGPSD', from:'CNTSN', to:'EGPSD', fromFlag:'🇨🇳', fromName:'天津', toFlag:'🇪🇬', toName:'塞得港', name:'天津→塞得港(地中海)', transit:26, trend:'stable', prices:{'20gp':2700,'40gp':3850,'40hq':4950}, range:'埃及地中海基本港' },
  { key:'CNXMN-USLAX', from:'CNXMN', to:'USLAX', fromFlag:'🇨🇳', fromName:'厦门', toFlag:'🇺🇸', toName:'洛杉矶', name:'厦门→洛杉矶(美西)', transit:16, trend:'up', prices:{'20gp':3400,'40gp':4800,'40hq':6150}, range:'淡季$4800-5800 / 旺季$7000-9000' },
  { key:'CNXMN-USLGB', from:'CNXMN', to:'USLGB', fromFlag:'🇨🇳', fromName:'厦门', toFlag:'🇺🇸', toName:'长滩', name:'厦门→长滩(美西)', transit:16, trend:'up', prices:{'20gp':3350,'40gp':4750,'40hq':6100}, range:'洛杉矶港邻港，价格略低' },
  { key:'CNXMN-USNYC', from:'CNXMN', to:'USNYC', fromFlag:'🇨🇳', fromName:'厦门', toFlag:'🇺🇸', toName:'纽约', name:'厦门→纽约(美东)', transit:30, trend:'stable', prices:{'20gp':4250,'40gp':6000,'40hq':7700}, range:'淡季$6500-7500 / 旺季$8500-10500' },
  { key:'CNXMN-NLRTM', from:'CNXMN', to:'NLRTM', fromFlag:'🇨🇳', fromName:'厦门', toFlag:'🇳🇱', toName:'鹿特丹', name:'厦门→鹿特丹(北欧)', transit:34, trend:'stable', prices:{'20gp':2600,'40gp':3700,'40hq':4750}, range:'淡季$3800-4500 / 旺季$5500-7000' },
  { key:'CNXMN-DEHAM', from:'CNXMN', to:'DEHAM', fromFlag:'🇨🇳', fromName:'厦门', toFlag:'🇩🇪', toName:'汉堡', name:'厦门→汉堡(北欧)', transit:36, trend:'stable', prices:{'20gp':2650,'40gp':3800,'40hq':4850}, range:'$4000-5500' },
  { key:'CNXMN-ITGOA', from:'CNXMN', to:'ITGOA', fromFlag:'🇨🇳', fromName:'厦门', toFlag:'🇮🇹', toName:'热那亚', name:'厦门→热那亚(地中海)', transit:32, trend:'down', prices:{'20gp':3400,'40gp':4800,'40hq':6150}, range:'$5500-7000（绕行好望角）' },
  { key:'CNXMN-AESYD', from:'CNXMN', to:'AESYD', fromFlag:'🇨🇳', fromName:'厦门', toFlag:'🇦🇪', toName:'杰贝阿里', name:'厦门→杰贝阿里(中东)', transit:20, trend:'up', prices:{'20gp':1750,'40gp':2450,'40hq':3150}, range:'$2500-3800，迪拜基本港' },
  { key:'CNXMN-SGSIN', from:'CNXMN', to:'SGSIN', fromFlag:'🇨🇳', fromName:'厦门', toFlag:'🇸🇬', toName:'新加坡', name:'厦门→新加坡(东南亚)', transit:5, trend:'stable', prices:{'20gp':400,'40gp':600,'40hq':750}, range:'近洋航线，价格稳定' },
  { key:'CNXMN-MYPKG', from:'CNXMN', to:'MYPKG', fromFlag:'🇨🇳', fromName:'厦门', toFlag:'🇲🇾', toName:'巴生港', name:'厦门→巴生港(东南亚)', transit:6, trend:'stable', prices:{'20gp':400,'40gp':550,'40hq':700}, range:'马来西亚基本港' },
  { key:'CNXMN-VNHCM', from:'CNXMN', to:'VNHCM', fromFlag:'🇨🇳', fromName:'厦门', toFlag:'🇻🇳', toName:'胡志明', name:'厦门→胡志明(东南亚)', transit:3, trend:'stable', prices:{'20gp':300,'40gp':450,'40hq':550}, range:'越南基本港' },
  { key:'CNXMN-PHMNL', from:'CNXMN', to:'PHMNL', fromFlag:'🇨🇳', fromName:'厦门', toFlag:'🇵🇭', toName:'马尼拉', name:'厦门→马尼拉(东南亚)', transit:3, trend:'stable', prices:{'20gp':300,'40gp':400,'40hq':500}, range:'菲律宾基本港' },
  { key:'CNXMN-IDJKT', from:'CNXMN', to:'IDJKT', fromFlag:'🇨🇳', fromName:'厦门', toFlag:'🇮🇩', toName:'雅加达', name:'厦门→雅加达(东南亚)', transit:8, trend:'stable', prices:{'20gp':500,'40gp':750,'40hq':950}, range:'印尼基本港' },
  { key:'CNXMN-KRPUS', from:'CNXMN', to:'KRPUS', fromFlag:'🇨🇳', fromName:'厦门', toFlag:'🇰🇷', toName:'釜山', name:'厦门→釜山(日韩)', transit:5, trend:'stable', prices:{'20gp':300,'40gp':450,'40hq':580}, range:'韩国基本港' },
  { key:'CNXMN-JPTYO', from:'CNXMN', to:'JPTYO', fromFlag:'🇨🇳', fromName:'厦门', toFlag:'🇯🇵', toName:'东京', name:'厦门→东京(日韩)', transit:7, trend:'stable', prices:{'20gp':450,'40gp':600,'40hq':780}, range:'日本关东基本港' },
  { key:'CNXMN-JPOSA', from:'CNXMN', to:'JPOSA', fromFlag:'🇨🇳', fromName:'厦门', toFlag:'🇯🇵', toName:'大阪', name:'厦门→大阪(日韩)', transit:6, trend:'stable', prices:{'20gp':400,'40gp':600,'40hq':750}, range:'日本关西基本港' },
  { key:'CNXMN-AUMEL', from:'CNXMN', to:'AUMEL', fromFlag:'🇨🇳', fromName:'厦门', toFlag:'🇦🇺', toName:'墨尔本', name:'厦门→墨尔本(澳新)', transit:18, trend:'stable', prices:{'20gp':1500,'40gp':2150,'40hq':2750}, range:'$2200-3500' },
  { key:'CNXMN-AUSYD', from:'CNXMN', to:'AUSYD', fromFlag:'🇨🇳', fromName:'厦门', toFlag:'🇦🇺', toName:'悉尼', name:'厦门→悉尼(澳新)', transit:17, trend:'stable', prices:{'20gp':1550,'40gp':2200,'40hq':2850}, range:'' },
  { key:'CNXMN-BRSSZ', from:'CNXMN', to:'BRSSZ', fromFlag:'🇨🇳', fromName:'厦门', toFlag:'🇧🇷', toName:'桑托斯', name:'厦门→桑托斯(南美东)', transit:40, trend:'up', prices:{'20gp':3500,'40gp':4950,'40hq':6350}, range:'$5500-7500' },
  { key:'CNXMN-ZADUR', from:'CNXMN', to:'ZADUR', fromFlag:'🇨🇳', fromName:'厦门', toFlag:'🇿🇦', toName:'德班', name:'厦门→德班(非洲)', transit:27, trend:'stable', prices:{'20gp':2400,'40gp':3450,'40hq':4400}, range:'$3800-5500' },
  { key:'CNXMN-MYTPP', from:'CNXMN', to:'MYTPP', fromFlag:'🇨🇳', fromName:'厦门', toFlag:'🇲🇾', toName:'丹绒帕拉帕斯', name:'厦门→丹绒帕拉帕斯(东南亚)', transit:7, trend:'stable', prices:{'20gp':350,'40gp':550,'40hq':680}, range:'马来西亚新港' },
  { key:'CNXMN-THBKK', from:'CNXMN', to:'THBKK', fromFlag:'🇨🇳', fromName:'厦门', toFlag:'🇹🇭', toName:'曼谷', name:'厦门→曼谷(东南亚)', transit:7, trend:'stable', prices:{'20gp':450,'40gp':650,'40hq':850}, range:'泰国林查班' },
  { key:'HKHKG-USLAX', from:'HKHKG', to:'USLAX', fromFlag:'🇭🇰', fromName:'香港', toFlag:'🇺🇸', toName:'洛杉矶', name:'香港→洛杉矶(美西)', transit:16, trend:'up', prices:{'20gp':3450,'40gp':4900,'40hq':6300}, range:'淡季$4800-5800 / 旺季$7000-9000' },
  { key:'HKHKG-USLGB', from:'HKHKG', to:'USLGB', fromFlag:'🇭🇰', fromName:'香港', toFlag:'🇺🇸', toName:'长滩', name:'香港→长滩(美西)', transit:16, trend:'up', prices:{'20gp':3450,'40gp':4900,'40hq':6250}, range:'洛杉矶港邻港，价格略低' },
  { key:'HKHKG-USOAK', from:'HKHKG', to:'USOAK', fromFlag:'🇭🇰', fromName:'香港', toFlag:'🇺🇸', toName:'奥克兰', name:'香港→奥克兰(美西)', transit:18, trend:'up', prices:{'20gp':3550,'40gp':5050,'40hq':6450}, range:'' },
  { key:'HKHKG-USSEA', from:'HKHKG', to:'USSEA', fromFlag:'🇭🇰', fromName:'香港', toFlag:'🇺🇸', toName:'西雅图', name:'香港→西雅图(美西)', transit:19, trend:'up', prices:{'20gp':3600,'40gp':5100,'40hq':6550}, range:'PNW基本港' },
  { key:'HKHKG-USNYC', from:'HKHKG', to:'USNYC', fromFlag:'🇭🇰', fromName:'香港', toFlag:'🇺🇸', toName:'纽约', name:'香港→纽约(美东)', transit:30, trend:'stable', prices:{'20gp':4350,'40gp':6150,'40hq':7900}, range:'淡季$6500-7500 / 旺季$8500-10500' },
  { key:'HKHKG-USSAV', from:'HKHKG', to:'USSAV', fromFlag:'🇭🇰', fromName:'香港', toFlag:'🇺🇸', toName:'萨瓦纳', name:'香港→萨瓦纳(美东)', transit:32, trend:'stable', prices:{'20gp':4200,'40gp':5950,'40hq':7650}, range:'美东基本港，价格略低于NYC' },
  { key:'HKHKG-USNFK', from:'HKHKG', to:'USNFK', fromFlag:'🇭🇰', fromName:'香港', toFlag:'🇺🇸', toName:'诺福克', name:'香港→诺福克(美东)', transit:32, trend:'stable', prices:{'20gp':4300,'40gp':6100,'40hq':7800}, range:'' },
  { key:'HKHKG-USHOU', from:'HKHKG', to:'USHOU', fromFlag:'🇭🇰', fromName:'香港', toFlag:'🇺🇸', toName:'休斯顿', name:'香港→休斯顿(美湾)', transit:34, trend:'up', prices:{'20gp':4550,'40gp':6450,'40hq':8250}, range:'墨西哥湾航线，经巴拿马运河' },
  { key:'HKHKG-CAVAN', from:'HKHKG', to:'CAVAN', fromFlag:'🇭🇰', fromName:'香港', toFlag:'🇨🇦', toName:'温哥华', name:'香港→温哥华(美西)', transit:18, trend:'up', prices:{'20gp':3650,'40gp':5200,'40hq':6650}, range:'加拿大西岸基本港' },
  { key:'HKHKG-NLRTM', from:'HKHKG', to:'NLRTM', fromFlag:'🇭🇰', fromName:'香港', toFlag:'🇳🇱', toName:'鹿特丹', name:'香港→鹿特丹(北欧)', transit:34, trend:'stable', prices:{'20gp':2700,'40gp':3800,'40hq':4900}, range:'淡季$3800-4500 / 旺季$5500-7000' },
  { key:'HKHKG-DEHAM', from:'HKHKG', to:'DEHAM', fromFlag:'🇭🇰', fromName:'香港', toFlag:'🇩🇪', toName:'汉堡', name:'香港→汉堡(北欧)', transit:36, trend:'stable', prices:{'20gp':2700,'40gp':3850,'40hq':4950}, range:'$4000-5500' },
  { key:'HKHKG-BEANR', from:'HKHKG', to:'BEANR', fromFlag:'🇭🇰', fromName:'香港', toFlag:'🇧🇪', toName:'安特卫普', name:'香港→安特卫普(北欧)', transit:34, trend:'stable', prices:{'20gp':2650,'40gp':3800,'40hq':4850}, range:'与鹿特丹同价' },
  { key:'HKHKG-GBFXT', from:'HKHKG', to:'GBFXT', fromFlag:'🇭🇰', fromName:'香港', toFlag:'🇬🇧', toName:'费力克斯托', name:'香港→费力克斯托(北欧)', transit:32, trend:'stable', prices:{'20gp':2700,'40gp':3850,'40hq':4950}, range:'英国基本港' },
  { key:'HKHKG-ITGOA', from:'HKHKG', to:'ITGOA', fromFlag:'🇭🇰', fromName:'香港', toFlag:'🇮🇹', toName:'热那亚', name:'香港→热那亚(地中海)', transit:32, trend:'down', prices:{'20gp':3500,'40gp':4950,'40hq':6350}, range:'$5500-7000（绕行好望角）' },
  { key:'HKHKG-ESVLC', from:'HKHKG', to:'ESVLC', fromFlag:'🇭🇰', fromName:'香港', toFlag:'🇪🇸', toName:'瓦伦西亚', name:'香港→瓦伦西亚(地中海)', transit:30, trend:'down', prices:{'20gp':3350,'40gp':4700,'40hq':6050}, range:'西地中海基本港' },
  { key:'HKHKG-ESBCN', from:'HKHKG', to:'ESBCN', fromFlag:'🇭🇰', fromName:'香港', toFlag:'🇪🇸', toName:'巴塞罗那', name:'香港→巴塞罗那(地中海)', transit:31, trend:'down', prices:{'20gp':3400,'40gp':4800,'40hq':6150}, range:'' },
  { key:'HKHKG-GRPIR', from:'HKHKG', to:'GRPIR', fromFlag:'🇭🇰', fromName:'香港', toFlag:'🇬🇷', toName:'比雷埃夫斯', name:'香港→比雷埃夫斯(地中海)', transit:28, trend:'down', prices:{'20gp':3200,'40gp':4550,'40hq':5850}, range:'希腊中转枢纽，航程较短' },
  { key:'HKHKG-FRMRS', from:'HKHKG', to:'FRMRS', fromFlag:'🇭🇰', fromName:'香港', toFlag:'🇫🇷', toName:'马赛', name:'香港→马赛(地中海)', transit:31, trend:'down', prices:{'20gp':3350,'40gp':4750,'40hq':6100}, range:'' },
  { key:'HKHKG-AESYD', from:'HKHKG', to:'AESYD', fromFlag:'🇭🇰', fromName:'香港', toFlag:'🇦🇪', toName:'杰贝阿里', name:'香港→杰贝阿里(中东)', transit:20, trend:'up', prices:{'20gp':1750,'40gp':2500,'40hq':3200}, range:'$2500-3800，迪拜基本港' },
  { key:'HKHKG-SADMM', from:'HKHKG', to:'SADMM', fromFlag:'🇭🇰', fromName:'香港', toFlag:'🇸🇦', toName:'达曼', name:'香港→达曼(中东)', transit:22, trend:'up', prices:{'20gp':1800,'40gp':2550,'40hq':3300}, range:'沙特东岸基本港' },
  { key:'HKHKG-SAJED', from:'HKHKG', to:'SAJED', fromFlag:'🇭🇰', fromName:'香港', toFlag:'🇸🇦', toName:'吉达', name:'香港→吉达(红海)', transit:24, trend:'up', prices:{'20gp':2050,'40gp':2900,'40hq':3700}, range:'沙特红海基本港' },
  { key:'HKHKG-AEKHI', from:'HKHKG', to:'AEKHI', fromFlag:'🇭🇰', fromName:'香港', toFlag:'🇮🇷', toName:'霍尔木兹', name:'香港→霍尔木兹(中东)', transit:22, trend:'up', prices:{'20gp':1850,'40gp':2650,'40hq':3400}, range:'' },
  { key:'HKHKG-INNSA', from:'HKHKG', to:'INNSA', fromFlag:'🇭🇰', fromName:'香港', toFlag:'🇮🇳', toName:'那瓦舍瓦', name:'香港→那瓦舍瓦(印巴)', transit:22, trend:'stable', prices:{'20gp':1950,'40gp':2750,'40hq':3500}, range:'印度孟买新港，基本港' },
  { key:'HKHKG-INMUN', from:'HKHKG', to:'INMUN', fromFlag:'🇭🇰', fromName:'香港', toFlag:'🇮🇳', toName:'蒙德拉', name:'香港→蒙德拉(印巴)', transit:21, trend:'stable', prices:{'20gp':1850,'40gp':2650,'40hq':3400}, range:'印度西海岸' },
  { key:'HKHKG-PKKHI', from:'HKHKG', to:'PKKHI', fromFlag:'🇭🇰', fromName:'香港', toFlag:'🇵🇰', toName:'卡拉奇', name:'香港→卡拉奇(印巴)', transit:24, trend:'stable', prices:{'20gp':1800,'40gp':2550,'40hq':3300}, range:'巴基斯坦基本港' },
  { key:'HKHKG-LKCMB', from:'HKHKG', to:'LKCMB', fromFlag:'🇭🇰', fromName:'香港', toFlag:'🇱🇰', toName:'科伦坡', name:'香港→科伦坡(印巴)', transit:20, trend:'stable', prices:{'20gp':1550,'40gp':2200,'40hq':2800}, range:'南亚中转枢纽' },
  { key:'HKHKG-SGSIN', from:'HKHKG', to:'SGSIN', fromFlag:'🇭🇰', fromName:'香港', toFlag:'🇸🇬', toName:'新加坡', name:'香港→新加坡(东南亚)', transit:4, trend:'stable', prices:{'20gp':450,'40gp':600,'40hq':800}, range:'近洋航线，价格稳定' },
  { key:'HKHKG-MYPKG', from:'HKHKG', to:'MYPKG', fromFlag:'🇭🇰', fromName:'香港', toFlag:'🇲🇾', toName:'巴生港', name:'香港→巴生港(东南亚)', transit:5, trend:'stable', prices:{'20gp':400,'40gp':600,'40hq':750}, range:'马来西亚基本港' },
  { key:'HKHKG-THBKK', from:'HKHKG', to:'THBKK', fromFlag:'🇭🇰', fromName:'香港', toFlag:'🇹🇭', toName:'曼谷', name:'香港→曼谷(东南亚)', transit:6, trend:'stable', prices:{'20gp':500,'40gp':700,'40hq':900}, range:'泰国林查班' },
  { key:'HKHKG-VNHCM', from:'HKHKG', to:'VNHCM', fromFlag:'🇭🇰', fromName:'香港', toFlag:'🇻🇳', toName:'胡志明', name:'香港→胡志明(东南亚)', transit:3, trend:'stable', prices:{'20gp':350,'40gp':450,'40hq':600}, range:'越南基本港' },
  { key:'HKHKG-PHMNL', from:'HKHKG', to:'PHMNL', fromFlag:'🇭🇰', fromName:'香港', toFlag:'🇵🇭', toName:'马尼拉', name:'香港→马尼拉(东南亚)', transit:2, trend:'stable', prices:{'20gp':300,'40gp':450,'40hq':550}, range:'菲律宾基本港' },
  { key:'HKHKG-IDJKT', from:'HKHKG', to:'IDJKT', fromFlag:'🇭🇰', fromName:'香港', toFlag:'🇮🇩', toName:'雅加达', name:'香港→雅加达(东南亚)', transit:7, trend:'stable', prices:{'20gp':500,'40gp':750,'40hq':950}, range:'印尼基本港' },
  { key:'HKHKG-MYTPP', from:'HKHKG', to:'MYTPP', fromFlag:'🇭🇰', fromName:'香港', toFlag:'🇲🇾', toName:'丹绒帕拉帕斯', name:'香港→丹绒帕拉帕斯(东南亚)', transit:11, trend:'stable', prices:{'20gp':550,'40gp':800,'40hq':1000}, range:'马来西亚新港' },
  { key:'HKHKG-KRPUS', from:'HKHKG', to:'KRPUS', fromFlag:'🇭🇰', fromName:'香港', toFlag:'🇰🇷', toName:'釜山', name:'香港→釜山(日韩)', transit:5, trend:'stable', prices:{'20gp':300,'40gp':450,'40hq':550}, range:'韩国基本港' },
  { key:'HKHKG-JPTYO', from:'HKHKG', to:'JPTYO', fromFlag:'🇭🇰', fromName:'香港', toFlag:'🇯🇵', toName:'东京', name:'香港→东京(日韩)', transit:7, trend:'stable', prices:{'20gp':400,'40gp':600,'40hq':750}, range:'日本关东基本港' },
  { key:'HKHKG-JPYOK', from:'HKHKG', to:'JPYOK', fromFlag:'🇭🇰', fromName:'香港', toFlag:'🇯🇵', toName:'横滨', name:'香港→横滨(日韩)', transit:7, trend:'stable', prices:{'20gp':450,'40gp':600,'40hq':780}, range:'' },
  { key:'HKHKG-JPOSA', from:'HKHKG', to:'JPOSA', fromFlag:'🇭🇰', fromName:'香港', toFlag:'🇯🇵', toName:'大阪', name:'香港→大阪(日韩)', transit:6, trend:'stable', prices:{'20gp':400,'40gp':550,'40hq':720}, range:'日本关西基本港' },
  { key:'HKHKG-AUMEL', from:'HKHKG', to:'AUMEL', fromFlag:'🇭🇰', fromName:'香港', toFlag:'🇦🇺', toName:'墨尔本', name:'香港→墨尔本(澳新)', transit:18, trend:'stable', prices:{'20gp':1550,'40gp':2200,'40hq':2800}, range:'$2200-3500' },
  { key:'HKHKG-AUSYD', from:'HKHKG', to:'AUSYD', fromFlag:'🇭🇰', fromName:'香港', toFlag:'🇦🇺', toName:'悉尼', name:'香港→悉尼(澳新)', transit:17, trend:'stable', prices:{'20gp':1600,'40gp':2250,'40hq':2900}, range:'' },
  { key:'HKHKG-AUBNE', from:'HKHKG', to:'AUBNE', fromFlag:'🇭🇰', fromName:'香港', toFlag:'🇦🇺', toName:'布里斯班', name:'香港→布里斯班(澳新)', transit:19, trend:'stable', prices:{'20gp':1550,'40gp':2200,'40hq':2850}, range:'' },
  { key:'HKHKG-NZAKL', from:'HKHKG', to:'NZAKL', fromFlag:'🇭🇰', fromName:'香港', toFlag:'🇳🇿', toName:'奥克兰', name:'香港→奥克兰(澳新)', transit:20, trend:'stable', prices:{'20gp':1700,'40gp':2400,'40hq':3100}, range:'新西兰基本港' },
  { key:'HKHKG-BRSSZ', from:'HKHKG', to:'BRSSZ', fromFlag:'🇭🇰', fromName:'香港', toFlag:'🇧🇷', toName:'桑托斯', name:'香港→桑托斯(南美东)', transit:40, trend:'up', prices:{'20gp':3600,'40gp':5100,'40hq':6550}, range:'$5500-7500' },
  { key:'HKHKG-MXZLO', from:'HKHKG', to:'MXZLO', fromFlag:'🇭🇰', fromName:'香港', toFlag:'🇲🇽', toName:'曼萨尼约', name:'香港→曼萨尼约(拉美)', transit:22, trend:'up', prices:{'20gp':2900,'40gp':4100,'40hq':5250}, range:'墨西哥西岸基本港' },
  { key:'HKHKG-PECLL', from:'HKHKG', to:'PECLL', fromFlag:'🇭🇰', fromName:'香港', toFlag:'🇵🇪', toName:'卡亚俄', name:'香港→卡亚俄(南美西)', transit:30, trend:'stable', prices:{'20gp':3050,'40gp':4350,'40hq':5550}, range:'秘鲁基本港' },
  { key:'HKHKG-CLVAP', from:'HKHKG', to:'CLVAP', fromFlag:'🇭🇰', fromName:'香港', toFlag:'🇨🇱', toName:'瓦尔帕莱索', name:'香港→瓦尔帕莱索(南美西)', transit:34, trend:'stable', prices:{'20gp':3100,'40gp':4400,'40hq':5650}, range:'智利基本港' },
  { key:'HKHKG-ARBUE', from:'HKHKG', to:'ARBUE', fromFlag:'🇭🇰', fromName:'香港', toFlag:'🇦🇷', toName:'布宜诺斯艾利斯', name:'香港→布宜诺斯艾利斯(南美东)', transit:42, trend:'up', prices:{'20gp':3750,'40gp':5350,'40hq':6850}, range:'阿根廷基本港' },
  { key:'HKHKG-ZADUR', from:'HKHKG', to:'ZADUR', fromFlag:'🇭🇰', fromName:'香港', toFlag:'🇿🇦', toName:'德班', name:'香港→德班(非洲)', transit:27, trend:'stable', prices:{'20gp':2500,'40gp':3500,'40hq':4500}, range:'$3800-5500' },
  { key:'HKHKG-NGLOS', from:'HKHKG', to:'NGLOS', fromFlag:'🇭🇰', fromName:'香港', toFlag:'🇳🇬', toName:'拉各斯', name:'香港→拉各斯(非洲)', transit:34, trend:'up', prices:{'20gp':3050,'40gp':4350,'40hq':5550}, range:'西非基本港（阿帕帕）' },
  { key:'HKHKG-ZACPT', from:'HKHKG', to:'ZACPT', fromFlag:'🇭🇰', fromName:'香港', toFlag:'🇿🇦', toName:'开普敦', name:'香港→开普敦(非洲)', transit:30, trend:'stable', prices:{'20gp':2350,'40gp':3350,'40hq':4300}, range:'南非' },
  { key:'HKHKG-KEMBA', from:'HKHKG', to:'KEMBA', fromFlag:'🇭🇰', fromName:'香港', toFlag:'🇰🇪', toName:'蒙巴萨', name:'香港→蒙巴萨(非洲)', transit:24, trend:'stable', prices:{'20gp':2200,'40gp':3100,'40hq':4000}, range:'东非基本港' },
  { key:'HKHKG-EGPSD', from:'HKHKG', to:'EGPSD', fromFlag:'🇭🇰', fromName:'香港', toFlag:'🇪🇬', toName:'塞得港', name:'香港→塞得港(地中海)', transit:25, trend:'stable', prices:{'20gp':2650,'40gp':3750,'40hq':4800}, range:'埃及地中海基本港' }
];
const frAllRoutes = computed(() => {
  // 显示当前起运港的航线 + 其他起运港主航线
  const originRoutes = FR_ROUTES.filter(r => r.from === frOrigin.value);
  return originRoutes;
});
const frCurrentRoute = computed(() => {
  return FR_ROUTES.find(r => r.from === frOrigin.value && r.to === frDest.value);
});
const frPrice = computed(() => {
  if (!frCurrentRoute.value) return 0;
  return frCurrentRoute.value.prices[frContainer.value] || 0;
});
const frPriceDisplay = computed(() => {
  const p = frPrice.value;
  if (!p) return '-';
  return '$' + p.toLocaleString();
});
const frTrend = computed(() => frCurrentRoute.value?.trend || 'stable');
const frTrendClass = computed(() => 'fr-' + frTrend.value);
const frRangeText = computed(() => frCurrentRoute.value?.range || '');

// 首次进入时拉取（挂在onMounted里已有worldclock的，追加即可）


// L2: Poll for pending business confirmations every 30 seconds
function onBizConfirmedElsewhere(e) {
  const cid = e.detail && e.detail.id;
  if (cid == null) return;
  const idx = bizConfirmPending.value.findIndex(c => c.id === cid);
  if (idx !== -1) {
    bizConfirmDismissed.value.add(cid);
    bizConfirmPending.value.splice(idx, 1);
    if (currentBizConfirmIdx.value >= bizConfirmPending.value.length) {
      currentBizConfirmIdx.value = 0;
    }
  }
}

onMounted(() => {
  loadBizConfirmPending();
  const bizConfirmTimer = setInterval(loadBizConfirmPending, 30000);
  window.__bizConfirmTimer = bizConfirmTimer;
  window.addEventListener('l2-biz-confirmed', onBizConfirmedElsewhere);
});

onUnmounted(() => {
  window.removeEventListener('l2-biz-confirmed', onBizConfirmedElsewhere);
  if (window.__bizConfirmTimer) clearInterval(window.__bizConfirmTimer);
});

</script>

<style scoped>
/* ========== 基础 ========== */
.crm-layout {
  display: flex;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  background: var(--chat-bg);
  color: var(--text-primary);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 14px;
}

/* ========== ① 平台导航栏 ========== */
.platform-nav {
  width: 160px;
  background: var(--panel-bg);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  border-right: 1px solid var(--border-color);
  transition: width 0.2s ease;
  position: relative;
  z-index: 50;
}
.platform-collapsed .platform-nav { width: 56px; }
.platform-nav-top { flex: 1; display: flex; flex-direction: column; overflow: visible; }

.platform-logo-row {
  display: flex; align-items: center; justify-content: flex-start;
  padding: 6px 6px 2px 10px; flex-shrink: 0; min-width: 0;
  position: relative;
}
.logo-wrap {
  display: flex; align-items: center; gap: 8px;
  padding: 0; cursor: pointer; height: 40px; min-width: 0;
}
.logo-icon {
  width: 26px; height: 26px; object-fit: contain;
  border-radius: 6px; flex-shrink: 0; display: block;
  background: #fff; padding: 2px;
}
.logo-text { font-size: 15px; font-weight: 700; white-space: nowrap; color: var(--accent); }

.platform-menu { flex: 1; padding: 4px 8px; overflow-y: auto; }
.platform-item-wrap { position: relative; }
.platform-item {
  display: flex; align-items: center; gap: 10px;
  padding: 9px 8px; margin: 2px 0;
  border-radius: 8px; color: var(--text-secondary);
  cursor: pointer; transition: all 0.15s;
  position: relative; white-space: nowrap;
}
.platform-item:hover { background: var(--panel-header-bg); color: var(--text-primary); }
.platform-item.active { background: #00a88420; color: var(--accent); }
.platform-collapsed .platform-item { justify-content: center; padding: 0; width: 40px; height: 40px; box-sizing: border-box; margin: 2px auto; }
.platform-collapsed .platform-logo-row { justify-content: center; padding: 8px 0 2px; gap: 0; }
.platform-collapsed .logo-wrap { justify-content: center; padding: 0; height: 30px; gap: 0; }
.platform-collapsed .logo-icon { width: 22px; height: 22px; padding: 1px; }
.platform-collapsed .logo-text { display: none; }
.platform-collapsed .platform-nav-bottom { padding: 8px; align-items: center; }
.platform-collapsed .p-setting,
.platform-collapsed .p-logout,
.platform-collapsed .p-collapse { justify-content: center; padding: 10px 0; gap: 0; }
.platform-collapsed .p-setting span:not(.p-icon),
.platform-collapsed .p-logout span:not(.p-icon) { display: none; }
.p-icon { display: flex; align-items: center; justify-content: center; flex-shrink: 0; line-height: 0; width: 22px; height: 22px; }
.p-icon svg { display: block; }
.p-icon:empty { width: 22px; height: 22px; flex-shrink: 0; }
.p-label { font-size: 13px; font-weight: 500; line-height: 1.3; display: flex; align-items: center; }
.p-badge {
  margin-left: auto; background: var(--accent); color: #fff;
  font-size: 11px; padding: 1px 7px; border-radius: 10px; font-weight: 600;
}

.platform-nav-bottom {
  border-top: 1px solid var(--border-color); padding: 8px 6px;
  display: flex; flex-direction: column; gap: 2px; flex-shrink: 0;
}
.wa-status-mini {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 10px; font-size: 12px; color: var(--text-secondary);
  border-radius: 6px; cursor: pointer; position: relative;
}
.platform-collapsed .wa-status-mini { justify-content: center; padding: 8px 0; }
.wa-status-mini .status-dot {
  width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; background: var(--text-secondary);
}
.wa-status-mini.connected .status-dot { background: var(--accent); box-shadow: 0 0 6px #00a88480; }
.wa-status-mini.error .status-dot { background: var(--danger); }

.p-setting, .p-collapse, .p-logout, .p-theme {
  display: flex; align-items: center; gap: 12px;
  width: 100%; padding: 9px 10px;
  background: none; border: none; color: var(--text-secondary);
  cursor: pointer; border-radius: 6px; font-size: 13px; line-height: 1; transition: all 0.15s;
}
.p-theme:hover, .p-setting:hover, .p-collapse:hover { background: var(--panel-header-bg); color: var(--text-primary); }
.p-logout:hover { background: #ea433520; color: var(--danger); }
.platform-collapsed .p-theme, .platform-collapsed .p-setting, .platform-collapsed .p-collapse, .platform-collapsed .p-logout {
  justify-content: center; padding: 0; width: 40px; height: 40px; box-sizing: border-box; border-radius: 8px; margin: 0 auto;
}
.p-collapse-bottom {
  display: flex; align-items: center; gap: 12px;
  width: 100%; padding: 9px 10px;
  background: none; border: none; color: var(--text-secondary);
  cursor: pointer; border-radius: 6px; font-size: 13px; line-height: 1;
  transition: all 0.15s;
}
.p-collapse-bottom:hover { background: var(--panel-header-bg); color: var(--text-primary); }
.p-collapse-bottom svg { flex-shrink: 0; display: block; }
.platform-collapsed .p-collapse-bottom {
  justify-content: center; padding: 0; width: 40px; height: 40px; box-sizing: border-box; border-radius: 8px; margin: 0 auto;
}
.platform-collapsed .p-collapse-bottom span { display: none; }

/* 反馈建议入口 */
.p-feedback-wrap { position: relative; }
.p-feedback-btn { position: relative; }
.p-feedback-arrow { margin-left: auto; transition: transform .2s; opacity: .55; flex-shrink: 0; }
.p-feedback-arrow.open { transform: rotate(180deg); }
.p-feedback-menu {
  position: absolute; bottom: calc(100% + 6px); left: 8px; right: 8px;
  background: var(--panel-bg); border: 1px solid var(--border-color);
  border-radius: 8px; padding: 4px; box-shadow: 0 4px 16px rgba(0,0,0,0.18);
  z-index: 1100;
}
.p-feedback-item {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 10px; border-radius: 6px; font-size: 13px;
  color: var(--text-secondary); text-decoration: none; cursor: pointer;
  transition: all 0.15s;
}
.p-feedback-item:hover { background: var(--panel-header-bg); color: var(--text-primary); }
.p-feedback-item-icon { flex-shrink: 0; font-size: 15px; line-height: 1; }
.platform-collapsed .p-feedback-menu {
  left: auto; right: 0; bottom: calc(100% + 6px);
  width: 160px;
}

/* tooltip */
.p-tooltip {
  position: absolute; left: calc(100% + 8px); top: 50%;
  transform: translateY(-50%);
  background: #233138; color: var(--text-primary);
  padding: 5px 10px; border-radius: 6px; font-size: 12px;
  white-space: nowrap; opacity: 0; pointer-events: none;
  transition: opacity 0.15s; z-index: 1000;
  box-shadow: 0 2px 8px rgba(0,0,0,0.3);
}
.p-tooltip::before {
  content: ''; position: absolute; left: -4px; top: 50%;
  transform: translateY(-50%);
  border: 4px solid transparent; border-right-color: #233138;
}
.p-tooltip.right { left: auto; right: calc(100% + 8px); }
.p-tooltip.right::before {
  left: auto; right: -4px;
  border-right-color: transparent; border-left-color: #233138;
}
.platform-item:hover > .p-tooltip,
.wa-status-mini:hover > .p-tooltip,
.p-theme:hover > .p-tooltip,
.p-setting:hover > .p-tooltip,
.p-logout:hover > .p-tooltip,

.ch-icon-btn:hover > .p-tooltip { opacity: 1; }
.platform-nav:not(.platform-collapsed) .p-tooltip { display: none; }

/* ========== 工作区 ========== */
.workspace { flex: 1; display: flex; overflow: hidden; min-width: 0; width: 0; }
.comm-module { flex: 1; display: flex; overflow: hidden; min-width: 0;  position: relative; }
.module-full { flex: 1; display: flex; flex-direction: column; overflow-y: auto; overflow-x: hidden; min-width: 0; min-height: 0; width: 100%; -webkit-overflow-scrolling: touch; }

/* ② 账号/渠道栏 */
.col-accounts {
  width: 240px; background: var(--panel-bg);
  border-right: 1px solid var(--border-color);
  display: flex; flex-direction: column;
  flex-shrink: 0; transition: width 0.2s; overflow: hidden;
}
.col-accounts.collapsed { width: 54px; }

.col-header {
  height: 56px; display: flex; align-items: center;
  padding: 0 12px; border-bottom: 1px solid var(--border-color);
  gap: 6px; flex-shrink: 0; background: var(--panel-header-bg);
}
.col-title {
  flex: 1; font-size: 13px; font-weight: 600;
  color: var(--text-primary); white-space: nowrap;
}
.col-toggle {
  width: 28px; height: 28px;
  display: flex; align-items: center; justify-content: center;
  background: none; border: none; color: var(--text-secondary); cursor: pointer;
  border-radius: 6px;
}
.col-toggle:hover { background: var(--sidebar-active); color: var(--text-primary); }
.col-toggle-avatar {
  width: 36px !important; height: 36px !important;
  border-radius: 50% !important;
  padding: 0 !important;
  overflow: hidden;
  background: var(--sidebar-active, #2a3942) !important;
  border: 2px solid var(--border-color, #374248) !important;
  flex-shrink: 0;
}
.col-toggle-avatar:hover {
  border-color: var(--accent, #00a884) !important;
  transform: scale(1.08);
}
.col-avatar-img {
  width: 100%; height: 100%;
  object-fit: cover;
  display: block;
}
.col-avatar-fallback {
  width: 100%; height: 100%;
  display: flex; align-items: center; justify-content: center;
  font-size: 15px; font-weight: 600;
  color: var(--text-primary, #e9edef);
  background: linear-gradient(135deg, #00a884, #008069);
  text-transform: uppercase;
}

/* 渠道下拉选择器 */
.channel-selector { padding: 10px; position: relative; }
.ch-select-btn {
  width: 100%; display: flex; align-items: center; gap: 8px;
  padding: 9px 12px; background: var(--panel-header-bg); border: 1.5px solid transparent;
  border-radius: 10px; color: var(--text-primary); cursor: pointer;
  font-size: 13px; font-weight: 500; transition: all 0.15s;
}
.ch-select-btn:hover { background: var(--sidebar-active); border-color: #00a88450; }
.ch-select-icon { display: flex; color: var(--accent); }
.ch-select-name { flex: 1; text-align: left; }
.ch-select-arrow {
  color: var(--text-secondary); transition: transform 0.2s;
}
.ch-select-arrow.open { transform: rotate(180deg); }
.ch-unread {
  background: var(--accent); color: #fff; font-size: 10px;
  padding: 1px 6px; border-radius: 8px; font-weight: 600;
}

.ch-dropdown {
  position: absolute; top: calc(100% - 4px); left: 10px; right: 10px;
  background: var(--panel-header-bg); border: 1px solid var(--sidebar-active);
  border-radius: 10px; padding: 6px;
  z-index: 100; box-shadow: 0 8px 24px rgba(0,0,0,0.4);
  animation: fadeIn 0.15s ease-out;
}
@keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
.ch-dd-item {
  display: flex; align-items: center; gap: 10px;
  padding: 9px 10px; border-radius: 6px;
  cursor: pointer; font-size: 13px; color: var(--text-primary);
  transition: background 0.1s;
}
.ch-dd-item:hover { background: var(--sidebar-active); color: var(--text-primary); }
.ch-dd-item.active { color: var(--accent); }
.ch-dd-item svg { color: var(--text-secondary); }
.ch-dd-item.active svg { color: var(--accent); }
.ch-check { margin-left: auto; color: var(--accent); font-size: 14px; font-weight: 700; }
.ch-dd-divider { height: 1px; background: var(--sidebar-active); margin: 4px 0; }
.ch-dd-add {
  display: flex; align-items: center; gap: 10px;
  width: 100%; padding: 9px 10px; background: none;
  border: 1.5px dashed var(--sidebar-active); border-radius: 8px;
  color: var(--text-secondary); cursor: pointer; font-size: 13px;
  transition: all 0.15s;
}
.ch-dd-add:hover { border-color: var(--accent); color: var(--accent); background: #00a88410; }
.ch-add-icon {
  width: 20px; height: 20px; display: flex;
  align-items: center; justify-content: center;
  border-radius: 50%; background: var(--sidebar-active); font-size: 14px; font-weight: 700;
}

/* 添加账号 */
.add-account-btn {
  margin: 0 10px 8px;
  display: flex; align-items: center; justify-content: center; gap: 6px;
  padding: 10px; background: none;
  border: 1.5px dashed var(--sidebar-active); border-radius: 10px;
  color: var(--text-secondary); cursor: pointer; font-size: 13px;
  transition: all 0.15s;
}
.add-account-btn:hover { border-color: var(--accent); color: var(--accent); background: #00a88408; }
.add-icon { font-size: 16px; font-weight: 700; }

/* 账号列表 */
.account-list { flex: 1; overflow-y: auto; padding: 4px 8px 8px; }
.account-card {
  display: flex; align-items: center; gap: 10px;
  padding: 8px; margin-bottom: 2px;
  border-radius: 8px; cursor: pointer;
  transition: background 0.15s; position: relative;
}
.account-card:hover { background: var(--panel-header-bg); }
.account-card.active { background: var(--sidebar-active); }
.acc-avatar {
  width: 42px; height: 42px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-weight: 600; font-size: 16px;
  flex-shrink: 0; position: relative;
}
.acc-online-dot {
  position: absolute; right: 0; bottom: 0;
  width: 12px; height: 12px; border-radius: 50%;
  background: var(--accent); border: 2px solid var(--panel-bg);
}
.account-card.offline .acc-online-dot { background: var(--text-muted); }
.acc-info { flex: 1; min-width: 0; }
.acc-name { font-size: 13px; font-weight: 500; color: var(--text-primary); }
.acc-meta { font-size: 11px; color: var(--text-secondary); margin-top: 2px; }
.acc-meta.online-text { color: var(--accent); }
.acc-meta.offline-text { color: var(--text-muted); }
.wa-account-item {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px; border-radius: 8px; cursor: pointer;
  transition: background 0.15s; position: relative;
  margin-bottom: 4px;
}
.wa-account-item:hover { background: var(--panel-header-bg); }
.wa-account-item.active { background: var(--sidebar-active); }
.acc-check {
  color: var(--accent); font-weight: 700; font-size: 14px;
  flex-shrink: 0;
}
.acc-proxy-tag {
  display: inline-block; font-size: 10px;
  color: var(--text-secondary); opacity: 0.7;
  margin-left: 4px;
}
.acc-avatar-img {
  width: 100%; height: 100%; border-radius: 50%; object-fit: cover;
}
.wa-account-card {
  display: flex; align-items: center; gap: 10px;
  padding: 10px; border-radius: 8px;
  background: var(--panel-header-bg);
  border: 1px solid #00a88430;
}
.acc-disconnect-btn {
  background: none; border: none; color: var(--text-secondary);
  font-size: 16px; cursor: pointer; padding: 6px 8px;
  border-radius: 6px;
}
.acc-disconnect-btn:hover { background: #ea433520; color: var(--danger); }
.wa-show-qr-btn {
  margin-top: 8px;
  width: 100%;
  padding: 8px;
  background: transparent;
  border: 1px solid var(--sidebar-active);
  color: var(--text-secondary);
  border-radius: 6px;
  cursor: pointer; font-size: 12px;
}
.wa-show-qr-btn:hover { border-color: var(--accent); color: var(--accent); }
.wa-qr-inline {
  margin-top: 10px;
  display: flex; flex-direction: column; align-items: center; gap: 8px;
}
.wa-qr-img {
  width: 160px; height: 160px;
  background: #fff; border-radius: 6px; padding: 6px;
}
.wa-qr-hint {
  font-size: 10px; color: var(--text-secondary); text-align: center; line-height: 1.4;
}
.wa-connect-btn:disabled { opacity: 0.6; cursor: wait; }


/* 折叠态账号头像按钮 */
.ch-avatar-btn{width:40px;height:40px;margin:8px auto 0;display:flex;align-items:center;justify-content:center;border-radius:50%;cursor:pointer;position:relative;transition:transform .15s}
.ch-avatar-btn:hover{transform:scale(1.08)}
.ch-avatar-stack{display:flex;flex-direction:column;align-items:center;gap:8px;padding:4px 0;}
.ch-avatar{width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:600;font-size:15px;overflow:hidden;border:2px solid var(--border-color);transition:border-color .15s}
.ch-avatar-btn.active .ch-avatar{border-color:var(--accent,#00a884)}
.ch-avatar-img{width:100%;height:100%;object-fit:cover}
.ch-avatar-initial{text-transform:uppercase}
.channel-icons {
  display: flex; flex-direction: column; align-items: center;
  gap: 8px; padding: 10px 0; flex: 1;
}
.ch-icon-btn {
  width: 36px; height: 36px;
  display: flex; align-items: center; justify-content: center;
  background: var(--panel-header-bg); border-radius: 8px;
  color: var(--text-secondary); cursor: pointer; position: relative;
  transition: all 0.15s;
}
.ch-icon-btn:hover { background: var(--sidebar-active); color: var(--text-primary); }
.ch-icon-btn.active { background: #00a88430; color: var(--accent); }
.ch-icon-btn.online { box-shadow: inset 0 -3px 0 var(--accent); }
.ch-icon-badge {
  position: absolute; top: -3px; right: -3px;
  background: var(--accent); color: #fff;
  font-size: 9px; padding: 1px 4px; border-radius: 8px; font-weight: 600;
}
.ch-icon-add {
  width: 36px; height: 36px;
  display: flex; align-items: center; justify-content: center;
  background: var(--panel-header-bg); border: 1px dashed var(--sidebar-active);
  color: var(--text-secondary); border-radius: 8px; cursor: pointer; font-size: 20px;
}

/* ③ 状态栏 */
/* ④ 聊天列表 */
/* 渠道图标切换条 */
.ch-switch {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: 12px;
  padding: 16px 8px;
  background: var(--panel-bg);
  border-right: 1px solid var(--border-color);
  border-bottom: none;
  z-index: 20;
  flex-shrink: 0;
  width: 56px;
  min-width: 56px;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
}
.ch-sw-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  background: var(--panel-header-bg);
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  position: relative;
  transition: all 0.2s ease;
  flex-shrink: 0;
}
.ch-sw-btn:active { transform: scale(0.92); }
.ch-sw-btn.active {
  background: var(--accent);
  color: #fff;
  box-shadow: 0 2px 8px rgba(0,168,132,0.35);
}
.ch-sw-btn:has(svg) svg, .ch-sw-btn span { display: block; }
.ch-sw-btn img.ch-sw-wa-img{width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;}
.ch-sw-btn:has(img.ch-sw-wa-img){background:transparent;padding:0;}
.ch-sw-badge {
  position: absolute;
  top: -2px;
  right: -2px;
  background: #ef4444;
  color: #fff;
  font-size: 10px;
  font-weight: 600;
  min-width: 16px;
  height: 16px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
  border: 2px solid var(--panel-bg);
  box-sizing: content-box;
}
.ch-sw-warn { background: #f59e0b; }
/* 未来禁用的渠道（如facebook等尚未接通）：灰度降低opacity */
.ch-sw-btn.disabled { opacity: 0.35; cursor: not-allowed; }

.col-chatlist {
  display: flex;
  flex-direction: column;
  width: 340px; background: var(--panel-bg);
  border-right: 1px solid var(--border-color);
  display: flex; flex-direction: column;
  flex-shrink: 0; transition: width 0.2s; overflow: hidden;
}
.col-chatlist.collapsed { width: 40px; }
.col-chatlist.collapsed .col-header { justify-content: center; padding: 0 6px; }
.search-box {
  flex: 1; display: flex; align-items: center; gap: 8px;
  background: var(--panel-header-bg); padding: 6px 12px; border-radius: 8px;
}
.search-box input {
  flex: 1; background: transparent; border: none;
  color: var(--text-primary); font-size: 13px; outline: none;
}
.search-box svg { color: var(--text-secondary); flex-shrink: 0; }
.chat-filters {
  padding: 10px 12px;
  border-bottom: 1px solid var(--border-color);
  background: var(--panel-bg);
  flex-shrink: 0;
}
.filter-tabs {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  scrollbar-width: none;
}
.filter-tabs::-webkit-scrollbar { display: none; }
.filter-tab {
  flex-shrink: 0;
  padding: 5px 12px;
  background: var(--panel-header-bg);
  color: var(--text-secondary);
  border: none;
  border-radius: 16px;
  font-size: 13px;
  cursor: pointer;
  font-family: inherit;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  transition: background 0.15s, color 0.15s;
  white-space: nowrap;
}
.filter-tab:hover { background: var(--sidebar-active); color: var(--text-primary); }
.filter-tab.active {
  background: var(--accent);
  color: var(--accent-text);
  font-weight: 500;
}
.filter-tab-badge {
  background: rgba(255,255,255,0.25);
  font-size: 11px;
  border-radius: 10px;
  padding: 1px 6px;
  margin-left: 2px;
}
.filter-tab.active .filter-tab-badge { background: rgba(var(--accent-text-rgb),0.2); color: var(--accent-text); }
.filter-tab-more { padding: 5px 10px; }
.chatlist-body { flex: 1; overflow-y: auto; }
.conv-item {
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  user-select: none;
  touch-action: pan-y;
  display: flex; gap: 10px; padding: 10px 12px;
  cursor: pointer; border-bottom: 1px solid #222d3430;
  transition: background 0.15s;
}
.conv-item:hover { background: var(--panel-header-bg); }
.conv-item.active { background: var(--sidebar-active); }
.conv-avatar {
  width: 46px; height: 46px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-weight: 600; flex-shrink: 0; position: relative;
}
.conv-status-dot {
  position: absolute; right: 0; bottom: 0;
  width: 12px; height: 12px; border-radius: 50%;
  background: var(--accent); border: 2px solid var(--panel-bg);
}
.conv-status-dot.offline { background: var(--text-muted); }
.conv-followup-dot {
  position: absolute; left: 0; top: 2px;
  width: 10px; height: 10px; border-radius: 50%;
  border: 2px solid var(--panel-bg);
}
.conv-followup-dot.fu-dot-urgent { background: #f5a623; }
.conv-followup-dot.fu-dot-followup { background: var(--accent); }
.conv-followup-dot.fu-dot-reactivate { background: var(--accent-info); }
.conv-followup-dot-inline {
  display: inline-block;
  width: 8px; height: 8px; border-radius: 50%;
  margin-right: 6px; vertical-align: middle;
}
.conv-followup-dot-inline.fu-dot-urgent { background: #f5a623; }
.conv-followup-dot-inline.fu-dot-followup { background: var(--accent); }
.conv-followup-dot-inline.fu-dot-reactivate { background: var(--accent-info); }

/* ⚡ 5分钟首响提醒条（最醒目） */
.first-response-bar {
  margin: 8px 8px 0 8px;
  padding: 10px 14px;
  border-radius: 10px;
  background: linear-gradient(135deg, var(--danger) 0%, #b9303f 100%);
  color: #fff;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  user-select: none;
  box-shadow: 0 2px 12px rgba(241, 92, 109, 0.35);
  animation: frb-pulse 2s ease-in-out infinite;
  position: relative;
  overflow: hidden;
}
.first-response-bar::before {
  content: '';
  position: absolute;
  top: 0; left: -100%;
  width: 100%; height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent);
  animation: frb-shine 3s ease-in-out infinite;
}
@keyframes frb-pulse {
  0%, 100% { box-shadow: 0 2px 12px rgba(241, 92, 109, 0.35); }
  50% { box-shadow: 0 2px 22px rgba(241, 92, 109, 0.7); }
}
@keyframes frb-shine {
  0% { left: -100%; }
  60%, 100% { left: 100%; }
}
.frb-icon {
  font-size: 20px;
  animation: frb-bell 1s ease-in-out infinite;
  flex-shrink: 0;
}
@keyframes frb-bell {
  0%, 100% { transform: rotate(0); }
  20% { transform: rotate(15deg); }
  40% { transform: rotate(-12deg); }
  60% { transform: rotate(8deg); }
  80% { transform: rotate(-4deg); }
}
.frb-text {
  font-weight: 700;
  flex-shrink: 0;
  text-shadow: 0 1px 2px rgba(0,0,0,0.2);
}
.frb-names {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  opacity: 0.95;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.frb-name {
  color: #fff;
  font-weight: 600;
  text-decoration: underline;
  cursor: pointer;
  text-underline-offset: 2px;
}
.frb-name:hover { color: #ffe9ec; }
.frb-more { opacity: 0.8; font-style: italic; }
.frb-btn {
  background: #fff;
  color: #b9303f;
  border: none;
  padding: 6px 14px;
  border-radius: 8px;
  font-weight: 700;
  font-size: 12.5px;
  cursor: pointer;
  flex-shrink: 0;
  transition: transform .1s, background .15s;
  margin-left: 6px;
}
.frb-btn:hover { background: #ffe9ec; transform: scale(1.04); }
.frb-btn:active { transform: scale(0.98); }
.frb-btn-dismiss {
  background: rgba(255,255,255,0.2) !important;
  color: #fff !important;
  font-weight: 500 !important;
}
.frb-btn-dismiss:hover { background: rgba(255,255,255,0.35) !important; }
/* 移动端适配：名字超长时截断，确保按钮可见 */
@media (max-width: 900px) {
  .first-response-bar { gap: 6px; padding: 8px 10px; font-size: 12px; flex-wrap: nowrap; overflow: hidden; }
  .first-response-bar .frb-icon { font-size: 16px; }
  .first-response-bar .frb-text { font-size: 12px; flex-shrink: 1; min-width: 0; }
  .first-response-bar .frb-text b { font-size: 12px; }
  .first-response-bar .frb-names { display: none; } /* 移动端隐藏姓名列表，只保留数字+按钮 */
  .first-response-bar .frb-btn { padding: 5px 10px; font-size: 11.5px; margin-left: 3px; flex-shrink: 0 !important; white-space: nowrap; }
}

/* 首响会话高亮 */
.conv-item.conv-first-response {
  border-left: 3px solid var(--danger) !important;
  background: rgba(241, 92, 109, 0.08) !important;
  animation: conv-fr-glow 2.4s ease-in-out infinite;
}
@keyframes conv-fr-glow {
  0%, 100% { background: rgba(241, 92, 109, 0.06); }
  50% { background: rgba(241, 92, 109, 0.15); }
}
.conv-fr-badge {
  position: absolute;
  top: -2px; left: -4px;
  background: var(--danger);
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 8px;
  border: 1.5px solid var(--panel-bg);
  z-index: 2;
  line-height: 1.3;
}
.conv-fr-dot-inline {
  display: inline-block;
  color: var(--danger);
  font-size: 12px;
  margin-right: 4px;
  animation: frb-bell 1.2s ease-in-out infinite;
  vertical-align: middle;
}
.conv-fr-wait-text {
  color: var(--danger);
  font-weight: 600;
}

/* 待跟进汇总条 */
.followup-summary-bar {
  margin: 8px; padding: 10px 12px; border-radius: 10px;
  background: var(--panel-header-bg); color: var(--text-primary);
  font-size: 12.5px; display: flex; align-items: center; flex-wrap: wrap; gap: 8px;
  cursor: pointer; user-select: none;
  border: 1px solid transparent;
  transition: background .15s, border-color .15s;
}
.followup-summary-bar:hover { background: var(--sidebar-active); }
.followup-summary-bar.active { border-color: var(--accent); background: #1f3733; }
.fu-badge {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 2px 8px; border-radius: 10px;
  background: var(--sidebar-active); color: var(--text-primary); font-weight: 500;
}
.fu-badge.fu-urgent { color: #f5c98d; }
.fu-badge.fu-followup { color: #7cd9b7; }
.fu-badge.fu-reactivate { color: #a5dbf3; }
.fu-empty { color: var(--text-secondary); font-size: 12.5px; }
.fu-filter-on { color: var(--accent); font-size: 12px; margin-left: auto; }
.conv-item.conv-fu { border-left: 3px solid transparent; }
.conv-item.conv-fu:has(.fu-dot-urgent) { border-left-color: #f5a623; }
.conv-item.conv-fu:has(.fu-dot-followup) { border-left-color: var(--accent); }
.conv-item.conv-fu:has(.fu-dot-reactivate) { border-left-color: var(--accent-info); }
.conv-main { flex: 1; min-width: 0; }
.conv-row { display: flex; align-items: center; justify-content: space-between; }
.conv-row:last-child { margin-top: 3px; }
.conv-name { font-size: 14px; font-weight: 500; color: var(--text-primary); }
.conv-time { font-size: 11px; color: var(--text-secondary); flex-shrink: 0; }
.conv-preview {
  font-size: 12px; color: var(--text-secondary);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  flex: 1; margin-right: 6px;
}
.conv-unread {
  background: var(--accent); color: #fff;
  font-size: 10px; min-width: 18px; height: 18px;
  border-radius: 9px; display: flex; align-items: center; justify-content: center;
  font-weight: 600; padding: 0 5px;
}

/* ⑤ 对话区 */
.col-conversation {
  flex: 1; display: flex; flex-direction: column;
  min-width: 0; background: var(--chat-bg); overflow: hidden;
}
.conv-placeholder {
  flex: 1; display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  color: var(--text-secondary); gap: 8px;
}
.ph-icon { font-size: 64px; opacity: 0.3; }
.ph-title { font-size: 18px; color: var(--text-primary); }
.ph-desc { font-size: 13px; }

/* ⑥ AI面板 */
.col-aipanel { position: relative;
  width: 320px; background: var(--panel-bg);
  border-left: 1px solid var(--border-color);
  display: flex; flex-direction: column;
  flex-shrink: 0; transition: width 0.2s; overflow: hidden;
}
.col-aipanel.collapsed {
  width: 44px;
}
.col-aipanel.collapsed .col-header { padding: 10px 6px; justify-content: center; }
.col-aipanel.mini { width: 260px; }
.ai-resize-handle {
  position: absolute; left: -2px; top: 0; bottom: 0;
  width: 4px; cursor: col-resize; z-index: 20; background: transparent;
  transition: background .1s ease;
}
.ai-resize-handle:hover {
  background: var(--accent);
}
.ai-col-header { gap: 4px; }
.ai-title { flex: 1; display: flex; align-items: center; gap: 8px; padding-left: 4px; color: var(--text-primary); font-weight: 600; font-size: 13px; }
.ai-title-icon { font-size: 16px; }
.ai-mini-toggle { margin-left: 2px; }

.ai-body { flex: 1; display: flex; flex-direction: column; overflow: hidden; }

/* ── Mini mode ── */
.ai-mini {
  flex: 1; display: flex; flex-direction: column;
  padding: 6px; gap: 6px; overflow-y: auto;
}
.ai-actions-mini {
  gap: 5px;
  padding: 0;
  border-bottom: none;
  background: transparent;
}
.ai-actions-mini .ai-action-btn {
  height: 34px;
  font-size: 12px;
  border-radius: 6px;
  padding: 0 8px;
}
.ai-mini-tip { text-align: center; font-size: 11px; color: var(--text-secondary); padding: 4px 0; }
.ai-mini-expand {
  margin-top: auto; padding: 5px; background: transparent;
  border: 1px dashed var(--text-muted); color: var(--text-secondary); border-radius: 6px;
  font-size: 11px; cursor: pointer;
}
.ai-mini-expand:hover { color: var(--accent); border-color: var(--accent); }

/* ── Full mode ── */
.ai-full { flex: 1; display: flex; flex-direction: column; overflow: hidden; }

.ai-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px;
  border-bottom: 1px solid var(--border-color);
  background: var(--panel-bg);
}
.ai-action-btn {
  width: 100%;
  height: 42px;
  background: var(--panel-header-bg);
  border: 1px solid var(--sidebar-active);
  color: var(--text-primary);
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
  font-family: inherit;
  padding: 0 12px;
}
.ai-action-btn:hover:not(:disabled) { background: var(--sidebar-active); }
.ai-action-btn.hot {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--accent-text);
  font-weight: 600;
}
.ai-action-btn.hot:hover:not(:disabled) { background: #00c59b; border-color: #00c59b; }
.ai-action-btn.active { background: #00a88430 !important; border-color: var(--accent) !important; color: var(--accent) !important; }
.ai-action-btn.disabled, .ai-action-btn:disabled { opacity: 0.4; cursor: not-allowed; }

/* ── Result area ── */
.ai-result-area {
  flex: 1; overflow-y: auto; padding: 12px;
  display: flex; flex-direction: column; gap: 10px;
}
.ai-empty, .ai-welcome {
  margin: auto; text-align: center; color: var(--text-secondary); padding: 24px 12px;
}
.ai-empty-icon { font-size: 36px; margin-bottom: 8px; opacity: 0.5; }
.ai-empty-text, .ai-welcome-desc { font-size: 12px; color: var(--text-secondary); }
.ai-welcome-title { font-size: 13px; color: var(--text-primary); margin-bottom: 4px; }

.ai-result-header {
  display: flex; align-items: center; gap: 6px;
  font-size: 12px; padding-bottom: 4px;
  border-bottom: 1px solid #1f2c33;
}
.arh-title { font-weight: 600; color: var(--accent); font-size: 12px; }
.arh-ts { margin-left: auto; font-size: 11px; color: var(--text-muted); }

.ai-loading {
  display: flex; align-items: center; gap: 8px;
  padding: 16px 4px; color: var(--text-secondary); font-size: 12px;
}
.ai-dots { display: inline-flex; gap: 3px; }
.ai-dots span {
  width: 6px; height: 6px; border-radius: 50%; background: var(--accent);
  animation: aiBounce 1.2s infinite ease-in-out both;
}
.ai-dots span:nth-child(1) { animation-delay: -0.32s; }
.ai-dots span:nth-child(2) { animation-delay: -0.16s; }
@keyframes aiBounce {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.5; }
  40% { transform: scale(1); opacity: 1; }
}

.ai-error {
  background: #3b2a2a; color: #f08a8a; padding: 10px; border-radius: 8px;
  font-size: 12px; border-left: 3px solid var(--danger);
}

.ai-bubble {
  background: var(--panel-header-bg); border-radius: 10px; padding: 12px;
  font-size: 13px; line-height: 1.65; color: var(--text-primary);
  white-space: pre-wrap; word-break: break-word;
  border-top-left-radius: 2px;
}

/* ── Reply cards (click to fill) ── */
.ai-reply-list { display: flex; flex-direction: column; gap: 8px; }
.ai-reply-card {
  background: var(--sidebar-active); border: 1px solid transparent;
  border-radius: 8px; padding: 12px 12px 12px 36px;
  cursor: pointer; transition: all 0.15s;
  position: relative;
}
.ai-reply-card:hover { background: #00a88430; border-color: var(--accent); }
.ai-reply-card.flashed { background: var(--accent); border-color: var(--accent); }
.ai-reply-card.flashed .arc-text { color: #fff; }
.arc-idx {
  position: absolute; top: 10px; left: 10px;
  font-size: 11px; color: var(--accent); font-weight: 600;
}
.ai-reply-card.flashed .arc-idx { color: #fff; }
.arc-text {
  font-size: 13px; line-height: 1.6; color: var(--text-primary); white-space: pre-wrap;
  word-break: break-word;
}

/* ── Structured summary ── */
.ai-struct {
  background: var(--panel-header-bg); border-radius: 10px; padding: 12px;
  display: flex; flex-direction: column; gap: 6px;
}
.ais-row { display: flex; gap: 8px; font-size: 12px; line-height: 1.5; }
.ais-label { flex-shrink: 0; color: var(--accent); font-weight: 500; min-width: 78px; }
.ais-val { flex: 1; color: var(--text-primary); }
.ais-stars { color: #f5c542; }

/* ── Translate ── */
.ai-translate {
  background: var(--panel-header-bg); border-radius: 10px; padding: 12px;
  display: flex; flex-direction: column; gap: 10px;
}
.ait-label { font-size: 11px; color: var(--accent); font-weight: 600; margin-bottom: 3px; }
.ait-val { font-size: 13px; color: var(--text-primary); line-height: 1.5; white-space: pre-wrap; word-break: break-word; }
.ait-trans { font-size: 14px; font-weight: 500; }
.ait-orig { padding-top: 8px; border-top: 1px solid var(--sidebar-active); }
.ait-orig .ait-val { color: var(--text-secondary); font-size: 12px; }
.arc-fill-btn {
  align-self: flex-start;
  background: #00a88420; border: 1px solid #00a88460;
  color: var(--accent); padding: 5px 12px; border-radius: 4px;
  font-size: 11px; cursor: pointer; transition: all 0.15s;
}
.arc-fill-btn:hover { background: var(--accent); color: #fff; }

/* ── Result footer ── */
.ai-result-footer {
  display: flex; align-items: center; gap: 10px; padding-top: 6px;
  border-top: 1px solid #1f2c33; margin-top: 2px;
}
.arf-btn {
  background: transparent; border: 1px solid var(--text-muted);
  color: var(--text-secondary); padding: 5px 12px; border-radius: 6px;
  font-size: 11px; cursor: pointer; transition: all 0.15s;
}
.arf-btn:hover { color: var(--text-primary); border-color: var(--text-secondary); }
.arf-toast { font-size: 11px; color: var(--accent); animation: fadeIn 0.2s; }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

/* Mobile */
@media (max-width: 900px) {
  .ai-actions { gap: 6px; padding: 6px; }
  .ai-action-btn { height: 40px; font-size: 13px; border-radius: 8px; }
}


/* ⑥ 功能面板（AI助手 / 翻译设置） */
.col-function-panel { position: relative;
  width: 360px; background: var(--panel-bg);
  border-left: 1px solid var(--border-color);
  display: flex; flex-direction: column;
  flex-shrink: 0; transition: width .28s cubic-bezier(.4,0,.2,1); overflow: hidden;
}
.col-function-panel.collapsed {
  width: 0 !important;
  min-width: 0;
  border-left: none;
  overflow: hidden;
}
.col-function-panel.collapsed > * { visibility: hidden; }
.col-function-panel.collapsed .col-header { padding: 10px 6px; justify-content: center; }
.col-function-panel.mini { width: 260px; }
.col-function-panel.translating { background: var(--panel-bg); border-left: 1px solid var(--border-color); }
.col-function-panel.aitalking { background: var(--panel-bg); border-left: 1px solid var(--border-color); }
.col-function-panel.aitalking .panel-col-header { background: var(--panel-header-bg); color: var(--text-primary); border-bottom: 1px solid var(--border-color); }
.col-function-panel.aitalking .panel-col-header .col-toggle { color: var(--text-secondary); }
.col-function-panel.aitalking .panel-col-header .col-toggle:hover { background: var(--sidebar-active); color: var(--text-primary); }
.col-function-panel.customering { background: var(--panel-bg); border-left: 1px solid var(--border-color); }
.col-function-panel.customering .panel-col-header { background: var(--panel-header-bg); color: var(--text-primary); border-bottom: 1px solid var(--border-color); }
.col-function-panel.customering .ai-title { color: var(--text-primary); }
.col-function-panel.customering .panel-col-header .col-toggle { color: var(--text-secondary); }
.col-function-panel.customering .panel-col-header .col-toggle:hover { background: var(--sidebar-active); color: var(--text-primary); }
.col-function-panel.customering .panel-col-header .col-toggle:disabled { opacity:.5; cursor:not-allowed; }
.col-function-panel.bgchecking { background: var(--panel-bg); border-left: 1px solid var(--border-color); }
.col-function-panel.bgchecking .panel-col-header { background: var(--panel-header-bg); color: var(--text-primary); border-bottom: 1px solid var(--border-color); }
.col-function-panel.bgchecking .ai-title { color: var(--text-primary); }
.col-function-panel.bgchecking .panel-col-header .col-toggle { color: var(--text-secondary); }
.col-function-panel.bgchecking .panel-col-header .col-toggle:hover { background: var(--sidebar-active); color: var(--text-primary); }
.col-function-panel.bgchecking .panel-col-header .col-toggle:disabled { opacity:.5; cursor:not-allowed; }
.col-function-panel.aitalking .ai-title { color: var(--text-primary); }
.col-function-panel.translating .panel-col-header { background: var(--panel-header-bg); color: var(--text-primary); border-bottom: 1px solid var(--border-color); }
.col-function-panel.translating .panel-col-header .col-toggle { color: var(--text-secondary); }
.col-function-panel.translating .panel-col-header .col-toggle:hover { background: var(--sidebar-active); color: var(--text-primary); }
.col-function-panel .ai-resize-handle {
  position: absolute; left: -3px; top: 0; bottom: 0;
  width: 6px; cursor: col-resize; z-index: 10;
}
.col-function-panel .ai-resize-handle:hover { background: rgba(0,168,132,0.3); }
.panel-col-header { gap: 4px; }
.panel-col-header .ai-title { flex: 1; display: flex; align-items: center; gap: 8px; padding-left: 4px; font-weight: 600; font-size: 13px; }
.panel-col-header.ai-col-header .ai-title { color: var(--text-primary); }
.col-function-panel.translating .ai-title { color: var(--text-primary); }
.ai-mini-toggle { margin-left: 2px; }
.col-function-panel .ai-body { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.col-function-panel .ai-actions {
  display: flex; flex-wrap: wrap; gap: 6px;
  padding: 10px; border-bottom: 1px solid var(--border-color); background: var(--panel-bg);
}
.col-function-panel .ai-action-btn {
  flex: 1; min-width: 0;
  height: 34px; background: var(--panel-header-bg); color: var(--text-secondary);
  border: none; border-radius: 6px; cursor: pointer;
  font-size: 12px; display: flex; align-items: center; justify-content: center;
  transition: all .15s; font-family: inherit; padding: 0 6px; white-space: nowrap;
}
.col-function-panel .ai-action-btn:hover { background: var(--sidebar-active); color: var(--text-primary); }
.col-function-panel .ai-action-btn.active { background: #00a88430; color: var(--accent); }
.col-function-panel .ai-action-btn.hot { color: var(--accent); }
.col-function-panel .ai-action-btn:disabled { opacity: .35; cursor: not-allowed; }

/* 翻译设置面板 body — dark WhatsApp theme */
.trans-panel-body { flex: 1; overflow-y: auto; padding: 16px; background: var(--panel-bg); }
.trans-panel { padding: 0; }
.trans-block { background: transparent; border-radius: 0; padding: 2px 0 6px; margin-bottom: 4px; border-bottom: 1px solid var(--border-color); }
.trans-block:last-of-type { border-bottom: none; }
.switch-row { display: flex; align-items: center; height: 48px; padding: 0 4px; }
.switch-label { flex: 1; font-size: 15px; color: var(--text-primary); font-weight: 500; }
.sub-row { display: flex; align-items: center; min-height: 40px; padding: 0 4px 0 24px; margin-top: 2px; }
.sub-label { width: 72px; font-size: 14px; color: var(--text-secondary); flex-shrink: 0; }
.sub-select { flex: 1; }
.sub-help { color: var(--text-secondary); font-size: 14px; margin-right: 6px; cursor: help; transition: color .15s; }
.sub-help:hover { color: var(--accent); }
.switch-help { margin-left: 4px; }
.trans-divider { display: flex; align-items: center; margin: 16px 0; }
.trans-divider::before, .trans-divider::after { content: ''; flex: 1; height: 1px; background: var(--border-color); }
.trans-divider-text { padding: 0 12px; font-size: 12px; color: var(--text-secondary); }
.cfg-row { display: flex; align-items: center; min-height: 44px; padding: 0 4px; }
.cfg-help { margin-left: 4px; margin-right: 8px; }
.cfg-color-wrap { flex: 1; display: flex; align-items: center; gap: 8px; }
.cfg-color-input { flex: 1; height: 32px; border: 1px solid var(--text-muted); border-radius: 4px; padding: 0 10px; font-size: 13px; color: var(--text-primary); background: var(--sidebar-active); outline: none; font-family: monospace; min-width: 0; }
.cfg-color-input:focus { border-color: var(--accent); }
.cfg-color-picker { flex-shrink: 0; }
.trans-save-btn { width: 100%; height: 40px; margin-top: 16px; background: var(--accent); color: #fff; border: none; border-radius: 6px; font-size: 15px; font-weight: 500; cursor: pointer; transition: background .15s; font-family: inherit; }
.trans-save-btn:hover { background: #069671; }
.trans-save-btn:disabled { background: #3b5a54; color: var(--text-secondary); cursor: not-allowed; }

/* ⑦ 图标列 — dark WhatsApp theme */
.col-iconbar {
  width: 64px; background: var(--panel-header-bg);
  display: flex; flex-direction: column;
  flex-shrink: 0; border-left: 1px solid var(--border-color);
  transition: width 0.2s;
}
.col-iconbar.collapsed { width: 40px; }
.ib-items { flex: 1; display: flex; flex-direction: column; align-items: center; padding: 12px 0; gap: 8px; }
.ib-item { background: transparent; border: none; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 8px; border-radius: 8px; color: var(--text-secondary); width: 100%; font-family: inherit; transition: background .15s, color .15s; }
.ib-item:hover { background: var(--sidebar-active); }
.ib-item.active { color: var(--accent); }
.ib-icon { font-size: 22px; line-height: 1; }
.ib-label { font-size: 11px; white-space: nowrap; line-height: 1; opacity: 1; transform: translateX(0); transition: opacity .2s cubic-bezier(.4,0,.2,1), transform .28s cubic-bezier(.4,0,.2,1); }
.col-iconbar.collapsed .ib-label { opacity: 0; transform: translateX(-6px); pointer-events: none; }
.ib-toggle { margin-top: auto; align-self: center; width: 28px; height: 28px; border: none; background: var(--sidebar-active); border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; color: var(--text-secondary); margin-bottom: 12px; padding: 0; transition: background .15s, color .15s, transform .28s cubic-bezier(.4,0,.2,1); }
.ib-toggle:hover { background: var(--text-muted); color: var(--text-primary); }
.ib-toggle.expanded { transform: rotate(180deg); }
.col-iconbar.collapsed .ib-item { padding: 8px 4px; justify-content: center; }
.ib-item { transition: padding .28s cubic-bezier(.4,0,.2,1), justify-content .28s cubic-bezier(.4,0,.2,1); }


/* ── Element Plus dark overrides inside translation panel ── */
.trans-panel-body .el-select { width: 100%; }
.trans-panel-body .el-select .el-select__placeholder,
.trans-panel-body .el-select .el-select__selected-item,
.trans-panel-body .el-input__inner {
  color: var(--text-primary) !important;
  -webkit-text-fill-color: var(--text-primary) !important;
}
.trans-panel-body .el-select .el-select__caret,
.trans-panel-body .el-select .el-select__suffix,
.trans-panel-body .el-input__suffix {
  color: var(--text-secondary) !important;
}
.trans-panel-body .el-switch.is-checked .el-switch__core {
  background-color: var(--accent) !important;
  border-color: var(--accent) !important;
}
.trans-panel-body .el-color-picker__trigger {
  background: var(--sidebar-active) !important;
  border-color: var(--text-muted) !important;
}
/* ========== 导入聊天面板 ========== */
.import-panel-body {
  padding: 16px;
  overflow-y: auto;
}
.import-panel {
  background: var(--mgmt-card-bg, #1e252b);
  border-radius: 12px;
  padding: 20px;
}
.import-main-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary, #e9edef);
  margin: 0 0 10px 0;
}
.import-hint {
  font-size: 13px;
  color: var(--text-secondary, #8696a0);
  margin: 0 0 16px 0;
  line-height: 1.6;
}
.import-steps {
  background: rgba(0,168,132,0.06);
  border-radius: 8px;
  padding: 12px 16px;
  margin-bottom: 16px;
}
.import-step-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary, #e9edef);
  margin: 0 0 8px 0;
}
.import-steps p {
  font-size: 12px;
  color: var(--text-secondary, #8696a0);
  margin: 4px 0;
  line-height: 1.6;
}
.import-actions {
  margin-top: 12px;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.import-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: #00a884;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.2s;
}
.import-btn:hover {
  background: #008f6f;
}
.import-status {
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 6px;
}
.import-status.success {
  color: #00a884;
  background: rgba(0, 168, 132, 0.1);
}
.import-status.error {
  color: #f15c6d;
  background: rgba(241, 92, 109, 0.1);
}
.import-status.loading {
  color: #53bdeb;
  background: rgba(83, 189, 235, 0.1);
}
.import-no-contact {
  margin-top: 16px;
  padding: 12px;
  background: rgba(241, 92, 109, 0.08);
  border-radius: 8px;
  color: #f15c6d;
  font-size: 13px;
  text-align: center;
}
/* ========== 设置全屏弹窗 ========== */
.settings-modal {
  position: fixed; inset: 0; background: rgba(0,0,0,0.6);
  z-index: 1000; display: flex; align-items: center; justify-content: center;
  backdrop-filter: blur(4px);
}
.settings-dialog {
  width: 90%; max-width: 1000px; height: 80vh;
  background: var(--panel-bg); border-radius: 12px;
  display: flex; overflow: hidden;
  box-shadow: 0 20px 60px rgba(0,0,0,0.5);
}
.settings-sidebar {
  width: 220px; background: var(--panel-header-bg);
  padding: 20px 0; display: flex; flex-direction: column; flex-shrink: 0;
}
.settings-title {
  font-size: 18px; font-weight: 700;
  padding: 0 20px 16px; color: var(--text-primary);
  border-bottom: 1px solid var(--border-color); margin-bottom: 8px;
}
.settings-nav-item {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 20px; cursor: pointer;
  color: var(--text-secondary); font-size: 13px; transition: all 0.15s;
}
.settings-nav-item:hover { background: var(--sidebar-active); color: var(--text-primary); }
.settings-nav-item.active { background: #00a88430; color: var(--accent); }
.settings-close {
  margin-top: auto; margin: auto 20px 0; padding: 8px;
  background: none; border: 1px solid var(--sidebar-active);
  color: var(--text-secondary); border-radius: 6px; cursor: pointer; font-size: 13px;
}
.settings-close:hover { background: #ea433520; color: var(--danger); border-color: var(--danger); }
.settings-content { flex: 1; padding: 24px; overflow-y: auto; }
.settings-placeholder h2 { color: var(--text-primary); margin-bottom: 8px; }
.settings-placeholder p { color: var(--text-secondary); }

/* 无人值守设置样式 */
.unattended-settings h2 { color: var(--text-primary); margin-bottom: 8px; font-size: 20px; }
.unattended-settings .section-desc { color: var(--text-secondary); font-size: 13px; margin-bottom: 20px; }
.unattended-settings .form-group { margin-bottom: 16px; }
.unattended-settings .form-group > label { display: block; font-size: 14px; color: var(--text-primary); margin-bottom: 6px; font-weight: 500; }
.unattended-settings .form-select {
  width: 100%; padding: 10px 12px; font-size: 14px;
  border: 1px solid var(--border); border-radius: 8px;
  background: var(--bg-secondary); color: var(--text-primary);
  outline: none; transition: border-color 0.2s;
}
.unattended-settings .form-select:focus { border-color: var(--accent); }
.unattended-settings .toggle-label {
  display: flex; align-items: center; gap: 10px;
  padding: 12px 0; cursor: pointer; font-size: 15px; color: var(--text-primary);
}
.unattended-settings .toggle-label input[type="checkbox"] {
  width: 20px; height: 20px; accent-color: var(--accent); cursor: pointer;
}
.unattended-settings .radio-group { display: flex; flex-direction: column; gap: 10px; }
.unattended-settings .radio-label {
  display: flex; align-items: flex-start; gap: 8px;
  padding: 10px 12px; border: 1px solid var(--border); border-radius: 8px;
  cursor: pointer; font-size: 14px; color: var(--text-primary);
  transition: border-color 0.2s, background 0.2s;
}
.unattended-settings .radio-label:hover { border-color: var(--accent); background: var(--accent-light, #1a73e810); }
.unattended-settings .radio-label input[type="radio"] {
  margin-top: 2px; accent-color: var(--accent);
}
.unattended-settings .radio-label input[type="radio"]:checked + span { font-weight: 600; }
.unattended-settings .form-actions { display: flex; align-items: center; gap: 12px; margin-top: 20px; }
.unattended-settings .btn-primary {
  padding: 10px 24px; font-size: 14px; font-weight: 600;
  background: var(--accent); color: #fff; border: none; border-radius: 8px;
  cursor: pointer; transition: opacity 0.2s;
}
.unattended-settings .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
.unattended-settings .btn-primary:hover:not(:disabled) { opacity: 0.85; }
.unattended-settings .save-hint { color: var(--success, #34a853); font-size: 13px; }

/* ========== 动画 ========== */
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

/* ========== 移动端 ========== */
.mobile-tabbar { display: none; }
.mobile-ai-fab { display: none; }
.mobile-header { display: none; position: relative; z-index: 100; overflow: visible; flex-shrink:0; }
.mobile-overlay { display: none; }
.mh-menu-mask{position:fixed;top:60px;left:0;right:0;bottom:0;z-index:90;background:transparent}


@media (max-width: 900px) {
  html, body, #app { height: 100%; overflow: hidden; }

  .crm-layout { flex-direction: column; height: 100vh; height: 100dvh; }

  /* 移动端顶部栏 */
  .mobile-header {
    display: flex; align-items: center; gap: 8px;
    height: 60px; padding: 0 14px;
    background: var(--panel-header-bg); border-bottom: 1px solid var(--border-color);
    flex-shrink: 0; z-index: 100; position: relative;
    overflow: visible !important;
  }
  .mh-btn {
    width: 40px; height: 40px; display: flex;
    align-items: center; justify-content: center;
    background: none; border: none; color: var(--text-primary);
    cursor: pointer; border-radius: 50%;
  }
  .mh-btn:active { background: var(--sidebar-active); }
  .mh-title {
    flex: 1; font-size: 16px; font-weight: 600;
    color: var(--text-primary); text-align: left; padding-left: 4px;
    display: flex; align-items: center; gap: 10px; min-width: 0;
  }
  .mh-title.mh-clickable { cursor: pointer; }
  .mh-title.mh-clickable:active { opacity: 0.7; }
  .mh-avatar {
    width: 44px; height: 44px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    color: #fff; font-weight: 600; font-size: 16px; flex-shrink: 0;
    overflow: hidden;
  }
  .mh-avatar img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
  .mh-name-row { flex: 1; min-width: 0; display: flex; flex-direction: column !important; justify-content: center !important; align-items: flex-start !important; gap: 0px; }
  .mh-name-text {
    display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    line-height: 1.3; flex: 0 1 auto; min-width: 0;
  }

  /* 遮罩 */
  .mobile-overlay {
    display: block; position: fixed; top: 60px; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.5); z-index: 65;
  }

  .platform-nav { display: none; }
  .workspace {
    flex: 1; min-height: 0; position: relative;
    overflow: hidden; height: 0; width: auto;
    padding-top: 0; box-sizing: border-box;
  }
  .workspace.has-mheader { padding-top: 0; }
  .comm-module {
    position: relative; width: 100%; height: 100%;
    overflow: hidden;
  }
  .module-full {
    height: 100%; width: 100%;
    overflow-y: auto !important;
    -webkit-overflow-scrolling: touch;
    position: relative;
    background: var(--panel-bg);
    padding-top: 12px;
    box-sizing: border-box;
  }

  /* ② 账号栏 - 左侧抽屉 */
  .col-accounts {
    position: absolute !important; left: 0; top: 0; bottom: 0;
    z-index: 35; width: 82vw !important; max-width: 320px !important;
    transform: translateX(-100%);
    transition: transform 0.28s cubic-bezier(0.4,0,0.2,1);
    box-shadow: 2px 0 16px rgba(0,0,0,0.4);
  }
  .col-accounts.collapsed {
    transform: translateX(-100%) !important; width: 82vw !important;
  }
  .col-accounts.m-open { transform: translateX(0) !important; }

  /* ③ 状态栏隐藏 */

  /* ④ 聊天列表 - 默认全宽，进入对话时隐藏 */
  .col-chatlist {
    width: 100% !important; max-width: none !important;
    border-right: none !important; position: relative;
    transition: transform 0.28s cubic-bezier(0.4,0,0.2,1);
    flex: 1 1 auto; min-height: 0; min-width: 0;
    overflow: hidden;
  }
  .col-chatlist .chatlist-body {
    -webkit-overflow-scrolling: touch;
    overscroll-behavior-y: contain;
    padding-bottom: calc(72px + env(safe-area-inset-bottom, 0px));
    box-sizing: border-box;
  }
  .col-chatlist.collapsed { width: 0 !important; overflow: hidden; }
  .col-chatlist.m-hidden { transform: translateX(-100%); pointer-events: none; display: none; visibility: hidden; }

  /* ⑤ 对话主区 - 右侧滑入 */
  .col-conversation {
    position: absolute !important; left: 0; right: 0; top: 0; bottom: 0;
    z-index: 45; background: var(--chat-bg);
    transform: translateX(100%);
    transition: transform 0.28s cubic-bezier(0.4,0,0.2,1);
    display: flex !important; flex-direction: column !important;
  }
  .col-conversation.m-in { transform: none !important; }
  /* 对话页内部要撑满 */
  .col-conversation > * { height: 100%; }

  /* ⑥ ⑦ 功能栏隐藏 */
  .col-iconbar { display: none !important; }

  .mobile-tabbar {
    display: flex; height: calc(56px + env(safe-area-inset-bottom, 0px));
    padding-bottom: env(safe-area-inset-bottom, 0px);
    background: var(--panel-header-bg); border-top: 1px solid var(--border-color);
    flex-shrink: 0; z-index: 1001;
    box-sizing: border-box;
  }
  .m-tab {
    flex: 1; display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 2px;
    background: none; border: none; color: var(--text-secondary);
    font-size: 10px; cursor: pointer;
  }
  .m-tab.active { color: var(--accent); }

  /* 渠道弹出菜单 */
  .channel-popup-mask {
    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
    z-index: 48; background: transparent;
  }
  .channel-popup {
    position: fixed; bottom: calc(62px + env(safe-area-inset-bottom, 0px));
    left: 50%; transform: translateX(-50%);
    z-index: 49;
    background: var(--panel-header-bg);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    padding: 6px 0;
    min-width: 180px;
    box-shadow: 0 -4px 20px rgba(0,0,0,0.15);
    animation: popup-up 0.2s ease-out;
  }
  @keyframes popup-up {
    from { opacity: 0; transform: translateX(-50%) translateY(8px); }
    to { opacity: 1; transform: translateX(-50%) translateY(0); }
  }
  .channel-popup-arrow {
    position: absolute; bottom: -6px; left: 50%; transform: translateX(-50%);
    width: 12px; height: 12px;
    background: var(--panel-header-bg);
    border-right: 1px solid var(--border-color);
    border-bottom: 1px solid var(--border-color);
    transform: translateX(-50%) rotate(45deg);
  }
  .channel-popup-item {
    display: flex; align-items: center; gap: 10px;
    width: 100%; padding: 12px 16px;
    background: none; border: none;
    color: var(--text-primary); font-size: 14px;
    cursor: pointer; text-align: left;
  }
  .channel-popup-item:active { background: var(--sidebar-active); }
  .channel-popup-item.active { color: var(--accent); font-weight: 600; }
  .channel-popup-check { margin-left: auto; color: var(--accent); }

  .mobile-ai-fab {
    display: none !important;
  }

  .settings-dialog { width: 100%; height: 100%; max-width: none; border-radius: 0; }

  /* 账号栏/聊天列表内部滚动适配 */
  .col-accounts, .col-chatlist { height: 100%; }
  .comm-module { display: flex; }

  /* 隐藏桌面端折叠按钮（手机端用顶部汉堡/返回） */
  .col-accounts .col-header .col-toggle,
  .col-chatlist .col-header .col-toggle,
  .col-function-panel .col-header .col-toggle,
  .col-iconbar { display: none !important; }

  /* 手机端account栏col-header标题显示 */
  .col-accounts .col-header .col-title { display: block !important; }

  /* 确保col-header在手机端能看到 */
  .col-accounts .col-header { justify-content: space-between !important; padding: 10px 12px !important; }
  .col-chatlist .col-header { height: 56px; padding: 0 10px !important; }

  /* 搜索框在手机端适配 */
  .col-chatlist .search-box { flex: 1; }

  /* 功能面板在手机端改为浮层 */
  .col-function-panel.m-panel {
    display: flex !important; position: fixed;
    right: 0; top: 60px; bottom: 56px; width: 86vw !important;
    max-width: 360px; z-index: 55;
    transform: translateX(100%); transition: transform 0.28s;
    box-shadow: -2px 0 16px rgba(0,0,0,0.4); background: var(--panel-bg);
  }
  .col-function-panel.m-panel.show { transform: translateX(0); }
  .col-function-panel.m-panel.translating { background: var(--panel-bg); }
}
/* WA connect card in accounts column */
.wa-connect-card {
  margin: 8px; padding: 16px 12px;
  background: linear-gradient(135deg, #00a88420, var(--panel-header-bg));
  border: 1px solid #00a88440;
  border-radius: 10px;
  display: flex; flex-direction: column;
  align-items: center; gap: 6px;
  text-align: center;
}
.wa-connect-icon { font-size: 32px; }
.wa-connect-title { font-size: 13px; font-weight: 600; color: var(--text-primary); }
.wa-connect-desc { font-size: 11px; color: var(--text-secondary); }
.wa-connect-btn {
  margin-top: 8px;
  padding: 6px 14px;
  background: var(--accent); color: #fff;
  border: none; border-radius: 16px;
  font-size: 12px; cursor: pointer;
  font-weight: 500;
}
.wa-connect-btn:hover { background: var(--accent-hover); }
.empty-list-hint {
  padding: 40px 10px;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
}


/* === WhatsApp-native col-accounts styles === */
.wa-col-header {
  height: 56px;
  display: flex;
  align-items: center;
  padding: 0 12px;
  background: var(--panel-header-bg);
  border-bottom: 1px solid var(--border-color);
  gap: 6px;
  flex-shrink: 0;
}
.wa-col-brand {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-primary);
  min-width: 0;
}
.wa-col-title {
  font-size: 16px;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
}
.wa-col-actions {
  display: flex;
  align-items: center;
  gap: 2px;
}
.wa-col-btn {
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: var(--text-secondary);
  border-radius: 50%;
  cursor: pointer;
  transition: background 0.15s;
}
.wa-col-btn:hover { background: var(--sidebar-active); color: var(--text-primary); }
.wa-col-btn:disabled { opacity: 0.4; cursor: wait; }

.wa-account-list {
  flex: 1;
  overflow-y: auto;
  padding: 6px 8px;
}
.wa-empty-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;
  border-left: 3px solid transparent;
}
.wa-empty-card:hover {
  background: var(--panel-header-bg);
}
.wa-empty-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--sidebar-active);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.wa-empty-info { flex: 1; min-width: 0; }
.wa-empty-name {
  font-size: 16px;
  font-weight: 400;
  color: var(--text-primary);
}
.wa-empty-meta {
  font-size: 13px;
  color: var(--text-secondary);
  margin-top: 2px;
}
.wa-empty-meta .status-text.connecting { color: var(--accent-info); }
.wa-empty-meta .status-text.error { color: var(--danger); }

.wa-account-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 0 8px 8px 0;
  cursor: pointer;
  background: var(--sidebar-active);
  border-left: 3px solid var(--accent);
}
.wa-account-item .acc-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--accent);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 500;
  font-size: 18px;
  position: relative;
  flex-shrink: 0;
}
.wa-account-item .acc-info { flex: 1; min-width: 0; }
.wa-account-item .acc-name {
  font-size: 16px;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.wa-account-item .acc-meta {
  font-size: 13px;
  margin-top: 2px;
}
.wa-account-item .acc-meta.online-text { color: var(--accent); }
.wa-account-item .acc-online-dot {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--accent);
  border: 2px solid var(--sidebar-active);
}

/* Empty conv placeholder big button */
.connect-btn-big {
  margin-top: 20px;
  padding: 11px 28px;
  background: var(--accent);
  color: var(--accent-text);
  border: none;
  border-radius: 24px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
  font-family: inherit;
}
.connect-btn-big:hover { background: var(--accent-hover); }
.ph-icon.wa-green { font-size: 72px; opacity: 1; color: var(--accent); }

/* ========== AI 窄版聊天框样式 ========== */
.ai-chat-wrap {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}
.ai-chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-color);
  background: var(--panel-header-bg);
}
.ai-chat-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}
.ai-chat-actions { display: flex; gap: 4px; }
.ai-chat-icon-btn {
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background .15s, color .15s;
}
.ai-chat-icon-btn:hover:not(:disabled) { background: var(--sidebar-active); color: var(--accent); }
.ai-chat-icon-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.ai-chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 10px 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: var(--chat-bg);
}
.ai-welcome-icon { font-size: 36px; margin-bottom: 8px; }

.ai-chat-msg { display: flex; width: 100%; }
.ai-chat-msg.ai-user { justify-content: flex-end; }
.ai-chat-msg.ai-assistant { justify-content: flex-start; }
.ai-chat-msg.ai-error .ai-chat-bubble { background: #3d1e1e; color: #ff9b9b; }

.ai-chat-bubble {
  max-width: 85%;
  padding: 8px 12px 6px;
  border-radius: 8px;
  font-size: 13px;
  line-height: 1.55;
  word-break: break-word;
  box-shadow: 0 1px 0.5px rgba(0,0,0,.13);
}
.ai-chat-msg.ai-assistant .ai-chat-bubble {
  background: var(--panel-header-bg);
  color: var(--text-primary);
  border-top-left-radius: 2px;
}
.ai-chat-msg.ai-user .ai-chat-bubble {
  background: var(--accent);
  color: #fff;
  border-top-right-radius: 2px;
}
.ai-chat-content { white-space: pre-wrap; }

.ai-insert-row {
  margin-top: 6px;
  display: flex;
  gap: 6px;
  justify-content: flex-end;
  flex-wrap: wrap;
}
.ai-insert-btn {
  background: var(--sidebar-active);
  color: var(--accent);
  border: none;
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 12px;
  cursor: pointer;
  transition: background .15s, color .15s;
  font-family: inherit;
}
.ai-insert-btn:hover { background: var(--accent); color: #fff; }
.ai-insert-btn-secondary { color: var(--text-secondary); }
.ai-insert-btn-secondary:hover { background: var(--sidebar-active); color: var(--text-primary); }

.ai-translate-card {
  background: var(--panel-header-bg);
  border-radius: 8px;
  border-top-left-radius: 2px;
  padding: 4px 12px;
  max-width: 100%;
  box-shadow: 0 1px 0.5px rgba(0,0,0,.13);
}
.ai-trans-section {
  padding: 8px 0;
  border-bottom: 1px solid var(--sidebar-active);
}
.ai-trans-section:last-child { border-bottom: none; }
.ai-trans-label {
  font-size: 11px;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 600;
  margin-bottom: 4px;
}
.ai-trans-text {
  font-size: 13px;
  color: var(--text-primary);
  line-height: 1.5;
  word-break: break-word;
}
.ai-trans-result { color: var(--accent); font-weight: 500; }
.ai-trans-actions {
  display: flex;
  gap: 6px;
  justify-content: flex-end;
  margin-top: 6px;
}

/* AI 话术/总结/背调 面板 */
.ai-reply-panel, .ai-summary-panel { padding: 10px; display: flex; flex-direction: column; gap: 10px; }
.ai-section-title { font-size: 11px; color: var(--text-secondary); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
.ai-section-title-row { display: flex; align-items: center; justify-content: space-between; }
.ai-clear-btn { background: none; border: 1px solid var(--border-color); color: var(--text-secondary); font-size: 11px; cursor: pointer; padding: 2px 8px; border-radius: 6px; font-family: inherit; transition: all 0.15s; }
.ai-clear-btn:hover { color: var(--accent); border-color: var(--accent); }
.ai-reply-styles { padding: 0 2px; }
.ai-style-row { display: flex; gap: 6px; margin-top: 6px; }
.ai-style-card {
  flex: 1; padding: 8px 4px;
  background: var(--panel-header-bg); border: 2px solid transparent;
  border-radius: 8px; cursor: pointer;
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  transition: all 0.15s;
  color: var(--text-primary); font-size: 12px;
}
.ai-style-card .ai-style-icon { font-size: 20px; }
.ai-style-card.active {
  border-color: var(--accent);
  background: #00a88420;
}
.ai-style-card:hover:not(.active) { background: var(--sidebar-active); }
.ai-gen-btn {
  width: 100%; padding: 10px 16px;
  background: linear-gradient(90deg, var(--accent), #00c896);
  color: #fff; border: none;
  border-radius: 20px; font-size: 14px; font-weight: 600;
  cursor: pointer; font-family: inherit;
  display: flex; align-items: center; justify-content: center; gap: 6px;
  transition: opacity 0.15s;
}
.ai-gen-btn:hover:not(:disabled) { opacity: 0.9; }
.ai-gen-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.ai-profile-gen-btn { margin: 0 10px; width: calc(100% - 20px); }
.ai-dots-inline { display: inline-flex; gap: 3px; align-items: center; }
.ai-dots-inline span {
  width: 5px; height: 5px; border-radius: 50%;
  background: #fff; display: inline-block;
  animation: aiBounce 1.2s infinite ease-in-out both;
}
.ai-dots-inline span:nth-child(1) { animation-delay: -0.32s; }
.ai-dots-inline span:nth-child(2) { animation-delay: -0.16s; }

.ai-reply-list { display: flex; flex-direction: column; gap: 8px; }
.ai-reply-card {
  background: var(--panel-header-bg); border-radius: 8px; padding: 10px 12px;
  border-top-left-radius: 2px;
  box-shadow: 0 1px 0.5px rgba(0,0,0,.13);
  display: flex; flex-direction: column; gap: 8px;
}
.ai-error-card { opacity: 0.85; }
.ai-reply-text { font-size: 13px; color: var(--text-primary); line-height: 1.55; word-break: break-word; white-space: pre-wrap; }
.ai-reply-footer { display: flex; align-items: center; justify-content: space-between; }
.ai-reply-meta { display: flex; align-items: center; gap: 8px; font-size: 11px; color: var(--text-secondary); }
.ai-reply-meta-tag { display: flex; align-items: center; gap: 3px; }

.ai-regen-btn {
  background: none; border: none; color: var(--accent-info);
  font-size: 12px; cursor: pointer; padding: 6px 0;
  font-family: inherit; align-self: center;
}
.ai-regen-btn:hover { text-decoration: underline; }
.ai-regen-btn:disabled { opacity: 0.5; cursor: not-allowed; text-decoration: none; }

/* 需求总结面板 */
.ai-summary-result { display: flex; flex-direction: column; gap: 10px; }
.ai-score-block {
  background: var(--panel-header-bg); border-radius: 8px; padding: 10px 12px;
}
.ai-score-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
.ai-score-num { font-size: 18px; font-weight: 700; color: #f5c842; }
.ai-score-bar { height: 6px; background: var(--sidebar-active); border-radius: 3px; overflow: hidden; }
.ai-score-fill { height: 100%; background: linear-gradient(90deg, #f5c842, #f9d971); border-radius: 3px; transition: width 0.4s; }

.ai-stage-block {
  background: var(--panel-header-bg); border-radius: 8px; padding: 10px 12px;
  display: flex; flex-direction: column; gap: 4px;
}
.ai-stage-text { font-size: 14px; color: var(--text-primary); font-weight: 600; }

.ai-fields-grid { display: flex; flex-direction: column; gap: 6px; }
.ai-field-card {
  background: var(--panel-header-bg); border-radius: 8px; padding: 10px 12px;
  display: flex; flex-direction: column; gap: 4px;
}
.ai-field-label { font-size: 11px; color: var(--text-secondary); font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; }
.ai-field-value { font-size: 13px; color: var(--text-primary); line-height: 1.5; white-space: pre-wrap; word-break: break-word; }

.ai-summary-block {
  background: var(--panel-header-bg); border-radius: 8px; padding: 10px 12px;
  border-left: 3px solid #a78bfa;
}
.ai-summary-title { font-size: 12px; color: #a78bfa; font-weight: 600; margin-bottom: 6px; }
.ai-summary-text { font-size: 13px; color: var(--text-primary); line-height: 1.6; white-space: pre-wrap; word-break: break-word; }

/* 欢迎提示（profile用） */
.ai-welcome-text { font-size: 13px; color: var(--text-secondary); }

.ai-chat-input-wrap {
  display: flex;
  gap: 6px;
  padding: 8px;
  border-top: 1px solid var(--border-color);
  background: var(--panel-bg);
  align-items: center;
}
.ai-chat-input {
  flex: 1;
  background: var(--sidebar-active);
  border: none;
  border-radius: 20px;
  padding: 8px 14px;
  color: var(--text-primary);
  font-size: 13px;
  outline: none;
  font-family: inherit;
  line-height: 1.4;
}
.ai-chat-input::placeholder { color: var(--text-secondary); }
.ai-chat-input:disabled { opacity: 0.6; }
.ai-chat-send {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--accent);
  color: #fff;
  border: none;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background .15s, opacity .15s;
  flex-shrink: 0;
}
.ai-chat-send:hover:not(:disabled) { background: var(--accent-hover); }
.ai-chat-send:disabled { opacity: 0.4; cursor: not-allowed; background: var(--accent); }

.ai-loading-bubble { padding: 10px 14px; }
.ai-dots { display: inline-flex; gap: 4px; align-items: center; }
.ai-dots span {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: var(--text-secondary);
  animation: aiBounce 1.2s infinite ease-in-out both;
  display: inline-block;
}
.ai-dots span:nth-child(1) { animation-delay: -0.32s; }
.ai-dots span:nth-child(2) { animation-delay: -0.16s; }
@keyframes aiBounce {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
  40% { transform: scale(1); opacity: 1; }
}


/* Resize handle dark */
.col-function-panel .ai-resize-handle { background: var(--border-color); }


/* ── AI 话术面板 v2 ── */
.aitalk-panel-body {
  flex: 1; display: flex; flex-direction: column;
  background: var(--panel-bg); overflow: hidden; height: 100%;
}

.aitalk-top-bar {
  display: flex; flex-direction: column; gap: 6px;
  padding: 12px 12px 8px; border-bottom: 1px solid var(--border-color);
}
.aitalk-top-bar .aitalk-top-actions { display: flex; align-items: center; gap: 6px; margin-left: auto; }
.aitalk-model-wrap { flex:1; position:relative; display:flex; align-items:center; }
.aitalk-model-select { flex:1; }
.aitalk-model-tag {
  position:absolute; right:28px; top:50%; transform:translateY(-50%);
  color:#22c55e; font-size:10px; font-weight:600;
  background:rgba(34,197,94,0.15); padding:1px 6px; border-radius:4px;
  pointer-events:none; z-index:2;
  border:1px solid rgba(34,197,94,0.3);
}
.aitalk-model-select { flex: 1; }
.aitalk-model-select .el-select__placeholder, .aitalk-model-select .el-select__selected-item { color: var(--text-primary) !important; }

.aitalk-top-first-row { display: flex; align-items: center; gap: 8px; width: 100%; }
.aitalk-top-first-select { flex: 1; }
.aitalk-select-row { display: flex; align-items: center; gap: 8px; width: 100%; }
.aitalk-select-row .aitalk-model-select { flex: 1; }
.aitalk-lang-row { margin-top: 6px; }
.aitalk-select-label { color: var(--text-secondary); font-size: 12px; white-space: nowrap; min-width: 54px; }
.aitalk-lang-select { flex: 1; }
.aitalk-lang-select .el-select__placeholder, .aitalk-lang-select .el-select__selected-item { color: var(--text-primary) !important; font-size: 13px; }


.aitalk-top-actions { display: flex; gap: 4px; }
.aitalk-mode-btn {
  width: 30px; height: 30px; border-radius: 6px; border: none;
  background: var(--sidebar-active); color: var(--text-secondary); cursor: pointer; font-size: 14px;
  display: flex; align-items: center; justify-content: center; transition: all .2s ease;
}
.aitalk-mode-btn:hover { background: var(--text-muted); color: var(--text-primary); }
.aitalk-mode-btn.active { background: rgba(0,168,132,.15); color: var(--accent); }
.aitalk-clear-btn {
  width: 30px; height: 30px; border-radius: 6px; border: none;
  background: transparent; color: var(--text-secondary); cursor: pointer; font-size: 14px;
  display: flex; align-items: center; justify-content: center; transition: all .2s ease;
}
.aitalk-clear-btn:hover { background: rgba(239,68,68,.15); color: #ef4444; }

.aitalk-scroll {
  flex: 1; overflow-y: auto; padding: 12px; position: relative;
}
.aitalk-scroll::-webkit-scrollbar { width: 6px; }
.aitalk-scroll::-webkit-scrollbar-thumb { background: var(--sidebar-active); border-radius: 3px; }
.aitalk-scroll::-webkit-scrollbar-track { background: transparent; }

.aitalk-welcome { text-align: center; padding: 24px 12px; }
.aitalk-welcome-icon { font-size: 40px; margin-bottom: 8px; }
.aitalk-welcome-title { color: var(--text-primary); font-size: 14px; margin-bottom: 16px; }
.aitalk-chips { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; }
.aitalk-chip {
  background: var(--sidebar-active); color: var(--text-primary); border: none; border-radius: 16px;
  padding: 6px 12px; font-size: 12px; cursor: pointer; transition: all .2s ease;
  font-family: inherit; margin: 2px;
}
.aitalk-chip:hover { background: var(--text-muted); }

.aitalk-msg { margin-bottom: 10px; display: flex; flex-direction: column; }
.aitalk-msg-user { align-items: flex-end; }
.aitalk-msg-ai { align-items: flex-start; }
.aitalk-bubble {
  max-width: 90%; padding: 9px 12px; border-radius: 8px; font-size: 14px;
  line-height: 1.5; word-break: break-word; white-space: pre-wrap;
}
.aitalk-bubble b { font-weight: 600; }
.aitalk-bubble-user {
  background: var(--msg-outgoing); color: var(--text-primary); border-radius: 8px 0 8px 8px; max-width: 80%;
}
.aitalk-bubble-ai {
  background: var(--panel-header-bg); color: var(--text-primary); border-radius: 0 8px 8px 8px; max-width: 95%;
}
.aitalk-msg-time { font-size: 10px; color: var(--text-secondary); margin-top: 3px; padding: 0 4px; }

.aitalk-typing { display: inline-flex; align-items: center; gap: 4px; padding: 12px 16px; }
.aitalk-progress { display: flex; flex-direction: column; gap: 6px; min-width: 170px; }
.aitalk-progress-line { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.aitalk-progress-stage { font-size: 13px; color: var(--crm-text-primary, #e6e6e6); white-space: nowrap; }
.aitalk-progress-time { font-size: 12px; color: var(--crm-text-secondary, #9aa0aa); white-space: nowrap; font-variant-numeric: tabular-nums; }
.aitalk-dot {
  width: 6px; height: 6px; border-radius: 50%; background: var(--text-secondary);
  animation: aitalk-bounce 1.2s infinite ease-in-out; display: inline-block;
}
.aitalk-dot:nth-child(2) { animation-delay: .2s; }
.aitalk-dot:nth-child(3) { animation-delay: .4s; }
@keyframes aitalk-bounce {
  0%, 80%, 100% { opacity: .3; transform: translateY(0); }
  40% { opacity: 1; transform: translateY(-4px); }
}

.aitalk-error-block {
  background: rgba(239,68,68,.15); border: 1px solid rgba(239,68,68,.3); border-radius: 8px;
  padding: 10px 12px; max-width: 95%;
}
.aitalk-error-text { color: #fca5a5; font-size: 13px; margin-bottom: 6px; }
.aitalk-retry-btn {
  background: var(--sidebar-active); color: var(--text-primary); border: 1px solid var(--text-muted); border-radius: 4px;
  padding: 4px 10px; font-size: 12px; cursor: pointer; font-family: inherit;
}
.aitalk-retry-btn:hover { background: var(--text-muted); }
.aitalk-error-global {
  margin: 0 12px 8px; padding: 8px 12px; background: rgba(239,68,68,.15);
  border-radius: 6px; color: #fca5a5; font-size: 12px;
}

.aitalk-reply-card-v2 {
  background: var(--panel-header-bg); border-radius: 8px; padding: 12px; margin-bottom: 8px;
  max-width: 100%; position: relative; transition: background .2s ease;
}
.aitalk-reply-card-v2:hover { background: #26353d; }
.aitalk-reply-num {
  position: absolute; top: 8px; right: 10px; color: var(--accent); font-weight: 700;
  font-size: 12px; background: rgba(0,168,132,.12); width: 22px; height: 22px;
  border-radius: 50%; display: flex; align-items: center; justify-content: center;
}
.aitalk-reply-head { margin-bottom: 8px; padding-right: 28px; }
.aitalk-reply-name { color: var(--accent); font-weight: 700; font-size: 14px; }
.aitalk-reply-sep { color: var(--text-secondary); }
.aitalk-reply-desc { color: var(--text-secondary); font-size: 12px; }
.aitalk-reply-foreign {
  background: var(--panel-bg); border-left: 3px solid var(--accent); border-radius: 4px; padding: 10px;
  color: var(--text-primary); font-size: 14px; line-height: 1.55; margin: 6px 0;
  white-space: pre-wrap; word-break: break-word;
}
.aitalk-reply-chinese { color: var(--text-secondary); font-size: 13px; font-style: italic; line-height: 1.5; margin-bottom: 8px; }
.aitalk-reply-actions { display: flex; gap: 6px; margin-bottom: 8px; }
.aitalk-mini-btn {
  background: var(--sidebar-active); color: var(--text-secondary); border: none; border-radius: 4px;
  padding: 4px 10px; font-size: 12px; cursor: pointer; font-family: inherit;
  transition: all .2s ease;
}
.aitalk-mini-btn:hover { background: var(--text-muted); color: var(--text-primary); }
.aitalk-use-btn {
  width: 100%; background: var(--accent); color: #fff; border: none; border-radius: 6px;
  padding: 10px; font-size: 14px; font-weight: 500; cursor: pointer; font-family: inherit;
  transition: all .2s ease;
}
.aitalk-use-btn:hover { background: #008c6e; }
.aitalk-use-btn.done { background: #006e56; }
.aitalk-edit-btn { border: 1px solid var(--accent); color: var(--accent); background: transparent; }
.aitalk-edit-btn:hover { background: var(--accent); color: #fff; }
.aitalk-save-btn { border: 1px solid var(--accent); color: var(--accent); background: transparent; }
.aitalk-save-btn:hover { background: var(--accent); color: #fff; }
.aitalk-edit-input {
  width: 100%; box-sizing: border-box; background: var(--panel-bg); color: var(--text-primary);
  border: 1px solid var(--text-muted); border-left: 3px solid var(--accent); border-radius: 6px;
  padding: 8px 10px; font-size: 13px; line-height: 1.5; font-family: inherit; resize: vertical;
  margin: 4px 0; white-space: pre-wrap; word-break: break-word;
}
.aitalk-edit-input:focus { outline: none; border-color: var(--accent); }
/* ── 场景分析 ── */
.aitalk-scene-card {
  display: flex; gap: 10px; background: #1a262d; border: 1px solid #233138;
  border-radius: 8px; padding: 12px; margin-bottom: 10px;
}
.aitalk-scene-icon { font-size: 18px; line-height: 1.3; flex-shrink: 0; }
.aitalk-scene-body { flex: 1; }
.aitalk-scene-title { color: var(--accent-info); font-size: 12px; font-weight: 700; margin-bottom: 6px; letter-spacing: .5px; }
.aitalk-scene-text { color: var(--text-primary); font-size: 13px; line-height: 1.7; }
/* ── 区块分隔标题 ── */
.aitalk-section-label {
  font-size: 12px; color: var(--text-secondary); font-weight: 600;
  margin: 12px 0 6px; letter-spacing: .3px;
}
/* ── 话术设计思路表格 ── */
.aitalk-design-block { margin-top: 4px; }
.aitalk-design-table {
  background: #1a262d; border: 1px solid #233138; border-radius: 8px; overflow: hidden;
}
.aitalk-design-row {
  display: flex; align-items: flex-start; padding: 8px 12px;
  border-bottom: 1px solid var(--sidebar-active);
}
.aitalk-design-row:last-child { border-bottom: none; }
.aitalk-design-psych {
  flex: 0 0 40%; color: var(--text-secondary); font-size: 12.5px; line-height: 1.6;
  padding-right: 10px; border-right: 1px solid var(--sidebar-active);
}
.aitalk-design-strategy {
  flex: 1; color: var(--text-primary); font-size: 12.5px; line-height: 1.6; padding-left: 10px;
}
/* ── 补充建议 ── */
.aitalk-suggest-block { margin-top: 4px; }
.aitalk-suggest-list {
  list-style: none; margin: 0; padding: 0;
  background: #1a262d; border: 1px solid #233138; border-radius: 8px; padding: 8px 12px;
}
.aitalk-suggest-list li {
  color: var(--text-primary); font-size: 13px; line-height: 1.7; padding: 3px 0;
  padding-left: 14px; position: relative;
}
.aitalk-suggest-list li::before {
  content: "•"; color: var(--accent); position: absolute; left: 2px; top: 3px; font-weight: 700;
}
/* ── 底部提示 ── */
.aitalk-footer-hint {
  color: var(--text-secondary); font-size: 12px; margin: 10px 2px 4px; line-height: 1.5;
}
/* ── 优化反馈区 ── */
.aitalk-refine-block {
  margin-top: 10px; background: #1a262d; border: 1px solid #233138;
  border-radius: 8px; padding: 10px 12px;
}
.aitalk-refine-title { color: var(--text-secondary); font-size: 12px; margin-bottom: 8px; }
.aitalk-refine-chips { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 8px; }
.aitalk-refine-chip {
  background: var(--sidebar-active); color: var(--text-secondary); border: 1px solid transparent; border-radius: 14px;
  padding: 4px 10px; font-size: 12px; cursor: pointer; font-family: inherit;
  transition: all .2s ease;
}
.aitalk-refine-chip:hover { border-color: var(--accent); color: var(--text-primary); }
.aitalk-refine-chip.active { background: rgba(0,168,132,.15); color: var(--accent); border-color: var(--accent); }
.aitalk-refine-textarea {
  width: 100%; box-sizing: border-box;
  background: var(--sidebar-active); border: 1px solid var(--text-muted); border-radius: 8px;
  padding: 8px 10px; color: var(--text-primary); font-size: 13px; resize: vertical;
  outline: none; font-family: inherit; line-height: 1.5; min-height: 60px;
  transition: border-color .2s ease; margin-bottom: 8px;
}
.aitalk-refine-textarea:focus { border-color: var(--accent); }
.aitalk-refine-textarea::placeholder { color: var(--text-secondary); }
.aitalk-refine-textarea:disabled { opacity: .6; cursor: not-allowed; }
.aitalk-refine-btn {
  width: 100%; background: var(--accent); color: #fff; border: none; border-radius: 6px;
  padding: 9px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit;
  transition: all .2s ease;
}
.aitalk-refine-btn:hover:not(:disabled) { background: #008c6e; }
.aitalk-refine-btn:disabled { background: var(--text-muted); cursor: not-allowed; opacity: .8; }
.aitalk-refine-hint { color: var(--text-secondary); font-size: 11.5px; margin-top: 6px; text-align: center; }


.aitalk-footer {
  padding: 10px 12px 12px; border-top: 1px solid var(--border-color); background: var(--panel-bg);
  display: flex; flex-direction: column; gap: 8px;
}
.aitalk-quick-chips { display: flex; gap: 4px; flex-wrap: wrap; }
.aitalk-mini-chip {
  background: var(--sidebar-active); color: var(--text-secondary); border: none; border-radius: 4px;
  padding: 3px 8px; font-size: 11px; cursor: pointer; font-family: inherit; transition: all .2s ease;
}
.aitalk-mini-chip:hover { background: var(--text-muted); color: var(--text-primary); }
.aitalk-input-row { display: flex; gap: 8px; align-items: flex-end; }
.aitalk-textarea {
  flex: 1; background: var(--sidebar-active); border: 1px solid var(--text-muted); border-radius: 8px;
  padding: 10px 12px; color: var(--text-primary); font-size: 14px; resize: none;
  outline: none; font-family: inherit; line-height: 1.4; min-height: 42px; max-height: 120px;
  transition: border-color .2s ease;
}
.aitalk-textarea:focus { border-color: var(--accent); }
.aitalk-textarea::placeholder { color: var(--text-secondary); }
.aitalk-send-btn {
  width: 38px; height: 38px; border-radius: 50%; background: var(--accent); border: none;
  color: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; transition: all .2s ease;
}
.aitalk-send-btn:hover:not(:disabled) { background: #008c6e; }
.aitalk-send-btn:disabled { background: var(--text-muted); cursor: not-allowed; }

.aitalk-gen-btn {
  width: 100%; height: 44px; background: #7c3aed; color: #fff; border: none; border-radius: 8px;
  font-size: 14px; font-weight: 500; cursor: pointer; display: inline-flex; align-items: center;
  justify-content: center; gap: 8px; transition: background .15s ease, transform .1s ease;
  font-family: inherit;
}
.aitalk-gen-btn:hover:not(:disabled) { background: #6d28d9; }
.aitalk-gen-btn:active:not(:disabled) { transform: scale(.98); }
.aitalk-gen-btn:disabled { opacity: .6; cursor: not-allowed; }
/* 【终止按钮】生成中显示的中断按钮：红色警示系 */
.aitalk-stop-btn {
  width: 100%; height: 40px; margin-top: 8px; border: none; border-radius: 8px;
  background: linear-gradient(135deg, #ef4444, #dc2626); color: #fff;
  font-size: 14px; font-weight: 600; cursor: pointer; display: inline-flex;
  align-items: center; justify-content: center; gap: 6px;
  transition: all .15s ease; box-shadow: 0 2px 8px rgba(239, 68, 68, .35);
  font-family: inherit;
}
.aitalk-stop-btn:hover { background: linear-gradient(135deg, #dc2626, #b91c1c); transform: translateY(-1px); box-shadow: 0 4px 12px rgba(239, 68, 68, .45); }
.aitalk-stop-btn:active { transform: scale(.98); }
.aitalk-stop-icon { font-size: 13px; }
.aitalk-stop-btn-inline { width: auto; height: 34px; margin-top: 0; padding: 0 14px; font-size: 13px; flex-shrink: 0; }
/* 【自动生成开关】面板顶部小开关 */
.aitalk-autogen-wrap { display: inline-flex; align-items: center; gap: 4px; margin-right: 2px; flex-shrink: 0; }
.aitalk-autogen-text { font-size: 12px; color: var(--text-secondary); user-select: none; line-height: 1; }
.aitalk-spinner { display: inline-block; animation: aitalk-spin 1s linear infinite; }
@keyframes aitalk-spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }
.aitalk-switch-mode-link {
  background: none; border: none; color: var(--text-secondary); font-size: 12px; cursor: pointer;
  padding: 2px 0; font-family: inherit; text-align: center; transition: color .2s ease;
}
.aitalk-switch-mode-link:hover { color: var(--accent); }


/* ── 紧凑顶栏 ── */
.aitalk-top-bar-compact { padding: 8px 10px 6px !important; gap: 4px !important; }
.aitalk-top-bar-compact .aitalk-top-first-row { gap: 6px; }
.aitalk-top-bar-compact .aitalk-model-select { max-width: 120px; flex: 0 0 auto; }
.aitalk-lang-select-compact { max-width: 90px; flex: 0 0 auto; }
.aitalk-lang-select-compact .el-select__placeholder, .aitalk-lang-select-compact .el-select__selected-item { color: var(--text-primary) !important; font-size: 12px; }

/* ── 产品分析卡片 ── */
.aitalk-product-card {
  background: rgba(59,130,246,0.08); border: 1px solid rgba(59,130,246,0.2);
  border-radius: 10px; padding: 10px 12px; margin-bottom: 10px;
}
.aitalk-product-header { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; }
.aitalk-product-icon { font-size: 16px; }
.aitalk-product-title { color: #60a5fa; font-size: 13px; font-weight: 600; flex: 1; }
.aitalk-match-badge {
  font-size: 11px; padding: 2px 8px; border-radius: 10px; font-weight: 600;
}
.aitalk-match-badge.match-high { background: rgba(34,197,94,0.15); color: #22c55e; border: 1px solid rgba(34,197,94,0.3); }
.aitalk-match-badge.match-medium { background: rgba(234,179,8,0.15); color: #eab308; border: 1px solid rgba(234,179,8,0.3); }
.aitalk-match-badge.match-low { background: rgba(239,68,68,0.15); color: #ef4444; border: 1px solid rgba(239,68,68,0.3); }
.aitalk-product-body { }
.aitalk-product-explain { color: var(--text-primary); font-size: 13px; line-height: 1.5; margin-bottom: 8px; white-space: pre-wrap; }
.aitalk-product-matched, .aitalk-product-params { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; margin-top: 6px; }
.aitalk-pm-label, .aitalk-pp-label { color: var(--text-secondary); font-size: 11px; white-space: nowrap; }
.aitalk-pm-chip {
  background: rgba(34,197,94,0.12); color: #22c55e; font-size: 11px; padding: 2px 8px;
  border-radius: 10px; border: 1px solid rgba(34,197,94,0.2);
}
.aitalk-pp-chip {
  background: rgba(234,179,8,0.12); color: #eab308; font-size: 11px; padding: 2px 8px;
  border-radius: 10px; border: 1px solid rgba(234,179,8,0.2);
}

.aitalk-scroll-down {
  position: absolute; right: 16px; bottom: 8px; width: 32px; height: 32px;
  border-radius: 50%; background: var(--panel-header-bg); border: 1px solid var(--text-muted); color: var(--accent);
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  font-size: 14px; box-shadow: 0 2px 8px rgba(0,0,0,.4); z-index: 5;
  transition: all .2s ease;
}
.aitalk-scroll-down:hover { background: var(--sidebar-active); }


/* ── 客户资料面板 ── */
.customer-panel-body {
  flex: 1; display: flex; flex-direction: column; height: 100%; overflow: hidden;
  background: var(--panel-bg); color: var(--text-primary);
}
.customer-empty {
  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
  color: var(--text-secondary);
}
.customer-header {
  height: 60px; background: var(--panel-header-bg); border-bottom: 1px solid var(--border-color);
  display: flex; align-items: center; padding: 0 14px; gap: 10px; flex-shrink: 0;
}
.customer-avatar {
  width: 40px; height: 40px; border-radius: 50%; background: var(--sidebar-active);
  color: var(--text-primary); display: flex; align-items: center; justify-content: center;
  font-size: 16px; font-weight: 600; flex-shrink: 0; text-transform: uppercase;
}
.customer-head-info { flex: 1; min-width: 0; }
.customer-head-name { color: var(--text-primary); font-size: 15px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.customer-head-jid { color: var(--text-secondary); font-size: 12px; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.customer-head-actions { display: flex; align-items: center; gap: 6px; }
.customer-level-tag {
  display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: 600;
  background: var(--text-muted); color: var(--text-secondary); white-space: nowrap;
}
.source-tag {
  display: inline-flex; align-items: center; gap: 2px; padding: 3px 8px; border-radius: 12px;
  font-size: 11px; font-weight: 600; white-space: nowrap;
}
.source-tag.src-whatsapp { background:#25D366; color:#fff; }
.source-tag.src-telegram { background:#2AABEE; color:#fff; }
.source-tag.src-instagram { background:#E1306C; color:#fff; }
.source-tag.src-email { background:#EA4335; color:#fff; }
.source-tag.src-exhibition, .source-tag.src-展会 { background:#f59e0b; color:#fff; }
.source-tag.src-manual { background:#6366f1; color:#fff; }
.source-tag.src-other { background:#6b7280; color:#fff; }
.customer-level-tag.lv-A { background:#ef4444; color:#fff; }
.customer-level-tag.lv-B { background:#f59e0b; color:#fff; }
.customer-level-tag.lv-C { background:#6b7280; color:#fff; }
.customer-level-tag.lv-D { background:#374151; color:#fff; }

/* ── v9.2a Customer profile tabs & hero ── */
.customer-hero-avatar {
  width: 56px !important; height: 56px !important; border-radius: 50% !important;
  overflow: hidden; background: var(--sidebar-active);
}
.customer-hero-img {
  width: 100%; height: 100%; object-fit: cover; border-radius: 50%;
}
.customer-hero-fallback {
  width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;
  font-size: 22px; font-weight: 600; color: var(--text-primary);
}
.customer-head-company {
  color: var(--text-secondary); font-size: 12px; margin-top: 1px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.customer-panel-body .customer-header { height: auto; min-height: 72px; padding: 10px 14px; align-items: flex-start; flex-wrap: wrap; }
.customer-panel-body .customer-head-info { padding-top: 4px; }
.customer-panel-body .customer-head-actions { margin-left: auto; display: flex; flex-direction: column; align-items: flex-end; gap: 5px; flex-shrink: 0; }

.profile-tabs {
  display: flex; gap: 0; background: var(--panel-header-bg);
  border-bottom: 1px solid var(--border-color); flex-shrink: 0;
  overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none;
}
.profile-tabs::-webkit-scrollbar { display: none; }
.profile-tab {
  flex: 1; min-width: 64px; background: transparent; border: none; color: var(--text-secondary);
  padding: 10px 4px 8px; font-size: 12px; font-weight: 500; cursor: pointer;
  display: flex; flex-direction: column; align-items: center; gap: 2px;
  border-bottom: 2px solid transparent; font-family: inherit;
  transition: color .2s, border-color .2s;
}
.profile-tab:active { background: var(--sidebar-active); }
.profile-tab.active { color: var(--accent, #00a884); border-bottom-color: var(--accent, #00a884); font-weight: 600; }
.profile-tab-ic { font-size: 16px; line-height: 1; }
.profile-tab-lb { font-size: 11px; white-space: nowrap; }

.profile-scroll {
  flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch; padding-bottom: 16px;
}
.profile-scroll::-webkit-scrollbar { width: 5px; }
.profile-scroll::-webkit-scrollbar-thumb { background: var(--sidebar-active); border-radius: 3px; }
.profile-tab-pane { padding: 10px 12px; }
.profile-section-hint { font-size: 12px; color: var(--text-secondary); padding: 4px 2px 10px; }
.profile-empty { text-align: center; padding: 30px 12px; color: var(--text-secondary); }
.profile-loading { text-align: center; padding: 20px; color: var(--text-secondary); font-size: 13px; }

.followup-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; }
.followup-item {
  background: var(--panel-header-bg); border-radius: 8px; padding: 10px 12px;
  border-left: 3px solid var(--accent, #00a884);
}
.followup-time { font-size: 11px; color: var(--text-secondary); margin-bottom: 4px; }
.followup-content { font-size: 13px; color: var(--text-primary); line-height: 1.5; white-space: pre-wrap; word-break: break-word; }
.followup-add { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; }
.followup-add-btn { height: 38px; }

@media (max-width: 900px) {
  .customer-panel-body .customer-header { padding: 10px 12px; gap: 8px; }
  .customer-hero-avatar { width: 48px !important; height: 48px !important; }
  .customer-hero-fallback { font-size: 18px; }
  .customer-head-name { font-size: 14px; }
  .profile-tab { padding: 8px 2px 6px; }
  .profile-tab-ic { font-size: 15px; }
  .profile-tab-lb { font-size: 10px; }
}

.customer-alert {
  background: #3d2f08; border-left: 3px solid #f59e0b; border-radius: 6px;
  padding: 10px 12px; margin: 8px 12px; display: flex; align-items: center; gap: 10px;
}
.customer-alert-text { color: #fef3c7; font-size: 13px; flex: 1; }
.customer-alert-btn {
  background: #f59e0b; color: #fff; border: none; border-radius: 4px; padding: 6px 12px;
  font-size: 12px; cursor: pointer; font-family: inherit; white-space: nowrap; transition: background .2s;
}
.customer-alert-btn:hover:not(:disabled) { background: #d97706; }
.customer-alert-btn:disabled { opacity: .6; cursor: not-allowed; }

.customer-bg-btn-wrap { padding: 4px 0 10px; }
.customer-bg-btn {
  width: 100%; height: 40px; background: var(--accent); color: #fff; border: none; border-radius: 6px;
  font-size: 14px; font-weight: 500; cursor: pointer; font-family: inherit; transition: background .2s;
}
.customer-bg-btn:hover { background: #008c6e; }
.customer-bg-btn:disabled { opacity: 0.7; cursor: wait; }
.bg-check-time { font-size: 11px; color: var(--text-secondary); text-align: center; padding: 0 12px; margin-top: -4px; }

/* ── 🔍 背调独立面板（卡片化） ── */
.col-function-panel .bgcheck-panel-body { padding: 14px 16px 16px; }
.col-function-panel .bgcheck-panel-body .bgcheck-content { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 10px; }
.col-function-panel .bgcheck-panel-body .profile-section-hint { padding: 0; }
.col-function-panel .bgcheck-panel-body .customer-bg-btn-wrap { padding: 0; display: flex; flex-direction: column; gap: 6px; }
.col-function-panel .bgcheck-panel-body .customer-bg-btn { width: 100%; height: 40px; border-radius: 8px; }
.col-function-panel .bgcheck-panel-body .bg-check-time { margin-top: 0; padding: 0; text-align: center; font-size: 12px; }
.col-function-panel .bgcheck-panel-body .bg-report-card {
  flex: 1; min-height: 0; display: flex; flex-direction: column;
  background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 10px;
  margin: 0; padding: 12px 14px; overflow: hidden;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
}
.col-function-panel .bgcheck-panel-body .bg-report-head { padding: 0 0 8px; margin-bottom: 8px; border-bottom: 1px solid var(--border-color); }
.col-function-panel .bgcheck-panel-body .bg-report-body { flex: 1; min-height: 0; overflow-y: auto; max-height: none; padding-right: 6px; }
.col-function-panel .bgcheck-panel-body .bg-report-body::-webkit-scrollbar { width: 5px; }
.col-function-panel .bgcheck-panel-body .bg-report-body::-webkit-scrollbar-thumb { background: var(--sidebar-active); border-radius: 4px; }
.col-function-panel .bgcheck-panel-body .bg-report-footer { padding: 10px 0 0; margin-top: 8px; border-top: 1px solid var(--border-color); }
.col-function-panel.m-panel .bgcheck-panel-body { padding: 12px; }

/* Background check rating badges */
.conv-bg-rating {
  position: absolute;
  bottom: -2px;
  right: -2px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--sidebar-bg, #0b141a);
  line-height: 1;
  z-index: 2;
}
.mh-bg-rating {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  margin-left: 6px;
  line-height: 1;
}
.bg-report-card { background: transparent; border: none; border-radius: 0; margin: 8px 0 0; overflow: visible; }
.bg-report-head { display: flex; align-items: center; justify-content: space-between; padding: 0 0 8px; margin-bottom: 8px; border-bottom: 1px solid var(--sidebar-active); }
.bg-report-body { padding: 0; font-size: 13.5px; line-height: 1.75; color: var(--text-primary); max-height: none; overflow: visible; white-space: normal; word-break: break-word; }
.bg-report-body p { margin: 0 0 6px; }
.bg-report-body p.bg-report-empty { height: 6px; margin: 0; }
.bg-report-footer { padding: 12px 0 8px; border-top: 1px dashed var(--sidebar-active); margin-top: 8px; display: flex; flex-direction: column; gap: 8px; }
.bg-missing-tip { font-size: 12px; color: var(--text-secondary); }
.bg-missing-tags { color: #f59e0b; }
.bg-ask-btn { background: #6366f1; }
.bg-ask-btn:hover:not(:disabled) { background: #4f46e5; }

/* ── BANT Score Styles ── */
.conv-bant-level {
  position: absolute; top: -2px; right: -2px;
  width: 18px; height: 18px; border-radius: 50%;
  color: #fff; font-size: 9px; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
  border: 2px solid var(--sidebar-bg, #0b141a);
  line-height: 1; z-index: 2; cursor: pointer; transition: transform 0.15s;
}
.conv-bant-level:hover { transform: scale(1.15); }
.conv-bant-level.bant-high { background: #22c55e; }
.conv-bant-level.bant-medium { background: #eab308; }
.conv-bant-level.bant-low { background: #94a3b8; }
.mh-bant-level {
  display: inline-flex; align-items: center; justify-content: center;
  padding: 2px 8px; border-radius: 20px;
  color: #fff; font-size: 11px; font-weight: 600;
  margin-left: 6px; line-height: 1.4; cursor: pointer; transition: opacity 0.15s;
}
.mh-bant-level:hover { opacity: 0.85; }
.mh-bant-level.bant-high { background: #22c55e; }
.mh-bant-level.bant-medium { background: #eab308; }
.mh-bant-level.bant-low { background: #94a3b8; }
.bant-dialog .el-dialog { background: var(--panel-header-bg, #202c33); border-radius: 12px; }
.bant-dialog .el-dialog__title { color: var(--text-primary, #e9edef); }
.bant-dialog .el-dialog__header { border-bottom: 1px solid var(--border-color, #2a3942); padding-bottom: 12px; }
.bant-detail-body { padding: 0; }
.bant-summary {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 16px; margin-bottom: 16px;
  background: var(--sidebar-active, #2a3942); border-radius: 10px;
}
.bant-level-badge {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 48px; height: 28px; padding: 0 10px;
  border-radius: 20px; color: #fff; font-size: 13px; font-weight: 700;
}
.bant-level-badge.bant-high { background: #22c55e; }
.bant-level-badge.bant-medium { background: #eab308; color: #1a1a1a; }
.bant-level-badge.bant-low { background: #94a3b8; }
.bant-total-score { font-size: 22px; font-weight: 700; color: var(--text-primary, #e9edef); }
.bant-dimensions { display: flex; flex-direction: column; gap: 14px; }
.bant-dim-item { padding: 0; }
.bant-dim-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
.bant-dim-label { font-size: 13px; color: var(--text-primary, #e9edef); font-weight: 500; }
.bant-dim-score { font-size: 14px; font-weight: 700; color: var(--accent-info, #53bdeb); }
.bant-dim-bar { height: 6px; border-radius: 3px; background: var(--sidebar-active, #2a3942); overflow: hidden; margin-bottom: 4px; }
.bant-bar-fill { height: 100%; border-radius: 3px; transition: width 0.4s ease; }
.bant-bar-budget { background: linear-gradient(90deg, #22c55e, #16a34a); }
.bant-bar-authority { background: linear-gradient(90deg, #53bdeb, #027eb5); }
.bant-bar-need { background: linear-gradient(90deg, #f59e0b, #d97706); }
.bant-bar-timeline { background: linear-gradient(90deg, #a78bfa, #7c3aed); }
.bant-dim-reason { font-size: 12px; color: var(--text-secondary, #8696a0); margin: 2px 0 0; line-height: 1.5; }
.bant-summary-text { font-size: 13px; color: var(--text-primary, #e9edef); margin: 16px 0 8px; padding: 10px 12px; background: var(--chat-bg, #0b141a); border-radius: 8px; line-height: 1.6; }
.bant-eval-time { font-size: 11px; color: var(--text-muted, #667781); margin: 8px 0 0; }
.bant-detail-empty { text-align: center; padding: 32px 0; color: var(--text-secondary, #8696a0); }
.bant-empty-hint { font-size: 12px; color: var(--text-muted, #667781); margin-top: 8px; }
.bant-config-dialog .el-dialog { background: var(--panel-header-bg, #202c33); border-radius: 12px; }
.bant-config-dialog .el-dialog__title { color: var(--text-primary, #e9edef); }
.bant-config-body { padding: 0; }
.bant-config-section { margin-bottom: 20px; }
.bant-config-section h4 { font-size: 13px; color: var(--text-secondary, #8696a0); margin: 0 0 12px; font-weight: 600; }
.bant-config-row { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
.bant-config-row label { font-size: 13px; color: var(--text-primary, #e9edef); min-width: 100px; }
.bant-config-row .el-slider { flex: 1; }


.customer-ask-list { padding: 0 12px; display: flex; flex-direction: column; gap: 8px; max-height: 320px; overflow-y: auto; }
.customer-ask-list::-webkit-scrollbar { width: 6px; }
.customer-ask-list::-webkit-scrollbar-thumb { background: var(--sidebar-active); border-radius: 3px; }
.customer-ask-card {
  background: var(--panel-header-bg); border-radius: 8px; padding: 10px 12px; border-left: 3px solid #f59e0b;
}
.customer-ask-name { color: #f59e0b; font-weight: 600; font-size: 12px; margin-bottom: 6px; }
.customer-ask-foreign {
  background: var(--panel-bg); border-radius: 4px; padding: 8px 10px; color: var(--text-primary); font-size: 13px;
  line-height: 1.5; white-space: pre-wrap; word-break: break-word; margin-bottom: 6px;
}
.customer-ask-chinese { color: var(--text-secondary); font-size: 12px; font-style: italic; margin-bottom: 8px; }
.customer-ask-use {
  width: 100%; background: var(--sidebar-active); color: var(--text-primary); border: none; border-radius: 4px;
  padding: 7px; font-size: 12px; cursor: pointer; font-family: inherit; transition: background .2s;
}
.customer-ask-use:hover { background: var(--accent); color: #fff; }

.customer-extract-card {
  background: var(--panel-header-bg); border: 1px solid var(--accent); border-radius: 8px; padding: 12px;
  margin: 8px 12px;
}
.customer-extract-head {
  display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;
}
.customer-extract-close {
  background: transparent; color: var(--text-secondary); border: none; font-size: 14px; cursor: pointer;
}
.customer-extract-close:hover { color: var(--text-primary); }
.customer-extract-fields { display: flex; flex-direction: column; gap: 6px; }
.customer-extract-row {
  display: flex; align-items: center; gap: 8px; padding: 6px 0; border-bottom: 1px dashed var(--border-color); font-size: 13px;
}
.customer-extract-row:last-child { border-bottom: none; }
.customer-extract-label { color: var(--text-secondary); min-width: 70px; font-size: 12px; }
.customer-extract-val { color: var(--text-primary); flex: 1; word-break: break-word; }
.customer-extract-adopt {
  background: var(--sidebar-active); color: var(--text-primary); border: none; border-radius: 4px; padding: 2px 8px;
  font-size: 11px; cursor: pointer; font-family: inherit; transition: all .2s;
}
.customer-extract-adopt:hover { background: var(--accent); }
.customer-extract-exists { color: var(--text-secondary); font-size: 11px; }
.customer-extract-footer { display: flex; gap: 8px; margin-top: 10px; }

.customer-fields {
  flex: 1; overflow-y: auto; padding: 4px 14px;
}
.customer-fields::-webkit-scrollbar { width: 6px; }
.customer-fields::-webkit-scrollbar-thumb { background: var(--sidebar-active); border-radius: 3px; }
.customer-field { padding: 10px 0; border-bottom: 1px solid var(--border-color); }
.customer-field:last-child { border-bottom: none; }
.customer-field.warn .customer-field-label { color: #f59e0b !important; }
.customer-field-label { color: var(--text-secondary); font-size: 12px; margin-bottom: 4px; display: flex; align-items: center; gap: 4px; }
.customer-required { color: #ef4444; }
.customer-field-value {
  color: var(--text-primary); font-size: 14px; line-height: 1.5; display: flex; align-items: center; gap: 8px;
  word-break: break-word;
}
.customer-field-value.empty { color: var(--text-secondary); font-style: italic; }
.customer-input :deep(.el-input__wrapper),
.customer-input :deep(.el-textarea__inner),
.customer-input :deep(.el-select__wrapper) {
  background: var(--sidebar-active) !important; color: var(--text-primary) !important; border-radius: 4px !important;
  box-shadow: none !important; border: 1px solid var(--text-muted) !important;
}
.customer-input :deep(.el-input__inner),
.customer-input :deep(.el-textarea__inner) {
  color: var(--text-primary) !important; background: var(--sidebar-active) !important;
}
.customer-input :deep(.el-textarea__inner) { font-family: inherit; }
.customer-input :deep(.el-input__wrapper.is-focus),
.customer-input :deep(.el-textarea__inner:focus) { border-color: var(--accent) !important; }
.customer-input :deep(.el-select__wrapper.is-focused) { border-color: var(--accent) !important; }

.customer-footer {
  display: flex; gap: 8px; padding: 10px 14px; border-top: 1px solid var(--border-color); background: var(--panel-bg);
}
.customer-btn-primary {
  flex: 1; background: var(--accent); color: #fff; border: none; border-radius: 6px; padding: 9px;
  font-size: 14px; font-weight: 500; cursor: pointer; font-family: inherit; transition: background .2s;
}
.customer-btn-primary:hover:not(:disabled) { background: #008c6e; }
.customer-btn-primary:disabled { opacity: .6; cursor: not-allowed; }
.customer-btn-ghost {
  background: var(--sidebar-active); color: var(--text-primary); border: none; border-radius: 6px; padding: 9px 16px;
  font-size: 14px; cursor: pointer; font-family: inherit; transition: background .2s;
}
.customer-btn-ghost:hover { background: var(--text-muted); }



/* ===== 2026-07-13 移动端响应式补丁（追加） ===== */
@media (max-width: 900px) {
  /* 平台侧栏永远隐藏 */
  .platform-nav { display: none !important; }

  /* 顶部栏：让右侧按钮组横向排列 */
  .mh-right { display: flex; align-items: center; gap: 2px; margin-left: auto; }
  .mh-btn.active { background: #00a88430; color: var(--accent); border-radius: 50%; }
/* 手机端三下拉分组菜单 */
.mh-right { display:flex; align-items:center; gap:4px; }
.mh-menu-wrap { position: relative; overflow: visible; z-index: 10; }
.mh-group-btn { display:flex; align-items:center; gap:2px; padding:0 8px !important; width:auto !important; min-width:44px !important; min-height:44px !important; height:44px; border-radius:8px !important; touch-action:manipulation; -webkit-tap-highlight-color:rgba(0,0,0,0.2); cursor:pointer; position:relative; z-index:1; pointer-events:auto; }
.mh-g-icon { font-size:18px; line-height:1; }
.mh-g-caret { font-size:10px; color:var(--text-secondary,#888); margin-left:2px; transition:transform .15s; line-height:1; }
.mh-g-caret.open { transform:rotate(180deg); color:var(--accent,#00a884); }
.mh-dropdown {
  position:absolute; top:calc(100% + 4px); right:0;
  background:var(--panel-bg,#fff);
  border:1px solid var(--border-color,#e5e7eb);
  border-radius:12px;
  box-shadow:0 6px 24px rgba(0,0,0,.18);
  min-width:152px;
  z-index: 9999;
  padding:6px;
  animation:mhDdIn .15s ease-out;
}
@keyframes mhDdIn { from{opacity:0;transform:translateY(-6px);} to{opacity:1;transform:translateY(0);} }
.mh-dd-item {
  display:flex; align-items:center; gap:10px;
  padding:10px 12px;
  border-radius:8px;
  font-size:14px;
  color:var(--text-primary,#222);
  cursor:pointer;
  user-select:none;
}
.mh-dd-item:active { background:var(--sidebar-active,#f0f2f5); }
.mh-dd-item.active { color:var(--accent,#00a884); background:var(--accent-faint,#00a88410); }
.mh-dd-icon { font-size:18px; width:22px; text-align:center; }
.mh-dd-label { flex:1; }
.mh-dd-check { font-weight:bold; font-size:15px; color:var(--accent,#00a884); min-width:16px; text-align:center; }
body.dark .mh-dropdown { background:#23313d; border-color:#2a3942; box-shadow:0 6px 20px rgba(0,0,0,.5); }
body.dark .mh-dd-item { color:#e9edef; }
body.dark .mh-dd-item:active { background:#2a3942; }
  .mh-btn { min-width: 44px; min-height: 44px; touch-action: manipulation; -webkit-tap-highlight-color: rgba(0,0,0,0.2); cursor: pointer; }

  /* 遮罩要覆盖整个视口，除顶部头和底部tab */
  .mobile-overlay { z-index: 65; }

  /* 聊天区固定撑满，padding-bottom 预留底部tab空间 */
  .workspace { flex: 1; min-height: 0; position: relative; width: auto; overflow: hidden; height: 0; padding-bottom: 0; box-sizing: border-box; padding-top: 0; }
  .workspace.has-mheader { padding-top: 0; }
  /* comm-module在手机端必须占满workspace；父workspace有padding-top:52px，absolute top:0即从padding下方开始=正好贴住fixed header底部 */
  .comm-module { position: absolute; top: 0; left: 0; right: 0; bottom: 0; width: 100%; height: auto; overflow: hidden; }
  .module-full { height: 100%; overflow-y: auto !important; -webkit-overflow-scrolling: touch; background: var(--panel-bg); padding-top: 12px; box-sizing: border-box; }

  /* 账号栏：抽屉式，默认隐藏在屏幕左侧，m-open时滑入 */
  .col-accounts { width: 78vw !important; max-width: 300px !important; z-index: 45; position: absolute !important; left: 0; top: 0; bottom: 0; transform: translateX(-100%); }
  .col-accounts.m-open { transform: translateX(0) !important; }

  /* 聊天列表：默认显示，进入对话时隐藏 */
  .col-chatlist { width: 100% !important; position: absolute; inset: 0; }
  .col-chatlist.m-hidden { transform: translateX(-100%); pointer-events: none; display: none; }

  /* 会话条目触摸高度 */
  .conv-item { min-height: 68px; padding: 10px 14px; }
  .conv-avatar { width: 48px; height: 48px; font-size: 18px; }
  .conv-name { font-size: 15px; }
  .conv-preview { font-size: 13px; }

  /* 聊天主区：全宽覆盖 */
  .col-conversation {
    position: absolute !important; inset: 0; z-index: 30;
    background: var(--chat-bg);
    transform: translateX(100%);
    transition: transform 0.28s cubic-bezier(0.4,0,0.2,1);
    display: flex !important; flex-direction: column !important;
    padding-bottom: 0; /* 输入框自己有高度 */
  }
  .col-conversation.m-in { transform: none !important; }
  .col-conversation > * { height: 100%; }

  /* 功能面板：移动端全屏覆盖（从右侧滑入），不再是半屏 */
  .col-function-panel.m-panel {
    display: flex !important;
    position: fixed !important;
    top: 60px; right: 0; bottom: 0; left: 0 !important;
    width: 100vw !important;
    max-width: none !important;
    height: calc(100dvh - 60px - 62px) !important;
    z-index: 80;
    transform: translateX(100%);
    transition: transform 0.28s cubic-bezier(0.4,0,0.2,1);
    box-shadow: -4px 0 24px rgba(0,0,0,0.5);
    background: var(--panel-bg);
    flex-direction: column;
    padding-bottom: 0;
  }
  .col-function-panel.m-panel.m-panel-show { transform: translateX(0) !important; }
  .col-function-panel.m-panel .col-header {
    height: 52px; padding: 0 12px; flex-shrink: 0;
    background: var(--panel-header-bg); border-bottom: 1px solid var(--border-color);
  }
  .col-function-panel.m-panel .m-panel-close {
    width: 40px; height: 40px; display: flex !important;
    align-items: center; justify-content: center;
    background: none; border: none; color: var(--text-primary); cursor: pointer;
    border-radius: 50%; margin-left: auto;
  }
  .col-function-panel.m-panel .m-panel-close:active { background: var(--sidebar-active); }

  .ai-body { display: none !important; }
  /* AI话术面板在移动端的内部布局 */
  .col-function-panel.m-panel .aitalk-panel-body,
  .col-function-panel.m-panel .customer-panel-body { flex: 1; min-height: 0; overflow: hidden; }
  .col-function-panel.m-panel .aitalk-scroll { -webkit-overflow-scrolling: touch; }

  /* AI话术按钮、输入框适配触摸 */
  .col-function-panel.m-panel .ai-action-btn,
  .col-function-panel.m-panel .aitalk-mode-btn,
  .col-function-panel.m-panel .aitalk-gen-btn,
  .col-function-panel.m-panel .ai-gen-btn,
  .col-function-panel.m-panel .ai-insert-btn,
  .col-function-panel.m-panel .aitalk-send-btn,
  .col-function-panel.m-panel .ai-reply-card button {
    min-height: 44px; font-size: 14px;
  }
  .col-function-panel.m-panel .ai-chat-input,
  .col-function-panel.m-panel .aitalk-input {
    min-height: 44px; font-size: 16px; /* 避免iOS自动缩放 */
  }
  .col-function-panel.m-panel .ai-reply-card { padding: 12px; margin: 8px 12px; }
  .col-function-panel.m-panel .ai-reply-text { font-size: 14px; line-height: 1.5; }
  .col-function-panel.m-panel .ai-reply-footer { flex-direction: column; gap: 8px; align-items: stretch; }
  .col-function-panel.m-panel .ai-insert-btn { width: 100%; padding: 10px; border-radius: 8px; }
  .col-function-panel.m-panel .aitalk-msg-bubble { max-width: 85%; }
  .col-function-panel.m-panel .aitalk-chip { padding: 10px 14px; min-height: 40px; font-size: 13px; }

  /* AI话术顶部栏适配：全宽选择器堆叠 */
  .col-function-panel.m-panel .aitalk-top-bar { padding: 10px 12px; gap: 8px; }
  .col-function-panel.m-panel .aitalk-top-first-row { flex-wrap: wrap; }
  .col-function-panel.m-panel .aitalk-model-select { flex: 1; min-width: 140px; }
  .col-function-panel.m-panel .sub-select .el-select__wrapper { min-height: 40px; }

  /* 客户面板表单全宽、按钮够大 */
  .col-function-panel.m-panel .customer-panel-body { padding: 12px; overflow-y: auto; -webkit-overflow-scrolling: touch; }
  .col-function-panel.m-panel .customer-header { padding: 12px; }
  .col-function-panel.m-panel .customer-avatar { width: 56px; height: 56px; font-size: 22px; }
  .col-function-panel.m-panel .customer-field { margin-bottom: 14px; padding: 0 2px; }
  .col-function-panel.m-panel .customer-field-label { font-size: 13px; margin-bottom: 6px; }
  .col-function-panel.m-panel .customer-field-value { padding: 10px 12px; min-height: 44px; font-size: 14px; }
  .col-function-panel.m-panel .customer-input .el-input__wrapper,
  .col-function-panel.m-panel .customer-input .el-select__wrapper,
  .col-function-panel.m-panel .customer-input .el-textarea__inner {
    min-height: 44px !important; font-size: 15px !important;
  }
  .col-function-panel.m-panel .customer-input .el-textarea__inner { min-height: 80px !important; padding: 10px 12px; }
  .col-function-panel.m-panel .customer-footer { padding: 12px; gap: 10px; }
  .col-function-panel.m-panel .customer-btn-primary,
  .col-function-panel.m-panel .customer-btn-ghost,
  .col-function-panel.m-panel .customer-bg-btn,
  .col-function-panel.m-panel .customer-alert-btn,
  .col-function-panel.m-panel .customer-ask-use,
  .col-function-panel.m-panel .customer-extract-adopt {
    min-height: 46px; font-size: 14px; padding: 10px 16px; border-radius: 10px;
  }
  .col-function-panel.m-panel .customer-bg-btn { width: 100%; }
  .col-function-panel.m-panel .customer-ask-card { padding: 12px; margin: 8px 12px; }
  .col-function-panel.m-panel .customer-alert { margin: 8px 12px; padding: 10px 12px; flex-direction: column; align-items: stretch; gap: 8px; }
  .col-function-panel.m-panel .customer-extract-card { margin: 8px 12px; }
  .col-function-panel.m-panel .customer-extract-row { padding: 8px 0; flex-wrap: wrap; gap: 6px; }

  /* 翻译面板适配 */
  .col-function-panel.m-panel .trans-panel-body { padding: 12px; -webkit-overflow-scrolling: touch; overflow-y: auto; }
  .col-function-panel.m-panel .trans-panel { padding: 0; }
  .col-function-panel.m-panel .trans-block { padding: 12px; margin-bottom: 10px; }
  .col-function-panel.m-panel .trans-panel .el-select__wrapper,
  .col-function-panel.m-panel .trans-panel .el-input__wrapper { min-height: 44px; }
  .col-function-panel.m-panel .trans-panel .el-color-picker__trigger { min-height: 40px; }
  .col-function-panel.m-panel .sub-row { margin: 10px 0; }
  .col-function-panel.m-panel .switch-label, .col-function-panel.m-panel .sub-label { font-size: 13px; }
  .col-function-panel.m-panel .cfg-color-input { min-height: 40px; font-size: 14px; }

  /* 翻译确认弹窗（ChatView中）在移动端宽度 */
  .trans-confirm-panel { margin: 0 10px 8px !important; padding: 10px 12px; }
  .tcp-swap { padding: 6px 10px; min-height: 36px; }

  /* 底部tabbar：适配 */
  .mobile-tabbar {
    display: flex !important; height: 62px;
    background: #1a2329; border-top: 1px solid var(--sidebar-active);
    box-shadow: 0 -2px 10px rgba(0,0,0,0.25);
    padding-bottom: env(safe-area-inset-bottom, 0);
    z-index: 1001; flex-shrink: 0;
  }
  .m-tab {
    flex: 1; display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 3px;
    background: none; border: none; color: var(--text-secondary);
    font-size: 11px; cursor: pointer;
    min-height: 52px;
    padding: 4px 0 2px;
    transition: color .15s;
    -webkit-tap-highlight-color: transparent;
  }
  .m-tab span:first-child { font-size: 22px; line-height: 1; height: 24px; display: flex; align-items: center; justify-content: center; }
  .m-tab span:first-child svg { display: block; width: 22px; height: 22px; }
  .m-tab.active { color: var(--accent); }

  /* AI悬浮按钮：手机端隐藏，底部tabbar已有AI话术入口 */
  .mobile-ai-fab { display: none !important; }

  /* 隐藏桌面端折叠/切换按钮 */
  .col-accounts .col-header .col-toggle,
  .col-chatlist .col-header .col-toggle { display: none !important; }
  /* 但保留面板内的关闭按钮（.m-panel-close）可见 */

  /* 搜索框适配 */
  .col-chatlist .search-box { min-height: 40px; }
  .col-chatlist .search-box input { font-size: 15px; }

  /* 会话筛选胶囊 */
  .chat-filters { padding: 6px 8px; }
  .filter-tab { padding: 8px 12px; font-size: 13px; min-height: 36px; }

  /* 设置弹窗适配 */
  .settings-dialog { width: 100% !important; height: 100% !important; max-width: none !important; border-radius: 0 !important; flex-direction: column; }
  .settings-sidebar { width: 100% !important; height: auto !important; flex-direction: row; overflow-x: auto; flex-shrink: 0; border-right: none; border-bottom: 1px solid var(--border-color); }
  .settings-nav-item { flex-shrink: 0; padding: 12px 14px; min-height: 48px; }
  .settings-close { position: static; margin-left: auto; margin-top: 0; }
  .settings-content { flex: 1; overflow-y: auto; }

  /* 账号栏内部按钮/项适配触摸 */
  .wa-col-btn, .wa-empty-card, .wa-account-item { min-height: 52px; }
  .wa-empty-avatar, .wa-account-item .acc-avatar { width: 44px; height: 44px; }

  /* 空状态连接按钮 */
  .connect-btn-big { padding: 12px 28px; font-size: 15px; min-height: 48px; }
}


/* ===== 手机端ch-switch强力修复（最高优先级）===== */
@media (max-width: 900px) {
  .comm-module .ch-switch {
    position: absolute !important;
    top: 12px !important;
    left: 0 !important;
    right: 0 !important;
    width: 100% !important;
    height: 56px !important;
    min-height: 56px !important;
    min-width: 0 !important;
    flex-direction: row !important;
    align-items: center !important;
    justify-content: flex-start !important;
    gap: 12px !important;
    padding: 6px 16px !important;
    background: var(--panel-bg) !important;
    border-right: none !important;
    border-bottom: 1px solid var(--border-color) !important;
    z-index: 9999 !important;
    overflow: visible !important;
    overflow-y: visible !important;
    box-sizing: border-box !important;
  }
  .comm-module .ch-switch .ch-sw-btn {
    width: 44px !important;
    height: 44px !important;
    flex-shrink: 0 !important;
  }
  /* col-chatlist在手机端全屏absolute，但top:60px让位于ch-switch */
  .comm-module .col-chatlist {
    top: 68px !important;
    bottom: 0 !important;
    padding-top: 0 !important;
  }
  /* 进入对话模式时col-conversation同样从68px开始（12px呼吸+ch-switch高56） */
  .comm-module .col-conversation {
    top: 68px !important;
    bottom: 0 !important;
    padding-top: 0 !important;
  }
  .comm-module.email-active .col-conversation {
    top: 68px !important;
    bottom: 0 !important;
    padding-top: 0 !important;
    margin-left: 0 !important;
    transform: translateX(0) !important;
  }
}

@media(max-width:900px){
  .crm-layout{padding-top:0!important}
  .ch-switch{top:12px!important;height:56px!important}
  .col-chatlist{top:68px!important}
  .col-conversation{top:68px!important}
  .email-active .col-conversation{top:68px!important}
  .comm-module.drawer-open .ch-switch{display:none!important}
  .comm-module.drawer-open .col-chatlist{top:12px!important}
  /* 对话页/面板打开时ch-switch被v-if隐藏，内容区顶上去 */
  .comm-module.in-conv .ch-switch{display:none!important}
  .comm-module.in-conv .col-chatlist{top:12px!important}
  .comm-module.in-conv .col-conversation{top:12px!important}
  .comm-module.in-conv .email-active .col-conversation{top:12px!important}

  .ch-switch .ch-sw-btn{width:44px!important;height:44px!important}
}

@media (max-width: 900px) {
  .conv-chevron { display: none !important; }
}

/* ========== 运费查询面板 ========== */
.fr-panel-body { padding:12px; overflow-y:auto; height:100%; }
.fr-header { margin-bottom:12px; }
.fr-note { font-size:12px; color:var(--text-secondary); text-align:center; padding:6px; background:var(--sidebar-active); border-radius:6px; }
.fr-selectors { display:flex; flex-direction:column; gap:10px; margin-bottom:14px; }
.fr-select-row { display:flex; align-items:center; gap:8px; }
.fr-label { font-size:12px; color:var(--text-secondary); width:48px; flex-shrink:0; }
.fr-select { flex:1; background:var(--input-bg); color:var(--text-primary); border:1px solid var(--border-color); border-radius:6px; padding:7px 10px; font-size:13px; font-family:inherit; outline:none; }
.fr-select:focus { border-color:var(--accent); }
.fr-container-tabs { display:flex; gap:6px; flex:1; }
.fr-ctab { flex:1; padding:7px 0; border:1px solid var(--border-color); background:var(--panel-bg); color:var(--text-secondary); border-radius:6px; font-size:12px; font-weight:600; cursor:pointer; font-family:inherit; transition:all .15s; }
.fr-ctab.active { background:var(--accent); color:#fff; border-color:var(--accent); }
.fr-ctab:hover:not(.active) { border-color:var(--accent); color:var(--accent); }
.fr-result-card { background:var(--panel-header-bg); border:1px solid var(--border-color); border-radius:10px; padding:14px; margin-bottom:14px; }
.fr-price-row { display:flex; justify-content:space-between; align-items:baseline; margin-bottom:8px; }
.fr-price-label { font-size:13px; color:var(--text-primary); font-weight:500; }
.fr-price-value { font-size:24px; font-weight:700; color:var(--accent); }
.fr-price-unit { font-size:12px; font-weight:400; color:var(--text-secondary); margin-left:2px; }
.fr-price-value.fr-up { color:#ef4444; }
.fr-price-value.fr-down { color:#10b981; }
.fr-price-meta { display:flex; gap:12px; font-size:12px; margin-bottom:8px; }
.fr-trend { font-weight:500; }
.fr-trend.fr-up { color:#ef4444; }
.fr-trend.fr-down { color:#10b981; }
.fr-trend.fr-stable { color:var(--text-secondary); }
.fr-transit { color:var(--text-secondary); }
.fr-price-range { font-size:11px; color:var(--text-secondary); background:var(--sidebar-active); padding:6px 8px; border-radius:4px; margin-bottom:8px; }
.fr-price-disclaimer { font-size:11px; color:var(--text-muted, var(--text-secondary)); text-align:center; padding-top:6px; border-top:1px dashed var(--border-color); }
.fr-quick-title { font-size:12px; font-weight:600; color:var(--text-secondary); margin:6px 0 8px; padding-left:2px; }
.fr-quick-grid { display:grid; grid-template-columns:1fr 1fr; gap:7px; }
.fr-quick-card { background:var(--panel-header-bg); border:1px solid var(--border-color); border-radius:8px; padding:10px 9px; cursor:pointer; transition:all .15s; }
.fr-quick-card:hover { border-color:var(--accent); transform:translateY(-1px); }
.fr-quick-card.active { border-color:var(--accent); background:var(--accent); }
.fr-quick-card.active .fr-qc-route, .fr-quick-card.active .fr-qc-price, .fr-quick-card.active .fr-qc-meta { color:#fff; }
.fr-qc-route { font-size:11px; color:var(--text-secondary); margin-bottom:5px; line-height:1.3; }
.fr-qc-price { font-size:15px; font-weight:700; color:var(--accent); margin-bottom:4px; }
.fr-quick-card.active .fr-qc-price { color:#fff; }
.fr-qc-meta { display:flex; justify-content:space-between; font-size:11px; color:var(--text-muted, var(--text-secondary)); }
.fr-trend-mini.fr-up { color:#ef4444; }
.fr-trend-mini.fr-down { color:#10b981; }
.fr-trend-mini.fr-stable { color:var(--text-secondary); }
.fr-quick-card.active .fr-trend-mini { color:rgba(255,255,255,0.85); }
.fr-qc-transit { color:inherit; }

/* 询盘7分类徽章 */
.aitalk-inquiry-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 10px;
  margin-bottom: 10px;
  font-size: 13px;
  line-height: 1.4;
  background: var(--bg-elevated, #ffffff);
  border: 1px solid var(--border-color, #e5e7eb);
  border-left-width: 4px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
}
.inq-cat-prefix {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
  background: var(--bg-secondary, #f3f4f6);
  color: var(--text-secondary);
  flex-shrink:0;
  letter-spacing: 0.3px;
}
.inq-cat-sep {
  width:1px; height:14px; background: var(--border-color, #e5e7eb); flex-shrink:0;
}
.aitalk-inquiry-badge.inq-info { border-left-color: #3b82f6; }
.aitalk-inquiry-badge.inq-info .inq-cat-label { color: #2563eb; }
.aitalk-inquiry-badge.inq-price { border-left-color: #f97316; }
.aitalk-inquiry-badge.inq-price .inq-cat-label { color: #ea580c; }
.aitalk-inquiry-badge.inq-sample { border-left-color: #22c55e; }
.aitalk-inquiry-badge.inq-sample .inq-cat-label { color: #16a34a; }
.aitalk-inquiry-badge.inq-cert { border-left-color: #a855f7; }
.aitalk-inquiry-badge.inq-cert .inq-cat-label { color: #9333ea; }
.aitalk-inquiry-badge.inq-coop { border-left-color: #10b981; }
.aitalk-inquiry-badge.inq-coop .inq-cat-label { color: #059669; }
.aitalk-inquiry-badge.inq-reject { border-left-color: #ef4444; }
.aitalk-inquiry-badge.inq-reject .inq-cat-label { color: #dc2626; }
.aitalk-inquiry-badge.inq-refer { border-left-color: #06b6d4; }
.aitalk-inquiry-badge.inq-refer .inq-cat-label { color: #0891b2; }
.inq-cat-icon { font-size: 18px; flex-shrink:0; }
.inq-cat-label { font-weight: 700; flex-shrink:0; font-size:13px; }
.inq-cat-tip { color: var(--text-secondary); flex:1; font-size: 12px; }
@media (max-width: 900px) {
  .aitalk-inquiry-badge { padding: 8px 10px; font-size: 12px; gap:6px; flex-wrap: wrap; }
  .inq-cat-icon { font-size: 16px; }
  .inq-cat-sep { display: none; }
  .inq-cat-tip { width: 100%; padding-left: 28px; margin-top: -2px; }
}


/* ===== 手机端紧凑列表（WhatsApp风格） ===== */
@media (max-width: 900px) {
  /* 隐藏渠道切换条和账号栏（走☰抽屉） */
  .comm-module .ch-switch { display: none !important; }
  .col-accounts { display: none !important; }

  /* 聊天列表顶上去（不再为ch-switch让68px） */
  .comm-module .col-chatlist {
    top: 0 !important;
    bottom: 0 !important;
    padding-top: 0 !important;
  }
  .comm-module .col-conversation {
    top: 0 !important;
    bottom: 0 !important;
    padding-top: 0 !important;
  }
  .comm-module.email-active .col-conversation {
    top: 0 !important;
  }
  .comm-module.in-conv .col-chatlist { top: 0 !important; }
  .comm-module.in-conv .col-conversation { top: 0 !important; }
  .comm-module.in-conv .email-active .col-conversation { top: 0 !important; }
  .comm-module.drawer-open .col-chatlist { top: 0 !important; }

  /* 搜索框头部紧凑 */
  .col-chatlist .col-header {
    padding: 6px 10px;
    gap: 6px;
    min-height: 48px;
    height: 48px;
    position: relative !important;
    z-index: 100;
  }
  .col-chatlist .search-box {
    flex: 1;
    min-height: 36px;
    border-radius: 18px;
    padding: 0 12px;
    position: relative;
  }
  .col-chatlist .search-box input {
    font-size: 14px;
    padding: 0 28px 0 26px;
  }
  .col-header-actions {
    display: flex;
    align-items: center;
    gap: 2px;
  }
  .col-new-chat, .col-filter-btn {
    width: 38px;
    height: 38px;
    flex-shrink: 0;
    border-radius: 50%;
    background: transparent;
    border: none;
    color: var(--text-secondary, #8696a0);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    position: relative;
    -webkit-tap-highlight-color: transparent;
  }
  .col-new-chat:active, .col-filter-btn:active { background: var(--sidebar-active, #f0f2f5); }
  body.dark .col-new-chat:active, body.dark .col-filter-btn:active { background: #2a3942; }
  .filter-active-dot {
    position: absolute;
    top: 7px;
    right: 7px;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--accent, #00a884);
  }

  /* 搜索框内待跟进徽章 */
  .search-fu-badge {
    position: absolute;
    right: 6px;
    top: 50%;
    transform: translateY(-50%);
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    border-radius: 9px;
    background: #ef4444;
    color: #fff;
    font-size: 11px;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    z-index: 2;
  }
  .search-fu-badge:active { opacity: 0.7; }

  /* 三点下拉菜单 */
  .mobile-filter-menu {
    position: absolute;
    top: 48px;
    right: 10px;
    min-width: 200px;
    background: var(--panel-bg, #fff);
    border: 1px solid var(--border-color, #e9edef);
    border-radius: 12px;
    box-shadow: 0 6px 24px rgba(0,0,0,.15);
    z-index: 200;
    padding: 6px 0;
    overflow: hidden;
  }
  body.dark .mobile-filter-menu { background: #23313d; border-color: #2a3942; box-shadow: 0 6px 24px rgba(0,0,0,.5); }
  .mfm-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 11px 16px;
    font-size: 14px;
    color: var(--text-primary, #111);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  body.dark .mfm-item { color: #e9edef; }
  .mfm-item:active { background: var(--sidebar-active, #f0f2f5); }
  body.dark .mfm-item:active { background: #2a3942; }
  .mfm-item.active { color: var(--accent, #00a884); }
  .mfm-icon { width: 22px; text-align: center; font-size: 16px; }
  .mfm-label { flex: 1; }
  .mfm-check { font-weight: bold; color: var(--accent, #00a884); font-size: 15px; }
  .mfm-badge {
    min-width: 20px;
    height: 20px;
    padding: 0 6px;
    border-radius: 10px;
    background: var(--text-secondary, #8696a0);
    color: #fff;
    font-size: 11px;
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .mfm-badge-urgent { background: #ef4444; }
  .mfm-divider { border-top: 1px solid var(--border-color, #e9edef); }
  body.dark .mfm-divider { border-top-color: #2a3942; }
  .mfm-sub {
    padding: 4px 16px 8px 50px;
    display: flex;
    flex-wrap: wrap;
    gap: 4px 10px;
    font-size: 12px;
    color: var(--text-secondary, #8696a0);
  }
  .mfm-sub-item { cursor: pointer; }
  .mfm-sub-item:active { opacity: 0.7; }

  /* 头像角点调大更醒目 */
  .conv-followup-dot {
    width: 12px !important;
    height: 12px !important;
    border: 2px solid var(--panel-bg, #fff) !important;
    right: -2px !important;
    bottom: -2px !important;
  }
  body.dark .conv-followup-dot { border-color: #111b21 !important; }
  .conv-fr-badge {
    font-size: 9px !important;
    padding: 1px 5px !important;
  }
}


/* ===== 手机端顶栏渠道切换 ===== */
@media (max-width: 900px) {
  .mh-title { cursor: pointer; }
  /* 列表视图：标题组紧凑靠左，不撑满 */
  .mh-title.mh-title-list { flex: 0 1 auto !important; gap: 6px; }
  .mh-title.mh-title-list .mh-ch-icon {
    width: 22px; height: 22px; margin-right: 2px; flex-shrink: 0;
    display: inline-flex; align-items: center; justify-content: center;
  }
  .mh-title.mh-title-list .mh-ch-icon :deep(svg),
  .mh-title.mh-title-list .mh-ch-icon svg { width: 20px; height: 20px; }
  .mh-title.mh-title-list .mh-name-row.mh-name-row-list {
    flex: 0 1 auto !important;
    flex-direction: row !important;
    align-items: center;
    gap: 3px;
  }
  .mh-name-row.mh-name-row-list {
    flex-direction: row !important;
    align-items: center;
    gap: 4px;
  }
  .mh-name-row.mh-name-row-list .mh-name-text {
    flex: 0 0 auto;
    max-width: 60vw;
  }
  .mh-ch-icon {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-primary);
    flex-shrink: 0;
  }
  .mh-ch-icon :deep(svg), .mh-ch-icon svg { width:22px; height:22px; }
  .mh-ch-caret {
    margin-left: 2px;
    color: var(--text-secondary);
    transition: transform .2s;
    flex-shrink: 0;
  }
  .mh-ch-badge {
    margin-left: 4px;
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    border-radius: 9px;
    background: #ef4444;
    color: #fff;
    font-size: 11px;
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    line-height: 1;
  }

  /* 渠道切换 ActionSheet */
  .channel-sheet .asi-ch-icon {
    font-size: 22px;
    width: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .channel-sheet .asi-ch-icon :deep(svg), .channel-sheet .asi-ch-icon svg { width:24px; height:24px; }
  .asi-badge {
    min-width: 20px;
    height: 20px;
    padding: 0 6px;
    border-radius: 10px;
    background: var(--text-secondary, #8696a0);
    color: #fff;
    font-size: 11px;
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-left: auto;
    margin-right: 8px;
  }
  .asi-badge-red { background: #ef4444; }
  .asi-tag {
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 10px;
    background: var(--sidebar-active);
    color: var(--text-secondary);
    margin-left: 6px;
  }
  .asi-tag-soon { color: #8696a0; background: #f0f2f5; }
  body.dark .asi-tag-soon { background: #2a3942; }
  .asi-tag-online { background: rgba(0,168,132,.15); color: #00a884; }
  .asi-check { color: var(--accent, #00a884); font-weight: bold; font-size: 16px; margin-left: auto; }
  .action-sheet-item.active { color: var(--accent, #00a884); }
  .asi-offline { opacity: 0.6; }
  .asi-channel-header { cursor: pointer; font-weight: 600; }
  .asi-label { flex: 1; text-align: left; }

  /* 多账号子区 */
  .as-sub-accounts {
    border-top: 8px solid var(--sidebar-active, #f0f2f5);
    padding-top: 4px;
  }
.as-sub-accounts.as-sub-menu {
  padding-left: 12px;
  border-left: 2px solid rgba(255,255,255,0.1);
  margin-left: 16px;
  margin-bottom: 8px;
}
.as-sub-accounts.as-sub-menu .action-sheet-item {
  font-size: 13px;
  padding: 10px 16px;
}
.as-sub-accounts.as-sub-menu .asi-icon {
  width: 32px;
  height: 32px;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

  body.dark .as-sub-accounts { border-top-color: #1a2329; }
  .as-sub-title {
    font-size: 12px;
    color: var(--text-secondary);
    padding: 8px 20px 4px;
    text-transform: uppercase;
    letter-spacing: .5px;
  }
  .as-sub-item { padding-left: 36px; }
  .as-current-acc {
    padding: 12px 20px;
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 14px;
    color: var(--text-primary);
  }
  .as-cur-name { flex: 1; font-weight: 500; }
  .as-add-account {
    font-size: 13px;
    color: var(--accent, #00a884);
    font-weight: 500;
    margin-left: auto;
    cursor: pointer;
    padding: 4px 8px;
  }
  .as-acc-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    object-fit: cover;
    display: inline-block;
  }
  .as-acc-fallback {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-size: 13px;
    font-weight: 600;
  }
}

/* 非手机端隐藏新按钮（PC端用胶囊Tab） */
@media (min-width: 901px) {
  .col-filter-btn { display: none !important; }
  .mobile-filter-menu { display: none !important; }
  .search-fu-badge { display: none !important; }
  .col-header-actions { display: contents; }
}

.mh-ch-arrow { opacity: 0.6; margin-left: 2px; flex-shrink: 0; }

.tg-attach-btn:hover { color: var(--text-primary, #e9edef) !important; }
.tg-attach-item:hover { background: var(--sidebar-active, #374045) !important; }

/* File preview chips */
/* 附件预览条：输入框上方横排缩略图 */
.ta-attach-bar {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  padding: 4px 4px 6px;
  margin-bottom: 0;
}
.ta-attach-chip {
  position: relative;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(59,130,246,0.12);
  border: 1px solid rgba(59,130,246,0.28);
  border-radius: 10px;
  padding: 4px 8px 4px 4px;
}
.ta-attach-thumb {
  width: 52px;
  height: 52px;
  object-fit: cover;
  border-radius: 8px;
  display: block;
}
.ta-attach-fileicon { font-size: 22px; }
.ta-attach-filename {
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: var(--text-primary, #e9edef);
}
.ta-attach-remove {
  position: absolute;
  top: -6px; right: -6px;
  width: 20px; height: 20px;
  border-radius: 50%;
  border: none;
  background: rgba(0,0,0,0.65);
  color: #fff;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  -webkit-appearance: none;
  appearance: none;
  box-sizing: border-box;
}
.ta-attach-remove:hover { background: #ef4444; }
@media (max-width: 768px) {
  .ta-attach-thumb { width: 64px; height: 64px; }
  .ta-attach-remove { width: 24px; height: 24px; font-size: 16px; }
}
</style>

<style>
/* 全局深色下拉 popper（teleport到body，必须用非scoped样式） */
.el-popper.crm-dark-popper,
.el-popper.is-light.crm-dark-popper {
  background: #233138 !important;
  border: 1px solid var(--sidebar-active) !important;
}
.el-popper.crm-dark-popper .el-popper__arrow::before {
  background: #233138 !important;
  border-color: var(--sidebar-active) !important;
}
.el-popper.crm-dark-popper .el-select-dropdown__item {
  color: var(--text-primary) !important;
}
.el-popper.crm-dark-popper .el-select-dropdown__item:hover,
.el-popper.crm-dark-popper .el-select-dropdown__item.hover,
.el-popper.crm-dark-popper .el-select-dropdown__item.is-hovering {
  background: var(--sidebar-active) !important;
  color: var(--text-primary) !important;
}
.el-popper.crm-dark-popper .el-select-dropdown__item.selected,
.el-popper.crm-dark-popper .el-select-dropdown__item.is-selected {
  color: var(--accent) !important;
  font-weight: 600;
}
.el-popper.crm-dark-popper .el-select-dropdown__empty {
  color: var(--text-secondary) !important;
}
/* 客户资料面板 select 下拉暗色适配 */
.customer-fields .el-popper.crm-dark-popper {
  background: #233138 !important;
  border: 1px solid #2f3338 !important;
  border-radius: 8px !important;
}
.customer-fields .el-popper.crm-dark-popper .el-select-dropdown__item {
  color: #e9edef !important;
}
.customer-fields .el-popper.crm-dark-popper .el-select-dropdown__item:hover,
.customer-fields .el-popper.crm-dark-popper .el-select-dropdown__item.is-hovering {
  background: #2a3942 !important;
}
.customer-fields .el-popper.crm-dark-popper .el-select-dropdown__item.is-selected {
  color: #00a884 !important;
  font-weight: 600;
}
/* nc-country 下拉暗色适配 */
.nc-country-list { background: #233138 !important; border-color: #2f3338 !important; }
.nc-country-item { color: #e9edef !important; }
.nc-country-item:hover { background: #2a3942 !important; }
.nc-search-wrap { background: #233138 !important; }
.nc-search-input { background: #2a3942 !important; color: #e9edef !important; }

/* 全局：功能面板内所有 Element Plus 控件统一黑底下划线风格 */
.col-function-panel .el-select .el-select__wrapper,
.col-function-panel .el-select .el-input__wrapper,
.col-function-panel .el-input .el-input__wrapper {
  background-color: var(--sidebar-active) !important;
  box-shadow: none !important;
  border: 1px solid var(--text-muted) !important;
  border-radius: 6px !important;
  padding: 0 10px !important;
  min-height: 36px;
}
.col-function-panel .el-select .el-select__wrapper:hover,
.col-function-panel .el-select .el-input__wrapper:hover,
.col-function-panel .el-input .el-input__wrapper:hover {
  border-color: var(--text-secondary) !important;
}
.col-function-panel .el-select .el-select__wrapper.is-focused,
.col-function-panel .el-select .el-input__wrapper.is-focus,
.col-function-panel .el-input .el-input__wrapper.is-focus {
  border-color: var(--accent) !important;
}
.col-function-panel .el-select .el-select__placeholder,
.col-function-panel .el-select .el-select__selected-item,
.col-function-panel .el-input .el-input__inner {
  color: var(--text-primary) !important;
  -webkit-text-fill-color: var(--text-primary) !important;
}
.col-function-panel .el-select .el-select__caret,
.col-function-panel .el-select .el-select__suffix,
.col-function-panel .el-input__suffix {
  color: var(--text-secondary) !important;
}
/* 颜色选择器按钮黑底 */
.col-function-panel .el-color-picker__trigger {
  background: var(--sidebar-active) !important;
  border-color: var(--text-muted) !important;
}
/* 色值输入框也黑底 */
.col-function-panel .cfg-color-input {
  background: var(--sidebar-active) !important;
  border-color: var(--text-muted) !important;
  color: var(--text-primary) !important;
}


/* ── 🎯 需求总结面板 ── */
.req-panel-body { padding: 0; height: 100%; overflow-y: auto; }
.req-fields { padding: 12px 16px; }
.req-row { display: flex; align-items: flex-start; padding: 8px 0; border-bottom: 1px solid var(--border-color); gap: 10px; }
.req-row:last-of-type { border-bottom: none; }
.req-label { color: var(--text-secondary); font-size: 12px; min-width: 78px; flex-shrink: 0; padding-top: 2px; }
.req-val { color: var(--text-primary); font-size: 13px; flex: 1; word-break: break-word; line-height: 1.5; }
.req-val.empty { color: #5a6a75; }
.req-summary-block { padding: 12px 0 4px; border-top: 1px solid var(--border-color); margin-top: 6px; }
.req-summary-text { background: var(--panel-header-bg); padding: 10px 12px; border-radius: 8px; color: var(--text-primary); font-size: 13px; line-height: 1.6; min-height: 40px; white-space: pre-wrap; word-break: break-word; }
.req-summary-text-block {
  background: var(--sidebar-active);
  border: 1px solid var(--text-muted);
  border-radius: 8px;
  padding: 12px 14px;
  color: var(--text-primary);
  font-size: 13.5px;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
  min-height: 80px;
}
.req-summary-text-block.empty { color: var(--text-secondary); font-style: italic; }
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


/* ── 需求分析Markdown渲染样式 ── */
.req-md-content { font-size: 13px; line-height: 1.7; color: var(--text-primary); }
.req-md-content h2 { font-size: 16px; color: var(--text-primary); margin: 16px 0 10px; padding-bottom: 6px; border-bottom: 1px solid var(--sidebar-active); font-weight: 600; }
.req-md-content h2:first-child { margin-top: 0; }
.req-md-content h3 { font-size: 14px; color: var(--accent); margin: 14px 0 8px; font-weight: 600; }
.req-md-content table { width: 100%; border-collapse: collapse; margin: 6px 0 10px; font-size: 12.5px; background: var(--panel-header-bg); border-radius: 6px; overflow: hidden; }
.req-md-content th { background: var(--sidebar-active); color: var(--text-secondary); font-weight: 600; text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--text-muted); font-size: 12px; }
.req-md-content td { padding: 7px 10px; border-bottom: 1px solid var(--sidebar-active); color: var(--text-primary); vertical-align: top; }
.req-md-content tr:last-child td { border-bottom: none; }
.req-md-content strong { color: var(--text-primary); font-weight: 600; }
.req-md-content ol, .req-md-content ul { padding-left: 20px; margin: 6px 0; }
.req-md-content li { margin: 4px 0; color: var(--text-primary); }
.req-md-content ul li::marker { color: var(--accent); }
.req-md-content ol li::marker { color: var(--text-secondary); }
.req-md-content br + br { display: none; }
.req-placeholder { color: var(--text-secondary); font-style: italic; }

.req-summary-text.empty { color: #5a6a75; font-style: italic; }
.req-alert { background: #f59e0b15; border-left: 3px solid #f59e0b; padding: 8px 12px; margin: 0 16px; border-radius: 4px; font-size: 12px; }
.req-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px; }
.req-field { margin-bottom: 8px; }
.req-field .req-label { margin-bottom: 4px; min-width: auto; padding-top: 0; display: block; }
.req-tag { display: inline-block; padding: 1px 6px; border-radius: 4px; font-size: 10px; margin-left: 6px; vertical-align: middle; }
.req-tag.ai { background: #7c3aed30; color: #a78bfa; }
.req-tag.manual { background: #00a88430; color: var(--accent); }

/* ── 📄 客户单证面板 ── */
.doc-panel-body { padding: 0; height: 100%; overflow-y: auto; }
.doc-card-list { padding: 8px 12px; }
.doc-card { background: var(--panel-header-bg); border-radius: 8px; padding: 10px 12px; margin-bottom: 8px; border: 1px solid var(--sidebar-active); }
.doc-card-top { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
.doc-type-tag { padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
.doc-type-tag.dt-pi { background: #00a88430; color: var(--accent); }
.doc-type-tag.dt-quotation { background: #7c3aed30; color: #a78bfa; }
.doc-number { color: var(--text-secondary); font-size: 12px; font-family: monospace; flex: 1; }
.doc-status { font-size: 11px; padding: 1px 6px; border-radius: 4px; }
.doc-status.ds-draft { background: var(--text-muted); color: var(--text-secondary); }
.doc-status.ds-confirmed { background: #f59e0b25; color: #f59e0b; }
.doc-status.ds-sent { background: #00a88430; color: var(--accent); }
.doc-status.ds-paid { background: #22c55e30; color: #22c55e; }
.doc-card-body { display: flex; justify-content: space-between; align-items: baseline; padding: 4px 0; }
.doc-amount { color: var(--text-primary); font-weight: 600; font-size: 15px; }
.doc-date { color: var(--text-secondary); font-size: 11px; }
.doc-card-actions { display: flex; gap: 6px; margin-top: 6px; }
.doc-action-btn { background: transparent; border: 1px solid var(--text-muted); color: var(--text-secondary); padding: 4px 10px; border-radius: 4px; font-size: 12px; cursor: pointer; transition: all 0.15s; }
.doc-action-btn:hover { background: var(--sidebar-active); color: var(--text-primary); border-color: var(--accent); }

/* AI 单证类型选择弹窗 */
.doc-type-dialog { position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 5000; display: flex; align-items: center; justify-content: center; padding: 20px; }
.doc-type-card { background: var(--panel-header-bg); border-radius: 12px; padding: 20px; width: 320px; max-width: 100%; border: 1px solid var(--text-muted); }
.doc-type-option { display: flex; flex-direction: column; gap: 4px; width: 100%; padding: 12px; background: var(--sidebar-active); border: 1px solid var(--text-muted); border-radius: 8px; color: var(--text-primary); cursor: pointer; margin-bottom: 8px; align-items: flex-start; text-align: left; transition: all 0.15s; }
.doc-type-option:hover { background: #00a88430; border-color: var(--accent); }
.doc-type-cancel { width: 100%; padding: 8px; background: transparent; color: var(--text-secondary); border: none; cursor: pointer; font-size: 13px; margin-top: 4px; }
.doc-type-cancel:hover { color: var(--text-primary); }

/* 移动端：req/doc 面板全屏 */
@media (max-width: 900px) {
  .req-grid2 { grid-template-columns: 1fr; }
  .req-row { flex-direction: column; gap: 4px; }
  .req-label { min-width: auto; }
}


.acc-avatar-img, .conv-avatar-img {
  width: 100%; height: 100%;
  border-radius: 50%;
  object-fit: cover;
  display: block;
}
.acc-avatar-initial, .conv-avatar-initial {
  display: inline-flex; align-items: center; justify-content: center;
  width: 100%; height: 100%;
  border-radius: 50%;
}

/* ========== 移动端栏目抽屉 ========== */
.mobile-drawer {
  position: fixed; inset: 0; z-index: 1002;
  background: rgba(0,0,0,0.5);
  display: flex;
}
.mobile-drawer-panel {
  width: 78%; max-width: 320px; height: 100%;
  background: var(--panel-bg);
  display: flex; flex-direction: column;
  animation: drawerSlide 0.22s ease-out;
  border-right: 1px solid var(--sidebar-active);
}
@keyframes drawerSlide {
  from { transform: translateX(-100%); }
  to { transform: translateX(0); }
}
.mdp-header {
  padding: 20px 18px 16px;
  display: flex; align-items: center; justify-content: space-between;
  border-bottom: 1px solid var(--border-color);
  background: var(--chat-bg);
}
.mdp-logo {
  color: var(--text-primary); font-size: 18px; font-weight: 600;
  display: flex; align-items: center; gap: 8px;
}
.mdp-logo-img { width: 24px; height: 24px; object-fit: contain; border-radius: 5px; background: #fff; padding: 1px; flex-shrink: 0; }
.mdp-close {
  background: none; border: none; color: var(--text-secondary);
  font-size: 20px; width: 36px; height: 36px;
  border-radius: 50%; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
}
.mdp-close:active { background: var(--sidebar-active); color: var(--text-primary); }
.mdp-wa-status {
  padding: 10px 18px;
  display: flex; align-items: center; gap: 8px;
  font-size: 12px; color: var(--text-secondary);
  border-bottom: 1px solid var(--border-color);
}
.mdp-wa-status.connected { color: var(--accent); }
.mdp-status-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: var(--text-secondary);
}
.mdp-wa-status.connected .mdp-status-dot { background: var(--accent); box-shadow: 0 0 6px #00a88460; }
.mdp-nav {
  flex: 1; overflow-y: auto; padding: 8px 0;
  -webkit-overflow-scrolling: touch;
}
.mdp-item {
  width: 100%; display: flex; align-items: center; gap: 14px;
  padding: 14px 18px; background: none; border: none;
  color: var(--text-primary); font-size: 15px; text-align: left;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.mdp-item:active { background: var(--panel-header-bg); }
.mdp-arrow { margin-left: auto; transition: transform .2s; opacity: .55; flex-shrink: 0; }
.mdp-arrow.open { transform: rotate(180deg); }
.mdp-children { padding-left: 16px; background: rgba(0,0,0,0.18); }
.mdp-item.mdp-child { font-size: 14px; padding: 12px 18px; }
.mdp-item.active { color: var(--accent); background: #00a88415; }
.mdp-icon {
  width: 28px; font-size: 20px; display: flex;
  align-items: center; justify-content: center;
  color: var(--text-secondary);
}
.mdp-item.active .mdp-icon { color: var(--accent); }
.mdp-label { flex: 1; }
.mdp-badge {
  min-width: 20px; height: 20px; padding: 0 6px;
  background: var(--accent); color: #fff;
  border-radius: 10px; font-size: 11px;
  display: flex; align-items: center; justify-content: center;
}
.mdp-footer {
  border-top: 1px solid var(--border-color); padding: 6px 0;
}
.mdp-logout-btn { color: var(--danger); }
.mdp-logout-btn .mdp-icon { color: var(--danger); }

/* ── 📄 单证快捷生成面板 v2 ── */
.doc-panel-v2 { display: flex; flex-direction: column; height: 100%; background:var(--panel-bg); position: relative; }
.doc-new-formal-btn {
  width: 30px; height: 30px; border-radius: 6px; border: none;
  background: var(--sidebar-active); color: var(--text-secondary); cursor: pointer; font-size: 20px; line-height:1;
  display: flex; align-items: center; justify-content: center;
  margin-left: auto; transition: all .15s ease; font-family: inherit;
}
.doc-new-formal-btn:hover { background: var(--text-muted); color: var(--text-primary); }

.doc-type-chips-wrap { padding: 8px 12px 4px; }
.doc-type-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.doc-type-chip {
  flex: 1 1 calc(33.333% - 6px); min-width: 0;
  background: var(--panel-header-bg); color: var(--text-primary); border: 1.5px solid var(--sidebar-active); border-radius: 10px;
  padding: 10px 4px; font-size: 12px; cursor: pointer; transition: all .18s ease;
  font-family: inherit; display: flex; flex-direction: column; align-items: center;
  gap: 3px; -webkit-tap-highlight-color: transparent;
}
.doc-type-chip:active { transform: scale(.97); }
.doc-type-chip-icon { font-size: 20px; line-height: 1; }
.doc-type-chip-label { font-size: 12px; font-weight: 500; }
.doc-type-chip.active {
  background: rgba(124,58,237,.15);
  border-color: #7c3aed;
  color: #c4b5fd;
  box-shadow: 0 0 0 1px rgba(124,58,237,.3);
}
.doc-type-chip.active .doc-type-chip-icon { filter: drop-shadow(0 0 4px #7c3aed80); }

.doc-mode-bar { display: flex; gap: 6px; padding: 6px 12px 8px; border-bottom: 1px solid #1f2c33; }
.doc-mode-btn {
  flex: 1; background: var(--panel-header-bg); color: var(--text-secondary); border: 1px solid var(--sidebar-active);
  border-radius: 8px; padding: 7px 10px; font-size: 12.5px; cursor: pointer;
  font-family: inherit; display: flex; align-items: center; justify-content: center;
  gap: 5px; transition: all .15s ease;
}
.doc-mode-btn.active { background: rgba(124,58,237,.15); color: #c4b5fd; border-color: #7c3aed; }

.doc-result-scroll {
  flex: 1; overflow-y: auto; padding: 12px; position: relative;
  -webkit-overflow-scrolling: touch;
}
.doc-result-scroll::-webkit-scrollbar { width: 6px; }
.doc-result-scroll::-webkit-scrollbar-thumb { background: var(--sidebar-active); border-radius: 3px; }

.doc-empty { text-align: center; padding: 40px 12px 24px; }
.doc-empty-icon { font-size: 48px; margin-bottom: 10px; opacity: .7; }
.doc-empty-title { color: var(--text-primary); font-size: 14px; margin-bottom: 6px; font-weight: 500; }
.doc-empty-sub { color: var(--text-secondary); font-size: 12px; line-height: 1.6; padding: 0 12px; }

.doc-error-block {
  background: rgba(239,68,68,.12); border: 1px solid rgba(239,68,68,.25); border-radius: 8px;
  padding: 10px 12px; margin-bottom: 10px;
}
.doc-error-text { color: #fca5a5; font-size: 13px; }

/* Doc card container */
.doc-result-outer { margin-bottom: 10px; }
.doc-version-tag {
  display: inline-block; margin-bottom: 4px; padding: 2px 8px; border-radius: 10px;
  background: rgba(124,58,237,.2); color: #c4b5fd; font-size: 11px; font-weight:600;
}
.doc-result-card {
  background: var(--panel-header-bg); border: 1px solid var(--sidebar-active); border-radius: 12px;
  overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,.2);
}
.doc-result-head {
  display: flex; justify-content: space-between; align-items: center;
  padding: 10px 12px; border-bottom: 1px solid var(--sidebar-active);
  background: linear-gradient(135deg, var(--panel-header-bg), #1a262d);
}
.doc-result-type-tag {
  background: var(--text-muted); color: var(--text-secondary); font-size: 11px; font-weight: 600;
  padding: 3px 9px; border-radius: 10px; display: inline-flex; align-items: center; gap: 4px;
}
.doc-result-time { color: var(--text-secondary); font-size: 11px; }

.doc-result-body-wrap { position: relative; padding: 4px 0; max-height: 2000px; transition: max-height .3s ease; overflow:hidden; }
.doc-result-body-wrap.doc-collapsed { max-height: 300px; }
.doc-fade-mask {
  position: absolute; bottom: 0; left: 0; right: 0; height: 80px;
  background: linear-gradient(to bottom, rgba(32,44,51,0), var(--panel-header-bg) 80%);
  pointer-events: none;
}
.doc-expand-btn {
  width: 100%; background: transparent; border: none; border-top: 1px solid var(--sidebar-active);
  color: #c4b5fd; font-size: 12px; padding: 8px; cursor: pointer; font-family: inherit;
  transition: background .15s;
}
.doc-expand-btn:hover { background: #26353d; }

.doc-result-body { padding: 10px 12px; color: var(--text-primary); font-size: 13px; line-height: 1.6; word-break: break-word; }
.doc-doc-title { color: #fff; font-size: 16px; font-weight: 700; text-align: center; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px dashed var(--sidebar-active); }

/* Section cards inside doc */
.doc-section-card {
  background: #1a262d; border: 1px solid #233138; border-radius: 8px;
  padding: 10px 12px; margin-bottom: 8px;
}
.doc-section-card:last-child { margin-bottom: 0; }
.doc-section-head { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
.doc-section-icon { font-size: 14px; line-height: 1; }
.doc-section-title { color: #c4b5fd; font-size: 13px; font-weight: 700; letter-spacing: .2px; }
.doc-section-body { color: var(--text-primary); font-size: 12.5px; line-height: 1.65; }
.doc-section-body table { width:100%; border-collapse:collapse; background:var(--panel-bg); border-radius:6px; overflow:hidden; margin:6px 0; font-size:12px; }
.doc-section-body th { background:#0f1920; color:var(--accent); font-weight:600; padding:6px 7px; text-align:left; border-bottom:1px solid var(--sidebar-active); white-space:nowrap; font-size:11.5px; }
.doc-section-body td { padding:6px 7px; border-bottom:1px solid #1f2c33; color:var(--text-primary); vertical-align:top; font-size:11.5px; }
.doc-section-body p { margin: 3px 0; }
.doc-section-body b,.doc-section-body strong { color:var(--text-primary); font-weight:700 }
.doc-section-body ul,.doc-section-body ol { padding-left:18px; margin:4px 0; }
.doc-section-body li { margin-bottom:2px; color:var(--text-primary); font-size:12px; }

/* Tables (fallback for markdown-body outside sections) */
.markdown-body table { width:100%; border-collapse:collapse; background:var(--panel-bg); border-radius:6px; overflow:hidden; margin:8px 0; }
.markdown-body th { background:#1a262d; color:var(--accent); font-weight:600; padding:7px 9px; text-align:left; border-bottom:1px solid var(--sidebar-active); font-size:12px; white-space:nowrap; }
.markdown-body td { padding:7px 9px; border-bottom:1px solid #1f2c33; color:var(--text-primary); font-size:12px; vertical-align:top; }
.markdown-body h1 { color:#fff;font-size:17px;font-weight:700;margin:8px 0 12px;text-align:center }
.markdown-body h2 { color:var(--text-primary);font-size:15px;font-weight:700;margin:14px 0 8px }
.markdown-body h3 { color:var(--text-primary);font-size:13.5px;font-weight:700;margin:12px 0 6px;padding-bottom:4px;border-bottom:1px solid var(--sidebar-active) }
.markdown-body ul,.markdown-body ol { padding-left:20px;margin:6px 0 }
.markdown-body li { margin-bottom:3px;color:var(--text-primary);font-size:13px }
.markdown-body b,.markdown-body strong { color:var(--text-primary);font-weight:700 }
.markdown-body pre { background:var(--panel-bg);border-radius:6px;padding:10px;overflow-x:auto;font-size:12px;color:var(--text-primary);margin:6px 0;white-space:pre-wrap }
.markdown-body code { background:var(--panel-bg);padding:1px 5px;border-radius:3px;font-size:12px;color:var(--text-primary);font-family:ui-monospace,Menlo,Consolas,monospace }
.markdown-body hr { border:none;border-top:1px solid var(--sidebar-active);margin:10px 0 }

.doc-result-head-actions {
  display: flex; align-items: center; gap: 4px; margin-left: auto;
}
.doc-head-icon-btn {
  width: 28px; height: 28px; border-radius: 6px; border: none;
  background: transparent; color: var(--text-secondary); cursor: pointer; font-size: 13px;
  display: inline-flex; align-items: center; justify-content: center; transition: all .15s;
  font-family: inherit;
}
.doc-head-icon-btn:hover { background: var(--sidebar-active); color: var(--text-primary); }
.doc-saved-badge {
  background: rgba(34,197,94,.15); color: #4ade80; font-size: 10.5px;
  padding: 2px 7px; border-radius: 8px; font-weight: 600; margin-right: 4px;
}
.doc-result-bottom-actions {
  display: flex; gap: 6px; padding: 10px; border-top: 1px solid var(--sidebar-active);
  background: #1a262d;
}
.doc-act-sec {
  flex: 1; background: var(--sidebar-active); color: var(--text-primary); border: none; border-radius: 8px;
  padding: 10px 6px; font-size: 13px; cursor: pointer; font-family: inherit;
  transition: all .15s ease; display: inline-flex; align-items: center; justify-content: center; gap: 4px;
  font-weight: 500;
}
.doc-act-sec:hover { background: var(--text-muted); color: #fff; }
.doc-act-sec.saved { background: rgba(34,197,94,.12); color: #4ade80; cursor: default; }
.doc-act-sec:disabled { opacity: .7; cursor: wait; }
.doc-act-primary {
  flex: 1.4; background: linear-gradient(135deg,#7c3aed,#6d28d9); color: #fff; border: none;
  border-radius: 8px; padding: 10px 6px; font-size: 13px; cursor: pointer; font-family: inherit;
  transition: all .15s ease; font-weight: 600;
  display: inline-flex; align-items: center; justify-content: center; gap: 4px;
  box-shadow: 0 2px 8px rgba(124,58,237,.35);
}
.doc-act-primary:hover { background: linear-gradient(135deg,#8b5cf6,#7c3aed); box-shadow: 0 4px 12px rgba(124,58,237,.5); }
.doc-act-primary:active { transform: scale(.98); }

.doc-typing-card { text-align: center; padding: 24px 12px; }
.doc-typing-text { color: var(--text-secondary); font-size: 12px; margin-top: 10px; }

.doc-msg { margin-bottom: 10px; display: flex; flex-direction: column; }
.doc-msg-user { align-items: flex-end; }
.doc-user-bubble {
  max-width: 80%; padding: 9px 12px; border-radius: 8px; font-size: 13.5px;
  line-height: 1.5; word-break: break-word; white-space: pre-wrap;
  background: #7c3aed; color: #fff; border-radius: 8px 0 8px 8px;
}
.doc-ai-bubble {
  background: var(--panel-header-bg); color: var(--text-primary); border-radius: 10px; padding: 14px 18px;
  display: inline-flex; align-items: center; gap: 4px;
}
.doc-loading-bubble { display: inline-flex; align-items: center; gap: 4px; }
.doc-msg-time { font-size: 10px; color: var(--text-secondary); margin-top: 3px; padding: 0 4px; }

/* ── v3 新增样式：紧凑条/语言/编辑/PDF ── */
.doc-compact-bar {
  display: flex; align-items: center; gap: 8px; padding: 8px 12px;
  border-bottom: 1px solid var(--border-color); background: var(--panel-bg); flex-shrink: 0;
}
.doc-current-chip {
  display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px;
  border-radius: 20px; background: var(--sidebar-active); color: var(--text-primary); font-size: 13px; font-weight: 600;
  border: 1.5px solid #7c3aed; white-space: nowrap;
}
.doc-chip-ic { font-size: 15px; }
.doc-compact-act {
  background: var(--panel-header-bg); border: 1px solid var(--text-muted); color: var(--text-primary); font-size: 12px;
  padding: 6px 10px; border-radius: 16px; cursor: pointer; white-space: nowrap;
  transition: all .15s ease;
}
.doc-compact-act:hover { background: var(--sidebar-active); color: var(--accent); border-color: var(--accent); }
.doc-compact-act.open { border-color: #7c3aed; color: #c4b5fd; }
.doc-compact-act-danger { color: #f87171; border-color: var(--text-muted); padding: 6px 10px; }
.doc-compact-act-danger:hover { background: #2a2025; color: #f87171; border-color: #f87171; }
.doc-compact-spacer { flex: 1; }
.doc-lang-picker {
  position: absolute; z-index: 30; top: 96px; left: 12px; right: 12px;
  background: var(--panel-header-bg); border: 1px solid var(--text-muted); border-radius: 10px;
  max-height: 260px; overflow-y: auto; box-shadow: 0 8px 24px rgba(0,0,0,.4);
  padding: 4px 0;
}
.doc-lang-option {
  display: flex; align-items: center; gap: 10px; padding: 10px 16px;
  color: var(--text-primary); font-size: 13.5px; cursor: pointer; transition: background .1s ease;
}
.doc-lang-option:hover { background: var(--sidebar-active); }
.doc-lang-option.active { background: var(--sidebar-active); color: var(--accent); }
.doc-lang-emoji { font-size: 18px; width: 24px; text-align: center; }
.doc-lang-check { margin-left: auto; color: #7c3aed; font-weight: 700; }
.doc-pop-enter-active, .doc-pop-leave-active { transition: opacity .15s ease, transform .15s ease; }
.doc-pop-enter-from, .doc-pop-leave-to { opacity: 0; transform: translateY(-4px); }

/* 已生成态让结果区填满剩余空间 */
.doc-generated-view { flex: 1; overflow-y: auto; min-height: 200px; }
.doc-main-preview .doc-result-card { border-color: #7c3aed40; }
/* override removed - main-preview already sets none below */
.doc-main-preview .doc-result-body-wrap { max-height: none; overflow: visible; }
.doc-main-bottom { padding-top: 10px; border-top: 1px solid var(--border-color); }
.doc-lang-tag { color: var(--text-secondary); font-weight: 400; font-size: 11px; }

/* 直接编辑态 */
.doc-edit-wrap {
  display: flex; flex-direction: column; padding: 10px 12px 12px; gap: 8px;
  flex: 1; min-height: 300px;
}
.doc-edit-header {
  color: #c4b5fd; font-size: 12.5px; padding: 6px 4px;
  display: flex; align-items: center; gap: 6px;
}
.doc-edit-textarea {
  flex: 1; width: 100%; min-height: 320px; background: #1a2329;
  border: 1.5px solid #7c3aed; border-radius: 10px; padding: 12px 14px;
  color: var(--text-primary); font-size: 13.5px; line-height: 1.6; resize: none; outline: none;
  font-family: 'SF Mono', Menlo, Consolas, 'PingFang SC', 'Microsoft YaHei', monospace;
  box-shadow: 0 0 0 3px rgba(124,58,237,.12);
}
.doc-edit-textarea::placeholder { color: var(--text-secondary); }
.doc-edit-footer {
  display: flex; gap: 8px; padding-top: 6px;
}
.doc-edit-cancel {
  flex: 0 0 auto; padding: 10px 18px; background: var(--sidebar-active); color: var(--text-secondary);
  border: 1px solid var(--text-muted); border-radius: 8px; cursor: pointer; font-size: 13px;
}
.doc-edit-cancel:hover { color: var(--text-primary); }
.doc-edit-apply {
  flex: 1; padding: 10px 18px; background: #7c3aed; color: #fff; border: none;
  border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 600;
  transition: background .15s ease;
}
.doc-edit-apply:hover:not(:disabled) { background: #6d28d9; }
.doc-edit-apply:disabled { opacity: .6; cursor: not-allowed; }

/* PDF按钮在主栏突出 */
.doc-head-icon-btn-primary {
  background: #7c3aed20 !important; color: #c4b5fd !important;
}
.doc-head-icon-btn-primary:hover { background: #7c3aed40 !important; color: #fff !important; }

.doc-footer-compact {
  padding: 8px 12px; background: var(--panel-bg);
}

.doc-footer {
  padding: 10px 12px 12px; border-top: 1px solid var(--border-color); background: var(--panel-bg);
  display: flex; flex-direction: column; gap: 8px; flex-shrink: 0;
}
.doc-input-row { display: flex; gap: 8px; align-items: flex-end; }
.doc-textarea {
  flex: 1; background: var(--sidebar-active); border: 1px solid var(--text-muted); border-radius: 8px;
  padding: 10px 12px; color: var(--text-primary); font-size: 13.5px; resize: none;
  outline: none; font-family: inherit; line-height: 1.4; min-height: 42px; max-height: 100px;
  transition: border-color .2s ease;
}
.doc-textarea:focus { border-color: #7c3aed; }
.doc-textarea::placeholder { color: var(--text-secondary); }
.doc-send-btn {
  width: 38px; height: 38px; border-radius: 50%; background: #7c3aed; border: none;
  color: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; transition: all .2s ease;
}
.doc-send-btn:hover:not(:disabled) { background: #6d28d9; }
.doc-send-btn:disabled { background: var(--text-muted); cursor: not-allowed; }

.doc-gen-btn {
  width: 100%; height: 46px; background: #7c3aed; color: #fff; border: none; border-radius: 10px;
  font-size: 14.5px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center;
  justify-content: center; gap: 8px; transition: background .15s ease, transform .1s ease;
  font-family: inherit; box-shadow: 0 4px 12px rgba(124,58,237,.25);
}
.doc-gen-btn:hover:not(:disabled) { background: #6d28d9; box-shadow: 0 6px 16px rgba(124,58,237,.4); }
.doc-gen-btn:active:not(:disabled) { transform: scale(.98); }
.doc-gen-btn:disabled { opacity: .6; cursor: not-allowed; }

.doc-switch-link {
  background: none; border: none; color: var(--text-secondary); font-size: 12px; cursor: pointer;
  padding: 2px 0; font-family: inherit; text-align: center; transition: color .2s ease;
}
.doc-switch-link:hover { color: #c4b5fd; }

.doc-history-details { border-top: 1px solid var(--border-color); background: #0f1920; flex-shrink: 0; }
.doc-history-summary {
  padding: 9px 12px; color: var(--text-secondary); font-size: 12.5px; cursor: pointer;
  display: flex; align-items: center; gap: 8px; list-style: none; user-select: none;
}
.doc-history-summary::-webkit-details-marker { display: none; }
.doc-history-count {
  background: var(--sidebar-active); color: var(--text-secondary); border-radius: 10px; padding: 1px 8px; font-size: 11px;
}
.doc-history-actions { margin-left: auto; }
.doc-history-new {
  background: var(--sidebar-active); color: var(--text-secondary); border: none; border-radius: 4px;
  padding: 3px 9px; font-size: 11px; cursor: pointer; font-family: inherit;
}
.doc-history-new:hover { background: #7c3aed; color: #fff; }
.doc-history-body { padding: 6px 12px 12px; max-height: 260px; overflow-y: auto; }
.doc-history-empty { color: var(--text-secondary); font-size: 12px; text-align: center; padding: 10px 0; }

/* aitalk-dot animation reuse (in case not yet loaded) */
.doc-loading-bubble .aitalk-dot {
  width:6px;height:6px;border-radius:50%;background:var(--text-secondary);
  animation: doc-dot-bounce 1.2s infinite ease-in-out; display:inline-block;
  margin:0 1px;
}
.doc-loading-bubble .aitalk-dot:nth-child(2) { animation-delay:.2s; }
.doc-loading-bubble .aitalk-dot:nth-child(3) { animation-delay:.4s; }
@keyframes doc-dot-bounce {
  0%,80%,100% { opacity:.3; transform:translateY(0); }
  40% { opacity:1; transform:translateY(-4px); }
}

/* 手机端：芯片2列、按钮更大 */
@media (max-width: 480px) {
  .doc-type-chip { flex: 1 1 calc(50% - 6px); padding: 14px 4px; }
  .doc-type-chip-icon { font-size: 22px; }
  .doc-act-sec, .doc-act-primary { font-size: 12px; padding: 11px 4px; }
  .doc-gen-btn { height: 48px; font-size: 15px; }
}
@media (max-width: 360px) {
  .doc-type-chip-label { font-size: 11px; }
}

/* 手机端全局：顶部栏所有平台显示 + 底部tabbar留空间 */
@media (max-width: 900px) {
  .mobile-header {
    display: flex !important;
    position: relative;
    height: 60px;
    z-index: 100;
    overflow: visible !important;
    background: var(--sidebar-bg, #111b21);
    border-bottom: 1px solid var(--border-color, #222d34);
    padding: 0 12px;
    box-sizing: border-box;
    flex-shrink: 0;
  }
  .workspace.has-mheader { padding-top: 0; }
  .workspace.has-tabbar { padding-bottom: 0; }
}


/* ========== 需求分析卡片化样式 ========== */
.req-empty-hint { text-align:center; padding:28px 12px; color:var(--text-secondary); font-size:13px; }
.req-cards { display:flex; flex-direction:column; gap:10px; padding:2px 0 4px; }
.req-card { background:var(--panel-header-bg); border-radius:10px; overflow:hidden; border:1px solid var(--sidebar-active); }
.req-card-head { display:flex; align-items:center; gap:8px; padding:10px 12px 8px; border-bottom:1px solid var(--sidebar-active); }
.req-card-icon { font-size:15px; }
.req-card-title { color:var(--text-primary); font-size:13px; font-weight:600; }
.req-card-body { padding:6px 12px 10px; }
.req-kv-table { width:100%; border-collapse:collapse; font-size:12.5px; }
.req-kv-table tr { border-bottom:1px solid #2a394230; }
.req-kv-table tr:last-child { border-bottom:none; }
.req-kv-table td { padding:6px 4px; vertical-align:top; line-height:1.5; }
.kv-label { color:var(--text-secondary); width:88px; min-width:88px; white-space:nowrap; font-size:12px; padding-right:10px !important; }
.kv-value { color:var(--text-primary); word-break:break-word; }
.req-list { list-style:none; margin:0; padding:0; }
.req-list li { display:flex; gap:8px; padding:5px 0; font-size:12.5px; line-height:1.55; align-items:flex-start; }
.req-list-badge { display:inline-flex;align-items:center;justify-content:center;min-width:18px;height:18px;border-radius:50%;background:#00a88430;color:var(--accent);font-size:10px;font-weight:700;flex-shrink:0;margin-top:1px; }
.req-list-text { color:var(--text-primary); flex:1; word-break:break-word; }
.req-list-title { color:var(--accent); font-weight:600; }
.req-text { color:var(--text-primary); font-size:13px; line-height:1.65; white-space:pre-wrap; word-break:break-word; }
.req-footer-center { justify-content:center; padding-top:14px; }
.req-big-btn { width:100% !important; padding:10px 20px !important; font-size:14px !important; border-radius:22px !important; background:linear-gradient(135deg,#7c3aed,#5b21b6) !important; box-shadow:0 2px 8px #7c3aed40; border:none; color:#fff; }
.req-big-btn:hover:not(:disabled) { box-shadow:0 4px 14px #7c3aed70; }
.req-big-btn:disabled { opacity:.7; cursor:wait; }


/* 手机端ch-switch和email模式 */
@media (max-width: 900px) {
  .ch-switch {
    flex-direction: row;
    gap: 12px;
    padding: 10px 16px;
    flex-wrap: wrap;
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    width: 100%;
    height: auto;
    min-height: 56px;
    z-index: 200;
    background: var(--panel-bg);
    border-right: none;
    border-bottom: 1px solid var(--border-color);
    justify-content: flex-start;
    overflow: visible;
  }
  .ch-sw-btn { width: 44px; height: 44px; }
  .ch-sw-btn svg { width: 24px; height: 24px; }
  .col-chatlist { padding-top: 60px; box-sizing: border-box; }
  .col-conversation { padding-top: 60px; box-sizing: border-box; }
  /* removed old m-hidden rule */
  /* ch-switch is now sibling of col-chatlist, not child */
  .comm-module.email-active .ch-switch {
    flex-direction: row;
    gap: 20px;
    padding: 10px 16px;
    border-bottom: 1px solid var(--border-color);
    flex-wrap: wrap;
  }
}

/* 移动端非聊天页面：workspace改column方向，module-full作为flex子项占满剩余空间可滚动 */
@media (max-width: 900px) {
  .workspace.full-page {
    flex-direction: column !important;
    padding-top: 0 !important;
  }
  .workspace.full-page .comm-module { display: none !important; }
  .workspace.full-page .module-full {
    position: relative;
    flex: 1 1 0%;
    min-height: 0;
    height: 0;
    width: 100%;
    background: var(--panel-bg);
    overflow-y: auto !important;
    -webkit-overflow-scrolling: touch;
    box-sizing: border-box;
    padding-top: 12px;
    padding-bottom: calc(20px + env(safe-area-inset-bottom, 0px));
  }
}

/* ===== 邮箱渠道嵌入模式 ===== */
.comm-module.email-active .col-chatlist { display: none !important; }
/* .ch-switch PC email-active: already handled by base vertical sidebar */
.comm-module.email-active .col-conversation { margin-left: 0; padding-top: 0; flex: 1; min-width: 0; }
@media (max-width: 900px) {
  .comm-module.email-active .col-chatlist { display: none !important; }
  .comm-module.email-active .col-accounts { display: none !important; }
  .comm-module.email-active .col-conversation { transform: translateX(0) !important; padding-top: 0; margin-left: 0; position: absolute; top: 60px; left: 0; right: 0; bottom: 0; }
}
.comm-module.email-active .col-iconbar { display: none !important; }
.col-conversation.email-conv { background: var(--panel-bg); }
@media (min-width: 901px) {
  .comm-module.email-active .col-accounts { display: none !important; }
}


/* ── 🏢 公司资料面板样式 ── */
.cm-panel-body {
  display: flex; flex-direction: column; height: 100%; overflow-y: auto;
  padding: 12px; box-sizing: border-box;
  background: var(--panel-bg, #111b21); color: var(--text-primary, #e9edef);
  -webkit-overflow-scrolling: touch;
}
.cm-chips { display:flex; flex-wrap:wrap; gap:6px; padding-bottom:4px; margin-bottom:8px; flex-shrink:0; }
.cm-chip {
  flex-shrink:0; padding:5px 10px; border-radius:14px;
  border:1px solid var(--border-color, #2a3942); background:var(--panel-header-bg, #202c33);
  color:var(--text-secondary, #8696a0); font-size:12px; cursor:pointer; white-space:nowrap;
  transition:all .15s; font-family:inherit; line-height:1.4;
}
.cm-chip:hover { background:var(--sidebar-active, #2a3942); color:var(--text-primary, #e9edef); }
.cm-chip.active { background:var(--accent, #00a884); color:#fff; border-color:var(--accent, #00a884); }
.cm-chip-manage { padding:5px 8px; font-size:13px; opacity:.85; }
.cm-chip-manage:hover { opacity:1; }
.cm-cat-list { max-height:320px; overflow-y:auto; display:flex; flex-direction:column; gap:8px; margin-bottom:12px; }
.cm-cat-row { display:flex; align-items:center; gap:8px; }
.cm-cat-icon { font-size:16px; width:24px; text-align:center; flex-shrink:0; }
.cm-cat-name-input { flex:1; }
.cm-cat-empty { text-align:center; color:var(--text-muted, #667781); padding:16px; font-size:13px; }
.cm-cat-add { display:flex; gap:8px; align-items:center; border-top:1px solid var(--border-color, #2a3942); padding-top:12px; }
.cm-uploading { padding:8px 12px; color:var(--accent, #00a884); font-size:13px; text-align:center; }
.cm-empty { text-align:center; padding:40px 20px; color:var(--text-muted, #667781); }
.cm-empty-icon { font-size:48px; margin-bottom:12px; opacity:0.5; }
.cm-empty-add { margin-top:12px; padding:8px 18px; border-radius:20px; border:1px solid var(--accent, #00a884); background:transparent; color:var(--accent, #00a884); cursor:pointer; font-family:inherit; font-size:13px; }
.cm-empty-add:hover { background:var(--accent, #00a884); color:#fff; }
.cm-list { display:flex; flex-direction:column; gap:8px; padding-bottom:12px; }
.cm-card { background:var(--panel-header-bg, #202c33); border-radius:12px; padding:12px; border:1px solid var(--border-color, #2a3942); }
.cm-card-top { display:flex; align-items:flex-start; justify-content:space-between; gap:8px; margin-bottom:8px; }
.cm-title-wrap { display:flex; align-items:center; gap:6px; flex:1; min-width:0; flex-wrap:wrap; }
.cm-type-icon { font-size:16px; }
.cm-title { font-weight:600; font-size:14px; color:var(--text-primary, #e9edef); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.cm-lang-badge { font-size:10px; padding:2px 6px; border-radius:4px; font-weight:600; flex-shrink:0; }
.cm-lang-en { background:#0d4a3e; color:#25d366; }
.cm-lang-zh { background:#1a365d; color:#60a5fa; }
.cm-lang-es { background:#5c4a0d; color:#fbbf24; }
.cm-lang-fr,.cm-lang-ar,.cm-lang-pt,.cm-lang-de,.cm-lang-ru,.cm-lang-ja,.cm-lang-ko,.cm-lang-it,.cm-lang-tr { background:#5c4a0d; color:#fbbf24; }
.cm-card-actions-top { display:flex; gap:4px; flex-shrink:0; }
.cm-icon-btn { background:transparent; border:none; cursor:pointer; color:var(--text-secondary, #8696a0); padding:4px 6px; border-radius:6px; font-size:14px; transition:background .15s; }
.cm-icon-btn:hover { background:var(--sidebar-active, #2a3942); color:var(--text-primary, #e9edef); }
.cm-icon-btn.disabled { opacity:0.3; cursor:not-allowed; pointer-events:none; }
.cm-action-danger { color:#ef4444 !important; }
.cm-action-danger:hover { background:rgba(239,68,68,0.12) !important; }
.cm-file-preview { display:flex; gap:12px; margin-bottom:8px; align-items:flex-start; }
.cm-file-thumb { width:120px; height:80px; flex-shrink:0; border-radius:8px; overflow:hidden; background:#000; cursor:pointer; }
.cm-file-thumb img { width:100%; height:100%; object-fit:cover; }
.cm-file-icon { width:120px; height:80px; flex-shrink:0; border-radius:8px; background:var(--sidebar-active, #2a3942); display:flex; align-items:center; justify-content:center; cursor:pointer; }
.cm-file-info { flex:1; min-width:0; }
.cm-file-name { font-size:13px; color:var(--text-primary, #e9edef); font-weight:500; word-break:break-all; margin-bottom:4px; }
.cm-file-meta { font-size:11px; color:var(--text-muted, #667781); margin-bottom:4px; }
.cm-file-desc { font-size:12px; color:var(--text-secondary, #8696a0); white-space:pre-wrap; }
.cm-content-wrap { margin-bottom:8px; }
.cm-content { font-size:13px; color:var(--text-primary, #e9edef); line-height:1.6; white-space:pre-wrap; word-break:break-word; max-height:4.8em; overflow:hidden; position:relative; cursor:pointer; }
.cm-content.expanded { max-height:none; }
.cm-expand-btn { background:transparent; border:none; color:var(--accent, #00a884); font-size:12px; cursor:pointer; padding:4px 0; font-family:inherit; }
.cm-card-bottom { display:flex; gap:6px; flex-wrap:wrap; padding-top:8px; border-top:1px solid var(--border-color, #2a3942); }
.cm-action-btn {
  padding:6px 12px; border-radius:6px; border:1px solid var(--border-color, #2a3942);
  background:transparent; color:var(--text-secondary, #8696a0); cursor:pointer; font-size:12px;
  text-decoration:none; font-family:inherit; transition:all .15s;
}
.cm-action-btn:hover:not(:disabled) { background:var(--sidebar-active, #2a3942); color:var(--text-primary, #e9edef); }
.cm-action-btn.cm-action-primary { background:var(--accent, #00a884); color:#fff; border-color:var(--accent, #00a884); }
.cm-action-btn.cm-action-primary:hover:not(:disabled) { background:#08c29a; }
.cm-action-btn:disabled { opacity:0.4; cursor:not-allowed; }
.cm-add-menu {
  position:absolute; top:100%; right:0; margin-top:4px; z-index:50;
  background:var(--panel-header-bg, #202c33); border:1px solid var(--border-color, #2a3942); border-radius:8px;
  box-shadow:0 4px 16px rgba(0,0,0,0.3); min-width:140px; overflow:hidden;
}
.cm-add-menu-item {
  display:block; width:100%; padding:10px 14px; background:transparent;
  border:none; color:var(--text-primary, #e9edef); text-align:left; cursor:pointer;
  font-size:13px; font-family:inherit;
}
.cm-add-menu-item:hover { background:var(--sidebar-active, #2a3942); }
.cm-dialog .el-dialog { background:var(--panel-header-bg, #202c33); border-radius:12px; }
.cm-dialog .el-dialog__title { color:var(--text-primary, #e9edef); }
.cm-dialog .el-dialog__header { border-bottom:1px solid var(--border-color, #2a3942); }
.cm-dialog .el-form-item__label { color:var(--text-secondary, #8696a0); }
.cm-form { padding:8px 0; }
.cm-form .el-input__wrapper, .cm-form .el-textarea__inner, .cm-form .el-select {
  background:var(--panel-bg, #111b21);
}
.cm-form .el-select__popper, .cm-form .el-popper { --el-bg-color: var(--panel-header-bg, #202c33); }
/* 夜间模式：弹窗(append-to-body)内 el 控件统一暗色，避免纯黑块 */
.cm-dialog .el-input__wrapper,
.cm-dialog .el-textarea__inner,
.cm-dialog .el-select__wrapper,
.cm-cat-dialog .el-input__wrapper,
.cm-cat-dialog .el-textarea__inner,
.cm-cat-dialog .el-select__wrapper {
  background-color: var(--sidebar-active, #2a3942) !important;
  box-shadow: none !important;
  border: 1px solid var(--text-muted, #667781) !important;
  border-radius: 6px !important;
  padding: 0 10px !important;
  min-height: 36px;
}
.cm-dialog .el-input__wrapper:hover,
.cm-dialog .el-textarea__inner:hover,
.cm-dialog .el-select__wrapper:hover,
.cm-cat-dialog .el-input__wrapper:hover,
.cm-cat-dialog .el-textarea__inner:hover,
.cm-cat-dialog .el-select__wrapper:hover {
  border-color: var(--text-secondary, #8696a0) !important;
}
.cm-dialog .el-input__wrapper.is-focus,
.cm-dialog .el-select__wrapper.is-focused,
.cm-cat-dialog .el-input__wrapper.is-focus,
.cm-cat-dialog .el-select__wrapper.is-focused {
  border-color: var(--accent, #00a884) !important;
}
.cm-dialog .el-input__inner,
.cm-dialog .el-textarea__inner,
.cm-dialog .el-select__placeholder,
.cm-dialog .el-select__selected-item,
.cm-dialog .el-select__suffix,
.cm-cat-dialog .el-input__inner,
.cm-cat-dialog .el-textarea__inner,
.cm-cat-dialog .el-select__placeholder,
.cm-cat-dialog .el-select__selected-item,
.cm-cat-dialog .el-select__suffix {
  color: var(--text-primary, #e9edef) !important;
  -webkit-text-fill-color: var(--text-primary, #e9edef) !important;
}
.cm-dialog .el-input__inner::placeholder,
.cm-dialog .el-textarea__inner::placeholder,
.cm-cat-dialog .el-input__inner::placeholder,
.cm-cat-dialog .el-textarea__inner::placeholder {
  color: var(--text-secondary, #8696a0) !important;
  -webkit-text-fill-color: var(--text-secondary, #8696a0) !important;
  opacity: 1;
}
.cm-dialog .el-form-item__label,
.cm-cat-dialog .el-form-item__label {
  color: var(--text-secondary, #8696a0) !important;
}

/* 夜间模式：弹窗主体强制深色背景（append-to-body 后需同时覆盖 EP 变量与类） */
.cm-dialog,
.cm-cat-dialog {
  --el-dialog-bg-color: var(--panel-header-bg, #202c33);
  --el-bg-color: var(--panel-header-bg, #202c33);
  --el-bg-color-overlay: var(--panel-header-bg, #202c33);
}
.cm-dialog .el-dialog,
.cm-cat-dialog .el-dialog {
  background: var(--panel-header-bg, #202c33) !important;
}
.cm-dialog .el-dialog__title,
.cm-cat-dialog .el-dialog__title {
  color: var(--text-primary, #e9edef) !important;
}
.cm-dialog .el-dialog__header,
.cm-cat-dialog .el-dialog__header {
  border-bottom: 1px solid var(--border-color, #2a3942) !important;
  background: transparent !important;
}
.cm-dialog .el-dialog__body,
.cm-cat-dialog .el-dialog__body {
  background: var(--panel-header-bg, #202c33) !important;
}
.cm-dialog .el-dialog__footer,
.cm-cat-dialog .el-dialog__footer {
  background: var(--panel-header-bg, #202c33) !important;
}
.cm-dialog .el-dialog__headerbtn .el-dialog__close,
.cm-cat-dialog .el-dialog__headerbtn .el-dialog__close {
  color: var(--text-secondary, #8696a0) !important;
}

/* 夜间模式：弹窗深色背景 + 输入控件白色底（参考图风格） */
.cm-dialog .el-input__wrapper,
.cm-dialog .el-textarea__inner,
.cm-dialog .el-select__wrapper,
.cm-cat-dialog .el-input__wrapper,
.cm-cat-dialog .el-textarea__inner,
.cm-cat-dialog .el-select__wrapper {
  background-color: #ffffff !important;
  box-shadow: none !important;
  border: 1px solid #d0d3d6 !important;
  border-radius: 6px !important;
  padding: 0 10px !important;
  min-height: 36px;
}
.cm-dialog .el-input__wrapper:hover,
.cm-dialog .el-textarea__inner:hover,
.cm-dialog .el-select__wrapper:hover,
.cm-cat-dialog .el-input__wrapper:hover,
.cm-cat-dialog .el-textarea__inner:hover,
.cm-cat-dialog .el-select__wrapper:hover {
  border-color: #a8abb2 !important;
}
.cm-dialog .el-input__wrapper.is-focus,
.cm-dialog .el-select__wrapper.is-focused,
.cm-cat-dialog .el-input__wrapper.is-focus,
.cm-cat-dialog .el-select__wrapper.is-focused {
  border-color: var(--accent, #00a884) !important;
}
.cm-dialog .el-input__inner,
.cm-dialog .el-textarea__inner,
.cm-dialog .el-select__placeholder,
.cm-dialog .el-select__selected-item,
.cm-cat-dialog .el-input__inner,
.cm-cat-dialog .el-textarea__inner,
.cm-cat-dialog .el-select__placeholder,
.cm-cat-dialog .el-select__selected-item {
  color: #303133 !important;
  -webkit-text-fill-color: #303133 !important;
}
.cm-dialog .el-input__inner::placeholder,
.cm-dialog .el-textarea__inner::placeholder,
.cm-cat-dialog .el-input__inner::placeholder,
.cm-cat-dialog .el-textarea__inner::placeholder {
  color: #a8abb2 !important;
  -webkit-text-fill-color: #a8abb2 !important;
  opacity: 1;
}
.cm-dialog .el-select__suffix,
.cm-cat-dialog .el-select__suffix {
  color: #303133 !important;
}
.cm-dialog .el-textarea__inner {
  padding: 8px 10px !important;
}


/* 面板 header 颜色 */

.cm-file-input { width:100%; padding:8px; color:var(--text-secondary, #8696a0); font-size:13px; box-sizing:border-box; }
.cm-file-input::file-selector-button {
  background:var(--accent, #00a884); color:#fff; border:none; padding:6px 14px;
  border-radius:6px; cursor:pointer; margin-right:10px; font-family:inherit;
}
.cm-file-selected { margin-top:6px; font-size:12px; color:var(--accent, #00a884); }
.cm-file-hint { margin-top:4px; font-size:12px; color:var(--text-secondary, #8696a0); }
.cm-file-input::file-selector-button:hover { background:#08c29a; }
.col-function-panel.companying .panel-col-header { background:var(--panel-header-bg); color:var(--text-primary); border-bottom:1px solid var(--border-color); }

/* 手机端底部 padding */
@media (max-width: 900px) {
  .col-function-panel.m-panel .cm-panel-body {
    padding-bottom: calc(56px + env(safe-area-inset-bottom, 0px) + 12px);
  }
}

/* 新建聊天 + 按钮 */
.col-new-chat {
  width: 32px; height: 32px; border-radius: 8px; border: none;
  background: transparent; color: var(--text-3); cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
  margin-right: 4px; transition: all .15s; flex-shrink: 0;
}
.col-new-chat:hover { background: var(--hover-bg); color: var(--accent); }
.col-new-chat:disabled { opacity: .4; cursor: not-allowed; }

/* 新建聊天弹窗 */
.nc-mask {
  position: fixed; inset: 0; background: rgba(0,0,0,.55);
  z-index: 9999; display: flex; align-items: center; justify-content: center;
}
.nc-dialog {
  width: 420px; max-width: calc(100vw - 32px);
  background: #202329; color: #e9edef; border-radius: 8px;
  box-shadow: 0 10px 40px rgba(0,0,0,.4);
  overflow: hidden; display: flex; flex-direction: column;
  max-height: calc(100vh - 40px);
}
.nc-header {
  display: flex; align-items: center; gap: 12px;
  padding: 14px 16px; border-bottom: 1px solid #2f3338;
}
.nc-back {
  background: none; border: none; color: #aebac1; font-size: 20px;
  cursor: pointer; padding: 4px 8px; border-radius: 4px; line-height: 1;
}
.nc-back:hover { background: #2f3338; color: #fff; }
.nc-title { flex: 1; font-size: 16px; font-weight: 600; color: #fff; text-align: center; }
.nc-spacer { width: 40px; }
.nc-close {
  position: absolute; right: 14px; top: 12px;
  background: none; border: none; color: #8696a0; font-size: 18px;
  cursor: pointer; padding: 4px 8px; border-radius: 4px;
}
.nc-close:hover { background: #2f3338; color: #fff; }
.nc-body { padding: 18px 20px; flex: 1; overflow-y: auto; }
.nc-field { margin-bottom: 0; }
.nc-label { display: block; font-size: 13px; color: #8696a0; margin-bottom: 8px; }
.nc-phone-row { display: flex; gap: 10px; align-items: stretch; position: relative; }
.nc-country {
  display: flex; align-items: center; gap: 6px;
  padding: 0 10px; background: #2a3942; border-radius: 6px;
  cursor: pointer; user-select: none; min-width: 110px;
  border: 1.5px solid transparent; position: relative;
  transition: border-color .15s;
}
.nc-country:hover { border-color: #00a884; }
.nc-flag { font-size: 18px; }
.nc-cc { font-size: 14px; color: #e9edef; font-weight: 500; }
.nc-caret { font-size: 10px; color: #8696a0; margin-left: 2px; }
.nc-country-list {
  position: absolute; top: calc(100% + 4px); left: 0;
  background: #202329; border: 1px solid #2f3338; border-radius: 6px;
  max-height: 240px; overflow-y: auto; width: 220px; z-index: 10;
  box-shadow: 0 6px 20px rgba(0,0,0,.4);
}
.nc-country-item {
  display: flex; justify-content: space-between; align-items: center;
  padding: 9px 12px; font-size: 13px; cursor: pointer; color: #e9edef;
}
.nc-country-item:hover { background: #2a3942; }
.nc-search-wrap {
  padding: 8px; border-bottom: 1px solid #2f3338; position: sticky; top: 0;
  background: #202329; z-index: 1;
  display: flex; align-items: center; gap: 6px;
}
.nc-search-icon { font-size: 13px; color: #8696a0; }
.nc-search-input {
  flex: 1; background: #2a3942; border: none; outline: none;
  color: #e9edef; padding: 6px 8px; border-radius: 4px; font-size: 13px;
  font-family: inherit;
}
.nc-search-input::placeholder { color: #6a7780; }
.nc-country-scroll { max-height: 200px; overflow-y: auto; }
.nc-ci-en { color: #8696a0; font-size: 11px; margin-left: 4px; }
.nc-no-result { padding: 14px; text-align: center; color: #8696a0; font-size: 13px; }
.nc-ci-code { color: #8696a0; font-size: 12px; }
.nc-phone-input { flex: 1; min-width: 0; }
.nc-input, .nc-textarea {
  width: 100%; padding: 10px 12px; background: #2a3942; color: #e9edef;
  border: 1.5px solid transparent; border-radius: 6px; font-size: 14px;
  outline: none; transition: border-color .15s;
  font-family: inherit;
}
.nc-input:focus, .nc-textarea:focus { border-color: #00a884; }
.nc-input::placeholder, .nc-textarea::placeholder { color: #6a7780; }
.nc-textarea { resize: vertical; min-height: 72px; }
.nc-hint { font-size: 12px; color: #6a7780; margin-top: 6px; }
.nc-check { font-size: 13px; margin-top: 10px; padding: 8px 10px; border-radius: 4px; }
.nc-check.nc-ok { color: #00a884; background: rgba(0,168,132,.12); }
.nc-check.nc-bad { color: #f15c6d; background: rgba(241,92,109,.12); }
.nc-error { font-size: 13px; margin-top: 10px; padding: 8px 10px; border-radius: 4px;
  color: #f15c6d; background: rgba(241,92,109,.12); }
.nc-footer {
  display: flex; justify-content: flex-end; gap: 10px;
  padding: 14px 20px; border-top: 1px solid #2f3338;
}
.nc-btn {
  padding: 8px 18px; border: none; border-radius: 6px;
  font-size: 14px; cursor: pointer; font-weight: 500;
  transition: filter .15s, opacity .15s; font-family: inherit;
}
.nc-cancel { background: #3b4048; color: #e9edef; }
.nc-cancel:hover:not(:disabled) { background: #4a525d; }
.nc-primary { background: #00a884; color: #fff; }
.nc-primary:hover:not(:disabled) { filter: brightness(1.12); }
.nc-btn:disabled { opacity: .5; cursor: not-allowed; }
@media (max-width: 640px) {
  .nc-mask { padding: 0; align-items: flex-end; background: rgba(0,0,0,.6); }
  .nc-dialog { width: 100vw; max-width: 100vw; max-height: 92vh; border-radius: 14px 14px 0 0; }
  .nc-phone-row { flex-direction: column; gap: 10px; }
  .nc-country { min-width: 0; width: 100%; box-sizing: border-box; padding: 11px 12px; }
  .nc-country-list { width: 100%; left: 0; right: 0; }
  .nc-body { padding: 16px; }
  .nc-footer { padding: 12px 16px; }
  .nc-input, .nc-textarea { font-size: 16px; } /* prevent iOS zoom */
}


/* ─── 会话置顶/特别关注标识 ─── */
.conv-badge { display:inline-block; font-size:11px; margin-left:4px; vertical-align:middle; line-height:1; }
.conv-acc-badge { color:#fff;font-size:10px;padding:2px 6px;border-radius:4px;margin-right:4px;font-weight:700;line-height:1.4; }
.conv-badge-pin { opacity:0.85; }
.conv-badge-star { opacity:0.95; }
.conv-item { position: relative; }
.conv-chevron {
  position: absolute;
  top: 50%;
  right: 10px;
  transform: translateY(-50%);
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: none;
  background: var(--panel-bg);
  color: var(--text-secondary);
  cursor: pointer;
  display: none;
  align-items: center;
  justify-content: center;
  z-index: 2;
  transition: background .15s, color .15s;
}
.conv-chevron:hover { background: var(--sidebar-active); color: var(--text-primary); }
.conv-chevron:focus { outline: none; }
.conv-item:hover .conv-chevron,
.conv-item.conv-menu-open .conv-chevron { display: flex; }
.conv-item:hover .conv-time { opacity: 0; transition: opacity .15s; }
.conv-item.conv-pinned { background: var(--sidebar-active, #202c33); }
.conv-item.conv-pinned.active { background: var(--sidebar-active, #2a3942); }

/* ─── ActionSheet 菜单（手机端优先） ─── */
.sheet-mask {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.55);
  z-index: 9998;
}
.action-sheet {
  position: fixed;
  left: 0; right: 0; bottom: 0;
  z-index: 9999;
  background: var(--sidebar-bg, #111b21);
  color: var(--text-primary, #e9edef);
  border-top-left-radius: 16px;
  border-top-right-radius: 16px;
  padding: 8px 0 calc(8px + env(safe-area-inset-bottom));
  box-shadow: 0 -4px 20px rgba(0,0,0,0.4);
  max-width: 500px;
  margin: 0 auto;
}
.action-sheet-title {
  text-align: center;
  font-size: 13px;
  color: var(--text-secondary, #8696a0);
  padding: 10px 16px 14px;
  border-bottom: 1px solid var(--border-color, #222d34);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.action-sheet-item {
  display: flex;
  align-items: center;
  gap: 16px;
  width: 100%;
  padding: 0 20px;
  height: 56px;
  background: transparent;
  border: none;
  color: var(--text-primary, #e9edef);
  font-size: 16px;
  text-align: left;
  cursor: pointer;
  transition: background .15s;
}
.action-sheet-item:active,
.action-sheet-item:hover { background: var(--sidebar-active, #2a3942); }
.action-sheet-item .asi-icon {
  width: 28px;
  text-align: center;
  font-size: 20px;
  flex-shrink: 0;
}
.action-sheet-item.asi-danger { color: #ff6961; }
.action-sheet-item.asi-cancel {
  margin-top: 6px;
  border-top: 8px solid var(--sidebar-active, #2a3942);
  justify-content: center;
  font-weight: 500;
  color: var(--text-secondary, #8696a0);
}
.action-sheet-item.asi-cancel .asi-icon { display: none; }

/* 过渡动画 */
.sheet-fade-enter-active, .sheet-fade-leave-active { transition: opacity .2s; }
.sheet-fade-enter-from, .sheet-fade-leave-to { opacity: 0; }
.sheet-up-enter-active, .sheet-up-leave-active { transition: transform .25s ease; }
.sheet-up-enter-from, .sheet-up-leave-to { transform: translateY(100%); }

@media (min-width: 768px) {
  /* PC 上显示为会话项旁的下拉菜单风格 */
  .action-sheet {
    left: auto;
    right: 8px;
    bottom: auto;
    top: auto;
    position: fixed;
    border-radius: 10px;
    width: 200px;
    padding: 6px 0;
    box-shadow: 0 4px 16px rgba(0,0,0,0.3);
    transform-origin: top right;
  }
  .action-sheet-title { display: none; }
  .action-sheet-item {
    height: 40px;
    font-size: 14px;
    padding: 0 14px;
    gap: 10px;
  }
  .action-sheet-item .asi-icon { width: 22px; font-size: 16px; }
  .action-sheet-item.asi-cancel { display: none; }
  .sheet-up-enter-from, .sheet-up-leave-to { transform: scale(0.85); opacity: 0; }
  .sheet-up-enter-active, .sheet-up-leave-active { transition: transform .15s ease, opacity .15s; }
}


/* ========== 🕐 世界时钟 ========== */
:root {
  --wc-clock-bg: #ffffff;
  --wc-clock-border: #d1d7db;
  --wc-clock-mark: #54656f;
}
html.dark {
  --wc-clock-bg: #1f2c34;
  --wc-clock-border: #374248;
  --wc-clock-mark: #8696a0;
}
.wc-panel-body { padding: 12px; height: 100%; overflow-y: auto; display: flex; flex-direction: column; background: var(--panel-bg); }
.wc-add-bar { display: flex; align-items: center; margin-bottom: 12px; padding: 8px; background: var(--bg-secondary, var(--input-bg)); border-radius: 8px; }
.wc-empty { text-align: center; padding: 60px 20px; color: var(--text-secondary); }
.wc-list { display: flex; flex-direction: column; gap: 10px; }
.wc-card { background: var(--bg-secondary, var(--chat-bubble-incoming)); border-radius: 12px; padding: 14px; border: 1px solid var(--border-color); transition: box-shadow .2s; }
.wc-card:hover { box-shadow: 0 2px 8px rgba(0,0,0,.08); }
html.dark .wc-card:hover { box-shadow: 0 2px 8px rgba(0,0,0,.3); }
.wc-card-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.wc-city-info { display: flex; align-items: center; gap: 8px; }
.wc-flag { font-size: 20px; }
.wc-city-name { font-weight: 600; font-size: 15px; color: var(--text-primary); }
.wc-tz-diff { font-size: 11px; color: var(--text-secondary); background: var(--tag-bg, rgba(0,168,132,.1)); padding: 2px 6px; border-radius: 4px; color: var(--accent-color, #00a884); }
.wc-del-btn { background: none; border: none; color: var(--text-secondary); font-size: 14px; cursor: pointer; width: 12px; height: 12px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
.wc-del-btn:hover { background: rgba(231,76,60,.15); color: #e74c3c; }

/* ─── 🕰️ 时间与文化面板 ─── */
.culture-panel { padding: 0; overflow-y: auto; }
@media (max-width: 900px) {
  .culture-panel { padding-bottom: calc(56px + env(safe-area-inset-bottom, 0px) + 16px) !important; }
}
.cul-hero {
  display: flex; align-items: center; gap: 12px;
  padding: 14px 16px;
  background: linear-gradient(135deg, var(--bg-secondary) 0%, var(--bg-tertiary, var(--bg-secondary)) 100%);
  border-bottom: 1px solid var(--border-color);
}
.cul-hero-flag { font-size: 36px; line-height: 1; }
.cul-hero-main { flex: 1; min-width: 0; }
.cul-hero-name { font-size: 17px; font-weight: 600; color: var(--text-primary); }
.cul-hero-sub { font-size: 12px; color: var(--text-secondary); margin-top: 2px; }
.cul-hero-status {
  padding: 6px 10px; border-radius: 20px; font-size: 13px; font-weight: 600;
  display: flex; align-items: center; gap: 6px; white-space: nowrap;
}
.cul-s-working .cul-hero-status { background: rgba(46,204,113,0.15); color: #27ae60; }
.cul-s-morning .cul-hero-status { background: rgba(241,196,15,0.15); color: #f39c12; }
.cul-s-evening .cul-hero-status { background: rgba(230,126,34,0.15); color: #e67e22; }
.cul-s-night .cul-hero-status { background: rgba(52,152,219,0.12); color: #2980b9; }
.cul-s-weekend .cul-hero-status { background: rgba(155,89,182,0.15); color: #8e44ad; }

.cul-section { padding: 12px 16px; border-bottom: 1px solid var(--border-color, #eee); }
.cul-section:last-child { border-bottom: none; }
.cul-sec-title {
  font-size: 13px; font-weight: 600; color: var(--text-primary);
  margin-bottom: 8px; display: flex; align-items: center; gap: 6px;
}
.cul-big-time { font-size: 28px; font-weight: 700; color: var(--text-primary); margin-bottom: 4px; font-variant-numeric: tabular-nums; }
.cul-tip { font-size: 13px; color: var(--text-secondary); margin-bottom: 10px; line-height: 1.5; }
.cul-time-advice { position: relative; }
.cul-time-advice.cul-s-working { background: rgba(46,204,113,0.06); }
.cul-time-advice.cul-s-night { background: rgba(52,152,219,0.06); }
.cul-time-advice.cul-s-evening { background: rgba(230,126,34,0.06); }
.cul-time-advice.cul-s-morning { background: rgba(241,196,15,0.06); }
.cul-time-advice.cul-s-weekend { background: rgba(155,89,182,0.06); }

.cul-meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.cul-meta-item { display: flex; flex-direction: column; gap: 2px; }
.cul-meta-label { font-size: 11px; color: var(--text-tertiary, var(--text-secondary)); }
.cul-meta-val { font-size: 13px; color: var(--text-primary); line-height: 1.4; }
.cul-meta-val.cul-multiline { font-size: 12px; }

.cul-switch-hint { margin-top: 10px; }
.cul-switch-btn {
  background: var(--accent-color, #3b82f6); color: #fff; border: none; border-radius: 6px;
  padding: 6px 12px; font-size: 12px; cursor: pointer; transition: opacity .2s;
}
.cul-switch-btn:hover { opacity: .85; }

.cul-two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 8px; }
.cul-sub-title { font-size: 12px; font-weight: 600; color: var(--text-primary); margin-bottom: 4px; }
.cul-text { font-size: 12px; color: var(--text-secondary); line-height: 1.5; }

.cul-list { margin: 0; padding-left: 18px; font-size: 12.5px; color: var(--text-primary); line-height: 1.65; }
.cul-list li { margin-bottom: 4px; }
.cul-list-warn li { color: #c0392b; }
.cul-taboos { background: rgba(231,76,60,0.04); }

.cul-manual .cul-pick-label { font-size: 11px; color: var(--text-secondary); display: block; margin-bottom: 4px; }
.cul-pick-select {
  width: 100%; padding: 6px 8px; border-radius: 6px;
  border: 1px solid var(--border-color); background: var(--bg-primary); color: var(--text-primary);
  font-size: 12px; outline: none;
}
.cul-pick-select:focus { border-color: var(--accent-color, #3b82f6); }
.cul-empty-tip { text-align: center; padding: 24px 16px 16px; }

/* PC Header 徽标 */
.conv-cul-badge {
  display: inline-flex; align-items: center; gap: 4px;
  margin-left: 10px; padding: 3px 8px; border-radius: 12px;
  font-size: 12px; font-weight: 500; cursor: pointer;
  transition: all .2s; font-variant-numeric: tabular-nums;
}
.conv-cul-badge:hover { transform: scale(1.05); }
.conv-cul-badge.cul-s-working { background: rgba(46,204,113,0.15); color: #27ae60; }
.conv-cul-badge.cul-s-morning { background: rgba(241,196,15,0.15); color: #d68910; }
.conv-cul-badge.cul-s-evening { background: rgba(230,126,34,0.15); color: #d35400; }
.conv-cul-badge.cul-s-night { background: rgba(52,152,219,0.12); color: #2471a3; }
.conv-cul-badge.cul-s-weekend { background: rgba(155,89,182,0.15); color: #7d3c98; }

/* 手机端Header徽标 */
.mh-cul-badge {
  display: inline-flex; align-items: center; gap: 2px;
  padding: 0; border-radius: 0; font-size: 11px; font-weight: 400;
  margin-top: 0; margin-left: 0; align-self: flex-start; font-variant-numeric: tabular-nums;
  white-space: nowrap; background: none !important; color: var(--text-secondary, #8696a0) !important;
}
.mh-cul-badge.cul-s-working { background: none !important; color: var(--text-secondary, #8696a0) !important; }
.mh-cul-badge.cul-s-morning { background: none !important; color: var(--text-secondary, #8696a0) !important; }
.mh-cul-badge.cul-s-evening { background: none !important; color: var(--text-secondary, #8696a0) !important; }
.mh-cul-badge.cul-s-night { background: none !important; color: var(--text-secondary, #8696a0) !important; }
.mh-cul-badge.cul-s-weekend { background: none !important; color: var(--text-secondary, #8696a0) !important; }

.wc-card-mid { display: flex; align-items: center; gap: 16px; }
.wc-analog { flex-shrink: 0; }
.wc-analog svg { display: block; }
.wc-digital { flex: 1; }
.wc-time { font-size: 28px; font-weight: 700; color: var(--text-primary); font-variant-numeric: tabular-nums; letter-spacing: 1px; line-height: 1.1; }
.wc-date { font-size: 12px; color: var(--text-secondary); margin-top: 2px; }
.wc-day { font-size: 11px; color: var(--text-secondary); margin-top: 1px; }

.col-function-panel.clocking .panel-col-header { background: var(--panel-header-bg); color: var(--text-primary); border-bottom: 1px solid var(--border-color); }

/* 手机端 */
@media (max-width: 900px) {
  .wc-card-mid { gap: 12px; }
  .wc-time { font-size: 24px; }
  .wc-analog svg { width: 64px; height: 64px; }
}


/* ========== 💱 汇率计算 ========== */
.ex-panel-body { padding: 12px; height: 100%; overflow-y: auto; background: var(--panel-bg); display: flex; flex-direction: column; gap: 14px; }
.ex-header { text-align: center; }
.ex-rate-date { font-size: 12px; color: var(--text-secondary); }
.ex-loading { font-size: 12px; color: var(--text-secondary); }
.ex-error { font-size: 12px; color: #e74c3c; margin-top: 4px; }
.ex-converter { background: var(--bg-secondary, var(--chat-bubble-incoming)); border-radius: 12px; padding: 14px; border: 1px solid var(--border-color); }
.ex-row { display: flex; gap: 8px; align-items: center; }
.ex-amount { flex: 1; background: var(--input-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 10px 12px; font-size: 18px; font-weight: 600; color: var(--text-primary); outline: none; font-variant-numeric: tabular-nums; min-width: 0; box-sizing: border-box; }
.ex-amount:focus { border-color: var(--accent-color, #00a884); }
.ex-result { background: var(--input-bg); color: var(--accent-color, #00a884); }
.ex-currency { width: 100px; flex-shrink: 0; background: var(--input-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 10px 8px; font-size: 14px; color: var(--text-primary); outline: none; cursor: pointer; box-sizing: border-box; }
.ex-currency:focus { border-color: var(--accent-color, #00a884); }
.ex-swap-row { display: flex; justify-content: center; padding: 6px 0; }
.ex-swap-btn { width: 32px; height: 32px; border-radius: 50%; border: 1px solid var(--border-color); background: var(--panel-bg); color: var(--text-primary); cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center; transition: all .2s; }
.ex-swap-btn:hover { background: var(--accent-color, #00a884); color: white; border-color: var(--accent-color, #00a884); transform: rotate(180deg); }
.ex-rate-info { text-align: center; font-size: 12px; color: var(--text-secondary); margin-top: 8px; }
.ex-quick-title { font-size: 13px; color: var(--text-secondary); font-weight: 600; padding: 0 4px; }
.ex-quick-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.ex-quick-card { background: var(--bg-secondary, var(--chat-bubble-incoming)); border: 1px solid var(--border-color); border-radius: 8px; padding: 8px; text-align: center; }
.ex-qc-top { font-size: 11px; color: var(--text-secondary); font-weight: 600; }
.ex-qc-rate { font-size: 16px; font-weight: 700; color: var(--accent-color, #00a884); margin: 4px 0; font-variant-numeric: tabular-nums; }
.ex-qc-name { font-size: 10px; color: var(--text-secondary); }
.col-function-panel.forexing .panel-col-header { background: var(--panel-header-bg); color: var(--text-primary); border-bottom: 1px solid var(--border-color); }
@media (max-width: 900px) {
  .ex-quick-grid { grid-template-columns: repeat(2, 1fr); }
  .ex-amount { font-size: 16px; padding: 8px 10px; }
}


/* 询盘7分类徽章 */
.aitalk-inquiry-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 10px;
  margin-bottom: 10px;
  font-size: 13px;
  line-height: 1.4;
  background: var(--bg-elevated, #ffffff);
  border: 1px solid var(--border-color, #e5e7eb);
  border-left-width: 4px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
}
.inq-cat-prefix {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
  background: var(--bg-secondary, #f3f4f6);
  color: var(--text-secondary);
  flex-shrink:0;
  letter-spacing: 0.3px;
}
.inq-cat-sep {
  width:1px; height:14px; background: var(--border-color, #e5e7eb); flex-shrink:0;
}
.aitalk-inquiry-badge.inq-info { border-left-color: #3b82f6; }
.aitalk-inquiry-badge.inq-info .inq-cat-label { color: #2563eb; }
.aitalk-inquiry-badge.inq-price { border-left-color: #f97316; }
.aitalk-inquiry-badge.inq-price .inq-cat-label { color: #ea580c; }
.aitalk-inquiry-badge.inq-sample { border-left-color: #22c55e; }
.aitalk-inquiry-badge.inq-sample .inq-cat-label { color: #16a34a; }
.aitalk-inquiry-badge.inq-cert { border-left-color: #a855f7; }
.aitalk-inquiry-badge.inq-cert .inq-cat-label { color: #9333ea; }
.aitalk-inquiry-badge.inq-coop { border-left-color: #10b981; }
.aitalk-inquiry-badge.inq-coop .inq-cat-label { color: #059669; }
.aitalk-inquiry-badge.inq-reject { border-left-color: #ef4444; }
.aitalk-inquiry-badge.inq-reject .inq-cat-label { color: #dc2626; }
.aitalk-inquiry-badge.inq-refer { border-left-color: #06b6d4; }
.aitalk-inquiry-badge.inq-refer .inq-cat-label { color: #0891b2; }
.inq-cat-icon { font-size: 18px; flex-shrink:0; }
.inq-cat-label { font-weight: 700; flex-shrink:0; font-size:13px; }
.inq-cat-tip { color: var(--text-secondary); flex:1; font-size: 12px; }
@media (max-width: 900px) {
  .aitalk-inquiry-badge { padding: 8px 10px; font-size: 12px; gap:6px; flex-wrap: wrap; }
  .inq-cat-icon { font-size: 16px; }
  .inq-cat-sep { display: none; }
  .inq-cat-tip { width: 100%; padding-left: 28px; margin-top: -2px; }
}


/* ===== 手机端紧凑列表（WhatsApp风格） ===== */
@media (max-width: 900px) {
  /* 隐藏渠道切换条和账号栏（走☰抽屉） */
  .comm-module .ch-switch { display: none !important; }
  .col-accounts { display: none !important; }

  /* 聊天列表顶上去（不再为ch-switch让68px） */
  .comm-module .col-chatlist {
    top: 0 !important;
    bottom: 0 !important;
    padding-top: 0 !important;
  }
  .comm-module .col-conversation {
    top: 0 !important;
    bottom: 0 !important;
    padding-top: 0 !important;
  }
  .comm-module.email-active .col-conversation {
    top: 0 !important;
  }
  .comm-module.in-conv .col-chatlist { top: 0 !important; }
  .comm-module.in-conv .col-conversation { top: 0 !important; }
  .comm-module.in-conv .email-active .col-conversation { top: 0 !important; }
  .comm-module.drawer-open .col-chatlist { top: 0 !important; }

  /* 搜索框头部紧凑 */
  .col-chatlist .col-header {
    padding: 6px 10px;
    gap: 6px;
    min-height: 48px;
    height: 48px;
    position: relative !important;
    z-index: 100;
  }
  .col-chatlist .search-box {
    flex: 1;
    min-height: 36px;
    border-radius: 18px;
    padding: 0 12px;
    position: relative;
  }
  .col-chatlist .search-box input {
    font-size: 14px;
    padding: 0 28px 0 26px;
  }
  .col-header-actions {
    display: flex;
    align-items: center;
    gap: 2px;
  }
  .col-new-chat, .col-filter-btn {
    width: 38px;
    height: 38px;
    flex-shrink: 0;
    border-radius: 50%;
    background: transparent;
    border: none;
    color: var(--text-secondary, #8696a0);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    position: relative;
    -webkit-tap-highlight-color: transparent;
  }
  .col-new-chat:active, .col-filter-btn:active { background: var(--sidebar-active, #f0f2f5); }
  body.dark .col-new-chat:active, body.dark .col-filter-btn:active { background: #2a3942; }
  .filter-active-dot {
    position: absolute;
    top: 7px;
    right: 7px;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--accent, #00a884);
  }

  /* 搜索框内待跟进徽章 */
  .search-fu-badge {
    position: absolute;
    right: 6px;
    top: 50%;
    transform: translateY(-50%);
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    border-radius: 9px;
    background: #ef4444;
    color: #fff;
    font-size: 11px;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    z-index: 2;
  }
  .search-fu-badge:active { opacity: 0.7; }

  /* 三点下拉菜单 */
  .mobile-filter-menu {
    position: absolute;
    top: 48px;
    right: 10px;
    min-width: 200px;
    background: var(--panel-bg, #fff);
    border: 1px solid var(--border-color, #e9edef);
    border-radius: 12px;
    box-shadow: 0 6px 24px rgba(0,0,0,.15);
    z-index: 200;
    padding: 6px 0;
    overflow: hidden;
  }
  body.dark .mobile-filter-menu { background: #23313d; border-color: #2a3942; box-shadow: 0 6px 24px rgba(0,0,0,.5); }
  .mfm-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 11px 16px;
    font-size: 14px;
    color: var(--text-primary, #111);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  body.dark .mfm-item { color: #e9edef; }
  .mfm-item:active { background: var(--sidebar-active, #f0f2f5); }
  body.dark .mfm-item:active { background: #2a3942; }
  .mfm-item.active { color: var(--accent, #00a884); }
  .mfm-icon { width: 22px; text-align: center; font-size: 16px; }
  .mfm-label { flex: 1; }
  .mfm-check { font-weight: bold; color: var(--accent, #00a884); font-size: 15px; }
  .mfm-badge {
    min-width: 20px;
    height: 20px;
    padding: 0 6px;
    border-radius: 10px;
    background: var(--text-secondary, #8696a0);
    color: #fff;
    font-size: 11px;
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .mfm-badge-urgent { background: #ef4444; }
  .mfm-divider { border-top: 1px solid var(--border-color, #e9edef); }
  body.dark .mfm-divider { border-top-color: #2a3942; }
  .mfm-sub {
    padding: 4px 16px 8px 50px;
    display: flex;
    flex-wrap: wrap;
    gap: 4px 10px;
    font-size: 12px;
    color: var(--text-secondary, #8696a0);
  }
  .mfm-sub-item { cursor: pointer; }
  .mfm-sub-item:active { opacity: 0.7; }

  /* 头像角点调大更醒目 */
  .conv-followup-dot {
    width: 12px !important;
    height: 12px !important;
    border: 2px solid var(--panel-bg, #fff) !important;
    right: -2px !important;
    bottom: -2px !important;
  }
  body.dark .conv-followup-dot { border-color: #111b21 !important; }
  .conv-fr-badge {
    font-size: 9px !important;
    padding: 1px 5px !important;
  }
}


/* ===== 手机端顶栏渠道切换 ===== */
@media (max-width: 900px) {
  .mh-title { cursor: pointer; }
  /* 列表视图：标题组紧凑靠左 */
  .mh-title.mh-title-list { flex: 0 1 auto !important; gap: 6px; }
  .mh-title.mh-title-list .mh-ch-icon {
    width: 22px; height: 22px; margin-right: 2px; flex-shrink: 0;
    display: inline-flex; align-items: center; justify-content: center;
    color: var(--text-primary);
  }
  .mh-title.mh-title-list .mh-ch-icon :deep(svg),
  .mh-title.mh-title-list .mh-ch-icon svg { width: 20px; height: 20px; }
  .mh-title.mh-title-list .mh-name-row.mh-name-row-list {
    flex: 0 1 auto !important; flex-direction: row !important;
    align-items: center; gap: 3px;
  }
  .mh-name-row.mh-name-row-list {
    flex-direction: row !important;
    align-items: center;
    gap: 4px;
  }
  .mh-name-row.mh-name-row-list .mh-name-text {
    flex: 0 0 auto;
    max-width: 60vw;
  }
  .mh-ch-icon {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-primary);
    flex-shrink: 0;
  }
  .mh-ch-icon :deep(svg), .mh-ch-icon svg { width:22px; height:22px; }
  .mh-ch-caret {
    margin-left: 2px;
    color: var(--text-secondary);
    transition: transform .2s;
    flex-shrink: 0;
  }
  .mh-ch-badge {
    margin-left: 4px;
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    border-radius: 9px;
    background: #ef4444;
    color: #fff;
    font-size: 11px;
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    line-height: 1;
  }

  /* 渠道切换 ActionSheet */
  .channel-sheet .asi-ch-icon {
    font-size: 22px;
    width: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .channel-sheet .asi-ch-icon :deep(svg), .channel-sheet .asi-ch-icon svg { width:24px; height:24px; }
  .asi-badge {
    min-width: 20px;
    height: 20px;
    padding: 0 6px;
    border-radius: 10px;
    background: var(--text-secondary, #8696a0);
    color: #fff;
    font-size: 11px;
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-left: auto;
    margin-right: 8px;
  }
  .asi-badge-red { background: #ef4444; }
  .asi-tag {
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 10px;
    background: var(--sidebar-active);
    color: var(--text-secondary);
    margin-left: 6px;
  }
  .asi-tag-soon { color: #8696a0; background: #f0f2f5; }
  body.dark .asi-tag-soon { background: #2a3942; }
  .asi-tag-online { background: rgba(0,168,132,.15); color: #00a884; }
  .asi-check { color: var(--accent, #00a884); font-weight: bold; font-size: 16px; margin-left: auto; }
  .action-sheet-item.active { color: var(--accent, #00a884); }
  .asi-offline { opacity: 0.6; }
  .asi-label { flex: 1; text-align: left; }

  /* 多账号子区 */
  .as-sub-accounts {
    border-top: 8px solid var(--sidebar-active, #f0f2f5);
    padding-top: 4px;
  }
  body.dark .as-sub-accounts { border-top-color: #1a2329; }
  .as-sub-title {
    font-size: 12px;
    color: var(--text-secondary);
    padding: 8px 20px 4px;
    text-transform: uppercase;
    letter-spacing: .5px;
  }
  .as-sub-item { padding-left: 36px; }
  .as-current-acc {
    padding: 12px 20px;
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 14px;
    color: var(--text-primary);
  }
  .as-cur-name { flex: 1; font-weight: 500; }
  .as-add-account {
    font-size: 13px;
    color: var(--accent, #00a884);
    font-weight: 500;
    margin-left: auto;
    cursor: pointer;
    padding: 4px 8px;
  }
  .as-acc-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    object-fit: cover;
    display: inline-block;
  }
  .as-acc-fallback {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-size: 13px;
    font-weight: 600;
  }
}

/* 非手机端隐藏新按钮（PC端用胶囊Tab） */
@media (min-width: 901px) {
  .col-filter-btn { display: none !important; }
  .mobile-filter-menu { display: none !important; }
  .search-fu-badge { display: none !important; }
  .col-header-actions { display: contents; }
}

.mh-ch-arrow { opacity: 0.6; margin-left: 2px; flex-shrink: 0; }

/* ═══ Phase 5: Reply length chips + bilingual ═══ */
.ai-length-chips {
  display: flex; gap: 6px; margin-top: 4px;
}
.ai-length-chip {
  padding: 4px 12px; border-radius: 16px; border: 1px solid #ddd;
  background: #f8f8f8; cursor: pointer; font-size: 12px;
  transition: all .2s; color: #555;
}
.ai-length-chip.active {
  background: #0088cc; color: #fff; border-color: #0088cc;
}
.ai-length-chip:hover:not(.active) {
  border-color: #0088cc; color: #0088cc;
}
.ai-context-toggle {
  margin-top: 6px; font-size: 12px;
}
.ai-toggle-label {
  display: flex; align-items: center; gap: 6px; cursor: pointer; color: #666;
}
.ai-toggle-label input[type="checkbox"] {
  accent-color: #0088cc;
}
.ai-context-banner {
  background: #f0f7ff; border-radius: 8px; padding: 8px 12px;
  margin-bottom: 8px; border-left: 3px solid #0088cc; font-size: 12px;
}
.ai-context-line {
  display: flex; align-items: center; gap: 6px; margin-bottom: 2px; flex-wrap: wrap;
}
.ai-ctx-tag {
  padding: 1px 8px; border-radius: 10px; font-size: 11px; font-weight: 600;
}
.ai-ctx-tag.tag-quote { background: #fff3cd; color: #856404; }
.ai-ctx-tag.tag-ask { background: #d1ecf1; color: #0c5460; }
.ai-ctx-text { color: #555; font-size: 11px; }
.ai-reply-cn-block {
  background: #f9f9f9; border-left: 3px solid #ccc; padding: 6px 10px;
  margin: 6px 0 2px; border-radius: 0 4px 4px 0;
}
.ai-reply-cn-text {
  font-size: 12px; color: #666; line-height: 1.5;
  font-family: "KaiTi", "Microsoft YaHei", "STKaiti", serif;
}
.ai-reply-actions {
  display: flex; gap: 4px;
}
.ai-copy-btn {
  padding: 2px 8px; border-radius: 4px; border: 1px solid #ddd;
  background: #fff; cursor: pointer; font-size: 11px; color: #666;
  transition: all .2s;
}
.ai-copy-btn:hover {
  border-color: #0088cc; color: #0088cc; background: #f0f7ff;
}
.ai-reply-meta-tag.length-tag {
  background: #e8f4fd; color: #0088cc; padding: 1px 6px; border-radius: 8px; font-size: 10px;
}


/* ── 📈 效果追踪面板 ── */
/* ── 📚 话术库面板 ── */
.aitalk-tabs { flex-shrink: 0; margin: 0 12px; border-bottom: 1px solid var(--border-light, rgba(255,255,255,0.08)); }
.speechlib-panel { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 0; }
.speechlib-match-section { padding: 12px; border-bottom: 1px solid var(--border-light, rgba(255,255,255,0.06)); }
.speechlib-match-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.speechlib-match-title { font-size: 13px; font-weight: 600; color: var(--text-primary, #e9edef); }
.speechlib-match-btn { background: var(--accent, #00a884); color: #fff; border: none; border-radius: 6px; padding: 5px 12px; font-size: 12px; cursor: pointer; white-space: nowrap; }
.speechlib-match-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.speechlib-match-list { display: flex; flex-direction: column; gap: 8px; }
.speechlib-card { background: var(--sidebar-active, rgba(255,255,255,0.06)); border-radius: 10px; padding: 10px 12px; border: 1px solid transparent; transition: border-color 0.15s; }
.speechlib-card:hover { border-color: var(--accent, #00a884); }
.speechlib-card-q { font-size: 12px; color: var(--text-secondary, #8696a0); margin-bottom: 6px; line-height: 1.4; word-break: break-all; }
.speechlib-card-a { font-size: 13px; color: var(--text-primary, #e9edef); line-height: 1.5; margin-bottom: 6px; word-break: break-all; }
.speechlib-card-meta { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 6px; }
.speechlib-tag { font-size: 10px; padding: 2px 7px; border-radius: 10px; background: rgba(255,255,255,0.08); color: var(--text-secondary, #8696a0); }
.speechlib-tag-score { background: rgba(255,165,0,0.15); color: #f5a623; }
.speechlib-tag-fav { background: rgba(255,215,0,0.12); color: #f5c518; }
.speechlib-source-badge { display:inline-block; font-size:10px; padding:2px 7px; border-radius:10px; margin-bottom:6px; background: rgba(0,168,132,0.15); color: #00a884; font-weight:600; }
.speechlib-source-badge.src-community { background: rgba(255,152,0,0.15); color: #ff9800; }
.speechlib-source-badge.src-qa { background: rgba(42,171,238,0.15); color: #2aabee; }
.speechlib-copy-btn { background: transparent; border: 1px solid var(--accent, #00a884); color: var(--accent, #00a884); border-radius: 6px; padding: 3px 10px; font-size: 11px; cursor: pointer; transition: all 0.15s; }
.speechlib-copy-btn:hover { background: var(--accent, #00a884); color: #fff; }
.speechlib-list-section { flex: 1; padding: 12px; overflow-y: auto; }
.speechlib-list-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.speechlib-list-title { font-size: 13px; font-weight: 600; color: var(--text-primary, #e9edef); }
.speechlib-refresh-btn { background: transparent; border: none; color: var(--text-secondary, #8696a0); font-size: 16px; cursor: pointer; padding: 2px 6px; }
.speechlib-refresh-btn:hover { color: var(--accent, #00a884); }
.speechlib-sample-list { display: flex; flex-direction: column; gap: 8px; }
.speechlib-card-compact { padding: 8px 10px; }
.speechlib-loading { text-align: center; color: var(--text-secondary); font-size: 13px; padding: 20px 0; }
.speechlib-empty { text-align: center; color: var(--text-secondary, #8696a0); font-size: 13px; padding: 20px 0; }

.tracking-panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.tracking-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 0;
  color: var(--text-secondary, #8696a0);
}
.tracking-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 16px;
  color: var(--text-secondary, #8696a0);
  text-align: center;
}
.tracking-empty-icon { font-size: 40px; margin-bottom: 12px; opacity: 0.6; }
.tracking-empty p { margin: 4px 0; font-size: 14px; }

.tracking-stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}
.tracking-stat-card {
  background: var(--panel-card-bg, #202c33);
  border: 1px solid var(--border-color, #222d34);
  border-radius: 12px;
  padding: 14px 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  transition: border-color .15s;
}
.tracking-stat-card:hover { border-color: var(--accent); }
.tracking-stat-icon { font-size: 20px; margin-bottom: 6px; }
.tracking-stat-num {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary, #e9edef);
  line-height: 1.2;
  margin-bottom: 2px;
}
.tracking-stat-label { font-size: 11px; color: var(--text-secondary, #8696a0); }
.tracking-green { color: #25D366; }
.tracking-orange { color: #f59e0b; }

.tracking-section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary, #e9edef);
  margin-bottom: 10px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--border-color, #222d34);
}

.tracking-trend-list { display: flex; flex-direction: column; gap: 6px; }
.tracking-trend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}
.tracking-trend-date { color: var(--text-secondary, #8696a0); min-width: 44px; }
.tracking-trend-bar-wrap {
  flex: 1;
  height: 6px;
  background: var(--border-color, #222d34);
  border-radius: 3px;
  overflow: hidden;
}
.tracking-trend-bar {
  height: 100%;
  background: var(--accent, #00a884);
  border-radius: 3px;
  transition: width .3s;
}
.tracking-trend-rate { min-width: 40px; text-align: right; color: var(--text-primary, #e9edef); font-weight: 500; }

.tracking-attitude-card {
  background: var(--panel-card-bg, #202c33);
  border: 1px solid var(--border-color, #222d34);
  border-radius: 10px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.tracking-att-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  color: var(--text-primary, #e9edef);
}
.tracking-att-badge {
  padding: 2px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}
.att-intent-high { background: rgba(37,211,102,.15); color: #25D366; }
.att-intent-medium { background: rgba(245,158,11,.15); color: #f59e0b; }
.att-intent-low { background: rgba(134,150,160,.15); color: #8696a0; }
.att-sent-positive { background: rgba(37,211,102,.15); color: #25D366; }
.att-sent-neutral { background: rgba(134,150,160,.15); color: #8696a0; }
.att-sent-negative { background: rgba(234,76,97,.15); color: #ea4c61; }
.att-urg-high { background: rgba(234,76,97,.15); color: #ea4c61; }
.att-urg-medium { background: rgba(245,158,11,.15); color: #f59e0b; }
.att-urg-low { background: rgba(134,150,160,.15); color: #8696a0; }


/* === Two-level navigation === */
.platform-item.has-children {
  cursor: pointer;
}
.p-arrow {
  margin-left: -10px;
  transition: transform 0.2s ease;
  flex-shrink: 0;
}
.p-arrow.open {
  transform: rotate(180deg);
}
.platform-children {
  overflow: hidden;
  background: rgba(255,255,255,0.03);
}
.platform-collapsed .platform-children {
  position: absolute; left: calc(100% + 8px); top: 0;
  min-width: 170px; background: var(--panel-bg);
  border: 1px solid var(--border-color); border-radius: 8px;
  padding: 4px; box-shadow: 0 4px 16px rgba(0,0,0,0.22);
  z-index: 1000; overflow: visible;
}
.platform-collapsed .platform-child { padding: 8px 14px; }
.platform-collapsed .platform-child .p-child-label { white-space: nowrap; }
.platform-child {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px 10px 40px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-secondary, #8696a0);
  transition: all 0.15s;
  border-left: 3px solid transparent;
}
.platform-child:hover {
  background: rgba(255,255,255,0.06);
  color: var(--text-primary, #e9edef);
}
.platform-child.active {
  color: var(--accent, #00a884);
  background: rgba(0,168,132,0.08);
  border-left-color: var(--accent, #00a884);
  font-weight: 600;
}
.p-child-icon {
  font-size: 16px;
  width: 20px;
  text-align: center;
  flex-shrink: 0;
}
.p-child-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.slide-down-enter-active, .slide-down-leave-active {
  transition: all 0.2s ease;
  max-height: 200px;
  opacity: 1;
}
.slide-down-enter-from, .slide-down-leave-to {
  max-height: 0;
  opacity: 0;
}


.view-360-btn {
  background: linear-gradient(135deg, #00a884, #008069);
  color: white;
  border: none;
  padding: 6px 14px;
  border-radius: 16px;
  font-size: 12px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.2s;
  margin-left: auto;
}
.view-360-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0,168,132,0.3);
}
.bg-report-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* ========== 外贸Agent模块 ========== */
.trade-agent-module {
  flex: 1;
  display: flex;
  overflow: hidden;
  min-width: 0;
  height: 100%;
}
.agent-hub-page {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 32px;
  background: var(--mgmt-bg);
  overflow-y: auto;
}
.agent-hub-header {
  margin-bottom: 32px;
}
.agent-hub-header h1 {
  font-size: 28px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 8px;
}
.agent-hub-sub {
  font-size: 14px;
  color: var(--text-secondary);
}
.agent-hub-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
  max-width: 1200px;
}
.agent-hub-card {
  background: var(--mgmt-card-bg);
  border: 1px solid var(--mgmt-divider);
  border-radius: 16px;
  padding: 28px 24px;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.agent-hub-card:hover {
  border-color: var(--accent);
  box-shadow: 0 4px 20px rgba(0,168,132,0.12);
  transform: translateY(-3px);
}
.ah-card-icon {
  font-size: 36px;
  margin-bottom: 4px;
}
.ah-card-name {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}
.ah-card-desc {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
  flex: 1;
}
.ah-card-arrow {
  font-size: 16px;
  color: var(--accent);
  align-self: flex-end;
  margin-top: 4px;
  opacity: 0;
  transition: opacity 0.2s;
}
.agent-hub-card:hover .ah-card-arrow {
  opacity: 1;
}

@media (max-width: 768px) {
  .agent-hub-page { padding: 16px; }
  .agent-hub-grid { grid-template-columns: 1fr; gap: 12px; }
  .agent-hub-card { padding: 20px 16px; }
}

/* ========== Trade Agent 聊天界面 ========== */
.trade-agent-module {
  display: flex;
  height: 100%;
  background: var(--chat-bg, #0b141a);
  overflow: hidden;
}
/* 左栏：Agent列表 */
.ta-agent-sidebar {
  width: 260px;
  min-width: 260px;
  background: var(--mgmt-card-bg, #1e252b);
  border-right: 1px solid rgba(255,255,255,0.06);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.ta-sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 16px 12px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 1.5px;
  color: var(--text-secondary, #8696a0);
}
.ta-add-agent {
  width: 24px; height: 24px;
  border-radius: 50%;
  border: 1px solid rgba(255,255,255,0.15);
  background: transparent;
  color: var(--text-secondary, #8696a0);
  font-size: 16px;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.2s;
}
.ta-add-agent:hover { background: rgba(255,255,255,0.08); color: #fff; }
.ta-agent-list { flex: 1; overflow-y: auto; padding: 0 8px; }
.ta-agent-item {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px; border-radius: 12px; cursor: pointer;
  transition: background 0.2s; margin-bottom: 2px;
}
.ta-agent-item:hover { background: rgba(255,255,255,0.06); }
.ta-agent-item.active { background: rgba(59,130,246,0.15); }
.ta-agent-avatar { font-size: 22px; width: 32px; text-align: center; }
.ta-agent-name { flex: 1; font-size: 14px; color: var(--text-primary, #e9edef); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ta-agent-time { font-size: 12px; color: var(--text-secondary, #8696a0); white-space: nowrap; }
.ta-expand-btn {
  padding: 12px 16px; font-size: 13px;
  color: var(--text-secondary, #8696a0); cursor: pointer;
  border-top: 1px solid rgba(255,255,255,0.06); transition: color 0.2s;
}
.ta-expand-btn:hover { color: var(--text-primary, #e9edef); }
/* 中间：聊天区 */
.ta-chat-main { flex: 1; display: flex; flex-direction: column; min-width: 0; background: var(--chat-bg, #0b141a); border-right: 1px solid rgba(255,255,255,0.06); }
.ta-chat-header {
  display: flex; align-items: center; gap: 12px; padding: 16px 20px;
  border-bottom: 1px solid rgba(255,255,255,0.06); background: var(--mgmt-card-bg, #1e252b);
}
.ta-header-avatar {
  width: 40px; height: 40px; border-radius: 50%;
  background: rgba(59,130,246,0.15); display: flex; align-items: center; justify-content: center; font-size: 22px;
}
.ta-header-info { display: flex; flex-direction: column; }
.ta-header-name { font-size: 15px; font-weight: 600; color: var(--text-primary, #e9edef); }
.ta-header-status { font-size: 12px; color: #25d366; }
/* 消息区 */
.ta-chat-messages { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 16px; }
/* 欢迎区 */
.ta-welcome { display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 60px 20px; flex: 1; }
.ta-welcome-icon { font-size: 48px; margin-bottom: 16px; }
.ta-welcome h2 { font-size: 22px; color: var(--text-primary, #e9edef); margin: 0 0 8px; }
.ta-welcome p { font-size: 14px; color: var(--text-secondary, #8696a0); margin: 0 0 24px; }
.ta-quick-prompts { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; max-width: 500px; }
.ta-quick-prompts button {
  padding: 8px 16px; border-radius: 20px; border: 1px solid rgba(59,130,246,0.3);
  background: rgba(59,130,246,0.08); color: #60a5fa; font-size: 13px; cursor: pointer; transition: all 0.2s;
}
.ta-quick-prompts button:hover { background: rgba(59,130,246,0.2); border-color: rgba(59,130,246,0.5); }
/* 消息气泡 */
.ta-message { display: flex; gap: 10px; max-width: 80%; }
.ta-message.ai { align-self: flex-start; }
.ta-message.user { align-self: flex-end; flex-direction: row-reverse; }
.ta-msg-avatar {
  width: 32px; height: 32px; border-radius: 50%;
  background: rgba(59,130,246,0.15); display: flex; align-items: center; justify-content: center;
  font-size: 16px; flex-shrink: 0;
}
.ta-msg-avatar.user-avatar { background: rgba(37,211,102,0.15); }
.ta-msg-bubble { padding: 10px 14px; border-radius: 12px; font-size: 14px; line-height: 1.6; word-break: break-word; white-space: pre-wrap; }
.ta-msg-bubble.ai { background: var(--mgmt-card-bg, #1e252b); color: var(--text-primary, #e9edef); }
.ta-msg-bubble.user { background: #25d366; color: #fff; }
.ta-msg-bubble.user.ta-img-only { background: transparent !important; padding: 2px !important; }
.ta-msg-bubble.ta-img-only .ta-msg-img { border-radius: 8px; display: block; }
/* 胶囊快捷指令（输入框上方常驻） */
.ta-capsule-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px 16px 2px;
  background: var(--chat-bg, #0b141a);
}
.ta-capsule-btn {
  padding: 5px 12px;
  border-radius: 16px;
  border: 1px solid rgba(255,255,255,0.1);
  background: var(--mgmt-card-bg, #1e252b);
  color: var(--text-secondary, #8696a0);
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s;
}
.ta-capsule-btn:hover { border-color: rgba(59,130,246,0.5); color: #60a5fa; background: rgba(59,130,246,0.1); }

/* 执行过程可视化：loading + 步骤流 */
.ta-loading-block {
  align-self: flex-start;
  max-width: 80%;
  padding: 10px 14px;
  border-radius: 12px;
  background: var(--mgmt-card-bg, #1e252b);
  border: 1px solid rgba(255,255,255,0.06);
}
.ta-loading-row { display: flex; align-items: center; gap: 4px; font-size: 12px; color: var(--text-secondary, #8696a0); }
.ta-loading-dot { width: 6px; height: 6px; border-radius: 50%; background: #60a5fa; animation: taBlink 1.2s infinite; }
.ta-loading-dot:nth-child(2) { animation-delay: 0.2s; }
.ta-loading-dot:nth-child(3) { animation-delay: 0.4s; }
@keyframes taBlink { 0%,60%,100% { opacity: 0.3; } 30% { opacity: 1; } }
.ta-loading-txt { margin-left: 4px; }
.ta-steps { margin-top: 8px; display: flex; flex-direction: column; gap: 4px; border-top: 1px dashed rgba(255,255,255,0.1); padding-top: 6px; }
.ta-step-item { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-secondary, #8696a0); }
.ta-step-ico { font-size: 12px; flex-shrink: 0; }
.ta-step-txt { line-height: 1.5; }

/* 底部输入区 */
.ta-input-area { padding: 12px 16px 16px; position: relative; background: var(--chat-bg, #0b141a); }
.ta-input-row {
  display: flex; flex-direction: column;
  background: var(--mgmt-card-bg, #1e252b); border-radius: 16px; padding: 6px 12px 6px;
  border: 1px solid rgba(255,255,255,0.08); transition: border-color 0.2s;
}
.ta-input-inner {
  display: flex; align-items: flex-end; gap: 8px;
}
.ta-input-row:focus-within { border-color: rgba(59,130,246,0.4); }
.ta-input-plus {
  width: 34px; height: 34px; min-width: 34px; min-height: 34px; border-radius: 50%; border: none;
  background: rgba(59,130,246,0.12); color: #60a5fa; font-size: 22px; line-height: 1; cursor: pointer;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all 0.2s;
  padding: 0; -webkit-appearance: none; appearance: none; box-sizing: border-box;
}
.ta-input-plus:hover { background: rgba(59,130,246,0.25); }
.ta-input-textarea {
  flex: 1; border: none; background: transparent; color: var(--text-primary, #e9edef);
  font-size: 14px; resize: none; outline: none; max-height: 120px; line-height: 1.5;
  padding: 6px 0; font-family: inherit;
}
.ta-input-textarea::placeholder { color: var(--text-secondary, #8696a0); }
.ta-input-actions { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.ta-model-btn {
  padding: 6px 12px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.12);
  background: transparent; color: var(--text-primary, #e9edef); font-size: 13px; cursor: pointer;
  display: flex; align-items: center; gap: 4px; transition: all 0.2s;
}
.ta-model-btn:hover { background: rgba(255,255,255,0.06); }
.ta-chevron { font-size: 10px; }
.ta-file-btn, .ta-mic-btn {
  width: 32px; height: 32px; border-radius: 50%; border: none; background: transparent;
  font-size: 18px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.2s;
}
.ta-file-btn:hover, .ta-mic-btn:hover { background: rgba(255,255,255,0.06); }
.ta-send-btn {
  width: 34px; height: 34px; border-radius: 50%; border: none; background: #25d366; color: #fff;
  font-size: 18px; cursor: pointer; display: flex; align-items: center; justify-content: center;
  transition: all 0.2s; flex-shrink: 0;
}
.ta-send-btn:hover { background: #20bd5a; transform: scale(1.05); }
.ta-send-btn:disabled { background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.3); cursor: not-allowed; transform: none; }

/* 移动端输入区精简：隐藏死按钮、防挤压溢出 */
@media (max-width: 900px) {
  .ta-input-row { gap: 6px; padding: 6px 10px; }
  .ta-input-textarea { min-width: 0; }
  .ta-file-btn, .ta-mic-btn { display: none; }
  .ta-model-btn { padding: 5px 8px; font-size: 12px; flex-shrink: 0; }
}
/* 附件菜单 */
.ta-attach-menu {
  position: absolute; bottom: 100%; right: 24px;
  background: var(--mgmt-card-bg, #1e252b); border-radius: 12px;
  border: 1px solid rgba(255,255,255,0.1); padding: 6px;
  display: flex; flex-direction: column; gap: 2px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.3); z-index: 10;
}
.ta-attach-menu button {
  padding: 8px 14px; border: none; background: transparent;
  color: var(--text-primary, #e9edef); font-size: 13px; cursor: pointer;
  border-radius: 8px; text-align: left; transition: background 0.2s;
}
.ta-attach-menu button:hover { background: rgba(255,255,255,0.08); }
/* 右栏：文件面板 */
.ta-file-panel {
  width: 0; min-width: 0; background: var(--mgmt-card-bg, #1e252b);
  border-left: 1px solid rgba(255,255,255,0.06); display: flex; flex-direction: column;
  overflow: hidden; transition: width 0.3s ease, min-width 0.3s ease;
}
.ta-file-panel.open { width: 280px; min-width: 280px; }
.ta-iconbar {
  width: 64px; background: var(--panel-header-bg, #1e252b);
  display: flex; flex-direction: column; flex-shrink: 0;
  border-left: 1px solid rgba(255,255,255,0.06);
}
.ta-ib-items { flex: 1; display: flex; flex-direction: column; align-items: center; padding: 12px 0; gap: 8px; }
.ta-ib-item { background: transparent; border: none; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 8px; border-radius: 8px; color: var(--text-secondary, #8696a0); width: 100%; font-family: inherit; transition: background .15s, color .15s; }
.ta-ib-item:hover { background: rgba(255,255,255,0.06); }
.ta-ib-item.active { color: var(--accent, #4a9eff); }
.ta-ib-icon { font-size: 22px; line-height: 1; }
.ta-ib-label { font-size: 11px; white-space: nowrap; line-height: 1; }
.ta-wecom-panel {
  width: 0; min-width: 0; background: var(--mgmt-card-bg, #1e252b);
  border-left: 1px solid rgba(255,255,255,0.06); display: flex; flex-direction: column;
  overflow: hidden; transition: width 0.3s ease, min-width 0.3s ease;
}
.ta-wecom-panel.open { width: 300px; min-width: 300px; }
.ta-wecom-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; font-size: 14px; font-weight: 600; color: var(--text-primary, #e9edef); border-bottom: 1px solid rgba(255,255,255,0.06); }
.ta-wecom-close { width: 24px; height: 24px; border-radius: 50%; border: none; background: rgba(255,255,255,0.06); color: var(--text-secondary, #8696a0); font-size: 14px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
.ta-wecom-close:hover { background: rgba(255,255,255,0.12); }
.ta-wecom-body { flex: 1; overflow-y: auto; padding: 16px; }
.ta-wecom-status { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-radius: 8px; background: rgba(37,211,102,0.1); color: #25d366; font-size: 13px; font-weight: 600; margin-bottom: 12px; }
.ta-wecom-status-dot { width: 8px; height: 8px; border-radius: 50%; background: #25d366; }
.ta-wecom-meta { margin-bottom: 12px; }
.ta-wecom-meta-row { display: flex; justify-content: space-between; gap: 8px; padding: 6px 0; font-size: 13px; color: var(--text-secondary, #8696a0); border-bottom: 1px solid rgba(255,255,255,0.05); }
.ta-wecom-meta-row .mono { font-family: ui-monospace, monospace; color: var(--text-primary, #e9edef); word-break: break-all; text-align: right; }
.ta-wecom-hint { font-size: 12px; color: var(--text-secondary, #8696a0); line-height: 1.7; margin: 0 0 8px; }
.ta-wecom-link { color: #4a9eff; font-size: 13px; text-decoration: none; display: inline-block; margin-bottom: 12px; }
.ta-wecom-field { margin-bottom: 12px; }
.ta-wecom-field label { display: block; font-size: 12px; color: var(--text-secondary, #8696a0); margin-bottom: 6px; }
.ta-wecom-field input { width: 100%; padding: 9px 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.2); color: var(--text-primary, #e9edef); font-size: 13px; outline: none; box-sizing: border-box; }
.ta-wecom-test { padding: 8px 12px; border-radius: 8px; font-size: 13px; margin: 4px 0 12px; }
.ta-wecom-test.ok { background: rgba(37,211,102,0.1); color: #25d366; }
.ta-wecom-test.err { background: rgba(244,67,54,0.1); color: #f44336; }
.ta-wecom-actions { display: flex; gap: 8px; margin-top: 4px; }
.ta-wecom-btn { flex: 1; padding: 9px 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.06); color: var(--text-primary, #e9edef); font-size: 13px; cursor: pointer; font-family: inherit; }
.ta-wecom-btn:hover { background: rgba(255,255,255,0.12); }
.ta-wecom-btn.primary { background: var(--accent, #4a9eff); border-color: transparent; color: #fff; }
.ta-wecom-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.ta-file-panel-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 16px; font-size: 14px; font-weight: 600;
  color: var(--text-primary, #e9edef); border-bottom: 1px solid rgba(255,255,255,0.06);
}
.ta-file-panel-close {
  width: 24px; height: 24px; border-radius: 50%; border: none;
  background: rgba(255,255,255,0.06); color: var(--text-secondary, #8696a0);
  font-size: 14px; cursor: pointer; display: flex; align-items: center; justify-content: center;
}
.ta-file-panel-close:hover { background: rgba(255,255,255,0.12); }
.ta-file-panel-tabs { display: flex; gap: 0; padding: 10px 16px 0; }
.ta-file-panel-tabs button {
  flex: 1; padding: 8px; border: none; background: transparent;
  color: var(--text-secondary, #8696a0); font-size: 13px; cursor: pointer;
  border-bottom: 2px solid transparent; transition: all 0.2s;
}
.ta-file-panel-tabs button.active { color: #60a5fa; border-bottom-color: #3b82f6; }
.ta-file-panel-search { padding: 10px 16px; }
.ta-file-panel-search input {
  width: 100%; padding: 8px 12px; border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.2);
  color: var(--text-primary, #e9edef); font-size: 13px; outline: none; box-sizing: border-box;
}
.ta-file-panel-search input::placeholder { color: var(--text-secondary, #8696a0); }
.ta-file-panel-content { flex: 1; overflow-y: auto; padding: 8px 16px; }
.ta-file-empty { display: flex; flex-direction: column; align-items: center; padding: 40px 0; color: var(--text-secondary, #8696a0); }
.ta-file-empty p { margin: 4px 0; }
.ta-file-panel-footer { padding: 10px 16px; font-size: 12px; color: var(--text-secondary, #8696a0); border-top: 1px solid rgba(255,255,255,0.06); }
/* 模型选择弹窗 */
.ta-model-overlay {
  position: absolute; bottom: 100%; left: 0; right: 0;
  z-index: 1000;
  pointer-events: none;
}
.ta-model-backdrop {
  position: fixed; inset: 0; z-index: 2000;
  background: transparent; pointer-events: auto;
}
.ta-model-overlay .ta-model-popup {
  pointer-events: auto;
}
.ta-model-popup {
  background: var(--mgmt-card-bg, #1e252b); border-radius: 0;
  border: none; border-top: 1px solid rgba(255,255,255,0.08);
  box-shadow: 0 -4px 24px rgba(0,0,0,0.3);
  width: 100%; max-height: 420px; overflow: hidden; display: flex; flex-direction: column;
}
/* 智能选择行 */
.ta-model-auto-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 16px; margin: 6px 10px 2px; border-radius: 10px;
  background: rgba(37,211,102,0.08); border: 1px solid rgba(37,211,102,0.18);
}
.ta-model-auto-info { display: flex; align-items: center; gap: 10px; }
.ta-model-auto-icon { font-size: 22px; }
.ta-model-auto-title { font-size: 14px; font-weight: 600; color: var(--text-primary, #e9edef); }
.ta-model-auto-desc { font-size: 11px; color: var(--text-secondary, #8696a0); margin-top: 1px; }
/* Toggle开关 */
.ta-model-toggle {
  width: 38px; height: 18px; min-width: 38px; border-radius: 999px; border: none; cursor: pointer;
  background: #3a3f45; position: relative; transition: background 0.25s ease; flex-shrink: 0;
  padding: 0; outline: none; -webkit-appearance: none; appearance: none;
  box-sizing: border-box;
  display: block;
}
.ta-model-toggle.on { background: #25D366; }
.ta-model-toggle-knob {
  width: 12px; height: 12px; border-radius: 50%; background: #fff;
  position: absolute; top: 0; bottom: 0; left: 3px; margin: auto 0; transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 2px 4px rgba(0,0,0,0.25); box-sizing: border-box;
}
.ta-model-toggle.on .ta-model-toggle-knob { transform: translateX(20px); }
/* 模型描述 */
.ta-model-item-content { flex: 1; min-width: 0; }
.ta-model-item-header { display: flex; align-items: center; gap: 6px; }
.ta-model-desc { font-size: 11px; color: var(--text-secondary, #8696a0); margin-top: 2px; line-height: 1.3; }
.ta-model-tabs { display: none; }
.ta-model-group-title { padding: 12px 16px 4px; font-size: 12px; color: var(--text-secondary, #8696a0); }
.ta-model-list { flex: 1; min-height: 0; overflow-y: auto; -webkit-overflow-scrolling: touch; padding: 2px 4px; }
.ta-model-item {
  display: flex; align-items: center; gap: 10px; padding: 10px 12px;
  border-radius: 10px; cursor: pointer; transition: background 0.15s;
}
.ta-model-item:hover { background: rgba(255,255,255,0.06); }
.ta-model-item.active { background: rgba(59,130,246,0.1); }
.ta-model-icon { font-size: 20px; }
.ta-model-name { flex: 1; font-size: 14px; color: var(--text-primary, #e9edef); }
.ta-model-tag { font-size: 11px; padding: 2px 6px; border-radius: 4px; font-weight: 600; }
.ta-model-tag.new-tag { background: rgba(37,211,102,0.15); color: #25d366; }
.ta-model-tag.special-tag { background: rgba(251,191,36,0.15); color: #fbbf24; }
.ta-model-check { color: #25d366; font-size: 16px; font-weight: bold; }
.ta-model-add {
  padding: 12px 16px; border-top: 1px solid rgba(255,255,255,0.08);
  text-align: center; color: #60a5fa; font-size: 13px; cursor: pointer; transition: background 0.2s;
}
.ta-model-add:hover { background: rgba(59,130,246,0.08); }

/* ===== 移动端：模型弹窗底部抽屉化 ===== */
@media (max-width: 768px) {
  .ta-model-popup {
    position: fixed; bottom: 0; left: 0; right: 0;
    width: 100%; max-width: 100%; max-height: 72vh;
    border-radius: 16px 16px 0 0;
    border-top: 1px solid rgba(255,255,255,0.1);
    z-index: 2001;
    animation: taModelSlideUp 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .ta-model-auto-row { margin: 10px 12px 6px; padding: 12px 14px; }
  .ta-model-auto-title { font-size: 14px; }
  .ta-model-auto-desc { font-size: 12px; }
  .ta-model-name { font-size: 15px; }
  .ta-model-desc { font-size: 12px; }
  .ta-model-item { padding: 12px 14px; }
  .ta-model-list { padding-bottom: calc(20px + env(safe-area-inset-bottom, 0px)); }
  .ta-model-toggle { width: 50px; height: 30px; min-width: 50px; padding: 3px; }
  .ta-model-toggle-knob { width: 24px; height: 24px; }
  .ta-model-toggle.on .ta-model-toggle-knob { transform: translateX(22px); }
}
@keyframes taModelSlideUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}



/* ===== V1.0 客户选择面板 ===== */
.ta-header-cust { display: flex; align-items: center; gap: 6px; margin-left: auto; padding-right: 12px; }
.ta-cust-btn { background: rgba(37,211,102,0.12); color: #25d366; border: 1px solid rgba(37,211,102,0.35); border-radius: 14px; padding: 4px 10px; font-size: 12px; cursor: pointer; white-space: nowrap; transition: background .2s; }
.ta-cust-btn:hover { background: rgba(37,211,102,0.22); }
.ta-wx-link-btn { background: #07c160 !important; color: #fff !important; border-color: #07c160 !important; font-weight: 600; padding: 6px 14px; font-size: 13px; box-shadow: 0 2px 8px rgba(7,193,96,.4); animation: taWxPulse 2s infinite; }
.ta-wx-link-btn:hover { background: #06ad56 !important; }
@keyframes taWxPulse { 0%,100% { box-shadow: 0 2px 8px rgba(7,193,96,.4); } 50% { box-shadow: 0 2px 16px rgba(7,193,96,.75); } }
.ta-nav-wx-btn { background: rgba(7,193,96,.10) !important; }
.ta-nav-wx-btn:hover { background: rgba(7,193,96,.20) !important; }
.ta-nav-wx-btn .p-icon, .ta-nav-wx-btn span { color: #07c160 !important; }
.ta-nav-wx-btn:hover .p-icon, .ta-nav-wx-btn:hover span { color: #06ad56 !important; }
.platform-collapsed .ta-nav-wx-btn { position: relative; }
.platform-collapsed .ta-nav-wx-btn::after { content:''; position:absolute; top:8px; right:8px; width:8px; height:8px; border-radius:50%; background:#07c160; animation: taWxPulse 2s infinite; }
.mdp-item.ta-nav-wx-btn { background: rgba(7,193,96,.10); border-radius: 8px; margin: 2px 8px; width: auto; }
.ta-wx-entry { display: flex; align-items: center; gap: 14px; width: 100%; max-width: 480px; margin: 0 0 28px; padding: 16px 18px; background: linear-gradient(135deg, rgba(7,193,96,.18), rgba(7,193,96,.06)); border: 1px solid rgba(7,193,96,.45); border-radius: 14px; cursor: pointer; transition: transform .15s, box-shadow .15s; }
.ta-wx-entry:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(7,193,96,.25); }
.ta-wx-entry-icon { font-size: 34px; flex-shrink: 0; }
.ta-wx-entry-txt { text-align: left; flex: 1; }
.ta-wx-entry-title { font-size: 15px; font-weight: 600; color: var(--text-primary, #e9edef); margin-bottom: 4px; }
.ta-wx-entry-sub { font-size: 12px; color: var(--text-secondary, #8696a0); line-height: 1.5; }
.ta-wx-entry-btn { flex-shrink: 0; background: #07c160; color: #fff; font-size: 13px; font-weight: 600; padding: 8px 16px; border-radius: 20px; white-space: nowrap; }
.ta-cust-tag { background: rgba(37,211,102,0.15); color: #25d366; border: 1px solid rgba(37,211,102,0.4); border-radius: 14px; padding: 4px 10px; font-size: 12px; cursor: pointer; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ta-cust-clear { color: #f87171; cursor: pointer; font-size: 13px; padding: 2px 5px; border-radius: 50%; }
.ta-cust-clear:hover { background: rgba(248,113,113,0.18); }
.ta-cust-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 1000; display: flex; justify-content: flex-end; }
.ta-cust-panel { width: 320px; max-width: 90vw; height: 100%; background: #1a2733; border-left: 1px solid rgba(255,255,255,0.1); display: flex; flex-direction: column; animation: taSlideInRight .2s ease; }
@keyframes taSlideInRight { from { transform: translateX(40px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
.ta-cust-panel-header { display: flex; justify-content: space-between; align-items: center; padding: 14px 16px; border-bottom: 1px solid rgba(255,255,255,0.08); font-weight: 600; color: #e5e7eb; }
.ta-cust-panel-close { background: none; border: none; color: #9ca3af; font-size: 16px; cursor: pointer; }
.ta-cust-panel-close:hover { color: #fff; }
.ta-cust-search { padding: 12px 16px; }
.ta-cust-search input { width: 100%; padding: 8px 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.06); color: #e5e7eb; font-size: 13px; outline: none; }
.ta-cust-search input:focus { border-color: #25d366; }
.ta-cust-general { display: flex; align-items: center; gap: 8px; padding: 10px 16px; cursor: pointer; color: #d1d5db; }
.ta-cust-general:hover { background: rgba(255,255,255,0.05); }
.ta-cust-general.active { color: #25d366; }
.ta-cust-general-icon { font-size: 16px; }
.ta-cust-check { margin-left: auto; color: #25d366; font-weight: bold; }
.ta-cust-group-title { padding: 10px 16px 6px; font-size: 12px; color: #6b7280; }
.ta-cust-list { flex: 1; overflow-y: auto; }
.ta-cust-item { display: flex; align-items: center; gap: 10px; padding: 9px 16px; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.04); }
.ta-cust-item:hover { background: rgba(255,255,255,0.05); }
.ta-cust-item.active { background: rgba(37,211,102,0.1); }
.ta-cust-item-avatar { width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg,#2563eb,#7c3aed); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0; }
.ta-cust-item-info { flex: 1; min-width: 0; }
.ta-cust-item-name { font-size: 13px; color: #e5e7eb; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ta-cust-item-meta { font-size: 11px; color: #6b7280; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ta-cust-level { display: inline-block; margin-left: 4px; padding: 0 4px; border-radius: 4px; background: rgba(59,130,246,0.2); color: #60a5fa; font-size: 10px; }
.ta-cust-empty { padding: 30px 16px; text-align: center; color: #6b7280; font-size: 13px; }

/* ===== 设置-我的积分 ===== */
.account-settings { padding: 4px 2px; }
.account-settings h2 { font-size: 18px; margin: 0 0 6px; color: var(--text-primary, #e5e7eb); }
.account-settings .section-desc { color: var(--text-secondary, #8696a0); font-size: 13px; margin: 0 0 20px; }
.credits-balance-card { background: linear-gradient(135deg, #3b82f6, #8b5cf6); border-radius: 14px; padding: 24px; color: #fff; text-align: center; margin-bottom: 18px; }
.credits-balance-num { font-size: 40px; font-weight: 700; line-height: 1.1; }
.credits-balance-label { font-size: 13px; opacity: .85; margin-top: 4px; }
.credits-balance-actions { display: flex; gap: 10px; justify-content: center; margin-top: 18px; }
.credits-btn-primary { padding: 9px 22px; border: none; border-radius: 8px; background: #fff; color: #4f46e5; font-size: 14px; font-weight: 600; cursor: pointer; }
.credits-btn-plain { padding: 9px 22px; border: 1px solid rgba(255,255,255,.6); border-radius: 8px; background: transparent; color: #fff; font-size: 14px; cursor: pointer; }
.credits-tips { font-size: 12px; color: var(--text-secondary, #8696a0); line-height: 1.9; }

/* ===== WA 账号体验（对标竞品） ===== */
.wa-account-list .wa-account-item {
  display: flex; flex-direction: column; gap: 6px;
  padding: 10px 12px; border-radius: 8px; cursor: pointer;
  position: relative; margin-bottom: 4px; min-height: 76px;
  border: 1px solid var(--sidebar-border, #2a3942);
  background: var(--panel-bg, #111b21);
}
.wa-new-session-btn {
  display: flex; align-items: center; justify-content: center; gap: 6px;
  width: 100%; padding: 12px; margin-bottom: 8px;
  background: #25D366; color: #fff; font-size: 14px; font-weight: 600;
  border-radius: 12px; cursor: pointer;
  transition: background 0.2s, transform 0.1s;
  box-shadow: 0 2px 8px rgba(37,211,102,0.3);
}
.wa-new-session-btn:hover {
  background: #20bd5a; transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(37,211,102,0.4);
}
.wa-new-session-btn:active { transform: translateY(0); }
.acc-top-row {
  display: flex; align-items: center; gap: 10px; width: 100%;
}
.acc-actions {
  display: flex; justify-content: center; gap: 8px;
  opacity: 0; transition: opacity 0.2s;
  margin-top: auto; padding-top: 2px;
}
.wa-account-item:hover .acc-actions { opacity: 1; }
.acc-action-btn {
  width: 32px; height: 32px;
  border: 1px solid #d1d5db; border-radius: 50%;
  background: #fff; color: #4b5563; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.15s; box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}
.acc-action-btn:hover { background: #f3f4f6; color: #1f2937; border-color: #9ca3af; }
.acc-action-btn.acc-action-danger:hover { background: #fee2e2; color: #dc2626; border-color: #fca5a5; }
[data-theme="dark"] .acc-action-btn { background: #2a3942; color: #d1d7db; border-color: #3b4a54; }
[data-theme="dark"] .acc-action-btn:hover { background: #36454f; color: #fff; }
[data-theme="dark"] .acc-action-btn.acc-action-danger:hover { background: rgba(239,68,68,0.2); color: #f87171; border-color: rgba(239,68,68,0.5); }

/* 账号代理配置抽屉 */
.config-panel-overlay {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.3); z-index: 9999;
  display: flex; justify-content: flex-end;
}
.config-panel-drawer {
  width: 420px; max-width: 90vw; height: 100vh;
  background: var(--panel-bg, #202c33);
  border-left: 1px solid var(--sidebar-border, #313d45);
  box-shadow: -4px 0 24px rgba(0,0,0,0.3);
  display: flex; flex-direction: column; overflow: hidden;
}
.config-panel-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 20px; border-bottom: 1px solid var(--sidebar-border, #313d45);
}
.config-panel-header h3 { font-size: 15px; font-weight: 600; color: var(--text-primary, #e9edef); margin: 0; }
.config-panel-close { font-size: 18px; color: var(--text-secondary, #8696a0); cursor: pointer; padding: 2px 8px; border-radius: 6px; transition: background 0.2s; }
.config-panel-close:hover { background: rgba(255,255,255,0.05); }
.config-panel-body { flex: 1; overflow-y: auto; padding: 20px; }
.cp-section-title { font-size: 14px; font-weight: 600; color: var(--text-primary, #e9edef); margin-bottom: 16px; }
.cp-field { margin-bottom: 16px; }
.cp-field label { display: block; font-size: 13px; color: var(--text-primary, #e9edef); margin-bottom: 6px; }
.cp-input, .cp-select, .cp-textarea {
  width: 100%; padding: 9px 12px;
  background: var(--bg-input, #2a3942);
  border: 1px solid var(--sidebar-border, #313d45);
  border-radius: 6px; color: var(--text-primary, #e9edef);
  font-size: 13px; outline: none; box-sizing: border-box;
}
[data-theme="light"] .config-panel-drawer .cp-input,
[data-theme="light"] .config-panel-drawer .cp-select,
[data-theme="light"] .config-panel-drawer .cp-textarea {
  background: #ffffff;
  border-color: #d5dbe0;
  color: #111b21;
}
[data-theme="light"] .config-panel-drawer .cp-input::placeholder,
[data-theme="light"] .config-panel-drawer .cp-select::placeholder {
  color: #8696a0;
}
[data-theme="light"] .config-panel-drawer .cp-input:focus,
[data-theme="light"] .config-panel-drawer .cp-select:focus,
[data-theme="light"] .config-panel-drawer .cp-textarea:focus {
  border-color: #00a884;
}
.cp-input:focus, .cp-select:focus, .cp-textarea:focus { border-color: #00a884; }
.cp-test-result { padding: 10px 12px; border: 1px solid; border-radius: 8px; font-size: 13px; margin-bottom: 16px; }
.cp-btn { padding: 9px 18px; border: none; border-radius: 6px; font-size: 13px; cursor: pointer; transition: background 0.2s; }
.cp-btn-sm { padding: 6px 14px; font-size: 12px; }
.cp-btn-primary { background: #00a884; color: #fff; }
.cp-btn-primary:hover { background: #06cf9c; }
.cp-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.slide-right-enter-active, .slide-right-leave-active { transition: transform 0.3s ease, opacity 0.3s ease; }
.slide-right-enter-from { transform: translateX(100%); opacity: 0; }
.slide-right-leave-to { transform: translateX(100%); opacity: 0; }

/* 无账号欢迎页 */
.no-account-empty {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 40px 32px; max-width: 480px; text-align: center;
  animation: fadeInUp 0.5s ease-out;
}
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}
.no-account-icon-wrap {
  width: 110px; height: 110px; border-radius: 50%;
  background: linear-gradient(135deg, rgba(37,211,102,0.08) 0%, rgba(37,211,102,0.15) 100%);
  display: flex; align-items: center; justify-content: center; margin-bottom: 28px;
}
.no-account-wa-icon { filter: drop-shadow(0 2px 4px rgba(37,211,102,0.15)); }
.no-account-title {
  font-size: 24px; font-weight: 600; color: var(--text-primary, #111b21);
  margin-bottom: 12px; letter-spacing: -0.3px;
}
.no-account-subtitle {
  font-size: 14px; color: var(--text-secondary, #667781);
  margin-bottom: 32px; line-height: 1.7; max-width: 380px;
  word-break: keep-all; white-space: normal; text-align: center;
}
.no-account-cta {
  background: #25D366; color: #fff; border: none; border-radius: 24px;
  padding: 12px 32px; font-size: 15px; font-weight: 600; cursor: pointer;
  transition: all 0.2s ease; box-shadow: 0 4px 12px rgba(37,211,102,0.25);
}
.no-account-cta:hover { background: #1fb855; transform: translateY(-1px); box-shadow: 0 6px 20px rgba(37,211,102,0.3); }
.no-account-cta:active { transform: translateY(0); }

/* ===== TG 欢迎页（无账号时） ===== */
.tg-welcome-icon-wrap { background: linear-gradient(135deg, rgba(42,171,238,0.08) 0%, rgba(42,171,238,0.15) 100%); }
.no-account-tg-icon { filter: drop-shadow(0 2px 4px rgba(42,171,238,0.2)); }
.tg-welcome-cta { background: #2AABEE; box-shadow: 0 4px 12px rgba(42,171,238,0.25); }
.tg-welcome-cta:hover { background: #2296d3; box-shadow: 0 6px 20px rgba(42,171,238,0.3); }
html[data-theme="dark"] .tg-welcome-icon-wrap { background: linear-gradient(135deg, rgba(42,171,238,0.12) 0%, rgba(42,171,238,0.2) 100%); }

/* ===== 登录/欢迎态隐藏客户列表栏（Bug4/Bug5） ===== */
.col-chatlist.wa-hidden { display: none; }


/* ====== L2: Business Confirmation Banner ====== */
.biz-confirm-banner {
  position: relative;
  z-index: 100;
  background: linear-gradient(135deg, #1a2332 0%, #0d1b2a 100%);
  border-bottom: 1px solid rgba(37, 211, 102, 0.3);
  box-shadow: 0 2px 12px rgba(0,0,0,0.3);
  animation: bizConfirmSlideDown 0.3s ease-out;
  flex-shrink: 0;
}

@keyframes bizConfirmSlideDown {
  from { transform: translateY(-100%); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

.biz-confirm-inner {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  max-width: 100%;
}

.biz-confirm-icon {
  font-size: 20px;
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(37, 211, 102, 0.15);
  border-radius: 50%;
}

.biz-confirm-text {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.biz-confirm-label {
  font-size: 13px;
  color: #e9edef;
  font-weight: 500;
  display: flex;
  align-items: center;
  min-width: 0;
}

.biz-confirm-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.biz-confirm-q {
  flex-shrink: 0;
}

.biz-confirm-counter {
  font-size: 11px;
  color: #8696a0;
  background: rgba(255,255,255,0.08);
  padding: 2px 8px;
  border-radius: 10px;
  flex-shrink: 0;
}

.biz-confirm-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.biz-confirm-btn {
  padding: 6px 14px;
  border-radius: 18px;
  border: none;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.biz-confirm-phone {
  font-size: 12px;
  color: #9fb3c8;
  font-weight: 400;
}

.biz-confirm-view {
  background: rgba(255,255,255,0.08);
  color: #e9edef;
  border: 1px solid rgba(255,255,255,0.2);
}

.biz-confirm-view:hover {
  background: rgba(255,255,255,0.14);
}

.biz-confirm-yes {
  background: #25D366;
  color: #0b141a;
}

.biz-confirm-yes:hover {
  background: #1fa855;
  transform: scale(1.02);
}

.biz-confirm-no {
  background: rgba(255,255,255,0.08);
  color: #8696a0;
  border: 1px solid rgba(255,255,255,0.12);
}

.biz-confirm-no:hover {
  background: rgba(255,255,255,0.12);
  color: #e9edef;
}

.biz-confirm-slide-enter-active {
  animation: bizConfirmSlideDown 0.3s ease-out;
}
.biz-confirm-slide-leave-active {
  animation: bizConfirmSlideDown 0.3s ease-out reverse;
}

@media (max-width: 768px) {
  .biz-confirm-inner {
    flex-wrap: wrap;
    gap: 8px;
    padding: 8px 12px;
  }
  .biz-confirm-text {
    flex-basis: calc(100% - 48px);
  }
  .biz-confirm-actions {
    width: 100%;
    justify-content: flex-end;
  }
  .biz-confirm-btn {
    padding: 5px 12px;
    font-size: 11px;
  }
}


.ta-task-panel {
  width: 0; min-width: 0; background: var(--mgmt-card-bg, #1e252b);
  border-left: 1px solid rgba(255,255,255,0.06); display: flex; flex-direction: column;
  overflow: hidden; transition: width 0.3s ease, min-width 0.3s ease;
}
.ta-task-panel.open { width: 280px; min-width: 280px; }
.ta-task-panel-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 16px; font-size: 14px; font-weight: 600;
  color: var(--text-primary, #e9edef); border-bottom: 1px solid rgba(255,255,255,0.06);
}
.ta-task-panel-close {
  width: 24px; height: 24px; border-radius: 50%; border: none;
  background: rgba(255,255,255,0.06); color: var(--text-secondary, #8696a0);
  font-size: 14px; cursor: pointer; display: flex; align-items: center; justify-content: center;
}
.ta-task-panel-close:hover { background: rgba(255,255,255,0.12); }
.ta-task-panel-body { flex: 1; overflow-y: auto; padding: 16px; }
.ta-task-card {
  background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
  border-radius: 10px; padding: 14px;
}
.ta-task-card-name { font-size: 15px; font-weight: 600; color: var(--text-primary, #e9edef); margin-bottom: 10px; }
.ta-task-card-status {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 12px; color: #4ade80; background: rgba(74,222,128,0.12);
  border: 1px solid rgba(74,222,128,0.25); padding: 3px 10px; border-radius: 999px;
  margin-bottom: 12px;
}
.ta-task-dot { width: 6px; height: 6px; border-radius: 50%; background: #4ade80; }
.ta-task-card-label { font-size: 11px; color: var(--text-secondary, #8696a0); margin-bottom: 4px; }
.ta-task-card-instr {
  font-size: 13px; color: var(--text-primary, #e9edef); line-height: 1.6;
  background: rgba(0,0,0,0.2); border-radius: 8px; padding: 10px 12px; word-break: break-all;
}
.ta-task-empty { display: flex; flex-direction: column; align-items: center; padding: 40px 0; color: var(--text-secondary, #8696a0); }
.ta-task-empty p { margin: 4px 0; }
.ta-task-terminate {
  display: block; width: 100%; margin-top: 14px; padding: 9px 12px;
  border-radius: 8px; border: 1px solid rgba(244,63,94,0.35);
  background: rgba(244,63,94,0.12); color: #f87171;
  font-size: 13px; font-weight: 500; cursor: pointer; font-family: inherit;
  transition: background .15s, color .15s;
}
.ta-task-terminate:hover { background: rgba(244,63,94,0.22); color: #fca5a5; }

/* TG 无会话包装：撑满聊天区，内部欢迎页/登录卡垂直居中 */
.tg-no-session-wrap {
  flex: 1; display: flex; flex-direction: column; min-height: 0; overflow: hidden;
}

/* ── TG 登录欢迎页 ── */
.col-chatlist.tg-hidden { display: none; }
.tg-login-welcome {
  background: var(--chat-bg, #0b141a);
  padding: 24px;
}
.tg-login-card {
  width: 100%; max-width: 420px;
  background: #fff; border-radius: 16px;
  box-shadow: 0 8px 30px rgba(0,0,0,.22);
  padding: 30px 28px 24px;
  color: #1a1a1a;
  text-align: center;
}
.tg-login-logo-row { display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 16px; }
.tg-login-logo-mini {
  width: 32px; height: 32px; border-radius: 50%;
  background: #3390ec; display: inline-flex; align-items: center; justify-content: center;
}
.tg-login-brand { font-size: 17px; font-weight: 700; color: #1a1a1a; }
.tg-qr-title { font-size: 19px; font-weight: 700; margin: 0 0 6px; color: #1a1a1a; line-height: 1.35; }
.tg-qr-sub { font-size: 13.5px; color: #707579; margin: 0 0 20px; line-height: 1.55; }
.tg-qr-box {
  width: 224px; height: 224px; margin: 0 auto 22px;
  padding: 10px; background: #fff; border: 1px solid #e4e7ea; border-radius: 14px;
  position: relative; display: flex; align-items: center; justify-content: center;
  box-shadow: 0 1px 4px rgba(0,0,0,.05);
}
.tg-qr-box svg { width: 100%; height: 100%; display: block; }
.tg-qr-badge {
  position: absolute; bottom: -11px; left: 50%; transform: translateX(-50%);
  background: #fff; border: 1px solid #e4e7ea; border-radius: 999px;
  padding: 3px 11px; font-size: 10.5px; color: #707579; white-space: nowrap;
}
.tg-qr-steps { list-style: none; margin: 0 0 20px; padding: 0; display: flex; flex-direction: column; gap: 9px; text-align: left; }
.tg-qr-steps li { display: flex; gap: 11px; align-items: flex-start; font-size: 13.5px; line-height: 1.5; color: #1a1a1a; }
.tg-qr-steps .tg-num {
  flex: none; width: 21px; height: 21px; border-radius: 50%;
  background: #e8f3fe; color: #3390ec; font-size: 11.5px; font-weight: 700;
  display: inline-flex; align-items: center; justify-content: center; margin-top: 1px;
}
.tg-switch-link {
  background: none; border: none; cursor: pointer;
  color: #3390ec; font-size: 12.5px; font-weight: 600;
  letter-spacing: .3px; text-transform: uppercase; padding: 6px 10px; border-radius: 8px;
  font-family: inherit; transition: background .15s ease;
}
.tg-switch-link:hover { background: #e8f3fe; }
.tg-switch-link small { font-size: 11px; color: #a2a9b0; font-weight: 500; text-transform: none; letter-spacing: 0; margin-right: 6px; }
.tg-logo-big {
  width: 70px; height: 70px; border-radius: 18px;
  background: #3390ec; display: inline-flex; align-items: center; justify-content: center;
  margin-bottom: 14px; box-shadow: 0 8px 20px rgba(51,144,236,.28);
}
.tg-phone-title { font-size: 21px; font-weight: 700; margin: 0 0 4px; color: #1a1a1a; }
.tg-phone-sub { font-size: 13px; color: #707579; margin: 0 0 20px; line-height: 1.5; }
.tg-phone-wrap { display: flex; flex-direction: column; align-items: center; }
.tg-country-field {
  width: 100%; display: flex; align-items: center; gap: 9px;
  background: #fff; border: 1.5px solid #cfd3d8; border-radius: 10px;
  padding: 11px 13px; cursor: pointer; margin-bottom: 10px;
  transition: border-color .15s ease, box-shadow .15s ease;
}
.tg-country-field:hover { border-color: #3390ec; }
.tg-country-field.open { border-color: #3390ec; box-shadow: 0 0 0 3px rgba(51,144,236,.12); }
.tg-flag { font-size: 19px; line-height: 1; flex: none; }
.tg-cname { flex: 1; font-size: 14.5px; font-weight: 500; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #1a1a1a; }
.tg-ccode { color: #707579; font-size: 13.5px; font-weight: 500; }
.tg-chev { color: #a2a9b0; display: inline-flex; transition: transform .18s ease; }
.tg-country-field.open .tg-chev { transform: rotate(180deg); }
.tg-country-drop {
  width: 100%; background: #fff; border: 1px solid #e4e7ea; border-radius: 12px;
  box-shadow: 0 12px 32px rgba(0,0,0,.12); max-height: 250px;
  display: flex; flex-direction: column; overflow: hidden; margin-bottom: 10px;
  animation: tgDropIn .18s ease both;
}
@keyframes tgDropIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
.tg-drop-search { padding: 9px 11px; border-bottom: 1px solid #e4e7ea; flex: none; }
.tg-drop-search input {
  width: 100%; border: 1px solid #cfd3d8; border-radius: 8px;
  padding: 8px 11px; font-size: 13.5px; outline: none; box-sizing: border-box; font-family: inherit;
}
.tg-drop-search input:focus { border-color: #3390ec; }
.tg-drop-list { overflow-y: auto; flex: 1; }
.tg-drop-item {
  display: flex; align-items: center; gap: 11px;
  padding: 10px 13px; cursor: pointer; font-size: 14px;
  transition: background .12s ease;
}
.tg-drop-item:hover { background: #f1f4f7; }
.tg-drop-item.selected { background: #e8f3fe; color: #3390ec; font-weight: 600; }
.tg-drop-item .tg-flag { font-size: 18px; }
.tg-dname { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: left; }
.tg-dcode { color: #707579; font-size: 13px; }
.tg-drop-empty { padding: 18px; text-align: center; color: #707579; font-size: 13.5px; }
.tg-phone-field {
  width: 100%; display: flex; align-items: center;
  background: #fff; border: 1.5px solid #cfd3d8; border-radius: 10px;
  padding: 0 13px; height: 48px; margin-bottom: 15px;
  transition: border-color .15s ease, box-shadow .15s ease; box-sizing: border-box;
}
.tg-phone-field:focus-within { border-color: #3390ec; box-shadow: 0 0 0 3px rgba(51,144,236,.12); }
.tg-prefix { font-size: 14.5px; font-weight: 600; color: #1a1a1a; padding-right: 10px; border-right: 1px solid #e4e7ea; }
.tg-phone-field input {
  flex: 1; border: none; outline: none; font-size: 14.5px; padding: 0 12px; min-width: 0;
  background: transparent; color: #1a1a1a; font-family: inherit;
}
.tg-phone-field input::placeholder { color: #a2a9b0; }
.tg-keep-row {
  display: flex; align-items: center; gap: 8px; cursor: pointer;
  margin-bottom: 18px; user-select: none; font-size: 13.5px; color: #1a1a1a;
  align-self: flex-start; width: fit-content;
}
.tg-keep-row input { position: absolute; opacity: 0; pointer-events: none; }
.tg-check {
  width: 19px; height: 19px; border-radius: 6px; border: 1.5px solid #cfd3d8;
  display: inline-flex; align-items: center; justify-content: center; flex: none;
  transition: all .15s ease; background: #fff;
}
.tg-check svg { opacity: 0; transform: scale(.4); transition: all .15s ease; }
.tg-keep-row input:checked + .tg-check { background: #3390ec; border-color: #3390ec; }
.tg-keep-row input:checked + .tg-check svg { opacity: 1; transform: scale(1); }
.tg-next-btn {
  width: 100%; border: none; cursor: pointer;
  background: #3390ec; color: #fff;
  font-size: 14.5px; font-weight: 600; letter-spacing: .2px;
  border-radius: 10px; height: 48px; margin-bottom: 12px; font-family: inherit;
  transition: background .15s ease, transform .08s ease;
}
.tg-next-btn:hover { background: #2f86db; }
.tg-next-btn:active { transform: scale(.985); }
@media (prefers-reduced-motion: reduce) { .tg-country-drop { animation: none; } }
@media (max-width: 480px) {
  .tg-login-card { padding: 24px 18px 20px; }
  .tg-qr-box { width: 200px; height: 200px; }
}

/* ─── TG 登录欢迎页 · 夜间模式（对齐官方 TG） ─── */
html[data-theme="dark"] .tg-login-welcome {
  background: #0b141a;
}
html[data-theme="dark"] .tg-login-card {
  background: transparent;
  box-shadow: none;
  color: #fff;
}
html[data-theme="dark"] .tg-login-brand { color: #fff; }
html[data-theme="dark"] .tg-qr-title { color: #f5f7f8; }
html[data-theme="dark"] .tg-qr-sub { color: #9aa6ad; }
html[data-theme="dark"] .tg-qr-box {
  background: #fff;
  border: 1px solid rgba(255,255,255,.9);
  box-shadow: 0 4px 18px rgba(0,0,0,.45);
}
html[data-theme="dark"] .tg-qr-steps li { color: #dfe6ea; }
html[data-theme="dark"] .tg-qr-steps .tg-num {
  background: rgba(131,122,224,.22);
  color: #a79ff0;
}
html[data-theme="dark"] .tg-switch-link { color: #a79ff0; }
html[data-theme="dark"] .tg-switch-link:hover { background: rgba(131,122,224,.12); }
html[data-theme="dark"] .tg-switch-link small { color: #7a8690; }
html[data-theme="dark"] .tg-phone-title { color: #f5f7f8; }
html[data-theme="dark"] .tg-phone-sub { color: #9aa6ad; }
html[data-theme="dark"] .tg-country-field {
  background: #17212b;
  border-color: #2b3a45;
}
html[data-theme="dark"] .tg-country-field:hover { border-color: #a79ff0; }
html[data-theme="dark"] .tg-country-field.open { border-color: #a79ff0; box-shadow: 0 0 0 3px rgba(131,122,224,.18); }
html[data-theme="dark"] .tg-cname { color: #fff; }
html[data-theme="dark"] .tg-ccode { color: #9aa6ad; }
html[data-theme="dark"] .tg-chev { color: #7a8690; }
html[data-theme="dark"] .tg-country-drop {
  background: #17212b;
  border-color: #2b3a45;
  box-shadow: 0 12px 32px rgba(0,0,0,.5);
}
html[data-theme="dark"] .tg-drop-search { border-bottom-color: #2b3a45; }
html[data-theme="dark"] .tg-drop-search input {
  background: #0b141a;
  border-color: #2b3a45;
  color: #fff;
}
html[data-theme="dark"] .tg-drop-search input:focus { border-color: #a79ff0; }
html[data-theme="dark"] .tg-drop-item { color: #e9edef; }
html[data-theme="dark"] .tg-drop-item:hover { background: #202c33; }
html[data-theme="dark"] .tg-drop-item.selected { background: rgba(131,122,224,.16); color: #a79ff0; }
html[data-theme="dark"] .tg-dcode { color: #9aa6ad; }
html[data-theme="dark"] .tg-drop-empty { color: #7a8690; }
html[data-theme="dark"] .tg-phone-field {
  background: #17212b;
  border-color: #2b3a45;
}
html[data-theme="dark"] .tg-phone-field:focus-within { border-color: #a79ff0; box-shadow: 0 0 0 3px rgba(131,122,224,.18); }
html[data-theme="dark"] .tg-prefix { color: #fff; border-right-color: #2b3a45; }
html[data-theme="dark"] .tg-phone-field input { color: #fff; }
html[data-theme="dark"] .tg-phone-field input::placeholder { color: #7a8690; }
html[data-theme="dark"] .tg-keep-row { color: #dfe6ea; }
html[data-theme="dark"] .tg-check {
  background: #17212b;
  border-color: #2b3a45;
}
html[data-theme="dark"] .tg-keep-row input:checked + .tg-check {
  background: #8774e1;
  border-color: #8774e1;
}
html[data-theme="dark"] .tg-next-btn {
  background: #3390ec;
}
html[data-theme="dark"] .tg-next-btn:hover { background: #2f86db; }

</style>
