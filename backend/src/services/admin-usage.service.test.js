import assert from 'node:assert/strict'
import test from 'node:test'

import { buildAdminUserUsageView, loadUserApiKeyBillingInventory } from './admin-usage.service.js'

test('buildAdminUserUsageView uses normalized 302 key cost as the official cost source', () => {
  const [user] = buildAdminUserUsageView({
    users: [{ id: 'user-1', email: 'user@example.com', created_at: '2026-05-01T00:00:00.000Z', status: 'active' }],
    profiles: [{ user_id: 'user-1', display_name: 'Ada', registered_at: '2026-05-01T00:00:00.000Z' }],
    dailyAggregates: [{ user_id: 'user-1', total_calls: 9, total_tokens: 90, total_images: 3, total_video_seconds: 8, total_cost_usd: 99 }],
    usageEvents: [
      {
        user_id: 'user-1',
        api_name: 'eager_user_one',
        cost_usd: 99,
        estimated_cost_usd: 88,
        billing_status: 'pending',
        created_at: '2026-05-03T00:00:00.000Z'
      }
    ],
    credentials: [{ id: 'cred-1', user_id: 'user-1', provider_api_name: 'eager_user_one', status: 'active' }],
    billingRecords: [
      {
        user_id: 'user-1',
        service_credential_id: 'cred-1',
        model: 'gpt-image-2',
        cost_amount: 1.25,
        cost_currency: 'USD',
        reconciliation_status: 'matched',
        official_created_at: '2026-05-03T00:05:00.000Z'
      }
    ],
    apiKeyInventory: new Map([[
      'eager_user_one',
      {
        api_name: 'eager_user_one',
        current_cost: 4848,
        usage_total_cost: 4.848,
        usage_currency: 'PTC'
      }
    ]]),
    assignments: [{ user_id: 'user-1', api_name: 'eager_user_one', created_at: '2026-05-01T00:00:00.000Z' }],
    activeApiKeyNames: new Set(['eager_user_one']),
    rolesMap: new Map([['user-1', ['user']]])
  })

  assert.equal(user.usage.totalCostUsd, 4.848)
  assert.equal(user.usage.totalCalls, 1)
  assert.equal(user.officialUsage.totalCostAmount, 4.848)
  assert.equal(user.officialUsage.currency, 'PTC')
  assert.equal(user.estimatedUsage, undefined)
  assert.equal(user.reconciliation.diffAmount, 0)
})

test('buildAdminUserUsageView ignores raw key current_cost when normalized key cost is unavailable', () => {
  const [user] = buildAdminUserUsageView({
    users: [{ id: 'user-1', email: 'user@example.com', created_at: '2026-05-01T00:00:00.000Z', status: 'active' }],
    profiles: [{ user_id: 'user-1', display_name: 'Ada', registered_at: '2026-05-01T00:00:00.000Z' }],
    credentials: [{ id: 'cred-1', user_id: 'user-1', provider_api_name: 'eager_user_one', status: 'active' }],
    apiKeyInventory: new Map([[
      'eager_user_one',
      {
        api_name: 'eager_user_one',
        current_cost: 4848,
        currency: 'USD'
      }
    ]]),
    assignments: [{ user_id: 'user-1', api_name: 'eager_user_one', created_at: '2026-05-01T00:00:00.000Z' }],
    activeApiKeyNames: new Set(['eager_user_one'])
  })

  assert.equal(user.usage.totalCostUsd, 0)
  assert.equal(user.officialUsage.totalCostAmount, 0)
  assert.equal(user.officialUsage.currency, 'USD')
})

