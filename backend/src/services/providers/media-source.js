import { HttpError } from '../../utils/http.js'

export const parseDataUrl = (value = '') => {
  const match = String(value).match(/^data:(.+?);base64,(.+)$/)
  if (!match) return null
  return { mimeType: match[1], data: match[2] }
}

export const fetchImageAsBase64 = async (url) => {
  try {
    const response = await fetch(url)
    if (!response.ok) return null
    const buffer = await response.arrayBuffer()
    const mime = response.headers.get('content-type') || 'image/png'
    return {
      mimeType: mime,
      data: Buffer.from(buffer).toString('base64')
    }
  } catch (e) {
    console.error('Fetch image failed', e)
    return null
  }
}

export const fetchBinaryFromSource = async (source = '') => {
  const value = String(source || '').trim()
  if (!value) {
    throw new HttpError(400, 'Image source is required', 'IMAGE_SOURCE_REQUIRED')
  }

  const dataUrl = parseDataUrl(value)
  if (dataUrl) {
    return {
      mimeType: dataUrl.mimeType || 'image/png',
      buffer: Buffer.from(dataUrl.data, 'base64')
    }
  }

  try {
    const response = await fetch(value)
    if (!response.ok) {
      throw new HttpError(response.status, `Failed to fetch source image: ${response.status}`, 'IMAGE_FETCH_FAILED')
    }
    const mimeType = response.headers.get('content-type') || 'image/png'
    const arrayBuffer = await response.arrayBuffer()
    return {
      mimeType,
      buffer: Buffer.from(arrayBuffer)
    }
  } catch (error) {
    if (error instanceof HttpError) throw error
    throw new HttpError(400, 'Failed to load source image', 'IMAGE_FETCH_FAILED')
  }
}

export const extensionFromMimeType = (mimeType = '') => {
  const safe = String(mimeType || '').toLowerCase()
  if (safe.includes('png')) return 'png'
  if (safe.includes('webp')) return 'webp'
  if (safe.includes('gif')) return 'gif'
  return 'jpg'
}
