# Eager Canvas 项目交接与部署清单

> 当前 Dashboard 精简与模型迁移已合并到生产，发布状态以 [main 发布记录](main-release-2026-10-19.md) 为准。后台仅保留用户、角色、服务开通及账户管理；302 管理/余额/对账、用户 key 绑定和问题收件箱已移除。配置以 `backend/.env.example` 和当前路由为准。历史验收文档中的 `output/` 链接指向本地附件，附件未纳入 Git。

更新日期：2026-10-19
仓库路径：`/Users/hale/Documents/Eager DEV/Eager Canvas/repo`
Git 远端：`https://github.com/Halewwang/eagercanvas.git`
代码与部署基线：以 [main 发布记录](main-release-2026-10-19.md) 中的提交和部署信息为准。

本文档面向接手团队，目标是让对方能明确知道本项目由哪些服务组成、依赖哪些外部系统、需要哪些环境变量，以及如何完成本地、Vercel、静态 Docker 路径的部署与验证。敏感值只写变量名和用途，不写真实 key。

## 1. 项目概览

Eager Canvas 是一个 AI 图像、视频和媒体工作流画布系统，包含：

- Vue 3 + Vite 前端 SPA：画布、工作区、用户用量页、用户管理后台。
- Node.js + Express 后端 API：认证、项目持久化、运行任务、上传、用量记录、RBAC、用户服务与账户管理、工作区协作。
- Supabase Postgres：业务数据、鉴权会话、项目、运行记录、用量、RBAC、团队工作区和账户生命周期审计。
- Supabase Storage：公开 `uploads` bucket，存放上传文件、远程拉取文件和需要持久化的生成结果。
- 外部服务：Enbrand OpenAI（GPT 5.6 Sol 文字、GPT Image 2 图片）、302.ai 视频 Provider、Resend。

管理员开通服务后，账户即可使用文字、图片和视频；文字/图片使用服务端共享 `OPENAI_API_KEY`，视频使用共享 `PROVIDER_API_KEY`，无需为用户绑定或分配 key。服务暂停、账户暂停或删除会阻止相应访问；管理员操作继续受 RBAC、自身操作和最后一位超级管理员保护。

主要目录：

| 路径 | 说明 |
| --- | --- |
| `src/` | 前端源码，包含视图、画布组件、节点、API client、Pinia store。 |
| `backend/` | Express API 服务，包含 Vercel serverless 入口、本地启动入口、路由、服务层和后端测试。 |
| `supabase/` | 编号 SQL 初始化脚本，以及 `migrations/` 中的后续版本化修正；执行顺序见该目录 README。 |
| `docs/` | 项目说明、验证说明、历史 PRD 和交接材料。 |
| `Dockerfile` / `nginx.conf` / `README.docker.md` | 仅静态前端容器路径，非完整后端部署。 |

## 2. 服务类型与部署单元

### 2.1 前端 Web SPA

- 技术栈：Vue 3、Vite 5、Vue Router、Pinia、Vue Flow、Naive UI、Tailwind CSS。
- 本地入口：`npm run dev`，默认 `http://localhost:5173`。
- 构建命令：`npm run build`，产物目录 `dist/`。
- 预览命令：`npm run preview`。
- API base：由 `VITE_APP_API_BASE_URL` 决定，默认 `/api/v1`。
- 认证旁路：`VITE_BYPASS_AUTH=true` 只用于本地 UI 预览，正式验证和生产必须为 `false`。
- SPA 路由：根 `vercel.json` 将所有路径 rewrite 到 `/index.html`。

前端主要路由：

| 路由 | 功能 |
| --- | --- |
| `/` | 首页、登录/注册入口。 |
| `/canvas/:id?` | 主画布和节点工作流编辑器。 |
| `/workspace` | 项目工作区、团队工作区、模板。 |
| `/workspace/join/:token` | 团队工作区邀请加入入口。 |
| `/usage` | 当前用户用量页。 |
| `/admin/users` / `/admin/users/:userId` | RBAC 用户列表和详情：角色、服务开通/暂停、账户暂停/恢复/删除/恢复。 |
| `/usage-admin`、`/admin/dashboard` 及其他旧后台路径 | 兼容重定向到 `/admin/users`，不再提供原独立后台。 |

