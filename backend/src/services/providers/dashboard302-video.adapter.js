import { DelegatingProviderAdapter } from './delegating.adapter.js'
import { HttpError } from '../../utils/http.js'
import { callProvider, callProviderWithFallback } from './http-client.js'
import {
  clampToAllowedValue,
  extractSoraStatus,
  extractTaskId,
  extractVideoUrl,
  isEndpointNotFoundError,
  mapVideoModelName,
  normalizeErrorMessage,
  normalizeVideoSize
} from './video-response.js'

const DEFAULT_VIDEO_PROMPT = 'Generate a smooth, cinematic video based on the provided inputs.'

const pickFirstImageInput = (payload = {}) => {
  if (typeof payload.image === 'string') return payload.image
  if (Array.isArray(payload.image) && payload.image.length > 0) return payload.image[0]
  if (Array.isArray(payload.images) && payload.images.length > 0) return payload.images[0]
  if (typeof payload.first_frame_image === 'string') return payload.first_frame_image
  if (typeof payload.image_url === 'string') return payload.image_url
  return ''
}

const getVideoContext = (payload = {}) => {
  const model = String(payload.model_name || payload.model || '').trim()
  const prompt = String(payload.prompt || '').trim()
  const aspectRatio = payload.aspect_ratio ||
    (typeof payload.size === 'string' && payload.size.includes(':') ? payload.size : undefined) ||
    payload.ratio
  const firstFrameImage = typeof payload.first_frame_image === 'string' ? payload.first_frame_image : ''
  const lastFrameImage = typeof payload.last_frame_image === 'string' ? payload.last_frame_image : ''
  const referenceImages = Array.isArray(payload.images)
    ? payload.images.filter(Boolean)
    : (Array.isArray(payload.image_urls) ? payload.image_urls.filter(Boolean) : [])

  return {
    model,
    lowerModel: model.toLowerCase(),
    mappedModel: mapVideoModelName(model),
    effectivePrompt: prompt || DEFAULT_VIDEO_PROMPT,
    aspectRatio,
    size: normalizeVideoSize(payload.size) || normalizeVideoSize(aspectRatio),
    duration: Number(payload.duration || payload.seconds || 5),
    firstFrameImage,
    lastFrameImage,
    referenceImages,
    inputImage: pickFirstImageInput(payload)
  }
}

const normalizeVeoProviderError = (error) => {
  const normalized = normalizeErrorMessage(error?.message)
  if (normalized && normalized !== error?.message) {
    throw new HttpError(503, normalized, 'MODEL_TEMPORARILY_UNAVAILABLE')
  }
  throw error
}

const getDashboard302VideoStatusPaths = (taskId) => [
  `/ws/api/v3/predictions/${taskId}/result`,
  `/302/submit/veo3-v2/${taskId}`,
  `/302/v2/video/fetch/${taskId}`,
  `/v2/video/generations?generation_id=${taskId}`,
  `/video/generations?generation_id=${taskId}`
]

export const isDashboard302VeoVideoModel = (model = '') => {
  const safe = String(model || '').trim().toLowerCase()
  return safe.startsWith('veo-3.1')
}

export const createVeoVideo = async (payload = {}, requestOptions = {}) => {
  const {
    effectivePrompt,
    aspectRatio,
    duration,
    firstFrameImage,
    lastFrameImage,
    referenceImages,
    inputImage,
    mappedModel
  } = getVideoContext(payload)
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
    if (!isEndpointNotFoundError(error)) {
      normalizeVeoProviderError(error)
    }

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
      normalizeVeoProviderError(fallbackError)
    }
  }

  return {
    task_id: extractTaskId(raw),
    status: extractSoraStatus(raw),
    raw
  }
}

export const createGenericDashboard302Video = async (payload = {}, requestOptions = {}) => {
  const {
    model,
    mappedModel,
    effectivePrompt,
    aspectRatio,
    size,
    duration,
    firstFrameImage,
    lastFrameImage,
    referenceImages
  } = getVideoContext(payload)
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

  const raw = await callProviderWithFallback(
    ['/302/v2/video/create'],
    'POST',
    genericBody,
    requestOptions
  )

  return {
    task_id: extractTaskId(raw),
    status: extractSoraStatus(raw?.status || raw?.data?.status || raw?.task_status),
    raw
  }
}

export const createDashboard302Video = async (payload = {}, requestOptions = {}) => {
  const { lowerModel } = getVideoContext(payload)
  if (lowerModel.startsWith('veo-3.1')) {
    return createVeoVideo(payload, requestOptions)
  }
  return createGenericDashboard302Video(payload, requestOptions)
}

export const pollDashboard302VideoStatus = async (taskId, requestOptions = {}) => {
  const raw = await callProviderWithFallback(
    getDashboard302VideoStatusPaths(taskId),
    'GET',
    null,
    requestOptions
  )
  const status = extractSoraStatus(raw?.status || raw?.data?.status || raw?.task_status || raw)
  const videoUrl = extractVideoUrl(raw)

  return {
    task_id: taskId,
    status: videoUrl ? 'completed' : status,
    video_url: videoUrl || undefined,
    raw
  }
}

export class Dashboard302VideoProviderAdapter extends DelegatingProviderAdapter {
  constructor(operations = {}) {
    super({
      videoGeneration: createDashboard302Video,
      pollTaskStatus: pollDashboard302VideoStatus,
      ...operations
    })
  }
}
