<template>
  <div class="image-node-wrapper node-shell-wrapper" @mouseenter="showCapsule = true" @mouseleave="showCapsule = false">
    <div class="node-meta-row" @mousedown="handleMetaMouseDown">
      <n-icon :size="16" class="meta-icon"><ImageOutline /></n-icon>
      <span class="meta-title">Image</span>
    </div>

    <div v-show="showNodeCapsule" class="capsule-menu absolute left-1/2 z-[1200]" :style="capsuleStyle">
      <div class="capsule-inner" :class="{ 'capsule-inner-selected': isSelected }">
        <div class="capsule-group">
          <BaseDropdown :options="imageModelDropdownOptions" compact @select="setImageModel">
            <button class="capsule-select">{{ displayImageModel }}</button>
          </BaseDropdown>

          <BaseDropdown v-if="ratioDropdownOptions.length > 0" :options="ratioDropdownOptions" compact @select="setImageRatio">
            <button class="capsule-select">{{ displayRatio }}</button>
          </BaseDropdown>

          <BaseDropdown v-if="resolutionDropdownOptions.length > 0 && localImageModel.includes('gemini')" :options="resolutionDropdownOptions" compact @select="setResolution">
            <button class="capsule-select capsule-resolution">{{ displayResolution }}</button>
          </BaseDropdown>
        </div>

        <div class="capsule-divider" />

        <div class="capsule-group">
          <BaseDropdown :options="toolDropdownOptions" compact @select="handleToolAction">
            <button class="capsule-select capsule-tool-trigger" :disabled="!data.url || isToolBusy">
              <img :src="toolsIcon" alt="" class="capsule-tool-icon" />
              <span>Tools</span>
            </button>
          </BaseDropdown>
          <button class="capsule-icon" :disabled="!data.url" @click="openPreviewModal" title="Preview">
            <n-icon :size="14"><ExpandOutline /></n-icon>
          </button>
          <button class="capsule-icon" @click="handleDuplicate" title="Duplicate">
            <n-icon :size="14"><CopyOutline /></n-icon>
          </button>

          <button class="capsule-icon" @click="handleDelete" title="Delete">
            <n-icon :size="14"><TrashOutline /></n-icon>
          </button>
        </div>
      </div>
      <div class="capsule-inner capsule-generate" :class="{ 'capsule-inner-selected': isSelected }">
        <button v-if="!isImageBusy" class="capsule-icon capsule-icon-solid capsule-create" @click="handleGenerateImage" title="Create">
          <img :src="createIcon" alt="" class="capsule-create-graphic" />
          <span class="capsule-create-label">Create</span>
        </button>
        <button v-if="!isImageBusy" class="capsule-icon" @click="handleRegenerateImage" title="Regenerate">
          <n-icon :size="14"><RefreshOutline /></n-icon>
        </button>
        <button v-if="isImageBusy" class="capsule-icon capsule-icon-solid capsule-create" @click="handleStopGeneration" title="Stop">
          <n-icon :size="14"><CloseCircleOutline /></n-icon>
          <span class="capsule-create-label">Stop</span>
        </button>
      </div>
    </div>

    <div
      class="image-node rounded-2xl border relative transition-all duration-200 overflow-visible"
      :class="[
        isSelected ? 'node-selected' : 'node-default',
        { 'node-glow-active': isSelected }
      ]"
      :style="moduleStyle"
    >
      <div class="module-stage" :style="stageStyle">
        <div v-if="showProgress" class="module-progress-shell">
          <div class="module-progress-track"></div>
          <div class="module-progress-bar" :style="progressBarStyle"></div>
          <div class="module-progress-label">Generating image... {{ progressPercent }}%</div>
        </div>

        <div v-else-if="data.url" class="module-image-shell">
          <div class="module-image-frame">
            <img
              :src="displayImageUrl"
              :alt="data.label || 'Image'"
              class="module-image"
              @load="handlePreviewImageLoad"
            />
            <div v-if="activeTool === 'crop'" class="crop-overlay crop-overlay-inline">
              <div class="crop-mask crop-mask-top" :style="cropMaskTopStyle"></div>
              <div class="crop-mask crop-mask-left" :style="cropMaskLeftStyle"></div>
              <div class="crop-mask crop-mask-right" :style="cropMaskRightStyle"></div>
              <div class="crop-mask crop-mask-bottom" :style="cropMaskBottomStyle"></div>
              <div class="crop-box" :style="cropBoxStyle" @mousedown.stop.prevent="startCropDrag">
                <span
                  v-for="handle in cropHandles"
                  :key="handle"
                  class="crop-handle"
                  :class="`crop-handle-${handle}`"
                  @mousedown.stop.prevent="startCropResize(handle, $event)"
                />
              </div>
              <div class="crop-inline-tip">Enter apply · Esc cancel</div>
            </div>
          </div>
        </div>

        <div
          v-else-if="urlLoading"
          class="w-full h-full bg-[#1a1c21] flex flex-col items-center justify-center gap-3"
        >
          <img src="../../assets/loading.webp" alt="Loading" class="w-14 h-12" />
          <span class="text-sm text-white font-medium">Loading...</span>
        </div>

        <div
          v-else
          class="w-full h-full bg-[#0f0f0f] flex flex-col items-center justify-center gap-2 relative text-center px-4 nodrag nopan"
          @mousedown.stop
        >
          <n-icon :size="32" class="text-[#7b818c]"><ImageOutline /></n-icon>
          <span class="text-sm text-[#7b818c]">Drop an image or click to upload</span>
          <button class="upload-btn nodrag nopan" @click.stop="triggerUpload">Upload</button>
        </div>
        <input
          :id="uploadInputId"
          ref="uploadInputRef"
          type="file"
          accept="image/*"
          class="hidden"
          @change="handleFileUpload"
        />
      </div>

      <div v-if="showUploadProgress" class="upload-progress-wrap">
        <div class="upload-progress-track">
          <div class="upload-progress-bar" :style="uploadProgressStyle"></div>
        </div>
      </div>

      <Handle type="source" :position="Position.Right" id="right" :class="['node-handle-plus', 'node-handle-plus-right', { 'node-handle-plus-visible': showHandles }]" />
      <Handle type="target" :position="Position.Left" id="left" :class="['node-handle-plus', 'node-handle-plus-left', { 'node-handle-plus-visible': showHandles }]" />

    </div>

    <n-modal v-model:show="showPreviewModal" :mask-closable="true">
      <div class="zoom-modal-card" @click.stop>
        <div class="zoom-modal-toolbar">
          <div class="zoom-modal-actions">
            <button class="zoom-tool-btn zoom-tool-btn-download" @click="downloadPreviewImage">
              <n-icon :size="14"><DownloadOutline /></n-icon>
              <span>Download</span>
            </button>
          </div>
          <div class="zoom-modal-actions">
            <button class="zoom-tool-btn" @click="zoomOutPreview" :disabled="previewZoom <= PREVIEW_MIN_ZOOM">-</button>
            <button class="zoom-tool-btn" @click="resetPreviewZoom">Fit</button>
            <button class="zoom-tool-btn" @click="zoomInPreview" :disabled="previewZoom >= PREVIEW_MAX_ZOOM">+</button>
            <div class="zoom-modal-divider" />
            <div class="zoom-modal-chip">{{ Math.round(previewZoom * 100) }}%</div>
          </div>
        </div>
        <div ref="previewStageRef" class="zoom-modal-stage">
          <div class="zoom-stage-canvas" :style="previewCanvasStyle">
            <div class="zoom-image-wrap" :style="previewImageStyle">
              <img
                :src="displayImageUrl"
                alt="Preview"
                class="zoom-image-original"
                @load="handlePreviewImageLoad"
              />
            </div>
          </div>
        </div>
      </div>
    </n-modal>
    <BaseModal
      v-model:show="showErrorModal"
      title="Image Module Error"
      size="sm"
    >
      <p class="ui-body ui-modal-copy whitespace-pre-wrap">{{ data.error }}</p>
      <template #footer>
        <div class="ui-modal-actions">
          <BaseButton @click="closeErrorModal">Close</BaseButton>
        </div>
      </template>
    </BaseModal>
    <BaseModal
      v-model:show="showValidationModal"
      title="Upload Limit"
      size="sm"
    >
      <p class="ui-body ui-modal-copy whitespace-pre-wrap">{{ validationMessage }}</p>
      <template #footer>
        <div class="ui-modal-actions">
          <BaseButton @click="closeValidationModal">OK</BaseButton>
        </div>
      </template>
    </BaseModal>

    <div class="binding-status-wrap">
      <div class="binding-status-row">
        <div
          v-for="item in imageInputStatusList"
          :key="item.key"
          class="binding-status-pill"
          :class="item.active ? 'binding-status-pill-active' : 'binding-status-pill-idle'"
        >
          {{ item.label }}
        </div>
      </div>
    </div>

    <MultiAngleToolDrawer
      v-model:show="showMultiAngleDrawer"
      :image-url="data.url || data.base64 || ''"
      :model="localImageModel"
      :ratio="localImageRatio"
      :size="localImageSize"
      :resolution="localResolution"
      :ratio-options="ratioDropdownOptions"
      :size-options="imageSizeOptions"
      @pending="handleMultiAnglePending"
      @apply="handleMultiAngleApply"
      @error="handleMultiAngleError"
    />
  </div>
