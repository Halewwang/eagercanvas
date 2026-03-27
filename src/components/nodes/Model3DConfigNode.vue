<template>
  <div class="image-node-wrapper node-shell-wrapper" :style="wrapperStyle" @mouseenter="showCapsule = true" @mouseleave="showCapsule = false">
    <div class="node-meta-row">
      <n-icon :size="16" class="meta-icon"><AppsOutline /></n-icon>
      <span class="meta-title">3D Model</span>
    </div>

    <div v-show="showNodeCapsule" class="capsule-menu absolute left-1/2 z-[1200]" :style="capsuleStyle">
      <div class="capsule-inner" :class="{ 'capsule-inner-selected': isSelected }">
        <div class="capsule-group">
          <BaseDropdown :options="modelOptions" :selected-key="localModel" compact @select="handleModelSelect">
            <button class="capsule-select">{{ displayModelName }}</button>
          </BaseDropdown>
          <BaseDropdown :options="generateTypeOptions" :selected-key="localGenerateType" compact @select="handleGenerateTypeSelect">
            <button class="capsule-select">{{ localGenerateType }}</button>
          </BaseDropdown>
          <BaseDropdown
            v-if="showPolygonType"
            :options="polygonTypeOptions"
            :selected-key="localPolygonType"
            compact
            @select="handlePolygonTypeSelect"
          >
            <button class="capsule-select">{{ displayPolygonType }}</button>
          </BaseDropdown>
          <BaseDropdown :options="resultFormatOptions" :selected-key="localResultFormat" compact @select="handleResultFormatSelect">
            <button class="capsule-select">{{ displayResultFormat }}</button>
          </BaseDropdown>
          <button class="capsule-select" :disabled="pbrDisabled" @click="toggleEnablePBR">{{ pbrLabel }}</button>
          <label class="capsule-input-wrap" title="Face Count">
            <span class="capsule-input-prefix">Face</span>
            <input
              v-model="localFaceCount"
              class="capsule-input"
              type="text"
              inputmode="numeric"
              placeholder="Auto"
              @blur="commitFaceCount"
              @keydown.enter.prevent="commitFaceCount"
            />
          </label>
        </div>

        <div class="capsule-divider" />

        <div class="capsule-group">
          <BaseDropdown v-if="downloadOptions.length > 0" :options="downloadOptions" compact @select="downloadAsset">
            <button class="capsule-icon capsule-download-trigger" title="Download">
              <n-icon :size="14"><DownloadOutline /></n-icon>
            </button>
          </BaseDropdown>
          <button v-else class="capsule-icon capsule-download-trigger" title="Download" disabled>
            <n-icon :size="14"><DownloadOutline /></n-icon>
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
        <button
          v-if="!loading"
          class="capsule-icon capsule-icon-solid capsule-create"
          :disabled="!isConfigured || !canGenerate"
          @click="handleGenerate"
          title="Create"
        >
          <img :src="createIcon" alt="" class="capsule-create-graphic" />
          <span class="capsule-create-label">Create</span>
        </button>
        <button
          v-if="!loading"
          class="capsule-icon"
          :disabled="!isConfigured || !canGenerate"
          @click="handleGenerate"
          title="Regenerate"
        >
          <n-icon :size="14"><RefreshOutline /></n-icon>
        </button>
        <button
          v-else
          class="capsule-icon capsule-icon-solid capsule-create"
          disabled
          title="Generating"
        >
          <n-spin :size="14" />
          <span class="capsule-create-label">Generating</span>
        </button>
      </div>
    </div>

    <div
      class="image-node rounded-2xl border relative transition-all duration-200 overflow-visible model3d-config-node"
      :class="[isSelected ? 'node-selected' : 'node-default', { 'node-glow-active': isSelected }]"
      :style="moduleStyle"
    >
      <div class="model3d-stage-shell" :style="stageStyle">
        <div class="module-stage model3d-stage-frame">
          <div v-if="status === 'polling'" class="module-progress-shell">
            <div class="module-progress-track"></div>
            <div class="module-progress-bar" :style="{ width: `${progressPercent}%` }"></div>
            <div class="module-progress-label">Generating 3D... {{ progressPercent }}%</div>
          </div>

          <Model3DViewport
            v-else
            :url="props.data?.url"
            :asset-urls="props.data?.assetUrls || {}"
            :preview-image-url="props.data?.previewImageUrl"
            :alt="props.data?.label || '3D preview'"
            empty-label="Connect prompt and image nodes"
          />
        </div>
      </div>

      <Handle type="source" :position="Position.Right" id="right" :class="['node-handle-plus', 'node-handle-plus-right', { 'node-handle-plus-visible': showHandles }]" />
      <Handle type="target" :position="Position.Left" id="left" :class="['node-handle-plus', 'node-handle-plus-left', { 'node-handle-plus-visible': showHandles }]" />
    </div>

    <div class="binding-status-wrap binding-status-wrap-constrained">
      <div class="binding-status-row binding-status-row-wrap">
        <div class="binding-status-pill" :class="connectedPrompt ? 'binding-status-pill-active' : 'binding-status-pill-idle'">
          Prompt
        </div>
        <div
          v-for="viewType in supportedViewTypes"
          :key="`pill-${viewType}`"
          class="binding-status-pill"
          :class="connectedViewMap[viewType] ? 'binding-status-pill-active' : 'binding-status-pill-idle'"
        >
          {{ formatViewType(viewType) }}
        </div>
      </div>
    </div>

    <div v-if="error" class="mt-2 text-xs text-red-500 text-center">
      {{ error.message || '3D generation failed' }}
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { Handle, Position, useVueFlow } from '@vue-flow/core'
import { NIcon, NSpin } from 'naive-ui'
import { BaseDropdown } from '@/components/ui'
import Model3DViewport from './Model3DViewport.vue'
import { CopyOutline, TrashOutline, AppsOutline, RefreshOutline, DownloadOutline } from '../../icons/coolicons'
import createIcon from '@/assets/create-icon.svg'
import { useApiConfig, useModel3DGeneration } from '../../hooks'
import { duplicateNode, edges, nodes, removeNode, saveProject, updateNode } from '../../stores/canvas'
import { DEFAULT_MODEL3D_MODEL, getModelConfig, model3dModelOptions, resolve3DModelKey } from '../../stores/models'
import { resolveNodeInputs } from '../../services/edgeStrategy'

