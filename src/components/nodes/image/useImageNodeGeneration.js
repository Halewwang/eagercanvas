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

const generatedImageFileName = () => `generated-${Date.now()}.png`

export const useImageNodeGeneration = ({
  buildImagePersistencePatch,
  buildSourceRefImages,
  currentProjectId,
  displayImageUrl,
  getConnectedInputs,
  getErrorMessage,
  getImageNodeActionErrorPatch,
  getImageNodeActionPendingPatch,
  getImageNodeGenerationSaveMessage,
  getImageNodeSaveFeedbackPatch,
  imageActionLoading,
  imageGen,
  isConfigured,
  localBackground,
  localImageModel,
  localImageQuality,
  localImageRatio,
  localImageSize,
  localOutputFormat,
  localResolution,
  messageApi = getDefaultMessageApi,
  nodeId,
  projectSaveState,
  resetProgress,
  resolveImagePersistence,
  resolveImageSaveFeedback,
  saveProject,
  updateNode
} = {}) => {
  const runImageGeneration = async (mode = 'create') => {
    if (!readReactiveValue(isConfigured)) {
      dispatchMessage(messageApi, { type: 'warning', text: 'Please sign in first' })
      return
    }

    const { prompt, refImages } = getConnectedInputs()
    const selfImage = readReactiveValue(displayImageUrl)
    const mergedRefs = [...refImages]
    if (selfImage) mergedRefs.unshift(selfImage)

    if (!prompt && mergedRefs.length === 0) {
      dispatchMessage(messageApi, {
        type: 'warning',
        text: 'Connect a text node or provide a reference image'
      })
      return
    }

    writeReactiveValue(imageActionLoading, mode)
    updateNode(readReactiveValue(nodeId), getImageNodeActionPendingPatch())
    try {
      const outputFormat = readReactiveValue(localOutputFormat)
      const generationPrompt = prompt || 'Generate a polished visual based on this reference.'
      const result = await imageGen.generate({
        model: readReactiveValue(localImageModel),
        projectId: readReactiveValue(currentProjectId),
        prompt: generationPrompt,
        size: readReactiveValue(localImageSize),
        quality: readReactiveValue(localImageQuality),
        background: readReactiveValue(localBackground),
        output_format: outputFormat,
        output_compression: ['jpeg', 'webp'].includes(String(outputFormat).toLowerCase()) ? 100 : undefined,
        moderation: 'auto',
        ratio: readReactiveValue(localImageRatio),
        aspect_ratio: readReactiveValue(localImageRatio),
        resolution: readReactiveValue(localResolution),
        image: mergedRefs
      })

      if (!result?.[0]?.url) {
        throw new Error('No image output')
      }

      const firstResult = result[0]
      const persistence = firstResult.transient
        ? {
            persistedUrl: '',
            displayUrl: firstResult.url,
            persisted: false,
            persistError: firstResult.persistError || 'Generated image synchronization failed. Please retry.'
          }
        : await resolveImagePersistence(
          firstResult.url,
          generatedImageFileName(),
          'Generated image persistence failed. Please retry.'
        )

      updateNode(readReactiveValue(nodeId), buildImagePersistencePatch(persistence, {
        loading: false,
        model: readReactiveValue(localImageModel),
        size: readReactiveValue(localImageSize),
        quality: readReactiveValue(localImageQuality),
        background: readReactiveValue(localBackground),
        output_format: readReactiveValue(localOutputFormat),
        ratio: readReactiveValue(localImageRatio),
        resolution: readReactiveValue(localResolution),
        sourcePrompt: generationPrompt,
        sourceRefImages: buildSourceRefImages(refImages),
        error: ''
      }))

      if (!persistence.persisted) {
        dispatchMessage(messageApi, {
          type: 'warning',
          text: 'Image generated, but the result is still temporary. Refresh may lose it.'
        })
        return
      }

      const savedOk = await saveProject()
      const saveState = readReactiveValue(projectSaveState) || {}
      const saveFeedback = resolveImageSaveFeedback(savedOk)
      updateNode(readReactiveValue(nodeId), getImageNodeSaveFeedbackPatch({ saveFeedback }))
      dispatchMessage(messageApi, getImageNodeGenerationSaveMessage({
        saveFeedback,
        saveState,
        savedOk,
        mode
      }))
    } catch (err) {
      const message = getErrorMessage(err, 'Image generation failed')
      updateNode(readReactiveValue(nodeId), getImageNodeActionErrorPatch({ message }))
      dispatchMessage(messageApi, { type: 'error', text: message })
    } finally {
      writeReactiveValue(imageActionLoading, '')
    }
  }

  const handleStopGeneration = () => {
    resetProgress()
    writeReactiveValue(imageActionLoading, '')
    updateNode(readReactiveValue(nodeId), getImageNodeActionErrorPatch({ fallbackMessage: 'Generation stopped' }))
    dispatchMessage(messageApi, { type: 'info', text: 'Generation stopped' })
  }

  const handleGenerateImage = () => runImageGeneration('create')
  const handleRegenerateImage = () => runImageGeneration('regenerate')

  return {
    handleGenerateImage,
    handleRegenerateImage,
    handleStopGeneration,
    runImageGeneration
  }
}

export default useImageNodeGeneration
