# EagerCanvas 后台管理系统（RBAC）需求扩展与实施方案

## 1. 背景与现状

当前项目已经存在两个相关页面/模块：

- 前端 `src/views/Usage.vue`：`/usage`，登录用户可见。
- 前端 `src/views/UsageAdmin.vue`：`/usage-admin`，通过独立账号密码登录。
- 后端 `backend/src/routes/usage-admin.routes.js`：独立的 `usage-admin` API。
- 后端 `backend/src/middleware/admin-auth.js`：基于 `ADMIN_DASHBOARD_USERNAME/PASSWORD` + 独立 JWT。

当前问题：

1. 管理后台不是基于注册用户体系，而是单独的 admin 凭证体系。
2. 权限模型是“是否 admin”二元逻辑，无法做细粒度授权。
3. `/usage` 暴露了全局 302 管理能力（`/usage/302/*`）给普通登录用户，存在越权风险。
4. 路由层对 `/usage-admin` 前端放行（仅页面内做 token 检查），不是严格路由守卫。

结论：需要从“独立 admin 页面”升级为“统一身份 + RBAC + 后台子系统”。

---

## 2. 目标范围（V1）

### 2.1 功能目标

1. 独立后台入口：`/admin/*`。
2. 用户与角色管理：用户列表、角色分配、账号状态管理。
3. 用量管理：全局统计、分用户统计、时间筛选。
4. 审计日志：记录后台关键操作（角色变更、封禁、配额调整、密钥分配）。

### 2.2 安全目标

1. 后端强制鉴权与鉴权失败标准化（401/403）。
2. 细粒度权限校验（resource.action）。
3. 数据范围校验（普通用户只看自己；后台角色看全局）。
4. 去除普通用户对管理能力的访问通道（尤其是 `/usage/302/*`）。

### 2.3 非目标（V1 不做）

1. 多租户组织架构（org/team 级权限）。
2. ABAC（属性策略）引擎。
3. 复杂审批流（如双人审批）。

---

## 3. 角色与权限模型（RBAC）

### 3.1 建议角色

- `super_admin`：全权限，不可被 `admin` 修改。
- `admin`：后台管理主权限（用户、用量、key 分配）。
- `ops`：运营只读/有限写权限（可看统计，不可改高风险权限）。
- `support`：客服只读用户信息（不含高敏信息）。
- `user`：普通注册用户。

### 3.2 权限粒度（示例）

- `admin.dashboard.read`
- `admin.user.read`
- `admin.user.role.update`
- `admin.user.status.update`
- `admin.usage.read_all`
- `admin.api_key.assign`
- `admin.api_key.manage`
- `admin.audit.read`

### 3.3 默认策略

- 新注册用户默认绑定 `user`。
- 后台路由仅 `admin` 及以上可访问。
- `super_admin` 角色变更只能由 `super_admin` 执行。

---

## 4. 数据库设计（增量）

建议新增 migration：`supabase/004_rbac_admin_system.sql`

### 4.1 新表

1. `roles`
- `id uuid pk`
- `code text unique`（如 `super_admin`）
- `name text`
- `description text`
- `created_at timestamptz`

2. `permissions`
- `id uuid pk`
- `code text unique`（如 `admin.user.role.update`）
- `name text`
- `description text`
- `created_at timestamptz`

3. `user_roles`
- `user_id uuid` fk users
- `role_id uuid` fk roles
- `created_at timestamptz`
- `created_by uuid` fk users nullable
- PK(`user_id`, `role_id`)

4. `role_permissions`
- `role_id uuid` fk roles
- `permission_id uuid` fk permissions
- PK(`role_id`, `permission_id`)

5. `admin_operation_logs`（可复用原 `audit_logs`，但建议拆分）
- `id uuid pk`
- `operator_user_id uuid`
- `target_user_id uuid nullable`
- `action text`
- `metadata jsonb`
- `created_at timestamptz`

### 4.2 兼容现有表

- 保留 `audit_logs` 不删除；新后台关键操作写入 `admin_operation_logs`。
- 保留 `user_api_key_assignments`，作为权限分配业务的一部分。

### 4.3 种子数据

- 初始化角色与权限。
- 将配置项指定邮箱（如 `BOOTSTRAP_SUPER_ADMIN_EMAIL`）绑定 `super_admin`。
- 若无该用户，脚本提示并跳过，避免 migration 失败。

---

## 5. 后端改造方案

### 5.1 认证与鉴权中间件

新增：

- `backend/src/middleware/authz.js`
  - `requireRole(roleCodes: string[])`
  - `requirePermission(permissionCodes: string[])`
- `backend/src/services/rbac.service.js`
  - 查询用户角色、聚合权限、缓存（短 TTL）

