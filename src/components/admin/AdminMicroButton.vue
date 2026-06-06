<template>
  <button
    type="button"
    :class="buttonClasses"
    :disabled="disabled"
    @click="$emit('click', $event)"
  >
    <slot />
  </button>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  active: {
    type: Boolean,
    default: false
  },
  block: {
    type: Boolean,
    default: false
  },
  disabled: {
    type: Boolean,
    default: false
  },
  size: {
    type: String,
    default: 'sm',
    validator: (value) => ['xs', 'sm', 'md'].includes(value)
  },
  tone: {
    type: String,
    default: 'default'
  }
})

defineEmits(['click'])

const buttonClasses = computed(() => ({
  'ui-micro-btn': true,
  [`ui-micro-btn-${props.size}`]: true,
  'ui-micro-btn-block': props.block,
  'ui-micro-btn-primary': props.tone === 'primary' || (props.active && props.tone !== 'danger'),
  'ui-micro-btn-danger': props.tone === 'danger'
}))
</script>

<style scoped>
.ui-micro-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(255, 255, 255, 0.06);
  line-height: 1;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.9);
  transition: border-color 0.16s ease, background 0.16s ease, color 0.16s ease;
}

.ui-micro-btn-xs {
  min-height: 28px;
  padding: 4px 8px;
  font-size: 12px;
}

.ui-micro-btn-sm {
  min-height: 32px;
  padding: 6px 10px;
  font-size: 12px;
}

.ui-micro-btn-md {
  min-height: 38px;
  padding: 8px 14px;
  border-radius: 12px;
  font-size: 13px;
}

.ui-micro-btn-block {
  width: 100%;
}

.ui-micro-btn:not(:disabled):hover {
  border-color: rgba(255, 255, 255, 0.32);
  background: rgba(255, 255, 255, 0.1);
}

.ui-micro-btn:focus-visible {
  outline: 2px solid rgba(255, 255, 255, 0.55);
  outline-offset: 2px;
}

.ui-micro-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.ui-micro-btn-primary {
  border-color: rgba(255, 255, 255, 0.4);
  background: rgba(255, 255, 255, 0.16);
}

.ui-micro-btn-primary:not(:disabled):hover {
  border-color: rgba(255, 255, 255, 0.58);
  background: rgba(255, 255, 255, 0.2);
}

.ui-micro-btn-danger {
  border-color: rgba(120, 120, 120, 0.45);
  background: rgba(90, 90, 90, 0.2);
}
</style>
