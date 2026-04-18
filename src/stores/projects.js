/**
 * Projects store | 项目状态管理
 * Cloud-first with local draft fallback
 */
import { computed, ref } from 'vue'
import {
  apiCreateProject,
  apiDeleteProject,
  apiGetProject,
  apiListProjects,
  apiPatchProject
} from '@/api/projects'
import { useAuthStore } from '@/stores/auth'
import { isPersistedUploadUrl } from '@/utils/media'
import { getCanvasDraftStorage } from '@/stores/canvasDrafts'
import { buildRevisionSavePayload, CANVAS_SYNC_STATES, isConflictError } from '@/stores/canvasSyncStatus'
import { canvasBroadcast } from '@/stores/canvasBroadcast'

const LEGACY_STORAGE_KEY_PREFIX = 'ai-canvas-projects-draft-cache'
const STORAGE_KEY_PREFIX = 'ai-canvas-projects-draft-meta'
const TOMBSTONE_KEY_PREFIX = 'ai-canvas-projects-deleted'
const isLocalPreviewHost = () => {
  if (typeof window === 'undefined') return false
  const host = String(window.location.hostname || '').trim().toLowerCase()
  return host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0'
}

const BYPASS_AUTH_IN_DEV = (import.meta.env.DEV && import.meta.env.VITE_BYPASS_AUTH === 'true') || isLocalPreviewHost()

export const projects = ref([])
export const currentProjectId = ref(null)
export const projectsLoadState = ref({
  source: 'idle',
  reason: '',
  error: null,
  updatedAt: null
})

export const currentProject = computed(() => {
  return projects.value.find((p) => p.id === currentProjectId.value) || null
})

const defaultCanvasData = {
  nodes: [],
  edges: [],
  viewport: { x: 100, y: 50, zoom: 0.8 }
}

const cloneCanvasData = (canvasData) => JSON.parse(JSON.stringify(canvasData || defaultCanvasData))
const getCanvasDataKey = (canvasData) => JSON.stringify(canvasData || defaultCanvasData)

const getUserScopedKey = (prefix) => {
  const { user, isAuthenticated } = useAuthStore()
  if (!isAuthenticated.value) return ''
  const userId = user.value?.id
  return userId ? `${prefix}:${userId}` : ''
}

const getCurrentUserId = () => {
  const { user, isAuthenticated } = useAuthStore()
  if (!isAuthenticated.value) return ''
  return String(user.value?.id || '').trim()
}

const getDraftStorage = () => {
  const userId = getCurrentUserId()
  return userId ? getCanvasDraftStorage(userId) : null
}

const createLocalProjectRecord = (name = 'Untitled') => {
  const now = new Date().toISOString()
  return {
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    thumbnail: '',
    createdAt: now,
    updatedAt: now,
    lastOpenedAt: now,
    serverUpdatedAt: null,
    readState: 'local-only',
    canvasData: cloneCanvasData(defaultCanvasData)
  }
}

const mapProjectFromApi = (row) => ({
  id: row.id,
  name: row.name,
  thumbnail: row.thumbnail_url || '',
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  lastOpenedAt: null,
  serverUpdatedAt: row.updated_at,
  readState: 'remote',
  canvasData: Object.prototype.hasOwnProperty.call(row || {}, 'canvas_json')
    ? (row.canvas_json || { ...defaultCanvasData })
    : undefined
})

const mapProjectToApi = (project) => ({
  name: project.name,
  canvasData: project.canvasData,
  // Only persist stable public URLs as project thumbnail.
  // Data URLs can break backend validation and autosave flow.
  thumbnailUrl: isPersistedUploadUrl(String(project.thumbnail || ''))
    ? String(project.thumbnail)
    : null
})

const getNodeMediaUrl = (node) => {
  const url = String(node?.data?.url || '').trim()
  // Blob URLs are session-scoped and cannot survive refresh.
  if (!url || url.startsWith('blob:')) return ''
  if (!isPersistedUploadUrl(url)) return ''
  return url
}

