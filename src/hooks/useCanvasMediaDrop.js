import { nextTick } from 'vue'
import { getImageDimensionsFromFile } from '@/utils/imageDimensions.js'
import { getCanvasAutoPlacementPosition } from '@/utils/canvasInteraction.js'
import {
  createCanvasDroppedImageNodeData,
  createCanvasDroppedImageSaveFeedbackPatch,
  createCanvasDroppedImageUploadedPatch,
  createCanvasDroppedImageUploadFailurePatch,
  createCanvasDroppedVideoNodeData,
  createCanvasDroppedVideoUploadedPatch,
  createCanvasDroppedVideoUploadFailurePatch,
  getCanvasMediaDropFiles,
  getCanvasMediaDropOrigin,
  getCanvasMediaDropPosition,
  hasCanvasFileDrag,
  shouldHandleCanvasMediaDrag
} from '@/utils/canvasMediaDrop.js'

const readReactiveValue = (source) => {
  if (typeof source === 'function') return source()
  if (source && typeof source === 'object' && 'value' in source) return source.value
  return source
}

const getDefaultUrlApi = () => (typeof window === 'undefined' ? globalThis.URL : window.URL)

const safeNotify = (notify, type, message) => {
  if (!message) return
  notify?.[type]?.(message)
}

const preventDropNavigation = (event = {}) => {
  event.preventDefault?.()
  event.stopPropagation?.()
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'copy'
  }
}

const getUploadSource = (kind) => (kind === 'video' ? 'canvas_drop_video' : 'canvas_drop_image')

const getUploadFailureMessage = (kind, error) => {
  const fallback = kind === 'video'
    ? 'Video upload failed. The selected file is only shown temporarily.'
    : 'Image upload failed. The selected file is only shown temporarily.'
  return error?.message ? `${kind === 'video' ? 'Video' : 'Image'} upload failed: ${error.message}` : fallback
}

export const useCanvasMediaDrop = ({
  addNode = () => '',
  createObjectURL = (file) => getDefaultUrlApi()?.createObjectURL?.(file) || '',
  currentProjectId = '',
  flushSave = async () => false,
  getImageDimensions = getImageDimensionsFromFile,
  getNow = () => Date.now(),
  nextTickFn = nextTick,
  nodes = [],
  notify = null,
  revokeObjectURL = (url) => getDefaultUrlApi()?.revokeObjectURL?.(url),
  updateNode = () => {},
  updateNodeInternals = () => {},
  uploadMediaFile = async () => '',
  viewport = {}
} = {}) => {
  const createPreviewUrl = (file) => {
    try {
      return createObjectURL(file) || ''
    } catch {
      return ''
    }
  }

  const revokePreviewUrl = (url) => {
    if (!url) return
    try {
      revokeObjectURL(url)
    } catch {
      // Object URL cleanup should never break the drop flow.
    }
  }

  const getDroppedNodePosition = ({ origin, index, type, data }) =>
    getCanvasAutoPlacementPosition({
      preferredPosition: getCanvasMediaDropPosition({ origin, index }),
      nodeType: type,
      nodeData: data,
      existingNodes: readReactiveValue(nodes) || []
    })

  const createDroppedNode = async ({ entry, origin, index }) => {
    const previewUrl = createPreviewUrl(entry.file)

    if (entry.kind === 'video') {
      const data = createCanvasDroppedVideoNodeData({
        file: entry.file,
        previewUrl,
        now: getNow()
      })
      const position = getDroppedNodePosition({ origin, index, type: 'video', data })
      const nodeId = addNode('video', position, data)
      return { ...entry, nodeId, previewUrl }
    }

    let dimensions = { width: 0, height: 0 }
    try {
      dimensions = await getImageDimensions(entry.file)
    } catch {
      dimensions = { width: 0, height: 0 }
    }

    const data = createCanvasDroppedImageNodeData({
      file: entry.file,
      previewUrl,
      dimensions,
      now: getNow()
    })
    const position = getDroppedNodePosition({ origin, index, type: 'image', data })
    const nodeId = addNode('image', position, data)
    return { ...entry, nodeId, previewUrl }
  }

  const uploadDroppedNode = async ({ kind, file, nodeId, previewUrl }) => {
    if (!nodeId) return false

    try {
      const uploadedUrl = await uploadMediaFile(file, {
        projectId: readReactiveValue(currentProjectId),
        source: getUploadSource(kind),
        sourceNodeId: nodeId
      })
      if (!uploadedUrl) throw new Error('No URL returned')

      updateNode(nodeId, kind === 'video'
        ? createCanvasDroppedVideoUploadedPatch({ file, uploadedUrl, now: getNow() })
        : createCanvasDroppedImageUploadedPatch({ file, uploadedUrl, now: getNow() }))
      revokePreviewUrl(previewUrl)

      const saved = await flushSave()
      if (kind === 'image') {
        updateNode(nodeId, createCanvasDroppedImageSaveFeedbackPatch({ saved, now: getNow() }))
      }
      return saved
    } catch (error) {
      updateNode(nodeId, kind === 'video'
        ? createCanvasDroppedVideoUploadFailurePatch({ message: getUploadFailureMessage(kind, error), now: getNow() })
        : createCanvasDroppedImageUploadFailurePatch({ message: getUploadFailureMessage(kind, error), now: getNow() }))
      await flushSave()
      return false
    }
  }

  const handleCanvasMediaDragOver = (event) => {
    if (!shouldHandleCanvasMediaDrag(event?.dataTransfer)) return
    preventDropNavigation(event)
  }

  const handleCanvasMediaDrop = async (event) => {
    if (!hasCanvasFileDrag(event?.dataTransfer)) return []
    preventDropNavigation(event)

    const entries = getCanvasMediaDropFiles(event.dataTransfer)
    if (!entries.length) {
      safeNotify(notify, 'warning', '拖拽文件中没有可创建的图片或视频')
      return []
    }

    const origin = getCanvasMediaDropOrigin({
      event,
      viewport: readReactiveValue(viewport) || {}
    })
    const created = []

    for (let index = 0; index < entries.length; index += 1) {
      created.push(await createDroppedNode({ entry: entries[index], origin, index }))
    }

    await nextTickFn()
    created.forEach((item) => {
      if (item.nodeId) updateNodeInternals(item.nodeId)
    })
    await flushSave()

    for (const item of created) {
      await uploadDroppedNode(item)
    }

    safeNotify(notify, 'success', `已从拖拽创建 ${created.length} 个媒体节点`)
    return created
  }

  return {
    handleCanvasMediaDragOver,
    handleCanvasMediaDrop
  }
}

export default useCanvasMediaDrop
