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
          @click="toggleToolbarNodeMenu"
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
      <div v-if="showNodeMenu" class="flora-panel absolute rounded-[20px] p-3 z-30 w-[310px] border border-[rgba(143,143,143,0.24)] bg-[rgba(18,18,18,0.96)] backdrop-blur-xl" :style="nodeMenuStyle">
        <div v-if="nodeMenuMode !== 'connect'" class="node-menu-header">
          <div>
            <div class="node-menu-eyebrow">ADD MODULE</div>
            <h3 class="node-menu-title">{{ nodeMenuTitle }}</h3>
            <p class="node-menu-copy">{{ nodeMenuCopy }}</p>
          </div>
        </div>
        <div class="node-menu-list">
          <button
            v-for="nodeType in nodeTypeOptions"
            :key="nodeType.type"
            @click="addNewNode(nodeType.type)"
            class="node-menu-item"
          >
            <div class="node-menu-item-icon">
              <n-icon :size="16" class="text-[#f3f4f6]"><component :is="nodeType.icon" /></n-icon>
            </div>
            <div class="node-menu-item-copy">
              <span class="node-menu-item-title">{{ nodeType.name }}</span>
              <span class="node-menu-item-description">{{ nodeType.description }}</span>
            </div>
          </button>
        </div>
        <div class="node-menu-quantity">
          <div>
            <div class="node-menu-quantity-label">Quantity</div>
            <div class="node-menu-quantity-note">Default 1, up to 5 modules</div>
          </div>
          <div class="node-menu-stepper">
            <button class="node-menu-stepper-btn" @click="decreaseNodeCount" :disabled="nodeCreateCount <= 1">-</button>
            <span class="node-menu-stepper-value">{{ nodeCreateCount }}</span>
            <button class="node-menu-stepper-btn" @click="increaseNodeCount" :disabled="nodeCreateCount >= 5">+</button>
          </div>
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
import { nodes, edges, addEdge, addNode, loadProject, saveProject, flushSave, clearCanvas, canvasViewport, updateViewport, undo, redo, canUndo, canRedo, manualSaveHistory } from '../stores/canvas'
import { loadAllModels } from '../stores/models'
import { useNodesFactory } from '../hooks'
import { useAvatarUpload } from '@/hooks/useAvatarUpload'
import { useCanvasProjectActions } from '@/hooks/useCanvasProjectActions'
import { edgeStrategy, isConnectionValid } from '../services/edgeStrategy'
import { notifier } from '../utils/notifier'
import { getWorkflowById } from '@/config/workflows'
import { initProjectsStore } from '../stores/projects'
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
const { avatarInputRef, avatarInitial, triggerAvatarUpload, handleAvatarChange } = useAvatarUpload({
  user,
  updateProfile,
  notify: notifier
})

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
const nodeCreateCount = ref(1)
const nodeMenuMode = ref('toolbar')
const nodeMenuScreenPosition = ref(null)
const pendingConnectMenuContext = ref(null)
const suppressPaneClickUntil = ref(0)

// Flow key for forcing re-render on project switch | 项目切换时强制重新渲染的 key
const flowKey = ref(Date.now())
const showWorkflowPanel = ref(false)
const {
  allowRemixing,
  confirmDelete,
  confirmRename,
  copyShareLink,
  currentProject,
  handleProjectAction,
  openShareDialog,
  projectName,
  projectOptions,
  renameValue,
  saveSharedTemplate,
  shareLinkEnabled,
  shareLinkUrl,
  shareTemplateDescription,
  shareTemplateName,
  showDeleteModal,
  showRenameModal,
  showShareModal
} = useCanvasProjectActions({
  route,
  router,
  notifier,
  loadWorkflowTemplates,
  shareProjectAsMyTemplate
})

// Node type options for menu | 节点类型菜单选项
const nodeTypeOptions = [
  { type: 'text', name: 'Text', icon: TextOutline, description: 'Write prompts, scripts, and supporting copy.' },
  { type: 'image', name: 'Image', icon: ImageOutline, description: 'Generate, preview, and upload still images.' },
  { type: 'video', name: 'Video', icon: VideocamOutline, description: 'Generate videos with connected visual inputs.' }
]
const nodeMenuTitle = computed(() =>
  nodeMenuMode.value === 'connect'
    ? 'Create And Link A Module'
    : 'Choose A Base Module'
)
const nodeMenuCopy = computed(() =>
  nodeMenuMode.value === 'connect'
    ? 'Release a loose connection anywhere on the canvas, then pick a module to create and link it from that spot.'
    : 'Pick a module type, then add between 1 and 5 modules at once.'
)
const nodeMenuStyle = computed(() => {
  if (nodeMenuScreenPosition.value) {
    const x = Math.max(92, Math.min(window.innerWidth - 334, nodeMenuScreenPosition.value.x))
    const y = Math.max(18, Math.min(window.innerHeight - 340, nodeMenuScreenPosition.value.y))
    return {
      left: `${x}px`,
      top: `${y}px`
    }
  }
  return {
    left: '90px',
    top: '50%',
    transform: 'translateY(-50%)'
  }
})

