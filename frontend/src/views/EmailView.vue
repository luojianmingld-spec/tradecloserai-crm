<template>
  <div class="email-page" :class="{ 'show-list': mobileView === 'list', 'show-detail': mobileView === 'detail' }">
    <!-- Header -->
    <header class="page-header">
      <div class="header-left">
        <router-link to="/" class="back-link" title="返回沟通">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        </router-link>
        <button v-if="mobileView === 'list'" class="mobile-back-btn" @click="mobileView = 'accounts'">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        </button>
        <button v-if="mobileView === 'detail'" class="mobile-back-btn" @click="mobileView = 'list'">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        </button>
        <h1>邮件管理</h1>
      </div>
      <div class="header-actions">
        <button class="btn-primary" @click="showAddAccountDialog = true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
          添加邮箱
        </button>
      </div>
    </header>

    <div class="email-content">
      <!-- Left: Account List -->
      <div class="account-panel">
        <div v-if="accountsLoading" class="account-skeleton-wrap">
          <div v-for="n in 3" :key="n" class="account-skeleton">
            <div class="skeleton-avatar"></div>
            <div class="skeleton-lines"><div class="skeleton-line w80"></div><div class="skeleton-line w50"></div></div>
          </div>
        </div>
        <div v-else-if="accounts.length === 0" class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" stroke-width="1.5"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
          <p>还没有添加邮箱</p>
          <button class="btn-primary" @click="showAddAccountDialog = true">添加邮箱账号</button>
        </div>
        <div
          v-for="acc in accounts"
          :key="acc.id"
          class="account-item"
          :class="{ active: selectedAccountId === acc.id }"
          @click="selectAccount(acc)"
        >
          <div class="account-avatar">{{ acc.email[0].toUpperCase() }}</div>
          <div class="account-info">
            <div class="account-email">{{ acc.email }}</div>
            <div class="account-meta">
              <span class="account-status" :class="acc.status">{{ statusLabel(acc.status) }}</span>
              <span class="account-count">{{ acc._count?.emails || 0 }} 封</span>
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

      <!-- Middle: Email List -->
      <div class="email-list-panel">
        <div v-if="!selectedAccountId" class="empty-state">
          <p>选择一个邮箱账号查看邮件</p>
        </div>
        <template v-else>
          <div class="email-list-header">
            <input v-model="emailSearch" placeholder="搜索邮件..." class="email-search" @input="debouncedSearch" />
          </div>
          <div v-if="emailsLoading" class="empty-state"><p>加载中...</p></div>
          <div v-else-if="emails.length === 0" class="empty-state"><p>暂无邮件</p></div>
          <div v-else class="email-list">
            <div
              v-for="email in emails"
              :key="email.id"
              class="email-item"
              :class="{ active: selectedEmail?.id === email.id, unread: !email.read }"
              @click="selectEmail(email)"
            >
              <div class="email-sender-avatar">{{ (email.from || '?')[0].toUpperCase() }}</div>
              <div class="email-preview">
                <div class="email-sender">{{ extractEmailName(email.from) }}</div>
                <div class="email-subject">{{ email.subject }}</div>
                <div class="email-body-preview">{{ stripHtml(email.body).substring(0, 80) }}</div>
              </div>
              <div class="email-time">{{ formatTime(email.createdAt) }}</div>
            </div>
          </div>
        </template>
      </div>

      <!-- Right: Email Detail -->
      <div class="email-detail-panel">
        <div v-if="!selectedEmail" class="empty-state">
          <p>选择一封邮件查看详情</p>
        </div>
        <template v-else>
          <div class="email-detail-header">
            <div class="email-detail-subject">{{ selectedEmail.subject }}</div>
            <div class="email-detail-meta">
              <div><strong>发件人：</strong>{{ selectedEmail.from }}</div>
              <div><strong>收件人：</strong>{{ selectedEmail.to }}</div>
              <div><strong>时间：</strong>{{ formatDateTime(selectedEmail.createdAt) }}</div>
              <div v-if="selectedEmail.attachmentNames">
                <strong>附件：</strong>{{ selectedEmail.attachmentNames }}
              </div>
            </div>
          </div>
          <div class="email-detail-actions">
            <button class="btn-secondary" @click="translateEmail(selectedEmail)" :disabled="translating">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 8l6 6M4 14l6-6 2-3M2 5h12M7 2h1"/><path d="M22 22l-5-10-5 10M14 18h6"/></svg>
              {{ translating ? '翻译中...' : '翻译' }}
            </button>
            <button class="btn-secondary" @click="aiReply(selectedEmail)" :disabled="generatingAI">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a10 10 0 100 20 10 10 0 000-20z"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
              {{ generatingAI ? '生成中...' : 'AI回复' }}
            </button>
            <button class="btn-secondary assign-email-btn" @click="openEmailAssignDialog()">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l2.4 7.2H22l-6 4.6 2.3 7.2-6.3-4.6-6.3 4.6L8 13.8 2 9.2h7.6z"/></svg>
              发给 Agent
            </button>
            <button class="btn-secondary" @click="matchCustomer(selectedEmail)" :disabled="matchingCustomer">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
              {{ matchingCustomer ? '匹配中...' : '匹配客户' }}
            </button>
          </div>
          <!-- Translation result -->
          <div v-if="selectedEmail.translation" class="email-translation">
            <div class="translation-label">翻译结果：</div>
            <div class="translation-text">{{ selectedEmail.translation }}</div>
          </div>
          <!-- Email body -->
          <div class="email-body" v-html="sanitizeHtml(selectedEmail.bodyHtml) || formatText(selectedEmail.body)"></div>
          <!-- Reply area -->
          <div v-if="showReplyArea" class="email-reply-area">
            <div v-if="aiReplies.length > 0" class="ai-replies">
              <div class="ai-replies-header">AI 建议回复：</div>
              <div v-for="(reply, idx) in aiReplies" :key="idx" class="ai-reply-option" @click="useAiReply(reply)">
                {{ reply }}
              </div>
            </div>
            <textarea v-model="replyText" class="reply-textarea" placeholder="输入回复内容..."></textarea>
            <div class="reply-actions">
              <button class="btn-primary" @click="sendReply" :disabled="sending">
                {{ sending ? '发送中...' : '发送邮件' }}
              </button>
              <button class="btn-secondary" @click="showReplyArea = false">取消</button>
            </div>
          </div>
          <div v-else class="reply-trigger">
            <button class="btn-primary" @click="showReplyArea = true">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>
              回复邮件
            </button>
          </div>
        </template>
      </div>
    </div>

    <!-- Add Account Dialog -->
    <div v-if="showAddAccountDialog" class="dialog-overlay" @click.self="showAddAccountDialog = false">
      <div class="dialog-box">
        <div class="dialog-header">
          <h3>添加邮箱账号</h3>
          <button class="btn-icon" @click="showAddAccountDialog = false">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="dialog-body">
          <div class="form-group">
            <label>邮箱类型</label>
            <select v-model="newAccount.provider" @change="onProviderChange">
              <option value="">请选择...</option>
              <option value="gmail">Gmail</option>
              <option value="outlook">Outlook / Office365</option>
              <option value="qq">QQ邮箱</option>
              <option value="163">163邮箱</option>
              <option value="custom">自定义</option>
            </select>
          </div>
          <div class="form-group">
            <label>邮箱地址 *</label>
            <input v-model="newAccount.email" type="email" placeholder="your@email.com" />
          </div>
          <div class="form-group">
            <label>密码 / 授权码 *</label>
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
          <button class="btn-secondary" @click="showAddAccountDialog = false">取消</button>
          <button class="btn-primary" @click="addAccount" :disabled="addingAccount">
            {{ addingAccount ? '添加中...' : '添加并测试连接' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Toast notification -->
    <div v-if="toast.show" class="toast" :class="toast.type">{{ toast.message }}</div>

    <!-- 发给 Agent 指派弹窗（V1.0 F6 邮件入口） -->
    <div v-if="showAssignDialog" class="dialog-overlay" @click.self="showAssignDialog = false">
      <div class="assign-dialog">
        <div class="assign-dialog-header">
          <span>🤖 发给 Agent</span>
          <button class="assign-dialog-close" @click="showAssignDialog = false">✕</button>
        </div>
        <div class="assign-dialog-body">
          <div v-if="assignCustomerLoading" class="assign-loading">正在按发件人邮箱匹配客户...</div>
          <template v-else>
            <div v-if="assignCustomer" class="assign-cust-info">
              <span class="aci-icon">👤</span>
              <span class="aci-name">{{ assignCustomer.companyName || assignCustomer.name || assignCustomer.contactName || ('客户#' + assignCustomer.id) }}</span>
              <span class="aci-email">{{ assignCustomer.email }}</span>
            </div>
            <div v-else class="assign-cust-info warn">⚠️ 未找到与该发件人邮箱匹配的客户，请先在「匹配客户」中建立客户档案</div>
            <div class="assign-agents">
              <div v-for="ag in ASSIGN_AGENTS" :key="ag.type" class="assign-agent-card" :class="{ active: assignAgentType === ag.type }" @click="assignAgentType = ag.type">
                <span class="aa-icon">{{ ag.icon }}</span>
                <div class="aa-info"><div class="aa-name">{{ ag.name }}</div><div class="aa-desc">{{ ag.desc }}</div></div>
                <span class="aa-check" v-if="assignAgentType === ag.type">✓</span>
              </div>
            </div>
            <textarea v-model="assignInstruction" class="assign-input" rows="3" placeholder="给 Agent 的跟进指令（选填），如：回复该询盘邮件，重点报价跟进"></textarea>
          </template>
        </div>
        <div class="assign-dialog-footer">
          <button class="assign-dialog-btn cancel" @click="showAssignDialog = false">取消</button>
          <button class="assign-dialog-btn primary" :disabled="assigning || !assignCustomer" @click="doAssignFromEmail">{{ assigning ? '指派中...' : '确认指派' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import api from '../utils/api.js';
import { sanitizeHtml } from '../utils/sanitize.js';

// State
const accounts = ref([]);
const accountsLoading = ref(true);
const selectedAccountId = ref(null);
const emails = ref([]);
const selectedEmail = ref(null);
const mobileView = ref('accounts'); // 'accounts' | 'list' | 'detail'
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

const newAccount = ref({
  email: '',
  password: '',
  provider: '',
  imapHost: '',
  imapPort: 993,
  smtpHost: '',
  smtpPort: 465,
});

// Provider presets
const PROVIDER_PRESETS = {
  gmail: { imapHost: 'imap.gmail.com', imapPort: 993, smtpHost: 'smtp.gmail.com', smtpPort: 465 },
  outlook: { imapHost: 'outlook.office365.com', imapPort: 993, smtpHost: 'smtp.office365.com', smtpPort: 587 },
  qq: { imapHost: 'imap.qq.com', imapPort: 993, smtpHost: 'smtp.qq.com', smtpPort: 465 },
  '163': { imapHost: 'imap.163.com', imapPort: 993, smtpHost: 'smtp.163.com', smtpPort: 465 },
};

function onProviderChange() {
  const preset = PROVIDER_PRESETS[newAccount.value.provider];
  if (preset) {
    newAccount.value.imapHost = preset.imapHost;
    newAccount.value.imapPort = preset.imapPort;
    newAccount.value.smtpHost = preset.smtpHost;
    newAccount.value.smtpPort = preset.smtpPort;
  }
}

// Load accounts
async function loadAccounts() {
  accountsLoading.value = true;
  try {
    const { data } = await api.get('/emails/accounts');
    accounts.value = data;
    if (data.length > 0 && !selectedAccountId.value) {
      selectedAccountId.value = data[0].id;
      await loadEmails();
    }
  } catch (err) {
    console.error('Failed to load accounts:', err);
  } finally {
    accountsLoading.value = false;
  }
}

// Select account and load emails
async function selectAccount(acc) {
  selectedAccountId.value = acc.id;
  selectedEmail.value = null;
  showReplyArea.value = false;
  aiReplies.value = [];
  await loadEmails();
}

// Load emails for selected account
async function loadEmails() {
  if (!selectedAccountId.value) return;
  emailsLoading.value = true;
  try {
    const params = {};
    if (emailSearch.value) params.search = emailSearch.value;
    const { data } = await api.get(`/emails/accounts/${selectedAccountId.value}/emails`, { params });
    emails.value = data.emails || [];
  } catch (err) {
    console.error('Failed to load emails:', err);
  }
  emailsLoading.value = false;
}

// Select email
async function selectEmail(email) {
  showReplyArea.value = false;
  aiReplies.value = [];

  // Fetch full email content (with bodyHtml) if not already loaded
  if (!email.bodyHtml && email.id) {
    try {
      const { data } = await api.get(`/emails/detail/${email.id}`);
      selectedEmail.value = data;
      // Update local cache
      const idx = emails.value.findIndex(e => e.id === email.id);
      if (idx >= 0) emails.value[idx] = data;
    } catch (err) {
      console.error('Failed to load full email:', err);
      selectedEmail.value = email;
    }
  } else {
    selectedEmail.value = email;
  }

  // Mark as read
  if (!email.read) {
    try {
      await api.post(`/emails/${email.id}/read`);
      email.read = true;
    } catch (err) { /* ignore */ }
  }
}

// Sync emails
async function syncAccount(acc) {
  syncing.value = true;
  syncingId.value = acc.id;
  try {
    const { data } = await api.post(`/emails/accounts/${acc.id}/sync`);
    showToast(`同步完成，新增 ${data.synced} 封邮件`);
    if (selectedAccountId.value === acc.id) {
      await loadEmails();
    }
    await loadAccounts();
  } catch (err) {
    showToast('同步失败: ' + (err.response?.data?.error || err.message), 'error');
  }
  syncing.value = false;
  syncingId.value = null;
}

// Add account
async function addAccount() {
  addAccountError.value = '';
  addAccountSuccess.value = '';
  if (!newAccount.value.email || !newAccount.value.password) {
    addAccountError.value = '请填写邮箱地址和密码/授权码';
    return;
  }
  addingAccount.value = true;
  try {
    const { data } = await api.post('/emails/accounts', newAccount.value);
    addAccountSuccess.value = `邮箱 ${data.email} 添加成功！正在测试连接...`;
    
    // Test connection
    try {
      const testResult = await api.post(`/emails/accounts/${data.id}/test`);
      if (testResult.data.imap && testResult.data.smtp) {
        addAccountSuccess.value = `邮箱 ${data.email} 添加成功，连接正常！`;
      } else {
        addAccountSuccess.value = `邮箱已添加，但连接测试失败。IMAP: ${testResult.data.imap ? 'OK' : 'FAIL'}, SMTP: ${testResult.data.smtp ? 'OK' : 'FAIL'}`;
      }
    } catch (testErr) {
      addAccountSuccess.value = `邮箱已添加，但连接测试出错`;
    }

    await loadAccounts();
    setTimeout(() => {
      showAddAccountDialog.value = false;
      addAccountSuccess.value = '';
      newAccount.value = { email: '', password: '', provider: '', imapHost: '', imapPort: 993, smtpHost: '', smtpPort: 465 };
    }, 2000);
  } catch (err) {
    addAccountError.value = err.response?.data?.error || '添加失败';
  }
  addingAccount.value = false;
}

// Delete account
async function deleteAccount(acc) {
  if (!confirm(`确定要删除邮箱 ${acc.email} 吗？相关邮件记录也会被删除。`)) return;
  try {
    await api.delete(`/emails/accounts/${acc.id}`);
    if (selectedAccountId.value === acc.id) {
      selectedAccountId.value = null;
      emails.value = [];
      selectedEmail.value = null;
    }
    await loadAccounts();
    showToast('邮箱已删除');
  } catch (err) {
    showToast('删除失败', 'error');
  }
}

// Translate email
async function translateEmail(email) {
  translating.value = true;
  try {
    const { data } = await api.post(`/emails/${email.id}/translate`, { targetLang: 'zh' });
    email.translation = data.translation;
    email.sourceLang = data.sourceLang;
    showToast('翻译完成');
  } catch (err) {
    showToast('翻译失败', 'error');
  }
  translating.value = false;
}

// AI generate reply
async function aiReply(email) {
  generatingAI.value = true;
  try {
    const { data } = await api.post(`/emails/${email.id}/ai-reply`, { style: 'formal' });
    aiReplies.value = data.replies || [];
    showReplyArea.value = true;
    showToast('AI回复已生成');
  } catch (err) {
    showToast('AI回复生成失败', 'error');
  }
  generatingAI.value = false;
}

// Use AI reply
function useAiReply(reply) {
  replyText.value = reply;
}

// Match customer
async function matchCustomer(email) {
  matchingCustomer.value = true;
  try {
    const { data } = await api.post(`/emails/${email.id}/match-customer`);
    showToast(`客户匹配成功: ${data.name}`);
  } catch (err) {
    showToast('匹配失败', 'error');
  }
  matchingCustomer.value = false;
}

// Send reply
async function sendReply() {
  if (!replyText.value.trim()) return;
  sending.value = true;
  try {
    const replyTo = selectedEmail.value.from;
    // Extract email address from "from" field
    const emailMatch = replyTo.match(/<(.+?)>/);
    const toAddr = emailMatch ? emailMatch[1] : replyTo;

    await api.post('/emails/send', {
      accountId: selectedAccountId.value,
      to: toAddr,
      subject: `Re: ${selectedEmail.value.subject}`,
      body: replyText.value,
      html: replyText.value.replace(/\n/g, '<br>'),
    });
    showToast('邮件已发送');
    showReplyArea.value = false;
    replyText.value = '';
    aiReplies.value = [];
    await loadEmails();
  } catch (err) {
    showToast('发送失败: ' + (err.response?.data?.error || err.message), 'error');
  }
  sending.value = false;
}

// Helpers
function statusLabel(status) {
  const map = { connected: '已连接', disconnected: '未连接', error: '异常' };
  return map[status] || status;
}

function extractEmailName(from) {
  const nameMatch = from.match(/^"?([^"<]+)"?\s*</);
  return nameMatch ? nameMatch[1].trim() : from.split('@')[0];
}

function stripHtml(html) {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function formatText(text) {
  if (!text) return '';
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
}

function formatTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
}

function formatDateTime(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleString('zh-CN');
}

function showToast(message, type = 'success') {
  toast.value = { show: true, message, type };
  setTimeout(() => { toast.value.show = false; }, 3000);
}

let searchTimer;
function debouncedSearch() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => loadEmails(), 400);
}

// ── 发给 Agent（V1.0 F6 邮件入口） ──
const ASSIGN_AGENTS = [
  { type: 'sales-champion', icon: '🚀', name: '外贸销冠', desc: '智能跟单 · 话术 · 成交' },
  { type: 'background-report', icon: '🔍', name: '客户背调', desc: '背景调查 · 风险评估' },
  { type: 'customs-agent', icon: '📋', name: '外贸单证', desc: '报关单证 · HS编码' },
  { type: 'doc-agent', icon: '🏭', name: '工厂对接', desc: '验厂评估 · 生产跟进' },
  { type: 'freight-agent', icon: '🚢', name: '货代对接', desc: '海运空运 · 报关报检' },
  { type: 'legal-agent', icon: '⚖️', name: '外贸法务', desc: '合同审查 · 纠纷处理' },
];
const showAssignDialog = ref(false);
const assignCustomerLoading = ref(false);
const assignCustomer = ref(null);
const assignAgentType = ref('sales-champion');
const assignInstruction = ref('');
const assigning = ref(false);

function extractEmailAddr(fromStr) {
  if (!fromStr) return '';
  const m = String(fromStr).match(/<([^<>]+)>/);
  if (m) return m[1].trim();
  return String(fromStr).trim();
}
async function openEmailAssignDialog() {
  showAssignDialog.value = true;
  assignAgentType.value = 'sales-champion';
  assignInstruction.value = '';
  assignCustomer.value = null;
  const addr = extractEmailAddr(selectedEmail.value?.from || '');
  if (!addr) { return; }
  assignCustomerLoading.value = true;
  try {
    const { data } = await api.get('/customers?search=' + encodeURIComponent(addr) + '&pageSize=20');
    const list = (data && data.items) || [];
    assignCustomer.value = list.find(c => c.email && String(c.email).toLowerCase() === addr.toLowerCase()) || null;
  } catch (e) {
    assignCustomer.value = null;
  } finally { assignCustomerLoading.value = false; }
}
async function doAssignFromEmail() {
  if (!assignCustomer.value) return;
  assigning.value = true;
  try {
    const { data } = await api.post('/agent/tasks', {
      agentType: assignAgentType.value,
      customerIds: [assignCustomer.value.id],
      instruction: assignInstruction.value.trim() || null,
      source: 'email_page'
    });
    const r = (data.results || [])[0];
    if (r && r.status === 'failed') showToast(r.error || '指派失败', 'error');
    else showToast(r && r.status === 'exists' ? '该客户已在此 Agent 的指派任务中' : '指派成功，Agent 对话页即可选择该客户跟进');
    showAssignDialog.value = false;
  } catch (e) {
    showToast('指派失败', 'error');
  } finally { assigning.value = false; }
}

// Init
onMounted(() => {
  loadAccounts();
});
</script>

<style scoped>
.email-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--chat-bg);
  color: var(--text-primary);
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  background: var(--panel-header-bg);
  border-bottom: 1px solid var(--border-color);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-left h1 {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
}

