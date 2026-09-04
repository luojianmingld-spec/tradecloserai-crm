# SECURITY INCIDENTS 安全事件记录

本文件记录 TradeCloser 项目发生过的安全事件、影响范围、处置过程与验证结果。
任何 Agent 在处理涉及安全/凭证问题时，必须先阅读本文件，避免重复犯错。

---

## INC-2026-09-04-001: GitHub PAT 与 TG session 泄露至 Git 历史

- **日期**: 2026-09-04
- **严重级别**: HIGH
- **影响范围**: 远端 GitHub 仓库 `luojianmingld-spec/tradecloserai-crm`（beta/staging 共用 remote）

### 事件描述
1. `backend/data/tg-userbot/session.txt`（Telegram 登录会话凭证）曾被 `git add` 提交并推送到 GitHub 远端（原始 commit `835f9e0`），泄露进远端历史。
2. GitHub PAT（`ghp_...` 开头）曾明文嵌入 remote URL（beta/staging 的 origin、生产的 github remote），任何读到 `.git/config` 的人都能直接使用。
3. jihulab oauth2 Token 曾明文嵌入生产环境 origin remote URL。
4. 历史中同时发现其他敏感文件：`backend/prisma/crm.db`（SQLite 老库，含客户数据）、`.env.bak-20260728-234720`、`crm.log`、`staging.log`、大量 `uploads/` 媒体文件、源码 tar 包。

### 处置记录
- [x] GitHub PAT 已撤销（用户到 GitHub 手动 revoke）
- [x] 服务器所有 remote URL 中的 Token 已清除（生产 github + jihulab）
- [x] TG session 已轮换：删除 `session.txt` → 重新扫码登录 → 旧会话失效
- [x] Git 历史已重写：`git filter-repo --invert-paths` 清除 session.txt/crm.db/.env.bak/logs/uploads/tar.gz
- [x] Remote 已 force push（`--force-with-lease --all --tags`）
- [x] `.gitignore` 已更新：session 目录/日志/uploads/`*.tar.gz`/backups 规则
- [x] 敏感文件已移出 git 索引（`git rm --cached`）

### 验证结果
- [x] `git log` 全历史无 `session.txt`
- [x] `.env` 未跟踪（`git ls-files | grep env` 为空）
- [x] 敏感文件扫描通过（session/log/db/uploads/tar.gz 均不在历史中）

### 经验教训（必须遵守）
1. **禁止 `git add .` 无审查提交**；首次 commit 前必须 `git status` + `git ls-files` 双重扫描。
2. **禁止将 Token 写入 remote URL**；使用 credential helper 或 SSH key 认证。
3. 提交前必须扫描敏感文件：`.env*` / `session*` / `*.log` / `*.db*` / `uploads/` / `*.tar.gz` / 私钥。
4. 数据库文件（crm.db）比普通配置文件更敏感——若包含客户数据/聊天记录，泄露即数据事件。
5. 凭证一旦怀疑泄露：**先撤销/轮换凭证，再清理历史**，顺序不可颠倒。
