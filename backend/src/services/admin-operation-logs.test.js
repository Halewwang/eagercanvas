import assert from 'node:assert/strict'
import { mock, test } from 'node:test'

import { supabase } from '../config/supabase.js'
import { createAdminLog, listAdminOperationLogs } from './admin-operation-logs.js'

const missingRelationError = { message: 'relation "admin_operation_logs" does not exist' }

test('createAdminLog falls back to audit_logs when admin operation log table is missing', async () => {
  const inserts = []
  const restore = mock.method(supabase, 'from', (table) => {
    if (table === 'admin_operation_logs') {
      return {
        insert(payload) {
          inserts.push({ table, payload })
          return Promise.resolve({ error: missingRelationError })
        }
      }
    }
    if (table === 'audit_logs') {
      return {
        insert(payload) {
          inserts.push({ table, payload })
          return Promise.resolve({ error: null })
        }
      }
    }
    throw new Error(`unexpected table ${table}`)
  })

  try {
    await createAdminLog({
      operatorUserId: 'operator-1',
      targetUserId: 'target-1',
      action: 'admin.user.status.update',
      metadata: { reason: 'test' }
    })
  } finally {
    restore.mock.restore()
  }

  assert.deepEqual(inserts, [
    {
      table: 'admin_operation_logs',
      payload: {
        operator_user_id: 'operator-1',
        target_user_id: 'target-1',
        action: 'admin.user.status.update',
        metadata: { reason: 'test' }
      }
    },
    {
      table: 'audit_logs',
      payload: {
        user_id: 'operator-1',
        action: 'admin.user.status.update',
        metadata: {
          reason: 'test',
          targetUserId: 'target-1'
        }
      }
    }
  ])
})

test('listAdminOperationLogs maps operator and target emails with bounded pagination', async () => {
  const ranges = []
  const restore = mock.method(supabase, 'from', (table) => {
    if (table === 'admin_operation_logs') {
      return {
        select(_columns, options) {
          assert.deepEqual(options, { count: 'exact' })
          return this
        },
        order(column, options) {
          assert.equal(column, 'created_at')
          assert.deepEqual(options, { ascending: false })
          return this
        },
        range(from, to) {
          ranges.push({ from, to })
          return Promise.resolve({
            data: [
              {
                id: 'log-1',
                operator_user_id: 'operator-1',
                target_user_id: 'target-1',
                action: 'admin.user.delete',
                metadata: { reason: 'cleanup' },
                created_at: '2026-06-01T00:00:00.000Z'
              }
            ],
            error: null,
            count: 120
          })
        }
      }
    }
    if (table === 'users') {
      return {
        select(columns) {
          assert.equal(columns, 'id, email')
          return this
        },
        in(column, ids) {
          assert.equal(column, 'id')
          assert.deepEqual(ids.sort(), ['operator-1', 'target-1'])
          return Promise.resolve({
            data: [
              { id: 'operator-1', email: 'operator@example.com' },
              { id: 'target-1', email: 'target@example.com' }
            ],
            error: null
          })
        }
      }
    }
    throw new Error(`unexpected table ${table}`)
  })

  try {
    const result = await listAdminOperationLogs({ page: 2, limit: 200 })

    assert.deepEqual(ranges, [{ from: 100, to: 199 }])
    assert.equal(result.pagination.page, 2)
    assert.equal(result.pagination.limit, 100)
    assert.equal(result.pagination.total, 120)
    assert.deepEqual(result.items[0].operator, {
      id: 'operator-1',
      email: 'operator@example.com'
    })
    assert.deepEqual(result.items[0].target, {
      id: 'target-1',
      email: 'target@example.com'
    })
  } finally {
    restore.mock.restore()
  }
})
