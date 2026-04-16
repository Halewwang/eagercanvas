export const MINIMAP_NODE_LIMIT = 120
export const INTERACTION_OVERLAY_DELAY_MS = 80

export const shouldRenderMinimap = ({
  isMobile = false,
  isInteracting = false,
  nodeCount = 0,
  nodeLimit = MINIMAP_NODE_LIMIT
} = {}) => {
  if (isMobile || isInteracting) return false
  return Number(nodeCount || 0) <= nodeLimit
}

export const getInteractionOverlayDelay = ({ isInteracting = false } = {}) =>
  isInteracting ? INTERACTION_OVERLAY_DELAY_MS : 0
