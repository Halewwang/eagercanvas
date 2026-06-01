<template>
  <div class="capsule-menu absolute left-1/2 z-[1200]" :style="capsuleStyle">
    <div class="capsule-inner" :class="{ 'capsule-inner-selected': selected }">
      <div class="capsule-group">
        <BaseDropdown :options="modelOptions" compact @select="$emit('selectModel', $event)">
          <button class="capsule-select">{{ displayModel }}</button>
        </BaseDropdown>
        <BaseDropdown v-if="inputProfile.allowRatio" :options="ratioOptions" compact @select="$emit('selectRatio', $event)">
          <button class="capsule-select">{{ displayRatio }}</button>
        </BaseDropdown>
        <BaseDropdown v-if="inputProfile.allowType && typeOptions.length > 0" :options="typeOptions" compact @select="$emit('selectO1Type', $event)">
          <button class="capsule-select">{{ displayO1Type }}</button>
        </BaseDropdown>
        <BaseDropdown v-if="inputProfile.allowMode && modeOptions.length > 0" :options="modeOptions" compact @select="$emit('selectMode', $event)">
          <button class="capsule-select">{{ displayMode }}</button>
        </BaseDropdown>
        <BaseDropdown v-if="inputProfile.allowSize && sizeOptions.length > 0" :options="sizeOptions" compact @select="$emit('selectSize', $event)">
          <button class="capsule-select">{{ displaySize }}</button>
        </BaseDropdown>
        <BaseDropdown v-if="inputProfile.allowResolution && resolutionOptions.length > 0" :options="resolutionOptions" compact @select="$emit('selectResolution', $event)">
          <button class="capsule-select">{{ displayResolution }}</button>
        </BaseDropdown>
        <BaseDropdown v-if="inputProfile.allowAudioToggle && supportsAudioToggle" :options="audioOptions" compact @select="$emit('selectGenerateAudio', $event)">
          <button class="capsule-select">{{ displayAudio }}</button>
        </BaseDropdown>
        <BaseDropdown v-if="inputProfile.allowDuration && durationOptions.length > 0" :options="durationOptions" compact @select="$emit('selectDuration', $event)">
          <button class="capsule-select">{{ displayDuration }}s</button>
        </BaseDropdown>
      </div>

      <div class="capsule-divider" />

      <div class="capsule-group">
        <BaseDropdown :options="toolOptions" compact @select="$emit('toolAction', $event)">
          <button class="capsule-select capsule-tool-trigger" :disabled="toolsDisabled">
            <img :src="toolsIcon" alt="" class="capsule-tool-icon" />
            <span>Tools</span>
          </button>
        </BaseDropdown>
        <button class="capsule-icon" :disabled="!hasVideo" title="Preview" @click="$emit('preview')">
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
      <button v-if="!videoBusy" class="capsule-icon capsule-icon-solid capsule-create" title="Create" @click="$emit('create')">
        <img :src="createIcon" alt="" class="capsule-create-graphic" />
        <span class="capsule-create-label">Create</span>
      </button>
      <button v-if="!videoBusy" class="capsule-icon" title="Regenerate" @click="$emit('regenerate')">
        <n-icon :size="14"><RefreshOutline /></n-icon>
      </button>
      <button v-if="videoBusy" class="capsule-icon capsule-icon-solid capsule-create" title="Stop" @click="$emit('stop')">
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
  modelOptions: {
    type: Array,
    default: () => []
  },
  displayModel: {
    type: String,
    default: ''
  },
  inputProfile: {
    type: Object,
    default: () => ({})
  },
  ratioOptions: {
    type: Array,
    default: () => []
  },
  displayRatio: {
    type: String,
    default: ''
  },
  typeOptions: {
    type: Array,
    default: () => []
  },
  displayO1Type: {
    type: String,
    default: ''
  },
  modeOptions: {
    type: Array,
    default: () => []
  },
  displayMode: {
    type: String,
    default: ''
  },
  sizeOptions: {
    type: Array,
    default: () => []
  },
  displaySize: {
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
  supportsAudioToggle: Boolean,
  audioOptions: {
    type: Array,
    default: () => []
  },
  displayAudio: {
    type: String,
    default: ''
  },
  durationOptions: {
    type: Array,
    default: () => []
  },
  displayDuration: {
    type: [String, Number],
    default: ''
  },
  toolOptions: {
    type: Array,
    default: () => []
  },
  toolsDisabled: Boolean,
  hasVideo: Boolean,
  videoBusy: Boolean
})

defineEmits([
  'selectModel',
  'selectRatio',
  'selectO1Type',
  'selectMode',
  'selectSize',
  'selectResolution',
  'selectGenerateAudio',
  'selectDuration',
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
</style>
