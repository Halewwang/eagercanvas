<template>
  <VueFlow
    v-model:nodes="nodesModel"
    v-model:edges="edgesModel"
    v-model:viewport="viewportModel"
    :node-types="nodeTypes"
    :edge-types="edgeTypes"
    :default-viewport="defaultViewport"
    :min-zoom="0.1"
    :max-zoom="2"
    :snap-to-grid="true"
    :snap-grid="[20, 20]"
    multi-selection-key-code="Shift"
    class="canvas-flow"
    :style="canvasFlowStyle"
    @connect="$emit('connect', $event)"
    @connect-start="$emit('connectStart', $event)"
    @connect-end="$emit('connectEnd', $event)"
    @node-click="$emit('nodeClick', $event)"
    @node-drag-start="forwardNodeDragStart"
    @node-drag-stop="$emit('nodeDragStop', $event)"
    @nodes-change="$emit('nodesChange', $event)"
    @pane-click="$emit('paneClick', $event)"
    @pane-context-menu="$emit('paneContextMenu', $event)"
    @viewport-change="$emit('viewportChange', $event)"
    @edges-change="$emit('edgesChange', $event)"
  />
</template>

<script setup>
import { computed } from 'vue'
import { VueFlow } from '@vue-flow/core'

const props = defineProps({
  nodes: {
    type: Array,
    default: () => []
  },
  edges: {
    type: Array,
    default: () => []
  },
  viewport: {
    type: Object,
    default: () => ({})
  },
  nodeTypes: {
    type: Object,
    default: () => ({})
  },
  edgeTypes: {
    type: Object,
    default: () => ({})
  },
  defaultViewport: {
    type: Object,
    default: () => ({})
  },
  canvasFlowStyle: {
    type: Object,
    default: () => ({})
  }
})

const emit = defineEmits([
  'update:nodes',
  'update:edges',
  'update:viewport',
  'connect',
  'connectStart',
  'connectEnd',
  'nodeClick',
  'nodeDragStart',
  'nodeDragStop',
  'nodesChange',
  'paneClick',
  'paneContextMenu',
  'viewportChange',
  'edgesChange'
])

const nodesModel = computed({
  get: () => props.nodes,
  set: (value) => emit('update:nodes', value)
})

const edgesModel = computed({
  get: () => props.edges,
  set: (value) => emit('update:edges', value)
})

const viewportModel = computed({
  get: () => props.viewport,
  set: (value) => emit('update:viewport', value)
})

function forwardNodeDragStart(...args) {
  emit('nodeDragStart', ...args)
}
</script>

<style>
@import '@vue-flow/core/dist/style.css';
@import '@vue-flow/core/dist/theme-default.css';

.canvas-flow {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
  background: #080808;
}

.canvas-flow .vue-flow__pane {
  background-color: rgba(18, 18, 18, 0.72);
  background-image:
    linear-gradient(rgba(22, 22, 22, 0.78), rgba(22, 22, 22, 0.78)),
    var(--canvas-grid-image, none);
  background-size: var(--canvas-grid-size, 20px 20px);
  background-position: var(--canvas-grid-position, 0 0);
}

.canvas-flow .vue-flow__node-text,
.canvas-flow .vue-flow__node-image,
.canvas-flow .vue-flow__node-video {
  box-shadow: none !important;
  border-radius: 24px !important;
}

.canvas-flow .vue-flow__edge-path {
  stroke: #ffffff;
  stroke-width: 1;
  stroke-dasharray: 0;
}

.canvas-flow .vue-flow__edge.selected .vue-flow__edge-path {
  stroke: #ffffff;
  stroke-width: 2;
  stroke-dasharray: 0;
}
</style>
