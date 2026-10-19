import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createUserServiceCredential,
  disableUserServiceCredential,
  formatServiceCredentialForAdmin,
  getUserServiceStatus,
  resolveActiveUserServiceAccess
} from './service-access.service.js'

const harness = ({ status = 'active', deletedAt = null, credentials = [], errorTable = '', leaseError = null } = {}) => {
  const calls = []
  const rows = credentials.map((row) => ({ user_id: 'user-1', ...row }))
  const client = {
    async rpc(name, params) {
      calls.push({ name, params })
      return { error: name === 'admin_begin_service_mutation' ? leaseError : null }
    },
    from(table) {
      const state = { table, filters: [], operation: 'select' }
      calls.push(state)
      const result = (single = false) => {
        if (table === errorTable) return { error: { message: 'Database unavailable' } }
        let data = table === 'users' ? [{ id: 'user-1', status, deleted_at: deletedAt }] : table === 'user_service_credentials' ? rows : []
        data = data.filter((row) => state.filters.every(([column, value]) => row[column] === value))
        if (state.operation === 'insert') {
          const row = { id: `service-${rows.length + 1}`, created_at: '2026-10-19T00:00:00Z', ...state.payload }
          if (table === 'user_service_credentials') rows.push(row)
          data = [row]
        }
        if (state.operation === 'update') data.forEach((row) => Object.assign(row, state.payload))
        return { data: single ? data[0] || null : data, error: null }
      }
      return {
        select(columns) { state.columns = columns; return this },
        eq(column, value) { state.filters.push([column, value]); return this },
        order() { return this },
        insert(payload) { state.operation = 'insert'; state.payload = payload; return this },
        update(payload) { state.operation = 'update'; state.payload = payload; return this },
        single() { return Promise.resolve(result(true)) },
        maybeSingle() { return Promise.resolve(result(true)) },
        then(resolve, reject) { return Promise.resolve(result()).then(resolve, reject) }
      }
    }
  }
  return { client, calls, rows, deps: { supabaseClient: client } }
}

const mutation = { userId: 'user-1', operatorUserId: 'admin-1', requestId: 'req-1' }

test('service status output exposes no provider, billing, key, or raw error fields', () => {
  const output = formatServiceCredentialForAdmin({
    id: 'service-1', status: 'active', provider_api_name: 'secret-provider-name', api_key_encrypted: 'secret-key',
    api_key_last4: '1234', last_error: 'secret-error', limit_cost: 123, created_at: '2026-10-19T00:00:00Z'
  })
  assert.deepEqual(output, {
    id: 'service-1', serviceStatus: 'active', serviceLabel: '已开通',
    createdAt: '2026-10-19T00:00:00Z', disabledAt: null, deletedAt: null
  })
  assert.equal(formatServiceCredentialForAdmin().serviceStatus, 'not_enabled')
})

test('activation only records shared access and a sanitized audit without creating or reading provider keys', async () => {
  const state = harness()
  const result = await createUserServiceCredential(mutation, {
    ...state.deps,
    createProviderApiKey: () => assert.fail('must not create a provider key'),
    getRuntimeApiKeyByName: () => assert.fail('must not read a provider key')
  })
  assert.equal(result.serviceCredential.serviceStatus, 'active')
  assert.equal(state.rows[0].provider, 'shared')
  assert.equal(state.rows[0].api_key_encrypted, null)
  assert.equal(state.rows[0].api_key_last4, null)
  assert.equal((await resolveActiveUserServiceAccess('user-1', state.deps)).serviceCredentialId, state.rows[0].id)
  assert.deepEqual(state.calls.filter((call) => call.name).map((call) => call.name), ['admin_begin_service_mutation', 'admin_end_service_mutation'])
  const audit = state.calls.find((call) => call.table === 'admin_operation_logs')
  assert.equal(audit.payload.action, 'admin.service_access.activate')
  assert.equal(audit.payload.metadata.requestId, 'req-1')
  assert.doesNotMatch(JSON.stringify(result), /apiKey|limitCost|provider/)
})

test('activation is idempotent and reactivates a paused record without retaining its obsolete user key', async () => {
  const state = harness({ credentials: [{ id: 'legacy-1', status: 'disabled', api_key_encrypted: 'old-secret', api_key_last4: '1234' }] })
  await createUserServiceCredential(mutation, state.deps)
  assert.equal(state.rows.length, 1)
  assert.equal(state.rows[0].api_key_encrypted, null)
  assert.equal(state.rows[0].api_key_last4, null)
  assert.equal(state.rows[0].status, 'active')
  const result = await createUserServiceCredential(mutation, state.deps)
  assert.equal(result.alreadyActive, true)
  assert.equal(state.calls.filter((call) => call.table === 'admin_operation_logs').length, 1)
})

