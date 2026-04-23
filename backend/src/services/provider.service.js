import { env } from '../config/env.js'
import { HttpError } from '../utils/http.js'
import sharp from 'sharp'
import { attachProviderResponseMetadata } from './provider-response-metadata.js'
import { buildGptImage2RequestBody } from './gpt-image-2-size.js'

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
  const timeoutMs = Number(env.providerTimeoutMs || 90000)
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
  const timeoutMs = Number(env.providerTimeoutMs || 90000)
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

const callProvider = async (path, body, method = 'POST', requestOptions = {}) => {
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

const callProviderMultipart = async (path, formData, method = 'POST', requestOptions = {}) => {
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

const callProviderWithFallback = async (paths, method = 'GET', body = null, requestOptions = {}) => {
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

const appendAspectRatioHintToPrompt = (prompt = '', aspectRatio = '') => {
  const safePrompt = String(prompt || '').trim()
  const safeAspectRatio = String(aspectRatio || '').trim()
  if (!safeAspectRatio) return safePrompt
  if (!safePrompt) return `Generate an image with aspect ratio ${safeAspectRatio}.`

  return `${safePrompt}\n\nAspect ratio: ${safeAspectRatio}.`
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

const fetchBinaryFromSource = async (source = '') => {
  const value = String(source || '').trim()
  if (!value) {
    throw new HttpError(400, 'Image source is required', 'IMAGE_SOURCE_REQUIRED')
  }

  const dataUrl = parseDataUrl(value)
  if (dataUrl) {
    return {
      mimeType: dataUrl.mimeType || 'image/png',
      buffer: Buffer.from(dataUrl.data, 'base64')
    }
  }

  try {
    const response = await fetch(value)
    if (!response.ok) {
      throw new HttpError(response.status, `Failed to fetch source image: ${response.status}`, 'IMAGE_FETCH_FAILED')
    }
    const mimeType = response.headers.get('content-type') || 'image/png'
    const arrayBuffer = await response.arrayBuffer()
    return {
      mimeType,
      buffer: Buffer.from(arrayBuffer)
    }
  } catch (error) {
    if (error instanceof HttpError) throw error
    throw new HttpError(400, 'Failed to load source image', 'IMAGE_FETCH_FAILED')
  }
}

const extensionFromMimeType = (mimeType = '') => {
  const safe = String(mimeType || '').toLowerCase()
  if (safe.includes('png')) return 'png'
  if (safe.includes('webp')) return 'webp'
  if (safe.includes('gif')) return 'gif'
  return 'jpg'
}

const buildGeminiImageInputParts = async (images = []) => {
  const parts = []

  for (const image of images) {
    const value = String(image || '').trim()
    if (!value) continue

    const inline = parseDataUrl(value)
    if (inline?.data) {
      parts.push({
        inline_data: {
          mime_type: inline.mimeType,
          data: inline.data
        }
      })
      continue
    }

    if (/^https?:\/\//i.test(value)) {
      const fetched = await fetchImageAsBase64(value)
      if (fetched?.data) {
        parts.push({
          inline_data: {
            mime_type: fetched.mimeType,
            data: fetched.data
          }
        })
        continue
      }

      parts.push({
        image_url: value
      })
      continue
    }
  }

  return parts
}

const appendGptImage2MultipartImages = async (formData, images = []) => {
  for (let index = 0; index < images.length; index += 1) {
    const source = String(images[index] || '').trim()
    if (!source) continue

    const { mimeType, buffer } = await fetchBinaryFromSource(source)
    const fileName = `image-${index + 1}.${extensionFromMimeType(mimeType)}`
    const blob = new Blob([buffer], { type: mimeType || 'image/png' })
    formData.append('image', blob, fileName)
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
      if (part?.url || part?.image_url || part?.imageUrl) {
        pushUrl(part?.url || part?.image_url || part?.imageUrl)
      }
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
    ...(Array.isArray(response?.data?.outputs) ? response.data.outputs : []),
    ...(Array.isArray(response?.data?.images) ? response.data.images : []),
    ...(Array.isArray(response?.data?.data) ? response.data.data : []),
    ...(Array.isArray(response?.images) ? response.images : []),
    ...(Array.isArray(response?.output) ? response.output : []),
    ...(Array.isArray(response?.result?.images) ? response.result.images : []),
    ...(Array.isArray(response?.task_result?.images) ? response.task_result.images : []),
    ...(Array.isArray(response?.outputs) ? response.outputs : [])
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
  pushUrl(response?.data?.url || response?.data?.image_url || response?.data?.imageUrl)
  pushUrl(response?.output)
  pushUrl(response?.data?.output)
  pushUrl(response?.b64_json || response?.base64 || response?.image_base64)
  pushUrl(response?.data?.b64_json || response?.data?.base64 || response?.data?.image_base64)

  return {
    data: [...new Set(urls)].map((url) => ({ url })),
    raw: response
  }
}

const extractPredictionMeta = (response = {}) => {
  const data = response?.data && typeof response.data === 'object' ? response.data : response
  return {
    id: String(data?.id || response?.id || '').trim(),
    status: String(data?.status || response?.status || '').trim().toLowerCase(),
    error: String(data?.error || response?.error || '').trim(),
    resultUrl: String(
      data?.urls?.get ||
      response?.urls?.get ||
      ''
    ).trim()
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const pollPredictionResult = async (requestId, attempts = 20, intervalMs = 3000, requestOptions = {}) => {
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

    if (!['created', 'queued', 'pending', 'processing', 'running', 'in_progress'].includes(meta.status)) {
      return current
    }

    if (index < attempts - 1) {
      await sleep(intervalMs)
    }
  }

  return lastResponse
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
    data?.content?.videoUrl ||
    data?.content?.video_url ||
    data?.download?.url ||
    data?.data?.url ||
    data?.data?.videoUrl ||
    data?.data?.video_url ||
    data?.data?.content?.videoUrl ||
    data?.data?.content?.video_url ||
    data?.data?.download?.url ||
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
  if (lowerModel === 'kling-o3') return 'kling-o3'
  if (lowerModel === 'veo-3.1') return 'veo3.1'
  if (lowerModel === 'veo-3.1-pro') return 'veo3.1-pro'
  if (lowerModel === 'seedance-2.0') return 'doubao-seedance-2-0-260128'
  if (lowerModel === 'seedance-2.0-fast') return 'doubao-seedance-2-0-fast-260128'
  return String(model || '').trim()
}

const isSeedanceModel = (model = '') => {
  const lowerModel = String(model || '').trim().toLowerCase()
  return lowerModel.startsWith('seedance-2.0') || lowerModel.startsWith('doubao-seedance-2-0')
}

const clampToAllowedValue = (value, allowed, fallback) => {
  const numeric = Number(value)
  if (allowed.includes(numeric)) return numeric
  return fallback
}

const normalizeStringList = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean)
  }
  if (typeof value === 'string' && value.trim()) {
    return [value.trim()]
  }
  return []
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

const buildKlingO3Request = ({
  prompt,
  aspectRatio,
  duration,
  firstFrameImage,
  lastFrameImage,
  referenceImages,
  mode,
  generateAudio,
  o1Type
}) => {
  const allowedTypes = new Set(['referImage', 'firstTail'])
  const requestedType = String(o1Type || '').trim()
  const resolvedType = allowedTypes.has(requestedType)
    ? requestedType
    : (firstFrameImage && lastFrameImage ? 'firstTail' : 'referImage')

  if (resolvedType === 'firstTail' && (!firstFrameImage || !lastFrameImage)) {
    throw new HttpError(400, 'Kling O3 firstTail requires both first and last frame images', 'INVALID_VIDEO_INPUT')
  }

  const images = []
  if (resolvedType === 'firstTail') {
    images.push(firstFrameImage, lastFrameImage)
  } else {
    if (firstFrameImage) images.push(firstFrameImage)
    if (lastFrameImage) images.push(lastFrameImage)
    if (Array.isArray(referenceImages) && referenceImages.length > 0) {
      images.push(...referenceImages.slice(0, Math.max(0, 7 - images.length)))
    }
  }

  const normalizedImages = images.filter(Boolean).slice(0, 7)
  if (normalizedImages.length === 0) {
    throw new HttpError(400, 'Kling O3 requires at least one input image', 'INVALID_VIDEO_INPUT')
  }

  const allowedReferImageRatios = new Set(['16:9', '9:16', '1:1'])
  const safeAspectRatio =
    resolvedType === 'firstTail'
      ? 'auto'
      : (allowedReferImageRatios.has(String(aspectRatio || '')) ? String(aspectRatio) : '16:9')

  return {
    images: normalizedImages,
    prompt,
    duration: Math.max(3, Math.min(10, Number(duration || 5))),
    aspect_ratio: safeAspectRatio,
    mode: String(mode || '').trim().toLowerCase() === 'std' ? 'std' : 'pro',
    o1_type: resolvedType,
    enable_audio: Boolean(generateAudio)
  }
}

const buildSeedanceRequest = ({
  prompt,
  aspectRatio,
  duration,
  resolution,
  firstFrameImage,
  lastFrameImage,
  referenceImages,
  referenceVideos,
  referenceAudios,
  generateAudio,
  watermark,
  callbackUrl,
  returnLastFrame,
  serviceTier,
  executionExpiresAfter,
  tools,
  safetyIdentifier,
  seed,
  contentItems
}) => {
  const safePrompt = String(prompt || '').trim()
  const normalizedResolution = String(resolution || '').trim().toLowerCase()
  const safeResolution = ['480p', '720p'].includes(normalizedResolution) ? normalizedResolution : '720p'
  const normalizedRatio = String(aspectRatio || '').trim()
  const safeRatio = ['adaptive', '21:9', '16:9', '4:3', '1:1', '3:4', '9:16'].includes(normalizedRatio)
    ? normalizedRatio
    : 'adaptive'
  const numericDuration = Number(duration)
  const safeDuration = numericDuration === -1
    ? -1
    : Math.max(4, Math.min(15, Number.isFinite(numericDuration) ? Math.round(numericDuration) : 5))
  const safeSeed = Number(seed)
  const providedContent = Array.isArray(contentItems) ? contentItems : []
  const content = []

  const pushMediaItem = (type, value, role) => {
    const url = String(value || '').trim()
    if (!url) return
    const fieldName = type === 'image_url' ? 'image_url' : type === 'video_url' ? 'video_url' : 'audio_url'
    const item = {
      type,
      [fieldName]: { url }
    }
    if (role) item.role = role
    content.push(item)
  }

  for (const item of providedContent) {
    if (!item || typeof item !== 'object') continue
    const type = String(item.type || '').trim()
    if (type === 'text') {
      const text = String(item.text || '').trim()
      if (text) content.push({ type: 'text', text })
      continue
    }
    if (type === 'image_url') {
      pushMediaItem('image_url', item.image_url?.url || item.url, item.role)
      continue
    }
    if (type === 'video_url') {
      pushMediaItem('video_url', item.video_url?.url || item.url, item.role)
      continue
    }
    if (type === 'audio_url') {
      pushMediaItem('audio_url', item.audio_url?.url || item.url, item.role)
    }
  }

  if (content.length === 0) {
    if (safePrompt) content.push({ type: 'text', text: safePrompt })
    pushMediaItem('image_url', firstFrameImage, undefined)
    pushMediaItem('image_url', lastFrameImage, undefined)
    referenceImages.forEach((value) => pushMediaItem('image_url', value, 'reference_image'))
    referenceVideos.forEach((value) => pushMediaItem('video_url', value, 'reference_video'))
    referenceAudios.forEach((value) => pushMediaItem('audio_url', value, 'reference_audio'))
  }

  if (content.length === 0) {
    throw new HttpError(400, 'Seedance 2.0 requires at least one text or media input', 'INVALID_VIDEO_INPUT')
  }

  const requestBody = {
    content,
    generate_audio: generateAudio ?? true,
    ratio: safeRatio,
    duration: safeDuration,
    watermark: typeof watermark === 'boolean' ? watermark : false,
    resolution: safeResolution
  }

  const safeCallbackUrl = String(callbackUrl || '').trim()
  if (safeCallbackUrl) requestBody.callback_url = safeCallbackUrl
  if (typeof returnLastFrame === 'boolean') requestBody.return_last_frame = returnLastFrame
  if (typeof serviceTier === 'string' && serviceTier.trim()) requestBody.service_tier = serviceTier.trim()
  if (Number.isFinite(Number(executionExpiresAfter))) requestBody.execution_expires_after = Number(executionExpiresAfter)
  if (tools && typeof tools === 'object' && !Array.isArray(tools)) requestBody.tools = tools
  if (typeof safetyIdentifier === 'string' && safetyIdentifier.trim()) requestBody.safety_identifier = safetyIdentifier.trim()
  if (Number.isInteger(safeSeed) && safeSeed >= -1) requestBody.seed = safeSeed

  return requestBody
}

const createSeedanceVideo = async (model, requestBody, requestOptions = {}) => {
  return callProvider(
    '/volcengine/api/v3/contents/generations/tasks',
    {
      ...requestBody,
      model: mapVideoModelName(model)
    },
    'POST',
    requestOptions
  )
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

export const providerChatCompletions = (payload, requestOptions = {}) =>
  callProvider('/v1/chat/completions', payload, 'POST', requestOptions)

export const providerGenerateImage = async (payload = {}, requestOptions = {}) => {
  const model = String(payload.model_name || payload.model || '').trim()
  const size = String(payload.size || '')
  const aspectRatio = String(
    payload.aspect_ratio ||
    payload.ratio ||
    normalizeAspectRatioFromSize(size) ||
    '1:1'
  ).trim()
  let prompt = String(payload.prompt || '').trim()
  
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

  const lowerModel = model.toLowerCase()
  const inputImages = Array.isArray(payload.images)
    ? payload.images.filter(Boolean)
    : []
  const firstImage = pickFirstImageInput(payload)
  if (!inputImages.length && firstImage) {
    inputImages.push(firstImage)
  }
  const resolution =
    normalizeImageResolution(payload.resolution) ||
    normalizeImageResolution(payload.quality) ||
    normalizeResolutionFromSize(size, aspectRatio) ||
    '1k'
  const isGeminiImagePreviewModel =
    lowerModel.includes('gemini-3.1-flash-image-preview') ||
    lowerModel.includes('gemini-3-pro-image-preview')
  if (lowerModel === 'gpt-image-2') {
    const body = buildGptImage2RequestBody({
      ...payload,
      prompt,
      ratio: payload.ratio || payload.aspect_ratio || aspectRatio,
      size: payload.size
    })

    if (inputImages.length > 0) {
      const formData = new FormData()
      for (const [key, value] of Object.entries(body)) {
        if (value !== undefined && value !== null && String(value).trim() !== '') {
          formData.append(key, String(value))
        }
      }
      await appendGptImage2MultipartImages(formData, inputImages.slice(0, 16))
      const raw = await callProviderMultipart('/v1/images/edits', formData, 'POST', requestOptions)
      const normalized = normalizeImageResponse(raw)
      if (!Array.isArray(normalized.data) || normalized.data.length === 0) {
        throw new HttpError(502, 'No image output from provider', 'NO_IMAGE_OUTPUT')
      }
      return normalized
    }

    const raw = await callProvider('/v1/images/generations?async=false', body, 'POST', requestOptions)
    const normalized = normalizeImageResponse(raw)
    if (!Array.isArray(normalized.data) || normalized.data.length === 0) {
      throw new HttpError(502, 'No image output from provider', 'NO_IMAGE_OUTPUT')
    }
    return normalized
  }

  if (isGeminiImagePreviewModel) {
    const endpointBase = lowerModel.includes('gemini-3-pro-image-preview')
      ? '/ws/api/v3/google/nano-banana-pro'
      : '/ws/api/v3/google/nano-banana-2'
    const syncMode = payload.enable_sync_mode ?? true
    const body = {
      prompt,
      aspect_ratio: aspectRatio,
      resolution,
      enable_sync_mode: syncMode,
      enable_base64_output: payload.enable_base64_output ?? false
    }
    if (typeof payload.callback === 'string' && payload.callback.trim()) {
      body.callback = payload.callback.trim()
    }
    if (inputImages.length > 0) {
      body.images = inputImages
    }
    if (payload.tools && typeof payload.tools === 'object' && !Array.isArray(payload.tools)) {
      body.tools = payload.tools
    }
    const endpoint = inputImages.length > 0
      ? `${endpointBase}/edit`
      : `${endpointBase}/text-to-image`
    let raw = await callProvider(endpoint, body, 'POST', requestOptions)
    let normalized = normalizeImageResponse(raw)
    if (!Array.isArray(normalized.data) || normalized.data.length === 0) {
      const prediction = extractPredictionMeta(raw)
      if (prediction.id && ['created', 'queued', 'pending', 'processing', 'running', 'in_progress'].includes(prediction.status)) {
        if (!syncMode) {
          return {
            task_id: prediction.id,
            status: prediction.status,
            raw
          }
        }

        raw = await pollPredictionResult(prediction.id, 20, 3000, requestOptions)
        normalized = normalizeImageResponse(raw)
      }
    }
    if (!Array.isArray(normalized.data) || normalized.data.length === 0) {
      throw new HttpError(502, 'No image output from provider', 'NO_IMAGE_OUTPUT')
    }
    return normalized
  }

  const raw = await callProvider('/v1/images/generations', payload, 'POST', requestOptions)
  const normalized = normalizeImageResponse(raw)
  if (!Array.isArray(normalized.data) || normalized.data.length === 0) {
    throw new HttpError(502, 'No image output from provider', 'NO_IMAGE_OUTPUT')
  }
  return normalized
}

export const providerImageStatus = async (taskId, requestOptions = {}) => {
  const safeTaskId = String(taskId || '').trim()
  if (!safeTaskId) {
    throw new HttpError(400, 'Image task id is required', 'IMAGE_TASK_ID_REQUIRED')
  }

  const raw = await callProvider(`/ws/api/v3/predictions/${safeTaskId}/result`, null, 'GET', requestOptions)
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

export const providerRemoveBackground = async (payload = {}) => {
  const source =
    String(payload.image || '').trim() ||
    String(payload.image_url || '').trim() ||
    String(payload.url || '').trim()

  if (!source) {
    throw new HttpError(400, 'Image source is required', 'IMAGE_SOURCE_REQUIRED')
  }

  const { mimeType, buffer } = await fetchBinaryFromSource(source)
  const fileName = `remove-bg.${extensionFromMimeType(mimeType)}`
  const formData = new FormData()
  const blob = new Blob([buffer], { type: mimeType || 'image/png' })

  formData.append('image_file', blob, fileName)
  formData.append('format', String(payload.format || 'png'))
  formData.append('channels', String(payload.channels || 'rgba'))
  formData.append('size', String(payload.size || 'full'))
  formData.append('crop', payload.crop ? 'true' : 'false')
  formData.append('despill', payload.despill ? 'true' : 'false')

  if (typeof payload.bg_color === 'string' && payload.bg_color.trim()) {
    formData.append('bg_color', payload.bg_color.trim())
  }

  const raw = await callProviderMultipart('/photoroom/v1/segment?response_format=url', formData)
  const url = String(raw?.url || raw?.data?.url || '').trim()

  if (!url) {
    throw new HttpError(502, 'No image output from provider', 'NO_IMAGE_OUTPUT')
  }

  return {
    url,
    data: [{ url }],
    raw
  }
}

export const providerCreateVideo = async (payload = {}, requestOptions = {}) => {
  const tool = String(payload.tool || payload.operation || '').trim().toLowerCase()

  if (tool === 'enhance') {
    const source =
      String(payload.file || '').trim() ||
      String(payload.source_url || '').trim() ||
      String(payload.video_url || '').trim() ||
      String(payload.url || '').trim()

    if (!source) {
      throw new HttpError(400, 'Video source is required', 'VIDEO_SOURCE_REQUIRED')
    }

    const rawOutput = typeof payload.output === 'object' && payload.output ? payload.output : {}
    const normalizedFrameRate = Number(rawOutput.frameRate)
    const output = {
      ...rawOutput,
      frameRate: Number.isFinite(normalizedFrameRate) && normalizedFrameRate > 0 ? normalizedFrameRate : 30,
      audioTransfer: String(rawOutput.audioTransfer || 'Copy').trim() || 'Copy',
      audioCodec: String(rawOutput.audioCodec || 'AAC').trim() || 'AAC',
      videoEncoder: String(rawOutput.videoEncoder || 'H265').trim() || 'H265',
      videoProfile: String(rawOutput.videoProfile || 'Main').trim() || 'Main',
      dynamicCompressionLevel: String(rawOutput.dynamicCompressionLevel || 'High').trim() || 'High'
    }

    const raw = await callProvider('/topazlabs/video/upload', {
      file: source,
      filters: Array.isArray(payload.filters) && payload.filters.length > 0
        ? payload.filters
        : [{ model: String(payload.model || 'prob-4').trim() || 'prob-4' }],
      output
    }, 'POST', requestOptions)

    const requestId = String(raw?.requestId || raw?.request_id || '').trim()

    return {
      task_id: requestId,
      requestId,
      status: 'processing',
      raw
    }
  }

  const model = String(payload.model_name || payload.model || '').trim()
  const lowerModel = model.toLowerCase()
  const prompt = String(payload.prompt || '').trim()
  const effectivePrompt = prompt || 'Generate a smooth, cinematic video based on the provided inputs.'
  const aspectRatio = payload.aspect_ratio || (typeof payload.size === 'string' && payload.size.includes(':') ? payload.size : undefined) || payload.ratio
  const size = normalizeVideoSize(payload.size) || normalizeVideoSize(aspectRatio)
  const duration = Number(payload.duration || payload.seconds || 5)
  const firstFrameImage = typeof payload.first_frame_image === 'string' ? payload.first_frame_image : ''
  const lastFrameImage = typeof payload.last_frame_image === 'string' ? payload.last_frame_image : ''
  const referenceImages = Array.isArray(payload.images)
    ? payload.images.filter(Boolean)
    : (Array.isArray(payload.image_urls) ? payload.image_urls.filter(Boolean) : [])
  const referenceVideos = Array.isArray(payload.videos)
    ? payload.videos.filter(Boolean)
    : (Array.isArray(payload.video_urls) ? payload.video_urls.filter(Boolean) : [])
  const referenceAudios = normalizeStringList(
    Array.isArray(payload.audios)
      ? payload.audios
      : (Array.isArray(payload.audio_urls) ? payload.audio_urls : payload.audio_url)
  )
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

    const raw = await callProvider('/openai/v1/videos', soraRequest, 'POST', requestOptions)

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
      },
      requestOptions
    )

    return {
      task_id: extractTaskId(raw),
      status: extractKlingStatus(raw),
      raw
    }
  }

  if (lowerModel.startsWith('kling-o3')) {
    const klingRequest = buildKlingO3Request({
      prompt: effectivePrompt,
      aspectRatio: aspectRatio || '16:9',
      duration,
      firstFrameImage: firstFrameImage || inputImage,
      lastFrameImage,
      referenceImages,
      mode: payload.mode,
      generateAudio: payload.enable_audio ?? payload.generate_audio,
      o1Type: payload.o1_type
    })

    const raw = await callProviderWithFallback(
      [
        '/klingai/m2v_omni_3_video',
        '/302/v2/video/create'
      ],
      'POST',
      {
        ...klingRequest,
        model: mappedModel || 'kling-o3'
      },
      requestOptions
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
      raw = await callProvider(endpoint, requestBody, 'POST', requestOptions)
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
            },
            requestOptions
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

  if (isSeedanceModel(model)) {
    const seedanceRequest = buildSeedanceRequest({
      prompt,
      aspectRatio: aspectRatio || 'adaptive',
      duration,
      resolution: payload.resolution,
      firstFrameImage,
      lastFrameImage,
      referenceImages,
      referenceVideos,
      referenceAudios,
      generateAudio: payload.generate_audio ?? payload.enable_audio,
      watermark: payload.watermark,
      callbackUrl: payload.callback_url ?? payload.callback,
      returnLastFrame: payload.return_last_frame,
      serviceTier: payload.service_tier,
      executionExpiresAfter: payload.execution_expires_after,
      tools: payload.tools,
      safetyIdentifier: payload.safety_identifier,
      seed: payload.seed,
      contentItems: payload.content
    })

    const raw = await createSeedanceVideo(model, seedanceRequest, requestOptions)

    return {
      task_id: extractTaskId(raw),
      status: extractSoraStatus(raw?.status || raw?.data?.status || raw?.task_status),
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
    genericBody,
    requestOptions
  )

  return {
    task_id: extractTaskId(genericRaw),
    status: extractSoraStatus(genericRaw?.status || genericRaw?.data?.status || genericRaw?.task_status),
    raw: genericRaw
  }
}

export const providerVideoStatus = async (taskId, requestOptions = {}) => {
  const safeTaskId = String(taskId || '')
  const normalizedSoraTaskId = normalizeSoraTaskId(taskId)
  const mayBeSeedance = safeTaskId.startsWith('cgt-')
  const mayBeKling = safeTaskId.startsWith('kling_') || safeTaskId.startsWith('task_')
  const mayBeSora = normalizedSoraTaskId.startsWith('video_')
  const mayBeWaveSpeed = /^[0-9a-f]{32}$/i.test(safeTaskId)
  const topazStatusPaths = [
    `/topazlabs/video/${taskId}/status`
  ]
  
  if (!mayBeSeedance) {
    try {
      const raw = await callProviderWithFallback(topazStatusPaths, 'GET', null, requestOptions)
      const rawStatus = String(
        raw?.status ||
        raw?.state ||
        raw?.data?.status ||
        raw?.data?.state ||
        ''
      ).trim().toLowerCase()
      const videoUrl = extractVideoUrl(raw)
      const status = videoUrl || rawStatus === 'complete'
        ? 'completed'
        : ['failed', 'error', 'cancelled', 'canceled'].includes(rawStatus)
          ? 'failed'
          : (rawStatus || 'processing')

      return {
        task_id: taskId,
        requestId: String(raw?.requestId || raw?.request_id || taskId).trim() || taskId,
        status,
        video_url: videoUrl || undefined,
        raw
      }
    } catch {
      // Fall through
    }
  }

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

  if (mayBeSeedance) {
    try {
      const raw = await callProvider(
        `/volcengine/api/v3/contents/generations/tasks/${taskId}`,
        null,
        'GET',
        requestOptions
      )
      const videoUrl = extractVideoUrl(raw)
      const status = videoUrl ? 'completed' : extractSoraStatus(raw?.status)

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

  if (mayBeSora) {
    try {
      const raw = await callProvider(`/openai/v1/videos/${normalizedSoraTaskId}`, null, 'GET', requestOptions)
      let status = extractSoraStatus(raw)
      let videoUrl = extractVideoUrl(raw)

      if (status === 'completed' && !videoUrl) {
        try {
          const content = await callProvider(`/openai/v1/videos/${normalizedSoraTaskId}/content?variant=video`, null, 'GET', requestOptions)
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
      const raw = await callProviderWithFallback(klingStatusPaths, 'GET', null, requestOptions)

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
      const raw = await callProviderWithFallback(veoStatusPaths, 'GET', null, requestOptions)
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
    const raw = await callProviderWithFallback(veoStatusPaths, 'GET', null, requestOptions)
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
