<template>
  <!-- Canvas page | 画布页面 -->
  <div ref="canvasShellRef" class="h-screen w-screen bg-[#080808]">
    <!-- Main canvas area | 主画布区域 -->
    <div class="h-full relative overflow-hidden">
      <!-- Top capsules | 顶部胶囊菜单 -->
      <div class="absolute left-4 top-4 z-20 flex items-center gap-2">
        <div class="flora-panel rounded-full p-1.5">
          <button
            @click="goWorkspace"
            class="ui-pill-button"
            title="Workspace"
          >
            <n-icon :size="18"><ChevronBackOutline /></n-icon>
            <span class="text-sm font-medium">Workspace</span>
          </button>
        </div>
        <div class="flora-panel rounded-full p-1.5">
          <BaseDropdown :options="projectOptions" compact @select="handleProjectAction">
            <button class="ui-pill-button ui-pill-button--compact">
              <span class="text-sm font-medium">{{ projectName }}</span>
              <n-icon :size="16"><ChevronDownOutline /></n-icon>
            </button>
          </BaseDropdown>
        </div>
      </div>

      <div class="absolute right-4 top-4 z-20 flex items-center gap-2">
        <div class="flora-panel rounded-full p-1.5">
          <button
            @click="openShareDialog"
            class="ui-pill-button"
            title="Share"
          >
            <n-icon :size="16"><CopyOutline /></n-icon>
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
        :style="canvasFlowStyle"
      >
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

      <div class="group-overlay-layer">
        <div
          v-if="multiSelectMenuRect"
          class="capsule-menu group-capsule-menu"
          :style="{
            left: `${multiSelectMenuRect.left + multiSelectMenuRect.width / 2}px`,
            top: `${Math.max(20, multiSelectMenuRect.top - 54)}px`
          }"
        >
          <div class="capsule-inner capsule-inner-selected">
            <button class="capsule-icon capsule-icon-solid capsule-create group-primary-btn" @click="handleCreateGroup" title="Group">
              <n-icon :size="14"><AppsOutline /></n-icon>
              <span class="capsule-create-label">Group</span>
            </button>
          </div>
        </div>

        <template v-for="group in renderedGroups" :key="group.id">
          <div
            class="canvas-group-box"
            :class="{ 'is-selected': selectedGroupId === group.id }"
            :style="{
              left: `${group.rect.left}px`,
              top: `${group.rect.top}px`,
              width: `${group.rect.width}px`,
              height: `${group.rect.height}px`
            }"
          >
            <button
              class="canvas-group-title"
              :class="{ 'is-selected': selectedGroupId === group.id }"
              @mousedown="startGroupDrag(group, $event)"
              @click.stop="selectGroup(group.id)"
            >
              {{ group.name }}
            </button>
            <button class="canvas-group-edge top" @mousedown="startGroupDrag(group, $event)" @click.stop="selectGroup(group.id)" />
            <button class="canvas-group-edge right" @mousedown="startGroupDrag(group, $event)" @click.stop="selectGroup(group.id)" />
            <button class="canvas-group-edge bottom" @mousedown="startGroupDrag(group, $event)" @click.stop="selectGroup(group.id)" />
            <button class="canvas-group-edge left" @mousedown="startGroupDrag(group, $event)" @click.stop="selectGroup(group.id)" />
          </div>
        </template>

        <div
          v-if="selectedGroupMenuRect"
          class="capsule-menu group-capsule-menu"
          :style="{
            left: `${selectedGroupMenuRect.left + selectedGroupMenuRect.width / 2}px`,
            top: `${Math.max(20, selectedGroupMenuRect.top - 54)}px`
          }"
        >
          <div class="capsule-inner capsule-inner-selected">
            <div class="capsule-group">
              <button class="capsule-icon" @click="openRenameGroupModal" title="Rename">
                <n-icon :size="14"><CreateOutline /></n-icon>
              </button>
              <button class="capsule-icon" @click="handleDuplicateSelectedGroup" title="Duplicate Group">
                <n-icon :size="14"><CopyOutline /></n-icon>
              </button>
              <button class="capsule-icon" @click="handleUngroupSelectedGroup" title="Ungroup">
                <n-icon :size="14"><RemoveOutline /></n-icon>
              </button>
              <button class="capsule-icon group-danger-icon" @click="handleDeleteSelectedGroup" title="Delete Group">
                <n-icon :size="14"><TrashOutline /></n-icon>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Left toolbar | 左侧工具栏 -->
      <aside class="flora-panel absolute left-4 top-1/2 -translate-y-1/2 flex flex-col gap-2 p-2 rounded-[36px] z-20 w-[64px]">
        <button 
          @click="toggleToolbarNodeMenu"
          class="ui-toolbar-button ui-toolbar-button--round canvas-primary-tool"
          title="Add Node"
        >
          <n-icon :size="20"><AddOutline /></n-icon>
        </button>
        <button 
          @click="showWorkflowPanel = true"
          class="ui-toolbar-button"
          title="Workflow Templates"
        >
          <n-icon :size="20"><FolderOutline /></n-icon>
        </button>
        <button
          @click="undo"
          :disabled="!canUndo()"
          class="ui-toolbar-button"
          title="Undo"
        >
          <n-icon :size="20"><ArrowUndoOutline /></n-icon>
        </button>
        <button 
          @click="redo"
          :disabled="!canRedo()"
          class="ui-toolbar-button"
          title="Redo"
        >
          <n-icon :size="20"><ArrowRedoOutline /></n-icon>
        </button>
        <button
          @click="showApiSettings = true"
          class="ui-toolbar-button text-white"
          title="API Settings"
        >
          <n-icon :size="20"><SettingsOutline /></n-icon>
        </button>
        <button
          v-if="showLocalInjectButton"
          @click="triggerLocalImageInject"
          class="ui-toolbar-button text-white"
          title="Inject Image"
        >
          <n-icon :size="20"><ImageOutline /></n-icon>
        </button>
        <div class="w-full h-px bg-[var(--border-color)] my-1"></div>
        <button
          @click="triggerAvatarUpload"
          class="ui-toolbar-button ui-toolbar-button--round mt-auto overflow-hidden border border-[var(--border-color)] bg-[var(--bg-secondary)]"
          title="Upload avatar"
        >
          <img v-if="user?.avatarUrl" :src="user.avatarUrl" alt="avatar" class="w-full h-full object-cover" />
          <span v-else class="text-xs">{{ avatarInitial }}</span>
        </button>
        <input ref="localInjectInputRef" type="file" accept="image/*" class="hidden" @change="handleLocalImageInject" />
        <input ref="avatarInputRef" type="file" accept="image/*" class="hidden" @change="handleAvatarChange" />
      </aside>

      <!-- Node menu popup | 节点菜单弹窗 -->
      <div v-if="showNodeMenu" class="flora-panel absolute rounded-[22px] p-6 z-30 w-[338px] border border-[rgba(143,143,143,0.24)] bg-[rgba(18,18,18,0.96)] backdrop-blur-xl" :style="nodeMenuStyle">
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
      <div class="flora-panel absolute bottom-4 left-4 z-20 flex items-center gap-2 rounded-full p-1.5">
        <button 
          @click="fitView({ padding: 0.2 })" 
          class="ui-icon-button"
          title="Fit View"
        >
          <n-icon :size="16"><LocateOutline /></n-icon>
        </button>
        <div class="flex h-9 items-center gap-1 rounded-full px-2">
          <button @click="zoomOut" class="ui-icon-button !h-8 !w-8">
            <n-icon :size="14"><RemoveOutline /></n-icon>
          </button>
          <span class="flex min-w-[48px] items-center justify-center text-xs font-medium leading-none">{{ Math.round(viewport.zoom * 100) }}%</span>
          <button @click="zoomIn" class="ui-icon-button !h-8 !w-8">
            <n-icon :size="14"><AddOutline /></n-icon>
          </button>
        </div>
      </div>

    </div>

    <!-- API Settings Modal | API 设置弹窗 -->
    <ApiSettings v-model:show="showApiSettings" />

    <!-- Rename Modal | 重命名弹窗 -->
    <BaseModal
      v-model:show="showRenameModal"
      title="Rename project"
      description="Update the project name shown in the canvas."
      size="sm"
    >
      <BaseInput v-model="renameValue" placeholder="Enter project name" />
      <template #footer>
        <div class="ui-modal-actions">
          <BaseButton variant="ghost" @click="showRenameModal = false">Cancel</BaseButton>
          <BaseButton @click="confirmRename">Save</BaseButton>
        </div>
      </template>
    </BaseModal>

    <!-- Delete Confirm Modal | 删除确认弹窗 -->
    <BaseModal
      v-model:show="showDeleteModal"
      title="Delete project"
      description="This action permanently removes the current canvas project."
      size="sm"
    >
      <p class="ui-body ui-modal-copy">Delete "{{ projectName }}"? This action cannot be undone.</p>
      <template #footer>
        <div class="ui-modal-actions">
          <BaseButton variant="ghost" @click="showDeleteModal = false">Cancel</BaseButton>
          <BaseButton variant="danger" @click="confirmDelete">Delete</BaseButton>
        </div>
      </template>
    </BaseModal>

    <BaseModal
      v-model:show="showGroupRenameModal"
      title="Rename group"
      description="Update the selected group label."
      size="sm"
    >
      <BaseInput v-model="groupRenameValue" placeholder="Enter group name" @keyup.enter="confirmRenameGroup" />
      <template #footer>
        <div class="ui-modal-actions">
          <BaseButton variant="ghost" @click="showGroupRenameModal = false">Cancel</BaseButton>
          <BaseButton @click="confirmRenameGroup">Save</BaseButton>
        </div>
      </template>
    </BaseModal>

    <!-- Workflow Panel | 工作流面板 -->
    <WorkflowPanel v-model:show="showWorkflowPanel" @add-workflow="handleAddWorkflow" />

    <BaseModal
      v-model:show="showShareModal"
      title="Share To Workspace"
      description="Publish this project as a reusable template so other workspace members can copy the full canvas."
      size="sm"
    >
      <div class="share-panel">
        <section class="share-section">
          <div class="share-heading">
            <h3>Workspace</h3>
            <p>{{ workspaceName }}</p>
          </div>
        </section>

        <section class="share-section share-form-section">
          <div class="share-heading">
            <h3>Template Details</h3>
            <p>Other members will see this in Featured Templates and can create their own copy from it.</p>
          </div>
          <BaseInput v-model="shareTemplateName" placeholder="Template title" />
          <textarea
            v-model="shareTemplateDescription"
            placeholder="Template description"
            rows="4"
            class="share-textarea ui-body"
          />
        </section>

        <section class="share-section">
          <div class="share-heading">
            <h3>Status</h3>
            <p v-if="shareDialogLoading">Loading current publish status...</p>
            <p v-else-if="isTemplatePublished">
              Published to Featured Templates<span v-if="lastPublishedAt"> · Updated {{ new Date(lastPublishedAt).toLocaleString() }}</span>
            </p>
            <p v-else>Not published yet.</p>
          </div>
        </section>
      </div>
      <template #footer>
        <div class="ui-modal-actions">
          <BaseButton variant="ghost" @click="showShareModal = false">Close</BaseButton>
          <BaseButton
            v-if="isTemplatePublished"
            variant="secondary"
            :loading="shareActionLoading"
            @click="removeSharedTemplate"
          >
            Unpublish
          </BaseButton>
          <BaseButton
            :loading="shareActionLoading || shareDialogLoading"
            @click="saveSharedTemplate"
          >
            {{ isTemplatePublished ? 'Update Template' : 'Publish Template' }}
          </BaseButton>
        </div>
      </template>
    </BaseModal>
  </div>
