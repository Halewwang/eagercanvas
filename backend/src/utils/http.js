export class HttpError extends Error {
  constructor(status, message, code = 'BAD_REQUEST', details = null) {
    super(message)
    this.status = status
    this.code = code
    this.details = details
  }
}

export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next)
}

export const buildResponseBody = (res, payload = {}) => ({
  ...payload,
  requestId: payload?.requestId || res.req?.requestId || null
})

export const sendJson = (res, payload = {}, status = 200) => {
  res.status(status).json(buildResponseBody(res, payload))
}

export const sendData = (res, data, options = {}) => {
  const { status = 200, ...extra } = options
  sendJson(res, { data, ...extra }, status)
}
