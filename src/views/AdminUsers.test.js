import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const users = readFileSync(new URL('./AdminUsers.vue', import.meta.url), 'utf8')
const detail = readFileSync(new URL('./AdminUserDetail.vue', import.meta.url), 'utf8')
const actions = readFileSync(new URL('../hooks/useAdminUserActions.js', import.meta.url), 'utf8')
const api = readFileSync(new URL('../api/admin.js', import.meta.url), 'utf8')

test('dashboard exposes account operations and model access without key management', () => {
  for (const action of ['activateService', 'disableService', 'activateUser', 'deleteUser', 'restoreUser', 'suspendUser']) assert.match(users, new RegExp(action))
  assert.match(users, /文字、图片和视频模型/)
  assert.match(actions, /await activateAdminUserService\(user.id\)/)
  for (const source of [users, detail, actions, api]) assert.doesNotMatch(source, /bindManual|apiKey|reconcile|302|Issue|credentials|readUsage/)
})

test('user detail preserves self and super administrator role protection', () => {
  assert.match(detail, /!isSelfTarget.value/)
  assert.match(detail, /isSuperAdminOperator.value \|\| !user.value\?\.roles\?\.includes\('super_admin'\)/)
  assert.match(detail, /useAdminUserRoleMutation/)
  assert.match(detail, /保存角色/)
  assert.doesNotMatch(detail, /key: '(usage|credentials|audit)'/)
})

test('user listing uses compact cards with direct actions and keeps filtering, paging and confirmations', () => {
  assert.match(users, /<AdminUserCard\b/)
  assert.doesNotMatch(users, /<AdminTableShell|<AdminPageHeader/)
  for (const component of ['AdminUserServiceFilters', 'AdminUserServicePagination', 'AdminUserMutationDialog']) assert.match(users, new RegExp(`<${component}\\b`))
})
