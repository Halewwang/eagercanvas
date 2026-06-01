export const createCanvasNode = ({
  id,
  type,
  position = { x: 100, y: 100 },
  defaultData = {},
  data = {},
  now = Date.now()
}) => ({
  id,
  type,
  position,
  data: {
    ...defaultData,
    ...data,
    createdAt: data.createdAt || now,
    updatedAt: data.updatedAt || now
  }
})

export const updateCanvasNodeData = (nodes = [], id, data = {}) =>
  nodes.map((node) => (node.id === id ? { ...node, data: { ...node.data, ...data } } : node))

export const removeCanvasNodeGraph = ({ nodes = [], edges = [], nodeIds = [] }) => {
  const nodeIdSet = new Set(nodeIds)

  return {
    nodes: nodes.filter((node) => !nodeIdSet.has(node.id)),
    edges: edges.filter((edge) => !nodeIdSet.has(edge.source) && !nodeIdSet.has(edge.target))
  }
}

export const duplicateCanvasNode = ({
  nodes = [],
  sourceId,
  newId,
  offset = { x: 50, y: 50 }
}) => {
  const sourceNode = nodes.find((node) => node.id === sourceId)
  if (!sourceNode) {
    return {
      nodes,
      duplicatedNode: null
    }
  }

  const maxZIndex = Math.max(0, ...nodes.map((node) => node.zIndex || 0))
  const duplicatedNode = {
    id: newId,
    type: sourceNode.type,
    position: {
      x: sourceNode.position.x + Number(offset?.x ?? 50),
      y: sourceNode.position.y + Number(offset?.y ?? 50)
    },
    data: { ...sourceNode.data },
    zIndex: maxZIndex + 1
  }

  return {
    nodes: [...nodes, duplicatedNode],
    duplicatedNode
  }
}
