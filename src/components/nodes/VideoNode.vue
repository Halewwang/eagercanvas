<template>
  <div class="video-node-wrapper node-shell-wrapper" @mouseenter="showCapsule = true" @mouseleave="showCapsule = false">
    <NodeMetaRow label="Video" :icon="VideocamOutline" @mousedown="handleMetaMouseDown" />

    <VideoNodeCapsuleMenu
      v-show="showNodeCapsule"
      :capsule-style="capsuleStyle"
      :selected="isSelected"
      :model-options="modelOptions"
      :display-model="displayModel"
      :input-profile="inputProfile"
      :ratio-options="ratioOptions"
      :display-ratio="localRatio"
      :type-options="typeOptions"
      :display-o1-type="displayO1Type"
      :mode-options="modeOptions"
      :display-mode="displayMode"
      :size-options="sizeOptions"
      :display-size="displaySize"
      :resolution-options="resolutionOptions"
      :display-resolution="displayResolution"
      :supports-audio-toggle="supportsAudioToggle"
      :audio-options="audioOptions"
      :display-audio="displayAudio"
      :duration-options="durationOptions"
      :display-duration="localDuration"
      :tool-options="toolDropdownOptions"
      :tools-disabled="isToolsDisabled"
      :has-video="!!displayVideoUrl"
      :video-busy="isVideoBusy"
      @select-model="setModel"
      @select-ratio="setRatio"
      @select-o1-type="setO1Type"
      @select-mode="setMode"
      @select-size="setSize"
      @select-resolution="setResolution"
      @select-generate-audio="setGenerateAudio"
      @select-duration="setDuration"
      @tool-action="handleToolAction"
      @preview="openPreviewModal"
      @duplicate="handleDuplicate"
      @delete="handleDelete"
      @create="handleGenerateVideo"
      @regenerate="handleRegenerateVideo"
      @stop="handleStopGeneration"
    />

    <div
      class="video-node rounded-2xl border relative transition-all duration-200 overflow-visible"
      :class="[
        isSelected ? 'node-selected' : 'node-default',
        { 'node-glow-active': isSelected }
      ]"
      :style="moduleStyle"
    >
      <div class="module-stage" :style="stageStyle">
        <VideoNodeGenerationProgress v-if="showProgress" :bar-style="progressBarStyle" :percent="progressPercent" />

        <VideoNodeDisplayFrame
          v-else-if="displayVideoUrl && !data.loading"
          :video-url="displayVideoUrl"
          :is-interactive="isVideoInteractive"
          :show-static-preview="showStaticVideoPreview"
          @activate-preview="activateInlineVideoPreview"
        />

        <template v-else>
          <VideoNodeEmptyState
            :show-previews="activeImageRoleSet.keys.size > 0"
            :items="imageRoleStatusList"
            :connect-hint="connectHint"
            @upload="triggerUpload"
          />
          <input ref="uploadInputRef" type="file" accept="video/*" class="hidden" @change="handleFileUpload" />
        </template>
      </div>

      <NodeFlowHandles :show-handles="showHandles" />
    </div>

    <VideoNodePreviewModal v-model:show="showPreviewModal" :video-url="displayVideoUrl" />
    <VideoNodeFeedbackModals
      v-model:show-error="showErrorModal"
      v-model:show-validation="showValidationModal"
      :error-message="data.error"
      :validation-title="validationTitle"
      :validation-message="validationMessage"
      @close-error="closeErrorModal"
      @close-validation="closeValidationModal"
    />
    <VideoEnhanceToolDrawer
      v-model:show="showEnhanceDrawer"
      :video-url="displayVideoUrl || ''"
      :ratio="localRatio"
      :resolution="localResolution"
      @pending="handleEnhancePending"
      @apply="handleEnhanceApply"
      @error="handleEnhanceError"
    />

    <VideoNodeUploadProgress v-if="showUploadProgress" :module-style="moduleStyle" :progress-style="uploadProgressStyle" />

    <NodeBindingStatus :module-style="moduleStyle" :items="imageRoleStatusList" />
  </div>
</template>

