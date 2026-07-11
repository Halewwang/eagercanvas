import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const hookUrl = new URL('./useCanvasRouteLifecycle.js', import.meta.url)
const vueUrl = import.meta.resolve('vue')
const hookSource = readFileSync(hookUrl, 'utf8')
  .replace("from 'vue'", `from '${vueUrl}'`)
  .replace("import { getMediaAssets } from '@/api'", 'const getMediaAssets = async () => ({ items: [] })')
  .replace("import { getWorkflowById } from '@/config/workflows'", 'const getWorkflowById = () => null')
  .replace("import { isLocalPreviewEnabled } from '@/utils/localPreview'", 'const isLocalPreviewEnabled = () => false')
  .replace(
    /import \{\s*recoverMissingNodeMedia,\s*shouldApplyRemoteProjectSnapshot,\s*shouldUseCachedProjectBeforeRemote\s*\} from '@\/utils\/canvasSync'/s,
    [
      'const recoverMissingNodeMedia = () => ({ restoredCount: 0, nodes: [], restoredNodeIds: [] })',
      'const shouldApplyRemoteProjectSnapshot = () => false',
      'const shouldUseCachedProjectBeforeRemote = () => false'
    ].join('\n')
  )
const { useCanvasRouteLifecycle } = await import(`data:text/javascript;base64,${Buffer.from(hookSource).toString('base64')}`)

const createRef = (value) => ({ value })

const createHarness = (overrides = {}) => {
  const calls = []
  const projectLoadStates = []
  const mountedCallbacks = []
  const unmountedCallbacks = []
  const watchers = []
  const listeners = []
  const documentListeners = []
  const route = { params: { id: overrides.routeProjectId ?? 'project-1' } }
  const nodes = createRef(overrides.nodes || [{ id: 'node-1' }])
  const edges = createRef(overrides.edges || [])
  const groups = createRef(overrides.groups || [])
  const flowKey = createRef(100)
  const isMobile = createRef(false)
  const currentCanvasProjectId = createRef(overrides.currentCanvasProjectId ?? route.params.id)
  const sessionValues = new Map(Object.entries(overrides.sessionValues || {}))

  const lifecycle = useCanvasRouteLifecycle({
    route,
    currentCanvasProjectId,
    edges,
    flowKey,
    groups,
    isLocalPreviewEnabledFn: () => overrides.isLocalPreviewEnabled ?? false,
    isMobile,
    nodes,
    nodesFactory: {
      createFromWorkflow: async (workflow, options) => calls.push(['create-workflow', workflow, options])
    },
    bootstrapAuth: async () => calls.push(['bootstrap-auth']),
    cleanupOverlayRectUpdates: () => calls.push(['cleanup-overlays']),
    clearViewportSettleTimer: () => calls.push(['clear-viewport-settle']),
    consoleRef: {
      warn: (...args) => calls.push(['warn', ...args])
    },
    flushSave: async () => calls.push(['flush-save']),
    getMediaAssetsFn: async (params) => {
      calls.push(['get-media-assets', params])
      return overrides.mediaResponse || { items: [] }
    },
    getProjectCanvas: (projectId) => {
      calls.push(['get-project-canvas', projectId])
      if (overrides.getProjectCanvas) return overrides.getProjectCanvas(projectId)
      return Object.prototype.hasOwnProperty.call(overrides, 'cachedCanvasData')
        ? overrides.cachedCanvasData
        : { nodes: [{ id: 'cached' }] }
    },
    getWorkflowByIdFn: (workflowId) => {
      calls.push(['get-workflow', workflowId])
      return overrides.workflow ?? { id: workflowId, nodes: [] }
    },
    hasPendingCanvasChanges: () => overrides.hasPendingCanvasChanges ?? false,
    initProjectsStore: () => {
      calls.push(['init-projects-store'])
      return overrides.projectsReady || Promise.resolve(overrides.initProjectResult || null)
    },
    loadCachedProjects: async () => {
      calls.push(['load-cached-projects'])
      if (overrides.loadCachedProjects) return overrides.loadCachedProjects()
      return null
    },
    loadProject: (projectId) => calls.push(['load-project', projectId]),
    nextTickFn: async () => calls.push(['next-tick']),
    nowFn: () => 12345,
    onMountedFn: (callback) => mountedCallbacks.push(callback),
    onUnmountedFn: (callback) => unmountedCallbacks.push(callback),
    onProjectLoadStateChange: (state) => projectLoadStates.push(state),
    recoverMissingNodeMediaFn: (params) => {
      calls.push(['recover-missing-media', params])
      return overrides.recovery || { restoredCount: 0, nodes: params.nodes, restoredNodeIds: [] }
    },
    refreshProjectById: async (projectId) => {
      calls.push(['refresh-project', projectId])
      if (overrides.refreshProjectById) return overrides.refreshProjectById(projectId)
      if (overrides.refreshError) throw overrides.refreshError
      return overrides.refreshResult || { id: projectId, canvasData: { nodes: [{ id: 'remote' }] } }
    },
    resetCanvasSession: () => calls.push(['reset-canvas-session']),
    scheduleOverlayRectUpdate: (options) => calls.push(['schedule-overlay', options]),
    sessionStorageRef: {
      getItem: (key) => sessionValues.get(key) || '',
      removeItem: (key) => {
        calls.push(['remove-session', key])
        sessionValues.delete(key)
      }
    },
    shouldApplyRemoteProjectSnapshotFn: (params) => {
      calls.push(['should-apply-remote', params])
      if (overrides.shouldApplyRemoteProjectSnapshotFn) {
        return overrides.shouldApplyRemoteProjectSnapshotFn(params)
      }
      return overrides.shouldApplyRemote ?? true
    },
    shouldUseCachedProjectBeforeRemoteFn: (params) => {
      calls.push(['should-use-cache', params])
      return overrides.shouldUseCache ?? true
    },
    stopGroupDrag: () => calls.push(['stop-group-drag']),
    updateNodeInternals: (nodeId) => calls.push(['update-node-internals', nodeId]),
    watchFn: (source, callback, options) => {
      watchers.push({ source, callback, options })
    },
    windowRef: {
      innerWidth: overrides.innerWidth ?? 640,
      addEventListener: (type, callback) => listeners.push(['add', type, callback]),
      removeEventListener: (type, callback) => listeners.push(['remove', type, callback])
    },
    documentRef: {
      visibilityState: overrides.visibilityState ?? 'visible',
      addEventListener: (type, callback) => documentListeners.push(['add', type, callback]),
      removeEventListener: (type, callback) => documentListeners.push(['remove', type, callback])
    },
    handleGlobalKeydown: (event) => calls.push(['global-keydown', event?.key])
  })

  return {
    calls,
    currentCanvasProjectId,
    documentListeners,
    edges,
    flowKey,
    groups,
    isMobile,
    lifecycle,
    listeners,
    mountedCallbacks,
    nodes,
    projectLoadStates,
    route,
    unmountedCallbacks,
    watchers
  }
}

