<template>
  <component :is="as" class="canvas-surface">
    <slot />
  </component>
</template>

<script setup>
defineProps({
  as: {
    type: String,
    default: 'div'
  }
})
</script>

<style scoped>
.canvas-surface {
  background: color-mix(in srgb, var(--bg-secondary) 84%, transparent);
  border: 1px solid var(--border-color);
  box-shadow: var(--panel-shadow);
  backdrop-filter: var(--surface-blur);
}
</style>
