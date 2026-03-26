<template>
  <!-- Home page | 首页 -->
  <div class="home-shell h-screen overflow-y-auto overflow-x-hidden bg-[var(--bg-primary)] text-[var(--text-primary)] selection:bg-[var(--accent-color)] selection:text-white font-['fieldwork']">
    <!-- Background Elements -->
    <div class="fixed inset-0 pointer-events-none overflow-hidden">
      <div class="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] rounded-full bg-[var(--accent-color)] opacity-[0.03] blur-[120px]" />
      <div class="absolute bottom-[-20%] left-[-10%] w-[800px] h-[800px] rounded-full bg-[var(--accent-color)] opacity-[0.02] blur-[150px]" />
      <!-- Subtle Grid -->
      <div class="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.2)_1px,transparent_1px)] [background-size:20px_20px] opacity-50" />
    </div>

    <div class="relative z-20 max-w-[1400px] mx-auto px-6 pt-6 flex justify-end items-center gap-3">
      <template v-if="isAuthenticated">
      <button
        @click="triggerAvatarUpload"
        class="w-9 h-9 rounded-full overflow-hidden border border-[var(--border-color)] bg-[var(--bg-tertiary)] flex items-center justify-center"
        title="Upload avatar"
      >
        <img v-if="user?.avatarUrl" :src="user.avatarUrl" alt="avatar" class="w-full h-full object-cover" />
        <span v-else class="text-xs">{{ avatarInitial }}</span>
      </button>
      <span class="text-xs text-[var(--text-secondary)] max-w-[220px] truncate">{{ user?.email }}</span>
      <button
        @click="router.push('/usage')"
        class="flora-button-ghost px-4 py-2 rounded-xl text-sm"
      >
        Usage
      </button>
      <button
        @click="handleLogout"
        class="flora-button-ghost px-4 py-2 rounded-xl text-sm"
      >
        Logout
      </button>
      </template>
      <template v-else>
        <button
          @click="openLogin"
          class="flora-button-ghost px-4 py-2 rounded-xl text-sm"
        >
          Login
        </button>
        <button
          @click="openRegister"
          class="flora-button-primary px-4 py-2 rounded-xl text-sm"
        >
          Register
        </button>
      </template>
    </div>
    <input ref="avatarInputRef" type="file" accept="image/*" class="hidden" @change="handleAvatarChange" />

    <!-- Main content -->
    <main class="relative z-10 max-w-[1400px] mx-auto px-6 pt-16 pb-8 md:pt-24 md:pb-12">

      <!-- Hero Section -->
      <section class="flex flex-col items-center text-center mb-32 md:mb-48 relative">
        <div class="home-logo-ring mb-8">
          <img src="/project-logo.svg" alt="Eager Canvas logo" class="w-24 h-24 md:w-28 md:h-28 rounded-full" />
        </div>

        <div class="inline-flex items-center px-3 py-1 mb-6 rounded-full border border-[var(--border-color)] bg-[var(--bg-secondary)]/50 backdrop-blur-sm">
          <span class="w-2 h-2 rounded-full bg-[var(--accent-color)] mr-2 animate-pulse"></span>
          <span class="text-xs font-medium tracking-wide uppercase text-[var(--text-secondary)]">Infinite Creative Workspace</span>
        </div>

        <h1 class="font-thin text-4xl md:text-6xl lg:text-7xl mb-8 tracking-tight leading-none text-transparent bg-clip-text bg-gradient-to-b from-white to-white/60">
          Ling's Visuals <span class="font-normal text-[var(--accent-color)] font-['Sacramento'] ml-2">Canvas</span>
        </h1>
        
        <p class="max-w-2xl text-lg md:text-xl text-[var(--text-secondary)] font-light mb-12 leading-relaxed tracking-wide">
          Orchestrate your creative workflows on an infinite canvas. <br class="hidden md:block"/>
          From prompt to masterpiece in seconds.
        </p>

        <div class="w-full max-w-3xl relative group perspective-1000">
          <div class="absolute -inset-1 bg-gradient-to-r from-white/20 to-white/5 rounded-3xl opacity-30 blur-xl transition-opacity duration-500 group-hover:opacity-50" />

          <div class="relative flex flex-col md:flex-row items-center justify-center gap-4 md:gap-6 bg-[var(--bg-secondary)]/80 border border-[rgba(255,255,255,0.12)] rounded-3xl px-6 py-8 md:px-10 md:py-10 shadow-2xl backdrop-blur-sm">
            <button
              @click="enterCanvas"
              class="home-entry-button"
            >
              Canvas
            </button>
            <button
              @click="openEditorSpace"
              class="home-entry-button"
            >
              Editor Space
            </button>
          </div>
        </div>
      </section>

      <!-- Projects Section -->
      <section class="relative">
        <div class="flex items-end justify-between mb-12 border-b border-[var(--border-color)] pb-6">
          <div>
            <h2 class="text-2xl md:text-3xl font-light mb-2">Recent Projects</h2>
            <p class="text-[var(--text-tertiary)] text-sm">Continue where you left off</p>
          </div>
          <div class="hidden md:flex items-center gap-3">
            <button
              @click="router.push('/workspace')"
              class="flex items-center gap-2 px-5 py-2.5 rounded-full border border-[var(--border-color)] hover:border-[var(--accent-color)] hover:text-[var(--accent-color)] transition-all duration-300 group"
            >
              <n-icon :size="18"><AppsOutline /></n-icon>
              <span>Project Workspace</span>
            </button>
            <button 
              @click="createNewProject"
              class="flex items-center gap-2 px-5 py-2.5 rounded-full border border-[var(--border-color)] hover:border-[var(--accent-color)] hover:text-[var(--accent-color)] transition-all duration-300 group"
            >
              <n-icon :size="18"><AddOutline /></n-icon>
              <span>New Project</span>
            </button>
          </div>
        </div>
        
        <!-- Empty state -->
        <div v-if="projects.length === 0" class="flex flex-col items-center justify-center py-32 border border-dashed border-[var(--border-color)] rounded-3xl bg-[var(--bg-secondary)]/30">
          <div class="w-20 h-20 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center mb-6 text-[var(--text-tertiary)]">
            <n-icon :size="32"><FolderOutline /></n-icon>
          </div>
          <p class="text-[var(--text-secondary)] mb-6 text-lg font-light">Your canvas is waiting.</p>
          <button 
            @click="createNewProject"
            class="flora-button-primary px-8 py-3 rounded-full font-medium"
          >
            Create First Project
          </button>
        </div>
        
        <!-- Projects Grid -->
        <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8">
          <div 
            v-for="project in projects" 
            :key="project.id"
            class="group relative aspect-[4/3] bg-[var(--bg-secondary)] rounded-2xl overflow-hidden cursor-pointer border border-[var(--border-color)] hover:border-[var(--accent-color)]/50 transition-all duration-500 hover:shadow-2xl hover:shadow-[var(--accent-color)]/10"
            @click="openProject(project)"
            @mouseenter="handleThumbnailHover(project, true)"
            @mouseleave="handleThumbnailHover(project, false)"
          >
            <!-- Thumbnail -->
            <div class="absolute inset-0 transition-transform duration-700 group-hover:scale-105">
               <template v-if="project.thumbnail">
                  <video 
                    v-if="isVideoUrl(project.thumbnail)"
                    :ref="el => setVideoRef(project.id, el)"
                    :src="project.thumbnail"
                    class="w-full h-full object-cover"
                    muted
                    loop
                    playsinline
                  />
                  <img 
                    v-else
                    :src="project.thumbnail" 
                    :alt="project.name"
                    class="w-full h-full object-cover"
                  />
                </template>
                <div v-else class="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[var(--bg-secondary)] to-[var(--bg-tertiary)]">
                  <n-icon :size="40" class="text-[var(--text-tertiary)] opacity-20 mb-4"><DocumentOutline /></n-icon>
                </div>
            </div>

            <!-- Overlay Gradient -->
            <div class="absolute inset-0 bg-gradient-to-t from-[var(--bg-primary)] via-transparent to-transparent opacity-60 md:opacity-0 group-hover:opacity-80 transition-opacity duration-300" />

            <!-- Content -->
            <div class="absolute bottom-0 left-0 right-0 p-6 transform translate-y-2 md:translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
              <h3 class="text-lg font-medium text-white mb-1 truncate">{{ project.name }}</h3>
              <div class="flex items-center justify-between text-xs text-gray-300 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-75">
                <span>{{ formatDate(project.updatedAt) }}</span>
                <div class="flex gap-2">
                   <button 
                      @click.stop="handleProjectAction('duplicate', project)"
                      class="p-1.5 hover:bg-white/20 rounded-lg backdrop-blur-sm transition-colors"
                      title="Duplicate"
                    >
                      <n-icon :size="14"><CopyOutline /></n-icon>
                    </button>
                    <button 
                      @click.stop="handleProjectAction('delete', project)"
                      class="p-1.5 hover:bg-red-500/20 hover:text-red-400 rounded-lg backdrop-blur-sm transition-colors"
                      title="Delete"
                    >
                      <n-icon :size="14"><TrashOutline /></n-icon>
                    </button>
                </div>
              </div>
            </div>
            
            <!-- Rename Action (Top Right) -->
            <button 
              @click.stop="handleProjectAction('rename', project)"
              class="absolute top-3 right-3 p-2 bg-black/20 hover:bg-black/40 backdrop-blur-md rounded-full text-white opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-[-10px] group-hover:translate-y-0"
            >
               <n-icon :size="14"><CreateOutline /></n-icon>
            </button>
          </div>
          
          <!-- New Project Card (Grid Item) -->
          <div 
            @click="createNewProject"
            class="group flex flex-col items-center justify-center aspect-[4/3] rounded-2xl border border-dashed border-[var(--border-color)] hover:border-[var(--accent-color)] hover:bg-[var(--accent-color)]/5 cursor-pointer transition-all duration-300"
          >
             <div class="w-16 h-16 rounded-full bg-[var(--bg-secondary)] group-hover:bg-[var(--accent-color)] group-hover:text-white flex items-center justify-center transition-all duration-300 mb-4 shadow-lg">
                <n-icon :size="24"><AddOutline /></n-icon>
             </div>
             <span class="text-sm font-medium text-[var(--text-secondary)] group-hover:text-[var(--accent-color)] transition-colors">Create New</span>
          </div>
        </div>
      </section>

      <footer class="mt-16 md:mt-20 pb-4 text-center">
        <p class="text-xs md:text-sm tracking-[0.16em] uppercase text-[var(--text-tertiary)]">
          Developed by Eager Design
        </p>
      </footer>
    </main>

    <AuthDialog
      v-model:show="authModalVisible"
      v-model:mode="authMode"
      @close="closeAuthModal"
      @success="handleAuthSuccess"
    />

    <!-- API Settings Modal | API 设置弹窗 -->
    <ApiSettings v-model:show="showApiSettings" />

    <!-- Rename modal | 重命名弹窗 -->
    <BaseModal
      v-model:show="showRenameModal"
      title="Rename project"
      description="Give this project a clearer name for your workspace."
      size="sm"
    >
      <div class="py-1">
        <BaseInput
          v-model="renameValue" 
          placeholder="Enter project name" 
          @keyup.enter="confirmRename"
        />
      </div>
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
          <BaseButton variant="danger" @click="confirmDeleteProject">Delete</BaseButton>
        </div>
      </template>
    </BaseModal>
  </div>
