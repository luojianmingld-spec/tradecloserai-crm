# BUG_FIX_SOP.md — Bug 修复标准流程（8 步）

1. **复现**：拿到现象 → 最小复现路径 → 记录日志
2. **定位根因**：查日志 / 查数据库 / 读代码链路，找到真正根因（不是表象）
3. **评估影响面**：该改动影响哪些模块 / 租户 / 环境
4. **备份**：改前生成时间戳备份（代码 / 数据）
5. **最小修复**：只改目标问题，禁顺手改无关代码；禁装新依赖
6. **冒烟验证**：修复后跑冒烟 + 关键链路验证（改 UI 必须截图）
7. **记录**：更新 CHANGELOG.md + PROJECT_STATE.md（根因 / 修复 / 验证）
8. **回归测试 + 同步**：新增永久回归测试；按流程同步环境（staging → Jeremy 验收 → beta → 生产）

## 常见根因模式（历史沉淀）
- **前端渲染断链**：接口有数据但模板调用少传参数（如 loadAvatar(jid) 未传 avatar → TG 走 WA 代理 404 → 回退首字母）
- **跨实例数据串扰**：WA 多账号同步把 A 客户消息复制到 B 的 session（用 otherWaPhones 过滤）
- **外键约束**：P2003（WAConnection upsert 三处）
- **会话/连接状态异常**：state connected 但 AUTH_KEY_UNREGISTERED → 重启服务让 autoConnect 失败自动删 session.txt
- **TG 限流**：Sleeping 3-8s on flood wait（messages.GetDialogs）→ 批量操作需带延迟

## 修复验收标准
- Jeremy 亲测通过才算闭环
- 修复必须能解释「新租户/新环境为什么不会再有同样问题」（源码层修复 vs 单账号补丁）
