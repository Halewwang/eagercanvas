import { HttpError } from '../utils/http.js'

export const errorMiddleware = (err, req, res, _next) => {
  const status = err instanceof HttpError ? err.status : 500
  const code = err instanceof HttpError ? err.code : 'INTERNAL_ERROR'

  if (status >= 500) {
    console.error('[server:error]', {
      method: req.method,
      path: req.path,
      message: err.message,
      stack: err.stack
    })
  }

  res.status(status).json({
    code,
    message: err.message || 'Unexpected server error'
  })
}
