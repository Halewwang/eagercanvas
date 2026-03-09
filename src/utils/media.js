import request from './request'

export const isDataImageUrl = (value = '') => /^data:image\//i.test(String(value || ''))

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

export const persistImageUrl = async (url, fileName = 'image.png') => {
  const raw = String(url || '').trim()
  if (!raw) return ''
  if (!isDataImageUrl(raw)) return raw
  const file = dataUrlToFile(raw, fileName)
  if (!file) return ''
  return uploadImageFile(file)
}
