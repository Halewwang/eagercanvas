const METADATA_MAX_BYTES = 16 * 1024
const MESSAGE_MAX_CHARS = 500
const STACK_MAX_CHARS = 2000
const STRING_MAX_CHARS = 2048
const INLINE_DATA_URL_RE = /^data:[^;,]+;base64,/i

const REDACTED_KEY_RE = /(^|_)(authorization|cookie|token|access_token|refresh_token|api_key|apikey|secret|password|provider_key|prompt|canvas_json|media|image|file|localstorage|local_storage)($|_)/i

const byteLength = (value) => Buffer.byteLength(JSON.stringify(value), 'utf8')

const truncateText = (value, maxChars) => {
  const text = String(value || '')
  if (text.length <= maxChars) return text
  return text.slice(0, maxChars)
}

const redactString = (value = '') => {
  const text = String(value)
  if (INLINE_DATA_URL_RE.test(text)) return '[omitted data-url]'
  if (text.length > STRING_MAX_CHARS) return `[omitted ${text.length} chars]`
  return text.replace(/(bearer\s+)[a-z0-9._~+/=-]+/gi, '$1[redacted]')
}

const sanitizeJsonValue = (value, key = '') => {
  if (REDACTED_KEY_RE.test(key)) return '[redacted]'
  if (typeof value === 'string') return redactString(value)
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitizeJsonValue(item))
  if (!value || typeof value !== 'object') return value

  return Object.fromEntries(
    Object.entries(value)
      .slice(0, 80)
      .map(([childKey, childValue]) => [childKey, sanitizeJsonValue(childValue, childKey)])
  )
}

const shrinkMetadata = (metadata) => {
  if (byteLength(metadata) <= METADATA_MAX_BYTES) return metadata

  const summary = {
    _truncated: true,
    _originalBytes: byteLength(metadata),
    _topLevelKeys: Object.keys(metadata || {}).slice(0, 80)
  }

  for (const [key, value] of Object.entries(metadata || {})) {
    if (byteLength(summary) >= METADATA_MAX_BYTES) break
    if (typeof value === 'string' && value.length > STRING_MAX_CHARS) {
      summary[key] = `[omitted ${value.length} chars]`
    } else if (value === null || ['number', 'boolean'].includes(typeof value)) {
      summary[key] = value
    } else if (typeof value === 'string') {
      summary[key] = redactString(value)
    }
  }

  return byteLength(summary) <= METADATA_MAX_BYTES ? summary : {
    _truncated: true,
    _originalBytes: byteLength(metadata),
    _topLevelKeys: Object.keys(metadata || {}).slice(0, 80)
  }
}

export const sanitizeIssueMetadata = (metadata = {}) => {
  const source = metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {}
  return shrinkMetadata(sanitizeJsonValue(source))
}

export const redactIssuePayload = (payload = {}) => {
  const next = {
    ...payload,
    message_summary: truncateText(payload.message_summary, MESSAGE_MAX_CHARS),
    stack_summary: truncateText(payload.stack_summary, STACK_MAX_CHARS),
    metadata: sanitizeIssueMetadata(payload.metadata || {})
  }

  for (const key of Object.keys(next)) {
    if (key !== 'metadata' && REDACTED_KEY_RE.test(key)) {
      delete next[key]
    }
  }

  return next
}

export const ISSUE_METADATA_MAX_BYTES = METADATA_MAX_BYTES
