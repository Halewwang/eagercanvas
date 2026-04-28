<template>
  <div class="video-node-wrapper node-shell-wrapper" @mouseenter="showCapsule = true" @mouseleave="showCapsule = false">
    <div class="node-meta-row" @mousedown="handleMetaMouseDown">
      <n-icon :size="16" class="meta-icon"><VideocamOutline /></n-icon>
      <span class="meta-title">Video</span>
    </div>

    <div v-show="showNodeCapsule" class="capsule-menu absolute left-1/2 z-[1200]" :style="capsuleStyle">
        <div class="capsule-inner" :class="{ 'capsule-inner-selected': isSelected }">
        <div class="capsule-group">
          <BaseDropdown :options="modelOptions" compact @select="setModel"><button class="capsule-select">{{ displayModel }}</button></BaseDropdown>
          <BaseDropdown v-if="inputProfile.allowRatio" :options="ratioOptions" compact @select="setRatio"><button class="capsule-select">{{ localRatio }}</button></BaseDropdown>
          <BaseDropdown v-if="inputProfile.allowType && typeOptions.length > 0" :options="typeOptions" compact @select="setO1Type"><button class="capsule-select">{{ displayO1Type }}</button></BaseDropdown>
          <BaseDropdown v-if="inputProfile.allowMode && modeOptions.length > 0" :options="modeOptions" compact @select="setMode"><button class="capsule-select">{{ displayMode }}</button></BaseDropdown>
          <BaseDropdown v-if="inputProfile.allowSize && sizeOptions.length > 0" :options="sizeOptions" compact @select="setSize"><button class="capsule-select">{{ displaySize }}</button></BaseDropdown>
          <BaseDropdown v-if="inputProfile.allowResolution && resolutionOptions.length > 0" :options="resolutionOptions" compact @select="setResolution"><button class="capsule-select">{{ displayResolution }}</button></BaseDropdown>
          <BaseDropdown v-if="inputProfile.allowAudioToggle && supportsAudioToggle" :options="audioOptions" compact @select="setGenerateAudio"><button class="capsule-select">{{ displayAudio }}</button></BaseDropdown>
          <BaseDropdown v-if="inputProfile.allowDuration && durationOptions.length > 0" :options="durationOptions" compact @select="setDuration"><button class="capsule-select">{{ localDuration }}s</button></BaseDropdown>
        </div>

        <div class="capsule-divider" />

        <div class="capsule-group">
          <BaseDropdown :options="toolDropdownOptions" compact @select="handleToolAction">
            <button class="capsule-select capsule-tool-trigger" :disabled="isToolsDisabled">
              <img :src="toolsIcon" alt="" class="capsule-tool-icon" />
              <span>Tools</span>
            </button>
          </BaseDropdown>
          <button class="capsule-icon" :disabled="!displayVideoUrl" @click="openPreviewModal" title="Preview"><n-icon :size="14"><ExpandOutline /></n-icon></button>
          <button class="capsule-icon" @click="handleDuplicate" title="Duplicate"><n-icon :size="14"><CopyOutline /></n-icon></button>
          <button class="capsule-icon" @click="handleDelete" title="Delete"><n-icon :size="14"><TrashOutline /></n-icon></button>
        </div>
      </div>
      <div class="capsule-inner capsule-generate" :class="{ 'capsule-inner-selected': isSelected }">
        <button v-if="!isVideoBusy" class="capsule-icon capsule-icon-solid capsule-create" @click="handleGenerateVideo" title="Create">
          <img :src="createIcon" alt="" class="capsule-create-graphic" />
          <span class="capsule-create-label">Create</span>
        </button>
        <button v-if="!isVideoBusy" class="capsule-icon" @click="handleRegenerateVideo" title="Regenerate">
          <n-icon :size="14"><RefreshOutline /></n-icon>
        </button>
        <button v-if="isVideoBusy" class="capsule-icon capsule-icon-solid capsule-create" @click="handleStopGeneration" title="Stop">
          <n-icon :size="14"><CloseCircleOutline /></n-icon>
          <span class="capsule-create-label">Stop</span>
        </button>
      </div>
    </div>

    <div
      class="video-node rounded-2xl border relative transition-all duration-200 overflow-visible"
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
          <div class="module-progress-label">Generating video... {{ progressPercent }}%</div>
        </div>

        <div v-else-if="displayVideoUrl && !data.loading" class="module-video-shell">
          <div class="module-video-frame">
            <video
              v-if="isVideoInteractive"
              :src="displayVideoUrl"
              controls
              class="module-video"
            />
            <button
              v-else-if="showStaticVideoPreview"
              class="module-video-static-preview"
              type="button"
              @click="activateInlineVideoPreview"
            >
              <video
                :src="displayVideoUrl"
                muted
                playsinline
                preload="metadata"
                class="module-video-static-media"
              />
              <span class="module-video-play-badge">
                <n-icon :size="18"><VideocamOutline /></n-icon>
              </span>
              <span class="module-video-static-label">Preview video</span>
            </button>
          </div>
        </div>

        <div v-else class="w-full h-full bg-[#0f0f0f] flex flex-col items-center justify-center gap-4 relative text-center px-4">
          <div v-if="activeImageRoleSet.keys.size > 0" class="flex items-center gap-3">
            <div v-for="item in imageRoleStatusList.filter(i => i.active && i.previewUrl)" :key="item.key" class="flex flex-col items-center gap-1">
              <div class="w-16 h-16 rounded-lg overflow-hidden border border-[#2d2d2d] bg-black">
                <img :src="item.previewUrl" class="w-full h-full object-cover" />
              </div>
              <span class="text-[10px] text-[#7b818c]">{{ item.label }}</span>
            </div>
          </div>
          
          <div class="flex flex-col items-center gap-2">
            <n-icon :size="32" class="text-[#7b818c]"><VideocamOutline /></n-icon>
            <span class="text-sm text-[#7b818c]">{{ connectHint }}</span>
            <button class="upload-btn" @click="triggerUpload">Upload</button>
            <input ref="uploadInputRef" type="file" accept="video/*" class="hidden" @change="handleFileUpload" />
          </div>
        </div>
      </div>

      <Handle type="source" :position="Position.Right" id="right" :class="['node-handle-plus', 'node-handle-plus-right', { 'node-handle-plus-visible': showHandles }]" />
      <Handle type="target" :position="Position.Left" id="left" :class="['node-handle-plus', 'node-handle-plus-left', { 'node-handle-plus-visible': showHandles }]" />
    </div>

    <n-modal v-model:show="showPreviewModal" :mask-closable="true">
      <div class="zoom-modal-card" @click.stop>
        <video :src="displayVideoUrl" controls autoplay class="zoom-video-original" />
      </div>
    </n-modal>
    <BaseModal
      v-model:show="showErrorModal"
      title="Video Module Error"
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
      :title="validationTitle"
      size="sm"
    >
      <p class="ui-body ui-modal-copy whitespace-pre-wrap">{{ validationMessage }}</p>
      <template #footer>
        <div class="ui-modal-actions">
          <BaseButton @click="closeValidationModal">OK</BaseButton>
        </div>
      </template>
    </BaseModal>
    <VideoEnhanceToolDrawer
      v-model:show="showEnhanceDrawer"
      :video-url="displayVideoUrl || ''"
      :ratio="localRatio"
      :resolution="localResolution"
      @pending="handleEnhancePending"
      @apply="handleEnhanceApply"
      @error="handleEnhanceError"
    />

    <div v-if="showUploadProgress" class="upload-progress-wrap" :style="moduleStyle">
      <div class="upload-progress-track">
        <div class="upload-progress-bar" :style="uploadProgressStyle"></div>
      </div>
    </div>

    <div class="binding-status-wrap" :style="moduleStyle">
      <div class="binding-status-row">
        <div
          v-for="item in imageRoleStatusList"
          :key="item.key"
          class="binding-status-pill"
          :class="item.active ? 'binding-status-pill-active' : 'binding-status-pill-idle'"
        >
          {{ item.label }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onUnmounted, ref, watch } from 'vue'