</template>

<script setup>
import { computed, h, nextTick, onUnmounted, ref, watch } from 'vue'
import { Handle, Position, useVueFlow } from '@vue-flow/core'
import { NIcon, NModal } from 'naive-ui'
import { BaseButton, BaseDropdown, BaseModal } from '@/components/ui'
import MultiAngleToolDrawer from '@/components/tools/MultiAngleToolDrawer.vue'
import {
  CloseCircleOutline,
  CopyOutline,
  DownloadOutline,
  ExpandOutline,
  ImageOutline,
  RefreshOutline,
  TrashOutline
} from '../../icons/coolicons'
import { addEdge, addNode, duplicateNode, edges, nodes, removeNode, saveProject, flushSave, updateNode } from '../../stores/canvas'
import {
  DEFAULT_IMAGE_MODEL,
  DEFAULT_IMAGE_SIZE,
  getModelConfig,
  getModelSizeOptions,
  imageModelOptions
} from '../../stores/models'
import { useApiConfig, useImageGeneration } from '../../hooks'
import { getErrorMessage } from '@/utils'
import { createAuthenticatedMediaProxyUrl, dataUrlToFile, persistImageUrl, uploadImageFile } from '@/utils/media'
import { edgeStrategy, resolveNodeInputs } from '../../services/edgeStrategy'
import createIcon from '@/assets/create-icon.svg'
import { useImageTools } from '../../hooks/useApi'
import toolsIcon from '@/assets/tools-icon.svg'
import removeBgIcon from '@/assets/remove-bg-icon.svg'
import cropIcon from '@/assets/crop-icon.svg'
import cameraOrbitIcon from '@/assets/tools-icon.svg'

const props = defineProps({
  id: String,
  data: Object,
  selected: Boolean
})

const { updateNodeInternals, viewport } = useVueFlow()
const { isConfigured } = useApiConfig()
const imageGen = useImageGeneration()
const imageTools = useImageTools()

const showCapsule = ref(false)
const urlLoading = ref(false)
const isSelected = computed(() => !!props.selected || !!props.data?.selected)
const showNodeCapsule = computed(() => !props.data?.suppressCapsule && (showCapsule.value || isSelected.value))
const showHandles = computed(() => showCapsule.value || isSelected.value)

const localImageModel = ref(props.data?.model || DEFAULT_IMAGE_MODEL)
const localImageSize = ref(props.data?.size || DEFAULT_IMAGE_SIZE)
const localImageQuality = ref(props.data?.quality || 'standard')
const localImageRatio = ref('1:1')
const localResolution = ref('1k')
const uploadInputRef = ref(null)
const uploadInputId = `image-upload-${String(props.id || 'node')}`
const showPreviewModal = ref(false)
const previewStageRef = ref(null)
const previewStageSize = ref({ width: 0, height: 0 })
const previewZoom = ref(1)
const previewNaturalSize = ref({ width: 0, height: 0 })
const activeTool = ref('')
const showMultiAngleDrawer = ref(false)
const pendingMultiAngleNodeId = ref('')
const cropRect = ref({ x: 0, y: 0, width: 0, height: 0 })
const cropInteraction = ref(null)
const showErrorModal = ref(false)
const showValidationModal = ref(false)
const validationMessage = ref('')
const imageActionLoading = ref('')
const toolActionLoading = ref('')
const isUploading = ref(false)
const showUploadProgress = ref(false)
const uploadProgress = ref(0)
const uploadStage = ref('idle') // idle | uploading | saving | success | error
const progressValue = ref(0)
const showProgress = ref(false)
const progressTimer = ref(null)
const progressFinishTimer = ref(null)
const localPreviewUrl = ref('')
const toolDropdownOptions = computed(() => ([
  {
    label: props.data?.url ? 'Replace Image' : 'Upload Image',
    key: 'replace-image',
    disabled: isUploading.value
  },
  {
    label: 'Remove Background',
    key: 'remove-background',
    disabled: !props.data?.url || isToolBusy.value,
    renderIcon: () => h('img', { src: removeBgIcon, alt: '', class: 'tool-option-icon' })
  },
  {
    label: 'Crop',
    key: 'crop',
    disabled: !props.data?.url || isToolBusy.value,
    renderIcon: () => h('img', { src: cropIcon, alt: '', class: 'tool-option-icon' })
  },
  {
    label: 'Enhance to 4K',
    key: 'enhance-4k',
    disabled: !props.data?.url || isToolBusy.value,
    description: 'Reuse original model and inputs, increase resolution only'
  },
  {
    label: 'Multi-Angle',
    key: 'multi-angle',
    disabled: !props.data?.url || isToolBusy.value,
    renderIcon: () => h('img', { src: cameraOrbitIcon, alt: '', class: 'tool-option-icon' })
  }
]))
const imageInputStatusMap = {
  prompt: 'Prompt',
  reference: 'Reference Picture'
}

const BASE_SIZE_BY_RATIO = {
  '1:1': { w: 1024, h: 1024 },
  '3:2': { w: 1152, h: 768 },
  '2:3': { w: 768, h: 1152 },
  '4:3': { w: 1152, h: 864 },
  '3:4': { w: 864, h: 1152 },
  '4:5': { w: 896, h: 1120 },
  '5:4': { w: 1120, h: 896 },
  '16:9': { w: 1280, h: 720 },
  '9:16': { w: 720, h: 1280 },
  '21:9': { w: 1680, h: 720 }
}
const MAX_UPLOAD_SIZE_BYTES = 30 * 1024 * 1024
const MAX_IMAGE_DIMENSION = 6144
const PREVIEW_MIN_ZOOM = 0.75
const PREVIEW_MAX_ZOOM = 4
const PREVIEW_ZOOM_STEP = 0.25
const MIN_CROP_SIZE = 48
const cropHandles = ['nw', 'ne', 'sw', 'se']
const isLocalPreviewHost = () => {
  if (typeof window === 'undefined') return false
  const host = String(window.location.hostname || '').trim().toLowerCase()
  return host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0'
}

const isLocalPreviewMode = computed(() => isLocalPreviewHost())
const isBlobUrl = (value) => String(value || '').startsWith('blob:')
const revokeBlobUrl = (value) => {
  if (!isBlobUrl(value)) return
  try {
    URL.revokeObjectURL(String(value))
  } catch {}
}
const clearLocalPreviewUrl = () => {
  if (!localPreviewUrl.value) return
  revokeBlobUrl(localPreviewUrl.value)
  localPreviewUrl.value = ''
}
const replaceLocalPreviewUrl = (nextUrl = '') => {
  if (localPreviewUrl.value && localPreviewUrl.value !== nextUrl) {
    revokeBlobUrl(localPreviewUrl.value)
  }
  localPreviewUrl.value = isBlobUrl(nextUrl) ? String(nextUrl) : ''
}

const ratioFromSizeKey = (sizeKey) => {
  const [w, h] = String(sizeKey || '').split('x').map(Number)
  if (!w || !h) return '1:1'
  const ratio = w / h
  if (Math.abs(ratio - 1) < 0.02) return '1:1'
  if (Math.abs(ratio - 3 / 2) < 0.03) return '3:2'
  if (Math.abs(ratio - 2 / 3) < 0.03) return '2:3'
  if (Math.abs(ratio - 16 / 9) < 0.03) return '16:9'
  if (Math.abs(ratio - 9 / 16) < 0.03) return '9:16'
  if (Math.abs(ratio - 4 / 3) < 0.03) return '4:3'
  if (Math.abs(ratio - 3 / 4) < 0.03) return '3:4'
  if (Math.abs(ratio - 4 / 5) < 0.03) return '4:5'
  if (Math.abs(ratio - 5 / 4) < 0.03) return '5:4'
  if (Math.abs(ratio - 21 / 9) < 0.03) return '21:9'
  return '1:1'
}

const resolutionFromSizeKey = (sizeKey) => {
  const [w, h] = String(sizeKey || '').split('x').map(Number)
  if (!w || !h) return '1k'
  const ratio = ratioFromSizeKey(sizeKey)
  const base = BASE_SIZE_BY_RATIO[ratio] || BASE_SIZE_BY_RATIO['1:1']
  const scale = Math.max(w / base.w, h / base.h)
  if (scale >= 3.5) return '4k'
  if (scale >= 1.8) return '2k'
  return '1k'
}

