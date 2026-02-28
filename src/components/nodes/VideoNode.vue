<template>
  <div class="video-node-wrapper" @mouseenter="showCapsule = true" @mouseleave="showCapsule = false">
    <div class="node-meta-row" @mousedown="handleMetaMouseDown">
      <n-icon :size="16" class="meta-icon"><VideocamOutline /></n-icon>
      <span class="meta-title">Video</span>
    </div>

    <div v-show="showCapsule || isSelected" class="capsule-menu absolute left-1/2 z-[1200]" :style="capsuleStyle">
      <div class="capsule-inner">
        <div class="capsule-group">
          <n-dropdown :options="modelOptions" @select="setModel"><button class="capsule-select">{{ displayModel }}</button></n-dropdown>
          <n-dropdown :options="ratioOptions" @select="setRatio"><button class="capsule-select">{{ localRatio }}</button></n-dropdown>
          <n-dropdown v-if="sizeOptions.length > 0" :options="sizeOptions" @select="setSize"><button class="capsule-select">{{ displaySize }}</button></n-dropdown>
          <n-dropdown :options="durationOptions" @select="setDuration"><button class="capsule-select">{{ localDuration }}s</button></n-dropdown>
        </div>

        <div class="capsule-divider" />

        <div class="capsule-group">
          <n-dropdown :options="createLinkOptions" @select="createLinkedNode">
            <button class="capsule-icon" title="Create linked module"><n-icon :size="14"><AddOutline /></n-icon></button>
          </n-dropdown>
          <button class="capsule-icon" :disabled="!data.url" @click="openPreviewModal" title="Preview"><n-icon :size="14"><ExpandOutline /></n-icon></button>
          <button class="capsule-icon" @click="handleDuplicate" title="Duplicate"><n-icon :size="14"><CopyOutline /></n-icon></button>
          <button class="capsule-icon" @click="handleDelete" title="Delete"><n-icon :size="14"><TrashOutline /></n-icon></button>
        </div>
      </div>
      <div class="capsule-inner capsule-generate">
        <button class="capsule-icon capsule-icon-solid capsule-create" :disabled="isVideoBusy" @click="handleGenerateVideo" title="Create">
          <n-spin v-if="videoActionLoading === 'create'" :size="12" />
          <template v-else>
            <n-icon :size="14"><SparklesOutline /></n-icon>
            <span class="capsule-create-label">Create</span>
          </template>
        </button>
        <button class="capsule-icon" :disabled="isVideoBusy" @click="handleRegenerateVideo" title="Regenerate">
          <n-spin v-if="videoActionLoading === 'regenerate'" :size="12" />
          <n-icon v-else :size="14"><RefreshOutline /></n-icon>
        </button>
      </div>
    </div>

    <div class="video-node rounded-2xl border relative transition-all duration-200 overflow-visible" :class="isSelected ? 'node-selected' : 'node-default'" :style="moduleStyle">
      <div class="module-stage" :style="stageStyle">
        <div v-if="showProgress" class="module-progress-shell">
          <div class="module-progress-track"></div>
          <div class="module-progress-bar" :style="progressBarStyle"></div>
          <div class="module-progress-label">Generating video... {{ progressPercent }}%</div>
        </div>

        <div v-else-if="data.error" class="w-full h-full bg-[#231a1d] flex flex-col items-center justify-center gap-2">
          <n-icon :size="30" class="text-red-500"><CloseCircleOutline /></n-icon>
          <span class="text-sm text-red-400 text-center px-3">{{ data.error }}</span>
        </div>

        <div v-else-if="data.url" class="w-full h-full overflow-hidden bg-black">
          <video :src="data.url" controls class="w-full h-full object-contain" />
        </div>

        <div v-else class="w-full h-full bg-[#0f0f0f] flex flex-col items-center justify-center gap-2 relative text-center px-4">
          <n-icon :size="32" class="text-[#7b818c]"><VideocamOutline /></n-icon>
          <span class="text-sm text-[#7b818c]">Drop a video or click to upload</span>
          <button class="upload-btn" @click="triggerUpload">Upload</button>
          <input ref="uploadInputRef" type="file" accept="video/*" class="hidden" @change="handleFileUpload" />
          <div class="w-full px-4 flex gap-2 relative z-10 pointer-events-auto">
            <input
              type="text"
              v-model="inputUrl"
              placeholder="Enter video URL..."
              class="flex-1 px-2 py-1 text-sm bg-[#14161a] border border-[rgba(143,143,143,0.45)] rounded-lg outline-none text-[#d7dbe3] placeholder:text-[#7b818c] min-w-0"
              @keydown.enter.stop="handleUrlInput"
              @click.stop
            />
            <button @click.stop="handleUrlInput" :disabled="!inputUrl" class="capsule-select !rounded-lg !px-3">Load</button>
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
    </div>
  </div>
