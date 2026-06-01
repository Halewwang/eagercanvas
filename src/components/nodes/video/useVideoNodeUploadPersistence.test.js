import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'
import { nextTick, ref } from 'vue'

const uploadPersistenceUrl = new URL('./useVideoNodeUploadPersistence.js', import.meta.url)
const vueUrl = import.meta.resolve('vue')

const loadUploadPersistence = async () => {
  assert.ok(existsSync(uploadPersistenceUrl), 'useVideoNodeUploadPersistence.js should exist')
  const source = readFileSync(uploadPersistenceUrl, 'utf8')
    .replace("from 'vue'", `from '${vueUrl}'`)
  return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)
}

const createEvent = (file) => ({
  target: {
    files: file ? [file] : [],
    value: 'selected-video'
  }
})

const createHarness = async (overrides = {}) => {
  const { useVideoNodeUploadPersistence } = await loadUploadPersistence()
  const calls = []
  const messages = []
  const listeners = []
  const logger = {
    error: (...args) => calls.push(['logger-error', ...args])
  }
  const uploadInputRef = ref({ click: () => calls.push(['input-click']) })
  const showValidationModal = ref(false)
  const validationTitle = ref('Upload Limit')
  const validationMessage = ref('')
  const file = overrides.file || {
    name: 'clip.mp4',
    size: 1024,
    type: 'video/mp4'
  }

  const uploadPersistence = useVideoNodeUploadPersistence({
    addWindowEventListener: (type, handler) => listeners.push(['add', type, handler]),
    currentProjectId: ref('project-1'),
    flushSave: async () => {
      calls.push(['flush-save'])
      return overrides.savedOk ?? true
    },
    logger,
    maxUploadSizeBytes: overrides.maxUploadSizeBytes || 60 * 1024 * 1024,
    messageApi: () => ({
      error: (text) => messages.push(['error', text]),
      success: (text) => messages.push(['success', text]),
      warning: (text) => messages.push(['warning', text])
    }),
    nodeId: () => 'video-node-1',
    removeWindowEventListener: (type, handler) => listeners.push(['remove', type, handler]),
    setTimeoutFn: (callback, delayMs) => calls.push(['set-timeout', delayMs, callback]),
    showValidationModal,
    updateNode: (...args) => calls.push(['update-node', ...args]),
    uploadInputRef,
    uploadVideoFile: async (...args) => {
      calls.push(['upload-video-file', ...args])
      if (overrides.uploadError) throw overrides.uploadError
      args[1]?.onProgress?.(overrides.uploadProgressPercent || 64)
      return overrides.uploadedUrl
    },
    validationMessage,
    validationTitle
  })

  return {
    calls,
    event: createEvent(file),
    file,
    listeners,
    messages,
    showValidationModal,
    uploadPersistence,
    uploadInputRef,
    validationMessage,
    validationTitle
  }
}

test('video node upload persistence validates file size before uploading', async () => {
  const {
    calls,
    event,
    showValidationModal,
    uploadPersistence,
    validationMessage,
    validationTitle
  } = await createHarness({
    file: {
      name: 'huge.mp4',
      size: 61,
      type: 'video/mp4'
    },
    maxUploadSizeBytes: 60
  })

  await uploadPersistence.handleFileUpload(event)

  assert.equal(validationTitle.value, 'Upload Limit')
  assert.equal(validationMessage.value, 'Video is too large. Maximum file size is 60MB.')
  assert.equal(showValidationModal.value, true)
  assert.deepEqual(calls, [])
  assert.equal(event.target.value, '')
})

