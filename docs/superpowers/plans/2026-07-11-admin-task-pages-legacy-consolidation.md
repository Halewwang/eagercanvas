# Admin Task Pages and Legacy Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the long scrolling admin page with seven aligned task routes, migrate all `/usage-admin` workflows into RBAC pages, and remove the independent Admin Token surface after parity verification.

**Architecture:** A nested `AdminLayout` owns the shared shell and permission-filtered navigation; route components own their own loaders and task UI. Existing focused admin components are reused behind page-specific composables. The credentials page consumes the secret-safe RBAC endpoints from Plan 1, while overview/users/usage consume local read models from Plan 2.

**Tech Stack:** Vue 3 Composition API, Vue Router 4, Pinia auth store, Naive UI, Tailwind CSS, Node test runner, Vite, Express route cleanup.

## Global Constraints

- Use the approved task routes: dashboard, users, credentials, usage, access, audit, and issues.
- Use a 12-column desktop grid, 8-column tablet grid, 4-column mobile grid, and 8px spacing rhythm.
- Page header, freshness, and primary action share one baseline.
- Information order is notification entry, metrics, filters, content, then details/actions.
- Each page has at most one primary action.
- Use the approved notification popover; do not restore a persistent full-width alert row.
- Use structured dialogs instead of native `prompt` or `confirm`.
- Mobile is read-only for administration and blocks every role, lifecycle, credential, assignment, service-access, reset, and limit mutation.
- Do not remove the legacy API until RBAC parity tests pass.
- Do not introduce a new frontend dependency unless an existing component cannot satisfy the structured-dialog behavior.
- Follow TDD and observe new tests fail before production code.

---

### Task 1: Define the admin layout and permission-owned navigation

**Files:**
- Create: `src/layouts/AdminLayout.vue`
- Create: `src/utils/adminNavigation.js`
- Create: `src/utils/adminNavigation.test.js`

**Interfaces:**
- Produces: `ADMIN_NAV_ITEMS`, `getAllowedAdminNavItems(permissions)`, `getFirstAllowedAdminRoute(permissions)`, and an unmounted `AdminLayout` ready for route activation in Task 6.
- Consumes: `auth.permissions`, `auth.loadAdminSession()`, shared `AdminShell` and navigation components.

- [ ] **Step 1: Write failing navigation tests**

```js
import assert from 'node:assert/strict'
import test from 'node:test'
import { ADMIN_NAV_ITEMS, getAllowedAdminNavItems, getFirstAllowedAdminRoute } from './adminNavigation.js'

test('admin navigation owns seven task routes and filters by permission', () => {
  assert.deepEqual(ADMIN_NAV_ITEMS.map((item) => item.routeName), [
    'AdminDashboard', 'AdminUsers', 'AdminCredentials', 'AdminUsage', 'AdminAccess', 'AdminAudit', 'AdminIssues'
  ])
  assert.deepEqual(getAllowedAdminNavItems(['admin.dashboard.read']).map((item) => item.routeName), ['AdminDashboard'])
  assert.equal(getFirstAllowedAdminRoute(['admin.api_key.read']), 'AdminCredentials')
})
```

- [ ] **Step 2: Verify RED**

Run: `node --test src/utils/adminNavigation.test.js`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement navigation metadata**

```js
export const ADMIN_NAV_ITEMS = Object.freeze([
  { key: 'AdminDashboard', routeName: 'AdminDashboard', path: '/admin/dashboard', label: '概览', permission: 'admin.dashboard.read', group: 'decision' },
  { key: 'AdminUsers', routeName: 'AdminUsers', path: '/admin/users', label: '用户管理', permission: 'admin.user.read', group: 'operations' },
  { key: 'AdminCredentials', routeName: 'AdminCredentials', path: '/admin/credentials', label: '服务与凭证', permission: 'admin.api_key.read', group: 'operations' },
  { key: 'AdminUsage', routeName: 'AdminUsage', path: '/admin/usage', label: '消耗对账', permission: 'admin.usage.read_all', group: 'operations' },
  { key: 'AdminAccess', routeName: 'AdminAccess', path: '/admin/access', label: '角色与权限', permission: 'admin.access.read', group: 'governance' },
  { key: 'AdminAudit', routeName: 'AdminAudit', path: '/admin/audit', label: '审计日志', permission: 'admin.audit.read', group: 'governance' },
  { key: 'AdminIssues', routeName: 'AdminIssues', path: '/admin/issues', label: '问题收件箱', permission: 'admin.issue.read', group: 'governance' }
])

export const getAllowedAdminNavItems = (permissions = []) => {
  const allowed = new Set(permissions)
  return ADMIN_NAV_ITEMS.filter((item) => allowed.has(item.permission))
}

export const getFirstAllowedAdminRoute = (permissions = []) =>
  getAllowedAdminNavItems(permissions)[0]?.routeName || 'Home'
```

- [ ] **Step 4: Create the layout**

