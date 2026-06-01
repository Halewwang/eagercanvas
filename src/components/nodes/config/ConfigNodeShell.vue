<template>
  <div
    class="config-node-shell bg-[#0f0f0f] rounded-2xl border transition-all duration-200"
    :class="selected ? 'border-[#8f8f8f]' : 'border-transparent'"
  >
    <slot />
  </div>
</template>

<script setup>
defineProps({
  selected: Boolean
})
</script>
