import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'
import { ref } from 'vue'

const enhanceResultsUrl = new URL('./useVideoNodeEnhanceResults.js', import.meta.url)
const vueUrl = import.meta.resolve('vue')

const loadEnhanceResults = async () => {
  assert.ok(existsSync(enhanceResultsUrl), 'useVideoNodeEnhanceResults.js should exist')
  const source = readFileSync(enhanceResultsUrl, 'utf8')
    .replace("from 'vue'", `from '${vueUrl}'`)
  return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)
}

const createHarness = async (overrides = {}) => {
  const { useVideoNodeEnhanceResults } = await loadEnhanceResults()
  const calls = []
  const messages = []
  const nodes = ref(overrides.nodes || [
    {
      id: 'video-node-1',
      position: { x: 120, y: 80 }
    }
  ])

  const enhanceResults = useVideoNodeEnhanceResults({
    addEdge: (edge) => calls.push(['add-edge', edge]),
    addNode: (...args) => {
      calls.push(['add-node', ...args])
      return overrides.addNodeResult ?? 'linked-video-1'
    },
    currentProjectId: ref('project-1'),
    edgeStrategy: {
      resolve: (edge) => {
        calls.push(['resolve-edge', edge])
        return {
          id: `${edge.source}->${edge.target}`,
          ...edge
        }
      }
    },
    flushSave: async () => {
      calls.push(['flush-save'])
      return true
    },
    logger: {
      warn: (...args) => calls.push(['logger-warn', ...args])
    },
    messageApi: () => ({
      error: (text) => messages.push(['error', text]),
      success: (text) => messages.push(['success', text]),
      warning: (text) => messages.push(['warning', text])
    }),
    nodeId: () => 'video-node-1',
    nodes,
    persistMediaUrl: async (...args) => {
      calls.push(['persist-media-url', ...args])
      if (overrides.persistError) throw overrides.persistError
      return overrides.persistedUrl
    },
    saveProject: async () => {
      calls.push(['save-project'])
      return overrides.savedOk ?? true
    },
    setTimeoutFn: (callback, delayMs) => {
      calls.push(['set-timeout', delayMs])
      callback()
    },
    triggerUpload: () => calls.push(['trigger-upload']),
    updateNode: (...args) => calls.push(['update-node', ...args]),
    updateNodeInternals: (nodeId) => calls.push(['update-node-internals', nodeId])
  })

  return {
    calls,
    enhanceResults,
    messages,
    nodes
  }
}

test('video node enhance results dispatch tool menu actions', async () => {
  const { calls, enhanceResults } = await createHarness()

  await enhanceResults.handleToolAction('replace-video')
  assert.deepEqual(calls, [['trigger-upload']])
  assert.equal(enhanceResults.showEnhanceDrawer.value, false)

  await enhanceResults.handleToolAction('enhance-video')
  assert.equal(enhanceResults.showEnhanceDrawer.value, true)
})

test('video node enhance results creates a linked pending video node', async () => {
  const { calls, enhanceResults } = await createHarness()

  await enhanceResults.handleEnhancePending({ fileType: 'video/webm' })

  assert.equal(enhanceResults.toolActionLoading.value, 'enhance-video')
  assert.deepEqual(calls[0], [
    'add-node',
    'video',
    { x: 480, y: 80 },
    {
      url: '',
      loading: true,
      label: 'Enhanced video',
      fileType: 'video/webm',
      sourceTool: 'video-enhance',
      error: ''
    }
  ])
  assert.deepEqual(calls[1], ['resolve-edge', {
    source: 'video-node-1',
    target: 'linked-video-1',
    sourceHandle: 'right',
    targetHandle: 'left'
  }])
  assert.deepEqual(calls[2], ['add-edge', {
    id: 'video-node-1->linked-video-1',
    source: 'video-node-1',
    target: 'linked-video-1',
    sourceHandle: 'right',
    targetHandle: 'left'
  }])
  assert.deepEqual(calls[3], ['set-timeout', 50])
  assert.deepEqual(calls[4], ['update-node-internals', 'linked-video-1'])
  assert.deepEqual(calls[5], ['flush-save'])

  await enhanceResults.handleEnhancePending({ fileType: 'video/mp4' })
  assert.equal(calls.filter((call) => call[0] === 'add-node').length, 1)
})

test('video node enhance results ignores replace-mode pending events', async () => {
  const { calls, enhanceResults } = await createHarness()

  await enhanceResults.handleEnhancePending({ targetMode: 'replace' })

  assert.deepEqual(calls, [])
  assert.equal(enhanceResults.toolActionLoading.value, '')
})