### 2.2 后端 API 服务

- 技术栈：Node.js `>=20`、Express、JWT、Supabase service-role client、Resend、302/Provider adapters。
- 本地入口：`backend/src/index.js`。
- 本地命令：`npm --prefix backend run dev`，默认监听 `http://localhost:8787`。
- Vercel serverless 入口：`backend/api/index.js`，导出 Express `app`。
- Vercel rewrite：`backend/vercel.json` 将 `/api/v1/(.*)` rewrite 到 `/api/index.js`。
- API 挂载前缀：`/api/v1`。
- 健康检查：`GET /api/v1/health`，返回 `service: eagercanvas-api`、release/deployment/environment 信息。

后端主要路由组：

| API 路由 | 功能 |
| --- | --- |
| `/api/v1/health` | API 健康检查。 |
| `/api/v1/auth/*` | 邮箱验证码登录/注册、刷新、退出、当前用户、个人资料。 |
| `/api/v1/projects/*` | 项目 CRUD、复制到工作区、项目分享、编辑请求、项目权限。 |
| `/api/v1/workspace/*` | 当前工作区、团队工作区、邀请链接、成员、模板、收藏。 |
| `/api/v1/runs/*` | 统一运行记录入口，创建 chat/image/video run。 |
| `/api/v1/chat/completions` | OpenAI-compatible chat，支持 SSE stream。 |
| `/api/v1/images/generations` | 图像生成兼容入口。 |
| `/api/v1/images/:taskId` | 图像异步任务查询。 |
| `/api/v1/videos` / `/api/v1/videos/:taskId` | 视频生成和任务查询。 |
| `/api/v1/upload/*` | 文件上传、远程文件持久化、媒体代理、签名上传完成回调。 |
| `/api/v1/media-library/*` | 上传/生成媒体资产列表和历史。 |
| `/api/v1/usage/summary` / `/api/v1/usage/timeseries` | 当前用户的用量汇总和时间序列。 |
| `/api/v1/admin/*` | RBAC 会话、用户列表/详情、角色、服务权限、账户生命周期及操作审计。 |

旧 `/api/v1/usage-admin/*`、`/api/v1/observability/*`、302 key/余额及后台账单对账接口已移除，返回 404；原问题提醒、事件采集与账单同步后台任务也已删除。

### 2.3 Supabase Postgres

本项目使用 Supabase service-role key 由后端访问数据库，不把 Supabase anon/publishable key 暴露给前端作为主要业务访问方式。

按文件名顺序执行迁移：

1. `supabase/001_init.sql`
2. `supabase/002_auth_registration.sql`
3. `supabase/003_usage_admin_key_assignments.sql`
4. `supabase/004_rbac_admin_system.sql`
5. `supabase/005_user_account_status.sql`
6. `supabase/006_usage_billing_reconciliation.sql`
7. `supabase/009_workspace_shared_templates.sql`
8. `supabase/010_service_access_billing.sql`
9. `supabase/011_revoke_public_security_definer_execute.sql`
10. `supabase/012_supabase_lint_remediation.sql`
11. `supabase/013_team_workspaces.sql`
12. `supabase/014_project_direct_shares.sql`
13. `supabase/015_issue_observability.sql`
14. `supabase/016_admin_rbac_lifecycle.sql`
15. `supabase/migrations/20261019124029_harden_admin_workspace_transfer_plan_grants.sql`

现有生产已登记 `20261019123659 admin_rbac_lifecycle_dashboard_release_20261019`（原 016）和 `20261019124029 harden_admin_workspace_transfer_plan_grants`。18 个生命周期 RPC、4 个保护触发器及 transfer 表权限已后验。ACL 修正使 `service_role` 对 transfer plans 仅有 SELECT，写入经 postgres 所有的 SECURITY DEFINER RPC 完成。不要把 `supabase/migrations/` 单独当作完整初始化目录，也不要对已迁移生产重复初始化。

核心表分组：

