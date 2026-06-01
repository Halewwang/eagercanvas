export const WEDDING_3X3_ASYNC_IMAGE_MODELS = new Set([
  'gemini-3.1-flash-image-preview',
  'gemini-3-pro-image-preview'
])

export const isWedding3x3AsyncImageModel = (model) =>
  WEDDING_3X3_ASYNC_IMAGE_MODELS.has(String(model || '').trim().toLowerCase())

export const extractWedding3x3ImageTaskId = (result = {}) => {
  const candidates = [
    result?.task_id,
    result?.taskId,
    result?.id,
    result?.data?.task_id,
    result?.data?.taskId,
    result?.data?.id,
    result?.raw?.task_id,
    result?.raw?.id,
    result?.raw?.data?.id
  ]

  const found = candidates.find((value) => value !== undefined && value !== null && String(value).trim() !== '')
  return found ? String(found).trim() : ''
}

export const extractWedding3x3GeneratedImageUrl = (result = {}) => {
  const dataList = Array.isArray(result?.data) ? result.data : []
  const firstDataUrl = dataList.find((item) => String(item?.url || '').trim())?.url
  if (firstDataUrl) return String(firstDataUrl).trim()

  const candidates = [
    result?.url,
    result?.image_url,
    result?.imageUrl,
    result?.data?.url,
    result?.raw?.url,
    result?.raw?.image_url,
    result?.raw?.data?.url
  ]
  const found = candidates.find((value) => value !== undefined && value !== null && String(value).trim() !== '')
  return found ? String(found).trim() : ''
}

const defaultSleep = (ms) => new Promise((resolve) => globalThis.setTimeout(resolve, ms))

export const waitForWedding3x3AsyncImageResult = async (
  taskId,
  {
    attempts = 45,
    getTask,
    intervalMs = 3000,
    sleep = defaultSleep,
    timeout = 45000
  } = {}
) => {
  const safeTaskId = String(taskId || '').trim()
  if (!safeTaskId) {
    throw new Error('Image task id is missing')
  }
  if (typeof getTask !== 'function') {
    throw new Error('Image task loader is missing')
  }

  let lastMessage = ''
  for (let index = 0; index < attempts; index += 1) {
    const result = await getTask(safeTaskId, { timeout })
    const nextUrl = extractWedding3x3GeneratedImageUrl(result)
    if (nextUrl) {
      return result
    }

    const status = String(result?.status || '').trim().toLowerCase()
    const message = String(result?.message || '').trim()
    if (message) lastMessage = message

    if (['failed', 'error', 'cancelled', 'canceled', 'failure'].includes(status)) {
      throw new Error(message || 'Image generation failed')
    }

    if (index < attempts - 1) {
      await sleep(intervalMs)
    }
  }

  throw new Error(lastMessage || 'Image generation timed out, please try again.')
}
