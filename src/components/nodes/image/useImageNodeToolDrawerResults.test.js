import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const drawerResultsUrl = new URL('./useImageNodeToolDrawerResults.js', import.meta.url)
const drawerResultsPath = fileURLToPath(drawerResultsUrl)
const vueUrl = import.meta.resolve('vue')

const loadDrawerResults = async () => {
  assert.ok(existsSync(drawerResultsPath), 'useImageNodeToolDrawerResults.js should exist')
  const drawerResultsSource = readFileSync(drawerResultsUrl, 'utf8')
    .replace("from 'vue'", `from '${vueUrl}'`)
  return import(`data:text/javascript;base64,${Buffer.from(drawerResultsSource).toString('base64')}`)
}

const createHarness = async (overrides = {}) => {
  const { useImageNodeToolDrawerResults } = await loadDrawerResults()
  const calls = []
  const messages = []
  const toolResults = useImageNodeToolDrawerResults({
    createLinkedImageNode: (payload) => {
      calls.push(['create-linked', payload])
      return overrides.createdNodeId || 'new-linked-node'
    },
    currentData: () => overrides.currentData || { url: 'https://cdn.example.com/original.png' },
    flushSave: async () => {
      calls.push(['flush-save'])
      return overrides.savedOk ?? true
    },
    getImageNodeSaveFeedbackPatch: (payload) => ({ kind: 'save-feedback', payload }),
    getImageNodeToolErrorPatch: (payload) => ({ kind: 'tool-error', payload }),
    getImageNodeToolLinkedCreatePatch: (payload) => ({ kind: 'tool-linked-create', payload }),
    getImageNodeToolLinkedResultPatch: (payload) => ({ kind: 'tool-linked-result', payload }),
    getImageNodeToolPendingPatch: (payload) => ({ kind: 'tool-pending', payload }),
    getImageNodeToolReplacementPatch: (payload) => ({ kind: 'tool-replacement', payload }),
    getImageNodeToolSaveMessages: (key) => ({ synced: `${key} saved` }),
    localImageQuality: { value: 'high' },
    localImageRatio: { value: '4:3' },
    localImageSize: { value: '2048x1536' },
    localResolution: { value: '2k' },
    messageApi: () => ({
      error: (text) => messages.push(['error', text])
    }),
    nodeId: () => 'image-node-1',
    projectSaveState: { value: overrides.saveState || { remoteSynced: true } },
    resolveImagePersistence: async (...args) => {
      calls.push(['resolve-persistence', ...args])
      if (overrides.persistenceError) throw overrides.persistenceError
      return overrides.persistence ?? {
        displayUrl: 'https://cdn.example.com/tool-result.png',
        persistedUrl: 'https://cdn.example.com/tool-result.png',
        persisted: true,
        persistError: ''
      }
    },
    resolveImageSaveFeedback: (savedOk) => ({ mode: savedOk ? 'synced' : 'local-only' }),
    showImageToolSaveMessage: (payload) => calls.push(['save-message', payload]),
    updateLinkedImageNode: async (...args) => {
      calls.push(['update-linked', ...args])
      return overrides.linkedSavedOk ?? true
    },
    updateNode: (...args) => calls.push(['update-node', ...args])
  })

  return {
    calls,
    messages,
    toolResults
  }
}

test('image node drawer results replace current node for multi-angle results', async () => {
  const { calls, messages, toolResults } = await createHarness()
  toolResults.showMultiAngleDrawer.value = true

  await toolResults.handleMultiAngleApply({
    targetMode: 'replace',
    base64: 'data:image/png;base64,result',
    size: '1024x1024',
    ratio: '1:1',
    resolution: '1k',
    fileType: 'image/webp'
  })

  assert.deepEqual(messages, [])
  assert.match(calls.find((call) => call[0] === 'resolve-persistence')?.[2], /^multi-angle-\d+\.png$/)
  assert.deepEqual(calls.find((call) => call[0] === 'update-node' && call[2]?.kind === 'tool-replacement'), [
    'update-node',
    'image-node-1',
    {
      kind: 'tool-replacement',
      payload: {
        persistence: {
          displayUrl: 'https://cdn.example.com/tool-result.png',
          persistedUrl: 'https://cdn.example.com/tool-result.png',
          persisted: true,
          persistError: ''
        },
        previousPersistedUrl: 'https://cdn.example.com/original.png',
        size: '1024x1024',
        ratio: '1:1',
        resolution: '1k',
        fileType: 'image/webp',
        transientPersistError: 'Multi-angle result is only shown temporarily. Please retry.'
      }
    }
  ])
  assert.deepEqual(calls.filter((call) => call[0] === 'flush-save'), [['flush-save']])
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
  assert.deepEqual(calls.find((call) => call[0] === 'save-message')?.[1].messages, {
    synced: 'multi-angle-replace saved'
  })
  assert.equal(toolResults.pendingMultiAngleNodeId.value, '')
  assert.equal(toolResults.showMultiAngleDrawer.value, false)
})

