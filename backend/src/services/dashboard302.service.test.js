import assert from 'node:assert/strict'
import test from 'node:test'

import {
  resolveDashboard302BaseUrl,
  assert302DashboardSuccess,
  buildDashboard302AuthHeaders,
  get302ApiRecordsForApiName,
  get302ApiKeys,
  get302ApiKeyUsageByKey,
  get302Balance,
  get302RuntimeApiKeyByName,
  shouldRetry302DashboardWithNextKey,
  normalize302ApiKeyList,
  normalize302ApiKeyUsage,
  normalize302ApiRecordList,
  normalizeDashboardRecord
} from './dashboard302.service.js'
import { env } from '../config/env.js'
import { attachProviderResponseMetadata } from './provider-response-metadata.js'

test('inherits provider host for dashboard management requests by default', () => {
  assert.equal(resolveDashboard302BaseUrl('', 'https://api.302ai.cn'), 'https://api.302ai.cn')
})

test('allows explicit dashboard management base url override', () => {
  assert.equal(resolveDashboard302BaseUrl('https://proxy.example.com/v1', 'https://api.302ai.cn'), 'https://proxy.example.com')
})

test('throws on 302 dashboard business errors even when http status is 200', () => {
  assert.throws(
    () => assert302DashboardSuccess({ code: 403, msg: 'permission denied' }),
    (error) => error.status === 403 && /permission denied/.test(error.message)
  )
})

test('builds dashboard auth candidates with provider key fallback', () => {
  assert.deepEqual(buildDashboard302AuthHeaders('sk-dashboard', 'sk-provider'), [
    'Bearer sk-dashboard',
    'Bearer sk-provider'
  ])
})

test('dashboard management requests retry provider base url fallbacks after network failures', async () => {
  const originalFetch = global.fetch
  const originalEnv = {
    dashboard302ApiBaseUrl: env.dashboard302ApiBaseUrl,
    dashboard302ApiKey: env.dashboard302ApiKey,
    providerApiBaseUrl: env.providerApiBaseUrl,
    providerApiBaseUrls: env.providerApiBaseUrls,
    providerApiKey: env.providerApiKey,
    dashboard302TimeoutMs: env.dashboard302TimeoutMs
  }
  const requests = []

  env.dashboard302ApiBaseUrl = 'https://api.302ai.cn'
  env.dashboard302ApiKey = 'sk-dashboard'
  env.providerApiBaseUrl = 'https://api.302ai.cn'
  env.providerApiBaseUrls = 'https://api.302ai.cn,https://api.302.ai'
  env.providerApiKey = ''
  env.dashboard302TimeoutMs = 5000

  global.fetch = async (url) => {
    requests.push(String(url))
    if (String(url).startsWith('https://api.302ai.cn')) {
      throw new TypeError('fetch failed')
    }
    return new Response(JSON.stringify({ code: 0, data: { balance: 12.3 } }), { status: 200 })
  }

  try {
    const result = await get302Balance()
    assert.deepEqual(result, { code: 0, data: { balance: 12.3 } })
  } finally {
    global.fetch = originalFetch
    Object.assign(env, originalEnv)
  }

  assert.deepEqual(requests, [
    'https://api.302ai.cn/dashboard/balance',
    'https://api.302.ai/dashboard/balance'
  ])
})

test('dashboard management requests retry official base url after route-missing dashboard responses', async () => {
  const originalFetch = global.fetch
  const originalEnv = {
    dashboard302ApiBaseUrl: env.dashboard302ApiBaseUrl,
    dashboard302ApiKey: env.dashboard302ApiKey,
    providerApiBaseUrl: env.providerApiBaseUrl,
    providerApiBaseUrls: env.providerApiBaseUrls,
    providerApiKey: env.providerApiKey,
    dashboard302TimeoutMs: env.dashboard302TimeoutMs
  }
  const requests = []

  env.dashboard302ApiBaseUrl = 'https://api.302ai.cn'
  env.dashboard302ApiKey = 'sk-dashboard'
  env.providerApiBaseUrl = ''
  env.providerApiBaseUrls = ''
  env.providerApiKey = ''
  env.dashboard302TimeoutMs = 5000

  global.fetch = async (url) => {
    const requestUrl = String(url)
    requests.push(requestUrl)
    if (requestUrl.startsWith('https://api.302ai.cn')) {
      return new Response(JSON.stringify({ msg: 'Not Found' }), { status: 400 })
    }
    return new Response(JSON.stringify({
      code: 0,
      data: [{ api_name: 'eager_user_one', api_key: 'sk-runtime-one' }]
    }), { status: 200 })
  }

  try {
    const result = await get302ApiKeys()
    assert.deepEqual(normalize302ApiKeyList(result).map((item) => item.api_name), ['eager_user_one'])
  } finally {
    global.fetch = originalFetch
    Object.assign(env, originalEnv)
  }

  assert.deepEqual(requests, [
    'https://api.302ai.cn/dashboard/api_keys',
    'https://api.302.ai/dashboard/api_keys'
  ])
})

