import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const generationUrl = new URL('./useImageNodeGeneration.js', import.meta.url)
const generationPath = fileURLToPath(generationUrl)

const loadGeneration = async () => {
  assert.ok(existsSync(generationPath), 'useImageNodeGeneration.js should exist')
  const generationSource = readFileSync(generationUrl, 'utf8')
  return import(`data:text/javascript;base64,${Buffer.from(generationSource).toString('base64')}`)
}

const flushBackgroundTasks = async () => {
  await Promise.resolve()
  await new Promise((resolve) => setTimeout(resolve, 0))
}

const createHarness = async (overrides = {}) => {
  const { useImageNodeGeneration } = await loadGeneration()
  const calls = []
  const data = { ...(overrides.data || {}) }
  const messages = []
  const imageActionLoading = { value: '' }
  const displayImageUrl = { value: overrides.selfImage || '' }
  const generation = useImageNodeGeneration({
    buildImagePersistencePatch: (persistence, extra) => ({ kind: 'persistence-patch', persistence, extra }),
    buildSourceRefImages: (...groups) => {
      calls.push(['build-source-refs', ...groups])
      return groups.flat()
    },
    currentData: () => data,
    isNodeAvailable: overrides.isNodeAvailable || (() => true),
    currentProjectId: { value: 'project-1' },
    displayImageUrl,
    getConnectedInputs: () => overrides.inputs || {
      prompt: 'A product photo',
      refImages: ['https://cdn.example.com/ref.png']
    },
    getErrorMessage: (error, fallback) => `${fallback}: ${error.message}`,
    getImageNodeActionErrorPatch: (payload) => ({ kind: 'action-error', payload }),
    getImageNodeActionPendingPatch: () => ({ kind: 'action-pending' }),
    getImageNodeGenerationSaveMessage: (payload) => ({
      type: payload.saveFeedback?.mode === 'synced' ? 'success' : 'warning',
      text: payload.mode === 'regenerate' ? 'Image regenerated' : 'Image generated'
    }),
    getImageNodeSaveFeedbackPatch: (payload) => ({ kind: 'save-feedback', payload }),
    imageActionLoading,
    imageGen: {
      generate: async (request, options) => {
        calls.push(['generate', request])
        if (overrides.onGenerate) return overrides.onGenerate(request, options)
        if (overrides.submitTaskId) await options.onSubmitted(overrides.submitTaskId)
        if (overrides.generateError) throw overrides.generateError
        return overrides.generateResult ?? [{ url: 'https://tmp.example.com/generated.png' }]
      },
      resume: async (id, options) => {
        calls.push(['resume', id, options])
        if (overrides.resumeError) throw overrides.resumeError
        return overrides.generateResult ?? [{ url: 'https://tmp.example.com/generated.png' }]
      }
    },
    isConfigured: { value: overrides.isConfigured ?? true },
    localBackground: { value: 'transparent' },
    localImageModel: { value: 'gpt-image-2' },
    localImageQuality: { value: 'high' },
    localImageRatio: { value: '16:9' },
    localImageSize: { value: '1792x1024' },
    localOutputFormat: { value: overrides.outputFormat || 'png' },
    localResolution: { value: '2k' },
    messageApi: () => ({
      error: (text) => messages.push(['error', text]),
      info: (text) => messages.push(['info', text]),
      success: (text) => messages.push(['success', text]),
      warning: (text) => messages.push(['warning', text])
    }),
    nodeId: () => 'image-node-1',
    projectSaveState: { value: overrides.saveState || { remoteSynced: true } },
    resetProgress: () => calls.push(['reset-progress']),
    resolveImagePersistence: overrides.resolveImagePersistence || (async (...args) => {
      calls.push(['resolve-persistence', ...args])
      return overrides.persistence ?? {
        persistedUrl: 'https://cdn.example.com/generated.png',
        displayUrl: 'https://cdn.example.com/generated.png',
        persisted: true,
        persistError: ''
      }
    }),
    resolveImageSaveFeedback: (savedOk) => ({ mode: savedOk ? 'synced' : 'local-only' }),
    saveProject: async () => {
      calls.push(['save-project'])
      return overrides.savedOk ?? true
    },
    updateNode: (...args) => {
      const patch = args[1]
      Object.assign(data, patch?.extra || patch)
      if (patch?.kind === 'persistence-patch') {
        displayImageUrl.value = patch.persistence?.persisted
          ? patch.persistence?.persistedUrl || ''
          : patch.persistence?.displayUrl || ''
      }
      calls.push(['update-node', ...args])
    }
  })

  return {
    calls,
    data,
    displayImageUrl,
    generation,
    imageActionLoading,
    messages
  }
}

