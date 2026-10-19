import assert from 'node:assert/strict'
import test from 'node:test'

import { normalizeTrustedRequestId } from './request-id.js'

test('request correlation ids accept only bounded safe context values', () => {
  assert.equal(normalizeTrustedRequestId('release:req-123', () => 'generated'), 'release:req-123')
  assert.equal(normalizeTrustedRequestId('x'.repeat(129), () => 'generated'), 'generated')
  assert.equal(normalizeTrustedRequestId('token=secret value', () => 'generated'), 'generated')
  assert.equal(normalizeTrustedRequestId(['one', 'two'], () => 'generated'), 'generated')
})
