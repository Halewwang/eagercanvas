import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { test } from 'node:test'
import { ref } from 'vue'

const sectionPropsUrl = new URL('./useAdminDashboardSectionProps.js', import.meta.url)
const sectionPropsSource = existsSync(sectionPropsUrl) ? readFileSync(sectionPropsUrl, 'utf8') : ''
const sectionPropsModule = await import('./useAdminDashboardSectionProps.js').catch(() => ({}))

const fn = () => 'ok'

const createDeps = () => ({
  activeServiceUsers: ref(2),
  adminAccountLabel: ref('ops@example.test'),
  apiLogPagination: ref({ page: 2, limit: 10, total: 32 }),
  apiLogs: ref([{ id: 'api-log-1' }]),
  auditLogs: ref([{ id: 'audit-1' }]),
  auth: {
    permissions: ref(['admin.user.read', 'admin.audit.read']),
    roles: ref(['admin'])
  },
  balanceDisplay: ref('$12.50'),
  barWidth: fn,
  canActivateService: ref(true),
  canDisableService: ref(false),
  canManageRoles: ref(true),
  canManageUserStatus: ref(true),
  canExportIssues: ref(true),
  canNotifyIssues: ref(true),
  canReadAudit: ref(true),
  canReadIssues: ref(true),
  canReadUsage: ref(true),
  canReadUsers: ref(true),
  canReconcileBilling: ref(false),
  canResetService: ref(true),
  canUpdateIssues: ref(true),
  canUpdateServiceLimits: ref(true),
  cards: ref([{ label: 'Users' }]),
  deleting: ref({ 'user-1': false }),
  filteredUsers: ref([{ id: 'user-1' }]),
  formatDateTime: fn,
  formatRoleList: fn,
  formatUsd: fn,
  isSelf: fn,
  issueActionLoading: ref(''),
  issuePagination: ref({ total: 1 }),
  issueQuery: ref({ status: 'open' }),
  issues: ref([{ id: 'issue-1' }]),
  lastExport: ref({ jsonPath: '/tmp/issues.json' }),
  loadingIssueDetail: ref(false),
  loadingIssues: ref(false),
  loading302: ref(false),
  loadingApiLogs: ref(false),
  loadingLogs: ref(false),
  loadingOverview: ref(false),
  loadingRecord: ref(false),
  loadingUsers: ref(false),
  log302Query: ref({ page: 1 }),
  logQuery: ref({ page: 2 }),
  notEnabledActiveUsers: ref([{ id: 'user-2' }]),
  nowLabel: ref('2026/5/30'),
  pagedUsers: ref([{ id: 'user-1' }]),
  pagination: ref({ total: 5 }),
  pendingBillingUsers: ref(1),
  recordData: ref({ id: 'record-1' }),
  recordRequestId: ref('request-1'),
  reconcilingBilling: ref(false),
  roleLabel: fn,
  roleOptions: ref([{ value: 'admin' }]),
  saving: ref({ 'user-1': false }),
  selectedRoles: ref({ 'user-1': 'admin' }),
  selectedIssue: ref({ group: { id: 'issue-1' }, events: [] }),
  serviceActivationRate: ref(50),
  serviceLoadNotice: ref(''),
  serviceLoading: ref({ 'user-1': false }),
  serviceStatusClass: fn,
  serviceStatusLabel: fn,
  showServiceSection: ref(true),
  showUserActions: ref(true),
  statusClass: fn,
  statusLabel: fn,
  statusLoading: ref({ 'user-1': false }),
  toPrettyJson: fn,
  topModelLabel: fn,
  topSpenders: ref([{ id: 'user-1' }]),
  totalUserPages: ref(3),
  usageSeries: ref([{ date: '2026-05-30' }]),
  userPage: ref(1),
  userPageEnd: ref(10),
  userPageStart: ref(1),
  userSearchQuery: ref('member'),
  userStatusFilter: ref('active'),
  users: ref([{ id: 'user-1' }]),
  visibleUserPages: ref([1, 2, 3])
})

test('admin dashboard section props composable groups section-facing props', () => {
  assert.equal(typeof sectionPropsModule.useAdminDashboardSectionProps, 'function')

  const deps = createDeps()
  const {
    overviewSectionProps,
    userServiceSectionProps,
    serviceReconciliationSectionProps,
    auditLogSectionProps,
    issueInboxSectionProps
  } = sectionPropsModule.useAdminDashboardSectionProps(deps)

  assert.equal(overviewSectionProps.value.activeServiceUsers, 2)
  assert.equal(overviewSectionProps.value.adminAccountLabel, 'ops@example.test')
  assert.equal(overviewSectionProps.value.permissionCount, 2)
  assert.deepEqual(overviewSectionProps.value.roles, ['admin'])
  assert.strictEqual(overviewSectionProps.value.formatUsd, fn)

  assert.equal(userServiceSectionProps.value.searchQuery, 'member')
  assert.equal(userServiceSectionProps.value.statusFilter, 'active')
  assert.equal(userServiceSectionProps.value.canReadUsers, true)
  assert.deepEqual(userServiceSectionProps.value.pagedUsers, [{ id: 'user-1' }])
  assert.strictEqual(userServiceSectionProps.value.isSelf, fn)

  assert.equal(serviceReconciliationSectionProps.value.recordRequestId, 'request-1')
  assert.equal(serviceReconciliationSectionProps.value.balanceDisplay, '$12.50')
  assert.equal(serviceReconciliationSectionProps.value.showServiceSection, true)
  assert.deepEqual(serviceReconciliationSectionProps.value.apiLogs, [{ id: 'api-log-1' }])
  assert.deepEqual(serviceReconciliationSectionProps.value.apiLogPagination, { page: 2, limit: 10, total: 32 })

  assert.equal(auditLogSectionProps.value.canReadAudit, true)
  assert.deepEqual(auditLogSectionProps.value.auditLogs, [{ id: 'audit-1' }])
  assert.deepEqual(auditLogSectionProps.value.pagination, { total: 5 })
  assert.strictEqual(auditLogSectionProps.value.toPrettyJson, fn)

  assert.equal(issueInboxSectionProps.value.canReadIssues, true)
  assert.equal(issueInboxSectionProps.value.canExportIssues, true)
  assert.deepEqual(issueInboxSectionProps.value.issues, [{ id: 'issue-1' }])
  assert.equal(issueInboxSectionProps.value.selectedIssue.group.id, 'issue-1')

  deps.activeServiceUsers.value = 4
  deps.auth.permissions.value = ['admin.user.read']
  deps.userSearchQuery.value = 'owner'
  deps.showServiceSection.value = false

  assert.equal(overviewSectionProps.value.activeServiceUsers, 4)
  assert.equal(overviewSectionProps.value.permissionCount, 1)
  assert.equal(userServiceSectionProps.value.searchQuery, 'owner')
  assert.equal(serviceReconciliationSectionProps.value.showServiceSection, false)
})

test('admin dashboard section props composable owns grouped prop assembly', () => {
  assert.match(sectionPropsSource, /export const useAdminDashboardSectionProps/)
  assert.match(sectionPropsSource, /overviewSectionProps/)
  assert.match(sectionPropsSource, /userServiceSectionProps/)
  assert.match(sectionPropsSource, /serviceReconciliationSectionProps/)
  assert.match(sectionPropsSource, /auditLogSectionProps/)
  assert.match(sectionPropsSource, /issueInboxSectionProps/)
  assert.match(sectionPropsSource, /permissionCount/)
})
