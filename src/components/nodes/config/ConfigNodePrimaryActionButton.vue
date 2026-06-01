<template>
  <NodePrimaryButton
    class="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    :class="{ 'font-medium': emphasized }"
  >
    <slot />
  </NodePrimaryButton>
</template>

<script setup>
import NodePrimaryButton from '@/components/nodes/NodePrimaryButton.vue'

defineProps({
  emphasized: Boolean
})
</script>
