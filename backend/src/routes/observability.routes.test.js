import assert from 'node:assert/strict'
import test from 'node:test'

import {
  isAnonymousIssueReportRateLimited,
  isAnonymousIssueEventAllowed,
  normalizeIssueEventBatch
} from './observability.routes.js'

test('observability route accepts only low-risk anonymous frontend events', () => {
  assert.equal(isAnonymousIssueEventAllowed({
    source_layer: 'frontend',
    category: 'runtime_error'
  }), true)
  assert.equal(isAnonymousIssueEventAllowed({
    source_layer: 'provider',
    category: 'provider_error'
  }), false)
  assert.equal(isAnonymousIssueEventAllowed({
    source_layer: 'frontend',
    category: 'api_error',
    metadata: { prompt: 'secret' }
  }), false)
  assert.equal(isAnonymousIssueEventAllowed({
    source_layer: 'frontend',
    category: 'runtime_error',
    metadata: { media_url: 'https://storage.example/private.png' }
  }), false)
})

test('observability route normalizes bounded batches and reports dropped events', () => {
  const result = normalizeIssueEventBatch({
    events: [
      { source_layer: 'frontend', category: 'runtime_error', metadata: { safe: true } },
      { source_layer: 'provider', category: 'provider_error' }
    ]
  }, { isAuthenticated: false })

  assert.equal(result.accepted.length, 1)
  assert.equal(result.dropped, 1)
  assert.equal(result.accepted[0].source_layer, 'frontend')
})

test('anonymous issue reporting has a stricter endpoint-level rate limit', () => {
  const key = `anonymous-test-${Date.now()}`
  for (let index = 0; index < 20; index += 1) {
    assert.equal(isAnonymousIssueReportRateLimited({ key, now: 1000 }), false)
  }
  assert.equal(isAnonymousIssueReportRateLimited({ key, now: 1000 }), true)
  assert.equal(isAnonymousIssueReportRateLimited({ key, now: 61_001 }), false)
})
