import { computed, ref } from 'vue'
import { getNodeCapsuleScale, recordCanvasPerf } from '@/utils/canvasInteraction'

export const useCanvasViewportInteraction = ({
  viewport,
  isCanvasZooming,
  showGrid,
  beginCanvasZoomInteraction,
  endCanvasZoomInteraction,
  updateViewport,
  scheduleOverlayRectUpdate,
  nowFn = () => (typeof performance !== 'undefined' ? performance.now() : Date.now()),
  recordPerf = recordCanvasPerf,
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout
} = {}) => {
  let viewportSettleTimeoutId = null

  const buildCanvasFlowStyle = (sourceViewport = viewport.value) => {
    const zoom = Math.max(Number(sourceViewport?.zoom) || 1, 0.01)
    const baseGap = 20
    const minGap = 12
    const scaledGap = Math.max(baseGap * zoom, minGap)
    const gridOpacity = Math.max(0.02, Math.min(0.05, 0.05 * Math.pow(zoom, 0.85)))
    const rawX = Number(sourceViewport?.x) || 0
    const rawY = Number(sourceViewport?.y) || 0
    const offsetX = ((rawX % scaledGap) + scaledGap) % scaledGap
    const offsetY = ((rawY % scaledGap) + scaledGap) % scaledGap

    return {
      '--node-capsule-scale': `${getNodeCapsuleScale(zoom)}`,
      '--canvas-grid-image': showGrid.value
        ? `radial-gradient(rgba(255,255,255,${gridOpacity}) 1px, transparent 1px)`
        : 'none',
      '--canvas-grid-size': `${scaledGap}px ${scaledGap}px`,
      '--canvas-grid-position': `${offsetX}px ${offsetY}px`
    }
  }

  const settledCanvasFlowStyle = ref(buildCanvasFlowStyle())
  const canvasFlowStyle = computed(() => {
    if (isCanvasZooming.value) {
      return settledCanvasFlowStyle.value
    }

    const nextStyle = buildCanvasFlowStyle()
    settledCanvasFlowStyle.value = nextStyle
    return nextStyle
  })

  const clearViewportSettleTimer = () => {
    if (viewportSettleTimeoutId) {
      clearTimeoutFn(viewportSettleTimeoutId)
      viewportSettleTimeoutId = null
    }
  }

  const handleViewportChange = (newViewport) => {
    const startedAt = nowFn()
    beginCanvasZoomInteraction()
    updateViewport(newViewport, { persist: false })
    scheduleOverlayRectUpdate()
    recordPerf('viewport-change', startedAt, {
      zoom: Number(newViewport?.zoom || 0)
    })

    clearViewportSettleTimer()

    viewportSettleTimeoutId = setTimeoutFn(() => {
      viewportSettleTimeoutId = null
      updateViewport({ ...(viewport.value || newViewport) }, { persist: true })
      endCanvasZoomInteraction()
      scheduleOverlayRectUpdate({ force: true })
    }, 220)
  }

  return {
    buildCanvasFlowStyle,
    canvasFlowStyle,
    clearViewportSettleTimer,
    handleViewportChange
  }
}

export default useCanvasViewportInteraction
