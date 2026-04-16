const REMOVED_NODE_TYPES = new Set(['model3d', 'model3dConfig'])

export const sanitizeCanvasData = (canvasData = {}) => {
  const nextCanvasData = canvasData && typeof canvasData === 'object'
    ? JSON.parse(JSON.stringify(canvasData))
    : {}
  const nodes = Array.isArray(nextCanvasData.nodes) ? nextCanvasData.nodes : []
  const edges = Array.isArray(nextCanvasData.edges) ? nextCanvasData.edges : []
  const removedIds = new Set(nodes.filter((node) => REMOVED_NODE_TYPES.has(node?.type)).map((node) => node.id))

  if (!removedIds.size) {
    return nextCanvasData
  }

  nextCanvasData.nodes = nodes.filter((node) => !removedIds.has(node.id))
  nextCanvasData.edges = edges.filter((edge) => !removedIds.has(edge.source) && !removedIds.has(edge.target))

  if (Array.isArray(nextCanvasData.groups)) {
    nextCanvasData.groups = nextCanvasData.groups
      .map((group) => ({
        ...group,
        nodeIds: Array.isArray(group.nodeIds)
          ? group.nodeIds.filter((nodeId) => !removedIds.has(nodeId))
          : []
      }))
      .filter((group) => group.nodeIds.length > 0)
  }

  return nextCanvasData
}
