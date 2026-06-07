import { waitUntil } from '@vercel/functions'
import { HttpError } from '../utils/http.js'
import { ZodError } from 'zod'
import { queueDatabaseIssue, queueIssueEvent } from '../services/issue-events.service.js'

/* global console */

const isDatabaseError = (err = {}) => {
  const code = String(err.code || '')
  return /^PGRST/i.test(code) || /^[0-9A-Z]{5}$/.test(code) || Boolean(err.details || err.hint)
}

export const buildServerErrorIssuePayload = (err, req, status, code) => ({
  source_layer: 'backend',
  category: 'server_error',
  severity: 'p1',
  request_id: req.requestId,
  user_id: req.user?.id,
  method: req.method,
  path_template: req.path,
  status_code: status,
  error_code: code,
  message_summary: err.message || 'Unexpected server error',
  stack_summary: err.stack || '',
  metadata: {
    error_name: err.name || 'Error',
    error_code: err.code || ''
  }
})

// Express error handlers must keep four parameters to be recognized.
// eslint-disable-next-line no-unused-vars
export const errorMiddleware = (err, req, res, _next) => {
  const isValidationError = err instanceof ZodError
  const status = isValidationError ? 400 : err instanceof HttpError ? err.status : 500
  const code = isValidationError ? 'VALIDATION_ERROR' : err instanceof HttpError ? err.code : 'INTERNAL_ERROR'
  const message = isValidationError
    ? err.issues?.[0]?.message || 'Invalid request'
    : err.message || 'Unexpected server error'

  if (status >= 500) {
    console.error('[server:error]', {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      message: err.message,
      stack: err.stack
    })
    req.issueErrorReported = true
    if (isDatabaseError(err)) {
      waitUntil(queueDatabaseIssue(err, {
        requestId: req.requestId,
        userId: req.user?.id,
        method: req.method,
        pathTemplate: req.path
      }).catch(() => {}))
    } else {
      waitUntil(queueIssueEvent(buildServerErrorIssuePayload(err, req, status, code)).catch(() => {}))
    }
  }

  res.status(status).json({
    code,
    message,
    requestId: req.requestId
  })
}

errorMiddleware.buildIssuePayload = buildServerErrorIssuePayload
