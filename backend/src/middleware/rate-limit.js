import { env } from '../config/env.js'
import { HttpError } from '../utils/http.js'

const buckets = new Map()

const nowSec = () => Math.floor(Date.now() / 1000)

export const rateLimit = (req, _res, next) => {
  const key = `${req.ip}:${req.path}`
  const current = nowSec()
  const windowStart = current - 60
  const items = buckets.get(key) || []
  const valid = items.filter((t) => t >= windowStart)

  if (valid.length >= env.rateLimitPerMinute) {
    return next(new HttpError(429, 'Too many requests', 'RATE_LIMITED'))
  }

  valid.push(current)
  buckets.set(key, valid)
  next()
}
