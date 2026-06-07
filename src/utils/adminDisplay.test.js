import assert from 'node:assert/strict'
import test from 'node:test'

const adminDisplay = await import('./adminDisplay.js').catch(() => ({}))

test('admin display date helpers preserve blank, invalid, and timestamp formatting behavior', () => {
  assert.equal(typeof adminDisplay.formatAdminDateTime, 'function')
  assert.equal(typeof adminDisplay.formatAdminExpire, 'function')

  assert.equal(adminDisplay.formatAdminDateTime(''), '-')
  assert.equal(adminDisplay.formatAdminDateTime('not-a-date'), '-')
  assert.equal(
    adminDisplay.formatAdminDateTime('2026-05-30T11:22:33Z'),
    new Date('2026-05-30T11:22:33Z').toLocaleString()
  )

  assert.equal(adminDisplay.formatAdminExpire(0), '-')
  assert.equal(adminDisplay.formatAdminExpire(-1), '-')
  assert.equal(
    adminDisplay.formatAdminExpire(1770000000),
    new Date(1770000000 * 1000).toLocaleString()
  )
})

test('admin display value helpers preserve existing masking and numeric formatting', () => {
  assert.equal(typeof adminDisplay.maskAdminApiKey, 'function')
  assert.equal(typeof adminDisplay.formatAdminUsd, 'function')

  assert.equal(adminDisplay.maskAdminApiKey(''), '-')
  assert.equal(adminDisplay.maskAdminApiKey('short-key'), 'short-key')
  assert.equal(adminDisplay.maskAdminApiKey('sk-abcdefghijklmnopqrstuvwxyz'), 'sk-abc...wxyz')

  assert.equal(adminDisplay.formatAdminUsd(undefined), '0.00')
  assert.equal(adminDisplay.formatAdminUsd(12.3456), '12.35')
  assert.equal(adminDisplay.formatAdminUsd(12.3456, 4), '12.3456')
})

test('admin display role helpers preserve role options, labels, and list formatting', () => {
  assert.ok(Array.isArray(adminDisplay.ADMIN_ROLE_OPTIONS))
  assert.equal(typeof adminDisplay.getAdminRoleLabel, 'function')
  assert.equal(typeof adminDisplay.formatAdminRoleList, 'function')

  assert.deepEqual(adminDisplay.ADMIN_ROLE_OPTIONS, [
    { value: 'super_admin', label: '超级管理员' },
    { value: 'admin', label: '管理员' },
    { value: 'ops', label: '运维' },
    { value: 'support', label: '客服' },
    { value: 'user', label: '普通用户' }
  ])
  assert.equal(adminDisplay.getAdminRoleLabel('super_admin'), '超级管理员')
  assert.equal(adminDisplay.getAdminRoleLabel(' admin '), '管理员')
  assert.equal(adminDisplay.getAdminRoleLabel('custom_role'), 'custom_role')
  assert.equal(adminDisplay.getAdminRoleLabel(''), '-')
  assert.equal(adminDisplay.formatAdminRoleList(['super_admin', 'support', 'custom_role']), '超级管理员、客服、custom_role')
  assert.equal(adminDisplay.formatAdminRoleList(undefined), '')
})

test('admin display navigation helpers preserve nav items, routes, and access labels', () => {
  assert.equal(typeof adminDisplay.getAdminNavItems, 'function')
  assert.equal(typeof adminDisplay.getAdminAccessScope, 'function')
  assert.deepEqual(adminDisplay.ADMIN_ROUTE_NAME_BY_SECTION, {
    overview: 'AdminDashboard',
    users: 'AdminUsers',
    service: 'AdminService',
    audit: 'AdminAudit',
    issues: 'AdminIssues'
  })
  assert.deepEqual(adminDisplay.ADMIN_SECTION_BY_ROUTE_NAME, {
    AdminDashboard: 'overview',
    AdminUsers: 'users',
    AdminService: 'service',
    AdminAudit: 'audit',
    AdminIssues: 'issues'
  })

  assert.deepEqual(adminDisplay.getAdminNavItems({}), [
    { key: 'overview', label: '概览', note: '总览' }
  ])
  assert.deepEqual(
    adminDisplay.getAdminNavItems({ canReadUsers: true, showServiceSection: true, canReadAudit: true, canReadIssues: true }),
    [
      { key: 'overview', label: '概览', note: '总览' },
      { key: 'users', label: '用户服务', note: '开通' },
      { key: 'service', label: '消耗对账', note: '同步' },
      { key: 'audit', label: '审计日志', note: '追踪' },
      { key: 'issues', label: '问题收件箱', note: '修复' }
    ]
  )

  assert.deepEqual(adminDisplay.getAdminAccessScope({}), ['概览'])
  assert.deepEqual(
    adminDisplay.getAdminAccessScope({
      canReadUsers: true,
      canReadUsage: true,
      canActivateService: true,
      canReconcileBilling: true,
      canReadAudit: true,
      canReadIssues: true
    }),
    ['概览', '用户', '用量', '服务访问', '对账', '审计', '问题']
  )
  assert.deepEqual(adminDisplay.getAdminAccessScope({ canDisableService: true }), ['概览', '服务访问'])
})