test('service pause is local, audited, serialized, and denies later runtime access', async () => {
  const state = harness({ credentials: [{ id: 'service-1', status: 'active' }] })
  await disableUserServiceCredential({ ...mutation, reason: 'manual pause' }, {
    ...state.deps, updateProviderApiKey: () => assert.fail('must not call upstream management')
  })
  assert.equal(state.rows[0].status, 'disabled')
  await assert.rejects(resolveActiveUserServiceAccess('user-1', state.deps), { code: 'SERVICE_DISABLED', status: 403 })
  assert.deepEqual(state.calls.filter((call) => call.name).map((call) => call.name), ['admin_begin_service_mutation', 'admin_end_service_mutation'])
  assert.equal(state.calls.find((call) => call.table === 'admin_operation_logs').payload.metadata.reason, 'manual pause')
})

test('unopened, paused, deleted, suspended, and transient accounts cannot call any model', async () => {
  const cases = [
    [{}, 'SERVICE_NOT_ENABLED'],
    [{ credentials: [{ id: 'service-1', status: 'disabled' }] }, 'SERVICE_DISABLED'],
    [{ credentials: [{ id: 'service-1', status: 'deleted' }] }, 'SERVICE_DISABLED'],
    [{ status: 'suspended' }, 'ACCOUNT_SUSPENDED'],
    [{ status: 'suspending' }, 'ACCOUNT_SUSPENDED'],
    [{ status: 'archiving' }, 'ACCOUNT_SUSPENDED'],
    [{ status: 'deleted' }, 'ACCOUNT_DELETED'],
    [{ deletedAt: '2026-10-19T00:00:00Z' }, 'ACCOUNT_DELETED']
  ]
  for (const [input, code] of cases) {
    const { deps } = harness(input)
    await assert.rejects(resolveActiveUserServiceAccess('user-1', deps), { code, status: 403 })
  }
  await assert.rejects(resolveActiveUserServiceAccess(''), { code: 'UNAUTHORIZED', status: 401 })
})

test('archiving and deleted users cannot change service directly; lifecycle pause can finish while fenced', async () => {
  for (const status of ['deleted', 'archiving', 'suspending']) {
    const state = harness({ status, credentials: [{ id: 'service-1', status: 'active' }] })
    await assert.rejects(createUserServiceCredential(mutation, state.deps), (error) => ['ARCHIVED_ACCOUNT_IMMUTABLE', 'ACCOUNT_MUTATION_IN_PROGRESS'].includes(error.code))
    await assert.rejects(disableUserServiceCredential(mutation, state.deps), (error) => ['ARCHIVED_ACCOUNT_IMMUTABLE', 'ACCOUNT_MUTATION_IN_PROGRESS'].includes(error.code))
    assert.equal(state.rows[0].status, 'active')
    await disableUserServiceCredential({ ...mutation, lifecycleMutation: true }, state.deps)
    assert.equal(state.rows[0].status, 'disabled')
  }
})

test('lease conflicts and database/audit failures propagate and release reserved leases', async () => {
  const conflict = harness({ leaseError: { message: 'ACCOUNT_MUTATION_IN_PROGRESS' } })
  await assert.rejects(createUserServiceCredential(mutation, conflict.deps), { code: 'ACCOUNT_MUTATION_IN_PROGRESS' })
  assert.equal(conflict.calls.filter((call) => call.table).length, 0)
  for (const table of ['users', 'user_service_credentials', 'admin_operation_logs']) {
    const state = harness({ errorTable: table })
    await assert.rejects(createUserServiceCredential(mutation, state.deps), { status: 500 })
    assert.equal(state.calls.at(-1).name, 'admin_end_service_mutation')
  }
})

test('service status reads remain local and prefer active authorization', async () => {
  const state = harness({ credentials: [{ id: 'failed', status: 'create_failed' }, { id: 'active', status: 'active' }] })
  assert.equal(await getUserServiceStatus('user-1', state.deps), 'active')
  assert.equal(await getUserServiceStatus('', state.deps), 'not_enabled')
  assert.ok(state.calls.every((call) => call.table === 'user_service_credentials'))
})
