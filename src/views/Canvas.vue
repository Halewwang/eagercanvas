<template>
  <!-- Canvas page | 画布页面 -->
  <div class="h-screen w-screen bg-[var(--bg-primary)]">
    <!-- Main canvas area | 主画布区域 -->
    <div class="h-full relative overflow-hidden">
      <!-- Top capsules | 顶部胶囊菜单 -->
      <div class="absolute left-4 top-4 z-20 flex items-center gap-2">
        <div class="flora-panel rounded-full p-1.5">
          <button
            @click="goBack"
            class="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[var(--bg-tertiary)] transition-colors"
            title="Back"
          >
            <n-icon :size="18"><ChevronBackOutline /></n-icon>
          </button>
        </div>
        <div class="flora-panel rounded-full p-1.5">
          <n-dropdown :options="projectOptions" @select="handleProjectAction">
            <button class="h-9 flex items-center gap-2 px-3 rounded-full hover:bg-[var(--bg-tertiary)] transition-colors">
              <span class="text-sm font-medium">{{ projectName }}</span>
              <n-icon :size="16"><ChevronDownOutline /></n-icon>
            </button>
          </n-dropdown>
        </div>
      </div>

      <div class="absolute right-4 top-4 z-20">
        <button
          @click="triggerAvatarUpload"
          class="w-10 h-10 rounded-full overflow-hidden border border-[var(--border-color)] bg-[var(--bg-secondary)] flex items-center justify-center"
          title="Upload avatar"
        >
          <img v-if="user?.avatarUrl" :src="user.avatarUrl" alt="avatar" class="w-full h-full object-cover" />
          <span v-else class="text-xs">{{ avatarInitial }}</span>
        </button>
        <input ref="avatarInputRef" type="file" accept="image/*" class="hidden" @change="handleAvatarChange" />
      </div>

      <!-- Vue Flow canvas | Vue Flow 画布 -->
      <VueFlow
        :key="flowKey"
        v-model:nodes="nodes"
        v-model:edges="edges"
        v-model:viewport="viewport"
        :node-types="nodeTypes"
        :edge-types="edgeTypes"
        :default-viewport="canvasViewport"
        :min-zoom="0.1"
        :max-zoom="2"
        :snap-to-grid="true"
        :snap-grid="[20, 20]"
        @connect="onConnect"
        @node-click="onNodeClick"
        @pane-click="onPaneClick"
        @viewport-change="handleViewportChange"
        @edges-change="onEdgesChange"
        class="canvas-flow"
      >
        <Background v-if="showGrid" :gap="20" :size="1" style="opacity: 0.5" />
        <MiniMap 
          v-if="!isMobile"
          position="bottom-right"
          :pannable="true"
          :zoomable="true"
          class="!bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl overflow-hidden"
          node-color="var(--accent-color)"
          mask-color="rgba(0,0,0,0.1)"
        />
      </VueFlow>

      <!-- Left toolbar | 左侧工具栏 -->
      <aside class="flora-panel absolute left-4 top-1/2 -translate-y-1/2 flex flex-col gap-1 p-2 rounded-2xl z-10">
        <button 
          @click="showNodeMenu = !showNodeMenu"
          class="flora-button-primary w-10 h-10 flex items-center justify-center rounded-xl"
          title="Add Node"
        >
          <n-icon :size="20"><AddOutline /></n-icon>
        </button>
        <button 
          @click="showWorkflowPanel = true"
          class="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-[var(--bg-tertiary)] transition-colors"
          title="Workflow Templates"
        >
          <n-icon :size="20"><AppsOutline /></n-icon>
        </button>
        <div class="w-full h-px bg-[var(--border-color)] my-1"></div>
        <button 
          v-for="tool in tools" 
          :key="tool.id"
          @click="tool.action"
          :disabled="tool.disabled && tool.disabled()"
          class="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          :title="tool.name"
        >
          <n-icon :size="20"><component :is="tool.icon" /></n-icon>
        </button>
        <div class="w-full h-px bg-[var(--border-color)] my-1"></div>
        <button
          @click="showDownloadModal = true"
          class="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors"
          :class="{ 'text-[var(--accent-color)]': hasDownloadableAssets }"
          title="Download Assets"
        >
          <n-icon :size="20"><DownloadOutline /></n-icon>
        </button>
        <button
          @click="showApiSettings = true"
          class="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors text-white"
          title="API Settings"
        >
          <n-icon :size="20"><SettingsOutline /></n-icon>
        </button>
      </aside>

      <!-- Node menu popup | 节点菜单弹窗 -->
      <div 
        v-if="showNodeMenu"
        class="flora-panel absolute left-20 top-1/2 -translate-y-1/2 rounded-2xl p-2 z-20"
      >
        <button 
          v-for="nodeType in nodeTypeOptions" 
          :key="nodeType.type"
          @click="addNewNode(nodeType.type)"
          class="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors text-left"
        >
          <n-icon :size="20" :color="nodeType.color"><component :is="nodeType.icon" /></n-icon>
          <span class="text-sm">{{ nodeType.name }}</span>
        </button>
      </div>

      <!-- Bottom controls | 底部控制 -->
      <div class="flora-panel absolute bottom-4 left-4 flex items-center gap-2 rounded-xl p-1.5">
        <!-- <button 
          @click="showGrid = !showGrid" 
          :class="showGrid ? 'bg-[var(--accent-color)] text-white' : 'hover:bg-[var(--bg-tertiary)]'"
          class="p-2 rounded transition-colors"
          title="切换网格"
        >
          <n-icon :size="16"><GridOutline /></n-icon>
        </button> -->
        <button 
          @click="fitView({ padding: 0.2 })" 
          class="p-2 hover:bg-[var(--bg-tertiary)] rounded transition-colors"
          title="Fit View"
        >
          <n-icon :size="16"><LocateOutline /></n-icon>
        </button>
        <div class="flex items-center gap-1 px-2">
          <button @click="zoomOut" class="p-1 hover:bg-[var(--bg-tertiary)] rounded transition-colors">
            <n-icon :size="14"><RemoveOutline /></n-icon>
          </button>
          <span class="text-xs min-w-[40px] text-center">{{ Math.round(viewport.zoom * 100) }}%</span>
          <button @click="zoomIn" class="p-1 hover:bg-[var(--bg-tertiary)] rounded transition-colors">
            <n-icon :size="14"><AddOutline /></n-icon>
          </button>
        </div>
      </div>

      <!-- Bottom input panel (floating) | 底部输入面板（悬浮） -->
      <div class="absolute bottom-4 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4 z-20">
        <!-- Processing indicator | 处理中指示器 -->
        <div 
          v-if="isProcessing" 
          class="flora-panel mb-3 p-3 rounded-xl border-[var(--accent-color)] animate-pulse"
        >
          <div class="flex items-center gap-2 text-sm text-[var(--accent-color)] mb-2">
            <n-spin :size="14" />
            <span>Generating prompt...</span>
          </div>
          <div v-if="currentResponse" class="text-sm text-[var(--text-primary)] whitespace-pre-wrap">
            {{ currentResponse }}
          </div>
        </div>

        <div class="flora-input-shell p-3">
          <textarea
            v-model="chatInput"
            :placeholder="inputPlaceholder"
            :disabled="isProcessing"
            class="w-full bg-transparent resize-none outline-none text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] min-h-[40px] max-h-[120px] disabled:opacity-50"
            rows="1"
            @keydown.enter.exact="handleEnterKey"
            @keydown.enter.ctrl="sendMessage"
          />
          <div class="flex items-center justify-between mt-2">
            <div class="flex items-center gap-2">
              <button 
                @click="handlePolish"
                :disabled="isProcessing || !chatInput.trim()"
                class="flora-button-ghost px-3 py-1.5 text-xs rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                title="Polish Prompt"
              >
                ✨ Polish
              </button>
            </div>
            <div class="flex items-center gap-3">
              <label class="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                <n-switch v-model:value="autoExecute" size="small" />
                Auto-run
              </label>
              <button 
                @click="sendMessage"
                :disabled="isProcessing"
                class="flora-button-primary w-9 h-9 rounded-xl flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <n-spin v-if="isProcessing" :size="16" />
                <n-icon v-else :size="20"><SendOutline /></n-icon>
              </button>
            </div>
          </div>
        </div>
        
        <!-- Quick suggestions | 快捷建议 -->
        <div class="flex flex-wrap items-center justify-center gap-2 mt-2">
          <span class="text-xs text-[var(--text-secondary)]">Suggested:</span>
          <button 
            v-for="tag in suggestions" 
            :key="tag"
            @click="chatInput = tag"
            class="flora-pill px-2.5 py-1 text-xs hover:text-[var(--accent-color)] hover:border-[var(--accent-color)] transition-colors"
          >
            {{ tag }}
          </button>
          <button class="p-1 hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors">
            <n-icon :size="14"><RefreshOutline /></n-icon>
          </button>
        </div>
      </div>
    </div>

    <!-- API Settings Modal | API 设置弹窗 -->
    <ApiSettings v-model:show="showApiSettings" />

    <!-- Rename Modal | 重命名弹窗 -->
    <n-modal v-model:show="showRenameModal" preset="dialog" title="Rename Project">
      <n-input v-model:value="renameValue" placeholder="Enter project name" />
      <template #action>
        <n-button @click="showRenameModal = false">Cancel</n-button>
        <n-button type="primary" @click="confirmRename">Save</n-button>
      </template>
    </n-modal>

    <!-- Delete Confirm Modal | 删除确认弹窗 -->
    <n-modal v-model:show="showDeleteModal" preset="dialog" title="Delete Project" type="warning">
      <p>Delete "{{ projectName }}"? This action cannot be undone.</p>
      <template #action>
        <n-button @click="showDeleteModal = false">Cancel</n-button>
        <n-button type="error" @click="confirmDelete">Delete</n-button>
      </template>
    </n-modal>

    <!-- Download Modal | 下载弹窗 -->
    <DownloadModal v-model:show="showDownloadModal" />

    <!-- Workflow Panel | 工作流面板 -->
    <WorkflowPanel v-model:show="showWorkflowPanel" @add-workflow="handleAddWorkflow" />
  </div>
