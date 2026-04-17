export const IMAGE_PREVIEW_MAX_EDGE = 960
export const IMAGE_PREVIEW_CACHE_DB = 'eager-canvas-image-previews'
export const IMAGE_PREVIEW_CACHE_STORE = 'previews'

const clone = (value) => JSON.parse(JSON.stringify(value))

export const getImagePreviewCacheKey = (source = '') => String(source || '').trim()

export const resolveImageNodeDisplaySource = ({
  originalUrl = '',
  cachedPreviewUrl = ''
} = {}) => {
  const fullUrl = String(originalUrl || '').trim()
  const previewUrl = String(cachedPreviewUrl || '').trim()
  return {
    canvasUrl: previewUrl || fullUrl,
    fullUrl
  }
}

export const shouldGenerateImagePreview = ({
  originalUrl = '',
  cachedPreviewUrl = '',
  isInteracting = false
} = {}) => {
  if (isInteracting) return false
  if (String(cachedPreviewUrl || '').trim()) return false
  return !!String(originalUrl || '').trim()
}

export const createMemoryImagePreviewDriver = () => {
  const records = new Map()
  return {
    async get(key) {
      return records.has(key) ? clone(records.get(key)) : null
    },
    async set(key, record) {
      records.set(key, clone(record))
      return true
    },
    async delete(key) {
      records.delete(key)
    }
  }
}

const requestToPromise = (request) => new Promise((resolve, reject) => {
  request.onsuccess = () => resolve(request.result)
  request.onerror = () => reject(request.error)
})

const transactionDone = (transaction) => new Promise((resolve, reject) => {
  transaction.oncomplete = () => resolve()
  transaction.onerror = () => reject(transaction.error)
  transaction.onabort = () => reject(transaction.error)
})

export const createIndexedDBImagePreviewDriver = ({ indexedDBRef = globalThis.indexedDB } = {}) => {
  let dbPromise = null
  const open = () => {
    if (!indexedDBRef) return Promise.reject(new Error('IndexedDB is not available'))
    if (dbPromise) return dbPromise
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDBRef.open(IMAGE_PREVIEW_CACHE_DB, 1)
      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains(IMAGE_PREVIEW_CACHE_STORE)) {
          db.createObjectStore(IMAGE_PREVIEW_CACHE_STORE)
        }
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    return dbPromise
  }

  return {
    async get(key) {
      const db = await open()
      const tx = db.transaction(IMAGE_PREVIEW_CACHE_STORE, 'readonly')
      const value = await requestToPromise(tx.objectStore(IMAGE_PREVIEW_CACHE_STORE).get(key))
      await transactionDone(tx)
      return value || null
    },
    async set(key, record) {
      const db = await open()
      const tx = db.transaction(IMAGE_PREVIEW_CACHE_STORE, 'readwrite')
      tx.objectStore(IMAGE_PREVIEW_CACHE_STORE).put(record, key)
      await transactionDone(tx)
      return true
    },
    async delete(key) {
      const db = await open()
      const tx = db.transaction(IMAGE_PREVIEW_CACHE_STORE, 'readwrite')
      tx.objectStore(IMAGE_PREVIEW_CACHE_STORE).delete(key)
      await transactionDone(tx)
    }
  }
}

let imagePreviewDriver = null

export const getImagePreviewDriver = () => {
  if (!imagePreviewDriver) {
    imagePreviewDriver = createIndexedDBImagePreviewDriver()
  }
  return imagePreviewDriver
}

export const setImagePreviewDriverForTests = (driver) => {
  imagePreviewDriver = driver
}

const loadImage = (source) => new Promise((resolve, reject) => {
  const img = new Image()
  img.onload = () => resolve(img)
  img.onerror = () => reject(new Error('Image preview load failed'))
  if (/^https?:\/\//i.test(String(source || ''))) {
    img.crossOrigin = 'anonymous'
  }
  img.src = source
})

export const generateImagePreviewDataUrl = async (source, options = {}) => {
  const raw = String(source || '').trim()
  if (!raw || typeof document === 'undefined') return ''
  const maxEdge = Number(options.maxEdge || IMAGE_PREVIEW_MAX_EDGE)
  const image = await loadImage(raw)
  const naturalWidth = Number(image.naturalWidth || image.width || 0)
  const naturalHeight = Number(image.naturalHeight || image.height || 0)
  if (!naturalWidth || !naturalHeight) return ''

  const scale = Math.min(1, maxEdge / Math.max(naturalWidth, naturalHeight))
  const width = Math.max(1, Math.round(naturalWidth * scale))
  const height = Math.max(1, Math.round(naturalHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  ctx.drawImage(image, 0, 0, width, height)
  return canvas.toDataURL('image/webp', 0.72)
}

export const loadCachedImagePreview = async (source, driver = getImagePreviewDriver()) => {
  const key = getImagePreviewCacheKey(source)
  if (!key) return null
  return driver.get(key)
}

export const saveCachedImagePreview = async (source, previewUrl, driver = getImagePreviewDriver()) => {
  const key = getImagePreviewCacheKey(source)
  const safePreviewUrl = String(previewUrl || '').trim()
  if (!key || !safePreviewUrl) return false
  return driver.set(key, {
    previewUrl: safePreviewUrl,
    sourceUrl: key,
    updatedAt: new Date().toISOString()
  })
}
