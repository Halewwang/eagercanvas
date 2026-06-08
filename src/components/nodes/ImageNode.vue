<template>
  <div class="image-node-wrapper node-shell-wrapper" @mouseenter="showCapsule = true" @mouseleave="showCapsule = false">
    <NodeMetaRow label="Image" :icon="ImageOutline" @mousedown="handleMetaMouseDown" />

    <ImageNodeCapsuleMenu
      v-show="showNodeCapsule"
      :capsule-style="capsuleStyle"
      :selected="isSelected"
      :image-model-options="imageModelDropdownOptions"
      :display-image-model="displayImageModel"
      :ratio-options="ratioDropdownOptions"
      :display-ratio="displayRatio"
      :resolution-options="resolutionDropdownOptions"
      :display-resolution="displayResolution"
      :quality-options="qualityDropdownOptions"
      :display-quality="displayQualityControl"
      :background-options="backgroundDropdownOptions"
      :display-background="displayBackgroundControl"
      :format-options="formatDropdownOptions"
      :display-format="displayFormatControl"
      :tool-options="toolDropdownOptions"
      :has-display-image="hasDisplayImage"
      :tool-busy="isToolBusy"
      :image-busy="isImageBusy"
      @select-model="setImageModel"
      @select-ratio="setImageRatio"
      @select-resolution="setResolution"
      @select-quality="setImageQuality"
      @select-background="setBackground"
      @select-format="setOutputFormat"
      @tool-action="handleToolAction"
      @preview="openPreviewModal"
      @duplicate="handleDuplicate"
      @delete="handleDelete"
      @create="handleGenerateImage"
      @regenerate="handleRegenerateImage"
      @stop="handleStopGeneration"
    />

    <div
      class="image-node rounded-2xl border relative transition-all duration-200 overflow-visible"
      :class="[
        isSelected ? 'node-selected' : 'node-default',
        { 'node-glow-active': isSelected }
      ]"
      :style="moduleStyle"
    >
      <div class="module-stage" :style="stageStyle">
        <ImageNodeGenerationProgress
          v-if="showProgress"
          :bar-style="progressBarStyle"
          :percent="progressPercent"
          :label="progressPhaseLabel"
          :elapsed-seconds="progressElapsedSeconds"
        />

        <ImageNodeDisplayFrame
          v-else-if="hasDisplayImage"
          :image-url="canvasDisplayImageUrl"
          :alt="data.label || 'Image'"
          :crop-active="activeTool === 'crop'"
          :crop-mask-styles="cropMaskStyles"
          :crop-box-style="cropBoxStyle"
          :crop-handles="cropHandles"
          @image-load="handlePreviewImageLoad"
          @crop-drag-start="startCropDrag"
          @crop-resize-start="startCropResize"
        />

        <ImageNodeLoadingState v-else-if="urlLoading" />

        <ImageNodeEmptyState v-else @upload="triggerUpload" />
        <input
          :id="uploadInputId"
          ref="uploadInputRef"
          type="file"
          accept="image/*"
          class="hidden"
          @change="handleFileUpload"
        />
      </div>

      <ImageNodeUploadProgress v-if="showUploadProgress" :progress-style="uploadProgressStyle" />

      <NodeFlowHandles :show-handles="showHandles" />

    </div>

    <ImageNodePreviewModal
      ref="previewModalRef"
      v-model:show="showPreviewModal"
      :image-url="displayImageUrl"
      :preview-zoom="previewZoom"
      :min-zoom="PREVIEW_MIN_ZOOM"
      :max-zoom="PREVIEW_MAX_ZOOM"
      :canvas-style="previewCanvasStyle"
      :image-style="previewImageStyle"
      @download="downloadPreviewImage"
      @zoom-out="zoomOutPreview"
      @reset-zoom="resetPreviewZoom"
      @zoom-in="zoomInPreview"
      @image-load="handlePreviewImageLoad"
    />
    <ImageNodeFeedbackModals
      v-model:show-error="showErrorModal"
      v-model:show-validation="showValidationModal"
      :error-message="data.error"
      :validation-message="validationMessage"
      @close-error="closeErrorModal"
      @close-validation="closeValidationModal"
    />

    <NodeBindingStatus :items="imageInputStatusList" :module-style="moduleStyle" />

    <ImageNodeToolDrawers
      v-model:show-multi-angle="showMultiAngleDrawer"
      v-model:show-wedding3x3="showWedding3x3Drawer"
      :image-url="displayImageUrl"
      :model="localImageModel"
      :ratio="localImageRatio"
      :size="localImageSize"
      :resolution="localResolution"
      :quality="localImageQuality"
      :ratio-options="ratioDropdownOptions"
      :size-options="imageSizeOptions"
      @multi-angle-pending="handleMultiAnglePending"
      @multi-angle-apply="handleMultiAngleApply"
      @multi-angle-error="handleMultiAngleError"
      @wedding3x3-pending="handleWedding3x3Pending"
      @wedding3x3-apply="handleWedding3x3Apply"
      @wedding3x3-error="handleWedding3x3Error"
    />
  </div>
