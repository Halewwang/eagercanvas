import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { adminRouter } from './admin.routes.js'
import { usageRouter } from './usage.routes.js'
import { requireAdminLifecycleMutationEnabled } from '../middleware/admin-lifecycle-release-guard.js'

const routes = adminRouter.stack.filter((layer) => layer.route).map((layer) => layer.route)
const source = readFileSync(new URL('./admin.routes.js', import.meta.url), 'utf8')

test('admin API only exposes user, service, role, session, and necessary audit operations', () => {
  assert.deepEqual(routes.map((route) => `${Object.keys(route.methods)[0]} ${route.path}`), [
    'get /session', 'get /users', 'get /users/:userId/audit', 'get /users/:userId',
    'patch /users/:userId/roles', 'patch /users/:userId/status', 'delete /users/:userId',
    'post /users/:userId/restore', 'post /users/:userId/service-access/activate',
    'post /users/:userId/service-access/disable', 'get /audit-logs'
  ])
  assert.deepEqual(usageRouter.stack.filter((layer) => layer.route).map((layer) => layer.route.path), ['/summary', '/timeseries'])
  assert.doesNotMatch(source, /302|api-keys|billing|issues|service-access\/(?:manual|reset|limits)/)
})

test('each admin operation rejects callers without its explicit permission', async () => {
  for (const route of routes) {
    let failure
    await route.stack[0].handle({ user: { id: 'user-1', roles: ['user'], permissions: [] } }, {}, (error) => { failure = error })
    assert.equal(failure?.code, 'FORBIDDEN', route.path)
  }
})

test('all mutating admin routes retain the lifecycle release guard', () => {
  for (const route of routes.filter((route) => !route.methods.get)) {
    assert.equal(route.stack[1].handle, requireAdminLifecycleMutationEnabled, route.path)
  }
})

test('suspension and archival/restoration preserve audit reasons and mutation request context', () => {
  assert.match(source, /const updateUserStatusSchema[\s\S]+reason: z\.string\(\)\.trim\(\)\.min\(1\)\.max\(500\)/)
  assert.match(source, /value\.status === 'suspended' && !value\.reason/)
  for (const start of ["adminRouter.delete('/users/:userId'", "adminRouter.post('/users/:userId/restore'"]) {
    const route = source.slice(source.indexOf(start), source.indexOf('}))', source.indexOf(start)))
    assert.match(route, /adminReasonSchema\.parse\(req\.body \|\| \{\}\)/)
    assert.match(route, /requestId: req\.requestId/)
  }
  assert.doesNotMatch(source, /apiName:|apiKey:|limitCost:/)
})

test('user managers can load their session without the retired dashboard overview permission', async () => {
  const session = routes.find((route) => route.path === '/session')
  let failure
  await session.stack[0].handle({ user: { id: 'manager', roles: ['support'], permissions: ['admin.user.read'] } }, {}, (error) => { failure = error })
  assert.equal(failure, undefined)
})