| 分组 | 表 |
| --- | --- |
| 认证和用户 | `users`, `auth_codes`, `sessions`, `user_profiles` |
| 项目和工作流 | `projects`, `workflow_runs`, `audit_logs` |
| 用量和服务权限 | `usage_events`, `usage_daily_agg`, `user_service_credentials`（服务状态，不再分配用户 key） |
| RBAC | `roles`, `permissions`, `user_roles`, `role_permissions`, `admin_operation_logs` |
| 工作区和协作 | `workspaces`, `workspace_members`, `user_workspace_preferences`, `workspace_invites`, `project_members`, `project_edit_requests`, `shared_project_templates`, `shared_project_template_favorites` |
| 账户生命周期和转移审计 | `admin_workspace_transfer_plans`, `admin_workspace_transfer_events` |

历史 API key 分配、供应商账单和问题观测表未进行破坏性删除；相应功能、写入任务和接口已退役，不属于当前运行依赖。

RBAC 初始化会写入 `super_admin`, `admin`, `ops`, `support`, `user` 角色和对应权限。首次生产部署后，需要给至少一个真实用户授予 `super_admin`：

```sql
insert into public.user_roles (user_id, role_id)
select u.id, r.id
from public.users u
join public.roles r on r.code = 'super_admin'
where lower(u.email) = lower('<admin@example.com>')
on conflict (user_id, role_id) do nothing;
```

如果在首次执行 `004_rbac_admin_system.sql` 前就已确定管理员邮箱，也可在 SQL editor/psql 中先设置：

```sql
set app.bootstrap_super_admin_email = '<admin@example.com>';
```

### 2.4 Supabase Storage

- Bucket 名称：`uploads`。
- 公开访问：`public: true`。
- 文件大小上限：150 MB。
- 代码位置：`backend/src/services/upload.service.js`。
- 行为：后端上传时会尝试按需创建 bucket；生产环境建议提前在 Supabase Dashboard 中创建 `uploads` public bucket，并确认 service-role key 具备创建/上传权限。
- 存储内容：用户上传图片/视频、远程 URL 拉取后的资产、较大生成结果的持久化副本。

### 2.5 外部 Provider 和第三方服务

| 服务 | 用途 | 关键配置 |
| --- | --- | --- |
| Supabase | Postgres + Storage | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| Resend | 登录/注册验证码邮件 | `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_AUTH_CODE_TEMPLATE_ID` |
| Enbrand OpenAI | 文字 `/v1/responses`（`gpt-5.6-sol`、`store:false`），图片 `/v1/images/generations` 和 `/v1/images/edits`（`gpt-image-2`） | `OPENAI_API_BASE_URL`, `OPENAI_API_KEY`, `OPENAI_TIMEOUT_MS` |
| 302.ai Provider API | 仅视频：Sora、Seedance、Veo/Kling/Topaz 等 | `PROVIDER_API_BASE_URL`, `PROVIDER_API_BASE_URLS`, `PROVIDER_API_KEY`, `PROVIDER_TIMEOUT_MS` |
| Vercel | 前端静态部署和后端 serverless 部署 | Vercel project env、自动 `VERCEL_*` env |
| Docker/Nginx | 静态前端容器部署 | `Dockerfile`, `nginx.conf`, `dist/` |

文字和图片直接使用 `enbrand.adapter.js`，不再请求 302 或 Derouter。前端旧画布模型会归一化到唯一模型，后端直接请求旧模型返回 400；旧上游图片任务不再轮询，已保存的历史资产仍可读取。新图片使用本地 run 队列保存结果。

GPT Image 2 经 69 次实测后仅保留提示词、最多 16 张参考图、Auto / Opaque 背景，固定单张 PNG。尺寸、比例、1K / 2K / 4K、质量、JPEG / WebP 输出与压缩选项已移除；按返回图片的真实尺寸显示。证据见 [图片参数实测与界面验收](image-parameter-capabilities-2026-10-19.md)。

Provider 适配器位于 `backend/src/services/providers/`，当前注册：

- `dashboard302`
- `dashboard302-video`
- `openai`
- `seedance`

当前用量保存在 `usage_events`；新文字/图片按上游返回记录 token，没有正式金额时不标记已结算。原 302 Dashboard 官方记录/对账链路已移除。

