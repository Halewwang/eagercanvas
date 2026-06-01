<template>
  <div class="template-canvas-preview" :class="{ empty: nodeCount === 0 }">
    <template v-if="nodeCount > 0">
      <div class="template-canvas-grid"></div>
      <div class="template-canvas-stage" aria-label="Template canvas preview">
        <div
          v-for="node in previewNodes"
          :key="node.id"
          class="template-canvas-node"
          :class="`template-canvas-node--${node.type}`"
          :style="node.style"
        >
          <span>{{ node.type }}</span>
          <strong>{{ node.label }}</strong>
        </div>
      </div>
    </template>
    <div v-else class="template-canvas-empty">No nodes</div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import {
  getWorkspaceTemplateNodeCount,
  getWorkspaceTemplatePreviewNodes
} from '@/utils/workspaceTemplatePreview'

const props = defineProps({
  canvasData: {
    type: Object,
    default: null
  }
})

const nodeCount = computed(() => getWorkspaceTemplateNodeCount(props.canvasData))
const previewNodes = computed(() => getWorkspaceTemplatePreviewNodes(props.canvasData))
</script>

<style scoped>
.template-canvas-preview {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background:
    radial-gradient(circle at 50% 10%, rgba(255, 255, 255, 0.06), transparent 42%),
    linear-gradient(180deg, #17181c 0%, #101114 100%);
}

.template-canvas-grid {
  position: absolute;
  inset: 0;
  opacity: 0.38;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.04) 1px, transparent 1px);
  background-size: 34px 34px;
}

.template-canvas-stage {
  position: absolute;
  inset: 7%;
}

.template-canvas-node {
  position: absolute;
  min-width: 70px;
  min-height: 42px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(26, 28, 33, 0.92);
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.28);
  padding: 8px 10px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
}

.template-canvas-node--image {
  border-color: rgba(98, 182, 255, 0.45);
  background: linear-gradient(180deg, rgba(33, 55, 74, 0.92), rgba(22, 30, 40, 0.92));
}

.template-canvas-node--text {
  border-color: rgba(255, 217, 122, 0.42);
  background: linear-gradient(180deg, rgba(65, 51, 24, 0.9), rgba(33, 27, 18, 0.92));
}

.template-canvas-node span {
  color: rgba(236, 238, 244, 0.52);
  font-size: 10px;
  line-height: 1;
  text-transform: uppercase;
}

.template-canvas-node strong {
  color: rgba(255, 255, 255, 0.92);
  font-size: 12px;
  line-height: 1.15;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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