在 `authRequired` 成功后将 `req.user` 扩展为：

- `id`
- `email`
- `roles: string[]`
- `permissions: string[]`

### 5.2 API 路由重构

1. 新增 `/admin/*` 路由组（建议）
- `GET /admin/session`
- `GET /admin/users`
- `PATCH /admin/users/:id/roles`
- `PATCH /admin/users/:id/status`
- `GET /admin/usage/summary`
- `GET /admin/usage/timeseries`
- `GET /admin/audit-logs`
- `POST /admin/api-keys/assign`
- `DELETE /admin/api-keys/assign`

2. 现有 `/usage-admin/*` 处理
- Phase 1 保留，内部转调新 service，逐步弃用。
- Phase 2 前端切换到 `/admin/*` 后，标记 deprecated。

3. 收敛 `/usage/*`
- 仅保留“当前用户自身数据”接口。
- 删除或迁移 `/usage/302/*` 到 `/admin/*`，并加权限校验。

### 5.3 审计策略

以下操作必须记录：

- 角色变更
- 用户封禁/解封
- API key 分配/解绑
- 管理侧配置修改

日志字段至少含：操作者、目标、前后差异、IP、UA、时间。

---

## 6. 前端改造方案

### 6.1 路由与页面拆分

建议路由：

- 用户域：`/app/usage`（原 `/usage`）
- 后台域：`/admin`, `/admin/users`, `/admin/usage`, `/admin/audit`

路由守卫策略：

1. 未登录访问 `/admin/*` => 跳登录。
2. 已登录但无后台权限 => 403 页面。
3. 后台页面不再使用独立 `X-Admin-Token` 机制。

### 6.2 状态管理

在 `src/stores/auth.js` 增加：

- `roles`
- `permissions`
- `hasRole(code)`
- `hasPermission(code)`

`bootstrapAuth()` 时同步拉取 `/admin/session`（可选懒加载）。

### 6.3 页面最小交付

1. `/admin/users`
- 搜索、分页、角色编辑弹窗、账号状态开关。

2. `/admin/usage`
- 全局卡片 + 趋势图 + 用户维度筛选。

3. `/admin/audit`
- 操作日志列表，支持按操作人/目标人/时间筛选。

---

## 7. 迭代计划与工期

### Phase 0（0.5-1 天）方案冻结

- 输出权限矩阵（角色 x 权限）。
- 确认 `/usage` 与 `/admin/usage` 数据边界。
- 评审通过后冻结 API 契约。

交付物：

- 权限矩阵文档
- API 列表与错误码

### Phase 1（2-3 天）权限基础设施

- 完成 `004_rbac_admin_system.sql`。
- 新增 `authz` 中间件与 RBAC service。
- 新建 `/admin/session` 与基础鉴权链路。
- `/usage/302/*` 加硬性权限保护（临时开关可保留）。

交付物：

- 可用的角色与权限校验
- 后端接口 smoke test 通过

### Phase 2（3-5 天）后台核心模块

- 完成 `/admin/users` 与角色分配。
- 完成 `/admin/usage` 全局统计。
- 完成审计日志写入与查询。

交付物：

- 后台 MVP 可用于实际运营

### Phase 3（1-2 天）收尾与切换

- 前端移除旧 `usage-admin` token 逻辑。
- 标记旧接口 deprecated 并准备下线时间。
- 完成越权回归测试与上线说明。

交付物：

- 正式可上线版本

---

## 8. 验收标准（必须满足）

1. 普通用户访问 `/admin/*` 返回 403。
2. 普通用户无法请求全局用量与 302 管理接口。
3. `admin` 可修改 `user`/`ops`/`support`，不可修改 `super_admin`。
4. 所有后台关键写操作都有审计日志。
5. 至少 12 条权限测试通过（接口级 + 路由级）。

---

## 9. 风险与回滚

### 9.1 主要风险

1. 权限迁移期间导致后台不可用。
2. 老接口未完全收敛导致越权旁路。
3. 前后端权限判断不一致。

### 9.2 缓解措施

1. 增量发布：先加新链路，再切前端，再下线旧链路。
2. 每个管理接口都做后端 `requirePermission`，前端仅作为体验层。
3. 对高风险接口添加审计和报警。

### 9.3 回滚策略

1. 保留旧 `/usage-admin/*` 1 个发布周期。
2. 新鉴权开关可通过环境变量暂时降级（仅应急）。
3. migration 仅新增表，不删除旧表，支持快速回退应用层。

---

## 10. 建议的下一步执行清单

1. 先落地 Phase 0 产物：权限矩阵 + API 契约（当天完成）。
2. 我来继续给出 `004_rbac_admin_system.sql` 初稿和 `authz.js` 中间件实现草案。
3. 确认后直接进入 Phase 1 编码。

