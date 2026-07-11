<template>
  <div class="workspace-shell">
    <WorkspaceSidebar
      v-model:active-section="activeSection"
      :workspace-brand="workspaceBrand"
      :nav-items="navItems"
      :is-authenticated="isAuthenticated"
      :user="user"
      :avatar-initial="avatarInitial"
      :usage-summary="sidebarUsageSummary"
      :usage-loading="usageSummaryLoading"
      :current-workspace="currentWorkspace"
      :workspaces="workspaces"
      :pending-invites="pendingWorkspaceInvites"
      @select-workspace="handleSelectWorkspace"
      @create-workspace="openCreateWorkspaceModal"
      @invite-workspace="openInviteWorkspaceModal"
      @leave-workspace="openLeaveWorkspaceModal"
      @edit-workspace="openEditWorkspaceModal"
      @delete-workspace="openDeleteWorkspaceModal"
      @accept-workspace-invite="handleAcceptWorkspaceInvite"
      @upload-avatar="triggerAvatarUpload"
      @settings="openProfileSettings"
      @admin="router.push('/admin/dashboard')"
      @logout="handleLogout"
      @login="router.push({ path: '/', query: { auth: 'login', redirect: '/workspace' } })"
      @register="router.push({ path: '/', query: { auth: 'register', redirect: '/workspace' } })"
    />
    <input ref="avatarInputRef" type="file" accept="image/*" class="hidden" @change="handleAvatarChange" />

    <main class="workspace-main">
      <WorkspaceHeader
        :title="sectionTitle"
        :description="sectionDescription"
        @back-home="router.push('/')"
        @create-project="createBlankProject"
      />

      <WorkspaceInboxPanel
        v-if="activeSection === 'inbox'"
        :workspace-invites="workspaceInbox.workspaceInvites"
        :project-edit-requests="workspaceInbox.projectEditRequests"
        :loading="workspaceInboxLoading"
        @accept-workspace-invite="handleAcceptWorkspaceInvite"
        @review-project-request="handleReviewProjectRequest"
        @refresh="refreshWorkspaceInbox"
      />

      <WorkspaceSettingsPanel
        v-else-if="activeSection === 'settings' && isTeamWorkspaceOwner"
        v-model:edit-name="editWorkspaceName"
        v-model:edit-avatar-url="editWorkspaceAvatarUrl"
        :current-workspace="currentWorkspace"
        :members="settingsWorkspaceMembers"
        :projects="settingsProjects"
        :permission-detail="projectPermissionDetail"
        :loading-permissions="projectPermissionLoading"
        :saving-permission="projectPermissionSaving"
        @update-workspace="saveWorkspaceSettingsFromPanel"
        @load-project-permissions="loadProjectPermissionDetail"
        @change-project-permission="changeProjectPermission"
      />

      <template v-else>
        <div v-if="activeSection === 'featured'" class="template-tabs">
          <button
            v-for="tab in templateTabs"
            :key="tab.key"
            type="button"
            :class="{ active: activeTemplateScope === tab.key }"
            @click="changeTemplateScope(tab.key)"
          >
            {{ tab.label }}
          </button>
        </div>

        <div v-if="workspaceSwitching" class="workspace-switching-status" role="status" aria-live="polite">
          <span class="workspace-switching-status-dot" aria-hidden="true" />
          Refreshing workspace
        </div>

        <WorkspaceLoadingGrid v-if="workspaceSwitching" />

        <WorkspaceCardsGrid
          v-else-if="showsCardsGrid"
          :active-section="activeSection"
          :items="sectionItems"
          :describe-item="describeItem"
          :resolve-card-icon="resolveCardIcon"
          :project-menu-options="projectMenuOptions"
          :empty-state-title="cardsEmptyStateTitle"
          :empty-state-copy="cardsEmptyStateCopy"
          :opening-project-id="openingProjectId"
          @primary-click="handlePrimaryClick"
          @project-intent="preloadCanvasView"
          @project-menu-select="handleProjectMenuSelect"
          @favorite-template="toggleFavoriteTemplate"
        />
      </template>
    </main>

    <WorkspaceModals
      v-model:show-rename="showRenameModal"
      v-model:show-delete="showDeleteModal"
      v-model:show-template-preview="showTemplatePreviewModal"
      v-model:show-copy-to-workspace="showCopyWorkspaceModal"
      v-model:show-share-user="showShareUserModal"
      v-model:rename-value="renameValue"
      v-model:copy-workspace-id="copyWorkspaceId"
      v-model:share-email="shareEmail"
      :delete-target-name="deleteTargetName"
      :copy-target-name="copyTargetName"
      :copy-workspace-options="teamCopyWorkspaces"
      :copy-loading="copyLoading"
      :share-target-name="shareTargetName"
      :share-loading="shareLoading"
      :preview-template="previewTemplate"
      @confirm-rename="confirmRename"
      @confirm-delete="confirmDelete"
      @confirm-copy-to-workspace="confirmCopyToWorkspace"
      @confirm-share-user="confirmShareUser"
      @close-template-preview="closeTemplatePreview"
      @use-template-from-preview="useTemplateFromPreview"
    />

    <WorkspaceProfileModal
      v-model:show="showProfileModal"
      v-model:display-name="profileDisplayName"
      :user="user"
      :avatar-initial="avatarInitial"
      :saving="profileSaving"
      @upload-avatar="triggerAvatarUpload"
      @save-profile="saveProfileSettings"
    />

    <WorkspaceTeamModals
      v-model:show-create="showCreateWorkspaceModal"
      v-model:show-invite="showInviteWorkspaceModal"
      v-model:show-leave="showLeaveWorkspaceModal"
      v-model:show-edit="showEditWorkspaceModal"
      v-model:show-delete="showDeleteWorkspaceModal"
      v-model:create-name="createWorkspaceName"
      v-model:create-avatar-url="createWorkspaceAvatarUrl"
      v-model:edit-name="editWorkspaceName"
      v-model:edit-avatar-url="editWorkspaceAvatarUrl"
      v-model:direct-invite-value="directInviteValue"
      v-model:transfer-to-user-id="transferToUserId"
      :created-invite-url="createdWorkspaceInviteUrl"
      :create-loading="workspaceCreateLoading"
      :edit-loading="workspaceEditLoading"
      :delete-workspace-name="deleteWorkspaceName"
      :delete-loading="workspaceDeleteLoading"
      :direct-invite-loading="directInviteLoading"
      :invite-url="workspaceInviteUrl"
      :invite-link-loading="inviteLinkLoading"
      :transfer-members="transferMembers"
      :leave-loading="leaveLoading"
      @confirm-create="confirmCreateWorkspace"
      @confirm-edit="confirmEditWorkspace"
      @send-direct-invite="sendDirectInvite"
      @generate-invite-link="generateInviteLink"
      @copy-invite-url="copyInviteUrl"
      @confirm-leave="confirmLeaveWorkspace"
      @confirm-delete-workspace="confirmDeleteWorkspace"
    />
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  BookmarkOutline,
  CopyOutline,
  CreateOutline,
  FolderOpenOutline,
  ImageOutline,
  SparklesOutline,
  GridOutline,
  PersonOutline,
  RefreshOutline,
  SettingsOutline,
  WindowSidebarOutline,
  TrashOutline
} from '@/icons/coolicons'
import {
  projects,
  projectsLoadState,
  initProjectsStore,
  createProject,
  renameProject,
  duplicateProject,
  copyProjectToWorkspace,
  shareProjectWithUser,
  deleteProject,
  requestProjectEditAccess,
  loadProjectPermissions,
  refreshProjectById,
  reviewProjectEditRequest,
  updateProjectPermission
} from '@/stores/projects'
import WorkspaceCardsGrid from '@/components/workspace/WorkspaceCardsGrid.vue'
import WorkspaceHeader from '@/components/workspace/WorkspaceHeader.vue'
import WorkspaceInboxPanel from '@/components/workspace/WorkspaceInboxPanel.vue'
import WorkspaceLoadingGrid from '@/components/workspace/WorkspaceLoadingGrid.vue'
import WorkspaceModals from '@/components/workspace/WorkspaceModals.vue'
import WorkspaceProfileModal from '@/components/workspace/WorkspaceProfileModal.vue'
import WorkspaceSidebar from '@/components/workspace/WorkspaceSidebar.vue'
import WorkspaceSettingsPanel from '@/components/workspace/WorkspaceSettingsPanel.vue'
import WorkspaceTeamModals from '@/components/workspace/WorkspaceTeamModals.vue'
import { getErrorMessage } from '@/utils'
import {
  describeWorkspaceItem,
  getWorkspaceBrand,
  getWorkspaceCardIconKey,
  getWorkspaceSectionDescription,
  getWorkspaceSectionTitle,
  getWorkspaceProjectSectionKey,
  getWorkspaceProjectMenuOptions
} from '@/utils/workspaceDisplay'
import { useWorkspaceStore } from '@/stores/workspace'
import { useAuthStore } from '@/stores/auth'
import { notifier } from '@/utils/notifier'
import { useAvatarUpload } from '@/hooks/useAvatarUpload'
import { getUsageSummary } from '@/api/usage'
import { preloadCanvasView } from '@/router/viewLoaders.js'

