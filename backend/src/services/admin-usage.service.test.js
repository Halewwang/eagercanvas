import assert from 'node:assert/strict'
import test from 'node:test'

import { buildAdminUserUsageView, loadUserApiKeyBillingInventory } from './admin-usage.service.js'

test('buildAdminUserUsageView uses official 302 billing as the only cost source', () => {
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
    apiKeyInventory: new Map([['eager_user_one', { api_name: 'eager_user_one', current_cost: 2.5, currency: 'USD' }]]),
    assignments: [{ user_id: 'user-1', api_name: 'eager_user_one', created_at: '2026-05-01T00:00:00.000Z' }],
    activeApiKeyNames: new Set(['eager_user_one']),
    rolesMap: new Map([['user-1', ['user']]])
  })

  assert.equal(user.usage.totalCostUsd, 2.5)
  assert.equal(user.usage.totalCalls, 1)
  assert.equal(user.officialUsage.totalCostAmount, 2.5)
  assert.equal(user.estimatedUsage, undefined)
  assert.equal(user.reconciliation.diffAmount, 0)
})

test('loadUserApiKeyBillingInventory uses per-key detail cost over api key list cost', async () => {
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
            current_cost: 12.34,
            current_date_cost: 0.56
          }
        }
      }
    }
  )

  assert.deepEqual(detailCalls, ['eager_user_one'])
  assert.equal(inventory.get('eager_user_one').current_cost, 12.34)
  assert.equal(inventory.get('eager_user_one').current_date_cost, 0.56)
})

test('loadUserApiKeyBillingInventory does not use list cost when detail lookup fails', async () => {
  const inventory = await loadUserApiKeyBillingInventory(
    [{ provider_api_name: 'eager_user_one', status: 'active' }],
    {
      listApiKeys: async () => ({
        data: [{ api_name: 'eager_user_one', current_cost: 4848 }]
      }),
      getApiKey: async () => {
        throw new Error('detail unavailable')
      }
    }
  )

  assert.equal(inventory.get('eager_user_one').api_name, 'eager_user_one')
  assert.equal(Object.hasOwn(inventory.get('eager_user_one'), 'current_cost'), false)
})