<script setup>
import { computed, onUnmounted, ref, watch } from 'vue'
import { useVueFlow } from '@vue-flow/core'
import { storeToRefs } from 'pinia'
import VideoEnhanceToolDrawer from '@/components/tools/VideoEnhanceToolDrawer.vue'
import NodeBindingStatus from './NodeBindingStatus.vue'
import NodeFlowHandles from './NodeFlowHandles.vue'
import NodeMetaRow from './NodeMetaRow.vue'
import VideoNodeCapsuleMenu from './video/VideoNodeCapsuleMenu.vue'
import VideoNodeDisplayFrame from './video/VideoNodeDisplayFrame.vue'
import VideoNodeEmptyState from './video/VideoNodeEmptyState.vue'
import VideoNodeFeedbackModals from './video/VideoNodeFeedbackModals.vue'
import VideoNodeGenerationProgress from './video/VideoNodeGenerationProgress.vue'
import VideoNodePreviewModal from './video/VideoNodePreviewModal.vue'
import VideoNodeUploadProgress from './video/VideoNodeUploadProgress.vue'
import { useVideoNodeEnhanceResults } from './video/useVideoNodeEnhanceResults.js'
import { useVideoNodeProgressState } from './video/useVideoNodeProgressState.js'
import { useVideoNodeUploadPersistence } from './video/useVideoNodeUploadPersistence.js'
import { VideocamOutline } from '@/icons/coolicons'
import { useCanvasStore } from '@/stores/canvas'
import { pinia } from '@/stores/pinia'
import { useVideoGeneration } from '@/hooks/api/useVideoApi.js'
import { useApiConfig } from '@/hooks/useApiConfig'
import { DEFAULT_VIDEO_DURATION, DEFAULT_VIDEO_MODEL, DEFAULT_VIDEO_RATIO, getModelConfig, getModelDurationOptions, getModelRatioOptions, getModelVideoModeOptions, getModelVideoResolutionOptions, getModelVideoSizeOptions, getModelVideoTypeOptions, getVideoGenerationProfile, resolveSeedanceGenerationType, resolveVideoModelKey, videoModelOptions } from '@/stores/models'
import { createAuthenticatedMediaProxyUrl, persistMediaUrl, uploadImageFile } from '@/utils/media'
import { getVisibleVideoBindingStatusItems, shouldLoadInlineVideoPlayer, shouldRenderStaticVideoPreview } from '@/utils/videoPreview'
import { edgeStrategy, resolveNodeInputs } from '@/services/edgeStrategy'

const props = defineProps({ id: String, data: Object, selected: Boolean })

const { updateNodeInternals } = useVueFlow()
const canvasStore = useCanvasStore(pinia)
const { currentProjectId, nodes } = storeToRefs(canvasStore)
const { addEdge, addNode, duplicateNode, flushSave, removeNode, saveProject, updateNode } = canvasStore
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
const validationTitle = ref('Upload Limit')
const validationMessage = ref('')
const videoActionLoading = ref('')
const MAX_UPLOAD_SIZE_BYTES = 60 * 1024 * 1024
const {
  handleFileUpload,
  isUploading,
  showUploadProgress,
  triggerUpload,
  uploadProgressStyle
} = useVideoNodeUploadPersistence({
  currentProjectId,
  flushSave,
  maxUploadSizeBytes: MAX_UPLOAD_SIZE_BYTES,
  messageApi: () => window.$message,
  nodeId: () => props.id,
  showValidationModal,
  updateNode,
  uploadInputRef,
  uploadVideoFile: uploadImageFile,
  validationMessage,
  validationTitle
})
const {
  handleEnhanceApply,
  handleEnhanceError,
  handleEnhancePending,
  handleToolAction,
  showEnhanceDrawer,
  toolActionLoading
} = useVideoNodeEnhanceResults({
  addEdge,
  addNode,
  currentProjectId,
  edgeStrategy,
  flushSave,
  messageApi: () => window.$message,
  nodeId: () => props.id,
  nodes,
  persistMediaUrl,
  saveProject,
  setTimeoutFn: setTimeout,
  triggerUpload,
  updateNode,
  updateNodeInternals
})

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
const {
  progressBarStyle,
  progressPercent,
  resetProgress,
  showProgress
} = useVideoNodeProgressState({
  error: () => props.data?.error,
  hasVideo: () => !!props.data?.url,
  loading: () => props.data?.loading
})
const capsuleStyle = {
  transform: 'translateX(-50%) scale(var(--node-capsule-scale, 1))',
  transformOrigin: 'top center'
}
const isToolBusy = computed(() => !!toolActionLoading.value)
const isToolsDisabled = computed(() => !props.data?.url || isToolBusy.value || isUploading.value || isVideoBusy.value)
const isVideoBusy = computed(() => (!!props.data?.loading && !props.data?.url) || videoGen.loading.value || !!videoActionLoading.value || isUploading.value)
onUnmounted(() => videoGen.stop())

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
  resetProgress()
  videoActionLoading.value = ''

  // Reset node state
  updateNode(props.id, { loading: false, error: 'Generation stopped' })
  window.$message?.info('Generation stopped')
}

const handleGenerateVideo = () => runVideoGeneration('create')
const handleRegenerateVideo = () => runVideoGeneration('regenerate')

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

.binding-warning-text {
  color: #c8a06a;
  font-size: 11px;
  line-height: 1.35;
  text-align: center;
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

</style>
