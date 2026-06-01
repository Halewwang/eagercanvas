import { computed, getCurrentInstance, nextTick, onUnmounted, ref, watch } from 'vue'
import {
  getImagePreviewCanvasSize,
  getImagePreviewCanvasStyle,
  getImagePreviewCenteredScroll,
  getImagePreviewRenderedSize,
  getImagePreviewViewportSize,
  getImagePreviewZoomFocus,
  getImagePreviewZoomScroll,
  normalizeImagePreviewZoom
} from '@/utils/imageNodeLayout'

export const PREVIEW_MIN_ZOOM = 0.75
export const PREVIEW_MAX_ZOOM = 4
const PREVIEW_ZOOM_STEP = 0.25

const getDefaultWindow = () => (typeof window === 'undefined' ? null : window)

export const useImageNodePreviewState = ({
  addWindowEventListener = (type, handler) => getDefaultWindow()?.addEventListener(type, handler),
  getWindowSize = () => {
    const targetWindow = getDefaultWindow()
    return {
      width: targetWindow?.innerWidth || 0,
      height: targetWindow?.innerHeight || 0
    }
  },
  onClose = () => {},
  removeWindowEventListener = (type, handler) => getDefaultWindow()?.removeEventListener(type, handler)
} = {}) => {
  const showPreviewModal = ref(false)
  const previewModalRef = ref(null)
  const previewStageSize = ref({ width: 0, height: 0 })
  const previewZoom = ref(1)
  const previewNaturalSize = ref({ width: 0, height: 0 })

  const getPreviewStageElement = () => previewModalRef.value?.getStageElement?.() || null

  const previewViewportSize = computed(() => getImagePreviewViewportSize(previewStageSize.value))
  const previewRenderedSize = computed(() => getImagePreviewRenderedSize({
    naturalSize: previewNaturalSize.value,
    viewportSize: previewViewportSize.value,
    windowSize: getWindowSize(),
    zoom: previewZoom.value
  }))
  const previewImageStyle = computed(() => {
    const { width, height } = previewRenderedSize.value
    return {
      width: `${width}px`,
      height: `${height}px`
    }
  })
  const previewCanvasStyle = computed(() => getImagePreviewCanvasStyle({
    viewportSize: previewViewportSize.value,
    renderedSize: previewRenderedSize.value
  }))

  const getCurrentPreviewCanvasSize = () => getImagePreviewCanvasSize({
    viewportSize: previewViewportSize.value,
    renderedSize: previewRenderedSize.value
  })

  const syncPreviewStageSize = () => {
    const stage = getPreviewStageElement()
    if (!stage) return
    const width = Number(stage.clientWidth) || 0
    const height = Number(stage.clientHeight) || 0
    if (previewStageSize.value.width === width && previewStageSize.value.height === height) return
    previewStageSize.value = { width, height }
  }

  const centerPreviewViewport = () => {
    const stage = getPreviewStageElement()
    if (!stage) return
    const scroll = getImagePreviewCenteredScroll({
      canvasSize: getCurrentPreviewCanvasSize(),
      stageSize: { width: stage.clientWidth, height: stage.clientHeight }
    })
    stage.scrollLeft = scroll.left
    stage.scrollTop = scroll.top
  }

  const setPreviewZoom = (nextZoom) => {
    const normalizedZoom = normalizeImagePreviewZoom(nextZoom, {
      min: PREVIEW_MIN_ZOOM,
      max: PREVIEW_MAX_ZOOM
    })
    if (normalizedZoom === previewZoom.value) return

    const stage = getPreviewStageElement()
    if (!stage) {
      previewZoom.value = normalizedZoom
      return
    }

    const focus = getImagePreviewZoomFocus({
      scroll: { left: stage.scrollLeft, top: stage.scrollTop },
      stageSize: { width: stage.clientWidth, height: stage.clientHeight },
      canvasSize: getCurrentPreviewCanvasSize()
    })

    previewZoom.value = normalizedZoom

    nextTick(() => {
      const scroll = getImagePreviewZoomScroll({
        focus,
        stageSize: { width: stage.clientWidth, height: stage.clientHeight },
        canvasSize: getCurrentPreviewCanvasSize()
      })
      stage.scrollLeft = scroll.left
      stage.scrollTop = scroll.top
    })
  }

  const zoomInPreview = () => {
    setPreviewZoom(previewZoom.value + PREVIEW_ZOOM_STEP)
  }

  const zoomOutPreview = () => {
    setPreviewZoom(previewZoom.value - PREVIEW_ZOOM_STEP)
  }

  const resetPreviewZoom = () => {
    setPreviewZoom(1)
  }

  const openPreviewModal = () => {
    previewZoom.value = 1
    showPreviewModal.value = true
  }

  const setPreviewNaturalSizeFromEvent = (event) => {
    const target = event?.target
    if (!target) return null

    previewNaturalSize.value = {
      width: Number(target.naturalWidth) || 0,
      height: Number(target.naturalHeight) || 0
    }

    nextTick(() => {
      syncPreviewStageSize()
      if (showPreviewModal.value) centerPreviewViewport()
    })

    return previewNaturalSize.value
  }

  watch(showPreviewModal, (visible) => {
    if (visible) {
      previewZoom.value = 1
      addWindowEventListener('resize', syncPreviewStageSize)
      nextTick(() => {
        syncPreviewStageSize()
        centerPreviewViewport()
      })
      return
    }

    removeWindowEventListener('resize', syncPreviewStageSize)
    onClose()
  })

  if (getCurrentInstance()) {
    onUnmounted(() => {
      removeWindowEventListener('resize', syncPreviewStageSize)
    })
  }

  return {
    centerPreviewViewport,
    getPreviewStageElement,
    openPreviewModal,
    previewCanvasStyle,
    previewImageStyle,
    previewModalRef,
    previewNaturalSize,
    previewStageSize,
    previewZoom,
    resetPreviewZoom,
    setPreviewNaturalSizeFromEvent,
    setPreviewZoom,
    showPreviewModal,
    syncPreviewStageSize,
    zoomInPreview,
    zoomOutPreview
  }
}

export default useImageNodePreviewState