</template>

<script setup>
/**
 * Canvas view component | 画布视图组件
 * Main infinite canvas with Vue Flow integration
 */
import { ref, computed, onMounted, onUnmounted, watch, nextTick, markRaw } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { VueFlow, useVueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { MiniMap } from '@vue-flow/minimap'
import { NIcon, NSwitch, NDropdown, NMessageProvider, NSpin, NModal, NInput, NButton } from 'naive-ui'
import { 
  ChevronBackOutline,
  ChevronDownOutline,
  SettingsOutline,
  AddOutline,
  ImageOutline,
  SendOutline,
  RefreshOutline,
  TextOutline,
  VideocamOutline,
  ColorPaletteOutline,
  BookmarkOutline,
  ArrowUndoOutline,
  ArrowRedoOutline,
  GridOutline,
  LocateOutline,
  RemoveOutline,
  DownloadOutline,
  AppsOutline,
  ChatbubbleOutline
} from '../icons/coolicons'
import { nodes, edges, addNode, addEdge, updateNode, initSampleData, loadProject, saveProject, clearCanvas, canvasViewport, updateViewport, undo, redo, canUndo, canRedo, manualSaveHistory } from '../stores/canvas'
import { DEFAULT_CHAT_MODEL, loadAllModels } from '../stores/models'
import { useApiConfig, useChat, useWorkflowExecutor, useNodesFactory } from '../hooks'
import { edgeStrategy } from '../services/edgeStrategy'
import { notifier } from '../utils/notifier'
import { projects, initProjectsStore, updateProject, renameProject, currentProject, duplicateProject, deleteProject } from '../stores/projects'
import { useAuthStore } from '@/stores/auth'

// API Settings component | API 设置组件
import ApiSettings from '../components/ApiSettings.vue'
import DownloadModal from '../components/DownloadModal.vue'
import WorkflowPanel from '../components/WorkflowPanel.vue'

// API Config hook | API 配置 hook
const { isConfigured: isApiConfigured } = useApiConfig()

// Initialize models on page load | 页面加载时初始化模型
onMounted(() => {
  loadAllModels()
})

// Chat templates | 问答模板
const CHAT_TEMPLATES = {
  imagePrompt: {
    name: 'Image Prompt',
    systemPrompt: 'You are an expert prompt writer for image generation. Rewrite user input into a high-quality visual prompt with style, lighting, composition, and details. Return only the prompt.',
    model: DEFAULT_CHAT_MODEL
  },
  videoPrompt: {
    name: 'Video Prompt',
    systemPrompt: 'You are an expert prompt writer for video generation. Rewrite user input into a high-quality video prompt with motion, scene setup, and camera direction. Return only the prompt.',
    model: DEFAULT_CHAT_MODEL
  }
}

// Current template | 当前模板
const currentTemplate = ref('imagePrompt')

// Chat hook with image prompt template | 问答 hook
const { 
  loading: chatLoading, 
  status: chatStatus, 
  currentResponse, 
  send: sendChat 
} = useChat({
  systemPrompt: CHAT_TEMPLATES.imagePrompt.systemPrompt,
  model: CHAT_TEMPLATES.imagePrompt.model
})

// Vue Flow instance | Vue Flow 实例
const { viewport, zoomIn, zoomOut, fitView, updateNodeInternals } = useVueFlow()

// Nodes factory | 节点工厂
const nodesFactory = useNodesFactory({ updateNodeInternals, viewport })

// Workflow executor | 工作流执行器
const {
  isAnalyzing: workflowAnalyzing,
  isExecuting: workflowExecuting,
  isProcessing: workflowProcessing,
  currentStep: workflowStep,
  totalSteps: workflowTotalSteps,
  executionLog: workflowLog,
  executeFromInput,
  WORKFLOW_TYPES
} = useWorkflowExecutor()

// Custom node components | 自定义节点组件
import TextNode from '../components/nodes/TextNode.vue'
import ImageConfigNode from '../components/nodes/ImageConfigNode.vue'
import VideoNode from '../components/nodes/VideoNode.vue'
import ImageNode from '../components/nodes/ImageNode.vue'
import VideoConfigNode from '../components/nodes/VideoConfigNode.vue'
import LLMConfigNode from '../components/nodes/LLMConfigNode.vue'
import ImageRoleEdge from '../components/edges/ImageRoleEdge.vue'
import PromptOrderEdge from '../components/edges/PromptOrderEdge.vue'
import ImageOrderEdge from '../components/edges/ImageOrderEdge.vue'

const router = useRouter()
const route = useRoute()
const { user, updateProfile } = useAuthStore()
const avatarInputRef = ref(null)
const avatarInitial = computed(() => (user.value?.displayName || user.value?.email || 'U').charAt(0).toUpperCase())

const triggerAvatarUpload = () => {
  avatarInputRef.value?.click()
}

const handleAvatarChange = async (event) => {
  const file = event.target?.files?.[0]
  if (!file) return
  if (file.size > 2 * 1024 * 1024) {
    notifier.error('Avatar must be <= 2MB')
    return
  }
  const reader = new FileReader()
  reader.onload = async () => {
    try {
      await updateProfile({ avatarUrl: String(reader.result || '') })
      notifier.success('Avatar updated')
    } catch (err) {
      notifier.error(err?.response?.data?.message || err?.message || 'Failed to update avatar')
    }
  }
  reader.readAsDataURL(file)
  event.target.value = ''
}

// Register custom node types | 注册自定义节点类型
const nodeTypes = {
  text: markRaw(TextNode),
  imageConfig: markRaw(ImageConfigNode),
  video: markRaw(VideoNode),
  image: markRaw(ImageNode),
  videoConfig: markRaw(VideoConfigNode),
  llmConfig: markRaw(LLMConfigNode)
}

// Register custom edge types | 注册自定义边类型
const edgeTypes = {
  imageRole: markRaw(ImageRoleEdge),
  promptOrder: markRaw(PromptOrderEdge),
  imageOrder: markRaw(ImageOrderEdge)
}

// UI state | UI状态
const showNodeMenu = ref(false)
const chatInput = ref('')
const autoExecute = ref(true)
const isMobile = ref(false)
const showGrid = ref(true)
const showApiSettings = ref(false)
const polishProcessing = ref(false)
const isProcessing = computed(() => polishProcessing.value || workflowProcessing.value)

// Flow key for forcing re-render on project switch | 项目切换时强制重新渲染的 key
const flowKey = ref(Date.now())

// Modal state | 弹窗状态
const showRenameModal = ref(false)
const showDeleteModal = ref(false)
const showDownloadModal = ref(false)
const showWorkflowPanel = ref(false)
const renameValue = ref('')

// Check if has downloadable assets | 检查是否有可下载素材
const hasDownloadableAssets = computed(() => {
  return nodes.value.some(n => 
    (n.type === 'image' || n.type === 'video') && n.data?.url
  )
})


// Project info | 项目信息
const projectName = computed(() => {
  const project = projects.value.find(p => p.id === route.params.id)
  return project?.name || 'Untitled'
})

// Project dropdown options | 项目下拉选项
const projectOptions = [
  { label: 'Rename', key: 'rename' },
  { label: 'Duplicate', key: 'duplicate' },
  { label: 'Delete', key: 'delete' }
]

// Toolbar tools | 工具栏工具
const tools = [
  { id: 'text', name: 'Text', icon: TextOutline, action: () => addNewNode('text') },
  { id: 'image', name: 'Image', icon: ImageOutline, action: () => addNewNode('image') },
  { id: 'imageConfig', name: 'Image Gen', icon: ColorPaletteOutline, action: () => addNewNode('imageConfig') },
  { id: 'videoConfig', name: 'Video Gen', icon: VideocamOutline, action: () => addNewNode('videoConfig') },
  { id: 'undo', name: 'Undo', icon: ArrowUndoOutline, action: () => undo(), disabled: () => !canUndo() },
  { id: 'redo', name: 'Redo', icon: ArrowRedoOutline, action: () => redo(), disabled: () => !canRedo() }
]

// Node type options for menu | 节点类型菜单选项
const nodeTypeOptions = [
  { type: 'text', name: 'Text Node', icon: TextOutline, color: '#3b82f6' },
  // { type: 'llmConfig', name: 'LLM文本生成', icon: ChatbubbleOutline, color: '#a855f7' },
  { type: 'imageConfig', name: 'Image Config', icon: ColorPaletteOutline, color: '#22c55e' },
  { type: 'videoConfig', name: 'Video Config', icon: VideocamOutline, color: '#f59e0b' },
  { type: 'image', name: 'Image Node', icon: ImageOutline, color: '#8b5cf6' },
  { type: 'video', name: 'Video Node', icon: VideocamOutline, color: '#ef4444' }
]

// Input placeholder | 输入占位符
const inputPlaceholder = 'Try: "Create an anime-style cartoon character"'

// Quick suggestions | 快捷建议
const suggestions = [
  'A magical forest scene',
  'Three different kittens',
  'Build a multi-angle storyboard',
  'Summer field cinematic walk'
]

// Add new node | 添加新节点
const addNewNode = async (type) => {
  await nodesFactory.addNewNode(type)
  showNodeMenu.value = false
}

// Handle add workflow from panel | 处理从面板添加工作流
const handleAddWorkflow = async ({ workflow, options }) => {
  await nodesFactory.createFromWorkflow(workflow, options)
}

// Handle connection | 处理连接
const onConnect = (params) => {
  const edge = edgeStrategy.resolve(params)
  addEdge(edge)
}

// Handle node click | 处理节点点击
const onNodeClick = (event) => {
  // nodes.value.forEach(node => {
  //   updateNode(node.id, { selected: false })
  // })
  
  // // Select clicked node | 选中的节点
  // const clickedNode = nodes.value.find(n => n.id === event.node.id)
  // if (clickedNode) {
  //   updateNode(event.node.id, { selected: true })
  // }
}

// Handle viewport change | 处理视口变化
const handleViewportChange = (newViewport) => {
  updateViewport(newViewport)
}

// Handle edges change | 处理边变化
const onEdgesChange = (changes) => {
  // Check if any edge is being removed | 检查是否有边被删除
  const hasRemoval = changes.some(change => change.type === 'remove')
  
  if (hasRemoval) {
    // Trigger history save after edge removal | 边删除后触发历史保存
    nextTick(() => {
      manualSaveHistory()
    })
  }
}

// Handle pane click | 处理画布点击
const onPaneClick = () => {
  showNodeMenu.value = false
  // Clear all selections | 清除所有选中
  // nodes.value = nodes.value.map(node => ({
  //   ...node,
  //   selected: false
  // }))
}

// Handle project action | 处理项目操作
const handleProjectAction = async (key) => {
  const projectId = route.params.id
  switch (key) {
    case 'rename':
      renameValue.value = projectName.value
      showRenameModal.value = true
      break
    case 'duplicate':
      if (!projectId) return
      const newId = await duplicateProject(projectId)
      if (newId) {
        notifier.success('Project duplicated')
        router.push(`/canvas/${newId}`)
      } else {
        notifier.error('Duplicate failed')
      }
      break
    case 'delete':
      showDeleteModal.value = true
      break
  }
}

// Confirm rename | 确认重命名
const confirmRename = async () => {
  const projectId = route.params.id
  if (renameValue.value.trim()) {
    await renameProject(projectId, renameValue.value.trim())
    notifier.success('Project renamed')
  }
  showRenameModal.value = false
}

// Confirm delete | 确认删除
const confirmDelete = async () => {
  const projectId = route.params.id
  if (!projectId) return
  showDeleteModal.value = false
  await deleteProject(projectId)
  notifier.success('Project deleted')
  router.push('/')
}

// Handle Enter key | 处理回车键
const handleEnterKey = (e) => {
  e.preventDefault()
  sendMessage()
}

// Handle AI polish | 处理 AI 润色
const handlePolish = async () => {
  const input = chatInput.value.trim()
  if (!input) return
  
  // Check API configuration | 检查 API 配置
  if (!isApiConfigured.value) {
    notifier.warning('Please configure API Key first')
    showApiSettings.value = true
    return
  }

  polishProcessing.value = true
  const originalInput = chatInput.value

  try {
    // Call chat API to polish the prompt | 调用 AI 润色提示词
    const result = await sendChat(input, true)
    
    if (result) {
      chatInput.value = result
      notifier.success('Prompt polished')
    }
  } catch (err) {
    chatInput.value = originalInput
    notifier.error(err.message || 'Polish failed')
  } finally {
    polishProcessing.value = false
  }
}

// Send message | 发送消息
const sendMessage = async () => {
  const input = chatInput.value.trim()
  if (!input) return

  // Check API configuration | 检查 API 配置
  if (!isApiConfigured.value) {
    notifier.warning('Please configure API Key first')
    showApiSettings.value = true
    return
  }

  chatInput.value = ''

  await executeFromInput(input, {
    autoExecute: autoExecute.value,
    nodesFactory
  })
}

// Go back to home | 返回首页
const goBack = () => {
  router.push('/')
}

// Check if mobile | 检测是否移动端
const checkMobile = () => {
  isMobile.value = window.innerWidth < 768
}

// Load project by ID | 根据ID加载项目
const loadProjectById = (projectId) => {
  // Update flow key to force VueFlow re-render | 更新 key 强制 VueFlow 重新渲染
  flowKey.value = Date.now()
  
  if (projectId && projectId !== 'new') {
    loadProject(projectId)
  } else {
    // New project - clear canvas | 新项目 - 清空画布
    clearCanvas()
  }
}

// Watch for route changes | 监听路由变化
watch(
  () => route.params.id,
  (newId, oldId) => {
    if (newId && newId !== oldId) {
      // Save current project before switching | 切换前保存当前项目
      if (oldId) {
        saveProject()
      }
      // Load new project | 加载新项目
      loadProjectById(newId)
    }
  }
)

// Initialize | 初始化
onMounted(async () => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
  
  // Initialize projects store | 初始化项目存储
  await initProjectsStore()
  
  // Load project data | 加载项目数据
  loadProjectById(route.params.id)
  
  // Check for initial prompt from home page | 检查来自首页的初始提示词
  const initialPrompt = sessionStorage.getItem('ai-canvas-initial-prompt')
  if (initialPrompt) {
    sessionStorage.removeItem('ai-canvas-initial-prompt')
    chatInput.value = initialPrompt
    // Auto-send the message | 自动发送消息
    nextTick(() => {
      sendMessage()
    })
  }
})

// Cleanup on unmount | 卸载时清理
onUnmounted(() => {
  window.removeEventListener('resize', checkMobile)
  // Save project before leaving | 离开前保存项目
  saveProject()
})
</script>

<style>
/* Import Vue Flow styles | 引入 Vue Flow 样式 */
@import '@vue-flow/core/dist/style.css';
@import '@vue-flow/core/dist/theme-default.css';
@import '@vue-flow/minimap/dist/style.css';

.canvas-flow {
  width: 100%;
  height: 100%;
}
</style>
