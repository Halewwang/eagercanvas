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

const STORAGE_KEY = 'ai-canvas-projects-draft-cache'

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

const saveLocalCache = () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects.value))
  } catch {
    // ignore cache write failures
  }
}

const loadLocalCache = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export const loadProjects = async () => {
  try {
    const response = await apiListProjects()
    projects.value = (response?.data || []).map(mapProjectFromApi)
    saveLocalCache()
    return projects.value
  } catch (error) {
    projects.value = loadLocalCache()
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

export const updateProjectCanvas = async (id, canvasData) => {
  const project = projects.value.find((p) => p.id === id)
  if (!project) return false

  const next = {
    ...project,
    canvasData: {
      ...project.canvasData,
      ...canvasData
    },
    updatedAt: new Date().toISOString()
  }

  if (canvasData.nodes) {
    // Cover image rule: always use the first generated image in the project.
    const imageNodes = canvasData.nodes
      .filter((node) => node.type === 'image' && node.data?.url)
      .sort((a, b) => {
        const aTime = Number(a.data?.createdAt || a.data?.updatedAt || 0)
        const bTime = Number(b.data?.createdAt || b.data?.updatedAt || 0)
        return aTime - bTime
      })

    if (imageNodes.length > 0) {
      next.thumbnail = imageNodes[0].data.url
    }
  }

  const idx = projects.value.findIndex((p) => p.id === id)
  projects.value[idx] = next
  saveLocalCache()

  try {
    const response = await apiPatchProject(id, mapProjectToApi(next))
    projects.value[idx] = mapProjectFromApi(response.data)
    saveLocalCache()
  } catch (error) {
    console.warn('Cloud autosave failed, local draft kept:', error?.message)
  }

  return true
}

export const getProjectCanvas = (id) => {
  const project = projects.value.find((p) => p.id === id)
  return project?.canvasData || null
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