```vue
<template>
  <AdminShell>
    <template #sidebar>
      <AdminSidebar
        :nav-items="navItems"
        :active-section="String(route.name || '')"
        :account-label="accountLabel"
        :roles="auth.roles.value"
        @select-section="navigate"
      />
    </template>
    <AdminMobileNav :nav-items="navItems" :active-section="String(route.name || '')" @select-section="navigate" />
    <RouterView />
  </AdminShell>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { AdminMobileNav, AdminShell, AdminSidebar } from '@/components/admin'
import { useAuthStore } from '@/stores/auth'
import { getAllowedAdminNavItems } from '@/utils/adminNavigation'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const navItems = computed(() => getAllowedAdminNavItems(auth.permissions.value))
const accountLabel = computed(() => auth.adminUser.value?.email || auth.user.value?.email || '-')
const navigate = (routeName) => router.push({ name: routeName })
</script>
```

- [ ] **Step 5: Verify GREEN and commit**

Run: `node --test src/utils/adminNavigation.test.js`

Expected: PASS. The current production router is intentionally unchanged until every referenced task page exists in Task 6.

```bash
git add src/layouts/AdminLayout.vue src/utils/adminNavigation.js src/utils/adminNavigation.test.js
git commit -m "feat: define admin task navigation"
```

### Task 2: Build the overview grid and notification popover

**Files:**
- Create: `src/views/AdminDashboard.vue`
- Create: `src/hooks/useAdminOverview.js`
- Create: `src/hooks/useAdminOverview.test.js`
- Create: `src/components/admin/features/AdminNotificationPopover.vue`
- Create: `src/components/admin/features/AdminNotificationPopover.test.js`
- Modify: `src/components/admin/features/AdminOverviewMetricGrid.vue`
- Modify: `src/components/admin/features/index.js`

**Interfaces:**
- Produces: overview page consuming `getAdminOverview()`, `notificationItems`, and route-linked reminder actions.
- Consumes: Plan 2 response `{ users, services, officialUsage, reconciliation, notifications }`.

- [ ] **Step 1: Write failing notification mapping tests**

```js
test('overview notifications are ordered by severity and map to task routes', () => {
  assert.deepEqual(buildAdminNotificationItems({
    providerFailures: 1, highRiskPermissionChanges: 2,
    reconciliationGapUsers: 3, serviceNotEnabledUsers: 4
  }).map((item) => item.routeName), [
    'AdminUsage', 'AdminAccess', 'AdminUsage', 'AdminUsers'
  ])
})
```

Add a component source test proving the popover exposes `role="dialog"`, `aria-modal="false"`, Esc handling, and no full-width persistent alert strip.

- [ ] **Step 2: Verify RED**

Run: `node --test src/hooks/useAdminOverview.test.js src/components/admin/features/AdminNotificationPopover.test.js`

Expected: FAIL because files are absent.

- [ ] **Step 3: Implement overview state**

```js
export const buildAdminNotificationItems = (notifications = {}) => [
  { key: 'provider', count: Number(notifications.providerFailures || 0), severity: 'danger', label: '服务商同步失败', routeName: 'AdminUsage' },
  { key: 'permission', count: Number(notifications.highRiskPermissionChanges || 0), severity: 'danger', label: '高风险权限变更', routeName: 'AdminAccess' },
  { key: 'reconciliation', count: Number(notifications.reconciliationGapUsers || 0), severity: 'warning', label: '用户存在对账差额', routeName: 'AdminUsage' },
  { key: 'service', count: Number(notifications.serviceNotEnabledUsers || 0), severity: 'info', label: '活跃用户未开通服务', routeName: 'AdminUsers' }
].filter((item) => item.count > 0)
```

`useAdminOverview()` loads once on mount, exposes `loading`, `error`, `data`, `notificationItems`, and `refresh()`.

- [ ] **Step 4: Implement the aligned page and popover**

Use one 12-column wrapper:

```vue
<div class="grid grid-cols-4 gap-4 md:grid-cols-8 xl:grid-cols-12">
  <AdminPageHeader class="col-span-full" />
  <AdminOverviewMetricGrid class="col-span-full" :cards="cards" />
  <AdminOverviewUsageTrendPanel class="col-span-full xl:col-span-8" />
  <AdminOverviewInsightPanel class="col-span-full xl:col-span-4" />
</div>
```

Place `AdminNotificationPopover` in the header action slot. Desktop uses an anchored absolute panel; mobile uses a fixed bottom sheet. Each item calls `router.push({ name: item.routeName })`.

- [ ] **Step 5: Verify GREEN and commit**

Run: `node --test src/hooks/useAdminOverview.test.js src/components/admin/features/AdminNotificationPopover.test.js src/views/AdminUsers.test.js`

Expected: PASS.

```bash
git add src/views/AdminDashboard.vue src/hooks/useAdminOverview.js src/hooks/useAdminOverview.test.js src/components/admin/features/AdminNotificationPopover.vue src/components/admin/features/AdminNotificationPopover.test.js src/components/admin/features/AdminOverviewMetricGrid.vue src/components/admin/features/index.js
git commit -m "feat: add admin overview and reminder center"
```

### Task 3: Convert user management to paginated list, detail route, multi-role editing, and structured lifecycle dialogs

