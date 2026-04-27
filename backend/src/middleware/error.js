import { HttpError } from '../utils/http.js'
import { ZodError } from 'zod'

/* global console */

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
  }

  res.status(status).json({
    code,
    message,
    requestId: req.requestId
  })
}
