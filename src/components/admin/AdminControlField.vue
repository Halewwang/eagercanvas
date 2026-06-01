<template>
  <component :is="tag" :class="controlClasses">
    <slot />
  </component>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  tag: {
    type: String,
    default: 'input'
  },
  variant: {
    type: String,
    default: 'text'
  }
})

const controlClasses = computed(() => ({
  'ui-text-input': props.variant !== 'number',
  'ui-number-input': props.variant === 'number'
}))
</script>

<style scoped>
.ui-text-input {
  width: 100%;
  min-width: 120px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(255, 255, 255, 0.06);
  padding: 6px 10px;
  color: rgba(255, 255, 255, 0.9);
}

.ui-number-input {
  width: 72px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(255, 255, 255, 0.06);
  padding: 6px 8px;
  color: rgba(255, 255, 255, 0.9);
}
</style>
