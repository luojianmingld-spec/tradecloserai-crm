# ARCHITECTURE.md — 系统架构

> 本文件回答「系统应该是什么样」。架构变更时必须同步更新。

## 总体架构
单 VPS 部署，前后端同源构建：

```
前端 Vue3 (dist 静态) ── HTTP/WS ──> Express 5 后端 ──> PostgreSQL (Prisma)
                                         │
              ┌──────────────────────────┼──────────────────────────┐
         Baileys (WA)              GramJS (TG)               AI service
         多账号连接池             userbot 连接            豆包/DeepSeek/Kimi
```

## 分层
- **API 层**：backend/src/routes/（auth / accounts / customers / messages / translation / ai / whatsapp / tg-userbot / background-check / ...）
- **服务层**：backend/src/services/（whatsapp-provider / ai.service / translation / ai-reply / ai-summarize / tg-userbot-connector / ...）
- **数据层**：Prisma schema + PostgreSQL
- **实时层**：Socket.io（whatsapp:qr/status/message/message_sent、tg 事件）
- **前端**：Vue3 视图（LoginView / LayoutView / ChatView / CustomersView / SettingsView / BackgroundCheck...）+ Pinia stores（auth / chat）

## 关键链路
1. **TG 扫码登录**：POST /api/tg-userbot/qr → /qr/poll 轮询 → 写 session.txt → state connected
2. **TG 历史消息**：GET /api/tg-userbot/history?peerId=X&limit=50（前端 @telegram jid 路由；getHistory 返回 {id,text,fromMe,timestamp,mediaType,raw}，前端映射 body/content/fromMe/timestamp/messageType/mediaType）
3. **TG 头像同步**：POST /api/tg-userbot/sync-avatars（只处理 null；无公开头像属平台特性）
4. **消息收发**：Baileys/GramJS 事件 → socket 转发 → 前端实时渲染
5. **翻译**：收到消息自动翻译（字符检测 → LLM → 缓存 TranslationCache）
6. **AI**：ai.service 统一 5 模型（doubao-pro / doubao-lite / doubao-mini / deepseek / kimi）

## 数据模型（Prisma）
User / WhatsAppAccount / Contact / Message / Conversation / Setting / TranslationCache / WAConnection / WAMessage / Customer / TelegramContact（TG 联系人）等

## 多租户设计
- 租户零安装零学习，Agent 全云端干活；租户永远只做「看一眼、点一下」
- 积分体系：Agent 每次执行任务扣租户积分（统一计量）
- 账号体系：RBAC admin/agent/viewer 三角色

## 部署拓扑
- systemd 服务管理；Nginx 反代 + HTTPS
- 构建：bash build.sh（前后端依赖 + Prisma + 前端构建）；启动：bash start.sh（DEPLOY_RUN_PORT）
