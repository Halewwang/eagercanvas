export const OBSERVABILITY_MAX_BATCH = 10
export const OBSERVABILITY_FLUSH_INTERVAL_MS = 30_000
export const OBSERVABILITY_SESSION_LIMIT = 50
export const OBSERVABILITY_FINGERPRINT_WINDOW_MS = 5 * 60_000
export const OBSERVABILITY_FINGERPRINT_LIMIT = 3
export const OBSERVABILITY_SLOW_API_MS = 2000
export const OBSERVABILITY_MAX_FLUSH_BYTES = 128 * 1024

const SENSITIVE_KEY_PATTERN = /(authorization|cookie|token|access_token|refresh_token|api_key|apikey|secret|password|prompt|canvas_json|media|image|file)/i
const SENSITIVE_VALUE_PATTERN = /(bearer\s+[a-z0-9._-]+|data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=]+)/gi

const normalizeText = (value = '', max = 500) => String(value || '')
  .replace(SENSITIVE_VALUE_PATTERN, '[redacted]')
  .slice(0, max)

const normalizeRoute = () => {
  if (typeof window === 'undefined') return ''
  return `${window.location.pathname || ''}${window.location.search || ''}`.slice(0, 500)
}

const byteLength = (value) => {
  const text = JSON.stringify(value)
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(text).length
  return text.length
}

