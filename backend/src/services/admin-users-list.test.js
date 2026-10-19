import assert from 'node:assert/strict'
import test from 'node:test'

import { listUsersForAdmin } from './admin-users-list.js'

const createQuery = ({ table, calls, responseFor }) => {
  const state = { table, columns: '', options: null, filters: [], range: null }
  const query = {
    select(columns, options) { state.columns = columns; state.options = options || null; calls.push([table, 'select', columns, options]); return this },
    order(column, options) { calls.push([table, 'order', column, options]); return this },
    eq(column, value) { state.filters.push(['eq', column, value]); calls.push([table, 'eq', column, value]); return this },
    in(column, values) { state.filters.push(['in', column, values]); calls.push([table, 'in', column, values]); return this },
    ilike(column, value) { state.filters.push(['ilike', column, value]); calls.push([table, 'ilike', column, value]); return this },
    is(column, value) { state.filters.push(['is', column, value]); calls.push([table, 'is', column, value]); return this },
    range(from, to) { state.range = [from, to]; calls.push([table, 'range', from, to]); return this },
    then(resolve, reject) { return Promise.resolve(responseFor(state)).then(resolve, reject) }
  }
  return query
}

const pageData = {
  users: [{ id: 'u2', email: 'u2@example.com', status: 'active', created_at: '2026-07-01T00:00:00Z' }],
  user_profiles: [{ user_id: 'u2', display_name: 'Ada' }],
  user_roles: [{ user_id: 'u2', roles: { code: 'admin' } }],
  user_service_credentials: [{ id: 'service-2', user_id: 'u2', status: 'active', api_key_encrypted: 'must-not-leak' }]
}

test('list pages registered users and only reads local identity, role and shared service status', async () => {
  const calls = []
  const client = { from: (table) => {
    assert.ok(Object.hasOwn(pageData, table), `Unexpected table ${table}`)
    return createQuery({ table, calls, responseFor: () => ({ data: pageData[table], error: null, count: table === 'users' ? 61 : null }) })
  } }
  const result = await listUsersForAdmin({ page: 2.9, limit: 25.8, status: 'active', search: 'u2@example.com' }, { client })
  assert.deepEqual(result.pagination, { page: 2, limit: 25, total: 61 })
  assert.equal(result.items[0].displayName, 'Ada')
  assert.equal(result.items[0].service.serviceStatus, 'active')
  assert.deepEqual(result.items[0].roles, ['admin'])
  assert.doesNotMatch(JSON.stringify(result), /must-not-leak|officialUsage|assignedApiKeys|reconciliation|apiKey/)
  assert.deepEqual(calls.find((call) => call[0] === 'users' && call[1] === 'range').slice(2), [25, 49])
  for (const table of ['user_profiles', 'user_roles', 'user_service_credentials']) {
    assert.deepEqual(calls.find((call) => call[0] === table && call[1] === 'in').at(-1), ['u2'])
  }
  assert.doesNotMatch(calls.find((call) => call[0] === 'user_service_credentials' && call[1] === 'select')[2], /provider|api_key|last_error|\*/)
})

test('not-enabled service candidates remain independent from suspended account filtering', async () => {
  const calls = []
  const client = { from: (table) => createQuery({ table, calls, responseFor: (state) => {
    if (table === 'users' && state.columns === 'id') return { data: [{ id: 'u1' }, { id: 'u2' }], error: null }
    if (table === 'users') return { data: [{ id: 'u2', status: 'suspended' }], error: null, count: 1 }
    if (table === 'user_service_credentials' && state.columns === 'user_id,status,created_at') return { data: [{ user_id: 'u1', status: 'active' }], error: null }
    return { data: pageData[table] || [], error: null }
  } }) }
  const result = await listUsersForAdmin({ status: 'suspended', serviceStatus: 'not_enabled' }, { client })
  assert.equal(result.items[0].id, 'u2')
  assert.deepEqual(calls.find((call) => call[0] === 'users' && call[1] === 'in' && call[2] === 'id')[3], ['u2'])
})

