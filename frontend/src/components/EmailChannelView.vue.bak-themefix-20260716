<template>
  <div class="email-channel" :class="{ 'show-list': mobileView === 'list', 'show-detail': mobileView === 'detail' }">
    <!-- PC 三栏 / 移动端单栏切换 -->
    <div class="email-content">
      <!-- 账号栏 -->
      <div class="account-panel">
        <div class="epanel-header">
          <span class="epanel-title">邮箱账号</span>
          <button class="btn-icon" @click="showAddAccountDialog = true" title="添加邮箱">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
          </button>
        </div>
        <div v-if="accounts.length === 0" class="empty-state">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#8696a0" stroke-width="1.5"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
          <p style="font-size:12px;">还没有添加邮箱</p>
          <button class="btn-primary" style="font-size:12px;padding:6px 12px;" @click="showAddAccountDialog = true">添加邮箱账号</button>
        </div>
        <div v-else class="account-list-scroll">
          <div
            v-for="acc in accounts"
            :key="acc.id"
            class="account-item"
            :class="{ active: selectedAccountId === acc.id }"
            @click="selectAccount(acc)"
          >
            <div class="account-avatar" :style="{background: avatarColorFor(acc.email)}">{{ (acc.email||'?')[0].toUpperCase() }}</div>
            <div class="account-info">
              <div class="account-email">{{ acc.email }}</div>
              <div class="account-meta">
                <span class="account-status" :class="acc.status">{{ statusLabel(acc.status) }}</span>
                <span class="account-unread" v-if="accUnread(acc) > 0">{{ accUnread(acc) }}</span>
              </div>
            </div>
            <div class="account-actions">
              <button class="btn-icon" @click.stop="syncAccount(acc)" title="同步邮件" :disabled="syncing">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" :class="{ spinning: syncing && syncingId === acc.id }"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
              </button>
              <button class="btn-icon btn-danger" @click.stop="deleteAccount(acc)" title="删除邮箱">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 邮件列表栏 -->
      <div class="email-list-panel">
        <div class="epanel-header">
          <button v-if="isMobile" class="btn-icon mobile-back-btn" @click="mobileView = 'accounts'" title="返回">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          </button>
          <input v-model="emailSearch" placeholder="搜索邮件..." class="email-search" @input="debouncedSearch" />
          <button class="btn-icon" @click="loadEmails();loadAccounts();" title="刷新" :disabled="emailsLoading">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 4v6h6M23 20v-6h-6"/><path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15"/></svg>
          </button>
        </div>
        <div v-if="!selectedAccountId" class="empty-state"><p style="font-size:12px;">请选择一个邮箱账号</p></div>
        <template v-else>
          <div v-if="emailsLoading" class="empty-state"><p style="font-size:12px;">加载中...</p></div>
          <div v-else-if="emails.length === 0" class="empty-state"><p style="font-size:12px;">暂无邮件</p></div>
          <div v-else class="email-list">
            <div
              v-for="email in emails"
              :key="email.id"
              class="email-item"
              :class="{ active: selectedEmail && selectedEmail.id === email.id, unread: !email.read }"
              @click="selectEmail(email)"
            >
              <div class="email-sender-avatar" :style="{background: avatarColorFor(email.from||'?')}">{{ (extractEmailName(email.from)||'?')[0].toUpperCase() }}</div>
              <div class="email-preview">
                <div class="email-sender">{{ extractEmailName(email.from) }}</div>
                <div class="email-subject">{{ email.subject || '(无主题)' }}</div>
                <div class="email-body-preview">{{ stripHtml(email.body).substring(0, 50) }}</div>
              </div>
              <div class="email-time">{{ formatTime(email.createdAt) }}</div>
            </div>
          </div>
        </template>
      </div>

      <!-- 邮件详情栏 -->
      <div class="email-detail-panel">
        <div v-if="!selectedEmail" class="empty-state">
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#3b4a54" stroke-width="1.2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
          <p style="font-size:13px;color:#8696a0;">选择一封邮件查看详情</p>
        </div>
        <!-- PC端详情（桌面布局） -->
        <template v-else-if="!isMobile">
          <div class="email-detail-topbar">
            <div class="email-detail-subject">{{ selectedEmail.subject || '(无主题)' }}</div>
          </div>
          <div class="email-detail-meta">
            <div class="meta-row"><span class="meta-label">发件人</span><span class="meta-val">{{ selectedEmail.from }}</span></div>
            <div class="meta-row"><span class="meta-label">收件人</span><span class="meta-val">{{ selectedEmail.to }}</span></div>
            <div class="meta-row"><span class="meta-label">时间</span><span class="meta-val">{{ formatDateTime(selectedEmail.createdAt) }}</span></div>
            <div class="meta-row" v-if="selectedEmail.attachmentNames"><span class="meta-label">附件</span><span class="meta-val">{{ selectedEmail.attachmentNames }}</span></div>
          </div>
          <div class="email-detail-actions">
            <button class="btn-secondary" @click="translateEmail(selectedEmail)" :disabled="translating">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 8l6 6M4 14l6-6 2-3M2 5h12M7 2h1"/><path d="M22 22l-5-10-5 10M14 18h6"/></svg>
              {{ translating ? '翻译中...' : '翻译' }}
            </button>
            <button class="btn-secondary" @click="aiReplyPc(selectedEmail)" :disabled="generatingAI">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a10 10 0 100 20 10 10 0 000-20z"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
              {{ generatingAI ? '生成中...' : 'AI回复' }}
            </button>
            <button class="btn-secondary" @click="matchCustomer(selectedEmail)" :disabled="matchingCustomer">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
              {{ matchingCustomer ? '匹配中...' : '匹配客户' }}
            </button>
            <button class="btn-secondary" @click="toggleReply" v-if="!showReplyArea">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 00-4-4H4"/></svg>
              回复
            </button>
            <button class="btn-secondary" @click="forwardEmail">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 17 20 12 15 7"/><path d="M4 18v-2a4 4 0 0 1 4-4h12"/></svg>
              转发
            </button>
            <button class="btn-secondary" @click="deleteEmail(selectedEmail)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              删除
            </button>
          </div>
          <div v-if="selectedEmail.translation" class="email-translation">
            <div class="translation-label">翻译结果：</div>
            <div class="translation-text">{{ selectedEmail.translation }}</div>
          </div>
          <div class="email-body-scroll">
            <div class="email-body" v-html="selectedEmail.bodyHtml || formatText(selectedEmail.body)"></div>
          </div>
          <div v-if="showReplyArea" class="email-reply-area">
            <div v-if="aiReplies.length > 0" class="ai-replies">
              <div class="ai-replies-header">AI 建议回复：</div>
              <div v-for="(reply, idx) in aiReplies" :key="idx" class="ai-reply-option" @click="useAiReply(reply)">{{ reply }}</div>
            </div>
            <textarea v-model="replyText" class="reply-textarea" placeholder="输入回复内容..."></textarea>
            <div class="reply-actions">
              <button class="btn-secondary" @click="showReplyArea=false;replyText='';aiReplies=[]">取消</button>
              <button class="btn-primary" @click="sendReply" :disabled="sending">{{ sending ? '发送中...' : '发送邮件' }}</button>
            </div>
          </div>
        </template>
        <!-- 手机端详情（QQ邮箱风格） -->
        <template v-else>
          <!-- 顶部简洁导航：←返回 · 上下翻封 -->
          <div class="m-detail-nav">
            <button class="m-nav-btn" @click="mobileView = 'list'">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            </button>
            <div class="m-nav-actions">
              <button class="m-nav-btn" @click="prevEmail" :disabled="!hasPrevEmail" title="上一封">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"/></svg>
              </button>
              <button class="m-nav-btn" @click="nextEmail" :disabled="!hasNextEmail" title="下一封">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
            </div>
          </div>

          <!-- 邮件阅读主体（滚动区） -->
          <div class="m-detail-scroll" ref="mDetailScroll">
            <!-- 主题大字 -->
            <div class="m-subject">{{ selectedEmail.subject || '(无主题)' }}</div>

            <!-- 发件人一行：头像+姓名+邮箱 右「详情」 -->
            <div class="m-meta-row">
              <div class="m-avatar" :style="{background: avatarColorFor(selectedEmail.from||'?')}">{{ (extractEmailName(selectedEmail.from)||'?')[0].toUpperCase() }}</div>
              <div class="m-meta-main">
                <div class="m-sender-name">{{ extractEmailName(selectedEmail.from) }}</div>
                <div class="m-sender-time">{{ formatDateTime(selectedEmail.createdAt) }}</div>
              </div>
              <button class="m-detail-toggle" @click="showMetaDetail = !showMetaDetail">{{ showMetaDetail ? '收起' : '详情' }}</button>
            </div>

            <!-- 折叠的完整头信息 -->
            <div v-if="showMetaDetail" class="m-meta-detail">
              <div class="m-meta-line"><span class="m-meta-k">发件人：</span><span class="m-meta-v">{{ selectedEmail.from }}</span></div>
              <div class="m-meta-line"><span class="m-meta-k">收件人：</span><span class="m-meta-v">{{ selectedEmail.to }}</span></div>
              <div class="m-meta-line" v-if="selectedEmail.attachmentNames"><span class="m-meta-k">附件：</span><span class="m-meta-v">{{ selectedEmail.attachmentNames }}</span></div>
            </div>

            <!-- 附件（有附件时显示缩略条） -->
            <div v-if="selectedEmail.attachmentNames" class="m-attach-bar">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
              <span>{{ selectedEmail.attachmentNames }}</span>
            </div>

            <!-- 正文 -->
            <div class="m-body" v-html="selectedEmail.bodyHtml || formatText(selectedEmail.body)"></div>

            <!-- 中文译文（内联在正文下方） -->
            <div v-if="showTransPanel && selectedEmail.translation" class="m-trans-inline">
              <div class="m-trans-head-inline">
                <span class="m-trans-label">🌐 中文译文</span>
                <button class="m-trans-toggle" @click="showTransPanel=false">收起</button>
              </div>
              <div class="m-trans-body-inline">{{ selectedEmail.translation }}</div>
            </div>

            <!-- 底部留白，避免被悬浮按钮和底栏遮挡 -->
            <div style="height:120px;"></div>
          </div>

          <!-- 翻译胶囊浮层（右下） -->
          <button class="m-fab-translate" @click="onMobileTranslate" :disabled="translating">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 8l6 6M4 14l6-6 2-3M2 5h12M7 2h1"/><path d="M22 22l-5-10-5 10M14 18h6"/></svg>
            {{ translating ? '翻译中...' : (showTransPanel ? '收起译文' : '🌐 翻译') }}
          </button>

          <!-- 底部固定4图标栏（阅读态） -->
          <div class="m-bottom-bar">
            <button class="m-bar-btn" @click="deleteEmail(selectedEmail)">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              <span>删除</span>
            </button>
            <button class="m-bar-btn" @click="forwardEmail">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 17 20 12 15 7"/><path d="M4 18v-2a4 4 0 0 1 4-4h12"/></svg>
              <span>转发</span>
            </button>
            <button class="m-bar-btn m-bar-primary" @click="openReply(false)">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>
              <span>回复</span>
            </button>
            <button class="m-bar-btn" @click="showMoreMenu = !showMoreMenu">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
              <span>更多</span>
            </button>
          </div>
          <div v-if="showMoreMenu" class="m-more-mask" @click="showMoreMenu=false">
            <div class="m-more-menu" @click.stop>
              <button class="m-more-item" @click="matchCustomer(selectedEmail);showMoreMenu=false" :disabled="matchingCustomer">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="8.5" cy="7" r="4"/></svg>
                {{ matchingCustomer ? '匹配中...' : '匹配客户' }}
              </button>
              <button class="m-more-item" @click="markUnread;showMoreMenu=false">标为未读</button>
            </div>
          </div>
        </template>

        <!-- 手机端回复composer（全屏sheet） -->
        <div v-if="isMobile && showComposer" class="m-composer-mask" @click.self="closeComposer">
          <div class="m-composer">
            <div class="m-composer-grabber"></div>
            <div class="m-composer-nav">
              <button class="m-cancel-btn" @click="closeComposer">取消</button>
              <div class="m-composer-title">{{ composerMode === 'forward' ? '转发邮件' : '回复邮件' }}</div>
              <button class="m-send-btn" @click="sendMobileReply" :disabled="sending">{{ sending ? '...' : '发送' }}</button>
            </div>

            <div class="m-composer-scroll">
              <div class="m-composer-field"><span class="m-field-k">收件人：</span><span class="m-field-v">{{ composerTo }}</span></div>
              <div class="m-composer-field"><span class="m-field-k">主题：</span><span class="m-field-v">{{ composerSubject }}</span></div>
              <textarea
                v-model="replyText"
                class="m-composer-input"
                placeholder="输入回复内容..."
                ref="mComposerInput"
              ></textarea>

              <!-- 原邮件引用块 -->
              <div class="m-quote-block">
                <div class="m-quote-head">--- 原始邮件 ---</div>
                <div class="m-quote-line">发件人：{{ selectedEmail.from }}</div>
                <div class="m-quote-line">发送时间：{{ formatDateTime(selectedEmail.createdAt) }}</div>
                <div class="m-quote-line">收件人：{{ selectedEmail.to }}</div>
                <div class="m-quote-line">主题：{{ selectedEmail.subject }}</div>
                <div class="m-quote-body" v-html="selectedEmail.bodyHtml || formatText(selectedEmail.body)"></div>
              </div>
              <div style="height:80px;"></div>
            </div>

            <!-- 工具栏 -->
            <div class="m-composer-toolbar">
              <button class="m-tool-btn m-tool-ai" @click="triggerAiReplyComposer" :disabled="generatingAI">
                <span class="m-tool-icon">🤖</span>
                <span>{{ generatingAI ? '生成中' : 'AI回复' }}</span>
              </button>
              <button class="m-tool-btn" @click="onComposerEmoji" title="表情"><span class="m-tool-icon">🤪</span></button>
              <button class="m-tool-btn" @click="onComposerAttach" title="附件"><span class="m-tool-icon">📎</span></button>
              <button class="m-tool-btn" @click="onComposerSchedule" title="定时"><span class="m-tool-icon">⏰</span></button>
              <button class="m-tool-btn" @click="onComposerFormat" title="格式"><span class="m-tool-icon">T</span></button>
              <button class="m-tool-btn" @click="onComposerMore" title="更多"><span class="m-tool-icon">➕</span></button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 添加邮箱对话框 -->
    <div v-if="showAddAccountDialog" class="dialog-overlay" @click.self="closeAddDialog">
      <div class="dialog-box">
        <div class="dialog-header">
          <h3>添加邮箱账号</h3>
          <button class="btn-icon" @click="closeAddDialog">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="dialog-body">
          <div class="form-group">
            <label>邮箱类型</label>
            <select v-model="newAccount.provider" @change="onProviderChange">
              <option value="">请选择邮箱类型</option>
              <option value="gmail">Gmail</option>
              <option value="outlook">Outlook/Hotmail</option>
              <option value="qq">QQ邮箱</option>
              <option value="163">163网易邮箱</option>
              <option value="exmail">腾讯企业邮</option>
              <option value="aliyun">阿里企业邮</option>
              <option value="icloud">iCloud</option>
              <option value="yahoo">Yahoo</option>
              <option value="zoho">Zoho</option>
              <option value="custom">自定义/其他企业邮箱</option>
            </select>
            <div v-if="newAccount.provider && APP_PASSWORD_HINT[newAccount.provider]" class="form-hint">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2" style="display:inline;vertical-align:middle;margin-right:4px;"><path d="M12 9v4M12 17h.01"/><circle cx="12" cy="12" r="10"/></svg>
              {{ APP_PASSWORD_HINT[newAccount.provider] }}
            </div>
          </div>
          <div class="form-group">
            <label>邮箱地址</label>
            <input v-model="newAccount.email" type="email" placeholder="your@email.com" />
          </div>
          <div class="form-group">
            <label>密码 / 授权码</label>
            <input v-model="newAccount.password" type="password" placeholder="邮箱密码或应用专用密码" />
          </div>
          <div v-if="newAccount.provider === 'custom'" class="form-row">
            <div class="form-group">
              <label>IMAP 服务器</label>
              <input v-model="newAccount.imapHost" placeholder="imap.example.com" />
            </div>
            <div class="form-group">
              <label>IMAP 端口</label>
              <input v-model="newAccount.imapPort" type="number" placeholder="993" />
            </div>
          </div>
          <div v-if="newAccount.provider === 'custom'" class="form-row">
            <div class="form-group">
              <label>SMTP 服务器</label>
              <input v-model="newAccount.smtpHost" placeholder="smtp.example.com" />
            </div>
            <div class="form-group">
              <label>SMTP 端口</label>
              <input v-model="newAccount.smtpPort" type="number" placeholder="465" />
            </div>
          </div>
          <div v-if="addAccountError" class="form-error">{{ addAccountError }}</div>
          <div v-if="addAccountSuccess" class="form-success">{{ addAccountSuccess }}</div>
        </div>
        <div class="dialog-footer">
          <button class="btn-secondary" @click="closeAddDialog">取消</button>
          <button class="btn-primary" @click="addAccount" :disabled="addingAccount">{{ addingAccount ? '添加中...' : '添加并测试连接' }}</button>
        </div>
      </div>
    </div>

    <div v-if="toast.show" class="toast" :class="toast.type">{{ toast.message }}</div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import api from '../utils/api.js';

