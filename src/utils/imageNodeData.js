import { getImageRatioFromDimensions } from './imageDimensions.js'

const defaultInputLabels = {
  prompt: 'Prompt',
  reference: 'Reference Picture'
}

export const getImageNodeSourceRefImages = (...groups) => {
  const seen = new Set()
  return groups
    .flat()
    .map((value) => String(value || '').trim())
    .filter((value) => {
      if (!value || seen.has(value)) return false
      seen.add(value)
      return true
    })
}

export const getImageNodeActiveInputKeys = ({
  edges = [],
  nodes = [],
  targetNodeId = ''
} = {}) => {
  const activeKeys = []
  const nodeList = Array.isArray(nodes) ? nodes : []

  for (const edge of Array.isArray(edges) ? edges : []) {
    if (edge?.target !== targetNodeId) continue

    const source = nodeList.find((node) => node.id === edge.source)
    if (!source) continue
    if (source.type === 'text' && String(source.data?.content || '').trim()) activeKeys.push('prompt')
    if (source.type === 'image' && String(source.data?.previewUrl || source.data?.url || source.data?.base64 || '').trim()) {
      activeKeys.push('reference')
    }
  }

  return new Set(activeKeys)
}

export const getImageNodeInputStatusList = ({
  activeKeys = new Set(),
  labels = defaultInputLabels
} = {}) => {
  const activeSet = activeKeys instanceof Set ? activeKeys : new Set(activeKeys)
  return [
    { key: 'prompt', label: labels.prompt || defaultInputLabels.prompt, active: activeSet.has('prompt') },
    { key: 'reference', label: labels.reference || defaultInputLabels.reference, active: activeSet.has('reference') }
  ]
}

export const getImageNodePersistencePatch = (
  result,
  extra = {},
  { now = Date.now() } = {}
) => ({
  url: result?.persistedUrl || '',
  previewUrl: result?.persisted ? '' : (result?.displayUrl || ''),
  base64: '',
  persistStatus: result?.persisted ? 'saved' : 'pending',
  persistError: result?.persisted ? '' : (result?.persistError || ''),
  updatedAt: now,
  ...extra
})

export const getImageNodeCanvasSaveSnapshot = (state = {}) => ({
  localSaved: !!state.localSaved,
  remoteSynced: !!state.remoteSynced,
  hasTransientMedia: !!state.hasTransientMedia
})

export const getImageNodeSaveFeedback = (savedOk, state = {}) => {
  const snapshot = getImageNodeCanvasSaveSnapshot(state)

  if (savedOk || snapshot.remoteSynced) {
    return {
      persistStatus: 'saved',
      persistError: '',
      mode: 'synced'
    }
  }

  if (snapshot.localSaved && !snapshot.hasTransientMedia) {
    return {
      persistStatus: 'saved',
      persistError: '',
      mode: 'local-only'
    }
  }

  if (snapshot.hasTransientMedia) {
    return {
      persistStatus: 'error',
      persistError: 'Image uses a temporary address and was not fully saved.',
      mode: 'temporary'
    }
  }

  return {
    persistStatus: 'error',
    persistError: 'Project save failed. Refresh may lose this image.',
    mode: 'failed'
  }
}

export const getImageNodeSaveFeedbackPatch = ({
  saveFeedback = {},
  now = Date.now()
} = {}) => ({
  persistStatus: saveFeedback.persistStatus ?? '',
  persistError: saveFeedback.persistError ?? '',
  updatedAt: now
})

export const getImageNodeModelParamsPatch = ({
  model,
  size,
  quality,
  background,
  outputFormat,
  ratio,
  resolution
} = {}) => ({
  model,
  size,
  quality,
  background,
  output_format: outputFormat,
  ratio,
  resolution
})

export const getImageNodeSizeParamsPatch = ({
  size,
  ratio,
  resolution
} = {}) => ({
  size,
  ratio,
  resolution
})

