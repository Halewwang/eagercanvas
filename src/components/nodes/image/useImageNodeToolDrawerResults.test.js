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
      await overrides.onFlushSave?.()
      return overrides.savedOk ?? true
    },
    getImageNodeSaveFeedbackPatch: (payload) => ({ kind: 'save-feedback', payload }),
    getImageNodeToolErrorPatch: (payload) => ({ kind: 'tool-error', payload }),
    getImageNodeToolLinkedCreatePatch: (payload) => ({ kind: 'tool-linked-create', payload }),
    getImageNodeToolLinkedResultPatch: (payload) => ({ kind: 'tool-linked-result', payload }),
    getImageNodeToolPendingPatch: (payload) => ({ kind: 'tool-pending', payload }),
    getImageNodeToolReplacementPatch: (payload) => ({ kind: 'tool-replacement', payload }),
    getImageNodeToolSaveMessages: (key) => ({ synced: `${key} saved` }),
    isNodeAvailable: overrides.isNodeAvailable,
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
      await overrides.onResolvePersistence?.()
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
      await overrides.onUpdateLinked?.()
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
        generationRatio: '4:3',
        generationResolution: '2k',
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
          generationRatio: '4:3', generationResolution: '2k', url: 'https://tmp.example.com/multi-angle.png',
          fileName: calls.find((call) => call[0] === 'resolve-persistence')?.[2]
        },
        defaults: {
          generationRatio: '4:3',
          generationResolution: '2k',
          },
        includeSource: true,
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
    payload: { generationRatio: '4:3', generationResolution: '2k', prompt: 'Orbit camera' }
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