const getNodeUpdatedTs = (node) => {
  const data = node?.data || {}
  return Math.max(toTs(data.updatedAt), toTs(data.createdAt), 0)
}

const pickLatestNodeUrl = (list) => {
  let latestNode = null
  let latestTs = -1

  for (const node of list) {
    const url = getNodeMediaUrl(node)
    if (!url) continue
    const ts = getNodeUpdatedTs(node)
    if (ts >= latestTs) {
      latestTs = ts
      latestNode = node
    }
  }

  return latestNode ? getNodeMediaUrl(latestNode) : ''
}

const resolveProjectThumbnail = (canvasData, currentThumbnail = '') => {
  const list = Array.isArray(canvasData?.nodes) ? canvasData.nodes : []
  if (list.length === 0) return currentThumbnail || ''

  const imageThumbnail = pickLatestNodeUrl(list.filter((node) => node?.type === 'image'))
  if (imageThumbnail) return imageThumbnail

  const videoThumbnail = pickLatestNodeUrl(list.filter((node) => node?.type === 'video'))
  if (videoThumbnail) return videoThumbnail

  return currentThumbnail || ''
}

const toProjectSummary = (project) => ({
  id: project.id,
  name: project.name,
  thumbnail: project.thumbnail || '',
  createdAt: project.createdAt || new Date().toISOString(),
  updatedAt: project.updatedAt || new Date().toISOString(),
  lastOpenedAt: project.lastOpenedAt || null,
  serverUpdatedAt: project.serverUpdatedAt || null
})

const saveProjectCanvasDraft = async (id, canvasData, options = {}) => {
  const storage = getDraftStorage()
  if (!storage) return false
  try {
    const saved = await storage.saveDraft(id, {
      canvasData: cloneCanvasData(canvasData || defaultCanvasData),
      draftUpdatedAt: options.draftUpdatedAt || new Date().toISOString(),
      baseRevision: options.baseRevision || options.baseVersion || null,
      remoteSynced: options.remoteSynced === true,
      status: options.status || (options.remoteSynced ? CANVAS_SYNC_STATES.synced : CANVAS_SYNC_STATES.localPersisted)
    })
    if (saved) {
      canvasBroadcast.publishDraftSaved({
        projectId: id,
        draftUpdatedAt: options.draftUpdatedAt || new Date().toISOString(),
        baseRevision: options.baseRevision || options.baseVersion || null,
        status: options.status || (options.remoteSynced ? CANVAS_SYNC_STATES.synced : CANVAS_SYNC_STATES.localPersisted),
        remoteSynced: options.remoteSynced === true
      })
    }
    return saved
  } catch {
    return false
  }
}

export const hydrateCanvasDraftCache = async () => {
  const storage = getDraftStorage()
  if (!storage) return []
  await storage.migrateLegacyLocalStorageDrafts()
  return storage.hydrate()
}

const loadProjectCanvasDraftRecord = (id) => {
  const storage = getDraftStorage()
  return storage?.getCachedDraft(id) || null
}

const loadProjectCanvasDraft = (id) => loadProjectCanvasDraftRecord(id)?.canvasData || null

const isRemoteSyncedDraft = (draftRecord) => draftRecord?.remoteSynced === true

const removeProjectCanvasDraft = async (id) => {
  const storage = getDraftStorage()
  if (!storage) return
  try {
    await storage.deleteDraft(id)
  } catch {
    // ignore cache write failures
  }
}

const saveLocalCache = () => {
  const storageKey = getUserScopedKey(STORAGE_KEY_PREFIX)
  if (!storageKey) return false
  try {
    const summaries = projects.value.map((project) => toProjectSummary(project))
    localStorage.setItem(storageKey, JSON.stringify(summaries))
    return true
  } catch {
    return false
  }
}

