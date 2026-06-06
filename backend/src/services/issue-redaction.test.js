import assert from 'node:assert/strict'
import test from 'node:test'

import {
  redactIssuePayload,
  sanitizeIssueMetadata
} from './issue-redaction.js'

test('issue redaction removes secrets, prompts, media, and oversized metadata', () => {
  const metadata = sanitizeIssueMetadata({
    prompt: 'make a private image',
    Authorization: 'Bearer secret-token',
    cookie: 'refresh=secret',
    api_key: 'sk-secret',
    image: 'https://storage.example/private.png',
    media_url: 'https://storage.example/private.mp4',
    uploaded_file: 'private-reference.png',
    localStorage: { draft: 'private' },
    nested: {
      canvas_json: { nodes: [{ id: 'node-1' }] },
      provider_request_id: 'req-123'
    },
    large: 'x'.repeat(20 * 1024)
  })

  const serialized = JSON.stringify(metadata)
  assert.equal(metadata.prompt, '[redacted]')
  assert.equal(metadata.Authorization, '[redacted]')
  assert.equal(metadata.cookie, '[redacted]')
  assert.equal(metadata.api_key, '[redacted]')
  assert.equal(metadata.image, '[redacted]')
  assert.equal(metadata.media_url, '[redacted]')
  assert.equal(metadata.uploaded_file, '[redacted]')
  assert.equal(metadata.localStorage, '[redacted]')
  assert.equal(metadata.nested.canvas_json, '[redacted]')
  assert.equal(metadata.nested.provider_request_id, 'req-123')
  assert.match(metadata.large, /^\[omitted /)
  assert.ok(Buffer.byteLength(serialized, 'utf8') <= 16 * 1024)
})

test('issue redaction produces bounded top-level event summaries', () => {
  const payload = redactIssuePayload({
    message_summary: `failed ${'x'.repeat(700)}`,
    stack_summary: `stack ${'y'.repeat(2500)}`,
    metadata: {
      access_token: 'token',
      safe: 'value'
    }
  })

  assert.equal(payload.message_summary.length, 500)
  assert.equal(payload.stack_summary.length, 2000)
  assert.equal(payload.metadata.access_token, '[redacted]')
  assert.equal(payload.metadata.safe, 'value')
})
