import { env } from '../../config/env.js'
import { HttpError } from '../../utils/http.js'
import { attachProviderResponseMetadata } from '../provider-response-metadata.js'

const parseProviderBases = () => {
  const rawList = String(env.providerApiBaseUrls || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

  const list = rawList.length > 0 ? rawList : [String(env.providerApiBaseUrl || '').trim()]
  return [...new Set(list.filter(Boolean))]
}

const providerBases = parseProviderBases()

export const buildProviderUrl = (baseUrl, path) => {
  if (/^https?:\/\//i.test(path)) return path

  const base = String(baseUrl || '').replace(/\/+$/, '')
  let normalizedPath = path.startsWith('/') ? path : `/${path}`

  if (base.endsWith('/v1') && normalizedPath.startsWith('/v1/')) {
    normalizedPath = normalizedPath.slice(3)
  }
  if (base.endsWith('/v1') && normalizedPath.startsWith('/v1beta/')) {
    return `${base.slice(0, -3)}${normalizedPath}`
  }
  if (base.endsWith('/v1beta') && normalizedPath.startsWith('/v1beta/')) {
    normalizedPath = normalizedPath.slice(7)
  }
  if (base.endsWith('/v1beta') && normalizedPath.startsWith('/v1/')) {
    return `${base.slice(0, -7)}${normalizedPath}`
  }

  return `${base}${normalizedPath}`
}

const resolveApiKey = (requestOptions = {}) => {
  const override = String(requestOptions?.apiKey || '').trim()
  const fallback = String(env.providerApiKey || '').trim()
  return override || fallback
}

const buildHeaders = (extra = {}, requestOptions = {}) => {
  const apiKey = resolveApiKey(requestOptions)
  if (!apiKey) {
    throw new HttpError(500, 'PROVIDER_API_KEY is not configured', 'PROVIDER_NOT_CONFIGURED')
  }

  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    ...extra
  }
}

const buildAuthHeaders = (extra = {}, requestOptions = {}) => {
  const apiKey = resolveApiKey(requestOptions)
  if (!apiKey) {
    throw new HttpError(500, 'PROVIDER_API_KEY is not configured', 'PROVIDER_NOT_CONFIGURED')
  }

  return {
    Authorization: `Bearer ${apiKey}`,
    ...extra
  }
}

const parseProviderResponse = async (response) => {
  const text = await response.text()
  if (!text) return null

  try {
    return JSON.parse(text)
  } catch {
    return { raw: text }
  }
}

const extractProviderErrorMessage = (data, status) => {
  const candidates = [
    data?.error?.message,
    data?.message,
    data?.msg,
    data?.error_msg,
    data?.errorMessage,
    data?.ErrorMessage,
    data?.Response?.ErrorMessage,
    data?.Response?.ErrorMsg,
    data?.error?.msg,
    data?.raw
  ]

  const found = candidates.find((value) => value !== undefined && value !== null && String(value).trim() !== '')
  return found ? String(found).trim() : `Provider request failed: ${status}`
}

const callProviderWithBase = async (base, path, body, method = 'POST', requestOptions = {}) => {
  const controller = new AbortController()
  const timeoutMs = Number(requestOptions?.timeoutMs || env.providerTimeoutMs || 90000)
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(buildProviderUrl(base, path), {
      method,
      headers: buildHeaders({}, requestOptions),
      body: method === 'GET' ? undefined : JSON.stringify(body),
      signal: controller.signal
    })
    const data = await parseProviderResponse(response)

    if (!response.ok) {
      const message = extractProviderErrorMessage(data, response.status)
      throw new HttpError(response.status, message, 'PROVIDER_ERROR')
    }

    return attachProviderResponseMetadata(data || {}, response)
  } finally {
    clearTimeout(timer)
  }
}

const callProviderMultipartWithBase = async (base, path, formData, method = 'POST', requestOptions = {}) => {
  const controller = new AbortController()
  const timeoutMs = Number(requestOptions?.timeoutMs || env.providerTimeoutMs || 90000)
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(buildProviderUrl(base, path), {
      method,
      headers: buildAuthHeaders({}, requestOptions),
      body: method === 'GET' ? undefined : formData,
      signal: controller.signal
    })
    const data = await parseProviderResponse(response)

    if (!response.ok) {
      const message = extractProviderErrorMessage(data, response.status)
      throw new HttpError(response.status, message, 'PROVIDER_ERROR')
    }

    return attachProviderResponseMetadata(data || {}, response)
  } finally {
    clearTimeout(timer)
  }
}

