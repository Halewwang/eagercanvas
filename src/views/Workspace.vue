<template>
  <div class="workspace-shell">
    <aside class="workspace-sidebar">
      <div class="brand">
        <img src="/project-logo.svg" alt="logo" class="brand-logo" />
        <div class="brand-text">{{ workspaceBrand }}</div>
      </div>

      <div class="search-box">
        <n-icon :size="16"><SearchOutline /></n-icon>
        <input v-model.trim="keyword" placeholder="Search projects and templates" />
      </div>

      <section class="sidebar-group">
        <div class="sidebar-group-title">Workspace</div>
        <nav class="nav-menu">
          <button
            v-for="item in navItems"
            :key="item.key"
            class="nav-item"
            :class="{ active: activeSection === item.key }"
            @click="activeSection = item.key"
          >
            <n-icon :size="16"><component :is="item.icon" /></n-icon>
            <span>{{ item.label }}</span>
          </button>
        </nav>
      </section>

    </aside>

    <main class="workspace-main">
      <header class="main-header">
        <div>
          <h1>{{ sectionTitle }}</h1>
          <p>{{ sectionDescription }}</p>
        </div>
        <div class="header-actions">
          <button class="ui-action-pill" @click="router.push('/')">
            <n-icon :size="18"><GridOutline /></n-icon>
            <span class="ui-action-pill-label">Back Home</span>
          </button>
          <button class="ui-action-pill" @click="createBlankProject">
            <n-icon :size="16"><AddOutline /></n-icon>
            <span class="ui-action-pill-label">New Project</span>
          </button>
        </div>
      </header>

      <section class="cards-grid">
        <article
          v-if="activeSection === 'projects'"
          class="project-card create-card"
          @click="createBlankProject"
        >
          <div class="card-media create-media">
            <n-icon :size="44"><AddOutline /></n-icon>
          </div>
          <div class="card-body">
            <h3>Blank Project</h3>
            <p>Create a new blank project</p>
          </div>
        </article>

        <article
          v-for="item in filteredItems"
          :key="item.id"
          class="project-card"
          @click="handlePrimaryClick(item)"
        >
          <div class="card-media" :class="{ 'project-media': activeSection === 'projects' }">
            <template v-if="item.thumbnail || item.cover || item.coverUrl">
              <img :src="item.thumbnail || item.cover || item.coverUrl" :alt="item.title || item.name" />
            </template>
            <template v-else>
              <div class="fallback-icon">
                <n-icon :size="28"><component :is="resolveCardIcon(item)" /></n-icon>
              </div>
            </template>
          </div>

          <div class="card-body">
            <template v-if="activeSection === 'projects'">
              <div class="project-meta-row">
                <div class="project-meta-main">
                  <h3>{{ item.name }}</h3>
                  <p>{{ describeItem(item) }}</p>
                </div>
                <BaseDropdown
                  placement="bottom-end"
                  :options="projectMenuOptions(item)"
                  @select="(key) => handleProjectMenuSelect(key, item)"
                >
                  <button class="menu-btn project-menu-btn" @click.stop>
                    <n-icon :size="16"><EllipsisHorizontalOutline /></n-icon>
                  </button>
                </BaseDropdown>
              </div>
            </template>
            <template v-else>
              <div class="title-row">
                <h3>{{ item.title || item.name }}</h3>
                <span v-if="activeSection === 'featured'" class="badge">Public</span>
              </div>
              <p>{{ describeItem(item) }}</p>
            </template>

            <div v-if="activeSection !== 'projects'" class="card-actions" @click.stop>
              <BaseButton size="sm" @click="useTemplate(item)">Use</BaseButton>
            </div>
          </div>
        </article>
      </section>
    </main>

    <BaseModal
      v-model:show="showRenameModal"
      title="Rename project"
      description="Update the project name shown in your workspace."
      size="sm"
    >
      <BaseInput
        v-model="renameValue"
        placeholder="Enter project name"
        @keyup.enter="confirmRename"
      />
      <template #footer>
        <div class="ui-modal-actions">
          <BaseButton variant="ghost" @click="showRenameModal = false">Cancel</BaseButton>
          <BaseButton @click="confirmRename">Save</BaseButton>
        </div>
      </template>
    </BaseModal>

    <BaseModal
      v-model:show="showDeleteModal"
      title="Delete project"
      description="This action permanently removes the project from your workspace."
      size="sm"
    >
      <p class="ui-body ui-modal-copy">Delete "{{ deleteTargetName }}"? This action cannot be undone.</p>
      <template #footer>
        <div class="ui-modal-actions">
          <BaseButton variant="ghost" @click="showDeleteModal = false">Cancel</BaseButton>
          <BaseButton variant="danger" @click="confirmDelete">Delete</BaseButton>
        </div>
      </template>
    </BaseModal>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { NIcon } from 'naive-ui'