</template>

<script setup>
import { computed, onUnmounted, ref, watch } from 'vue'
import { Handle, Position, useVueFlow } from '@vue-flow/core'
import { NDropdown, NIcon, NModal, NSpin } from 'naive-ui'
import { AddOutline, CloseCircleOutline, CopyOutline, ExpandOutline, RefreshOutline, SparklesOutline, TrashOutline, VideocamOutline } from '../../icons/coolicons'
import { addEdge, addNode, duplicateNode, edges, nodes, removeNode, updateNode } from '../../stores/canvas'
import { useApiConfig, useVideoGeneration } from '../../hooks'
import { DEFAULT_VIDEO_DURATION, DEFAULT_VIDEO_MODEL, DEFAULT_VIDEO_RATIO, getModelConfig, getModelDurationOptions, getModelRatioOptions, getModelVideoSizeOptions, videoModelOptions } from '../../stores/models'

const props = defineProps({ id: String, data: Object, selected: Boolean })

const { updateNodeInternals, viewport } = useVueFlow()
const { isConfigured } = useApiConfig()
const videoGen = useVideoGeneration()

const showCapsule = ref(false)
const inputUrl = ref('')
const isSelected = computed(() => !!props.selected || !!props.data?.selected)
const showHandles = computed(() => showCapsule.value || isSelected.value)
const uploadInputRef = ref(null)
const showPreviewModal = ref(false)
const videoActionLoading = ref('')
const progressValue = ref(0)
const showProgress = ref(false)
const progressTimer = ref(null)
const progressFinishTimer = ref(null)

const localModel = ref(props.data?.model || DEFAULT_VIDEO_MODEL)
const localRatio = ref(props.data?.ratio || DEFAULT_VIDEO_RATIO)
const localSize = ref(props.data?.size || '')
const localDuration = ref(props.data?.dur || DEFAULT_VIDEO_DURATION)

const createLinkOptions = [
  { label: 'Link Text Module', key: 'text' },
  { label: 'Link Image Module', key: 'image' },
  { label: 'Link Video Module', key: 'video' }
]
const imageRoleStatusMap = {
  prompt: 'Prompt',
  first_frame_image: 'First Frame',
  last_frame_image: 'Second Frame',
  input_reference: 'Reference Picture'
}

const modelOptions = computed(() => videoModelOptions.value.map(m => ({ key: m.key, label: m.label })))
const ratioOptions = computed(() => getModelRatioOptions(localModel.value))
const sizeOptions = computed(() => {
  // Sora-2 size must strictly follow documented enum and should not be filtered by ratio.
  if (localModel.value === 'sora-2') {
    return getModelVideoSizeOptions(localModel.value)
  }
  return getModelVideoSizeOptions(localModel.value, localRatio.value)
})
const durationOptions = computed(() => getModelDurationOptions(localModel.value))
const displayModel = computed(() => videoModelOptions.value.find(m => m.key === localModel.value)?.label || localModel.value)
const displaySize = computed(() => String(localSize.value || '').trim())
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

  for (const edge of incomingEdges) {
    const sourceNode = nodes.value.find((node) => node.id === edge.source)
    if (sourceNode?.type === 'image') {
      activeRoleKeys.push(edge.data?.imageRole || 'first_frame_image')
    }
    if (sourceNode?.type === 'text' && sourceNode.data?.content) {
      activeRoleKeys.push('prompt')
    }
  }

  return new Set(activeRoleKeys)
})
const imageRoleStatusList = computed(() => ([
  { key: 'prompt', label: imageRoleStatusMap.prompt, active: activeImageRoleSet.value.has('prompt') },
  { key: 'first_frame_image', label: imageRoleStatusMap.first_frame_image, active: activeImageRoleSet.value.has('first_frame_image') },
  { key: 'last_frame_image', label: imageRoleStatusMap.last_frame_image, active: activeImageRoleSet.value.has('last_frame_image') },
  { key: 'input_reference', label: imageRoleStatusMap.input_reference, active: activeImageRoleSet.value.has('input_reference') }
]))

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
const isVideoBusy = computed(() => !!props.data?.loading || videoGen.loading.value || !!videoActionLoading.value)
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

onUnmounted(() => clearProgressTimers())

