import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildIssueAlertDecision,
  isIssueSeverityEligible,
  queueIssueAlertForGroup
} from './issue-notification.service.js'

test('isIssueSeverityEligible treats min severity as a ceiling', () => {
  assert.equal(isIssueSeverityEligible('p0', 'p1'), true)
  assert.equal(isIssueSeverityEligible('p1', 'p1'), true)
  assert.equal(isIssueSeverityEligible('p2', 'p1'), false)
})

test('buildIssueAlertDecision blocks cooldown and hourly limits', () => {
  const group = {
    id: 'group-1',
    status: 'open',
    severity: 'p1',
    last_notified_at: '2026-06-06T00:00:00.000Z'
  }

  assert.equal(buildIssueAlertDecision(group, {
    enabled: true,
    minSeverity: 'p1',
    cooldownMinutes: 30,
    now: () => '2026-06-06T00:10:00.000Z'
  }).reason, 'cooldown')

  assert.equal(buildIssueAlertDecision({ ...group, last_notified_at: null }, {
    enabled: true,
    minSeverity: 'p1',
    maxPerHour: 1,
    recentCount: 1
  }).reason, 'hourly_limit')
})

test('queueIssueAlertForGroup inserts one outbox row per recipient without throwing on skipped email', async () => {
  const calls = []
  const supabaseClient = {
    from(table) {
      const query = {
        select(_columns, options = {}) {
          calls.push({ table, op: 'select', options })
          if (options.head) {
            return {
              gte() { return this },
              in: async () => ({ count: 0, error: null })
            }
          }
          return this
        },
        insert(payload) {
          calls.push({ table, op: 'insert', payload })
          return {
            select: async () => ({
              data: payload.map((row, index) => ({ id: `notification-${index}`, attempts: 0, ...row })),
              error: null
            })
          }
        },
        gte() { return this },
        in: async () => ({ count: 0, error: null }),
        update(payload) {
          calls.push({ table, op: 'update', payload })
          return {
            eq() {
              return {
                select() {
                  return { single: async () => ({ data: payload, error: null }) }
                }
              }
            }
          }
        },
        eq() { return this },
        maybeSingle: async () => ({ data: { notification_count: 0 }, error: null })
      }
      return query
    }
  }

  const result = await queueIssueAlertForGroup({
    id: 'group-1',
    fingerprint: 'sha256:abc',
    status: 'open',
    severity: 'p1',
    title: 'Provider failed'
  }, {
    supabaseClient,
    force: true,
    recipients: ['ops@example.com'],
    sendEmail: async () => ({ status: 'skipped', reason: 'EMAIL_NOT_CONFIGURED' }),
    getDetails: async () => ({
      group: {
        id: 'group-1',
        fingerprint: 'sha256:abc',
        status: 'open',
        severity: 'p1',
        title: 'Provider failed',
        source_layer: 'provider',
        category: 'provider_error',
        event_count: 1,
        evidence_summary: {}
      },
      events: []
    })
  })

  assert.equal(result.ok, true)
  assert.ok(calls.some((call) => call.table === 'issue_notifications' && call.op === 'insert'))
  assert.ok(calls.some((call) => call.table === 'issue_notifications' && call.op === 'update' && call.payload.status === 'skipped'))
})