import {
  AddOutline,
  FolderOpenOutline,
  SparklesOutline,
  GridOutline,
  SearchOutline,
  EllipsisHorizontalOutline
} from '../icons/coolicons'
import {
  projects,
  initProjectsStore,
  createProject,
  renameProject,
  duplicateProject,
  deleteProject
} from '@/stores/projects'
import { BaseButton, BaseDropdown, BaseInput, BaseModal } from '@/components/ui'
import { getErrorMessage } from '@/utils'
import { useWorkspaceStore } from '@/stores/workspace'
import { useAuthStore } from '@/stores/auth'
import { notifier } from '@/utils/notifier'

const router = useRouter()
const { bootstrapAuth } = useAuthStore()

const activeSection = ref('projects')
const keyword = ref('')

const showRenameModal = ref(false)
const renameTargetId = ref('')
const renameValue = ref('')
const showDeleteModal = ref(false)
const deleteTargetId = ref('')
const deleteTargetName = ref('')

const navItems = [
  { key: 'projects', label: 'Recent Projects', icon: FolderOpenOutline },
  { key: 'featured', label: 'Featured Templates', icon: SparklesOutline }
]

const {
  currentWorkspace,
  featuredTemplates,
  loadCurrentWorkspace,
  loadFeaturedTemplates,
  useSharedTemplate
} = useWorkspaceStore()

const workspaceBrand = computed(() => {
  return currentWorkspace.value?.name || 'Shared Workspace'
})

const sectionTitle = computed(() => {
  if (activeSection.value === 'featured') return 'Featured Templates'
  return 'Recent Projects'
})

const sectionDescription = computed(() => {
  if (activeSection.value === 'featured') {
    return 'Templates published by workspace members. Using one creates a full copy in your own projects.'
  }
  return 'Project cover is shown as 16:9. Manage project actions from the menu.'
})

const sectionItems = computed(() => {
  if (activeSection.value === 'featured') return featuredTemplates.value
  return projects.value
})

const filteredItems = computed(() => {
  const text = keyword.value.toLowerCase()
  if (!text) return sectionItems.value
  return sectionItems.value.filter((item) => String(item?.title || item?.name || '').toLowerCase().includes(text))
})

const describeItem = (item) => {
  if (activeSection.value === 'projects') return `Updated ${formatDate(item.updatedAt)}`
  const owner = String(item?.ownerDisplayName || '').trim()
  const detail = String(item?.description || '').trim()
  if (owner && detail) return `${owner} · ${detail}`
  if (owner) return owner
  return detail || 'Template'
}

const resolveCardIcon = (item) => {
  if (activeSection.value === 'projects') return FolderOpenOutline
  if (item.icon === 'ImageOutline') return AddOutline
  if (item.icon === 'VideocamOutline') return SparklesOutline
  return GridOutline
}

const projectMenuOptions = () => [
  { label: 'Copy project link', key: 'copy-link' },
  { label: 'Rename project', key: 'rename' },
  { label: 'Duplicate project', key: 'duplicate' },
  { type: 'divider', key: 'divider-1' },
  { label: 'Delete project', key: 'delete' }
]

