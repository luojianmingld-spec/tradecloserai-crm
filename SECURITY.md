# SECURITY.md — 安全红线

## 最高原则
- Secret 不进代码、不进 Git 历史、不进聊天记录
- .env 只存在于服务器本地，禁止提交、打包、外传

## 敏感文件清单（禁止 git add / commit / 打包）
- backend/.env 及所有 .env.bak*
- backend/data/tg-userbot/session.txt（TG 登录会话，运行时文件）
- backend/sessions/（WA 会话）
- backend/src/uploads/（上传媒体文件）
- backend/crm.log 及所有 *.log
- 数据库文件 *.db / *.sqlite / 备份 *.bak / *.tar.gz
- 私钥 *.pem / *.key / id_rsa

## Git 安全
- remote URL 禁止嵌 Token（2026-09-04 已清理历史遗留；GitHub Token 建议轮换）
- 第一次 commit 前必须用 git status 确认无敏感文件
- 已误提交的敏感文件：git rm --cached 移除跟踪；如需从历史彻底清除需 filter-repo（评估后执行）

## 风险分级（HIGH 必须人工确认）
HIGH：
- 认证 / 授权 / 权限 / Secret
- 数据库 Migration / 批量 UPDATE / 批量 DELETE / 字段类型变化
- 不可逆迁移：历史消息迁移 / 余额修改 / 用户数据合并 / 批量翻译结果覆盖
- 上传 / 支付 / 余额
MEDIUM：单模块逻辑修改（有备份即可）
LOW：纯样式 / 文案 / 非关键路径

## 数据不可逆性铁律
> 凡是可能造成用户数据永久丢失、批量覆盖、不可逆迁移的修改，无论属于什么模块，一律 HIGH，必须人工确认后才能执行。

## 环境权限
- 生产 3000：2026年12月前禁止任何修改
- beta：未经 Jeremy 同意禁止同步
- 只准 staging 改代码

## 账号与凭证
- 服务器凭据只存在于 secret 记忆，不写入代码
- JWT 强密钥 + AI Key 加密存储（已有）
- Helmet 安全头 + RateLimit 限流（已有）