</template>

<script setup>
import { computed, h, onUnmounted, ref, watch } from 'vue'
import { useVueFlow } from '@vue-flow/core'
import { storeToRefs } from 'pinia'
import NodeBindingStatus from './NodeBindingStatus.vue'
import NodeFlowHandles from './NodeFlowHandles.vue'
import NodeMetaRow from './NodeMetaRow.vue'
import ImageNodeCapsuleMenu from './image/ImageNodeCapsuleMenu.vue'
import ImageNodeDisplayFrame from './image/ImageNodeDisplayFrame.vue'
import ImageNodeEmptyState from './image/ImageNodeEmptyState.vue'
import ImageNodeFeedbackModals from './image/ImageNodeFeedbackModals.vue'
import ImageNodeGenerationProgress from './image/ImageNodeGenerationProgress.vue'
import ImageNodeLoadingState from './image/ImageNodeLoadingState.vue'
import ImageNodePreviewModal from './image/ImageNodePreviewModal.vue'
import ImageNodeToolDrawers from './image/ImageNodeToolDrawers.vue'
import ImageNodeUploadProgress from './image/ImageNodeUploadProgress.vue'
import { useImageNodeCanvasPreview } from './image/useImageNodeCanvasPreview.js'
import { useImageNodeCropInteraction } from './image/useImageNodeCropInteraction.js'
import { useImageNodeGeneration } from './image/useImageNodeGeneration.js'
import { useImageNodeLinkedNodes } from './image/useImageNodeLinkedNodes.js'
import { useImageNodeModelControls } from './image/useImageNodeModelControls.js'
import { useImageNodePersistence } from './image/useImageNodePersistence.js'
import { useImageNodeProgressState } from './image/useImageNodeProgressState.js'
import { useImageNodeReplacement } from './image/useImageNodeReplacement.js'
import { useImageNodeToolActions } from './image/useImageNodeToolActions.js'
import { useImageNodeToolDrawerResults } from './image/useImageNodeToolDrawerResults.js'
import { useImageNodePreviewDownload } from './image/useImageNodePreviewDownload.js'
import { useImageNodeUploadLifecycle } from './image/useImageNodeUploadLifecycle.js'
import { useImageNodeUploadPersistence } from './image/useImageNodeUploadPersistence.js'
import {
  PREVIEW_MAX_ZOOM,
  PREVIEW_MIN_ZOOM,
  useImageNodePreviewState
} from './image/useImageNodePreviewState.js'
import { ImageOutline } from '@/icons/coolicons'
import { useCanvasStore } from '@/stores/canvas'
import { pinia } from '@/stores/pinia'
import {
  DEFAULT_IMAGE_MODEL,
  DEFAULT_IMAGE_SIZE,
  getModelConfig,
  getModelSizeOptions,
  imageModelOptions
} from '@/stores/models'
import { resolveGptImage2Size } from '@/config/models'
import { useImageGeneration, useImageTools } from '@/hooks/api/useImageApi.js'
import { useApiConfig } from '@/hooks/useApiConfig'
import { getErrorMessage } from '@/utils'
import { createImageNodeCropPayload } from '@/utils/imageCropOutput'
import { getImageDimensionsFromFile } from '@/utils/imageDimensions'
import { isLocalPreviewEnabled } from '@/utils/localPreview'
import { dataUrlToFile, persistImageUrl, uploadImageFile } from '@/utils/media'
import {
  getImageNodeRatioFromSizeKey,
  getImageNodeToolOptions
} from '@/utils/imageNodeLayout'
import {
  getImageNodeActiveInputKeys,
  getImageNodeInputStatusList,
  getImageNodeSourceRefImages as buildSourceRefImages,
  getImageNodePersistencePatch as buildImagePersistencePatch,
  getImageNodeSaveFeedback,
  getImageNodeSaveFeedbackPatch,
  getImageNodeModelParamsPatch,
  getImageNodeSizeParamsPatch,
  getImageNodeLinkedCreateData,
  getImageNodeLinkedUpdatePatch,
  getImageNodeLinkedPosition,
  getImageNodeLinkedSelectionState,
  getNearestImageNodeSourceConfig,
  getImageNodeEnhancementRequest,
  getImageNodeToolSaveMessages,
  getImageNodeToolSaveMessage,
  getImageNodeToolPendingPatch,
  getImageNodeActionPendingPatch,
  getImageNodeActionErrorPatch,
  getImageNodeToolErrorPatch,
  getImageNodeToolReplacementPatch,
  getImageNodeToolLinkedResultPatch,
  getImageNodeToolLinkedCreatePatch,
  getImageNodeEnhancementResultPatch,
  getImageNodeEnhancementErrorPatch,
  getImageNodeRemoveBackgroundResultPatch,
  getImageNodeGenerationSaveMessage,
  getImageNodeReplacementSaveMessage,
  getImageNodeReplacementPreviewPatch,
  getImageNodeReplacementUploadedPatch,
  getImageNodeReplacementErrorPatch,
  getImageNodeUploadMetadata,
  getImageNodeUploadPreviewPatch,
  getImageNodeUploadedPatch,
  getImageNodeUploadFailureOutcome,
  getImageNodeUploadFailurePatch,
  getImageNodeUploadSaveOutcome
} from '@/utils/imageNodeData'
import { edgeStrategy, resolveNodeInputs } from '@/services/edgeStrategy'
import removeBgIcon from '@/assets/remove-bg-icon.svg'
import cropIcon from '@/assets/crop-icon.svg'
import cameraOrbitIcon from '@/assets/tools-icon.svg'

