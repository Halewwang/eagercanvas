<template>
  <component
    :is="as"
    :value="value"
    :class="controlClasses"
    v-bind="$attrs"
    @input="$emit('input', $event)"
    @change="$emit('change', $event)"
  >
    <slot />
  </component>
</template>

<script setup>
import { computed } from 'vue'

defineOptions({
  inheritAttrs: false
})

const props = defineProps({
  as: {
    type: String,
    default: 'input'
  },
  value: {
    type: null,
    default: ''
  },
  block: {
    type: Boolean,
    default: false
  },
  table: {
    type: Boolean,
    default: false
  }
})

defineEmits(['change', 'input'])

const controlClasses = computed(() => [
  'usage-input',
  props.block ? 'w-full' : '',
  props.table ? 'usage-table-select' : ''
])
</script>

<style scoped>
.usage-input {
  min-height: 38px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.04);
  padding: 0 12px;
  color: rgba(255, 255, 255, 0.88);
  outline: none;
}

.usage-input:focus {
  border-color: rgba(255, 255, 255, 0.28);
  background: rgba(255, 255, 255, 0.065);
}

.usage-table-select {
  min-width: 190px;
  height: 34px;
  min-height: 34px;
}
</style>
