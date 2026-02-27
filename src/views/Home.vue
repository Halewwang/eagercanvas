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

        <!-- Creative Input -->
        <div class="w-full max-w-3xl relative group perspective-1000">
          <!-- Glow Effect -->
          <div class="absolute -inset-1 bg-gradient-to-r from-[var(--accent-color)] to-[var(--accent-hover)] rounded-2xl opacity-20 group-hover:opacity-40 blur-lg transition-opacity duration-500" />
          
          <div class="relative bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl p-2 transition-all duration-300 focus-within:border-[var(--accent-color)] shadow-2xl">
            <textarea
              v-model="inputText"
              placeholder="Describe your next creation..."
              class="w-full bg-transparent resize-none outline-none text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] min-h-[60px] md:min-h-[80px] text-lg md:text-xl p-4 font-light"
              @keydown.enter.ctrl="handleCreateWithInput"
            />
            <div class="flex items-center justify-between px-2 pb-2">
              <div class="flex gap-2 overflow-x-auto no-scrollbar max-w-[70%]">
                <button
                  v-for="tag in suggestions.slice(0, 2)"
                  :key="tag"
                  @click="inputText = tag"
                  class="whitespace-nowrap px-3 py-1 text-xs rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--accent-color)] hover:text-white transition-colors duration-300"
                >
                  {{ tag }}
                </button>
              </div>
              <button
                @click="handleCreateWithInput"
                class="flora-button-primary flex items-center gap-2 px-6 py-2 rounded-xl transition-all duration-300 hover:scale-105 active:scale-95 shadow-lg shadow-black/30"
              >
                <span class="text-sm font-medium">Create</span>
                <n-icon :size="16"><SendOutline /></n-icon>
              </button>
            </div>
          </div>
          <div class="text-xs text-[var(--text-tertiary)] mt-3 tracking-widest uppercase opacity-60">Press Ctrl + Enter to start</div>
        </div>
      </section>

      <!-- Projects Section -->
      <section class="relative">
        <div class="flex items-end justify-between mb-12 border-b border-[var(--border-color)] pb-6">
          <div>
            <h2 class="text-2xl md:text-3xl font-light mb-2">Recent Projects</h2>
            <p class="text-[var(--text-tertiary)] text-sm">Continue where you left off</p>
          </div>
          <button 
            @click="createNewProject"
            class="hidden md:flex items-center gap-2 px-5 py-2.5 rounded-full border border-[var(--border-color)] hover:border-[var(--accent-color)] hover:text-[var(--accent-color)] transition-all duration-300 group"
          >
            <n-icon :size="18"><AddOutline /></n-icon>
            <span>New Project</span>
          </button>
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

    <!-- API Settings Modal | API 设置弹窗 -->
    <ApiSettings v-model:show="showApiSettings" @saved="refreshApiConfig" />

    <!-- Rename modal | 重命名弹窗 -->
    <n-modal v-model:show="showRenameModal" preset="dialog" title="Rename Project" :show-icon="false" class="custom-modal">
      <template #header>
        <div class="text-xl font-light mb-2">Rename Project</div>
      </template>
      <div class="py-4">
        <input 
          v-model="renameValue" 
          placeholder="Enter project name" 
          class="w-full bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-xl px-4 py-3 outline-none focus:border-[var(--accent-color)] transition-colors"
          @keyup.enter="confirmRename"
        />
      </div>
      <template #action>
        <div class="flex justify-end gap-3">
          <button @click="showRenameModal = false" class="px-4 py-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">Cancel</button>
          <button @click="confirmRename" class="flora-button-primary px-6 py-2 rounded-lg transition-opacity">Save</button>
        </div>
      </template>
    </n-modal>

    <n-modal v-model:show="showDeleteModal" preset="dialog" title="Delete Project" type="warning">
      <p>Delete "{{ deleteTargetName }}"? This action cannot be undone.</p>
      <template #action>
        <button @click="showDeleteModal = false" class="px-4 py-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">Cancel</button>
        <button @click="confirmDeleteProject" class="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-500 transition-colors">Delete</button>
      </template>
    </n-modal>
  </div>
