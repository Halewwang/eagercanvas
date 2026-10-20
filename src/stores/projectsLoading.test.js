import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { ref } from 'vue'

const parametersUrl = new URL('../utils/gptImageParameters.js', import.meta.url).href
const legacySource = readFileSync(new URL('./legacyImageConfig.js', import.meta.url), 'utf8')
  .replace("from '@/utils/gptImageParameters.js'", `from '${parametersUrl}'`)
  .replace("from '@/utils/imageDimensions.js'", `from '${new URL('../utils/imageDimensions.js', import.meta.url).href}'`)
const legacyUrl = `data:text/javascript;base64,${Buffer.from(legacySource).toString('base64')}`
const snapshotsSource = readFileSync(new URL('./canvasSnapshots.js', import.meta.url), 'utf8')
  .replace("from './canvasClone.js'", `from '${new URL('./canvasClone.js', import.meta.url).href}'`)
  .replace("from './legacyImageConfig.js'", `from '${legacyUrl}'`)
  .replace("from '@/utils/gptImageParameters.js'", `from '${parametersUrl}'`)
const snapshotsUrl = `data:text/javascript;base64,${Buffer.from(snapshotsSource).toString('base64')}`
const offlineSource = readFileSync(new URL('./canvasOfflineSync.js', import.meta.url), 'utf8')
  .replace("from './canvasSnapshots.js'", `from '${snapshotsUrl}'`)
  .replace("from './canvasSyncStatus.js'", `from '${new URL('./canvasSyncStatus.js', import.meta.url).href}'`)
const offlineUrl = `data:text/javascript;base64,${Buffer.from(offlineSource).toString('base64')}`

const source = readFileSync(new URL('./projects.js', import.meta.url), 'utf8')
let harnessId = 0
const deferred = () => {
  let resolve
  let reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const flush = () => new Promise((resolve) => setImmediate(resolve))
const row = (id, workspaceId = 'A') => ({
  id, name: id, workspace_id: workspaceId, permission: 'owner',
  created_at: '2026-10-19T00:00:00Z', updated_at: '2026-10-19T00:00:00Z'
})

const createHarness = async (t, options = {}) => {
  const user = ref({ id: 'user-1' })
  const isAuthenticated = ref(true)
  const storage = new Map()
  const drafts = new Map(options.drafts || [])
  const calls = { list: [], hydrate: 0, saved: [], deleted: [] }
  const previousStorage = globalThis.localStorage
  globalThis.localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key)
  }
  const key = `__projectsLoadingHarness${++harnessId}`
  const mocks = {
    useAuthStore: () => ({ user, isAuthenticated }),
    isLocalPreviewEnabled: () => false,
    apiListProjects: ({ workspaceId }) => {
      calls.list.push([user.value.id, workspaceId])
      return options.list?.({ workspaceId }) ?? Promise.resolve({ data: [] })
    },
    apiDeleteProject: options.delete || (async () => ({})),
    apiPatchProject: options.patch || (async () => ({})),
    canvasBroadcast: { publishDraftSaved() {}, publishRemoteSynced() {} },
    getCanvasDraftStorage: (userId) => ({
      migrateLegacyLocalStorageDrafts: async () => {},
      hydrate: () => { calls.hydrate += 1; return options.hydrate?.() ?? Promise.resolve([...drafts.values()]) },
      getCachedDraft: (id) => drafts.get(id) || null,
      saveDraft: async (id, record) => { calls.saved.push(id); drafts.set(id, record); return true },
      deleteDraft: async (id) => { calls.deleted.push([userId, id]); drafts.delete(id) }
    })
  }
  const apiNames = source.match(/import \{\n {2}apiCopyProjectToWorkspace,[\s\S]*?\n\} from '@\/api\/projects'/)[0]
    .match(/\bapi\w+/g).filter((name) => name !== 'api')
  for (const name of apiNames) mocks[name] ||= async () => ({})
  globalThis[key] = mocks
  const transformed = source
    .replace("from 'vue'", `from '${import.meta.resolve('vue')}'`)
    .replace(/import \{\n {2}apiCopyProjectToWorkspace,[\s\S]*?\n\} from '@\/api\/projects'/,
      `const { ${apiNames.join(', ')} } = globalThis.${key}`)
    .replace(/import \{ (useAuthStore|getCanvasDraftStorage|canvasBroadcast|isLocalPreviewEnabled) \} from '[^']+'/g,
      (_, name) => `const { ${name} } = globalThis.${key}`)
    .replace("from '@/stores/canvasSyncStatus'", `from '${new URL('./canvasSyncStatus.js', import.meta.url).href}'`)
    .replace("from './canvasOfflineSync.js'", `from '${offlineUrl}'`)
    .replace(/from '(\.\/[^']+)'/g, (_, path) => `from '${new URL(path, import.meta.url).href}'`)
  const store = await import(`data:text/javascript;base64,${Buffer.from(transformed).toString('base64')}#${harnessId}`)
  t.after(() => { delete globalThis[key]; globalThis.localStorage = previousStorage })
  return { store, calls, user, storage, drafts }
}

