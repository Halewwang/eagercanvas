<template>
  <MultiAngleToolDrawer
    :show="showMultiAngle"
    :image-url="imageUrl"
    :model="model"
    :ratio="ratio"
    :resolution="resolution"
    :ratio-options="ratioOptions"
    :on-submitted="onMultiAngleSubmitted"
    @update:show="$emit('update:showMultiAngle', $event)"
    @pending="$emit('multiAnglePending', $event)"
    @apply="$emit('multiAngleApply', $event)"
    @error="$emit('multiAngleError', $event)"
  />
  <Wedding3x3ToolDrawer
    :show="showWedding3x3"
    :image-url="imageUrl"
    :model="model"
    :ratio="ratio"
    :resolution="resolution"
    :on-submitted="onWedding3x3Submitted"
    @update:show="$emit('update:showWedding3x3', $event)"
    @pending="$emit('wedding3x3Pending', $event)"
    @apply="$emit('wedding3x3Apply', $event)"
    @error="$emit('wedding3x3Error', $event)"
  />
</template>

<script setup>
import MultiAngleToolDrawer from '@/components/tools/MultiAngleToolDrawer.vue'
import Wedding3x3ToolDrawer from '@/components/tools/Wedding3x3ToolDrawer.vue'

defineProps({
  showMultiAngle: Boolean,
  showWedding3x3: Boolean,
  onMultiAngleSubmitted: Function,
  onWedding3x3Submitted: Function,
  imageUrl: {
    type: String,
    default: ''
  },
  model: {
    type: String,
    default: ''
  },
  ratio: {
    type: String,
    default: ''
  },
  resolution: {
    type: String,
    default: ''
  },
  ratioOptions: {
    type: Array,
    default: () => []
  },
})

defineEmits([
  'update:showMultiAngle',
  'update:showWedding3x3',
  'multiAnglePending',
  'multiAngleApply',
  'multiAngleError',
  'wedding3x3Pending',
  'wedding3x3Apply',
  'wedding3x3Error'
])
</script>