test('loadUserApiKeyBillingInventory enriches key details with normalized 302 key cost', async () => {
  const detailCalls = []
  const inventory = await loadUserApiKeyBillingInventory(
    [{ provider_api_name: 'eager_user_one', status: 'active' }],
    {
      listApiKeys: async () => ({
        data: [
          {
            api_name: 'eager_user_one',
            current_cost: 4848
          }
        ]
      }),
      getApiKey: async (apiName) => {
        detailCalls.push(apiName)
        return {
          data: {
            api_name: apiName,
            api_key: 'sk-runtime-user-key',
            current_cost: 6767,
            current_month_cost: 6767,
            current_date_cost: 1862
          }
        }
      }
    }
  )

  assert.deepEqual(detailCalls, ['eager_user_one'])
  assert.equal(inventory.get('eager_user_one').current_cost, 6767)
  assert.equal(inventory.get('eager_user_one').current_date_cost, 1862)
  assert.equal(inventory.get('eager_user_one').usage_total_cost, 6.767)
  assert.equal(inventory.get('eager_user_one').usage_monthly_cost, 6.767)
  assert.equal(inventory.get('eager_user_one').usage_daily_cost, 1.862)
  assert.equal(inventory.get('eager_user_one').usage_currency, 'PTC')
})

test('loadUserApiKeyBillingInventory uses list runtime key when detail omits api key', async () => {
  const inventory = await loadUserApiKeyBillingInventory(
    [{ provider_api_name: 'eager_user_one', status: 'active' }],
    {
      listApiKeys: async () => ({
        data: [
          {
            api_name: 'eager_user_one',
            api_key: 'sk-list-runtime-key',
            current_cost: 4848
          }
        ]
      }),
      getApiKey: async (apiName) => ({
        data: {
          api_name: apiName,
          current_cost: 7250,
          current_date_cost: 500
        }
      })
    }
  )

  assert.equal(inventory.get('eager_user_one').api_key, 'sk-list-runtime-key')
  assert.equal(inventory.get('eager_user_one').current_cost, 7250)
  assert.equal(inventory.get('eager_user_one').usage_total_cost, 7.25)
  assert.equal(inventory.get('eager_user_one').usage_daily_cost, 0.5)
  assert.equal(inventory.get('eager_user_one').usage_currency, 'PTC')
})

test('loadUserApiKeyBillingInventory uses matched 302 key cost without calling usage-log', async () => {
  const usageCalls = []
  const inventory = await loadUserApiKeyBillingInventory(
    [{ provider_api_name: 'eager_user_one', status: 'active' }],
    {
      listApiKeys: async () => ({
        data: [
          {
            api_name: 'eager_user_one',
            api_key: 'sk-list-runtime-key',
            current_cost: 1250,
            current_date_cost: 100
          }
        ]
      }),
      getApiKey: async (apiName) => ({
        data: {
          api_name: apiName,
          api_key: 'sk-detail-runtime-key',
          current_cost: 3500,
          current_date_cost: 750,
          currency: 'PTC'
        }
      }),
      getApiKeyUsage: async (apiKey) => {
        usageCalls.push(apiKey)
        throw new Error('usage-log timeout')
      }
    }
  )

  assert.deepEqual(usageCalls, [])
  assert.equal(inventory.get('eager_user_one').current_cost, 3500)
  assert.equal(inventory.get('eager_user_one').usage_total_cost, 3.5)
  assert.equal(inventory.get('eager_user_one').usage_daily_cost, 0.75)
  assert.equal(inventory.get('eager_user_one').usage_currency, 'PTC')
})

test('loadUserApiKeyBillingInventory fetches requested credential detail when api key list omits it', async () => {
  const inventory = await loadUserApiKeyBillingInventory(
    [{ provider_api_name: 'eager_user_missing_from_list', status: 'active' }],
    {
      listApiKeys: async () => ({
        data: [
          {
            api_name: 'other_key',
            api_key: 'sk-other-runtime-key'
          }
        ]
      }),
      getApiKey: async (apiName) => ({
        data: {
          api_name: apiName,
          api_key: 'sk-detail-runtime-key',
          current_cost: 8750
        }
      })
    }
  )

  assert.equal(inventory.get('eager_user_missing_from_list').usage_total_cost, 8.75)
  assert.equal(inventory.get('eager_user_missing_from_list').usage_currency, 'PTC')
})

