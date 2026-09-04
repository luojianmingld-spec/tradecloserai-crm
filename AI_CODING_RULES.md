# AI_CODING_RULES.md — AI 编码强制规则

> 适用于所有 AI Agent（Codex / Claude Code / Cursor / 其他）。违反本文件的修改视为违规，必须停止并报告。

## 15 条强制规则
1. **先读治理文件**：读取代码前必须先读 AGENTS.md → PROJECT_STATE.md → ARCHITECTURE.md → 本文件 → SECURITY.md
2. **先跑通再说**：小步快跑，最小修改优先；禁止一次性大重构
3. **改前备份**：LOW/MEDIUM 代码修改靠 Git 保护；HIGH 风险 / 数据库 / 配置文件 / Migration / 生产操作 必须时间戳备份
4. **改后验证**：任何修改必须跑冒烟/验证，不能只验 API 不验 UI；改 UI 必须截图
5. **禁装新依赖**：禁止新增 npm 依赖（除非 Jeremy 明确同意）
6. **禁动核心**：禁止修改核心 lid-mapping / evolution-connector.js
7. **不破坏主线**：改模块不能破坏收发 / 翻译 / webhook
8. **禁硬编码**：Secret 一律走 .env，禁止硬编码进代码
9. **禁提交敏感文件**：.env / session.txt / 数据库文件 / 上传文件 禁止 git add
10. **最小修改**：只改目标问题，禁止顺手改无关代码
11. **同步前四步检查**：staging→beta 必须过 diff / 隔离 / 数据 / 冒烟
12. **测试优先**：关键业务路径覆盖率优先于代码行覆盖率；严重 Bug 必须新增永久回归测试
13. **不可逆操作一律 HIGH**：数据库 Migration / 批量 UPDATE / 批量 DELETE / 字段类型变化 / 历史消息迁移 / 余额修改 / 用户数据合并 / 批量翻译覆盖
14. **文档同步**：功能改动同步更新 CHANGELOG.md / PROJECT_STATE.md
15. **Git 规范**：禁止直接无记录修改；commit 用 feat:/fix:/docs:/chore: 前缀；main 受保护，禁直接 push / force push

## 测试原则
- 关键业务路径优先级：登录认证 / 消息收发 / 翻译 / 支付充值
- Bug → 回归测试：线上每出现一个严重 Bug，必须新增永久回归测试
- 测试库随真实事故增长：发现 Bug A → 新增 Test A → 以后必须通过 A+B+C...

## Git 与备份的边界
- **Git = 代码版本管理**（日常 LOW/MEDIUM 修改靠它）
- **Backup = 灾难恢复**（数据库修改 / HIGH 风险发布 / 配置文件 / Migration / 生产环境操作 必须备份）
- 二者不能互相替代；Git 稳定后，普通代码修改不需要每次复制整个目录做时间戳备份