test('canvas route lifecycle loads cached projects before remote refresh and applies pending workflow templates', async () => {
  const { calls, isMobile, mountedCallbacks, watchers } = createHarness({
    nodes: [],
    sessionValues: {
      'ai-canvas-workflow-template': JSON.stringify({ workflowId: 'workflow-1' })
    }
  })

  assert.equal(watchers.length, 1)
  assert.equal(mountedCallbacks.length, 1)

  await mountedCallbacks[0]()

  assert.equal(isMobile.value, true)
  const firstIndex = (name) => calls.findIndex((call) => call[0] === name)

  assert.ok(firstIndex('bootstrap-auth') < firstIndex('load-cached-projects'))
  assert.ok(firstIndex('load-cached-projects') < firstIndex('get-project-canvas'))
  assert.ok(firstIndex('get-project-canvas') < firstIndex('should-use-cache'))
  assert.ok(firstIndex('should-use-cache') < firstIndex('load-project'))
  assert.ok(firstIndex('load-project') < firstIndex('init-projects-store'))
  assert.ok(firstIndex('init-projects-store') < firstIndex('schedule-overlay'))
  assert.deepEqual(calls.find((call) => call[0] === 'should-use-cache'), [
    'should-use-cache',
    { projectId: 'project-1', cachedCanvasData: { nodes: [{ id: 'cached' }] } }
  ])
  assert.deepEqual(calls.find((call) => call[0] === 'create-workflow'), [
    'create-workflow',
    { id: 'workflow-1', nodes: [] },
    {}
  ])
  assert.equal(calls.some((call) => call[0] === 'refresh-project' && call[1] === 'project-1'), true)
})