import { Handle, Position, useVueFlow } from '@vue-flow/core'
import { NIcon, NModal } from 'naive-ui'
import { BaseButton, BaseDropdown, BaseModal } from '@/components/ui'
import VideoEnhanceToolDrawer from '@/components/tools/VideoEnhanceToolDrawer.vue'
import { CloseCircleOutline, CopyOutline, ExpandOutline, RefreshOutline, TrashOutline, VideocamOutline } from '@/icons/coolicons'
import { addEdge, addNode, currentProjectId, duplicateNode, edges, flushSave, nodes, removeNode, saveProject, updateNode } from '@/stores/canvas'
import { useApiConfig, useVideoGeneration } from '@/hooks'
import { DEFAULT_VIDEO_DURATION, DEFAULT_VIDEO_MODEL, DEFAULT_VIDEO_RATIO, getModelConfig, getModelDurationOptions, getModelRatioOptions, getModelVideoModeOptions, getModelVideoResolutionOptions, getModelVideoSizeOptions, getModelVideoTypeOptions, getVideoGenerationProfile, resolveSeedanceGenerationType, resolveVideoModelKey, videoModelOptions } from '@/stores/models'
import { createAuthenticatedMediaProxyUrl, persistMediaUrl, uploadImageFile } from '@/utils/media'
import { getVisibleVideoBindingStatusItems, shouldLoadInlineVideoPlayer, shouldRenderStaticVideoPreview } from '@/utils/videoPreview'
import { edgeStrategy, resolveNodeInputs } from '@/services/edgeStrategy'
import createIcon from '@/assets/create-icon.svg'
import toolsIcon from '@/assets/tools-icon.svg'

const props = defineProps({ id: String, data: Object, selected: Boolean })

const { updateNodeInternals } = useVueFlow()
const { isConfigured } = useApiConfig()
const videoGen = useVideoGeneration()

