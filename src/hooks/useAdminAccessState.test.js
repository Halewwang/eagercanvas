import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const accessCore = await import('./useAdminAccessStateCore.js').catch(() => ({}))
const accessHookUrl = new URL('./useAdminAccessState.js', import.meta.url)
const accessHookSource = existsSync(accessHookUrl) ? readFileSync(accessHookUrl, 'utf8') : ''

test('admin identity labels preserve display name and email fallbacks', () => {
  assert.equal(typeof accessCore.getAdminDisplayName, 'function')
  assert.equal(typeof accessCore.getAdminAccountLabel, 'function')

  assert.equal(accessCore.getAdminDisplayName({
    user: { displayName: ' Hale ', email: 'user@example.com' },
    adminUser: { email: 'admin@example.com' }
  }), 'Hale')
  assert.equal(accessCore.getAdminDisplayName({
    user: { displayName: '', email: 'user@example.com' },
    adminUser: { email: 'admin@example.com' }
  }), 'admin@example.com')
  assert.equal(accessCore.getAdminDisplayName({
    user: { email: 'user@example.com' },
    adminUser: null
  }), 'user@example.com')
  assert.equal(accessCore.getAdminDisplayName({}), '管理员')
  assert.equal(accessCore.getAdminAccountLabel({
    user: { email: 'user@example.com' },
    adminUser: { email: 'admin@example.com' }
  }), 'admin@example.com')
  assert.equal(accessCore.getAdminAccountLabel({ user: { email: 'user@example.com' } }), 'user@example.com')
  assert.equal(accessCore.getAdminAccountLabel({}), '-')
})

test('admin self check preserves current session id fallback order', () => {
  assert.equal(typeof accessCore.getAdminSelfCheck, 'function')

  assert.equal(accessCore.getAdminSelfCheck({ id: 'admin-id' }, {
    adminUser: { id: 'admin-id' },
    user: { id: 'user-id' }
  }), true)
  assert.equal(accessCore.getAdminSelfCheck({ id: 'user-id' }, {
    adminUser: null,
    user: { id: 'user-id' }
  }), true)
  assert.equal(accessCore.getAdminSelfCheck({ id: 'other-id' }, {
    adminUser: { id: 'admin-id' },
    user: { id: 'user-id' }
  }), false)
})

test('admin access state composable owns permission and session derived state', () => {
  assert.match(accessHookSource, /export const useAdminAccessState/)
  assert.match(accessHookSource, /getAdminAccessScope/)
  assert.match(accessHookSource, /admin\.user\.read/)
  assert.match(accessHookSource, /admin\.issue\.read/)
  assert.match(accessHookSource, /admin\.issue\.export/)
  assert.match(accessHookSource, /admin\.service_access\.activate/)
  assert.match(accessHookSource, /showServiceSection/)
  assert.match(accessHookSource, /showUserActions/)
})