test('canvas route lifecycle protects unsaved local edits when remote refresh completes', async () => {
  const { calls, lifecycle, nodes, route } = createHarness({
    shouldUseCache: false,
    shouldApplyRemote: false
  })

  await lifecycle.ensureProjectSnapshot('project-1')

  assert.deepEqual(calls, [
    ['refresh-project', 'project-1'],
    ['get-project-canvas', 'project-1'],
    ['should-apply-remote', {
      refreshedProjectId: 'project-1',
      activeRouteProjectId: 'project-1',
      currentCanvasProjectId: 'project-1',
      hasPendingCanvasChanges: false
    }]
  ])
  assert.deepEqual(nodes.value, [{ id: 'node-1' }])

  route.params.id = 'project-2'
  await lifecycle.ensureProjectSnapshot('project-1')

  assert.equal(calls.filter((call) => call[0] === 'load-project').length, 0)
})

test('canvas route lifecycle recovers missing media and cleans up page listeners', async () => {
  const recoveryNodes = [{ id: 'node-1', data: { url: 'recovered' } }]
  const { calls, lifecycle, listeners, documentListeners, nodes, unmountedCallbacks } = createHarness({
    recovery: {
      restoredCount: 1,
      nodes: recoveryNodes,
      restoredNodeIds: ['node-1']
    },
    mediaResponse: {
      items: [{ id: 'asset-1', url: 'https://example.test/image.png' }]
    }
  })

  await lifecycle.loadProjectById('project-1')

  assert.deepEqual(nodes.value, recoveryNodes)
  assert.deepEqual(calls, [
    ['load-project', 'project-1'],
    ['get-media-assets', { projectId: 'project-1', limit: 100 }],
    ['recover-missing-media', {
      nodes: [{ id: 'node-1' }],
      edges: [],
      assets: [{ id: 'asset-1', url: 'https://example.test/image.png' }],
      now: 12345
    }],
    ['next-tick'],
    ['update-node-internals', 'node-1'],
    ['flush-save']
  ])

  assert.equal(unmountedCallbacks.length, 1)
  unmountedCallbacks[0]()

  assert.equal(listeners.some((entry) => entry[0] === 'remove' && entry[1] === 'resize'), true)
  assert.equal(documentListeners.some((entry) => entry[0] === 'remove' && entry[1] === 'visibilitychange'), true)
  assert.deepEqual(calls.slice(-4), [
    ['stop-group-drag'],
    ['cleanup-overlays'],
    ['clear-viewport-settle'],
    ['flush-save']
  ])
})

test('canvas route lifecycle skips blank media recovery in local preview mode', async () => {
  const { calls, lifecycle } = createHarness({
    isLocalPreviewEnabled: true,
    mediaResponse: {
      items: [{ id: 'asset-1', url: 'https://example.test/image.png' }]
    }
  })

  await lifecycle.loadProjectById('project-1')

  assert.deepEqual(calls, [
    ['load-project', 'project-1']
  ])
})

test('canvas starts detail without waiting for project list', async () => {
  let releaseProjects
  const projectsReady = new Promise((resolve) => { releaseProjects = resolve })
  const { calls, mountedCallbacks } = createHarness({
    cachedCanvasData: null,
    shouldUseCache: false,
    projectsReady
  })
  const mounted = mountedCallbacks[0]()
  await Promise.resolve()
  await Promise.resolve()
  assert.equal(calls.some((call) => call[0] === 'init-projects-store'), true)
  assert.equal(calls.some((call) => call[0] === 'refresh-project'), true)
  releaseProjects()
  await mounted
})

test('canvas reports ready and unrecoverable error states', async () => {
  const ready = createHarness({ shouldUseCache: false })
  await ready.lifecycle.ensureProjectSnapshot('project-1')
  assert.equal(ready.projectLoadStates.at(-1).status, 'ready')

  const failed = createHarness({
    cachedCanvasData: null,
    shouldUseCache: false,
    refreshError: new Error('detail unavailable')
  })
  await failed.lifecycle.ensureProjectSnapshot('project-1')
  assert.equal(failed.projectLoadStates.at(-1).status, 'error')
  assert.equal(failed.projectLoadStates.at(-1).error, 'detail unavailable')
})

test('canvas reports an error when detail fallback has only a summary and no draft', async () => {
  const harness = createHarness({
    cachedCanvasData: null,
    shouldUseCache: false,
    refreshResult: { id: 'project-1', name: 'Summary only' }
  })

  await harness.lifecycle.ensureProjectSnapshot('project-1')

  assert.deepEqual(harness.projectLoadStates.at(-1), {
    status: 'error',
    projectId: 'project-1',
    error: 'Project could not be loaded'
  })
  assert.equal(harness.calls.some((call) => call[0] === 'load-project'), false)
})

