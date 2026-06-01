import assert from 'node:assert/strict'
import { mock, test } from 'node:test'

import { env } from '../config/env.js'
import { supabase } from '../config/supabase.js'
import { assignApiKeyToUser, getUserAssignedApiKeys, removeApiKeyAssignments } from './admin-api-key-assignments.js'

const createQuery = ({ data = null, error = null, onCall = () => {} } = {}) => ({
  select(columns) {
    onCall(['select', columns])
    return this
  },
  eq(column, value) {
    onCall(['eq', column, value])
    return this
  },
  order(column, options) {
    onCall(['order', column, options])
    return this
  },
  maybeSingle() {
    onCall(['maybeSingle'])
    return Promise.resolve({ data, error })
  },
  upsert(payload, options) {
    onCall(['upsert', payload, options])
    return Promise.resolve({ data, error })
  },
  delete() {
    onCall(['delete'])
    return this
  },
  insert(payload) {
    onCall(['insert', payload])
    return Promise.resolve({ data, error })
  },
  then(resolve, reject) {
    return Promise.resolve({ data, error }).then(resolve, reject)
  }
})

const withDashboardEnv = async (fn) => {
  const originalFetch = global.fetch
  const originalDashboardKey = env.dashboard302ApiKey
  const originalProviderKey = env.providerApiKey

  env.dashboard302ApiKey = 'dashboard-test-key'
  env.providerApiKey = ''

  try {
    await fn()
  } finally {
    global.fetch = originalFetch
    env.dashboard302ApiKey = originalDashboardKey
    env.providerApiKey = originalProviderKey
  }
}

test('getUserAssignedApiKeys filters assignments against active dashboard api keys', async () => {
  const queryCalls = []
  const restoreSupabase = mock.method(supabase, 'from', (table) => {
    assert.equal(table, 'user_api_key_assignments')
    return createQuery({
      onCall: (call) => queryCalls.push(call),
      data: [
        { api_name: 'active-key', created_at: '2026-06-01T00:00:00.000Z' },
        { api_name: 'deleted-key', created_at: '2026-06-02T00:00:00.000Z' }
      ]
    })
  })

  await withDashboardEnv(async () => {
    global.fetch = async (url) => {
      assert.match(String(url), /\/dashboard\/api_keys$/)
      return new Response(JSON.stringify({ code: 0, data: [{ api_name: 'active-key' }] }), { status: 200 })
    }

    try {
      const list = await getUserAssignedApiKeys('user-1')
      assert.deepEqual(list, [{ api_name: 'active-key', created_at: '2026-06-01T00:00:00.000Z' }])
      assert.deepEqual(queryCalls, [
        ['select', 'api_name, created_at'],
        ['eq', 'user_id', 'user-1'],
        ['order', 'created_at', { ascending: false }]
      ])
    } finally {
      restoreSupabase.mock.restore()
    }
  })
})

test('assignApiKeyToUser validates inventory, upserts assignment, and writes audit log', async () => {
  const tableCalls = []
  const restoreSupabase = mock.method(supabase, 'from', (table) => {
    tableCalls.push(['from', table])
    if (table === 'users') {
      return createQuery({
        onCall: (call) => tableCalls.push([table, ...call]),
        data: { id: 'user-1' }
      })
    }
    if (table === 'user_api_key_assignments') {
      return createQuery({ onCall: (call) => tableCalls.push([table, ...call]) })
    }
    if (table === 'admin_operation_logs') {
      return createQuery({ onCall: (call) => tableCalls.push([table, ...call]) })
    }
    assert.fail(`Unexpected table ${table}`)
  })

  await withDashboardEnv(async () => {
    global.fetch = async (url) => {
      assert.match(String(url), /\/dashboard\/api_keys$/)
      return new Response(JSON.stringify({ code: 0, data: [{ api_name: 'active-key' }] }), { status: 200 })
    }

    try {
      const result = await assignApiKeyToUser({
        userId: 'user-1',
        apiName: 'active-key',
        operatorUserId: 'admin-1',
        ip: '127.0.0.1',
        userAgent: 'node-test'
      })

      assert.deepEqual(result, { ok: true })
      assert.deepEqual(tableCalls, [
        ['from', 'users'],
        ['users', 'select', 'id'],
        ['users', 'eq', 'id', 'user-1'],
        ['users', 'maybeSingle'],
        ['from', 'user_api_key_assignments'],
        ['user_api_key_assignments', 'upsert', { user_id: 'user-1', api_name: 'active-key' }, { onConflict: 'user_id,api_name' }],
        ['from', 'admin_operation_logs'],
        ['admin_operation_logs', 'insert', {
          operator_user_id: 'admin-1',
          target_user_id: 'user-1',
          action: 'admin.api_key.assign',
          metadata: {
            apiName: 'active-key',
            ip: '127.0.0.1',
            userAgent: 'node-test'
          }
        }]
      ])
    } finally {
      restoreSupabase.mock.restore()
    }
  })
})

test('removeApiKeyAssignments deletes assignments by api name and skips empty input', async () => {
  const calls = []
  const restoreSupabase = mock.method(supabase, 'from', (table) => {
    assert.equal(table, 'user_api_key_assignments')
    return createQuery({ onCall: (call) => calls.push(call) })
  })

  try {
    assert.deepEqual(await removeApiKeyAssignments(''), { ok: true })
    assert.deepEqual(await removeApiKeyAssignments('active-key'), { ok: true })
    assert.deepEqual(calls, [
      ['delete'],
      ['eq', 'api_name', 'active-key']
    ])
  } finally {
    restoreSupabase.mock.restore()
  }
})