**Files:**
- Modify: `src/views/AdminUsers.vue`
- Create: `src/views/AdminUserDetail.vue`
- Modify: `src/hooks/useAdminUsersState.js`
- Modify: `src/hooks/useAdminUsersStateCore.js`
- Modify: `src/hooks/useAdminUsersState.test.js`
- Modify: `src/hooks/useAdminUserActions.js`
- Modify: `src/hooks/useAdminUserActionsCore.js`
- Modify: `src/hooks/useAdminUserActions.test.js`
- Create: `src/components/admin/features/AdminRoleMultiSelect.vue`
- Create: `src/components/admin/features/AdminUserMutationDialog.vue`
- Modify: `src/components/admin/features/AdminUserServiceTable.vue`
- Modify: `src/components/admin/features/AdminUserServiceRow.vue`
- Modify: `src/components/admin/features/AdminUserOperationsCell.vue`
- Modify: `src/components/admin/features/index.js`
- Modify: `src/views/AdminUsers.test.js`

**Interfaces:**
- Produces: server-query state `{ page, limit, search, status, serviceStatus, role, reconciliationState }`, multi-role arrays, detail tabs, and dialog payload `{ action, reason, confirmation }`.
- Consumes: paginated/user-detail APIs from Plan 2 and archive/restore APIs from Plan 1.

- [ ] **Step 1: Write failing state and payload tests**

```js
test('selected role map preserves the full role array', () => {
  assert.deepEqual(getAdminSelectedRoleMap([{ id: 'u1', roles: ['admin', 'ops'] }]), { u1: ['admin', 'ops'] })
})

test('archive payload requires reason and exact email confirmation', () => {
  assert.deepEqual(buildAdminUserMutationPayload({
    action: 'archive', user: { email: 'a@example.com' }, reason: 'duplicate', confirmation: 'a@example.com'
  }), { ok: true, payload: { reason: 'duplicate' } })
  assert.equal(buildAdminUserMutationPayload({
    action: 'archive', user: { email: 'a@example.com' }, reason: '', confirmation: 'a@example.com'
  }).ok, false)
})

test('restore submits a reason through the dedicated restore API', async () => {
  const calls = []
  const actions = createAdminUserActions({ restoreUser: async (...args) => calls.push(args) })
  await actions.submitMutation({ action: 'restore', user: { id: 'u1' }, reason: 'appeal accepted' })
  assert.deepEqual(calls, [['u1', 'appeal accepted']])
})
```

- [ ] **Step 2: Verify RED**

Run: `node --test src/hooks/useAdminUsersState.test.js src/hooks/useAdminUserActions.test.js`

Expected: FAIL because role selection is scalar and mutation payload helper is absent.

- [ ] **Step 3: Switch the list to server query/pagination**

Replace client slicing with:

```js
const query = ref({ page: 1, limit: 25, search: '', status: '', serviceStatus: '', role: '', reconciliationState: '' })
const pagination = ref({ page: 1, limit: 25, total: 0 })

const loadUsers = async () => {
  if (!canReadUsers.value) return
  loadingUsers.value = true
  try {
    const response = await fetchUsers(query.value)
    users.value = response?.data?.items || []
    pagination.value = response?.data?.pagination || pagination.value
    selectedRoles.value = getAdminSelectedRoleMap(users.value)
  } finally {
    loadingUsers.value = false
  }
}
```

Reset `page` to 1 on filter changes and debounce search by 250ms.

- [ ] **Step 4: Implement multi-role editing**

`AdminRoleMultiSelect.vue` renders five fixed checkboxes, disables `super_admin` when the operator is not a super admin, and emits the complete non-empty array. `saveRoles(user)` sends `selectedRoles.value[user.id]` unchanged.

- [ ] **Step 5: Implement structured lifecycle dialogs**

```js
export const buildAdminUserMutationPayload = ({ action, user, reason, confirmation }) => {
  const safeReason = String(reason || '').trim()
  if (!safeReason) return { ok: false, message: '请输入操作原因' }
  if (action === 'archive' && String(confirmation || '').trim() !== String(user?.email || '').trim()) {
    return { ok: false, message: '请输入完整用户邮箱确认归档' }
  }
  return { ok: true, payload: { reason: safeReason } }
}
```

The dialog displays impact lists for suspend, archive, restore, service reset, and credential delete. Replace every `window.prompt` and `window.confirm` in `useAdminUserActions.js` with dialog state and explicit submit handlers. `submitMutation()` maps `archive` to `deleteAdminUser(user.id, reason)`, `restore` to `restoreAdminUser(user.id, reason)`, and reloads both list and open detail state only after a successful response.

- [ ] **Step 6: Simplify rows and add detail navigation**

Rows display identity, account state, official amount/currency, attribution coverage, service summary, role summary, and activity. A single menu opens the detail route or allowed quick action. Clicking identity routes to `{ name: 'AdminUserDetail', params: { userId: user.id } }`.

- [ ] **Step 7: Verify GREEN and commit**

Run: `node --test src/hooks/useAdminUsersState.test.js src/hooks/useAdminUserActions.test.js src/views/AdminUsers.test.js`

Expected: PASS and source assertions contain no `window.prompt` or `window.confirm` in admin user actions.

