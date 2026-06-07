import { nextTick } from 'vue'

export const useCanvasNodeDragInteraction = ({
  groups,
  selectedNodeIds,
  isNodeDragging,
  beginNodeDragInteraction = () => {},
  endNodeDragInteraction = () => {},
  refreshCanvasCollectionRefs = () => {},
  getGroupMergeCandidateForNode = () => null,
  setGroupMergeCandidateId = () => {},
  addNodesToGroup = () => false,
  syncNodeSelectedState = () => {},
  clearGroupSelection = () => {},
  scheduleOverlayRectUpdate = () => {}
} = {}) => {
  let nodeDragMoved = false
  let draggedNodeId = ''
  let draggedNodeGroupId = ''
  let groupMergeCandidateId = null

  const getNodeIdFromDragArgs = (...args) => {
    for (const arg of args) {
      const nodeId = arg?.id || arg?.node?.id || arg?.item?.id
      if (nodeId) return nodeId
    }
    return ''
  }

  const findGroupByNodeId = (nodeId) => {
    if (!nodeId) return null
    return groups?.value?.find((group) => (group.nodeIds || []).includes(nodeId)) || null
  }

  const updateDraggedNodeGroup = (nodeId) => {
    draggedNodeGroupId = findGroupByNodeId(nodeId)?.id || ''
  }

  const onNodeDragStart = (...args) => {
    const nodeId = getNodeIdFromDragArgs(...args)
    nodeDragMoved = false
    draggedNodeId = nodeId
    updateDraggedNodeGroup(nodeId)
    groupMergeCandidateId = null
    if (!draggedNodeGroupId) {
      setGroupMergeCandidateId(null)
    }
    beginNodeDragInteraction()
  }

  const onNodeDragStop = () => {
    const didMerge = !draggedNodeGroupId && groupMergeCandidateId && draggedNodeId
      ? !!addNodesToGroup(groupMergeCandidateId, [draggedNodeId], { saveHistory: false })
      : false
    if (groupMergeCandidateId) {
      setGroupMergeCandidateId(null)
    }
    endNodeDragInteraction({
      saveHistory: nodeDragMoved || didMerge,
      changeType: didMerge ? 'content' : 'node-position'
    })
    nodeDragMoved = false
    draggedNodeId = ''
    draggedNodeGroupId = ''
    groupMergeCandidateId = null
    scheduleOverlayRectUpdate({ force: true })
  }

  const isPositionOnlyChangeBatch = (changes = []) =>
    Array.isArray(changes) &&
    changes.length > 0 &&
    changes.every((change) => change?.type === 'position' && !('selected' in change) && !('selecting' in change))

  const onNodesChange = (changes = []) => {
    const positionOnlyChanges = isPositionOnlyChangeBatch(changes)
    if (Array.isArray(changes) && changes.length) {
      refreshCanvasCollectionRefs({ nodes: true })
    }

    if (
      isNodeDragging?.value &&
      Array.isArray(changes) &&
      changes.some((change) => change?.type === 'position')
    ) {
      const activePositionChange = changes.find((change) => change?.type === 'position' && change?.id)
      if (!draggedNodeId && activePositionChange?.id) {
        draggedNodeId = activePositionChange.id
        updateDraggedNodeGroup(draggedNodeId)
      }
      nodeDragMoved = true
      if (!draggedNodeGroupId && draggedNodeId) {
        const candidate = getGroupMergeCandidateForNode(draggedNodeId)
        const nextCandidateId = candidate?.id || null
        if (nextCandidateId !== groupMergeCandidateId) {
          groupMergeCandidateId = nextCandidateId
          setGroupMergeCandidateId(nextCandidateId)
        }
      }
    }

    nextTick(() => {
      if (!positionOnlyChanges) {
        syncNodeSelectedState()
        if (selectedNodeIds?.value?.length > 0) {
          clearGroupSelection()
        }
      }
      scheduleOverlayRectUpdate()
    })
  }

  return {
    onNodeDragStart,
    onNodeDragStop,
    onNodesChange
  }
}

export default useCanvasNodeDragInteraction
