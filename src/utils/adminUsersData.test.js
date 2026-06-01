import assert from 'node:assert/strict'
import test from 'node:test'

const adminUsersData = await import('./adminUsersData.js').catch(() => ({}))

const sampleUsers = [
  {
    id: 'u1',
    email: 'a@example.com',
    status: 'active',
    service: { serviceStatus: 'active' },
    officialUsage: { totalCostAmount: 9 },
    reconciliation: { pendingCount: 2 }
  },
  {
    id: 'u2',
    email: 'b@example.com',
    status: 'suspended',
    service: { serviceStatus: 'active' },
    officialUsage: { totalCostAmount: 12 },
    reconciliation: { pendingCount: 0 }
  },
  {
    id: 'u3',
    email: 'c@example.com',
    status: 'deleted',
    service: { serviceStatus: 'disabled' },
    officialUsage: { totalCostAmount: 0 }
  },
  {
    id: 'u4',
    email: 'd@example.com',
    service: { serviceStatus: 'not_enabled' },
    officialUsage: { totalCostAmount: 4 },
    reconciliation: { pendingCount: 1 }
  },
  {
    id: 'u5',
    email: 'e@example.com',
    status: 'active',
    officialUsage: { totalCostAmount: 1 }
  },
  {
    id: 'u6',
    email: 'f@example.com',
    status: 'active',
    service: { serviceStatus: 'active' },
    officialUsage: { totalCostAmount: 3 }
  }
]

test('admin users data helpers preserve user status and service summary behavior', () => {
  assert.equal(typeof adminUsersData.getAdminUserStats, 'function')
  assert.equal(typeof adminUsersData.getAdminNotEnabledActiveUsers, 'function')
  assert.equal(typeof adminUsersData.getAdminPendingBillingUserCount, 'function')
  assert.equal(typeof adminUsersData.getAdminActiveServiceUserCount, 'function')
  assert.equal(typeof adminUsersData.getAdminServiceActivationRate, 'function')

  assert.deepEqual(adminUsersData.getAdminUserStats(sampleUsers), {
    total: 6,
    active: 4,
    suspended: 1,
    deleted: 1
  })
  assert.deepEqual(
    adminUsersData.getAdminNotEnabledActiveUsers(sampleUsers).map((item) => item.id),
    ['u4', 'u5']
  )
  assert.equal(adminUsersData.getAdminPendingBillingUserCount(sampleUsers), 2)
  assert.equal(adminUsersData.getAdminActiveServiceUserCount(sampleUsers), 3)
  assert.equal(adminUsersData.getAdminServiceActivationRate(sampleUsers), 75)
  assert.equal(adminUsersData.getAdminServiceActivationRate([]), 0)
})

test('admin users data helpers preserve top spender filtering and ordering', () => {
  assert.equal(typeof adminUsersData.getAdminTopSpenders, 'function')

  assert.deepEqual(
    adminUsersData.getAdminTopSpenders(sampleUsers).map((item) => item.id),
    ['u2', 'u1', 'u4', 'u6', 'u5']
  )
  assert.deepEqual(
    adminUsersData.getAdminTopSpenders([...sampleUsers, {
      id: 'u7',
      officialUsage: { totalCostAmount: 8 }
    }]).map((item) => item.id),
    ['u2', 'u1', 'u7', 'u4', 'u6']
  )
  assert.deepEqual(adminUsersData.getAdminTopSpenders([{ id: 'zero', officialUsage: { totalCostAmount: 0 } }]), [])
})