</template>

<script setup>
/**
 * Canvas view component | 画布视图组件
 * Main infinite canvas with Vue Flow integration
 */
import { ref, computed, onMounted, onUnmounted, watch, nextTick, markRaw, defineAsyncComponent } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { VueFlow, useVueFlow } from '@vue-flow/core'
import { MiniMap } from '@vue-flow/minimap'
import { NIcon } from 'naive-ui'
import { 
  AppsOutline,
  ChevronBackOutline,
  ChevronDownOutline,
  CloseOutline,
  CopyOutline,
  CreateOutline,
  SettingsOutline,
  AddOutline,
  ImageOutline,
  TextOutline,
  TrashOutline,
  VideocamOutline,
  ArrowUndoOutline,
  ArrowRedoOutline,
  LocateOutline,
  RemoveOutline,
  FolderOutline
} from '../icons/coolicons'
import {
  nodes,
  edges,
  groups,
  addEdge,
  addNode,
  createGroup,
  deleteGroupWithNodes,
  duplicateGroup,
  flushSave,
  resetCanvasSession,
  canvasViewport,
  updateViewport,
  undo,
  redo,
  canUndo,
  canRedo,
  loadProject,
  manualSaveHistory,
  removeNodesByIds,
  renameGroup,
  translateNodesByIds,
  ungroup
} from '../stores/canvas'
import { loadAllModels } from '../stores/models'
import { useNodesFactory } from '../hooks'
import { useAvatarUpload } from '@/hooks/useAvatarUpload'
import { useCanvasProjectActions } from '@/hooks/useCanvasProjectActions'
import { edgeStrategy, isConnectionValid } from '../services/edgeStrategy'
import { notifier } from '../utils/notifier'
import { getWorkflowById } from '@/config/workflows'
import { getProjectCanvas, initProjectsStore, projects, refreshProjectById } from '../stores/projects'
import { useAuthStore } from '@/stores/auth'
import { useWorkspaceStore } from '@/stores/workspace'
import { BaseButton, BaseDropdown, BaseInput, BaseModal } from '@/components/ui'

