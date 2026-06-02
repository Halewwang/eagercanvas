<template>
  <div class="workspace-shell">
    <WorkspaceSidebar
      v-model:active-section="activeSection"
      :workspace-brand="workspaceBrand"
      :nav-items="navItems"
      :is-authenticated="isAuthenticated"
      :user="user"
      :avatar-initial="avatarInitial"
      :current-workspace="currentWorkspace"
      :workspaces="workspaces"
      :pending-invites="pendingWorkspaceInvites"
      @select-workspace="handleSelectWorkspace"
      @create-workspace="openCreateWorkspaceModal"
      @invite-workspace="openInviteWorkspaceModal"
      @leave-workspace="openLeaveWorkspaceModal"
      @accept-workspace-invite="handleAcceptWorkspaceInvite"
      @upload-avatar="triggerAvatarUpload"
      @settings="router.push('/usage')"
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

      <WorkspaceCardsGrid
        :active-section="activeSection"
        :items="sectionItems"
        :describe-item="describeItem"
        :resolve-card-icon="resolveCardIcon"
        :project-menu-options="projectMenuOptions"
        @primary-click="handlePrimaryClick"
        @project-menu-select="handleProjectMenuSelect"
        @favorite-template="toggleFavoriteTemplate"
      />
    </main>

    <WorkspaceModals
      v-model:show-rename="showRenameModal"
      v-model:show-delete="showDeleteModal"
      v-model:show-template-preview="showTemplatePreviewModal"
      v-model:rename-value="renameValue"
      :delete-target-name="deleteTargetName"
      :preview-template="previewTemplate"
      @confirm-rename="confirmRename"
      @confirm-delete="confirmDelete"
      @close-template-preview="closeTemplatePreview"
      @use-template-from-preview="useTemplateFromPreview"
    />

    <WorkspaceTeamModals
      v-model:show-create="showCreateWorkspaceModal"
      v-model:show-invite="showInviteWorkspaceModal"
      v-model:show-leave="showLeaveWorkspaceModal"
      v-model:create-name="createWorkspaceName"
      v-model:create-avatar-url="createWorkspaceAvatarUrl"
      v-model:direct-invite-value="directInviteValue"
      v-model:transfer-to-user-id="transferToUserId"
      :created-invite-url="createdWorkspaceInviteUrl"
      :create-loading="workspaceCreateLoading"
      :direct-invite-loading="directInviteLoading"
      :invite-url="workspaceInviteUrl"
      :invite-link-loading="inviteLinkLoading"
      :transfer-members="transferMembers"
      :leave-loading="leaveLoading"
      @confirm-create="confirmCreateWorkspace"
      @send-direct-invite="sendDirectInvite"
      @generate-invite-link="generateInviteLink"
      @copy-invite-url="copyInviteUrl"
      @confirm-leave="confirmLeaveWorkspace"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  BookmarkOutline,
  FolderOpenOutline,
  ImageOutline,
  SparklesOutline,
  GridOutline,
  PersonOutline
} from '@/icons/coolicons'
import {
  projects,
  initProjectsStore,
  createProject,
  renameProject,
  duplicateProject,
  deleteProject,
  requestProjectEditAccess,
  refreshProjectById
} from '@/stores/projects'
import WorkspaceCardsGrid from '@/components/workspace/WorkspaceCardsGrid.vue'
import WorkspaceHeader from '@/components/workspace/WorkspaceHeader.vue'
import WorkspaceModals from '@/components/workspace/WorkspaceModals.vue'
import WorkspaceSidebar from '@/components/workspace/WorkspaceSidebar.vue'
import WorkspaceTeamModals from '@/components/workspace/WorkspaceTeamModals.vue'
import { getErrorMessage } from '@/utils'
import {
  describeWorkspaceItem,
  getWorkspaceBrand,
  getWorkspaceCardIconKey,
  getWorkspaceSectionDescription,
  getWorkspaceSectionTitle,
  getWorkspaceProjectMenuOptions
} from '@/utils/workspaceDisplay'
import { useWorkspaceStore } from '@/stores/workspace'
import { useAuthStore } from '@/stores/auth'
import { notifier } from '@/utils/notifier'
import { useAvatarUpload } from '@/hooks/useAvatarUpload'

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
const showTemplatePreviewModal = ref(false)
const previewTemplate = ref(null)
const refreshingProjectId = ref('')
const showCreateWorkspaceModal = ref(false)
const showInviteWorkspaceModal = ref(false)
const showLeaveWorkspaceModal = ref(false)
const createWorkspaceName = ref('')
const createWorkspaceAvatarUrl = ref('')
const createdWorkspaceInviteUrl = ref('')
const workspaceCreateLoading = ref(false)
const directInviteValue = ref('')
const directInviteLoading = ref(false)
const workspaceInviteUrl = ref('')
const inviteLinkLoading = ref(false)
const transferMembers = ref([])
const transferToUserId = ref('')
const leaveLoading = ref(false)
const activeTemplateScope = ref('workspace')

const navItems = [
  { key: 'projects', label: 'My Project', icon: FolderOpenOutline },
  { key: 'shared', label: 'Shared with me', icon: PersonOutline },
  { key: 'featured', label: 'Shared Template', icon: BookmarkOutline }
]