## 3. 环境变量清单

所有真实环境变量都不要提交到仓库。当前 `.gitignore` 已忽略根目录和 `backend/` 下的 `.env`, `.env.*`，只保留 `.env.example` 与 `backend/.env.example`；也忽略本地 `backend/import.env`、`output/` 和 `supabase/.temp/`。

后端 env 加载顺序：平台/壳层环境变量最高优先级，其次 `backend/.env.local`，再其次 `backend/.env`。由于 `dotenv` 使用 `override: false`，Vercel 或 shell 注入的变量不会被本地文件覆盖。

`backend/import.env` 是本地遗留导入文件，不纳入本次 main 提交；后续配置和导入请以 `backend/.env.example` 为准。真实凭据只保存在忽略文件或部署平台，不以本地导入文件作为生产配置来源。

### 3.1 前端环境变量

文件位置：仓库根目录 `.env.local`。

| 变量 | 必填 | 敏感 | 示例/默认 | 说明 |
| --- | --- | --- | --- | --- |
| `VITE_APP_API_BASE_URL` | 是 | 否 | 本地 `http://127.0.0.1:8787/api/v1`；同域生产 `/api/v1`；分离生产 `https://<api-domain>/api/v1` | 前端 API 请求基地址。 |
| `VITE_BYPASS_AUTH` | 是 | 否 | `false` | 真实验证/生产必须为 `false`；`true` 仅用于本地 UI 预览。 |

构建期自动读取的非业务变量：

| 变量 | 来源 | 说明 |
| --- | --- | --- |
| `VERCEL_GIT_COMMIT_SHA` | Vercel 自动注入 | Vite 构建 `version.json` 使用。 |
| `GITHUB_SHA` | GitHub Actions 可注入 | Vite 构建 `version.json` fallback。 |

前端 `.env.local` 示例：

```env
VITE_APP_API_BASE_URL=http://127.0.0.1:8787/api/v1
VITE_BYPASS_AUTH=false
```

### 3.2 后端环境变量

文件位置：`backend/.env.local`。生产应配置在部署平台的 Environment Variables 中。

