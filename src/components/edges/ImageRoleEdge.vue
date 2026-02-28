<template>
  <!-- Custom edge with image role selector | 带图片角色选择器的自定义边 -->
  <BaseEdge :path="path" :style="edgeStyle" />
  
  <!-- Edge label with role dropdown | 带角色下拉的边标签 -->
  <EdgeLabelRenderer>
    <div 
      :style="{ 
        position: 'absolute', 
        transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
        pointerEvents: 'all'
      }"
      class="nodrag nopan"
    >
      <n-dropdown 
        :options="imageRoleOptions" 
        @select="handleRoleSelect"
        size="small"
      >
        <button 
          class="flex items-center gap-1 text-xs text-black px-2 py-1 rounded-full bg-white border border-gray-200 shadow-sm hover:shadow transition-shadow"
        >
          {{ currentRoleLabel }}
          <n-icon :size="10"><ChevronDownOutline /></n-icon>
        </button>
      </n-dropdown>
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
import { NDropdown, NIcon } from 'naive-ui'
import { ChevronDownOutline } from '../../icons/coolicons'
import { edges } from '../../stores/canvas'

// Get VueFlow instance | 获取 VueFlow 实例
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
  markerEnd: String,
  style: Object
})

// Image role options | 图片角色选项
const imageRoleOptions = [
  { label: 'First Frame', key: 'first_frame_image' },
  { label: 'Second Frame', key: 'last_frame_image' },
  { label: 'Reference Picture', key: 'input_reference' }
]

// Current role from edge data | 从边数据获取当前角色
const currentRole = computed(() => props.data?.imageRole || 'first_frame_image')

// Current role label | 当前角色标签
const currentRoleLabel = computed(() => {
  const option = imageRoleOptions.find(o => o.key === currentRole.value)
  return option?.label || 'First Frame'
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

// Calculate bezier path | 计算贝塞尔路径
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

// Label position (center of edge) | 标签位置（边的中心）
const labelX = computed(() => (alignedSourceX.value + alignedTargetX.value) / 2)
const labelY = computed(() => (props.sourceY + props.targetY) / 2)
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

// Edge style | 边样式
const edgeStyle = computed(() => ({
  stroke: '#ffffff',
  strokeWidth: props.selected ? 2 : 1,
  strokeDasharray: '0',
  ...props.style
}))

// Handle role selection | 处理角色选择
const handleRoleSelect = (role) => {
  // If selecting first_frame or last_frame, ensure uniqueness | 如果选择首帧或尾帧，确保唯一性
  if (role === 'first_frame_image' || role === 'last_frame_image') {
    // Find other edges connected to the same target with the same role | 查找连接到同一目标且具有相同角色的其他边
    const sameTargetEdges = edges.value.filter(edge => 
      edge.target === props.target && 
      edge.id !== props.id && 
      edge.data?.imageRole === role
    )
    
    // Auto-switch the other edge to the opposite role | 自动切换其他边到相反角色
    sameTargetEdges.forEach(edge => {
      const oppositeRole = role === 'first_frame_image' ? 'last_frame_image' : 'first_frame_image'
      updateEdgeData(edge.id, { imageRole: oppositeRole })
    })
  }
  
  // Update current edge role | 更新当前边角色
  updateEdgeData(props.id, { imageRole: role })
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
