<template>
  <div class="image-node-wrapper" @mouseenter="showCapsule = true" @mouseleave="showCapsule = false">
    <div class="node-meta-row" @mousedown="handleMetaMouseDown">
      <n-icon :size="16" class="meta-icon"><ImageOutline /></n-icon>
      <span class="meta-title">Image</span>
    </div>

    <div v-show="showCapsule || isSelected" class="capsule-menu absolute left-1/2 z-[1200]" :style="capsuleStyle">
      <div class="capsule-inner">
        <div class="capsule-group">
          <n-dropdown :options="imageModelDropdownOptions" @select="setImageModel">
            <button class="capsule-select">{{ displayImageModel }}</button>
          </n-dropdown>

          <n-dropdown :options="ratioDropdownOptions" @select="setImageRatio">
            <button class="capsule-select">{{ displayRatio }}</button>
          </n-dropdown>

          <n-dropdown :options="resolutionDropdownOptions" @select="setResolution">
            <button class="capsule-select capsule-resolution">{{ displayResolution }}</button>
          </n-dropdown>
        </div>

        <div class="capsule-divider" />

        <div class="capsule-group">
          <n-dropdown :options="createLinkOptions" @select="createLinkedNode">
            <button class="capsule-icon" title="Create linked module">
              <n-icon :size="14"><AddOutline /></n-icon>
            </button>
          </n-dropdown>
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
      <div class="capsule-inner capsule-generate">
        <button class="capsule-icon capsule-icon-solid capsule-create" :disabled="isImageBusy" @click="handleGenerateImage" title="Create">
          <n-spin v-if="imageActionLoading === 'create'" :size="12" />
          <template v-else>
            <n-icon :size="14"><SparklesOutline /></n-icon>
            <span class="capsule-create-label">Create</span>
          </template>
        </button>
        <button class="capsule-icon" :disabled="isImageBusy" @click="handleRegenerateImage" title="Regenerate">
          <n-spin v-if="imageActionLoading === 'regenerate'" :size="12" />
          <n-icon v-else :size="14"><RefreshOutline /></n-icon>
        </button>
      </div>
    </div>

    <div
      class="image-node rounded-2xl border relative transition-all duration-200 overflow-visible"
      :class="isSelected ? 'node-selected' : 'node-default'"
      :style="moduleStyle"
    >
      <div class="module-stage" :style="stageStyle">
        <div v-if="showProgress" class="module-progress-shell">
          <div class="module-progress-track"></div>
          <div class="module-progress-bar" :style="progressBarStyle"></div>
          <div class="module-progress-label">Generating image... {{ progressPercent }}%</div>
        </div>

        <div
          v-else-if="data.error"
          class="w-full h-full bg-[#231a1d] flex flex-col items-center justify-center gap-2"
        >
          <n-icon :size="30" class="text-red-500"><CloseCircleOutline /></n-icon>
          <span class="text-sm text-red-400 text-center px-3">{{ data.error }}</span>
        </div>

        <img
          v-else-if="data.url"
          :src="data.url"
          :alt="data.label || 'Image'"
          class="w-full h-full object-cover"
        />

        <div
          v-else-if="urlLoading"
          class="w-full h-full bg-[#1a1c21] flex flex-col items-center justify-center gap-3"
        >
          <img src="../../assets/loading.webp" alt="Loading" class="w-14 h-12" />
          <span class="text-sm text-white font-medium">Loading...</span>
        </div>

        <div v-else class="w-full h-full bg-[#0f0f0f] flex flex-col items-center justify-center gap-2 relative text-center px-4">
          <n-icon :size="32" class="text-[#7b818c]"><ImageOutline /></n-icon>
          <span class="text-sm text-[#7b818c]">Drop an image or click to upload</span>
          <button class="upload-btn" @click="triggerUpload">Upload</button>
          <input ref="uploadInputRef" type="file" accept="image/*" class="hidden" @change="handleFileUpload" />
        </div>
      </div>

      <Handle type="source" :position="Position.Right" id="right" :class="['node-handle-plus', 'node-handle-plus-right', { 'node-handle-plus-visible': showHandles }]" />
      <Handle type="target" :position="Position.Left" id="left" :class="['node-handle-plus', 'node-handle-plus-left', { 'node-handle-plus-visible': showHandles }]" />

    </div>

    <n-modal v-model:show="showPreviewModal" :mask-closable="true">
      <div class="zoom-modal-card" @click.stop>
        <img :src="data.url" alt="Preview" class="zoom-image-original" />
      </div>
    </n-modal>

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
  </div>
</template>