| 变量 | 必填 | 敏感 | 默认/建议 | 说明 |
| --- | --- | --- | --- | --- |
| `PORT` | 本地必填 | 否 | `8787` | 本地 Node 服务端口；Vercel serverless 可忽略。 |
| `NODE_ENV` | 是 | 否 | 本地 `development`，生产 `production` | 生产模式下缺少核心 env 会抛错。 |
| `FRONTEND_ORIGIN` | 是 | 否 | `https://app.example.com,https://www.app.example.com` | CORS 允许的前端 origin，支持逗号分隔；非生产额外允许 localhost。 |
| `ADMIN_LIFECYCLE_MUTATIONS_ENABLED` | 管理写入必填 | 否 | 默认 `false` | 迁移和权限后验完成后才能启用；当前 Production 为 `true`，Preview/Development 为 `false`。 |
| `SUPABASE_URL` | 是 | 否 | `https://<project-ref>.supabase.co` | Supabase API URL。 |
| `SUPABASE_SERVICE_ROLE_KEY` | 是 | 是 | `<secret>` | Supabase service-role key，后端数据库和 Storage 访问核心密钥。 |
| `SUPABASE_TIMEOUT_MS` | 否 | 否 | `8000` | 普通 Supabase 查询超时。 |
| `SUPABASE_STORAGE_TIMEOUT_MS` | 否 | 否 | `120000` | Storage 上传/读取超时。 |
| `REMOTE_ASSET_FETCH_TIMEOUT_MS` | 否 | 否 | `30000` | 后端拉取远程资产超时。 |
| `JWT_ACCESS_SECRET` | 是 | 是 | `<secret >= 24 chars>` | Access token 签名密钥。 |
| `JWT_REFRESH_SECRET` | 是 | 是 | `<secret >= 24 chars>` | Refresh token 签名密钥。 |
| `JWT_ACCESS_TTL_SEC` | 否 | 否 | `900` | Access token TTL。 |
| `JWT_REFRESH_TTL_SEC` | 否 | 否 | `2592000` | Refresh token TTL。 |
| `RESEND_API_KEY` | 生产 auth 必填 | 是 | `<secret>` | 生产邮箱验证码发送必须配置。 |
| `RESEND_FROM_EMAIL` | 生产 auth 必填 | 否 | 已验证发件域名邮箱 | Resend 发件地址。 |
| `RESEND_AUTH_CODE_TEMPLATE_ID` | 否 | 否 | 空或 template id | Resend 邮件模板 id；空则使用内置 HTML。 |
| `OPENAI_API_BASE_URL` | 文字/图片 | 否 | `https://api.enbrand.co/v1` | 文字与图片独立上游地址。 |
| `OPENAI_API_KEY` | 文字/图片必填 | 是 | `<secret>` | enbrand 密钥；不会回退到 302 密钥。 |
| `OPENAI_TIMEOUT_MS` | 否 | 否 | `1800000` | 新接口超时，覆盖响应体读取。 |
| `PROVIDER_API_BASE_URL` | 视频必填 | 否 | `https://api.302ai.cn` | 主 provider API base。 |
| `PROVIDER_API_BASE_URLS` | 否 | 否 | 空或逗号分隔 | 多 provider base fallback 列表，优先于单 base 列表解析。 |
| `PROVIDER_API_KEY` | provider 必填 | 是 | `<secret>` | 视频 provider Bearer key；不用于文字和图片。 |
| `PROVIDER_TIMEOUT_MS` | 否 | 否 | `180000` | 主 provider 请求超时。 |
| `RATE_LIMIT_PER_MINUTE` | 否 | 否 | `120` | 后端内存级限流阈值，按 IP/path/auth suffix。 |
| `AUTH_CODE_COOLDOWN_SEC` | 否 | 否 | `60` | 同邮箱验证码发送冷却。 |
| `RBAC_CACHE_TTL_MS` | 否 | 否 | `30000` | RBAC 查询缓存 TTL。 |
| `RELEASE_COMMIT` | 否 | 否 | 平台注入 | 健康检查 release fallback。 |
| `BUILD_ID` | 否 | 否 | 平台注入 | 健康检查 deployment fallback。 |

Vercel 已清理旧 `DASHBOARD_302_*`、`ADMIN_DASHBOARD_*`、`DEROUTER_*` 和误拼 `WT_REFRESH_SECRET`；实际 `JWT_REFRESH_SECRET` 继续保留。`ISSUE_ALERT_*`、`BILLING_SYNC_*`、`SERVICE_CREDENTIAL_ENCRYPTION_KEY` 不再是运行依赖。不要因沿用旧部署说明而重新添加这些变量。

后端 `.env.local` 示例：

```env
PORT=8787
NODE_ENV=development
FRONTEND_ORIGIN=http://localhost:5173,http://127.0.0.1:5173
ADMIN_LIFECYCLE_MUTATIONS_ENABLED=false

SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<secret>
SUPABASE_TIMEOUT_MS=8000
SUPABASE_STORAGE_TIMEOUT_MS=120000
REMOTE_ASSET_FETCH_TIMEOUT_MS=30000

JWT_ACCESS_SECRET=<secret-at-least-24-chars>
JWT_REFRESH_SECRET=<another-secret-at-least-24-chars>
JWT_ACCESS_TTL_SEC=900
JWT_REFRESH_TTL_SEC=2592000

RESEND_API_KEY=<secret>
RESEND_FROM_EMAIL=no-reply@example.com
RESEND_AUTH_CODE_TEMPLATE_ID=

OPENAI_API_BASE_URL=https://api.enbrand.co/v1
OPENAI_API_KEY=<secret>
# Shared video runtime credential
PROVIDER_API_BASE_URL=https://api.302ai.cn
PROVIDER_API_KEY=<secret>

RATE_LIMIT_PER_MINUTE=120
AUTH_CODE_COOLDOWN_SEC=60
```

### 3.3 当前本地 env 就绪状态

本地配置应在当前环境重新运行就绪检查：

```bash
npm run check:validation-readiness
```