test('project summaries render without loading every canvas draft from IndexedDB', async (t) => {
  const hydration = deferred()
  const { store, calls } = await createHarness(t, {
    hydrate: () => hydration.promise,
    list: async () => ({ data: [row('p1')] })
  })
  const pending = store.loadProjects({ workspaceId: 'A', allowLocalFallback: false })
  await flush()
  assert.deepEqual(store.projects.value.map((project) => project.id), ['p1'])
  assert.equal(calls.hydrate, 0)
  hydration.resolve([])
  await pending
})

test('concurrent project requests are deduplicated only within the same user and workspace', async (t) => {
  const responses = { A: deferred(), B: deferred() }
  const { store, calls } = await createHarness(t, { list: ({ workspaceId }) => responses[workspaceId].promise })
  const first = store.loadProjects({ workspaceId: 'A' })
  const second = store.loadProjects({ workspaceId: 'A' })
  const latest = store.loadProjects({ workspaceId: 'B' })
  assert.deepEqual(calls.list, [['user-1', 'A'], ['user-1', 'B']])
  responses.B.resolve({ data: [row('p-b', 'B')] })
  await latest
  responses.A.resolve({ data: [row('p-a')] })
  await Promise.all([first, second])
  assert.deepEqual(store.projects.value.map((project) => project.id), ['p-b'])
  await store.loadProjects({ workspaceId: 'B' })
  assert.equal(calls.list.length, 3, 'a later refresh makes a fresh cloud request')
})

test('a response from the previous signed-in user cannot replace the new user list or cache', async (t) => {
  const response = deferred()
  const { store, user, storage } = await createHarness(t, { list: () => response.promise })
  const pending = store.loadProjects({ workspaceId: 'A' })
  user.value = { id: 'user-2' }
  store.projects.value = [{ id: 'new-user-project' }]
  response.resolve({ data: [row('old-user-project')] })
  await pending
  assert.deepEqual(store.projects.value.map((project) => project.id), ['new-user-project'])
  assert.equal(storage.has('ai-canvas-projects-draft-meta:user-2'), false)
})

test('failed workspace activation leaves the last confirmed project list intact', async (t) => {
  const activation = deferred()
  const { store } = await createHarness(t, { list: async () => ({ data: [row('p-b', 'B')] }) })
  store.projects.value = [{ id: 'p-a', workspaceId: 'A' }]
  const pending = store.loadProjects({ workspaceId: 'B', commitAfter: activation.promise })
  await flush()
  assert.deepEqual(store.projects.value.map((project) => project.id), ['p-a'])
  activation.reject(new Error('selection failed'))
  await assert.rejects(pending, /selection failed/)
  assert.deepEqual(store.projects.value.map((project) => project.id), ['p-a'])
})

test('deleting a project prevents an earlier project-list response from restoring it', async (t) => {
  const response = deferred()
  const { store } = await createHarness(t, { list: () => response.promise })
  store.projects.value = [{ id: 'p1', permission: 'owner' }]
  const pending = store.loadProjects({ workspaceId: 'A' })
  await store.deleteProject('p1')
  response.resolve({ data: [row('p1')] })
  await pending
  assert.deepEqual(store.projects.value, [])
})

test('offline sync finishing after deletion cannot restore the project or its draft', async (t) => {
  const patch = deferred()
  const { store, calls, drafts } = await createHarness(t, {
    patch: () => patch.promise,
    drafts: [['p1', { projectId: 'p1', canvasData: { nodes: [], edges: [] }, remoteSynced: false }]]
  })
  store.projects.value = [{ id: 'p1', permission: 'owner' }]
  const syncing = store.syncOfflineCanvasDrafts()
  await flush()
  await store.deleteProject('p1')
  patch.resolve({ data: row('p1') })
  await syncing
  assert.deepEqual(store.projects.value, [])
  assert.deepEqual(calls.saved, [])
  assert.equal(drafts.has('p1'), false)
})

test('a failed deduplicated request is evicted so a later refresh can recover', async (t) => {
  const response = deferred()
  const { store, calls } = await createHarness(t, { list: () => response.promise })
  const first = store.loadProjects({ workspaceId: 'A', allowLocalFallback: false })
  const second = store.loadProjects({ workspaceId: 'A', allowLocalFallback: false })
  response.reject(new Error('offline'))
  await Promise.all([first, second])
  assert.equal(calls.list.length, 1)
  assert.equal(store.projectsLoadState.value.source, 'remote-error')
  await store.loadProjects({ workspaceId: 'A', allowLocalFallback: false })
  assert.equal(calls.list.length, 2)
})

