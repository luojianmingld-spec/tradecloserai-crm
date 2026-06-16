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
│       ├── routes/          # REST API 路由 (auth, accounts, contacts, messages, settings, translation)
│       ├── services/whatsapp.js  # Baileys WhatsApp 连接管理
│       ├── services/translation.js # 翻译服务（豆包/DeepSeek + 缓存 + 语言检测）
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
│       ├── views/           # LoginView, ChatView
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
- `GET /api/settings` - 获取翻译设置
- `PUT /api/settings` - 更新翻译设置
- `POST /api/translation/translate` - 翻译文本
- `POST /api/translation/translate-outgoing` - 翻译发送消息
- `POST /api/translation/detect-language` - 检测语言
- `POST /api/ai/generate-reply` - AI生成回复话术（参数：accountId, jid, style）
- `POST /api/ai/summarize-need` - AI客户需求总结（参数：accountId, jid）

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
SQLite (backend/prisma/crm.db)，使用 Prisma 管理。模型：User, WhatsAppAccount, Contact, Message, Conversation, Setting, TranslationCache。

## 翻译系统
- **引擎**: 豆包 (doubao-seed-2-0-lite) 和 DeepSeek (deepseek-v3-2)
- **语言检测**: 先用字符模式快速检测，不确定时调用 LLM
- **缓存**: 内存缓存 + 数据库 TranslationCache 表，相同内容不重复调用
- **API Key**: 存储在 Settings 表，留空使用系统默认配置
- **自动翻译**: 收到消息自动翻译为目标语言，发送时可选自动翻译

## AI回复与需求总结
- **AI回复** (services/ai-reply.js): 基于最近20条消息生成2-3个回复选项，支持3种风格（formal/friendly/concise）
- **需求总结** (services/ai-summarize.js): 基于最近30条消息生成结构化客户需求分析
- **总结维度**: 意向产品、需求规模、价格敏感度、交付要求、核心关注点、客户风格、下一步行动、意向度评分(1-10)
- **共用引擎**: 与翻译功能共用豆包/DeepSeek引擎和API Key配置
- **前端Tab**: 右侧面板4个Tab（客户/翻译/AI回复/需求总结）

## 代码风格
- 后端使用 ESM (`"type": "module"`)
- 前端使用 Vue 3 Composition API (`<script setup>`)
- CSS 变量定义在 `frontend/src/styles/global.css`，遵循 WhatsApp 深色模式设计语言

## 关键注意事项
- Baileys 是 ESM-only 库，后端必须使用 ESM
- WhatsApp 认证数据存储在 `backend/sessions/` 目录
- Socket.io 房间机制：每个用户加入 `user_{userId}` 房间
- 默认管理员账号：admin / admin123（首次启动自动创建）
- **GitHub 依赖已 vendor 化**: libsignal 和 eslint-config 使用本地 vendor 目录 + pnpm overrides，部署容器无需访问 GitHub
- **Prisma 版本锁定**: 6.8.2（7.x schema 不兼容）
- **Express 5 通配路由**: 使用 `{*path}` 语法而非 `*`
- **生产模式前端路径**: server.js 使用 `process.cwd()` + `../frontend/dist` 定位（需从 backend/ 目录启动）
- **构建脚本**: build.sh/start.sh 使用 `SCRIPT_DIR` 定位项目根，支持任意工作目录执行
