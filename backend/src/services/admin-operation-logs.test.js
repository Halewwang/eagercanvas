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
      metadata: {
        reason: 'test password=write-secret',
        ip: '127.0.0.1 token=ip-secret',
        userAgent: 'Bearer write-bearer'
      }
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
        metadata: {
          reason: 'test password=[redacted]',
          ip: '127.0.0.1 token=[redacted]',
          userAgent: 'Bearer [redacted]'
        }
      }
    },
    {
      table: 'audit_logs',
      payload: {
        user_id: 'operator-1',
        action: 'admin.user.status.update',
        metadata: {
          reason: 'test password=[redacted]',
          ip: '127.0.0.1 token=[redacted]',
          userAgent: 'Bearer [redacted]',
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
                metadata: {
                  reason: 'cleanup password=audit-password',
                  userAgent: 'Bearer audit-bearer-token',
                  nested: { note: 'sk-audit-list-secret' }
                },
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
    assert.doesNotMatch(JSON.stringify(result.items[0].metadata), /audit-password|audit-bearer-token|sk-audit-list-secret/)
  } finally {
    restore.mock.restore()
  }
})

test('listAdminOperationLogs trims and applies target filter before ordering and range', async () => {
  const calls = []
  const restore = mock.method(supabase, 'from', (table) => {
    assert.equal(table, 'admin_operation_logs')
    return {
      select() {
        calls.push('select')
        return this
      },
      eq(column, value) {
        calls.push(`eq:${column}:${value}`)
        return this
      },
      order() {
        calls.push('order')
        return this
      },
      range(from, to) {
        calls.push(`range:${from}:${to}`)
        return Promise.resolve({ data: [], error: null, count: 0 })
      }
    }
  })

  try {
    await listAdminOperationLogs({ page: 1, limit: 20, targetUserId: '  target-1  ' })
    assert.deepEqual(calls, [
      'select',
      'eq:target_user_id:target-1',
      'order',
      'range:0:19'
    ])
  } finally {
    restore.mock.restore()
  }
})

test('listAdminOperationLogs rejects unsafe pagination before querying Supabase', async () => {
  let queried = false
  const restore = mock.method(supabase, 'from', () => {
    queried = true
    throw new Error('Supabase should not be queried')
  })

  try {
    await assert.rejects(
      listAdminOperationLogs({ page: 1e308, limit: 20 }),
      (error) => error.status === 400 && error.code === 'INVALID_PAGINATION'
    )
    assert.equal(queried, false)
  } finally {
    restore.mock.restore()
  }
})

test('required target mode rejects a blank decoded user id before querying Supabase', async () => {
  let queried = false
  const restore = mock.method(supabase, 'from', () => {
    queried = true
    throw new Error('blank required target must not query Supabase')
  })

  try {
    await assert.rejects(
      listAdminOperationLogs({ targetUserId: decodeURIComponent('%20'), requireTarget: true }),
      (error) => error.status === 400 && error.code === 'INVALID_TARGET_USER'
    )
    assert.equal(queried, false)
  } finally {
    restore.mock.restore()
  }
})

test('listAdminOperationLogs hides raw audit query failures', async () => {
  const restore = mock.method(supabase, 'from', (table) => {
    assert.equal(table, 'admin_operation_logs')
    return {
      select() { return this },
      order() { return this },
      range() {
        return Promise.resolve({ data: null, count: null, error: { message: 'password=database-secret' } })
      }
    }
  })

  try {
    await assert.rejects(
      listAdminOperationLogs({}),
      (error) => error.status === 500 &&
        error.code === 'ADMIN_AUDIT_QUERY_FAILED' &&
        error.message === 'Unable to load admin operation logs' &&
        !error.message.includes('database-secret')
    )
  } finally {
    restore.mock.restore()
  }
})

test('listAdminOperationLogs hides raw user email lookup failures', async () => {
  const restore = mock.method(supabase, 'from', (table) => {
    if (table === 'admin_operation_logs') {
      return {
        select() { return this },
        order() { return this },
        range() {
          return Promise.resolve({
            data: [{ id: 'log-1', operator_user_id: 'operator-1', target_user_id: null, action: 'admin.test', metadata: {}, created_at: '2026-07-12T00:00:00.000Z' }],
            count: 1,
            error: null
          })
        }
      }
    }
    assert.equal(table, 'users')
    return {
      select() { return this },
      in() {
        return Promise.resolve({ data: null, error: { message: 'token=user-query-secret' } })
      }
    }
  })

  try {
    await assert.rejects(
      listAdminOperationLogs({}),
      (error) => error.status === 500 &&
        error.code === 'ADMIN_AUDIT_USER_QUERY_FAILED' &&
        error.message === 'Unable to load admin audit user identities' &&
        !error.message.includes('user-query-secret')
    )
  } finally {
    restore.mock.restore()
  }
})