<script setup>
import { computed, onUnmounted, ref, watch } from 'vue'
import { Handle, Position, useVueFlow } from '@vue-flow/core'
import { NDropdown, NIcon, NModal, NSpin } from 'naive-ui'
import {
  AddOutline,
  CloseCircleOutline,
  CopyOutline,
  ExpandOutline,
  ImageOutline,
  RefreshOutline,
  SparklesOutline,
  TrashOutline
} from '../../icons/coolicons'
import { addEdge, addNode, duplicateNode, edges, nodes, removeNode, updateNode } from '../../stores/canvas'
import {
  DEFAULT_IMAGE_MODEL,
  DEFAULT_IMAGE_SIZE,
  getModelConfig,
  getModelSizeOptions,
  imageModelOptions
} from '../../stores/models'
import { useApiConfig, useImageGeneration } from '../../hooks'

const props = defineProps({
  id: String,
  data: Object,
  selected: Boolean
})

const { updateNodeInternals, viewport } = useVueFlow()
const { isConfigured } = useApiConfig()
const imageGen = useImageGeneration()

const showCapsule = ref(false)
const urlLoading = ref(false)
const isSelected = computed(() => !!props.selected || !!props.data?.selected)
const showHandles = computed(() => showCapsule.value || isSelected.value)

const localImageModel = ref(props.data?.model || DEFAULT_IMAGE_MODEL)
const localImageSize = ref(props.data?.size || DEFAULT_IMAGE_SIZE)
const localImageQuality = ref(props.data?.quality || 'standard')
const localImageRatio = ref('1:1')
const localResolution = ref('1k')
const uploadInputRef = ref(null)
const showPreviewModal = ref(false)
const imageActionLoading = ref('')
const progressValue = ref(0)
const showProgress = ref(false)
const progressTimer = ref(null)
const progressFinishTimer = ref(null)
const createLinkOptions = [
  { label: 'Link Text Module', key: 'text' },
  { label: 'Link Image Module', key: 'image' },
  { label: 'Link Video Module', key: 'video' }
]
const imageInputStatusMap = {
  prompt: 'Prompt',
  reference: 'Reference Picture'
}

const BASE_SIZE_BY_RATIO = {
  '1:1': { w: 1024, h: 1024 },
  '4:3': { w: 1152, h: 864 },
  '3:4': { w: 864, h: 1152 },
  '16:9': { w: 1280, h: 720 },
  '9:16': { w: 720, h: 1280 }
}

const ratioFromSizeKey = (sizeKey) => {
  const [w, h] = String(sizeKey || '').split('x').map(Number)
  if (!w || !h) return '1:1'
  const ratio = w / h
  if (Math.abs(ratio - 1) < 0.02) return '1:1'
  if (Math.abs(ratio - 16 / 9) < 0.03) return '16:9'
  if (Math.abs(ratio - 9 / 16) < 0.03) return '9:16'
  if (Math.abs(ratio - 4 / 3) < 0.03) return '4:3'
  if (Math.abs(ratio - 3 / 4) < 0.03) return '3:4'
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
  const [w, h] = String(localImageSize.value || '').split('x').map(Number)
  if (!w || !h) return '1:1'
  const ratio = w / h
  if (Math.abs(ratio - 1) < 0.02) return '1:1'
  if (Math.abs(ratio - 16 / 9) < 0.03) return '16:9'
  if (Math.abs(ratio - 9 / 16) < 0.03) return '9:16'
  if (Math.abs(ratio - 4 / 3) < 0.03) return '4:3'
  if (Math.abs(ratio - 3 / 4) < 0.03) return '3:4'
  return '1:1'
})

const stageStyle = computed(() => {
  const ratio = ratioFromSize.value
  const map = {
    '1:1': { width: 320, height: 320 },
    '16:9': { width: 420, height: 236 },
    '9:16': { width: 260, height: 462 },
    '4:3': { width: 360, height: 270 },
    '3:4': { width: 280, height: 373 }
  }
  const picked = map[ratio] || map['1:1']
  return {
    width: `${picked.width}px`,
    height: `${picked.height}px`
  }
})

const moduleStyle = computed(() => ({ width: `calc(${stageStyle.value.width} + 2px)` }))
const progressPercent = computed(() => Math.round(progressValue.value))
const progressBarStyle = computed(() => ({ width: `${Math.max(0, Math.min(100, progressValue.value))}%` }))
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
  const incoming = edges.value.filter(e => e.target === props.id)
  const promptParts = []
  const imageRefs = []

  for (const edge of incoming) {
    const source = nodes.value.find(n => n.id === edge.source)
    if (!source || source.id === props.id) continue

    if (source.type === 'text' && source.data?.content) {
      promptParts.push({ order: edge.data?.promptOrder || 1, content: source.data.content })
    }

    if (source.type === 'image' && source.data?.url) {
      imageRefs.push({ order: edge.data?.imageOrder || 1, image: source.data.base64 || source.data.url })
    }
  }

  promptParts.sort((a, b) => a.order - b.order)
  imageRefs.sort((a, b) => a.order - b.order)

  return {
    prompt: promptParts.map(p => p.content).join('\n\n').trim(),
    refImages: imageRefs.map(i => i.image)
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

const runImageGeneration = async (mode = 'create') => {
  if (!isConfigured.value) {
    window.$message?.warning('Please configure API Key first')
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
      image: mergedRefs
    })

    if (!result?.[0]?.url) {
      throw new Error('No image output')
    }

    updateNode(props.id, {
      url: result[0].url,
      loading: false,
      model: localImageModel.value,
      size: localImageSize.value,
      quality: localImageQuality.value,
      updatedAt: Date.now()
    })
    window.$message?.success(mode === 'regenerate' ? 'Image regenerated' : 'Image generated')
  } catch (err) {
    updateNode(props.id, { loading: false, error: err?.message || 'Generation failed' })
    window.$message?.error(err?.message || 'Image generation failed')
  } finally {
    imageActionLoading.value = ''
  }
}
const handleGenerateImage = () => runImageGeneration('create')
const handleRegenerateImage = () => runImageGeneration('regenerate')

const fileToBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

const triggerUpload = () => {
  uploadInputRef.value?.click()
}

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
      label: 'Image',
      updatedAt: Date.now()
    })
    setTimeout(() => updateNodeInternals(props.id), 30)
  } catch {
    window.$message?.error('Image upload failed')
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
  setTimeout(() => updateNodeInternals(newId), 50)
}

const selectNode = () => {
  nodes.value = nodes.value.map((node) => ({
    ...node,
    selected: node.id === props.id,
    data: {
      ...(node.data || {}),
      selected: node.id === props.id
    }
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

  const stageWidth = Number.parseFloat(stageStyle.value.width) || 320
  const moduleWidth = stageWidth + 2
  const gapX = 172
  const nextPosition = {
    x: side === 'right' ? currentNode.position.x + moduleWidth + gapX : currentNode.position.x - gapX - moduleWidth,
    y: currentNode.position.y
  }

  const newNodeId = addNode(type, nextPosition)
  if (!newNodeId) return

  if (side === 'right') {
    addEdge({
      source: props.id,
      target: newNodeId,
      sourceHandle: 'right',
      targetHandle: 'left'
    })
  } else {
    addEdge({
      source: newNodeId,
      target: props.id,
      sourceHandle: 'right',
      targetHandle: 'left'
    })
  }

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
}

</script>

<style scoped>
.image-node-wrapper {
  position: relative;
  padding-top: 88px;
}

.image-node {
  cursor: default;
  position: relative;
  background: #0f0f0f;
}

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

.meta-icon {
  color: #c9ccd2;
}

.meta-title {
  color: #d7dbe3;
  font-size: 14px;
  letter-spacing: 0.01em;
}

.module-stage {
  margin: 0 auto;
  overflow: hidden;
  border-radius: inherit;
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

.capsule-menu {
  pointer-events: auto;
  top: 6px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.capsule-inner {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 9px;
  border-radius: 999px;
  border: 1px solid rgba(143, 143, 143, 0.45);
  background: #1d1d1d;
  backdrop-filter: blur(10px);
}

.capsule-generate {
  padding: 7px;
}

.capsule-group {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.capsule-divider {
  width: 1px;
  height: 18px;
  background: rgba(255, 255, 255, 0.12);
}

.capsule-select {
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.02);
  color: #e7e8eb;
  border-radius: 999px;
  font-size: 12px;
  line-height: 1;
  padding: 7px 9px;
  max-width: 148px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.capsule-resolution {
  min-width: 0;
  max-width: none;
  text-align: left;
}

.capsule-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #b8bcc5;
  background: rgba(255, 255, 255, 0.02);
  transition: all 0.2s;
}

.capsule-icon-solid {
  background: #1d1d1d;
  color: #f6f8fc;
  border-color: rgba(143, 143, 143, 0.65);
}

.capsule-create {
  width: auto;
  min-width: 86px;
  padding: 0 11px;
  gap: 6px;
}

.capsule-create-label {
  font-size: 12px;
  line-height: 1;
  font-weight: 500;
}

.capsule-icon:hover:not(:disabled) {
  color: #f0f2f5;
  border-color: rgba(255, 255, 255, 0.28);
}

.capsule-icon:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.node-default {
  border-width: 0;
  border-color: transparent;
  box-shadow: none;
}

.node-selected {
  border-width: 1px;
  border-color: #8f8f8f;
  box-shadow: none;
}

:deep(.node-handle-plus) {
  width: 28px !important;
  height: 28px !important;
  display: grid !important;
  place-items: center !important;
  align-items: center !important;
  justify-content: center !important;
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

:deep(.node-handle-plus-left) {
  left: -25px !important;
}

:deep(.node-handle-plus-right) {
  right: -25px !important;
}

:deep(.node-handle-plus-visible) {
  opacity: 1 !important;
  pointer-events: auto !important;
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
</style>