const router = useRouter()
const route = useRoute()
const { bootstrapAuth, isAuthenticated, user, logout, updateProfile } = useAuthStore()

const activeSection = ref('projects')

const showRenameModal = ref(false)
const renameTargetId = ref('')
const renameValue = ref('')
const showDeleteModal = ref(false)
const deleteTargetId = ref('')
const deleteTargetName = ref('')
const showCopyWorkspaceModal = ref(false)
const copyTargetId = ref('')
const copyTargetName = ref('')
const copyWorkspaceId = ref('')
const copyLoading = ref(false)
const showShareUserModal = ref(false)
const shareTargetId = ref('')
const shareTargetName = ref('')
const shareEmail = ref('')
const shareLoading = ref(false)
const showTemplatePreviewModal = ref(false)
const previewTemplate = ref(null)
const refreshingProjectId = ref('')
const showCreateWorkspaceModal = ref(false)
const showInviteWorkspaceModal = ref(false)
const showLeaveWorkspaceModal = ref(false)
const showEditWorkspaceModal = ref(false)
const showDeleteWorkspaceModal = ref(false)
const createWorkspaceName = ref('')
const createWorkspaceAvatarUrl = ref('')
const createdWorkspaceInviteUrl = ref('')
const workspaceCreateLoading = ref(false)
const editWorkspaceId = ref('')
const editWorkspaceName = ref('')
const editWorkspaceAvatarUrl = ref('')
const workspaceEditLoading = ref(false)
const deleteWorkspaceId = ref('')
const deleteWorkspaceName = ref('')
const workspaceDeleteLoading = ref(false)
const directInviteValue = ref('')
const directInviteLoading = ref(false)
const workspaceInviteUrl = ref('')
const inviteLinkLoading = ref(false)
const transferMembers = ref([])
const transferToUserId = ref('')
const leaveLoading = ref(false)
const activeTemplateScope = ref('community')
const showProfileModal = ref(false)
const profileDisplayName = ref('')
const profileSaving = ref(false)
const usageSummary = ref(null)
const usageSummaryLoading = ref(false)
const workspaceSwitching = ref(false)
const openingProjectId = ref('')
const workspaceInboxLoading = ref(false)
const settingsWorkspaceMembers = ref([])
const projectPermissionDetail = ref(null)
const projectPermissionLoading = ref(false)
const projectPermissionSaving = ref(false)
let workspaceSwitchRefreshId = 0
let canvasPreloadHandle = null