```bash
git add src/views/AdminUsers.vue src/views/AdminUserDetail.vue src/hooks/useAdminUsersState.js src/hooks/useAdminUsersStateCore.js src/hooks/useAdminUsersState.test.js src/hooks/useAdminUserActions.js src/hooks/useAdminUserActionsCore.js src/hooks/useAdminUserActions.test.js src/components/admin/features/AdminRoleMultiSelect.vue src/components/admin/features/AdminUserMutationDialog.vue src/components/admin/features/AdminUserServiceTable.vue src/components/admin/features/AdminUserServiceRow.vue src/components/admin/features/AdminUserOperationsCell.vue src/components/admin/features/index.js src/views/AdminUsers.test.js
git commit -m "feat: redesign admin user management"
```

### Task 4: Migrate legacy credential workflows into `/admin/credentials`

**Files:**
- Create: `src/views/AdminCredentials.vue`
- Create: `src/hooks/useAdminCredentials.js`
- Create: `src/hooks/useAdminCredentials.test.js`
- Modify: `src/hooks/useAdminServiceOps.js`
- Modify: `src/hooks/useAdminServiceOpsCore.js`
- Modify: `src/hooks/useAdminServiceOpsCore.test.js`
- Rename: `src/components/admin/features/UsageAdminCredentialsSection.vue` to `src/components/admin/features/AdminCredentialsSection.vue`
- Rename: `src/components/admin/features/UsageAdminCredentialCreateForm.vue` to `src/components/admin/features/AdminCredentialCreateForm.vue`
- Rename: `src/components/admin/features/UsageAdminCredentialTable.vue` to `src/components/admin/features/AdminCredentialTable.vue`
- Rename: `src/components/admin/features/UsageAdminCredentialRow.vue` to `src/components/admin/features/AdminCredentialRow.vue`
- Rename: `src/components/admin/features/UsageAdminCredentialAssignmentCell.vue` to `src/components/admin/features/AdminCredentialAssignmentCell.vue`
- Rename: `src/components/admin/features/UsageAdminAssignedCredentialsCell.vue` to `src/components/admin/features/AdminAssignedCredentialsCell.vue`
- Modify: `src/components/admin/features/index.js`
- Modify: `src/views/UsageAdmin.test.js`

**Interfaces:**
- Produces: RBAC credential page with balance, inventory, create/update/delete, assignment/unassignment, masked details, and one-time secret handling.
- Consumes: `/admin/302/*` and `/admin/api-keys/assign` functions in `src/api/admin.js`.

- [ ] **Step 1: Write failing RBAC credential state tests**

```js
test('credential state loads only the capabilities allowed by RBAC', async () => {
  const state = useAdminCredentials({
    canRead: ref(true), canManage: ref(false), canAssign: ref(false),
    fetchBalance: async () => ({ data: 10 }), fetchCredentials: async () => ({ data: [{ apiName: 'key-a', keyLast4: '1234' }] })
  })
  await state.load()
  assert.equal(state.credentials.value[0].keyLast4, '1234')
  assert.equal(state.canCreate.value, false)
})

test('credential update sends editable limits without exposing the full key', async () => {
  const calls = []
  const state = useAdminCredentials({
    canRead: ref(true), canManage: ref(true), canAssign: ref(false),
    updateCredential: async (...args) => calls.push(args)
  })
  await state.update('key-a', { limitCost: 200, limitDailyCost: 20, expiredOn: 0 })
  assert.deepEqual(calls, [['key-a', { limitCost: 200, limitDailyCost: 20, expiredOn: 0 }]])
  assert.equal(JSON.stringify(calls).includes('apiKey'), false)
})
```

- [ ] **Step 2: Verify RED**

Run: `node --test src/hooks/useAdminCredentials.test.js`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Build the RBAC state and page**

`useAdminCredentials()` accepts `canRead`, `canManage`, and `canAssign`. It calls only `src/api/admin.js`, never `src/api/usageAdmin.js`. It exposes create, update, delete, assign, and unassign methods gated by the matching capability. Update accepts only editable limit/expiry/status fields plus `apiName`; it never accepts or replays a full secret. Creation stores `oneTimeApiKey` in memory for a single modal render, clears it on close, and never writes it to local storage.

The page uses:

```vue
<div class="grid grid-cols-4 gap-4 md:grid-cols-8 xl:grid-cols-12">
  <AdminPageHeader class="col-span-full" />
  <AdminGlassMetricCard class="col-span-2 md:col-span-4 xl:col-span-3" label="302 余额" />
  <AdminCredentialsSection class="col-span-full" />
</div>
```

- [ ] **Step 4: Rename and neutralize reusable components**

Remove legacy login/session props and `UsageAdmin` copy from the six credential components. Preserve existing form fields, assignment behavior, limit/expiry behavior, and masked display. Update the feature barrel imports.

```bash
git mv src/components/admin/features/UsageAdminCredentialsSection.vue src/components/admin/features/AdminCredentialsSection.vue
git mv src/components/admin/features/UsageAdminCredentialCreateForm.vue src/components/admin/features/AdminCredentialCreateForm.vue
git mv src/components/admin/features/UsageAdminCredentialTable.vue src/components/admin/features/AdminCredentialTable.vue
git mv src/components/admin/features/UsageAdminCredentialRow.vue src/components/admin/features/AdminCredentialRow.vue
git mv src/components/admin/features/UsageAdminCredentialAssignmentCell.vue src/components/admin/features/AdminCredentialAssignmentCell.vue
git mv src/components/admin/features/UsageAdminAssignedCredentialsCell.vue src/components/admin/features/AdminAssignedCredentialsCell.vue
```