const props = defineProps({
  id: String,
  data: Object,
  selected: Boolean
})

const { updateNodeInternals } = useVueFlow()
const canvasStore = useCanvasStore(pinia)
const {
  currentProjectId,
  edges,
  isCanvasZooming,
  isNodeDragging,
  nodes,
  projectSaveState
} = storeToRefs(canvasStore)
const {
  addEdge,
  addNode,
  duplicateNode,
  flushSave,
  removeNode,
  saveProject,
  updateNode
} = canvasStore
const { isConfigured } = useApiConfig()
const imageGen = useImageGeneration()
const imageTools = useImageTools()

const showCapsule = ref(false)
const urlLoading = ref(false)
const isSelected = computed(() => !!props.selected || !!props.data?.selected)
const showNodeCapsule = computed(() => !props.data?.suppressCapsule && (showCapsule.value || isSelected.value))
const showHandles = computed(() => showCapsule.value || isSelected.value)

const uploadInputRef = ref(null)
const uploadInputId = `image-upload-${String(props.id || 'node')}`
const {
  backgroundDropdownOptions,
  displayBackgroundControl,
  displayFormatControl,
  displayImageModel,
  displayQualityControl,
  displayRatio,
  displayResolution,
  findNearestSizeKey,
  formatDropdownOptions,
  imageModelDropdownOptions,
  imageSizeOptions,
  localBackground,
  localImageModel,
  localImageQuality,
  localImageRatio,
  localImageSize,
  localOutputFormat,
  localResolution,
  moduleStyle,
  qualityDropdownOptions,
  ratioDropdownOptions,
  resolutionDropdownOptions,
  setBackground,
  setImageModel,
  setImageQuality,
  setImageRatio,
  setOutputFormat,
  setResolution,
  stageStyle
} = useImageNodeModelControls({
  buildModelParamsPatch: getImageNodeModelParamsPatch,
  buildSizeParamsPatch: getImageNodeSizeParamsPatch,
  data: () => props.data,
  defaultImageModel: DEFAULT_IMAGE_MODEL,
  defaultImageSize: DEFAULT_IMAGE_SIZE,
  getModelConfig,
  getModelSizeOptions,
  imageModelOptions,
  nodeId: () => props.id,
  resolveGptImage2Size,
  updateNode
})
const {
  openPreviewModal: showPreviewImageModal,
  previewCanvasStyle,
  previewImageStyle,
  previewModalRef,
  previewNaturalSize,
  previewZoom,
  resetPreviewZoom,
  setPreviewNaturalSizeFromEvent,
  showPreviewModal,
  zoomInPreview,
  zoomOutPreview
} = useImageNodePreviewState({
  onClose: () => {
    stopCropInteraction()
  }
})
const showErrorModal = ref(false)
const showValidationModal = ref(false)
const validationMessage = ref('')
const imageActionLoading = ref('')
const toolActionLoading = ref('')
const MAX_UPLOAD_SIZE_BYTES = 150 * 1024 * 1024
const DEFAULT_ENHANCE_PROMPT = 'Enhance this image to 4K while preserving composition, style, and details.'
const isLocalPreviewMode = computed(() => isLocalPreviewEnabled())
const {
  progressBarStyle,
  progressElapsedSeconds,
  progressPhaseLabel,
  progressPercent,
  resetProgress,
  showProgress,
  showUploadProgress,
  uploadProgress,
  uploadProgressStyle,
  uploadStage
} = useImageNodeProgressState({
  error: () => props.data?.error,
  loading: () => props.data?.loading
})
const {
  applyUploadSaveOutcome,
  clearLocalPreviewUrl,
  isUploading,
  replaceLocalPreviewUrl,
  resetUploadProgress,
  triggerUpload
} = useImageNodeUploadLifecycle({
  messageApi: () => window.$message,
  uploadInputRef,
  showUploadProgress,
  uploadProgress,
  uploadStage
})
const {
  resolveImagePersistence,
  resolveImageSaveFeedback,
  showImageToolSaveMessage
} = useImageNodePersistence({
  currentProjectId,
  getImageNodeSaveFeedback,
  getImageNodeToolSaveMessage,
  messageApi: () => window.$message,
  nodeId: () => props.id,
  persistImageUrl,
  projectSaveState
})
const { handleFileUpload } = useImageNodeUploadPersistence({
  applyUploadSaveOutcome,
  clearLocalPreviewUrl,
  createObjectURL: (uploadFile) => URL.createObjectURL(uploadFile),
  currentData: () => props.data,
  currentProjectId,
  flushSave,
  getErrorMessage,
  getImageDimensionsFromFile,
  getImageNodeActionErrorPatch,
  getImageNodeSaveFeedbackPatch,
  getImageNodeUploadFailureOutcome,
  getImageNodeUploadFailurePatch,
  getImageNodeUploadMetadata,
  getImageNodeUploadPreviewPatch,
  getImageNodeUploadedPatch,
  getImageNodeUploadSaveOutcome,
  isLocalPreviewMode,
  isUploading,
  localImageRatio,
  localImageSize,
  maxUploadSizeBytes: MAX_UPLOAD_SIZE_BYTES,
  messageApi: () => window.$message,
  nodeId: () => props.id,
  projectSaveState,
  replaceLocalPreviewUrl,
  resetUploadProgress,
  resolveImageSaveFeedback,
  setTimeoutFn: setTimeout,
  showUploadProgress,
  showValidationModal,
  updateNode,
  updateNodeInternals,
  uploadImageFile,
  uploadProgress,
  uploadStage,
  validationMessage
})
const { replaceCurrentImageNode } = useImageNodeReplacement({
  currentData: () => props.data,
  currentProjectId,
  dataUrlToFile,
  flushSave,
  getImageNodeReplacementErrorPatch,
  getImageNodeReplacementPreviewPatch,
  getImageNodeReplacementSaveMessage,
  getImageNodeReplacementUploadedPatch,
  getImageNodeSaveFeedbackPatch,
  isLocalPreviewMode,
  localImageRatio,
  localImageSize,
  localResolution,
  messageApi: () => window.$message,
  nodeId: () => props.id,
  projectSaveState,
  resolveImageSaveFeedback,
  setTimeoutFn: setTimeout,
  updateNode,
  updateNodeInternals,
  uploadImageFile
})
const {
  createLinkedImageNode,
  updateLinkedImageNode
} = useImageNodeLinkedNodes({
  addEdge,
  addNode,
  buildCreateData: getImageNodeLinkedCreateData,
  buildPosition: getImageNodeLinkedPosition,
  buildSelectionState: getImageNodeLinkedSelectionState,
  buildUpdatePatch: getImageNodeLinkedUpdatePatch,
  edgeStrategy,
  flushSave,
  getDefaults: () => ({
    model: localImageModel.value,
    quality: localImageQuality.value,
    ratio: localImageRatio.value,
    resolution: localResolution.value,
    size: localImageSize.value
  }),
  nodeId: () => props.id,
  nodes,
  stageStyle: () => stageStyle.value,
  updateNode,
  updateNodeInternals
})
const displayImageUrl = computed(() => String(props.data?.previewUrl || props.data?.url || props.data?.base64 || '').trim())
const { downloadPreviewImage } = useImageNodePreviewDownload({
  getLabel: () => props.data?.label,
  getSourceUrl: () => displayImageUrl.value
})
const hasDisplayImage = computed(() => !!displayImageUrl.value)
const isCanvasInteracting = computed(() => isCanvasZooming.value || isNodeDragging.value)
const { canvasDisplayImageUrl } = useImageNodeCanvasPreview({
  activeTool: () => activeTool.value,
  displayImageUrl: () => displayImageUrl.value,
  isCanvasInteracting: () => isCanvasInteracting.value
})
const {
  handleGenerateImage,
  handleRegenerateImage,
  handleStopGeneration
} = useImageNodeGeneration({
  buildImagePersistencePatch,
  buildSourceRefImages,
  currentProjectId,
  displayImageUrl,
  getConnectedInputs,
  getErrorMessage,
  getImageNodeActionErrorPatch,
  getImageNodeActionPendingPatch,
  getImageNodeGenerationSaveMessage,
  getImageNodeSaveFeedbackPatch,
  imageActionLoading,
  imageGen,
  isConfigured,
  localBackground,
  localImageModel,
  localImageQuality,
  localImageRatio,
  localImageSize,
  localOutputFormat,
  localResolution,
  messageApi: () => window.$message,
  nodeId: () => props.id,
  projectSaveState,
  resetProgress,
  resolveImagePersistence,
  resolveImageSaveFeedback,
  saveProject,
  updateNode
})
const toolOptionIcons = {
  'remove-background': removeBgIcon,
  crop: cropIcon,
  'multi-angle': cameraOrbitIcon
}
const withToolOptionIcon = (option) => {
  const src = toolOptionIcons[option.key]
  if (!src) return option
  return {
    ...option,
    renderIcon: () => h('img', { src, alt: '', class: 'tool-option-icon' })
  }
}
const toolDropdownOptions = computed(() => getImageNodeToolOptions({
  hasDisplayImage: hasDisplayImage.value,
  isUploading: isUploading.value,
  isToolBusy: isToolBusy.value
}).map(withToolOptionIcon))
const imageInputStatusMap = {
  prompt: 'Prompt',
  reference: 'Reference Picture'
}

