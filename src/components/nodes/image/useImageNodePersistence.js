const readReactiveValue = (source) => {
  if (typeof source === 'function') return source()
  if (source && typeof source === 'object' && 'value' in source) return source.value
  return source
}

const getDefaultMessageApi = () => (
  typeof window === 'undefined' ? null : window.$message
)

export const useImageNodePersistence = ({
  currentProjectId,
  getImageNodeSaveFeedback,
  getImageNodeToolSaveMessage,
  logger = console,
  messageApi = getDefaultMessageApi,
  nodeId,
  persistImageUrl,
  projectSaveState
} = {}) => {
  const resolveImagePersistence = async (rawValue, fileName, persistenceFailureMessage) => {
    const rawUrl = String(rawValue || '').trim()
    if (!rawUrl) {
      throw new Error('No image output')
    }

    try {
      const stableUrl = await persistImageUrl(rawUrl, fileName, {
        projectId: readReactiveValue(currentProjectId),
        source: 'image_node',
        sourceNodeId: readReactiveValue(nodeId)
      })
      if (stableUrl) {
        return {
          persistedUrl: stableUrl,
          displayUrl: stableUrl,
          persisted: true,
          persistError: ''
        }
      }
    } catch (error) {
      logger?.warn?.('Image persistence failed, keeping preview only:', error)
    }

    return {
      persistedUrl: '',
      displayUrl: rawUrl,
      persisted: false,
      persistError: persistenceFailureMessage
    }
  }

  const resolveImageSaveFeedback = (savedOk) => {
    return getImageNodeSaveFeedback(savedOk, readReactiveValue(projectSaveState) || {})
  }

  const showImageToolSaveMessage = ({
    saveFeedback,
    saveState,
    persisted = true,
    messages
  } = {}) => {
    const message = getImageNodeToolSaveMessage({
      saveFeedback,
      saveState,
      persisted,
      messages
    })
    if (!message?.text) return

    const api = readReactiveValue(messageApi)
    api?.[message.type]?.(message.text)
  }

  return {
    resolveImagePersistence,
    resolveImageSaveFeedback,
    showImageToolSaveMessage
  }
}

export default useImageNodePersistence