export const callProvider = async (path, body, method = 'POST', requestOptions = {}) => {
  if (!providerBases.length) {
    throw new HttpError(500, 'PROVIDER_API_BASE_URL is not configured', 'PROVIDER_NOT_CONFIGURED')
  }

  let lastError
  for (const base of providerBases) {
    try {
      return await callProviderWithBase(base, path, body, method, requestOptions)
    } catch (error) {
      lastError = error
      const status = Number(error?.status || 0)
      const retryableHttp = status === 429 || status >= 500
      const retryableNetwork = error?.name === 'AbortError' || !status
      if (!retryableHttp && !retryableNetwork) {
        throw error
      }
    }
  }

  throw lastError || new HttpError(502, 'Provider request failed', 'PROVIDER_ERROR')
}

const callProviderStreamWithBase = async (base, path, body, method = 'POST', requestOptions = {}) => {
  const controller = new AbortController()
  const timeoutMs = Number(requestOptions?.timeoutMs || env.providerTimeoutMs || 90000)
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(buildProviderUrl(base, path), {
      method,
      headers: buildHeaders({}, requestOptions),
      body: method === 'GET' ? undefined : JSON.stringify(body),
      signal: requestOptions?.signal || controller.signal
    })

    if (!response.ok) {
      const data = await parseProviderResponse(response)
      const message = extractProviderErrorMessage(data, response.status)
      throw new HttpError(response.status, message, 'PROVIDER_ERROR')
    }

    return response
  } finally {
    clearTimeout(timer)
  }
}

export const callProviderStream = async (path, body, method = 'POST', requestOptions = {}) => {
  if (!providerBases.length) {
    throw new HttpError(500, 'PROVIDER_API_BASE_URL is not configured', 'PROVIDER_NOT_CONFIGURED')
  }

  let lastError
  for (const base of providerBases) {
    try {
      return await callProviderStreamWithBase(base, path, body, method, requestOptions)
    } catch (error) {
      lastError = error
      const status = Number(error?.status || 0)
      const retryableHttp = status === 429 || status >= 500
      const retryableNetwork = error?.name === 'AbortError' || !status
      if (!retryableHttp && !retryableNetwork) {
        throw error
      }
    }
  }

  throw lastError || new HttpError(502, 'Provider stream request failed', 'PROVIDER_ERROR')
}

export const callProviderMultipart = async (path, formData, method = 'POST', requestOptions = {}) => {
  if (!providerBases.length) {
    throw new HttpError(500, 'PROVIDER_API_BASE_URL is not configured', 'PROVIDER_NOT_CONFIGURED')
  }

  let lastError
  for (const base of providerBases) {
    try {
      return await callProviderMultipartWithBase(base, path, formData, method, requestOptions)
    } catch (error) {
      lastError = error
      const status = Number(error?.status || 0)
      const retryableHttp = status === 429 || status >= 500
      const retryableNetwork = error?.name === 'AbortError' || !status
      if (!retryableHttp && !retryableNetwork) {
        throw error
      }
    }
  }

  throw lastError || new HttpError(502, 'Provider request failed', 'PROVIDER_ERROR')
}

export const callProviderWithFallback = async (paths, method = 'GET', body = null, requestOptions = {}) => {
  let lastError
  for (const path of paths) {
    try {
      return await callProvider(path, body, method, requestOptions)
    } catch (error) {
      lastError = error
      const status = Number(error?.status || 0)
      const message = String(error?.message || '').toLowerCase()
      const shouldTryNextPath =
        status === 404 ||
        status === 405 ||
        /not found|no such endpoint|unknown endpoint|unsupported route/.test(message)
      if (!shouldTryNextPath) {
        throw error
      }
    }
  }
  throw lastError || new HttpError(502, 'Provider status endpoint failed', 'PROVIDER_ERROR')
}