const loadLocalCache = async () => {
  const storageKey = getUserScopedKey(STORAGE_KEY_PREFIX)
  const legacyStorageKey = getUserScopedKey(LEGACY_STORAGE_KEY_PREFIX)
  if (!storageKey) return []
  try {
    const migrateLegacyProjectCache = async () => {
      if (!legacyStorageKey) return []
      const legacyRaw = localStorage.getItem(legacyStorageKey)
      if (!legacyRaw) return []
      const legacyParsed = JSON.parse(legacyRaw)
      if (!Array.isArray(legacyParsed)) {
        localStorage.removeItem(legacyStorageKey)
        return []
      }

      const migrated = []
      for (const project of legacyParsed.filter((project) => project?.id)) {
        if (project.canvasData) {
          await saveProjectCanvasDraft(project.id, project.canvasData, {
            draftUpdatedAt: project.updatedAt || new Date().toISOString(),
            baseRevision: project.serverUpdatedAt || project.updatedAt || null,
            remoteSynced: false,
            status: CANVAS_SYNC_STATES.localPersisted
          })
        }
        migrated.push(toProjectSummary(project))
      }

      localStorage.removeItem(legacyStorageKey)
      return migrated
    }

    const raw = localStorage.getItem(storageKey)
    if (raw) {
      const parsed = JSON.parse(raw)
      await migrateLegacyProjectCache()
      return Array.isArray(parsed)
        ? parsed
            .filter((project) => project?.id)
            .map((project) => toProjectSummary(project))
        : []
    }

    const migrated = await migrateLegacyProjectCache()
    if (migrated.length === 0) return []

    localStorage.setItem(storageKey, JSON.stringify(migrated))
    return migrated
  } catch {
    return []
  }
}

const loadDeleteTombstones = () => {
  const storageKey = getUserScopedKey(TOMBSTONE_KEY_PREFIX)
  if (!storageKey) return new Set()
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw)
    return new Set(Array.isArray(parsed) ? parsed.filter(Boolean) : [])
  } catch {
    return new Set()
  }
}

const saveDeleteTombstones = (tombstones) => {
  const storageKey = getUserScopedKey(TOMBSTONE_KEY_PREFIX)
  if (!storageKey) return
  try {
    const values = Array.from(tombstones || []).filter(Boolean)
    if (values.length > 0) {
      localStorage.setItem(storageKey, JSON.stringify(values))
    } else {
      localStorage.removeItem(storageKey)
    }
  } catch {
    // ignore cache write failures
  }
}

const rememberDeletedProject = (id) => {
  if (!id) return
  const tombstones = loadDeleteTombstones()
  tombstones.add(id)
  saveDeleteTombstones(tombstones)
}

const forgetDeletedProject = (id) => {
  if (!id) return
  const tombstones = loadDeleteTombstones()
  if (!tombstones.delete(id)) return
  saveDeleteTombstones(tombstones)
}

const toTs = (value) => {
  const ts = new Date(value || 0).getTime()
  return Number.isFinite(ts) ? ts : 0
}

const getProjectActivityTs = (project) => Math.max(
  toTs(project?.lastOpenedAt),
  toTs(project?.updatedAt),
  toTs(project?.createdAt)
)

const sortProjectsByActivity = (list = []) =>
  [...(Array.isArray(list) ? list : [])].sort((a, b) => {
    const delta = getProjectActivityTs(b) - getProjectActivityTs(a)
    if (delta !== 0) return delta
    return toTs(b?.createdAt) - toTs(a?.createdAt)
  })

const hasCanvasContent = (canvasData) => {
  const nodes = Array.isArray(canvasData?.nodes) ? canvasData.nodes.length : 0
  const edges = Array.isArray(canvasData?.edges) ? canvasData.edges.length : 0
  const groups = Array.isArray(canvasData?.groups) ? canvasData.groups.length : 0
  return nodes > 0 || edges > 0 || groups > 0
}

const getProjectBaseVersion = (project, fallbackVersion = null) =>
  String(project?.serverUpdatedAt || fallbackVersion || project?.updatedAt || '').trim() || null

