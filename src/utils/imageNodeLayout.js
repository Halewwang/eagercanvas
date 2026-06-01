const BASE_SIZE_BY_RATIO = {
  '1:1': { w: 1024, h: 1024 },
  '3:2': { w: 1152, h: 768 },
  '2:3': { w: 768, h: 1152 },
  '4:3': { w: 1152, h: 864 },
  '3:4': { w: 864, h: 1152 },
  '4:5': { w: 896, h: 1120 },
  '5:4': { w: 1120, h: 896 },
  '16:9': { w: 1280, h: 720 },
  '9:16': { w: 720, h: 1280 },
  '21:9': { w: 1680, h: 720 }
}

const STAGE_SIZE_BY_RATIO = {
  '1:1': { width: 320, height: 320 },
  '3:2': { width: 360, height: 240 },
  '2:3': { width: 240, height: 360 },
  '16:9': { width: 420, height: 236 },
  '9:16': { width: 260, height: 462 },
  '4:3': { width: 360, height: 270 },
  '3:4': { width: 280, height: 373 },
  '4:5': { width: 280, height: 350 },
  '5:4': { width: 350, height: 280 },
  '21:9': { width: 420, height: 180 }
}

const getSizeParts = (sizeKey) => String(sizeKey || '').split('x').map(Number)
const clampPercent = (value) => Math.max(0, Math.min(100, Number(value) || 0))

export const getImageNodeProgressPercent = (progress = 0) => Math.round(Number(progress) || 0)

export const getImageNodeProgressBarStyle = (progress = 0) => ({
  width: `${clampPercent(progress)}%`
})

export const getImageNodeProgressNextValue = (progress = 0) => {
  const current = Number(progress) || 0
  let next = current
  if (current < 70) next += 3
  else if (current < 90) next += 1.2
  else if (current < 98) next += 0.35
  return Math.min(next, 98)
}

export const getImageNodeFinishProgressNextValue = (progress = 0) => (
  Math.min(100, (Number(progress) || 0) + 4.5)
)

export const getImageNodeUploadProgressStyle = ({
  progress = 0,
  stage = 'idle'
} = {}) => {
  const color =
    stage === 'error'
      ? '#c46a5c'
      : stage === 'success'
        ? '#8b9272'
        : '#d8dbe0'

  return {
    width: `${clampPercent(progress)}%`,
    background: color
  }
}

export const getImageNodeToolOptions = ({
  hasDisplayImage = false,
  isUploading = false,
  isToolBusy = false
} = {}) => {
  const hasImage = Boolean(hasDisplayImage)
  const busy = Boolean(isToolBusy)
  const imageToolDisabled = !hasImage || busy

  return [
    {
      label: hasImage ? 'Replace' : 'Upload Image',
      key: 'replace-image',
      disabled: Boolean(isUploading)
    },
    {
      label: 'Cutout',
      key: 'remove-background',
      disabled: imageToolDisabled
    },
    {
      label: 'Crop',
      key: 'crop',
      disabled: imageToolDisabled
    },
    {
      label: 'Upscale',
      key: 'enhance-4k',
      disabled: imageToolDisabled,
      description: 'Reuse original model and inputs, increase resolution only'
    },
    {
      label: '3D Camera',
      key: 'multi-angle',
      disabled: imageToolDisabled
    },
    {
      label: 'Theme Set',
      key: 'wedding-3x3',
      disabled: imageToolDisabled
    }
  ]
}

export const getImageNodeRatioFromSizeKey = (sizeKey) => {
  if (String(sizeKey || '').trim().toLowerCase() === 'auto') return 'auto'
  const [w, h] = getSizeParts(sizeKey)
  if (!w || !h) return '1:1'
  const ratio = w / h
  if (Math.abs(ratio - 1) < 0.02) return '1:1'
  if (Math.abs(ratio - 3 / 2) < 0.03) return '3:2'
  if (Math.abs(ratio - 2 / 3) < 0.03) return '2:3'
  if (Math.abs(ratio - 16 / 9) < 0.03) return '16:9'
  if (Math.abs(ratio - 9 / 16) < 0.03) return '9:16'
  if (Math.abs(ratio - 4 / 3) < 0.03) return '4:3'
  if (Math.abs(ratio - 3 / 4) < 0.03) return '3:4'
  if (Math.abs(ratio - 4 / 5) < 0.03) return '4:5'
  if (Math.abs(ratio - 5 / 4) < 0.03) return '5:4'
  if (Math.abs(ratio - 21 / 9) < 0.03) return '21:9'
  return '1:1'
}

