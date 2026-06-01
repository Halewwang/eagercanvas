import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const toolActionsUrl = new URL('./useImageNodeToolActions.js', import.meta.url)
const toolActionsPath = fileURLToPath(toolActionsUrl)

const loadToolActions = async () => {
  assert.ok(existsSync(toolActionsPath), 'useImageNodeToolActions.js should exist')
  const toolActionsSource = readFileSync(toolActionsUrl, 'utf8')
  return import(`data:text/javascript;base64,${Buffer.from(toolActionsSource).toString('base64')}`)
}

const createHarness = async (overrides = {}) => {
  const { useImageNodeToolActions } = await loadToolActions()
  const calls = []
  const messages = []
  const activeTool = { value: '' }
  const toolActionLoading = { value: '' }
  const showMultiAngleDrawer = { value: false }
  const showWedding3x3Drawer = { value: false }
  const defaultRequest = {
    model: 'gpt-image-2',
    size: '1024x1024',
    quality: 'high',
    ratio: '1:1',
    resolution: '2k',
    sourceConfigId: 'config-node-1',
    sourcePrompt: 'Enhance source',
    sourceRefImages: ['https://cdn.example.com/ref.png']
  }
  const tools = useImageNodeToolActions({
    activeTool,
    cancelCropMode: () => calls.push(['cancel-crop']),
    createImageNodeCropPayload: async (payload) => {
      calls.push(['create-crop-payload', payload])
      if (overrides.cropError) throw overrides.cropError
      return overrides.cropPayload || { url: 'data:image/png;base64,crop', fileName: 'crop.png' }
    },
    createLinkedImageNode: (payload) => {
      calls.push(['create-linked', payload])
      return Object.hasOwn(overrides, 'createdNodeId') ? overrides.createdNodeId : 'linked-image-1'
    },
    currentData: () => overrides.currentData || {
      size: '512x512',
      ratio: '1:1',
      resolution: '1k'
    },
    currentProjectId: { value: 'project-1' },
    defaultEnhancePrompt: 'Enhance to 4K',
    defaultImageModel: 'gpt-image-2',
    defaultImageSize: '1024x1024',
    displayImageUrl: { value: overrides.displayImageUrl ?? 'https://cdn.example.com/source.png' },
    edges: { value: [{ id: 'edge-1' }] },
    findNearestSizeKey: (...args) => {
      calls.push(['find-nearest-size', ...args])
      return '1024x1024'
    },
    flushSave: async () => {
      calls.push(['flush-save'])
      return overrides.savedOk ?? true
    },
    getErrorMessage: (error, fallback) => `${fallback}: ${error.message}`,
    getImageNodeEnhancementErrorPatch: (payload) => ({ kind: 'enhance-error', payload }),
    getImageNodeEnhancementRequest: (payload) => {
      calls.push(['build-enhancement-request', payload])
      return Object.hasOwn(overrides, 'enhancementRequest')
        ? overrides.enhancementRequest
        : defaultRequest
    },
    getImageNodeEnhancementResultPatch: (payload) => ({ kind: 'enhance-result', payload }),
    getImageNodeRatioFromSizeKey: (size) => `ratio:${size}`,
    getImageNodeRemoveBackgroundResultPatch: (payload) => ({ kind: 'remove-bg-result', payload }),
    getImageNodeToolSaveMessages: (key) => ({ synced: `${key} saved` }),
    imageGen: {
      generate: async (request) => {
        calls.push(['generate', request])
        if (overrides.generateError) throw overrides.generateError
        return overrides.generateResult ?? [{ url: 'https://tmp.example.com/enhanced.png' }]
      }
    },
    imageTools: {
      removeBg: async (request) => {
        calls.push(['remove-bg', request])
        if (overrides.removeBgError) throw overrides.removeBgError
        return overrides.removeBgResult ?? { url: 'https://tmp.example.com/remove-bg.png' }
      }
    },
    localImageModel: { value: 'gpt-image-2' },
    localImageQuality: { value: 'high' },
    localImageRatio: { value: '4:3' },
    localImageSize: { value: '2048x1536' },
    localResolution: { value: '2k' },
    messageApi: () => ({
      error: (text) => messages.push(['error', text]),
      success: (text) => messages.push(['success', text]),
      warning: (text) => messages.push(['warning', text])
    }),
    nodeId: () => 'image-node-1',
    nodes: { value: [{ id: 'image-node-1' }] },
    projectSaveState: { value: overrides.saveState || { remoteSynced: true } },
    replaceCurrentImageNode: async (payload) => {
      calls.push(['replace-current-image', payload])
    },
    resolveImagePersistence: async (...args) => {
      calls.push(['resolve-persistence', ...args])
      return overrides.persistence ?? {
        displayUrl: 'https://cdn.example.com/result.png',
        persistedUrl: 'https://cdn.example.com/result.png',
        persisted: true,
        persistError: ''
      }
    },
    resolveImageSaveFeedback: (savedOk) => ({ mode: savedOk ? 'synced' : 'local-only' }),
    resolveNodeInputs: (sourceNodeId) => {
      calls.push(['resolve-inputs', sourceNodeId])
      return overrides.sourceInputs || { prompt: 'Source prompt', refImages: ['ref-a'] }
    },
    getNearestImageNodeSourceConfig: (payload) => {
      calls.push(['nearest-source', payload])
      return overrides.sourceConfig || { id: 'config-node-1', data: { model: 'gpt-image-2' } }
    },
    showImageToolSaveMessage: (payload) => calls.push(['save-message', payload]),
    showMultiAngleDrawer,
    showWedding3x3Drawer,
    startCropMode: async () => calls.push(['start-crop']),
    toolActionLoading,
    triggerUpload: () => calls.push(['trigger-upload']),
    updateLinkedImageNode: async (...args) => {
      calls.push(['update-linked', ...args])
      return overrides.linkedSavedOk ?? true
    }
  })

  return {
    activeTool,
    calls,
    messages,
    showMultiAngleDrawer,
    showWedding3x3Drawer,
    toolActionLoading,
    tools
  }
}

