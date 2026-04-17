export const MINIMAP_NODE_LIMIT = 120
export const INTERACTION_OVERLAY_DELAY_MS = 80
export const MINIMAP_INTERACTION_SNAPSHOT_INTERVAL_MS = 250
export const CANVAS_PERF_LOG_STORAGE_KEY = 'eager-canvas:perf'

const REMOTE_SYNC_CHANGE_TYPES = new Set([
  'content',
  'node-generated',
  'node-uploaded',
  'node-added',
  'node-removed',
  'edge-added',
  'edge-removed',
  'node-status'
])

export const shouldRenderMinimap = ({
  isMobile = false,
  isInteracting = false,
  nodeCount = 0,
  nodeLimit = MINIMAP_NODE_LIMIT
} = {}) => {
  if (isMobile) return false
  return true
}

export const getInteractionOverlayDelay = ({ isInteracting = false } = {}) =>
  isInteracting ? INTERACTION_OVERLAY_DELAY_MS : 0

export const getOverlayScheduleMode = ({
  isDragging = false,
  isZooming = false
} = {}) => {
  if (isZooming) return 'raf'
  return 'raf'
}

export const getNodeCapsuleScale = (zoom = 1) => {
  const safeZoom = Math.max(Number(zoom) || 1, 0.01)
  return Math.min(1.06, Math.max(0.82, 1 / safeZoom))
}

export const translateNodePositionsInPlace = (
  items = [],
  nodeIds = [],
  delta = {},
  options = {}
) => {
  const dx = Number(delta?.x || 0)
  const dy = Number(delta?.y || 0)
  if (!dx && !dy) return 0

  const ids = Array.from(new Set(nodeIds || []))
  if (!ids.length) return 0

  const lookup = options.lookup instanceof Map
    ? options.lookup
    : new Map((Array.isArray(items) ? items : []).map((node) => [node?.id, node]))

  let movedCount = 0
  ids.forEach((nodeId) => {
    const node = lookup.get(nodeId)
    if (!node) return

    const currentPosition = node.position || { x: 0, y: 0 }
    node.position = {
      ...currentPosition,
      x: (Number(currentPosition.x) || 0) + dx,
      y: (Number(currentPosition.y) || 0) + dy
    }
    movedCount += 1
  })

  return movedCount
}

export const shouldTriggerCanvasRemoteSync = (changeType = 'content') =>
  REMOTE_SYNC_CHANGE_TYPES.has(String(changeType || 'content'))

const stripRuntimeNodeFields = (node = {}) => {
  const {
    position,
    positionAbsolute,
    computedPosition,
    dimensions,
    measured,
    dragging,
    resizing,
    selected,
    ...rest
  } = node || {}

  return {
    ...rest,
    data: {
      ...(node.data || {}),
      selected: undefined,
      suppressCapsule: undefined,
      openPortMenu: undefined
    }
  }
}

export const createCanvasContentSnapshot = (canvasData = {}) => ({
  nodes: (Array.isArray(canvasData.nodes) ? canvasData.nodes : []).map(stripRuntimeNodeFields),
  edges: Array.isArray(canvasData.edges) ? canvasData.edges : [],
  groups: Array.isArray(canvasData.groups)
    ? canvasData.groups.map((group) => ({
        ...group,
        updatedAt: undefined
      }))
    : []
})

export const shouldScheduleMiniMapSnapshot = ({
  now = Date.now(),
  lastUpdatedAt = 0,
  isInteracting = false,
  intervalMs = MINIMAP_INTERACTION_SNAPSHOT_INTERVAL_MS
} = {}) => {
  if (!isInteracting) return true
  return Number(now || 0) - Number(lastUpdatedAt || 0) >= Number(intervalMs || 0)
}

export const isCanvasPerfLoggingEnabled = () => {
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.PROD) return false
  if (typeof localStorage === 'undefined') return false
  return localStorage.getItem(CANVAS_PERF_LOG_STORAGE_KEY) === '1'
}

export const recordCanvasPerf = (label, startedAt, details = {}) => {
  if (!isCanvasPerfLoggingEnabled()) return
  const endedAt = typeof performance !== 'undefined' ? performance.now() : Date.now()
  const durationMs = Math.round((endedAt - startedAt) * 100) / 100
  console.debug('[canvas-perf]', label, { durationMs, ...details })
}