- [ ] **Step 5: Add parity assertions**

In `UsageAdmin.test.js`, replace the old page-structure assertions with a temporary parity test that reads `AdminCredentials.vue` and asserts API-key create, update, delete, assign, unassign, balance, and masked inventory events are present.

- [ ] **Step 6: Verify GREEN and commit**

Run: `node --test src/hooks/useAdminCredentials.test.js src/hooks/useAdminServiceOpsCore.test.js src/views/UsageAdmin.test.js`

Expected: PASS.

```bash
git add src/views/AdminCredentials.vue src/hooks/useAdminCredentials.js src/hooks/useAdminCredentials.test.js src/hooks/useAdminServiceOps.js src/hooks/useAdminServiceOpsCore.js src/hooks/useAdminServiceOpsCore.test.js src/components/admin/features src/views/UsageAdmin.test.js
git commit -m "feat: migrate credential admin into RBAC"
```

### Task 5: Create independent usage, access, audit, and issue pages

**Files:**
- Create: `src/views/AdminUsage.vue`
- Create: `src/views/AdminAccess.vue`
- Create: `src/views/AdminAudit.vue`
- Create: `src/views/AdminIssues.vue`
- Create: `src/hooks/useAdminUsagePage.js`
- Create: `src/hooks/useAdminUsagePage.test.js`
- Create: `src/hooks/useAdminAccessPage.js`
- Create: `src/hooks/useAdminAccessPage.test.js`
- Modify: `src/hooks/useAdminDashboardData.js`
- Modify: `src/hooks/useAdminIssueInbox.js`
- Modify: `src/components/admin/features/AdminServiceReconciliationSection.vue`
- Modify: `src/components/admin/features/AdminAuditLogSection.vue`
- Modify: `src/components/admin/features/AdminIssueInboxSection.vue`
- Modify: `src/views/AdminUsers.test.js`

**Interfaces:**
- Produces: four page-owned loaders and mutations.
- Consumes: usage/read-model APIs, fixed role matrix, existing audit APIs, and existing issue APIs.

- [ ] **Step 1: Write failing page-ownership tests**

```js
test('usage page owns reconciliation and source labels', () => {
  assert.match(adminUsageSource, /useAdminUsagePage/)
  assert.match(adminUsageSource, /302 官方累计/)
  assert.match(adminUsageSource, /本地模型归因/)
  assert.doesNotMatch(adminUsageSource, /官方调用量/)
})

test('access page renders fixed roles and multiple-role explanation', () => {
  assert.match(adminAccessSource, /super_admin/)
  assert.match(adminAccessSource, /权限并集/)
  assert.match(adminAccessHookSource, /getAdminRoleCapabilities/)
  assert.doesNotMatch(adminAccessSource, /创建角色|编辑权限/)
})
```

- [ ] **Step 2: Verify RED**

Run: `node --test src/hooks/useAdminUsagePage.test.js src/hooks/useAdminAccessPage.test.js src/views/AdminUsers.test.js`

Expected: FAIL because page files/hooks do not exist.

- [ ] **Step 3: Implement the usage page**

`useAdminUsagePage()` loads official summary, snapshot-derived series, attribution, reconciliation runs, and provider records. It exposes `sync()` only when `admin.billing.reconcile` is present. It renders `unavailable`, `partial`, `not_comparable`, and `anomalous` as states, never zero fallbacks.

- [ ] **Step 4: Implement the fixed access page**

`useAdminAccessPage()` loads `getAdminRoleCapabilities()` from Plan 1 and combines its database-backed fixed role metadata with the current session's permissions. The page is read-only at the role-definition level; user assignment links to the selected user's role tab. It never offers create-role or edit-permission actions.

- [ ] **Step 5: Wrap existing audit and issue features in route pages**

`AdminAudit.vue` owns `useAdminDashboardData({ canReadAudit })` and renders only `AdminAuditLogSection`. `AdminIssues.vue` owns `useAdminIssueInbox()` and renders only `AdminIssueInboxSection`. Remove their props/data ownership from `AdminUsers.vue`.

- [ ] **Step 6: Verify GREEN and commit**

Run: `node --test src/hooks/useAdminUsagePage.test.js src/hooks/useAdminAccessPage.test.js src/views/AdminUsers.test.js src/hooks/useAdminIssueInbox.test.js src/hooks/useAdminDashboardData.test.js`

Expected: PASS.

```bash
git add src/views/AdminUsage.vue src/views/AdminAccess.vue src/views/AdminAudit.vue src/views/AdminIssues.vue src/hooks/useAdminUsagePage.js src/hooks/useAdminUsagePage.test.js src/hooks/useAdminAccessPage.js src/hooks/useAdminAccessPage.test.js src/hooks/useAdminDashboardData.js src/hooks/useAdminIssueInbox.js src/components/admin/features/AdminServiceReconciliationSection.vue src/components/admin/features/AdminAuditLogSection.vue src/components/admin/features/AdminIssueInboxSection.vue src/views/AdminUsers.test.js
git commit -m "feat: split admin governance task pages"
```

