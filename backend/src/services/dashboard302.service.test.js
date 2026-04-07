import assert from 'node:assert/strict'
import test from 'node:test'

import {
  resolveDashboard302BaseUrl,
  assert302DashboardSuccess,
  buildDashboard302AuthHeaders,
  shouldRetry302DashboardWithNextKey,
  normalize302ApiKeyList,
  normalize302ApiRecordList,
  normalizeDashboardRecord
} from './dashboard302.service.js'
import { attachProviderResponseMetadata } from './provider-response-metadata.js'

test('defaults dashboard management requests to official 302.ai host', () => {
  assert.equal(resolveDashboard302BaseUrl('', 'https://api.302ai.cn'), 'https://api.302.ai')
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
