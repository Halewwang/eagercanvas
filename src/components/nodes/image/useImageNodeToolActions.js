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

const getEnhancedFileName = () => `enhanced-${Date.now()}.png`

export const useImageNodeToolActions = ({
  activeTool,
  cancelCropMode,
  createImageNodeCropPayload,
  createLinkedImageNode,
  currentData,
  currentProjectId,
  defaultEnhancePrompt,
  defaultImageModel,
  displayImageUrl,
  edges,
  getErrorMessage = getDefaultErrorMessage,
  getImageNodeEnhancementErrorPatch,
  getImageNodeEnhancementRequest,
  getImageNodeEnhancementResultPatch,
  getImageNodeToolSaveMessages,
  getNearestImageNodeSourceConfig,
  imageGen,
  localImageModel,
  localBackground,
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
      localBackground: readReactiveValue(localBackground),
      projectId: readReactiveValue(currentProjectId),
      defaultImageModel,
      defaultEnhancePrompt
    })
  }

  const handleEnhance = async () => {
    const request = buildEnhancementRequest()
    if (!request) {
      dispatchMessage(messageApi, {
        type: 'warning',
        text: 'No reusable prompt or reference chain found for image enhancement'
      })
      return
    }

    writeReactiveValue(toolActionLoading, 'enhance')
    const newNodeId = createLinkedImageNode({
      loading: true,
      label: 'Enhanced Image',
      model: request.model,
      ...(request.background ? { background: request.background } : {}),
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
        messages: getImageNodeToolSaveMessages('enhance')
      })
    } catch (err) {
      const message = getErrorMessage(err, 'Image enhancement failed')
      await updateLinkedImageNode(newNodeId, getImageNodeEnhancementErrorPatch({
        message,
        request,
        fallbackMessage: 'Image enhancement failed'
      }))
      dispatchMessage(messageApi, { type: 'error', text: message })
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
    if (key === 'crop') {
      await startCropMode()
      return
    }
    if (key === 'enhance') {
      await handleEnhance()
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
    handleEnhance,
    handleToolAction
  }
}

export default useImageNodeToolActions