就绪检查只验证配置形状，不能证明数据库迁移、凭据有效性或供应商调用成功。本地忽略文件与 Vercel 配置独立；生产已配置共享 `OPENAI_*` 和 `PROVIDER_*`，完成数据库迁移与合成账户管理验收。模型真实调用与本轮生产无付费验收的边界见 [main 发布记录](main-release-2026-10-19.md)。

## 4. 本地开发部署

前置条件：

- Node.js 20+。
- npm。
- 可访问目标 Supabase、Resend、Enbrand 和视频 Provider 服务。

步骤：

```bash
cd "/Users/hale/Documents/Eager DEV/Eager Canvas/repo"

npm ci
npm --prefix backend ci

cp .env.example .env.local
cp backend/.env.example backend/.env.local
```

按上一节填写 `.env.local` 和 `backend/.env.local`。如只是生成本地 JWT secret，可运行：

```bash
npm run generate:validation-jwt-secrets
```

初始化数据库：

1. 新建或选择 Supabase project。
2. 在 SQL editor 或 psql 中按第 2.3 节及 `supabase/migrations/README.md` 的顺序执行，包含 016 后的 ACL 修正。
3. 确认 `uploads` public bucket 存在，或允许后端首次上传时创建。
4. 创建首个管理员账号后，给该用户插入 `super_admin` 角色。

启动服务：

```bash
npm --prefix backend run dev
npm run dev
```

本地默认访问：

- 前端：`http://localhost:5173`
- 后端：`http://localhost:8787/api/v1/health`

本地真实链路验证时，前端 `.env.local` 应为：

```env
VITE_APP_API_BASE_URL=http://127.0.0.1:8787/api/v1
VITE_BYPASS_AUTH=false
```

## 5. Vercel 部署

当前仓库更适合前端和后端分两个 Vercel project 部署：

- 前端 project：仓库根目录，构建 Vue/Vite 静态 SPA。
- 后端 project：`backend/` 目录，部署 Express serverless API。

当前生产团队为 `adlermurcus-projects`，前端 project 为 `eagercanvas`，域名 `www.enbrand.space`；后端 project 为 `eagercanvas-api`，域名 `api.enbrand.space`。根域 `enbrand.space` 跳转到 `www`。本地 `.vercel` 绑定文件不进入 Git；新克隆应分别确认并 link 正确 project，不能仅凭相似名称选择旧项目。

### 5.1 后端 Vercel project

项目根目录：`backend/`

建议配置：

| 项 | 值 |
| --- | --- |
| Framework Preset | Express |
| Root Directory | `backend` |
| Install Command | `npm ci` |
| Build Command | 空或平台默认 |
| Output Directory | 空 |
| Node.js | 24.x（当前生产） |

后端 `backend/vercel.json`：

```json
{
  "rewrites": [{ "source": "/api/v1/(.*)", "destination": "/api/index.js" }]
}
```

部署后健康检查：

```bash
curl -fsS https://<api-domain>/api/v1/health
```

生产后端必须配置：

- `NODE_ENV=production`
- `FRONTEND_ORIGIN=https://<frontend-domain>,https://www.<frontend-domain>`
- Supabase/JWT/Resend、共享 `OPENAI_*` 与视频 `PROVIDER_*` 环境变量。
- `ADMIN_LIFECYCLE_MUTATIONS_ENABLED=true` 仅在目标数据库的 016 与 ACL 修正后验通过后启用；Preview/Development 保持 `false`。

如果使用 Vercel Sensitive Environment Variables，至少应标记为 Sensitive：

- `SUPABASE_SERVICE_ROLE_KEY`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `RESEND_API_KEY`
- `OPENAI_API_KEY`
- `PROVIDER_API_KEY`

当前 `OPENAI_API_KEY` 在 Production/Preview 使用 Sensitive，Development 使用 encrypted；不要把值传入前端构建变量或命令参数。

### 5.2 前端 Vercel project

项目根目录：仓库根目录。

建议配置：

| 项 | 值 |
| --- | --- |
| Framework Preset | Vite |
| Install Command | `npm ci` |
| Build Command | `npm run build` |
| Output Directory | `dist` |

根 `vercel.json`：

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

