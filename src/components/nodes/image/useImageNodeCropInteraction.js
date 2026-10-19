import { computed, getCurrentInstance, nextTick, onUnmounted, ref, watch } from 'vue'
import {
  getImageNodeCropBoxStyle,
  getImageNodeCropInteractionRect,
  getImageNodeCropMaskStyles,
  getImageNodeCropStageMetrics,
  getImageNodeInitialCropRect
} from '@/utils/imageNodeLayout'

let cancelActiveCrop = null

const getDefaultWindow = () => (typeof window === 'undefined' ? null : window)

const readOption = (source) => {
  if (typeof source === 'function') return source()
  return source?.value ?? source
}

export const useImageNodeCropInteraction = ({
  addWindowEventListener = (type, handler) => getDefaultWindow()?.addEventListener(type, handler),
  closePreviewModal = () => {},
  hasDisplayImage = () => false,
  minCropSize = 48,
  naturalSize = () => ({}),
  nextTickFn = nextTick,
  onApply = () => {},
  removeWindowEventListener = (type, handler) => getDefaultWindow()?.removeEventListener(type, handler),
  stageStyle = () => ({}),
  viewportZoom = () => 1
} = {}) => {
  const activeTool = ref('')
  const cropAspectRatio = ref('')
  const cropHandles = ['nw', 'ne', 'sw', 'se']
  const cropRect = ref({ x: 0, y: 0, width: 0, height: 0 })
  const cropInteraction = ref(null)

  const cropStageMetrics = computed(() => getImageNodeCropStageMetrics({
    stageStyle: readOption(stageStyle),
    naturalSize: readOption(naturalSize)
  }))
  const cropBoxStyle = computed(() => getImageNodeCropBoxStyle(cropRect.value))
  const cropMaskStyles = computed(() => getImageNodeCropMaskStyles({
    cropRect: cropRect.value,
    metrics: cropStageMetrics.value
  }))

  const initializeCropRect = () => {
    const nextRect = getImageNodeInitialCropRect({ metrics: cropStageMetrics.value, aspectRatio: cropAspectRatio.value, fillRatio: cropAspectRatio.value ? 1 : 0.72 })
    if (nextRect) cropRect.value = nextRect
    return nextRect
  }

  const removePointerListeners = () => {
    removeWindowEventListener('mousemove', onCropPointerMove)
    removeWindowEventListener('mouseup', stopCropInteraction)
  }

  function stopCropInteraction() {
    cropInteraction.value = null
    removePointerListeners()
  }

  const cancelCropMode = () => {
    if (cancelActiveCrop === cancelCropMode) cancelActiveCrop = null
    activeTool.value = ''
    cropAspectRatio.value = ''
    cropInteraction.value = null
    removePointerListeners()
    removeWindowEventListener('keydown', handleCropKeydown)
  }

  function handleCropKeydown(event) {
    if (activeTool.value !== 'crop' || event.defaultPrevented || event.target?.closest?.('[role="menu"]')) return
    if (event.key === 'Escape') {
      event.preventDefault()
      cancelCropMode()
      return
    }
    if (event.key === 'Enter') {
      if (event.target?.closest?.('button, a, input, textarea, select, [role="menuitem"]')) return
      event.preventDefault()
      onApply()
    }
  }

  const startCropMode = async (aspectRatio = '') => {
    if (!readOption(hasDisplayImage)) return
    if (cancelActiveCrop && cancelActiveCrop !== cancelCropMode) cancelActiveCrop()
    cancelActiveCrop = cancelCropMode
    closePreviewModal()
    cropAspectRatio.value = aspectRatio
    activeTool.value = 'crop'
    await nextTickFn()
    initializeCropRect()
  }

  const startCropDrag = (event) => {
    cropInteraction.value = {
      type: 'drag',
      startPointerX: event.clientX,
      startPointerY: event.clientY,
      pointerScale: 1 / Math.max(0.01, Number(readOption(viewportZoom)) || 1),
      startRect: { ...cropRect.value }
    }
    addWindowEventListener('mousemove', onCropPointerMove)
    addWindowEventListener('mouseup', stopCropInteraction)
  }

  const startCropResize = (handle, event) => {
    cropInteraction.value = {
      type: 'resize',
      handle,
      startPointerX: event.clientX,
      startPointerY: event.clientY,
      pointerScale: 1 / Math.max(0.01, Number(readOption(viewportZoom)) || 1),
      startRect: { ...cropRect.value }
    }
    addWindowEventListener('mousemove', onCropPointerMove)
    addWindowEventListener('mouseup', stopCropInteraction)
  }

  function onCropPointerMove(event) {
    const current = cropInteraction.value
    if (!current) return

    const nextRect = getImageNodeCropInteractionRect({
      interaction: current,
      pointer: {
        x: current.startPointerX + (event.clientX - current.startPointerX) * current.pointerScale,
        y: current.startPointerY + (event.clientY - current.startPointerY) * current.pointerScale
      },
      metrics: cropStageMetrics.value,
      minSize: minCropSize,
      aspectRatio: cropAspectRatio.value
    })
    if (nextRect) cropRect.value = nextRect
  }

  watch(activeTool, (tool) => {
    if (tool === 'crop') {
      addWindowEventListener('keydown', handleCropKeydown)
      return
    }
    removeWindowEventListener('keydown', handleCropKeydown)
  })

  if (getCurrentInstance()) {
    onUnmounted(cancelCropMode)
  }

  return {
    activeTool,
    cancelCropMode,
    cropAspectRatio,
    cropBoxStyle,
    cropHandles,
    cropInteraction,
    cropMaskStyles,
    cropRect,
    cropStageMetrics,
    handleCropKeydown,
    initializeCropRect,
    startCropDrag,
    startCropMode,
    startCropResize,
    stopCropInteraction
  }
}
