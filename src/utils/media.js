import request from './request'

export const isDataImageUrl = (value = '') => /^data:image\//i.test(String(value || ''))
export const isDataUrl = (value = '') => /^data:/i.test(String(value || ''))
export const isRemoteHttpUrl = (value = '') => /^https?:\/\//i.test(String(value || ''))
export const SORA2_ALLOWED_REFERENCE_SIZES = ['1280x720', '720x1280', '1024x1792', '1792x1024']

export const dataUrlToFile = (dataUrl, fileName = 'image.png') => {
  const value = String(dataUrl || '')
  const match = value.match(/^data:(.+?);base64,(.+)$/)
  if (!match) return null
  const mimeType = match[1] || 'image/png'
  const base64 = match[2] || ''
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new File([bytes], fileName, { type: mimeType })
}

export const uploadImageFile = async (file, options = {}) => {
  const { onProgress } = options
  const formData = new FormData()
  formData.append('file', file)
  const res = await request.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    silentErrorToast: true,
    silentNetworkErrorToast: true,
    onUploadProgress: (event) => {
      if (typeof onProgress !== 'function') return
      const loaded = Number(event?.loaded || 0)
      const total = Number(event?.total || 0)
      if (!total) return
      const percent = Math.max(0, Math.min(100, Math.round((loaded / total) * 100)))
      onProgress(percent)
    }
  })
  const uploadedUrl = String(res?.url || '').trim()
  return uploadedUrl || ''
}

export const uploadRemoteAsset = async (url, fileName = '') => {
  const raw = String(url || '').trim()
  if (!raw) return ''
  const res = await request.post('/upload/remote', {
    url: raw,
    fileName: fileName || undefined
  }, {
    silentErrorToast: true,
    silentNetworkErrorToast: true
  })
  return String(res?.url || '').trim()
}

export const persistImageUrl = async (url, fileName = 'image.png') => {
  const raw = String(url || '').trim()
  if (!raw) return ''
  if (isDataImageUrl(raw)) {
    const file = dataUrlToFile(raw, fileName)
    if (!file) return ''
    return uploadImageFile(file)
  }
  if (isRemoteHttpUrl(raw)) {
    return uploadRemoteAsset(raw, fileName)
  }
  return raw
}

export const persistMediaUrl = async (url, fileName = 'asset.bin') => {
  const raw = String(url || '').trim()
  if (!raw) return ''
  if (isDataUrl(raw)) {
    const file = dataUrlToFile(raw, fileName)
    if (!file) return ''
    return uploadImageFile(file)
  }
  if (isRemoteHttpUrl(raw)) {
    return uploadRemoteAsset(raw, fileName)
  }
  return raw
}

export const getImageDimensionsFromSource = (source) =>
  new Promise((resolve) => {
    const raw = String(source || '').trim()
    if (!raw) {
      resolve({ width: 0, height: 0 })
      return
    }

    const img = new Image()
    img.onload = () => {
      resolve({ width: img.naturalWidth || img.width || 0, height: img.naturalHeight || img.height || 0 })
    }
    img.onerror = () => {
      resolve({ width: 0, height: 0 })
    }
    if (!isDataImageUrl(raw)) {
      img.crossOrigin = 'anonymous'
    }
    img.src = raw
  })

export const isSora2AllowedReferenceSize = (width, height) =>
  SORA2_ALLOWED_REFERENCE_SIZES.includes(`${Number(width) || 0}x${Number(height) || 0}`)