</template>

<script setup>
/**
 * Home view component | 首页视图组件
 * Entry point with project list and creation input
 */
import { computed, ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { NIcon, NModal } from 'naive-ui'
import { 
  AddOutline, 
  SendOutline,
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
import { useApiConfig } from '../hooks/useApiConfig'
import { useAuthStore } from '@/stores/auth'
import ApiSettings from '../components/ApiSettings.vue'

const router = useRouter()
const apiConfig = useApiConfig()
const { user, logout, isAuthenticated, updateProfile } = useAuthStore()

// API Settings state | API 设置状态
const showApiSettings = ref(false)
const isApiConfigured = ref(apiConfig.isConfigured.value)

// Refresh API config state | 刷新 API 配置状态
const refreshApiConfig = () => {
  isApiConfigured.value = apiConfig.isConfigured.value
}

const handleLogout = async () => {
  await logout()
  router.push('/login')
}

const avatarInputRef = ref(null)
const avatarInitial = computed(() => (user.value?.displayName || user.value?.email || 'U').charAt(0).toUpperCase())

const triggerAvatarUpload = () => {
  avatarInputRef.value?.click()
}

const handleAvatarChange = async (event) => {
  const file = event.target?.files?.[0]
  if (!file) return
  if (file.size > 2 * 1024 * 1024) {
    window.$message?.error('Avatar must be <= 2MB')
    return
  }

  const reader = new FileReader()
  reader.onload = async () => {
    try {
      const dataUrl = String(reader.result || '')
      await updateProfile({ avatarUrl: dataUrl })
      window.$message?.success('Avatar updated')
    } catch (err) {
      window.$message?.error(err?.response?.data?.message || err?.message || 'Failed to update avatar')
    }
  }
  reader.readAsDataURL(file)
  event.target.value = ''
}

const openLogin = () => {
  router.push('/login')
}

const openRegister = () => {
  router.push('/login?mode=register')
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

// Input state | 输入状态
const inputText = ref('')

// Rename modal state | 重命名弹窗状态
const showRenameModal = ref(false)
const renameValue = ref('')
const renameTargetId = ref(null)
const showDeleteModal = ref(false)
const deleteTargetId = ref(null)
const deleteTargetName = ref('')

// Suggestions tags | 建议标签
const suggestions = [
  'A magical forest in the rain',
  'Street food photography in Tokyo',
  'Waterfall splash close-up',
  'Cinematic rainy flower field'
]

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
        window.$message?.success('Project duplicated')
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
    window.$message?.success('Project deleted')
  } catch (err) {
    window.$message?.error(err?.response?.data?.message || err?.message || 'Delete failed')
  }
}

// Confirm rename | 确认重命名
const confirmRename = async () => {
  if (renameTargetId.value && renameValue.value.trim()) {
    await renameProject(renameTargetId.value, renameValue.value.trim())
    window.$message?.success('Project renamed')
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
    window.$message?.error(err?.response?.data?.message || err?.message || 'Failed to create project')
  }
}

// Create project with input text | 使用输入文本创建项目
const handleCreateWithInput = async () => {
  try {
    const name = inputText.value.trim() || 'Untitled'
    const id = await createProject(name)
    sessionStorage.setItem('ai-canvas-initial-prompt', inputText.value.trim())
    inputText.value = ''
    await router.push(`/canvas/${id}`)
  } catch (err) {
    window.$message?.error(err?.response?.data?.message || err?.message || 'Failed to create project')
  }
}

// Open existing project | 打开已有项目
const openProject = async (project) => {
  await router.push(`/canvas/${project.id}`)
}

// Check if URL is a video | 检查 URL 是否为视频
const isVideoUrl = (url) => {
  if (!url || typeof url !== 'string') return false
  const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv']
  return videoExtensions.some(ext => url.toLowerCase().includes(ext))
}

// Initialize projects store on mount | 挂载时初始化项目存储
onMounted(async () => {
  await initProjectsStore()
})
</script>

<style scoped>
/* Perspective for the input wrapper */
.perspective-1000 {
  perspective: 1000px;
}

/* Hide scrollbar for suggestions */
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