</template>

<script setup>
/**
 * Home view component | 首页视图组件
 * Entry point with project list and creation input
 */
import { computed, ref, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { NIcon } from 'naive-ui'
import { 
  AddOutline, 
  AppsOutline,
  DocumentOutline,
  FolderOutline,
  CreateOutline,
  CopyOutline,
  TrashOutline
} from '../icons/coolicons'
import { 
  projects, 
  initProjectsStore, 
  createProject, 
  deleteProject, 
  duplicateProject, 
  renameProject 
} from '../stores/projects'
import { useAuthStore } from '@/stores/auth'
import { useAvatarUpload } from '@/hooks/useAvatarUpload'
import { BaseButton, BaseInput, BaseModal } from '@/components/ui'
import ApiSettings from '../components/ApiSettings.vue'
import AuthDialog from '../components/AuthDialog.vue'
import { getErrorMessage } from '@/utils'
import { notifier } from '@/utils/notifier'

const router = useRouter()
const route = useRoute()
const { user, logout, isAuthenticated, updateProfile, bootstrapAuth } = useAuthStore()

// API Settings state | API 设置状态
const showApiSettings = ref(false)

const handleLogout = async () => {
  await logout()
  await initProjectsStore()
  router.push('/')
}

const { avatarInputRef, avatarInitial, triggerAvatarUpload, handleAvatarChange } = useAvatarUpload({
  user,
  updateProfile,
  notify: {
    success: (message) => notifier.success(message),
    error: (message) => notifier.error(message)
  }
})

const openLogin = () => {
  authMode.value = 'login'
  authModalVisible.value = true
}

const openRegister = () => {
  authMode.value = 'register'
  authModalVisible.value = true
}

const authModalVisible = ref(false)
const authMode = ref('login')

const closeAuthModal = () => {
  authModalVisible.value = false
  clearAuthQuery()
}

const handleAuthSuccess = () => {
  clearAuthQuery()
  router.replace('/')
}

const openAuthByQuery = () => {
  const authQuery = String(route.query.auth || '')
  if (authQuery === 'login' || authQuery === 'register') {
    authMode.value = authQuery
    authModalVisible.value = true
  }
}

const clearAuthQuery = () => {
  const query = { ...route.query }
  delete query.auth
  delete query.redirect
  router.replace({ path: route.path, query })
}

// Video refs for hover play | 视频引用用于悬停播放
const videoRefs = new Map()

// Set video ref | 设置视频引用
const setVideoRef = (projectId, el) => {
  if (el) {
    videoRefs.set(projectId, el)
  } else {
    videoRefs.delete(projectId)
  }
}

// Handle thumbnail hover | 处理缩略图悬停
const handleThumbnailHover = (project, isHovering) => {
  if (!isVideoUrl(project.thumbnail)) return
  
  const video = videoRefs.get(project.id)
  if (!video) return
  
  if (isHovering) {
    video.play().catch(() => {
      // Ignore play errors (e.g., autoplay policy)
    })
  } else {
    video.pause()
    video.currentTime = 0 // Reset to start
  }
}

// Rename modal state | 重命名弹窗状态
const showRenameModal = ref(false)
const renameValue = ref('')
const renameTargetId = ref(null)
const showDeleteModal = ref(false)
const deleteTargetId = ref(null)
const deleteTargetName = ref('')

// Format date | 格式化日期
const formatDate = (date) => {
  if (!date) return ''
  const d = new Date(date)
  const now = new Date()
  const diff = now - d
  
  // Less than 1 minute | 小于1分钟
  if (diff < 60000) return 'Just now'
  // Less than 1 hour | 小于1小时
  if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`
  // Less than 1 day | 小于1天
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} h ago`
  // Less than 7 days | 小于7天
  if (diff < 604800000) return `${Math.floor(diff / 86400000)} d ago`
  // Format as date | 格式化为日期
  return `${d.getMonth() + 1}/${d.getDate()}`
}

// Handle project action | 处理项目操作
const handleProjectAction = async (key, project) => {
  switch (key) {
    case 'rename':
      renameTargetId.value = project.id
      renameValue.value = project.name
      showRenameModal.value = true
      break
    case 'duplicate':
      const newId = await duplicateProject(project.id)
      if (newId) {
        notifier.success('Project duplicated')
      }
      break
    case 'delete':
      deleteTargetId.value = project.id
      deleteTargetName.value = project.name
      showDeleteModal.value = true
      break
  }
}

const confirmDeleteProject = async () => {
  if (!deleteTargetId.value) return
  const id = deleteTargetId.value
  showDeleteModal.value = false
  deleteTargetId.value = null
  try {
    await deleteProject(id)
    notifier.success('Project deleted')
  } catch (err) {
    if (!err?.__handled) {
      notifier.error(getErrorMessage(err, 'Delete failed'))
    }
  }
}

// Confirm rename | 确认重命名
const confirmRename = async () => {
  if (renameTargetId.value && renameValue.value.trim()) {
    await renameProject(renameTargetId.value, renameValue.value.trim())
    notifier.success('Project renamed')
  }
  showRenameModal.value = false
  renameTargetId.value = null
  renameValue.value = ''
}

// Create new project | 创建新项目
const createNewProject = async () => {
  try {
    const id = await createProject('Untitled')
    await router.push(`/canvas/${id}`)
  } catch (err) {
    if (!err?.__handled) {
      notifier.error(getErrorMessage(err, 'Failed to create project'))
    }
  }
}

// Open existing project | 打开已有项目
const openProject = async (project) => {
  await router.push(`/canvas/${project.id}`)
}

const enterCanvas = async () => {
  await createNewProject()
}

const openEditorSpace = () => {
  window.open('https://editor.enbrand.space/', '_self')
}

// Check if URL is a video | 检查 URL 是否为视频
const isVideoUrl = (url) => {
  if (!url || typeof url !== 'string') return false
  const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv']
  return videoExtensions.some(ext => url.toLowerCase().includes(ext))
}

// Initialize projects store on mount | 挂载时初始化项目存储
onMounted(async () => {
  await bootstrapAuth()
  await initProjectsStore()
  openAuthByQuery()
})

watch(
  () => route.query.auth,
  () => openAuthByQuery()
)
</script>

<style scoped>
.perspective-1000 {
  perspective: 1000px;
}

.home-entry-button {
  min-width: 220px;
  padding: 1rem 2rem;
  border: 1px solid rgba(255, 255, 255, 0.78);
  border-radius: 9999px;
  background: transparent;
  color: #ffffff;
  font-size: 1rem;
  font-weight: 500;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  transition:
    transform 0.25s ease,
    border-color 0.25s ease,
    background-color 0.25s ease,
    box-shadow 0.25s ease;
}

.home-entry-button:hover {
  transform: translateY(-2px);
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.96);
  box-shadow: 0 18px 40px rgba(255, 255, 255, 0.08);
}

.home-entry-button:active {
  transform: translateY(0);
}

@media (max-width: 767px) {
  .home-entry-button {
    width: 100%;
    min-width: 0;
  }
}
</style>
