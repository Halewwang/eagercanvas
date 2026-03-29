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

const LEGACY_STORAGE_KEY_PREFIX = 'ai-canvas-projects-draft-cache'
const STORAGE_KEY_PREFIX = 'ai-canvas-projects-draft-meta'
const STORAGE_CANVAS_KEY_PREFIX = 'ai-canvas-project-canvas-draft'
const TOMBSTONE_KEY_PREFIX = 'ai-canvas-projects-deleted'
const isLocalPreviewHost = () => {
  if (typeof window === 'undefined') return false
  const host = String(window.location.hostname || '').trim().toLowerCase()
  return host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0'
}

const BYPASS_AUTH_IN_DEV = (import.meta.env.DEV && import.meta.env.VITE_BYPASS_AUTH === 'true') || isLocalPreviewHost()

export const projects = ref([])
export const currentProjectId = ref(null)

export const currentProject = computed(() => {
  return projects.value.find((p) => p.id === currentProjectId.value) || null
})

const defaultCanvasData = {
  nodes: [],
  edges: [],
  viewport: { x: 100, y: 50, zoom: 0.8 }
}

const cloneCanvasData = (canvasData) => JSON.parse(JSON.stringify(canvasData || defaultCanvasData))

const getUserScopedKey = (prefix) => {
  const { user, isAuthenticated } = useAuthStore()
  if (!isAuthenticated.value) return ''
  const userId = user.value?.id
  return userId ? `${prefix}:${userId}` : ''
}

const getProjectCanvasStorageKey = (projectId) => {
  const scopedKey = getUserScopedKey(STORAGE_CANVAS_KEY_PREFIX)
  if (!scopedKey || !projectId) return ''
  return `${scopedKey}:${projectId}`
}

const createLocalProjectRecord = (name = 'Untitled') => {
  const now = new Date().toISOString()
  return {
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    thumbnail: '',
    createdAt: now,
    updatedAt: now,
    serverUpdatedAt: null,
    canvasData: cloneCanvasData(defaultCanvasData)
  }
}

const mapProjectFromApi = (row) => ({
  id: row.id,
  name: row.name,
  thumbnail: row.thumbnail_url || '',
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  serverUpdatedAt: row.updated_at,
  canvasData: Object.prototype.hasOwnProperty.call(row || {}, 'canvas_json')
    ? (row.canvas_json || { ...defaultCanvasData })
    : undefined
})

const mapProjectToApi = (project) => ({
  name: project.name,
  canvasData: project.canvasData,
  // Only persist stable public URLs as project thumbnail.
  // Data URLs can break backend validation and autosave flow.
  thumbnailUrl: /^https?:\/\//i.test(String(project.thumbnail || ''))
    ? String(project.thumbnail)
    : null
})

const getNodeMediaUrl = (node) => {
  const url = String(node?.data?.url || '').trim()
  // Blob URLs are session-scoped and cannot survive refresh.
  if (!url || url.startsWith('blob:')) return ''
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
  serverUpdatedAt: project.serverUpdatedAt || null
})

const saveProjectCanvasDraft = (id, canvasData) => {
  const storageKey = getProjectCanvasStorageKey(id)
  if (!storageKey) return
  try {
    localStorage.setItem(storageKey, JSON.stringify(canvasData || defaultCanvasData))
  } catch {
    // ignore cache write failures
  }
}

const loadProjectCanvasDraft = (id) => {
  const storageKey = getProjectCanvasStorageKey(id)
  if (!storageKey) return null
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object'
      ? {
          ...defaultCanvasData,
          ...parsed
        }
      : null
  } catch {
    return null
  }
}

const removeProjectCanvasDraft = (id) => {
  const storageKey = getProjectCanvasStorageKey(id)
  if (!storageKey) return
  try {
    localStorage.removeItem(storageKey)
  } catch {
    // ignore cache write failures
  }
}

const saveLocalCache = () => {
  const storageKey = getUserScopedKey(STORAGE_KEY_PREFIX)
  if (!storageKey) return
  try {
    const summaries = projects.value.map((project) => toProjectSummary(project))
    localStorage.setItem(storageKey, JSON.stringify(summaries))
  } catch {
    // ignore cache write failures
  }
}

