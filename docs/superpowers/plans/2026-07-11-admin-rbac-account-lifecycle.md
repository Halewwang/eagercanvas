# Admin RBAC and Account Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the fixed-role admin permission model, add recoverable account archival/restoration, and provide secret-safe RBAC credential-management parity.

**Architecture:** Supabase remains the role/permission source of truth. Pure policy helpers express hierarchy and self-operation rules, while `admin-user-management.js` loads database context and enforces the last-active-super-admin invariant before mutation. Existing `/admin` routes remain the RBAC API boundary; legacy `/usage-admin` is retained until Plan 3 verifies frontend parity.

**Tech Stack:** Node.js ESM, Express, Zod, Supabase/Postgres SQL, Node test runner, Vue API client.

## Global Constraints

- Keep fixed roles exactly `super_admin`, `admin`, `ops`, `support`, and `user`.
- Users may hold multiple roles; effective permissions are the union of role permissions.
- Do not add a custom-role or permission editor.
- Frontend visibility is not authorization; every operation requires a backend permission and domain guard.
- User archival is recoverable and non-destructive; restoration returns the user to `suspended`.
- Only `super_admin` may archive or restore users.
- Never log or return complete API keys outside the one-time create response.
- Preserve existing workspace ownership transfer, session revocation, service disabling, billing history, and audit history.
- Follow TDD: observe each new test fail before writing production code.

---

### Task 1: Add the refined permission matrix and pure policy helpers

**Files:**
- Create: `supabase/016_admin_rbac_lifecycle.sql`
- Create: `backend/src/services/admin-access-policy.js`
- Create: `backend/src/services/admin-access-policy.test.js`

**Interfaces:**
- Produces: `ADMIN_PERMISSION`, `ADMIN_ROLE_CAPABILITIES`, `assertAdminTargetMutationAllowed()`, and `assertRoleGrantAllowed()`.
- Consumes: fixed role codes and permission strings from the approved specification.

- [ ] **Step 1: Write the failing policy tests**

```js
import assert from 'node:assert/strict'
import test from 'node:test'

import {
  ADMIN_PERMISSION,
  ADMIN_ROLE_CAPABILITIES,
  assertAdminTargetMutationAllowed,
  assertRoleGrantAllowed
} from './admin-access-policy.js'

test('fixed roles receive the new high-risk capability additions', () => {
  assert.equal(ADMIN_PERMISSION.userDelete, 'admin.user.delete')
  assert.equal(ADMIN_PERMISSION.userRestore, 'admin.user.restore')
  assert.deepEqual(ADMIN_ROLE_CAPABILITIES.ops.includes('admin.api_key.read'), true)
  assert.deepEqual(ADMIN_ROLE_CAPABILITIES.admin.includes('admin.user.delete'), false)
  assert.deepEqual(ADMIN_ROLE_CAPABILITIES.super_admin.includes('admin.user.restore'), true)
})

test('policy blocks self mutation and non-super-admin grants', () => {
  assert.throws(
    () => assertAdminTargetMutationAllowed({ operatorUserId: 'u1', targetUserId: 'u1', action: 'status' }),
    (error) => error.code === 'SELF_ADMIN_MUTATION_NOT_ALLOWED'
  )
  assert.throws(
    () => assertRoleGrantAllowed({ operatorRoles: ['admin'], targetRoles: ['user'], nextRoles: ['super_admin'] }),
    (error) => error.code === 'FORBIDDEN_SUPER_ADMIN_GRANT'
  )
})
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test backend/src/services/admin-access-policy.test.js`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `admin-access-policy.js`.

- [ ] **Step 3: Implement the pure policy module**

