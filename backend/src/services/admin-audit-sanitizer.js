export const ADMIN_AUDIT_TEXT_LIMITS = Object.freeze({
  reason: 500,
  ip: 128,
  userAgent: 512,
  requestId: 128,
  metadata: 512
})

const BEARER_TOKEN_RE = /\bbearer\s+[^\s,;]+/gi
const API_KEY_VALUE_RE = /\b(?:sk|pk|rk|api[_-]?key|key)[_-][a-z0-9][a-z0-9._-]{5,}\b/gi
const SECRET_FRAGMENT_RE = /\b(password|secret|token|api[_-]?key)\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s,;&]+)/gi

export const sanitizeAdminAuditText = (value, maxLength = ADMIN_AUDIT_TEXT_LIMITS.metadata) => {
  const sanitized = String(value || '')
    .trim()
    .replace(BEARER_TOKEN_RE, 'Bearer [redacted]')
    .replace(SECRET_FRAGMENT_RE, '$1=[redacted]')
    .replace(API_KEY_VALUE_RE, '[redacted]')
  return sanitized.slice(0, Math.max(0, Number(maxLength) || 0))
}

export const sanitizeAdminAuditContext = ({ reason, ip, userAgent, requestId } = {}) => ({
  reason: sanitizeAdminAuditText(reason, ADMIN_AUDIT_TEXT_LIMITS.reason),
  ip: sanitizeAdminAuditText(ip, ADMIN_AUDIT_TEXT_LIMITS.ip),
  userAgent: sanitizeAdminAuditText(userAgent, ADMIN_AUDIT_TEXT_LIMITS.userAgent),
  requestId: sanitizeAdminAuditText(requestId, ADMIN_AUDIT_TEXT_LIMITS.requestId)
})

const metadataTextLimit = (key) => {
  const normalized = String(key || '').replace(/[_-]/g, '').toLowerCase()
  if (normalized === 'reason') return ADMIN_AUDIT_TEXT_LIMITS.reason
  if (normalized === 'ip') return ADMIN_AUDIT_TEXT_LIMITS.ip
  if (normalized === 'useragent') return ADMIN_AUDIT_TEXT_LIMITS.userAgent
  if (normalized === 'requestid') return ADMIN_AUDIT_TEXT_LIMITS.requestId
  return ADMIN_AUDIT_TEXT_LIMITS.metadata
}

const isSensitiveMetadataKey = (key) => {
  const normalized = String(key || '').replace(/[_-]/g, '').toLowerCase()
  return ['password', 'secret', 'token', 'apikey'].some((fragment) => normalized.includes(fragment))
}

const sanitizeMetadataValue = (value, key = '') => {
  if (value == null) return value
  if (isSensitiveMetadataKey(key)) return '[redacted]'
  if (typeof value === 'string') return sanitizeAdminAuditText(value, metadataTextLimit(key))
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => sanitizeMetadataValue(item))
  if (typeof value !== 'object') return value
  return Object.fromEntries(
    Object.entries(value)
      .slice(0, 100)
      .map(([childKey, childValue]) => [childKey, sanitizeMetadataValue(childValue, childKey)])
  )
}

export const sanitizeAdminAuditMetadata = (metadata = {}) => {
  const source = metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {}
  return sanitizeMetadataValue(source)
}