test('slow cached canvas hydration cannot replace a newer cloud project list', async (t) => {
  const hydration = deferred()
  const { store, storage } = await createHarness(t, {
    hydrate: () => hydration.promise,
    list: async () => ({ data: [row('fresh-cloud-project')] })
  })
  storage.set('ai-canvas-projects-draft-meta:user-1', JSON.stringify([{ id: 'stale-cache-project' }]))
  const cached = store.loadCachedProjects()
  await store.loadProjects({ workspaceId: 'A', allowLocalFallback: false })
  hydration.resolve([])
  await cached
  assert.deepEqual(store.projects.value.map((project) => project.id), ['fresh-cloud-project'])
  assert.equal(store.projectsLoadState.value.source, 'remote')
})

test('canvas cache recovery excludes successful deletions even if a stale summary remains', async (t) => {
  const { store, storage } = await createHarness(t)
  store.projects.value = [{ id: 'p1', permission: 'owner' }]
  await store.deleteProject('p1')
  storage.set('ai-canvas-projects-draft-meta:user-1', JSON.stringify([{ id: 'p1' }]))
  await store.loadCachedProjects()
  assert.deepEqual(store.projects.value, [])
})

test('another workspace response cannot clear deletions while an old request is reused', async (t) => {
  const oldAResponse = deferred()
  const { store, calls, storage } = await createHarness(t, {
    list: ({ workspaceId }) => workspaceId === 'A'
      ? oldAResponse.promise
      : Promise.resolve({ data: [row('p-b', 'B')] })
  })
  store.projects.value = [{ id: 'p-a', workspaceId: 'A', permission: 'owner' }]
  const firstA = store.loadProjects({ workspaceId: 'A', allowLocalFallback: false })
  await store.deleteProject('p-a')
  await store.loadProjects({ workspaceId: 'B', allowLocalFallback: false })
  const latestA = store.loadProjects({ workspaceId: 'A', allowLocalFallback: false })
  assert.deepEqual(calls.list, [['user-1', 'A'], ['user-1', 'B']])
  oldAResponse.resolve({ data: [row('p-a', 'A')] })
  await Promise.all([firstA, latestA])
  assert.deepEqual(store.projects.value, [])
  assert.deepEqual(JSON.parse(storage.get('ai-canvas-projects-deleted:user-1')), ['p-a'])
})

test('deletion completing after a user switch only marks and cleans the original user scope', async (t) => {
  const deletion = deferred()
  const { store, user, storage, drafts, calls } = await createHarness(t, { delete: () => deletion.promise })
  const oldCacheKey = 'ai-canvas-projects-draft-meta:user-1'
  const newCacheKey = 'ai-canvas-projects-draft-meta:user-2'
  storage.set(oldCacheKey, JSON.stringify([{ id: 'p1' }]))
  storage.set(newCacheKey, JSON.stringify([{ id: 'new-user-project' }]))
  store.projects.value = [{ id: 'p1', permission: 'owner' }]
  const pending = store.deleteProject('p1')
  user.value = { id: 'user-2' }
  store.projects.value = [{ id: 'new-user-project', permission: 'owner' }]
  drafts.set('new-user-project', { canvasData: { nodes: [] } })
  deletion.resolve({})
  await pending
  assert.deepEqual(store.projects.value.map((project) => project.id), ['new-user-project'])
  assert.equal(storage.has('ai-canvas-projects-deleted:user-2'), false)
  assert.deepEqual(JSON.parse(storage.get('ai-canvas-projects-deleted:user-1')), ['p1'])
  assert.deepEqual(JSON.parse(storage.get(newCacheKey)), [{ id: 'new-user-project' }])
  assert.equal(drafts.has('new-user-project'), true)
  assert.deepEqual(calls.deleted, [['user-1', 'p1']])
  user.value = { id: 'user-1' }
  store.projects.value = []
  await store.loadCachedProjects()
  assert.deepEqual(store.projects.value, [])
})

test('default workspace refresh never reuses a request started before the active workspace changed', async (t) => {
  const oldDefaultResponse = deferred()
  let defaultRequests = 0
  const { store, calls } = await createHarness(t, {
    list: ({ workspaceId }) => {
      if (workspaceId === 'B') return Promise.resolve({ data: [row('p-b', 'B')] })
      defaultRequests += 1
      return defaultRequests === 1
        ? oldDefaultResponse.promise
        : Promise.resolve({ data: [row('p-b', 'B')] })
    }
  })
  const oldDefault = store.loadProjects({ allowLocalFallback: false })
  await store.loadProjects({ workspaceId: 'B', allowLocalFallback: false })
  const newDefault = store.loadProjects({ allowLocalFallback: false })
  assert.deepEqual(calls.list, [['user-1', ''], ['user-1', 'B'], ['user-1', '']])
  oldDefaultResponse.resolve({ data: [row('p-a', 'A')] })
  await Promise.all([oldDefault, newDefault])
  assert.deepEqual(store.projects.value.map((project) => project.id), ['p-b'])
})