export const getImageNodeResolutionFromSizeKey = (sizeKey) => {
  if (String(sizeKey || '').trim().toLowerCase() === 'auto') return '1k'
  const [w, h] = getSizeParts(sizeKey)
  if (!w || !h) return '1k'
  const ratio = getImageNodeRatioFromSizeKey(sizeKey)
  const base = BASE_SIZE_BY_RATIO[ratio] || BASE_SIZE_BY_RATIO['1:1']
  const scale = Math.max(w / base.w, h / base.h)
  if (scale >= 3.5) return '4k'
  if (scale >= 1.8) return '2k'
  return '1k'
}

export const getImageNodeSelectOptions = (
  items = [],
  { uppercaseFallback = false } = {}
) => (Array.isArray(items) ? items : []).map((item) => {
  const key = item?.key
  const fallbackLabel = String(key || '')
  return {
    key,
    label: item?.label || (uppercaseFallback ? fallbackLabel.toUpperCase() : fallbackLabel)
  }
})

export const getImageNodeSizeMetaOptions = (imageSizeOptions = []) => (
  Array.isArray(imageSizeOptions) ? imageSizeOptions : []
).map((opt) => {
  const key = String(opt?.key || '')
  const [w, h] = getSizeParts(key)
  return {
    key,
    ratio: getImageNodeRatioFromSizeKey(key),
    resolutionKey: getImageNodeResolutionFromSizeKey(key),
    pixels: (w || 0) * (h || 0)
  }
})

export const getImageNodeRatioDropdownOptions = ({
  isGptImage2Model = false,
  gptImage2RatioOptions = [],
  hideRatioCapsule = false,
  sizeMetaOptions = []
} = {}) => {
  if (isGptImage2Model) return getImageNodeSelectOptions(gptImage2RatioOptions)
  if (hideRatioCapsule) return []

  const seen = new Set()
  return (Array.isArray(sizeMetaOptions) ? sizeMetaOptions : [])
    .map((opt) => opt.ratio)
    .filter((ratio) => {
      if (seen.has(ratio)) return false
      seen.add(ratio)
      return true
    })
    .map((ratio) => ({ key: ratio, label: ratio }))
}

export const getImageNodeResolutionDropdownOptions = ({
  modelResolutions = [],
  sizeMetaOptions = [],
  imageRatio = ''
} = {}) => {
  if (Array.isArray(modelResolutions) && modelResolutions.length > 0) {
    return getImageNodeSelectOptions(modelResolutions, { uppercaseFallback: true })
  }

  const seen = new Set()
  const list = (Array.isArray(sizeMetaOptions) ? sizeMetaOptions : [])
    .filter((opt) => opt.ratio === imageRatio)
    .sort((a, b) => a.pixels - b.pixels)
    .filter((opt) => {
      if (seen.has(opt.resolutionKey)) return false
      seen.add(opt.resolutionKey)
      return true
    })
    .map((opt) => ({ key: opt.resolutionKey, label: opt.resolutionKey.toUpperCase() }))

  return list.length > 0 ? list : [{ key: '1k', label: '1K' }]
}

export const getImageNodeAdvancedDropdownOptions = ({
  enabled = false,
  items = []
} = {}) => {
  if (!enabled) return []
  return getImageNodeSelectOptions(items)
}

export const getImageNodeOptionDisplayLabel = (options = [], value = '') => (
  (Array.isArray(options) ? options : []).find((item) => item.key === value)?.label || value
)

export const getImageNodeControlDisplayLabel = ({
  enabled = false,
  options = [],
  value = '',
  placeholderValue = '',
  placeholderLabel = ''
} = {}) => {
  const displayLabel = getImageNodeOptionDisplayLabel(options, value)
  if (!enabled) return displayLabel
  return value === placeholderValue ? placeholderLabel : displayLabel
}

export const getImageNodeRatioDisplayLabel = ({
  isGptImage2Model = false,
  ratio = ''
} = {}) => {
  if (isGptImage2Model && ratio === 'auto') return 'Auto'
  return ratio
}

const resolveGptImageNodeSize = ({
  ratio,
  resolution,
  resolveGptImage2Size,
  defaultImageSize
}) => {
  if (ratio === 'auto') return 'auto'
  if (typeof resolveGptImage2Size === 'function') {
    return resolveGptImage2Size({ ratio, resolution })
  }
  return defaultImageSize
}