test('image node generation warns when the user is not configured', async () => {
  const { calls, generation, messages } = await createHarness({ isConfigured: false })

  await generation.runImageGeneration('create')

  assert.deepEqual(messages, [['warning', 'Please sign in first']])
  assert.equal(calls.length, 0)
})

test('image node generation warns without prompt or reference input', async () => {
  const { calls, generation, messages } = await createHarness({
    inputs: { prompt: '', refImages: [] }
  })

  await generation.runImageGeneration('create')

  assert.deepEqual(messages, [['warning', 'Connect a text node or provide a reference image']])
  assert.equal(calls.length, 0)
})

test('image node generation creates a persisted image with merged references and save feedback', async () => {
  const { calls, generation, imageActionLoading, messages } = await createHarness({
    outputFormat: 'jpeg',
    selfImage: 'https://cdn.example.com/current.png'
  })

  await generation.runImageGeneration('regenerate')
  await flushBackgroundTasks()

  assert.equal(imageActionLoading.value, '')
  assert.deepEqual(calls[0], ['update-node', 'image-node-1', { kind: 'action-pending' }, { persist: false }])
  const generateCall = calls.find(call => call[0] === 'generate')
  assert.deepEqual(generateCall[0], 'generate')
  assert.equal(Object.hasOwn(generateCall[1], 'size'), false)
  assert.equal(generateCall[1].ratio, '16:9')
  assert.equal(generateCall[1].resolution, '2k')
  assert.equal(generateCall[1].quality, undefined)
  for (const key of ['aspect_ratio', 'output_format', 'output_compression', 'moderation']) {
    assert.equal(Object.hasOwn(generateCall[1], key), false, key)
  }
  assert.deepEqual(generateCall[1].image, [
    'https://cdn.example.com/current.png',
    'https://cdn.example.com/ref.png'
  ])
  assert.equal(generateCall[1].sourceNodeId, 'image-node-1')
  const metadata = calls.find(call => call[0] === 'update-node' && call[2].kind === 'persistence-patch')[2].extra
  assert.equal(metadata.generationRatio, '16:9')
  assert.equal(metadata.generationResolution, '2k')
  assert.equal(metadata.generationQuality, undefined)
  const previousMedia = { size: '1536x1024', ratio: '3:2' }
  for (const call of calls.filter(call => call[0] === 'update-node' && call[2].kind === 'persistence-patch')) {
    const nextMedia = { ...previousMedia, ...call[2].extra }
    assert.equal(nextMedia.size, '', 'new output must not retain the previous image dimensions')
    assert.equal(nextMedia.ratio, '', 'new output must not retain the previous image ratio')
  }
  assert.deepEqual(calls.find((call) => call[0] === 'resolve-persistence')?.slice(0, 3), [
    'resolve-persistence',
    'https://tmp.example.com/generated.png',
    calls.find((call) => call[0] === 'resolve-persistence')?.[2]
  ])
  assert.match(calls.find((call) => call[0] === 'resolve-persistence')?.[2], /^generated-\d+\.png$/)
  assert.deepEqual(calls.filter((call) => call[0] === 'save-project'), [['save-project']])
  assert.deepEqual(messages, [['success', 'Image regenerated']])
})

