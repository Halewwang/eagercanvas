import { HttpError } from '../../utils/http.js'
import { callProvider } from './http-client.js'
import { extractPredictionMeta, normalizeImageResponse } from './image-response.js'

export const PENDING_PREDICTION_STATUSES = ['created', 'queued', 'pending', 'processing', 'running', 'in_progress']

export const isPendingPredictionStatus = (status = '') =>
  PENDING_PREDICTION_STATUSES.includes(String(status || '').trim().toLowerCase())

export const pollPredictionResult = async (requestId, attempts = 20, intervalMs = 3000, requestOptions = {}) => {
  const safeRequestId = String(requestId || '').trim()
  if (!safeRequestId) return null

  let lastResponse = null
  for (let index = 0; index < attempts; index += 1) {
    const current = await callProvider(`/ws/api/v3/predictions/${safeRequestId}/result`, null, 'GET', requestOptions)
    lastResponse = current

    const normalized = normalizeImageResponse(current)
    if (Array.isArray(normalized.data) && normalized.data.length > 0) {
      return current
    }
    const meta = extractPredictionMeta(current)
    if (meta.status === 'failed' || meta.error) {
      throw new HttpError(502, meta.error || 'Image generation failed', 'IMAGE_GENERATION_FAILED')
    }

    if (!isPendingPredictionStatus(meta.status)) {
      return current
    }

    if (index < attempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs))
    }
  }

  return lastResponse
}

export const normalizePredictionTaskStatus = (taskId, raw = {}) => {
  const safeTaskId = String(taskId || '').trim()
  const normalized = normalizeImageResponse(raw)
  if (Array.isArray(normalized.data) && normalized.data.length > 0) {
    return {
      ...normalized,
      task_id: safeTaskId,
      status: 'completed',
      raw
    }
  }

  const prediction = extractPredictionMeta(raw)
  return {
    task_id: safeTaskId,
    status: prediction.status || 'processing',
    message: prediction.error || '',
    raw
  }
}
