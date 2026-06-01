import {
  findGroupBodyDragTarget,
  getGroupDragListenerNames,
  getNodeViewportRect,
  getSelectedGroupGripPointerAction,
  shouldAcceptGroupDragMove,
  translateViewportRect
} from '@/utils/canvasInteraction'

const GROUP_BODY_DRAG_IGNORE_SELECTOR = [
  '.canvas-group-title',
  '.canvas-group-edge',
  '.group-capsule-menu',
  '.vue-flow__node',
  '.vue-flow__edge',
  '.vue-flow__handle',
  'button',
  'input',
  'textarea',
  'select',
  '[contenteditable="true"]'
].join(',')

const shouldIgnoreGroupBodyDragTarget = (target) => {
  if (!target || typeof target.closest !== 'function') return false
  return Boolean(target.closest(GROUP_BODY_DRAG_IGNORE_SELECTOR))
}

export const useCanvasGroupDrag = ({
  groups,
  nodes,
  groupRects,
  selectedGroupId,
  viewport,
  selectGroup = () => {},
  beginNodeDragInteraction = () => {},
  endNodeDragInteraction = () => {},
  translateNodesByIds = () => {},
  scheduleOverlayRectUpdate = () => {},
  eventTarget = typeof window !== 'undefined' ? window : null
} = {}) => {
  let groupDragState = null

  const isGroupDragging = () => !!groupDragState

  const getNodeLookup = () => new Map((nodes?.value || []).map((node) => [node.id, node]))

  const removeGroupDragListeners = () => {
    if (!groupDragState || !eventTarget) return
    groupDragState.moveEventNames.forEach((eventName) => {
      eventTarget.removeEventListener(eventName, handleGroupDragMove)
    })
    groupDragState.endEventNames.forEach((eventName) => {
      eventTarget.removeEventListener(eventName, stopGroupDrag)
    })
    groupDragState.cancelEventNames.forEach((eventName) => {
      eventTarget.removeEventListener(eventName, stopGroupDrag)
    })
  }

  const stopGroupDrag = () => {
    if (!groupDragState) return
    removeGroupDragListeners()
    const didMove = !!groupDragState?.didMove
    groupDragState = null
    endNodeDragInteraction({ saveHistory: didMove })
    scheduleOverlayRectUpdate({ force: true })
  }

  const handleGroupDragMove = (event) => {
    if (!groupDragState) return
    if (!shouldAcceptGroupDragMove({
      activePointerId: groupDragState.pointerId,
      eventType: event.type,
      eventPointerId: event.pointerId ?? null
    })) return

    const zoom = viewport?.value?.zoom || 1
    const nextDeltaX = (event.clientX - groupDragState.startClientX) / zoom
    const nextDeltaY = (event.clientY - groupDragState.startClientY) / zoom
    const moveX = nextDeltaX - groupDragState.lastDeltaX
    const moveY = nextDeltaY - groupDragState.lastDeltaY
    if (!moveX && !moveY) return

    groupDragState.didMove = true
    groupDragState.lastDeltaX = nextDeltaX
    groupDragState.lastDeltaY = nextDeltaY
    translateNodesByIds(groupDragState.nodeIds, { x: moveX, y: moveY }, false)

    const nextGroupRect = translateViewportRect(groupDragState.initialGroupRect, {
      x: event.clientX - groupDragState.startClientX,
      y: event.clientY - groupDragState.startClientY
    })
    if (!nextGroupRect) {
      scheduleOverlayRectUpdate()
      return
    }

    groupRects.value = {
      ...groupRects.value,
      [groupDragState.groupId]: nextGroupRect
    }
  }

  const startGroupDrag = (group, event) => {
    if (groupDragState) return
    if (!group || event?.button !== 0) return
    event.preventDefault()
    event.stopPropagation()

    selectGroup(group.id)
    beginNodeDragInteraction()

    const isPointerEvent = String(event.type || '').startsWith('pointer')
    const listenerNames = getGroupDragListenerNames()
    groupDragState = {
      groupId: group.id,
      nodeIds: [...(group.nodeIds || [])],
      initialGroupRect: groupRects?.value?.[group.id]
        ? { ...groupRects.value[group.id] }
        : null,
      startClientX: event.clientX,
      startClientY: event.clientY,
      lastDeltaX: 0,
      lastDeltaY: 0,
      didMove: false,
      pointerId: isPointerEvent ? event.pointerId : null,
      moveEventNames: listenerNames.move,
      endEventNames: listenerNames.end,
      cancelEventNames: listenerNames.cancel
    }

    if (!eventTarget) return
    groupDragState.moveEventNames.forEach((eventName) => {
      eventTarget.addEventListener(eventName, handleGroupDragMove)
    })
    groupDragState.endEventNames.forEach((eventName) => {
      eventTarget.addEventListener(eventName, stopGroupDrag)
    })
    groupDragState.cancelEventNames.forEach((eventName) => {
      eventTarget.addEventListener(eventName, stopGroupDrag)
    })
  }

  const handleGroupGripPointerDown = (group, event) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()

    const action = getSelectedGroupGripPointerAction({
      selected: selectedGroupId?.value === group.id
    })
    if (action === 'drag') startGroupDrag(group, event)
  }

  const handleCanvasPointerDownCapture = (event) => {
    if (event.button !== 0) return
    if (shouldIgnoreGroupBodyDragTarget(event.target)) return

    const nodeById = getNodeLookup()
    const nodeRectsByGroup = Object.fromEntries((groups?.value || []).map((group) => [
      group.id,
      (group.nodeIds || [])
        .map((nodeId) => getNodeViewportRect(nodeById.get(nodeId), viewport?.value))
        .filter(Boolean)
    ]))

    const targetGroup = findGroupBodyDragTarget({
      groups: groups?.value || [],
      groupRects: groupRects?.value || {},
      nodeRectsByGroup,
      point: { x: event.clientX, y: event.clientY }
    })
    if (!targetGroup) return

    startGroupDrag(targetGroup, event)
  }

  return {
    handleCanvasPointerDownCapture,
    handleGroupGripPointerDown,
    isGroupDragging,
    startGroupDrag,
    stopGroupDrag
  }
}
