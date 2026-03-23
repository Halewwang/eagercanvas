import { deleteSharedCacheValue, getSharedCacheValue, setSharedCacheValue } from './shared-cache.service.js'

const CACHE_TTL_MS = Number(process.env.AUTH_USER_CACHE_TTL_MS || 15000)
const CACHE_NAMESPACE = 'auth-user'

export const getCachedAuthenticatedUser = async (userId) => {
  const safeUserId = String(userId || '').trim()
  if (!safeUserId) return null
  return getSharedCacheValue(CACHE_NAMESPACE, safeUserId)
}

export const setCachedAuthenticatedUser = async (userId, value) => {
  if (!value || typeof value !== 'object') return
  const safeUserId = String(userId || '').trim()
  if (!safeUserId) return
  await setSharedCacheValue(CACHE_NAMESPACE, safeUserId, value, CACHE_TTL_MS)
}

export const invalidateAuthenticatedUserCache = async (userId) => {
  const safeUserId = String(userId || '').trim()
  if (!safeUserId) return
  await deleteSharedCacheValue(CACHE_NAMESPACE, safeUserId)
}
