const RATIO_TO_SIZE = {
  '16:9': '1280x720',
  '9:16': '720x1280',
  '7:4': '1792x1024',
  '4:7': '1024x1792',
  '4:3': '1152x864',
  '3:4': '864x1152',
  '1:1': '1024x1024'
}

export const normalizeVideoSize = (value) => {
  if (!value || typeof value !== 'string') return undefined
  if (value.includes(':')) return RATIO_TO_SIZE[value] || undefined
  if (value.includes('x')) return value
  return undefined
}

export const isEndpointNotFoundError = (error) => {
  const status = Number(error?.status || 0)
  const message = String(error?.message || '').toLowerCase()
  return (
    status === 404 ||
    status === 405 ||
    /not found|no such endpoint|unknown endpoint|unsupported route|cannot\s+(get|post|put|patch|delete)/.test(message)
  )
}

export const extractVideoUrl = (data = {}) => {
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

export const normalizeSoraStatus = (value) => {
  const status = String(value || '').toLowerCase()
  if (['created', 'in_processing', 'in_progress', 'processing', 'pending', 'submitted', 'running', 'queued'].includes(status)) return 'processing'
  if (['completed', 'succeeded', 'success', 'done', 'finished'].includes(status)) return 'completed'
  if (['failed', 'error', 'canceled', 'cancelled', 'failure'].includes(status)) return 'failed'
  return status || 'processing'
}

export const normalizeErrorMessage = (message = '') => {
  const text = String(message || '').trim()
  if (!text) return ''
  if (/no available models currently/i.test(text)) {
    return 'Veo 3.1 当前在供应商侧无可用资源，请稍后重试或切换到 Kling O1。'
  }
  return text
}

export const mapVideoModelName = (model = '') => {
  const lowerModel = String(model || '').trim().toLowerCase()
  if (lowerModel === 'veo-3.1') return 'veo3.1'
  if (lowerModel === 'veo-3.1-pro') return 'veo3.1-pro'
  return String(model || '').trim()
}

export const clampToAllowedValue = (value, allowed, fallback) => {
  const numeric = Number(value)
  if (allowed.includes(numeric)) return numeric
  return fallback
}

export const extractTaskId = (data = {}) => {
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

export const extractSoraStatus = (data = {}) => {
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
