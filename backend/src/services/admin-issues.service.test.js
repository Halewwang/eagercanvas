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

test('updateIssueGroupStatus rejects unsupported statuses', async () => {
  await assert.rejects(
    () => updateIssueGroupStatus('issue-1', 'deleted'),
    /Unsupported issue status/
  )
})
