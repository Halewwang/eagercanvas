# Dashboard 与模型迁移整合版本

> 后续界面调整见[浏览器反馈修复](browser-feedback-2026-10-19.md)：本地裁切/尺寸导出、Background 移除、用户卡片及侧栏清理。本文保留首轮整合上线的验收范围。

> 最新工作空间与后台调整见[工作空间反馈修复](workspace-feedback-2026-10-19.md)：项目菜单浮层、多选删除、列表加载及后台样式统一。

本次 main 版本同时包含 Dashboard 精简、统一服务权限、文字/图片网关迁移和旧画布兼容。生产部署验收以 API health 的 releaseCommit 与远端 main 提交一致为准；实际提交、部署 ID 和最终健康检查保存在本地 output/main-release-2026-10-19，附件不纳入 Git。

## 用户与服务管理

后台仅保留用户列表与详情，支持服务开通/暂停/恢复、角色调整、账户暂停/恢复、删除及恢复。保留审计、自改保护、最后一位超级管理员保护、事务操作锁及项目所有权约束。移除 302 Key 管理、余额/对账、问题收件箱及其接口、采集和后台任务。

Express 原生入口同时提供默认导出与具名 app 导出，复用同一应用实例；兼容 API 入口继续工作。回归覆盖根路径/不存在路径的 404、健康检查、CORS、请求 ID 和匿名后台鉴权，避免原生入口初始化失败。

注册用户开通服务后统一使用服务器共享凭据访问文字、图片和视频，无需绑定或分配个人 Key。生成及任务轮询都检查账户与服务状态，并校验任务所有者。暂停或删除账户会拒绝原有 JWT 的后续访问；恢复账户不会自动重新开通服务。

## 模型迁移

- 文字使用 gpt-5.6-sol，通过 Enbrand Responses 接口，store=false；兼容流式、JSON/SSE、图片理解及 token usage。
- 图片使用 gpt-image-2；单张 PNG、Auto/Opaque 背景、最多 16 张参考图，区分文生图和 multipart 编辑。无效的尺寸/质量参数不再发送给上游。
- 图片任务在本地 run task 中持久化并按所有者轮询；旧上游图片任务明确返回 410。
- 旧模型偏好会归一化；旧 imageConfig 画布结构迁移保留历史结果图、资产、提示词、参考图与分组。
- 视频继续使用现有共享 PROVIDER_* 服务端配置。旧前端配置组件、退役 adapter 和无效图片素材引用已清理。

原能力实测与实现阶段证据见[模型迁移](model-provider-verification-2026-10-19.md)、[图片参数实测](image-parameter-capabilities-2026-10-19.md)和[图片胶囊整合](image-capsule-consolidation-2026-10-19.md)。这些文档头部标明历史阶段，旧账单管理或尚未发布描述不代表此版本。

## 数据库与环境配置

生产 PostgreSQL 17.6 已按顺序应用：

1. 20261019123659 admin_rbac_lifecycle_dashboard_release_20261019，对应 [原 016](../supabase/016_admin_rbac_lifecycle.sql)。
2. 20261019124029 harden_admin_workspace_transfer_plan_grants，对应 [transfer plans 权限修正](../supabase/migrations/20261019124029_harden_admin_workspace_transfer_plan_grants.sql)。

原 016 未修改。18 个 RPC、4 个保护触发器、48 项有效 ACL、两表 RLS 与 owner 约束通过后验；原有 16 条项目成员记录与迁移前快照逐字段一致。迁移运行顺序见 [migration 说明](../supabase/migrations/README.md)。

服务端文字/图片配置 OPENAI_API_KEY、OPENAI_API_BASE_URL；视频配置 PROVIDER_*。保留 Supabase、JWT、Resend 等运行凭据。Production 的 ADMIN_LIFECYCLE_MUTATIONS_ENABLED=true；Preview/Development=false。共享 Key 不返回前端。

Vercel 已删除 11 个退役变量名、17 条记录、33 个环境绑定：DASHBOARD_302_*、ADMIN_DASHBOARD_*、DEROUTER_* 及 WT_REFRESH_SECRET。前端只配置 VITE_APP_API_BASE_URL。环境值与密钥不纳入 Git，标准模板为 [backend/.env.example](../backend/.env.example)；旧 import.env 不再作为版本化模板。

## 验证与边界

- npm run check 通过：前端 663、后端 268、脚本 18，共 949 项；lint、维护检查与 npm run build 通过。模型定向测试 71/71 复跑通过，属于上述测试的子集。
- 原生命周期脚本在临时真实 PostgreSQL 18.6 完成 18 项门禁，覆盖重复执行、事务回滚、权限、并发和项目转移；这不是生产项目实写验收。
- 新后端在生产数据库上通过 19/19 项合成账户 HTTP 验收，7 个退役接口返回 404，11 条审计匹配本轮 marker。正式域名另有健康、会话和详情 3/3 只读复核。
- 浏览器通过首页、登录入口、匿名后台保护、合成用户列表/详情、菜单键盘与 Escape 回焦、390px 只读守卫及旧后台路由跳转。前端静态资源没有旧 Key、余额或问题模块引用。
- 两个合成账户已删除，10 张关联表按这两个 UUID 查询残余均为 0，11 条审计保留；浏览器会话恢复，私有 token 和临时打包目录已清理。

本轮发布没有新增付费模型请求、发送验证码、修改真实账户或转移真实项目；没有逐行比对全库。删除 Vercel 变量不撤销上游 Key 或历史部署快照。需要停止管理写入时，应将开关设为 false 并重部署兼容版本，保留新增 schema 和审计，避免破坏性下迁移。