localImageRatio.value = props.data?.ratio || ratioFromSizeKey(localImageSize.value)
localResolution.value = props.data?.resolution || resolutionFromSizeKey(localImageSize.value)

watch(
  () => props.data,
  (val) => {
    if (!val) return
    if (val.model && val.model !== localImageModel.value) localImageModel.value = val.model
    if (val.size && val.size !== localImageSize.value) localImageSize.value = val.size
    if (val.quality && val.quality !== localImageQuality.value) localImageQuality.value = val.quality
    localImageRatio.value = val.ratio || ratioFromSizeKey(localImageSize.value)
    localResolution.value = val.resolution || resolutionFromSizeKey(localImageSize.value)
  },
  { deep: true }
)
watch(
  () => props.data?.error,
  (newVal) => {
    showErrorModal.value = !!newVal
  }
)

const imageModelDropdownOptions = computed(() => imageModelOptions.value.map(m => ({ key: m.key, label: m.label })))
const imageSizeOptions = computed(() => getModelSizeOptions(localImageModel.value, localImageQuality.value))
const sizeMetaOptions = computed(() =>
  imageSizeOptions.value.map((opt) => {
    const key = String(opt.key || '')
    const [w, h] = key.split('x').map(Number)
    const ratio = ratioFromSizeKey(key)
    const resolutionKey = resolutionFromSizeKey(key)
    return {
      key,
      ratio,
      resolutionKey,
      pixels: (w || 0) * (h || 0)
    }
  })
)

const ratioDropdownOptions = computed(() => {
  const seen = new Set()
  return sizeMetaOptions.value
    .map((opt) => opt.ratio)
    .filter((ratio) => {
      if (seen.has(ratio)) return false
      seen.add(ratio)
      return true
    })
    .map((ratio) => ({ key: ratio, label: ratio }))
})

const resolutionDropdownOptions = computed(() => {
  const seen = new Set()
  const list = sizeMetaOptions.value
    .filter((opt) => opt.ratio === localImageRatio.value)
    .sort((a, b) => a.pixels - b.pixels)
    .filter((opt) => {
      if (seen.has(opt.resolutionKey)) return false
      seen.add(opt.resolutionKey)
      return true
    })
    .map((opt) => ({ key: opt.resolutionKey, label: opt.resolutionKey.toUpperCase() }))
  return list.length > 0 ? list : [{ key: '1k', label: '1K' }]
})

const displayImageModel = computed(() => {
  return imageModelOptions.value.find(m => m.key === localImageModel.value)?.label || localImageModel.value
})

const displayRatio = computed(() => {
  return localImageRatio.value
})
const displayResolution = computed(() => localResolution.value.toUpperCase())

const ratioFromSize = computed(() => {
  if (localImageRatio.value && localImageRatio.value.includes(':')) {
    return localImageRatio.value
  }
  
  const [w, h] = String(localImageSize.value || '').split('x').map(Number)
  if (!w || !h) return '1:1'
  const ratio = w / h
  if (Math.abs(ratio - 1) < 0.05) return '1:1'
  if (Math.abs(ratio - 16 / 9) < 0.05) return '16:9'
  if (Math.abs(ratio - 9 / 16) < 0.05) return '9:16'
  if (Math.abs(ratio - 4 / 3) < 0.05) return '4:3'
  if (Math.abs(ratio - 3 / 4) < 0.05) return '3:4'
  return `${w}:${h}` // Fallback to custom ratio
})

const stageStyle = computed(() => {
  const ratio = ratioFromSize.value
  const map = {
    '1:1': { width: 320, height: 320 },
    '3:2': { width: 360, height: 240 },
    '2:3': { width: 240, height: 360 },
    '16:9': { width: 420, height: 236 },
    '9:16': { width: 260, height: 462 },
    '4:3': { width: 360, height: 270 },
    '3:4': { width: 280, height: 373 },
    '4:5': { width: 280, height: 350 },
    '5:4': { width: 350, height: 280 },
    '21:9': { width: 420, height: 180 }
  }
  
  if (map[ratio]) return { width: `${map[ratio].width}px`, height: `${map[ratio].height}px` }

  // Handle custom ratio
  const [w, h] = ratio.includes(':') ? ratio.split(':').map(Number) : [1, 1]
  if (!w || !h) return { width: '320px', height: '320px' }
  
  // Calculate size fitting within max bounds (e.g. 420x462) while maintaining aspect ratio
  const MAX_W = 420
  const MAX_H = 462
  const scale = Math.min(MAX_W / w, MAX_H / h)
  
  return {
    width: `${Math.round(w * scale)}px`,
    height: `${Math.round(h * scale)}px`
  }
})

const moduleStyle = computed(() => ({ width: `calc(${stageStyle.value.width} + 2px)` }))
const progressPercent = computed(() => Math.round(progressValue.value))
const progressBarStyle = computed(() => ({ width: `${Math.max(0, Math.min(100, progressValue.value))}%` }))
const displayImageUrl = computed(() => createAuthenticatedMediaProxyUrl(props.data?.url || ''))
const previewViewportSize = computed(() => ({
  width: Math.max(0, previewStageSize.value.width - 40),
  height: Math.max(0, previewStageSize.value.height - 40)
}))
const previewRenderedSize = computed(() => {
  const naturalWidth = previewNaturalSize.value.width || 1
  const naturalHeight = previewNaturalSize.value.height || 1
  const maxWidth = Math.max(320, previewViewportSize.value.width || window.innerWidth - 180)
  const maxHeight = Math.max(240, previewViewportSize.value.height || window.innerHeight - 220)
  const fitScale = Math.min(maxWidth / naturalWidth, maxHeight / naturalHeight, 1)
  return {
    width: Math.max(1, Math.round(naturalWidth * fitScale * previewZoom.value)),
    height: Math.max(1, Math.round(naturalHeight * fitScale * previewZoom.value))
  }
})

const previewImageStyle = computed(() => {
  const { width, height } = previewRenderedSize.value
  return {
    width: `${width}px`,
    height: `${height}px`
  }
})
const previewCanvasStyle = computed(() => ({
  width: `${Math.max(previewViewportSize.value.width, previewRenderedSize.value.width)}px`,
  height: `${Math.max(previewViewportSize.value.height, previewRenderedSize.value.height)}px`
}))
const cropStageMetrics = computed(() => {
  const frameWidth = Math.max(1, (Number.parseFloat(stageStyle.value.width) || 0) - 24)
  const frameHeight = Math.max(1, (Number.parseFloat(stageStyle.value.height) || 0) - 24)
  const naturalWidth = previewNaturalSize.value.width || frameWidth
  const naturalHeight = previewNaturalSize.value.height || frameHeight
  const scale = Math.max(frameWidth / naturalWidth, frameHeight / naturalHeight)
  const displayWidth = naturalWidth * scale
  const displayHeight = naturalHeight * scale
  const offsetX = (frameWidth - displayWidth) / 2
  const offsetY = (frameHeight - displayHeight) / 2

  return {
    frameWidth,
    frameHeight,
    naturalWidth,
    naturalHeight,
    scale,
    offsetX,
    offsetY
  }
})
const cropBoxStyle = computed(() => ({
  left: `${cropRect.value.x}px`,
  top: `${cropRect.value.y}px`,
  width: `${cropRect.value.width}px`,
  height: `${cropRect.value.height}px`
}))
const cropMaskTopStyle = computed(() => ({
  left: '0px',
  top: '0px',
  width: `${cropStageMetrics.value.frameWidth}px`,
  height: `${cropRect.value.y}px`
}))
const cropMaskLeftStyle = computed(() => ({
  left: '0px',
  top: `${cropRect.value.y}px`,
  width: `${cropRect.value.x}px`,
  height: `${cropRect.value.height}px`
}))
const cropMaskRightStyle = computed(() => ({
  left: `${cropRect.value.x + cropRect.value.width}px`,
  top: `${cropRect.value.y}px`,
  width: `${Math.max(0, cropStageMetrics.value.frameWidth - cropRect.value.x - cropRect.value.width)}px`,
  height: `${cropRect.value.height}px`
}))
const cropMaskBottomStyle = computed(() => ({
  left: '0px',
  top: `${cropRect.value.y + cropRect.value.height}px`,
  width: `${cropStageMetrics.value.frameWidth}px`,
  height: `${Math.max(0, cropStageMetrics.value.frameHeight - cropRect.value.y - cropRect.value.height)}px`
}))
const capsuleStyle = computed(() => {
  const zoom = viewport.value?.zoom || 1
  const inverse = 1 / zoom
  const safeScale = Math.min(1.06, Math.max(0.82, inverse))
  return {
    transform: `translateX(-50%) scale(${safeScale})`,
    transformOrigin: 'top center'
  }
})
const clearProgressTimers = () => {
  if (progressTimer.value) {
    clearInterval(progressTimer.value)
    progressTimer.value = null
  }
  if (progressFinishTimer.value) {
    clearTimeout(progressFinishTimer.value)
    progressFinishTimer.value = null
  }
}

