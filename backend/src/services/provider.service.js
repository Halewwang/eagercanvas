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

const RATIO_TO_SIZE = {
  '16:9': '1280x720',
  '9:16': '720x1280',
  '7:4': '1792x1024',
  '4:7': '1024x1792',
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

const IMAGE_BASE_SIZE_BY_RATIO = {
  '1:1': { w: 1024, h: 1024 },
  '3:2': { w: 1152, h: 768 },
  '2:3': { w: 768, h: 1152 },
  '4:3': { w: 1152, h: 864 },
  '3:4': { w: 864, h: 1152 },
  '4:5': { w: 896, h: 1120 },
  '5:4': { w: 1120, h: 896 },
  '16:9': { w: 1280, h: 720 },
  '9:16': { w: 720, h: 1280 },
  '21:9': { w: 1680, h: 720 }
}

const normalizeAspectRatioFromSize = (size = '') => {
  if (!size || typeof size !== 'string' || !size.includes('x')) return ''
  const [w, h] = String(size).split('x').map(Number)
  if (!w || !h) return ''
  const ratio = w / h
  if (Math.abs(ratio - 1) < 0.02) return '1:1'
  if (Math.abs(ratio - 3 / 2) < 0.03) return '3:2'
  if (Math.abs(ratio - 2 / 3) < 0.03) return '2:3'
  if (Math.abs(ratio - 16 / 9) < 0.03) return '16:9'
  if (Math.abs(ratio - 9 / 16) < 0.03) return '9:16'
  if (Math.abs(ratio - 4 / 3) < 0.03) return '4:3'
  if (Math.abs(ratio - 3 / 4) < 0.03) return '3:4'
  if (Math.abs(ratio - 4 / 5) < 0.03) return '4:5'
  if (Math.abs(ratio - 5 / 4) < 0.03) return '5:4'
  if (Math.abs(ratio - 21 / 9) < 0.03) return '21:9'
  return ''
}

const normalizeImageResolution = (value = '') => {
  const safe = String(value || '').trim().toLowerCase()
  if (safe === '1k' || safe === '2k' || safe === '4k') return safe
  return ''
}

const normalizeResolutionFromSize = (size = '', ratio = '') => {
  if (!size || typeof size !== 'string' || !size.includes('x')) return ''
  const [w, h] = String(size).split('x').map(Number)
  if (!w || !h) return ''
  const ratioKey = ratio || normalizeAspectRatioFromSize(size) || '1:1'
  const base = IMAGE_BASE_SIZE_BY_RATIO[ratioKey] || IMAGE_BASE_SIZE_BY_RATIO['1:1']
  const scale = Math.max(w / base.w, h / base.h)
  if (scale >= 3.5) return '4k'
  if (scale >= 1.8) return '2k'
  return '1k'
}

const isEndpointNotFoundError = (error) => {
  const status = Number(error?.status || 0)
  const message = String(error?.message || '').toLowerCase()
  return (
    status === 404 ||
    status === 405 ||
    /not found|no such endpoint|unknown endpoint|unsupported route/.test(message)
  )
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
    data?.videoUrl ||
    data?.video_url ||
    data?.data?.url ||
    data?.data?.videoUrl ||
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
    data?.data?.works?.[0]?.resource?.resource ||
    data?.works?.[0]?.resource?.resource ||
    data?.raw_response?.file?.download_url ||
    data?.outputs?.[0]?.url ||
    data?.outputs?.[0] ||
    data?.data?.outputs?.[0]?.url ||
    data?.data?.outputs?.[0] ||
    ''
  )
}

const normalizeSoraStatus = (value) => {
  const status = String(value || '').toLowerCase()
  if (['created', 'in_processing', 'in_progress', 'processing', 'pending', 'submitted', 'running', 'queued'].includes(status)) return 'processing'
  if (['completed', 'succeeded', 'success', 'done', 'finished'].includes(status)) return 'completed'
  if (['failed', 'error', 'canceled', 'cancelled', 'failure'].includes(status)) return 'failed'
  return status || 'processing'
}

const normalizeErrorMessage = (message = '') => {
  const text = String(message || '').trim()
  if (!text) return ''
  if (/no available models currently/i.test(text)) {
    return 'Veo 3.1 当前在供应商侧无可用资源，请稍后重试或切换到 Kling O1。'
  }
  return text
}

const mapVideoModelName = (model = '') => {
  const lowerModel = String(model || '').trim().toLowerCase()
  if (lowerModel === 'sora2') return 'sora-2'
  if (lowerModel === 'veo-3.1') return 'veo3.1'
  if (lowerModel === 'veo-3.1-pro') return 'veo3.1-pro'
  return String(model || '').trim()
}

