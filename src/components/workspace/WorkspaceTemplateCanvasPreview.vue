<template>
  <div class="template-canvas-preview" :class="{ empty: nodeCount === 0 }">
    <template v-if="nodeCount > 0">
      <div class="template-canvas-grid"></div>
      <div class="template-canvas-stage" aria-label="Template canvas preview">
        <svg
          v-if="previewEdges.length > 0"
          class="template-canvas-edges"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <g v-for="edge in previewEdges" :key="edge.id">
            <path class="template-canvas-edge" :d="edge.path" />
            <circle class="template-canvas-edge-dot" :cx="edge.sourceDot.cx" :cy="edge.sourceDot.cy" r="0.28" />
            <circle class="template-canvas-edge-dot" :cx="edge.targetDot.cx" :cy="edge.targetDot.cy" r="0.28" />
          </g>
        </svg>
        <div
          v-for="node in previewNodes"
          :key="node.id"
          class="template-canvas-node"
          :class="[`template-canvas-node--${node.kind}`, `template-canvas-node-type--${node.type}`]"
          :style="node.style"
        >
          <img v-if="node.mediaUrl" :src="node.mediaUrl" :alt="node.label" class="template-canvas-node-media" />
          <p v-else-if="node.text" class="template-canvas-node-text">{{ node.text }}</p>
          <template v-else>
            <span>{{ node.type }}</span>
            <strong>{{ node.label }}</strong>
          </template>
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
  getWorkspaceTemplatePreviewEdges,
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
const previewEdges = computed(() => getWorkspaceTemplatePreviewEdges(props.canvasData))
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

.template-canvas-edges {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.template-canvas-edge {
  fill: none;
  stroke: rgba(214, 219, 229, 0.34);
  stroke-width: 0.16;
  vector-effect: non-scaling-stroke;
}

.template-canvas-edge-dot {
  fill: rgba(238, 241, 247, 0.82);
  vector-effect: non-scaling-stroke;
}

.template-canvas-node {
  position: absolute;
  border-radius: 5px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(16, 17, 20, 0.92);
  box-shadow: 0 5px 16px rgba(0, 0, 0, 0.22);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.template-canvas-node--media {
  border-color: rgba(255, 255, 255, 0.18);
  background: #060607;
}

.template-canvas-node--text {
  padding: 4px 5px;
  border-color: rgba(255, 255, 255, 0.1);
  background: rgba(8, 9, 11, 0.9);
}

.template-canvas-node--config {
  padding: 4px 5px;
  border-color: rgba(120, 140, 170, 0.18);
  background: rgba(9, 11, 15, 0.92);
}

.template-canvas-node-media {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.template-canvas-node-text {
  margin: 0;
  color: rgba(238, 241, 247, 0.78);
  font-size: 6px;
  line-height: 1.25;
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 4;
}

.template-canvas-node span {
  color: rgba(236, 238, 244, 0.52);
  font-size: 5px;
  line-height: 1;
  text-transform: uppercase;
}

.template-canvas-node strong {
  color: rgba(255, 255, 255, 0.92);
  font-size: 6px;
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