const props = defineProps({
  embedded: { type: Boolean, default: true }
});
const emit = defineEmits(['unread-count']);

// Detect mobile
const isMobile = ref(window.innerWidth <= 768);
function _checkMobile() { isMobile.value = window.innerWidth <= 768; }

// State
const accounts = ref([]);
const selectedAccountId = ref(null);
const emails = ref([]);
const selectedEmail = ref(null);
const mobileView = ref('accounts');
const emailsLoading = ref(false);
const syncing = ref(false);
const syncingId = ref(null);
const translating = ref(false);
const generatingAI = ref(false);
const matchingCustomer = ref(false);
const showReplyArea = ref(false);
const replyText = ref('');
const aiReplies = ref([]);
const sending = ref(false);
const emailSearch = ref('');
const addingAccount = ref(false);
const showAddAccountDialog = ref(false);
const addAccountError = ref('');
const addAccountSuccess = ref('');
const toast = ref({ show: false, message: '', type: 'success' });

// ===== 手机端QQ邮箱风格新增状态 =====
const showMetaDetail = ref(false);
const showTransPanel = ref(false);
const showComposer = ref(false);
const composerMode = ref('reply'); // 'reply' | 'forward'
const composerTo = ref('');
const composerSubject = ref('');
const showMoreMenu = ref(false);
const mDetailScroll = ref(null);
const mComposerInput = ref(null);
const currentEmailIndex = computed(() => {
  if (!selectedEmail.value) return -1;
  return emails.value.findIndex(e => e.id === selectedEmail.value.id);
});
const hasPrevEmail = computed(() => currentEmailIndex.value > 0);
const hasNextEmail = computed(() => currentEmailIndex.value >= 0 && currentEmailIndex.value < emails.value.length - 1);

