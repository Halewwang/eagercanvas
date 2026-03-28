import request from './request'
import { DEFAULT_API_BASE_URL, STORAGE_KEYS } from './constants'

const directUploadToSignedUrl = (signedUrl, file, options = {}) =>
  new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', signedUrl, true)
    xhr.responseType = 'json'

    if (typeof options.onProgress === 'function') {
      xhr.upload.onprogress = (event) => {
        const loaded = Number(event?.loaded || 0)
        const total = Number(event?.total || 0)
        if (!total) return
        const percent = Math.max(0, Math.min(100, Math.round((loaded / total) * 100)))
        options.onProgress(percent)
      }
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.response)
        return
      }
      const message = xhr.response?.error || xhr.response?.message || xhr.statusText || 'Signed upload failed'
      reject(new Error(message))
    }

    xhr.onerror = () => reject(new Error('Signed upload failed'))
    xhr.ontimeout = () => reject(new Error('Upload timed out'))
    xhr.timeout = 180000

    const formData = new FormData()
    formData.append('cacheControl', '3600')
    formData.append('', file, file.name || 'asset')
    xhr.send(formData)
  })

export const isDataImageUrl = (value = '') => /^data:image\//i.test(String(value || ''))
export const isDataUrl = (value = '') => /^data:/i.test(String(value || ''))
export const isRemoteHttpUrl = (value = '') => /^https?:\/\//i.test(String(value || ''))
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
  const signRes = await request.post('/upload/signed', {
    fileName: file?.name || 'asset',
    fileType: file?.type || 'application/octet-stream'
  }, {
    silentErrorToast: true,
    silentNetworkErrorToast: true
  })

  const signedUrl = String(signRes?.signedUrl || '').trim()
  const uploadedUrl = String(signRes?.url || '').trim()
  if (!signedUrl || !uploadedUrl) {
    throw new Error('Upload initialization failed')
  }

  await directUploadToSignedUrl(signedUrl, file, { onProgress })
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

export const createAuthenticatedMediaProxyUrl = (url = '') => {
  const raw = String(url || '').trim()
  if (!raw || !isRemoteHttpUrl(raw) || typeof window === 'undefined') return raw

  const accessToken = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN) || ''
  if (!accessToken) return raw

  const normalizedBaseUrl = /^https?:\/\//i.test(DEFAULT_API_BASE_URL)
    ? DEFAULT_API_BASE_URL
    : `${window.location.origin}${DEFAULT_API_BASE_URL.startsWith('/') ? DEFAULT_API_BASE_URL : `/${DEFAULT_API_BASE_URL}`}`

  const proxyUrl = new URL(`${normalizedBaseUrl.replace(/\/$/, '')}/upload/proxy`)
  proxyUrl.searchParams.set('url', raw)
  proxyUrl.searchParams.set('access_token', accessToken)
  return proxyUrl.toString()
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
