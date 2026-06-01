<template>
  <button type="button" :class="buttonClasses" :disabled="disabled" @click="$emit('click')">
    <slot />
  </button>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  kind: {
    type: String,
    default: 'action'
  },
  tone: {
    type: String,
    default: 'default'
  },
  block: {
    type: Boolean,
    default: false
  },
  disabled: {
    type: Boolean,
    default: false
  }
})

defineEmits(['click'])

const buttonClasses = computed(() => {
  const kindClass = props.kind === 'primary'
    ? 'usage-primary-btn'
    : props.kind === 'micro'
      ? 'usage-micro-btn'
      : 'usage-action-btn'

  return [
    kindClass,
    props.kind === 'micro' && props.tone === 'primary' ? 'usage-micro-btn-primary' : '',
    props.kind === 'micro' && props.tone === 'danger' ? 'usage-micro-btn-danger' : '',
    props.block ? 'w-full' : ''
  ]
})
</script>

<style scoped>
.usage-action-btn {
  height: 38px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.055);
  padding: 0 14px;
  color: rgba(255, 255, 255, 0.84);
  font-size: 13px;
  transition: all 0.2s ease;
}

.usage-action-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  border-color: rgba(255, 255, 255, 0.26);
  background: rgba(255, 255, 255, 0.1);
}

.usage-action-btn:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.usage-primary-btn {
  height: 42px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.78);
  background: rgba(255, 255, 255, 0.88);
  color: #0b0b0c;
  transition: all 0.2s ease;
}

.usage-primary-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  border-color: rgba(255, 255, 255, 0.26);
  background: #fff;
  color: #09090a;
}

.usage-primary-btn:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.usage-micro-btn {
  height: 32px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.055);
  padding: 0 12px;
  color: rgba(255, 255, 255, 0.84);
  font-size: 12px;
  transition: all 0.2s ease;
}

.usage-micro-btn-primary {
  border-color: rgba(255, 255, 255, 0.78);
  background: rgba(255, 255, 255, 0.88);
  color: #0b0b0c;
}

.usage-micro-btn-danger {
  border-color: rgba(244, 114, 114, 0.26);
  color: rgba(254, 202, 202, 0.92);
}

.usage-micro-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  border-color: rgba(255, 255, 255, 0.26);
  background: rgba(255, 255, 255, 0.1);
}

.usage-micro-btn-primary:hover:not(:disabled) {
  background: #fff;
  color: #09090a;
}

.usage-micro-btn:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}
</style>
