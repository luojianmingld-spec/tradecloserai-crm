# AGENTS.md - WhatsApp CRM 外贸客户管理系统

## 项目概览
面向外贸行业的 WhatsApp CRM 系统，核心功能：多账号聊天、客户管理、实时翻译、AI话术生成、需求总结。

## 技术栈
- **前端**: Vue 3 + Element Plus + Pinia + Vue Router + Socket.io-client + Vite
- **后端**: Node.js (ESM) + Express 5 + Socket.io + @whiskeysockets/baileys
- **数据库**: SQLite + Prisma ORM
- **认证**: JWT (Bearer token)

## 项目结构
```
/workspace/projects/
├── .coze                    # 项目配置（构建/运行命令）
├── backend/
│   ├── prisma/schema.prisma # 数据库模型
│   └── src/
│       ├── server.js        # 入口：Express + Socket.io + 生产静态服务
│       ├── middleware/auth.js # JWT 认证中间件
│       ├── routes/          # REST API 路由 (auth, accounts, contacts, messages, settings, translation, whatsapp, customers, ai)
│       ├── services/whatsapp-provider.js  # WhatsApp Provider 抽象层 (Baileys)
│       ├── services/ai.service.js # 统一 AI 服务（翻译/话术/总结，使用 coze-coding-dev-sdk）
│       ├── services/translation.js # 翻译服务（豆包/DeepSeek + 缓存 + 语言检测）
│       ├── services/ai-reply.js   # AI回复话术生成
│       ├── services/ai-summarize.js # AI客户需求总结
│       ├── services/ai-reply.js   # AI回复话术生成
│       ├── services/ai-summarize.js # AI客户需求总结
│       └── socket/handlers.js    # Socket.io 事件处理
│   └── vendor/
│       ├── libsignal/           # 本地 vendored libsignal（避免 GitHub 超时）
│       └── eslint-config-dummy/ # 空替代包（Baileys 误将 eslint-config 放入 dependencies）
├── frontend/
│   └── src/
│       ├── main.js / App.vue
│       ├── router/          # Vue Router (login, chat)
│       ├── stores/          # Pinia (auth, chat)
│       ├── utils/           # api.js (axios), socket.js (socket.io-client)
│       ├── views/           # LoginView, ChatView, SettingsView, CustomersView
│       └── components/chat/ # ChatWindow, CustomerPanel
```

## 构建和运行命令
- **部署构建**: `bash build.sh`（安装前后端依赖 + Prisma + 前端构建）
- **部署启动**: `bash start.sh`（生产模式，从 DEPLOY_RUN_PORT 读端口）
- **开发模式**: `bash start-dev.sh`（后端3001 + 前端Vite DEPLOY_RUN_PORT）
- **Prisma 生成**: `cd backend && npx prisma generate && npx prisma db push`
- **手动安装**: `cd backend && pnpm install && cd ../frontend && pnpm install`

## API 端点
- `POST /api/auth/login` - 登录
- `POST /api/auth/register` - 注册
- `GET /api/accounts` - WhatsApp 账号列表
- `POST /api/accounts` - 创建账号
- `GET /api/contacts` - 联系人列表
- `PUT /api/contacts/:id` - 更新联系人
- `GET /api/messages` - 消息列表
- `GET /api/messages/conversations` - 会话列表
- `GET /api/settings` - 获取设置
- `PUT /api/settings` - 更新设置
- `POST /api/translation/translate` - 翻译文本
- `POST /api/translation/translate-outgoing` - 翻译发送消息
- `POST /api/translation/detect-language` - 检测语言
- `POST /api/ai/translate` - AI翻译（使用 coze-coding-dev-sdk）
- `POST /api/ai/reply` - AI生成回复话术（参数：messages/style 或 accountId/jid/style）
- `POST /api/ai/summarize` - AI客户需求总结（参数：messages 或 accountId/jid）
- `POST /api/whatsapp/qr` - 生成WhatsApp二维码
- `POST /api/whatsapp/send` - 发送WhatsApp消息
- `GET /api/whatsapp/status` - 获取连接状态
- `POST /api/whatsapp/disconnect` - 断开连接
- `GET /api/whatsapp/connections` - 获取所有连接
- `GET /api/whatsapp/messages` - 获取聊天消息
- `GET /api/whatsapp/conversations` - 获取会话列表
- `GET /api/customers` - 客户列表（支持search/tag/status筛选）
- `GET /api/customers/:id` - 客户详情
- `POST /api/customers` - 创建客户
- `PUT /api/customers/:id` - 更新客户
- `DELETE /api/customers/:id` - 删除客户
- `GET /api/customers/by-phone/:phone` - 按手机号查找客户

