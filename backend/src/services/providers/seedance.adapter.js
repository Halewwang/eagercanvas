import { DelegatingProviderAdapter } from './delegating.adapter.js'
import { callProvider } from './http-client.js'
import { HttpError } from '../../utils/http.js'

export const isSeedanceModel = (model = '') => {
  const lowerModel = String(model || '').trim().toLowerCase()
  return lowerModel.startsWith('seedance-2.0') || lowerModel.startsWith('doubao-seedance-2-0')
}

const mapSeedanceModelName = (model = '') => {
  const lowerModel = String(model || '').trim().toLowerCase()
  if (lowerModel === 'seedance-2.0') return 'doubao-seedance-2-0-260128'
  if (lowerModel === 'seedance-2.0-fast') return 'doubao-seedance-2-0-fast-260128'
  return String(model || '').trim()
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

const extractVideoUrl = (data = {}) => {
  return (
    data?.url ||
    data?.videoUrl ||
    data?.video_url ||
    data?.content?.videoUrl ||
    data?.content?.video_url ||
    data?.data?.url ||
    data?.data?.videoUrl ||
    data?.data?.video_url ||
    data?.data?.content?.videoUrl ||
    data?.data?.content?.video_url ||
    data?.outputs?.[0]?.url ||
    data?.outputs?.[0] ||
    data?.data?.outputs?.[0]?.url ||
    data?.data?.outputs?.[0] ||
    ''
  )
}

const normalizeVideoStatus = (value) => {
  const status = String(value || '').toLowerCase()
  if (['created', 'in_processing', 'in_progress', 'processing', 'pending', 'submitted', 'running', 'queued'].includes(status)) return 'processing'
  if (['completed', 'succeeded', 'success', 'done', 'finished'].includes(status)) return 'completed'
  if (['failed', 'error', 'canceled', 'cancelled', 'failure'].includes(status)) return 'failed'
  return status || 'processing'
}

export const buildSeedanceVideoRequest = ({
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
    for (const value of referenceImages || []) pushMediaItem('image_url', value, 'reference_image')
    for (const value of referenceVideos || []) pushMediaItem('video_url', value, 'reference_video')
    for (const value of referenceAudios || []) pushMediaItem('audio_url', value, 'reference_audio')
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

export const createSeedanceVideo = async (payload = {}, requestOptions = {}) => {
  const model = String(payload.model_name || payload.model || '').trim()
  const aspectRatio = payload.aspect_ratio ||
    (typeof payload.size === 'string' && payload.size.includes(':') ? payload.size : undefined) ||
    payload.ratio
  const requestBody = buildSeedanceVideoRequest({
    prompt: payload.prompt,
    aspectRatio: aspectRatio || 'adaptive',
    duration: Number(payload.duration || payload.seconds || 5),
    resolution: payload.resolution,
    firstFrameImage: typeof payload.first_frame_image === 'string' ? payload.first_frame_image : '',
    lastFrameImage: typeof payload.last_frame_image === 'string' ? payload.last_frame_image : '',
    referenceImages: Array.isArray(payload.images)
      ? payload.images.filter(Boolean)
      : (Array.isArray(payload.image_urls) ? payload.image_urls.filter(Boolean) : []),
    referenceVideos: Array.isArray(payload.videos)
      ? payload.videos.filter(Boolean)
      : (Array.isArray(payload.video_urls) ? payload.video_urls.filter(Boolean) : []),
    referenceAudios: normalizeStringList(
      Array.isArray(payload.audios)
        ? payload.audios
        : (Array.isArray(payload.audio_urls) ? payload.audio_urls : payload.audio_url)
    ),
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
  const raw = await callProvider(
    '/volcengine/api/v3/contents/generations/tasks',
    {
      ...requestBody,
      model: mapSeedanceModelName(model)
    },
    'POST',
    requestOptions
  )

  return {
    task_id: extractTaskId(raw),
    status: normalizeVideoStatus(raw?.status || raw?.data?.status || raw?.task_status),
    raw
  }
}

export const pollSeedanceTaskStatus = async (taskId, requestOptions = {}) => {
  const raw = await callProvider(
    `/volcengine/api/v3/contents/generations/tasks/${taskId}`,
    null,
    'GET',
    requestOptions
  )
  const videoUrl = extractVideoUrl(raw)
  const status = videoUrl ? 'completed' : normalizeVideoStatus(raw?.status)

  return {
    task_id: taskId,
    status,
    video_url: videoUrl || undefined,
    raw
  }
}

export class SeedanceProviderAdapter extends DelegatingProviderAdapter {
  constructor(operations = {}) {
    super({
      videoGeneration: createSeedanceVideo,
      pollTaskStatus: pollSeedanceTaskStatus,
      ...operations
    })
  }
}
