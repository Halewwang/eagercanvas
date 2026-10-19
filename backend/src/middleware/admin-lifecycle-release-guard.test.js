import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { isAdminLifecycleMutationEnabled, requireAdminLifecycleMutationEnabled } from './admin-lifecycle-release-guard.js'

const routes = readFileSync(new URL('../routes/admin.routes.js', import.meta.url), 'utf8')

test('lifecycle mutations are disabled unless explicitly enabled', () => {
  assert.equal(isAdminLifecycleMutationEnabled({}), false)
  assert.equal(isAdminLifecycleMutationEnabled({ ADMIN_LIFECYCLE_MUTATIONS_ENABLED: 'false' }), false)
  assert.equal(isAdminLifecycleMutationEnabled({ ADMIN_LIFECYCLE_MUTATIONS_ENABLED: 'true' }), true)
})

test('disabled lifecycle guard returns a stable maintenance error', () => {
  let error
  requireAdminLifecycleMutationEnabled({}, {}, (value) => { error = value }, {})
  assert.equal(error.status, 503)
  assert.equal(error.code, 'ADMIN_LIFECYCLE_MAINTENANCE')
})

test('account and service mutation routes enforce the release guard', () => {
  for (const route of [
    "adminRouter.patch('/users/:userId/roles'",
    "adminRouter.patch('/users/:userId/status'",
    "adminRouter.delete('/users/:userId'",
    "adminRouter.post('/users/:userId/restore'",
    "adminRouter.post('/users/:userId/service-access/activate'",
    "adminRouter.post('/users/:userId/service-access/disable'",
  ]) {
    const start = routes.indexOf(route)
    assert.ok(start >= 0)
    assert.match(routes.slice(start, routes.indexOf('asyncHandler', start)), /requireAdminLifecycleMutationEnabled/)
  }
})