const shouldUseLocalCanvasDraft = (remote, draftRecord) => {
  const localCanvasData = draftRecord?.canvasData
  if (!hasCanvasContent(localCanvasData)) return false

  const remoteHasCanvasData = remote.canvasData !== undefined
  if (!remoteHasCanvasData || !hasCanvasContent(remote.canvasData)) {
    return true
  }

  if (isRemoteSyncedDraft(draftRecord)) return false

  const draftBaseVersion = String(draftRecord?.baseRevision || draftRecord?.baseVersion || '').trim()
  const remoteVersion = getProjectBaseVersion(remote)
  if (!draftBaseVersion || !remoteVersion) return false

  return draftBaseVersion === remoteVersion
}

const mergeRemoteProjectWithLocalDraft = (remote, local, { preferLocalDraft = true } = {}) => {
  if (!local) return remote
  if (!preferLocalDraft) {
    return {
      ...remote,
      lastOpenedAt: local?.lastOpenedAt || remote?.lastOpenedAt || null,
      serverUpdatedAt: remote.serverUpdatedAt || remote.updatedAt || null,
      readState: 'remote'
    }
  }

  const draftRecord = loadProjectCanvasDraftRecord(local.id || remote.id)
  const useLocalCanvasDraft = shouldUseLocalCanvasDraft(remote, draftRecord)
  const localCanvasData = draftRecord?.canvasData || local.canvasData || null
  const localThumbnail = String(local.thumbnail || '').trim()

  const next = {
    ...remote,
    name: String(local.name || '').trim() || remote.name,
    thumbnail: isPersistedUploadUrl(localThumbnail) ? localThumbnail : remote.thumbnail,
    lastOpenedAt: local?.lastOpenedAt || remote?.lastOpenedAt || null,
    updatedAt: useLocalCanvasDraft
      ? (draftRecord?.draftUpdatedAt || local.updatedAt || remote.updatedAt)
      : (local.updatedAt || remote.updatedAt),
    serverUpdatedAt: remote.serverUpdatedAt || remote.updatedAt || null,
    readState: useLocalCanvasDraft ? 'local-draft' : 'remote'
  }

  if (useLocalCanvasDraft && localCanvasData) {
    next.canvasData = localCanvasData
  }

  return next
}

const mergeRemoteWithLocalDrafts = (remoteProjects, localProjects) => {
  const localMap = new Map((localProjects || []).map((p) => [p.id, p]))
  return (remoteProjects || []).map((remote) => {
    const local = localMap.get(remote.id)
    return mergeRemoteProjectWithLocalDraft(remote, local)
  })
}

export const loadProjects = async () => {
  const { isAuthenticated } = useAuthStore()
  if (!isAuthenticated.value) {
    projects.value = []
    projectsLoadState.value = {
      source: 'empty',
      reason: 'unauthenticated',
      error: null,
      updatedAt: new Date().toISOString()
    }
    return projects.value
  }
  await hydrateCanvasDraftCache()
  const localDrafts = await loadLocalCache()
  if (BYPASS_AUTH_IN_DEV) {
    projects.value = sortProjectsByActivity(localDrafts).map((project) => ({ ...project, readState: 'local-only' }))
    projectsLoadState.value = {
      source: 'local-dev',
      reason: 'bypass-auth',
      error: null,
      updatedAt: new Date().toISOString()
    }
    return projects.value
  }
  try {
    const response = await apiListProjects()
    const tombstones = loadDeleteTombstones()
    const remote = (response?.data || [])
      .map(mapProjectFromApi)
      .filter((project) => !tombstones.has(project.id))
    projects.value = sortProjectsByActivity(mergeRemoteWithLocalDrafts(remote, localDrafts))
    const nextTombstones = new Set(
      Array.from(tombstones).filter((id) => !remote.some((project) => project.id === id))
    )
    saveDeleteTombstones(nextTombstones)
    saveLocalCache()
    projectsLoadState.value = {
      source: 'remote',
      reason: '',
      error: null,
      updatedAt: new Date().toISOString()
    }
    return projects.value
  } catch (error) {
    const tombstones = loadDeleteTombstones()
    projects.value = sortProjectsByActivity(localDrafts)
      .filter((project) => !tombstones.has(project.id))
      .map((project) => ({ ...project, readState: 'local-fallback' }))
    projectsLoadState.value = {
      source: 'local-fallback',
      reason: 'project-list-unavailable',
      error: error?.message || 'Project list unavailable',
      updatedAt: new Date().toISOString()
    }
    return projects.value
  }
}