const formatCountLabel = (count, singular, plural) => `${count} ${count === 1 ? singular : plural}`

const resolvedImageInputs = computed(() => resolveNodeInputs(props.id))
const groupContextSummaryLabel = computed(() => {
  const contexts = resolvedImageInputs.value.groupContexts || []
  const promptCount = contexts.reduce((total, context) => total + Number(context.promptCount || 0), 0)
  const referenceCount = contexts.reduce((total, context) => total + Number(context.referenceCount || 0), 0)
  return `Group Context · ${formatCountLabel(promptCount, 'prompt', 'prompts')} · ${formatCountLabel(referenceCount, 'reference', 'references')}`
})

watch(
  () => [props.data?.error, props.data?.suppressErrorModal],
  ([newVal, suppressErrorModal]) => {
    showErrorModal.value = !!newVal && !suppressErrorModal
  }
)
const {
  activeTool,
  cancelCropMode,
  cropBoxStyle,
  cropHandles,
  cropMaskStyles,
  cropRect,
  cropStageMetrics,
  initializeCropRect,
  startCropDrag,
  startCropMode,
  startCropResize,
  stopCropInteraction
} = useImageNodeCropInteraction({
  closePreviewModal: () => {
    showPreviewModal.value = false
  },
  hasDisplayImage: () => hasDisplayImage.value,
  naturalSize: () => previewNaturalSize.value,
  onApply: () => applyCrop(),
  stageStyle: () => stageStyle.value
})
const {
  handleMultiAngleApply,
  handleMultiAngleError,
  handleMultiAnglePending,
  handleWedding3x3Apply,
  handleWedding3x3Error,
  handleWedding3x3Pending,
  showMultiAngleDrawer,
  showWedding3x3Drawer
} = useImageNodeToolDrawerResults({
  createLinkedImageNode,
  currentData: () => props.data,
  flushSave,
  getImageNodeSaveFeedbackPatch,
  getImageNodeToolErrorPatch,
  getImageNodeToolLinkedCreatePatch,
  getImageNodeToolLinkedResultPatch,
  getImageNodeToolPendingPatch,
  getImageNodeToolReplacementPatch,
  getImageNodeToolSaveMessages,
  localImageQuality,
  localImageRatio,
  localImageSize,
  localResolution,
  messageApi: () => window.$message,
  nodeId: () => props.id,
  projectSaveState,
  resolveImagePersistence,
  resolveImageSaveFeedback,
  showImageToolSaveMessage,
  updateLinkedImageNode,
  updateNode
})
const {
  applyCrop,
  handleToolAction
} = useImageNodeToolActions({
  activeTool,
  cancelCropMode,
  createImageNodeCropPayload,
  createLinkedImageNode,
  currentData: () => props.data,
  currentProjectId,
  defaultEnhancePrompt: DEFAULT_ENHANCE_PROMPT,
  defaultImageModel: DEFAULT_IMAGE_MODEL,
  defaultImageSize: DEFAULT_IMAGE_SIZE,
  displayImageUrl,
  edges,
  findNearestSizeKey,
  flushSave,
  getErrorMessage,
  getImageNodeEnhancementErrorPatch,
  getImageNodeEnhancementRequest,
  getImageNodeEnhancementResultPatch,
  getImageNodeRatioFromSizeKey,
  getImageNodeRemoveBackgroundResultPatch,
  getImageNodeToolSaveMessages,
  getNearestImageNodeSourceConfig,
  imageGen,
  imageTools,
  localImageModel,
  localImageQuality,
  localImageRatio,
  localImageSize,
  localResolution,
  messageApi: () => window.$message,
  nodeId: () => props.id,
  nodes,
  projectSaveState,
  replaceCurrentImageNode,
  resolveImagePersistence,
  resolveImageSaveFeedback,
  resolveNodeInputs,
  showImageToolSaveMessage,
  showMultiAngleDrawer,
  showWedding3x3Drawer,
  startCropMode,
  toolActionLoading,
  triggerUpload,
  updateLinkedImageNode,
  cropRect,
  cropStageMetrics
})
const capsuleStyle = {
  transform: 'translateX(-50%) scale(var(--node-capsule-scale, 1))',
  transformOrigin: 'top center'
}
const isImageBusy = computed(() => !!props.data?.loading || imageGen.loading.value || !!imageActionLoading.value)
const isToolBusy = computed(() => imageTools.loading.value || !!toolActionLoading.value)

