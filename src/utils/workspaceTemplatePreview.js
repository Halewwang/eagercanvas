import {
  getNodePosition as getCanvasNodePosition,
  getNodeSize as getCanvasNodeSize
} from './canvasInteraction.js'

const MIN_BOUNDS_WIDTH = 3000
const MIN_BOUNDS_HEIGHT = 1700

const toNumber = (value, fallback) => {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

const toPercent = (value) => `${Math.max(0, Math.min(100, value)).toFixed(2)}%`

const getNodes = (canvasData = {}) => {
  const nodes = Array.isArray(canvasData?.nodes) ? canvasData.nodes : []
  return nodes.filter((node) => node?.id)
}

const getNodeSize = (node = {}) => getCanvasNodeSize(node)

const getNodePosition = (node = {}) => getCanvasNodePosition(node)

const truncateText = (value, limit = 180) => {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  return text.length > limit ? `${text.slice(0, limit).trim()}...` : text
}

const getNodeLabel = (node = {}) => {
  const data = node.data || {}
  const raw = data.label || data.name || data.fileName || data.content || data.text || node.type || 'Node'
  return String(raw).trim().slice(0, 36) || 'Node'
}

const getNodeText = (node = {}) => {
  const data = node.data || {}
  return truncateText(data.content || data.outputContent || data.text || data.prompt || data.label || '')
}

const getNodeMediaUrl = (node = {}) => {
  const data = node.data || {}
  const candidates = [
    data.previewImageUrl,
    data.previewUrl,
    data.url,
    data.base64,
    data.imageUrl,
    data.generatedImageUrl,
    data.resultUrl,
    data.outputUrl,
    data.thumbnail,
    data.coverUrl,
    data.output?.url,
    data.output?.imageUrl,
    data.result?.url
  ]
  return String(candidates.find((value) => String(value || '').trim()) || '').trim()
}

const getNodeKind = (node = {}) => {
  const type = String(node.type || '').toLowerCase()
  if (type === 'image' || type === 'video') return 'media'
  if (type === 'text') return 'text'
  return 'config'
}

const getNodeGeometry = (node = {}) => {
  const position = getNodePosition(node)
  const size = getNodeSize(node)
  return {
    x: toNumber(position.x, 0),
    y: toNumber(position.y, 0),
    width: Math.max(toNumber(size.width, 1), 1),
    height: Math.max(toNumber(size.height, 1), 1)
  }
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
    const geometry = getNodeGeometry(node)
    minX = Math.min(minX, geometry.x)
    minY = Math.min(minY, geometry.y)
    maxX = Math.max(maxX, geometry.x + geometry.width)
    maxY = Math.max(maxY, geometry.y + geometry.height)
  }

  const contentWidth = Math.max(maxX - minX, 1)
  const contentHeight = Math.max(maxY - minY, 1)
  const rawWidth = Math.max(contentWidth, MIN_BOUNDS_WIDTH)
  const rawHeight = Math.max(contentHeight, MIN_BOUNDS_HEIGHT)
  const centerX = minX + contentWidth / 2
  const centerY = minY + contentHeight / 2
  const padX = Math.max(rawWidth * 0.12, 48)
  const padY = Math.max(rawHeight * 0.12, 36)

  return {
    x: centerX - rawWidth / 2 - padX,
    y: centerY - rawHeight / 2 - padY,
    width: rawWidth + padX * 2,
    height: rawHeight + padY * 2
  }
}

export const getWorkspaceTemplatePreviewNodes = (canvasData = {}) => {
  const bounds = getWorkspaceTemplatePreviewBounds(canvasData)
  const nodes = getNodes(canvasData)

  return nodes.map((node) => {
    const geometry = getNodeGeometry(node)
    const kind = getNodeKind(node)
    return {
      id: node.id,
      type: String(node.type || 'node').trim() || 'node',
      kind,
      label: getNodeLabel(node),
      text: getNodeText(node),
      mediaUrl: getNodeMediaUrl(node),
      style: {
        left: toPercent(((geometry.x - bounds.x) / bounds.width) * 100),
        top: toPercent(((geometry.y - bounds.y) / bounds.height) * 100),
        width: toPercent((geometry.width / bounds.width) * 100),
        height: toPercent((geometry.height / bounds.height) * 100)
      }
    }
  })
}

const getEdges = (canvasData = {}) => {
  const edges = Array.isArray(canvasData?.edges) ? canvasData.edges : []
  return edges.filter((edge) => edge?.source && edge?.target)
}

const toViewBoxCoord = (value) => Number(Math.max(0, Math.min(100, value)).toFixed(2))

const toViewBoxPoint = ({ x, y } = {}, bounds = {}) => ({
  x: toViewBoxCoord(((x - bounds.x) / bounds.width) * 100),
  y: toViewBoxCoord(((y - bounds.y) / bounds.height) * 100)
})

export const getWorkspaceTemplatePreviewEdges = (canvasData = {}) => {
  const bounds = getWorkspaceTemplatePreviewBounds(canvasData)
  const nodeGeometryById = new Map(getNodes(canvasData).map((node) => [node.id, getNodeGeometry(node)]))

  return getEdges(canvasData).map((edge) => {
    const source = nodeGeometryById.get(edge.source)
    const target = nodeGeometryById.get(edge.target)
    if (!source || !target) return null

    const sourceCenterX = source.x + source.width / 2
    const targetCenterX = target.x + target.width / 2
    const targetIsRight = targetCenterX >= sourceCenterX
    const sourcePoint = toViewBoxPoint({
      x: targetIsRight ? source.x + source.width : source.x,
      y: source.y + source.height / 2
    }, bounds)
    const targetPoint = toViewBoxPoint({
      x: targetIsRight ? target.x : target.x + target.width,
      y: target.y + target.height / 2
    }, bounds)
    const handleOffset = Math.max(4, Math.min(16, Math.abs(targetPoint.x - sourcePoint.x) * 0.45))
    const sourceHandleX = targetIsRight
      ? sourcePoint.x + handleOffset
      : sourcePoint.x - handleOffset
    const targetHandleX = targetIsRight
      ? targetPoint.x - handleOffset
      : targetPoint.x + handleOffset

    return {
      id: edge.id || `${edge.source}-${edge.target}`,
      path: [
        `M ${sourcePoint.x} ${sourcePoint.y}`,
        `C ${toViewBoxCoord(sourceHandleX)} ${sourcePoint.y}`,
        `${toViewBoxCoord(targetHandleX)} ${targetPoint.y}`,
        `${targetPoint.x} ${targetPoint.y}`
      ].join(' '),
      sourceDot: { cx: sourcePoint.x, cy: sourcePoint.y },
      targetDot: { cx: targetPoint.x, cy: targetPoint.y }
    }
  }).filter(Boolean)
}