```js
import { HttpError } from '../utils/http.js'

export const ADMIN_PERMISSION = Object.freeze({
  dashboardRead: 'admin.dashboard.read',
  userRead: 'admin.user.read',
  userRoleUpdate: 'admin.user.role.update',
  userStatusUpdate: 'admin.user.status.update',
  userDelete: 'admin.user.delete',
  userRestore: 'admin.user.restore',
  apiKeyRead: 'admin.api_key.read',
  accessRead: 'admin.access.read'
})

export const ADMIN_ROLE_CAPABILITIES = Object.freeze({
  super_admin: Object.freeze(['admin.user.delete', 'admin.user.restore', 'admin.api_key.read', 'admin.access.read']),
  admin: Object.freeze(['admin.api_key.read', 'admin.access.read']),
  ops: Object.freeze(['admin.api_key.read']),
  support: Object.freeze([]),
  user: Object.freeze([])
})

export const assertAdminTargetMutationAllowed = ({ operatorUserId, targetUserId, action }) => {
  if (String(operatorUserId || '') === String(targetUserId || '')) {
    throw new HttpError(400, `Cannot ${action} your own admin account`, 'SELF_ADMIN_MUTATION_NOT_ALLOWED')
  }
}

export const assertRoleGrantAllowed = ({ operatorRoles = [], targetRoles = [], nextRoles = [] }) => {
  const isSuperAdmin = operatorRoles.includes('super_admin')
  if (!isSuperAdmin && targetRoles.includes('super_admin')) {
    throw new HttpError(403, 'Only super_admin can modify a super_admin account', 'FORBIDDEN_SUPER_ADMIN_EDIT')
  }
  if (!isSuperAdmin && nextRoles.includes('super_admin')) {
    throw new HttpError(403, 'Only super_admin can grant super_admin role', 'FORBIDDEN_SUPER_ADMIN_GRANT')
  }
}
```

- [ ] **Step 4: Add the idempotent migration**

```sql
insert into public.permissions (code, name, description) values
  ('admin.user.delete', 'Archive user', 'Archive a user without deleting billing or audit history'),
  ('admin.user.restore', 'Restore archived user', 'Restore an archived user to suspended state'),
  ('admin.api_key.read', 'Read API key inventory', 'Read masked upstream credential inventory'),
  ('admin.access.read', 'Read role capabilities', 'Read fixed role and permission mappings')
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p on p.code in (
  'admin.user.delete', 'admin.user.restore', 'admin.api_key.read', 'admin.access.read'
) where r.code = 'super_admin'
on conflict (role_id, permission_id) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p on p.code in (
  'admin.api_key.read', 'admin.access.read'
) where r.code = 'admin'
on conflict (role_id, permission_id) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p on p.code = 'admin.api_key.read'
where r.code = 'ops'
on conflict (role_id, permission_id) do nothing;
```

- [ ] **Step 5: Verify GREEN and commit**

Run: `node --test backend/src/services/admin-access-policy.test.js`

Expected: PASS, 2 tests.

```bash
git add supabase/016_admin_rbac_lifecycle.sql backend/src/services/admin-access-policy.js backend/src/services/admin-access-policy.test.js
git commit -m "feat: refine admin permission policy"
```

### Task 2: Enforce lifecycle invariants and add restoration

**Files:**
- Modify: `backend/src/services/admin-access-policy.js`
- Modify: `backend/src/services/admin-access-policy.test.js`
- Modify: `backend/src/services/admin-user-management.js`
- Modify: `backend/src/services/admin-user-management.test.js`
- Modify: `backend/src/services/admin-usage.service.js`
- Modify: `backend/src/services/service-access.service.js`
- Modify: `backend/src/services/service-access.service.test.js`
- Modify: `backend/src/services/admin-api-key-assignments.js`
- Modify: `backend/src/services/admin-api-key-assignments.test.js`

**Interfaces:**
- Produces: `assertActiveSuperAdminPreserved()`, `assertAccountMayReceiveServiceMutation()`, and `restoreUserAccount({ operatorUserId, operatorRoles, targetUserId, reason, ip, userAgent })`.
- Consumes: `assertAdminTargetMutationAllowed()` and `assertRoleGrantAllowed()` from Task 1.

- [ ] **Step 1: Add failing invariant tests**

Extend the existing policy-test import with `assertActiveSuperAdminPreserved` and `assertAccountMayReceiveServiceMutation`, and import `restoreUserAccount` in the user-management test before adding:

```js
test('policy rejects removal of the last active super admin', () => {
  assert.throws(
    () => assertActiveSuperAdminPreserved({
      targetRoles: ['super_admin'],
      nextRoles: ['admin'],
      targetStatus: 'active',
      nextStatus: 'active',
      activeSuperAdminCount: 1
    }),
    (error) => error.code === 'LAST_SUPER_ADMIN_REQUIRED'
  )
})

test('restoreUserAccount restores an archived user to suspended without enabling service', async () => {
  const result = await restoreUserAccount({
    operatorUserId: 'super-1',
    operatorRoles: ['super_admin'],
    targetUserId: 'user-1',
    reason: 'Appeal approved'
  })
  assert.equal(result.user.status, 'suspended')
  assert.equal(result.user.deletedAt, null)
  assert.equal(calls.some((call) => call[0] === 'user_service_credentials' && call[1] === 'update'), false)
})

test('archived accounts cannot receive service or key-assignment mutations', () => {
  assert.throws(
    () => assertAccountMayReceiveServiceMutation({ status: 'deleted', deletedAt: '2026-07-11T00:00:00Z' }),
    (error) => error.code === 'ARCHIVED_ACCOUNT_IMMUTABLE'
  )
})
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `node --test backend/src/services/admin-access-policy.test.js backend/src/services/admin-user-management.test.js`

Expected: FAIL because `assertActiveSuperAdminPreserved` and `restoreUserAccount` are not exported.

- [ ] **Step 3: Implement the pure last-super-admin guard**

```js
export const assertActiveSuperAdminPreserved = ({
  targetRoles = [], nextRoles = targetRoles, targetStatus = 'active', nextStatus = targetStatus,
  activeSuperAdminCount = 0
}) => {
  const removesActiveSuperAdmin = targetRoles.includes('super_admin') &&
    targetStatus === 'active' &&
    (!nextRoles.includes('super_admin') || nextStatus !== 'active')
  if (removesActiveSuperAdmin && Number(activeSuperAdminCount) <= 1) {
    throw new HttpError(409, 'At least one active super_admin is required', 'LAST_SUPER_ADMIN_REQUIRED')
  }
}

