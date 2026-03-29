import { uploadRemoteFile } from './upload.service.js'

const MODEL_NODE_TYPES = new Set(['model3d', 'model3dConfig'])
const MODEL_VIEWER_TYPES = ['glb', 'obj']

const cloneJson = (value) => JSON.parse(JSON.stringify(value ?? {}))

const createEmptyStats = () => ({
  nodesVisited: 0,
  nodesChanged: 0,
  persistedUrls: 0,
  droppedExpiredUrls: 0
})

const mergeStats = (target, source) => {
  Object.keys(target).forEach((key) => {
    target[key] += Number(source?.[key] || 0)
  })
}

export const isRemoteHttpUrl = (value = '') => /^https?:\/\//i.test(String(value || '').trim())
export const isPersistedUploadUrl = (value = '') => String(value || '').includes('/storage/v1/object/public/uploads/')

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

const buildAssetFileName = (type = 'bin') => `model3d-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${type || 'bin'}`
const buildPreviewFileName = () => `model3d-preview-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`

const sanitizeModelAssetUrls = (assetUrls = {}, now = Date.now()) => {
  const nextAssetUrls = {}
  let droppedExpiredUrls = 0

  Object.entries(assetUrls || {}).forEach(([type, url]) => {
    const raw = String(url || '').trim()
    if (!raw) return
    if (!isRemoteHttpUrl(raw) || isPersistedUploadUrl(raw) || !isExpiredRemoteUrl(raw, now)) {
      nextAssetUrls[type] = raw
      return
    }
    droppedExpiredUrls += 1
  })

  return { assetUrls: nextAssetUrls, droppedExpiredUrls }
}

const sanitizePreviewImageUrl = (value = '', now = Date.now()) => {
  const raw = String(value || '').trim()
  if (!raw) return { previewImageUrl: '', droppedExpiredUrls: 0 }
  if (!isRemoteHttpUrl(raw) || isPersistedUploadUrl(raw) || !isExpiredRemoteUrl(raw, now)) {
    return { previewImageUrl: raw, droppedExpiredUrls: 0 }
  }
  return { previewImageUrl: '', droppedExpiredUrls: 1 }
}

const resolveModelViewerUrl = (assetUrls = {}, fallbackUrl = '') => {
  const directUrl = String(fallbackUrl || '').trim()
  if (/\.glb($|\?)/i.test(directUrl) || /\.obj($|\?)/i.test(directUrl)) {
    return directUrl
  }

  return MODEL_VIEWER_TYPES
    .map((type) => String(assetUrls?.[type] || '').trim())
    .find(Boolean) || ''
}

const persistRemoteUrl = async (url, fileName) => {
  const raw = String(url || '').trim()
  if (!raw || !isRemoteHttpUrl(raw) || isPersistedUploadUrl(raw)) return raw
  const result = await uploadRemoteFile({ url: raw, fileName })
  return String(result?.url || '').trim() || raw
}

