import { env } from '../config/env.js'
import { HttpError } from '../utils/http.js'

const buildProviderUrl = (path) => {
  if (/^https?:\/\//i.test(path)) return path

  const base = String(env.providerApiBaseUrl || '').replace(/\/+$/, '')
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

const parseProviderResponse = async (response) => {
  const text = await response.text()
  if (!text) return null

  try {
    return JSON.parse(text)
  } catch {
    return { raw: text }
  }
}

const callProvider = async (path, body, method = 'POST') => {
  const response = await fetch(buildProviderUrl(path), {
    method,
    headers: buildHeaders(),
    body: method === 'GET' ? undefined : JSON.stringify(body)
  })

  const data = await parseProviderResponse(response)

  if (!response.ok) {
    const message = data?.error?.message || data?.message || `Provider request failed: ${response.status}`
    throw new HttpError(response.status, message, 'PROVIDER_ERROR')
  }

  return data || {}
}

const callProviderWithFallback = async (paths, method = 'GET') => {
  let lastError
  for (const path of paths) {
    try {
      return await callProvider(path, null, method)
    } catch (error) {
      lastError = error
    }
  }
  throw lastError || new HttpError(502, 'Provider status endpoint failed', 'PROVIDER_ERROR')
}

const RATIO_TO_SIZE = {
  '16:9': '1280x720',
  '9:16': '720x1280',
  '4:3': '1152x864',
  '3:4': '864x1152',
  '1:1': '1024x1024'
}

const normalizeVideoSize = (value) => {
  if (!value || typeof value !== 'string') return undefined
  if (value.includes(':')) return RATIO_TO_SIZE[value] || undefined
  if (value.includes('x')) return value
  return undefined
}

const appendSizeHintToPrompt = (prompt = '', size = '') => {
  if (!size) return prompt
  const [width, height] = String(size).split('x')
  if (!width || !height) return prompt

  const ratioHint = `${width}:${height}`
  const safePrompt = String(prompt || '').trim()
  if (!safePrompt) return `Generate an image with aspect ratio ${ratioHint}.`

  return `${safePrompt}\n\nAspect ratio: ${ratioHint}.`
}

const parseDataUrl = (value = '') => {
  const match = String(value).match(/^data:(.+?);base64,(.+)$/)
  if (!match) return null
  return { mimeType: match[1], data: match[2] }
}

const pickFirstImageInput = (payload = {}) => {
  if (typeof payload.image === 'string') return payload.image
  if (Array.isArray(payload.image) && payload.image.length > 0) return payload.image[0]
  if (Array.isArray(payload.images) && payload.images.length > 0) return payload.images[0]
  if (typeof payload.first_frame_image === 'string') return payload.first_frame_image
  if (typeof payload.image_url === 'string') return payload.image_url
  return ''
}

const normalizeImageResponse = (response = {}) => {
  const candidates = Array.isArray(response?.candidates) ? response.candidates : []
  const urls = []

  for (const candidate of candidates) {
    const parts = candidate?.content?.parts || []
    for (const part of parts) {
      const inlineData = part?.inline_data || part?.inlineData
      if (inlineData?.data) {
        const mime = inlineData.mime_type || inlineData.mimeType || 'image/png'
        urls.push(`data:${mime};base64,${inlineData.data}`)
      }
    }
  }

  return {
    data: urls.map((url) => ({ url })),
    raw: response
  }
}

const normalizeKlingStatus = (value) => {
  if (typeof value === 'number') {
    if (value === 99) return 'failed'
    if (value >= 20) return 'completed'
    return 'processing'
  }

  const status = String(value || '').toLowerCase()
  if (!status) return 'processing'
  if (['success', 'succeeded', 'completed', 'done', 'finished'].includes(status)) return 'completed'
  if (['failed', 'error', 'canceled', 'cancelled'].includes(status)) return 'failed'
  return 'processing'
}

const extractVideoUrl = (data = {}) => {
  return (
    data?.url ||
    data?.video_url ||
    data?.video?.url ||
    data?.videos?.[0]?.url ||
    data?.output?.[0]?.url ||
    data?.task?.task_result?.videos?.[0]?.url ||
    data?.task?.task_result?.video_url ||
    data?.task_result?.videos?.[0]?.url ||
    data?.task_result?.video_url ||
    ''
  )
}

const normalizeSoraStatus = (value) => {
  const status = String(value || '').toLowerCase()
  if (['completed', 'succeeded', 'success', 'done', 'finished'].includes(status)) return 'completed'
  if (['failed', 'error', 'canceled', 'cancelled'].includes(status)) return 'failed'
  return status || 'processing'
}

export const providerChatCompletions = (payload) =>
  callProvider('/v1/chat/completions', payload)

export const providerGenerateImage = async (payload = {}) => {
  const model = String(payload.model_name || payload.model || '').trim()
  const size = String(payload.size || '')
  const prompt = appendSizeHintToPrompt(payload.prompt || '', size)
  const inputImage = pickFirstImageInput(payload)
  const imageInline = parseDataUrl(inputImage)

  const parts = [{ text: prompt }]
  if (imageInline) {
    parts.push({
      inline_data: {
        mime_type: imageInline.mimeType,
        data: imageInline.data
      }
    })
  }

  const body = {
    contents: [{ role: 'user', parts }],
    generationConfig: { responseModalities: ['TEXT', 'IMAGE'] }
  }

  const raw = await callProvider(`/v1beta/models/${model}:generateContent`, body)
  return normalizeImageResponse(raw)
}

export const providerCreateVideo = async (payload = {}) => {
  const model = String(payload.model_name || payload.model || '').trim()
  const lowerModel = model.toLowerCase()
  const prompt = String(payload.prompt || '')
  const aspectRatio = payload.aspect_ratio || (typeof payload.size === 'string' && payload.size.includes(':') ? payload.size : undefined)
  const size = normalizeVideoSize(payload.size) || normalizeVideoSize(aspectRatio)
  const duration = Number(payload.duration || payload.seconds || 5)
  const inputImage = pickFirstImageInput(payload)

  if (lowerModel.startsWith('kling-o1')) {
    const raw = await callProvider('/klingai/v1/videos/m2v_omni_video', {
      model_name: 'kling-v1-6',
      input: {
        mode: inputImage ? 'image2video' : 'text2video',
        prompt,
        image: inputImage || undefined,
        duration,
        aspect_ratio: aspectRatio
      }
    })

    return {
      task_id: raw?.task?.task_id || raw?.task_id || raw?.id || '',
      status: normalizeKlingStatus(raw?.task?.task_status || raw?.task?.status || raw?.status),
      raw
    }
  }

  if (lowerModel === 'sora-2') {
    const raw = await callProvider('/v1/videos', {
      model: 'sora-2',
      prompt,
      size: size || '1280x720',
      n_seconds: duration
    })

    return {
      task_id: raw?.id || raw?.task_id || '',
      status: normalizeSoraStatus(raw?.status),
      raw
    }
  }

  throw new HttpError(400, `Unsupported video model: ${model}`, 'UNSUPPORTED_VIDEO_MODEL')
}

export const providerVideoStatus = async (taskId) => {
  if (String(taskId).startsWith('kling_')) {
    const raw = await callProviderWithFallback([
      `/klingai/v1/videos/m2v_omni_video/${taskId}`,
      `/klingai/v1/videos/m2v_omni_video?task_id=${taskId}`,
      `/klingai/v1/videos/m2v_omni_video/status/${taskId}`
    ])

    const videoUrl = extractVideoUrl(raw)
    const status = videoUrl
      ? 'completed'
      : normalizeKlingStatus(raw?.task?.task_status || raw?.task?.status || raw?.status)

    return {
      task_id: taskId,
      status,
      video_url: videoUrl || undefined,
      raw
    }
  }

  const raw = await callProvider(`/v1/videos/${taskId}`, null, 'GET')
  const videoUrl = extractVideoUrl(raw)
  const status = videoUrl ? 'completed' : normalizeSoraStatus(raw?.status)

  return {
    task_id: taskId,
    status,
    video_url: videoUrl || undefined,
    raw
  }
}
