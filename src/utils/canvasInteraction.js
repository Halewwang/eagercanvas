export const INTERACTION_OVERLAY_DELAY_MS = 80
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

export const getInteractionOverlayDelay = ({ isInteracting = false } = {}) =>
  isInteracting ? INTERACTION_OVERLAY_DELAY_MS : 0

export const getOverlayScheduleMode = () => 'raf'

export const getGroupBoxPointerEvents = () => 'none'

const isPointInRect = (point = {}, rect = {}) => {
  const x = Number(point.x)
  const y = Number(point.y)
  const left = Number(rect.left)
  const top = Number(rect.top)
  const right = Number(rect.right ?? (left + Number(rect.width || 0)))
  const bottom = Number(rect.bottom ?? (top + Number(rect.height || 0)))

  return Number.isFinite(x) &&
    Number.isFinite(y) &&
    Number.isFinite(left) &&
    Number.isFinite(top) &&
    Number.isFinite(right) &&
    Number.isFinite(bottom) &&
    x >= left &&
    x <= right &&
    y >= top &&
    y <= bottom
}

export const shouldStartSelectedGroupBodyDrag = ({
  selected = false,
  point = null,
  groupRect = null,
  nodeRects = []
} = {}) => {
  if (!selected || !point || !groupRect) return false
  if (!isPointInRect(point, groupRect)) return false
  return !(Array.isArray(nodeRects) ? nodeRects : []).some((rect) => isPointInRect(point, rect))
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
