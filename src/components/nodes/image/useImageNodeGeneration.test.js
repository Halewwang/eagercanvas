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

const createHarness = async (overrides = {}) => {
  const { useImageNodeGeneration } = await loadGeneration()
  const calls = []
  const messages = []
  const imageActionLoading = { value: '' }
  const generation = useImageNodeGeneration({
    buildImagePersistencePatch: (persistence, extra) => ({ kind: 'persistence-patch', persistence, extra }),
    buildSourceRefImages: (...groups) => {
      calls.push(['build-source-refs', ...groups])
      return groups.flat()
    },
    currentProjectId: { value: 'project-1' },
    displayImageUrl: { value: overrides.selfImage || '' },
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
      generate: async (request) => {
        calls.push(['generate', request])
        if (overrides.generateError) throw overrides.generateError
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
    updateNode: (...args) => calls.push(['update-node', ...args])
  })

  return {
    calls,
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

  assert.equal(imageActionLoading.value, '')
  assert.deepEqual(calls[0], ['update-node', 'image-node-1', { kind: 'action-pending' }])
  assert.deepEqual(calls[1][0], 'generate')
  assert.equal(calls[1][1].output_compression, 100)
  assert.deepEqual(calls[1][1].image, [
    'https://cdn.example.com/current.png',
    'https://cdn.example.com/ref.png'
  ])
  assert.deepEqual(calls.find((call) => call[0] === 'resolve-persistence')?.slice(0, 3), [
    'resolve-persistence',
    'https://tmp.example.com/generated.png',
    calls.find((call) => call[0] === 'resolve-persistence')?.[2]
  ])
  assert.match(calls.find((call) => call[0] === 'resolve-persistence')?.[2], /^generated-\d+\.png$/)
  assert.deepEqual(calls.filter((call) => call[0] === 'save-project'), [['save-project']])
  assert.deepEqual(messages, [['success', 'Image regenerated']])
})

test('image node generation displays the provider result before persistence finishes', async () => {
  let finishPersistence
  const { calls, generation } = await createHarness({
    persistence: undefined,
    generateResult: [{ url: 'data:image/png;base64,aW1hZ2U=' }],
    resolveImagePersistence: async (...args) => {
      calls.push(['resolve-persistence', ...args])
      return new Promise((resolve) => {
        finishPersistence = () => resolve({
          persistedUrl: 'https://cdn.example.com/generated.png',
          displayUrl: 'https://cdn.example.com/generated.png',
          persisted: true,
          persistError: ''
        })
      })
    }
  })

  const runPromise = generation.runImageGeneration('create')
  await new Promise((resolve) => setImmediate(resolve))

  const immediatePatch = calls.find((call) =>
    call[0] === 'update-node' &&
    call[2]?.kind === 'persistence-patch' &&
    call[2]?.persistence?.displayUrl === 'data:image/png;base64,aW1hZ2U='
  )

  assert.ok(immediatePatch, 'provider image should be visible while persistence is still running')
  assert.equal(immediatePatch[2].persistence.persisted, false)
  assert.equal(immediatePatch[2].extra.persistStatus, 'saving')
  assert.equal(calls.some((call) => call[0] === 'save-project'), false)

  finishPersistence()
  await runPromise

  assert.deepEqual(calls.filter((call) => call[0] === 'save-project'), [['save-project']])
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

  assert.equal(calls.some((call) => call[0] === 'save-project'), false)
  assert.deepEqual(messages, [[
    'warning',
    'Image generated, but the result is still temporary. Refresh may lose it.'
  ]])
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
      payload: { fallbackMessage: 'Generation stopped' }
    }]
  ])
  assert.deepEqual(messages, [['info', 'Generation stopped']])
})
