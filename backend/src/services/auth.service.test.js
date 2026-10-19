import assert from 'node:assert/strict'
import { mock, test } from 'node:test'

import { supabase } from '../config/supabase.js'
import { sha256 } from '../utils/crypto.js'
import { getMe, refreshAccessToken, verifyCode } from './auth.service.js'

const createQuery = ({ table, responses }) => {
  let op = 'select'
  return {
    select() { op = 'select'; return this },
    eq() { return this },
    order() { return this },
    limit() { return this },
    update() { op = 'update'; return this },
    maybeSingle: async () => responses({ table, op, single: 'maybe' }),
    single: async () => responses({ table, op, single: 'single' }),
    then(resolve, reject) {
      return Promise.resolve(responses({ table, op })).then(resolve, reject)
    }
  }
}

test('login verification rejects an archiving account', async () => {
  const restore = mock.method(supabase, 'from', (table) => createQuery({
    table,
    responses: ({ table: currentTable, op, single }) => {
      if (currentTable === 'auth_codes' && single === 'maybe') {
        return {
          data: {
            id: 'code-1',
            code_hash: sha256('123456'),
            expires_at: '2099-01-01T00:00:00.000Z'
          },
          error: null
        }
      }
      if (currentTable === 'auth_codes' && op === 'update') return { data: null, error: null }
      if (currentTable === 'users' && single === 'maybe') {
        return { data: { id: 'user-1', email: 'user@example.com', status: 'archiving', deleted_at: null }, error: null }
      }
      assert.fail(`Unexpected ${currentTable} ${op} ${single || ''}`)
    }
  }))

  try {
    await assert.rejects(
      () => verifyCode({ email: 'user@example.com', code: '123456', purpose: 'login', ip: '127.0.0.1' }),
      (error) => error.status === 403 && error.code === 'ACCOUNT_ARCHIVING'
    )
  } finally {
    restore.mock.restore()
  }
})

test('refresh and account status reject an archiving account', async () => {
  const restore = mock.method(supabase, 'from', (table) => createQuery({
    table,
    responses: ({ table: currentTable, single }) => {
      if (currentTable === 'sessions') {
        return {
          data: { id: 'session-1', user_id: 'user-1', expires_at: '2099-01-01T00:00:00.000Z' },
          error: null
        }
      }
      if (currentTable === 'users' && single === 'single') {
        return { data: { id: 'user-1', email: 'user@example.com', status: 'archiving', deleted_at: null }, error: null }
      }
      assert.fail(`Unexpected ${currentTable} ${single || ''}`)
    }
  }))

  try {
    await assert.rejects(
      () => refreshAccessToken({ refreshToken: 'refresh-token' }),
      (error) => error.status === 403 && error.code === 'ACCOUNT_ARCHIVING'
    )
    await assert.rejects(
      () => getMe({ userId: 'user-1' }),
      (error) => error.status === 403 && error.code === 'ACCOUNT_ARCHIVING'
    )
  } finally {
    restore.mock.restore()
  }
})

test('login and refresh distinguish a suspending account from archiving', async () => {
  const restore = mock.method(supabase, 'from', (table) => createQuery({
    table,
    responses: ({ table: currentTable, single }) => {
      if (currentTable === 'users' && single === 'single') {
        return { data: { id: 'user-1', email: 'user@example.com', status: 'suspending', deleted_at: null }, error: null }
      }
      assert.fail(`Unexpected ${currentTable} ${single || ''}`)
    }
  }))
  try {
    await assert.rejects(() => getMe({ userId: 'user-1' }), (error) => (
      error.code === 'ACCOUNT_SUSPENDING' && error.message === 'Account suspension is in progress'
    ))
  } finally {
    restore.mock.restore()
  }
})