const newAccount = ref({
  email: '', password: '', provider: '',
  imapHost: '', imapPort: 993, smtpHost: '', smtpPort: 465,
});

const PROVIDER_PRESETS = {
  gmail: { label:'Gmail', imapHost:'imap.gmail.com',imapPort:993,smtpHost:'smtp.gmail.com',smtpPort:465,needAppPassword:true },
  outlook: { label:'Outlook/Hotmail', imapHost:'outlook.office365.com',imapPort:993,smtpHost:'smtp.office365.com',smtpPort:587,needAppPassword:true },
  qq: { label:'QQ邮箱', imapHost:'imap.qq.com',imapPort:993,smtpHost:'smtp.qq.com',smtpPort:465,needAppPassword:true },
  '163': { label:'163邮箱', imapHost:'imap.163.com',imapPort:993,smtpHost:'smtp.163.com',smtpPort:465,needAppPassword:true },
  exmail: { label:'腾讯企业邮', imapHost:'imap.exmail.qq.com',imapPort:993,smtpHost:'smtp.exmail.qq.com',smtpPort:465 },
  aliyun: { label:'阿里企业邮', imapHost:'imap.qiye.aliyun.com',imapPort:993,smtpHost:'smtp.qiye.aliyun.com',smtpPort:465 },
  icloud: { label:'iCloud', imapHost:'imap.mail.me.com',imapPort:993,smtpHost:'smtp.mail.me.com',smtpPort:587,needAppPassword:true },
  yahoo: { label:'Yahoo', imapHost:'imap.mail.yahoo.com',imapPort:993,smtpHost:'smtp.mail.yahoo.com',smtpPort:465,needAppPassword:true },
  zoho: { label:'Zoho', imapHost:'imap.zoho.com',imapPort:993,smtpHost:'smtp.zoho.com',smtpPort:465 },
  custom: { label:'自定义(企业邮箱/自建)', imapHost:'',imapPort:993,smtpHost:'',smtpPort:465 },
};
const APP_PASSWORD_HINT = {
  gmail: 'Gmail需开启两步验证，然后在"Google账号→安全性→应用专用密码"生成16位授权码',
  outlook: 'Outlook/Hotmail如开启两步验证，需在"账户安全→应用密码"生成授权码',
  qq: 'QQ邮箱需先在"设置→账户"开启IMAP/SMTP服务，获取授权码填到密码栏',
  '163': '163邮箱需先在"设置→POP3/SMTP/IMAP"开启IMAP，获取授权码填到密码栏',
  icloud: 'iCloud需在appleid.apple.com→"登录与安全→App专用密码"生成密码',
  yahoo: 'Yahoo需在"Account Security→Generate app password"生成16位密码',
};

