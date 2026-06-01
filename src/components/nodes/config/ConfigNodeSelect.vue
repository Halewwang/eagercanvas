<template>
  <n-select
    :value="modelValue"
    :options="options"
    size="small"
    @update:value="$emit('update:modelValue', $event)"
  />
</template>

<script setup>
import { NSelect } from 'naive-ui'

defineEmits(['update:modelValue'])

defineProps({
  modelValue: {
    type: [String, Number],
    default: ''
  },
  options: {
    type: Array,
    default: () => []
  }
})
</script>