const setModel = (key) => {
  localModel.value = key
  const config = getModelConfig(key)
  if (config?.defaultParams?.ratio) localRatio.value = config.defaultParams.ratio
  if (config?.defaultParams?.size) localSize.value = config.defaultParams.size
  else localSize.value = ''
  if (config?.defaultParams?.duration) localDuration.value = config.defaultParams.duration
  updateNode(props.id, { model: localModel.value, ratio: localRatio.value, size: localSize.value, dur: localDuration.value })
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
const setDuration = (key) => {
  localDuration.value = key
  updateNode(props.id, { dur: key })
}

const getConnectedInputs = () => {
  const incoming = edges.value.filter(e => e.target === props.id)
  let prompt = ''
  let first_frame_image = ''
  let last_frame_image = ''
  const images = []

  for (const edge of incoming) {
    const source = nodes.value.find(n => n.id === edge.source)
    if (!source) continue
    if (source.type === 'text' && source.data?.content) prompt = source.data.content
    if (source.type === 'image' && source.data?.url) {
      const role = edge.data?.imageRole || 'first_frame_image'
      const imageData = source.data.base64 || source.data.url
      if (role === 'first_frame_image') first_frame_image = imageData
      else if (role === 'last_frame_image') last_frame_image = imageData
      else images.push(imageData)
    }
  }

  return { prompt, first_frame_image, last_frame_image, images }
}

const runVideoGeneration = async (mode = 'create') => {
  if (!isConfigured.value) {
    window.$message?.warning('Please configure API Key first')
    return
  }

  const { prompt, first_frame_image, last_frame_image, images } = getConnectedInputs()
  const hasInput = prompt || first_frame_image || last_frame_image || images.length > 0
  if (!hasInput) {
    window.$message?.warning('Connect a text or image node first')
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
      ratio: localRatio.value,
      dur: localDuration.value
    })
    updateNode(props.id, {
      loading: false,
      url: result?.url || '',
      model: localModel.value,
      ratio: localRatio.value,
      size: localSize.value,
      dur: localDuration.value,
      updatedAt: Date.now()
    })
    window.$message?.success(mode === 'regenerate' ? 'Video regenerated' : 'Video generated')
  } catch (err) {
    updateNode(props.id, { loading: false, error: err?.message || 'Generation failed' })
    window.$message?.error(err?.message || 'Video generation failed')
  } finally {
    videoActionLoading.value = ''
  }
}

const handleGenerateVideo = () => runVideoGeneration('create')
const handleRegenerateVideo = () => runVideoGeneration('regenerate')

const triggerUpload = () => {
  uploadInputRef.value?.click()
}

const fileToBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

const handleFileUpload = async (event) => {
  const file = event.target.files?.[0]
  if (!file) return
  try {
    const base64 = await fileToBase64(file)
    updateNode(props.id, {
      url: base64,
      base64,
      fileName: file.name,
      fileType: file.type,
      updatedAt: Date.now()
    })
  } catch {
    window.$message?.error('Video upload failed')
  }
}