test('admin users data helpers preserve filtering, cost sorting, and fallback date ordering', () => {
  assert.equal(typeof adminUsersData.getAdminFilteredUsers, 'function')

  const users = [
    {
      id: 'u1',
      email: 'first@example.com',
      displayName: 'Alpha',
      status: 'active',
      officialUsage: { totalCostAmount: 5 },
      usageMeta: { lastActivityAt: '2026-02-01T00:00:00Z' }
    },
    {
      id: 'u2',
      email: 'ops@example.com',
      displayName: 'Beta',
      status: 'suspended',
      officialUsage: { totalCostAmount: 9 },
      createdAt: '2026-01-01T00:00:00Z'
    },
    {
      id: 'u3',
      email: 'gamma@example.com',
      displayName: 'Gamma',
      status: 'active',
      officialUsage: { totalCostAmount: 9 },
      usageMeta: { lastActivityAt: '2026-03-01T00:00:00Z' }
    },
    {
      id: 'missing-status',
      email: 'missing@example.com',
      displayName: 'No Status',
      officialUsage: { totalCostAmount: 1 },
      createdAt: '2026-04-01T00:00:00Z'
    }
  ]

  assert.deepEqual(
    adminUsersData.getAdminFilteredUsers(users, { query: '', statusFilter: 'all' }).map((item) => item.id),
    ['u3', 'u2', 'u1', 'missing-status']
  )
  assert.deepEqual(
    adminUsersData.getAdminFilteredUsers(users, { query: ' EXAMPLE ', statusFilter: 'active' }).map((item) => item.id),
    ['u3', 'u1', 'missing-status']
  )
  assert.deepEqual(
    adminUsersData.getAdminFilteredUsers(users, { query: 'beta', statusFilter: 'all' }).map((item) => item.id),
    ['u2']
  )
  assert.deepEqual(adminUsersData.getAdminFilteredUsers(null, { query: 'x', statusFilter: 'all' }), [])
})

test('admin users data helpers preserve pagination calculations and visible page windows', () => {
  assert.equal(typeof adminUsersData.getAdminTotalUserPages, 'function')
  assert.equal(typeof adminUsersData.getAdminPagedUsers, 'function')
  assert.equal(typeof adminUsersData.getAdminUserPageStart, 'function')
  assert.equal(typeof adminUsersData.getAdminUserPageEnd, 'function')
  assert.equal(typeof adminUsersData.getAdminVisibleUserPages, 'function')
  assert.equal(typeof adminUsersData.getClampedAdminUserPage, 'function')

  const users = Array.from({ length: 12 }, (_, index) => ({ id: `u${index + 1}` }))

  assert.equal(adminUsersData.getAdminTotalUserPages([], 10), 1)
  assert.equal(adminUsersData.getAdminTotalUserPages(users, 5), 3)
  assert.deepEqual(
    adminUsersData.getAdminPagedUsers(users, { page: 2, pageSize: 5 }).map((item) => item.id),
    ['u6', 'u7', 'u8', 'u9', 'u10']
  )
  assert.equal(adminUsersData.getAdminUserPageStart(users, { page: 3, pageSize: 5 }), 11)
  assert.equal(adminUsersData.getAdminUserPageEnd(users, { page: 3, pageSize: 5 }), 12)
  assert.equal(adminUsersData.getAdminUserPageStart([], { page: 1, pageSize: 5 }), 0)
  assert.equal(adminUsersData.getAdminUserPageEnd([], { page: 1, pageSize: 5 }), 0)
  assert.deepEqual(adminUsersData.getAdminVisibleUserPages({ currentPage: 1, totalPages: 3 }), [1, 2, 3])
  assert.deepEqual(adminUsersData.getAdminVisibleUserPages({ currentPage: 1, totalPages: 8 }), [1, 2, 3, 4, 5])
  assert.deepEqual(adminUsersData.getAdminVisibleUserPages({ currentPage: 8, totalPages: 8 }), [4, 5, 6, 7, 8])
  assert.deepEqual(adminUsersData.getAdminVisibleUserPages({ currentPage: 5, totalPages: 9 }), [3, 4, 5, 6, 7])
  assert.equal(adminUsersData.getClampedAdminUserPage(0, 3), 1)
  assert.equal(adminUsersData.getClampedAdminUserPage(5, 3), 3)
})
