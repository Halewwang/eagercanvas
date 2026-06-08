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

const splitBaseUrls = (value = '') =>
  String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

export const resolveDashboard302BaseUrls = (
  dashboardBaseUrl = '',
  providerBaseUrl = '',
  providerBaseUrls = ''
) => {
  const candidates = [
    ...splitBaseUrls(dashboardBaseUrl),
    ...splitBaseUrls(providerBaseUrls),
    ...splitBaseUrls(providerBaseUrl),
    'https://api.302ai.cn',
    'https://api.302.ai'
  ]

  const normalized = candidates.map((item) => normalizeBaseUrl(item)).filter(Boolean)
  return [...new Set(normalized)]
}

export const resolveDashboard302BaseUrl = (dashboardBaseUrl = '', _providerBaseUrl = '') => {
  const explicit = String(dashboardBaseUrl || '').trim()
  const provider = String(_providerBaseUrl || '').trim()
  return resolveDashboard302BaseUrls(explicit, provider)[0]
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

const getDashboardErrorMessage = (error = {}) =>
  String(error?.message || error?.msg || error?.error?.message || '').toLowerCase()

const isRetryableDashboardAuthError = (error = {}) => {
  const status = Number(error?.status || 0)
  const message = getDashboardErrorMessage(error)
  return [400, 401, 403].includes(status) && /key|api key|密钥|权限|不存在|invalid|disabled|permission|unauthorized|forbidden/.test(message)
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

const isRetryableDashboardRequestError = (error) => {
  const status = Number(error?.status || 0)
  return error?.name === 'AbortError' ||
    !status ||
    status === 404 ||
    status === 405 ||
    status === 429 ||
    status >= 500 ||
    isRetryableDashboardAuthError(error)
}

const toNullableNumber = (...values) => {
  for (const value of values) {
    if (value === undefined || value === null || String(value).trim() === '') continue
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
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

export const normalize302ApiKeyUsage = (payload = {}) => {
  const source = payload?.data && typeof payload.data === 'object' ? payload.data : payload
  const currency = String(source?.currency || source?.cost_currency || 'PTC').trim() || 'PTC'

  return {
    totalCost: toNullableNumber(source?.total_cost, source?.totalCost, source?.total, source?.cost),
    monthlyCost: toNullableNumber(source?.monthly_cost, source?.monthlyCost),
    dailyCost: toNullableNumber(source?.daily_cost, source?.dailyCost),
    currency
  }
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

const get302ApiKeyAuthHeader = (apiKey = '') => {
  const safeKey = String(apiKey || '').trim()
  if (!safeKey) {
    throw new HttpError(400, '302 API key is required', 'INVALID_302_API_KEY')
  }
  return {
    safeKey,
    authHeader: toBearerHeader(safeKey)
  }
}

const runtimeApiKeyCache = new Map()
const RUNTIME_API_KEY_TTL_MS = 60 * 1000

const getDashboardBaseUrls = () =>
  resolveDashboard302BaseUrls(env.dashboard302ApiBaseUrl, env.providerApiBaseUrl, env.providerApiBaseUrls)

const request302DashboardWithBase = async (baseUrl, path, options = {}) => {
  const { method = 'GET', params = null, body, authHeader } = options
  const controller = new AbortController()
  const timeoutMs = Number(env.dashboard302TimeoutMs || env.providerTimeoutMs || 30000)
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const url = new URL(`${baseUrl}${path}`)
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

const normalizeDashboardAuthHeaders = (authHeaders = []) =>
  [...new Set((authHeaders || []).map((item) => toBearerHeader(item)).filter(Boolean))]

const call302Dashboard = async (path, options = {}) => {
  const { method = 'GET', params = null, body, authHeaders: explicitAuthHeaders = null } = options
  const authHeaders = explicitAuthHeaders
    ? normalizeDashboardAuthHeaders(explicitAuthHeaders)
    : getAuthHeaders()
  if (!authHeaders.length) {
    throw new HttpError(
      500,
      'DASHBOARD_302_API_KEY (or PROVIDER_API_KEY) is not configured',
      'DASHBOARD_302_NOT_CONFIGURED'
    )
  }
  const baseUrls = getDashboardBaseUrls()
  let lastBusinessError = null
  let lastError = null

  for (const authHeader of authHeaders) {
    for (const baseUrl of baseUrls) {
      try {
        const data = await request302DashboardWithBase(baseUrl, path, {
          method,
          params,
          body,
          authHeader
        })

        if (shouldRetry302DashboardWithNextKey(data) && authHeader !== authHeaders[authHeaders.length - 1]) {
          lastBusinessError = data
          if (baseUrl !== baseUrls[baseUrls.length - 1]) continue
          break
        }

        return assert302DashboardSuccess(data)
      } catch (error) {
        lastError = error
        if (!isRetryableDashboardRequestError(error)) throw error
        if (baseUrl !== baseUrls[baseUrls.length - 1]) continue
        if (isRetryableDashboardAuthError(error) && authHeader !== authHeaders[authHeaders.length - 1]) break
        throw error
      }
    }
  }

  if (lastBusinessError) return assert302DashboardSuccess(lastBusinessError)
  throw lastError || new HttpError(502, '302 dashboard request failed', 'DASHBOARD_302_ERROR')
}

const request302ApiKeyUsageWithBase = async (baseUrl, path, options = {}) => {
  const { params = null, authHeader, safeKey } = options
  const controller = new AbortController()
  const timeoutMs = Number(env.dashboard302TimeoutMs || env.providerTimeoutMs || 30000)
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const url = new URL(`${baseUrl}${path}`)
    if (params && typeof params === 'object') {
      Object.entries(params).forEach(([k, v]) => {
        if (v === undefined || v === null || String(v).trim() === '') return
        url.searchParams.set(k, String(v))
      })
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Authorization: authHeader,
        'X-API-Key': safeKey,
        'Content-Type': 'application/json'
      },
      signal: controller.signal
    })

    const data = await parseResponse(response)

    if (!response.ok || data?.error) {
      const message = data?.error?.message || data?.msg || data?.message || `302 usage-log request failed: ${response.status}`
      throw new HttpError(response.ok ? 400 : response.status, message, 'DASHBOARD_302_USAGE_ERROR')
    }

    return data
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new HttpError(504, '302 usage-log request timeout', 'DASHBOARD_302_TIMEOUT')
    }
    throw error
  } finally {
    clearTimeout(timer)
  }
}

const call302ApiKeyUsage = async (path, options = {}) => {
  const { params = null, apiKey = '' } = options
  const { safeKey, authHeader } = get302ApiKeyAuthHeader(apiKey)
  const baseUrls = getDashboardBaseUrls()
  let lastError = null

  for (const baseUrl of baseUrls) {
    try {
      const data = await request302ApiKeyUsageWithBase(baseUrl, path, {
        params,
        authHeader,
        safeKey
      })

      return assert302DashboardSuccess(data)
    } catch (error) {
      lastError = error
      if (!isRetryableDashboardRequestError(error) || baseUrl === baseUrls[baseUrls.length - 1]) {
        throw error
      }
    }
  }

  throw lastError || new HttpError(502, '302 usage-log request failed', 'DASHBOARD_302_USAGE_ERROR')
}

export const get302Balance = () => call302Dashboard('/dashboard/balance')

export const get302RecordByRequestId = (requestId) => {
  const id = String(requestId || '').trim()
  if (!id) throw new HttpError(400, 'requestId is required', 'INVALID_REQUEST_ID')
  return call302Dashboard(`/dashboard/record/${encodeURIComponent(id)}`)
}

export const get302ApiRecords = (query = {}) => call302Dashboard('/dashboard/api-record', { params: query })

const readApiName = (item = {}) => String(item?.api_name || item?.apiName || '').trim()
const readRuntimeApiKey = (item = {}) => String(item?.api_key || item?.apiKey || item?.key || '').trim()

const getRecordCreatedTime = (record = {}) => {
  const raw = record?.created_at || record?.createdAt || record?.created_time || record?.createdTime || record?.time
  if (!raw) return 0
  const parsed = new Date(raw)
  if (!Number.isNaN(parsed.getTime())) return parsed.getTime()
  const numeric = Number(raw)
  if (!Number.isFinite(numeric)) return 0
  return numeric > 10_000_000_000 ? numeric : numeric * 1000
}

const readPaginationTotalPages = (pagination = {}, currentPage = 1) => {
  const value = Number(
    pagination?.total_page ||
    pagination?.total_pages ||
    pagination?.totalPages ||
    pagination?.last_page ||
    pagination?.lastPage ||
    0
  )
  if (Number.isFinite(value) && value > 0) return value
  const nextPage = Number(pagination?.next_page || pagination?.nextPage || 0)
  if (Number.isFinite(nextPage) && nextPage > currentPage) return nextPage
  return currentPage
}

export const get302ApiRecordsForApiKey = (apiKey, query = {}) => {
  const { authHeader } = get302ApiKeyAuthHeader(apiKey)
  return call302Dashboard('/dashboard/api-record', {
    params: query,
    authHeaders: [authHeader]
  })
}

export const get302ApiRecordsForActiveApiKeys = async (query = {}, deps = {}) => {
  const listApiKeys = deps.listApiKeys || get302ApiKeys
  const fetchRecordsForApiKey = deps.fetchRecordsForApiKey || get302ApiRecordsForApiKey
  const fallbackFetchRecords = deps.fallbackFetchRecords || get302ApiRecords
  let apiKeyItems = []

  try {
    apiKeyItems = normalize302ApiKeyList(await listApiKeys())
  } catch {
    const fallback = await fallbackFetchRecords(query)
    const normalized = normalize302ApiRecordList(fallback)
    return {
      items: normalized.items,
      pagination: normalized.pagination || null
    }
  }

  const runtimeItems = apiKeyItems
    .map((item) => ({
      apiName: readApiName(item),
      apiKey: readRuntimeApiKey(item)
    }))
    .filter((item) => item.apiName && item.apiKey)

  if (!runtimeItems.length) {
    const fallback = await fallbackFetchRecords(query)
    const normalized = normalize302ApiRecordList(fallback)
    return {
      items: normalized.items,
      pagination: normalized.pagination || null
    }
  }

  const page = Math.max(1, Number(query?.page || 1))
  const items = []
  let totalPages = page
  const errors = []

  for (const item of runtimeItems) {
    try {
      const response = await fetchRecordsForApiKey(item.apiKey, query)
      const normalized = normalize302ApiRecordList(response)
      totalPages = Math.max(totalPages, readPaginationTotalPages(normalized.pagination, page))
      items.push(...normalized.items.map((record) => ({
        ...record,
        api_name: readApiName(record) || item.apiName
      })))
    } catch (error) {
      errors.push(error)
    }
  }

  if (!items.length && errors.length === runtimeItems.length) throw errors[0]

  items.sort((a, b) => getRecordCreatedTime(b) - getRecordCreatedTime(a))

  return {
    items,
    pagination: {
      page,
      cur_page: page,
      limit: Number(query?.limit || 0) || items.length,
      total: items.length,
      total_page: totalPages,
      next_page: totalPages > page ? page + 1 : null
    }
  }
}

export const get302ApiKeys = () => call302Dashboard('/dashboard/api_keys')

export const get302ApiKey = (apiName) => {
  const safeName = String(apiName || '').trim()
  if (!safeName) throw new HttpError(400, 'apiName is required', 'INVALID_API_NAME')
  return call302Dashboard(`/dashboard/api_key/${encodeURIComponent(safeName)}`)
}

export const get302TokenIdForApiKey = (apiKey) =>
  call302ApiKeyUsage('/gpt/api/token_id', {
    apiKey,
    params: { api_key: apiKey }
  })

export const get302ApiKeyUsageByKey = async (apiKey) => {
  const tokenResponse = await get302TokenIdForApiKey(apiKey)
  const tokenPayload = tokenResponse?.data && typeof tokenResponse.data === 'object' ? tokenResponse.data : tokenResponse
  const tokenId = String(tokenPayload?.token_id || tokenPayload?.tokenId || tokenPayload?.id || '').trim()
  if (!tokenId) {
    throw new HttpError(502, '302 usage-log token id is missing', 'DASHBOARD_302_USAGE_TOKEN_MISSING')
  }
  return call302ApiKeyUsage(`/gpt/api/token/usage/${encodeURIComponent(tokenId)}`, { apiKey })
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
