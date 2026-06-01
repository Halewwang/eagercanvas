<template>
  <!-- Canvas page | 画布页面 -->
  <div ref="canvasShellRef" class="h-screen w-screen bg-[#080808]">
    <!-- Main canvas area | 主画布区域 -->
    <div
      class="h-full relative overflow-hidden"
      @pointerdown.capture="handleCanvasPointerDownCapture"
      @mousedown.capture="handleCanvasPointerDownCapture"
      @contextmenu.capture="handleCanvasContextMenu"
    >
      <CanvasTopControls
        :project-options="projectOptions"
        :project-name="projectName"
        :sync-indicator="syncIndicator"
        :show-remote-refresh-control="showRemoteRefreshControl"
        :remote-refresh-action="remoteRefreshAction"
        @workspace="goWorkspace"
        @project-action="handleProjectAction"
        @remote-refresh="openRemoteRefreshModal"
        @share="openShareDialog"
      />

      <CanvasFlowStage
        :key="flowKey"
        v-model:nodes="nodes"
        v-model:edges="edges"
        v-model:viewport="viewport"
        :node-types="nodeTypes"
        :edge-types="edgeTypes"
        :default-viewport="canvasViewport"
        :canvas-flow-style="canvasFlowStyle"
        @connect="onConnect"
        @connect-start="onConnectStart"
        @connect-end="onConnectEnd"
        @node-click="onNodeClick"
        @node-drag-start="onNodeDragStart"
        @node-drag-stop="onNodeDragStop"
        @nodes-change="onNodesChange"
        @pane-click="onPaneClick"
        @pane-context-menu="onPaneContextMenu"
        @viewport-change="handleViewportChange"
        @edges-change="onEdgesChange"
      />

      <CanvasGroupOverlay
        :multi-select-menu-rect="multiSelectMenuRect"
        :rendered-groups="renderedGroups"
        :selected-group-id="selectedGroupId"
        :selected-group-menu-rect="selectedGroupMenuRect"
        :group-body-hit-rects-by-id="groupBodyHitRectsById"
        :group-box-pointer-events="getGroupBoxPointerEvents()"
        @create-group="handleCreateGroup"
        @group-grip-pointer-down="handleGroupGripPointerDown"
        @select-group="selectGroup"
        @rename-group="openRenameGroupModal"
        @duplicate-selected-group="handleDuplicateSelectedGroup"
        @ungroup-selected-group="handleUngroupSelectedGroup"
        @delete-selected-group="handleDeleteSelectedGroup"
      />

      <CanvasToolbar
        :can-undo="canUndo()"
        :can-redo="canRedo()"
        :show-local-inject-button="showLocalInjectButton"
        :user="user"
        :avatar-initial="avatarInitial"
        @add-node="toggleToolbarNodeMenu"
        @open-library="showMediaLibraryPanel = true"
        @undo="undo"
        @redo="redo"
        @open-api-settings="showApiSettings = true"
        @inject-image="triggerLocalImageInject"
        @upload-avatar="triggerAvatarUpload"
      />
      <input ref="localInjectInputRef" type="file" accept="image/*" class="hidden" @change="handleLocalImageInject" />
      <input ref="avatarInputRef" type="file" accept="image/*" class="hidden" @change="handleAvatarChange" />

      <CanvasNodeMenu
        :show="showNodeMenu"
        :mode="nodeMenuMode"
        :menu-style="nodeMenuStyle"
        :title="nodeMenuTitle"
        :copy="nodeMenuCopy"
        :node-types="nodeTypeOptions"
        :count="nodeCreateCount"
        @select-node-type="addNewNode"
        @decrease-count="decreaseNodeCount"
        @increase-count="increaseNodeCount"
      />

      <CanvasZoomControls
        :zoom-percent="Math.round(viewport.zoom * 100)"
        @fit-view="fitView({ padding: 0.2 })"
        @zoom-out="zoomOut"
        @zoom-in="zoomIn"
      />

    </div>

    <CanvasAuxiliaryPanels
      v-model:show-api-settings="showApiSettings"
      v-model:show-media-library="showMediaLibraryPanel"
      :project-id="currentCanvasProjectId"
      @insert-asset="handleInsertLibraryAsset"
    />

    <CanvasProjectModals
      v-model:show-rename="showRenameModal"
      v-model:show-delete="showDeleteModal"
      v-model:show-group-rename="showGroupRenameModal"
      v-model:rename-value="renameValue"
      v-model:group-rename-value="groupRenameValue"
      :project-name="projectName"
      @confirm-rename="confirmRename"
      @confirm-delete="confirmDelete"
      @confirm-rename-group="confirmRenameGroup"
    />

    <CanvasSyncModals
      v-model:show-conflict="showConflictModal"
      v-model:show-remote-refresh="showRemoteRefreshModal"
      :conflict-action="conflictAction"
      :remote-refresh-action="remoteRefreshAction"
      @cancel-conflict="cancelConflictResolution"
      @save-conflict-copy="saveConflictAsCopy"
      @refresh-conflict="refreshRemoteConflict"
      @overwrite-conflict="overwriteRemoteConflict"
      @confirm-remote-refresh="confirmRemoteRefresh"
    />

    <CanvasShareModal
      v-model:show="showShareModal"
      v-model:template-name="shareTemplateName"
      v-model:template-description="shareTemplateDescription"
      :workspace-name="workspaceName"
      :status-loading="shareDialogLoading"
      :published="isTemplatePublished"
      :last-published-at="lastPublishedAt"
      :action-loading="shareActionLoading"
      @close="showShareModal = false"
      @unpublish="removeSharedTemplate"
      @save="saveSharedTemplate"
    />
  </div>