.back-link {
  display: flex;
  align-items: center;
  color: var(--text-secondary);
  text-decoration: none;
}

.back-link:hover {
  color: var(--text-primary);
}

.email-content {
  flex: 1;
  display: flex;
  overflow: hidden;
}

/* Account Panel */
.account-panel {
  width: 260px;
  min-width: 260px;
  border-right: 1px solid var(--border-color);
  overflow-y: auto;
}

.account-item {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  cursor: pointer;
  border-bottom: 1px solid var(--border-color);
  transition: background 0.15s;
}

.account-item:hover {
  background: var(--panel-header-bg);
}

.account-item.active {
  background: var(--sidebar-active);
}

.account-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--accent);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 16px;
  color: var(--text-primary);
  flex-shrink: 0;
  margin-right: 12px;
}

.account-info {
  flex: 1;
  min-width: 0;
}

.account-email {
  font-size: 13px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.account-meta {
  display: flex;
  gap: 8px;
  margin-top: 2px;
}

.account-status {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 8px;
}

.account-status.connected { background: var(--accent); color: var(--text-primary); }
.account-status.disconnected { background: #6b7280; color: var(--text-primary); }
.account-status.error { background: #ef4444; color: var(--text-primary); }

.account-count {
  font-size: 11px;
  color: var(--text-secondary);
}

.account-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.15s;
}

.account-item:hover .account-actions {
  opacity: 1;
}

/* Email List Panel */
.email-list-panel {
  width: 340px;
  min-width: 340px;
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
}

.email-list-header {
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-color);
}

.email-search {
  width: 100%;
  padding: 8px 12px;
  border-radius: 8px;
  border: none;
  background: var(--input-bg);
  color: var(--text-primary);
  font-size: 13px;
  outline: none;
}

.email-search::placeholder {
  color: var(--text-secondary);
}

.email-list {
  flex: 1;
  overflow-y: auto;
}

.email-item {
  display: flex;
  padding: 12px 16px;
  cursor: pointer;
  border-bottom: 1px solid var(--border-color);
  transition: background 0.15s;
}

.email-item:hover {
  background: var(--panel-header-bg);
}

.email-item.active {
  background: var(--sidebar-active);
}

.email-item.unread {
  background: rgba(0, 168, 132, 0.08);
}

.email-item.unread .email-subject {
  font-weight: 600;
}

.email-sender-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 14px;
  color: var(--text-primary);
  flex-shrink: 0;
  margin-right: 12px;
}

