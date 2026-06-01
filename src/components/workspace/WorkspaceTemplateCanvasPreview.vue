<template>
  <div class="template-canvas-preview" :class="{ empty: assetCount === 0 }">
    <div
      v-if="assetCount > 0"
      class="template-asset-wall"
      :class="wallClasses"
      :style="wallStyle"
      aria-label="Template image asset preview"
    >
      <div
        v-for="asset in previewAssets"
        :key="asset.id"
        class="template-asset-tile"
      >
        <img
          :src="asset.url"
          :alt="asset.label"
          class="template-asset-image"
          loading="lazy"
          decoding="async"
          fetchpriority="low"
        />
      </div>
    </div>
    <div v-else class="template-canvas-empty">No image assets</div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import {
  getWorkspaceTemplatePreviewAssets,
  getWorkspaceTemplatePreviewGridSize
} from '@/utils/workspaceTemplatePreview'

const props = defineProps({
  canvasData: {
    type: Object,
    default: null
  }
})

const previewAssets = computed(() => getWorkspaceTemplatePreviewAssets(props.canvasData))
const assetCount = computed(() => previewAssets.value.length)
const gridSize = computed(() => getWorkspaceTemplatePreviewGridSize(props.canvasData))
const wallColumnCount = computed(() => (gridSize.value <= 3 ? 6 : 9))
const wallClasses = computed(() => [
  `template-asset-wall--${gridSize.value}`,
  `template-asset-wall--count-${Math.min(assetCount.value, 6)}`
])
const wallStyle = computed(() => ({
  '--template-preview-wall-columns': wallColumnCount.value
}))
</script>

<style scoped>
.template-canvas-preview {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: linear-gradient(180deg, #101010 0%, #050505 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px;
}

.template-asset-wall {
  width: 100%;
  height: 100%;
  display: grid;
  grid-template-columns: repeat(var(--template-preview-wall-columns), minmax(0, 1fr));
  grid-auto-rows: minmax(0, 1fr);
  grid-auto-flow: dense;
  gap: 4px;
}

.template-asset-wall--6 {
  gap: 3px;
}

.template-asset-wall--9 {
  gap: 2px;
}

.template-asset-tile {
  min-width: 0;
  min-height: 0;
  border-radius: 5px;
  overflow: hidden;
  background: #050505;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.05);
  display: flex;
  align-items: center;
  justify-content: center;
}

.template-asset-wall--9 .template-asset-tile {
  border-radius: 3px;
}

.template-asset-wall--count-1 .template-asset-tile {
  grid-column: 1 / -1;
  grid-row: span 4;
}

.template-asset-wall--count-2 .template-asset-tile {
  grid-column: span 3;
  grid-row: span 4;
}

.template-asset-wall--count-3 .template-asset-tile {
  grid-column: span 2;
  grid-row: span 4;
}

.template-asset-tile:nth-child(6n + 1),
.template-asset-tile:nth-child(6n + 2),
.template-asset-tile:nth-child(6n + 3) {
  grid-column: span 2;
  grid-row: span 2;
}

.template-asset-tile:nth-child(6n + 4) {
  grid-column: span 1;
  grid-row: span 2;
}

.template-asset-tile:nth-child(6n + 5) {
  grid-column: span 2;
  grid-row: span 2;
}

.template-asset-tile:nth-child(6n) {
  grid-column: span 3;
  grid-row: span 2;
}

.template-asset-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.template-canvas-empty {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(236, 238, 244, 0.6);
  font-size: 14px;
}
</style>
