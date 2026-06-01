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
        v-for="asset in previewAssetsWithLayout"
        :key="asset.id"
        :class="['template-asset-tile', asset.layoutClass]"
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
const wallColumnCount = computed(() => (assetCount.value > 0 ? 8 : 1))
const wallRowCount = computed(() => (assetCount.value > 0 ? 4 : 1))
const previewAssetsWithLayout = computed(() =>
  previewAssets.value.map((asset, index) => ({
    ...asset,
    layoutClass: `template-asset-tile--layout-${assetCount.value}-${index + 1}`
  }))
)
const wallClasses = computed(() => [
  `template-asset-wall--${gridSize.value}`,
  `template-asset-wall--count-${assetCount.value}`
])
const wallStyle = computed(() => ({
  '--template-preview-wall-columns': wallColumnCount.value,
  '--template-preview-wall-rows': wallRowCount.value
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
  grid-template-rows: repeat(var(--template-preview-wall-rows), minmax(0, 1fr));
  gap: 4px;
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

.template-asset-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.template-asset-tile--layout-1-1 {
  grid-column: 1 / -1;
  grid-row: 1 / -1;
}

.template-asset-tile--layout-2-1 {
  grid-column: 1 / 5;
  grid-row: 1 / -1;
}

.template-asset-tile--layout-2-2 {
  grid-column: 5 / 9;
  grid-row: 1 / -1;
}

.template-asset-tile--layout-3-1 {
  grid-column: 1 / 4;
  grid-row: 1 / -1;
}

.template-asset-tile--layout-3-2 {
  grid-column: 4 / 6;
  grid-row: 1 / -1;
}

.template-asset-tile--layout-3-3 {
  grid-column: 6 / 9;
  grid-row: 1 / -1;
}

.template-asset-tile--layout-4-1 {
  grid-column: 1 / 5;
  grid-row: 1 / 3;
}

.template-asset-tile--layout-4-2 {
  grid-column: 5 / 9;
  grid-row: 1 / 3;
}

.template-asset-tile--layout-4-3 {
  grid-column: 1 / 4;
  grid-row: 3 / 5;
}

.template-asset-tile--layout-4-4 {
  grid-column: 4 / 9;
  grid-row: 3 / 5;
}

.template-asset-tile--layout-5-1 {
  grid-column: 1 / 4;
  grid-row: 1 / 3;
}

.template-asset-tile--layout-5-2 {
  grid-column: 4 / 6;
  grid-row: 1 / 3;
}

.template-asset-tile--layout-5-3 {
  grid-column: 6 / 9;
  grid-row: 1 / -1;
}

.template-asset-tile--layout-5-4 {
  grid-column: 1 / 3;
  grid-row: 3 / 5;
}

.template-asset-tile--layout-5-5 {
  grid-column: 3 / 6;
  grid-row: 3 / 5;
}

.template-asset-tile--layout-6-1 {
  grid-column: 1 / 3;
  grid-row: 1 / 3;
}

.template-asset-tile--layout-6-2 {
  grid-column: 3 / 5;
  grid-row: 1 / 3;
}

.template-asset-tile--layout-6-3 {
  grid-column: 5 / 9;
  grid-row: 1 / 3;
}

.template-asset-tile--layout-6-4 {
  grid-column: 1 / 2;
  grid-row: 3 / 5;
}

.template-asset-tile--layout-6-5 {
  grid-column: 2 / 5;
  grid-row: 3 / 5;
}

.template-asset-tile--layout-6-6 {
  grid-column: 5 / 9;
  grid-row: 3 / 5;
}

.template-asset-tile--layout-7-1,
.template-asset-tile--layout-8-1,
.template-asset-tile--layout-9-1 {
  grid-column: 1 / 3;
  grid-row: 1 / 3;
}

.template-asset-tile--layout-7-2,
.template-asset-tile--layout-8-2 {
  grid-column: 3 / 5;
  grid-row: 1 / 3;
}

.template-asset-tile--layout-9-2 {
  grid-column: 3 / 5;
  grid-row: 1 / 2;
}

.template-asset-tile--layout-7-3,
.template-asset-tile--layout-8-3 {
  grid-column: 5 / 6;
  grid-row: 1 / 3;
}

.template-asset-tile--layout-9-3 {
  grid-column: 5 / 6;
  grid-row: 1 / 2;
}

.template-asset-tile--layout-8-4 {
  grid-column: 6 / 9;
  grid-row: 1 / 3;
}

.template-asset-tile--layout-9-4 {
  grid-column: 6 / 9;
  grid-row: 1 / -1;
}

.template-asset-tile--layout-7-4,
.template-asset-tile--layout-8-5,
.template-asset-tile--layout-9-5 {
  grid-column: 1 / 2;
  grid-row: 3 / 5;
}

.template-asset-tile--layout-7-5,
.template-asset-tile--layout-8-6,
.template-asset-tile--layout-9-6 {
  grid-column: 2 / 4;
  grid-row: 3 / 5;
}

.template-asset-tile--layout-7-6,
.template-asset-tile--layout-8-7,
.template-asset-tile--layout-9-7 {
  grid-column: 4 / 6;
  grid-row: 3 / 5;
}

.template-asset-tile--layout-7-7 {
  grid-column: 6 / 9;
  grid-row: 1 / -1;
}

.template-asset-tile--layout-8-8 {
  grid-column: 6 / 9;
  grid-row: 3 / 5;
}

.template-asset-tile--layout-9-8 {
  grid-column: 3 / 5;
  grid-row: 2 / 3;
}

.template-asset-tile--layout-9-9 {
  grid-column: 5 / 6;
  grid-row: 2 / 3;
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
