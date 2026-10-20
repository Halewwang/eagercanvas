import { ref } from 'vue'

const readReactiveValue = (source) => {
  if (typeof source === 'function') return source()
  if (source && typeof source === 'object' && 'value' in source) return source.value
  return source
}

const getDefaultMessageApi = () => (
  typeof window === 'undefined' ? null : window.$message
)

const dispatchError = (messageApi, fallback, error) => {
  const api = readReactiveValue(messageApi)
  api?.error?.(error?.message || fallback)
}

const getMultiAngleFileName = () => `multi-angle-${Date.now()}.png`
const getWedding3x3FileName = () => `wedding-3x3-${Date.now()}.png`

export const useImageNodeToolDrawerResults = ({
  createLinkedImageNode,
  currentData,
  flushSave,
  getImageNodeSaveFeedbackPatch,
  getImageNodeToolErrorPatch,
  getImageNodeToolLinkedCreatePatch,
  getImageNodeToolLinkedResultPatch,
  getImageNodeToolPendingPatch,
  getImageNodeToolReplacementPatch,
  getImageNodeToolSaveMessages,
  isNodeAvailable = () => true,
  localImageRatio,
  localResolution,
  messageApi = getDefaultMessageApi,
  nodeId,
  projectSaveState,
  resolveImagePersistence,
  resolveImageSaveFeedback,
  showImageToolSaveMessage,
  updateLinkedImageNode,
  updateNode
} = {}) => {
  const pendingMultiAngleNodeId = ref('')
  const pendingWedding3x3NodeId = ref('')
  const showMultiAngleDrawer = ref(false)
  const showWedding3x3Drawer = ref(false)
  let multiAngleTaskId = ''
  let wedding3x3TaskId = ''
  let multiAngleTaskMetadata = {}
  let wedding3x3TaskMetadata = {}

  const assertNodeAvailable = (targetId) => {
    if (!isNodeAvailable(targetId)) throw Object.assign(new Error('Image node is no longer available'), { name: 'AbortError' })
  }

  const getTaskMetadata = (payload = {}) => ({
    model: payload.model || '',
    generationRatio: payload.generationRatio || '',
    generationResolution: payload.generationResolution || '',
    sourceConfigId: payload.sourceConfigId || '',
    sourcePrompt: payload.sourcePrompt || '',
    sourceRefImages: (Array.isArray(payload.sourceRefImages) ? payload.sourceRefImages : [])
      .filter((url) => typeof url === 'string' && /^https?:\/\//i.test(url))
  })

  const saveSubmittedTask = async (targetId, taskId, metadata) => {
    if (!targetId || !taskId) throw new Error('Image output node or task ID is missing')
    assertNodeAvailable(targetId)
    updateNode(targetId, { imageTaskId: taskId, imageTaskMetadata: metadata, loading: true, error: '' })
    await flushSave()
    assertNodeAvailable(targetId)
  }

  const readGenerationDefaults = () => {
    const data = readReactiveValue(currentData) || {}
    return {
      generationRatio: data.generationRatio ?? readReactiveValue(localImageRatio) ?? '1:1',
      generationResolution: data.generationResolution ?? readReactiveValue(localResolution) ?? '1k',
    }
  }

  const handleMultiAngleApply = async (payload = {}) => {
    const pendingTargetId = pendingMultiAngleNodeId.value
    let targetId = payload.targetMode === 'replace' ? readReactiveValue(nodeId) : pendingTargetId || readReactiveValue(nodeId)
    if (!isNodeAvailable(targetId)) return
    const defaults = readGenerationDefaults()
    const nextPayload = {
      ...defaults,
      ...payload,
      fileName: getMultiAngleFileName()
    }

    try {
      const persistence = await resolveImagePersistence(
        nextPayload.base64 || nextPayload.url,
        nextPayload.fileName,
        'Multi-angle persistence failed. Please retry.'
      )
      if (!isNodeAvailable(targetId)) return

      if (payload.targetMode === 'replace') {
        const previousPersistedUrl = String(readReactiveValue(currentData)?.url || '').trim()
        updateNode(targetId, getImageNodeToolReplacementPatch({
          persistence,
          previousPersistedUrl,
          size: nextPayload.size || '',
          ratio: nextPayload.ratio || '',
          generationRatio: nextPayload.generationRatio,
          generationResolution: nextPayload.generationResolution,
          fileType: nextPayload.fileType || 'image/png',
          transientPersistError: 'Multi-angle result is only shown temporarily. Please retry.'
        }))

        const savedOk = await flushSave()
        if (!isNodeAvailable(targetId)) return
        const saveState = readReactiveValue(projectSaveState) || {}
        const saveFeedback = resolveImageSaveFeedback(savedOk)
        updateNode(targetId, getImageNodeSaveFeedbackPatch({ saveFeedback }))
        showImageToolSaveMessage({
          saveFeedback,
          saveState,
          persisted: persistence.persisted,
          messages: getImageNodeToolSaveMessages('multi-angle-replace')
        })
      } else {
        let savedOk = true
        if (pendingTargetId) {
          savedOk = await updateLinkedImageNode(targetId, getImageNodeToolLinkedResultPatch({
            persistence,
            payload: nextPayload,
            defaults,
            includeSource: true,
            transientPersistError: 'Multi-angle result is only shown temporarily. Please retry.'
          }))
        } else {
          targetId = createLinkedImageNode(getImageNodeToolLinkedCreatePatch({
            persistence,
            payload: nextPayload,
            defaults,
            includeSource: true
          }))
          if (!targetId || !isNodeAvailable(targetId)) return
          savedOk = await flushSave()
        }
        if (!isNodeAvailable(targetId)) return
        const saveState = readReactiveValue(projectSaveState) || {}
        const saveFeedback = resolveImageSaveFeedback(savedOk)
        showImageToolSaveMessage({
          saveFeedback,
          saveState,
          persisted: persistence.persisted,
          messages: getImageNodeToolSaveMessages('multi-angle-create')
        })
      }
      pendingMultiAngleNodeId.value = ''
      multiAngleTaskId = ''
      showMultiAngleDrawer.value = false
    } catch (error) {
      if (!isNodeAvailable(targetId) || error?.name === 'AbortError') return
      dispatchError(messageApi, 'Multi-angle apply failed', error)
    }
  }

  const handleMultiAnglePending = async (payload = {}) => {
    if (!isNodeAvailable(readReactiveValue(nodeId))) return
    if (payload.targetMode === 'replace') return
    if (pendingMultiAngleNodeId.value) return
    const pendingPayload = { ...readGenerationDefaults(), ...payload }
    multiAngleTaskMetadata = getTaskMetadata(pendingPayload)
    const nextNodeId = createLinkedImageNode(getImageNodeToolPendingPatch(pendingPayload))
    pendingMultiAngleNodeId.value = nextNodeId || ''
    await flushSave()
  }

  const handleMultiAngleSubmitted = async (taskId) => {
    multiAngleTaskId = taskId
    await saveSubmittedTask(pendingMultiAngleNodeId.value, taskId, multiAngleTaskMetadata)
  }

  const handleMultiAngleError = async (payload = {}) => {
    if (!pendingMultiAngleNodeId.value) return
    const failedNodeId = pendingMultiAngleNodeId.value
    if (!isNodeAvailable(failedNodeId)) return
    const clearTask = payload.imageTaskTerminal === true
    if (clearTask || !multiAngleTaskId) pendingMultiAngleNodeId.value = ''
    if (clearTask) multiAngleTaskId = ''
    await updateLinkedImageNode(failedNodeId, {
      ...getImageNodeToolErrorPatch({
        payload,
        fallbackMessage: 'Multi-angle generation failed'
      }),
      ...(clearTask ? { imageTaskId: '', imageTaskMetadata: null } : {})
    })
  }

  const handleWedding3x3Apply = async (payload = {}) => {
    const pendingTargetId = pendingWedding3x3NodeId.value
    let targetId = pendingTargetId || readReactiveValue(nodeId)
    if (!isNodeAvailable(targetId)) return
    const defaults = readGenerationDefaults()
    const nextPayload = {
      ...defaults,
      ...payload,
      fileName: getWedding3x3FileName()
    }

    try {
      const persistence = await resolveImagePersistence(
        nextPayload.base64 || nextPayload.url,
        nextPayload.fileName,
        'Wedding 3x3 persistence failed. Please retry.'
      )
      if (!isNodeAvailable(targetId)) return

      let savedOk = true
      if (pendingTargetId) {
        savedOk = await updateLinkedImageNode(targetId, getImageNodeToolLinkedResultPatch({
          persistence,
          payload: nextPayload,
          defaults,
          labelFallback: 'Wedding 3x3 Result',
          includeSource: true,
          transientPersistError: 'Wedding 3x3 result is only shown temporarily. Please retry.'
        }))
      } else {
        targetId = createLinkedImageNode(getImageNodeToolLinkedCreatePatch({
          persistence,
          payload: nextPayload,
          defaults,
          labelFallback: 'Wedding 3x3 Result',
          includeSource: true
        }))
        if (!targetId || !isNodeAvailable(targetId)) return
        savedOk = await flushSave()
      }
      if (!isNodeAvailable(targetId)) return

      const saveState = readReactiveValue(projectSaveState) || {}
      const saveFeedback = resolveImageSaveFeedback(savedOk)
      showImageToolSaveMessage({
        saveFeedback,
        saveState,
        persisted: persistence.persisted,
        messages: getImageNodeToolSaveMessages('wedding-3x3')
      })
      pendingWedding3x3NodeId.value = ''
      wedding3x3TaskId = ''
      showWedding3x3Drawer.value = false
    } catch (error) {
      if (!isNodeAvailable(targetId) || error?.name === 'AbortError') return
      dispatchError(messageApi, 'Wedding 3x3 apply failed', error)
    }
  }

  const handleWedding3x3Pending = async (payload = {}) => {
    if (!isNodeAvailable(readReactiveValue(nodeId))) return
    if (pendingWedding3x3NodeId.value) return
    const pendingPayload = { ...readGenerationDefaults(), ...payload }
    wedding3x3TaskMetadata = getTaskMetadata(pendingPayload)
    const nextNodeId = createLinkedImageNode(getImageNodeToolPendingPatch(pendingPayload))
    pendingWedding3x3NodeId.value = nextNodeId || ''
    await flushSave()
  }

  const handleWedding3x3Submitted = async (taskId) => {
    wedding3x3TaskId = taskId
    await saveSubmittedTask(pendingWedding3x3NodeId.value, taskId, wedding3x3TaskMetadata)
  }

  const handleWedding3x3Error = async (payload = {}) => {
    if (!pendingWedding3x3NodeId.value) return
    const failedNodeId = pendingWedding3x3NodeId.value
    if (!isNodeAvailable(failedNodeId)) return
    const clearTask = payload.imageTaskTerminal === true
    if (clearTask || !wedding3x3TaskId) pendingWedding3x3NodeId.value = ''
    if (clearTask) wedding3x3TaskId = ''
    await updateLinkedImageNode(failedNodeId, {
      ...getImageNodeToolErrorPatch({
        payload,
        fallbackMessage: 'Wedding 3x3 generation failed'
      }),
      ...(clearTask ? { imageTaskId: '', imageTaskMetadata: null } : {})
    })
  }

  return {
    handleMultiAngleApply,
    handleMultiAngleError,
    handleMultiAnglePending,
    handleMultiAngleSubmitted,
    handleWedding3x3Apply,
    handleWedding3x3Error,
    handleWedding3x3Pending,
    handleWedding3x3Submitted,
    pendingMultiAngleNodeId,
    pendingWedding3x3NodeId,
    showMultiAngleDrawer,
    showWedding3x3Drawer
  }
}

export default useImageNodeToolDrawerResults
