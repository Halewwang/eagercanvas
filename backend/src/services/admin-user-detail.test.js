import assert from 'node:assert/strict'
import test from 'node:test'
import { buildAdminUserDetail, getAdminUserDetail } from './admin-user-detail.js'

const createClient = ({ missing = false, errorTable = '' } = {}) => {
  const calls = []
  const values = {
    users: missing ? null : { id: 'u1', email: 'u1@example.com', status: 'active' },
    user_profiles: { display_name: 'Ada' },
    user_roles: [{ roles: { code: 'user' } }],
    user_service_credentials: [{ id: 'service-1', status: 'active', api_key_encrypted: 'secret', last_error: 'raw-error' }]
  }
  const client = { from(table) {
    assert.ok(Object.hasOwn(values, table), `Unexpected table ${table}`)
    const state = { table }
    calls.push(state)
    const result = () => ({ data: values[table], error: table === errorTable ? { message: 'unavailable' } : null })
    return {
      select(columns) { state.columns = columns; return this }, eq() { return this }, order() { return this },
      maybeSingle() { return Promise.resolve(result()) },
      then(resolve, reject) { return Promise.resolve(result()).then(resolve, reject) }
    }
  } }
  return { client, calls }
}

test('detail contains only account, role and service status data', () => {
  const detail = buildAdminUserDetail({
    user: { id: 'u1', email: 'u1@example.com', status: 'suspended', suspended_reason: 'review' },
    profile: { display_name: 'Ada' }, roles: ['user', 'admin', 'user'],
    credentials: [{ id: 'c1', status: 'active', api_key_encrypted: 'secret', provider_api_name: 'provider' }],
    assignments: [{ api_name: 'legacy' }], snapshots: [{ total_amount: 42 }]
  })
  assert.deepEqual(detail.roles, ['admin', 'user'])
  assert.equal(detail.status, 'suspended')
  assert.equal(detail.suspendedReason, 'review')
  assert.equal(detail.service.serviceStatus, 'active')
  assert.doesNotMatch(JSON.stringify(detail), /secret|legacy|provider|officialUsage|reconciliation|assignments|apiKey/)
})

test('detail queries four local identity/service tables with no key, billing, or provider fields', async () => {
  const state = createClient()
  const detail = await getAdminUserDetail('u1', state)
  assert.equal(detail.displayName, 'Ada')
  assert.equal(detail.service.serviceStatus, 'active')
  assert.equal(state.calls.length, 4)
  assert.doesNotMatch(state.calls.find((call) => call.table === 'user_service_credentials').columns, /provider|api_key|last_error|\*/)
  assert.doesNotMatch(JSON.stringify(detail), /secret|raw-error/)
})

test('missing users and database errors fail explicitly', async () => {
  await assert.rejects(getAdminUserDetail('u1', createClient({ missing: true })), { status: 404, code: 'TARGET_USER_NOT_FOUND' })
  await assert.rejects(getAdminUserDetail('u1', createClient({ errorTable: 'user_roles' })), { status: 500, code: 'ADMIN_USER_DETAIL_QUERY_FAILED' })
  await assert.rejects(getAdminUserDetail(''), { status: 400, code: 'INVALID_TARGET_USER' })
})
