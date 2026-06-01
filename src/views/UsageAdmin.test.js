import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { test } from 'node:test'

const source = readFileSync(new URL('./UsageAdmin.vue', import.meta.url), 'utf8')
const styleUrl = new URL('../style.css', import.meta.url)
const headerUrl = new URL('../components/admin/features/UsageAdminHeader.vue', import.meta.url)
const loginCardUrl = new URL('../components/admin/features/UsageAdminLoginCard.vue', import.meta.url)
const adminEmptyStateUrl = new URL('../components/admin/AdminEmptyState.vue', import.meta.url)
const adminRemovableTagUrl = new URL('../components/admin/AdminRemovableTag.vue', import.meta.url)
const adminShellUrl = new URL('../components/admin/AdminShell.vue', import.meta.url)
const adminTableShellUrl = new URL('../components/admin/AdminTableShell.vue', import.meta.url)
const overviewSectionUrl = new URL('../components/admin/features/UsageAdminOverviewSection.vue', import.meta.url)
const shellUrl = new URL('../components/admin/features/UsageAdminShell.vue', import.meta.url)
const sidebarUrl = new URL('../components/admin/features/UsageAdminSidebar.vue', import.meta.url)
const usageAdminButtonUrl = new URL('../components/admin/features/UsageAdminButton.vue', import.meta.url)
const usageAdminCheckOptionUrl = new URL('../components/admin/features/UsageAdminCheckOption.vue', import.meta.url)
const usageAdminFormControlUrl = new URL('../components/admin/features/UsageAdminFormControl.vue', import.meta.url)
const usageAdminMetricCardUrl = new URL('../components/admin/features/UsageAdminMetricCard.vue', import.meta.url)
const usageAdminSurfaceUrl = new URL('../components/admin/features/UsageAdminSurface.vue', import.meta.url)
const featureIndexUrl = new URL('../components/admin/features/index.js', import.meta.url)
const credentialCreateFormUrl = new URL('../components/admin/features/UsageAdminCredentialCreateForm.vue', import.meta.url)
const credentialAssignmentCellUrl = new URL('../components/admin/features/UsageAdminCredentialAssignmentCell.vue', import.meta.url)
const credentialsSectionUrl = new URL('../components/admin/features/UsageAdminCredentialsSection.vue', import.meta.url)
const credentialRowUrl = new URL('../components/admin/features/UsageAdminCredentialRow.vue', import.meta.url)
const credentialTableUrl = new URL('../components/admin/features/UsageAdminCredentialTable.vue', import.meta.url)
const assignedCredentialsCellUrl = new URL('../components/admin/features/UsageAdminAssignedCredentialsCell.vue', import.meta.url)
const userRowUrl = new URL('../components/admin/features/UsageAdminUserRow.vue', import.meta.url)
const usersSectionUrl = new URL('../components/admin/features/UsageAdminUsersSection.vue', import.meta.url)
const usageAdminAccessStateUrl = new URL('../hooks/useUsageAdminAccessState.js', import.meta.url)
const usageAdminCredentialActionsUrl = new URL('../hooks/useUsageAdminCredentialActions.js', import.meta.url)
const usageAdminDataStateUrl = new URL('../hooks/useUsageAdminDataState.js', import.meta.url)
const usageAdminDisplayStateUrl = new URL('../hooks/useUsageAdminDisplayState.js', import.meta.url)

const usageAdminAccessStateSource = existsSync(usageAdminAccessStateUrl)
  ? readFileSync(usageAdminAccessStateUrl, 'utf8')
  : ''
const usageAdminCredentialActionsSource = existsSync(usageAdminCredentialActionsUrl)
  ? readFileSync(usageAdminCredentialActionsUrl, 'utf8')
  : ''
const usageAdminDataStateSource = existsSync(usageAdminDataStateUrl) ? readFileSync(usageAdminDataStateUrl, 'utf8') : ''
const usageAdminDisplayStateSource = existsSync(usageAdminDisplayStateUrl) ? readFileSync(usageAdminDisplayStateUrl, 'utf8') : ''

const readSourceIfExists = (url) => (existsSync(url) ? readFileSync(url, 'utf8') : '')
const readUsageAdminCredentialsFeatureSource = () =>
  [
    readSourceIfExists(credentialsSectionUrl),
    readSourceIfExists(credentialCreateFormUrl),
    readSourceIfExists(credentialAssignmentCellUrl),
    readSourceIfExists(credentialRowUrl),
    readSourceIfExists(credentialTableUrl)
  ].join('\n')

