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
  localImageQuality,
  localImageRatio,
  localImageSize,
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

  const handleMultiAngleApply = async (payload = {}) => {
    const nextPayload = {
      ...payload,
      fileName: getMultiAngleFileName()
    }

    try {
      const persistence = await resolveImagePersistence(
        nextPayload.base64 || nextPayload.url,
        nextPayload.fileName,
        'Multi-angle persistence failed. Please retry.'
      )

      if (payload.targetMode === 'replace') {
        const previousPersistedUrl = String(readReactiveValue(currentData)?.url || '').trim()
        updateNode(readReactiveValue(nodeId), getImageNodeToolReplacementPatch({
          persistence,
          previousPersistedUrl,
          size: nextPayload.size || readReactiveValue(localImageSize),
          ratio: nextPayload.ratio || readReactiveValue(localImageRatio),
          resolution: nextPayload.resolution || readReactiveValue(localResolution),
          fileType: nextPayload.fileType || 'image/png',
          transientPersistError: 'Multi-angle result is only shown temporarily. Please retry.'
        }))

        const savedOk = await flushSave()
        const saveState = readReactiveValue(projectSaveState) || {}
        const saveFeedback = resolveImageSaveFeedback(savedOk)
        updateNode(readReactiveValue(nodeId), getImageNodeSaveFeedbackPatch({ saveFeedback }))
        showImageToolSaveMessage({
          saveFeedback,
          saveState,
          persisted: persistence.persisted,
          messages: getImageNodeToolSaveMessages('multi-angle-replace')
        })
      } else {
        let savedOk = true
        if (pendingMultiAngleNodeId.value) {
          savedOk = await updateLinkedImageNode(pendingMultiAngleNodeId.value, getImageNodeToolLinkedResultPatch({
            persistence,
            payload: nextPayload,
            defaults: {
              size: readReactiveValue(localImageSize),
              ratio: readReactiveValue(localImageRatio),
              resolution: readReactiveValue(localResolution)
            },
            transientPersistError: 'Multi-angle result is only shown temporarily. Please retry.'
          }))
        } else {
          createLinkedImageNode(getImageNodeToolLinkedCreatePatch({
            persistence,
            payload: nextPayload,
            defaults: {
              size: readReactiveValue(localImageSize),
              ratio: readReactiveValue(localImageRatio),
              resolution: readReactiveValue(localResolution)
            }
          }))
          savedOk = await flushSave()
        }
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
      showMultiAngleDrawer.value = false
    } catch (error) {
      dispatchError(messageApi, 'Multi-angle apply failed', error)
    }
  }

  const handleMultiAnglePending = async (payload = {}) => {
    if (payload.targetMode === 'replace') return
    if (pendingMultiAngleNodeId.value) return
    const nextNodeId = createLinkedImageNode(getImageNodeToolPendingPatch(payload))
    pendingMultiAngleNodeId.value = nextNodeId || ''
    await flushSave()
  }

  const handleMultiAngleError = async (payload = {}) => {
    if (!pendingMultiAngleNodeId.value) return
    const failedNodeId = pendingMultiAngleNodeId.value
    pendingMultiAngleNodeId.value = ''
    await updateLinkedImageNode(failedNodeId, getImageNodeToolErrorPatch({
      payload,
      fallbackMessage: 'Multi-angle generation failed'
    }))
  }

  const handleWedding3x3Apply = async (payload = {}) => {
    const nextPayload = {
      ...payload,
      fileName: getWedding3x3FileName()
    }

    try {
      const persistence = await resolveImagePersistence(
        nextPayload.base64 || nextPayload.url,
        nextPayload.fileName,
        'Wedding 3x3 persistence failed. Please retry.'
      )

      let savedOk = true
      if (pendingWedding3x3NodeId.value) {
        savedOk = await updateLinkedImageNode(pendingWedding3x3NodeId.value, getImageNodeToolLinkedResultPatch({
          persistence,
          payload: nextPayload,
          defaults: {
            size: readReactiveValue(localImageSize),
            ratio: readReactiveValue(localImageRatio),
            resolution: readReactiveValue(localResolution),
            quality: readReactiveValue(localImageQuality)
          },
          labelFallback: 'Wedding 3x3 Result',
          includeQuality: true,
          includeSource: true,
          transientPersistError: 'Wedding 3x3 result is only shown temporarily. Please retry.'
        }))
      } else {
        createLinkedImageNode(getImageNodeToolLinkedCreatePatch({
          persistence,
          payload: nextPayload,
          defaults: {
            size: readReactiveValue(localImageSize),
            ratio: readReactiveValue(localImageRatio),
            resolution: readReactiveValue(localResolution),
            quality: readReactiveValue(localImageQuality)
          },
          labelFallback: 'Wedding 3x3 Result',
          includeQuality: true,
          includeSource: true
        }))
        savedOk = await flushSave()
      }

      const saveState = readReactiveValue(projectSaveState) || {}
      const saveFeedback = resolveImageSaveFeedback(savedOk)
      showImageToolSaveMessage({
        saveFeedback,
        saveState,
        persisted: persistence.persisted,
        messages: getImageNodeToolSaveMessages('wedding-3x3')
      })
      pendingWedding3x3NodeId.value = ''
      showWedding3x3Drawer.value = false
    } catch (error) {
      dispatchError(messageApi, 'Wedding 3x3 apply failed', error)
    }
  }

  const handleWedding3x3Pending = async (payload = {}) => {
    if (pendingWedding3x3NodeId.value) return
    const nextNodeId = createLinkedImageNode(getImageNodeToolPendingPatch(payload))
    pendingWedding3x3NodeId.value = nextNodeId || ''
    await flushSave()
  }

  const handleWedding3x3Error = async (payload = {}) => {
    if (!pendingWedding3x3NodeId.value) return
    const failedNodeId = pendingWedding3x3NodeId.value
    pendingWedding3x3NodeId.value = ''
    await updateLinkedImageNode(failedNodeId, getImageNodeToolErrorPatch({
      payload,
      fallbackMessage: 'Wedding 3x3 generation failed'
    }))
  }

  return {
    handleMultiAngleApply,
    handleMultiAngleError,
    handleMultiAnglePending,
    handleWedding3x3Apply,
    handleWedding3x3Error,
    handleWedding3x3Pending,
    pendingMultiAngleNodeId,
    pendingWedding3x3NodeId,
    showMultiAngleDrawer,
    showWedding3x3Drawer
  }
}

export default useImageNodeToolDrawerResults
