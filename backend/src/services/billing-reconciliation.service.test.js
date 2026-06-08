import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildBillingRecordPayload,
  normalizeProviderBillingRecord,
  resolveBillingMatch,
  syncProviderBillingRecords
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

test('syncProviderBillingRecords upserts task-only records by upstream task id', async () => {
  const upsertCalls = []
  const fakeSupabase = {
    from(table) {
      return {
        select() {
          return this
        },
        in(column) {
          if (table === 'usage_events' && column === 'upstream_task_id') {
            return Promise.resolve({
              data: [
                {
                  id: 'usage-1',
                  user_id: 'user-1',
                  run_id: 'run-1',
                  service_credential_id: 'cred-1',
                  provider_request_id: null,
                  upstream_task_id: 'task-only-1'
                }
              ],
              error: null
            })
          }
          return Promise.resolve({ data: [], error: null })
        },
        upsert(payloads, options) {
          upsertCalls.push({ table, payloads, options })
          return {
            select: async () => ({
              data: payloads.map((payload, index) => ({
                id: `billing-${index + 1}`,
                usage_event_id: payload.usage_event_id,
                cost_amount: payload.cost_amount,
                reconciliation_status: payload.reconciliation_status
              })),
              error: null
            })
          }
        },
        update() {
          return {
            eq: async () => ({ data: null, error: null })
          }
        }
      }
    }
  }

  await syncProviderBillingRecords(
    { startTime: '2026-04-29T00:00:00.000Z', endTime: '2026-04-29T00:15:00.000Z' },
    {
      supabaseClient: fakeSupabase,
      fetchRecords: async () => ({
        data: {
          items: [
            {
              task_id: 'task-only-1',
              api_name: 'eager_user_a12b34c56d784e90',
              cost: 0.2
            }
          ]
        }
      })
    }
  )

  assert.equal(upsertCalls.length, 1)
  assert.equal(upsertCalls[0].table, 'provider_billing_records')
  assert.equal(upsertCalls[0].options.onConflict, 'upstream_task_id')
  assert.equal(upsertCalls[0].payloads[0].upstream_request_id, null)
  assert.equal(upsertCalls[0].payloads[0].upstream_task_id, 'task-only-1')
})

test('syncProviderBillingRecords fetches all dashboard record pages', async () => {
  const fetchPages = []
  const inserted = []
  const fakeSupabase = {
    from(table) {
      return {
        select() {
          return this
        },
        in(column, values) {
          if (table === 'user_service_credentials' && column === 'provider_api_name') {
            return Promise.resolve({
              data: values.map((apiName, index) => ({
                id: `cred-${index + 1}`,
                user_id: `user-${index + 1}`,
                provider_api_name: apiName
              })),
              error: null
            })
          }
          return Promise.resolve({ data: [], error: null })
        },
        upsert(payloads) {
          inserted.push(...payloads)
          return {
            select: async () => ({
              data: payloads.map((payload, index) => ({
                id: `billing-${inserted.length + index}`,
                usage_event_id: payload.usage_event_id,
                cost_amount: payload.cost_amount,
                reconciliation_status: payload.reconciliation_status
              })),
              error: null
            })
          }
        },
        update() {
          return {
            eq: async () => ({ data: null, error: null })
          }
        }
      }
    }
  }

  const result = await syncProviderBillingRecords(
    { startTime: '2026-04-29T00:00:00.000Z', endTime: '2026-04-29T00:15:00.000Z', pageSize: 1 },
    {
      supabaseClient: fakeSupabase,
      fetchRecords: async ({ page }) => {
        fetchPages.push(page)
        return {
          data: {
            items: [{ request_id: `req-${page}`, api_name: `eager_user_${page}`, cost: page }],
            pagination: { page, total_pages: 2 }
          }
        }
      }
    }
  )

  assert.deepEqual(fetchPages, [1, 2])
  assert.equal(result.fetched, 2)
  assert.equal(inserted.length, 2)
})

test('syncProviderBillingRecords follows documented total_page pagination fields', async () => {
  const fetchPages = []
  const fakeSupabase = {
    from(table) {
      return {
        select() {
          return this
        },
        in() {
          if (table === 'user_service_credentials') {
            return Promise.resolve({ data: [], error: null })
          }
          return Promise.resolve({ data: [], error: null })
        },
        upsert(payloads) {
          return {
            select: async () => ({
              data: payloads.map((payload, index) => ({
                id: `billing-${index + 1}`,
                usage_event_id: payload.usage_event_id,
                cost_amount: payload.cost_amount,
                reconciliation_status: payload.reconciliation_status
              })),
              error: null
            })
          }
        },
        insert(payloads) {
          return {
            select: async () => ({
              data: payloads.map((payload, index) => ({
                id: `billing-insert-${index + 1}`,
                usage_event_id: payload.usage_event_id,
                cost_amount: payload.cost_amount,
                reconciliation_status: payload.reconciliation_status
              })),
              error: null
            })
          }
        },
        update() {
          return {
            eq: async () => ({ data: null, error: null })
          }
        }
      }
    }
  }

  const result = await syncProviderBillingRecords(
    { startTime: '2026-04-29T00:00:00.000Z', endTime: '2026-04-29T00:15:00.000Z', pageSize: 1 },
    {
      supabaseClient: fakeSupabase,
      fetchRecords: async ({ page }) => {
        fetchPages.push(page)
        return {
          items: [{ request_id: `req-doc-${page}`, api_name: `eager_user_doc_${page}`, cost: page }],
          pagination: { cur_page: page, total_page: 2 }
        }
      }
    }
  )

  assert.deepEqual(fetchPages, [1, 2])
  assert.equal(result.fetched, 2)
})
