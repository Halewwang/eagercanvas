import { env } from '../config/env.js'
import { HttpError } from '../utils/http.js'

const buildHeaders = (extra = {}) => {
  if (!env.providerApiKey) {
    throw new HttpError(500, 'PROVIDER_API_KEY is not configured', 'PROVIDER_NOT_CONFIGURED')
  }

  return {
    Authorization: `Bearer ${env.providerApiKey}`,
    'Content-Type': 'application/json',
    ...extra
  }
}

const callProvider = async (path, body, method = 'POST') => {
  const response = await fetch(`${env.providerApiBaseUrl}${path}`, {
    method,
    headers: buildHeaders(),
    body: method === 'GET' ? undefined : JSON.stringify(body)
  })

  let data
  try {
    data = await response.json()
  } catch {
    throw new HttpError(502, 'Provider returned invalid JSON', 'PROVIDER_BAD_RESPONSE')
  }

  if (!response.ok) {
    const message = data?.error?.message || data?.message || 'Provider request failed'
    throw new HttpError(response.status, message, 'PROVIDER_ERROR')
  }

  return data
}

export const providerChatCompletions = (payload) => callProvider('/chat/completions', payload)
export const providerGenerateImage = (payload) => callProvider('/images/generations', payload)
export const providerCreateVideo = (payload) => callProvider('/videos', payload)
export const providerVideoStatus = (taskId) => callProvider(`/videos/${taskId}`, null, 'GET')