const clearNodeMenuContext = () => {
  nodeMenuMode.value = 'toolbar'
  nodeMenuScreenPosition.value = null
  pendingConnectMenuContext.value = null
}

const toggleToolbarNodeMenu = () => {
  if (showNodeMenu.value && nodeMenuMode.value === 'toolbar') {
    showNodeMenu.value = false
    clearNodeMenuContext()
    return
  }
  nodeMenuMode.value = 'toolbar'
  nodeMenuScreenPosition.value = null
  pendingConnectMenuContext.value = null
  showNodeMenu.value = true
}

const screenPointToFlowPoint = (point) => {
  const zoom = viewport.value?.zoom || 1
  const x = -((viewport.value?.x || 0) / zoom) + point.x / zoom
  const y = -((viewport.value?.y || 0) / zoom) + point.y / zoom
  return { x, y }
}

const openConnectNodeMenu = (point, context) => {
  nodeMenuMode.value = 'connect'
  nodeMenuScreenPosition.value = {
    x: point.x + 12,
    y: point.y - 12
  }
  suppressPaneClickUntil.value = Date.now() + 160
  pendingConnectMenuContext.value = {
    ...context,
    flowPosition: screenPointToFlowPoint(point)
  }
  showNodeMenu.value = true
}

// Add new node | 添加新节点
const addNewNode = async (type) => {
  if (pendingConnectMenuContext.value) {
    const context = pendingConnectMenuContext.value
    const createdNodeIds = []

    for (let index = 0; index < nodeCreateCount.value; index += 1) {
      const col = index % 2
      const row = Math.floor(index / 2)
      const newNodeId = addNode(type, {
        x: context.flowPosition.x + col * 120,
        y: context.flowPosition.y + row * 132
      })
      createdNodeIds.push(newNodeId)

      const params = context.handleType === 'source'
        ? {
            source: context.nodeId,
            target: newNodeId,
            sourceHandle: context.handleId || 'right',
            targetHandle: 'left'
          }
        : {
            source: newNodeId,
            target: context.nodeId,
            sourceHandle: 'right',
            targetHandle: context.handleId || 'left'
          }
      addEdge(edgeStrategy.resolve(params))
    }

    setTimeout(() => {
      createdNodeIds.forEach((nodeId) => updateNodeInternals(nodeId))
      updateNodeInternals(context.nodeId)
    }, 60)

    showNodeMenu.value = false
    clearNodeMenuContext()
    return
  }

  for (let index = 0; index < nodeCreateCount.value; index += 1) {
    const col = index % 2
    const row = Math.floor(index / 2)
    await nodesFactory.addNewNode(type, {
      x: col * 88,
      y: row * 118
    })
  }
  showNodeMenu.value = false
  clearNodeMenuContext()
}

const increaseNodeCount = () => {
  nodeCreateCount.value = Math.min(5, nodeCreateCount.value + 1)
}

const decreaseNodeCount = () => {
  nodeCreateCount.value = Math.max(1, nodeCreateCount.value - 1)
}

// Handle add workflow from panel | 处理从面板添加工作流
const handleAddWorkflow = async ({ workflow, options }) => {
  await nodesFactory.createFromWorkflow(workflow, options)
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
  const rawEvent = eventLike?.event || eventLike
  if (rawEvent.touches?.length) {
    return { x: rawEvent.touches[0].clientX, y: rawEvent.touches[0].clientY }
  }
  if (rawEvent.changedTouches?.length) {
    return { x: rawEvent.changedTouches[0].clientX, y: rawEvent.changedTouches[0].clientY }
  }
  const x = rawEvent.clientX ?? rawEvent.x ?? rawEvent.pageX
  const y = rawEvent.clientY ?? rawEvent.y ?? rawEvent.pageY
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

  const releasePoint = readPointer(event)
  const shouldOpenMenu = !connectSucceeded.value && releasePoint

  pendingConnect.value = null
  connectSucceeded.value = false

  if (shouldOpenMenu) {
    openConnectNodeMenu(releasePoint, current)
  }
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
  clearNodeMenuContext()
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
  if (Date.now() < suppressPaneClickUntil.value) {
    return
  }
  showNodeMenu.value = false
  clearNodeMenuContext()
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
  gap: 14px;
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
  background: rgba(12, 12, 12, 0.96);
}

.share-section h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.01em;
}

.share-section p {
  margin: 10px 0 0;
  color: #9ca3af;
  font-size: 13px;
  line-height: 1.5;
}

.share-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.toggle-btn {
  width: 46px;
  height: 26px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: #1c1c1c;
  padding: 2px;
  position: relative;
  cursor: pointer;
  transition: background 0.18s ease, border-color 0.18s ease;
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
  background: #f3f4f6;
  border-color: #f3f4f6;
}