const showCapsule = ref(false)
const isSelected = computed(() => !!props.selected || !!props.data?.selected)
const showNodeCapsule = computed(() => !props.data?.suppressCapsule && (showCapsule.value || isSelected.value))
const showHandles = computed(() => showCapsule.value || isSelected.value)
const inlineVideoPreviewRequested = ref(false)
const isVideoInteractive = computed(() =>
  shouldLoadInlineVideoPlayer({
    hasVideoUrl: !!displayVideoUrl.value,
    previewRequested: inlineVideoPreviewRequested.value
  })
)
const showStaticVideoPreview = computed(() =>
  shouldRenderStaticVideoPreview({
    hasVideoUrl: !!displayVideoUrl.value,
    previewRequested: inlineVideoPreviewRequested.value
  })
)
const uploadInputRef = ref(null)
const showPreviewModal = ref(false)
const showErrorModal = ref(false)
const showValidationModal = ref(false)
const showEnhanceDrawer = ref(false)
const validationTitle = ref('Upload Limit')
const validationMessage = ref('')
const videoActionLoading = ref('')
const toolActionLoading = ref('')
const pendingEnhancedNodeId = ref('')
const isUploading = ref(false)
const showUploadProgress = ref(false)
const uploadProgress = ref(0)
const uploadStage = ref('idle')
const progressValue = ref(0)
const showProgress = ref(false)
const progressTimer = ref(null)
const progressFinishTimer = ref(null)
const MAX_UPLOAD_SIZE_BYTES = 60 * 1024 * 1024

const getInitialVideoModel = (data) => resolveVideoModelKey(data?.model || DEFAULT_VIDEO_MODEL)
const getInitialVideoConfig = (data) => getModelConfig(getInitialVideoModel(data))
const getInitialVideoMode = (data) => {
  const config = getInitialVideoConfig(data)
  const options = getModelVideoModeOptions(getInitialVideoModel(data))
  return String(data?.mode || config?.defaultParams?.mode || options[0]?.key || '').trim()
}
const getInitialVideoType = (data) => {
  const config = getInitialVideoConfig(data)
  const options = getModelVideoTypeOptions(getInitialVideoModel(data))
  return String(data?.o1_type || config?.defaultParams?.o1_type || options[0]?.key || '').trim()
}
const getInitialVideoAudio = (data) => {
  const config = getInitialVideoConfig(data)
  return Boolean(
    data?.generate_audio ??
    data?.enable_audio ??
    config?.defaultParams?.generate_audio ??
    config?.defaultParams?.enable_audio ??
    false
  )
}

const localModel = ref(getInitialVideoModel(props.data))
const localRatio = ref(props.data?.ratio || DEFAULT_VIDEO_RATIO)
const localSize = ref(props.data?.size || '')
const localResolution = ref('')
const localO1Type = ref(getInitialVideoType(props.data))
const localMode = ref(getInitialVideoMode(props.data))
const localGenerateAudio = ref(getInitialVideoAudio(props.data))
const getDurationFromData = (data) => {
  const raw = data?.duration ?? data?.dur
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_VIDEO_DURATION
}
const localDuration = ref(getDurationFromData(props.data))

const generationTypeLabels = {
  text_to_video: 'Text to Video',
  first_last_frames: 'First + Last Frame',
  omni_reference: 'Omni Reference'
}
const audioOptions = [
  { key: 'off', label: 'Audio Off' },
  { key: 'on', label: 'Audio On' }
]
const toolDropdownOptions = computed(() => ([
  {
    label: 'Replace Video',
    key: 'replace-video',
    disabled: isUploading.value || isVideoBusy.value || !props.data?.url
  },
  {
    label: 'Enhance Video',
    key: 'enhance-video',
    disabled: !props.data?.url || isToolBusy.value || isVideoBusy.value
  }
]))

