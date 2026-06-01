import assert from 'node:assert/strict'
import { mock, test } from 'node:test'

import { supabase } from '../config/supabase.js'
import { deleteUserAccount, updateUserRoles, updateUserStatus } from './admin-user-management.js'

const roles = [
  { id: 'role-user', code: 'user' },
  { id: 'role-admin', code: 'admin' },
  { id: 'role-super', code: 'super_admin' }
]

const createQuery = ({ table, calls, responseFor }) => {
  const state = { table, op: 'select', columns: '', filters: [], payload: null }

  const query = {
    select(columns) {
      state.op = 'select'
      state.columns = columns
      calls.push([table, 'select', columns])
      return this
    },
    eq(column, value) {
      state.filters.push([column, value])
      calls.push([table, 'eq', column, value])
      return this
    },
    delete() {
      state.op = 'delete'
      calls.push([table, 'delete'])
      return this
    },
    insert(payload) {
      state.op = 'insert'
      state.payload = payload
      calls.push([table, 'insert', payload])
      return Promise.resolve(responseFor(state))
    },
    update(payload) {
      state.op = 'update'
      state.payload = payload
      calls.push([table, 'update', payload])
      return this
    },
    maybeSingle() {
      calls.push([table, 'maybeSingle'])
      return Promise.resolve(responseFor({ ...state, single: 'maybe' }))
    },
    single() {
      calls.push([table, 'single'])
      return Promise.resolve(responseFor({ ...state, single: 'single' }))
    },
    then(resolve, reject) {
      return Promise.resolve(responseFor(state)).then(resolve, reject)
    }
  }

  return query
}

test('updateUserRoles replaces target roles and writes an admin audit log', async () => {
  const calls = []
  const restore = mock.method(supabase, 'from', (table) => createQuery({
    table,
    calls,
    responseFor: (state) => {
      if (table === 'roles') return { data: roles, error: null }
      if (table === 'user_roles' && state.op === 'select') return { data: [{ role_id: 'role-user' }], error: null }
      if (table === 'user_roles') return { data: null, error: null }
      if (table === 'users') return { data: { id: 'user-1', email: 'user@example.com' }, error: null }
      if (table === 'admin_operation_logs') return { data: null, error: null }
      assert.fail(`Unexpected table ${table}`)
    }
  }))

  try {
    const result = await updateUserRoles({
      operatorUserId: 'admin-1',
      operatorRoles: ['admin'],
      targetUserId: 'user-1',
      roleCodes: ['admin', 'user', 'admin'],
      ip: '127.0.0.1',
      userAgent: 'node-test'
    })

    assert.deepEqual(result, {
      ok: true,
      user: { id: 'user-1', email: 'user@example.com' },
      beforeRoles: ['user'],
      roles: ['admin', 'user']
    })
    assert.deepEqual(calls.filter((call) => call[0] === 'user_roles' && ['delete', 'insert'].includes(call[1])), [
      ['user_roles', 'delete'],
      ['user_roles', 'insert', [
        { user_id: 'user-1', role_id: 'role-admin', created_by: 'admin-1' },
        { user_id: 'user-1', role_id: 'role-user', created_by: 'admin-1' }
      ]]
    ])
    assert.deepEqual(calls.find((call) => call[0] === 'admin_operation_logs' && call[1] === 'insert'), [
      'admin_operation_logs',
      'insert',
      {
        operator_user_id: 'admin-1',
        target_user_id: 'user-1',
        action: 'admin.user.role.update',
        metadata: {
          beforeRoles: ['user'],
          afterRoles: ['admin', 'user'],
          ip: '127.0.0.1',
          userAgent: 'node-test'
        }
      }
    ])
  } finally {
    restore.mock.restore()
  }
})

test('updateUserStatus blocks non-super admins from modifying a super admin account', async () => {
  const calls = []
  const restore = mock.method(supabase, 'from', (table) => createQuery({
    table,
    calls,
    responseFor: (state) => {
      if (table === 'users') return { data: { id: 'super-1', email: 'super@example.com', status: 'active', deleted_at: null }, error: null }
      if (table === 'roles') return { data: roles, error: null }
      if (table === 'user_roles') return { data: [{ role_id: 'role-super' }], error: null }
      assert.fail(`Unexpected table ${table}`)
    }
  }))

  try {
    await assert.rejects(
      () => updateUserStatus({
        operatorUserId: 'admin-1',
        operatorRoles: ['admin'],
        targetUserId: 'super-1',
        status: 'suspended'
      }),
      (error) => error.status === 403 && error.code === 'FORBIDDEN_SUPER_ADMIN_EDIT'
    )
    assert.equal(calls.some((call) => call[0] === 'users' && call[1] === 'update'), false)
  } finally {
    restore.mock.restore()
  }
})

test('deleteUserAccount rejects self deletion before database queries', async () => {
  const restore = mock.method(supabase, 'from', (table) => {
    assert.fail(`Unexpected table ${table}`)
  })

  try {
    await assert.rejects(
      () => deleteUserAccount({
        operatorUserId: 'user-1',
        operatorRoles: ['super_admin'],
        targetUserId: 'user-1'
      }),
      (error) => error.status === 400 && error.code === 'SELF_DELETE_NOT_ALLOWED'
    )
  } finally {
    restore.mock.restore()
  }
})