.toggle-btn.on span {
  transform: translateX(20px);
  background: #111111;
}

.share-link-box {
  margin-top: 10px;
  border: 1px solid rgba(143, 143, 143, 0.24);
  border-radius: 10px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: #0e0e0e;
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
  border-color: rgba(255, 255, 255, 0.18);
  background: #181818;
  color: #f5f5f5;
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
  background: #0f0f0f;
  border-radius: 10px;
  --n-border: rgba(143, 143, 143, 0.24) !important;
  --n-border-hover: rgba(186, 190, 196, 0.34) !important;
  --n-border-focus: rgba(212, 198, 182, 0.68) !important;
  --n-box-shadow-focus: 0 0 0 1px rgba(165, 129, 99, 0.22) !important;
  --n-color-focus: #111214 !important;
  --n-color-focus-warning: #111214 !important;
  --n-color-focus-error: #111214 !important;
}

.canvas-modal :deep(.n-input .n-input__border),
.canvas-modal :deep(.n-input .n-input__state-border) {
  border-color: rgba(143, 143, 143, 0.24);
}

.canvas-share-modal :deep(.n-input-wrapper),
.canvas-share-modal :deep(.n-input__textarea),
.canvas-share-modal :deep(.n-input__textarea-el),
.canvas-share-modal :deep(.n-input__input-el) {
  background: #111214 !important;
}

.canvas-share-modal :deep(.n-input.n-input--focus),
.canvas-share-modal :deep(.n-input.n-input--focus .n-input__state-border),
.canvas-share-modal :deep(.n-input.n-input--focus .n-input__border) {
  border-color: rgba(212, 198, 182, 0.68) !important;
  box-shadow: 0 0 0 1px rgba(165, 129, 99, 0.22) !important;
}

.canvas-share-modal :deep(.n-input__input-el::placeholder),
.canvas-share-modal :deep(.n-input__textarea-el::placeholder) {
  color: #6b7280;
}

.canvas-share-modal .ec-btn-primary {
  background: #f5f5f5;
  border-color: #f5f5f5;
  color: #111111;
}

.canvas-share-modal .ec-btn-primary:hover:not(:disabled) {
  background: #ffffff;
  border-color: #ffffff;
}

.canvas-share-modal .ec-btn-secondary {
  background: #181818;
  border-color: rgba(255, 255, 255, 0.18);
  color: #f3f4f6;
}

.canvas-share-modal .ec-btn-secondary:hover:not(:disabled) {
  background: #242424;
  border-color: rgba(255, 255, 255, 0.28);
}

.node-menu-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 14px;
}

.node-menu-eyebrow {
  font-size: 11px;
  line-height: 1;
  letter-spacing: 0.14em;
  color: #6b7280;
  margin-bottom: 10px;
}

.node-menu-title {
  margin: 0;
  font-size: 16px;
  line-height: 1.2;
  font-weight: 600;
  color: #f3f4f6;
}

.node-menu-copy {
  margin: 8px 0 0;
  font-size: 13px;
  line-height: 1.5;
  color: #9ca3af;
}

.node-menu-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.node-menu-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  border-radius: 16px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.06);
  transition: background 0.18s ease, border-color 0.18s ease, transform 0.18s ease;
}

.node-menu-item:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.12);
  transform: translateY(-1px);
}

.node-menu-item-icon {
  width: 40px;
  height: 40px;
  border-radius: 14px;
  background: linear-gradient(180deg, #2a2a2a 0%, #1a1a1a 100%);
  border: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.node-menu-item-copy {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  min-width: 0;
}

.node-menu-item-title {
  font-size: 13px;
  line-height: 1.2;
  color: #f3f4f6;
  font-weight: 600;
}

.node-menu-item-description {
  font-size: 12px;
  line-height: 1.45;
  color: #9ca3af;
  text-align: left;
}

.node-menu-quantity {
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.node-menu-quantity-label {
  font-size: 13px;
  font-weight: 600;
  color: #f3f4f6;
}

.node-menu-quantity-note {
  margin-top: 4px;
  font-size: 12px;
  color: #6b7280;
}

.node-menu-stepper {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 4px;
  border-radius: 999px;
  background: #141414;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.node-menu-stepper-btn {
  width: 32px;
  height: 32px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #1f1f1f;
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #f3f4f6;
  font-size: 16px;
  transition: background 0.18s ease, border-color 0.18s ease, opacity 0.18s ease;
}

.node-menu-stepper-btn:hover:not(:disabled) {
  background: #2b2b2b;
  border-color: rgba(255, 255, 255, 0.24);
}

.node-menu-stepper-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.node-menu-stepper-value {
  min-width: 24px;
  text-align: center;
  font-size: 13px;
  color: #f3f4f6;
  font-weight: 600;
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
