import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildIssueAlertDecision,
  isIssueSeverityEligible,
  queueIssueAlertForGroup,
  sendIssueDigestEmail
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

test('sendIssueDigestEmail sends the current export package to the requested recipient', async () => {
  const calls = []
  const result = await sendIssueDigestEmail({
    to: 'ops@example.com',
    filters: { status: 'open', severity: 'p1', limit: 25 },
    exportIssues: async (options) => {
      calls.push(['export', options])
      return {
        generatedAt: '2026-06-11T08:00:00.000Z',
        issueCount: 2,
        jsonFileName: 'issue-inbox.json',
        jsonContent: '{"issue_count":2}',
        markdownFileName: 'issue-inbox.md',
        markdownContent: '# Codex Issue Inbox\n\nIssues: 2\n'
      }
    },
    sendEmail: async (payload) => {
      calls.push(['email', payload])
      return { ok: true, status: 'sent', id: 'msg-1' }
    }
  })

  assert.deepEqual(calls.find((call) => call[0] === 'export')[1], {
    writeFiles: false,
    filters: { status: 'open', severity: 'p1', limit: 25 }
  })
  const emailPayload = calls.find((call) => call[0] === 'email')[1]
  assert.equal(emailPayload.to, 'ops@example.com')
  assert.match(emailPayload.subject, /2 issues/)
  assert.match(emailPayload.text, /# Codex Issue Inbox/)
  assert.deepEqual(emailPayload.attachments.map((attachment) => attachment.filename), [
    'issue-inbox.json',
    'issue-inbox.md'
  ])
  assert.equal(result.ok, true)
  assert.equal(result.issueCount, 2)
  assert.equal(result.recipient, 'ops@example.com')
})
