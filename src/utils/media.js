import request from './request'
import { DEFAULT_API_BASE_URL, STORAGE_KEYS } from './constants'
import { getStoredValue } from './storage.js'

export const isDataImageUrl = (value = '') => /^data:image\//i.test(String(value || ''))
export const isDataUrl = (value = '') => /^data:/i.test(String(value || ''))
export const isRemoteHttpUrl = (value = '') => /^https?:\/\//i.test(String(value || ''))
export const isPersistedUploadUrl = (value = '') => String(value || '').includes('/storage/v1/object/public/uploads/')
export const isTransientRemoteMediaUrl = (value = '') => isRemoteHttpUrl(value) && !isPersistedUploadUrl(value)

const parseDateValue = (value = '') => {
  const raw = String(value || '').trim()
  if (!raw) return null

  if (/^\d+$/.test(raw)) {
    const numeric = Number(raw)
    if (!Number.isFinite(numeric) || numeric <= 0) return null
    return numeric > 1e12 ? numeric : numeric * 1000
  }

  if (/^\d{8}T\d{6}Z$/i.test(raw)) {
    const normalized = raw.replace(
      /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/i,
      '$1-$2-$3T$4:$5:$6Z'
    )
    const ts = Date.parse(normalized)
    return Number.isFinite(ts) ? ts : null
  }

  const ts = Date.parse(raw)
  return Number.isFinite(ts) ? ts : null
}

const getRemoteUrlExpiryMs = (value = '') => {
  const raw = String(value || '').trim()
  if (!isRemoteHttpUrl(raw)) return null

  let parsed
  try {
    parsed = new URL(raw)
  } catch {
    return null
  }

  const qSignTime = String(parsed.searchParams.get('q-sign-time') || '').trim()
  if (qSignTime.includes(';')) {
    const [, end] = qSignTime.split(';')
    const ts = parseDateValue(end)
    if (ts) return ts
  }

  const expiresAt = parseDateValue(
    parsed.searchParams.get('Expires')
    || parsed.searchParams.get('expires')
    || parsed.searchParams.get('se')
    || ''
  )
  if (expiresAt) return expiresAt

  const amzDate = parseDateValue(parsed.searchParams.get('X-Amz-Date') || '')
  const amzExpiresSeconds = Number(parsed.searchParams.get('X-Amz-Expires') || 0)
  if (amzDate && Number.isFinite(amzExpiresSeconds) && amzExpiresSeconds > 0) {
    return amzDate + amzExpiresSeconds * 1000
  }

  return null
}

export const isExpiredRemoteUrl = (value = '', now = Date.now()) => {
  if (!isRemoteHttpUrl(value) || isPersistedUploadUrl(value)) return false
  const expiryMs = getRemoteUrlExpiryMs(value)
  if (!expiryMs) return false
  return expiryMs <= now
}

const LEGACY_UPLOAD_FALLBACK_MAX_BYTES = 10 * 1024 * 1024

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

const uploadFileToSignedUrl = (signedUrl, file, onProgress) =>
  new Promise((resolve, reject) => {
    const rawSignedUrl = String(signedUrl || '').trim()
    if (!rawSignedUrl) {
      reject(new Error('Upload failed'))
      return
    }

    const xhr = new XMLHttpRequest()
    xhr.open('PUT', rawSignedUrl, true)
    xhr.setRequestHeader('x-upsert', 'false')
    if (file?.type) {
      xhr.setRequestHeader('content-type', file.type)
    }

    xhr.upload.onprogress = (event) => {
      if (typeof onProgress !== 'function') return
      const loaded = Number(event?.loaded || 0)
      const total = Number(event?.total || 0)
      if (!total) return
      const percent = Math.max(0, Math.min(100, Math.round((loaded / total) * 100)))
      onProgress(percent)
    }

    xhr.onerror = () => reject(new Error('Upload failed'))
    xhr.onabort = () => reject(new Error('Upload failed'))
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve()
        return
      }
      reject(new Error('Upload failed'))
    }

    xhr.send(file)
  })

const createSignedUpload = async (file) => {
  const response = await request.post('/upload/signed', {
    fileName: file?.name || 'asset',
    fileType: file?.type || 'application/octet-stream'
  }, {
    silentErrorToast: true,
    silentNetworkErrorToast: true
  })

  return {
    signedUrl: String(response?.signedUrl || '').trim(),
    url: String(response?.url || '').trim()
  }
}

const completeSignedUpload = async ({ url, file, projectId = '', source = '', sourceNodeId = '' }) => {
  const rawUrl = String(url || '').trim()
  if (!rawUrl) return ''

  try {
    await request.post('/upload/complete', {
      url: rawUrl,
      fileName: file?.name || 'asset',
      fileType: file?.type || 'application/octet-stream',
      sizeBytes: Number(file?.size || 0),
      projectId: projectId || undefined,
      source: source || undefined,
      sourceNodeId: sourceNodeId || undefined
    }, {
      silentErrorToast: true,
      silentNetworkErrorToast: true
    })
  } catch (error) {
    console.warn('Signed upload record failed:', error)
  }

  return rawUrl
}

