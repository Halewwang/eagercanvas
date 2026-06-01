import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const replacementUrl = new URL('./useImageNodeReplacement.js', import.meta.url)
const replacementPath = fileURLToPath(replacementUrl)

const loadReplacement = async () => {
  assert.ok(existsSync(replacementPath), 'useImageNodeReplacement.js should exist')
  const replacementSource = readFileSync(replacementUrl, 'utf8')
  return import(`data:text/javascript;base64,${Buffer.from(replacementSource).toString('base64')}`)
}

const createHarness = async (overrides = {}) => {
  const { useImageNodeReplacement } = await loadReplacement()
  const calls = []
  const messages = []
  const localImageSize = { value: overrides.size || '1024x1024' }
  const localImageRatio = { value: overrides.ratio || '1:1' }
  const localResolution = { value: overrides.resolution || '1k' }
  const file = Object.hasOwn(overrides, 'file') ? overrides.file : { name: 'crop.png', type: 'image/png' }

  const replacement = useImageNodeReplacement({
    currentData: () => overrides.currentData || { url: 'https://cdn.example.com/previous.png' },
    currentProjectId: { value: 'project-1' },
    dataUrlToFile: (source, fileName) => {
      calls.push(['data-url-to-file', source, fileName])
      return file
    },
    flushSave: async () => {
      calls.push(['flush-save'])
      return overrides.savedOk ?? true
    },
    getImageNodeReplacementErrorPatch: (payload) => ({ kind: 'replacement-error', payload }),
    getImageNodeReplacementPreviewPatch: (payload) => ({ kind: 'replacement-preview', payload }),
    getImageNodeReplacementSaveMessage: (payload) => ({
      type: payload.saveFeedback?.mode === 'synced' ? 'success' : 'warning',
      text: payload.saveFeedback?.mode === 'synced' ? 'Replacement saved' : 'Replacement fallback'
    }),
    getImageNodeReplacementUploadedPatch: (payload) => ({ kind: 'replacement-uploaded', payload }),
    getImageNodeSaveFeedbackPatch: (payload) => ({ kind: 'save-feedback', payload }),
    isLocalPreviewMode: { value: !!overrides.localPreview },
    localImageRatio,
    localImageSize,
    localResolution,
    logger: {
      warn: (...args) => calls.push(['warn', ...args])
    },
    messageApi: () => ({
      success: (text) => messages.push(['success', text]),
      warning: (text) => messages.push(['warning', text])
    }),
    nodeId: () => 'image-node-1',
    projectSaveState: { value: overrides.saveState || { remoteSynced: true } },
    resolveImageSaveFeedback: (savedOk) => ({ mode: savedOk ? 'synced' : 'local-only' }),
    setTimeoutFn: (callback, delay) => {
      calls.push(['timeout', delay])
      callback()
    },
    updateNode: (...args) => calls.push(['update-node', ...args]),
    updateNodeInternals: (...args) => calls.push(['update-node-internals', ...args]),
    uploadImageFile: async (...args) => {
      calls.push(['upload-image-file', ...args])
      if (overrides.uploadError) throw overrides.uploadError
      return overrides.uploadedUrl ?? 'https://cdn.example.com/replacement.png'
    }
  })

  return {
    calls,
    localImageRatio,
    localImageSize,
    localResolution,
    messages,
    replacement
  }
}

test('image node replacement previews, uploads, saves feedback, and updates local sizing', async () => {
  const { calls, localImageRatio, localImageSize, localResolution, messages, replacement } = await createHarness()

  await replacement.replaceCurrentImageNode({
    base64: 'data:image/png;base64,abc',
    fileName: 'crop.png',
    fileType: 'image/png',
    ratio: '16:9',
    resolution: '2k',
    size: '1792x1024'
  })

  assert.equal(localImageSize.value, '1792x1024')
  assert.equal(localImageRatio.value, '16:9')
  assert.equal(localResolution.value, '2k')
  assert.deepEqual(calls[0], ['update-node', 'image-node-1', {
    kind: 'replacement-preview',
    payload: {
      previousPersistedUrl: 'https://cdn.example.com/previous.png',
      previewSource: 'data:image/png;base64,abc',
      size: '1792x1024',
      ratio: '16:9',
      resolution: '2k',
      fileType: 'image/png',
      isLocalPreviewMode: false
    }
  }])
  assert.deepEqual(calls[1], ['timeout', 30])
  assert.deepEqual(calls[2], ['update-node-internals', 'image-node-1'])
  assert.deepEqual(calls[3], ['data-url-to-file', 'data:image/png;base64,abc', 'crop.png'])
  assert.equal(calls[4][0], 'upload-image-file')
  assert.deepEqual(calls[4][2], {
    projectId: 'project-1',
    source: 'image_replace',
    sourceNodeId: 'image-node-1'
  })
  assert.deepEqual(calls.filter((call) => call[0] === 'flush-save'), [['flush-save']])
  assert.deepEqual(messages, [['success', 'Replacement saved']])
})

test('image node replacement in local preview mode flushes without uploading', async () => {
  const { calls, messages, replacement } = await createHarness({ localPreview: true })

  await replacement.replaceCurrentImageNode({
    base64: 'data:image/png;base64,abc',
    fileName: 'local.png'
  })

  assert.equal(calls.some((call) => call[0] === 'upload-image-file'), false)
  assert.deepEqual(calls.filter((call) => call[0] === 'flush-save'), [['flush-save']])
  assert.deepEqual(messages, [])
})

test('image node replacement marks an error when preview output cannot be converted to a file', async () => {
  const { calls, messages, replacement } = await createHarness({ file: null })

  await replacement.replaceCurrentImageNode({
    url: 'https://tmp.example.com/crop.png',
    fileName: 'missing.png'
  })

  assert.deepEqual(calls.find((call) => call[0] === 'update-node' && call[2]?.kind === 'replacement-error'), [
    'update-node',
    'image-node-1',
    { kind: 'replacement-error', payload: undefined }
  ])
  assert.equal(calls.some((call) => call[0] === 'upload-image-file'), false)
  assert.deepEqual(messages, [['warning', 'Replacement fallback']])
})

test('image node replacement restores preview state when upload persistence fails', async () => {
  const { calls, messages, replacement } = await createHarness({
    uploadError: new Error('upload failed')
  })

  await replacement.replaceCurrentImageNode({
    base64: 'data:image/png;base64,abc',
    fileName: 'crop.png'
  })

  assert.deepEqual(calls.find((call) => call[0] === 'warn')?.slice(0, 2), [
    'warn',
    'Crop persistence failed:'
  ])
  assert.deepEqual(calls.find((call) => call[0] === 'update-node' && call[2]?.kind === 'replacement-error'), [
    'update-node',
    'image-node-1',
    {
      kind: 'replacement-error',
      payload: {
        previousPersistedUrl: 'https://cdn.example.com/previous.png',
        previewSource: 'data:image/png;base64,abc',
        restorePreviewState: true
      }
    }
  ])
  assert.deepEqual(messages, [['warning', 'Replacement fallback']])
})