test('image node generation displays provider output before persistence completes', async () => {
  const inlineDataUrl = 'data:image/png;base64,generated'
  let resolvePersistence
  const persistenceDone = new Promise((resolve) => {
    resolvePersistence = resolve
  })
  const { calls, generation } = await createHarness({
    generateResult: [{ url: inlineDataUrl, transient: true }],
    resolveImagePersistence: async (...args) => {
      calls.push(['resolve-persistence', ...args])
      await persistenceDone
      return {
        persistedUrl: 'https://cdn.example.com/generated.png',
        displayUrl: 'https://cdn.example.com/generated.png',
        persisted: true,
        persistError: ''
      }
    }
  })

  const runPromise = generation.runImageGeneration('create')
  await new Promise((resolve) => setTimeout(resolve, 0))

  const previewCall = calls.find((call) => call[0] === 'update-node' && call[2]?.kind === 'persistence-patch')
  assert.equal(previewCall?.[2]?.persistence?.displayUrl, inlineDataUrl)
  assert.equal(previewCall?.[2]?.persistence?.persisted, false)
  assert.deepEqual(previewCall?.[3], { persist: false })
  assert.equal(calls.some((call) => call[0] === 'resolve-persistence'), true)
  assert.equal(calls.some((call) => call[0] === 'save-project'), false)

  resolvePersistence()
  await runPromise
  await flushBackgroundTasks()

  assert.deepEqual(calls.filter((call) => call[0] === 'save-project'), [['save-project']])
  const persistedCalls = calls.filter((call) => call[0] === 'update-node' && call[2]?.kind === 'persistence-patch')
  assert.equal(persistedCalls.at(-1)?.[2]?.persistence?.persistedUrl, 'https://cdn.example.com/generated.png')
  assert.deepEqual(persistedCalls.at(-1)?.[3], { changeType: 'node-generated' })
})

test('image node generation returns and clears loading before background persistence completes', async () => {
  let resolvePersistence
  const persistenceDone = new Promise((resolve) => {
    resolvePersistence = resolve
  })
  const { calls, generation, imageActionLoading } = await createHarness({
    resolveImagePersistence: async (...args) => {
      calls.push(['resolve-persistence', ...args])
      await persistenceDone
      return {
        persistedUrl: 'https://cdn.example.com/generated.png',
        displayUrl: 'https://cdn.example.com/generated.png',
        persisted: true,
        persistError: ''
      }
    }
  })

  const runPromise = generation.runImageGeneration('create')
  await new Promise((resolve) => setTimeout(resolve, 0))

  let completedBeforePersistence = false
  runPromise.then(() => {
    completedBeforePersistence = true
  })
  await new Promise((resolve) => setTimeout(resolve, 0))

  assert.equal(completedBeforePersistence, true)
  assert.equal(imageActionLoading.value, '')
  assert.equal(calls.some((call) => call[0] === 'save-project'), false)

  resolvePersistence()
  await runPromise
  await flushBackgroundTasks()

  assert.deepEqual(calls.filter((call) => call[0] === 'save-project'), [['save-project']])
})

test('image node generation ignores stale background persistence after a newer preview appears', async () => {
  let resolvePersistence
  const persistenceDone = new Promise((resolve) => {
    resolvePersistence = resolve
  })
  const { calls, displayImageUrl, generation } = await createHarness({
    resolveImagePersistence: async (...args) => {
      calls.push(['resolve-persistence', ...args])
      await persistenceDone
      return {
        persistedUrl: 'https://cdn.example.com/old-generated.png',
        displayUrl: 'https://cdn.example.com/old-generated.png',
        persisted: true,
        persistError: ''
      }
    }
  })

  await generation.runImageGeneration('create')
  displayImageUrl.value = 'https://tmp.example.com/newer-generated.png'

  resolvePersistence()
  await flushBackgroundTasks()

  assert.equal(calls.some((call) => call[0] === 'save-project'), false)
  const persistedCalls = calls.filter((call) => call[0] === 'update-node' && call[2]?.kind === 'persistence-patch')
  assert.equal(persistedCalls.length, 1)
  assert.equal(persistedCalls[0]?.[2]?.persistence?.displayUrl, 'https://tmp.example.com/generated.png')
})

