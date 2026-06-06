import assert from 'node:assert/strict'
import { mock, test } from 'node:test'

import { supabase } from '../config/supabase.js'
import {
  getIssueGroupForAdmin,
  listIssueGroupsForAdmin,
  updateIssueGroupStatus
} from './admin-issues.service.js'

test('listIssueGroupsForAdmin filters and paginates issue groups', async () => {
  const calls = []
  const restore = mock.method(supabase, 'from', (table) => {
    assert.equal(table, 'issue_groups')
    return {
      select(columns, options) {
        calls.push(['select', columns, options])
        return this
      },
      eq(column, value) {
        calls.push(['eq', column, value])
        return this
      },
      in(column, values) {
        calls.push(['in', column, values])
        return this
      },
      gte(column, value) {
        calls.push(['gte', column, value])
        return this
      },
      lte(column, value) {
        calls.push(['lte', column, value])
        return this
      },
      order(column, options) {
        calls.push(['order', column, options])
        return this
      },
      range(from, to) {
        calls.push(['range', from, to])
        return Promise.resolve({
          data: [{ id: 'issue-1', title: 'Provider failed', severity: 'p1' }],
          error: null,
          count: 1
        })
      }
    }
  })

  try {
    const result = await listIssueGroupsForAdmin({
      status: 'open',
      severity: 'p1,p2',
      sourceLayer: 'provider',
      from: '2026-06-06T00:00:00.000Z',
      to: '2026-06-07T00:00:00.000Z',
      page: 1,
      limit: 20
    })

    assert.equal(result.items[0].id, 'issue-1')
    assert.deepEqual(result.pagination, { page: 1, limit: 20, total: 1 })
    assert.ok(calls.some((call) => call[0] === 'eq' && call[1] === 'status' && call[2] === 'open'))
    assert.ok(calls.some((call) => call[0] === 'in' && call[1] === 'severity'))
    assert.ok(calls.some((call) => call[0] === 'eq' && call[1] === 'source_layer' && call[2] === 'provider'))
  } finally {
    restore.mock.restore()
  }
})

test('listIssueGroupsForAdmin merges similar issue groups for inbox display', async () => {
  const restore = mock.method(supabase, 'from', (table) => {
    assert.equal(table, 'issue_groups')
    return {
      select() {
        return this
      },
      eq() {
        return this
      },
      in() {
        return this
      },
      gte() {
        return this
      },
      lte() {
        return this
      },
      order() {
        return this
      },
      range() {
        return Promise.resolve({
          data: [
            {
              id: 'slow-1',
              title: 'performance slow_request /api/v1/images/:taskId',
              severity: 'p2',
              status: 'open',
              source_layer: 'performance',
              category: 'slow_request',
              event_count: 1,
              affected_users: 1,
              first_seen_at: '2026-06-06T00:00:00.000Z',
              last_seen_at: '2026-06-06T00:01:00.000Z',
              latest_request_id: 'req-1',
              evidence_summary: {
                users: ['user-1'],
                api_paths: ['/api/v1/images/:taskId'],
                request_ids: ['req-1'],
                errors: ['Slow request: 3605ms']
              }
            },
            {
              id: 'slow-2',
              title: 'performance slow_request /api/v1/images/:taskId',
              severity: 'p2',
              status: 'open',
              source_layer: 'performance',
              category: 'slow_request',
              event_count: 1,
              affected_users: 1,
              first_seen_at: '2026-06-06T00:00:30.000Z',
              last_seen_at: '2026-06-06T00:02:00.000Z',
              latest_request_id: 'req-2',
              evidence_summary: {
                users: ['user-1'],
                api_paths: ['/api/v1/images/:taskId'],
                request_ids: ['req-2'],
                errors: ['Slow request: 12576ms']
              }
            }
          ],
          error: null,
          count: 2
        })
      }
    }
  })

  try {
    const result = await listIssueGroupsForAdmin({ status: 'open' })
    assert.equal(result.items.length, 1)
    assert.equal(result.items[0].event_count, 2)
    assert.equal(result.items[0].affected_users, 1)
    assert.deepEqual(result.items[0].merged_group_ids.sort(), ['slow-1', 'slow-2'])
    assert.equal(result.pagination.total, 1)
  } finally {
    restore.mock.restore()
  }
})

