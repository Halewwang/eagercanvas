const ROUTE_ASSET_RELOAD_STORAGE_PREFIX = 'route-load-reload-attempted'

const getErrorText = (error) => [
  error?.name || '',
  error?.message || '',
  typeof error === 'string' ? error : ''
].join(' ')

const getCurrentBuildId = () => {
  try {
    if (typeof __APP_BUILD_ID__ !== 'undefined') return __APP_BUILD_ID__
  } catch {
    // Build globals are injected by Vite in production.
  }
  return 'dev'
}

const getSessionStorage = () => {
  try {
    if (typeof sessionStorage !== 'undefined') return sessionStorage
  } catch {
    // Accessing storage can throw in restricted browser contexts.
  }
  return null
}

const getPageLocation = () => {
  try {
    if (typeof window !== 'undefined' && window.location) return window.location
    if (typeof location !== 'undefined') return location
  } catch {
    // Ignore missing or restricted location objects.
  }
  return null
}

export const isRouteAssetLoadError = (error) => {
  const text = getErrorText(error).toLowerCase()
  return (
    text.includes('failed to fetch dynamically imported module') ||
    text.includes('error loading dynamically imported module') ||
    text.includes('importing a module script failed') ||
    text.includes('chunkloaderror') ||
    /loading chunk .+ failed/.test(text)
  )
}

export const recoverRouteAssetLoadFailure = ({
  error,
  storage = getSessionStorage(),
  location = getPageLocation(),
  buildId = getCurrentBuildId(),
  keyPrefix = ROUTE_ASSET_RELOAD_STORAGE_PREFIX
} = {}) => {
  if (!isRouteAssetLoadError(error)) return false
  if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function') return false
  if (!location || typeof location.reload !== 'function') return false

  const storageKey = `${keyPrefix}:${String(buildId || 'unknown')}`
  try {
    if (storage.getItem(storageKey)) return false
    storage.setItem(storageKey, '1')
    location.reload()
    return true
  } catch {
    return false
  }
}