const modelOptions = computed(() => videoModelOptions.value.map(m => ({ key: m.key, label: m.label })))
const ratioOptions = computed(() => getModelRatioOptions(localModel.value))
const typeOptions = computed(() => getModelVideoTypeOptions(localModel.value))
const modeOptions = computed(() => getModelVideoModeOptions(localModel.value))
const sizeOptions = computed(() => getModelVideoSizeOptions(localModel.value, localRatio.value))
const resolutionOptions = computed(() => getModelVideoResolutionOptions(localModel.value))
const durationOptions = computed(() => getModelDurationOptions(localModel.value))
const supportsAudioToggle = computed(() => Boolean(getModelConfig(localModel.value)?.supportAudioToggle))
const resolvedInputs = computed(() => resolveNodeInputs(props.id))
const effectiveGenerationType = computed(() => {
  if (localModel.value !== 'seedance-2.0') return localO1Type.value
  return resolveSeedanceGenerationType({
    firstFrameImage: resolvedInputs.value.first_frame_image,
    lastFrameImage: resolvedInputs.value.last_frame_image,
    referenceImages: resolvedInputs.value.images,
    referenceVideos: resolvedInputs.value.videos
  })
})
const inputProfile = computed(() => getVideoGenerationProfile(localModel.value, effectiveGenerationType.value))
const displayModel = computed(() => videoModelOptions.value.find(m => m.key === localModel.value)?.label || localModel.value)
const displayO1Type = computed(() => generationTypeLabels[effectiveGenerationType.value] || typeOptions.value.find(m => m.key === effectiveGenerationType.value)?.label || effectiveGenerationType.value || 'Type')
const displayMode = computed(() => modeOptions.value.find(m => m.key === localMode.value)?.label || localMode.value || 'Mode')
const displaySize = computed(() => String(localSize.value || '').trim() || 'Size')
const rawDisplayVideoUrl = computed(() => String(props.data?.previewUrl || props.data?.url || '').trim())
const displayVideoUrl = computed(() => createAuthenticatedMediaProxyUrl(rawDisplayVideoUrl.value))
const resolvedResolution = computed(() => {
  const optionKeys = resolutionOptions.value.map((item) => String(item.key || '').trim()).filter(Boolean)
  const current = String(localResolution.value || '').trim()
  if (current && optionKeys.includes(current)) return current
  return optionKeys[0] || current || 'Resolution'
})
const displayResolution = computed(() => resolvedResolution.value)
const displayAudio = computed(() => (localGenerateAudio.value ? 'Audio On' : 'Audio Off'))
const connectHint = computed(() => (
  inputProfile.value.allowVideoReference
    ? 'Connect Text/Image/Video node to generate'
    : 'Connect Text/Image node to generate'
))
const ratioFromSize = (size) => {
  const [w, h] = String(size || '').split('x').map(Number)
  if (!w || !h) return '16:9'
  const gcd = (a, b) => (b ? gcd(b, a % b) : a)
  const d = gcd(w, h)
  return `${Math.round(w / d)}:${Math.round(h / d)}`
}
const activeImageRoleSet = computed(() => {
  const activeRoleKeys = new Set()
  const rolePreviews = {}

  if (String(resolvedInputs.value.prompt || '').trim()) {
    activeRoleKeys.add('prompt')
  }
  if (String(resolvedInputs.value.first_frame_image || '').trim()) {
    activeRoleKeys.add('first_frame_image')
    rolePreviews.first_frame_image = resolvedInputs.value.first_frame_image
  }
  if (String(resolvedInputs.value.last_frame_image || '').trim()) {
    activeRoleKeys.add('last_frame_image')
    rolePreviews.last_frame_image = resolvedInputs.value.last_frame_image
  }
  if (Array.isArray(resolvedInputs.value.images) && resolvedInputs.value.images.length > 0) {
    activeRoleKeys.add('input_reference')
    rolePreviews.input_reference = resolvedInputs.value.images[0]
  }
  if (Array.isArray(resolvedInputs.value.videos) && resolvedInputs.value.videos.length > 0) {
    activeRoleKeys.add('video_reference')
  }

  return { keys: activeRoleKeys, previews: rolePreviews }
})
const syncResolutionToModelOptions = () => {
  const optionKeys = resolutionOptions.value.map((item) => String(item.key || '').trim()).filter(Boolean)
  if (!optionKeys.length) {
    localResolution.value = ''
    return
  }
  const current = String(localResolution.value || '').trim()
  if (current && optionKeys.includes(current)) return
  localResolution.value = optionKeys[0]
}
const syncModeToModelOptions = () => {
  const optionKeys = modeOptions.value.map((item) => String(item.key || '').trim()).filter(Boolean)
  if (!optionKeys.length) {
    localMode.value = ''
    return
  }
  const current = String(localMode.value || '').trim()
  if (current && optionKeys.includes(current)) return
  localMode.value = String(getModelConfig(localModel.value)?.defaultParams?.mode || optionKeys[0] || '').trim()
}
const syncTypeToModelOptions = () => {
  const optionKeys = typeOptions.value.map((item) => String(item.key || '').trim()).filter(Boolean)
  if (!optionKeys.length) {
    localO1Type.value = ''
    return
  }
  const current = String(localO1Type.value || '').trim()
  if (current && optionKeys.includes(current)) return
  localO1Type.value = String(getModelConfig(localModel.value)?.defaultParams?.o1_type || optionKeys[0] || '').trim()
}
const imageRoleStatusList = computed(() => {
  const { keys, previews } = activeImageRoleSet.value
  return getVisibleVideoBindingStatusItems({
    model: localModel.value,
    inputProfile: inputProfile.value,
    activeKeys: keys,
    previews
  })
})