function onProviderChange() {
  const preset = PROVIDER_PRESETS[newAccount.value.provider];
  if (preset) Object.assign(newAccount.value, preset);
}

function avatarColorFor(key) {
  if (!key) return '#6b7280';
  const palette = ['#00a884','#4FC3F7','#AB47BC','#FF7043','#66BB6A','#FFA726','#EC407A','#26A69A','#EF5350','#5C6BC0'];
  let h = 0;
  for (let i = 0; i < key.length; i++) h = key.charCodeAt(i) + ((h << 5) - h);
  return palette[Math.abs(h) % palette.length];
}

function accUnread(acc) { return acc._count?.unread || acc.unreadCount || 0; }

const totalUnread = computed(() => {
  let n = 0;
  for (const a of accounts.value) n += accUnread(a);
  return n;
});

watch(totalUnread, (v) => { emit('unread-count', v); }, { immediate: true });

async function loadAccounts(silent) {
  try {
    const { data } = await api.get('/emails/accounts');
    accounts.value = data || [];
    if (accounts.value.length > 0 && !selectedAccountId.value) {
      selectedAccountId.value = accounts.value[0].id;
      if (isMobile.value && accounts.value.length === 1) mobileView.value = 'list';
      await loadEmails();
    } else if (selectedAccountId.value && !accounts.value.find(a => a.id === selectedAccountId.value)) {
      selectedAccountId.value = accounts.value[0]?.id || null;
      if (selectedAccountId.value) await loadEmails();
      else { emails.value = []; selectedEmail.value = null; }
    }
  } catch (err) {
    if (!silent) console.error('load accounts failed:', err);
  }
}

async function selectAccount(acc) {
  selectedAccountId.value = acc.id;
  selectedEmail.value = null;
  showReplyArea.value = false;
  aiReplies.value = [];
  if (isMobile.value) mobileView.value = 'list';
  await loadEmails();
}

async function loadEmails() {
  if (!selectedAccountId.value) return;
  emailsLoading.value = true;
  try {
    const params = {};
    if (emailSearch.value) params.search = emailSearch.value;
    const { data } = await api.get(`/emails/accounts/${selectedAccountId.value}/emails`, { params });
    emails.value = data.emails || [];
  } catch (err) { console.error('load emails failed:', err); }
  emailsLoading.value = false;
}

async function selectEmail(email) {
  selectedEmail.value = email;
  showReplyArea.value = false;
  aiReplies.value = [];
  showMetaDetail.value = false;
  showTransPanel.value = false;
  showComposer.value = false;
  showMoreMenu.value = false;
  if (isMobile.value) mobileView.value = 'detail';
  if (!email.read) {
    try {
      await api.post(`/emails/${email.id}/read`);
      email.read = true;
      loadAccounts(true);
    } catch(e){}
  }
}

async function syncAccount(acc) {
  syncing.value = true; syncingId.value = acc.id;
  try {
    const { data } = await api.post(`/emails/accounts/${acc.id}/sync`);
    showToast(`同步完成，新增 ${data.synced} 封邮件`);
    if (selectedAccountId.value === acc.id) await loadEmails();
    await loadAccounts(true);
  } catch (err) { showToast('同步失败: ' + (err.response?.data?.error || err.message), 'error'); }
  syncing.value = false; syncingId.value = null;
}

function closeAddDialog() {
  showAddAccountDialog.value = false;
  addAccountError.value = ''; addAccountSuccess.value = '';
  newAccount.value = { email:'', password:'', provider:'', imapHost:'', imapPort:993, smtpHost:'', smtpPort:465 };
}

async function addAccount() {
  addAccountError.value = ''; addAccountSuccess.value = '';
  if (!newAccount.value.email || !newAccount.value.password) {
    addAccountError.value = '请填写邮箱地址和密码/授权码'; return;
  }
  addingAccount.value = true;
  try {
    const { data } = await api.post('/emails/accounts', newAccount.value);
    addAccountSuccess.value = `邮箱 ${data.email} 添加成功，正在测试连接...`;
    try {
      const tr = await api.post(`/emails/accounts/${data.id}/test`);
      if (tr.data.imap && tr.data.smtp) addAccountSuccess.value = `邮箱 ${data.email} 添加成功，连接正常！`;
      else addAccountSuccess.value = `邮箱已添加，但连接测试失败。IMAP: ${tr.data.imap?'OK':'FAIL'}, SMTP: ${tr.data.smtp?'OK':'FAIL'}`;
    } catch(e) { addAccountSuccess.value = '邮箱已添加，但连接测试出错'; }
    await loadAccounts(true);
    setTimeout(closeAddDialog, 2000);
  } catch (err) { addAccountError.value = err.response?.data?.error || '添加失败'; }
  addingAccount.value = false;
}

async function deleteAccount(acc) {
  if (!confirm(`确定要删除邮箱 ${acc.email} 吗？相关邮件记录也会被删除。`)) return;
  try {
    await api.delete(`/emails/accounts/${acc.id}`);
    if (selectedAccountId.value === acc.id) {
      selectedAccountId.value = null; emails.value = []; selectedEmail.value = null;
    }
    await loadAccounts(true);
    showToast('邮箱已删除');
  } catch(e) { showToast('删除失败', 'error'); }
}

async function translateEmail(email) {
  translating.value = true;
  try {
    const { data } = await api.post(`/emails/${email.id}/translate`, { targetLang: 'zh' });
    email.translation = data.translation;
    email.sourceLang = data.sourceLang;
    showToast('翻译完成');
  } catch(e) { showToast('翻译失败', 'error'); }
  translating.value = false;
}

async function aiReplyPc(email) {
  generatingAI.value = true;
  try {
    const { data } = await api.post(`/emails/${email.id}/ai-reply`, { style: 'formal' });
    aiReplies.value = data.replies || [];
    showReplyArea.value = true;
    showToast('AI回复已生成');
  } catch(e) { showToast('AI回复生成失败', 'error'); }
  generatingAI.value = false;
}

// 手机端：打开回复composer，可选自动触发AI
function openReply(withAI, mode) {
  if (isMobile.value) {
    composerMode.value = mode || 'reply';
    const email = selectedEmail.value;
    if (!email) return;
    const m = (email.from||'').match(/<(.+?)>/);
    composerTo.value = m ? m[1] : (email.from||'');
    composerSubject.value = (mode === 'forward' ? 'Fwd: ' : 'Re: ') + (email.subject || '(无主题)');
    if (!replyText.value) replyText.value = '';
    showComposer.value = true;
    showMoreMenu.value = false;
    showTransPanel.value = false;
    if (withAI) {
      setTimeout(()=> triggerAiReplyComposer(), 200);
    }
    setTimeout(()=>{ try { mComposerInput.value && mComposerInput.value.focus(); } catch(e){} }, 300);
  } else {
    toggleReply();
  }
}

