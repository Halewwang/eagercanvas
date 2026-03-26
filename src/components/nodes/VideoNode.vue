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
          <BaseDropdown :options="ratioOptions" compact @select="setRatio"><button class="capsule-select">{{ localRatio }}</button></BaseDropdown>
          <BaseDropdown v-if="sizeOptions.length > 0" :options="sizeOptions" compact @select="setSize"><button class="capsule-select">{{ displaySize }}</button></BaseDropdown>
          <BaseDropdown v-if="resolutionOptions.length > 0" :options="resolutionOptions" compact @select="setResolution"><button class="capsule-select">{{ displayResolution }}</button></BaseDropdown>
          <BaseDropdown v-if="supportsAudioToggle" :options="audioOptions" compact @select="setGenerateAudio"><button class="capsule-select">{{ displayAudio }}</button></BaseDropdown>
          <BaseDropdown v-if="durationOptions.length > 0" :options="durationOptions" compact @select="setDuration"><button class="capsule-select">{{ localDuration }}s</button></BaseDropdown>
        </div>

        <div class="capsule-divider" />

        <div class="capsule-group">
          <button class="capsule-icon" :disabled="!data.url" @click="openPreviewModal" title="Preview"><n-icon :size="14"><ExpandOutline /></n-icon></button>
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

        <div v-else-if="data.url && !data.loading" class="module-video-shell">
          <div class="module-video-frame">
            <video :src="data.url" controls class="module-video" />
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
            <span class="text-sm text-[#7b818c]">Connect Text/Image node to generate</span>
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
        <video :src="data.url" controls autoplay class="zoom-video-original" />
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

    <div v-if="showUploadProgress" class="upload-progress-wrap" :style="moduleStyle">
      <div class="upload-progress-track">
        <div class="upload-progress-bar" :style="uploadProgressStyle"></div>
      </div>
    </div>

    <div class="binding-status-wrap">
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
      <div v-if="soraInputWarning" class="binding-warning-text">{{ soraInputWarning }}</div>
    </div>
  </div>
</template>

<script setup>
import { computed, onUnmounted, ref, watch } from 'vue'
import { Handle, Position, useVueFlow } from '@vue-flow/core'
import { NIcon, NModal } from 'naive-ui'
import { BaseButton, BaseDropdown, BaseModal } from '@/components/ui'
import { CloseCircleOutline, CopyOutline, ExpandOutline, RefreshOutline, TrashOutline, VideocamOutline } from '../../icons/coolicons'
import { duplicateNode, edges, flushSave, nodes, removeNode, updateNode } from '../../stores/canvas'
import { useApiConfig, useVideoGeneration } from '../../hooks'
import { DEFAULT_VIDEO_DURATION, DEFAULT_VIDEO_MODEL, DEFAULT_VIDEO_RATIO, getModelConfig, getModelDurationOptions, getModelRatioOptions, getModelVideoResolutionOptions, getModelVideoSizeOptions, videoModelOptions } from '../../stores/models'
import { getImageDimensionsFromSource, isSora2AllowedReferenceSize, uploadImageFile } from '@/utils/media'
import { resolveNodeInputs } from '../../services/edgeStrategy'
import createIcon from '@/assets/create-icon.svg'

const props = defineProps({ id: String, data: Object, selected: Boolean })

const { updateNodeInternals, viewport } = useVueFlow()
const { isConfigured } = useApiConfig()
const videoGen = useVideoGeneration()

const showCapsule = ref(false)
const isSelected = computed(() => !!props.selected || !!props.data?.selected)
const showNodeCapsule = computed(() => !props.data?.suppressCapsule && (showCapsule.value || isSelected.value))
const showHandles = computed(() => showCapsule.value || isSelected.value)
const uploadInputRef = ref(null)
const showPreviewModal = ref(false)
const showErrorModal = ref(false)
const showValidationModal = ref(false)
const validationTitle = ref('Upload Limit')
const validationMessage = ref('')
const soraInputWarning = ref('')
const videoActionLoading = ref('')
const isUploading = ref(false)
const showUploadProgress = ref(false)
const uploadProgress = ref(0)
const uploadStage = ref('idle')
const progressValue = ref(0)
const showProgress = ref(false)
const progressTimer = ref(null)
const progressFinishTimer = ref(null)
const MAX_UPLOAD_SIZE_BYTES = 60 * 1024 * 1024

const localModel = ref(props.data?.model || DEFAULT_VIDEO_MODEL)
const localRatio = ref(props.data?.ratio || DEFAULT_VIDEO_RATIO)
const localSize = ref(props.data?.size || '')
const localResolution = ref('')
const localGenerateAudio = ref(Boolean(props.data?.generate_audio ?? getModelConfig(props.data?.model || DEFAULT_VIDEO_MODEL)?.defaultParams?.generate_audio ?? false))
const getDurationFromData = (data) => {
  const raw = data?.duration ?? data?.dur
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_VIDEO_DURATION
}
const localDuration = ref(getDurationFromData(props.data))

