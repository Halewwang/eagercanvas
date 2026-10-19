import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const stateCore = await import('./useAdminUsersStateCore.js').catch(() => ({}))
const stateHookUrl = new URL('./useAdminUsersState.js', import.meta.url)
const stateHookSource = existsSync(stateHookUrl) ? readFileSync(stateHookUrl, 'utf8') : ''

test('admin user request params include only account and service filters', () => {
  assert.equal(typeof stateCore.buildAdminUsersRequestParams, 'function')
  assert.deepEqual(stateCore.buildAdminUsersRequestParams({
    page: 3,
    limit: 50,
    search: ' member@example.test ',
    status: 'active',
    serviceStatus: 'enabled',
    role: 'ops'
  }), {
    page: 3,
    limit: 50,
    search: 'member@example.test',
    status: 'active',
    serviceStatus: 'enabled',
    role: 'ops'
  })
})

test('admin user page response keeps server pagination and does not aggregate client-side', () => {
  assert.equal(typeof stateCore.normalizeAdminUsersPageResponse, 'function')
  assert.deepEqual(stateCore.normalizeAdminUsersPageResponse({ data: {
    items: [{ id: 'u1' }],
    pagination: { page: 2, limit: 25, total: 31, totalPages: 99 }
  } }), {
    items: [{ id: 'u1' }],
    pagination: { page: 2, limit: 25, total: 31, totalPages: 2 }
  })
})

test('admin user page loader refetches the last valid page when total shrinks', async () => {
  assert.equal(typeof stateCore.requestAdminUsersPage, 'function')
  if (typeof stateCore.requestAdminUsersPage !== 'function') return

  const calls = []
  const responses = [
    { data: { items: [], pagination: { page: 2, limit: 25, total: 24 } } },
    { data: { items: [{ id: 'u24' }], pagination: { page: 1, limit: 25, total: 24 } } }
  ]
  const result = await stateCore.requestAdminUsersPage(async (params) => {
    calls.push(params)
    return responses.shift()
  }, { page: 2, limit: 25, search: '', status: '', serviceStatus: '', role: '' })

  assert.deepEqual(calls.map((params) => params.page), [2, 1])
  assert.equal(result.queryPage, 1)
  assert.deepEqual(result.page.items, [{ id: 'u24' }])
})

test('admin users state composable owns user filters, pagination, and loading behavior', () => {
  assert.match(stateHookSource, /export const useAdminUsersState/)
  assert.match(stateHookSource, /getAdminUsers/)
  assert.match(stateHookSource, /requestAdminUsersPage/)
  assert.match(stateHookSource, /requestAdminUsersPage/)
  assert.match(stateHookSource, /requestAdminUsersPage/)
  assert.doesNotMatch(stateHookSource, /reconciliationState|officialUsage|topSpenders/)
  assert.match(stateHookSource, /requestSequence/)
  assert.match(stateHookSource, /requestSequence \+= 1/)
  assert.match(stateHookSource, /onUnmounted/)
  assert.match(stateHookSource, /clearTimeout\(searchTimer\)/)
  assert.match(stateHookSource, /250/)
  assert.match(stateHookSource, /const loadUsers = async/)
  assert.doesNotMatch(stateHookSource, /getAdminFilteredUsers|getAdminPagedUsers/)
  assert.doesNotMatch(stateHookSource, /fetchUsers\(\)/)
})
