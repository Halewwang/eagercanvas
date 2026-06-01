import { computed, ref, watch } from 'vue'
import {
  generateImagePreviewDataUrl,
  loadCachedImagePreview,
  resolveImageNodeDisplaySource,
  saveCachedImagePreview,
  shouldGenerateImagePreview
} from '@/utils/imagePreviewCache'

const readOption = (source) => {
  if (typeof source === 'function') return source()
  return source?.value ?? source
}

export const useImageNodeCanvasPreview = ({
  activeTool = () => '',
  displayImageUrl = () => '',
  generatePreviewDataUrl = generateImagePreviewDataUrl,
  isCanvasInteracting = () => false,
  loadCachedPreview = loadCachedImagePreview,
  resolveDisplaySource = resolveImageNodeDisplaySource,
  saveCachedPreview = saveCachedImagePreview,
  shouldGeneratePreview = shouldGenerateImagePreview,
  watchSources = true
} = {}) => {
  const cachedCanvasPreviewUrl = ref('')
  const canvasPreviewState = ref('idle')
  let canvasPreviewRequestId = 0
  let canvasPreviewSource = ''

  const getActiveTool = () => String(readOption(activeTool) || '')
  const getDisplayImageUrl = () => String(readOption(displayImageUrl) || '').trim()
  const getIsCanvasInteracting = () => !!readOption(isCanvasInteracting)

  const canvasDisplayImageUrl = computed(() => {
    const originalUrl = getDisplayImageUrl()
    if (getActiveTool() === 'crop') return originalUrl
    if (cachedCanvasPreviewUrl.value) {
      return resolveDisplaySource({
        originalUrl,
        cachedPreviewUrl: cachedCanvasPreviewUrl.value
      }).canvasUrl
    }
    if (canvasPreviewState.value === 'failed') return originalUrl
    return ''
  })

  const syncCanvasImagePreview = async () => {
    const source = getDisplayImageUrl()
    const requestId = ++canvasPreviewRequestId
    if (source !== canvasPreviewSource) {
      canvasPreviewSource = source
      cachedCanvasPreviewUrl.value = ''
      canvasPreviewState.value = source ? 'idle' : 'empty'
    }
    if (!source) return
    if (cachedCanvasPreviewUrl.value) return

    try {
      const cached = await loadCachedPreview(source)
      if (requestId !== canvasPreviewRequestId || source !== getDisplayImageUrl()) return
      if (cached?.previewUrl) {
        cachedCanvasPreviewUrl.value = cached.previewUrl
        canvasPreviewState.value = 'ready'
        return
      }
    } catch {
      // IndexedDB can be unavailable in private browsing; fall through to in-memory rendering behavior.
    }

    if (!shouldGeneratePreview({
      originalUrl: source,
      cachedPreviewUrl: cachedCanvasPreviewUrl.value,
      isInteracting: getIsCanvasInteracting()
    })) {
      return
    }

    canvasPreviewState.value = 'loading'
    try {
      const previewUrl = await generatePreviewDataUrl(source)
      if (requestId !== canvasPreviewRequestId || source !== getDisplayImageUrl()) return
      if (!previewUrl) {
        canvasPreviewState.value = 'failed'
        return
      }
      cachedCanvasPreviewUrl.value = previewUrl
      canvasPreviewState.value = 'ready'
      await saveCachedPreview(source, previewUrl).catch(() => false)
    } catch {
      if (requestId === canvasPreviewRequestId) {
        canvasPreviewState.value = 'failed'
      }
    }
  }

  if (watchSources) {
    watch(
      [() => getDisplayImageUrl(), () => getIsCanvasInteracting()],
      () => {
        void syncCanvasImagePreview()
      },
      { immediate: true }
    )
  }

  return {
    cachedCanvasPreviewUrl,
    canvasDisplayImageUrl,
    canvasPreviewState,
    syncCanvasImagePreview
  }
}
