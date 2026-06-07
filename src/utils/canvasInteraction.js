import { getImageRatioFromDimensions as resolveImageRatioFromDimensions } from './imageDimensions.js'

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

export const getRectOverlapRatio = (subjectRect = null, containerRect = null) => {
  const subject = getRectBounds(subjectRect)
  const container = getRectBounds(containerRect)
  if (!subject || !container) return 0

  const overlapLeft = Math.max(subject.left, container.left)
  const overlapTop = Math.max(subject.top, container.top)
  const overlapRight = Math.min(subject.right, container.right)
  const overlapBottom = Math.min(subject.bottom, container.bottom)
  if (overlapRight <= overlapLeft || overlapBottom <= overlapTop) return 0

  const subjectArea = (subject.right - subject.left) * (subject.bottom - subject.top)
  if (subjectArea <= 0) return 0
  const overlapArea = (overlapRight - overlapLeft) * (overlapBottom - overlapTop)
  return overlapArea / subjectArea
}

export const getGroupMergeCandidate = ({
  nodeRect = null,
  groups = [],
  threshold = 0.5
} = {}) => {
  const safeThreshold = Math.max(Number(threshold) || 0, 0)
  let candidate = null
  let bestRatio = 0

  ;(Array.isArray(groups) ? groups : []).forEach((group) => {
    const ratio = getRectOverlapRatio(nodeRect, group?.rect)
    if (ratio < safeThreshold || ratio <= bestRatio) return
    candidate = group
    bestRatio = ratio
  })

  return candidate
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

export const getImageRatioFromDimensions = resolveImageRatioFromDimensions

export const getCanvasLibraryInsertPosition = ({
  viewport = {},
  shellSize = {},
  nodeCount = 0
} = {}) => {
  const shellWidth = Number(shellSize?.width)
  const shellHeight = Number(shellSize?.height)
  const width = shellWidth > 0 ? shellWidth : 1440
  const height = shellHeight > 0 ? shellHeight : 900
  const count = Math.max(Math.trunc(Number(nodeCount) || 0), 0)
  const flowPoint = getFlowPointFromScreenPoint({
    x: Math.round(width * 0.56),
    y: Math.round(height * 0.42)
  }, viewport)

  return {
    x: flowPoint.x - 140 + (count % 3) * 34,
    y: flowPoint.y - 100 + (count % 4) * 28
  }
}

export const getCanvasNodeGridPosition = ({
  origin = {},
  index = 0,
  columns = 2,
  gapX = 120,
  gapY = 132
} = {}) => {
  const safeIndex = Math.max(Math.trunc(Number(index) || 0), 0)
  const safeColumns = Math.max(Math.trunc(Number(columns) || 2), 1)
  const originX = Number(origin?.x) || 0
  const originY = Number(origin?.y) || 0

  return {
    x: originX + (safeIndex % safeColumns) * (Number(gapX) || 0),
    y: originY + Math.floor(safeIndex / safeColumns) * (Number(gapY) || 0)
  }
}

export const getConnectMenuEdgeParams = (context = null, createdNodeId = '') => {
  if (!context?.nodeId || !createdNodeId) return null

  if (context.handleType === 'source') {
    return {
      source: context.nodeId,
      target: createdNodeId,
      sourceHandle: context.handleId || 'right',
      targetHandle: 'left'
    }
  }

  return {
    source: createdNodeId,
    target: context.nodeId,
    sourceHandle: 'right',
    targetHandle: context.handleId || 'left'
  }
}

export const getLocalImageInjectPosition = ({ nodeCount = 0 } = {}) =>
  getCanvasNodeGridPosition({
    origin: { x: 220, y: 180 },
    index: Math.max(Math.trunc(Number(nodeCount) || 0), 0),
    columns: 3,
    gapX: 120,
    gapY: 60
  })

export const getGroupOutputImagePosition = ({
  groupRect = null,
  viewport = {},
  offsetX = 180,
  centerOffsetY = 120
} = {}) => {
  const rect = getRectBounds(groupRect)
  if (!rect) return getCanvasNodeGridPosition()

  return getFlowPointFromScreenPoint({
    x: rect.right + (Number(offsetX) || 0),
    y: rect.top + ((rect.bottom - rect.top) / 2) - (Number(centerOffsetY) || 0)
  }, viewport)
}

export const getGroupOutputImageDropPosition = ({
  point = null,
  viewport = {},
  centerOffsetY = 120
} = {}) => {
  const flowPoint = getFlowPointFromScreenPoint(point || {}, viewport)
  return {
    x: flowPoint.x,
    y: flowPoint.y - (Number(centerOffsetY) || 0)
  }
}

export const createLocalImageNodeData = ({
  dataUrl = '',
  file = {},
  dimensions = {}
} = {}) => {
  const width = Number(dimensions?.width || 0)
  const height = Number(dimensions?.height || 0)

  return {
    url: dataUrl,
    base64: dataUrl,
    fileName: file.name,
    fileType: file.type || 'image/png',
    label: 'Image',
    ratio: getImageRatioFromDimensions(width, height),
    size: width && height ? `${width}x${height}` : '',
    loading: false,
    error: ''
  }
}

export const getNodeCapsuleScale = (zoom = 1) => {
  const safeZoom = Math.max(Number(zoom) || 1, 0.01)
  return Math.min(1.06, Math.max(0.82, 1 / safeZoom))
}

const OVERLAY_PADDING_X = 24
const OVERLAY_PADDING_TOP = 22
const OVERLAY_PADDING_BOTTOM = 22
const NODE_SHELL_TOP_PADDING = 88
const CONFIG_NODE_TOP_PADDING = 20
const DEFAULT_NODE_SIZE = { width: 320, height: 240 }
const TEXT_NODE_SIZE = { width: 362, height: 330 }
const CONFIG_NODE_SIZES = {
  imageConfig: { width: 300, height: 240 },
  videoConfig: { width: 300, height: 330 },
  llmConfig: { width: 370, height: 300 }
}

const IMAGE_RATIO_SIZES = {
  '1:1': { width: 320, height: 320 },
  '3:2': { width: 360, height: 240 },
  '2:3': { width: 240, height: 360 },
  '16:9': { width: 420, height: 236 },
  '9:16': { width: 260, height: 462 },
  '4:3': { width: 360, height: 270 },
  '3:4': { width: 280, height: 373 },
  '4:5': { width: 280, height: 350 },
  '5:4': { width: 350, height: 280 },
  '21:9': { width: 420, height: 180 }
}

const VIDEO_RATIO_SIZES = {
  '16:9': { width: 420, height: 236 },
  '9:16': { width: 260, height: 462 },
  '7:4': { width: 420, height: 240 },
  '4:7': { width: 240, height: 420 },
  '4:3': { width: 360, height: 270 },
  '3:4': { width: 280, height: 373 },
  '1:1': { width: 320, height: 320 }
}

const parsePixelSize = (value) => {
  const parsed = Number.parseFloat(String(value || '').replace('px', ''))
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

const ratioFromSize = (sizeKey, fallback = '1:1') => {
  const [width, height] = String(sizeKey || '').split('x').map(Number)
  if (!width || !height) return fallback
  const ratio = width / height
  if (Math.abs(ratio - 1) < 0.03) return '1:1'
  if (Math.abs(ratio - 3 / 2) < 0.04) return '3:2'
  if (Math.abs(ratio - 2 / 3) < 0.04) return '2:3'
  if (Math.abs(ratio - 16 / 9) < 0.04) return '16:9'
  if (Math.abs(ratio - 9 / 16) < 0.04) return '9:16'
  if (Math.abs(ratio - 4 / 3) < 0.04) return '4:3'
  if (Math.abs(ratio - 3 / 4) < 0.04) return '3:4'
  if (Math.abs(ratio - 4 / 5) < 0.04) return '4:5'
  if (Math.abs(ratio - 5 / 4) < 0.04) return '5:4'
  return `${width}:${height}`
}

const fitCustomRatio = (ratio, maxWidth, maxHeight, fallbackSize) => {
  const [width, height] = String(ratio || '').split(':').map(Number)
  if (!width || !height) return fallbackSize
  const scale = Math.min(maxWidth / width, maxHeight / height)
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale)
  }
}

