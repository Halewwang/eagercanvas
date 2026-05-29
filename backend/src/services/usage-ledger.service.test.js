import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildUsageEventPayload,
  extractUsageSnapshot,
  sanitizeRawUsageForStorage
} from './usage-ledger.service.js'

test('sanitizeRawUsageForStorage omits inline image payloads while preserving identifiers', () => {
  const dataUrl = `data:image/png;base64,${'a'.repeat(70_000)}`

  const sanitized = sanitizeRawUsageForStorage({
    request_id: 'req-123',
    task_id: 'task-123',
    status: 'completed',
    data: [{ url: dataUrl }]
  })

  const serialized = JSON.stringify(sanitized)
  assert.equal(sanitized._sanitized, true)
  assert.equal(sanitized.request_id, 'req-123')
  assert.equal(sanitized.task_id, 'task-123')
  assert.equal(serialized.includes(dataUrl), false)
  assert.ok(serialized.length < 4000)
})

test('buildUsageEventPayload stores sanitized raw usage JSON', () => {
  const dataUrl = `data:image/png;base64,${'b'.repeat(70_000)}`

  const payload = buildUsageEventPayload({
    userId: '00000000-0000-0000-0000-000000000001',
    runId: '00000000-0000-0000-0000-000000000002',
    eventType: 'image',
    rawUsage: {
      request_id: 'req-456',
      result: {
        image: dataUrl
      }
    }
  })

  const serialized = JSON.stringify(payload.raw_usage)
  assert.equal(payload.raw_usage._sanitized, true)
  assert.equal(payload.raw_usage.request_id, 'req-456')
  assert.equal(serialized.includes(dataUrl), false)
})

test('extractUsageSnapshot reads usage from nested async image task wrappers', () => {
  const usage = extractUsageSnapshot({
    raw: {
      data: {
        cost: 0.05279,
        usage: {
          input_tokens: 12,
          output_tokens: 1414
        }
      }
    }
  })

  assert.deepEqual(usage, {
    inputTokens: 12,
    outputTokens: 1414,
    costUsd: 0.05279
  })
})
