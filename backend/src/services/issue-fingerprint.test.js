import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildIssueFingerprint,
  normalizeIssuePath
} from './issue-fingerprint.js'

test('normalizes issue paths by replacing volatile ids and query strings', () => {
  assert.equal(
    normalizeIssuePath('/api/v1/projects/018f89a1-1aaa-7bbb-9ccc-0123456789ab?token=secret'),
    '/api/v1/projects/:uuid'
  )
  assert.equal(
    normalizeIssuePath('/api/v1/images/task_abc123456789/status'),
    '/api/v1/images/:id/status'
  )
})

test('builds stable fingerprints for equivalent api errors', () => {
  const first = buildIssueFingerprint({
    source_layer: 'backend',
    category: 'api_error',
    method: 'POST',
    path_template: '/api/v1/projects/018f89a1-1aaa-7bbb-9ccc-0123456789ab',
    status_code: 500,
    error_code: 'PROJECT_SAVE_FAILED',
    stack_summary: 'saveProject (/app/backend/src/services/projects.service.js:10:1)'
  })

  const second = buildIssueFingerprint({
    source_layer: 'backend',
    category: 'api_error',
    method: 'POST',
    path_template: '/api/v1/projects/22222222-3333-4444-5555-666666666666',
    status_code: 500,
    error_code: 'PROJECT_SAVE_FAILED',
    stack_summary: 'saveProject (/app/backend/src/services/projects.service.js:10:1)'
  })

  assert.equal(first, second)
  assert.match(first, /^sha256:[a-f0-9]{64}$/)
})

test('provider fingerprints separate provider and model failures', () => {
  const gpt = buildIssueFingerprint({
    source_layer: 'provider',
    category: 'provider_error',
    provider: '302ai',
    model: 'gpt-image-2',
    upstream_endpoint: '/v1/images/generations',
    upstream_status: 200,
    error_code: 'COMPLETED_WITHOUT_ASSET',
    metadata: { operation: 'image_generation' }
  })
  const lite = buildIssueFingerprint({
    source_layer: 'provider',
    category: 'provider_error',
    provider: 'derouter',
    model: 'gpt-image-lite',
    upstream_endpoint: '/v1/images/generations',
    upstream_status: 200,
    error_code: 'COMPLETED_WITHOUT_ASSET',
    metadata: { operation: 'image_generation' }
  })

  assert.notEqual(gpt, lite)
})

test('slow request fingerprints merge the same normalized endpoint without duration drift', () => {
  const first = buildIssueFingerprint({
    source_layer: 'performance',
    category: 'slow_request',
    method: 'GET',
    path_template: '/api/v1/images/task_abc123456789',
    status_code: 304,
    duration_ms: 3605
  })
  const second = buildIssueFingerprint({
    source_layer: 'performance',
    category: 'slow_request',
    method: 'GET',
    path_template: '/api/v1/images/task_def987654321',
    status_code: 304,
    duration_ms: 12576
  })

  assert.equal(first, second)
})

test('filesystem EROFS fingerprints merge repeated export failures by endpoint', () => {
  const first = buildIssueFingerprint({
    source_layer: 'database',
    category: 'db_error',
    method: 'POST',
    path_template: '/api/v1/admin/issues/export',
    db_code: 'EROFS',
    error_code: 'EROFS',
    message_summary: "EROFS: read-only file system, open '/var/task/docs/codex-issue-inbox/issue-a.json'"
  })
  const second = buildIssueFingerprint({
    source_layer: 'database',
    category: 'db_error',
    method: 'POST',
    path_template: '/api/v1/admin/issues/export',
    db_code: 'EROFS',
    error_code: 'EROFS',
    message_summary: "EROFS: read-only file system, open '/var/task/docs/codex-issue-inbox/issue-b.json'"
  })

  assert.equal(first, second)
})