// API Settings component | API 设置组件
import ApiSettings from '../components/ApiSettings.vue'
import WorkflowPanel from '../components/WorkflowPanel.vue'

// Initialize models on page load | 页面加载时初始化模型
onMounted(() => {
  loadAllModels()
})

// Vue Flow instance | Vue Flow 实例
const { viewport, zoomIn, zoomOut, fitView, updateNodeInternals } = useVueFlow()
const canvasShellRef = ref(null)
const localInjectInputRef = ref(null)

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
const {
  currentWorkspace,
  getProjectTemplateStatus,
  publishProjectTemplate,
  unpublishProjectTemplate
} = useWorkspaceStore()
const { avatarInputRef, avatarInitial, triggerAvatarUpload, handleAvatarChange } = useAvatarUpload({
  user,
  updateProfile,
  notify: notifier
})

// Register custom node types | 注册自定义节点类型
const nodeTypes = {
  text: markRaw(TextNode),
  imageConfig: markRaw(ImageConfigNode),
  model3dConfig: markRaw(defineAsyncComponent(() => import('../components/nodes/Model3DConfigNode.vue'))),
  model3d: markRaw(defineAsyncComponent(() => import('../components/nodes/Model3DNode.vue'))),
  video: markRaw(VideoNode),
  image: markRaw(ImageNode),
  videoConfig: markRaw(VideoConfigNode),
  llmConfig: markRaw(LLMConfigNode)
}

