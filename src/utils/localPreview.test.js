import assert from 'node:assert/strict'
import test from 'node:test'

import { isLocalPreviewEnabled } from './localPreview.js'

test('local preview is disabled by default on local development hosts', () => {
  assert.equal(isLocalPreviewEnabled({
    DEV: true,
    VITE_BYPASS_AUTH: '',
    hostname: '127.0.0.1'
  }), false)
})

test('local preview is enabled only when explicitly requested', () => {
  assert.equal(isLocalPreviewEnabled({
    DEV: true,
    VITE_BYPASS_AUTH: 'true',
    hostname: '127.0.0.1'
  }), true)
})
