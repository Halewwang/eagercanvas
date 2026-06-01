import { getCurrentInstance, onUnmounted, ref, watch } from 'vue'

const getDefaultWindow = () => (typeof window === 'undefined' ? null : window)
const getDefaultUrlApi = () => getDefaultWindow()?.URL || globalThis.URL

export const isImageNodeBlobUrl = (value) => String(value || '').startsWith('blob:')

const ensureRef = (source, fallback) => (
  source && typeof source === 'object' && 'value' in source
    ? source
    : ref(fallback)
)

export const useImageNodeUploadLifecycle = ({
  addWindowEventListener = (type, handler) => getDefaultWindow()?.addEventListener(type, handler),
  messageApi = () => getDefaultWindow()?.$message,
  removeWindowEventListener = (type, handler) => getDefaultWindow()?.removeEventListener(type, handler),
  revokeObjectURL = (value) => getDefaultUrlApi()?.revokeObjectURL(value),
  setTimeoutFn = (callback, delay) => getDefaultWindow()?.setTimeout(callback, delay),
  showUploadProgress,
  uploadInputRef,
  uploadProgress,
  uploadStage
} = {}) => {
  const isUploading = ref(false)
  const localPreviewUrl = ref('')
  const showUploadProgressRef = ensureRef(showUploadProgress, false)
  const uploadProgressRef = ensureRef(uploadProgress, 0)
  const uploadStageRef = ensureRef(uploadStage, 'idle')
  const uploadInputRefState = ensureRef(uploadInputRef, null)

  const revokeBlobUrl = (value) => {
    if (!isImageNodeBlobUrl(value)) return
    try {
      revokeObjectURL(String(value))
    } catch {}
  }

  const clearLocalPreviewUrl = () => {
    if (!localPreviewUrl.value) return
    revokeBlobUrl(localPreviewUrl.value)
    localPreviewUrl.value = ''
  }

  const replaceLocalPreviewUrl = (nextUrl = '') => {
    if (localPreviewUrl.value && localPreviewUrl.value !== nextUrl) {
      revokeBlobUrl(localPreviewUrl.value)
    }
    localPreviewUrl.value = isImageNodeBlobUrl(nextUrl) ? String(nextUrl) : ''
  }

  const beforeUnloadGuard = (event) => {
    if (!isUploading.value) return
    event.preventDefault()
    event.returnValue = 'Image upload is still in progress. Leaving now may lose it.'
  }

  watch(isUploading, (uploading) => {
    if (uploading) {
      addWindowEventListener('beforeunload', beforeUnloadGuard)
    } else {
      removeWindowEventListener('beforeunload', beforeUnloadGuard)
    }
  })

  const resetUploadProgress = (delayMs = 1500) => {
    setTimeoutFn(() => {
      if (uploadStageRef.value === 'success' || uploadStageRef.value === 'error') {
        showUploadProgressRef.value = false
        uploadProgressRef.value = 0
        uploadStageRef.value = 'idle'
      }
    }, delayMs)
  }

  const applyUploadSaveOutcome = (outcome = {}) => {
    uploadStageRef.value = outcome.uploadStage || 'error'
    uploadProgressRef.value = Number(outcome.uploadProgress) || 100
    if (outcome.message?.text) {
      const api = typeof messageApi === 'function' ? messageApi() : messageApi
      api?.[outcome.message.type]?.(outcome.message.text)
    }
    resetUploadProgress(outcome.resetDelayMs || 2200)
  }

  const triggerUpload = () => {
    if (isUploading.value) return
    uploadInputRefState.value?.click?.()
  }

  if (getCurrentInstance()) {
    onUnmounted(() => {
      removeWindowEventListener('beforeunload', beforeUnloadGuard)
      clearLocalPreviewUrl()
    })
  }

  return {
    applyUploadSaveOutcome,
    clearLocalPreviewUrl,
    isUploading,
    localPreviewUrl,
    replaceLocalPreviewUrl,
    resetUploadProgress,
    triggerUpload
  }
}

export default useImageNodeUploadLifecycle
