# TradeCloser CRM 版本更新日志

> 项目：外贸合伙人派单 CRM（WhatsApp + Telegram + Email）
> 仓库：/opt/whatsapp-crm（production）/ /opt/whatsapp-crm-beta（beta）/ /opt/whatsapp-crm-staging（staging）
> 版本规范：v主版本.次版本.修订号
> 治理起点：2026-09-04 Git 工程治理基线（AGENTS / PROJECT_STATE / ARCHITECTURE / AI_CODING_RULES / SECURITY / TESTING / BUG_FIX_SOP）

---

## v1.9.3 — 2026-09-05 【当前版本】

### 🚀 全量大模型调用积分分级扣减治理
- **分级扣费恢复（MODEL_COST_MAP）**：按模型成本分级定价（售价=成本×1.9，90% 利润 margin），credits.js 恢复 7 级定价：SenseNova 6.8 Flash-Lite 10分 / DeepSeek V4 Flash 20分 / Doubao Seed 2.1 Turbo 25分 / Doubao Seed 2.0 Pro 25分 / Doubao Seed Evolving 50分 / DeepSeek V4 Pro 60分 / GPT-5.6 Terra 135分，未配置兜底 150 分
- **学习管道扣分闭环**：话术学习每次 LLM 调用扣租户积分（20分/次，accountId=1 归主账号），断点续跑不重复扣
- **ALS 统一自动扣分通道**：authMiddleware 挂载路由统一自动扣分（customers/background-check/conversation-manager/emails/trade-agent/speech-library/bant-score/attitude/suggestions/product-knowledge/translation），调用后必扣
- **ai.js 11 接口全挂 chargeCredits**：HTTP 路由显式扣分（余额预检体验），与 ALS 自动扣分通过 manualCharged 防双扣
- **内部服务 creditUserId 补扣（10 文件）**：ai-client.js 扣分主体解析「ALS userId → options.creditUserId → 不扣」；auto-reception/ai-summarize/unattended/automation/ai-reply/closing-reply/assistant×3 按销售 userId 归属，openai-bridge 按主账号 1，ai.service 透传
- **真实 HTTP 验证通过**：/api/ai/analyze 扣 20、/api/translation/translate 自动扣 20、creditUserId 直调扣 135（降级 GPT-5.6 Terra），无双扣，测试积分已还原
- **GPT-5.6 Terra（API2D）key 失效提醒**：chat completions 401 bad forward key（8-29 曾 402），autoSwitch 已自动降级 DeepSeek V4 Flash，不影响主链路；如需旗舰模型需处理 API2D key

---

## v1.9.2 — 2026-09-05 【当前版本】

### 🤖 话术库自主学习进化 V1.1（租户=销售，实战中持续学习）
- **目标**：AI 从「生成通用话术」进化到「用你们实战验证过的话术 + 贴合销售个人风格」
- **学习管道跑通（V1）**：采集「客户消息→销售回复」配对样本 → LLM 场景分类/质量评分/脱敏 → 质量分≥60 自动入库（accountId 隔离、查重、增量游标断点续跑）；首次运行采集20条评估20条入库2条（询盘，score 78/65）
- **租户沟通风格画像（V1.1 新增）**：新增 TenantStyleProfile 表；style-profile.js 从该租户高质样本提炼沟通风格（语气/长度/表情/开场/结尾/句式/禁忌）；首次提炼 accountId=1：business-casual、medium、少表情、Hi+客户名开场、短句清晰
- **生成链路注入（Phase 8）**：ai.service.js generateReply 注入 style-inject.js——生成话术时贴合该销售风格画像 + 附带本租户历史高质话术参考（只读私有池，跨租户隔离）
- **每日自动学习**：服务器 cron 每日 03:05（UTC）跑 run-learning.js，持续采集实战数据更新画像
- **AI 修改记忆（V1.2 待做）**：发送链路记录「AI建议 vs 销售实际发送」差异信号（aiModified），作为最高价值学习信号回流

### 👥 客户管理字段 beta→staging 同步
- 后端 customers.js 增加 _messageCount 批量统计（msgCountMap groupBy from+to）
- 前端 CustomersListView.vue 12 处补丁：类型/消息数/客户状态三列 + 自动建档规则栏 + businessType 三函数 + CSS
- 注意：staging 保留 L2 逻辑（列表仅显示 isBusiness=true 业务客户），与 beta 显示全部客户行为不同，待 Jeremy 决策是否对齐

### 🏪 技能商店状态调整
- 销售看板 → 已上线·第一期（补详情）
- 智能获客 → 即将上线·第二期（下架）

### 💰 积分充值 50 元档位
- beta 同步完成（minRechargeYuan=50，50元订单/35元拒绝冒烟通过）

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