test('getIssueGroupForAdmin returns group with recent events', async () => {
  const restore = mock.method(supabase, 'from', (table) => {
    if (table === 'issue_groups') {
      return {
        select() { return this },
        eq(column, value) {
          assert.equal(column, 'id')
          assert.equal(value, 'issue-1')
          return this
        },
        maybeSingle: async () => ({
          data: { id: 'issue-1', title: 'Provider failed' },
          error: null
        })
      }
    }
    if (table === 'issue_events') {
      return {
        select() { return this },
        eq(column, value) {
          assert.equal(column, 'fingerprint')
          assert.equal(value, 'sha')
          return this
        },
        order() { return this },
        limit() {
          return Promise.resolve({
            data: [{ id: 'event-1', fingerprint: 'sha' }],
            error: null
          })
        }
      }
    }
    throw new Error(`unexpected table ${table}`)
  })

  try {
    const result = await getIssueGroupForAdmin('issue-1', { fingerprint: 'sha' })
    assert.equal(result.group.id, 'issue-1')
    assert.equal(result.events[0].id, 'event-1')
  } finally {
    restore.mock.restore()
  }
})

test('getIssueGroupForAdmin can return merged group details for selected inbox rows', async () => {
  const restore = mock.method(supabase, 'from', (table) => {
    if (table === 'issue_groups') {
      return {
        select() { return this },
        in(column, values) {
          assert.equal(column, 'id')
          assert.deepEqual(values, ['issue-1', 'issue-2'])
          return Promise.resolve({
            data: [
              {
                id: 'issue-1',
                title: 'database EROFS /api/v1/admin/issues/export',
                source_layer: 'database',
                category: 'db_error',
                severity: 'p1',
                status: 'open',
                fingerprint: 'sha-1',
                event_count: 1,
                first_seen_at: '2026-06-06T00:00:00.000Z',
                last_seen_at: '2026-06-06T00:01:00.000Z',
                evidence_summary: {
                  api_paths: ['/api/v1/admin/issues/export'],
                  errors: ['EROFS'],
                  request_ids: ['req-1']
                }
              },
              {
                id: 'issue-2',
                title: 'frontend INTERNAL_ERROR /admin/issues/export',
                source_layer: 'frontend',
                category: 'api_error',
                severity: 'p1',
                status: 'open',
                fingerprint: 'sha-2',
                event_count: 1,
                first_seen_at: '2026-06-06T00:00:30.000Z',
                last_seen_at: '2026-06-06T00:02:00.000Z',
                evidence_summary: {
                  api_paths: ['/admin/issues/export'],
                  errors: ['INTERNAL_ERROR'],
                  request_ids: ['req-2']
                },
                codex_handoff: {
                  evidence: {
                    message_summary: 'EROFS: read-only file system'
                  }
                }
              }
            ],
            error: null
          })
        }
      }
    }
    if (table === 'issue_events') {
      return {
        select() { return this },
        in(column, values) {
          assert.equal(column, 'fingerprint')
          assert.deepEqual(values.sort(), ['sha-1', 'sha-2'])
          return this
        },
        order() { return this },
        limit() {
          return Promise.resolve({
            data: [
              { id: 'event-1', fingerprint: 'sha-1', message_summary: 'EROFS' },
              { id: 'event-2', fingerprint: 'sha-2', message_summary: 'EROFS' }
            ],
            error: null
          })
        }
      }
    }
    throw new Error(`unexpected table ${table}`)
  })

  try {
    const result = await getIssueGroupForAdmin('issue-1', { groupIds: 'issue-1,issue-2' })
    assert.equal(result.group.merged_group_count, 2)
    assert.deepEqual(result.group.merged_group_ids.sort(), ['issue-1', 'issue-2'])
    assert.equal(result.events.length, 2)
  } finally {
    restore.mock.restore()
  }
})

test('updateIssueGroupStatus rejects unsupported statuses', async () => {
  await assert.rejects(
    () => updateIssueGroupStatus('issue-1', 'deleted'),
    /Unsupported issue status/
  )
})
