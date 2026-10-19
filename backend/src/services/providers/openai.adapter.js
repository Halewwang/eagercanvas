import { DelegatingProviderAdapter } from './delegating.adapter.js'
import { callProvider } from './http-client.js'
import { pickFirstImageInput } from './image-request.js'

const OPENAI_VIDEO_SIZE_BY_RATIO = {
  '16:9': '1280x720',
  '9:16': '720x1280',
  '7:4': '1792x1024',
  '4:7': '1024x1792',
  '4:3': '1152x864',
  '3:4': '864x1152',
  '1:1': '1024x1024'
}

export const isOpenAiVideoModel = (model = '') => {
  const lowerModel = String(model || '').trim().toLowerCase()
  return lowerModel === 'sora2' || lowerModel.startsWith('sora-2')
}

export const normalizeOpenAiVideoTaskId = (taskId = '') => {
  const safeTaskId = String(taskId || '').trim()
  if (!safeTaskId) return ''
  if (safeTaskId.includes(':')) {
    return safeTaskId.split(':').pop() || ''
  }
  return safeTaskId
}

export const isOpenAiVideoTaskId = (taskId = '') => normalizeOpenAiVideoTaskId(taskId).startsWith('video_')

const normalizeOpenAiVideoSize = (value) => {
  if (!value || typeof value !== 'string') return undefined
  if (value.includes(':')) return OPENAI_VIDEO_SIZE_BY_RATIO[value] || undefined
  if (value.includes('x')) return value
  return undefined
}

const clampToAllowedValue = (value, allowed, fallback) => {
  const numeric = Number(value)
  if (allowed.includes(numeric)) return numeric
  return fallback
}

const mapOpenAiVideoModelName = (model = '') => {
  const lowerModel = String(model || '').trim().toLowerCase()
  if (lowerModel === 'sora2') return 'sora-2'
  return String(model || '').trim()
}

const extractProviderTaskId = (data = {}) => {
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

const normalizeOpenAiVideoStatus = (data = {}) => {
  const value = typeof data === 'string' || typeof data === 'number'
    ? data
    : (
        data?.status ??
        data?.state ??
        data?.task?.status ??
        data?.data?.status ??
        data?.data?.state
      )
  const status = String(value || '').toLowerCase()
  if (['created', 'in_processing', 'in_progress', 'processing', 'pending', 'submitted', 'running', 'queued'].includes(status)) return 'processing'
  if (['completed', 'succeeded', 'success', 'done', 'finished'].includes(status)) return 'completed'
  if (['failed', 'error', 'canceled', 'cancelled', 'failure'].includes(status)) return 'failed'
  return status || 'processing'
}

export const createOpenAiVideo = async (payload = {}, requestOptions = {}) => {
  const model = String(payload.model_name || payload.model || '').trim()
  const prompt = String(payload.prompt || '').trim()
  const effectivePrompt = prompt || 'Generate a smooth, cinematic video based on the provided inputs.'
  const aspectRatio = payload.aspect_ratio ||
    (typeof payload.size === 'string' && payload.size.includes(':') ? payload.size : undefined) ||
    payload.ratio
  const soraSize = normalizeOpenAiVideoSize(payload.size) || normalizeOpenAiVideoSize(aspectRatio) || '1280x720'
  const soraSeconds = clampToAllowedValue(payload.seconds || payload.duration, [4, 8, 12], 4)
  const firstFrameImage = typeof payload.first_frame_image === 'string' ? payload.first_frame_image : ''
  const lastFrameImage = typeof payload.last_frame_image === 'string' ? payload.last_frame_image : ''
  const referenceImages = Array.isArray(payload.images)
    ? payload.images.filter(Boolean)
    : (Array.isArray(payload.image_urls) ? payload.image_urls.filter(Boolean) : [])
  const inputReference = firstFrameImage || pickFirstImageInput(payload) || referenceImages[0] || lastFrameImage
  const soraRequest = {
    prompt: effectivePrompt,
    model: mapOpenAiVideoModelName(model) || 'sora-2',
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
    task_id: extractProviderTaskId(raw),
    status: normalizeOpenAiVideoStatus(raw),
    raw
  }
}

export const pollOpenAiVideoTaskStatus = async (taskId, requestOptions = {}) => {
  const normalizedTaskId = normalizeOpenAiVideoTaskId(taskId)
  const raw = await callProvider(`/openai/v1/videos/${normalizedTaskId}`, null, 'GET', requestOptions)
  let status = normalizeOpenAiVideoStatus(raw)
  let videoUrl = extractVideoUrl(raw)

  if (status === 'completed' && !videoUrl) {
    try {
      const content = await callProvider(`/openai/v1/videos/${normalizedTaskId}/content?variant=video`, null, 'GET', requestOptions)
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
}

export class OpenAiProviderAdapter extends DelegatingProviderAdapter {
  constructor(operations = {}) {
    super({
      videoGeneration: createOpenAiVideo,
      pollTaskStatus: pollOpenAiVideoTaskStatus,
      ...operations
    })
  }
}
