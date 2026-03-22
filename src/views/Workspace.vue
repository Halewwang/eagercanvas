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

      <div class="sidebar-footer">
        <button class="link-btn" @click="router.push('/')">Back Home</button>
      </div>
    </aside>

    <main class="workspace-main">
      <header class="main-header">
        <div>
          <h1>{{ sectionTitle }}</h1>
          <p>{{ sectionDescription }}</p>
        </div>
        <div class="header-actions">
          <button class="ghost-btn" @click="openCutter">Open Cutter</button>
          <button class="ghost-btn" @click="createBlankProject">Blank Project</button>
          <button class="primary-btn" @click="createBlankProject">
            <n-icon :size="16"><AddOutline /></n-icon>
            <span>New Project</span>
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
            <template v-if="item.thumbnail || item.cover">
              <img :src="item.thumbnail || item.cover" :alt="item.name" />
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
                <n-dropdown
                  trigger="click"
                  placement="bottom-end"
                  :options="projectMenuOptions(item)"
                  @select="(key) => handleProjectMenuSelect(key, item)"
                >
                  <button class="menu-btn project-menu-btn" @click.stop>
                    <n-icon :size="16"><EllipsisHorizontalOutline /></n-icon>
                  </button>
                </n-dropdown>
              </div>
            </template>
            <template v-else>
              <div class="title-row">
                <h3>{{ item.name }}</h3>
                <span v-if="activeSection === 'featured'" class="badge">Public</span>
                <span v-if="activeSection === 'my-templates'" class="badge mine">Mine</span>
              </div>
              <p>{{ describeItem(item) }}</p>
            </template>

            <div v-if="activeSection !== 'projects'" class="card-actions" @click.stop>
              <template v-if="activeSection === 'my-templates'">
                <button class="mini-btn" @click="toggleTemplateVisibility(item)">
                  {{ item.visibility === 'public' ? 'Unpublish' : 'Publish' }}
                </button>
                <button class="mini-btn danger" @click="deleteTemplate(item.id)">Delete</button>
              </template>
              <template v-else>
                <button class="mini-btn" @click="saveAsMyTemplate(item)">Save to My</button>
                <button class="mini-btn" @click="useTemplate(item)">Use</button>
              </template>
            </div>
          </div>
        </article>
      </section>
    </main>

    <n-modal v-model:show="showRenameModal" preset="dialog" title="Rename Project" :show-icon="false">
      <input
        v-model="renameValue"
        class="modal-input"
        placeholder="Enter project name"
        @keyup.enter="confirmRename"
      />
      <template #action>
        <button class="ghost-btn" @click="showRenameModal = false">Cancel</button>
        <button class="primary-btn" @click="confirmRename">Save</button>
      </template>
    </n-modal>

    <n-modal v-model:show="showDeleteModal" preset="dialog" title="Delete Project" type="warning">
      <p>Delete "{{ deleteTargetName }}"? This action cannot be undone.</p>
      <template #action>
        <button class="ghost-btn" @click="showDeleteModal = false">Cancel</button>
        <button class="mini-btn danger" @click="confirmDelete">Delete</button>
      </template>
    </n-modal>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { NDropdown, NIcon, NModal } from 'naive-ui'
import {
  AddOutline,
  FolderOpenOutline,
  BookmarkOutline,
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
  deleteProject,
  updateProject
} from '@/stores/projects'
import { apiListGeneratedVideos } from '@/api/media'
import { getErrorMessage } from '@/utils'
import { useWorkflowsStore } from '@/stores/workflows'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const { user, bootstrapAuth } = useAuthStore()
const openCutUrl = String(import.meta.env.VITE_OPENCUT_URL || '').trim()

const postAssetsToOpenCut = ({ targetWindow, targetOrigin, assets }) => {
  const payload = {
    type: 'OPEN_CUT_IMPORT_ASSETS',
    payload: {
      assets,
      source: 'ai-canvas',
      sentAt: new Date().toISOString()
    }
  }

  let attempts = 0
  const maxAttempts = 20
  const timer = window.setInterval(() => {
    if (!targetWindow || targetWindow.closed) {
      window.clearInterval(timer)
      return
    }

    attempts += 1
    targetWindow.postMessage(payload, targetOrigin)

    if (attempts >= maxAttempts) {
      window.clearInterval(timer)
    }
  }, 750)

  return timer
}

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
  { key: 'my-templates', label: 'My Templates', icon: BookmarkOutline },
  { key: 'featured', label: 'Featured Templates', icon: SparklesOutline }
]

