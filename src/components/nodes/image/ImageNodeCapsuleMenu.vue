<template>
  <div class="capsule-menu absolute left-1/2 z-[1200]" :style="capsuleStyle">
    <div class="capsule-inner" :class="{ 'capsule-inner-selected': selected }">
      <div class="capsule-group">
        <NDropdown :options="imageModelOptions" trigger="click" size="small" @select="$emit('selectModel', $event)">
          <button class="capsule-select">{{ displayImageModel }}</button>
        </NDropdown>

        <NDropdown v-if="ratioOptions.length > 0" :options="ratioOptions" trigger="click" size="small" @select="$emit('selectRatio', $event)">
          <button class="capsule-select">{{ displayRatio }}</button>
        </NDropdown>

        <NDropdown v-if="resolutionOptions.length > 0" :options="resolutionOptions" trigger="click" size="small" @select="$emit('selectResolution', $event)">
          <button class="capsule-select capsule-resolution">{{ displayResolution }}</button>
        </NDropdown>

        <NDropdown v-if="qualityOptions.length > 0" :options="qualityOptions" trigger="click" size="small" @select="$emit('selectQuality', $event)">
          <button class="capsule-select">{{ displayQuality }}</button>
        </NDropdown>

        <NDropdown v-if="formatOptions.length > 1" :options="formatOptions" trigger="click" size="small" @select="$emit('selectFormat', $event)">
          <button class="capsule-select">{{ displayFormat }}</button>
        </NDropdown>
        <NDropdown v-if="hasDisplayImage" :options="exportRatioOptions" trigger="click" size="small" :disabled="toolBusy || localExportBusy || !imageDimensionsReady" @select="$emit('selectExportRatio', $event)">
          <button class="capsule-select" :disabled="toolBusy || localExportBusy || !imageDimensionsReady" title="Crop locally for PNG export; keep the original image unchanged">
            {{ exportRatio ? `Export ratio ${exportRatio}` : 'Export ratio' }}
          </button>
        </NDropdown>
        <NDropdown v-if="hasDisplayImage" :options="exportSizeOptions" trigger="click" size="small" :disabled="toolBusy || localExportBusy" @select="$emit('exportImage', $event)">
          <button class="capsule-select" :disabled="toolBusy || localExportBusy" title="Download PNG locally at the selected size; keep the original image unchanged">
            {{ localExportBusy ? 'Exporting…' : 'Export PNG' }}
          </button>
        </NDropdown>
      </div>

      <div class="capsule-divider" />

      <div class="capsule-group">
        <NDropdown v-if="toolOptions.length > 0" :options="toolOptions" :disabled="toolBusy" trigger="click" size="small" @select="$emit('toolAction', $event)">
          <button class="capsule-select capsule-tool-trigger" :disabled="toolBusy">
            <img :src="toolsIcon" alt="" class="capsule-tool-icon" />
            <span>Tools</span>
          </button>
        </NDropdown>
        <button class="capsule-icon" :disabled="!hasDisplayImage" title="Preview" @click="$emit('preview')">
          <n-icon :size="14"><ExpandOutline /></n-icon>
        </button>
        <button class="capsule-icon" title="Duplicate" @click="$emit('duplicate')">
          <n-icon :size="14"><CopyOutline /></n-icon>
        </button>

        <button class="capsule-icon" title="Delete" @click="$emit('delete')">
          <n-icon :size="14"><TrashOutline /></n-icon>
        </button>
      </div>
    </div>
    <div class="capsule-inner capsule-generate" :class="{ 'capsule-inner-selected': selected }">
      <button v-if="!imageBusy" class="capsule-icon capsule-icon-solid capsule-create" title="Create" @click="$emit('create')">
        <img :src="createIcon" alt="" class="capsule-create-graphic" />
        <span class="capsule-create-label">Create</span>
      </button>
      <button v-if="!imageBusy" class="capsule-icon" title="Regenerate" @click="$emit('regenerate')">
        <n-icon :size="14"><RefreshOutline /></n-icon>
      </button>
      <button v-if="imageBusy" class="capsule-icon capsule-icon-solid capsule-create" title="Stop" @click="$emit('stop')">
        <n-icon :size="14"><CloseCircleOutline /></n-icon>
        <span class="capsule-create-label">Stop</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { NDropdown, NIcon } from 'naive-ui'
import {
  CloseCircleOutline,
  CopyOutline,
  ExpandOutline,
  RefreshOutline,
  TrashOutline
} from '@/icons/coolicons'
import createIcon from '@/assets/create-icon.svg'
import toolsIcon from '@/assets/tools-icon.svg'

defineProps({
  capsuleStyle: {
    type: Object,
    default: () => ({})
  },
  selected: Boolean,
  imageModelOptions: {
    type: Array,
    default: () => []
  },
  displayImageModel: {
    type: String,
    default: ''
  },
  ratioOptions: {
    type: Array,
    default: () => []
  },
  displayRatio: {
    type: String,
    default: ''
  },
  resolutionOptions: {
    type: Array,
    default: () => []
  },
  displayResolution: {
    type: String,
    default: ''
  },
  qualityOptions: {
    type: Array,
    default: () => []
  },
  displayQuality: {
    type: String,
    default: ''
  },
  formatOptions: {
    type: Array,
    default: () => []
  },
  displayFormat: {
    type: String,
    default: ''
  },
  exportRatioOptions: { type: Array, default: () => [] },
  exportSizeOptions: { type: Array, default: () => [] },
  exportRatio: { type: String, default: '' },
  localExportBusy: Boolean,
  toolOptions: {
    type: Array,
    default: () => []
  },
  hasDisplayImage: Boolean,
  imageDimensionsReady: Boolean,
  toolBusy: Boolean,
  imageBusy: Boolean
})

defineEmits([
  'selectModel',
  'selectRatio',
  'selectResolution',
  'selectQuality',
  'selectFormat',
  'selectExportRatio',
  'exportImage',
  'toolAction',
  'preview',
  'duplicate',
  'delete',
  'create',
  'regenerate',
  'stop'
])
</script>

<style scoped src="./../node-base.css"></style>
<style scoped>
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