### Task 6: Activate task routes and apply responsive safety rules

**Files:**
- Create: `src/components/admin/AdminDesktopOnlyAction.vue`
- Create: `src/components/admin/AdminDesktopOnlyAction.test.js`
- Create: `src/components/admin/features/AdminServiceMutationDialog.vue`
- Modify: `src/components/admin/features/AdminUserServiceActiveActions.vue`
- Modify: `src/components/admin/features/AdminManualServiceKeyModal.vue`
- Modify: `src/hooks/useAdminUserActions.js`
- Modify: `src/hooks/useAdminUserActionsCore.js`
- Modify: `src/hooks/useAdminUserActions.test.js`
- Modify: `src/components/admin/AdminShell.vue`
- Modify: `src/components/admin/AdminSidebar.vue`
- Modify: `src/components/admin/AdminMobileNav.vue`
- Modify: `src/router/index.js`
- Modify: `src/stores/auth.js`
- Modify: `src/views/AdminUsers.vue`
- Modify: `src/views/AdminUserDetail.vue`
- Modify: `src/views/AdminCredentials.vue`
- Modify: `src/views/AdminUsage.vue`
- Modify: `src/views/AdminIssues.vue`
- Modify: `src/views/AdminUsers.test.js`

**Interfaces:**
- Produces: live nested task routes, route-level permission fallback, desktop-only mutation guard, and structured service/credential/limit dialogs.
- Consumes: existing service-access APIs and permission state.

- [ ] **Step 1: Write failing route-activation and responsive/action tests**

```js
test('desktop-only action explains blocked mobile mutations', () => {
  assert.match(source, /min-width:\s*768px/)
  assert.match(source, /请使用桌面端完成此操作/)
})

test('admin actions no longer use native prompts or confirms', () => {
  assert.doesNotMatch(userActionsSource, /windowTarget\?\.(prompt|confirm)/)
})

test('router mounts seven pages under the shared admin layout', () => {
  assert.match(routerSource, /component:\s*\(\) => import\('@\/layouts\/AdminLayout\.vue'\)/)
  for (const name of ['AdminDashboard', 'AdminUsers', 'AdminCredentials', 'AdminUsage', 'AdminAccess', 'AdminAudit', 'AdminIssues']) {
    assert.match(routerSource, new RegExp(`name:\\s*'${name}'`))
  }
})
```

- [ ] **Step 2: Verify RED**

Run: `node --test src/components/admin/AdminDesktopOnlyAction.test.js src/hooks/useAdminUserActions.test.js`

Expected: FAIL because the guard is absent, native prompts remain, and the nested layout is not mounted.

- [ ] **Step 3: Activate nested task routes only after all page files exist**

Replace the flat admin routes with:

```js
{
  path: '/admin',
  component: () => import('@/layouts/AdminLayout.vue'),
  children: [
    { path: '', redirect: '/admin/dashboard' },
    { path: 'dashboard', name: 'AdminDashboard', component: () => import('@/views/AdminDashboard.vue'), meta: { permission: 'admin.dashboard.read' } },
    { path: 'users', name: 'AdminUsers', component: () => import('@/views/AdminUsers.vue'), meta: { permission: 'admin.user.read' } },
    { path: 'users/:userId', name: 'AdminUserDetail', component: () => import('@/views/AdminUserDetail.vue'), meta: { permission: 'admin.user.read' } },
    { path: 'credentials', name: 'AdminCredentials', component: () => import('@/views/AdminCredentials.vue'), meta: { permission: 'admin.api_key.read' } },
    { path: 'usage', name: 'AdminUsage', component: () => import('@/views/AdminUsage.vue'), meta: { permission: 'admin.usage.read_all' } },
    { path: 'access', name: 'AdminAccess', component: () => import('@/views/AdminAccess.vue'), meta: { permission: 'admin.access.read' } },
    { path: 'audit', name: 'AdminAudit', component: () => import('@/views/AdminAudit.vue'), meta: { permission: 'admin.audit.read' } },
    { path: 'issues', name: 'AdminIssues', component: () => import('@/views/AdminIssues.vue'), meta: { permission: 'admin.issue.read' } }
  ]
},
{ path: '/admin/service', redirect: '/admin/usage' },
{ path: '/usage-admin', redirect: '/admin/credentials' }
```

After `auth.loadAdminSession()` succeeds, enforce route metadata:

```js
const permission = to.matched.map((record) => record.meta.permission).filter(Boolean).at(-1)
if (permission && !auth.hasPermission(permission)) {
  return { name: getFirstAllowedAdminRoute(auth.permissions.value) }
}
```

Remove the old `isUsageAdmin` authentication bypass from the router guard; `/usage-admin` must resolve to `/admin/credentials` and then pass the same normal authentication and RBAC checks. Update sidebar/mobile navigation to emit `item.routeName`, and remove the outer `AdminShell`/scroll-navigation composition from `AdminUsers.vue` because `AdminLayout` now owns it.

- [ ] **Step 4: Implement mobile mutation blocking**

