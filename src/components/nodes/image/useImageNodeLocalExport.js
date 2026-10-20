import { computed, ref, watch } from 'vue'
import { exportImageLocally } from '@/utils/imageLocalExport'
import { getImageNodeCropSourceRect } from '@/utils/imageNodeLayout'

export const IMAGE_EXPORT_RATIO_OPTIONS = [
  { key: '', label: 'Original' },
  ...['1:1', '3:2', '2:3', '4:3', '3:4', '4:5', '5:4', '16:9', '9:16', '21:9'].map((key) => ({ key, label: key }))
]
export const IMAGE_EXPORT_SIZE_OPTIONS = [
  { key: 0, label: 'Original' },
  ...[1024, 2048, 4096].map((key) => ({ key, label: `${key / 1024}K · ${key}px` }))
]
const read = (value) => {
  if (typeof value === 'function') return value()
  return value && typeof value === 'object' && 'value' in value ? value.value : value
}
const isRatio = (ratio) => IMAGE_EXPORT_RATIO_OPTIONS.some((item) => item.key === ratio)
const isSize = (size) => IMAGE_EXPORT_SIZE_OPTIONS.some((item) => item.key === size)

export const useImageNodeLocalExport = ({
  activeTool,
  cancelCropMode,
  cropRect,
  cropStageMetrics,
  data,
  displayImageUrl,
  downloadImageBlob,
  exportImage = exportImageLocally,
  getFileName = () => 'image.png',
  hasNaturalDimensions = () => true,
  messageApi = () => typeof window === 'undefined' ? null : window.$message,
  nodeId,
  startCropMode,
  updateNode = () => {}
} = {}) => {
  const readData = () => read(data) || {}
  const resolveRatio = (ratio) => isRatio(ratio) ? ratio : read(displayImageUrl) ? '' : '1:1'
  const resolveSize = (size) => isSize(size) ? size : read(displayImageUrl) ? 0 : 1024
  const localExportMode = ref(false)
  const localExportRatio = ref(resolveRatio(readData().exportRatio))
  const localExportSize = ref(resolveSize(readData().exportSize))
  const localExportBusy = ref(false)
  const localExportCropActive = computed(() => localExportMode.value && read(activeTool) === 'crop')
  watch(
    () => readData().exportRatio,
    (ratio) => {
      const nextRatio = resolveRatio(ratio)
      if (nextRatio !== localExportRatio.value && localExportCropActive.value) {
        cancelCropMode()
        localExportMode.value = false
      }
      localExportRatio.value = nextRatio
    },
    { flush: 'sync' }
  )
  watch(
    () => readData().exportSize,
    (size) => { localExportSize.value = resolveSize(size) },
    { flush: 'sync' }
  )
  const startLocalExportCrop = async (ratio) => {
    if (localExportBusy.value || !isRatio(ratio)) return
    localExportRatio.value = ratio
    updateNode(read(nodeId), { exportRatio: ratio })
    if (!ratio) {
      if (localExportCropActive.value) cancelCropMode()
      localExportMode.value = false
      return
    }
    if (!read(hasNaturalDimensions) || !read(displayImageUrl)) return
    localExportMode.value = true
    await startCropMode(ratio)
  }
  const setLocalExportSize = (size) => {
    if (localExportBusy.value || !isSize(size)) return
    localExportSize.value = size
    updateNode(read(nodeId), { exportSize: size })
  }
  const startEditingCrop = async () => {
    if (localExportBusy.value) return
    localExportMode.value = false
    await startCropMode()
  }
  const downloadLocalImage = async (maxEdge = localExportSize.value) => {
    const source = read(displayImageUrl)
    if (!source || localExportBusy.value || !isSize(maxEdge)) return
    if (read(activeTool) === 'crop' && !read(hasNaturalDimensions)) return
    localExportBusy.value = true
    try {
      const cropped = read(activeTool) === 'crop'
      const metrics = read(cropStageMetrics) || {}
      const result = await exportImage({
        source,
        maxEdge,
        aspectRatio: localExportRatio.value,
        fileName: getFileName(),
        cropRect: cropped ? getImageNodeCropSourceRect({ cropRect: read(cropRect), metrics }) : null,
        cropSourceSize: cropped ? { width: metrics.naturalWidth, height: metrics.naturalHeight } : null
      })
      downloadImageBlob(result.blob, result.fileName)
      if (read(activeTool) === 'crop') cancelCropMode()
      read(messageApi)?.success?.(`PNG exported locally · ${result.width} × ${result.height}`)
      return result
    } catch (error) {
      read(messageApi)?.error?.(error?.message || 'Local image export failed')
      return null
    } finally {
      localExportBusy.value = false
    }
  }
  return { downloadLocalImage, localExportBusy, localExportCropActive, localExportRatio, localExportSize, setLocalExportSize, startEditingCrop, startLocalExportCrop }
}
