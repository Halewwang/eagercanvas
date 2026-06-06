import assert from 'node:assert/strict'
import test from 'node:test'

import * as localPreview from './localPreview.js'

test('local preview is disabled by default on local development hosts', () => {
  assert.equal(localPreview.isLocalPreviewEnabled({
    DEV: true,
    VITE_BYPASS_AUTH: '',
    hostname: '127.0.0.1'
  }), false)
})

test('local preview is enabled only when explicitly requested', () => {
  assert.equal(localPreview.isLocalPreviewEnabled({
    DEV: true,
    VITE_BYPASS_AUTH: 'true',
    hostname: '127.0.0.1'
  }), true)
})

test('local preview admin session exposes every dashboard section permission', () => {
  assert.equal(typeof localPreview.getLocalPreviewAdminSession, 'function')

  const session = localPreview.getLocalPreviewAdminSession()

  assert.equal(session.user.email, 'preview-admin@local.dev')
  assert.deepEqual(session.roles, ['super_admin', 'ops'])
  assert.deepEqual(new Set(session.permissions), new Set([
    'admin.dashboard.read',
    'admin.user.read',
    'admin.user.role.update',
    'admin.user.status.update',
    'admin.usage.read_all',
    'admin.audit.read',
    'admin.issue.read',
    'admin.issue.export',
    'admin.issue.update',
    'admin.issue.notify',
    'admin.service_access.activate',
    'admin.service_access.disable',
    'admin.service_access.reset',
    'admin.service_access.update_limits',
    'admin.billing.reconcile'
  ]))
})