test('image node tool actions dispatch menu selections to upload, crop, and drawers', async () => {
  const { calls, showMultiAngleDrawer, showWedding3x3Drawer, tools } = await createHarness()

  await tools.handleToolAction('replace-image')
  await tools.handleToolAction('crop')
  await tools.handleToolAction('multi-angle')
  await tools.handleToolAction('wedding-3x3')

  assert.deepEqual(calls, [
    ['trigger-upload'],
    ['start-crop']
  ])
  assert.equal(showMultiAngleDrawer.value, true)
  assert.equal(showWedding3x3Drawer.value, true)
})

test('image node tool actions enhance to 4k through a linked image node', async () => {
  const { calls, messages, toolActionLoading, tools } = await createHarness()

  await tools.handleEnhanceTo4k()

  assert.equal(toolActionLoading.value, '')
  assert.deepEqual(messages, [])
  assert.deepEqual(calls.find((call) => call[0] === 'nearest-source')?.[1], {
    nodes: [{ id: 'image-node-1' }],
    edges: [{ id: 'edge-1' }],
    startNodeId: 'image-node-1'
  })
  assert.equal(calls.some((call) => call[0] === 'resolve-inputs' && call[1] === 'config-node-1'), true)
  assert.deepEqual(calls.find((call) => call[0] === 'create-linked')?.[1], {
    loading: true,
    label: '4K Enhanced Image',
    model: 'gpt-image-2',
    size: '1024x1024',
    quality: 'high',
    ratio: '1:1',
    resolution: '2k',
    sourceConfigId: 'config-node-1',
    sourcePrompt: 'Enhance source',
    sourceRefImages: ['https://cdn.example.com/ref.png']
  })
  assert.deepEqual(calls.find((call) => call[0] === 'generate')?.[1].sourcePrompt, 'Enhance source')
  assert.match(calls.find((call) => call[0] === 'resolve-persistence')?.[2], /^enhanced-4k-\d+\.png$/)
  assert.deepEqual(calls.find((call) => call[0] === 'update-linked')?.slice(0, 3), [
    'update-linked',
    'linked-image-1',
    {
      kind: 'enhance-result',
      payload: {
        persistence: {
          displayUrl: 'https://cdn.example.com/result.png',
          persistedUrl: 'https://cdn.example.com/result.png',
          persisted: true,
          persistError: ''
        },
        request: calls.find((call) => call[0] === 'generate')?.[1]
      }
    }
  ])
  assert.equal(calls.some((call) => call[0] === 'save-message'), true)
})

test('image node tool actions warn when 4k enhancement has no reusable source', async () => {
  const { calls, messages, tools } = await createHarness({
    enhancementRequest: null
  })

  await tools.handleEnhanceTo4k()

  assert.equal(calls.some((call) => call[0] === 'create-linked'), false)
  assert.deepEqual(messages, [['warning', 'No reusable prompt or reference chain found for 4K enhancement']])
})

test('image node tool actions remove background into a linked image node and report save feedback', async () => {
  const { calls, toolActionLoading, tools } = await createHarness()

  await tools.handleRemoveBackground()

  assert.equal(toolActionLoading.value, '')
  assert.deepEqual(calls.find((call) => call[0] === 'remove-bg')?.[1], {
    image: 'https://cdn.example.com/source.png',
    size: 'full',
    format: 'png',
    channels: 'rgba',
    crop: false,
    despill: false
  })
  assert.match(calls.find((call) => call[0] === 'resolve-persistence')?.[2], /^remove-bg-\d+\.png$/)
  assert.deepEqual(calls.find((call) => call[0] === 'create-linked')?.[1], {
    kind: 'remove-bg-result',
    payload: {
      persistence: {
        displayUrl: 'https://cdn.example.com/result.png',
        persistedUrl: 'https://cdn.example.com/result.png',
        persisted: true,
        persistError: ''
      },
      defaults: {
        size: '512x512',
        ratio: '1:1',
        resolution: '1k'
      }
    }
  })
  assert.deepEqual(calls.filter((call) => call[0] === 'flush-save'), [['flush-save']])
  assert.equal(calls.some((call) => call[0] === 'save-message'), true)
})

test('image node tool actions apply crop through replacement and leave crop mode', async () => {
  const { calls, messages, toolActionLoading, tools } = await createHarness()

  await tools.applyCrop()

  assert.equal(toolActionLoading.value, '')
  assert.deepEqual(calls.find((call) => call[0] === 'create-crop-payload')?.[1], {
    source: 'https://cdn.example.com/source.png',
    cropRect: undefined,
    cropStageMetrics: undefined
  })
  assert.deepEqual(calls.find((call) => call[0] === 'replace-current-image')?.[1], {
    url: 'data:image/png;base64,crop',
    fileName: 'crop.png'
  })
  assert.equal(calls.some((call) => call[0] === 'cancel-crop'), true)
  assert.deepEqual(messages, [['success', 'Crop applied']])
})
