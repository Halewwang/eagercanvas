import { waitUntil } from '@vercel/functions'
import { queueIssueEvent } from '../services/issue-events.service.js'

const SLOW_REQUEST_MS = 3000

const normalizePathTemplate = (req) => {
  const baseUrl = String(req.baseUrl || '').trim()
  const routePath = req.route?.path ? String(req.route.path) : ''
  return routePath ? `${baseUrl}${routePath}` : req.path
}

export const createRequestObserver = ({
  slowRequestMs = SLOW_REQUEST_MS,
  recordIssue = queueIssueEvent
} = {}) => (req, res, next) => {
  const startedAt = Date.now()
  res.on('finish', () => {
    const durationMs = Date.now() - startedAt
    const pathTemplate = normalizePathTemplate(req)

    if (res.statusCode >= 500 && !req.issueErrorReported) {
      waitUntil(recordIssue({
        source_layer: 'backend',
        category: 'api_error',
        severity: 'p1',
        request_id: req.requestId,
        user_id: req.user?.id,
        method: req.method,
        path_template: pathTemplate,
        status_code: res.statusCode,
        duration_ms: durationMs,
        error_code: `HTTP_${res.statusCode}`,
        message_summary: `HTTP ${res.statusCode} response`
      }).catch(() => {}))
    }

    if (durationMs >= slowRequestMs) {
      waitUntil(recordIssue({
        source_layer: 'performance',
        category: 'slow_request',
        severity: res.statusCode >= 500 ? 'p1' : 'p2',
        request_id: req.requestId,
        user_id: req.user?.id,
        method: req.method,
        path_template: pathTemplate,
        status_code: res.statusCode,
        duration_ms: durationMs,
        message_summary: `Slow request: ${durationMs}ms`
      }).catch(() => {}))
    }
  })
  next()
}

export default createRequestObserver
