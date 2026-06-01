import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const uploadPersistenceUrl = new URL('./useImageNodeUploadPersistence.js', import.meta.url)
const uploadPersistencePath = fileURLToPath(uploadPersistenceUrl)

const loadUploadPersistence = async () => {
  assert.ok(existsSync(uploadPersistencePath), 'useImageNodeUploadPersistence.js should exist')
  const uploadPersistenceSource = readFileSync(uploadPersistenceUrl, 'utf8')
  return import(`data:text/javascript;base64,${Buffer.from(uploadPersistenceSource).toString('base64')}`)
}

const createEvent = (file) => ({
  target: {
    files: file ? [file] : [],
    value: 'selected-file'
  }
})

const createHarness = async (overrides = {}) => {
  const { useImageNodeUploadPersistence } = await loadUploadPersistence()
  const calls = []
  const messages = []
  const showUploadProgress = { value: false }
  const uploadProgress = { value: 0 }
  const uploadStage = { value: 'idle' }
  const isUploading = { value: false }
  const localImageRatio = { value: '1:1' }
  const localImageSize = { value: '1024x1024' }
  const showValidationModal = { value: false }
  const validationMessage = { value: '' }
  const file = overrides.file || {
    name: 'source.png',
    size: 1024,
    type: 'image/png'
  }
  const uploadPersistence = useImageNodeUploadPersistence({
    applyUploadSaveOutcome: (outcome) => calls.push(['apply-upload-outcome', outcome]),
    clearLocalPreviewUrl: () => calls.push(['clear-local-preview']),
    createObjectURL: (nextFile) => {
      calls.push(['create-object-url', nextFile.name])
      return overrides.previewUrl || 'blob:preview-url'
    },
    currentData: () => overrides.currentData || { sourcePrompt: ' keep prompt ' },
    currentProjectId: { value: 'project-1' },
    flushSave: async () => {
      calls.push(['flush-save'])
      return overrides.savedOk ?? true
    },
    getErrorMessage: (error, fallback) => `${fallback}: ${error.message}`,
    getImageDimensionsFromFile: async (nextFile) => {
      calls.push(['dimensions', nextFile.name])
      if (overrides.dimensionError) throw overrides.dimensionError
      return overrides.dimensions || { width: 1600, height: 900 }
    },
    getImageNodeActionErrorPatch: (payload) => ({ kind: 'action-error', payload }),
    getImageNodeSaveFeedbackPatch: (payload) => ({ kind: 'save-feedback', payload }),
    getImageNodeUploadFailureOutcome: (payload) => {
      calls.push(['failure-outcome', payload])
      return {
        uploadStage: 'error',
        uploadProgress: 100,
        resetDelayMs: 2200,
        message: {
          type: 'warning',
          text: payload?.savedOk === false
            ? 'Upload failed and save failed'
            : 'Upload failed temporarily'
        }
      }
    },
    getImageNodeUploadFailurePatch: () => ({ kind: 'upload-failure' }),
    getImageNodeUploadMetadata: (payload) => {
      calls.push(['upload-metadata', payload])
      return {
        ratio: '16:9',
        size: '1600x900'
      }
    },
    getImageNodeUploadPreviewPatch: (payload) => ({ kind: 'upload-preview', payload }),
    getImageNodeUploadedPatch: (payload) => ({ kind: 'uploaded', payload }),
    getImageNodeUploadSaveOutcome: (payload) => ({ kind: 'upload-save-outcome', payload }),
    isLocalPreviewMode: { value: !!overrides.localPreview },
    isUploading,
    localImageRatio,
    localImageSize,
    maxUploadSizeBytes: overrides.maxUploadSizeBytes || 150 * 1024 * 1024,
    messageApi: () => ({
      error: (text) => messages.push(['error', text]),
      success: (text) => messages.push(['success', text]),
      warning: (text) => messages.push(['warning', text])
    }),
    nodeId: () => 'image-node-1',
    projectSaveState: { value: overrides.saveState || { remoteSynced: true } },
    replaceLocalPreviewUrl: (url) => calls.push(['replace-local-preview', url]),
    resetUploadProgress: (delayMs) => calls.push(['reset-upload-progress', delayMs]),
    resolveImageSaveFeedback: (savedOk) => ({ mode: savedOk ? 'synced' : 'local-only' }),
    setTimeoutFn: (callback, delayMs) => {
      calls.push(['set-timeout', delayMs])
      callback()
    },
    showUploadProgress,
    showValidationModal,
    updateNode: (...args) => calls.push(['update-node', ...args]),
    updateNodeInternals: (nodeId) => calls.push(['update-node-internals', nodeId]),
    uploadImageFile: async (...args) => {
      calls.push(['upload-image-file', ...args])
      if (overrides.uploadError) throw overrides.uploadError
      args[1]?.onProgress?.(overrides.uploadProgressPercent || 64)
      return overrides.uploadedUrl
    },
    uploadProgress,
    uploadStage,
    validationMessage
  })

  return {
    calls,
    event: createEvent(file),
    file,
    isUploading,
    localImageRatio,
    localImageSize,
    messages,
    showUploadProgress,
    showValidationModal,
    uploadPersistence,
    uploadProgress,
    uploadStage,
    validationMessage
  }
}

