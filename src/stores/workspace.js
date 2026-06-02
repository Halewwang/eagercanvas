import { ref } from 'vue'
import {
  apiAcceptWorkspaceInvite,
  apiCreateTeamWorkspace,
  apiCreateWorkspaceDirectInvite,
  apiCreateWorkspaceInviteLink,
  apiFavoriteSharedTemplate,
  apiGetCurrentWorkspace,
  apiGetProjectTemplateStatus,
  apiJoinWorkspaceInvite,
  apiLeaveWorkspace,
  apiListFeaturedTemplates,
  apiListPendingWorkspaceInvites,
  apiListWorkspaceMembers,
  apiListWorkspaces,
  apiPublishProjectTemplate,
  apiSelectWorkspace,
  apiUnfavoriteSharedTemplate,
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
export const workspaces = ref([])
export const featuredTemplates = ref([])
export const pendingWorkspaceInvites = ref([])
export const templatesScope = ref('auto')
const BYPASS_AUTH_IN_DEV = isLocalPreviewEnabled()
let localPreviewActiveWorkspace = null
let localPreviewWorkspaces = null
let localPreviewInviteCounter = 0

const slugifyWorkspaceName = (value = '') => {
  const slug = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
  return slug || 'workspace'
}

const normalizeWorkspace = (workspace) => {
  if (!workspace) return null
  return {
    id: workspace.id,
    slug: workspace.slug,
    name: workspace.name,
    kind: workspace.kind || 'team',
    role: workspace.role || 'member',
    avatarUrl: workspace.avatarUrl || workspace.avatar_url || '',
    memberCount: Number(workspace.memberCount || workspace.member_count || 0)
  }
}

const normalizeTemplate = (template) => {
  if (!template) return null
  return {
    id: template.id,
    workspaceId: template.workspaceId,
    workspaceKind: template.workspaceKind || '',
    sourceProjectId: template.sourceProjectId,
    ownerUserId: template.ownerUserId,
    ownerDisplayName: template.ownerDisplayName || 'Unknown user',
    ownerAvatarUrl: template.ownerAvatarUrl || '',
    title: template.title,
    description: template.description || '',
    coverUrl: template.coverUrl || '',
    canvasData: template.canvasData || null,
    isPublished: !!template.isPublished,
    isFavorite: !!template.isFavorite,
    publishedAt: template.publishedAt || null,
    createdAt: template.createdAt || null,
    updatedAt: template.updatedAt || null
  }
}

const normalizeInvite = (invite) => ({
  id: invite?.id || '',
  workspace: normalizeWorkspace(invite?.workspace || null),
  createdBy: invite?.createdBy || '',
  expiresAt: invite?.expiresAt || '',
  createdAt: invite?.createdAt || ''
})

const ensureLocalPreviewWorkspaceState = () => {
  if (!localPreviewWorkspaces) {
    const personalWorkspace = {
      ...getLocalPreviewWorkspace(),
      kind: 'personal',
      role: 'owner',
      avatarUrl: getLocalPreviewWorkspace().avatarUrl || '',
      memberCount: 1
    }
    localPreviewActiveWorkspace = personalWorkspace
    localPreviewWorkspaces = [personalWorkspace]
  }

  currentWorkspace.value = localPreviewActiveWorkspace
  workspaces.value = localPreviewWorkspaces
  return {
    activeWorkspace: localPreviewActiveWorkspace,
    workspaces: localPreviewWorkspaces
  }
}

const setLocalPreviewActiveWorkspace = (workspaceId) => {
  const state = ensureLocalPreviewWorkspaceState()
  const nextWorkspace = state.workspaces.find((workspace) => workspace.id === workspaceId)
  if (nextWorkspace) {
    localPreviewActiveWorkspace = nextWorkspace
    currentWorkspace.value = nextWorkspace
  }
  return currentWorkspace.value
}

const createLocalPreviewInviteUrl = (workspaceId = currentWorkspace.value?.id) => {
  localPreviewInviteCounter += 1
  const origin = globalThis.location?.origin || 'http://localhost:5174'
  const token = `local-preview-${workspaceId || 'workspace'}-${localPreviewInviteCounter}`
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  return {
    invite: {
      id: `local-invite-${localPreviewInviteCounter}`,
      workspaceId,
      inviteType: 'link',
      expiresAt
    },
    token,
    inviteUrl: `${origin}/workspace/join/${encodeURIComponent(token)}`
  }
}

const applyWorkspaceCollection = (payload = {}) => {
  const active = normalizeWorkspace(payload.activeWorkspace || payload.active_workspace || payload.workspace || payload)
  if (active) currentWorkspace.value = active
  if (Array.isArray(payload.workspaces)) {
    workspaces.value = payload.workspaces.map(normalizeWorkspace).filter(Boolean)
  } else if (active && !workspaces.value.some((item) => item.id === active.id)) {
    workspaces.value = [active, ...workspaces.value]
  }
  return currentWorkspace.value
}

export const loadCurrentWorkspace = async () => {
  if (BYPASS_AUTH_IN_DEV) {
    return ensureLocalPreviewWorkspaceState().activeWorkspace
  }

  const response = await apiGetCurrentWorkspace()
  currentWorkspace.value = normalizeWorkspace(response?.data || null)
  if (currentWorkspace.value && !workspaces.value.length) {
    workspaces.value = [currentWorkspace.value]
  }
  return currentWorkspace.value
}

export const loadWorkspaces = async () => {
  if (BYPASS_AUTH_IN_DEV) {
    return ensureLocalPreviewWorkspaceState().workspaces
  }

  const response = await apiListWorkspaces()
  applyWorkspaceCollection(response?.data || {})
  return workspaces.value
}

export const createTeamWorkspace = async (payload = {}) => {
  if (BYPASS_AUTH_IN_DEV) {
    const state = ensureLocalPreviewWorkspaceState()
    const name = String(payload?.name || '').trim() || 'Workspace'
    const baseSlug = slugifyWorkspaceName(name)
    let slug = baseSlug
    let attempt = 2
    while (state.workspaces.some((workspace) => workspace.slug === slug)) {
      slug = `${baseSlug}-${attempt}`
      attempt += 1
    }
    const workspace = {
      id: `local-preview-team-${slug}`,
      slug,
      name,
      kind: 'team',
      role: 'owner',
      avatarUrl: payload?.avatarUrl || '',
      memberCount: 1
    }
    localPreviewWorkspaces = [...state.workspaces, workspace]
    localPreviewActiveWorkspace = workspace
    currentWorkspace.value = workspace
    workspaces.value = localPreviewWorkspaces
    return currentWorkspace.value
  }

  const response = await apiCreateTeamWorkspace(payload)
  applyWorkspaceCollection(response?.data || {})
  return currentWorkspace.value
}

export const selectWorkspace = async (workspaceId) => {
  if (BYPASS_AUTH_IN_DEV) {
    return setLocalPreviewActiveWorkspace(workspaceId)
  }

  const response = await apiSelectWorkspace(workspaceId)
  applyWorkspaceCollection(response?.data || {})
  return currentWorkspace.value
}

export const loadWorkspaceMembers = async (workspaceId = currentWorkspace.value?.id) => {
  if (!workspaceId) return []
  if (BYPASS_AUTH_IN_DEV) {
    return [
      {
        userId: 'dev-bypass-user',
        role: 'owner',
        displayName: 'Local Preview',
        username: 'local-preview',
        email: 'preview@local.dev',
        avatarUrl: '',
        joinedAt: new Date().toISOString()
      }
    ]
  }

  const response = await apiListWorkspaceMembers(workspaceId)
  return Array.isArray(response?.data?.members) ? response.data.members : []
}

export const createWorkspaceInviteLink = async (workspaceId = currentWorkspace.value?.id) => {
  if (!workspaceId) return null
  if (BYPASS_AUTH_IN_DEV) {
    return createLocalPreviewInviteUrl(workspaceId)
  }

  const response = await apiCreateWorkspaceInviteLink(workspaceId)
  return response?.data || null
}

export const createWorkspaceDirectInvite = async (workspaceId = currentWorkspace.value?.id, invitee = '') => {
  if (!workspaceId) return null
  if (BYPASS_AUTH_IN_DEV) {
    localPreviewInviteCounter += 1
    return {
      workspace: currentWorkspace.value,
      invite: {
        id: `local-direct-invite-${localPreviewInviteCounter}`,
        workspaceId,
        inviteType: 'direct',
        invitee,
        status: 'pending',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      }
    }
  }

  const response = await apiCreateWorkspaceDirectInvite(workspaceId, { invitee })
  return response?.data || null
}

export const joinWorkspaceInvite = async (token) => {
  if (BYPASS_AUTH_IN_DEV) {
    const state = ensureLocalPreviewWorkspaceState()
    const workspace = {
      id: `local-joined-${String(token || 'workspace').slice(0, 24)}`,
      slug: slugifyWorkspaceName(`joined-${token}`),
      name: 'Joined Preview Workspace',
      kind: 'team',
      role: 'member',
      avatarUrl: '',
      memberCount: 2
    }
    localPreviewWorkspaces = state.workspaces.some((item) => item.id === workspace.id)
      ? state.workspaces
      : [...state.workspaces, workspace]
    localPreviewActiveWorkspace = workspace
    currentWorkspace.value = workspace
    workspaces.value = localPreviewWorkspaces
    return currentWorkspace.value
  }

  const response = await apiJoinWorkspaceInvite(token)
  applyWorkspaceCollection(response?.data || {})
  return currentWorkspace.value
}

export const loadPendingWorkspaceInvites = async () => {
  if (BYPASS_AUTH_IN_DEV) {
    pendingWorkspaceInvites.value = []
    return pendingWorkspaceInvites.value
  }

  const response = await apiListPendingWorkspaceInvites()
  pendingWorkspaceInvites.value = Array.isArray(response?.data?.invites)
    ? response.data.invites.map(normalizeInvite).filter((invite) => invite.id)
    : []
  return pendingWorkspaceInvites.value
}

export const acceptWorkspaceInvite = async (inviteId) => {
  if (BYPASS_AUTH_IN_DEV) {
    return currentWorkspace.value
  }

  const response = await apiAcceptWorkspaceInvite(inviteId)
  applyWorkspaceCollection(response?.data || {})
  pendingWorkspaceInvites.value = pendingWorkspaceInvites.value.filter((invite) => invite.id !== inviteId)
  return currentWorkspace.value
}

export const leaveWorkspace = async (workspaceId = currentWorkspace.value?.id, payload = {}) => {
  if (!workspaceId) return null
  if (BYPASS_AUTH_IN_DEV) {
    const state = ensureLocalPreviewWorkspaceState()
    localPreviewWorkspaces = state.workspaces.filter((workspace) => (
      workspace.kind !== 'team' || workspace.id !== workspaceId
    ))
    localPreviewActiveWorkspace = localPreviewWorkspaces.find((workspace) => workspace.kind === 'personal') || localPreviewWorkspaces[0]
    currentWorkspace.value = localPreviewActiveWorkspace
    workspaces.value = localPreviewWorkspaces
    return currentWorkspace.value
  }

  const response = await apiLeaveWorkspace(workspaceId, payload)
  applyWorkspaceCollection(response?.data || {})
  return currentWorkspace.value
}

export const loadFeaturedTemplates = async (scope = 'auto') => {
  templatesScope.value = scope || 'auto'
  if (BYPASS_AUTH_IN_DEV) {
    ensureLocalPreviewWorkspaceState()
    featuredTemplates.value = getLocalPreviewTemplates()
    return featuredTemplates.value
  }

  const response = await apiListFeaturedTemplates(templatesScope.value === 'auto' ? {} : { scope: templatesScope.value })
  currentWorkspace.value = normalizeWorkspace(response?.data?.workspace || currentWorkspace.value)
  templatesScope.value = response?.data?.scope || templatesScope.value
  featuredTemplates.value = Array.isArray(response?.data?.templates)
    ? response.data.templates.map(normalizeTemplate).filter(Boolean)
    : []
  return featuredTemplates.value
}

export const getProjectTemplateStatus = async (projectId) => {
  const response = await apiGetProjectTemplateStatus(projectId)
  currentWorkspace.value = normalizeWorkspace(response?.data?.workspace || currentWorkspace.value)
  return normalizeTemplate(response?.data?.template || null)
}

export const publishProjectTemplate = async (projectId, payload) => {
  const response = await apiPublishProjectTemplate(projectId, payload)
  currentWorkspace.value = normalizeWorkspace(response?.data?.workspace || currentWorkspace.value)
  return normalizeTemplate(response?.data?.template || null)
}

export const unpublishProjectTemplate = async (projectId) => {
  const response = await apiUnpublishProjectTemplate(projectId)
  currentWorkspace.value = normalizeWorkspace(response?.data?.workspace || currentWorkspace.value)
  return normalizeTemplate(response?.data?.template || null)
}

export const favoriteSharedTemplate = async (templateId) => {
  await apiFavoriteSharedTemplate(templateId)
  featuredTemplates.value = featuredTemplates.value.map((template) => (
    template.id === templateId ? { ...template, isFavorite: true } : template
  ))
}

export const unfavoriteSharedTemplate = async (templateId) => {
  await apiUnfavoriteSharedTemplate(templateId)
  featuredTemplates.value = featuredTemplates.value.map((template) => (
    template.id === templateId ? { ...template, isFavorite: false } : template
  ))
}

export const useSharedTemplate = async (templateId) => {
  if (BYPASS_AUTH_IN_DEV) {
    const template = getLocalPreviewTemplateById(templateId)
    currentWorkspace.value = getLocalPreviewWorkspace()
    return createLocalProjectFromTemplate(template)
  }

  const response = await apiUseSharedTemplate(templateId)
  currentWorkspace.value = normalizeWorkspace(response?.data?.workspace || currentWorkspace.value)
  return response?.data?.project || null
}

export const useWorkspaceStore = () => ({
  currentWorkspace,
  workspaces,
  featuredTemplates,
  pendingWorkspaceInvites,
  templatesScope,
  loadCurrentWorkspace,
  loadWorkspaces,
  createTeamWorkspace,
  selectWorkspace,
  loadWorkspaceMembers,
  createWorkspaceInviteLink,
  createWorkspaceDirectInvite,
  joinWorkspaceInvite,
  loadPendingWorkspaceInvites,
  acceptWorkspaceInvite,
  leaveWorkspace,
  loadFeaturedTemplates,
  getProjectTemplateStatus,
  publishProjectTemplate,
  unpublishProjectTemplate,
  favoriteSharedTemplate,
  unfavoriteSharedTemplate,
  useSharedTemplate
})