const getImageNodeLinkedBaseData = ({
  payload = {},
  defaults = {},
  now = Date.now()
} = {}) => ({
  model: payload.model || defaults.model || '',
  quality: payload.quality || defaults.quality || '',
  size: payload.size || defaults.size || '',
  ratio: payload.ratio || defaults.ratio || '',
  resolution: payload.resolution || defaults.resolution || '',
  url: payload.url || '',
  previewUrl: payload.previewUrl || '',
  base64: payload.base64 || '',
  fileType: payload.fileType || 'image/png',
  loading: !!payload.loading,
  sourceConfigId: payload.sourceConfigId || '',
  sourcePrompt: payload.sourcePrompt || '',
  sourceRefImages: Array.isArray(payload.sourceRefImages) ? payload.sourceRefImages : [],
  error: payload.error || '',
  suppressErrorModal: !!payload.suppressErrorModal,
  persistStatus: payload.persistStatus || '',
  persistError: payload.persistError || '',
  updatedAt: now
})

export const getImageNodeLinkedCreateData = ({
  payload = {},
  defaults = {},
  now = Date.now()
} = {}) => ({
  ...getImageNodeLinkedBaseData({ payload, defaults, now }),
  label: payload.label || 'Image',
  error: ''
})

export const getImageNodeLinkedUpdatePatch = ({
  payload = {},
  defaults = {},
  now = Date.now()
} = {}) => ({
  ...getImageNodeLinkedBaseData({ payload, defaults, now }),
  ...(payload.label ? { label: payload.label } : {})
})

export const getImageNodeLinkedPosition = ({
  currentNode = null,
  stageWidth = '',
  fallbackWidth = 320,
  frameOffset = 2,
  gapX = 172
} = {}) => {
  if (!currentNode?.position) return null
  const moduleWidth = (Number.parseFloat(stageWidth) || fallbackWidth) + frameOffset
  return {
    x: currentNode.position.x + moduleWidth + gapX,
    y: currentNode.position.y
  }
}

export const getImageNodeLinkedSelectionState = ({
  nodes = [],
  selectedNodeId = ''
} = {}) => (
  (Array.isArray(nodes) ? nodes : []).map((node) => ({
    ...node,
    selected: node.id === selectedNodeId,
    data: {
      ...(node.data || {}),
      selected: node.id === selectedNodeId
    }
  }))
)

const getNodeById = (nodes = [], nodeId = '') => (
  (Array.isArray(nodes) ? nodes : []).find((node) => node.id === nodeId)
)

export const getNearestImageNodeSourceConfig = ({
  nodes = [],
  edges = [],
  startNodeId = '',
  visited = new Set()
} = {}) => {
  const safeId = String(startNodeId || '').trim()
  if (!safeId || visited.has(safeId)) return null
  visited.add(safeId)

  const currentNode = getNodeById(nodes, safeId)
  const directConfig = currentNode?.data?.sourceConfigId
  if (directConfig) {
    const sourceNode = getNodeById(nodes, directConfig)
    if (sourceNode?.type === 'imageConfig') return sourceNode
  }

  const incomingEdges = (Array.isArray(edges) ? edges : []).filter((edge) => edge.target === safeId)
  for (const edge of incomingEdges) {
    const sourceNode = getNodeById(nodes, edge.source)
    if (!sourceNode) continue
    if (sourceNode.type === 'imageConfig') return sourceNode
    if (sourceNode.type === 'image') {
      const nested = getNearestImageNodeSourceConfig({
        nodes,
        edges,
        startNodeId: sourceNode.id,
        visited
      })
      if (nested) return nested
    }
  }

  return null
}

