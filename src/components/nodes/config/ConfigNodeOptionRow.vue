<template>
  <div class="flex items-center justify-between">
    <span class="text-xs text-[#8f939e]">{{ label }}</span>
    <slot />
  </div>
</template>

<script setup>
defineProps({
  label: {
    type: String,
    required: true
  }
})
</script>
