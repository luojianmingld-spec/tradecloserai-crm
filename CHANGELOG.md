# TradeCloser CRM 版本更新日志

> 项目：外贸合伙人派单 CRM（WhatsApp + Telegram + Email）
> 仓库：/opt/whatsapp-crm（production）/ /opt/whatsapp-crm-staging（staging）
> 版本规范：v主版本.次版本.修订号

---

## v1.9.0 — 2026-08-03 【当前版本】

### 🐛 Bug 修复
- **WA 多账号对话列表跨实例过滤**：修复 WhatsApp 多设备同步导致 Main 账号显示 Eric 客户的问题
  - 根因：Baileys 多设备同步将 Eric 的消息复制到 Main 的 session（user_1），导致 Conversation 表积累了跨实例消息
  - 修复：server.js conversations 端点增加 `otherWaPhones` 过滤，排除 `to`/`from` 指向其他 WA 账号的消息
  - 修复：Evolution fetchChats 同样应用跨实例过滤
  - 修复：evolution-webhook.js processOneMessage 增加 ownerJid 归属检查，防止未来脏数据
  - 效果：Main 从 20 个客户 → 6-7 个（与官方 WhatsApp 一致）
- **渠道切换菜单 WA 子账号点击无反应**：修复 LayoutView.vue 中 WA 子账号菜单项点击事件未正确绑定
- **前端切换账号后对话列表未刷新**：chat.js fetchConversations 增加 accountId 参数，切换后自动重载

### 🔒 安全加固（2026-07-31）
- Helmet 安全头 + RateLimit 限流
- JWT 强密钥 + AI Key 加密存储
- RBAC 三角色权限控制（admin/agent/viewer）

### 📦 产品知识库智能导入（2026-07-31）
- URL 爬取 + 文件解析 + AI 三步导入
- 侧边栏排序优化（常用功能前置）

### 📋 涉及文件
- `backend/src/server.js` — conversations 端点跨实例过滤
- `backend/src/routes/evolution-webhook.js` — webhook 跨实例拦截
- `frontend/src/views/LayoutView.vue` — 渠道切换菜单修复
- `frontend/src/stores/chat.js` — 切换账号刷新对话列表

---

## v1.8.0 — 2026-08-01

### 📝 文档
- 添加 TradeCloser AI 产品 PRD 路线图

### 🔧 工程改进
- Staging 环境隔离（独立数据库 crm-staging.db）
- 收尾回复功能（closing-reply feature）快照
- 清理冗余备份文件，完善 .gitignore

### 📋 Commit: `2d8c543` → `369a41c`

---

## v1.7.0 — 2026-07-27

### ✨ 新功能
- **客户城市字段** + 城市时区自动映射
- **暗色主题下拉修复**
- **CRM 话题追踪能力**（持续跟踪客户/行业动态）
- **Assistant 全能外贸助手升级**
  - 汇率查询、联网搜索、邮件发送
  - 客户分析、CI 合同报关单识别
- **欢迎页自我介绍** + 快捷提问词
- **语音 UI 重设计**（Coze 风格）
- **工作台 → 数据概览** 栏目重命名 + 顺序调整

### 🐛 Bug 修复
- 文化面板（culture-panel）手机端底部被 tabbar 遮挡
- Prisma attachments 字段缺失
- TG poll flood wait 最终修复
- Prisma DATABASE_URL 路径解析错误 + 端口配置
- 前端时间文化面板 CN 数据缺失 + 模板防御性检查
- TG 发送 platform 变量未定义 + 翻译 fallback 优化
- TG UserBot sendMessage 使用 sent.id fallback（修复 unique constraint crash）
- TG 发送包含翻译内容 + whatsapp:message_sent 事件
- TG 发送去重（避免 retry 时 unique constraint crash）
- 页面切换 chunk 下载延迟优化（eager-import）
- Assistant 欢迎头像尺寸约束 80x80
- WA/TG 频道 loading 状态分离
- TG col-header 重复标题修复
- TG 会话时间文化面板国家码识别 + 空状态手机端显示
- TG mh-menu-mask 阻止下拉菜单点击

### 📋 Commits: `4286c3c` → `b7d8e82`

---

## v1.6.0 — 2026-07-26（TG UserBot 接入 + PDF 生成）

