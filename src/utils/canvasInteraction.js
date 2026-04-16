export const MINIMAP_NODE_LIMIT = 120
export const INTERACTION_OVERLAY_DELAY_MS = 80

export const shouldRenderMinimap = ({
  isMobile = false,
  isInteracting = false,
  nodeCount = 0,
  nodeLimit = MINIMAP_NODE_LIMIT
} = {}) => {
  if (isMobile) return false
  return Number(nodeCount || 0) <= nodeLimit
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
