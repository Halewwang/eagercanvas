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
  disabled: {
    type: Boolean,
    default: false
  },
  tone: {
    type: String,
    default: 'default'
  }
})

defineEmits(['click'])

const buttonClasses = computed(() => ({
  'ui-micro-btn': true,
  'ui-micro-btn-primary': props.tone === 'primary' || (props.active && props.tone !== 'danger'),
  'ui-micro-btn-danger': props.tone === 'danger'
}))
</script>

<style scoped>
.ui-micro-btn {
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(255, 255, 255, 0.06);
  padding: 5px 10px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.9);
}

.ui-micro-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.ui-micro-btn-primary {
  border-color: rgba(255, 255, 255, 0.4);
  background: rgba(255, 255, 255, 0.16);
}

.ui-micro-btn-danger {
  border-color: rgba(120, 120, 120, 0.45);
  background: rgba(90, 90, 90, 0.2);
}
</style>
