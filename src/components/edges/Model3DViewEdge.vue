<template>
  <BaseEdge :path="path" :style="edgeStyle" />

  <EdgeLabelRenderer>
    <div
      :style="{
        position: 'absolute',
        transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
        pointerEvents: 'all'
      }"
      class="nodrag nopan"
    >
      <BaseDropdown
        :options="viewTypeOptions"
        :selected-key="currentViewType"
        compact
        @select="handleViewTypeSelect"
      >
        <button class="flex items-center gap-1 rounded-full border border-[rgba(17,17,17,0.22)] bg-white px-2 py-1 text-xs text-black shadow-sm outline-none transition-shadow hover:shadow focus-visible:outline-none focus-visible:ring-0">
          {{ currentViewLabel }}
          <n-icon :size="10"><ChevronDownOutline /></n-icon>
        </button>
      </BaseDropdown>
    </div>
  </EdgeLabelRenderer>

  <EdgeLabelRenderer>
    <div :style="sourceDotStyle" class="edge-anchor-dot nodrag nopan" />
    <div :style="targetDotStyle" class="edge-anchor-dot nodrag nopan" />
  </EdgeLabelRenderer>
</template>

<script setup>
import { computed } from 'vue'
import { BaseEdge, EdgeLabelRenderer, getBezierPath, useVueFlow } from '@vue-flow/core'
import { NIcon } from 'naive-ui'
import { BaseDropdown } from '@/components/ui'
import { ChevronDownOutline } from '../../icons/coolicons'
import { edges, nodes } from '../../stores/canvas'
import { getModelConfig } from '../../stores/models'

const { updateEdgeData } = useVueFlow()

const props = defineProps({
  id: String,
  source: String,
  target: String,
  sourceX: Number,
  sourceY: Number,
  targetX: Number,
  targetY: Number,
  sourcePosition: String,
  targetPosition: String,
  data: Object,
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

const targetNode = computed(() => nodes.value.find((node) => node.id === props.target))
const targetModelConfig = computed(() => getModelConfig(targetNode.value?.data?.model))
const supportedViewTypes = computed(() => targetModelConfig.value?.viewTypes || ['left', 'right', 'back'])

const viewTypeOptions = computed(() => supportedViewTypes.value.map((viewType) => ({
  key: viewType,
  label: formatViewType(viewType)
})))

const currentViewType = computed(() => {
  const next = String(props.data?.viewType || '').trim()
  return supportedViewTypes.value.includes(next) ? next : supportedViewTypes.value[0]
})

const currentViewLabel = computed(() => formatViewType(currentViewType.value))

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

const labelX = computed(() => (alignedSourceX.value + alignedTargetX.value) / 2)
const labelY = computed(() => (props.sourceY + props.targetY) / 2)

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

const formatViewType = (value) => String(value || '').replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())

const handleViewTypeSelect = (viewType) => {
  const duplicates = edges.value.filter((edge) => (
    edge.id !== props.id &&
    edge.target === props.target &&
    edge.type === 'model3dView' &&
    edge.data?.viewType === viewType
  ))

  duplicates.forEach((edge) => {
    const nextAvailable = supportedViewTypes.value.find((candidate) => !edges.value.some((item) => (
      item.id !== edge.id &&
      item.target === props.target &&
      item.type === 'model3dView' &&
      item.data?.viewType === candidate
    )))

    updateEdgeData(edge.id, { viewType: nextAvailable || supportedViewTypes.value[0] })
  })

  updateEdgeData(props.id, { viewType })
}
</script>

<style scoped>
.edge-anchor-dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: #ffffff;
}
</style>