const copyText = async (text) => {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

const handleProjectMenuSelect = async (key, project) => {
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
  await useTemplate(item)
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

const formatDate = (date) => {
  if (!date) return 'just now'
  const d = new Date(date)
  const now = new Date()
  const diff = now - d
  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} minutes ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`
  if (diff < 604800000) return `${Math.floor(diff / 86400000)} days ago`
  return `${d.getMonth() + 1}/${d.getDate()}`
}

onMounted(async () => {
  await bootstrapAuth()
  await initProjectsStore()
  await loadCurrentWorkspace()
  await loadFeaturedTemplates()
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

.workspace-sidebar {
  border-right: 1px solid rgba(255, 255, 255, 0.08);
  padding: 24px 16px;
  display: flex;
  flex-direction: column;
  gap: 18px;
  background: rgba(255, 255, 255, 0.015);
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 10px 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.brand-logo {
  width: 28px;
  height: 28px;
  border-radius: 50%;
}

.brand-text {
  font-size: 18px;
  font-weight: 600;
  line-height: 1;
  letter-spacing: -0.01em;
}

.search-box {
  display: flex;
  align-items: center;
  gap: 10px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.03);
}

.search-box input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: #f0f1f3;
  font-size: 14px;
}

.nav-menu {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.sidebar-group {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.sidebar-group-title {
  padding: 0 12px;
  color: rgba(236, 238, 244, 0.45);
  font-size: 12px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.nav-item {
  height: 42px;
  border: none;
  background: transparent;
  color: rgba(236, 238, 244, 0.72);
  border-radius: 14px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 12px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.2s ease, color 0.2s ease;
}

.nav-item.active {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
}

.workspace-main {
  padding: 28px;
}

.main-header {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  padding-bottom: 20px;
  margin-bottom: 22px;
}

.main-header h1 {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.main-header p {
  margin: 10px 0 0;
  color: rgba(236, 238, 244, 0.65);
  font-size: 13px;
  line-height: 1.55;
  max-width: 560px;
}

.header-actions {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}

.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 22px;
}

.project-card {
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.create-card {
  gap: 14px;
}

.card-media {
  aspect-ratio: 16 / 9;
  background:
    radial-gradient(circle at 50% 28%, rgba(255, 255, 255, 0.035), transparent 48%),
    linear-gradient(180deg, #18191c 0%, #141518 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 24px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.08);
  transition: border-color 0.2s ease, background-color 0.2s ease, transform 0.2s ease;
}

.project-card:hover .card-media {
  border-color: rgba(255, 255, 255, 0.14);
}

.card-media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.create-media {
  color: rgba(236, 238, 244, 0.45);
  border-style: dashed;
  background:
    radial-gradient(circle at 50% 38%, rgba(255, 255, 255, 0.04), transparent 52%),
    linear-gradient(180deg, #1a1b1e 0%, #151619 100%);
}

.project-media {
  background:
    radial-gradient(circle at 50% 24%, rgba(255, 255, 255, 0.02), transparent 46%),
    linear-gradient(180deg, #111214 0%, #0d0e10 100%);
}

.fallback-icon {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(236, 238, 244, 0.7);
  background: rgba(255, 255, 255, 0.015);
}

.card-body {
  padding: 0;
}

.title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.title-row h3 {
  margin: 0;
  font-size: 15px;
  flex: 1;
}

.badge {
  border: 1px solid rgba(255, 255, 255, 0.14);
  color: rgba(240, 241, 243, 0.88);
  background: rgba(255, 255, 255, 0.04);
  border-radius: 999px;
  font-size: 11px;
  padding: 3px 9px;
}

.badge.mine {
  border-color: rgba(255, 255, 255, 0.2);
  color: rgba(255, 255, 255, 0.88);
  background: rgba(255, 255, 255, 0.06);
}

.menu-btn {
  width: 36px;
  height: 36px;
  border-radius: 999px;
  border: 1px solid transparent;
  background: transparent;
  color: rgba(236, 238, 244, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  outline: none;
  transition: background-color 0.2s ease, color 0.2s ease;
}

.menu-btn:hover {
  background: rgba(255, 255, 255, 0.04);
  color: #fff;
}

.menu-btn:focus,
.menu-btn:focus-visible {
  outline: none;
  box-shadow: none;
}

.card-body p {
  margin: 8px 0 0;
  color: rgba(236, 238, 244, 0.65);
  font-size: 13px;
  line-height: 1.45;
}

.project-meta-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.project-meta-main {
  min-width: 0;
}

.project-meta-main h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.project-meta-main p {
  margin: 6px 0 0;
  color: rgba(236, 238, 244, 0.65);
  font-size: 13px;
  line-height: 1.35;
}

.project-menu-btn {
  margin-top: -2px;
  flex-shrink: 0;
}

.card-actions {
  display: flex;
  gap: 8px;
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

@media (max-width: 900px) {
  .workspace-shell {
    grid-template-columns: 1fr;
  }

  .workspace-sidebar {
    border-right: none;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }
}
</style>