前端生产 env：

```env
VITE_APP_API_BASE_URL=https://api.enbrand.space/api/v1
VITE_BYPASS_AUTH=false
```

如果计划前后端同域部署，当前根 `vercel.json` 没有把 `/api/v1/*` 代理到后端 project 的规则。需要额外配置 Vercel rewrites、反向代理、或把 API 部署到同一 project 后再使用 `/api/v1`。否则应使用完整 API 域名。

### 5.3 Vercel 环境变量同步注意事项

可以用 Vercel Dashboard 手动添加变量。若使用 CLI：

```bash
cd backend
vercel link --project eagercanvas-api
vercel env pull .env.local --environment=development --yes
```

注意：`vercel env pull` 会覆盖目标 env 文件内容。执行前备份本地自定义变量，不要把拉下来的 `.env.local` 提交。

## 6. Docker 静态前端部署

仓库提供的 Docker 路径只部署静态前端，不包含 Express 后端。

流程：

```bash
npm ci
npm run build
docker build -t eager-canvas-frontend .
docker run -d -p 8080:80 --name eager-canvas-frontend eager-canvas-frontend
```

访问路径：

```text
http://localhost:8080/eager/
```

重要差异：

- `Dockerfile` 复制本地 `dist/` 到 Nginx，构建镜像前必须先 `npm run build`。
- `nginx.conf` 当前把 `/v1` 代理到 `https://api.chatfire.site`，而当前前端默认 API base 是 `/api/v1`。
- 如果接手团队要用这条路径部署当前完整产品，需要先统一 `VITE_APP_API_BASE_URL`、Nginx proxy path 和真实后端域名。否则 Docker 镜像只能视为静态前端/历史兼容部署路径。

## 7. 交接部署清单

### 7.1 基础清单

- [ ] 确认 Git 仓库和目标分支：`https://github.com/Halewwang/eagercanvas.git`。
- [ ] 确认 Node.js 版本为 20+。
- [ ] 根目录执行 `npm ci`。
- [ ] `backend/` 执行 `npm ci`。
- [ ] 前端 project 和后端 project 分别确认部署平台、域名和 env。
- [ ] 明确前端 API base：同域 `/api/v1` 或分离域名 `https://<api-domain>/api/v1`。
- [ ] `FRONTEND_ORIGIN` 覆盖所有生产前端域名和必要 preview 域名。

### 7.2 Supabase 清单

- [ ] 创建或确认 Supabase project。
- [ ] 保存 `SUPABASE_URL`。
- [ ] 安全保存 `SUPABASE_SERVICE_ROLE_KEY`，仅后端使用。
- [ ] 对新数据库按第 2.3 节应用基础迁移、016 和后续 ACL 修正；现有生产检查迁移 history，不重复初始化。
- [ ] 确认 `pgcrypto` extension 可用。
- [ ] 确认核心表、索引、RLS/policy 已创建。
- [ ] 创建或确认 public `uploads` bucket。
- [ ] 注册首个管理员用户并授予 `super_admin`。
- [ ] 保留数据库备份和迁移执行记录。

### 7.3 第三方服务清单

- [ ] Resend：验证发件域名/邮箱，配置 `RESEND_API_KEY` 和 `RESEND_FROM_EMAIL`。
- [ ] Enbrand OpenAI：配置 `OPENAI_API_KEY` 并核对 `/v1/models` 包含 `gpt-5.6-sol` 和 `gpt-image-2`。
- [ ] 302 视频 Provider：配置可用于 runtime 调用的 `PROVIDER_API_KEY`。
- [ ] 确认文字、图片和视频使用服务端共享凭据，用户仅需服务开通，不分配用户 key。

### 7.4 后端部署清单

- [ ] 设置 `NODE_ENV=production`。
- [ ] 设置所有后端 env，敏感项标记 Sensitive。
- [ ] 部署 `backend/` project。
- [ ] 验证 `GET /api/v1/health`。
- [ ] 验证 CORS：前端域名请求 API 不被阻断。
- [ ] 验证 Resend 登录/注册验证码。
- [ ] 验证文件上传到 Supabase Storage。
- [ ] 验证 chat/image/video provider 调用。
- [ ] 验证 `/api/v1/admin/session` 需要登录且 RBAC 生效。
- [ ] 验证服务开通/暂停、角色调整、账户暂停/恢复/删除/恢复及操作审计；只使用明确标识的合成账户。
- [ ] 确认已退役的 302 管理、独立运营后台与问题采集 API 返回 404。

