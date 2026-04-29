import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildBillingRecordPayload,
  normalizeProviderBillingRecord,
  resolveBillingMatch
} from './billing-reconciliation.service.js'

test('normalizeProviderBillingRecord extracts request, task, api name, model, usage, and cost', () => {
  const record = normalizeProviderBillingRecord({
    request_id: 'req-1',
    task_id: 'task-1',
    api_name: 'eager_user_a12b34c56d784e90',
    model_name: 'gemini-test',
    status: 'success',
    input_token: 12,
    output_token: 34,
    image_count: 2,
    amount: '0.123456',
    created_at: '2026-04-29T01:02:03.000Z'
  })

  assert.equal(record.upstreamRequestId, 'req-1')
  assert.equal(record.upstreamTaskId, 'task-1')
  assert.equal(record.providerApiName, 'eager_user_a12b34c56d784e90')
  assert.equal(record.model, 'gemini-test')
  assert.equal(record.inputTokens, 12)
  assert.equal(record.outputTokens, 34)
  assert.equal(record.imageCount, 2)
  assert.equal(record.costAmount, 0.123456)
  assert.equal(record.officialCreatedAt, '2026-04-29T01:02:03.000Z')
})

test('resolveBillingMatch prioritizes request id, then task id, then credential api name', () => {
  const usageEvents = [
    { id: 'usage-request', provider_request_id: 'req-1', upstream_task_id: 'task-x', user_id: 'user-a' },
    { id: 'usage-task', provider_request_id: 'req-x', upstream_task_id: 'task-1', user_id: 'user-b' }
  ]
  const credentials = [
    { id: 'cred-1', provider_api_name: 'eager_user_a12b34c56d784e90', user_id: 'user-c' }
  ]

  assert.deepEqual(
    resolveBillingMatch({ upstreamRequestId: 'req-1', upstreamTaskId: 'task-1', providerApiName: 'eager_user_a12b34c56d784e90' }, { usageEvents, credentials }),
    { usageEventId: 'usage-request', serviceCredentialId: null, userId: 'user-a', reconciliationStatus: 'matched' }
  )
  assert.deepEqual(
    resolveBillingMatch({ upstreamRequestId: '', upstreamTaskId: 'task-1', providerApiName: 'eager_user_a12b34c56d784e90' }, { usageEvents, credentials }),
    { usageEventId: 'usage-task', serviceCredentialId: null, userId: 'user-b', reconciliationStatus: 'matched' }
  )
  assert.deepEqual(
    resolveBillingMatch({ upstreamRequestId: '', upstreamTaskId: '', providerApiName: 'eager_user_a12b34c56d784e90' }, { usageEvents, credentials }),
    { usageEventId: null, serviceCredentialId: 'cred-1', userId: 'user-c', reconciliationStatus: 'matched' }
  )
})

test('buildBillingRecordPayload never exposes raw service credential secrets', () => {
  const payload = buildBillingRecordPayload(
    normalizeProviderBillingRecord({
      request_id: 'req-1',
      api_name: 'eager_user_a12b34c56d784e90',
      cost: 0.2
    }),
    {
      usageEventId: null,
      serviceCredentialId: 'cred-1',
      userId: 'user-1',
      reconciliationStatus: 'matched'
    }
  )

  assert.equal(payload.upstream_request_id, 'req-1')
  assert.equal(payload.service_credential_id, 'cred-1')
  assert.equal(payload.user_id, 'user-1')
  assert.equal(payload.cost_amount, 0.2)
  assert.equal(Object.hasOwn(payload, 'api_key'), false)
  assert.equal(Object.hasOwn(payload, 'api_key_encrypted'), false)
})