const startProgress = () => {
  clearProgressTimers()
  progressValue.value = 0
  showProgress.value = true
  progressTimer.value = setInterval(() => {
    if (progressValue.value < 70) progressValue.value += 3
    else if (progressValue.value < 90) progressValue.value += 1.2
    else if (progressValue.value < 98) progressValue.value += 0.35
    progressValue.value = Math.min(progressValue.value, 98)
  }, 120)
}

const finishProgress = () => {
  clearProgressTimers()
  progressTimer.value = setInterval(() => {
    progressValue.value = Math.min(100, progressValue.value + 4.5)
    if (progressValue.value >= 100) {
      clearProgressTimers()
      progressFinishTimer.value = setTimeout(() => {
        showProgress.value = false
        progressValue.value = 0
      }, 120)
    }
  }, 16)
}
const isImageBusy = computed(() => !!props.data?.loading || imageGen.loading.value || !!imageActionLoading.value)
const isToolBusy = computed(() => imageTools.loading.value || !!toolActionLoading.value)
const uploadProgressStyle = computed(() => {
  const percent = Math.max(0, Math.min(100, uploadProgress.value))
  const color =
    uploadStage.value === 'error'
      ? '#c46a5c'
      : uploadStage.value === 'success'
        ? '#8b9272'
        : '#d8dbe0'
  return {
    width: `${percent}%`,
    background: color
  }
})
watch(
  () => props.data?.loading,
  (loadingNow) => {
    if (loadingNow) {
      startProgress()
      return
    }
    if (props.data?.error) {
      clearProgressTimers()
      showProgress.value = false
      progressValue.value = 0
      return
    }
    if (showProgress.value) finishProgress()
  },
  { immediate: true }
)

watch(showPreviewModal, (visible) => {
  if (visible) {
    previewZoom.value = 1
    window.addEventListener('resize', syncPreviewStageSize)
    nextTick(() => {
      syncPreviewStageSize()
      centerPreviewViewport()
    })
    return
  }
  window.removeEventListener('resize', syncPreviewStageSize)
  window.removeEventListener('mousemove', onCropPointerMove)
  window.removeEventListener('mouseup', stopCropInteraction)
})

watch(activeTool, (tool) => {
  if (tool === 'crop') {
    window.addEventListener('keydown', handleCropKeydown)
    return
  }
  window.removeEventListener('keydown', handleCropKeydown)
})

onUnmounted(() => clearProgressTimers())

const beforeUnloadGuard = (event) => {
  if (!isUploading.value) return
  event.preventDefault()
  event.returnValue = 'Image upload is still in progress. Leaving now may lose it.'
}

watch(isUploading, (uploading) => {
  if (uploading) {
    window.addEventListener('beforeunload', beforeUnloadGuard)
  } else {
    window.removeEventListener('beforeunload', beforeUnloadGuard)
  }
})

onUnmounted(() => {
  window.removeEventListener('beforeunload', beforeUnloadGuard)
  window.removeEventListener('mousemove', onCropPointerMove)
  window.removeEventListener('mouseup', stopCropInteraction)
  window.removeEventListener('keydown', handleCropKeydown)
  window.removeEventListener('resize', syncPreviewStageSize)
  clearLocalPreviewUrl()
})

const triggerUpload = () => {
  if (isUploading.value) return
  uploadInputRef.value?.click()
}

const pickNearestSizeKey = (ratioKey, resolutionKey) => {
  let candidates = sizeMetaOptions.value.filter((opt) => opt.ratio === ratioKey)
  if (candidates.length === 0) candidates = sizeMetaOptions.value
  if (candidates.length === 0) return DEFAULT_IMAGE_SIZE
  const exact = candidates.find((opt) => opt.resolutionKey === resolutionKey)
  const picked = exact || [...candidates].sort((a, b) => a.pixels - b.pixels)[0]
  localImageRatio.value = picked.ratio
  localResolution.value = picked.resolutionKey
  return picked.key
}

const findNearestSizeKey = (ratioKey, resolutionKey) => {
  let candidates = sizeMetaOptions.value.filter((opt) => opt.ratio === ratioKey)
  if (candidates.length === 0) candidates = sizeMetaOptions.value
  if (candidates.length === 0) return DEFAULT_IMAGE_SIZE
  const exact = candidates.find((opt) => opt.resolutionKey === resolutionKey)
  return (exact || [...candidates].sort((a, b) => a.pixels - b.pixels)[0]).key
}

const setImageModel = (key) => {
  localImageModel.value = key
  const config = getModelConfig(key)
  localImageSize.value = config?.defaultParams?.size || localImageSize.value || DEFAULT_IMAGE_SIZE
  localImageQuality.value = config?.defaultParams?.quality || localImageQuality.value
  localImageRatio.value = ratioFromSizeKey(localImageSize.value)
  localResolution.value = resolutionFromSizeKey(localImageSize.value)
  localImageSize.value = pickNearestSizeKey(localImageRatio.value, localResolution.value)
  updateNode(props.id, {
    model: localImageModel.value,
    size: localImageSize.value,
    quality: localImageQuality.value,
    ratio: localImageRatio.value,
    resolution: localResolution.value
  })
}

const setImageRatio = (ratioKey) => {
  localImageSize.value = pickNearestSizeKey(ratioKey, localResolution.value)
  updateNode(props.id, {
    size: localImageSize.value,
    ratio: localImageRatio.value,
    resolution: localResolution.value
  })
}

const setResolution = (resolutionKey) => {
  localImageSize.value = pickNearestSizeKey(localImageRatio.value, resolutionKey)
  updateNode(props.id, {
    size: localImageSize.value,
    ratio: localImageRatio.value,
    resolution: localResolution.value
  })
}

const getConnectedInputs = () => {
  const resolved = resolveNodeInputs(props.id)
  return {
    prompt: resolved.prompt,
    refImages: resolved.refImages
  }
}
const activeImageInputSet = computed(() => {
  const incoming = edges.value.filter((edge) => edge.target === props.id)
  const activeKeys = []

  for (const edge of incoming) {
    const source = nodes.value.find((node) => node.id === edge.source)
    if (!source) continue
    if (source.type === 'text' && String(source.data?.content || '').trim()) activeKeys.push('prompt')
    if (source.type === 'image' && String(source.data?.url || source.data?.base64 || '').trim()) activeKeys.push('reference')
  }

  return new Set(activeKeys)
})
const imageInputStatusList = computed(() => ([
  { key: 'prompt', label: imageInputStatusMap.prompt, active: activeImageInputSet.value.has('prompt') },
  { key: 'reference', label: imageInputStatusMap.reference, active: activeImageInputSet.value.has('reference') }
]))

const resolveImageOutputUrl = async (rawValue, fileName, persistenceFailureMessage) => {
  const rawUrl = String(rawValue || '').trim()
  if (!rawUrl) {
    throw new Error('No image output')
  }

  try {
    const stableUrl = await persistImageUrl(rawUrl, fileName)
    if (stableUrl) return stableUrl
  } catch (error) {
    if (!rawUrl.startsWith('data:image/') && /^https?:\/\//i.test(rawUrl)) {
      console.warn('Image persistence failed, using remote URL fallback:', error)
      return rawUrl
    }
    throw error
  }

  if (rawUrl.startsWith('data:image/')) {
    throw new Error(persistenceFailureMessage)
  }

  return rawUrl
}

const runImageGeneration = async (mode = 'create') => {
  if (!isConfigured.value) {
    window.$message?.warning('Please sign in first')
    return
  }

  const { prompt, refImages } = getConnectedInputs()
  const selfImage = props.data?.base64 || props.data?.url
  const mergedRefs = [...refImages]
  if (selfImage) mergedRefs.unshift(selfImage)

  if (!prompt && mergedRefs.length === 0) {
    window.$message?.warning('Connect a text node or provide a reference image')
    return
  }

  imageActionLoading.value = mode
  updateNode(props.id, { loading: true, error: '' })
  try {
    const result = await imageGen.generate({
      model: localImageModel.value,
      prompt: prompt || 'Generate a polished visual based on this reference.',
      size: localImageSize.value,
      quality: localImageQuality.value,
      ratio: localImageRatio.value,
      aspect_ratio: localImageRatio.value,
      resolution: localResolution.value,
      image: mergedRefs
    })

    if (!result?.[0]?.url) {
      throw new Error('No image output')
    }

    const finalUrl = await resolveImageOutputUrl(
      result[0].url,
      `generated-${Date.now()}.png`,
      'Generated image persistence failed. Please retry.'
    )

    updateNode(props.id, {
      url: finalUrl,
      base64: '',
      loading: false,
      model: localImageModel.value,
      size: localImageSize.value,
      quality: localImageQuality.value,
      ratio: localImageRatio.value,
      resolution: localResolution.value,
      updatedAt: Date.now()
    })
    const savedOk = await saveProject()
    if (!savedOk) {
      window.$message?.warning('Image generated, but project save failed. Refresh may lose this image.')
    }
    window.$message?.success(mode === 'regenerate' ? 'Image regenerated' : 'Image generated')
  } catch (err) {
    const message = getErrorMessage(err, 'Image generation failed')
    updateNode(props.id, { loading: false, error: message })
    window.$message?.error(message)
  } finally {
    imageActionLoading.value = ''
  }
}
const handleStopGeneration = () => {
  // Clear timers and reset UI
  clearProgressTimers()
  showProgress.value = false
  progressValue.value = 0
  imageActionLoading.value = ''
  
  // Reset node state
  updateNode(props.id, { loading: false, error: 'Generation stopped' })
  window.$message?.info('Generation stopped')
  
  // Note: Actual API cancellation would require AbortController support in useImageGeneration
}