export const assertAccountMayReceiveServiceMutation = ({ status, deletedAt }) => {
  if (status === 'deleted' || deletedAt) {
    throw new HttpError(409, 'Restore the archived account before changing service access', 'ARCHIVED_ACCOUNT_IMMUTABLE')
  }
}
```

- [ ] **Step 4: Add database context and integrate all three mutations**

In `admin-user-management.js`, add `getActiveSuperAdminCount()`:

```js
const getActiveSuperAdminCount = async () => {
  const { data: role, error: roleError } = await supabase
    .from('roles').select('id').eq('code', 'super_admin').maybeSingle()
  if (roleError) throw new HttpError(500, roleError.message, 'ROLES_QUERY_FAILED')
  if (!role?.id) return 0
  const { data: assignments, error: assignmentError } = await supabase
    .from('user_roles').select('user_id').eq('role_id', role.id)
  if (assignmentError) throw new HttpError(500, assignmentError.message, 'USER_ROLES_QUERY_FAILED')
  const userIds = [...new Set((assignments || []).map((row) => row.user_id).filter(Boolean))]
  if (!userIds.length) return 0
  const { count, error: userError } = await supabase
    .from('users').select('id', { count: 'exact', head: true })
    .in('id', userIds).eq('status', 'active').is('deleted_at', null)
  if (userError) throw new HttpError(500, userError.message, 'USER_QUERY_FAILED')
  return Number(count || 0)
}
```

Before role replacement, suspension, or archival, load the target user and call:

```js
assertAdminTargetMutationAllowed({ operatorUserId, targetUserId: safeTargetUserId, action: 'modify' })
assertRoleGrantAllowed({ operatorRoles, targetRoles: beforeRoles, nextRoles: normalizedRoles })
assertActiveSuperAdminPreserved({
  targetRoles: beforeRoles,
  nextRoles: normalizedRoles,
  targetStatus: targetUser.status || 'active',
  nextStatus: targetUser.status || 'active',
  activeSuperAdminCount: await getActiveSuperAdminCount()
})
```

Use `nextStatus: safeStatus` for status updates and `nextStatus: 'deleted'` for archival.

Load `users.status,users.deleted_at` and call `assertAccountMayReceiveServiceMutation()` before service activation, manual binding, credential reset, limit changes, or key assignment. Keep safety disable available so archival can revoke an existing credential before the account is marked deleted. Add focused service and assignment tests showing an archived target is rejected without contacting 302 or mutating assignments.

- [ ] **Step 5: Implement restoration**

```js
export const restoreUserAccount = async ({ operatorUserId, operatorRoles = [], targetUserId, reason, ip, userAgent }) => {
  assertAdminTargetMutationAllowed({ operatorUserId, targetUserId, action: 'restore' })
  if (!operatorRoles.includes('super_admin')) {
    throw new HttpError(403, 'Only super_admin can restore an account', 'FORBIDDEN_USER_RESTORE')
  }
  const { data: target, error: targetError } = await supabase
    .from('users').select('id,email,status,deleted_at').eq('id', targetUserId).maybeSingle()
  if (targetError) throw new HttpError(500, targetError.message, 'USER_QUERY_FAILED')
  if (!target) throw new HttpError(404, 'Target user not found', 'TARGET_USER_NOT_FOUND')
  if (target.status !== 'deleted' || !target.deleted_at) {
    throw new HttpError(409, 'Account is not archived', 'ACCOUNT_NOT_ARCHIVED')
  }
  const restoredAt = new Date().toISOString()
  const { data: updated, error: updateError } = await supabase.from('users').update({
    status: 'suspended', deleted_at: null, deleted_by: null,
    suspended_at: restoredAt, suspended_reason: String(reason || '').trim()
  }).eq('id', targetUserId)
    .select('id,email,status,suspended_at,suspended_reason,deleted_at').single()
  if (updateError) throw new HttpError(500, updateError.message, 'USER_RESTORE_FAILED')
  invalidateUserAuthzCache(targetUserId)
  await createAdminLog({
    operatorUserId, targetUserId, action: 'admin.user.restore',
    metadata: { beforeStatus: 'deleted', afterStatus: 'suspended', reason, ip, userAgent }
  })
  return {
    ok: true,
    user: {
      id: updated.id, email: updated.email, status: updated.status,
      suspendedAt: updated.suspended_at, suspendedReason: updated.suspended_reason,
      deletedAt: updated.deleted_at
    }
  }
}
```

- [ ] **Step 6: Re-export, verify GREEN, and commit**

Run: `node --test backend/src/services/admin-access-policy.test.js backend/src/services/admin-user-management.test.js backend/src/services/service-access.service.test.js backend/src/services/admin-api-key-assignments.test.js`

Expected: PASS with the new self-operation, hierarchy, last-super-admin, archival, and restoration cases.

```bash
git add backend/src/services/admin-access-policy.js backend/src/services/admin-access-policy.test.js backend/src/services/admin-user-management.js backend/src/services/admin-user-management.test.js backend/src/services/admin-usage.service.js backend/src/services/service-access.service.js backend/src/services/service-access.service.test.js backend/src/services/admin-api-key-assignments.js backend/src/services/admin-api-key-assignments.test.js
git commit -m "feat: harden admin account lifecycle"
```

### Task 3: Apply route permissions, reasons, restoration, and audit contracts

**Files:**
- Create: `backend/src/services/admin-access-view.js`
- Create: `backend/src/services/admin-access-view.test.js`
- Modify: `backend/src/routes/admin.routes.js`
- Modify: `backend/src/routes/admin.routes.test.js`
- Modify: `src/api/admin.js`

**Interfaces:**
- Produces: `DELETE /admin/users/:userId` guarded by `admin.user.delete`, `POST /admin/users/:userId/restore` guarded by `admin.user.restore`, and read-only `GET /admin/access/roles` guarded by `admin.access.read`.
- Consumes: `restoreUserAccount()` from Task 2.

- [ ] **Step 1: Add failing route-contract tests**

```js
test('user archival and restoration have independent permissions', () => {
  assert.match(source, /adminRouter\.delete\('\/users\/:userId', requirePermission\(\['admin\.user\.delete'\]\)/)
  assert.match(source, /adminRouter\.post\('\/users\/:userId\/restore', requirePermission\(\['admin\.user\.restore'\]\)/)
  assert.doesNotMatch(source, /delete\('\/users\/:userId', requirePermission\(\['admin\.user\.status\.update'\]\)/)
})

test('fixed role capability matrix has a read-only RBAC route', () => {
  assert.match(source, /adminRouter\.get\('\/access\/roles', requirePermission\(\['admin\.access\.read'\]\)/)
})
```

- [ ] **Step 2: Verify RED**

Run: `node --test backend/src/routes/admin.routes.test.js`

Expected: FAIL because delete still uses `admin.user.status.update`, restore is absent, and the access matrix route does not exist.

- [ ] **Step 3: Implement schemas and routes**

```js
const adminReasonSchema = z.object({ reason: z.string().trim().min(1).max(500) })

adminRouter.delete('/users/:userId', requirePermission(['admin.user.delete']), asyncHandler(async (req, res) => {
  const { reason } = adminReasonSchema.parse(req.body || {})
  const result = await deleteUserAccount({
    operatorUserId: req.user.id, operatorRoles: req.user.roles || [], targetUserId: req.params.userId,
    reason, ip: req.ip, userAgent: req.headers['user-agent']
  })
  res.json(result)
}))

adminRouter.post('/users/:userId/restore', requirePermission(['admin.user.restore']), asyncHandler(async (req, res) => {
  const { reason } = adminReasonSchema.parse(req.body || {})
  const result = await restoreUserAccount({
    operatorUserId: req.user.id, operatorRoles: req.user.roles || [], targetUserId: req.params.userId,
    reason, ip: req.ip, userAgent: req.headers['user-agent']
  })
  res.json(result)
}))

adminRouter.get('/access/roles', requirePermission(['admin.access.read']), asyncHandler(async (_req, res) => {
  res.json({ data: await listAdminRoleCapabilities() })
}))
```

- [ ] **Step 4: Build the database-backed fixed role matrix**

```js
const FIXED_ROLE_ORDER = ['super_admin', 'admin', 'ops', 'support', 'user']

export const buildAdminRoleCapabilityMatrix = (rows = []) => FIXED_ROLE_ORDER.map((code) => {
  const role = rows.find((item) => item.code === code) || { code, name: code, description: '', role_permissions: [] }
  return {
    code: role.code,
    name: role.name,
    description: role.description || '',
    permissions: (role.role_permissions || [])
      .map((item) => item.permissions)
      .filter(Boolean)
      .map((permission) => ({ code: permission.code, name: permission.name, description: permission.description || '' }))
      .sort((a, b) => a.code.localeCompare(b.code))
  }
})

export const listAdminRoleCapabilities = async ({ client = supabase } = {}) => {
  const { data, error } = await client.from('roles').select(
    'code,name,description,role_permissions(permissions(code,name,description))'
  ).in('code', FIXED_ROLE_ORDER)
  if (error) throw new HttpError(500, error.message, 'ADMIN_ACCESS_QUERY_FAILED')
  return { roles: buildAdminRoleCapabilityMatrix(data || []), assignmentMode: 'multiple', definitionMode: 'fixed' }
}
```

Add a pure unit test that unordered database rows are emitted in the fixed order and that permissions are sorted without exposing any mutation API. The database remains the capability source of truth; `ADMIN_ROLE_CAPABILITIES` in Task 1 only documents and tests the new high-risk additions.

- [ ] **Step 5: Update the frontend API contract**

```js
export const deleteAdminUser = (userId, reason) => apiRequest({
  url: `/admin/users/${encodeURIComponent(userId)}`, method: 'delete', data: { reason }
})

export const restoreAdminUser = (userId, reason) => apiRequest({
  url: `/admin/users/${encodeURIComponent(userId)}/restore`, method: 'post', data: { reason }
})

export const getAdminRoleCapabilities = () => apiRequest({ url: '/admin/access/roles', method: 'get' })
```

- [ ] **Step 6: Verify GREEN and commit**

Run: `node --test backend/src/routes/admin.routes.test.js backend/src/services/admin-user-management.test.js backend/src/services/admin-access-view.test.js`

Expected: PASS.

```bash
git add backend/src/services/admin-access-view.js backend/src/services/admin-access-view.test.js backend/src/routes/admin.routes.js backend/src/routes/admin.routes.test.js src/api/admin.js
git commit -m "feat: split archive and restore permissions"
```

### Task 4: Provide secret-safe RBAC credential parity

**Files:**
- Create: `backend/src/services/admin-credential-view.js`
- Create: `backend/src/services/admin-credential-view.test.js`
- Modify: `backend/src/routes/admin.routes.js`
- Modify: `backend/src/routes/admin.routes.test.js`

**Interfaces:**
- Produces: `buildAdminCredentialView(item)`, masked `GET /admin/302/api-keys`, and masked `GET /admin/302/api-keys/:apiName`.
- Consumes: normalized 302 key responses and `admin.api_key.read` from Task 1.

- [ ] **Step 1: Write the failing secret-sanitization test**

```js
test('credential view removes complete secrets and keeps operational fields', () => {
  assert.deepEqual(buildAdminCredentialView({
    api_name: 'eager_user_a', api_key: 'sk-secret-12345678', limit_cost: 1000,
    limit_daily_cost: 100, expired_on: 0, status: 'active'
  }), {
    apiName: 'eager_user_a', keyLast4: '5678', limitCost: 1000,
    limitDailyCost: 100, expiredOn: 0, status: 'active'
  })
})
```

- [ ] **Step 2: Verify RED**

Run: `node --test backend/src/services/admin-credential-view.test.js`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement the sanitizer**

```js
export const buildAdminCredentialView = (item = {}) => {
  const secret = String(item.api_key || item.apiKey || '')
  return {
    apiName: String(item.api_name || item.apiName || ''),
    keyLast4: secret ? secret.slice(-4) : String(item.key_last4 || item.keyLast4 || ''),
    limitCost: Number(item.limit_cost || item.limitCost || 0),
    limitDailyCost: Number(item.limit_daily_cost || item.limitDailyCost || 0),
    expiredOn: Number(item.expired_on || item.expiredOn || 0),
    status: String(item.status || 'active')
  }
}
```

- [ ] **Step 4: Apply read permission and detail parity**

Change list/detail reads to:

```js
const credentialReadPermissions = ['admin.api_key.read', 'admin.api_key.assign', 'admin.api_key.manage']

adminRouter.get('/302/api-keys', requirePermission(credentialReadPermissions), asyncHandler(async (_req, res) => {
  const result = normalize302ApiKeyList(await get302ApiKeys())
  res.json({ data: result.map(buildAdminCredentialView) })
}))

adminRouter.get('/302/api-keys/:apiName', requirePermission(credentialReadPermissions), asyncHandler(async (req, res) => {
  const result = await get302ApiKey(req.params.apiName)
  res.json({ data: buildAdminCredentialView(result?.data ?? result) })
}))
```

Create/update/delete remain guarded by `admin.api_key.manage`; assignment remains guarded by `admin.api_key.assign`. The create response may expose `oneTimeApiKey` once, but list/detail responses never return `api_key`.

- [ ] **Step 5: Verify GREEN and commit**

Run: `node --test backend/src/services/admin-credential-view.test.js backend/src/routes/admin.routes.test.js backend/src/services/admin-api-key-assignments.test.js`

Expected: PASS.

```bash
git add backend/src/services/admin-credential-view.js backend/src/services/admin-credential-view.test.js backend/src/routes/admin.routes.js backend/src/routes/admin.routes.test.js
git commit -m "feat: secure RBAC credential inventory"
```

### Task 5: Verify the RBAC and lifecycle plan

**Files:**
- Verify only; do not change unrelated files.

**Interfaces:**
- Consumes all outputs from Tasks 1–4.
- Produces a verified foundation for Plans 2 and 3.

- [ ] **Step 1: Run focused tests**

Run:

```bash
node --test \
  backend/src/services/admin-access-policy.test.js \
  backend/src/services/admin-access-view.test.js \
  backend/src/services/admin-user-management.test.js \
  backend/src/services/admin-credential-view.test.js \
  backend/src/services/admin-api-key-assignments.test.js \
  backend/src/routes/admin.routes.test.js
```

Expected: all tests pass with zero failures.

- [ ] **Step 2: Run full repository gates**

Run: `npm run check`

Expected: exit 0.

Run: `npm run build`

Expected: exit 0 and a completed Vite bundle. If it stalls, report the stall and do not call the plan complete.

Run: `git diff --check`

Expected: no output.

- [ ] **Step 3: Review the migration and secrets boundary**

Run:

```bash
rg -n "admin.user.delete|admin.user.restore|admin.api_key.read|admin.access.read" supabase/016_admin_rbac_lifecycle.sql
rg -n "api_key|apiKey" backend/src/services/admin-credential-view.js backend/src/routes/admin.routes.js
```

Expected: all four permissions appear in the migration; list/detail response code contains no raw secret field.

- [ ] **Step 4: Confirm the worktree scope**

Run: `git status --short`

Expected: only files named by this plan are modified or untracked; `docs/PROJECT_HANDOFF_AND_DEPLOYMENT.md` remains untouched and untracked.
