<template>
  <!-- Canvas page | 画布页面 -->
  <div class="h-screen w-screen bg-[#1C1C1C]">
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
        <div class="flora-panel rounded-full p-1.5">
          <button
            @click="openShareDialog"
            class="h-9 flex items-center gap-2 px-4 rounded-full hover:bg-[var(--bg-tertiary)] transition-colors"
            title="Share"
          >
            <span class="text-sm font-medium">Share</span>
          </button>
        </div>
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
        selection-key-code="Shift"
        multi-selection-key-code="Shift"
        @connect="onConnect"
        @connect-start="onConnectStart"
        @connect-end="onConnectEnd"
        @node-click="onNodeClick"
        @nodes-change="onNodesChange"
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
          class="!bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl overflow-hidden opacity-70"
          node-color="var(--accent-color)"
          mask-color="rgba(0,0,0,0.1)"
        />
      </VueFlow>

      <!-- Left toolbar | 左侧工具栏 -->
      <aside class="flora-panel absolute left-4 top-1/2 -translate-y-1/2 flex flex-col gap-2 p-2 rounded-[36px] z-20 w-[64px]">
        <button 
          @click="showNodeMenu = !showNodeMenu"
          class="w-12 h-12 flex items-center justify-center rounded-full bg-[#f1f1f1] text-[#111111] hover:brightness-95 transition-all"
          title="Add Node"
        >
          <n-icon :size="20"><AddOutline /></n-icon>
        </button>
        <button 
          @click="showWorkflowPanel = true"
          class="w-12 h-12 flex items-center justify-center rounded-xl hover:bg-[var(--bg-tertiary)] transition-colors"
          title="Workflow Templates"
        >
          <n-icon :size="20"><FolderOutline /></n-icon>
        </button>
        <button
          @click="undo"
          :disabled="!canUndo()"
          class="w-12 h-12 flex items-center justify-center rounded-xl hover:bg-[var(--bg-tertiary)] transition-colors disabled:opacity-35"
          title="Undo"
        >
          <n-icon :size="20"><ArrowUndoOutline /></n-icon>
        </button>
        <button 
          @click="redo"
          :disabled="!canRedo()"
          class="w-12 h-12 flex items-center justify-center rounded-xl hover:bg-[var(--bg-tertiary)] transition-colors disabled:opacity-35"
          title="Redo"
        >
          <n-icon :size="20"><ArrowRedoOutline /></n-icon>
        </button>
        <button
          @click="showApiSettings = true"
          class="w-12 h-12 flex items-center justify-center rounded-xl hover:bg-[var(--bg-tertiary)] transition-colors text-white"
          title="API Settings"
        >
          <n-icon :size="20"><SettingsOutline /></n-icon>
        </button>
        <div class="w-full h-px bg-[var(--border-color)] my-1"></div>
        <button
          @click="triggerAvatarUpload"
          class="w-12 h-12 rounded-full overflow-hidden border border-[var(--border-color)] bg-[var(--bg-secondary)] flex items-center justify-center mt-auto"
          title="Upload avatar"
        >
          <img v-if="user?.avatarUrl" :src="user.avatarUrl" alt="avatar" class="w-full h-full object-cover" />
          <span v-else class="text-xs">{{ avatarInitial }}</span>
        </button>
        <input ref="avatarInputRef" type="file" accept="image/*" class="hidden" @change="handleAvatarChange" />
      </aside>

      <!-- Node menu popup | 节点菜单弹窗 -->
      <div v-if="showNodeMenu" class="flora-panel absolute left-[90px] top-1/2 -translate-y-1/2 rounded-xl p-2 z-30 w-[198px] border border-[rgba(143,143,143,0.24)] bg-[rgba(25,25,25,0.96)] backdrop-blur-xl">
        <div class="text-[13px] leading-none font-semibold text-[#8f939e] mb-1.5 tracking-[0.02em]">TURN INTO</div>
        <div class="space-y-2">
          <button
            v-for="nodeType in nodeTypeOptions"
            :key="nodeType.type"
            @click="addNewNode(nodeType.type)"
            class="w-full h-9 flex items-center gap-2.5 rounded-lg px-2 hover:bg-[rgba(255,255,255,0.04)] transition-colors"
          >
            <div class="w-7 h-7 rounded-lg bg-[#3b3e45] flex items-center justify-center shrink-0">
              <n-icon :size="15" class="text-[#d6d8de]"><component :is="nodeType.icon" /></n-icon>
            </div>
            <span class="text-[12px] font-medium text-[#f2f3f5]">{{ nodeType.name }}</span>
          </button>
        </div>
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

    </div>

    <!-- API Settings Modal | API 设置弹窗 -->
    <ApiSettings v-model:show="showApiSettings" />

    <!-- Rename Modal | 重命名弹窗 -->
    <n-modal v-model:show="showRenameModal" :mask-closable="true">
      <div class="ec-modal canvas-modal canvas-modal-sm">
        <div class="ec-modal-header">
          <h2 class="ec-modal-title">Rename Project</h2>
          <button class="ec-modal-close" @click="showRenameModal = false" aria-label="Close">
            <n-icon :size="20"><CloseOutline /></n-icon>
          </button>
        </div>
        <div class="ec-modal-body">
          <section class="ec-modal-section">
            <n-input v-model:value="renameValue" placeholder="Enter project name" />
          </section>
        </div>
        <div class="ec-modal-actions">
          <button class="ec-btn ec-btn-secondary" @click="showRenameModal = false">Cancel</button>
          <button class="ec-btn ec-btn-primary" @click="confirmRename">Save</button>
        </div>
      </div>
    </n-modal>

    <!-- Delete Confirm Modal | 删除确认弹窗 -->
    <n-modal v-model:show="showDeleteModal" :mask-closable="true">
      <div class="ec-modal canvas-modal canvas-modal-sm">
        <div class="ec-modal-header">
          <h2 class="ec-modal-title">Delete Project</h2>
          <button class="ec-modal-close" @click="showDeleteModal = false" aria-label="Close">
            <n-icon :size="20"><CloseOutline /></n-icon>
          </button>
        </div>
        <div class="ec-modal-body">
          <section class="ec-modal-section">
            <p class="modal-copy">Delete "{{ projectName }}"? This action cannot be undone.</p>
          </section>
        </div>
        <div class="ec-modal-actions">
          <button class="ec-btn ec-btn-secondary" @click="showDeleteModal = false">Cancel</button>
          <button class="ec-btn ec-btn-danger" @click="confirmDelete">Delete</button>
        </div>
      </div>
    </n-modal>

    <!-- Workflow Panel | 工作流面板 -->
    <WorkflowPanel v-model:show="showWorkflowPanel" @add-workflow="handleAddWorkflow" />

    <n-modal v-model:show="showShareModal" :mask-closable="true">
      <div class="ec-modal canvas-modal canvas-share-modal">
        <div class="ec-modal-header">
          <h2 class="ec-modal-title">Share</h2>
          <button class="ec-modal-close" @click="showShareModal = false" aria-label="Close">
            <n-icon :size="20"><CloseOutline /></n-icon>
          </button>
        </div>
        <div class="ec-modal-body share-panel">
          <section class="ec-modal-section share-section">
          <div class="share-row">
            <h3>Share a Link</h3>
            <button class="toggle-btn" :class="{ on: shareLinkEnabled }" @click="shareLinkEnabled = !shareLinkEnabled">
              <span />
            </button>
          </div>
          <p>Share a read-only link to your canvas.</p>
          <div class="share-link-box">
            <span class="share-link-text">{{ shareLinkUrl }}</span>
            <button class="ec-btn ec-btn-secondary copy-btn" @click="copyShareLink">Copy Link</button>
          </div>
        </section>

        <section class="ec-modal-section share-section">
          <div class="share-row">
            <h3>Allow Remixing</h3>
            <button class="toggle-btn" :class="{ on: allowRemixing }" @click="allowRemixing = !allowRemixing">
              <span />
            </button>
          </div>
          <p>When enabled, this project is published to Featured templates.</p>
        </section>

        <section class="ec-modal-section share-section">
          <h3>Change Appearance</h3>
          <p>Set how this shared project appears in My Templates.</p>
          <n-input v-model:value="shareTemplateName" placeholder="Template title" />
          <n-input
            v-model:value="shareTemplateDescription"
            type="textarea"
            placeholder="Template description"
            :autosize="{ minRows: 3, maxRows: 5 }"
            class="mt-2"
          />
        </section>
      </div>
      <div class="ec-modal-actions">
        <button class="ec-btn ec-btn-secondary" @click="showShareModal = false">Cancel</button>
        <button class="ec-btn ec-btn-primary" @click="saveSharedTemplate">Save To My Templates</button>
      </div>
      </div>
    </n-modal>
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
import { NIcon, NDropdown, NModal, NInput } from 'naive-ui'
import { 
  ChevronBackOutline,
  ChevronDownOutline,
  CloseOutline,
  SettingsOutline,
  AddOutline,
  ImageOutline,
  TextOutline,
  VideocamOutline,
  ArrowUndoOutline,
  ArrowRedoOutline,
  LocateOutline,
  RemoveOutline,
  FolderOutline
} from '../icons/coolicons'
import { nodes, edges, addEdge, loadProject, saveProject, flushSave, clearCanvas, canvasViewport, updateViewport, undo, redo, canUndo, canRedo, manualSaveHistory } from '../stores/canvas'
import { loadAllModels } from '../stores/models'
import { useNodesFactory } from '../hooks'
import { edgeStrategy, isConnectionValid } from '../services/edgeStrategy'
import { notifier } from '../utils/notifier'
import { getErrorMessage } from '@/utils'
import { getWorkflowById } from '@/config/workflows'
import { projects, initProjectsStore, renameProject, duplicateProject, deleteProject } from '../stores/projects'
import { useAuthStore } from '@/stores/auth'
import { useWorkflowsStore } from '@/stores/workflows'