export const loadCachedProjects = async () => {
  const { isAuthenticated } = useAuthStore()
  if (!isAuthenticated.value) return []
  await hydrateCanvasDraftCache()
  const localDrafts = await loadLocalCache()
  if (!localDrafts.length) return []
  projects.value = sortProjectsByActivity(localDrafts).map((project) => ({
    ...project,
    readState: project.readState || 'local-cache'
  }))
  projectsLoadState.value = {
    source: 'local-cache',
    reason: 'immediate-canvas-cache',
    error: null,
    updatedAt: new Date().toISOString()
  }
  return projects.value
}

export const refreshProjectById = async (id, options = {}) => {
  if (!id) return null
  const preferLocalDraft = options.preferLocalDraft !== false

  const localProject = projects.value.find((project) => project.id === id) || null
  if (BYPASS_AUTH_IN_DEV) {
    if (!localProject) return null
    return {
      ...localProject,
      readState: localProject.readState || 'local-draft',
      canvasData: localProject.canvasData || loadProjectCanvasDraft(id) || cloneCanvasData(defaultCanvasData)
    }
  }

  try {
    const response = await apiGetProject(id)
    const remoteProject = mapProjectFromApi(response.data)
    const mergedProject = mergeRemoteProjectWithLocalDraft(remoteProject, localProject, { preferLocalDraft })
    if (mergedProject?.canvasData && mergedProject.readState !== 'local-draft') {
      await saveProjectCanvasDraft(id, mergedProject.canvasData, {
        draftUpdatedAt: mergedProject.updatedAt || new Date().toISOString(),
        baseRevision: getProjectBaseVersion(mergedProject),
        remoteSynced: true,
        status: CANVAS_SYNC_STATES.synced
      })
    }
    forgetDeletedProject(id)
    projects.value = sortProjectsByActivity([
      mergedProject,
      ...projects.value.filter((project) => project.id !== id)
    ])
    saveLocalCache()
    projectsLoadState.value = {
      source: 'remote',
      reason: '',
      error: null,
      updatedAt: new Date().toISOString()
    }
    return mergedProject
  } catch (error) {
    if (!localProject) throw error

    const fallbackProject = {
      ...localProject,
      readState: 'local-fallback',
      canvasData: localProject.canvasData || loadProjectCanvasDraft(id) || cloneCanvasData(defaultCanvasData),
      loadSource: 'local-fallback'
    }

    projectsLoadState.value = {
      source: 'local-fallback',
      reason: 'project-refresh-unavailable',
      error: error?.message || 'Project detail unavailable',
      updatedAt: new Date().toISOString()
    }
    return fallbackProject
  }
}

export const createProject = async (name = 'Untitled') => {
  if (BYPASS_AUTH_IN_DEV) {
    const project = createLocalProjectRecord(name)
    projects.value = [project, ...projects.value]
    await saveProjectCanvasDraft(project.id, project.canvasData || defaultCanvasData, {
      draftUpdatedAt: project.updatedAt,
      baseRevision: null,
      remoteSynced: false,
      status: CANVAS_SYNC_STATES.localPersisted
    })
    saveLocalCache()
    return project.id
  }

  const payload = {
    name,
    canvasData: { ...defaultCanvasData },
    thumbnailUrl: null
  }

  const response = await apiCreateProject(payload)
  const project = mapProjectFromApi(response.data)
  forgetDeletedProject(project.id)
  projects.value = [project, ...projects.value]
  await saveProjectCanvasDraft(project.id, project.canvasData || defaultCanvasData, {
    draftUpdatedAt: project.updatedAt || new Date().toISOString(),
    baseRevision: getProjectBaseVersion(project),
    remoteSynced: true,
    status: CANVAS_SYNC_STATES.synced
  })
  saveLocalCache()
  return project.id
}

