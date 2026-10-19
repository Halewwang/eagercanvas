import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { mock, test } from 'node:test'

import { supabase } from '../config/supabase.js'
import { deleteUserAccount, restoreUserAccount, updateUserRoles, updateUserStatus } from './admin-user-management.js'

const source = readFileSync(new URL('./admin-user-management.js', import.meta.url), 'utf8')
const migrationSource = readFileSync(new URL('../../../supabase/016_admin_rbac_lifecycle.sql', import.meta.url), 'utf8')
const recoverySource = readFileSync(new URL('../../../docs/ADMIN_LIFECYCLE_RECOVERY.md', import.meta.url), 'utf8')

const roles = [
  { id: 'role-user', code: 'user' },
  { id: 'role-admin', code: 'admin' },
  { id: 'role-super', code: 'super_admin' }
]

const createQuery = ({ table, calls, responseFor }) => {
  const state = { table, op: 'select', columns: '', options: null, filters: [], payload: null }

  const query = {
    select(columns, options) {
      state.op = 'select'
      state.columns = columns
      state.options = options || null
      calls.push([table, 'select', columns, ...(options ? [options] : [])])
      return this
    },
    eq(column, value) {
      state.filters.push([column, value])
      calls.push([table, 'eq', column, value])
      return this
    },
    in(column, values) {
      state.filters.push([column, values])
      calls.push([table, 'in', column, values])
      return this
    },
    is(column, value) {
      state.filters.push([column, value])
      calls.push([table, 'is', column, value])
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

test('updateUserRoles delegates role replacement and audit to one atomic RPC', async () => {
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
  const restoreRpc = mock.method(supabase, 'rpc', async (name, params) => {
    calls.push(['rpc', name, params])
    return { data: null, error: null }
  })

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
    const rpcCall = calls.find((call) => call[0] === 'rpc')
    assert.equal(rpcCall[1], 'admin_replace_user_roles_atomic')
    assert.equal(rpcCall[2].p_target_user_id, 'user-1')
    assert.deepEqual(rpcCall[2].p_role_codes, ['admin', 'user'])
    assert.equal(rpcCall[2].p_operator_user_id, 'admin-1')
    assert.match(rpcCall[2].p_operation_token, /^[0-9a-f-]{36}$/)
    assert.deepEqual(rpcCall[2].p_audit_metadata, {
      reason: '', ip: '127.0.0.1', userAgent: 'node-test', requestId: ''
    })
    assert.equal(calls.some((call) => call[0] === 'admin_operation_logs'), false)
  } finally {
    restore.mock.restore()
    restoreRpc.mock.restore()
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

test('deleteUserAccount rejects self mutation before database queries', async () => {
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
      (error) => error.status === 400 && error.code === 'SELF_ADMIN_MUTATION_NOT_ALLOWED'
    )
  } finally {
    restore.mock.restore()
  }
})

test('deleteUserAccount requires super_admin before database queries', async () => {
  const restore = mock.method(supabase, 'from', (table) => {
    assert.fail(`Unexpected table ${table}`)
  })

  try {
    await assert.rejects(
      () => deleteUserAccount({
        operatorUserId: 'admin-1',
        operatorRoles: ['admin'],
        targetUserId: 'user-1'
      }),
      (error) => error.status === 403 && error.code === 'FORBIDDEN_USER_ARCHIVE'
    )
  } finally {
    restore.mock.restore()
  }
})

test('lifecycle mutations are wired to service-role-only locking RPCs', () => {
  assert.match(source, /rpc\('admin_replace_user_roles_atomic'/)
  assert.match(source, /rpc\('admin_update_user_status_atomic'/)
  assert.match(source, /rpc\('admin_archive_user_atomic'/)
  assert.match(source, /rpc\('admin_restore_user_atomic'/)
  assert.match(source, /rpc\('admin_prepare_user_archive_atomic'/)
  assert.match(source, /rpc\('admin_abort_user_archive_atomic'/)
  assert.match(migrationSource, /create or replace function public\.admin_replace_user_roles_atomic/i)
  assert.match(migrationSource, /create or replace function public\.admin_update_user_status_atomic/i)
  assert.match(migrationSource, /create or replace function public\.admin_sanitize_audit_text/i)
  assert.match(migrationSource, /create or replace function public\.admin_sanitize_audit_context/i)
  assert.match(migrationSource, /create or replace function public\.admin_archive_user_atomic/i)
  assert.match(migrationSource, /create or replace function public\.admin_restore_user_atomic/i)
  assert.match(migrationSource, /create or replace function public\.admin_prepare_user_archive_atomic/i)
  assert.match(migrationSource, /create or replace function public\.admin_abort_user_archive_atomic/i)
  assert.match(migrationSource, /create or replace function public\.admin_mark_archive_provider_revoking/i)
  assert.match(migrationSource, /create or replace function public\.admin_mark_archive_provider_revoked/i)
  assert.match(migrationSource, /create or replace function public\.admin_mark_archive_projects_transferred/i)
  assert.match(migrationSource, /create or replace function public\.admin_recover_account_mutation/i)
  assert.match(migrationSource, /create or replace function public\.admin_begin_service_mutation/i)
  assert.match(migrationSource, /create or replace function public\.admin_end_service_mutation/i)
  assert.match(migrationSource, /archive_token uuid/i)
  assert.match(migrationSource, /archive_event_id uuid/i)
  assert.match(migrationSource, /archive_project_transfer jsonb/i)
  assert.match(migrationSource, /archive_audit_metadata jsonb/i)
  assert.match(migrationSource, /restore_event_id uuid/i)
  assert.match(migrationSource, /restore_audit_metadata jsonb/i)
  assert.match(migrationSource, /operation_token uuid/i)
  assert.match(migrationSource, /service_mutation_token uuid/i)
  assert.match(migrationSource, /users_status_check check \(status in \('active', 'suspended', 'suspending', 'archiving', 'deleted'\)\)/i)
  assert.match(migrationSource, /archive_phase[^\n]+prepared[^\n]+provider_revoking[^\n]+provider_revoked[^\n]+projects_transferred/i)
  assert.match(migrationSource, /p_operator_user_id uuid[\s\S]+FORBIDDEN_SUPER_ADMIN_EDIT/i)
  assert.match(migrationSource, /FORBIDDEN_SUPER_ADMIN_GRANT/i)
  assert.match(migrationSource, /FORBIDDEN_USER_ARCHIVE/i)
  assert.match(migrationSource, /drop function if exists public\.admin_prepare_user_archive_atomic\(uuid\)/i)
  assert.match(migrationSource, /drop function if exists public\.admin_archive_user_atomic\(uuid, uuid, timestamptz\)/i)
  assert.match(migrationSource, /drop function if exists public\.admin_abort_user_archive_atomic\(uuid\)/i)
  assert.match(migrationSource, /for update/i)
  assert.match(migrationSource, /revoke execute on function public\.admin_archive_user_atomic[^;]+ from public, anon, authenticated/i)
  assert.match(migrationSource, /grant execute on function public\.admin_archive_user_atomic[^;]+ to service_role/i)
  assert.match(migrationSource, /revoke execute on function public\.admin_restore_user_atomic[^;]+ from public, anon, authenticated/i)
  assert.match(migrationSource, /grant execute on function public\.admin_restore_user_atomic[^;]+ to service_role/i)
  assert.match(recoverySource, /abort_pre_provider_archive/)
  assert.match(recoverySource, /clear_service_lease/)
  assert.match(recoverySource, /expected token/i)

  const finalRpcSource = migrationSource.slice(
    migrationSource.indexOf('create or replace function public.admin_archive_user_atomic'),
    migrationSource.indexOf('create or replace function public.admin_restore_user_atomic')
  )
  const prepareRpcSource = migrationSource.slice(
    migrationSource.indexOf('create or replace function public.admin_prepare_user_archive_atomic'),
    migrationSource.indexOf('create or replace function public.admin_mark_archive_provider_revoking')
  )
  assert.match(finalRpcSource, /update public\.sessions[\s\S]+set revoked = true/i)
  assert.match(finalRpcSource, /delete from public\.user_api_key_assignments/i)
  assert.match(finalRpcSource, /insert into public\.admin_operation_logs/i)
  assert.match(finalRpcSource, /update public\.admin_operation_logs[\s\S]+set operation_token/i)
  assert.match(finalRpcSource, /archive_previous_status/i)
  assert.match(finalRpcSource, /archive_project_transfer/i)
  assert.match(finalRpcSource, /operation_token/i)
  assert.match(prepareRpcSource, /v_safe_audit_metadata := public\.admin_sanitize_audit_context\(p_audit_metadata\)/i)
  assert.match(prepareRpcSource, /archive_event_id = coalesce\(archive_event_id, p_archive_token\)[\s\S]+archive_audit_metadata = public\.admin_sanitize_audit_context\(/i)
  assert.match(finalRpcSource, /v_effective_audit_metadata := public\.admin_sanitize_audit_context\(/i)
  assert.equal((finalRpcSource.match(/'reason', coalesce\(v_effective_audit_metadata->>'reason', ''\)/g) || []).length, 2)
  assert.equal((finalRpcSource.match(/on conflict \(action, operation_token\)[\s\S]*?do nothing/g) || []).length, 2)

  const restoreRpcSource = migrationSource.slice(
    migrationSource.indexOf('create or replace function public.admin_restore_user_atomic'),
    migrationSource.indexOf('create or replace function public.admin_abort_user_archive_atomic')
  )
  assert.match(restoreRpcSource, /security definer/i)
  assert.match(restoreRpcSource, /from public\.users[\s\S]+for update/i)
  assert.match(restoreRpcSource, /from public\.user_roles[\s\S]+p_operator_user_id/i)
  assert.match(restoreRpcSource, /FORBIDDEN_USER_RESTORE/i)
  assert.match(restoreRpcSource, /ACCOUNT_NOT_ARCHIVED/i)
  assert.match(restoreRpcSource, /restore_event_id/i)
  assert.match(restoreRpcSource, /update public\.users[\s\S]+status = 'suspended'/i)
  assert.match(restoreRpcSource, /insert into public\.admin_operation_logs/i)
  assert.match(restoreRpcSource, /'admin\.user\.restore'/i)
  assert.match(restoreRpcSource, /'reason', coalesce\(v_effective_audit_metadata->>'reason', ''\)/i)
  assert.match(restoreRpcSource, /on conflict \(action, operation_token\)[\s\S]*?do nothing/i)
  assert.doesNotMatch(restoreRpcSource, /user_service_credentials/i)
})

const createArchiveTargetMock = (calls) => mock.method(supabase, 'from', (table) => createQuery({
  table,
  calls,
  responseFor: () => {
    if (table === 'roles') return { data: roles, error: null }
    if (table === 'user_roles') return { data: [{ role_id: 'role-user' }], error: null }
    if (table === 'users') {
      return { data: { id: 'user-1', email: 'user@example.com', status: 'active', deleted_at: null }, error: null }
    }
    if (['sessions', 'user_api_key_assignments', 'admin_operation_logs'].includes(table)) {
      return { data: null, error: null }
    }
    assert.fail(`Unexpected table ${table}`)
  }
}))

test('transfer failure after provider revocation keeps archive resumable without abort', async () => {
  const calls = []
  const restoreFrom = createArchiveTargetMock(calls)
  const transferError = new Error('transfer failed')
  const restoreRpc = mock.method(supabase, 'rpc', async (name) => {
    calls.push(['rpc', name])
    if (name === 'admin_prepare_user_archive_atomic') return { data: 'prepared', error: null }
    return { data: null, error: null }
  })

  try {
    await assert.rejects(
      () => deleteUserAccount({
        operatorUserId: 'super-1', operatorRoles: ['super_admin'], targetUserId: 'user-1'
      }, {
        disableServiceCredential: async () => ({ ok: true }),
        transferProjects: async () => { throw transferError }
      }),
      (error) => error === transferError
    )
    const rpcNames = calls.filter((call) => call[0] === 'rpc').map((call) => call[1])
    assert.deepEqual(rpcNames, [
      'admin_prepare_user_archive_atomic',
      'admin_mark_archive_provider_revoking',
      'admin_mark_archive_provider_revoked'
    ])
    assert.equal(rpcNames.includes('admin_abort_user_archive_atomic'), false)
  } finally {
    restoreFrom.mock.restore()
    restoreRpc.mock.restore()
  }
})

test('local credential persistence failure after provider success does not abort archive', async () => {
  const calls = []
  const restoreFrom = createArchiveTargetMock(calls)
  const persistenceError = Object.assign(new Error('local credential write failed'), {
    code: 'SERVICE_CREDENTIAL_DISABLE_FAILED',
    providerRevoked: true
  })
  const restoreRpc = mock.method(supabase, 'rpc', async (name) => {
    calls.push(['rpc', name])
    if (name === 'admin_prepare_user_archive_atomic') return { data: 'prepared', error: null }
    return { data: null, error: null }
  })

  try {
    await assert.rejects(
      () => deleteUserAccount({
        operatorUserId: 'super-1', operatorRoles: ['super_admin'], targetUserId: 'user-1'
      }, {
        disableServiceCredential: async () => { throw persistenceError }
      }),
      (error) => error === persistenceError
    )
    const rpcNames = calls.filter((call) => call[0] === 'rpc').map((call) => call[1])
    assert.deepEqual(rpcNames, [
      'admin_prepare_user_archive_atomic',
      'admin_mark_archive_provider_revoking'
    ])
    assert.equal(rpcNames.includes('admin_abort_user_archive_atomic'), false)
  } finally {
    restoreFrom.mock.restore()
    restoreRpc.mock.restore()
  }
})

test('finalize failure after provider revocation keeps archive resumable without abort', async () => {
  const calls = []
  const restoreFrom = createArchiveTargetMock(calls)
  const restoreRpc = mock.method(supabase, 'rpc', async (name) => {
    calls.push(['rpc', name])
    if (name === 'admin_prepare_user_archive_atomic') return { data: 'prepared', error: null }
    if (name === 'admin_archive_user_atomic') return { data: null, error: { message: 'finalize failed' } }
    return { data: null, error: null }
  })

  try {
    await assert.rejects(
      () => deleteUserAccount({
        operatorUserId: 'super-1', operatorRoles: ['super_admin'], targetUserId: 'user-1'
      }, {
        disableServiceCredential: async () => ({ ok: true }),
        transferProjects: async () => ({ transferred: 1 })
      }),
      (error) => error.code === 'USER_DELETE_FAILED'
    )
    const rpcNames = calls.filter((call) => call[0] === 'rpc').map((call) => call[1])
    assert.deepEqual(rpcNames.slice(0, 5), [
      'admin_prepare_user_archive_atomic',
      'admin_mark_archive_provider_revoking',
      'admin_mark_archive_provider_revoked',
      'admin_mark_archive_projects_transferred',
      'admin_archive_user_atomic'
    ])
    assert.equal(rpcNames.includes('admin_abort_user_archive_atomic'), false)
  } finally {
    restoreFrom.mock.restore()
    restoreRpc.mock.restore()
  }
})

test('authorized retry rotates the worker token while forwarding the same trimmed archive reason', async () => {
  const calls = []
  let phase = 'prepared'
  let disableCalls = 0
  let transferCalls = 0
  const restoreFrom = createArchiveTargetMock(calls)
  const restoreRpc = mock.method(supabase, 'rpc', async (name, params) => {
    calls.push(['rpc', name, params])
    if (name === 'admin_prepare_user_archive_atomic') return { data: phase, error: null }
    if (name === 'admin_mark_archive_provider_revoking') { phase = 'provider_revoking'; return { data: null, error: null } }
    if (name === 'admin_mark_archive_provider_revoked') { phase = 'provider_revoked'; return { data: null, error: null } }
    if (name === 'admin_mark_archive_projects_transferred') { phase = 'projects_transferred'; return { data: null, error: null } }
    return { data: null, error: null }
  })
  const args = {
    operatorUserId: 'super-1',
    operatorRoles: ['super_admin'],
    targetUserId: 'user-1',
    reason: '  Policy violation  '
  }
  const deps = {
    disableServiceCredential: async () => { disableCalls += 1; return { ok: true } },
    transferProjects: async () => {
      transferCalls += 1
      if (transferCalls === 1) throw new Error('temporary transfer failure')
      return { transferred: 1 }
    }
  }

  try {
    await assert.rejects(() => deleteUserAccount(args, deps), /temporary transfer failure/)
    const result = await deleteUserAccount(args, deps)
    assert.deepEqual(result, { ok: true })
    assert.equal(disableCalls, 1)
    assert.equal(transferCalls, 2)
    const prepareCalls = calls.filter((call) => call[0] === 'rpc' && call[1] === 'admin_prepare_user_archive_atomic')
    assert.equal(prepareCalls.length, 2)
    assert.notEqual(prepareCalls[0][2].p_archive_token, prepareCalls[1][2].p_archive_token)
    assert.equal(prepareCalls[0][2].p_audit_metadata.reason, 'Policy violation')
    assert.equal(prepareCalls[1][2].p_audit_metadata.reason, 'Policy violation')
  } finally {
    restoreFrom.mock.restore()
    restoreRpc.mock.restore()
  }
})

test('uncertain provider failure leaves a non-abortable resumable archive', async () => {
  const calls = []
  const providerError = Object.assign(new Error('provider revoke failed'), { code: 'SERVICE_CREDENTIAL_REVOKE_FAILED' })
  const restoreFrom = mock.method(supabase, 'from', (table) => createQuery({
    table,
    calls,
    responseFor: (state) => {
      if (table === 'roles') return { data: roles, error: null }
      if (table === 'user_roles') return { data: [{ role_id: 'role-user' }], error: null }
      if (table === 'users') {
        return { data: { id: 'user-1', email: 'user@example.com', status: 'active', deleted_at: null }, error: null }
      }
      assert.fail(`Unexpected table ${table}`)
    }
  }))
  const restoreRpc = mock.method(supabase, 'rpc', async (name) => {
    calls.push(['rpc', name])
    if (name === 'admin_prepare_user_archive_atomic') return { data: 'prepared', error: null }
    return { data: null, error: null }
  })

  try {
    await assert.rejects(
      () => deleteUserAccount({
        operatorUserId: 'super-1',
        operatorRoles: ['super_admin'],
        targetUserId: 'user-1'
      }, {
        disableServiceCredential: async (args) => {
          calls.push(['disable', args])
          throw providerError
        }
      }),
      (error) => error === providerError
    )
    assert.deepEqual(calls.filter((call) => call[0] === 'rpc').map((call) => call[1]), [
      'admin_prepare_user_archive_atomic',
      'admin_mark_archive_provider_revoking'
    ])
    assert.equal(calls.some((call) => call[0] === 'rpc' && call[1] === 'admin_abort_user_archive_atomic'), false)
    assert.equal(calls.some((call) => call[0] === 'rpc' && call[1] === 'admin_archive_user_atomic'), false)
    assert.equal(calls.some((call) => call[0] === 'users' && call[1] === 'update'), false)
  } finally {
    restoreFrom.mock.restore()
    restoreRpc.mock.restore()
  }
})

test('retry resumes provider-revoking phase after an uncertain provider result', async () => {
  const calls = []
  let phase = 'prepared'
  let disableCalls = 0
  const restoreFrom = createArchiveTargetMock(calls)
  const restoreRpc = mock.method(supabase, 'rpc', async (name) => {
    calls.push(['rpc', name])
    if (name === 'admin_prepare_user_archive_atomic') return { data: phase, error: null }
    if (name === 'admin_mark_archive_provider_revoking') { phase = 'provider_revoking'; return { data: null, error: null } }
    if (name === 'admin_mark_archive_provider_revoked') { phase = 'provider_revoked'; return { data: null, error: null } }
    if (name === 'admin_mark_archive_projects_transferred') { phase = 'projects_transferred'; return { data: null, error: null } }
    return { data: null, error: null }
  })
  const args = { operatorUserId: 'super-1', operatorRoles: ['super_admin'], targetUserId: 'user-1' }
  const deps = {
    disableServiceCredential: async () => {
      disableCalls += 1
      if (disableCalls === 1) throw new Error('provider response timed out')
      return { ok: true }
    },
    transferProjects: async () => ({ transferred: 1 })
  }

  try {
    await assert.rejects(() => deleteUserAccount(args, deps), /provider response timed out/)
    assert.equal(phase, 'provider_revoking')
    const result = await deleteUserAccount(args, deps)
    assert.deepEqual(result, { ok: true })
    assert.equal(disableCalls, 2)
    assert.equal(calls.some((call) => call[0] === 'rpc' && call[1] === 'admin_abort_user_archive_atomic'), false)
  } finally {
    restoreFrom.mock.restore()
    restoreRpc.mock.restore()
  }
})

test('committed final RPC response loss is reconciled without JS cleanup or duplicate audit', async () => {
  const calls = []
  let targetReads = 0
  let finalizeCalls = 0
  const restoreFrom = mock.method(supabase, 'from', (table) => createQuery({
    table,
    calls,
    responseFor: () => {
      if (table === 'roles') return { data: roles, error: null }
      if (table === 'user_roles') return { data: [{ role_id: 'role-user' }], error: null }
      if (table === 'users') {
        targetReads += 1
        return {
          data: targetReads === 1
            ? { id: 'user-1', email: 'user@example.com', status: 'active', deleted_at: null }
            : { id: 'user-1', email: 'user@example.com', status: 'deleted', deleted_at: '2026-07-11T00:00:00.000Z' },
          error: null
        }
      }
      assert.fail(`Unexpected post-finalization table ${table}`)
    }
  }))
  const restoreRpc = mock.method(supabase, 'rpc', async (name, params) => {
    calls.push(['rpc', name, params])
    if (name === 'admin_prepare_user_archive_atomic') return { data: 'prepared', error: null }
    if (name === 'admin_archive_user_atomic') {
      finalizeCalls += 1
      if (finalizeCalls === 1) return { data: null, error: { message: 'response lost after commit' } }
    }
    return { data: null, error: null }
  })
  const args = {
    operatorUserId: 'super-1', operatorRoles: ['super_admin'], targetUserId: 'user-1',
    ip: '127.0.0.1', userAgent: 'node-test'
  }
  const deps = {
    disableServiceCredential: async () => ({ ok: true }),
    transferProjects: async () => ({ transferredProjectCount: 0, transfers: [] })
  }

  try {
    await assert.rejects(() => deleteUserAccount(args, deps), (error) => error.code === 'USER_DELETE_FAILED')
    const retried = await deleteUserAccount(args, deps)
    assert.deepEqual(retried, { ok: true, alreadyDeleted: true })
    assert.equal(finalizeCalls, 2)
    assert.equal(calls.some((call) => ['sessions', 'user_api_key_assignments', 'admin_operation_logs'].includes(call[0])), false)
  } finally {
    restoreFrom.mock.restore()
    restoreRpc.mock.restore()
  }
})

test('archive RPC receives bounded audit context and persists project transfer context before finalization', async () => {
  const calls = []
  const restoreFrom = createArchiveTargetMock(calls)
  const projectTransfer = {
    transferredProjectCount: 1,
    transfers: [{ workspaceId: 'workspace-1', fromUserId: 'user-1', toUserId: 'super-1', projectIds: ['project-1'] }]
  }
  const restoreRpc = mock.method(supabase, 'rpc', async (name, params) => {
    calls.push(['rpc', name, params])
    if (name === 'admin_prepare_user_archive_atomic') return { data: 'prepared', error: null }
    return { data: null, error: null }
  })

  try {
    const result = await deleteUserAccount({
      operatorUserId: 'super-1', operatorRoles: ['super_admin'], targetUserId: 'user-1',
      reason: `  password=archive-secret ${'r'.repeat(600)}  `,
      ip: '127.0.0.1 token=archive-ip-secret',
      userAgent: 'node-test Bearer archive-ua-secret'
    }, {
      disableServiceCredential: async () => ({ ok: true }),
      transferProjects: async () => projectTransfer
    })
    assert.deepEqual(result, { ok: true })
    const prepareCall = calls.find((call) => call[0] === 'rpc' && call[1] === 'admin_prepare_user_archive_atomic')
    assert.deepEqual(prepareCall[2].p_audit_metadata, {
      reason: `password=[redacted] ${'r'.repeat(480)}`,
      ip: '127.0.0.1 token=[redacted]',
      userAgent: 'node-test Bearer [redacted]',
      requestId: ''
    })
    assert.doesNotMatch(JSON.stringify(calls), /archive-secret|archive-ip-secret|archive-ua-secret/)
    const projectCall = calls.find((call) => call[0] === 'rpc' && call[1] === 'admin_mark_archive_projects_transferred')
    assert.deepEqual(projectCall[2].p_project_transfer, projectTransfer)

    const deleteSource = source.slice(
      source.indexOf('export const deleteUserAccount'),
      source.indexOf('export const restoreUserAccount')
    )
    assert.doesNotMatch(deleteSource, /from\('sessions'\)/)
    assert.doesNotMatch(deleteSource, /removeApiKeyAssignmentsForUser/)
    assert.doesNotMatch(deleteSource, /createAdminLog/)
    assert.match(source, /const finalizeUserArchiveAtomic[\s\S]+finally\s*\{[\s\S]*invalidateUserAuthzCache/)
  } finally {
    restoreFrom.mock.restore()
    restoreRpc.mock.restore()
  }
})

for (const mutation of [
  {
    name: 'role replacement',
    run: () => updateUserRoles({
      operatorUserId: 'super-2',
      operatorRoles: ['super_admin'],
      targetUserId: 'super-1',
      roleCodes: ['admin']
    })
  },
  {
    name: 'suspension',
    run: () => updateUserStatus({
      operatorUserId: 'super-2',
      operatorRoles: ['super_admin'],
      targetUserId: 'super-1',
      status: 'suspended'
    })
  },
  {
    name: 'archival',
    run: (deps) => deleteUserAccount({
      operatorUserId: 'super-2',
      operatorRoles: ['super_admin'],
      targetUserId: 'super-1'
    }, deps)
  }
]) {
  test(`${mutation.name} rejects removal of the last active super admin before mutation`, async () => {
    const calls = []
    let disableCalls = 0
    let transferCalls = 0
    const restore = mock.method(supabase, 'from', (table) => createQuery({
      table,
      calls,
      responseFor: (state) => {
        if (table === 'roles' && state.single === 'maybe') return { data: { id: 'role-super' }, error: null }
        if (table === 'roles') return { data: roles, error: null }
        if (table === 'user_roles' && state.columns === 'role_id') {
          return { data: [{ role_id: 'role-super' }], error: null }
        }
        if (table === 'user_roles' && state.columns === 'user_id') {
          return { data: [{ user_id: 'super-1' }], error: null }
        }
        if (table === 'users' && state.options?.head) return { data: null, count: 1, error: null }
        if (table === 'users') {
          return {
            data: { id: 'super-1', email: 'super@example.com', status: 'active', deleted_at: null },
            error: null
          }
        }
        assert.fail(`Unexpected table ${table}`)
      }
    }))
    const restoreRpc = mock.method(supabase, 'rpc', async () => ({
      data: null,
      error: { message: 'LAST_SUPER_ADMIN_REQUIRED' }
    }))

    try {
      await assert.rejects(
        () => mutation.run({
          disableServiceCredential: async () => { disableCalls += 1; return { ok: true } },
          transferProjects: async () => { transferCalls += 1; return null }
        }),
        (error) => error.status === 409 && error.code === 'LAST_SUPER_ADMIN_REQUIRED'
      )
      assert.equal(calls.some((call) => call[1] === 'update' || call[1] === 'delete' || call[1] === 'insert'), false)
      if (mutation.name === 'archival') {
        assert.equal(disableCalls, 0)
        assert.equal(transferCalls, 0)
      }
    } finally {
      restore.mock.restore()
      restoreRpc.mock.restore()
    }
  })
}

test('restoreUserAccount delegates sanitized restoration and audit to one atomic RPC', async () => {
  const calls = []
  const restoreFrom = mock.method(supabase, 'from', (table) => assert.fail(`Unexpected non-atomic table ${table}`))
  const restoreRpc = mock.method(supabase, 'rpc', async (name, params) => {
    calls.push([name, params])
    assert.equal(name, 'admin_restore_user_atomic')
    return {
      data: {
        id: 'user-1', email: 'user@example.com', status: 'suspended',
        suspended_at: '2026-07-11T01:00:00.000Z', suspended_reason: 'Appeal [redacted]',
        deleted_at: null, already_restored: false
      },
      error: null
    }
  })

  try {
    const result = await restoreUserAccount({
      operatorUserId: 'super-1',
      operatorRoles: ['super_admin'],
      targetUserId: 'user-1',
      reason: 'Appeal password=approved-secret',
      ip: '127.0.0.1 token=ip-secret',
      userAgent: 'Admin Browser Bearer ua-secret'
    })
    assert.equal(result.user.status, 'suspended')
    assert.equal(result.user.deletedAt, null)
    assert.equal(result.alreadyRestored, false)
    assert.match(calls[0][1].p_restore_token, /^[0-9a-f-]{36}$/)
    assert.deepEqual(calls[0][1].p_audit_metadata, {
      reason: 'Appeal password=[redacted]',
      ip: '127.0.0.1 token=[redacted]',
      userAgent: 'Admin Browser Bearer [redacted]',
      requestId: ''
    })
    assert.doesNotMatch(JSON.stringify(calls), /approved-secret|ip-secret|ua-secret/)
  } finally {
    restoreFrom.mock.restore()
    restoreRpc.mock.restore()
  }
})

test('restoreUserAccount keeps fast service authorization before the atomic RPC', async () => {
  const restoreFrom = mock.method(supabase, 'from', (table) => assert.fail(`Unexpected table ${table}`))
  const restoreRpc = mock.method(supabase, 'rpc', (name) => assert.fail(`Unexpected RPC ${name}`))
  try {
    await assert.rejects(
      () => restoreUserAccount({
        operatorUserId: 'admin-1', operatorRoles: ['admin'], targetUserId: 'user-1', reason: 'Appeal approved'
      }),
      (error) => error.status === 403 && error.code === 'FORBIDDEN_USER_RESTORE'
    )
  } finally {
    restoreFrom.mock.restore()
    restoreRpc.mock.restore()
  }
})

test('restoreUserAccount retries a committed response loss with a new worker token', async () => {
  const calls = []
  let attempts = 0
  const restoreFrom = mock.method(supabase, 'from', (table) => assert.fail(`Unexpected non-atomic table ${table}`))
  const restoreRpc = mock.method(supabase, 'rpc', async (name, params) => {
    calls.push([name, params])
    attempts += 1
    if (attempts === 1) return { data: null, error: { message: 'response lost after commit' } }
    return {
      data: {
        id: 'user-1', email: 'user@example.com', status: 'suspended',
        suspended_at: '2026-07-11T01:00:00.000Z', suspended_reason: 'Appeal approved',
        deleted_at: null, already_restored: true
      },
      error: null
    }
  })
  const args = {
    operatorUserId: 'super-1', operatorRoles: ['super_admin'], targetUserId: 'user-1', reason: 'Appeal approved'
  }

  try {
    await assert.rejects(() => restoreUserAccount(args), (error) => error.code === 'USER_RESTORE_FAILED')
    const retried = await restoreUserAccount(args)
    assert.equal(retried.alreadyRestored, true)
    assert.equal(calls.length, 2)
    assert.notEqual(calls[0][1].p_restore_token, calls[1][1].p_restore_token)
  } finally {
    restoreFrom.mock.restore()
    restoreRpc.mock.restore()
  }
})

test('admin user suspension and deletion trigger team project ownership transfer', () => {
  assert.match(source, /transferSuspendedUserTeamProjects/)
  assert.match(source, /projectOwnershipTransfer/)
  assert.match(source, /reason:\s*auditMetadata\.reason/)
  assert.match(source, /reason:\s*'account deleted'/)
})

test('archival invokes strict service credential revocation before the atomic archive RPC', () => {
  const deleteSource = source.slice(source.indexOf('export const deleteUserAccount'))
  const prepareRpcIndex = deleteSource.indexOf("rpc('admin_prepare_user_archive_atomic'")
  const disableIndex = deleteSource.lastIndexOf('lifecycleMutation: true')
  const archiveRpcIndex = deleteSource.indexOf('await finalizeUserArchiveAtomic', disableIndex)

  assert.ok(prepareRpcIndex >= 0)
  assert.ok(disableIndex >= 0)
  assert.ok(archiveRpcIndex >= 0)
  assert.ok(prepareRpcIndex < disableIndex)
  assert.ok(disableIndex < archiveRpcIndex)
  assert.match(deleteSource, /lifecycleMutation:\s*true/)
})
