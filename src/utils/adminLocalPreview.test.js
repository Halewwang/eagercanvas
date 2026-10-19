import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveLocalPreviewAdminRead, LOCAL_PREVIEW_ADMIN_READ_KEYS } from './adminLocalPreview.js'

const env = { DEV: true, VITE_BYPASS_AUTH: 'true', VITE_LOCAL_PREVIEW_ACCESS_TOKEN: 'preview' }
const read = (key, params = {}) => resolveLocalPreviewAdminRead(key, params, { env, storedToken: '' })

test('preview fixtures require the explicit dev guard and never override a stored token', () => {
  assert.equal(read('users').matched, true)
  assert.equal(resolveLocalPreviewAdminRead('users', {}, { env, storedToken: 'real-token' }).matched, false)
  assert.equal(resolveLocalPreviewAdminRead('users', {}, { env: { ...env, DEV: false }, storedToken: '' }).matched, false)
  assert.equal(read('unknown').matched, false)
  assert.deepEqual(Object.keys(LOCAL_PREVIEW_ADMIN_READ_KEYS).sort(), ['USER', 'USERS'])
})

test('preview user filtering and detail fixtures contain no credentials or billing data', () => {
  const filtered = read('users', { role: 'support', serviceStatus: 'not_enabled' }).response.data
  assert.equal(filtered.pagination.total, 1)
  assert.equal(filtered.items[0].id, 'preview-user-2')
  const detail = read('user', { userId: filtered.items[0].id }).response.data
  assert.equal(detail.id, filtered.items[0].id)
  assert.doesNotMatch(JSON.stringify(detail), /apiKey|balance|officialUsage|reconciliation/)
  detail.displayName = 'changed'
  assert.notEqual(read('user', { userId: detail.id }).response.data.displayName, 'changed')
})