// Register custom edge types | 注册自定义边类型
const edgeTypes = {
  default: markRaw(DefaultEdge),
  imageRole: markRaw(ImageRoleEdge),
  model3dView: markRaw(defineAsyncComponent(() => import('../components/edges/Model3DViewEdge.vue'))),
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
const showLocalInjectButton = computed(() => {
  if (typeof window === 'undefined') return false
  const host = String(window.location.hostname || '').trim().toLowerCase()
  return host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0'
})
const selectedGroupId = ref(null)
const groupRects = ref({})
const multiSelectRect = ref(null)
const showGroupRenameModal = ref(false)
const groupRenameTargetId = ref('')
const groupRenameValue = ref('')

let groupDragState = null
let overlayRafId = null
const {
  confirmDelete,
  confirmRename,
  handleProjectAction,
  isTemplatePublished,
  lastPublishedAt,
  openShareDialog,
  projectName,
  projectOptions,
  renameValue,
  removeSharedTemplate,
  saveSharedTemplate,
  shareActionLoading,
  shareDialogLoading,
  shareTemplateDescription,
  shareTemplateName,
  showDeleteModal,
  showRenameModal,
  showShareModal,
  workspaceName
} = useCanvasProjectActions({
  route,
  router,
  notifier,
  getProjectTemplateStatus,
  publishProjectTemplate,
  unpublishProjectTemplate,
  currentWorkspace
})

// Node type options for menu | 节点类型菜单选项
const nodeTypeOptions = [
  { type: 'text', name: 'Text', icon: TextOutline, description: 'Write prompts, scripts, and supporting copy.' },
  { type: 'image', name: 'Image', icon: ImageOutline, description: 'Generate, preview, and upload still images.' },
  { type: 'video', name: 'Video', icon: VideocamOutline, description: 'Generate videos with connected visual inputs.' },
  { type: 'model3dConfig', name: '3D Model', icon: AppsOutline, description: 'Generate an interactive 3D model from prompt and view-tagged images.' }
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

const canvasFlowStyle = computed(() => {
  const zoom = Math.max(Number(viewport.value?.zoom) || 1, 0.01)
  const baseGap = 20
  const minGap = 12
  const scaledGap = Math.max(baseGap * zoom, minGap)
  const gridOpacity = Math.max(0.02, Math.min(0.05, 0.05 * Math.pow(zoom, 0.85)))
  const rawX = Number(viewport.value?.x) || 0
  const rawY = Number(viewport.value?.y) || 0
  const offsetX = ((rawX % scaledGap) + scaledGap) % scaledGap
  const offsetY = ((rawY % scaledGap) + scaledGap) % scaledGap

  return {
    '--canvas-grid-image': showGrid.value
      ? `radial-gradient(rgba(255,255,255,${gridOpacity}) 1px, transparent 1px)`
      : 'none',
    '--canvas-grid-size': `${scaledGap}px ${scaledGap}px`,
    '--canvas-grid-position': `${offsetX}px ${offsetY}px`
  }
})

const selectedNodeIds = computed(() =>
  nodes.value.filter((node) => node.selected || node.data?.selected).map((node) => node.id)
)

const renderedGroups = computed(() =>
  groups.value
    .map((group) => ({
      ...group,
      rect: groupRects.value[group.id]
    }))
    .filter((group) => group.rect)
)

const selectedGroup = computed(() => groups.value.find((group) => group.id === selectedGroupId.value) || null)
const selectedGroupMenuRect = computed(() => (selectedGroupId.value ? groupRects.value[selectedGroupId.value] || null : null))
const multiSelectMenuRect = computed(() => {
  if (selectedGroupId.value) return null
  if (selectedNodeIds.value.length < 2) return null
  return multiSelectRect.value
})

const clearNodeSelection = () => {
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

const clearGroupSelection = () => {
  selectedGroupId.value = null
}

const selectGroup = (groupIdToSelect) => {
  clearNodeSelection()
  selectedGroupId.value = groupIdToSelect
  showNodeMenu.value = false
  clearNodeMenuContext()
}

const getNodeElement = (nodeId) => {
  const root = canvasShellRef.value
  if (!root) return null
  return root.querySelector(`.vue-flow__node[data-id="${nodeId}"]`)
}

const mergeRects = (rects, shellRect) => {
  if (!rects.length) return null
  const paddingX = 24
  const paddingTop = 22
  const paddingBottom = 22
  const left = Math.min(...rects.map((rect) => rect.left - shellRect.left)) - paddingX
  const top = Math.min(...rects.map((rect) => rect.top - shellRect.top)) - paddingTop
  const right = Math.max(...rects.map((rect) => rect.right - shellRect.left)) + paddingX
  const bottom = Math.max(...rects.map((rect) => rect.bottom - shellRect.top)) + paddingBottom
  return {
    left,
    top,
    width: right - left,
    height: bottom - top
  }
}

const updateOverlayRects = () => {
  overlayRafId = null
  const shell = canvasShellRef.value
  if (!shell) return

  const shellRect = shell.getBoundingClientRect()
  const nextGroupRects = {}

  groups.value.forEach((group) => {
    const memberRects = (group.nodeIds || [])
      .map((nodeId) => getNodeElement(nodeId)?.getBoundingClientRect() || null)
      .filter(Boolean)
    const merged = mergeRects(memberRects, shellRect)
    if (merged) nextGroupRects[group.id] = merged
  })

  const selectedRects = selectedNodeIds.value
    .map((nodeId) => getNodeElement(nodeId)?.getBoundingClientRect() || null)
    .filter(Boolean)

  groupRects.value = nextGroupRects
  multiSelectRect.value = selectedNodeIds.value.length >= 2 ? mergeRects(selectedRects, shellRect) : null
}

const scheduleOverlayRectUpdate = () => {
  if (overlayRafId) cancelAnimationFrame(overlayRafId)
  nextTick(() => {
    overlayRafId = requestAnimationFrame(updateOverlayRects)
  })
}

const handleCreateGroup = () => {
  if (selectedNodeIds.value.length < 2) return
  const groupId = createGroup(selectedNodeIds.value)
  if (!groupId) return
  clearNodeSelection()
  selectedGroupId.value = groupId
  notifier.success('Group created')
  scheduleOverlayRectUpdate()
}

const openRenameGroupModal = () => {
  if (!selectedGroup.value) return
  groupRenameTargetId.value = selectedGroup.value.id
  groupRenameValue.value = selectedGroup.value.name || ''
  showGroupRenameModal.value = true
}

const confirmRenameGroup = () => {
  if (!groupRenameTargetId.value) return
  const ok = renameGroup(groupRenameTargetId.value, groupRenameValue.value)
  if (!ok) return
  showGroupRenameModal.value = false
  notifier.success('Group renamed')
  scheduleOverlayRectUpdate()
}

const handleDuplicateSelectedGroup = () => {
  if (!selectedGroupId.value) return
  const newGroupId = duplicateGroup(selectedGroupId.value, { x: 60, y: 60 })
  if (!newGroupId) return
  selectedGroupId.value = newGroupId
  notifier.success('Group duplicated')
  scheduleOverlayRectUpdate()
}

const handleUngroupSelectedGroup = () => {
  if (!selectedGroupId.value) return
  const ok = ungroup(selectedGroupId.value)
  if (!ok) return
  selectedGroupId.value = null
  notifier.success('Group removed')
  scheduleOverlayRectUpdate()
}

const handleDeleteSelectedGroup = () => {
  if (!selectedGroupId.value) return
  const ok = deleteGroupWithNodes(selectedGroupId.value)
  if (!ok) return
  selectedGroupId.value = null
  notifier.success('Group deleted')
  scheduleOverlayRectUpdate()
}

const startGroupDrag = (group, event) => {
  if (event.button !== 0) return
  event.preventDefault()
  event.stopPropagation()
  selectGroup(group.id)
  groupDragState = {
    groupId: group.id,
    nodeIds: [...group.nodeIds],
    startClientX: event.clientX,
    startClientY: event.clientY,
    lastDeltaX: 0,
    lastDeltaY: 0,
    didMove: false
  }
  window.addEventListener('mousemove', handleGroupDragMove)
  window.addEventListener('mouseup', stopGroupDrag)
}

const handleGroupDragMove = (event) => {
  if (!groupDragState) return
  const zoom = viewport.value?.zoom || 1
  const nextDeltaX = (event.clientX - groupDragState.startClientX) / zoom
  const nextDeltaY = (event.clientY - groupDragState.startClientY) / zoom
  const moveX = nextDeltaX - groupDragState.lastDeltaX
  const moveY = nextDeltaY - groupDragState.lastDeltaY
  if (!moveX && !moveY) return

  groupDragState.didMove = true
  groupDragState.lastDeltaX = nextDeltaX
  groupDragState.lastDeltaY = nextDeltaY
  translateNodesByIds(groupDragState.nodeIds, { x: moveX, y: moveY }, false)
  scheduleOverlayRectUpdate()
}

const stopGroupDrag = () => {
  window.removeEventListener('mousemove', handleGroupDragMove)
  window.removeEventListener('mouseup', stopGroupDrag)
  if (groupDragState?.didMove) {
    manualSaveHistory()
  }
  groupDragState = null
}

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

const readImageFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

const readImageDimensions = (file) =>
  new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      resolve({ width: img.naturalWidth || img.width || 0, height: img.naturalHeight || img.height || 0 })
      URL.revokeObjectURL(objectUrl)
    }
    img.onerror = () => {
      resolve({ width: 0, height: 0 })
      URL.revokeObjectURL(objectUrl)
    }
    img.src = objectUrl
  })

