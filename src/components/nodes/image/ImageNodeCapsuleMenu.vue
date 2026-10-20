<template>
  <div class="capsule-menu absolute left-1/2 z-[1200]" :style="capsuleStyle">
    <div class="capsule-inner" :class="{ 'capsule-inner-selected': selected }">
      <div class="capsule-group">
        <NDropdown :options="imageModelOptions" trigger="click" size="small" @select="$emit('selectModel', $event)">
          <button class="capsule-select">{{ displayImageModel }}</button>
        </NDropdown>

        <NDropdown v-if="ratioOptions.length > 0" :options="ratioOptions" :value="selectedKey(ratioOptions, displayRatio)" :node-props="option => parameterOptionProps(option, ratioOptions, displayRatio)" :theme-overrides="parameterMenuTheme" :menu-props="() => ({ role: 'menu', 'aria-label': 'Image ratios' })" trigger="click" size="small" :disabled="toolBusy || imageBusy" @update:show="ratioMenuOpen = $event" @select="$emit('selectRatio', $event)">
          <button type="button" class="capsule-select" :disabled="toolBusy || imageBusy" :aria-label="`Image ratio ${displayRatio}`" aria-haspopup="menu" :aria-expanded="ratioMenuOpen" title="Ratio for the next model generation">{{ displayRatio }}</button>
        </NDropdown>

        <NDropdown v-if="resolutionOptions.length > 0" :options="resolutionOptions" :value="selectedKey(resolutionOptions, displayResolution)" :node-props="option => parameterOptionProps(option, resolutionOptions, displayResolution)" :theme-overrides="parameterMenuTheme" :menu-props="() => ({ role: 'menu', 'aria-label': 'Image resolutions' })" trigger="click" size="small" :disabled="toolBusy || imageBusy" @update:show="resolutionMenuOpen = $event" @select="$emit('selectResolution', $event)">
          <button type="button" class="capsule-select capsule-resolution" :disabled="toolBusy || imageBusy" :aria-label="`Image resolution ${displayResolution}`" aria-haspopup="menu" :aria-expanded="resolutionMenuOpen" title="Resolution tier for the next model generation">{{ displayResolution }}</button>
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
        <button v-if="hasDisplayImage" type="button" class="capsule-icon" :disabled="toolBusy" aria-label="Download original image" title="Download the original image" @click="$emit('download')">
          <n-icon :size="14"><DownloadOutline /></n-icon>
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
      <button v-if="imageBusy" class="capsule-icon capsule-icon-solid capsule-create" title="Pause tracking" @click="$emit('stop')">
        <n-icon :size="14"><CloseCircleOutline /></n-icon>
        <span class="capsule-create-label">Pause</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { NDropdown, NIcon } from 'naive-ui'
import {
  CloseCircleOutline,
  CopyOutline,
  DownloadOutline,
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
  toolOptions: {
    type: Array,
    default: () => []
  },
  hasDisplayImage: Boolean,
  toolBusy: Boolean,
  imageBusy: Boolean
})

const ratioMenuOpen = ref(false)
const resolutionMenuOpen = ref(false)
const selectedKey = (options, displayValue) => options.find(option => (
  String(option.key).toLowerCase() === displayValue.toLowerCase() || option.label === displayValue
))?.key
const parameterOptionProps = (option, options, displayValue) => ({
  role: 'menuitemradio',
  'aria-checked': option.key === selectedKey(options, displayValue),
  'aria-disabled': Boolean(option.disabled)
})

const parameterMenuTheme = {
  color: 'var(--surface-2)',
  optionTextColor: 'var(--text)',
  optionTextColorHover: 'var(--text)',
  optionTextColorActive: 'var(--text)',
  optionColorHover: 'var(--surface-3)',
  optionColorActive: 'var(--surface-3)'
}

defineEmits([
  'selectModel',
  'selectRatio',
  'selectResolution',
  'download',
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
.capsule-select:focus-visible,
.capsule-icon:focus-visible {
  outline: 2px solid var(--text);
  outline-offset: 2px;
}

.capsule-select:disabled {
  opacity: 0.45;
  cursor: not-allowed;
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

:deep(.tool-option-icon) {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  filter: brightness(0) saturate(100%) invert(81%) sepia(6%) saturate(243%) hue-rotate(182deg) brightness(93%) contrast(88%);
}
</style>