test('admin display overview card helper preserves card order, labels, values, and permission fallbacks', () => {
  assert.equal(typeof adminDisplay.getAdminOverviewCards, 'function')

  assert.deepEqual(adminDisplay.getAdminOverviewCards({
    canReadUsers: true,
    canReadUsage: true,
    canReadAudit: true,
    userStats: { total: 12, suspended: 3 },
    usageSummary: { totalCalls: 88, totalCostUsd: 12.345 },
    auditTotal: 7,
    activeServiceUsers: 5
  }), [
    { label: '管理用户数', value: 12, note: '当前后台可见用户总数' },
    { label: '已暂停', value: 3, note: '当前被暂停的账号数' },
    { label: '总调用量', value: 88, note: '全局请求总次数' },
    { label: '官方消耗 (USD)', value: '12.35', note: '累计官方消耗' },
    { label: '审计条目', value: 7, note: '当前审计日志总条数' },
    { label: '已开通服务', value: 5, note: '当前可调用服务的用户数' }
  ])

  assert.deepEqual(adminDisplay.getAdminOverviewCards({}), [
    { label: '管理用户数', value: '--', note: '缺少权限' },
    { label: '已暂停', value: '--', note: '缺少权限' },
    { label: '总调用量', value: '--', note: '无用量权限' },
    { label: '官方消耗 (USD)', value: '--', note: '无用量权限' },
    { label: '审计条目', value: '--', note: '无审计权限' },
    { label: '已开通服务', value: '--', note: '缺少权限' }
  ])
})

test('admin display overview cards prefer 302 official usage when provided', () => {
  assert.deepEqual(adminDisplay.getAdminOverviewCards({
    canReadUsers: true,
    canReadUsage: true,
    canReadAudit: false,
    userStats: { total: 2, suspended: 0 },
    usageSummary: { totalCalls: 88, totalCostUsd: 12.345 },
    officialUsageSummary: { totalCalls: 5, totalCostAmount: 6.5, currency: 'PTC' },
    auditTotal: 0,
    activeServiceUsers: 2
  }), [
    { label: '管理用户数', value: 2, note: '当前后台可见用户总数' },
    { label: '已暂停', value: 0, note: '当前被暂停的账号数' },
    { label: '302.ai 调用量', value: 5, note: '来自用户 302.ai 调用数据' },
    { label: '302.ai 消耗 (PTC)', value: '6.50', note: '来自 302.ai usage-log' },
    { label: '审计条目', value: '--', note: '无审计权限' },
    { label: '已开通服务', value: 2, note: '当前可调用服务的用户数' }
  ])
})

test('usage admin overview metric helper preserves card order, labels, and credential coverage', () => {
  assert.equal(typeof adminDisplay.getUsageAdminOverviewMetrics, 'function')

  assert.deepEqual(adminDisplay.getUsageAdminOverviewMetrics({
    balance: '0',
    users: [
      { id: 'user-a', assignedApiKeys: [{ apiName: 'svc-a' }] },
      { id: 'user-b', assignedApiKeys: [] },
      { id: 'user-c', assignedApiKeys: [{ apiName: 'svc-c' }, { apiName: 'svc-d' }] }
    ],
    apiKeys: [{ api_name: 'svc-a' }, { api_name: 'svc-c' }]
  }), [
    { label: 'Eager Service Balance', value: '$0' },
    { label: 'Registered Users', value: 3 },
    { label: '服务凭证', value: 2 },
    { label: 'Users With Credentials', value: 2 }
  ])

  assert.deepEqual(adminDisplay.getUsageAdminOverviewMetrics({}), [
    { label: 'Eager Service Balance', value: '--' },
    { label: 'Registered Users', value: 0 },
    { label: '服务凭证', value: 0 },
    { label: 'Users With Credentials', value: 0 }
  ])
})

