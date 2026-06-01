<template>
  <div :class="emptyClass">
    <slot />
  </div>
</template>

<script setup>
defineProps({
  emptyClass: {
    type: [String, Array, Object],
    default: 'admin-empty-state'
  }
})
</script>

<style scoped>
.admin-empty-state {
  border-radius: 12px;
  border: 1px dashed rgba(255, 255, 255, 0.15);
  padding: 18px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
}
</style>