const loadLocalCache = () => {
  const storageKey = getUserScopedKey(STORAGE_KEY_PREFIX)
  const legacyStorageKey = getUserScopedKey(LEGACY_STORAGE_KEY_PREFIX)
  if (!storageKey) return []
  try {
    const raw = localStorage.getItem(storageKey)
    if (raw) {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed)
        ? parsed
            .filter((project) => project?.id)
            .map((project) => toProjectSummary(project))
        : []
    }

    if (!legacyStorageKey) return []

    const legacyRaw = localStorage.getItem(legacyStorageKey)
    if (!legacyRaw) return []
    const legacyParsed = JSON.parse(legacyRaw)
    if (!Array.isArray(legacyParsed)) return []

    const migrated = legacyParsed
      .filter((project) => project?.id)
      .map((project) => {
        if (project.canvasData) {
          saveProjectCanvasDraft(project.id, project.canvasData)
        }
        return toProjectSummary(project)
      })

    localStorage.setItem(storageKey, JSON.stringify(migrated))
    localStorage.removeItem(legacyStorageKey)
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

const hasCanvasContent = (canvasData) => {
  const nodes = Array.isArray(canvasData?.nodes) ? canvasData.nodes.length : 0
  const edges = Array.isArray(canvasData?.edges) ? canvasData.edges.length : 0
  const groups = Array.isArray(canvasData?.groups) ? canvasData.groups.length : 0
  return nodes > 0 || edges > 0 || groups > 0
}

const mergeRemoteProjectWithLocalDraft = (remote, local) => {
  if (!local) return remote

  const remoteTs = toTs(remote.updatedAt)
  const localTs = toTs(local.updatedAt)
  const remoteHasCanvasData = remote.canvasData !== undefined
  const localCanvasData = local.canvasData || loadProjectCanvasDraft(local.id)
  if (localTs <= remoteTs && remoteHasCanvasData) return remote

  const next = {
    ...remote,
    name: String(local.name || '').trim() || remote.name,
    thumbnail: String(local.thumbnail || '').trim() || remote.thumbnail,
    updatedAt: local.updatedAt || remote.updatedAt,
    serverUpdatedAt: remote.serverUpdatedAt || remote.updatedAt || null
  }

  // Keep newer local canvas drafts when they exist.
  // This prevents refresh/detail fetches from discarding unsynced node edits.
  if (remoteHasCanvasData && hasCanvasContent(localCanvasData) && (localTs > remoteTs || !hasCanvasContent(remote.canvasData))) {
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
    return projects.value
  }
  const localDrafts = loadLocalCache()
  if (BYPASS_AUTH_IN_DEV) {
    projects.value = localDrafts
    return projects.value
  }
  try {
    const response = await apiListProjects()
    const tombstones = loadDeleteTombstones()
    const remote = (response?.data || [])
      .map(mapProjectFromApi)
      .filter((project) => !tombstones.has(project.id))
    projects.value = mergeRemoteWithLocalDrafts(remote, localDrafts)
    const nextTombstones = new Set(
      Array.from(tombstones).filter((id) => !remote.some((project) => project.id === id))
    )
    saveDeleteTombstones(nextTombstones)
    saveLocalCache()
    return projects.value
  } catch (error) {
    const tombstones = loadDeleteTombstones()
    projects.value = localDrafts.filter((project) => !tombstones.has(project.id))
    return projects.value
  }
}

export const refreshProjectById = async (id) => {
  if (!id) return null

  const localProject = projects.value.find((project) => project.id === id) || null
  if (BYPASS_AUTH_IN_DEV) {
    if (!localProject) return null
    return {
      ...localProject,
      canvasData: localProject.canvasData || loadProjectCanvasDraft(id) || cloneCanvasData(defaultCanvasData)
    }
  }

  const response = await apiGetProject(id)
  const remoteProject = mapProjectFromApi(response.data)
  const mergedProject = mergeRemoteProjectWithLocalDraft(remoteProject, localProject)
  if (mergedProject?.canvasData) {
    saveProjectCanvasDraft(id, mergedProject.canvasData)
  }
  forgetDeletedProject(id)
  projects.value = [
    mergedProject,
    ...projects.value.filter((project) => project.id !== id)
  ]
  saveLocalCache()
  return mergedProject
}

export const createProject = async (name = 'Untitled') => {
  if (BYPASS_AUTH_IN_DEV) {
    const project = createLocalProjectRecord(name)
    projects.value = [project, ...projects.value]
    saveProjectCanvasDraft(project.id, project.canvasData || defaultCanvasData)
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
  saveProjectCanvasDraft(project.id, project.canvasData || defaultCanvasData)
  saveLocalCache()
  return project.id
}

export const updateProject = async (id, data) => {
  const index = projects.value.findIndex((p) => p.id === id)
  if (index === -1) return false

  const nextProject = {
    ...projects.value[index],
    ...data,
    updatedAt: new Date().toISOString(),
    serverUpdatedAt: projects.value[index].serverUpdatedAt || null
  }

  projects.value[index] = nextProject
  const [updated] = projects.value.splice(index, 1)
  projects.value = [updated, ...projects.value]
  if (Object.prototype.hasOwnProperty.call(data || {}, 'canvasData')) {
    saveProjectCanvasDraft(id, nextProject.canvasData || defaultCanvasData)
  }
  saveLocalCache()

  if (BYPASS_AUTH_IN_DEV) {
    return true
  }

  try {
    const response = await apiPatchProject(id, mapProjectToApi(nextProject))
    const normalized = mapProjectFromApi(response.data)
    if (normalized?.canvasData) {
      saveProjectCanvasDraft(id, normalized.canvasData)
    }
    projects.value = [normalized, ...projects.value.filter((p) => p.id !== id)]
    saveLocalCache()
  } catch (error) {
    console.warn('Remote update failed, kept local draft:', error?.message)
  }

  return true
}

export const updateProjectCanvas = async (id, canvasData, currentVersion = null) => {
  const project = projects.value.find((p) => p.id === id)
  if (!project) return null
  const localUpdatedAt = new Date().toISOString()
  const currentCanvasData = project.canvasData || loadProjectCanvasDraft(id) || cloneCanvasData(defaultCanvasData)

  const next = {
    ...project,
    canvasData: {
      ...currentCanvasData,
      ...canvasData
    },
    thumbnail: resolveProjectThumbnail(
      {
        ...currentCanvasData,
        ...canvasData
      },
      project.thumbnail
    ),
    updatedAt: localUpdatedAt,
    serverUpdatedAt: project.serverUpdatedAt || currentVersion || null
  }

  // Always keep the latest canvas snapshot in local draft cache first.
  // This avoids losing recent nodes on refresh when the remote save fails.
  const localIdx = projects.value.findIndex((p) => p.id === id)
  if (localIdx !== -1) {
    projects.value[localIdx] = next
    saveProjectCanvasDraft(id, next.canvasData)
    saveLocalCache()
  }

  if (BYPASS_AUTH_IN_DEV) {
    return next
  }

  try {
    const payload = mapProjectToApi(next)
    // Pass currentVersion to API if provided
    if (currentVersion) {
      payload.currentUpdatedAt = currentVersion
    }
    
    const response = await apiPatchProject(id, payload)
    const updatedProject = mapProjectFromApi(response.data)
    if (updatedProject?.canvasData) {
      saveProjectCanvasDraft(id, updatedProject.canvasData)
    }
    
    // Update local store with server response
    const idx = projects.value.findIndex((p) => p.id === id)
    if (idx !== -1) {
      projects.value[idx] = updatedProject
    }
    saveLocalCache()
    
    return updatedProject // Return full project object including new updatedAt
  } catch (error) {
    console.warn('Cloud autosave failed:', error?.message)
    throw error // Re-throw to let caller handle conflict
  }
}

export const getProjectCanvas = (id) => {
  const project = projects.value.find((p) => p.id === id)
  const canvasData = project?.canvasData || loadProjectCanvasDraft(id)
  if (!canvasData) return null
  // Return full project to access metadata like updatedAt
  return { ...canvasData, _meta: project || null }
}

export const deleteProject = async (id) => {
  if (BYPASS_AUTH_IN_DEV) {
    projects.value = projects.value.filter((p) => p.id !== id)
    removeProjectCanvasDraft(id)
    saveLocalCache()
    return
  }
  await apiDeleteProject(id)
  rememberDeletedProject(id)
  projects.value = projects.value.filter((p) => p.id !== id)
  removeProjectCanvasDraft(id)
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
