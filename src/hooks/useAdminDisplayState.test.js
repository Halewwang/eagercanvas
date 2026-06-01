import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { test } from 'node:test'

const displayHookUrl = new URL('./useAdminDisplayState.js', import.meta.url)
const displayHookSource = existsSync(displayHookUrl) ? readFileSync(displayHookUrl, 'utf8') : ''

test('admin display state composable owns display helpers and overview card derivation', () => {
  assert.ok(existsSync(displayHookUrl))
  assert.match(displayHookSource, /export const useAdminDisplayState/)
  assert.match(displayHookSource, /computed/)
  assert.match(displayHookSource, /ADMIN_ROLE_OPTIONS/)
  assert.match(displayHookSource, /getAdminOverviewCards/)
  assert.match(displayHookSource, /getAdminRoleLabel/)
  assert.match(displayHookSource, /formatAdminRoleList/)
  assert.match(displayHookSource, /formatAdminUsd/)
  assert.match(displayHookSource, /formatAdminDateTime/)
  assert.match(displayHookSource, /formatAdminJson/)
  assert.match(displayHookSource, /getAdminUserStatusClass/)
  assert.match(displayHookSource, /getAdminServiceStatusClass/)
  assert.match(displayHookSource, /getAdminTopModelLabel/)
})