`AdminDesktopOnlyAction.vue` uses `window.matchMedia('(min-width: 768px)')`. It renders its action slot on desktop and a disabled explanatory button on smaller viewports. Wrap every mutating entry point: role/status changes, suspend/resume/archive/restore, credential create/update/delete, assign/unassign, service activate/manual-bind/disable/reset, limit changes, usage synchronization, and issue status/email mutations. Search, filters, navigation, notifications, user/usage state, audit, issue reading, and local export remain available.

- [ ] **Step 5: Implement structured service dialogs**

`AdminServiceMutationDialog.vue` supports `disable`, `reset`, and `limits`. Disable/reset require a reason; reset shows credential impact; limits use labeled numeric inputs with explicit provider unit copy. `AdminManualServiceKeyModal.vue` remains structured and never logs or persists the secret.

- [ ] **Step 6: Align shell breakpoints**

Use 16px mobile gutters, 8-column tablet composition, and 12-column desktop composition. Preserve a single main scroll container and do not reintroduce section-scroll navigation.

- [ ] **Step 7: Verify GREEN and commit**

Run: `node --test src/components/admin/AdminDesktopOnlyAction.test.js src/hooks/useAdminUserActions.test.js src/views/AdminUsers.test.js src/utils/adminNavigation.test.js`

Expected: PASS.

```bash
git add src/components/admin/AdminDesktopOnlyAction.vue src/components/admin/AdminDesktopOnlyAction.test.js src/components/admin/features/AdminServiceMutationDialog.vue src/components/admin/features/AdminUserServiceActiveActions.vue src/components/admin/features/AdminManualServiceKeyModal.vue src/hooks/useAdminUserActions.js src/hooks/useAdminUserActionsCore.js src/hooks/useAdminUserActions.test.js src/components/admin/AdminShell.vue src/components/admin/AdminSidebar.vue src/components/admin/AdminMobileNav.vue src/router/index.js src/stores/auth.js src/views/AdminUsers.vue src/views/AdminUserDetail.vue src/views/AdminCredentials.vue src/views/AdminUsage.vue src/views/AdminIssues.vue src/views/AdminUsers.test.js
git commit -m "feat: activate secure admin task routes"
```

### Task 7: Remove the legacy Admin Token surface after parity passes

**Files:**
- Delete: `src/views/UsageAdmin.vue`
- Delete: `src/api/usageAdmin.js`
- Delete: `src/hooks/useUsageAdminAccessState.js`
- Delete: `src/hooks/useUsageAdminAccessState.test.js`
- Delete: `src/hooks/useUsageAdminCredentialActions.js`
- Delete: `src/hooks/useUsageAdminCredentialActions.test.js`
- Delete: `src/hooks/useUsageAdminDataState.js`
- Delete: `src/hooks/useUsageAdminDataState.test.js`
- Delete: `src/hooks/useUsageAdminDisplayState.js`
- Delete: `src/hooks/useUsageAdminDisplayState.test.js`
- Delete: `src/components/admin/features/UsageAdminButton.vue`
- Delete: `src/components/admin/features/UsageAdminCheckOption.vue`
- Delete: `src/components/admin/features/UsageAdminFormControl.vue`
- Delete: `src/components/admin/features/UsageAdminHeader.vue`
- Delete: `src/components/admin/features/UsageAdminLoginCard.vue`
- Delete: `src/components/admin/features/UsageAdminMetricCard.vue`
- Delete: `src/components/admin/features/UsageAdminOverviewSection.vue`
- Delete: `src/components/admin/features/UsageAdminShell.vue`
- Delete: `src/components/admin/features/UsageAdminSidebar.vue`
- Delete: `src/components/admin/features/UsageAdminSurface.vue`
- Delete: `src/components/admin/features/UsageAdminUserRow.vue`
- Delete: `src/components/admin/features/UsageAdminUsersSection.vue`
- Delete: `backend/src/routes/usage-admin.routes.js`
- Delete: `backend/src/middleware/admin-auth.js`
- Modify: `backend/src/routes/index.js`
- Modify: `backend/src/config/env.js`
- Modify: `src/utils/constants.js`
- Modify: `src/views/UsageAdmin.test.js`
- Modify: `src/router/index.js`

**Interfaces:**
- Produces: normal RBAC session as the only admin authentication model.
- Consumes: verified credential and usage parity from Tasks 4–6.

- [ ] **Step 1: Add a failing legacy-removal test**

Convert `src/views/UsageAdmin.test.js` into a source-boundary test:

```js
test('legacy usage-admin authentication surface is removed', () => {
  assert.equal(existsSync(new URL('./UsageAdmin.vue', import.meta.url)), false)
  assert.equal(existsSync(new URL('../api/usageAdmin.js', import.meta.url)), false)
  assert.doesNotMatch(routerSource, /name:\s*'UsageAdmin'/)
  assert.match(routerSource, /path:\s*'\/usage-admin'[\s\S]*redirect:\s*'\/admin\/credentials'/)
  assert.doesNotMatch(routesIndexSource, /usageAdminRouter/)
})
```

- [ ] **Step 2: Run parity gates before deletion**

Run:

```bash
node --test \
  src/hooks/useAdminCredentials.test.js \
  src/hooks/useAdminUsagePage.test.js \
  backend/src/services/admin-credential-view.test.js \
  backend/src/services/admin-api-key-assignments.test.js \
  backend/src/routes/admin.routes.test.js
```