const ratioFromDimensions = (width, height) => {
  if (!width || !height) return '1:1'
  const ratio = width / height
  if (Math.abs(ratio - 1) < 0.05) return '1:1'
  if (Math.abs(ratio - 16 / 9) < 0.05) return '16:9'
  if (Math.abs(ratio - 9 / 16) < 0.05) return '9:16'
  if (Math.abs(ratio - 3 / 2) < 0.05) return '3:2'
  if (Math.abs(ratio - 2 / 3) < 0.05) return '2:3'
  if (Math.abs(ratio - 4 / 3) < 0.05) return '4:3'
  if (Math.abs(ratio - 3 / 4) < 0.05) return '3:4'
  if (Math.abs(ratio - 4 / 5) < 0.05) return '4:5'
  if (Math.abs(ratio - 5 / 4) < 0.05) return '5:4'
  if (Math.abs(ratio - 21 / 9) < 0.05) return '21:9'
  return `${width}:${height}`
}

const triggerLocalImageInject = () => {
  if (!localInjectInputRef.value) return
  localInjectInputRef.value.value = ''
  localInjectInputRef.value.click()
}

const handleLocalImageInject = async (event) => {
  const file = event.target?.files?.[0]
  if (!file) return

  try {
    const [dataUrl, dimensions] = await Promise.all([
      readImageFileAsDataUrl(file),
      readImageDimensions(file)
    ])

    const width = Number(dimensions?.width || 0)
    const height = Number(dimensions?.height || 0)
    const ratio = ratioFromDimensions(width, height)
    const nodeId = addNode('image', {
      x: 220 + (nodes.value.length % 3) * 120,
      y: 180 + Math.floor(nodes.value.length / 3) * 60
    }, {
      url: dataUrl,
      base64: dataUrl,
      fileName: file.name,
      fileType: file.type || 'image/png',
      label: 'Image',
      ratio,
      size: width && height ? `${width}x${height}` : '',
      loading: false,
      error: ''
    })

    await nextTick()
    updateNodeInternals(nodeId)
    await flushSave()
    notifier.success('Image node injected')
  } catch (error) {
    notifier.error(error?.message || 'Image inject failed')
  } finally {
    if (event?.target) event.target.value = ''
  }
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
  const multiSelected = nodes.value.filter((node) => !!node.selected).map((node) => node.id)
  const multiSelectedSet = new Set(multiSelected)
  const selectedGroupNodeIds = new Set(
    selectedGroup.value?.nodeIds?.filter((nodeId) => !multiSelectedSet.has(nodeId)) || []
  )

  const nextNodes = nodes.value.map((node) => {
    const selected = !!node.selected
    const current = !!node.data?.selected
    const suppressCapsule = multiSelected.length >= 2
      ? multiSelectedSet.has(node.id)
      : selectedGroupNodeIds.has(node.id)
    const currentSuppressCapsule = !!node.data?.suppressCapsule
    if (selected === current && suppressCapsule === currentSuppressCapsule) return node
    return {
      ...node,
      data: {
        ...(node.data || {}),
        selected,
        suppressCapsule
      }
    }
  })
  if (nextNodes.some((node, index) => node !== nodes.value[index])) {
    nodes.value = nextNodes
  }
}