const scheduleCanvasPreload = () => {
  if (typeof window.requestIdleCallback === 'function') {
    canvasPreloadHandle = window.requestIdleCallback(() => {
      canvasPreloadHandle = null
      void preloadCanvasView()
    }, { timeout: 1500 })
    return
  }
  canvasPreloadHandle = window.setTimeout(() => {
    canvasPreloadHandle = null
    void preloadCanvasView()
  }, 300)
}

const cancelCanvasPreload = () => {
  if (canvasPreloadHandle === null) return
  if (typeof window.cancelIdleCallback === 'function') window.cancelIdleCallback(canvasPreloadHandle)
  else window.clearTimeout(canvasPreloadHandle)
  canvasPreloadHandle = null
}

const templateTabs = [
  { key: 'community', label: 'Community' },
  { key: 'my', label: 'My' },
  { key: 'favorites', label: 'Favorites' }
]

const workspaceCardIcons = {
  project: FolderOpenOutline,
  image: ImageOutline,
  video: SparklesOutline,
  default: GridOutline
}

const projectMenuIconMap = {
  refresh: RefreshOutline,
  copy: CopyOutline,
  edit: CreateOutline,
  folder: FolderOpenOutline,
  person: PersonOutline,
  trash: TrashOutline
}

const { avatarInputRef, avatarInitial, triggerAvatarUpload, handleAvatarChange } = useAvatarUpload({
  user,
  updateProfile,
  notify: {
    success: (message) => notifier.success(message),
    error: (message) => notifier.error(message)
  }
})

const {
  currentWorkspace,
  workspaces,
  featuredTemplates,
  pendingWorkspaceInvites,
  workspaceInbox,
  templatesScope,
  acceptWorkspaceInvite,
  createTeamWorkspace,
  createWorkspaceDirectInvite,
  createWorkspaceInviteLink,
  favoriteSharedTemplate,
  getSharedTemplate,
  joinWorkspaceInvite,
  loadFeaturedTemplates,
  loadWorkspaceInbox,
  loadPendingWorkspaceInvites,
  loadWorkspaceMembers,
  loadWorkspaces,
  leaveWorkspace,
  selectWorkspace,
  updateTeamWorkspace,
  deleteTeamWorkspace,
  unfavoriteSharedTemplate,
  useSharedTemplate
} = useWorkspaceStore()

const isTeamWorkspaceOwner = computed(() => (
  currentWorkspace.value?.kind === 'team' && currentWorkspace.value?.role === 'owner'
))

const workspaceInboxCount = computed(() => (
  Number(workspaceInbox.value?.workspaceInvites?.length || 0) +
  Number(workspaceInbox.value?.projectEditRequests?.length || 0)
))

const navItems = computed(() => [
  {
    key: 'projects',
    label: currentWorkspace.value?.kind === 'team' ? 'Team Workspace' : 'My Project',
    icon: FolderOpenOutline
  },
  { key: 'shared', label: 'Shared with me', icon: PersonOutline },
  { key: 'featured', label: 'Shared Template', icon: BookmarkOutline },
  { key: 'inbox', label: 'Inbox', icon: WindowSidebarOutline, count: workspaceInboxCount.value },
  ...(isTeamWorkspaceOwner.value ? [{ key: 'settings', label: 'Settings', icon: SettingsOutline }] : [])
])

const workspaceBrand = computed(() => getWorkspaceBrand({
  user: user.value,
  currentWorkspace: currentWorkspace.value
}))

const sidebarUsageSummary = computed(() => usageSummary.value)

const sectionTitle = computed(() => getWorkspaceSectionTitle(activeSection.value, { currentWorkspace: currentWorkspace.value }))

