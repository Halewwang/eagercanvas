import { getImageRatioFromDimensions, getFlowPointFromScreenPoint, getCanvasNodeGridPosition } from './canvasInteraction.js'

const IMAGE_EXTENSION_PATTERN = /\.(avif|bmp|gif|heic|heif|jpeg|jpg|png|svg|webp)$/i
const VIDEO_EXTENSION_PATTERN = /\.(avi|m4v|mkv|mov|mp4|mpeg|mpg|ogv|quicktime|webm)$/i

const toArray = (value) => Array.from(value || [])

const getFileName = (file = {}) => String(file?.name || '').trim()
const getFileType = (file = {}) => String(file?.type || '').trim().toLowerCase()

export const getCanvasMediaFileKind = (file = {}) => {
  const fileType = getFileType(file)
  if (fileType.startsWith('image/')) return 'image'
  if (fileType.startsWith('video/')) return 'video'

  const fileName = getFileName(file)
  if (IMAGE_EXTENSION_PATTERN.test(fileName)) return 'image'
  if (VIDEO_EXTENSION_PATTERN.test(fileName)) return 'video'
  return ''
}

export const hasCanvasFileDrag = (dataTransfer = {}) => {
  if (toArray(dataTransfer?.files).length > 0) return true
  if (toArray(dataTransfer?.items).some((item) => item?.kind === 'file')) return true
  return toArray(dataTransfer?.types).includes('Files')
}

export const getCanvasMediaDropFiles = (dataTransfer = {}) => {
  const droppedFiles = toArray(dataTransfer?.files)
  const itemFiles = droppedFiles.length
    ? []
    : toArray(dataTransfer?.items)
        .filter((item) => item?.kind === 'file')
        .map((item) => {
          try {
            return item.getAsFile?.() || null
          } catch {
            return null
          }
        })

  return [...droppedFiles, ...itemFiles]
    .map((file) => {
      const kind = getCanvasMediaFileKind(file)
      return kind ? { kind, file } : null
    })
    .filter(Boolean)
}

export const shouldHandleCanvasMediaDrag = (dataTransfer = {}) => {
  if (!hasCanvasFileDrag(dataTransfer)) return false
  const files = toArray(dataTransfer?.files)
  if (!files.length) return true
  return getCanvasMediaDropFiles(dataTransfer).length > 0
}

export const getCanvasMediaDropOrigin = ({ event = {}, viewport = {} } = {}) =>
  getFlowPointFromScreenPoint({
    x: Number(event?.clientX) || 0,
    y: Number(event?.clientY) || 0
  }, viewport)

export const getCanvasMediaDropPosition = ({
  origin = {},
  index = 0
} = {}) =>
  getCanvasNodeGridPosition({
    origin,
    index,
    columns: 3,
    gapX: 160,
    gapY: 142
  })

export const createCanvasDroppedImageNodeData = ({
  file = {},
  previewUrl = '',
  dimensions = {},
  now = Date.now()
} = {}) => {
  const width = Number(dimensions?.width || 0)
  const height = Number(dimensions?.height || 0)

  return {
    url: previewUrl,
    previewUrl,
    base64: '',
    fileName: getFileName(file),
    fileType: getFileType(file) || 'image/png',
    label: 'Image',
    ratio: getImageRatioFromDimensions(width, height),
    size: width && height ? `${width}x${height}` : '',
    loading: false,
    error: '',
    persistStatus: 'uploading',
    persistError: '',
    sourceRefImages: previewUrl ? [previewUrl] : [],
    updatedAt: now
  }
}

export const createCanvasDroppedImageUploadedPatch = ({
  file = {},
  uploadedUrl = '',
  now = Date.now()
} = {}) => ({
  url: uploadedUrl,
  previewUrl: '',
  base64: '',
  fileName: getFileName(file),
  fileType: getFileType(file) || 'image/png',
  updatedAt: now,
  loading: false,
  error: '',
  persistStatus: 'saving',
  persistError: '',
  sourceRefImages: uploadedUrl ? [uploadedUrl] : []
})

export const createCanvasDroppedImageUploadFailurePatch = ({
  message = 'Image upload failed. The selected file is only shown temporarily.',
  now = Date.now()
} = {}) => ({
  loading: false,
  error: message,
  persistStatus: 'error',
  persistError: message,
  updatedAt: now
})

export const createCanvasDroppedImageSaveFeedbackPatch = ({
  saved = false,
  now = Date.now()
} = {}) => ({
  persistStatus: saved ? 'saved' : 'error',
  persistError: saved ? '' : 'Project save failed after upload. Please retry save.',
  updatedAt: now
})

export const createCanvasDroppedVideoNodeData = ({
  file = {},
  previewUrl = '',
  now = Date.now()
} = {}) => ({
  url: previewUrl,
  fileName: getFileName(file),
  fileType: getFileType(file) || 'video/mp4',
  label: 'Video',
  loading: false,
  error: '',
  updatedAt: now
})

export const createCanvasDroppedVideoUploadedPatch = ({
  file = {},
  uploadedUrl = '',
  now = Date.now()
} = {}) => ({
  url: uploadedUrl,
  fileName: getFileName(file),
  fileType: getFileType(file) || 'video/mp4',
  updatedAt: now,
  loading: false,
  error: ''
})

export const createCanvasDroppedVideoUploadFailurePatch = ({
  message = 'Video upload failed. The selected file is only shown temporarily.',
  now = Date.now()
} = {}) => ({
  loading: false,
  error: message,
  updatedAt: now
})