test('usage admin sidebar helpers preserve nav counts and session fallback copy', () => {
  assert.equal(typeof adminDisplay.getUsageAdminSidebarItems, 'function')
  assert.equal(typeof adminDisplay.getUsageAdminSessionSummary, 'function')

  assert.deepEqual(adminDisplay.getUsageAdminSidebarItems({
    users: [{ id: 'user-a' }, { id: 'user-b' }],
    apiKeys: [{ api_name: 'svc-a' }]
  }), [
    { label: 'Overview', value: 'Live', href: '#overview', active: true },
    { label: '服务凭证', value: 1, href: '#keys', active: false },
    { label: 'Users', value: 2, href: '#users', active: false }
  ])

  assert.deepEqual(adminDisplay.getUsageAdminSidebarItems({ users: null, apiKeys: null }), [
    { label: 'Overview', value: 'Live', href: '#overview', active: true },
    { label: '服务凭证', value: 0, href: '#keys', active: false },
    { label: 'Users', value: 0, href: '#users', active: false }
  ])

  assert.deepEqual(adminDisplay.getUsageAdminSessionSummary({
    adminSession: { admin: { username: 'ops-admin' } },
    isAuthenticated: true
  }), {
    username: 'ops-admin',
    status: 'Usage admin access'
  })

  assert.deepEqual(adminDisplay.getUsageAdminSessionSummary({}), {
    username: 'Not signed in',
    status: 'Login required'
  })
})

test('admin display user status helpers preserve pill classes and Chinese labels', () => {
  assert.equal(typeof adminDisplay.getAdminUserStatusClass, 'function')
  assert.equal(typeof adminDisplay.getAdminUserStatusLabel, 'function')

  assert.equal(adminDisplay.getAdminUserStatusClass(), 'ui-status-pill-active')
  assert.equal(adminDisplay.getAdminUserStatusClass('suspended'), 'ui-status-pill-suspended')
  assert.equal(adminDisplay.getAdminUserStatusClass('deleted'), 'ui-status-pill-deleted')
  assert.equal(adminDisplay.getAdminUserStatusClass('unknown'), 'ui-status-pill-active')

  assert.equal(adminDisplay.getAdminUserStatusLabel(), '正常')
  assert.equal(adminDisplay.getAdminUserStatusLabel('suspended'), '已暂停')
  assert.equal(adminDisplay.getAdminUserStatusLabel('deleted'), '已删除')
  assert.equal(adminDisplay.getAdminUserStatusLabel('unknown'), '正常')
})

test('admin display service status helpers preserve pill classes and Chinese labels', () => {
  assert.equal(typeof adminDisplay.getAdminServiceStatusClass, 'function')
  assert.equal(typeof adminDisplay.getAdminServiceStatusLabel, 'function')

  assert.equal(adminDisplay.getAdminServiceStatusClass(), '')
  assert.equal(adminDisplay.getAdminServiceStatusClass('active'), 'ui-status-pill-active')
  assert.equal(adminDisplay.getAdminServiceStatusClass('disabled'), 'ui-status-pill-suspended')
  assert.equal(adminDisplay.getAdminServiceStatusClass('deleted'), 'ui-status-pill-suspended')
  assert.equal(adminDisplay.getAdminServiceStatusClass('create_failed'), 'ui-status-pill-deleted')

  assert.equal(adminDisplay.getAdminServiceStatusLabel(), '未开通')
  assert.equal(adminDisplay.getAdminServiceStatusLabel('active'), '已开通')
  assert.equal(adminDisplay.getAdminServiceStatusLabel('disabled'), '已停用')
  assert.equal(adminDisplay.getAdminServiceStatusLabel('create_failed'), '创建失败')
  assert.equal(adminDisplay.getAdminServiceStatusLabel('deleted'), '已删除')
  assert.equal(adminDisplay.getAdminServiceStatusLabel('unknown'), '未开通')
})

test('admin display usage helpers preserve model, bar width, and json formatting behavior', () => {
  assert.equal(typeof adminDisplay.getAdminTopModelLabel, 'function')
  assert.equal(typeof adminDisplay.getAdminUsageBarWidth, 'function')
  assert.equal(typeof adminDisplay.formatAdminJson, 'function')

  assert.equal(
    adminDisplay.getAdminTopModelLabel({ officialUsage: { byModel: [{ model: 'gpt-image-2', calls: 7 }] } }),
    'gpt-image-2 · 7 次'
  )
  assert.equal(
    adminDisplay.getAdminTopModelLabel({ officialUsage: { byModel: [{ calls: 0 }] } }),
    '未命名模型 · 0 次'
  )
  assert.equal(adminDisplay.getAdminTopModelLabel({ officialUsage: { byModel: [] } }), '暂无模型明细')

  assert.equal(
    adminDisplay.getAdminUsageBarWidth({ value: 10, series: [{ total_calls: 5 }, { total_calls: 20 }] }),
    50
  )
  assert.equal(adminDisplay.getAdminUsageBarWidth({ value: 2, series: [] }), 200)
  assert.equal(adminDisplay.getAdminUsageBarWidth({ value: undefined, series: [{ total_calls: 20 }] }), 0)

  assert.equal(adminDisplay.formatAdminJson({ a: 1 }), JSON.stringify({ a: 1 }, null, 2))
  assert.equal(adminDisplay.formatAdminJson(null), '{}')

  const circular = {}
  circular.self = circular
  assert.equal(adminDisplay.formatAdminJson(circular), '{}')
})