Expected: PASS for balance, inventory, create/update/delete, assignment/unassignment, user visibility, provider records, and usage synchronization contracts.

- [ ] **Step 3: Delete the legacy files and mount**

Remove `usageAdminRouter` import/mount from `backend/src/routes/index.js`. Remove `USAGE_ADMIN_TOKEN` from `src/utils/constants.js`. Remove `adminDashboardUsername`, `adminDashboardPassword`, `adminDashboardJwtSecret`, and `adminDashboardTokenTtlSec` from `backend/src/config/env.js`. Keep the frontend `/usage-admin` redirect only.

- [ ] **Step 4: Remove orphaned legacy components**

Run:

```bash
rg -l "UsageAdmin" src/components/admin/features src/hooks src/views src/api
```

Expected after deleting the twelve components listed in this task: only `src/views/UsageAdmin.test.js` remains.

- [ ] **Step 5: Verify GREEN and commit**

Run: `node --test src/views/UsageAdmin.test.js backend/src/routes/admin.routes.test.js src/utils/adminNavigation.test.js`

Expected: PASS.

```bash
git add -A -- \
  src/views/UsageAdmin.vue src/views/UsageAdmin.test.js src/api/usageAdmin.js \
  src/hooks/useUsageAdminAccessState.js src/hooks/useUsageAdminAccessState.test.js \
  src/hooks/useUsageAdminCredentialActions.js src/hooks/useUsageAdminCredentialActions.test.js \
  src/hooks/useUsageAdminDataState.js src/hooks/useUsageAdminDataState.test.js \
  src/hooks/useUsageAdminDisplayState.js src/hooks/useUsageAdminDisplayState.test.js \
  src/components/admin/features/UsageAdminButton.vue \
  src/components/admin/features/UsageAdminCheckOption.vue \
  src/components/admin/features/UsageAdminFormControl.vue \
  src/components/admin/features/UsageAdminHeader.vue \
  src/components/admin/features/UsageAdminLoginCard.vue \
  src/components/admin/features/UsageAdminMetricCard.vue \
  src/components/admin/features/UsageAdminOverviewSection.vue \
  src/components/admin/features/UsageAdminShell.vue \
  src/components/admin/features/UsageAdminSidebar.vue \
  src/components/admin/features/UsageAdminSurface.vue \
  src/components/admin/features/UsageAdminUserRow.vue \
  src/components/admin/features/UsageAdminUsersSection.vue \
  backend/src/routes/usage-admin.routes.js backend/src/middleware/admin-auth.js \
  backend/src/routes/index.js backend/src/config/env.js src/utils/constants.js src/router/index.js \
  src/components/admin/features/index.js
git commit -m "refactor: retire legacy usage admin auth"
```

### Task 8: Final verification and browser acceptance

**Files:**
- Verify only.

**Interfaces:**
- Produces the complete consolidated admin experience.

- [ ] **Step 1: Run focused frontend and backend tests**

```bash
node --test \
  src/utils/adminNavigation.test.js \
  src/hooks/useAdminOverview.test.js \
  src/hooks/useAdminUsersState.test.js \
  src/hooks/useAdminUserActions.test.js \
  src/hooks/useAdminCredentials.test.js \
  src/hooks/useAdminUsagePage.test.js \
  src/hooks/useAdminAccessPage.test.js \
  src/views/AdminUsers.test.js \
  src/views/UsageAdmin.test.js \
  backend/src/routes/admin.routes.test.js
```

Expected: zero failures.

- [ ] **Step 2: Run complete repository gates**

Run: `npm run check`

Expected: exit 0.

Run: `npm run build`

Expected: exit 0 and completed Vite bundle.

Run: `git diff --check`

Expected: no output.

- [ ] **Step 3: Prove legacy auth and secret fields are absent**

```bash
rg -n "USAGE_ADMIN_TOKEN|X-Admin-Token|ADMIN_DASHBOARD_USERNAME|ADMIN_DASHBOARD_PASSWORD|ADMIN_DASHBOARD_JWT_SECRET|usageAdminLogin" \
  src backend/src --glob '!*.test.js'
```

Expected: no output.

Run:

```bash
rg -n '"api_key"\s*:|"apiKey"\s*:' dist/assets/*Admin* 2>/dev/null
```

Expected: no output; serialized admin bundles contain no raw credential response field.

- [ ] **Step 4: Run browser smoke tests**

Verify at 1440px, 1024px, and 390px widths:

- all seven routes render independently and request only their page data;
- unauthorized routes fall back to the first allowed route without protected API requests;
- notification popover is anchored on desktop and a bottom sheet on mobile;
- user list filters/pagination and detail deep links survive refresh;
- structured archive/restore/service dialogs display impact and validation;
- mobile reads work and high-risk actions explain the desktop requirement;
- `/usage-admin` redirects to `/admin/credentials` without a second login;
- no console error, Vite overlay, secret value, or indefinite loader appears.

- [ ] **Step 5: Confirm final worktree scope**

Run: `git status --short --branch`

Expected: implementation files are committed; the user's `docs/PROJECT_HANDOFF_AND_DEPLOYMENT.md` remains untouched and untracked unless the user separately asks to include it.