export const getMediaNodeStageSize = (node) => {
  const data = node?.data || {}
  if (node?.type === 'video') {
    const ratio = data.ratio || ratioFromSize(data.size, '16:9')
    return VIDEO_RATIO_SIZES[ratio] || VIDEO_RATIO_SIZES['16:9']
  }

  const ratio = data.ratio || ratioFromSize(data.size, '1:1')
  return IMAGE_RATIO_SIZES[ratio] || fitCustomRatio(ratio, 420, 462, IMAGE_RATIO_SIZES['1:1'])
}

export const getFallbackNodeSize = (node) => {
  if (node?.type === 'text') return TEXT_NODE_SIZE
  if (node?.type === 'image' || node?.type === 'video') {
    const stageSize = getMediaNodeStageSize(node)
    return {
      width: stageSize.width + 2,
      height: stageSize.height + NODE_SHELL_TOP_PADDING + 2
    }
  }
  if (CONFIG_NODE_SIZES[node?.type]) {
    const size = CONFIG_NODE_SIZES[node.type]
    return {
      width: size.width,
      height: size.height + CONFIG_NODE_TOP_PADDING
    }
  }
  return DEFAULT_NODE_SIZE
}

export const getNodeSize = (node) => {
  const candidates = [
    node?.dimensions,
    node?.measured,
    {
      width: node?.width,
      height: node?.height
    },
    {
      width: parsePixelSize(node?.style?.width),
      height: parsePixelSize(node?.style?.height)
    }
  ]

  const measured = candidates.find((item) => Number(item?.width) > 0 && Number(item?.height) > 0)
  if (measured) {
    return {
      width: Number(measured.width),
      height: Number(measured.height)
    }
  }

  return getFallbackNodeSize(node)
}

export const getNodePosition = (node) => {
  const position = node?.computedPosition || node?.positionAbsolute || node?.position || {}
  return {
    x: Number(position.x) || 0,
    y: Number(position.y) || 0
  }
}

export const getNodeViewportRect = (node, viewport = {}) => {
  if (!node) return null
  const zoom = Math.max(Number(viewport?.zoom) || 1, 0.01)
  const viewportX = Number(viewport?.x) || 0
  const viewportY = Number(viewport?.y) || 0
  const position = getNodePosition(node)
  const size = getNodeSize(node)
  const left = viewportX + position.x * zoom
  const top = viewportY + position.y * zoom
  const width = size.width * zoom
  const height = size.height * zoom

  return {
    left,
    top,
    right: left + width,
    bottom: top + height
  }
}

export const mergeViewportRects = (rects = []) => {
  if (!rects.length) return null
  const left = Math.min(...rects.map((rect) => rect.left)) - OVERLAY_PADDING_X
  const top = Math.min(...rects.map((rect) => rect.top)) - OVERLAY_PADDING_TOP
  const right = Math.max(...rects.map((rect) => rect.right)) + OVERLAY_PADDING_X
  const bottom = Math.max(...rects.map((rect) => rect.bottom)) + OVERLAY_PADDING_BOTTOM
  return {
    left,
    top,
    width: right - left,
    height: bottom - top
  }
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
