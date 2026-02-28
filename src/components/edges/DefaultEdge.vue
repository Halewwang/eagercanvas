<template>
  <BaseEdge :path="path" :style="edgeStyle" />
  <EdgeLabelRenderer>
    <div :style="sourceDotStyle" class="edge-anchor-dot nodrag nopan" />
    <div :style="targetDotStyle" class="edge-anchor-dot nodrag nopan" />
  </EdgeLabelRenderer>
</template>

<script setup>
import { computed } from 'vue'
import { BaseEdge, EdgeLabelRenderer, getBezierPath } from '@vue-flow/core'

const props = defineProps({
  sourceX: Number,
  sourceY: Number,
  targetX: Number,
  targetY: Number,
  sourcePosition: String,
  targetPosition: String,
  selected: Boolean,
  style: Object
})

const HANDLE_OFFSET = 25
const normalizePosition = (position) => String(position || '').toLowerCase()
const alignEdgeX = (x, position) => {
  const p = normalizePosition(position)
  if (p === 'right') return x - HANDLE_OFFSET
  if (p === 'left') return x + HANDLE_OFFSET
  return x
}

const alignedSourceX = computed(() => alignEdgeX(props.sourceX, props.sourcePosition))
const alignedTargetX = computed(() => alignEdgeX(props.targetX, props.targetPosition))

const path = computed(() => {
  const [edgePath] = getBezierPath({
    sourceX: alignedSourceX.value,
    sourceY: props.sourceY,
    targetX: alignedTargetX.value,
    targetY: props.targetY,
    sourcePosition: props.sourcePosition,
    targetPosition: props.targetPosition
  })
  return edgePath
})

const edgeStyle = computed(() => ({
  stroke: '#ffffff',
  strokeWidth: props.selected ? 2 : 1,
  strokeDasharray: '0',
  ...props.style
}))

const sourceDotStyle = computed(() => ({
  position: 'absolute',
  transform: `translate(-50%, -50%) translate(${alignedSourceX.value}px, ${props.sourceY}px)`,
  pointerEvents: 'none'
}))

const targetDotStyle = computed(() => ({
  position: 'absolute',
  transform: `translate(-50%, -50%) translate(${alignedTargetX.value}px, ${props.targetY}px)`,
  pointerEvents: 'none'
}))
</script>

<style scoped>
.edge-anchor-dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: #ffffff;
}
</style>