const handleGenerateImage = () => runImageGeneration('create')
const handleRegenerateImage = () => runImageGeneration('regenerate')

const getImageDimensions = (file) =>
  new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      resolve({ width: img.width || 0, height: img.height || 0 })
      URL.revokeObjectURL(objectUrl)
    }
    img.onerror = () => {
      resolve({ width: 0, height: 0 })
      URL.revokeObjectURL(objectUrl)
    }
    img.src = objectUrl
  })

const initializeCropRect = () => {
  const width = cropStageMetrics.value.frameWidth
  const height = cropStageMetrics.value.frameHeight
  if (!width || !height) return
  const nextWidth = Math.round(width * 0.72)
  const nextHeight = Math.round(height * 0.72)
  cropRect.value = {
    x: Math.round((width - nextWidth) / 2),
    y: Math.round((height - nextHeight) / 2),
    width: nextWidth,
    height: nextHeight
  }
}

const normalizeCropRect = (nextRect) => {
  const maxWidth = cropStageMetrics.value.frameWidth
  const maxHeight = cropStageMetrics.value.frameHeight
  const width = Math.max(MIN_CROP_SIZE, Math.min(nextRect.width, maxWidth))
  const height = Math.max(MIN_CROP_SIZE, Math.min(nextRect.height, maxHeight))
  const x = Math.max(0, Math.min(nextRect.x, Math.max(0, maxWidth - width)))
  const y = Math.max(0, Math.min(nextRect.y, Math.max(0, maxHeight - height)))
  return { x, y, width, height }
}

const startCropMode = async () => {
  if (!props.data?.url) return
  showPreviewModal.value = false
  activeTool.value = 'crop'
  await nextTick()
  initializeCropRect()
}

const cancelCropMode = () => {
  activeTool.value = ''
  cropInteraction.value = null
  window.removeEventListener('mousemove', onCropPointerMove)
  window.removeEventListener('mouseup', stopCropInteraction)
}

function handleCropKeydown(event) {
  if (activeTool.value !== 'crop') return
  if (event.key === 'Escape') {
    event.preventDefault()
    cancelCropMode()
    return
  }
  if (event.key === 'Enter') {
    event.preventDefault()
    applyCrop()
  }
}

const startCropDrag = (event) => {
  cropInteraction.value = {
    type: 'drag',
    startPointerX: event.clientX,
    startPointerY: event.clientY,
    startRect: { ...cropRect.value }
  }
  window.addEventListener('mousemove', onCropPointerMove)
  window.addEventListener('mouseup', stopCropInteraction)
}

const startCropResize = (handle, event) => {
  cropInteraction.value = {
    type: 'resize',
    handle,
    startPointerX: event.clientX,
    startPointerY: event.clientY,
    startRect: { ...cropRect.value }
  }
  window.addEventListener('mousemove', onCropPointerMove)
  window.addEventListener('mouseup', stopCropInteraction)
}

function onCropPointerMove(event) {
  const current = cropInteraction.value
  if (!current) return

  const deltaX = event.clientX - current.startPointerX
  const deltaY = event.clientY - current.startPointerY

  if (current.type === 'drag') {
    cropRect.value = normalizeCropRect({
      x: current.startRect.x + deltaX,
      y: current.startRect.y + deltaY,
      width: current.startRect.width,
      height: current.startRect.height
    })
    return
  }

  if (current.type === 'resize') {
    const nextRect = { ...current.startRect }
    if (current.handle.includes('n')) {
      nextRect.y = current.startRect.y + deltaY
      nextRect.height = current.startRect.height - deltaY
    }
    if (current.handle.includes('s')) {
      nextRect.height = current.startRect.height + deltaY
    }
    if (current.handle.includes('w')) {
      nextRect.x = current.startRect.x + deltaX
      nextRect.width = current.startRect.width - deltaX
    }
    if (current.handle.includes('e')) {
      nextRect.width = current.startRect.width + deltaX
    }
    cropRect.value = normalizeCropRect(nextRect)
  }
}

function stopCropInteraction() {
  cropInteraction.value = null
  window.removeEventListener('mousemove', onCropPointerMove)
  window.removeEventListener('mouseup', stopCropInteraction)
}

const computeRatioLabel = (width, height) => {
  if (!width || !height) return '1:1'
  const gcd = (a, b) => (b ? gcd(b, a % b) : a)
  const divisor = gcd(width, height)
  return `${Math.round(width / divisor)}:${Math.round(height / divisor)}`
}

const createLinkedImageNode = (payload = {}) => {
  const currentNode = nodes.value.find((node) => node.id === props.id)
  if (!currentNode) return null

  const stageWidth = Number.parseFloat(stageStyle.value.width) || 320
  const moduleWidth = stageWidth + 2
  const gapX = 172
  const nextPosition = {
    x: currentNode.position.x + moduleWidth + gapX,
    y: currentNode.position.y
  }

  const newNodeId = addNode('image', nextPosition, {
    model: payload.model || localImageModel.value,
    quality: payload.quality || localImageQuality.value,
    size: payload.size || localImageSize.value,
    ratio: payload.ratio || localImageRatio.value,
    resolution: payload.resolution || localResolution.value,
    url: payload.url || '',
    base64: payload.base64 || '',
    fileType: payload.fileType || 'image/png',
    label: payload.label || 'Image',
    loading: !!payload.loading,
    sourceConfigId: payload.sourceConfigId || '',
    sourcePrompt: payload.sourcePrompt || '',
    sourceRefImages: Array.isArray(payload.sourceRefImages) ? payload.sourceRefImages : [],
    error: '',
    updatedAt: Date.now()
  })

  addEdge(edgeStrategy.resolve({
    source: props.id,
    target: newNodeId,
    sourceHandle: 'right',
    targetHandle: 'left'
  }))

  nodes.value = nodes.value.map((node) => ({
    ...node,
    selected: node.id === newNodeId,
    data: {
      ...(node.data || {}),
      selected: node.id === newNodeId
    }
  }))

  setTimeout(() => {
    updateNodeInternals(props.id)
    updateNodeInternals(newNodeId)
  }, 60)

  return newNodeId
}

const updateLinkedImageNode = async (nodeId, payload = {}) => {
  if (!nodeId) return
  const patch = {
    model: payload.model || localImageModel.value,
    quality: payload.quality || localImageQuality.value,
    size: payload.size || localImageSize.value,
    ratio: payload.ratio || localImageRatio.value,
    resolution: payload.resolution || localResolution.value,
    url: payload.url || '',
    base64: payload.base64 || '',
    fileType: payload.fileType || 'image/png',
    loading: !!payload.loading,
    sourceConfigId: payload.sourceConfigId || '',
    sourcePrompt: payload.sourcePrompt || '',
    sourceRefImages: Array.isArray(payload.sourceRefImages) ? payload.sourceRefImages : [],
    error: payload.error || '',
    updatedAt: Date.now()
  }
  if (payload.label) patch.label = payload.label
  updateNode(nodeId, patch)
  setTimeout(() => updateNodeInternals(nodeId), 40)
  if (!payload.loading) {
    await flushSave()
  }
}

const replaceCurrentImageNode = async (payload = {}) => {
  const nextUrl = String(payload.url || '').trim()
  const nextBase64 = String(payload.base64 || '').trim()
  const nextSize = String(payload.size || localImageSize.value || '').trim()
  const nextRatio = String(payload.ratio || localImageRatio.value || '').trim()
  const nextResolution = String(payload.resolution || localResolution.value || '').trim()

  localImageSize.value = nextSize || localImageSize.value
  localImageRatio.value = nextRatio || localImageRatio.value
  localResolution.value = nextResolution || localResolution.value

  updateNode(props.id, {
    url: nextUrl || nextBase64,
    base64: nextBase64,
    size: localImageSize.value,
    ratio: localImageRatio.value,
    resolution: localResolution.value,
    fileType: payload.fileType || 'image/png',
    updatedAt: Date.now(),
    error: ''
  })

  setTimeout(() => updateNodeInternals(props.id), 30)

  const persistFileName = payload.fileName || `crop-${Date.now()}.png`
  const uploadTarget = nextBase64 || nextUrl
  const file = dataUrlToFile(uploadTarget, persistFileName)
  if (isLocalPreviewMode.value) {
    await flushSave()
    return
  }
  if (!file) {
    await flushSave()
    return
  }

  try {
    const uploadedUrl = await uploadImageFile(file)
    if (uploadedUrl) {
      updateNode(props.id, {
        url: uploadedUrl,
        base64: '',
        updatedAt: Date.now(),
        error: ''
      })
    }
    await flushSave()
  } catch (err) {
    console.warn('Crop persistence failed:', err)
    await flushSave()
  }
}