</template>

<script setup>
/**
 * Canvas view component | 画布视图组件
 * Main infinite canvas with Vue Flow integration
 */
import { ref, computed, onMounted, watch, nextTick, markRaw } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useVueFlow } from '@vue-flow/core'
import { storeToRefs } from 'pinia'
import { useCanvasStore } from '@/stores/canvas'
import { pinia } from '@/stores/pinia'
import { loadAllModels } from '@/stores/models'
import { useNodesFactory } from '@/hooks'
import { useAvatarUpload } from '@/hooks/useAvatarUpload'
import { useCanvasConnectionInteraction } from '@/hooks/useCanvasConnectionInteraction.js'
import { useCanvasGroupActions } from '@/hooks/useCanvasGroupActions.js'
import { useCanvasGroupDrag } from '@/hooks/useCanvasGroupDrag.js'
import { useCanvasNodeDragInteraction } from '@/hooks/useCanvasNodeDragInteraction.js'
import { useCanvasNodeMenuState } from '@/hooks/useCanvasNodeMenuState.js'
import { useCanvasOverlayRects } from '@/hooks/useCanvasOverlayRects.js'
import { useCanvasProjectActions } from '@/hooks/useCanvasProjectActions'
import { useCanvasRouteLifecycle } from '@/hooks/useCanvasRouteLifecycle.js'
import { useCanvasSelectionInteraction } from '@/hooks/useCanvasSelectionInteraction.js'
import { useCanvasSyncResolution } from '@/hooks/useCanvasSyncResolution.js'
import { useCanvasViewportInteraction } from '@/hooks/useCanvasViewportInteraction.js'
import { edgeStrategy, isConnectionValid } from '@/services/edgeStrategy'
import { notifier } from '@/utils/notifier'
import { duplicateProject, getProjectCanvas, initProjectsStore, loadCachedProjects, projects, refreshProjectById } from '@/stores/projects'
import { useAuthStore } from '@/stores/auth'
import { useWorkspaceStore } from '@/stores/workspace'
import {
  getCanvasLibraryInsertPosition,
  getCanvasNodeGridPosition,
  getConnectMenuEdgeParams,
  getFlowPointFromScreenPoint,
  getGroupBoxPointerEvents,
  getLocalImageInjectPosition,
  createLocalImageNodeData
} from '@/utils/canvasInteraction'
import { isExpiredRemoteUrl } from '@/utils/media'
import { isLocalPreviewEnabled } from '@/utils/localPreview'

// Canvas feature components | 画布功能组件
import CanvasAuxiliaryPanels from '@/components/canvas/CanvasAuxiliaryPanels.vue'
import CanvasFlowStage from '@/components/canvas/CanvasFlowStage.vue'
import CanvasGroupOverlay from '@/components/canvas/CanvasGroupOverlay.vue'
import CanvasNodeMenu from '@/components/canvas/CanvasNodeMenu.vue'
import CanvasProjectModals from '@/components/canvas/CanvasProjectModals.vue'
import CanvasShareModal from '@/components/canvas/CanvasShareModal.vue'
import CanvasSyncModals from '@/components/canvas/CanvasSyncModals.vue'
import CanvasToolbar from '@/components/canvas/CanvasToolbar.vue'
import CanvasTopControls from '@/components/canvas/CanvasTopControls.vue'
import CanvasZoomControls from '@/components/canvas/CanvasZoomControls.vue'

