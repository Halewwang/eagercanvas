import { cloneCanvasData } from './canvasClone.js'

const TRANSIENT_NODE_FIELDS = new Set([
  'base64',
  'previewUrl',
  'persistStatus',
  'persistError',
  'loading',
  'selected',
  'openPortMenu',
  'autoExecute'
])

const isEphemeralMediaUrl = (value) => {
  const raw = String(value || '').trim()
  return raw.startsWith('blob:') || /^data:/i.test(raw)
}

const isTransientRemoteMediaUrl = (value = '') => {
  const raw = String(value || '').trim()
  return /^https?:\/\//i.test(raw) && !raw.includes('/storage/v1/object/public/uploads/')
}

const sanitizePersistableMediaList = (value, { preserveTransientMedia = false } = {}) => {
  if (!Array.isArray(value)) return value
  return value
    .map((item) => String(item || '').trim())
    .filter((item) => {
      if (!item) return false
      if (preserveTransientMedia) return true
      if (isEphemeralMediaUrl(item)) return false
      if (isTransientRemoteMediaUrl(item)) return false
      return true
    })
}

const hasNodeUnpersistedMedia = (node) => {
  const base64 = String(node?.data?.base64 || '').trim()
  if (base64) return true
  const previewUrl = String(node?.data?.previewUrl || '').trim()
  if (previewUrl) return true
  const previewImageUrl = String(node?.data?.previewImageUrl || '').trim()
  if (previewImageUrl && (isEphemeralMediaUrl(previewImageUrl) || isTransientRemoteMediaUrl(previewImageUrl))) {
    return true
  }
  const sourceRefImages = Array.isArray(node?.data?.sourceRefImages) ? node.data.sourceRefImages : []
  if (sourceRefImages.some((value) => isEphemeralMediaUrl(value) || isTransientRemoteMediaUrl(value))) {
    return true
  }
  const assetUrls = node?.data?.assetUrls && typeof node.data.assetUrls === 'object'
    ? Object.values(node.data.assetUrls)
    : []
  if (assetUrls.some((value) => isEphemeralMediaUrl(value) || isTransientRemoteMediaUrl(value))) {
    return true
  }
  const url = String(node?.data?.url || '').trim()
  if (!url) return false
  if (isEphemeralMediaUrl(url)) return true
  return isTransientRemoteMediaUrl(url)
}

const sanitizeNodeForPersistence = (node, options = {}) => {
  const { preserveTransientMedia = false } = options
  const nextNode = cloneCanvasData(node)
  delete nextNode.selected
  delete nextNode.dragging
  delete nextNode.resizing

  const data = nextNode?.data
  if (data && typeof data === 'object') {
    Object.keys(data).forEach((key) => {
      if (TRANSIENT_NODE_FIELDS.has(key)) {
        delete data[key]
      }
    })

    if (!preserveTransientMedia && (isEphemeralMediaUrl(data.url) || isTransientRemoteMediaUrl(data.url))) {
      delete data.url
    }

    if (Array.isArray(data.sourceRefImages)) {
      data.sourceRefImages = sanitizePersistableMediaList(data.sourceRefImages, { preserveTransientMedia })
    }

    if (data.assetUrls && typeof data.assetUrls === 'object') {
      data.assetUrls = Object.fromEntries(
        Object.entries(data.assetUrls).filter(([_, value]) => {
          const raw = String(value || '').trim()
          if (!raw) return false
          if (preserveTransientMedia) return true
          return !isEphemeralMediaUrl(raw) && !isTransientRemoteMediaUrl(raw)
        })
      )
    }

    if (!preserveTransientMedia && (isEphemeralMediaUrl(data.previewImageUrl) || isTransientRemoteMediaUrl(data.previewImageUrl))) {
      delete data.previewImageUrl
    }
  }

  return nextNode
}

const sanitizeEdgeForPersistence = (edge) => {
  const nextEdge = cloneCanvasData(edge)
  delete nextEdge.selected
  delete nextEdge.updatable
  delete nextEdge.focusable
  return nextEdge
}

export const createCanvasSnapshot = ({ nodes = [], edges = [], groups = [], viewport = {} } = {}, options = {}) => ({
  nodes: Array.from(nodes, (node) => sanitizeNodeForPersistence(node, options)),
  edges: Array.from(edges, sanitizeEdgeForPersistence),
  groups: cloneCanvasData(groups),
  viewport: { ...viewport }
})

export const createCanvasPersistenceSnapshots = ({ nodes = [], edges = [], groups = [], viewport = {} } = {}) => {
  const localNodes = []
  const remoteNodes = []
  let containsTransientMedia = false

  for (const node of nodes) {
    containsTransientMedia = containsTransientMedia || hasNodeUnpersistedMedia(node)
    localNodes.push(sanitizeNodeForPersistence(node, { preserveTransientMedia: true }))
    remoteNodes.push(sanitizeNodeForPersistence(node))
  }

  const localEdges = []
  const remoteEdges = []
  for (const edge of edges) {
    localEdges.push(sanitizeEdgeForPersistence(edge))
    remoteEdges.push(sanitizeEdgeForPersistence(edge))
  }

  return {
    containsTransientMedia,
    localSnapshot: {
      nodes: localNodes,
      edges: localEdges,
      groups: cloneCanvasData(groups),
      viewport: { ...viewport }
    },
    remoteSnapshot: {
      nodes: remoteNodes,
      edges: remoteEdges,
      groups: cloneCanvasData(groups),
      viewport: { ...viewport }
    }
  }
}
