import assert from 'node:assert/strict'
import test from 'node:test'
import { buildAdminUserMutationPayload, canRunAdminUserMutation, canUseAdminDesktopMutation, setAdminActionLoading } from './useAdminUserActionsCore.js'

test('account and service mutations require desktop permission and protect the signed-in account', () => {
  const base = { action: 'archive', user: { id: 'u1', status: 'active' }, canUseDesktopActions: { value: true }, permissions: { canArchiveUser: { value: true } } }
  assert.equal(canRunAdminUserMutation(base), true)
  assert.equal(canRunAdminUserMutation({ ...base, isSelf: () => true }), false)
  assert.equal(canRunAdminUserMutation({ ...base, canUseDesktopActions: false }), false)
  assert.equal(canRunAdminUserMutation({ ...base, permissions: {} }), false)
  assert.equal(canRunAdminUserMutation({ ...base, action: 'unexpected' }), false)
  assert.equal(canRunAdminUserMutation({ ...base, action: 'disable-service', user: { id: 'u1', status: 'deleted' }, permissions: { canDisableService: true } }), false)
  assert.equal(canRunAdminUserMutation({ ...base, action: 'resume', permissions: { canManageUserStatus: true } }), true)
  assert.equal(canUseAdminDesktopMutation({ value: false }, { value: true }), false)
  assert.equal(canUseAdminDesktopMutation({ value: true }, { value: true }), true)
})

test('deletion requires a reason and exact email confirmation', () => {
  const user = { email: 'member@example.test' }
  assert.deepEqual(buildAdminUserMutationPayload({ action: 'suspend' }), { ok: false, message: '请输入变更原因' })
  assert.equal(buildAdminUserMutationPayload({ action: 'archive', user, reason: 'left', confirmation: 'wrong' }).ok, false)
  assert.deepEqual(buildAdminUserMutationPayload({ action: 'archive', user, reason: ' left ', confirmation: user.email }), { ok: true, payload: { reason: 'left' } })
})

test('loading map preserves other in-flight users', () => {
  const state = { value: { other: true } }
  assert.equal(setAdminActionLoading(state, 'u1', true), true)
  assert.deepEqual(state.value, { other: true, u1: true })
  assert.equal(setAdminActionLoading(state, '', false), false)
})