// Initialize models on page load | 页面加载时初始化模型
onMounted(() => {
  loadAllModels()
})

// Vue Flow instance | Vue Flow 实例
const { viewport, zoomIn, zoomOut, fitView, updateNodeInternals } = useVueFlow()
const canvasStore = useCanvasStore(pinia)
const {
  nodes,
  edges,
  groups,
  canvasViewport,
  isCanvasZooming,
  isNodeDragging,
  projectSaveState
} = storeToRefs(canvasStore)
const {
  addEdge,
  addNode,
  beginCanvasZoomInteraction,
  beginNodeDragInteraction,
  canRedo,
  canUndo,
  createGroup,
  deleteGroupWithNodes,
  duplicateGroup,
  endCanvasZoomInteraction,
  endNodeDragInteraction,
  flushSave,
  hasPendingCanvasChanges,
  loadProject,
  manualSaveHistory,
  redo,
  refreshCanvasCollectionRefs,
  removeNodesByIds,
  renameGroup,
  resetCanvasSession,
  translateNodesByIds,
  undo,
  ungroup,
  updateViewport
} = canvasStore
const canvasShellRef = ref(null)
const localInjectInputRef = ref(null)

// Nodes factory | 节点工厂
const nodesFactory = useNodesFactory({ updateNodeInternals, viewport })

// Custom node components | 自定义节点组件
import TextNode from '@/components/nodes/TextNode.vue'
import ImageConfigNode from '@/components/nodes/ImageConfigNode.vue'
import VideoNode from '@/components/nodes/VideoNode.vue'
import ImageNode from '@/components/nodes/ImageNode.vue'
import VideoConfigNode from '@/components/nodes/VideoConfigNode.vue'
import LLMConfigNode from '@/components/nodes/LLMConfigNode.vue'
import ImageRoleEdge from '@/components/edges/ImageRoleEdge.vue'
import PromptOrderEdge from '@/components/edges/PromptOrderEdge.vue'
import ImageOrderEdge from '@/components/edges/ImageOrderEdge.vue'
import DefaultEdge from '@/components/edges/DefaultEdge.vue'

const router = useRouter()
const route = useRoute()
const { user, updateProfile, bootstrapAuth } = useAuthStore()
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
const isMobile = ref(false)
const showGrid = ref(true)
const showApiSettings = ref(false)

// Flow key for forcing re-render on project switch | 项目切换时强制重新渲染的 key
const flowKey = ref(Date.now())
const showMediaLibraryPanel = ref(false)
const showLocalInjectButton = computed(() => isLocalPreviewEnabled())
const selectedGroupId = ref(null)

let isGroupDragging = () => false
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

const currentCanvasProjectId = computed(() => {
  const value = String(route.params.id || '').trim()
  return value && value !== 'new' ? value : ''
})

const screenPointToFlowPoint = (point) => {
  return getFlowPointFromScreenPoint(point, viewport.value)
}

let selectionInteraction = null
const clearNodeSelectionForNodeMenu = () => selectionInteraction?.clearNodeSelection()
const clearGroupSelectionForNodeMenu = () => selectionInteraction?.clearGroupSelection()

const {
  clearNodeMenuContext,
  decreaseNodeCount,
  increaseNodeCount,
  nodeCreateCount,
  nodeMenuCopy,
  nodeMenuMode,
  nodeMenuStyle,
  nodeMenuTitle,
  nodeTypeOptions,
  openConnectNodeMenu,
  openPaneNodeMenu,
  pendingConnectMenuContext,
  pendingPaneCreatePosition,
  showNodeMenu,
  suppressPaneClickUntil,
  toggleToolbarNodeMenu
} = useCanvasNodeMenuState({
  getFlowPointFromScreenPoint: screenPointToFlowPoint,
  clearGroupSelection: clearGroupSelectionForNodeMenu,
  clearNodeSelection: clearNodeSelectionForNodeMenu
})