const props = defineProps({
  id: String,
  data: Object,
  selected: Boolean
})

const { viewport } = useVueFlow()
const { isConfigured } = useApiConfig()
const { loading, error, status, progress, generate } = useModel3DGeneration()

const showCapsule = ref(false)
const localModel = ref(resolve3DModelKey(props.data?.model || DEFAULT_MODEL3D_MODEL))
const localGenerateType = ref(props.data?.generateType || 'Normal')
const localEnablePBR = ref(!!props.data?.enablePBR)
const localFaceCount = ref(String(props.data?.faceCount || ''))
const localResultFormat = ref(String(props.data?.resultFormat || '').toUpperCase())
const localPolygonType = ref(String(props.data?.polygonType || ''))

const modelOptions = computed(() => model3dModelOptions.value.map((item) => ({
  key: item.key,
  label: item.label
})))
const generateTypeOptions = computed(() => (currentModelConfig.value?.generateTypes || []).map((item) => ({ key: item, label: item })))
const polygonTypeOptions = computed(() => (currentModelConfig.value?.polygonTypes || []).map((item) => ({
  key: item.key,
  label: item.label
})))
const resultFormatOptions = computed(() => (currentModelConfig.value?.resultFormats || []).map((item) => ({
  key: item.key,
  label: item.label
})))

const currentModelConfig = computed(() => getModelConfig(localModel.value))
const supportedViewTypes = computed(() => currentModelConfig.value?.viewTypes || [])
const isSelected = computed(() => !!props.selected || !!props.data?.selected)
const showNodeCapsule = computed(() => !props.data?.suppressCapsule && (showCapsule.value || isSelected.value))
const showHandles = computed(() => showCapsule.value || isSelected.value)
const showPolygonType = computed(() => localGenerateType.value === 'LowPoly' && polygonTypeOptions.value.length > 0)

const displayModelName = computed(() => {
  const item = modelOptions.value.find((option) => option.key === localModel.value)
  return item?.label || localModel.value
})
const displayResultFormat = computed(() => {
  const item = resultFormatOptions.value.find((option) => option.key === localResultFormat.value)
  return item?.label || 'Default'
})
const displayPolygonType = computed(() => {
  const item = polygonTypeOptions.value.find((option) => option.key === localPolygonType.value)
  return item?.label || 'Polygon'
})

const inputs = computed(() => resolveNodeInputs(props.id))
const connectedPrompt = computed(() => !!inputs.value.prompt)
const connectedFront = computed(() => !!connectedViewMap.value.front)
const hasConnectedViews = computed(() => (inputs.value.multiViewImages || []).length > 0)
const connectedViewMap = computed(() => {
  const map = {}
  ;(inputs.value.multiViewImages || []).forEach((item) => {
    map[item.viewType] = item
  })
  return map
})

