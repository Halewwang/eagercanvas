<template>
  <Handle
    type="source"
    :position="Position.Right"
    id="right"
    :class="['node-handle-plus', 'node-handle-plus-right', { 'node-handle-plus-visible': showHandles }]"
  />
  <Handle
    type="target"
    :position="Position.Left"
    id="left"
    :class="['node-handle-plus', 'node-handle-plus-left', { 'node-handle-plus-visible': showHandles }]"
  />
</template>

<script setup>
import { Handle, Position } from '@vue-flow/core'

const {
  showHandles
} = defineProps({
  showHandles: {
    type: Boolean,
    default: false
  }
})
</script>