const {
  myWorkflows,
  publicWorkflows,
  loadWorkflowTemplates,
  createMyWorkflowTemplate,
  deleteMyWorkflowTemplate,
  setWorkflowTemplateVisibility,
  resolveWorkflowTemplate
} = useWorkflowsStore()

const workspaceBrand = computed(() => {
  const raw = String(
    user.value?.displayName ||
    user.value?.id ||
    user.value?.email?.split('@')?.[0] ||
    'User'
  )
  const normalized = raw.split(/[\s_-]/).filter(Boolean)[0] || 'User'
  const label = normalized.charAt(0).toUpperCase() + normalized.slice(1)
  return `${label} WorkSpace`
})

const sectionTitle = computed(() => {
  if (activeSection.value === 'my-templates') return 'My Templates'
  if (activeSection.value === 'featured') return 'Featured Workflows'
  return 'Recent Projects'
})

const sectionDescription = computed(() => {
  if (activeSection.value === 'my-templates') {
    return 'Manage templates shared from your own projects and system presets.'
  }
  if (activeSection.value === 'featured') {
    return 'Public templates published by users.'
  }
  return 'Project cover is shown as 16:9. Manage project actions from the menu.'
})

const sectionItems = computed(() => {
  if (activeSection.value === 'my-templates') return myWorkflows.value
  if (activeSection.value === 'featured') return publicWorkflows.value
  return projects.value
})

const filteredItems = computed(() => {
  const text = keyword.value.toLowerCase()
  if (!text) return sectionItems.value
  return sectionItems.value.filter((item) => String(item?.name || '').toLowerCase().includes(text))
})

const describeItem = (item) => {
  if (activeSection.value === 'projects') return `Updated ${formatDate(item.updatedAt)}`
  if (activeSection.value === 'my-templates') return item.visibility === 'public' ? 'Published to Featured' : 'Private template'
  return item.description || 'Template'
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
    window.$message?.[ok ? 'success' : 'warning'](ok ? 'Project link copied' : 'Copy failed')
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
    window.$message?.error(getErrorMessage(error, 'Failed to create project'))
  }
}

const openCutter = async () => {
  if (!openCutUrl) {
    window.$message?.warning('OpenCut URL is not configured')
    return
  }

  const nextWindow = window.open('', '_blank')
  if (!nextWindow) {
    window.$message?.warning('Popup blocked. Please allow popups and retry.')
    return
  }

  nextWindow.document.write('<title>OpenCut</title><p style="font-family: sans-serif; padding: 24px;">Loading OpenCut assets...</p>')

  try {
    const response = await apiListGeneratedVideos()
    const assets = Array.isArray(response?.data) ? response.data : []

    if (!assets.length) {
      nextWindow.close()
      window.$message?.warning('No generated videos found')
      return
    }

    const targetOrigin = new URL(openCutUrl, window.location.origin).origin
    nextWindow.location.replace(openCutUrl)
    postAssetsToOpenCut({ targetWindow: nextWindow, targetOrigin, assets })

    window.$message?.success(`Prepared ${assets.length} video asset${assets.length > 1 ? 's' : ''} for OpenCut`)
  } catch (error) {
    nextWindow.close()
    window.$message?.error(getErrorMessage(error, 'Failed to load videos'))
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
  if (item.sourceType === 'project' && item.canvasData) {
    try {
      const id = await createProject(item.name || 'Untitled')
      await updateProject(id, {
        canvasData: JSON.parse(JSON.stringify(item.canvasData)),
        thumbnail: item.cover || ''
      })
      await router.push(`/canvas/${id}`)
    } catch (error) {
      window.$message?.error(getErrorMessage(error, 'Failed to create project from template'))
    }
    return
  }

  const workflow = resolveWorkflowTemplate(item)
  if (!workflow) {
    window.$message?.warning('Template unavailable')
    return
  }
  try {
    const id = await createProject(workflow.name || item.name || 'Untitled')
    sessionStorage.setItem(
      'ai-canvas-workflow-template',
      JSON.stringify({ workflowId: workflow.id })
    )
    await router.push(`/canvas/${id}`)
  } catch (error) {
    window.$message?.error(getErrorMessage(error, 'Failed to create project from template'))
  }
}

const saveAsMyTemplate = async (item) => {
  await createMyWorkflowTemplate({ baseWorkflowId: item.baseWorkflowId || item.id })
  activeSection.value = 'my-templates'
  window.$message?.success('Saved to My Templates')
}

const toggleTemplateVisibility = async (item) => {
  const nextVisibility = item.visibility === 'public' ? 'private' : 'public'
  await setWorkflowTemplateVisibility(item.id, nextVisibility)
  window.$message?.success(nextVisibility === 'public' ? 'Template published' : 'Template unpublished')
}

const deleteTemplate = async (id) => {
  await deleteMyWorkflowTemplate(id)
  window.$message?.success('Template deleted')
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
  window.$message?.success('Project renamed')
}

const duplicate = async (project) => {
  await duplicateProject(project.id)
  window.$message?.success('Project duplicated')
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
  window.$message?.success('Project deleted')
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
  await loadWorkflowTemplates()
})
</script>