selectionInteraction = useCanvasSelectionInteraction({
  nodes,
  edges,
  groups,
  selectedGroupId,
  showNodeMenu,
  suppressPaneClickUntil,
  clearNodeMenuContext,
  handleDeleteSelectedGroup: () => handleDeleteSelectedGroup(),
  manualSaveHistory,
  removeNodesByIds
})

const {
  selectedGroup,
  selectedNodeIds,
  clearGroupSelection,
  clearNodeSelection,
  handleGlobalKeydown,
  onNodeClick,
  onPaneClick,
  syncNodeSelectedState
} = selectionInteraction

const {
  groupBodyHitRectsById,
  groupRects,
  multiSelectMenuRect,
  renderedGroups,
  selectedGroupMenuRect,
  cleanupOverlayRectUpdates,
  scheduleOverlayRectUpdate
} = useCanvasOverlayRects({
  canvasShellRef,
  groups,
  isCanvasZooming,
  isGroupDragging: () => isGroupDragging(),
  isNodeDragging,
  nodes,
  selectedGroupId,
  selectedNodeIds,
  viewport
})
const isCanvasInteracting = computed(() => isNodeDragging.value || isCanvasZooming.value)

const {
  canvasFlowStyle,
  clearViewportSettleTimer,
  handleViewportChange
} = useCanvasViewportInteraction({
  viewport,
  isCanvasZooming,
  showGrid,
  beginCanvasZoomInteraction,
  endCanvasZoomInteraction,
  updateViewport,
  scheduleOverlayRectUpdate
})

const {
  confirmRenameGroup,
  groupRenameValue,
  handleCreateGroup,
  handleDeleteSelectedGroup,
  handleDuplicateSelectedGroup,
  handleUngroupSelectedGroup,
  openRenameGroupModal,
  selectGroup,
  showGroupRenameModal
} = useCanvasGroupActions({
  groups,
  selectedGroupId,
  selectedNodeIds,
  showNodeMenu,
  clearNodeMenuContext,
  clearNodeSelection,
  createGroup,
  renameGroup,
  duplicateGroup,
  ungroup,
  deleteGroupWithNodes,
  notify: notifier,
  scheduleOverlayRectUpdate
})

const groupDrag = useCanvasGroupDrag({
  groups,
  nodes,
  groupRects,
  selectedGroupId,
  viewport,
  selectGroup,
  beginNodeDragInteraction,
  endNodeDragInteraction,
  refreshCanvasCollectionRefs,
  translateNodesByIds,
  scheduleOverlayRectUpdate
})
isGroupDragging = groupDrag.isGroupDragging
const {
  handleCanvasPointerDownCapture,
  handleGroupGripPointerDown,
  stopGroupDrag
} = groupDrag

const {
  onNodeDragStart,
  onNodeDragStop,
  onNodesChange
} = useCanvasNodeDragInteraction({
  nodes,
  groups,
  selectedNodeIds,
  isNodeDragging,
  beginNodeDragInteraction,
  endNodeDragInteraction,
  translateNodesByIds,
  syncNodeSelectedState,
  clearGroupSelection,
  scheduleOverlayRectUpdate
})

const {
  handleCanvasContextMenu,
  onConnect,
  onConnectEnd,
  onConnectStart,
  onEdgesChange,
  onPaneContextMenu,
} = useCanvasConnectionInteraction({
  addEdge,
  edgeStrategy,
  isConnectionValid,
  manualSaveHistory,
  refreshCanvasCollectionRefs,
  notify: notifier,
  openConnectNodeMenu,
  openPaneNodeMenu
})

