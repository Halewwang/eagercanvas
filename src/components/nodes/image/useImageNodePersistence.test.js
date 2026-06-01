import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const persistenceUrl = new URL('./useImageNodePersistence.js', import.meta.url)
const persistencePath = fileURLToPath(persistenceUrl)

const loadPersistence = async () => {
  assert.ok(existsSync(persistencePath), 'useImageNodePersistence.js should exist')
  const persistenceSource = readFileSync(persistenceUrl, 'utf8')
  return import(`data:text/javascript;base64,${Buffer.from(persistenceSource).toString('base64')}`)
}

test('image node persistence stores generated output with project and node source metadata', async () => {
  const { useImageNodePersistence } = await loadPersistence()
  const calls = []
  const persistence = useImageNodePersistence({
    currentProjectId: { value: 'project-1' },
    getImageNodeSaveFeedback: () => ({}),
    getImageNodeToolSaveMessage: () => ({}),
    nodeId: () => 'image-node-1',
    persistImageUrl: async (...args) => {
      calls.push(args)
      return 'https://cdn.example.com/stable.png'
    },
    projectSaveState: { value: {} }
  })

  const result = await persistence.resolveImagePersistence(
    ' data:image/png;base64,abc ',
    'generated.png',
    'Image was not fully saved.'
  )

  assert.deepEqual(result, {
    persistedUrl: 'https://cdn.example.com/stable.png',
    displayUrl: 'https://cdn.example.com/stable.png',
    persisted: true,
    persistError: ''
  })
  assert.deepEqual(calls, [[
    'data:image/png;base64,abc',
    'generated.png',
    {
      projectId: 'project-1',
      source: 'image_node',
      sourceNodeId: 'image-node-1'
    }
  ]])
})

test('image node persistence keeps preview output when remote persistence fails', async () => {
  const { useImageNodePersistence } = await loadPersistence()
  const warnings = []
  const persistence = useImageNodePersistence({
    currentProjectId: { value: 'project-1' },
    getImageNodeSaveFeedback: () => ({}),
    getImageNodeToolSaveMessage: () => ({}),
    logger: {
      warn: (...args) => warnings.push(args)
    },
    nodeId: 'image-node-1',
    persistImageUrl: async () => {
      throw new Error('network unavailable')
    },
    projectSaveState: { value: {} }
  })

  const result = await persistence.resolveImagePersistence(
    'https://tmp.example.com/image.png',
    'tool.png',
    'Temporary image was not fully saved.'
  )

  assert.deepEqual(result, {
    persistedUrl: '',
    displayUrl: 'https://tmp.example.com/image.png',
    persisted: false,
    persistError: 'Temporary image was not fully saved.'
  })
  assert.equal(warnings.length, 1)
  assert.match(warnings[0][0], /Image persistence failed/)
})

test('image node persistence rejects empty image output before persisting', async () => {
  const { useImageNodePersistence } = await loadPersistence()
  let persistCalled = false
  const persistence = useImageNodePersistence({
    currentProjectId: { value: 'project-1' },
    getImageNodeSaveFeedback: () => ({}),
    getImageNodeToolSaveMessage: () => ({}),
    nodeId: 'image-node-1',
    persistImageUrl: async () => {
      persistCalled = true
    },
    projectSaveState: { value: {} }
  })

  await assert.rejects(
    () => persistence.resolveImagePersistence('  ', 'empty.png', 'No persisted output.'),
    /No image output/
  )
  assert.equal(persistCalled, false)
})

test('image node persistence delegates save feedback to the current canvas save state', async () => {
  const { useImageNodePersistence } = await loadPersistence()
  const calls = []
  const persistence = useImageNodePersistence({
    currentProjectId: { value: 'project-1' },
    getImageNodeSaveFeedback: (savedOk, saveState) => {
      calls.push([savedOk, saveState])
      return { mode: savedOk ? 'synced' : 'local-only' }
    },
    getImageNodeToolSaveMessage: () => ({}),
    nodeId: 'image-node-1',
    persistImageUrl: async () => '',
    projectSaveState: { value: { localSaved: true } }
  })

  assert.deepEqual(persistence.resolveImageSaveFeedback(false), { mode: 'local-only' })
  assert.deepEqual(calls, [[false, { localSaved: true }]])
})

test('image node persistence dispatches tool save messages and skips empty text', async () => {
  const { useImageNodePersistence } = await loadPersistence()
  const messages = []
  const persistence = useImageNodePersistence({
    currentProjectId: { value: 'project-1' },
    getImageNodeSaveFeedback: () => ({}),
    getImageNodeToolSaveMessage: (payload) => (
      payload.messages?.synced
        ? { type: 'success', text: payload.messages.synced }
        : { type: 'warning', text: '' }
    ),
    messageApi: () => ({
      success: (text) => messages.push(['success', text]),
      warning: (text) => messages.push(['warning', text])
    }),
    nodeId: 'image-node-1',
    persistImageUrl: async () => '',
    projectSaveState: { value: {} }
  })

  persistence.showImageToolSaveMessage({
    saveFeedback: { mode: 'synced' },
    saveState: { remoteSynced: true },
    persisted: true,
    messages: { synced: 'Tool result saved' }
  })
  persistence.showImageToolSaveMessage({
    saveFeedback: { mode: 'failed' },
    messages: {}
  })

  assert.deepEqual(messages, [['success', 'Tool result saved']])
})