const getImageNodeSizeCandidates = ({ ratioKey = '', sizeMetaOptions = [] } = {}) => {
  const options = Array.isArray(sizeMetaOptions) ? sizeMetaOptions : []
  const ratioCandidates = options.filter((opt) => opt.ratio === ratioKey)
  return ratioCandidates.length > 0 ? ratioCandidates : options
}

const getLowestPixelImageNodeSize = (candidates = []) => (
  [...candidates].sort((a, b) => a.pixels - b.pixels)[0]
)

export const getImageNodeSizeSelection = ({
  ratioKey = '',
  resolutionKey = '',
  isGptImage2Model = false,
  sizeMetaOptions = [],
  defaultImageSize = '1024x1024',
  resolveGptImage2Size
} = {}) => {
  if (isGptImage2Model) {
    const ratio = ratioKey || '1:1'
    const resolution = resolutionKey || '1k'
    return {
      key: resolveGptImageNodeSize({
        ratio,
        resolution,
        resolveGptImage2Size,
        defaultImageSize
      }),
      ratio,
      resolution
    }
  }

  const candidates = getImageNodeSizeCandidates({ ratioKey, sizeMetaOptions })
  if (candidates.length === 0) return { key: defaultImageSize }

  const exact = candidates.find((opt) => opt.resolutionKey === resolutionKey)
  const picked = exact || getLowestPixelImageNodeSize(candidates)
  return {
    key: picked.key,
    ratio: picked.ratio,
    resolution: picked.resolutionKey
  }
}

export const getImageNodeNearestSizeKey = ({
  ratioKey = '',
  resolutionKey = '',
  isGptImage2Model = false,
  sizeMetaOptions = [],
  defaultImageSize = '1024x1024',
  resolveGptImage2Size
} = {}) => {
  if (isGptImage2Model) {
    return resolveGptImageNodeSize({
      ratio: ratioKey,
      resolution: resolutionKey,
      resolveGptImage2Size,
      defaultImageSize
    })
  }

  return getImageNodeSizeSelection({
    ratioKey,
    resolutionKey,
    sizeMetaOptions,
    defaultImageSize
  }).key
}

export const getImageNodeStageRatio = ({ ratio = '', size = '' } = {}) => {
  const explicitRatio = String(ratio || '')
  if (explicitRatio.includes(':')) return explicitRatio

  const [w, h] = getSizeParts(size)
  if (!w || !h) return '1:1'
  const sizeRatio = w / h
  if (Math.abs(sizeRatio - 1) < 0.05) return '1:1'
  if (Math.abs(sizeRatio - 16 / 9) < 0.05) return '16:9'
  if (Math.abs(sizeRatio - 9 / 16) < 0.05) return '9:16'
  if (Math.abs(sizeRatio - 4 / 3) < 0.05) return '4:3'
  if (Math.abs(sizeRatio - 3 / 4) < 0.05) return '3:4'
  return `${w}:${h}`
}

export const getImageNodeStageSize = ({ ratio = '', size = '' } = {}) => {
  const stageRatio = getImageNodeStageRatio({ ratio, size })
  if (STAGE_SIZE_BY_RATIO[stageRatio]) return STAGE_SIZE_BY_RATIO[stageRatio]

  const [w, h] = stageRatio.includes(':') ? stageRatio.split(':').map(Number) : [1, 1]
  if (!w || !h) return STAGE_SIZE_BY_RATIO['1:1']

  const scale = Math.min(420 / w, 462 / h)
  return {
    width: Math.round(w * scale),
    height: Math.round(h * scale)
  }
}

export const getImageNodeStageStyle = (options = {}) => {
  const size = getImageNodeStageSize(options)
  return {
    width: `${size.width}px`,
    height: `${size.height}px`
  }
}

export const getImagePreviewViewportSize = (stageSize = {}) => ({
  width: Math.max(0, (Number(stageSize?.width) || 0) - 40),
  height: Math.max(0, (Number(stageSize?.height) || 0) - 40)
})

export const getImagePreviewRenderedSize = ({
  naturalSize = {},
  viewportSize = {},
  windowSize = {},
  zoom = 1
} = {}) => {
  const naturalWidth = Number(naturalSize?.width) || 1
  const naturalHeight = Number(naturalSize?.height) || 1
  const viewportWidth = Number(viewportSize?.width) || 0
  const viewportHeight = Number(viewportSize?.height) || 0
  const maxWidth = Math.max(320, viewportWidth || (Number(windowSize?.width) || 0) - 180)
  const maxHeight = Math.max(240, viewportHeight || (Number(windowSize?.height) || 0) - 220)
  const fitScale = Math.min(maxWidth / naturalWidth, maxHeight / naturalHeight, 1)
  const safeZoom = Number(zoom) || 1

  return {
    width: Math.max(1, Math.round(naturalWidth * fitScale * safeZoom)),
    height: Math.max(1, Math.round(naturalHeight * fitScale * safeZoom))
  }
}

