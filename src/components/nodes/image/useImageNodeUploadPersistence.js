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
const getDefaultUrlApi = () => getDefaultWindow()?.URL || globalThis.URL

const dispatchMessage = (messageApi, type, text) => {
  if (!text) return
  const api = readReactiveValue(messageApi)
  api?.[type]?.(text)
}

export const useImageNodeUploadPersistence = ({
  applyUploadSaveOutcome,
  clearLocalPreviewUrl,
  createObjectURL = (file) => getDefaultUrlApi()?.createObjectURL(file),
  currentData,
  currentProjectId,
  flushSave,
  getErrorMessage,
  getImageDimensionsFromFile,
  getImageNodeActionErrorPatch,
  getImageNodeSaveFeedbackPatch,
  getImageNodeUploadFailureOutcome,
  getImageNodeUploadFailurePatch,
  getImageNodeUploadMetadata,
  getImageNodeUploadPreviewPatch,
  getImageNodeUploadedPatch,
  getImageNodeUploadSaveOutcome,
  isLocalPreviewMode,
  isUploading,
  localImageRatio,
  localImageSize,
  maxUploadSizeBytes = 150 * 1024 * 1024,
  messageApi = () => getDefaultWindow()?.$message,
  nodeId,
  projectSaveState,
  replaceLocalPreviewUrl,
  resetUploadProgress,
  resolveImageSaveFeedback,
  setTimeoutFn = (callback, delay) => getDefaultWindow()?.setTimeout(callback, delay),
  showUploadProgress,
  showValidationModal,
  updateNode,
  updateNodeInternals,
  uploadImageFile,
  uploadProgress,
  uploadStage,
  validationMessage
} = {}) => {
  const handleFileUpload = async (event) => {
    const file = event?.target?.files?.[0]
    if (!file) return

    const resolvedNodeId = readReactiveValue(nodeId)

    try {
      if (file.size > maxUploadSizeBytes) {
        writeReactiveValue(validationMessage, 'Image is too large. Maximum file size is 150MB.')
        writeReactiveValue(showValidationModal, true)
        return
      }

      const { width: w, height: h } = await getImageDimensionsFromFile(file)
      const previewUrl = createObjectURL(file)
      const uploadMetadata = getImageNodeUploadMetadata({
        width: w,
        height: h,
        currentSize: readReactiveValue(localImageSize)
      })

      replaceLocalPreviewUrl(previewUrl)
      updateNode(resolvedNodeId, getImageNodeUploadPreviewPatch({
        previewUrl,
        file,
        currentData: readReactiveValue(currentData),
        isLocalPreviewMode: readReactiveValue(isLocalPreviewMode),
        metadata: uploadMetadata
      }))
      writeReactiveValue(localImageRatio, uploadMetadata.ratio)
      if (w && h) {
        writeReactiveValue(localImageSize, uploadMetadata.size)
      }

      setTimeoutFn(() => updateNodeInternals(resolvedNodeId), 30)

      if (readReactiveValue(isLocalPreviewMode)) {
        await flushSave()
        writeReactiveValue(showUploadProgress, true)
        writeReactiveValue(uploadStage, 'success')
        writeReactiveValue(uploadProgress, 100)
        writeReactiveValue(isUploading, false)
        dispatchMessage(messageApi, 'success', 'Image uploaded locally')
        resetUploadProgress(900)
        return
      }

      writeReactiveValue(isUploading, true)
      writeReactiveValue(showUploadProgress, true)
      writeReactiveValue(uploadStage, 'uploading')
      writeReactiveValue(uploadProgress, 3)
      try {
        const uploadedUrl = await uploadImageFile(file, {
          projectId: readReactiveValue(currentProjectId),
          source: 'image_upload',
          sourceNodeId: resolvedNodeId,
          onProgress: (percent) => {
            writeReactiveValue(uploadStage, 'uploading')
            writeReactiveValue(
              uploadProgress,
              Math.max(readReactiveValue(uploadProgress), Math.min(92, percent))
            )
          }
        })
        if (uploadedUrl) {
          writeReactiveValue(uploadStage, 'saving')
          writeReactiveValue(uploadProgress, Math.max(readReactiveValue(uploadProgress), 95))
          clearLocalPreviewUrl()
          updateNode(resolvedNodeId, getImageNodeUploadedPatch({
            uploadedUrl,
            file,
            currentData: readReactiveValue(currentData)
          }))
          const savedOk = await flushSave()
          const saveState = readReactiveValue(projectSaveState) || {}
          const saveFeedback = resolveImageSaveFeedback(savedOk)
          updateNode(resolvedNodeId, getImageNodeSaveFeedbackPatch({ saveFeedback }))
          applyUploadSaveOutcome(getImageNodeUploadSaveOutcome({
            saveFeedback,
            saveState
          }))
        } else {
          writeReactiveValue(uploadStage, 'error')
          writeReactiveValue(uploadProgress, 100)
          dispatchMessage(messageApi, 'warning', 'Cloud upload failed. Please retry.')
          resetUploadProgress(2200)
        }
      } catch (err) {
        updateNode(resolvedNodeId, getImageNodeUploadFailurePatch())
        const savedOk = await flushSave()
        const failureOutcome = getImageNodeUploadFailureOutcome({
          savedOk,
          saveState: readReactiveValue(projectSaveState) || {}
        })
        writeReactiveValue(uploadStage, failureOutcome.uploadStage)
        writeReactiveValue(uploadProgress, failureOutcome.uploadProgress)
        if (failureOutcome.message?.text) {
          dispatchMessage(messageApi, failureOutcome.message.type, failureOutcome.message.text)
        }
        resetUploadProgress(failureOutcome.resetDelayMs)
      } finally {
        writeReactiveValue(isUploading, false)
      }
    } catch (err) {
      const message = getErrorMessage(err, 'Image upload failed')
      updateNode(resolvedNodeId, getImageNodeActionErrorPatch({ message }))
      dispatchMessage(messageApi, 'error', message)
    } finally {
      if (event?.target) event.target.value = ''
    }
  }

  return {
    handleFileUpload
  }
}

export default useImageNodeUploadPersistence
