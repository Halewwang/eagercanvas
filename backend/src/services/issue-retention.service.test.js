import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildIssueRetentionCutoffs,
  pruneIssueObservability
} from './issue-retention.service.js'

test('buildIssueRetentionCutoffs defaults to 30 day events and 180 day notifications', () => {
  const cutoffs = buildIssueRetentionCutoffs({
    now: new Date('2026-06-30T00:00:00.000Z')
  })

  assert.equal(cutoffs.eventCutoff, '2026-05-31T00:00:00.000Z')
  assert.equal(cutoffs.notificationCutoff, '2026-01-01T00:00:00.000Z')
})

test('pruneIssueObservability dry run counts rows without deleting', async () => {
  const calls = []
  const supabaseClient = {
    from(table) {
      return {
        select(_columns, options) {
          calls.push({ table, op: 'select', options })
          return this
        },
        lt(column, value) {
          calls.push({ table, op: 'lt', column, value })
          return Promise.resolve({ count: table === 'issue_events' ? 3 : 1, error: null })
        },
        delete() {
          calls.push({ table, op: 'delete' })
          return this
        }
      }
    }
  }

  const result = await pruneIssueObservability({
    supabaseClient,
    dryRun: true,
    now: new Date('2026-06-30T00:00:00.000Z')
  })

  assert.equal(result.ok, true)
  assert.equal(result.matched.issue_events, 3)
  assert.equal(result.deleted.issue_events, 0)
  assert.equal(calls.some((call) => call.op === 'delete'), false)
})