test('image node drawer results complete an existing multi-angle pending node', async () => {
  const { calls, toolResults } = await createHarness({ linkedSavedOk: false })
  toolResults.pendingMultiAngleNodeId.value = 'pending-multi-angle'
  toolResults.showMultiAngleDrawer.value = true

  await toolResults.handleMultiAngleApply({
    url: 'https://tmp.example.com/multi-angle.png'
  })

  assert.deepEqual(calls.find((call) => call[0] === 'update-linked')?.slice(0, 3), [
    'update-linked',
    'pending-multi-angle',
    {
      kind: 'tool-linked-result',
      payload: {
        persistence: {
          displayUrl: 'https://cdn.example.com/tool-result.png',
          persistedUrl: 'https://cdn.example.com/tool-result.png',
          persisted: true,
          persistError: ''
        },
        payload: {
          url: 'https://tmp.example.com/multi-angle.png',
          fileName: calls.find((call) => call[0] === 'resolve-persistence')?.[2]
        },
        defaults: {
          size: '2048x1536',
          ratio: '4:3',
          resolution: '2k'
        },
        transientPersistError: 'Multi-angle result is only shown temporarily. Please retry.'
      }
    }
  ])
  assert.equal(calls.some((call) => call[0] === 'flush-save'), false)
  assert.deepEqual(calls.find((call) => call[0] === 'save-message')?.[1].saveFeedback, {
    mode: 'local-only'
  })
  assert.equal(toolResults.pendingMultiAngleNodeId.value, '')
  assert.equal(toolResults.showMultiAngleDrawer.value, false)
})

test('image node drawer results own multi-angle pending and error linked node updates', async () => {
  const { calls, toolResults } = await createHarness()

  await toolResults.handleMultiAnglePending({ targetMode: 'replace' })
  assert.deepEqual(calls, [])

  await toolResults.handleMultiAnglePending({ prompt: 'Orbit camera' })
  assert.deepEqual(calls[0], ['create-linked', {
    kind: 'tool-pending',
    payload: { prompt: 'Orbit camera' }
  }])
  assert.equal(toolResults.pendingMultiAngleNodeId.value, 'new-linked-node')
  assert.deepEqual(calls[1], ['flush-save'])

  await toolResults.handleMultiAnglePending({ prompt: 'Skip duplicate pending' })
  assert.equal(calls.filter((call) => call[0] === 'create-linked').length, 1)

  await toolResults.handleMultiAngleError({ reason: 'provider failed' })
  assert.deepEqual(calls.at(-1), [
    'update-linked',
    'new-linked-node',
    {
      kind: 'tool-error',
      payload: {
        payload: { reason: 'provider failed' },
        fallbackMessage: 'Multi-angle generation failed'
      }
    }
  ])
  assert.equal(toolResults.pendingMultiAngleNodeId.value, '')
})

test('image node drawer results create wedding 3x3 linked output with quality and source metadata', async () => {
  const { calls, messages, toolResults } = await createHarness()
  toolResults.showWedding3x3Drawer.value = true

  await toolResults.handleWedding3x3Apply({
    base64: 'data:image/png;base64,wedding'
  })

  assert.deepEqual(messages, [])
  assert.match(calls.find((call) => call[0] === 'resolve-persistence')?.[2], /^wedding-3x3-\d+\.png$/)
  assert.deepEqual(calls.find((call) => call[0] === 'create-linked')?.[1], {
    kind: 'tool-linked-create',
    payload: {
      persistence: {
        displayUrl: 'https://cdn.example.com/tool-result.png',
        persistedUrl: 'https://cdn.example.com/tool-result.png',
        persisted: true,
        persistError: ''
      },
      payload: {
        base64: 'data:image/png;base64,wedding',
        fileName: calls.find((call) => call[0] === 'resolve-persistence')?.[2]
      },
      defaults: {
        size: '2048x1536',
        ratio: '4:3',
        resolution: '2k',
        quality: 'high'
      },
      labelFallback: 'Wedding 3x3 Result',
      includeQuality: true,
      includeSource: true
    }
  })
  assert.deepEqual(calls.filter((call) => call[0] === 'flush-save'), [['flush-save']])
  assert.deepEqual(calls.find((call) => call[0] === 'save-message')?.[1].messages, {
    synced: 'wedding-3x3 saved'
  })
  assert.equal(toolResults.pendingWedding3x3NodeId.value, '')
  assert.equal(toolResults.showWedding3x3Drawer.value, false)
})

test('image node drawer results own wedding 3x3 pending and error linked node updates', async () => {
  const { calls, toolResults } = await createHarness()

  await toolResults.handleWedding3x3Pending({ prompt: 'Wedding grid' })

  assert.deepEqual(calls[0], ['create-linked', {
    kind: 'tool-pending',
    payload: { prompt: 'Wedding grid' }
  }])
  assert.deepEqual(calls[1], ['flush-save'])
  assert.equal(toolResults.pendingWedding3x3NodeId.value, 'new-linked-node')

  await toolResults.handleWedding3x3Error({ reason: 'provider failed' })
  assert.deepEqual(calls.at(-1), [
    'update-linked',
    'new-linked-node',
    {
      kind: 'tool-error',
      payload: {
        payload: { reason: 'provider failed' },
        fallbackMessage: 'Wedding 3x3 generation failed'
      }
    }
  ])
  assert.equal(toolResults.pendingWedding3x3NodeId.value, '')
})