export const getImagePreviewCanvasSize = ({
  viewportSize = {},
  renderedSize = {}
} = {}) => ({
  width: Math.max(Number(viewportSize?.width) || 0, Number(renderedSize?.width) || 0),
  height: Math.max(Number(viewportSize?.height) || 0, Number(renderedSize?.height) || 0)
})

export const getImagePreviewCanvasStyle = (options = {}) => {
  const size = getImagePreviewCanvasSize(options)
  return {
    width: `${size.width}px`,
    height: `${size.height}px`
  }
}

export const getImagePreviewCenteredScroll = ({
  canvasSize = {},
  stageSize = {}
} = {}) => ({
  left: Math.max(0, (Number(canvasSize?.width) || 0) - (Number(stageSize?.width) || 0)) / 2,
  top: Math.max(0, (Number(canvasSize?.height) || 0) - (Number(stageSize?.height) || 0)) / 2
})

export const normalizeImagePreviewZoom = (
  nextZoom,
  { min = 0.75, max = 4 } = {}
) => Math.max(min, Math.min(max, Number(Number(nextZoom).toFixed(2))))

export const getImagePreviewZoomFocus = ({
  scroll = {},
  stageSize = {},
  canvasSize = {}
} = {}) => {
  const canvasWidth = Number(canvasSize?.width) || 0
  const canvasHeight = Number(canvasSize?.height) || 0
  if (canvasWidth <= 0 || canvasHeight <= 0) return { x: 0.5, y: 0.5 }

  return {
    x: ((Number(scroll?.left) || 0) + ((Number(stageSize?.width) || 0) / 2)) / canvasWidth,
    y: ((Number(scroll?.top) || 0) + ((Number(stageSize?.height) || 0) / 2)) / canvasHeight
  }
}

export const getImagePreviewZoomScroll = ({
  focus = {},
  stageSize = {},
  canvasSize = {}
} = {}) => ({
  left: Math.max(0, ((Number(canvasSize?.width) || 0) * (Number(focus?.x) || 0)) - ((Number(stageSize?.width) || 0) / 2)),
  top: Math.max(0, ((Number(canvasSize?.height) || 0) * (Number(focus?.y) || 0)) - ((Number(stageSize?.height) || 0) / 2))
})

export const getImageNodeCropStageMetrics = ({
  stageStyle = {},
  naturalSize = {}
} = {}) => {
  const frameWidth = Math.max(1, (Number.parseFloat(stageStyle?.width) || 0) - 24)
  const frameHeight = Math.max(1, (Number.parseFloat(stageStyle?.height) || 0) - 24)
  const naturalWidth = Number(naturalSize?.width) || frameWidth
  const naturalHeight = Number(naturalSize?.height) || frameHeight
  const scale = Math.max(frameWidth / naturalWidth, frameHeight / naturalHeight)
  const displayWidth = naturalWidth * scale
  const displayHeight = naturalHeight * scale

  return {
    frameWidth,
    frameHeight,
    naturalWidth,
    naturalHeight,
    scale,
    offsetX: (frameWidth - displayWidth) / 2,
    offsetY: (frameHeight - displayHeight) / 2
  }
}

export const getImageNodeInitialCropRect = ({
  metrics = {},
  fillRatio = 0.72
} = {}) => {
  const frameWidth = Number(metrics?.frameWidth) || 0
  const frameHeight = Number(metrics?.frameHeight) || 0
  if (!frameWidth || !frameHeight) return null

  const width = Math.round(frameWidth * fillRatio)
  const height = Math.round(frameHeight * fillRatio)
  return {
    x: Math.round((frameWidth - width) / 2),
    y: Math.round((frameHeight - height) / 2),
    width,
    height
  }
}

export const normalizeImageNodeCropRect = ({
  rect = {},
  metrics = {},
  minSize = 48
} = {}) => {
  const maxWidth = Number(metrics?.frameWidth) || 0
  const maxHeight = Number(metrics?.frameHeight) || 0
  const width = Math.max(minSize, Math.min(Number(rect?.width) || 0, maxWidth))
  const height = Math.max(minSize, Math.min(Number(rect?.height) || 0, maxHeight))
  const x = Math.max(0, Math.min(Number(rect?.x) || 0, Math.max(0, maxWidth - width)))
  const y = Math.max(0, Math.min(Number(rect?.y) || 0, Math.max(0, maxHeight - height)))
  return { x, y, width, height }
}