test('canvas continues to remote detail after cached project hydration fails', async () => {
  let remoteAvailable = false
  const harness = createHarness({
    getProjectCanvas: () => remoteAvailable ? { nodes: [{ id: 'remote' }] } : null,
    loadCachedProjects: async () => {
      throw new Error('cache unavailable')
    },
    refreshProjectById: async (projectId) => {
      remoteAvailable = true
      return { id: projectId, canvasData: { nodes: [{ id: 'remote' }] } }
    },
    shouldUseCache: false
  })

  await harness.mountedCallbacks[0]()

  assert.equal(harness.calls.some((call) => call[0] === 'refresh-project'), true)
  assert.equal(harness.projectLoadStates.at(-1).status, 'ready')
  assert.equal(
    harness.calls.some((call) => call[0] === 'warn' && call[1] === 'Cached project hydration skipped:'),
    true
  )
})

test('canvas reports remote detail failure after cached project hydration fails', async () => {
  const harness = createHarness({
    cachedCanvasData: null,
    loadCachedProjects: async () => {
      throw new Error('cache unavailable')
    },
    refreshError: new Error('detail unavailable'),
    shouldUseCache: false
  })

  await harness.mountedCallbacks[0]()

  assert.equal(harness.calls.some((call) => call[0] === 'refresh-project'), true)
  assert.deepEqual(harness.projectLoadStates.at(-1), {
    status: 'error',
    projectId: 'project-1',
    error: 'detail unavailable'
  })
})

test('stale route completion does not replace the active project load state', async () => {
  const pendingRefreshes = new Map()
  const harness = createHarness({
    shouldUseCache: false,
    refreshProjectById: (projectId) => new Promise((resolve) => {
      pendingRefreshes.set(projectId, resolve)
    }),
    shouldApplyRemoteProjectSnapshotFn: ({ refreshedProjectId, activeRouteProjectId }) => (
      refreshedProjectId === activeRouteProjectId
    )
  })
  const routeWatcher = harness.watchers[0].callback

  harness.route.params.id = 'project-2'
  harness.currentCanvasProjectId.value = 'project-2'
  const projectTwoLoad = routeWatcher('project-2', 'project-1')
  await Promise.resolve()

  harness.route.params.id = 'project-3'
  harness.currentCanvasProjectId.value = 'project-3'
  const projectThreeLoad = routeWatcher('project-3', 'project-2')
  await Promise.resolve()

  pendingRefreshes.get('project-2')({ id: 'project-2', canvasData: { nodes: [] } })
  await projectTwoLoad
  assert.deepEqual(harness.projectLoadStates.at(-1), {
    status: 'loading',
    projectId: 'project-3',
    error: ''
  })

  pendingRefreshes.get('project-3')({ id: 'project-3', canvasData: { nodes: [] } })
  await projectThreeLoad
  assert.deepEqual(harness.projectLoadStates.at(-1), {
    status: 'ready',
    projectId: 'project-3',
    error: ''
  })
  assert.deepEqual(
    harness.calls.filter((call) => call[0] === 'load-project'),
    [['load-project', 'project-3']]
  )
})

test('warm draft refresh starts independently and ignores a stale remote result', async () => {
  let resolveRefresh
  let rejectProjects
  const projectsReady = new Promise((resolve, reject) => { rejectProjects = reject })
  const harness = createHarness({
    projectsReady,
    refreshProjectById: () => new Promise((resolve) => { resolveRefresh = resolve }),
    shouldApplyRemoteProjectSnapshotFn: ({ refreshedProjectId, activeRouteProjectId }) => (
      refreshedProjectId === activeRouteProjectId
    )
  })

  const mounted = harness.mountedCallbacks[0]()
  await Promise.resolve()
  await Promise.resolve()
  assert.equal(harness.calls.some((call) => call[0] === 'refresh-project'), true)

  harness.route.params.id = 'project-2'
  harness.currentCanvasProjectId.value = 'project-2'
  resolveRefresh({ id: 'project-1', canvasData: { nodes: [{ id: 'remote' }] } })
  rejectProjects(new Error('list unavailable'))
  await mounted
  await Promise.resolve()

  assert.deepEqual(
    harness.calls.filter((call) => call[0] === 'load-project'),
    [['load-project', 'project-1']]
  )
  assert.equal(
    harness.calls.some((call) => call[0] === 'warn' && call[1] === 'Project list refresh skipped:'),
    true
  )
})