function closeComposer() {
  showComposer.value = false;
}

async function triggerAiReplyComposer() {
  const email = selectedEmail.value;
  if (!email) return;
  generatingAI.value = true;
  try {
    const { data } = await api.post(`/emails/${email.id}/ai-reply`, { style: 'formal' });
    const replies = data.replies || [];
    if (replies.length > 0) {
      replyText.value = replies[0] + (replyText.value ? '\n\n' + replyText.value : '');
      showToast('AI草稿已填入');
    }
  } catch(e) { showToast('AI回复生成失败', 'error'); }
  generatingAI.value = false;
}

function onMobileTranslate() {
  const email = selectedEmail.value;
  if (!email) return;
  if (email.translation) {
    showTransPanel.value = !showTransPanel.value;
    return;
  }
  translating.value = true;
  // 后端会自动清理>引用前缀和邮件头，直接请求翻译
  api.post(`/emails/${email.id}/translate`, { targetLang: 'zh' })
    .then(res => {
      email.translation = res.data.translation;
      email.sourceLang = res.data.sourceLang || 'unknown';
      showTransPanel.value = true;
      showToast('翻译完成');
    })
    .catch(err => { showToast('翻译失败: ' + (err.response?.data?.error || err.message), 'error'); })
    .finally(() => { translating.value = false; });
}

async function sendMobileReply() {
  if (!replyText.value.trim()) { showToast('请输入内容', 'error'); return; }
  sending.value = true;
  try {
    await api.post('/emails/send', {
      accountId: selectedAccountId.value,
      to: composerTo.value,
      subject: composerSubject.value,
      body: replyText.value,
      html: replyText.value.replace(/\n/g, '<br>'),
    });
    showToast('邮件已发送');
    showComposer.value = false;
    replyText.value = ''; aiReplies.value = [];
    await loadEmails();
    await loadAccounts(true);
  } catch(err) { showToast('发送失败: ' + (err.response?.data?.error || err.message), 'error'); }
  sending.value = false;
}

async function deleteEmail(email) {
  if (!email) return;
  if (!confirm(`确定删除该邮件？`)) return;
  try {
    await api.delete(`/emails/${email.id}`);
    showToast('已删除');
    if (isMobile.value) mobileView.value = 'list';
    await loadEmails();
    await loadAccounts(true);
  } catch(e) { showToast('删除失败', 'error'); }
}

function forwardEmail() {
  showToast('转发功能：请在PC端使用或直接复制内容发送', 'error');
}
function onComposerEmoji() { showToast('表情功能开发中'); }
function onComposerAttach() { showToast('附件功能开发中'); }
function onComposerSchedule() { showToast('定时发送开发中'); }
function onComposerFormat() { showToast('格式功能开发中'); }
function onComposerMore() { showToast('更多功能开发中'); }
function markUnread() {
  const email = selectedEmail.value;
  if (!email) return;
  try { api.post(`/emails/${email.id}/unread`); email.read = false; showToast('已标为未读'); mobileView.value='list'; loadAccounts(true); } catch(e){}
}

function prevEmail() {
  const idx = currentEmailIndex.value;
  if (idx > 0) { selectEmail(emails.value[idx-1]); if (mDetailScroll.value) mDetailScroll.value.scrollTop = 0; }
}
function nextEmail() {
  const idx = currentEmailIndex.value;
  if (idx >=0 && idx < emails.value.length-1) { selectEmail(emails.value[idx+1]); if (mDetailScroll.value) mDetailScroll.value.scrollTop = 0; }
}

function toggleReply() { showReplyArea.value = !showReplyArea.value; if (showReplyArea.value) aiReplies.value = []; }
function useAiReply(reply) { replyText.value = reply; }

async function matchCustomer(email) {
  matchingCustomer.value = true;
  try {
    const { data } = await api.post(`/emails/${email.id}/match-customer`);
    showToast(`客户匹配成功: ${data.name}`);
  } catch(e) { showToast('匹配失败', 'error'); }
  matchingCustomer.value = false;
}

async function sendReply() {
  if (!replyText.value.trim()) return;
  sending.value = true;
  try {
    const replyTo = selectedEmail.value.from;
    const m = replyTo.match(/<(.+?)>/);
    const toAddr = m ? m[1] : replyTo;
    await api.post('/emails/send', {
      accountId: selectedAccountId.value,
      to: toAddr,
      subject: `Re: ${selectedEmail.value.subject}`,
      body: replyText.value,
      html: replyText.value.replace(/\n/g, '<br>'),
    });
    showToast('邮件已发送');
    showReplyArea.value = false; replyText.value = ''; aiReplies.value = [];
    await loadEmails();
    await loadAccounts(true);
  } catch(err) { showToast('发送失败: ' + (err.response?.data?.error || err.message), 'error'); }
  sending.value = false;
}

function statusLabel(s) { return { connected:'已连接', disconnected:'未连接', error:'异常' }[s] || s || '未知'; }
function extractEmailName(from) {
  if (!from) return '';
  const m = from.match(/^"?([^"<]+)"?\s*</);
  return m ? m[1].trim() : from.split('@')[0];
}
function stripHtml(html) { if (!html) return ''; return String(html).replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim(); }
function formatText(text) {
  if (!text) return '';
  return String(text).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
}
function formatTime(ds) {
  if (!ds) return '';
  const d = new Date(ds), now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'});
  return d.toLocaleDateString('zh-CN',{month:'2-digit',day:'2-digit'});
}
function formatDateTime(ds) { if (!ds) return ''; return new Date(ds).toLocaleString('zh-CN'); }
function showToast(msg, type='success') {
  toast.value = { show:true, message:msg, type };
  setTimeout(()=>{ toast.value.show = false; }, 3000);
}

let searchTimer;
function debouncedSearch() { clearTimeout(searchTimer); searchTimer = setTimeout(loadEmails, 400); }

let pollTimer = null;
function startPoll() {
  stopPoll();
  pollTimer = setInterval(() => { loadAccounts(true); loadEmails(); }, 60000);
}
function stopPoll() { if (pollTimer) { clearInterval(pollTimer); pollTimer = null; } }

let emailPollTimer = null;

// 手机端：选中账号后自动进入邮件列表
watch(selectedAccountId, (v) => {
  if (v && isMobile.value && mobileView.value === 'accounts') {
    mobileView.value = 'list';
  }
});

onMounted(() => {
  // 60秒自动轮询未读
  emailPollTimer = setInterval(() => {
    if (accounts.value.length > 0) loadAccounts(true);
  }, 60000);
  // 监听移动端返回
  window.addEventListener('email:mobile-back', onEmailMobileBack);

  window.addEventListener('resize', _checkMobile);
  loadAccounts();
  startPoll();
});
function onEmailMobileBack() {
  if (isMobile.value) {
    if (mobileView.value === 'detail') mobileView.value = 'list';
    else if (mobileView.value === 'list') mobileView.value = 'accounts';
  }
}
onUnmounted(() => {
  if (emailPollTimer) clearInterval(emailPollTimer);
  window.removeEventListener('email:mobile-back', onEmailMobileBack);

  window.removeEventListener('resize', _checkMobile);
  stopPoll();
});
</script>