const getSessionHash = () => {
  if (typeof window === 'undefined') return ''
  try {
    const key = 'ec_issue_session_hash'
    const existing = window.sessionStorage?.getItem(key)
    if (existing) return existing
    const value = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`
    window.sessionStorage?.setItem(key, value)
    return value
  } catch {
    return ''
  }
}

export const sanitizeIssueEvent = (event = {}) => {
  const metadata = event.metadata && typeof event.metadata === 'object' && !Array.isArray(event.metadata)
    ? event.metadata
    : {}
  const safeMetadata = {}
  Object.entries(metadata).slice(0, 20).forEach(([key, value]) => {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      safeMetadata[key] = '[redacted]'
      return
    }
    if (value === null || value === undefined) return
    if (typeof value === 'object') {
      safeMetadata[key] = '[object]'
      return
    }
    safeMetadata[key] = normalizeText(value, 300)
  })
  if (Object.keys(metadata).length > 20) safeMetadata._truncated = true

  return {
    source_layer: 'frontend',
    category: normalizeText(event.category || 'runtime_error', 80),
    severity: normalizeText(event.severity || 'p2', 10),
    environment: import.meta.env?.MODE || 'production',
    build_id: import.meta.env?.VITE_APP_BUILD_ID || '',
    release_commit: import.meta.env?.VITE_APP_RELEASE_COMMIT || '',
    session_hash: event.session_hash || getSessionHash(),
    request_id: normalizeText(event.request_id || '', 120),
    trace_id: normalizeText(event.trace_id || '', 120),
    route: normalizeText(event.route || normalizeRoute(), 500),
    route_name: normalizeText(event.route_name || '', 120),
    component: normalizeText(event.component || '', 160),
    method: normalizeText(event.method || '', 20).toUpperCase(),
    path_template: normalizeText(event.path_template || '', 500),
    status_code: Number.isFinite(Number(event.status_code)) ? Number(event.status_code) : undefined,
    duration_ms: Number.isFinite(Number(event.duration_ms)) ? Math.round(Number(event.duration_ms)) : undefined,
    provider: normalizeText(event.provider || '', 80),
    model: normalizeText(event.model || '', 120),
    error_code: normalizeText(event.error_code || '', 120),
    message_summary: normalizeText(event.message_summary || event.message || '', 500),
    stack_summary: normalizeText(event.stack_summary || event.stack || '', 2000),
    metadata: safeMetadata
  }
}

export const buildClientFingerprint = (event = {}) => [
  event.source_layer,
  event.category,
  event.route_name || event.route,
  event.component,
  event.method,
  event.path_template,
  event.status_code,
  event.provider,
  event.model,
  event.error_code,
  String(event.message_summary || '').slice(0, 120)
].filter(Boolean).join('|')

export const createIssueObservabilityClient = ({
  sender = async () => ({ ok: true, status: 202 }),
  now = () => Date.now(),
  setTimer = (fn, ms) => setTimeout(fn, ms),
  clearTimer = (timer) => clearTimeout(timer),
  maxBatch = OBSERVABILITY_MAX_BATCH,
  flushIntervalMs = OBSERVABILITY_FLUSH_INTERVAL_MS,
  sessionLimit = OBSERVABILITY_SESSION_LIMIT,
  fingerprintWindowMs = OBSERVABILITY_FINGERPRINT_WINDOW_MS,
  fingerprintLimit = OBSERVABILITY_FINGERPRINT_LIMIT,
  maxFlushBytes = OBSERVABILITY_MAX_FLUSH_BYTES
} = {}) => {
  const state = {
    queue: [],
    timer: null,
    stopped: false,
    sessionCount: 0,
    consecutiveFailures: 0,
    fingerprintBuckets: new Map()
  }

  const stop = () => {
    state.stopped = true
    if (state.timer) clearTimer(state.timer)
    state.timer = null
    state.queue = []
  }

  const isFingerprintAllowed = (fingerprint) => {
    const current = now()
    const bucket = state.fingerprintBuckets.get(fingerprint)
    if (!bucket || current - bucket.startedAt > fingerprintWindowMs) {
      state.fingerprintBuckets.set(fingerprint, { startedAt: current, count: 1 })
      return true
    }
    if (bucket.count >= fingerprintLimit) return false
    bucket.count += 1
    return true
  }

  const scheduleFlush = () => {
    if (state.timer || state.stopped || state.queue.length === 0) return
    state.timer = setTimer(() => {
      state.timer = null
      void flush()
    }, flushIntervalMs)
  }

  const takeFlushBatch = () => {
    const batch = state.queue.splice(0, maxBatch)
    while (batch.length > 1 && byteLength({ events: batch }) > maxFlushBytes) {
      const overflow = batch.pop()
      state.queue.unshift(overflow)
    }
    if (batch.length === 1 && byteLength({ events: batch }) > maxFlushBytes) {
      batch[0] = {
        ...batch[0],
        stack_summary: '',
        metadata: { _truncated: true, _reason: 'max_flush_bytes' }
      }
    }
    return batch
  }

  const flush = async () => {
    if (state.stopped || state.queue.length === 0) return { ok: true, sent: 0 }
    if (state.timer) {
      clearTimer(state.timer)
      state.timer = null
    }
    const batch = takeFlushBatch()
    try {
      const result = await sender(batch)
      if (result?.status === 429) {
        stop()
        return { ok: false, sent: 0, stopped: true }
      }
      if (!result?.ok) {
        state.consecutiveFailures += 1
        if (state.consecutiveFailures >= 3) stop()
        return { ok: false, sent: 0 }
      }
      state.consecutiveFailures = 0
      if (state.queue.length) scheduleFlush()
      return { ok: true, sent: batch.length }
    } catch {
      state.consecutiveFailures += 1
      if (state.consecutiveFailures >= 3) stop()
      return { ok: false, sent: 0 }
    }
  }

  const capture = (event = {}) => {
    if (state.stopped || state.sessionCount >= sessionLimit) return false
    const safeEvent = sanitizeIssueEvent(event)
    const fingerprint = buildClientFingerprint(safeEvent)
    if (!isFingerprintAllowed(fingerprint)) return false
    state.queue.push(safeEvent)
    state.sessionCount += 1
    if (state.sessionCount >= sessionLimit) state.stopped = true
    if (state.queue.length >= maxBatch) {
      void flush()
    } else {
      scheduleFlush()
    }
    return true
  }

  return {
    capture,
    flush,
    stop,
    state
  }
}

export const installIssueFlushLifecycle = ({
  documentTarget = typeof document !== 'undefined' ? document : null,
  windowTarget = typeof window !== 'undefined' ? window : null,
  client
} = {}) => {
  if (!client?.flush) return

  const flush = () => {
    void client.flush()
  }

  documentTarget?.addEventListener?.('visibilitychange', () => {
    if (documentTarget.visibilityState === 'hidden') flush()
  })
  windowTarget?.addEventListener?.('pagehide', flush)
}