test('dashboard management errors expose safe request attempt diagnostics without secrets', async () => {
  const originalFetch = global.fetch
  const originalEnv = {
    dashboard302ApiBaseUrl: env.dashboard302ApiBaseUrl,
    dashboard302ApiKey: env.dashboard302ApiKey,
    providerApiBaseUrl: env.providerApiBaseUrl,
    providerApiBaseUrls: env.providerApiBaseUrls,
    providerApiKey: env.providerApiKey,
    dashboard302TimeoutMs: env.dashboard302TimeoutMs
  }

  env.dashboard302ApiBaseUrl = 'https://api.302ai.cn'
  env.dashboard302ApiKey = 'sk-dashboard-secret'
  env.providerApiBaseUrl = ''
  env.providerApiBaseUrls = ''
  env.providerApiKey = ''
  env.dashboard302TimeoutMs = 5000

  global.fetch = async (url) => {
    const requestUrl = String(url)
    if (requestUrl.startsWith('https://api.302ai.cn')) {
      return new Response(JSON.stringify({ msg: 'Not Found' }), { status: 400 })
    }
    return new Response(JSON.stringify({ message: 'permission denied' }), { status: 403 })
  }

  try {
    await assert.rejects(
      () => get302ApiKeys(),
      (error) => {
        assert.equal(error.code, 'DASHBOARD_302_ERROR')
        assert.deepEqual(error.dashboard302Attempts, [
          {
            method: 'GET',
            path: '/dashboard/api_keys',
            baseHost: 'api.302ai.cn',
            status: 400,
            message: 'Not Found',
            authSource: 'dashboard'
          },
          {
            method: 'GET',
            path: '/dashboard/api_keys',
            baseHost: 'api.302.ai',
            status: 403,
            message: 'permission denied',
            authSource: 'dashboard'
          }
        ])
        assert.doesNotMatch(JSON.stringify(error.dashboard302Attempts), /sk-dashboard-secret/)
        return true
      }
    )
  } finally {
    global.fetch = originalFetch
    Object.assign(env, originalEnv)
  }
})

test('dashboard management requests retry provider auth after http auth failures', async () => {
  const originalFetch = global.fetch
  const originalEnv = {
    dashboard302ApiBaseUrl: env.dashboard302ApiBaseUrl,
    dashboard302ApiKey: env.dashboard302ApiKey,
    providerApiBaseUrl: env.providerApiBaseUrl,
    providerApiBaseUrls: env.providerApiBaseUrls,
    providerApiKey: env.providerApiKey,
    dashboard302TimeoutMs: env.dashboard302TimeoutMs
  }
  const attempts = []

  env.dashboard302ApiBaseUrl = 'https://api.302.ai'
  env.dashboard302ApiKey = 'sk-dashboard'
  env.providerApiBaseUrl = ''
  env.providerApiBaseUrls = ''
  env.providerApiKey = 'sk-provider'
  env.dashboard302TimeoutMs = 5000

  global.fetch = async (url, options = {}) => {
    attempts.push({
      url: String(url),
      auth: options.headers?.Authorization
    })
    if (options.headers?.Authorization === 'Bearer sk-dashboard') {
      return new Response(JSON.stringify({ message: 'Invalid API Key' }), { status: 401 })
    }
    return new Response(JSON.stringify({ code: 0, data: { balance: 42 } }), { status: 200 })
  }

  try {
    const result = await get302Balance()
    assert.deepEqual(result, { code: 0, data: { balance: 42 } })
  } finally {
    global.fetch = originalFetch
    Object.assign(env, originalEnv)
  }

  assert.deepEqual(attempts, [
    { url: 'https://api.302.ai/dashboard/balance', auth: 'Bearer sk-dashboard' },
    { url: 'https://api.302ai.cn/dashboard/balance', auth: 'Bearer sk-dashboard' },
    { url: 'https://api.302.ai/dashboard/balance', auth: 'Bearer sk-provider' }
  ])
})

