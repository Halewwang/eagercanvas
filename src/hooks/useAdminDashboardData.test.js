import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const dashboardDataCore = await import('./useAdminDashboardDataCore.js').catch(() => ({}))
const dashboardDataHookUrl = new URL('./useAdminDashboardData.js', import.meta.url)
const dashboardDataHookSource = existsSync(dashboardDataHookUrl) ? readFileSync(dashboardDataHookUrl, 'utf8') : ''

test('admin audit pagination preserves response values and falls back to current query', () => {
  assert.equal(typeof dashboardDataCore.getAdminAuditPagination, 'function')

  assert.deepEqual(
    dashboardDataCore.getAdminAuditPagination({
      pagination: { page: '3', limit: '50', total: '128' }
    }, { page: 1, limit: 20 }),
    { page: 3, limit: 50, total: 128 }
  )

  assert.deepEqual(
    dashboardDataCore.getAdminAuditPagination({}, { page: 2, limit: 25 }),
    { page: 2, limit: 25, total: 0 }
  )
})

test('admin dashboard data composable owns usage and audit loading behavior', () => {
  assert.match(dashboardDataHookSource, /export const useAdminDashboardData/)
  assert.match(dashboardDataHookSource, /getAdminAuditPagination/)
  assert.match(dashboardDataHookSource, /getAdminUsageSummary/)
  assert.match(dashboardDataHookSource, /getAdminUsageTimeseries/)
  assert.match(dashboardDataHookSource, /getAdminAuditLogs/)
  assert.match(dashboardDataHookSource, /const loadUsage = async/)
  assert.match(dashboardDataHookSource, /const loadLogs = async/)
  assert.match(dashboardDataHookSource, /getAdminUsageBarWidth/)
})
