import { computed, ref } from 'vue'
import { exportImageLocally } from '@/utils/imageLocalExport'
import { getImageNodeCropSourceRect } from '@/utils/imageNodeLayout'

export const IMAGE_EXPORT_RATIO_OPTIONS = ['1:1', '3:2', '2:3', '4:3', '3:4', '4:5', '5:4', '16:9', '9:16', '21:9'].map((key) => ({ key, label: key }))
export const IMAGE_EXPORT_SIZE_OPTIONS = [
  { key: 0, label: 'Original pixels · PNG' },
  ...[1024, 2048, 4096].map((key) => ({ key, label: `${key}px long edge · PNG` }))
]
const read = (value) => typeof value === 'function' ? value() : value?.value ?? value

export const useImageNodeLocalExport = ({
  activeTool,
  cancelCropMode,
  cropRect,
  cropStageMetrics,
  displayImageUrl,
  downloadImageBlob,
  exportImage = exportImageLocally,
  getFileName = () => 'image.png',
  hasNaturalDimensions = () => true,
  messageApi = () => typeof window === 'undefined' ? null : window.$message,
  startCropMode
} = {}) => {
  const localExportMode = ref(false)
  const localExportRatio = ref('')
  const localExportBusy = ref(false)
  const localExportCropActive = computed(() => localExportMode.value && read(activeTool) === 'crop')
  const startLocalExportCrop = async (ratio) => {
    if (!read(hasNaturalDimensions) || !read(displayImageUrl) || localExportBusy.value || !IMAGE_EXPORT_RATIO_OPTIONS.some((item) => item.key === ratio)) return
    localExportMode.value = true
    localExportRatio.value = ratio
    await startCropMode(ratio)
  }
  const startEditingCrop = async () => {
    if (localExportBusy.value) return
    localExportMode.value = false
    localExportRatio.value = ''
    await startCropMode()
  }
  const downloadLocalImage = async (maxEdge = 0) => {
    const source = read(displayImageUrl)
    if (!source || localExportBusy.value || !IMAGE_EXPORT_SIZE_OPTIONS.some((item) => item.key === maxEdge)) return
    if (read(activeTool) === 'crop' && !read(hasNaturalDimensions)) return
    localExportBusy.value = true
    try {
      const cropped = read(activeTool) === 'crop'
      const metrics = read(cropStageMetrics) || {}
      const result = await exportImage({
        source,
        maxEdge,
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
  return { downloadLocalImage, localExportBusy, localExportCropActive, localExportRatio, startEditingCrop, startLocalExportCrop }
}
