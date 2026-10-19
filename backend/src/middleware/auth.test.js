import assert from 'node:assert/strict'
import { mock, test } from 'node:test'
import jwt from 'jsonwebtoken'

import { env } from '../config/env.js'
import { supabase } from '../config/supabase.js'
import { authRequired } from './auth.js'

const LOCAL_PREVIEW_ADMIN_PERMISSIONS = [
  'admin.user.read',
  'admin.user.role.update',
  'admin.user.status.update',
  'admin.user.delete',
  'admin.user.restore',
  'admin.audit.read',
  'admin.service_access.activate',
  'admin.service_access.disable',
]

test('development preview auth requires an explicit server opt-in and custom token', async () => {
  const previousNodeEnv = env.nodeEnv
  const previousPreviewEnabled = env.localPreviewAuthEnabled
  const previousPreviewToken = env.localPreviewAccessToken
  env.nodeEnv = 'development'
  env.localPreviewAuthEnabled = true
  env.localPreviewAccessToken = 'local-preview-test-token-3f0e9c7b'
  const req = { headers: { authorization: 'Bearer local-preview-test-token-3f0e9c7b' } }
  let nextValue

  try {
    await authRequired(req, {}, (value) => { nextValue = value })
    assert.equal(nextValue, undefined)
    assert.deepEqual(req.user.roles, ['super_admin', 'ops'])
    assert.deepEqual(new Set(req.user.permissions), new Set(LOCAL_PREVIEW_ADMIN_PERMISSIONS))
    for (const permission of [
      'admin.user.read',
      'admin.audit.read',
    ]) {
      assert.equal(req.user.permissions.includes(permission), true)
    }
  } finally {
    env.nodeEnv = previousNodeEnv
    env.localPreviewAuthEnabled = previousPreviewEnabled
    env.localPreviewAccessToken = previousPreviewToken
  }
})

test('development preview auth is disabled by default even when the presented token matches', async () => {
  const previousNodeEnv = env.nodeEnv
  const previousPreviewEnabled = env.localPreviewAuthEnabled
  const previousPreviewToken = env.localPreviewAccessToken
  env.nodeEnv = 'development'
  env.localPreviewAuthEnabled = false
  env.localPreviewAccessToken = 'local-preview-test-token-3f0e9c7b'
  const req = { headers: { authorization: 'Bearer local-preview-test-token-3f0e9c7b' } }
  let nextValue

  try {
    await authRequired(req, {}, (value) => { nextValue = value })
    assert.equal(nextValue?.status, 401)
    assert.equal(nextValue?.code, 'UNAUTHORIZED')
    assert.equal(req.user, undefined)
  } finally {
    env.nodeEnv = previousNodeEnv
    env.localPreviewAuthEnabled = previousPreviewEnabled
    env.localPreviewAccessToken = previousPreviewToken
  }
})

test('production never accepts explicitly configured local preview auth', async () => {
  const previousNodeEnv = env.nodeEnv
  const previousPreviewEnabled = env.localPreviewAuthEnabled
  const previousPreviewToken = env.localPreviewAccessToken
  env.nodeEnv = 'production'
  env.localPreviewAuthEnabled = true
  env.localPreviewAccessToken = 'local-preview-test-token-3f0e9c7b'
  const req = { headers: { authorization: 'Bearer local-preview-test-token-3f0e9c7b' } }
  let nextValue

  try {
    await authRequired(req, {}, (value) => { nextValue = value })
    assert.equal(nextValue?.status, 401)
    assert.equal(nextValue?.code, 'UNAUTHORIZED')
    assert.equal(req.user, undefined)
  } finally {
    env.nodeEnv = previousNodeEnv
    env.localPreviewAuthEnabled = previousPreviewEnabled
    env.localPreviewAccessToken = previousPreviewToken
  }
})

test('token authentication rejects an archiving account before loading authorization', async () => {
  const token = jwt.sign({ email: 'user@example.com' }, env.jwtAccessSecret, { subject: 'user-1' })
  const restore = mock.method(supabase, 'from', (table) => {
    assert.equal(table, 'users')
    return {
      select() { return this },
      eq() { return this },
      maybeSingle: async () => ({
        data: { id: 'user-1', email: 'user@example.com', status: 'archiving', deleted_at: null },
        error: null
      })
    }
  })
  const req = { headers: { authorization: `Bearer ${token}` } }
  let nextValue

  try {
    await authRequired(req, {}, (value) => { nextValue = value })
    assert.equal(nextValue?.status, 403)
    assert.equal(nextValue?.code, 'ACCOUNT_ARCHIVING')
    assert.equal(req.user, undefined)
  } finally {
    restore.mock.restore()
  }
})

test('token authentication reports ACCOUNT_SUSPENDING for transient suspension', async () => {
  const token = jwt.sign({ email: 'user@example.com' }, env.jwtAccessSecret, { subject: 'user-1' })
  const restoreFrom = mock.method(supabase, 'from', () => ({
    select() { return this },
    eq() { return this },
    maybeSingle: async () => ({
      data: { id: 'user-1', email: 'user@example.com', status: 'suspending', deleted_at: null },
      error: null
    })
  }))
  const req = { headers: { authorization: `Bearer ${token}` } }
  let error
  try {
    await authRequired(req, {}, (value) => { error = value })
    assert.equal(error.code, 'ACCOUNT_SUSPENDING')
    assert.equal(error.message, 'Account suspension is in progress')
  } finally {
    restoreFrom.mock.restore()
  }
})