test('image node drawer results create wedding 3x3 linked output with source metadata', async () => {
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
        generationRatio: '4:3', generationResolution: '2k', base64: 'data:image/png;base64,wedding',
        fileName: calls.find((call) => call[0] === 'resolve-persistence')?.[2]
      },
      defaults: {
        generationRatio: '4:3',
        generationResolution: '2k',
        },
      labelFallback: 'Wedding 3x3 Result',
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
    payload: { generationRatio: '4:3', generationResolution: '2k', prompt: 'Wedding grid' }
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


test('tool drawers retain canonical settings rather than source image actual dimensions', async () => {
  const { calls, toolResults } = await createHarness({ currentData: {
    url: 'saved.png', size: '1774x887', ratio: '2:1',
    generationRatio: '16:9', generationResolution: '4k', } })
  await toolResults.handleMultiAngleApply({ url: 'generated.png' })
  const patch = calls.find(call => call[0] === 'create-linked')[1].payload
  assert.deepEqual(patch.defaults, { generationRatio: '16:9', generationResolution: '4k', })
  assert.equal(patch.payload.generationRatio, '16:9')
  assert.equal(Object.hasOwn(patch.payload, 'size'), false)
  assert.equal(Object.hasOwn(patch.payload, 'ratio'), false)
})

test('both tool drawers save submitted tasks and await the target snapshot before polling', async () => {
  for (const name of ['MultiAngle', 'Wedding3x3']) {
    const overrides = {}
    const { calls, toolResults } = await createHarness(overrides)
    await toolResults[`handle${name}Pending`]({
      model: 'gpt-image-2', sourcePrompt: 'Tool prompt',
      sourceRefImages: ['https://cdn.example.com/ref.png', 'data:image/png;base64,large', 'blob:temporary']
    })
    let releaseSave
    overrides.onFlushSave = () => new Promise(resolve => { releaseSave = resolve })
    let saved = false
    const submitted = toolResults[`handle${name}Submitted`]('tool-task-1').then(() => { saved = true })
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(saved, false)
    assert.deepEqual(calls.find(call => call[0] === 'update-node'), ['update-node', 'new-linked-node', {
      imageTaskId: 'tool-task-1', loading: true, error: '',
      imageTaskMetadata: {
        model: 'gpt-image-2', generationRatio: '4:3', generationResolution: '2k', sourceConfigId: '',
        sourcePrompt: 'Tool prompt', sourceRefImages: ['https://cdn.example.com/ref.png']
      }
    }])
    releaseSave()
    await submitted
    assert.equal(saved, true)
  }
})

test('both tool drawers retain nonterminal task failures and clear terminal failures', async () => {
  for (const name of ['MultiAngle', 'Wedding3x3']) {
    const { calls, toolResults } = await createHarness()
    const pendingId = toolResults[`pending${name}NodeId`]
    await toolResults[`handle${name}Pending`]({ model: 'gpt-image-2' })
    await toolResults[`handle${name}Submitted`]('tool-task-1')
    await toolResults[`handle${name}Error`]({ message: 'Network disconnected' })
    assert.equal(pendingId.value, 'new-linked-node')
    assert.equal(Object.hasOwn(calls.at(-1)[2], 'imageTaskId'), false)
    await toolResults[`handle${name}Error`]({ message: 'Provider failed', imageTaskTerminal: true })
    assert.equal(pendingId.value, '')
    assert.equal(calls.at(-1)[2].imageTaskId, '')
    assert.equal(calls.at(-1)[2].imageTaskMetadata, null)
  }
})

test('tool drawer submissions abort when their target context is gone', async () => {
  for (const name of ['MultiAngle', 'Wedding3x3']) {
    let available = true
    const overrides = { isNodeAvailable: () => available }
    const { calls, toolResults } = await createHarness(overrides)
    await toolResults[`handle${name}Pending`]({ model: 'gpt-image-2' })
    available = false
    const before = calls.length
    await assert.rejects(toolResults[`handle${name}Submitted`]('tool-task-1'), { name: 'AbortError' })
    await toolResults[`handle${name}Error`]({ message: 'Old task failed', imageTaskTerminal: true })
    assert.equal(calls.length, before)
    available = true
    overrides.onFlushSave = () => { available = false }
    await assert.rejects(toolResults[`handle${name}Submitted`]('tool-task-1'), { name: 'AbortError' })
    assert.equal(calls.at(-2)[2].imageTaskId, 'tool-task-1')
    assert.equal(calls.at(-1)[0], 'flush-save')
  }
})

test('tool drawer results stop writes and feedback when context changes after an await', async () => {
  for (const name of ['MultiAngle', 'Wedding3x3']) {
    for (const stage of ['persistence', 'linked-save']) {
      let available = true
      const expireContext = () => { available = false }
      const { calls, messages, toolResults } = await createHarness({
        isNodeAvailable: () => available,
        ...(stage === 'persistence' ? { onResolvePersistence: expireContext } : {}),
        ...(stage === 'linked-save' ? { onUpdateLinked: expireContext } : {})
      })
      await toolResults[`handle${name}Pending`]({ model: 'gpt-image-2' })
      const initialCreateCount = calls.filter(call => call[0] === 'create-linked').length
      await toolResults[`handle${name}Apply`]({ url: 'https://cdn.example.com/result.png' })
      assert.equal(calls.filter(call => call[0] === 'create-linked').length, initialCreateCount)
      assert.equal(calls.filter(call => call[0] === 'update-linked').length, stage === 'linked-save' ? 1 : 0)
      assert.equal(calls.some(call => call[0] === 'save-message'), false)
      assert.deepEqual(messages, [])
    }
  }
})

test('multi-angle replace retains its original target and stops feedback after stale save', async () => {
  let available = true
  const { calls, toolResults } = await createHarness({
    isNodeAvailable: (id) => available && id === 'image-node-1',
    onFlushSave: () => { available = false }
  })
  await toolResults.handleMultiAngleApply({ targetMode: 'replace', url: 'https://cdn.example.com/result.png' })
  assert.equal(calls.filter(call => call[0] === 'update-node').length, 1)
  assert.equal(calls.find(call => call[0] === 'update-node')[1], 'image-node-1')
  assert.equal(calls.some(call => call[0] === 'save-message'), false)
})