const resetUploadProgress = (delayMs = 1500) => {
  setTimeout(() => {
    if (uploadStage.value === 'success' || uploadStage.value === 'error') {
      showUploadProgress.value = false
      uploadProgress.value = 0
      uploadStage.value = 'idle'
    }
  }, delayMs)
}

const handleFileUpload = async (event) => {
  const file = event.target.files?.[0]
  if (!file) return

  try {
    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      validationMessage.value = 'Image is too large. Maximum file size is 30MB.'
      showValidationModal.value = true
      return
    }

    const { width: w, height: h } = await getImageDimensions(file)
    if (w > MAX_IMAGE_DIMENSION || h > MAX_IMAGE_DIMENSION) {
      validationMessage.value = `Image resolution is too high (${w}x${h}). Maximum supported resolution is 6144x6144.`
      showValidationModal.value = true
      return
    }

    // Keep local preview light with a blob URL, then upload the original file directly.
    const previewUrl = URL.createObjectURL(file)
    let ratio = '1:1'
    
    if (w && h) {
      const r = w / h
      if (Math.abs(r - 1) < 0.05) ratio = '1:1'
      else if (Math.abs(r - 16 / 9) < 0.05) ratio = '16:9'
      else if (Math.abs(r - 9 / 16) < 0.05) ratio = '9:16'
      else if (Math.abs(r - 3 / 2) < 0.05) ratio = '3:2'
      else if (Math.abs(r - 2 / 3) < 0.05) ratio = '2:3'
      else if (Math.abs(r - 4 / 3) < 0.05) ratio = '4:3'
      else if (Math.abs(r - 3 / 4) < 0.05) ratio = '3:4'
      else if (Math.abs(r - 4 / 5) < 0.05) ratio = '4:5'
      else if (Math.abs(r - 5 / 4) < 0.05) ratio = '5:4'
      else if (Math.abs(r - 21 / 9) < 0.05) ratio = '21:9'
      else ratio = `${w}:${h}` // Custom ratio for non-standard sizes
    }

    replaceLocalPreviewUrl(previewUrl)
    updateNode(props.id, {
      url: previewUrl,
      base64: '',
      fileName: file.name,
      fileType: file.type,
      label: 'Image',
      updatedAt: Date.now(),
      loading: false,
      error: '',
      ratio: ratio,
      size: w && h ? `${w}x${h}` : localImageSize.value
    })
    localImageRatio.value = ratio
    if (w && h) {
      localImageSize.value = `${w}x${h}`
    }
    
    setTimeout(() => updateNodeInternals(props.id), 30)

    if (isLocalPreviewMode.value) {
      await flushSave()
      showUploadProgress.value = true
      uploadStage.value = 'success'
      uploadProgress.value = 100
      isUploading.value = false
      window.$message?.success('Image uploaded locally')
      resetUploadProgress(900)
      return
    }

    // Upload + project save must both succeed before image is safe across refresh/login.
    isUploading.value = true
    showUploadProgress.value = true
    uploadStage.value = 'uploading'
    uploadProgress.value = 3
    try {
      const uploadedUrl = await uploadImageFile(file, {
        onProgress: (percent) => {
          uploadStage.value = 'uploading'
          uploadProgress.value = Math.max(uploadProgress.value, Math.min(92, percent))
        }
      })
      if (uploadedUrl) {
        uploadStage.value = 'saving'
        uploadProgress.value = Math.max(uploadProgress.value, 95)
        clearLocalPreviewUrl()
        updateNode(props.id, {
          url: uploadedUrl,
          base64: '',
          fileName: file.name,
          fileType: file.type,
          updatedAt: Date.now(),
          error: ''
        })
        const savedOk = await flushSave()
        if (savedOk) {
          uploadStage.value = 'success'
          uploadProgress.value = 100
          window.$message?.success('Upload complete and saved')
          resetUploadProgress(900)
        } else {
          uploadStage.value = 'error'
          uploadProgress.value = 100
          window.$message?.warning('Project save failed after upload. Please retry save.')
          resetUploadProgress(2200)
        }
      } else {
        uploadStage.value = 'error'
        uploadProgress.value = 100
        window.$message?.warning('Cloud upload failed. Please retry.')
        resetUploadProgress(2200)
      }
    } catch (err) {
      uploadStage.value = 'error'
      uploadProgress.value = 100
      window.$message?.warning('Upload/save failed. Please retry.')
      resetUploadProgress(2200)
    } finally {
      isUploading.value = false
    }
  } catch (err) {
    const message = getErrorMessage(err, 'Image upload failed')
    updateNode(props.id, { loading: false, error: message })
    window.$message?.error(message)
  } finally {
    if (event?.target) event.target.value = ''
  }
}

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
  if (!props.data?.url) return
  activeTool.value = ''
  previewZoom.value = 1
  showPreviewModal.value = true
}
const handleToolAction = async (key) => {
  if (key === 'replace-image') {
    triggerUpload()
    return
  }
  if (key === 'remove-background') {
    await handleRemoveBackground()
    return
  }
  if (key === 'crop') {
    await startCropMode()
    return
  }
  if (key === 'enhance-4k') {
    await handleEnhanceTo4k()
    return
  }
  if (key === 'multi-angle') {
    showMultiAngleDrawer.value = true
  }
}

const getNodeById = (nodeId) => nodes.value.find((node) => node.id === nodeId)

const findNearestSourceConfig = (startNodeId, visited = new Set()) => {
  const safeId = String(startNodeId || '').trim()
  if (!safeId || visited.has(safeId)) return null
  visited.add(safeId)

  const directConfig = getNodeById(safeId)?.data?.sourceConfigId
  if (directConfig) {
    const sourceNode = getNodeById(directConfig)
    if (sourceNode?.type === 'imageConfig') return sourceNode
  }

  const incomingEdges = edges.value.filter((edge) => edge.target === safeId)
  for (const edge of incomingEdges) {
    const sourceNode = getNodeById(edge.source)
    if (!sourceNode) continue
    if (sourceNode.type === 'imageConfig') return sourceNode
    if (sourceNode.type === 'image') {
      const nested = findNearestSourceConfig(sourceNode.id, visited)
      if (nested) return nested
    }
  }

  return null
}

const buildEnhancementRequest = () => {
  const sourceConfig = findNearestSourceConfig(props.id)
  const inheritedPrompt = String(props.data?.sourcePrompt || '').trim()
  const inheritedRefs = Array.isArray(props.data?.sourceRefImages)
    ? props.data.sourceRefImages.filter(Boolean)
    : []

  let prompt = inheritedPrompt
  let refImages = inheritedRefs

  if (sourceConfig?.id) {
    const resolved = resolveNodeInputs(sourceConfig.id)
    prompt = String(resolved.prompt || inheritedPrompt).trim()
    refImages = Array.isArray(resolved.refImages) && resolved.refImages.length > 0
      ? resolved.refImages.filter(Boolean)
      : inheritedRefs
  }

  if (!prompt && refImages.length === 0) {
    return null
  }

  const ratio = String(
    sourceConfig?.data?.ratio ||
    props.data?.ratio ||
    localImageRatio.value ||
    ratioFromSizeKey(localImageSize.value) ||
    '1:1'
  ).trim()

  const baseSize = String(
    sourceConfig?.data?.size ||
    props.data?.size ||
    localImageSize.value ||
    DEFAULT_IMAGE_SIZE
  ).trim()

  const nextSize = findNearestSizeKey(ratio, '4k')

  return {
    model: String(
      sourceConfig?.data?.model ||
      props.data?.model ||
      localImageModel.value ||
      DEFAULT_IMAGE_MODEL
    ).trim(),
    prompt,
    size: nextSize || baseSize,
    quality: String(
      sourceConfig?.data?.quality ||
      props.data?.quality ||
      localImageQuality.value ||
      'standard'
    ).trim(),
    ratio,
    aspect_ratio: ratio,
    resolution: '4k',
    image: refImages,
    sourceConfigId: sourceConfig?.id || props.data?.sourceConfigId || '',
    sourcePrompt: prompt,
    sourceRefImages: refImages
  }
}

