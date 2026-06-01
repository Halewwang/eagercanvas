import { computed, nextTick, ref } from 'vue'

import {
  getGroupBodyHitRects,
  getInteractionOverlayDelay,
  getNodeViewportRect,
  getOverlayScheduleMode,
  mergeViewportRects,
  recordCanvasPerf,
  shouldMeasureGroupRects
} from '@/utils/canvasInteraction'

const defaultRequestAnimationFrame = (callback) => globalThis.requestAnimationFrame?.(callback) ?? setTimeout(callback, 0)
const defaultCancelAnimationFrame = (id) => {
  if (globalThis.cancelAnimationFrame) {
    globalThis.cancelAnimationFrame(id)
    return
  }
  clearTimeout(id)
}

export const useCanvasOverlayRects = ({
  canvasShellRef,
  groups,
  isCanvasZooming,
  isGroupDragging = () => false,
  isNodeDragging,
  nodes,
  selectedGroupId,
  selectedNodeIds,
  viewport,
  cancelAnimationFrameFn = defaultCancelAnimationFrame,
  clearTimeoutFn = clearTimeout,
  nextTickFn = nextTick,
  requestAnimationFrameFn = defaultRequestAnimationFrame,
  setTimeoutFn = setTimeout,
  recordPerf = recordCanvasPerf
} = {}) => {
  const groupRects = ref({})
  const multiSelectRect = ref(null)
  let overlayRafId = null
  let overlayTimeoutId = null

  const getNodeLookup = () => new Map((nodes?.value || []).map((node) => [node.id, node]))

  const selectedGroup = computed(() =>
    (groups?.value || []).find((group) => group.id === selectedGroupId?.value) || null
  )

  const renderedGroups = computed(() =>
    (groups?.value || [])
      .map((group) => ({
        ...group,
        rect: groupRects.value[group.id]
      }))
      .filter((group) => group.rect)
  )

  const selectedGroupMenuRect = computed(() =>
    selectedGroupId?.value ? groupRects.value[selectedGroupId.value] || null : null
  )

  const selectedGroupBodyHitRects = computed(() => {
    const group = selectedGroup.value
    if (!group) return []

    const groupRect = groupRects.value[group.id]
    if (!groupRect) return []

    const nodeById = getNodeLookup()
    const nodeRects = (group.nodeIds || [])
      .map((nodeId) => getNodeViewportRect(nodeById.get(nodeId), viewport?.value))
      .filter(Boolean)

    return getGroupBodyHitRects({ groupRect, nodeRects })
  })

  const groupBodyHitRectsById = computed(() => (
    selectedGroup.value ? { [selectedGroup.value.id]: selectedGroupBodyHitRects.value } : {}
  ))

  const multiSelectMenuRect = computed(() => {
    if (selectedGroupId?.value) return null
    if ((selectedNodeIds?.value || []).length < 2) return null
    return multiSelectRect.value
  })

  const updateOverlayRects = () => {
    overlayRafId = null
    if (!canvasShellRef?.value) return
    const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now()
    const nextGroupRects = {}
    const nodeById = getNodeLookup()

    ;(groups?.value || []).forEach((group) => {
      const memberRects = (group.nodeIds || [])
        .map((nodeId) => getNodeViewportRect(nodeById.get(nodeId), viewport?.value))
        .filter(Boolean)
      const merged = mergeViewportRects(memberRects)
      if (merged) nextGroupRects[group.id] = merged
    })

    const selectedRects = (selectedNodeIds?.value || [])
      .map((nodeId) => getNodeViewportRect(nodeById.get(nodeId), viewport?.value))
      .filter(Boolean)

    groupRects.value = nextGroupRects
    multiSelectRect.value = (selectedNodeIds?.value || []).length >= 2
      ? mergeViewportRects(selectedRects)
      : null
    recordPerf('overlay-rects', startedAt, {
      nodeCount: (nodes?.value || []).length,
      groupCount: (groups?.value || []).length
    })
  }

  const scheduleOverlayRectUpdate = (options = {}) => {
    const force = options.force === true
    if (!shouldMeasureGroupRects({ isGroupDragging: isGroupDragging(), force })) return

    const scheduleMode = force
      ? 'raf'
      : getOverlayScheduleMode({
          isDragging: !!isNodeDragging?.value,
          isZooming: !!isCanvasZooming?.value
        })
    const delay = scheduleMode === 'delayed'
      ? getInteractionOverlayDelay({ isInteracting: true })
      : 0

    if (overlayTimeoutId && delay === 0) {
      clearTimeoutFn(overlayTimeoutId)
      overlayTimeoutId = null
    }

    if (delay > 0) {
      if (overlayTimeoutId) return
      overlayTimeoutId = setTimeoutFn(() => {
        overlayTimeoutId = null
        nextTickFn(() => {
          if (overlayRafId) cancelAnimationFrameFn(overlayRafId)
          overlayRafId = requestAnimationFrameFn(updateOverlayRects)
        })
      }, delay)
      return
    }

    if (overlayRafId) cancelAnimationFrameFn(overlayRafId)
    nextTickFn(() => {
      overlayRafId = requestAnimationFrameFn(updateOverlayRects)
    })
  }

  const cleanupOverlayRectUpdates = () => {
    if (overlayRafId) {
      cancelAnimationFrameFn(overlayRafId)
      overlayRafId = null
    }
    if (overlayTimeoutId) {
      clearTimeoutFn(overlayTimeoutId)
      overlayTimeoutId = null
    }
  }

  return {
    groupBodyHitRectsById,
    groupRects,
    multiSelectMenuRect,
    multiSelectRect,
    renderedGroups,
    selectedGroup,
    selectedGroupMenuRect,
    cleanupOverlayRectUpdates,
    scheduleOverlayRectUpdate,
    updateOverlayRects
  }
}
