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
  flushSave,
  getErrorMessage = getDefaultErrorMessage,
  getImageNodeEnhancementErrorPatch,
  getImageNodeEnhancementRequest,
  getImageNodeEnhancementResultPatch,
  getImageNodeToolSaveMessages,
  getNearestImageNodeSourceConfig,
  imageGen,
  isNodeAvailable = () => true,
  localImageModel,
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
  updateNode,
  cropRect,
  cropStageMetrics
} = {}) => {
  const assertNodeAvailable = (targetId) => {
    if (!isNodeAvailable(targetId)) throw Object.assign(new Error('Image node is no longer available'), { name: 'AbortError' })
  }

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
      projectId: readReactiveValue(currentProjectId),
      defaultImageModel,
      defaultEnhancePrompt
    })
  }

  const handleEnhance = async () => {
    if (!isNodeAvailable(readReactiveValue(nodeId))) return
    const request = buildEnhancementRequest()
    if (!request) {
      dispatchMessage(messageApi, {
        type: 'warning',
        text: 'No reusable prompt or reference chain found for image enhancement'
      })
      return
    }

    writeReactiveValue(toolActionLoading, 'enhance')
    const taskMetadata = {
      model: request.model,
      generationRatio: request.ratio || '',
      generationResolution: request.resolution || '',
      sourceConfigId: request.sourceConfigId || '',
      sourcePrompt: request.sourcePrompt || request.prompt || '',
      sourceRefImages: (Array.isArray(request.sourceRefImages) ? request.sourceRefImages : [])
        .filter((url) => typeof url === 'string' && /^https?:\/\//i.test(url))
    }
    const newNodeId = createLinkedImageNode({
      loading: true,
      label: 'Enhanced Image',
      model: request.model,
      ...(request.ratio !== undefined ? { generationRatio: request.ratio } : {}),
      ...(request.resolution !== undefined ? { generationResolution: request.resolution } : {}),
      sourceConfigId: request.sourceConfigId,
      sourcePrompt: request.sourcePrompt,
      sourceRefImages: taskMetadata.sourceRefImages
    })
    if (!newNodeId) {
      writeReactiveValue(toolActionLoading, '')
      dispatchMessage(messageApi, { type: 'error', text: 'Failed to create output node' })
      return
    }

    try {
      assertNodeAvailable(newNodeId)
      const result = await imageGen.generate(request, {
        onSubmitted: async (taskId) => {
          assertNodeAvailable(newNodeId)
          updateNode(newNodeId, { imageTaskId: taskId, imageTaskMetadata: taskMetadata })
          await flushSave()
          assertNodeAvailable(newNodeId)
        }
      })
      if (!isNodeAvailable(newNodeId)) return
      const persistence = await resolveImagePersistence(
        result?.[0]?.url,
        getEnhancedFileName(),
        'Enhanced image persistence failed. Please retry.'
      )
      if (!isNodeAvailable(newNodeId)) return

      const savedOk = await updateLinkedImageNode(newNodeId, getImageNodeEnhancementResultPatch({
        persistence,
        request
      }))
      if (!isNodeAvailable(newNodeId)) return

      const saveState = readReactiveValue(projectSaveState) || {}
      const saveFeedback = resolveImageSaveFeedback(savedOk)
      showImageToolSaveMessage({
        saveFeedback,
        saveState,
        persisted: persistence.persisted,
        messages: getImageNodeToolSaveMessages('enhance')
      })
    } catch (err) {
      if (!isNodeAvailable(newNodeId) || err?.name === 'AbortError') return
      const message = getErrorMessage(err, 'Image enhancement failed')
      await updateLinkedImageNode(newNodeId, {
        ...getImageNodeEnhancementErrorPatch({
          message,
          request,
          fallbackMessage: 'Image enhancement failed'
        }),
        ...(err?.imageTaskTerminal ? { imageTaskId: '', imageTaskMetadata: null } : {})
      })
      if (!isNodeAvailable(newNodeId)) return
      dispatchMessage(messageApi, { type: 'error', text: message })
    } finally {
      writeReactiveValue(toolActionLoading, '')
    }
  }

  const applyCrop = async () => {
    const targetId = readReactiveValue(nodeId)
    const source = readReactiveValue(displayImageUrl)
    if (!source || !isNodeAvailable(targetId)) return

    writeReactiveValue(toolActionLoading, 'crop')

    try {
      const cropPayload = await createImageNodeCropPayload({
        source,
        cropRect: readReactiveValue(cropRect),
        cropStageMetrics: readReactiveValue(cropStageMetrics)
      })
      if (!isNodeAvailable(targetId)) return
      await replaceCurrentImageNode(cropPayload)
      if (!isNodeAvailable(targetId)) return
      cancelCropMode()
      dispatchMessage(messageApi, { type: 'success', text: 'Crop applied' })
    } catch (err) {
      if (!isNodeAvailable(targetId) || err?.name === 'AbortError') return
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