const clampToAllowedValue = (value, allowed, fallback) => {
  const numeric = Number(value)
  if (allowed.includes(numeric)) return numeric
  return fallback
}

const normalizeSoraTaskId = (taskId = '') => {
  const safeTaskId = String(taskId || '').trim()
  if (!safeTaskId) return ''
  if (safeTaskId.includes(':')) {
    return safeTaskId.split(':').pop() || ''
  }
  return safeTaskId
}

const buildKlingO1Request = ({ prompt, aspectRatio, duration, firstFrameImage, lastFrameImage, referenceImages }) => {
  const images = []
  if (firstFrameImage) images.push(firstFrameImage)
  if (lastFrameImage) images.push(lastFrameImage)
  if (images.length === 0 && Array.isArray(referenceImages) && referenceImages.length > 0) {
    images.push(...referenceImages.slice(0, 7))
  } else if (images.length > 0 && Array.isArray(referenceImages) && referenceImages.length > 0) {
    images.push(...referenceImages.slice(0, Math.max(0, 7 - images.length)))
  }

  if (images.length === 0) {
    throw new HttpError(400, 'Kling O1 requires at least one input image', 'INVALID_VIDEO_INPUT')
  }

  let o1Type = 'referImage'
  if (images.length >= 2 && firstFrameImage && lastFrameImage) {
    o1Type = 'firstTail'
  }

  const allowedReferImageRatios = new Set(['16:9', '9:16', '1:1'])
  const safeAspectRatio =
    o1Type === 'firstTail'
      ? 'auto'
      : (allowedReferImageRatios.has(String(aspectRatio || '')) ? String(aspectRatio) : '16:9')

  return {
    images,
    prompt,
    duration: Math.max(5, Math.min(10, Number(duration || 5))),
    aspect_ratio: safeAspectRatio,
    o1_type: o1Type
  }
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

const extractSoraStatus = (data = {}) => {
  if (typeof data === 'string' || typeof data === 'number') {
    return normalizeSoraStatus(data)
  }

  return normalizeSoraStatus(
    data?.status ??
    data?.state ??
    data?.task?.status ??
    data?.data?.status ??
    data?.data?.state
  )
}

export const providerChatCompletions = (payload) =>
  callProvider('/v1/chat/completions', payload)

export const providerGenerateImage = async (payload = {}) => {
  const model = String(payload.model_name || payload.model || '').trim()
  const size = String(payload.size || '')
  let prompt = appendSizeHintToPrompt(payload.prompt || '', size)
  
  // Append style to prompt if provided | 如果提供了风格，追加到提示词
  if (payload.style && payload.style !== 'natural') { // 'natural' is default/none
    const styleMap = {
      'vivid': 'Vivid, hyper-realistic, high contrast, 8k resolution',
      'cinematic': 'Cinematic lighting, movie scene, dramatic atmosphere',
      'anime': 'Anime style, japanese animation, cel shaded',
      'digital-art': 'Digital art, trending on artstation, highly detailed'
    }
    const stylePrompt = styleMap[payload.style] || payload.style
    prompt = `${prompt}\n\nStyle: ${stylePrompt}`
  }

  const inputImage = pickFirstImageInput(payload)
  let imageInline = parseDataUrl(inputImage)
  const aspectRatio = String(
    payload.aspect_ratio ||
    payload.ratio ||
    normalizeAspectRatioFromSize(size) ||
    '1:1'
  ).trim()
  const resolution =
    normalizeImageResolution(payload.resolution) ||
    normalizeImageResolution(payload.quality) ||
    normalizeResolutionFromSize(size, aspectRatio) ||
    '1k'

  if (!imageInline && inputImage && /^https?:\/\//i.test(inputImage)) {
    imageInline = await fetchImageAsBase64(inputImage)
  }

  const lowerModel = model.toLowerCase()
  const inputImages = Array.isArray(payload.images)
    ? payload.images.filter(Boolean)
    : (inputImage ? [inputImage] : [])
  const isNanoBananaModel =
    lowerModel.includes('gemini-3.1-flash-image-preview') ||
    lowerModel.includes('gemini-3-pro-image-preview')

  if (isNanoBananaModel) {
    const endpointBase = lowerModel.includes('gemini-3-pro-image-preview')
      ? '/ws/api/v3/google/nano-banana-pro'
      : '/ws/api/v3/google/nano-banana-2'
    const requestBody = {
      prompt,
      aspect_ratio: aspectRatio,
      resolution,
      enable_sync_mode: payload.enable_sync_mode ?? true,
      enable_base64_output: payload.enable_base64_output ?? false
    }
    if (typeof payload.callback === 'string' && payload.callback.trim()) {
      requestBody.callback = payload.callback.trim()
    }
    if (inputImages.length > 0) {
      requestBody.images = inputImages
    }

    try {
      const endpoint = inputImages.length > 0
        ? `${endpointBase}/edit`
        : `${endpointBase}/text-to-image`
      const raw = await callProvider(endpoint, requestBody)
      const normalized = normalizeImageResponse(raw)
      if (Array.isArray(normalized.data) && normalized.data.length > 0) {
        return normalized
      }
    } catch (error) {
      if (!isEndpointNotFoundError(error)) {
        throw error
      }
      // Fallback to legacy Gemini endpoint.
    }
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
  const aspectRatio = payload.aspect_ratio || (typeof payload.size === 'string' && payload.size.includes(':') ? payload.size : undefined) || payload.ratio
  const size = normalizeVideoSize(payload.size) || normalizeVideoSize(aspectRatio)
  const duration = Number(payload.duration || payload.seconds || 5)
  const firstFrameImage = typeof payload.first_frame_image === 'string' ? payload.first_frame_image : ''
  const lastFrameImage = typeof payload.last_frame_image === 'string' ? payload.last_frame_image : ''
  const referenceImages = Array.isArray(payload.images) ? payload.images.filter(Boolean) : []
  const inputImage = pickFirstImageInput(payload)
  const mappedModel = mapVideoModelName(model)

  if (lowerModel.startsWith('sora-2')) {
    const soraSize = normalizeVideoSize(payload.size) || normalizeVideoSize(aspectRatio) || '1280x720'
    const soraSeconds = clampToAllowedValue(payload.seconds || payload.duration, [4, 8, 12], 4)
    const inputReference = firstFrameImage || inputImage || referenceImages[0] || lastFrameImage
    const soraRequest = {
      prompt: effectivePrompt,
      model: mappedModel || 'sora-2',
      seconds: soraSeconds,
      size: soraSize
    }

    if (inputReference) {
      soraRequest.input_reference = inputReference
    }
    if (typeof payload.callback === 'string' && payload.callback.trim()) {
      soraRequest.callback = payload.callback.trim()
    }

    const raw = await callProvider('/openai/v1/videos', soraRequest)

    return {
      task_id: extractTaskId(raw),
      status: extractSoraStatus(raw),
      raw
    }
  }

  if (lowerModel.startsWith('kling-o1')) {
    const klingRequest = buildKlingO1Request({
      prompt: effectivePrompt,
      aspectRatio: aspectRatio || '16:9',
      duration,
      firstFrameImage: firstFrameImage || inputImage,
      lastFrameImage,
      referenceImages
    })

    const raw = await callProviderWithFallback(
      [
        // 302 doc: Image2Video（可灵o1） /klingai/m2v_omni_video
        '/klingai/m2v_omni_video',
        // Universal V2 create as compatibility fallback.
        '/302/v2/video/create'
      ],
      'POST',
      {
        ...(klingRequest || {}),
        model: mappedModel || 'kling-o1'
      }
    )

    return {
      task_id: extractTaskId(raw),
      status: extractKlingStatus(raw),
      raw
    }
  }

  if (lowerModel.startsWith('veo-3.1')) {
    const inputReference = firstFrameImage || inputImage || referenceImages[0] || lastFrameImage
    const requestBody = {
      prompt: effectivePrompt,
      aspect_ratio: aspectRatio || '16:9',
      duration: clampToAllowedValue(duration, [4, 6, 8], 8),
      resolution: String(payload.resolution || '1080p').toLowerCase() === '720p' ? '720p' : '1080p',
      generate_audio: payload.generate_audio ?? false,
      model: mappedModel || 'veo3.1',
      seed: Number.isInteger(payload.seed) ? payload.seed : -1,
      negative_prompt: typeof payload.negative_prompt === 'string' && payload.negative_prompt.trim()
        ? payload.negative_prompt.trim()
        : undefined,
      callback: typeof payload.callback === 'string' && payload.callback.trim()
        ? payload.callback.trim()
        : undefined
    }

    if (inputReference) {
      requestBody.image = inputReference
    }

    let raw
    try {
      const endpoint = inputReference
        ? '/ws/api/v3/google/veo3.1/image-to-video'
        : '/ws/api/v3/google/veo3.1/text-to-video'
      raw = await callProvider(endpoint, requestBody)
    } catch (error) {
      if (isEndpointNotFoundError(error)) {
        try {
          raw = await callProviderWithFallback(
            [
              '/302/submit/veo3-v2',
              '/302/v2/video/create'
            ],
            'POST',
            {
              prompt: effectivePrompt,
              model: mappedModel || 'veo3.1',
              enhance_prompt: payload.enhance_prompt ?? true,
              aspect_ratio: aspectRatio || '16:9',
              duration: clampToAllowedValue(duration, [4, 6, 8], 8),
              images: inputReference ? [inputReference] : undefined
            }
          )
        } catch (fallbackError) {
          const normalized = normalizeErrorMessage(fallbackError?.message)
          if (normalized && normalized !== fallbackError?.message) {
            throw new HttpError(503, normalized, 'MODEL_TEMPORARILY_UNAVAILABLE')
          }
          throw fallbackError
        }
      } else {
        const normalized = normalizeErrorMessage(error?.message)
        if (normalized && normalized !== error?.message) {
          throw new HttpError(503, normalized, 'MODEL_TEMPORARILY_UNAVAILABLE')
        }
        throw error
      }
    }

    return {
      task_id: extractTaskId(raw),
      status: extractSoraStatus(raw),
      raw
    }
  }

  // Generic 302 video V2 path for other models.
  const genericImages = [firstFrameImage, ...referenceImages].filter(Boolean)
  const genericBody = {
    prompt: effectivePrompt,
    model: mappedModel || model,
    duration: duration || undefined,
    aspect_ratio: aspectRatio || undefined,
    resolution: payload.resolution || (size && size.includes('x') ? size : undefined)
  }
  if (genericImages.length > 0) genericBody.image = genericImages
  if (lastFrameImage) genericBody.end_image = lastFrameImage
  if (typeof payload.negative_prompt === 'string' && payload.negative_prompt.trim()) {
    genericBody.negative_prompt = payload.negative_prompt.trim()
  }

  const genericRaw = await callProviderWithFallback(
    ['/302/v2/video/create'],
    'POST',
    genericBody
  )

  return {
    task_id: extractTaskId(genericRaw),
    status: extractSoraStatus(genericRaw?.status || genericRaw?.data?.status || genericRaw?.task_status),
    raw: genericRaw
  }
}

export const providerVideoStatus = async (taskId) => {
  const safeTaskId = String(taskId || '')
  const normalizedSoraTaskId = normalizeSoraTaskId(taskId)
  const mayBeKling = safeTaskId.startsWith('kling_') || safeTaskId.startsWith('task_')
  const mayBeSora = normalizedSoraTaskId.startsWith('video_')
  const mayBeWaveSpeed = /^[0-9a-f]{32}$/i.test(safeTaskId)
  
  // 302.AI Kling status endpoints
  const klingStatusPaths = [
    `/klingai/task/${taskId}/fetch`,
    `/klingai/v1/videos/image2video/${taskId}`,
    `/kling/v1/videos/text2video/${taskId}`,
    `/kling/v1/videos/image2video/${taskId}`
  ]
  
  // Veo uses UUIDs usually, so if not kling, try Veo paths
  const veoStatusPaths = [
    `/ws/api/v3/predictions/${taskId}/result`,
    `/302/submit/veo3-v2/${taskId}`,
    `/302/v2/video/fetch/${taskId}`,
    `/v2/video/generations?generation_id=${taskId}`,
    `/video/generations?generation_id=${taskId}`
  ]

  if (mayBeSora) {
    try {
      const raw = await callProvider(`/openai/v1/videos/${normalizedSoraTaskId}`, null, 'GET')
      let status = extractSoraStatus(raw)
      let videoUrl = extractVideoUrl(raw)

      if (status === 'completed' && !videoUrl) {
        try {
          const content = await callProvider(`/openai/v1/videos/${normalizedSoraTaskId}/content?variant=video`, null, 'GET')
          videoUrl = extractVideoUrl(content)
          if (content && typeof raw === 'object' && raw !== null) {
            raw.content = content
          }
        } catch {
          // Content may not be ready immediately after status flips to completed.
        }
      }

      return {
        task_id: taskId,
        status: videoUrl ? 'completed' : (status === 'completed' ? 'processing' : status),
        video_url: videoUrl || undefined,
        raw
      }
    } catch {
      // Fall through
    }
  }

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

  if (mayBeWaveSpeed) {
    try {
      const raw = await callProviderWithFallback(veoStatusPaths, 'GET')
      const status = extractSoraStatus(raw)
      const videoUrl = extractVideoUrl(raw)

      return {
        task_id: taskId,
        status: videoUrl ? 'completed' : status,
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
    const status = extractSoraStatus(raw.status || raw.data?.status || raw.task_status)
    const videoUrl = extractVideoUrl(raw)

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
