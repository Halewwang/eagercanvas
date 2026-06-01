<template>
  <div class="node-meta-row" @mousedown="emit('mousedown', $event)">
    <n-icon :size="16" class="meta-icon">
      <component :is="icon" />
    </n-icon>
    <span class="meta-title">{{ label }}</span>
  </div>
</template>

<script setup>
import { NIcon } from 'naive-ui'

const emit = defineEmits(['mousedown'])

const {
  icon,
  label
} = defineProps({
  label: {
    type: String,
    required: true
  },
  icon: {
    type: [Object, Function, String],
    required: true
  }
})
</script>
