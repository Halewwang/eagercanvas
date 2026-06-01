<template>
  <CanvasSurface as="aside" class="absolute left-4 top-1/2 -translate-y-1/2 flex flex-col gap-2 p-2 rounded-[36px] z-20 w-[64px]">
    <CanvasToolbarButton
      round
      class="canvas-primary-tool"
      title="Add Node"
      @click="$emit('add-node')"
    >
      <n-icon :size="20"><AddOutline /></n-icon>
    </CanvasToolbarButton>
    <CanvasToolbarButton title="Asset Library" @click="$emit('open-library')">
      <n-icon :size="20"><ImageOutline /></n-icon>
    </CanvasToolbarButton>
    <CanvasToolbarButton
      :disabled="!canUndo"
      title="Undo"
      @click="$emit('undo')"
    >
      <n-icon :size="20"><ArrowUndoOutline /></n-icon>
    </CanvasToolbarButton>
    <CanvasToolbarButton
      :disabled="!canRedo"
      title="Redo"
      @click="$emit('redo')"
    >
      <n-icon :size="20"><ArrowRedoOutline /></n-icon>
    </CanvasToolbarButton>
    <CanvasToolbarButton
      class="text-white"
      title="API Settings"
      @click="$emit('open-api-settings')"
    >
      <n-icon :size="20"><SettingsOutline /></n-icon>
    </CanvasToolbarButton>
    <CanvasToolbarButton
      v-if="showLocalInjectButton"
      class="text-white"
      title="Inject Image"
      @click="$emit('inject-image')"
    >
      <n-icon :size="20"><ImageOutline /></n-icon>
    </CanvasToolbarButton>
    <div class="w-full h-px bg-[var(--border-color)] my-1"></div>
    <CanvasToolbarButton
      round
      class="mt-auto overflow-hidden border border-[var(--border-color)] bg-[var(--bg-secondary)]"
      title="Upload avatar"
      @click="$emit('upload-avatar')"
    >
      <img v-if="user?.avatarUrl" :src="user.avatarUrl" alt="avatar" class="w-full h-full object-cover" />
      <span v-else class="text-xs">{{ avatarInitial }}</span>
    </CanvasToolbarButton>
  </CanvasSurface>
</template>

<script setup>
import { NIcon } from 'naive-ui'
import {
  AddOutline,
  ArrowRedoOutline,
  ArrowUndoOutline,
  ImageOutline,
  SettingsOutline
} from '@/icons/coolicons'
import CanvasSurface from './CanvasSurface.vue'
import CanvasToolbarButton from './CanvasToolbarButton.vue'

defineProps({
  canUndo: {
    type: Boolean,
    default: false
  },
  canRedo: {
    type: Boolean,
    default: false
  },
  showLocalInjectButton: {
    type: Boolean,
    default: false
  },
  user: {
    type: Object,
    default: null
  },
  avatarInitial: {
    type: String,
    default: ''
  }
})

defineEmits(['add-node', 'open-library', 'undo', 'redo', 'open-api-settings', 'inject-image', 'upload-avatar'])
</script>

<style scoped>
.canvas-primary-tool {
  background: #ededed;
  color: #111111;
  border: 1px solid rgba(255, 255, 255, 0.22);
}

.canvas-primary-tool:hover:not(:disabled) {
  background: #d9d9d9;
}
</style>