export const getImageNodeEnhancementRequest = ({
  sourceConfig = null,
  sourceInputs = null,
  currentNodeData = {},
  displayImageUrl = '',
  localImageModel = '',
  localImageQuality = '',
  localImageRatio = '',
  localImageSize = '',
  projectId = '',
  defaultImageModel = '',
  defaultImageSize = '1024x1024',
  defaultEnhancePrompt = '',
  findNearestSizeKey,
  getRatioFromSizeKey
} = {}) => {
  const inheritedPrompt = String(currentNodeData?.sourcePrompt || '').trim()
  const inheritedRefs = Array.isArray(currentNodeData?.sourceRefImages)
    ? currentNodeData.sourceRefImages.filter(Boolean)
    : []
  const selfImage = String(displayImageUrl || '').trim()

  let prompt = inheritedPrompt
  let refImages = inheritedRefs

  if (sourceConfig?.id) {
    prompt = String(sourceInputs?.prompt || inheritedPrompt).trim()
    refImages = Array.isArray(sourceInputs?.refImages) && sourceInputs.refImages.length > 0
      ? sourceInputs.refImages.filter(Boolean)
      : inheritedRefs
  }

  refImages = getImageNodeSourceRefImages(refImages, selfImage ? [selfImage] : [])

  if (!prompt && refImages.length > 0) {
    prompt = defaultEnhancePrompt
  }

  if (!prompt && refImages.length === 0) {
    return null
  }

  const ratio = String(
    sourceConfig?.data?.ratio ||
    currentNodeData?.ratio ||
    localImageRatio ||
    (typeof getRatioFromSizeKey === 'function' ? getRatioFromSizeKey(localImageSize) : '') ||
    '1:1'
  ).trim()

  const baseSize = String(
    sourceConfig?.data?.size ||
    currentNodeData?.size ||
    localImageSize ||
    defaultImageSize
  ).trim()

  const nextSize = typeof findNearestSizeKey === 'function'
    ? findNearestSizeKey(ratio, '4k')
    : ''

  return {
    model: String(
      sourceConfig?.data?.model ||
      currentNodeData?.model ||
      localImageModel ||
      defaultImageModel
    ).trim(),
    projectId,
    prompt,
    size: nextSize || baseSize,
    quality: String(
      sourceConfig?.data?.quality ||
      currentNodeData?.quality ||
      localImageQuality ||
      'standard'
    ).trim(),
    ratio,
    aspect_ratio: ratio,
    resolution: '4k',
    image: refImages,
    sourceConfigId: sourceConfig?.id || currentNodeData?.sourceConfigId || '',
    sourcePrompt: prompt,
    sourceRefImages: refImages
  }
}

const imageNodeToolSaveMessages = {
  'enhance-4k': {
    synced: '4K enhanced image created',
    localOnly: '4K enhanced image saved in the current project',
    temporary: '4K result is only shown temporarily. Please retry until it is saved.',
    failed: 'Project save failed after 4K enhancement. Please retry save.'
  },
  'remove-background': {
    synced: 'Background removed and linked',
    localOnly: 'Background removed and saved in the current project',
    temporary: 'Background removed, but the result is only shown temporarily. Please retry.',
    failed: 'Background removed, but project save failed. Please retry save.'
  },
  'multi-angle-replace': {
    synced: 'Multi-angle result applied',
    localOnly: 'Multi-angle result saved in the current project',
    temporary: 'Multi-angle result is only shown temporarily. Please retry until it is saved.',
    failed: 'Image uploaded, but project save failed. Please retry save.'
  },
  'multi-angle-create': {
    synced: 'Multi-angle result created',
    localOnly: 'Multi-angle result saved in the current project',
    temporary: 'Multi-angle result is only shown temporarily. Please retry until it is saved.',
    failed: 'Project save failed after multi-angle generation. Please retry save.'
  },
  'wedding-3x3': {
    synced: 'Wedding 3x3 result created',
    localOnly: 'Wedding 3x3 result saved in the current project',
    temporary: 'Wedding 3x3 result is only shown temporarily. Please retry until it is saved.',
    failed: 'Project save failed after Wedding 3x3 generation. Please retry save.'
  }
}

export const getImageNodeToolSaveMessages = (key = '') => ({
  ...(imageNodeToolSaveMessages[String(key || '').trim()] || {})
})

export const getImageNodeToolSaveMessage = ({
  saveFeedback = {},
  saveState = {},
  persisted = true,
  messages = {}
} = {}) => {
  if (saveFeedback?.mode === 'synced') {
    return { type: 'success', text: messages.synced || '' }
  }

  if (saveFeedback?.mode === 'local-only') {
    return { type: 'success', text: messages.localOnly || '' }
  }

  if (saveState?.hasTransientMedia || !persisted || saveFeedback?.mode === 'temporary') {
    return { type: 'warning', text: messages.temporary || '' }
  }

  return { type: 'warning', text: messages.failed || '' }
}

