<template>
  <div class="template-canvas-preview" :class="{ empty: assetCount === 0 }">
    <div
      v-if="assetCount > 0"
      class="template-asset-grid"
      :class="`template-asset-grid--${gridSize}`"
      :style="gridStyle"
      aria-label="Template image asset preview"
    >
      <div
        v-for="asset in previewAssets"
        :key="asset.id"
        class="template-asset-cell"
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
const gridStyle = computed(() => ({
  '--template-preview-grid-size': gridSize.value || 1
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
  padding: 18px;
}

.template-asset-grid {
  width: 100%;
  height: 100%;
  display: grid;
  grid-template-columns: repeat(var(--template-preview-grid-size), minmax(0, 1fr));
  grid-template-rows: repeat(var(--template-preview-grid-size), minmax(0, 1fr));
  gap: 8px;
}

.template-asset-grid--6 {
  gap: 5px;
}

.template-asset-grid--9 {
  gap: 3px;
}

.template-asset-cell {
  min-width: 0;
  min-height: 0;
  border-radius: 8px;
  overflow: hidden;
  background: #080808;
  border: 1px solid rgba(255, 255, 255, 0.07);
  display: flex;
  align-items: center;
  justify-content: center;
}

.template-asset-grid--6 .template-asset-cell {
  border-radius: 5px;
}

.template-asset-grid--9 .template-asset-cell {
  border-radius: 3px;
}

.template-asset-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
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
