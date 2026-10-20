export const IMAGE_REQUEST_TIMEOUT_MS = 180000

export const getImageTaskId = (task) => {
  const candidates = [
    task?.task_id,
    task?.taskId,
    task?.requestId,
    task?.request_id,
    task?.id,
    task?.raw?.task_id,
    task?.raw?.taskId,
    task?.raw?.request_id,
    task?.data?.[0]?.task_id,
    task?.data?.task_id,
    task?.data?.taskId,
    task?.data?.request_id,
    task?.data?.id
  ]
  const found = candidates.find((value) => value !== undefined && value !== null && String(value).trim() !== '')
  return found ? String(found) : ''
}

export const getImageTaskStatus = (result) => String(
  result?.status ||
  result?.task_status ||
  result?.state ||
  result?.data?.[0]?.status ||
  result?.data?.status ||
  result?.raw?.status ||
  ''
).toLowerCase()

export const PENDING_IMAGE_TASK_STATUSES = new Set([
  '',
  'created',
  'submitted',
  'running',
  'queued',
  'pending',
  'processing',
  'in_progress'
])

export const isPendingImageTaskStatus = (status = '') =>
  PENDING_IMAGE_TASK_STATUSES.has(String(status || '').trim().toLowerCase())

export const getImageUrl = (item) => {
  const value = (
    item?.url ||
    item?.b64_json ||
    item?.data?.[0]?.url ||
    item?.data?.url ||
    (typeof item === 'string' ? item : '')
  )
  return String(value || '').trim()
}

export const normalizeGeneratedImages = (response) => {
  const data = response?.data || response
  return (Array.isArray(data) ? data : [data])
    .map(item => ({
      url: getImageUrl(item),
      revisedPrompt: item?.revised_prompt || '',
      transient: item?.transient === true,
      persistError: item?.persist_error || item?.persistError || ''
    }))
    .filter(item => item.url)
}