test('role and service candidate filters intersect before pagination', async () => {
  const calls = []
  const client = { from: (table) => createQuery({ table, calls, responseFor: () => {
    if (table === 'user_roles') return { data: [{ user_id: 'role-user' }], error: null }
    if (table === 'user_service_credentials') return { data: [{ user_id: 'service-user', status: 'active' }], error: null }
    assert.fail(`Empty intersection must not query ${table}`)
  } }) }
  assert.deepEqual(await listUsersForAdmin({ role: 'admin', serviceStatus: 'active' }, { client }), {
    items: [], pagination: { page: 1, limit: 25, total: 0 }
  })
  assert.deepEqual([...new Set(calls.map((call) => call[0]))], ['user_roles', 'user_service_credentials'])
})

test('unsafe pagination and database failures are explicit', async () => {
  await assert.rejects(listUsersForAdmin({ page: 1e308, limit: 100 }, { client: { from: () => assert.fail('invalid pagination must fail before querying') } }), { status: 400, code: 'INVALID_PAGINATION' })
  const client = { from: (table) => createQuery({ table, calls: [], responseFor: () => ({ error: { message: 'unavailable' } }) }) }
  await assert.rejects(listUsersForAdmin({}, { client }), { status: 500, code: 'USERS_QUERY_FAILED' })
})


test('service filters use the same effective grant as the displayed status, including legacy history', async () => {
  const users = ['none', 'active', 'disabled', 'failed', 'active-with-history', 'failed-after-disabled', 'disabled-after-failed']
    .map((id) => ({ id, email: `${id}@example.com`, status: 'active' }))
  const credentials = [
    { user_id: 'active', status: 'active', created_at: '2026-10-19T00:00:00Z' },
    { user_id: 'disabled', status: 'disabled', created_at: '2026-10-19T00:00:00Z' },
    { user_id: 'failed', status: 'create_failed', created_at: '2026-10-19T00:00:00Z' },
    { user_id: 'active-with-history', status: 'active', created_at: '2026-10-19T00:00:00Z' },
    { user_id: 'active-with-history', status: 'disabled', created_at: '2026-10-18T00:00:00Z' },
    { user_id: 'failed-after-disabled', status: 'create_failed', created_at: '2026-10-19T00:00:00Z' },
    { user_id: 'failed-after-disabled', status: 'disabled', created_at: '2026-10-18T00:00:00Z' },
    { user_id: 'disabled-after-failed', status: 'disabled', created_at: '2026-10-19T00:00:00Z' },
    { user_id: 'disabled-after-failed', status: 'create_failed', created_at: '2026-10-18T00:00:00Z' }
  ].sort((left, right) => right.created_at.localeCompare(left.created_at))
  for (const [serviceStatus, expected] of [
    ['not_enabled', ['none', 'failed', 'failed-after-disabled']],
    ['active', ['active', 'active-with-history']],
    ['disabled', ['disabled', 'disabled-after-failed']]
  ]) {
    const calls = []
    const client = { from: (table) => createQuery({ table, calls, responseFor: (state) => {
      let rows = table === 'users' ? users : table === 'user_service_credentials' ? credentials : []
      for (const [operator, column, value] of state.filters) {
        rows = rows.filter((row) => operator === 'in' ? value.includes(row[column]) : row[column] === value)
      }
      return { data: rows, error: null, count: table === 'users' ? rows.length : null }
    } }) }
    const result = await listUsersForAdmin({ serviceStatus }, { client })
    assert.deepEqual(result.items.map((user) => user.id), expected, serviceStatus)
    assert.ok(result.items.every((user) => user.service.serviceStatus === serviceStatus), serviceStatus)
    assert.equal(result.pagination.total, expected.length)
    assert.deepEqual(calls.find((call) => call[0] === 'user_service_credentials' && call[1] === 'order'), [
      'user_service_credentials', 'order', 'created_at', { ascending: false }
    ])
  }
})