const cleanupSingle3DNodeData = async (data = {}, options = {}) => {
  const now = Number(options.now || Date.now())
  const persistRemote = options.persistRemote !== false
  const stats = createEmptyStats()
  stats.nodesVisited = 1

  const sourceData = cloneJson(data || {})
  const sourceAssetUrls = Object.fromEntries(
    Object.entries(sourceData.assetUrls || {})
      .filter(([_, url]) => String(url || '').trim())
  )

  const { assetUrls: sanitizedAssetUrls, droppedExpiredUrls: droppedAssetUrls } = sanitizeModelAssetUrls(sourceAssetUrls, now)
  let nextAssetUrls = { ...sanitizedAssetUrls }
  stats.droppedExpiredUrls += droppedAssetUrls

  const rawDirectUrl = String(sourceData.url || '').trim()
  const directUrlAllowed = rawDirectUrl
    && (!isRemoteHttpUrl(rawDirectUrl) || isPersistedUploadUrl(rawDirectUrl) || !isExpiredRemoteUrl(rawDirectUrl, now))

  if (rawDirectUrl && !directUrlAllowed) {
    stats.droppedExpiredUrls += 1
  }

  const safeDirectUrl = directUrlAllowed ? rawDirectUrl : ''
  if (safeDirectUrl) {
    if (/\.glb($|\?)/i.test(safeDirectUrl) && !nextAssetUrls.glb) {
      nextAssetUrls.glb = safeDirectUrl
    } else if (/\.obj($|\?)/i.test(safeDirectUrl) && !nextAssetUrls.obj) {
      nextAssetUrls.obj = safeDirectUrl
    }
  }

  const { previewImageUrl: sanitizedPreviewImageUrl, droppedExpiredUrls: droppedPreviewUrls } = sanitizePreviewImageUrl(
    sourceData.previewImageUrl,
    now
  )
  let nextPreviewImageUrl = sanitizedPreviewImageUrl
  stats.droppedExpiredUrls += droppedPreviewUrls

  if (persistRemote) {
    const persistedAssetUrls = { ...nextAssetUrls }
    for (const [type, url] of Object.entries(nextAssetUrls)) {
      const raw = String(url || '').trim()
      if (!raw || !isRemoteHttpUrl(raw) || isPersistedUploadUrl(raw)) continue
      try {
        const persistedUrl = await persistRemoteUrl(raw, buildAssetFileName(type))
        if (persistedUrl && persistedUrl !== raw) {
          persistedAssetUrls[type] = persistedUrl
          stats.persistedUrls += 1
        }
      } catch {
        // Keep the original non-expired remote URL for best-effort compatibility.
      }
    }
    nextAssetUrls = persistedAssetUrls

    if (nextPreviewImageUrl && isRemoteHttpUrl(nextPreviewImageUrl) && !isPersistedUploadUrl(nextPreviewImageUrl)) {
      try {
        const persistedPreviewImageUrl = await persistRemoteUrl(nextPreviewImageUrl, buildPreviewFileName())
        if (persistedPreviewImageUrl && persistedPreviewImageUrl !== nextPreviewImageUrl) {
          nextPreviewImageUrl = persistedPreviewImageUrl
          stats.persistedUrls += 1
        }
      } catch {
        // Keep the original non-expired remote preview URL for best-effort compatibility.
      }
    }
  }

  const nextViewerUrl = resolveModelViewerUrl(nextAssetUrls, safeDirectUrl)
  const nextData = {
    ...sourceData,
    url: nextViewerUrl,
    previewImageUrl: nextPreviewImageUrl,
    assetUrls: nextAssetUrls
  }

  const changed = (
    nextViewerUrl !== rawDirectUrl
    || nextPreviewImageUrl !== String(sourceData.previewImageUrl || '').trim()
    || JSON.stringify(nextAssetUrls) !== JSON.stringify(sourceAssetUrls)
  )

  if (changed) {
    stats.nodesChanged = 1
  }

  return {
    changed,
    data: nextData,
    stats
  }
}

export const cleanupCanvas3DAssets = async (canvasData = {}, options = {}) => {
  const nextCanvasData = cloneJson(canvasData || {})
  const nextNodes = Array.isArray(nextCanvasData.nodes) ? [...nextCanvasData.nodes] : []
  const stats = createEmptyStats()
  let changed = false

  for (let index = 0; index < nextNodes.length; index += 1) {
    const node = nextNodes[index]
    if (!MODEL_NODE_TYPES.has(String(node?.type || ''))) continue
    if (!node?.data || typeof node.data !== 'object') continue

    const result = await cleanupSingle3DNodeData(node.data, options)
    mergeStats(stats, result.stats)

    if (!result.changed) continue
    changed = true
    nextNodes[index] = {
      ...node,
      data: result.data
    }
  }

  nextCanvasData.nodes = nextNodes
  return {
    changed,
    canvasData: nextCanvasData,
    stats
  }
}
