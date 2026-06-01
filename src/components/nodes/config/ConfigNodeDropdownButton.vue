<template>
  <button class="flex items-center gap-1 text-sm text-[#eceff2] hover:text-[#f2f3f5]">
    <slot />
    <n-icon :size="12">
      <ChevronDownOutline v-if="icon === 'down'" />
      <ChevronForwardOutline v-else />
    </n-icon>
  </button>
</template>

<script setup>
import { NIcon } from 'naive-ui'
import { ChevronDownOutline, ChevronForwardOutline } from '@/icons/coolicons'

defineProps({
  icon: {
    type: String,
    default: 'forward'
  }
})
</script>
