import { HttpError } from '../../utils/http.js'

export const isKlingVideoModel = (model = '') => {
  const safe = String(model || '').trim().toLowerCase()
  return safe.startsWith('kling-o1') || safe.startsWith('kling-o3')
}

export const isKlingTaskId = (taskId = '') => {
  const safe = String(taskId || '').trim()
  return safe.startsWith('kling_') || safe.startsWith('task_')
}

export const isTopazVideoEnhancePayload = (payload = {}) => {
  const tool = String(payload.tool || payload.operation || '').trim().toLowerCase()
  return tool === 'enhance'
}

export const pickFirstImageInput = (payload = {}) => {
  if (typeof payload.image === 'string') return payload.image
  if (Array.isArray(payload.image) && payload.image.length > 0) return payload.image[0]
  if (Array.isArray(payload.images) && payload.images.length > 0) return payload.images[0]
  if (typeof payload.first_frame_image === 'string') return payload.first_frame_image
  if (typeof payload.image_url === 'string') return payload.image_url
  return ''
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

export const extractKlingStatus = (data = {}) =>
  normalizeKlingStatus(
    data?.task?.task_status ??
    data?.task?.status ??
    data?.status ??
    data?.data?.task?.task_status ??
    data?.data?.task?.status ??
    data?.data?.status
  )

export const normalizeTopazStatus = (value = '') => {
  const status = String(value || '').trim().toLowerCase()
  if (status === 'complete') return 'completed'
  if (['failed', 'error', 'cancelled', 'canceled'].includes(status)) return 'failed'
  return status || 'processing'
}

export const buildKlingO1Request = ({ prompt, aspectRatio, duration, firstFrameImage, lastFrameImage, referenceImages }) => {
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

export const buildKlingO3Request = ({
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
