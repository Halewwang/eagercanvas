import { HttpError } from '../../utils/http.js'
import { DelegatingProviderAdapter } from './delegating.adapter.js'
import { callProviderMultipart } from './http-client.js'
import {
  extensionFromMimeType,
  fetchBinaryFromSource
} from './media-source.js'

const unsupportedOperation = (operation) => {
  throw new HttpError(400, `PhotoRoom adapter does not support ${operation}`, 'UNSUPPORTED_PROVIDER_OPERATION')
}

export const removePhotoRoomBackground = async (payload = {}, requestOptions = {}) => {
  const source =
    String(payload.image || '').trim() ||
    String(payload.image_url || '').trim() ||
    String(payload.url || '').trim()

  if (!source) {
    throw new HttpError(400, 'Image source is required', 'IMAGE_SOURCE_REQUIRED')
  }

  const { mimeType, buffer } = await fetchBinaryFromSource(source)
  const fileName = `remove-bg.${extensionFromMimeType(mimeType)}`
  const formData = new FormData()
  const blob = new Blob([buffer], { type: mimeType || 'image/png' })

  formData.append('image_file', blob, fileName)
  formData.append('format', String(payload.format || 'png'))
  formData.append('channels', String(payload.channels || 'rgba'))
  formData.append('size', String(payload.size || 'full'))
  formData.append('crop', payload.crop ? 'true' : 'false')
  formData.append('despill', payload.despill ? 'true' : 'false')

  if (typeof payload.bg_color === 'string' && payload.bg_color.trim()) {
    formData.append('bg_color', payload.bg_color.trim())
  }

  let raw
  try {
    raw = await callProviderMultipart('/photoroom/v1/segment?response_format=url', formData, 'POST', requestOptions)
  } catch (error) {
    if (error instanceof HttpError && (error.status === 401 || error.status === 403) && error.code === 'PROVIDER_ERROR') {
      throw new HttpError(502, 'Provider authentication failed for background removal', 'PROVIDER_AUTH_FAILED')
    }
    throw error
  }
  const url = String(raw?.url || raw?.data?.url || '').trim()

  if (!url) {
    throw new HttpError(502, 'No image output from provider', 'NO_IMAGE_OUTPUT')
  }

  return {
    url,
    data: [{ url }],
    raw
  }
}

export class PhotoRoomProviderAdapter extends DelegatingProviderAdapter {
  constructor(operations = {}) {
    super({
      chatCompletion: () => unsupportedOperation('chatCompletion'),
      imageGeneration: () => unsupportedOperation('imageGeneration'),
      videoGeneration: () => unsupportedOperation('videoGeneration'),
      pollTaskStatus: () => unsupportedOperation('pollTaskStatus'),
      removeBackground: removePhotoRoomBackground,
      ...operations
    })
  }

  async removeBackground(payload, options = {}) {
    return this.operations.removeBackground(payload, options)
  }
}