const imageRoleStatusMap = {
  prompt: 'Prompt',
  first_frame_image: 'First Frame',
  last_frame_image: 'Second Frame',
  input_reference: 'Reference Picture'
}
const isSora2Model = (model) => String(model || '').trim().toLowerCase().startsWith('sora-2')
const isVeo31Model = (model) => String(model || '').trim().toLowerCase().startsWith('veo-3.1')
const audioOptions = [
  { key: 'off', label: 'Audio Off' },
  { key: 'on', label: 'Audio On' }
]

const modelOptions = computed(() => videoModelOptions.value.map(m => ({ key: m.key, label: m.label })))
const ratioOptions = computed(() => getModelRatioOptions(localModel.value))
const sizeOptions = computed(() => {
  // Sora-2 size must strictly follow documented enum and should not be filtered by ratio.
  if (isSora2Model(localModel.value)) {
    return getModelVideoSizeOptions(localModel.value)
  }
  return getModelVideoSizeOptions(localModel.value, localRatio.value)
})
const resolutionOptions = computed(() => getModelVideoResolutionOptions(localModel.value))
const durationOptions = computed(() => getModelDurationOptions(localModel.value))
const supportsAudioToggle = computed(() => isVeo31Model(localModel.value))
const displayModel = computed(() => videoModelOptions.value.find(m => m.key === localModel.value)?.label || localModel.value)
const displaySize = computed(() => String(localSize.value || '').trim() || 'Size')
const resolvedResolution = computed(() => {
  const optionKeys = resolutionOptions.value.map((item) => String(item.key || '').trim()).filter(Boolean)
  const current = String(localResolution.value || '').trim()
  if (current && optionKeys.includes(current)) return current
  return optionKeys[0] || current || 'Resolution'
})
const displayResolution = computed(() => resolvedResolution.value)
const displayAudio = computed(() => (localGenerateAudio.value ? 'Audio On' : 'Audio Off'))
const ratioFromSize = (size) => {
  const [w, h] = String(size || '').split('x').map(Number)
  if (!w || !h) return '16:9'
  const gcd = (a, b) => (b ? gcd(b, a % b) : a)
  const d = gcd(w, h)
  return `${Math.round(w / d)}:${Math.round(h / d)}`
}
const activeImageRoleSet = computed(() => {
  const incomingEdges = edges.value.filter((edge) => edge.target === props.id)
  const activeRoleKeys = []
  const rolePreviews = {}

  for (const edge of incomingEdges) {
    const sourceNode = nodes.value.find((node) => node.id === edge.source)
    if (sourceNode?.type === 'image') {
      const role = edge.data?.imageRole || 'first_frame_image'
      activeRoleKeys.push(role)
      if (sourceNode.data?.url) {
        rolePreviews[role] = sourceNode.data.url
      }
    }
    if (sourceNode?.type === 'text' && sourceNode.data?.content) {
      activeRoleKeys.push('prompt')
    }
  }

  return { keys: new Set(activeRoleKeys), previews: rolePreviews }
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
const imageRoleStatusList = computed(() => {
  const { keys, previews } = activeImageRoleSet.value
  return [
    { key: 'prompt', label: imageRoleStatusMap.prompt, active: keys.has('prompt') },
    { key: 'first_frame_image', label: imageRoleStatusMap.first_frame_image, active: keys.has('first_frame_image'), previewUrl: previews.first_frame_image },
    { key: 'last_frame_image', label: imageRoleStatusMap.last_frame_image, active: keys.has('last_frame_image'), previewUrl: previews.last_frame_image },
    { key: 'input_reference', label: imageRoleStatusMap.input_reference, active: keys.has('input_reference'), previewUrl: previews.input_reference }
  ]
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
const capsuleStyle = computed(() => {
  const zoom = viewport.value?.zoom || 1
  const inverse = 1 / zoom
  const safeScale = Math.min(1.06, Math.max(0.82, inverse))
  return { transform: `translateX(-50%) scale(${safeScale})`, transformOrigin: 'top center' }
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
const isVideoBusy = computed(() => (!!props.data?.loading && !props.data?.url) || videoGen.loading.value || !!videoActionLoading.value)
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
  syncResolutionToModelOptions()
  localGenerateAudio.value = Boolean(config?.defaultParams?.generate_audio ?? false)
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
    size: localSize.value,
    resolution: resolvedResolution.value === 'Resolution' ? '' : resolvedResolution.value,
    generate_audio: localGenerateAudio.value,
    duration: localDuration.value,
    dur: localDuration.value
  })
}
const setRatio = (key) => {
  localRatio.value = key
  const option = sizeOptions.value.find((item) => item.ratio === key)
  if (option?.key) {
    localSize.value = option.key
  } else if (localModel.value === 'kling-o1') {
    localSize.value = ''
  }
  updateNode(props.id, { ratio: key, size: localSize.value })
}
const setSize = (key) => {
  localSize.value = String(key || '')
  localRatio.value = ratioFromSize(localSize.value)
  updateNode(props.id, { size: localSize.value, ratio: localRatio.value })
}
const setResolution = (key) => {
  localResolution.value = String(key || '')
  updateNode(props.id, { resolution: localResolution.value })
}
const setGenerateAudio = (key) => {
  localGenerateAudio.value = key === 'on'
  updateNode(props.id, { generate_audio: localGenerateAudio.value })
}
const setDuration = (key) => {
  const parsed = Number(key)
  if (!Number.isFinite(parsed) || parsed <= 0) return
  localDuration.value = parsed
  updateNode(props.id, { duration: parsed, dur: parsed })
}

const getConnectedInputs = () => {
  const resolved = resolveNodeInputs(props.id)
  return {
    prompt: resolved.prompt,
    first_frame_image: resolved.first_frame_image,
    last_frame_image: resolved.last_frame_image,
    images: resolved.images
  }
}

const getConnectedImageInputs = () => {
  const resolved = resolveNodeInputs(props.id)
  const connected = []
  if (resolved.firstFrame) {
    connected.push({ role: resolved.firstFrame.role, image: resolved.firstFrame.value })
  }
  if (resolved.lastFrame) {
    connected.push({ role: resolved.lastFrame.role, image: resolved.lastFrame.value })
  }
  resolved.referenceImages.forEach((item) => {
    connected.push({ role: item.role, image: item.value })
  })
  return connected
}

const refreshSoraInputWarning = async () => {
  if (!isSora2Model(localModel.value)) {
    soraInputWarning.value = ''
    return
  }

  const connectedImages = getConnectedImageInputs()
  if (!connectedImages.length) {
    soraInputWarning.value = ''
    return
  }

  for (const item of connectedImages) {
    const { width, height } = await getImageDimensionsFromSource(item.image)
    if (isSora2AllowedReferenceSize(width, height)) continue
    soraInputWarning.value = `Sora 2 参考图尺寸不支持：当前为 ${width || 0}x${height || 0}`
    return
  }

  soraInputWarning.value = ''
}

const validateSora2Inputs = async () => {
  if (!isSora2Model(localModel.value)) return true

  const connectedImages = getConnectedImageInputs()
  if (!connectedImages.length) return true

  for (const item of connectedImages) {
    const { width, height } = await getImageDimensionsFromSource(item.image)
    if (isSora2AllowedReferenceSize(width, height)) continue

    validationTitle.value = 'Sora 2 Input Size'
    validationMessage.value = `Sora 2 图生视频仅支持以下参考图尺寸：1280x720、720x1280、1024x1792、1792x1024。\n当前上游参考图尺寸为 ${width || 0}x${height || 0}，请先调整图片比例后再生成。`
    showValidationModal.value = true
    return false
  }

  return true
}

const runVideoGeneration = async (mode = 'create') => {
  if (!isConfigured.value) {
    window.$message?.warning('Please sign in first')
    return
  }

  const { prompt, first_frame_image, last_frame_image, images } = getConnectedInputs()
  const hasInput = prompt || first_frame_image || last_frame_image || images.length > 0
  if (!hasInput) {
    window.$message?.warning('Connect a text or image node first')
    return
  }

  if (!(await validateSora2Inputs())) {
    return
  }

  videoActionLoading.value = mode
  updateNode(props.id, { loading: true, error: '' })
  try {
    const result = await videoGen.generate({
      model: localModel.value,
      prompt,
      first_frame_image,
      last_frame_image,
      images,
      size: localSize.value || undefined,
      resolution: localResolution.value || undefined,
      generate_audio: supportsAudioToggle.value ? localGenerateAudio.value : undefined,
      ratio: localRatio.value,
      duration: localDuration.value
    })
    updateNode(props.id, {
      loading: false,
      url: result?.url || '',
      model: localModel.value,
      ratio: localRatio.value,
      size: localSize.value,
      resolution: localResolution.value,
      generate_audio: localGenerateAudio.value,
      duration: localDuration.value,
      dur: localDuration.value,
      updatedAt: Date.now()
    })
    window.$message?.success(mode === 'regenerate' ? 'Video regenerated' : 'Video generated')
  } catch (err) {
    const canceled = /已取消|cancel/i.test(String(err?.message || ''))
    if (!canceled) {
      updateNode(props.id, { loading: false, error: err?.message || 'Generation failed' })
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

const triggerUpload = () => {
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
  if (!props.data?.url) return
  showPreviewModal.value = true
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
    if (val.model && val.model !== localModel.value) localModel.value = val.model
    if (val.ratio && val.ratio !== localRatio.value) localRatio.value = val.ratio
    if ((val.size || '') !== localSize.value) localSize.value = val.size || ''
    if ((val.resolution || '') !== localResolution.value) localResolution.value = val.resolution || ''
    if (typeof val.generate_audio === 'boolean' && val.generate_audio !== localGenerateAudio.value) localGenerateAudio.value = val.generate_audio
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
  () => [
    localModel.value,
    ...getConnectedImageInputs().map((item) => `${item.role}:${item.image}`)
  ],
  () => {
    refreshSoraInputWarning()
  },
  { immediate: true }
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
