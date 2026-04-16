<template>
  <div class="model3d-node-wrapper node-shell-wrapper" @mouseenter="showCapsule = true" @mouseleave="showCapsule = false">
    <div class="node-meta-row">
      <n-icon :size="16" class="meta-icon"><AppsOutline /></n-icon>
      <span class="meta-title">3D Model</span>
    </div>

    <div v-show="showCapsule" class="capsule-menu absolute left-1/2 z-[1200]" :style="capsuleStyle">
      <div class="capsule-inner" :class="{ 'capsule-inner-selected': isSelected }">
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
    </div>

    <div
      class="image-node rounded-2xl border relative transition-all duration-200 overflow-visible"
      :class="[isSelected ? 'node-selected' : 'node-default', { 'node-glow-active': isSelected }]"
      :style="moduleStyle"
    >
      <div class="module-stage" :style="stageStyle">
        <div v-if="status === 'running'" class="module-progress-shell">
          <div class="module-progress-track"></div>
          <div class="module-progress-bar" :style="{ width: '70%' }"></div>
          <div class="module-progress-label">Generating 3D model...</div>
        </div>
        <Model3DViewport
          v-else
          :url="data.url"
          :asset-urls="assetUrls"
          :preview-image-url="data.previewImageUrl"
          :interactive="isModelViewerActive"
          :alt="data.label || '3D preview'"
          empty-label="Run the 3D config node to preview the model here"
        />
      </div>

      <div class="model3d-footer">
        <span class="model3d-chip">{{ displayModelName }}</span>
        <span class="model3d-chip model3d-chip-muted">{{ statusLabel }}</span>
      </div>

      <Handle type="target" :position="Position.Left" id="left" class="!bg-[#d6d8de] !border-2 !border-[#0f0f0f]" />
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import { NIcon } from 'naive-ui'
import { BaseDropdown } from '@/components/ui'
import Model3DViewport from './Model3DViewport.vue'
import { AppsOutline, CopyOutline, DownloadOutline, TrashOutline } from '../../icons/coolicons'
import { duplicateNode, removeNode } from '../../stores/canvas'
import { getModelConfig } from '../../stores/models'

const props = defineProps({
  id: String,
  data: Object
})

const showCapsule = ref(false)
const assetUrls = computed(() => props.data?.assetUrls || {})
const directUrl = computed(() => String(props.data?.url || '').trim())
const fallbackViewerUrl = computed(() => (/\.glb($|\?)/i.test(directUrl.value) ? directUrl.value : String(props.data?.assetUrls?.glb || '').trim()))
const fallbackObjUrl = computed(() => (/\.obj($|\?)/i.test(directUrl.value) ? directUrl.value : String(props.data?.assetUrls?.obj || '').trim()))
const status = computed(() => String(props.data?.status || 'idle').toLowerCase())
const statusLabel = computed(() => {
  if (status.value === 'running') return 'Generating'
  if (status.value === 'completed') return 'Interactive'
  if (status.value === 'failed') return 'Failed'
  return 'Idle'
})
const displayModelName = computed(() => getModelConfig(props.data?.model)?.label || props.data?.model || '3D Model')
const isSelected = computed(() => !!props.data?.selected)
const isModelViewerActive = computed(() => showCapsule.value || isSelected.value || !props.data?.previewImageUrl)
const objStageRef = ref(null)
const downloadOptions = computed(() => {
  const orderedTypes = ['glb', 'obj', 'fbx', 'stl', 'usdz', 'zip']
  const fallbackAssetUrls = {
    ...assetUrls.value,
    ...(fallbackViewerUrl.value && !assetUrls.value?.glb ? { glb: fallbackViewerUrl.value } : {}),
    ...(fallbackObjUrl.value && !assetUrls.value?.obj ? { obj: fallbackObjUrl.value } : {})
  }
  return orderedTypes
    .filter((type) => String(fallbackAssetUrls[type] || '').trim())
    .map((type) => ({
      key: type,
      label: `Download ${type.toUpperCase()}`
    }))
})

const moduleStyle = computed(() => ({
  width: '320px',
  minHeight: '280px',
  background: '#0f0f0f',
  borderColor: isSelected.value ? '#8f8f8f' : 'transparent'
}))

const stageStyle = computed(() => ({
  height: '238px',
  borderRadius: '18px 18px 0 0',
  overflow: 'hidden'
}))

const capsuleStyle = computed(() => ({
  top: '-18px',
  transform: 'translateX(-50%)'
}))

const handleDelete = () => removeNode(props.id)
const handleDuplicate = () => duplicateNode(props.id)

const downloadAsset = (type) => {
  const directUrl = String(props.data?.url || '').trim()
  const url = assetUrls.value[type]
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

.model3d-footer {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.85rem 1rem 1rem;
}

.model3d-chip {
  border: 1px solid rgba(255, 255, 255, 0.16);
  color: #eceff2;
  border-radius: 999px;
  padding: 0.25rem 0.65rem;
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.model3d-chip-muted {
  color: #9ca3af;
}
</style>

<style scoped src="./node-base.css"></style>
