import { nextTick, ref } from 'vue'

import {
  getGroupDragListenerNames,
  getGroupMergeCandidate,
  getGroupOutputImageDropPosition,
  getGroupOutputImagePosition,
  getCanvasAutoPlacementPosition,
  getNodeViewportRect,
  shouldAcceptGroupDragMove
} from '@/utils/canvasInteraction'

const GROUP_OUTPUT_DRAG_MOVE_THRESHOLD = 4

export const useCanvasGroupOutputs = ({
  addGroupOutputLink = () => '',
  addNode = () => '',
  groupRects,
  isReadOnlyProject,
  nodes,
  notify = {},
  renderedGroups,
  removeNodesByIds = () => false,
  scheduleOverlayRectUpdate = () => {},
  updateNodeInternals = () => {},
  viewport,
  warnReadOnly = () => {},
  eventTarget = typeof window !== 'undefined' ? window : null
} = {}) => {
  const groupMergeCandidateId = ref(null)
  const pendingGroupOutputLine = ref(null)
  let groupOutputDragState = null

  const getGroupMergeCandidateForNode = (nodeId) => {
    const node = nodes?.value?.find((item) => item.id === nodeId)
    const nodeRect = getNodeViewportRect(node, viewport?.value)
    if (!nodeRect) return null
    return getGroupMergeCandidate({
      nodeRect,
      groups: (renderedGroups?.value || []).filter((group) => !(group.nodeIds || []).includes(nodeId))
    })
  }

  const setGroupMergeCandidateId = (groupId) => {
    groupMergeCandidateId.value = groupId || null
  }

  const readPointer = (event = {}) => {
    if (event?.touches?.length) {
      return { x: event.touches[0].clientX, y: event.touches[0].clientY }
    }
    if (event?.changedTouches?.length) {
      return { x: event.changedTouches[0].clientX, y: event.changedTouches[0].clientY }
    }
    const x = event?.clientX ?? event?.x ?? event?.pageX
    const y = event?.clientY ?? event?.y ?? event?.pageY
    if (typeof x === 'number' && typeof y === 'number') return { x, y }
    return null
  }

  const getGroupRect = (group) => groupRects?.value?.[group?.id] || group?.rect || null

  const getGroupOutputSourcePoint = (group) => {
    const rect = getGroupRect(group)
    if (!rect) return null
    return {
      x: rect.left + rect.width,
      y: rect.top + rect.height / 2
    }
  }

  const updatePendingGroupOutputLine = (group, targetPoint) => {
    const sourcePoint = getGroupOutputSourcePoint(group)
    if (!group?.id || !sourcePoint || !targetPoint) {
      pendingGroupOutputLine.value = null
      return
    }

    pendingGroupOutputLine.value = {
      id: `pending-group-output-${group.id}`,
      groupId: group.id,
      pending: true,
      source: sourcePoint,
      target: targetPoint
    }
  }

  const createGroupOutputImageAtPosition = async (group, position) => {
    if (isReadOnlyProject?.value) {
      warnReadOnly()
      return
    }

    if (!group?.id || !position) return

    const nodeData = {
      label: '图片输出'
    }
    const nodePosition = getCanvasAutoPlacementPosition({
      preferredPosition: position,
      nodeType: 'image',
      nodeData,
      existingNodes: nodes?.value || []
    })
    const nodeId = addNode('image', nodePosition, nodeData, { saveHistory: false })
    const linkId = addGroupOutputLink(group.id, nodeId, { saveHistory: true })
    if (!linkId) {
      removeNodesByIds([nodeId], false)
      return
    }

    await nextTick()
    updateNodeInternals(nodeId)
    scheduleOverlayRectUpdate({ force: true })
    notify.success?.('已创建下游图片节点')
  }

  const handleCreateGroupOutputImage = async (group) => {
    const groupRect = getGroupRect(group)
    if (!group?.id || !groupRect) return

    await createGroupOutputImageAtPosition(group, getGroupOutputImagePosition({
      groupRect,
      viewport: viewport?.value
    }))
  }

  const removeGroupOutputDragListeners = () => {
    if (!groupOutputDragState || !eventTarget) return
    groupOutputDragState.moveEventNames.forEach((eventName) => {
      eventTarget.removeEventListener(eventName, handleGroupOutputDragMove)
    })
    groupOutputDragState.endEventNames.forEach((eventName) => {
      eventTarget.removeEventListener(eventName, stopGroupOutputDrag)
    })
    groupOutputDragState.cancelEventNames.forEach((eventName) => {
      eventTarget.removeEventListener(eventName, cancelGroupOutputDrag)
    })
  }

  const clearGroupOutputDragState = () => {
    removeGroupOutputDragListeners()
    groupOutputDragState = null
    pendingGroupOutputLine.value = null
  }

  const handleGroupOutputDragMove = (event) => {
    if (!groupOutputDragState) return
    if (!shouldAcceptGroupDragMove({
      activePointerId: groupOutputDragState.pointerId,
      eventType: event.type,
      eventPointerId: event.pointerId ?? null
    })) return

    const point = readPointer(event)
    if (!point) return

    const deltaX = point.x - groupOutputDragState.startPoint.x
    const deltaY = point.y - groupOutputDragState.startPoint.y
    if (Math.hypot(deltaX, deltaY) >= GROUP_OUTPUT_DRAG_MOVE_THRESHOLD) {
      groupOutputDragState.didMove = true
    }
    groupOutputDragState.currentPoint = point
    updatePendingGroupOutputLine(groupOutputDragState.group, point)
  }

  const stopGroupOutputDrag = async (event) => {
    if (!groupOutputDragState) return
    if (!shouldAcceptGroupDragMove({
      activePointerId: groupOutputDragState.pointerId,
      eventType: event?.type,
      eventPointerId: event?.pointerId ?? null
    })) return

    const state = groupOutputDragState
    const releasePoint = readPointer(event) || state.currentPoint || state.startPoint
    const position = state.didMove
      ? getGroupOutputImageDropPosition({
          point: releasePoint,
          viewport: viewport?.value
        })
      : getGroupOutputImagePosition({
          groupRect: getGroupRect(state.group),
          viewport: viewport?.value
        })

    clearGroupOutputDragState()
    await createGroupOutputImageAtPosition(state.group, position)
  }

  const cancelGroupOutputDrag = () => {
    clearGroupOutputDragState()
  }

  const handleGroupOutputPointerDown = (group, event) => {
    if (isReadOnlyProject?.value) {
      warnReadOnly()
      return
    }
    if (!group?.id || groupOutputDragState) return
    if (event?.button !== undefined && event.button !== 0) return

    const startPoint = readPointer(event)
    const sourcePoint = getGroupOutputSourcePoint(group)
    if (!startPoint || !sourcePoint) return

    event?.preventDefault?.()
    event?.stopPropagation?.()

    const listenerNames = getGroupDragListenerNames()
    const isPointerEvent = String(event?.type || '').startsWith('pointer')
    groupOutputDragState = {
      group,
      startPoint,
      currentPoint: startPoint,
      didMove: false,
      pointerId: isPointerEvent ? event.pointerId : null,
      moveEventNames: listenerNames.move,
      endEventNames: listenerNames.end,
      cancelEventNames: listenerNames.cancel
    }
    updatePendingGroupOutputLine(group, startPoint)

    if (!eventTarget) {
      stopGroupOutputDrag(event)
      return
    }

    groupOutputDragState.moveEventNames.forEach((eventName) => {
      eventTarget.addEventListener(eventName, handleGroupOutputDragMove)
    })
    groupOutputDragState.endEventNames.forEach((eventName) => {
      eventTarget.addEventListener(eventName, stopGroupOutputDrag)
    })
    groupOutputDragState.cancelEventNames.forEach((eventName) => {
      eventTarget.addEventListener(eventName, cancelGroupOutputDrag)
    })
  }

  return {
    groupMergeCandidateId,
    pendingGroupOutputLine,
    getGroupMergeCandidateForNode,
    setGroupMergeCandidateId,
    handleCreateGroupOutputImage,
    handleGroupOutputPointerDown
  }
}
