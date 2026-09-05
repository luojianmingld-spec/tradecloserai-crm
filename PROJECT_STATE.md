# PROJECT_STATE.md — 项目当前状态

> 本文件回答「系统现在实际上是什么样」。每次重大变更后必须更新。
> 最后更新：2026-09-04

## 当前版本
- v1.9.1（Git 工程治理基线 2026-09-04 建立，含 TG 扫码登录全套修复）

## 当前部署架构
- 单 VPS：45.76.223.251（服务器时区 UTC，北京时间=UTC+8）
- 三套环境并行 + Codex 测试环境（见 AGENTS.md 环境表）

## 服务器环境
- 后端端口：staging 3003 / beta 3004 / production 3000
- Nginx 反代 + HTTPS（beta.tradecloserai.com 等）
- systemd 服务：whatsapp-crm-staging / whatsapp-crm-beta / whatsapp-crm

## 当前主要模块
- CRM 客户管理（Customer CRUD / 自动建档 / 意向度 / 标签 / 状态）
- 消息收发（WA 多账号 Baileys + TG GramJS userbot）
- 实时翻译（豆包/DeepSeek + 缓存 TranslationCache + 语言检测）
- AI 回复 / 需求总结 / 话题追踪
- 背调报告（独立入口 + 卡片）
- 任务指派 / 终止
- 产品知识库智能导入
- 多租户账号体系（RBAC admin/agent/viewer）
- 积分充值档位 50/100/200/500/1000 元（2026-09-05 起，起充 50 元，Jeremy 亲测通过）
- 微信 Agent（总裁助理定位）

## 数据库
- PostgreSQL（重要：不是 SQLite！）
- 库名：beta=crm_beta / staging=crm_staging / prod=crm_prod（以实际为准）
- Prisma 版本锁定 6.8.2（7.x schema 不兼容，勿升级）

## 当前关键依赖
- 后端：express 5 / baileys（optionalDependencies）/ gramjs / prisma 6.8.2
- 前端：vue3 / element-plus / pinia / vite
- vendor：libsignal 本地化（避免 GitHub 超时）

## 当前正在开发功能
- 工厂/货代企微对接 Agent
- 微信直连 beta 扫码全流程实测（待用户扫码验证）

## 已知 Bug
- 侧边栏 flyout v3 修复（阻塞中）
- staging 测试数据清理（待授权）
- 手机号登录前端未接通（tgLoginNext 占位 ElMessage，可选后续）

## 已知技术债
- Git 治理基线建立于 2026-09-04，此前大量修改无提交记录
- session.txt / crm.log / uploads 曾进入 Git 历史（已从索引移除；历史中残留如需彻底清除需 filter-repo，未执行）
- remote URL 曾明文嵌 GitHub Token（已清理；Token 建议轮换）

## 禁止修改区域
- 核心 lid-mapping / evolution-connector.js
- 生产 3000 端口（2026年12月前）
- backend/data/tg-userbot/session.txt（运行时文件，禁止提交 Git）

## 特殊历史原因
- Baileys 替代官方 API（降本核心）
- LayoutView.vue 只能打补丁禁整文件拷贝（beta 同步红线）
- WhatsApp 自动建档需至少 1 条双向真实消息，禁止空会话同步
- TG 头像：无公开头像属平台特性非 bug；前端必须 loadAvatar(jid, avatar) 传参
- Beta TG 假连接：state connected 但 AUTH_KEY_UNREGISTERED → 重启服务让 autoConnect 失败自动删 session.txt

## 最近重大架构决定
- 私有化部署作为第二盈利模式（同代码主线 + License + 迭代同步，2026-09-04）
- Git 工程治理 Week1 落地（2026-09-04）：8 治理文件 + 基线 commit
- 微信 Agent 定位总裁助理（V1.5 新询盘链路）
- 极简铁律：租户零安装零学习，Agent 全云端干活

## 部署流程（当前）
1. staging 改代码 → 冒烟 → Jeremy 验证
2. 同步 beta（diff/隔离/数据/冒烟四步检查）→ Jeremy 亲测
3. 稳定 15 天 → 12 月推生产
