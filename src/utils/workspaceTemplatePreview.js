const DEFAULT_NODE_WIDTH = 180
const DEFAULT_NODE_HEIGHT = 96
const MIN_BOUNDS_WIDTH = 360
const MIN_BOUNDS_HEIGHT = 220

const toNumber = (value, fallback) => {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

const toPercent = (value) => `${Math.max(0, Math.min(100, value)).toFixed(2)}%`

const getNodes = (canvasData = {}) => {
  const nodes = Array.isArray(canvasData?.nodes) ? canvasData.nodes : []
  return nodes.filter((node) => node?.id)
}

const getNodeSize = (node = {}) => ({
  width: toNumber(node.width || node.measured?.width || node.data?.width, DEFAULT_NODE_WIDTH),
  height: toNumber(node.height || node.measured?.height || node.data?.height, DEFAULT_NODE_HEIGHT)
})

const getNodePosition = (node = {}) => ({
  x: toNumber(node.position?.x, 0),
  y: toNumber(node.position?.y, 0)
})

const getNodeLabel = (node = {}) => {
  const data = node.data || {}
  const raw = data.label || data.text || data.fileName || data.name || node.type || 'Node'
  return String(raw).trim().slice(0, 36) || 'Node'
}

export const getWorkspaceTemplateNodeCount = (canvasData = {}) => getNodes(canvasData).length

export const getWorkspaceTemplatePreviewBounds = (canvasData = {}) => {
  const nodes = getNodes(canvasData)
  if (nodes.length === 0) {
    return { x: 0, y: 0, width: MIN_BOUNDS_WIDTH, height: MIN_BOUNDS_HEIGHT }
  }

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const node of nodes) {
    const position = getNodePosition(node)
    const size = getNodeSize(node)
    minX = Math.min(minX, position.x)
    minY = Math.min(minY, position.y)
    maxX = Math.max(maxX, position.x + size.width)
    maxY = Math.max(maxY, position.y + size.height)
  }

  const rawWidth = Math.max(maxX - minX, MIN_BOUNDS_WIDTH)
  const rawHeight = Math.max(maxY - minY, MIN_BOUNDS_HEIGHT)
  const padX = Math.max(rawWidth * 0.12, 48)
  const padY = Math.max(rawHeight * 0.12, 36)

  return {
    x: minX - padX,
    y: minY - padY,
    width: rawWidth + padX * 2,
    height: rawHeight + padY * 2
  }
}

export const getWorkspaceTemplatePreviewNodes = (canvasData = {}) => {
  const bounds = getWorkspaceTemplatePreviewBounds(canvasData)
  const nodes = getNodes(canvasData)

  return nodes.map((node) => {
    const position = getNodePosition(node)
    const size = getNodeSize(node)
    return {
      id: node.id,
      type: String(node.type || 'node').trim() || 'node',
      label: getNodeLabel(node),
      style: {
        left: toPercent(((position.x - bounds.x) / bounds.width) * 100),
        top: toPercent(((position.y - bounds.y) / bounds.height) * 100),
        width: toPercent((size.width / bounds.width) * 100),
        height: toPercent((size.height / bounds.height) * 100)
      }
    }
  })
}