export const getImageNodeCropInteractionRect = ({
  interaction = null,
  pointer = {},
  metrics = {},
  minSize = 48
} = {}) => {
  if (!interaction) return null

  const deltaX = (Number(pointer?.x) || 0) - (Number(interaction?.startPointerX) || 0)
  const deltaY = (Number(pointer?.y) || 0) - (Number(interaction?.startPointerY) || 0)
  const startRect = interaction?.startRect || {}

  if (interaction?.type === 'drag') {
    return normalizeImageNodeCropRect({
      rect: {
        x: (Number(startRect?.x) || 0) + deltaX,
        y: (Number(startRect?.y) || 0) + deltaY,
        width: Number(startRect?.width) || 0,
        height: Number(startRect?.height) || 0
      },
      metrics,
      minSize
    })
  }

  if (interaction?.type !== 'resize') return null

  const handle = String(interaction?.handle || '')
  const nextRect = {
    x: Number(startRect?.x) || 0,
    y: Number(startRect?.y) || 0,
    width: Number(startRect?.width) || 0,
    height: Number(startRect?.height) || 0
  }

  if (handle.includes('n')) {
    nextRect.y += deltaY
    nextRect.height -= deltaY
  }
  if (handle.includes('s')) {
    nextRect.height += deltaY
  }
  if (handle.includes('w')) {
    nextRect.x += deltaX
    nextRect.width -= deltaX
  }
  if (handle.includes('e')) {
    nextRect.width += deltaX
  }

  return normalizeImageNodeCropRect({ rect: nextRect, metrics, minSize })
}

export const getImageNodeCropSourceRect = ({
  cropRect = {},
  metrics = {},
  naturalSize = {}
} = {}) => {
  const naturalWidth = Number(naturalSize?.width) || Number(metrics?.naturalWidth) || 1
  const naturalHeight = Number(naturalSize?.height) || Number(metrics?.naturalHeight) || 1
  const scale = Number(metrics?.scale) || 1
  const sourceX = Math.max(0, Math.round(((Number(cropRect?.x) || 0) - (Number(metrics?.offsetX) || 0)) / scale))
  const sourceY = Math.max(0, Math.round(((Number(cropRect?.y) || 0) - (Number(metrics?.offsetY) || 0)) / scale))
  const x = Math.min(naturalWidth - 1, sourceX)
  const y = Math.min(naturalHeight - 1, sourceY)
  const width = Math.max(1, Math.min(naturalWidth - x, Math.round((Number(cropRect?.width) || 0) / scale)))
  const height = Math.max(1, Math.min(naturalHeight - y, Math.round((Number(cropRect?.height) || 0) / scale)))

  return { x, y, width, height }
}

export const getImageNodeRatioLabel = (width, height) => {
  const safeWidth = Number(width) || 0
  const safeHeight = Number(height) || 0
  if (!safeWidth || !safeHeight) return '1:1'

  const gcd = (a, b) => (b ? gcd(b, a % b) : a)
  const divisor = gcd(safeWidth, safeHeight)
  return `${Math.round(safeWidth / divisor)}:${Math.round(safeHeight / divisor)}`
}

const px = (value) => `${Number(value) || 0}px`

export const getImageNodeCropBoxStyle = (cropRect = {}) => ({
  left: px(cropRect?.x),
  top: px(cropRect?.y),
  width: px(cropRect?.width),
  height: px(cropRect?.height)
})

export const getImageNodeCropMaskStyles = ({
  cropRect = {},
  metrics = {}
} = {}) => {
  const x = Number(cropRect?.x) || 0
  const y = Number(cropRect?.y) || 0
  const width = Number(cropRect?.width) || 0
  const height = Number(cropRect?.height) || 0
  const frameWidth = Number(metrics?.frameWidth) || 0
  const frameHeight = Number(metrics?.frameHeight) || 0

  return {
    top: {
      left: '0px',
      top: '0px',
      width: px(frameWidth),
      height: px(y)
    },
    left: {
      left: '0px',
      top: px(y),
      width: px(x),
      height: px(height)
    },
    right: {
      left: px(x + width),
      top: px(y),
      width: px(Math.max(0, frameWidth - x - width)),
      height: px(height)
    },
    bottom: {
      left: '0px',
      top: px(y + height),
      width: px(frameWidth),
      height: px(Math.max(0, frameHeight - y - height))
    }
  }
}
