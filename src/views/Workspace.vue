<template>
  <div class="workspace-shell">
    <aside class="workspace-sidebar">
      <div class="brand">
        <img src="/project-logo.svg" alt="logo" class="brand-logo" />
        <div class="brand-text">Eager Canvas</div>
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
            <h3>Empty Project</h3>
            <p>Create a new canvas project</p>
          </div>
        </article>

        <article
          v-for="item in filteredItems"
          :key="item.id"
          class="project-card"
          @click="handlePrimaryClick(item)"
        >
          <div class="card-media">
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
            <div class="title-row">
              <h3>{{ item.name }}</h3>
              <span v-if="activeSection === 'featured'" class="badge">Public</span>
              <span v-if="activeSection === 'my-templates'" class="badge mine">Mine</span>
              <span v-if="activeSection === 'starter'" class="badge starter">System</span>
            </div>
            <p>{{ describeItem(item) }}</p>
            <div class="card-actions" @click.stop>
              <template v-if="activeSection === 'projects'">
                <button class="mini-btn" @click="openRename(item)">Rename</button>
                <button class="mini-btn" @click="duplicate(item)">Duplicate</button>
                <button class="mini-btn danger" @click="openDelete(item)">Delete</button>
              </template>
              <template v-else-if="activeSection === 'my-templates'">
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
import { NIcon, NModal } from 'naive-ui'
import {
  AddOutline,
  FolderOpenOutline,
  BookmarkOutline,
  SparklesOutline,
  GridOutline,
  SearchOutline
} from '../icons/coolicons'
import {
  projects,
  initProjectsStore,
  createProject,
  renameProject,
  duplicateProject,
  deleteProject
} from '@/stores/projects'
import { getErrorMessage } from '@/utils'
import { useWorkflowsStore } from '@/stores/workflows'

const router = useRouter()

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
  { key: 'featured', label: 'Featured Templates', icon: SparklesOutline },
  { key: 'starter', label: 'Starter Templates', icon: GridOutline }
]

const {
  systemWorkflows,
  myWorkflows,
  publicWorkflows,
  loadWorkflowTemplates,
  createMyWorkflowTemplate,
  deleteMyWorkflowTemplate,
  setWorkflowTemplateVisibility,
  resolveWorkflowTemplate
} = useWorkflowsStore()

const sectionTitle = computed(() => {
  switch (activeSection.value) {
    case 'my-templates':
      return 'My Templates'
    case 'featured':
      return 'Featured Workflows'
    case 'starter':
      return 'Starter Templates'
    default:
      return 'Recent Projects'
  }
})

const sectionDescription = computed(() => {
  switch (activeSection.value) {
    case 'my-templates':
      return 'Create and manage your private or public workflow templates.'
    case 'featured':
      return 'Public templates published by you and your team.'
    case 'starter':
      return 'System templates to jumpstart common creative workflows.'
    default:
      return 'Manage projects, quickly duplicate ideas, and jump into canvas editing.'
  }
})

const sectionItems = computed(() => {
  if (activeSection.value === 'my-templates') return myWorkflows.value
  if (activeSection.value === 'featured') return publicWorkflows.value
  if (activeSection.value === 'starter') return systemWorkflows.value
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

const createBlankProject = async () => {
  try {
    const id = await createProject('Untitled')
    await router.push(`/canvas/${id}`)
  } catch (error) {
    window.$message?.error(getErrorMessage(error, 'Failed to create project'))
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
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`
  return `${d.getMonth() + 1}/${d.getDate()}`
}

onMounted(async () => {
  await initProjectsStore()
  await loadWorkflowTemplates()
})
</script>

<style scoped>
.workspace-shell {
  min-height: 100vh;
  background: var(--bg-primary);
  color: var(--text-primary);
  display: grid;
  grid-template-columns: 260px 1fr;
}

.workspace-sidebar {
  border-right: 1px solid var(--border-color);
  padding: 24px 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
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
  font-size: 18px;
  font-weight: 600;
}

.search-box {
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 8px 10px;
  background: var(--bg-secondary);
}

.search-box input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text-primary);
  font-size: 13px;
}

.nav-menu {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nav-item {
  height: 40px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  border-radius: 10px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 12px;
  cursor: pointer;
  font-size: 14px;
}

.nav-item.active {
  background: var(--bg-secondary);
  color: var(--text-primary);
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
  border-bottom: 1px solid var(--border-color);
  padding-bottom: 16px;
  margin-bottom: 18px;
}

.main-header h1 {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
}

.main-header p {
  margin: 6px 0 0;
  color: var(--text-secondary);
  font-size: 13px;
}

.header-actions {
  display: flex;
  gap: 10px;
}

.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}

.project-card {
  border: 1px solid var(--border-color);
  border-radius: 14px;
  overflow: hidden;
  background: var(--bg-secondary);
  cursor: pointer;
}

.create-card {
  border-style: dashed;
}

.card-media {
  aspect-ratio: 16 / 9;
  background: var(--bg-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
}

.card-media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.create-media {
  color: var(--text-tertiary);
}

.fallback-icon {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
}

.card-body {
  padding: 12px;
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

.badge.starter {
  border-color: #a78bfa;
  color: #a78bfa;
}

.card-body p {
  margin: 8px 0 0;
  color: var(--text-secondary);
  font-size: 12px;
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
  border: 1px solid var(--border-color);
  background: transparent;
  color: var(--text-primary);
  height: 30px;
  padding: 0 10px;
  font-size: 12px;
  cursor: pointer;
}

.primary-btn {
  background: var(--accent-color);
  color: #fff;
  border-color: var(--accent-color);
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.ghost-btn:hover,
.mini-btn:hover,
.link-btn:hover {
  border-color: var(--text-secondary);
}

.mini-btn.danger {
  border-color: #ef4444;
  color: #ef4444;
}

.modal-input {
  width: 100%;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  color: var(--text-primary);
  padding: 10px;
}

@media (max-width: 900px) {
  .workspace-shell {
    grid-template-columns: 1fr;
  }

  .workspace-sidebar {
    border-right: none;
    border-bottom: 1px solid var(--border-color);
  }
}
</style>