### ✨ 新功能
- **Telegram User Bot 完整接入**
  - GramJS 个人号登录 + 联系人同步
  - 实时消息监听 + JID 格式统一
  - 前端设置页 + 联系人/对话同步 API
- **TG 会话页工具栏** 对标 WhatsApp
- **TG 发送翻译** + 头像同步 + 账号过滤
- **PDF 文档生成**（报价单 / PI / 通用文档）
- **外贸智能体 PDF 意图识别** + 文件卡片预览下载
- **部署脚本** staging/prod/promote/rollback 自动化
- **技能开关** iOS 风格胶囊 toggle

### 🐛 Bug 修复
- TG 消息收发全链路修复（UserBot 路由 / WAConnection FK / 历史回填 / 自聊天过滤）
- TG 会话列表不显示 + 联系人同步 JID 格式不一致
- TG 发送消息译文 + 重复消息修复
- documents 静态路由路径修正
- AI 助理输入框高度 + Enter 换行 + query_messages 长度错误
- Build 内存限制 256→512MB 避免 OOM

### 📋 Commits: `5d7011d` → `a68cf51`

---

## v1.5.0 — 2026-07-23（三渠道统一 + 画像面板）

### ✨ 新功能
- **三渠道统一切换**（WA / TG / Email 图标统一，跨渠道跳转）
- **客户画像 v9.2a**
  - 4 Tab 画像面板（基本信息 / 对话记录 / 背调 / 分析）
  - ABCD 客户分层 + 渠道徽章
- **WA 官方 Logo 替换**（渠道切换按钮使用官方图标）
- **三渠道首栏折叠**（展开收拢 + 状态持久化）

### 🐛 Bug 修复
- 文化 badge 空值保护（无映射国家码不再崩溃）
- TG webhook 冲突修复，全功能对齐 WA

---

## v1.4.0 — 2026-07-21（v9.1 稳基）

### ✨ 新功能
- 探迹 Token 降本 87%

### 🐛 Bug 修复
- 入站 Socket 断连 bug 修复
- 翻译速度优化至亚秒级
- 脏数据自清理机制
- 实时推送 5 层加固（nginx 3600s + 关缓冲 / 后端 ping 25s / pingTimeout 60s / backfill 60s / 前端无限重试）

---

## v1.3.0 — 2026-06-19（移动端 + 部署稳定化）

### ✨ 新功能
- **移动端响应式适配**（375px 手机端布局）
- **客户需求总结功能**（结构化 AI 分析 + 意向度评分）
- **AI 生成回复话术**（3 种风格 + 一键插入）
- **双向实时翻译**（豆包 / DeepSeek 双引擎）

### 🐛 Bug 修复
- WhatsApp 二维码获取失败（网络错误检测 + 有限重连 + QR 超时）
- Baileys 依赖安装超时降级
- Prisma 关联缺失导致 DB 状态更新失败
- 构建脚本 + 路径修复
- 生产环境只读 fs 导致 sessions 目录创建失败

### 📋 Commits: `596ee3f` → `5ca96e7`

---

## v1.2.0 — 2026-06-17（AI 接入）

### ✨ 新功能
- **接入豆包 Doubao-2.0-pro AI 能力**

### 🐛 Bug 修复
- 注册登录功能健壮化（数据库初始化 + 认证流程）
- 部署路径问题 + Baileys 依赖超时
- 部署 instance_not_found 根因修复
- Express 5 路由兼容 + 端口逻辑 + 硬编码路径
- 后端频繁挂掉 → 进程守护 + 全局错误处理

### 📋 Commits: `72b3319` → `70c121c`

---

## v1.1.0 — 2026-06-16（核心功能）

### ✨ 新功能
- **WhatsApp CRM 外贸客户管理系统核心功能**
  - 全量消息收发 / 翻译 / 回执
  - 客户管理模块

### 📋 Commits: `e7b5b62` → `325e846`

---

## v1.0.0 — 2026-06-15（项目启动）

### ✨ 初始功能
- 项目初始化
- 基础部署流水线搭建
- 数据库 + Prisma ORM 配置

### 📋 Commit: `590463f`

---

## 版本管理规范

- 所有迭代必须有版本号，每个版本 git tag + commit
- 改动先在 staging 验证 → 主人确认 → 推 production
- Tag 格式：`vX.Y.Z`（如 `v1.9.0`）
- CHANGELOG 同步更新
