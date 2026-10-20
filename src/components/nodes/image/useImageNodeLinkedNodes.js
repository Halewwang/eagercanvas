import { getCanvasAutoPlacementPosition } from '@/utils/canvasInteraction'

const noop = () => {}

const readOption = (source) => {
  if (typeof source === 'function') return source()
  if (source && typeof source === 'object' && 'value' in source) return source.value
  return source
}

const writeOption = (source, value) => {
  if (source && typeof source === 'object' && 'value' in source) {
    source.value = value
  }
}

const getDefaultWindow = () => (typeof window === 'undefined' ? null : window)

export const useImageNodeLinkedNodes = ({
  addEdge = noop,
  addNode = () => null,
  buildCreateData = ({ payload = {}, defaults = {} } = {}) => ({ ...defaults, ...payload }),
  buildPosition = () => null,
  buildSelectionState = ({ nodes = [] } = {}) => nodes,
  buildUpdatePatch = ({ payload = {} } = {}) => payload,
  edgeStrategy = null,
  flushSave = async () => true,
  getDefaults = () => ({}),
  nodeId,
  nodes,
  setTimeoutFn = (callback, delay) => getDefaultWindow()?.setTimeout(callback, delay),
  stageStyle,
  updateNode = noop,
  updateNodeInternals = noop
} = {}) => {
  const readNodeId = () => readOption(nodeId)
  const readNodes = () => readOption(nodes) || []
  const readStageStyle = () => readOption(stageStyle) || {}
  const readDefaults = (targetNodeId = readNodeId()) => {
    const data = {
      ...readNodes().find(node => node.id === readNodeId())?.data,
      ...readNodes().find(node => node.id === targetNodeId)?.data
    }
    return {
      ...(readOption(getDefaults) || {}),
      ...Object.fromEntries(['generationRatio', 'generationResolution']
        .filter(key => data[key] !== undefined).map(key => [key, data[key]]))
    }
  }
  const resolveEdge = (edge) => (
    edgeStrategy?.resolve ? edgeStrategy.resolve(edge) : edge
  )
  const setNodes = (nextNodes) => {
    writeOption(nodes, nextNodes)
  }

  const createLinkedImageNode = (payload = {}) => {
    const sourceNodeId = readNodeId()
    const currentNode = readNodes().find((node) => node.id === sourceNodeId)
    if (!currentNode) return null

    const nextPosition = buildPosition({
      currentNode,
      stageWidth: readStageStyle().width
    })
    if (!nextPosition) return null

    const createData = buildCreateData({
      payload,
      defaults: readDefaults()
    })
    const placedPosition = getCanvasAutoPlacementPosition({
      preferredPosition: nextPosition,
      nodeType: 'image',
      nodeData: createData,
      existingNodes: readNodes()
    })
    const newNodeId = addNode('image', placedPosition, createData)

    addEdge(resolveEdge({
      source: sourceNodeId,
      target: newNodeId,
      sourceHandle: 'right',
      targetHandle: 'left'
    }))

    setNodes(buildSelectionState({
      nodes: readNodes(),
      selectedNodeId: newNodeId
    }))

    setTimeoutFn(() => {
      updateNodeInternals(sourceNodeId)
      updateNodeInternals(newNodeId)
    }, 60)

    return newNodeId
  }

  const updateLinkedImageNode = async (linkedNodeId, payload = {}) => {
    if (!linkedNodeId) return undefined
    updateNode(linkedNodeId, buildUpdatePatch({
      payload,
      defaults: readDefaults(linkedNodeId)
    }))
    setTimeoutFn(() => updateNodeInternals(linkedNodeId), 40)
    if (payload.loading) return true
    return flushSave()
  }

  return {
    createLinkedImageNode,
    updateLinkedImageNode
  }
}

export default useImageNodeLinkedNodes
