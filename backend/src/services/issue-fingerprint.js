import { createHash } from 'node:crypto'

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi
const VOLATILE_ID_RE = /(?:task|run|project|req|pred|job|local)[_-]?[a-z0-9]{8,}/gi
const LONG_HEX_RE = /[a-f0-9]{24,}/gi
const NUMERIC_ID_RE = /\/\d{5,}(?=\/|$)/g

const clean = (value) => String(value || '').trim().toLowerCase()

export const normalizeIssuePath = (value = '') => {
  const path = String(value || '').split('?')[0]
  return path
    .replace(UUID_RE, ':uuid')
    .replace(VOLATILE_ID_RE, ':id')
    .replace(LONG_HEX_RE, ':hash')
    .replace(NUMERIC_ID_RE, '/:id')
}

const topStackFrames = (stack = '') => String(stack || '')
  .split(/\n+/)
  .map((line) => line.trim())
  .filter(Boolean)
  .slice(0, 5)
  .join('|')
  .replace(/:\d+:\d+/g, ':line:col')

const providerParts = (payload) => [
  'provider',
  clean(payload.provider),
  clean(payload.model),
  clean(payload.metadata?.operation),
  normalizeIssuePath(payload.upstream_endpoint),
  clean(payload.upstream_status),
  clean(payload.error_code || payload.message_summary)
]

const databaseParts = (payload) => [
  'database',
  clean(payload.db_operation),
  clean(payload.db_table),
  clean(payload.db_code || payload.error_code),
  clean(payload.metadata?.constraint || payload.message_summary)
]

const performanceParts = (payload) => [
  'performance',
  clean(payload.route_name || payload.route),
  clean(payload.metadata?.metric_name || payload.category),
  clean(payload.metadata?.threshold_bucket || payload.duration_ms)
]

const frontendParts = (payload) => [
  'frontend',
  clean(payload.build_id),
  clean(payload.route_name || payload.route),
  clean(payload.component),
  clean(payload.error_code || payload.category),
  topStackFrames(payload.stack_summary)
]

const apiParts = (payload) => [
  clean(payload.source_layer),
  clean(payload.category),
  clean(payload.method),
  normalizeIssuePath(payload.path_template || payload.route),
  clean(payload.status_code),
  clean(payload.error_code),
  topStackFrames(payload.stack_summary)
]

export const buildIssueFingerprint = (payload = {}) => {
  let parts
  if (payload.source_layer === 'provider') parts = providerParts(payload)
  else if (payload.source_layer === 'database') parts = databaseParts(payload)
  else if (payload.source_layer === 'performance') parts = performanceParts(payload)
  else if (payload.source_layer === 'frontend' && payload.category !== 'api_error') parts = frontendParts(payload)
  else parts = apiParts(payload)

  const input = parts.map((part) => String(part || '')).join('\u001f')
  return `sha256:${createHash('sha256').update(input).digest('hex')}`
}