const templateTabs = [
  { key: 'community', label: 'Community' },
  { key: 'workspace', label: 'Workspace' },
  { key: 'my', label: 'My' },
  { key: 'favorites', label: 'Favorites' }
]

const workspaceCardIcons = {
  project: FolderOpenOutline,
  image: ImageOutline,
  video: SparklesOutline,
  default: GridOutline
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
  acceptWorkspaceInvite,
  createTeamWorkspace,
  createWorkspaceDirectInvite,
  createWorkspaceInviteLink,
  favoriteSharedTemplate,
  joinWorkspaceInvite,
  loadCurrentWorkspace,
  loadFeaturedTemplates,
  loadPendingWorkspaceInvites,
  loadWorkspaceMembers,
  loadWorkspaces,
  leaveWorkspace,
  selectWorkspace,
  unfavoriteSharedTemplate,
  useSharedTemplate
} = useWorkspaceStore()

const workspaceBrand = computed(() => getWorkspaceBrand({
  user: user.value,
  currentWorkspace: currentWorkspace.value
}))

const sectionTitle = computed(() => getWorkspaceSectionTitle(activeSection.value))

const sectionDescription = computed(() => getWorkspaceSectionDescription(activeSection.value))

const sectionItems = computed(() => {
  if (activeSection.value === 'featured') return featuredTemplates.value
  if (activeSection.value === 'shared') {
    return projects.value.filter((project) => project.permission === 'viewer')
  }
  return projects.value.filter((project) => project.permission !== 'viewer')
})

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

const projectMenuOptions = getWorkspaceProjectMenuOptions

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
  if (key === 'delete') {
    openDelete(project)
  }
}

const handleLogout = async () => {
  await logout()
  await router.push('/')
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
  if (activeSection.value === 'projects' || activeSection.value === 'shared') {
    await router.push(`/canvas/${item.id}`)
    return
  }
  openTemplatePreview(item)
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
    await initProjectsStore()
    await router.push(`/canvas/${project.id}`)
  } catch (error) {
    notifier.error(getErrorMessage(error, 'Failed to create project from template'))
  }
}

const reloadWorkspaceData = async () => {
  await initProjectsStore()
  await loadFeaturedTemplates(activeTemplateScope.value)
}

const handleSelectWorkspace = async (workspaceId) => {
  if (!workspaceId || workspaceId === currentWorkspace.value?.id) return
  try {
    await selectWorkspace(workspaceId)
    activeSection.value = 'projects'
    await reloadWorkspaceData()
  } catch (error) {
    notifier.error(getErrorMessage(error, 'Failed to switch workspace'))
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
    await createTeamWorkspace({
      name: createWorkspaceName.value.trim(),
      avatarUrl: createWorkspaceAvatarUrl.value || null
    })
    const invite = await createWorkspaceInviteLink(currentWorkspace.value?.id)
    createdWorkspaceInviteUrl.value = invite?.inviteUrl || ''
    workspaceInviteUrl.value = createdWorkspaceInviteUrl.value
    await reloadWorkspaceData()
    notifier.success('Workspace created')
  } catch (error) {
    notifier.error(getErrorMessage(error, 'Failed to create workspace'))
  } finally {
    workspaceCreateLoading.value = false
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

const confirmLeaveWorkspace = async () => {
  leaveLoading.value = true
  try {
    await leaveWorkspace(currentWorkspace.value?.id, { transferToUserId: transferToUserId.value || null })
    showLeaveWorkspaceModal.value = false
    activeSection.value = 'projects'
    await reloadWorkspaceData()
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
    activeSection.value = 'projects'
    await reloadWorkspaceData()
    notifier.success('Workspace joined')
  } catch (error) {
    notifier.error(getErrorMessage(error, 'Failed to accept invite'))
  }
}

const changeTemplateScope = async (scope) => {
  activeTemplateScope.value = scope
  await loadFeaturedTemplates(scope)
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

const openTemplatePreview = (item) => {
  previewTemplate.value = item || null
  showTemplatePreviewModal.value = true
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

const loadWorkspaceSurfaces = async () => {
  try {
    await loadCurrentWorkspace()
    await loadWorkspaces()
  } catch {
    currentWorkspace.value = null
  }

  try {
    await loadPendingWorkspaceInvites()
  } catch {
    pendingWorkspaceInvites.value = []
  }

  try {
    await loadFeaturedTemplates(activeTemplateScope.value)
  } catch {
    featuredTemplates.value = []
  }
}

onMounted(async () => {
  await bootstrapAuth()
  const inviteToken = String(route.params?.token || '').trim()
  if (inviteToken) {
    try {
      await joinWorkspaceInvite(inviteToken)
      notifier.success('Workspace joined')
    } catch (error) {
      notifier.error(getErrorMessage(error, 'Invite link is invalid or expired'))
    }
  }
  await initProjectsStore()
  await loadWorkspaceSurfaces()
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

@media (max-width: 900px) {
  .workspace-shell {
    grid-template-columns: 1fr;
  }
}
</style>
