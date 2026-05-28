const GPT_IMAGE_2_BASE_SIZES = [
  { ratio: '1:1', width: 1024, height: 1024 },
  { ratio: '3:2', width: 1536, height: 1024 },
  { ratio: '2:3', width: 1024, height: 1536 },
  { ratio: '4:3', width: 1152, height: 864 },
  { ratio: '3:4', width: 864, height: 1152 },
  { ratio: '4:5', width: 896, height: 1120 },
  { ratio: '5:4', width: 1120, height: 896 },
  { ratio: '16:9', width: 1280, height: 720 },
  { ratio: '9:16', width: 720, height: 1280 },
  { ratio: '21:9', width: 1680, height: 720 }
]

const GPT_IMAGE_2_MAX_EDGE = 3840
const GPT_IMAGE_2_MAX_PIXELS = 8300000

const scaleGptImage2Size = (base, resolution = '1k') => {
  const safeResolution = String(resolution || '1k').toLowerCase()
  if (safeResolution === '1k') return { width: base.width, height: base.height }
  if (safeResolution === '2k') return { width: base.width * 2, height: base.height * 2 }

  const edgeScale = GPT_IMAGE_2_MAX_EDGE / Math.max(base.width, base.height)
  const pixelScale = Math.sqrt(GPT_IMAGE_2_MAX_PIXELS / (base.width * base.height))
  const scale = Math.min(edgeScale, pixelScale)
  return {
    width: Math.floor(base.width * scale),
    height: Math.floor(base.height * scale)
  }
}

export const normalizeGptImage2Ratio = (value = '') => {
  const safe = String(value || '').trim()
  if (safe === 'auto') return 'auto'
  return GPT_IMAGE_2_BASE_SIZES.some((item) => item.ratio === safe) ? safe : '1:1'
}

export const normalizeGptImage2Resolution = (value = '') => {
  const safe = String(value || '').trim().toLowerCase()
  return ['1k', '2k', '4k'].includes(safe) ? safe : '1k'
}

export const resolveGptImage2Size = ({ ratio = '1:1', resolution = '1k', size = '' } = {}) => {
  const requestedSize = String(size || '').trim().toLowerCase()
  if (requestedSize === 'auto') return 'auto'
  if (/^\d+x\d+$/i.test(requestedSize)) return requestedSize

  const safeRatio = normalizeGptImage2Ratio(ratio)
  if (safeRatio === 'auto') return 'auto'

  const base = GPT_IMAGE_2_BASE_SIZES.find((item) => item.ratio === safeRatio) || GPT_IMAGE_2_BASE_SIZES[0]
  const scaled = scaleGptImage2Size(base, normalizeGptImage2Resolution(resolution))
  return `${scaled.width}x${scaled.height}`
}

const pickAllowed = (value, allowed, fallback) => {
  const safe = String(value || '').trim().toLowerCase()
  return allowed.includes(safe) ? safe : fallback
}

export const buildGptImage2RequestBody = (payload = {}) => {
  const outputFormat = pickAllowed(payload.output_format || payload.outputFormat, ['png', 'jpeg', 'webp'], 'png')
  const resolution = normalizeGptImage2Resolution(payload.resolution)
  const rawRatio = payload.ratio || payload.aspect_ratio
  const hasRatio = rawRatio !== undefined && rawRatio !== null && String(rawRatio).trim() !== ''
  const ratio = normalizeGptImage2Ratio(rawRatio)
  const size = hasRatio
    ? ratio
    : resolveGptImage2Size({
      ratio: rawRatio,
      resolution,
      size: payload.size
    })
  const body = {
    model: 'gpt-image-2',
    prompt: String(payload.prompt || '').trim(),
    size,
    resolution,
    quality: pickAllowed(payload.quality, ['auto', 'low', 'medium', 'high'], 'auto'),
    background: pickAllowed(payload.background, ['auto', 'opaque', 'transparent'], 'auto'),
    output_format: outputFormat,
    n: 1,
    moderation: pickAllowed(payload.moderation, ['auto', 'low'], 'auto')
  }

  if (outputFormat === 'jpeg' || outputFormat === 'webp') {
    body.output_compression = Number.isFinite(Number(payload.output_compression))
      ? Math.max(0, Math.min(100, Number(payload.output_compression)))
      : 100
  }

  return body
}

export const extractGptImage2TaskId = (response = {}) => {
  const candidates = [
    response?.task_id,
    response?.taskId,
    response?.id,
    response?.data?.[0]?.task_id,
    response?.data?.[0]?.taskId,
    response?.data?.[0]?.id,
    response?.data?.task_id,
    response?.data?.taskId,
    response?.data?.id,
    response?.result?.task_id,
    response?.result?.taskId
  ]
  return String(candidates.find((value) => value !== undefined && value !== null && String(value).trim()) || '').trim()
}

export const buildGptImage2AsyncResultPath = (taskId = '') =>
  `/v1/async_result?task_id=${encodeURIComponent(String(taskId || '').trim())}`

export const isGptImage2PendingResult = (response = {}) => {
  const values = [
    response?.status,
    response?.message,
    response?.msg,
    response?.err,
    response?.error,
    response?.error?.message,
    response?.error?.msg,
    response?.data,
    response?.data?.err,
    response?.data?.status,
    response?.data?.message,
    response?.data?.msg,
    response?.result,
    response?.result?.err,
    response?.result?.status,
    response?.result?.message,
    response?.result?.msg
  ].map((value) => String(value || '').trim().toLowerCase())

  return values.some((value) => (
    value === 'pending' ||
    value === 'processing' ||
    value === 'running' ||
    value === 'queued' ||
    value === 'result pending' ||
    value.includes('pending')
  ))
}
