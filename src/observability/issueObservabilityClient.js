import { DEFAULT_API_BASE_URL, STORAGE_KEYS } from '@/utils/constants'
import { getStoredValue } from '@/utils/storage.js'
import {
  OBSERVABILITY_FINGERPRINT_LIMIT,
  OBSERVABILITY_FINGERPRINT_WINDOW_MS,
  OBSERVABILITY_FLUSH_INTERVAL_MS,
  OBSERVABILITY_MAX_FLUSH_BYTES,
  OBSERVABILITY_MAX_BATCH,
  OBSERVABILITY_SESSION_LIMIT,
  OBSERVABILITY_SLOW_API_MS,
  buildClientFingerprint,
  createIssueObservabilityClient,
  installIssueFlushLifecycle,
  sanitizeIssueEvent
} from './issueObservabilityCore.js'

export const OBSERVABILITY_ENDPOINT = `${DEFAULT_API_BASE_URL.replace(/\/$/, '')}/observability/events`

const createDefaultSender = ({ endpoint = OBSERVABILITY_ENDPOINT } = {}) => async (events) => {
  const body = JSON.stringify({ events })
  const token = getStoredValue(STORAGE_KEYS.ACCESS_TOKEN)
  const headers = { 'content-type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`

  if (!token && typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    const blob = new Blob([body], { type: 'application/json' })
    if (navigator.sendBeacon(endpoint, blob)) {
      return { ok: true, status: 202 }
    }
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body,
    credentials: 'include',
    keepalive: true
  })
  return { ok: response.ok, status: response.status }
}

export const issueObservability = createIssueObservabilityClient({
  sender: createDefaultSender()
})

export {
  OBSERVABILITY_FINGERPRINT_LIMIT,
  OBSERVABILITY_FINGERPRINT_WINDOW_MS,
  OBSERVABILITY_FLUSH_INTERVAL_MS,
  OBSERVABILITY_MAX_FLUSH_BYTES,
  OBSERVABILITY_MAX_BATCH,
  OBSERVABILITY_SESSION_LIMIT,
  OBSERVABILITY_SLOW_API_MS,
  buildClientFingerprint,
  createDefaultSender,
  createIssueObservabilityClient,
  installIssueFlushLifecycle,
  sanitizeIssueEvent
}
