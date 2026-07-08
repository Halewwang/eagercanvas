import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildProviderApiName,
  createUserServiceCredential,
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
  assert.deepEqual(calls, ['user_service_credentials', 'user_service_credentials'])
})

test('getUserServiceStatus reports active when an active credential exists before newer failures', async () => {
  const fakeSupabase = {
    from() {
      const filters = []
      return {
        select() { return this },
        eq(column, value) {
          filters.push([column, value])
          return this
        },
        order() { return this },
        limit() { return this },
        maybeSingle: async () => {
          const wantsActive = filters.some(([column, value]) => column === 'status' && value === 'active')
          return {
            data: wantsActive
              ? { id: 'cred-active', status: 'active' }
              : { id: 'cred-failed', status: 'create_failed' },
            error: null
          }
        }
      }
    }
  }

  const status = await getUserServiceStatus('user-1', { supabaseClient: fakeSupabase })
  assert.equal(status, 'active')
})

test('resolveActiveUserServiceCredential rejects disabled service before resolving runtime key', async () => {
  const fakeSupabase = {
    from() {
      const filters = []
      return {
        select() { return this },
        eq(column, value) {
          filters.push([column, value])
          return this
        },
        order() { return this },
        limit() { return this },
        maybeSingle: async () => ({
          data: filters.some(([column, value]) => column === 'status' && value === 'active')
            ? null
            : {
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

test('resolveActiveUserServiceCredential prefers the active credential over newer failed records', async () => {
  const calls = []
  const fakeSupabase = {
    from(table) {
      const filters = []
      calls.push(['from', table])
      return {
        select() { return this },
        eq(column, value) {
          filters.push([column, value])
          calls.push(['eq', column, value])
          return this
        },
        order() { return this },
        limit() { return this },
        maybeSingle: async () => {
          const wantsActive = filters.some(([column, value]) => column === 'status' && value === 'active')
          return {
            data: wantsActive
              ? {
                  id: 'cred-active',
                  user_id: 'user-1',
                  provider_api_name: 'eager_user_active',
                  status: 'active'
                }
              : {
                  id: 'cred-failed',
                  user_id: 'user-1',
                  provider_api_name: 'eager_user_failed',
                  status: 'create_failed'
                },
            error: null
          }
        }
      }
    }
  }

  const resolved = await resolveActiveUserServiceCredential('user-1', {
    supabaseClient: fakeSupabase,
    getRuntimeApiKeyByName: async (apiName) => {
      assert.equal(apiName, 'eager_user_active')
      return 'sk-active'
    }
  })

  assert.deepEqual(resolved, {
    serviceCredentialId: 'cred-active',
    apiName: 'eager_user_active',
    apiKey: 'sk-active'
  })
  assert.ok(calls.some((call) => call[0] === 'eq' && call[1] === 'status' && call[2] === 'active'))
})

test('createUserServiceCredential stores failed state when created api name cannot resolve a runtime key', async () => {
  const inserts = []
  const fakeSupabase = {
    from(table) {
      const filters = []
      return {
        select() { return this },
        eq(column, value) {
          filters.push([column, value])
          return this
        },
        order() { return this },
        limit() { return this },
        maybeSingle: async () => {
          if (table === 'users') return { data: { id: 'user-1', status: 'active' }, error: null }
          return { data: null, error: null }
        },
        insert: (payload) => {
          inserts.push({ table, payload })
          return {
            select() { return this },
            single: async () => ({ data: { id: 'inserted', ...payload }, error: null })
          }
        }
      }
    }
  }

  await assert.rejects(
    () => createUserServiceCredential({
      userId: 'user-1',
      operatorUserId: 'admin-1'
    }, {
      supabaseClient: fakeSupabase,
      createProviderApiKey: async () => ({
        data: { api_name: 'eager_user_user1' }
      }),
      getRuntimeApiKeyByName: async (apiName) => {
        assert.equal(apiName, 'eager_user_user1')
        return ''
      }
    }),
    (error) => {
      assert.equal(error.status, 502)
      assert.equal(error.code, 'SERVICE_ACCESS_CREATE_FAILED')
      return true
    }
  )

  const credentialInsert = inserts.find((item) => item.table === 'user_service_credentials')
  assert.equal(credentialInsert.payload.status, 'create_failed')
  assert.equal(credentialInsert.payload.provider_api_name, 'eager_user_user1')
  assert.match(credentialInsert.payload.last_error, /runtime API key/i)
  assert.equal(inserts.some((item) => item.table === 'admin_operation_logs'), false)
})

test('createUserServiceCredential stores active key last4 from resolved runtime key when create response omits it', async () => {
  const inserts = []
  const fakeSupabase = {
    from(table) {
      return {
        select() { return this },
        eq() { return this },
        order() { return this },
        limit() { return this },
        maybeSingle: async () => {
          if (table === 'users') return { data: { id: 'user-1', status: 'active' }, error: null }
          return { data: null, error: null }
        },
        then(resolve, reject) {
          if (table === 'user_service_credentials') return Promise.resolve({ data: [], error: null }).then(resolve, reject)
          return Promise.resolve({ data: [], error: null }).then(resolve, reject)
        },
        insert: (payload) => {
          inserts.push({ table, payload })
          return {
            select() { return this },
            single: async () => ({ data: { id: `${table}-inserted`, ...payload }, error: null })
          }
        }
      }
    }
  }

  const result = await createUserServiceCredential({
    userId: 'user-1',
    operatorUserId: 'admin-1'
  }, {
    supabaseClient: fakeSupabase,
    createProviderApiKey: async () => ({
      code: 0,
      msg: 'success',
      data: {}
    }),
    getRuntimeApiKeyByName: async (apiName, options = {}) => {
      assert.equal(apiName, 'eager_user_user1')
      assert.equal(options.throwOnMissing, true)
      return 'sk-runtime-abcd'
    }
  })

  const credentialInsert = inserts.find((item) => item.table === 'user_service_credentials')
  assert.equal(credentialInsert.payload.status, 'active')
  assert.equal(credentialInsert.payload.api_key_last4, 'abcd')
  assert.equal(result.serviceCredential.apiKeyLast4, 'abcd')
})

test('createUserServiceCredential restores a failed credential when its runtime key becomes available', async () => {
  const updates = []
  let createProviderCalls = 0
  const failedCredential = {
    id: 'cred-failed',
    user_id: 'user-1',
    provider_api_name: 'eager_user_user1',
    status: 'create_failed',
    limit_cost: 0,
    limit_daily_cost: 0,
    expired_on: 0,
    created_at: '2026-07-08T00:00:00.000Z',
    last_error: 'Not Found'
  }
  const fakeSupabase = {
    from(table) {
      const filters = []
      let updatePayload = null
      return {
        select() { return this },
        eq(column, value) {
          filters.push([column, value])
          return this
        },
        order() { return this },
        limit() { return this },
        maybeSingle: async () => {
          if (table === 'users') return { data: { id: 'user-1', status: 'active' }, error: null }
          return { data: null, error: null }
        },
        then(resolve, reject) {
          if (table === 'user_service_credentials') return Promise.resolve({ data: [failedCredential], error: null }).then(resolve, reject)
          return Promise.resolve({ data: [], error: null }).then(resolve, reject)
        },
        update(payload) {
          updatePayload = payload
          updates.push({ table, payload })
          return this
        },
        single: async () => ({
          data: {
            ...failedCredential,
            ...updatePayload
          },
          error: null
        }),
        insert: (payload) => {
          updates.push({ table, insert: payload })
          return {
            select() { return this },
            single: async () => ({ data: { id: 'log-1', ...payload }, error: null })
          }
        }
      }
    }
  }

  const result = await createUserServiceCredential({
    userId: 'user-1',
    operatorUserId: 'admin-1'
  }, {
    supabaseClient: fakeSupabase,
    createProviderApiKey: async () => {
      createProviderCalls += 1
      throw new Error('new key should not be created')
    },
    getRuntimeApiKeyByName: async (apiName) => {
      assert.equal(apiName, 'eager_user_user1')
      return 'sk-restored'
    }
  })

  assert.equal(createProviderCalls, 0)
  assert.equal(result.serviceCredential.serviceStatus, 'active')
  assert.equal(result.serviceCredential.apiKeyLast4, 'ored')
  assert.ok(updates.some((item) => item.table === 'user_service_credentials' && item.payload.status === 'active'))
})

test('resolveActiveUserServiceCredential records last_error when active runtime key lookup fails', async () => {
  const updates = []
  const fakeSupabase = {
    from(table) {
      const filters = []
      let updatePayload = null
      return {
        select() { return this },
        eq(column, value) {
          filters.push([column, value])
          return this
        },
        order() { return this },
        limit() { return this },
        maybeSingle: async () => ({
          data: filters.some(([column, value]) => column === 'status' && value === 'active')
            ? {
                id: 'cred-active',
                user_id: 'user-1',
                provider_api_name: 'eager_user_active',
                status: 'active'
              }
            : null,
          error: null
        }),
        update(payload) {
          updatePayload = payload
          updates.push({ table, payload })
          return this
        },
        single: async () => ({ data: updatePayload, error: null })
      }
    }
  }

  await assert.rejects(
    () => resolveActiveUserServiceCredential('user-1', {
      supabaseClient: fakeSupabase,
      getRuntimeApiKeyByName: async (apiName) => {
        assert.equal(apiName, 'eager_user_active')
        return ''
      }
    }),
    (error) => {
      assert.equal(error.status, 503)
      assert.equal(error.code, 'SERVICE_CREDENTIAL_UNAVAILABLE')
      return true
    }
  )

  assert.deepEqual(updates, [
    {
      table: 'user_service_credentials',
      payload: {
        last_error: 'Runtime API key is unavailable for provider_api_name eager_user_active'
      }
    }
  ])
})

test('resolveActiveUserServiceCredential ignores legacy api assignments when no active service credential exists', async () => {
  const queriedTables = []
  const fakeSupabase = {
    from(table) {
      queriedTables.push(table)
      if (table === 'user_api_key_assignments') throw new Error('assignments must not be used for service access')
      return {
        select() { return this },
        eq() { return this },
        order() { return this },
        limit() { return this },
        maybeSingle: async () => ({ data: null, error: null })
      }
    }
  }

  await assert.rejects(
    () => resolveActiveUserServiceCredential('user-1', {
      supabaseClient: fakeSupabase,
      getRuntimeApiKeyByName: async () => {
        throw new Error('runtime lookup should not run without active service credential')
      }
    }),
    (error) => {
      assert.equal(error.status, 403)
      assert.equal(error.code, 'SERVICE_NOT_ENABLED')
      return true
    }
  )

  assert.deepEqual(queriedTables, ['user_service_credentials', 'user_service_credentials'])
})