test('image node generation keeps temporary output without saving the project', async () => {
  const { calls, generation, messages } = await createHarness({
    persistence: {
      persistedUrl: '',
      displayUrl: 'https://tmp.example.com/generated.png',
      persisted: false,
      persistError: 'Generated image persistence failed. Please retry.'
    }
  })

  await generation.runImageGeneration('create')
  await flushBackgroundTasks()

  assert.equal(calls.some((call) => call[0] === 'save-project'), false)
  assert.deepEqual(messages, [[
    'warning',
    'Image generated, but the result is still temporary. Refresh may lose it.'
  ]])
})

test('image node generation persists transient inline provider output after displaying it', async () => {
  const inlineDataUrl = 'data:image/png;base64,generated'
  const { calls, generation, messages } = await createHarness({
    generateResult: [{
      url: inlineDataUrl,
      transient: true,
      persistError: ''
    }]
  })

  await generation.runImageGeneration('create')
  await flushBackgroundTasks()

  assert.deepEqual(calls.find((call) => call[0] === 'resolve-persistence')?.slice(0, 2), [
    'resolve-persistence',
    inlineDataUrl
  ])
  assert.deepEqual(calls.filter((call) => call[0] === 'save-project'), [['save-project']])
  const updateCalls = calls.filter((call) => call[0] === 'update-node' && call[2]?.kind === 'persistence-patch')
  assert.equal(updateCalls[0]?.[2]?.persistence?.displayUrl, inlineDataUrl)
  assert.equal(updateCalls[0]?.[2]?.persistence?.persisted, false)
  assert.deepEqual(updateCalls[0]?.[3], { persist: false })
  assert.equal(updateCalls.at(-1)?.[2]?.persistence?.persistedUrl, 'https://cdn.example.com/generated.png')
  assert.deepEqual(updateCalls.at(-1)?.[3], { changeType: 'node-generated' })
  assert.deepEqual(messages, [['success', 'Image generated']])
})

test('image node generation records errors and clears the loading action', async () => {
  const { calls, generation, imageActionLoading, messages } = await createHarness({
    generateError: new Error('provider failed')
  })

  await generation.runImageGeneration('create')

  assert.equal(imageActionLoading.value, '')
  assert.deepEqual(calls.find((call) => call[0] === 'update-node' && call[2]?.kind === 'action-error'), [
    'update-node',
    'image-node-1',
    {
      kind: 'action-error',
      payload: {
        message: 'Image generation failed: provider failed'
      }
    }
  ])
  assert.deepEqual(messages, [['error', 'Image generation failed: provider failed']])
})

test('image node generation stop resets progress and marks the node stopped', async () => {
  const { calls, generation, imageActionLoading, messages } = await createHarness()
  imageActionLoading.value = 'create'

  generation.handleStopGeneration()

  assert.equal(imageActionLoading.value, '')
  assert.deepEqual(calls, [
    ['reset-progress'],
    ['update-node', 'image-node-1', {
      kind: 'action-error',
      payload: { fallbackMessage: 'Image tracking paused. Reopen this project or select Create to retrieve the result.' }
    }, { persist: false }]
  ])
  assert.deepEqual(messages, [['info', 'Image tracking paused']])
})

test('regenerating a migrated image adds its displayed source only once', async () => {
  const current = 'https://cdn.example.com/current.png'
  const { calls, generation } = await createHarness({
    selfImage: current,
    inputs: { prompt: 'Saved creative brief', refImages: ['reference.png', current] }
  })
  await generation.runImageGeneration('regenerate')
  await flushBackgroundTasks()
  const request = calls.find(([key]) => key === 'generate')[1]
  assert.equal(request.prompt, 'Saved creative brief')
  assert.deepEqual(request.image, [current, 'reference.png'])
})

test('submitted task survives refresh and resumes by task id without a new generation', async () => {
  const initial = await createHarness({ submitTaskId: 'paid-task-1', generateError: new Error('offline'),
    inputs: { prompt: 'Saved brief', refImages: ['https://cdn.example.com/ref.png', 'data:image/png;base64,private'] } })
  await initial.generation.runImageGeneration()
  assert.equal(initial.data.imageTaskId, 'paid-task-1')
  assert.deepEqual(initial.data.imageTaskMetadata.sourceRefImages, ['https://cdn.example.com/ref.png'])
  assert.equal(initial.calls.filter(call => call[0] === 'save-project').length, 2)
  const reopened = await createHarness({ data: JSON.parse(JSON.stringify(initial.data)) })
  await reopened.generation.runImageGeneration()
  await flushBackgroundTasks()
  assert.equal(reopened.calls.filter(call => call[0] === 'generate').length, 0)
  assert.equal(reopened.calls.find(call => call[0] === 'resume')[1], 'paid-task-1')
  assert.equal(reopened.data.imageTaskId, '')
  assert.equal(reopened.data.imageTaskMetadata, null)
})