export const getImageNodeToolPendingPatch = (payload = {}) => ({
  ...payload,
  loading: true,
  url: '',
  base64: '',
  error: '',
  suppressErrorModal: true
})

export const getImageNodeActionPendingPatch = () => ({
  loading: true,
  error: ''
})

export const getImageNodeActionErrorPatch = ({
  message = '',
  fallbackMessage = ''
} = {}) => ({
  loading: false,
  error: message || fallbackMessage
})

export const getImageNodeToolErrorPatch = ({
  payload = {},
  fallbackMessage = ''
} = {}) => ({
  url: '',
  base64: '',
  loading: false,
  error: payload?.message || fallbackMessage,
  suppressErrorModal: true
})

export const getImageNodeToolReplacementPatch = ({
  persistence = {},
  previousPersistedUrl = '',
  size = '',
  ratio = '',
  resolution = '',
  fileType = 'image/png',
  transientPersistError = '',
  now = Date.now()
} = {}) => ({
  ...(persistence?.persisted
    ? getImageNodePersistencePatch(persistence, {}, { now })
    : {
        url: previousPersistedUrl,
        previewUrl: persistence?.displayUrl || '',
        base64: '',
        persistStatus: 'error',
        persistError: transientPersistError || persistence?.persistError || '',
        updatedAt: now
      }),
  size,
  ratio,
  resolution,
  fileType: fileType || 'image/png',
  updatedAt: now,
  error: ''
})

export const getImageNodeToolLinkedResultPatch = ({
  persistence = {},
  payload = {},
  defaults = {},
  labelFallback = '',
  includeQuality = false,
  includeSource = false,
  transientPersistError = '',
  now = Date.now()
} = {}) => ({
  ...getImageNodePersistencePatch(persistence, {}, { now }),
  loading: false,
  shouldSave: !!persistence?.persisted,
  error: '',
  suppressErrorModal: false,
  ...(labelFallback ? { label: payload.label || labelFallback } : {}),
  fileType: payload.fileType || 'image/png',
  size: payload.size || defaults.size || '',
  ratio: payload.ratio || defaults.ratio || '',
  resolution: payload.resolution || defaults.resolution || '',
  ...(includeQuality ? { quality: payload.quality || defaults.quality || '' } : {}),
  ...(includeSource
    ? {
        sourcePrompt: payload.sourcePrompt || '',
        sourceRefImages: Array.isArray(payload.sourceRefImages) ? payload.sourceRefImages : []
      }
    : {}),
  persistError: persistence?.persisted ? '' : (transientPersistError || persistence?.persistError || '')
})

export const getImageNodeToolLinkedCreatePatch = ({
  persistence = {},
  payload = {},
  defaults = {},
  labelFallback = '',
  includeQuality = false,
  includeSource = false,
  now = Date.now()
} = {}) => ({
  ...getImageNodePersistencePatch(persistence, {}, { now }),
  ...(labelFallback ? { label: payload.label || labelFallback } : {}),
  fileType: payload.fileType || 'image/png',
  size: payload.size || defaults.size || '',
  ratio: payload.ratio || defaults.ratio || '',
  resolution: payload.resolution || defaults.resolution || '',
  ...(includeQuality ? { quality: payload.quality || defaults.quality || '' } : {}),
  ...(includeSource
    ? {
        sourcePrompt: payload.sourcePrompt || '',
        sourceRefImages: Array.isArray(payload.sourceRefImages) ? payload.sourceRefImages : []
      }
    : {})
})

export const getImageNodeEnhancementResultPatch = ({
  persistence = {},
  request = {},
  now = Date.now()
} = {}) => ({
  ...getImageNodePersistencePatch(persistence, {}, { now }),
  loading: false,
  shouldSave: !!persistence?.persisted,
  fileType: 'image/png',
  size: request.size || '',
  ratio: request.ratio || '',
  resolution: request.resolution || '',
  sourceConfigId: request.sourceConfigId || '',
  sourcePrompt: request.sourcePrompt || '',
  sourceRefImages: Array.isArray(request.sourceRefImages) ? request.sourceRefImages : []
})