test('dashboard management requests retry provider base url after key business errors', async () => {
  const originalFetch = global.fetch
  const originalEnv = {
    dashboard302ApiBaseUrl: env.dashboard302ApiBaseUrl,
    dashboard302ApiKey: env.dashboard302ApiKey,
    providerApiBaseUrl: env.providerApiBaseUrl,
    providerApiBaseUrls: env.providerApiBaseUrls,
    providerApiKey: env.providerApiKey,
    dashboard302TimeoutMs: env.dashboard302TimeoutMs
  }
  const requests = []

  env.dashboard302ApiBaseUrl = 'https://api.302ai.cn'
  env.dashboard302ApiKey = 'sk-dashboard'
  env.providerApiBaseUrl = 'https://api.302ai.cn'
  env.providerApiBaseUrls = 'https://api.302ai.cn,https://api.302.ai'
  env.providerApiKey = ''
  env.dashboard302TimeoutMs = 5000

  global.fetch = async (url) => {
    const requestUrl = String(url)
    requests.push(requestUrl)
    if (requestUrl.startsWith('https://api.302ai.cn')) {
      return new Response(JSON.stringify({ code: -1, msg: '此 Key 不存在' }), { status: 200 })
    }
    return new Response(JSON.stringify({ code: 0, data: { balance: 18 } }), { status: 200 })
  }

  try {
    const result = await get302Balance()
    assert.deepEqual(result, { code: 0, data: { balance: 18 } })
  } finally {
    global.fetch = originalFetch
    Object.assign(env, originalEnv)
  }

  assert.deepEqual(requests, [
    'https://api.302ai.cn/dashboard/balance',
    'https://api.302.ai/dashboard/balance'
  ])
})

test('usage-log requests retry provider base url fallbacks after route-missing responses', async () => {
  const originalFetch = global.fetch
  const originalEnv = {
    dashboard302ApiBaseUrl: env.dashboard302ApiBaseUrl,
    dashboard302ApiKey: env.dashboard302ApiKey,
    providerApiBaseUrl: env.providerApiBaseUrl,
    providerApiBaseUrls: env.providerApiBaseUrls,
    providerApiKey: env.providerApiKey,
    dashboard302TimeoutMs: env.dashboard302TimeoutMs
  }
  const requests = []

  env.dashboard302ApiBaseUrl = 'https://api.302ai.cn'
  env.dashboard302ApiKey = 'sk-dashboard'
  env.providerApiBaseUrl = 'https://api.302ai.cn'
  env.providerApiBaseUrls = 'https://api.302ai.cn,https://api.302.ai'
  env.providerApiKey = ''
  env.dashboard302TimeoutMs = 5000

  global.fetch = async (url) => {
    const requestUrl = String(url)
    requests.push(requestUrl)
    if (requestUrl.startsWith('https://api.302ai.cn')) {
      return new Response(JSON.stringify({ error: { message: 'not found' } }), { status: 404 })
    }
    if (/\/gpt\/api\/token_id/.test(requestUrl)) {
      return new Response(JSON.stringify({ code: 0, data: { token_id: 'token-1' } }), { status: 200 })
    }
    return new Response(JSON.stringify({ code: 0, data: { total_cost: 6.5, currency: 'PTC' } }), { status: 200 })
  }

  try {
    const result = await get302ApiKeyUsageByKey('sk-runtime-key')
    assert.deepEqual(result, { code: 0, data: { total_cost: 6.5, currency: 'PTC' } })
  } finally {
    global.fetch = originalFetch
    Object.assign(env, originalEnv)
  }

  assert.deepEqual(requests, [
    'https://api.302ai.cn/gpt/api/token_id?api_key=sk-runtime-key',
    'https://api.302.ai/gpt/api/token_id?api_key=sk-runtime-key',
    'https://api.302ai.cn/gpt/api/token/usage/token-1',
    'https://api.302.ai/gpt/api/token/usage/token-1'
  ])
})