export const updateProject = async (id, data) => {
  const index = projects.value.findIndex((p) => p.id === id)
  if (index === -1) return false
  const currentProject = projects.value[index]

  const nextProject = {
    ...currentProject,
    ...data,
    updatedAt: new Date().toISOString(),
    serverUpdatedAt: currentProject.serverUpdatedAt || null
  }

  projects.value[index] = nextProject
  const [updated] = projects.value.splice(index, 1)
  projects.value = [updated, ...projects.value]
  if (Object.prototype.hasOwnProperty.call(data || {}, 'canvasData')) {
    await saveProjectCanvasDraft(id, nextProject.canvasData || defaultCanvasData, {
      draftUpdatedAt: nextProject.updatedAt,
      baseRevision: getProjectBaseVersion(currentProject),
      remoteSynced: false,
      status: CANVAS_SYNC_STATES.localPersisted
    })
  }
  saveLocalCache()

  if (BYPASS_AUTH_IN_DEV) {
    return true
  }

  try {
    const response = await apiPatchProject(id, mapProjectToApi(nextProject))
    const normalized = mapProjectFromApi(response.data)
    const mergedNormalized = {
      ...normalized,
      lastOpenedAt: currentProject?.lastOpenedAt || normalized?.lastOpenedAt || null
    }
    if (mergedNormalized?.canvasData) {
      await saveProjectCanvasDraft(id, mergedNormalized.canvasData, {
        draftUpdatedAt: mergedNormalized.updatedAt || new Date().toISOString(),
        baseRevision: getProjectBaseVersion(mergedNormalized),
        remoteSynced: true,
        status: CANVAS_SYNC_STATES.synced
      })
    }
    projects.value = [mergedNormalized, ...projects.value.filter((p) => p.id !== id)]
    saveLocalCache()
  } catch (error) {
    console.warn('Remote update failed, kept local draft:', error?.message)
    projects.value = projects.value.map((project) => (
      project.id === id
        ? { ...project, readState: 'local-draft' }
        : project
    ))
  }

  return true
}

const normalizeCanvasUpdatePayload = (value) => {
  if (value && typeof value === 'object' && (Object.prototype.hasOwnProperty.call(value, 'localCanvasData') || Object.prototype.hasOwnProperty.call(value, 'remoteCanvasData'))) {
    const localCanvasData = cloneCanvasData(value.localCanvasData || value.remoteCanvasData || defaultCanvasData)
    const remoteCanvasData = cloneCanvasData(value.remoteCanvasData || value.localCanvasData || defaultCanvasData)
    return {
      localCanvasData,
      remoteCanvasData,
      hasTransientMedia: value.hasTransientMedia === true
    }
  }

  const nextCanvasData = cloneCanvasData(value || defaultCanvasData)
  return {
    localCanvasData: nextCanvasData,
    remoteCanvasData: nextCanvasData,
    hasTransientMedia: false
  }
}