test('video node enhance results persists successful enhanced output', async () => {
  const { calls, enhanceResults, messages } = await createHarness({
    persistedUrl: 'https://cdn.example.com/enhanced.mp4'
  })
  await enhanceResults.handleEnhancePending()
  calls.length = 0

  await enhanceResults.handleEnhanceApply({
    fileType: 'video/webm',
    url: 'https://temporary.example.com/enhanced.mp4'
  })

  assert.equal(enhanceResults.toolActionLoading.value, '')
  assert.equal(enhanceResults.showEnhanceDrawer.value, false)
  assert.deepEqual(calls[0], ['persist-media-url', 'https://temporary.example.com/enhanced.mp4', calls[0][2], {
    projectId: 'project-1',
    source: 'video_enhance',
    sourceNodeId: 'video-node-1'
  }])
  assert.match(calls[0][2], /^enhanced-video-\d+\.mp4$/)
  const updateCall = calls.find((call) => call[0] === 'update-node')
  assert.equal(updateCall[1], 'linked-video-1')
  assert.equal(updateCall[2].url, 'https://cdn.example.com/enhanced.mp4')
  assert.equal(updateCall[2].loading, false)
  assert.equal(updateCall[2].fileType, 'video/webm')
  assert.equal(updateCall[2].persistStatus, 'saved')
  assert.equal(updateCall[2].persistError, '')
  assert.equal(typeof updateCall[2].updatedAt, 'number')
  assert.deepEqual(calls.find((call) => call[0] === 'save-project'), ['save-project'])
  assert.deepEqual(messages, [['success', 'Enhanced video created']])
})

test('video node enhance results keeps temporary output when persistence fails', async () => {
  const { calls, enhanceResults, messages } = await createHarness({
    persistError: new Error('storage down')
  })
  await enhanceResults.handleEnhancePending()
  calls.length = 0

  await enhanceResults.handleEnhanceApply({
    url: 'https://temporary.example.com/enhanced.mp4'
  })

  const warnCall = calls.find((call) => call[0] === 'logger-warn')
  assert.equal(warnCall[1], 'Video persistence failed, keeping preview only:')
  assert.equal(warnCall[2].message, 'storage down')
  const updateCall = calls.find((call) => call[0] === 'update-node')
  assert.equal(updateCall[2].url, 'https://temporary.example.com/enhanced.mp4')
  assert.equal(updateCall[2].persistStatus, 'error')
  assert.equal(updateCall[2].persistError, 'Enhanced result is only shown temporarily. Please retry.')
  assert.deepEqual(messages, [['warning', 'Enhanced result is only shown temporarily. Please retry until it is saved.']])
})

test('video node enhance results warns when saving the linked result fails', async () => {
  const { enhanceResults, messages } = await createHarness({
    persistedUrl: 'https://cdn.example.com/enhanced.mp4',
    savedOk: false
  })
  await enhanceResults.handleEnhancePending()

  await enhanceResults.handleEnhanceApply({
    url: 'https://temporary.example.com/enhanced.mp4'
  })

  assert.deepEqual(messages, [['warning', 'Enhanced video created, but project save failed. Please retry save.']])
})

test('video node enhance results writes failed apply errors to the pending node', async () => {
  const { calls, enhanceResults, messages } = await createHarness()
  await enhanceResults.handleEnhancePending()
  calls.length = 0

  await enhanceResults.handleEnhanceApply({ url: '' })

  assert.equal(enhanceResults.toolActionLoading.value, '')
  assert.deepEqual(calls.find((call) => call[0] === 'update-node'), [
    'update-node',
    'linked-video-1',
    {
      loading: false,
      error: 'No video output',
      updatedAt: calls.find((call) => call[0] === 'update-node')[2].updatedAt
    }
  ])
  assert.deepEqual(messages, [['error', 'No video output']])
})

test('video node enhance results writes pending drawer errors to the linked node', async () => {
  const { calls, enhanceResults } = await createHarness()
  await enhanceResults.handleEnhancePending()
  calls.length = 0

  await enhanceResults.handleEnhanceError({ message: 'Enhance failed upstream' })

  assert.equal(enhanceResults.toolActionLoading.value, '')
  assert.deepEqual(calls.find((call) => call[0] === 'update-node'), [
    'update-node',
    'linked-video-1',
    {
      loading: false,
      error: 'Enhance failed upstream',
      updatedAt: calls.find((call) => call[0] === 'update-node')[2].updatedAt
    }
  ])
  assert.deepEqual(calls.find((call) => call[0] === 'save-project'), ['save-project'])
})
