import { ref } from 'vue'
import { getCanvasAutoPlacementPosition } from '@/utils/canvasInteraction'

const readReactiveValue = (source) => {
  if (typeof source === 'function') return source()
  if (source && typeof source === 'object' && 'value' in source) return source.value
  return source
}

const dispatchMessage = (messageApi, type, text) => {
  if (!text) return
  const api = readReactiveValue(messageApi)
  api?.[type]?.(text)
}

export const useVideoNodeEnhanceResults = ({
  addEdge,
  addNode,
  currentProjectId,
  edgeStrategy,
  flushSave,
  logger = console,
  messageApi = () => (typeof window === 'undefined' ? null : window.$message),
  nodeId,
  nodes,
  persistMediaUrl,
  saveProject,
  setTimeoutFn = (callback, delay) => setTimeout(callback, delay),
  triggerUpload,
  updateNode,
  updateNodeInternals
} = {}) => {
  const showEnhanceDrawer = ref(false)
  const toolActionLoading = ref('')
  const pendingEnhancedNodeId = ref('')

  const createLinkedVideoNode = (payload = {}) => {
    const resolvedNodeId = readReactiveValue(nodeId)
    const currentNode = (readReactiveValue(nodes) || []).find((node) => node.id === resolvedNodeId)
    const preferredPosition = {
      x: (currentNode?.position?.x || 0) + 360,
      y: currentNode?.position?.y || 0
    }
    const createData = {
      url: '',
      loading: true,
      label: 'Enhanced video',
      ...payload
    }
    const position = getCanvasAutoPlacementPosition({
      preferredPosition,
      nodeType: 'video',
      nodeData: createData,
      existingNodes: readReactiveValue(nodes) || []
    })

    const linkedNodeId = addNode('video', position, createData)

    addEdge(edgeStrategy.resolve({
      source: resolvedNodeId,
      target: linkedNodeId,
      sourceHandle: 'right',
      targetHandle: 'left'
    }))

    setTimeoutFn(() => {
      updateNodeInternals(linkedNodeId)
    }, 50)

    return linkedNodeId
  }

  const updateLinkedVideoNode = async (targetNodeId, payload = {}) => {
    if (!targetNodeId) return false
    updateNode(targetNodeId, {
      ...payload,
      updatedAt: Date.now()
    })
    return saveProject()
  }

  const resolveVideoPersistence = async (rawValue, fileName) => {
    const rawUrl = String(rawValue || '').trim()
    if (!rawUrl) {
      throw new Error('No video output')
    }

    try {
      const stableUrl = await persistMediaUrl(rawUrl, fileName, {
        projectId: readReactiveValue(currentProjectId),
        source: 'video_enhance',
        sourceNodeId: readReactiveValue(nodeId)
      })
      if (stableUrl) {
        return {
          persisted: true,
          persistedUrl: stableUrl,
          displayUrl: stableUrl
        }
      }
    } catch (error) {
      logger?.warn?.('Video persistence failed, keeping preview only:', error)
    }

    return {
      persisted: false,
      persistedUrl: '',
      displayUrl: rawUrl
    }
  }

  const handleToolAction = async (key) => {
    if (key === 'replace-video') {
      triggerUpload()
      return
    }
    if (key === 'enhance-video') {
      showEnhanceDrawer.value = true
    }
  }

  const handleEnhancePending = async (payload = {}) => {
    if (payload.targetMode === 'replace') return
    if (pendingEnhancedNodeId.value) return

    toolActionLoading.value = 'enhance-video'
    const linkedNodeId = createLinkedVideoNode({
      fileType: payload.fileType || 'video/mp4',
      sourceTool: 'video-enhance',
      error: ''
    })
    pendingEnhancedNodeId.value = linkedNodeId || ''
    await flushSave()
  }

  const handleEnhanceApply = async (payload = {}) => {
    const targetNodeId = pendingEnhancedNodeId.value
    pendingEnhancedNodeId.value = ''

    try {
      const persistence = await resolveVideoPersistence(
        payload.url,
        `enhanced-video-${Date.now()}.mp4`
      )

      const savedOk = await updateLinkedVideoNode(targetNodeId, {
        url: persistence.persisted ? persistence.persistedUrl : persistence.displayUrl,
        loading: false,
        error: '',
        fileType: payload.fileType || 'video/mp4',
        persistStatus: persistence.persisted ? 'saved' : 'error',
        persistError: persistence.persisted ? '' : 'Enhanced result is only shown temporarily. Please retry.'
      })

      if (persistence.persisted && savedOk) {
        dispatchMessage(messageApi, 'success', 'Enhanced video created')
      } else if (!persistence.persisted) {
        dispatchMessage(messageApi, 'warning', 'Enhanced result is only shown temporarily. Please retry until it is saved.')
      } else {
        dispatchMessage(messageApi, 'warning', 'Enhanced video created, but project save failed. Please retry save.')
      }
      showEnhanceDrawer.value = false
    } catch (error) {
      if (targetNodeId) {
        await updateLinkedVideoNode(targetNodeId, {
          loading: false,
          error: error?.message || 'Video enhancement failed'
        })
      }
      dispatchMessage(messageApi, 'error', error?.message || 'Video enhancement failed')
    } finally {
      toolActionLoading.value = ''
    }
  }

  const handleEnhanceError = async (payload = {}) => {
    const failedNodeId = pendingEnhancedNodeId.value
    pendingEnhancedNodeId.value = ''
    toolActionLoading.value = ''
    if (!failedNodeId) return
    await updateLinkedVideoNode(failedNodeId, {
      loading: false,
      error: payload?.message || 'Video enhancement failed'
    })
  }

  return {
    handleEnhanceApply,
    handleEnhanceError,
    handleEnhancePending,
    handleToolAction,
    showEnhanceDrawer,
    toolActionLoading
  }
}

export default useVideoNodeEnhanceResults