export const updateProjectCanvas = async (id, canvasData, currentVersion = null, options = {}) => {
  const project = projects.value.find((p) => p.id === id)
  if (!project) {
    return {
      project: null,
      localSaved: false,
      remoteSynced: false,
      status: 'missing'
    }
  }

  const {
    localCanvasData,
    remoteCanvasData,
    hasTransientMedia
  } = normalizeCanvasUpdatePayload(canvasData)

  const localUpdatedAt = new Date().toISOString()
  const currentCanvasData = project.canvasData || loadProjectCanvasDraft(id) || cloneCanvasData(defaultCanvasData)
  const nextLocalCanvasData = {
    ...currentCanvasData,
    ...localCanvasData
  }
  const nextRemoteCanvasData = {
    ...currentCanvasData,
    ...remoteCanvasData
  }
  const keepLocalDraftAfterRemoteSave = hasTransientMedia || getCanvasDataKey(nextLocalCanvasData) !== getCanvasDataKey(nextRemoteCanvasData)

  const next = {
    ...project,
    canvasData: nextLocalCanvasData,
    thumbnail: resolveProjectThumbnail(
      nextLocalCanvasData,
      project.thumbnail
    ),
    updatedAt: localUpdatedAt,
    serverUpdatedAt: project.serverUpdatedAt || currentVersion || null,
    readState: 'local-draft'
  }

  // Always keep the latest canvas snapshot in local draft cache first.
  // This avoids losing recent nodes on refresh when the remote save fails.
  const localIdx = projects.value.findIndex((p) => p.id === id)
  let localDraftSaved = false
  let localMetaSaved = false
  if (localIdx !== -1) {
    projects.value[localIdx] = next
    localDraftSaved = await saveProjectCanvasDraft(id, next.canvasData, {
      draftUpdatedAt: localUpdatedAt,
      baseRevision: getProjectBaseVersion(project, currentVersion),
      remoteSynced: false,
      status: CANVAS_SYNC_STATES.localPersisted
    })
    localMetaSaved = saveLocalCache()
  }
  const localSaved = localDraftSaved && localMetaSaved

  if (BYPASS_AUTH_IN_DEV) {
    return {
      project: next,
      localSaved,
      remoteSynced: false,
      status: localSaved ? CANVAS_SYNC_STATES.localPersisted : CANVAS_SYNC_STATES.failed
    }
  }

  try {
    const payload = buildRevisionSavePayload({
      ...mapProjectToApi({
        ...next,
        canvasData: nextRemoteCanvasData,
        thumbnail: resolveProjectThumbnail(nextRemoteCanvasData, next.thumbnail)
      }),
      baseRevision: currentVersion,
      forceOverwrite: options.forceOverwrite === true
    })
    
    const response = await apiPatchProject(id, payload)
    const updatedProject = {
      ...mapProjectFromApi(response.data),
      lastOpenedAt: project?.lastOpenedAt || null
    }
    let remoteDraftSaved = false
    if (updatedProject?.canvasData) {
      remoteDraftSaved = await saveProjectCanvasDraft(id, updatedProject.canvasData, {
        draftUpdatedAt: updatedProject.updatedAt || new Date().toISOString(),
        baseRevision: getProjectBaseVersion(updatedProject),
        remoteSynced: true,
        status: CANVAS_SYNC_STATES.synced
      })
    }

    if (keepLocalDraftAfterRemoteSave) {
      const mergedProject = {
        ...updatedProject,
        canvasData: next.canvasData,
        thumbnail: next.thumbnail || updatedProject.thumbnail,
        updatedAt: localUpdatedAt,
        serverUpdatedAt: getProjectBaseVersion(updatedProject),
        readState: 'local-draft'
      }
      const idx = projects.value.findIndex((p) => p.id === id)
      if (idx !== -1) {
        projects.value[idx] = mergedProject
      }
      const mergedDraftSaved = await saveProjectCanvasDraft(id, next.canvasData, {
        draftUpdatedAt: localUpdatedAt,
        baseRevision: getProjectBaseVersion(updatedProject),
        remoteSynced: false,
        status: CANVAS_SYNC_STATES.localPersisted
      })
      const mergedMetaSaved = saveLocalCache()

      return {
        project: mergedProject,
        localSaved: mergedDraftSaved && mergedMetaSaved,
        remoteSynced: false,
        status: CANVAS_SYNC_STATES.localPersisted
      }
    }

    // Update local store with server response
    const idx = projects.value.findIndex((p) => p.id === id)
    if (idx !== -1) {
      projects.value[idx] = updatedProject
    }
    const remoteMetaSaved = saveLocalCache()
    const finalLocalSaved = localSaved || (remoteDraftSaved && remoteMetaSaved)
    
    return {
      project: updatedProject,
      localSaved: finalLocalSaved,
      remoteSynced: true,
      status: finalLocalSaved ? CANVAS_SYNC_STATES.synced : CANVAS_SYNC_STATES.failed
    }
  } catch (error) {
    if (isConflictError(error)) {
      console.warn('Cloud autosave conflicted:', error?.message)
      throw error
    }
    console.warn('Cloud autosave failed, kept local draft:', error?.message)
    return {
      project: next,
      localSaved,
      remoteSynced: false,
      status: localSaved ? CANVAS_SYNC_STATES.offline : CANVAS_SYNC_STATES.failed,
      error
    }
  }
}

