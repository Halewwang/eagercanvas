<template>
  <div class="capsule-menu absolute left-1/2 z-[1200]" :style="capsuleStyle">
    <div class="capsule-inner" :class="{ 'capsule-inner-selected': selected }">
      <div class="capsule-group">
        <BaseDropdown :options="imageModelOptions" compact @select="$emit('selectModel', $event)">
          <button class="capsule-select">{{ displayImageModel }}</button>
        </BaseDropdown>

        <BaseDropdown v-if="ratioOptions.length > 0" :options="ratioOptions" compact @select="$emit('selectRatio', $event)">
          <button class="capsule-select">{{ displayRatio }}</button>
        </BaseDropdown>

        <BaseDropdown v-if="resolutionOptions.length > 0" :options="resolutionOptions" compact @select="$emit('selectResolution', $event)">
          <button class="capsule-select capsule-resolution">{{ displayResolution }}</button>
        </BaseDropdown>

        <BaseDropdown v-if="qualityOptions.length > 0" :options="qualityOptions" compact @select="$emit('selectQuality', $event)">
          <button class="capsule-select">{{ displayQuality }}</button>
        </BaseDropdown>

        <BaseDropdown v-if="backgroundOptions.length > 0" :options="backgroundOptions" compact @select="$emit('selectBackground', $event)">
          <button class="capsule-select">{{ displayBackground }}</button>
        </BaseDropdown>

        <BaseDropdown v-if="formatOptions.length > 0" :options="formatOptions" compact @select="$emit('selectFormat', $event)">
          <button class="capsule-select">{{ displayFormat }}</button>
        </BaseDropdown>
      </div>

      <div class="capsule-divider" />

      <div class="capsule-group">
        <BaseDropdown :options="toolOptions" compact @select="$emit('toolAction', $event)">
          <button class="capsule-select capsule-tool-trigger" :disabled="!hasDisplayImage || toolBusy">
            <img :src="toolsIcon" alt="" class="capsule-tool-icon" />
            <span>Tools</span>
          </button>
        </BaseDropdown>
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
import { NIcon } from 'naive-ui'
import { BaseDropdown } from '@/components/ui'
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
  backgroundOptions: {
    type: Array,
    default: () => []
  },
  displayBackground: {
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
  toolOptions: {
    type: Array,
    default: () => []
  },
  hasDisplayImage: Boolean,
  toolBusy: Boolean,
  imageBusy: Boolean
})

defineEmits([
  'selectModel',
  'selectRatio',
  'selectResolution',
  'selectQuality',
  'selectBackground',
  'selectFormat',
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
