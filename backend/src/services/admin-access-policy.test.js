import assert from 'node:assert/strict'
import test from 'node:test'

import {
  assertAccountMayReceiveServiceMutation,
  assertActiveSuperAdminPreserved,
  assertAdminTargetMutationAllowed,
  assertRoleGrantAllowed
} from './admin-access-policy.js'

test('policy blocks self mutation and non-super-admin grants', () => {
  assert.throws(
    () => assertAdminTargetMutationAllowed({ operatorUserId: 'u1', targetUserId: 'u1', action: 'status' }),
    (error) => error.code === 'SELF_ADMIN_MUTATION_NOT_ALLOWED'
  )
  assert.throws(
    () => assertRoleGrantAllowed({ operatorRoles: ['admin'], targetRoles: ['user'], nextRoles: ['super_admin'] }),
    (error) => error.code === 'FORBIDDEN_SUPER_ADMIN_GRANT'
  )
})

test('policy rejects removal of the last active super admin', () => {
  assert.throws(
    () => assertActiveSuperAdminPreserved({
      targetRoles: ['super_admin'],
      nextRoles: ['admin'],
      targetStatus: 'active',
      nextStatus: 'active',
      activeSuperAdminCount: 1
    }),
    (error) => error.code === 'LAST_SUPER_ADMIN_REQUIRED'
  )
})

test('archived accounts cannot receive service mutations', () => {
  assert.throws(
    () => assertAccountMayReceiveServiceMutation({ status: 'deleted', deletedAt: '2026-07-11T00:00:00Z' }),
    (error) => error.code === 'ARCHIVED_ACCOUNT_IMMUTABLE'
  )
  assert.throws(
    () => assertAccountMayReceiveServiceMutation({ status: 'archiving', deletedAt: null }),
    (error) => error.code === 'ARCHIVED_ACCOUNT_IMMUTABLE'
  )
  assert.throws(
    () => assertAccountMayReceiveServiceMutation({ status: 'suspending', deletedAt: null }),
    (error) => error.code === 'ACCOUNT_MUTATION_IN_PROGRESS'
  )
})

test('a current super_admin may modify another super_admin', () => {
  assert.doesNotThrow(() => assertRoleGrantAllowed({
    operatorRoles: ['super_admin'],
    targetRoles: ['super_admin'],
    nextRoles: ['super_admin', 'admin']
  }))
})