<style scoped>
.workspace-shell {
  min-height: 100vh;
  background: #0f1014;
  color: #eceef4;
  display: grid;
  grid-template-columns: 280px 1fr;
}

.workspace-sidebar {
  border-right: 1px solid rgba(255, 255, 255, 0.12);
  padding: 22px 14px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 8px;
}

.brand-logo {
  width: 28px;
  height: 28px;
  border-radius: 50%;
}

.brand-text {
  font-size: 20px;
  font-weight: 600;
  line-height: 1;
}

.search-box {
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 10px;
  padding: 8px 10px;
  background: rgba(255, 255, 255, 0.03);
}

.search-box input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: #eceef4;
  font-size: 13px;
}

.nav-menu {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.nav-item {
  height: 40px;
  border: none;
  background: transparent;
  color: rgba(236, 238, 244, 0.72);
  border-radius: 10px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 12px;
  cursor: pointer;
  font-size: 15px;
}

.nav-item.active {
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
}

.sidebar-footer {
  margin-top: auto;
}

.workspace-main {
  padding: 24px;
}

.main-header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
  padding-bottom: 16px;
  margin-bottom: 18px;
}

.main-header h1 {
  margin: 0;
  font-size: 30px;
  font-weight: 600;
}

.main-header p {
  margin: 6px 0 0;
  color: rgba(236, 238, 244, 0.65);
  font-size: 13px;
}

.header-actions {
  display: flex;
  gap: 10px;
}

.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 18px;
}

.project-card {
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.create-card {
  gap: 14px;
}

.card-media {
  aspect-ratio: 16 / 9;
  background: #1c1f27;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 20px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.12);
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
}

.project-media {
  background: #111214;
}

.fallback-icon {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(236, 238, 244, 0.7);
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
  font-size: 17px;
  flex: 1;
}

.badge {
  border: 1px solid #60a5fa;
  color: #60a5fa;
  border-radius: 999px;
  font-size: 11px;
  padding: 2px 8px;
}

.badge.mine {
  border-color: #22c55e;
  color: #22c55e;
}

.menu-btn {
  width: 32px;
  height: 32px;
  border-radius: 999px;
  border: none;
  background: transparent;
  color: rgba(236, 238, 244, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.menu-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
}

.card-body p {
  margin: 8px 0 0;
  color: rgba(236, 238, 244, 0.65);
  font-size: 13px;
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
  font-size: 16px;
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
  line-height: 1.3;
}

.project-menu-btn {
  margin-top: -2px;
  flex-shrink: 0;
}

.card-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.mini-btn,
.primary-btn,
.ghost-btn,
.link-btn {
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: transparent;
  color: #eceef4;
  height: 30px;
  padding: 0 10px;
  font-size: 12px;
  cursor: pointer;
}

.primary-btn {
  background: #4f46e5;
  color: #fff;
  border-color: #4f46e5;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.ghost-btn:hover,
.mini-btn:hover,
.link-btn:hover {
  border-color: rgba(255, 255, 255, 0.38);
}

.mini-btn.danger {
  border-color: #ef4444;
  color: #ef4444;
}

.modal-input {
  width: 100%;
  background: #1c1f27;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 8px;
  color: #eceef4;
  padding: 10px;
}

@media (max-width: 900px) {
  .workspace-shell {
    grid-template-columns: 1fr;
  }

  .workspace-sidebar {
    border-right: none;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }
}
</style>