// API Settings component | API 设置组件
import ApiSettings from '../components/ApiSettings.vue'
import WorkflowPanel from '../components/WorkflowPanel.vue'

// Initialize models on page load | 页面加载时初始化模型
onMounted(() => {
  loadAllModels()
})

// Vue Flow instance | Vue Flow 实例
const { viewport, zoomIn, zoomOut, fitView, updateNodeInternals } = useVueFlow()

// Nodes factory | 节点工厂
const nodesFactory = useNodesFactory({ updateNodeInternals, viewport })

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
import DefaultEdge from '../components/edges/DefaultEdge.vue'

const router = useRouter()
const route = useRoute()
const { user, updateProfile } = useAuthStore()
const { loadWorkflowTemplates, shareProjectAsMyTemplate } = useWorkflowsStore()
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
      if (!err?.__handled) {
        notifier.error(getErrorMessage(err, 'Failed to update avatar'))
      }
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
  default: markRaw(DefaultEdge),
  imageRole: markRaw(ImageRoleEdge),
  promptOrder: markRaw(PromptOrderEdge),
  imageOrder: markRaw(ImageOrderEdge)
}

// UI state | UI状态
const showNodeMenu = ref(false)
const isMobile = ref(false)
const showGrid = ref(true)
const showApiSettings = ref(false)

