import assert from 'node:assert/strict'
import test from 'node:test'

import {
  ADMIN_AUDIT_TEXT_LIMITS,
  sanitizeAdminAuditContext,
  sanitizeAdminAuditMetadata,
  sanitizeAdminAuditText
} from './admin-audit-sanitizer.js'

test('sanitizeAdminAuditText preserves ordinary administrative reasons', () => {
  assert.equal(
    sanitizeAdminAuditText('  Repeated policy violation after warning  ', 500),
    'Repeated policy violation after warning'
  )
})

test('sanitizeAdminAuditText redacts bearer tokens, API keys, and credential fragments', () => {
  const secrets = [
    'bearer-value-123',
    'sk-live-abcdefghijklmnopqrstuvwxyz',
    'hunter2',
    'secret-value',
    'token-value',
    'api-key-value'
  ]
  const sanitized = sanitizeAdminAuditText(
    'Bearer bearer-value-123 sk-live-abcdefghijklmnopqrstuvwxyz password=hunter2 secret: secret-value token="token-value" api_key=api-key-value',
    500
  )

  for (const secret of secrets) assert.doesNotMatch(sanitized, new RegExp(secret))
  assert.match(sanitized, /\[redacted\]/)
})

test('sanitizeAdminAuditContext bounds and sanitizes reason, IP, and user agent', () => {
  const context = sanitizeAdminAuditContext({
    reason: `${'r'.repeat(600)} sk-reason-secret`,
    ip: `${'1'.repeat(150)} token=ip-secret`,
    userAgent: `${'u'.repeat(550)} Bearer user-agent-secret`,
    requestId: `${'q'.repeat(200)} token=request-secret`
  })

  assert.equal(context.reason.length, ADMIN_AUDIT_TEXT_LIMITS.reason)
  assert.equal(context.ip.length, ADMIN_AUDIT_TEXT_LIMITS.ip)
  assert.equal(context.userAgent.length, ADMIN_AUDIT_TEXT_LIMITS.userAgent)
  assert.equal(context.requestId.length, ADMIN_AUDIT_TEXT_LIMITS.requestId)
  assert.doesNotMatch(JSON.stringify(context), /reason-secret|ip-secret|user-agent-secret|request-secret/)
})

test('sanitizeAdminAuditMetadata recursively removes original secrets from audit-list output', () => {
  const metadata = sanitizeAdminAuditMetadata({
    reason: 'password=restore-password',
    userAgent: 'Bearer restore-bearer',
    projectOwnershipTransfer: {
      note: 'sk-nested-api-key',
      token: 'nested-token',
      api_key: 'nested-api-key',
      password: 'nested-password'
    }
  })

  const serialized = JSON.stringify(metadata)
  assert.doesNotMatch(serialized, /restore-password|restore-bearer|sk-nested-api-key|nested-token|nested-api-key|nested-password/)
  assert.match(serialized, /\[redacted\]/)
})
