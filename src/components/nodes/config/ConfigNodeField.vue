<template>
  <div :class="rootClass">
    <div v-if="$slots.actions" class="flex items-center justify-between mb-1">
      <label class="text-xs text-[#8f939e]">{{ label }}</label>
      <slot name="actions" />
    </div>
    <label v-else class="text-xs text-[#8f939e] mb-1 block">{{ label }}</label>
    <slot />
  </div>
</template>

<script setup>
defineProps({
  label: {
    type: String,
    required: true
  },
  rootClass: {
    type: [String, Array, Object],
    default: ''
  }
})
</script>
