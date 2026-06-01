import assert from 'node:assert/strict'
import test from 'node:test'

import { buildAdminUserUsageView } from './admin-usage-view.js'

test('buildAdminUserUsageView filters deleted api assignments and uses usage-log inventory costs', () => {
  const [user] = buildAdminUserUsageView({
    users: [
      {
        id: 'user-1',
        email: 'user@example.com',
        created_at: '2026-05-01T00:00:00.000Z',
        status: 'active'
      }
    ],
    assignments: [
      { user_id: 'user-1', api_name: 'eager_user_active', created_at: '2026-05-02T00:00:00.000Z' },
      { user_id: 'user-1', api_name: 'eager_user_deleted', created_at: '2026-05-03T00:00:00.000Z' }
    ],
    usageEvents: [
      {
        user_id: 'user-1',
        api_name: 'eager_user_active',
        billing_status: 'pending',
        created_at: '2026-05-04T00:00:00.000Z'
      }
    ],
    credentials: [
      {
        id: 'cred-1',
        user_id: 'user-1',
        provider_api_name: 'eager_user_active',
        status: 'active'
      }
    ],
    billingRecords: [
      {
        user_id: 'user-1',
        service_credential_id: 'cred-1',
        model: 'gpt-image-2',
        cost_amount: 1.25,
        cost_currency: 'USD',
        reconciliation_status: 'matched'
      }
    ],
    apiKeyInventory: new Map([
      ['eager_user_active', { apiName: 'eager_user_active', usage_total_cost: 4.75, usage_currency: 'PTC', currency: 'PTC' }]
    ]),
    activeApiKeyNames: new Set(['eager_user_active'])
  })

  assert.deepEqual(user.assignedApiKeys, [
    {
      apiName: 'eager_user_active',
      createdAt: '2026-05-02T00:00:00.000Z'
    }
  ])
  assert.equal(user.usage.totalCostUsd, 4.75)
  assert.equal(user.officialUsage.totalCostAmount, 4.75)
  assert.equal(user.officialUsage.currency, 'PTC')
  assert.equal(user.usageMeta.pendingBillingCount, 1)
  assert.equal(user.usageMeta.byApiKey[0].totalCostUsd, 4.75)
})
