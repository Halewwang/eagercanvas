import assert from 'node:assert/strict'
import test from 'node:test'

import {
  resolveDashboard302BaseUrl,
  assert302DashboardSuccess,
  buildDashboard302AuthHeaders,
  get302Balance,
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