const sectionDescription = computed(() => getWorkspaceSectionDescription(activeSection.value, { currentWorkspace: currentWorkspace.value }))

const showsCardsGrid = computed(() => ['projects', 'shared', 'featured'].includes(activeSection.value))

const sectionItems = computed(() => {
  if (activeSection.value === 'featured') return featuredTemplates.value
  if (activeSection.value === 'shared') {
    return projects.value.filter((project) => getWorkspaceProjectSectionKey(project) === 'shared')
  }
  if (!showsCardsGrid.value) return []
  return projects.value.filter((project) => getWorkspaceProjectSectionKey(project) === 'projects')
})

const settingsProjects = computed(() => projects.value.filter((project) => (
  project.accessMode === 'team' &&
  (!currentWorkspace.value?.id || project.workspaceId === currentWorkspace.value.id)
)))

const isProjectListUnavailable = computed(() => (
  ['projects', 'shared'].includes(activeSection.value) &&
  projectsLoadState.value.source === 'remote-error'
))

const cardsEmptyStateTitle = computed(() => (
  isProjectListUnavailable.value ? 'Project list unavailable' : ''
))

const cardsEmptyStateCopy = computed(() => (
  isProjectListUnavailable.value
    ? 'Cloud project data could not be loaded. Cached browser projects are hidden to avoid stale results.'
    : ''
))

const describeItem = (item) => describeWorkspaceItem({
  activeSection: activeSection.value,
  item
})

const resolveCardIcon = (item) => {
  const iconKey = getWorkspaceCardIconKey({
    activeSection: activeSection.value,
    item
  })
  return workspaceCardIcons[iconKey] || workspaceCardIcons.default
}

const teamCopyWorkspaces = computed(() => workspaces.value.filter((workspace) => workspace.kind === 'team'))

const withProjectMenuIcons = (options = []) => options.map((item) => (
  item.icon ? { ...item, icon: projectMenuIconMap[item.icon] || item.icon } : item
))

const projectMenuOptions = (project) => withProjectMenuIcons(getWorkspaceProjectMenuOptions(project, {
  canCopyToTeam: project?.permission !== 'viewer' && project?.accessMode !== 'team' && teamCopyWorkspaces.value.length > 0,
  canShareWithUser: project?.permission !== 'viewer' && project?.accessMode !== 'team'
}))

const getDefaultTemplateScopeForCurrentWorkspace = () => 'community'

const syncActiveTemplateScopeFromStore = () => {
  activeTemplateScope.value = templatesScope.value || activeTemplateScope.value
}

const resetTemplateScopeForCurrentWorkspace = () => {
  activeTemplateScope.value = getDefaultTemplateScopeForCurrentWorkspace()
}

const loadTemplatesForActiveScope = async (options = {}) => {
  await loadFeaturedTemplates(activeTemplateScope.value, options)
  syncActiveTemplateScopeFromStore()
}