onUnmounted(() => {
  stopCropInteraction()
})

function getConnectedInputs() {
  const resolved = resolvedImageInputs.value
  return {
    prompt: resolved.prompt,
    refImages: resolved.refImages
  }
}

const activeImageInputSet = computed(() => {
  const activeKeys = getImageNodeActiveInputKeys({
    edges: edges.value,
    nodes: nodes.value,
    targetNodeId: props.id
  })
  if ((resolvedImageInputs.value.groupContexts || []).length) activeKeys.add('groupContext')
  return activeKeys
})
const imageInputStatusList = computed(() => getImageNodeInputStatusList({
  activeKeys: activeImageInputSet.value,
  labels: activeImageInputSet.value.has('groupContext')
    ? { ...imageInputStatusMap, groupContext: groupContextSummaryLabel.value }
    : imageInputStatusMap
}))

const handleDelete = () => {
  clearLocalPreviewUrl()
  removeNode(props.id)
}

const handleDuplicate = () => {
  const newId = duplicateNode(props.id)
  if (!newId) return
  updateNode(props.id, { selected: false })
  updateNode(newId, { selected: true })
  window.$message?.success('Node duplicated')
  setTimeout(() => updateNodeInternals(newId), 50)
}

const handleMetaMouseDown = (event) => {
  if (event?.button !== 0) return
}

