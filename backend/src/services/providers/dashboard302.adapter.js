import { DelegatingProviderAdapter } from './delegating.adapter.js'
import { HttpError } from '../../utils/http.js'
import { callProvider, callProviderWithFallback } from './http-client.js'
import { extractTaskId, extractVideoUrl } from './video-response.js'
import {
  buildKlingO1Request,
  buildKlingO3Request,
  extractKlingStatus,
  isKlingTaskId,
  isKlingVideoModel,
  isTopazVideoEnhancePayload,
  normalizeTopazStatus,
  pickFirstImageInput
} from './dashboard302-video-helpers.js'

export {
  isKlingVideoModel,
  isKlingTaskId,
  isTopazVideoEnhancePayload
} from './dashboard302-video-helpers.js'

export const createKlingVideo = async (payload = {}, requestOptions = {}) => {
  const model = String(payload.model_name || payload.model || '').trim()
  const lowerModel = model.toLowerCase()
  const prompt = String(payload.prompt || '').trim()
  const effectivePrompt = prompt || 'Generate a smooth, cinematic video based on the provided inputs.'
  const aspectRatio = payload.aspect_ratio ||
    (typeof payload.size === 'string' && payload.size.includes(':') ? payload.size : undefined) ||
    payload.ratio
  const duration = Number(payload.duration || payload.seconds || 5)
  const firstFrameImage = typeof payload.first_frame_image === 'string' ? payload.first_frame_image : ''
  const lastFrameImage = typeof payload.last_frame_image === 'string' ? payload.last_frame_image : ''
  const referenceImages = Array.isArray(payload.images)
    ? payload.images.filter(Boolean)
    : (Array.isArray(payload.image_urls) ? payload.image_urls.filter(Boolean) : [])
  const inputImage = pickFirstImageInput(payload)

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
        model: 'kling-o1'
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
        model: 'kling-o3'
      },
      requestOptions
    )

    return {
      task_id: extractTaskId(raw),
      status: extractKlingStatus(raw),
      raw
    }
  }

  throw new HttpError(400, '不支持的模型服务商视频模型', 'UNSUPPORTED_VIDEO_MODEL')
}

export const createTopazVideoEnhance = async (payload = {}, requestOptions = {}) => {
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

export const createDashboard302Video = async (payload = {}, requestOptions = {}) => {
  if (isTopazVideoEnhancePayload(payload)) {
    return createTopazVideoEnhance(payload, requestOptions)
  }

  const model = String(payload.model_name || payload.model || '').trim()
  if (isKlingVideoModel(model)) {
    return createKlingVideo(payload, requestOptions)
  }

  throw new HttpError(400, '不支持的模型服务商视频模型', 'UNSUPPORTED_VIDEO_MODEL')
}

export const pollTopazTaskStatus = async (taskId, requestOptions = {}) => {
  const raw = await callProviderWithFallback(
    [`/topazlabs/video/${taskId}/status`],
    'GET',
    null,
    requestOptions
  )
  const rawStatus = String(
    raw?.status ||
    raw?.state ||
    raw?.data?.status ||
    raw?.data?.state ||
    ''
  ).trim().toLowerCase()
  const videoUrl = extractVideoUrl(raw)
  const status = videoUrl
    ? 'completed'
    : normalizeTopazStatus(rawStatus)

  return {
    task_id: taskId,
    requestId: String(raw?.requestId || raw?.request_id || taskId).trim() || taskId,
    status,
    video_url: videoUrl || undefined,
    raw
  }
}

export const pollKlingTaskStatus = async (taskId, requestOptions = {}) => {
  const raw = await callProviderWithFallback(
    [
      `/klingai/task/${taskId}/fetch`,
      `/klingai/v1/videos/image2video/${taskId}`,
      `/kling/v1/videos/text2video/${taskId}`,
      `/kling/v1/videos/image2video/${taskId}`
    ],
    'GET',
    null,
    requestOptions
  )

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
}

export const pollDashboard302VideoStatus = async (taskId, requestOptions = {}) => {
  const safeTaskId = String(taskId || '').trim()
  if (!safeTaskId) return null

  if (String(requestOptions?.statusProvider || '').trim().toLowerCase() === 'topaz') {
    return pollTopazTaskStatus(safeTaskId, requestOptions)
  }

  if (isKlingTaskId(safeTaskId)) {
    return pollKlingTaskStatus(safeTaskId, requestOptions)
  }

  throw new HttpError(400, 'Unsupported video task id', 'UNSUPPORTED_VIDEO_TASK')
}

export class Dashboard302ProviderAdapter extends DelegatingProviderAdapter {
  constructor(operations = {}) {
    super({
      videoGeneration: createDashboard302Video,
      pollTaskStatus: pollDashboard302VideoStatus,
      ...operations
    })
  }
}