const copyText = async (text) => {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

const handleProjectMenuSelect = async (key, project) => {
  if (key === 'refresh-cloud') {
    await refreshProjectFromCloud(project)
    return
  }
  if (key === 'copy-link') {
    const origin = window.location.origin
    const ok = await copyText(`${origin}/canvas/${project.id}`)
    notifier[ok ? 'success' : 'warning'](ok ? 'Project link copied' : 'Copy failed')
    return
  }
  if (key === 'request-edit') {
    try {
      await requestProjectEditAccess(project.id)
      notifier.success('Edit access requested')
    } catch (error) {
      notifier.error(getErrorMessage(error, 'Failed to request edit access'))
    }
    return
  }
  if (key === 'rename') {
    openRename(project)
    return
  }
  if (key === 'duplicate') {
    await duplicate(project)
    return
  }
  if (key === 'copy-to-workspace') {
    openCopyToWorkspace(project)
    return
  }
  if (key === 'share-user') {
    openShareUser(project)
    return
  }
  if (key === 'delete') {
    openDelete(project)
  }
}

const handleLogout = async () => {
  await logout()
  usageSummary.value = null
  await router.push('/')
}

const loadSidebarUsageSummary = async () => {
  if (!isAuthenticated.value) {
    usageSummary.value = null
    return
  }

  usageSummaryLoading.value = true
  try {
    const response = await getUsageSummary(undefined, undefined, {
      silentErrorToast: true,
      silentNetworkErrorToast: true
    })
    usageSummary.value = response?.data || response || null
  } catch {
    usageSummary.value = null
  } finally {
    usageSummaryLoading.value = false
  }
}

const refreshWorkspaceInbox = async () => {
  workspaceInboxLoading.value = true
  try {
    await loadWorkspaceInbox()
  } catch {
    workspaceInbox.value = {
      workspaceInvites: pendingWorkspaceInvites.value,
      projectEditRequests: []
    }
  } finally {
    workspaceInboxLoading.value = false
  }
}

const prepareWorkspaceSettings = async () => {
  const target = currentWorkspace.value
  if (!target?.id || target.kind !== 'team' || target.role !== 'owner') return
  editWorkspaceId.value = target.id
  editWorkspaceName.value = target.name || ''
  editWorkspaceAvatarUrl.value = target.avatarUrl || ''
  try {
    settingsWorkspaceMembers.value = await loadWorkspaceMembers(target.id)
  } catch {
    settingsWorkspaceMembers.value = []
  }
}

const saveWorkspaceSettingsFromPanel = async () => {
  const target = currentWorkspace.value
  const workspaceId = target?.id || editWorkspaceId.value
  if (!workspaceId || !editWorkspaceName.value.trim() || workspaceEditLoading.value) return
  workspaceEditLoading.value = true
  try {
    await updateTeamWorkspace(workspaceId, {
      name: editWorkspaceName.value.trim(),
      avatarUrl: editWorkspaceAvatarUrl.value || null
    })
    notifier.success('Workspace updated')
  } catch (error) {
    notifier.error(getErrorMessage(error, 'Failed to update workspace'))
  } finally {
    workspaceEditLoading.value = false
  }
}

const loadProjectPermissionDetail = async (projectId) => {
  const id = String(projectId || '').trim()
  if (!id || projectPermissionLoading.value) return
  projectPermissionLoading.value = true
  try {
    projectPermissionDetail.value = await loadProjectPermissions(id)
  } catch (error) {
    notifier.error(getErrorMessage(error, 'Failed to load project permissions'))
  } finally {
    projectPermissionLoading.value = false
  }
}

const changeProjectPermission = async ({ projectId, userId, role } = {}) => {
  const id = String(projectId || '').trim()
  const targetUserId = String(userId || '').trim()
  if (!id || !targetUserId || !role || projectPermissionSaving.value) return
  projectPermissionSaving.value = true
  try {
    projectPermissionDetail.value = await updateProjectPermission(id, targetUserId, role)
    await loadWorkspaceProjects()
    notifier.success('Project permissions updated')
  } catch (error) {
    notifier.error(getErrorMessage(error, 'Failed to update project permissions'))
  } finally {
    projectPermissionSaving.value = false
  }
}

const handleReviewProjectRequest = async ({ projectId, requestId, decision } = {}) => {
  const id = String(projectId || '').trim()
  const reviewId = String(requestId || '').trim()
  if (!id || !reviewId || !decision || workspaceInboxLoading.value) return
  workspaceInboxLoading.value = true
  try {
    await reviewProjectEditRequest(id, reviewId, decision)
    await loadWorkspaceInbox()
    if (projectPermissionDetail.value?.project?.id === id) {
      projectPermissionDetail.value = await loadProjectPermissions(id)
    }
    notifier.success(decision === 'approve' ? 'Edit request approved' : 'Edit request rejected')
  } catch (error) {
    notifier.error(getErrorMessage(error, 'Failed to review edit request'))
  } finally {
    workspaceInboxLoading.value = false
  }
}

const openProfileSettings = () => {
  profileDisplayName.value = String(user.value?.displayName || '').trim()
  showProfileModal.value = true
}

const saveProfileSettings = async () => {
  const displayName = profileDisplayName.value.trim()
  if (displayName.length < 2 || profileSaving.value) return
  profileSaving.value = true
  try {
    await updateProfile({ displayName })
    showProfileModal.value = false
    notifier.success('Profile updated')
  } catch (error) {
    notifier.error(getErrorMessage(error, 'Failed to update profile'))
  } finally {
    profileSaving.value = false
  }
}

const createBlankProject = async () => {
  try {
    const id = await createProject('Untitled')
    await router.push(`/canvas/${id}`)
  } catch (error) {
    notifier.error(getErrorMessage(error, 'Failed to create project'))
  }
}

const handlePrimaryClick = async (item) => {
  if (activeSection.value !== 'projects' && activeSection.value !== 'shared') {
    openTemplatePreview(item)
    return
  }
  const id = String(item?.id || '').trim()
  if (!id || openingProjectId.value) return
  openingProjectId.value = id
  void preloadCanvasView()
  try {
    await router.push('/canvas/' + id)
  } catch (error) {
    openingProjectId.value = ''
    notifier.error(getErrorMessage(error, 'Failed to open project'))
  }
}

const refreshProjectFromCloud = async (project) => {
  const id = String(project?.id || '').trim()
  if (!id || refreshingProjectId.value) return
  refreshingProjectId.value = id
  try {
    await refreshProjectById(id, { preferLocalDraft: false })
    notifier.success('Cloud canvas refreshed')
  } catch (error) {
    notifier.error(getErrorMessage(error, 'Failed to refresh cloud canvas'))
  } finally {
    refreshingProjectId.value = ''
  }
}

const useTemplate = async (item) => {
  try {
    const project = await useSharedTemplate(item.id)
    if (!project?.id) {
      notifier.warning('Template unavailable')
      return
    }
    await loadWorkspaceProjects()
    await router.push(`/canvas/${project.id}`)
  } catch (error) {
    notifier.error(getErrorMessage(error, 'Failed to create project from template'))
  }
}

const loadWorkspaceProjects = async (options = {}) => {
  await initProjectsStore({ allowLocalFallback: false, ...options })
}

const refreshWorkspaceTemplates = () => {
  return loadTemplatesForActiveScope({ preferCache: true }).catch((error) => {
    featuredTemplates.value = []
    throw error
  })
}

const refreshWorkspaceData = async () => {
  await loadWorkspaceProjects()
  await refreshWorkspaceTemplates()
}

const handleSelectWorkspace = async (workspaceId) => {
  if (!workspaceId || workspaceId === currentWorkspace.value?.id) return
  const refreshId = ++workspaceSwitchRefreshId
  workspaceSwitching.value = true
  openingProjectId.value = ''
  try {
    const selection = selectWorkspace(workspaceId)
    resetTemplateScopeForCurrentWorkspace()
    activeSection.value = 'projects'
    await loadWorkspaceProjects({ workspaceId, commitAfter: selection })
    if (refreshId !== workspaceSwitchRefreshId) return
    resetTemplateScopeForCurrentWorkspace()
    void loadTemplatesForActiveScope({ preferCache: true }).catch((error) => {
      featuredTemplates.value = []
      notifier.error(getErrorMessage(error, 'Failed to refresh shared templates'))
    })
  } catch (error) {
    if (refreshId === workspaceSwitchRefreshId) {
      notifier.error(getErrorMessage(error, 'Failed to switch workspace'))
    }
  } finally {
    if (refreshId === workspaceSwitchRefreshId) workspaceSwitching.value = false
  }
}

const openCreateWorkspaceModal = () => {
  createWorkspaceName.value = ''
  createWorkspaceAvatarUrl.value = ''
  createdWorkspaceInviteUrl.value = ''
  showCreateWorkspaceModal.value = true
}

const confirmCreateWorkspace = async () => {
  if (!createWorkspaceName.value.trim()) return
  workspaceCreateLoading.value = true
  try {
    if (createdWorkspaceInviteUrl.value) {
      const invite = await createWorkspaceInviteLink(currentWorkspace.value?.id)
      createdWorkspaceInviteUrl.value = invite?.inviteUrl || ''
      workspaceInviteUrl.value = createdWorkspaceInviteUrl.value
      notifier.success('Invite link regenerated')
      return
    }
    await createTeamWorkspace({
      name: createWorkspaceName.value.trim(),
      avatarUrl: createWorkspaceAvatarUrl.value || null
    })
    resetTemplateScopeForCurrentWorkspace()
    const invite = await createWorkspaceInviteLink(currentWorkspace.value?.id)
    createdWorkspaceInviteUrl.value = invite?.inviteUrl || ''
    workspaceInviteUrl.value = createdWorkspaceInviteUrl.value
    await refreshWorkspaceData()
    notifier.success('Workspace created')
  } catch (error) {
    notifier.error(getErrorMessage(error, 'Failed to create workspace'))
  } finally {
    workspaceCreateLoading.value = false
  }
}

const openEditWorkspaceModal = (workspace) => {
  const target = workspace || currentWorkspace.value
  if (!target?.id || target.kind !== 'team' || target.role !== 'owner') return
  editWorkspaceId.value = target.id
  editWorkspaceName.value = target.name || ''
  editWorkspaceAvatarUrl.value = target.avatarUrl || ''
  showEditWorkspaceModal.value = true
}

const confirmEditWorkspace = async () => {
  if (!editWorkspaceId.value || !editWorkspaceName.value.trim()) return
  workspaceEditLoading.value = true
  try {
    await updateTeamWorkspace(editWorkspaceId.value, {
      name: editWorkspaceName.value.trim(),
      avatarUrl: editWorkspaceAvatarUrl.value || null
    })
    showEditWorkspaceModal.value = false
    notifier.success('Workspace updated')
  } catch (error) {
    notifier.error(getErrorMessage(error, 'Failed to update workspace'))
  } finally {
    workspaceEditLoading.value = false
  }
}

const openInviteWorkspaceModal = () => {
  directInviteValue.value = ''
  workspaceInviteUrl.value = ''
  showInviteWorkspaceModal.value = true
}

const sendDirectInvite = async () => {
  if (!directInviteValue.value.trim()) return
  directInviteLoading.value = true
  try {
    await createWorkspaceDirectInvite(currentWorkspace.value?.id, directInviteValue.value.trim())
    directInviteValue.value = ''
    notifier.success('Invite created')
  } catch (error) {
    notifier.error(getErrorMessage(error, 'Failed to create invite'))
  } finally {
    directInviteLoading.value = false
  }
}

const generateInviteLink = async () => {
  inviteLinkLoading.value = true
  try {
    const invite = await createWorkspaceInviteLink(currentWorkspace.value?.id)
    workspaceInviteUrl.value = invite?.inviteUrl || ''
    notifier.success('Invite link created')
  } catch (error) {
    notifier.error(getErrorMessage(error, 'Failed to create invite link'))
  } finally {
    inviteLinkLoading.value = false
  }
}

const copyInviteUrl = async (url) => {
  const ok = await copyText(url)
  notifier[ok ? 'success' : 'warning'](ok ? 'Invite link copied' : 'Copy failed')
}

const openLeaveWorkspaceModal = async () => {
  if (currentWorkspace.value?.role === 'owner') {
    openDeleteWorkspaceModal()
    return
  }
  transferToUserId.value = ''
  showLeaveWorkspaceModal.value = true
  try {
    const members = await loadWorkspaceMembers(currentWorkspace.value?.id)
    const currentUserId = String(user.value?.id || '')
    transferMembers.value = members.filter((member) => member.userId !== currentUserId)
  } catch {
    transferMembers.value = []
  }
}

const openDeleteWorkspaceModal = () => {
  const target = currentWorkspace.value
  if (!target?.id || target.kind !== 'team' || target.role !== 'owner') return
  deleteWorkspaceId.value = target.id
  deleteWorkspaceName.value = target.name || 'Workspace'
  showDeleteWorkspaceModal.value = true
}

const confirmDeleteWorkspace = async () => {
  if (!deleteWorkspaceId.value) return
  workspaceDeleteLoading.value = true
  try {
    await deleteTeamWorkspace(deleteWorkspaceId.value)
    showDeleteWorkspaceModal.value = false
    deleteWorkspaceId.value = ''
    deleteWorkspaceName.value = ''
    resetTemplateScopeForCurrentWorkspace()
    activeSection.value = 'projects'
    await refreshWorkspaceData()
    notifier.success('Workspace deleted')
  } catch (error) {
    notifier.error(getErrorMessage(error, 'Failed to delete workspace'))
  } finally {
    workspaceDeleteLoading.value = false
  }
}

const confirmLeaveWorkspace = async () => {
  leaveLoading.value = true
  try {
    await leaveWorkspace(currentWorkspace.value?.id, { transferToUserId: transferToUserId.value || null })
    showLeaveWorkspaceModal.value = false
    resetTemplateScopeForCurrentWorkspace()
    activeSection.value = 'projects'
    await refreshWorkspaceData()
    notifier.success('Workspace left')
  } catch (error) {
    notifier.error(getErrorMessage(error, 'Failed to leave workspace'))
  } finally {
    leaveLoading.value = false
  }
}

const handleAcceptWorkspaceInvite = async (inviteId) => {
  try {
    await acceptWorkspaceInvite(inviteId)
    resetTemplateScopeForCurrentWorkspace()
    activeSection.value = 'projects'
    await refreshWorkspaceData()
    await refreshWorkspaceInbox()
    notifier.success('Workspace joined')
  } catch (error) {
    notifier.error(getErrorMessage(error, 'Failed to accept invite'))
  }
}

const changeTemplateScope = async (scope) => {
  if (scope === activeTemplateScope.value) return
  activeTemplateScope.value = scope
  await loadTemplatesForActiveScope({ preferCache: true })
}

const toggleFavoriteTemplate = async (template) => {
  try {
    if (template.isFavorite) {
      await unfavoriteSharedTemplate(template.id)
    } else {
      await favoriteSharedTemplate(template.id)
    }
  } catch (error) {
    notifier.error(getErrorMessage(error, 'Failed to update favorite'))
  }
}

const openTemplatePreview = async (item) => {
  previewTemplate.value = item || null
  showTemplatePreviewModal.value = true
  if (!item?.id || item.canvasData) return
  try {
    const template = await getSharedTemplate(item.id)
    if (showTemplatePreviewModal.value && previewTemplate.value?.id === item.id && template) {
      previewTemplate.value = { ...previewTemplate.value, ...template }
    }
  } catch {
    // Keep the lightweight summary preview usable when detail loading fails.
  }
}

const closeTemplatePreview = () => {
  showTemplatePreviewModal.value = false
  previewTemplate.value = null
}

const useTemplateFromPreview = async () => {
  if (!previewTemplate.value) return
  const target = previewTemplate.value
  closeTemplatePreview()
  await useTemplate(target)
}

const openRename = (project) => {
  renameTargetId.value = project.id
  renameValue.value = project.name
  showRenameModal.value = true
}

const confirmRename = async () => {
  if (!renameTargetId.value || !renameValue.value.trim()) return
  await renameProject(renameTargetId.value, renameValue.value.trim())
  showRenameModal.value = false
  renameTargetId.value = ''
  renameValue.value = ''
  notifier.success('Project renamed')
}

const duplicate = async (project) => {
  await duplicateProject(project.id)
  notifier.success('Project duplicated')
}

const openCopyToWorkspace = (project) => {
  if (!teamCopyWorkspaces.value.length) {
    notifier.warning('Join or create a team workspace first')
    return
  }
  copyTargetId.value = project.id
  copyTargetName.value = project.name
  copyWorkspaceId.value = teamCopyWorkspaces.value[0]?.id || ''
  showCopyWorkspaceModal.value = true
}

const openShareUser = (project) => {
  shareTargetId.value = project.id
  shareTargetName.value = project.name
  shareEmail.value = ''
  showShareUserModal.value = true
}

const openDelete = (project) => {
  deleteTargetId.value = project.id
  deleteTargetName.value = project.name
  showDeleteModal.value = true
}

const confirmDelete = async () => {
  if (!deleteTargetId.value) return
  await deleteProject(deleteTargetId.value)
  showDeleteModal.value = false
  deleteTargetId.value = ''
  deleteTargetName.value = ''
  notifier.success('Project deleted')
}

const confirmCopyToWorkspace = async () => {
  if (!copyTargetId.value || !copyWorkspaceId.value || copyLoading.value) return
  copyLoading.value = true
  try {
    const targetWorkspace = teamCopyWorkspaces.value.find((workspace) => workspace.id === copyWorkspaceId.value)
    await copyProjectToWorkspace(copyTargetId.value, copyWorkspaceId.value)
    showCopyWorkspaceModal.value = false
    copyTargetId.value = ''
    copyTargetName.value = ''
    copyWorkspaceId.value = ''
    notifier.success(`Project copied to ${targetWorkspace?.name || 'team workspace'}`)
  } catch (error) {
    notifier.error(getErrorMessage(error, 'Failed to copy project'))
  } finally {
    copyLoading.value = false
  }
}

const confirmShareUser = async () => {
  if (!shareTargetId.value || !shareEmail.value.trim() || shareLoading.value) return
  shareLoading.value = true
  try {
    await shareProjectWithUser(shareTargetId.value, shareEmail.value.trim())
    showShareUserModal.value = false
    shareTargetId.value = ''
    shareTargetName.value = ''
    shareEmail.value = ''
    notifier.success('Project shared')
  } catch (error) {
    notifier.error(getErrorMessage(error, 'Failed to share project'))
  } finally {
    shareLoading.value = false
  }
}

const loadWorkspaceSurfaces = async () => {
  try {
    await loadWorkspaces()
  } catch {
    currentWorkspace.value = null
  }
  resetTemplateScopeForCurrentWorkspace()

  await Promise.all([
    (async () => {
      try {
        await loadWorkspaceInbox()
      } catch {
        workspaceInbox.value = {
          workspaceInvites: [],
          projectEditRequests: []
        }
        try {
          await loadPendingWorkspaceInvites()
        } catch {
          pendingWorkspaceInvites.value = []
        }
      }
    })(),
    (async () => {
      try {
        await loadTemplatesForActiveScope({ preferCache: true })
      } catch {
        featuredTemplates.value = []
      }
    })()
  ])
}

watch(activeSection, (section) => {
  if (section === 'inbox') {
    void refreshWorkspaceInbox()
    return
  }
  if (section === 'settings') {
    if (!isTeamWorkspaceOwner.value) {
      activeSection.value = 'projects'
      return
    }
    void prepareWorkspaceSettings()
  }
})

watch(
  () => [currentWorkspace.value?.id, currentWorkspace.value?.kind, currentWorkspace.value?.role],
  () => {
    projectPermissionDetail.value = null
    settingsWorkspaceMembers.value = []
    if (activeSection.value === 'settings') {
      if (!isTeamWorkspaceOwner.value) {
        activeSection.value = 'projects'
        return
      }
      void prepareWorkspaceSettings()
    }
    if (activeSection.value === 'inbox') {
      void refreshWorkspaceInbox()
    }
  }
)

onMounted(async () => {
  await bootstrapAuth()
  if (isAuthenticated.value) {
    void loadSidebarUsageSummary()
  }
  const inviteToken = String(route.params?.token || '').trim()
  if (inviteToken) {
    try {
      await joinWorkspaceInvite(inviteToken)
      notifier.success('Workspace joined')
    } catch (error) {
      notifier.error(getErrorMessage(error, 'Invite link is invalid or expired'))
    }
  }
  await Promise.all([
    loadWorkspaceProjects(),
    loadWorkspaceSurfaces()
  ])
  scheduleCanvasPreload()
})

onBeforeUnmount(() => {
  cancelCanvasPreload()
})
</script>

<style scoped>
.workspace-shell {
  min-height: 100vh;
  background:
    radial-gradient(circle at top left, rgba(255, 255, 255, 0.025), transparent 24%),
    #0d0e10;
  color: #f0f1f3;
  display: grid;
  grid-template-columns: 272px 1fr;
}

.workspace-main {
  padding: 28px;
}

.template-tabs {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 22px;
  overflow-x: auto;
}

.template-tabs button {
  height: 36px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.03);
  color: rgba(236, 238, 244, 0.7);
  padding: 0 14px;
  cursor: pointer;
  font-size: 13px;
  white-space: nowrap;
}

.template-tabs button.active,
.template-tabs button:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.18);
}

.workspace-switching-status {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 30px;
  margin: -6px 0 16px;
  padding: 0 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.045);
  color: rgba(236, 238, 244, 0.78);
  font-size: 12px;
  line-height: 1;
}

.workspace-switching-status-dot {
  width: 12px;
  height: 12px;
  border-radius: 999px;
  box-shadow: inset 0 0 0 1.5px rgba(255, 255, 255, 0.2);
  border-top: 1.5px solid rgba(255, 255, 255, 0.9);
  animation: workspace-switching-spin 0.75s linear infinite;
}

@keyframes workspace-switching-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .workspace-switching-status-dot {
    animation: none;
  }
}

@media (max-width: 900px) {
  .workspace-shell {
    grid-template-columns: 1fr;
  }
}
</style>
