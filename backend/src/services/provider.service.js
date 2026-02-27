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

const RATIO_TO_VIDEO_SIZE = {
  '16:9': '1280x720',
  '9:16': '720x1280',
  '4:3': '1152x864',
  '3:4': '864x1152',
  '1:1': '1024x1024'
}

const normalizeVideoSize = (value) => {
  if (!value) return undefined
  if (typeof value === 'string' && value.includes(':')) return RATIO_TO_VIDEO_SIZE[value] || undefined
  if (typeof value === 'string' && value.includes('x')) return value
  return undefined
}

const normalizeImagePayload = (payload = {}) => {
  const rawModel = String(payload.model_name || payload.model || '').trim()
  const model = rawModel === 'nano-banana-pro' ? 'nano-banana' : rawModel
  const prompt = payload.prompt || ''
  const image = Array.isArray(payload.image) ? payload.image[0] : payload.image
  const images = Array.isArray(payload.image) ? payload.image : (Array.isArray(payload.images) ? payload.images : undefined)

  if (model.startsWith('nano-banana')) {
    return {
      model: 'nano-banana',
      model_name: 'nano-banana',
      prompt,
      image,
      images
    }
  }

  return {
    model,
    model_name: model || undefined,
    prompt,
    size: payload.size,
    quality: payload.quality,
    image,
    images
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
  const aspectRatio = body.aspect_ratio || (typeof body.size === 'string' && body.size.includes(':') ? body.size : undefined)
  const size = normalizeVideoSize(body.size) || normalizeVideoSize(aspectRatio)
  const duration = body.duration || body.seconds

  if (isKling) {
    if (hasImageInput) {
      const image = body.image || body.image_url || body.first_frame_image || body.last_frame_image || body.images?.[0]
      return callProvider('/video/image2video', {
        model_name: body.model_name || body.model,
        prompt: body.prompt || '',
        image,
        aspect_ratio: aspectRatio,
        size,
        duration
      })
    }

    return callProvider('/video/text2video', {
      model_name: body.model_name || body.model,
      prompt: body.prompt || '',
      aspect_ratio: aspectRatio,
      size,
      duration
    })
  }

  return callProvider('/video/generations', {
    model: body.model,
    model_name: body.model_name || body.model,
    prompt: body.prompt || '',
    image: body.image || body.first_frame_image,
    images: body.images,
    size,
    duration
  })
}

export const providerVideoStatus = (taskId) => callProvider(`/video/task/${taskId}`, null, 'GET')
