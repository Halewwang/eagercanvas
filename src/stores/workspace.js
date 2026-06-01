import { ref } from 'vue'
import {
  apiGetCurrentWorkspace,
  apiGetProjectTemplateStatus,
  apiListFeaturedTemplates,
  apiPublishProjectTemplate,
  apiUnpublishProjectTemplate,
  apiUseSharedTemplate
} from '@/api/workspace'
import { createLocalProjectFromTemplate } from '@/stores/projects'
import { isLocalPreviewEnabled } from '@/utils/localPreview'
import {
  getLocalPreviewTemplateById,
  getLocalPreviewTemplates,
  getLocalPreviewWorkspace
} from './workspacePreviewData.js'

export const currentWorkspace = ref(null)
export const featuredTemplates = ref([])
const BYPASS_AUTH_IN_DEV = isLocalPreviewEnabled()

const normalizeWorkspace = (workspace) => {
  if (!workspace) return null
  return {
    id: workspace.id,
    slug: workspace.slug,
    name: workspace.name,
    role: workspace.role || 'member'
  }
}

const normalizeTemplate = (template) => {
  if (!template) return null
  return {
    id: template.id,
    workspaceId: template.workspaceId,
    sourceProjectId: template.sourceProjectId,
    ownerUserId: template.ownerUserId,
    ownerDisplayName: template.ownerDisplayName || 'Unknown user',
    title: template.title,
    description: template.description || '',
    coverUrl: template.coverUrl || '',
    canvasData: template.canvasData || null,
    isPublished: !!template.isPublished,
    publishedAt: template.publishedAt || null,
    createdAt: template.createdAt || null,
    updatedAt: template.updatedAt || null
  }
}

export const loadCurrentWorkspace = async () => {
  if (BYPASS_AUTH_IN_DEV) {
    currentWorkspace.value = getLocalPreviewWorkspace()
    return currentWorkspace.value
  }

  const response = await apiGetCurrentWorkspace()
  currentWorkspace.value = normalizeWorkspace(response?.data || null)
  return currentWorkspace.value
}

export const loadFeaturedTemplates = async () => {
  if (BYPASS_AUTH_IN_DEV) {
    currentWorkspace.value = getLocalPreviewWorkspace()
    featuredTemplates.value = getLocalPreviewTemplates()
    return featuredTemplates.value
  }

  const response = await apiListFeaturedTemplates()
  currentWorkspace.value = normalizeWorkspace(response?.data?.workspace || null)
  featuredTemplates.value = Array.isArray(response?.data?.templates)
    ? response.data.templates.map(normalizeTemplate).filter(Boolean)
    : []
  return featuredTemplates.value
}

export const getProjectTemplateStatus = async (projectId) => {
  const response = await apiGetProjectTemplateStatus(projectId)
  currentWorkspace.value = normalizeWorkspace(response?.data?.workspace || null)
  return normalizeTemplate(response?.data?.template || null)
}

export const publishProjectTemplate = async (projectId, payload) => {
  const response = await apiPublishProjectTemplate(projectId, payload)
  currentWorkspace.value = normalizeWorkspace(response?.data?.workspace || null)
  return normalizeTemplate(response?.data?.template || null)
}

export const unpublishProjectTemplate = async (projectId) => {
  const response = await apiUnpublishProjectTemplate(projectId)
  currentWorkspace.value = normalizeWorkspace(response?.data?.workspace || null)
  return normalizeTemplate(response?.data?.template || null)
}

export const useSharedTemplate = async (templateId) => {
  if (BYPASS_AUTH_IN_DEV) {
    const template = getLocalPreviewTemplateById(templateId)
    currentWorkspace.value = getLocalPreviewWorkspace()
    return createLocalProjectFromTemplate(template)
  }

  const response = await apiUseSharedTemplate(templateId)
  currentWorkspace.value = normalizeWorkspace(response?.data?.workspace || null)
  return response?.data?.project || null
}

export const useWorkspaceStore = () => ({
  currentWorkspace,
  featuredTemplates,
  loadCurrentWorkspace,
  loadFeaturedTemplates,
  getProjectTemplateStatus,
  publishProjectTemplate,
  unpublishProjectTemplate,
  useSharedTemplate
})