test('usage-log requests retry provider base url fallbacks after auth-like responses', async () => {
  const originalFetch = global.fetch
  const originalEnv = {
    dashboard302ApiBaseUrl: env.dashboard302ApiBaseUrl,
    dashboard302ApiKey: env.dashboard302ApiKey,
    providerApiBaseUrl: env.providerApiBaseUrl,
    providerApiBaseUrls: env.providerApiBaseUrls,
    providerApiKey: env.providerApiKey,
    dashboard302TimeoutMs: env.dashboard302TimeoutMs
  }
  const requests = []

  env.dashboard302ApiBaseUrl = 'https://api.302ai.cn'
  env.dashboard302ApiKey = 'sk-dashboard'
  env.providerApiBaseUrl = 'https://api.302ai.cn'
  env.providerApiBaseUrls = 'https://api.302ai.cn,https://api.302.ai'
  env.providerApiKey = ''
  env.dashboard302TimeoutMs = 5000

  global.fetch = async (url) => {
    const requestUrl = String(url)
    requests.push(requestUrl)
    if (requestUrl.startsWith('https://api.302ai.cn')) {
      return new Response(JSON.stringify({ message: 'Invalid API Key' }), { status: 401 })
    }
    if (/\/gpt\/api\/token_id/.test(requestUrl)) {
      return new Response(JSON.stringify({ code: 0, data: { token_id: 'token-auth-fallback' } }), { status: 200 })
    }
    return new Response(JSON.stringify({ code: 0, data: { total_cost: 3.25, currency: 'PTC' } }), { status: 200 })
  }

  try {
    const result = await get302ApiKeyUsageByKey('sk-runtime-key')
    assert.deepEqual(result, { code: 0, data: { total_cost: 3.25, currency: 'PTC' } })
  } finally {
    global.fetch = originalFetch
    Object.assign(env, originalEnv)
  }

  assert.deepEqual(requests, [
    'https://api.302ai.cn/gpt/api/token_id?api_key=sk-runtime-key',
    'https://api.302.ai/gpt/api/token_id?api_key=sk-runtime-key',
    'https://api.302ai.cn/gpt/api/token/usage/token-auth-fallback',
    'https://api.302.ai/gpt/api/token/usage/token-auth-fallback'
  ])
})

test('retries dashboard request with next key for disabled or invalid key responses', () => {
  assert.equal(shouldRetry302DashboardWithNextKey({ code: -1, msg: '此 Key 已被禁用' }), true)
  assert.equal(shouldRetry302DashboardWithNextKey({ code: 403, msg: 'permission denied' }), false)
})

test('normalizes 302 api key list from documented data wrapper', () => {
  const list = normalize302ApiKeyList({
    code: 0,
    msg: 'success',
    data: [
      {
        id: 1,
        api_name: 'team-a',
        api_key: 'sk-test',
        current_cost: 1.25
      }
    ]
  })

  assert.equal(list.length, 1)
  assert.equal(list[0].api_name, 'team-a')
  assert.equal(list[0].api_key, 'sk-test')
})

test('normalizes 302 usage-log totals as PTC key cost', () => {
  const usage = normalize302ApiKeyUsage({
    data: {
      total_cost: '4.848',
      monthly_cost: 1.23,
      daily_cost: 0.45
    }
  })

  assert.deepEqual(usage, {
    totalCost: 4.848,
    monthlyCost: 1.23,
    dailyCost: 0.45,
    currency: 'PTC'
  })
})

test('normalizes 302 api-record list when upstream wraps rows in data.items', () => {
  const result = normalize302ApiRecordList({
    data: {
      items: [{ request_id: 'req-1', cost: 0.12 }],
      pagination: { page: 1, total: 1 }
    }
  })

  assert.deepEqual(result.items, [{ request_id: 'req-1', cost: 0.12 }])
  assert.deepEqual(result.pagination, { page: 1, total: 1 })
})

