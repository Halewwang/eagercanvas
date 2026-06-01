<template>
  <div class="capsule-menu absolute left-1/2 z-[1200]" :style="capsuleStyle">
    <div class="capsule-inner" :class="{ 'capsule-inner-selected': selected }">
      <div class="capsule-group">
        <BaseDropdown :options="chatModelOptions" :selected-key="selectedChatModel" compact @select="$emit('selectChatModel', $event)">
          <button class="capsule-select">{{ displayChatModel }}</button>
        </BaseDropdown>
      </div>

      <div class="capsule-divider" />

      <div class="capsule-group">
        <button class="capsule-icon" title="Duplicate" @click="$emit('duplicate')">
          <n-icon :size="14"><CopyOutline /></n-icon>
        </button>
        <button class="capsule-icon" title="Delete" @click="$emit('delete')">
          <n-icon :size="14"><TrashOutline /></n-icon>
        </button>
      </div>
    </div>
    <div class="capsule-inner capsule-generate" :class="{ 'capsule-inner-selected': selected }">
      <button v-if="!generating" class="capsule-icon capsule-icon-solid capsule-create" title="Create" @click="$emit('create')">
        <img :src="createIcon" alt="" class="capsule-create-graphic" />
        <span class="capsule-create-label">Create</span>
      </button>
      <button v-if="!generating" class="capsule-icon" title="Regenerate" @click="$emit('regenerate')">
        <n-icon :size="14"><RefreshOutline /></n-icon>
      </button>
      <button v-if="generating" class="capsule-icon capsule-icon-solid capsule-create" title="Stop" @click="$emit('stop')">
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
  RefreshOutline,
  TrashOutline
} from '@/icons/coolicons'
import createIcon from '@/assets/create-icon.svg'

defineProps({
  capsuleStyle: {
    type: Object,
    default: () => ({})
  },
  selected: Boolean,
  chatModelOptions: {
    type: Array,
    default: () => []
  },
  selectedChatModel: {
    type: String,
    default: ''
  },
  displayChatModel: {
    type: String,
    default: ''
  },
  generating: Boolean
})

defineEmits([
  'selectChatModel',
  'duplicate',
  'delete',
  'create',
  'regenerate',
  'stop'
])
</script>

<style scoped src="./../node-base.css"></style>