export const uploadImageFile = async (file, options = {}) => {
  const { onProgress, projectId = '', source = '', sourceNodeId = '' } = options
  try {
    if (typeof onProgress === 'function') onProgress(2)
    const { signedUrl, url } = await createSignedUpload(file)
    if (typeof onProgress === 'function') onProgress(5)
    await uploadFileToSignedUrl(signedUrl, file, (percent) => {
      if (typeof onProgress !== 'function') return
      onProgress(Math.max(5, Math.min(98, percent)))
    })
    const uploadedUrl = await completeSignedUpload({
      url,
      file,
      projectId,
      source,
      sourceNodeId
    })
    if (typeof onProgress === 'function') onProgress(100)
    if (uploadedUrl) return uploadedUrl
  } catch (error) {
    console.warn('Signed upload failed, falling back to legacy upload:', error)
    if (Number(file?.size || 0) > LEGACY_UPLOAD_FALLBACK_MAX_BYTES) {
      throw error
    }
  }

  const formData = new FormData()
  formData.append('file', file, file?.name || 'asset')
  if (projectId) formData.append('projectId', projectId)
  if (source) formData.append('source', source)
  if (sourceNodeId) formData.append('sourceNodeId', sourceNodeId)

  const uploadRes = await request.post('/upload', formData, {
    onUploadProgress: (event) => {
      if (typeof onProgress !== 'function') return
      const loaded = Number(event?.loaded || 0)
      const total = Number(event?.total || 0)
      if (!total) return
      const percent = Math.max(0, Math.min(100, Math.round((loaded / total) * 100)))
      onProgress(percent)
    },
    silentErrorToast: true,
    silentNetworkErrorToast: true
  })

  const uploadedUrl = String(uploadRes?.url || '').trim()
  if (!uploadedUrl) {
    throw new Error('Upload failed')
  }
  return uploadedUrl
}

export const uploadRemoteAsset = async (url, fileName = '', options = {}) => {
  const { projectId = '', source = '', sourceNodeId = '' } = options
  const raw = String(url || '').trim()
  if (!raw) return ''
  const res = await request.post('/upload/remote', {
    url: raw,
    fileName: fileName || undefined,
    projectId: projectId || undefined,
    source: source || undefined,
    sourceNodeId: sourceNodeId || undefined
  }, {
    silentErrorToast: true,
    silentNetworkErrorToast: true
  })
  return String(res?.url || '').trim()
}

export const createAuthenticatedMediaProxyUrl = (url = '') => {
  const raw = String(url || '').trim()
  if (!raw || !isRemoteHttpUrl(raw) || typeof window === 'undefined') return raw
  if (isPersistedUploadUrl(raw)) return raw
  if (isExpiredRemoteUrl(raw)) return ''

  const accessToken = getStoredValue(STORAGE_KEYS.ACCESS_TOKEN)
  if (!accessToken) return raw

  const normalizedBaseUrl = /^https?:\/\//i.test(DEFAULT_API_BASE_URL)
    ? DEFAULT_API_BASE_URL
    : `${window.location.origin}${DEFAULT_API_BASE_URL.startsWith('/') ? DEFAULT_API_BASE_URL : `/${DEFAULT_API_BASE_URL}`}`

  const proxyUrl = new URL(`${normalizedBaseUrl.replace(/\/$/, '')}/upload/proxy`)
  proxyUrl.searchParams.set('url', raw)
  proxyUrl.searchParams.set('access_token', accessToken)
  return proxyUrl.toString()
}

export const persistImageUrl = async (url, fileName = 'image.png', options = {}) => {
  const raw = String(url || '').trim()
  if (!raw) return ''
  if (isPersistedUploadUrl(raw)) return raw
  if (isDataImageUrl(raw)) {
    const file = dataUrlToFile(raw, fileName)
    if (!file) return ''
    return uploadImageFile(file, options)
  }
  if (isRemoteHttpUrl(raw)) {
    return uploadRemoteAsset(raw, fileName, options)
  }
  return raw
}

export const persistMediaUrl = async (url, fileName = 'asset.bin', options = {}) => {
  const raw = String(url || '').trim()
  if (!raw) return ''
  if (isPersistedUploadUrl(raw)) return raw
  if (isDataUrl(raw)) {
    const file = dataUrlToFile(raw, fileName)
    if (!file) return ''
    return uploadImageFile(file, options)
  }
  if (isRemoteHttpUrl(raw)) {
    return uploadRemoteAsset(raw, fileName, options)
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