test('image node upload persistence validates file size before preview work', async () => {
  const { calls, event, showValidationModal, uploadPersistence, validationMessage } = await createHarness({
    file: {
      name: 'huge.png',
      size: 151,
      type: 'image/png'
    },
    maxUploadSizeBytes: 150
  })

  await uploadPersistence.handleFileUpload(event)

  assert.equal(validationMessage.value, 'Image is too large. Maximum file size is 150MB.')
  assert.equal(showValidationModal.value, true)
  assert.deepEqual(calls, [])
  assert.equal(event.target.value, '')
})

test('image node upload persistence previews, uploads, saves, and applies save feedback', async () => {
  const {
    calls,
    event,
    file,
    isUploading,
    localImageRatio,
    localImageSize,
    messages,
    showUploadProgress,
    uploadPersistence,
    uploadProgress,
    uploadStage
  } = await createHarness({
    uploadedUrl: 'https://cdn.example.com/uploaded.png'
  })

  await uploadPersistence.handleFileUpload(event)

  assert.equal(isUploading.value, false)
  assert.equal(showUploadProgress.value, true)
  assert.equal(uploadStage.value, 'saving')
  assert.equal(uploadProgress.value, 95)
  assert.equal(localImageRatio.value, '16:9')
  assert.equal(localImageSize.value, '1600x900')
  assert.deepEqual(messages, [])
  assert.deepEqual(calls[0], ['dimensions', 'source.png'])
  assert.deepEqual(calls[1], ['create-object-url', 'source.png'])
  assert.deepEqual(calls[2], ['upload-metadata', {
    width: 1600,
    height: 900,
    currentSize: '1024x1024'
  }])
  assert.deepEqual(calls[3], ['replace-local-preview', 'blob:preview-url'])
  assert.deepEqual(calls[4], ['update-node', 'image-node-1', {
    kind: 'upload-preview',
    payload: {
      previewUrl: 'blob:preview-url',
      file,
      currentData: { sourcePrompt: ' keep prompt ' },
      isLocalPreviewMode: false,
      metadata: {
        ratio: '16:9',
        size: '1600x900'
      }
    }
  }])
  assert.deepEqual(calls[6], ['update-node-internals', 'image-node-1'])
  assert.equal(calls.find((call) => call[0] === 'upload-image-file')?.[2].source, 'image_upload')
  assert.equal(calls.find((call) => call[0] === 'upload-image-file')?.[2].sourceNodeId, 'image-node-1')
  assert.deepEqual(calls.find((call) => call[0] === 'clear-local-preview'), ['clear-local-preview'])
  assert.deepEqual(calls.find((call) => call[0] === 'update-node' && call[2]?.kind === 'uploaded'), [
    'update-node',
    'image-node-1',
    {
      kind: 'uploaded',
      payload: {
        uploadedUrl: 'https://cdn.example.com/uploaded.png',
        file,
        currentData: { sourcePrompt: ' keep prompt ' }
      }
    }
  ])
  assert.deepEqual(calls.find((call) => call[0] === 'update-node' && call[2]?.kind === 'save-feedback'), [
    'update-node',
    'image-node-1',
    {
      kind: 'save-feedback',
      payload: {
        saveFeedback: { mode: 'synced' }
      }
    }
  ])
  assert.deepEqual(calls.find((call) => call[0] === 'apply-upload-outcome')?.[1], {
    kind: 'upload-save-outcome',
    payload: {
      saveFeedback: { mode: 'synced' },
      saveState: { remoteSynced: true }
    }
  })
  assert.equal(event.target.value, '')
})