.email-preview {
  flex: 1;
  min-width: 0;
}

.email-sender {
  font-size: 13px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.email-subject {
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-top: 2px;
}

.email-body-preview {
  font-size: 11px;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-top: 2px;
}

.email-time {
  font-size: 11px;
  color: var(--text-secondary);
  flex-shrink: 0;
  margin-left: 8px;
}

/* Email Detail Panel */
.email-detail-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  padding: 20px;
  background: var(--panel-bg);
}

.email-detail-header {
  margin-bottom: 16px;
}

.email-detail-subject {
  color: var(--text-primary);
  font-size: 20px;
  font-weight: 600;
  margin-bottom: 12px;
}

.email-detail-meta {
  font-size: 13px;
  color: var(--text-secondary);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.email-detail-meta strong {
  color: var(--text-primary);
}

.email-detail-actions {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.email-translation {
  background: rgba(0, 168, 132, 0.1);
  border: 1px solid rgba(0, 168, 132, 0.3);
  border-radius: 8px;
  padding: 12px 16px;
  margin-bottom: 16px;
}

.translation-label {
  font-size: 12px;
  color: var(--accent);
  font-weight: 500;
  margin-bottom: 6px;
}

.translation-text {
  font-size: 14px;
  line-height: 1.6;
}

.email-body {
  background: var(--panel-bg);
  color: var(--text-primary);
  flex: 1;
  font-size: 14px;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
}

.email-reply-area {
  margin-top: 20px;
  border-top: 1px solid var(--border-color);
  padding-top: 16px;
}

.ai-replies {
  margin-bottom: 16px;
}

.ai-replies-header {
  font-size: 13px;
  font-weight: 500;
  color: var(--accent);
  margin-bottom: 8px;
}

.ai-reply-option {
  padding: 10px 14px;
  background: var(--input-bg);
  border-radius: 8px;
  margin-bottom: 8px;
  cursor: pointer;
  font-size: 13px;
  line-height: 1.5;
  transition: background 0.15s;
  border: 1px solid transparent;
}

.ai-reply-option:hover {
  background: var(--panel-header-bg);
  border-color: var(--accent);
}

.reply-textarea {
  width: 100%;
  min-height: 120px;
  padding: 12px;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  background: var(--input-bg);
  color: var(--text-primary);
  font-size: 14px;
  font-family: inherit;
  resize: vertical;
  outline: none;
  margin-bottom: 12px;
}

.reply-textarea:focus {
  border-color: var(--accent);
}

.reply-actions {
  display: flex;
  gap: 8px;
}

.reply-trigger {
  margin-top: 20px;
  border-top: 1px solid var(--border-color);
  padding-top: 16px;
}

/* Common */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 12px;
  color: var(--text-secondary);
  padding: 20px;
  text-align: center;
}

.btn-primary {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: none;
  border-radius: 8px;
  background: var(--accent);
  color: var(--accent-text);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
}

.btn-primary:hover { background: var(--accent-hover); }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

.btn-secondary {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: transparent;
  color: var(--text-primary);
  font-size: 13px;
  cursor: pointer;
  transition: background 0.15s;
}

.btn-secondary:hover { background: var(--panel-header-bg); }
.btn-secondary:disabled { opacity: 0.6; cursor: not-allowed; }

.btn-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background 0.15s;
}