## Socket.io 事件
- `whatsapp:request_qr` - 请求二维码
- `whatsapp:qr` - 接收二维码
- `whatsapp:status` - 连接状态更新
- `whatsapp:send_message` - 发送消息（支持 autoTranslate 参数）
- `whatsapp:message` - 收到新消息（含 translation 字段）
- `whatsapp:message_sent` - 消息发送确认（含 translation 信息）
- `whatsapp:mark_read` - 标记已读
- `translation:translate` - 实时翻译
- `translation:get_settings` - 获取翻译设置
- `translation:update_settings` - 更新翻译设置

## 数据库
SQLite (backend/prisma/crm.db)，使用 Prisma 管理。模型：User, WhatsAppAccount, Contact, Message, Conversation, Setting, TranslationCache, WAConnection, WAMessage, Customer。

## 翻译系统
- **引擎**: 豆包 (doubao-seed-2-0-lite) 和 DeepSeek (deepseek-v3-2)
- **语言检测**: 先用字符模式快速检测，不确定时调用 LLM
- **缓存**: 内存缓存 + 数据库 TranslationCache 表，相同内容不重复调用
- **API Key**: 存储在 Settings 表，留空使用系统默认配置
- **自动翻译**: 收到消息自动翻译为目标语言，发送时可选自动翻译

## AI服务 (ai.service.js)
- **统一AI服务**: 使用 coze-coding-dev-sdk，支持5个模型(doubao-pro/lite/mini, deepseek, kimi)
- **AI翻译** (/api/ai/translate): 支持多语言互译
- **AI回复** (/api/ai/reply): 基于消息历史生成2-3个回复选项，支持3种风格（formal/friendly/concise）
- **需求总结** (/api/ai/summarize): 生成结构化客户需求分析（意向产品、规模、价格敏感度、交付要求等）
- **前端Tab**: 右侧面板4个Tab（客户/翻译/AI回复/需求总结）

## WhatsApp Provider (whatsapp-provider.js)
- **BaileysProvider**: 抽象层，封装 Baileys 连接管理
- **动态import**: ESM-only Baileys 通过 `_loadBaileys()` 动态加载
- **QR码**: connect() 触发连接，QR通过 EventEmitter 异步推送 → server.js 桥接到 Socket.io
- **消息收发**: sendMessage() / 事件转发 (message/message_sent)
- **事件桥接**: server.js 监听 provider events (qr/connected/disconnected/message) 并 emit 到 Socket.io room

## 代码风格
- 后端使用 ESM (`"type": "module"`)
- 前端使用 Vue 3 Composition API (`<script setup>`)
- CSS 变量定义在 `frontend/src/styles/global.css`，遵循 WhatsApp 深色模式设计语言

## 关键注意事项
- Baileys 是 ESM-only 库，后端必须使用 ESM
- **Baileys 为可选依赖**: 移至 `optionalDependencies`，安装失败时 WhatsApp 功能降级但核心 CRM 可用
- **WhatsApp 动态加载**: `whatsapp.js` 和 `handlers.js` 通过动态 `import()` 加载 Baileys，启动时不会因 Baileys 缺失而崩溃
- WhatsApp 认证数据存储在 `backend/sessions/` 目录
- Socket.io 房间机制：每个用户加入 `user_{userId}` 房间
- 默认管理员账号：admin / admin123（首次启动自动创建）
- **GitHub 依赖已 vendor 化**: libsignal 和 eslint-config 使用本地 vendor 目录 + pnpm overrides，部署容器无需访问 GitHub
- **Prisma 版本锁定**: 6.8.2（7.x schema 不兼容）
- **Express 5 通配路由**: 使用 `{*path}` 语法而非 `*`
- **生产模式前端路径**: server.js 使用 `process.cwd()` + `../frontend/dist` 定位（需从 backend/ 目录启动）
- **构建脚本**: build.sh/start.sh 使用 `COZE_WORKSPACE_PATH` + `SCRIPT_DIR` 双重定位，支持任意工作目录执行
- **.coze 配置**: dev/deploy 均使用 `sh -c` 确保 `${COZE_WORKSPACE_PATH}` 变量正确展开

## 客户管理模块
- **数据模型**: Customer (name/phone/email/company/country/tags/notes/source/intentLevel/status/assignedTo)
- **CRUD API**: /api/customers — 支持 search/tag/status 筛选
- **前端页面**: /customers — CustomersView.vue (表格+统计+新增/编辑弹窗)
- **意向度**: 1-10 评分，前端以进度条可视化
- **状态枚举**: potential/active/vip/inactive/lost
- **标签系统**: JSON 数组存储，逗号分隔输入
- **WhatsApp 自动建档**: handlers.js 收到新消息时自动查找/创建 Customer 记录