// Add new node | 添加新节点
const addNewNode = async (type) => {
  if (pendingConnectMenuContext.value) {
    const context = pendingConnectMenuContext.value
    const createdNodeIds = []

    for (let index = 0; index < nodeCreateCount.value; index += 1) {
      const newNodeId = addNode(type, getCanvasNodeGridPosition({
        origin: context.flowPosition,
        index
      }))
      createdNodeIds.push(newNodeId)

      const params = getConnectMenuEdgeParams(context, newNodeId)
      if (params) addEdge(edgeStrategy.resolve(params))
    }

    setTimeout(() => {
      createdNodeIds.forEach((nodeId) => updateNodeInternals(nodeId))
      updateNodeInternals(context.nodeId)
    }, 60)

    showNodeMenu.value = false
    clearNodeMenuContext()
    return
  }

  if (pendingPaneCreatePosition.value) {
    const createdNodeIds = []

    for (let index = 0; index < nodeCreateCount.value; index += 1) {
      const newNodeId = addNode(type, getCanvasNodeGridPosition({
        origin: pendingPaneCreatePosition.value,
        index
      }))
      createdNodeIds.push(newNodeId)
    }

    setTimeout(() => {
      createdNodeIds.forEach((nodeId) => updateNodeInternals(nodeId))
    }, 60)

    showNodeMenu.value = false
    clearNodeMenuContext()
    return
  }

  for (let index = 0; index < nodeCreateCount.value; index += 1) {
    await nodesFactory.addNewNode(type, getCanvasNodeGridPosition({
      index,
      gapX: 88,
      gapY: 118
    }))
  }
  showNodeMenu.value = false
  clearNodeMenuContext()
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

    const nodeId = addNode(
      'image',
      getLocalImageInjectPosition({ nodeCount: nodes.value.length }),
      createLocalImageNodeData({ dataUrl, file, dimensions })
    )

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

const getLibraryInsertPosition = () => {
  const shell = canvasShellRef.value
  const fallbackWidth = typeof window === 'undefined' ? 1440 : window.innerWidth
  const fallbackHeight = typeof window === 'undefined' ? 900 : window.innerHeight
  const width = Number(shell?.clientWidth || fallbackWidth)
  const height = Number(shell?.clientHeight || fallbackHeight)
  return getCanvasLibraryInsertPosition({
    viewport: viewport.value,
    shellSize: { width, height },
    nodeCount: nodes.value.length
  })
}

const handleInsertLibraryAsset = async (asset = {}) => {
  const safeUrl = String(asset?.url || '').trim()
  const kind = String(asset?.kind || '').trim().toLowerCase()
  if (!safeUrl) return

  const position = getLibraryInsertPosition()
  let nodeId = ''

  if (kind === 'video') {
    nodeId = addNode('video', position, {
      url: safeUrl,
      label: 'Video',
      fileName: asset.fileName || 'Video Asset',
      fileType: asset.fileType || 'video/mp4',
      error: ''
    })
  } else {
    nodeId = addNode('image', position, {
      url: safeUrl,
      previewUrl: '',
      fileName: asset.fileName || 'Image Asset',
      fileType: asset.fileType || 'image/png',
      label: 'Image',
      persistStatus: 'saved',
      persistError: '',
      error: ''
    })
  }

  await nextTick()
  if (nodeId) {
    updateNodeInternals(nodeId)
    notifier.success('素材已加入画布')
  }
}

const goWorkspace = () => {
  flushSave()
  router.push('/workspace')
}

watch([nodes, groups], () => {
  scheduleOverlayRectUpdate()
}, { deep: true })

watch(selectedGroupId, (groupId) => {
  if (groupId && !groups.value.some((group) => group.id === groupId)) {
    selectedGroupId.value = null
  }
  scheduleOverlayRectUpdate()
})

const { loadProjectById } = useCanvasRouteLifecycle({
  route,
  currentCanvasProjectId,
  edges,
  flowKey,
  groups,
  isMobile,
  nodes,
  nodesFactory,
  bootstrapAuth,
  cleanupOverlayRectUpdates,
  clearViewportSettleTimer,
  flushSave,
  getProjectCanvas,
  hasPendingCanvasChanges,
  initProjectsStore,
  loadCachedProjects,
  loadProject,
  refreshProjectById,
  resetCanvasSession,
  scheduleOverlayRectUpdate,
  stopGroupDrag,
  updateNodeInternals,
  handleGlobalKeydown
})

const {
  conflictAction,
  remoteRefreshAction,
  showConflictModal,
  showRemoteRefreshControl,
  showRemoteRefreshModal,
  syncIndicator,
  cancelConflictResolution,
  confirmRemoteRefresh,
  openRemoteRefreshModal,
  overwriteRemoteConflict,
  refreshRemoteConflict,
  saveConflictAsCopy
} = useCanvasSyncResolution({
  currentCanvasProjectId,
  projectSaveState,
  route,
  router,
  duplicateProject,
  flushSave,
  loadProjectById: (projectId) => loadProjectById(projectId),
  notify: notifier,
  refreshProjectById
})
</script>
