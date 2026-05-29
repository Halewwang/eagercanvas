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

export const getSelectedGroupGripPointerAction = () => 'drag'

export const getGroupDragListenerNames = () => ({
  move: ['pointermove', 'mousemove'],
  end: ['pointerup', 'mouseup'],
  cancel: ['pointercancel']
})

export const shouldAcceptGroupDragMove = ({
  activePointerId = null,
  eventType = '',
  eventPointerId = null
} = {}) => {
  if (activePointerId === null || activePointerId === undefined) return true
  if (!String(eventType || '').startsWith('pointer')) return true
  return eventPointerId === activePointerId
}

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

const getRectBounds = (rect = {}) => {
  const left = Number(rect?.left)
  const top = Number(rect?.top)
  const right = Number(rect?.right ?? (left + Number(rect?.width || 0)))
  const bottom = Number(rect?.bottom ?? (top + Number(rect?.height || 0)))

  if (
    !Number.isFinite(left) ||
    !Number.isFinite(top) ||
    !Number.isFinite(right) ||
    !Number.isFinite(bottom) ||
    right <= left ||
    bottom <= top
  ) {
    return null
  }

  return { left, top, right, bottom }
}

const subtractYInterval = (intervals, blocker) => intervals.flatMap((interval) => {
  const top = Math.max(interval.top, blocker.top)
  const bottom = Math.min(interval.bottom, blocker.bottom)
  if (bottom <= top) return [interval]

  return [
    { top: interval.top, bottom: top },
    { top: bottom, bottom: interval.bottom }
  ].filter((item) => item.bottom > item.top)
})

export const getGroupBodyHitRects = ({
  groupRect = null,
  nodeRects = [],
  minSize = 2
} = {}) => {
  const groupBounds = getRectBounds(groupRect)
  if (!groupBounds) return []

  const clippedNodeRects = (Array.isArray(nodeRects) ? nodeRects : [])
    .map(getRectBounds)
    .filter(Boolean)
    .map((rect) => ({
      left: Math.max(groupBounds.left, rect.left),
      top: Math.max(groupBounds.top, rect.top),
      right: Math.min(groupBounds.right, rect.right),
      bottom: Math.min(groupBounds.bottom, rect.bottom)
    }))
    .filter((rect) => rect.right > rect.left && rect.bottom > rect.top)

  const xBreaks = Array.from(new Set([
    groupBounds.left,
    groupBounds.right,
    ...clippedNodeRects.flatMap((rect) => [rect.left, rect.right])
  ])).sort((a, b) => a - b)

  const safeMinSize = Math.max(Number(minSize) || 0, 0)
  const hitRects = []
  for (let index = 0; index < xBreaks.length - 1; index += 1) {
    const left = xBreaks[index]
    const right = xBreaks[index + 1]
    const width = right - left
    if (width < safeMinSize) continue

    const blockers = clippedNodeRects.filter((rect) => rect.left < right && rect.right > left)
    const freeYIntervals = blockers.reduce(
      (intervals, rect) => subtractYInterval(intervals, rect),
      [{ top: groupBounds.top, bottom: groupBounds.bottom }]
    )

    freeYIntervals.forEach((interval) => {
      const height = interval.bottom - interval.top
      if (height < safeMinSize) return
      hitRects.push({
        left: left - groupBounds.left,
        top: interval.top - groupBounds.top,
        width,
        height
      })
    })
  }

  return hitRects
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

export const findGroupBodyDragTarget = ({
  groups = [],
  groupRects = {},
  nodeRectsByGroup = {},
  point = null
} = {}) => {
  if (!point) return null

  const safeGroups = Array.isArray(groups) ? groups : []
  for (let index = safeGroups.length - 1; index >= 0; index -= 1) {
    const group = safeGroups[index]
    const rect = groupRects?.[group?.id]
    if (!isPointInRect(point, rect)) continue

    const nodeRects = Array.isArray(nodeRectsByGroup?.[group.id])
      ? nodeRectsByGroup[group.id]
      : []
    if (nodeRects.some((nodeRect) => isPointInRect(point, nodeRect))) continue

    return group
  }

  return null
}

export const getFlowPointFromScreenPoint = (point = {}, viewport = {}) => {
  const zoom = Math.max(Number(viewport?.zoom) || 1, 0.01)
  const viewportX = Number(viewport?.x) || 0
  const viewportY = Number(viewport?.y) || 0
  return {
    x: -(viewportX / zoom) + (Number(point?.x) || 0) / zoom,
    y: -(viewportY / zoom) + (Number(point?.y) || 0) / zoom
  }
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

export const translateNodePositions = (
  items = [],
  nodeIds = [],
  delta = {}
) => {
  const dx = Number(delta?.x || 0)
  const dy = Number(delta?.y || 0)
  if (!dx && !dy) return { items, movedCount: 0 }

  const ids = new Set(nodeIds || [])
  if (!ids.size) return { items, movedCount: 0 }

  let movedCount = 0
  const nextItems = (Array.isArray(items) ? items : []).map((node) => {
    if (!node?.id || !ids.has(node.id)) return node

    const currentPosition = node.position || { x: 0, y: 0 }
    movedCount += 1
    return {
      ...node,
      position: {
        ...currentPosition,
        x: (Number(currentPosition.x) || 0) + dx,
        y: (Number(currentPosition.y) || 0) + dy
      }
    }
  })

  return {
    items: movedCount ? nextItems : items,
    movedCount
  }
}

export const translateViewportRect = (rect = null, delta = {}) => {
  const left = Number(rect?.left)
  const top = Number(rect?.top)
  const width = Number(rect?.width)
  const height = Number(rect?.height)
  if (
    !Number.isFinite(left) ||
    !Number.isFinite(top) ||
    !Number.isFinite(width) ||
    !Number.isFinite(height)
  ) {
    return null
  }

  return {
    left: left + (Number(delta?.x) || 0),
    top: top + (Number(delta?.y) || 0),
    width,
    height
  }
}

export const shouldMeasureGroupRects = ({
  isGroupDragging = false,
  force = false
} = {}) => force || !isGroupDragging

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
