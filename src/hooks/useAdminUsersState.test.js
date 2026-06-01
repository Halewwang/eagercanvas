import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const stateCore = await import('./useAdminUsersStateCore.js').catch(() => ({}))
const stateHookUrl = new URL('./useAdminUsersState.js', import.meta.url)
const stateHookSource = existsSync(stateHookUrl) ? readFileSync(stateHookUrl, 'utf8') : ''

test('admin selected role map preserves first assigned role and defaults to user', () => {
  assert.equal(typeof stateCore.getAdminSelectedRoleMap, 'function')

  assert.deepEqual(stateCore.getAdminSelectedRoleMap([
    { id: 'owner-id', roles: ['owner', 'admin'] },
    { id: 'empty-id', roles: [] },
    { id: 'missing-id' }
  ]), {
    'owner-id': 'owner',
    'empty-id': 'user',
    'missing-id': 'user'
  })
})

test('admin users state composable owns user filters, pagination, and loading behavior', () => {
  assert.match(stateHookSource, /export const useAdminUsersState/)
  assert.match(stateHookSource, /getAdminSelectedRoleMap/)
  assert.match(stateHookSource, /getAdminUsers/)
  assert.match(stateHookSource, /getAdminFilteredUsers/)
  assert.match(stateHookSource, /const loadUsers = async/)
  assert.match(stateHookSource, /watch\(\[userSearchQuery, userStatusFilter\]/)
})
