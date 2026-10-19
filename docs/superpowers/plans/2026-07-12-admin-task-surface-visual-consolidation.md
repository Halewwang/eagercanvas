# Admin Task Surface Visual Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the user, credential, and usage task surfaces match the existing neutral admin design while improving action clarity and responsive grid alignment.

**Architecture:** Keep all existing permissions, mutations, and data contracts intact. Change only the presentation layer and the existing user-detail navigation path: the table keeps a compact grouped action menu, full role editing moves to the existing roles detail tab, and explicit single-root wrappers prevent multi-root Vue components from collapsing inside parent grids.

**Tech Stack:** Vue 3 SFCs, Vue Router, Tailwind utility classes, scoped CSS, existing Coolicons, Node test runner, Vite.

## Global Constraints

- Preserve all RBAC checks, mutation guards, dialogs, provider contracts, and technical identifiers.
- Use the existing neutral dark admin palette; no saturated blue menu surface or green create button.
- Desktop target: 1354–1440 px; tablet: 1024 px; mobile: 390 px.
- No horizontal overflow or character-by-character wrapping at any target viewport.
- Do not read, modify, stage, or commit `docs/PROJECT_HANDOFF_AND_DEPLOYMENT.md`.

---

### Task 1: Compact user filters and action menu

**Files:**
- Modify: `src/components/admin/features/AdminUserOperationsCell.vue`
- Modify: `src/components/admin/features/AdminUserServiceRow.vue`
- Modify: `src/components/admin/features/AdminUserServiceFilters.vue`
- Modify: `src/components/admin/features/AdminUserServiceTableHeader.vue`
- Modify: `src/hooks/adminAccessNavigation.js`
- Test: `src/components/admin/features/AdminUserOperationsCell.test.js`
- Test: `src/hooks/adminAccessNavigation.test.js`
- Test: `src/views/AdminUsers.test.js`

**Interfaces:**
- Consumes: `buildAdminAccessAssignmentTarget(userId)` and the existing `AdminUserDetail` roles tab.
- Produces: `buildAdminUserDetailTarget(userId, tab)` returning a Vue Router target; a compact operations trigger; three visible operation groups.

- [ ] **Step 1: Write failing navigation and component contract tests**

```js
test('buildAdminUserDetailTarget routes roles to the existing detail surface', () => {
  assert.deepEqual(buildAdminUserDetailTarget(' user-42 ', 'roles'), {
    name: 'AdminUsers',
    query: { userId: 'user-42', tab: 'roles' }
  })
})

test('user operation menu is compact, neutral, grouped, and icon-led', () => {
  assert.match(source, /aria-label="用户操作"/)
  assert.match(source, /EllipsisHorizontalOutline/)
  for (const label of ['详情与角色', '服务凭证', '账户状态']) assert.match(source, new RegExp(label))
  assert.doesNotMatch(source, /rgb\(15,22,36\)|AdminRoleMultiSelect|保存角色/)
})
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```bash
node --test \
  src/components/admin/features/AdminUserOperationsCell.test.js \
  src/hooks/adminAccessNavigation.test.js \
  src/views/AdminUsers.test.js
```

Expected: FAIL because the compact trigger, grouped menu, detail-target helper, and full-width filter allocation do not yet exist.

- [ ] **Step 3: Implement the compact operation surface**

Add the route helper:

```js
export const buildAdminUserDetailTarget = (userId, tab = 'summary') => {
  const targetUserId = normalizeString(userId)
  const requestedTab = normalizeString(tab)
  if (requestedTab === 'roles') {
    return buildAdminAccessAssignmentTarget(targetUserId)
  }
  return {
    name: 'AdminUserDetail',
    params: { userId: targetUserId },
    ...(ADMIN_USER_DETAIL_TABS.has(requestedTab) ? { query: { tab: requestedTab } } : {})
  }
}
```

Replace the operations trigger/menu with this structure:

```vue
<summary class="admin-user-operations-trigger" aria-label="用户操作" title="用户操作">
  <EllipsisHorizontalOutline aria-hidden="true" />
