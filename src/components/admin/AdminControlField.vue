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
  'ui-number-input': props.variant === 'number',
  'ui-select-input': props.tag === 'select'
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

.ui-select-input {
  appearance: none;
  padding-right: 36px;
  background-image:
    url("data:image/svg+xml,%3Csvg width='12' height='12' viewBox='0 0 12 12' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M3 4.5L6 7.5L9 4.5' stroke='rgba(255,255,255,0.62)' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 14px center;
  background-size: 12px 12px;
}

.ui-select-input:focus {
  background-image:
    url("data:image/svg+xml,%3Csvg width='12' height='12' viewBox='0 0 12 12' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M3 4.5L6 7.5L9 4.5' stroke='rgba(255,255,255,0.86)' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
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
