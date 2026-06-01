<template>
  <CanvasSurface class="absolute bottom-4 left-4 z-20 flex items-center gap-2 rounded-full p-1.5">
    <CanvasIconButton title="Fit View" @click="$emit('fit-view')">
      <n-icon :size="16"><LocateOutline /></n-icon>
    </CanvasIconButton>
    <div class="canvas-zoom-pill flex h-9 items-center gap-1 rounded-full px-2">
      <CanvasIconButton class="!h-8 !w-8" @click="$emit('zoom-out')">
        <n-icon :size="14"><RemoveOutline /></n-icon>
      </CanvasIconButton>
      <span class="flex min-w-[48px] items-center justify-center text-xs font-medium leading-none">{{ zoomPercent }}%</span>
      <CanvasIconButton class="!h-8 !w-8" @click="$emit('zoom-in')">
        <n-icon :size="14"><AddOutline /></n-icon>
      </CanvasIconButton>
    </div>
  </CanvasSurface>
</template>

<script setup>
import { NIcon } from 'naive-ui'
import { AddOutline, LocateOutline, RemoveOutline } from '@/icons/coolicons'
import CanvasIconButton from './CanvasIconButton.vue'
import CanvasSurface from './CanvasSurface.vue'

defineProps({
  zoomPercent: {
    type: Number,
    default: 100
  }
})

defineEmits(['fit-view', 'zoom-out', 'zoom-in'])
</script>

<style scoped>
.canvas-zoom-pill {
  width: auto;
  justify-content: center;
  align-items: center;
}
</style>
