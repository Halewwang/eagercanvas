<template>
  <div class="workspace-shell">
    <WorkspaceSidebar
      v-model:active-section="activeSection"
      :workspace-brand="workspaceBrand"
      :nav-items="navItems"
      :is-authenticated="isAuthenticated"
      :user="user"
      :avatar-initial="avatarInitial"
      @upload-avatar="triggerAvatarUpload"
      @usage="router.push('/usage')"
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

      <WorkspaceCardsGrid
        :active-section="activeSection"
        :items="sectionItems"
        :describe-item="describeItem"
        :resolve-card-icon="resolveCardIcon"
        :project-menu-options="projectMenuOptions"
        @primary-click="handlePrimaryClick"
        @project-menu-select="handleProjectMenuSelect"
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
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  FolderOpenOutline,
  ImageOutline,
  SparklesOutline,
  GridOutline,
  GlobeOutline
} from '@/icons/coolicons'
import {
  projects,
  initProjectsStore,
  createProject,
  renameProject,
  duplicateProject,
  deleteProject,
  refreshProjectById
} from '@/stores/projects'
import WorkspaceCardsGrid from '@/components/workspace/WorkspaceCardsGrid.vue'
import WorkspaceHeader from '@/components/workspace/WorkspaceHeader.vue'
import WorkspaceModals from '@/components/workspace/WorkspaceModals.vue'
import WorkspaceSidebar from '@/components/workspace/WorkspaceSidebar.vue'
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

const navItems = [
  { key: 'projects', label: 'My Project', icon: FolderOpenOutline },
  { key: 'featured', label: 'Share Templates', icon: GlobeOutline }
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
  featuredTemplates,
  loadCurrentWorkspace,
  loadFeaturedTemplates,
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
  return projects.value
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
  if (activeSection.value === 'projects') {
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
  } catch {
    currentWorkspace.value = null
  }

  try {
    await loadFeaturedTemplates()
  } catch {
    featuredTemplates.value = []
  }
}

onMounted(async () => {
  await bootstrapAuth()
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

@media (max-width: 900px) {
  .workspace-shell {
    grid-template-columns: 1fr;
  }
}
</style>