test('video node upload persistence uploads, saves, and reports success', async () => {
  const {
    calls,
    event,
    file,
    messages,
    uploadPersistence
  } = await createHarness({
    uploadedUrl: 'https://cdn.example.com/video.mp4'
  })

  await uploadPersistence.handleFileUpload(event)

  assert.equal(uploadPersistence.isUploading.value, false)
  assert.equal(uploadPersistence.showUploadProgress.value, true)
  assert.equal(uploadPersistence.uploadStage.value, 'success')
  assert.equal(uploadPersistence.uploadProgress.value, 100)
  assert.deepEqual(calls[0], ['update-node', 'video-node-1', { loading: false, error: '' }])
  const uploadCall = calls.find((call) => call[0] === 'upload-video-file')
  assert.equal(uploadCall[1], file)
  assert.equal(uploadCall[2].projectId, 'project-1')
  assert.equal(uploadCall[2].source, 'video_upload')
  assert.equal(uploadCall[2].sourceNodeId, 'video-node-1')
  assert.deepEqual(calls.find((call) => call[0] === 'update-node' && call[2]?.url), [
    'update-node',
    'video-node-1',
    {
      url: 'https://cdn.example.com/video.mp4',
      fileName: 'clip.mp4',
      fileType: 'video/mp4',
      updatedAt: calls.find((call) => call[0] === 'update-node' && call[2]?.url)[2].updatedAt,
      loading: false,
      error: ''
    }
  ])
  assert.deepEqual(calls.filter((call) => call[0] === 'flush-save'), [['flush-save']])
  assert.deepEqual(messages, [['success', 'Upload complete and saved']])
  assert.deepEqual(calls.find((call) => call[0] === 'set-timeout'), ['set-timeout', 900, calls.find((call) => call[0] === 'set-timeout')[2]])
  assert.equal(event.target.value, '')
})

test('video node upload persistence keeps upload visible when project save fails', async () => {
  const {
    calls,
    event,
    messages,
    uploadPersistence
  } = await createHarness({
    savedOk: false,
    uploadedUrl: 'https://cdn.example.com/video.mp4'
  })

  await uploadPersistence.handleFileUpload(event)

  assert.equal(uploadPersistence.isUploading.value, false)
  assert.equal(uploadPersistence.uploadStage.value, 'error')
  assert.equal(uploadPersistence.uploadProgress.value, 100)
  assert.deepEqual(messages, [['warning', 'Project save failed after upload. Please retry save.']])
  assert.deepEqual(calls.find((call) => call[0] === 'set-timeout'), ['set-timeout', 2200, calls.find((call) => call[0] === 'set-timeout')[2]])
  assert.equal(event.target.value, '')
})

test('video node upload persistence stores upload errors on the node', async () => {
  const {
    calls,
    event,
    messages,
    uploadPersistence
  } = await createHarness({
    uploadError: new Error('network down')
  })

  await uploadPersistence.handleFileUpload(event)

  assert.equal(uploadPersistence.isUploading.value, false)
  assert.equal(uploadPersistence.uploadStage.value, 'error')
  assert.equal(uploadPersistence.uploadProgress.value, 100)
  const loggerCall = calls.find((call) => call[0] === 'logger-error')
  assert.equal(loggerCall[1], 'Video upload error:')
  assert.equal(loggerCall[2].message, 'network down')
  assert.deepEqual(calls.find((call) => call[0] === 'update-node' && call[2]?.error === 'network down'), [
    'update-node',
    'video-node-1',
    {
      loading: false,
      error: 'network down'
    }
  ])
  assert.deepEqual(messages, [['error', 'Video upload failed: network down']])
  assert.deepEqual(calls.find((call) => call[0] === 'set-timeout'), ['set-timeout', 2200, calls.find((call) => call[0] === 'set-timeout')[2]])
  assert.equal(event.target.value, '')
})

test('video node upload persistence owns trigger guard and unload listener lifecycle', async () => {
  const { calls, listeners, uploadPersistence } = await createHarness()

  uploadPersistence.triggerUpload()
  assert.deepEqual(calls, [['input-click']])

  uploadPersistence.isUploading.value = true
  await nextTick()
  uploadPersistence.triggerUpload()
  assert.deepEqual(calls, [['input-click']])
  assert.equal(listeners[0][0], 'add')
  assert.equal(listeners[0][1], 'beforeunload')

  const beforeUnloadEvent = {
    preventDefault: () => calls.push(['prevent-default'])
  }
  listeners[0][2](beforeUnloadEvent)
  assert.deepEqual(calls.at(-1), ['prevent-default'])
  assert.equal(beforeUnloadEvent.returnValue, 'Video upload is still in progress. Leaving now may lose it.')

  uploadPersistence.isUploading.value = false
  await nextTick()
  assert.equal(listeners.at(-1)[0], 'remove')
  assert.equal(listeners.at(-1)[1], 'beforeunload')
})