export const getImageNodeEnhancementErrorPatch = ({
  message = '',
  request = {},
  fallbackMessage = ''
} = {}) => ({
  loading: false,
  error: message || fallbackMessage,
  size: request.size || '',
  ratio: request.ratio || '',
  resolution: request.resolution || '',
  sourceConfigId: request.sourceConfigId || '',
  sourcePrompt: request.sourcePrompt || '',
  sourceRefImages: Array.isArray(request.sourceRefImages) ? request.sourceRefImages : []
})

export const getImageNodeRemoveBackgroundResultPatch = ({
  persistence = {},
  defaults = {},
  now = Date.now()
} = {}) => ({
  ...getImageNodePersistencePatch(persistence, {}, { now }),
  size: defaults.size || '',
  ratio: defaults.ratio || '',
  resolution: defaults.resolution || '',
  fileType: 'image/png'
})

export const getImageNodeGenerationSaveMessage = ({
  saveFeedback = {},
  saveState = {},
  savedOk = false,
  mode = 'create'
} = {}) => {
  const isRegenerate = mode === 'regenerate'
  const temporaryMessage = 'Image generated, but the result is still temporary. Refresh may lose it.'
  const failedMessage = 'Image generated and uploaded, but project save failed. Please retry save.'

  if (saveFeedback?.mode === 'temporary') {
    return { type: 'warning', text: temporaryMessage }
  }

  if (saveFeedback?.mode === 'failed') {
    return { type: 'warning', text: failedMessage }
  }

  if (saveFeedback?.mode === 'local-only') {
    return {
      type: 'success',
      text: isRegenerate
        ? 'Image regenerated in the current project'
        : 'Image generated and saved in the current project'
    }
  }

  if (!savedOk) {
    return {
      type: 'warning',
      text: saveState?.hasTransientMedia ? temporaryMessage : failedMessage
    }
  }

  return {
    type: 'success',
    text: isRegenerate ? 'Image regenerated' : 'Image generated'
  }
}

export const getImageNodeReplacementSaveMessage = ({
  saveFeedback = {},
  saveState = {},
  savedOk = false
} = {}) => {
  const temporaryMessage = 'The new image is only shown temporarily. Refresh may lose it.'
  const failedMessage = 'Project save failed after image replacement.'

  if (saveFeedback?.mode === 'temporary') {
    return { type: 'warning', text: temporaryMessage }
  }

  if (saveFeedback?.mode === 'failed') {
    return { type: 'warning', text: failedMessage }
  }

  if (saveFeedback?.mode === 'local-only') {
    return {
      type: 'success',
      text: 'Image replacement saved in the current project'
    }
  }

  if (!savedOk) {
    return {
      type: 'warning',
      text: saveState?.hasTransientMedia ? temporaryMessage : failedMessage
    }
  }

  return null
}

const imageNodeReplacementErrorMessage = 'Image upload failed. The new result is only shown temporarily.'

export const getImageNodeReplacementPreviewPatch = ({
  previousPersistedUrl = '',
  previewSource = '',
  size = '',
  ratio = '',
  resolution = '',
  fileType = 'image/png',
  isLocalPreviewMode = false,
  now = Date.now()
} = {}) => ({
  url: previousPersistedUrl,
  previewUrl: previewSource,
  base64: '',
  size,
  ratio,
  resolution,
  fileType: fileType || 'image/png',
  updatedAt: now,
  error: '',
  persistStatus: isLocalPreviewMode ? 'saved' : 'saving',
  persistError: ''
})

export const getImageNodeReplacementUploadedPatch = ({
  uploadedUrl = '',
  now = Date.now()
} = {}) => ({
  url: uploadedUrl,
  previewUrl: '',
  base64: '',
  updatedAt: now,
  error: '',
  persistStatus: 'saving',
  persistError: ''
})

export const getImageNodeReplacementErrorPatch = ({
  previousPersistedUrl = '',
  previewSource = '',
  restorePreviewState = false,
  now = Date.now()
} = {}) => ({
  ...(restorePreviewState
    ? {
        url: previousPersistedUrl,
        previewUrl: previewSource,
        base64: ''
      }
    : {}),
  persistStatus: 'error',
  persistError: imageNodeReplacementErrorMessage,
  updatedAt: now
})

