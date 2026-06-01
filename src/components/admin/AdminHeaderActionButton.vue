<template>
  <button type="button" class="ui-action-btn whitespace-nowrap" :disabled="disabled" @click="$emit('click')">
    <slot />
  </button>
</template>

<script setup>
defineEmits(['click'])

defineProps({
  disabled: {
    type: Boolean,
    default: false
  }
})
</script>

<style scoped>
.ui-action-btn {
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(255, 255, 255, 0.06);
  padding: 9px 14px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.9);
}

.ui-action-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
</style>