const openPreviewModal = () => {
  if (!hasDisplayImage.value) return
  activeTool.value = ''
  showPreviewImageModal()
}
const handlePreviewImageLoad = (event) => {
  const nextNaturalSize = setPreviewNaturalSizeFromEvent(event)
  if (!nextNaturalSize) return
  if (activeTool.value === 'crop') {
    initializeCropRect()
  }
}
const closeErrorModal = () => {
  showErrorModal.value = false
  updateNode(props.id, { error: '' })
}

const closeValidationModal = () => {
  showValidationModal.value = false
  validationMessage.value = ''
}


</script>

<style scoped src="./node-base.css"></style>
<style scoped>
.image-node {
  cursor: default;
  position: relative;
  background: #0f0f0f;
  isolation: isolate;
  --module-radius: 24px;
  --module-inset: 12px;
  border-radius: var(--module-radius);
}

.image-node::after {
  content: '';
  position: absolute;
  inset: -16px;
  border-radius: 28px;
  z-index: -1;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.22s ease;
  background:
    radial-gradient(46% 60% at 24% 80%, rgba(92, 133, 255, 0.4), transparent 70%),
    radial-gradient(58% 52% at 78% 18%, rgba(255, 123, 95, 0.38), transparent 72%),
    radial-gradient(92% 92% at 50% 50%, rgba(115, 138, 255, 0.24), transparent 74%);
  filter: blur(16px);
}

.node-glow-active::after {
  opacity: 1;
}

.upload-hit-area {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
  z-index: 3;
}

</style>