const stageStyle = computed(() => {
  const map = {
    '16:9': { width: 420, height: 236 },
    '9:16': { width: 260, height: 462 },
    '7:4': { width: 420, height: 240 },
    '4:7': { width: 240, height: 420 },
    '4:3': { width: 360, height: 270 },
    '3:4': { width: 280, height: 373 },
    '1:1': { width: 320, height: 320 }
  }
  const picked = map[localRatio.value] || map['16:9']
  return { width: `${picked.width}px`, height: `${picked.height}px` }
})
const moduleStyle = computed(() => ({ width: `calc(${stageStyle.value.width} + 2px)` }))
const progressPercent = computed(() => Math.round(progressValue.value))
const progressBarStyle = computed(() => ({ width: `${Math.max(0, Math.min(100, progressValue.value))}%` }))
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
const capsuleStyle = {
  transform: 'translateX(-50%) scale(var(--node-capsule-scale, 1))',
  transformOrigin: 'top center'
}
const isToolBusy = computed(() => !!toolActionLoading.value)
const isToolsDisabled = computed(() => !props.data?.url || isToolBusy.value || isUploading.value || isVideoBusy.value)
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
const isVideoBusy = computed(() => (!!props.data?.loading && !props.data?.url) || videoGen.loading.value || !!videoActionLoading.value || isUploading.value)
watch(
  () => props.data?.loading,
  (loadingNow) => {
    // Only start progress if loading AND no URL (meaning it's generating, not just uploaded) | 仅当加载中且无 URL 时才开始进度条（意味着正在生成，而不仅仅是上传）
    if (loadingNow && !props.data?.url) {
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

onUnmounted(() => clearProgressTimers())

const beforeUnloadGuard = (event) => {
  if (!isUploading.value) return
  event.preventDefault()
  event.returnValue = 'Video upload is still in progress. Leaving now may lose it.'
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
})

watch(
  () => props.data?.error,
  (newVal) => {
    showErrorModal.value = !!newVal
  }
)

const setModel = (key) => {
  localModel.value = key
  const config = getModelConfig(key)
  if (config?.defaultParams?.ratio) localRatio.value = config.defaultParams.ratio
  if (config?.defaultParams?.size) localSize.value = config.defaultParams.size
  else localSize.value = ''
  localResolution.value = ''
  localO1Type.value = String(config?.defaultParams?.o1_type || typeOptions.value[0]?.key || '').trim()
  localMode.value = String(config?.defaultParams?.mode || modeOptions.value[0]?.key || '').trim()
  syncResolutionToModelOptions()
  syncTypeToModelOptions()
  syncModeToModelOptions()
  localGenerateAudio.value = Boolean(config?.defaultParams?.generate_audio ?? config?.defaultParams?.enable_audio ?? false)
  const modelDurationOptions = getModelDurationOptions(localModel.value)
  const defaultDuration = Number(config?.defaultParams?.duration)
  const optionKeys = modelDurationOptions.map((item) => Number(item.key)).filter((v) => Number.isFinite(v))
  if (optionKeys.length > 0) {
    localDuration.value = optionKeys.includes(defaultDuration) ? defaultDuration : optionKeys[0]
  } else if (Number.isFinite(defaultDuration) && defaultDuration > 0) {
    localDuration.value = defaultDuration
  }
  updateNode(props.id, {
    model: localModel.value,
    ratio: localRatio.value,
    o1_type: localO1Type.value,
    mode: localMode.value,
    size: localSize.value,
    resolution: resolvedResolution.value === 'Resolution' ? '' : resolvedResolution.value,
    generate_audio: localGenerateAudio.value,
    enable_audio: localGenerateAudio.value,
    duration: localDuration.value,
    dur: localDuration.value
  })
}
const setRatio = (key) => {
  localRatio.value = key
  const option = sizeOptions.value.find((item) => item.ratio === key)
  if (option?.key) {
    localSize.value = option.key
  } else {
    localSize.value = ''
  }
  updateNode(props.id, { ratio: key, size: localSize.value })
}
const setO1Type = (key) => {
  localO1Type.value = String(key || '')
  updateNode(props.id, { o1_type: localO1Type.value })
}
const setSize = (key) => {
  localSize.value = String(key || '')
  localRatio.value = ratioFromSize(localSize.value)
  updateNode(props.id, { size: localSize.value, ratio: localRatio.value })
}
const setMode = (key) => {
  localMode.value = String(key || '')
  updateNode(props.id, { mode: localMode.value })
}
const setResolution = (key) => {
  localResolution.value = String(key || '')
  updateNode(props.id, { resolution: localResolution.value })
}
const setGenerateAudio = (key) => {
  localGenerateAudio.value = key === 'on'
  updateNode(props.id, { generate_audio: localGenerateAudio.value, enable_audio: localGenerateAudio.value })
}
const setDuration = (key) => {
  const parsed = Number(key)
  if (!Number.isFinite(parsed) || parsed <= 0) return
  localDuration.value = parsed
  updateNode(props.id, { duration: parsed, dur: parsed })
}

const getConnectedInputs = () => {
  return {
    prompt: resolvedInputs.value.prompt,
    first_frame_image: resolvedInputs.value.first_frame_image,
    last_frame_image: resolvedInputs.value.last_frame_image,
    images: resolvedInputs.value.images,
    videos: resolvedInputs.value.videos
  }
}

const createLinkedVideoNode = (payload = {}) => {
  const currentNode = nodes.value.find((node) => node.id === props.id)
  const position = {
    x: (currentNode?.position?.x || 0) + 360,
    y: currentNode?.position?.y || 0
  }

  const nodeId = addNode('video', position, {
    url: '',
    loading: true,
    label: 'Enhanced video',
    ...payload
  })

  addEdge(edgeStrategy.resolve({
    source: props.id,
    target: nodeId,
    sourceHandle: 'right',
    targetHandle: 'left'
  }))

  setTimeout(() => {
    updateNodeInternals(nodeId)
  }, 50)

  return nodeId
}

const updateLinkedVideoNode = async (nodeId, payload = {}) => {
  if (!nodeId) return false
  updateNode(nodeId, {
    ...payload,
    updatedAt: Date.now()
  })
  return saveProject()
}

const resolveVideoPersistence = async (rawValue, fileName) => {
  const rawUrl = String(rawValue || '').trim()
  if (!rawUrl) {
    throw new Error('No video output')
  }

  try {
    const stableUrl = await persistMediaUrl(rawUrl, fileName, {
      projectId: currentProjectId.value,
      source: 'video_enhance',
      sourceNodeId: props.id
    })
    if (stableUrl) {
      return {
        persisted: true,
        persistedUrl: stableUrl,
        displayUrl: stableUrl
      }
    }
  } catch (error) {
    console.warn('Video persistence failed, keeping preview only:', error)
  }

  return {
    persisted: false,
    persistedUrl: '',
    displayUrl: rawUrl
  }
}

const runVideoGeneration = async (mode = 'create') => {
  if (!isConfigured.value) {
    window.$message?.warning('Please sign in first')
    return
  }

  const { prompt, first_frame_image, last_frame_image, images, videos } = getConnectedInputs()
  const hasInput = prompt || first_frame_image || last_frame_image || images.length > 0 || videos.length > 0
  if (!hasInput) {
    window.$message?.warning(inputProfile.value.allowVideoReference ? 'Connect a text, image, or video node first' : 'Connect a text or image node first')
    return
  }

  videoActionLoading.value = mode
  updateNode(props.id, { loading: true, error: '' })
  try {
    const result = await videoGen.generate({
      model: localModel.value,
      projectId: currentProjectId.value,
      sourceNodeId: props.id,
      prompt,
      first_frame_image,
      last_frame_image,
      images,
      videos,
      o1_type: effectiveGenerationType.value || undefined,
      mode: inputProfile.value.allowMode ? localMode.value : undefined,
      size: inputProfile.value.allowSize ? (localSize.value || undefined) : undefined,
      resolution: inputProfile.value.allowResolution ? (localResolution.value || undefined) : undefined,
      generate_audio: inputProfile.value.allowAudioToggle && supportsAudioToggle.value ? localGenerateAudio.value : undefined,
      enable_audio: inputProfile.value.allowAudioToggle && supportsAudioToggle.value ? localGenerateAudio.value : undefined,
      ratio: inputProfile.value.allowRatio ? localRatio.value : undefined,
      duration: inputProfile.value.allowDuration ? localDuration.value : undefined
    })
    const rawUrl = String(result?.url || '').trim()
    if (!rawUrl) {
      throw new Error('No video output')
    }
    updateNode(props.id, {
      loading: false,
      url: '',
      previewUrl: rawUrl,
      model: localModel.value,
      ratio: localRatio.value,
      o1_type: effectiveGenerationType.value,
      mode: localMode.value,
      size: localSize.value,
      resolution: localResolution.value,
      generate_audio: localGenerateAudio.value,
      enable_audio: localGenerateAudio.value,
      duration: localDuration.value,
      dur: localDuration.value,
      persistStatus: 'saving',
      persistError: '',
      updatedAt: Date.now()
    })

    const stableUrl = await persistMediaUrl(rawUrl, `generated-${Date.now()}.mp4`, {
      projectId: currentProjectId.value,
      source: 'video_generation',
      sourceNodeId: props.id
    })
    const finalUrl = String(stableUrl || rawUrl).trim()
    if (!finalUrl) {
      throw new Error('Video persistence failed')
    }

    updateNode(props.id, {
      loading: false,
      url: finalUrl,
      previewUrl: '',
      persistStatus: 'saving',
      persistError: '',
      updatedAt: Date.now()
    })

    const savedOk = await flushSave()
    updateNode(props.id, {
      persistStatus: savedOk ? 'saved' : 'error',
      persistError: savedOk ? '' : 'Project save failed. Refresh may lose this video.',
      updatedAt: Date.now()
    })
    window.$message?.success(mode === 'regenerate' ? 'Video regenerated' : 'Video generated')
  } catch (err) {
    const canceled = /已取消|cancel/i.test(String(err?.message || ''))
    if (!canceled) {
      updateNode(props.id, {
        loading: false,
        persistStatus: 'error',
        persistError: err?.message || 'Generation failed',
        error: err?.message || 'Generation failed'
      })
      window.$message?.error(err?.message || 'Video generation failed')
    }
  } finally {
    videoActionLoading.value = ''
  }
}

const handleStopGeneration = () => {
  videoGen.stop()
  // Clear timers and reset UI
  clearProgressTimers()
  showProgress.value = false
  progressValue.value = 0
  videoActionLoading.value = ''
  
  // Reset node state
  updateNode(props.id, { loading: false, error: 'Generation stopped' })
  window.$message?.info('Generation stopped')
}

const handleGenerateVideo = () => runVideoGeneration('create')
const handleRegenerateVideo = () => runVideoGeneration('regenerate')
const handleToolAction = async (key) => {
  if (key === 'replace-video') {
    triggerUpload()
    return
  }
  if (key === 'enhance-video') {
    showEnhanceDrawer.value = true
  }
}

const handleEnhancePending = async (payload = {}) => {
  if (payload.targetMode === 'replace') return
  if (pendingEnhancedNodeId.value) return

  toolActionLoading.value = 'enhance-video'
  const nodeId = createLinkedVideoNode({
    fileType: payload.fileType || 'video/mp4',
    sourceTool: 'video-enhance',
    error: ''
  })
  pendingEnhancedNodeId.value = nodeId || ''
  await flushSave()
}

const handleEnhanceApply = async (payload = {}) => {
  const targetNodeId = pendingEnhancedNodeId.value
  pendingEnhancedNodeId.value = ''

  try {
    const persistence = await resolveVideoPersistence(
      payload.url,
      `enhanced-video-${Date.now()}.mp4`
    )

    const savedOk = await updateLinkedVideoNode(targetNodeId, {
      url: persistence.persisted ? persistence.persistedUrl : persistence.displayUrl,
      loading: false,
      error: '',
      fileType: payload.fileType || 'video/mp4',
      persistStatus: persistence.persisted ? 'saved' : 'error',
      persistError: persistence.persisted ? '' : 'Enhanced result is only shown temporarily. Please retry.'
    })

    if (persistence.persisted && savedOk) {
      window.$message?.success('Enhanced video created')
    } else if (!persistence.persisted) {
      window.$message?.warning('Enhanced result is only shown temporarily. Please retry until it is saved.')
    } else {
      window.$message?.warning('Enhanced video created, but project save failed. Please retry save.')
    }
    showEnhanceDrawer.value = false
  } catch (error) {
    if (targetNodeId) {
      await updateLinkedVideoNode(targetNodeId, {
        loading: false,
        error: error?.message || 'Video enhancement failed'
      })
    }
    window.$message?.error(error?.message || 'Video enhancement failed')
  } finally {
    toolActionLoading.value = ''
  }
}

const handleEnhanceError = async (payload = {}) => {
  const failedNodeId = pendingEnhancedNodeId.value
  pendingEnhancedNodeId.value = ''
  toolActionLoading.value = ''
  if (!failedNodeId) return
  await updateLinkedVideoNode(failedNodeId, {
    loading: false,
    error: payload?.message || 'Video enhancement failed'
  })
}

const triggerUpload = () => {
  if (isUploading.value) return
  uploadInputRef.value?.click()
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
      validationTitle.value = 'Upload Limit'
      validationMessage.value = 'Video is too large. Maximum file size is 60MB.'
      showValidationModal.value = true
      return
    }

    updateNode(props.id, { loading: false, error: '' })
    isUploading.value = true
    showUploadProgress.value = true
    uploadStage.value = 'uploading'
    uploadProgress.value = 3

    const url = await uploadImageFile(file, {
      projectId: currentProjectId.value,
      source: 'video_upload',
      sourceNodeId: props.id,
      onProgress: (percent) => {
        uploadStage.value = 'uploading'
        uploadProgress.value = Math.max(uploadProgress.value, Math.min(92, percent))
      }
    })

    if (!url) throw new Error('Upload failed: No URL returned')

    uploadStage.value = 'saving'
    uploadProgress.value = Math.max(uploadProgress.value, 95)
    updateNode(props.id, {
      url,
      fileName: file.name,
      fileType: file.type,
      updatedAt: Date.now(),
      loading: false,
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
  } catch (err) {
    console.error('Video upload error:', err)
    updateNode(props.id, { loading: false, error: err.message || 'Upload failed' })
    uploadStage.value = 'error'
    uploadProgress.value = 100
    resetUploadProgress(2200)
    window.$message?.error(`Video upload failed: ${err.message || 'Unknown error'}`)
  } finally {
    isUploading.value = false
    if (event?.target) event.target.value = ''
  }
}

const handleDelete = () => {
  removeNode(props.id)
}

const handleDuplicate = () => {
  const newId = duplicateNode(props.id)
  if (!newId) return
  updateNode(props.id, { selected: false })
  updateNode(newId, { selected: true })
  window.$message?.success('Node duplicated')
}

const handleMetaMouseDown = (event) => {
  if (event?.button !== 0) return
}

const openPreviewModal = () => {
  if (!displayVideoUrl.value) return
  showPreviewModal.value = true
}
const activateInlineVideoPreview = () => {
  if (!displayVideoUrl.value) return
  inlineVideoPreviewRequested.value = true
}
const closeErrorModal = () => {
  showErrorModal.value = false
  updateNode(props.id, { error: '' })
}
const closeValidationModal = () => {
  showValidationModal.value = false
  validationTitle.value = 'Upload Limit'
  validationMessage.value = ''
}

watch(
  () => props.data,
  (val) => {
    if (!val) return
    const resolvedModel = resolveVideoModelKey(val.model || DEFAULT_VIDEO_MODEL)
    if (resolvedModel !== localModel.value) localModel.value = resolvedModel
    if (val.ratio && val.ratio !== localRatio.value) localRatio.value = val.ratio
    if ((val.size || '') !== localSize.value) localSize.value = val.size || ''
    if ((val.resolution || '') !== localResolution.value) localResolution.value = val.resolution || ''
    if ((val.o1_type || '') !== localO1Type.value) localO1Type.value = val.o1_type || ''
    if ((val.mode || '') !== localMode.value) localMode.value = val.mode || ''
    if (typeof val.generate_audio === 'boolean' && val.generate_audio !== localGenerateAudio.value) localGenerateAudio.value = val.generate_audio
    if (typeof val.enable_audio === 'boolean' && val.enable_audio !== localGenerateAudio.value) localGenerateAudio.value = val.enable_audio
    const incomingDuration = Number(val.duration ?? val.dur)
    if (Number.isFinite(incomingDuration) && incomingDuration > 0 && incomingDuration !== localDuration.value) {
      localDuration.value = incomingDuration
    }
  },
  { deep: true }
)

watch(
  resolutionOptions,
  () => {
    syncResolutionToModelOptions()
  },
  { immediate: true }
)

watch(
  sizeOptions,
  () => {
    if (!sizeOptions.value.length) {
      localSize.value = ''
    }
  },
  { immediate: true }
)

watch(
  typeOptions,
  () => {
    syncTypeToModelOptions()
  },
  { immediate: true }
)

watch(
  modeOptions,
  () => {
    syncModeToModelOptions()
  },
  { immediate: true }
)

watch(
  () => props.data?.model,
  (model) => {
    const resolvedModel = resolveVideoModelKey(model || DEFAULT_VIDEO_MODEL)
    if (model && resolvedModel !== model) {
      updateNode(props.id, { model: resolvedModel })
    }
  },
  { immediate: true }
)

watch(
  rawDisplayVideoUrl,
  () => {
    inlineVideoPreviewRequested.value = false
  }
)

</script>

<style scoped src="./node-base.css"></style>
<style scoped>
.video-node {
  cursor: default;
  position: relative;
  background: #0f0f0f;
  isolation: isolate;
  --module-radius: 24px;
  --module-inset: 12px;
  border-radius: var(--module-radius);
}

.module-video-shell {
  width: 100%;
  height: 100%;
  padding: var(--module-inset);
  background: #050505;
}
.module-video-frame {
  --inner-radius: calc(var(--module-radius) - var(--module-inset));
  width: 100%;
  height: 100%;
  border-radius: var(--inner-radius);
  overflow: hidden;
  background: #000;
}
.module-video {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: var(--inner-radius);
  clip-path: inset(0 round var(--inner-radius));
  background: #000;
}
.module-video-static-preview {
  position: relative;
  width: 100%;
  height: 100%;
  border: 0;
  border-radius: var(--inner-radius);
  background: #000;
  color: #d8dbe0;
  display: block;
  padding: 0;
  overflow: hidden;
  cursor: pointer;
}
.module-video-static-media {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: var(--inner-radius);
  background: #000;
}
.module-video-play-badge {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 42px;
  height: 42px;
  transform: translate(-50%, -50%);
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.48);
  border: 1px solid rgba(255, 255, 255, 0.45);
  color: #f4f4f5;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}
.module-video-static-label {
  position: absolute;
  left: 50%;
  bottom: 16px;
  transform: translateX(-50%);
  padding: 4px 9px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.5);
  color: #f4f4f5;
  font-size: 12px;
  line-height: 1;
  white-space: nowrap;
  pointer-events: none;
}
.binding-warning-text {
  color: #c8a06a;
  font-size: 11px;
  line-height: 1.35;
  text-align: center;
}
.upload-progress-wrap {
  width: 100%;
  display: flex;
  justify-content: center;
  margin-top: 12px;
}
.upload-progress-track {
  width: 100%;
  height: 4px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  overflow: hidden;
}
.upload-progress-bar {
  height: 100%;
  width: 0%;
  border-radius: inherit;
  transition: width 0.2s ease, background 0.2s ease;
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

.video-node::after {
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

.zoom-modal-card {
  max-width: calc(100vw - 80px);
  max-height: calc(100vh - 80px);
  overflow: auto;
  background: #121212;
  border: 1px solid rgba(143, 143, 143, 0.38);
  border-radius: 14px;
  padding: 12px;
}

.zoom-image-original {
  display: block;
  max-width: none;
  max-height: none;
}

.zoom-video-original {
  display: block;
  max-width: min(1200px, calc(100vw - 140px));
  max-height: calc(100vh - 140px);
  width: auto;
  height: auto;
  background: #000;
}
</style>