const handleEnhanceTo4k = async () => {
  const request = buildEnhancementRequest()
  if (!request) {
    window.$message?.warning('No reusable prompt or reference chain found for 4K enhancement')
    return
  }

  toolActionLoading.value = 'enhance-4k'
  const newNodeId = createLinkedImageNode({
    loading: true,
    label: '4K Enhanced Image',
    model: request.model,
    size: request.size,
    quality: request.quality,
    ratio: request.ratio,
    resolution: request.resolution,
    sourceConfigId: request.sourceConfigId,
    sourcePrompt: request.sourcePrompt,
    sourceRefImages: request.sourceRefImages
  })
  if (!newNodeId) {
    toolActionLoading.value = ''
    window.$message?.error('Failed to create output node')
    return
  }

  try {
    const result = await imageGen.generate(request)
    const finalUrl = await resolveImageOutputUrl(
      result?.[0]?.url,
      `enhanced-4k-${Date.now()}.png`,
      'Enhanced image persistence failed. Please retry.'
    )

    await updateLinkedImageNode(newNodeId, {
      url: finalUrl,
      base64: '',
      loading: false,
      fileType: 'image/png',
      size: request.size,
      ratio: request.ratio,
      resolution: request.resolution,
      sourceConfigId: request.sourceConfigId,
      sourcePrompt: request.sourcePrompt,
      sourceRefImages: request.sourceRefImages
    })

    window.$message?.success('4K enhanced image created')
  } catch (err) {
    const message = getErrorMessage(err, '4K enhancement failed')
    await updateLinkedImageNode(newNodeId, {
      loading: false,
      error: message,
      size: request.size,
      ratio: request.ratio,
      resolution: request.resolution,
      sourceConfigId: request.sourceConfigId,
      sourcePrompt: request.sourcePrompt,
      sourceRefImages: request.sourceRefImages
    })
    window.$message?.error(message)
  } finally {
    toolActionLoading.value = ''
  }
}
const handleRemoveBackground = async () => {
  const source = String(props.data?.base64 || props.data?.url || '').trim()
  if (!source) return

  toolActionLoading.value = 'remove-background'
  try {
    const result = await imageTools.removeBg({
      image: source,
      size: 'full',
      format: 'png',
      channels: 'rgba',
      crop: false,
      despill: false
    })
    const finalUrl = await resolveImageOutputUrl(
      result?.url,
      `remove-bg-${Date.now()}.png`,
      'Background removal persistence failed. Please retry.'
    )

    createLinkedImageNode({
      url: finalUrl,
      base64: '',
      size: props.data?.size || localImageSize.value,
      ratio: props.data?.ratio || localImageRatio.value,
      resolution: props.data?.resolution || localResolution.value,
      fileType: 'image/png',
    })
    await flushSave()
    window.$message?.success('Background removed and linked')
  } catch (err) {
    window.$message?.error(err?.message || 'Background removal failed')
  } finally {
    toolActionLoading.value = ''
  }
}
const loadImageElement = async (source) => {
  const img = new Image()
  img.decoding = 'async'
  let objectUrl = ''
  const resolvedSource = String(source || '').trim()
  if (!resolvedSource) throw new Error('No image source')

  if (!resolvedSource.startsWith('data:image/')) {
    try {
      const response = await fetch(createAuthenticatedMediaProxyUrl(resolvedSource) || resolvedSource)
      const blob = await response.blob()
      objectUrl = URL.createObjectURL(blob)
      img.src = objectUrl
    } catch {
      img.crossOrigin = 'anonymous'
      img.src = resolvedSource
    }
  } else {
    img.src = resolvedSource
  }

  await new Promise((resolve, reject) => {
    img.onload = resolve
    img.onerror = reject
  })

  return {
    img,
    cleanup: () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }
}