### 7.5 前端部署清单

- [ ] 设置 `VITE_APP_API_BASE_URL` 指向生产 API。
- [ ] 设置 `VITE_BYPASS_AUTH=false`。
- [ ] 执行 `npm run build`。
- [ ] 部署 `dist/`。
- [ ] 验证首页、登录弹窗、workspace、canvas、usage、admin 路由刷新后不 404。
- [ ] 验证浏览器 console 无新增阻塞性错误。
- [ ] 验证 `version.json` 可访问，构建标识正常。

### 7.6 上线前验证清单

在真实 env 配齐后运行：

```bash
npm run check:validation-readiness
npm run check
npm run build
git diff --check
```

功能验证：

- [ ] 邮箱注册/登录验证码可发送、可验证、刷新 token 正常。
- [ ] 创建云项目，新增节点/边，保存后刷新能恢复。
- [ ] 图片上传、视频上传、远程资产代理正常。
- [ ] Chat run 可完成并记录 `workflow_runs`。
- [ ] Image run 可完成，生成结果可持久化到 Storage 或被标记为需客户端持久化。
- [ ] Video run 可创建、轮询并完成。
- [ ] `usage_events` 记录 run 的模型、token/图片/视频秒数、费用字段。
- [ ] 管理后台仅有用户列表/详情；角色、服务开通/暂停、账户生命周期和操作审计正常。
- [ ] `/usage-admin` 与旧 `/admin/*` 功能路径重定向到 `/admin/users`；未登录访问仍要求登录。
- [ ] 已退役接口返回 404，响应和页面不含 key 分配、余额、302 管理或问题收件箱字段。

## 8. 运维注意事项

- 不要把 `SUPABASE_SERVICE_ROLE_KEY`、provider key、Resend key、JWT secret 粘贴到 issue、聊天、截图或文档中。
- 需要暂停管理写入时，将 `ADMIN_LIFECYCLE_MUTATIONS_ENABLED` 设为 `false` 并重部署兼容版本；保留新 schema、审计和 transfer 证据，不直接执行破坏性下迁移。
- `RATE_LIMIT_PER_MINUTE` 是进程内限流，serverless 多实例下不是全局限流；如有公开高流量场景，应在网关/WAF 层补充限流。
- 后端使用 Supabase service-role 访问数据库，RLS/policy 仍保留，但主要安全边界在后端鉴权和 RBAC。
- Vercel preview origin 被代码允许匹配 `*.vercel.app`，生产仍应设置准确 `FRONTEND_ORIGIN`。
- 静态 Docker 路径的 `/v1` proxy 和当前 `/api/v1` API base 不完全一致，接手团队使用 Docker 前要先统一。
- 清理 Vercel 变量不会撤销上游 key，也不会删除旧部署快照；不能回滚到依赖旧变量的旧应用版本。
- Supabase Storage `uploads` 是 public bucket，适合当前公开 URL 预览模型；若未来需要私有媒体资产，需要调整上传服务、签名 URL 和前端渲染链路。

## 9. 关键命令速查

```bash
# 安装
npm ci
npm --prefix backend ci

# 本地运行
npm --prefix backend run dev
npm run dev

# 检查
npm run check:validation-readiness
npm run check
npm run build
git diff --check

# 后端健康检查
curl -fsS http://localhost:8787/api/v1/health
curl -fsS https://<api-domain>/api/v1/health

# 生成本地 JWT secret，不打印 secret
npm run generate:validation-jwt-secrets

# 打印最终验证 runbook
npm run show:final-validation-runbook
```

文字与图片用量以新接口返回的 token 记录，缺少金额时标记 estimated，不冒充已结算金额。当前不提供 302 用户 key 配额与官方账单对账；文字/图片和视频分别使用其服务端共享 key。
