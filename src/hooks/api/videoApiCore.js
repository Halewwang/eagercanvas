export const DONE_VIDEO_STATUSES = new Set(['completed', 'complete', 'succeeded', 'success', 'done', 'finished', 'succeed', 'successed'])
export const TRANSIENT_VIDEO_ERROR_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504])

export const buildVideoRequestData = (params) => {
  const requestData = {
    model: params.model,
    model_name: params.model,
    prompt: params.prompt || ''
  }
  if (params.projectId) requestData.projectId = params.projectId
  if (params.sourceNodeId) requestData.sourceNodeId = params.sourceNodeId
  if (params.tool) requestData.tool = params.tool

  if (params.tool === 'enhance') {
    if (params.file) requestData.file = params.file
    if (Array.isArray(params.filters) && params.filters.length > 0) requestData.filters = params.filters
    if (params.output && typeof params.output === 'object') requestData.output = params.output
  }

  if (params.first_frame_image) requestData.first_frame_image = params.first_frame_image
  if (params.last_frame_image) requestData.last_frame_image = params.last_frame_image
  if (params.ratio) requestData.aspect_ratio = params.ratio
  if (params.size) requestData.size = params.size
  if (params.mode) requestData.mode = params.mode
  if (params.o1_type) requestData.o1_type = params.o1_type

  const normalizedDuration = Number(params.duration ?? params.dur)
  if (Number.isFinite(normalizedDuration) && normalizedDuration > 0) {
    requestData.duration = normalizedDuration
    requestData.seconds = normalizedDuration
  }
  if (Array.isArray(params.images) && params.images.length > 0) requestData.images = params.images
  if (Array.isArray(params.videos) && params.videos.length > 0) requestData.videos = params.videos
  if (typeof params.enable_audio === 'boolean') requestData.enable_audio = params.enable_audio
  if (typeof params.generate_audio === 'boolean') requestData.generate_audio = params.generate_audio

  return requestData
}

export const getVideoTaskId = (task) => {
  const candidates = [
    task?.task_id,
    task?.taskId,
    task?.requestId,
    task?.request_id,
    task?.id,
    task?.task?.task_id,
    task?.raw?.task_id,
    task?.raw?.requestId,
    task?.raw?.request_id,
    task?.raw?.task?.task_id,
    task?.data?.task_id,
    task?.data?.taskId,
    task?.data?.requestId,
    task?.data?.request_id,
    task?.data?.id,
    task?.data?.data?.task_id,
    task?.data?.data?.id
  ]
  const found = candidates.find((value) => value !== undefined && value !== null && String(value).trim() !== '')
  return found ? String(found) : ''
}

export const getVideoTaskStatus = (result) => {
  return String(
    result?.status ||
    result?.task?.status ||
    result?.raw?.status ||
    result?.raw?.task?.status ||
    result?.raw?.task?.task_status ||
    result?.task_status ||
    result?.data?.status ||
    result?.data?.task_status ||
    result?.data?.state ||
    result?.state ||
    ''
  ).toLowerCase()
}

export const getVideoUrl = (result) => {
  return (
    result?.url ||
    result?.video_url ||
    result?.download?.url ||
    result?.data?.url ||
    result?.data?.video_url ||
    result?.data?.download?.url ||
    result?.data?.task_result?.video_url ||
    result?.data?.task_result?.video?.url ||
    result?.data?.task_result?.videos?.[0]?.url ||
    result?.task_result?.video_url ||
    result?.task_result?.video?.url ||
    result?.task_result?.videos?.[0]?.url ||
    result?.raw?.video_url ||
    result?.raw?.download?.url ||
    result?.raw?.task?.task_result?.videos?.[0]?.url ||
    result?.raw?.output?.[0]?.url ||
    result?.detail?.draft_info?.downloadable_url ||
    result?.data?.detail?.draft_info?.downloadable_url ||
    result?.data?.[0]?.url ||
    result?.output?.[0]?.url ||
    ''
  )
}
