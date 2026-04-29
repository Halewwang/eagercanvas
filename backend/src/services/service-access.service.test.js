import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildProviderApiName,
  formatServiceCredentialForAdmin,
  getUserServiceStatus,
  resolveActiveUserServiceCredential
} from './service-access.service.js'

test('buildProviderApiName creates a stable non-email service identifier', () => {
  assert.equal(
    buildProviderApiName('a12b34c5-6d78-4e90-9abc-def012345678'),
    'eager_user_a12b34c56d784e90'
  )
})

test('formatServiceCredentialForAdmin exposes only service-safe fields', () => {
  const formatted = formatServiceCredentialForAdmin({
    id: 'cred-1',
    provider_api_name: 'eager_user_a12b34c56d784e90',
    api_key_last4: '9xyz',
    api_key_encrypted: 'sk-secret',
    status: 'active',
    limit_cost: 100,
    limit_daily_cost: 10,
    expired_on: 0,
    created_at: '2026-04-29T00:00:00.000Z'
  })

  assert.deepEqual(formatted, {
    id: 'cred-1',
    serviceStatus: 'active',
    serviceLabel: '已开通',
    serviceIdentifier: 'svc_****e90',
    apiKeyLast4: '9xyz',
    limitCost: 100,
    limitDailyCost: 10,
    expiredOn: 0,
    createdAt: '2026-04-29T00:00:00.000Z',
    disabledAt: null,
    deletedAt: null,
    lastError: ''
  })
  assert.equal(Object.hasOwn(formatted, 'providerApiName'), false)
  assert.equal(Object.hasOwn(formatted, 'apiKey'), false)
  assert.equal(Object.hasOwn(formatted, 'api_key_encrypted'), false)
})

test('getUserServiceStatus derives not_enabled when no credential exists', async () => {
  const calls = []
  const fakeSupabase = {
    from(table) {
      calls.push(table)
      return {
        select() { return this },
        eq() { return this },
        order() { return this },
        limit() { return this },
        maybeSingle: async () => ({ data: null, error: null })
      }
    }
  }

  const status = await getUserServiceStatus('user-1', { supabaseClient: fakeSupabase })
  assert.equal(status, 'not_enabled')
  assert.deepEqual(calls, ['user_service_credentials'])
})

test('resolveActiveUserServiceCredential rejects disabled service before resolving runtime key', async () => {
  const fakeSupabase = {
    from() {
      return {
        select() { return this },
        eq(_column, _value) { return this },
        order() { return this },
        limit() { return this },
        maybeSingle: async () => ({
          data: {
            id: 'cred-1',
            user_id: 'user-1',
            provider_api_name: 'eager_user_disabled',
            status: 'disabled'
          },
          error: null
        })
      }
    }
  }

  await assert.rejects(
    () => resolveActiveUserServiceCredential('user-1', {
      supabaseClient: fakeSupabase,
      getRuntimeApiKeyByName: async () => {
        throw new Error('should not be called')
      }
    }),
    (error) => {
      assert.equal(error.status, 403)
      assert.equal(error.code, 'SERVICE_DISABLED')
      return true
    }
  )
})
