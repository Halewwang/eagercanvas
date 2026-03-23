import { env } from '../config/env.js'
import { withRedisClient } from './redis.service.js'

const memoryCache = new Map()

const buildCacheKey = (namespace, key) => `${String(namespace || 'default').trim()}:${String(key || '').trim()}`

const memoryRead = (cacheKey) => {
  const cached = memoryCache.get(cacheKey)
  if (!cached) return null
  if (cached.expiresAt <= Date.now()) {
    memoryCache.delete(cacheKey)
    return null
  }
  return cached.value
}

const memoryWrite = (cacheKey, value, ttlMs) => {
  memoryCache.set(cacheKey, {
    value,
    expiresAt: Date.now() + Math.max(Number(ttlMs || 0), 1)
  })
}

const memoryDelete = (cacheKey) => {
  memoryCache.delete(cacheKey)
}

const logBackendSelection = (() => {
  let logged = false
  return () => {
    if (logged) return
    logged = true
    console.log('[cache] provider', JSON.stringify({
      backend: env.cacheBackend,
      redisConfigured: !!env.redisUrl
    }))
  }
})()

const ensureSupportedBackend = () => {
  logBackendSelection()
  if (!['memory', 'redis'].includes(env.cacheBackend)) {
    console.warn('[cache] unsupported backend configured, falling back to memory', env.cacheBackend)
  }
}

const readRedisCache = async (cacheKey) => {
  const raw = await withRedisClient((client) => client.get(cacheKey))
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

const writeRedisCache = async (cacheKey, value, ttlMs) => {
  const payload = JSON.stringify(value)
  const effectiveTtlMs = Math.max(Number(ttlMs || 0), 1)
  const result = await withRedisClient((client) => client.set(cacheKey, payload, { PX: effectiveTtlMs }))
  return result === 'OK'
}

const deleteRedisCache = async (cacheKey) => {
  const deleted = await withRedisClient((client) => client.del(cacheKey))
  return Number(deleted || 0) >= 0
}

export const getSharedCacheValue = async (namespace, key) => {
  ensureSupportedBackend()
  const cacheKey = buildCacheKey(namespace, key)
  if (env.cacheBackend === 'redis') {
    const redisValue = await readRedisCache(cacheKey)
    if (redisValue !== null && redisValue !== undefined) return redisValue
  }
  return memoryRead(cacheKey)
}

export const setSharedCacheValue = async (namespace, key, value, ttlMs) => {
  ensureSupportedBackend()
  const cacheKey = buildCacheKey(namespace, key)
  if (env.cacheBackend === 'redis') {
    const stored = await writeRedisCache(cacheKey, value, ttlMs)
    if (stored) {
      memoryDelete(cacheKey)
      return
    }
  }
  memoryWrite(cacheKey, value, ttlMs)
}

export const deleteSharedCacheValue = async (namespace, key) => {
  ensureSupportedBackend()
  const cacheKey = buildCacheKey(namespace, key)
  if (env.cacheBackend === 'redis') {
    await deleteRedisCache(cacheKey)
  }
  memoryDelete(cacheKey)
}

export const withSharedCache = async (namespace, key, ttlMs, loader) => {
  const cached = await getSharedCacheValue(namespace, key)
  if (cached !== null && cached !== undefined) return cached
  const value = await loader()
  await setSharedCacheValue(namespace, key, value, ttlMs)
  return value
}