const applyCrop = async () => {
  const source = String(props.data?.base64 || props.data?.url || '').trim()
  if (!source) return

  toolActionLoading.value = 'crop'
  let loadedImage = null

  try {
    loadedImage = await loadImageElement(source)
    const naturalWidth = loadedImage.img.naturalWidth || cropStageMetrics.value.naturalWidth || 1
    const naturalHeight = loadedImage.img.naturalHeight || cropStageMetrics.value.naturalHeight || 1
    const scale = cropStageMetrics.value.scale || 1
    const sourceX = Math.max(0, Math.round((cropRect.value.x - cropStageMetrics.value.offsetX) / scale))
    const sourceY = Math.max(0, Math.round((cropRect.value.y - cropStageMetrics.value.offsetY) / scale))
    const cropX = Math.min(naturalWidth - 1, sourceX)
    const cropY = Math.min(naturalHeight - 1, sourceY)
    const cropWidth = Math.max(1, Math.min(naturalWidth - cropX, Math.round(cropRect.value.width / scale)))
    const cropHeight = Math.max(1, Math.min(naturalHeight - cropY, Math.round(cropRect.value.height / scale)))

    const canvas = document.createElement('canvas')
    canvas.width = cropWidth
    canvas.height = cropHeight
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Crop canvas unavailable')

    context.drawImage(loadedImage.img, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight)

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
    if (!blob) throw new Error('Crop output failed')

    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || ''))
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })

    const inlineResult = String(dataUrl || '')
    await replaceCurrentImageNode({
      url: inlineResult,
      base64: inlineResult,
      size: `${cropWidth}x${cropHeight}`,
      ratio: computeRatioLabel(cropWidth, cropHeight),
      resolution: resolutionFromSizeKey(`${cropWidth}x${cropHeight}`),
      fileType: 'image/png',
      fileName: `crop-${Date.now()}.png`
    })
    cancelCropMode()
    window.$message?.success('Crop applied')
  } catch (err) {
    window.$message?.error(err?.message || 'Crop failed')
  } finally {
    loadedImage?.cleanup?.()
    toolActionLoading.value = ''
  }
}
const handlePreviewImageLoad = (event) => {
  const target = event?.target
  if (!target) return
  previewNaturalSize.value = {
    width: Number(target.naturalWidth) || 0,
    height: Number(target.naturalHeight) || 0
  }
  nextTick(() => {
    syncPreviewStageSize()
    if (showPreviewModal.value) centerPreviewViewport()
  })
  if (activeTool.value === 'crop') {
    initializeCropRect()
  }
}
const getPreviewDownloadFilename = () => {
  const rawLabel = String(props.data?.label || 'image-preview').trim()
  const safeLabel = rawLabel.replace(/[^a-zA-Z0-9-_]+/g, '-').replace(/^-+|-+$/g, '') || 'image-preview'
  let extension = 'png'

  try {
    const sourceUrl = new URL(String(props.data?.url || ''), window.location.origin)
    const match = sourceUrl.pathname.match(/\.([a-zA-Z0-9]+)$/)
    if (match?.[1]) extension = match[1].toLowerCase()
  } catch {
    extension = 'png'
  }

  return `${safeLabel}.${extension}`
}
const triggerPreviewDownload = (href, filename) => {
  const link = document.createElement('a')
  link.href = href
  link.download = filename
  link.rel = 'noopener'
  link.target = '_blank'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
const downloadPreviewImage = async () => {
  const sourceUrl = displayImageUrl.value
  if (!sourceUrl) return

  const filename = getPreviewDownloadFilename()
  try {
    const response = await fetch(sourceUrl)
    if (!response.ok) throw new Error(`Download failed: ${response.status}`)
    const blob = await response.blob()
    const objectUrl = URL.createObjectURL(blob)
    triggerPreviewDownload(objectUrl, filename)
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
  } catch {
    triggerPreviewDownload(sourceUrl, filename)
  }
}
const syncPreviewStageSize = () => {
  const stage = previewStageRef.value
  if (!stage) return
  const width = Number(stage.clientWidth) || 0
  const height = Number(stage.clientHeight) || 0
  if (previewStageSize.value.width === width && previewStageSize.value.height === height) return
  previewStageSize.value = { width, height }
}
const centerPreviewViewport = () => {
  const stage = previewStageRef.value
  if (!stage) return
  const canvasWidth = Math.max(previewViewportSize.value.width, previewRenderedSize.value.width)
  const canvasHeight = Math.max(previewViewportSize.value.height, previewRenderedSize.value.height)
  const targetLeft = Math.max(0, canvasWidth - stage.clientWidth) / 2
  const targetTop = Math.max(0, canvasHeight - stage.clientHeight) / 2
  stage.scrollLeft = targetLeft
  stage.scrollTop = targetTop
}
const setPreviewZoom = (nextZoom) => {
  const normalizedZoom = Math.max(PREVIEW_MIN_ZOOM, Math.min(PREVIEW_MAX_ZOOM, Number(nextZoom.toFixed(2))))
  if (normalizedZoom === previewZoom.value) return

  const stage = previewStageRef.value
  const previousCanvasWidth = Math.max(previewViewportSize.value.width, previewRenderedSize.value.width)
  const previousCanvasHeight = Math.max(previewViewportSize.value.height, previewRenderedSize.value.height)
  if (!stage) {
    previewZoom.value = normalizedZoom
    return
  }

  const viewportCenterX = stage.scrollLeft + (stage.clientWidth / 2)
  const viewportCenterY = stage.scrollTop + (stage.clientHeight / 2)
  const focusX = previousCanvasWidth > 0 ? viewportCenterX / previousCanvasWidth : 0.5
  const focusY = previousCanvasHeight > 0 ? viewportCenterY / previousCanvasHeight : 0.5

  previewZoom.value = normalizedZoom

  nextTick(() => {
    const nextCanvasWidth = Math.max(previewViewportSize.value.width, previewRenderedSize.value.width)
    const nextCanvasHeight = Math.max(previewViewportSize.value.height, previewRenderedSize.value.height)
    const targetLeft = (nextCanvasWidth * focusX) - (stage.clientWidth / 2)
    const targetTop = (nextCanvasHeight * focusY) - (stage.clientHeight / 2)
    stage.scrollLeft = Math.max(0, targetLeft)
    stage.scrollTop = Math.max(0, targetTop)
  })
}
const zoomInPreview = () => {
  setPreviewZoom(previewZoom.value + PREVIEW_ZOOM_STEP)
}
const zoomOutPreview = () => {
  setPreviewZoom(previewZoom.value - PREVIEW_ZOOM_STEP)
}
const resetPreviewZoom = () => {
  setPreviewZoom(1)
}
const closeErrorModal = () => {
  showErrorModal.value = false
  updateNode(props.id, { error: '' })
}

const closeValidationModal = () => {
  showValidationModal.value = false
  validationMessage.value = ''
}

const handleMultiAngleApply = async (payload = {}) => {
  const nextPayload = {
    ...payload,
    fileName: `multi-angle-${Date.now()}.png`
  }

  try {
    if (payload.targetMode === 'replace') {
      await replaceCurrentImageNode(nextPayload)
      await flushSave()
      window.$message?.success('Multi-angle result applied')
    } else {
      if (pendingMultiAngleNodeId.value) {
        await updateLinkedImageNode(pendingMultiAngleNodeId.value, {
          ...nextPayload,
          loading: false,
          error: ''
        })
      } else {
        createLinkedImageNode(nextPayload)
        await flushSave()
      }
      window.$message?.success('Multi-angle result created')
    }
    pendingMultiAngleNodeId.value = ''
    showMultiAngleDrawer.value = false
  } catch (error) {
    window.$message?.error(error?.message || 'Multi-angle apply failed')
  }
}

const handleMultiAnglePending = async (payload = {}) => {
  if (payload.targetMode === 'replace') return
  if (pendingMultiAngleNodeId.value) return
  const nodeId = createLinkedImageNode({
    ...payload,
    loading: true,
    url: '',
    base64: '',
    error: ''
  })
  pendingMultiAngleNodeId.value = nodeId || ''
  await flushSave()
}

const handleMultiAngleError = async (payload = {}) => {
  if (!pendingMultiAngleNodeId.value) return
  const failedNodeId = pendingMultiAngleNodeId.value
  pendingMultiAngleNodeId.value = ''
  await updateLinkedImageNode(failedNodeId, {
    url: '',
    base64: '',
    loading: false,
    error: payload?.message || 'Multi-angle generation failed'
  })
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

.module-image-shell {
  width: 100%;
  height: 100%;
  padding: var(--module-inset);
  background: #050505;
}

.module-image-frame {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  border-radius: calc(var(--module-radius) - var(--module-inset));
}

.module-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: calc(var(--module-radius) - var(--module-inset));
}
.upload-progress-wrap {
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: 10px;
  z-index: 4;
  pointer-events: none;
}
.upload-progress-track {
  width: 100%;
  height: 3px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.12);
  overflow: hidden;
}
.upload-progress-bar {
  height: 100%;
  width: 0%;
  border-radius: inherit;
  transition: width 0.2s ease;
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

.upload-btn {
  margin-top: 4px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(255, 255, 255, 0.04);
  color: #d7dbe3;
  border-radius: 999px;
  font-size: 12px;
  padding: 6px 12px;
  line-height: 1;
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

.zoom-modal-card {
  width: min(1400px, calc(100vw - 80px));
  height: min(960px, calc(100vh - 80px));
  max-width: calc(100vw - 80px);
  max-height: calc(100vh - 80px);
  overflow: hidden;
  background: #121212;
  border: 1px solid rgba(143, 143, 143, 0.38);
  border-radius: 14px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.zoom-modal-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.zoom-modal-chip {
  display: inline-flex;
  align-items: center;
  min-width: 58px;
  height: 34px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.04);
  color: #f3f4f6;
  font-size: 12px;
}

.zoom-modal-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.zoom-modal-divider {
  width: 1px;
  height: 22px;
  background: rgba(255, 255, 255, 0.14);
}

.zoom-tool-btn {
  min-width: 38px;
  height: 34px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.04);
  color: #f3f4f6;
  font-size: 12px;
  transition: background 0.18s ease, border-color 0.18s ease, opacity 0.18s ease;
}

.zoom-tool-btn-download {
  gap: 8px;
  padding: 0 14px;
}

.zoom-tool-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.28);
}

.zoom-tool-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.zoom-tool-btn-primary {
  background: linear-gradient(180deg, #ece7e2 0%, #d5cdc5 100%);
  color: #111111;
  border-color: rgba(213, 205, 197, 0.92);
}

.zoom-tool-btn-primary:hover:not(:disabled) {
  background: linear-gradient(180deg, #f2eeea 0%, #ddd5ce 100%);
  border-color: rgba(221, 213, 206, 0.96);
}

.zoom-modal-stage {
  flex: 1;
  min-height: 0;
  overflow: auto;
  border-radius: 12px;
  background:
    linear-gradient(0deg, rgba(255, 255, 255, 0.02), rgba(255, 255, 255, 0.02)),
    linear-gradient(45deg, #171717 25%, transparent 25%, transparent 75%, #171717 75%, #171717),
    linear-gradient(45deg, #171717 25%, #0f0f0f 25%, #0f0f0f 75%, #171717 75%, #171717);
  background-size: auto, 24px 24px, 24px 24px;
  background-position: 0 0, 0 0, 12px 12px;
  padding: 20px;
}

.zoom-stage-canvas {
  display: grid;
  place-items: center;
}

.zoom-image-wrap {
  position: relative;
  width: max-content;
  height: max-content;
}

.zoom-image-original {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: 12px;
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.4);
}

.crop-overlay {
  position: absolute;
  inset: 0;
}

.crop-overlay-inline {
  border-radius: inherit;
  overflow: hidden;
}

.crop-mask {
  position: absolute;
  background: rgba(0, 0, 0, 0.48);
  pointer-events: none;
}

.crop-box {
  position: absolute;
  border: 2px solid rgba(255, 255, 255, 0.92);
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.14);
  cursor: move;
}

.crop-box::before,
.crop-box::after {
  content: '';
  position: absolute;
  background: rgba(255, 255, 255, 0.26);
}

.crop-box::before {
  left: 33.333%;
  top: 0;
  width: 1px;
  height: 100%;
  box-shadow: calc(33.333% + 1px) 0 0 rgba(255, 255, 255, 0.26);
}

.crop-box::after {
  top: 33.333%;
  left: 0;
  width: 100%;
  height: 1px;
  box-shadow: 0 calc(33.333% + 1px) 0 rgba(255, 255, 255, 0.26);
}

.crop-handle {
  position: absolute;
  width: 14px;
  height: 14px;
  border-radius: 999px;
  background: #f3f4f6;
  border: 2px solid #111111;
}

.crop-handle-nw {
  left: -7px;
  top: -7px;
  cursor: nwse-resize;
}

.crop-handle-ne {
  right: -7px;
  top: -7px;
  cursor: nesw-resize;
}

.crop-handle-sw {
  left: -7px;
  bottom: -7px;
  cursor: nesw-resize;
}

.crop-handle-se {
  right: -7px;
  bottom: -7px;
  cursor: nwse-resize;
}

.crop-inline-tip {
  position: absolute;
  right: 12px;
  bottom: 12px;
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(18, 18, 18, 0.74);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: #f3f4f6;
  font-size: 11px;
  letter-spacing: 0.02em;
  pointer-events: none;
}

.capsule-tool-trigger {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.capsule-tool-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  filter: brightness(0) saturate(100%) invert(81%) sepia(6%) saturate(243%) hue-rotate(182deg) brightness(93%) contrast(88%);
}

:deep(.tool-option-icon) {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  filter: brightness(0) saturate(100%) invert(81%) sepia(6%) saturate(243%) hue-rotate(182deg) brightness(93%) contrast(88%);
}
</style>