export const getImageNodeUploadSaveOutcome = ({
  saveFeedback = {},
  saveState = {}
} = {}) => {
  const uploadProgress = 100

  if (saveFeedback?.mode === 'synced') {
    return {
      uploadStage: 'success',
      uploadProgress,
      resetDelayMs: 900,
      message: {
        type: 'success',
        text: 'Upload complete and saved'
      }
    }
  }

  if (saveFeedback?.mode === 'local-only') {
    return {
      uploadStage: 'success',
      uploadProgress,
      resetDelayMs: 900,
      message: {
        type: 'success',
        text: 'Upload complete and saved in the current project'
      }
    }
  }

  if (saveFeedback?.mode === 'temporary') {
    return {
      uploadStage: 'error',
      uploadProgress,
      resetDelayMs: 2200,
      message: {
        type: 'warning',
        text: 'Upload succeeded, but the image is still temporary. Refresh may lose it.'
      }
    }
  }

  if (saveFeedback?.mode === 'failed') {
    return {
      uploadStage: 'error',
      uploadProgress,
      resetDelayMs: 2200,
      message: {
        type: 'warning',
        text: 'Upload succeeded, but project save failed. Please retry save.'
      }
    }
  }

  return {
    uploadStage: 'error',
    uploadProgress,
    resetDelayMs: 2200,
    message: {
      type: 'warning',
      text: saveState?.hasTransientMedia
        ? 'Upload succeeded, but the image is still temporary. Refresh may lose it.'
        : 'Project save failed after upload. Please retry save.'
    }
  }
}

export const getImageNodeUploadMetadata = ({
  width = 0,
  height = 0,
  currentSize = ''
} = {}) => {
  const safeWidth = Number(width) || 0
  const safeHeight = Number(height) || 0

  return {
    ratio: getImageRatioFromDimensions(safeWidth, safeHeight),
    size: safeWidth && safeHeight ? `${safeWidth}x${safeHeight}` : currentSize
  }
}

export const getImageNodeUploadPreviewPatch = ({
  previewUrl = '',
  file = {},
  currentData = {},
  isLocalPreviewMode = false,
  metadata = {},
  now = Date.now()
} = {}) => ({
  previewUrl,
  base64: '',
  fileName: file?.name || '',
  fileType: file?.type || '',
  label: 'Image',
  updatedAt: now,
  loading: false,
  error: '',
  persistStatus: isLocalPreviewMode ? 'saved' : 'uploading',
  persistError: '',
  sourcePrompt: String(currentData?.sourcePrompt || '').trim(),
  sourceRefImages: getImageNodeSourceRefImages(previewUrl),
  ratio: metadata?.ratio || '1:1',
  size: metadata?.size || ''
})

export const getImageNodeUploadedPatch = ({
  uploadedUrl = '',
  file = {},
  currentData = {},
  now = Date.now()
} = {}) => ({
  url: uploadedUrl,
  previewUrl: '',
  base64: '',
  fileName: file?.name || '',
  fileType: file?.type || '',
  updatedAt: now,
  error: '',
  sourcePrompt: String(currentData?.sourcePrompt || '').trim(),
  sourceRefImages: getImageNodeSourceRefImages(uploadedUrl),
  persistStatus: 'saving',
  persistError: ''
})

export const getImageNodeUploadFailureOutcome = ({
  savedOk = true,
  saveState = {}
} = {}) => {
  const temporaryMessage = 'Upload failed. The selected file is only shown temporarily.'
  return {
    uploadStage: 'error',
    uploadProgress: 100,
    resetDelayMs: 2200,
    message: {
      type: 'warning',
      text: !savedOk && !saveState?.hasTransientMedia
        ? 'Upload failed and the project could not be saved. Please retry.'
        : temporaryMessage
    }
  }
}

export const getImageNodeUploadFailurePatch = ({
  now = Date.now()
} = {}) => ({
  persistStatus: 'error',
  persistError: 'Image upload failed. The selected file is only shown temporarily.',
  updatedAt: now
})