test('usage admin delegates authenticated dashboard sections to feature modules', () => {
  assert.match(source, /@\/components\/admin\/features/)
  assert.match(source, /<UsageAdminShell/)
  assert.match(source, /<template #sidebar>/)
  assert.match(source, /<UsageAdminHeader/)
  assert.match(source, /:is-authenticated="isAdminAuthenticated"/)
  assert.match(source, /:loading="loadingAll"/)
  assert.match(source, /@refresh="loadAll"/)
  assert.match(source, /@logout="logout"/)
  assert.match(source, /@go-home="goHome"/)
  assert.match(source, /<UsageAdminLoginCard/)
  assert.match(source, /:form="loginForm"/)
  assert.match(source, /:logging-in="loggingIn"/)
  assert.match(source, /@submit-login="handleLogin"/)
  assert.match(source, /@update-login-form-field="updateLoginFormField"/)
  assert.match(source, /<UsageAdminSidebar/)
  assert.match(source, /:nav-items="sidebarNavItems"/)
  assert.match(source, /:session-summary="sidebarSessionSummary"/)
  assert.match(source, /<UsageAdminOverviewSection/)
  assert.match(source, /:metrics="overviewMetrics"/)
  assert.match(source, /<UsageAdminCredentialsSection/)
  assert.match(source, /<UsageAdminUsersSection/)
  assert.ok(existsSync(headerUrl))
  assert.ok(existsSync(loginCardUrl))
  assert.ok(existsSync(sidebarUrl))
  assert.ok(existsSync(shellUrl))
  assert.ok(existsSync(overviewSectionUrl))
  assert.ok(existsSync(credentialsSectionUrl))
  assert.ok(existsSync(usersSectionUrl))

  const headerSource = readFileSync(headerUrl, 'utf8')
  const loginCardSource = readFileSync(loginCardUrl, 'utf8')
  const shellSource = readFileSync(shellUrl, 'utf8')
  const sidebarSource = readFileSync(sidebarUrl, 'utf8')
  const overviewSectionSource = readFileSync(overviewSectionUrl, 'utf8')
  const credentialsSectionSource = readUsageAdminCredentialsFeatureSource()
  const usersSectionSource = readFileSync(usersSectionUrl, 'utf8')

  assert.match(headerSource, /Usage Admin/)
  assert.match(headerSource, /emit\('refresh'\)/)
  assert.match(headerSource, /emit\('logout'\)/)
  assert.match(headerSource, /emit\('go-home'\)/)
  assert.match(loginCardSource, /Admin username/)
  assert.match(loginCardSource, /Admin password/)
  assert.match(loginCardSource, /emit\('submit-login'\)/)
  assert.match(loginCardSource, /emit\('update-login-form-field'/)
  assert.match(shellSource, /<AdminShell/)
  assert.match(shellSource, /<slot name="sidebar"/)
  assert.match(shellSource, /<slot \/>/)
  assert.match(sidebarSource, /v-for="item in navItems"/)
  assert.match(sidebarSource, /sessionSummary\.username/)
  assert.match(sidebarSource, /sessionSummary\.status/)
  assert.match(overviewSectionSource, /v-for="metric in metrics"/)
  assert.match(overviewSectionSource, /:label="metric.label"/)
  assert.match(overviewSectionSource, /:value="metric.value"/)
  assert.match(credentialsSectionSource, /Create Eager Service Credential/)
  assert.match(credentialsSectionSource, /Eager Service Credentials/)
  assert.match(usersSectionSource, /Registered Users & Consumption/)
  assert.match(usersSectionSource, /Assigned Credentials/)
})

test('usage admin delegates display state to a composable', () => {
  assert.ok(existsSync(usageAdminDisplayStateUrl))
  assert.match(source, /useUsageAdminDisplayState/)
  for (const name of [
    'sidebarNavItems',
    'sidebarSessionSummary',
    'overviewMetrics',
    'formatDateTime',
    'formatExpire',
    'maskApiKey'
  ]) {
    assert.match(source, new RegExp(name))
  }

  assert.doesNotMatch(source, /getUsageAdminSidebarItems/)
  assert.doesNotMatch(source, /getUsageAdminSessionSummary/)
  assert.doesNotMatch(source, /getUsageAdminOverviewMetrics/)
  assert.doesNotMatch(source, /formatAdminDateTime/)
  assert.doesNotMatch(source, /formatAdminExpire/)
  assert.doesNotMatch(source, /maskAdminApiKey/)
  assert.doesNotMatch(source, /const sidebarNavItems = computed/)
  assert.doesNotMatch(source, /const sidebarSessionSummary = computed/)
  assert.doesNotMatch(source, /const overviewMetrics = computed/)

  assert.match(usageAdminDisplayStateSource, /export const useUsageAdminDisplayState/)
  assert.match(usageAdminDisplayStateSource, /getUsageAdminSidebarItems/)
  assert.match(usageAdminDisplayStateSource, /getUsageAdminSessionSummary/)
  assert.match(usageAdminDisplayStateSource, /getUsageAdminOverviewMetrics/)
})

test('usage admin delegates shared data loading state to a composable', () => {
  assert.ok(existsSync(usageAdminDataStateUrl))
  assert.match(source, /useUsageAdminDataState/)
  for (const name of [
    'balance',
    'users',
    'apiKeys',
    'loadingAll',
    'loadAll'
  ]) {
    assert.match(source, new RegExp(name))
  }

  assert.doesNotMatch(source, /getUsageAdminBalance/)
  assert.doesNotMatch(source, /getUsageAdminUsers/)
  assert.doesNotMatch(source, /getUsageAdminApiKeys/)
  assert.doesNotMatch(source, /const balance = ref/)
  assert.doesNotMatch(source, /const users = ref/)
  assert.doesNotMatch(source, /const apiKeys = ref/)
  assert.doesNotMatch(source, /const loadingAll = ref/)
  assert.doesNotMatch(source, /const loadAll = async/)

  assert.match(usageAdminDataStateSource, /export const useUsageAdminDataState/)
  assert.match(usageAdminDataStateSource, /getUsageAdminBalance/)
  assert.match(usageAdminDataStateSource, /getUsageAdminUsers/)
  assert.match(usageAdminDataStateSource, /getUsageAdminApiKeys/)
  assert.match(usageAdminDataStateSource, /const loadAll = async/)
})

test('usage admin delegates service credential actions to a composable', () => {
  assert.ok(existsSync(usageAdminCredentialActionsUrl))
  assert.match(source, /useUsageAdminCredentialActions/)
  for (const name of [
    'assignSelections',
    'createForm',
    'creatingKey',
    'assignKeyFromRow',
    'createApiKey',
    'deleteApiKey',
    'unassignKey',
    'updateAssignmentSelection',
    'updateCreateFormField'
  ]) {
    assert.match(source, new RegExp(name))
  }

  assert.doesNotMatch(source, /assignUsageAdminUserKey/)
  assert.doesNotMatch(source, /createUsageAdminApiKey/)
  assert.doesNotMatch(source, /deleteUsageAdminApiKey/)
  assert.doesNotMatch(source, /unassignUsageAdminUserKey/)
  assert.doesNotMatch(source, /const creatingKey = ref/)
  assert.doesNotMatch(source, /const assignSelections = ref/)
  assert.doesNotMatch(source, /const createForm = ref/)
  assert.doesNotMatch(source, /const createApiKey = async/)
  assert.doesNotMatch(source, /const deleteApiKey = async/)
  assert.doesNotMatch(source, /const assignKeyFromRow = async/)
  assert.doesNotMatch(source, /const unassignKey = async/)

  assert.match(usageAdminCredentialActionsSource, /export const useUsageAdminCredentialActions/)
  assert.match(usageAdminCredentialActionsSource, /createUsageAdminApiKey/)
  assert.match(usageAdminCredentialActionsSource, /deleteUsageAdminApiKey/)
  assert.match(usageAdminCredentialActionsSource, /assignUsageAdminUserKey/)
  assert.match(usageAdminCredentialActionsSource, /unassignUsageAdminUserKey/)
})

test('usage admin delegates access and session state to a composable', () => {
  assert.ok(existsSync(usageAdminAccessStateUrl))
  assert.match(source, /useUsageAdminAccessState/)
  for (const name of [
    'adminSession',
    'handleLogin',
    'isAdminAuthenticated',
    'loggingIn',
    'loginForm',
    'logout',
    'restoreSession',
    'updateLoginFormField'
  ]) {
    assert.match(source, new RegExp(name))
  }

  assert.doesNotMatch(source, /clearUsageAdminToken/)
  assert.doesNotMatch(source, /setUsageAdminToken/)
  assert.doesNotMatch(source, /usageAdminLogin/)
  assert.doesNotMatch(source, /usageAdminSession/)
  assert.doesNotMatch(source, /STORAGE_KEYS/)
  assert.doesNotMatch(source, /getStoredValue/)
  assert.doesNotMatch(source, /const loginForm = ref/)
  assert.doesNotMatch(source, /const loggingIn = ref/)
  assert.doesNotMatch(source, /const adminSession = ref/)
  assert.doesNotMatch(source, /const isAdminAuthenticated = computed/)
  assert.doesNotMatch(source, /const handleLogin = async/)
  assert.doesNotMatch(source, /const logout = \(\) =>/)
  assert.doesNotMatch(source, /const updateLoginFormField = /)

  assert.match(usageAdminAccessStateSource, /export const useUsageAdminAccessState/)
  assert.match(usageAdminAccessStateSource, /usageAdminLogin/)
  assert.match(usageAdminAccessStateSource, /usageAdminSession/)
  assert.match(usageAdminAccessStateSource, /setUsageAdminToken/)
  assert.match(usageAdminAccessStateSource, /clearUsageAdminToken/)
  assert.match(usageAdminAccessStateSource, /const restoreSession = async/)
})

test('usage admin shell composes the shared admin shell layout module', () => {
  assert.ok(existsSync(shellUrl))
  assert.ok(existsSync(adminShellUrl))

  const shellSource = readFileSync(shellUrl, 'utf8')
  const adminShellSource = readFileSync(adminShellUrl, 'utf8')

  assert.match(shellSource, /import AdminShell from '@\/components\/admin\/AdminShell\.vue'/)
  assert.doesNotMatch(shellSource, /from '@\/components\/admin'/)
  assert.match(shellSource, /<AdminShell/)
  assert.match(shellSource, /shell-class="text-white"/)
  assert.match(shellSource, /frame-class="min-h-\[calc\(100vh-48px\)\]"/)
  assert.match(shellSource, /main-class="min-h-\[calc\(100vh-48px\)\]"/)
  assert.match(shellSource, /<template #sidebar>/)
  assert.match(shellSource, /<slot name="sidebar"/)
  assert.match(shellSource, /<slot \/>/)
  assert.doesNotMatch(shellSource, /\.usage-admin-shell/)
  assert.doesNotMatch(shellSource, /\.usage-admin-frame/)
  assert.doesNotMatch(shellSource, /\.usage-admin-main/)

  assert.match(adminShellSource, /defineProps/)
  assert.match(adminShellSource, /shellClass/)
  assert.match(adminShellSource, /frameClass/)
  assert.match(adminShellSource, /mainClass/)
})

test('usage admin empty states use the shared empty-state module styling', () => {
  assert.ok(existsSync(adminEmptyStateUrl))
  assert.ok(existsSync(credentialsSectionUrl))
  assert.ok(existsSync(usersSectionUrl))

  const adminEmptyStateSource = readFileSync(adminEmptyStateUrl, 'utf8')
  const credentialsSectionSource = readUsageAdminCredentialsFeatureSource()
  const usersSectionSource = readFileSync(usersSectionUrl, 'utf8')
  const usageAdminFeatureSource = `${credentialsSectionSource}\n${usersSectionSource}`

  assert.match(credentialsSectionSource, /<AdminEmptyState/)
  assert.match(usersSectionSource, /<AdminEmptyState/)
  assert.doesNotMatch(usageAdminFeatureSource, /\.usage-empty/)
  assert.doesNotMatch(usageAdminFeatureSource, /empty-class="usage-empty"/)
  assert.match(adminEmptyStateSource, /default: 'admin-empty-state'/)
  assert.match(adminEmptyStateSource, /\.admin-empty-state/)
})

test('usage admin data tables compose the shared table shell module', () => {
  assert.ok(existsSync(adminTableShellUrl))
  assert.ok(existsSync(credentialsSectionUrl))
  assert.ok(existsSync(usersSectionUrl))

  const adminTableShellSource = readFileSync(adminTableShellUrl, 'utf8')
  const credentialsSectionSource = readUsageAdminCredentialsFeatureSource()
  const usersSectionSource = readFileSync(usersSectionUrl, 'utf8')
  const usageAdminTableSource = `${credentialsSectionSource}\n${usersSectionSource}`

  assert.match(adminTableShellSource, /<table/)
  assert.match(adminTableShellSource, /minWidthClass/)
  assert.match(adminTableShellSource, /headerRowClass/)
  assert.match(adminTableShellSource, /bodyRowClass/)
  assert.match(credentialsSectionSource, /<AdminTableShell/)
  assert.match(usersSectionSource, /<AdminTableShell/)
  assert.doesNotMatch(usageAdminTableSource, /<div v-else class="overflow-auto">\s*<table class="w-full min-w/)
  assert.doesNotMatch(usageAdminTableSource, /<tr v-for="[^"]+"[^>]+class="border-b border-white\/5 align-top hover:bg-white\/\[0\.03\]"/)
})

test('usage admin credential management splits form and table into focused feature modules', () => {
  assert.ok(existsSync(featureIndexUrl))
  assert.ok(existsSync(credentialsSectionUrl))
  assert.ok(existsSync(credentialCreateFormUrl))
  assert.ok(existsSync(credentialRowUrl))
  assert.ok(existsSync(credentialTableUrl))

  const featureIndexSource = readFileSync(featureIndexUrl, 'utf8')
  const credentialsSectionSource = readFileSync(credentialsSectionUrl, 'utf8')
  const createFormSource = readFileSync(credentialCreateFormUrl, 'utf8')
  const credentialRowSource = readFileSync(credentialRowUrl, 'utf8')
  const credentialTableSource = readFileSync(credentialTableUrl, 'utf8')

  assert.match(featureIndexSource, /UsageAdminCredentialCreateForm/)
  assert.match(featureIndexSource, /UsageAdminCredentialRow/)
  assert.match(featureIndexSource, /UsageAdminCredentialTable/)
  assert.match(credentialsSectionSource, /<UsageAdminCredentialCreateForm/)
  assert.match(credentialsSectionSource, /<UsageAdminCredentialTable/)
  assert.doesNotMatch(credentialsSectionSource, /placeholder="api_name"/)
  assert.doesNotMatch(credentialsSectionSource, /v-for="keyItem in apiKeys"/)

  assert.match(createFormSource, /Create Eager Service Credential/)
  assert.match(createFormSource, /emit\('create-api-key'\)/)
  assert.match(createFormSource, /emit\('update-create-form-field'/)
  assert.match(createFormSource, /toNumberModelValue/)

  assert.match(credentialTableSource, /Eager Service Credentials/)
  assert.match(credentialTableSource, /<AdminTableShell/)
  assert.match(credentialTableSource, /import UsageAdminCredentialRow from '\.\/UsageAdminCredentialRow\.vue'/)
  assert.match(credentialTableSource, /<UsageAdminCredentialRow\s+v-for="keyItem in apiKeys"\s+:key="keyItem\.id \|\| keyItem\.api_name"\s+:assign-selections="assignSelections"\s+:format-expire="formatExpire"\s+:key-item="keyItem"\s+:mask-api-key="maskApiKey"\s+:row-class="rowClass"\s+:users="users"\s+@assign-key-from-row="emit\('assign-key-from-row', \$event\)"\s+@delete-api-key="emit\('delete-api-key', \$event\)"\s+@update-assignment-selection="updateAssignmentSelection"\s+\/>/)
  assert.match(credentialTableSource, /emit\('assign-key-from-row'/)
  assert.match(credentialTableSource, /emit\('delete-api-key'/)
  assert.match(credentialTableSource, /emit\('update-assignment-selection'/)
  assert.doesNotMatch(credentialTableSource, /<tr v-for="keyItem in apiKeys"/)
  assert.doesNotMatch(credentialTableSource, /maskApiKey\(keyItem\.api_key\)/)
  assert.doesNotMatch(credentialTableSource, /keyItem\.current_cost \?\? 0/)

  assert.match(credentialRowSource, /<tr :class="rowClass">/)
  assert.match(credentialRowSource, /\{\{ keyItem\.api_name \}\}/)
  assert.match(credentialRowSource, /\{\{ maskApiKey\(keyItem\.api_key\) \}\}/)
  assert.match(credentialRowSource, /\{\{ keyItem\.current_cost \?\? 0 \}\} \/ \{\{ keyItem\.limit_cost \?\? 0 \}\}/)
  assert.match(credentialRowSource, /\{\{ formatExpire\(keyItem\.expired_on\) \}\}/)
  assert.match(credentialRowSource, /<UsageAdminButton kind="micro" tone="danger" @click="emit\('delete-api-key', keyItem\.api_name\)">Delete<\/UsageAdminButton>/)
})

test('usage admin credential table delegates row assignment controls to a focused cell module', () => {
  assert.ok(existsSync(featureIndexUrl))
  assert.ok(existsSync(credentialTableUrl))
  assert.ok(existsSync(credentialRowUrl))
  assert.ok(existsSync(credentialAssignmentCellUrl))

  const featureIndexSource = readFileSync(featureIndexUrl, 'utf8')
  const credentialTableSource = readFileSync(credentialTableUrl, 'utf8')
  const credentialRowSource = readFileSync(credentialRowUrl, 'utf8')
  const assignmentCellSource = readFileSync(credentialAssignmentCellUrl, 'utf8')

  assert.match(featureIndexSource, /UsageAdminCredentialAssignmentCell/)
  assert.match(credentialTableSource, /import UsageAdminCredentialRow from '\.\/UsageAdminCredentialRow\.vue'/)
  assert.doesNotMatch(credentialTableSource, /UsageAdminCredentialAssignmentCell/)
  assert.match(credentialRowSource, /import UsageAdminCredentialAssignmentCell from '\.\/UsageAdminCredentialAssignmentCell\.vue'/)
  assert.match(credentialRowSource, /<UsageAdminCredentialAssignmentCell\s+:api-name="keyItem\.api_name"\s+:selection="assignSelections\[keyItem\.api_name\] \|\| ''"\s+:users="users"\s+@assign="emit\('assign-key-from-row', \$event\)"\s+@update-selection="updateAssignmentSelection"/)
  assert.match(credentialRowSource, /defineEmits\(\['assign-key-from-row', 'delete-api-key', 'update-assignment-selection'\]\)/)
  assert.match(credentialRowSource, /emit\('update-assignment-selection', apiName, userId\)/)
  assert.doesNotMatch(credentialTableSource, /<div class="flex gap-2">/)
  assert.doesNotMatch(credentialTableSource, /<UsageAdminFormControl\s+as="select"/)
  assert.doesNotMatch(credentialTableSource, /<UsageAdminButton kind="micro" @click="emit\('assign-key-from-row', keyItem\.api_name\)">Assign<\/UsageAdminButton>/)

  assert.match(assignmentCellSource, /<div class="usage-admin-credential-assignment-cell">/)
  assert.match(assignmentCellSource, /import UsageAdminButton from '\.\/UsageAdminButton\.vue'/)
  assert.match(assignmentCellSource, /import UsageAdminFormControl from '\.\/UsageAdminFormControl\.vue'/)
  assert.match(assignmentCellSource, /<UsageAdminFormControl\s+as="select"\s+:value="selection"\s+table\s+@change="\$emit\('update-selection', apiName, \$event\.target\.value\)"/)
  assert.match(assignmentCellSource, /<option v-for="user in users" :key="user\.id" :value="user\.id">/)
  assert.match(assignmentCellSource, /<UsageAdminButton kind="micro" @click="\$emit\('assign', apiName\)">Assign<\/UsageAdminButton>/)
  assert.match(assignmentCellSource, /defineEmits\(\['assign', 'update-selection'\]\)/)
})

test('usage admin users section delegates table rows to a focused row module', () => {
  assert.ok(existsSync(featureIndexUrl))
  assert.ok(existsSync(usersSectionUrl))
  assert.ok(existsSync(userRowUrl))
  assert.ok(existsSync(assignedCredentialsCellUrl))

  const featureIndexSource = readFileSync(featureIndexUrl, 'utf8')
  const usersSectionSource = readFileSync(usersSectionUrl, 'utf8')
  const userRowSource = readFileSync(userRowUrl, 'utf8')

  assert.match(featureIndexSource, /UsageAdminUserRow/)
  assert.match(usersSectionSource, /import UsageAdminUserRow from '\.\/UsageAdminUserRow\.vue'/)
  assert.match(usersSectionSource, /<UsageAdminUserRow\s+v-for="user in users"\s+:key="user\.id"\s+:format-date-time="formatDateTime"\s+:row-class="rowClass"\s+:user="user"\s+@unassign-key="forwardUnassignKey"\s+\/>/)
  assert.match(usersSectionSource, /const forwardUnassignKey = \(userId, apiName\) =>/)
  assert.match(usersSectionSource, /emit\('unassign-key', userId, apiName\)/)
  assert.doesNotMatch(usersSectionSource, /<tr v-for="user in users"/)
  assert.doesNotMatch(usersSectionSource, /user\.usage\?\.totalCalls/)
  assert.doesNotMatch(usersSectionSource, /user\.officialUsage\?\.totalCostAmount/)

  assert.match(userRowSource, /<tr :class="rowClass">/)
  assert.match(userRowSource, /user\.displayName \|\| '-'/)
  assert.match(userRowSource, /formatDateTime\(user\.registeredAt \|\| user\.createdAt\)/)
  assert.match(userRowSource, /formatDateTime\(user\.lastLoginAt\)/)
  assert.match(userRowSource, /user\.usage\?\.totalCalls \?\? 0/)
  assert.match(userRowSource, /user\.usage\?\.totalTokens \?\? 0/)
  assert.match(userRowSource, /Number\(user\.officialUsage\?\.totalCostAmount \|\| 0\)\.toFixed\(4\)/)
  assert.match(userRowSource, /<UsageAdminAssignedCredentialsCell\s+:assigned-api-keys="user\.assignedApiKeys \|\| \[\]"\s+:user-id="user\.id"\s+@unassign="emit\('unassign-key', \$event\.userId, \$event\.apiName\)"/)
  assert.match(userRowSource, /defineEmits\(\['unassign-key'\]\)/)
})

test('usage admin assigned credentials use the shared removable tag module', () => {
  assert.ok(existsSync(adminRemovableTagUrl))
  assert.ok(existsSync(featureIndexUrl))
  assert.ok(existsSync(assignedCredentialsCellUrl))
  assert.ok(existsSync(userRowUrl))
  assert.ok(existsSync(usersSectionUrl))

  const adminRemovableTagSource = readFileSync(adminRemovableTagUrl, 'utf8')
  const featureIndexSource = readFileSync(featureIndexUrl, 'utf8')
  const assignedCredentialsCellSource = readFileSync(assignedCredentialsCellUrl, 'utf8')
  const userRowSource = readFileSync(userRowUrl, 'utf8')
  const usersSectionSource = readFileSync(usersSectionUrl, 'utf8')

  assert.match(featureIndexSource, /UsageAdminAssignedCredentialsCell/)
  assert.match(userRowSource, /import UsageAdminAssignedCredentialsCell from '\.\/UsageAdminAssignedCredentialsCell\.vue'/)
  assert.match(userRowSource, /<UsageAdminAssignedCredentialsCell\s+:assigned-api-keys="user\.assignedApiKeys \|\| \[\]"\s+:user-id="user\.id"\s+@unassign="emit\('unassign-key', \$event\.userId, \$event\.apiName\)"/)
  assert.doesNotMatch(usersSectionSource, /UsageAdminAssignedCredentialsCell/)
  assert.doesNotMatch(usersSectionSource, /<div class="flex flex-wrap gap-2">/)
  assert.doesNotMatch(usersSectionSource, /<AdminRemovableTag/)
  assert.doesNotMatch(usersSectionSource, /No credential assigned/)
  assert.match(adminRemovableTagSource, /admin-removable-tag/)
  assert.match(adminRemovableTagSource, /\$emit\('remove'\)/)
  assert.match(assignedCredentialsCellSource, /import AdminRemovableTag from '@\/components\/admin\/AdminRemovableTag\.vue'/)
  assert.match(assignedCredentialsCellSource, /<div class="usage-admin-assigned-credentials-cell">/)
  assert.match(assignedCredentialsCellSource, /<AdminRemovableTag\s+v-for="assigned in assignedApiKeys"\s+:key="assigned\.apiName"\s+@remove="\$emit\('unassign', \{ userId, apiName: assigned\.apiName \}\)"/)
  assert.match(assignedCredentialsCellSource, /<span v-if="!assignedApiKeys\.length" class="text-xs text-white\/40">No credential assigned<\/span>/)
  assert.match(assignedCredentialsCellSource, /defineEmits\(\['unassign'\]\)/)
  assert.doesNotMatch(usersSectionSource, /usage-key-pill/)
  assert.doesNotMatch(usersSectionSource, /\.usage-key-pill/)
})

test('usage admin card surfaces use the shared app style layer', () => {
  assert.ok(existsSync(styleUrl))
  assert.ok(existsSync(loginCardUrl))
  assert.ok(existsSync(overviewSectionUrl))
  assert.ok(existsSync(credentialsSectionUrl))
  assert.ok(existsSync(usageAdminMetricCardUrl))
  assert.ok(existsSync(usageAdminSurfaceUrl))
  assert.ok(existsSync(usersSectionUrl))

  const styleSource = readFileSync(styleUrl, 'utf8')
  const loginCardSource = readFileSync(loginCardUrl, 'utf8')
  const overviewSectionSource = readFileSync(overviewSectionUrl, 'utf8')
  const credentialsSectionSource = readUsageAdminCredentialsFeatureSource()
  const usageAdminMetricCardSource = readFileSync(usageAdminMetricCardUrl, 'utf8')
  const usageAdminSurfaceSource = readFileSync(usageAdminSurfaceUrl, 'utf8')
  const usersSectionSource = readFileSync(usersSectionUrl, 'utf8')
  const usageAdminFeatureSource = [
    loginCardSource,
    overviewSectionSource,
    credentialsSectionSource,
    usersSectionSource
  ].join('\n')

  assert.match(usageAdminSurfaceSource, /usage-card/)
  assert.match(usageAdminSurfaceSource, /\.usage-card\s*\{/)
  assert.match(usageAdminMetricCardSource, /<UsageAdminSurface/)
  assert.match(usageAdminMetricCardSource, /surface-class="rounded-2xl p-5"/)
  assert.match(loginCardSource, /<UsageAdminSurface/)
  assert.match(overviewSectionSource, /<UsageAdminMetricCard/)
  assert.match(credentialsSectionSource, /<UsageAdminSurface/)
  assert.match(usersSectionSource, /<UsageAdminSurface/)
  assert.doesNotMatch(usageAdminFeatureSource, /class="usage-card/)
  assert.doesNotMatch(usageAdminFeatureSource, /card-class="usage-card/)
  assert.doesNotMatch(usageAdminFeatureSource, /\.usage-card\s*\{/)
  assert.doesNotMatch(styleSource, /\.usage-card\s*\{/)
})

test('usage admin form inputs use the shared app style layer', () => {
  assert.ok(existsSync(styleUrl))
  assert.ok(existsSync(loginCardUrl))
  assert.ok(existsSync(credentialsSectionUrl))
  assert.ok(existsSync(usageAdminFormControlUrl))

  const styleSource = readFileSync(styleUrl, 'utf8')
  const loginCardSource = readFileSync(loginCardUrl, 'utf8')
  const credentialsSectionSource = readUsageAdminCredentialsFeatureSource()
  const usageAdminFormControlSource = readFileSync(usageAdminFormControlUrl, 'utf8')
  const usageAdminFormSource = `${loginCardSource}\n${credentialsSectionSource}`

  assert.match(loginCardSource, /<UsageAdminFormControl/)
  assert.match(credentialsSectionSource, /<UsageAdminFormControl/)
  assert.match(credentialsSectionSource, /as="select"/)
  assert.match(usageAdminFormControlSource, /'usage-input'/)
  assert.match(usageAdminFormControlSource, /usage-table-select/)
  assert.doesNotMatch(usageAdminFormSource, /\.usage-input\s*\{/)
  assert.doesNotMatch(usageAdminFormSource, /\.usage-input:focus\s*\{/)
  assert.doesNotMatch(usageAdminFormSource, /\.usage-table-select\s*\{/)
  assert.doesNotMatch(usageAdminFormSource, /class="usage-input/)
  assert.doesNotMatch(usageAdminFormSource, /usage-table-select/)
  assert.match(usageAdminFormControlSource, /\.usage-input\s*\{/)
  assert.match(usageAdminFormControlSource, /\.usage-input:focus\s*\{/)
  assert.match(usageAdminFormControlSource, /\.usage-table-select\s*\{/)
  assert.doesNotMatch(styleSource, /\.usage-input\s*\{/)
  assert.doesNotMatch(styleSource, /\.usage-input:focus\s*\{/)
  assert.doesNotMatch(styleSource, /\.usage-table-select\s*\{/)
})

test('usage admin control surfaces use the shared app style layer', () => {
  assert.ok(existsSync(styleUrl))
  assert.ok(existsSync(headerUrl))
  assert.ok(existsSync(loginCardUrl))
  assert.ok(existsSync(credentialsSectionUrl))
  assert.ok(existsSync(usageAdminButtonUrl))
  assert.ok(existsSync(usageAdminCheckOptionUrl))

  const styleSource = readFileSync(styleUrl, 'utf8')
  const headerSource = readFileSync(headerUrl, 'utf8')
  const loginCardSource = readFileSync(loginCardUrl, 'utf8')
  const credentialsSectionSource = readUsageAdminCredentialsFeatureSource()
  const usageAdminButtonSource = readFileSync(usageAdminButtonUrl, 'utf8')
  const usageAdminCheckOptionSource = readFileSync(usageAdminCheckOptionUrl, 'utf8')
  const usageAdminControlSource = [
    headerSource,
    loginCardSource,
    credentialsSectionSource
  ].join('\n')

  assert.match(headerSource, /<UsageAdminButton/)
  assert.match(loginCardSource, /<UsageAdminButton/)
  assert.match(credentialsSectionSource, /<UsageAdminButton/)
  assert.doesNotMatch(usageAdminControlSource, /class="usage-action-btn/)
  assert.doesNotMatch(usageAdminControlSource, /class="usage-primary-btn/)
  assert.doesNotMatch(usageAdminControlSource, /class="usage-micro-btn/)
  assert.match(usageAdminButtonSource, /usage-action-btn/)
  assert.match(usageAdminButtonSource, /usage-primary-btn/)
  assert.match(usageAdminButtonSource, /usage-micro-btn/)
  assert.match(usageAdminButtonSource, /usage-micro-btn-primary/)
  assert.match(usageAdminButtonSource, /usage-micro-btn-danger/)
  assert.match(credentialsSectionSource, /<UsageAdminCheckOption/)
  assert.doesNotMatch(credentialsSectionSource, /class="usage-check/)
  assert.match(usageAdminCheckOptionSource, /class="usage-check"/)
  assert.match(usageAdminCheckOptionSource, /\.usage-check\s*\{/)

  for (const selector of [
    'usage-action-btn',
    'usage-primary-btn',
    'usage-micro-btn',
    'usage-micro-btn-primary',
    'usage-micro-btn-danger'
  ]) {
    assert.doesNotMatch(usageAdminControlSource, new RegExp(`\\.${selector}\\s*\\{`))
    assert.match(usageAdminButtonSource, new RegExp(`\\.${selector}\\s*\\{`))
    assert.doesNotMatch(styleSource, new RegExp(`\\.${selector}\\s*\\{`))
  }

  assert.doesNotMatch(usageAdminButtonSource, /\.usage-check\s*\{/)
  assert.doesNotMatch(styleSource, /\.usage-check\s*\{/)
})
