import { env } from '../../config/env.js'
import { HttpError } from '../../utils/http.js'
import { normalizeProviderVisibleMessage } from '../../utils/provider-visible-message.js'
import { attachProviderResponseMetadata } from '../provider-response-metadata.js'
import { buildProviderUrl } from './http-client.js'
import { buildApimartImageRequestBody } from './image-request.js'

const requestApimart = async (path, method, body, requestOptions) => {
  const apiKey = String(requestOptions.apimartApiKey || env.apimartApiKey || '').trim()
  if (!apiKey) throw new HttpError(500, 'APIMART_API_KEY is not configured', 'APIMART_NOT_CONFIGURED')
  const controller = new AbortController()
  const abort = () => controller.abort(requestOptions.signal.reason)
  if (requestOptions.signal?.aborted) abort()
  else requestOptions.signal?.addEventListener('abort', abort, { once: true })
  const configuredTimeout = Number(requestOptions.timeoutMs ?? env.apimartTimeoutMs)
  const timeoutMs = Number.isFinite(configuredTimeout) && configuredTimeout > 0 ? configuredTimeout : 1800000
  const timer = setTimeout(() => controller.abort(new DOMException('APIMart request timed out', 'AbortError')), timeoutMs)
  try {
    if (controller.signal.aborted) throw controller.signal.reason
    const response = await fetch(buildProviderUrl(env.apimartApiBaseUrl || 'https://api.apimart.ai/v1', path), {
      method,
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: method === 'GET' ? undefined : JSON.stringify(body),
      signal: controller.signal
    })
    let raw
    try { raw = await response.json() } catch (error) {
      if (controller.signal.aborted) throw controller.signal.reason
      if (!response.ok) throw attachProviderResponseMetadata(new HttpError(response.status, `APIMart request failed: ${response.status}`, 'PROVIDER_ERROR'), response)
      throw attachProviderResponseMetadata(new HttpError(502, 'APIMart returned invalid JSON', 'PROVIDER_INVALID_RESPONSE'), response)
    }
    if (!response.ok || Number(raw?.code) !== 200) {
      const code = Number(raw?.code || raw?.error?.code)
      const status = !response.ok ? response.status : code >= 400 && code <= 599 ? code : 502
      const message = normalizeProviderVisibleMessage(raw?.error?.message || raw?.message || raw?.msg, `APIMart request failed: ${status}`)
      throw attachProviderResponseMetadata(new HttpError(status, message, 'PROVIDER_ERROR'), response)
    }
    return { raw, response }
  } finally {
    clearTimeout(timer)
    requestOptions.signal?.removeEventListener('abort', abort)
  }
}

export const createApimartImage = async (payload = {}, requestOptions = {}) => {
  const body = buildApimartImageRequestBody(payload)
  const { raw, response } = await requestApimart('/v1/images/generations', 'POST', body, requestOptions)
  const taskId = String(raw.data?.[0]?.task_id || '').trim()
  if (!taskId) throw attachProviderResponseMetadata(new HttpError(502, 'APIMart did not return an image task ID', 'IMAGE_TASK_ID_REQUIRED'), response)
  return attachProviderResponseMetadata({ task_id: taskId, status: 'submitted', data: [], raw }, response)
}

export const getApimartImageTask = async (taskId, requestOptions = {}) => {
  const id = typeof taskId === 'string' ? taskId.trim() : ''
  if (!id) throw new HttpError(400, 'Image task ID is required', 'IMAGE_TASK_ID_REQUIRED')
  const { raw, response } = await requestApimart(`/v1/tasks/${encodeURIComponent(id)}`, 'GET', undefined, requestOptions)
  const task = raw.data
  const status = String(task?.status || '').trim().toLowerCase().replace(/^pending$/, 'submitted').replace(/^canceled$/, 'cancelled')
  if (!['submitted', 'processing', 'completed', 'failed', 'cancelled'].includes(status)) {
    throw attachProviderResponseMetadata(new HttpError(502, 'APIMart returned an unknown image task status', 'PROVIDER_INVALID_RESPONSE'), response)
  }
  const urls = (Array.isArray(task.result?.images) ? task.result.images : [])
    .flatMap(image => Array.isArray(image?.url) ? image.url : [image?.url])
    .filter(url => typeof url === 'string' && /^https?:\/\/\S+$/i.test(url.trim()))
    .map(url => url.trim())
  const data = [...new Set(urls)].map(url => ({ url }))
  if (status === 'completed' && !data.length) {
    throw attachProviderResponseMetadata(new HttpError(502, 'APIMart completed the task without image output', 'NO_IMAGE_OUTPUT'), response)
  }
  const failure = task.error || raw.error
  const error = ['failed', 'cancelled'].includes(status) ? {
    ...(failure && typeof failure === 'object' ? failure : {}),
    message: normalizeProviderVisibleMessage(failure?.message || (typeof failure === 'string' ? failure : ''), status === 'cancelled' ? 'Image generation was cancelled' : 'Image generation failed')
  } : undefined
  return attachProviderResponseMetadata({
    task_id: String(task.id || task.task_id || id),
    status,
    progress: Math.max(0, Math.min(100, Number(task.progress) || 0)),
    data,
    ...(error ? { error } : {}),
    raw
  }, response)
}
