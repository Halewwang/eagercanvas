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
  apiListProjectEditRequests,
  apiPatchProject,
  apiRequestProjectEditAccess,
  apiReviewProjectEditRequest
} from '@/api/projects'
import { useAuthStore } from '@/stores/auth'
import { getCanvasDraftStorage } from '@/stores/canvasDrafts'
import { buildRevisionSavePayload, CANVAS_SYNC_STATES, isConflictError } from '@/stores/canvasSyncStatus'
import { canvasBroadcast } from '@/stores/canvasBroadcast'
import { syncOfflineCanvasDraftRecord } from './canvasOfflineSync.js'
import { isLocalPreviewEnabled } from '@/utils/localPreview'
import {
  cloneProjectCanvasData as cloneCanvasData,
  defaultCanvasData,
  getProjectBaseVersion,
  getProjectCanvasDataKey as getCanvasDataKey,
  hasCanvasContent,
  isPersistedProjectUploadUrl,
  mapProjectFromApi,
  mapProjectToApi,
  mergeCachedProjectSummaries,
  resolveProjectThumbnail,
  sortProjectsByActivity,
  toProjectSummary
} from './projectsData.js'

const LEGACY_STORAGE_KEY_PREFIX = 'ai-canvas-projects-draft-cache'
const STORAGE_KEY_PREFIX = 'ai-canvas-projects-draft-meta'
const TOMBSTONE_KEY_PREFIX = 'ai-canvas-projects-deleted'
const BYPASS_AUTH_IN_DEV = isLocalPreviewEnabled()
let offlineDraftSyncInFlight = null

export const projects = ref([])
export const projectsLoadState = ref({
  source: 'idle',
  reason: '',
  error: null,
  updatedAt: null
})

export const isProjectReadOnly = (project = {}) => project?.permission === 'viewer'

const createReadOnlyProjectError = () => {
  const error = new Error('This project is read-only. Request edit access before making changes.')
  error.code = 'PROJECT_EDIT_PERMISSION_REQUIRED'
  error.status = 403
  return error
}

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

const createLocalProjectRecord = (name = 'Untitled', options = {}) => {
  const now = new Date().toISOString()
  return {
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    thumbnail: String(options.thumbnail || '').trim(),
    createdAt: now,
    updatedAt: now,
    lastOpenedAt: now,
    serverUpdatedAt: null,
    readState: 'local-only',
    canvasData: cloneCanvasData(options.canvasData || defaultCanvasData)
  }
}

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
    thumbnail: isPersistedProjectUploadUrl(localThumbnail) ? localThumbnail : remote.thumbnail,
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

