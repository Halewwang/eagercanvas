const readReactiveValue = (source) => {
  if (typeof source === 'function') return source()
  if (source && typeof source === 'object' && 'value' in source) return source.value
  return source
}

const writeReactiveValue = (target, value) => {
  if (target && typeof target === 'object' && 'value' in target) {
    target.value = value
  }
}

const getDefaultMessageApi = () => (
  typeof window === 'undefined' ? null : window.$message
)

const dispatchMessage = (messageApi, message) => {
  if (!message?.text) return
  const api = readReactiveValue(messageApi)
  api?.[message.type]?.(message.text)
}

const getDefaultErrorMessage = (error, fallback) => error?.message || fallback

const getEnhancedFileName = () => `enhanced-4k-${Date.now()}.png`
const getRemoveBackgroundFileName = () => `remove-bg-${Date.now()}.png`

export const useImageNodeToolActions = ({
  activeTool,
  cancelCropMode,
  createImageNodeCropPayload,
  createLinkedImageNode,
  currentData,
  currentProjectId,
  defaultEnhancePrompt,
  defaultImageModel,
  defaultImageSize,
  displayImageUrl,
  edges,
  findNearestSizeKey,
  flushSave,
  getErrorMessage = getDefaultErrorMessage,
  getImageNodeEnhancementErrorPatch,
  getImageNodeEnhancementRequest,
  getImageNodeEnhancementResultPatch,
  getImageNodeRatioFromSizeKey,
  getImageNodeRemoveBackgroundResultPatch,
  getImageNodeToolSaveMessages,
  getNearestImageNodeSourceConfig,
  imageGen,
  imageTools,
  localImageModel,
  localImageQuality,
  localImageRatio,
  localImageSize,
  localResolution,
  messageApi = getDefaultMessageApi,
  nodeId,
  nodes,
  projectSaveState,
  replaceCurrentImageNode,
  resolveImagePersistence,
  resolveImageSaveFeedback,
  resolveNodeInputs,
  showImageToolSaveMessage,
  showMultiAngleDrawer,
  showWedding3x3Drawer,
  startCropMode,
  toolActionLoading,
  triggerUpload,
  updateLinkedImageNode,
  cropRect,
  cropStageMetrics
} = {}) => {
  const buildEnhancementRequest = () => {
    const sourceConfig = getNearestImageNodeSourceConfig({
      nodes: readReactiveValue(nodes),
      edges: readReactiveValue(edges),
      startNodeId: readReactiveValue(nodeId)
    })
    const sourceInputs = sourceConfig?.id ? resolveNodeInputs(sourceConfig.id) : null

    return getImageNodeEnhancementRequest({
      sourceConfig,
      sourceInputs,
      currentNodeData: readReactiveValue(currentData),
      displayImageUrl: readReactiveValue(displayImageUrl),
      localImageModel: readReactiveValue(localImageModel),
      localImageQuality: readReactiveValue(localImageQuality),
      localImageRatio: readReactiveValue(localImageRatio),
      localImageSize: readReactiveValue(localImageSize),
      projectId: readReactiveValue(currentProjectId),
      defaultImageModel,
      defaultImageSize,
      defaultEnhancePrompt,
      findNearestSizeKey,
      getRatioFromSizeKey: getImageNodeRatioFromSizeKey
    })
  }

  const handleEnhanceTo4k = async () => {
    const request = buildEnhancementRequest()
    if (!request) {
      dispatchMessage(messageApi, {
        type: 'warning',
        text: 'No reusable prompt or reference chain found for 4K enhancement'
      })
      return
    }

    writeReactiveValue(toolActionLoading, 'enhance-4k')
    const newNodeId = createLinkedImageNode({
      loading: true,
      label: '4K Enhanced Image',
      model: request.model,
      size: request.size,
      quality: request.quality,
      ratio: request.ratio,
      resolution: request.resolution,
      sourceConfigId: request.sourceConfigId,
      sourcePrompt: request.sourcePrompt,
      sourceRefImages: request.sourceRefImages
    })
    if (!newNodeId) {
      writeReactiveValue(toolActionLoading, '')
      dispatchMessage(messageApi, { type: 'error', text: 'Failed to create output node' })
      return
    }

    try {
      const result = await imageGen.generate(request)
      const persistence = await resolveImagePersistence(
        result?.[0]?.url,
        getEnhancedFileName(),
        'Enhanced image persistence failed. Please retry.'
      )

      const savedOk = await updateLinkedImageNode(newNodeId, getImageNodeEnhancementResultPatch({
        persistence,
        request
      }))

      const saveState = readReactiveValue(projectSaveState) || {}
      const saveFeedback = resolveImageSaveFeedback(savedOk)
      showImageToolSaveMessage({
        saveFeedback,
        saveState,
        persisted: persistence.persisted,
        messages: getImageNodeToolSaveMessages('enhance-4k')
      })
    } catch (err) {
      const message = getErrorMessage(err, '4K enhancement failed')
      await updateLinkedImageNode(newNodeId, getImageNodeEnhancementErrorPatch({
        message,
        request,
        fallbackMessage: '4K enhancement failed'
      }))
      dispatchMessage(messageApi, { type: 'error', text: message })
    } finally {
      writeReactiveValue(toolActionLoading, '')
    }
  }

  const handleRemoveBackground = async () => {
    const source = readReactiveValue(displayImageUrl)
    if (!source) return

    writeReactiveValue(toolActionLoading, 'remove-background')
    try {
      const result = await imageTools.removeBg({
        image: source,
        size: 'full',
        format: 'png',
        channels: 'rgba',
        crop: false,
        despill: false
      })
      const persistence = await resolveImagePersistence(
        result?.url,
        getRemoveBackgroundFileName(),
        'Background removal persistence failed. Please retry.'
      )
      const data = readReactiveValue(currentData) || {}

      createLinkedImageNode(getImageNodeRemoveBackgroundResultPatch({
        persistence,
        defaults: {
          size: data.size || readReactiveValue(localImageSize),
          ratio: data.ratio || readReactiveValue(localImageRatio),
          resolution: data.resolution || readReactiveValue(localResolution)
        }
      }))
      if (!persistence.persisted) {
        dispatchMessage(messageApi, {
          type: 'warning',
          text: 'Background removed, but the result is only shown temporarily. Please retry.'
        })
        return
      }
      const savedOk = await flushSave()
      const saveState = readReactiveValue(projectSaveState) || {}
      const saveFeedback = resolveImageSaveFeedback(savedOk)
      showImageToolSaveMessage({
        saveFeedback,
        saveState,
        messages: getImageNodeToolSaveMessages('remove-background')
      })
    } catch (err) {
      dispatchMessage(messageApi, {
        type: 'error',
        text: err?.message || 'Background removal failed'
      })
    } finally {
      writeReactiveValue(toolActionLoading, '')
    }
  }

  const applyCrop = async () => {
    const source = readReactiveValue(displayImageUrl)
    if (!source) return

    writeReactiveValue(toolActionLoading, 'crop')

    try {
      const cropPayload = await createImageNodeCropPayload({
        source,
        cropRect: readReactiveValue(cropRect),
        cropStageMetrics: readReactiveValue(cropStageMetrics)
      })
      await replaceCurrentImageNode(cropPayload)
      cancelCropMode()
      dispatchMessage(messageApi, { type: 'success', text: 'Crop applied' })
    } catch (err) {
      dispatchMessage(messageApi, {
        type: 'error',
        text: err?.message || 'Crop failed'
      })
    } finally {
      writeReactiveValue(toolActionLoading, '')
    }
  }

  const handleToolAction = async (key) => {
    if (key === 'replace-image') {
      triggerUpload()
      return
    }
    if (key === 'remove-background') {
      await handleRemoveBackground()
      return
    }
    if (key === 'crop') {
      await startCropMode()
      return
    }
    if (key === 'enhance-4k') {
      await handleEnhanceTo4k()
      return
    }
    if (key === 'multi-angle') {
      writeReactiveValue(showMultiAngleDrawer, true)
      return
    }
    if (key === 'wedding-3x3') {
      writeReactiveValue(showWedding3x3Drawer, true)
    }
  }

  return {
    applyCrop,
    buildEnhancementRequest,
    handleEnhanceTo4k,
    handleRemoveBackground,
    handleToolAction
  }
}

export default useImageNodeToolActions
