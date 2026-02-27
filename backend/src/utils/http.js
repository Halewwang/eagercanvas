export class HttpError extends Error {
  constructor(status, message, code = 'BAD_REQUEST') {
    super(message)
    this.status = status
    this.code = code
  }
}

export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next)
}
