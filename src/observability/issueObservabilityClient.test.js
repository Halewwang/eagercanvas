import assert from 'node:assert/strict'
import test from 'node:test'

import {
  OBSERVABILITY_MAX_FLUSH_BYTES,
  OBSERVABILITY_SLOW_API_MS,
  createIssueObservabilityClient,
  installIssueFlushLifecycle,
  sanitizeIssueEvent
} from './issueObservabilityCore.js'

test('frontend slow API threshold matches PRD', () => {
  assert.equal(OBSERVABILITY_SLOW_API_MS, 2000)
  assert.equal(OBSERVABILITY_MAX_FLUSH_BYTES, 128 * 1024)
})

test('sanitizeIssueEvent redacts sensitive metadata', () => {
  const event = sanitizeIssueEvent({
    category: 'runtime_error',
    message_summary: 'Bearer secret-token failed',
    metadata: {
      prompt: 'private prompt',
      request_id: 'req-1',
      nested: { value: true }
    }
  })

  assert.equal(event.metadata.prompt, '[redacted]')
  assert.equal(event.metadata.request_id, 'req-1')
  assert.equal(event.metadata.nested, '[object]')
  assert.match(event.message_summary, /\[redacted\]/)
})

test('sanitizeIssueEvent bounds metadata keys', () => {
  const metadata = Object.fromEntries(Array.from({ length: 25 }, (_, index) => [`key_${index}`, 'value']))
  const event = sanitizeIssueEvent({ metadata })

  assert.equal(Object.keys(event.metadata).length, 21)
  assert.equal(event.metadata._truncated, true)
})

test('client flushes at batch size and preserves queued overflow', async () => {
  const batches = []
  const client = createIssueObservabilityClient({
    sender: async (events) => {
      batches.push(events)
      return { ok: true, status: 200 }
    },
    setTimer: () => 1,
    clearTimer: () => {},
    maxBatch: 3
  })

  client.capture({ category: 'runtime_error', message_summary: 'a' })
  client.capture({ category: 'runtime_error', message_summary: 'b' })
  client.capture({ category: 'runtime_error', message_summary: 'c' })
  await new Promise((resolve) => setImmediate(resolve))

  assert.equal(batches.length, 1)
  assert.equal(batches[0].length, 3)
})

test('client keeps single flush payload under byte limit by preserving overflow', async () => {
  const batches = []
  const client = createIssueObservabilityClient({
    sender: async (events) => {
      batches.push(events)
      return { ok: true, status: 200 }
    },
    setTimer: () => 1,
    clearTimer: () => {},
    maxBatch: 3,
    maxFlushBytes: 900
  })

  const metadata = Object.fromEntries(Array.from({ length: 20 }, (_, index) => [`key_${index}`, 'x'.repeat(40)]))
  client.capture({ category: 'runtime_error', message_summary: 'a', metadata })
  client.capture({ category: 'runtime_error', message_summary: 'b', metadata })
  client.capture({ category: 'runtime_error', message_summary: 'c', metadata })
  await new Promise((resolve) => setImmediate(resolve))

  assert.equal(batches.length, 1)
  assert.equal(batches[0].length, 1)
  assert.equal(client.state.queue.length, 2)
})

test('client limits same fingerprint to three events in five minutes', () => {
  let current = 1000
  const client = createIssueObservabilityClient({
    sender: async () => ({ ok: true, status: 200 }),
    now: () => current,
    setTimer: () => 1,
    clearTimer: () => {}
  })

  assert.equal(client.capture({ category: 'runtime_error', message_summary: 'same' }), true)
  assert.equal(client.capture({ category: 'runtime_error', message_summary: 'same' }), true)
  assert.equal(client.capture({ category: 'runtime_error', message_summary: 'same' }), true)
  assert.equal(client.capture({ category: 'runtime_error', message_summary: 'same' }), false)
  current += 5 * 60_000 + 1
  assert.equal(client.capture({ category: 'runtime_error', message_summary: 'same' }), true)
})

test('client stops after 429 response', async () => {
  const client = createIssueObservabilityClient({
    sender: async () => ({ ok: false, status: 429 }),
    setTimer: () => 1,
    clearTimer: () => {},
    maxBatch: 1
  })

  assert.equal(client.capture({ category: 'runtime_error', message_summary: 'a' }), true)
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(client.state.stopped, true)
  assert.equal(client.capture({ category: 'runtime_error', message_summary: 'b' }), false)
})

test('client stops after session event limit is reached', () => {
  const client = createIssueObservabilityClient({
    sender: async () => ({ ok: true, status: 200 }),
    setTimer: () => 1,
    clearTimer: () => {},
    sessionLimit: 2
  })

  assert.equal(client.capture({ category: 'runtime_error', message_summary: 'a' }), true)
  assert.equal(client.capture({ category: 'runtime_error', message_summary: 'b' }), true)
  assert.equal(client.state.stopped, true)
  assert.equal(client.capture({ category: 'runtime_error', message_summary: 'c' }), false)
})

test('flush lifecycle flushes queued events on hidden page and pagehide', () => {
  const handlers = {}
  const documentTarget = {
    visibilityState: 'visible',
    addEventListener: (event, handler) => {
      handlers[`document:${event}`] = handler
    }
  }
  const windowTarget = {
    addEventListener: (event, handler) => {
      handlers[`window:${event}`] = handler
    }
  }
  let flushCount = 0

  installIssueFlushLifecycle({
    documentTarget,
    windowTarget,
    client: {
      flush: () => {
        flushCount += 1
      }
    }
  })

  handlers['document:visibilitychange']()
  assert.equal(flushCount, 0)
  documentTarget.visibilityState = 'hidden'
  handlers['document:visibilitychange']()
  handlers['window:pagehide']()
  assert.equal(flushCount, 2)
})