const handleUrlInput = () => {
  if (!inputUrl.value) return
  updateNode(props.id, { url: inputUrl.value, updatedAt: Date.now() })
  inputUrl.value = ''
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

const selectNode = () => {
  nodes.value = nodes.value.map((node) => ({
    ...node,
    selected: node.id === props.id,
    data: { ...(node.data || {}), selected: node.id === props.id }
  }))
}

const handleMetaMouseDown = () => {
  selectNode()
}

const openPreviewModal = () => {
  if (!props.data?.url) return
  showPreviewModal.value = true
}

const createLinkedNode = (type) => {
  const side = 'right'
  const currentNode = nodes.value.find((n) => n.id === props.id)
  if (!currentNode) return

  const stageWidth = Number.parseFloat(stageStyle.value.width) || 420
  const moduleWidth = stageWidth + 2
  const gapX = 172
  const nextPosition = {
    x: side === 'right' ? currentNode.position.x + moduleWidth + gapX : currentNode.position.x - gapX - moduleWidth,
    y: currentNode.position.y
  }

  const newNodeId = addNode(type, nextPosition)
  if (!newNodeId) return

  if (side === 'right') addEdge({ source: props.id, target: newNodeId, sourceHandle: 'right', targetHandle: 'left' })
  else addEdge({ source: newNodeId, target: props.id, sourceHandle: 'right', targetHandle: 'left' })

  nodes.value = nodes.value.map((node) => ({
    ...node,
    selected: node.id === newNodeId,
    data: { ...(node.data || {}), selected: node.id === newNodeId }
  }))

  setTimeout(() => {
    updateNodeInternals(props.id)
    updateNodeInternals(newNodeId)
  }, 60)
}

watch(
  () => props.data,
  (val) => {
    if (!val) return
    if (val.model && val.model !== localModel.value) localModel.value = val.model
    if (val.ratio && val.ratio !== localRatio.value) localRatio.value = val.ratio
    if (val.size && val.size !== localSize.value) localSize.value = val.size
    if (val.dur && val.dur !== localDuration.value) localDuration.value = val.dur
  },
  { deep: true }
)

</script>

<style scoped>
.video-node-wrapper { position: relative; padding-top: 88px; }
.video-node { cursor: default; position: relative; background: #0f0f0f; }

.node-meta-row {
  position: absolute;
  top: 58px;
  left: 0;
  z-index: 10;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #9ca3af;
  font-size: 14px;
  line-height: 1;
  padding: 0;
  border-radius: 10px;
  cursor: grab;
}
.meta-icon { color: #c9ccd2; }
.meta-title { color: #d7dbe3; font-size: 14px; letter-spacing: 0.01em; }

.module-stage { margin: 0 auto; overflow: hidden; border-radius: inherit; }
.module-progress-shell {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
  background: #101010;
}
.module-progress-track {
  position: absolute;
  inset: 0;
  background: transparent;
}
.module-progress-bar {
  position: absolute;
  inset: 0 auto 0 0;
  width: 0%;
  background: #2d2d2d;
  transition: width 0.12s linear;
}
.module-progress-label {
  position: absolute;
  left: 12px;
  bottom: 10px;
  color: rgba(247, 249, 252, 0.9);
  font-size: 12px;
  line-height: 1;
}
.binding-status-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
}
.binding-status-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
.binding-status-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px 11px;
  border-radius: 999px;
  border: 1px solid rgba(143, 143, 143, 0.45);
  background: #1d1d1d;
  color: #8f939e;
  font-size: 12px;
  line-height: 1;
  white-space: nowrap;
}
.binding-status-pill-idle {
  border-color: rgba(143, 143, 143, 0.36);
  color: #818793;
  background: #1a1a1a;
}
.binding-status-pill-active {
  border-color: rgba(255, 255, 255, 0.62);
  color: #f2f3f5;
  background: #2a2a2a;
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

.capsule-menu { pointer-events: auto; top: 6px; display: inline-flex; align-items: center; gap: 8px; }
.capsule-inner { display: inline-flex; align-items: center; gap: 6px; padding: 7px 9px; border-radius: 999px; border: 1px solid rgba(143, 143, 143, 0.45); background: #1d1d1d; backdrop-filter: blur(10px); }
.capsule-generate { padding: 7px; }
.capsule-group { display: inline-flex; align-items: center; gap: 6px; }
.capsule-divider { width: 1px; height: 18px; background: rgba(255, 255, 255, 0.12); }

.capsule-select { border: 1px solid rgba(255, 255, 255, 0.1); background: rgba(255, 255, 255, 0.02); color: #e7e8eb; border-radius: 999px; font-size: 12px; line-height: 1; padding: 7px 9px; max-width: 148px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.capsule-icon { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 999px; border: 1px solid rgba(255, 255, 255, 0.1); color: #b8bcc5; background: rgba(255, 255, 255, 0.02); }
.capsule-icon-solid { background: #1d1d1d; color: #f6f8fc; border-color: rgba(143, 143, 143, 0.65); }
.capsule-create { width: auto; min-width: 86px; padding: 0 11px; gap: 6px; }
.capsule-create-label { font-size: 12px; line-height: 1; font-weight: 500; }

.node-default { border-width: 0; border-color: transparent; box-shadow: none; }
.node-selected { border-width: 1px; border-color: #8f8f8f; box-shadow: none; }

:deep(.node-handle-plus) {
  width: 28px !important;
  height: 28px !important;
  display: grid !important;
  place-items: center !important;
  border-radius: 999px !important;
  border: 1px solid rgba(214, 216, 222, 0.82) !important;
  background: rgba(11, 13, 17, 0.96) !important;
  color: #d6d8de !important;
  box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.72);
  z-index: 60 !important;
  transition: none !important;
  opacity: 0;
  pointer-events: none;
}

:deep(.node-handle-plus::before) {
  content: "+";
  font-size: 16px;
  font-weight: 500;
  line-height: 1;
  display: block;
  margin: -1px 0 0 0;
}

:deep(.node-handle-plus-left) { left: -25px !important; }
:deep(.node-handle-plus-right) { right: -25px !important; }

:deep(.node-handle-plus-visible) {
  opacity: 1 !important;
  pointer-events: auto !important;
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