export const getProjectCanvas = (id) => {
  const project = projects.value.find((p) => p.id === id) || null
  const draftRecord = loadProjectCanvasDraftRecord(id)
  const preferDraftCanvas = draftRecord?.canvasData && project?.readState === 'local-draft'
  const canvasData = preferDraftCanvas
    ? draftRecord?.canvasData
    : (project?.canvasData || draftRecord?.canvasData || null)
  if (!canvasData) return null

  const loadSource = preferDraftCanvas
    ? 'local-draft'
    : project?.canvasData
    ? (project.readState || 'remote')
    : (projectsLoadState.value.source === 'local-fallback' ? 'local-fallback' : 'local-draft')

  return {
    ...canvasData,
    _meta: {
      ...(project || {}),
      readState: project?.readState || loadSource,
      loadSource,
      draftUpdatedAt: draftRecord?.draftUpdatedAt || null,
      draftBaseVersion: draftRecord?.baseRevision || draftRecord?.baseVersion || null,
      remoteSynced: isRemoteSyncedDraft(draftRecord)
    }
  }
}

export const deleteProject = async (id) => {
  if (BYPASS_AUTH_IN_DEV) {
    projects.value = projects.value.filter((p) => p.id !== id)
    await removeProjectCanvasDraft(id)
    saveLocalCache()
    return
  }
  await apiDeleteProject(id)
  rememberDeletedProject(id)
  projects.value = projects.value.filter((p) => p.id !== id)
  await removeProjectCanvasDraft(id)
  saveLocalCache()
}

export const duplicateProject = async (id) => {
  const source = projects.value.find((p) => p.id === id)
  if (!source) return null
  const sourceCanvas = getProjectCanvas(id)
  const nextCanvas = sourceCanvas
    ? {
        nodes: sourceCanvas.nodes || [],
        edges: sourceCanvas.edges || [],
        groups: sourceCanvas.groups || [],
        viewport: sourceCanvas.viewport || defaultCanvasData.viewport
      }
    : cloneCanvasData(defaultCanvasData)

  return createProject(`${source.name} (Copy)`).then(async (newId) => {
    await updateProject(newId, {
      canvasData: cloneCanvasData(nextCanvas),
      thumbnail: source.thumbnail
    })
    return newId
  })
}

export const renameProject = async (id, name) => {
  return updateProject(id, { name })
}

export const updateProjectThumbnail = async (id, thumbnail) => {
  return updateProject(id, { thumbnail })
}

export const markProjectOpened = (id, openedAt = new Date().toISOString()) => {
  const index = projects.value.findIndex((project) => project.id === id)
  if (index === -1) return false

  const next = {
    ...projects.value[index],
    lastOpenedAt: openedAt
  }
  const nextList = [...projects.value]
  nextList[index] = next
  projects.value = sortProjectsByActivity(nextList)
  saveLocalCache()
  return true
}

export const getSortedProjects = (sortBy = 'updatedAt', order = 'desc') => {
  return computed(() => {
    const sorted = [...projects.value]
    sorted.sort((a, b) => {
      let valueA = a[sortBy]
      let valueB = b[sortBy]

      if (typeof valueA === 'string') {
        valueA = valueA.toLowerCase()
        valueB = valueB.toLowerCase()
      }

      if (order === 'asc') return valueA > valueB ? 1 : -1
      return valueA < valueB ? 1 : -1
    })
    return sorted
  })
}

export const initProjectsStore = async () => {
  await loadProjects()
}

if (typeof window !== 'undefined') {
  window.__aiCanvasProjects = {
    projects,
    loadProjects,
    createProject,
    deleteProject
  }
}
