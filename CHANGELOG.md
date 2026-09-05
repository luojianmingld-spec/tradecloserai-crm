# TradeCloser CRM 版本更新日志

> 项目：外贸合伙人派单 CRM（WhatsApp + Telegram + Email）
> 仓库：/opt/whatsapp-crm（production）/ /opt/whatsapp-crm-beta（beta）/ /opt/whatsapp-crm-staging（staging）
> 版本规范：v主版本.次版本.修订号
> 治理起点：2026-09-04 Git 工程治理基线（AGENTS / PROJECT_STATE / ARCHITECTURE / AI_CODING_RULES / SECURITY / TESTING / BUG_FIX_SOP）

---

## v1.9.1 — 2026-09-04 【当前版本】

### 🚀 工程治理基线（Week 1）
- 服务器代码纳入 Git 管理，建立第一次基线 Commit
- 9 个治理文件落盘项目根目录：AGENTS.md / PROJECT_STATE.md / ARCHITECTURE.md / AI_CODING_RULES.md / SECURITY.md / TESTING.md / BUG_FIX_SOP.md / CHANGELOG.md / SECURITY_INCIDENTS.md
- 总规则：任何 AI Agent 读取代码前必须先读治理文件；冲突操作停止并报告
- Git 安全清理：session.txt / crm.log / uploads 媒体文件移除跟踪；remote URL 明文 Token 清理
- 备份：三环境时间戳备份 /root/git_governance_backup_20260904/

### 🛡 安全事件处置（INC-2026-09-04-001）
- **事件**：GitHub PAT 与 TG session.txt 曾进入 Git 历史并推送到远端
- **处置**：Token 撤销 + TG session 轮换 + git filter-repo 重写历史（清除 session.txt / crm.db / .env.bak / 日志 / uploads / tar.gz）+ remote URL 全部去 Token + force push
- **新增**：SECURITY_INCIDENTS.md 安全事件记录文件，后续安全事件必须登记
- **验证**：历史中敏感文件归零；.env/session/db/uploads 均不在 git 跟踪

### 🐛 TG 扫码登录 + 登录后体验修复（beta）
- **扫码登录修复**：后端 tg-userbot-connector 4 处 + 前端 1 处；扫码后正常登录
- **循环弹窗防重**：修复登录后循环弹窗
- **头像同步**：登录后自动 sync-avatars + 前端 loadAvatar(jid, avatar) 传参修复渲染断链
- **历史消息**：改调 /api/tg-userbot/history 实时拉取，Rachel 会话验证通过
- 新租户天然生效（修复在源码层）

### 🎁 积分充值新增 50 元档位（2026-09-05）
- 档位：50/100/200/500/1000 元 + 自定义，起充金额 100 → 50 元
- 后端：credits.js MIN_RECHARGE_YUAN=50，RECHARGE_PRESETS 增加 50
- 前端：CreditsView.vue 新增 ¥50 档位卡片、自定义最低金额、起充文案同步
- 验证：Jeremy 亲测通过（2026-09-05 15:21），API 冒烟 minRechargeYuan=50 + 50元订单 50000 积分

### 🛡 安全加固（继承）
- Helmet 安全头 + RateLimit 限流
- JWT 强密钥 + AI Key 加密存储
- RBAC 三角色权限控制（admin/agent/viewer）

---

## v1.9.0 — 2026-08-03 【历史版本】

### 🐛 Bug 修复
- **WA 多账号对话列表跨实例过滤**：修复 WhatsApp 多设备同步导致 Main 账号显示 Eric 客户的问题
  - 根因：Baileys 多设备同步将 Eric 的消息复制到 Main 的 session（user_1），导致 Conversation 表积累了跨实例消息
  - 修复：server.js conversations 端点增加 `otherWaPhones` 过滤
  - 修复：Evolution fetchChats 同样应用跨实例过滤
  - 修复：evolution-webhook.js processOneMessage 增加 ownerJid 归属检查
  - 效果：Main 从 20 个客户 → 6-7 个（与官方 WhatsApp 一致）
- **渠道切换菜单 WA 子账号点击无反应**：修复 LayoutView.vue 中 WA 子账号菜单项点击事件未正确绑定
- **前端切换账号后对话列表未刷新**：chat.js fetchConversations 增加 accountId 参数，切换后自动重载

### 📦 产品知识库智能导入（2026-07-31）
- URL 爬取 + 文件解析 + AI 三步导入
- 侧边栏排序优化（常用功能前置）

---

## v1.8.0 — 2026-08-01

### 📝 文档
（历史版本详情见旧版 CHANGELOG）