test('loadUserApiKeyBillingInventory bounds concurrent key detail lookups', async () => {
  const detailCalls = []
  const detailResolvers = new Map()
  const detailRelease = (apiName) => {
    const suffixCost = apiName.endsWith('one') ? 1000 : apiName.endsWith('two') ? 2000 : 3000
    detailResolvers.get(apiName)?.({
      data: {
        api_name: apiName,
        api_key: `sk-${apiName}`,
        current_cost: suffixCost
      }
    })
  }
  const waitForMicrotasks = () => new Promise((resolve) => setImmediate(resolve))

  const inventoryPromise = loadUserApiKeyBillingInventory(
    [
      { provider_api_name: 'eager_user_one' },
      { provider_api_name: 'eager_user_two' },
      { provider_api_name: 'eager_user_three' }
    ],
    {
      concurrency: 2,
      listApiKeys: async () => ({
        data: [
          { api_name: 'eager_user_one' },
          { api_name: 'eager_user_two' },
          { api_name: 'eager_user_three' }
        ]
      }),
      getApiKey: async (apiName) => {
        detailCalls.push(apiName)
        return new Promise((resolve) => {
          detailResolvers.set(apiName, resolve)
        })
      }
    }
  )

  try {
    await waitForMicrotasks()
    assert.deepEqual([...detailCalls], ['eager_user_one', 'eager_user_two'])

    detailRelease('eager_user_one')
    await waitForMicrotasks()
    assert.deepEqual([...detailCalls], ['eager_user_one', 'eager_user_two', 'eager_user_three'])

    detailRelease('eager_user_two')
    detailRelease('eager_user_three')
    const inventory = await inventoryPromise

    assert.equal(inventory.get('eager_user_one').usage_total_cost, 1)
    assert.equal(inventory.get('eager_user_two').usage_total_cost, 2)
    assert.equal(inventory.get('eager_user_three').usage_total_cost, 3)
  } finally {
    detailRelease('eager_user_one')
    detailRelease('eager_user_two')
    detailRelease('eager_user_three')
  }
})

test('loadUserApiKeyBillingInventory reuses short-lived billing inventory cache when enabled', async () => {
  let listCalls = 0
  let detailCalls = 0
  const options = {
    cacheTtlMs: 1000,
    listApiKeys: async () => {
      listCalls += 1
      return {
        data: [
          {
            api_name: 'eager_user_cached',
            api_key: 'sk-cached'
          }
        ]
      }
    },
    getApiKey: async (apiName) => {
      detailCalls += 1
      return {
        data: {
          api_name: apiName,
          api_key: 'sk-cached',
          current_cost: 9500
        }
      }
    }
  }

  const first = await loadUserApiKeyBillingInventory(
    [{ provider_api_name: 'eager_user_cached', status: 'active' }],
    options
  )
  const second = await loadUserApiKeyBillingInventory(
    [{ provider_api_name: 'eager_user_cached', status: 'active' }],
    options
  )

  assert.equal(first.get('eager_user_cached').usage_total_cost, 9.5)
  assert.equal(second.get('eager_user_cached').usage_total_cost, 9.5)
  assert.notEqual(first, second)
  assert.equal(listCalls, 1)
  assert.equal(detailCalls, 1)
})

test('loadUserApiKeyBillingInventory uses matched list key cost when detail lookup fails', async () => {
  const inventory = await loadUserApiKeyBillingInventory(
    [{ provider_api_name: 'eager_user_one', status: 'active' }],
    {
      listApiKeys: async () => ({
        data: [{ api_name: 'eager_user_one', current_cost: 4848, current_date_cost: 125 }]
      }),
      getApiKey: async () => {
        throw new Error('detail unavailable')
      }
    }
  )

  assert.equal(inventory.get('eager_user_one').api_name, 'eager_user_one')
  assert.equal(inventory.get('eager_user_one').current_cost, 4848)
  assert.equal(inventory.get('eager_user_one').usage_total_cost, 4.848)
  assert.equal(inventory.get('eager_user_one').usage_daily_cost, 0.125)
  assert.equal(inventory.get('eager_user_one').usage_currency, 'PTC')
})
