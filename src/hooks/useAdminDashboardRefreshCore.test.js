import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getAdminDashboardRefreshLoaderKeys,
  getAdminDashboardSessionOptions
} from './useAdminDashboardRefreshCore.js'

test('admin dashboard overview refresh only loads overview-critical data', () => {
  assert.deepEqual(getAdminDashboardRefreshLoaderKeys({
    sectionKey: 'overview',
    canReadUsage: true,
    canReadUsers: true,
    showServiceSection: true,
    canReadAudit: true,
    canReadIssues: true
  }), ['usage', 'users'])
})

test('admin dashboard refresh scopes work to the active business section', () => {
  const permissions = {
    canReadUsage: true,
    canReadUsers: true,
    showServiceSection: true,
    canReadAudit: true,
    canReadIssues: true
  }

  assert.deepEqual(getAdminDashboardRefreshLoaderKeys({ ...permissions, sectionKey: 'users' }), ['users'])
  assert.deepEqual(getAdminDashboardRefreshLoaderKeys({ ...permissions, sectionKey: 'service' }), ['users', 'service'])
  assert.deepEqual(getAdminDashboardRefreshLoaderKeys({ ...permissions, sectionKey: 'audit' }), ['audit'])
  assert.deepEqual(getAdminDashboardRefreshLoaderKeys({ ...permissions, sectionKey: 'issues' }), ['issues'])
})

test('admin dashboard session refresh defaults to cached session validation', () => {
  assert.deepEqual(getAdminDashboardSessionOptions(), { force: false })
  assert.deepEqual(getAdminDashboardSessionOptions({ forceSession: true }), { force: true })
})