// Handle node click | 处理节点点击
const onNodeClick = () => {
  clearGroupSelection()
  showNodeMenu.value = false
  clearNodeMenuContext()
}

// Handle node changes | 处理节点变化（包含多选/框选）
const onNodesChange = () => {
  nextTick(() => {
    syncNodeSelectedState()
    if (selectedNodeIds.value.length > 0) {
      clearGroupSelection()
    }
    scheduleOverlayRectUpdate()
  })
}

// Handle viewport change | 处理视口变化
const handleViewportChange = (newViewport) => {
  updateViewport(newViewport)
  scheduleOverlayRectUpdate()
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
  clearGroupSelection()
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

  removeNodesByIds(Array.from(selectedNodeIds), false)
  edges.value = edges.value.filter((edge) => !selectedEdgeIds.has(edge.id))
  manualSaveHistory()
}

const handleGlobalKeydown = (event) => {
  if (isTypingElement(event.target)) return
  if (event.key !== 'Delete' && event.key !== 'Backspace') return
  if (selectedGroupId.value) {
    event.preventDefault()
    handleDeleteSelectedGroup()
    return
  }
  removeSelectedElements()
}

const goWorkspace = () => {
  flushSave()
  router.push('/workspace')
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
    // New project - detach from the previous project before clearing canvas.
    // 新建/空白画布先解绑旧项目，避免后续 flushSave 把空画布写回旧项目。
    resetCanvasSession()
  }
}

const ensureProjectSnapshot = async (projectId) => {
  const id = String(projectId || '')
  if (!id || id === 'new') {
    loadProjectById(id)
    return
  }

  if (!getProjectCanvas(id)) {
    try {
      await refreshProjectById(id)
    } catch {
      // Fall back to any locally cached draft when detail refresh is unavailable.
    }
  }

  loadProjectById(id)
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
  async (newId, oldId) => {
    if (newId && newId !== oldId) {
      // Save current project before switching | 切换前保存当前项目
      if (oldId) {
        await flushSave()
      }
      // Load new project | 加载新项目
      await ensureProjectSnapshot(newId)
    }
  }
)

watch([nodes, groups, viewport], () => {
  scheduleOverlayRectUpdate()
}, { deep: true })

