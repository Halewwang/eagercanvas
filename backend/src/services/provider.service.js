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

const normalizeImagePayload = (payload = {}) => {
  const model = payload.model === 'nano-banana-pro' ? 'nano-banana' : payload.model
  return {
    ...payload,
    model
  }
}

const normalizeVideoPayload = (payload = {}) => {
  const model = payload.model_name || payload.model || ''
  const normalizedModel = model === 'nano-banana-pro' ? 'nano-banana' : model

  return {
    ...payload,
    model: normalizedModel,
    model_name: normalizedModel || payload.model_name
  }
}

export const providerGenerateImage = (payload) => callProvider('/images/generations', normalizeImagePayload(payload))

export const providerCreateVideo = (payload) => {
  const body = normalizeVideoPayload(payload)
  const modelName = String(body.model_name || body.model || '').toLowerCase()
  const isKling = modelName.startsWith('kling')
  const hasImageInput = Boolean(body.image || body.image_url || body.first_frame_image || body.last_frame_image || (Array.isArray(body.images) && body.images.length > 0))

  if (isKling) {
    if (hasImageInput) {
      const image = body.image || body.image_url || body.first_frame_image || body.last_frame_image || body.images?.[0]
      return callProvider('/video/image2video', {
        model_name: body.model_name || body.model,
        prompt: body.prompt || '',
        image,
        aspect_ratio: body.aspect_ratio || body.size,
        duration: body.duration || body.seconds
      })
    }

    return callProvider('/video/text2video', {
      model_name: body.model_name || body.model,
      prompt: body.prompt || '',
      aspect_ratio: body.aspect_ratio || body.size,
      duration: body.duration || body.seconds
    })
  }

  return callProvider('/video/generations', body)
}

export const providerVideoStatus = (taskId) => callProvider(`/video/task/${taskId}`, null, 'GET')
