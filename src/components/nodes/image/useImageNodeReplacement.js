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

const getDefaultWindow = () => (typeof window === 'undefined' ? null : window)

const dispatchMessage = (messageApi, message) => {
  if (!message?.text) return
  const api = readReactiveValue(messageApi)
  api?.[message.type]?.(message.text)
}

export const useImageNodeReplacement = ({
  currentData,
  currentProjectId,
  dataUrlToFile,
  flushSave,
  getImageNodeReplacementErrorPatch,
  getImageNodeReplacementPreviewPatch,
  getImageNodeReplacementSaveMessage,
  getImageNodeReplacementUploadedPatch,
  getImageNodeSaveFeedbackPatch,
  isLocalPreviewMode,
  localImageRatio,
  localImageSize,
  localResolution,
  logger = console,
  messageApi = () => getDefaultWindow()?.$message,
  nodeId,
  projectSaveState,
  resolveImageSaveFeedback,
  setTimeoutFn = (callback, delay) => getDefaultWindow()?.setTimeout(callback, delay),
  updateNode,
  updateNodeInternals,
  uploadImageFile
} = {}) => {
  const replaceCurrentImageNode = async (payload = {}) => {
    const resolvedNodeId = readReactiveValue(nodeId)
    const nextUrl = String(payload.url || '').trim()
    const nextBase64 = String(payload.base64 || '').trim()
    const nextSize = String(payload.size || readReactiveValue(localImageSize) || '').trim()
    const nextRatio = String(payload.ratio || readReactiveValue(localImageRatio) || '').trim()
    const nextResolution = String(payload.resolution || readReactiveValue(localResolution) || '').trim()
    const previewSource = nextBase64 || nextUrl
    const previousPersistedUrl = String(readReactiveValue(currentData)?.url || '').trim()

    writeReactiveValue(localImageSize, nextSize || readReactiveValue(localImageSize))
    writeReactiveValue(localImageRatio, nextRatio || readReactiveValue(localImageRatio))
    writeReactiveValue(localResolution, nextResolution || readReactiveValue(localResolution))

    updateNode(resolvedNodeId, getImageNodeReplacementPreviewPatch({
      previousPersistedUrl,
      previewSource,
      size: readReactiveValue(localImageSize),
      ratio: readReactiveValue(localImageRatio),
      resolution: readReactiveValue(localResolution),
      fileType: payload.fileType || 'image/png',
      isLocalPreviewMode: readReactiveValue(isLocalPreviewMode)
    }))

    setTimeoutFn(() => updateNodeInternals(resolvedNodeId), 30)

    const persistFileName = payload.fileName || `crop-${Date.now()}.png`
    const uploadTarget = previewSource
    const file = dataUrlToFile(uploadTarget, persistFileName)
    if (readReactiveValue(isLocalPreviewMode)) {
      await flushSave()
      return
    }
    if (!file) {
      updateNode(resolvedNodeId, getImageNodeReplacementErrorPatch())
      const savedOk = await flushSave()
      const message = getImageNodeReplacementSaveMessage({
        saveState: readReactiveValue(projectSaveState) || {},
        savedOk
      })
      dispatchMessage(messageApi, message)
      return
    }

    try {
      const uploadedUrl = await uploadImageFile(file, {
        projectId: readReactiveValue(currentProjectId),
        source: 'image_replace',
        sourceNodeId: resolvedNodeId
      })
      if (uploadedUrl) {
        updateNode(resolvedNodeId, getImageNodeReplacementUploadedPatch({ uploadedUrl }))
      }
      const savedOk = await flushSave()
      const saveState = readReactiveValue(projectSaveState) || {}
      const saveFeedback = resolveImageSaveFeedback(savedOk)
      updateNode(resolvedNodeId, getImageNodeSaveFeedbackPatch({ saveFeedback }))
      const message = getImageNodeReplacementSaveMessage({
        saveFeedback,
        saveState,
        savedOk
      })
      dispatchMessage(messageApi, message)
    } catch (err) {
      logger?.warn?.('Crop persistence failed:', err)
      updateNode(resolvedNodeId, getImageNodeReplacementErrorPatch({
        previousPersistedUrl,
        previewSource,
        restorePreviewState: true
      }))
      const savedOk = await flushSave()
      const message = getImageNodeReplacementSaveMessage({
        saveState: readReactiveValue(projectSaveState) || {},
        savedOk
      })
      dispatchMessage(messageApi, message)
    }
  }

  return {
    replaceCurrentImageNode
  }
}

export default useImageNodeReplacement
