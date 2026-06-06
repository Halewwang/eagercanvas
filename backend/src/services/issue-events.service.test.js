import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildIssueEventRecord,
  recordIssueEvent
} from './issue-events.service.js'

const createInsertQuery = (result) => ({
  select() {
    return {
      single: async () => result
    }
  }
})

const createFakeSupabase = () => {
  const calls = []
  return {
    calls,
    from(table) {
      const query = {
        insert(payload) {
          calls.push({ table, op: 'insert', payload })
          return createInsertQuery({
            data: { id: `${table}-id`, ...(Array.isArray(payload) ? payload[0] : payload) },
            error: null
          })
        },
        update(payload) {
          calls.push({ table, op: 'update', payload })
          return {
            eq() {
              return createInsertQuery({ data: { id: `${table}-updated`, ...payload }, error: null })
            }
          }
        },
        select() {
          return query
        },
        eq(column, value) {
          calls.push({ table, op: 'eq', column, value })
          return query
        },
        maybeSingle: async () => ({ data: null, error: null })
      }
      return query
    }
  }
}

test('buildIssueEventRecord sanitizes payload and derives a fingerprint', () => {
  const record = buildIssueEventRecord({
    source_layer: 'frontend',
    category: 'api_error',
    route: '/canvas/123',
    method: 'POST',
    path_template: '/api/v1/images/generations',
    status_code: 502,
    message_summary: 'failed',
    metadata: {
      prompt: 'secret prompt',
      model: 'gpt-image-2'
    }
  }, {
    now: () => '2026-06-06T00:00:00.000Z'
  })

  assert.equal(record.source_layer, 'frontend')
  assert.equal(record.severity, 'p2')
  assert.equal(record.metadata.prompt, '[redacted]')
  assert.equal(record.metadata.model, 'gpt-image-2')
  assert.match(record.fingerprint, /^sha256:/)
  assert.equal(record.created_at, '2026-06-06T00:00:00.000Z')
})

test('recordIssueEvent inserts event and creates an issue group without leaking metadata', async () => {
  const supabaseClient = createFakeSupabase()

  const result = await recordIssueEvent({
    source_layer: 'provider',
    category: 'provider_error',
    provider: '302ai',
    model: 'gpt-image-2',
    upstream_status: 200,
    error_code: 'COMPLETED_WITHOUT_ASSET',
    user_id: '11111111-1111-1111-1111-111111111111',
    session_hash: 'session-1',
    route: '/canvas/abc',
    metadata: {
      prompt: 'private prompt',
      operation: 'image_generation'
    }
  }, {
    supabaseClient,
    now: () => '2026-06-06T00:00:00.000Z'
  })

  assert.equal(result.ok, true)
  const eventInsert = supabaseClient.calls.find((call) => call.table === 'issue_events' && call.op === 'insert')
  const groupInsert = supabaseClient.calls.find((call) => call.table === 'issue_groups' && call.op === 'insert')
  assert.ok(eventInsert)
  assert.ok(groupInsert)
  assert.equal(eventInsert.payload.metadata.prompt, '[redacted]')
  assert.equal(groupInsert.payload.event_count, 1)
  assert.equal(groupInsert.payload.affected_users, 1)
  assert.equal(groupInsert.payload.evidence_summary.providers[0], '302ai')
  assert.equal(groupInsert.payload.codex_handoff.evidence.provider, '302ai')
})