.btn-icon:hover { background: var(--sidebar-hover, var(--sidebar-active)); }
.btn-icon.btn-danger:hover { background: rgba(239, 68, 68, 0.2); color: #ef4444; }
.btn-icon:disabled { opacity: 0.4; cursor: not-allowed; }

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Dialog */
.dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dialog-box {
  background: var(--panel-header-bg);
  border-radius: 12px;
  width: 480px;
  max-width: 90vw;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
}

.dialog-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.dialog-body {
  padding: 20px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px 20px;
  border-top: 1px solid var(--border-color);
}

.form-group {
  margin-bottom: 14px;
}

.form-group label {
  display: block;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: 6px;
}

.form-group input,
.form-group select {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--input-bg);
  color: var(--text-primary);
  font-size: 14px;
  outline: none;
}

.form-group input:focus,
.form-group select:focus {
  border-color: var(--accent);
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.form-error {
  color: #ef4444;
  font-size: 13px;
  padding: 8px 12px;
  background: rgba(239, 68, 68, 0.1);
  border-radius: 8px;
}

.form-success {
  color: var(--accent);
  font-size: 13px;
  padding: 8px 12px;
  background: rgba(0, 168, 132, 0.1);
  border-radius: 8px;
}

/* Toast */
.toast {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 13px;
  z-index: 2000;
  animation: toastIn 0.3s ease;
}

.toast.success { background: var(--accent); color: var(--text-primary); }
.toast.error { background: #ef4444; color: var(--text-primary); }

@keyframes toastIn {
  from { opacity: 0; transform: translateX(-50%) translateY(10px); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
}

/* Mobile back button */
.mobile-back-btn {
  display: none;
  background: none;
  border: none;
  color: var(--text-primary);
  cursor: pointer;
  padding: 4px;
  margin-right: 8px;
}

/* Mobile responsive */
@media (max-width: 768px) {
  .account-panel { width: 100%; min-width: 100%; }
  .email-list-panel { display: none; }
  .email-detail-panel { display: none; }
  .email-content { flex-direction: column; }
  .mobile-back-btn { display: flex; align-items: center; }
  .email-page .email-detail-actions { flex-wrap: wrap; gap: 6px; }
  .email-page .email-detail-actions button { flex: 1; min-width: 80px; }
}
.assign-email-btn { border-color: var(--whatsapp, #25d366) !important; color: var(--whatsapp, #25d366) !important; }
.assign-dialog { width: 92%; max-width: 460px; background: #fff; border-radius: 14px; overflow: hidden; box-shadow: 0 12px 40px rgba(0,0,0,.25); }
.assign-dialog-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; font-weight: 600; font-size: 15px; border-bottom: 1px solid rgba(0,0,0,.08); }
.assign-dialog-close { background: none; border: none; color: #666; font-size: 16px; cursor: pointer; }
.assign-dialog-body { padding: 14px 18px; }
.assign-loading { color: #888; font-size: 13px; padding: 10px 0; }
.assign-cust-info { display: flex; align-items: center; gap: 8px; background: rgba(37,211,102,.1); padding: 8px 12px; border-radius: 8px; margin-bottom: 12px; font-size: 13px; }
.assign-cust-info.warn { background: rgba(245,158,11,.12); color: #b45309; }
.aci-icon { font-size: 15px; }
.aci-name { font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.aci-email { color: #888; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.assign-agents { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-bottom: 12px; }
.assign-agent-card { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 10px; border: 1.5px solid rgba(0,0,0,.12); cursor: pointer; transition: all .15s; background: #fff; }
.assign-agent-card:hover { border-color: #25d366; }
.assign-agent-card.active { border-color: #25d366; background: rgba(37,211,102,.08); }
.aa-icon { font-size: 20px; }
.aa-info { flex: 1; min-width: 0; }
.aa-name { font-size: 13px; font-weight: 600; }
.aa-desc { font-size: 11px; color: #888; }
.aa-check { color: #25d366; font-weight: 700; font-size: 16px; }
.assign-input { width: 100%; box-sizing: border-box; padding: 8px 10px; border-radius: 8px; border: 1px solid rgba(0,0,0,.15); font-size: 13px; resize: vertical; }
.assign-dialog-footer { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 18px; border-top: 1px solid rgba(0,0,0,.08); }
.assign-dialog-btn { padding: 7px 16px; border-radius: 8px; border: none; font-size: 13px; cursor: pointer; font-weight: 500; }
.assign-dialog-btn.cancel { background: #f0f0f0; color: #333; }
.assign-dialog-btn.primary { background: #25d366; color: #fff; }
.assign-dialog-btn:disabled { opacity: .5; cursor: not-allowed; }

/* 邮箱账号加载骨架屏 */
.account-skeleton-wrap { padding: 8px 0; }
.account-skeleton {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 16px;
}
.skeleton-avatar {
  width: 36px; height: 36px; border-radius: 50%;
  background: var(--border-color, #e5e7eb);
  animation: skeleton-pulse 1.2s ease-in-out infinite;
}
.skeleton-lines { flex: 1; display: flex; flex-direction: column; gap: 8px; }
.skeleton-line {
  height: 12px; border-radius: 4px;
  background: var(--border-color, #e5e7eb);
  animation: skeleton-pulse 1.2s ease-in-out infinite;
}
.w80 { width: 80%; } .w50 { width: 50%; }
@keyframes skeleton-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
</style>