</summary>
<div class="admin-user-operations-menu">
  <section class="admin-operation-group">
    <p class="admin-operation-group-label">详情与角色</p>
    <AdminMicroButton icon="detail" block @click="emit('open-detail')">查看详情</AdminMicroButton>
    <AdminMicroButton v-if="canManageRoles" icon="settings" block @click="emit('open-role-detail')">管理角色</AdminMicroButton>
  </section>
  <section v-if="showUserActions" class="admin-operation-group">
    <p class="admin-operation-group-label">服务凭证</p>
    <AdminMicroButton v-if="canActivateService && user.service?.serviceStatus !== 'active'" icon="play" block @click="emit('activate-service', user)">开通服务</AdminMicroButton>
    <AdminMicroButton v-if="canActivateService && user.service?.serviceStatus !== 'active'" icon="settings" block @click="emit('bind-manual-service', user)">绑定服务 Key</AdminMicroButton>
    <AdminMicroButton v-if="canDisableService && user.service?.serviceStatus === 'active'" icon="pause" block @click="emit('disable-service', user)">停用服务凭证</AdminMicroButton>
    <AdminMicroButton v-if="canResetService && user.service?.serviceStatus === 'active'" icon="refresh" block @click="emit('reset-service', user)">重置服务凭证</AdminMicroButton>
    <AdminMicroButton v-if="canUpdateServiceLimits && user.service?.serviceStatus === 'active'" icon="settings" block @click="emit('update-service-limits', user)">调整额度</AdminMicroButton>
  </section>
  <section v-if="!isSelf(user)" class="admin-operation-group">
    <p class="admin-operation-group-label">账户状态</p>
    <AdminMicroButton v-if="canManageUserStatus && user.status === 'active'" icon="pause" block @click="emit('suspend-user', user)">暂停用户</AdminMicroButton>
    <AdminMicroButton v-if="canManageUserStatus && user.status === 'suspended'" icon="play" block @click="emit('activate-user', user)">恢复状态</AdminMicroButton>
    <AdminMicroButton v-if="canArchiveUser && user.status !== 'deleted'" icon="trash" tone="danger" block @click="emit('delete-user', user)">归档用户</AdminMicroButton>
    <AdminMicroButton v-if="canRestoreUser && user.status === 'deleted'" icon="play" block @click="emit('restore-user', user)">恢复归档用户</AdminMicroButton>
  </section>