const canGenerate = computed(() => (hasConnectedViews.value ? connectedFront.value : connectedPrompt.value))
const progressPercent = computed(() => Math.round(progress.value?.percentage || 0))
const pbrDisabled = computed(() => localGenerateType.value === 'Geometry')
const pbrLabel = computed(() => (localEnablePBR.value ? 'PBR On' : 'PBR Off'))
const downloadOptions = computed(() => {
  const assetUrls = props.data?.assetUrls || {}
  const directUrl = String(props.data?.url || '').trim()
  const orderedTypes = ['glb', 'obj', 'fbx', 'stl', 'usdz', 'zip']
  const fallbackAssetUrls = {
    ...assetUrls,
    ...(directUrl && /\.glb($|\?)/i.test(directUrl) && !assetUrls.glb ? { glb: directUrl } : {}),
    ...(directUrl && /\.obj($|\?)/i.test(directUrl) && !assetUrls.obj ? { obj: directUrl } : {})
  }
  return orderedTypes
    .filter((type) => String(fallbackAssetUrls[type] || '').trim())
    .map((type) => ({ key: type, label: `Download ${type.toUpperCase()}` }))
})

const formatViewType = (value) => String(value || '').replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())

const capsuleStyle = computed(() => {
  const zoom = viewport.value?.zoom || 1
  const inverse = 1 / zoom
  const safeScale = Math.min(1.06, Math.max(0.82, inverse))
  return { left: '50%', transform: `translateX(-50%) scale(${safeScale})`, transformOrigin: 'top center' }
})

const moduleStyle = computed(() => ({ width: '322px' }))
const stageStyle = computed(() => ({ width: '320px', height: '320px' }))
const wrapperStyle = computed(() => ({ width: moduleStyle.value.width }))

const setModel = (nextModel) => {
  localModel.value = resolve3DModelKey(nextModel)
  const nextConfig = getModelConfig(localModel.value)
  const nextGenerateTypes = nextConfig?.generateTypes || ['Normal']
  const nextFormats = (nextConfig?.resultFormats || []).map((item) => item.key)
  if (!nextGenerateTypes.includes(localGenerateType.value)) {
    localGenerateType.value = nextGenerateTypes[0]
  }
  if (!nextFormats.includes(localResultFormat.value)) {
    localResultFormat.value = ''
  }
  if (!nextConfig?.polygonTypes?.some((item) => item.key === localPolygonType.value)) {
    localPolygonType.value = nextConfig?.defaultParams?.polygonType || ''
  }
  updateNode(props.id, {
    model: localModel.value,
    generateType: localGenerateType.value,
    resultFormat: localResultFormat.value,
    polygonType: localPolygonType.value
  })
}

const handleModelSelect = (key) => setModel(key)
const handleDelete = () => removeNode(props.id)
const handleDuplicate = () => duplicateNode(props.id)
const handleGenerateTypeSelect = (value) => {
  localGenerateType.value = value
  if (value === 'Geometry') {
    localEnablePBR.value = false
  }
  if (value !== 'LowPoly') {
    localPolygonType.value = ''
  } else if (!localPolygonType.value && polygonTypeOptions.value.length > 0) {
    localPolygonType.value = polygonTypeOptions.value[0].key
  }
  updateNode(props.id, {
    generateType: value,
    enablePBR: localEnablePBR.value,
    polygonType: localPolygonType.value
  })
}
const handleResultFormatSelect = (value) => {
  localResultFormat.value = String(value || '').toUpperCase()
  updateNode(props.id, { resultFormat: localResultFormat.value })
}
const toggleEnablePBR = () => {
  if (pbrDisabled.value) return
  localEnablePBR.value = !localEnablePBR.value
  updateNode(props.id, { enablePBR: localEnablePBR.value })
}
const handlePolygonTypeSelect = (value) => {
  localPolygonType.value = String(value || '')
  updateNode(props.id, { polygonType: localPolygonType.value })
}
const commitFaceCount = () => {
  const normalized = String(localFaceCount.value || '').replace(/[^\d]/g, '')
  localFaceCount.value = normalized
  updateNode(props.id, { faceCount: normalized })
}

const cleanupLegacyOutputNode = () => {
  const downstreamEdges = edges.value.filter((edge) => edge.source === props.id)
  downstreamEdges.forEach((edge) => {
    const existingNode = nodes.value.find((node) => node.id === edge.target && node.type === 'model3d')
    if (existingNode) removeNode(existingNode.id)
  })
}

