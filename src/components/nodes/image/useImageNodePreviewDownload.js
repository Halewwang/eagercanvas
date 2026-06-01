const getDefaultWindow = () => (typeof window === 'undefined' ? null : window)

const getDefaultDocument = () => (typeof document === 'undefined' ? null : document)

const getDefaultBaseUrl = () => getDefaultWindow()?.location?.origin || 'http://localhost'

const getDefaultFetch = async (...args) => {
  if (typeof fetch !== 'function') {
    throw new Error('Fetch is not available')
  }
  return fetch(...args)
}

const getDefaultObjectUrl = (blob) => URL.createObjectURL(blob)

const revokeDefaultObjectUrl = (url) => URL.revokeObjectURL(url)

const scheduleDefaultTimeout = (callback, delay) => getDefaultWindow()?.setTimeout?.(callback, delay)

const triggerBrowserDownload = (href, filename, doc = getDefaultDocument()) => {
  if (!doc?.body) return false

  const link = doc.createElement('a')
  link.href = href
  link.download = filename
  link.rel = 'noopener'
  link.target = '_blank'
  doc.body.appendChild(link)
  link.click()
  doc.body.removeChild(link)
  return true
}

export const getImageNodePreviewDownloadFilename = ({
  label,
  sourceUrl,
  baseUrl = getDefaultBaseUrl()
} = {}) => {
  const rawLabel = String(label || 'image-preview').trim()
  const safeLabel = rawLabel.replace(/[^a-zA-Z0-9-_]+/g, '-').replace(/^-+|-+$/g, '') || 'image-preview'
  let extension = 'png'

  try {
    const parsedSourceUrl = new URL(String(sourceUrl || ''), baseUrl)
    const match = parsedSourceUrl.pathname.match(/\.([a-zA-Z0-9]+)$/)
    if (match?.[1]) extension = match[1].toLowerCase()
  } catch {
    extension = 'png'
  }

  return `${safeLabel}.${extension}`
}

export const useImageNodePreviewDownload = ({
  createObjectUrl = getDefaultObjectUrl,
  fetchFn = getDefaultFetch,
  getBaseUrl = getDefaultBaseUrl,
  getLabel = () => '',
  getSourceUrl = () => '',
  revokeObjectUrl = revokeDefaultObjectUrl,
  setTimeoutFn = scheduleDefaultTimeout,
  triggerDownload = triggerBrowserDownload
} = {}) => {
  const getPreviewDownloadFilename = () => getImageNodePreviewDownloadFilename({
    label: getLabel(),
    sourceUrl: getSourceUrl(),
    baseUrl: getBaseUrl()
  })

  const downloadPreviewImage = async () => {
    const sourceUrl = String(getSourceUrl() || '').trim()
    if (!sourceUrl) return null

    const filename = getPreviewDownloadFilename()
    try {
      const response = await fetchFn(sourceUrl)
      if (!response?.ok) throw new Error(`Download failed: ${response?.status || 'unknown'}`)

      const blob = await response.blob()
      const objectUrl = createObjectUrl(blob)
      triggerDownload(objectUrl, filename)
      setTimeoutFn(() => revokeObjectUrl(objectUrl), 1000)
      return {
        filename,
        href: objectUrl,
        source: 'blob'
      }
    } catch {
      triggerDownload(sourceUrl, filename)
      return {
        filename,
        href: sourceUrl,
        source: 'fallback'
      }
    }
  }

  return {
    downloadPreviewImage,
    getPreviewDownloadFilename
  }
}
