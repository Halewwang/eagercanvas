import { STORAGE_KEYS } from './constants.js'
import { getStoredValue } from './storage.js'

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
  return fetchImpl(url, buildAuthFetchOptions({ token, options }))
}
