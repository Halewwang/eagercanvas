import { env } from '../config/env.js'
import { consumeRateLimit } from '../services/rate-limit-store.service.js'
import { HttpError } from '../utils/http.js'

const nowSec = () => Math.floor(Date.now() / 1000)
const WINDOW_SECONDS = 60

const stripQuery = (value = '') => String(value || '').split('?')[0] || '/'

const getClientIp = (req) => {
  const forwardedFor = String(req.headers['x-forwarded-for'] || '')
  const firstForwarded = forwardedFor.split(',').map((item) => item.trim()).find(Boolean)
  return firstForwarded || req.ip || 'unknown'
}

const getIdentityKey = (req) => {
  const authHeader = String(req.headers.authorization || '')
  if (authHeader.startsWith('Bearer ')) {
    return `bearer:${authHeader.slice(-16)}`
  }

  const refreshToken = req.cookies?.ec_refresh_token
  if (refreshToken) {
    return `refresh:${String(refreshToken).slice(-16)}`
  }

  return 'anonymous'
}

const getRoutePolicy = (req) => {
  const method = String(req.method || 'GET').toUpperCase()
  const path = stripQuery(req.originalUrl || req.path)

  if (path === '/api/v1/health') {
    return { skip: true, key: 'health', limit: 0 }
  }

  if (path === '/api/v1/auth/send-code' || path === '/api/v1/auth/register/send-code') {
    return { key: 'auth-code', limit: env.rateLimitAuthPerMinute }
  }

  if (
    method === 'POST' &&
    [
      '/api/v1/chat/completions',
      '/api/v1/images/generations',
      '/api/v1/images/remove-background',
      '/api/v1/videos',
      '/api/v1/runs',
      '/api/v1/runs/compat/chat/completions',
      '/api/v1/runs/compat/images/generations',
      '/api/v1/runs/compat/videos'
    ].includes(path)
  ) {
    return { key: 'generate', limit: env.rateLimitGeneratePerMinute }
  }

  if (
    method === 'GET' &&
    (
      /^\/api\/v1\/videos\/[^/]+$/.test(path) ||
      /^\/api\/v1\/runs\/compat\/videos\/[^/]+$/.test(path) ||
      /^\/api\/v1\/runs\/[^/]+$/.test(path)
    )
  ) {
    return { key: 'polling', limit: env.rateLimitPollingPerMinute }
  }

  return { key: 'default', limit: env.rateLimitPerMinute }
}

export const rateLimit = async (req, _res, next) => {
  const policy = getRoutePolicy(req)
  req.rateLimitRouteGroup = policy.key
  if (policy.skip) {
    return next()
  }

  const clientIp = getClientIp(req)
  const identityKey = getIdentityKey(req)
  const path = stripQuery(req.originalUrl || req.path)
  const key = `${policy.key}:${req.method}:${path}:${clientIp}:${identityKey}`
  try {
    const result = await consumeRateLimit({
      key,
      limit: policy.limit,
      windowSeconds: WINDOW_SECONDS,
      currentSec: nowSec()
    })

    if (!result.allowed) {
      return next(new HttpError(429, 'Too many requests', 'RATE_LIMITED', {
        retryAfterSec: result.retryAfterSec || WINDOW_SECONDS,
        limit: policy.limit,
        routeGroup: policy.key
      }))
    }
    next()
  } catch (error) {
    next(error)
  }
}