// Flow key for forcing re-render on project switch | 项目切换时强制重新渲染的 key
const flowKey = ref(Date.now())

// Modal state | 弹窗状态
const showRenameModal = ref(false)
const showDeleteModal = ref(false)
const showWorkflowPanel = ref(false)
const showShareModal = ref(false)
const renameValue = ref('')
const shareLinkEnabled = ref(true)
const allowRemixing = ref(false)
const shareTemplateName = ref('')
const shareTemplateDescription = ref('')


// Project info | 项目信息
const projectName = computed(() => {
  const project = projects.value.find(p => p.id === route.params.id)
  return project?.name || 'Untitled'
})
const currentProject = computed(() => projects.value.find(p => p.id === route.params.id) || null)
const shareLinkUrl = computed(() => `${window.location.origin}/canvas/${route.params.id}`)

// Project dropdown options | 项目下拉选项
const projectOptions = [
  { label: 'Rename', key: 'rename' },
  { label: 'Duplicate', key: 'duplicate' },
  { label: 'Delete', key: 'delete' }
]

// Node type options for menu | 节点类型菜单选项
const nodeTypeOptions = [
  { type: 'text', name: 'Text', icon: TextOutline },
  { type: 'image', name: 'Image', icon: ImageOutline },
  { type: 'video', name: 'Video', icon: VideocamOutline }
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

const copyShareLink = async () => {
  try {
    await navigator.clipboard.writeText(shareLinkUrl.value)
    notifier.success('Share link copied')
  } catch {
    notifier.warning('Copy failed')
  }
}

const openShareDialog = async () => {
  await loadWorkflowTemplates()
  shareTemplateName.value = projectName.value
  shareTemplateDescription.value = ''
  showShareModal.value = true
}

const saveSharedTemplate = async () => {
  const project = currentProject.value
  if (!project?.id || !project?.canvasData) {
    notifier.error('Project data unavailable')
    return
  }
  const visibility = allowRemixing.value ? 'public' : (shareLinkEnabled.value ? 'unlisted' : 'private')
  await shareProjectAsMyTemplate({
    projectId: project.id,
    name: shareTemplateName.value || project.name || 'Untitled',
    description: shareTemplateDescription.value || '',
    cover: project.thumbnail || '',
    canvasData: project.canvasData,
    visibility
  })
  notifier.success('Shared to My Templates')
  showShareModal.value = false
}

// Handle connection | 处理连接
const onConnect = (params) => {
  if (pendingConnect.value) {
    connectSucceeded.value = true
  }
  if (!isConnectionValid(params)) {
    notifier.warning('This connection is not supported for the selected modules')
    return
  }
  const edge = edgeStrategy.resolve(params)
  addEdge(edge)
}

const pendingConnect = ref(null)
const connectSucceeded = ref(false)

const readPointer = (eventLike) => {
  if (!eventLike) return null
  if (eventLike.touches?.length) {
    return { x: eventLike.touches[0].clientX, y: eventLike.touches[0].clientY }
  }
  if (eventLike.changedTouches?.length) {
    return { x: eventLike.changedTouches[0].clientX, y: eventLike.changedTouches[0].clientY }
  }
  const x = eventLike.clientX ?? eventLike.x ?? eventLike.pageX
  const y = eventLike.clientY ?? eventLike.y ?? eventLike.pageY
  if (typeof x === 'number' && typeof y === 'number') return { x, y }
  return null
}

const onConnectStart = (params) => {
  const nodeId = params?.nodeId
  const handleId = params?.handleId
  const handleType = params?.handleType
  if (!nodeId || !handleId || !handleType) {
    pendingConnect.value = null
    return
  }
  pendingConnect.value = {
    nodeId,
    handleId,
    handleType,
    startPoint: readPointer(params?.event)
  }
  connectSucceeded.value = false
}

const onConnectEnd = (event) => {
  const current = pendingConnect.value
  if (!current) return

  pendingConnect.value = null
  connectSucceeded.value = false
}

// Keep runtime selected flag in node.data synchronized with VueFlow selected state.
const syncNodeSelectedState = () => {
  const nextNodes = nodes.value.map((node) => {
    const selected = !!node.selected
    const current = !!node.data?.selected
    if (selected === current) return node
    return {
      ...node,
      data: {
        ...(node.data || {}),
        selected
      }
    }
  })
  if (nextNodes.some((node, index) => node !== nodes.value[index])) {
    nodes.value = nextNodes
  }
}

// Handle node click | 处理节点点击
const onNodeClick = () => {
  showNodeMenu.value = false
}

// Handle node changes | 处理节点变化（包含多选/框选）
const onNodesChange = () => {
  nextTick(() => {
    syncNodeSelectedState()
  })
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
  nodes.value = nodes.value.map((node) => ({
    ...node,
    selected: false,
    data: {
      ...(node.data || {}),
      selected: false,
      openPortMenu: null
    }
  }))
}

const isTypingElement = (target) => {
  if (!target) return false
  const el = target
  const tag = String(el.tagName || '').toLowerCase()
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true
  return !!el.closest?.('[contenteditable="true"]')
}

const removeSelectedElements = () => {
  const selectedNodeIds = new Set(
    nodes.value.filter((node) => node.selected || node.data?.selected).map((node) => node.id)
  )
  const selectedEdgeIds = new Set(edges.value.filter((edge) => edge.selected).map((edge) => edge.id))
  if (selectedNodeIds.size === 0 && selectedEdgeIds.size === 0) return

  nodes.value = nodes.value.filter((node) => !selectedNodeIds.has(node.id))
  edges.value = edges.value.filter((edge) => {
    if (selectedEdgeIds.has(edge.id)) return false
    if (selectedNodeIds.has(edge.source) || selectedNodeIds.has(edge.target)) return false
    return true
  })
  manualSaveHistory()
}

const handleGlobalKeydown = (event) => {
  if (isTypingElement(event.target)) return
  if (event.key !== 'Delete' && event.key !== 'Backspace') return
  removeSelectedElements()
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
  try {
    await deleteProject(projectId)
    notifier.success('Project deleted')
    router.push('/')
  } catch (err) {
    if (!err?.__handled) {
      notifier.error(getErrorMessage(err, 'Delete failed'))
    }
  }
}

// Go back to home | 返回首页
const goBack = () => {
  flushSave()
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

const applyPendingWorkflowTemplate = async () => {
  const raw = sessionStorage.getItem('ai-canvas-workflow-template')
  if (!raw) return

  sessionStorage.removeItem('ai-canvas-workflow-template')

  let payload = null
  try {
    payload = JSON.parse(raw)
  } catch {
    return
  }

  const workflowId = String(payload?.workflowId || '')
  if (!workflowId || nodes.value.length > 0) return

  const workflow = getWorkflowById(workflowId)
  if (!workflow) return

  await nodesFactory.createFromWorkflow(workflow, {})
}

// Watch for route changes | 监听路由变化
watch(
  () => route.params.id,
  (newId, oldId) => {
    if (newId && newId !== oldId) {
      // Save current project before switching | 切换前保存当前项目
      if (oldId) {
        flushSave()
      }
      // Load new project | 加载新项目
      loadProjectById(newId)
    }
  }
)

const handlePageHide = () => {
  flushSave()
}

const handleVisibilityChange = () => {
  if (document.visibilityState === 'hidden') {
    flushSave()
  }
}

// Initialize | 初始化
onMounted(async () => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
  window.addEventListener('pagehide', handlePageHide)
  window.addEventListener('keydown', handleGlobalKeydown)
  document.addEventListener('visibilitychange', handleVisibilityChange)
  
  // Initialize projects store | 初始化项目存储
  await initProjectsStore()
  await loadWorkflowTemplates()
  
  // Load project data | 加载项目数据
  loadProjectById(route.params.id)
  await nextTick()
  await applyPendingWorkflowTemplate()
})

// Cleanup on unmount | 卸载时清理
onUnmounted(() => {
  window.removeEventListener('resize', checkMobile)
  window.removeEventListener('pagehide', handlePageHide)
  window.removeEventListener('keydown', handleGlobalKeydown)
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  // Save project before leaving | 离开前保存项目
  flushSave()
})
</script>

<style>
/* Import Vue Flow styles | 引入 Vue Flow 样式 */
@import '@vue-flow/core/dist/style.css';
@import '@vue-flow/core/dist/theme-default.css';
@import '@vue-flow/minimap/dist/style.css';

.share-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.canvas-modal {
  width: min(760px, calc(100vw - 48px));
}

.canvas-modal-sm {
  width: min(520px, calc(100vw - 48px));
  min-height: auto;
}

.canvas-share-modal {
  width: min(860px, calc(100vw - 48px));
}

.share-section {
  border-color: rgba(143, 143, 143, 0.24);
  background: rgba(9, 11, 15, 0.85);
}

.share-section h3 {
  margin: 0;
  font-size: 15px;
}

.share-section p {
  margin: 8px 0 0;
  color: #8d949e;
  font-size: 13px;
}

.share-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.toggle-btn {
  width: 46px;
  height: 26px;
  border-radius: 999px;
  border: 1px solid var(--border-color);
  background: var(--bg-tertiary);
  padding: 2px;
  position: relative;
  cursor: pointer;
}

.toggle-btn span {
  display: block;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.18s;
}

.toggle-btn.on {
  background: var(--accent-color);
  border-color: var(--accent-color);
}

.toggle-btn.on span {
  transform: translateX(20px);
}

.share-link-box {
  margin-top: 10px;
  border: 1px solid rgba(143, 143, 143, 0.24);
  border-radius: 10px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  background: #101218;
}

.share-link-text {
  flex: 1;
  font-size: 12px;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.copy-btn {
  min-width: 102px;
  border-radius: 10px;
  height: 34px;
  padding: 0 10px;
  font-size: 12px;
}

.modal-copy {
  margin: 0;
  color: #d7dbe3;
  font-size: 14px;
}

.canvas-modal :deep(.n-input),
.canvas-modal :deep(.n-input-wrapper),
.canvas-modal :deep(.n-input .n-input__textarea-el),
.canvas-modal :deep(.n-input .n-input__input-el) {
  color: #f2f3f5;
}

.canvas-modal :deep(.n-input) {
  background: #101218;
  border-radius: 10px;
}

.canvas-modal :deep(.n-input .n-input__border),
.canvas-modal :deep(.n-input .n-input__state-border) {
  border-color: rgba(143, 143, 143, 0.24);
}

.canvas-flow {
  width: 100%;
  height: 100%;
  background: #1c1c1c;
}

.canvas-flow :deep(.vue-flow__pane) {
  background: #1c1c1c;
}

.canvas-flow :deep(.vue-flow__node-text),
.canvas-flow :deep(.vue-flow__node-image),
.canvas-flow :deep(.vue-flow__node-video) {
  box-shadow: none !important;
  border-radius: 24px !important;
}

.canvas-flow :deep(.vue-flow__edge-path) {
  stroke: #ffffff;
  stroke-width: 1;
  stroke-dasharray: 0;
}

.canvas-flow :deep(.vue-flow__edge.selected .vue-flow__edge-path) {
  stroke: #ffffff;
  stroke-width: 2;
  stroke-dasharray: 0;
}
</style>
