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
  buildImagePersistencePatch, buildSourceRefImages, currentData = () => ({}), currentProjectId,
  displayImageUrl, getConnectedInputs, getErrorMessage, getImageNodeActionErrorPatch,
  getImageNodeActionPendingPatch, getImageNodeGenerationSaveMessage, getImageNodeSaveFeedbackPatch,
  imageActionLoading, imageGen, isConfigured, isNodeAvailable = () => true,
  localImageModel, localImageRatio, localResolution, messageApi = getDefaultMessageApi,
  nodeId, projectSaveState, resetProgress, resolveImagePersistence,
  resolveImageSaveFeedback, saveProject, updateNode
} = {}) => {
  let disposed = false
  let operation = null
  const readData = () => readReactiveValue(currentData) || {}
  const isCurrent = op => !disposed && operation === op &&
    readReactiveValue(nodeId) === op.nodeId && readReactiveValue(currentProjectId) === op.projectId && isNodeAvailable(op.nodeId)
  const begin = mode => {
    const op = { mode, nodeId: readReactiveValue(nodeId), projectId: readReactiveValue(currentProjectId), controller: new AbortController(), running: true }
    operation = op
    writeReactiveValue(imageActionLoading, mode)
    updateNode(op.nodeId, getImageNodeActionPendingPatch(), { persist: false })
    return op
  }
  const clearTask = { imageTaskId: '', imageTaskMetadata: null }
  const stableRefs = refs => (Array.isArray(refs) ? refs : []).filter(url => typeof url === 'string' && /^https?:\/\//i.test(url))
  const saveSubmitted = async (op, taskId, metadata) => {
    if (!isCurrent(op)) return
    op.taskId = taskId
    updateNode(op.nodeId, { imageTaskId: taskId, imageTaskMetadata: {
      model: metadata.model,
      generationRatio: metadata.generationRatio,
      generationResolution: metadata.generationResolution,
      sourcePrompt: metadata.sourcePrompt,
      sourceRefImages: stableRefs(metadata.sourceRefImages),
      sourceConfigId: metadata.sourceConfigId || ''
    } })
    await saveProject()
    op.taskSaved = true
    if (op.pauseRequested) pauseTracking(op)
  }
  const persistResult = async (result, metadata, op) => {
    const firstResult = result?.[0]
    if (!firstResult?.url) throw new Error('No image output')
    if (!isCurrent(op)) return
    const resultMetadata = { ...metadata, loading: false, size: '', ratio: '', error: '' }
    updateNode(op.nodeId, buildImagePersistencePatch({
      persistedUrl: '', displayUrl: firstResult.url, persisted: false,
      persistError: firstResult.persistError || 'Image is being saved in the background.'
    }, resultMetadata), { persist: false })
    void (async () => {
      try {
        const persistence = await resolveImagePersistence(firstResult.url, generatedImageFileName(), 'Generated image persistence failed. Please retry.')
        if (!isCurrent(op) || String(readReactiveValue(displayImageUrl) || '').trim() !== String(firstResult.url).trim()) return
        updateNode(op.nodeId, buildImagePersistencePatch(persistence, {
          ...resultMetadata, ...(persistence.persisted ? clearTask : {})
        }), persistence.persisted ? { changeType: 'node-generated' } : { persist: false })
        if (!persistence.persisted) {
          dispatchMessage(messageApi, { type: 'warning', text: 'Image generated, but the result is still temporary. Refresh may lose it.' })
          return
        }
        const savedOk = await saveProject()
        if (!isCurrent(op)) return
        const saveFeedback = resolveImageSaveFeedback(savedOk)
        updateNode(op.nodeId, getImageNodeSaveFeedbackPatch({ saveFeedback }), { persist: false })
        dispatchMessage(messageApi, getImageNodeGenerationSaveMessage({ saveFeedback, saveState: readReactiveValue(projectSaveState) || {}, savedOk, mode: op.mode }))
      } catch (err) {
        if (!isCurrent(op)) return
        updateNode(op.nodeId, getImageNodeSaveFeedbackPatch({ saveFeedback: {
          persistStatus: 'error', persistError: getErrorMessage(err, 'Generated image persistence failed')
        } }), { persist: false })
        dispatchMessage(messageApi, { type: 'warning', text: 'Image generated, but the result is still temporary. Refresh may lose it.' })
      }
    })()
  }
  const fail = async (err, op) => {
    if (!isCurrent(op) || err.name === 'AbortError') return
    const message = getErrorMessage(err, 'Image generation failed')
    updateNode(op.nodeId, { ...getImageNodeActionErrorPatch({ message }), ...(err.imageTaskTerminal ? clearTask : {}) })
    if (op.taskId) await saveProject()
    dispatchMessage(messageApi, { type: 'error', text: message })
  }
  const finish = op => {
    op.running = false
    if (isCurrent(op)) writeReactiveValue(imageActionLoading, '')
  }
  const resumeImageGeneration = async () => {
    const data = readData()
    if (!data.imageTaskId || operation?.running || disposed || !readReactiveValue(isConfigured)) return
    const op = begin('resume')
    op.taskId = data.imageTaskId
    op.taskSaved = true
    try {
      const saved = data.imageTaskMetadata || {}
      const metadata = { model: saved.model || data.model, generationRatio: saved.generationRatio || data.generationRatio,
        generationResolution: saved.generationResolution || data.generationResolution, sourceConfigId: saved.sourceConfigId || data.sourceConfigId || '',
        sourcePrompt: saved.sourcePrompt || data.sourcePrompt || '', sourceRefImages: stableRefs(saved.sourceRefImages?.length ? saved.sourceRefImages : data.sourceRefImages) }
      const result = await imageGen.resume(op.taskId, { signal: op.controller.signal })
      await persistResult(result, metadata, op)
    } catch (err) { await fail(err, op) }
    finally { finish(op) }
  }
  const runImageGeneration = async (mode = 'create') => {
    if (disposed || operation?.running) return
    if (readData().imageTaskId) return resumeImageGeneration()
    if (!readReactiveValue(isConfigured)) {
      dispatchMessage(messageApi, { type: 'warning', text: 'Please sign in first' })
      return
    }
    const { prompt, refImages } = getConnectedInputs()
    const selfImage = readReactiveValue(displayImageUrl)
    const mergedRefs = selfImage ? [selfImage, ...refImages.filter(image => image !== selfImage)] : [...refImages]
    if (!prompt && !mergedRefs.length) {
      dispatchMessage(messageApi, { type: 'warning', text: 'Connect a text node or provide a reference image' })
      return
    }
    const op = begin(mode)
    const generationPrompt = prompt || 'Generate a polished visual based on this reference.'
    const settings = { model: readReactiveValue(localImageModel), ratio: readReactiveValue(localImageRatio), resolution: readReactiveValue(localResolution) }
    const metadata = { model: settings.model, generationRatio: settings.ratio, generationResolution: settings.resolution,
      sourcePrompt: generationPrompt, sourceRefImages: buildSourceRefImages(refImages) }
    try {
      const result = await imageGen.generate({ ...settings, projectId: op.projectId, prompt: generationPrompt, sourceNodeId: op.nodeId, image: mergedRefs }, {
        signal: op.controller.signal, onSubmitted: taskId => saveSubmitted(op, taskId, metadata)
      })
      await persistResult(result, metadata, op)
    } catch (err) { await fail(err, op) }
    finally { finish(op) }
  }
  const pauseTracking = (op) => {
    if (disposed || (op && !isCurrent(op))) return
    op?.controller.abort()
    operation = null
    resetProgress()
    imageGen.reset?.()
    writeReactiveValue(imageActionLoading, '')
    updateNode(readReactiveValue(nodeId), getImageNodeActionErrorPatch({ fallbackMessage: 'Image tracking paused. Reopen this project or select Create to retrieve the result.' }), { persist: false })
    if (readData().imageTaskId) void saveProject()
    dispatchMessage(messageApi, { type: 'info', text: 'Image tracking paused' })
  }
  const handleStopGeneration = () => {
    const op = operation
    if (op?.running && !op.taskSaved) {
      op.pauseRequested = true
      return
    }
    pauseTracking(op)
  }
  const disposeGeneration = () => { disposed = true; operation?.controller.abort() }
  return {
    handleGenerateImage: () => runImageGeneration('create'),
    handleRegenerateImage: () => runImageGeneration('regenerate'),
    handleStopGeneration, runImageGeneration, resumeImageGeneration, disposeGeneration
  }
}

export default useImageNodeGeneration
