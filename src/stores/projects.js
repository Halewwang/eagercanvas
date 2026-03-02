/**
 * Projects store | 项目状态管理
 * Cloud-first with local draft fallback
 */
import { computed, ref } from 'vue'
import {
  apiCreateProject,
  apiDeleteProject,
  apiListProjects,
  apiPatchProject
} from '@/api/projects'
import { useAuthStore } from '@/stores/auth'

const STORAGE_KEY_PREFIX = 'ai-canvas-projects-draft-cache'

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

const mapProjectFromApi = (row) => ({
  id: row.id,
  name: row.name,
  thumbnail: row.thumbnail_url || '',
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  canvasData: row.canvas_json || { ...defaultCanvasData }
})

const mapProjectToApi = (project) => ({
  name: project.name,
  canvasData: project.canvasData,
  thumbnailUrl: project.thumbnail || null
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

const saveLocalCache = () => {
  const { user, isAuthenticated } = useAuthStore()
  if (!isAuthenticated.value) return
  const userId = user.value?.id
  if (!userId) return
  try {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}:${userId}`, JSON.stringify(projects.value))
  } catch {
    // ignore cache write failures
  }
}

const loadLocalCache = () => {
  const { user, isAuthenticated } = useAuthStore()
  if (!isAuthenticated.value) return []
  const userId = user.value?.id
  if (!userId) return []
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}:${userId}`)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const toTs = (value) => {
  const ts = new Date(value || 0).getTime()
  return Number.isFinite(ts) ? ts : 0
}

const mergeRemoteWithLocalDrafts = (remoteProjects, localProjects) => {
  const localMap = new Map((localProjects || []).map((p) => [p.id, p]))
  const merged = (remoteProjects || []).map((remote) => {
    const local = localMap.get(remote.id)
    if (!local) return remote

    const remoteTs = toTs(remote.updatedAt)
    const localTs = toTs(local.updatedAt)
    // Keep local draft when it is newer than cloud data.
    if (localTs > remoteTs) return local
    return remote
  })

  // Keep local-only drafts when cloud list temporarily misses them.
  const mergedIds = new Set(merged.map((p) => p.id))
  for (const local of localProjects || []) {
    if (!mergedIds.has(local.id)) merged.push(local)
  }

  return merged
}

export const loadProjects = async () => {
  const { isAuthenticated } = useAuthStore()
  if (!isAuthenticated.value) {
    projects.value = []
    return projects.value
  }
  const localDrafts = loadLocalCache()
  try {
    const response = await apiListProjects()
    const remote = (response?.data || []).map(mapProjectFromApi)
    projects.value = mergeRemoteWithLocalDrafts(remote, localDrafts)
    saveLocalCache()
    return projects.value
  } catch (error) {
    projects.value = localDrafts
    return projects.value
  }
}

export const createProject = async (name = 'Untitled') => {
  const payload = {
    name,
    canvasData: { ...defaultCanvasData },
    thumbnailUrl: null
  }

  const response = await apiCreateProject(payload)
  const project = mapProjectFromApi(response.data)
  projects.value = [project, ...projects.value]
  saveLocalCache()
  return project.id
}

export const updateProject = async (id, data) => {
  const index = projects.value.findIndex((p) => p.id === id)
  if (index === -1) return false

  const nextProject = {
    ...projects.value[index],
    ...data,
    updatedAt: new Date().toISOString()
  }

  projects.value[index] = nextProject
  const [updated] = projects.value.splice(index, 1)
  projects.value = [updated, ...projects.value]
  saveLocalCache()

  try {
    const response = await apiPatchProject(id, mapProjectToApi(nextProject))
    const normalized = mapProjectFromApi(response.data)
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

  const next = {
    ...project,
    canvasData: {
      ...project.canvasData,
      ...canvasData
    },
    thumbnail: resolveProjectThumbnail(
      {
        ...project.canvasData,
        ...canvasData
      },
      project.thumbnail
    ),
    // Don't update local timestamp immediately to avoid race conditions with server
    // updatedAt: new Date().toISOString() 
  }

  try {
    const payload = mapProjectToApi(next)
    // Pass currentVersion to API if provided
    if (currentVersion) {
      payload.currentUpdatedAt = currentVersion
    }
    
    const response = await apiPatchProject(id, payload)
    const updatedProject = mapProjectFromApi(response.data)
    
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
  // Return full project to access metadata like updatedAt
  return project ? { ...project.canvasData, _meta: project } : null
}

export const deleteProject = async (id) => {
  projects.value = projects.value.filter((p) => p.id !== id)
  saveLocalCache()
  try {
    await apiDeleteProject(id)
  } catch (error) {
    console.warn('Cloud delete failed:', error?.message)
  }
}

export const duplicateProject = async (id) => {
  const source = projects.value.find((p) => p.id === id)
  if (!source) return null

  return createProject(`${source.name} (Copy)`).then(async (newId) => {
    await updateProject(newId, {
      canvasData: JSON.parse(JSON.stringify(source.canvasData)),
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
