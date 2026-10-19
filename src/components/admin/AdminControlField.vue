<template>
  <input :class="controlClasses">
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
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
  min-height: 38px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(255, 255, 255, 0.06);
  padding: 7px 10px;
  color: rgba(255, 255, 255, 0.9);
  font-size: 13px;
  line-height: 1.3;
}

.ui-number-input {
  width: 84px;
  min-height: 38px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(255, 255, 255, 0.06);
  padding: 7px 8px;
  color: rgba(255, 255, 255, 0.9);
  font-size: 13px;
  line-height: 1.3;
}

.ui-text-input:focus,
.ui-number-input:focus {
  border-color: rgba(255, 255, 255, 0.34);
  outline: none;
  background: rgba(255, 255, 255, 0.08);
}

.ui-text-input:disabled,
.ui-number-input:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
</style>