</div>
```

Use neutral menu CSS and a compact cell:

```css
.admin-user-operations-cell { position: relative; width: 56px; min-width: 56px; }
.admin-user-operations-trigger { width: 36px; height: 36px; display: grid; place-items: center; }
.admin-user-operations-menu { width: min(288px, calc(100vw - 32px)); background: #171719; }
.admin-operation-group { display: grid; gap: 6px; padding: 8px; border-top: 1px solid rgba(255,255,255,.08); }
```

Route “管理角色” through `buildAdminUserDetailTarget(user.id, 'roles')` in `AdminUserServiceRow.vue`. Do not render `AdminRoleMultiSelect` or save-role controls inside the table menu.

- [ ] **Step 4: Fill the desktop filter grid exactly**

Use these allocations in `AdminUserServiceFilters.vue`:

```vue
<AdminFilterField class="col-span-4 md:col-span-4 xl:col-span-4" label="搜索用户">
<AdminFilterField class="col-span-2 md:col-span-2 xl:col-span-2" label="服务状态">
<AdminFilterField class="col-span-2 md:col-span-2 xl:col-span-2" label="角色">
<AdminFilterField class="col-span-2 md:col-span-2 xl:col-span-2" label="对账状态">
<AdminFilterField class="col-span-2 md:col-span-2 xl:col-span-2" label="状态筛选">
<AdminUserServiceFilterSummary
  class="col-span-full"
  :total-users="totalUsers"
  :user-page-end="userPageEnd"
  :user-page-start="userPageStart"
/>
```

Keep the outer `4 / 8 / 12` grid and `min-width: 0` behavior.

- [ ] **Step 5: Run focused tests and commit**

Run the Step 2 command. Expected: PASS.

```bash
git add \
  src/components/admin/features/AdminUserOperationsCell.vue \
  src/components/admin/features/AdminUserOperationsCell.test.js \
  src/components/admin/features/AdminUserServiceRow.vue \
  src/components/admin/features/AdminUserServiceFilters.vue \
  src/components/admin/features/AdminUserServiceTableHeader.vue \
  src/hooks/adminAccessNavigation.js \
  src/hooks/adminAccessNavigation.test.js \
  src/views/AdminUsers.test.js
git commit -m "fix: clarify admin user actions"
```

### Task 2: Neutral credential creation action

**Files:**
- Modify: `src/components/admin/features/AdminCredentialCreateForm.vue`
- Test: `src/views/AdminResponsiveLayout.test.js`
- Test: `src/hooks/useAdminCredentials.test.js`

**Interfaces:**
- Consumes: `AdminMicroButton` with `icon="add"`.
- Produces: the same `create` event and disabled/loading behavior with neutral styling.

- [ ] **Step 1: Write the failing credential button test**

```js
test('credential creation uses the shared neutral icon button', () => {
  assert.match(source, /<AdminMicroButton[\s\S]+icon="add"[\s\S]+创建凭证/)
  assert.doesNotMatch(source, /bg-emerald|text-slate-950/)
})
```

- [ ] **Step 2: Run and verify RED**

Run:

```bash
node --test src/views/AdminResponsiveLayout.test.js src/hooks/useAdminCredentials.test.js
```

Expected: FAIL because the form still contains a one-off emerald button.

- [ ] **Step 3: Replace the one-off button**

```vue
<AdminMicroButton
  class="mt-4"
  icon="add"
  size="md"
  :disabled="loading || !form.apiName"
  @click="emit('create')"
>
  {{ loading ? '创建中...' : '创建凭证' }}
</AdminMicroButton>
```

Import `AdminMicroButton` from `@/components/admin/AdminMicroButton.vue`. Do not change form validation or emitted payloads.

- [ ] **Step 4: Run GREEN and commit**

Run the Step 2 command. Expected: PASS.

```bash
git add src/components/admin/features/AdminCredentialCreateForm.vue src/views/AdminResponsiveLayout.test.js src/hooks/useAdminCredentials.test.js
git commit -m "fix: align credential creation action"
```

### Task 3: Stabilize the usage evidence grid

**Files:**
- Modify: `src/views/AdminUsage.vue`
- Modify: `src/components/admin/features/AdminServiceReconciliationSection.vue`
- Test: `src/components/admin/features/AdminServiceReconciliationSection.test.js`
- Test: `src/hooks/useAdminUsagePage.test.js`

**Interfaces:**
- Consumes: existing `AdminServiceRecordQueryPanel` and `AdminServiceApiLogsPanel` props/events.
- Produces: a full-width reconciliation wrapper and a desktop `5 / 7` panel split.

- [ ] **Step 1: Write failing layout tests**

```js
test('usage owns a full-width wrapper around the multi-root reconciliation component', () => {
  assert.match(page, /class="col-span-full min-w-0"[\s\S]+<AdminServiceReconciliationSection/)
})

test('request detail and provider logs use a stable 5 by 7 desktop split', () => {
  assert.match(source, /xl:grid-cols-12/)
  assert.match(source, /AdminServiceRecordQueryPanel[\s\S]+xl:col-span-5/)
  assert.match(source, /AdminServiceApiLogsPanel[\s\S]+xl:col-span-7/)
})
```

- [ ] **Step 2: Run and verify RED**

Run:

```bash
node --test \
  src/components/admin/features/AdminServiceReconciliationSection.test.js \
  src/hooks/useAdminUsagePage.test.js
```

Expected: FAIL because the multi-root component is currently a direct parent-grid child and its internal split is `1.2fr / 1.8fr`.

- [ ] **Step 3: Add the full-width root wrapper**

In `AdminUsage.vue`:

```vue
<div class="col-span-full min-w-0">
  <AdminServiceReconciliationSection
    :attribution="attribution"
    :attribution-series="attributionSeries"
    :can-reconcile-billing="canReconcileBilling"
    :loading302="loading"
    :official-usage="officialUsage"
    :loading-provider-records="loadingProviderRecords"
    :loading-record="loadingRecord"
    page-owned
    :provider-pagination="providerPagination"
    :provider-query="providerQuery"
    :provider-records="providerRecords"
    :record-data="recordData"
    :record-request-id="recordRequestId"
    :reconciliation="reconciliation"
    :reconciliation-runs="reconciliationRuns"
    :reconciling-billing="syncing"
    :snapshot-series="snapshotSeries"
    :usage-comparison="usageComparison"
    @load-provider-records="loadProviderRecords"
    @query-record="queryRecord"
    @sync="sync"
    @update-provider-query="updateProviderQuery"
    @update:record-request-id="recordRequestId = $event"
  />
</div>
```

Do not rely on class fallthrough because `AdminServiceReconciliationSection` has multiple template roots.

- [ ] **Step 4: Implement the 5 / 7 responsive split**

```vue
<div class="grid grid-cols-1 gap-4 xl:grid-cols-12">
  <AdminServiceRecordQueryPanel
    class="min-w-0 xl:col-span-5"
    :loading-record="loadingRecord"
    :record-data="recordData"
    :record-request-id="recordRequestId"
    @query-record="emit('query-record')"
    @update:record-request-id="emit('update:recordRequestId', $event)"
  />
  <AdminServiceApiLogsPanel
    class="min-w-0 xl:col-span-7"
    :api-log-pagination="providerPagination"
    :api-logs="providerRecords"
    :loading-api-logs="loadingProviderRecords"
    :log302-query="providerQuery"
    @load-api-logs="emit('load-provider-records')"
    @update-log-query="forwardProviderQueryUpdate"
  />
</div>
```

Replace the non-page-owned branch with the explicit matching split as well:

```vue
<div v-if="canReadUsage" class="grid grid-cols-1 gap-5 xl:grid-cols-12">
  <AdminServiceRecordQueryPanel
    class="min-w-0 xl:col-span-5"
    :loading-record="loadingRecord"
    :record-data="recordData"
    :record-request-id="recordRequestId"
    @query-record="emit('query-record')"
    @update:record-request-id="emit('update:recordRequestId', $event)"
  />

  <AdminServiceApiLogsPanel
    class="min-w-0 xl:col-span-7"
    :api-log-pagination="apiLogPagination"
    :api-logs="apiLogs"
    :loading-api-logs="loadingApiLogs"
    :log302-query="log302Query"
    @load-api-logs="emit('load-api-logs')"
    @update-log-query="forwardLogQueryUpdate"
  />
</div>
```

Tablet and mobile remain one column.

- [ ] **Step 5: Run GREEN and commit**

Run the Step 2 command. Expected: PASS.

```bash
git add \
  src/views/AdminUsage.vue \
  src/components/admin/features/AdminServiceReconciliationSection.vue \
  src/components/admin/features/AdminServiceReconciliationSection.test.js \
  src/hooks/useAdminUsagePage.test.js
git commit -m "fix: stabilize admin usage evidence layout"
```

### Task 4: Integrated responsive verification

**Files:**
- Modify if required by discovered regression: files from Tasks 1–3 only.
- Test: focused files from Tasks 1–3.

**Interfaces:**
- Consumes: completed task surfaces.
- Produces: verified desktop/mobile UI with no relevant console or overlay errors.

- [ ] **Step 1: Run all focused tests**

```bash
node --test \
  src/components/admin/features/AdminUserOperationsCell.test.js \
  src/components/admin/features/AdminServiceReconciliationSection.test.js \
  src/hooks/adminAccessNavigation.test.js \
  src/hooks/useAdminCredentials.test.js \
  src/hooks/useAdminUsagePage.test.js \
  src/views/AdminResponsiveLayout.test.js \
  src/views/AdminUsers.test.js
```

Expected: all tests PASS with no warnings.

- [ ] **Step 2: Run repository gates**

```bash
npm run check
npm run build
git diff --check
```

Expected: all commands exit 0.

- [ ] **Step 3: Browser QA at `http://127.0.0.1:4174`**

Verify with the Browser plugin:

1. `/admin/users` at desktop: filters align to the table; action column is compact; opening the ellipsis shows neutral grouped actions with icons.
2. `/admin/users` at 390 px: no horizontal page overflow; menu remains within the viewport.
3. `/admin/credentials`: create action is neutral and icon-led.
4. `/admin/usage` at desktop: request detail and provider logs occupy readable 5/7 widths.
5. `/admin/usage` at 390 px: panels stack without character-by-character wrapping.
6. Confirm URL/title, meaningful DOM, no framework overlay, and no relevant new console error.

- [ ] **Step 4: Final commit if QA requires a scoped correction**

```bash
git add \
  src/components/admin/features/AdminUserOperationsCell.vue \
  src/components/admin/features/AdminUserServiceFilters.vue \
  src/components/admin/features/AdminServiceReconciliationSection.vue \
  src/components/admin/features/AdminCredentialCreateForm.vue \
  src/views/AdminUsage.vue
git commit -m "fix: close admin task surface qa gaps"
```

If QA requires no correction, do not create an empty commit.
