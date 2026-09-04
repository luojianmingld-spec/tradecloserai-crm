# AGENTS.md — TradeCloser AI 工程治理入口

> 本文件是项目最高治理入口。任何 AI Agent（Codex / Claude Code / Cursor / 其他）在读取项目代码之前，必须先读取本项目治理文件。

## 项目一句话
TradeCloser AI：外贸 Agent SaaS 平台。CRM（客户管理/消息收发/翻译/背调）+ WhatsApp/Telegram 消息中枢 + AI Agent 任务系统。

## 技术栈
- 后端：Node.js (ESM) + Express 5 + Socket.io + Prisma ORM
- 数据库：PostgreSQL（非 SQLite！）
- 前端：Vue 3 + Element Plus + Pinia + Vite
- 消息：@whiskeysockets/baileys (WA) + GramJS (TG)
- AI：统一 ai.service（豆包/DeepSeek/Kimi 等）

## 部署环境
| 环境 | 端口 | 路径 | 用途 |
|------|------|------|------|
| staging | 3003 | /opt/whatsapp-crm-staging | 开发验证（唯一允许改代码） |
| beta | 3004 | /opt/whatsapp-crm-beta | 客户验收（改前必须 Jeremy 同意） |
| production | 3000 | /opt/whatsapp-crm | 生产（2026年12月前一律不动） |
| 测试 | 3002 | /opt/whatsapp-crm-test | Codex 测试环境 |

## 强制阅读顺序
任何 Agent 开始开发前，必须按顺序读取：
1. AGENTS.md（本文件）
2. PROJECT_STATE.md（系统现在实际上是什么样）
3. ARCHITECTURE.md（系统应该是什么样）
4. AI_CODING_RULES.md（AI 编码强制规则）
5. SECURITY.md（安全红线）
6. BUG_FIX_SOP.md（Bug 修复流程）

## 最高总规则
> **任何 AI Agent 在读取项目代码之前，必须先读取项目治理文件；任何与治理文件冲突的操作必须停止并报告，不允许自行绕过。**

## 铁律速查
- 只准 staging 改代码；未经 Jeremy 同意禁止同步 beta；禁止动生产 3000
- 改前必须时间戳备份；改完必须跑冒烟/验证
- 禁止把 Secret / session / 数据库文件 / 上传文件 提交进 Git
- 禁止装新 npm 依赖；禁止动核心 lid-mapping / evolution-connector.js
- Git 未完成基线前暂停非紧急大功能开发
- 关键业务路径覆盖率优先于代码行覆盖率；线上每出现一个严重 Bug 必须新增永久回归测试

## 常用命令
- 部署构建：bash build.sh
- 部署启动：bash start.sh
- Prisma：cd backend && npx prisma generate && npx prisma db push
- Git 提交规范：feat: / fix: / docs: / chore: / refactor: / perf: / test:
