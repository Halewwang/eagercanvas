<template>
  <button class="p-1 hover:bg-[rgba(255,255,255,0.04)] rounded transition-colors">
    <n-icon :size="size">
      <slot />
    </n-icon>
  </button>
</template>

<script setup>
import { NIcon } from 'naive-ui'

defineProps({
  size: {
    type: Number,
    default: 14
  }
})
</script>
