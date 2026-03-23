import { env } from '../config/env.js'
import { withRedisClient } from './redis.service.js'

const buckets = new Map()
let lastPruneTs = 0

const PRUNE_INTERVAL_SECONDS = 300

const readBucket = (cacheKey, windowStart) => {
  const items = buckets.get(cacheKey) || []
  return items.filter((timestamp) => timestamp >= windowStart)
}

const writeBucket = (cacheKey, items) => {
  if (!items.length) {
    buckets.delete(cacheKey)
    return
  }
  buckets.set(cacheKey, items)
}

const pruneBuckets = (current, windowSeconds) => {
  if (current - lastPruneTs < PRUNE_INTERVAL_SECONDS) return
  const windowStart = current - windowSeconds
  for (const [key, items] of buckets.entries()) {
    writeBucket(key, items.filter((timestamp) => timestamp >= windowStart))
  }
  lastPruneTs = current
}

const logBackendSelection = (() => {
  let logged = false
  return () => {
    if (logged) return
    logged = true
    console.log('[rate-limit] store', JSON.stringify({
      backend: env.rateLimitStore,
      redisConfigured: !!env.redisUrl
    }))
  }
})()

const ensureSupportedBackend = () => {
  logBackendSelection()
  if (!['memory', 'redis'].includes(env.rateLimitStore)) {
    console.warn('[rate-limit] unsupported store configured, falling back to memory', env.rateLimitStore)
  }
}

const consumeRedisSlidingWindow = async ({ key, limit, windowSeconds, currentSec }) => {
  const member = `${currentSec}:${Math.random().toString(36).slice(2)}`
  const windowMs = Math.max(Number(windowSeconds || 60), 1)
  const minScore = currentSec - windowMs
  const redisResult = await withRedisClient((client) => client.sendCommand([
    'EVAL',
    `
      local key = KEYS[1]
      local now = tonumber(ARGV[1])
      local minScore = tonumber(ARGV[2])
      local limit = tonumber(ARGV[3])
      local member = ARGV[4]
      local ttl = tonumber(ARGV[5])

      redis.call('ZREMRANGEBYSCORE', key, '-inf', minScore)
      local count = redis.call('ZCARD', key)
      if count >= limit then
        local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
        local retryAfter = ttl
        if oldest[2] then
          retryAfter = math.max(ttl - (now - tonumber(oldest[2])), 1)
        end
        return {0, count, retryAfter}
      end

      redis.call('ZADD', key, now, member)
      redis.call('EXPIRE', key, ttl)
      return {1, count + 1, 0}
    `,
    '1',
    key,
    String(currentSec),
    String(minScore),
    String(limit),
    member,
    String(windowMs)
  ]))

  if (!Array.isArray(redisResult) || redisResult.length < 3) return null
  return {
    allowed: Number(redisResult[0]) === 1,
    count: Number(redisResult[1] || 0),
    retryAfterSec: Number(redisResult[2] || 0)
  }
}

export const consumeRateLimit = async ({ key, limit, windowSeconds, currentSec }) => {
  ensureSupportedBackend()
  const now = Number(currentSec || Math.floor(Date.now() / 1000))
  if (env.rateLimitStore === 'redis') {
    const redisResult = await consumeRedisSlidingWindow({
      key,
      limit,
      windowSeconds,
      currentSec: now
    })
    if (redisResult) return redisResult
  }
  const windowStart = now - Number(windowSeconds || 60)
  pruneBuckets(now, windowSeconds)
  const valid = readBucket(key, windowStart)

  if (valid.length >= limit) {
    return {
      allowed: false,
      count: valid.length,
      retryAfterSec: Number(windowSeconds || 60)
    }
  }

  valid.push(now)
  writeBucket(key, valid)
  return {
    allowed: true,
    count: valid.length,
    retryAfterSec: 0
  }
}
