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
  if (isZooming) return 'skip'
  return isDragging ? 'delayed' : 'raf'
}

export const getNodeCapsuleScale = (zoom = 1) => {
  const safeZoom = Math.max(Number(zoom) || 1, 0.01)
  return Math.min(1.06, Math.max(0.82, 1 / safeZoom))
}
