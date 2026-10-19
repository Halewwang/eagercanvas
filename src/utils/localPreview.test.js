import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import * as localPreview from './localPreview.js'

const apiConfigSource = readFileSync(new URL('../hooks/useApiConfig.js', import.meta.url), 'utf8')

test('local preview is disabled by default on local development hosts', () => {
  assert.equal(localPreview.isLocalPreviewEnabled({
    DEV: true,
    VITE_BYPASS_AUTH: '',
    hostname: '127.0.0.1'
  }), false)
})

test('local preview is enabled only when explicitly requested', () => {
  assert.equal(localPreview.isLocalPreviewEnabled({
    DEV: true,
    VITE_BYPASS_AUTH: 'true',
    VITE_LOCAL_PREVIEW_ACCESS_TOKEN: 'local-preview-browser-token',
    hostname: '127.0.0.1'
  }), true)
  assert.equal(localPreview.isLocalPreviewEnabled({
    DEV: true,
    VITE_BYPASS_AUTH: 'true',
    VITE_LOCAL_PREVIEW_ACCESS_TOKEN: ''
  }), false)
})

test('local preview admin session exposes account and service management permissions', () => {
  assert.equal(typeof localPreview.getLocalPreviewAdminSession, 'function')

  const session = localPreview.getLocalPreviewAdminSession()

  assert.equal(session.user.email, 'preview-admin@local.dev')
  assert.deepEqual(session.roles, ['super_admin', 'ops'])
  assert.deepEqual(new Set(session.permissions), new Set([
    'admin.user.read',
    'admin.user.role.update',
    'admin.user.status.update',
    'admin.user.delete',
    'admin.user.restore',
    'admin.audit.read',
    'admin.service_access.activate',
    'admin.service_access.disable',
  ]))
})

test('request token resolution falls back only for explicitly enabled local preview', () => {
  assert.equal(typeof localPreview.resolveLocalPreviewAccessToken, 'function')
  assert.equal(localPreview.resolveLocalPreviewAccessToken('stored-token', {
    DEV: true,
    VITE_BYPASS_AUTH: 'true',
    VITE_LOCAL_PREVIEW_ACCESS_TOKEN: 'local-preview-browser-token'
  }), 'stored-token')
  assert.equal(localPreview.resolveLocalPreviewAccessToken('', {
    DEV: true,
    VITE_BYPASS_AUTH: 'true',
    VITE_LOCAL_PREVIEW_ACCESS_TOKEN: 'local-preview-browser-token'
  }), 'local-preview-browser-token')
  assert.equal(localPreview.resolveLocalPreviewAccessToken('', {
    DEV: true,
    VITE_BYPASS_AUTH: 'false',
    VITE_LOCAL_PREVIEW_ACCESS_TOKEN: 'local-preview-browser-token'
  }), '')
  assert.equal(localPreview.resolveLocalPreviewAccessToken('', {
    DEV: false,
    VITE_BYPASS_AUTH: 'true',
    VITE_LOCAL_PREVIEW_ACCESS_TOKEN: 'local-preview-browser-token'
  }), '')
})

test('axios and fetch request channels both use the guarded local preview token resolver', () => {
  const requestSource = readFileSync(new URL('./request.js', import.meta.url), 'utf8')
  const authFetchSource = readFileSync(new URL('./authFetch.js', import.meta.url), 'utf8')

  assert.match(requestSource, /applyRequestAccessToken\(config, \{\s*storedToken: getStoredValue\(STORAGE_KEYS\.ACCESS_TOKEN\)/)
  assert.match(authFetchSource, /resolveLocalPreviewAccessToken\(getStoredValue\(STORAGE_KEYS\.ACCESS_TOKEN, '', \{ storage \}\), env\)/)
})

test('API configuration uses the shared flag-and-token local preview guard', () => {
  assert.match(apiConfigSource, /import \{ isLocalPreviewEnabled \} from '@\/utils\/localPreview'/)
  assert.match(apiConfigSource, /const BYPASS_AUTH_IN_DEV = isLocalPreviewEnabled\(\)/)
  assert.doesNotMatch(apiConfigSource, /VITE_BYPASS_AUTH === 'true'/)
})
