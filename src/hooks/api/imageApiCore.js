export const IMAGE_REQUEST_TIMEOUT_MS = 180000

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

export const ratioFromSize = (size) => {
  const [w, h] = String(size || '').split('x').map(Number)
  if (!w || !h) return '1:1'
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
  return '1:1'
}

export const normalizeResolution = (value) => {
  const safe = String(value || '').trim().toLowerCase()
  if (safe === '1k' || safe === '2k' || safe === '4k') return safe
  return ''
}

export const resolutionFromSize = (size, ratioKey = '') => {
  const [w, h] = String(size || '').split('x').map(Number)
  if (!w || !h) return '1k'
  const ratio = ratioKey || ratioFromSize(size)
  const base = IMAGE_BASE_SIZE_BY_RATIO[ratio] || IMAGE_BASE_SIZE_BY_RATIO['1:1']
  const scale = Math.max(w / base.w, h / base.h)
  if (scale >= 3.5) return '4k'
  if (scale >= 1.8) return '2k'
  return '1k'
}

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
  result?.data?.status ||
  result?.raw?.status ||
  ''
).toLowerCase()

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