test('only terminal task failures clear durable ids while transient errors remain recoverable', async () => {
  for (const terminal of [false, true]) {
    const harness = await createHarness({ data: { imageTaskId: 'task-2', imageTaskMetadata: { sourcePrompt: 'brief' } },
      resumeError: Object.assign(new Error('task error'), { imageTaskTerminal: terminal }) })
    await harness.generation.resumeImageGeneration()
    assert.equal(harness.data.imageTaskId, terminal ? '' : 'task-2')
    assert.equal(harness.calls.filter(call => call[0] === 'generate').length, 0)
  }
})

test('unmount prevents late result writes and task completion from affecting another node', async () => {
  let resolveResult
  const harness = await createHarness({ onGenerate: async (request, options) => {
    await options.onSubmitted('task-3')
    return new Promise(resolve => { resolveResult = resolve })
  } })
  const running = harness.generation.runImageGeneration()
  await flushBackgroundTasks()
  assert.equal(harness.data.imageTaskId, 'task-3')
  const count = harness.calls.filter(call => call[0] === 'update-node').length
  harness.generation.disposeGeneration()
  resolveResult([{ url: 'https://cdn.example.com/late.png' }])
  await running
  await flushBackgroundTasks()
  assert.equal(harness.calls.filter(call => call[0] === 'update-node').length, count)
  assert.equal(harness.data.imageTaskId, 'task-3')
})

test('paused tracking retains the paid task and Create resumes instead of resubmitting', async () => {
  const harness = await createHarness({ data: { imageTaskId: 'pause-task', imageTaskMetadata: { sourcePrompt: 'saved' } } })
  harness.generation.handleStopGeneration()
  assert.equal(harness.data.imageTaskId, 'pause-task')
  await harness.generation.runImageGeneration()
  await flushBackgroundTasks()
  assert.equal(harness.calls.filter(call => call[0] === 'generate').length, 0)
  assert.equal(harness.calls.find(call => call[0] === 'resume')[1], 'pause-task')
})

test('pause before submission acknowledgement blocks duplicate POST and saves the late task before resuming by GET', async () => {
  let acknowledge
  let submittedSignal
  const responseReady = new Promise(resolve => { acknowledge = resolve })
  const harness = await createHarness({ onGenerate: async (request, options) => {
    submittedSignal = options.signal
    await responseReady
    await options.onSubmitted('late-paid-task')
    if (options.signal.aborted) throw Object.assign(new Error('tracking paused'), { name: 'AbortError' })
    return [{ url: 'https://cdn.example.com/unexpected.png' }]
  } })
  const first = harness.generation.runImageGeneration()
  await flushBackgroundTasks()
  harness.generation.handleStopGeneration()
  const repeated = harness.generation.runImageGeneration()
  try {
    assert.equal(harness.calls.filter(call => call[0] === 'generate').length, 1)
    assert.equal(submittedSignal.aborted, false, 'submission must remain in flight until its task id is durable')
    assert.notEqual(harness.imageActionLoading.value, '')
  } finally {
    acknowledge()
    await Promise.allSettled([first, repeated])
  }
  assert.equal(submittedSignal.aborted, true, 'only the acknowledged task tracking is paused')
  assert.equal(harness.data.imageTaskId, 'late-paid-task')
  assert.ok(harness.calls.some(call => call[0] === 'save-project'))
  await harness.generation.runImageGeneration()
  await flushBackgroundTasks()
  assert.equal(harness.calls.filter(call => call[0] === 'generate').length, 1)
  assert.equal(harness.calls.find(call => call[0] === 'resume')[1], 'late-paid-task')
})