export const loadProjects = async ({ allowLocalFallback = true } = {}) => {
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
    const fallbackError = error?.message || 'Project list unavailable'
    if (!allowLocalFallback) {
      projects.value = []
      projectsLoadState.value = {
        source: 'remote-error',
        reason: 'project-list-unavailable',
        error: fallbackError,
        updatedAt: new Date().toISOString()
      }
      return projects.value
    }

    const tombstones = loadDeleteTombstones()
    projects.value = sortProjectsByActivity(localDrafts)
      .filter((project) => !tombstones.has(project.id))
      .map((project) => ({ ...project, readState: 'local-fallback' }))
    projectsLoadState.value = {
      source: 'local-fallback',
      reason: 'project-list-unavailable',
      error: fallbackError,
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
  const cachedProjects = localDrafts.map((project) => ({
    ...project,
    remoteSynced: isRemoteSyncedDraft(loadProjectCanvasDraftRecord(project.id))
  }))
  projects.value = sortProjectsByActivity(mergeCachedProjectSummaries(cachedProjects, projects.value))
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

export const createLocalProjectFromTemplate = async (template = {}) => {
  if (!BYPASS_AUTH_IN_DEV || !template) return null

  const title = String(template.title || template.name || 'Untitled').trim() || 'Untitled'
  const project = createLocalProjectRecord(title, {
    canvasData: template.canvasData || defaultCanvasData,
    thumbnail: template.coverUrl || template.thumbnail || ''
  })

  projects.value = [project, ...projects.value]
  await saveProjectCanvasDraft(project.id, project.canvasData, {
    draftUpdatedAt: project.updatedAt,
    baseRevision: null,
    remoteSynced: false,
    status: CANVAS_SYNC_STATES.localPersisted
  })
  saveLocalCache()
  return project
}

export const updateProject = async (id, data) => {
  const index = projects.value.findIndex((p) => p.id === id)
  if (index === -1) return false
  const currentProject = projects.value[index]
  if (isProjectReadOnly(currentProject)) {
    throw createReadOnlyProjectError()
  }

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
  if (isProjectReadOnly(project)) {
    return {
      project,
      localSaved: false,
      remoteSynced: false,
      status: 'read-only',
      error: createReadOnlyProjectError()
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
    projects.value = sortProjectsByActivity(projects.value)
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
        projects.value = sortProjectsByActivity(projects.value)
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
      projects.value = sortProjectsByActivity(projects.value)
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

export const syncOfflineCanvasDrafts = async () => {
  if (offlineDraftSyncInFlight) return offlineDraftSyncInFlight

  const runSync = async () => {
    const { isAuthenticated } = useAuthStore()
    const summary = {
      attempted: 0,
      synced: 0,
      preserved: 0,
      failed: 0,
      skipped: 0
    }

    if (!isAuthenticated.value || BYPASS_AUTH_IN_DEV) {
      return summary
    }

    const storage = getDraftStorage()
    if (!storage) return summary

    const draftRecords = await storage.hydrate()
    let changed = false

    for (const draftRecord of draftRecords) {
      const projectId = String(draftRecord?.projectId || '')
      const project = projects.value.find((item) => item.id === projectId)
      if (!project) {
        summary.skipped += 1
        continue
      }
      if (isProjectReadOnly(project)) {
        summary.skipped += 1
        continue
      }

      summary.attempted += 1
      const result = await syncOfflineCanvasDraftRecord({
        project,
        draftRecord,
        patchProject: apiPatchProject,
        saveDraft: (id, record) => saveProjectCanvasDraft(id, record.canvasData, record),
        publishRemoteSynced: (message) => canvasBroadcast.publishRemoteSynced(message)
      })

      if (result.status === CANVAS_SYNC_STATES.synced) summary.synced += 1
      else if (result.status === CANVAS_SYNC_STATES.localPersisted) summary.preserved += 1
      else if (result.status === 'skipped') summary.skipped += 1
      else summary.failed += 1

      if (result.project && result.status !== 'skipped') {
        projects.value = sortProjectsByActivity([
          result.project,
          ...projects.value.filter((item) => item.id !== projectId)
        ])
        changed = true
      }
    }

    if (changed) saveLocalCache()
    return summary
  }

  offlineDraftSyncInFlight = runSync().finally(() => {
    offlineDraftSyncInFlight = null
  })
  return offlineDraftSyncInFlight
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
  const project = projects.value.find((p) => p.id === id)
  if (isProjectReadOnly(project)) {
    throw createReadOnlyProjectError()
  }
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
  if (isProjectReadOnly(source)) {
    throw createReadOnlyProjectError()
  }
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

export const requestProjectEditAccess = async (id, message = '') => {
  const response = await apiRequestProjectEditAccess(id, { message })
  return response?.data?.request || null
}

export const loadProjectEditRequests = async (id) => {
  const response = await apiListProjectEditRequests(id)
  return Array.isArray(response?.data?.requests) ? response.data.requests : []
}

export const reviewProjectEditRequest = async (id, requestId, decision) => {
  const response = await apiReviewProjectEditRequest(id, requestId, { decision })
  return response?.data?.request || null
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
  projects.value = nextList
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

export const initProjectsStore = async (options = {}) => {
  await loadProjects(options)
}

export const useProjectsStore = () => ({
  projects,
  projectsLoadState,
  loadProjects,
  loadCachedProjects,
  refreshProjectById,
  syncOfflineCanvasDrafts,
  createProject,
  createLocalProjectFromTemplate,
  updateProject,
  updateProjectCanvas,
  getProjectCanvas,
  deleteProject,
  duplicateProject,
  renameProject,
  updateProjectThumbnail,
  requestProjectEditAccess,
  loadProjectEditRequests,
  reviewProjectEditRequest,
  markProjectOpened,
  getSortedProjects,
  initProjectsStore
})

if (typeof window !== 'undefined') {
  window.__aiCanvasProjects = {
    projects,
    loadProjects,
    syncOfflineCanvasDrafts,
    createProject,
    deleteProject
  }
}
