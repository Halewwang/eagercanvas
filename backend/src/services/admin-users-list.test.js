import assert from 'node:assert/strict'
import { mock, test } from 'node:test'

import { env } from '../config/env.js'
import { supabase } from '../config/supabase.js'
import { listUsersForAdmin } from './admin-users-list.js'

const createQuery = ({ table, calls, dataByTable }) => ({
  select(columns) {
    calls.push([table, 'select', columns])
    return this
  },
  order(column, options) {
    calls.push([table, 'order', column, options])
    return this
  },
  eq(column, value) {
    calls.push([table, 'eq', column, value])
    return this
  },
  in(column, value) {
    calls.push([table, 'in', column, value])
    return this
  },
  then(resolve, reject) {
    return Promise.resolve({ data: dataByTable[table] || [], error: null }).then(resolve, reject)
  }
})

test('listUsersForAdmin assembles admin user usage view from focused data sources', async () => {
  const originalFetch = global.fetch
  const originalDashboardKey = env.dashboard302ApiKey
  const originalProviderKey = env.providerApiKey
  const calls = []
  const dataByTable = {
    users: [
      {
        id: 'user-1',
        email: 'user@example.com',
        created_at: '2026-06-01T00:00:00.000Z',
        status: 'active'
      }
    ],
    user_profiles: [
      {
        user_id: 'user-1',
        display_name: 'Ada',
        registered_at: '2026-06-01T00:00:00.000Z',
        last_login_at: '2026-06-02T00:00:00.000Z'
      }
    ],
    user_api_key_assignments: [
      { user_id: 'user-1', api_name: 'active-key', created_at: '2026-06-01T01:00:00.000Z' },
      { user_id: 'user-1', api_name: 'deleted-key', created_at: '2026-06-01T02:00:00.000Z' }
    ],
    usage_events: [
      {
        user_id: 'user-1',
        api_name: 'active-key',
        billing_status: 'pending',
        created_at: '2026-06-03T00:00:00.000Z'
      }
    ],
    user_service_credentials: [
      {
        id: 'cred-1',
        user_id: 'user-1',
        provider_api_name: 'active-key',
        status: 'active'
      }
    ],
    provider_billing_records: [
      {
        user_id: 'user-1',
        service_credential_id: 'cred-1',
        model: 'gpt-image-2',
        input_tokens: 10,
        output_tokens: 5,
        image_count: 1,
        video_seconds: 0,
        cost_amount: 1.25,
        cost_currency: 'USD',
        reconciliation_status: 'matched',
        official_created_at: '2026-06-03T00:00:00.000Z'
      }
    ],
    user_roles: [{ user_id: 'user-1', role_id: 'role-admin' }],
    roles: [{ id: 'role-admin', code: 'admin' }]
  }

  const restoreSupabase = mock.method(supabase, 'from', (table) => createQuery({ table, calls, dataByTable }))
  env.dashboard302ApiKey = 'dashboard-test-key'
  env.providerApiKey = ''
  global.fetch = async (url) => {
    const requestUrl = String(url)
    if (/\/dashboard\/api_keys$/.test(requestUrl)) {
      return new Response(
        JSON.stringify({
          code: 0,
          data: [
            { api_name: 'active-key', api_key: 'sk-runtime-user-key', current_cost: 4750, currency: 'PTC' }
          ]
        }),
        { status: 200 }
      )
    }

    if (/\/dashboard\/api_key\/active-key$/.test(requestUrl)) {
      return new Response(
        JSON.stringify({
          code: 0,
          data: {
            api_name: 'active-key',
            current_cost: 4750
          }
        }),
        { status: 200 }
      )
    }

    assert.fail(`Unexpected 302 mock request: ${requestUrl}`)
    return new Response(
      JSON.stringify({
        code: 0
      }),
      { status: 200 }
    )
  }

  try {
    const [user] = await listUsersForAdmin()

    assert.equal(user.id, 'user-1')
    assert.equal(user.displayName, 'Ada')
    assert.deepEqual(user.roles, ['admin'])
    assert.deepEqual(user.assignedApiKeys, [
      { apiName: 'active-key', createdAt: '2026-06-01T01:00:00.000Z' }
    ])
    assert.equal(user.usage.totalCalls, 1)
    assert.equal(user.usage.totalCostUsd, 4.75)
    assert.equal(user.usageMeta.pendingBillingCount, 1)
    assert.deepEqual(calls.map((call) => call[0]).filter((value, index, list) => list.indexOf(value) === index), [
      'users',
      'user_profiles',
      'user_api_key_assignments',
      'usage_events',
      'user_service_credentials',
      'provider_billing_records',
      'user_roles',
      'roles'
    ])
  } finally {
    restoreSupabase.mock.restore()
    global.fetch = originalFetch
    env.dashboard302ApiKey = originalDashboardKey
    env.providerApiKey = originalProviderKey
  }
})