test('queries api-record logs with the matched runtime key for an api name', async () => {
  const originalFetch = global.fetch
  const originalEnv = {
    dashboard302ApiBaseUrl: env.dashboard302ApiBaseUrl,
    dashboard302ApiKey: env.dashboard302ApiKey,
    providerApiBaseUrl: env.providerApiBaseUrl,
    providerApiBaseUrls: env.providerApiBaseUrls,
    providerApiKey: env.providerApiKey,
    dashboard302TimeoutMs: env.dashboard302TimeoutMs
  }
  const attempts = []

  env.dashboard302ApiBaseUrl = 'https://api.302.ai'
  env.dashboard302ApiKey = 'sk-dashboard'
  env.providerApiBaseUrl = ''
  env.providerApiBaseUrls = ''
  env.providerApiKey = ''
  env.dashboard302TimeoutMs = 5000

  global.fetch = async (url, options = {}) => {
    const requestUrl = String(url)
    attempts.push({
      url: requestUrl,
      auth: options.headers?.Authorization
    })

    if (/\/dashboard\/api_key\/eager_user_one$/.test(requestUrl)) {
      return new Response(JSON.stringify({
        code: 0,
        data: {
          api_name: 'eager_user_one',
          api_key: 'sk-runtime-one'
        }
      }), { status: 200 })
    }

    if (/\/dashboard\/api-record\?page=1&limit=20/.test(requestUrl)) {
      return new Response(JSON.stringify({
        items: [{ request_id: 'req-one', cost: 1.5, created_at: '2026-06-08T10:00:00.000Z' }],
        pagination: { total_page: 1, cur_page: 1, limit: 20 }
      }), { status: 200 })
    }

    assert.fail(`Unexpected 302 mock request: ${requestUrl}`)
  }

  try {
    const result = await get302ApiRecordsForApiName('eager_user_one', { page: 1, limit: 20 })
    const normalized = normalize302ApiRecordList(result)
    assert.deepEqual(normalized.items.map((item) => item.request_id), ['req-one'])
  } finally {
    global.fetch = originalFetch
    Object.assign(env, originalEnv)
  }

  assert.deepEqual(attempts, [
    { url: 'https://api.302.ai/dashboard/api_key/eager_user_one', auth: 'Bearer sk-dashboard' },
    { url: 'https://api.302.ai/dashboard/api-record?page=1&limit=20', auth: 'Bearer sk-runtime-one' }
  ])
})

test('uses camelCase runtime key returned by dashboard detail for an api name', async () => {
  const originalFetch = global.fetch
  const originalEnv = {
    dashboard302ApiBaseUrl: env.dashboard302ApiBaseUrl,
    dashboard302ApiKey: env.dashboard302ApiKey,
    providerApiBaseUrl: env.providerApiBaseUrl,
    providerApiBaseUrls: env.providerApiBaseUrls,
    providerApiKey: env.providerApiKey,
    dashboard302TimeoutMs: env.dashboard302TimeoutMs
  }
  const attempts = []

  env.dashboard302ApiBaseUrl = 'https://api.302.ai'
  env.dashboard302ApiKey = 'sk-dashboard'
  env.providerApiBaseUrl = ''
  env.providerApiBaseUrls = ''
  env.providerApiKey = ''
  env.dashboard302TimeoutMs = 5000

  global.fetch = async (url, options = {}) => {
    const requestUrl = String(url)
    attempts.push({
      url: requestUrl,
      auth: options.headers?.Authorization
    })

    if (/\/dashboard\/api_key\/eager_user_camel$/.test(requestUrl)) {
      return new Response(JSON.stringify({
        code: 0,
        data: {
          api_name: 'eager_user_camel',
          apiKey: 'sk-runtime-camel'
        }
      }), { status: 200 })
    }

    if (/\/dashboard\/api_keys$/.test(requestUrl)) {
      return new Response(JSON.stringify({
        code: 0,
        data: [
          {
            api_name: 'eager_user_camel',
            apiKey: 'sk-runtime-camel'
          }
        ]
      }), { status: 200 })
    }

    if (/\/dashboard\/api-record\?page=1&limit=20/.test(requestUrl)) {
      return new Response(JSON.stringify({
        items: [{ request_id: 'req-camel', cost: 2.5 }],
        pagination: { total_page: 1, cur_page: 1, limit: 20 }
      }), { status: 200 })
    }

    assert.fail(`Unexpected 302 mock request: ${requestUrl}`)
  }

  try {
    const result = await get302ApiRecordsForApiName('eager_user_camel', { page: 1, limit: 20 })
    const normalized = normalize302ApiRecordList(result)
    assert.deepEqual(normalized.items.map((item) => item.request_id), ['req-camel'])
  } finally {
    global.fetch = originalFetch
    Object.assign(env, originalEnv)
  }

  assert.deepEqual(attempts, [
    { url: 'https://api.302.ai/dashboard/api_key/eager_user_camel', auth: 'Bearer sk-dashboard' },
    { url: 'https://api.302.ai/dashboard/api-record?page=1&limit=20', auth: 'Bearer sk-runtime-camel' }
  ])
})

