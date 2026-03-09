import { env } from '../config/env.js'
import { HttpError } from '../utils/http.js'

const buckets = new Map()
let lastPruneTs = 0

const nowSec = () => Math.floor(Date.now() / 1000)
const WINDOW_SECONDS = 60
const PRUNE_INTERVAL_SECONDS = 300

const pruneBuckets = (current) => {
  if (current - lastPruneTs < PRUNE_INTERVAL_SECONDS) return
  const windowStart = current - WINDOW_SECONDS
  for (const [key, items] of buckets.entries()) {
    const valid = items.filter((t) => t >= windowStart)
    if (valid.length === 0) buckets.delete(key)
    else buckets.set(key, valid)
  }
  lastPruneTs = current
}

export const rateLimit = (req, _res, next) => {
  const authHeader = String(req.headers.authorization || '')
  const authSuffix = authHeader.startsWith('Bearer ') ? authHeader.slice(-16) : 'anonymous'
  const key = `${req.ip}:${req.path}:${authSuffix}`
  const current = nowSec()
  const windowStart = current - WINDOW_SECONDS
  pruneBuckets(current)
  const items = buckets.get(key) || []
  const valid = items.filter((t) => t >= windowStart)

  if (valid.length >= env.rateLimitPerMinute) {
    return next(new HttpError(429, 'Too many requests', 'RATE_LIMITED'))
  }

  valid.push(current)
  buckets.set(key, valid)
  next()
}