const downloadAsset = (type) => {
  const assetUrls = props.data?.assetUrls || {}
  const directUrl = String(props.data?.url || '').trim()
  const url = assetUrls[type]
    || (type === 'glb' && /\.glb($|\?)/i.test(directUrl) ? directUrl : '')
    || (type === 'obj' && /\.obj($|\?)/i.test(directUrl) ? directUrl : '')
  if (!url) return
  const link = document.createElement('a')
  link.href = url
  link.target = '_blank'
  link.rel = 'noreferrer'
  link.download = `${props.data?.label || 'model3d'}.${type}`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

const handleGenerate = async () => {
  if (hasConnectedViews.value && !connectedFront.value) {
    updateNode(props.id, { status: 'failed', error: '3D generation requires a Front reference image when view-tagged images are connected' })
    return
  }

  const multiViewImages = (inputs.value.multiViewImages || []).map((item) => ({
    viewType: item.viewType,
    source: item.value
  }))

  updateNode(props.id, { status: 'running', model: localModel.value })

  try {
    updateNode(props.id, { error: '' })
    const result = await generate({
      model: localModel.value,
      prompt: inputs.value.prompt,
      multiViewImages,
      generateType: localGenerateType.value,
      enablePBR: localEnablePBR.value,
      faceCount: localFaceCount.value,
      resultFormat: localResultFormat.value,
      polygonType: localPolygonType.value
    })

    cleanupLegacyOutputNode()
    updateNode(props.id, {
      url: result.viewerUrl || result.primaryUrl,
      previewImageUrl: result.previewImageUrl,
      assetUrls: result.assetUrls,
      model: localModel.value,
      status: 'completed'
    })
    await saveProject()
  } catch (err) {
    updateNode(props.id, { status: 'failed', error: err.message || '3D generation failed' })
  }
}

watch(
  () => props.data?.model,
  (nextModel) => {
    if (nextModel && nextModel !== localModel.value) {
      localModel.value = resolve3DModelKey(nextModel)
    }
  },
  { immediate: true }
)
watch(() => props.data?.generateType, (value) => {
  if (value && value !== localGenerateType.value) localGenerateType.value = value
})
watch(() => props.data?.enablePBR, (value) => {
  localEnablePBR.value = !!value
})
watch(() => props.data?.faceCount, (value) => {
  localFaceCount.value = String(value || '')
})
watch(() => props.data?.resultFormat, (value) => {
  localResultFormat.value = String(value || '').toUpperCase()
})
watch(() => props.data?.polygonType, (value) => {
  localPolygonType.value = String(value || '')
})
</script>

<style scoped>
.capsule-download-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}

.capsule-download-trigger :deep(svg) {
  display: block;
  flex-shrink: 0;
}

.capsule-download-trigger:disabled {
  opacity: 0.45;
}

.model3d-config-node::after {
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

.binding-status-row-wrap {
  flex-wrap: wrap;
  width: 100%;
  justify-content: center;
}

.binding-status-wrap-constrained {
  width: 322px;
}

.binding-status-wrap-constrained .binding-status-row {
  max-width: 100%;
  row-gap: 8px;
}

.model3d-stage-shell {
  margin: 0 auto;
  border-radius: 20px;
  overflow: hidden;
  background: #0f0f0f;
}

.model3d-stage-frame {
  width: 100%;
  height: 100%;
  background: #0f0f0f;
  border-radius: inherit;
  overflow: hidden;
}

.capsule-input-wrap {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 10px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.02);
  color: #e7e8eb;
}

.capsule-input-prefix {
  font-size: 12px;
  line-height: 1;
  color: #cfd3dc;
}

.capsule-input {
  width: 52px;
  background: transparent;
  border: 0;
  outline: none;
  color: #f3f4f6;
  font-size: 12px;
  line-height: 1;
}

.capsule-input::placeholder {
  color: #818793;
}

.view-pill {
  padding: 0.25rem 0.72rem;
  border-radius: 999px;
  font-size: 11px;
  line-height: 1rem;
}

.view-pill-active {
  background: #2a2a2a;
  color: #f2f3f5;
  border: 1px solid rgba(255, 255, 255, 0.62);
}

.view-pill-idle {
  background: #1a1a1a;
  color: #818793;
  border: 1px solid rgba(143, 143, 143, 0.36);
}

:deep(.model3d-config-node .model3d-stage-frame > div) {
  border-radius: inherit;
  overflow: hidden;
}
</style>

<style scoped src="./node-base.css"></style>
