import { env } from '../config/env.js'
import { HttpError } from '../utils/http.js'

const parseProviderBases = () => {
  const rawList = String(env.providerApiBaseUrls || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

  const list = rawList.length > 0 ? rawList : [String(env.providerApiBaseUrl || '').trim()]
  return [...new Set(list.filter(Boolean))]
}

const providerBases = parseProviderBases()

const buildProviderUrl = (baseUrl, path) => {
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

const callProviderWithBase = async (base, path, body, method = 'POST') => {
  const controller = new AbortController()
  const timeoutMs = Number(env.providerTimeoutMs || 90000)
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(buildProviderUrl(base, path), {
      method,
      headers: buildHeaders(),
      body: method === 'GET' ? undefined : JSON.stringify(body),
      signal: controller.signal
    })
    const data = await parseProviderResponse(response)

    if (!response.ok) {
      const message = data?.error?.message || data?.message || `Provider request failed: ${response.status}`
      throw new HttpError(response.status, message, 'PROVIDER_ERROR')
    }

    return data || {}
  } finally {
    clearTimeout(timer)
  }
}

const callProvider = async (path, body, method = 'POST') => {
  if (!providerBases.length) {
    throw new HttpError(500, 'PROVIDER_API_BASE_URL is not configured', 'PROVIDER_NOT_CONFIGURED')
  }

  let lastError
  for (const base of providerBases) {
    try {
      return await callProviderWithBase(base, path, body, method)
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

const callProviderWithFallback = async (paths, method = 'GET', body = null) => {
  let lastError
  for (const path of paths) {
    try {
      return await callProvider(path, body, method)
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

const fetchImageAsBase64 = async (url) => {
  try {
    const response = await fetch(url)
    if (!response.ok) return null
    const buffer = await response.arrayBuffer()
    const mime = response.headers.get('content-type') || 'image/png'
    return {
      mimeType: mime,
      data: Buffer.from(buffer).toString('base64')
    }
  } catch (e) {
    console.error('Fetch image failed', e)
    return null
  }
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
  const urls = []
  const pushUrl = (value, mime = 'image/png') => {
    if (!value) return
    const str = String(value).trim()
    if (!str) return
    if (/^https?:\/\//i.test(str) || /^data:image\//i.test(str)) {
      urls.push(str)
      return
    }
    // Base64 payload without prefix.
    if (/^[A-Za-z0-9+/=\s]+$/.test(str) && str.length > 120) {
      urls.push(`data:${mime};base64,${str.replace(/\s+/g, '')}`)
    }
  }

  const candidates = Array.isArray(response?.candidates) ? response.candidates : []

  for (const candidate of candidates) {
    const parts = candidate?.content?.parts || []
    for (const part of parts) {
      const inlineData = part?.inline_data || part?.inlineData
      if (inlineData?.data) {
        const mime = inlineData.mime_type || inlineData.mimeType || 'image/png'
        pushUrl(inlineData.data, mime)
      }
      const fileData = part?.file_data || part?.fileData
      if (fileData?.file_uri || fileData?.fileUri || fileData?.url) {
        pushUrl(fileData.file_uri || fileData.fileUri || fileData.url)
      }
    }
  }

  // OpenAI-compatible and other common result shapes.
  const listCandidates = [
    ...(Array.isArray(response?.data) ? response.data : []),
    ...(Array.isArray(response?.images) ? response.images : []),
    ...(Array.isArray(response?.output) ? response.output : []),
    ...(Array.isArray(response?.result?.images) ? response.result.images : []),
    ...(Array.isArray(response?.task_result?.images) ? response.task_result.images : [])
  ]

  for (const item of listCandidates) {
    if (typeof item === 'string') {
      pushUrl(item)
      continue
    }
    pushUrl(item?.url || item?.image_url || item?.imageUrl || item?.file_uri || item?.fileUri)
    pushUrl(item?.b64_json || item?.base64 || item?.image_base64, item?.mime_type || item?.mimeType || 'image/png')
  }

  pushUrl(response?.url || response?.image_url || response?.imageUrl)
  pushUrl(response?.b64_json || response?.base64 || response?.image_base64)

  return {
    data: [...new Set(urls)].map((url) => ({ url })),
    raw: response
  }
}

const normalizeKlingStatus = (value) => {
  if (typeof value === 'number') {
    // Kling O1: 10 processing, 50 failed, 99 success
    if (value === 99) return 'completed'
    if (value === 50) return 'failed'
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
    data?.data?.url ||
    data?.data?.video_url ||
    data?.video?.url ||
    data?.videos?.[0]?.url ||
    data?.data?.videos?.[0]?.url ||
    data?.output?.[0]?.url ||
    data?.data?.output?.[0]?.url ||
    data?.task?.task_result?.videos?.[0]?.url ||
    data?.task?.task_result?.video_url ||
    data?.task_result?.videos?.[0]?.url ||
    data?.task_result?.video_url ||
    data?.data?.task_result?.videos?.[0]?.url ||
    data?.data?.task_result?.video_url ||
    data?.outputs?.[0] ||
    data?.data?.outputs?.[0] ||
    ''
  )
}

const normalizeSoraStatus = (value) => {
  const status = String(value || '').toLowerCase()
  if (['completed', 'succeeded', 'success', 'done', 'finished'].includes(status)) return 'completed'
  if (['failed', 'error', 'canceled', 'cancelled'].includes(status)) return 'failed'
  return status || 'processing'
}

const extractTaskId = (data = {}) => {
  const candidates = [
    data?.task_id,
    data?.taskId,
    data?.id,
    data?.task?.task_id,
    data?.task?.id,
    data?.data?.task_id,
    data?.data?.taskId,
    data?.data?.id,
    data?.data?.task?.task_id,
    data?.data?.task?.id,
    data?.output?.task_id,
    data?.output?.id
  ]

  const found = candidates.find((value) => value !== undefined && value !== null && String(value).trim() !== '')
  return found ? String(found) : ''
}

const extractKlingStatus = (data = {}) =>
  normalizeKlingStatus(
    data?.task?.task_status ??
    data?.task?.status ??
    data?.status ??
    data?.data?.task?.task_status ??
    data?.data?.task?.status ??
    data?.data?.status
  )

const extractSoraStatus = (data = {}) =>
  normalizeSoraStatus(
    data?.status ??
    data?.state ??
    data?.task?.status ??
    data?.data?.status ??
    data?.data?.state
  )

export const providerChatCompletions = (payload) =>
  callProvider('/v1/chat/completions', payload)

export const providerGenerateImage = async (payload = {}) => {
  const model = String(payload.model_name || payload.model || '').trim()
  const size = String(payload.size || '')
  const prompt = appendSizeHintToPrompt(payload.prompt || '', size)
  const inputImage = pickFirstImageInput(payload)
  let imageInline = parseDataUrl(inputImage)

  if (!imageInline && inputImage && /^https?:\/\//i.test(inputImage)) {
    imageInline = await fetchImageAsBase64(inputImage)
  }

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
  const normalized = normalizeImageResponse(raw)
  if (!Array.isArray(normalized.data) || normalized.data.length === 0) {
    throw new HttpError(502, 'No image output from provider', 'NO_IMAGE_OUTPUT')
  }
  return normalized
}

export const providerCreateVideo = async (payload = {}) => {
  const model = String(payload.model_name || payload.model || '').trim()
  const lowerModel = model.toLowerCase()
  const prompt = String(payload.prompt || '').trim()
  const effectivePrompt = prompt || 'Generate a smooth, cinematic video based on the provided inputs.'
  const aspectRatio = payload.aspect_ratio || (typeof payload.size === 'string' && payload.size.includes(':') ? payload.size : undefined)
  const size = normalizeVideoSize(payload.size) || normalizeVideoSize(aspectRatio)
  const duration = Number(payload.duration || payload.seconds || 5)
  const firstFrameImage = typeof payload.first_frame_image === 'string' ? payload.first_frame_image : ''
  const lastFrameImage = typeof payload.last_frame_image === 'string' ? payload.last_frame_image : ''
  const referenceImages = Array.isArray(payload.images) ? payload.images.filter(Boolean) : []
  const inputImage = pickFirstImageInput(payload)

  if (lowerModel.startsWith('kling-o1')) {
    const images = []
    if (firstFrameImage) images.push(firstFrameImage)
    if (lastFrameImage) images.push(lastFrameImage)
    if (images.length === 0 && referenceImages.length > 0) {
      images.push(...referenceImages.slice(0, 4))
    } else if (images.length > 0 && referenceImages.length > 0) {
      // Keep first/last priority and fill up remaining slots from reference images.
      images.push(...referenceImages.slice(0, Math.max(0, 4 - images.length)))
    }
    if (images.length === 0 && inputImage) images.push(inputImage)

    const isImageToVideo = images.length > 0

    const requestBody = {
      model_name: 'kling-v1', // Standard 302.AI model name
      prompt: effectivePrompt,
      duration: duration || 5,
      aspect_ratio: aspectRatio || '16:9'
    }

    let endpoint = '/kling/v1/videos/text2video'

    if (isImageToVideo) {
        endpoint = '/kling/v1/videos/image2video'
        requestBody.image = images[0] // Standard 302.AI expects 'image'
        requestBody.image_tail = images[1] || undefined // Optional tail image
    }

    // Determine correct endpoint based on API provider base
    const raw = await callProviderWithFallback(
      [
        endpoint,
        `/v1${endpoint}`
      ],
      'POST',
      requestBody
    )

    return {
      task_id: extractTaskId(raw),
      status: extractKlingStatus(raw),
      raw
    }
  }

  if (lowerModel.startsWith('veo-3.1')) {
    let specificModel = 'google/veo-3.1-t2v-fast'
    const requestBody = {
      prompt: effectivePrompt,
      aspect_ratio: aspectRatio || '16:9',
      duration: duration || 8,
      resolution: '1080p',
      generate_audio: true
    }

    // Determine specific model and parameters based on input images
    if (firstFrameImage && lastFrameImage) {
      specificModel = 'google/veo-3.1-first-last-image-to-video'
      requestBody.image_url = firstFrameImage
      requestBody.last_image_url = lastFrameImage
    } else if (firstFrameImage || inputImage) {
      specificModel = 'google/veo-3.1-i2v'
      requestBody.image_url = firstFrameImage || inputImage
    }

    requestBody.model = specificModel

    const raw = await callProviderWithFallback(
      [
        '/v2/video/generations',
        '/video/generations'
      ],
      'POST',
      requestBody
    )

    return {
      task_id: raw.id,
      status: raw.status,
      raw
    }
  }

  throw new HttpError(400, `Unsupported video model: ${model}`, 'UNSUPPORTED_VIDEO_MODEL')
}

export const providerVideoStatus = async (taskId) => {
  const safeTaskId = String(taskId || '')
  const mayBeKling = safeTaskId.startsWith('kling_') || safeTaskId.startsWith('task_')
  
  // 302.AI Kling status endpoints
  const klingStatusPaths = [
    `/kling/v1/videos/text2video/${taskId}`,
    `/kling/v1/videos/image2video/${taskId}`,
    `/v1/kling/v1/videos/text2video/${taskId}`,
    `/v1/kling/v1/videos/image2video/${taskId}`
  ]
  
  // Veo uses UUIDs usually, so if not kling, try Veo paths
  const veoStatusPaths = [
    `/v2/video/generations?generation_id=${taskId}`,
    `/video/generations?generation_id=${taskId}`
  ]

  if (mayBeKling) {
    try {
      const raw = await callProviderWithFallback(klingStatusPaths)

      const videoUrl = extractVideoUrl(raw)
      const status = videoUrl
        ? 'completed'
        : extractKlingStatus(raw)

      return {
        task_id: taskId,
        status,
        video_url: videoUrl || undefined,
        raw
      }
    } catch {
      // Fall through
    }
  }

  // Try Veo / Generic Video Generation API
  try {
    const raw = await callProviderWithFallback(veoStatusPaths, 'GET')
    const status = raw.status
    const videoUrl = raw.video?.url || raw.output?.url

    return {
      task_id: taskId,
      status,
      video_url: videoUrl || undefined,
      raw
    }
  } catch (error) {
    throw new HttpError(502, 'Failed to get video status', 'PROVIDER_ERROR')
  }
}
