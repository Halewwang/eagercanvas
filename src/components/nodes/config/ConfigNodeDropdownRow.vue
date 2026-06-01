<template>
  <ConfigNodeOptionRow :label="label">
    <BaseDropdown :options="options" compact @select="$emit('select', $event)">
      <ConfigNodeDropdownButton :icon="icon">
        <slot />
      </ConfigNodeDropdownButton>
    </BaseDropdown>
  </ConfigNodeOptionRow>
</template>

<script setup>
import { BaseDropdown } from '@/components/ui'
import ConfigNodeDropdownButton from './ConfigNodeDropdownButton.vue'
import ConfigNodeOptionRow from './ConfigNodeOptionRow.vue'

defineEmits(['select'])

defineProps({
  label: {
    type: String,
    required: true
  },
  options: {
    type: Array,
    default: () => []
  },
  icon: {
    type: String,
    default: 'forward'
  }
})
</script>