<style scoped>
.email-channel {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #111b21;
  color: #e9edef;
  overflow: hidden;
}
.email-content {
  flex: 1;
  display: flex;
  overflow: hidden;
  min-height: 0;
}
.epanel-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: #202c33;
  border-bottom: 1px solid #3b4a54;
  min-height: 48px;
}
.epanel-title { font-size: 14px; font-weight: 600; color: #e9edef; flex: 1; }
.account-panel {
  width: 240px;
  min-width: 240px;
  background: #111b21;
  border-right: 1px solid #3b4a54;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.account-list-scroll { flex:1; overflow-y: auto; }
.account-item {
  display: flex; align-items: center;
  padding: 10px 12px; cursor: pointer;
  border-bottom: 1px solid #222d34;
  transition: background 0.15s;
}
.account-item:hover { background: #202c33; }
.account-item.active { background: #2a3942; }
.account-avatar {
  width: 38px; height: 38px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-weight: 600; font-size: 15px; color: #fff;
  flex-shrink: 0; margin-right: 10px;
}
.account-info { flex:1; min-width:0; }
.account-email { font-size: 12.5px; font-weight: 500; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.account-meta { display:flex; gap:6px; margin-top:2px; align-items:center; }
.account-status { font-size: 10.5px; padding: 1px 6px; border-radius: 8px; }
.account-status.connected { background:#00a884; color:#fff; }
.account-status.disconnected { background:#6b7280; color:#fff; }
.account-status.error { background:#ef4444; color:#fff; }
.account-unread {
  background:#00a884; color:#fff; font-size:10px;
  padding: 1px 6px; border-radius:8px; font-weight:600; min-width:16px; text-align:center;
}
.account-actions { display:flex; gap:2px; opacity:0; transition: opacity 0.15s; }
.account-item:hover .account-actions { opacity:1; }

.email-list-panel {
  width: 300px;
  min-width: 300px;
  background: #111b21;
  border-right: 1px solid #3b4a54;
  display: flex; flex-direction: column;
  overflow: hidden;
}
.email-search {
  flex:1;
  padding: 7px 10px;
  border-radius: 8px;
  border: none;
  background: #2a3942;
  color: #e9edef;
  font-size: 13px;
  outline: none;
}
.email-search::placeholder { color: #8696a0; }
.email-list { flex:1; overflow-y: auto; }
.email-item {
  display: flex; padding: 10px 12px; cursor: pointer;
  border-bottom: 1px solid #222d34;
  transition: background 0.15s;
}
.email-item:hover { background: #202c33; }
.email-item.active { background: #2a3942; }
.email-item.unread { background: rgba(0,168,132,0.06); }
.email-item.unread .email-subject { font-weight: 600; }
.email-sender-avatar {
  width: 36px; height:36px; border-radius:50%;
  display:flex; align-items:center; justify-content:center;
  font-weight:600; font-size:13px; color:#fff;
  flex-shrink:0; margin-right:10px;
}
.email-preview { flex:1; min-width:0; }
.email-sender { font-size:12.5px; font-weight:500; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.email-subject { font-size:12px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-top:2px; color:#e9edef; }
.email-body-preview { font-size:11px; color:#8696a0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-top:2px; }
.email-time { font-size:10.5px; color:#8696a0; flex-shrink:0; margin-left:6px; align-self:flex-start; }

.email-detail-panel {
  flex:1; display:flex; flex-direction:column;
  background: #0b141a;
  overflow: hidden;
  min-width: 0;
}
.email-detail-topbar {
  display:flex; align-items:center; gap:8px;
  padding: 10px 16px;
  background: #202c33;
  border-bottom: 1px solid #3b4a54;
  min-height: 48px;
}
.email-detail-subject { font-size:15px; font-weight:600; flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.email-detail-meta {
  padding: 10px 16px;
  background: #111b21;
  border-bottom: 1px solid #222d34;
  font-size: 12px; color: #8696a0;
}
.meta-row { display:flex; gap:8px; padding: 2px 0; }
.meta-label { width:50px; color:#8696a0; flex-shrink:0; }
.meta-val { color:#e9edef; word-break: break-all; }
.email-detail-actions {
  display:flex; gap:6px; padding: 8px 16px; flex-wrap:wrap;
  background: #111b21;
  border-bottom: 1px solid #222d34;
}
.email-translation {
  margin: 10px 16px;
  background: rgba(0,168,132,0.1);
  border: 1px solid rgba(0,168,132,0.3);
  border-radius: 8px;
  padding: 10px 14px;
}
.translation-label { font-size:11.5px; color:#00a884; font-weight:500; margin-bottom:4px; }
.translation-text { font-size:13px; line-height:1.6; color:#e9edef; }
.email-body-scroll { flex:1; overflow-y:auto; padding: 16px; background:#111b21; }
.email-body {
  background: #1a242b;
  color:#e9edef;
  font-size:13.5px;
  line-height:1.7;
  padding: 16px;
  border-radius: 8px;
  word-break: break-word;
  white-space: pre-wrap;
}
.email-body :deep(img) { max-width: 100%; height: auto; }
.email-body :deep(a) { color: #53bdeb; }
.email-reply-area {
  border-top: 1px solid #3b4a54;
  padding: 10px 16px;
  background: #111b21;
}
.ai-replies { margin-bottom: 10px; }
.ai-replies-header { font-size:12px; font-weight:500; color:#00a884; margin-bottom:6px; }
.ai-reply-option {
  padding:8px 12px; background:#2a3942;
  border-radius:8px; margin-bottom:6px; cursor:pointer;
  font-size:12.5px; line-height:1.5; transition: background 0.15s;
  border: 1px solid transparent;
}
.ai-reply-option:hover { background:#202c33; border-color:#00a884; }
.reply-textarea {
  width:100%; min-height:100px; padding:10px;
  border-radius:8px; border:1px solid #3b4a54;
  background:#2a3942; color:#e9edef;
  font-size:13.5px; font-family:inherit;
  resize:vertical; outline:none;
}
.reply-textarea:focus { border-color:#00a884; }
.reply-actions { display:flex; gap:8px; margin-top:8px; justify-content:flex-end; }

.empty-state {
  display:flex; flex-direction:column;
  align-items:center; justify-content:center;
  height:100%; gap:10px; color:#8696a0; padding:20px; text-align:center;
}
.empty-state p { margin:0; }
.btn-primary {
  display:inline-flex; align-items:center; gap:6px;
  padding:7px 14px; border:none; border-radius:8px;
  background:#00a884; color:#fff; font-size:12.5px;
  font-weight:500; cursor:pointer; transition: background 0.15s;
}
.btn-primary:hover { background:#008c6f; }
.btn-primary:disabled { opacity:0.6; cursor:not-allowed; }
.btn-secondary {
  display:inline-flex; align-items:center; gap:5px;
  padding:6px 12px; border:1px solid #3b4a54;
  border-radius:8px; background:transparent; color:#e9edef;
  font-size:12px; cursor:pointer; transition: background 0.15s;
}
.btn-secondary:hover { background:#202c33; }
.btn-secondary:disabled { opacity:0.6; cursor:not-allowed; }
.btn-icon {
  display:flex; align-items:center; justify-content:center;
  width:30px; height:30px; border:none; border-radius:50%;
  background:transparent; color:#8696a0; cursor:pointer;
  transition: background 0.15s; flex-shrink:0;
}
.btn-icon:hover { background:#2a3942; color:#e9edef; }
.btn-icon.btn-danger:hover { background:rgba(239,68,68,0.2); color:#ef4444; }
.btn-icon:disabled { opacity:0.4; cursor:not-allowed; }
.spinning { animation: spin 1s linear infinite; }
@keyframes spin { from{transform:rotate(0deg);} to{transform:rotate(360deg);} }

.dialog-overlay {
  position: fixed; inset:0; background:rgba(0,0,0,0.6);
  display:flex; align-items:center; justify-content:center;
  z-index: 1000;
}
.dialog-box {
  background:#202c33; border-radius:12px;
  width:460px; max-width:92vw; max-height:85vh;
  overflow-y:auto; box-shadow: 0 20px 60px rgba(0,0,0,0.5);
}
.dialog-header { display:flex; align-items:center; justify-content:space-between; padding:14px 18px; border-bottom:1px solid #3b4a54; }
.dialog-header h3 { margin:0; font-size:15px; font-weight:600; }
.dialog-body { padding:16px 18px; }
.dialog-footer { display:flex; justify-content:flex-end; gap:8px; padding:12px 18px; border-top:1px solid #3b4a54; }
.form-group { margin-bottom:12px; }
.form-group label { display:block; font-size:11.5px; font-weight:500; color:#8696a0; margin-bottom:5px; }
.form-group input,.form-group select {
  width:100%; padding:9px 11px;
  border:1px solid #3b4a54; border-radius:8px;
  background:#2a3942; color:#e9edef; font-size:13px; outline:none;
}
.form-group input:focus,.form-group select:focus { border-color:#00a884; }
.form-row { display:grid; grid-template-columns: 1fr 1fr; gap:10px; }
.form-error { color:#ef4444; font-size:12px; padding:7px 10px; background:rgba(239,68,68,0.1); border-radius:8px; }
.form-success { color:#00a884; font-size:12px; padding:7px 10px; background:rgba(0,168,132,0.1); border-radius:8px; }

.toast {
  position: fixed; bottom:24px; left:50%; transform:translateX(-50%);
  padding:9px 18px; border-radius:8px; font-size:12.5px; z-index:3000;
  animation: toastIn 0.3s ease;
}
.toast.success { background:#00a884; color:#fff; }
.toast.error { background:#ef4444; color:#fff; }
@keyframes toastIn { from{opacity:0; transform:translateX(-50%) translateY(10px);} to{opacity:1; transform:translateX(-50%) translateY(0);} }

.mobile-back-btn { color:#e9edef !important; }

@media (max-width: 768px) {
  .account-panel { width:100%; min-width:100%; border-right:none; }
  .email-list-panel { display:none; width:100%; min-width:100%; border-right:none; }
  .email-detail-panel { display:none; }
  .email-content { flex-direction: column; }
  .email-channel.show-list .account-panel { display:none; }
  .email-channel.show-list .email-list-panel { display:flex; }
  .email-channel.show-detail .account-panel,
  .email-channel.show-detail .email-list-panel { display:none; }
  .email-channel.show-detail .email-detail-panel { display:flex; }
}

/* ================================================================
   手机端QQ邮箱风格（仅在 @media max-width:768px 内生效）
   PC端布局完全不受影响
   ================================================================ */
@media (max-width: 768px) {
  /* 隐藏PC端的detail/actions/meta/topbar/reply/translation区 */
  .email-channel.show-detail .email-detail-panel {
    position: relative;
    display: flex !important;
    background: #111b21;
  }
  .email-channel.show-detail .email-detail-topbar,
  .email-channel.show-detail .email-detail-meta,
  .email-channel.show-detail .email-detail-actions,
  .email-channel.show-detail .email-translation,
  .email-channel.show-detail .email-reply-area,
  .email-channel.show-detail .email-body-scroll {
    display: none !important;
  }

  /* ---- 顶部导航 ---- */
  .m-detail-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 48px;
    padding: 0 8px;
    background: #202c33;
    border-bottom: 1px solid #3b4a54;
    flex-shrink: 0;
  }
  .m-nav-btn {
    width: 40px; height: 40px;
    border: none; background: transparent;
    color: #e9edef; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    border-radius: 50%;
  }
  .m-nav-btn:active { background: rgba(255,255,255,0.08); }
  .m-nav-btn:disabled { opacity: 0.3; }
  .m-nav-actions { display: flex; gap: 2px; }

  /* ---- 滚动阅读区 ---- */
  .m-detail-scroll {
    flex: 1;
    overflow-y: auto;
    padding: 16px 16px 24px;
    -webkit-overflow-scrolling: touch;
  }

  /* 主题大字 */
  .m-subject {
    font-size: 20px;
    font-weight: 700;
    color: #e9edef;
    line-height: 1.35;
    margin-bottom: 16px;
    word-break: break-word;
  }

  /* 发件人一行 */
  .m-meta-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding-bottom: 14px;
    border-bottom: 1px solid #222d34;
    margin-bottom: 14px;
  }
  .m-avatar {
    width: 40px; height: 40px; border-radius: 50%;
    color: #fff; font-weight: 600; font-size: 16px;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }
  .m-meta-main { flex: 1; min-width: 0; }
  .m-sender-name {
    font-size: 15px; font-weight: 600; color: #e9edef;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .m-sender-time { font-size: 12px; color: #8696a0; margin-top: 2px; }
  .m-detail-toggle {
    background: none; border: none; color: #00a884;
    font-size: 13px; padding: 6px 8px; cursor: pointer;
    flex-shrink: 0;
  }

  /* 展开的详情 */
  .m-meta-detail {
    background: #202c33;
    border-radius: 8px;
    padding: 10px 14px;
    margin-bottom: 14px;
    font-size: 12.5px;
  }
  .m-meta-line { padding: 4px 0; display: flex; gap: 4px; }
  .m-meta-k { color: #8696a0; flex-shrink: 0; }
  .m-meta-v { color: #e9edef; word-break: break-all; flex: 1; }

  /* 附件条 */
  .m-attach-bar {
    display: flex; align-items: center; gap: 6px;
    background: #202c33; border-radius: 8px;
    padding: 8px 12px; margin-bottom: 14px;
    font-size: 12.5px; color: #8696a0;
  }

  /* 正文 */
  .m-body {
    font-size: 15px;
    line-height: 1.7;
    color: #e9edef;
    word-break: break-word;
    background: transparent;
    padding: 0;
  }
  .m-body :deep(img) { max-width: 100%; height: auto; border-radius: 6px; }
  .m-body :deep(a) { color: #53bdeb; word-break: break-all; }
  .m-body :deep(blockquote) {
    margin: 8px 0; padding: 8px 12px;
    border-left: 3px solid #3b4a54;
    background: #202c33; color: #8696a0;
    border-radius: 0 6px 6px 0;
  }

  /* ---- 翻译悬浮胶囊 ---- */
  .m-fab-translate {
    position: absolute;
    right: 14px;
    bottom: 72px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 9px 14px;
    border-radius: 20px;
    border: none;
    background: rgba(32,44,51,0.95);
    color: #e9edef;
    font-size: 12.5px;
    box-shadow: 0 4px 14px rgba(0,0,0,0.4);
    cursor: pointer;
    z-index: 30;
    backdrop-filter: blur(8px);
  }
  .m-fab-translate:active { background: #2a3942; }
  .m-fab-translate:disabled { opacity: 0.6; }

  /* 译文展开面板（内联） */
  .m-trans-inline {
    margin: 12px 0 8px;
    padding: 12px 14px;
    background: #1a262d;
    border-left: 3px solid #00a884;
    border-radius: 8px;
  }
  .m-trans-head-inline {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }
  .m-trans-label { font-size: 13px; color: #00a884; font-weight: 600; }
  .m-trans-toggle {
    background: transparent;
    color: #8696a0;
    border: none;
    font-size: 12px;
    padding: 4px 8px;
    border-radius: 4px;
  }
  .m-trans-toggle:active { background: #2a3942; }
  .m-trans-body-inline {
    font-size: 14.5px;
    line-height: 1.7;
    color: #e9edef;
    white-space: pre-wrap;
    word-break: break-word;
  }

  /* ---- 底部4图标栏 ---- */
  .m-bottom-bar {
    display: flex;
    align-items: center;
    justify-content: space-around;
    height: 56px;
    background: #202c33;
    border-top: 1px solid #3b4a54;
    flex-shrink: 0;
    padding-bottom: env(safe-area-inset-bottom, 0);
  }
  .m-bar-btn {
    flex: 1;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    gap: 2px;
    background: none; border: none;
    color: #8696a0;
    cursor: pointer;
    padding: 6px 0;
  }
  .m-bar-btn span { font-size: 10.5px; }
  .m-bar-btn:active { background: rgba(255,255,255,0.06); }
  .m-bar-btn.m-bar-primary { color: #00a884; }

  /* 更多菜单 */
  .m-more-mask {
    position: absolute; inset: 0; z-index: 40;
    background: transparent;
  }
  .m-more-menu {
    position: absolute;
    right: 10px; bottom: 64px;
    background: #2a3942;
    border: 1px solid #3b4a54;
    border-radius: 10px;
    padding: 6px 0;
    min-width: 150px;
    box-shadow: 0 6px 20px rgba(0,0,0,0.4);
  }
  .m-more-item {
    display: flex; align-items: center; gap: 10px;
    width: 100%;
    padding: 10px 16px;
    background: none; border: none;
    color: #e9edef; font-size: 13.5px;
    text-align: left; cursor: pointer;
  }
  .m-more-item:active { background: #202c33; }
  .m-more-item:disabled { opacity: 0.5; }

  /* ================ 回复composer（全屏sheet） ================ */
  .m-composer-mask {
    position: absolute; inset: 0;
    background: rgba(0,0,0,0.5);
    z-index: 100;
    display: flex;
    align-items: flex-end;
  }
  .m-composer {
    width: 100%;
    height: 92%;
    background: #111b21;
    border-radius: 14px 14px 0 0;
    display: flex;
    flex-direction: column;
    animation: slideUp 0.25s ease;
    overflow: hidden;
  }
  @keyframes slideUp {
    from { transform: translateY(100%); }
    to { transform: translateY(0); }
  }
  .m-composer-grabber {
    width: 40px; height: 4px;
    background: #3b4a54;
    border-radius: 2px;
    margin: 8px auto 4px;
    flex-shrink: 0;
  }
  .m-composer-nav {
    display: flex; align-items: center;
    height: 44px;
    padding: 0 14px;
    border-bottom: 1px solid #222d34;
    flex-shrink: 0;
  }
  .m-cancel-btn {
    background: none; border: none; color: #8696a0;
    font-size: 15px; cursor: pointer; padding: 6px 4px;
  }
  .m-composer-title {
    flex: 1; text-align: center;
    font-size: 15px; font-weight: 600; color: #e9edef;
  }
  .m-send-btn {
    background: none; border: none; color: #00a884;
    font-size: 15px; font-weight: 600; cursor: pointer; padding: 6px 4px;
  }
  .m-send-btn:disabled { opacity: 0.4; }

  .m-composer-scroll {
    flex: 1;
    overflow-y: auto;
    padding: 12px 16px;
    -webkit-overflow-scrolling: touch;
  }
  .m-composer-field {
    display: flex; padding: 10px 0;
    border-bottom: 1px solid #222d34;
    font-size: 13.5px;
  }
  .m-field-k { color: #8696a0; flex-shrink: 0; margin-right: 6px; }
  .m-field-v { color: #e9edef; flex: 1; word-break: break-all; }

  .m-composer-input {
    width: 100%;
    min-height: 140px;
    background: transparent;
    border: none;
    color: #e9edef;
    font-size: 15px; line-height: 1.6;
    font-family: inherit;
    padding: 16px 0;
    outline: none;
    resize: none;
  }

  .m-quote-block {
    background: #2a3942;
    border-radius: 8px;
    padding: 12px 14px;
    margin-top: 8px;
    border-left: 3px solid #3b4a54;
  }
  .m-quote-head { font-size: 12px; color: #8696a0; margin-bottom: 8px; font-weight: 600; }
  .m-quote-line { font-size: 12px; color: #8696a0; padding: 2px 0; }
  .m-quote-body {
    margin-top: 8px; padding-top: 8px;
    border-top: 1px solid #3b4a54;
    font-size: 13px; line-height: 1.55; color: #8696a0;
    max-height: 120px; overflow-y: auto;
    word-break: break-word;
  }
  .m-quote-body :deep(img) { max-width: 100%; height: auto; }

  /* 工具栏 */
  .m-composer-toolbar {
    display: flex;
    align-items: center;
    height: 50px;
    background: #202c33;
    border-top: 1px solid #3b4a54;
    padding: 0 6px;
    gap: 2px;
    flex-shrink: 0;
    padding-bottom: env(safe-area-inset-bottom, 0);
    overflow-x: auto;
  }
  .m-tool-btn {
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    gap: 1px;
    background: none; border: none;
    color: #8696a0;
    font-size: 9.5px;
    padding: 4px 8px;
    min-width: 48px;
    cursor: pointer;
    border-radius: 6px;
    flex-shrink: 0;
  }
  .m-tool-btn:active { background: rgba(255,255,255,0.06); }
  .m-tool-btn:disabled { opacity: 0.4; }
  .m-tool-icon { font-size: 18px; line-height: 1; }
  .m-tool-btn.m-tool-ai {
    color: #00a884;
    background: rgba(0,168,132,0.12);
    border-radius: 14px;
    padding: 4px 12px;
    min-width: 64px;
    font-weight: 600;
  }
}
</style>
