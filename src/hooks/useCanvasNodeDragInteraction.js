import { nextTick } from 'vue'

export const useCanvasNodeDragInteraction = ({
  nodes,
  groups,
  selectedNodeIds,
  isNodeDragging,
  beginNodeDragInteraction = () => {},
  endNodeDragInteraction = () => {},
  refreshCanvasCollectionRefs = () => {},
  translateNodesByIds = () => {},
  syncNodeSelectedState = () => {},
  clearGroupSelection = () => {},
  scheduleOverlayRectUpdate = () => {}
} = {}) => {
  let nodeDragMoved = false
  let groupedNodeDragState = null

  const findGroupByNodeId = (nodeId) => {
    if (!nodeId) return null
    return groups?.value?.find((group) => (group.nodeIds || []).includes(nodeId)) || null
  }

  const startGroupedNodeDrag = (nodeId) => {
    const group = findGroupByNodeId(nodeId)
    if (!group) {
      groupedNodeDragState = null
      return
    }

    const groupNodeIds = Array.from(new Set(group.nodeIds || []))
    if (groupNodeIds.length < 2) {
      groupedNodeDragState = null
      return
    }

    const startPositions = new Map()
    groupNodeIds.forEach((id) => {
      const node = nodes?.value?.find((item) => item.id === id)
      if (!node) return
      startPositions.set(id, {
        x: Number(node.position?.x) || 0,
        y: Number(node.position?.y) || 0
      })
    })

    if (!startPositions.has(nodeId)) {
      groupedNodeDragState = null
      return
    }

    groupedNodeDragState = {
      groupId: group.id,
      anchorId: nodeId,
      nodeIds: groupNodeIds,
      startPositions,
      appliedDeltaX: 0,
      appliedDeltaY: 0
    }
  }

  const applyGroupedNodeDragDelta = (changes = []) => {
    const state = groupedNodeDragState
    if (!state) return
    const positionChanges = (Array.isArray(changes) ? changes : [])
      .filter((change) => change?.type === 'position' && change?.id && change?.position)
    if (!positionChanges.length) return

    const movedNodeIds = new Set(positionChanges.map((change) => change.id))
    const siblingMovedByVueFlow = state.nodeIds.some(
      (id) => id !== state.anchorId && movedNodeIds.has(id)
    )
    if (siblingMovedByVueFlow) return

    const anchorChange = positionChanges.find((change) => change.id === state.anchorId)
    if (!anchorChange) return
    const startPosition = state.startPositions.get(state.anchorId)
    if (!startPosition) return

    const totalDeltaX = (Number(anchorChange.position?.x) || 0) - startPosition.x
    const totalDeltaY = (Number(anchorChange.position?.y) || 0) - startPosition.y
    const moveX = totalDeltaX - state.appliedDeltaX
    const moveY = totalDeltaY - state.appliedDeltaY
    if (!moveX && !moveY) return

    const followerNodeIds = state.nodeIds.filter((id) => id !== state.anchorId)
    if (!followerNodeIds.length) return

    state.appliedDeltaX = totalDeltaX
    state.appliedDeltaY = totalDeltaY
    translateNodesByIds(followerNodeIds, { x: moveX, y: moveY }, false)
  }

  const onNodeDragStart = (_, node) => {
    nodeDragMoved = false
    startGroupedNodeDrag(node?.id)
    beginNodeDragInteraction()
  }

  const onNodeDragStop = () => {
    endNodeDragInteraction({ saveHistory: nodeDragMoved })
    nodeDragMoved = false
    groupedNodeDragState = null
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
      nodeDragMoved = true
      applyGroupedNodeDragDelta(changes)
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