test('image node upload persistence keeps local preview mode local and marks progress complete', async () => {
  const {
    calls,
    event,
    isUploading,
    messages,
    showUploadProgress,
    uploadPersistence,
    uploadProgress,
    uploadStage
  } = await createHarness({
    localPreview: true
  })

  await uploadPersistence.handleFileUpload(event)

  assert.equal(isUploading.value, false)
  assert.equal(showUploadProgress.value, true)
  assert.equal(uploadStage.value, 'success')
  assert.equal(uploadProgress.value, 100)
  assert.equal(calls.some((call) => call[0] === 'upload-image-file'), false)
  assert.deepEqual(calls.filter((call) => call[0] === 'flush-save'), [['flush-save']])
  assert.deepEqual(calls.find((call) => call[0] === 'update-node' && call[2]?.kind === 'upload-preview')?.[2].payload.isLocalPreviewMode, true)
  assert.deepEqual(messages, [['success', 'Image uploaded locally']])
  assert.deepEqual(calls.find((call) => call[0] === 'reset-upload-progress'), ['reset-upload-progress', 900])
  assert.equal(event.target.value, '')
})

test('image node upload persistence handles empty cloud upload result with retry feedback', async () => {
  const {
    calls,
    event,
    isUploading,
    messages,
    uploadPersistence,
    uploadProgress,
    uploadStage
  } = await createHarness({
    uploadedUrl: ''
  })

  await uploadPersistence.handleFileUpload(event)

  assert.equal(isUploading.value, false)
  assert.equal(uploadStage.value, 'error')
  assert.equal(uploadProgress.value, 100)
  assert.deepEqual(messages, [['warning', 'Cloud upload failed. Please retry.']])
  assert.deepEqual(calls.find((call) => call[0] === 'reset-upload-progress'), ['reset-upload-progress', 2200])
  assert.equal(event.target.value, '')
})

test('image node upload persistence stores upload failure fallback and save warning', async () => {
  const {
    calls,
    event,
    isUploading,
    messages,
    uploadPersistence,
    uploadProgress,
    uploadStage
  } = await createHarness({
    savedOk: false,
    uploadError: new Error('network down')
  })

  await uploadPersistence.handleFileUpload(event)

  assert.equal(isUploading.value, false)
  assert.equal(uploadStage.value, 'error')
  assert.equal(uploadProgress.value, 100)
  assert.deepEqual(calls.find((call) => call[0] === 'update-node' && call[2]?.kind === 'upload-failure'), [
    'update-node',
    'image-node-1',
    { kind: 'upload-failure' }
  ])
  assert.equal(calls.filter((call) => call[0] === 'flush-save').length, 1)
  assert.deepEqual(calls.find((call) => call[0] === 'failure-outcome')?.[1], {
    savedOk: false,
    saveState: { remoteSynced: true }
  })
  assert.deepEqual(messages, [['warning', 'Upload failed and save failed']])
  assert.deepEqual(calls.find((call) => call[0] === 'reset-upload-progress'), ['reset-upload-progress', 2200])
  assert.equal(event.target.value, '')
})

test('image node upload persistence records outer upload setup errors on the node', async () => {
  const { calls, event, messages, uploadPersistence } = await createHarness({
    dimensionError: new Error('dimension read failed')
  })

  await uploadPersistence.handleFileUpload(event)

  assert.deepEqual(calls.find((call) => call[0] === 'update-node' && call[2]?.kind === 'action-error'), [
    'update-node',
    'image-node-1',
    {
      kind: 'action-error',
      payload: {
        message: 'Image upload failed: dimension read failed'
      }
    }
  ])
  assert.deepEqual(messages, [['error', 'Image upload failed: dimension read failed']])
  assert.equal(event.target.value, '')
})