watch(selectedGroupId, (groupId) => {
  if (groupId && !groups.value.some((group) => group.id === groupId)) {
    selectedGroupId.value = null
  }
  scheduleOverlayRectUpdate()
})

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
  window.addEventListener('resize', scheduleOverlayRectUpdate)
  window.addEventListener('pagehide', handlePageHide)
  window.addEventListener('keydown', handleGlobalKeydown)
  document.addEventListener('visibilitychange', handleVisibilityChange)

  const routeProjectId = String(route.params.id || '')
  const hasWarmProject = !!(
    routeProjectId &&
    routeProjectId !== 'new' &&
    getProjectCanvas(routeProjectId)
  )

  // Render immediately when we already have a warm project snapshot in memory.
  if (routeProjectId === 'new' || hasWarmProject) {
    loadProjectById(route.params.id)
  }

  // Initialize supporting data in parallel.
  await Promise.all([
    initProjectsStore()
  ])

  // Load project data after bootstrap when no warm snapshot was available.
  if (!hasWarmProject) {
    await ensureProjectSnapshot(route.params.id)
  } else if (routeProjectId && routeProjectId !== 'new') {
    refreshProjectById(routeProjectId).then((project) => {
      if (String(route.params.id || '') !== routeProjectId) return
      if (!project?.canvasData) return
      loadProjectById(routeProjectId)
    }).catch(() => {
      // Fall back to local cache when remote detail refresh is unavailable.
    })
  }

  await nextTick()
  await applyPendingWorkflowTemplate()
  scheduleOverlayRectUpdate()
})

// Cleanup on unmount | 卸载时清理
onUnmounted(() => {
  window.removeEventListener('resize', checkMobile)
  window.removeEventListener('resize', scheduleOverlayRectUpdate)
  window.removeEventListener('pagehide', handlePageHide)
  window.removeEventListener('keydown', handleGlobalKeydown)
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  stopGroupDrag()
  if (overlayRafId) cancelAnimationFrame(overlayRafId)
  // Save project before leaving | 离开前保存项目
  flushSave()
})
</script>

<style>
/* Import Vue Flow styles | 引入 Vue Flow 样式 */
@import '@vue-flow/core/dist/style.css';
@import '@vue-flow/core/dist/theme-default.css';
@import '@vue-flow/minimap/dist/style.css';

.canvas-flow {
  position: relative;
  z-index: 1;
}

.share-panel {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.share-section {
  padding: 20px 0;
}

.share-section + .share-section {
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.share-form-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.share-heading {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 5px;
}

.share-section h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.share-heading p {
  margin: 0;
  color: var(--text-muted);
  font-size: 13px;
  line-height: 1.45;
}

.share-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
}

.toggle-btn {
  width: 42px;
  height: 24px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: #1c1c1c;
  padding: 2px;
  position: relative;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.18s ease, border-color 0.18s ease;
}

.toggle-btn span {
  display: block;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.18s;
}

.toggle-btn.on {
  background: #f3f4f6;
  border-color: #f3f4f6;
}

.toggle-btn.on span {
  transform: translateX(18px);
  background: #111111;
}

.share-link-box {
  margin-top: 12px;
  border: 1px solid rgba(143, 143, 143, 0.24);
  border-radius: 18px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 8px 8px 14px;
  background: #0e0e0e;
}

.share-link-text {
  flex: 1;
  font-size: 13px;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.share-copy-btn {
  min-width: 108px;
}

.share-textarea {
  min-height: 96px;
  width: 100%;
  resize: none;
  border-radius: 18px;
  border: 1px solid var(--border);
  background: var(--surface);
  padding: 14px 16px;
  color: var(--text);
  outline: none;
  transition: all 0.2s ease;
}

.share-textarea::placeholder {
  color: var(--text-soft);
}

.share-textarea:focus {
  border-color: var(--border-strong);
  background: var(--surface-2);
}

.node-menu-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 18px;
}

.node-menu-eyebrow {
  font-size: 11px;
  line-height: 1;
  letter-spacing: 0.14em;
  color: #6b7280;
  margin-bottom: 12px;
}

.node-menu-title {
  margin: 0;
  font-size: 17px;
  line-height: 1.25;
  font-weight: 600;
  color: #f3f4f6;
}

.node-menu-copy {
  margin: 12px 0 0;
  font-size: 13px;
  line-height: 1.65;
  color: #9ca3af;
}

.node-menu-list {
  display: flex;
  flex-direction: column;
  margin-top: 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  padding-top: 10px;
}

.node-menu-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 14px;
  position: relative;
  border-radius: 18px;
  padding: 14px 10px;
  background: transparent;
  border: 0;
  transition: background 0.18s ease, transform 0.18s ease;
}

