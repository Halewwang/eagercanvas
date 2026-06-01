import { computed, getCurrentInstance, onUnmounted, ref, watch } from 'vue'

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

const ensureRef = (source, fallback) => (
  source && typeof source === 'object' && 'value' in source
    ? source
    : ref(fallback)
)

const getDefaultWindow = () => (typeof window === 'undefined' ? null : window)

const dispatchMessage = (messageApi, type, text) => {
  if (!text) return
  const api = readReactiveValue(messageApi)
  api?.[type]?.(text)
}

export const useVideoNodeUploadPersistence = ({
  addWindowEventListener = (type, handler) => getDefaultWindow()?.addEventListener(type, handler),
  currentProjectId,
  flushSave,
  logger = console,
  maxUploadSizeBytes = 60 * 1024 * 1024,
  messageApi = () => getDefaultWindow()?.$message,
  nodeId,
  removeWindowEventListener = (type, handler) => getDefaultWindow()?.removeEventListener(type, handler),
  setTimeoutFn = (callback, delay) => getDefaultWindow()?.setTimeout(callback, delay),
  showValidationModal,
  updateNode,
  uploadInputRef,
  uploadVideoFile,
  validationMessage,
  validationTitle
} = {}) => {
  const isUploading = ref(false)
  const showUploadProgress = ref(false)
  const uploadProgress = ref(0)
  const uploadStage = ref('idle')
  const uploadInputRefState = ensureRef(uploadInputRef, null)
  const showValidationModalRef = ensureRef(showValidationModal, false)
  const validationTitleRef = ensureRef(validationTitle, 'Upload Limit')
  const validationMessageRef = ensureRef(validationMessage, '')

  const uploadProgressStyle = computed(() => {
    const percent = Math.max(0, Math.min(100, uploadProgress.value))
    const color =
      uploadStage.value === 'error'
        ? '#c46a5c'
        : uploadStage.value === 'success'
          ? '#8b9272'
          : '#d8dbe0'
    return {
      width: `${percent}%`,
      background: color
    }
  })

  const beforeUnloadGuard = (event) => {
    if (!isUploading.value) return
    event.preventDefault()
    event.returnValue = 'Video upload is still in progress. Leaving now may lose it.'
  }

  watch(isUploading, (uploading) => {
    if (uploading) {
      addWindowEventListener('beforeunload', beforeUnloadGuard)
    } else {
      removeWindowEventListener('beforeunload', beforeUnloadGuard)
    }
  })

  if (getCurrentInstance()) {
    onUnmounted(() => {
      removeWindowEventListener('beforeunload', beforeUnloadGuard)
    })
  }

  const triggerUpload = () => {
    if (isUploading.value) return
    uploadInputRefState.value?.click?.()
  }

  const resetUploadProgress = (delayMs = 1500) => {
    setTimeoutFn(() => {
      if (uploadStage.value === 'success' || uploadStage.value === 'error') {
        showUploadProgress.value = false
        uploadProgress.value = 0
        uploadStage.value = 'idle'
      }
    }, delayMs)
  }

  const handleFileUpload = async (event) => {
    const file = event?.target?.files?.[0]
    if (!file) return

    const resolvedNodeId = readReactiveValue(nodeId)

    try {
      if (file.size > maxUploadSizeBytes) {
        validationTitleRef.value = 'Upload Limit'
        validationMessageRef.value = 'Video is too large. Maximum file size is 60MB.'
        showValidationModalRef.value = true
        return
      }

      updateNode(resolvedNodeId, { loading: false, error: '' })
      isUploading.value = true
      showUploadProgress.value = true
      uploadStage.value = 'uploading'
      uploadProgress.value = 3

      const url = await uploadVideoFile(file, {
        projectId: readReactiveValue(currentProjectId),
        source: 'video_upload',
        sourceNodeId: resolvedNodeId,
        onProgress: (percent) => {
          uploadStage.value = 'uploading'
          uploadProgress.value = Math.max(uploadProgress.value, Math.min(92, percent))
        }
      })

      if (!url) throw new Error('Upload failed: No URL returned')

      uploadStage.value = 'saving'
      uploadProgress.value = Math.max(uploadProgress.value, 95)
      updateNode(resolvedNodeId, {
        url,
        fileName: file.name,
        fileType: file.type,
        updatedAt: Date.now(),
        loading: false,
        error: ''
      })
      const savedOk = await flushSave()
      if (savedOk) {
        uploadStage.value = 'success'
        uploadProgress.value = 100
        dispatchMessage(messageApi, 'success', 'Upload complete and saved')
        resetUploadProgress(900)
      } else {
        uploadStage.value = 'error'
        uploadProgress.value = 100
        dispatchMessage(messageApi, 'warning', 'Project save failed after upload. Please retry save.')
        resetUploadProgress(2200)
      }
    } catch (err) {
      logger?.error?.('Video upload error:', err)
      updateNode(resolvedNodeId, { loading: false, error: err.message || 'Upload failed' })
      uploadStage.value = 'error'
      uploadProgress.value = 100
      resetUploadProgress(2200)
      dispatchMessage(messageApi, 'error', `Video upload failed: ${err.message || 'Unknown error'}`)
    } finally {
      isUploading.value = false
      if (event?.target) event.target.value = ''
    }
  }

  return {
    handleFileUpload,
    isUploading,
    resetUploadProgress,
    showUploadProgress,
    triggerUpload,
    uploadProgress,
    uploadProgressStyle,
    uploadStage
  }
}

export default useVideoNodeUploadPersistence