test('runtime key lookup can throw with safe diagnostics when requested', async () => {
  const originalFetch = global.fetch
  const originalEnv = {
    dashboard302ApiBaseUrl: env.dashboard302ApiBaseUrl,
    dashboard302ApiKey: env.dashboard302ApiKey,
    providerApiBaseUrl: env.providerApiBaseUrl,
    providerApiBaseUrls: env.providerApiBaseUrls,
    providerApiKey: env.providerApiKey,
    dashboard302TimeoutMs: env.dashboard302TimeoutMs
  }

  env.dashboard302ApiBaseUrl = 'https://api.302.ai'
  env.dashboard302ApiKey = 'sk-dashboard-secret'
  env.providerApiBaseUrl = ''
  env.providerApiBaseUrls = ''
  env.providerApiKey = ''
  env.dashboard302TimeoutMs = 5000

  global.fetch = async (url) => {
    const requestUrl = String(url)
    if (/\/dashboard\/api_key\/missing-key$/.test(requestUrl)) {
      return new Response(JSON.stringify({ msg: 'Not Found' }), { status: 404 })
    }
    if (/\/dashboard\/api_keys$/.test(requestUrl)) {
      return new Response(JSON.stringify({ code: 0, data: [] }), { status: 200 })
    }
    assert.fail(`Unexpected 302 mock request: ${requestUrl}`)
  }

  try {
    await assert.rejects(
      () => get302RuntimeApiKeyByName('missing-key', { throwOnMissing: true }),
      (error) => {
        assert.equal(error.code, 'DASHBOARD_302_API_KEY_NOT_FOUND')
        assert.deepEqual(error.dashboard302Attempts, [
          {
            method: 'GET',
            path: '/dashboard/api_key/missing-key',
            baseHost: 'api.302.ai',
            status: 404,
            message: 'Not Found',
            authSource: 'dashboard'
          },
          {
            method: 'GET',
            path: '/dashboard/api_key/missing-key',
            baseHost: 'api.302ai.cn',
            status: 404,
            message: 'Not Found',
            authSource: 'dashboard'
          }
        ])
        assert.doesNotMatch(JSON.stringify(error.dashboard302Attempts), /sk-dashboard-secret/)
        return true
      }
    )
  } finally {
    global.fetch = originalFetch
    Object.assign(env, originalEnv)
  }
})

test('normalizes dashboard record amount aliases used by 302 records', () => {
  const record = normalizeDashboardRecord({
    model_name: 'gpt-test',
    prompt_tokens: 10,
    completion_tokens: 5,
    amount: 0.42
  })

  assert.equal(record.model, 'gpt-test')
  assert.equal(record.inputTokens, 10)
  assert.equal(record.outputTokens, 5)
  assert.equal(record.costUsd, 0.42)
})

test('attaches provider request id from response headers for later billing reconciliation', () => {
  const response = new Response(JSON.stringify({ ok: true }), {
    headers: {
      'request-id': 'req-from-header'
    }
  })

  const payload = attachProviderResponseMetadata({ ok: true }, response)

  assert.equal(payload.request_id, 'req-from-header')
  assert.equal(payload.raw.request_id, 'req-from-header')
})
