import { env } from '../config/env.js'
import { HttpError } from '../utils/http.js'

const normalizeBaseUrl = (input = '') => {
  const raw = String(input || '').trim()
  if (!raw) return 'https://api.302.ai'
  const noTrail = raw.replace(/\/+$/, '')
  return noTrail
    .replace(/\/v1beta$/i, '')
    .replace(/\/v1$/i, '')
}

const buildAuthHeader = () => {
  const raw = String(env.dashboard302ApiKey || env.providerApiKey || '').trim()
  if (!raw) {
    throw new HttpError(
      500,
      'DASHBOARD_302_API_KEY (or PROVIDER_API_KEY) is not configured',
      'DASHBOARD_302_NOT_CONFIGURED'
    )
  }
  return raw.toLowerCase().startsWith('bearer ') ? raw : `Bearer ${raw}`
}

const parseResponse = async (response) => {
  const text = await response.text()
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    return { raw: text }
  }
}

const runtimeApiKeyCache = new Map()
const RUNTIME_API_KEY_TTL_MS = 60 * 1000

const call302Dashboard = async (path, options = {}) => {
  const { method = 'GET', params = null, body } = options
  const controller = new AbortController()
  const timeoutMs = Number(env.dashboard302TimeoutMs || env.providerTimeoutMs || 30000)
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const url = new URL(`${normalizeBaseUrl(env.dashboard302ApiBaseUrl)}${path}`)
    if (params && typeof params === 'object') {
      Object.entries(params).forEach(([k, v]) => {
        if (v === undefined || v === null || String(v).trim() === '') return
        url.searchParams.set(k, String(v))
      })
    }

    const response = await fetch(url.toString(), {
      method,
      headers: {
        Authorization: buildAuthHeader(),
        'Content-Type': 'application/json'
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal
    })

    const data = await parseResponse(response)

    if (!response.ok) {
      throw new HttpError(
        response.status,
        data?.msg || data?.message || data?.error?.message || `302 dashboard request failed: ${response.status}`,
        'DASHBOARD_302_ERROR'
      )
    }

    return data
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new HttpError(504, '302 dashboard request timeout', 'DASHBOARD_302_TIMEOUT')
    }
    throw error
  } finally {
    clearTimeout(timer)
  }
}

export const get302Balance = () => call302Dashboard('/dashboard/balance')

export const get302RecordByRequestId = (requestId) => {
  const id = String(requestId || '').trim()
  if (!id) throw new HttpError(400, 'requestId is required', 'INVALID_REQUEST_ID')
  return call302Dashboard(`/dashboard/record/${encodeURIComponent(id)}`)
}

export const get302ApiRecords = (query = {}) => call302Dashboard('/dashboard/api-record', { params: query })

export const get302ApiKeys = () => call302Dashboard('/dashboard/api_keys')

export const get302ApiKey = (apiName) => {
  const safeName = String(apiName || '').trim()
  if (!safeName) throw new HttpError(400, 'apiName is required', 'INVALID_API_NAME')
  return call302Dashboard(`/dashboard/api_key/${encodeURIComponent(safeName)}`)
}

export const get302RuntimeApiKeyByName = async (apiName) => {
  const safeName = String(apiName || '').trim()
  if (!safeName) return ''

  const cached = runtimeApiKeyCache.get(safeName)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.apiKey
  }

  const response = await get302ApiKey(safeName)
  const payload = response?.data && typeof response.data === 'object' ? response.data : response
  const apiKey = String(payload?.api_key || payload?.key || '').trim()
  if (!apiKey) return ''

  runtimeApiKeyCache.set(safeName, {
    apiKey,
    expiresAt: Date.now() + RUNTIME_API_KEY_TTL_MS
  })
  return apiKey
}

export const create302ApiKey = (payload = {}) =>
  call302Dashboard('/dashboard/api_key', {
    method: 'POST',
    body: payload
  })

export const update302ApiKey = (apiName, payload = {}) => {
  const safeName = String(apiName || '').trim()
  if (!safeName) throw new HttpError(400, 'apiName is required', 'INVALID_API_NAME')
  return call302Dashboard(`/dashboard/api_key/${encodeURIComponent(safeName)}`, {
    method: 'PUT',
    body: payload
  })
}

export const delete302ApiKey = (apiName) => {
  const safeName = String(apiName || '').trim()
  if (!safeName) throw new HttpError(400, 'apiName is required', 'INVALID_API_NAME')
  return call302Dashboard(`/dashboard/api_key/${encodeURIComponent(safeName)}`, {
    method: 'DELETE'
  })
}
