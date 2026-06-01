import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { nextTick, ref } from 'vue'

const uploadLifecycleUrl = new URL('./useImageNodeUploadLifecycle.js', import.meta.url)
const uploadLifecyclePath = fileURLToPath(uploadLifecycleUrl)
const vueUrl = import.meta.resolve('vue')

const loadUploadLifecycle = async () => {
  assert.ok(existsSync(uploadLifecyclePath), 'useImageNodeUploadLifecycle.js should exist')
  const uploadLifecycleSource = readFileSync(uploadLifecycleUrl, 'utf8')
    .replace("from 'vue'", `from '${vueUrl}'`)
  return import(`data:text/javascript;base64,${Buffer.from(uploadLifecycleSource).toString('base64')}`)
}

const createHarness = async (overrides = {}) => {
  const { useImageNodeUploadLifecycle } = await loadUploadLifecycle()
  const calls = []
  const listeners = new Map()
  const uploadInputRef = ref(overrides.uploadInput || {
    click: () => calls.push(['click-upload'])
  })
  const showUploadProgress = ref(overrides.showUploadProgress ?? true)
  const uploadProgress = ref(overrides.uploadProgress ?? 42)
  const uploadStage = ref(overrides.uploadStage || 'success')
  const upload = useImageNodeUploadLifecycle({
    addWindowEventListener: (type, handler) => {
      calls.push(['add', type])
      listeners.set(type, handler)
    },
    removeWindowEventListener: (type, handler) => {
      calls.push(['remove', type])
      if (listeners.get(type) === handler) listeners.delete(type)
    },
    messageApi: overrides.messageApi,
    revokeObjectURL: (value) => calls.push(['revoke', value]),
    setTimeoutFn: (callback, delay) => {
      calls.push(['timeout', delay])
      callback()
      return `timer-${delay}`
    },
    showUploadProgress,
    uploadInputRef,
    uploadProgress,
    uploadStage
  })

  return {
    calls,
    listeners,
    showUploadProgress,
    upload,
    uploadInputRef,
    uploadProgress,
    uploadStage
  }
}

test('image node upload lifecycle adds and removes unload protection while uploading', async () => {
  const { calls, listeners, upload } = await createHarness()

  upload.isUploading.value = true
  await nextTick()

  assert.deepEqual(calls, [['add', 'beforeunload']])
  assert.equal(listeners.has('beforeunload'), true)

  const event = {
    defaultPrevented: false,
    preventDefault() {
      this.defaultPrevented = true
    }
  }
  listeners.get('beforeunload')(event)
  assert.equal(event.defaultPrevented, true)
  assert.equal(event.returnValue, 'Image upload is still in progress. Leaving now may lose it.')

  upload.isUploading.value = false
  await nextTick()

  assert.deepEqual(calls.at(-1), ['remove', 'beforeunload'])
  assert.equal(listeners.has('beforeunload'), false)
})

test('image node upload lifecycle owns local blob preview replacement and cleanup', async () => {
  const { calls, upload } = await createHarness()

  upload.replaceLocalPreviewUrl('blob:first')
  upload.replaceLocalPreviewUrl('blob:first')
  upload.replaceLocalPreviewUrl('blob:second')
  upload.replaceLocalPreviewUrl('https://cdn.example.com/image.png')

  assert.equal(upload.localPreviewUrl.value, '')
  assert.deepEqual(calls.filter((call) => call[0] === 'revoke'), [
    ['revoke', 'blob:first'],
    ['revoke', 'blob:second']
  ])

  upload.replaceLocalPreviewUrl('blob:third')
  upload.clearLocalPreviewUrl()
  upload.clearLocalPreviewUrl()

  assert.equal(upload.localPreviewUrl.value, '')
  assert.deepEqual(calls.filter((call) => call[0] === 'revoke').at(-1), ['revoke', 'blob:third'])
})

test('image node upload lifecycle triggers the upload input only when idle', async () => {
  const { calls, upload } = await createHarness()

  upload.triggerUpload()
  upload.isUploading.value = true
  upload.triggerUpload()

  assert.deepEqual(calls.filter((call) => call[0] === 'click-upload'), [['click-upload']])
})

test('image node upload lifecycle resets completed upload progress without interrupting active uploads', async () => {
  const { calls, showUploadProgress, upload, uploadProgress, uploadStage } = await createHarness()

  upload.resetUploadProgress(900)

  assert.equal(showUploadProgress.value, false)
  assert.equal(uploadProgress.value, 0)
  assert.equal(uploadStage.value, 'idle')
  assert.deepEqual(calls.find((call) => call[0] === 'timeout'), ['timeout', 900])

  showUploadProgress.value = true
  uploadProgress.value = 55
  uploadStage.value = 'uploading'
  upload.resetUploadProgress(1200)

  assert.equal(showUploadProgress.value, true)
  assert.equal(uploadProgress.value, 55)
  assert.equal(uploadStage.value, 'uploading')
})

test('image node upload lifecycle applies upload save outcomes with progress and message feedback', async () => {
  const messages = []
  const { calls, showUploadProgress, upload, uploadProgress, uploadStage } = await createHarness({
    uploadProgress: 20,
    uploadStage: 'saving',
    messageApi: () => ({
      success: (text) => messages.push(['success', text]),
      warning: (text) => messages.push(['warning', text])
    })
  })

  upload.applyUploadSaveOutcome({
    uploadStage: 'success',
    uploadProgress: 100,
    message: {
      type: 'success',
      text: 'Image uploaded'
    },
    resetDelayMs: 900
  })

  assert.equal(uploadStage.value, 'idle')
  assert.equal(uploadProgress.value, 0)
  assert.equal(showUploadProgress.value, false)
  assert.deepEqual(messages, [['success', 'Image uploaded']])
  assert.deepEqual(calls.find((call) => call[0] === 'timeout'), ['timeout', 900])
})