.node-menu-item + .node-menu-item {
  margin-top: 10px;
  padding-top: 24px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.node-menu-item:hover {
  background: rgba(255, 255, 255, 0.045);
}

.node-menu-item-icon {
  width: 36px;
  height: 36px;
  border-radius: 12px;
  background: #202020;
  border: 1px solid rgba(255, 255, 255, 0.06);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.node-menu-item-copy {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  min-width: 0;
  padding-right: 12px;
}

.node-menu-item-title {
  font-size: 14px;
  line-height: 1.2;
  color: #f3f4f6;
  font-weight: 600;
}

.node-menu-item-description {
  font-size: 12px;
  line-height: 1.5;
  color: #9ca3af;
  text-align: left;
}

.node-menu-quantity {
  margin-top: 18px;
  padding-top: 18px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
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
  background: #161616;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.node-menu-stepper-btn {
  width: 32px;
  height: 32px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #202020;
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: #f3f4f6;
  font-size: 16px;
  transition: background 0.18s ease, border-color 0.18s ease, opacity 0.18s ease;
}

.node-menu-stepper-btn:hover:not(:disabled) {
  background: #2a2a2a;
  border-color: rgba(255, 255, 255, 0.14);
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
  background: #080808;
}

.canvas-primary-tool {
  background: #ededed;
  color: #111111;
  border: 1px solid rgba(255, 255, 255, 0.22);
}

.canvas-primary-tool:hover:not(:disabled) {
  background: #d9d9d9;
}

.group-overlay-layer {
  position: absolute;
  inset: 0;
  z-index: 18;
  pointer-events: none;
}

.group-capsule-menu {
  position: absolute;
  transform: translateX(-50%);
  display: inline-flex;
  align-items: center;
  gap: 8px;
  pointer-events: auto;
}

.group-capsule-menu .capsule-inner {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  padding: 7px 12px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(15, 15, 15, 0.96);
  backdrop-filter: blur(12px);
  box-shadow: 0 18px 32px rgba(0, 0, 0, 0.34);
  white-space: nowrap;
}

.group-capsule-menu .capsule-group {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.group-capsule-menu .capsule-divider {
  width: 1px;
  height: 18px;
  background: rgba(255, 255, 255, 0.12);
}

.group-capsule-menu .capsule-icon,
.group-capsule-menu .capsule-select {
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.02);
  color: #e7e8eb;
  transition: all 0.2s ease;
}

.group-capsule-menu .capsule-icon {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
}

.group-capsule-menu .capsule-icon:hover:not(:disabled),
.group-capsule-menu .capsule-select:hover:not(:disabled) {
  border-color: rgba(255, 255, 255, 0.25);
  background: rgba(255, 255, 255, 0.08);
  color: #f3f4f6;
}

.group-capsule-menu .capsule-icon-solid {
  background: #0f0f0f;
  color: #f6f8fc;
  border-color: rgba(143, 143, 143, 0.65);
}

.group-capsule-menu .capsule-create {
  min-width: 86px;
  height: 28px;
  padding: 0 14px;
  gap: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
}

.group-capsule-menu .capsule-create-label {
  font-size: 12px;
  line-height: 1;
  font-weight: 500;
  white-space: nowrap;
}

.group-primary-btn {
  min-width: 88px;
}

.group-danger-icon {
  color: #d89b90;
  border-color: rgba(196, 106, 92, 0.24);
}

.group-danger-icon:hover:not(:disabled) {
  color: #e5b0a8;
  border-color: rgba(196, 106, 92, 0.48);
  background: rgba(196, 106, 92, 0.1);
}

.canvas-group-box {
  position: absolute;
  border-radius: 24px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(255, 255, 255, 0.045);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.02);
  pointer-events: none;
}

.canvas-group-box.is-selected {
  border-color: rgba(235, 226, 216, 0.82);
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.03),
    0 0 0 1px rgba(165, 129, 99, 0.18);
}

.canvas-group-title {
  position: absolute;
  left: 0;
  top: -44px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  padding: 0 14px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(41, 41, 43, 0.96);
  color: #f3f4f6;
  font-size: 13px;
  font-weight: 600;
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.2);
  pointer-events: auto;
  cursor: grab;
  user-select: none;
}

.canvas-group-title.is-selected {
  border-color: rgba(255, 255, 255, 0.38);
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.12);
}

.canvas-group-edge {
  position: absolute;
  border: none;
  background: transparent;
  pointer-events: auto;
  cursor: grab;
}

.canvas-group-edge::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
}

.canvas-group-edge.top,
.canvas-group-edge.bottom {
  left: 0;
  width: 100%;
  height: 14px;
}

.canvas-group-edge.left,
.canvas-group-edge.right {
  top: 0;
  width: 14px;
  height: 100%;
}

.canvas-group-edge.top {
  top: 0;
}

.canvas-group-edge.top::before,
.canvas-group-edge.bottom::before {
  border-left: none;
  border-right: none;
}

.canvas-group-edge.bottom {
  bottom: 0;
}

.canvas-group-edge.left {
  left: 0;
}

.canvas-group-edge.left::before,
.canvas-group-edge.right::before {
  border-top: none;
  border-bottom: none;
}

.canvas-group-edge.right {
  right: 0;
}

</style>

<style>
.canvas-flow .vue-flow__pane {
  background-color: #080808;
  background-image: var(--canvas-grid-image, none);
  background-size: var(--canvas-grid-size, 20px 20px);
  background-position: var(--canvas-grid-position, 0 0);
}

.canvas-flow .vue-flow__node-text,
.canvas-flow .vue-flow__node-image,
.canvas-flow .vue-flow__node-video {
  box-shadow: none !important;
  border-radius: 24px !important;
}

.canvas-flow .vue-flow__edge-path {
  stroke: #ffffff;
  stroke-width: 1;
  stroke-dasharray: 0;
}

.canvas-flow .vue-flow__edge.selected .vue-flow__edge-path {
  stroke: #ffffff;
  stroke-width: 2;
  stroke-dasharray: 0;
}
</style>
