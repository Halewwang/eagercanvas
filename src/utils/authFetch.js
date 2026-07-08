import { DEFAULT_API_BASE_URL, STORAGE_KEYS } from './constants.js'
import { getStoredValue, removeStoredValue, setStoredValue } from './storage.js'

const API_PREFIX = '/api/v1'
const AUTH_REFRESH_PATH = '/auth/refresh'

const trimTrailingSlash = (value = '') => String(value || '').replace(/\/+$/, '')

const isAbsoluteUrl = (value = '') => /^[a-z][a-z\d+\-.]*:\/\//i.test(String(value || ''))

const getRefreshPathForUrl = (value = '') => {
  const path = String(value || '')
  const apiIndex = path.indexOf(`${API_PREFIX}/`)
  if (apiIndex >= 0) return `${path.slice(0, apiIndex + API_PREFIX.length)}${AUTH_REFRESH_PATH}`
  if (path === API_PREFIX) return `${API_PREFIX}${AUTH_REFRESH_PATH}`
  return `${trimTrailingSlash(DEFAULT_API_BASE_URL)}${AUTH_REFRESH_PATH}`
}

export const getAuthRefreshUrl = (requestUrl = '') => {
  const value = String(requestUrl || '')

  if (isAbsoluteUrl(value)) {
    try {
      const url = new URL(value)
      return `${url.origin}${getRefreshPathForUrl(url.pathname)}`
    } catch {
      return `${trimTrailingSlash(DEFAULT_API_BASE_URL)}${AUTH_REFRESH_PATH}`
    }
  }

  return getRefreshPathForUrl(value)
}

const readRefreshAccessToken = async (response) => {
  if (!response?.ok) return ''
  try {
    const data = await response.json()
    return String(data?.accessToken || data?.data?.accessToken || '').trim()
  } catch {
    return ''
  }
}

export const refreshFetchAuthToken = async (
  requestUrl,
  {
    fetchImpl = fetch,
    storage
  } = {}
) => {
  const response = await fetchImpl(getAuthRefreshUrl(requestUrl), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    credentials: 'include'
  })
  const accessToken = await readRefreshAccessToken(response)

  if (accessToken) {
    setStoredValue(STORAGE_KEYS.ACCESS_TOKEN, accessToken, { storage })
    return accessToken
  }

  removeStoredValue(STORAGE_KEYS.ACCESS_TOKEN, { storage })
  return ''
}

export const buildAuthFetchOptions = ({
  token = '',
  options = {}
} = {}) => {
  const headers = {
    ...(options.headers || {})
  }
  const authToken = String(token || '').trim()

  if (authToken && !headers.Authorization) {
    headers.Authorization = `Bearer ${authToken}`
  }

  return {
    ...options,
    headers,
    credentials: options.credentials || 'include'
  }
}

export const fetchWithAuth = async (
  url,
  options = {},
  {
    fetchImpl = fetch,
    storage
  } = {}
) => {
  const token = getStoredValue(STORAGE_KEYS.ACCESS_TOKEN, '', { storage })
  const response = await fetchImpl(url, buildAuthFetchOptions({ token, options }))
  if (response?.status !== 401 || String(url || '').includes(AUTH_REFRESH_PATH)) {
    return response
  }

  const nextToken = await refreshFetchAuthToken(url, { fetchImpl, storage })
  if (!nextToken) return response

  return fetchImpl(url, buildAuthFetchOptions({ token: nextToken, options }))
}
