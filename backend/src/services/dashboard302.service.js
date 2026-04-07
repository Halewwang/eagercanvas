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

export const resolveDashboard302BaseUrl = (dashboardBaseUrl = '', _providerBaseUrl = '') => {
  const explicit = String(dashboardBaseUrl || '').trim()
  return normalizeBaseUrl(explicit || 'https://api.302.ai')
}

export const assert302DashboardSuccess = (data = {}) => {
  if (!data || typeof data !== 'object' || Array.isArray(data) || data.code === undefined || data.code === null) return data
  const code = Number(data.code)
  if (Number.isFinite(code) && code === 0) return data
  const status = Number.isInteger(code) && code >= 400 && code <= 599 ? code : 400

  throw new HttpError(
    status,
    data?.msg || data?.message || data?.error?.message || `302 dashboard request failed: ${data.code}`,
    'DASHBOARD_302_ERROR'
  )
}

const toBearerHeader = (value = '') => {
  const raw = String(value || '').trim()
  if (!raw) return ''
  return raw.toLowerCase().startsWith('bearer ') ? raw : `Bearer ${raw}`
}

export const buildDashboard302AuthHeaders = (dashboardApiKey = '', providerApiKey = '') => {
  const headers = [
    toBearerHeader(dashboardApiKey),
    toBearerHeader(providerApiKey)
  ].filter(Boolean)
  return [...new Set(headers)]
}

export const shouldRetry302DashboardWithNextKey = (data = {}) => {
  const code = Number(data?.code)
  const message = String(data?.msg || data?.message || data?.error?.message || '').toLowerCase()
  return code === -1 && /key|密钥|禁用|不存在|invalid|disabled/.test(message)
}

const getAuthHeaders = () => {
  const headers = buildDashboard302AuthHeaders(env.dashboard302ApiKey, env.providerApiKey)
  if (!headers.length) {
    throw new HttpError(
      500,
      'DASHBOARD_302_API_KEY (or PROVIDER_API_KEY) is not configured',
      'DASHBOARD_302_NOT_CONFIGURED'
    )
  }
  return headers
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

const toFiniteNumber = (...values) => {
  for (const value of values) {
    if (value === undefined || value === null || String(value).trim() === '') continue
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return 0
}

export const normalize302ApiKeyList = (payload = {}) => {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload?.data?.items)) return payload.data.items
  if (Array.isArray(payload?.items)) return payload.items
  return []
}

export const normalize302ApiRecordList = (payload = {}) => {
  const source = payload?.data && typeof payload.data === 'object' ? payload.data : payload
  return {
    items: Array.isArray(source?.items)
      ? source.items
      : (Array.isArray(source?.data) ? source.data : (Array.isArray(source) ? source : [])),
    pagination: source?.pagination || payload?.pagination || null
  }
}

export const normalizeDashboardRecord = (record = {}) => {
  if (!record || typeof record !== 'object') return null
  return {
    model: String(record.model || record.model_name || '').trim(),
    inputTokens: toFiniteNumber(
      record.input_token,
      record.inputTokens,
      record.prompt_tokens,
      record.promptTokens
    ),
    outputTokens: toFiniteNumber(
      record.output_token,
      record.outputTokens,
      record.completion_tokens,
      record.completionTokens
    ),
    costUsd: toFiniteNumber(
      record.cost,
      record.cost_usd,
      record.total_cost,
      record.totalCost,
      record.amount,
      record.current_cost,
      record.currentCost
    ),
    rawUsage: record
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
    const authHeaders = getAuthHeaders()
    let lastBusinessError = null

    for (const authHeader of authHeaders) {
      const url = new URL(`${resolveDashboard302BaseUrl(env.dashboard302ApiBaseUrl, env.providerApiBaseUrl)}${path}`)
      if (params && typeof params === 'object') {
        Object.entries(params).forEach(([k, v]) => {
          if (v === undefined || v === null || String(v).trim() === '') return
          url.searchParams.set(k, String(v))
        })
      }

      const response = await fetch(url.toString(), {
        method,
        headers: {
          Authorization: authHeader,
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

      if (shouldRetry302DashboardWithNextKey(data) && authHeader !== authHeaders[authHeaders.length - 1]) {
        lastBusinessError = data
        continue
      }

      return assert302DashboardSuccess(data)
    }

    return assert302DashboardSuccess(lastBusinessError)
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

  let apiKey = ''

  try {
    const response = await get302ApiKey(safeName)
    const payload = response?.data && typeof response.data === 'object' ? response.data : response
    apiKey = String(payload?.api_key || payload?.key || '').trim()
  } catch (error) {
    apiKey = ''
  }

  if (!apiKey) {
    try {
      const response = await get302ApiKeys()
      const list = normalize302ApiKeyList(response)
      const matched = list.find((item) => String(item?.api_name || '').trim() === safeName)
      apiKey = String(matched?.api_key || matched?.key || '').trim()
    } catch (error) {
      apiKey = ''
    }
  }

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
