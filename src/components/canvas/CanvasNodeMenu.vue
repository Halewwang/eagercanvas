<template>
  <CanvasSurface
    v-if="show"
    class="absolute rounded-[22px] p-6 z-30 w-[338px] border border-[rgba(143,143,143,0.24)] bg-[rgba(18,18,18,0.96)] backdrop-blur-xl"
    :style="menuStyle"
  >
    <CanvasNodeMenuHeader
      v-if="mode !== 'connect'"
      :title="title"
      :copy="copy"
    />
    <CanvasNodeTypeList
      :node-types="nodeTypes"
      @select-node-type="$emit('selectNodeType', $event)"
    />
    <CanvasNodeMenuQuantity
      :count="count"
      @decrease-count="$emit('decreaseCount')"
      @increase-count="$emit('increaseCount')"
    />
  </CanvasSurface>
</template>

<script setup>
import CanvasSurface from './CanvasSurface.vue'
import CanvasNodeMenuHeader from './CanvasNodeMenuHeader.vue'
import CanvasNodeTypeList from './CanvasNodeTypeList.vue'
import CanvasNodeMenuQuantity from './CanvasNodeMenuQuantity.vue'

defineProps({
  show: Boolean,
  mode: {
    type: String,
    default: 'toolbar'
  },
  menuStyle: {
    type: Object,
    default: () => ({})
  },
  title: {
    type: String,
    default: ''
  },
  copy: {
    type: String,
    default: ''
  },
  nodeTypes: {
    type: Array,
    default: () => []
  },
  count: {
    type: Number,
    default: 1
  }
})

defineEmits([
  'selectNodeType',
  'decreaseCount',
  'increaseCount'
])
</script>
